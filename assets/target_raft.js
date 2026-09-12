// Bombing and gunnery target raft: a 12 m timber platform on steel drums, moored, carrying a
// horizontal bull's-eye for depth-charge practice and an upright canvas target board for the
// guns, with a red pennant on a pole so it can be found from the air.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (c, r = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const TIMBER = mat(0xb08a5a), DRUM = mat(0x4a4f55, 0.6, { metalness: 0.3 }), WHITE = mat(0xeeeeea), RED = mat(0xa02a30), CANVAS = mat(0xb9b09a), BLACK = mat(0x141517), IRON = mat(0x6e7176, 0.6, { metalness: 0.3 });
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  for (let i = -4.5; i <= 4.5; i += 3) for (const x of [-4.5, 0, 4.5]) add(new THREE.CylinderGeometry(0.6, 0.6, 2.4, 12).rotateX(Math.PI / 2), DRUM, x, 0.6, i);
  add(new THREE.BoxGeometry(12, 0.3, 12), TIMBER, 0, 1.35, 0);
  for (let i = -5.6; i <= 5.6; i += 0.8) add(new THREE.BoxGeometry(0.06, 0.04, 12), BLACK, i, 1.52, 0);
  // bull's-eye on deck
  const ring = (r, m, y) => add(new THREE.CylinderGeometry(r, r, 0.03, 32), m, 0, y, 0);
  ring(5, WHITE, 1.53); ring(3.8, RED, 1.55); ring(2.6, WHITE, 1.57); ring(1.4, RED, 1.59); ring(0.5, WHITE, 1.61);
  // upright gunnery board on a frame at the stern
  add(new THREE.BoxGeometry(0.12, 4.5, 0.12), IRON, -2.2, 3.7, -5.4); add(new THREE.BoxGeometry(0.12, 4.5, 0.12), IRON, 2.2, 3.7, -5.4);
  add(new THREE.BoxGeometry(4.6, 3.2, 0.06), CANVAS, 0, 4.1, -5.4);
  const disc = (r, m, dz) => add(new THREE.CylinderGeometry(r, r, 0.02, 24).rotateX(Math.PI / 2), m, 0, 4.1, -5.36 + dz);
  disc(1.3, BLACK, 0); disc(0.9, WHITE, 0.01); disc(0.5, BLACK, 0.02); disc(0.18, RED, 0.03);
  // pennant pole and mooring bitt
  add(new THREE.CylinderGeometry(0.06, 0.08, 7, 6), WHITE, 5.2, 5, 5.2);
  add(new THREE.PlaneGeometry(1.6, 0.9), mat(0xa02a30, 0.8, { side: THREE.DoubleSide }), 6.0, 8.1, 5.2);
  add(new THREE.CylinderGeometry(0.18, 0.2, 0.7, 8), IRON, -5.2, 1.85, 5.2);
  const br = new THREE.Object3D(); br.name = 'bridge'; br.position.set(0, 2.5, 0); g.add(br);
  g.userData = { length: 12, beam: 12, waterline: 0.7, kind: 'target', name: 'Target raft' };
  const box3 = new THREE.Box3(), v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mt) => { for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mt)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m4.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
