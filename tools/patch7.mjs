import fs from 'fs';
const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const rd = (p) => fs.readFileSync(root + p, 'utf8');
const wr = (p, s) => fs.writeFileSync(root + p, s);
const rep = (s, a, b, what) => { if (!s.includes(a)) throw new Error('anchor missing: ' + what); return s.replace(a, b); };

// ---------- terrain: rock attribute + detail maps ----------
let t = rd('src/world/terrain.js');
t = rep(t, `import { toWorld, H_SCALE, V_SCALE, WORLD_HALF } from '../config.js?v=202609161601';`, `import { toWorld, H_SCALE, V_SCALE, WORLD_HALF } from '../config.js?v=202609161601';
import { loadTex, terrainDetail } from './textures.js?v=202609161601';`, 'import');
t = rep(t, `  const rock = Math.max(rockByHeight, rockBySlope);
  c.lerp(slope > 0.35 ? LIMESTONE_DK : LIMESTONE, rock * (0.75 + 0.25 * n));
  return c;
}`, `  const rock = Math.max(rockByHeight, rockBySlope);
  c.lerp(slope > 0.35 ? LIMESTONE_DK : LIMESTONE, rock * (0.75 + 0.25 * n));
  c.userData = rock;
  return c;
}`, 'shade rock');
t = rep(t, `  const col = new Float32Array(pos.count * 3);
  const hs = new Float32Array(pos.count);`, `  const col = new Float32Array(pos.count * 3);
  const rockA = new Float32Array(pos.count);
  const hs = new Float32Array(pos.count);`, 'rock attr');
t = rep(t, `    const c = shade(hs[i], slope, pos.getX(i), pos.getZ(i));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });`, `    const c = shade(hs[i], slope, pos.getX(i), pos.getZ(i));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    rockA[i] = hs[i] < 1.5 ? 0 : (c.userData || 0);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('rock', new THREE.BufferAttribute(rockA, 1));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  // photographic detail: scrub and limestone maps blended by the rock attribute
  Promise.all([loadTex('scrub_ground'), loadTex('limestone_rock')]).then(([s, r]) => { if (s && r) terrainDetail(mat, s, r, opts.tile || 90); });`, 'terrain mat');
t = rep(t, `  const fine = buildGrid(GIB_CENTRE.x, GIB_CENTRE.z, GIB_HALF * 2, 180, terrainHeight);`, `  const fine = buildGrid(GIB_CENTRE.x, GIB_CENTRE.z, GIB_HALF * 2, 180, terrainHeight, { tile: 45 });`, 'fine tile');
wr('src/world/terrain.js', t);

// ---------- buildings: planar UVs + textures ----------
let b = rd('src/world/buildings.js');
b = rep(b, `import { terrainHeight } from './terrain.js?v=202609161601';`, `import { terrainHeight } from './terrain.js?v=202609161601';
import { planarUVs, texture } from './textures.js?v=202609161601';

// which generated texture dresses each material key, and the tile size in metres
const TEX = { tile: ['roof_tiles', 2.5], white: ['rendered_wall', 4], ochre: ['rendered_wall', 4], pink: ['rendered_wall', 4], cream: ['rendered_wall', 4],
  stone: ['stone_quay', 3], slate: ['corrugated_iron', 3], catchment: ['corrugated_iron', 2], concrete: ['tarmac', 6] };`, 'import');
b = rep(b, `      const mesh = new THREE.Mesh(merged, MATS[k]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);`, `      const geo = TEX[k] ? planarUVs(merged) : merged;
      const mat = TEX[k] ? MATS[k].clone() : MATS[k];
      if (TEX[k]) texture(mat, TEX[k][0], TEX[k][1], { tint: MATS[k].color.clone().lerp(new THREE.Color(0xffffff), 0.5) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);`, 'build');
wr('src/world/buildings.js', b);

