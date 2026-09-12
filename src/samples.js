// Sample-based sound layer on top of the synthesised audio. Clips generated with Atlas live in
// assets/sfx/<name>.(mp3|wav). Anything missing simply is not used and the synth carries on.
export const CLIPS = ['engine_idle', 'engine_cruise', 'engine_full', 'water_wash', 'wind', 'gulls', 'vickers_k', 'browning_twin',
  'depth_charge', 'splash', 'shell_splash', 'explosion', 'flak_hits', 'morse',
  'voice_bow_ready', 'voice_contact', 'voice_charges_away', 'voice_straddle', 'voice_bandit', 'voice_diving', 'voice_neutral', 'voice_wt', 'voice_down', 'voice_alongside',
  'music_title', 'music_patrol', 'music_contact', 'music_combat', 'music_loss'];

export class Samples {
  constructor(audio) { this.a = audio; this.buf = {}; this.loaded = false; this.loops = {}; this.voiceBusy = 0; this.lastVoice = {}; }

  async load() {
    if (!this.a.ctx || this.loaded) return;
    this.loaded = true;
    await Promise.all(CLIPS.map(async (n) => {
      for (const ext of ['mp3', 'wav', 'ogg']) {
        try {
          const r = await fetch(`assets/sfx/${n}.${ext}`); if (!r.ok) continue;
          this.buf[n] = await this.a.ctx.decodeAudioData(await r.arrayBuffer()); return;
        } catch (_) { /* try next */ }
      }
    }));
    this.count = Object.keys(this.buf).length;
  }
  has(n) { return !!this.buf[n]; }

  play(n, vol = 1, rate = 1, dest = null) {
    const b = this.buf[n]; if (!b) return null;
    const c = this.a.ctx; const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = vol; s.connect(g); g.connect(dest || this.a.master); s.start();
    return { src: s, gain: g };
  }

  // looping bed with a gain we can drive every frame
  loop(n, dest = null) {
    if (this.loops[n]) return this.loops[n];
    const b = this.buf[n]; if (!b) return null;
    const c = this.a.ctx; const s = c.createBufferSource(); s.buffer = b; s.loop = true;
    const g = c.createGain(); g.gain.value = 0; s.connect(g); g.connect(dest || this.a.master); s.start();
    return (this.loops[n] = { src: s, gain: g });
  }
  stopLoops() {
    for (const k of Object.keys(this.loops)) { try { this.loops[k].src.stop(); } catch (_) {} }
    this.loops = {};
  }

  // crew voice: one line at a time, a cooldown per line so the same call is not repeated
  say(n, cooldown = 20) {
    const b = this.buf[n]; if (!b || !this.a.ctx) return false;
    const now = this.a.ctx.currentTime;
    if (now < this.voiceBusy) return false;
    if (this.lastVoice[n] && now - this.lastVoice[n] < cooldown) return false;
    this.lastVoice[n] = now; this.voiceBusy = now + b.duration + 0.6;
    // intercom colour: band-limit and add a little hiss under the line
    const c = this.a.ctx; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.5;
    const g = c.createGain(); g.gain.value = 1.1; bp.connect(g); g.connect(this.a.master);
    this.play(n, 1, 1, bp);
    this.a.burst(0.05, 3000, b.duration, 0.3);
    return true;
  }
}
