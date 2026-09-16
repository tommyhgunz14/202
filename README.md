# Our Story

We were the last generation to know them.  Most of us just knew them as our Grandparents, and they for the most part appeared as just ordinary people.  But earlier on in their path through life these same ordinary people had received a calling that led them to lead extraordinary lives, prevailing over extraordinary challenges where many made the ultimate sacrifice.   
They would tell you that **'we wanted to do our part', 'we did it for our country and loved ones', 'it was a privilege to be a part of', 'I would do it again'.**
They did it because they refused to have our freedoms, values and democracy as we know it today taken away from us.
They were to become known as the **Greatest Generation**, growing up in the Great Depression but still finding the hope, sense of duty and inspiration to give away the last of what little they had - their lives.
This game conveys the story of the contribution to the war by one of my family for my children and for anyone else curious to relive a part of the war that is not often recounted or told outside of the stories shared among familes that were involved in the Battle for the Mediterranean.

# Guardians of the Rock

A browser game about **No. 202 Squadron RAF at Gibraltar, 1939–1943**, flown from the seat of
Squadron Leader (later Wing Commander) **T. Q. Horner**. Flying-boat patrols over the Strait of
Gibraltar: find and identify the shipping in the narrows, report it by W/T, and attack the enemy
submarines with guns and depth charges while leaving the neutrals alone.

Built to the [404 game recipe](https://github.com/404-Repo/404-game-recipe): every aircraft and
vessel is a Three.js module that returns a `Group` (no mesh files, no textures), verified from
four sides with the recipe's harness. Runs from a folder with no build step.

## Run it

```bash
npm start
```

then open <http://localhost:8202>. (Any static file server works; the game is plain ES modules
with a vendored `three.module.js`.)

## Play

- **Main menu → Mission Briefings** gives the pilot's page, then the **Operations Record Book**: eighteen sorties
  on real dates from the squadron's Gibraltar record, in the order they were flown, plus a
  practice range and a free patrol.
- Five of them were flown by other crews: Walshe and the Alabastro, Case collecting General Clark,
  Louw collecting General Giraud, and Finch against U-343 and U-761. In those a second aircraft of
  the squadron flies with you. The other machine flies its part on its own: it forms up, attacks,
  alights beside a submarine, takes off and goes home. A label over it shows who it is and how far
  away.
- **The mission plan** comes after the aircraft, on a period photograph of the sortie: what it is
  for, the plan in order, and — where another crew is flying with you — which part you take.
  - *As flown*: the other crew do what the record says they did, and yours is the supporting
    part — form up, look the boat over, draw the flak, signal the position, keep watch while she
    is on the water, see her home.
  - *Lead*: their job becomes yours and they fly cover. You make the attack on the Alabastro,
    U-343 or U-761, or you put down beside the submarine yourself and take the General aboard
    while the boats come across. The plan screen says whose it was on the day, and the debrief
    records which part you flew.
  - Sorties with no second aircraft show the same plan and photograph, with the whole of it yours.
  - Each sortie has its own photograph, generated for it (Atlas) in the style of a period colour
    photograph and labelled *reconstruction* on the screen.
- **Choose your aircraft** from those the squadron had on that date. Each type shows its
  performance and eight scores (speed, endurance, climb, agility, payload, defence, detection,
  toughness) which also drive the flight model:
  - Saro London Mk II (1939–41) · Fairey Swordfish floatplane (1940–41)
  - Consolidated Catalina Mk I (1941–) · Short Sunderland Mk I (Dec 1941–Sep 1942)
- Take off from the Bay: full throttle, hold the nose up past 70–80 mph.
- The rest of the squadron lies at the harbour buoys: three aircraft of the types it flew on the sortie date. Across the Bay, the hills behind Algeciras form one continuous sandstone ridgeline, as seen from the waterfront today.
- Each sortie starts berthed alongside the pontoon at New Camp, parallel to it and clear of it by the wingtip. The crew walk-out is shown as a short film sequence for the aircraft type: three period-style stills of the crew walking out, boarding and at their stations, with a slow push-in and cross-fades, fading to the live aircraft as the engines start (Esc skips). The stills are Atlas generations listed in `assets/cine/shots.json`; a type with none listed falls back to the 3D walk-out along the floating gangway.
- **Identify** a vessel by flying within 800 m of it below 1,500 ft. A British or Allied ship or submarine gets the crew's call: "She looks like one of ours, sir." **Report** it (R / X button)
  to bring the destroyers in. **Attack** submarines low along their length; depth charges sink at
  ~10 ft/s and detonate at the set depth (25 / 50 / 100 ft).
