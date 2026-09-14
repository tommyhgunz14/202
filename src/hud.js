import { FT, MPH, H_SCALE } from './config.js';

// Chase-view HUD and the shared message/objective panels (DOM).
export class Hud {
  constructor(root) {
    this.root = root;
    this.el = {
      top: root.querySelector('#hud-top'),
      obj: root.querySelector('#hud-objectives'),
      log: root.querySelector('#hud-log'),
      contact: root.querySelector('#hud-contact'),
      warn: root.querySelector('#hud-warn'),
      reticle: root.querySelector('#reticle'),
      guide: document.getElementById('hud-guide'),
      knob: document.getElementById('lever-knob'), ias: document.getElementById('ias-bar'), stall: document.getElementById('ias-stall'), lval: document.getElementById('lever-val'),
    };
    this.lines = [];
  }
  log(text, cls = '') {
    this.lines.push({ text, cls, t: performance.now() });
    if (this.lines.length > 7) this.lines.shift();
    this.el.log.innerHTML = this.lines.map((l) => `<div class="${l.cls}">${l.text}</div>`).join('');
  }
  update(flight, spec, weapons, state, objectives, contact, view) {
    const mph = flight.speed * MPH, alt = Math.max(0, flight.altitude) * FT;
    this.el.top.innerHTML =
      `<span><b>${spec.name}</b> ${spec.code} · ${spec.serial}</span>` +
      `<span>IAS <b>${mph.toFixed(0)}</b> mph</span>` +
      `<span>ALT <b>${alt.toFixed(0)}</b> ft</span>` +
      `<span>HDG <b>${flight.headingDeg.toFixed(0).padStart(3, '0')}</b>°</span>` +
      `<span>THR <b>${(state.throttle * 100).toFixed(0)}</b>%</span>` +
      `<span>${spec.stores.label.toUpperCase()} <b>${state.stores}</b>/${spec.stores.count} · ${weapons.depthSetting} ft</span>` +
      `<span>AMMO <b>${state.ammo}</b></span>` +
      `<span>FUEL <b>${(flight.fuel * 100).toFixed(0)}</b>%</span>` +
      `<span class="${flight.damage > 0.5 ? 'bad' : ''}">DMG <b>${(flight.damage * 100).toFixed(0)}</b>%</span>` +
      `<span>${state.time}</span>` +
      `<span>${view === 'cockpit' ? 'COCKPIT' : view.startsWith('gun:') ? 'GUNNER ' + view.slice(8).toUpperCase() : view === 'bombsight' ? 'BOMB AIMER' : 'CHASE'} · ${state.padName ? '🎮 ' + state.padName.slice(0, 22) : 'keyboard'}</span>`;
    this.el.obj.innerHTML = objectives.map((o) => `<div class="${o.done ? 'done' : o.failed ? 'failed' : ''}">${o.done ? '☑' : o.failed ? '☒' : '☐'} ${o.text}</div>`).join('');
    if (contact) {
      const d = contact.dist / H_SCALE / 1852;
      this.el.contact.style.display = 'block';
      // recognition card: the generated reference picture of the type, once identified
      // a card that failed to load once is not asked for again (the panel is rebuilt every frame)
      const def = contact.v.def, noRef = (window.__noRef ||= {});
      const ref = contact.v.identified && def && !noRef[def] ? `<img class="refcard" src="assets/refs/${def}.jpg" onerror="window.__noRef['${def}']=1;this.style.display='none'" alt="">` : '';
      this.el.contact.innerHTML = contact.v.identified
        ? `${ref}<b>${contact.v.name}</b><br>${contact.v.label}${contact.v.kind === 'submarine' ? (contact.v.surfaced ? ' — SURFACED' : ' — DIVED') : ''}<br>${d.toFixed(1)} nm · brg ${contact.brg.toFixed(0).padStart(3, '0')}°`
        : `<b>Unidentified vessel</b><br>${d.toFixed(1)} nm · brg ${contact.brg.toFixed(0).padStart(3, '0')}°<br><span class="idbar"><i style="width:${(contact.v.idProgress * 100).toFixed(0)}%"></i></span> close in below 1,500 ft to identify`;
    } else this.el.contact.style.display = 'none';
    const warns = [];
    if (!flight.onWater && flight.speed < flight.vStall * 1.1) warns.push('STALL');
    if (flight.altitude * FT < 150 && !flight.onWater) warns.push('LOW');
    if (flight.fuel < 0.15) warns.push('FUEL');
    if (flight.damage > 0.6) warns.push('DAMAGE');
    this.el.warn.textContent = warns.join('  ');
    this.el.guide.textContent = state.guide || '';
    this.el.reticle.style.display = (view === 'chase' || view === 'bombsight') ? 'none' : 'block';
    // throttle quadrant and airspeed strip
    const trackH = 268;
    this.el.knob.style.top = (16 + (1 - state.throttle) * trackH) + 'px';
    this.el.ias.style.height = (Math.min(1, flight.speed / flight.vMax) * 100) + '%';
    this.el.stall.style.bottom = (Math.min(1, flight.vStall / flight.vMax) * 100) + '%';
    this.el.lval.textContent = (state.throttle * 100).toFixed(0) + '%  ·  ' + mph.toFixed(0) + ' mph';
  }
}
