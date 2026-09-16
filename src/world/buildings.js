import { partBox } from '../collide.js?v=202609161601';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { toWorld, H_SCALE, V_SCALE, GIB_ZOOM } from '../config.js?v=202609161601';
import { terrainHeight, rockFrame } from './terrain.js?v=202609161601';
import { FRENCH_HARBOUR } from '../data/geo.js?v=202609161601';
import { planarUVs, texture } from './textures.js?v=202609161601';
import { LITE } from '../tier.js?v=202609161601';

// which generated texture dresses each material key, and the tile size in metres
const TEX = { tile: ['roof_tiles', 2.5], white: ['rendered_wall', 4], ochre: ['rendered_wall', 4], pink: ['rendered_wall', 4], cream: ['rendered_wall', 4],
  stone: ['stone_quay', 3], slate: ['corrugated_iron', 3], catchment: ['corrugated_iron', 2], concrete: ['tarmac', 6] };

// Period Gibraltar: terraced town houses on the west slope with pitched tile roofs, shuttered
// windows and iron balconies; dockyard sheds and cranes; the Moorish Castle's Tower of Homage on
// the north slope; the Rock Hotel (1932); the corrugated-iron water catchments on the east face
// (1903–1961). Everything is merged into a handful of meshes so the town costs a few draw calls.

const MATS = {
  white: new THREE.MeshStandardMaterial({ color: 0xece5d6, roughness: 0.9 }),
  ochre: new THREE.MeshStandardMaterial({ color: 0xd6b47f, roughness: 0.9 }),
  pink: new THREE.MeshStandardMaterial({ color: 0xd9a98f, roughness: 0.9 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe9dcb2, roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xa79e8a, roughness: 0.95 }),
  tile: new THREE.MeshStandardMaterial({ color: 0x9a5a3c, roughness: 0.95 }),
  slate: new THREE.MeshStandardMaterial({ color: 0x4d5258, roughness: 0.9 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x8a8f95, roughness: 0.6, metalness: 0.25 }),
  window: new THREE.MeshStandardMaterial({ color: 0x1f262c, roughness: 0.4 }),
  shutter: new THREE.MeshStandardMaterial({ color: 0x3f6b4c, roughness: 0.85 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6, metalness: 0.4 }),
  catchment: new THREE.MeshStandardMaterial({ color: 0xc9ced1, roughness: 0.7, metalness: 0.08 }),   // weathered galvanised sheet, pale in the sun
  concrete: new THREE.MeshStandardMaterial({ color: 0xbdb8ad, roughness: 0.9 }),
};

let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

class Builder {
  constructor() { this.parts = {}; this.colliders = []; }
  add(geo, matKey, matrix) {
    const c = partBox(geo, matrix || new THREE.Matrix4());   // the block as an obstacle, before it is merged
    if (c) this.colliders.push(c);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) g.applyMatrix4(matrix);
    (this.parts[matKey] ||= []).push(g);
  }
  box(w, h, d, matKey, x, y, z, ry = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    this.add(new THREE.BoxGeometry(w, h, d), matKey, m);
  }
  // gabled roof: triangular prism with ridge along the local x axis
  roof(w, d, rise, matKey, x, y, z, ry = 0, overhang = 0.5) {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2 - overhang, 0); shape.lineTo(0, rise); shape.lineTo(d / 2 + overhang, 0); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-(w + overhang * 2) / 2, 0, 0);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    this.add(geo, matKey, m);
  }
  build() {
    const g = new THREE.Group();
    for (const k of Object.keys(this.parts)) {
      const merged = BufferGeometryUtils.mergeGeometries(this.parts[k], false);
      if (!merged) continue;
      const geo = TEX[k] ? planarUVs(merged) : merged;
      const mat = TEX[k] ? MATS[k].clone() : MATS[k];
      if (TEX[k]) texture(mat, TEX[k][0], TEX[k][1], { tint: MATS[k].color.clone().lerp(new THREE.Color(0xffffff), 0.5) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !LITE; mesh.receiveShadow = true;
      g.add(mesh);
    }
    g.userData.colliders = this.colliders;
    return g;
  }
}

// Ground under a rotated footprint: the walls stand on the highest corner and a plinth or terrace
// wall runs down to the lowest, so nothing cantilevers out of a slope.
function footprint(x, z, w, d, ry) {
  const cos = Math.cos(ry), sin = Math.sin(ry);
  let top = -1e9, bottom = 1e9;
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0], [0, -d / 2], [0, d / 2], [-w / 2, 0], [w / 2, 0]]) {
    const h = Math.max(0, terrainHeight(x + lx * cos + lz * sin, z - lx * sin + lz * cos));
    top = Math.max(top, h); bottom = Math.min(bottom, h);
  }
  return { top, bottom };
}