// ---------- harbour: moles, jetty, runway, apron ----------
let h = rd('src/world/harbour.js');
h = rep(h, `import { terrainHeight } from './terrain.js?v=202609161601';`, `import { terrainHeight } from './terrain.js?v=202609161601';
import { planarUVs, texture } from './textures.js?v=202609161601';`, 'import');
h = rep(h, `const white = new THREE.MeshStandardMaterial({ color: 0xf0efe8, roughness: 0.8 });`, `const white = new THREE.MeshStandardMaterial({ color: 0xf0efe8, roughness: 0.8 });
texture(stone, 'stone_quay', 3, { keepColor: false }); texture(concrete, 'tarmac', 6); texture(tarmac, 'tarmac', 5, { tint: new THREE.Color(0x8a8b8e) });
// boxes get world-scale UVs when they are made
const _box = (w, h, d) => planarUVs(new THREE.BoxGeometry(w, h, d));`, 'materials');
h = h.split('new THREE.BoxGeometry(width, height, len + width)').join('_box(width, height, len + width)');
h = h.split('new THREE.Mesh(new THREE.BoxGeometry(60, 3, 140), concrete)').join('new THREE.Mesh(_box(60, 3, 140), concrete)');
h = h.split('new THREE.Mesh(new THREE.BoxGeometry(120, 2, 90), concrete)').join('new THREE.Mesh(_box(120, 2, 90), concrete)');
h = h.split('new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, 22), tarmac)').join('new THREE.Mesh(_box(len, 1.2, 22), tarmac)');
h = rep(h, `const timber = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 });`, `const timber = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 });
texture(timber, 'timber_deck', 2.4, { keepColor: false });`, 'timber');
h = h.split('new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 5.6), timber)').join('new THREE.Mesh(_box(len, 0.35, 5.6), timber)');
h = h.split('new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 40), timber)').join('new THREE.Mesh(_box(14, 0.6, 40), timber)');
// the mole boxes are rotated: planar UVs are computed in local space, which is fine for repeats
wr('src/world/harbour.js', h);

// ---------- audio: samples layer ----------
let a = rd('src/audio.js');
a = rep(a, `export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.engines = []; this.enabled = true;
    this.music = new Music(this);
    this.settle = 0; this.lastThrottle = 0;
  }`, `import { Samples } from './samples.js?v=202609161601';

export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.engines = []; this.enabled = true;
    this.music = new Music(this);
    this.settle = 0; this.lastThrottle = 0;
    this.samples = new Samples(this);
  }
  say(name, cooldown) { return this.samples.say(name, cooldown); }`, 'ctor');
a = rep(a, `    this.buildAmbience();
    this.music.init();
  }`, `    this.buildAmbience();
    this.music.init();
    this.samples.load();
  }`, 'init');
a = rep(a, `    this.settle = 3;
  }
  stopEngines() {`, `    this.settle = 3;
    // recorded engine loops, if generated: idle / cruise / full crossfaded by rpm on the same bus
    this.engineLoops = null;
    if (this.samples.has('engine_idle') || this.samples.has('engine_cruise') || this.samples.has('engine_full')) {
      this.engineLoops = { idle: this.samples.loop('engine_idle', this.engineBus), cruise: this.samples.loop('engine_cruise', this.engineBus), full: this.samples.loop('engine_full', this.engineBus) };
      for (const e of this.engines) e.vg.gain.value = 0.12;   // synth drops to a supporting layer
    }
    if (this.samples.has('wind')) this.windLoop = this.samples.loop('wind');
    if (this.samples.has('water_wash')) this.waterLoop = this.samples.loop('water_wash');
  }
  stopEngines() {
    this.samples.stopLoops(); this.engineLoops = null; this.windLoop = null; this.waterLoop = null;`, 'engine loops');
a = rep(a, `      e.vg.gain.setTargetAtTime(0.45 + 0.1 * Math.random(), t, 0.05);
    }`, `      e.vg.gain.setTargetAtTime((this.engineLoops ? 0.12 : 0.45) + 0.05 * Math.random(), t, 0.05);
    }
    if (this.engineLoops) {
      const L = this.engineLoops;
      const idle = Math.max(0, 1 - rpm / 0.5), cruise = Math.max(0, 1 - Math.abs(rpm - 0.62) / 0.35), full = Math.max(0, (rpm - 0.72) / 0.28);
      const rate = 0.9 + 0.2 * rpm;
      for (const [k, v] of [['idle', idle], ['cruise', cruise], ['full', full]]) { if (L[k]) { L[k].gain.gain.setTargetAtTime(v * 1.6, t, 0.2); L[k].src.playbackRate.setTargetAtTime(rate, t, 0.3); } }
    }`, 'engine mix');
