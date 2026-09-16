import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Collisions } from './collide.js';

// Loads a 404-contract asset module (default export: function(THREE) -> Group), keeping the
// hierarchy so named nodes (props, guns, cockpit) stay addressable. Prototypes are cached and
// cloned; geometry and materials are shared between clones. Every 3D object in the game comes
// through here and is built by code: there is no mesh file loader.
const cache = new Map();

export async function loadAsset(url) {
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      const mod = await import(/* @vite-ignore */ url.startsWith('.') || url.startsWith('/') ? url : `../${url}`);
      const g = mod.default(THREE);
      g.traverse((n) => {
        if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
      });
      // the part boxes for contact are taken from the parts as modelled, before they are merged
      Collisions.parts(g);
      mergeStatic(g);
      return g;
    })());
  }
  const proto = await cache.get(url);
  const inst = proto.clone(true);
  inst.userData = { ...proto.userData };
  return inst;
}

// A model is built from hundreds of small parts, and each is a draw call. Everything that is not
// a named node (or inside one) never moves on its own, so those parts are merged into one mesh per
// material. Named nodes (propellers, guns, flags, pennants, turrets) keep their own meshes.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), taken = [];
  const visit = (node) => {
    for (const c of node.children) {
      if (c.name) continue;                          // a named node and all beneath it stay as they are
      if (c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && c.visible && !Array.isArray(c.material)
        && !Object.keys(c.geometry.morphAttributes || {}).length) {
        let geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        geo.clearGroups();   // box and cylinder faces carry groups; with one material they mean nothing
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        if (c.matrixWorld.determinant() < 0) { const p = geo.attributes.position; for (let i = 0; i < p.count; i += 3) { for (const a of Object.values(geo.attributes)) { for (let k = 0; k < a.itemSize; k++) { const t = a.getComponent(i, k); a.setComponent(i, k, a.getComponent(i + 2, k)); a.setComponent(i + 2, k, t); } } } }
        const key = c.material.uuid + '|' + Object.keys(geo.attributes).sort().join(',') + '|' + c.castShadow + c.receiveShadow + '|' + c.renderOrder;
        if (!buckets.has(key)) buckets.set(key, { mat: c.material, geos: [], cast: c.castShadow, recv: c.receiveShadow, order: c.renderOrder });
        buckets.get(key).geos.push(geo);
        taken.push(c);
      }
      visit(c);
    }
  };
  visit(root);
  if (taken.length < 2) return;
  for (const b of buckets.values()) {
    const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!geo) return;   // attribute layouts that will not merge: leave the model as modelled
    b.geo = geo;
  }
  for (const c of taken) {
    // a part with children keeps its place as an empty node so the children stay where they are
    if (c.children.length) { const o = new THREE.Object3D(); o.position.copy(c.position); o.quaternion.copy(c.quaternion); o.scale.copy(c.scale); for (const k of [...c.children]) o.add(k); c.parent.add(o); }
    c.parent.remove(c);
  }
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(b.geo, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv; m.renderOrder = b.order;
    m.matrixAutoUpdate = true;
    root.add(m);
  }
}

export function findNamed(root, name) {
  let out = null;
  root.traverse((n) => { if (!out && n.name === name) out = n; });
  return out;
}
export function findAllNamed(root, name) {
  const out = [];
  root.traverse((n) => { if (n.name === name) out.push(n); });
  return out;
}

// Fallback placeholder if an asset module is missing, so the game still runs.
export function placeholder(length = 20, span = 30, kind = 'aircraft') {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x8e949a, roughness: 0.8 });
  if (kind === 'aircraft') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, length), m); hull.position.y = 1.3; g.add(hull);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(span, 0.4, 3.2), m); wing.position.y = 3.2; g.add(wing);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 3), m); fin.position.set(0, 3.5, -length / 2 + 2); g.add(fin);
    const cp = new THREE.Object3D(); cp.name = 'cockpit'; cp.position.set(-0.5, 2.9, length * 0.25); g.add(cp);
    const gn = new THREE.Object3D(); gn.name = 'gun_nose'; gn.position.set(0, 2, length / 2); g.add(gn);
    const bb = new THREE.Object3D(); bb.name = 'bomb_bay'; bb.position.set(0, 1, 0); g.add(bb);
    for (const sx of [-4, 4]) {
      const pr = new THREE.Group(); pr.name = 'prop'; pr.position.set(sx, 3.6, 2.4);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x141517 })); pr.add(bl); g.add(pr);
    }
    g.userData = { length, span, type: 'aircraft', name: 'placeholder' };
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(span, 6, length), m); hull.position.y = 3; g.add(hull);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4, 5), m); tower.position.y = 8; g.add(tower);
    const br = new THREE.Object3D(); br.name = 'bridge'; br.position.y = 10; g.add(br);
    g.userData = { length, beam: span, waterline: 4, kind, name: 'placeholder' };
  }
  return g;
}

export async function loadOrPlaceholder(url, length, span, kind) {
  try {
    return await loadAsset(url);
  } catch (e) {
    console.warn('asset failed, using placeholder:', url, e);
    return placeholder(length, span, kind);
  }
}
