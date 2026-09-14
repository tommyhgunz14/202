import * as THREE from 'three';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// Tracer rounds, depth charges / A-S bombs, splashes, explosions, smoke and oil.
const _wr = new THREE.Vector3(), _ww = new THREE.Vector3(), _wf = new THREE.Vector3(), _wm = new THREE.Vector3();

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
    this.foamMat = new THREE.MeshBasicMaterial({ map: makeFoamTexture(), color: 0xf4f8fa, transparent: true, opacity: 0.9, depthWrite: false });
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
    // a ship's flak is drawn slower than it flew (so it can be followed), so it is given the time
    // to reach the ranges her gunners open fire at; it would otherwise burn out half-way
    this.tracers.push({ mesh: m, vel: d.multiplyScalar(speed), life: enemy && speed < 400 ? 4.6 : 1.6, enemy, owner });
  }

  dropCharge(origin, vel, depthFt, owner = null) {
    const m = new THREE.Mesh(this.dcGeo, this.dcMat);
    m.position.copy(origin); m.castShadow = true;
    this.scene.add(m);
    const c = { mesh: m, vel: vel.clone(), depth: depthFt * 0.3048, phase: 'air', sink: 0, t: 0, owner };
    this.charges.push(c);
    this.audio && this.audio.release();
    return c;
  }

  // something going into the water: a burst of spray thrown up and falling back, and a patch of
  // foam spreading where it went in
  splash(pos, size = 1) {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.foamMat.clone());
    ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.random() * 6.28; ring.position.set(pos.x, 0.3, pos.z);
    this.scene.add(ring);
    this.effects.push({ kind: 'splash', ring, t: 0, size, dur: 3 });
    if (!this.plumeMat) this.plumeMat = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xf6f9fa, transparent: true, opacity: 0.85, depthWrite: false });
    const n = Math.round(6 + 5 * size);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.plumeMat.clone());
      const a = Math.random() * Math.PI * 2, out = (0.6 + Math.random() * 2) * size;
      s.position.set(pos.x + Math.cos(a) * 0.6 * size, 0.6, pos.z + Math.sin(a) * 0.6 * size);
      const sz = (0.9 + Math.random() * 1.1) * size; s.scale.set(sz, sz * 1.6, 1);
      this.scene.add(s);
      this.effects.push({ kind: 'plume', mesh: s, vel: new THREE.Vector3(Math.cos(a) * out, (4 + Math.random() * 6) * Math.sqrt(size), Math.sin(a) * out), t: 0, size: sz, dur: 1.3 + Math.random() * 0.9 });
    }
  }

  explosion(pos, size = 1, underwater = false, depthM = 10) {
    if (underwater) {
      this.waterSpout(pos, size, depthM);
      this.audio && this.audio.boom(0.9, true);
      return;
    } else {
      const flash = new THREE.Mesh(new THREE.SphereGeometry(3 * size, 12, 10), this.flashMat.clone());
      flash.position.copy(pos); this.scene.add(flash);
      this.effects.push({ kind: 'flash', mesh: flash, t: 0, size, dur: 0.5 });
      this.audio && this.audio.boom(1.0);
    }
    for (let i = 0; i < 6; i++) this.smoke(pos, size * 3, 4 + Math.random() * 3);
  }

  // the plume thrown up by a charge going off under the surface: a column of white water that
  // climbs, hangs and falls back, highest from a shallow setting (a Mk VII at 50 ft threw one
  // to roughly a hundred feet), with a drifting mist left at its foot
  waterSpout(pos, size = 1, depthM = 10) {
    const hf = Math.max(0.45, Math.min(1.2, 1.25 - depthM / 40)) * size;
    if (!this.plumeMat) this.plumeMat = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xf6f9fa, transparent: true, opacity: 0.85, depthWrite: false });
    // the sea heaves up in a white dome over the burst...
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7 * size * hf + 3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.splashMat.clone());
    dome.position.set(pos.x, 0, pos.z); dome.scale.y = 0.05;
    this.scene.add(dome);
    this.effects.push({ kind: 'dome', mesh: dome, t: 0, size, dur: 1.3 });
    // ...and breaks into a column of spray: a dense core thrown straight up, a looser skirt
    // thrown outward, each puff stretched tall while it climbs and slumping as it falls back
    const spouts = 64;
    for (let i = 0; i < spouts; i++) {
      const core = i < spouts * 0.55;
      const s = new THREE.Sprite(this.plumeMat.clone());
      const a = Math.random() * Math.PI * 2, r = Math.random() * (core ? 2 : 5) * size;
      s.position.set(pos.x + Math.cos(a) * r, 0.5, pos.z + Math.sin(a) * r);
      const out = core ? 0.5 + Math.random() * 1.5 : 3 + Math.random() * 5;
      const up = (core ? 13 + Math.random() * 17 : 6 + Math.random() * 9) * Math.sqrt(hf);
      const sz = (core ? 3.5 + Math.random() * 3.5 : 4 + Math.random() * 5) * size;
      s.scale.set(sz, sz * 2, 1);
      this.scene.add(s);
      this.effects.push({ kind: 'plume', mesh: s, vel: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out), t: -0.15 - Math.random() * (core ? 0.7 : 0.35), size: sz, dur: 3.2 + Math.random() * 1.6 });
      s.visible = false;
    }
    // falling mist drifting off the foot of the column, and a white slick of churned water left behind
    for (let i = 0; i < 6; i++) this.smoke(new THREE.Vector3(pos.x, 0, pos.z), 9 * size * hf + 5, 5 + Math.random() * 3, 0xe8eef0);
    const slick = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.foamMat.clone()); slick.rotation.z = Math.random() * 6.28;
    slick.rotation.x = -Math.PI / 2; slick.position.set(pos.x, 0.22, pos.z);
    this.scene.add(slick);
    this.effects.push({ kind: 'slick', mesh: slick, t: 0, size: (16 + 10 * hf) * size, dur: 14 });
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
          else if (player && !player.crashed && this.audio && !t.heard && dd < 400) {
            // a near miss: the round is heard as it goes past, on the side it passed. The closest
            // approach is solved over the step (relative to the moving aircraft) so a fast round
            // that jumps past between frames is not missed
            const rel = _wr.copy(t.mesh.position).sub(player.obj.position);
            const w = _ww.copy(t.vel).addScaledVector(player.forward(_wf), -(player.speed || 0));
            const tc = -rel.dot(w) / Math.max(1e-6, w.lengthSq());
            if (tc <= 0 || tc < dt) {
              const miss = _wm.copy(rel).addScaledVector(w, Math.max(0, tc));
              const md = miss.length();
              t.heard = true;
              if (md < 30) {
                const side = miss.dot(player.right(_wf)) / Math.max(1, md);
                this.audio.whiz(-side * 1.4, md, t.vel.lengthSq() < 400 * 400);   // Flight.right() is the model's +x, which is port on these +z-facing airframes, hence the minus
              }
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
          this.explosion(new THREE.Vector3(c.mesh.position.x, 0, c.mesh.position.z), 1.2, true, c.depth);
          c.detonated = true;
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
        e.ring.scale.setScalar(e.size * (1.5 + 4 * Math.sqrt(k))); e.ring.material.opacity = 0.85 * (1 - k);
        if (k >= 1) { this.scene.remove(e.ring); e.ring.material.dispose(); this.effects.splice(i, 1); }
      } else if (e.kind === 'dome') {
        e.mesh.scale.set(1 + k * 0.8, Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 0.7 * (1 - 0.6 * k) + 0.05, 1 + k * 0.8); e.mesh.material.opacity = 0.95 * (1 - k * k);
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
      } else if (e.kind === 'plume') {
        if (e.t < 0) continue;   // held back a moment: the dome lifts before the column breaks through
        const s = e.mesh; s.visible = true;
        e.vel.y -= 9.81 * dt; e.vel.x *= 1 - 0.8 * dt; e.vel.z *= 1 - 0.8 * dt;
        s.position.addScaledVector(e.vel, dt);
        if (s.position.y < 1) { s.position.y = 1; e.vel.y = 0; }
        const rising = e.vel.y > 0 ? Math.min(1, e.vel.y / 12) : 0;
        s.scale.set(e.size * (1.1 + k * 2), e.size * (1.1 + k * 1.4 + rising * 0.7), 1);
        s.material.opacity = 0.85 * (k < 0.08 ? k / 0.08 : Math.pow(1 - (k - 0.08) / 0.92, 1.3));
        if (k >= 1) { this.scene.remove(s); s.material.dispose(); this.effects.splice(i, 1); }
      } else if (e.kind === 'slick') {
        e.mesh.scale.setScalar(e.size * (0.35 + 0.65 * Math.min(1, e.t / 3)) * (1 + k * 0.4));
        e.mesh.material.opacity = 0.8 * (e.t < 0.8 ? e.t / 0.8 : Math.pow(1 - k, 1.5));
        if (k >= 1) { this.scene.remove(e.mesh); e.mesh.material.dispose(); this.effects.splice(i, 1); }
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
// churned white water: a soft-edged disc, mottled so it does not read as a plate
function makeFoamTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.7) * 44, px = 64 + Math.cos(a) * r, py = 64 + Math.sin(a) * r, rad = 6 + Math.random() * 16;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const al = 0.25 + 0.35 * (1 - r / 50);
    g.addColorStop(0, 'rgba(255,255,255,' + al.toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  // fade the whole patch to nothing at its rim
  x.globalCompositeOperation = 'destination-in';
  const m = x.createRadialGradient(64, 64, 0, 64, 64, 63);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,0.85)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
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
