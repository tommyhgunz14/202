import * as THREE from 'three';
import { loadOrPlaceholder, findNamed } from './loader.js';
import { toWorld, KT } from './config.js';
import { terrainHeight } from './world/terrain.js';
import { foamStrip } from './world/foam.js';
import { seaHeight } from './world/sea.js';

export const VESSEL_TYPES = {
  uboat: { asset: 'assets/uboat_viic.js', length: 67.1, beam: 6.2, kind: 'submarine', faction: 'german', label: 'German U-boat (Type VIIC)', hp: 1.0, surfSpeed: 17, subSpeed: 6, flak: true },
  itsub: { asset: 'assets/italian_sub_brin.js', length: 72.5, beam: 6.9, kind: 'submarine', faction: 'italian', label: 'Italian submarine (Brin class)', hp: 1.0, surfSpeed: 17, subSpeed: 7, flak: true },
  wishart: { asset: 'assets/rn_destroyer_wishart.js', length: 95.1, beam: 9.0, kind: 'warship', faction: 'rn', label: 'HMS Wishart (D67)', hp: 3, surfSpeed: 31 },
  freighter: { asset: 'assets/german_freighter.js', length: 118, beam: 16, kind: 'merchant', faction: 'german', label: 'German freighter', hp: 3, surfSpeed: 11 },
  vichy: { asset: 'assets/vichy_destroyer_fantasque.js', length: 132.4, beam: 12, kind: 'warship', faction: 'vichy', label: 'French contre-torpilleur (Le Fantasque class)', hp: 4, surfSpeed: 37, flak: true },
  coaster: { asset: 'assets/spanish_coaster.js', length: 48, beam: 8, kind: 'neutral', faction: 'spain', label: 'Spanish coaster', hp: 1.5, surfSpeed: 9 },
  fishing: { asset: 'assets/fishing_boat.js', length: 16, beam: 4.5, kind: 'neutral', faction: 'spain', label: 'Fishing boat', hp: 0.5, surfSpeed: 6 },
  raft: { asset: 'assets/target_raft.js', length: 12, beam: 12, kind: 'target', faction: 'target', label: 'Target raft', hp: 2.5, surfSpeed: 0 },
  hulk: { asset: 'assets/spanish_coaster.js', length: 48, beam: 8, kind: 'target', faction: 'target', label: 'Target hulk (condemned coaster)', hp: 5, surfSpeed: 0, recolour: 0x6b4a3a },
  subtarget: { asset: 'assets/uboat_viic.js', length: 67.1, beam: 6.2, kind: 'target', faction: 'target', label: 'Submarine silhouette target', hp: 3, surfSpeed: 0 },
  merchant: { asset: 'assets/german_freighter.js', length: 118, beam: 16, kind: 'merchant', faction: 'allied', label: 'Allied merchantman', hp: 3, surfSpeed: 10, recolour: 0x5a6068 },
  // HMS Seraph (P219), an S-class boat: no model of her own, so the Type VIIC hull stands in with a
  // White Ensign on the bridge. She never dives on a friendly aircraft and carries no flak here.
  rnsub: { asset: 'assets/uboat_viic.js', length: 66.1, beam: 7.2, kind: 'submarine', faction: 'rn', label: 'British submarine (S class)', hp: 1.0, surfSpeed: 14, subSpeed: 9, ensign: true, noRef: true },
  // men in the water after a boat is abandoned: Carley floats, men in life-jackets, wreckage
  survivors: { asset: 'assets/survivors.js', length: 26, beam: 26, kind: 'survivors', faction: 'survivors', label: 'Survivors in the water', hp: 99, surfSpeed: 0, noRef: true },
};

const _v = new THREE.Vector3();

