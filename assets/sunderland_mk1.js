// Short Sunderland Mk I flying boat, 202 Squadron RAF, Gibraltar 1942.
// Real metres, +Z = bow, base (keel at the main step) at y = 0.
export default function (THREE) {
  const g = new THREE.Group();
  g.userData = { length: 26.01, span: 34.38, type: 'aircraft', name: 'Short Sunderland Mk I' };
  // ======================= palette & materials (STYLE-LOCK.md) =============================
  const PAL = { EDSG: 0x4b5057, DSG: 0x4d5a4c, WHITE: 0xeeeeea, ALU: 0xc6c8c7, RED: 0xa02a30,
    BLUE: 0x1f3468, YEL: 0xd8b43c, MSG: 0x8e949a, BLK: 0x141517 };
  const mkMat = (hex, rough, name, extra) => {
    const mm = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough == null ? 0.85 : rough, metalness: 0 }, extra || {}));
    mm.name = name || 'metal'; return mm;
  };
  const M = {
    edsg: mkMat(PAL.EDSG), dsg: mkMat(PAL.DSG), white: mkMat(PAL.WHITE), alu: mkMat(PAL.ALU, 0.45),
    red: mkMat(PAL.RED), blue: mkMat(PAL.BLUE), yel: mkMat(PAL.YEL), msg: mkMat(PAL.MSG),
    blk: mkMat(PAL.BLK), blkm: mkMat(PAL.BLK, 0.45),
    glass: mkMat(0x2b3d4a, 0.15, 'glass', { transparent: true, opacity: 0.7 }),
    glass2: mkMat(0x2b3d4a, 0.15, 'glass', { transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    whiteD: mkMat(PAL.WHITE, 0.85, 'metal', { side: THREE.DoubleSide }),
    edsgD: mkMat(PAL.EDSG, 0.85, 'metal', { side: THREE.DoubleSide }),
  };
  // camouflage: 0 = Extra Dark Sea Grey, 1 = Dark Slate Grey (Temperate Sea Scheme disruptive)
  const camo = (x, z) => (Math.sin(x * 0.62 + z * 0.35 + 0.8) * Math.cos(z * 0.55 - x * 0.2)
    + 0.55 * Math.sin(x * 1.05 - z * 0.45 + 1.9)) > 0.05 ? 1 : 0;
  const CAMO = [M.edsg, M.dsg, M.white];          // material array used by painted surfaces
  const topCamo = (thr) => (cx, cy, cz, nx, ny) => (ny > thr ? camo(cx, cz) : 2);

  // ======================= generic helpers ==================================================
  const add = (geom, mat, o) => {
    o = o || {}; const mesh = new THREE.Mesh(geom, mat);
    if (o.p) mesh.position.set(o.p[0], o.p[1], o.p[2]);
    if (o.r) mesh.rotation.set(o.r[0], o.r[1], o.r[2]);
    if (o.s) mesh.scale.set(o.s[0], o.s[1], o.s[2]);
    if (o.name) mesh.name = o.name;
    (o.parent || g).add(mesh); return mesh;
  };
  const empty = (name, p, parent, ry) => {
    const e = new THREE.Object3D(); e.name = name; e.position.set(p[0], p[1], p[2]);
    if (ry) e.rotation.y = ry; (parent || g).add(e); return e;
  };
  // orient a block of triangles so the majority face away from ctr
  const orientBlock = (arr, ctr) => {
    let vote = 0;
    for (let i = 0; i < arr.length; i += 9) {
      const ax = arr[i], ay = arr[i + 1], az = arr[i + 2], bx = arr[i + 3], by = arr[i + 4], bz = arr[i + 5], cx = arr[i + 6], cy = arr[i + 7], cz = arr[i + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      vote += nx * ((ax + bx + cx) / 3 - ctr[0]) + ny * ((ay + by + cy) / 3 - ctr[1]) + nz * ((az + bz + cz) / 3 - ctr[2]);
    }
    if (vote < 0) for (let i = 0; i < arr.length; i += 9) { for (let k = 0; k < 3; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; } }
    return arr;
  };
  // loft closed rings (arrays of [x,y,z], same length) into a flat-shaded BufferGeometry
  const loft = (rings, capStart, capEnd) => {
    const n = rings[0].length, sides = [], caps = [];
    const P = (arr, q) => arr.push(q[0], q[1], q[2]);
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], B = rings[i + 1];
      for (let j = 0; j < n; j++) { const k = (j + 1) % n; P(sides, A[j]); P(sides, B[j]); P(sides, B[k]); P(sides, A[j]); P(sides, B[k]); P(sides, A[k]); }
    }
    const ctr = [0, 0, 0]; let cnt = 0;
    rings.forEach((R) => R.forEach((q) => { ctr[0] += q[0]; ctr[1] += q[1]; ctr[2] += q[2]; cnt++; }));
    ctr[0] /= cnt; ctr[1] /= cnt; ctr[2] /= cnt;
    const cap = (R) => {
      const c = [0, 0, 0], arr = []; R.forEach((q) => { c[0] += q[0] / n; c[1] += q[1] / n; c[2] += q[2] / n; });
      for (let j = 0; j < n; j++) { const k = (j + 1) % n; P(arr, c); P(arr, R[j]); P(arr, R[k]); }
      caps.push(orientBlock(arr, ctr));
    };
    if (capStart) cap(rings[0]); if (capEnd) cap(rings[rings.length - 1]);
    orientBlock(sides, ctr);
    const all = sides.concat(...caps);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
    geo.computeVertexNormals(); return geo;
  };
  // split a geometry's triangles into material groups by a classifier(cx,cy,cz,nx,ny,nz)
  const paint = (geom, classify, xf) => {
    const src = geom.index ? geom.toNonIndexed() : geom;
    if (xf) src.applyMatrix4(xf);
    const p = src.attributes.position, n = p.count / 3, buckets = new Map();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cb = new THREE.Vector3(), ab = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      a.fromBufferAttribute(p, i * 3); b.fromBufferAttribute(p, i * 3 + 1); c.fromBufferAttribute(p, i * 3 + 2);
      cb.subVectors(c, b); ab.subVectors(a, b); cb.cross(ab).normalize();
      const k = classify((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3, cb.x, cb.y, cb.z) | 0;
      if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(i);
    }
    const out = new Float32Array(n * 9), res = new THREE.BufferGeometry(); let o = 0;
    for (const k of [...buckets.keys()].sort((x, y) => x - y)) {
      const list = buckets.get(k), start = o / 3;
      for (const i of list) for (let q = 0; q < 9; q++) out[o++] = p.array[i * 9 + q];
      res.addGroup(start, list.length * 3, k);
    }
    res.setAttribute('position', new THREE.BufferAttribute(out, 3)); res.computeVertexNormals(); return res;
  };
  // cylinder strut between two points
  const strut = (a, b, r, mat, parent) => {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
    const d = B.clone().sub(A), L = d.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    (parent || g).add(mesh); return mesh;
  };

  // ======================= hull station table ===============================================
  // z, keel y, chine y, side x, side top y, shoulder (x,y), roof mid (x,y), top y  (right half)
  const HS = [
    [13.0, 2.30, 2.36, 0.07, 2.65, 0.06, 2.82, 0.04, 2.92, 2.95],
    [12.4, 1.65, 1.82, 0.62, 2.85, 0.52, 3.10, 0.32, 3.22, 3.26],
    [11.3, 0.95, 1.22, 1.15, 3.20, 0.98, 3.55, 0.60, 3.78, 3.85],
    [9.9, 0.45, 0.82, 1.45, 3.55, 1.25, 3.95, 0.80, 4.15, 4.22],
    [9.5, 0.35, 0.74, 1.50, 3.60, 1.30, 4.02, 0.85, 4.24, 4.30],
    [8.6, 0.20, 0.64, 1.55, 3.75, 1.35, 4.30, 0.90, 4.80, 4.98],
    [7.0, 0.10, 0.58, 1.55, 3.75, 1.35, 4.30, 0.90, 4.82, 5.00],
    [5.2, 0.03, 0.55, 1.55, 3.75, 1.35, 4.30, 0.90, 4.82, 5.00],
    [2.4, 0.00, 0.55, 1.55, 3.75, 1.35, 4.30, 0.90, 4.75, 4.90],
    [2.4, 0.40, 0.85, 1.55, 3.75, 1.35, 4.30, 0.90, 4.75, 4.90],
    [0.0, 0.62, 1.00, 1.50, 3.70, 1.30, 4.25, 0.85, 4.60, 4.70],
    [-3.0, 1.00, 1.32, 1.40, 3.60, 1.20, 4.15, 0.78, 4.45, 4.55],
    [-6.0, 1.45, 1.72, 1.25, 3.50, 1.05, 4.05, 0.68, 4.35, 4.45],
    [-6.0, 1.70, 1.92, 1.25, 3.50, 1.05, 4.05, 0.68, 4.35, 4.45],
    [-8.5, 2.25, 2.42, 0.95, 3.60, 0.85, 4.10, 0.55, 4.35, 4.42],
    [-10.5, 2.75, 2.88, 0.72, 3.70, 0.62, 4.12, 0.40, 4.32, 4.38],
    [-12.0, 3.05, 3.12, 0.52, 3.80, 0.45, 4.10, 0.30, 4.28, 4.32],
    [-12.5, 3.20, 3.25, 0.28, 3.85, 0.24, 4.05, 0.15, 4.20, 4.25],
  ];
  // right-half polygon of a station, keel up to top centre
  const stationPoly = (s) => [[0, s[1]], [s[3], s[2]], [s[3], s[4]], [s[5], s[6]], [s[7], s[8]], [0, s[9]]];
  const stationRing = (s) => {
    const R = stationPoly(s), z = s[0], out = [];
    R.forEach((q) => out.push([q[0], q[1], z]));
    for (let i = R.length - 2; i >= 1; i--) out.push([-R[i][0], R[i][1], z]);
    return out;
  };
  // interpolated station at any z (between table rows; steps are handled by row order)
  const stationAt = (z) => {
    if (z >= HS[0][0]) return HS[0].slice();
    for (let i = 0; i < HS.length - 1; i++) {
      const A = HS[i], B = HS[i + 1];
      if (z <= A[0] && z >= B[0]) {
        if (A[0] === B[0]) return A.slice();
        const t = (A[0] - z) / (A[0] - B[0]);
        return A.map((v, k) => v + (B[k] - v) * t);
      }
    }
    return HS[HS.length - 1].slice();
  };
  // frame on the hull skin at height y and station z: position + basis so that a panel built in
  // the XY plane facing +Z (reading left->right along +X) sits flat on the skin, readable from
  // outside. side = +1 starboard, -1 port.
  const hullFrame = (z, y, side, proud) => {
    const s = stationAt(z), P = stationPoly(s);
    let x = P[1][0], nx = 1, ny = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if (y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1]) && b[1] !== a[1]) {
        const t = (y - a[1]) / (b[1] - a[1]); x = a[0] + (b[0] - a[0]) * t;
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); nx = dy / L; ny = -dx / L;
        if (i === 1) { nx = 1; ny = 0; }
        break;
      }
    }
    const s2 = stationAt(z - 0.5), s1 = stationAt(z + 0.5);
    const k = (s1[3] - s2[3]) / 1.0;                           // d(side x)/dz
    const N = new THREE.Vector3(side * nx, ny, -nx * k).normalize();
    let U = new THREE.Vector3(-side * ny, nx, 0);
    const Rt = new THREE.Vector3().crossVectors(U, N).normalize();
    U = new THREE.Vector3().crossVectors(N, Rt).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Rt, U, N));
    const pos = new THREE.Vector3(side * x, y, z).addScaledVector(N, proud == null ? 0.02 : proud);
    return { pos, quat: q, N };
  };
  const placeOnHull = (obj, z, y, side, proud) => {
    const f = hullFrame(z, y, side, proud); obj.position.copy(f.pos); obj.quaternion.copy(f.quat); g.add(obj); return obj;
  };

  // ======================= wing / tail geometry math ========================================
  const W = { half: 17.19, cRoot: 5.4, cTip: 2.3, xFlat: 2.0, leRoot: 5.2, leTip: 4.0, yRoot: 5.05, dih: 0.045, tRoot: 0.18, tTip: 0.12, tipR: 1.4 };
  const wingAt = (x) => {
    const ax = Math.abs(x), a = Math.max(0, (ax - W.xFlat) / (W.half - W.xFlat));
    let le = W.leRoot + (W.leTip - W.leRoot) * a, chord = W.cRoot + (W.cTip - W.cRoot) * a;
    if (ax > W.half - W.tipR) { const f = Math.max(0.1, Math.sqrt(Math.max(0, 1 - ((ax - (W.half - W.tipR)) / W.tipR) ** 2))); le -= chord * (1 - f) * 0.45; chord *= f; }
    return { le, chord, y: W.yRoot + W.dih * Math.max(0, ax - W.xFlat), t: W.tRoot + (W.tTip - W.tRoot) * a };
  };
  // NACA-style half-thickness for a unit thickness ratio (peaks at 0.5 near 30% chord)
  const thick = (u) => 5 * (0.2969 * Math.sqrt(u) - 0.1260 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1036 * u * u * u * u) * 0.5;
  const camber = (u) => 0.025 * 4 * u * (1 - u);
  const wingTopY = (x, z) => { const s = wingAt(x); const u = Math.min(1, Math.max(0, (s.le - z) / s.chord)); return s.y + s.chord * (camber(u) + s.t * thick(u)); };
  const wingBotY = (x, z) => { const s = wingAt(x); const u = Math.min(1, Math.max(0, (s.le - z) / s.chord)); return s.y + s.chord * (camber(u) - s.t * thick(u)); };
  // airfoil sample list [u, side] closed loop: top TE->LE, bottom LE->TE
  const AF = (() => { const N = 10, out = []; for (let k = 0; k <= N; k++) out.push([0.5 * (1 + Math.cos(Math.PI * k / N)), 1]); for (let k = N - 1; k >= 1; k--) out.push([0.5 * (1 + Math.cos(Math.PI * k / N)), -1]); return out; })();
  const TP = { half: 5.1, cRoot: 3.4, cTip: 1.9, leRoot: -8.6, leTip: -9.7, y: 4.45, t: 0.11, tipR: 0.9 };
  const tailAt = (x) => {
    const ax = Math.abs(x), a = Math.min(1, ax / TP.half);
    let le = TP.leRoot + (TP.leTip - TP.leRoot) * a, chord = TP.cRoot + (TP.cTip - TP.cRoot) * a;
    if (ax > TP.half - TP.tipR) { const f = Math.max(0.1, Math.sqrt(Math.max(0, 1 - ((ax - (TP.half - TP.tipR)) / TP.tipR) ** 2))); le -= chord * (1 - f) * 0.45; chord *= f; }
    return { le, chord, y: TP.y, t: TP.t };
  };
  // fin: stations by height  [y, le z, chord, thickness ratio]
  const FIN = [[4.3, -7.5, 4.8, 0.085], [5.2, -7.9, 4.5, 0.085], [6.5, -8.5, 4.1, 0.085], [8.0, -9.4, 3.4, 0.085], [9.3, -10.3, 2.6, 0.085], [10.2, -11.1, 1.5, 0.08], [10.55, -11.7, 0.5, 0.06]];
  const finAt = (y) => {
    for (let i = 0; i < FIN.length - 1; i++) { const A = FIN[i], B = FIN[i + 1]; if (y >= A[0] && y <= B[0]) { const t = (y - A[0]) / (B[0] - A[0]); return { le: A[1] + (B[1] - A[1]) * t, chord: A[2] + (B[2] - A[2]) * t, t: A[3] + (B[3] - A[3]) * t }; } }
    const L = FIN[FIN.length - 1]; return { le: L[1], chord: L[2], t: L[3] };
  };
  const finHalfT = (y, z) => { const s = finAt(y); const u = Math.min(1, Math.max(0, (s.le - z) / s.chord)); return s.chord * s.t * thick(u); };

  // ======================= shared detail parts ==============================================
  // --- Bristol Pegasus engines: nacelle body is candidate-specific (nacelleBody(x, y, le))
  const NAC_X = [-9.6, -4.9, 4.9, 9.6];
  const buildProp = (x, y, z) => {
    const p = new THREE.Group(); p.name = 'prop'; p.position.set(x, y, z);
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 12), M.alu, { r: [Math.PI / 2, 0, 0], parent: p });
    add(new THREE.SphereGeometry(0.16, 12, 8), M.alu, { p: [0, 0, 0.2], s: [1, 1, 0.7], parent: p });
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Group(); b.rotation.z = k * 2 * Math.PI / 3; p.add(b);
      const blade = new THREE.Group(); blade.rotation.y = 0.45; b.add(blade);
      add(new THREE.BoxGeometry(0.27, 1.52, 0.06), M.blk, { p: [0, 0.18 + 0.76, 0], parent: blade });
      add(new THREE.BoxGeometry(0.25, 0.2, 0.06), M.yel, { p: [0, 1.8, 0], parent: blade });
      add(new THREE.CylinderGeometry(0.07, 0.09, 0.25, 8), M.blk, { p: [0, 0.2, 0], parent: blade });
    }
    g.add(p); return p;
  };
  const engineFace = (x, y, z) => {        // z = front lip of the cowling
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 18), M.blk, { p: [x, y, z - 0.35], r: [Math.PI / 2, 0, 0] });
    for (let k = 0; k < 9; k++) {
      const a = k * 2 * Math.PI / 9;
      add(new THREE.BoxGeometry(0.2, 0.26, 0.3), M.blkm, { p: [x + Math.cos(a) * 0.43, y + Math.sin(a) * 0.43, z - 0.24], r: [0, 0, a + Math.PI / 2] });
    }
    add(new THREE.CylinderGeometry(0.24, 0.26, 0.2, 14), M.alu, { p: [x, y, z - 0.08], r: [Math.PI / 2, 0, 0] });
    // exhaust pipe running aft under the nacelle
    add(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 8), M.blk, { p: [x + 0.25, y - 0.62, z - 1.1], r: [Math.PI / 2, 0, 0] });
  };
  const buildEngines = (nacelleBody) => {
    NAC_X.forEach((x) => {
      const s = wingAt(x), y = s.y, front = s.le + 2.05;
      nacelleBody(x, y, s.le);
      engineFace(x, y, front);
      buildProp(x, y, front + 0.32);
    });
  };

  // --- turrets
  const frameRing = (r, tube, p, rot, parent) => add(new THREE.TorusGeometry(r, tube, 6, 28), M.edsg, { p, r: rot, parent });
  const buildNoseTurret = () => {
    const t = new THREE.Group(); t.position.set(0, 3.45, 12.35); g.add(t);
    add(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 24), M.glass, { p: [0, -0.25, 0], parent: t });
    add(new THREE.SphereGeometry(0.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, { s: [1, 0.8, 1], parent: t });
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 16), M.blk, { p: [0, -0.15, 0], parent: t });
    frameRing(0.6, 0.025, [0, 0, 0], [Math.PI / 2, 0, 0], t);
    frameRing(0.6, 0.025, [0, -0.5, 0], [Math.PI / 2, 0, 0], t);
    add(new THREE.BoxGeometry(0.04, 0.5, 0.04), M.edsg, { p: [0.6, -0.25, 0], parent: t });
    add(new THREE.BoxGeometry(0.04, 0.5, 0.04), M.edsg, { p: [-0.6, -0.25, 0], parent: t });
    add(new THREE.TorusGeometry(0.6, 0.02, 6, 20, Math.PI), M.edsg, { parent: t, s: [1, 0.8, 1] });
    [-0.13, 0.13].forEach((x) => add(new THREE.CylinderGeometry(0.03, 0.035, 0.8, 8), M.blk, { p: [x, 0.02, 0.75], r: [Math.PI / 2, 0, 0], parent: t }));
    empty('gun_nose', [0, 0.02, 1.15], t);
  };
  const buildTailTurret = () => {
    const t = new THREE.Group(); t.position.set(0, 3.75, -12.35); g.add(t);
    add(new THREE.SphereGeometry(0.66, 24, 14), M.glass, { s: [1, 0.9, 1], parent: t });
    add(new THREE.SphereGeometry(0.42, 16, 10), M.blk, { parent: t });
    frameRing(0.66, 0.025, [0, 0, 0], [Math.PI / 2, 0, 0], t);
    add(new THREE.TorusGeometry(0.66, 0.025, 6, 28), M.edsg, { s: [1, 0.9, 1], parent: t });
    [[-0.2, 0.12], [0.2, 0.12], [-0.2, -0.14], [0.2, -0.14]].forEach(([x, y]) =>
      add(new THREE.CylinderGeometry(0.03, 0.035, 0.9, 8), M.blk, { p: [x, y, -0.85], r: [Math.PI / 2, 0, 0], parent: t }));
    empty('gun_tail', [0, 0, -1.3], t, Math.PI);
  };
  // --- beam (waist) Vickers K guns in open hatches
  const buildWaistGuns = () => {
    [1, -1].forEach((side) => {
      const zH = -5.6, yH = 3.25;
      placeOnHull(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.03), M.blk), zH, yH, side, 0.015);
      const f = hullFrame(zH, yH + 0.1, side, 0.05);
      const gun = new THREE.Group(); gun.position.copy(f.pos);
      gun.rotation.set(-0.12, side * (Math.PI / 2 + 0.4), 0, 'YXZ'); g.add(gun);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), M.blk, { p: [0, -0.15, -0.1], parent: gun });
      add(new THREE.BoxGeometry(0.1, 0.12, 0.5), M.blk, { p: [0, 0.02, 0.05], parent: gun });
      add(new THREE.CylinderGeometry(0.028, 0.028, 0.8, 8), M.blk, { p: [0, 0.03, 0.65], r: [Math.PI / 2, 0, 0], parent: gun });
      add(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 14), M.blk, { p: [0, 0.14, 0.05], parent: gun });
      empty(side > 0 ? 'gun_waist_l' : 'gun_waist_r', [0, 0.03, 1.05], gun);
    });
  };
  // --- windows, portholes, windscreen, astrodome, aerials
  const buildHullDetails = () => {
    [1, -1].forEach((side) => {
      for (let z = 10.8; z > 1.5; z -= 1.1) placeOnHull(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 14), M.glass2), z, 2.05, side, 0.01).rotateX(Math.PI / 2);
      [-2.4, -3.3, -4.2].forEach((z) => placeOnHull(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.02), M.glass2), z, 3.35, side, 0.01));
      [8.25, 7.65].forEach((z) => placeOnHull(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.015), M.edsg), z, 4.5, side, 0.0));
      [8.25, 7.65].forEach((z) => placeOnHull(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.02), M.glass2), z, 4.5, side, 0.012));
    });
    // windscreen: sloping panel between z=9.5 (y 4.47) and z=8.6 (y 4.98)
    const ws = new THREE.Group(); ws.position.set(0, 4.64, 9.05); ws.rotation.x = -Math.atan2(0.68, 0.9); g.add(ws);
    add(new THREE.BoxGeometry(2.0, 1.12, 0.03), M.glass2, { p: [0, 0, 0.03], parent: ws });
    [-0.68, -0.23, 0.23, 0.68].forEach((x) => add(new THREE.BoxGeometry(0.06, 1.12, 0.05), M.edsg, { p: [x, 0, 0.04], parent: ws }));
    add(new THREE.BoxGeometry(2.0, 0.06, 0.05), M.edsg, { p: [0, 0.52, 0.04], parent: ws });
    add(new THREE.BoxGeometry(2.0, 0.06, 0.05), M.edsg, { p: [0, -0.52, 0.04], parent: ws });
    // astrodome, DF loop, mast
    add(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, { p: [0, 4.98, 7.6] });
    add(new THREE.TorusGeometry(0.2, 0.02, 6, 20), M.blk, { p: [0, 5.28, 6.6] });
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), M.blk, { p: [0, 5.13, 6.6] });
    // ASV Mk II 'stickleback' dipole masts on the rear hull top
    [-4.6, -5.6, -6.6, -7.6].forEach((z) => [0.5, -0.5].forEach((x) => {
      const s = stationAt(z), y0 = s[8] - 0.02;
      add(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), M.blk, { p: [x, y0 + 0.5, z] });
      add(new THREE.BoxGeometry(0.03, 0.03, 0.7), M.blk, { p: [x, y0 + 1.0, z] });
    }));
    // mooring bollard on the bow deck
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), M.blk, { p: [0, 4.15, 11.2] });
    // cockpit eye point: left-hand pilot on the flight deck
    empty('cockpit', [0.55, 4.55, 8.4]);
  };
  // --- depth charges under the wing roots
  const buildDepthCharges = () => {
    [-2.9, -2.25, 2.25, 2.9].forEach((x) => {
      const yTop = wingBotY(x, 1.0) - 0.02;
      add(new THREE.BoxGeometry(0.08, 0.1, 1.8), M.blk, { p: [x, yTop - 0.05, 1.0] });
      add(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16), M.edsg, { p: [x, yTop - 0.32, 1.0], r: [Math.PI / 2, 0, 0] });
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), M.blk, { p: [x, yTop - 0.32, 1.63], r: [Math.PI / 2, 0, 0] });
    });
    empty('bomb_bay', [0, 4.35, 1.0]);
  };
  // --- wingtip floats on N-struts (float body is candidate-specific: floatBody(x, zc, yBase))
  const buildFloats = (floatBody) => {
    [-14.4, 14.4].forEach((x) => {
      const zc = 2.9, yB = 2.0, yT = yB + 0.9;
      floatBody(x, zc, yB);
      [[-0.55, 0.75], [0.55, 0.75], [-0.55, -0.7], [0.55, -0.7]].forEach(([dx, dz]) => {
        const xt = x + dx * 1.15, zt = zc + dz;
        strut([x + dx * 0.55, yT - 0.05, zc + dz], [xt, wingBotY(xt, zt) + 0.05, zt], 0.05, M.alu);
      });
      // diagonals making the N (front-bottom to rear-top on each side)
      [-0.55, 0.55].forEach((dx) => strut([x + dx * 0.55, yT - 0.05, zc + 0.75], [x + dx * 1.15, wingBotY(x + dx * 1.15, zc - 0.7) + 0.05, zc - 0.7], 0.04, M.alu));
      strut([x - 0.3, yT - 0.05, zc + 0.2], [x + 0.3, yT - 0.05, zc + 0.2], 0.04, M.alu);
    });
  };

  // ======================= markings =========================================================
  const STROKE = 0.17;
  const GLYPHS = (() => { const s = STROKE, w = 0.7; return {
    T: [[0, 1 - s / 2, w, 1 - s / 2], [w / 2, 0, w / 2, 1]],
    Q: [[s / 2, 0, s / 2, 1], [w - s / 2, 0, w - s / 2, 1], [0, s / 2, w, s / 2], [0, 1 - s / 2, w, 1 - s / 2], [0.4, 0.3, 0.78, -0.05]],
    K: [[s / 2, 0, s / 2, 1], [s / 2, 0.42, w, 1], [0.27, 0.55, w, 0]],
    W: [[s / 2, 0, s / 2, 1], [w - s / 2, 0, w - s / 2, 1], [0, s / 2, w, s / 2], [w / 2, s / 2, w / 2, 0.62]],
    3: [[0, 1 - s / 2, w, 1 - s / 2], [0.12, 0.5, w, 0.5], [0, s / 2, w, s / 2], [w - s / 2, 0, w - s / 2, 1]],
    9: [[0, 1 - s / 2, w, 1 - s / 2], [0, 0.5, w, 0.5], [s / 2, 0.5, s / 2, 1], [w - s / 2, 0, w - s / 2, 1], [0, s / 2, w, s / 2]],
    8: [[0, 1 - s / 2, w, 1 - s / 2], [0, 0.5, w, 0.5], [0, s / 2, w, s / 2], [s / 2, 0, s / 2, 1], [w - s / 2, 0, w - s / 2, 1]],
    5: [[0, 1 - s / 2, w, 1 - s / 2], [0, 0.5, w, 0.5], [0, s / 2, w, s / 2], [s / 2, 0.5, s / 2, 1], [w - s / 2, 0, w - s / 2, 0.5]],
  }; })();
  // text built in the XY plane facing +Z, centred, back face at z=0
  const buildText = (str, H, mat, depth) => {
    const grp = new THREE.Group(), d = depth || 0.02, gap = 0.28, wch = 0.7;
    const total = str.length * wch + (str.length - 1) * gap;
    let u0 = -total / 2;
    for (const ch of str) {
      const segs = GLYPHS[ch]; if (!segs) { u0 += wch + gap; continue; }
      for (const [a, b, c2, d2] of segs) {
        const L = Math.hypot(c2 - a, d2 - b), ang = Math.atan2(d2 - b, c2 - a);
        add(new THREE.BoxGeometry((L + STROKE) * H, STROKE * H, d), mat, { p: [(u0 + (a + c2) / 2) * H, ((b + d2) / 2 - 0.5) * H, d / 2], r: [0, 0, ang], parent: grp });
      }
      u0 += wch + gap;
    }
    return grp;
  };
  // Type A1 roundel as stacked flat discs, facing +Z, back face at z=0
  const roundelA1 = (D) => {
    const grp = new THREE.Group(), R = D / 2;
    [[1, M.yel], [5 / 7, M.blue], [3 / 7, M.white], [1 / 7, M.red]].forEach(([f, mat], i) =>
      add(new THREE.CylinderGeometry(R * f, R * f, 0.02, 48), mat, { p: [0, 0, 0.01 + i * 0.008], r: [Math.PI / 2, 0, 0], parent: grp }));
    return grp;
  };
  // disc / ring conforming to a height function yFn(x,z), used for the Type B wing roundels
  const surfDisc = (cx, cz, r0, r1, yFn, mat, seg) => {
    seg = seg || 40; const pos = [];
    const pt = (r, a) => [cx + r * Math.cos(a), yFn(cx + r * Math.cos(a), cz + r * Math.sin(a)) + 0.025, cz + r * Math.sin(a)];
    for (let i = 0; i < seg; i++) {
      const a0 = i * 2 * Math.PI / seg, a1 = (i + 1) * 2 * Math.PI / seg;
      const A = pt(r1, a0), B = pt(r1, a1), C = pt(r0, a1), Dd = pt(r0, a0);
      pos.push(...A, ...Dd, ...B, ...B, ...Dd, ...C);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    return add(geo, mkMat(mat.color.getHex(), 0.85, 'metal', { side: THREE.DoubleSide }));
  };
  const buildMarkings = (topFn) => {
    [1, -1].forEach((side) => {
      placeOnHull(roundelA1(1.8), -1.8, 2.45, side, 0.03);
      placeOnHull(buildText('TQ', 1.5, M.msg), 0.9, 2.55, side, 0.03);
      placeOnHull(buildText('K', 1.5, M.msg), -3.55, 2.55, side, 0.03);
      placeOnHull(buildText('W3985', 0.4, M.blk), -8.6, 3.28, side, 0.03);
    });
    // Type B upper wing roundels
    [-11.6, 11.6].forEach((x) => {
      const zc = wingAt(x).le - wingAt(x).chord * 0.5;
      surfDisc(x, zc, 0.5, 1.25, topFn, M.blue);
      surfDisc(x, zc, 0, 0.5, topFn, M.red);
    });
    // fin flash, red forward
    [1, -1].forEach((side) => [[-9.05, M.red], [-9.5, M.white], [-9.95, M.blue]].forEach(([z, mat]) => {
      const ht = finHalfT(7.2, z) + 0.02;
      add(new THREE.BoxGeometry(0.02, 1.5, 0.45), mat, { p: [side * ht, 7.2, z] });
    }));
  };

  // ======================= HULL: lofted station rings, painted per face ======================
  {
    const rings = [];
    for (let i = 0; i < HS.length - 1; i++) {
      const A = HS[i], B = HS[i + 1], n = Math.max(1, Math.round((A[0] - B[0]) / 0.6));
      for (let k = 0; k < n; k++) { const t = k / n; rings.push(stationRing(A.map((v, q) => v + (B[q] - v) * t))); }
    }
    rings.push(stationRing(HS[HS.length - 1]));
    add(paint(loft(rings, true, true), (cx, cy, cz, nx, ny) => (ny > 0.32 && cy > 2.6 ? camo(cx, cz) : 2)), CAMO, { name: 'hull' });
  }

  // ======================= WING, TAILPLANE, FIN =============================================
  const spanStations = (half, step, tipR) => {
    const xs = [];
    for (let x = 0; x < half - tipR; x += step) xs.push(x);
    for (let k = 0; k <= 5; k++) xs.push(half - tipR + tipR * k / 5);
    const out = xs.slice().reverse().map((v) => -v).concat(xs.slice(1));
    return out.filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 1e-6);
  };
  {
    const wingRing = (x) => { const s = wingAt(x); return AF.map(([u, sd]) => [x, s.y + s.chord * (camber(u) + sd * s.t * thick(u)), s.le - u * s.chord]); };
    add(paint(loft(spanStations(W.half, 0.9, W.tipR).map(wingRing), true, true), topCamo(0.15)), CAMO, { name: 'wing' });
    // flap and aileron hinge lines on the upper surface
    [[3.0, 10.4, 0.72], [10.6, 16.4, 0.70]].forEach(([x0, x1, cf]) => [1, -1].forEach((side) => {
      for (let x = x0; x < x1; x += 0.5) {
        const xm = side * (x + 0.25), s = wingAt(xm), z = s.le - s.chord * cf;
        add(new THREE.BoxGeometry(0.5, 0.03, 0.05), M.blk, { p: [xm, wingTopY(xm, z) + 0.012, z] });
      }
    }));
    const tailRing = (x) => { const s = tailAt(x); return AF.map(([u, sd]) => [x, s.y + sd * s.chord * s.t * thick(u), s.le - u * s.chord]); };
    add(paint(loft(spanStations(TP.half, 0.7, TP.tipR).map(tailRing), true, true), topCamo(0.15)), CAMO, { name: 'tailplane' });
    [1, -1].forEach((side) => { for (let x = 0.9; x < 4.4; x += 0.5) { const s = tailAt(side * (x + 0.25)), z = s.le - s.chord * 0.7; add(new THREE.BoxGeometry(0.5, 0.03, 0.05), M.blk, { p: [side * (x + 0.25), TP.y + s.chord * s.t * thick(0.7) + 0.012, z] }); } });
    const finRing = (y) => { const s = finAt(y); return AF.map(([u, sd]) => [sd * s.chord * s.t * thick(u), y, s.le - u * s.chord]); };
    const ys = []; for (let y = FIN[0][0]; y < FIN[FIN.length - 1][0] - 0.01; y += 0.35) ys.push(y); ys.push(FIN[FIN.length - 1][0]);
    add(paint(loft(ys.map(finRing), true, true), (cx, cy, cz) => camo(cy * 0.9, cz)), CAMO, { name: 'fin' });
    // rudder hinge line
    for (let y = 4.5; y < 10.2; y += 0.4) { const s = finAt(y + 0.2), z = s.le - s.chord * 0.62; [1, -1].forEach((side) => add(new THREE.BoxGeometry(0.03, 0.4, 0.05), M.blk, { p: [side * (finHalfT(y + 0.2, z) + 0.012), y + 0.2, z] })); }
  }

  // ======================= ENGINE NACELLES (Pegasus XXII, long-chord cowlings) ==============
  const circ = (x, y, z, r) => { const o = []; for (let i = 0; i < 18; i++) { const a = i * 2 * Math.PI / 18; o.push([x + r * Math.cos(a), y + r * Math.sin(a), z]); } return o; };
  const nacelleBody = (x, y, le) => {
    const front = le + 2.05;
    const cowl = loft([circ(x, y, front, 0.64), circ(x, y, front - 0.22, 0.72), circ(x, y, front - 1.35, 0.72), circ(x, y, front - 1.36, 0.66)], false, false);
    add(paint(cowl, (cx, cy, cz) => (cy > y - 0.02 ? camo(cx, cz) : 2)), CAMO);
    const body = loft([circ(x, y, front - 1.36, 0.64), circ(x, y, front - 1.9, 0.70), circ(x, y, le - 0.4, 0.68), circ(x, y, le - 1.5, 0.56), circ(x, y, le - 2.5, 0.36), circ(x, y, le - 3.3, 0.13)], true, true);
    add(paint(body, (cx, cy, cz) => (cy > y ? camo(cx, cz) : 2)), CAMO);
  };

  // ======================= WINGTIP FLOATS ===================================================
  const floatBody = (x, zc, yB) => {
    // dz, keel, chine, half width, gunwale, deck top (relative to yB)
    const FS = [[1.9, 0.6, 0.66, 0.05, 0.86, 0.9], [1.5, 0.32, 0.45, 0.26, 0.86, 0.9], [0.9, 0.1, 0.3, 0.4, 0.88, 0.9], [0.1, 0.0, 0.26, 0.44, 0.88, 0.9],
      [0.1, 0.16, 0.36, 0.44, 0.88, 0.9], [-0.8, 0.3, 0.46, 0.38, 0.86, 0.88], [-1.5, 0.52, 0.62, 0.22, 0.8, 0.82], [-1.9, 0.7, 0.74, 0.06, 0.76, 0.78]];
    const rings = FS.map(([dz, k, c, hw, gw, top]) => {
      const R = [[0, k], [hw, c], [hw, gw], [hw * 0.5, top], [0, top]], o = [];
      R.forEach((q) => o.push([x + q[0], yB + q[1], zc + dz]));
      for (let i = R.length - 2; i >= 1; i--) o.push([x - R[i][0], yB + R[i][1], zc + dz]);
      return o;
    });
    add(paint(loft(rings, true, true), (cx, cy, cz, nx, ny) => (ny > 0.45 ? camo(cx, cz) : 2)), CAMO);
  };

  // ======================= ASSEMBLY =========================================================
  buildEngines(nacelleBody);
  buildNoseTurret();
  buildTailTurret();
  buildWaistGuns();
  buildHullDetails();
  buildDepthCharges();
  buildFloats(floatBody);
  buildMarkings(wingTopY);

  // ---- measurement / placement (from ASSET-BRIEF.md) --------------------------------------
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
