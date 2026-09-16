import * as THREE from 'three';
import { toWorld, toLatLon, H_SCALE, FT, MPH, KT } from './config.js';
import { buildTerrain, terrainHeight, buildDepthTexture } from './world/terrain.js';
import { buildSea, SEA, seaHeight } from './world/sea.js';
import { buildSky, buildClouds } from './world/sky.js';
import { loadPanorama, buildPanoramaSky } from './world/skybox.js';
import { buildHarbour, JETTY, ENTRANCE, updateMarshallers, updateFlags } from './world/harbour.js';
import { loadOrPlaceholder, findNamed, findAllNamed } from './loader.js';
import { Flight } from './flight.js';
import { Input } from './input.js';
import { Weapons } from './weapons.js';
import { spawnVessel } from './vessels.js';
import { spawnFriendly } from './friendlies.js';
import { foamStrip } from './world/foam.js';
import { buildTown } from './world/buildings.js';
import { buildVegetation } from './world/vegetation.js';
import { Radar } from './radar.js';
import { Hud } from './hud.js';
import { Cockpit } from './cockpit.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { buildCockpitInterior, buildGunnerOverlay } from './cockpitModel.js';
import { spawnBandit } from './bandits.js';
import { initTouch } from './touch.js';
import { Collisions } from './collide.js';
import { runIntro } from './intro.js';
import { startWalkout } from './walkout.js';
import { findCrewShots, startCrewCinematic } from './crewCinematic.js';
import { showPromotion } from './promotion.js';
import { MISSIONS, SKIES, PILOT } from './data/missions.js';
import { AIRCRAFT, availableOn } from './data/aircraft.js';
import { PLANS, DEFAULT_PLAN } from './data/plans.js';
import { HARBOUR } from './data/geo.js';

// ---------- renderer & scene ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
// clips the aircraft below the local sea surface while it is on or near the water
const waterClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);

const scene = new THREE.Scene();
// cockpit interior drawn in its own pass over the world (see cockpitModel.js)
const cockpitScene = new THREE.Scene();
const cockpitCam = new THREE.PerspectiveCamera(62, 1, 0.05, 30);
renderer.autoClear = false;
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 60000);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10; sun.shadow.camera.far = 3000;
sun.shadow.camera.left = -400; sun.shadow.camera.right = 400; sun.shadow.camera.top = 400; sun.shadow.camera.bottom = -400;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 2.0;
const sunTarget = new THREE.Object3D();
scene.add(sun, sunTarget); sun.target = sunTarget;
const hemi = new THREE.HemisphereLight(0xbfd6ea, 0x3d5a3a, 0.55);
scene.add(hemi);

let sky = null, sea = null, clouds = null;
const world = new THREE.Group(); scene.add(world);
const terrain = buildTerrain(); world.add(terrain);
const depthTex = buildDepthTexture(384);
const harbour = buildHarbour(); world.add(harbour);
const town = buildTown(); world.add(town);
const vegetation = buildVegetation(); world.add(vegetation);
// solid things the aircraft can strike, besides the terrain and the sea
const collisions = new Collisions();
collisions.addStatic(harbour, 'the harbour works');
collisions.addList(town.userData.colliders, 'a building');
// foam left by the flying boat: a V of two wake streaks astern, a turbulent centre trail, and two
// wash sheets thrown off the chines while she is up on the step
const planeWake = {
  centre: foamStrip(1, 1, { repeatY: 5, edge: 0.4, taper: 0.45, tailPow: 0.7 }),
  left: foamStrip(1, 1, { repeatY: 7, edge: 0.7, taper: 0.5 }), right: foamStrip(1, 1, { repeatY: 7, edge: 0.7, taper: 0.5 }),
  washL: foamStrip(1, 1, { repeatY: 2, edge: 0.3, taper: 0.3, scroll: 0.9 }), washR: foamStrip(1, 1, { repeatY: 2, edge: 0.3, taper: 0.3, scroll: 0.9 }),
  stern: foamStrip(1, 1, { repeatY: 1.5, repeatX: 1.5, edge: 0.2, taper: 0.7, headFade: 0.02, tailPow: 0.5, scroll: 1.2 }),
};
for (const k of Object.keys(planeWake)) { planeWake[k].visible = false; scene.add(planeWake[k]); }
let wakeFade = 0, sprayAcc = 0, wasOnWater = true;
const glintTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d').createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,248,224,0.55)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  const x = c.getContext('2d'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const glints = [];   // {sprite, local} - local is a point on the airframe in aircraft space
function buildGlints(plane) {
  for (const g of glints) scene.remove(g.sprite);
  glints.length = 0;
  const span = plane.userData.span || 30, len = plane.userData.length || 20;
  const pts = [[span * 0.28, 1.4, len * 0.02], [-span * 0.28, 1.4, len * 0.02], [0, 1.9, len * 0.3]];
  for (const p of pts) {
    const mat = new THREE.SpriteMaterial({ map: glintTex, color: 0xfff6e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false });
    const s = new THREE.Sprite(mat); s.scale.setScalar(6); s.visible = false; scene.add(s);
    glints.push({ sprite: s, local: new THREE.Vector3(p[0], p[1], p[2]) });
  }
}
const _gp = new THREE.Vector3(), _gn = new THREE.Vector3(), _gl = new THREE.Vector3(), _gv = new THREE.Vector3(), _gr = new THREE.Vector3();
function updateGlints(f) {
  if (!glints.length || !f) return;
  // the surface faces the way the aircraft's own up vector points, so the flash swings with bank
  _gn.set(0, 1, 0).applyQuaternion(f.obj.quaternion).normalize();
  _gl.copy(sun.position).sub(sun.target.position).normalize();          // toward the sun
  const facing = _gn.dot(_gl);
  for (const g of glints) {
    const s = g.sprite;
    if (facing <= 0.02 || f.crashed) { s.visible = false; continue; }
    _gp.copy(g.local).applyQuaternion(f.obj.quaternion).add(f.obj.position);
    _gv.copy(camera.position).sub(_gp).normalize();
    // mirror the sun in the surface and see how near the reflection comes to the eye
    _gr.copy(_gn).multiplyScalar(2 * facing).sub(_gl).normalize();
    const align = _gr.dot(_gv);
    const k = align <= 0.82 ? 0 : Math.pow((align - 0.82) / 0.18, 1.7);
    if (k <= 0.01) { s.visible = false; continue; }
    s.visible = true; s.position.copy(_gp);
    s.material.opacity = Math.min(1, k * 1.15);
    s.scale.setScalar(5 + 13 * k);
  }
}

// Panoramas generated with Atlas live in assets/sky/<name>.jpg; when one exists it replaces the
// shader sky and tints fog and sea to match. Missing files fall back silently.
const panoramas = {};
let skyGen = 0;
function applySky(name) {
  const p = SKIES[name] || SKIES.morning;
  const dir = new THREE.Vector3(...p.sun).normalize();
  if (sky) scene.remove(sky);
  sky = buildSky(dir, p); scene.add(sky);
  if (sea) scene.remove(sea);
  sea = buildSea(dir, p.fog, p.fogDensity, depthTex); scene.add(sea);
  if (harbour) { const sh = harbour.userData.shelter; sea.material.uniforms.uShelter.value.set(sh.x, sh.z, sh.r); SEA.shelter = sh; }
  scene.fog = new THREE.FogExp2(p.fog, p.fogDensity);
  // a preset without a panorama (night) sets the water's colours itself
  if (p.sea) { const u = sea.material.uniforms; u.uDeep.value.setHex(p.sea.deep); u.uShallow.value.setHex(p.sea.shallow); u.uSky.value.setHex(p.sea.sky); if (u.uShallowCol) u.uShallowCol.value.setHex(p.sea.shallowCol); }
  const gen = ++skyGen;
  (p.sea ? Promise.resolve(null) : (panoramas[name] ||= loadPanorama(`assets/sky/${name}.jpg`).catch(() => null))).then((tex) => {
    if (!tex || gen !== skyGen) return;
    const pano = buildPanoramaSky(tex, dir);
    scene.remove(sky); sky = pano; scene.add(sky);
    const info = pano.userData.info;
    // blend the world into the picture: fog and sea haze from the horizon band
    const fogCol = info.horizon.clone().lerp(new THREE.Color(p.fog), 0.35);
    scene.fog.color.copy(fogCol);
    sea.material.uniforms.uFogColor.value.copy(fogCol);
    sea.material.uniforms.uSky.value.copy(info.horizon.clone().lerp(info.zenith, 0.4));
    // the water takes its own colour from the panorama's sea so it matches the light
    sea.material.uniforms.uDeep.value.copy(info.sea.clone().multiplyScalar(0.55));
    sea.material.uniforms.uShallow.value.copy(info.sea.clone().multiplyScalar(1.05));
    if (clouds) clouds.traverse((o) => { if (o.material) o.material.color.copy(info.horizon.clone().lerp(new THREE.Color(0xffffff), 0.6)); });
  });
  sun.position.copy(dir).multiplyScalar(1500);
  sun.color.setHex(p.sunColor); sun.intensity = p.sunI;
  hemi.intensity = p.ambient;
  if (clouds) scene.remove(clouds);
  return p;
}
applySky('morning');

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  cockpitCam.aspect = w / h; cockpitCam.updateProjectionMatrix();
  const cp = document.getElementById('cockpit');
  if (cp.width !== 1400) { cp.width = 1400; cp.height = 520; }
}
window.addEventListener('resize', resize); resize();

// ---------- systems ----------
const input = new Input();
const audio = new Audio();
const weapons = new Weapons(scene, audio);
const radar = new Radar(document.getElementById('asv'), document.getElementById('plot'));
const hud = new Hud(document.getElementById('hud'));
const cockpit = new Cockpit(document.getElementById('cockpit'));
const ui = new UI(document.getElementById('ui'), input);
const pauseEl = document.getElementById('pause');
const BASE = toWorld(36.1400, -5.3720);   // the harbour moorings: alight within 1500 m

const _side = new THREE.Vector3(), _size = new THREE.Vector2();
const G = {
  running: false, paused: false, mission: null, spec: null, plane: null, flight: null,
  vessels: [], view: 'chase', stores: 0, ammo: 0, fireTimer: 0, dropTimer: 0, time: 0, clock: 0,
  objectives: [], events: [], reportCooldown: 0, crewGunTimer: 0, endTimer: -1, result: null,
  slick: null, score: 0, penalties: 0, tookOff: false, idCount: 0, identifiedTargets: new Set(),
  views: ['chase', 'cockpit'], viewIdx: 0, aim: { yaw: 0, pitch: 0 }, bandits: [], parked: [], pendingBandits: [], friendlies: [], ferries: [], pendingFriendlies: [], flags: new Set(), flagTimes: {}, triggers: [], timers: [], interior: null,
  range: { hits: 0, rounds: 0, dcScore: 0, drops: 0 }, gunInvert: true,
};
window.G = G;
window.DBG = { scene, camera, input, weapons, audio, endMission: () => endMission(), get renderer() { return renderer; }, get sea() { return sea; }, terrainHeight, THREE };

input.onPad = (id) => { if (id) hud.log(`Controller connected: ${id.slice(0, 40)}`, 'ok'); };
// The title cue. useTracks is called as well as setMood because setMood returns early once the
// mood is already 'menu', which would leave the generative pad playing if the clips had not
// finished decoding the first time round.
function startMenuMusic() {
  audio.init(); audio.resume();
  if (G.running) return;
  audio.music.setMood('menu');
  if (audio.music.useTracks) audio.music.useTracks('menu');
}
document.body.addEventListener('pointerdown', startMenuMusic, { once: false });
document.body.addEventListener('keydown', startMenuMusic);

// ---------- mission setup ----------
function clearMission() {
  for (const v of G.vessels) scene.remove(v.group);
  G.vessels = [];
  if (G.plane) scene.remove(G.plane);
  G.plane = null; G.flight = null;
  for (const g of glints) scene.remove(g.sprite);
  glints.length = 0;
  for (const pk of G.parked || []) scene.remove(pk.g);
  G.parked = [];
  for (const b of G.bandits) scene.remove(b.group);
  G.bandits = []; G.pendingBandits = []; G.gunners = {}; pipClose(); dcCamClose();
  for (const fr of G.friendlies) { scene.remove(fr.group); if (fr.tag) fr.tag.remove(); }
  G.friendlies = []; G.pendingFriendlies = []; G.flags = new Set(); G.flagTimes = {}; G.triggers = []; G.timers = [];
  for (const fe of G.ferries || []) scene.remove(fe.g);
  G.ferries = [];
  if (G.cine) { G.cine.dispose(); G.cine = null; document.body.classList.remove('cine'); }
  if (G.interior) { cockpitScene.remove(G.interior.group); G.interior = null; }
  if (G.gunOverlay) { cockpitScene.remove(G.gunOverlay.group); G.gunOverlay = null; }
  for (const t of weapons.tracers) scene.remove(t.mesh);
  for (const c of weapons.charges) scene.remove(c.mesh);
  for (const e of weapons.effects) { for (const k of ['ring', 'col', 'mesh']) if (e[k]) scene.remove(e[k]); }
  weapons.tracers = []; weapons.charges = []; weapons.effects = [];
  radar.reports = []; hud.lines = []; hud.el.log.innerHTML = '';
  audio.stopEngines();
}

