// HMS Wishart (D67), Admiralty Modified W-class destroyer, 1942
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const mat = (hex, rough = 0.85, name = 'metal', side) => { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.05, name }); if (side !== undefined) m.side = side; return m; };
  const GREY = mat(0x9da4a8), DECKC = mat(0x6b7176), BOOT = mat(0x141517, 0.7), RED = mat(0x8a2f24, 0.8);
  const GREY2 = mat(0x9da4a8, 0.85, 'metal', DS), DECK2 = mat(0x6b7176, 0.9, 'timber', DS), BOOT2 = mat(0x141517, 0.7, 'metal', DS), RED2 = mat(0x8a2f24, 0.8, 'metal', DS);
  const BLACK = mat(0x141517, 0.6), BRASS = mat(0xb08d3e, 0.45), CANVAS = mat(0xb9b09a, 0.95, 'canvas'), GLASS = mat(0x1f3468, 0.15, 'glass');
  GLASS.transparent = true; GLASS.opacity = 0.55;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, h, d, m, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  const cylY = (rt, rb, h, m, x, y, z, seg = 12, parent) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent);
  const cylZ = (rf, rb, len, m, x, y, z, seg = 12, parent) => { const o = cylY(rf, rb, len, m, x, y, z, seg, parent); o.rotation.x = Math.PI / 2; return o; };
  const cylX = (r, len, m, x, y, z, seg = 8, parent) => { const o = cylY(r, r, len, m, x, y, z, seg, parent); o.rotation.z = Math.PI / 2; return o; };
  const empty = (name, x, y, z, parent = g) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); return o; };
  const rod = (p1, p2, r, m, parent = g, seg = 6) => { const d = p2.clone().sub(p1), len = d.length(); const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m); o.position.copy(p1).add(p2).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); parent.add(o); return o; };
  const loft = (sections, closed, m, parent = g) => {
    const n = sections[0].length, S = sections.length, pos = [], idx = [];
    for (const s of sections) for (const p of s) pos.push(p.x, p.y, p.z);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < S - 1; i++) for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % n, a = i * n + j, b = i * n + j2, c = (i + 1) * n + j, d = (i + 1) * n + j2;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return mesh(geo, m, 0, 0, 0, parent);
  };
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

  // ---------------- hull ----------------
  const L = 95.1, B = 9.0, ZB = L / 2, ZS = -L / 2, WL = 3.4;
  const BREAK = 10; // break of the forecastle
  const FCY = 7.8, MDY0 = 6.3;
  const deckYf = (z) => {
    const md = MDY0 + 0.9 * smooth((-35 - z) / 12);
    if (z >= BREAK) return FCY;
    if (z >= BREAK - 0.8) { const t = smooth((z - (BREAK - 0.8)) / 0.8); return md + (FCY - md) * t; }
    return md;
  };
  const hw = (z) => {
    if (z >= 0) { const t = clamp01((z - 14) / (ZB - 14)); return Math.max(0.05, 4.5 * Math.pow(1 - Math.pow(t, 1.5), 0.55)); }
    const t = clamp01((-z - 25) / (-ZS - 25)); return Math.max(0.08, 4.5 * Math.pow(1 - Math.pow(t, 1.9), 0.62));
  };
  const keelY = (z) => {
    if (z > 41) { const t = clamp01((z - 41) / (ZB - 41)); return 0.15 + (deckYf(z) - 0.15) * Math.pow(t, 1.5); }
    if (z < -43) { const t = clamp01((-43 - z) / (-ZS - 43)); return 0.15 + (deckYf(z) - 0.15) * Math.pow(t, 1.3); }
    return 0.15;
  };
  const xAtY = (pl, y) => {
    for (let i = 0; i < pl.length - 1; i++) { const [x1, y1] = pl[i], [x2, y2] = pl[i + 1]; if (y <= y1 && y >= y2) { const t = y1 === y2 ? 0 : (y1 - y) / (y1 - y2); return x1 + (x2 - x1) * t; } }
    return y > pl[0][1] ? pl[0][0] : pl[pl.length - 1][0];
  };
  const rightSide = (z) => {
    const a = hw(z), yk = keelY(z), yd = deckYf(z), kb = Math.min(0.14, a * 0.3);
    const pts = [[a, yd]]; const N = 6;
    for (let i = 1; i <= N; i++) { const u = i / N; const x = kb + (a - kb) * Math.pow(1 - u, 1.35); const y = yd - (yd - yk) * Math.pow(u, 0.88); pts.push([x, y]); }
    return pts;
  };
  const sliceAt = (poly, y) => {
    if (!poly.length) return [[], []];
    const above = [], below = []; let crossed = false;
    for (const p of poly) {
      if (!crossed) { if (p[1] >= y) above.push(p); else { const q = [xAtY(poly, y), y]; above.push(q); below.push(q); below.push(p); crossed = true; } }
      else below.push(p);
    }
    if (!crossed) { if (poly[0][1] < y) { below.push(...poly); } else { above.push(...poly); } }
    return [above, below];
  };
  const resample = (poly, N) => {
    const cum = [0]; for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const total = cum[cum.length - 1], out = [];
    for (let k = 0; k < N; k++) { const d = total * k / (N - 1); let i = 0; while (i < cum.length - 2 && cum[i + 1] < d) i++; const seg = cum[i + 1] - cum[i]; const t = seg > 1e-9 ? (d - cum[i]) / seg : 0; out.push([poly[i][0] + (poly[i + 1][0] - poly[i][0]) * t, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * t]); }
    return out;
  };
  const stations = [];
  for (let z = ZS; z < ZS + 6; z += 0.6) stations.push(z);
  for (let z = ZS + 6; z < -35; z += 2) stations.push(z);
  for (let z = -35; z < BREAK - 1; z += 1.5) stations.push(z);
  stations.push(BREAK - 0.8, BREAK - 0.4, BREAK - 0.05, BREAK);
  for (let z = BREAK; z < 38; z += 1.6) stations.push(z);
  for (let z = 38; z < ZB; z += 0.6) stations.push(z);
  stations.push(ZB);
  stations.sort((a, b) => a - b);
  const greyR = [], greyL = [], bootR = [], bootL = [], redR = [], redL = [], deck = [];
  for (const z of stations) {
    const poly = rightSide(z);
    const [grey, rest] = sliceAt(poly, WL + 0.25);
    const [boot, red] = sliceAt(rest, WL - 0.25);
    const gLast = grey.length ? grey[grey.length - 1] : poly[poly.length - 1];
    const bAnchor = boot.length ? boot[boot.length - 1] : gLast;
    const rAnchor = red.length ? red[red.length - 1] : bAnchor;
    const g3 = resample(grey.length > 1 ? grey : [gLast, gLast], 4);
    const b3 = resample(boot.length > 1 ? boot : [bAnchor, bAnchor], 3);
    const r3 = resample(red.length > 1 ? red : [rAnchor, rAnchor], 6);
    greyR.push(g3.map(([x, y]) => V(x, y, z))); greyL.push(g3.map(([x, y]) => V(-x, y, z)));
    bootR.push(b3.map(([x, y]) => V(x, y, z))); bootL.push(b3.map(([x, y]) => V(-x, y, z)));
    redR.push(r3.map(([x, y]) => V(x, y, z))); redL.push(r3.map(([x, y]) => V(-x, y, z)));
    const yd = deckYf(z);
    deck.push([V(-poly[0][0], yd, z), V(0, yd, z), V(poly[0][0], yd, z)]);
  }
  loft(greyR, false, GREY2); loft(greyL, false, GREY2);
  loft(bootR, false, BOOT2); loft(bootL, false, BOOT2);
  loft(redR, false, RED2); loft(redL, false, RED2);
  loft(deck, false, DECK2);
  // deck planking seams
  for (let z = ZS + 4; z <= ZB - 3; z += 0.6) { const w = hw(z) * 1.9; if (w < 0.3) continue; box(w, 0.02, 0.05, BLACK, 0, deckYf(z) + 0.005, z); }
  // forecastle break bulwark reinforcement line
  box(hw(BREAK) * 1.9, 0.06, 0.1, BLACK, 0, FCY + 0.02, BREAK);

  // thin deck-edge rails, both decks
  const railLine = (z0, z1, step, yfn) => {
    for (const s of [1, -1]) {
      const pts = []; for (let z = z0; z <= z1; z += step) pts.push(V(s * (hw(z) - 0.06), yfn(z), z));
      for (let i = 0; i < pts.length - 1; i++) rod(pts[i], pts[i + 1], 0.02, BLACK);
      for (let i = 0; i < pts.length; i += 2) box(0.04, 0.6, 0.04, BLACK, pts[i].x, pts[i].y + 0.3, pts[i].z);
    }
  };
  railLine(BREAK + 1, ZB - 6, 3, deckYf);
  railLine(ZS + 6, BREAK - 1, 3, deckYf);

  // ---------------- "A" gun on the forecastle ----------------
  const gunMount = (ZG, y0, shieldW, shieldH, shieldD, barrelLen, barrelR, parent = g, nodeName = null) => {
    const d = new THREE.Group(); d.position.set(0, y0, ZG); parent.add(d);
    cylY(shieldW * 0.55, shieldW * 0.6, 0.14, GREY, 0, 0.07, 0, 12, d);
    cylY(shieldW * 0.32, shieldW * 0.38, 0.4, GREY, 0, 0.34, 0, 10, d);
    box(shieldW, shieldH, shieldD, GREY, 0, 0.55 + shieldH / 2, 0.05, d);
    cylZ(barrelR * 0.7, barrelR, barrelLen, BLACK, 0, 0.55 + shieldH * 0.62, shieldD * 0.3 + barrelLen / 2, 10, d);
    if (nodeName) empty(nodeName, 0, 0.55 + shieldH * 0.62, shieldD * 0.3 + barrelLen, d);
    return d;
  };
  gunMount(37, FCY, 1.9, 1.9, 1.7, 4.6, 0.11, g, 'gun');

  // ---------------- bridge structure with open compass platform ----------------
  { const bz = 24, bd = FCY;
    box(6.2, 2.3, 5.5, GREY, 0, bd + 1.15, bz);                          // lower bridge / wheelhouse
    for (let i = -1; i <= 1; i++) box(1.0, 0.9, 0.06, GLASS, i * 1.9, bd + 2.0, bz + 2.78); // windows
    box(6.4, 0.12, 5.7, GREY, 0, bd + 2.36, bz);                          // deck plate
    box(4.6, 1.5, 3.8, GREY, 0, bd + 3.11, bz - 0.2);                     // upper bridge tier
    for (let i = -1; i <= 1; i++) box(0.8, 0.7, 0.06, GLASS, i * 1.3, bd + 3.4, bz + 1.68);
    box(4.8, 0.1, 4.0, GREY, 0, bd + 3.91, bz - 0.2);
    box(3.6, 0.9, 0.06, BLACK, 0, bd + 4.4, bz - 2.05);                   // compass platform windbreak (aft) placeholder
    // open compass platform: low windbreak rail, no roof
    box(3.4, 0.5, 3.0, GREY, 0, bd + 4.21, bz - 0.4);
    for (const s of [1, -1]) box(0.05, 0.5, 3.0, BLACK, s * 1.7, bd + 4.7, bz - 0.4);
    box(3.4, 0.05, 0.05, BLACK, 0, bd + 4.98, bz - 1.85);
    box(3.4, 0.05, 0.05, BLACK, 0, bd + 4.98, bz + 1.05);
    cylY(0.16, 0.2, 0.7, BLACK, 0, bd + 4.8, bz + 0.6, 8);                // binnacle
    empty('bridge', 0, bd + 5.0, bz);
  }

  // ---------------- tripod foremast ----------------
  { const mz = 20, my0 = FCY, topY = my0 + 15;
    const legF = V(0, my0, mz + 1.4), legAL = V(-1.6, my0, mz - 1.2), legAR = V(1.6, my0, mz - 1.2), top = V(0, topY, mz);
    rod(legF, top, 0.14, GREY); rod(legAL, top, 0.14, GREY); rod(legAR, top, 0.14, GREY);
    cylY(0.09, 0.09, 6, GREY, 0, topY + 3, mz, 8);                        // topmast
    box(1.3, 1.0, 1.1, GREY, 0, topY + 0.6, mz);                          // spotting top
    box(3.2, 0.06, 0.06, BLACK, 0, topY - 3.5, mz);                       // yard
    rod(V(0, topY - 3.5, mz), V(0, topY + 5.2, mz), 0.02, BLACK);         // halyard mast tip
  }

  // ---------------- funnels, searchlight platform ----------------
  const fun = (z) => { cylY(0.8, 0.85, 5, GREY, 0, MDY0 + 2.5, z, 16); cylY(0.83, 0.83, 0.25, BLACK, 0, MDY0 + 4.9, z, 16); };
  fun(2); fun(-9.5);
  box(2.6, 0.1, 1.8, GREY, 0, MDY0 + 2.6, -3.7);                          // searchlight platform between funnels
  for (const s of [1, -1]) rod(V(s * 1.2, MDY0 + 2.6, -3.7), V(s * 1.2, MDY0, -3.7), 0.05, GREY);
  cylY(0.35, 0.4, 0.5, BLACK, 0, MDY0 + 2.9, -3.7, 10);                   // searchlight
  box(4.4, 1.1, 5.4, GREY, 0, MDY0 + 0.55, 2, undefined);                 // fwd boiler-room casing (under funnel 1)
  box(4.2, 1.0, 4.6, GREY, 0, MDY0 + 0.5, -9.5, undefined);               // aft boiler-room casing (under funnel 2)
  // engine-room skylights
  box(1.8, 0.5, 2.4, GREY, 0, MDY0 + 0.25, -4.6);

  // ---------------- 12-pdr AA bandstand & 2-pdr pom-pom ----------------
  { const bz = -15.5, by = MDY0 + 0.9;
    cylY(1.1, 1.2, 0.7, GREY, 0, MDY0 + 0.35, bz, 14);                    // bandstand
    cylY(0.12, 0.16, 0.6, GREY, 0, by + 0.3, bz, 8);
    box(0.4, 0.35, 0.5, BLACK, 0, by + 0.55, bz);
    cylZ(0.05, 0.07, 2.2, BLACK, 0, by + 0.55, bz + 1.2, 8);              // 12-pdr barrel
  }
  { const bz = -19, by = MDY0 + 0.7;
    cylY(0.9, 1.0, 0.5, GREY, 0, MDY0 + 0.25, bz, 12);                    // pom-pom bandstand
    box(0.7, 0.5, 0.7, BLACK, 0, by + 0.25, bz);
    for (const [dx, dy] of [[-0.2, 0.12], [0.2, 0.12], [-0.2, -0.12], [0.2, -0.12]]) cylZ(0.04, 0.045, 1.6, BLACK, dx, by + 0.25 + dy, bz + 0.9, 6);
  }

  // ---------------- boats on davits, amidships ----------------
  const boat = (x, y, z) => {
    const grp = new THREE.Group(); grp.position.set(x, y, z); g.add(grp);
    const pts = []; const N = 10;
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push([Math.sin(t * Math.PI) * 0.9, (t - 0.5) * 6]); }
    for (let i = 0; i < N; i++) { box(0.06, 0.5, 0.32, CANVAS, 0, 0, (pts[i][1] + pts[i + 1][1]) / 2, grp); }
    box(1.7, 0.55, 6.0, GREY, 0, 0, 0, grp);
    box(1.5, 0.3, 5.7, CANVAS, 0, 0.42, 0, grp);
    return grp;
  };
  for (const s of [1, -1]) {
    boat(s * 3.6, MDY0 + 2.3, -12);
    // davits
    for (const dz of [-2.4, 2.4]) { rod(V(s * 1.4, MDY0 + 1.0, -12 + dz), V(s * 1.4, MDY0 + 2.6, -12 + dz), 0.05, GREY); rod(V(s * 1.4, MDY0 + 2.6, -12 + dz), V(s * 3.6, MDY0 + 2.5, -12 + dz), 0.05, GREY); }
  }

  // ---------------- mainmast (pole) ----------------
  { const mz = -13, my0 = MDY0 + 2.6, topY = my0 + 11;
    cylY(0.13, 0.2, topY - my0, GREY, 0, (my0 + topY) / 2, mz, 10);
    box(2.6, 0.05, 0.05, BLACK, 0, topY - 2, mz);
    rod(V(0, topY - 2, mz), V(0, topY + 1.5, mz), 0.02, BLACK);
  }

  // ---------------- "X" gun on a raised deckhouse aft ----------------
  { const dz = -24; box(3.4, 1.5, 5.0, GREY, 0, MDY0 + 0.75, dz); gunMount(dz - 1.2, MDY0 + 1.5, 1.7, 1.7, 1.5, 4.0, 0.1); }

  // ---------------- "Y" gun on the quarterdeck ----------------
  gunMount(-36, deckYf(-36), 1.7, 1.7, 1.5, 4.0, 0.1);

  // ---------------- depth-charge rails & throwers, stern ----------------
  { const y0 = deckYf(-44);
    for (const s of [1, -1]) {
      box(0.5, 0.1, 6.5, BLACK, s * 1.6, y0 + 0.1, -44);
      for (let i = 0; i < 5; i++) { const c = cylY(0.28, 0.28, 0.62, BLACK, s * 1.6, y0 + 0.42, -41.5 - i * 1.15, 12); c.rotation.x = Math.PI / 2; }
      // thrower
      const t = new THREE.Group(); t.position.set(s * 2.6, y0 + 0.3, -38); g.add(t);
      cylY(0.22, 0.26, 0.5, GREY, 0, 0.25, 0, 10, t);
      const c2 = cylY(0.2, 0.24, 0.55, BLACK, 0, 0.6, 0, 10, t); c2.rotation.x = -0.55;
    }
    empty('dc_rail', 0, y0 + 0.2, -44.5);
  }
  // stern fittings
  cylY(0.14, 0.16, 0.4, GREY, 1.2, deckYf(-46) + 0.2, -46, 8);
  cylY(0.14, 0.16, 0.4, GREY, -1.2, deckYf(-46) + 0.2, -46, 8);

  // ---------------- bow fittings ----------------
  box(1.3, 1.2, 2.2, BLACK, 0, FCY + 0.6, 43.5);                          // windlass
  for (const s of [1, -1]) cylY(0.16, 0.18, 0.4, GREY, s * 1.4, FCY + 0.2, 41, 8); // bollards
  for (const s of [1, -1]) box(0.6, 1.0, 0.5, BLACK, s * 1.9, WL, 44.5);  // anchors at the hawse

  // ---------------- pennant number D67 on the hull sides ----------------
  const FONT = {
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '00100', '00100', '00100'],
  };
  const pennantLetter = (ch, size, x, y, z, side, thick = 0.08) => {
    const rows = FONT[ch]; const cell = size / 7;
    for (let r = 0; r < 7; r++) { const row = rows[r]; let c = 0;
      while (c < 5) { if (row[c] === '1') { let e = c; while (e < 5 && row[e] === '1') e++;
        box(thick, cell, (e - c) * cell, BOOT, x, y + (6 - r + 0.5) * cell - size / 2, z - side * ((c + (e - c) / 2) * cell - size * 5 / 14), undefined);
        c = e; } else c++; } }
  };
  { const size = 1.5, letters = ['D', '6', '7'], pitch = size * 1.0;
    for (const s of [1, -1]) {
      const zc = 27, total = pitch * (letters.length - 1);
      letters.forEach((ch, i) => { const lz = zc - s * (i * pitch - total / 2); pennantLetter(ch, size, s * (hw(lz) + 0.04), WL + 1.9, lz, s); });
    }
  }

  g.userData = { length: 95.1, beam: 9.0, waterline: 3.4, kind: 'warship', name: 'HMS Wishart (D67)' };
  const box3 = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
