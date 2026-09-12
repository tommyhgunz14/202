# Asset brief — the contract every module in `assets/` obeys

Adapted from the 404 game recipe (`docs/asset-contract.md`). This is the one interface the game
loader depends on.

```js
export default function (THREE) {
  const g = new THREE.Group();
  // ... build the object ...
  return g;
}
```

## Rules
- One module, one default export, a function taking the `THREE` namespace, returning ONE `THREE.Group`.
- No imports, no network, no eval, no timers, no animation loop, no Node APIs. Loaded by
  dynamic `import()` in the browser.
- Geometry from Three.js primitives (`Box`, `Cylinder`, `Sphere`, `Cone`, `Torus`, `Lathe`,
  `Extrude`, `Shape`, `Capsule`, `Tube`) or hand-built `BufferGeometry`. Anything open-ended uses
  `side: THREE.DoubleSide`.
- `MeshStandardMaterial` only, explicit flat colours per part, hex values from `STYLE-LOCK.md`.
  Optional `material.name` from: `metal | timber | fabric | canvas | glass`.
- Real metres. Front faces +Z. Base (lowest point) at y = 0, centred on x and z. Use the six
  measurement lines from the recipe (below) as the LAST thing before `return g`.
- Recognisable from every angle. Model the structure: struts, floats, engine nacelles,
  turrets, conning towers, deck guns, railings, derricks, funnels, lifeboats. Never a decorated box.
- Keep the triangle count between 3,000 and 40,000.
- Keep the hierarchy meaningful; the game loads with `keepHierarchy` and looks for these names:
  - Aircraft: every propeller mesh/group named `prop` (rotates about its local +Z axis, so build
    each prop with blades in the XY plane and the hub along Z). Gun positions named `gun_nose`,
    `gun_dorsal`, `gun_tail`, `gun_waist_l`, `gun_waist_r` as empty `Object3D`s at the muzzle
    (their +Z is the firing direction). An empty `Object3D` named `cockpit` at the pilot's eye
    point. An empty named `bomb_bay` where depth charges release from.
  - Vessels: an empty named `bridge`. `g.userData.waterline` = metres above y = 0 of the design
    waterline. Deck guns named `gun` (empty at muzzle). For submarines add `userData.kind =
    'submarine'`.
- `g.userData.length`, `userData.span` (aircraft) or `userData.beam` (ships) in metres, so the
  verifier can check size.

## Measurement / placement lines (paste verbatim before `return g`)
```js
const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
g.updateMatrixWorld(true);
g.traverse((n) => {
  const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
  const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
  if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
  put(n.matrixWorld);
});
const c = box.getCenter(new THREE.Vector3());
g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
```

## Markings (do them — they are what makes the livery accurate)
Roundels are flat, thin cylinders (or rings of `RingGeometry`, DoubleSide) stood 2 cm proud of the
surface. Code letters and serials are built from thin boxes (block capitals, 7-segment style is
acceptable). Fin flashes are three vertical stripes red-white-blue (red forward). Type A1 fuselage
roundel = blue/white/red with yellow outer ring; Type A on wing upper surfaces (blue/white/red);
Type B (blue/red) on upper wings from mid-1940.

## Verification
Render from four sides with the recipe harness:
```
node <recipe>/harness/verify.mjs <dir-with-your-module> --size=480
```
It writes `_verify/*.png`. Look at the pictures. Loop until the silhouette from every side is
right and the report has no failures. Delete `_verify/` when done.