// A town house: walls, window rows with shutters, balcony on some, tiled gable roof.
function house(b, x, z, w, d, floors, ry, wallKey, opts = {}) {
  const fp = footprint(x, z, w, d, ry);
  if (fp.top - fp.bottom > 14) return;                              // too steep for a house
  const y0 = fp.top;
  const fh = 3.3, h = floors * fh;
  const plinth = y0 + 1.2 - fp.bottom;
  b.box(w, plinth, d, 'stone', x, fp.bottom + plinth / 2, z, ry);   // plinth / retaining wall down to the ground
  b.box(w, h, d, wallKey, x, y0 + 1.2 + h / 2, z, ry);
  // eaves board and ridge cap give the roof an edge
  b.roof(w, d, opts.flat ? 0.6 : d * 0.32, opts.flat ? 'concrete' : 'tile', x, y0 + 1.2 + h, z, ry, opts.flat ? 0.1 : 0.5);
  if (!opts.flat) {
    b.box(w + 1.0, 0.25, 0.25, 'stone', x + (d / 2 + 0.4) * Math.sin(ry), y0 + 1.2 + h + 0.1, z + (d / 2 + 0.4) * Math.cos(ry), ry);
    b.box(w + 1.0, 0.25, 0.25, 'stone', x - (d / 2 + 0.4) * Math.sin(ry), y0 + 1.2 + h + 0.1, z - (d / 2 + 0.4) * Math.cos(ry), ry);
    b.box(w + 0.6, 0.3, 0.5, 'tile', x, y0 + 1.2 + h + d * 0.32, z, ry);
  } else {
    // parapet around a flat roof
    for (const sg of [-1, 1]) { b.box(w, 0.8, 0.3, wallKey, x + sg * (d / 2 - 0.15) * Math.sin(ry), y0 + 1.2 + h + 0.4, z + sg * (d / 2 - 0.15) * Math.cos(ry), ry); b.box(0.3, 0.8, d, wallKey, x + sg * (w / 2 - 0.15) * Math.cos(ry), y0 + 1.2 + h + 0.4, z - sg * (w / 2 - 0.15) * Math.sin(ry), ry); }
  }
  // windows on the two long faces
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const nWin = Math.max(1, Math.floor(w / 2.6));
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < nWin; i++) {
      const lx = -w / 2 + (i + 0.5) * (w / nWin);
      const wy = y0 + 1.2 + f * fh + fh * 0.55;
      for (const side of [1, -1]) {
        const lz = side * (d / 2 + 0.06);
        const wx = x + lx * cos + lz * sin, wz = z - lx * sin + lz * cos;
        b.box(1.0, 1.7, 0.12, 'window', wx, wy, wz, ry);
        if (opts.shutters !== false && (i + f) % 2 === 0) {
          for (const s of [-0.75, 0.75]) {
            const sx = x + (lx + s) * cos + lz * sin, sz = z - (lx + s) * sin + lz * cos;
            b.box(0.45, 1.7, 0.08, 'shutter', sx, wy, sz, ry);
          }
        }
      }
    }
    // iron balcony on the front of upper floors
    if (f > 0 && opts.balcony && f % 2 === 1) {
      const lz = d / 2 + 0.3;
      const bx = x + lz * sin, bz = z + lz * cos;
      b.box(w * 0.7, 0.1, 0.6, 'stone', bx, y0 + 1.2 + f * fh + 0.05, bz, ry);
      b.box(w * 0.7, 0.04, 0.04, 'rail', x + (lz + 0.28) * sin, y0 + 1.2 + f * fh + 0.95, z + (lz + 0.28) * cos, ry);
      for (let k = 0; k <= 6; k++) { const lx2 = -w * 0.35 + k * (w * 0.7 / 6); b.box(0.04, 0.9, 0.04, 'rail', x + lx2 * cos + (lz + 0.28) * sin, y0 + 1.2 + f * fh + 0.5, z - lx2 * sin + (lz + 0.28) * cos, ry); }
    }
  }
  // chimney
  if (!opts.flat && rnd() < 0.6) b.box(0.8, 1.6, 0.8, 'stone', x + (w * 0.3) * cos, y0 + 1.2 + h + d * 0.2, z - (w * 0.3) * sin, ry);
}

