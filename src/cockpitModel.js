import * as THREE from 'three';

// First-person cockpit interior, built in "head" coordinates: the eye is at the origin looking
// down -Z, +X to the right, +Y up. It is rendered in its own pass over the world so the exterior
// hull can be clipped away without the interior vanishing. Two layouts:
//  - enclosed flight deck (Catalina, Sunderland, London): side-by-side seats, framed windscreen
//    with quarter lights, glare shield, yoke and column, throttle quadrant, co-pilot's yoke
//  - open cockpit (Swordfish): padded coaming, small windscreen, spade-grip stick, ring sight
// The instrument panel is a live canvas texture drawn by cockpit.js every frame.

const M = {
  interior: new THREE.MeshStandardMaterial({ color: 0x8b9682, roughness: 0.9 }),          // RAF interior grey-green, sunlit
  dark: new THREE.MeshStandardMaterial({ color: 0x2e3033, roughness: 0.8 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.7, metalness: 0.3 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fbad0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
  bakelite: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: 0xa02a30, roughness: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2b4a8a, roughness: 0.5 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.4, metalness: 0.6 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xc6c8c7, roughness: 0.4, metalness: 0.5 }),
};

function box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m;
}

export function buildCockpitInterior(spec, panelCanvas) {
  const g = new THREE.Group();
  const open = spec.id === 'swordfish';
  const engines = spec.engines.startsWith('4') ? 4 : spec.engines.startsWith('2') ? 2 : 1;
  const tex = new THREE.CanvasTexture(panelCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const panelMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0x333333, emissiveMap: tex, emissiveIntensity: 0.5 });
  const parts = {};

  if (!open) {
    // sit the whole flight deck a little lower and further forward so the horizon clears the panel
    g.position.set(0, -0.3, -0.25); g.scale.setScalar(0.9);
    // panel and glare shield
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), panelMat);
    panel.position.set(0.12, -0.36, -0.95); panel.rotation.x = 0.3; g.add(panel);
    g.add(box(1.62, 0.56, 0.06, M.dark, 0.12, -0.37, -0.99, 0.3));
    g.add(box(1.9, 0.04, 0.4, M.dark, 0.12, -0.12, -1.12));   // glare shield, low
    // windscreen: one wide clear pane, only a thin sill; the frame posts sit at the far edges
    g.add(box(2.6, 0.04, 0.05, M.frame, 0.12, -0.09, -1.25));
    // no windscreen posts: the side frames sat inside the field of view and read as bars
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.3), M.glass); pane.position.set(0.12, 0.45, -1.15); pane.rotation.x = -0.3; g.add(pane);
    // low side walls only, well below the eye line; the roof is above the field of view
    g.add(box(2.8, 0.06, 1.4, M.interior, 0.12, 1.25, -0.4));
    // overhead quadrant between the pilots: sits above the windscreen with only the lever
    // knobs hanging into the top of the view, as it does on the real flight deck
    g.add(box(0.5, 0.12, 0.28, M.dark, 0.12, 1.06, -0.7));
    g.add(box(0.54, 0.035, 0.32, M.frame, 0.12, 0.99, -0.7));
    for (let i = 0; i < 6; i++) {
      const lv = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.15, 6), M.frame);
      lv.position.set(0.12 + (i - 2.5) * 0.062, 0.92, -0.69); lv.rotation.x = 0.26 + (i % 2) * 0.1; g.add(lv);
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), i < 2 ? M.bakelite : i < 4 ? M.brass : M.dark);
      kn.position.set(0.12 + (i - 2.5) * 0.062, 0.86, -0.67); g.add(kn);
    }
    // pedestal between the seats with the trim wheels
    g.add(box(0.3, 0.42, 0.5, M.dark, 0.12, -0.78, -0.35));
    for (const zz of [-0.5, -0.28]) {
      const tw = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 20), M.frame);
      tw.rotation.y = Math.PI / 2; tw.position.set(0.12, -0.6, zz); g.add(tw);
    }
    for (const s of [-1, 1]) g.add(box(0.06, 0.9, 1.4, M.interior, 0.12 + s * 1.38, -0.55, -0.2));
    g.add(box(2.6, 0.4, 0.08, M.interior, 0.12, -0.9, 0.45));   // seat back header behind
    // pilot's yoke and column (moves with the controls); co-pilot's yoke fixed
    const yoke = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.5, 10), M.frame); col.position.set(0, -0.86, -0.58); col.rotation.x = 0.25; yoke.add(col);
    // the wheel sits low, its top rim just above the panel edge, so the view ahead stays clear
    const wheel = new THREE.Group(); wheel.position.set(0, -0.62, -0.62);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 32, Math.PI * 1.3).rotateZ(Math.PI * 0.85), M.bakelite));
    wheel.add(box(0.36, 0.035, 0.035, M.bakelite, 0, -0.02, 0));
    wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12).rotateX(Math.PI / 2), M.brass));
    yoke.add(wheel); g.add(yoke); parts.yoke = yoke; parts.wheel = wheel;
    const cop = yoke.clone(); cop.position.x = 1.0; g.add(cop);
    // throttle quadrant on the left with one lever per engine (red knobs) and pitch levers (blue)
    const quad = new THREE.Group(); quad.position.set(-0.62, -0.5, -0.5);
    quad.add(box(0.28, 0.14, 0.34, M.dark, 0, 0, 0));
    parts.levers = [];
    for (let i = 0; i < engines; i++) {
      const lv = new THREE.Group(); lv.position.set(-0.09 + i * (0.18 / Math.max(1, engines - 1)) * (engines > 1 ? 1 : 0), 0.06, 0.05);
      lv.add(box(0.014, 0.24, 0.014, M.alu, 0, 0.12, 0));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), M.red); knob.position.y = 0.25; lv.add(knob);
      quad.add(lv); parts.levers.push(lv);
    }
    for (let i = 0; i < engines; i++) {
      const lv = new THREE.Group(); lv.position.set(-0.09 + i * (0.18 / Math.max(1, engines - 1)) * (engines > 1 ? 1 : 0), 0.06, -0.09); lv.rotation.x = 0.3;
      lv.add(box(0.012, 0.2, 0.012, M.alu, 0, 0.1, 0));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), M.blue); knob.position.y = 0.21; lv.add(knob);
      quad.add(lv);
    }
    g.add(quad);
    // P8 compass in its bowl on the pedestal, trim wheel, seat arms
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.1, 16), M.dark); bowl.position.set(0.55, -0.55, -0.7); g.add(bowl);
    const card = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), new THREE.MeshStandardMaterial({ color: 0xe8e2c8 })); card.rotation.x = -Math.PI / 2; card.position.set(0.55, -0.49, -0.7); g.add(card); parts.compassCard = card;
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 24), M.bakelite); trim.position.set(-0.62, -0.5, -0.2); trim.rotation.y = Math.PI / 2; g.add(trim);
    for (const s of [-1, 1]) g.add(box(0.08, 0.06, 0.5, M.leather, s * 0.36, -0.62, 0.1));
  } else {
    g.position.set(0, -0.2, -0.12);
    // open cockpit: coaming, small panel, windscreen, stick, ring sight
    const coam = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 10, 40), M.leather); coam.rotation.x = Math.PI / 2; coam.scale.set(1, 1.45, 1); coam.position.set(0, -0.12, -0.1); g.add(coam);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.4), panelMat); panel.position.set(0, -0.33, -0.78); panel.rotation.x = 0.28; g.add(panel);
    g.add(box(1.05, 0.46, 0.05, M.dark, 0, -0.34, -0.81, 0.28));
    g.add(box(1.3, 0.35, 0.9, M.interior, 0, -0.75, -0.6));
    g.add(box(0.7, 0.03, 0.03, M.frame, 0, -0.03, -0.9)); g.add(box(0.7, 0.03, 0.03, M.frame, 0, 0.27, -0.78));
    for (const s of [-1, 1]) g.add(box(0.03, 0.34, 0.03, M.frame, s * 0.34, 0.12, -0.84, -0.38));
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.32), M.glass); ws.position.set(0, 0.12, -0.84); ws.rotation.x = -0.38; g.add(ws);
    const stick = new THREE.Group(); stick.position.set(0, -0.85, -0.38);
    stick.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.5, 8).translate(0, 0.25, 0), M.frame));
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 24), M.bakelite); grip.position.y = 0.55; stick.add(grip);
    g.add(stick); parts.stick = stick;
    const sight = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 6, 24), M.frame); sight.position.set(0, 0.16, -0.75); g.add(sight);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), M.brass); bead.position.set(0, 0.16, -0.76); g.add(bead);
    const quad = new THREE.Group(); quad.position.set(-0.5, -0.45, -0.35);
    quad.add(box(0.12, 0.1, 0.24, M.dark, 0, 0, 0));
    const lv = new THREE.Group(); lv.position.set(0, 0.05, 0.03); lv.add(box(0.012, 0.2, 0.012, M.alu, 0, 0.1, 0));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), M.red); knob.position.y = 0.21; lv.add(knob);
    quad.add(lv); parts.levers = [lv]; g.add(quad);
  }
  // lighting for the overlay scene: soft sky/ground plus a sun that follows the world sun
  const hemi = new THREE.HemisphereLight(0xeef4f8, 0x6a6a60, 1.5);
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.6);
  g.add(hemi, sun); parts.sun = sun;

  return {
    group: g, texture: tex,
    update(st) {
      tex.needsUpdate = true;
      if (parts.yoke) {
        parts.wheel.rotation.z = -st.roll * 1.0;
        parts.yoke.position.z = st.pitch * 0.07;
      }
      if (parts.stick) { parts.stick.rotation.x = -st.pitch * 0.35; parts.stick.rotation.z = -st.roll * 0.35; }
      if (parts.levers) for (const lv of parts.levers) lv.rotation.x = 0.55 - st.throttle * 1.1;
      if (parts.compassCard) parts.compassCard.rotation.z = st.headingRad;
      if (st.sunDir) { parts.sun.position.copy(st.sunDir).multiplyScalar(5); parts.sun.target.position.set(0, 0, 0); parts.sun.target.updateMatrixWorld(); }
    },
  };
}


