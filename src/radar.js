import { terrainHeight } from './world/terrain.js?v=202609171221';
import { H_SCALE, toWorld } from './config.js?v=202609171221';
import { COAST, PLACES } from './data/geo.js?v=202609171221';

// Two instruments drawn on canvases:
//  1. ASV Mk II — the 1.5 m air-to-surface-vessel set carried by the Catalinas and Sunderlands.
//     Its real display was an A-scope: a vertical timebase with range up the trace and blips
//     that extend LEFT or RIGHT of the trace according to which side aerial saw the echo. That
//     is what is drawn here, with the coastline appearing as a ragged "land return".
//  2. The navigator's plot — a chart of the Strait with own position, base, contacts once
//     identified, and W/T sighting reports from Gibraltar.
export class Radar {
  constructor(asvCanvas, plotCanvas) {
    this.asv = asvCanvas; this.plot = plotCanvas;
    this.ranges = [10, 20, 36];   // statute miles (ASV Mk II range scales)
    this.rangeIdx = 2;
    this.sweep = 0;
    this.fitted = true;
    this.landSamples = [];
    this.lastLand = -1;
    this.coastWorld = Object.values(COAST).map((poly) => poly.map(([la, lo]) => { const p = toWorld(la, lo); return [p.x, p.z]; }));
    this.placesWorld = PLACES.map((p) => ({ name: p.name, ...toWorld(p.lat, p.lon) }));
    this.plotScale = 0;   // px per world m, set on draw
    this.reports = [];    // {x,z,text,age}
    this.noise = [];
    for (let i = 0; i < 200; i++) this.noise.push(Math.random());
  }

  get rangeMiles() { return this.ranges[this.rangeIdx]; }
  get rangeWorld() { return this.rangeMiles * 1609.34 * H_SCALE; }
  cycleRange() { this.rangeIdx = (this.rangeIdx + 1) % this.ranges.length; return this.rangeMiles; }

  sampleLand(player, time) {
    if (time - this.lastLand < 0.5) return;
    this.lastLand = time;
    const out = [];
    const heading = player.headingDeg * Math.PI / 180;
    const R = this.rangeWorld;
    for (let b = -80; b <= 80; b += 5) {
      const ang = heading + b * Math.PI / 180;
      for (let r = 0.06; r <= 1; r += 0.03) {
        const x = player.obj.position.x + Math.sin(ang) * r * R;
        const z = player.obj.position.z - Math.cos(ang) * r * R;
        if (terrainHeight(x, z) > 2) { out.push({ bearing: b, range: r }); break; }
      }
    }
    this.landSamples = out;
  }

