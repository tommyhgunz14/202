import * as THREE from 'three';
import { terrainHeight, MED, GIB, rockWestFace, rockFrame, onEuropaFlats } from './terrain.js';
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
const rockWest = rockWestFace;
function nearTown(x, z) { let best = 1e9; for (const t of towns) best = Math.min(best, Math.hypot(t.x - x, t.z - z)); return best; }

// geometry builders: front +Z irrelevant, base at y = 0, unit height ~1 so instances scale it
function pineGeo() {
  const trunk = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6).translate(0, 0.25, 0);
  const canopy = new THREE.SphereGeometry(0.5, 7, 5).scale(1, 0.6, 1).translate(0, 0.72, 0);   // stone pine umbrella
  return { trunk, canopy };
}
function oakGeo() {
  const trunk = new THREE.CylinderGeometry(0.06, 0.1, 0.3, 6).translate(0, 0.15, 0);
  const canopy = new THREE.SphereGeometry(0.46, 7, 5).scale(1.15, 0.8, 1).translate(0, 0.52, 0);
  return { trunk, canopy };
}
function oliveGeo() {
  const trunk = new THREE.CylinderGeometry(0.09, 0.14, 0.28, 6).translate(0, 0.14, 0);
  const canopy = new THREE.SphereGeometry(0.52, 7, 5).scale(1.25, 0.62, 1.15).translate(0, 0.46, 0);
  return { trunk, canopy };
}
function citrusGeo() {
  const trunk = new THREE.CylinderGeometry(0.05, 0.07, 0.26, 5).translate(0, 0.13, 0);
  const canopy = new THREE.SphereGeometry(0.38, 7, 6).translate(0, 0.62, 0);
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
  pine: { geo: pineGeo, trunk: 0x5a4632, canopy: [0x44633a, 0x4f7042, 0x5a7a4a], h: [9, 16], count: 7000, grove: [60, 220], rule: (h, s, tn, x, z) => !onEuropaFlats(x, z) && h > 25 && h < 330 && s < 0.5 && tn > 250 ? 0.9 : 0 },
  olive: { geo: oliveGeo, trunk: 0x6b5c4a, canopy: [0x8d9479, 0x9aa086, 0x7e876c, 0xa6a992], h: [4.5, 7], count: 7000, grove: [90, 320], rule: (h, s, tn, x, z) => !onEuropaFlats(x, z) && h > 3 && h < 160 && s < 0.4 && tn > 200 ? 0.9 : 0 },
  citrus: { geo: citrusGeo, trunk: 0x5a4a38, canopy: [0x2f4a22, 0x37552a, 0x2a4420], h: [3.2, 4.4], count: 4200, orchard: true, rule: (h, s, tn, x, z) => !onEuropaFlats(x, z) && h > 3 && h < 60 && s < 0.12 && tn < 1800 && tn > 150 ? 1 : 0 },
  bush: { geo: bushGeo, trunk: null, canopy: [0x9a9464, 0xa89e72, 0x8a8558, 0xb3a87c], h: [1.5, 3.2], count: 18000, grove: [40, 160], rule: (h, s, tn, x, z) => h > 2.5 && h < 380 && s < 0.6 && tn > 150 && (!onEuropaFlats(x, z) || (h > 95 && s < 0.25)) ? 1 : 0 },
  cypress: { geo: cypressGeo, trunk: 0x4a3a2a, canopy: [0x2e4a2e, 0x3a5a36], h: [8, 14], count: 500, rule: (h, s, tn, x, z) => !onEuropaFlats(x, z) && h > 2 && h < 120 && s < 0.3 && tn < 900 && tn > 120 ? 0.9 : 0 },
  rockScrub: { geo: bushGeo, trunk: null, canopy: [0x56603e, 0x5f6846, 0x6a7050, 0x5b6446], h: [2, 4.5], count: 10000, region: 'gib', grove: [30, 110], rule: (h, s, tn, x, z) => rockWest(x, z) && h > 14 && h < 405 && s < 3.0 ? 1 : 0 },
  rockPine: { geo: pineGeo, trunk: 0x5a4632, canopy: [0x3f5c36, 0x4a6a3e, 0x557846], h: [7, 12], count: 1000, region: 'gib', grove: [40, 140], rule: (h, s, tn, x, z) => rockWest(x, z) && rockFrame(x, z).t < 1.0 && h > 18 && h < 390 && s < 2.4 ? 0.9 : 0 },
  palm: { geo: palmGeo, trunk: 0x7a6248, canopy: [0x5f8a45, 0x6c9a4e], h: [8, 13], count: 300, rule: (h, s, tn, x, z) => !onEuropaFlats(x, z) && h > 1.5 && h < 25 && s < 0.2 && tn < 700 && tn > 80 ? 0.9 : 0 },
};

