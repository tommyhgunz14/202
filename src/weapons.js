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
    this.tracerMatEnemy = new THREE.MeshBasicMaterial({ color: 0xff5a3a, fog: false });
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
    const m = new THREE.Mesh(this.tracerGeo, enemy ? this.tracerMatEnemy : this.tracerMat);
    m.position.copy(origin);
    const d = dir.clone().normalize();
    d.x += (Math.random() - 0.5) * spread; d.y += (Math.random() - 0.5) * spread; d.z += (Math.random() - 0.5) * spread;
    d.normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    // a constant-pixel-size glow rides on every round so the stream stays visible out to its
    // full range from any camera, which is what makes aiming by tracer possible
    if (!this.tracerGlow) { this.tracerGlow = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xffd070, transparent: true, opacity: 0.95, sizeAttenuation: false, depthWrite: false, fog: false }); this.tracerGlowEnemy = this.tracerGlow.clone(); this.tracerGlowEnemy.color.set(0xff6a4a); }
    const glow = new THREE.Sprite(enemy ? this.tracerGlowEnemy : this.tracerGlow); glow.scale.set(0.024, 0.024, 1); glow.position.z = -1.5; m.add(glow);
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
  // fire: an orange-yellow sprite that flickers upward
  fire(pos) {
    if (!this.fireMat) this.fireMat = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xffa030, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(this.fireMat.clone()); s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)); s.scale.setScalar(3 + Math.random() * 2);
    this.scene.add(s);
    this.effects.push({ kind: 'smoke', mesh: s, t: 0, size: 3, dur: 0.6 + Math.random() * 0.4, rise: 3 });
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
          if (player && player.obj.position.distanceTo(t.mesh.position) < 6) { onHit('player', 0.012); dead = true; }
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

function makeSmokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