// Soft wake texture: bright at the stern, fading astern and toward the edges.
let wakeTex = null;
export function getWakeTexture() {
  if (wakeTex) return wakeTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(64, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
    const u = (x - 31.5) / 32, t = y / 127;            // t = 0 at the stern end (top), 1 far astern
    const edge = Math.max(0, 1 - u * u * 1.6);
    const spread = 0.35 + t * 0.65;                    // wake widens astern
    const a = Math.max(0, edge - (Math.abs(u) > spread ? 1 : 0)) * (1 - t) * (0.55 + 0.45 * Math.sin(t * 40) * 0.2);
    const i = (y * 64 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  wakeTex = new THREE.CanvasTexture(c); wakeTex.colorSpace = THREE.SRGBColorSpace;
  return wakeTex;
}

export class Vessel {
  constructor(def, spec, group, opts) {
    this.def = { hulk: 'spanish_coaster', subtarget: 'uboat_viic', merchant: 'german_freighter', uboat: 'uboat_viic', itsub: 'italian_sub_brin', wishart: 'rn_destroyer_wishart', freighter: 'german_freighter', vichy: 'vichy_destroyer_fantasque', coaster: 'spanish_coaster', fishing: 'fishing_boat' }[def] || def; this.spec = spec; this.group = group;
    if (spec.noRef) this.def = null;   // no recognition card: the HUD must not ask for one every frame
    this.name = opts.name || spec.label;
    this.label = opts.label || spec.label;
    this.kind = spec.kind; this.faction = spec.faction;
    this.length = spec.length;
    this.hp = spec.hp; this.alive = true; this.sinking = 0;
    this.heading = (opts.heading || 0) * Math.PI / 180;
    this.speedKt = opts.speed != null ? opts.speed : spec.surfSpeed * 0.6;
    if (this.speedKt < 3 && opts.role !== 'responder' && spec.faction !== 'target') this.speedKt = 5;
    if (spec.faction === 'target' || spec.faction === 'survivors') { this.speedKt = 0; this.stopped = true; }
    this.waypoints = (opts.waypoints || []).map(([la, lo]) => { const p = findWater(...Object.values(toWorld(la, lo))); return new THREE.Vector3(p.x, 0, p.z); });
    this.wpIdx = 0;
    this.identified = spec.faction === 'target'; this.idProgress = this.identified ? 1 : 0;
    this.fireT = 0; this.scorches = 0;
    this.reported = false;
    this.surfaced = opts.surfaced != null ? opts.surfaced : true;
    this.depth = this.surfaced ? 0 : (opts.depth || 25);
    this.targetDepth = this.depth;
    this.diveCooldown = 0; this.surfaceTimer = opts.resurfaceAfter || 0;
    this.behaviour = opts.behaviour || 'patrol';
    // lookout quality and dive performance can be set per boat: alarm = seconds from sighting to
    // the klaxon, diveRate = metres per second going down, lookout = scale on spotting range
    this.leaking = !!opts.leaking; this.bubbleT = 0; this.oilT = 0;
    this.shadow = null; this.featherT = 0; this.trailT = 0; this.shadowSeen = false;
    this.alarmRange = opts.alarm || [2, 7];
    this.diveRate = opts.diveRate || 0.6;
    this.lookout = opts.lookout || 1;
    this.waterline = group.userData.waterline || 4;
    this.flakTimer = 0; this.flakAmmo = 1;
    this.hunting = false; this.huntTarget = null; this.dcTimer = 0;
    this.role = opts.role || null;
    this.escortOf = opts.escortOf || null;
    this.stopped = false;
    this.hit = 0;
    // wake: a foam strip astern, head at the stern, scaled with speed, hidden when dived or stopped
    this.wake = foamStrip(spec.beam * 2.0, spec.length * 1.8, { repeatY: Math.max(2, spec.length / 15), edge: 0.5 });
    this.wake.position.set(0, 0, -spec.length * 0.5 - spec.length * 0.9);
    group.add(this.wake);
  }

  get position() { return this.group.position; }

  update(dt, ctx) {
    const g = this.group;
    if (!this.alive) {
      this.sinking += dt;
      g.position.y -= dt * (this.kind === 'submarine' ? 1.2 : 0.6);
      g.rotation.x += dt * (this.sternFirst ? -0.1 : 0.03 * (this.kind === 'submarine' ? 1 : 0.5));
      if (this.sinking > 40) g.visible = false;
      return;
    }
    // movement
    let speed = this.speedKt / KT;
    if (this.kind === 'submarine' && !this.surfaced) speed = Math.min(speed, this.spec.subSpeed / KT);
    if (this.stopped) speed = 0;
    // waypoint steering
    if (this.hunting && this.huntTarget) {
      const t = this.huntTarget.group.position;
      const des = Math.atan2(t.x - g.position.x, t.z - g.position.z);
      this.turnToward(des, dt, 0.25);
      speed = this.spec.surfSpeed / KT;
      const d = g.position.distanceTo(t);
      this.dcTimer -= dt; this.gunTimer = (this.gunTimer || 0) - dt;
      const tgt = this.huntTarget;
      const canShoot = tgt.alive && d < 4500 && d > 250 && (tgt.kind !== 'submarine' || tgt.depth < 3);
      if (canShoot && this.gunTimer <= 0) { this.gunTimer = this.interceptOnly ? 9 : 7; ctx.navalGunfire(this, tgt, !!this.interceptOnly); }
      if (d < 120 && this.dcTimer <= 0 && tgt.kind === 'submarine') { this.dcTimer = 14; ctx.destroyerAttack(this, this.huntTarget); }
      if (!this.huntTarget.alive) { this.hunting = false; this.huntTarget = null; }
    } else if (this.behaviour === 'escort' && this.escortOf && this.escortOf.alive) {
      const t = this.escortOf.group.position;
      // station on the escorted ship's quarter; side and distance can be set per ship (shadowing)
      const sa = this.escortOf.heading + 1.2 * (this.escortSide || 1), sd = this.escortDist || 250;
      const off = new THREE.Vector3(Math.sin(sa) * sd, 0, Math.cos(sa) * sd);
      const goal = t.clone().add(off);
      const des = Math.atan2(goal.x - g.position.x, goal.z - g.position.z);
      this.turnToward(des, dt, 0.3);
      speed = Math.min(this.spec.surfSpeed / KT, Math.max(4, g.position.distanceTo(goal) * 0.05));
    } else if (this.behaviour === 'circle') {
      // steering gone: round and round on the helm she was left with
      this.heading += (this.circleRate || 0.07) * dt;
    } else if (this.waypoints.length) {
      const wp = this.waypoints[this.wpIdx];
      const des = Math.atan2(wp.x - g.position.x, wp.z - g.position.z);
      this.turnToward(des, dt, 0.15);
      if (g.position.distanceTo(wp) < 150) {
        if (this.wpIdx < this.waypoints.length - 1) this.wpIdx++;
        else if (this.behaviour === 'loop') this.wpIdx = 0;
        else if (this.behaviour === 'stop') this.stopped = true;
        else { this.waypoints.reverse(); this.wpIdx = Math.min(1, this.waypoints.length - 1); }   // steam the route back
      }
    }
    // lookahead: turn away from shoal water and the shore
    {
      const look = 400 + speed * 40;
      const ax = g.position.x + Math.sin(this.heading) * look, az = g.position.z + Math.cos(this.heading) * look;
      if (terrainHeight(ax, az) > -9) {
        const lx = g.position.x + Math.sin(this.heading + 0.6) * look, lz = g.position.z + Math.cos(this.heading + 0.6) * look;
        const rx = g.position.x + Math.sin(this.heading - 0.6) * look, rz = g.position.z + Math.cos(this.heading - 0.6) * look;
        this.heading += (terrainHeight(lx, lz) < terrainHeight(rx, rz) ? 1 : -1) * 0.25 * dt;
      }
    }
    g.position.x += Math.sin(this.heading) * speed * dt;
    g.position.z += Math.cos(this.heading) * speed * dt;
    // never sit on the land: slide back to water
    if (terrainHeight(g.position.x, g.position.z) > -5) { const w = findWater(g.position.x, g.position.z, -8); g.position.x = w.x; g.position.z = w.z; }
    g.rotation.y = this.heading;
    // submarine depth logic
    if (this.kind === 'submarine') {
      this.diveCooldown -= dt;
      const p = ctx.player;
      const dist = p ? Math.hypot(p.obj.position.x - g.position.x, p.obj.position.z - g.position.z) : 1e9;
      // Lookouts: a low aircraft is spotted late, a high one early. Then a few seconds' reaction
      // before the klaxon, and a Type VIIC needed ~30 s to get under from the order to dive.
      const spotRange = (1100 + Math.min(2500, p ? p.obj.position.y * 5 : 0)) * this.lookout;
      const seen = p && !p.crashed && dist < spotRange && p.obj.position.y < 2500;
      const hunted = ctx.vessels.some((v) => v.hunting && v.huntTarget === this && v.group.position.distanceTo(g.position) < 2500);
      if (this.surfaced && (seen || hunted) && this.faction !== 'rn' && this.diveCooldown <= 0 && this.hp > 0.3 && this.behaviour !== 'stayUp' && this.behaviour !== 'circle') {
        if (this.alarm == null) { this.alarm = this.alarmRange[0] + Math.random() * (this.alarmRange[1] - this.alarmRange[0]); ctx.log(`${this.name}: lookouts have seen you.`); }
        this.alarm -= dt;
        if (this.alarm <= 0) { this.surfaced = false; this.targetDepth = 30; this.diveCooldown = 60; this.alarm = null; ctx.log(`${this.name}: crash-diving!`); ctx.audio && ctx.audio.say('voice_diving', 30); }
      } else if (this.surfaced) this.alarm = null;
      if (!this.surfaced) {
        this.depth = Math.min(this.targetDepth, this.depth + this.diveRate * dt);
        this.surfaceTimer -= dt;
        if (!seen && !hunted && this.surfaceTimer <= 0 && this.diveCooldown <= 0 && this.behaviour !== 'stayDown') { this.surfaced = true; this.targetDepth = 0; this.surfaceTimer = 90 + Math.random() * 90; }
      } else {
        this.depth = Math.max(0, this.depth - 0.6 * dt);
      }
      // flak: surfaced boats fire at the nearest close aircraft, yours or another
      if (this.surfaced && this.spec.flak && !this.abandoned) {
        let tgt = p && !p.crashed && dist < 1400 && p.obj.position.y < 900 ? p : null, td = tgt ? dist : 1400;
        for (const a of ctx.friendlies || []) {
          if (!a.alive || a.onWater) continue;
          const d = Math.hypot(a.group.position.x - g.position.x, a.group.position.z - g.position.z);
          if (d < td && a.group.position.y < 900) { td = d; tgt = a; }
        }
        if (tgt) { this.flakTimer -= dt; if (this.flakTimer <= 0) { this.flakTimer = 0.12 / (this.flakRate || 1); ctx.enemyFire(this, tgt); } }
      }
    } else if (this.spec.flak && ctx.player && !ctx.player.crashed && this.hit > 0) {
      const p = ctx.player, dist = p.obj.position.distanceTo(g.position);
      if (dist < 2500) { this.flakTimer -= dt; if (this.flakTimer <= 0) { this.flakTimer = 0.2; ctx.enemyFire(this, p); } }
    }
    if (this.wake) {
      const sp = speed;
      this.wake.visible = sp > 0.5 && (this.depth || 0) < 3;
      // a smoothed speed drives the length, so a ripple in speed does not make the wake breathe
      this._wsp = this._wsp == null ? sp : this._wsp + (sp - this._wsp) * 0.04;
      const wsp = this._wsp;
      this.wake.scale.z = 0.4 + Math.min(2.5, wsp / 6);
      this.wake.material.uniforms.uOpacity.value = 0.45 + Math.min(0.5, wsp / 12);
      this.wake.advance(ctx.time, 0.3 + wsp / 15);
      this.wake.position.y = this.waterline + (this.depth || 0) + 0.15;
      this.wake.position.z = -this.spec.length * 0.5 - this.spec.length * 0.9 * this.wake.scale.z;
    }
    // dived boat: a dark shadow under the surface (Mediterranean water is clear enough to show a
    // boat down to ~35 m), a periscope feather when moving shallow, and a bubble trail when hurt
    if (this.kind === 'submarine' && ctx.scene) {
      if (!this.shadow) {
        const shape = new THREE.Shape();
        const L = this.length * 0.5, B = this.spec.beam * 1.6;
        shape.moveTo(0, L); shape.bezierCurveTo(B, L * 0.55, B, -L * 0.55, 0, -L); shape.bezierCurveTo(-B, -L * 0.55, -B, L * 0.55, 0, L);
        const geo = new THREE.ShapeGeometry(shape, 12); geo.rotateX(-Math.PI / 2);
        this.shadow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x06121c, transparent: true, opacity: 0, depthWrite: false }));
        this.shadow.renderOrder = 1; ctx.scene.add(this.shadow);
      }
      const dep = this.depth || 0;
      const vis = this.alive && !this.surfaced ? THREE.MathUtils.clamp(1 - dep / 35, 0, 1) : 0;
      this.shadow.visible = vis > 0.02;
      this.shadow.material.opacity = 0.62 * vis;
      this.shadow.position.set(g.position.x, 0.28, g.position.z); this.shadow.rotation.y = this.heading;
      if (!this.surfaced && this.alive) {
        // periscope feather: a small white streak at periscope depth while under way
        if (dep > 5 && dep < 15 && speed > 0.8) { this.featherT -= dt; if (this.featherT <= 0) { this.featherT = 0.25; ctx.weapons.spray(new THREE.Vector3(g.position.x + Math.sin(this.heading) * 8, 0.3, g.position.z + Math.cos(this.heading) * 8), new THREE.Vector3(-Math.sin(this.heading) * 2, 0.5, -Math.cos(this.heading) * 2), 1.2 + Math.random(), 1.2); } }
        // bubble trail: a hurt boat vents air; an untouched one only now and then
        this.trailT -= dt;
        if (this.trailT <= 0) { this.trailT = this.hit > 0.2 ? 1.2 : 6 + Math.random() * 6; ctx.weapons.bubbles(new THREE.Vector3(g.position.x, 0, g.position.z), this.hit > 0.2 ? 1.2 : 0.7); }
      }
    }
    // a leaking submarine gives herself away: bubbles every second or so and a fresh patch of oil
    if (this.leaking && this.kind === 'submarine' && !this.surfaced) {
      this.bubbleT -= dt; this.oilT -= dt;
      if (this.bubbleT <= 0) { this.bubbleT = 0.8 + Math.random() * 0.8; ctx.weapons.bubbles(new THREE.Vector3(g.position.x, 0, g.position.z), 1.2); }
      if (this.oilT <= 0) { this.oilT = 25; ctx.weapons.oilSlick(new THREE.Vector3(g.position.x, 0, g.position.z), 14 + Math.random() * 8); }
    }
    // burning: a badly hit vessel streams smoke and fire from the bridge
    if (this.hit > 0.35 * this.spec.hp) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 0.25;
        const bp = new THREE.Vector3(); (findNamed(g, 'bridge') || g).getWorldPosition(bp);
        ctx.weapons.smoke(bp, 5 + 3 * Math.random(), 6, 0x2a2a2a);
        if (Math.random() < 0.5) ctx.weapons.fire(bp);
      }
    }
    // draft: keel at y=0 in the model, so sink by the waterline, plus depth if submerged
    // ride the swell: small craft follow it fully, big hulls damp it
    const damp = Math.min(1, 40 / this.spec.length);
    const bob = seaHeight(g.position.x, g.position.z) * damp * (this.depth > 2 ? 0 : 1);
    g.position.y = -this.waterline - (this.depth || 0) + bob;
    const ahead = seaHeight(g.position.x + Math.sin(this.heading) * this.spec.length * 0.4, g.position.z + Math.cos(this.heading) * this.spec.length * 0.4);
    const astern = seaHeight(g.position.x - Math.sin(this.heading) * this.spec.length * 0.4, g.position.z - Math.cos(this.heading) * this.spec.length * 0.4);
    g.rotation.x = (this.depth > 2 ? 0 : 1) * damp * Math.atan2(ahead - astern, this.spec.length * 0.8) * 0.8;
  }

  turnToward(des, dt, rate) {
    let d = des - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
  }

  damage(amount, ctx, pos) {
    if (!this.alive) return;
    // a boat the record says survived this action (or that the script sinks another way) holds here
    if (this.hpFloor != null) amount = Math.max(0, Math.min(amount, this.hp - this.hpFloor));
    this.hp -= amount; this.hit += amount;
    // visible damage: sparks at the point of impact and a scorch mark that stays on the hull
    if (pos) {
      ctx.weapons.spark(pos, amount > 0.2 ? 3 : 1);
      if (this.scorches < 60 && (amount > 0.2 || Math.random() < 0.35)) {
        this.scorches++;
        const local = this.group.worldToLocal(pos.clone());
        const r = amount > 0.2 ? 3 + Math.random() * 3 : 0.5 + Math.random() * 0.6;
        const mark = new THREE.Mesh(new THREE.CircleGeometry(r, 12), new THREE.MeshBasicMaterial({ color: 0x141517, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        mark.position.copy(local);
        // stick to the nearest hull surface: top deck if the hit came from above, else the side
        const above = local.y > (this.group.userData.waterline || 3) + 0.5 && Math.abs(local.x) < this.spec.beam * 0.5;
        if (above) { mark.rotation.x = -Math.PI / 2; mark.position.y += 0.05; }
        else { mark.rotation.y = local.x >= 0 ? Math.PI / 2 : -Math.PI / 2; mark.position.x = Math.sign(local.x || 1) * (this.spec.beam * 0.5 + 0.05); }
        this.group.add(mark);
      }
    }
    if (this.kind === 'submarine' && amount > 0.2) {
      // a shaken boat surfaces (or cannot dive)
      this.surfaced = true; this.targetDepth = 0; this.diveCooldown = 45; if (this.behaviour === 'stayDown') this.behaviour = 'patrol';
      ctx.weapons.oilSlick(this.group.position, 30);
    }
    if (this.hp <= 0) {
      this.alive = false;
      ctx.log(`${this.name} destroyed.`);
      ctx.weapons.explosion(this.group.position.clone().setY(1), 2, false);
      ctx.weapons.oilSlick(this.group.position, 60);
      for (let i = 0; i < 12; i++) ctx.weapons.smoke(this.group.position, 12, 12 + Math.random() * 10, 0x222222);
    }
  }
}

// Nearest open water (below -6 m) to a point, searched in widening rings. Keeps ships off beaches.
// Ships keep to water deeper than 20 m on the game's shelving seabed, which puts them a couple
// of miles off the beaches rather than hugging the shore.
export function findWater(x, z, minDepth = -12) {
  if (terrainHeight(x, z) < minDepth) return { x, z };
  for (let r = 150; r < 8000; r += 150) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (terrainHeight(px, pz) < minDepth) return { x: px, z: pz };
    }
  }
  return { x, z };
}

