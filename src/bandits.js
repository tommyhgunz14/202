import * as THREE from 'three';
import { loadOrPlaceholder, findAllNamed, findNamed } from './loader.js?v=202609171221';
import { toWorld } from './config.js?v=202609171221';

// Vichy fighters. Curtiss H-75s of GC I/5 flew from Rabat and Casablanca and were the aircraft
// most likely to be met over the Moroccan side of the Strait; the squadron record notes attacks
// by French aircraft on 14 September 1940, 29 January 1941 and 18 May 1942. A bandit arrives from
// the south, makes up to three firing passes from astern or the beam, then breaks for home. It
// can be driven off or shot down by the crew gunners or by the player at a gun position.
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

export class Bandit {
  constructor(group, name) {
    this.group = group; this.name = name;
    this.speed = 105; this.hp = 1; this.alive = true; this.state = 'approach'; this.t = 0;
    this.passes = 0; this.fireTimer = 0; this.stateT = 0; this.turnRate = 0.55; this.bank = 0;
    this.props = findAllNamed(group, 'prop'); this.gun = findNamed(group, 'gun_nose');
    this.dying = 0; this.smokeT = 0;
    this.heading = 0; this.pitch = 0;
    this.kind = 'aircraft'; this.faction = 'vichy';
  }
  get position() { return this.group.position; }

  steerToward(target, dt, altOffset = 0) {
    const g = this.group;
    const dx = target.x - g.position.x, dz = target.z - g.position.z;
    const des = Math.atan2(dx, dz);
    let d = des - this.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const turn = THREE.MathUtils.clamp(d, -this.turnRate * dt, this.turnRate * dt);
    this.heading += turn;
    this.bank += ((turn / dt) / this.turnRate * 0.9 - this.bank) * Math.min(1, dt * 3);
    const dy = target.y + altOffset - g.position.y;
    const desPitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz) + 1), -0.45, 0.45);
    this.pitch += (desPitch - this.pitch) * Math.min(1, dt * 1.5);
    return Math.abs(d);
  }

  update(dt, ctx) {
    const g = this.group;
    // a bandit sent after another aircraft goes for her while she lasts, then for you
    const p = this.target && this.target.alive && !this.target.remove ? this.target : ctx.player;
    this.t += dt; this.stateT += dt;
    for (const pr of this.props) pr.rotation.z += dt * 70;
    if (!this.alive) {
      this.dying += dt;
      this.pitch = Math.max(-1.1, this.pitch - dt * 0.5); this.bank += dt * 1.2;
      this.heading += dt * 0.8;
      this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.08; ctx.weapons.smoke(g.position, 6, 3, 0x222222); }
      g.position.x += Math.sin(this.heading) * Math.cos(this.pitch) * this.speed * dt;
      g.position.z += Math.cos(this.heading) * Math.cos(this.pitch) * this.speed * dt;
      g.position.y += Math.sin(this.pitch) * this.speed * dt;
      if (g.position.y <= 0) { ctx.weapons.explosion(g.position.clone().setY(0), 1.5, true); this.remove = true; }
      g.rotation.set(0, 0, 0); g.rotateY(this.heading); g.rotateX(-this.pitch); g.rotateZ(-this.bank);   // a turn to the left (heading increasing, nose toward +x) lowers the +x wing
      return;
    }
    const pp = p.obj.position;
    const dist = Math.hypot(pp.x - g.position.x, pp.z - g.position.z);
    if (this.state === 'approach') {
      // come in from astern-quarter, a little above
      const back = p.forward(_v).clone().multiplyScalar(-900).add(pp); back.y = pp.y + 120;
      this.steerToward(back, dt);
      if (dist < 1100 && this.stateT > 4) { this.state = 'attack'; this.stateT = 0; }
    } else if (this.state === 'attack') {
      const lead = pp.clone().addScaledVector(p.forward(_v), p.speed * 0.9);
      const off = this.steerToward(lead, dt);
      this.fireTimer -= dt;
      if (dist < 750 && dist > 120 && off < 0.14 && this.fireTimer <= 0 && this.stateT > 0.5) {
        this.fireTimer = 0.09;
        const from = new THREE.Vector3(); (this.gun || g).getWorldPosition(from);
        const dir = lead.clone().sub(from).normalize();
        ctx.weapons.fireTracer(from, dir, 720, true, 0.014, this);
        if (p.friendly && Math.random() < 0.06) p.damage(0.02, ctx);
        if (Math.random() < 0.2) ctx.audio.enemyGun();
      }
      if (dist < 130 || this.stateT > 12) { this.state = 'break'; this.stateT = 0; this.passes++; ctx.log(`${this.name} breaks away.`); }
    } else if (this.state === 'break') {
      const away = new THREE.Vector3(g.position.x + Math.sin(this.heading + 1.2) * 1500, pp.y + 250, g.position.z + Math.cos(this.heading + 1.2) * 1500);
      this.steerToward(away, dt);
      if (this.stateT > 7) { this.state = this.passes >= 3 || this.hp < 0.45 ? 'leave' : 'approach'; this.stateT = 0; if (this.state === 'leave') ctx.log(`${this.name} heading for home.`); }
    } else if (this.state === 'leave') {
      const home = toWorld(35.6, -5.3); this.steerToward(new THREE.Vector3(home.x, 400, home.z), dt);
      if (dist > 9000) this.remove = true;
    }
    g.position.x += Math.sin(this.heading) * Math.cos(this.pitch) * this.speed * dt;
    g.position.z += Math.cos(this.heading) * Math.cos(this.pitch) * this.speed * dt;
    g.position.y += Math.sin(this.pitch) * this.speed * dt;
    if (g.position.y < 30) { g.position.y = 30; this.pitch = Math.max(0, this.pitch); }
    g.rotation.set(0, 0, 0); g.rotateY(this.heading); g.rotateX(-this.pitch); g.rotateZ(-this.bank);   // a turn to the left (heading increasing, nose toward +x) lowers the +x wing
    if (this.hp < 0.6) { this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.2; ctx.weapons.smoke(g.position, 3, 2, 0x3a3a3a); } }
  }

  damage(amount, ctx) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) { this.alive = false; ctx.log(`${this.name} shot down!`, 'ok'); ctx.weapons.explosion(this.group.position.clone(), 0.8, false); }
  }
}

export async function spawnBandit(player, name = 'Vichy Curtiss H-75', fromBearingDeg = 180) {
  const g = await loadOrPlaceholder('assets/vichy_h75.js', 8.8, 11.4, 'aircraft');
  const pp = player.obj.position;
  const a = fromBearingDeg * Math.PI / 180;
  g.position.set(pp.x + Math.sin(a) * 4500, pp.y + 300, pp.z - Math.cos(a) * 4500);
  const b = new Bandit(g, name);
  b.heading = Math.atan2(pp.x - g.position.x, pp.z - g.position.z);
  return b;
}
