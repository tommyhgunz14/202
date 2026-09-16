import * as THREE from 'three';
import { WORLD_HALF } from '../config.js';
import { terrainHeight } from './terrain.js';
import { LITE } from '../tier.js';

// Sea surface. Vertex: seven directional waves of different lengths, headings and phases summed
// (no two share a direction, so the swell never reads as a grid). Fragment: the analytic slope of
// those waves plus two octaves of scrolled value noise for ripple, fading with distance to avoid
// aliasing; colour from depth-mix, sky reflection by Fresnel, sun glitter, sparse foam flecks on
// the steepest crests, and the scene fog.

const NOISE = /* glsl */`
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.13 + 7.7) + 0.15 * vnoise(p * 4.31 + 3.1); }
`;

// wave set: direction (unit), wavelength (m), amplitude (m), speed factor
const WAVES = [
  [0.93, 0.36, 260, 0.75, 1.0], [0.62, -0.78, 180, 0.55, 1.1], [-0.20, 0.98, 120, 0.4, 1.25],
  [0.99, -0.12, 70, 0.28, 1.4], [-0.71, -0.70, 46, 0.18, 1.6], [0.31, 0.95, 28, 0.12, 1.9], [-0.95, 0.30, 17, 0.07, 2.2],
];
// only waves long enough for the 10 m near grid displace the mesh; the rest are ripple normals
const VERT_WAVES = WAVES.filter((w) => w[2] >= 60);
// build the vertex shader with real amplitudes (template above keeps the structure readable)
const VERT_SRC = /* glsl */`
uniform float uTime;
uniform vec3 uShelter;   // harbour centre x, z and radius: the moles keep the swell out
uniform sampler2D uDepth;
uniform float uWorldHalf;
varying vec3 vWorld;
varying float vWave;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 p = wp.xyz; float t = uTime;
  float h = 0.0;
  ${VERT_WAVES.map(([dx, dz, L, A, s], i) => `{ float k = 6.2832 / ${L.toFixed(1)}; float w = sqrt(9.81 * k) * ${s.toFixed(2)}; h += ${A.toFixed(3)} * sin(k * (${dx.toFixed(3)} * p.x + ${dz.toFixed(3)} * p.z) - w * t + ${(i * 1.7).toFixed(2)}); }`).join('\n  ')}
  h *= mix(0.06, 1.0, smoothstep(uShelter.z, uShelter.z * 1.7, length(p.xz - uShelter.xy)));
  vec2 duv = vec2(p.x / (2.0 * uWorldHalf) + 0.5, p.z / (2.0 * uWorldHalf) + 0.5);
  float bed = texture2D(uDepth, duv).r * 120.0 - 60.0;
  h *= smoothstep(0.5, 11.0, -bed);   // the swell dies away as the water shallows
  wp.y += h;
  vWave = h;
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uTime;
uniform sampler2D uDepth;
uniform float uWorldHalf;
uniform vec3 uShallowCol;
uniform vec2 uNearC;
uniform float uNearHalf;
uniform vec3 uShelter;
varying vec3 vWorld;
varying float vWave;
${NOISE}
void main() {
#ifdef FAR_TIER
  if (abs(vWorld.x - uNearC.x) < uNearHalf && abs(vWorld.z - uNearC.y) < uNearHalf) discard;
#endif
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 p = vWorld; float t = uTime;
  float dist = length(cameraPosition - vWorld);
  // analytic slope of the long waves
  float dx = 0.0, dz = 0.0;
  ${WAVES.map(([ddx, ddz, L, A, s], i) => `{ float k = 6.2832 / ${L.toFixed(1)}; float w = sqrt(9.81 * k) * ${s.toFixed(2)}; float c = ${A.toFixed(3)} * k * cos(k * (${ddx.toFixed(3)} * p.x + ${ddz.toFixed(3)} * p.z) - w * t + ${(i * 1.7).toFixed(2)}); dx += c * ${ddx.toFixed(3)}; dz += c * ${ddz.toFixed(3)}; }`).join('\n  ')}
  // ripple from scrolled noise, two scales, fading with distance
  float near = exp(-dist * 0.0018);
  // seen from height the surface should barely shimmer: ripple and surf motion slow as the camera climbs
  float hiSlow = mix(1.0, 0.2, clamp(cameraPosition.y / 120.0, 0.0, 1.0));
  float tr = t * hiSlow;
  vec2 q1 = p.xz * 0.28 + vec2(tr * 0.35, -tr * 0.22);
  vec2 q2 = p.xz * 0.075 + vec2(-tr * 0.12, tr * 0.09);
  float e = 0.35;
  float n1x = vnoise(q1 + vec2(e, 0.0)) - vnoise(q1 - vec2(e, 0.0));
  float n1z = vnoise(q1 + vec2(0.0, e)) - vnoise(q1 - vec2(0.0, e));
  float n2x = vnoise(q2 + vec2(e, 0.0)) - vnoise(q2 - vec2(e, 0.0));
  float n2z = vnoise(q2 + vec2(0.0, e)) - vnoise(q2 - vec2(0.0, e));
  dx += near * (0.55 * n1x + 0.35 * n2x);
  dz += near * (0.55 * n1z + 0.35 * n2z);
  float far = 1.0 - exp(-dist * 0.00045);
  dx *= 1.0 - 0.8 * far; dz *= 1.0 - 0.8 * far;
  // calm inside the moles: the long-wave slope goes, only a little ripple stays
  float shelter = mix(0.25, 1.0, smoothstep(uShelter.z, uShelter.z * 1.7, length(p.xz - uShelter.xy)));
  dx *= shelter; dz *= shelter;
  vec3 N = normalize(vec3(-dx, 1.0, -dz));
  // colour: depth tint by wave height, sky by Fresnel
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  vec3 base = mix(uDeep, uShallow, clamp(vWave * 0.35 + 0.35, 0.0, 1.0));
  // subtle large-scale colour variation so the surface is not one flat tone
  base *= 0.9 + 0.2 * fbm(p.xz * 0.004 + t * 0.01);
  // seabed depth from the height map: turquoise shallows, a surf line on the beaches, and the
  // sand showing through where the water is only a metre or two deep
  vec2 duv = vec2(p.x / (2.0 * uWorldHalf) + 0.5, p.z / (2.0 * uWorldHalf) + 0.5);
  float bed = texture2D(uDepth, duv).r * 120.0 - 60.0;
  float depth = -bed + vWave;
  float shallow = 1.0 - smoothstep(1.0, 14.0, depth);
  vec3 sandCol = vec3(0.78, 0.72, 0.55);
  vec3 shal = mix(uShallowCol, sandCol, (1.0 - smoothstep(0.3, 3.5, depth)) * 0.7);
  base = mix(base, shal, shallow * 0.85);
  vec3 col = mix(base, uSky, fres * 0.7 * (1.0 - 0.5 * shallow));
  // surf: broken white water where the swell runs into the last couple of metres of depth
  float surfBand = (1.0 - smoothstep(-0.15, 1.5, depth)) * smoothstep(-0.8, 0.05, depth);
  // the breakers barely move: a slow creep at sea level that freezes into a static frothed
  // edge once the camera is above about 100 ft, and it stays visible at distance
  float ts = t * 0.045 * (1.0 - clamp(cameraPosition.y / 18.0, 0.0, 1.0));
  float surfN = fbm(p.xz * 0.35 + vec2(ts * 0.25, -ts * 0.18)) + 0.08 * sin(depth * 2.5 - ts * 1.6);
  float surf = surfBand * smoothstep(0.44, 0.70, surfN) * exp(-dist * 0.0007);
  col = mix(col, vec3(0.94, 0.96, 0.97), clamp(surf, 0.0, 1.0) * 0.8);
  // sun glitter: broad soft lobe plus a tight one, both modulated by ripple so it sparkles
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0);
  float spec = pow(nh, 160.0) * 0.9 + pow(nh, 18.0) * 0.06;
  col += vec3(1.0, 0.96, 0.88) * spec * (0.6 + 0.4 * near);
  // foam flecks on steep crests, sparse
  float crest = clamp((vWave - 0.9) * 1.2, 0.0, 1.0);
  float fl = fbm(p.xz * 0.6 + vec2(t * 0.3, -t * 0.2));
  float foam = smoothstep(0.62, 0.8, fl) * crest * near;
  col = mix(col, vec3(0.93, 0.95, 0.96), foam * 0.7);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

// Two tiers share one material: a coarse far plane covering the whole world and a fine patch
// (10 m vertex spacing) that follows the camera so the swell has real shape close in.
export function buildSea(sunDir, fogColor, fogDensity, depthTex = null) {
  const geo = new THREE.PlaneGeometry(WORLD_HALF * 2.4, WORLD_HALF * 2.4, LITE ? 100 : 160, LITE ? 100 : 160);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT_SRC, fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone().normalize() },
      uDeep: { value: new THREE.Color(0x0a3049) },
      uShallow: { value: new THREE.Color(0x1b6482) },
      uSky: { value: new THREE.Color(0x9fc0d8) },
      uFogColor: { value: new THREE.Color(fogColor) },
      uFogDensity: { value: fogDensity },
      uDepth: { value: depthTex }, uWorldHalf: { value: WORLD_HALF }, uShallowCol: { value: new THREE.Color(0x2f9c95) },
      uNearC: { value: new THREE.Vector2(0, 0) }, uNearHalf: { value: 0 },
      uShelter: { value: new THREE.Vector3(1e9, 1e9, 1) },
    },
  });
  const group = new THREE.Group();
  group.material = mat;   // shared by both tiers; main.js reads uniforms from here
  // the far tier shares the uniform objects but discards inside the near patch's square
  const farMat = new THREE.ShaderMaterial({ vertexShader: VERT_SRC, fragmentShader: FRAG, uniforms: mat.uniforms, defines: { FAR_TIER: 1 } });
  const far = new THREE.Mesh(geo, farMat); far.renderOrder = -1; far.frustumCulled = false; group.add(far);
  const NEAR = 2600, SEG = LITE ? 170 : 260;   // 10 m spacing (15 m on the light build)
  const ng = new THREE.PlaneGeometry(NEAR, NEAR, SEG, SEG); ng.rotateX(-Math.PI / 2);
  const near = new THREE.Mesh(ng, mat); near.renderOrder = -1; near.position.y = 0.02; near.frustumCulled = false; group.add(near);
  group.userData.near = near; group.userData.step = NEAR / SEG;
  // call every frame with the camera position: the fine patch snaps to its own grid so it does
  // not swim, and the far plane simply shows through beyond it
  mat.uniforms.uNearHalf.value = NEAR / 2 - NEAR / SEG;
  group.follow = (x, z) => { const st = group.userData.step; near.position.x = Math.round(x / st) * st; near.position.z = Math.round(z / st) * st; mat.uniforms.uNearC.value.set(near.position.x, near.position.z); };
  return group;
}

// Shared sea clock: main.js advances it and feeds the shader from it, so seaHeight() below
// matches what is drawn.
export const SEA = { t: 0, shelter: { x: 1e9, z: 1e9, r: 1 } };
// same shelter factor as the vertex shader, so floating objects agree with the drawn surface
function shelterAt(x, z) { const d = Math.hypot(x - SEA.shelter.x, z - SEA.shelter.z), r = SEA.shelter.r; const k = Math.min(1, Math.max(0, (d - r) / (r * 0.7))); return 0.06 + 0.94 * k * k * (3 - 2 * k); }
function shoalAt(x, z) { const d = -terrainHeight(x, z); const k = Math.min(1, Math.max(0, (d - 0.5) / 10.5)); return k * k * (3 - 2 * k); }
// Height of the swell at a world point (matches the vertex shader) for floating objects.
export function seaHeight(x, z, t = SEA.t) {
  let h = 0;
  VERT_WAVES.forEach(([dx, dz, L, A, s], i) => { const k = Math.PI * 2 / L, w = Math.sqrt(9.81 * k) * s; h += A * Math.sin(k * (dx * x + dz * z) - w * t + i * 1.7); });
  return h * shelterAt(x, z) * shoalAt(x, z);
}
