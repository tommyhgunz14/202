import * as THREE from 'three';
import { buildFigure, animateFigure } from './crew.js?v=202609171548';
import { HARBOUR, PLACES } from '../data/geo.js?v=202609171548';
import { toWorld } from '../config.js?v=202609171548';
import { terrainHeight } from './terrain.js?v=202609171548';
import { planarUVs, texture } from './textures.js?v=202609171548';

const stone = new THREE.MeshStandardMaterial({ color: 0xa8a294, roughness: 0.95 });
const concrete = new THREE.MeshStandardMaterial({ color: 0xbdb8ad, roughness: 0.9 });
const roof = new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.9 });
const wall = new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: 0.9 });
const tarmac = new THREE.MeshStandardMaterial({ color: 0x3f4043, roughness: 1 });
const white = new THREE.MeshStandardMaterial({ color: 0xf0efe8, roughness: 0.8 });
texture(stone, 'stone_quay', 3, { keepColor: false }); texture(concrete, 'tarmac', 6); texture(tarmac, 'tarmac', 5, { tint: new THREE.Color(0x8a8b8e) });
// boxes get world-scale UVs when they are made
const _box = (w, h, d) => planarUVs(new THREE.BoxGeometry(w, h, d));

function moleSegment(a, b, width = 9, height = 3.5) {
  const pa = toWorld(a[0], a[1]), pb = toWorld(b[0], b[1]);
  const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
  const m = new THREE.Mesh(_box(width, height, len + width), stone);
  m.position.set((pa.x + pb.x) / 2, height / 2 - 1.5, (pa.z + pb.z) / 2);
  m.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function building(x, z, w, d, h, rot = 0, mat = wall) {
  const g = new THREE.Group();
  const y0 = Math.max(0, terrainHeight(x, z));
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  b.position.y = h / 2; b.castShadow = b.receiveShadow = true;
  g.add(b);
  const r = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.6, d * 1.05), roof);
  r.position.y = h + 0.3; g.add(r);
  g.position.set(x, y0, z); g.rotation.y = rot;
  return g;
}

const timber = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 });
texture(timber, 'timber_deck', 2.4, { keepColor: false });
const timberDk = new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.95 });
const drum = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.6, metalness: 0.3 });
export const JETTY = { x: 0, z: 0, heading: 0 };
export const ENTRANCE = { x: 0, z: 0 };   // mid-point of the north entrance between the North and Detached Moles
export const MARSHALLERS = [];            // figures on the pontoon that wave the aircraft in
const FLAGS = [];                          // windsock and flag meshes with vertex animation

const khaki = new THREE.MeshStandardMaterial({ color: 0x8a7d5a, roughness: 0.95 });
const skin = new THREE.MeshStandardMaterial({ color: 0xc9a07a, roughness: 0.9 });
const navy = new THREE.MeshStandardMaterial({ color: 0x2c3550, roughness: 0.95 });
const paddle = new THREE.MeshStandardMaterial({ color: 0xffd23c, roughness: 0.7, emissive: 0x4a3a00, emissiveIntensity: 0.4 });

// A marshaller: RAF working dress, cap, a bat in each hand; the arms pivot at the shoulder so the
// game can wave them. Groundcrew are the same figure with the bats left out.
function figure(x, y, z, facing, bats = true) {
  // marshallers in overalls with bats, groundcrew in battledress and cork jackets (crew.js)
  const f = buildFigure(bats ? 'marshaller' : 'groundcrew'); f.position.set(x, y, z); f.rotation.y = facing;
  return f;
}

