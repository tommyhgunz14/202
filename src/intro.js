// Launch intro: a cinematic run of cards shown once per page load before the title menu.
//   black → "A True Story.." → the situation in 1941 → the title over the harbour → three
//   stills of the crew walking out and boarding (about six seconds) → the menu.
// Any key, click or controller button skips the whole sequence.

const STILLS = ['intro_walk', 'intro_board', 'intro_cockpit'];
const ARCHIVE = ['photo_london_gunwharf', 'photo_briefing', 'photo_crew_dusk'];

const STORY = `Gibraltar, 1941. German U-Boats and Italian submarines are using the Gibraltar Strait to prey on
the convoys supplying Allied nations in the Mediterranean Ocean. Known commonly as 'The Rock', Gibraltar
stations a fearsome Allied force of Royal Air Force Flying Boats - Squadron 202, its fleet of Saro Londons,
Catalinas and Sunderlands would strike fear into any enemy submarine crew caught in their cross-hairs. Led by
Wing Commander Thomas Q. Horner callsign 'Jackie' these dedicated airmen were tasked to locate and destroy the
enemy subs before they were able to reach the Atlantic and unleash their reign of terror on the critical
Allied supply convoys.`;

export function runIntro(root, input, { onDone, onTitle, onMusic } = {}) {
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `
    <div class="icard" id="intro-true"><p class="true">A True Story</p></div>
    <div class="icard" id="intro-story"><p class="story">${STORY.replace(/\n/g, ' ')}</p></div>
    <div class="icard title" id="intro-title"><div class="photos">${[...ARCHIVE, ...STILLS].map((n) => `<div class="ph" style="background-image:url(assets/intro/${n}.jpg)"></div>`).join('')}</div><div class="tt"><h1>Guardians of the Rock</h1><p class="sub">No. 202 Squadron &middot; Gibraltar &middot; 1939&ndash;1944</p></div></div>
    <div class="bars"><i></i><i></i></div>
    <div class="grain"></div>
    <div class="skip">Esc &middot; skip</div>`;
  root.appendChild(el);
  // preload every picture; any that is missing is dropped from the run
  const ready = Promise.all([...ARCHIVE, ...STILLS].map((n) => new Promise((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = `assets/intro/${n}.jpg`; })));

  let done = false, timer = 0, cancel = [];
  const wait = (ms) => new Promise((r) => { const t = setTimeout(r, ms); cancel.push(() => clearTimeout(t)); });
  const show = (id, on) => { const c = el.querySelector('#' + id); if (c) c.classList.toggle('on', on); };
  const finish = () => {
    if (done) return; done = true;
    for (const c of cancel) c();
    el.classList.add('out');
    setTimeout(() => el.remove(), 1400);
    window.removeEventListener('keydown', skip); window.removeEventListener('pointerdown', skip);
    onDone && onDone();
  };
  // a click to focus the window must not lose the sequence: only Escape, Enter, Space, a
  // controller button or a click on the skip label end it
  const skip = (e) => { if (e && e.type === 'keydown' && !['Escape', 'Enter', 'Space'].includes(e.code)) return; if (e && e.type === 'pointerdown' && !(e.target && e.target.closest && e.target.closest('.skip'))) return; finish(); };
  setTimeout(() => { window.addEventListener('keydown', skip); window.addEventListener('pointerdown', skip); }, 800);
  // controller: poll the menu buttons
  const poll = setInterval(() => { if (done) return clearInterval(poll); const m = input.menuPoll(); if (m.accept || m.back) finish(); }, 120);

  // the cue runs from the first card through to the menu: asked for at once, and asked for
  // again on the first touch of the page in case the browser held it back until then
  if (onMusic) {
    onMusic();
    const kick = () => onMusic();
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    cancel.push(() => { window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); });
  }

  (async () => {
    await wait(900);
    show('intro-true', true); await wait(3200); show('intro-true', false); await wait(1400);
    show('intro-story', true); await wait(23000); show('intro-story', false); await wait(1400);
    onTitle && onTitle();
    // the title and subtitle hold over the whole picture sequence - the archive photographs
    // first, then the crew walking out and boarding - and only leave with the last of them
    show('intro-title', true);
    const have = await ready;
    const phs = [...el.querySelectorAll('#intro-title .ph')].filter((_, i) => have[i]);
    const n = Math.max(1, phs.length);
    const grade = (el2, g) => { el2.style.filter = `grayscale(${g.toFixed(2)}) sepia(${(0.3 * g).toFixed(2)}) contrast(${(1.06 + 0.06 * g).toFixed(2)}) brightness(${(0.52 + 0.06 * (1 - g)).toFixed(2)})`; };
    phs.forEach((p, i) => grade(p, 1 - i / n));
    for (let i = 0; i < phs.length; i++) {
      phs[i].classList.add('on');
      requestAnimationFrame(() => grade(phs[i], 1 - (i + 1) / n));   // this print comes up into colour while it is held
      await wait(3600);
      if (i < phs.length - 1) phs[i + 1].classList.add('on');        // cross-fade: the next is up before this one goes
      phs[i].classList.remove('on');
      await wait(i < phs.length - 1 ? 0 : 900);
    }
    show('intro-title', false); await wait(1200);
    finish();
  })();
  return { skip: finish };
}
