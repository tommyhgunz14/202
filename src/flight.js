import * as THREE from 'three';
import { terrainHeight } from './world/terrain.js';
import { seaHeight } from './world/sea.js';
import { MPH } from './config.js';

const G = 9.81;
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Simplified but type-differentiated flight model. Forward is the aircraft's local +Z.
export class Flight {
  constructor(spec, object3d) {
    this.spec = spec;
    this.obj = object3d;
    this.vMax = spec.maxSpeed / MPH;          // m/s
    this.vCruise = spec.cruise / MPH;
    this.vStall = spec.stall / MPH;
    this.speed = 0;
    this.vertSpeed = 0;
    this.onWater = true;
    this.crashed = false;
    this.damage = 0;                           // 0..1
    this.engineHealth = 1;
    this.fuel = 1;
    this.rpm = 0;
    this.gForce = 1;
    this.turbulence = 0.2;
    this.t = 0;
    this.bank = 0; this.pitch = 0; this.heading = 0;
    // hull draft at rest (metres below the waterline), reduced as the hull rises on to the step
    this.draft = spec.draft || 1.0;
    this.hullY = -this.draft;
    this.planing = 0;        // 0 displacement .. 1 on the step
  }

  reset(pos, headingRad, speed = 0, onWater = true) {
    this.obj.position.copy(pos);
    if (onWater) this.obj.position.y = -this.draft;
    this.obj.quaternion.setFromAxisAngle(Y_AXIS, headingRad);
    this.speed = speed; this.onWater = onWater; this.crashed = false; this.damage = 0; this.vertSpeed = 0;
  }

  forward(out = _f) { return out.set(0, 0, 1).applyQuaternion(this.obj.quaternion); }
  up(out = _u) { return out.set(0, 1, 0).applyQuaternion(this.obj.quaternion); }
  right(out = _r) { return out.set(1, 0, 0).applyQuaternion(this.obj.quaternion); }

  get altitude() { return this.obj.position.y; }
  get headingDeg() {
    const f = this.forward();
    let h = Math.atan2(f.x, -f.z) * 180 / Math.PI;   // 0 = north (-z), 90 = east (+x)
    if (h < 0) h += 360; return h;
  }

