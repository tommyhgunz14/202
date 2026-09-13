import { AIRCRAFT, SCORE_LABELS, availableOn } from './data/aircraft.js';
import { MISSIONS, PILOT } from './data/missions.js';
import { PLATES } from './data/archive.js';

// period photographs (Atlas, RAF official style) shown at the start of a sortie
const PHOTOS = ['photo_london_gunwharf.jpg', 'photo_briefing.jpg', 'photo_swordfish_slip.jpg', 'photo_sunderland_moor.jpg', 'photo_uboat_air.jpg', 'photo_destroyer.jpg', 'photo_crew_dusk.jpg'];
// a period photograph of each type, for the right-hand panel of the sortie screen
const AIRCRAFT_PHOTO = { london: 'ac_saro_london.jpg', catalina: 'ac_catalina.jpg', sunderland: 'ac_sunderland.jpg', swordfish: 'ac_swordfish.jpg' };

// Menu flow: title → briefing (pilot) → mission list → aircraft select → fly → debrief.
export class UI {
  constructor(root, input) {
    this.root = root; this.input = input;
    this.screen = 'title';
    this.missionIdx = 0; this.aircraftIdx = 0;
    this.onStart = null;
    this.el = root;
    this.render();
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      this.act(a.dataset.action, a.dataset);
    });
  }

  act(action, data = {}) {
    if (action === 'title') this.screen = 'title';
    else if (action === 'pilot') this.screen = 'pilot';
    else if (action === 'missions') this.screen = 'missions';
    else if (action === 'controls') this.screen = 'controls';
    else if (action === 'history') this.screen = 'history';
    else if (action === 'archive') { this.screen = 'archive'; this.plateIdx = -1; }
    else if (action === 'plate') this.plateIdx = +data.idx;
    else if (action === 'plateclose') this.plateIdx = -1;
    else if (action === 'mission') { this.missionIdx = +data.idx; this.aircraftIdx = 0; this.screen = 'aircraft'; }
    else if (action === 'aircraft') { this.aircraftIdx = +data.idx; }
    else if (action === 'fly') { this.hide(); this.onStart && this.onStart(MISSIONS[this.missionIdx], this.currentAircraft()); return; }
    this.render();
  }

  // the right-hand panel at the start of a sortie: the aircraft's recognition card, the crew
  // walking out and boarding, and a couple of period photographs, cross-fading with a slow push
  cinePanel(a) {
    // a photograph of this very type, not the recognition card that already sits on the left
    const card = AIRCRAFT_PHOTO[a.id] ? 'assets/intro/' + AIRCRAFT_PHOTO[a.id] : 'assets/refs/' + a.asset.split('/').pop().replace('.js', '') + '.jpg';
    const pick = PHOTOS.slice();
    const i0 = this.missionIdx % pick.length, i1 = (this.missionIdx * 3 + 1) % pick.length;
    const shots = [card, 'assets/intro/intro_walk.jpg', 'assets/intro/' + pick[i0], 'assets/intro/intro_board.jpg', 'assets/intro/' + pick[i1 === i0 ? (i1 + 1) % pick.length : i1]];
    return '<div class="cine">' + shots.map((s, i) => `<div class="cslide" style="background-image:url(${s});animation-delay:${i * 5}s"></div>`).join('') + '<i></i></div>';
  }

  currentAircraft() {
    const m = MISSIONS[this.missionIdx];
    const list = this.aircraftList(m);
    return list[Math.min(this.aircraftIdx, list.length - 1)];
  }
  aircraftList(m) {
    if (m.anyAircraft) return Object.values(AIRCRAFT);
    return m.aircraft.map((id) => AIRCRAFT[id]);
  }

  show() { this.el.style.display = 'flex'; this.render(); }
  hide() { this.el.style.display = 'none'; }

  // keyboard / gamepad navigation
  poll() {
    if (this.el.style.display === 'none') return;
    const m = this.input.menuPoll();
    if (this.screen === 'title' && m.accept) this.act('pilot');
    else if (this.screen === 'pilot' && (m.accept)) this.act('missions');
    else if (this.screen === 'missions') {
      if (m.up) { this.missionIdx = (this.missionIdx + MISSIONS.length - 1) % MISSIONS.length; this.render(); }
      if (m.down) { this.missionIdx = (this.missionIdx + 1) % MISSIONS.length; this.render(); }
      if (m.accept) this.act('mission', { idx: this.missionIdx });
      if (m.back) this.act('pilot');
    } else if (this.screen === 'aircraft') {
      const n = this.aircraftList(MISSIONS[this.missionIdx]).length;
      if (m.left || m.up) { this.aircraftIdx = (this.aircraftIdx + n - 1) % n; this.render(); }
      if (m.right || m.down) { this.aircraftIdx = (this.aircraftIdx + 1) % n; this.render(); }
      if (m.accept) this.act('fly');
      if (m.back) this.act('missions');
    } else if (this.screen === 'debrief' && (m.accept || m.back)) this.act('missions');
    else if (this.screen === 'archive' && m.back) { if (this.plateIdx >= 0) this.act('plateclose'); else this.act('title'); }
    else if ((this.screen === 'controls' || this.screen === 'history') && (m.accept || m.back)) this.act('title');
  }

  debrief(result) { this.result = result; this.screen = 'debrief'; this.show(); }

  render() {
    const s = this.screen;
    let html = '';
    const nav = (back, backLabel = 'Back') => `<div class="nav"><button data-action="${back}">${backLabel}</button></div>`;
    if (s === 'title') {
      html = `<div class="title-card">
        <div class="crest">202</div>
        <h1>Guardians of the Rock</h1>
        <h2>No. 202 Squadron RAF · Gibraltar 1939–1943</h2>
        <p class="tag">Flying boats over the Strait. Submarines, blockade-runners and the neutral traffic of the narrows.</p>
        <div class="menu">
          <button class="primary" data-action="pilot">Begin · Sqn Ldr T. Q. Horner</button>
          <button data-action="controls">Controls (USB controller supported)</button>
          <button data-action="history">Sources &amp; accuracy</button>
          <button data-action="archive">Photograph archive</button>
        </div>
        <p class="hint">Enter / A to select · Esc / B to go back · plug in a controller at any time</p>
      </div>`;
    } else if (s === 'pilot') {
      html = `<div class="card wide">
        <h2>Pilot</h2>
        <h1>${PILOT.rank1} ${PILOT.name}</h1>
        <p class="sub">later ${PILOT.rank2} · No. 202 Squadron, Gibraltar</p>
        <p>${PILOT.bio}</p>
        <p class="small">The squadron's own record: 25 August 1939 war footing · 9 September move to Gibraltar · 11 September first patrols · 18 October 1940 Italian submarine sunk · 24 April 1941 Catalinas allocated · 2 May 1942 U-74 · 13 February 1943 U-620 · September 1944 relocation to Castle Archdale.</p>
        <div class="menu"><button class="primary" data-action="missions">Operations record</button>${nav('title')}</div>
      </div>`;
    } else if (s === 'missions') {
      html = `<div class="card wide"><h2>Operations record book</h2><div class="mission-list">` +
        MISSIONS.map((m, i) => `<button class="mission ${i === this.missionIdx ? 'sel' : ''}" data-action="mission" data-idx="${i}">
          <span class="date">${m.date}</span><span class="mtitle">${m.title}</span><span class="msub">${m.subtitle}</span></button>`).join('') +
        `</div>${nav('pilot')}</div>`;
    } else if (s === 'aircraft') {
      const m = MISSIONS[this.missionIdx];
      const list = this.aircraftList(m);
      const a = list[Math.min(this.aircraftIdx, list.length - 1)];
      const total = Object.values(a.scores).reduce((x, y) => x + y, 0);
      html = `<div class="card wide">
        <h2>${m.date} · ${m.title}</h2>
        <p class="brief">${m.brief}</p>
        <h3>Choose your aircraft</h3>
        <div class="ac-tabs">${list.map((x, i) => `<button class="${i === this.aircraftIdx ? 'sel' : ''}" data-action="aircraft" data-idx="${i}">${x.name}</button>`).join('')}</div>
        <div class="ac-detail">
          <div class="ac-info">
            <img class="ac-ref" src="assets/refs/${a.asset.split('/').pop().replace('.js', '')}.jpg" onerror="this.style.display='none'" alt="">
            <h1>${a.name}</h1>
            <p class="sub">${a.maker} · ${a.code} · ${a.serial} · crew ${a.crew}</p>
            <p>${a.notes}</p>
            <table class="spec">
              <tr><td>Engines</td><td>${a.engines}</td></tr>
              <tr><td>Max speed</td><td>${a.maxSpeed} mph</td></tr>
              <tr><td>Cruise</td><td>${a.cruise} mph</td></tr>
              <tr><td>Ceiling</td><td>${a.ceiling.toLocaleString()} ft</td></tr>
              <tr><td>Range</td><td>${a.range.toLocaleString()} miles</td></tr>
              <tr><td>Guns</td><td>${a.guns.map((g) => g.name).join('; ')}</td></tr>
              <tr><td>Stores</td><td>${a.stores.count} × ${a.stores.kind}</td></tr>
              <tr><td>Radar</td><td>${a.asv ? 'ASV Mk II' : 'none'}</td></tr>
            </table>
          </div>
          <div class="ac-scores">
            ${this.cinePanel(a)}
            ${Object.keys(a.scores).map((k) => `<div class="score"><span>${SCORE_LABELS[k]}</span><i><b style="width:${a.scores[k] * 10}%"></b></i><em>${a.scores[k]}</em></div>`).join('')}
            <div class="score total"><span>Overall</span><i><b style="width:${total / 80 * 100}%"></b></i><em>${total}/80</em></div>
          </div>
        </div>
        <div class="menu"><button class="primary" data-action="fly">Take off</button>${nav('missions')}</div>
      </div>`;
    } else if (s === 'controls') {
      html = `<div class="card wide"><h2>Controls</h2>
        <div class="controls">
          <div><h3>USB controller (standard mapping · Xbox / PlayStation / generic)</h3>
            <table>
              <tr><td>Left stick</td><td>Pitch (pull back = nose up) &amp; roll</td></tr>
              <tr><td>Right stick X</td><td>Rudder</td></tr>
              <tr><td>RT / LT</td><td>Throttle up / down</td></tr>
              <tr><td>D-pad ↑ ↓</td><td>Throttle up / down</td></tr>
              <tr><td>A or RB</td><td>Fire guns</td></tr>
              <tr><td>B</td><td>Drop depth charge / bomb</td></tr>
              <tr><td>X</td><td>W/T sighting report</td></tr>
              <tr><td>Y</td><td>Cycle view: chase · cockpit · bomb aimer · gun positions</td></tr>
              <tr><td>LB</td><td>Depth-charge setting 25 / 50 / 100 ft</td></tr>
              <tr><td>D-pad ← →</td><td>ASV range scale</td></tr>
              <tr><td>L3</td><td>Water brake (taxiing)</td></tr>
              <tr><td>Start</td><td>Pause</td></tr>
            </table></div>
          <div><h3>Keyboard</h3>
            <table>
              <tr><td>↑ ↓ or W S</td><td>Nose down / nose up</td></tr>
              <tr><td>← → or A D</td><td>Roll</td></tr>
              <tr><td>Q E</td><td>Rudder</td></tr>
              <tr><td>Shift / Ctrl</td><td>Throttle up / down</td></tr>
              <tr><td>Space</td><td>Fire guns</td></tr>
              <tr><td>B</td><td>Drop depth charge / bomb</td></tr>
              <tr><td>R</td><td>W/T sighting report</td></tr>
              <tr><td>V</td><td>Cycle view: chase · cockpit · bomb aimer · gun positions</td></tr>
              <tr><td>I</td><td>Gunner elevation: inverted (default) ⇄ normal</td></tr>
              <tr><td>F</td><td>Depth-charge setting</td></tr>
              <tr><td>T</td><td>ASV range scale</td></tr>
              <tr><td>X</td><td>Water brake</td></tr>
              <tr><td>Esc / P</td><td>Pause</td></tr>
            </table></div>
        </div>
        <p class="small">Take-off: full throttle, hold the nose up gently once past 70–80 mph. Identify a vessel by flying within 800 m of it below 1,500 ft. To attack a submarine: come in low (under 100 ft) along her length and release as the bow passes under the nose; depth charges sink at about 10 ft/s and detonate at the set depth.</p>
        ${nav('title')}</div>`;
    } else if (s === 'history') {
      html = `<div class="card wide"><h2>Sources &amp; accuracy</h2>
        <p>The squadron timeline, aircraft, serials and sinkings are taken from the No. 202 Squadron record at the Wartime Memories Project, the History of War and RAFweb squadron histories, uboat.net, and Andrew Thomas's article "Guardians from the Rock" (Britain at War / Key Military), which supplied the details of the squadron's arrival on 9–10 September 1939 under Wg Cdr E. A. Blake, its headquarters on the North Mole, the moorings at the Gun Wharf, the first patrol by London K9683 on 11 September, and Flt Lt Norman Eagleton's interception of a German freighter on 26 December 1939. The remainder of that article is behind a paywall; the pilot's own experiences beyond what is public are represented by the sorties themselves rather than invented detail.</p>
        <h3>Command of the squadron</h3>
        <table class="spec">
          <tr><td>Sep 1939</td><td>Wg Cdr E. A. Blake brings the squadron to Gibraltar and forms it there with six Saro London Mk II (documented)</td></tr>
          <tr><td>1939&ndash;1944</td><td>The squadron is at Gibraltar throughout, moving to the Azores in September 1944 (documented)</td></tr>
          <tr><td>Undated</td><td>Sqn Ldr, later Wg Cdr, T. Q. Horner &mdash; the player. His dates of command and of promotion are not established by any source consulted here, and the game does not invent them: the promotion is staged at a documented squadron milestone, not a documented personal one</td></tr>
        </table>
        <p class="small">No continuous list of commanding officers for No. 202 Squadron at Gibraltar appears in the public references used here. Where a name and date are not documented, none is asserted.</p>
        <p>Geography follows the chart of the Strait: the Rock (426 m), the harbour's North, Detached and South Moles, Europa Point light, Algeciras Bay, Tarifa, Ceuta and Jebel Musa. Horizontal distances are compressed four to one so a patrol fits a sitting; aircraft and ships are modelled at true size. Liveries: Temperate Sea Scheme (Extra Dark Sea Grey / Dark Slate Grey) with Sky or Sky Grey undersides for 1939–41, the 1942 Coastal Command white sides and undersides for the Catalina and Sunderland; codes TQ (1939–43) and AX (1941–43); Type A1 fuselage roundels and Type B on the wings. Serials K9683, K6931, AH538, AH553, AH544, Z2147 are recorded squadron aircraft; K8422 and W3985 are representative.</p>
        <p>Depth charges are the 250 lb Mk VIII (Torpex from mid-1942) with the shallow 25 ft setting that Coastal Command adopted for surfaced boats. The ASV Mk II display is drawn as the real A-scope: range up the trace, echoes to port or starboard. See <code>docs/HISTORY.md</code> in the project for the full list.</p>
        <div class="menu"><button data-action="archive">Photograph archive</button>${nav('title')}</div></div>`;
    } else if (s === 'archive') {
      const have = PLATES;
      const plate = this.plateIdx >= 0 ? have[this.plateIdx] : null;
      if (plate) {
        html = `<div class="card wide">
          <h2>${plate.title}</h2>
          <p class="sub">${plate.date}${plate.kind === 'archive' ? '' : ' · reconstruction, not a photograph'}</p>
          <img class="plate-big" src="${plate.file}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <p class="missing" style="display:none">This plate is not in <code>assets/archive/</code> yet.</p>
          <p class="brief">${plate.caption}</p>
          <p class="small">${plate.credit}</p>
          <div class="menu"><button class="primary" data-action="plateclose">Back to the archive</button></div>
        </div>`;
      } else {
        const card = (p, i) => `<button class="plate" data-action="plate" data-idx="${i}">
            <span class="pimg" style="background-image:url(${p.file})"></span>
            <b>${p.title}</b><em>${p.date}</em>
          </button>`;
        const real = have.map((p, i) => [p, i]).filter(([p]) => p.kind === 'archive');
        const recon = have.map((p, i) => [p, i]).filter(([p]) => p.kind !== 'archive');
        html = `<div class="card wide">
          <h2>Photograph archive</h2>
          <p class="brief">Pictures of the squadron's ground: the Rock, the harbour, the aircraft and the men.
            Photographs of the period are kept apart from the reconstructions made for this game, so that
            nothing here is taken for something it is not.</p>
          ${real.length ? `<h3>Photographs</h3><div class="plates">${real.map(([p, i]) => card(p, i)).join('')}</div>` : ''}
          ${recon.length ? `<h3>Reconstructions</h3><div class="plates">${recon.map(([p, i]) => card(p, i)).join('')}</div>` : ''}
          <p class="small">To add a plate: put the file in <code>assets/archive/</code> and add an entry to
            <code>src/data/archive.js</code>.</p>
          ${nav('title')}</div>`;
      }
    } else if (s === 'debrief') {
      const r = this.result;
      html = `<div class="card wide"><h2>Debrief · ${r.mission.date} · ${r.mission.title}</h2>
        <h1 class="${r.success ? 'ok' : 'bad'}">${r.success ? 'Sortie completed' : r.crashed ? 'Aircraft lost' : 'Sortie ended'}</h1>
        <p class="sub">${r.aircraft.name} ${r.aircraft.code} · ${r.summary}</p>
        <div class="orb"><h3>Operations Record Book — Form 541</h3><pre>${r.orb}</pre></div>
        <table class="spec">
          ${r.objectives.map((o) => `<tr><td>${o.done ? '✔' : o.failed ? '✘' : '—'}</td><td>${o.text}</td></tr>`).join('')}
          <tr><td>Score</td><td><b>${r.score}</b></td></tr>
        </table>
        <div class="menu"><button class="primary" data-action="missions">Operations record</button><button data-action="title">Title</button></div>
      </div>`;
    }
    this.el.innerHTML = html;
  }
}
