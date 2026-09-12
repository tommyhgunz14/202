// Saunders-Roe London Mk II, K9683 "TQ-A", 202 Squadron RAF, Gibraltar 1939-40.
// Temperate Sea Scheme over Sky Grey.  Real metres, +Z forward, +X port, base y=0 at keel.
export default function (THREE) {
  const g = new THREE.Group();
  g.userData = { length: 17.31, span: 24.38, type: 'aircraft', name: 'Saro London Mk II' };

  // ---- palette (STYLE-LOCK) ----
  const EDSG = 0x4b5057, DSG = 0x4d5a4c, SKYG = 0xa7aeae, ALU = 0xc6c8c7;
  const RED = 0xa02a30, BLUE = 0x1f3468, YEL = 0xd8b43c, MSG = 0x8e949a, BLK = 0x141517, WHT = 0xeeeeea;
  const mat = (hex, o = {}) => new THREE.MeshStandardMaterial(Object.assign(
    { color: hex, roughness: 0.85, metalness: 0.05, name: 'metal', side: THREE.DoubleSide }, o));
  const mA = mat(EDSG), mB = mat(DSG), mSky = mat(SKYG);
  const mAlu = mat(ALU, { roughness: 0.45, metalness: 0.6 });
  const mRed = mat(RED), mBlue = mat(BLUE), mYel = mat(YEL), mWht = mat(WHT), mCode = mat(MSG), mBlk = mat(BLK);
  const mGlass = mat(BLK, { roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.45, name: 'glass' });
  const mStrut = mA, mWire = mA;
  const mWood = mat(0x7a4b26, { roughness: 0.6 });

  // ---- helpers ----
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const box = (w, h, d, m, x = 0, y = 0, z = 0, parent = g) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o;
  };
  const rod = (a, b, r, m, seg = 6, parent = g) => {
    const d = b.clone().sub(a), L = d.length();
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), m);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    parent.add(o); return o;
  };
  // Quad grid -> one non-indexed mesh per material. matOf may return null to skip a cell.
  const grid = (nI, nJ, P, matOf, parent = g) => {
    const pts = [], buckets = new Map();
    for (let i = 0; i < nI; i++) { pts[i] = []; for (let j = 0; j < nJ; j++) pts[i][j] = P(i, j); }
    const push = (m, a, b, c) => {
      let arr = buckets.get(m); if (!arr) { arr = []; buckets.set(m, arr); }
      arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    };
    for (let i = 0; i < nI - 1; i++) for (let j = 0; j < nJ - 1; j++) {
      const p0 = pts[i][j], p1 = pts[i][j + 1], p2 = pts[i + 1][j + 1], p3 = pts[i + 1][j];
      const m = matOf(i, j, p0, p2); if (!m) continue;
      push(m, p0, p1, p2); push(m, p0, p2, p3);
    }
    const out = [];
    for (const [m, arr] of buckets) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      geo.computeVertexNormals();
      const o = new THREE.Mesh(geo, m); parent.add(o); out.push(o);
    }
    return out;
  };
  // Disruptive pattern: true where Dark Slate Grey goes.
  const camo = (x, z) => (Math.sin(x * 0.42 + z * 0.55 + 0.9) + 0.8 * Math.sin(z * 0.95 - x * 0.6 + 0.4)
    + 0.5 * Math.sin(x * 1.1 + z * 1.4)) > 0.2;
  const camoMat = (x, z) => (camo(x, z) ? mB : mA);

  // ================= HULL =================
  // stations: z, half-beam, keel y, chine y, deck-edge y   (two planing steps)
  const H = [
    [8.65, 0.06, 1.35, 1.55, 2.15],
    [7.9, 0.62, 0.62, 1.0, 2.28],
    [6.8, 0.98, 0.2, 0.85, 2.36],
    [5.0, 1.15, 0.0, 0.8, 2.4],
    [2.0, 1.15, 0.0, 0.8, 2.4],
    [0.3, 1.15, 0.0, 0.8, 2.38],
    [0.3, 1.15, 0.26, 0.92, 2.38],
    [-2.0, 1.02, 0.45, 1.05, 2.3],
    [-4.0, 0.85, 0.72, 1.22, 2.2],
    [-4.0, 0.85, 0.86, 1.28, 2.2],
    [-6.0, 0.62, 1.1, 1.4, 2.15],
    [-7.5, 0.45, 1.35, 1.55, 2.15],
    [-8.65, 0.3, 1.55, 1.65, 2.2],
  ];
  const hullAt = (z) => {
    if (z >= H[0][0]) return H[0].slice();
    for (let i = 0; i < H.length - 1; i++) {
      const a = H[i], b = H[i + 1];
      if (z <= a[0] && z >= b[0]) {
        const t = a[0] === b[0] ? 0 : (a[0] - z) / (a[0] - b[0]);
        return a.map((v, k) => v + (b[k] - v) * t);
      }
    }
    return H[H.length - 1].slice();
  };
  const bAt = (z) => hullAt(z)[1];
  const deckY = (z, x) => { const s = hullAt(z); return s[4] + 0.07 * Math.max(0, 1 - (x / s[1]) ** 2); };
  // sides + planing bottom (Sky Grey)
  const ringSide = (s) => {
    const [, b, k, c, d] = s; const mid = k + 0.55 * (c - k);
    return [V(b, d, 0), V(b, c, 0), V(0.5 * b, mid, 0), V(0, k, 0), V(-0.5 * b, mid, 0), V(-b, c, 0), V(-b, d, 0)];
  };
  grid(H.length, 7, (i, j) => { const p = ringSide(H[i])[j]; p.z = H[i][0]; return p; }, () => mSky);
  // deck (camouflaged), fine rows so the pattern edge is wavy
  const DZ = []; for (let z = 8.65; z > -8.65; z -= 0.25) DZ.push(z); DZ.push(-8.65);
  grid(DZ.length, 9, (i, j) => { const z = DZ[i], b = bAt(z), x = -b + (2 * b) * j / 8; return V(x, deckY(z, x), z); },
    (i, j, p0, p2) => camoMat((p0.x + p2.x) / 2, (p0.z + p2.z) / 2));
  // stern cap
  {
    const s = H[H.length - 1], sh = new THREE.Shape();
    sh.moveTo(-s[1], s[4]); sh.lineTo(-s[1], s[3]); sh.lineTo(0, s[2]); sh.lineTo(s[1], s[3]); sh.lineTo(s[1], s[4]);
    sh.lineTo(0, s[4] + 0.07); sh.closePath();
    const o = new THREE.Mesh(new THREE.ShapeGeometry(sh), mSky); o.position.z = s[0]; g.add(o);
  }
  // frame on a hull side at (z, y): local +z = outward normal, local +x = reading direction
  const sideFrame = (z, y, side, proud = 0.03) => {
    const b = bAt(z), db = (bAt(z + 0.2) - bAt(z - 0.2)) / 0.4;
    const n = V(side, 0, -db).normalize();
    const grp = new THREE.Group();
    grp.position.set(side * b + n.x * proud, y, z + n.z * proud);
    grp.rotation.y = Math.atan2(n.x, n.z);
    g.add(grp); return grp;
  };
  // portholes
  for (const side of [1, -1]) for (const z of [4.6, 3.9, -1.6, -2.3]) {
    const f = sideFrame(z, 1.95, side, 0.01);
    f.add(new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), mGlass));
  }
  // bow mooring post
  rod(V(0, 2.3, 7.95), V(0, 2.62, 7.95), 0.05, mAlu, 8);

  // ================= WINGS =================
  const C = 2.85, HALF = 12.19, TIPS = 11.2, ZLE0 = 2.0, Y_LOW = 2.62, GAP = 2.6, Y_UP = Y_LOW + GAP;
  const chordAt = (x) => {
    const a = Math.abs(x); if (a <= TIPS) return C;
    const s = Math.min(1, (a - TIPS) / (HALF - TIPS));
    return Math.max(0.05, C * Math.sqrt(Math.max(0, 1 - s * s * 0.985)));
  };
  const zLEAt = (x) => ZLE0 - (C - chordAt(x)) * 0.45;
  const thick = (u) => Math.max(0, 5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1015 * u ** 4) - 0.0105 * u);
  const surf = (datum, x, u, top) => {
    const c = chordAt(x), T = 0.12 * c;
    return V(x, datum + (top ? 0.62 : -0.38) * T * thick(u), zLEAt(x) - u * c);
  };
  const XS = [];
  for (let x = -HALF; x < -TIPS; x += 0.12) XS.push(x);
  for (let x = -TIPS; x < TIPS; x += 0.25) XS.push(x);
  for (let x = TIPS; x < HALF; x += 0.12) XS.push(x);
  XS.push(HALF);
  const NU = 14, US = []; for (let j = 0; j <= NU; j++) US.push((1 - Math.cos(Math.PI * j / NU)) / 2);
  const wing = (datum) => {
    grid(XS.length, NU + 1, (i, j) => surf(datum, XS[i], US[j], true),
      (i, j, p0, p2) => camoMat((p0.x + p2.x) / 2, (p0.z + p2.z) / 2));
    grid(XS.length, NU + 1, (i, j) => surf(datum, XS[i], US[j], false), () => mSky);
  };
  wing(Y_UP); wing(Y_LOW);
  const lowTop = (x, u) => surf(Y_LOW, x, u, true).y, lowBot = (x, u) => surf(Y_LOW, x, u, false).y;
  const upBot = (x, u) => surf(Y_UP, x, u, false).y, upTop = (x, u) => surf(Y_UP, x, u, true).y;
  const zU = (u) => ZLE0 - u * C;
  // lower wing root fairing over the hull top
  box(2.32, 0.24, C + 0.12, mA, 0, 2.48, ZLE0 - C / 2);

  // drape a flat ring/disc (built in XY, facing +z) onto a height function y(x,z)
  const drapeRing = (rIn, rOut, m, cx, cz, fn) => {
    const geo = new THREE.RingGeometry(Math.max(rIn, 0.001), rOut, 36, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = cx + p.getX(i), z = cz - p.getY(i);
      p.setXYZ(i, x, fn(x, z), z);
    }
    geo.computeVertexNormals();
    const o = new THREE.Mesh(geo, m); g.add(o); return o;
  };
  // Type A wing roundels (1:3:5), 2.0 m, on upper wing top and lower wing underside
  const uOf = (x, z) => (zLEAt(x) - z) / chordAt(x);
  for (const sx of [1, -1]) {
    const cx = sx * 9.6, cz = zU(0.5);
    const top = (x, z) => upTop(x, uOf(x, z)) + 0.03, bot = (x, z) => lowBot(x, uOf(x, z)) - 0.03;
    for (const fn of [top, bot]) {
      drapeRing(0, 0.2, mRed, cx, cz, fn);
      drapeRing(0.2, 0.6, mWht, cx, cz, fn);
      drapeRing(0.6, 1.0, mBlue, cx, cz, fn);
    }
  }

  // ---- interplane N-struts, 4 bays a side, and bracing wires ----
  const STA = [1.0, 4.6, 7.6, 10.6], UF = 0.22, UR = 0.72;
  const strutPts = (x, u) => [V(x, lowTop(x, u), zU(u)), V(x, upBot(x, u), zU(u))];
  for (const s of [1, -1]) {
    const xs = STA.map((x) => s * x);
    for (const x of xs) {
      const [lf, uf] = strutPts(x, UF), [lr, ur] = strutPts(x, UR);
      rod(lf, uf, 0.05, mStrut); rod(lr, ur, 0.05, mStrut); rod(lf, ur, 0.04, mStrut);
    }
    for (let i = 0; i < xs.length - 1; i++) for (const u of [UF, UR]) {
      const [la, ua] = strutPts(xs[i], u), [lb, ub] = strutPts(xs[i + 1], u);
      rod(la, ub, 0.012, mWire, 4); rod(ua, lb, 0.012, mWire, 4);
    }
  }

  // ================= ENGINES (Pegasus X, Townend ring, mid-gap) =================
  const EX = 3.3, NY = (Y_LOW + Y_UP) / 2, ZF = ZLE0 + 1.3;
  const engine = (x) => {
    const e = new THREE.Group(); e.position.set(x, NY, 0); g.add(e);
    // short-chord Townend ring with an aerofoil section, the cylinder heads showing inside it
    const prof = [[0.70, -0.2], [0.74, -0.27], [0.82, -0.2], [0.86, 0.02], [0.82, 0.22], [0.74, 0.28], [0.70, 0.22], [0.70, -0.2]].map((p) => new THREE.Vector2(p[0], p[1]));
    const ring = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), mA);
    ring.rotation.x = Math.PI / 2; ring.position.z = ZF; e.add(ring);
    // Pegasus: crankcase with the reduction-gear nose, nine finned cylinders with heads, rocker
    // boxes and pushrod tubes, the ignition harness ring in front, the exhaust collector behind
    const ccProf = [[0.0, 0.62], [0.16, 0.6], [0.24, 0.5], [0.3, 0.3], [0.32, 0.05], [0.3, -0.25], [0.0, -0.25]].map((p) => new THREE.Vector2(p[0], p[1]));
    const cc = new THREE.Mesh(new THREE.LatheGeometry(ccProf, 24), mAlu); cc.rotation.x = Math.PI / 2; cc.position.z = ZF; e.add(cc);
    for (let k = 0; k < 9; k++) {
      const a = k * Math.PI * 2 / 9 + Math.PI / 2;
      const cg = new THREE.Group(); cg.rotation.z = a - Math.PI / 2; cg.position.z = ZF - 0.02; e.add(cg);   // local +y is radial
      for (let f = 0; f < 6; f++) { const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.1 - f * 0.004, 0.1 - f * 0.004, 0.022, 12), mBlk); fin.position.y = 0.3 + f * 0.045; cg.add(fin); }
      box(0.17, 0.1, 0.22, mBlk, 0, 0.58, 0, cg);      // head
      box(0.11, 0.07, 0.12, mBlk, 0, 0.65, 0.03, cg);  // rocker box
      rod(V(-0.05, 0.3, 0.13), V(-0.05, 0.56, 0.12), 0.012, mAlu, 6, cg); rod(V(0.05, 0.3, 0.13), V(0.05, 0.56, 0.12), 0.012, mAlu, 6, cg);   // pushrod tubes
      rod(V(0, 0.5, -0.12), V(0, 0.5, -0.34), 0.028, mBlk, 6, cg);   // exhaust stub into the collector
    }
    const harness = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 6, 32), mBlk); harness.position.z = ZF + 0.2; e.add(harness);
    const collector = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 32), mBlk); collector.position.z = ZF - 0.36; e.add(collector);
    // nacelle: a lathed body tapering to the tail cone, carburettor intake on top, oil cooler below
    const nacProf = [[0.0, -0.3], [0.5, -0.3], [0.56, -0.9], [0.55, -1.8], [0.44, -2.7], [0.24, -3.6], [0.05, -4.3], [0.0, -4.3]].map((p) => new THREE.Vector2(p[0], p[1]));
    const body = new THREE.Mesh(new THREE.LatheGeometry(nacProf, 24), mSky); body.rotation.x = Math.PI / 2; body.position.z = ZF; e.add(body);
    box(0.22, 0.16, 0.9, mA, 0, 0.6, ZF - 1.1, e);      // carburettor air intake
    box(0.3, 0.12, 0.5, mBlk, 0, -0.58, ZF - 1.2, e);   // oil cooler
    // exhaust pipe from the collector, aft under the nacelle
    rod(V(0.42, -0.36, ZF - 0.36), V(0.42, -0.36, ZF - 1.9), 0.05, mBlk, 8, e);
    // propeller: 4 blades, XY plane, hub along +Z
    const prop = new THREE.Group(); prop.name = 'prop'; prop.position.z = ZF + 0.5; e.add(prop);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 12), mBlk);
    hub.rotation.x = Math.PI / 2; prop.add(hub);
    const spin = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 12), mAlu);
    spin.rotation.x = Math.PI / 2; spin.position.z = 0.28; prop.add(spin);
    for (let k = 0; k < 4; k++) {
      const bl = new THREE.Group(); bl.rotation.z = k * Math.PI / 2; prop.add(bl);
      const b1 = box(0.21, 1.55, 0.06, mWood, 0, 0.9, 0, bl); b1.rotation.y = 0.45;   // laminated wood
      const b2 = box(0.19, 0.2, 0.06, mYel, 0, 1.75, 0, bl); b2.rotation.y = 0.45;
      const le = box(0.02, 1.5, 0.062, mAlu, -0.1, 0.9, 0, bl); le.rotation.y = 0.45;   // brass leading edge
    }
    // mounting struts to lower and upper wings
    for (const sx of [1, -1]) {
      for (const [zn, u] of [[ZF - 0.6, 0.22], [ZF - 2.0, 0.7]]) {
        rod(V(x + sx * 0.38, NY - 0.35, zn), V(x + sx * 0.95, lowTop(x + sx * 0.95, u), zU(u)), 0.045, mStrut);
        rod(V(x + sx * 0.38, NY + 0.35, zn), V(x + sx * 0.95, upBot(x + sx * 0.95, u), zU(u)), 0.045, mStrut);
      }
    }
  };
  engine(EX); engine(-EX);

  // ================= WINGTIP FLOATS =================
  const FX = 10.4, FZ = zU(0.5), FY0 = 0.78;
  const F = [[1.45, 0.05, 0.4, 0.46, 0.6], [1.0, 0.3, 0.1, 0.3, 0.64], [0.3, 0.37, 0.0, 0.26, 0.66],
    [-0.3, 0.37, 0.0, 0.26, 0.66], [-0.3, 0.37, 0.1, 0.3, 0.66], [-1.0, 0.28, 0.25, 0.4, 0.62], [-1.45, 0.06, 0.45, 0.5, 0.58]];
  for (const s of [1, -1]) {
    const cx = s * FX;
    grid(F.length, 9, (i, j) => {
      const [dz, w, k, c, d] = F[i];
      const ring = [V(0, d + 0.05, 0), V(w, d, 0), V(w, c, 0), V(0.5 * w, k + 0.5 * (c - k), 0), V(0, k, 0),
        V(-0.5 * w, k + 0.5 * (c - k), 0), V(-w, c, 0), V(-w, d, 0), V(0, d + 0.05, 0)][j];
      return V(cx + ring.x, FY0 + ring.y, FZ + dz);
    }, () => mSky);
    for (const sx of [1, -1]) for (const [dz, u] of [[0.55, 0.22], [-0.55, 0.72]]) {
      rod(V(cx + sx * 0.22, FY0 + 0.62, FZ + dz), V(cx + sx * 0.75, lowBot(cx + sx * 0.75, u), zU(u)), 0.04, mStrut);
    }
    rod(V(cx + 0.22, FY0 + 0.62, FZ + 0.55), V(cx - 0.75, lowBot(cx - 0.75, 0.72), zU(0.72)), 0.012, mWire, 4);
    rod(V(cx - 0.22, FY0 + 0.62, FZ - 0.55), V(cx + 0.75, lowBot(cx + 0.75, 0.22), zU(0.22)), 0.012, mWire, 4);
  }

  // ================= TAIL =================
  const TY = 3.5, TZ = -7.0, TSPAN = 7.0, TC = 2.0, FINX = 2.9;
  box(TSPAN, 0.14, TC * 0.74, mA, 0, TY, TZ + TC / 2 - TC * 0.37);           // fixed tailplane
  box(TSPAN - 0.3, 0.1, TC * 0.24, mA, 0, TY, TZ - TC / 2 + TC * 0.12);       // elevators
  {
    const TZ0 = TZ + TC / 2, TZ1 = TZ - TC / 2, rows = 29, cols = 9;
    grid(rows, cols, (i, j) => V(-TSPAN / 2 + TSPAN * i / (rows - 1), TY + 0.085, TZ0 - (TZ0 - TZ1) * j / (cols - 1)),
      (i, j, p0, p2) => (camo((p0.x + p2.x) / 2 + 30, (p0.z + p2.z) / 2) ? mB : null));
  }
  // central pylon and bracing struts
  box(0.34, 1.3, 1.6, mSky, 0, 2.15 + 0.65, TZ - 0.1);
  for (const s of [1, -1]) {
    rod(V(s * 0.6, 2.1, TZ + 0.5), V(s * 2.4, TY - 0.06, TZ + 0.55), 0.04, mStrut);
    rod(V(s * 0.5, 2.1, TZ - 0.6), V(s * 2.4, TY - 0.06, TZ - 0.55), 0.04, mStrut);
  }
  // twin fins and rudders (drawn in (z,y), extruded along x)
  const finShape = new THREE.Shape();
  const fp = [[-6.35, -0.55], [-6.5, 1.1], [-6.75, 1.7], [-7.2, 1.92], [-7.75, 1.88], [-8.1, 1.45], [-8.22, 0.5], [-8.12, -0.55]];
  fp.forEach(([z, y], i) => (i ? finShape.lineTo(-z, y) : finShape.moveTo(-z, y))); finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false });
  const patchShape = new THREE.Shape();
  [[-6.55, -0.3], [-6.7, 0.5], [-7.0, 1.0], [-7.4, 1.3], [-7.6, 0.9], [-7.55, 0.3], [-7.35, -0.3]].forEach(([z, y], i) => (i ? patchShape.lineTo(-z, y) : patchShape.moveTo(-z, y)));
  patchShape.closePath();
  for (const s of [1, -1]) {
    const fin = new THREE.Mesh(finGeo, mA); fin.rotation.y = Math.PI / 2; fin.position.set(s * FINX - 0.06, TY, 0); g.add(fin);   // extrudes toward +x
    for (const f of [1, -1]) {
      const px = s * FINX + f * 0.07;
      const patch = new THREE.Mesh(new THREE.ShapeGeometry(patchShape), mB);
      patch.rotation.y = Math.PI / 2; patch.position.set(px, TY, 0); g.add(patch);
      // fin flash: red forward, white, blue
      box(0.012, 0.8, 0.24, mRed, px + f * 0.01, TY + 0.95, -6.78);
      box(0.012, 0.8, 0.24, mWht, px + f * 0.01, TY + 0.95, -7.02);
      box(0.012, 0.8, 0.24, mBlue, px + f * 0.01, TY + 0.95, -7.26);
    }
    // rudder hinge line
    box(0.1, 2.3, 0.02, mBlk, s * FINX, TY + 0.6, -7.55);
  }

  // ================= COCKPIT =================
  const CD = deckY(5.0, 0) - 0.07, CZ0 = 4.1, CZ1 = 5.75, CH = 0.7;
  box(1.6, CH, CZ1 - CZ0, mA, 0, CD + CH / 2, (CZ0 + CZ1) / 2);
  box(1.6, 0.16, 0.42, mA, 0, CD + 0.08, CZ1 + 0.2);                          // coaming under the screen
  {
    const dz = 0.4, dy = CH - 0.16, L = Math.hypot(dz, dy), ang = Math.atan2(dz, dy);
    const ws = box(1.6, L, 0.03, mGlass, 0, CD + 0.16 + dy / 2, CZ1 + dz / 2); ws.rotation.x = ang;
    for (const x of [-0.78, -0.26, 0.26, 0.78]) { const p = box(0.05, L, 0.05, mA, x, CD + 0.16 + dy / 2, CZ1 + dz / 2 + 0.01); p.rotation.x = ang; }
    box(1.62, 0.05, 0.05, mA, 0, CD + CH, CZ1 + 0.02);
  }
  for (const s of [1, -1]) {
    box(0.02, 0.34, 1.3, mGlass, s * 0.81, CD + 0.42, (CZ0 + CZ1) / 2 + 0.05);
    box(0.04, 0.36, 0.05, mA, s * 0.82, CD + 0.42, (CZ0 + CZ1) / 2 + 0.05);
  }
  { // rear fairing sloping down to the wing root
    const y0 = CD + CH, y1 = lowTop(0, 0.05) + 0.02, z0 = CZ0, z1 = ZLE0 + 0.05;
    const L = Math.hypot(z0 - z1, y0 - y1), f = box(1.6, 0.06, L, mA, 0, (y0 + y1) / 2, (z0 + z1) / 2);
    f.rotation.x = -Math.atan2(y0 - y1, z0 - z1);
    box(1.5, (y0 - y1) * 0.5, (z0 - z1) * 0.9, mA, 0, y1 + (y0 - y1) * 0.25 - 0.02, (z0 + z1) / 2);
  }
  const cockpit = new THREE.Object3D(); cockpit.name = 'cockpit'; cockpit.position.set(0.42, CD + 0.5, 5.15); g.add(cockpit);
  // aerial mast + wires
  rod(V(0, CD + CH, 4.5), V(0, CD + CH + 1.1, 4.5), 0.02, mA, 6);
  for (const s of [1, -1]) rod(V(0, CD + CH + 1.1, 4.5), V(s * FINX, TY + 1.85, -7.3), 0.008, mBlk, 4);

  // ================= GUN POSITIONS (Scarff rings, Lewis guns) =================
  const gunPost = (name, z, aft, low = false) => {
    const y = deckY(z, 0);
    const grp = new THREE.Group(); grp.position.set(0, y, z); if (aft) grp.rotation.y = Math.PI; g.add(grp);
    box(0.84, 0.03, 0.84, mBlk, 0, 0.0, 0, grp);                               // hatch opening
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 28), mAlu);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; grp.add(ring);
    rod(V(0, 0.09, 0.4), V(0, low ? 0.26 : 0.5, 0.12), 0.025, mAlu, 6, grp);      // gun pillar
    // the bow gun rides low and level so it sits below the pilots' eye line
    const gun = new THREE.Group(); gun.position.set(0, low ? 0.28 : 0.52, 0.1); gun.rotation.x = low ? 0 : -0.28; grp.add(gun);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), mBlk);
    barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.45; gun.add(barrel);
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), mBlk);
    jacket.rotation.x = Math.PI / 2; jacket.position.z = 0.25; gun.add(jacket);
    box(0.09, 0.13, 0.36, mBlk, 0, -0.02, -0.12, gun);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14), mBlk);
    drum.position.set(0, 0.11, 0.02); gun.add(drum);
    const muzzle = new THREE.Object3D(); muzzle.name = name; muzzle.position.set(0, 0, 0.9); gun.add(muzzle);
  };
  gunPost('gun_nose', 7.35, false, true);
  gunPost('gun_dorsal', -2.9, false);
  gunPost('gun_tail', -8.15, true);

  // ================= BOMBS (2 x 250 lb each side) =================
  for (const s of [1, -1]) for (const bx of [4.05, 4.95]) {
    const x = s * bx, z = zU(0.5), yb = lowBot(x, 0.5);
    box(0.12, 0.2, 0.7, mA, x, yb - 0.1, z);
    const by = yb - 0.2 - 0.15;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 12), mB);
    body.rotation.x = Math.PI / 2; body.position.set(x, by, z); g.add(body);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.03, 0.3, 12), mB);
    nose.rotation.x = Math.PI / 2; nose.position.set(x, by, z + 0.55); g.add(nose);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.35, 12), mB);
    tail.rotation.x = Math.PI / 2; tail.position.set(x, by, z - 0.57); g.add(tail);
    box(0.02, 0.36, 0.3, mB, x, by, z - 0.62); box(0.36, 0.02, 0.3, mB, x, by, z - 0.62);
  }
  const bay = new THREE.Object3D(); bay.name = 'bomb_bay'; bay.position.set(0, 2.3, zU(0.5)); g.add(bay);

  // ================= MARKINGS ON THE HULL =================
  // Type A1 roundel (1:3:5:7), 1.2 m, both sides
  const RZ = -3.8, RY = 1.62;
  for (const s of [1, -1]) {
    const f = sideFrame(RZ, RY, s);
    f.add(new THREE.Mesh(new THREE.CircleGeometry(0.086, 24), mRed));
    f.add(new THREE.Mesh(new THREE.RingGeometry(0.086, 0.257, 32), mWht));
    f.add(new THREE.Mesh(new THREE.RingGeometry(0.257, 0.43, 36), mBlue));
    f.add(new THREE.Mesh(new THREE.RingGeometry(0.43, 0.6, 40), mYel));
  }
  // block-letter font: strokes on a unit cell (w 0.72, h 1)
  const FONT = {
    T: [[0, 1, 0.72, 1], [0.36, 0, 0.36, 1]],
    Q: [[0, 0, 0, 1], [0.72, 0, 0.72, 1], [0, 1, 0.72, 1], [0, 0, 0.72, 0], [0.42, 0.32, 0.8, -0.1]],
    A: [[0, 0, 0.36, 1], [0.36, 1, 0.72, 0], [0.14, 0.4, 0.58, 0.4]],
    K: [[0, 0, 0, 1], [0, 0.45, 0.72, 1], [0, 0.45, 0.72, 0]],
    9: [[0, 1, 0.72, 1], [0.72, 0, 0.72, 1], [0, 0.5, 0, 1], [0, 0.5, 0.72, 0.5], [0, 0, 0.72, 0]],
    6: [[0, 0, 0, 1], [0, 1, 0.72, 1], [0, 0.5, 0.72, 0.5], [0, 0, 0.72, 0], [0.72, 0, 0.72, 0.5]],
    8: [[0, 0, 0, 1], [0.72, 0, 0.72, 1], [0, 1, 0.72, 1], [0, 0.5, 0.72, 0.5], [0, 0, 0.72, 0]],
    3: [[0, 1, 0.72, 1], [0, 0.5, 0.72, 0.5], [0, 0, 0.72, 0], [0.72, 0, 0.72, 1]],
  };
  const text = (str, h, m, parent) => {
    const grp = new THREE.Group(); const sw = 0.17 * h, adv = 0.72 * h + 0.28 * h;
    let x0 = 0;
    for (const ch of str) {
      for (const [ax, ay, bx2, by] of FONT[ch]) {
        const a = V(x0 + ax * h, ay * h, 0), b = V(x0 + bx2 * h, by * h, 0), d = b.clone().sub(a);
        const o = box(d.length() + sw, sw, 0.02, m, 0, 0, 0, grp);
        o.position.copy(a).addScaledVector(d, 0.5); o.rotation.z = Math.atan2(d.y, d.x);
      }
      x0 += adv;
    }
    const w = x0 - 0.28 * h; grp.position.x = -w / 2; parent.add(grp); return w;
  };
  for (const s of [1, -1]) {
    text('TQ', 1.0, mCode, sideFrame(-2.05, 1.22, s));   // forward of the roundel
    text('A', 1.0, mCode, sideFrame(-5.1, 1.25, s));     // aft of the roundel
    text('K9683', 0.3, mBlk, sideFrame(-6.55, 1.72, s)); // serial
  }

  // ---- measurement / placement (contract) ----
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