function randomEntities(m) {
  const out = [];
  const a = m.area;
  const rnd = (r) => (Math.random() * 2 - 1) * r;
  const pos = () => ({ lat: a.lat + rnd(0.09), lon: a.lon + rnd(0.28) });
  const types = ['coaster', 'fishing', 'fishing', Math.random() < 0.5 ? 'uboat' : 'itsub', Math.random() < 0.5 ? 'uboat' : 'itsub', Math.random() < 0.4 ? 'freighter' : 'coaster'];
  let n = 0;
  for (const t of types) {
    const p = pos();
    const isSub = t === 'uboat' || t === 'itsub';
    out.push({ type: t, name: isSub ? (t === 'uboat' ? `U-${400 + Math.floor(Math.random() * 300)}` : ['Alagi', 'Dandolo', 'Emo', 'Otaria'][Math.floor(Math.random() * 4)]) : t === 'freighter' ? 'German freighter' : t === 'coaster' ? 'Spanish coaster' : 'Fishing boat', ...p, heading: Math.random() * 360, speed: isSub ? 9 : 6, surfaced: true, resurfaceAfter: 120, waypoints: [[p.lat + rnd(0.1), p.lon + rnd(0.3)], [p.lat + rnd(0.1), p.lon + rnd(0.3)]], behaviour: 'loop' });
    n++;
  }
  return out;
}