// Seaplane jetty at RAF New Camp: a timber pier on piles running out from the slipway into the
// harbour, ending in a floating pontoon on steel drums with bollards, a refuelling hut, a
// windsock and a yellow marker flag. The sortie ends when the aircraft is alongside.
function buildJetty(g) {
  const nc = toWorld(HARBOUR.newCamp[0], HARBOUR.newCamp[1]);
  const x0 = nc.x - 100, z0 = nc.z + 30;
  const len = 150, dir = -1;
  for (let i = 0; i < len; i += 6) {
    for (const s of [-2.2, 2.2]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 5, 8), timberDk);
      pile.position.set(x0 + dir * i, 0.6, z0 + s); g.add(pile);
    }
  }
  const deck = new THREE.Mesh(_box(len, 0.35, 5.6), timber);
  deck.position.set(x0 + dir * len / 2, 2.9, z0); deck.castShadow = deck.receiveShadow = true; g.add(deck);
  for (let i = 0; i < len; i += 2.4) { const plank = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 5.6), timberDk); plank.position.set(x0 + dir * i, 3.1, z0); g.add(plank); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), timberDk); rail.position.set(x0 + dir * len / 2, 4.0, z0 + 2.6); g.add(rail);
  for (let i = 0; i < len; i += 6) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), timberDk); post.position.set(x0 + dir * i, 3.55, z0 + 2.6); g.add(post); }
  const px = x0 + dir * (len + 16), pz = z0;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(16, 0.25, 3), timber); ramp.position.set(x0 + dir * (len + 8), 2.0, z0); ramp.rotation.z = dir * -0.11; g.add(ramp);
  const pont = new THREE.Mesh(_box(14, 0.6, 40), timber); pont.position.set(px, 0.9, pz); pont.castShadow = true; g.add(pont);
  for (let i = -18; i <= 18; i += 4.5) for (const s of [-5, 5]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 10), drum); d.rotation.z = Math.PI / 2; d.position.set(px + s, 0.2, pz + i); g.add(d); }
  for (let i = -16; i <= 16; i += 8) for (const s of [-6.3, 6.3]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 8), drum); b.position.set(px + s, 1.6, pz + i); g.add(b); }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3), new THREE.MeshStandardMaterial({ color: 0x6f6d66, roughness: 0.8 })); hut.position.set(px + 4, 2.5, pz - 16); g.add(hut);
  const bowser = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 12), new THREE.MeshStandardMaterial({ color: 0x8a2f24, roughness: 0.6 })); bowser.rotation.z = Math.PI / 2; bowser.position.set(px - 4, 1.9, pz + 15); g.add(bowser);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 9, 6), white); pole.position.set(px, 5.5, pz - 19); g.add(pole);
  // windsock: a tapered sleeve on a swivel, its cloth rippled and sagging by vertex animation
  const sockGeo = new THREE.CylinderGeometry(0.22, 0.5, 2.6, 10, 8, true); sockGeo.rotateZ(Math.PI / 2); sockGeo.translate(-1.3, 0, 0);
  const sock = new THREE.Mesh(sockGeo, new THREE.MeshStandardMaterial({ color: 0xff7a1a, side: THREE.DoubleSide, roughness: 0.9 }));
  sock.position.set(px, 9.6, pz - 19); g.add(sock);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 16), drum); ring.rotation.y = Math.PI / 2; sock.add(ring);
  sock.userData.rest = sockGeo.attributes.position.array.slice(); FLAGS.push({ mesh: sock, kind: 'sock' });
  const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 14, 6), white); fpole.position.set(px, 8, pz + 19); g.add(fpole);
  const flagGeo = new THREE.PlaneGeometry(3.2, 2, 18, 8); flagGeo.translate(-1.6, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xffd23c, side: THREE.DoubleSide, emissive: 0x6a5000, emissiveIntensity: 0.6, roughness: 0.9 }));
  flag.position.set(px - 0.1, 14.2, pz + 19); g.add(flag);
  flag.userData.rest = flagGeo.attributes.position.array.slice(); FLAGS.push({ mesh: flag, kind: 'flag' });
  JETTY.x = px - 12; JETTY.z = pz; JETTY.heading = Math.PI / 2;
  g.userData.jetty = JETTY;
  g.userData.pontoon = { x: px, z: pz, halfW: 7, deckY: 1.2, hut: { x: px + 4, z: pz - 16 } };
  // marshallers at the pontoon's west edge facing out over the water, groundcrew by the hut
  for (const [mx, mz, bats] of [[px - 6.5, pz - 6, true], [px - 6.5, pz + 8, true], [px + 2, pz - 12, false], [px + 5, pz + 10, false]]) {
    const fig = figure(mx, 1.2, mz, -Math.PI / 2, bats); g.add(fig); MARSHALLERS.push(fig);
  }
  const e0 = toWorld(HARBOUR.northMole[2][0], HARBOUR.northMole[2][1]), e1 = toWorld(HARBOUR.detachedMole[0][0], HARBOUR.detachedMole[0][1]);
  ENTRANCE.x = (e0.x + e1.x) / 2 - 20; ENTRANCE.z = (e0.z + e1.z) / 2;
  // sheltered water: the swell is broken by the moles, so inside this radius the sea lies flat
  g.userData.shelter = { x: (px + ENTRANCE.x) / 2 - 300, z: (pz + ENTRANCE.z) / 2, r: 1800 };   // the harbour at the Gibraltar zoom
}

