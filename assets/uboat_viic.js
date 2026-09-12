// Type VIIC U-boat, 1942 — candidate C: lofted cross-section hull
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const mat = (hex, rough = 0.85, name = 'metal', side) => { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.05, name }); if (side !== undefined) m.side = side; return m; };
  const HELL = mat(0x707881), DUNK = mat(0x41464c), BLACK = mat(0x141517, 0.6), BRASS = mat(0xb08d3e, 0.45);
  const HELL2 = mat(0x707881, 0.85, 'metal', DS), DUNK2 = mat(0x41464c, 0.85, 'metal', DS), DECK = mat(0x41464c, 0.9, 'timber', DS);
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
  const extrudeY = (pts, h, m, y0, parent = g) => {
    const s = new THREE.Shape(); pts.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z));
    const o = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }), m);
    o.rotation.x = -Math.PI / 2; o.position.y = y0; parent.add(o); return o;
  };
  const plan = (zf, zb, hw, rf, rb, n = 8) => { // rounded-end plan outline, z forward
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n * Math.PI; pts.push([hw * Math.cos(t), zf - rf + rf * Math.sin(t)]); }
    for (let i = 0; i <= n; i++) { const t = i / n * Math.PI; pts.push([-hw * Math.cos(t), zb + rb - rb * Math.sin(t)]); }
    return pts;
  };

  // ---------------- hull ----------------
  const L = 67.1, ZB = L / 2, ZS = -L / 2, WL = 4.8;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const hw = (z) => {
    if (z >= 0) { const t = clamp01((z - 13) / (ZB - 13)); return Math.max(0.05, 2.35 * Math.pow(1 - Math.pow(t, 2.3), 0.55)); }
    const t = clamp01((-z - 13) / (-ZS - 13)); return Math.max(0.05, 2.35 * Math.pow(1 - Math.pow(t, 1.8), 0.7));
  };
  const yBot = (z) => z > 20 ? 0.35 + 4.0 * Math.pow((z - 20) / (ZB - 20), 2.2) : z < -19 ? 0.35 + 3.9 * Math.pow((-19 - z) / (-19 - ZS), 1.35) : 0.35;
  const yDeck = (z) => z > 8 ? 6.3 + 0.7 * Math.pow((z - 8) / (ZB - 8), 2) : z < -8 ? 6.3 - 0.9 * Math.pow((-8 - z) / (-8 - ZS), 1.6) : 6.3;
  const deckHW = (z) => { const d = z > 6 ? 1.9 - 1.55 * Math.pow((z - 6) / (ZB - 6), 1.3) : z < -6 ? 1.9 - 1.6 * Math.pow((-6 - z) / (-6 - ZS), 1.2) : 1.9; return Math.min(d, hw(z) * 0.98); };
  const rightSide = (z) => { // polyline from deck edge down to keel, x >= 0
    const a = hw(z), yb = yBot(z), yd = yDeck(z), dw = deckHW(z), ym = yb + 0.48 * (yd - yb);
    const pts = [[dw, yd], [a * 0.99, ym + 0.4 * (yd - ym)], [a, ym]];
    const N = 6;
    for (let i = 1; i <= N; i++) { const t = i / N * Math.PI / 2; pts.push([a * Math.cos(t), ym - (ym - yb) * Math.sin(t)]); }
    return pts;
  };
  const xAtY = (pl, y) => { // pl descends in y
    for (let i = 0; i < pl.length - 1; i++) { const [x1, y1] = pl[i], [x2, y2] = pl[i + 1]; if (y <= y1 && y >= y2) { const t = y1 === y2 ? 0 : (y1 - y) / (y1 - y2); return x1 + (x2 - x1) * t; } }
    return y > pl[0][1] ? pl[0][0] : pl[pl.length - 1][0];
  };
  const stations = [];
  for (let z = ZS; z < ZS + 9; z += 0.75) stations.push(z);
  for (let z = ZS + 9; z < ZB - 9; z += 1.5) stations.push(z);
  for (let z = ZB - 9; z < ZB; z += 0.75) stations.push(z);
  stations.push(ZB);
  const resample = (poly, N) => { // N points equally spaced along a polyline
    const cum = [0]; for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const total = cum[cum.length - 1], out = [];
    for (let k = 0; k < N; k++) { const d = total * k / (N - 1); let i = 0; while (i < cum.length - 2 && cum[i + 1] < d) i++; const seg = cum[i + 1] - cum[i]; const t = seg > 1e-9 ? (d - cum[i]) / seg : 0; out.push([poly[i][0] + (poly[i + 1][0] - poly[i][0]) * t, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * t]); }
    return out;
  };
  const upR = [], upL = [], loR = [], loL = [], deck = [];
  for (const z of stations) {
    const r = rightSide(z), yd = yDeck(z), wl = Math.max(WL, yBot(z) + 0.03);
    const up = [], lo = []; let done = false;
    for (const p of r) { if (!done) { if (p[1] >= wl) up.push(p); else { const q = [xAtY(r, wl), wl]; up.push(q); lo.push(q); lo.push(p); done = true; } } else lo.push(p); }
    const u = resample(up, 4), l = resample(lo, 9);
    upR.push(u.map(([x, y]) => V(x, y, z))); upL.push(u.map(([x, y]) => V(-x, y, z)));
    loR.push(l.map(([x, y]) => V(x, y, z))); loL.push(l.map(([x, y]) => V(-x, y, z)));
    deck.push([V(-r[0][0], yd, z), V(0, yd, z), V(r[0][0], yd, z)]);
  }
  loft(upR, false, HELL2); loft(upL, false, HELL2);
  loft(loR, false, DUNK2); loft(loL, false, DUNK2);
  loft(deck, false, DECK);
  // saddle tanks
  const tankR = [], tankL = [];
  for (let z = -21; z <= 19.001; z += 1) {
    const r = rightSide(z); const b = 0.78 * Math.pow(Math.sin(Math.PI * (z + 21) / 40), 0.7);
    const s = [];
    for (let k = 0; k <= 7; k++) { const t = k / 7, y = 1.3 + 4.0 * t; s.push([xAtY(r, y) + 0.01 + b * Math.pow(Math.sin(Math.PI * t), 0.8), y]); }
    tankR.push(s.map(([x, y]) => V(x, y, z))); tankL.push(s.map(([x, y]) => V(-x, y, z)));
  }
  loft(tankR, false, DUNK2); loft(tankL, false, DUNK2);
  // keel bar
  box(0.5, 0.4, 46, DUNK, 0, 0.2, 1);
  // free-flooding slots along the casing sides
  for (let z = -27; z <= 27; z += 1.2) { if (Math.abs(z - 1.5) < 3.2) continue; const r = rightSide(z); const y = yDeck(z) - 0.55; const x = xAtY(r, y); box(0.06, 0.14, 0.6, BLACK, x + 0.03, y, z); box(0.06, 0.14, 0.6, BLACK, -x - 0.03, y, z); }
  // deck slats (transverse grooves)
  for (let z = -29; z <= 31; z += 0.5) { const w = deckHW(z) * 2 - 0.1; if (w < 0.3) continue; box(w, 0.03, 0.06, BLACK, 0, yDeck(z) + 0.005, z); }

  // ---------------- conning tower ----------------
  const ZT = 1.5, YD = 6.3, YB = 9.2; // tower centre, deck, bridge floor
  extrudeY(plan(ZT + 3.6, ZT - 4.2, 1.5, 1.5, 1.4), 0.5, HELL, YD - 0.05);          // fairing skirt
  extrudeY(plan(ZT + 2.9, ZT - 2.9, 1.15, 1.15, 1.1), YB - YD, HELL, YD);            // tower
  extrudeY(plan(ZT + 3.05, ZT - 3.0, 1.3, 1.3, 1.25), 0.1, HELL, YB - 0.35);         // spray deflector ledge
  { // bulwark (hollow, open top)
    const s = new THREE.Shape(); plan(ZT + 2.95, ZT - 2.95, 1.2, 1.2, 1.15).forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z));
    const h = new THREE.Path(); plan(ZT + 2.8, ZT - 2.8, 1.03, 1.03, 1.0).forEach(([x, z], i) => i ? h.lineTo(x, -z) : h.moveTo(x, -z)); s.holes.push(h);
    const o = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 1.05, bevelEnabled: false }), HELL2); o.rotation.x = -Math.PI / 2; o.position.y = YB - 0.02; g.add(o);
  }
  cylY(0.22, 0.24, 3.4, HELL, 0, YB + 1.7, ZT + 0.9, 10);   // attack periscope standard
  cylY(0.06, 0.06, 1.6, BLACK, 0, YB + 3.4 + 0.8, ZT + 0.9, 6);
  cylY(0.3, 0.32, 2.6, HELL, 0, YB + 1.3, ZT - 0.5, 10);    // sky periscope standard
  cylY(0.07, 0.07, 1.2, BLACK, 0, YB + 2.6 + 0.6, ZT - 0.5, 6);
  cylY(0.11, 0.13, 1.1, BLACK, 0, YB + 0.55, ZT + 2.1, 8);   // UZO pedestal
  cylY(0.03, 0.03, 1.5, BLACK, 0.75, YB + 0.75, ZT + 1.2, 6); // DF loop mast
  { const o = mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 16), BLACK, 0.75, YB + 1.85, ZT + 1.2); o.rotation.y = Math.PI / 2; }
  // Wintergarten
  extrudeY(plan(ZT - 2.6, ZT - 6.2, 1.3, 0.6, 1.3), 0.22, HELL, YB - 0.72);
  { const o = mesh(new THREE.TorusGeometry(1.22, 0.025, 5, 14, Math.PI), BLACK, 0, YB + 0.45, ZT - 4.9); o.rotation.x = -Math.PI / 2; }
  for (let i = 0; i <= 6; i++) { const t = i / 6 * Math.PI; rod(V(1.22 * Math.cos(t), YB - 0.5, ZT - 4.9 - 1.22 * Math.sin(t)), V(1.22 * Math.cos(t), YB + 0.45, ZT - 4.9 - 1.22 * Math.sin(t)), 0.02, BLACK); }
  rod(V(1.25, YB + 0.45, ZT - 2.7), V(1.25, YB + 0.45, ZT - 4.9), 0.02, BLACK); rod(V(-1.25, YB + 0.45, ZT - 2.7), V(-1.25, YB + 0.45, ZT - 4.9), 0.02, BLACK);
  rod(V(0.9, YD, ZT - 5.2), V(0.9, YB - 0.7, ZT - 5.6), 0.05, HELL); rod(V(-0.9, YD, ZT - 5.2), V(-0.9, YB - 0.7, ZT - 5.6), 0.05, HELL);
  empty('bridge', 0, YB + 0.4, ZT + 1.0);
  // 2 cm Flak 30 on the Wintergarten
  { const f = new THREE.Group(); f.position.set(0, YB - 0.5, ZT - 4.6); g.add(f);
    cylY(0.2, 0.26, 0.75, BLACK, 0, 0.37, 0, 8, f); box(0.5, 0.35, 0.7, BLACK, 0, 0.85, 0, f);
    const b = cylZ(0.035, 0.045, 1.6, BLACK, 0, 1.0, -0.9, 6, f); b.rotation.x = Math.PI / 2 + 0.35; b.position.z = -0.8; b.position.y = 1.2;
    box(0.12, 0.3, 0.2, BLACK, 0, 1.1, 0.1, f); cylX(0.02, 0.9, BLACK, 0, 0.95, -0.2, 6, f);
    empty('flak', 0, 1.0, 0, f); }

  // ---------------- 8.8 cm SK C/35 deck gun ----------------
  { const ZG = 12.5, d = new THREE.Group(); d.position.set(0, yDeck(ZG), ZG); g.add(d);
    cylY(0.55, 0.6, 0.12, DUNK, 0, 0.06, 0, 14, d); cylY(0.36, 0.42, 0.85, HELL, 0, 0.54, 0, 12, d);
    box(0.8, 0.5, 0.7, HELL, 0, 1.2, 0, d); box(0.34, 0.36, 0.9, BLACK, 0, 1.3, -0.35, d);
    cylZ(0.055, 0.09, 3.7, BLACK, 0, 1.3, 1.85, 10, d); cylZ(0.09, 0.09, 0.9, BLACK, 0, 1.12, 0.6, 8, d);
    cylX(0.28, 0.06, BLACK, 0.5, 1.2, -0.1, 12, d); cylX(0.28, 0.06, BLACK, -0.5, 1.2, -0.1, 12, d);
    box(0.9, 0.05, 0.35, HELL, 0, 0.95, 0.4, d);
    empty('gun', 0, 1.3, 3.7, d); }
  cylY(0.32, 0.32, 0.5, DUNK, 1.1, YD + 0.25, 9.5, 10); cylY(0.32, 0.32, 0.5, DUNK, -1.1, YD + 0.25, 9.5, 10); // ready-use ammo lockers

  // ---------------- deck fittings ----------------
  const hatch = (z, r = 0.45) => cylY(r, r, 0.18, DUNK, 0, yDeck(z) + 0.09, z, 12);
  hatch(20); hatch(7.5, 0.4); hatch(-12); hatch(-23, 0.38);
  const bollard = (x, z) => cylY(0.11, 0.13, 0.45, DUNK, x, yDeck(z) + 0.22, z, 8);
  bollard(0.55, 27); bollard(-0.55, 27); bollard(0.5, -25); bollard(-0.5, -25); bollard(1.5, 8); bollard(-1.5, 8);
  cylY(0.3, 0.34, 0.5, DUNK, 0, yDeck(30) + 0.25, 30, 10); // capstan
  // net cutter at the stem
  { const o = box(0.12, 1.4, 0.5, HELL, 0, yDeck(32.6) + 0.55, 32.6); o.rotation.x = -0.35; }
  // jumping wires
  rod(V(0, yDeck(32.6) + 0.15, 32.9), V(0, YB + 1.05, ZT + 2.9), 0.03, BLACK);
  rod(V(0, YB + 1.05, ZT - 2.9), V(0, yDeck(-32) + 0.2, -32.3), 0.03, BLACK);
  rod(V(0, yDeck(24), 24), V(0, yDeck(24) + 1.4, 24), 0.03, BLACK); rod(V(0, yDeck(-22), -22), V(0, yDeck(-22) + 1.2, -22), 0.03, BLACK);

  // ---------------- bow planes, stern gear ----------------
  box(5.4, 0.16, 1.4, DUNK, 0, 3.7, 27.5);
  box(5.6, 0.16, 1.6, DUNK, 0, 2.1, -30.6);
  for (const s of [1, -1]) {
    rod(V(s * 1.0, 1.45, -22), V(s * 1.35, 1.65, -30.2), 0.11, BLACK);                   // shaft
    rod(V(s * 1.35, 1.65, -28.2), V(s * 1.7, yBot(-28.2) + 0.3, -28.2), 0.08, DUNK);     // A-bracket
    rod(V(s * 1.35, 1.65, -28.2), V(s * 0.6, yBot(-28.2) + 0.3, -28.2), 0.08, DUNK);
    const p = new THREE.Group(); p.position.set(s * 1.35, 1.65, -30.5); g.add(p);
    cylZ(0.14, 0.16, 0.5, BRASS, 0, 0, 0, 8, p);
    for (let i = 0; i < 3; i++) { const b = box(0.32, 0.75, 0.06, BRASS, 0, 0, 0, p); b.rotation.z = i * Math.PI * 2 / 3; b.rotation.y = 0.6; b.position.set(-Math.sin(b.rotation.z) * 0.45, Math.cos(b.rotation.z) * 0.45, 0); }
    box(0.12, 2.6, 1.3, DUNK, s * 1.35, 3.0, -32.0);                                   // twin rudders
  }

  g.userData = { length: 67.1, beam: 6.2, waterline: 4.8, kind: 'submarine', name: 'Type VIIC U-boat' };
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
