import { toWorld } from '../src/config.js?v=202609171124';
import { COAST, pointInPoly, distToPoly } from '../src/data/geo.js?v=202609171124';
import { terrainHeight } from '../src/world/terrain.js?v=202609171124';
const POLYS = {}; for (const k of Object.keys(COAST)) POLYS[k] = COAST[k].map(([la, lo]) => { const p = toWorld(la, lo); return [p.x, p.z]; });
for (const [name, la, lo] of [['moorings',36.14,-5.37],['bay',36.12,-5.40],['strait',36.0,-5.5],['rock',36.14,-5.343],['tarifa town',36.02,-5.60],['algeciras',36.13,-5.46]]) {
  const p = toWorld(la, lo);
  const r = {}; for (const k in POLYS) r[k] = [pointInPoly(p.x,p.z,POLYS[k]), +distToPoly(p.x,p.z,POLYS[k]).toFixed(0)];
  console.log(name, p.x.toFixed(0), p.z.toFixed(0), JSON.stringify(r), 'h=', terrainHeight(p.x,p.z).toFixed(1));
}