async function startMission(mission, spec, roleId) {
  clearMission();
  // the part the player takes: the first role is the sortie as the record has it
  const plan = PLANS[mission.id] || DEFAULT_PLAN;
  const role = plan.roles ? (plan.roles.find((r) => r.id === roleId) || plan.roles[0]) : null;
  G.plan = plan; G.role = role;
  G.mission = mission; G.spec = spec; G.running = false; G.paused = false; G.probes = null;
  G.time = 0; G.park = null; G.endTimer = -1; G.result = null; G.landedMsg = false; G.score = 0; G.penalties = 0; G.tookOff = false; G.idCount = 0; G.identifiedTargets.clear();
  G.clock = { dawn: 6 * 3600 + 10 * 60, morning: 8 * 3600 + 30 * 60, afternoon: 14 * 3600 + 20 * 60, dusk: 18 * 3600 + 40 * 60, night: 22 * 3600 + 20 * 60 }[mission.sky] || 8 * 3600;
  if (mission.clock) { const [hh, mm] = mission.clock.split(':').map(Number); G.clock = hh * 3600 + mm * 60; }
  const pal = applySky(mission.sky);
  clouds = buildClouds(mission.clouds || 25, 14000, 900 + Math.random() * 400, pal.horizon); scene.add(clouds);
  // aircraft
  const plane = await loadOrPlaceholder(spec.asset, 20, 30, 'aircraft');
  scene.add(plane); G.plane = plane;
  plane.traverse((n) => { if (n.isMesh && n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; for (const mt of ms) { mt.clippingPlanes = [waterClip]; mt.clipShadows = true; } } });
  G.props = findAllNamed(plane, 'prop');
  G.gunNodes = {}; G.gunGeom = {};
  plane.updateMatrixWorld(true);
  for (const g of spec.guns) {
    const n = findNamed(plane, g.node); G.gunNodes[g.node] = n; if (!n) continue;
    // where the mount sits and which way it points, in aircraft space, so a beam gun always looks
    // outboard whichever side it was modelled on
    const lp = plane.worldToLocal(n.getWorldPosition(new THREE.Vector3()));
    const ld = new THREE.Vector3(0, 0, 1).applyQuaternion(n.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(plane.quaternion.clone().invert());
    let dir;
    if (g.arc === 'left' || g.arc === 'right') dir = new THREE.Vector3(Math.sign(lp.x || 1), 0, 0);       // outboard
    else if (g.arc === 'forward') dir = new THREE.Vector3(0, 0, 1);
    else if (g.arc === 'rear' || g.arc === 'upper') dir = new THREE.Vector3(0, 0, -1);
    else dir = Math.abs(ld.x) + Math.abs(ld.z) > 0.2 ? new THREE.Vector3(ld.x, 0, ld.z).normalize() : new THREE.Vector3(0, 0, 1);
    G.gunGeom[g.node] = { side: Math.sign(lp.x || 1), baseYaw: Math.atan2(-dir.x, -dir.z), dir };
  }
  G.cockpitNode = findNamed(plane, 'cockpit'); G.bayNode = findNamed(plane, 'bomb_bay');
  buildGlints(plane);
  G.flight = new Flight(spec, plane);
  // berthed alongside the pontoon: the hull parallel to its long (north-south) edge, port side to
  // it and bow to the south, standing off far enough that the wingtip and its float clear the deck
  // by three metres. The hatch the crew use is aft of the wing, and a floating gangway reaches it.
  const pont = harbour.userData.pontoon;
  const span = plane.userData.span || 30, length = plane.userData.length || 20;
  // the hatch the crew use, along the hull; a Swordfish is boarded from her port float aft of the
  // lower wing, 2.75 m behind the pilot's cockpit
  const cockpitLocal = G.cockpitNode ? plane.worldToLocal(G.cockpitNode.getWorldPosition(new THREE.Vector3())) : null;
  const hatchZ = spec.id === 'swordfish' && cockpitLocal ? cockpitLocal.z - 2.75 : -0.3 * length;
  G.cockpitLocal = cockpitLocal;
  const berth = { x: pont.x - pont.halfW - span / 2 - 3, z: JETTY.z, heading: 0, hullZ: JETTY.z - hatchZ };
  const toEnt = berth.heading;
  G.berth = berth;
  G.flight.reset(new THREE.Vector3(berth.x, 0, berth.z - hatchZ), berth.heading, 0, true);
  G.taxiedOut = false;
  input.throttle = 0;
  G.stores = spec.stores.count; G.ammo = spec.guns[0].rounds;
  radar.fitted = !!spec.asv;
  // vessels
  let ents = mission.entities === 'random' ? randomEntities(mission) : mission.entities;
  if (role) ents = ents.map((e) => {
    const set = role.entitySet && (role.entitySet[e.name] || role.entitySet[e.short]);
    const script = role.scripts && (role.scripts[e.name] || role.scripts[e.short]);
    if (!set && !script) return e;
    const out = { ...e };
    if (set) { out.set = { ...(e.set || {}), ...set }; for (const k of Object.keys(out.set)) if (out.set[k] === null) delete out.set[k]; }
    if (script) out.script = script;
    return out;
  });
  const byName = {};
  for (const e of ents) {
    if (e.type === 'bandit') { if (Math.random() <= (e.chance == null ? 1 : e.chance)) G.pendingBandits.push({ ...e, timer: e.delay || 180 }); continue; }
    if (e.type === 'friendly') { G.pendingFriendlies.push({ ...e, timer: e.delay == null ? 6 : e.delay }); continue; }
    const v = await spawnVessel(e.type, e);
    v.tag = e.tag || null;
    if (e.set) Object.assign(v, e.set);
    if (e.hideNodes) for (const n of e.hideNodes) for (const o of findAllNamed(v.group, n)) o.visible = false;
    v.heading = Math.PI - (e.heading || 0) * Math.PI / 180; v.group.rotation.y = v.heading;
    scene.add(v.group); G.vessels.push(v); byName[v.name] = v;
  }
  for (const v of G.vessels) if (v.escortOf && typeof v.escortOf === 'string') v.escortOf = byName[v.escortOf] || null;
  if (mission.rules && mission.rules.slick) {
    const p = toWorld(mission.rules.slick.lat, mission.rules.slick.lon);
    weapons.oilSlick(new THREE.Vector3(p.x, 0, p.z), 45, true);
    G.slick = new THREE.Vector3(p.x, 0, p.z);
  } else G.slick = null;
  mission.datums = [];
  G.objectives = ((role && role.objectives) || mission.objectives).map((o) => ({ ...o, done: false, failed: false, progress: 0, near: 0, elapsed: 0, baseText: o.text }));
  G.triggers = ((role && role.triggers) || mission.triggers || []).map((t) => ({ ...t, fired: false }));
  G.range = { hits: 0, rounds: 0, dcScore: 0, drops: 0 };
  // views: chase, cockpit, then every manned gun position the type has
  G.views = ['chase', 'cockpit', 'bombsight', ...spec.guns.filter((g) => G.gunNodes[g.node] && !g.fixed).map((g) => 'gun:' + g.node)];
  G.viewIdx = 0; G.aim = { yaw: 0, pitch: 0 };
  G.interior = buildCockpitInterior(spec, document.getElementById('cockpit'));
  cockpitScene.add(G.interior.group);
  G.events = [];
  G.view = 'chase';
  if (mission.rules && mission.rules.range) hud.log('Range procedure: cycle the gun positions with V / Y; the rafts score bullseye inside 10 m, near inside 25 m, wide inside 50 m.');
  audio.init(); audio.resume();
  audio.music.setMood('patrol');
  document.body.classList.add('flying');
  // the crew walk out along the pontoon and board before the engines are started
  // the promotion runs before the Casablanca sortie of 28 January 1941, by which date the
  // squadron record calls him Wing Commander (see docs/HISTORY.md)
  if (mission.id === 'casablanca' && !G.promoShown) { G.promoShown = true; await showPromotion(document.body, input); }
  const BEAMS = { catalina: 3.1, london: 3.2, sunderland: 3.4, swordfish: 2.2 };
  const walk = startWalkout(scene, plane, { x: G.berth.x, z: G.berth.z }, harbour.userData.pontoon, { crew: spec.crew, beam: BEAMS[spec.id] || 3, span: plane.userData.span || 30, length: plane.userData.length || 20, heading: toEnt, boarding: spec.id === 'swordfish' ? 'cockpit' : 'hatch', cockpit: G.cockpitLocal });
  // where film of this aircraft type's crew exists, it plays over the walk-out (see crewCinematic.js)
  // the rest of the squadron at their buoys: the types it flew on the sortie's date, lying head to
  // the easterly the windsock shows, each riding to her buoy by the bow. Buoys 3 to 5 only: the
  // first is too close to the pontoon, the second is the title screen's aircraft, and all three
  // are well clear of the line from the berth to the harbour entrance
  G.parked = [];
  {
    const avail = availableOn(mission.date);
    const order = [...avail.filter((a) => a.id !== spec.id), ...avail.filter((a) => a.id === spec.id)];
    const slots = [2, 3, 4].map((i) => harbour.userData.moorings[i]).filter(Boolean);
    for (let i = 0; i < slots.length && order.length; i++) {
      const ps = order[i % order.length];
      const pg = await loadOrPlaceholder(ps.asset, 20, 30, 'aircraft');
      pg.traverse((n) => { if (n.isMesh && n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; for (const mt of ms) { mt.clippingPlanes = [waterClip]; mt.clipShadows = true; } } });
      const y0 = -(ps.draft || 1.0), h = Math.PI / 2 + (i - 1) * 0.1;
      const back = (pg.userData.length || 20) * 0.5 + 5;   // the buoy is off the bow on a short pennant
      pg.position.set(slots[i].x - Math.sin(h) * back, y0, slots[i].z - Math.cos(h) * back); pg.rotation.y = h;
      scene.add(pg);
      G.parked.push({ g: pg, y0, h, ph: i * 1.7 });
    }
  }
  const crewShots = await findCrewShots(spec.id);
  G.cine = crewShots.length ? startCrewCinematic(crewShots, walk) : walk;
  document.body.classList.add('cine');
  if (titlePlane) titlePlane.visible = false;
  G.running = true;
}
ui.onStart = (mission, spec, role) => startMission(mission, spec, role);
// launch intro: shown once per page load, before the title menu (skippable)
ui.hide();
const intro = runIntro(document.body, input, { onMusic: startMenuMusic, onDone: () => { if (G.quick) return; ui.show(); if (audio.ctx) audio.music.setMood('menu'); } });
// Quick sortie: one tap from the opening cards straight to a Catalina on the practice range
const touch = initTouch(input);
const startb = document.getElementById('startb');
startb.addEventListener('click', (e) => {
  e.stopPropagation();
  if (G.running || G.quick) return;
  G.quick = true; startb.parentNode.remove();
  intro.skip(); ui.hide();
  const m = MISSIONS.find((x) => x.id === 'range');
  startMission(m, AIRCRAFT.catalina).then(() => { finishWalkout(); input.throttle = 0.3; G.quick = false; });
});
window.__READY__ = true;

// crew aboard: engines started, HUD shown, briefing on the log (also reached by skipping)
function finishWalkout() {
  if (!G.cine) return;
  G.cine.dispose(); G.cine = null; document.body.classList.remove('cine');
  const spec = G.spec, mission = G.mission;
  hud.log(`${mission.date} — ${mission.title}. ${spec.name} ${spec.code} moored in Gibraltar harbour. Crew aboard, engines running.`);
  hud.log(`Captain: ${PILOT.rank1} ${PILOT.name}. Taxi out through the north entrance (the marshallers will see you off), then full throttle in the Bay and hold the nose up past ${(spec.stall * 1.1).toFixed(0)} mph.`);
  audio.startEngines(spec.engines.startsWith('4') ? 4 : spec.engines.startsWith('2') ? 2 : 1, spec.id === 'swordfish' ? 70 : 55);
  setTimeout(() => G.running && audio.say('voice_bow_ready', 999), 2500);
  document.getElementById('hud').style.display = 'block';
}

// ---------- automated gunners: intercom and the window at top right ----------
const GUN_LABELS = { gun_dorsal: 'Midships gunner', gun_tail: 'Tail gunner', gun_waist_l: 'Port gunner', gun_waist_r: 'Starboard gunner', gun_nose: 'Bow gunner' };
const pipCam = new THREE.PerspectiveCamera(48, 300 / 180, 3.5, 60000);   // near plane clears the gunner's own hull; far reaches the sky sphere
const pipEl = document.getElementById('gun-cam'), pipTitle = document.getElementById('gun-cam-title'), pipState = document.getElementById('gun-cam-state');
function pipShow(g, st, label, cls = '') {
  G.pip = { node: g.node, target: st.target, closeAt: Infinity };
  pipTitle.textContent = `${GUN_LABELS[g.node] || g.name} · ${g.name}`;
  pipState.textContent = label; pipState.className = cls;
  document.body.classList.add('pip');
}
function pipSet(label, cls, closeIn) { if (!G.pip) return; pipState.textContent = label; pipState.className = cls; G.pip.closeAt = G.time + closeIn; }
function pipClose() { G.pip = null; document.body.classList.remove('pip'); }
function gunnerReport(g, st, kind) {
  const pos = g.node.replace('gun_', ''), label = GUN_LABELS[g.node] || g.name, tg = st.target;
  const air = tg && tg.kind === 'aircraft';
  const mine = G.pip && G.pip.node === g.node;
  if (kind === 'spot') {
    ctx.log(`${label}: ${tg.name} ${air ? 'sighted' : 'in sight'}.`, air ? 'bad' : undefined);
    audio.say(air ? 'gun_spot_' + pos : 'gun_spot_surface', 8);
    if (!G.pip || G.pip.closeAt < Infinity) pipShow(g, st, 'Sighted');
  } else if (kind === 'fire') {
    ctx.log(`${label} opening fire on ${tg.name}.`);
    audio.say('gun_fire_' + pos, 6);
    pipShow(g, st, 'Engaging');
  } else if (kind === 'kill') {
    ctx.log(`${label}: ${tg.name} destroyed!`, 'ok'); G.score += 60;
    audio.say(Math.random() < 0.5 ? 'gun_kill_1' : 'gun_kill_2', 2);
    if (mine) pipSet('Kill!', 'kill', 4); else pipShow(g, st, 'Kill!', 'kill'), pipSet('Kill!', 'kill', 4);
  } else if (kind === 'sunk') {
    if (tg.alive && tg.abandoned) { ctx.log(`${label}: her crew are going over the side. Ceasing fire.`, 'ok'); if (mine) pipSet('Ceased fire', 'kill', 3); }
    else { ctx.log(`${label}: ${tg.name} finished.`, 'ok'); if (mine) pipSet('Target sunk', 'kill', 3); }
  } else if (kind === 'escape') {
    ctx.log(`${label}: ${tg.name} breaking off for home.`);
    audio.say(Math.random() < 0.5 ? 'gun_escape_1' : 'gun_escape_2', 4);
    if (mine) pipSet('Escaped', 'esc', 3);
  } else if (kind === 'lost') {
    if (mine) pipSet('Lost contact', 'esc', 2);
  }
}
function updatePip() {
  if (!G.pip) return;
  if (G.time > G.pip.closeAt || !G.running) { pipClose(); return; }
  const node = G.gunNodes[G.pip.node]; if (!node || !G.pip.target) { pipClose(); return; }
  node.getWorldPosition(_v1);
  _v3.copy(G.pip.target.group.position);
  _v2.copy(_v3).sub(_v1).normalize();
  // eye just ahead of the muzzle, a little above the line of fire, so the hull stays out of shot
  pipCam.position.copy(_v1).addScaledVector(_v2, 0.8); pipCam.position.y += 0.3;
  pipCam.up.set(0, 1, 0); pipCam.lookAt(_v3);
}

// ---------- depth-charge camera ----------
// From the moment a stick is released, an inset follows it down: low over the water abeam the line
// of the attack, the charges falling, the splashes, the pause while they sink to their setting and
// the plumes, with the boat beside them if one is there. It closes a few seconds after the last.
const dcCam = new THREE.PerspectiveCamera(50, 340 / 200, 0.5, 60000);
const dcEl = { title: document.getElementById('dc-cam-title'), state: document.getElementById('dc-cam-state'), frame: document.getElementById('dc-cam-frame') };
const _dcC = new THREE.Vector3(), _dcL = new THREE.Vector3(), _dcP = new THREE.Vector3();
function dcCamClose() { G.dc = null; document.body.classList.remove('dccam'); }
function dcCamAdd(c) {
  if (!c) return;
  if (!G.dc || G.dc.lastDet != null) {
    const fw = G.flight.forward(new THREE.Vector3()).setY(0).normalize();
    G.dc = { charges: [], track: fw, side: 1, lastDet: null, closeAt: G.time + 25, pos: null, look: null, depthFt: weapons.depthSetting, best: null, target: null };
    dcEl.title.textContent = `${G.spec.stores.kind} · ${weapons.depthSetting} ft`;
    dcEl.state.textContent = 'Released'; dcEl.state.className = '';
    document.body.classList.add('dccam');
  }
  G.dc.charges.push(c);
}
function dcTarget(at) {
  // the vessel the stick was meant for: the nearest one to the fall of the charges
  let best = null, bd = 260;
  for (const v of G.vessels) {
    if (v.kind === 'survivors' || (!v.alive && v.sinking > 20)) continue;
    const d = Math.hypot(v.group.position.x - at.x, v.group.position.z - at.z) - v.length * 0.5;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function updateDcCam(dt) {
  const dc = G.dc; if (!dc) return;
  if (!G.running || G.time > dc.closeAt) { dcCamClose(); return; }
  // centre of the stick: charges still falling or sinking, or where they went off
  _dcC.set(0, 0, 0); let live = 0, inWater = 0;
  for (const c of dc.charges) {
    _dcC.x += c.mesh.position.x; _dcC.z += c.mesh.position.z; _dcC.y += Math.max(0, c.mesh.position.y);
    if (!c.detonated) { live++; if (c.phase === 'water') inWater++; }
    else if (c.detAt == null) {
      c.detAt = G.time;
      const v = dcTarget(c.mesh.position);
      if (v) { const d = Math.max(0, Math.hypot(v.group.position.x - c.mesh.position.x, v.group.position.z - c.mesh.position.z) - v.length * 0.35); if (!dc.best || d < dc.best.d) dc.best = { d, v }; }
    }
  }
  _dcC.multiplyScalar(1 / dc.charges.length); _dcC.y = Math.min(_dcC.y, 40);
  if (!dc.target || (!dc.target.alive && dc.target.sinking > 20)) dc.target = dcTarget(_dcC);
  const tgt = dc.target;
  if (live === 0 && dc.lastDet == null) { dc.lastDet = G.time; dc.closeAt = G.time + 5; }
  // what to look at: the stick, pulled toward the boat so both are in the frame
  _dcL.copy(_dcC);
  if (tgt) { _dcL.x = _dcL.x * 0.6 + tgt.group.position.x * 0.4; _dcL.z = _dcL.z * 0.6 + tgt.group.position.z * 0.4; }
  _dcL.y = Math.max(4, _dcL.y * 0.5 + (dc.lastDet != null || inWater ? 8 : 0));
  // where to stand: abeam the line of the attack on the far side from the boat, low and a little ahead
  if (!dc.pos) {
    if (tgt) { const rx = tgt.group.position.x - _dcC.x, rz = tgt.group.position.z - _dcC.z; dc.side = (rx * dc.track.z - rz * dc.track.x) > 0 ? 1 : -1; }
  }
  const span = tgt ? Math.hypot(tgt.group.position.x - _dcC.x, tgt.group.position.z - _dcC.z) : 0;
  const dist = 95 + Math.min(110, span * 0.8);
  _dcP.set(_dcC.x - dc.track.z * dc.side * dist + dc.track.x * 30, 12, _dcC.z + dc.track.x * dc.side * dist + dc.track.z * 30);
  if (!dc.pos) { dc.pos = _dcP.clone(); dc.look = _dcL.clone(); }
  else if (dc.lastDet == null) dc.pos.lerp(_dcP, Math.min(1, dt * 3));   // once they have gone off, hold still for the plumes
  dc.look.lerp(_dcL, Math.min(1, dt * 4));
  dcCam.position.copy(dc.pos); dcCam.up.set(0, 1, 0); dcCam.lookAt(dc.look);
  // the state line
  let label, cls = '';
  if (dc.lastDet != null) {
    if (dc.best && dc.best.d < 12) { label = `Straddle! ${dc.best.v.name}`; cls = 'kill'; }
    else if (dc.best && dc.best.d < 40) { label = `Close · ${dc.best.d.toFixed(0)} m from ${dc.best.v.name}`; cls = 'kill'; }
    else if (dc.best) { label = `Wide · ${dc.best.d.toFixed(0)} m`; cls = 'esc'; }
    else label = 'Detonated';
  } else if (dc.charges.some((c) => c.detonated)) label = 'Detonating';
  else if (inWater) label = `Sinking to ${dc.depthFt} ft`;
  else label = dc.charges.length > 1 ? `Stick of ${dc.charges.length} falling` : 'Falling';
  if (dcEl.state.textContent !== label) { dcEl.state.textContent = label; dcEl.state.className = cls; }
}

// ---------- callsign ----------
// Radio traffic to this aircraft opens with her captain's callsign: Wg Cdr T. Q. Horner was
// 'Jackie'. Anything a squadron aircraft or its pilot says to you ("FP164/L: "...", "Finch: "...")
// becomes "Jackie, ...", and Gibraltar answers a W/T report the same way. The crew on the intercom
// still call him skipper, and the US Navy aircraft, who are not talking to him, are left alone.
const CALLSIGN = 'Jackie';
// words that keep their capital when "Jackie, " is put in front of them
const KEEP_CAP = /^(I\b|I'|HMS\b|US\b|U-\d|[A-Z]{2,}|Seraph|Gibraltar|General|Finch|Walshe|Case|Louw|Clark|Giraud|Wishart|Anthony|Tangier|Alabastro|Americans|Italian|German|French|Vichy|Rock\b)/;
function withCallsign(text) {
  if (typeof text !== 'string' || !text.includes('"')) return text;
  const speakers = new Set();
  for (const fr of [...(G.friendlies || []), ...(G.pendingFriendlies || [])]) {
    if (fr.faction === 'usn' || (fr.opts && fr.opts.faction === 'usn')) continue;
    if (fr.short) speakers.add(fr.short);
    const pilot = fr.pilot || (fr.opts && fr.opts.pilot);
    if (pilot) speakers.add(pilot.split(' ').pop());
  }
  if (!speakers.size) return text;
  return text.replace(/(^|\s)([A-Za-z0-9/-]+): "([^"]*)"/g, (m, pre, who, said) => {
    if (!speakers.has(who) || said.startsWith(CALLSIGN)) return m;
    const rest = KEEP_CAP.test(said) ? said : said.charAt(0).toLowerCase() + said.slice(1);
    return `${pre}${who}: "${CALLSIGN}, ${rest}"`;
  });
}

// ---------- helpers used by vessel AI ----------
const ctx = {
  get player() { return G.flight; }, get vessels() { return G.vessels; }, get time() { return G.time; },
  weapons, audio, scene,
  log: (t, c) => { t = withCallsign(t); hud.log(t, c); G.events.push({ t: G.time, text: t }); },
  enemyFire(v, p) {
    const from = new THREE.Vector3(); (findNamed(v.group, 'flak') || findNamed(v.group, 'bridge') || v.group).getWorldPosition(from);
    from.y = Math.max(from.y, 2);
    // lead for the time of flight, and aim off above for the drop of the round over that time
    const tof = from.distanceTo(p.obj.position) / 320;
    // (gun layers habitually under-led a crossing aircraft: the stream falls a little behind her, close enough to be heard going past)
    const to = p.obj.position.clone().addScaledVector(p.forward(new THREE.Vector3()), p.speed * Math.max(0, tof - 0.35));
    to.y += 0.5 * 9.81 * 0.3 * tof * tof;
    const dir = to.sub(from).normalize();
    weapons.fireTracer(from, dir, 320, true, 0.026 + 0.012 * tof, v);   // wider at long range: a gun layer's error grows with the distance
    if (p.friendly && Math.random() < 0.012) p.damage(0.02, ctx);
    if (Math.random() < 0.15) audio.enemyGun();
  },
  navalGunfire(ship, target, warning) {
    const from = new THREE.Vector3(); (findNamed(ship.group, 'gun') || findNamed(ship.group, 'bridge') || ship.group).getWorldPosition(from); from.y = Math.max(from.y, 3);
    const tp = target.group.position.clone().setY(0);
    // lead the target and scatter the fall of shot; warning shots go 150 m ahead of her
    const lead = new THREE.Vector3(Math.sin(target.heading), 0, Math.cos(target.heading)).multiplyScalar(target.speedKt / KT * (from.distanceTo(tp) / 320) + (warning ? 150 : 0));
    if (!ship.gunLogged) { ship.gunLogged = true; ctx.log(warning ? `${ship.name} fires a shot across ${target.name}'s bows.` : `${ship.name} opens fire on ${target.name}.`, 'ok'); }
    const salvo = warning ? 1 : 2;
    for (let i = 0; i < salvo; i++) {
      const err = warning ? 25 : Math.max(30, from.distanceTo(tp) * 0.045);
      const aim = tp.clone().add(lead).add(new THREE.Vector3((Math.random() - 0.5) * err * 2, 0, (Math.random() - 0.5) * err * 2));
      weapons.shell(from, aim, (pt) => {
        if (!G.running) return;
        const d = Math.hypot(pt.x - target.group.position.x, pt.z - target.group.position.z);
        if (!warning && target.alive && d < target.length * 0.45) {
          const hp = target.group.position.clone().setY(target.waterline * 0.2 + 1);
          weapons.explosion(hp, 1.0, false);
          target.damage(0.18 + Math.random() * 0.14, ctx, hp);
          if (target.kind === 'submarine') { target.surfaced = true; target.targetDepth = 0; target.diveCooldown = 20; }
        } else { weapons.splash(pt, 2.8); audio.shellSplash(); }
      });
    }
  },
  destroyerAttack(d, target) {
    ctx.log(`${d.name} attacking with depth charges.`);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (!G.running) return;
        const p = target.group.position.clone(); p.x += (Math.random() - 0.5) * 80; p.z += (Math.random() - 0.5) * 80; p.y = 0;
        weapons.explosion(p, 1.1, true);
      }, 600 + i * 900);
    }
    setTimeout(() => { if (G.running && target.alive) target.damage(0.25 + Math.random() * 0.3, ctx, null); }, 4000);
  },

  // ---- mission scripting: friendlies' steps and the mission's triggers speak this ----
  get friendlies() { return G.friendlies; },
  named(n) {
    if (n === 'You' || n === 'you') return PLAYER_REF;
    return G.vessels.find((v) => v.name === n) || G.friendlies.find((a) => a.name === n || a.short === n) || null;
  },
  flag(name) { if (!G.flags.has(name)) { G.flags.add(name); G.flagTimes[name] = G.time; } },
  cond(c, self) {
    if (!c) return false;
    if (c.all) return c.all.every((x) => ctx.cond(x, self));
    if (c.any) return c.any.some((x) => ctx.cond(x, self));
    const pp = G.flight.obj.position;
    const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    let ok = true;
    if (c.after != null) ok = ok && G.tookOff && G.time - G.tookOffAt >= c.after;
    if (c.stepTime != null) ok = ok && !!self && self.stepT >= c.stepTime;
    if (c.flag) ok = ok && G.flags.has(c.flag);
    if (c.since) ok = ok && G.flags.has(c.since[0]) && G.time - G.flagTimes[c.since[0]] >= c.since[1];
    if (c.identified) { const v = ctx.named(c.identified); ok = ok && !!v && v.identified; }
    if (c.reported) { const v = ctx.named(c.reported); ok = ok && !!v && v.reported; }
    if (c.hpBelow) { const v = ctx.named(c.hpBelow[0]); ok = ok && !!v && (v.hp < c.hpBelow[1] || !v.alive); }
    if (c.sunk) { const v = ctx.named(c.sunk); ok = ok && !!v && !v.alive; }
    if (c.near) { const t = ctx.named(c.near[0]); ok = ok && !!t && hd(t.group.position, pp) < c.near[1]; }
    return ok;
  },
  acts(list) {
    for (const a of [].concat(list || [])) {
      if (a.after != null) { G.timers.push({ t: a.after, acts: a.do }); continue; }
      if (a.vessel) { const v = ctx.named(a.vessel); if (!v || !v.alive) continue; }
      if (a.log) ctx.log(a.log, a.cls || 'ok');
      if (a.say) audio.say(a.say, 20);
      if (a.music) audio.music.setMood(a.music);
      if (a.flag) ctx.flag(a.flag);
      if (a.spawn) G.pendingFriendlies.push({ ...a.spawn, timer: a.spawn.delay || 0 });
      if (a.bandit && Math.random() <= (a.bandit.chance == null ? 1 : a.bandit.chance)) G.pendingBandits.push({ ...a.bandit, timer: a.bandit.delay || 0 });
      if (a.friendly) { const fr = ctx.named(a.friendly); if (fr && a.damage) fr.damage(a.damage, ctx); }
      if (a.ferry) startFerry(a.ferry);
      if (a.ferryDo) ferryDo(a.ferryDo);
      if (a.vessel) {
        const v = ctx.named(a.vessel); if (!v || !v.alive) continue;
        if (a.set) Object.assign(v, a.set);
        if (a.route) { v.waypoints = a.route.map(([la, lo]) => { const w = toWorld(la, lo); return new THREE.Vector3(w.x, 0, w.z); }); v.wpIdx = 0; }
        if (a.hunt) { const t = ctx.named(a.hunt); if (t) { v.hunting = true; v.huntTarget = t; v.stopped = false; } }
        if (a.shadow) { const t = ctx.named(a.shadow); if (t) { v.behaviour = 'escort'; v.escortOf = t; v.escortSide = a.side || 1; v.escortDist = a.dist || 600; v.stopped = false; } }
        if (a.damageTo != null && v.hp > a.damageTo) { const floor = v.hpFloor; v.hpFloor = null; v.damage(v.hp - a.damageTo, ctx, v.group.position.clone().setY(2)); v.hpFloor = floor; }
        if (a.abandon != null) abandonShip(v, a);
      }
    }
  },
};

