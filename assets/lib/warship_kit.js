// Shared pieces for the larger warships: a lofted hull painted in bands (red anti-fouling, black
// boot-topping, grey topsides) under a cambered deck, and the turrets, funnels and masts that
// stand on it. Bow along +z, keel at y = 0, metres.
export function warshipKit(THREE) {
  const mats = {};
  const mat = (hex, rough = 0.8, metal = 0.12) => (mats[hex + ':' + rough] ||= new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, side: THREE.DoubleSide }));
  const add = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; };
  const box = (p, w, h, d, m, x, y, z, ry = 0) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, 0, ry, 0);
  const cylY = (p, rt, rb, h, m, x, y, z, seg = 16) => add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
  const cylZ = (p, rt, rb, h, m, x, y, z, seg = 10) => add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, Math.PI / 2, 0, 0);
  const named = (p, name, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); p.add(o); return o; };
  const rod = (p, a, b, r, m) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
    o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(o); return o;
  };
  const grid = (ni, nj, fn, m) => {
    const pos = new Float32Array((ni + 1) * (nj + 1) * 3), idx = [];
    for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) { const q = fn(i / ni, j / nj), k = (i * (nj + 1) + j) * 3; pos[k] = q[0]; pos[k + 1] = q[1]; pos[k + 2] = q[2]; }
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) { const a = i * (nj + 1) + j, b = a + nj + 1; idx.push(a, b, b + 1, a, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, m);
  };

  // L length, B beam, D deck height amidships above the keel, WL waterline, bowRise sheer at the stem
  function hull(g, { L, B, D, WL, bowRise = 3, sternRise = 0.8, bowLen = 0.2, sternLen = 0.12, grey, deck }) {
    const red = mat(0x7a2a24, 0.9, 0), boot = mat(0x16181a, 0.8, 0);
    const hb = (z) => {
      const t = (z + L / 2) / L;
      if (t > 1 - bowLen) { const u = (t - (1 - bowLen)) / bowLen; return (B / 2) * (1 - Math.pow(u, 1.7)) + 0.15; }
      if (t < sternLen) { const v = (sternLen - t) / sternLen; return (B / 2) * (1 - 0.5 * v * v); }
      return B / 2;
    };
    const deckY = (z) => { const s = z / (L / 2); return D + (s > 0 ? bowRise * Math.pow(s, 2.4) : sternRise * Math.pow(-s, 2)); };
    const keelY = (z) => { const t = (z + L / 2) / L; return t > 0.93 ? D * 0.55 * Math.pow((t - 0.93) / 0.07, 2) : 0; };
    // side from y0 to y1, rounded at the bilge
    const sideX = (z, y) => { const k = keelY(z), tt = Math.min(1, Math.max(0, (y - k) / Math.max(0.1, deckY(z) - k))); return hb(z) * (1 - Math.pow(1 - tt, 5)); };
    const band = (y0f, y1f, m) => {
      for (const s of [1, -1]) {
        g.add(grid(80, 4, (ti, tj) => {
          const z = -L / 2 + ti * L, y0 = Math.max(keelY(z), y0f(z)), y1 = Math.max(y0, y1f(z)), y = y0 + (y1 - y0) * tj;
          return [s * sideX(z, y), y, z];
        }, m));
      }
    };
    band(() => 0, () => WL - 0.4, red);
    band(() => WL - 0.4, () => WL + 0.5, boot);
    band(() => WL + 0.5, (z) => deckY(z), grey);
    // bottom and deck
    g.add(grid(80, 6, (ti, tj) => { const z = -L / 2 + ti * L, k = keelY(z), w = sideX(z, k + 0.05); return [(tj * 2 - 1) * w, k, z]; }, red));
    g.add(grid(80, 8, (ti, tj) => { const z = -L / 2 + ti * L, x = (tj * 2 - 1) * hb(z); return [x, deckY(z) + 0.25 * (1 - (x / (B / 2)) ** 2), z]; }, deck));
    // transom
    g.add(grid(1, 8, (ti, tj) => { const z = -L / 2, y = keelY(z) + (deckY(z) - keelY(z)) * ti; return [(tj * 2 - 1) * sideX(z, y), y, z]; }, grey));
    return { hb, deckY };
  }

  // a big-gun turret: armoured house on a barbette, barrels along +z (or -z when facing aft)
  function turret(g, { z, y, w, d, h, barrels, bore = 0.34, len = 15, aft = false, grey, dark }) {
    const t = new THREE.Group(); t.position.set(0, y, z); if (aft) t.rotation.y = Math.PI; g.add(t);
    cylY(t, w * 0.55, w * 0.58, 1.6, grey, 0, 0.4, 0, 24);
    const house = box(t, w, h, d, grey, 0, 1.2 + h / 2, -d * 0.08);
    box(t, w * 0.92, 0.35, d * 0.9, dark, 0, 1.2 + h + 0.1, -d * 0.08);
    box(t, w * 1.25, 0.5, 1.2, grey, 0, 1.2 + h + 0.3, -d * 0.45);     // rangefinder arms across the back of the roof
    const spacing = Math.min(1.6, (w * 0.8) / barrels);
    for (let i = 0; i < barrels; i++) {
      const x = (i - (barrels - 1) / 2) * spacing;
      cylZ(t, bore, bore * 1.35, len, dark, x, 1.2 + h * 0.45, d * 0.42 + len / 2);
    }
    return house;
  }
  function funnel(g, { z, y, rx, rz, h, rake = 0.08, grey, dark }) {
    const f = new THREE.Group(); f.position.set(0, y, z); f.rotation.x = -rake; g.add(f);
    const body = cylY(f, 1, 1.08, h, grey, 0, h / 2, 0, 24); body.scale.set(rx, 1, rz);
    const cap = cylY(f, 1.02, 1.02, 0.7, dark, 0, h + 0.1, 0, 24); cap.scale.set(rx, 1, rz);
    return f;
  }
  function pole(g, { z, y, h, r = 0.3, m, yard = 8 }) {
    cylY(g, r * 0.5, r, h, m, 0, y + h / 2, z, 8);
    box(g, yard, 0.25, 0.25, m, 0, y + h * 0.78, z);
  }
  function tripod(g, { z, y, h, spread = 3.2, m, top }) {
    const tip = new THREE.Vector3(0, y + h, z);
    rod(g, new THREE.Vector3(0, y, z + 0.6), tip, 0.55, m);
    for (const s of [1, -1]) rod(g, new THREE.Vector3(s * spread, y, z - spread * 1.1), tip, 0.4, m);
    if (top) box(g, 5, 2.6, 5, top, 0, y + h + 1.3, z);
  }
  function boat(g, x, y, z, len, m) { const b = cylZ(g, 0.9, 0.9, len, m, x, y, z, 10); b.scale.set(1.2, 0.7, 1); return b; }

  return { mat, add, box, cylY, cylZ, named, rod, grid, hull, turret, funnel, pole, tripod, boat };
}
