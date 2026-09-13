import * as THREE from 'three';

// Foam and wash for hulls on the water. A procedural foam texture (cellular bubbles over broken
// patches, not streaks) is shared by the flying boat's wake, wash and stern churn and by the
// ships' wakes; the meshes scroll it so the water appears to run past.

let foamTex = null;
export function getFoamTexture() {
  if (foamTex) return foamTex;
  const W = 256, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const L = 16, lat = [];
  for (let i = 0; i < L * L; i++) lat.push(Math.random());
  const n = (x, y) => {
    const gx = ((x % W) + W) % W * L / W, gy = ((y % H) + H) % H * L / H;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const s = (a, b) => lat[((b % L + L) % L) * L + ((a % L + L) % L)];
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (s(x0, y0) * (1 - u) + s(x0 + 1, y0) * u) * (1 - v) + (s(x0, y0 + 1) * (1 - u) + s(x0 + 1, y0 + 1) * u) * v;
  };
  // cellular bubbles: distance to jittered points on a tileable grid
  const C = 24, pts = [];
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([(i + Math.random()) * W / C, (j + Math.random()) * H / C]);
  const cell = (x, y) => {
    let d1 = 1e9, d2 = 1e9;
    const ci = Math.floor(x * C / W), cj = Math.floor(y * C / H);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ((ci + di) % C + C) % C, jj = ((cj + dj) % C + C) % C;
      const p = pts[jj * C + ii];
      let px = p[0] + (ci + di - ii) * W / C * 0, py = p[1];
      // wrap offsets
      px = p[0] + (ci + di < 0 ? -W : ci + di >= C ? W : 0); py = p[1] + (cj + dj < 0 ? -H : cj + dj >= C ? H : 0);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return { d1, d2 };
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const big = 0.6 * n(x, y) + 0.4 * n(x * 2.1, y * 2.1);                 // broken patches
    const { d1, d2 } = cell(x, y);
    const bubble = Math.max(0, 1 - d1 / (W / C * 0.55));                    // bright bubble centres
    const edge = Math.max(0, 1 - Math.abs(d2 - d1) / (W / C * 0.35));       // bubble walls
    const fine = n(x * 5.3, y * 5.3);
    let a = (big - 0.35) * 2.2 + bubble * 0.5 + edge * 0.35 + (fine - 0.5) * 0.35;
    a = Math.max(0, Math.min(1, a));
    const i = (y * W + x) * 4;
    img.data[i] = 245; img.data[i + 1] = 250; img.data[i + 2] = 252; img.data[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  foamTex = new THREE.CanvasTexture(c);
  foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping; foamTex.colorSpace = THREE.SRGBColorSpace;
  return foamTex;
}

// A patch of foam: a plane whose alpha is the foam texture times a soft envelope. `head` is at
// local +Z; the strip runs down -Z. Options: repeatY (tiles along), edge (edge softness),
// taper (width at the head as a fraction of the tail width: 1 = parallel, 0.2 = a V opening
// astern), headFade (0 = full strength at the head, 1 = soft start).
export function foamStrip(width, length, opts = {}) {
  const geo = new THREE.PlaneGeometry(width, length, 1, 8).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      tFoam: { value: getFoamTexture() }, uTime: { value: 0 }, uOpacity: { value: 0 },
      uRepeat: { value: new THREE.Vector2(opts.repeatX || 1, opts.repeatY || Math.max(1, length / 12)) },
      uScroll: { value: opts.scroll ?? 0.35 }, uEdge: { value: opts.edge ?? 0.5 }, uTaper: { value: opts.taper ?? 1 }, uHead: { value: opts.headFade ?? 0.08 }, uTail: { value: opts.tailPow ?? 0.9 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tFoam; uniform float uTime, uOpacity, uScroll, uEdge, uTaper, uHead, uTail; uniform vec2 uRepeat; varying vec2 vUv;
      void main() {
        vec2 uv = vec2(vUv.x * uRepeat.x, vUv.y * uRepeat.y + uTime * uScroll);
        float f = texture2D(tFoam, uv).a;
        float f2 = texture2D(tFoam, uv * 0.47 + vec2(0.31, uTime * 0.13)).a;
        float f3 = texture2D(tFoam, uv * 2.3 + vec2(0.7, -uTime * 0.4)).a;
        // envelope: head (uv.y = 1) to tail, and width that widens astern by uTaper
        float along = smoothstep(0.0, uHead, 1.0 - vUv.y) * pow(vUv.y, uTail);
        float halfW = mix(1.0, uTaper, vUv.y);
        float across = 1.0 - pow(min(1.0, abs(vUv.x - 0.5) * 2.0 / max(halfW, 0.05)), 1.6 + 3.0 * uEdge);
        float a = (0.55 * f + 0.4 * f2 + 0.25 * f3 - 0.12) * along * max(across, 0.0) * uOpacity;
        gl_FragColor = vec4(0.95, 0.97, 0.98, clamp(a, 0.0, 1.0));
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2; m.frustumCulled = false;
  // Advance the scroll by the elapsed time at the given rate. Never set uTime from the clock
  // multiplied by a rate: when the rate changes the product jumps and the foam visibly slips.
  m.userData.phase = 0; m.userData.lastT = null;
  m.advance = (now, rate) => {
    const last = m.userData.lastT;
    m.userData.lastT = now;
    if (last != null) m.userData.phase += Math.max(0, Math.min(0.25, now - last)) * rate;
    m.material.uniforms.uTime.value = m.userData.phase;
  };
  return m;
}