// ---------- boats between a ship and an aircraft on the water ----------
// When an aircraft alights beside a submarine to take passengers off, her boat is seen doing it:
// out from the submarine's side to the aircraft's, abaft the wing where the hatches are; alongside
// while the passengers climb in; back again once the aircraft is under way.
//   { ferry: { from, to, boat: 'folboats' | 'dinghy', trip: seconds out } }
//   { ferryDo: { to, board: true } }  the passengers climb aboard, one after another
//   { ferryDo: { to, dunk: true } }   one of them misses his footing and goes into the water
const _fv = new THREE.Vector3(), _fw = new THREE.Vector3();
// the player's own aircraft as a party a boat can come alongside
const PLAYER_REF = { name: 'You', short: 'you', alive: true, spec: null,
  get group() { return G.flight.obj; }, get onWater() { return G.flight.onWater; }, get speed() { return G.flight.speed; } };
async function startFerry(f) {
  const from = ctx.named(f.from), to = ctx.named(f.to);
  if (!from || !to) return;
  const g = await loadOrPlaceholder(`assets/${f.boat || 'folboats'}.js`, 5, 3, 'boat');
  if (!G.running) return;
  scene.add(g);
  const fe = { g, from, to, key: f.to, trip: f.trip || 25, t: 0, phase: 'out', h: 0, a: new THREE.Vector3(), b: new THREE.Vector3(),
    paddles: findAllNamed(g, 'paddle'), oars: findAllNamed(g, 'oar'), passengers: findAllNamed(g, 'passenger') };
  ferryEnds(fe); fe.h = Math.atan2(fe.b.x - fe.a.x, fe.b.z - fe.a.z);
  G.ferries.push(fe);
}
function ferryDo(d) {
  const fe = G.ferries.find((x) => x.key === d.to); if (!fe) return;
  if (d.dunk && fe.passengers[0]) { const p = fe.passengers[0]; p.position.y -= 0.95; p.position.x += 1.3; p.userData.dunked = true; }
  if (d.board) fe.passengers.forEach((p, k) => G.timers.push({ t: 0.5 + k * 2.2, fn: () => { p.visible = false; } }));
}
function ferryEnds(fe) {
  const sp = fe.from.group.position, pp = fe.to.group.position;
  const sRight = _fv.set(1, 0, 0).applyQuaternion(fe.from.group.quaternion);
  const sSide = Math.sign((pp.x - sp.x) * sRight.x + (pp.z - sp.z) * sRight.z) || 1;
  const off = (fe.from.spec && fe.from.spec.beam ? fe.from.spec.beam / 2 : 4) + 3;
  fe.a.set(sp.x + sRight.x * sSide * off, 0, sp.z + sRight.z * sSide * off);
  const pRight = _fv.set(1, 0, 0).applyQuaternion(fe.to.group.quaternion), pFwd = _fw.set(0, 0, 1).applyQuaternion(fe.to.group.quaternion);
  const pSide = Math.sign((sp.x - pp.x) * pRight.x + (sp.z - pp.z) * pRight.z) || 1;
  fe.b.set(pp.x + pRight.x * pSide * 4 - pFwd.x * 6.5, 0, pp.z + pRight.z * pSide * 4 - pFwd.z * 6.5);   // at the waist blister, clear of the wing
}
function updateFerries(dt) {
  for (let i = G.ferries.length - 1; i >= 0; i--) {
    const fe = G.ferries[i];
    ferryEnds(fe);
    fe.t += dt;
    let u;
    if (fe.phase === 'out') { u = Math.min(1, fe.t / fe.trip); if (u >= 1) { fe.phase = 'alongside'; fe.t = 0; } }
    else if (fe.phase === 'alongside') { u = 1; if (!fe.to.alive || !fe.to.onWater || fe.to.speed > 3) { fe.phase = 'back'; fe.t = 0; } }
    else { u = 1 - Math.min(1, fe.t / (fe.trip * 0.8)); if (u <= 0) { scene.remove(fe.g); G.ferries.splice(i, 1); continue; } }
    const e = u * u * (3 - 2 * u);
    const x = fe.a.x + (fe.b.x - fe.a.x) * e, z = fe.a.z + (fe.b.z - fe.a.z) * e;
    const moving = fe.phase !== 'alongside';
    if (moving) {
      const want = fe.phase === 'out' ? Math.atan2(fe.b.x - fe.a.x, fe.b.z - fe.a.z) : Math.atan2(fe.a.x - fe.b.x, fe.a.z - fe.b.z);
      let dh = want - fe.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      fe.h += dh * Math.min(1, dt * 1.5);
    }
    fe.g.position.set(x, seaHeight(x, z) * 0.9, z);
    fe.g.rotation.set(Math.sin(G.time * 1.3) * 0.03, fe.h, Math.sin(G.time * 1.1 + 1) * 0.05);
    // paddling and rowing while under way, resting alongside
    const k = moving ? 1 : 0.1;
    fe.paddles.forEach((p, j) => { const ph = G.time * 3.4 + j * 0.9; p.rotation.z = Math.sin(ph) * 0.6 * k; p.rotation.y = Math.cos(ph) * 0.35 * k; });
    for (const o of fe.oars) { const s = o.userData.side || 1, ph = G.time * 2.3; o.rotation.y = s * Math.sin(ph) * 0.55 * k; o.rotation.z = s * (0.18 + 0.14 * Math.cos(ph)) * k; }
    // a man in the water bobs beside the boat
    for (const p of fe.passengers) if (p.userData.dunked && p.visible) p.position.y = -0.95 + Math.sin(G.time * 2.1) * 0.08;
  }
}

// A boat given up by her crew: stopped, men over the side, then down (stern first if so ordered),
// leaving survivors in the water where she went.
function abandonShip(v, a) {
  v.abandoned = true; v.stopped = true; v.hunting = false; v.surfaced = true; v.targetDepth = 0; v.behaviour = 'stayUp';
  if (v.depth > 4) v.depth = 4;   // blown up to the surface, or near it
  G.timers.push({ t: a.abandon, fn: async () => {
    if (!v.alive) return;
    v.alive = false; v.sternFirst = !!a.sternFirst; G.score += 200;
    weapons.oilSlick(v.group.position, 60);
    if (a.sunkLog) ctx.log(a.sunkLog, 'ok');
    if (a.sunkFlag) ctx.flag(a.sunkFlag);
    for (const d of G.vessels) if (d.huntTarget === v) { d.hunting = false; d.huntTarget = null; }
    if (a.survivors) {
      const ll = toLatLon(v.group.position.x, v.group.position.z);
      const s = await spawnVessel('survivors', { name: a.survivors, lat: ll.lat, lon: ll.lon });
      s.identified = true; s.idProgress = 1;
      if (G.running) { scene.add(s.group); G.vessels.push(s); }
    }
  } });
}

function gunArc(arc, gd) {
  if (gd && gd.tunnel) return { yaw: [-0.7, 0.7], pitch: [-1.1, 0.02] };
  return { forward: { yaw: [-1.05, 1.05], pitch: [-0.5, 0.6] }, rear: { yaw: [-1.2, 1.2], pitch: [-0.6, 0.5] }, upper: { yaw: [-3.1, 3.1], pitch: [-0.1, 1.3] },
    left: { yaw: [-1.2, 1.2], pitch: [-0.9, 0.7] }, right: { yaw: [-1.2, 1.2], pitch: [-0.9, 0.7] } }[arc] || { yaw: [-1, 1], pitch: [-0.5, 0.5] };
}
function gunQuat(arc, node) {
  const geom = node && G.gunGeom[node];
  const base = geom ? geom.baseYaw : ({ forward: Math.PI, rear: 0, upper: 0, left: -Math.PI / 2, right: Math.PI / 2 }[arc] ?? Math.PI);
  const q = G.flight.obj.quaternion.clone();
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), base + G.aim.yaw));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), G.aim.pitch));
  return q;
}
function onDetonate(pos, depth) {
  if (!G.mission.rules || !G.mission.rules.range) return;
  let best = null, bd = 1e9;
  for (const v of G.vessels) { if (v.faction !== 'target' || !v.alive) continue; const d = Math.hypot(v.group.position.x - pos.x, v.group.position.z - pos.z); if (d < bd) { bd = d; best = v; } }
  G.range.drops++;
  const pts = bd < 10 ? 100 : bd < 25 ? 60 : bd < 50 ? 25 : 0;
  G.range.dcScore += pts;
  ctx.log(pts === 100 ? `BULLSEYE — ${bd.toFixed(0)} m from ${best.name}: 100.` : pts ? `${bd.toFixed(0)} m from ${best ? best.name : 'the target'}: ${pts} points.` : `Miss — ${bd.toFixed(0)} m from the nearest target.`, pts >= 60 ? 'ok' : pts ? '' : 'bad');
}
function onHit(v, amount, pos, byCharge = false, owner = null) {
  if (v === 'player') { G.flight.hit(amount); audio.hitPlayer(); return; }
  if (v.friendly) {
    G.penalties += 5; v.damage(amount * 0.2, ctx);
    if (!v.warnedFF) { v.warnedFF = true; ctx.log(`Cease fire — that is ${v.short}, one of ours!`, 'bad'); }
    return;
  }
  if (owner) {
    // another aircraft's stick: no score or penalty to you, and it leaves what the record says
    if (v.kind === 'survivors' || v.faction === 'rn' || v.faction === 'allied' || v.kind === 'neutral') return;
    const floor = owner.floorFor(v);
    const amt = Math.max(0, Math.min(amount, v.hp - floor));
    if (amount > 0.2 && !v['straddled_' + owner.short]) { v['straddled_' + owner.short] = true; ctx.log(`${owner.short}'s charges straddle ${v.name}!`, 'ok'); }
    if (amt > 0) v.damage(amt, ctx, pos);
    return;
  }
  if (v.kind === 'survivors') {
    G.penalties += byCharge ? 100 : 10;
    if (!v.warned) { v.warned = true; ctx.log('You are firing on men in the water. Cease fire — this will go in the report.', 'bad'); }
    return;
  }
  if (v.holdFor && !G.flags.has(v.holdFor)) amount = Math.min(amount, Math.max(0, v.hp - 0.5));
  v.playerDmg = (v.playerDmg || 0) + amount;
  if (v.kind === 'aircraft') { v.damage(amount, ctx); weapons.spark(pos, 1); if (G.pip && v.alive) audio.say('gun_hits', 14); return; }
  if (v.faction === 'target') { if (!byCharge) G.range.hits += 2; v.damage(amount * (byCharge ? 0.6 : 3), ctx, pos); return; }
  const rules = G.mission.rules || {};
  const protectedName = (rules.noAttack || []).includes(v.name);
  if (v.kind === 'neutral' || v.faction === 'rn' || v.faction === 'allied' || protectedName) {
    if (amount > 0.003) {
      G.penalties += byCharge ? 50 : 5;
      if (!v.warned) { v.warned = true; ctx.log(`You are firing on ${v.name} (${v.label}). Cease fire — this will go in the report.`, 'bad'); }
    }
    if (v.kind === 'neutral' && byCharge) { v.damage(amount, ctx, pos); if (!v.alive) failMission('Neutral vessel sunk: an international incident. Sortie ended.'); }
    return;
  }
  if (byCharge && amount > 0.2) { ctx.log(`Depth charge straddle on ${v.name}!`, 'ok'); G.score += 40; audio.say('voice_straddle', 20); }
  else if (byCharge) ctx.log(`Near miss on ${v.name}.`);
  v.damage(amount, ctx, pos);
  if (!v.alive) G.score += 200;
}

