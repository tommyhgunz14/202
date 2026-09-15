// Two folding canoes ("folboats") of the kind HMS Seraph carried for the Clark party: rubberised
// canvas skins on a wooden frame, about 5 m long, each with a paddler in the stern cockpit and a
// passenger forward. Bows point along +z. The paddles are named 'paddle' (pivot at the paddler's
// chest, blade along local x) so the game can work them; the passengers are named 'passenger' so
// they can climb out when the canoes reach the aircraft.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const SKIN = mat(0x5e5b4c), DECK = mat(0x74705a), COAMING = mat(0x3a3328), FACE = mat(0xc49a78), JERSEY = mat(0x33373d), KHAKI = mat(0x6b6448), CAP = mat(0x23262b), WOOD = mat(0x7a5a38, 0.6), BLADE = mat(0x5a4630, 0.6);

  const man = (role) => {
    const m = new THREE.Group(); m.name = role;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.36, 4, 8), role === 'passenger' ? KHAKI : JERSEY); body.position.y = 0.42; m.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), FACE); head.position.y = 0.86; m.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), CAP); cap.position.y = 0.88; m.add(cap);
    return m;
  };

  const canoe = (x) => {
    const c = new THREE.Group(); c.position.x = x; g.add(c);
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 4.4, 6, 12), SKIN);
    hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.5); hull.position.y = 0.08; c.add(hull);
    const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 4.3, 6, 12), DECK);
    deck.rotation.x = Math.PI / 2; deck.scale.set(1, 1, 0.12); deck.position.y = 0.26; c.add(deck);
    for (const z of [0.7, -1.1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 16), COAMING); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1.5, 1); ring.position.set(0, 0.3, z); c.add(ring);
    }
    const pass = man('passenger'); pass.position.set(0, 0.05, 0.7); c.add(pass);
    const pad = man('paddler'); pad.position.set(0, 0.05, -1.1); c.add(pad);
    // double-bladed paddle held across the body
    const paddle = new THREE.Group(); paddle.name = 'paddle'; paddle.position.set(0, 0.62, -0.95); c.add(paddle);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.3, 6), WOOD); shaft.rotation.z = Math.PI / 2; paddle.add(shaft);
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.16), BLADE); b.position.x = s * 1.1; b.rotation.x = s * 0.6; paddle.add(b);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.34, 3, 6), JERSEY); arm.position.set(s * 0.26, -0.08, -0.05); arm.rotation.z = s * 1.2; paddle.add(arm);
    }
    // the bow and stern wash of a loaded canoe
    const foam = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0xe8ecec, roughness: 0.6, transparent: true, opacity: 0.35 }));
    foam.rotation.x = -Math.PI / 2; foam.scale.set(0.8, 2.6, 1); foam.position.y = 0.02; c.add(foam);
  };
  canoe(-1.1); canoe(1.1);
  g.userData = { length: 5.2, beam: 3.2, waterline: 0, kind: 'boat', name: 'folboats' };
  return g;
}
