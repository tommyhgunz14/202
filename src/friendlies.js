import * as THREE from 'three';
import { loadOrPlaceholder, findAllNamed } from './loader.js';
import { toWorld, KT, MPH } from './config.js';
import { AIRCRAFT } from './data/aircraft.js';
import { terrainHeight } from './world/terrain.js';

// Other aircraft on your side: the squadron machine whose sortie it really was, or the US Navy
// Catalinas working the Strait in 1944. They fly a script written into the mission, one step at a
// time: form up on you, go somewhere, orbit, make a depth-charge attack, alight beside a boat,
// wait on the water, take off, go home. The player's part in these sorties is to support them.
//
// A step:  { do, at?, lat?, lon?, alt?, radius?, until?, log?, acts?, then?, flag? }
//   do      form | goto | orbit | attack | alight | wait | takeoff | home | leave
//   at      name of a vessel (or another friendly) the step is about
//   until   a condition (see cond() in main.js); for form/orbit/wait the step ends when it holds
//   log     radio message when the step starts; acts: script actions run at the start
//   then    actions run when the step completes; flag: a flag raised when it completes
// Attack options: charges (6), depth (ft, 25), attackAlt (m, 245 = 800 ft), runLog/runActs (as the run begins),
//   dropLog (stick away),
//   leave (hp the target is left with by this aircraft's stick: history decides, not the dice)

const _v = new THREE.Vector3();

