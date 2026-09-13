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
// where a point sits relative to the ridge: t 0 north .. 1 south, s + = west (world metres)
export function rockFrame(x, z) {
  const dx = ROCK.s.x - ROCK.n.x, dz = ROCK.s.z - ROCK.n.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const px = x - ROCK.n.x, pz = z - ROCK.n.z;
  return { t: (px * ux + pz * uz) / L, s: px * -uz + pz * ux };
}
export function rockWestFace(x, z) { const { t, s } = rockFrame(x, z); return t > -0.01 && t < 0.78 && s > -6 && s < 140; }
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
  else f = Math.max(0, 1 - (-s / (halfW * 1.35)) ** 1.9);                 // east: sheer, but a cliff not a wall
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
  // seabed: shelves gently from the beach (about 1 in 70) and then falls away offshore
  if (d <= 0) { const off = -d; return rock > 0 ? rock : -0.4 - off * 0.014 - Math.min(90, (off / 1500) * (off / 1500) * 25); }
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

const LIMESTONE = new THREE.Color(0xb9b09a), LIMESTONE_DK = new THREE.Color(0x8f877a), SCRUB = new THREE.Color(0x6e7248), SCRUB_DRY = new THREE.Color(0xa2946a);
const SAND = new THREE.Color(0xe6d5a6), SAND_WET = new THREE.Color(0xbfa884), SHORE_ROCK = new THREE.Color(0x6a635a), MEADOW = new THREE.Color(0x8c8a5a);
const FIELDS = [new THREE.Color(0xc9b478), new THREE.Color(0x9c8f66), new THREE.Color(0x8e9377), new THREE.Color(0xa87f54), new THREE.Color(0xbcaf7e), new THREE.Color(0x6f7a4c), new THREE.Color(0xb08a5e)];
const fhash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
// which field a point lies in: cells of ~150 m on a grid turned 31 degrees, jittered by a hash
function fieldAt(x, z) {
  const c = 0.857, s = 0.515;
  const u = (x * c - z * s) / 150, v = (x * s + z * c) / 210;
  const i = Math.floor(u), j = Math.floor(v);
  const id = fhash(i, j);
  const eu = Math.min(u - i, i + 1 - u), ev = Math.min(v - j, j + 1 - v);
  const edge = Math.min(1, Math.min(eu, ev) * 12);   // hedge / wall line between fields
  return { col: FIELDS[Math.floor(id * FIELDS.length) % FIELDS.length], edge, id };
}
function shade(h, slope, x = 0, z = 0) {
  // world y in metres; slope = 1 - normal.y (0 flat, 0.5 ≈ 60°). Beaches where the land runs
  // gently into the sea, dark rock where it drops steeply, scrub and dry grass on the slopes,
  // greener meadow on the low flats, bare limestone on the steep and the high ground.
  const c = new THREE.Color();
  const n = 0.5 + 0.5 * Math.sin(x * 0.013 + z * 0.021) * Math.sin(x * 0.007 - z * 0.011);
  c.userData = 0; c.sand = 0;
  if (h < 3.5) {
    if (slope > 0.22) return c.copy(SHORE_ROCK).lerp(LIMESTONE_DK, n * 0.5);          // rocky shore
    c.copy(h < 0.7 ? SAND_WET : SAND).lerp(SAND, Math.min(1, h / 3.5)); c.sand = 1 - Math.min(1, Math.max(0, (h - 2.2) / 1.3) * (slope > 0.12 ? 2 : 1));
    if (h > 2.2) c.lerp(MEADOW, (h - 2.2) / 1.3 * 0.5);
    return c;
  }
  if (h < 12) c.copy(slope < 0.08 ? MEADOW : SCRUB_DRY).lerp(SCRUB, Math.min(1, h / 12) * 0.8 + n * 0.2);
  else c.copy(SCRUB).lerp(SCRUB_DRY, n * 0.35);
  // farmed patchwork on the gentle low ground
  const flat = THREE.MathUtils.clamp(1 - slope / 0.13, 0, 1) * THREE.MathUtils.clamp((h - 3.5) / 5, 0, 1) * (1 - THREE.MathUtils.clamp((h - 90) / 60, 0, 1));
  if (flat > 0) { const f = fieldAt(x, z); c.lerp(f.col, flat * 0.8 * (0.6 + 0.4 * f.edge)); }
  const rockByHeight = THREE.MathUtils.clamp((h - 90) / 120, 0, 1);
  const rockBySlope = THREE.MathUtils.clamp((slope - 0.18) / 0.22, 0, 1);
  let rock = Math.max(rockByHeight, rockBySlope);
  if (rock > 0 && rockWestFace(x, z)) { rock *= 0.25 + 0.2 * n; c.copy(SCRUB).lerp(new THREE.Color(0x4d6238), 0.5 + 0.3 * n); }
  const face = LIMESTONE.clone().lerp(LIMESTONE_DK, THREE.MathUtils.clamp((slope - 0.22) / 0.3, 0, 1) * 0.45);
  c.lerp(face, Math.min(1, rock * (0.72 + 0.28 * n)));
  // at full rock the lerp saturates and the colour goes flat, so put the grain back by hand
  if (rock > 0.55) c.offsetHSL(0, 0, (n - 0.5) * 0.07 * (rock - 0.55) / 0.45);
  // bedding planes in the limestone
  if (rock > 0.3) c.lerp(LIMESTONE_DK, rock * 0.18 * (0.5 + 0.5 * Math.sin(h * 0.42 + n * 2.0)));
  c.userData = rock;
  return c;
}

