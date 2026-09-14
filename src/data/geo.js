// Coastline polygons (lat, lon) and peaks for the Strait of Gibraltar region, drawn from
// standard charts of the area (Admiralty chart 142 coverage). Coarse but positioned correctly.
export const COAST = {
  // Southern Spain: Cape Trafalgar round to Marbella, closed off to the north.
  spain: [
    [36.60, -6.40], [36.30, -6.20], [36.183, -6.033], [36.19, -5.92], [36.13, -5.85], [36.09, -5.78],
    [36.06, -5.72], [36.03, -5.66], [36.008, -5.607], [36.002, -5.60], [36.02, -5.56], [36.04, -5.52],
    [36.06, -5.47], [36.075, -5.432], [36.095, -5.443], [36.115, -5.448], [36.130, -5.447],
    [36.150, -5.430], [36.165, -5.405], [36.175, -5.385], [36.175, -5.360], [36.170, -5.345],
    [36.19, -5.33], [36.23, -5.30], [36.28, -5.28], [36.35, -5.22], [36.42, -5.15], [36.47, -5.03],
    [36.51, -4.89], [36.60, -4.70], [36.90, -4.70], [36.90, -6.40],
  ],
  // Gibraltar peninsula (detailed separately in terrain.js; this is the footprint).
  gibraltar: [
    [36.166, -5.348], [36.163, -5.340], [36.150, -5.338], [36.140, -5.340], [36.128, -5.342],
    [36.115, -5.343], [36.109, -5.346], [36.112, -5.352], [36.118, -5.356], [36.126, -5.358],
    [36.135, -5.360], [36.145, -5.360], [36.155, -5.358], [36.162, -5.354],
  ],
  // Morocco: Cape Spartel to Ceuta and south.
  morocco: [
    [35.60, -6.20], [35.79, -5.92], [35.795, -5.85], [35.79, -5.80], [35.82, -5.75], [35.84, -5.66],
    [35.85, -5.56], [35.88, -5.52], [35.91, -5.48], [35.905, -5.44], [35.90, -5.42], [35.905, -5.39],
    [35.91, -5.37], [35.905, -5.345], [35.89, -5.32], [35.895, -5.29], [35.90, -5.275], [35.88, -5.28],
    [35.85, -5.30], [35.78, -5.28], [35.70, -5.25], [35.55, -5.20], [35.30, -5.30], [35.30, -6.20],
  ],
};

// Peaks / ridges: [lat, lon, height_m, radius_m, elongation dir deg, aspect]
export const PEAKS = [
  [36.185, -5.35, 300, 1500, 20, 1.5],     // Sierra Carbonera above La Línea
  [36.05, -5.60, 420, 3000, 60, 1.6],      // Tarifa hills
  [36.10, -5.75, 350, 4000, 60, 1.4],
  [36.25, -5.55, 700, 6000, 40, 1.2],      // Sierra del Niño / Los Alcornocales
  [36.44, -5.20, 1449, 6000, 50, 1.5],     // Sierra Bermeja (Estepona)
  [36.35, -5.32, 500, 4000, 40, 1.3],
  [35.900, -5.420, 851, 1800, 0, 1.0],     // Jebel Musa
  [35.890, -5.285, 204, 700, 0, 1.0],      // Monte Hacho, Ceuta
  [35.86, -5.50, 600, 3500, 60, 1.4],      // Rif foothills
  [35.80, -5.88, 320, 2500, 0, 1.2],       // Cape Spartel hills
  [35.75, -5.70, 500, 5000, 60, 1.3],
  [35.70, -5.35, 900, 8000, 30, 1.2],      // Rif
  [35.85, -5.32, 400, 2500, 30, 1.2],
];

// Ridgelines: a crest traced as a line of [lat, lon, crest height m, half-width m]. Where a range
// reads as one skyline rather than a scatter of hills, a ridge gives the sharp crest, the cols and
// the spurs that a round peak cannot. Seen from Gibraltar across the Bay, the hills behind
// Algeciras are one long sandstone skyline: low at Punta Carnero, rising to the high massif of the
// Sierra de la Luna and El Bujeo south-west of the town, a saddle, a second high hump in the Sierra
// de Algeciras to the west of it, then falling away north towards Los Barrios and San Roque.
// Heights are those of the real crests, rounded; the line of each is approximate.
export const RIDGES = [
  // Punta Carnero headland, climbing inland to join the main range
  [[36.074, -5.436, 110, 650], [36.070, -5.462, 240, 1100], [36.066, -5.492, 420, 1500], [36.064, -5.515, 560, 1800]],
  // Sierra de la Luna / El Bujeo, south-west of Algeciras, then the Sierra de Algeciras running north
  [[36.030, -5.560, 380, 1800], [36.050, -5.548, 610, 2000], [36.068, -5.535, 810, 2200], [36.088, -5.522, 700, 2100],
   [36.104, -5.518, 560, 1900], [36.122, -5.527, 740, 2100], [36.142, -5.530, 680, 2000], [36.162, -5.522, 560, 1900],
   [36.184, -5.505, 430, 1800], [36.206, -5.482, 320, 1600], [36.230, -5.462, 240, 1400]],
  // the lower ridge north of the Bay, behind Los Barrios towards San Roque
  [[36.196, -5.455, 160, 1100], [36.210, -5.425, 230, 1300], [36.218, -5.395, 190, 1200]],
];

export const PLACES = [
  { name: 'GIBRALTAR', lat: 36.140, lon: -5.353 },
  { name: 'Algeciras', lat: 36.130, lon: -5.452 },
  { name: 'La Línea', lat: 36.168, lon: -5.348 },
  { name: 'Tarifa', lat: 36.013, lon: -5.605 },
  { name: 'Europa Pt', lat: 36.109, lon: -5.346 },
  { name: 'Pta Carnero', lat: 36.075, lon: -5.432 },
  { name: 'Ceuta', lat: 35.889, lon: -5.316 },
  { name: 'Jebel Musa', lat: 35.900, lon: -5.420 },
  { name: 'Pta Cires', lat: 35.910, lon: -5.480 },
  { name: 'Tangier', lat: 35.785, lon: -5.810 },
  { name: 'C. Spartel', lat: 35.792, lon: -5.920 },
  { name: 'C. Trafalgar', lat: 36.183, lon: -6.033 },
  { name: 'Estepona', lat: 36.425, lon: -5.148 },
  { name: 'Marbella', lat: 36.51, lon: -4.89 },
];

// Gibraltar harbour works, 1942 (lat, lon pairs along each mole's centreline).
export const HARBOUR = {
  northMole: [[36.1495, -5.3665], [36.1495, -5.3760], [36.1440, -5.3760]],   // west then south
  detachedMole: [[36.1405, -5.3760], [36.1315, -5.3760]],
  southMole: [[36.1235, -5.3610], [36.1235, -5.3745]],
  gunWharf: [36.1352, -5.3550],
  moorings: [[36.1440, -5.3700], [36.1420, -5.3720], [36.1400, -5.3700], [36.1380, -5.3720], [36.1360, -5.3700]],
  newCamp: [36.1470, -5.3600],          // RAF New Camp slipway (reclaimed land, from 1942)
  northFrontRunway: [[36.1520, -5.3630], [36.1515, -5.3400]],
  europaLighthouse: [36.1092, -5.3463],
};

// Point-in-polygon and distance-to-polygon in world coordinates.
export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    const inter = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi);
    if (inter) inside = !inside;
  }
  return inside;
}
export function distToPoly(x, z, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], az = poly[j][1], bx = poly[i][0], bz = poly[i][1];
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1e-9;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, pz = az + t * dz;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}