export async function spawnVessel(type, opts = {}) {
  const spec = VESSEL_TYPES[type];
  const g = await loadOrPlaceholder(spec.asset, spec.length, spec.beam, spec.kind);
  if (spec.recolour) {
    g.traverse((n) => { if (n.isMesh && n.material && n.material.color && n.material.color.getHex() === 0x1e2023) { n.material = n.material.clone(); n.material.color.setHex(spec.recolour); } });
  }
  const p = findWater(...Object.values(toWorld(opts.lat, opts.lon)));
  g.position.set(p.x, 0, p.z);
  const v = new Vessel(type, spec, g, opts);
  g.rotation.y = v.heading;
  g.userData.vessel = v;
  if (spec.ensign) addEnsign(g);
  return v;
}

// A White Ensign on a short staff at the back of the bridge, so a British boat reads as one.
function addEnsign(g) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 48;
  const x = c.getContext('2d');
  x.fillStyle = '#f2f0ea'; x.fillRect(0, 0, 96, 48);
  x.fillStyle = '#c8102e'; x.fillRect(0, 21, 96, 6); x.fillRect(45, 0, 6, 48);
  x.fillStyle = '#1b2a5c'; x.fillRect(0, 0, 44, 20);
  x.strokeStyle = '#f2f0ea'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(44, 20); x.moveTo(44, 0); x.lineTo(0, 20); x.stroke();
  x.strokeStyle = '#c8102e'; x.lineWidth = 2; x.stroke();
  x.fillStyle = '#f2f0ea'; x.fillRect(18, 0, 8, 20); x.fillRect(0, 7, 44, 6);
  x.fillStyle = '#c8102e'; x.fillRect(20, 0, 4, 20); x.fillRect(0, 8.5, 44, 3);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const bridge = findNamed(g, 'bridge');
  const box = new THREE.Box3().setFromObject(bridge || g);
  const top = g.worldToLocal(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, box.min.z + (box.max.z - box.min.z) * 0.15));
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x3a3a3a }));
  staff.position.copy(top).add(new THREE.Vector3(0, 1.2, 0));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
  flag.position.copy(top).add(new THREE.Vector3(0, 1.95, -0.95)); flag.rotation.y = Math.PI / 2;
  g.add(staff, flag);
}