function shed(b, x, z, w, d, h, ry, wallKey = 'stone') {
  const fp = footprint(x, z, w, d, ry);
  const y0 = fp.top;
  if (y0 - fp.bottom > 0.3) b.box(w, y0 - fp.bottom + 0.2, d, 'stone', x, fp.bottom + (y0 - fp.bottom + 0.2) / 2, z, ry);
  b.box(w, h, d, wallKey, x, y0 + h / 2, z, ry);
  b.roof(w, d, d * 0.22, 'slate', x, y0 + h, z, ry, 0.4);
  const cos = Math.cos(ry), sin = Math.sin(ry);
  // big doors on one end
  b.box(0.2, h * 0.7, d * 0.5, 'window', x + (w / 2 + 0.05) * cos, y0 + h * 0.35, z - (w / 2 + 0.05) * sin, ry);
}

function crane(b, x, z, ry, height = 22, jib = 26) {
  const fpK = footprint(x, z, 8, 6, ry);
  const y0 = fpK.top;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  for (const s of [-4, 4]) {
    const lx = s; const px = x + lx * cos, pz = z - lx * sin;
    b.box(1.0, height, 1.0, 'iron', px, y0 + height / 2, pz, ry);
    b.box(1.0, height, 1.0, 'iron', px + 6 * sin, y0 + height / 2, pz + 6 * cos, ry);
  }
  b.box(10, 2.2, 8, 'iron', x + 3 * sin, y0 + height + 1.1, z + 3 * cos, ry);          // gantry head
  b.box(1.2, 1.2, jib, 'iron', x + (3 + jib * 0.35) * sin, y0 + height + 2.4 + jib * 0.1, z + (3 + jib * 0.35) * cos, ry); // jib
  b.box(0.15, height * 0.6, 0.15, 'rail', x + (3 + jib * 0.7) * sin, y0 + height * 0.75, z + (3 + jib * 0.7) * cos, ry);   // hoist rope
}

function moorishCastle(b) {
  // Tower of Homage on the north-west slope, above the town (14th-century keep, ~30 m)
  const p = toWorld(36.1445, -5.3512);
  const fpT = footprint(p.x, p.z, 18, 18, 0.15);
  const y0 = fpT.top;
  b.box(18, y0 - fpT.bottom + 0.5, 18, 'stone', p.x, fpT.bottom + (y0 - fpT.bottom + 0.5) / 2, p.z, 0.15);
  b.box(18, 30, 18, 'stone', p.x, y0 + 15, p.z, 0.15);
  b.box(10, 8, 10, 'stone', p.x + 2, y0 + 34, p.z - 2, 0.15);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.box(1.6, 1.6, 1.6, 'stone', p.x + Math.cos(a) * 8.6, y0 + 30.8, p.z + Math.sin(a) * 8.6, 0.15); }
  // curtain wall running down the slope
  for (let i = 0; i < 10; i++) {
    const wx = p.x - 12 - i * 9, wz = p.z + 4 + i * 5;
    const fp = footprint(wx, wz, 9.5, 2, -0.5);
    const wh = fp.top - fp.bottom + 6;
    b.box(9.5, wh, 2, 'stone', wx, fp.bottom + wh / 2, wz, -0.5);
    for (let k = -1; k <= 1; k++) b.box(1.2, 1.2, 2.2, 'stone', wx + k * 3.2 * Math.cos(-0.5), fp.top + 6.6, wz - k * 3.2 * Math.sin(-0.5), -0.5);   // merlons
  }
}