export function buildHarbour() {
  const g = new THREE.Group();
  const H = HARBOUR;
  for (let i = 0; i < H.northMole.length - 1; i++) g.add(moleSegment(H.northMole[i], H.northMole[i + 1]));
  g.add(moleSegment(H.detachedMole[0], H.detachedMole[1]));
  g.add(moleSegment(H.southMole[0], H.southMole[1]));
  // Mole-head lights
  for (const p of [H.detachedMole[0], H.detachedMole[1], H.southMole[1], H.northMole[2]]) {
    const w = toWorld(p[0], p[1]);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 9, 10), white);
    t.position.set(w.x, 6.5, w.z); g.add(t);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc040, emissiveIntensity: 1.5 }));
    lamp.position.set(w.x, 11.3, w.z); g.add(lamp);
  }
  // Mooring buoys for the flying boats
  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xd8b43c, roughness: 0.7 });
  g.userData.moorings = [];
  for (const p of H.moorings) {
    const w = toWorld(p[0], p[1]);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), buoyMat);
    b.position.set(w.x, 0.3, w.z); g.add(b);
    g.userData.moorings.push(new THREE.Vector3(w.x, 0, w.z));
  }
  // Gun Wharf quay and the town on the west slope
  const gw = toWorld(H.gunWharf[0], H.gunWharf[1]);
  const quay = new THREE.Mesh(_box(60, 3, 140), concrete);
  quay.position.set(gw.x - 10, 0.5, gw.z); g.add(quay);

  // RAF New Camp: apron, slipway and hangar (reclaimed land by Montagu Bastion, 1942)
  const nc = toWorld(H.newCamp[0], H.newCamp[1]);
  const apron = new THREE.Mesh(_box(120, 2, 90), concrete);
  apron.position.set(nc.x - 20, 0.5, nc.z); g.add(apron);
  const slip = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 60), concrete);
  slip.position.set(nc.x - 85, -0.6, nc.z); slip.rotation.z = 0.06; g.add(slip);
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(50, 16, 40), new THREE.MeshStandardMaterial({ color: 0x8e8c84, roughness: 0.8 }));
  hangar.position.set(nc.x + 10, 9.5, nc.z); hangar.castShadow = true; g.add(hangar);
  buildJetty(g);
  // North Front runway (extended westward into the bay in 1942)
  const r0 = toWorld(H.northFrontRunway[0][0], H.northFrontRunway[0][1]);
  const r1 = toWorld(H.northFrontRunway[1][0], H.northFrontRunway[1][1]);
  const len = Math.hypot(r1.x - r0.x, r1.z - r0.z);
  const rw = new THREE.Mesh(_box(len, 1.2, 22), tarmac);
  rw.position.set((r0.x + r1.x) / 2, 1.2, (r0.z + r1.z) / 2);
  rw.rotation.y = -Math.atan2(r1.z - r0.z, r1.x - r0.x); g.add(rw);
  // Europa Point lighthouse (1841). The wartime photograph of a Catalina over the point shows the
  // tower plain white, with no band, under a dark lantern and gallery.
  const lp = toWorld(H.europaLighthouse[0], H.europaLighthouse[1]);
  const ly = Math.max(0, terrainHeight(lp.x, lp.z));
  const th = 18;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, th, 14), white);
  tower.position.set(lp.x, ly + th / 2, lp.z); tower.castShadow = true; g.add(tower);
  const dark = new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.6, metalness: 0.3 });
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.5, 14), dark);
  gallery.position.set(lp.x, ly + th + 0.25, lp.z); g.add(gallery);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.6, 14), dark);
  cap.position.set(lp.x, ly + th + 3.2, lp.z); g.add(cap);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffd060, emissiveIntensity: 2 }));
  lamp.position.set(lp.x, ly + th + 1.2, lp.z); g.add(lamp);
  return g;
}


