import { LITE } from '../tier.js?v=202609161601';
import * as THREE from 'three';

// Surface textures generated with Atlas live in assets/tex/<name>.jpg with optional
// <name>_normal.jpg and <name>_rough.jpg. Everything degrades to the flat colours if a file is
// missing, so the game runs with any subset. Textures are applied in world scale: geometry gets
// planar UVs from its face normal (see planarUVs), so a 1 m tile repeats every `metres` metres.

const loader = new THREE.TextureLoader();
const cache = new Map();

export function loadTex(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  // the light build has half-size colour maps in tex/lite and no normal or roughness maps
  if (LITE && /_(normal|rough)$/.test(name)) { const none = Promise.resolve(null); cache.set(key, none); return none; }
  const p = new Promise((resolve) => {
    loader.load(`assets/tex/${LITE ? 'lite/' : ''}${name}.jpg`, (t) => {
      t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = LITE ? 4 : 8;
      resolve(t);
    }, undefined, () => resolve(null));
  });
  cache.set(key, p);
  return p;
}

// Apply a texture set to a MeshStandardMaterial once loaded. `metres` = size of one tile in the
// world; geometry must carry world-scale UVs (planarUVs) for that to hold.
export async function texture(material, name, metres = 4, extra = {}) {
  const [map, normal, rough] = await Promise.all([loadTex(name), loadTex(name + '_normal', { linear: true }), loadTex(name + '_rough', { linear: true })]);
  if (!map) return false;
  const rep = 1 / metres;
  map.repeat.set(rep, rep); material.map = map;
  if (normal) { normal.repeat.set(rep, rep); material.normalMap = normal; material.normalScale = new THREE.Vector2(extra.normalScale ?? 0.6, extra.normalScale ?? 0.6); }
  if (rough) { rough.repeat.set(rep, rep); material.roughnessMap = rough; }
  if (extra.tint) material.color.copy(extra.tint); else if (!extra.keepColor) material.color.lerp(new THREE.Color(0xffffff), 0.75);
  material.needsUpdate = true;
  return true;
}

// Give a (non-indexed or indexed) geometry world-scale planar UVs: each triangle is projected on
// the plane most aligned with its normal. Works for boxes, prisms and merged town geometry.
export function planarUVs(geometry, matrixWorld = null) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const n = pos.count;
  const uv = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    if (matrixWorld) { a.applyMatrix4(matrixWorld); b.applyMatrix4(matrixWorld); c.applyMatrix4(matrixWorld); }
    nrm.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    const ax = Math.abs(nrm.x), ay = Math.abs(nrm.y), az = Math.abs(nrm.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      let u, w;
      if (ay >= ax && ay >= az) { u = v.x; w = v.z; } else if (ax >= az) { u = v.z; w = v.y; } else { u = v.x; w = v.y; }
      uv[(i + k) * 2] = u; uv[(i + k) * 2 + 1] = w;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Terrain: two detail maps blended by the per-vertex `rock` attribute, sampled in world XZ, on
// top of the vertex colours. Injected into MeshStandardMaterial so lighting and shadows stay.
export function terrainDetail(material, scrubTex, rockTex, metres = 60, sandTex = null) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tScrub = { value: scrubTex };
    shader.uniforms.tRock = { value: rockTex };
    shader.uniforms.tSand = { value: sandTex || scrubTex };
    shader.uniforms.uTile = { value: 1 / metres };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float rock;\nattribute float sand;\nvarying float vRock;\nvarying float vSand;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = rock;\nvSand = sand;\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tScrub;\nuniform sampler2D tRock;\nuniform sampler2D tSand;\nuniform float uTile;\nvarying float vRock;\nvarying float vSand;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 tuv = vWPos.xz * uTile;
        mat2 rot = mat2(0.83, 0.56, -0.56, 0.83);
        vec2 ruv = rot * tuv;
        // triplanar weights: on flat ground the map is laid from above, on a cliff face it is
        // laid from the side, so a near-vertical face is not smeared into vertical stripes
        vec3 bw = pow(abs(vWNrm), vec3(4.0));
        bw /= max(1e-4, bw.x + bw.y + bw.z);
        // two scales of each map, the second turned, so the repeat does not read as a grid
        vec3 dS = mix(texture2D(tScrub, tuv).rgb, texture2D(tScrub, ruv * 0.37 + 0.5).rgb, 0.5);
        dS = bw.y * dS + (1.0 - bw.y) * mix(texture2D(tScrub, vWPos.zy * uTile).rgb, texture2D(tScrub, vWPos.xy * uTile).rgb, bw.z / max(1e-4, bw.x + bw.z));
        vec3 dR = bw.y * mix(texture2D(tRock, tuv * 1.7).rgb, texture2D(tRock, ruv * 0.61 + 0.25).rgb, 0.5)
                + bw.x * mix(texture2D(tRock, vWPos.zy * uTile * 1.7).rgb, texture2D(tRock, vWPos.zy * uTile * 0.61 + 0.25).rgb, 0.5)
                + bw.z * mix(texture2D(tRock, vWPos.xy * uTile * 1.7).rgb, texture2D(tRock, vWPos.xy * uTile * 0.61 + 0.25).rgb, 0.5);
        // slow brightness variation across hundreds of metres hides the tile period entirely
        vec2 mp = vWPos.xz * 0.0022; vec2 mi = floor(mp), mf = fract(mp); mf = mf * mf * (3.0 - 2.0 * mf);
        float mh00 = fract(sin(dot(mi, vec2(127.1, 311.7))) * 43758.5453), mh10 = fract(sin(dot(mi + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
        float mh01 = fract(sin(dot(mi + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), mh11 = fract(sin(dot(mi + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
        float macro = mix(mix(mh00, mh10, mf.x), mix(mh01, mh11, mf.x), mf.y);
        dS *= 0.82 + 0.36 * macro; dR *= 0.85 + 0.3 * macro;
        vec3 dSa = texture2D(tSand, tuv * 3.1).rgb;
        vec3 detail = mix(mix(dS, dR, clamp(vRock, 0.0, 1.0)), dSa, clamp(vSand, 0.0, 1.0));
        // keep the painted tint, let the photo supply the grain; the lift raises the darkest
        // samples so a cliff face cannot crush to black, without flattening the variation
        detail = detail * 1.56 + 0.22;
        diffuseColor.rgb = diffuseColor.rgb * mix(vec3(1.0), detail, 0.85);`);
  };
  material.needsUpdate = true;
}