function failMission(reason) {
  ctx.log(reason, 'bad');
  for (const o of G.objectives) if (!o.done) o.failed = true;
  G.endTimer = 4;
}

// ---------- sighting report ----------
function sightingReport() {
  if (G.reportCooldown > 0) return;
  G.reportCooldown = 6;
  const p = G.flight.obj.position;
  let best = null, bd = 3500;
  for (const v of G.vessels) {
    if (!v.alive || !v.identified) continue;
    const d = v.group.position.distanceTo(p); if (d < bd) { bd = d; best = v; }
  }
  audio.morse('o o o');
  if (!best) { hud.log('W/T to Gibraltar: nothing to report — identify a contact within 2 miles first.'); return; }
  best.reported = true;
  // a report on a ship lying at anchor covers the whole anchorage: every identified ship moored near her
  if (best.stopped) for (const v of G.vessels) if (v !== best && v.stopped && v.identified && v.faction === best.faction && v.group.position.distanceTo(best.group.position) < 2500) v.reported = true;
  const ll = { lat: 0, lon: 0 };
  radar.reports.push({ x: best.group.position.x, z: best.group.position.z, text: best.name });
  ctx.log(`W/T: "${best.kind === 'submarine' ? 'SUBMARINE' : best.faction === 'german' ? 'ENEMY MERCHANT' : best.label.toUpperCase()} SIGHTED ${best.name.toUpperCase()} ${best.stopped ? (best.kind === 'submarine' ? 'STOPPED' : 'AT ANCHOR') : `COURSE ${((180 - best.heading * 180 / Math.PI + 360) % 360).toFixed(0)} SPEED ${best.speedKt.toFixed(0)}`}" — Gibraltar: "${CALLSIGN}, received."`, 'ok');
  G.score += 30;
  setTimeout(() => G.running && audio.say('voice_wt', 15), 1800);
  // responders
  if (best.faction === 'german' || best.faction === 'italian') {
    for (const v of G.vessels) {
      if (v.role !== 'responder' || !v.alive) continue;
      if (best.kind === 'submarine') { v.hunting = true; v.huntTarget = best; }
      else { v.hunting = true; v.huntTarget = best; v.interceptOnly = true; }
      v.stopped = false;
    }
    if (G.vessels.some((v) => v.role === 'responder')) ctx.log('Destroyers ordered to your contact.');
  }
}

// ---------- per-frame update ----------
const clock = new THREE.Clock();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let radarT = 0, plotT = 0;