- Return and alight in Gibraltar harbour to complete the sortie. The debrief is written as a
  Form 541 Operations Record Book entry.

## Controls

USB controller (Gamepad API, standard mapping — Xbox, PlayStation and most generic pads):

| Control | Action |
|---|---|
| Left stick | Pitch (pull back = nose up) and roll |
| Right stick X | Rudder |
| RT / LT, D-pad ↑ ↓ | Throttle |
| A or RB | Fire guns |
| B | Drop depth charge / bomb |
| X | W/T sighting report |
| Y | Cockpit ⇄ chase view |
| LB | Depth-charge setting |
| D-pad ← → | ASV range scale |
| L3 | Water brake |
| Start | Pause |

Keyboard: arrows/WASD pitch & roll, Q/E rudder, Shift/Ctrl throttle, Space guns, B drop,
R report, V view, F depth setting, T ASV range, X brake, Esc pause.

Phones and tablets: a stick at the bottom left (push up = nose down), the throttle lever at the
side dragged directly, and Fire, Drop, Report, Depth and View buttons; II pauses. **Quick sortie**
on the opening cards goes straight to a Catalina on the practice range.

Phones, low-memory devices and slow connections get a light build (half-size textures without
normal or roughness maps, a half-size sky, mono sound at a lower bit rate, coarser terrain and
sea meshes, a fifth of the trees, fewer houses across the water, and shadows from aircraft and
ships only); everything else gets full definition. On every device a model's fixed parts are
merged into one mesh per material when it loads, and each town is its own mesh so a town out of
view is not drawn. Add `?quality=lite` or `?quality=hd` to the address to choose, or
`?quality=auto` to go back to the guess. Music is fetched one cue at a time as it is needed.

## Quick play

Chosen under the plan, beside Take off (on by default on phones, remembered):

- the sortie starts in the air at about 1,000 ft, two-thirds of the way from the Bay to the area
- **Press on** (N, or ▸▸ on a phone) runs the quiet stretches at six times speed with the autopilot
  flying towards the marker; an unidentified contact, an enemy aircraft, getting close or touching
  the stick drops back to normal speed
- scripted waits, enemy aircraft and timed objectives come in at 40% of their full-sortie time, and
  the time on the water beside a boat is halved
- a marker shows what to fly to next, and a sighting report goes out as soon as its contact is identified
- the sortie ends when the last task is done: no flight home, landing or taxi

Full sortie is the whole of it: boarding at the mooring, taxiing out, there and back, and alongside.

## On the water

The hull floats at its draft and rises on to the step as speed builds, with bow wash and a wake
astern; the throttle quadrant on the left of the screen shows the lever position beside an
airspeed strip (red line = stall speed). Ships cruise continuous routes, keep clear of the shore
and trail wakes.

## Sound

The engine and weather are synthesised in the browser: a layered radial-engine model with
prop-beat and exhaust roar that comes forward when the throttle moves and settles into the
background, wind rising with airspeed, and water wash on the hull while taxiing. Over that sit
recorded clips and music generated with Atlas (`assets/sfx/`) - guns, detonations, splashes,
crew and gunner intercom lines, and one music cue per mood that crossfades from menu to patrol,
to tension on a contact, to combat. A generative string pad stands in for any cue whose file is
missing. See `src/audio.js` and docs/SOUND.md for ideas on going further.

## Gun positions and bandits

