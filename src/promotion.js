// A short cinematic card before the Casablanca sortie: Sqn Ldr T. Q. Horner is promoted Wing
// Commander. He took command at the end of July 1940 and the squadron record calls him Wing
// Commander by 28 January 1941, so the card sits at the front of that sortie. The exact date of
// the promotion within that bracket is not recorded, and Sources & accuracy says so.

const CARD = {
  photo: 'assets/intro/promo_horner.jpg',
  title: 'Promotion',
  place: 'Gibraltar &middot; winter 1940&ndash;41',
  body: 'Squadron Leader T. Q. Horner took command of No. 202 Squadron at the end of July 1940. '
      + 'By the last week of January 1941 the squadron record calls him Wing Commander. The third '
      + 'ring goes on his cuff on the quay, and within days he is away down the African coast in '
      + 'a Saro London with two Vichy fighters closing on him.',
};

// shown once per mission start; resolves when it is over or the player skips it
export function showPromotion(root, _input) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'promo';
    el.innerHTML = `
      <div class="ph" style="background-image:url(${CARD.photo})"></div>
      <div class="txt">
        <h2>${CARD.title}</h2>
        <p class="where">${CARD.place}</p>
        <p class="body">${CARD.body}</p>
      </div>
      <div class="bars"><i></i><i></i></div>
      <div class="skip">Esc &middot; skip</div>`;
    root.appendChild(el);
    let done = false;
    const timers = [];
    const opened = Date.now();
    const MIN_MS = 1250;                    // nothing dismisses the card before this

    const finish = () => {
      if (done || Date.now() - opened < MIN_MS) return; done = true;
      for (const t of timers) clearTimeout(t);
      window.removeEventListener('keydown', key);
      el.classList.remove('on'); el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 900);
    };
    const key = (e) => { if (['Escape', 'Enter', 'Space'].includes(e.code)) finish(); };
    timers.push(setTimeout(() => {
      window.addEventListener('keydown', key);
      el.addEventListener('click', finish);
    }, MIN_MS));
    requestAnimationFrame(() => el.classList.add('on'));
    timers.push(setTimeout(() => el.classList.add('lit'), 1400));   // the photograph comes up
    timers.push(setTimeout(finish, 11000));
  });
}
