import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Generated GLB meshes (Atlas image-to-3D) as drop-in replacements for the code assets.
//  assets/models/<name>.glb        the mesh with embedded PBR textures
//  assets/models/models.json       per-model tuning: { name: { enabled, yaw, flip, up, lift, scale } }
// A GLB is normalised so that its length matches the code asset's userData.length, its lowest
// point sits at y = 0, it is centred on x/z and its bow/nose points +Z (auto-detected: the
// narrower end of a ship, the end without the tall fin of an aircraft; `flip: true` overrides).
// The named empties the game needs (props, guns, cockpit, bomb bay, bridge) are copied across
// from the code asset by proportional position inside the bounding box, so nothing in the game
// has to know which kind of asset it got.

const gltf = new GLTFLoader();
let registry = null;
async function loadRegistry() {
  if (registry) return registry;
  try { const r = await fetch('assets/models/models.json'); registry = r.ok ? await r.json() : {}; } catch { registry = {}; }
  return registry;
}

function bounds(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3(), v = new THREE.Vector3();
  obj.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  return box;
}

// Which end is the front? Compare the two ends of the length axis.
function frontIsPositiveZ(obj, box, kind) {
  const len = box.max.z - box.min.z;
  const zA = box.min.z + len * 0.18, zB = box.max.z - len * 0.18;
  let wA = 0, wB = 0, hA = 0, hB = 0, nA = 0, nB = 0;
  const v = new THREE.Vector3();
  obj.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i += 3) {
      v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld);
      if (v.z < zA) { wA = Math.max(wA, Math.abs(v.x)); hA = Math.max(hA, v.y); nA++; }
      else if (v.z > zB) { wB = Math.max(wB, Math.abs(v.x)); hB = Math.max(hB, v.y); nB++; }
    }
  });
  if (kind === 'aircraft') return hB < hA;   // the fin makes the tail end taller: tail at -Z
  return wB < wA;                             // a bow is narrower than a stern
}

export async function loadModel(name, proto, kind) {
  const reg = await loadRegistry();
  const cfg = reg[name] || {};
  if (cfg.enabled === false) return null;
  let scene;
  try { scene = (await gltf.loadAsync(`assets/models/${name}.glb`)).scene; } catch { return null; }
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner); inner.add(scene);
  scene.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; if (n.material) { n.material.side = THREE.FrontSide; n.material.metalness = Math.min(n.material.metalness ?? 0, 0.4); } } });
  // optional up-axis fix, then align the longest horizontal axis with Z
  if (cfg.up === 'z') scene.rotation.x = -Math.PI / 2;
  let box = bounds(g);
  const sx = box.max.x - box.min.x, sz = box.max.z - box.min.z;
  if (sx > sz) inner.rotation.y = Math.PI / 2;
  inner.rotation.y += (cfg.yaw || 0) * Math.PI / 180;
  box = bounds(g);
  const fwdOk = frontIsPositiveZ(g, box, kind);
  if ((!fwdOk) !== !!cfg.flip) inner.rotation.y += Math.PI;
  box = bounds(g);
  // scale to the code asset's length, base at y = 0, centred
  const targetLen = proto.userData.length || 20;
  const s = (targetLen / (box.max.z - box.min.z)) * (cfg.scale || 1);
  inner.scale.setScalar(s);
  box = bounds(g);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y + (cfg.lift || 0), -c.z);
  box = bounds(g);
  // carry the named empties across by proportion of the code asset's box
  const pbox = bounds(proto);
  const map = (p) => new THREE.Vector3(
    box.min.x + (p.x - pbox.min.x) / Math.max(1e-6, pbox.max.x - pbox.min.x) * (box.max.x - box.min.x),
    box.min.y + (p.y - pbox.min.y) / Math.max(1e-6, pbox.max.y - pbox.min.y) * (box.max.y - box.min.y),
    box.min.z + (p.z - pbox.min.z) / Math.max(1e-6, pbox.max.z - pbox.min.z) * (box.max.z - box.min.z));
  proto.updateMatrixWorld(true);
  proto.traverse((n) => {
    if (!n.name) return;
    const wp = new THREE.Vector3(); n.getWorldPosition(wp);
    const q = new THREE.Quaternion(); n.getWorldQuaternion(q);
    if (n.name === 'prop') {
      // a spinning disc in place of the baked propeller
      const r = Math.max(0.9, bounds(n).getSize(new THREE.Vector3()).y * 0.5);
      const disc = new THREE.Group(); disc.name = 'prop'; disc.position.copy(map(wp)); disc.quaternion.copy(q);
      const blur = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      disc.add(blur);
      for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(r * 0.16, r * 2, 0.05), new THREE.MeshStandardMaterial({ color: 0x141517 })); bl.rotation.z = i * Math.PI * 2 / 3; disc.add(bl); }
      g.add(disc);
    } else if (/^(gun_|cockpit$|bomb_bay$|bridge$|flak$|dc_rail$)/.test(n.name)) {
      const e = new THREE.Object3D(); e.name = n.name; e.position.copy(map(wp)); e.quaternion.copy(q); g.add(e);
    }
  });
  g.userData = { ...proto.userData, model: name };
  return g;
}
