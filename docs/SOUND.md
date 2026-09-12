# Sound design notes

Everything in `src/audio.js` is generated with the Web Audio API so the game needs no downloads
and stays free of copyright questions. What is there now:

- **Engines** — per engine a sawtooth fundamental with a sub-octave through a low-pass that opens
  with throttle, amplitude-modulated at the propeller blade-pass rate, plus band-passed exhaust
  noise. Engines are detuned by fractions of a hertz so pairs and fours throb the way a Pegasus
  or Twin Wasp formation did. A throttle movement brings the engines forward for a few seconds,
  then the mix tapers to a background level; the cockpit view is muffled, the chase view open.
- **Wind and water** — pink-noise beds shaped by airspeed and by whether the hull is on the water.
- **Music** — a slow, detuned string pad moving through modal chords (D dorian / D minor) with
  moods: menu, patrol (thin and distant), contact (low tense drone), combat (drone plus a slow
  timpani-like pulse), loss.
- **One-shots** — guns, enemy machine-gun fire, depth-charge release, splash, detonation, hits,
  and W/T morse for sighting reports.

## Generated clips (Atlas, second pass)

`assets/sfx/` now holds 14 effects and 10 voice lines generated with Atlas (ElevenLabs SFX v2
and a British male TTS voice). `src/samples.js` loads them; `audio.js` crossfades the three
engine loops by rpm, uses the wind and water loops for ambience, plays the one-shots for guns,
detonations, splashes and hits, and queues crew lines one at a time with a per-line cooldown.

## Ideas for taking it further

1. **Period radio bed** — a filtered "wireless" layer with static, a distant BBC-style voice
   (synthesised or recorded by a friend) reading the shipping forecast or the squadron's daily
   orders while the aircraft is moored; it fades as the engines start.
2. **Real recordings, licensed or free** — the Bristol Pegasus and Pratt & Whitney R-1830 both
   survive in airworthy aircraft (Sunderland ML814 at Fantasy of Flight, Catalinas on the airshow
   circuit). Short loops recorded from a Catalina run-up would replace the synthetic engine at a
   stroke; several are available under Creative Commons on Freesound.
3. **Crew intercom** — short synthesised or recorded callouts ("Bow gunner ready", "Contact,
   green three-oh", "Charges away") triggered by the same events that write the log.
4. **Period music** — public-domain 1930s dance-band records (pre-1929 recordings are public
   domain in the US; UK sound recording copyright expires after 70 years, so most pre-1954
   records are free in the UK) played through a gramophone filter in the mess between sorties,
   and a Vaughan Williams / Walton-style newsreel brass theme composed for the title.
5. **Ambience by place** — gulls and halyards slapping on the moorings, church bells from the
   town at the hour, ship sirens in the harbour, the Levanter wind over the Rock.
6. **Spatial audio** — Web Audio's PannerNode would put the flak, the destroyers' depth charges
   and the crew guns in the right ear.
