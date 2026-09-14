// node tools/colourise-passing-out.mjs assets/archive/passing_out_1930_original.jpg assets/intro/passing_out_1930.jpg
//
// Hand-tint colourisation that keeps the photograph's own lightness untouched: every pixel keeps
// its original L*, and only a* b* (colour) are painted in from soft regions.
import { execFileSync } from 'child_process';
import fs from 'fs';

const [, , src, dst] = process.argv;
const W = 2000, H = 1134;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });

// ---- colour maths (sRGB D65 <-> CIE Lab) ----
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); };
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fi = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
const Xn = 0.95047, Zn = 1.08883;

const N = W * H;
const ss = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const L = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const r = lin(raw[i * 3]), g = lin(raw[i * 3 + 1]), b = lin(raw[i * 3 + 2]);
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  L[i] = 116 * f(Y) - 16;
}

// ---- regions ----
// heads: centre of each face (x, y) read off the print
const FACES = [
  [97, 130], [285, 135], [432, 142], [606, 123], [757, 103], [905, 127], [1057, 135], [1219, 133], [1362, 123], [1485, 130], [1605, 107], [1718, 135], [1853, 117],
  [200, 262], [363, 267, 249], [515, 272], [686, 258], [845, 255], [1025, 265], [1193, 258], [1340, 258], [1519, 255], [1685, 258], [1826, 262],
];
const STAND = FACES.slice(0, 13), SIT = FACES.slice(13);
// a sitter's silhouette: the head and cap, a neck, shoulders widening to the full body width
function body(x, y, fx, fy, head, half, bottom) {
  const hx = (x - fx) / head, hy = (y - (fy - 12)) / (head * 1.75);
  if (hx * hx + hy * hy < 1) return true;
  if (y < fy + 22 || y > bottom) return false;
  const t = Math.min(1, (y - (fy + 22)) / 60);
  return Math.abs(x - fx) < 26 + (half - 26) * Math.sqrt(t);
}
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// target colour per region (a*, b*)
const COL = {
  cloth: [-1.5, -8],      // RAF blue-grey barathea
  skin: [13, 18],
  capband: [0, 3],         // white cap band, a touch warm
  wall: [3.5, 6],           // dark weathered timber of the hut
  frame: [1, 7],           // painted posts and window frames
  glass: [-3, -8],
  lawn: [-5, 12],          // winter grass
  mud: [3.5, 10],
  paper: [1, 9],           // the mount's printed caption
};
const A = new Float32Array(N), B = new Float32Array(N), S = new Float32Array(N), K = new Float32Array(N);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x, l = L[i];
    let c = COL.wall, s = 1;
    if (y > 915) { c = COL.paper; s = l > 60 ? 1 : 0.15; }
    else if (y > 612) { const w = ss(14, 42, l); c = [COL.mud[0] + (COL.lawn[0] - COL.mud[0]) * w, COL.mud[1] + (COL.lawn[1] - COL.mud[1]) * w]; }
    else {
      const person = STAND.some(([fx, fy]) => body(x, y, fx, fy, 30, 80, 560)) || SIT.some(([fx, fy]) => body(x, y, fx, fy, 28, 98, 612));
      if (person) c = COL.cloth;
      else if ((inRect(x, y, 250, 0, 465, 145) || inRect(x, y, 875, 0, 1090, 145) || inRect(x, y, 1490, 0, 1695, 140))) c = l > 45 ? COL.frame : COL.glass;
      else if (l > 55) c = COL.frame;
      for (const [fx, fy, capB] of FACES) {
        const dx = (x - fx) / 24, dy = (y - fy) / 32;
        const d = dx * dx + dy * dy;
        if (d < 1.6) {
          // above the brow is the cap: the bright band stays white, the peak and crown stay cloth
          if (y < (capB || fy - 27)) { c = l > 55 ? COL.capband : COL.cloth; }
          else if (d < 1) { c = COL.skin; K[i] = 1; }
        }
      }
    }
    A[i] = c[0]; B[i] = c[1]; S[i] = s;
  }
}

// soften the region edges so no hard outline shows (separable box blur, three passes)
function blur(arr, r) {
  const tmp = new Float32Array(N);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) { let acc = 0; const row = y * W; for (let x = -r; x <= r; x++) acc += arr[row + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[row + x] = acc / (2 * r + 1); acc += arr[row + Math.min(W - 1, x + r + 1)] - arr[row + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { arr[y * W + x] = acc / (2 * r + 1); acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
  }
}
blur(A, 7); blur(B, 7); blur(S, 5); blur(K, 2);   // skin keeps a tighter edge so small faces are not washed out by the cloth round them

const out = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) {
  const l = L[i];
  // no colour in the blacks or the paper-white highlights, full colour in the mid-tones
  const k = S[i] * ss(3, 22, l) * (1 - 0.85 * ss(86, 99, l));
  const a = (A[i] + (COL.skin[0] - A[i]) * K[i]) * k, b = (B[i] + (COL.skin[1] - B[i]) * K[i]) * k;
  const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = Xn * fi(fx), Y = fi(fy), Z = Zn * fi(fz);
  const r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const bb = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  out[i * 3] = gam(r); out[i * 3 + 1] = gam(g); out[i * 3 + 2] = gam(bb);
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', '-q:v', '2', dst], { input: out, maxBuffer: 1 << 28 });
console.log('wrote', dst);
