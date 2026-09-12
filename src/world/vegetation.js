import * as THREE from 'three';
import { terrainHeight, MED, GIB } from './terrain.js';
import { PLACES } from '../data/geo.js';
import { toWorld } from '../config.js';

// Vegetation of the Strait, 1940: stone and Aleppo pines on the middle slopes, cork oaks and
// olives on the lower ground, lentisk and cistus scrub everywhere the goats left it, cypresses
// by the towns and a few palms on the waterfronts. Five instanced meshes, tens of thousands of
// instances, placed by height and slope so cliffs and beaches stay bare.

let seed = 4242;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function slopeAt(x, z) {
  const e = 12;
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z), dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

const towns = PLACES.map((p) => toWorld(p.lat, p.lon));
function nearTown(x, z) { let best = 1e9; for (const t of towns) best = Math.min(best, Math.hypot(t.x - x, t.z - z)); return best; }

// geometry builders: front +Z irrelevant, base at y = 0, unit height ~1 so instances scale it
function pineGeo() {
  const trunk = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6).translate(0, 0.25, 0);
  const canopy = new THREE.SphereGeometry(0.42, 6, 4).scale(1, 0.62, 1).translate(0, 0.72, 0);   // stone pine umbrella
  return { trunk, canopy };
}
function oakGeo() {
  const trunk = new THREE.CylinderGeometry(0.06, 0.1, 0.3, 6).translate(0, 0.15, 0);
  const canopy = new THREE.SphereGeometry(0.4, 6, 4).scale(1.1, 0.8, 1).translate(0, 0.52, 0);
  return { trunk, canopy };
}
function bushGeo() { return { canopy: new THREE.SphereGeometry(0.5, 5, 3).scale(1.2, 0.6, 1).translate(0, 0.3, 0) }; }
function cypressGeo() {
  const trunk = new THREE.CylinderGeometry(0.03, 0.05, 0.15, 5).translate(0, 0.07, 0);
  const canopy = new THREE.ConeGeometry(0.16, 1.0, 7).translate(0, 0.62, 0);
  return { trunk, canopy };
}
function palmGeo() {
  const trunk = new THREE.CylinderGeometry(0.05, 0.08, 0.85, 6).translate(0, 0.42, 0);
  const fronds = [];
  for (let i = 0; i < 7; i++) { const f = new THREE.BoxGeometry(0.08, 0.02, 0.6).translate(0, 0.86, 0.28); f.rotateX(-0.5); f.rotateY(i * Math.PI * 2 / 7); fronds.push(f); }
  const canopy = mergeSimple(fronds);
  return { trunk, canopy };
}
function mergeSimple(geos) {
  // small hand merge (non-indexed) to avoid importing utils here
  const parts = geos.map((g) => g.toNonIndexed());
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

const KINDS = {
  pine: { geo: pineGeo, trunk: 0x5a4632, canopy: [0x2f4a2a, 0x3d5a30, 0x365234], h: [9, 16], count: 7000, rule: (h, s, tn) => h > 25 && h < 330 && s < 0.5 && tn > 250 ? 0.9 : 0 },
  oak: { geo: oakGeo, trunk: 0x5e4a36, canopy: [0x56673a, 0x66744a, 0x4c5f3a], h: [6, 10], count: 5000, rule: (h, s, tn) => h > 4 && h < 140 && s < 0.35 && tn > 300 ? 0.8 : 0 },
  bush: { geo: bushGeo, trunk: null, canopy: [0x6b7a44, 0x7a8452, 0x5c6b3d, 0x8a8a58], h: [1.5, 3.2], count: 18000, rule: (h, s, tn) => h > 2.5 && h < 380 && s < 0.6 && tn > 150 ? 1 : 0 },
  cypress: { geo: cypressGeo, trunk: 0x4a3a2a, canopy: [0x223522, 0x2a3f28], h: [8, 14], count: 500, rule: (h, s, tn) => h > 2 && h < 120 && s < 0.3 && tn < 900 && tn > 120 ? 0.9 : 0 },
  palm: { geo: palmGeo, trunk: 0x7a6248, canopy: [0x4f7a3a, 0x5c8a42], h: [8, 13], count: 300, rule: (h, s, tn) => h > 1.5 && h < 25 && s < 0.2 && tn < 700 && tn > 80 ? 0.9 : 0 },
};

export function buildVegetation() {
  const g = new THREE.Group();
  const regions = [{ x: MED.x, z: MED.z, half: MED.half }, { x: GIB.centre.x, z: GIB.centre.z, half: GIB.half }];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  for (const [name, K] of Object.entries(KINDS)) {
    const parts = K.geo();
    const placements = [];
    let tries = 0;
    while (placements.length < K.count && tries < K.count * 6) {
      tries++;
      const R = name === 'palm' || name === 'cypress' ? regions[0] : regions[Math.floor(rnd() * regions.length)];
      const x = R.x + (rnd() * 2 - 1) * R.half, z = R.z + (rnd() * 2 - 1) * R.half;
      const h = terrainHeight(x, z);
      if (h < 1.5) continue;
      const s = slopeAt(x, z), tn = nearTown(x, z);
      const p = K.rule(h, s, tn);
      if (p <= 0 || rnd() > p) continue;
      // clumping: pines and oaks like company
      if ((name === 'pine' || name === 'oak') && rnd() < 0.5 && placements.length) {
        const nb = placements[Math.floor(rnd() * placements.length)];
        const cx = nb.x + (rnd() - 0.5) * 40, cz = nb.z + (rnd() - 0.5) * 40;
        const ch = terrainHeight(cx, cz);
        if (ch > 1.5 && K.rule(ch, slopeAt(cx, cz), nearTown(cx, cz)) > 0) { placements.push({ x: cx, z: cz, h: ch }); continue; }
      }
      placements.push({ x, z, h });
    }
    for (const [partName, geo] of Object.entries(parts)) {
      const isTrunk = partName === 'trunk';
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: !isTrunk });
      const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
      mesh.castShadow = !isTrunk; mesh.receiveShadow = true;
      placements.forEach((pl, i) => {
        const hgt = K.h[0] + rnd() * (K.h[1] - K.h[0]);
        const w = hgt * (0.8 + rnd() * 0.4);
        sc.set(w, hgt, w);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
        pv.set(pl.x, pl.h - 0.2, pl.z);
        m4.compose(pv, q, sc); mesh.setMatrixAt(i, m4);
        if (isTrunk) col.setHex(K.trunk); else col.setHex(K.canopy[Math.floor(rnd() * K.canopy.length)]).offsetHSL((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.08);
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      g.add(mesh);
    }
  }
  return g;
}