V / Y cycles chase → cockpit → every manned gun the type carries (bow, midships and tail Lewis
guns on the London; bow, blisters and tunnel on the Catalina; turrets and hatches on the
Sunderland; the rear Vickers K on the Swordfish). At a gun the stick aims within the mount's arc (left/right as normal, push forward to raise the barrel)
and the pilot holds the aircraft straight and level. Vichy fighters — Curtiss H-75s of GC I/5
from Morocco — turn up on some sorties and make firing passes from astern; the crew gunners
engage automatically and you can take a gun yourself.

The gunners are crewed. Each position watches its own arc: when a gunner sights a bandit (or a
surfaced U-boat) he calls it over the intercom, opens fire inside 700 m, reports hits, and
claims the kill or reports the fighter breaking off for home. While a gunner is engaged a small
window at the top right shows the view from his gun, titled with the position and weapon, with
the state of the engagement (Sighted, Engaging, Kill!, Escaped). Taking a gun yourself silences
that position's automatic fire. The Catalina's tunnel gun fires down and aft through the hatch in
the hull bottom, so its view starts pitched down under the tail and cannot rise above it.

When you release depth charges the same corner switches to a depth-charge camera: low over the
water abeam your line of attack, it follows the stick down, the splashes, the pause while the
charges sink to their setting and the plumes, with the boat beside them if one is near. It ends
with the result (Straddle, Close, Wide) and closes a few seconds later.

Rounds fired at you are heard when they pass within about 30 m: the crack of a close one, then a
falling whistle, panned to the side it went by. Rounds that hit are a dull thud through the
airframe. A submarine's gun crews only fire while her deck is out of the water, so a boat that
is diving or still coming up cannot shoot back.

## Launch intro

Each fresh load opens with a short cinematic before the menu: black, then "A True Story", then a
paragraph on Gibraltar in 1941, the submarines working the Strait, and the squadron under Wing
Commander T. Q. Horner.

After "A True Story" and the situation card, the title and subtitle come up and hold over the
whole run of pictures: three archive photographs and then the three crew stills, each
dissolving into the next behind the same lettering, with the squadron's years at Gibraltar
under the title. The prints start as monochrome and come up into colour as the sequence runs.
The last picture is a real one: the passing-out term photograph of winter 1930 with T. Q. Horner
seated second from the left. The title steps aside for it, and the whole print is shown with its
printed names, coming up from grey into colour, with a caption beneath. The colour was added by
hand (`tools/colourise-passing-out.mjs`): only colour is painted in, and the lightness of every
point is the original print's, so no face or detail has been redrawn. Only Escape, Enter, Space,
a controller button or the skip label end the intro, so a click to focus the window does not
lose it. The opening is scored with the Atlas-composed orchestral title cue
(`assets/sfx/music_title.mp3`). It starts on the first card and plays unbroken through the
situation text, the title and the photographs into the menu, where the same cue carries on. A
browser will not let a page make a sound until it has been touched, so the cue is asked for as
the intro opens and asked for again on the first key or click; if the page was opened cold it
comes in at that first touch rather than at the very first frame.

The cue is an original main title written in the general idiom of British war-film scoring:
a broad hymn-like theme in the major, rising phrases, resolute rather than mournful. Violins
carry the melody over violas and cellos, with harp and soft woodwind beneath, and there is no
brass and no percussion anywhere in it. It is mastered for weight: the opening eleven seconds
are lifted and given a low shelf, tapering back by sixteen seconds, so the theme is stated
firmly instead of creeping in.

An earlier cue, slower and elegiac in character, sits beside it as
`assets/sfx/music_title_alt.mp3`. Swap the two filenames to use that one instead.

## Photograph archive

The title screen and the Sources & accuracy screen both open a **Photograph archive**: a grid of
plates of the squadron's ground, each with a caption and a credit line. Photographs of the period
and reconstructions made for this game are kept in separate sections and every reconstruction is
labelled as one, so nothing on the screen is taken for something it is not.

To add a plate, put the file in `assets/archive/` and add an entry to `src/data/archive.js`. A
plate whose file is missing still lists and says so, so an incomplete folder never breaks the
screen. Record the provenance and rights of anything you add in its entry.

