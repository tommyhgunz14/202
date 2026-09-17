import { LITE } from './tier.js?v=202609171500';

// Quick play: the sortie cut down to its action, for phones and short sittings. The aircraft starts
// in the air most of the way to the area, the quiet stretches can be run at six times speed, the
// scripted waits and timed objectives are shortened, a marker points at what to do next, sighting
// reports are sent as soon as the contact is identified, and the sortie ends when the last task is
// done instead of after the flight home. On by default in the light build; the choice is remembered.
const KEY = 'pace';
let stored = null;
try { stored = localStorage.getItem(KEY); } catch (_) { /* storage blocked */ }

export const PACE = {
  quick: stored ? stored === 'quick' : LITE,
  set(quick) { this.quick = quick; try { localStorage.setItem(KEY, quick ? 'quick' : 'full'); } catch (_) { /* not remembered */ } },
};

export const QUICK = {
  WAIT: 0.4,          // share of scripted waits, bandit delays and timed objectives
  PICKUP: 0.5,        // share of the time on the water beside a boat
  START_SHARE: 0.65,  // how far along from the Bay to the area the aircraft starts
  START_ALT: 300,     // metres (about 1,000 ft)
  FF: 6,              // fast-forward multiple
};

// "Keep the convoy intact for 7 minutes" → "... for 3 minutes" when the timer is shortened
export function shortenText(text, seconds) {
  const m = Math.max(1, Math.round(seconds / 60));
  const words = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten)';
  return text.replace(new RegExp(`${words} minutes?`, 'i'), seconds < 90 ? `${Math.round(seconds)} seconds` : `${m} minutes`);
}
