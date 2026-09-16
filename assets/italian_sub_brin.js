// Regia Marina Brin-class submarine, 1941
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const mat = (hex, rough = 0.85, name = 'metal', side) => { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.05, name }); if (side !== undefined) m.side = side; return m; };
  const GRIGIO = mat(0x6c7570), DECKC = mat(0x4a4f4a), BLACK = mat(0x141517, 0.6), BRASS = mat(0xb08d3e, 0.45);
  const GRIGIO2 = mat(0x6c7570, 0.85, 'metal', DS), DECK2 = mat(0x4a4f4a, 0.9, 'timber', DS);
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
  const plan = (zf, zb, hw, rf, rb, n = 8) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n * Math.PI; pts.push([hw * Math.cos(t), zf - rf + rf * Math.sin(t)]); }
    for (let i = 0; i <= n; i++) { const t = i / n * Math.PI; pts.push([-hw * Math.cos(t), zb + rb - rb * Math.sin(t)]); }
    return pts;
  };

  // ---------------- hull: fuller double-hull body, straight raked bow ----------------
  const L = 72.5, ZB = L / 2, ZS = -L / 2, WL = 4.5;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  // full-bodied midship, tapering only in the last ~12m fwd and ~13m aft; bow taper power
  // kept low so the sides stay slabby, then rakes hard right at the stem for a straight-raked bow.
  const hw = (z) => {
    if (z >= 0) { const t = clamp01((z - 24) / (ZB - 24)); return Math.max(0.05, 3.4 * Math.pow(1 - Math.pow(t, 1.15), 0.42)); }
    const t = clamp01((-z - 22) / (-ZS - 22)); return Math.max(0.05, 3.4 * Math.pow(1 - Math.pow(t, 1.7), 0.6));
  };
  const yBot = (z) => z > 28.5 ? 0.35 + 4.6 * Math.pow((z - 28.5) / (ZB - 28.5), 1.15) : z < -26 ? 0.35 + 4.1 * Math.pow((-26 - z) / (-26 - ZS), 1.3) : 0.35;
  const yDeck = (z) => z > 15 ? 6.9 + 0.5 * Math.pow((z - 15) / (ZB - 15), 2) : z < -14 ? 6.9 - 0.85 * Math.pow((-14 - z) / (-14 - ZS), 1.6) : 6.9;
  // raised casing running the full length, a touch narrower than the hull so a limber-hole
  // shoulder shows along both sides.
  const deckHW = (z) => { const d = z > 10 ? 2.15 - 1.9 * Math.pow((z - 10) / (ZB - 10), 1.4) : z < -10 ? 2.15 - 1.95 * Math.pow((-10 - z) / (-10 - ZS), 1.25) : 2.15; return Math.min(Math.max(d, 0.05), hw(z) * 0.97); };
  const rightSide = (z) => {
    const a = hw(z), yb = yBot(z), yd = yDeck(z), dw = deckHW(z), ym = yb + 0.5 * (yd - yb);
    const pts = [[dw, yd], [a * 0.99, ym + 0.42 * (yd - ym)], [a, ym]];
    const N = 6;
    for (let i = 1; i <= N; i++) { const t = i / N * Math.PI / 2; pts.push([a * Math.cos(t), ym - (ym - yb) * Math.sin(t)]); }
    return pts;
  };
  const xAtY = (pl, y) => {
    for (let i = 0; i < pl.length - 1; i++) { const [x1, y1] = pl[i], [x2, y2] = pl[i + 1]; if (y <= y1 && y >= y2) { const t = y1 === y2 ? 0 : (y1 - y) / (y1 - y2); return x1 + (x2 - x1) * t; } }
    return y > pl[0][1] ? pl[0][0] : pl[pl.length - 1][0];
  };
  const stations = [];
  for (let z = ZS; z < ZS + 10; z += 0.8) stations.push(z);
  for (let z = ZS + 10; z < ZB - 10; z += 1.6) stations.push(z);
  for (let z = ZB - 10; z < ZB; z += 0.8) stations.push(z);
  stations.push(ZB);
  const resample = (poly, N) => {
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
  loft(upR, false, GRIGIO2); loft(upL, false, GRIGIO2);
  loft(loR, false, GRIGIO2); loft(loL, false, GRIGIO2);
  loft(deck, false, DECK2);
  // keel bar
  box(0.55, 0.4, 50, GRIGIO, 0, 0.2, 1);
  // free-flooding limber holes along the casing shoulder (double-hull tell-tale)
  for (let z = -30; z <= 30; z += 1.1) { if (Math.abs(z) < 4) continue; const r = rightSide(z); const y = yDeck(z) - 0.5; const x = xAtY(r, y); box(0.07, 0.16, 0.55, BLACK, x + 0.03, y, z); box(0.07, 0.16, 0.55, BLACK, -x - 0.03, y, z); }
  // deck planking grooves
  for (let z = -32; z <= 34; z += 0.55) { const w = deckHW(z) * 2 - 0.12; if (w < 0.3) continue; box(w, 0.03, 0.06, BLACK, 0, yDeck(z) + 0.005, z); }
  // low bow-to-stern deck rail (single guard rail, thin)
  for (const s of [1, -1]) {
    const pts = []; for (let z = ZS + 4; z <= ZB - 3; z += 3) pts.push(V(s * (deckHW(z) - 0.08), yDeck(z), z));
    for (let i = 0; i < pts.length - 1; i++) rod(pts[i], pts[i + 1], 0.02, BLACK);
    for (const p of pts) box(0.04, 0.55, 0.04, BLACK, p.x, p.y + 0.27, p.z);
  }

  // ---------------- large boxy conning tower ----------------
  const ZT = -3.0, YD = 6.9, YB = 10.6; // tower centre (aft of amidships toward stern a touch), deck, bridge floor
  // stepped fairing skirt onto the casing
  extrudeY(plan(ZT + 4.6, ZT - 4.6, 1.85, 1.5, 1.5, 4), 0.4, GRIGIO, YD - 0.02);
  // main tower body: tall, flat-sided box (rounded ends), two tiers
  extrudeY(plan(ZT + 4.0, ZT - 4.0, 1.65, 1.1, 1.1, 4), 2.6, GRIGIO, YD + 0.38);
  extrudeY(plan(ZT + 3.6, ZT - 3.6, 1.45, 1.05, 1.05, 4), YB - (YD + 3.0), GRIGIO, YD + 3.0);
  // enclosed bridge front: flat windscreen panel across the forward face
  box(2.7, 0.85, 0.14, DECKC, 0, YB + 0.42, ZT + 3.55);
  for (let i = -1; i <= 1; i++) box(0.06, 0.85, 0.18, BLACK, i * 0.95, YB + 0.42, ZT + 3.55);
  // open platform on top with low bulwark
  { const s = new THREE.Shape(); plan(ZT + 3.5, ZT - 3.5, 1.35, 1.0, 1.0, 4).forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z));
    const h = new THREE.Path(); plan(ZT + 3.35, ZT - 3.35, 1.18, 1.0, 1.0, 4).forEach(([x, z], i) => i ? h.lineTo(x, -z) : h.moveTo(x, -z)); s.holes.push(h);
    const o = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.85, bevelEnabled: false }), GRIGIO2); o.rotation.x = -Math.PI / 2; o.position.y = YB - 0.02; g.add(o); }
  extrudeY(plan(ZT + 3.4, ZT - 3.4, 1.3, 1.0, 1.0, 4), 0.08, GRIGIO, YB + 0.83); // platform deck
  cylY(0.22, 0.24, 3.2, GRIGIO, 0, YB + 1.6 + 0.83, ZT + 0.8, 10);  // attack periscope standard
  cylY(0.06, 0.06, 1.5, BLACK, 0, YB + 3.2 + 0.75 + 0.83, ZT + 0.8, 6);
  cylY(0.3, 0.32, 2.4, GRIGIO, 0, YB + 1.2 + 0.83, ZT - 0.7, 10);   // sky periscope standard
  cylY(0.07, 0.07, 1.1, BLACK, 0, YB + 2.4 + 0.55 + 0.83, ZT - 0.7, 6);
  cylY(0.1, 0.1, 1.3, BLACK, 0.9, YB + 0.65 + 0.83, ZT - 1.2, 8);   // small mast / DF loop
  { const o = mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 16), BLACK, 0.9, YB + 1.6, ZT - 1.2); o.rotation.y = Math.PI / 2; }
  empty('bridge', 0, YB + 0.9, ZT + 1.2);

  // twin 13.2 mm Breda mounts flanking the tower, each side on a small sponson
  const bredaFlak = { node: null };
  for (const s of [1, -1]) {
    const f = new THREE.Group(); f.position.set(s * 1.55, YD + 1.7, ZT - 0.4); g.add(f);
    cylY(0.34, 0.4, 0.16, GRIGIO, 0, 0.08, 0, 10, f); // sponson platform
    cylY(0.16, 0.2, 0.55, GRIGIO, 0, 0.42, 0, 8, f);  // pedestal
    box(0.32, 0.22, 0.5, BLACK, 0, 0.78, 0, f);       // mount body
    cylZ(0.035, 0.04, 1.3, BLACK, 0, 0.9, 0.85, 6, f);
    cylZ(0.035, 0.04, 1.3, BLACK, 0, 0.65, 0.85, 6, f); // twin barrels
    if (s === 1) bredaFlak.node = empty('flak', 0, 0.9, 1.5, f);
    else empty('flak_l', 0, 0.9, 1.5, f);
  }

  // ---------------- 100 mm/47 deck gun, forward of the tower ----------------
  { const ZG = 7, d = new THREE.Group(); d.position.set(0, yDeck(ZG), ZG); g.add(d);
    cylY(0.62, 0.68, 0.14, DECKC, 0, 0.07, 0, 14, d); cylY(0.4, 0.46, 0.5, GRIGIO, 0, 0.46, 0, 12, d);
    box(0.9, 0.55, 0.75, GRIGIO, 0, 1.0, 0, d); box(0.36, 0.38, 0.95, BLACK, 0, 1.1, -0.35, d);
    cylZ(0.06, 0.1, 4.0, BLACK, 0, 1.1, 1.95, 10, d); cylZ(0.1, 0.1, 0.9, BLACK, 0, 0.94, 0.65, 8, d);
    cylX(0.3, 0.06, BLACK, 0.55, 1.0, -0.1, 12, d); cylX(0.3, 0.06, BLACK, -0.55, 1.0, -0.1, 12, d);
    box(1.0, 0.05, 0.4, GRIGIO, 0, 0.75, 0.4, d);
    empty('gun', 0, 1.1, 3.95, d); }
  cylY(0.32, 0.32, 0.5, GRIGIO, 1.2, YD + 0.25, 12, 10); cylY(0.32, 0.32, 0.5, GRIGIO, -1.2, YD + 0.25, 12, 10); // ready ammo lockers by the gun

  // ---------------- deck fittings ----------------
  const hatch = (z, r = 0.48) => cylY(r, r, 0.18, DECKC, 0, yDeck(z) + 0.09, z, 12);
  hatch(22); hatch(9, 0.4); hatch(-6, 0.42); hatch(-25, 0.4);
  const bollard = (x, z) => cylY(0.12, 0.14, 0.46, GRIGIO, x, yDeck(z) + 0.23, z, 8);
  bollard(0.6, 30); bollard(-0.6, 30); bollard(0.55, -28); bollard(-0.55, -28); bollard(1.6, 9); bollard(-1.6, 9);
  cylY(0.32, 0.36, 0.5, GRIGIO, 0, yDeck(33) + 0.25, 33, 10); // capstan
  { const o = box(0.14, 1.3, 0.55, GRIGIO, 0, yDeck(35.4) + 0.5, 35.4); o.rotation.x = -0.3; } // stem fitting

  // ---------------- bow/stern planes, single rudder, twin screws ----------------
  box(5.8, 0.16, 1.5, GRIGIO, 0, 3.9, 29.6);
  box(4.4, 0.16, 1.3, GRIGIO, 0, 2.3, -32.4);
  for (const s of [1, -1]) {
    rod(V(s * 0.95, 1.4, -24), V(s * 1.3, 1.55, -32.6), 0.12, BLACK);                      // shaft
    rod(V(s * 1.3, 1.55, -30.6), V(s * 1.65, yBot(-30.6) + 0.3, -30.6), 0.09, GRIGIO);      // A-bracket
    rod(V(s * 1.3, 1.55, -30.6), V(s * 0.55, yBot(-30.6) + 0.3, -30.6), 0.09, GRIGIO);
    const p = new THREE.Group(); p.position.set(s * 1.3, 1.55, -32.9); g.add(p);
    cylZ(0.15, 0.17, 0.5, BRASS, 0, 0, 0, 8, p);
    for (let i = 0; i < 3; i++) { const b = box(0.34, 0.8, 0.06, BRASS, 0, 0, 0, p); b.rotation.z = i * Math.PI * 2 / 3; b.rotation.y = 0.6; b.position.set(-Math.sin(b.rotation.z) * 0.48, Math.cos(b.rotation.z) * 0.48, 0); }
  }
  box(0.12, 2.4, 1.5, GRIGIO, 0, 2.9, -34.2); // single centreline rudder

  g.userData = { length: 72.5, beam: 6.9, waterline: 4.5, kind: 'submarine', name: 'Brin-class submarine' };
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