function rockHotel(b) {
  // Rock Hotel (opened 1932): long white block with stepped terraces on the slope above the
  // Alameda. The game hillside is steeper than the real one, so the site walks downhill until the
  // terrace wall is no more than a storey high.
  const p = toWorld(36.1352, -5.3508);
  const ry = 0.1, W = 56, D = 20;
  let fp = footprint(p.x, p.z, W, D, ry);
  for (let k = 0; k < 40 && fp.top - fp.bottom > 5; k++) { p.x -= 5; fp = footprint(p.x, p.z, W, D, ry); }
  const y0 = fp.top;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const wallH = y0 + 2.5 - fp.bottom;
  b.box(W, wallH, D, 'concrete', p.x, fp.bottom + wallH / 2, p.z, ry);          // terrace base
  b.box(W + 1, 0.9, 0.3, 'rail', p.x + (D / 2 + 0.3) * sin, y0 + 2.5 + 0.45, p.z + (D / 2 + 0.3) * cos, ry);
  for (let f = 0; f < 3; f++) {
    const w = W - f * 5, d = D - f * 3, yb = y0 + 2.5 + f * 4;
    b.box(w, 4, d, 'white', p.x, yb + 2, p.z - f * 1.5 * cos, ry);
    // windows on the two long faces and both ends
    const faces = [[0, d / 2 + 0.06, w, 0], [0, -d / 2 - 0.06, w, 0], [w / 2 + 0.06, 0, d, Math.PI / 2], [-w / 2 - 0.06, 0, d, Math.PI / 2]];
    for (const [ox, oz, len, extra] of faces) {
      const n = Math.max(1, Math.floor(len / 3.2));
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + (i + 0.5) * (len / n);
        const lx = extra ? ox : t, lz = extra ? t : oz;
        const wx = p.x + lx * cos + lz * sin, wz = p.z - f * 1.5 * cos - lx * sin + lz * cos;
        b.box(1.2, 2.0, 0.12, 'window', wx, yb + 2.1, wz, ry + extra);
      }
    }
    // balustrade along the terrace edge of the floor above
    b.box(w + 1, 0.9, 0.15, 'rail', p.x + (d / 2 + 0.6) * sin, yb + 4.45, p.z - f * 1.5 * cos + (d / 2 + 0.6) * cos, ry);
  }
  b.roof(W - 14, D - 8, 2.4, 'tile', p.x, y0 + 2.5 + 12, p.z - 3 * cos, ry, 0.5);
}

function catchments(b) {
  // The great east-face water catchments: corrugated iron sheets laid over the sand slope between
  // Catalan Bay and the foot of the cliffs, from about 1903 until they were taken up in the
  // 1960s-90s. The sheet covers only the slope itself: for each line across it, from where the
  // sand leaves the beach to where it meets the sheer rock, so it never climbs the cliff.
  const n = toWorld(36.1490, -5.3415), s = toWorld(36.1370, -5.3405);
  const rows = 40, cols = 16;
  const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
  const pos = geo.attributes.position;
  const band = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const z = n.z + (s.z - n.z) * v, xs = n.x + (s.x - n.x) * v + 260;   // start well out to sea, east of the shore
    let lo = null, hi = null;
    for (let x = xs; x > xs - 900; x -= 3) {
      const h = terrainHeight(x, z);
      if (lo === null && h > 4) lo = x;
      if (lo !== null && h > 95) { hi = x; break; }
    }
    band.push(lo !== null && hi !== null && lo - hi > 20 ? [lo - 4, hi + 6] : null);
  }
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5, v = 0.5 - pos.getY(i);
    const r = Math.round(v * rows), z = n.z + (s.z - n.z) * v;
    const bnd = band[r] || band.find((x) => x) || [n.x, n.x - 1];
    const x = bnd[0] + (bnd[1] - bnd[0]) * u;
    pos.setXYZ(i, x, terrainHeight(x, z) + (band[r] ? 1.6 : -40), z);   // rows with no slope are sunk out of sight
  }
  geo.computeVertexNormals();
  b.add(geo, 'catchment', null);
}

