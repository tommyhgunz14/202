// Fairey Swordfish Mk I floatplane, 202 Squadron RAF, Gibraltar 1940-41  (K8422, "TQ-B")
// Temperate Sea Scheme (Extra Dark Sea Grey / Dark Slate Grey over Sky). Lofted cross-sections;
// the disruptive pattern is built into the lofts (slanted colour boundaries), markings as geometry.
export default function (THREE) {
  const g = new THREE.Group();
  const root = new THREE.Group(); g.add(root);

  // ---------------- palette / materials ------------------------------------------
  const P = { edsg: 0x4b5057, dsg: 0x4d5a4c, sky: 0xc9d3b4, alu: 0xc6c8c7, red: 0xa02a30, blue: 0x1f3468,
              yel: 0xd8b43c, wht: 0xeeeeea, msg: 0x8e949a, blk: 0x141517 };
  const cache = {};
  const mat = (hex, name = 'fabric', ds = false) => {
    const k = hex + name + ds;
    if (!cache[k]) {
      const o = { color: hex, roughness: 0.85, metalness: 0, flatShading: true, name };
      if (name === 'metal') { o.roughness = 0.45; o.metalness = 0.3; }
      if (name === 'glass') { o.roughness = 0.15; o.transparent = true; o.opacity = 0.35; }
      if (ds || name === 'glass') o.side = THREE.DoubleSide;
      cache[k] = new THREE.MeshStandardMaterial(o);
    }
    return cache[k];
  };
  const camoA = mat(P.edsg, 'fabric', true), camoB = mat(P.dsg, 'fabric', true), skyD = mat(P.sky, 'fabric', true);
  const camo = mat(P.edsg), sky = mat(P.sky), alu = mat(P.alu, 'metal'), blk = mat(P.blk, 'metal');
  const blkF = mat(P.blk), msg = mat(P.msg), glass = mat(P.wht, 'glass'), bomb = mat(P.dsg, 'metal');
  const red = mat(P.red), blue = mat(P.blue), yel = mat(P.yel), wht = mat(P.wht);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------------- helpers -------------------------------------------------------
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); parent.add(me); return me;
  };
  const tri = (arr, a, b, c) => arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const geoFrom = (arr) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals(); return geo;
  };
  // Loft between rings of 3D points [x,y,z]. Rings must share the point count.
  const loft = (secs, m, closed = true, caps = false, parent = root) => {
    const arr = []; const n = secs[0].length;
    for (let i = 0; i < secs.length - 1; i++) {
      const A = secs[i], B = secs[i + 1];
      for (let j = 0; j < (closed ? n : n - 1); j++) {
        const k = (j + 1) % n;
        tri(arr, A[j], B[j], B[k]); tri(arr, A[j], B[k], A[k]);
      }
    }
    if (caps) for (const S of [secs[0], secs[secs.length - 1]]) capInto(arr, S);
    return add(geoFrom(arr), m, 0, 0, 0, 0, 0, 0, parent);
  };
  const capInto = (arr, S) => {
    const n = S.length; const c = [0, 0, 0];
    for (const p of S) { c[0] += p[0] / n; c[1] += p[1] / n; c[2] += p[2] / n; }
    for (let j = 0; j < n; j++) tri(arr, c, S[j], S[(j + 1) % n]);
  };
  const cap = (S, m, parent = root) => { const arr = []; capInto(arr, S); return add(geoFrom(arr), m, 0, 0, 0, 0, 0, 0, parent); };
  const tbox = (wF, hF, wB, hB, len, yF = 0, yB = 0, xF = 0, xB = 0) => {
    const geo = new THREE.BoxGeometry(1, 1, len); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f = p.getZ(i) > 0;
      p.setXYZ(i, p.getX(i) * (f ? wF : wB) + (f ? xF : xB), p.getY(i) * (f ? hF : hB) + (f ? yF : yB), p.getZ(i));
    }
    geo.computeVertexNormals(); return geo;
  };
  const strut = (a, b, r, m, seg = 6, parent = root) => {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
    me.position.copy(a).addScaledVector(d, 0.5);
    me.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    parent.add(me); return me;
  };
  const wire = (a, b) => strut(a, b, 0.011, blk, 3);
  const lerpT = (tab, z) => { // piecewise-linear table [[z, v], ...] with z descending
    if (z >= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (z >= tab[i][0]) { const [z0, v0] = tab[i - 1], [z1, v1] = tab[i]; return v0 + (v1 - v0) * (z - z0) / (z1 - z0); }
    return tab[tab.length - 1][1];
  };

  // ---------------- fuselage --------------------------------------------------------
  // profile tables: z -> half width, bottom, colour split (mid line), shoulder, top of decking
  const FZ = [5.0, 4.3, 2.6, -1.4, -3.0, -4.6, -5.7];
  const FW = [0.62, 0.52, 0.48, 0.48, 0.36, 0.2, 0.05];
  const FB = [2.03, 1.98, 1.96, 1.98, 2.18, 2.42, 2.6];
  const FM = [2.62, 2.58, 2.56, 2.56, 2.6, 2.66, 2.72];
  const FS = [3.06, 3.06, 3.08, 3.1, 2.95, 2.88, 2.86];
  const FT = [3.42, 3.38, 3.34, 3.36, 3.12, 2.98, 2.92];
  const tab = (arr) => FZ.map((z, i) => [z, arr[i]]);
  const fw = (z) => lerpT(tab(FW), z), fb = (z) => lerpT(tab(FB), z), fm = (z) => lerpT(tab(FM), z);
  const fs = (z) => lerpT(tab(FS), z), ft = (z) => lerpT(tab(FT), z);
  const ARC = 8;
  // upper ring (mid line -> shoulder -> rounded decking), z slanted across the width by s
  const upperRing = (z0, s = 0) => {
    const pts = [];
    const zr = z0 + s, zl = z0 - s;
    pts.push([fw(zr), fm(zr), zr], [fw(zr), fs(zr), zr]);
    for (let i = 1; i < ARC; i++) {
      const a = Math.PI * i / ARC; const cs = Math.cos(a);
      const z = z0 + s * cs; const w = fw(z), ys = fs(z), yt = ft(z);
      pts.push([w * cs, ys + (yt - ys) * Math.sin(a), z]);
    }
    pts.push([-fw(zl), fs(zl), zl], [-fw(zl), fm(zl), zl]);
    return pts;
  };
  const lowerRing = (z0, s = 0) => {
    const zr = z0 + s, zl = z0 - s;
    return [[fw(zr), fm(zr), zr], [fw(zr), fb(zr), zr], [-fw(zl), fb(zl), zl], [-fw(zl), fm(zl), zl]];
  };
  // upper decking: nose section and rear fuselage, in alternating camo bands with slanted joins
  const noseBands = [[5.0, 0], [4.4, 0.25], [3.5, -0.3], [2.62, 0]];
  const rearBands = [[-1.4, 0], [-2.3, 0.3], [-3.4, -0.35], [-4.4, 0.25], [-5.7, 0]];
  const bandLoft = (bands, mats) => {
    for (let i = 0; i < bands.length - 1; i++) {
      const a = bands[i], b = bands[i + 1];
      loft([upperRing(a[0], a[1]), upperRing(b[0], b[1])], mats[i % 2], false, false);
    }
  };
  bandLoft(noseBands, [camoA, camoB]);
  bandLoft(rearBands, [camoB, camoA]);
  // lower fuselage: one Sky loft from the cowl to the sternpost
  loft([5.0, 4.3, 2.6, -1.4, -3.0, -4.6, -5.7].map((z) => lowerRing(z)), skyD, true, false);
  // sternpost cap and nose bulkhead
  cap([...upperRing(-5.7), ...lowerRing(-5.7).slice(1, 3).reverse()], camoA);
  cap([...upperRing(5.0), ...lowerRing(5.0).slice(1, 3).reverse()], camoA);
  // cockpit cutout z 2.62 .. -1.4: side walls, floor, coaming, bulkheads between the three cockpits
  for (const s of [1, -1]) {
    const w = fw(2.0) * s;
    loft([[[w, fm(2.62), 2.62], [w, fs(2.62), 2.62]], [[w, fm(-1.4), -1.4], [w, fs(-1.4), -1.4]]], camoA, false, false);
    add(new THREE.CylinderGeometry(0.03, 0.03, 4.02, 6), blkF, w, fs(0.5) + 0.01, 0.61, Math.PI / 2);
  }
  add(new THREE.BoxGeometry(0.9, 0.04, 4.0), blkF, 0, 2.6, 0.61);                     // floor
  add(new THREE.BoxGeometry(0.9, 0.5, 0.05), blkF, 0, 2.85, 2.6);                     // instrument bulkhead
  for (const z of [1.35, 0.15, -1.1]) add(new THREE.BoxGeometry(0.88, 0.5, 0.05), blkF, 0, 2.86, z);   // seat backs
  add(new THREE.BoxGeometry(0.5, 0.06, 0.4), blkF, 0, 2.86, 1.62);                     // pilot's seat
  add(new THREE.BoxGeometry(0.5, 0.06, 0.4), blkF, 0, 2.86, 0.4);
  add(new THREE.BoxGeometry(0.44, 0.3, 0.06), blkF, 0, 3.28, 1.3);                     // pilot's headrest
  // windscreen (pilot) and small observer screen
  add(new THREE.BoxGeometry(0.66, 0.32, 0.02), glass, 0, 3.22, 2.55, -0.4, 0, 0);
  add(new THREE.BoxGeometry(0.68, 0.03, 0.03), alu, 0, 3.37, 2.49, -0.4, 0, 0);
  add(new THREE.BoxGeometry(0.5, 0.18, 0.02), glass, 0, 3.17, 1.25, -0.4, 0, 0);

  // ---------------- engine, Townend ring, propeller ------------------------------------
  const EY = 2.7, EZ = 5.3;
  add(new THREE.CylinderGeometry(0.69, 0.66, 0.12, 24), camo, 0, EY, 5.02, Math.PI / 2);        // firewall / nose ring
  add(new THREE.CylinderGeometry(0.76, 0.76, 0.42, 28, 1, true, -Math.PI / 2, Math.PI), camoA, 0, EY, EZ + 0.1, -Math.PI / 2);  // Townend ring, top half
  add(new THREE.CylinderGeometry(0.76, 0.76, 0.42, 28, 1, true, Math.PI / 2, Math.PI), skyD, 0, EY, EZ + 0.1, -Math.PI / 2);   // bottom half
  add(new THREE.CylinderGeometry(0.33, 0.36, 0.55, 14), alu, 0, EY, EZ + 0.05, Math.PI / 2);   // crankcase
  add(new THREE.CylinderGeometry(0.2, 0.3, 0.2, 14), alu, 0, EY, EZ + 0.4, Math.PI / 2);      // reduction gear
  for (let i = 0; i < 9; i++) {
    const cg = new THREE.Group(); cg.position.set(0, EY, EZ); cg.rotation.z = i * Math.PI * 2 / 9; root.add(cg);
    add(new THREE.BoxGeometry(0.16, 0.34, 0.24), blk, 0, 0.49, 0, 0, 0, 0, cg);
    add(new THREE.BoxGeometry(0.2, 0.06, 0.28), blk, 0, 0.68, 0, 0, 0, 0, cg);
    add(new THREE.BoxGeometry(0.06, 0.1, 0.08), alu, 0, 0.74, 0.14, 0, 0, 0, cg);
  }
  add(new THREE.TorusGeometry(0.6, 0.06, 8, 28), blk, 0, EY, EZ + 0.38);                         // exhaust collector ring
  strut(V(-0.62, 2.35, 5.4), V(-0.58, 2.2, 3.2), 0.05, blk, 8);                                  // starboard exhaust pipe
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), blk, -0.58, 2.17, 3.05, Math.PI / 2 + 0.25);
  // propeller (blades in the XY plane, hub along +Z)
  const prop = new THREE.Group(); prop.name = 'prop'; prop.position.set(0, EY, 5.85); root.add(prop);
  add(new THREE.CylinderGeometry(0.14, 0.17, 0.32, 12), alu, 0, 0, 0, Math.PI / 2, 0, 0, prop);
  for (let i = 0; i < 3; i++) {
    const bg = new THREE.Group(); bg.rotation.z = i * Math.PI * 2 / 3; prop.add(bg);
    const bl = add(tbox(0.16, 0.025, 0.24, 0.07, 1.4), blkF, 0, 0.9, 0, -Math.PI / 2, 0, 0, bg);
    bl.rotation.set(-Math.PI / 2, 0, 0.45);
    const tip = add(tbox(0.12, 0.02, 0.16, 0.025, 0.15), yel, 0, 1.675, 0, 0, 0, 0, bg);
    tip.rotation.set(-Math.PI / 2, 0, 0.45);
  }

  // ---------------- wings (lofted airfoil, camo bands on top, Sky beneath) -------------
  const NU = 9;
  const yt = (u) => 0.6 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4);
  // station at spanwise x0 (may be bent across the chord by s1/s2 for the camo boundary)
  const foil = (x0, le, c, yc, dih, s1 = 0, s2 = 0) => {
    const top = [], bot = [];
    for (let i = 0; i <= NU; i++) {
      const u = i / NU; const x = x0 + s1 * (u - 0.5) + s2 * Math.sin(Math.PI * u);
      const z = le(x) - u * c, y = yc + dih * Math.abs(x); const t = yt(u) * c;
      top.push([x, y + 1.2 * t, z]); bot.push([x, y - 0.55 * t, z]);
    }
    return { top, bot, ring: [...top, ...bot.slice(1, NU).reverse()] };
  };
  // bands: [x, s1, s2] stations from one end to the other; mats alternate on the upper surface
  const wing = (bands, le, c, yc, dih, mats, tipCaps = [true, true]) => {
    const st = bands.map(([x, s1, s2]) => foil(x, le, c, yc, dih, s1, s2));
    for (let i = 0; i < st.length - 1; i++) {
      loft([st[i].top, st[i + 1].top], mats[i % 2], false, false);
      loft([st[i].bot, st[i + 1].bot], skyD, false, false);
    }
    if (tipCaps[0]) cap(st[0].ring, camoA);
    if (tipCaps[1]) cap(st[st.length - 1].ring, camoA);
    return st;
  };
  const SWEEP = 0.07, DIH = 0.04;
  // upper wing: span 13.87, chord 1.75, LE z 2.75 at the centre; centre section with a trailing-edge cut-out
  const UY = 3.95, UC = 1.75, ULE = (x) => 2.75 - SWEEP * Math.abs(x);
  wing([[6.935, 0, 0], [5.3, 0.3, 0.25], [3.7, -0.35, 0.2], [2.0, 0.3, -0.3], [0.55, 0, 0]], ULE, UC, UY, DIH, [camoB, camoA, camoB, camoA], [true, true]);
  wing([[-0.55, 0, 0], [-1.6, 0.35, 0.3], [-3.3, -0.3, -0.25], [-5.0, 0.3, 0.25], [-6.935, 0, 0]], ULE, UC, UY, DIH, [camoB, camoA, camoB, camoA], [true, true]);
  wing([[-0.55, 0, 0], [0.55, 0, 0]], () => 2.75, 1.2, UY, DIH, [camoA, camoA], [false, false]);
  // lower wing: span 13.1, chord 1.68, LE z 2.15, continuous under the fuselage
  const LY = 2.1, LC = 1.68, LLE = (x) => 2.15 - SWEEP * Math.abs(x);
  wing([[-6.55, 0, 0], [-5.1, -0.3, -0.25], [-3.4, 0.3, 0.3], [-1.7, -0.3, -0.2], [1.5, 0.3, 0.2], [3.2, -0.3, -0.3], [4.9, 0.3, 0.25], [6.55, 0, 0]],
       LLE, LC, LY, DIH, [camoA, camoB, camoA, camoB, camoA, camoB, camoA], [true, true]);
  // aileron hinge lines (all four wings)
  for (const s of [1, -1]) {
    add(new THREE.BoxGeometry(2.9, 0.012, 0.014), blkF, s * 5.4, UY + DIH * 5.4 + 0.075, ULE(5.4) - UC * 0.72, 0, s * SWEEP, s * DIH);
    add(new THREE.BoxGeometry(2.7, 0.012, 0.014), blkF, s * 5.1, LY + DIH * 5.1 + 0.07, LLE(5.1) - LC * 0.72, 0, s * SWEEP, s * DIH);
  }
  // interplane N-struts (two bays each side), cabane N-struts, flying and landing wires
  const uTop = (x, u) => V(x, UY + DIH * Math.abs(x) - 0.55 * yt(u) * UC, ULE(x) - u * UC);
  const lTop = (x, u) => V(x, LY + DIH * Math.abs(x) + 1.2 * yt(u) * LC, LLE(x) - u * LC);
  for (const s of [1, -1]) {
    for (const bx of [2.95, 5.45]) {
      const x = s * bx;
      strut(lTop(x, 0.18), uTop(x, 0.18), 0.035, sky, 8);
      strut(lTop(x, 0.7), uTop(x, 0.7), 0.035, sky, 8);
      strut(lTop(x, 0.7), uTop(x, 0.18), 0.025, sky, 6);
    }
    strut(V(s * 0.46, 3.08, 2.55), V(s * 0.5, UY - 0.02, 2.5), 0.035, sky, 8);
    strut(V(s * 0.46, 3.08, 1.75), V(s * 0.5, UY - 0.02, 1.7), 0.035, sky, 8);
    strut(V(s * 0.46, 3.08, 1.75), V(s * 0.5, UY - 0.02, 2.5), 0.025, sky, 6);
    // wires: flying (lower root -> upper strut top) and landing (upper cabane -> lower strut foot), doubled
    for (const u of [0.18, 0.7]) {
      wire(lTop(s * 0.6, u), uTop(s * 2.95, u)); wire(uTop(s * 0.55, u), lTop(s * 2.95, u));
      wire(lTop(s * 2.95, u), uTop(s * 5.45, u)); wire(uTop(s * 2.95, u), lTop(s * 5.45, u));
    }
    // incidence wires across each bay
    wire(lTop(s * 2.95, 0.18), uTop(s * 2.95, 0.7)); wire(lTop(s * 5.45, 0.18), uTop(s * 5.45, 0.7));
  }

  // ---------------- tail -----------------------------------------------------------
  const TY = 2.96, TC = 1.3, TLE = (x) => -4.25 - 0.12 * Math.abs(x);
  wing([[-1.85, 0, 0], [-0.9, 0.25, 0.2], [0.6, -0.25, -0.2], [1.85, 0, 0]], TLE, TC, TY, 0, [camoB, camoA, camoB], [true, true]);
  for (const s of [1, -1]) {
    strut(V(s * 0.16, 2.42, -4.75), V(s * 1.2, TY - 0.03, -4.85), 0.022, sky, 6);
  }
  add(new THREE.BoxGeometry(3.0, 0.012, 0.014), blkF, 0, TY + 0.06, TLE(0) - TC * 0.6);
  // fin and rudder as extruded shapes in the (z, y) plane, 9 cm thick
  const finShape = new THREE.Shape();
  finShape.moveTo(-4.3, 2.94); finShape.lineTo(-4.5, 3.6); finShape.lineTo(-4.78, 4.25);
  finShape.quadraticCurveTo(-5.0, 4.5, -5.35, 4.52); finShape.lineTo(-5.65, 4.5); finShape.lineTo(-5.65, 2.9); finShape.closePath();
  const rudShape = new THREE.Shape();
  rudShape.moveTo(-5.68, 4.5); rudShape.lineTo(-5.9, 4.42); rudShape.quadraticCurveTo(-6.05, 4.2, -6.02, 3.9);
  rudShape.lineTo(-5.98, 2.75); rudShape.lineTo(-5.75, 2.5); rudShape.lineTo(-5.68, 2.5); rudShape.closePath();
  const finM = add(new THREE.ExtrudeGeometry(finShape, { depth: 0.09, bevelEnabled: false }), camo, 0.045, 0, 0, 0, -Math.PI / 2, 0);
  add(new THREE.ExtrudeGeometry(rudShape, { depth: 0.07, bevelEnabled: false }), camo, 0.035, 0, 0, 0, -Math.PI / 2, 0);
  add(tbox(0.09, 0.02, 0.09, 0.3, 0.9, 0, 0.14), camo, 0, 2.96, -3.85, 0.1, 0, 0);          // dorsal fillet
  for (const s of [1, -1]) {
    add(new THREE.BoxGeometry(0.012, 0.5, 0.35), camoB, s * 0.052, 4.15, -5.35);
    add(new THREE.BoxGeometry(0.012, 0.35, 0.3), camoB, s * 0.052, 3.3, -5.8);
    // fin flash red-white-blue, red forward
    add(new THREE.BoxGeometry(0.02, 0.85, 0.28), red, s * 0.056, 3.42, -4.84);
    add(new THREE.BoxGeometry(0.02, 0.85, 0.28), wht, s * 0.056, 3.42, -5.12);
    add(new THREE.BoxGeometry(0.02, 0.85, 0.28), blue, s * 0.056, 3.42, -5.4);
  }

  // ---------------- floats ------------------------------------------------------------
  const FX = 1.6;
  // profile along z: [z, halfwidth, keel, chine, mid(colour split), top]
  const FP = [[6.06, 0.03, 0.5, 0.56, 0.66, 0.86], [5.5, 0.25, 0.26, 0.36, 0.62, 0.9], [4.5, 0.4, 0.08, 0.24, 0.58, 0.93],
              [3.2, 0.45, 0.0, 0.2, 0.55, 0.93], [1.25, 0.45, 0.0, 0.2, 0.55, 0.9]];
  const AP = [[1.25, 0.45, 0.17, 0.32, 0.55, 0.9], [-0.7, 0.4, 0.3, 0.4, 0.57, 0.86], [-2.44, 0.08, 0.56, 0.6, 0.68, 0.8]];
  const fval = (prof, z, k) => lerpT(prof.map((r) => [r[0], r[k]]), z);
  const floatRingUp = (prof, z0, s, sx) => {
    const zr = z0 + s, zl = z0 - s; const wr = fval(prof, zr, 1), wl = fval(prof, zl, 1);
    return [[sx + wr, fval(prof, zr, 4), zr], [sx + wr, fval(prof, zr, 5) - 0.07, zr], [sx + wr * 0.55, fval(prof, z0, 5), z0],
            [sx - wl * 0.55, fval(prof, z0, 5), z0], [sx - wl, fval(prof, zl, 5) - 0.07, zl], [sx - wl, fval(prof, zl, 4), zl]];
  };
  const floatRingLo = (prof, z, sx) => {
    const w = fval(prof, z, 1);
    return [[sx, fval(prof, z, 2), z], [sx + w, fval(prof, z, 3), z], [sx + w, fval(prof, z, 4), z], [sx - w, fval(prof, z, 4), z], [sx - w, fval(prof, z, 3), z]];
  };
  for (const s of [1, -1]) {
    const sx = s * FX;
    // lower hull, Sky, forebody + afterbody with the step between
    loft([...FP.map((r) => floatRingLo(FP, r[0], sx)), ...AP.map((r) => floatRingLo(AP, r[0], sx))], skyD, true, true);
    // upper hull in camo bands (slanted joins); forebody and afterbody rings share the step z
    const bands = [[6.06, 0, FP], [5.0, 0.25, FP], [3.6, -0.3, FP], [2.2, 0.25, FP], [1.25, 0, FP], [1.25, 0, AP], [0.0, -0.3, AP], [-1.3, 0.25, AP], [-2.44, 0, AP]];
    const mats = s > 0 ? [camoA, camoB, camoA, camoB, camoB, camoA, camoB, camoA] : [camoB, camoA, camoB, camoA, camoA, camoB, camoA, camoB];
    for (let i = 0; i < bands.length - 1; i++) {
      const a = bands[i], b = bands[i + 1];
      loft([floatRingUp(a[2], a[0], a[1], sx), floatRingUp(b[2], b[0], b[1], sx)], mats[i], false, false);
    }
    cap(floatRingUp(FP, 6.06, 0, sx), camoA); cap(floatRingUp(AP, -2.44, 0, sx), camoA);
    // keel strip, mooring cleats, hatch, water rudder
    add(new THREE.BoxGeometry(0.05, 0.05, 4.4), blkF, sx, 0.02, 2.2);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), alu, sx, 0.94, 5.3);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), alu, sx, 0.88, -1.6);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 12), alu, sx, 0.93, 2.6);
    add(new THREE.BoxGeometry(0.03, 0.35, 0.3), sky, sx, 0.58, -2.5);
    // struts: float -> fuselage (inverted Vs, front and rear) and float -> lower wing spars
    const F1 = V(sx, 0.9, 3.9), F2 = V(sx, 0.9, 0.3);
    strut(F1, V(s * 0.45, 1.98, 3.8), 0.045, alu, 8);
    strut(F1, V(s * 0.45, 1.98, 2.3), 0.035, alu, 6);
    strut(F2, V(s * 0.45, 1.98, 0.3), 0.045, alu, 8);
    strut(F2, V(s * 0.45, 1.98, 1.7), 0.035, alu, 6);
    const W1 = V(sx, LY + DIH * FX - 0.05, LLE(FX) - 0.18 * LC), W2 = V(sx, LY + DIH * FX - 0.05, LLE(FX) - 0.7 * LC);
    strut(F1, W1, 0.045, alu, 8); strut(F2, W2, 0.045, alu, 8);
    wire(F1, W2); wire(F2, W1);
  }
  // spreader bars and cross-bracing wires between the floats
  add(new THREE.CylinderGeometry(0.05, 0.05, 2 * FX, 8), alu, 0, 0.95, 3.9, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.05, 0.05, 2 * FX, 8), alu, 0, 0.95, 0.3, 0, 0, Math.PI / 2);
  wire(V(-FX, 0.92, 3.9), V(0.45, 1.98, 3.8)); wire(V(FX, 0.92, 3.9), V(-0.45, 1.98, 3.8));
  wire(V(-FX, 0.92, 0.3), V(0.45, 1.98, 0.3)); wire(V(FX, 0.92, 0.3), V(-0.45, 1.98, 0.3));

  // ---------------- stores and guns --------------------------------------------------
  for (const s of [1, -1]) {
    const bx = s * 2.3, bz = LLE(2.3) - 0.5 * LC;
    add(new THREE.BoxGeometry(0.1, 0.22, 0.6), camo, bx, LY + DIH * 2.3 - 0.17, bz);              // rack
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.75, 12), bomb, bx, LY - 0.35, bz + 0.05, Math.PI / 2);   // 250 lb GP bomb
    add(new THREE.SphereGeometry(0.13, 12, 8), bomb, bx, LY - 0.35, bz + 0.42);
    add(new THREE.CylinderGeometry(0.12, 0.08, 0.35, 12), bomb, bx, LY - 0.35, bz - 0.5, Math.PI / 2);
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.02, 0.26, 0.3), blkF, bx, LY - 0.35, bz - 0.55, 0, 0, i * Math.PI / 2 + Math.PI / 4);
  }
  // fixed forward Vickers gun in the starboard (-x) fuselage side, firing through a trough beside the cowl
  add(new THREE.BoxGeometry(0.06, 0.1, 0.5), blk, -0.5, 2.9, 3.4);
  add(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 8), blk, -0.5, 2.9, 4.3, Math.PI / 2);
  add(new THREE.BoxGeometry(0.12, 0.12, 0.3), camo, -0.62, 2.9, 4.95);
  const gunNose = new THREE.Object3D(); gunNose.name = 'gun_nose'; gunNose.position.set(-0.5, 2.9, 5.06); root.add(gunNose);
  // rear Vickers K on a ring mount at the aft cockpit
  add(new THREE.TorusGeometry(0.44, 0.03, 8, 28), alu, 0, 3.13, -0.85, Math.PI / 2);
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.03, 0.12, 0.03), alu, 0.44 * Math.cos(i * Math.PI / 2 + Math.PI / 4), 3.06, -0.85 + 0.44 * Math.sin(i * Math.PI / 2 + Math.PI / 4));
  const gunG = new THREE.Group(); gunG.position.set(0.1, 3.3, -0.85); gunG.rotation.set(0, Math.PI, 0); gunG.rotateX(-0.35); root.add(gunG);
  add(new THREE.BoxGeometry(0.08, 0.13, 0.5), blk, 0, 0, 0.1, 0, 0, 0, gunG);
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 8), blk, 0, 0.02, 0.62, Math.PI / 2, 0, 0, gunG);
  add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), blk, 0, 0.14, 0.02, 0, 0, 0, gunG);   // drum magazine
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), alu, 0.34, -0.12, -0.1, 0, 0, 0, gunG);  // pillar to the ring
  add(new THREE.BoxGeometry(0.4, 0.03, 0.03), alu, 0.17, -0.02, -0.1, 0, 0, 0, gunG);
  const gunD = new THREE.Object3D(); gunD.name = 'gun_dorsal'; gunD.position.set(0, 0.02, 0.92); gunG.add(gunD);
  const cockpit = new THREE.Object3D(); cockpit.name = 'cockpit'; cockpit.position.set(0, 3.35, 1.85); root.add(cockpit);
  const bay = new THREE.Object3D(); bay.name = 'bomb_bay'; bay.position.set(0, 1.9, 1.3); root.add(bay);

  // ---------------- markings --------------------------------------------------------------
  const roundel = (list, x, y, z, rx, ry, rz) => {
    const G = new THREE.Group(); G.position.set(x, y, z); G.rotation.set(rx, ry, rz); root.add(G);
    list.forEach(([r, m], i) => add(new THREE.CylinderGeometry(r, r, 0.012, 36), m, 0, i * 0.008, 0, 0, 0, 0, G));
    return G;
  };
  const yaw = (z) => Math.atan((fw(z + 0.3) - fw(z - 0.3)) / 0.6);   // side-wall taper angle at z
  const A1 = [[0.39, yel], [0.28, blue], [0.165, wht], [0.056, red]];
  const RZ = -2.9, RY = (fb(RZ) + fs(RZ)) / 2;
  roundel(A1, fw(RZ) + 0.02, RY, RZ, 0, yaw(RZ), -Math.PI / 2);
  roundel(A1, -fw(RZ) - 0.02, RY, RZ, 0, -yaw(RZ), Math.PI / 2);
  const B = [[0.62, blue], [0.25, red]];
  const Atype = [[0.55, blue], [0.33, wht], [0.157, red]];
  for (const s of [1, -1]) {
    const xu = s * 4.5, xl = s * 4.2;
    roundel(B, xu, UY + DIH * 4.5 + 0.135, ULE(4.5) - UC * 0.45, -0.057, s * SWEEP, s * DIH);
    roundel(Atype, xl, LY + DIH * 4.2 - 0.07, LLE(4.2) - LC * 0.45, Math.PI + 0.027, -s * SWEEP, -s * DIH);
  }
  // block letters from thin boxes (strokes in a 1 x 1 cell; x to the right of the reader)
  const STROKES = {
    T: [[0, 1, 1, 1], [0.5, 1, 0.5, 0]],
    Q: [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0], [0.6, 0.35, 1.15, -0.15]],
    B: [[0, 0, 0, 1], [0, 1, 0.9, 1], [0.9, 1, 0.9, 0.5], [0, 0.5, 1, 0.5], [1, 0.5, 1, 0], [1, 0, 0, 0]],
    K: [[0, 0, 0, 1], [0, 0.45, 1, 1], [0.35, 0.62, 1, 0]],
    8: [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0], [0, 0.5, 1, 0.5]],
    4: [[0, 1, 0, 0.45], [0, 0.45, 1, 0.45], [0.75, 1, 0.75, 0]],
    2: [[0, 1, 1, 1], [1, 1, 1, 0.5], [1, 0.5, 0, 0.5], [0, 0.5, 0, 0], [0, 0, 1, 0]],
  };
  const text = (str, origin, u, v, h, m) => {
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    const G = new THREE.Group(); G.position.copy(origin);
    G.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); root.add(G);
    const W = 0.62 * h, t = 0.15 * h; let cx = 0;
    for (const ch of str) {
      for (const [x0, y0, x1, y1] of (STROKES[ch] || [])) {
        const ax = x0 * W, ay = y0 * h, bx = x1 * W, by = y1 * h;
        const L = Math.hypot(bx - ax, by - ay);
        add(new THREE.BoxGeometry(L + t, t, 0.02), m, cx + (ax + bx) / 2, (ay + by) / 2, 0, 0, 0, Math.atan2(by - ay, bx - ax), G);
      }
      cx += W * 1.4;
    }
    return G;
  };
  const up = V(0, 1, 0);
  // starboard (-x): reader advances +z; port (+x): reader advances -z.  Codes: "B" forward, roundel, "TQ" aft.
  const H = 0.56, HS = 0.2;
  // origin = left end of the string as read; port strings start at their forward end, starboard at their aft end
  const side = (s, z, dy) => { const y = yaw(z); return { o: V(s * (fw(z) + 0.03), (fb(z) + fs(z)) / 2 + dy, z), u: s > 0 ? V(-Math.sin(y), 0, -Math.cos(y)) : V(-Math.sin(y), 0, Math.cos(y)) }; };
  let m;
  m = side(1, -1.55, -H / 2); text('TQ', m.o, m.u, up, H, msg);      // port: TQ (fwd) roundel B (aft)
  m = side(1, -3.4, -H / 2); text('B', m.o, m.u, up, H, msg);
  m = side(1, -4.55, -HS / 2 + 0.04); text('K8422', m.o, m.u, up, HS, blkF);
  m = side(-1, -2.4, -H / 2); text('TQ', m.o, m.u, up, H, msg);    // starboard: B (aft) roundel TQ (fwd)
  m = side(-1, -3.76, -H / 2); text('B', m.o, m.u, up, H, msg);
  m = side(-1, -5.4, -HS / 2 + 0.04); text('K8422', m.o, m.u, up, HS, blkF);

  g.userData = { length: 12.06, span: 13.87, type: 'aircraft', name: 'Fairey Swordfish floatplane' };
  const box = new THREE.Box3(), v = new THREE.Vector3(), mm = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(mm.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