  update(dt, ctl) {
    if (this.crashed) return;
    const h = this.spec.handling;
    const obj = this.obj;
    this.t += dt;
    const f = this.forward();
    const up = this.up();
    // attitude
    const pitchAng = Math.asin(THREE.MathUtils.clamp(f.y, -1, 1));
    const rgt = this.right();
    const bank = Math.atan2(rgt.y, up.y);   // + = right wing down
    this.bank = bank; this.pitch = pitchAng;

    const power = ctl.throttle * this.engineHealth * (this.fuel > 0 ? 1 : 0);
    this.rpm += ((0.25 + 0.75 * power) - this.rpm) * Math.min(1, dt * 1.5);

    // longitudinal: thrust vs drag vs gravity component
    const drag = h.drag * h.accel * (this.speed / this.vMax) ** 2 * (1 + this.damage * 0.5);
    let acc = power * h.accel - drag - G * Math.sin(pitchAng) * 0.55;
    if (this.onWater) {
      // hull resistance: heavy in displacement, light once up on the step; with the throttle
      // closed the hull drops off the step and the run stops quickly
      const k = THREE.MathUtils.clamp(this.speed / (this.vStall * 1.05), 0, 1);
      const disp = Math.pow(1 - k, 1.5) * (0.4 + 0.02 * this.speed);
      const plane = k * (0.15 + 0.0006 * this.speed * this.speed);
      let hull = disp + plane;
      if (power < 0.1) hull += 0.9 + 0.015 * this.speed;
      acc -= hull * (ctl.brake ? 2.5 : 1);
      if (this.speed < 0.5 && power < 0.05) this.speed = 0;
    }
    this.speed = Math.max(0, this.speed + acc * dt);

    // control authority grows with airspeed
    const auth = THREE.MathUtils.clamp(this.speed / this.vCruise, 0.15, 1.15);
    const stallFactor = THREE.MathUtils.clamp((this.speed - this.vStall * 0.8) / (this.vStall * 0.4), 0, 1);

    let pitchRate = ctl.pitch * h.pitchRate * auth;
    let rollRate = ctl.roll * h.rollRate * auth;
    let yawRate = ctl.yaw * h.yawRate * auth;

    // stability: bank and pitch tend back toward level when the stick is centred
    if (Math.abs(ctl.roll) < 0.05) rollRate -= bank * 0.35 * h.stability;
    if (Math.abs(ctl.pitch) < 0.05) pitchRate -= pitchAng * 0.45 * h.stability;
    // stall: nose drops, wing drops
    if (!this.onWater && stallFactor < 1) {
      pitchRate -= (1 - stallFactor) * 0.5;
      rollRate += (1 - stallFactor) * 0.25 * Math.sin(this.t * 1.7);
    }
    // turbulence
    if (!this.onWater) {
      const tb = this.turbulence * 0.05;
      rollRate += tb * Math.sin(this.t * 2.3 + 1) * (0.5 + Math.random());
      pitchRate += tb * 0.5 * Math.sin(this.t * 3.1) * (0.5 + Math.random());
    }
    if (this.onWater) { rollRate -= bank * 3; pitchRate -= pitchAng * 3; if (this.speed < 3) yawRate *= 0.3; }

    // apply body rates
    // local +x is the PORT wing (model faces +Z), so rotating about it by a negative angle
    // raises the nose, and rotating about forward by a positive angle rolls right.
    _q.setFromAxisAngle(rgt, -pitchRate * dt); obj.quaternion.premultiply(_q);
    _q.setFromAxisAngle(f, rollRate * dt); obj.quaternion.premultiply(_q);
    _q.setFromAxisAngle(up, -yawRate * dt); obj.quaternion.premultiply(_q);
    // coordinated turn from bank: yaw about world vertical
    if (!this.onWater && this.speed > 1) {
      const turnRate = G * Math.tan(THREE.MathUtils.clamp(bank, -1.2, 1.2)) / Math.max(this.speed, 15);
      _q.setFromAxisAngle(Y_AXIS, -turnRate * dt); obj.quaternion.premultiply(_q);
      this.gForce = 1 / Math.max(0.2, Math.cos(bank));
    }
    obj.quaternion.normalize();

    // translate
    const fwd = this.forward();
    const prevY = obj.position.y;
    obj.position.addScaledVector(fwd, this.speed * dt);
    // insufficient lift below stall: sink
    if (!this.onWater) {
      const lift = THREE.MathUtils.clamp((this.speed / this.vStall) ** 2, 0, 1);
      obj.position.y -= (1 - lift) * 9 * dt;
    }
    this.vertSpeed = (obj.position.y - prevY) / Math.max(dt, 1e-4);

    // water / ground contact
    const ground = terrainHeight(obj.position.x, obj.position.z);
    if (ground > 0.5 && obj.position.y < ground + 0.5) { this.crash('flew into high ground'); return; }
    if (obj.position.y <= 0.05 || this.onWater) {
      if (!this.onWater) {
        // touchdown checks
        if (this.vertSpeed < -7 || Math.abs(bank) > 0.35 || pitchAng < -0.18) { this.crash('hit the water too hard'); return; }
        if (ground > -0.5) { this.crash('ran aground'); return; }
        this.onWater = true;
      }
      // displacement at rest, rising on to the step as speed builds (the "hump" at 40-60 %)
      const k = THREE.MathUtils.clamp(this.speed / (this.vStall * 1.05), 0, 1);
      this.planing = k;
      const ride = -this.draft * (1 - Math.pow(k, 1.6));
      this.hullY += (ride - this.hullY) * Math.min(1, dt * 3);
      // ride the swell at rest; on the step the hull skims the crests
      obj.position.y = this.hullY + seaHeight(obj.position.x, obj.position.z) * (0.75 - 0.45 * k) + Math.sin(this.t * 1.7) * 0.05 * (1 - k);
      // hump attitude: nose rides up through the middle of the run
      const humpPitch = Math.sin(Math.PI * THREE.MathUtils.clamp((k - 0.15) / 0.7, 0, 1)) * 0.07;
      _q.setFromAxisAngle(rgt, -(humpPitch - pitchAng) * dt * 1.5); obj.quaternion.premultiply(_q);
      // takeoff when fast enough and nose held up
      if ((this.speed > this.vStall * 1.05 && ctl.pitch > 0.15) || this.speed > this.vStall * 1.25) {
        this.onWater = false;
        obj.position.y = 0.2; this.hullY = 0;
      }
    }
    // fuel: 1 unit = full endurance, scaled to keep missions sane (~40 min at cruise)
    this.fuel = Math.max(0, this.fuel - dt * (0.15 + 0.85 * power) / (40 * 60));
    // engine damage effects
    if (this.damage > 0.6) this.engineHealth = Math.max(0.35, this.engineHealth - dt * 0.01);
  }

  crash(reason) {
    this.crashed = true; this.crashReason = reason; this.speed = 0;
  }

  hit(amount) {
    this.damage = Math.min(1, this.damage + amount);
    if (this.damage >= 1) this.crash('shot down');
  }
}
