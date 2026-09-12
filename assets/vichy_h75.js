// Curtiss H-75A (Hawk 75) of the Vichy Armée de l'Air, Morocco 1941–42: radial-engined
// low-wing fighter in the three-tone Vichy scheme with the yellow-and-red "Vichy stripes" on the
// cowling and tail, French cockades (blue centre, white, red outer) and a rudder in the
// blue-white-red tricolour. Span 11.38 m, length 8.79 m.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (c, r = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const GRIS = mat(0x5b6b73), VERT = mat(0x5c6b4a), BRUN = mat(0x6b5a45), CLAIR = mat(0x8ea0a8);
  const YEL = mat(0xd8b43c), RED = mat(0xa02a30), BLUE = mat(0x1f3468), WHITE = mat(0xeeeeea), BLACK = mat(0x141517, 0.6);
  const GLASS = mat(0x2b3d4a, 0.15, { transparent: true, opacity: 0.7 });
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (name) o.name = name; g.add(o); return o; };

  // fuselage: lathe profile, nose at +Z
  const prof = [];
  const stations = [[-4.4, 0.12], [-3.6, 0.32], [-2.4, 0.5], [-1.0, 0.62], [0.2, 0.66], [1.6, 0.68], [2.8, 0.66], [3.7, 0.62], [4.3, 0.5]];
  for (const [z, r] of stations) prof.push(new THREE.Vector2(r, z));
  const fus = new THREE.LatheGeometry(prof, 20); fus.rotateX(-Math.PI / 2); fus.rotateY(Math.PI);
  // paint the fuselage: upper camouflage, lower light grey, by vertex colour bands via separate meshes is heavy; use two half-lathes
  const top = fus.clone(), bot = fus.clone();
  add(top, GRIS, 0, 1.3, 0.1);
  const lower = new THREE.Mesh(new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x * 0.98, p.y)), 20, Math.PI, Math.PI), CLAIR);
  lower.geometry.rotateX(-Math.PI / 2); lower.geometry.rotateY(Math.PI); lower.rotation.z = Math.PI; lower.position.set(0, 1.3, 0.1); g.add(lower);
  // camouflage patches
  add(new THREE.BoxGeometry(1.0, 0.5, 1.6), VERT, 0.35, 1.72, 1.4, 0, 0, 0.3);
  add(new THREE.BoxGeometry(0.9, 0.45, 1.4), BRUN, -0.4, 1.7, -0.6, 0, 0, -0.2);
  // cowling with Vichy stripes
  add(new THREE.CylinderGeometry(0.66, 0.62, 1.1, 20).rotateX(Math.PI / 2), YEL, 0, 1.32, 4.4);
  for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.665, 0.665, 0.14, 20).rotateX(Math.PI / 2), RED, 0, 1.32, 4.0 + i * 0.38);
  // engine face and prop
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16).rotateX(Math.PI / 2), BLACK, 0, 1.32, 4.98);
  const prop = new THREE.Group(); prop.name = 'prop'; prop.position.set(0, 1.32, 5.15);
  prop.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), BLACK));
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.55, 0.05), BLACK); b.position.y = 0.78; const w = new THREE.Group(); w.add(b); w.rotation.z = i * Math.PI * 2 / 3; prop.add(w); }
  g.add(prop);
  // wings (low, with dihedral), camouflage on top, light grey under
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.16, 1.9), GRIS); w.position.set(s * 3.2, 1.08 + 0.18, 0.5); w.rotation.z = s * 0.1; w.rotation.y = s * 0.04; g.add(w);
    const u = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.06, 1.9), CLAIR); u.position.set(s * 3.2, 1.08 + 0.08, 0.5); u.rotation.z = s * 0.1; u.rotation.y = s * 0.04; g.add(u);
    const patch = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.2), VERT); patch.position.set(s * 2.6, 1.36, 0.6); patch.rotation.z = s * 0.1; g.add(patch);
    const patch2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.0), BRUN); patch2.position.set(s * 4.6, 1.56, 0.4); patch2.rotation.z = s * 0.1; g.add(patch2);
    // cockade on the wing top (blue centre, white, red outer) and under the wing
    for (const [y, rz] of [[1.42 + Math.abs(s) * 0, 0], [1.03, Math.PI]]) {
      const ring = (r, m, dy) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 24), m); c.position.set(s * 4.2, y + dy + (rz ? -0.01 : 0.01) + s * 0.42 * (y > 1.2 ? 1 : 1) * 0.1, 0.5); c.rotation.z = s * 0.1; g.add(c); };
      ring(0.55, RED, 0); ring(0.37, WHITE, 0.005); ring(0.19, BLUE, 0.01);
    }
    // fuselage cockades
    const fr = (r, m, dx) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 24).rotateZ(Math.PI / 2), m); c.position.set(s * (0.64 + dx), 1.35, -1.6); g.add(c); };
    fr(0.5, RED, 0); fr(0.34, WHITE, 0.01); fr(0.17, BLUE, 0.02);
    // wheel fairings (undercarriage retracted rearwards; small bulges)
    add(new THREE.SphereGeometry(0.28, 10, 8), CLAIR, s * 1.4, 1.05, 0.9);
  }
  // tailplane and fin with tricolour rudder and Vichy stripes on the tailplane
  add(new THREE.BoxGeometry(3.6, 0.1, 1.1), YEL, 0, 1.45, -3.7);
  for (const x of [-1.3, -0.5, 0.5, 1.3]) add(new THREE.BoxGeometry(0.22, 0.11, 1.1), RED, x, 1.45, -3.7);
  add(new THREE.BoxGeometry(0.1, 1.5, 1.2), GRIS, 0, 2.2, -3.4);
  add(new THREE.BoxGeometry(0.09, 1.5, 0.25), BLUE, 0, 2.2, -3.72);
  add(new THREE.BoxGeometry(0.09, 1.5, 0.25), WHITE, 0, 2.2, -3.97);
  add(new THREE.BoxGeometry(0.09, 1.5, 0.25), RED, 0, 2.2, -4.22);
  // canopy
  add(new THREE.BoxGeometry(0.7, 0.45, 1.6), GLASS, 0, 1.98, 0.6);
  add(new THREE.BoxGeometry(0.72, 0.05, 1.62), BLACK, 0, 2.2, 0.6);
  // guns (nose and wing) muzzles
  const gn = new THREE.Object3D(); gn.name = 'gun_nose'; gn.position.set(0.3, 1.75, 4.4); g.add(gn);
  const cp = new THREE.Object3D(); cp.name = 'cockpit'; cp.position.set(0, 2.0, 0.7); g.add(cp);
  // tailwheel
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 10).rotateZ(Math.PI / 2), BLACK, 0, 0.55, -4.0);

  g.userData = { length: 8.79, span: 11.38, type: 'aircraft', name: 'Curtiss H-75A (Vichy)' };
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
