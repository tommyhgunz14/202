// On-screen controls for phones and tablets. They feed the same Input state as the keyboard and
// controller: the stick gives pitch and roll (push up = nose down, like the arrow keys), the
// buttons send the same one-shot presses as their keys, and the throttle is the lever at the side
// of the screen, dragged directly. Shown only once the device has been touched, and only while flying.
const BUTTONS = [
  // id, label, kind: 'hold' sets a flag while pressed, 'key' sends one press of that key code
  ['bfire', 'Fire', 'hold', 'fire'],
  ['bdrop', 'Drop', 'key', 'KeyB'],
  ['breport', 'Report', 'key', 'KeyR'],
  ['bdepth', 'Depth<br><small>25 ft</small>', 'key', 'KeyF'],
  ['bview', 'View', 'key', 'KeyV'],
  ['bff', '<b class="ffi">&#9654;&#9654;</b>', 'key', 'KeyN'],   // quick play: press on at speed
];

export function initTouch(input) {
  const t = input.touch = { pitch: 0, roll: 0, fire: false };
  const el = document.createElement('div');
  el.id = 'touch';
  el.innerHTML = `
    <div id="stick"><div class="ring"></div><div class="knob"></div></div>
    <div class="tbtns">${BUTTONS.map(([id, label]) => `<button id="${id}" type="button">${label}</button>`).join('')}</div>
    <button id="bpause" type="button" aria-label="Pause">II</button>`;
  document.body.appendChild(el);

  const on = () => document.body.classList.add('touch');
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) on();
  window.addEventListener('touchstart', on, { passive: true, once: true });
  // no long-press menus, text selection or page scroll from the control surface
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

  // the stick reads from its own centre, so a finger that lands anywhere on it and slides
  // steers at once; the knob is held to the ring
  const stick = el.querySelector('#stick'), knob = stick.querySelector('.knob');
  let sid = null;
  const move = (e) => {
    const r = stick.getBoundingClientRect(), R = r.width * 0.5;
    let dx = (e.clientX - (r.left + R)) / (R * 0.8), dy = (e.clientY - (r.top + R)) / (R * 0.8);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    t.roll = dx; t.pitch = dy;        // finger up (negative y) = push forward = nose down
    knob.style.transform = `translate(${dx * R * 0.8}px, ${dy * R * 0.8}px)`;
  };
  const release = (e) => {
    if (e.pointerId !== sid) return;
    sid = null; t.roll = 0; t.pitch = 0; knob.style.transform = '';
  };
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; move(e); try { stick.setPointerCapture(e.pointerId); } catch (_) { /* capture is a nicety */ } });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) move(e); });
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);

  const hold = (id, flag) => {
    const b = el.querySelector('#' + id);
    const set = (v) => (e) => { t[flag] = v; b.classList.toggle('on', v); if (v) try { b.setPointerCapture(e.pointerId); } catch (_) { /* capture is a nicety */ } };
    b.addEventListener('pointerdown', set(true));
    b.addEventListener('pointerup', set(false));
    b.addEventListener('pointercancel', set(false));
  };
  // the throttle lever: a finger on it sets the throttle to where it is on the track
  const lever = document.getElementById('lever');
  if (lever) {
    const track = lever.querySelector('.track');
    let lid = null;
    const setThr = (e) => { const r = track.getBoundingClientRect(); input.throttle = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)); };
    lever.addEventListener('pointerdown', (e) => { if (!document.body.classList.contains('touch')) return; lid = e.pointerId; setThr(e); e.preventDefault(); try { lever.setPointerCapture(e.pointerId); } catch (_) { /* capture is a nicety */ } });
    lever.addEventListener('pointermove', (e) => { if (e.pointerId === lid) setThr(e); });
    const up = (e) => { if (e.pointerId === lid) lid = null; };
    lever.addEventListener('pointerup', up); lever.addEventListener('pointercancel', up);
    lever.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }
  const press = (id, code) => el.querySelector('#' + id).addEventListener('pointerdown', () => input.pressed.add(code));
  for (const [id, , kind, arg] of BUTTONS) (kind === 'hold' ? hold(id, arg) : press(id, arg));
  press('bpause', 'Escape');

  // the depth button shows the pistol setting the next charges will carry
  const depthLabel = el.querySelector('#bdepth small');
  let depthShown = 25;
  const api = { setDepth(ft) { if (ft !== depthShown) { depthShown = ft; depthLabel.textContent = ft + ' ft'; } } };

  // the crew walk-out and the promotion card are skipped by tapping their skip label
  document.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('#crew-cine .skip')) input.pressed.add('Escape');
  });
  return api;
}