function fmtClock(s) { const h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60; return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`; }

// Striking a ship, another aircraft, a mole or a building wrecks her. Alongside at a walking pace
// on the water it is only a bump: she stops against it.
function obstacles() {
  const out = [];
  for (const v of G.vessels) out.push(v);
  for (const b of G.bandits) out.push(b);
  for (const fr of G.friendlies) out.push(fr);
  for (const pk of G.parked) out.push(pk.o || (pk.o = { group: pk.g, name: 'a moored aircraft' }));
  return out;
}
function checkContact(f, prevPos) {
  if (!G.probes) { G.probes = Collisions.probes(G.plane); collisions.begin(G.plane, G.probes, obstacles()); }
  const hit = collisions.test(G.plane, G.probes, obstacles(), f.altitude < 150);
  if (!hit) return;
  if (f.onWater && f.speed < 4) { f.obj.position.copy(prevPos); f.speed = 0; return; }
  const what = hit.label || (hit.name ? hit.name : 'another aircraft');
  f.crash('collided with ' + what);
}

function update(dt) {
  const f = G.flight, p = f.obj.position;
  if (G.cine) {
    // the walk-out: Escape, Enter, Space or a controller button (edge keys read before poll clears them)
    const m = input.menuPoll();
    const ctl = input.poll(dt);
    G.cine.update(dt, camera);
    updateFlags(G.time); G.time += dt;
    if (G.cine.finished || m.accept || m.back || ctl.pause || ctl.fire) finishWalkout();
    return;
  }
  const ctl = input.poll(dt);
  if (ctl.pause) { G.paused = !G.paused; pauseEl.style.display = G.paused ? 'flex' : 'none'; }
  if (G.paused) return;
  G.time += dt; G.clock += dt;
  G.reportCooldown -= dt;
  if (ctl.camera) {
    G.viewIdx = (G.viewIdx + 1) % G.views.length; G.view = G.views[G.viewIdx]; G.aim = { yaw: 0, pitch: 0 };
    if (G.view.startsWith('gun:') && G.spec.guns.find((g) => g.node === G.view.slice(4)).tunnel) G.aim.pitch = -0.3;
    if (G.gunOverlay) { cockpitScene.remove(G.gunOverlay.group); G.gunOverlay = null; }
    if (G.view === 'bombsight') hud.log('Bomb-aimer\'s position. The ring marks where a charge released now will fall; it turns red when it sits on a target.');
    if (G.view.startsWith('gun:')) {
      const gd = G.spec.guns.find((g) => g.node === G.view.slice(4));
      hud.log(`Manning the ${gd.name}. Stick aims, fire to shoot; the pilot holds her straight and level.`);
      G.gunOverlay = buildGunnerOverlay(G.spec, gd); cockpitScene.add(G.gunOverlay.group);
    }
  }
  const manning = G.view.startsWith('gun:');
  const flightCtl = manning ? { ...ctl, pitch: 0, roll: 0, yaw: 0, fire: false } : ctl;
  if (input.pressed && input.invertToggle) { G.gunInvert = !G.gunInvert; input.invertToggle = false; hud.log(`Gunner elevation: ${G.gunInvert ? 'inverted (push forward = barrel down)' : 'normal (push forward = barrel up)'}.`); }
  if (ctl.depth) hud.log(`Depth charges set to ${weapons.cycleDepth()} ft.`);
  if (ctl.radarRange && radar.fitted) hud.log(`ASV range scale ${radar.cycleRange()} miles.`);
  if (ctl.report) sightingReport();

  const prevPos = _v3.copy(p);
  f.update(dt, flightCtl);
  if (!f.crashed && !G.park) checkContact(f, prevPos);
  // aircraft at their buoys ride the harbour's small lop
  for (const pk of G.parked) { pk.g.position.y = pk.y0 + Math.sin(G.time * 0.8 + pk.ph) * 0.07; pk.g.rotation.set(Math.sin(G.time * 0.6 + pk.ph) * 0.008, pk.h + Math.sin(G.time * 0.05 + pk.ph) * 0.03, Math.sin(G.time * 0.5 + pk.ph) * 0.012); }
  // brought in alongside: the last few seconds warp her gently into the berth, parallel to the
  // pontoon, so she never ends the sortie lying across it
  if (G.park) {
    G.park.t = Math.min(1, G.park.t + dt / 2.5);
    const e = G.park.t * G.park.t * (3 - 2 * G.park.t);
    let dh = G.berth.heading - G.park.h0; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    f.reset(new THREE.Vector3(G.park.x0 + (G.berth.x - G.park.x0) * e, 0, G.park.z0 + (G.berth.hullZ - G.park.z0) * e), G.park.h0 + dh * e, 0, true);
  }
  for (const pr of G.props) pr.rotation.z += dt * (8 + 60 * f.rpm);
  audio.setEngine(f.rpm, ctl.throttle, f.engineHealth, { cockpit: G.view === 'cockpit', speed: f.speed, onWater: f.onWater, planing: f.planing });
  // water: wake, wash and spray while on the surface; the foam fades after lift-off
  {
    const fw0 = f.forward(_v1);
    const yaw = Math.atan2(fw0.x, fw0.z);
    const span = G.plane.userData.span || 30, hullLen = G.plane.userData.length || 20;
    const beam = span * 0.055;
    const sideV = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));   // starboard in world
    // touchdown: a burst of white water
    if (f.onWater && !wasOnWater && !f.crashed) {
      for (let i = 0; i < 40; i++) {
        const s = Math.random() < 0.5 ? 1 : -1;
        const pos = p.clone().addScaledVector(fw0, (Math.random() - 0.3) * hullLen * 0.6).addScaledVector(sideV, s * beam * (0.6 + Math.random() * 0.8)).setY(seaHeight(p.x, p.z) + 0.3);
        weapons.spray(pos, sideV.clone().multiplyScalar(s * (3 + Math.random() * 7)).addScaledVector(fw0, f.speed * 0.2).setY(3 + Math.random() * 6), 1.5 + Math.random() * 2.5, 0.7 + Math.random() * 0.6);
      }
      audio.splash();
    }
    wasOnWater = f.onWater;
    if (f.onWater && !f.crashed) {
      const k = f.planing, sp = f.speed;
      const vis = Math.min(1, sp / 8);
      wakeFade = vis;
      const wakeLen = 80 + sp * 7;
      // centre trail from the step/stern
      const stern = p.clone().addScaledVector(fw0, -hullLen * 0.45);
      planeWake.centre.visible = true;
      planeWake.centre.position.set(stern.x - Math.sin(yaw) * wakeLen * 0.5, seaHeight(stern.x, stern.z) + 0.2, stern.z - Math.cos(yaw) * wakeLen * 0.5);
      planeWake.centre.rotation.set(0, yaw, 0); planeWake.centre.scale.set(beam * (3.5 + k * 5), 1, wakeLen);
      planeWake.centre.material.uniforms.uOpacity.value = 0.85 * vis; planeWake.centre.advance(G.time, 0.5 + sp / 20);
      // stern wash: the churned water thrown up behind the step, widest just astern
      {
        const st = planeWake.stern; st.visible = true;
        const len = hullLen * (1.0 + k * 1.2), wid = beam * (2.5 + k * 5.5);
        const head = p.clone().addScaledVector(fw0, -hullLen * 0.25);
        st.position.set(head.x - Math.sin(yaw) * len * 0.5, seaHeight(head.x, head.z) + 0.3, head.z - Math.cos(yaw) * len * 0.5);
        st.rotation.set(0, yaw, 0); st.scale.set(wid, 1, len);
        st.material.uniforms.uOpacity.value = 1.0 * vis * (0.5 + 0.5 * k); st.advance(G.time, 0.8 + sp / 15);
      }
      // divergent V: two streaks angled ~19 degrees off the track (Kelvin angle)
      for (const [key, sgn] of [['left', 1], ['right', -1]]) {
        const st = planeWake[key];
        const ang = yaw + sgn * 0.33;
        const len = wakeLen * 1.1;
        const origin = p.clone().addScaledVector(fw0, hullLen * 0.35).addScaledVector(sideV, -sgn * beam * 0.9);
        st.visible = true;
        st.position.set(origin.x - Math.sin(ang) * len * 0.5, seaHeight(origin.x, origin.z) + 0.2, origin.z - Math.cos(ang) * len * 0.5);
        st.rotation.set(0, ang, 0); st.scale.set(beam * 2.4, 1, len);
        st.material.uniforms.uOpacity.value = 0.7 * vis * (0.4 + 0.6 * k); st.advance(G.time, 0.4 + sp / 25);
      }
      // wash sheets off the chines while on the step
      for (const [key, sgn] of [['washL', 1], ['washR', -1]]) {
        const st = planeWake[key];
        const on = k > 0.15;
        st.visible = on;
        if (on) {
          const len = hullLen * 1.2, spread = beam * (1.8 + k * 4.5);
          const origin = p.clone().addScaledVector(fw0, hullLen * 0.42).addScaledVector(sideV, -sgn * beam * 0.7);
          const ang = yaw + sgn * 0.42;
          st.position.set(origin.x - Math.sin(ang) * len * 0.5, seaHeight(origin.x, origin.z) + 0.4, origin.z - Math.cos(ang) * len * 0.5);
          st.rotation.set(0, ang, 0); st.scale.set(spread, 1, len);
          st.material.uniforms.uOpacity.value = 1.0 * Math.min(1, (k - 0.15) / 0.35); st.advance(G.time, 1.5);
        }
      }
      // chine spray: sheets of droplets thrown out and back from the forward hull
      if (sp > 3) {
        sprayAcc += dt * Math.min(150, 8 + sp * 2.2 + k * 60);
        while (sprayAcc > 1) {
          sprayAcc -= 1;
          const s = Math.random() < 0.5 ? 1 : -1;
          const along = hullLen * (0.05 + Math.random() * 0.45);
          const pos = p.clone().addScaledVector(fw0, along).addScaledVector(sideV, -s * beam * (0.8 + Math.random() * 0.3)).setY(seaHeight(p.x, p.z) + 0.25);
          const vel = sideV.clone().multiplyScalar(-s * (2.5 + Math.random() * 5 + k * 13)).addScaledVector(fw0, -sp * 0.15 + Math.random() * 2).setY(1.2 + Math.random() * 3 + k * 7);
          weapons.spray(pos, vel, 1.4 + Math.random() * 2.2 + k * 3.5, 0.6 + Math.random() * 0.6);
        }
      }
    } else {
      wakeFade -= dt * 0.3;
      for (const k of ['centre', 'left', 'right', 'stern']) { const st = planeWake[k]; if (st.visible) { st.material.uniforms.uOpacity.value *= 0.97; if (wakeFade <= 0) st.visible = false; } }
      planeWake.washL.visible = false; planeWake.washR.visible = false;
    }
  }
  if (!f.onWater && !G.tookOff) { G.tookOff = true; G.tookOffAt = G.time; ctx.log(`Airborne ${fmtClock(G.clock)}. Course for the patrol area.`); }

  // guns: the pilot fires the fixed/bow gun straight ahead; a manned position fires where it aims
  G.fireTimer -= dt;
  if (manning) {
    const gd = G.spec.guns.find((g) => g.node === G.view.slice(4));
    const lim = gunArc(gd.arc, gd);
    // stick right = traverse right (a positive yaw about the vertical axis turns left, hence the sign)
    G.aim.yaw = THREE.MathUtils.clamp(G.aim.yaw - ctl.roll * 1.6 * dt, lim.yaw[0], lim.yaw[1]);
    // elevation: flight-stick sense by default (push forward = barrel down); I toggles
    G.aim.pitch = THREE.MathUtils.clamp(G.aim.pitch + (G.gunInvert === false ? -1 : 1) * ctl.pitch * 1.1 * dt, lim.pitch[0], lim.pitch[1]);
    if (ctl.fire && G.ammo > 0 && G.fireTimer <= 0 && !f.crashed) {
      // every round is drawn, and drawn slow enough to read as a stream from the breech
      G.fireTimer = 60 / gd.rpm * 1.5; G.ammo = Math.max(0, G.ammo - 1); G.range.rounds += 1;
      G.gunNodes[gd.node].getWorldPosition(_v1);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(gunQuat(gd.arc, gd.node));
      weapons.fireTracer(_v1, dir, 330, false, 0.02);
      audio.gun(/Browning/.test(gd.name) ? 'browning' : 'vickers');
    }
  } else if (ctl.fire && G.ammo > 0 && G.fireTimer <= 0 && !f.crashed) {
    const g = G.spec.guns[0];
    G.fireTimer = 60 / g.rpm * 2;
    G.ammo = Math.max(0, G.ammo - 2); G.range.rounds += 2;
    const node = G.gunNodes[g.node] || G.plane;
    node.getWorldPosition(_v1);
    const dir = f.forward(_v2).clone();
    weapons.fireTracer(_v1, dir, 500 + f.speed, false, 0.012);
    audio.gun(/Browning/.test(g.name) ? 'browning' : 'vickers');
  }
  // automated gunners: each position watches its arc, calls the sighting, opens fire and
  // reports the result over the intercom; the window at top right shows the gunner engaged
  G.crewGunTimer -= dt;
  const gunTick = G.crewGunTimer <= 0; if (gunTick) G.crewGunTimer = 0.09;
  {
    const hostiles = [...G.bandits, ...G.vessels];
    G.gunners = G.gunners || {};
    for (const g of G.spec.guns.slice(1)) {
      const node = G.gunNodes[g.node]; if (!node) continue;
      const st = G.gunners[g.node] || (G.gunners[g.node] = { state: 'idle', target: null, t: 0 });
      st.t += dt;
      if (manning && G.view === 'gun:' + g.node) { st.state = 'idle'; st.target = null; continue; }
      node.getWorldPosition(_v1);
      const gg = G.gunGeom[g.node];
      const inArc = (v) => {
        _v3.copy(v.group.position); if (v.kind !== 'aircraft') _v3.setY(1); _v3.sub(_v1).normalize();
        const rel = f.forward(_v2).dot(_v3);
        return g.arc === 'rear' ? rel < -0.2 : g.arc === 'upper' ? true : (g.arc === 'left' || g.arc === 'right') ? _v3.dot(_side.set(gg ? gg.side : 1, 0, 0).applyQuaternion(f.obj.quaternion)) > 0.3 : rel > 0.3;
      };
      const valid = (v) => {
        if (v.kind === 'aircraft') return v.alive && !v.remove && v.group.position.distanceTo(p) < 1000;
        if (!v.alive || v.abandoned || (v.faction !== 'german' && v.faction !== 'italian') || (v.kind === 'submarine' && (!v.surfaced || (v.depth || 0) > 2.5))) return false;   // a boat still coming up from depth is not a target yet   // not on a crew going over the side
        if (v.kind !== 'submarine' && v.hit <= 0) return false;   // do not shoot merchants unprovoked
        return v.group.position.distanceTo(p) < 800;
      };
      if (st.target && !(valid(st.target) && inArc(st.target))) {
        const tg = st.target;
        if (tg.kind === 'aircraft' && !tg.alive) gunnerReport(g, st, 'kill');
        else if (tg.kind === 'aircraft' && (tg.state === 'leave' || tg.remove)) gunnerReport(g, st, 'escape');
        else if (tg.kind !== 'aircraft' && (!tg.alive || tg.abandoned)) gunnerReport(g, st, 'sunk');
        else gunnerReport(g, st, 'lost');
        st.target = null; st.state = 'idle';
      }
      if (!st.target) {
        for (const v of hostiles) if (valid(v) && inArc(v)) { st.target = v; st.state = 'sighted'; st.t = 0; gunnerReport(g, st, 'spot'); break; }
      }
      if (!st.target) continue;
      const d = st.target.group.position.distanceTo(p);
      const range = st.target.kind === 'aircraft' ? 700 : 650;
      if (d < range && st.t > 0.5) {
        if (st.state !== 'firing') { st.state = 'firing'; gunnerReport(g, st, 'fire'); }
        if (gunTick) {
          _v3.copy(st.target.group.position); if (st.target.kind !== 'aircraft') _v3.setY(1);
          if (st.target.kind === 'aircraft' && st.target.heading != null) _v3.x += Math.sin(st.target.heading) * 8, _v3.z += Math.cos(st.target.heading) * 8;   // a little lead
          _v3.sub(_v1).normalize();
          weapons.fireTracer(_v1, _v3, 500, false, st.target.kind === 'aircraft' ? 0.05 : 0.03, g.node);
          if (Math.random() < 0.3) audio.gun();
        }
      }
    }
  }
  // depth charges / bombs
  G.dropTimer -= dt;
  if (ctl.drop && G.stores > 0 && G.dropTimer <= 0 && !f.onWater && !f.crashed) {
    G.dropTimer = 0.4; if (!(G.mission.rules && G.mission.rules.unlimitedStores)) G.stores--;
    (G.bayNode || G.plane).getWorldPosition(_v1);
    const vel = f.forward(_v2).clone().multiplyScalar(f.speed); vel.y += f.vertSpeed;
    dcCamAdd(weapons.dropCharge(_v1, vel, weapons.depthSetting));
    audio.say('voice_charges_away', 6);
    ctx.log(`${G.spec.stores.kind} released — set ${weapons.depthSetting} ft. ${G.stores} left.`);
  }

  // vessels
  for (const v of G.vessels) {
    if (v.interceptOnly && v.huntTarget) {
      const d = v.group.position.distanceTo(v.huntTarget.group.position);
      if (d < 500 && v.huntTarget.alive && !v.huntTarget.stopped) { v.huntTarget.stopped = true; v.hunting = false; v.stopped = true; ctx.log(`${v.name} has intercepted ${v.huntTarget.name}: boarding party away.`, 'ok'); G.score += 100; v.interceptOnly = false; }
      else if (d < 500) { v.hunting = false; v.stopped = true; }
    }
    v.update(dt, ctx);
    // convoy attackers
    if (v.behaviour === 'attackConvoy' && v.alive && v.kind === 'submarine') {
      v.torpTimer = (v.torpTimer || 12) - dt;
      if (v.torpTimer <= 0) {
        v.torpTimer = 25 + Math.random() * 15;
        const disturbed = v.diveCooldown > 0 || v.hit > 0.1;
        const tgt = G.vessels.find((m) => m.tag === 'convoy' && m.alive && m.group.position.distanceTo(v.group.position) < 1800);
        if (tgt && !disturbed && Math.random() < 0.55) {
          ctx.log(`Torpedo track! ${tgt.name} hit by ${v.name}.`, 'bad');
          weapons.explosion(tgt.group.position.clone().setY(2), 2.5, false);
          tgt.damage(2.0, ctx, null); G.score -= 100;
        } else if (tgt) ctx.log(`${v.name} is working into an attacking position on the convoy.`);
      }
    }
  }
  weapons.update(dt, G.vessels, f, onHit, onDetonate, [...G.bandits, ...G.friendlies]);
  updateDcCam(dt);
  // bandits
  for (const pb of G.pendingBandits) {
    if (pb.done || !G.tookOff) continue;
    pb.timer -= dt;
    if (pb.timer <= 0) { pb.done = true; spawnBandit(f, pb.name, pb.from).then((b) => { if (pb.target) b.target = ctx.named(pb.target); scene.add(b.group); G.bandits.push(b); ctx.log(`Rear gunner: aircraft closing from astern — ${b.name}!`, 'bad'); audio.music.setMood('combat'); audio.say('voice_bandit', 60); }); }
  }
  for (let i = G.bandits.length - 1; i >= 0; i--) {
    const b = G.bandits[i]; b.update(dt, ctx);
    if ((!b.alive || b.state === 'leave') && !b.goneFlag) { b.goneFlag = true; ctx.flag('bandit-gone'); }
    if (b.remove) { scene.remove(b.group); G.bandits.splice(i, 1); }
  }

  // friendly aircraft: a squadron machine takes off just behind you; others appear where they were
  for (const pf of G.pendingFriendlies) {
    if (pf.done || !G.tookOff) continue;
    pf.timer -= dt;
    if (pf.timer <= 0) {
      pf.done = true;
      spawnFriendly(pf, f).then((fr) => {
        if (!G.running) return;
        scene.add(fr.group); G.friendlies.push(fr);
        fr.tag = document.createElement('div'); fr.tag.className = 'friend-tag'; document.body.appendChild(fr.tag);
        if (pf.hello) ctx.log(pf.hello, 'ok');
      });
    }
  }
  for (let i = G.friendlies.length - 1; i >= 0; i--) {
    const fr = G.friendlies[i]; fr.update(dt, ctx);
    if (fr.remove) { scene.remove(fr.group); if (fr.tag) fr.tag.remove(); G.friendlies.splice(i, 1); }
  }
  updateFerries(dt);
  for (const tr of G.triggers) if (!tr.fired && ctx.cond(tr.when)) { tr.fired = true; ctx.acts(tr.acts); }
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const tm = G.timers[i]; tm.t -= dt;
    if (tm.t <= 0) { G.timers.splice(i, 1); if (tm.fn) tm.fn(); else ctx.acts(tm.acts); }
  }

  // music mood: quiet patrol, tension on an enemy contact, combat when shooting starts
  {
    const enemyNear = G.vessels.some((v) => v.alive && (v.faction === 'german' || v.faction === 'italian') && v.identified && v.group.position.distanceTo(p) < 5000);
    const combat = enemyNear && (G.fireTimer > -2 || weapons.charges.length > 0 || G.vessels.some((v) => v.alive && v.flakTimer > 0 && v.group.position.distanceTo(p) < 1500));
    audio.music.setMood(f.crashed ? 'loss' : combat ? 'combat' : enemyNear ? 'contact' : 'patrol');
  }
  // tracking dived boats: datum when an identified boat goes under, shadow visibility from close by
  G.mission.datums ||= [];
  for (const v of G.vessels) {
    if (v.kind !== 'submarine') continue;
    const d = v.group.position.distanceTo(p);
    const shadowVis = v.alive && !v.abandoned && !v.surfaced && (v.depth || 0) < 35 && d < 2200 && p.y < 900;
    if (shadowVis && !v.shadowSeen && v.identified) ctx.log(`${v.name}: her shadow is showing under the surface — hold her.`, 'ok');
    v.shadowSeen = shadowVis;
    if (v.identified && !v.surfaced && !v.wasDived) { v.wasDived = true; G.mission.datums = G.mission.datums.filter((x) => x.name !== v.name); G.mission.datums.push({ name: v.name, x: v.group.position.x, z: v.group.position.z, t: G.time, speed: v.spec.subSpeed / KT }); }
    if (v.surfaced && v.wasDived) { v.wasDived = false; G.mission.datums = G.mission.datums.filter((x) => x.name !== v.name); }
    if (!v.alive) G.mission.datums = G.mission.datums.filter((x) => x.name !== v.name);
  }
  // identification
  let nearest = null, nd = 4000;
  for (const v of G.vessels) {
    if (!v.alive) continue;
    const d = v.group.position.distanceTo(p);
    if (d < nd) { nd = d; nearest = v; }
    if (!v.identified && d < 800 && p.y < 1500 / FT && !(v.kind === 'submarine' && !v.surfaced && v.depth > 12)) {
      v.idProgress = Math.min(1, v.idProgress + dt / 3);
      if (v.idProgress >= 1) {
        const ours = v.faction === 'rn' || v.faction === 'allied';
        v.identified = true; G.idCount++; ctx.log(`Identified: ${v.name} — ${v.label}${v.kind === 'neutral' ? ' (neutral: do not attack)' : ''}.${ours ? ' "She looks like one of ours, sir."' : ''}`, v.kind === 'neutral' ? '' : 'ok'); G.score += 20;
        // a British or Allied boat gets the crew's own call, submarine or not, before any contact call
        if (ours) audio.say('voice_ours', 20); else if (v.kind === 'submarine') audio.say('voice_contact', 30); else if (v.kind === 'neutral') audio.say('voice_neutral', 40);
      }
    }
  }
  let contact = null;
  if (nearest) {
    const dx = nearest.group.position.x - p.x, dz = nearest.group.position.z - p.z;
    contact = { v: nearest, dist: nd, brg: (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360 };
  }

  // objectives
  evaluateObjectives(dt);

  // end conditions
  if (f.crashed && G.endTimer < 0) { ctx.log(`Aircraft lost: ${f.crashReason}.`, 'bad'); G.endTimer = 4; audio.boom(1); weapons.explosion(p.clone(), 2); }
  if (f.fuel <= 0 && G.endTimer < 0) { failMission('Fuel exhausted.'); }
  if (G.endTimer >= 0) { G.endTimer -= dt; if (G.endTimer <= 0) endMission(); }

  // camera
  if (manning) {
    const gd = G.spec.guns.find((g) => g.node === G.view.slice(4));
    G.gunNodes[gd.node].getWorldPosition(camPos);
    camera.quaternion.copy(gunQuat(gd.arc, gd.node));
    // eye well above and behind the breech so the stream of tracer is seen rising to the sight
    // (the Catalina's tunnel gun is under the hull, so its gunner's eye is just above the hatch, below the keel line)
    camera.position.copy(camPos).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion), gd.tunnel ? 0.35 : 1.1).addScaledVector(f.up(_v2), gd.tunnel ? -0.25 : 0.8);
    if (camera.near !== 1.6) { camera.near = 1.6; camera.updateProjectionMatrix(); }
  } else if (G.view === 'bombsight') {
    (G.gunNodes.gun_nose || G.bayNode || G.plane).getWorldPosition(camPos);
    camera.position.copy(camPos).addScaledVector(f.up(_v2), 0.3);
    camera.quaternion.copy(f.obj.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.62));
    if (camera.near !== 1.6) { camera.near = 1.6; camera.updateProjectionMatrix(); }
  } else if (G.view === 'cockpit' && G.cockpitNode) {
    G.cockpitNode.getWorldPosition(camPos);
    // eye a little ahead of and above the seat point; near plane clips the cabin shell away
    camPos.addScaledVector(f.forward(_v1), 0.7).addScaledVector(f.up(_v2), 0.25);
    camera.position.copy(camPos);
    camera.quaternion.copy(f.obj.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    if (camera.near !== 1.8) { camera.near = 1.8; camera.updateProjectionMatrix(); }
  } else {
    if (camera.near !== 0.5) { camera.near = 0.5; camera.updateProjectionMatrix(); }
    // on a phone the camera stands further back, so the aircraft does not fill the small screen
    const d = Math.max(35, G.spec ? G.plane.userData.span * 1.6 : 50) * (document.body.classList.contains('touch') ? 1.8 : 1);
    const fwd = f.forward(_v1);
    const desired = _v2.copy(p).addScaledVector(fwd, -d).add(new THREE.Vector3(0, d * 0.32, 0));
    if (desired.y < 2.5) desired.y = 2.5;
    const th = terrainHeight(desired.x, desired.z); if (desired.y < th + 4) desired.y = th + 4;
    camera.position.lerp(desired, Math.min(1, dt * 4));
    camLook.copy(p).addScaledVector(fwd, 40).add(new THREE.Vector3(0, 4, 0));
    camera.lookAt(camLook);
  }
  // sun follows the player for shadows
  sunTarget.position.copy(p);
  sun.position.copy(p).addScaledVector(new THREE.Vector3(...(SKIES[G.mission.sky] || SKIES.morning).sun).normalize(), 900);

  // instruments
  radarT += dt; plotT += dt;
  if (radar.fitted) radar.sampleLand(f, G.time);
  if (radarT > 0.08) { radarT = 0; radar.drawASV(f, G.vessels, G.time); }
  if (plotT > 0.25) { plotT = 0; radar.drawPlot(f, G.vessels, BASE, G.mission, G.time, JETTY); }
  touch.setDepth(weapons.depthSetting);
  const st = { throttle: ctl.throttle, stores: G.stores, ammo: G.ammo, time: fmtClock(G.clock), padName: input.padName };
  if (f.onWater && G.tookOff) {
    const B = { x: G.berth.x, z: G.berth.hullZ };
    const dj = Math.hypot(p.x - B.x, p.z - B.z), bj = (Math.atan2(B.x - p.x, -(B.z - p.z)) * 180 / Math.PI + 360) % 360;
    st.guide = dj < 3000 ? 'JETTY brg ' + bj.toFixed(0).padStart(3, '0') + '\u00b0 \u00b7 ' + dj.toFixed(0) + ' m \u2014 taxi in under 3 kn and stop alongside' : null;
  } else if (f.onWater && !G.tookOff) {
    const de = Math.hypot(p.x - ENTRANCE.x, p.z - ENTRANCE.z), be = (Math.atan2(ENTRANCE.x - p.x, -(ENTRANCE.z - p.z)) * 180 / Math.PI + 360) % 360;
    if (!G.taxiedOut && p.x < ENTRANCE.x - 40) { G.taxiedOut = true; ctx.log('Clear of the moles. Open up when ready.', 'ok'); }
    st.guide = G.taxiedOut ? 'IN THE BAY \u2014 full throttle, hold the nose up to lift off' : 'TAXI OUT: north entrance brg ' + be.toFixed(0).padStart(3, '0') + '\u00b0 \u00b7 ' + de.toFixed(0) + ' m \u2014 keep under 15 mph between the moles';
  }
  updateMarshallers(p, f.onWater, G.time);
  updateGlints(f);
  updateFlags(G.time);
  // hide the hull below the sea surface: clip at the local swell height while on or just above it
  waterClip.constant = (f.onWater || p.y < 6) ? -(seaHeight(p.x, p.z) - 0.02) : 1e6;
  // gulls over the harbour when taxiing
  if (f.onWater && Math.hypot(p.x - JETTY.x, p.z - JETTY.z) < 900 && Math.random() < dt / 22) audio.gulls();
  hud.update(f, G.spec, weapons, st, G.objectives, contact, G.view);
  document.body.classList.toggle('cockpit', G.view === 'cockpit');
  updateBombsight(f, ctl);
  updateTrackTag(f);
  updateFriendTags(f);
  if (manning && G.gunOverlay) {
    const sunW = new THREE.Vector3(...(SKIES[G.mission.sky] || SKIES.morning).sun).normalize();
    G.gunOverlay.update({ firing: ctl.fire && G.ammo > 0, sunDir: sunW.applyQuaternion(camera.quaternion.clone().invert()) });
  }
  if (G.view === 'cockpit' && G.interior) {
    cockpit.draw(f, G.spec, weapons, st);
    const sunW = new THREE.Vector3(...(SKIES[G.mission.sky] || SKIES.morning).sun).normalize();
    const sunV = sunW.applyQuaternion(camera.quaternion.clone().invert());
    G.interior.update({ roll: ctl.roll, pitch: ctl.pitch, throttle: ctl.throttle, headingRad: f.headingDeg * Math.PI / 180, sunDir: sunV });
  }
}

// Where a charge released now would fall: ballistic from the bomb bay with the aircraft's
// velocity, then straight down through the water. Projected on to the screen as a ring.
const bsEl = document.getElementById('bombsight'), impactEl = document.getElementById('impact'), bsRead = document.getElementById('bs-read');
function updateBombsight(f, ctl) {
  const show = G.view === 'bombsight' && !f.onWater;
  bsEl.style.display = G.view === 'bombsight' ? 'block' : 'none';
  if (!show) { impactEl.style.display = 'none'; bsRead.textContent = f.onWater ? 'On the water' : ''; return; }
  (G.bayNode || G.plane).getWorldPosition(_v1);
  const vel = f.forward(_v2).clone().multiplyScalar(f.speed); vel.y += f.vertSpeed;
  const h = Math.max(0, _v1.y), g = 9.81;
  const t = (vel.y + Math.sqrt(vel.y * vel.y + 2 * g * h)) / g;
  const impact = new THREE.Vector3(_v1.x + vel.x * t, 0, _v1.z + vel.z * t);
  G.impactPoint = impact;
  let nearest = null, nd = 1e9;
  for (const v of G.vessels) { if (!v.alive) continue; const d = Math.hypot(v.group.position.x - impact.x, v.group.position.z - impact.z); if (d < nd) { nd = d; nearest = v; } }
  const on = nearest && nd < Math.max(18, nearest.length * 0.45);
  const ndc = impact.clone().project(camera);
  if (ndc.z > 1 || Math.abs(ndc.x) > 1.05 || Math.abs(ndc.y) > 1.05) impactEl.style.display = 'none';
  else {
    impactEl.style.display = 'block';
    impactEl.style.left = ((ndc.x + 1) / 2 * window.innerWidth) + 'px';
    impactEl.style.top = ((1 - ndc.y) / 2 * window.innerHeight) + 'px';
    impactEl.className = on ? 'on' : '';
    impactEl.querySelector('span').textContent = on ? 'RELEASE — on ' + nearest.name : nearest && nd < 400 ? nd.toFixed(0) + ' m from ' + nearest.name : '';
  }
  bsRead.textContent = `ALT ${(h * FT).toFixed(0)} ft · IAS ${(f.speed * MPH).toFixed(0)} mph · fall ${t.toFixed(1)} s · throw ${(Math.hypot(vel.x, vel.z) * t).toFixed(0)} m · set ${weapons.depthSetting} ft`;
}
// A small tag over a dived boat while her shadow is in sight, with range and depth, so she can
// be followed from the cockpit or the chase view.
const trackEl = document.getElementById('track-tag');
// a small label over each friendly aircraft so you can find her in the sky
function updateFriendTags(f) {
  for (const fr of G.friendlies) {
    if (!fr.tag) continue;
    const d = fr.group.position.distanceTo(f.obj.position);
    const ndc = fr.group.position.clone().add(new THREE.Vector3(0, 6, 0)).project(camera);
    const show = d > 60 && d < 15000 && ndc.z < 1 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1;
    fr.tag.style.display = show ? 'block' : 'none';
    if (!show) continue;
    fr.tag.style.left = ((ndc.x + 1) / 2 * window.innerWidth) + 'px';
    fr.tag.style.top = ((1 - ndc.y) / 2 * window.innerHeight) + 'px';
    fr.tag.textContent = `${fr.short}${fr.pilot ? ' · ' + fr.pilot : ''} · ${d < 1000 ? d.toFixed(0) + ' m' : (d / H_SCALE / 1852).toFixed(1) + ' nm'}${fr.hp < 0.65 ? ' · damaged' : ''}`;
  }
}
function updateTrackTag(f) {
  let best = null, bd = 1e9;
  for (const v of G.vessels) if (v.kind === 'submarine' && v.shadowSeen && v.identified) { const d = v.group.position.distanceTo(f.obj.position); if (d < bd) { bd = d; best = v; } }
  if (!best || G.view === 'chase' && false) { trackEl.style.display = 'none'; return; }
  const ndc = best.group.position.clone().setY(0).project(camera);
  if (ndc.z > 1 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) { trackEl.style.display = 'none'; return; }
  trackEl.style.display = 'block';
  trackEl.style.left = ((ndc.x + 1) / 2 * window.innerWidth) + 'px';
  trackEl.style.top = ((1 - ndc.y) / 2 * window.innerHeight) + 'px';
  trackEl.textContent = `${best.name} · dived ${(best.depth * FT).toFixed(0)} ft · ${bd.toFixed(0)} m`;
}
function evaluateObjectives(dt) {
  const f = G.flight, p = f.obj.position;
  const byName = (n) => G.vessels.find((v) => v.name === n);
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  for (const o of G.objectives) {
    if (o.done || o.failed) continue;
    const t = o.target ? byName(o.target) : null;
    switch (o.kind) {
      case 'takeoff': if (G.tookOff) o.done = true; break;
      case 'gun_hits': {
        const acc = G.range.rounds ? (G.range.hits / G.range.rounds * 100) : 0;
        o.text = `${o.baseText} — ${G.range.hits}/${o.count} · accuracy ${acc.toFixed(0)}%`;
        if (G.range.hits >= o.count) { o.done = true; G.score += 100; }
        break;
      }
      case 'dc_score':
        o.text = `${o.baseText} — ${G.range.dcScore} pts from ${G.range.drops} drops`;
        if (G.range.dcScore >= o.score) { o.done = true; G.score += 100; }
        break;
      case 'identify': if (t && t.identified) o.done = true; break;
      case 'identify_count': if (G.idCount >= o.count) o.done = true; break;
      case 'report': if (t && t.reported) o.done = true; break;
      case 'attack': if (t && (t.hit >= o.amount || !t.alive)) o.done = true; break;
      case 'attack_any_sub': if (G.vessels.some((v) => v.kind === 'submarine' && (v.hit >= 0.15 || !v.alive))) o.done = true; break;
      case 'sink': if (t && !t.alive) o.done = true; break;
      case 'reach': {
        const tv = o.target && byName(o.target);
        const rp = tv ? tv.group.position : G.slick;
        if (rp && Math.hypot(p.x - rp.x, p.z - rp.z) < o.radius && p.y < 700) { o.done = true; ctx.log(o.log || 'Oil and a line of air bubbles on the surface — she is down there, and moving.', 'ok'); }
        break;
      }
      case 'warning_pass':
        if (t && t.group.position.distanceTo(p) < 300 && p.y < 300 / FT && !f.onWater) { o.done = true; ctx.log(`Low pass across ${t.name}'s bows. She holds her course.`, 'ok'); G.score += 30; }
        break;
      case 'shadow':
        if (t && t.identified && t.group.position.distanceTo(p) < 3000 && !f.onWater) { o.progress += dt; if (o.progress >= o.seconds) { o.done = true; G.score += 60; } }
        if (t && t.stopped && !o.overMoored) o.done = true;   // an intercepted ship stopping ends the shadow; ships already at their moorings do not
        break;
      case 'protect': {
        const members = G.vessels.filter((v) => v.tag === o.tag);
        if (members.some((v) => !v.alive)) { o.failed = true; break; }
        o.progress += dt; if (o.progress >= o.seconds) { o.done = true; G.score += 150; ctx.log('Convoy through safely.', 'ok'); }
        break;
      }
      case 'join': {
        const fr = ctx.named(o.target);
        if (fr && !f.onWater && fr.group.position.distanceTo(p) < (o.radius || 1000)) { o.done = true; ctx.log(`Formating on ${fr.short}.`, 'ok'); }
        break;
      }
      case 'event':
        if (G.flags.has(o.flag)) o.done = true;
        else if (o.failFlag && G.flags.has(o.failFlag)) o.failed = true;
        break;
      case 'share': {
        // your own hits on her, guns or charges, not another aircraft's
        const tv = byName(o.target);
        if (tv) { o.text = `${o.baseText} — ${Math.min(100, (tv.playerDmg || 0) / o.amount * 100).toFixed(0)}%`; if ((tv.playerDmg || 0) >= o.amount) o.done = true; }
        if (tv && !tv.alive && !o.done) o.failed = true;
        break;
      }
      case 'cover': {
        // stay with an aircraft (or over a boat) while something happens: counted from the start
        // flag to the end flag, done if you were close for at least half of it
        const tg = ctx.named(o.target);
        if (!tg) { if (o.seen) o.failed = true; break; }   // not on the scene yet, or gone
        o.seen = true;
        if (tg.alive === false) { o.failed = true; ctx.log(`${tg.short || tg.name} is lost.`, 'bad'); break; }
        const started = !o.start || G.flags.has(o.start);
        if (started) {
          o.elapsed += dt;
          if (hd(tg.group.position, p) < (o.radius || 3000) && !f.onWater) o.near += dt;
          o.text = `${o.baseText} — with her ${(o.near / Math.max(1, o.elapsed) * 100).toFixed(0)}% of the time`;
        }
        if (G.flags.has(o.flag)) {
          if (o.elapsed < 1 || o.near / o.elapsed >= (o.share || 0.5)) { o.done = true; G.score += 100; }
          else { o.failed = true; ctx.log(`You were not with ${tg.short || tg.name} when it mattered.`, 'bad'); }
        }
        break;
      }
      case 'pickup': {
        // down on the water beside her while her boats bring the passengers across
        const tv = t;
        if (!tv) break;
        const near = hd(tv.group.position, p) < (o.radius || 400);
        if (f.onWater && near && f.speed < 6) {
          if (!o.started) { o.started = true; ctx.log(o.log || `Down beside ${tv.name}.`, 'ok'); if (o.downFlag) ctx.flag(o.downFlag); }
          o.progress += dt;
          o.text = `${o.baseText} — ${Math.min(o.seconds, o.progress).toFixed(0)}/${o.seconds} s on the water`;
          if (o.progress >= o.seconds) { o.done = true; G.score += 150; ctx.log(o.doneLog || 'Passengers aboard.', 'ok'); }
        } else if (o.started && !f.onWater) {
          o.failed = true; ctx.log('You took off with the transfer unfinished.', 'bad');
        }
        break;
      }
      case 'return': {
        const others = G.objectives.filter((x) => x !== o);
        const dj = Math.hypot(p.x - G.berth.x, p.z - G.berth.hullZ);
        if (f.onWater && G.tookOff && !G.landedMsg && f.speed < 25 && Math.hypot(p.x - BASE.x, p.z - BASE.z) < 2500) {
          G.landedMsg = true; ctx.log('Down at ' + fmtClock(G.clock) + '. Taxi to the jetty at New Camp (the yellow flag) and cut the engines alongside.', 'ok'); audio.say('voice_down', 999);
        }
        if (f.onWater && f.speed < 1.5 && dj < 70 && G.tookOff) {
          o.done = true; G.score += 50; ctx.log('Alongside the jetty ' + fmtClock(G.clock) + '. Engines cut. Sortie complete.', 'ok'); audio.say('voice_alongside', 999);
          const fw = f.forward(new THREE.Vector3());
          G.park = { t: 0, x0: p.x, z0: p.z, h0: Math.atan2(fw.x, fw.z) };
          for (const x of others) if (!x.done) x.failed = true;
          G.endTimer = 3;
        }
        break;
      }
    }
    if (o.done && o.kind !== 'return') G.score += 25;
    if (o.done && o.raise) ctx.flag(o.raise);
  }
}

