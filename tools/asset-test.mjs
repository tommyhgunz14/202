// npm test: the checks that would otherwise first fail in front of the jam gate or a judge.
//   1. every asset module in assets/ imports, default-exports a function of THREE, and builds a
//      Group with visible meshes and finite geometry (a broken loft shows up here, not as a grey box)
//   2. every aircraft has the named mounts the game looks for: each gun position in
//      src/data/aircraft.js, and at least one propeller
//   3. every asset path named in src/vessels.js and src/data/aircraft.js exists
//   4. the light build has its half of every file the full build has: colour textures, skies,
//      sound effects and music
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import * as THREE from '../vendor/three.module.js?v=202609171608';
import { AIRCRAFT } from '../src/data/aircraft.js?v=202609171608';
import { CLIPS, MUSIC } from '../src/samples.js?v=202609171608';

// a few assets paint small canvas textures; outside a browser give them a canvas that draws nothing
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
  ctx.createLinearGradient = ctx.createRadialGradient = () => ({ addColorStop: noop });
  ctx.getImageData = (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) };
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const failures = [];
const fail = (msg) => failures.push(msg);
const exists = (p) => fs.existsSync(path.join(ROOT, p));

// 1. every asset module builds
const modules = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.js'));
const built = {};
for (const file of modules) {
  const rel = `assets/${file}`;
  try {
    const mod = await import(pathToFileURL(path.join(ROOT, rel)).href);
    if (typeof mod.default !== 'function') { fail(`${rel}: no default export function`); continue; }
    const g = mod.default(THREE);
    if (!g || !g.isObject3D) { fail(`${rel}: did not return an Object3D`); continue; }
    let meshes = 0, bad = 0;
    g.traverse((n) => {
      if (!n.isMesh) return;
      meshes++;
      const pos = n.geometry.attributes.position;
      if (!pos || pos.count === 0) { bad++; return; }
      for (let i = 0; i < pos.array.length; i++) if (!Number.isFinite(pos.array[i])) { bad++; break; }
    });
    if (!meshes) fail(`${rel}: builds no meshes`);
    if (bad) fail(`${rel}: ${bad} mesh(es) with empty or non-finite positions`);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
    if (![size.x, size.y, size.z].every((v) => Number.isFinite(v) && v > 0)) fail(`${rel}: bounding box is not finite`);
    built[rel] = g;
  } catch (e) {
    fail(`${rel}: throws on import or build: ${e.message}`);
  }
}

// 2. aircraft mounts
for (const [id, spec] of Object.entries(AIRCRAFT)) {
  const g = built[spec.asset];
  if (!g) { fail(`aircraft ${id}: asset ${spec.asset} did not build`); continue; }
  const names = new Set(); g.traverse((n) => n.name && names.add(n.name));
  for (const gun of spec.guns || []) if (!names.has(gun.node)) fail(`aircraft ${id}: no node "${gun.node}" for ${gun.name}`);
  if (!names.has('prop')) fail(`aircraft ${id}: no "prop" node`);
}

// 3. asset paths named in the game data
const named = new Set();
for (const src of ['src/vessels.js', 'src/data/aircraft.js', 'src/main.js', 'src/friendlies.js', 'src/bandits.js']) {
  if (!exists(src)) continue;
  for (const m of fs.readFileSync(path.join(ROOT, src), 'utf8').matchAll(/['"`](assets\/[a-z0-9_]+\.js)['"`]/g)) named.add(m[1]);
}
for (const p of named) if (!exists(p)) fail(`${p} is named in the game but does not exist`);

// 4. the light build's files
for (const f of fs.readdirSync(path.join(ROOT, 'assets/tex')).filter((f) => f.endsWith('.jpg') && !/_(normal|rough)\.jpg$/.test(f))) {
  if (!exists(`assets/tex/lite/${f}`)) fail(`assets/tex/lite/${f} missing (light build texture)`);
}
for (const f of fs.readdirSync(path.join(ROOT, 'assets/sky')).filter((f) => f.endsWith('.jpg'))) {
  if (!exists(`assets/sky/lite/${f}`)) fail(`assets/sky/lite/${f} missing (light build sky)`);
}
for (const n of [...CLIPS, ...MUSIC]) {
  if (!exists(`assets/sfx/${n}.mp3`)) fail(`assets/sfx/${n}.mp3 missing (listed in src/samples.js)`);
  if (!exists(`assets/sfx/lite/${n}.mp3`)) fail(`assets/sfx/lite/${n}.mp3 missing (light build sound)`);
}

console.log(`${modules.length} asset modules, ${Object.keys(AIRCRAFT).length} aircraft, ${named.size} named asset paths, ${CLIPS.length + MUSIC.length} sounds checked`);
if (failures.length) { for (const f of failures) console.log('FAIL ' + f); process.exit(1); }
console.log('all asset checks pass');