// Wave the aircraft in: bats overhead and crossing when it is inside 400 m on the water, a slow
// "come ahead" sweep further out, arms down otherwise.
// cloth in a light westerly: waves run down the flag from the hoist, growing toward the fly,
// with a slower flap laid over; the windsock swings on its swivel and its tail sags and ripples
export function updateFlags(t) {
  const gust = 0.7 + 0.3 * Math.sin(t * 0.37) * Math.sin(t * 0.91 + 1.3);
  for (const { mesh, kind } of FLAGS) {
    const pos = mesh.geometry.attributes.position, rest = mesh.userData.rest;
    if (kind === 'flag') {
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1];
        const u = -x / 3.2;                                    // 0 at the hoist, 1 at the fly
        const wave = Math.sin(u * 9.0 - t * 7.5) * 0.3 * u + Math.sin(u * 4.0 - t * 3.1 + y) * 0.14 * u + Math.sin(u * 15.0 - t * 11.0) * 0.05 * u;
        pos.setXYZ(i, x, y - 0.12 * u * u * (1.2 - gust) + Math.sin(u * 6.0 - t * 5.0) * 0.05 * u, wave * gust);
      }
      mesh.rotation.y = 0.15 * Math.sin(t * 0.8) + 0.1 * Math.sin(t * 2.3);
    } else {
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const u = -x / 2.6;                                    // 0 at the ring, 1 at the tail
        const sag = -1.1 * u * u * (1.15 - gust);              // tail droops as the wind falls
        const ripple = Math.sin(u * 7.0 - t * 6.0) * 0.13 * u + Math.sin(u * 13.0 - t * 9.5) * 0.04 * u;
        pos.setXYZ(i, x, y + sag + ripple, z + Math.sin(u * 5.0 - t * 4.2 + 0.7) * 0.07 * u);
      }
      mesh.rotation.y = 0.35 * Math.sin(t * 0.55) + 0.12 * Math.sin(t * 1.9);
    }
    pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
  }
}

export function updateMarshallers(planePos, onWater, t) {
  const d = Math.hypot(planePos.x - JETTY.x, planePos.z - JETTY.z);
  for (const fig of MARSHALLERS) {
    const u = fig.userData; if (!u.arms) continue;
    let target = 0;
    if (onWater && u.bats && d < 400) target = d < 60 ? Math.PI * 0.95 : Math.PI * 0.75 + Math.sin(t * 5) * 0.55;
    else if (onWater && u.bats && d < 1200) target = Math.PI * 0.5 + Math.sin(t * 2.2) * 0.5;
    u.batsUp = target > 0.2;
    for (let i = 0; i < 2; i++) {
      const sh = u.arms[i].shoulder, goal = i === 0 ? target : -target;
      sh.rotation.z += (goal - sh.rotation.z) * 0.15;
      if (u.batsUp) { sh.rotation.x = 0; u.arms[i].elbow.rotation.x = -0.15; }
    }
    animateFigure(fig, t, 0);
  }
}