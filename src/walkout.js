import * as THREE from 'three';
import { buildFigure, animateFigure } from './world/crew.js';

// Mission-start cinematic in the world: the crew come out of the hut on the pontoon, walk its
// length to the gangplank and climb into the moored aircraft one by one while the camera dollies
// along the pontoon at head height. About eleven seconds; Escape, Enter, Space or a controller
// button skips it. Returns an object whose update(dt) drives it and reports when it is over.

export function startWalkout(scene, plane, jetty, pontoon, spec) {
  const g = new THREE.Group(); scene.add(g);
  const deckY = pontoon.deckY;
  // the aircraft lies alongside the pontoon's west edge; the gangplank reaches her hull
  const hullX = jetty.x + (spec.beam || 3) * 0.5 + 0.2, edgeX = pontoon.x - pontoon.halfW;
  const plank = new THREE.Mesh(new THREE.BoxGeometry(edgeX - hullX + 0.6, 0.06, 0.7), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 }));
  plank.position.set((edgeX + hullX) / 2, deckY + 0.02, jetty.z); g.add(plank);
  const kinds = ['pilot', 'pilot', 'aircrew', 'aircrew', 'aircrew', 'aircrew'].slice(0, Math.min(6, spec.crew || 6));
  const crew = kinds.map((k, i) => {
    const f = buildFigure(k);
    // start by the hut, staggered, and walk the west edge of the pontoon to the plank
    const start = new THREE.Vector3(pontoon.x + 1 - (i % 2) * 1.3, deckY, pontoon.z - 7 - Math.floor(i / 2) * 1.5);
    f.position.copy(start); g.add(f);
    const path = [start, new THREE.Vector3(edgeX + 1.0, deckY, pontoon.z - 3 - (i % 2) * 0.8), new THREE.Vector3(edgeX + 0.6, deckY, jetty.z), new THREE.Vector3(hullX + 0.3, deckY + 0.1, jetty.z), new THREE.Vector3(hullX - 0.8, deckY + 0.9, jetty.z)];
    return { f, path, s: 0, delay: i * 0.7, done: false };
  });
  const speed = 1.6;
  const seg = (p) => { const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + p[i].distanceTo(p[i - 1])); return L; };
  for (const c of crew) c.len = seg(c.path);
  // the camera dollies north along the west edge of the pontoon at head height, ahead of the crew
  const cam = { from: new THREE.Vector3(edgeX + 2.5, deckY + 1.7, pontoon.z - 16), to: new THREE.Vector3(edgeX + 2.8, deckY + 1.5, pontoon.z - 3.5) };
  const total = crew[crew.length - 1].len[crew[crew.length - 1].len.length - 1] / speed + crew[crew.length - 1].delay + 1.2;
  let t = 0, finished = false;
  const look = new THREE.Vector3();
  return {
    duration: total,
    get finished() { return finished; },
    update(dt, camera) {
      t += dt;
      let lead = null;
      for (const c of crew) {
        if (c.done) continue;
        const d = Math.max(0, t - c.delay) * speed;
        const L = c.len, end = L[L.length - 1];
        if (d >= end) { c.done = true; c.f.visible = false; continue; }   // through the hatch
        let i = 1; while (i < L.length - 1 && L[i] < d) i++;
        const a = c.path[i - 1], b = c.path[i], k = (d - L[i - 1]) / Math.max(1e-3, L[i] - L[i - 1]);
        c.f.position.lerpVectors(a, b, k);
        c.f.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        animateFigure(c.f, t, d > 0 ? speed : 0);
        if (!lead) lead = c;
      }
      if (!lead) { finished = true; return; }
      const u = Math.min(1, t / total);
      camera.position.lerpVectors(cam.from, cam.to, u * u * (3 - 2 * u));
      look.copy(lead.f.position).setY(deckY + 1.1);
      camera.lookAt(look);
      if (t > total) finished = true;
    },
    dispose() { scene.remove(g); },
  };
}
