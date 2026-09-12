// Consolidated Catalina Mk I flying boat, 202 Squadron RAF, Gibraltar 1942 (Z2147, AX-L). Lofted ring skins.
// Hull, wing, tail, nacelles, blisters and floats are hand-built BufferGeometry lofts between
// cross-section rings; paint is assigned per face from the face centroid/normal so the
// camouflage/white demarcation and the disruptive pattern are geometry, not texture.
// +Z = bow. Metres. Length 19.46, span 31.70.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const mat = (color, name, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: rough === undefined ? 0.85 : rough, metalness: metal === undefined ? 0.1 : metal, side: DS }, extra || {}));
    m.name = name || 'metal';
    return m;
  };
  const EDSG = mat(0x4b5057);                 // Extra Dark Sea Grey
  const DSG  = mat(0x4d5a4c);                 // Dark Slate Grey
  const WHT  = mat(0xeeeeea);                 // Coastal White
  const GLS  = mat(0x2b3d4a, 'glass', 0.15, 0.2, { transparent: true, opacity: 0.7 });
  const BLK  = mat(0x141517, 'metal', 0.7, 0.3);
  const ALU  = mat(0xc6c8c7, 'metal', 0.45, 0.6);
  const DKG  = mat(0x4b5057, "metal", 0.7, 0.2);   // Extra Dark Sea Grey used for frames, hinge lines, depth charges
  const RED  = mat(0xa02a30), BLU = mat(0x1f3468), YEL = mat(0xd8b43c), MSG = mat(0x8e949a);
  const M = [EDSG, DSG, WHT, GLS, BLK, ALU, DKG, BLU, RED];
  const I_EDSG = 0, I_DSG = 1, I_WHT = 2, I_GLS = 3, I_BLK = 4, I_ALU = 5, I_DKG = 6;

  // ---------- generic helpers -------------------------------------------------
  const add = (mesh, parent) => { (parent || g).add(mesh); return mesh; };
  const box = (w, h, d, m, x, y, z, parent) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return add(b, parent);
  };
  // Loft: rings = [[x,y,z]...] (equal counts). matFn(cx,cy,cz,nx,ny,nz) -> index into M.
  function loft(rings, matFn, opts) {
    opts = opts || {};
    const closed = opts.closed !== false;
    const N = rings[0].length;
    const buckets = M.map(() => []);
    const tri = (a, b, c) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return; nx /= l; ny /= l; nz /= l;
      const mi = matFn ? matFn((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3, nx, ny, nz) : 0;
      buckets[mi].push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    };
    const segs = closed ? N : N - 1;
    for (let i = 0; i < rings.length - 1; i++) {
      const r0 = rings[i], r1 = rings[i + 1];
      for (let j = 0; j < segs; j++) {
        const k = (j + 1) % N;
        tri(r0[j], r1[k], r0[k]); tri(r0[j], r1[j], r1[k]);
      }
    }
    const cap = (r, flip) => {
      const c = [0, 0, 0]; r.forEach((p) => { c[0] += p[0] / r.length; c[1] += p[1] / r.length; c[2] += p[2] / r.length; });
      for (let j = 0; j < N; j++) { const k = (j + 1) % N; if (flip) tri(c, r[k], r[j]); else tri(c, r[j], r[k]); }
    };
    if (opts.capStart) cap(rings[0], false);
    if (opts.capEnd) cap(rings[rings.length - 1], true);
    let total = 0; buckets.forEach((b) => { total += b.length; });
    const arr = new Float32Array(total);
    const geo = new THREE.BufferGeometry();
    let off = 0;
    buckets.forEach((b, i) => { if (!b.length) return; arr.set(b, off); geo.addGroup(off / 3, b.length / 3, i); off += b.length; });
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, M);
  }
  const strut = (p0, p1, r, m, flat, parent) => {
    const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
    const d = b.clone().sub(a), len = d.length();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m);
    c.position.copy(a).addScaledVector(d, 0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    if (flat) c.scale.set(flat, 1, 1);
    return add(c, parent);
  };
  const lerpT = (tab, z, col) => {  // tab sorted by descending z, col index of value
    if (z >= tab[0][0]) return tab[0][col];
    for (let i = 0; i < tab.length - 1; i++) {
      const a = tab[i], b = tab[i + 1];
      if (z <= a[0] && z >= b[0]) { const t = (a[0] - z) / Math.max(1e-6, a[0] - b[0]); return a[col] + (b[col] - a[col]) * t; }
    }
    return tab[tab.length - 1][col];
  };
  const inPoly = (px, py, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  };
  // NACA-ish thickness (chord units) and camber
  const thick = (u, T) => 5 * T * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1015 * u * u * u * u);
  const camber = (u, mm) => 4 * mm * u * (1 - u);
  const US = [0, 0.01, 0.03, 0.07, 0.12, 0.2, 0.3, 0.42, 0.55, 0.7, 0.85, 1.0];

  // ---------- camouflage pattern (RAF A-scheme style patches) ------------------
  // Dark Slate Grey patches (index 1) over an Extra Dark Sea Grey base (index 0); coordinates are
  // (spanwise x in metres, chord fraction 0=LE..1=TE). Small sinusoidal wobble = wavy demarcation.
  const PATCH = [
    [[-15.9, -0.1], [-12.2, -0.1], [-13.4, 0.55], [-15.9, 0.72]],
    [[-11.2, 0.3], [-8.2, 0.05], [-6.6, 0.45], [-8.6, 1.1], [-11.6, 1.1]],
    [[-4.6, -0.1], [-1.4, -0.1], [-2.4, 0.62], [-5.1, 0.5]],
    [[0.4, 0.28], [3.1, 0.48], [2.6, 1.1], [-1.1, 1.1]],
    [[4.4, -0.1], [7.6, -0.1], [8.6, 0.42], [6.0, 0.68], [3.9, 0.4]],
    [[9.4, 0.5], [12.4, 0.18], [13.6, 0.62], [11.0, 1.1], [8.9, 1.1]],
    [[13.0, -0.1], [15.9, -0.1], [15.9, 0.38], [14.0, 0.3]],
  ];
  const camo = (x, cf) => {
    const xx = x + 0.22 * Math.sin(cf * 9.0 + x), cc = cf + 0.03 * Math.sin(x * 3.1);
    for (const p of PATCH) if (inPoly(xx, cc, p)) return I_DSG;
    return I_EDSG;
  };
  // hull deck bands with diagonal edges
  const deckCamo = (z, x) => {
    const u = z + 0.7 * x + 0.15 * Math.sin(z * 2.0);
    const bands = [8.3, 6.6, 4.3, 2.0, -0.5, -3.1, -5.6, -7.9];
    let i = 0; for (const b of bands) if (u < b) i++;
    return i % 2 ? I_DSG : I_EDSG;
  };

  // ---------- HULL ---------------------------------------------------------------
  // station table: z, keel y, chine y, chine half-width, deck y
  const HT = [
    [9.73, 1.55, 1.85, 0.18, 2.30], [9.45, 1.22, 1.62, 0.62, 2.42], [8.9, 0.80, 1.28, 1.05, 2.55],
    [8.1, 0.44, 1.02, 1.30, 2.66], [7.1, 0.20, 0.86, 1.44, 2.80], [6.0, 0.08, 0.76, 1.50, 2.88],
    [4.6, 0.0, 0.70, 1.52, 2.92], [2.0, 0.0, 0.70, 1.52, 2.92], [0.70, 0.0, 0.70, 1.52, 2.92],
    [0.69, 0.32, 0.92, 1.50, 2.92], [-1.0, 0.42, 1.00, 1.45, 2.90], [-3.0, 0.60, 1.15, 1.35, 2.85],
    [-5.0, 0.85, 1.32, 1.15, 2.75], [-5.80, 1.00, 1.42, 1.00, 2.70], [-5.81, 1.25, 1.55, 0.90, 2.70],
    [-7.0, 1.50, 1.75, 0.70, 2.70], [-8.3, 1.85, 2.02, 0.45, 2.70], [-9.3, 2.20, 2.32, 0.14, 2.65],
  ];
  const hullAt = (z) => {
    const keel = lerpT(HT, z, 1), chine = lerpT(HT, z, 2), hw = lerpT(HT, z, 3), deck = lerpT(HT, z, 4);
    const sideTop = Math.max(chine + 0.05, deck - 0.42);
    return { keel, chine, hw, deck, sideTop };
  };
  const hullRing = (z) => {
    const s = hullAt(z), pts = [[0, s.keel, z]];
    const right = [[s.hw, s.chine, z], [s.hw, s.sideTop, z]];
    const ah = s.deck - s.sideTop;
    for (let a = 15; a < 90; a += 15) { const t = a * Math.PI / 180; right.push([s.hw * Math.cos(t), s.sideTop + ah * Math.sin(t), z]); }
    pts.push(...right, [0, s.deck, z]);
    for (let i = right.length - 1; i >= 0; i--) pts.push([-right[i][0], right[i][1], z]);
    return pts;
  };
  const hullZ = [];
  for (let z = 9.73; z > -9.3; z -= 0.3) hullZ.push(z);
  HT.forEach((r) => hullZ.push(r[0]));
  hullZ.sort((a, b) => b - a);
  const hullRings = hullZ.filter((z, i, a) => i === 0 || Math.abs(z - a[i - 1]) > 1e-4).map(hullRing);
  const hullMat = (x, y, z, nx, ny, nz) => {
    const s = hullAt(z);
    const thr = s.deck - 0.28 + 0.09 * Math.sin(z * 1.1 + 0.5);
    if (ny > 0.25 && y > thr) return deckCamo(z, x);
    return I_WHT;
  };
  add(loft(hullRings, hullMat, { capStart: true, capEnd: true }));

  // ---------- WING ---------------------------------------------------------------
  const W = {
    rootC: 4.9, rootLE: 4.4, tipC: 2.5, tipLE: 4.0, xIn: 6.4, xTip: 15.0, xEnd: 15.85,
    yRoot: 4.25, yTip: 4.5, tRoot: 0.85, tTip: 0.34, m: 0.03,
  };
  const wingSec = (x) => {
    const ax = Math.abs(x);
    let c, le, y, t;
    if (ax <= W.xIn) { c = W.rootC; le = W.rootLE; y = W.yRoot; t = W.tRoot; }
    else {
      const u = Math.min(1, (ax - W.xIn) / (W.xTip - W.xIn));
      c = W.rootC + (W.tipC - W.rootC) * u; le = W.rootLE + (W.tipLE - W.rootLE) * u;
      y = W.yRoot + (W.yTip - W.yRoot) * u; t = W.tRoot + (W.tTip - W.tRoot) * u;
      if (ax > W.xTip) {
        const v = Math.min(1, (ax - W.xTip) / (W.xEnd - W.xTip));
        const f = Math.sqrt(Math.max(0, 1 - v * v));
        const mid = le - c / 2;
        c = c * f; t = t * f; le = mid + c / 2;
      }
    }
    return { c, le, y, t };
  };
  const wingRing = (x) => {
    const s = wingSec(x), pts = [];
    const T = s.c > 1e-3 ? s.t / s.c : 0.1;
    const P = (u, sgn) => [x, s.y + (camber(u, W.m) + sgn * thick(u, T)) * s.c, s.le - u * s.c];
    US.forEach((u) => pts.push(P(u, 1)));
    for (let i = US.length - 2; i > 0; i--) pts.push(P(US[i], -1));
    return pts;
  };
  const wingUpperY = (x, z) => { const s = wingSec(x); const u = Math.min(1, Math.max(0, (s.le - z) / s.c)); return s.y + (camber(u, W.m) + thick(u, s.t / s.c)) * s.c; };
  const wingLowerY = (x, z) => { const s = wingSec(x); const u = Math.min(1, Math.max(0, (s.le - z) / s.c)); return s.y + (camber(u, W.m) - thick(u, s.t / s.c)) * s.c; };
  const wingX = [];
  for (let x = -15.85; x <= 15.851; x += 0.35) wingX.push(x);
  [-15.6, -15.3, -15.0, -6.4, 6.4, 15.0, 15.3, 15.6, 15.85].forEach((x) => wingX.push(x));
  wingX.sort((a, b) => a - b);
  const wingRings = wingX.filter((x, i, a) => i === 0 || Math.abs(x - a[i - 1]) > 1e-4).map(wingRing);
  const wingMat = (x, y, z, nx, ny, nz) => {
    if (ny > 0.12) { const s = wingSec(x); return camo(x, (s.le - z) / Math.max(0.2, s.c)); }
    return I_WHT;
  };
  add(loft(wingRings, wingMat));
  // aileron hinge lines (outer panels)
  [-1, 1].forEach((sg) => {
    for (let x = 8.2; x < 14.6; x += 0.4) {
      const s = wingSec(x * sg); const z = s.le - 0.78 * s.c;
      box(0.36, 0.015, 0.04, DKG, x * sg, wingUpperY(x * sg, z) + 0.005, z);
    }
  });

  // ---------- PYLON --------------------------------------------------------------
  const pylonRing = (y, zf, zr, wmax) => {
    const c = zf - zr, pts = [];
    const side = (u) => wmax * thick(u, 0.2) / thick(0.3, 0.2);
    const uu = [0, 0.02, 0.06, 0.12, 0.2, 0.3, 0.45, 0.6, 0.78, 0.92, 1.0];
    uu.forEach((u) => pts.push([side(u), y, zf - u * c]));
    for (let i = uu.length - 2; i > 0; i--) pts.push([-side(uu[i]), y, zf - uu[i] * c]);
    return pts;
  };
  add(loft([pylonRing(2.55, 5.05, -0.45, 0.58), pylonRing(3.2, 4.85, -0.5, 0.56), pylonRing(3.7, 4.55, -0.55, 0.5), pylonRing(4.15, 4.3, -0.6, 0.42)],
    () => I_WHT));
  // flight engineer windows in the pylon
  [-1, 1].forEach((sg) => {
    box(0.03, 0.32, 0.4, GLS, sg * 0.5, 3.45, 2.6);
    box(0.03, 0.32, 0.4, GLS, sg * 0.5, 3.45, 1.9);
  });

  // ---------- WING STRUTS --------------------------------------------------------
  [-1, 1].forEach((sg) => {
    const hf = [sg * 1.5, 1.05, 3.1], hr = [sg * 1.5, 1.05, 0.9];
    const wf = [sg * 6.3, wingLowerY(6.3, 3.3) + 0.05, 3.3], wr = [sg * 6.3, wingLowerY(6.3, 1.0) + 0.05, 1.0];
    strut(hf, wf, 0.09, WHT, 0.5); strut(hr, wr, 0.09, WHT, 0.5);
    const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    strut(mid(hf, wf, 0.5), mid(hr, wr, 0.5), 0.04, WHT);
    strut(mid(hf, wf, 0.3), mid(hr, wr, 0.7), 0.035, WHT);
    strut(mid(hf, wf, 0.7), mid(hr, wr, 0.3), 0.035, WHT);
  });

  // ---------- ENGINES + PROPS ----------------------------------------------------
  const EY = 4.28;
  [-3.3, 3.3].forEach((ex) => {
    const ell = (z, rx, ry) => { const p = []; for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2; p.push([ex + rx * Math.cos(t), EY + ry * Math.sin(t), z]); } return p; };
    const rings = [ell(5.95, 0.64, 0.64), ell(5.92, 0.70, 0.70), ell(4.95, 0.70, 0.70), ell(4.6, 0.66, 0.66), ell(4.0, 0.6, 0.66),
      ell(3.2, 0.55, 0.62), ell(2.2, 0.45, 0.52), ell(1.2, 0.22, 0.3), ell(0.6, 0.05, 0.08)];
    const nm = (x, y, z, nx, ny, nz) => {
      if (z > 4.55) return I_EDSG;
      if (ny > 0.15) { const s = wingSec(x); return camo(x, (s.le - z) / s.c); }
      return I_WHT;
    };
    add(loft(rings, nm, { capStart: true }));
    // engine face: crankcase + 7 front-row cylinders
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 24), BLK);
    face.rotation.x = Math.PI / 2; face.position.set(ex, EY, 5.72); add(face);
    for (let i = 0; i < 7; i++) {
      const t = i / 7 * Math.PI * 2 + Math.PI / 2;
      const cyl = box(0.2, 0.26, 0.22, DKG, ex + 0.38 * Math.cos(t), EY + 0.38 * Math.sin(t), 5.82);
      cyl.rotation.z = t - Math.PI / 2;
    }
    const cc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16), DKG);
    cc.rotation.x = Math.PI / 2; cc.position.set(ex, EY, 5.85); add(cc);
    // exhaust stub, outboard side under the nacelle
    const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), BLK);
    exh.rotation.x = Math.PI / 2; exh.position.set(ex + Math.sign(ex) * 0.45, EY - 0.55, 4.2); add(exh);
    // propeller
    const prop = new THREE.Group(); prop.name = 'prop'; prop.position.set(ex, EY, 6.12);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.34, 12), ALU);
    hub.rotation.x = Math.PI / 2; prop.add(hub);
    const bladeShape = (r0, r1, tip) => {
      const s = new THREE.Shape();
      const w = (r) => 0.09 + 0.06 * Math.sin(Math.min(1, (r - 0.15) / 1.0) * Math.PI / 2) - (r > 1.45 ? (r - 1.45) * 0.12 : 0);
      s.moveTo(-w(r0), r0); s.lineTo(w(r0), r0); s.lineTo(w(r1), r1);
      if (tip) s.quadraticCurveTo(0, r1 + 0.09, -w(r1), r1); else s.lineTo(-w(r1), r1);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 4 });
      geo.translate(0, 0, -0.025);
      return geo;
    };
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI * 2 / 3;
      const bl = new THREE.Mesh(bladeShape(0.14, 1.70, false), BLK); bl.rotation.y = 0.45;
      const tp = new THREE.Mesh(bladeShape(1.70, 1.75, true), YEL); tp.rotation.y = 0.45;
      arm.add(bl, tp); prop.add(arm);
    }
    add(prop);
  });

  // ---------- TAIL ---------------------------------------------------------------
  // fin: rings at y levels, symmetric airfoil in (x,z)
  const finSec = (y) => {  // y from 2.5 (root) to 5.95 (top)
    const u = (y - 2.5) / 3.45;
    let le = -5.6 + (-8.2 + 5.6) * u, te = -9.73 + (-9.45 + 9.73) * u, t = 0.36 + (0.12 - 0.36) * u;
    if (u > 0.9) { const v = (u - 0.9) / 0.1, f = Math.sqrt(Math.max(0, 1 - v * v)); const mid = (le + te) / 2; const c = (le - te) * f; le = mid + c / 2; te = mid - c / 2; t *= f; }
    return { le, te, t };
  };
  const finRing = (y) => {
    const s = finSec(y), c = Math.max(1e-3, s.le - s.te), pts = [];
    const P = (u, sgn) => [sgn * thick(u, s.t / c) * c, y, s.le - u * c];
    US.forEach((u) => pts.push(P(u, 1)));
    for (let i = US.length - 2; i > 0; i--) pts.push(P(US[i], -1));
    return pts;
  };
  const finY = []; for (let y = 2.5; y <= 5.95; y += 0.25) finY.push(y); finY.push(5.6, 5.75, 5.85, 5.92, 5.95); finY.sort((a, b) => a - b);
  const finCamo = (z, y) => (((z + 5.6) * 1.3 + (y - 2.5) * 0.9 + 0.3 * Math.sin(y * 3)) % 2.2 + 2.2) % 2.2 < 1.0 ? I_DSG : I_EDSG;
  add(loft(finY.filter((y, i, a) => i === 0 || y - a[i - 1] > 1e-4).map(finRing), (x, y, z) => finCamo(z, y)));
  // rudder hinge line
  for (let y = 2.75; y < 5.5; y += 0.3) { const s = finSec(y); box(0.28, 0.28, 0.02, DKG, 0, y, s.te + (s.le - s.te) * 0.38); }
  // fin flash (red forward, white, blue) through the fin, both faces
  {
    const y0 = 4.65, hgt = 0.69, zf = -6.55;
    const s = finSec(y0); const tk = thick(0.45, s.t / (s.le - s.te)) * (s.le - s.te) * 2 + 0.04;
    box(tk, hgt, 0.203, RED, 0, y0, zf - 0.1); box(tk, hgt, 0.203, WHT, 0, y0, zf - 0.303); box(tk, hgt, 0.203, BLU, 0, y0, zf - 0.506);
  }
  // tailplane
  const TP = { span: 4.9, rootC: 2.35, tipC: 1.35, rootLE: -6.05, tipLE: -6.55, y: 3.95, tRoot: 0.30, tTip: 0.12 };
  const tpSec = (x) => {
    const ax = Math.abs(x); const u = Math.min(1, ax / (TP.span - 0.6));
    let c = TP.rootC + (TP.tipC - TP.rootC) * u, le = TP.rootLE + (TP.tipLE - TP.rootLE) * u, t = TP.tRoot + (TP.tTip - TP.tRoot) * u;
    if (ax > TP.span - 0.6) { const v = Math.min(1, (ax - (TP.span - 0.6)) / 0.6), f = Math.sqrt(Math.max(0, 1 - v * v)); const mid = le - c / 2; c *= f; t *= f; le = mid + c / 2; }
    return { c, le, t };
  };
  const tpRing = (x) => {
    const s = tpSec(x), pts = []; const T = s.c > 1e-3 ? s.t / s.c : 0.1;
    const P = (u, sgn) => [x, TP.y + sgn * thick(u, T) * s.c, s.le - u * s.c];
    US.forEach((u) => pts.push(P(u, 1)));
    for (let i = US.length - 2; i > 0; i--) pts.push(P(US[i], -1));
    return pts;
  };
  const tpX = []; for (let x = -4.9; x <= 4.91; x += 0.25) tpX.push(x); [-4.85, -4.7, -4.5, 4.5, 4.7, 4.85].forEach((x) => tpX.push(x)); tpX.sort((a, b) => a - b);
  add(loft(tpX.filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-4).map(tpRing), (x, y, z, nx, ny) => {
    if (ny > 0.12) { const s = tpSec(x); return camo(x * 3.1, (s.le - z) / Math.max(0.2, s.c)); }
    return I_WHT;
  }));
  // elevator hinge lines
  for (let x = -4.2; x <= 4.2; x += 0.35) { const s = tpSec(x); box(0.3, 0.015, 0.03, DKG, x, TP.y + thick(0.62, s.t / s.c) * s.c + 0.005, s.le - 0.62 * s.c); }

  // ---------- BOW TURRET, COCKPIT CANOPY ----------------------------------------
  {
    const tz = 8.85, tb = 2.42;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.22, 20, 1, true), GLS); ring.position.set(0, tb + 0.11, tz); add(ring);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), GLS); dome.position.set(0, tb + 0.22, tz); add(dome);
    const tr = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.02, 6, 24), DKG); tr.rotation.x = Math.PI / 2; tr.position.set(0, tb + 0.22, tz); add(tr);
    const tr2 = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.018, 6, 24), DKG); tr2.rotation.x = Math.PI / 2; tr2.position.set(0, tb + 0.48, tz); add(tr2);
    const fr = box(0.03, 0.55, 0.03, DKG, 0, tb + 0.35, tz + 0.5);  // front frame
    fr.rotation.x = 0.55;
    // Vickers K in the bow
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.9, 8), BLK); gun.rotation.x = Math.PI / 2; gun.position.set(0.1, tb + 0.5, tz + 0.75); add(gun);
    const gn = new THREE.Object3D(); gn.name = 'gun_nose'; gn.position.set(0.1, tb + 0.5, tz + 1.2); add(gn);
    // mooring hatch and bomb-aimer's windows below the turret
    box(0.5, 0.04, 0.45, EDSG, 0, 2.36, 9.35);
    [-1, 1].forEach((sg) => { const w = box(0.03, 0.3, 0.45, GLS, sg * 0.98, 1.95, 9.05); w.rotation.y = sg * 0.5; });
  }
  {
    // canopy: open loft of arches; sides & front = glass, roof = camouflage
    const arch = (z, h, w) => { const p = []; for (let i = 0; i <= 8; i++) { const t = Math.PI - i / 8 * Math.PI; p.push([w * Math.cos(t), 2.72 + h * Math.sin(t), z]); } return p; };
    const rings = [arch(7.15, 0.03, 0.9), arch(6.95, 0.35, 0.93), arch(6.7, 0.66, 0.95), arch(6.2, 0.7, 0.96), arch(5.6, 0.7, 0.96), arch(5.0, 0.7, 0.96)];
    add(loft(rings, (x, y, z, nx, ny) => (ny > 0.72 && z < 6.65 ? deckCamo(z, x) : I_GLS), { closed: false, capEnd: true }));
    // frames
    [6.66, 6.25, 5.85, 5.45, 5.05].forEach((z) => { const f = new THREE.Mesh(new THREE.TorusGeometry(0.965, 0.02, 4, 12, Math.PI), DKG); f.position.set(0, 2.72, z); add(f); });
    box(1.95, 0.03, 2.2, DKG, 0, 2.73, 6.05);
    const cp = new THREE.Object3D(); cp.name = 'cockpit'; cp.position.set(0.45, 3.22, 6.3); add(cp);
  }

  // ---------- WAIST BLISTERS -----------------------------------------------------
  [-1, 1].forEach((sg) => {
    const z0 = -2.9, len = 2.65, R = 0.72, H = 0.66, yc = 1.9;
    const rings = [];
    const prof = (u) => u < 0.36 ? Math.sqrt(Math.max(0, 1 - ((0.36 - u) / 0.36) ** 2)) : Math.sqrt(Math.max(0, 1 - ((u - 0.36) / 0.64) ** 2));
    const us = [0, 0.03, 0.08, 0.15, 0.25, 0.36, 0.5, 0.65, 0.8, 0.9, 0.96, 1.0];
    us.forEach((u) => {
      const z = z0 - u * len, f = prof(u), xb = hullAt(z).hw - 0.03, p = [];
      for (let i = 0; i <= 8; i++) { const t = -Math.PI / 2 + i / 8 * Math.PI; p.push([sg * (xb + R * f * Math.cos(t)), yc + H * f * Math.sin(t), z]); }
      rings.push(p);
    });
    add(loft(rings, () => I_GLS, { closed: false }));
    // blister rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.025, 5, 20), DKG); rim.rotation.y = Math.PI / 2; rim.position.set(sg * (hullAt(z0 - 0.95).hw - 0.02), yc, z0 - 0.95); rim.scale.set(1, 1, 1.9); add(rim);
    // Vickers K firing outboard from the blister
    const a = [sg * (hullAt(z0 - 1.3).hw - 0.2), yc + 0.05, z0 - 1.35], b = [sg * (hullAt(z0 - 1.3).hw + 0.85), yc - 0.05, z0 - 1.55];
    strut(a, b, 0.03, BLK);
    const gw = new THREE.Object3D(); gw.name = sg < 0 ? 'gun_waist_l' : 'gun_waist_r'; gw.position.set(...b); gw.rotation.y = sg * Math.PI / 2; add(gw);
  });

  // ---------- TUNNEL GUN ---------------------------------------------------------
  {
    const z = -6.5, k = hullAt(z).keel;
    box(0.6, 0.05, 0.75, DKG, 0, k - 0.01, z);
    const a = [0, k - 0.05, z + 0.1], b = [0, k - 0.32, z - 0.7];
    strut(a, b, 0.03, BLK);
    const gt = new THREE.Object3D(); gt.name = 'gun_tail'; gt.position.set(...b);
    gt.lookAt(new THREE.Vector3(0, k - 0.6, z - 1.7)); add(gt);
  }

  // ---------- WINGTIP FLOATS (extended) ------------------------------------------
  [-1, 1].forEach((sg) => {
    const fx = sg * 14.55, fz = 2.75, len = 3.1, ybot = 1.55;
    const prof = (u) => u < 0.4 ? Math.sqrt(Math.max(0, 1 - ((0.4 - u) / 0.4) ** 2)) : Math.sqrt(Math.max(0, 1 - ((u - 0.4) / 0.6) ** 2));
    const rings = [];
    const us = [0, 0.03, 0.08, 0.15, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92, 0.97, 1.0];
    us.forEach((u) => {
      const z = fz + len / 2 - u * len, f = prof(u), rx = 0.36 * f, ry = 0.33 * f, yc = ybot + 0.33;
      rings.push([[fx, yc - ry, z], [fx + rx, yc - 0.3 * ry, z], [fx + rx, yc + 0.25 * ry, z], [fx + 0.6 * rx, yc + 0.85 * ry, z], [fx, yc + ry, z],
        [fx - 0.6 * rx, yc + 0.85 * ry, z], [fx - rx, yc + 0.25 * ry, z], [fx - rx, yc - 0.3 * ry, z]]);
    });
    add(loft(rings, (x, y, z, nx, ny) => (ny > 0.45 ? I_EDSG : I_WHT)));
    const top = ybot + 0.62;
    strut([fx, top, fz + 0.7], [sg * 13.7, wingLowerY(13.7, 3.2) + 0.03, 3.2], 0.05, ALU, 0.6);
    strut([fx, top, fz - 0.7], [sg * 13.7, wingLowerY(13.7, 2.2) + 0.03, 2.2], 0.05, ALU, 0.6);
    strut([fx, top, fz], [sg * 15.35, wingLowerY(15.35, 2.75) + 0.03, 2.75], 0.04, ALU);
    strut([fx, top, fz + 0.7], [fx, top, fz - 0.7], 0.035, ALU);
  });

  // ---------- DEPTH CHARGES ------------------------------------------------------
  [-1, 1].forEach((sg) => [7.6, 9.1].forEach((ax) => {
    const x = sg * ax, s = wingSec(x), z = s.le - 0.5 * s.c, yl = wingLowerY(x, z);
    box(0.14, 0.3, 0.9, DKG, x, yl - 0.13, z);
    const dc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 14), DKG); dc.rotation.x = Math.PI / 2; dc.position.set(x, yl - 0.45, z); add(dc);
    box(0.06, 0.06, 1.0, BLK, x, yl - 0.66, z);
  }));
  const bb = new THREE.Object3D(); bb.name = 'bomb_bay'; bb.position.set(0, 3.85, 2.0); add(bb);

  // ---------- MARKINGS -----------------------------------------------------------
  // hull-side Type A1 roundels (1.52 m) just aft of the rear struts
  [-1, 1].forEach((sg) => {
    const z = -1.25, y = 1.85, xb = hullAt(z).hw;
    [[0.76, YEL], [0.543, BLU], [0.326, WHT], [0.109, RED]].forEach(([r, m], i) => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 40), m);
      d.rotation.z = Math.PI / 2; d.position.set(sg * (xb + 0.02 + i * 0.012), y, z); add(d);
    });
  });
  // upper-wing Type B roundels (2.0 m) following the wing curvature
  [-1, 1].forEach((sg) => {
    const cx = sg * 11.6, cz = wingSec(cx).le - 0.5 * wingSec(cx).c;
    const circ = (r) => { const p = []; for (let i = 0; i < 36; i++) { const t = i / 36 * Math.PI * 2; const x = cx + r * Math.cos(t), z = cz + r * Math.sin(t); p.push([x, wingUpperY(x, z) + 0.02, z]); } return p; };
    const rings = [circ(1.0), circ(0.7), circ(0.4), circ(0.2), circ(0.01)];
    add(loft(rings, (x, y, z) => (Math.hypot(x - cx, z - cz) > 0.4 ? 7 : 8), {}));
  });

  // block-capital glyphs from thin boxes (unit cell), rendered in a local XY plane facing +Z
  const GLYPH = {
    A: [[0, 0, 0.5, 1], [0.5, 1, 1, 0], [0.22, 0.38, 0.78, 0.38]],
    X: [[0, 0, 1, 1], [0, 1, 1, 0]],
    L: [[0, 0, 0, 1], [0, 0, 1, 0]],
    Z: [[0, 1, 1, 1], [1, 1, 0, 0], [0, 0, 1, 0]],
    '2': [[0, 1, 1, 1], [1, 1, 1, 0.5], [1, 0.5, 0, 0.5], [0, 0.5, 0, 0], [0, 0, 1, 0]],
    '1': [[0.5, 0, 0.5, 1], [0.2, 0.78, 0.5, 1], [0.2, 0, 0.8, 0]],
    '4': [[0.78, 0, 0.78, 1], [0.78, 1, 0, 0.33], [0, 0.33, 1, 0.33]],
    '7': [[0, 1, 1, 1], [1, 1, 0.35, 0]],
  };
  const text = (str, h, m, thickness) => {
    const grp = new THREE.Group(); const t = h * 0.14, w = h * 0.7, gap = h * 0.22, depth = thickness || 0.03;
    let cx = 0;
    for (const ch of str) {
      const strokes = GLYPH[ch] || [];
      for (const [x0, y0, x1, y1] of strokes) {
        const dx = (x1 - x0) * w, dy = (y1 - y0) * h, L = Math.hypot(dx, dy) + t;
        const b = new THREE.Mesh(new THREE.BoxGeometry(L, t, depth), m);
        b.position.set(cx + (x0 + x1) / 2 * w, (y0 + y1) / 2 * h, 0); b.rotation.z = Math.atan2(dy, dx); grp.add(b);
      }
      cx += w + gap;
    }
    grp.userData.width = cx - gap;
    return grp;
  };
  // place text on the hull side, following the local taper of the side
  const sideText = (str, h, zc, yc, m, sg) => {
    const tg = text(str, h, m); const Wd = tg.userData.width;
    const z1 = zc + Wd / 2, z2 = zc - Wd / 2, x1 = hullAt(z1).hw, x2 = hullAt(z2).hw;
    const yaw = Math.atan2(x1 - x2, z1 - z2);        // side taper angle
    const xm = (x1 + x2) / 2 + 0.035;
    const holder = new THREE.Group(); holder.position.set(sg * xm, yc - h / 2, zc);
    holder.rotation.y = sg * (Math.PI / 2 + yaw);
    tg.position.x = -Wd / 2;
    holder.add(tg); add(holder);
    return holder;
  };
  [-1, 1].forEach((sg) => {
    sideText('AX', 1.2, 1.5, 1.85, MSG, sg);
    sideText('L', 1.2, -2.55, 1.85, MSG, sg);
    sideText('Z2147', 0.35, -7.45, 2.2, BLK, sg);
  });

  // ---------- misc: DF loop, aerial mast, pitot -------------------------------
  { const df = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 20), BLK); df.rotation.y = Math.PI / 2; df.position.set(0, 3.15, 4.9); add(df); }
  strut([0, 2.9, 7.8], [0, 3.6, 7.6], 0.025, BLK);
  strut([-13.2, wingLowerY(-13.2, 3.9), 3.9], [-13.2, wingLowerY(-13.2, 3.9), 4.9], 0.02, BLK);

  g.userData = { length: 19.46, span: 31.70, type: 'aircraft', name: 'Consolidated Catalina Mk I' };

  const box3 = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