  drawASV(player, contacts, time) {
    const c = this.asv, ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.fillStyle = '#0a1a10'; ctx.fillRect(0, 0, W, H);
    // bezel text
    ctx.fillStyle = '#7fbf8a'; ctx.font = '11px monospace';
    ctx.fillText(`ASV Mk II  ${this.fitted ? 'RANGE ' + this.rangeMiles + ' MI' : 'NOT FITTED'}`, 8, 14);
    if (!this.fitted) {
      ctx.fillStyle = '#2f5f3a'; ctx.font = '12px monospace';
      ctx.fillText('No radar in this type.', 8, H / 2 - 8);
      ctx.fillText('Search by eye; listen for W/T.', 8, H / 2 + 10);
      return;
    }
    const cx = W / 2, top = 24, bottom = H - 10, len = bottom - top;
    // range ticks
    ctx.strokeStyle = '#1f4a2c'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = bottom - len * i / 4; ctx.beginPath(); ctx.moveTo(cx - 60, y); ctx.lineTo(cx + 60, y); ctx.stroke(); ctx.fillStyle = '#3f8a52'; ctx.fillText((this.rangeMiles * i / 4).toFixed(0), cx + 64, y + 4); }
    // trace with grass (noise)
    ctx.strokeStyle = '#66e07a'; ctx.lineWidth = 1.5; ctx.beginPath();
    const R = this.rangeWorld, heading = player.headingDeg;
    const echoes = [];
    for (const s of this.landSamples) echoes.push({ r: s.range, side: Math.sign(s.bearing) || (Math.random() < 0.5 ? -1 : 1), amp: 18 + Math.random() * 14, wide: true });
    for (const v of contacts) {
      if (!v.alive) continue;
      const scope = v.kind === 'submarine' && v.depth > 6;
      const dx = v.group.position.x - player.obj.position.x, dz = v.group.position.z - player.obj.position.z;
      const d = Math.hypot(dx, dz);
      if (scope && (v.depth > 12 || d > R * 0.25)) continue;   // only a raised periscope, and only close in
      if (d > R || d < R * 0.04) continue;
      let brg = Math.atan2(dx, -dz) * 180 / Math.PI - heading;
      while (brg > 180) brg -= 360; while (brg < -180) brg += 360;
      if (Math.abs(brg) > 95) continue;     // side aerials look forward/sideways
      const size = Math.min(1, v.length / 100) * (v.kind === 'submarine' ? (scope ? 0.22 : 0.6) : 1);
      // sea-clutter fade: a surfaced U-boat only paints reliably inside ~12 miles
      const detect = v.kind === 'submarine' ? Math.max(0, 1 - d / (R * 0.55)) : 1;
      if (Math.random() > detect + 0.15) continue;
      echoes.push({ r: d / R, side: Math.sign(brg) || 1, amp: 14 + 30 * size * (1 - Math.abs(brg) / 110), wide: false });
    }
    const flick = Math.floor(time * 8);
    for (let i = 0; i <= 120; i++) {
      const f = i / 120, y = bottom - f * len;
      let x = cx + (this.noise[(i * 3 + flick) % 200] - 0.5) * (6 + 10 * (1 - f) * (player.obj.position.y < 200 ? 1.5 : 1));
      for (const e of echoes) {
        const dr = Math.abs(f - e.r);
        const w = e.wide ? 0.03 : 0.012;
        if (dr < w) x += e.side * e.amp * (1 - dr / w) * (0.7 + 0.3 * this.noise[(i + flick * 7) % 200]);
      }
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#3f8a52'; ctx.font = '10px monospace';
    ctx.fillText('PORT', 12, H - 14); ctx.fillText('STBD', W - 42, H - 14);
    // glass glare
    const grd = ctx.createRadialGradient(cx - 40, 40, 5, cx, H / 2, W * 0.8);
    grd.addColorStop(0, 'rgba(160,255,180,0.10)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  }

  drawPlot(player, contacts, base, mission, time, jetty) {
    const c = this.plot, ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.fillStyle = '#e7dfc8'; ctx.fillRect(0, 0, W, H);
    // chart window ±half around the player, north up
    const half = 6500;
    const s = W / (half * 2); this.plotScale = s;
    const px = player.obj.position.x, pz = player.obj.position.z;
    const X = (x) => (x - px) * s + W / 2, Y = (z) => (z - pz) * s + H / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    // lat/lon graticule
    ctx.strokeStyle = 'rgba(70,60,40,0.25)'; ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(X(px + i * 2000), 0); ctx.lineTo(X(px + i * 2000), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Y(pz + i * 2000)); ctx.lineTo(W, Y(pz + i * 2000)); ctx.stroke();
    }
    // land
    ctx.fillStyle = '#c9bb92'; ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1.2;
    for (const poly of this.coastWorld) {
      ctx.beginPath();
      poly.forEach(([x, z], i) => { if (i === 0) ctx.moveTo(X(x), Y(z)); else ctx.lineTo(X(x), Y(z)); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#3a2f1a'; ctx.font = '9px sans-serif';
    for (const p of this.placesWorld) ctx.fillText(p.name, X(p.x) + 3, Y(p.z) - 2);
    // base
    ctx.fillStyle = '#1f3468'; ctx.beginPath(); ctx.arc(X(base.x), Y(base.z), 4, 0, Math.PI * 2); ctx.fill();
    if (jetty) { ctx.fillStyle = '#d8b43c'; ctx.beginPath(); ctx.moveTo(X(jetty.x), Y(jetty.z) - 6); ctx.lineTo(X(jetty.x) + 5, Y(jetty.z) + 3); ctx.lineTo(X(jetty.x) - 5, Y(jetty.z) + 3); ctx.closePath(); ctx.fill(); }
    // reports
    for (const r of this.reports) {
      ctx.strokeStyle = '#a02a30'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(r.x), Y(r.z), 8 + (time * 20) % 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#a02a30'; ctx.fillText(r.text, X(r.x) + 10, Y(r.z) + 3);
    }
    // datum: last known position of a dived boat and the circle she could have reached since
    if (mission && mission.datums) for (const dt of mission.datums) {
      const age = time - dt.t;
      const radius = age * dt.speed;
      ctx.strokeStyle = 'rgba(160,42,48,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(dt.x) - 6, Y(dt.z) - 6); ctx.lineTo(X(dt.x) + 6, Y(dt.z) + 6); ctx.moveTo(X(dt.x) + 6, Y(dt.z) - 6); ctx.lineTo(X(dt.x) - 6, Y(dt.z) + 6); ctx.stroke();
      ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(X(dt.x), Y(dt.z), Math.max(6, radius * s), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const mm = Math.floor(age / 60), ss = Math.floor(age % 60);
      ctx.fillStyle = '#a02a30'; ctx.font = '9px monospace'; ctx.fillText(`DATUM ${dt.name} +${mm}:${String(ss).padStart(2, '0')}`, X(dt.x) + 8, Y(dt.z) - 6);
    }
    // contacts (identified, or friendly)
    for (const v of contacts) {
      if (!v.alive) continue;
      const known = v.identified || v.faction === 'rn' || v.faction === 'allied';
      // a dived boat stays on the plot only while her shadow can be seen from close by
      if (v.kind === 'submarine' && !v.surfaced && !(v.shadowSeen)) continue;
      const d = Math.hypot(v.group.position.x - px, v.group.position.z - pz);
      if (!known && d > 2500) continue;
      const x = X(v.group.position.x), y = Y(v.group.position.z);
      ctx.fillStyle = !known ? '#777' : v.faction === 'rn' || v.faction === 'allied' ? '#1f3468' : v.faction === 'spain' ? '#3a7a3a' : '#a02a30';
      ctx.save(); ctx.translate(x, y); ctx.rotate(v.heading);
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(3, -4); ctx.lineTo(-3, -4); ctx.closePath(); ctx.fill(); ctx.restore();
      if (known) { ctx.fillStyle = '#222'; ctx.fillText(v.name, x + 6, y + 3); }
    }
    // own aircraft
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(player.headingDeg * Math.PI / 180);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    // mission area marker
    if (mission && mission.area) {
      const a = toWorld(mission.area.lat, mission.area.lon);
      ctx.strokeStyle = 'rgba(31,52,104,0.7)'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(X(a.x), Y(a.z), mission.area.radius * s, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.fillStyle = '#3a2f1a'; ctx.font = '10px monospace';
    ctx.fillText('PLOT  N↑  10 nm grid', 6, 12);
    const bearingToBase = Math.atan2(base.x - px, -(base.z - pz)) * 180 / Math.PI;
    const dist = Math.hypot(base.x - px, base.z - pz) / H_SCALE / 1852;
    ctx.fillText(`BASE ${((bearingToBase + 360) % 360).toFixed(0).padStart(3, '0')}° ${dist.toFixed(0)} nm`, 6, H - 6);
  }
}
