// Simulates a full-throttle take-off run for each type and reports time to lift-off.
import { Flight } from '../src/flight.js?v=202609171500';
import { AIRCRAFT } from '../src/data/aircraft.js?v=202609171500';
import * as THREE from 'three';
for (const spec of Object.values(AIRCRAFT)) {
  const obj = new THREE.Object3D();
  const f = new Flight(spec, obj);
  f.reset(new THREE.Vector3(0, 0, 3000), 0, 0, true);
  let t = 0, thr = 0, lift = null, dist = 0;
  const dt = 1 / 60;
  while (t < 40 && lift === null) {
    thr = Math.min(1, thr + dt * 0.5);
    f.update(dt, { throttle: thr, pitch: 0.4, roll: 0, yaw: 0, brake: false });
    t += dt;
    if (!f.onWater) lift = t;
  }
  // landing run: cut throttle at 1.3 x stall on the water and time to below 3 m/s
  const g = new Flight(spec, new THREE.Object3D());
  g.reset(new THREE.Vector3(0, 0, 3000), 0, g.vStall * 1.3, true); g.hullY = 0; let tl = 0;
  while (tl < 90 && g.speed > 3) { g.update(dt, { throttle: 0, pitch: 0, roll: 0, yaw: 0, brake: false }); tl += dt; }
  console.log(spec.name.padEnd(34), 'lift-off', lift ? lift.toFixed(1) + ' s' : 'NEVER', ' at', (f.speed * 2.237).toFixed(0), 'mph;  landing run', tl.toFixed(1), 's');
}
