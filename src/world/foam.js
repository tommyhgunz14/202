import * as THREE from 'three';

// Foam and wash for hulls on the water. A procedural foam texture (streaky value noise with a
// soft alpha) is shared by the flying boat's wake, the planing wash sheets along her chines and
// the ships' wakes; the meshes scroll it so the water appears to run past.

let foamTex = null;
export function getFoamTexture() {
  if (foamTex) return foamTex;
  const W = 256, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  // value noise, tileable by wrapping the lattice
  const L = 16, lat = [];
  for (let i = 0; i < L * L; i++) lat.push(Math.random());
  const n = (x, y) => {
    const gx = x * L / W, gy = y * L / H;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const s = (a, b) => lat[((b % L + L) % L) * L + ((a % L + L) % L)];
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (s(x0, y0) * (1 - u) + s(x0 + 1, y0) * u) * (1 - v) + (s(x0, y0 + 1) * (1 - u) + s(x0 + 1, y0 + 1) * u) * v;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // streaks along y: stretch the noise so the foam reads as trailing lines
    const v = 0.5 * n(x, y * 0.5) + 0.3 * n(x * 2.3, y * 1.1) + 0.2 * n(x * 4.7, y * 2.4);
    const a = Math.max(0, Math.min(1, (v - 0.42) * 3.2));
    const i = (y * W + x) * 4;
    img.data[i] = 245; img.data[i + 1] = 250; img.data[i + 2] = 252; img.data[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  foamTex = new THREE.CanvasTexture(c);
  foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping; foamTex.colorSpace = THREE.SRGBColorSpace;
  return foamTex;
}

// A strip of foam: a plane whose alpha is the foam texture times a soft gradient (bright at the
// head, fading to the tail and at the edges). `head` is at local +Z; the strip runs down -Z.
export function foamStrip(width, length, opts = {}) {
  const geo = new THREE.PlaneGeometry(width, length, 1, 8).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tFoam: { value: getFoamTexture() }, uTime: { value: 0 }, uOpacity: { value: 0 }, uRepeat: { value: new THREE.Vector2(opts.repeatX || 1, opts.repeatY || Math.max(1, length / 12)) }, uScroll: { value: 0.35 }, uEdge: { value: opts.edge ?? 0.5 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tFoam; uniform float uTime, uOpacity, uScroll, uEdge; uniform vec2 uRepeat; varying vec2 vUv;
      void main() {
        vec2 uv = vec2(vUv.x * uRepeat.x, vUv.y * uRepeat.y + uTime * uScroll);
        float f = texture2D(tFoam, uv).a;
        float f2 = texture2D(tFoam, uv * 0.53 + vec2(0.3, uTime * 0.1)).a;
        float along = smoothstep(0.0, 0.08, vUv.y) * pow(vUv.y, 0.9);           // head bright, tail fades (uv.y = 1 at the head)
        float across = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0 + 3.0 * uEdge);      // soft edges
        float a = (0.65 * f + 0.45 * f2) * along * across * uOpacity;
        gl_FragColor = vec4(0.94, 0.97, 0.98, clamp(a, 0.0, 1.0));
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2; m.frustumCulled = false;
  return m;
}