function town(b) {
  // Gibraltar town: streets run north–south along the contour on the west slope, so terraces
  // are laid in N–S rows stepping up the hill from the Line Wall to Castle Road.
  const n = toWorld(36.1470, -5.3545), s = toWorld(36.1260, -5.3510);
  // world metres east (uphill) of the waterfront line; Gibraltar is drawn at twice the map scale
  const Z = GIB_ZOOM.inner / H_SCALE;
  const rows = [0, 22, 46, 72, 100, 130, 165, 205, 250, 300].map((m) => m * Z * 0.62);
  const wallKeys = ['white', 'white', 'cream', 'ochre', 'pink', 'white', 'cream'];
  for (const off of rows) {
    let along = 0;
    const total = Math.hypot(s.x - n.x, s.z - n.z);
    const ux = (s.x - n.x) / total, uz = (s.z - n.z) / total;
    while (along < total) {
      const w = 9 + rnd() * 9, gap = rnd() < 0.15 ? 6 + rnd() * 10 : 0.3;
      const cx = n.x + ux * (along + w / 2) + off + (rnd() - 0.5) * 3, cz = n.z + uz * (along + w / 2);
      const th = terrainHeight(cx, cz);
      // the town stops at the ridge: the top terraces must not run over on to the east cliffs
      if (th > 0.5 && th < 120 && rockFrame(cx, cz).s > 60) {
        const floors = 2 + (rnd() < 0.55 ? 1 : 0) + (off < 50 && rnd() < 0.4 ? 1 : 0);
        house(b, cx, cz, w, 8 + rnd() * 4, floors, Math.atan2(ux, uz) + Math.PI / 2, wallKeys[Math.floor(rnd() * wallKeys.length)], { balcony: rnd() < 0.6, flat: rnd() < 0.2 });
      }
      along += w + gap;
    }
  }
  // Line Wall and King's Bastion along the waterfront
  const lw0 = toWorld(36.1450, -5.3560), lw1 = toWorld(36.1275, -5.3535);
  const L = Math.hypot(lw1.x - lw0.x, lw1.z - lw0.z);
  {
    const ryL = Math.atan2(lw1.x - lw0.x, lw1.z - lw0.z);
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs, tm = (t0 + t1) / 2;
      const sx = lw0.x + (lw1.x - lw0.x) * tm, sz = lw0.z + (lw1.z - lw0.z) * tm;
      const fp = footprint(sx, sz, 4, L / segs, ryL);
      b.box(4, 9, L / segs + 0.5, 'stone', sx, fp.bottom + 2.5, sz, ryL);   // 7 m above the shore, sunk 2 m
    }
  }
  const kb = toWorld(36.1385, -5.3555);
  {
    const fp = footprint(kb.x - 15, kb.z, 60, 40, 0);
    const top = fp.bottom + 7;
    b.box(60, 10, 40, 'stone', kb.x - 15, top - 5, kb.z, 0);
    for (let i = 0; i < 12; i++) { b.box(2.2, 1.4, 1.2, 'stone', kb.x - 15 - 29 + i * 5.3, top + 0.7, kb.z - 19.5, 0); b.box(2.2, 1.4, 1.2, 'stone', kb.x - 15 - 29 + i * 5.3, top + 0.7, kb.z + 19.5, 0); }
    for (let i = 0; i < 8; i++) { b.box(1.2, 1.4, 2.2, 'stone', kb.x - 15 - 29.5, top + 0.7, kb.z - 17 + i * 4.9, 0); }
  }
  // Cathedral of St Mary the Crowned (Main Street): small tower with a cupola
  const cat = toWorld(36.1395, -5.3525);
  const fpC = footprint(cat.x, cat.z, 12, 12, 0.1);
  const cy = fpC.top;
  b.box(12, cy - fpC.bottom + 0.5, 12, 'stone', cat.x, fpC.bottom + (cy - fpC.bottom + 0.5) / 2, cat.z, 0.1);
  b.box(12, 22, 12, 'white', cat.x, cy + 11, cat.z, 0.1);
  b.box(8, 4, 8, 'white', cat.x, cy + 24, cat.z, 0.1);
  b.roof(8, 8, 3, 'tile', cat.x, cy + 26, cat.z, 0.1, 0.2);
  // Dockyard by the South Mole: sheds and three gantry cranes; workshops on the North Mole
  const dy = toWorld(36.1245, -5.3590);
  for (let i = 0; i < 4; i++) shed(b, dy.x + i * 26 - 40, dy.z - 20 + (i % 2) * 24, 22, 40, 10, 0, 'concrete');
  for (let i = 0; i < 3; i++) crane(b, dy.x - 70 + i * 30, dy.z + 25, Math.PI / 2, 24, 28);
  const nm = toWorld(36.1490, -5.3700);
  for (let i = 0; i < 3; i++) shed(b, nm.x - 40 - i * 45, nm.z + 8, 40, 12, 7, 0, 'stone');
  crane(b, nm.x - 120, nm.z - 2, 0, 16, 18);
  // Coaling and Admiralty stores behind the Gun Wharf
  const gw = toWorld(36.1352, -5.3548);
  for (let i = 0; i < 3; i++) shed(b, gw.x + 10, gw.z - 40 + i * 32, 18, 26, 8, Math.PI / 2, 'stone');
}

