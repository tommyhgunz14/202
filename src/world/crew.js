import * as THREE from 'three';

// Crew and ground-crew figures, built to the Atlas reference sheet of 1941 Coastal Command
// aircrew: about 7.5 heads tall (1.78 m), broad through the shoulders in the Irvin jacket, the
// Mae West a flat ochre panel over the chest, blue-grey trousers into black fleece-topped boots,
// a parachute bag carried in one hand. Jointed at hips, knees, shoulders and elbows so they walk.
// Kinds: pilot (Irvin + helmet), aircrew (battledress + side cap + Mae West), marshaller
// (dark overalls, side cap, bats), groundcrew (battledress, cork jacket, boat hook).

const mat = (hex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.9 }, o));
const M = {
  skin: mat(0xc99a78), hair: mat(0x3a2a1c), irvin: mat(0x6b4426, { roughness: 0.55 }), fleece: mat(0xd9cfb6, { roughness: 1 }),
  mae: mat(0xc7a24a, { roughness: 0.8 }), bd: mat(0x4d5766), overalls: mat(0x252a3a), boot: mat(0x151515, { roughness: 0.5 }),
  cap: mat(0x1b1d24), helmet: mat(0x4e3320, { roughness: 0.5 }), bag: mat(0x6d6b48), cork: mat(0xb08a52), bat: mat(0xf2efe6, { emissive: 0x333333 }), steel: mat(0x777a80, { metalness: 0.5, roughness: 0.4 }),
};

function capsule(r, h, m) { return new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, h - 2 * r), 3, 8), m); }

export function buildFigure(kind = 'aircrew') {
  const f = new THREE.Group();
  const irvin = kind === 'pilot', overalls = kind === 'marshaller';
  const coat = irvin ? M.irvin : overalls ? M.overalls : M.bd;
  const legMat = overalls ? M.overalls : M.bd;
  // hips at 0.9 m; body carried on a root that bobs while walking
  const body = new THREE.Group(); body.position.y = 0.9; f.add(body);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0, 0); body.add(hip);
    const thigh = capsule(0.085, 0.46, legMat); thigh.position.y = -0.23; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    const shin = capsule(0.07, 0.4, overalls ? legMat : M.boot); shin.position.y = -0.2; knee.add(shin);
    if (!overalls) { const top = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.07, 10), M.fleece); top.position.y = -0.03; knee.add(top); }
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.27), M.boot); foot.position.set(0, -0.44, 0.06); knee.add(foot);
    legs.push({ hip, knee });
  }
  // torso: jacket block, slightly wider at the shoulders, with the collar and the life vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(irvin ? 0.46 : 0.4, 0.6, irvin ? 0.3 : 0.24), coat); torso.position.y = 0.32; body.add(torso);
  if (irvin) { const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 8, 16), M.fleece); collar.rotation.x = Math.PI / 2; collar.position.y = 0.62; body.add(collar); }
  else if (!overalls) { const collar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.16), coat); collar.position.set(0, 0.62, 0.02); body.add(collar); }
  if (kind === 'pilot' || kind === 'aircrew') {   // Mae West: front panel and a collar roll
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.09), M.mae); vest.position.set(0, 0.36, irvin ? 0.17 : 0.14); body.add(vest);
    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 8, 16), M.mae); roll.rotation.x = Math.PI / 2; roll.position.y = 0.57; body.add(roll);
  } else if (kind === 'groundcrew') {
    const cork = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.3), M.cork); cork.position.set(0, 0.4, 0); body.add(cork);
  }
  if (overalls) { const belt = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.05, 0.25), M.boot); belt.position.y = 0.05; body.add(belt); }
  // head and headgear
  const neck = new THREE.Group(); neck.position.y = 0.66; body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), M.skin); head.scale.set(0.9, 1.05, 0.95); head.position.y = 0.12; neck.add(head);
  if (irvin) {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.122, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M.helmet); helmet.position.y = 0.125; neck.add(helmet);
    const goggles = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 6, 16), M.steel); goggles.position.set(0, 0.2, 0.07); goggles.rotation.x = 0.6; neck.add(goggles);
  } else {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.11), M.cap); cap.position.set(0, 0.235, 0.0); cap.rotation.z = 0.12; neck.add(cap);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.117, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), M.hair); hair.position.y = 0.118; neck.add(hair);
  }
  // arms: shoulder and elbow joints
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * (irvin ? 0.27 : 0.24), 0.56, 0); body.add(shoulder);
    const upper = capsule(0.06, 0.32, coat); upper.position.y = -0.16; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.31; shoulder.add(elbow);
    const fore = capsule(0.05, 0.3, coat); fore.position.y = -0.15; elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.skin); hand.position.y = -0.32; elbow.add(hand);
    arms.push({ shoulder, elbow, hand });
  }
  // what they carry
  if (kind === 'pilot' || kind === 'aircrew') {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.2), M.bag); bag.position.set(0.05, -0.5, 0); arms[1].elbow.add(bag);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), M.bag); strap.position.set(0.05, -0.38, 0); arms[1].elbow.add(strap);
  } else if (kind === 'marshaller') {
    for (const a of arms) { const bat = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), M.bat); bat.material.side = THREE.DoubleSide; bat.position.y = -0.48; a.elbow.add(bat); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), M.steel); stick.position.y = -0.4; a.elbow.add(stick); }
  } else if (kind === 'groundcrew') {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.4, 6), M.steel); hook.position.set(0, -0.6, 0.05); arms[1].elbow.add(hook);
    const barb = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), M.steel); barb.position.set(0, 0.6, 0.05); arms[1].elbow.add(barb);
  }
  f.userData = { kind, body, legs, arms, neck, phase: Math.random() * 6.28, bats: kind === 'marshaller' };
  f.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return f;
}

// walk cycle: legs swing from the hip with the knee bending on the back swing, arms swing
// opposite, the body bobs twice per stride and rolls a little; at rest the limbs settle
export function animateFigure(f, t, speed = 0) {
  const u = f.userData; if (!u.legs) return;
  const walking = speed > 0.05;
  const w = walking ? t * (5.2 + speed * 2.5) + u.phase : 0;
  const amp = walking ? Math.min(0.55, 0.3 + speed * 0.25) : 0;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1;
    const swing = Math.sin(w) * s * amp;
    u.legs[i].hip.rotation.x = swing;
    u.legs[i].knee.rotation.x = walking ? Math.max(0, -Math.sin(w) * s) * 0.9 : 0;
    const a = u.arms[i];
    if (!u.bats || !u.batsUp) {
      a.shoulder.rotation.x = -swing * 0.8;
      a.elbow.rotation.x = walking ? -0.35 - Math.max(0, -Math.sin(w) * s) * 0.3 : -0.2;
    }
  }
  u.body.position.y = 0.9 + (walking ? Math.abs(Math.sin(w)) * 0.035 : 0);
  u.body.rotation.z = walking ? Math.sin(w) * 0.04 : 0;
  u.body.rotation.x = walking ? 0.06 : 0;
}
