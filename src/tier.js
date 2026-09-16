// Device tier. Phones, small tablets, low-memory devices and slow or data-saving connections get
// the light build: half-size surface textures without normal or roughness maps, a half-size sky,
// mono sound at a lower bit rate, and a lighter world. Everything else keeps full definition.
// ?quality=lite or ?quality=hd in the address overrides the guess, and is remembered.
const KEY = 'quality';

function guess() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const small = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 820;
  const conn = nav.connection || {};
  const slow = conn.saveData || /(^|-)2g|3g/.test(conn.effectiveType || '');
  const lowMem = nav.deviceMemory && nav.deviceMemory <= 4;
  return (coarse && small) || slow || lowMem ? 'lite' : 'hd';
}

function choose() {
  let q = null;
  try { q = new URLSearchParams(location.search).get(KEY); } catch (_) { /* no address */ }
  try {
    if (q === 'lite' || q === 'hd') localStorage.setItem(KEY, q);
    else if (q === 'auto') { localStorage.removeItem(KEY); q = null; }
    else q = localStorage.getItem(KEY);
  } catch (_) { /* storage blocked: the address or the guess decides */ }
  return q === 'lite' || q === 'hd' ? q : guess();
}

export const QUALITY = choose();
export const LITE = QUALITY === 'lite';