// Europa Point and Windmill Hill, laid out from a wartime aerial photograph of the point (not
// included in this repository, as its rights are not established). At the foot of Windmill Hill's scarp stand rows of
// long barrack blocks, three storeys with flat roofs, parallel to the scarp; more run north along
// the shelf on the west side. Long low blocks and huts sit on top of Windmill Hill. The Europa
// flats beyond are mostly open, with scattered stores and a big bare ground toward the lighthouse,
// and a pale wall follows the cliff top all round.
function europaPoint(b) {
  const P = (lat, lon) => toWorld(lat, lon);
  const block = (lat, lon, w, d, floors, ry, wall = 'cream') => { const p = P(lat, lon); if (terrainHeight(p.x, p.z) > 8) house(b, p.x, p.z, w, d, floors, ry, wall, { flat: true, shutters: false }); };
  const RY = 0.1;   // the scarp, and the blocks under it, run a little north of east
  // barracks under the scarp: three rows
  for (const [lat, lons] of [[36.11305, [-5.3500, -5.3487, -5.3474]], [36.11265, [-5.3503, -5.3490, -5.3477, -5.3464]], [36.11225, [-5.3496, -5.3483]]]) {
    for (const lon of lons) block(lat, lon, 44, 10, 3, RY, lon > -5.348 ? 'white' : 'cream');
  }
  // along the west shelf toward Camp Bay and Rosia
  for (const [lat, lon] of [[36.1146, -5.3514], [36.1158, -5.3517], [36.1170, -5.3519], [36.1184, -5.3521], [36.1200, -5.3523]]) block(lat, lon, 40, 9, 2, Math.PI / 2 + 0.15, 'cream');
  // Windmill Hill: long single-storey blocks and huts on the plateau's western half
  for (const [lat, lon, w, fl] of [[36.1178, -5.3478, 42, 2], [36.1170, -5.3470, 36, 1], [36.1162, -5.3482, 40, 1], [36.1154, -5.3472, 30, 1], [36.1148, -5.3486, 34, 2]]) block(lat, lon, w, 8, fl, RY + 0.05, 'white');
  for (let i = 0; i < 6; i++) block(36.1172 - i * 0.0005, -5.3458 + (i % 2) * 0.0006, 16, 6, 1, RY, 'stone');
  // the flats: stores and quarters scattered toward the point
  for (const [lat, lon, w, d, fl] of [[36.1118, -5.3478, 22, 10, 2], [36.1116, -5.3466, 18, 9, 1], [36.1112, -5.3486, 26, 11, 2], [36.1108, -5.3474, 14, 8, 1], [36.1120, -5.3452, 20, 9, 1], [36.1104, -5.3466, 16, 10, 1]]) block(lat, lon, w, d, fl, RY, 'stone');
  // a heavy square work on the southern cliff edge, and the lighthouse keepers' quarters
  block(36.1103, -5.3486, 14, 14, 2, RY, 'stone');
  block(36.1095, -5.3468, 16, 9, 1, RY, 'white');
  // the tall slender white tower that stands west of the lighthouse in the photograph
  const tw = P(36.1097, -5.3474), th = Math.max(0, terrainHeight(tw.x, tw.z));
  b.box(1.6, 22, 1.6, 'white', tw.x, th + 11, tw.z, 0);
  b.box(2.4, 1.2, 2.4, 'stone', tw.x, th + 0.6, tw.z, 0);
  // the cliff-top wall: wherever the flats' edge drops to the sea
  const a = P(36.1142, -5.3530), c = P(36.1082, -5.3405);
  for (let x = Math.min(a.x, c.x); x < Math.max(a.x, c.x); x += 7) {
    for (let z = Math.min(a.z, c.z); z < Math.max(a.z, c.z); z += 7) {
      const h = terrainHeight(x, z);
      if (h < 14 || h > 60) continue;
      // the downhill direction to the sea, and how far the ground drops within 8 m
      let best = 0, dir = 0;
      for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4; const d = h - terrainHeight(x + Math.sin(an) * 8, z + Math.cos(an) * 8); if (d > best) { best = d; dir = an; } }
      if (best < 12) continue;
      // on the lip itself, not part-way down the face: the ground behind is as high as here
      if (Math.abs(terrainHeight(x - Math.sin(dir) * 5, z - Math.cos(dir) * 5) - h) > 1.5) continue;
      b.box(7.4, 1.8, 0.8, 'stone', x, h + 0.9, z, dir);   // the wall's length runs across the fall, along the edge
    }
  }
}