a = rep(a, `    this.wind.g.gain.setTargetAtTime(windLevel, t, 0.3);`, `    this.wind.g.gain.setTargetAtTime(this.windLoop ? windLevel * 0.3 : windLevel, t, 0.3);
    if (this.windLoop) { this.windLoop.gain.gain.setTargetAtTime(windLevel * 1.4, t, 0.3); this.windLoop.src.playbackRate.setTargetAtTime(0.85 + sp / 200, t, 0.3); }`, 'wind');
a = rep(a, `    this.water.lfoG.gain.setTargetAtTime(waterLevel * 0.45, t, 0.25);`, `    this.water.lfoG.gain.setTargetAtTime(waterLevel * 0.45, t, 0.25);
    if (this.waterLoop) { this.waterLoop.gain.gain.setTargetAtTime(waterLevel * 1.5, t, 0.25); this.water.g.gain.setTargetAtTime(waterLevel * 0.25, t, 0.25); }`, 'water');
a = rep(a, `  gun() { this.burst(0.5, 1400, 0.045, 0.5); this.burst(0.35, 180, 0.09, 0.6); }`, `  gun(kind = 'vickers') {
    const clip = kind === 'browning' ? 'browning_twin' : 'vickers_k';
    if (this.samples.has(clip)) { if (!this._gunT || this.ctx.currentTime - this._gunT > 0.25) { this._gunT = this.ctx.currentTime; this.samples.play(clip, 0.7, 0.95 + Math.random() * 0.1); } return; }
    this.burst(0.5, 1400, 0.045, 0.5); this.burst(0.35, 180, 0.09, 0.6);
  }
  shellSplash() { if (this.samples.has('shell_splash')) this.samples.play('shell_splash', 0.6); else this.burst(0.4, 500, 0.5, 0.4); }
  gulls() { if (this.samples.has('gulls')) this.samples.play('gulls', 0.35); }`, 'gun');
a = rep(a, `  splash() { this.burst(0.6, 600, 0.6, 0.4); }
  boom(vol = 1) {
    if (!this.ctx) return;`, `  splash() { if (this.samples.has('splash')) { this.samples.play('splash', 0.7); return; } this.burst(0.6, 600, 0.6, 0.4); }
  boom(vol = 1, underwater = false) {
    if (!this.ctx) return;
    const clip = underwater ? 'depth_charge' : 'explosion';
    if (this.samples.has(clip)) { this.samples.play(clip, Math.min(1.2, vol)); return; }`, 'boom');
a = rep(a, `  hitPlayer() { this.burst(0.5, 2600, 0.08); this.burst(0.3, 400, 0.15); }`, `  hitPlayer() { if (this.samples.has('flak_hits')) { if (!this._hitT || this.ctx.currentTime - this._hitT > 0.4) { this._hitT = this.ctx.currentTime; this.samples.play('flak_hits', 0.8); } return; } this.burst(0.5, 2600, 0.08); this.burst(0.3, 400, 0.15); }`, 'hit');
a = rep(a, `  morse(text) {
    if (!this.ctx) return;`, `  morse(text) {
    if (!this.ctx) return;
    if (this.samples.has('morse')) { this.samples.play('morse', 0.5); return; }`, 'morse');
wr('src/audio.js', a);

// weapons: underwater boom, shell splash sound
let w = rd('src/weapons.js');
w = rep(w, `      this.audio && this.audio.boom(0.9);
    } else {`, `      this.audio && this.audio.boom(0.9, true);
    } else {`, 'uw boom');
w = rep(w, `        } else weapons.splash(pt, 2.8);`, `        } else weapons.splash(pt, 2.8);`, 'noop');
wr('src/weapons.js', w);

// main: voice hooks, gun kind, gulls, shell splash sound
let m = rd('src/main.js');
m = rep(m, `        } else weapons.splash(pt, 2.8);`, `        } else { weapons.splash(pt, 2.8); audio.shellSplash(); }`, 'shell splash');
m = rep(m, `  audio.startEngines(spec.engines.startsWith('4') ? 4 : spec.engines.startsWith('2') ? 2 : 1, spec.id === 'swordfish' ? 70 : 55);`, `  audio.startEngines(spec.engines.startsWith('4') ? 4 : spec.engines.startsWith('2') ? 2 : 1, spec.id === 'swordfish' ? 70 : 55);
  setTimeout(() => G.running && audio.say('voice_bow_ready', 999), 2500);`, 'bow ready');
