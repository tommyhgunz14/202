import { FT, MPH } from './config.js?v=202609171221';

// Instrument panel for the first-person view, drawn on a 2D canvas in the RAF "basic six"
// layout: airspeed, artificial horizon, climb; altimeter, direction indicator, turn & slip;
// plus boost/rpm gauges and the P8 compass. Values in the period units (mph, feet).
export class Cockpit {
  constructor(canvas) { this.c = canvas; }

  gauge(ctx, x, y, r, label) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0e10'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#2b2d30'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#4a4d52'; ctx.beginPath(); ctx.arc(x, y, Math.max(1, r - 4), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#c9c6b5'; ctx.font = `${Math.max(8, r * 0.17)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r * 0.55);
  }
  needle(ctx, x, y, r, ang, w = 2, col = '#e8e2c8', len = 0.85) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, r * 0.15); ctx.lineTo(0, -r * len); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, w * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ticks(ctx, x, y, r, n, start, span, labels, big = 5) {
    ctx.fillStyle = '#e8e2c8'; ctx.font = `${Math.max(7, r * 0.16)}px monospace`; ctx.textAlign = 'center';
    for (let i = 0; i <= n; i++) {
      const a = start + span * i / n;
      const isBig = i % big === 0;
      ctx.strokeStyle = '#e8e2c8'; ctx.lineWidth = isBig ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x + Math.sin(a) * r * 0.78, y - Math.cos(a) * r * 0.78); ctx.lineTo(x + Math.sin(a) * r * (isBig ? 0.68 : 0.72), y - Math.cos(a) * r * (isBig ? 0.68 : 0.72)); ctx.stroke();
      if (isBig && labels) { const l = labels[i / big]; if (l != null) ctx.fillText(String(l), x + Math.sin(a) * r * 0.55, y - Math.cos(a) * r * 0.55 + 3); }
    }
  }

  draw(flight, spec, weapons, state) {
    const c = this.c, ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    if (W < 60 || H < 40) return;
    ctx.clearRect(0, 0, W, H);
    // panel: dark green-grey metal with a lighter sill along the top and a line of rivets
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#23262a'); bg.addColorStop(0.45, '#181a1c'); bg.addColorStop(1, '#121315');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2d3134'; ctx.fillRect(0, 0, W, 7);
    ctx.fillStyle = '#3a3f43';
    for (let x = 10; x < W; x += 26) ctx.fillRect(x, 11, 2, 2);
    const r = Math.min(H * 0.30, W / 16);
    const row1 = H * 0.33, row2 = H * 0.72;
    const cx = W * 0.40;
    const cols = [cx - r * 2.3, cx, cx + r * 2.3];
    // the six are mounted together on their own sub-panel, as on the real aircraft
    {
      const x0 = cols[0] - r * 1.55, y0 = row1 - r * 1.5;
      const w = r * 7.7, h = (row2 - row1) + r * 3;
      ctx.fillStyle = '#2b2e32'; ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = '#4c5055'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, w, h);
      ctx.fillStyle = '#5a5f64';
      for (const px of [x0 + 6, x0 + w - 8]) for (const py of [y0 + 6, y0 + h - 8]) ctx.fillRect(px, py, 3, 3);
    }
    const mph = flight.speed * MPH, alt = Math.max(0, flight.altitude) * FT;
    // ASI
    this.gauge(ctx, cols[0], row1, r, 'M.P.H.');
    this.ticks(ctx, cols[0], row1, r, 24, -Math.PI * 0.85, Math.PI * 1.7, [0, 50, 100, 150, 200, 250], 4);
    this.needle(ctx, cols[0], row1, r, -Math.PI * 0.85 + Math.PI * 1.7 * Math.min(1, mph / 250));
    // artificial horizon
    {
      const x = cols[1], y = row1;
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 5, 0, Math.PI * 2); ctx.clip();
      ctx.translate(x, y); ctx.rotate(-flight.bank);
      const pitchPx = flight.pitch * r * 2.2;
      ctx.fillStyle = '#5c8fbf'; ctx.fillRect(-r * 2, -r * 3 + pitchPx, r * 4, r * 3);
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-r * 2, pitchPx, r * 4, r * 3);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-r, pitchPx); ctx.lineTo(r, pitchPx); ctx.stroke();
      for (const d of [-20, -10, 10, 20]) { const yy = pitchPx + d * Math.PI / 180 * r * 2.2; ctx.beginPath(); ctx.moveTo(-r * 0.25, yy); ctx.lineTo(r * 0.25, yy); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = '#f3c14b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x - r * 0.15, y); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x + r * 0.15, y); ctx.lineTo(x + r * 0.5, y); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#2b2d30'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#c9c6b5'; ctx.font = `${r * 0.17}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('HORIZON', x, y + r * 0.8);
    }
    // climb
    this.gauge(ctx, cols[2], row1, r, 'CLIMB ft/min');
    this.ticks(ctx, cols[2], row1, r, 16, -Math.PI * 0.8, Math.PI * 1.6, ['-2', '-1', '0', '+1', '+2'], 4);
    this.needle(ctx, cols[2], row1, r, Math.max(-Math.PI * 0.8, Math.min(Math.PI * 0.8, flight.vertSpeed * FT * 60 / 2000 * Math.PI * 0.8)));
    // altimeter
    this.gauge(ctx, cols[0], row2, r, 'FEET');
    this.ticks(ctx, cols[0], row2, r, 50, 0, Math.PI * 2, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0], 5);
    this.needle(ctx, cols[0], row2, r, (alt % 10000) / 10000 * Math.PI * 2, 3, '#e8e2c8', 0.55);
    this.needle(ctx, cols[0], row2, r, (alt % 1000) / 1000 * Math.PI * 2, 2, '#e8e2c8', 0.8);
    // direction indicator
    {
      const x = cols[1], y = row2;
      this.gauge(ctx, x, y, r, '');
      ctx.save(); ctx.translate(x, y); ctx.rotate(-flight.headingDeg * Math.PI / 180);
      ctx.fillStyle = '#e8e2c8'; ctx.font = `${r * 0.22}px sans-serif`; ctx.textAlign = 'center';
      for (let i = 0; i < 36; i++) {
        const a = i * 10 * Math.PI / 180;
        ctx.strokeStyle = '#e8e2c8'; ctx.lineWidth = i % 3 === 0 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(Math.sin(a) * r * 0.8, -Math.cos(a) * r * 0.8); ctx.lineTo(Math.sin(a) * r * (i % 3 === 0 ? 0.68 : 0.74), -Math.cos(a) * r * (i % 3 === 0 ? 0.68 : 0.74)); ctx.stroke();
        if (i % 9 === 0) { const l = ['N', 'E', 'S', 'W'][i / 9]; ctx.fillText(l, Math.sin(a) * r * 0.52, -Math.cos(a) * r * 0.52 + r * 0.08); }
        else if (i % 3 === 0) { ctx.font = `${r * 0.14}px monospace`; ctx.fillText(String(i), Math.sin(a) * r * 0.52, -Math.cos(a) * r * 0.52 + r * 0.05); ctx.font = `${r * 0.22}px sans-serif`; }
      }
      ctx.restore();
      ctx.strokeStyle = '#f3c14b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - r * 0.92); ctx.lineTo(x, y - r * 0.62); ctx.stroke();
      ctx.fillStyle = '#c9c6b5'; ctx.font = `${r * 0.17}px sans-serif`; ctx.fillText(`${flight.headingDeg.toFixed(0).padStart(3, '0')}°`, x, y + r * 0.3);
    }
    // turn & slip
    this.gauge(ctx, cols[2], row2, r, 'TURN & SLIP');
    this.needle(ctx, cols[2], row2, r, Math.max(-0.8, Math.min(0.8, -flight.bank * 0.9)), 2, '#e8e2c8', 0.7);
    ctx.fillStyle = '#e8e2c8'; ctx.beginPath(); ctx.arc(cols[2] + Math.sin(flight.bank) * r * 0.35 * (flight.onWater ? 0 : 1) * 0.3, row2 + r * 0.45, 4, 0, Math.PI * 2); ctx.fill();
    // engines: boost & rpm per engine
    const ecount = Math.min(4, spec.engines.startsWith('4') ? 4 : spec.engines.startsWith('2') ? 2 : 1);
    const eg = r * 0.5, ex0 = cx + r * 4.6;
    {
      const pad = eg * 1.5, top = row1 - eg * 2.0;
      const h = ecount * eg * 2.7 + eg * 0.6;
      ctx.fillStyle = '#212427'; ctx.fillRect(ex0 - pad, top, eg * 5.4, h);
      ctx.strokeStyle = '#41464b'; ctx.lineWidth = 1.5; ctx.strokeRect(ex0 - pad, top, eg * 5.4, h);
    }
    for (let i = 0; i < ecount; i++) {
      const y = row1 - eg * 0.8 + i * eg * 2.7;
      this.gauge(ctx, ex0, y, eg, `RPM ${i + 1}`);
      this.needle(ctx, ex0, y, eg, -Math.PI * 0.8 + Math.PI * 1.6 * flight.rpm * flight.engineHealth, 2);
      this.gauge(ctx, ex0 + eg * 2.4, y, eg, 'BOOST');
      this.needle(ctx, ex0 + eg * 2.4, y, eg, -Math.PI * 0.8 + Math.PI * 1.6 * state.throttle, 2);
    }
    // fuel and oil on the captain's side, left of the six
    for (let i = 0; i < 2; i++) {
      const gx = cols[0] - r * 2.7, gy = row1 + i * r * 1.5;
      const v = i ? 0.5 + 0.45 * flight.engineHealth : Math.max(0.04, flight.fuel);
      this.gauge(ctx, gx, gy, eg * 0.92, i ? 'OIL' : 'FUEL');
      this.needle(ctx, gx, gy, eg * 0.92, -Math.PI * 0.7 + Math.PI * 1.4 * v, 2);
    }
    // stores & fuel
    ctx.textAlign = 'left'; ctx.font = `${Math.max(10, r * 0.2)}px monospace`;
    const sx = W * 0.865;
    ctx.fillStyle = '#c9c6b5';
    ctx.fillText(`${spec.stores.label.toUpperCase()}`, sx, row1 - r * 0.6);
    for (let i = 0; i < spec.stores.count; i++) {
      ctx.fillStyle = i < state.stores ? '#d8b43c' : '#3a3b3d';
      ctx.fillRect(sx + (i % 4) * 16, row1 - r * 0.4 + Math.floor(i / 4) * 14, 12, 10);
    }
    ctx.fillStyle = '#c9c6b5';
    ctx.fillText(`DEPTH ${weapons.depthSetting} FT`, sx, row1 + r * 0.25);
    ctx.fillText(`FUEL ${(flight.fuel * 100).toFixed(0)}%`, sx, row2 - r * 0.4);
    ctx.fillStyle = flight.damage > 0.5 ? '#d84a3a' : '#c9c6b5';
    ctx.fillText(`DAMAGE ${(flight.damage * 100).toFixed(0)}%`, sx, row2 - r * 0.05);
    ctx.fillStyle = '#c9c6b5';
    ctx.fillText(`AMMO ${state.ammo}`, sx, row2 + r * 0.3);
    ctx.fillText(state.padName ? 'CONTROLLER ✓' : 'KEYBOARD', sx, row2 + r * 0.65);
  }
}
