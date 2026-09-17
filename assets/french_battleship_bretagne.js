// Bretagne-class battleship (Provence, Bretagne) as modernised and at Mers-el-Kébir in July 1940:
// 166 m, five twin 340 mm turrets on the centreline (two forward, one between the funnels, two
// aft, the inner pair of each end superfiring), two funnels, a tripod foremast with its fire
// control top, and a row of casemate guns along the hull. French navy light grey.
import { warshipKit } from './lib/warship_kit.js?v=202609171508';

export default function (THREE) {
  const g = new THREE.Group();
  const K = warshipKit(THREE);
  const grey = K.mat(0x8a929a), dark = K.mat(0x3a3f45), deck = K.mat(0x7a6a55, 0.95, 0), black = K.mat(0x16181a), light = K.mat(0xb3b8bc);
  const L = 166, B = 27, D = 13.5, WL = 9.0;
  const { deckY } = K.hull(g, { L, B, D, WL, bowRise: 2.4, sternRise: 0.4, bowLen: 0.16, sternLen: 0.12, grey, deck });

  const big = (z, raised, aft) => {
    const y = deckY(z) + (raised ? 3.4 : 0);
    if (raised) K.box(g, 9, 3.4, 9, grey, 0, deckY(z) + 1.7, z);
    K.turret(g, { z, y, w: 10, d: 12, h: 3.8, barrels: 2, bore: 0.34, len: 15, aft, grey, dark });
  };
  big(58, false, false); big(45, true, false);   // A and B
  big(-4, false, false);                          // Q, between the funnels
  big(-44, true, true); big(-57, false, true);    // X and Y
  K.named(g, 'gun', 0, deckY(58) + 3, 74);

  // bridge and tripod foremast with the fire-control top
  const bz = 30, by = deckY(bz);
  K.box(g, 14, 4, 10, grey, 0, by + 2, bz); K.box(g, 10, 3.5, 7, grey, 0, by + 5.75, bz);
  K.box(g, 10.1, 0.8, 0.1, black, 0, by + 6.2, bz + 3.55);
  K.tripod(g, { z: bz - 5, y: by + 7.5, h: 20, spread: 2.6, m: grey, top: grey });
  K.box(g, 9, 1, 1.4, grey, 0, by + 29.8, bz - 5);                         // rangefinder on the top
  K.named(g, 'bridge', 0, by + 9, bz);

  // two funnels
  K.funnel(g, { z: 14, y: deckY(14), rx: 3.2, rz: 4.4, h: 13, rake: 0.05, grey, dark });
  K.funnel(g, { z: -20, y: deckY(-20), rx: 3.2, rz: 4.4, h: 12, rake: 0.05, grey, dark });
  K.box(g, 12, 3, 44, grey, 0, deckY(-3) + 1.5, -3);                       // the long central superstructure the funnels stand on
  K.named(g, 'flak', 0, deckY(-3) + 4, -28);
  K.pole(g, { z: -32, y: deckY(-32), h: 24, r: 0.45, m: grey, yard: 10 });

  // casemate guns along both sides
  for (const s of [1, -1]) for (let k = 0; k < 7; k++) {
    const z = 30 - k * 10;
    K.box(g, 0.6, 1.4, 2.4, dark, s * 13.45, deckY(z) - 2.2, z);
    K.cylZ(g, 0.1, 0.13, 4.5, black, s * 13.9, deckY(z) - 2.2, z + 2.2, 8);
  }

  // boats, anchors, flagstaff
  for (const s of [1, -1]) { K.boat(g, s * 7.5, deckY(4) + 4, 4, 10, light); K.boat(g, s * 7.5, deckY(-12) + 4, -12, 9, light); }
  for (const s of [1, -1]) K.box(g, 0.6, 1.4, 1.6, black, s * 4.2, deckY(76) - 1.2, 76);
  K.cylY(g, 0.1, 0.12, 6, black, 0, deckY(-82) + 3, -82.5, 6);

  g.userData = { length: L, beam: B, waterline: WL, kind: 'warship', name: 'Bretagne-class battleship' };
  return g;
}
