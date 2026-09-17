// Launch intro: a cinematic run of cards shown once per page load before the title menu.
//   black → "click, tap or press any key to begin" (passed over where sound is already allowed) →
//   "A True Story" → the situation in 1941 (the music begins here) → the title over the harbour → three
//   stills of the crew walking out and boarding (about six seconds) → the passing-out photograph of
//   winter 1930 with T. Q. Horner in the front row, coming up from grey into colour → the menu.
// Any key, click or controller button skips the whole sequence.

const STILLS = ['intro_walk', 'intro_board', 'intro_cockpit'];
const ARCHIVE = ['photo_london_gunwharf', 'photo_briefing', 'photo_crew_dusk'];
// the last picture is a real one: the family's print, colourised by hand (tools/colourise-passing-out.mjs)
const FINALE = 'passing_out_1930';
const PICS = [...ARCHIVE, ...STILLS, FINALE];

// the second card: a heading and four paragraphs, worded as supplied for the project
const STORY_HEAD = 'Gibraltar, 1941';
const STORY = [
  'German U-Boats and Italian submarines are using the Gibraltar Strait to prey on the convoys supplying Allied nations in the Mediterranean Ocean. Known commonly as \'The Rock\', Gibraltar stations a fearsome Allied force of Royal Air Force Flying Boats - Squadron 202.',
  'This fleet of Saro Londons, Catalinas and Sunderlands would come to strike fear across the enemy submarine fleets attempting to unleash their reign of terror across the critical Allied supply convoys.',
  'Led by Wing Commander Thomas Q. Horner - callsign \'Jackie\' - these dedicated airmen were tasked to locate and destroy the enemy subs, protect the supply convoys and help win the war for the Allies in the Mediterranean Ocean.',
];

