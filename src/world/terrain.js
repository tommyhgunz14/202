import * as THREE from 'three';
import { COAST, PEAKS, RIDGES, pointInPoly, distToPoly } from '../data/geo.js';
import { toWorld, H_SCALE, V_SCALE, WORLD_HALF, GIB_ZOOM } from '../config.js';
import { loadTex, terrainDetail } from './textures.js';

// Convert coast polygons to world space once.
const POLYS = {};
for (const k of Object.keys(COAST)) POLYS[k] = COAST[k].map(([la, lo]) => { const p = toWorld(la, lo); return [p.x, p.z]; });
const PEAKS_W = PEAKS.map(([la, lo, h, r, dir, asp]) => {
  const p = toWorld(la, lo);
  return { x: p.x, z: p.z, h: h * V_SCALE, r: r * H_SCALE, dir: dir * Math.PI / 180, asp };
});

// Ridgelines in world space: each segment carries its end heights and widths, and the running
// distance along the crest so the skyline can be broken into peaks and cols by noise along it.
const RIDGES_W = RIDGES.map((line) => {
  const pts = line.map(([la, lo, h, hw]) => { const p = toWorld(la, lo); return { x: p.x, z: p.z, h: h * V_SCALE, hw: hw * H_SCALE }; });
  let s = 0; pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = s; });
  const pad = Math.max(...pts.map((p) => p.hw)) * 1.6;
  return { pts, minX: Math.min(...pts.map((p) => p.x)) - pad, maxX: Math.max(...pts.map((p) => p.x)) + pad, minZ: Math.min(...pts.map((p) => p.z)) - pad, maxZ: Math.max(...pts.map((p) => p.z)) + pad };
});
// smooth 1-D and 2-D value noise, fixed so the hills are the same every load
const h1 = (i) => { const s = Math.sin(i * 127.1 + 17.3) * 43758.5453; return s - Math.floor(s); };
const n1 = (t) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; };
const h2 = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
const n2 = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (h2(i, j) * (1 - ux) + h2(i + 1, j) * ux) * (1 - uz) + (h2(i, j + 1) * (1 - ux) + h2(i + 1, j + 1) * ux) * uz; };
function ridgeHeight(x, z) {
  let best = 0;
  for (const r of RIDGES_W) {
    if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
    let dMin = Infinity, h = 0, hw = 1, s = 0;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i];
      const abx = b.x - a.x, abz = b.z - a.z, L2 = abx * abx + abz * abz;
      const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / L2));
      const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
      if (d < dMin) { dMin = d; h = a.h + (b.h - a.h) * t; hw = a.hw + (b.hw - a.hw) * t; s = a.s + Math.sqrt(L2) * t; }
    }
    // the crest: peaks and cols along it, spurs reaching out and gullies cut back into the flanks
    const along = s / 230;
    const crest = h * (0.8 + 0.26 * n1(along) + 0.1 * n1(along * 3.3 + 7) + 0.04 * n1(along * 9 + 3));
    const width = hw * (0.78 + 0.45 * n2(x / 260, z / 260));
    const u = dMin / width;
    if (u >= 1) continue;
    let v = crest * Math.pow(1 - Math.pow(u, 1.5), 1.8);
    // rock outcrops and broken ground near the top
    v += crest * 0.05 * (n2(x / 45, z / 45) - 0.5) * (1 - u) * (1 - u);
    if (v > best) best = v;
  }
  return best;
}