function endMission() {
  G.running = false;
  audio.stopEngines();
  audio.music.setMood('menu');
  for (const k of Object.keys(planeWake)) planeWake[k].visible = false;
  document.getElementById('hud').style.display = 'none';
  document.body.classList.remove('flying'); document.body.classList.remove('cockpit');
  document.getElementById('cockpit').style.display = 'none';
  pauseEl.style.display = 'none';
  const objs = G.objectives;
  const success = objs.every((o) => o.done) && !G.flight.crashed;
  const partial = objs.filter((o) => o.done).length;
  const score = Math.max(0, G.score - G.penalties);
  const events = G.events.map((e) => `${fmtClock(G.clock - G.time + e.t)}  ${e.text}`).join('\n');
  const part = G.role ? `   Part: ${G.role.name}` : '';
  const orb = `Date: ${G.mission.date}   Unit: No. 202 Squadron   Base: Gibraltar${part}\nAircraft: ${G.spec.name} ${G.spec.code} (${G.spec.serial})\nCrew: ${PILOT.rank1} ${PILOT.name} (captain) and crew of ${G.spec.crew}\nDuty: ${G.mission.title}\nTime up: ${fmtClock(G.clock - G.time)}   Time down: ${fmtClock(G.clock)}\nDetails of sortie or flight:\n${events}\nResult: ${success ? 'Duty completed.' : G.flight.crashed ? 'Aircraft failed to return.' : `${partial} of ${objs.length} objectives.`}${G.penalties ? `\nRemarks: fire opened on neutral or friendly shipping — penalty ${G.penalties}.` : ''}`;
  ui.debrief({ mission: G.mission, aircraft: G.spec, success, crashed: G.flight.crashed, objectives: objs, score, orb,
    summary: success ? 'All objectives met.' : `${partial}/${objs.length} objectives${G.flight.crashed ? ' · aircraft lost' : ''}` });
}

