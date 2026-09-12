import * as THREE from 'three';
import { loadModel } from './models.js';

// Loads a 404-contract asset module (default export: function(THREE) -> Group), keeping the
// hierarchy so named nodes (props, guns, cockpit) stay addressable. Prototypes are cached and
// cloned; geometry and materials are shared between clones.
const cache = new Map();
const modelCache = new Map();

export async function loadAsset(url) {
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      const mod = await import(/* @vite-ignore */ url.startsWith('.') || url.startsWith('/') ? url : `../${url}`);
      const g = mod.default(THREE);
      g.traverse((n) => {
        if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
      });
      return g;
    })());
  }
  const proto = await cache.get(url);
  // a generated GLB of the same name replaces the code asset when present (see models.js)
  const name = url.split('/').pop().replace(/.js$/, '');
  if (!modelCache.has(name)) modelCache.set(name, loadModel(name, proto, proto.userData.type === 'aircraft' ? 'aircraft' : 'vessel').catch(() => null));
  const model = await modelCache.get(name);
  const src = model || proto;
  const inst = src.clone(true);
  inst.userData = { ...src.userData };
  return inst;
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
