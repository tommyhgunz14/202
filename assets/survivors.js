// Men in the water after a submarine is abandoned: two Carley floats with men clinging to the
// lifelines, a dozen more swimming in their life-jackets, and a spread of wreckage, all in a
// patch about 26 m across. Everything sits at the waterline; the heads and shoulders are what
// shows from the air.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (c, r = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const FLOAT = mat(0x8a8c7a), ROPE = mat(0x6b5a3f), SKIN = mat(0xc49a78), DARK = mat(0x2a2c30), JACKET = mat(0x9c8f58), CAP = mat(0x1c1e22), WOOD = mat(0x5a4632), FOAM = mat(0xe8ecec, 0.6, { transparent: true, opacity: 0.55 });
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  // a seeded scatter so the patch looks the same each time
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // a man in the water: shoulders in a life-jacket just awash, head, cap on some; arms up on others
  const man = (x, z, facing, clinging = false) => {
    const m = new THREE.Group(); m.position.set(x, 0, z); m.rotation.y = facing; g.add(m);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), JACKET); sh.scale.set(1.4, 0.55, 1); sh.position.y = 0.08; m.add(sh);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), SKIN); head.position.y = 0.36; m.add(head);
    if (rnd() < 0.55) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 10), CAP); cap.position.y = 0.46; m.add(cap); }
    if (clinging || rnd() < 0.3) {
      for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 3, 6), DARK); arm.position.set(s * 0.22, 0.32, 0.12); arm.rotation.set(-0.9, 0, s * 0.35); m.add(arm); }
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.6, 16), FOAM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; m.add(ring);
    return m;
  };

  // Carley float: a rounded rectangular ring of cork and canvas with a lifeline looped round it
  const carley = (x, z, ry, men) => {
    const f = new THREE.Group(); f.position.set(x, 0, z); f.rotation.y = ry; g.add(f);
    const L = 2.6, W = 1.4, t = 0.22;
    const tube = (len, px, pz, rot) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(t, len, 4, 10), FLOAT); o.rotation.set(0, rot, Math.PI / 2); o.position.set(px, 0.12, pz); f.add(o); };
    tube(L - W * 0.4, 0, W / 2, 0); tube(L - W * 0.4, 0, -W / 2, 0);
    tube(W - 0.2, L / 2, 0, Math.PI / 2); tube(W - 0.2, -L / 2, 0, Math.PI / 2);
    const slats = new THREE.Mesh(new THREE.BoxGeometry(L - 0.3, 0.04, W - 0.3), WOOD); slats.position.y = 0.02; f.add(slats);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const loop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 4, 8, Math.PI), ROPE); loop.position.set(Math.cos(a) * (L / 2 + 0.2), 0.05, Math.sin(a) * (W / 2 + 0.2)); loop.rotation.set(Math.PI, Math.atan2(Math.sin(a), Math.cos(a)), 0); f.add(loop); }
    for (let i = 0; i < men; i++) {
      const a = i / men * Math.PI * 2 + 0.3;
      const mm = man(0, 0, 0, true); f.add(mm);
      mm.position.set(Math.cos(a) * (L / 2 + 0.5), 0, Math.sin(a) * (W / 2 + 0.5)); mm.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
    }
    return f;
  };

  carley(-4, 2, 0.4, 6);
  carley(5, -3, -0.9, 5);
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, r = 3 + rnd() * 10; man(Math.cos(a) * r, Math.sin(a) * r, rnd() * Math.PI * 2); }
  // wreckage: planks and a couple of canisters
  for (let i = 0; i < 8; i++) { const a = rnd() * Math.PI * 2, r = 2 + rnd() * 12; add(new THREE.BoxGeometry(0.9 + rnd() * 1.4, 0.08, 0.22), WOOD, Math.cos(a) * r, 0.03, Math.sin(a) * r, 0, rnd() * Math.PI, 0); }
  for (let i = 0; i < 3; i++) { const a = rnd() * Math.PI * 2, r = 4 + rnd() * 8; add(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10), DARK, Math.cos(a) * r, 0.1, Math.sin(a) * r, Math.PI / 2, rnd() * Math.PI, 0); }

  const br = new THREE.Object3D(); br.name = 'bridge'; br.position.set(0, 0.6, 0); g.add(br);
  g.userData = { length: 26, beam: 26, waterline: 0.01, kind: 'survivors', name: 'Survivors in the water' };
  return g;
}