export class Friendly {
  constructor(group, opts, spec) {
    this.group = group; this.opts = opts; this.spec = spec;
    this.name = opts.name; this.short = opts.short || opts.name; this.pilot = opts.pilot || '';
    this.kind = 'aircraft'; this.friendly = true; this.faction = opts.faction || 'raf';
    this.alive = true; this.hp = 1; this.mortal = !!opts.mortal; this.remove = false;
    this.cruise = (opts.cruise || spec.cruise) / MPH; this.stall = spec.stall / MPH;
    this.speed = this.cruise; this.heading = 0; this.pitch = 0; this.bank = 0;
    this.turnRate = 0.22; this.onWater = false; this.crashed = false;
    this.steps = opts.script || []; this.idx = -1; this.stepT = 0; this.phase = null;
    this.props = findAllNamed(group, 'prop');
    this.smokeT = 0; this.dropT = 0; this.dropped = 0; this.bob = Math.random() * 6;
  }
  get obj() { return this.group; }
  get position() { return this.group.position; }
  get step() { return this.steps[this.idx]; }
  forward(v) { return v.set(Math.sin(this.heading) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.heading) * Math.cos(this.pitch)); }

  // the hp a vessel may be left with by this aircraft's charges while an attack step runs
  floorFor(v) { const s = this.step; return s && s.do === 'attack' && s.leave != null && s.at === v.name ? s.leave : 0; }

  next(ctx, skipThen = false) {
    const s = this.step;
    if (s && !skipThen) { if (s.then) ctx.acts(s.then); if (s.flag) ctx.flag(s.flag); }
    this.idx++; this.stepT = 0; this.phase = null; this.aPhase = null; this.dropped = 0; this.forced = false;
    let n = this.step;
    // an attack on a boat that has already gone is dropped, radio call and all
    while (n && n.do === 'attack' && !(ctx.named(n.at) && ctx.named(n.at).alive)) { this.idx++; n = this.step; }
    if (!n) return;
    if (n.log) ctx.log(n.log, n.cls || 'ok');
    if (n.acts) ctx.acts(n.acts);
  }

  steer(target, dt, rate = this.turnRate) {
    const g = this.group.position;
    const dx = target.x - g.x, dz = target.z - g.z;
    let d = Math.atan2(dx, dz) - this.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const turn = THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
    this.heading += turn;
    this.bank += ((turn / dt) / rate * 0.55 - this.bank) * Math.min(1, dt * 2);
    const dy = target.y - g.y;
    const want = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz) + 200), -0.16, 0.16);
    this.pitch += (want - this.pitch) * Math.min(1, dt * 1.2);
    return { off: Math.abs(d), dist: Math.hypot(dx, dz) };
  }

  update(dt, ctx) {
    const g = this.group;
    this.stepT += dt;
    for (const pr of this.props) pr.rotation.z += dt * (this.onWater && this.speed < 1 ? 25 : 60);
    if (!this.alive) {
      // going in: nose down, a long trail of smoke, a splash
      this.pitch = Math.max(-0.7, this.pitch - dt * 0.25); this.bank += dt * 0.6; this.heading += dt * 0.2;
      this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.1; ctx.weapons.smoke(g.position, 8, 4, 0x1c1c1c); }
      this.move(dt);
      if (g.position.y <= 0) { ctx.weapons.explosion(g.position.clone().setY(0), 1.6, true); this.remove = true; }
      this.pose();
      return;
    }
    if (this.idx < 0) this.next(ctx);
    const s = this.step, p = ctx.player;
    const pp = p.obj.position;
    if (!s) { this.orbit(dt, g.position.clone(), 900, 450); }
    else if (s.do === 'form') {
      // off the player's quarter, a little stepped down
      const fwd = p.forward(_v).setY(0).normalize();
      const side = s.side || 1;
      const goal = pp.clone().addScaledVector(fwd, -140).add(new THREE.Vector3(fwd.z * 160 * side, 0, -fwd.x * 160 * side));
      goal.y = Math.max(120, pp.y - 25);
      const { dist } = this.steer(goal.addScaledVector(fwd, 300), dt, 0.3);
      const want = p.onWater ? this.cruise : THREE.MathUtils.clamp(p.speed + (dist - 300) * 0.02, this.stall * 1.2, this.cruise * 1.35);
      this.speed += (want - this.speed) * Math.min(1, dt * 0.5);
      if (ctx.cond(s.until, this)) this.next(ctx);
    } else if (s.do === 'goto') {
      const t = this.where(s, ctx);
      const { dist } = this.steer(t.setY(s.alt || 450), dt);
      this.cruiseSpeed(dt);
      if ((s.until ? ctx.cond(s.until, this) : dist < 700)) this.next(ctx);
    } else if (s.do === 'orbit') {
      this.orbit(dt, this.where(s, ctx), s.radius || 1200, s.alt || 450);
      if (ctx.cond(s.until, this)) this.next(ctx);
    } else if (s.do === 'attack') this.attack(dt, ctx, s);
    else if (s.do === 'alight') this.alight(dt, ctx, s);
    else if (s.do === 'wait') {
      if (this.onWater) this.float(dt, ctx, s);
      else this.orbit(dt, this.where(s, ctx), s.radius || 1000, s.alt || 400);
      if (ctx.cond(s.until, this)) this.next(ctx);
    } else if (s.do === 'takeoff') this.takeoff(dt, ctx, s);
    else if (s.do === 'home') this.home(dt, ctx, s);
    else if (s.do === 'leave') {
      // away to another base: out of sight, then gone
      const w = toWorld(s.lat, s.lon);
      this.steer(new THREE.Vector3(w.x, s.alt || 450, w.z), dt); this.cruiseSpeed(dt);
      if (g.position.distanceTo(pp) > 9000) this.remove = true;
    }
    if (!this.onWater) this.move(dt);
    const landing = s && (s.do === 'alight' || (s.do === 'home' && this.phase === 'land'));
    if (!this.onWater && !landing) {
      // keep clear of the Rock and the Spanish hills: climb over anything within 120 m below
      const ahead = Math.max(terrainHeight(g.position.x, g.position.z), terrainHeight(g.position.x + Math.sin(this.heading) * 900, g.position.z + Math.cos(this.heading) * 900));
      const floor = Math.max(25, ahead + 120);
      if (g.position.y < floor) { g.position.y += Math.min(floor - g.position.y, 12 * dt); this.pitch = Math.max(0.05, this.pitch); }
    }
    this.pose();
    if (this.hp < 0.65) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.18;
        // port engine: the left of the aircraft is +x in its own frame (models face +z)
        const e = new THREE.Vector3(this.spec.id === 'sunderland' ? 7 : 3.2, 2.2, 1).applyQuaternion(g.quaternion).add(g.position);
        ctx.weapons.smoke(e, 3, 2.5, 0x2e2e2e);
      }
    }
  }

  where(s, ctx) {
    if (s.at) { const t = ctx.named(s.at); if (t) return t.group.position.clone(); }
    if (s.lat != null) { const w = toWorld(s.lat, s.lon); return new THREE.Vector3(w.x, 0, w.z); }
    return this.group.position.clone();
  }
  cruiseSpeed(dt) { this.speed += (this.cruise - this.speed) * Math.min(1, dt * 0.4); }
  move(dt) {
    const g = this.group.position;
    g.x += Math.sin(this.heading) * Math.cos(this.pitch) * this.speed * dt;
    g.z += Math.cos(this.heading) * Math.cos(this.pitch) * this.speed * dt;
    g.y += Math.sin(this.pitch) * this.speed * dt;
  }
  pose() {
    const g = this.group;
    g.rotation.set(0, 0, 0); g.rotateY(this.heading); g.rotateX(-this.pitch); g.rotateZ(-this.bank);   // a turn to the left (heading increasing, nose toward +x) lowers the +x wing
  }
  orbit(dt, c, radius, alt) {
    const g = this.group.position;
    const a = Math.atan2(g.x - c.x, g.z - c.z) + 0.35;   // lead point a little way round the circle
    this.steer(new THREE.Vector3(c.x + Math.sin(a) * radius, alt, c.z + Math.cos(a) * radius), dt, 0.3);
    this.cruiseSpeed(dt);
  }

  // Attack from astern along the target's track: set up 3 km behind her, run in at attack height,
  // release a stick spaced across her, pull away ahead and climb.
  attack(dt, ctx, s) {
    const t = ctx.named(s.at); const g = this.group.position;
    if (!t || !t.alive) { this.next(ctx, true); return; }   // she has gone: nothing of this attack is reported
    const tp = t.group.position, th = t.heading;
    const back = new THREE.Vector3(-Math.sin(th), 0, -Math.cos(th));
    const alt = s.attackAlt || 245;
    const n = s.charges || 6, spacing = 11;
    if (!this.phase) this.phase = 'setup';
    if (this.phase === 'setup') {
      const sp = tp.clone().addScaledVector(back, 2200); sp.y = alt + 60;
      const { dist } = this.steer(sp, dt, 0.28); this.cruiseSpeed(dt);
      if (dist < 650 || this.stepT > 70) { this.phase = 'run'; if (s.runLog) ctx.log(s.runLog, s.runCls || 'ok'); if (s.runActs) ctx.acts(s.runActs); }
    } else if (this.phase === 'run') {
      const lead = tp.clone().addScaledVector(back, -t.speedKt / KT * 2); lead.y = alt;
      this.steer(lead, dt, 0.3);
      this.speed += (this.cruise * 1.12 - this.speed) * Math.min(1, dt * 0.5);
      // release so the middle of the stick falls on her: charges carry forward about v·√(2h/g)
      const fall = Math.sqrt(2 * Math.max(10, g.y) / 9.81) * this.speed;
      const along = (tp.x - g.x) * Math.sin(this.heading) + (tp.z - g.z) * Math.cos(this.heading);
      const cross = Math.abs((tp.x - g.x) * Math.cos(this.heading) - (tp.z - g.z) * Math.sin(this.heading));
      if (along < fall + spacing * n * 0.5 && cross < 140) { this.phase = 'drop'; this.dropT = 0; }
      if (along < -200) { this.phase = 'setup'; this.stepT = 0; }
    } else if (this.phase === 'drop') {
      this.dropT -= dt;
      if (this.dropT <= 0 && this.dropped < n) {
        this.dropT = spacing / this.speed; this.dropped++;
        const o = g.clone(); o.y -= 2;
        ctx.weapons.dropCharge(o, this.forward(_v).clone().multiplyScalar(this.speed), s.depth || 25, this);
      }
      if (this.dropped >= n) { this.phase = 'away'; this.awayT = 0; if (s.dropLog) ctx.log(s.dropLog, 'ok'); }
      this.steer(g.clone().addScaledVector(this.forward(_v).setY(0), 800).setY(alt), dt);
    } else if (this.phase === 'away') {
      this.awayT += dt;
      this.steer(g.clone().addScaledVector(this.forward(_v).setY(0).normalize(), 1500).setY(alt + 250), dt, 0.15);
      this.cruiseSpeed(dt);
      if (this.awayT > 5 && s.leave != null && !this.forced && t.alive && t.hp > s.leave + 0.01) {
        // the stick did what the record says it did, whatever the dice made of it
        this.forced = true; t.damage(t.hp - s.leave, ctx, t.group.position.clone().setY(2));
      }
      if (this.awayT > 15) this.next(ctx);   // the last charges are still sinking until now
    }
  }

  // Alight beside a boat: approach from 3 km out into wind (here simply along a line past her),
  // glide down, touch, run off speed and taxi up to lie about 80 m off her beam.
  alight(dt, ctx, s) {
    const t = ctx.named(s.at); const g = this.group.position;
    const tp = t ? t.group.position : this.where(s, ctx);
    if (!this.aPhase) {
      this.aPhase = 'approach'; this.aT = 0;
      const a = Math.atan2(g.x - tp.x, g.z - tp.z);
      this.finalDir = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));
    }
    const beside = tp.clone().add(new THREE.Vector3(this.finalDir.z, 0, -this.finalDir.x).multiplyScalar(s.offset || 80));
    if (this.aPhase === 'approach') {
      const start = beside.clone().addScaledVector(this.finalDir, -2800); start.y = 120;
      const { dist } = this.steer(start, dt, 0.26); this.cruiseSpeed(dt);
      this.aT += dt;
      if (dist < 450 || this.aT > 80) this.aPhase = 'final';
    } else if (this.aPhase === 'final') {
      const d = Math.hypot(beside.x - g.x, beside.z - g.z);
      this.steer(new THREE.Vector3(beside.x, 0, beside.z), dt, 0.25);
      this.speed += (this.stall * 1.15 - this.speed) * Math.min(1, dt * 0.35);
      // a flat glide that meets the water about 450 m short of her
      const wantY = Math.max(0, (d - 450) * 0.07);
      this.pitch = THREE.MathUtils.clamp(Math.atan2(wantY - g.y, 90), -0.1, 0.05);
      this.bank *= 0.95;
      if (g.y <= 0.5) {
        this.onWater = true; g.y = 0; this.pitch = 0; this.bank = 0; this.aPhase = 'run';
        ctx.weapons.splash(g.clone(), 1.6); ctx.weapons.spray(g.clone(), this.forward(_v).clone().multiplyScalar(-6).setY(3), 4, 2);
      }
    } else if (this.aPhase === 'run') {
      const d = Math.hypot(beside.x - g.x, beside.z - g.z);
      const want = Math.min(this.speed, Math.max(2.5, d * 0.06));
      this.speed += (want - this.speed) * Math.min(1, dt * 0.6);
      if (d > 15) {
        let dh = Math.atan2(beside.x - g.x, beside.z - g.z) - this.heading; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        this.heading += THREE.MathUtils.clamp(dh, -0.25 * dt, 0.25 * dt);
      }
      g.x += Math.sin(this.heading) * this.speed * dt; g.z += Math.cos(this.heading) * this.speed * dt;
      if (this.speed > 4 && Math.random() < dt * 8) ctx.weapons.spray(g.clone().setY(0.4), new THREE.Vector3(0, 2, 0), 2, 1.2);
      if (d < 25) { this.speed = 0; if (s.do === 'alight') this.next(ctx); else this.phase = 'moored'; }
    }
  }

  // Home: in through the mouth of the Bay so the approach is over water, a flag when she is in
  // sight of the base, then down on the water off the moorings.
  home(dt, ctx, s) {
    const g = this.group.position;
    if (!this.phase) this.phase = 'mouth';
    if (this.phase === 'mouth') {
      const m = toWorld(36.045, -5.395);
      const { dist } = this.steer(new THREE.Vector3(m.x, 350, m.z), dt); this.cruiseSpeed(dt);
      if (dist < 900) this.phase = 'base';
    } else if (this.phase === 'base') {
      const b = toWorld(36.10, -5.395);
      const { dist } = this.steer(new THREE.Vector3(b.x, 250, b.z), dt); this.cruiseSpeed(dt);
      if (dist < 1500) { ctx.flag(s.flag || this.short + '-home'); if (s.log2) ctx.log(s.log2, 'ok'); this.phase = 'land'; this.aPhase = null; }
    } else if (this.phase === 'land') this.alight(dt, ctx, { do: 'home', lat: 36.128, lon: -5.392, offset: 0 });
    else if (this.phase === 'moored') this.float(dt, ctx, {});
  }

  float(dt, ctx, s) {
    this.bob += dt;
    const g = this.group;
    g.position.y = Math.sin(this.bob * 0.9) * 0.25;
    this.pitch = Math.sin(this.bob * 0.7) * 0.012; this.bank = Math.sin(this.bob * 0.55) * 0.02;
    // turn slowly to lie head to the boat's heading so the dinghy has a lee
    const t = s.at && ctx.named(s.at);
    if (t) { let dh = t.heading - this.heading; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; this.heading += THREE.MathUtils.clamp(dh, -0.03 * dt, 0.03 * dt); }
  }

  takeoff(dt, ctx, s) {
    const g = this.group.position;
    if (this.onWater) {
      this.speed += 2.2 * dt;
      g.x += Math.sin(this.heading) * this.speed * dt; g.z += Math.cos(this.heading) * this.speed * dt;
      g.y = 0; this.pitch = Math.min(0.06, this.speed / this.stall * 0.05);
      if (Math.random() < dt * 10) ctx.weapons.spray(g.clone().setY(0.4), this.forward(_v).clone().multiplyScalar(-4).setY(2.5), 3, 1.5);
      if (this.speed > this.stall * 1.2) { this.onWater = false; this.pitch = 0.09; }
    } else {
      this.pitch += (0.09 - this.pitch) * dt;
      this.cruiseSpeed(dt);
      if (g.y > (s.alt || 150)) this.next(ctx);
    }
  }

  damage(amount, ctx) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0 && this.mortal) {
      this.alive = false; this.onWater = false;
      ctx.log(`${this.short} is hit and going down!`, 'bad');
      ctx.flag(`${this.short}-lost`);
    } else if (!this.mortal) this.hp = Math.max(0.3, this.hp);
  }
}


// Friendlies come on the scene a few seconds after the player is airborne (a squadron machine
// that took off just behind), or later at a given place for aircraft from elsewhere.
export async function spawnFriendly(e, player) {
  const spec = AIRCRAFT[e.aircraft] || AIRCRAFT.catalina;
  const g = await loadOrPlaceholder(spec.asset, 20, 30, 'aircraft');
  const f = new Friendly(g, e, spec);
  const pp = player.obj.position;
  if (e.lat != null) {
    const w = toWorld(e.lat, e.lon);
    g.position.set(w.x, e.alt || 450, w.z);
    f.heading = Math.atan2(pp.x - w.x, pp.z - w.z);
  } else {
    // astern and to one side of the player, a little lower
    const fwd = player.forward(new THREE.Vector3()).setY(0).normalize();
    g.position.copy(pp).addScaledVector(fwd, -900).add(new THREE.Vector3(fwd.z, 0, -fwd.x).multiplyScalar(250 * (e.side || 1)));
    g.position.y = Math.max(90, pp.y - 30);
    f.heading = Math.atan2(fwd.x, fwd.z);
    f.speed = Math.max(player.speed, spec.stall / MPH * 1.3);
  }
  f.pose();
  return f;
}
