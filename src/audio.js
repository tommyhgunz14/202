// Procedural sound. Nothing is downloaded: engines, wind, water, guns, detonations, W/T morse
// and a generative music bed are all synthesised with the Web Audio API.
//
// Engine model per engine: a sawtooth fundamental plus a sub-octave, run through a low-pass that
// opens with throttle, amplitude-modulated at the propeller blade-pass rate so a big radial reads
// as a beat rather than a buzz; a band-passed noise bed for exhaust roar; a touch of random gain
// jitter for "rough running". Neighbouring engines are detuned by a fraction of a hertz so a pair
// or four produce the slow synchronised throb of the real thing. The mix settles: any throttle
// change is loud for a few seconds and then tapers to a background level so the crew (and the
// player) can hear the rest of the world.

import { Samples } from './samples.js?v=202609171515';

export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.engines = []; this.enabled = true;
    this.music = new Music(this);
    this.settle = 0; this.lastThrottle = 0;
    this.samples = new Samples(this);
  }
  say(name, cooldown) { return this.samples.say(name, cooldown); }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
    this.comp = this.ctx.createDynamicsCompressor(); this.comp.threshold.value = -18; this.comp.ratio.value = 4;
    this.master.connect(this.comp); this.comp.connect(this.ctx.destination);
    this.noiseBuf = this.makeNoise();
    this.buildAmbience();
    this.music.init();
    // when the clips finish decoding, let the recorded cue take over from the generative pad
    this.samples.load().then(() => { if (this.music && this.music.mood && this.music.mood !== 'off') this.music.useTracks(this.music.mood); });
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  makeNoise() {
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {   // pink-ish noise
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return buf;
  }
  noiseSource() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; return s; }

  // ---- ambience: wind and water, always running, shaped by the flight state ----
  buildAmbience() {
    const c = this.ctx;
    this.wind = { src: this.noiseSource(), bp: c.createBiquadFilter(), g: c.createGain() };
    this.wind.bp.type = 'bandpass'; this.wind.bp.frequency.value = 500; this.wind.bp.Q.value = 0.5;
    this.wind.g.gain.value = 0;
    this.wind.src.connect(this.wind.bp); this.wind.bp.connect(this.wind.g); this.wind.g.connect(this.master); this.wind.src.start();
    this.water = { src: this.noiseSource(), lp: c.createBiquadFilter(), g: c.createGain(), lfo: c.createOscillator(), lfoG: c.createGain() };
    this.water.lp.type = 'lowpass'; this.water.lp.frequency.value = 900;
    this.water.g.gain.value = 0;
    this.water.lfo.type = 'sine'; this.water.lfo.frequency.value = 0.35; this.water.lfoG.gain.value = 0;   // depth follows the level
    this.water.lfo.connect(this.water.lfoG); this.water.lfoG.connect(this.water.g.gain);
    this.water.src.connect(this.water.lp); this.water.lp.connect(this.water.g); this.water.g.connect(this.master);
    this.water.src.start(); this.water.lfo.start();
  }

  // ---- engines ----
  startEngines(count, baseHz, blades = 3) {
    this.stopEngines();
    if (!this.ctx) return;
    const c = this.ctx;
    this.engineBus = c.createGain(); this.engineBus.gain.value = 0.0001;
    this.engineLp = c.createBiquadFilter(); this.engineLp.type = 'lowpass'; this.engineLp.frequency.value = 1200;
    this.engineBus.connect(this.engineLp); this.engineLp.connect(this.master);
    for (let i = 0; i < count; i++) {
      const detune = (i - (count - 1) / 2) * 0.9 + (Math.random() - 0.5) * 0.4;   // Hz, gives the throb
      const osc = c.createOscillator(); osc.type = 'sawtooth';
      const sub = c.createOscillator(); sub.type = 'triangle';
      const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 500; bp.Q.value = 1.2;
      const vg = c.createGain(); vg.gain.value = 0.5;
      const am = c.createGain(); am.gain.value = 1;                // blade-pass amplitude modulation
      const lfo = c.createOscillator(); lfo.type = 'sine'; const lfoG = c.createGain(); lfoG.gain.value = 0.18;
      lfo.connect(lfoG); lfoG.connect(am.gain);
      const ex = this.noiseSource(); const exBp = c.createBiquadFilter(); exBp.type = 'bandpass'; exBp.frequency.value = 700; exBp.Q.value = 0.8;
      const exG = c.createGain(); exG.gain.value = 0.12;
      osc.connect(bp); sub.connect(bp); bp.connect(vg); vg.connect(am); am.connect(this.engineBus);
      ex.connect(exBp); exBp.connect(exG); exG.connect(am);
      osc.start(); sub.start(); lfo.start(); ex.start();
      this.engines.push({ osc, sub, bp, vg, am, lfo, lfoG, ex, exBp, exG, base: baseHz, detune, blades });
    }
    this.settle = 3;
    // recorded engine loops, if generated: idle / cruise / full crossfaded by rpm on the same bus
    this.engineLoops = null;
    if (this.samples.has('engine_idle') || this.samples.has('engine_cruise') || this.samples.has('engine_full')) {
      this.engineLoops = { idle: this.samples.loop('engine_idle', this.engineBus), cruise: this.samples.loop('engine_cruise', this.engineBus), full: this.samples.loop('engine_full', this.engineBus) };
      for (const e of this.engines) e.vg.gain.value = 0.12;   // synth drops to a supporting layer
    }
    if (this.samples.has('wind')) this.windLoop = this.samples.loop('wind');
    if (this.samples.has('water_wash')) this.waterLoop = this.samples.loop('water_wash');
  }
  stopEngines() {
    this.samples.stopLoops(); this.engineLoops = null; this.windLoop = null; this.waterLoop = null;
    for (const e of this.engines) { try { e.osc.stop(); e.sub.stop(); e.lfo.stop(); e.ex.stop(); } catch (_) {} }
    this.engines = [];
    if (this.engineBus) { try { this.engineBus.disconnect(); } catch (_) {} this.engineBus = null; }
    if (this.wind) this.wind.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    if (this.water) { this.water.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); this.water.lfoG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); }
  }
  setEngine(rpm, throttle, health = 1, opts = {}) {
    if (!this.ctx || !this.engines.length) return;
    const t = this.ctx.currentTime;
    // samples may finish loading after the engines started: attach the loops when they appear
    if (!this.engineLoops && this.engineBus && this.samples.has('engine_idle')) {
      this.engineLoops = { idle: this.samples.loop('engine_idle', this.engineBus), cruise: this.samples.loop('engine_cruise', this.engineBus), full: this.samples.loop('engine_full', this.engineBus) };
    }
    if (!this.windLoop && this.samples.has('wind')) this.windLoop = this.samples.loop('wind');
    if (!this.waterLoop && this.samples.has('water_wash')) this.waterLoop = this.samples.loop('water_wash');
    // settle: a throttle movement brings the engines forward for a few seconds, then they recede
    if (Math.abs(throttle - this.lastThrottle) > 0.03) this.settle = Math.min(4, this.settle + 2);
    this.lastThrottle = throttle;
    this.settle = Math.max(0, this.settle - 1 / 60);
    const fore = 1 + 0.9 * Math.min(1, this.settle / 3);
    const inside = !!opts.cockpit;
    const level = (0.05 + 0.13 * rpm) * fore * (inside ? 1.25 : 0.85);
    this.engineBus.gain.setTargetAtTime(level, t, 0.15);
    this.engineLp.frequency.setTargetAtTime(inside ? 700 + 500 * throttle : 1400 + 1200 * throttle, t, 0.2);
    for (const e of this.engines) {
      const f = e.base * (0.42 + 0.95 * rpm) + e.detune;
      const rough = health < 0.7 ? 1 + 0.04 * Math.sin(t * 9) * (Math.random() > 0.3 ? 1 : 0) : 1;
      e.osc.frequency.setTargetAtTime(f * rough, t, 0.12);
      e.sub.frequency.setTargetAtTime(f / 2, t, 0.12);
      e.bp.frequency.setTargetAtTime(220 + 900 * throttle, t, 0.2);
      e.lfo.frequency.setTargetAtTime(f * e.blades / 4, t, 0.2);
      e.exG.gain.setTargetAtTime(0.06 + 0.22 * throttle, t, 0.2);
      e.vg.gain.setTargetAtTime((this.engineLoops ? 0.12 : 0.45) + 0.05 * Math.random(), t, 0.05);
    }
    if (this.engineLoops) {
      const L = this.engineLoops;
      const idle = Math.max(0, 1 - rpm / 0.5), cruise = Math.max(0, 1 - Math.abs(rpm - 0.62) / 0.35), full = Math.max(0, (rpm - 0.72) / 0.28);
      const rate = 0.9 + 0.2 * rpm;
      for (const [k, v] of [['idle', idle], ['cruise', cruise], ['full', full]]) { if (L[k]) { L[k].gain.gain.setTargetAtTime(v * 1.6, t, 0.2); L[k].src.playbackRate.setTargetAtTime(rate, t, 0.3); } }
    }
    // wind rises with airspeed, louder outside; water wash while on the surface
    const sp = opts.speed || 0;
    const windLevel = Math.min(0.35, (sp / 90) ** 1.6 * 0.35) * (inside ? 0.45 : 1);
    this.wind.g.gain.setTargetAtTime(this.windLoop ? windLevel * 0.3 : windLevel, t, 0.3);
    if (this.windLoop) { this.windLoop.gain.gain.setTargetAtTime(windLevel * 1.4, t, 0.3); this.windLoop.src.playbackRate.setTargetAtTime(0.85 + sp / 200, t, 0.3); }
    this.wind.bp.frequency.setTargetAtTime(300 + sp * 8, t, 0.3);
    const waterLevel = opts.onWater ? 0.05 + Math.min(0.3, sp / 40 * 0.3) : 0;
    this.water.g.gain.setTargetAtTime(waterLevel, t, 0.25);
    this.water.lfoG.gain.setTargetAtTime(waterLevel * 0.45, t, 0.25);
    if (this.waterLoop) { this.waterLoop.gain.gain.setTargetAtTime(waterLevel * 1.5, t, 0.25); this.water.g.gain.setTargetAtTime(waterLevel * 0.25, t, 0.25); }
    this.water.lp.frequency.setTargetAtTime(600 + (opts.planing || 0) * 2500, t, 0.3);
  }

  // ---- one-shots ----
  burst(vol = 0.5, hz = 140, dur = 0.06, q = 0.7) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(); src.stop(this.ctx.currentTime + dur + 0.02);
  }
  gun(kind = 'vickers') {
    const clip = kind === 'browning' ? 'browning_twin' : 'vickers_k';
    // our own guns sit a quarter lower than they did, so several positions firing together do not swamp the mix
    if (this.samples.has(clip)) { if (!this._gunT || this.ctx.currentTime - this._gunT > 0.25) { this._gunT = this.ctx.currentTime; this.samples.play(clip, 0.525, 0.95 + Math.random() * 0.1); } return; }
    this.burst(0.375, 1400, 0.045, 0.5); this.burst(0.2625, 180, 0.09, 0.6);
  }
  shellSplash() { if (this.samples.has('shell_splash')) this.samples.play('shell_splash', 0.6); else this.burst(0.4, 500, 0.5, 0.4); }
  gulls() { if (this.samples.has('gulls')) this.samples.play('gulls', 0.35); }
  enemyGun() { this.burst(0.18, 1900, 0.04); }
  release() { this.burst(0.25, 250, 0.2); }
  splash() { if (this.samples.has('splash')) { this.samples.play('splash', 0.7); return; } this.burst(0.6, 600, 0.6, 0.4); }
  boom(vol = 1, underwater = false) {
    if (!this.ctx) return;
    const clip = underwater ? 'depth_charge' : 'explosion';
    if (this.samples.has(clip)) { this.samples.play(clip, Math.min(1.2, vol)); return; }
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const g = this.ctx.createGain(); g.gain.value = vol * 1.4;
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start(); src.stop(t + 2.4);
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 60;
    const g2 = this.ctx.createGain(); g2.gain.value = vol * 0.7; g2.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    o.frequency.exponentialRampToValueAtTime(22, t + 1.4);
    o.connect(g2); g2.connect(this.master); o.start(); o.stop(t + 1.5);
  }
  // a round striking the airframe: a dull thud through the structure with a faint tick of the skin
  hitPlayer() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this._thudT && t - this._thudT < 0.07) return;
    this._thudT = t;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240 + Math.random() * 80;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.16);
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120 + Math.random() * 30, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    const g2 = this.ctx.createGain(); g2.gain.setValueAtTime(0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g2); g2.connect(this.master); o.start(t); o.stop(t + 0.14);
    this.burst(0.07, 2200, 0.02, 1.5);
    if (this.samples.has('flak_hits') && (!this._hitT || t - this._hitT > 0.6)) { this._hitT = t; this.samples.play('flak_hits', 0.3); }
  }
  // a round going past: the crack of a close one, then a falling whistle, louder and brighter the
  // closer it came, panned to the side it passed on (side -1 left .. +1 right); big = a slower cannon shell
  whiz(side = 0, dist = 10, big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this._whizT && t - this._whizT < 0.08) return;
    this._whizT = t;
    const R = 30, near = Math.max(0, 1 - dist / R);
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.max(-1, Math.min(1, side));
    // it has to cut through a pair of radial engines and the slipstream, so it goes to the output
    // at well above the engine bed, not buried in it
    const out = this.ctx.createGain(); out.gain.value = 1.4;
    if (pan) { out.connect(pan); pan.connect(this.master); } else out.connect(this.master);
    // a close round is supersonic: first the sharp crack of its shock wave going past
    if (near > 0.35) {
      const c = this.ctx.createBufferSource(); c.buffer = this.noiseBuf; c.playbackRate.value = 2;
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const cg = this.ctx.createGain(); cg.gain.setValueAtTime(1.6 * near, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      c.connect(hp); hp.connect(cg); cg.connect(out); c.start(t, Math.random()); c.stop(t + 0.04);
    }
    // then the rushing whistle of the round tearing past, falling in pitch as it goes (Doppler)
    const dur = (big ? 0.34 : 0.22) + 0.1 * (1 - near);
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
    const f0 = (big ? 2600 : 4200) + near * 1200;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f0 * 0.35, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 + 2.6 * near, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.02);
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime((big ? 1500 : 2600) + near * 900, t); o.frequency.exponentialRampToValueAtTime(big ? 700 : 1100, t + dur);
    const g2 = this.ctx.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.06 + 0.16 * near, t + dur * 0.4); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g2); g2.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  ping() { this.tone(880, 0.08, 0.2); }
  tone(hz, dur, vol = 0.2) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
    const g = this.ctx.createGain(); g.gain.value = vol; g.gain.setTargetAtTime(0.0001, this.ctx.currentTime + dur, 0.02);
    o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur + 0.1);
  }
  morse(text) {
    if (!this.ctx) return;
    if (this.samples.has('morse')) { this.samples.play('morse', 0.5); return; }
    const code = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', ' ': ' ' };
    let t = this.ctx.currentTime + 0.05;
    const unit = 0.06;
    for (const ch of text.toLowerCase()) {
      const c = code[ch]; if (!c) continue;
      if (c === ' ') { t += unit * 4; continue; }
      for (const s of c) {
        const d = s === '.' ? unit : unit * 3;
        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 700;
        const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0.18, t); g.gain.setValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.01);
        t += d + unit;
      }
      t += unit * 2;
    }
  }
}

