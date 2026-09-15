// node tools/colourise-catalina.mjs assets/archive/catalina_europa_point.jpg assets/archive/catalina_europa_point_colour.jpg
//
// Hand-tint colourisation of the Catalina-over-Europa-Point print, done the same way as the 1930
// passing-out photograph: every pixel keeps the print's own lightness (L*), and only colour
// (a*, b*) is painted in from regions read off the picture. Nothing is redrawn.
//
// Colours are period references, not measurements: RAF Temperate Sea Scheme upper surfaces (Extra
// Dark Sea Grey and Dark Slate Grey), a Type A1 fuselage roundel (yellow, blue, white, red) and a
// red-white-blue fin flash, pale grey-cream limestone and whitewashed barracks, grey-olive scrub,
// a deep Mediterranean blue and a hazy summer sky.
import { execFileSync } from 'child_process';

const [, , src, dst] = process.argv;
const W = 2000, H = 974;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });

// ---- colour maths (sRGB D65 <-> CIE Lab) ----
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); };
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fi = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
const Xn = 0.95047, Zn = 1.08883;
const N = W * H;
const ss = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

const L = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const r = lin(raw[i * 3]), g = lin(raw[i * 3 + 1]), b = lin(raw[i * 3 + 2]);
  L[i] = 116 * f(0.2126729 * r + 0.7151522 * g + 0.0721750 * b) - 16;
}