// The French naval harbour across the Strait (FRENCH_HARBOUR in data/geo.js): a stone mole with a
// return arm and a light at its head, a quay with warehouses and cranes along the shore, a town of
// flat-roofed white houses stepping up the slope, and the old fort on the point above it.
function frenchHarbour(b) {
  const FH = FRENCH_HARBOUR;
  const seg = (a, c, w, h) => {
    const p = toWorld(a[0], a[1]), q = toWorld(c[0], c[1]);
    const len = Math.hypot(q.x - p.x, q.z - p.z), ry = -Math.atan2(q.z - p.z, q.x - p.x);
    b.box(len + w, h, w, 'stone', (p.x + q.x) / 2, h / 2 - 3, (p.z + q.z) / 2, ry);
    b.box(len + w, 1.2, 1.2, 'stone', (p.x + q.x) / 2 + Math.sin(ry) * (w / 2 - 0.6), h - 3 + 0.6, (p.z + q.z) / 2 + Math.cos(ry) * (w / 2 - 0.6), ry);   // parapet on the seaward side
  };
  for (let i = 1; i < FH.mole.length; i++) seg(FH.mole[i - 1], FH.mole[i], 16, 9);
  // light at the mole head
  const lh = toWorld(FH.light[0], FH.light[1]);
  b.box(4, 11, 4, 'white', lh.x, 6 + 5.5, lh.z, 0); b.box(5, 1, 5, 'stone', lh.x, 17.5, lh.z, 0);
  // quay along the shore, with warehouses and cranes behind it
  const q0 = toWorld(FH.quay[0][0], FH.quay[0][1]), q1 = toWorld(FH.quay[1][0], FH.quay[1][1]);
  const qlen = Math.hypot(q1.x - q0.x, q1.z - q0.z), qry = -Math.atan2(q1.z - q0.z, q1.x - q0.x);
  b.box(qlen, 6, 14, 'stone', (q0.x + q1.x) / 2, 0, (q0.z + q1.z) / 2, qry);
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7, x = q0.x + (q1.x - q0.x) * t - 40, z = q0.z + (q1.z - q0.z) * t;
    shed(b, x, z, 44, 20, 9, Math.PI / 2 + 0.02, i % 2 ? 'stone' : 'cream');
    if (i % 2 === 0) crane(b, x + 30, z + 12, Math.PI, 16, 18);
  }
  // the town: flat-roofed white houses in terraces up the slope, a few larger blocks among them
  const T = FH.town;
  let k = 0;
  for (let la = T.lat0; la < T.lat1; la += 0.0021) {
    for (let lo = T.lon0; lo < T.lon1; lo += 0.0019) {
      k++;
      if (rnd() < 0.22) continue;   // lanes, yards and open ground between the blocks
      const p = toWorld(la + (rnd() - 0.5) * 0.0016, lo + (rnd() - 0.5) * 0.0016);
      const th = terrainHeight(p.x, p.z);
      if (th < 3) continue;
      const big = k % 11 === 0;
      house(b, p.x, p.z, big ? 30 : 12 + rnd() * 10, big ? 16 : 9 + rnd() * 4, big ? 3 : 1 + (rnd() < 0.5 ? 1 : 0), Math.PI / 2 + (rnd() < 0.3 ? Math.PI / 2 : 0) + (rnd() - 0.5) * 0.35, rnd() < 0.82 ? 'white' : 'cream', { flat: true, shutters: rnd() < 0.5 });
    }
  }
  // the fort on the point
  const f = toWorld(FH.fort[0], FH.fort[1]);
  const fy = Math.max(0, terrainHeight(f.x, f.z));
  b.box(90, 14, 60, 'stone', f.x, fy + 4, f.z, 0.3);
  for (const [dx, dz] of [[-45, -30], [45, -30], [-45, 30], [45, 30]]) b.box(16, 18, 16, 'stone', f.x + dx * 0.95 + dz * 0.3, fy + 6, f.z + dz * 0.95 - dx * 0.3, 0.3);
}