// ---- generative music bed ----
// A slow string-like pad (detuned saws through a warm low-pass with long attack/release) moving
// through a modal progression, with a low pulse and a held minor second when the mood tightens.
// Moods: menu (full pad), patrol (thin, distant), contact (tense drone), combat (pulse + drone),
// loss (single low chord), off.
const CHORDS = {
  // MIDI note numbers; D dorian / D minor colours suit the period newsreel feel without pastiche
  menu: [[50, 57, 60, 65, 69], [46, 53, 57, 60, 65], [53, 57, 60, 64, 69], [48, 55, 60, 64, 67]],
  patrol: [[50, 57, 62, 69], [48, 55, 60, 67], [50, 57, 62, 69], [53, 60, 65, 69]],
  contact: [[38, 45, 50, 56], [38, 45, 51, 56], [37, 44, 50, 56], [38, 45, 50, 57]],
  combat: [[38, 45, 50, 56, 61], [37, 44, 50, 56, 62], [38, 45, 51, 56, 61], [36, 43, 50, 55, 61]],
  loss: [[38, 45, 49, 53]],
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

class Music {
  constructor(audio) { this.a = audio; this.mood = 'off'; this.voices = []; this.timer = null; this.step = 0; }
  init() {
    const c = this.a.ctx;
    this.bus = c.createGain(); this.bus.gain.value = 0;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 900; this.lp.Q.value = 0.4;
    this.bus.connect(this.lp); this.lp.connect(this.a.master);
    this.pulseG = c.createGain(); this.pulseG.gain.value = 0; this.pulseG.connect(this.a.master);
  }
  // recorded cues (Atlas) take over from the generative pad when present: one looping track per
  // mood, crossfaded over a few seconds; the title theme plays on the menus
  trackFor(m) { return { menu: 'music_title', patrol: 'music_patrol', contact: 'music_contact', combat: 'music_combat', loss: 'music_loss' }[m]; }
  useTracks(m) {
    const S = this.a.samples; const name = this.trackFor(m);
    if (!name || !S.has(name)) return false;
    const t = this.a.ctx.currentTime;
    this.tracks ||= {};
    for (const k of Object.keys(this.tracks)) if (k !== name) this.tracks[k].gain.gain.setTargetAtTime(0, t, 1.5);
    if (!this.tracks[name]) {
      const c = this.a.ctx; const s = c.createBufferSource(); s.buffer = S.buf[name]; s.loop = m !== 'loss'; s.loopStart = 0; s.loopEnd = S.buf[name].duration;
      const g = c.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.a.master); s.start();
      this.tracks[name] = { src: s, gain: g };
    }
    const level = { menu: 0.55, patrol: 0.28, contact: 0.4, combat: 0.5, loss: 0.5 }[m] || 0.3;
    this.tracks[name].gain.gain.setTargetAtTime(level, t, m === 'combat' ? 0.8 : 2.5);
    // silence the pad
    this.bus.gain.setTargetAtTime(0, t, 1.5);
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.stopPulse();
    return true;
  }
  stopTracks() { if (!this.tracks || !this.a.ctx) return; const t = this.a.ctx.currentTime; for (const k of Object.keys(this.tracks)) this.tracks[k].gain.gain.setTargetAtTime(0, t, 1.5); }
  setMood(m) {
    if (!this.a.ctx) return;
    const name = this.trackFor(m);
    // fetch the recorded cue for this mood; when it arrives, it takes over from the pad
    if (name && !this.a.samples.has(name)) this.a.samples.want(name, () => this.mood === m, () => { this.mood = null; this.setMood(m); });
    if (m === this.mood) return;
    this.mood = m;
    if (m === 'off') this.stopTracks(); else if (this.useTracks(m)) return;
    this.stopTracks();
    const t = this.a.ctx.currentTime;
    const level = { menu: 0.16, patrol: 0.07, contact: 0.12, combat: 0.14, loss: 0.12, off: 0 }[m] || 0;
    this.bus.gain.setTargetAtTime(level, t, 2.5);
    this.lp.frequency.setTargetAtTime({ menu: 1100, patrol: 700, contact: 500, combat: 800, loss: 500 }[m] || 700, t, 2);
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (m !== 'off') { this.step = 0; this.playChord(); this.timer = setInterval(() => this.playChord(), m === 'combat' ? 5000 : 9000); }
    if (m === 'combat') this.startPulse(); else this.stopPulse();
  }
  playChord() {
    const c = this.a.ctx; if (!c) return;
    const prog = CHORDS[this.mood] || CHORDS.patrol;
    const chord = prog[this.step % prog.length]; this.step++;
    const t = c.currentTime, hold = (this.mood === 'combat' ? 5 : 9) + 3;
    for (const n of chord) {
      for (const det of [-6, 5]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09 / chord.length, t + 2.5);
        g.gain.setValueAtTime(0.09 / chord.length, t + hold - 3.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + hold);
        o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + hold + 0.1);
      }
    }
  }
  startPulse() {
    if (this.pulseTimer) return;
    const c = this.a.ctx;
    const beat = () => {
      const t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      const g = c.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g); g.connect(this.pulseG); o.start(t); o.stop(t + 0.5);
    };
    this.pulseG.gain.setTargetAtTime(1, c.currentTime, 1);
    beat(); this.pulseTimer = setInterval(beat, 1100);
  }
  stopPulse() {
    if (this.pulseTimer) { clearInterval(this.pulseTimer); this.pulseTimer = null; }
    if (this.pulseG && this.a.ctx) this.pulseG.gain.setTargetAtTime(0, this.a.ctx.currentTime, 0.5);
  }
}
