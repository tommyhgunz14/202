import * as THREE from 'three';
import { buildFigure, animateFigure } from './world/crew.js';

// Mission-start cinematic in the world: the crew come out of the hut on the pontoon, walk its
// length to the gangplank and climb in through the hull hatch of the moored aircraft, which is
// swung open for them and pulled shut behind the last man. The camera opens on the crew walking
// up the pontoon and swings out and up as they board, always standing far enough off that the
// whole aircraft stays in frame and never entering the hull. Escape, Enter, Space or a
// controller button skips it. update(dt, camera) drives it; .finished reports when it is over.

export function startWalkout(scene, plane, jetty, pontoon, spec) {
  const g = new THREE.Group(); scene.add(g);
  const deckY = pontoon.deckY;
  // the aircraft lies alongside the pontoon's west edge; the gangplank reaches her hull
  const hullX = jetty.x + (spec.beam || 3) * 0.5 + 0.2, edgeX = pontoon.x - pontoon.halfW;
  const plank = new THREE.Mesh(new THREE.BoxGeometry(edgeX - hullX + 0.6, 0.06, 0.7), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 }));
  plank.position.set((edgeX + hullX) / 2, deckY + 0.02, jetty.z); g.add(plank);
  // hull hatch: a dark opening with a panel hinged along its top edge that swings out and up
  const sillY = deckY + 0.75, hatchH = 1.05, hatchW = 0.8;
  const hull = new THREE.MeshStandardMaterial({ color: 0x4b5057, roughness: 0.85, side: THREE.DoubleSide });
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(hatchW, hatchH), new THREE.MeshStandardMaterial({ color: 0x0b0d0f, roughness: 1 }));
  hole.rotation.y = Math.PI / 2; hole.position.set(hullX - 0.04, sillY + hatchH / 2, jetty.z); g.add(hole);
  const hinge = new THREE.Group(); hinge.position.set(hullX, sillY + hatchH, jetty.z); g.add(hinge);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, hatchH, hatchW), hull);
  door.position.set(0.025, -hatchH / 2, 0); hinge.add(door);
  const grab = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.6, roughness: 0.4 }));
  grab.position.set(0.06, -hatchH * 0.72, 0.22); grab.rotation.y = Math.PI / 2; hinge.add(grab);
  let hatch = 0;            // 0 shut, 1 swung open
  const kinds = ['pilot', 'pilot', 'aircrew', 'aircrew', 'aircrew', 'aircrew'].slice(0, Math.min(6, spec.crew || 6));
  const crew = kinds.map((k, i) => {
    const f = buildFigure(k);
    // start by the hut, staggered, and walk the west edge of the pontoon to the plank
    const start = new THREE.Vector3(pontoon.x + 1 - (i % 2) * 1.3, deckY, pontoon.z - 10 - Math.floor(i / 2) * 1.6);
    f.position.copy(start); g.add(f);
    const path = [start, new THREE.Vector3(edgeX + 1.0, deckY, pontoon.z - 4 - (i % 2) * 0.9), new THREE.Vector3(edgeX + 0.6, deckY, jetty.z), new THREE.Vector3(hullX + 0.3, deckY + 0.1, jetty.z), new THREE.Vector3(hullX - 0.8, deckY + 0.9, jetty.z)];
    return { f, path, s: 0, delay: i * 0.7, done: false };
  });
  const speed = 1.6;
  const span = spec.span || 30;
  const seg = (p) => { const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + p[i].distanceTo(p[i - 1])); return L; };
  for (const c of crew) c.len = seg(c.path);
  // the camera swings on an arc round the hatch, from ahead of the walking crew out to a wide
  // three-quarter view of the aircraft; the radius grows with the span so a Sunderland's wing
  // never reaches it and the hull is never entered
  const B = new THREE.Vector3(hullX, deckY, jetty.z);
  const minX = edgeX + 2.5;
  const arc = { a0: 0.96, a1: 0.30, r0: Math.max(15, span * 0.52), r1: Math.max(34, span * 1.3), y0: deckY + 3.0, y1: deckY + 12.0 };
  const total = crew[crew.length - 1].len[crew[crew.length - 1].len.length - 1] / speed + crew[crew.length - 1].delay + 3.4;
  let t = 0, finished = false;
  const look = new THREE.Vector3(), _hullMid = new THREE.Vector3();
  return {
    duration: total,
    hinge,
    get finished() { return finished; },
    get t() { return t; },
    get hatch() { return hatch; },
    get aboard() { return crew.filter((c) => c.done).length; },
    update(dt, camera) {
      t += dt;
      let lead = null, aboard = 0;
      for (const c of crew) {
        if (c.done) continue;
        const d = Math.max(0, t - c.delay) * speed;
        const L = c.len, end = L[L.length - 1];
        if (d >= end) { c.done = true; c.f.visible = false; continue; }   // through the hatch
        if (d > end - 1.2) aboard++;   // ducking into the opening
        let i = 1; while (i < L.length - 1 && L[i] < d) i++;
        const a = c.path[i - 1], b = c.path[i], k = (d - L[i - 1]) / Math.max(1e-3, L[i] - L[i - 1]);
        c.f.position.lerpVectors(a, b, k);
        c.f.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        animateFigure(c.f, t, d > 0 ? speed : 0);
        if (!lead) lead = c;
      }
      // the hatch is swung open as the first man reaches the plank and pulled shut behind the
      // last, so the aircraft is buttoned up before the engines are started
      const wantOpen = t > 1.0 && !!lead;
      hatch += ((wantOpen ? 1 : 0) - hatch) * Math.min(1, dt * (wantOpen ? 2.2 : 1.6));
      hinge.rotation.z = hatch * 1.35;
      const u = Math.min(1, t / total), e = u * u * (3 - 2 * u);
      const a = arc.a0 + (arc.a1 - arc.a0) * e, r = arc.r0 + (arc.r1 - arc.r0) * e;
      camera.position.set(Math.max(minX, B.x + Math.cos(a) * r), arc.y0 + (arc.y1 - arc.y0) * e, B.z + Math.sin(a) * r);
      // early on the eye follows the crew; as they board it settles on the aircraft herself
      const w = Math.min(1, Math.max(0, (u - 0.3) / 0.45));
      if (lead) look.copy(lead.f.position).setY(deckY + 1.1); else look.set(B.x, deckY + 1.1, B.z);
      look.lerp(_hullMid.set(jetty.x, deckY + 2.6, jetty.z), w);
      camera.lookAt(look);
      if (!lead && hatch < 0.05) finished = true;
      if (t > total + 2.5) finished = true;
    },
    dispose() { scene.remove(g); },
  };
}
