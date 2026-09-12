import * as THREE from 'three';
import { COAST, PEAKS, pointInPoly, distToPoly } from '../data/geo.js';
import { toWorld, H_SCALE, V_SCALE, WORLD_HALF } from '../config.js';
import { loadTex, terrainDetail } from './textures.js';

// Convert coast polygons to world space once.
const POLYS = {};
for (const k of Object.keys(COAST)) POLYS[k] = COAST[k].map(([la, lo]) => { const p = toWorld(la, lo); return [p.x, p.z]; });
const PEAKS_W = PEAKS.map(([la, lo, h, r, dir, asp]) => {
  const p = toWorld(la, lo);
  return { x: p.x, z: p.z, h: h * V_SCALE, r: r * H_SCALE, dir: dir * Math.PI / 180, asp };
});

// Rock of Gibraltar: a N–S ridge 1.2 km real (300 m world) with a sheer north face and east
// cliffs. Heights along the ridge from Rock Gun (north, 400 m) to O'Hara's Battery (426 m) then
// dropping over Windmill Hill to the Europa flats.
const ROCK = { n: toWorld(36.1625, -5.3435), s: toWorld(36.1230, -5.3440) };
function rockHeight(x, z) {
  // parametric position along the ridge
  const dx = ROCK.s.x - ROCK.n.x, dz = ROCK.s.z - ROCK.n.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const px = x - ROCK.n.x, pz = z - ROCK.n.z;
  const t = (px * ux + pz * uz) / L;            // 0 north, 1 south
  const s = (px * -uz + pz * ux);               // signed lateral distance (+ = west)
  if (t < -0.06 || t > 1.35) return 0;
  // crest profile (real metres)
  let crest;
  if (t < 0) crest = 400 * Math.max(0, 1 + t / 0.06) ** 2 * 0.6;   // sheer north face
  else if (t < 0.18) crest = 400 + 20 * Math.sin(t / 0.18 * Math.PI * 0.5);
  else if (t < 0.55) crest = 415 + 11 * Math.sin((t - 0.18) / 0.37 * Math.PI);
  else if (t < 0.72) crest = 426 - (t - 0.55) / 0.17 * 300;   // drop to Windmill Hill
  else if (t < 0.95) crest = 126 - (t - 0.72) / 0.23 * 90;    // Windmill Hill flats
  else crest = 36 - (t - 0.95) / 0.4 * 36;                     // Europa flats to the point
  crest = Math.max(0, crest);
  // lateral profile: east side cliff (steep), west side slope to the town
  const halfW = (t < 0.72 ? 240 : 300) * H_SCALE * (t < 0 ? 0.6 : 1);   // world metres
  let f;
  if (s >= 0) f = Math.max(0, 1 - (s / (halfW * 1.9)) ** 1.6);            // west: gentle
  else f = Math.max(0, 1 - (-s / (halfW * 0.8)) ** 2.5);                  // east: sheer
  return crest * V_SCALE * f;
}

function landDistance(x, z) {
  // positive inland distance (world metres), negative offshore
  let inside = false, d = Infinity;
  for (const k of Object.keys(POLYS)) {
    const poly = POLYS[k];
    const dd = distToPoly(x, z, poly);
    if (dd < d) d = dd;
    if (pointInPoly(x, z, poly)) inside = true;
  }
  return inside ? d : -d;
}

export function terrainHeight(x, z) {
  const d = landDistance(x, z);
  const rock = rockHeight(x, z);
  if (d <= 0) return rock > 0 ? rock : -8 - Math.min(80, -d * 0.02);  // sea floor falls away
  const coastRise = Math.min(1, d / (2500 * H_SCALE)) ** 0.9 * 60 * V_SCALE;
  let h = coastRise;
  for (const p of PEAKS_W) {
    const dx = x - p.x, dz = z - p.z;
    const c = Math.cos(p.dir), s = Math.sin(p.dir);
    const u = (dx * c + dz * s) / (p.r * p.asp), v = (-dx * s + dz * c) / p.r;
    const q = u * u + v * v;
    h += p.h * Math.exp(-q * 1.6);
  }
  // keep coast low so beaches exist
  h *= Math.min(1, d / (600 * H_SCALE)) ** 0.7;
  return Math.max(h, rock);
}

const LIMESTONE = new THREE.Color(0xb9b09a), LIMESTONE_DK = new THREE.Color(0x8f877a), SCRUB = new THREE.Color(0x5f7040), SCRUB_DRY = new THREE.Color(0x8a8a58);
function shade(h, slope, x = 0, z = 0) {
  // world y in metres; slope = 1 - normal.y (0 flat, 0.5 ≈ 60°). Steep ground is bare limestone,
  // gentle ground is scrub, the highest ground is grey rock; a little noise breaks up the flats.
  const c = new THREE.Color();
  const n = 0.5 + 0.5 * Math.sin(x * 0.013 + z * 0.021) * Math.sin(x * 0.007 - z * 0.011);
  if (h < 1.5) return c.set(0xd8c9a0);                                      // sand
  if (h < 12) c.copy(SCRUB_DRY).lerp(SCRUB, Math.min(1, h / 12) * 0.8 + n * 0.2);
  else c.copy(SCRUB).lerp(SCRUB_DRY, n * 0.35);
  const rockByHeight = THREE.MathUtils.clamp((h - 90) / 120, 0, 1);
  const rockBySlope = THREE.MathUtils.clamp((slope - 0.18) / 0.22, 0, 1);
  const rock = Math.max(rockByHeight, rockBySlope);
  c.lerp(slope > 0.35 ? LIMESTONE_DK : LIMESTONE, rock * (0.75 + 0.25 * n));
  c.userData = rock;
  return c;
}

function buildGrid(x0, z0, size, n, heightFn, opts = {}) {
  const geo = new THREE.PlaneGeometry(size, size, n, n);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const rockA = new Float32Array(pos.count);
  const hs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + x0, z = pos.getZ(i) + z0;
    let h = heightFn(x, z);
    if (opts.mask && !opts.mask(x, z)) h = Math.min(h, -2);
    hs[i] = h;
    pos.setY(i, h);
    pos.setX(i, x); pos.setZ(i, z);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const slope = 1 - nrm.getY(i);
    const c = shade(hs[i], slope, pos.getX(i), pos.getZ(i));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    rockA[i] = hs[i] < 1.5 ? 0 : (c.userData || 0);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('rock', new THREE.BufferAttribute(rockA, 1));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  // photographic detail: scrub and limestone maps blended by the rock attribute
  Promise.all([loadTex('scrub_ground'), loadTex('limestone_rock')]).then(([s, r]) => { if (s && r) terrainDetail(mat, s, r, opts.tile || 90); });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

const GIB_CENTRE = toWorld(36.140, -5.350);
const GIB_HALF = 900;   // world metres — covers the peninsula and the runway

export function buildTerrain() {
  const g = new THREE.Group();
  // coarse terrain everywhere except the Gibraltar square
  const coarse = buildGrid(0, 0, WORLD_HALF * 2, 320, terrainHeight, {
    mask: (x, z) => !(Math.abs(x - GIB_CENTRE.x) < GIB_HALF - 60 && Math.abs(z - GIB_CENTRE.z) < GIB_HALF - 60),
  });
  g.add(coarse);
  const fine = buildGrid(GIB_CENTRE.x, GIB_CENTRE.z, GIB_HALF * 2, 180, terrainHeight, { tile: 45 });
  fine.castShadow = true;
  g.add(fine);
  return g;
}

export const GIB = { centre: GIB_CENTRE, half: GIB_HALF };
