// World scales. Geography is compressed so a patrol fits a play session; aircraft and
// vessels are modelled at true size.
export const H_SCALE = 0.25;   // world metres per real metre, horizontally (1 : 4)
export const V_SCALE = 0.5;    // world metres per real metre, vertically (terrain only)
export const ORIGIN = { lat: 36.10, lon: -5.50 };   // world (0,0) — mid-Strait, east end
export const M_PER_DEG_LAT = 111320;
export const M_PER_DEG_LON = 111320 * Math.cos(36.1 * Math.PI / 180);
export const WORLD_HALF = 16000;  // half-size of the terrain/sea square, world metres
export const FT = 3.28084;
export const MPH = 2.23694;
export const KT = 1.94384;

export function toWorld(lat, lon) {
  return {
    x: (lon - ORIGIN.lon) * M_PER_DEG_LON * H_SCALE,
    z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT * H_SCALE,
  };
}
export function toLatLon(x, z) {
  return {
    lat: ORIGIN.lat - z / (M_PER_DEG_LAT * H_SCALE),
    lon: ORIGIN.lon + x / (M_PER_DEG_LON * H_SCALE),
  };
}
// Real altitude in feet from a world y (terrain uses V_SCALE, aircraft fly in real metres
// vertically — see flight.js — so altitude shown is world y in metres converted to feet).
export function altFt(y) { return y * FT; }
