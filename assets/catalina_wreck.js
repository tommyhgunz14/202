// Where a Catalina has ditched: what floats after a flying boat breaks up on the water. The tail
// unit is still up, the fin canted over, and an outer wing panel with its float lies awash beside
// the broken hull. Seven men are left, the seven who were saved: six in the yellow multi-seat
// dinghy, one of them waving, and one holding on in the water beside it. A fluorescein marker stains
// the sea green beside them. Cushions, panels and a spread of fuel sheen round it all.
// Representative of a ditching in general, not a record of how W8407 lay.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (c, r = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const GREY = mat(0x5d6563, 0.75), DKGREY = mat(0x3f4644, 0.8), WHITE = mat(0xd9dcd8, 0.7), DINGHY = mat(0xe0a526, 0.8),
    DINGHY_DK = mat(0xb07d18, 0.85), JACKET = mat(0xd9b233, 0.85), BLUE = mat(0x3c4a63, 0.9), SKIN = mat(0xc49a78, 0.9),
    HAIR = mat(0x2a221c, 0.95), SHEEN = mat(0x1a1c1c, 0.2, { transparent: true, opacity: 0.35, depthWrite: false }),
    FOAM = mat(0xe8ecec, 0.6, { transparent: true, opacity: 0.55, depthWrite: false }), RED = mat(0x8a2a24, 0.8), BLACK = mat(0x151617, 0.9);
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; };
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // a soft, ragged-edged stain for sheen and dye: a feathered blob drawn once on a canvas
  const blob = (seedB) => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    let sd = seedB; const r2 = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 14; i++) {
      const cx = 64 + (r2() - 0.5) * 50, cy = 64 + (r2() - 0.5) * 50, rad = 18 + r2() * 30;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const stain = (color, opacity, size, px, pz, sx, rot, y, seedB, emissive) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.25, transparent: true, opacity, depthWrite: false, map: blob(seedB), ...(emissive ? { emissive, emissiveIntensity: 0.35 } : {}) });
    const o = add(new THREE.PlaneGeometry(size, size), m, px, y, pz, -Math.PI / 2); o.scale.set(sx, 1, 1); o.rotation.z = rot; return o;
  };
  // fuel and oil sheen spreading from the wreck
  stain(0x121414, 0.8, 40, 1, 0, 1.2, 0.3, 0.28, 5);
  stain(0x161818, 0.7, 20, -7, 6, 1, 1.1, 0.29, 9);
  // fluorescein sea marker from the dinghy pack: a vivid green-yellow stain that shows from miles up
  stain(0x9ad82a, 0.85, 22, -13, 10, 1.7, 0.5, 0.31, 21, 0x3a6a0a);

  // after hull and tail unit, broken off forward of the step, floating tail-up at an angle
  const tail = new THREE.Group(); tail.position.set(-3, 0.35, -2); tail.rotation.set(0.42, 0.5, 0.14); g.add(tail);
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.15, 7.5, 12, 1, true), GREY); hull.rotation.x = Math.PI / 2; hull.position.set(0, 0.2, -2.2); tail.add(hull);
  add(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 12), BLACK, 0, 0.2, 1.55, Math.PI / 2, 0, 0, tail);        // the torn end, dark inside
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(2.2, 0); fin.lineTo(1.6, 3.4); fin.lineTo(0.7, 3.5); fin.lineTo(-0.2, 1.2); fin.lineTo(0, 0);
  const finM = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false }), GREY); finM.rotation.y = Math.PI / 2; finM.position.set(0.07, 0.7, -3.4); tail.add(finM);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.9), DKGREY); rudder.position.set(0, 2.2, -6.1); rudder.rotation.x = -0.18; tail.add(rudder);
  add(new THREE.BoxGeometry(5.4, 0.12, 1.6), GREY, 0, 1.25, -5.0, 0, 0, 0.05, tail);                          // tailplane
  add(new THREE.BoxGeometry(0.6, 0.62, 0.02), RED, 0.12, 2.3, -4.2, 0, Math.PI / 2, 0, tail);                   // fin flash
  add(new THREE.RingGeometry(0.2, 0.45, 16), FOAM, 0, 0.05, 0.5, -Math.PI / 2, 0, 0, tail);

  // outer wing panel with its float, half sunk, trailing edge down
  const wing = new THREE.Group(); wing.position.set(5, 0.45, 1.5); wing.rotation.set(-0.06, -0.7, 0.08); g.add(wing);
  add(new THREE.BoxGeometry(8.5, 0.35, 2.6), WHITE, 0, 0.12, 0, 0, 0, 0, wing);
  add(new THREE.BoxGeometry(8.5, 0.05, 2.6), GREY, 0, 0.31, 0, 0, 0, 0, wing);
  add(new THREE.CapsuleGeometry(0.28, 1.6, 4, 10), WHITE, 3.6, -0.1, 0.4, Math.PI / 2, 0, 0, wing);           // wingtip float
  add(new THREE.BoxGeometry(0.4, 0.5, 0.05), BLACK, -4.2, 0.25, 0, 0, 0, 0, wing);                             // the torn root

  // the yellow dinghy: an inflated ring with a floor, six men in Mae Wests, one waving
  const dinghy = new THREE.Group(); dinghy.position.set(-9, 0.2, 6); dinghy.rotation.y = 0.6; g.add(dinghy);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.36, 10, 28), DINGHY); ring.rotation.x = Math.PI / 2; ring.scale.set(1.25, 1, 1); ring.position.y = 0.3; dinghy.add(ring);
  add(new THREE.CircleGeometry(1.6, 24), DINGHY_DK, 0, 0.1, 0, -Math.PI / 2, 0, 0, dinghy).scale.set(1.25, 1, 1);
  const man = (parent, x, z, facing, pose) => {
    const m = new THREE.Group(); m.position.set(x, 0, z); m.rotation.y = facing; parent.add(m);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.38, 4, 8), BLUE); body.position.y = pose === 'water' ? 0.05 : 0.45; m.add(body);
    const vest = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), JACKET); vest.scale.set(1.15, 0.8, 0.95); vest.position.y = pose === 'water' ? 0.18 : 0.62; m.add(vest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), SKIN); head.position.y = pose === 'water' ? 0.45 : 0.92; m.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), HAIR); hair.position.y = head.position.y + 0.02; m.add(hair);
    if (pose === 'wave') {
      const arm = new THREE.Group(); arm.name = 'wave'; arm.position.set(0.2, 0.75, 0); m.add(arm);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 3, 6), BLUE); a.position.y = 0.3; arm.add(a);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), SKIN); hand.position.y = 0.6; arm.add(hand);
      arm.rotation.z = -0.5;
    } else if (pose === 'water') {
      for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.45, 3, 6), BLUE); a.position.set(s * 0.18, 0.35, 0.25); a.rotation.set(-1.1, 0, s * 0.3); m.add(a); }
      const f = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.6, 16), FOAM); f.rotation.x = -Math.PI / 2; f.position.y = 0.02; m.add(f);
    }
    return m;
  };
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    man(dinghy, Math.cos(a) * 1.2, Math.sin(a) * 0.95, Math.atan2(-Math.cos(a), -Math.sin(a)), i === 1 ? 'wave' : 'sit');
  }
  man(dinghy, 2.35, -0.6, -Math.PI / 2, 'water');

  // debris: panels, seat cushions, a flotation bag, a crate
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, r = 4 + rnd() * 13;
    const kind = rnd();
    if (kind < 0.5) add(new THREE.BoxGeometry(0.4 + rnd() * 1.0, 0.05, 0.3 + rnd() * 0.6), rnd() < 0.7 ? GREY : DKGREY, Math.cos(a) * r, 0.3, Math.sin(a) * r, 0, rnd() * Math.PI, 0);
    else if (kind < 0.8) add(new THREE.BoxGeometry(0.5, 0.14, 0.5), DKGREY, Math.cos(a) * r, 0.32, Math.sin(a) * r, 0, rnd() * Math.PI, 0);
    else add(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 10), DINGHY_DK, Math.cos(a) * r, 0.38, Math.sin(a) * r, Math.PI / 2, rnd() * Math.PI, 0);
  }

  const br = new THREE.Object3D(); br.name = 'bridge'; br.position.set(-3, 2, -2); g.add(br);
  g.userData = { length: 30, beam: 30, waterline: 0.01, kind: 'survivors', name: 'Wreck of a Catalina' };
  return g;
}
