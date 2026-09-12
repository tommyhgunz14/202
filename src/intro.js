// Launch intro: a cinematic run of cards shown once per page load before the title menu.
//   black → "A True Story.." → the situation in 1941 → the title over the harbour → three
//   stills of the crew walking out and boarding (about six seconds) → the menu.
// Any key, click or controller button skips the whole sequence.

const STILLS = ['intro_walk', 'intro_board', 'intro_cockpit'];
const ARCHIVE = ['photo_london_gunwharf', 'photo_briefing', 'photo_crew_dusk'];

const STORY = `Gibraltar, 1941. German U-boats and Italian submarines are slipping through the Strait to
prey on the convoys that keep Malta and the Middle East alive. Against them the Rock has one
squadron of flying boats: No. 202, its ageing Saro Londons and the first Catalinas, led by
Wing Commander Thomas Q. Horner, tasked to find and sink the boats before they reach the Atlantic.`;

export function runIntro(root, input, { onDone, onTitle } = {}) {
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `
    <div class="icard" id="intro-true"><p class="true">A True Story..</p></div>
    <div class="icard" id="intro-story"><p class="story">${STORY.replace(/\n/g, ' ')}</p></div>
    <div class="icard title" id="intro-title"><div class="photos">${ARCHIVE.map((n) => `<div class="ph" style="background-image:url(assets/intro/${n}.jpg)"></div>`).join('')}</div><div class="tt"><h1>Guardians of the Rock</h1><p class="sub">No. 202 Squadron &middot; Gibraltar</p></div></div>
    <div class="icard scenes" id="intro-scenes">${STILLS.map((n) => `<div class="still" style="background-image:url(assets/intro/${n}.jpg)"></div>`).join('')}</div>
    <div class="bars"><i></i><i></i></div>
    <div class="grain"></div>
    <div class="skip">Esc &middot; skip</div>`;
  root.appendChild(el);
  // preload the stills; any that is missing is dropped from the run
  const ready = Promise.all(STILLS.map((n) => new Promise((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = `assets/intro/${n}.jpg`; })));

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

  (async () => {
    await wait(900);
    show('intro-true', true); await wait(3200); show('intro-true', false); await wait(1400);
    show('intro-story', true); await wait(16000); show('intro-story', false); await wait(1400);
    onTitle && onTitle();
    // the title over the archive photographs, one dissolving into the next behind it
    show('intro-title', true);
    const phs = [...el.querySelectorAll('#intro-title .ph')];
    for (const ph of phs) { ph.classList.add('on'); await wait(3600); ph.classList.remove('on'); }
    show('intro-title', false); await wait(1200);
    const have = await ready;
    const stills = [...el.querySelectorAll('.still')].filter((_, i) => have[i]);
    if (stills.length) {
      show('intro-scenes', true);
      const per = 6000 / stills.length;
      for (const s of stills) { s.classList.add('on'); await wait(per); s.classList.remove('on'); }
      await wait(600);
    }
    finish();
  })();
  return { skip: finish };
}