document.getElementById('btn-resume').addEventListener('click', () => { G.paused = false; pauseEl.style.display = 'none'; });
document.getElementById('btn-abandon').addEventListener('click', () => { G.paused = false; endMission(); });
document.getElementById('btn-view').addEventListener('click', () => { G.view = G.view === 'chase' ? 'cockpit' : 'chase'; });

// ---------- ships in the harbour and the Bay ----------
// Scenery only: loaded once, riding at their berths and anchors, not on the plot and not targets.
(async () => {
  for (const [type, lat, lon, blat, blon] of HARBOUR.ships || []) {
    try {
      const v = await spawnVessel(type, { lat, lon, speed: 0 });
      const a = toWorld(lat, lon), b = toWorld(blat, blon);
      const g = v.group;
      g.position.set(a.x, -v.waterline, a.z); g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      if (v.wake) v.wake.visible = false;
      for (const p of findAllNamed(g, 'pennant')) p.visible = false;   // the destroyer model is Wishart: her number is not repeated on every ship
      world.add(g);
      collisions.addStatic(g, 'a ship at anchor');
    } catch (e) { /* a missing model leaves an empty berth */ }
  }
})();

// ---------- title scene ----------
let titleT = 0, titlePlane = null;
(async () => {
  try {
    titlePlane = await loadOrPlaceholder('assets/catalina_mk1.js', 20, 30, 'aircraft');
    const m = harbour.userData.moorings[1] || new THREE.Vector3(BASE.x, 0, BASE.z);
    titlePlane.position.copy(m); titlePlane.rotation.y = Math.PI * 0.9;
    scene.add(titlePlane);
  } catch (e) { /* no title aircraft */ }
})();
function titleCamera(dt) {
  titleT += dt * 0.04;
  const c = harbour.userData.moorings[1] || toWorld(36.135, -5.36);
  if (titlePlane) titlePlane.visible = true;
  camera.position.set(c.x + Math.cos(titleT) * 140, 26 + Math.sin(titleT * 0.7) * 8, c.z + Math.sin(titleT) * 140);
  camera.lookAt(c.x, 6, c.z);
  sunTarget.position.set(c.x, 0, c.z); sun.position.set(c.x, 0, c.z).addScaledVector(new THREE.Vector3(...SKIES.morning.sun).normalize(), 900);
}

// ---------- loop ----------
// Figures read by the 404 game-jam gate: frame rate, draw calls and triangles for the whole
// frame (every pass, so the renderer's per-render reset is turned off), and the aircraft's
// ground position and speed.
renderer.info.autoReset = false;
const GAME = window.__GAME__ = { fps: 0, draws: 0, tris: 0, pos: [0, 0], speed: 0 };
function gameStats(ms) {
  if (ms > 0 && ms < 1000) GAME.fps = GAME.fps ? GAME.fps * 0.9 + 100 / ms : 1000 / ms;
  GAME.draws = renderer.info.render.calls; GAME.tris = renderer.info.render.triangles;
  // the aircraft only: before a sortie the title camera's orbit is not the player moving
  if (G.flight) { const p = G.flight.obj.position; GAME.pos = [p.x, p.z]; GAME.speed = G.flight.speed; }
}
let lastFrame = 0;
function frame() {
  const now = performance.now();
  if (now - lastFrame < 8) return;
  gameStats(now - lastFrame);
  lastFrame = now;
  renderer.info.reset();
  const dt = Math.min(0.05, clock.getDelta());
  SEA.t += dt; if (sea) sea.material.uniforms.uTime.value = SEA.t;
  if (G.running) update(dt); else { ui.poll(); titleCamera(dt); }
  if (sea && sea.follow) sea.follow(camera.position.x, camera.position.z);
  renderer.clear();
  renderer.render(scene, camera);
  if (G.running && ((G.view === 'cockpit' && G.interior) || (G.view.startsWith('gun:') && G.gunOverlay))) {
    if (G.interior) G.interior.group.visible = G.view === 'cockpit';
    if (G.gunOverlay) G.gunOverlay.group.visible = G.view.startsWith('gun:');
    renderer.clearDepth(); renderer.render(cockpitScene, cockpitCam);
  }
  if (G.running && G.pip) {
    updatePip();
    const fr = G.pip && document.getElementById('gun-cam-frame').getBoundingClientRect();
    if (G.pip && fr.width > 0) {   // hidden while the depth-charge camera has the corner
      renderer.getSize(_size);
      const x = fr.left, y = _size.y - fr.bottom, w = fr.width, h = fr.height;
      pipCam.aspect = w / h; pipCam.updateProjectionMatrix();
      renderer.setScissorTest(true); renderer.setScissor(x, y, w, h); renderer.setViewport(x, y, w, h);
      renderer.clear(); renderer.render(scene, pipCam);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, _size.x, _size.y);
    }
  }
  if (G.running && G.dc && G.dc.pos) {
    const fr = dcEl.frame.getBoundingClientRect();
    if (fr.width > 0) {
      renderer.getSize(_size);
      const x = fr.left, y = _size.y - fr.bottom, w = fr.width, h = fr.height;
      dcCam.aspect = w / h; dcCam.updateProjectionMatrix();
      renderer.setScissorTest(true); renderer.setScissor(x, y, w, h); renderer.setViewport(x, y, w, h);
      // the fine swell mesh follows whichever camera is drawing, so the water under the inset is not coarse
      if (sea && sea.follow) sea.follow(dcCam.position.x, dcCam.position.z);
      renderer.clear(); renderer.render(scene, dcCam);
      if (sea && sea.follow) sea.follow(camera.position.x, camera.position.z);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, _size.x, _size.y);
    }
  }
}
function loop() { requestAnimationFrame(loop); frame(); }
window.DBG.frame = frame;
// test hooks: start a sortie by id without the menus, and reach the mission scripting
window.DBG.start = (id, ac, keepWalkout, role) => { const m = MISSIONS.find((x) => x.id === id); ui.hide(); return startMission(m, AIRCRAFT[ac || m.aircraft[0]], role).then(() => { if (!keepWalkout) finishWalkout(); }); };
window.DBG.ctx = ctx; window.DBG.dcCam = dcCam;
window.DBG.step = (seconds, dt = 0.05) => { for (let t = 0; t < seconds && G.running; t += dt) update(dt); };
loop();
// Fallback: some embedded browsers throttle or suspend requestAnimationFrame; keep the sim alive.
setInterval(() => { if (performance.now() - lastFrame > 100) frame(); }, 33);
