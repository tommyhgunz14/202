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

// Gibraltar is shown at twice the scale of the rest of the map. Aircraft and ships are true size,
// so at 1 : 4 the Rock and the harbour looked a quarter as long as they should beside them. Within
// GIB_ZOOM.r0 real metres of the centre the map is 1 : 2; over the next few kilometres the scale
// eases back to 1 : 4, and everything beyond is simply set that much further out from Gibraltar,
// unchanged in shape and in the distances between its places. Nothing is squeezed to pay for it.
export const GIB_ZOOM = { lat: 36.132, lon: -5.350, r0: 3600, r1: 9600, inner: 0.5 };
const GZ = { x: (GIB_ZOOM.lon - ORIGIN.lon) * M_PER_DEG_LON, z: -(GIB_ZOOM.lat - ORIGIN.lat) * M_PER_DEG_LAT };
const ZL = GIB_ZOOM.r1 - GIB_ZOOM.r0, ZS0 = GIB_ZOOM.inner, ZS1 = H_SCALE;
// world distance from the centre for a real distance r: scale ZS0 inside r0, easing smoothly
// (a smoothstep in the scale itself) to ZS1 by r1, then ZS1 with the accumulated offset
function zoomRadius(r) {
  if (r <= GIB_ZOOM.r0) return ZS0 * r;
  if (r >= GIB_ZOOM.r1) return ZS0 * GIB_ZOOM.r0 + (ZS0 + ZS1) / 2 * ZL + ZS1 * (r - GIB_ZOOM.r1);
  const u = (r - GIB_ZOOM.r0) / ZL;
  return ZS0 * GIB_ZOOM.r0 + ZL * (ZS0 * u - (ZS0 - ZS1) * (u * u * u - u * u * u * u / 2));
}
export function toWorld(lat, lon) {
  const rx = (lon - ORIGIN.lon) * M_PER_DEG_LON - GZ.x, rz = -(lat - ORIGIN.lat) * M_PER_DEG_LAT - GZ.z;
  const r = Math.hypot(rx, rz);
  const k = r > 1e-6 ? zoomRadius(r) / r : ZS0;
  return { x: GZ.x * H_SCALE + rx * k, z: GZ.z * H_SCALE + rz * k };
}
export function toLatLon(x, z) {
  const wx = x - GZ.x * H_SCALE, wz = z - GZ.z * H_SCALE;
  const w = Math.hypot(wx, wz);
  // invert the radial scale by bisection; it is monotonic
  let lo = 0, hi = w / ZS1 + 1;
  for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (zoomRadius(mid) < w) lo = mid; else hi = mid; }
  const r = (lo + hi) / 2, k = w > 1e-6 ? r / w : 1 / ZS0;
  return { lat: ORIGIN.lat - (GZ.z + wz * k) / M_PER_DEG_LAT, lon: ORIGIN.lon + (GZ.x + wx * k) / M_PER_DEG_LON };
}
// world metres per real metre near a world point: the Gibraltar zoom inside, H_SCALE outside
export function scaleAtWorld(x, z) {
  const w = Math.hypot(x - GZ.x * H_SCALE, z - GZ.z * H_SCALE);
  return w <= ZS0 * GIB_ZOOM.r0 ? ZS0 : H_SCALE;
}
// Real altitude in feet from a world y (terrain uses V_SCALE, aircraft fly in real metres
// vertically — see flight.js — so altitude shown is world y in metres converted to feet).
export function altFt(y) { return y * FT; }
