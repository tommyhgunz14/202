// A submarine's small wooden boat bringing General Giraud's party across to the Catalina: one
// man rowing amidships, the General and two others sitting aft. Bows point along +z. The oars are
// named 'oar' (pivot at the rowlock; userData.side -1 port, +1 starboard) so the game can pull
// them, and the three sitters are named 'passenger'.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const HULL = mat(0x4a4f54), INSIDE = mat(0x8a7a5a), THWART = mat(0x6e5a3e, 0.7), FACE = mat(0xc49a78), NAVY = mat(0x252a33), COAT = mat(0x8a826c), KEPI = mat(0x3a3f2e), WOOD = mat(0x9a7a4e, 0.6);

  // hull: an open boat, built as two flared sides, a transom and a bottom
  const L = 4.2, B = 1.5;
  const shape = new THREE.Shape();
  // (drawn with the bow at -y, which the rotation below turns to +z)
  shape.moveTo(0, -L / 2); shape.quadraticCurveTo(B / 2, -L / 4, B / 2, L / 2 - 0.2); shape.lineTo(-B / 2, L / 2 - 0.2); shape.quadraticCurveTo(-B / 2, -L / 4, 0, -L / 2);
  // the sides: the outline with the inside cut away, so the boat is open and the men sit down in her
  const inner = new THREE.Path(); const k = 0.86;
  inner.moveTo(0, -L / 2 * k); inner.quadraticCurveTo(B / 2 * k, -L / 4 * k, B / 2 * k, (L / 2 - 0.2) * k); inner.lineTo(-B / 2 * k, (L / 2 - 0.2) * k); inner.quadraticCurveTo(-B / 2 * k, -L / 4 * k, 0, -L / 2 * k);
  const sides = shape.clone(); sides.holes.push(inner);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(sides, { depth: 0.8, bevelEnabled: false }), HULL);
  hull.rotation.x = -Math.PI / 2; hull.position.y = -0.2; g.add(hull);
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), INSIDE); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; g.add(floor);
  for (const z of [0.9, -0.1, -1.3]) { const t = new THREE.Mesh(new THREE.BoxGeometry(B * 0.8, 0.05, 0.22), THWART); t.position.set(0, 0.36, z); g.add(t); }

  const man = (role, cloth, hat) => {
    const m = new THREE.Group(); m.name = role;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.38, 4, 8), cloth); body.position.y = 0.68; m.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), FACE); head.position.y = 1.15; m.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, hat === 'kepi' ? 0.16 : 0.07, 10), hat === 'kepi' ? KEPI : NAVY); cap.position.y = hat === 'kepi' ? 1.29 : 1.24; m.add(cap);
    return m;
  };
  const rower = man('rower', NAVY); rower.position.set(0, 0, -0.1); rower.rotation.y = Math.PI; g.add(rower);   // a rower faces aft
  const general = man('passenger', COAT, 'kepi'); general.position.set(0, 0, -1.3); g.add(general);
  const p2 = man('passenger', COAT); p2.position.set(-0.4, 0, -1.55); g.add(p2);
  const p3 = man('passenger', NAVY); p3.position.set(0.4, 0, 0.9); g.add(p3);
  for (const s of [-1, 1]) {
    const oar = new THREE.Group(); oar.name = 'oar'; oar.userData.side = s; oar.position.set(s * B * 0.47, 0.62, -0.1); g.add(oar);
    const loom = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6), WOOD); loom.rotation.z = Math.PI / 2; loom.position.x = s * 0.9; oar.add(loom);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.14), WOOD); blade.position.x = s * 2.05; oar.add(blade);
  }
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.6, 16), new THREE.MeshStandardMaterial({ color: 0xe8ecec, roughness: 0.6, transparent: true, opacity: 0.3 }));
  foam.rotation.x = -Math.PI / 2; foam.scale.set(0.9, 2.2, 1); foam.position.y = 0.02; g.add(foam);
  g.userData = { length: L, beam: B, waterline: 0, kind: 'boat', name: 'dinghy' };
  return g;
}