// The Rock of Gibraltar, from survey figures (Atlas, checked against the known summits): a crest
// running almost due south from the sheer North Face to O'Hara's Battery, down over Windmill Hill
// to the Europa flats and the point. Each crest point is [lat, lon, height m, distance to the west
// shore m, distance to the east shore m, plateau]. The west side is the long slope the town climbs;
// the east side is a sheer upper crag over a talus or sea-cliff foot. The Rock is shown at its true
// height, and at twice the map's usual horizontal scale (see GIB_ZOOM in config.js), so it stands
// beside true-size aircraft and ships in the right proportion.
export const ROCK_V = 1.0;          // world metres per real metre of the Rock's height
const CREST = [
  [36.1486, -5.3445, 12, 380, 260, 0],      // foot of the North Face
  [36.1478, -5.3445, 170, 480, 300, 0],
  [36.1466, -5.3445, 360, 600, 330, 0],
  [36.1444, -5.3444, 411, 700, 360, 0],     // Rock Gun, top of the North Face
  [36.1418, -5.3445, 350, 730, 390, 0],     // the dip behind Rock Gun
  [36.1394, -5.3447, 377, 760, 420, 0],     // Middle Hill
  [36.1360, -5.3456, 340, 770, 440, 0],     // saddle below the Upper Rock
  [36.1328, -5.3468, 387, 780, 450, 0],     // Upper Rock cable-car top station
  [36.1319, -5.3467, 393, 780, 440, 0],     // Signal Hill
  [36.1290, -5.3458, 360, 780, 380, 0],     // the saddle south of Signal Hill
  [36.1260, -5.3448, 419, 775, 320, 0],     // top of the Mediterranean Steps
  [36.1251, -5.3444, 426, 770, 300, 0],     // O'Hara's Battery, the summit
  [36.1238, -5.3445, 395, 755, 300, 0],
  [36.1222, -5.3446, 330, 735, 305, 0.05],  // Lord Airey's shelf
  [36.1204, -5.3447, 240, 710, 315, 0.2],
  [36.1188, -5.3449, 160, 680, 330, 0.4],
  [36.1170, -5.3451, 125, 650, 340, 0.55],  // Windmill Hill
  [36.1145, -5.3455, 105, 600, 380, 0.55],
  [36.1118, -5.3460, 45, 520, 420, 0.5],    // Europa flats
  [36.1096, -5.3462, 18, 450, 450, 0.45],   // Europa Point lighthouse
  [36.1086, -5.3464, 0, 380, 380, 0.4],
];
const CREST_W = CREST.map(([la, lo, h, w, e, p]) => { const q = toWorld(la, lo); return { x: q.x, z: q.z, h: h * ROCK_V, w: w * GIB_ZOOM.inner, e: e * GIB_ZOOM.inner, p }; });
// look the two reference summits up by position, so adding crest points never shifts them
const crestZ = (lat) => CREST_W[CREST.findIndex((c) => c[0] === lat)].z;
const Z_GUN = crestZ(36.1444), Z_OHARA = crestZ(36.1251);
// the crest's x at a given z (the crest runs north to south, z increasing)
function crestAt(z) {
  if (z <= CREST_W[0].z) return { ...CREST_W[0], k: -1 };
  for (let i = 1; i < CREST_W.length; i++) {
    const a = CREST_W[i - 1], b = CREST_W[i];
    if (z <= b.z) {
      const u = (z - a.z) / (b.z - a.z);
      return { x: a.x + (b.x - a.x) * u, h: a.h + (b.h - a.h) * u, w: a.w + (b.w - a.w) * u, e: a.e + (b.e - a.e) * u, p: a.p + (b.p - a.p) * u, k: 0 };
    }
  }
  return { ...CREST_W[CREST_W.length - 1], k: 1 };
}
// where a point sits relative to the Rock: t 0 at Rock Gun .. 1 at O'Hara's Battery (beyond 1 is
// the south end), s the distance west of the crest in world metres (negative east)
export function rockFrame(x, z) {
  const c = crestAt(z);
  return { t: (z - Z_GUN) / (Z_OHARA - Z_GUN), s: c.x - x };
}
export function rockWestFace(x, z) { const { t, s } = rockFrame(x, z); return t > -0.25 && t < 1.4 && s > -6 && s < 380; }
// The southern end of the peninsula - Windmill Hill and the Europa flats - is a limestone
// platform running out to a low cliff. No beach, no pasture, no scrub worth speaking of.
export function onEuropaFlats(x, z) { const { t, s } = rockFrame(x, z); return t > 1.4 && t < 2.1 && s < 340 && s > -240; }
function rockHeight(x, z) {
  const c = crestAt(z);
  if (c.k !== 0) return 0;
  const s = c.x - x;
  let f;
  if (s >= 0) {
    // west: the long slope, flat-topped where the ground is a plateau
    const u = s / c.w; if (u >= 1) return 0;
    const v = u < c.p ? 0 : (u - c.p) / (1 - c.p);
    // crags near the top, the slope easing as it comes down to the town
    f = Math.pow(1 - v, 1.65);
    // gullies and spurs running down the slope
    f *= 1 - 0.12 * Math.sin(Math.min(1, v * 1.4) * Math.PI) * (0.5 + 0.5 * Math.sin(z * 0.045 + Math.sin(z * 0.013) * 2));
  } else {
    // east: a sheer upper crag falling to a gentler talus or sea-cliff foot
    const u = -s / c.e; if (u >= 1) return 0;
    const p = c.p * 0.6, v = u < p ? 0 : (u - p) / (1 - p);
    f = 1 - Math.pow(v, 0.6);
  }
  // broken ground along the crest
  const rough = 1 + (0.05 * (n2(x / 70, z / 70) - 0.5) + 0.025 * (n2(x / 23, z / 23) - 0.5)) * Math.max(0, 1 - Math.abs(s) / 90);
  return c.h * f * rough;
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
  h = Math.max(h, h * 0.35 + ridgeHeight(x, z));
  // keep coast low so beaches exist
  h *= Math.min(1, d / (600 * H_SCALE)) ** 0.7;
  return Math.max(h, rock);
}

