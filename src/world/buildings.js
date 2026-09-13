import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { toWorld, H_SCALE, V_SCALE } from '../config.js';
import { terrainHeight } from './terrain.js';
import { planarUVs, texture } from './textures.js';

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
  catchment: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.55, metalness: 0.35 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xbdb8ad, roughness: 0.9 }),
};

let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

class Builder {
  constructor() { this.parts = {}; }
  add(geo, matKey, matrix) {
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
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
    }
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
  // The great east-face water catchments: corrugated sheets laid over the sand slope between
  // Catalan Bay and the ridge, from about 1903 until they were removed in the 1960s–90s.
  const n = toWorld(36.1500, -5.3415), s = toWorld(36.1360, -5.3405);
  const rows = 18, cols = 7;
  const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5, v = 0.5 - pos.getY(i);          // u across (0 west/upslope .. 1 east/shore), v along N-S
    const x0 = n.x + (s.x - n.x) * v, z0 = n.z + (s.z - n.z) * v;
    const x = x0 - 30 + u * 150, z = z0;                          // 150 m wide band down the slope
    pos.setXYZ(i, x, terrainHeight(x, z) + 0.8, z);
  }
  geo.computeVertexNormals();
  b.add(geo, 'catchment', null);
  // corrugation lines
  for (let i = 0; i < 12; i++) {
    const v = i / 11;
    const x0 = n.x + (s.x - n.x) * v, z0 = n.z + (s.z - n.z) * v;
    for (let j = 0; j < 6; j++) {
      const x = x0 - 25 + j * 25, z = z0;
      b.box(22, 0.3, 0.6, 'iron', x, terrainHeight(x, z) + 1.0, z, 0);
    }
  }
}

function town(b) {
  // Gibraltar town: streets run north–south along the contour on the west slope, so terraces
  // are laid in N–S rows stepping up the hill from the Line Wall to Castle Road.
  const n = toWorld(36.1470, -5.3545), s = toWorld(36.1260, -5.3510);
  const rows = [0, 22, 46, 72, 100, 130, 165];   // metres east (uphill) of the waterfront line
  const wallKeys = ['white', 'white', 'cream', 'ochre', 'pink', 'white', 'cream'];
  for (const off of rows) {
    let along = 0;
    const total = Math.hypot(s.x - n.x, s.z - n.z);
    const ux = (s.x - n.x) / total, uz = (s.z - n.z) / total;
    while (along < total) {
      const w = 9 + rnd() * 9, gap = rnd() < 0.15 ? 6 + rnd() * 10 : 0.3;
      const cx = n.x + ux * (along + w / 2) + off + (rnd() - 0.5) * 3, cz = n.z + uz * (along + w / 2);
      const th = terrainHeight(cx, cz);
      if (th > 0.5 && th < 95) {
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

// Europa Point and Windmill Hill. The photographs show the southern platform covered: long
// two-storey barrack blocks in parallel terraces stepping inland from the point, a walled
// enclosure at the seaward edge and a few heavier works among them. Laid on the axis running
// inland from the point so the rows follow the ground rather than the compass.
function europaPoint(b) {
  const c = toWorld(36.1088, -5.3406);          // the point itself
  const up = toWorld(36.1180, -5.3455);         // inland, toward Windmill Hill
  const ax = Math.atan2(up.x - c.x, up.z - c.z);
  const sin = Math.sin(ax), cos = Math.cos(ax);
  const at = (inland, across) => ({ x: c.x + sin * inland + cos * across, z: c.z + cos * inland - sin * across });
  // terraced rows of barrack blocks
  for (let row = 0; row < 8; row++) {
    const inland = 34 + row * 42;
    for (let k = -3; k <= 3; k++) {
      const p = at(inland, k * 40 + (row % 2) * 15);
      const th = terrainHeight(p.x, p.z);
      if (th < 1.2 || th > 80) continue;
      const long = 24 + rnd() * 16, wide = 8.5 + rnd() * 3;
      house(b, p.x, p.z, long, wide, 2, ax + Math.PI / 2, rnd() < 0.65 ? 'cream' : 'white', { flat: rnd() < 0.4, shutters: true });
    }
  }
  // a couple of heavier blocks and stores among them
  for (const [inl, acr, w, d, fl] of [[92, -104, 34, 14, 2], [150, 96, 30, 13, 2], [216, -60, 28, 12, 1]]) {
    const p = at(inl, acr); const th = terrainHeight(p.x, p.z);
    if (th > 1) house(b, p.x, p.z, w, d, fl, ax + Math.PI / 2, 'stone', { flat: true });
  }
  // low boundary wall along the seaward edge of the platform
  for (let k = -5; k <= 5; k++) {
    const p = at(14, k * 26);
    const th = terrainHeight(p.x, p.z);
    if (th > 0.8) b.box(24, 1.5, 0.8, 'stone', p.x, th + 0.75, p.z, ax + Math.PI / 2);
  }
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

export function buildTown() {
  const b = new Builder();
  town(b);
  europaPoint(b);
  moorishCastle(b);
  rockHotel(b);
  catchments(b);
  spanishTown(b, 36.130, -5.452, 90, 700, true);   // Algeciras
  spanishTown(b, 36.168, -5.348, 60, 500);         // La Línea
  spanishTown(b, 36.013, -5.605, 40, 400, true);   // Tarifa
  spanishTown(b, 35.889, -5.316, 60, 500, true);   // Ceuta
  spanishTown(b, 35.785, -5.810, 60, 600, true);   // Tangier
  return b.build();
}
