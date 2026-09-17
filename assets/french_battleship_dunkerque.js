// Dunkerque-class fast battleship (Dunkerque, Strasbourg), as at Mers-el-Kébir in July 1940:
// 215 m, a long flush forecastle rising to the stem, two quadruple 330 mm turrets forward (the
// second superfiring), the tall tower bridge, one big raked funnel, three quadruple 130 mm turrets
// aft, and the hangar, catapult and crane on the quarterdeck. French navy light grey.
import { warshipKit } from './lib/warship_kit.js?v=202609171548';

export default function (THREE) {
  const g = new THREE.Group();
  const K = warshipKit(THREE);
  const grey = K.mat(0x8a929a), dark = K.mat(0x3a3f45), deck = K.mat(0x6b6e6c, 0.95, 0), black = K.mat(0x16181a), light = K.mat(0xb3b8bc);
  const L = 215, B = 31, D = 15.5, WL = 8.7;
  const { deckY } = K.hull(g, { L, B, D, WL, bowRise: 4.5, sternRise: 0.3, bowLen: 0.24, sternLen: 0.14, grey, deck });

  // main armament: all forward
  K.turret(g, { z: 62, y: deckY(62), w: 13, d: 15, h: 4.6, barrels: 4, bore: 0.36, len: 17, grey, dark });
  K.turret(g, { z: 44, y: deckY(44) + 4.2, w: 13, d: 15, h: 4.6, barrels: 4, bore: 0.36, len: 17, grey, dark });
  K.box(g, 11, 4.2, 10, grey, 0, deckY(44) + 2.1, 44);                       // raised barbette for the superfiring turret
  K.named(g, 'gun', 0, deckY(62) + 3.5, 80);

  // the tower bridge: a tall block tapering in stages, rangefinders at the top
  const tz = 22, ty = deckY(tz);
  const stages = [[16, 6, 18], [13, 5, 14], [10, 5, 11], [8, 5, 8], [6, 4, 6]];
  let yy = ty;
  for (const [w, h, d] of stages) { K.box(g, w, h, d, grey, 0, yy + h / 2, tz); yy += h; }
  for (let k = 0; k < 4; k++) K.box(g, stages[k][0] + 0.1, 0.9, 0.1, black, 0, ty + [4.8, 9.5, 14.3, 19][k], tz + stages[k][2] / 2 + 0.01);   // bridge windows
  K.box(g, 14, 1.2, 1.6, grey, 0, yy + 0.6, tz);                               // main rangefinder across the top
  K.cylY(g, 0.35, 0.5, 10, grey, 0, yy + 5, tz - 1, 8);                        // pole above the tower
  K.named(g, 'bridge', 0, yy, tz);

  // funnel, mainmast
  K.funnel(g, { z: -6, y: deckY(-6), rx: 5.2, rz: 7.5, h: 17, rake: 0.1, grey, dark });
  K.named(g, 'flak', 0, deckY(-6) + 4, -18);
  K.pole(g, { z: -24, y: deckY(-24), h: 28, r: 0.5, m: grey, yard: 12 });
  K.box(g, 14, 5, 20, grey, 0, deckY(-18) + 2.5, -18);                        // after superstructure

  // secondary quadruple 130 mm turrets: two on the beam amidships, three aft (one superfiring)
  for (const s of [1, -1]) {
    const t = K.turret(g, { z: 2, y: deckY(2), w: 5.5, d: 6.5, h: 2.6, barrels: 4, bore: 0.13, len: 6.5, grey, dark });
    t.parent.position.x = s * 11; t.parent.rotation.y = s * 0.5;
  }
  K.turret(g, { z: -44, y: deckY(-44) + 2.8, w: 5.5, d: 6.5, h: 2.6, barrels: 4, bore: 0.13, len: 6.5, aft: true, grey, dark });
  K.box(g, 6.5, 2.8, 6.5, grey, 0, deckY(-44) + 1.4, -44);
  K.turret(g, { z: -54, y: deckY(-54), w: 5.5, d: 6.5, h: 2.6, barrels: 4, bore: 0.13, len: 6.5, aft: true, grey, dark });

  // quarterdeck: hangar, catapult and crane
  K.box(g, 12, 6.5, 16, grey, 0, deckY(-82) + 3.25, -82);
  K.box(g, 10.4, 5.2, 0.2, dark, 0, deckY(-82) + 2.8, -74);                  // hangar doors
  K.box(g, 1.4, 1, 22, dark, 0, deckY(-96) + 0.5, -96);                      // catapult on the stern
  K.rod(g, new THREE.Vector3(-5, deckY(-72), -72), new THREE.Vector3(-3, deckY(-72) + 14, -80), 0.35, grey);   // crane
  K.rod(g, new THREE.Vector3(-3, deckY(-72) + 14, -80), new THREE.Vector3(2, deckY(-72) + 11, -90), 0.25, grey);

  // boats, anchors, the flagstaff
  for (const s of [1, -1]) { K.boat(g, s * 8.5, deckY(-12) + 1.2, -12, 11, light); K.boat(g, s * 8.5, deckY(-30) + 1.2, -30, 9, light); }
  for (const s of [1, -1]) K.box(g, 0.6, 1.4, 1.6, black, s * 4.6, deckY(98) - 1.2, 98);
  K.cylY(g, 0.1, 0.12, 7, black, 0, deckY(-107) + 3.5, -106.5, 6);

  g.userData = { length: L, beam: B, waterline: WL, kind: 'warship', name: 'Dunkerque-class battleship' };
  return g;
}
