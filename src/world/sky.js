import * as THREE from 'three';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;
}`;
const FRAG = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunTint;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -0.1, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.55));
  float sd = max(dot(normalize(vDir), uSunDir), 0.0);
  col += uSunTint * (pow(sd, 6.0) * 0.35 + pow(sd, 400.0) * 3.0);
  if (vDir.y < 0.0) col = mix(col, uHorizon * 0.8, clamp(-vDir.y * 8.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildSky(sunDir, palette) {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uZenith: { value: new THREE.Color(palette.zenith) },
      uHorizon: { value: new THREE.Color(palette.horizon) },
      uSunTint: { value: new THREE.Color(palette.sunTint) },
    },
  });
  const m = new THREE.Mesh(geo, mat);
  m.scale.setScalar(40000);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

function cloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildClouds(count, half, baseAlt, tint = 0xffffff) {
  const g = new THREE.Group();
  const tex = cloudTexture();
  const mat = new THREE.SpriteMaterial({ map: tex, color: tint, transparent: true, opacity: 0.85, depthWrite: false, fog: true });
  for (let i = 0; i < count; i++) {
    const cx = (Math.random() * 2 - 1) * half, cz = (Math.random() * 2 - 1) * half;
    const puffs = 4 + Math.floor(Math.random() * 6);
    const w = 200 + Math.random() * 500;
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Sprite(mat);
      const sz = w * (0.5 + Math.random() * 0.7);
      s.scale.set(sz, sz * 0.45, 1);
      s.position.set(cx + (Math.random() - 0.5) * w * 1.6, baseAlt + Math.random() * 60, cz + (Math.random() - 0.5) * w * 0.8);
      g.add(s);
    }
  }
  return g;
}
