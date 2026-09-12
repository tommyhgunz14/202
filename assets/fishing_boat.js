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
  // ===== Andalusian / Moroccan wooden motor fishing boat, c.1940, 16 x 4.5 m, double-ended =====
  const C4 = {
    white: 0xeeeeea, blue: 0x1f3468, red: 0xa02a30, timber: 0xb08a5a, canvas: 0xb9b09a,
    black: 0x141517, brass: 0xb08d3e,
  };
  const _m4 = {};
  const mat4 = (hex, name = 'metal', rough = 0.85, extra = {}) => { const k = 'f' + hex + name + rough; if (!_m4[k]) _m4[k] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: name === 'metal' ? 0.1 : 0.0, name, side: THREE.DoubleSide }, extra)); return _m4[k]; };
  const F = {
    white: mat4(C4.white), blue: mat4(C4.blue), red: mat4(C4.red), timber: mat4(C4.timber, 'timber', 0.9),
    canvas: mat4(C4.canvas, 'canvas', 0.95), black: mat4(C4.black), brass: mat4(C4.brass, 'metal', 0.45),
  };

  const L = 16, B = 4.5, D = 2.7, WL = 1.2;
  const bowLen = 5, sternLen = 4;
  const deckY = (z) => {
    const s = z / (L / 2);
    let y = D;
    if (s > 0) y += 2.3 * Math.pow(s, 2.6);
    else y += 1.1 * Math.pow(-s, 2.6);
    return y;
  };
  const keelY = (z) => {
    if (z > L / 2 - bowLen) { const t = (z - (L / 2 - bowLen)) / bowLen; return deckY(z) * Math.pow(t, 1.7); }
    if (z < -(L / 2 - sternLen)) { const t = (-(L / 2 - sternLen) - z) / sternLen; return deckY(z) * Math.pow(t, 1.7); }
    return 0;
  };
  const hb = (z) => {
    const t = (z + L / 2) / L;
    if (t > 0.6) { const u = clamp((t - 0.6) / 0.4, 0, 1); return (B / 2) * (1 - Math.pow(u, 1.3)); }
    if (t < 0.32) { const v = clamp((0.32 - t) / 0.32, 0, 1); return (B / 2) * (1 - Math.pow(v, 1.4)); }
    return B / 2;
  };
  const P = {
    hb, deckY, keelY,
    fb: (z) => 0.12 * hb(z),
    p: (z) => 1.3,
    w: (z) => 0.5,
    q: 0.8,
  };
  const H = makeHull(P);
  const hullGrp = new THREE.Group(); g.add(hullGrp);
  H.hull(hullGrp, [[0, WL - 0.15, F.white], [WL - 0.15, WL + 0.2, F.red], [WL + 0.2, 20, F.white]], -L / 2, L / 2, F.timber, 0.06);
  // blue sheer strake: a narrow band immediately below the gunwale, following the sheer
  for (const s of [1, -1]) hullGrp.add(H.sheet(s, (z) => Math.max(WL + 0.4, deckY(z) - 0.35), deckY, -L / 2, L / 2, F.blue, 48, 2));
  H.bulwark(hullGrp, -L / 2 + 2.2, L / 2 - 3.2, 0.35, F.timber, 0.06);

  // ---- rubbing strake / gunwale rail rod along both sides ----
  for (const s of [1, -1]) rails(g, edgePts(s, hb, (z) => deckY(z) + 0.02, -L / 2 + 2.4, L / 2 - 3.4, 1.2, 0.1), 0.32, F.timber);

  // ---- bow fitting: samson post ----
  cyl(g, 0.09, 0.11, 0.6, F.timber, 0, deckY(L / 2 - 3) + 0.3, L / 2 - 3, 8);

  // ---- mast, lateen yard with furled sail, boom ----
  const mastZ = 1.5, my = deckY(mastZ);
  cyl(g, 0.13, 0.17, 7.2, F.timber, 0, my + 3.6, mastZ, 10);
  // lateen yard: long spar slung at an angle across the mast, with a furled sail roll lashed along it
  const yardLen = 8.5;
  const yA = V(-0.3, my + 1.0, mastZ - 1.0);
  const yB = V(0.3, my + 6.6, mastZ + yardLen - 1.0);
  rod(g, yA, yB, 0.09, F.timber, 8);
  // furled sail: a canvas roll bundled along the upper two-thirds of the yard
  const sA = new THREE.Vector3().lerpVectors(yA, yB, 0.28);
  const sB = new THREE.Vector3().lerpVectors(yA, yB, 0.98);
  rod(g, sA, sB, 0.16, F.canvas, 8);
  // a short boom near deck level for the small jib/steadying sail
  rod(g, V(0, my + 1.2, mastZ), V(0, my + 0.7, mastZ - 3.2), 0.06, F.timber, 6);
  for (const s of [1, -1]) rod(g, V(s * 1.6, my + 0.1, mastZ + 1.6), V(0, my + 3.2, mastZ), 0.03, F.black, 4);

  // ---- net pile and floats amidships, forward of the wheelhouse ----
  const netZ = -2.2, netY = deckY(netZ);
  const netPile = new THREE.Group(); g.add(netPile);
  for (let i = 0; i < 5; i++) { const a = i * 1.15; box(netPile, 1.0, 0.28 + 0.05 * (i % 2), 1.3, F.canvas, Math.cos(a) * 0.35, netY + 0.16 + 0.02 * i, netZ + Math.sin(a) * 0.35, 0, a * 0.6, 0); }
  for (let i = 0; i < 6; i++) { const a = i * 1.05; cyl(netPile, 0.11, 0.11, 0.12, F.red, Math.cos(a) * 0.9, netY + 0.42, netZ + 0.7 + Math.sin(a) * 0.5, 8); }

  // ---- small wheelhouse aft, exhaust pipe, rudder ----
  const whZ = -4.6, whY = deckY(whZ);
  const wh = new THREE.Group(); g.add(wh);
  box(wh, 2.0, 1.7, 1.9, F.white, 0, whY + 0.85, whZ);
  windows(wh, 2, 0.5, 0.5, 0, whY + 1.1, whZ + 0.96, 0, 0.7);
  box(wh, 2.15, 0.1, 2.05, F.timber, 0, whY + 1.75, whZ);       // roof
  cyl(wh, 0.28, 0.32, 0.9, F.timber, 0.7, whY + 0.45, whZ + 1.1, 8); // helm/binnacle stub abaft the house
  cyl(g, 0.06, 0.06, 1.6, F.black, 0.85, whY + 2.6, whZ - 0.6, 8);   // small exhaust pipe
  named(wh, 'bridge', 0, whY + 1.1, whZ + 0.9);
  // rudder hung on the sternpost, with a tiller
  const sy = keelY(-L / 2 + 1.2) + 0.1;
  box(g, 0.1, 1.3, 0.9, F.timber, 0, sy + 0.65, -L / 2 + 0.9, 0.15, 0, 0);
  rod(g, V(0, whY + 0.5, -L / 2 + 1.4), V(0, whY + 0.9, -L / 2 + 2.6), 0.05, F.timber, 6);

  // ---- propeller shaft (small motor boat, single screw) ----
  cylZ(g, 0.05, 0.07, 1.6, F.black, 0, keelY(-L / 2 + 2) + 0.35, -L / 2 + 2.2, 6);
  propeller(g, 0.42, 0, keelY(-L / 2 + 1.3) + 0.3, -L / 2 + 1.3, 3);

  g.userData = { length: 16, beam: 4.5, waterline: 1.2, kind: 'neutral', name: 'Fishing boat' };
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
