import * as THREE from 'three';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// Tracer rounds, depth charges / A-S bombs, splashes, explosions, smoke and oil.
export class Weapons {
  constructor(scene, audio) {
    this.scene = scene; this.audio = audio;
    this.tracers = [];
    this.charges = [];
    this.effects = [];
    // fat bright streaks, drawn additive and unfogged so they read against sea and sky
    this.tracerGeo = new THREE.CylinderGeometry(0.26, 0.14, 9.0, 6); this.tracerGeo.rotateX(Math.PI / 2);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffc040, fog: false });   // solid orange-yellow: additive washed out against a bright sky
    // incoming rounds: a thin, hot red-white streak with a tight point of light, so a stream of fire
    // aimed at you reads as a line of separate rounds and not as a patch of flame
    this.tracerGeoEnemy = new THREE.CylinderGeometry(0.075, 0.04, 6.5, 5); this.tracerGeoEnemy.rotateX(Math.PI / 2);
    this.tracerMatEnemy = new THREE.MeshBasicMaterial({ color: 0xff3b2e, fog: false });
    // one light for whichever fire is burning; it is in the scene from the start so the materials
    // never need recompiling when the first fire breaks out
    this.fireLight = new THREE.PointLight(0xff7a2a, 0, 140, 1.2); this.fireLight.castShadow = false; scene.add(this.fireLight);
    this._flTarget = 0;
    this.dcGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 10); this.dcGeo.rotateX(Math.PI / 2);
    this.dcMat = new THREE.MeshStandardMaterial({ color: 0x3b3f3a, roughness: 0.6 });
    this.splashMat = new THREE.MeshBasicMaterial({ color: 0xf2f6f8, transparent: true, opacity: 0.9, depthWrite: false });
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 1, depthWrite: false });
    this.smokeTex = makeSmokeTexture();
    this.smokeMat = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0x333333, transparent: true, opacity: 0.7, depthWrite: false });
    this.oilMat = new THREE.MeshBasicMaterial({ color: 0x0c0d0e, transparent: true, opacity: 0.55, depthWrite: false });
    this.depthSettings = [25, 50, 100];   // feet
    this.depthIdx = 0;
  }

  get depthSetting() { return this.depthSettings[this.depthIdx]; }
  cycleDepth() { this.depthIdx = (this.depthIdx + 1) % this.depthSettings.length; return this.depthSetting; }

  fireTracer(origin, dir, speed, enemy = false, spread = 0.012, owner = null) {
    const m = new THREE.Mesh(enemy ? this.tracerGeoEnemy : this.tracerGeo, enemy ? this.tracerMatEnemy : this.tracerMat);
    m.position.copy(origin);
    const d = dir.clone().normalize();
    d.x += (Math.random() - 0.5) * spread; d.y += (Math.random() - 0.5) * spread; d.z += (Math.random() - 0.5) * spread;
    d.normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    // a constant-pixel-size glow rides on every round so the stream stays visible out to its
    // full range from any camera, which is what makes aiming by tracer possible
    if (!this.tracerGlow) {
      this.tracerGlow = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xffd070, transparent: true, opacity: 0.95, sizeAttenuation: false, depthWrite: false, fog: false });
      this.tracerGlowEnemy = new THREE.SpriteMaterial({ map: makeDotTexture(), color: 0xffb0a0, transparent: true, opacity: 1, sizeAttenuation: false, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    }
    const glow = new THREE.Sprite(enemy ? this.tracerGlowEnemy : this.tracerGlow);
    if (enemy) { glow.scale.set(0.0075, 0.0075, 1); glow.position.z = 2.2; } else { glow.scale.set(0.024, 0.024, 1); glow.position.z = -1.5; }
    m.add(glow);
    this.scene.add(m);
    this.tracers.push({ mesh: m, vel: d.multiplyScalar(speed), life: 1.6, enemy, owner });
  }

  dropCharge(origin, vel, depthFt, owner = null) {
    const m = new THREE.Mesh(this.dcGeo, this.dcMat);
    m.position.copy(origin); m.castShadow = true;
    this.scene.add(m);
    this.charges.push({ mesh: m, vel: vel.clone(), depth: depthFt * 0.3048, phase: 'air', sink: 0, t: 0, owner });
    this.audio && this.audio.release();
  }

  splash(pos, size = 1) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1, 3, 24), this.splashMat.clone());
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 0.3, pos.z);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * size, 2.2 * size, 1, 12, 1, true), this.splashMat.clone());
    col.position.set(pos.x, 0.5, pos.z); col.material.side = THREE.DoubleSide;
    this.scene.add(ring, col);
    this.effects.push({ kind: 'splash', ring, col, t: 0, size, dur: 2.2 });
  }

  explosion(pos, size = 1, underwater = false) {
    if (underwater) {
      this.splash(pos, 2.5 * size);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4 * size, 16, 12), this.splashMat.clone());
      dome.position.set(pos.x, 0, pos.z); dome.scale.y = 0.45;
      this.scene.add(dome);
      this.effects.push({ kind: 'dome', mesh: dome, t: 0, size, dur: 2.5 });
      this.audio && this.audio.boom(0.9, true);
    } else {
      const flash = new THREE.Mesh(new THREE.SphereGeometry(3 * size, 12, 10), this.flashMat.clone());
      flash.position.copy(pos); this.scene.add(flash);
      this.effects.push({ kind: 'flash', mesh: flash, t: 0, size, dur: 0.5 });
      this.audio && this.audio.boom(1.0);
    }
    for (let i = 0; i < 6; i++) this.smoke(pos, size * 3, 4 + Math.random() * 3);
  }

  smoke(pos, size = 4, dur = 5, color = 0x333333) {
    const s = new THREE.Sprite(this.smokeMat.clone());
    s.material.color.setHex(color);
    s.position.set(pos.x + (Math.random() - 0.5) * size, pos.y + 1, pos.z + (Math.random() - 0.5) * size);
    s.scale.setScalar(size);
    this.scene.add(s);
    this.effects.push({ kind: 'smoke', mesh: s, t: 0, size, dur, rise: 1.5 + Math.random() });
  }

  // naval shell: a bright streak that flies flat to its aim point, then a splash or a hit
  shell(from, aim, onArrive) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 6), this.flashMat.clone());
    m.position.copy(from); this.scene.add(m);
    const dir = aim.clone().sub(from); const dist = dir.length(); dir.normalize();
    const speed = 320, tof = dist / speed;
    this.effects.push({ kind: 'shell', mesh: m, vel: dir.multiplyScalar(speed), t: 0, dur: tof, arc: tof * 4, onArrive, aim });
    // muzzle flash and smoke at the gun
    const fl = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), this.flashMat.clone()); fl.position.copy(from); this.scene.add(fl);
    this.effects.push({ kind: 'flash', mesh: fl, t: 0, size: 1, dur: 0.15 });
    this.smoke(from, 5, 3, 0x9a9a9a);
    this.audio && this.audio.burst(0.4, 90, 0.5, 0.4);
  }

  // impact sparks: a brief yellow flash with a grey puff
  spark(pos, size = 1) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.35 * size, 8, 6), this.flashMat.clone());
    flash.position.copy(pos); this.scene.add(flash);
    this.effects.push({ kind: 'flash', mesh: flash, t: 0, size, dur: 0.18 });
    this.smoke(pos, 1.2 * size, 1.2 + Math.random(), 0x777777);
  }
  // Fire. A burning vessel is built from four things drawn together: tongues of flame (tall,
  // narrow, white-yellow at the root going orange then dull red as they lick up and die), a column
  // of heavy black oil smoke that billows, spreads and leans downwind, sparks thrown up out of the
  // blaze, and a flickering orange light on the water and the hull.
  fire(pos) { this.flame(pos, 2.4); }
  flame(pos, size = 2.5) {
    if (!this.flameTex) this.flameTex = makeFlameTexture();
    const m = new THREE.SpriteMaterial({ map: this.flameTex, color: 0xffb060, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    const j = size * 0.35;
    s.position.set(pos.x + (Math.random() - 0.5) * j, pos.y + Math.random() * size * 0.2, pos.z + (Math.random() - 0.5) * j);
    s.center.set(0.5, 0.15);   // anchored near the root so the tongue grows upward
    this.scene.add(s);
    this.effects.push({ kind: 'flame', mesh: s, t: 0, size: size * (0.7 + Math.random() * 0.6), dur: 0.45 + Math.random() * 0.45, rise: 1.8 + Math.random() * 2.2, sway: (Math.random() - 0.5) * 1.6, ph: Math.random() * 6 });
  }
  blackSmoke(pos, size = 8) {
    if (!this.blackMat) this.blackMat = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0x1a1a1a, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(this.blackMat.clone());
    { const base = [0x121212, 0x1c1b1a, 0x2a2826][Math.floor(Math.random() * 3)]; s.userData.base = new THREE.Color(base); s.material.color.setHex(0x7a3c16); }
    s.material.rotation = Math.random() * Math.PI * 2;
    s.position.set(pos.x + (Math.random() - 0.5) * size * 0.3, pos.y + 1 + Math.random() * 1.5, pos.z + (Math.random() - 0.5) * size * 0.3);
    s.scale.setScalar(size * 0.35);
    this.scene.add(s);
    this.effects.push({ kind: 'blacksmoke', mesh: s, t: 0, size, dur: 9 + Math.random() * 5, rise: 6 + Math.random() * 3, spin: (Math.random() - 0.5) * 0.3, wob: Math.random() * 6 });
  }
  ember(pos) {
    if (!this.emberMat) this.emberMat = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xffb040, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(this.emberMat.clone()); s.position.copy(pos); s.scale.setScalar(0.35);
    this.scene.add(s);
    this.effects.push({ kind: 'ember', mesh: s, t: 0, dur: 1.2 + Math.random() * 1.2, vel: new THREE.Vector3((Math.random() - 0.5) * 4, 5 + Math.random() * 6, (Math.random() - 0.5) * 4) });
  }
  // a burning vessel asks for light each frame; the strongest ask wins and the light dies away
  // on its own when no one is burning
  fireGlow(pos, strength = 1) {
    if (strength >= this._flTarget) { this._flTarget = strength; this.fireLight.position.set(pos.x, pos.y + 4, pos.z); }
  }

  // bow spray / wash: short-lived white puffs thrown out and up, pulled back by gravity
  spray(pos, vel, size = 2, dur = 0.7) {
    if (!this.sprayMat) this.sprayMat = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xf4f7f8, transparent: true, opacity: 0.75, depthWrite: false });
    const s = new THREE.Sprite(this.sprayMat.clone());
    s.position.copy(pos); s.scale.setScalar(size);
    this.scene.add(s);
    this.effects.push({ kind: 'spray', mesh: s, vel: vel.clone(), t: 0, size, dur });
  }

  oilSlick(pos, size = 40, persistent = false) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(size, 24), this.oilMat.clone());
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.25, pos.z);
    this.scene.add(m);
    this.effects.push({ kind: 'oil', mesh: m, t: 0, size, dur: persistent ? 1e9 : 240, persistent });
    return m;
  }
  // air bubbles breaking the surface over a leaking boat: a ring that spreads and fades, with a
  // few white specks that rise and pop
  bubbles(pos, size = 1) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6 * size, 1.2 * size, 16), this.splashMat.clone());
    ring.material.opacity = 0.7; ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x + (Math.random() - 0.5) * 6, 0.25, pos.z + (Math.random() - 0.5) * 6);
    this.scene.add(ring);
    this.effects.push({ kind: 'bubble', mesh: ring, t: 0, size, dur: 1.6 + Math.random() });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(this.sprayMat ? this.sprayMat.clone() : new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xf4f7f8, transparent: true, opacity: 0.8, depthWrite: false }));
      s.position.set(ring.position.x + (Math.random() - 0.5) * 3, 0.4, ring.position.z + (Math.random() - 0.5) * 3); s.scale.setScalar(0.8 + Math.random() * 0.8);
      this.scene.add(s);
      this.effects.push({ kind: 'spray', mesh: s, vel: new THREE.Vector3(0, 0.6, 0), t: 0, size: 1, dur: 0.8 });
    }
  }

  update(dt, vessels, player, onHit, onDetonate, aircraft = []) {
    // tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.position.addScaledVector(t.vel, dt);
      t.vel.y -= 9.81 * dt * 0.3;
      let dead = t.life <= 0 || t.mesh.position.y < 0;
      if (t.mesh.position.y < 0 && t.life > 0) this.smallSplash(t.mesh.position);
      if (!dead) {
        if (t.enemy) {
          const dd = player ? player.obj.position.distanceTo(t.mesh.position) : 1e9;
          if (player && dd < 6) { onHit('player', 0.012); dead = true; }
          else if (player && !player.crashed && this.audio) {
            // a near miss: the round is heard as it goes past, on the side it passed
            if (t.minD == null || dd < t.minD) t.minD = dd;
            else if (!t.heard && t.minD < 18) {
              t.heard = true;
              const rel = t.mesh.position.clone().sub(player.obj.position);
              const side = player.right ? rel.dot(player.right(new THREE.Vector3())) / Math.max(1, rel.length()) : 0;
              this.audio.whiz(-side * 1.4, t.minD);   // Flight.right() is the model's +x, which is port on these +z-facing airframes, hence the minus
            }
          }
        } else {
          for (const v of vessels) {
            if (!v.alive) continue;
            const r = v.length * 0.5;
            if (Math.abs(t.mesh.position.y - v.group.position.y) < 12 && v.group.position.distanceTo(t.mesh.position) < r * 0.9) {
              onHit(v, 0.004 * (v.kind === 'submarine' ? 1 : v.kind === 'target' ? 1 : 0.3), t.mesh.position.clone());
              dead = true; break;
            }
          }
          if (!dead) for (const b of aircraft) {
            if (!b.alive) continue;
            if (b.group.position.distanceTo(t.mesh.position) < 7) { onHit(b, 0.07, t.mesh.position.clone()); dead = true; break; }
          }
        }
      }
      if (dead) { this.scene.remove(t.mesh); this.tracers.splice(i, 1); }
    }
    // depth charges
    for (let i = this.charges.length - 1; i >= 0; i--) {
      const c = this.charges[i];
      c.t += dt;
      if (c.phase === 'air') {
        c.vel.y -= 9.81 * dt;
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.rotation.x += dt * 0.8;
        if (c.mesh.position.y <= 0) {
          c.phase = 'water'; c.mesh.position.y = 0; this.splash(c.mesh.position, 1.4);
          this.audio && this.audio.splash();
          c.vel.set(c.vel.x * 0.2, 0, c.vel.z * 0.2);
        }
      } else {
        c.sink += 3.0 * dt;   // Mk VIII sank at roughly 10 ft/s
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.visible = false;
        if (c.sink >= c.depth) {
          this.explosion(new THREE.Vector3(c.mesh.position.x, 0, c.mesh.position.z), 1.2, true);
          if (onDetonate && !c.owner) onDetonate(new THREE.Vector3(c.mesh.position.x, 0, c.mesh.position.z), c.sink);
          // lethal radius (Mk VIII Torpex): ~6 m real; damage radius ~ 20 m. Game uses a wider band.
          for (const v of vessels) {
            if (!v.alive) continue;
            const d = Math.hypot(v.group.position.x - c.mesh.position.x, v.group.position.z - c.mesh.position.z);
            const dz = Math.abs((v.depth || 0) - c.sink);
            const along = d - v.length * 0.35;
            const rr = Math.max(0, along);
            const eff = Math.hypot(rr, dz * 0.6);
            if (eff < 12) onHit(v, 1.0, c.mesh.position.clone(), true, c.owner);
            else if (eff < 40) onHit(v, 0.45 * (1 - (eff - 12) / 28), c.mesh.position.clone(), true, c.owner);
          }
          this.scene.remove(c.mesh); this.charges.splice(i, 1);
        }
      }
    }
    // firelight
    {
      const target = this._flTarget > 0 ? this._flTarget * (160 + 90 * Math.random()) : 0;
      this.fireLight.intensity += (target - this.fireLight.intensity) * Math.min(1, dt * (target > this.fireLight.intensity ? 18 : 3));
      this._flTarget = 0;
    }
    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const k = e.t / e.dur;
      if (e.kind === 'splash') {
        e.ring.scale.setScalar(1 + k * 6 * e.size); e.ring.material.opacity = 0.9 * (1 - k);
        e.col.scale.y = 1 + Math.sin(Math.min(1, k * 2) * Math.PI) * 14 * e.size; e.col.position.y = e.col.scale.y * 0.5;
        e.col.material.opacity = 0.9 * (1 - k);
        if (k >= 1) { this.scene.remove(e.ring, e.col); this.effects.splice(i, 1); }
      } else if (e.kind === 'dome') {
        e.mesh.scale.set(1 + k * 3, 0.45 + k * 1.2, 1 + k * 3); e.mesh.material.opacity = 0.9 * (1 - k);
        if (k >= 1) { this.scene.remove(e.mesh); this.effects.splice(i, 1); }
      } else if (e.kind === 'flash') {
        e.mesh.scale.setScalar(1 + k * 2); e.mesh.material.opacity = 1 - k;
        if (k >= 1) { this.scene.remove(e.mesh); this.effects.splice(i, 1); }
      } else if (e.kind === 'flame') {
        const s = e.mesh;
        s.position.y += e.rise * dt * (1 + k);
        s.position.x += Math.sin(e.ph + e.t * 9) * e.sway * dt + 0.8 * dt;   // flicker, and a lean downwind
        // tall and narrow, swelling then thinning to a point as it burns out
        const w = e.size * (0.85 + 0.5 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5)) * (1 - 0.5 * k);
        s.scale.set(w, e.size * (1.25 + 0.9 * k), 1);
        // white-yellow at the root, orange, then dull red as it cools
        const c = s.material.color;
        if (k < 0.2) c.setRGB(1, 0.6 - k * 0.4, 0.2 - k * 0.6);
        else if (k < 0.55) c.setRGB(1, 0.52 - (k - 0.2) * 0.8, 0.06);
        else c.setRGB(0.85 - (k - 0.55) * 0.9, 0.3 - (k - 0.55) * 0.5, 0.04);
        s.material.opacity = Math.pow(1 - k, 1.1) * 0.7 * (0.8 + 0.2 * Math.sin(e.t * 40 + e.ph));
        if (k >= 1) { this.scene.remove(s); s.material.dispose(); this.effects.splice(i, 1); }
      } else if (e.kind === 'blacksmoke') {
        const s = e.mesh;
        s.position.y += e.rise * dt * Math.max(0.15, 1 - 1.2 * k);            // hot at the base, slowing as it cools
        s.position.x += ((1.2 + k * 4) + Math.sin(e.wob + e.t * 0.8) * 0.8) * dt; s.position.z += (0.5 + Math.cos(e.wob + e.t * 0.6) * 0.6) * dt;   // leaning and curling downwind
        s.scale.setScalar(e.size * (0.35 + 3.4 * Math.pow(k, 0.6)));
        s.material.rotation += e.spin * dt;
        // underlit by the blaze while it is low, then plain black oil smoke
        s.material.color.lerpColors(_fireTint, s.userData.base, Math.min(1, k * 5));
        s.material.opacity = (k < 0.05 ? k / 0.05 : Math.pow(1 - (k - 0.05) / 0.95, 1.6)) * 0.62;
        if (k >= 1) { this.scene.remove(s); s.material.dispose(); this.effects.splice(i, 1); }
      } else if (e.kind === 'ember') {
        e.vel.y -= 4 * dt; e.vel.multiplyScalar(1 - 0.6 * dt);
        e.mesh.position.addScaledVector(e.vel, dt);
        e.mesh.material.opacity = (1 - k) * (0.6 + 0.4 * Math.sin(e.t * 30));
        if (k >= 1 || e.mesh.position.y < 0) { this.scene.remove(e.mesh); e.mesh.material.dispose(); this.effects.splice(i, 1); }
      } else if (e.kind === 'smoke') {
        e.mesh.position.y += e.rise * dt; e.mesh.scale.setScalar(e.size * (1 + k * 2)); e.mesh.material.opacity = 0.7 * (1 - k);
        if (k >= 1) { this.scene.remove(e.mesh); this.effects.splice(i, 1); }
      } else if (e.kind === 'shell') {
        e.mesh.position.addScaledVector(e.vel, dt);
        e.mesh.position.y += (Math.sin(k * Math.PI)) * e.arc * dt;   // a shallow arc
        if (k >= 1) { this.scene.remove(e.mesh); this.effects.splice(i, 1); e.onArrive && e.onArrive(e.aim); }
      } else if (e.kind === 'spray') {
        e.vel.y -= 9.81 * dt; e.mesh.position.addScaledVector(e.vel, dt);
        if (e.mesh.position.y < 0) e.mesh.position.y = 0;
        e.mesh.scale.setScalar(e.size * (1 + k * 1.5)); e.mesh.material.opacity = 0.75 * (1 - k);
        if (k >= 1) { this.scene.remove(e.mesh); this.effects.splice(i, 1); }
      } else if (e.kind === 'oil') {
        if (e.persistent) { e.mesh.scale.setScalar(1 + Math.min(1.5, e.t / 240)); }
        else { e.mesh.scale.setScalar(1 + k * 3); e.mesh.material.opacity = 0.55 * (1 - k); if (k >= 1) { this.scene.remove(e.mesh); this.effects.splice(i, 1); } }
      } else if (e.kind === 'bubble') {
        e.mesh.scale.setScalar(1 + k * 2.5); e.mesh.material.opacity = 0.7 * (1 - k);
        if (k >= 1) { this.scene.remove(e.mesh); this.effects.splice(i, 1); }
      }
    }
  }

  smallSplash(pos) {
    if (Math.random() > 0.3) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.8, 10), this.splashMat.clone());
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 0.2, pos.z);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 1, 6, 1, true), this.splashMat.clone());
    col.position.set(pos.x, 0.4, pos.z);
    this.scene.add(ring, col);
    this.effects.push({ kind: 'splash', ring, col, t: 0, size: 0.15, dur: 0.7 });
  }
}

const _fireTint = new THREE.Color(0x7a3c16);
// a flame tongue: a soft teardrop, hot and dense at the root, frayed and thin toward the tip
function makeFlameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  const img = x.createImageData(64, 128);
  for (let py = 0; py < 128; py++) {
    const v = 1 - py / 127;                       // 0 at the root (bottom), 1 at the tip
    const halfW = 0.95 * Math.pow(1 - v, 0.55) * (1 - 0.18 * Math.sin(v * 9));
    for (let px = 0; px < 64; px++) {
      const u = (px - 31.5) / 32;
      const edge = Math.abs(u) / Math.max(0.02, halfW);
      let a = Math.exp(-edge * edge * 2.2) * Math.pow(1 - v, 0.5) * Math.min(1, (1 - edge) * 3 + 0.2);
      a *= 0.75 + 0.25 * Math.sin(py * 0.45 + Math.sin(px * 0.3) * 2);
      const i = (py * 64 + px) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a tight point of light for incoming tracer: a bright core with almost no halo
function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.8)'); g.addColorStop(0.55, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeSmokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