function buildGrid(x0, z0, size, n, heightFn, opts = {}) {
  const geo = new THREE.PlaneGeometry(size, size, n, n);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const rockA = new Float32Array(pos.count);
  const sandA = new Float32Array(pos.count);
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
    sandA[i] = c.sand || 0;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('rock', new THREE.BufferAttribute(rockA, 1));
  geo.setAttribute('sand', new THREE.BufferAttribute(sandA, 1));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  // photographic detail: scrub and limestone maps blended by the rock attribute
  Promise.all([loadTex('scrub_ground'), loadTex('limestone_rock'), loadTex('sand_beach')]).then(([s, r, sd]) => { if (s && r) terrainDetail(mat, s, r, opts.tile || 90, sd); });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

const GIB_CENTRE = toWorld(36.140, -5.350);
const GIB_HALF = 900;   // world metres — covers the peninsula and the runway

// A medium tier (25 m cells) covers the Strait's eastern narrows: the Bay, Tarifa, Ceuta and
// Jebel Musa, where the player spends the sortie; the coarse tier fills the rest.
export const MED = { x: 1400, z: 700, half: 6500 };
const inGib = (x, z, m = 60) => Math.abs(x - GIB_CENTRE.x) < GIB_HALF - m && Math.abs(z - GIB_CENTRE.z) < GIB_HALF - m;
const inMed = (x, z, m = 100) => Math.abs(x - MED.x) < MED.half - m && Math.abs(z - MED.z) < MED.half - m;
export function buildTerrain() {
  const g = new THREE.Group();
  const coarse = buildGrid(0, 0, WORLD_HALF * 2, 320, terrainHeight, { mask: (x, z) => !inMed(x, z) });
  g.add(coarse);
  const medium = buildGrid(MED.x, MED.z, MED.half * 2, 520, terrainHeight, { mask: (x, z) => !inGib(x, z), tile: 60 });
  medium.castShadow = true;
  g.add(medium);
  const fine = buildGrid(GIB_CENTRE.x, GIB_CENTRE.z, GIB_HALF * 2, 300, terrainHeight, { tile: 45 });
  fine.castShadow = true;
  g.add(fine);
  return g;
}

// Seabed / land height over the whole world packed into a texture for the sea shader: R = height
// mapped from -60..+60 m, so the water can colour the shallows and break on the beaches.
export function buildDepthTexture(size = 384) {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -WORLD_HALF + (i + 0.5) / size * WORLD_HALF * 2, z = -WORLD_HALF + (j + 0.5) / size * WORLD_HALF * 2;
    const h = terrainHeight(x, z);
    const v = Math.round(THREE.MathUtils.clamp((h + 60) / 120, 0, 1) * 255);
    const k = (j * size + i) * 4; data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

export const GIB = { centre: GIB_CENTRE, half: GIB_HALF };
