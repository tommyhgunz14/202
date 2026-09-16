import * as THREE from 'three';

// Contact between the aircraft and anything solid that is not the terrain or the sea: ships, other
// aircraft, moles, jetties, cranes and buildings. Every obstacle is a set of oriented boxes, one per
// modelled part, so a destroyer's bow can be struck but the air between her funnels cannot. The
// aircraft is tested at a handful of points: nose, tail, both wing tips, the keel and the centre.
// Static boxes are bucketed on a grid; a moving object's part boxes are kept in its own frame and
// the aircraft's points are carried into that frame each check.

const CELL = 120;
const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _b = new THREE.Box3();
const MIN_PART = 2;        // parts smaller than this (fittings, figures, buoys) are not obstacles
const THIN = 0.15;         // wires, aerials and rails are not obstacles either

// one oriented box: the part's own bounding box, and the matrix taking world points into its frame
export function partBox(geometry, worldMatrix) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox, s = box.getSize(_p);
  if (Math.max(s.x, s.y, s.z) < MIN_PART || Math.min(s.x, s.y, s.z) < THIN) return null;
  // a sheet laid over the hillside (the catchments) boxes a great volume of air; the terrain covers it
  if ([s.x, s.y, s.z].filter((v) => v > 100).length >= 2) return null;
  return { box: box.clone(), inv: new THREE.Matrix4().copy(worldMatrix).invert() };
}

export class Collisions {
  constructor() { this.cells = new Map(); this.movers = []; this.ignore = new Set(); }

  addBox(c, label) {
    if (!c) return;
    c.label = label;
    // world footprint of the box, for the grid
    _b.copy(c.box).applyMatrix4(_m.copy(c.inv).invert());
    if (_b.max.y < 0.3) return;                       // wholly under water
    for (let i = Math.floor(_b.min.x / CELL); i <= Math.floor(_b.max.x / CELL); i++)
      for (let k = Math.floor(_b.min.z / CELL); k <= Math.floor(_b.max.z / CELL); k++) {
        const key = i * 100000 + k;
        let cell = this.cells.get(key); if (!cell) this.cells.set(key, cell = []);
        cell.push(c);
      }
  }

  // every sizeable mesh under a group that does not move again (harbour works, moored scenery ships)
  addStatic(root, label) {
    root.updateMatrixWorld(true);
    root.traverse((n) => {
      if (!n.isMesh || n.isInstancedMesh || !n.visible || (n.material && n.material.transparent)) return;
      this.addBox(partBox(n.geometry, n.matrixWorld), label);
    });
  }

  // boxes recorded while a merged group was built (the town): [{ box, inv }]
  addList(list, label) { for (const c of list || []) this.addBox(c, label); }

  // an object that moves: its part boxes in its own frame, worked out once
  static parts(group) {
    if (group.userData._parts) return group.userData._parts;
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const parts = [], all = new THREE.Box3();
    group.traverse((n) => {
      if (!n.isMesh || !n.visible || (n.material && n.material.transparent) || /wake|flag|ensign|pennant|prop|disc/i.test(n.name)) return;
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      const s = n.geometry.boundingBox.getSize(_p);
      if (Math.max(s.x, s.y, s.z) < 0.6 || Math.min(s.x, s.y, s.z) < THIN * 0.5) return;
      const local = new THREE.Box3().copy(n.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, n.matrixWorld));
      parts.push(local); all.union(local);
    });
    return (group.userData._parts = { parts, all });
  }

  // the aircraft's test points in its own frame: nose, tail, wing tips at the height of the
  // widest part (the mainplane), keel and centre
  static probes(plane) {
    const { parts, all } = Collisions.parts(plane);
    const wing = parts.reduce((w, b) => (b.max.x - b.min.x > w.max.x - w.min.x ? b : w), parts[0] || all);
    const c = all.getCenter(new THREE.Vector3()), wy = (wing.min.y + wing.max.y) / 2, wz = (wing.min.z + wing.max.z) / 2;
    const k = 0.92;   // just inside the extremes, so a graze of the very tip is forgiven
    return [
      new THREE.Vector3(c.x, c.y, all.max.z * k), new THREE.Vector3(c.x, c.y, all.min.z * k),
      new THREE.Vector3(all.min.x * k, wy, wz), new THREE.Vector3(all.max.x * k, wy, wz),
      new THREE.Vector3(c.x, all.min.y * 0.5, c.z), c,
    ];
  }

  // What the aircraft is touching, or null. objects: [{ group, name }] that move.
  test(plane, probes, objects, lowLevel) {
    plane.updateMatrixWorld();
    const pts = probes.map((q) => q.clone().applyMatrix4(plane.matrixWorld));
    const hits = [];
    if (lowLevel) {
      for (const w of pts) {
        const cell = this.cells.get(Math.floor(w.x / CELL) * 100000 + Math.floor(w.z / CELL));
        if (!cell) continue;
        for (const c of cell) if (c.box.containsPoint(_p.copy(w).applyMatrix4(c.inv))) { hits.push(c); break; }
      }
    }
    for (const o of objects) {
      const g = o.group;
      if (!g || !g.visible || g === plane) continue;
      const { parts, all } = Collisions.parts(g);
      if (!parts.length) continue;
      g.updateMatrixWorld();
      _inv.copy(g.matrixWorld).invert();
      for (const w of pts) {
        _p.copy(w).applyMatrix4(_inv);
        if (!all.containsPoint(_p)) continue;
        if (parts.some((b) => b.containsPoint(_p))) { hits.push(o); break; }
      }
    }
    // anything touched when the check began (the aircraft lying at her mooring) is not a collision
    // until she has been clear of it
    const fresh = hits.filter((h) => !this.ignore.has(h));
    this.ignore = new Set([...this.ignore].filter((h) => hits.includes(h)));
    return fresh[0] || null;
  }

  // forget what was touched at the start of a sortie
  begin(plane, probes, objects) { this.ignore = new Set(); const h = []; let x; while ((x = this.test(plane, probes, objects, true)) && h.length < 20) { h.push(x); this.ignore.add(x); } }
}