One sortie opens with a promotion instead: Squadron Leader T. Q. Horner becomes Wing
Commander. His real promotion date is not documented in any source available to the project,
so it is staged at a documented *squadron* milestone — the Sunderlands coming on charge before
Operation Harpoon in June 1942 — and the Sources & accuracy screen says so rather than
asserting a date.

Aircraft turn a flash of sunlight as they bank: the wing surfaces and the cockpit glazing each
light only when the sun's reflection in them happens to point at the camera, so the glints come
and go through a turn rather than burning all the time.

Every sortie opens in the world: the crew walk out along the pontoon at New Camp, cross the
gangplank and climb in through the hull hatch of the moored aircraft, which is swung open for
them and pulled shut behind the last man, and only then are the engines started (about fifteen
seconds; Escape, Enter, Space or a controller button skips). The camera swings on an arc from
ahead of the walking crew out to a wide three-quarter view of the aircraft, always east of the
pontoon's edge — the hull, wing and floats all lie west of it, so the shot never enters the
aircraft however big her span.

The figures, and the marshallers and groundcrew on the pontoon, are built to Atlas reference
photographs of 1941 Coastal Command aircrew: Irvin jackets with sheepskin collar and cuffs,
Mae Wests, navy trousers bagging over fleece-topped flying boots, haversacks carried low in
one hand, side caps, overalls and bats, jointed at hips, knees, shoulders and elbows with a
walk cycle that leans into the stride and holds the carrying arm still (`src/world/crew.js`).

Inside the moles the water is sheltered, so the swell no longer washes over the pontoon, and
the swell shoals as it runs into shallow water, so the shoreline no longer heaves: what is left
on the sand is a narrow line of froth that barely creeps at sea level and is static from the
air. The windsock and the yellow flag are cloth in a light wind.

The sortie screen carries a cinematic panel on the right: the aircraft's recognition card, the
crew walking out and boarding, and two of seven period photographs in the style of RAF official
pictures (a London refuelling at the Gun Wharf, a briefing on the North Mole, a Swordfish on the
slipway, a Sunderland at her moorings, a surfaced U-boat under attack, HMS *Wishart* at speed,
aircrew on the jetty at dusk), chosen by mission and cross-fading with a slow push-in. All of
them are Atlas generations, not archive prints: genuine Imperial War Museum photographs of the
squadron exist but are IWM copyright and would need their own licence.

## Practice range

The first entry in the operations book is a range four miles south-east of Europa Point: two
moored rafts with bull's-eyes for depth-charge practice (bullseye inside 10 m = 100, near inside
25 m = 60, wide inside 50 m = 25), a condemned coaster and a dummy submarine for the guns.
Accuracy is scored, and hits leave scorch marks, sparks and, when a target is badly hurt, fire.

## Taxiing out

Every sortie starts alongside the jetty at New Camp with the marshallers waving you off. Taxi
out through the north entrance between the North and Detached Moles (the HUD gives bearing and
distance) and open up in the Bay. Destroyers you call in engage a surfaced target with their
4.7-inch guns as they close, and put a shot across the bows of a blockade-runner.

## Landing

Alight in the Bay or the harbour, then taxi to the seaplane jetty at RAF New Camp (the yellow
flag at the north end of the harbour; bearing and distance are shown once you are down) and stop
alongside under 3 knots to end the sortie.

## Skies (Atlas)

The four skies (dawn, morning, afternoon, dusk) are photographic 360-degree panoramas generated
with the Atlas platform (`assets/sky/*.jpg`, 4096x2048). The game finds the sun in each one,
turns the sky so it matches the sortie's lighting, and takes fog, haze and water colour from the
image. Delete a file and that time of day falls back to the built-in shader sky.
`tools/atlas.mjs` is a small JSON-RPC client for the Atlas MCP server (needs `ATLAS_API_KEY`).

## Surfaces and sound (Atlas)