function spanishTown(b, lat, lon, count, spread, withTower = false) {
  const c = toWorld(lat, lon);
  for (let i = 0; i < count; i++) {
    const x = c.x + (rnd() - 0.5) * spread, z = c.z + (rnd() - 0.5) * spread;
    const th = terrainHeight(x, z);
    if (th < 0.5 || th > 60) continue;
    house(b, x, z, 8 + rnd() * 8, 7 + rnd() * 5, 1 + (rnd() < 0.4 ? 1 : 0), rnd() * Math.PI, rnd() < 0.8 ? 'white' : 'cream', { flat: rnd() < 0.5, shutters: rnd() < 0.5 });
  }
  if (withTower) {
    const th = Math.max(0, terrainHeight(c.x, c.z));
    b.box(8, 26, 8, 'ochre', c.x, th + 13, c.z, 0);
    b.roof(8, 8, 4, 'tile', c.x, th + 26, c.z, 0, 0.2);
  }
}

// Each town is merged on its own, so a town out of view is not drawn at all. The light build
// has half as many houses in the towns across the water.
export function buildTown() {
  const g = new THREE.Group();
  g.userData.colliders = [];
  const part = (fill) => { const b = new Builder(); fill(b); const m = b.build(); g.add(m); g.userData.colliders.push(...m.userData.colliders); };
  const across = LITE ? 0.5 : 1;
  part((b) => { town(b); moorishCastle(b); rockHotel(b); catchments(b); });
  part((b) => europaPoint(b));
  part((b) => spanishTown(b, 36.130, -5.452, Math.round(90 * across), 700, true));   // Algeciras
  part((b) => spanishTown(b, 36.168, -5.348, Math.round(60 * across), 500));         // La Línea
  part((b) => spanishTown(b, 36.013, -5.605, Math.round(40 * across), 400, true));   // Tarifa
  part((b) => spanishTown(b, 35.889, -5.316, Math.round(60 * across), 500, true));   // Ceuta
  part((b) => frenchHarbour(b));                                                     // the French naval harbour south of Ceuta
  part((b) => spanishTown(b, 35.785, -5.810, Math.round(60 * across), 600, true));   // Tangier
  return g;
}