export function runIntro(root, input, { onDone, onTitle, onMusic, onStory, soundAllowed } = {}) {
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `
    <div class="icard" id="intro-begin"><p class="begin">Click, tap or press any key to begin</p><p class="begin-sub">Sound on</p></div>
    <div class="icard" id="intro-true"><p class="true">A True Story</p></div>
    <div class="icard" id="intro-story"><div class="story-block"><p class="story-head">${STORY_HEAD}</p>${STORY.map((p) => `<p class="story">${p}</p>`).join('')}</div></div>
    <div class="icard title" id="intro-title"><div class="photos">${PICS.map((n) => `<div class="ph${n === FINALE ? ' finale' : ''}" data-pic="${n}"></div>`).join('')}</div><div class="tt"><h1>Guardians of the Rock</h1><p class="sub">No. 202 Squadron &middot; Gibraltar &middot; 1939&ndash;1944</p></div></div>
    <p class="fcap">Passing-out term, winter 1930 &middot; T. Q. Horner, seated second from left</p>
    <div class="bars"><i></i><i></i></div>
    <div class="grain"></div>
    <div class="skip">Esc &middot; skip</div>`;
  root.appendChild(el);
  // preload every picture; any that is missing is dropped from the run. Not at once: a player who
  // skips straight to a sortie should not wait on several megabytes of photographs.
  let ready = null;
  const preload = () => (ready ||= Promise.all(PICS.map((n) => new Promise((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = `assets/intro/${n}.jpg`; }))).then((have) => { for (const d of el.querySelectorAll('.ph[data-pic]')) d.style.backgroundImage = `url(assets/intro/${d.dataset.pic}.jpg)`; return have; }));

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
  const armSkip = () => setTimeout(() => { if (!done) { window.addEventListener('keydown', skip); window.addEventListener('pointerdown', skip); } }, 800);
  // controller: poll the menu buttons
  let begun = false, beginNow = null;
  const poll = setInterval(() => { if (done) return clearInterval(poll); const m = input.menuPoll(); if (!begun) { if ((m.accept || m.back) && beginNow) beginNow(); return; } if (m.accept || m.back) finish(); }, 120);

  // A browser plays no sound until the page itself has been clicked, tapped or keyed (the click that
  // opened the link does not count), so the intro opens by asking for that press, which also lets
  // the music begin on the story card. Where sound is already allowed the card is passed over.
  const begin = () => new Promise((resolve) => {
    const go = () => {
      if (begun) return; begun = true; el.classList.add('begun');
      window.removeEventListener('pointerdown', onPress); window.removeEventListener('keydown', onPress);
      resolve();
    };
    const onPress = (e) => { if (e.target && e.target.closest && e.target.closest('#startw')) return; go(); };
    beginNow = go;
    window.addEventListener('pointerdown', onPress);
    window.addEventListener('keydown', onPress);
    cancel.push(() => { window.removeEventListener('pointerdown', onPress); window.removeEventListener('keydown', onPress); });
    setTimeout(() => { if (!begun && soundAllowed && soundAllowed()) go(); }, 400);
  });

  // sound is set up at once (the title cue downloads now) and again on the first touch of the page,
  // in case the browser held it back until then; the cue itself begins with the story card (onStory)
  if (onMusic) {
    onMusic();
    const kick = () => onMusic();
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    cancel.push(() => { window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); });
  }

  (async () => {
    await wait(400);
    if (!(soundAllowed && soundAllowed())) show('intro-begin', true);
    await begin();
    if (done) return;
    show('intro-begin', false);
    armSkip();
    await wait(900);
    show('intro-true', true); await wait(3200); show('intro-true', false); await wait(1400);
    show('intro-story', true); if (onStory) onStory(); await wait(14000); if (!done) preload(); await wait(20000); show('intro-story', false); await wait(1400);
    onTitle && onTitle();
    // the title and subtitle hold over the whole picture sequence - the archive photographs
    // first, then the crew walking out and boarding - and only leave with the last of them
    show('intro-title', true);
    const have = await preload();
    const phs = [...el.querySelectorAll('#intro-title .ph')].filter((_, i) => have[i]);
    const n = Math.max(1, phs.filter((p) => !p.classList.contains('finale')).length);   // the grade runs over the stills; the photograph has its own
    const grade = (el2, g) => { el2.style.filter = `grayscale(${g.toFixed(2)}) sepia(${(0.3 * g).toFixed(2)}) contrast(${(1.06 + 0.06 * g).toFixed(2)}) brightness(${(0.52 + 0.06 * (1 - g)).toFixed(2)})`; };
    phs.forEach((p, i) => grade(p, 1 - i / n));
    for (let i = 0; i < phs.length; i++) {
      if (phs[i].classList.contains('finale')) {
        // the photograph itself: the title steps aside, the print is shown whole and bright, and
        // comes up from grey into colour over a longer hold
        el.querySelector('#intro-title').classList.add('finale-on');
        el.classList.add('finale-on');
        phs[i].style.filter = 'grayscale(1) sepia(0.25) contrast(1.02) brightness(0.9)';
        phs[i].classList.add('on');
        if (i > 0) phs[i - 1].classList.remove('on');
        await wait(1600);
        phs[i].style.filter = 'grayscale(0) sepia(0.06) contrast(1.02) brightness(0.98)';
        await wait(7400);
        phs[i].classList.remove('on');
        await wait(900);
        continue;
      }
      phs[i].classList.add('on');
      requestAnimationFrame(() => grade(phs[i], 1 - (i + 1) / n));   // this print comes up into colour while it is held
      await wait(3600);
      const nextFinale = phs[i + 1] && phs[i + 1].classList.contains('finale');
      if (i < phs.length - 1 && !nextFinale) phs[i + 1].classList.add('on');        // cross-fade: the next is up before this one goes
      if (!nextFinale) phs[i].classList.remove('on');
      await wait(i < phs.length - 1 ? 0 : 900);
    }
    show('intro-title', false); await wait(1200);
    finish();
  })();
  return { skip: finish };
}
