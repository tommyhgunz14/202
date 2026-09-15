// node tools/badge-cutout.mjs <badge.png> assets/ui/badge_202.png
//
// Lifts the squadron badge off its white ground: the white (and the thin dark scan edge) connected
// to the border becomes transparent, and the pixels along the cut are given partial alpha with
// the white taken back out of their colour, so the outline stays smooth over the dark title screen.
// White enclosed by the badge (the roundel's field behind the mallard, the pearls) is untouched.
import { execFileSync } from 'child_process';

const [, , src, dst] = process.argv;
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).toString().trim().split(',');
const W = +probe[0], H = +probe[1];
const px = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 26 });
const N = W * H;
const whiteness = (i) => Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
const bg = new Uint8Array(N);
const stack = [];
for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
while (stack.length) {
  const i = stack.pop();
  if (bg[i]) continue;
  const x = i % W, y = (i / W) | 0;
  const edge = x < 2 || y < 2 || x > W - 3 || y > H - 3;
  if (whiteness(i) < 232 && !edge) continue;
  bg[i] = 1;
  if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
}
const out = Buffer.from(px);
for (let i = 0; i < N; i++) {
  if (bg[i]) { out[i * 4 + 3] = 0; continue; }
  const x = i % W, y = (i / W) | 0;
  let near = false;
  for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && bg[yy * W + xx]) { near = true; break; } }
  if (!near) continue;
  // along the cut: how much of this pixel is badge and how much the white it was drawn on
  const a = Math.max(0, Math.min(1, (255 - whiteness(i)) / 120));
  out[i * 4 + 3] = Math.round(a * 255);
  if (a > 0.02) for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.max(0, Math.min(255, Math.round((px[i * 4 + c] - 255 * (1 - a)) / a)));
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', dst], { input: out, maxBuffer: 1 << 26 });
console.log('wrote', dst, W + 'x' + H);