// A hand-aimed gun as the gunner sees it: Lewis gun (pan magazine) for the Londons, Vickers K
// (drum) for the Catalina/Sunderland beam positions and the Swordfish, twin Brownings in a
// turret for the Sunderland nose/tail. Built in head coordinates like the cockpit; the barrel
// points down -Z with a ring-and-bead sight on the axis. The mount swings with the aim.
export function buildGunnerOverlay(spec, gunDef) {
  const g = new THREE.Group();
  const gun = new THREE.Group(); g.add(gun);
  const turret = /Browning/.test(gunDef.name);
  const lewis = /Lewis/.test(gunDef.name);
  const barrelLen = turret ? 1.1 : 0.85;
  const barrels = turret ? (/4 ×/.test(gunDef.name) ? [-0.14, -0.05, 0.05, 0.14] : [-0.07, 0.07]) : [0];
  for (const bx of barrels) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, barrelLen, 10).rotateX(Math.PI / 2), M.frame); b.position.set(bx, -0.22, -0.55 - barrelLen / 2); gun.add(b);
    if (lewis) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.55, 12).rotateX(Math.PI / 2), M.dark); j.position.set(bx, -0.22, -0.95); gun.add(j); }   // Lewis cooling jacket
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.42), M.dark); rec.position.set(bx, -0.24, -0.38); gun.add(rec);
  }
  if (lewis) { const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 20), M.dark); pan.position.set(0, -0.15, -0.5); gun.add(pan); }
  else if (!turret) { const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 16), M.dark); drum.position.set(0, -0.14, -0.45); gun.add(drum); }
  // spade grips and the Scarff / pillar mount, or turret ring
  for (const s of [-1, 1]) { const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), M.bakelite); grip.position.set(s * 0.09, -0.3, -0.2); grip.rotation.x = 0.3; gun.add(grip); }
  if (turret) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 40), M.frame); ring.rotation.x = Math.PI / 2; ring.position.set(0, -0.5, -0.3); g.add(ring);
    // no vertical turret frames: they crossed the sight line
    const cap = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 40), M.frame); cap.rotation.x = Math.PI / 2; cap.position.set(0, 0.75, 0.1); g.add(cap);
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 8, 40), M.frame); ring.rotation.x = Math.PI / 2; ring.position.set(0, -0.45, 0.05); g.add(ring);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), M.frame); pillar.position.set(0, -0.45, -0.35); gun.add(pillar);
    const coam = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 40), M.leather); coam.rotation.x = Math.PI / 2; coam.position.set(0, -0.42, 0.05); g.add(coam);
  }
  // ring-and-bead sight on the axis
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 6, 24), M.frame); ring.position.set(0, -0.1, -0.42); gun.add(ring);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.06, 0.004), M.frame); post.position.set(0, -0.13, -0.42); gun.add(post);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), M.brass); bead.position.set(0, -0.1, -1.35); gun.add(bead);
  const beadPost = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.11, 0.004), M.frame); beadPost.position.set(0, -0.16, -1.35); gun.add(beadPost);
  const hemi = new THREE.HemisphereLight(0xdfe8f0, 0x2a2a26, 0.9); const sun = new THREE.DirectionalLight(0xfff2dc, 1.2); g.add(hemi, sun);
  // the gun rides low in the view so the barrel and mount stay out of the middle of the screen
  g.position.set(0, -0.15, 0.05);
  return {
    group: g,
    update(st) {
      // recoil shake while firing, and the sun following the world
      gun.position.z = st.firing ? (Math.random() * 0.02) : 0;
      if (st.sunDir) { sun.position.copy(st.sunDir).multiplyScalar(5); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld(); }
    },
  };
}
