import * as THREE from 'three';

// Photographic sky from an equirectangular panorama (generated with Atlas). The image is put on
// the inside of a sphere; the brightest column of the upper half locates the sun, and the sphere
// is turned so that the sun sits where the sortie's lighting expects it. The horizon band gives
// the fog and sea-haze colour so the world blends into the picture.

const loader = new THREE.TextureLoader();

export function loadPanorama(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.mapping = THREE.EquirectangularReflectionMapping; resolve(tex); }, undefined, reject);
  });
}

// Analyse the image: sun azimuth (u in 0..1 across the panorama), sun elevation (v), horizon
// colour (mean of a thin band just above the horizon) and zenith colour.
export function analysePanorama(image) {
  const W = 256, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const lum = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  let bestU = 0, bestV = 0, best = -1;
  for (let y = 4; y < Math.floor(H / 2); y++) for (let x = 0; x < W; x++) {
    // blur a little so a single hot pixel does not win
    let s = 0; for (let dx = -2; dx <= 2; dx++) s += lum(((y * W) + ((x + dx + W) % W)) * 4);
    if (s > best) { best = s; bestU = x / W; bestV = y / H; }
  }
  const mean = (y0, y1) => { let r = 0, g = 0, b = 0, n = 0; y0 = Math.floor(y0); y1 = Math.floor(y1); for (let y = y0; y < y1; y++) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return new THREE.Color(r / n / 255, g / n / 255, b / n / 255); };
  return { sunU: bestU, sunV: bestV, horizon: mean(H * 0.44, H * 0.5), zenith: mean(2, H * 0.12), sea: mean(H * 0.72, H * 0.9) };
}

export function buildPanoramaSky(texture, sunDir) {
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(40000); mesh.frustumCulled = false; mesh.renderOrder = -10;
  const info = analysePanorama(texture.image);
  // direction of the sun texel on three.js's sphere: u -> phi = 2*pi*u, x = -cos(phi), z = sin(phi)
  const phi = info.sunU * Math.PI * 2;
  const yawImg = Math.atan2(-Math.cos(phi), Math.sin(phi));
  const yawGame = Math.atan2(sunDir.x, sunDir.z);
  mesh.rotation.y = yawGame - yawImg;
  mesh.userData.info = info;
  return mesh;
}