// separable box blur, three passes (close to a gaussian)
function blur(arr, r) {
  const out = Float32Array.from(arr), tmp = new Float32Array(N);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) { let acc = 0; const row = y * W; for (let x = -r; x <= r; x++) acc += out[row + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[row + x] = acc / (2 * r + 1); acc += out[row + Math.min(W - 1, x + r + 1)] - out[row + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { out[y * W + x] = acc / (2 * r + 1); acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
  }
  return out;
}
const Lb8 = blur(L, 8), Lb30 = blur(L, 30), Lb90 = blur(L, 90);

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- regions, in pixels of the 2000 x 974 plate ----
const horizon = (x) => 268 + 0.013 * x;
// the Catalina's silhouette: wing, nacelles, hull, tailplane and fin
const AIRCRAFT = [[352, 128], [400, 112], [490, 120], [600, 146], [855, 154], [900, 150], [990, 162], [1060, 150], [1160, 174], [1230, 189], [1440, 206],
  [1562, 234], [1520, 250], [1300, 256], [1275, 260], [1255, 284], [1600, 284], [1640, 268], [1650, 208], [1700, 184], [1780, 99], [1850, 94],
  [1897, 136], [1927, 236], [1907, 318], [1870, 340], [1760, 346], [1560, 378], [1440, 398], [1435, 438], [1165, 453], [1090, 448], [1000, 438], [890, 420], [820, 410],
  [770, 378], [747, 345], [750, 318], [782, 288], [840, 271], [870, 264], [820, 228], [550, 174], [360, 144]];
// the southern end of Gibraltar: the Rock's slope at the left, Windmill Hill, the Europa flats
const LAND = [[0, 248], [30, 273], [65, 308], [90, 328], [115, 348], [150, 370], [180, 378], [205, 403], [225, 423], [280, 428], [315, 433],
  [360, 448], [400, 460], [450, 470], [600, 491], [800, 511],
  [840, 546], [870, 591], [930, 621], [1010, 626], [1150, 641], [1250, 646], [1290, 656], [1320, 706], [1334, 718], [1300, 732], [1210, 746],
  [1100, 761], [950, 776], [780, 778], [650, 771], [550, 761], [450, 746], [330, 732], [310, 690], [250, 686], [100, 686], [0, 684]];
const ROUNDEL = { x: 1436, y: 345, rx: 38, ry: 26 };
const FLASH = { x0: 1748, x1: 1795, y0: 158, y1: 207 };
const CODES = [[1135, 300, 1230, 390], [1470, 315, 1500, 372]];   // the X and the I

const COL = {
  skyTop: [-3.5, -16], skyHaze: [-1, -4],
  sea: [-7, -15],
  lime: [1.5, 8], scrub: [-5, 12], white: [0.5, 4],
  edsg: [-1.5, -4], dsg: [-5.5, 4], code: [-2, 3],
  red: [44, 30], white2: [0, 2], blue: [6, -32], yellow: [-3, 62],
};

const bgA = new Float32Array(N), bgB = new Float32Array(N), bgS = new Float32Array(N);
const acA = new Float32Array(N), acB = new Float32Array(N), acS = new Float32Array(N), M = new Float32Array(N);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x, l = L[i];
    // background
    let c, s = 1;
    const land = inPoly(x, y, LAND)
      ? !(y < horizon(x) + 20 && l > 71)                                   // sky caught inside the outline of the Rock's shoulder stays sky
      : x < 480 && y < 480 && l > 66 && inPoly(x - 25, y, LAND);   // the sunlit rim of the shoulder just outside it is still rock
    if (land) {
      const veg = ss(2, 10, Lb8[i] + 4 - l) * ss(18, 34, l) * (1 - ss(70, 85, l));
      c = [mix(COL.lime[0], COL.scrub[0], veg), mix(COL.lime[1], COL.scrub[1], veg)];
      const bright = ss(76, 88, l); c = [mix(c[0], COL.white[0], bright), mix(c[1], COL.white[1], bright)];
    } else if (y < horizon(x)) {
      const t = ss(0, horizon(x), y) ** 1.4;
      c = [mix(COL.skyTop[0], COL.skyHaze[0], t), mix(COL.skyTop[1], COL.skyHaze[1], t)];
    } else {
      c = COL.sea;
      s = 1 - 0.5 * ss(4, 14, l - Lb30[i]);                       // glitter and wake streaks read whiter
      s *= mix(0.55, 1, ss(horizon(x), horizon(x) + 120, y));     // the far sea goes hazy toward the horizon
    }
    bgA[i] = c[0]; bgB[i] = c[1]; bgS[i] = s;
    // aircraft
    if (inPoly(x, y, AIRCRAFT)) {
      const rd = Math.hypot((x - ROUNDEL.x) / ROUNDEL.rx, (y - ROUNDEL.y) / ROUNDEL.ry);
      const inFlash = x >= FLASH.x0 && x <= FLASH.x1 && y >= FLASH.y0 && y <= FLASH.y1;
      const inCode = CODES.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
      // the polygon is drawn loose: sky showing inside it, and the gaps between wing, struts and hull, stay background
      const gap = (x > 880 && x < 1290 && y > 226 && y < 296 && l > 50) || (l > 60 && rd >= 1.08 && !inFlash && !inCode);
      if (!gap) {
        M[i] = 1;
        const t = ss(-4, 4, Lb30[i] - Lb90[i]);
        let a = mix(COL.edsg[0], COL.dsg[0], t), b = mix(COL.edsg[1], COL.dsg[1], t), sc = 0.85;
        if (rd < 1.08) {
          const k = rd < 0.22 ? COL.red : rd < 0.5 ? COL.white2 : rd < 0.8 ? COL.blue : (l > 42 ? COL.yellow : null);
          if (k) { a = k[0]; b = k[1]; sc = 1; }
        } else if (inFlash) {
          const k = x < 1762 ? COL.red : x < 1780 ? COL.white2 : COL.blue; a = k[0]; b = k[1]; sc = 1;
        } else if (inCode && l > 52) { a = COL.code[0]; b = COL.code[1]; sc = 0.6; }   // the code letters
        acA[i] = a; acB[i] = b; acS[i] = sc;
      }
    }
  }
}
const bA = blur(bgA, 2), bB = blur(bgB, 2), bS = blur(bgS, 2);
const aA = blur(acA, 1), aB = blur(acB, 1), aS = blur(acS, 1), aM = blur(M, 1);

const out = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) {
  const l = L[i], m = aM[i];
  // no colour in the deepest blacks or the brightest highlights, full colour in the mid-tones
  const k = ss(3, 24, l) * (1 - 0.8 * ss(86, 99, l));
  const w = m > 1e-3 ? 1 / m : 0;
  const a = mix(bA[i] * bS[i], aA[i] * w * aS[i] * w, m) * k, b = mix(bB[i] * bS[i], aB[i] * w * aS[i] * w, m) * k;
  const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = Xn * fi(fx), Y = fi(fy), Z = Zn * fi(fz);
  out[i * 3] = gam(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z);
  out[i * 3 + 1] = gam(-0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z);
  out[i * 3 + 2] = gam(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z);
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', '-q:v', '2', dst], { input: out, maxBuffer: 1 << 28 });
console.log('wrote', dst);