Nine seamless PBR texture sets (albedo, normal, roughness) generated with Atlas dress the world:
limestone and scrub blended across the terrain by steepness, terracotta tiles and lime render on
the town, dressed stone on the moles, decking on the jetty, corrugated iron on the catchments,
tarmac on the runway (`assets/tex/`). Twenty-four generated clips in `assets/sfx/` replace the
synthesised layers when present: radial-engine idle, cruise and full-power loops crossfaded by
rpm, water wash, wind, gulls over the harbour, Vickers K and Browning bursts, depth-charge and
shell splashes, explosions, hits, Morse, and ten crew intercom lines (contact, charges away,
straddle, fighter astern, she is diving, neutral, W/T sent, down, alongside). Delete any file and
the synth stands in.

## Reference art and 3D models (Atlas)

Studio-style reference pictures of every vessel and aircraft, generated in their correct schemes,
appear as recognition cards in the contact panel once a vessel is identified and on the aircraft
selection screen (`assets/refs/`). Generated GLB meshes are supported too: drop
`assets/models/<asset>.glb` next to a code asset and `src/models.js` normalises it (length, ground
level, bow forward, named nodes carried across); `tools/viewer.html?name=<asset>` checks it from
four sides, and `assets/models/models.json` holds per-model overrides. The Atlas image-to-3D
backends were not available at this workspace's access level, so the game ships with the code
assets and the pipeline ready for when they are.

## Tracking a dived boat

When a submarine goes under, her dark shadow stays visible from low level in the clear water until
about 35 m depth (a tag over it gives range and depth), her periscope cuts a small white feather
while she is shallow and moving, and a damaged boat vents a trail of bubbles. The plot marks a
DATUM at her last known position with a dashed circle that grows at her submerged speed, and the
ASV paints a faint periscope echo inside a quarter of the range scale.

## The look of the Strait

The world is meant to carry the game: a noise-based sea with a fine mesh under the camera,
seabed-aware water that goes turquoise over the beaches and breaks in a surf line, gently
shelving shores with sand, wet sand, meadow and dark rock where the land drops steeply, a finer
terrain tier around the narrows, and tens of thousands of instanced stone pines, cork oaks,
lentisk scrub, cypresses and palms placed by height, slope and distance from the towns. A warm
vignette grade sits over the frame. On the water the hull is clipped at the local swell height,
and the flying boat throws chine spray, wash sheets, a churned stern wash and a Kelvin V-wake.

## Instruments

- **ASV Mk II** (Catalina, Sunderland): drawn as the real A-scope — range up the trace, echoes
  to port or starboard, coastline as a ragged land return. The London and Swordfish have no set.
- **Navigator's plot**: chart of the Strait, own position, base bearing/distance, identified
  contacts and W/T reports.
- **Cockpit panel** (first-person view): airspeed, horizon, climb, altimeter, direction
  indicator, turn & slip, RPM and boost per engine, stores, fuel, damage.

## Layout

```
index.html          shell, HUD and menus
src/main.js         game loop, missions, camera, scoring
src/flight.js       flight model (type-differentiated)
src/input.js        keyboard + gamepad
src/weapons.js      guns, depth charges, splashes, explosions
src/vessels.js      ship / submarine AI (lookouts, crash dive, flak, destroyer hunts)
src/radar.js        ASV A-scope and the plot
src/cockpit.js      instrument panel
src/world/          terrain (Strait geography), sea, sky, Gibraltar harbour
src/data/           aircraft specs, missions, coastline/peaks
assets/             one Three.js module per aircraft / vessel (404 contract)
docs/               STYLE-LOCK.md, ASSET-BRIEF.md, HISTORY.md (sources & accuracy)
tools/geo-test.mjs  quick check of land/sea classification
tools/atlas-review.mjs  sends captured frames to the exported Atlas art-review API
tools/shoot.mjs     headless puppeteer screenshots of the running game driven by a scenario module
```

While `node serve.mjs` is running, the page can save what it is drawing: `POST /_capture?name=x`
with a JPEG data URL as the body writes `captures/x.jpg` (ignored by git). `window.DBG.frame()`
renders one frame on demand, which is how the review captures were taken.

## Accuracy

See [docs/HISTORY.md](docs/HISTORY.md) for what is documented, what is representative and what
is abridged for play.
