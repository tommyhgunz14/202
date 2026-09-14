// The crew walk-out as a film sequence rather than 3D figures: generated period footage of the
// crew going out to their aircraft type, shown full screen between the letterbox bars, with the
// live 3D walk-out running underneath. When the last shot fades, the aircraft is already buttoned
// up at her berth and the engines start.
//
// The shots for each aircraft type are listed in assets/cine/shots.json, in order, e.g.
//   { "catalina": ["crew_catalina_1.mp4", "crew_catalina_2.mp4"], "swordfish": ["crew_swordfish_1.jpg"] }
// .mp4 files are played muted one after another; .jpg stills are held with a slow push-in and
// cross-fades. A type with nothing listed keeps the 3D walk-out.

const STILL_MS = 4200, FADE_MS = 1100;
let manifest = null;

export async function findCrewShots(type) {
  if (!manifest) {
    try { const r = await fetch('assets/cine/shots.json', { cache: 'no-cache' }); manifest = r.ok ? await r.json() : {}; } catch (e) { manifest = {}; }
  }
  return (manifest[type] || []).map((f) => ({ kind: /\.(mp4|webm)$/i.test(f) ? 'video' : 'still', url: 'assets/cine/' + f }));
}

// Wraps a 3D walk-out (which keeps running underneath) with the film overlay. Same interface as
// startWalkout: update(dt, camera), finished, dispose().
export function startCrewCinematic(shots, walkout) {
  const el = document.createElement('div');
  el.id = 'crew-cine';
  el.innerHTML = '<div class="frames"></div><div class="grain"></div><div class="skip">Esc &middot; skip</div>';
  document.body.appendChild(el);
  const frames = el.querySelector('.frames');
  let finished = false, disposed = false, idx = -1, timer = null;
  const layers = shots.map((s) => {
    let node;
    if (s.kind === 'video') {
      node = document.createElement('video');
      node.src = s.url; node.muted = true; node.playsInline = true; node.preload = 'auto';
    } else {
      node = document.createElement('div');
      node.style.backgroundImage = `url(${s.url})`;
    }
    node.className = 'shot ' + s.kind;
    frames.appendChild(node);
    return { s, node };
  });

  const next = () => {
    if (disposed) return;
    const prev = layers[idx];
    idx++;
    const cur = layers[idx];
    if (!cur) {
      // last shot fades out over the live aircraft, already crewed and shut
      if (prev) prev.node.classList.remove('on');
      el.classList.add('out');
      timer = setTimeout(() => { finished = true; }, FADE_MS);
      return;
    }
    cur.node.classList.add('on');
    if (prev) setTimeout(() => prev.node.classList.remove('on'), 60);
    if (cur.s.kind === 'video') {
      const v = cur.node;
      let moved = false;
      const go = () => { if (moved) return; moved = true; next(); };
      v.onended = go; v.onerror = go;
      const p = v.play(); if (p && p.catch) p.catch(go);
      // a clip that will not report its end still hands over after a sensible time
      timer = setTimeout(go, 12000);
    } else {
      timer = setTimeout(next, STILL_MS);
    }
  };
  // a timer, not requestAnimationFrame: rAF does not run in a hidden or background tab
  setTimeout(() => { el.classList.add('in'); next(); }, 30);

  return {
    get finished() { return finished; },
    get t() { return walkout.t; },
    update(dt, camera) {
      // the 3D walk-out plays out underneath so the aircraft is crewed and shut when the film ends;
      // it is held at its end rather than finishing the sequence early
      if (!walkout.finished) walkout.update(dt, camera);
    },
    dispose() {
      disposed = true; clearTimeout(timer);
      for (const l of layers) if (l.s.kind === 'video') { try { l.node.pause(); } catch (e) { /* gone */ } }
      el.remove();
      walkout.dispose();
    },
  };
}