m = rep(m, `      weapons.fireTracer(_v1, dir, 500, false, 0.015);
      audio.gun();`, `      weapons.fireTracer(_v1, dir, 500, false, 0.015);
      audio.gun(/Browning/.test(gd.name) ? 'browning' : 'vickers');`, 'gun kind 1');
m = rep(m, `    weapons.fireTracer(_v1, dir, 500 + f.speed, false, 0.012);
    audio.gun();`, `    weapons.fireTracer(_v1, dir, 500 + f.speed, false, 0.012);
    audio.gun(/Browning/.test(g.name) ? 'browning' : 'vickers');`, 'gun kind 2');
m = rep(m, `    weapons.dropCharge(_v1, vel, weapons.depthSetting);`, `    weapons.dropCharge(_v1, vel, weapons.depthSetting);
    audio.say('voice_charges_away', 6);`, 'charges away');
m = rep(m, `      if (v.idProgress >= 1) { v.identified = true; G.idCount++; ctx.log(\`Identified: \${v.name} — \${v.label}\${v.kind === 'neutral' ? ' (neutral: do not attack)' : ''}.\`, v.kind === 'neutral' ? '' : 'ok'); G.score += 20; }`, `      if (v.idProgress >= 1) {
        v.identified = true; G.idCount++; ctx.log(\`Identified: \${v.name} — \${v.label}\${v.kind === 'neutral' ? ' (neutral: do not attack)' : ''}.\`, v.kind === 'neutral' ? '' : 'ok'); G.score += 20;
        if (v.kind === 'submarine') audio.say('voice_contact', 30); else if (v.kind === 'neutral') audio.say('voice_neutral', 40);
      }`, 'identify voice');
m = rep(m, `  if (byCharge && amount > 0.2) { ctx.log(\`Depth charge straddle on \${v.name}!\`, 'ok'); G.score += 40; }`, `  if (byCharge && amount > 0.2) { ctx.log(\`Depth charge straddle on \${v.name}!\`, 'ok'); G.score += 40; audio.say('voice_straddle', 20); }`, 'straddle voice');
m = rep(m, `ctx.log(\`Rear gunner: aircraft closing from astern — \${b.name}!\`, 'bad'); audio.music.setMood('combat'); });`, `ctx.log(\`Rear gunner: aircraft closing from astern — \${b.name}!\`, 'bad'); audio.music.setMood('combat'); audio.say('voice_bandit', 60); });`, 'bandit voice');
m = rep(m, `  G.score += 30;
  // responders`, `  G.score += 30;
  setTimeout(() => G.running && audio.say('voice_wt', 15), 1800);
  // responders`, 'wt voice');
m = rep(m, `          G.landedMsg = true; ctx.log('Down at ' + fmtClock(G.clock) + '. Taxi to the jetty at New Camp (the yellow flag) and cut the engines alongside.', 'ok');`, `          G.landedMsg = true; ctx.log('Down at ' + fmtClock(G.clock) + '. Taxi to the jetty at New Camp (the yellow flag) and cut the engines alongside.', 'ok'); audio.say('voice_down', 999);`, 'down voice');
m = rep(m, `          o.done = true; G.score += 50; ctx.log('Alongside the jetty ' + fmtClock(G.clock) + '. Engines cut. Sortie complete.', 'ok');`, `          o.done = true; G.score += 50; ctx.log('Alongside the jetty ' + fmtClock(G.clock) + '. Engines cut. Sortie complete.', 'ok'); audio.say('voice_alongside', 999);`, 'alongside voice');
m = rep(m, `  updateMarshallers(p, f.onWater, G.time);`, `  updateMarshallers(p, f.onWater, G.time);
  // gulls over the harbour when taxiing
  if (f.onWater && Math.hypot(p.x - JETTY.x, p.z - JETTY.z) < 900 && Math.random() < dt / 22) audio.gulls();`, 'gulls');
wr('src/main.js', m);

// vessels: diving voice via ctx
let v = rd('src/vessels.js');
v = rep(v, `this.alarm = null; ctx.log(\`\${this.name}: crash-diving!\`); }`, `this.alarm = null; ctx.log(\`\${this.name}: crash-diving!\`); ctx.audio && ctx.audio.say('voice_diving', 30); }`, 'diving voice');
wr('src/vessels.js', v);
console.log('patch7 ok');