const SANDSTONE = new THREE.Color(0x8c7d62), SANDSTONE_DK = new THREE.Color(0x6a5e4a), CORK = new THREE.Color(0x4c5343), MAQUIS = new THREE.Color(0x6b6d5a);
const WEST_OF_BAY = toWorld(36.10, -5.445).x;   // the Algeciras side and the Tarifa hills
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
    // the point runs out to rock at the water, not to sand
    if (onEuropaFlats(x, z)) { c.copy(SHORE_ROCK).lerp(LIMESTONE, 0.3 + 0.35 * n); c.sand = 0; c.userData = 0.7; return c; }
    if (slope > 0.22) return c.copy(SHORE_ROCK).lerp(LIMESTONE_DK, n * 0.5);          // rocky shore
    c.copy(h < 0.7 ? SAND_WET : SAND).lerp(SAND, Math.min(1, h / 3.5)); c.sand = 1 - Math.min(1, Math.max(0, (h - 2.2) / 1.3) * (slope > 0.12 ? 2 : 1));
    if (h > 2.2) c.lerp(MEADOW, (h - 2.2) / 1.3 * 0.5);
    return c;
  }
  // the platform itself is bare limestone with a little dry scrub in the hollows
  if (onEuropaFlats(x, z) && h < 90) { c.copy(LIMESTONE).lerp(LIMESTONE_DK, 0.2 + 0.3 * n); c.sand = 0; c.userData = 0.8; return c; }
  if (h < 12) c.copy(slope < 0.08 ? MEADOW : SCRUB_DRY).lerp(SCRUB, Math.min(1, h / 12) * 0.8 + n * 0.2);
  else c.copy(SCRUB).lerp(SCRUB_DRY, n * 0.35);
  // farmed patchwork on the gentle low ground
  const flat = THREE.MathUtils.clamp(1 - slope / 0.13, 0, 1) * THREE.MathUtils.clamp((h - 3.5) / 5, 0, 1) * (1 - THREE.MathUtils.clamp((h - 90) / 60, 0, 1));
  if (flat > 0) { const f = fieldAt(x, z); c.lerp(f.col, flat * 0.8 * (0.6 + 0.4 * f.edge)); }
  if (x < WEST_OF_BAY && z > toWorld(36.7, 0).z && !onEuropaFlats(x, z)) {
    // cork-oak forest and maquis on the slopes, grading darker with height; sandstone only where
    // the ground is steep enough to break through the cover
    if (h > 12) {
      const cover = THREE.MathUtils.clamp((h - 12) / 60, 0, 1);
      c.lerp(MAQUIS.clone().lerp(CORK, 0.35 + 0.5 * n), cover * 0.85);
      const bare = THREE.MathUtils.clamp((slope - 0.24) / 0.22, 0, 1) * THREE.MathUtils.clamp((h - 60) / 80, 0, 1);
      if (bare > 0) c.lerp(SANDSTONE.clone().lerp(SANDSTONE_DK, n), bare * 0.8);
      c.userData = bare * 0.6;
      return c;
    }
  }
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

const GIB_CENTRE = toWorld(36.133, -5.356);
const GIB_HALF = 1600;  // world metres — covers the peninsula, the harbour and the runway at the Gibraltar zoom

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
  const fine = buildGrid(GIB_CENTRE.x, GIB_CENTRE.z, GIB_HALF * 2, 540, terrainHeight, { tile: 45 });
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