export function buildVegetation() {
  const g = new THREE.Group();
  const regions = [{ x: MED.x, z: MED.z, half: MED.half }, { x: GIB.centre.x, z: GIB.centre.z, half: GIB.half }];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  for (const [name, K] of Object.entries(KINDS)) {
    const parts = K.geo();
    const placements = [];
    // grove centres: the woods and scrub of the Campo grow in patches, not as an even sprinkle
    const groves = [];
    if (K.grove) {
      let gt = 0;
      while (groves.length < K.count / 25 && gt < K.count) {
        gt++;
        const R = K.region === 'gib' ? regions[1] : regions[Math.floor(rnd() * regions.length)];
        const x = R.x + (rnd() * 2 - 1) * R.half, z = R.z + (rnd() * 2 - 1) * R.half;
        const h = terrainHeight(x, z);
        if (h > 1.5 && K.rule(h, slopeAt(x, z), nearTown(x, z), x, z) > 0) groves.push({ x, z, r: K.grove[0] + rnd() * (K.grove[1] - K.grove[0]) });
      }
    }
    // orchard blocks: flat irrigated ground near the towns, each a rectangle of rows at its
    // own angle, so the citrus reads as planted rather than scattered
    const orchards = [];
    if (K.orchard) {
      let ot = 0;
      while (orchards.length < 26 && ot < 4000) {
        ot++;
        const R = regions[0];
        const x = R.x + (rnd() * 2 - 1) * R.half, z = R.z + (rnd() * 2 - 1) * R.half;
        const h = terrainHeight(x, z);
        if (h > 3 && h < 60 && slopeAt(x, z) < 0.09 && nearTown(x, z) < 1800) {
          orchards.push({ x, z, a: rnd() * Math.PI, rows: 8 + Math.floor(rnd() * 10), cols: 8 + Math.floor(rnd() * 10) });
        }
      }
    }
    let tries = 0;
    while (placements.length < K.count && tries < K.count * 8) {
      tries++;
      let x, z;
      if (K.orchard && orchards.length) {
        // a regular grid of rows and trees inside the block, turned to the block's own angle
        const o = orchards[Math.floor(rnd() * orchards.length)];
        const u = (Math.floor(rnd() * o.rows) - o.rows / 2) * 7.5;
        const v = (Math.floor(rnd() * o.cols) - o.cols / 2) * 6.0;
        x = o.x + u * Math.cos(o.a) - v * Math.sin(o.a) + (rnd() - 0.5) * 0.7;
        z = o.z + u * Math.sin(o.a) + v * Math.cos(o.a) + (rnd() - 0.5) * 0.7;
      } else if (groves.length && rnd() < 0.8) {
        const gv = groves[Math.floor(rnd() * groves.length)];
        const a = rnd() * Math.PI * 2, r = gv.r * Math.sqrt(rnd());
        x = gv.x + Math.cos(a) * r; z = gv.z + Math.sin(a) * r;
      } else {
        const R = K.region === 'gib' ? regions[1] : name === 'palm' || name === 'cypress' ? regions[0] : regions[Math.floor(rnd() * regions.length)];
        x = R.x + (rnd() * 2 - 1) * R.half; z = R.z + (rnd() * 2 - 1) * R.half;
      }
      const h = terrainHeight(x, z);
      if (h < 1.5) continue;
      const s = slopeAt(x, z), tn = nearTown(x, z);
      const p = K.rule(h, s, tn, x, z);
      if (p <= 0 || rnd() > p) continue;
      // clumping: pines and oaks like company
      if ((name === 'pine' || name === 'oak') && rnd() < 0.5 && placements.length) {
        const nb = placements[Math.floor(rnd() * placements.length)];
        const cx = nb.x + (rnd() - 0.5) * 40, cz = nb.z + (rnd() - 0.5) * 40;
        const ch = terrainHeight(cx, cz);
        if (ch > 1.5 && K.rule(ch, slopeAt(cx, cz), nearTown(cx, cz), cx, cz) > 0) { placements.push({ x: cx, z: cz, h: ch }); continue; }
      }
      placements.push({ x, z, h });
    }
    for (const [partName, geo] of Object.entries(parts)) {
      const isTrunk = partName === 'trunk';
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: !isTrunk, emissive: isTrunk ? 0x000000 : 0x1c2412 });
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
