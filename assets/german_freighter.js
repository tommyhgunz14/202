export default function (THREE) {
  const g = new THREE.Group();
  // ---- palette (STYLE-LOCK.md) ----
  const C = {
    black: 0x141517, hull: 0x1e2023, boot: 0x8a2f24, buff: 0xd7cbb0, funnel: 0xc9a46a,
    timber: 0xb08a5a, canvas: 0xb9b09a, brass: 0xb08d3e, white: 0xeeeeea, gris: 0x5c6872,
    deckGrey: 0x4f5a64, red: 0xa02a30, yellow: 0xd8b43c, blue: 0x1f3468, alu: 0xc6c8c7,
    medGrey: 0x8e949a, dkGrey: 0x41464c,
  };
  const _mats = {};
  const mat = (hex, name = 'metal', rough = 0.85, extra = {}) => {
    const k = hex + name + rough;
    if (!_mats[k]) {
      _mats[k] = new THREE.MeshStandardMaterial(Object.assign({
        color: hex, roughness: rough, metalness: name === 'metal' ? 0.12 : 0.0, name, side: THREE.DoubleSide,
      }, extra));
    }
    return _mats[k];
  };
  const M = {
    black: mat(C.black), hull: mat(C.hull), boot: mat(C.boot), buff: mat(C.buff), funnel: mat(C.funnel),
    timber: mat(C.timber, 'timber', 0.9), canvas: mat(C.canvas, 'canvas', 0.95), brass: mat(C.brass, 'metal', 0.45),
    white: mat(C.white), gris: mat(C.gris), deckGrey: mat(C.deckGrey), red: mat(C.red), yellow: mat(C.yellow),
    blue: mat(C.blue), alu: mat(C.alu, 'metal', 0.45), medGrey: mat(C.medGrey), dkGrey: mat(C.dkGrey),
    glass: mat(C.blue, 'glass', 0.15, { transparent: true, opacity: 0.6 }),
  };
  const add = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz); parent.add(mesh); return mesh;
  };
  const box = (parent, w, h, d, m, x, y, z, rx, ry, rz) => add(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  const cyl = (parent, rt, rb, h, m, x, y, z, seg = 12, rx, ry, rz) => add(parent, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, rx, ry, rz);
  // a cylinder lying along +Z (length h) centred at x,y,z
  const cylZ = (parent, rt, rb, h, m, x, y, z, seg = 10) => add(parent, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, Math.PI / 2, 0, 0);
  // a cylinder from point a to point b
  const rod = (parent, a, b, r, m, seg = 6) => {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    parent.add(mesh); return mesh;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // ---- generic grid mesh builder: fn(ti,tj) -> [x,y,z], ni x nj cells ----
  const grid = (ni, nj, fn, m, flip = false) => {
    const pos = new Float32Array((ni + 1) * (nj + 1) * 3); const idx = [];
    for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) {
      const p = fn(i / ni, j / nj); const k = (i * (nj + 1) + j) * 3; pos[k] = p[0]; pos[k + 1] = p[1]; pos[k + 2] = p[2];
    }
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      const a = i * (nj + 1) + j, b = a + nj + 1, c = b + 1, d = a + 1;
      if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals(); return new THREE.Mesh(geo, m);
  };

  // ---- lofted hull ----
  // P: { hb(z) deck half-breadth, deckY(z), keelY(z), fb(z) flat-bottom half width,
  //      p(z) bilge fullness (>1 fuller), w(z) V-weight, q flare exponent }
  const makeHull = (P) => {
    const X = (z, y) => {
      const k = P.keelY(z), d = P.deckY(z); const u = clamp((y - k) / Math.max(d - k, 1e-4), 0, 1);
      const hb = P.hb(z), fb = P.fb(z); const p = P.p(z), w = P.w(z);
      const round = 1 - Math.pow(1 - u, p); const vee = Math.pow(u, P.q || 0.7);
      return fb + (hb - fb) * (round * (1 - w) + vee * w);
    };
    const zs = (z0, z1, t) => lerp(z0, z1, 0.5 - 0.5 * Math.cos(Math.PI * t));
    // side sheet, s = +1 starboard (+x) or -1 port
    const sheet = (s, y0fn, y1fn, z0, z1, m, nz = 56, ny = 8) => grid(nz, ny, (ti, tj) => {
      const z = zs(z0, z1, ti); const ya = y0fn(z), yb = Math.max(y1fn(z), ya); const y = lerp(ya, yb, tj);
      return [s * X(z, y), y, z];
    }, m, s < 0);
    // horizontal strip between port and starboard at height yfn(z), half-breadth xfn(z)
    const strip = (yfn, xfn, z0, z1, m, camber = 0, nz = 56, nx = 4) => grid(nz, nx, (ti, tj) => {
      const z = zs(z0, z1, ti); const hx = xfn(z); const x = lerp(-hx, hx, tj);
      const c = hx > 1e-6 ? camber * (1 - (x / hx) * (x / hx)) : 0; return [x, yfn(z) + c, z];
    }, m, true);
    // vertical wall across the hull at z between y0..y1 (island end)
    const wall = (z, y0, y1, m, sign = 1, ny = 4, nx = 4) => grid(nx, ny, (ti, tj) => {
      const y = lerp(y0, y1, tj); const hx = X(z, y); return [lerp(-hx, hx, ti), y, z];
    }, m, sign > 0);
    // hull bands: bands = [[y0,y1,mat],...], lowest first; includes flat bottom & deck
    const hull = (parent, bands, z0, z1, deckMat, camber = 0.12) => {
      const grp = new THREE.Group();
      bands.forEach(([b0, b1, m], bi) => {
        for (const s of [1, -1]) grp.add(sheet(s, (z) => Math.max(b0, P.keelY(z)), (z) => Math.min(b1, P.deckY(z)), z0, z1, m));
        if (bi === 0) grp.add(strip(P.keelY, (z) => (P.keelY(z) > b1 ? 0 : P.fb(z)), z0, z1, m, 0, 56, 2));
      });
      if (deckMat) grp.add(strip(P.deckY, P.hb, z0, z1, deckMat, camber));
      parent.add(grp); return grp;
    };
    // raised island: sides from deck to deck+h, top deck, end walls at z0/z1
    const island = (parent, z0, z1, h, sideMat, deckMat, ends = [true, true], camber = 0.1) => {
      const grp = new THREE.Group();
      for (const s of [1, -1]) grp.add(sheet(s, P.deckY, (z) => P.deckY(z) + h, z0, z1, sideMat, 40, 2));
      grp.add(strip((z) => P.deckY(z) + h, P.hb, z0, z1, deckMat, camber, 40, 4));
      if (ends[0]) grp.add(wall(z0, P.deckY(z0) - 0.01, P.deckY(z0) + h, sideMat, -1));
      if (ends[1]) grp.add(wall(z1, P.deckY(z1) - 0.01, P.deckY(z1) + h, sideMat, 1));
      parent.add(grp); return grp;
    };
    // bulwark: thin outer + inner sheets with cap, along the deck edge
    const bulwark = (parent, z0, z1, h, m, t = 0.12) => {
      const grp = new THREE.Group();
      for (const s of [1, -1]) {
        grp.add(sheet(s, P.deckY, (z) => P.deckY(z) + h, z0, z1, m, 40, 1));
        grp.add(grid(40, 1, (ti, tj) => { const z = zs(z0, z1, ti); const y = P.deckY(z) + tj * h; return [s * (X(z, y) - t), y, z]; }, m, s > 0));
        grp.add(grid(40, 1, (ti, tj) => { const z = zs(z0, z1, ti); const y = P.deckY(z) + h; return [s * (X(z, y) - t * tj), y, z]; }, m, s < 0));
      }
      parent.add(grp); return grp;
    };
    // z where the keel/stern profile reaches height y, searching in [za,zb] (keelY increasing from za to zb)
    const zAt = (y, za, zb) => { for (let i = 0; i < 40; i++) { const zm = (za + zb) / 2; if (P.keelY(zm) < y) za = zm; else zb = zm; } return (za + zb) / 2; };
    // --- alternative strategy: waterline slices (lift model) from ExtrudeGeometry ---
    // bowRange/sternRange: [zStart, zEnd] over which keelY rises (for zAt); bands as in hull()
    const sliceHull = (parent, bands, bowRange, sternRange, nPer = 3, deckMat = null, zMid = 0) => {
      const grp = new THREE.Group();
      const zTop = Math.max(bowRange[1], sternRange[1]) ; const zBot = Math.min(bowRange[1], sternRange[1]);
      const yDeckMax = P.deckY(zMid);
      bands.forEach(([b0, b1, m]) => {
        const top = Math.min(b1, yDeckMax);
        for (let k = 0; k < nPer; k++) {
          const y0 = lerp(b0, top, k / nPer), y1 = lerp(b0, top, (k + 1) / nPer);
          const zb = P.keelY(bowRange[1] - 1e-3) > y1 ? zAt(y1, bowRange[0], bowRange[1]) : bowRange[1];
          const zsn = P.keelY(sternRange[1] + 1e-3) > y1 ? zAt(y1, sternRange[0], sternRange[1]) : sternRange[1];
          const s = new THREE.Shape(); const n = 48;
          for (let i = 0; i <= n; i++) { const z = lerp(zsn, zb, 0.5 - 0.5 * Math.cos(Math.PI * i / n)); const x = X(z, y1); if (i === 0) s.moveTo(x, -z); else s.lineTo(x, -z); }
          for (let i = n; i >= 0; i--) { const z = lerp(zsn, zb, 0.5 - 0.5 * Math.cos(Math.PI * i / n)); s.lineTo(-X(z, y1), -z); }
          const geo = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, steps: 1 });
          const mesh = new THREE.Mesh(geo, m); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y0; grp.add(mesh);
        }
      });
      parent.add(grp); return grp;
    };
    return { X, sheet, strip, wall, hull, island, bulwark, zAt, sliceHull, P };
  };
  // --- alternative strategy: primitives-assembled hull: box midbody + extruded wedge bow + half-round stern ---
  // returns nothing fancy; bands [[y0,y1,mat]] in y, plan: L, B, bowLen, sternLen, rake (m of stem rake)
  const primHull = (parent, L, B, bands, bowLen, sternLen, deckMat, rake = 2) => {
    const grp = new THREE.Group();
    const zb0 = L / 2 - bowLen, zs0 = -L / 2 + sternLen;
    const D = bands[bands.length - 1][1];
    bands.forEach(([y0, y1, m]) => {
      const h = y1 - y0; const yc = (y0 + y1) / 2;
      box(grp, B, h, zb0 - zs0, m, 0, yc, (zb0 + zs0) / 2);
      // bow wedge: pointed plan, stem raked by shifting the tip with height
      const tip = L / 2 - rake * (1 - yc / D);
      const s = new THREE.Shape(); s.moveTo(B / 2, -zb0); s.quadraticCurveTo(B / 2 * 0.9, -tip + (tip - zb0) * 0.45, 0, -tip); s.quadraticCurveTo(-B / 2 * 0.9, -tip + (tip - zb0) * 0.45, -B / 2, -zb0); s.lineTo(B / 2, -zb0);
      const bg = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }), m); bg.rotation.x = -Math.PI / 2; bg.position.y = y0; grp.add(bg);
      // stern: half ellipse in plan
      const e = new THREE.Shape(); e.moveTo(B / 2, -zs0); e.absellipse(0, -zs0, B / 2, sternLen, 0, Math.PI, false, 0); e.lineTo(B / 2, -zs0);
      const sg = new THREE.Mesh(new THREE.ExtrudeGeometry(e, { depth: h, bevelEnabled: false }), m); sg.rotation.x = -Math.PI / 2; sg.position.y = y0; grp.add(sg);
    });
    parent.add(grp); return grp;
  };

  // ---- block letters (5x7) from thin boxes; letters in XY plane facing +Z ----
  const FONT = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  };
  // one letter, origin at its bottom-left, size = height
  const letter = (ch, size, m, thick = 0.04) => {
    const grp = new THREE.Group(); const rows = FONT[ch] || FONT[' ']; const cell = size / 7;
    for (let r = 0; r < 7; r++) {
      const row = rows[r]; let c = 0;
      while (c < 5) {
        if (row[c] === '1') {
          let e = c; while (e < 5 && row[e] === '1') e++;
          box(grp, (e - c) * cell, cell, thick, m, (c + (e - c) / 2) * cell, (6 - r + 0.5) * cell, 0); c = e;
        } else c++;
      }
    }
    return grp;
  };
  const textWidth = (str, size) => str.length * size * 6 / 7 - size / 7;
  // flat text group centred at origin, facing +Z
  const text = (str, size, m, thick = 0.04) => {
    const grp = new THREE.Group(); const w = textWidth(str, size);
    [...str].forEach((ch, i) => { const l = letter(ch, size, m, thick); l.position.set(i * size * 6 / 7 - w / 2, -size / 2, 0); grp.add(l); });
    return grp;
  };
  // text on a hull side: each letter at the local half-breadth, yawed to the surface.
  // side +1 starboard (reads correctly from +x; letters advance toward -z); side -1 port.
  const hullText = (parent, H, str, zc, y, size, m, side, thick = 0.05) => {
    const grp = new THREE.Group(); const w = textWidth(str, size); const adv = size * 6 / 7;
    [...str].forEach((ch, i) => {
      const off = i * adv - w / 2 + adv / 2 - size / 14;
      const z = zc - side * off; const x = H.X(z, y) + thick;
      const dz = 0.5; const dx = (H.X(z + dz, y) - H.X(z - dz, y)) / (2 * dz);
      const yaw = side > 0 ? Math.PI / 2 + Math.atan(dx) : -Math.PI / 2 - Math.atan(dx);
      const l = letter(ch, size, m, thick); l.position.set(-size * 5 / 14, -size / 2, 0);
      const piv = new THREE.Group(); piv.add(l); piv.position.set(side * x, y, z); piv.rotation.y = yaw; grp.add(piv);
    });
    parent.add(grp); return grp;
  };

  // ---- railing along a polyline of points: stanchions + two rails ----
  const rails = (parent, pts, h = 1.0, m = M.black, every = 1) => {
    const grp = new THREE.Group();
    pts.forEach((p, i) => { if (i % every === 0) box(grp, 0.05, h, 0.05, m, p.x, p.y + h / 2, p.z); });
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      rod(grp, V(a.x, a.y + h, a.z), V(b.x, b.y + h, b.z), 0.03, m, 4);
      rod(grp, V(a.x, a.y + h * 0.55, a.z), V(b.x, b.y + h * 0.55, b.z), 0.02, m, 4);
    }
    parent.add(grp); return grp;
  };
  // deck-edge points along one side from z0 to z1
  const edgePts = (side, hbfn, yfn, z0, z1, step = 2, inset = 0.25) => {
    const pts = []; const n = Math.max(2, Math.round(Math.abs(z1 - z0) / step));
    for (let i = 0; i <= n; i++) { const z = lerp(z0, z1, i / n); pts.push(V(side * Math.max(hbfn(z) - inset, 0), yfn(z), z)); }
    return pts;
  };

  // ---- lifeboat (length along z) with canvas cover; keel at local y=0 ----
  const lifeboat = (parent, len, beam, depth, x, y, z, hullMat = M.white, coverMat = M.canvas) => {
    const grp = new THREE.Group();
    const bh = grid(14, 6, (ti, tj) => {
      const zz = -len / 2 + len * ti; const e = Math.sqrt(Math.max(0, 1 - Math.pow((ti - 0.5) * 2, 2)));
      const a = tj * Math.PI; const x = -beam / 2 * e * Math.cos(a); const y = depth * (1 - Math.sin(a) * (0.35 + 0.65 * e));
      return [x, y, zz];
    }, hullMat, true);
    grp.add(bh);
    // gunwale strip
    box(grp, beam * 0.98, 0.08, len * 0.92, hullMat, 0, depth, 0);
    box(grp, beam * 0.86, 0.16, len * 0.8, coverMat, 0, depth + 0.1, 0);
    grp.position.set(x, y, z); parent.add(grp); return grp;
  };
  // davit pair for a boat, arms rising h and reaching outboard 'reach' (side = +1/-1)
  const davits = (parent, x, y, z, len, side, h = 2.2, reach = 1.2, m = M.buff) => {
    for (const dz of [-len * 0.35, len * 0.35]) {
      const a = V(x, y, z + dz), b = V(x, y + h * 0.7, z + dz), c = V(x + side * reach, y + h, z + dz);
      rod(parent, a, b, 0.07, m, 6); rod(parent, b, c, 0.07, m, 6);
    }
  };
  // three-bladed propeller (axis along z), brass
  const propeller = (parent, r, x, y, z, blades = 3) => {
    const grp = new THREE.Group(); cylZ(grp, r * 0.18, r * 0.18, r * 0.5, M.brass, 0, 0, 0, 8);
    for (let i = 0; i < blades; i++) {
      const a = i * Math.PI * 2 / blades; const b = box(grp, r * 0.42, r * 0.95, r * 0.08, M.brass, Math.sin(a) * r * 0.5, Math.cos(a) * r * 0.5, 0);
      b.rotation.z = -a; b.rotation.y = 0.5;
    }
    grp.position.set(x, y, z); parent.add(grp); return grp;
  };
  // stockless anchor hung at the hawse
  const anchor = (parent, x, y, z, scale = 1, m = M.black) => {
    const grp = new THREE.Group();
    box(grp, 0.12, 1.4, 0.12, m, 0, 0.1, 0); box(grp, 0.9, 0.16, 0.14, m, 0, -0.55, 0);
    box(grp, 0.18, 0.55, 0.2, m, -0.36, -0.35, 0.02); box(grp, 0.18, 0.55, 0.2, m, 0.36, -0.35, 0.02);
    grp.scale.setScalar(scale); grp.position.set(x, y, z); parent.add(grp); return grp;
  };
  // a row of n windows (thin boxes) centred at x,y,z, facing direction yaw ry (0 = facing +z)
  const windows = (parent, n, w, h, x, y, z, ry, pitch, m = M.glass) => {
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * pitch; const b = box(parent, w, h, 0.03, m, 0, 0, 0);
      b.position.set(x + Math.cos(ry) * off, y, z - Math.sin(ry) * off); b.rotation.y = ry;
    }
  };
  const named = (parent, name, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); return o; };
  // ===== German tramp freighter GLUCKSBURG, 118 x 16 m, candidate A: lofted hull =====
  const L = 118, B = 16, D = 9.6, WL = 6.5;
  const deckY = (z) => D + (z > 0 ? 1.7 : 0.9) * Math.pow(z / 59, 2);
  const keelY = (z) => {
    if (z > 54) { const s = (z - 54) / 5; return deckY(z) * Math.pow(s, 2.2); }
    if (z < -48) { const s = (-48 - z) / 11; return deckY(z) * (1 - Math.pow(1 - s, 3.2)); }
    return 0;
  };
  const hb = (z) => {
    const t = (z + 59) / 118;
    if (t > 0.72) { const u = clamp((t - 0.72) / 0.28, 0, 1); return 8 * (1 - Math.pow(u, 1.7)); }
    if (t < 0.3) { const v = clamp((0.3 - t) / 0.3, 0, 1); return 8 * Math.pow(1 - Math.pow(v, 2.4), 0.8); }
    return 8;
  };
  const P = {
    hb, deckY, keelY,
    fb: (z) => 0.62 * hb(z) * smooth((z + 48) / 10) * smooth((54 - z) / 10),
    p: (z) => 1.3 + 1.7 * smooth((z + 40) / 16) * smooth((50 - z) / 16),
    w: (z) => 0.85 * (1 - smooth((z + 44) / 14) * smooth((52 - z) / 14)),
    q: 0.75,
  };
  const H = makeHull(P);
  const hullGrp = new THREE.Group(); g.add(hullGrp);
  H.hull(hullGrp, [[0, WL + 0.6, M.boot], [WL + 0.6, 30, M.hull]], -59, 59, M.dkGrey);
  // three islands
  const fcH = 2.4;
  H.island(hullGrp, 47, 59, fcH, M.hull, M.dkGrey, [true, false]);
  H.island(hullGrp, -59, -46, fcH, M.hull, M.dkGrey, [false, true]);
  H.island(hullGrp, -14, 8, fcH, M.hull, M.timber, [true, true]);
  // bulwarks along the well decks
  H.bulwark(hullGrp, 8, 47, 1.1, M.hull);
  H.bulwark(hullGrp, -46, -14, 1.1, M.hull);

  // ---- superstructure on the bridge island ----
  const bd = deckY(-3) + fcH; // bridge deck level ~12.0
  const sup = new THREE.Group(); g.add(sup);
  box(sup, 12, 2.5, 15, M.buff, 0, bd + 1.25, -3);          // boat-deck house
  const boat = bd + 2.5;                                       // boat deck ~14.5
  box(sup, 9, 2.4, 6, M.buff, 0, boat + 1.2, 1);              // wheelhouse / chartroom block
  box(sup, 16, 0.25, 3.2, M.buff, 0, boat + 0.12, 3.2);        // bridge wings platform
  box(sup, 9.4, 0.15, 6.4, M.timber, 0, boat + 2.47, 1);       // wheelhouse timber roof
  windows(sup, 7, 0.9, 0.8, 0, boat + 1.6, 4.02, 0, 1.2);      // wheelhouse windows (forward)
  windows(sup, 3, 0.9, 0.8, 4.52, boat + 1.6, 1, Math.PI / 2, 1.5);
  windows(sup, 3, 0.9, 0.8, -4.52, boat + 1.6, 1, -Math.PI / 2, 1.5);
  // portholes on boat-deck house sides
  for (let i = 0; i < 7; i++) { cyl(sup, 0.22, 0.22, 0.06, M.glass, 6.02, bd + 1.4, -9 + i * 2, 8, 0, 0, Math.PI / 2); cyl(sup, 0.22, 0.22, 0.06, M.glass, -6.02, bd + 1.4, -9 + i * 2, 8, 0, 0, Math.PI / 2); }
  // bridge wing rails and the boat deck rails
  rails(sup, [V(-7.9, boat + 0.25, 4.8), V(-7.9, boat + 0.25, 1.6), V(-4.6, boat + 0.25, 1.6)], 1.0, M.buff);
  rails(sup, [V(7.9, boat + 0.25, 4.8), V(7.9, boat + 0.25, 1.6), V(4.6, boat + 0.25, 1.6)], 1.0, M.buff);
  rails(sup, [V(-7.9, boat + 0.25, 4.8), V(7.9, boat + 0.25, 4.8)], 1.0, M.buff);
  rails(sup, [V(-5.8, boat, -2), V(-5.8, boat, -10.3), V(5.8, boat, -10.3), V(5.8, boat, -2)], 0.9, M.buff, 1);
  // funnel: tall, thin, buff with 1 m black top; steam pipe, guy wires
  const fz = -7.5;
  cyl(sup, 1.35, 1.45, 10, M.funnel, 0, boat + 5, fz, 20);
  cyl(sup, 1.36, 1.36, 1.0, M.black, 0, boat + 9.5, fz, 20);
  cyl(sup, 0.12, 0.12, 8, M.black, 1.5, boat + 5, fz - 0.6, 6);
  for (const s of [1, -1]) rod(sup, V(0, boat + 9, fz), V(s * 5.5, boat, fz - 0.8), 0.025, M.black, 4);
  // cowl ventilators on the boat deck
  for (const [x, z] of [[-4, -4.5], [4, -4.5], [-3, -10], [3, -10]]) { cyl(sup, 0.35, 0.35, 2.6, M.buff, x, boat + 1.3, z, 10); add(sup, new THREE.SphereGeometry(0.6, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.buff, x, boat + 2.6, z, 0, 0, 0); }
  // engine-room skylight
  box(sup, 3, 0.8, 4, M.buff, 0, boat + 0.4, -7.5); box(sup, 3.4, 0.2, 4.4, M.timber, 0, boat + 0.9, -7.5);
  // lifeboats in davits, two each side
  for (const s of [1, -1]) for (const z of [-1, -10]) {
    lifeboat(sup, 7, 2.2, 0.9, s * 7.4, boat + 0.9, z);
    davits(sup, s * 6.0, boat, z, 7, s, 2.6, 1.5, M.buff);
    for (const dz of [-2.45, 2.45]) rod(sup, V(s * 7.5, boat + 2.6, z + dz), V(s * 7.4, boat + 1.8, z + dz), 0.02, M.black, 4);
  }
  // ladders / companionways from bridge deck to boat deck
  box(sup, 0.9, 2.5, 3, M.black, 6.4, bd + 1.25, -12, Math.PI / 5, 0, 0);
  box(sup, 0.9, 2.5, 3, M.black, -6.4, bd + 1.25, -12, Math.PI / 5, 0, 0);
  // rails around the bridge island deck edge
  rails(sup, edgePts(1, hb, (z) => deckY(z) + fcH, -13.5, 7.5, 2), 1.0, M.buff);
  rails(sup, edgePts(-1, hb, (z) => deckY(z) + fcH, -13.5, 7.5, 2), 1.0, M.buff);
  named(sup, 'bridge', 0, boat + 1.7, 1.5);

  // ---- cargo gear ----
  const hatch = (zc, len, wid) => {
    const y = deckY(zc); box(g, wid, 1.0, len, M.dkGrey, 0, y + 0.5, zc);
    box(g, wid + 0.2, 0.25, len + 0.2, M.canvas, 0, y + 1.12, zc);
    // tarpaulin battens / wedges as thin strips
    for (let i = -1; i <= 1; i++) box(g, wid + 0.3, 0.1, 0.15, M.black, 0, y + 1.28, zc + i * len * 0.35);
  };
  hatch(37, 10, 7); hatch(18, 10, 7); hatch(-24, 10, 7); hatch(-37.5, 9, 7);
  const mast = (zc, hTot, withCross = true) => {
    const y = deckY(zc); cyl(g, 0.28, 0.42, hTot, M.buff, 0, y + hTot / 2, zc, 10);
    cyl(g, 0.12, 0.2, 9, M.buff, 0, y + hTot + 4.5, zc, 8);              // topmast
    if (withCross) { box(g, 7, 0.18, 0.2, M.buff, 0, y + hTot - 1.5, zc); box(g, 0.2, 0.5, 0.3, M.buff, 0, y + hTot - 1.2, zc); }
    box(g, 4.2, 0.3, 0.6, M.buff, 0, y + 8, zc);                           // derrick table
    return y;
  };
  const boom = (base, tip, r = 0.16) => { rod(g, base, tip, r, M.buff, 8); };
  // foremast between hatch 1 & 2 with four derricks (two forward, two aft)
  const ym = mast(27.5, 20);
  for (const s of [1, -1]) { boom(V(s * 0.9, ym + 2.2, 28.5), V(s * 2.2, ym + 9.5, 39)); boom(V(s * 0.9, ym + 2.2, 26.5), V(s * 2.2, ym + 9.5, 16)); }
  for (const s of [1, -1]) { rod(g, V(s * 2.2, ym + 9.5, 39), V(0, ym + 17.5, 27.7), 0.03, M.black, 4); rod(g, V(s * 2.2, ym + 9.5, 16), V(0, ym + 17.5, 27.3), 0.03, M.black, 4); }
  // mainmast between hatch 3 & 4
  const ya = mast(-30.5, 20);
  for (const s of [1, -1]) { boom(V(s * 0.9, ya + 2.2, -29.5), V(s * 2.2, ya + 9.5, -19)); boom(V(s * 0.9, ya + 2.2, -31.5), V(s * 2.2, ya + 9.5, -41)); }
  for (const s of [1, -1]) { rod(g, V(s * 2.2, ya + 9.5, -19), V(0, ya + 17.5, -30.3), 0.03, M.black, 4); rod(g, V(s * 2.2, ya + 9.5, -41), V(0, ya + 17.5, -30.7), 0.03, M.black, 4); }
  // goalpost kingposts: forward pair abaft the forecastle, aft pair abaft the bridge island
  const goalpost = (zc, dir) => {
    const y = deckY(zc);
    for (const s of [1, -1]) {
      cyl(g, 0.4, 0.5, 13, M.buff, s * 5.2, y + 6.5, zc, 10);
      boom(V(s * 5.0, y + 2.0, zc + dir * 0.6), V(s * 3.0, y + 8.5, zc + dir * 11.5));
      rod(g, V(s * 3.0, y + 8.5, zc + dir * 11.5), V(s * 5.2, y + 12.6, zc), 0.03, M.black, 4);
      box(g, 1.6, 1.1, 1.8, M.buff, s * 3.6, y + 0.55, zc - dir * 0.8);      // winch house
    }
    box(g, 11, 0.5, 0.5, M.buff, 0, y + 12.8, zc);                            // crossbar
  };
  goalpost(45, -1);
  goalpost(-17, 1);
  // deck winches at the masts
  for (const z of [30.5, 24.5, -27.5, -33.5]) box(g, 2.2, 0.9, 1.2, M.black, 0, deckY(z) + 0.45, z);

  // ---- bow & stern fittings ----
  const fcY = deckY(58) + fcH;
  box(g, 1.2, 1.4, 2.6, M.black, 0, fcY + 0.7, 52);                          // windlass
  for (const s of [1, -1]) { cyl(g, 0.45, 0.45, 1.2, M.black, s * 2.4, fcY + 0.6, 49, 10); }  // bollards
  for (const s of [1, -1]) {
    const y = deckY(56) - 1.2; const x = H.X(55.5, y); anchor(g, s * (x + 0.15), y, 55.5, 1.4);
    cyl(g, 0.5, 0.5, 0.15, M.black, s * (x + 0.02), y + 0.9, 56.2, 10, 0, 0, Math.PI / 2);
  }
  rails(g, edgePts(1, hb, (z) => deckY(z) + fcH, 47.5, 58.6, 1.8), 1.0, M.buff);
  rails(g, edgePts(-1, hb, (z) => deckY(z) + fcH, 47.5, 58.6, 1.8), 1.0, M.buff);
  rails(g, edgePts(1, hb, (z) => deckY(z) + fcH, -58.3, -46.5, 1.8), 1.0, M.buff);
  rails(g, edgePts(-1, hb, (z) => deckY(z) + fcH, -58.3, -46.5, 1.8), 1.0, M.buff);
  // poop: docking bridge, steering gear house, bollards
  const ppY = deckY(-52) + fcH;
  box(g, 5, 2.2, 5, M.buff, 0, ppY + 1.1, -51); box(g, 5.4, 0.15, 5.4, M.timber, 0, ppY + 2.28, -51);
  box(g, 13, 0.2, 1.2, M.buff, 0, ppY + 2.5, -48); for (const s of [1, -1]) box(g, 0.12, 2.5, 0.12, M.buff, s * 6.2, ppY + 1.25, -48);
  rails(g, [V(-6.4, ppY + 2.6, -47.4), V(6.4, ppY + 2.6, -47.4)], 1.0, M.buff);
  for (const s of [1, -1]) cyl(g, 0.45, 0.45, 1.2, M.black, s * 3, ppY + 0.6, -56, 10);
  cyl(g, 0.3, 0.3, 4, M.buff, 0, ppY + 2, -55, 8); // ensign staff-ish jack post
  // propeller, shaft, rudder
  const pz = -50.6;
  cylZ(g, 0.35, 0.35, 5, M.black, 0, 3.2, pz + 2.5, 8);
  propeller(g, 2.1, 0, 3.2, pz, 3);
  box(g, 0.35, 5.4, 3.0, M.boot, 0, 4.3, pz - 2.2); cyl(g, 0.22, 0.22, 4.4, M.boot, 0, 6.5, pz - 2.9, 8);
  // hull name on both bows and the stern
  hullText(g, H, 'GLUCKSBURG', 49.5, 8.6, 1.0, M.white, 1);
  hullText(g, H, 'GLUCKSBURG', 49.5, 8.6, 1.0, M.white, -1);
  {
    const y0 = 8.9, y1 = 9.7; const za = H.zAt(y0, -59, -48), zb = H.zAt(y1, -59, -48);
    const t = text('GLUCKSBURG', 0.7, M.white, 0.05); t.rotation.y = Math.PI; t.rotation.x = Math.atan2(za - zb, y1 - y0) * -1;
    const piv = new THREE.Group(); piv.add(t); piv.position.set(0, (y0 + y1) / 2, (za + zb) / 2 - 0.05); piv.rotation.x = Math.atan2(zb - za, y1 - y0); t.rotation.x = 0; g.add(piv);
  }
  g.userData = { length: 118, beam: 16, waterline: 6.5, kind: 'merchant', name: 'German freighter' };
  // ---- measurement / placement (ASSET-BRIEF.md) ----
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
