# Sources and accuracy notes

## The pilot

Squadron Leader / Wing Commander **T. Q. Horner** is the player's grandfather and the game's
point of view. The full text of Andrew Thomas's article was supplied to the project and does name
him: he took command at the end of July 1940 as a squadron leader and is a wing commander by 28
January 1941, when two Vichy Hawk 75s bounced him off Casablanca in London K5909 and he brought
her home with bullet holes in her. Beyond the squadron record no personal detail is invented: he
is placed in the captain's seat for sorties that are documented, and the debrief is written as an
Operations Record Book entry in his name.

## Squadron facts used (documented)

| Item | Source |
|---|---|
| Ordered to Gibraltar on the outbreak of war; established by 10 Sep 1939 under Wg Cdr E. A. Blake with six Saro London Mk II; HQ on the North Mole; aircraft moored in the harbour and at the Gun Wharf; first patrol by London **K9683** on 11 Sep 1939 after a report of a German ship; main task locating German shipping bound for neutral Spain | Andrew Thomas, "Guardians from the Rock", *Britain at War* / Key Military (open part of the article) |
| 26 Dec 1939: Flt Lt Norman Eagleton's crew in **K6931** sighted a German freighter and ordered her to stop; HMS *Wishart* summoned; ship ran aground on the Spanish coast near Chipiona | same article; HMS *Wishart* histories |
| Timeline: 25 Aug 1939 war footing · 9 Sep move to Gibraltar · 11 Sep first patrols · 18 Oct 1940 Italian submarine sunk · 27 Oct 1940 Swordfish allocated · 24 Apr 1941 Catalinas allocated · 8 Jun 1941 U-boat attacked · 4 Jun 1942 Sunderlands arrive · 13–17 Jun 1942 Operation Harpoon · 7–8 Nov 1942 Operation Torch · 20 Nov 1942 Sgt A. F. Fletcher lost · 14 Feb 1943 U-boats attacked · Sep 1944 relocation | Wartime Memories Project, No. 202 Squadron page (entry headings) |
| Aircraft: London I/II Sep 1937–Jun 1941; Swordfish I (floatplane, ex No. 3 AACU) Sep 1940–Jun 1941; Catalina Ib Apr 1941–Jan 1945; Sunderland I/II/III Dec 1941–Sep 1942; codes **TQ** (Sep 1939–Aug 1943) and **AX** (May 1941–Aug 1943) | History of War, RAFweb squadron histories |
| 18 Oct 1940: London of Percy Hatfield sighted bubbles and oil off Alborán; with Norman Eagleton's London bombed the spot; HMS *Firedrake* and *Wrestler* forced the *Durbo* up; she was scuttled and her papers led to the *Lafolè* two days later | Italian submarine *Durbo* histories |
| 8 Jun 1941: Catalina **AH538 "C"** (Flt Lt R. W. Whittome) strafed and bombed the *Velella*; 9 Jun Catalina **AH553 "J"** (Flt Lt E. M. Pain) attacked the *Brin*, which replied with machine-gun fire | Italian submarine histories |
| 2 May 1942: U-74 sunk east of Cartagena by HMS *Wishart*, *Wrestler* and a 202 Sqn Catalina (Flt Lt R. Y. Powell) | uboat.net |
| 14 Feb 1943: off Cape St Vincent, Catalina **FP223/J** (Flt Lt Harry Sheardown RCAF) damaged **U-381** shortly before midnight, then sank **U-620** less than an hour later, illuminating her with the landing lights on the run in | Andrew Thomas, "Guardians from the Rock"; uboat.net |
| Catalina **Z2147/AX-L** made nine attacks on U-boats with the squadron and lifted the crew of a Fulmar shot down by Vichy fighters on 18 May 1942 | same article; IWM photograph captions |
| Catalina **AH544 "AX-H"** photographed leaving Gibraltar on patrol | IWM |
| RAF New Camp (slipway and hangar on reclaimed land by Montagu Bastion) and North Front runway extended into the Bay, 1942 | RAF Gibraltar histories |
| Italian human-torpedo and frogman attacks from the *Olterra* at Algeciras (Jul and Dec 1942) — background only | Decima MAS histories |
| Squadron badge on the title screen: a mallard alighting, with the motto *Semper Vigilate*, "Be always vigilant" (Latin *semper*, always; *vigilate*, keep watch, a plural command addressed to all). The image was supplied to the project. It shows the St Edward's crown used on RAF badges from 1953; badges of the war years carried the Tudor (King's) crown, so the crown is later than the period the game covers. | Supplied image; RAF heraldry conventions |

## Representative or abridged

- **Distances**: horizontal geography is compressed 4:1 (`H_SCALE`) and heights 2:1 so a patrol
  fits a sitting. Actions fought 65 miles off Alborán or north-west of Lisbon are staged at the
  edges of the Strait; the briefings say so.
- **Gibraltar at double scale**: aircraft and ships are true size, so at 4:1 the Rock and the harbour looked a quarter as long as they should beside them. Within about 3.6 km of Gibraltar the map is drawn at 2:1, easing back to 4:1 over the next 6 km (`GIB_ZOOM` in `src/config.js`). Everything further out keeps its shape and the distances between its places, but sits about 1.65 km of game distance further from Gibraltar. Distances shown on the radar and plot are therefore generous close to Gibraltar.
- **The Rock**: rebuilt from survey figures obtained through Atlas and checked against the known summits. Rock Gun 411 m at the top of the North Face, Middle Hill 377 m, Signal Hill 393 m, O'Hara's Battery 426 m (the summit), Windmill Hill about 120 m, and the Europa Point lighthouse. The foot of the North Face is at about 36.1485°N, with the frontier at 36.155°N and the runway at 36.151°N. The ridge runs almost due south; the Rock is about 4.3 km long from the North Face to Europa Point. The west slope runs about 780 m to the town shore at around 30°; the east side is a sheer upper crag over talus or sea cliff, 300 to 450 m to the water. It stands at its true height. The earlier model had the whole ridge about 2 km too far north, over the isthmus and the runway, with only low ground where O'Hara's Battery should be.
- **Serials**: K9683, K6931, K5909, K5913, AH537, AH538, AH553, AH544, AJ162, Z2147, FP223,
  W8407 and W4029 are recorded squadron aircraft. **K8422** (Swordfish) and **W3985**
  (Sunderland) are representative: W3985 belongs to a Mk II batch, and the squadron's Sunderland
  serials were not confirmed. The Swordfish that found W8407 was **K8354/TQ-D**.
- **Codes**: the Catalina carries AX-L, which is Z2147's own marking. The U-620 sortie was flown
  by FP223 coded J, a different aircraft; the game flies the AX-L model for it and the briefing
  names the right serial. Londons and the Sunderland carry TQ.
- **Liveries**: Temperate Sea Scheme (Extra Dark Sea Grey / Dark Slate Grey) with Sky Grey
  undersides for the 1939–40 London and Sky for the Swordfish; the 1942 Coastal Command scheme
  (white sides and undersides) for the Catalina and Sunderland. Type A1 fuselage roundels, Type B
  on upper wings, red-white-blue fin flashes. The 1941 Catalinas would have worn the earlier
  scheme; the model represents the 1942 aircraft.
- **HMS Firedrake** was an F-class destroyer; the game uses the Modified W-class model built for
  HMS *Wishart* for both destroyers in the *Durbo* sortie.
- **Convoy names** in the Harpoon and Torch sorties are real ships of those operations
  (*Troilus*, *Burdwan*, *Orari*; *Derbyshire*, *Awatea*, *Strathnaver*) but are represented by one
  merchant model recoloured grey. The U-boat numbers in the Torch sortie (U-205, U-73) were
  Mediterranean boats of the period; their presence at the Strait that morning is dramatised.
- **Weapons**: 250 lb anti-submarine bombs for the London and Swordfish; 250 lb Mk VIII depth
  charges (Torpex filling from mid-1942) with the 25 ft shallow setting that Coastal Command
  adopted for boats caught on the surface. Lethal radius is generous for play.
- **Load carried**: the Catalina's eight charges are the 2,000 lb she is credited with. The other
  three carry more than the figures usually quoted for them — ten for the London and twelve for
  the Sunderland against the 2,000 lb (eight charges) normally given, and four for the Swordfish
  floatplane against the one or two she would really have lifted off the water. That is a play
  allowance so a sortie is not over after two attacks, not a claim about the aircraft.
- **ASV Mk II**: range scales and the A-scope presentation follow the set; detection ranges are
  scaled with the geography. Sea clutter hides a small target inside a mile, as it did.
- **Submarine behaviour**: lookouts spot a low aircraft later than a high one; a few seconds'
  reaction then a crash dive of about thirty seconds to periscope depth, in line with Type VIIC
  practice. Italian boats reply with machine-gun fire when caught up, as the *Brin* did.
- **Uniform**: the pilot is not modelled as a figure; the cockpit view uses the RAF "basic six"
  panel layout with period units (mph, feet).

## Sorties added from the full article

The following are taken from the same article and were not in the earlier build, which had only
the part of it that is readable without a subscription:

- **2 Jul 1940, reconnaissance of the French fleet** — Flt Lt Norman Eagleton's crew flew a
  detailed reconnaissance of the French squadron in Algeria the day before the Royal Navy
  bombarded it. The article calls it one of the squadron's less pleasant tasks.
- **28 Jan 1941, bounced off Casablanca** — Wg Cdr Horner in London K5909, attacked by a pair of
  Vichy Hawk 75s, escaping with a few bullet holes.
- **8 Jun 1941, the ditching of W8407** — Catalina W8407 came down in the Strait inbound from
  Britain; Swordfish K8354/TQ-D found the wreck and directed rescuers, who saved seven of the
  nine aboard. It was B Flight's last action, its Swordfish being withdrawn the next day. In the game the ditching is shown as floating wreckage (the tail unit, a wing panel awash, debris and fuel sheen) with seven men, the number saved, six in a yellow dinghy and one in the water, next to a fluorescein sea-marker stain. How W8407 actually lay on the water is not recorded; the dinghy and marker are the standard RAF kit of the time, not a detail from the account.
- **7 Jun 1942, the Veniero** — F/O Corrie in Sunderland W4029/AX-M attacked from thirty feet
  astern, the charges failed to release, and he went round again through heavy fire. The first
  submarine 202 Squadron sank unaided.

Oran, Casablanca and Algiers lie far outside the modelled square, so those three actions are
staged at the edges of the Strait in the same way as the Alboran and Lisbon sorties, and each
briefing says so. The French warships at Oran are represented by the game's one French destroyer
model rather than the battleships that were actually there.

Corrections the full text forced on existing content:

- The **U-620** sortie was dated 13 February 1943 and credited to Catalina Z2147. The article
  gives **14 February** and **FP223/J**, off Cape St Vincent, and records that the same crew
  damaged **U-381** less than an hour before sinking U-620.
- The German freighter of 26 December 1939 is **Gluckberg** in the article; the game had
  Glücksburg. The sortie now uses the article's spelling throughout (name, objectives and the
  do-not-attack rule).
- The **Durbo** attack was made by **K5913** (Hatfield) and **K5909** (Eagleton).
- The **U-74** attack was flown by **AJ162/AX-C**, seven 250 lb charges at 1412hrs, 55 miles east
  of Cartagena; the article notes a second boat, **U-375**, was close by and some attacks may have
  been directed at her.

The article is subscription content. Its facts are used and cited; none of its text is reproduced
in this repository.

## Sorties flown by other crews

Each of these can be flown either way, chosen on the mission plan screen before take-off.
**As flown** is the record: the named crew do what they did and you fly the second aircraft in
support. **Lead** gives their job to you and sends them up as cover — you make the attack, or you
put down beside the submarine and take the General off. The plan screen names whose the action was
on the day, and the Operations Record Book entry in the debrief records the part flown. Nothing in
the *Lead* variant is offered as history; the mission text and these notes keep the record.

The plan screen shows a photograph for every sortie, one made for that sortie: the practice rafts
off Europa Point, the German steamer with a destroyer on the horizon, the French fleet behind the
Mers-el-Kébir breakwater, the dinghy beside the wreckage of W8407, the canoes crossing to the
Catalina for General Clark, flak coming up in the dark at U-343, and so on. They are generated
(Atlas) in the style of period colour photographs and are **reconstructions, not documents** —
each is labelled *reconstruction* on the screen itself. The real photograph of a Catalina over
Europa Point is in the photograph archive, where it is labelled as an archive plate.

Five actions in the article were flown by other crews of the squadron. They are in the game as
sorties where you fly a second aircraft alongside the crew the record names. That crew's aircraft
is flown by the game and does what the record says it did; your objectives support it. **The
second aircraft is the game's invention in every one of them**: the article does not say another
squadron machine was there.

- **14 Sep 1942, the Alabastro** — Flt Lt E. Walshe, Sunderland W6002/AX-R, 1510hrs, about fifty
  miles north-west of Bougie. He attacked a surfaced submarine from astern at 800 ft with six
  charges, four straddling. She circled out of control for 35 minutes firing back, was abandoned,
  and sank with about forty men in the water. The boat was Tenente di vascello Giuseppe Bonadies'
  Alabastro, and Walshe got the DFC. *Staged* at the eastern edge of the map, with the 35 minutes
  shortened to a few. Alabastro was an Adua-class boat, shown on the Brin-class model and labelled
  as Adua class. The Durbo, also an Adua-class boat, is now labelled that way too.
- **24 Oct 1942, General Clark** — Wg Cdr A. Case, Catalina Mk.IB FP164/L, in the afternoon,
  picked up Major General Mark Clark from a waiting submarine on his return from a clandestine
  trip to Algiers. The article does not name the boat or the position. The submarine is given as
  **HMS Seraph**, which carried Clark to and from the Algerian coast in October 1942. That is
  general history, not this article. The transfer is *staged* at sea east of Europa Point.
- **7 Nov 1942, General Giraud** — Flt Lt J. Louw, Catalina Mk.IB FP122/K, picked up General
  Henri Giraud from a submarine in the Gulf of Lyons. Giraud fell into the water during the
  transfer, and Louw received the Légion d'honneur. Seraph is again named from general history;
  she brought Giraud out of France. *Staged* at the eastern edge of the map. A Vichy fighter may
  come out at the Catalina on the water (a 60% chance). **No interception is recorded**; it is a
  play hazard, and the briefing says so.
- **The transfers themselves** are shown: in the Clark sortie two folding canoes paddle across from
  Seraph to the Catalina's waist blister, each with a paddler and a passenger, and the passengers
  climb in; for Giraud a small rowing boat brings the General and two others, he goes into the
  water beside the aircraft and is hauled aboard. Folding canoes are what Seraph carried for the
  Clark party; the kind of boat used for Giraud, and the number in each party, are representative.
  The boats go back to the submarine once the Catalina is under way. The other pilot's radio calls
  say "landing" rather than "going down", so they cannot be heard as a report of the submarine
  diving.
- **8 Jan 1944, U-343** — Wg Cdr G. Harger commanding. Flt Lt John Finch's crew attacked U-343 at
  2300hrs after a 179 Squadron Wellington had already attacked her. Finch took hits to the port
  wing, fuselage and fuel tanks, his flight engineer was wounded, and he dropped his charges and
  got back to Gibraltar. U-343 reached Toulon, so the game will not let her be sunk in this
  sortie. The account gives neither Finch's serial nor the position; the action is *staged* east
  of the Rock. It is flown at night under a procedural moonlit sky, and the phase of the moon is
  not modelled.
- **24 Feb 1944, U-761** — Finch's crew, on patrol north of Tangier, found Oblt z.S. Horst Geider's
  U-761. She was being tracked by HMS Anthony and HMS Wishart and had already been attacked by
  several US Navy aircraft. Finch followed the next American wave in and straddled her as she
  headed south. She dived, the destroyers hounded her until she came up partly surfaced and was
  abandoned, and she sank stern first three minutes later. 48 men were picked up and the squadron
  shared the credit. This is fought **where it happened**. The hunt is compressed. The destroyers shadow her from the moment she surfaces, and once they are sent in she is brought up and sunk in about 75 seconds. Her three minutes on the surface before she sank are shortened to thirty seconds. The US Navy aircraft are not
  identified in the article and are shown as Catalinas. HMS Anthony, an A-class destroyer, is
  shown on the Wishart model.

How the scripted parts are kept to the record: an attacking aircraft's stick leaves its target in
the state the record describes, whatever the dice would have made of it. A boat that survived
(U-343) has a floor under her damage. A boat that was abandoned (Alabastro, U-761) goes down when
her crew leave her, not when a hit happens to take her to zero. HMS Seraph, an S-class boat, is
shown on the Type VIIC hull with a White Ensign on the bridge, because there is no British
submarine model.

## Additions in the second pass

- **Vichy fighters**: the squadron record notes attacks by French aircraft on 14 September 1940,
  29 January 1941 and 18 May 1942. The bandit is modelled as a Curtiss H-75A of GC I/5, the
  Vichy fighter group at Rabat-Salé and Casablanca, in the 1941–42 scheme with the yellow-and-red
  cowling and tail stripes, French cockades and tricolour rudder. Dewoitine D.520s were in Algeria
  and Tunisia rather than Morocco at that date.
- **Practice range**: fictional, dated 10 March 1942 ("new aircraft" in the record). The RAF
  did keep bombing and gunnery targets moored off Gibraltar for work-up; positions are invented.
- **Seaplane jetty**: the flying-boat base moved from the harbour moorings to RAF New Camp, on
  reclaimed land north of the North Mole, in 1942; the jetty and pontoon are a representative
  timber structure, not a survey of the real one.
- **Europa Point and Windmill Hill**: rebuilt a second time against the wartime photograph of a
  Catalina over the southern tip (now in the archive, with a colourised copy). The south end is
  two limestone steps, not a ridge tapering to the sea: Windmill Hill Flats, a plateau at about
  120 m with dry grass and patches of scrub, ends in a pale scarp that drops to the Europa flats
  at about 40 m, falling to about 22 m at the lighthouse. The flats stop all round in sheer sea
  cliffs with a ledge of fallen rock here and there, and the water is deep right to their foot.
  A shelf at the flats' level runs north on the west side toward Rosia. The long three-storey
  barrack blocks stand in rows at the foot of the scarp, parallel to it, with more along the west
  shelf, low blocks and huts on Windmill Hill, scattered stores on the open flats, a wall along
  the cliff top and a tall slender white tower west of the lighthouse. The lighthouse is plain
  white, as the photograph shows it, with no band. Heights are estimated from the photograph and
  known spot heights; the layout is representative, not a survey, and individual buildings, their
  uses and the roads are not reproduced.
- **Ships in the harbour and the Bay**: the wartime photographs never show the harbour empty, so it
  holds destroyers alongside the Detached and South Moles and at buoys, two submarines berthed
  together, a merchantman at the South Mole, and a convoy at anchor in the north of the Bay with
  another ship off Rosia. They are scenery (not on the plot, not targets), placed clear of the
  moorings, the taxi route, the take-off run and the return approach. The ship types are the
  game's existing destroyer, merchant and submarine models; no capital ships are shown, and the
  numbers and berths are representative rather than a record of any day. Every ship and aircraft model is
  built at its true size (a W-class destroyer 95.1 m, the merchantman 118 m, an S-class submarine
  66 m, against the Catalina's 19.5 m length and 31.7 m span); only the land is drawn at the
  Gibraltar zoom. The destroyers standing in for the harbour's other destroyers do not carry
  Wishart's pennant number D67.
- **The Rock's west face and the town shore**: the photographs show pale crag with scrub in
  patches, so the face carries far less scrub and only a few pines (on the Upper Rock, not the
  southern slopes). The town's sea front is the Line Wall, quays and reclaimed ground, and the
  harbour was dredged, so there is no beach and no turquoise shallows in front of it.
- **Cockpit**: the enclosed flight decks follow the Catalina arrangement as far as the reference
  allows — side-by-side seats, the big wheels on bent columns, an overhead throttle quadrant on
  the roof between the pilots, a pedestal with trim wheels between the seats, and a low wide dark
  panel carrying the blind-flying six together on their own sub-panel in the centre, engine
  instruments blocked in two columns to the right and pressure gauges on the captain's left.
  The individual dial faces are generic RAF rather than the exact instruments of any one mark,
  and the London and Sunderland share the Catalina's arrangement.

- **The hills across the Bay**: the Spanish shore west of Gibraltar is now modelled as ridgelines, not rounded hills. Seen from the harbour, it is one long skyline, checked against a present-day photograph taken from the Gibraltar waterfront, using only the landforms and ignoring modern development. The skyline starts low at Punta Carnero, rises to the high ground of the Sierra de la Luna and El Bujeo south-west of Algeciras (about 800 m), dips to a saddle, rises again in the Sierra de Algeciras to the west, then steps down north towards Los Barrios and San Roque. Crest heights are those of the real summits, rounded; the line of each ridge is approximate. The slopes are shaded as the Aljibe sandstone they are, under cork oak and maquis, with bare rock only where the ground is steep, rather than the pale limestone of the Rock.
- **The squadron at its buoys**: three more of the squadron's aircraft lie at the harbour moorings on every sortie, of the types it flew on that date, head to wind and riding to their buoys by the bow. Which aircraft stood at which buoy on a given day is not recorded; this is representative.

## Photograph archive

The archive screen separates real photographs from the images generated for this game, and labels
every generated plate as a reconstruction. Nothing generated is presented as a contemporary
photograph anywhere in the game.

Photographs supplied to the project are listed in `src/data/archive.js` with whatever is known of
their provenance.

**Passing-out term, winter 1930.** A group photograph by Gale & Polden Ltd of Aldershot. The
mount prints the names of thirteen standing and eleven seated, with Horner second in the seated
row. The caps with white bands and the sergeants' chevrons on some sleeves look like flight cadets
of the RAF College, Cranwell. The print does not say so, so the game does not either. It is shown
twice in the archive: as supplied, and colourised. The colourised version closes the launch intro.
It was tinted locally by `tools/colourise-passing-out.mjs`: every pixel keeps the photograph's own
CIE lightness, and colour is painted in from soft regions (RAF blue-grey cloth, skin, white cap
bands, a dark timber hut, winter grass, the cream mount). No generative model touched it, the
photograph was not sent to any outside service, and no face has been redrawn. The colours are
informed guesses, not a record. Where rights are not established the entry says so rather than implying a
licence. Wartime British official photographs are frequently held by the Imperial War Museum under
their own terms; none are bundled in this repository.

## Generated media (Atlas)

Skies, surface textures and sound clips were generated with the Atlas platform from written
briefs (see README). They are photographic in style but not photographs of Gibraltar; the crew
voice lines are synthetic speech in a period RAF manner and the wording is the game's own.

The twenty mission-plan photographs in `assets/plan` were generated the same way, one per sortie,
from a written brief for each (`quality_text_to_image`, 16:9). They are labelled *reconstruction*
wherever they are shown. Anything they contain — hull numbers, aircraft details, the look of a
particular ship — is the generator's invention and should not be read as evidence.

## Command of the squadron

The full text of Andrew Thomas, "Guardians from the Rock" (*Britain at War* / Key Military) was
supplied to the project and gives the succession:

| From | Commanding officer |
|---|---|
| Sep 1939 | Wg Cdr E. A. Blake, who brought the squadron to Gibraltar |
| 3 Mar 1940 | Wg Cdr Alfred Rogers, still in post when Italy entered the war on 10 Jun |
| end Jul 1940 | **Sqn Ldr T. Horner** |
| Feb 1942 | Wg Cdr Albert Case |
| by Jan 1944 | Wg Cdr G. Harger |

On 28 January 1941 the article calls him "the now Wing Commander Horner", flying London K5909 off
Casablanca when two Vichy Hawk 75s bounced him. So his promotion falls between the end of July
1940 and 28 January 1941. The exact day is not recorded, and the game does not invent one: the
promotion card runs at the front of the Casablanca sortie and the Sources & accuracy screen
explains the bracket.

An earlier build asserted that none of this was documented and staged the promotion at Operation
Harpoon in June 1942. That was wrong, and is corrected.

## Light

The sun runs east to west across the day, as it does at 36° N: low in the east-south-east at
dawn, higher and still easterly through the morning, southerly at midday, and setting
west-south-west at dusk. It matters at Gibraltar, where the sheer east face of the Rock takes
the morning sun and the town on the western slope gets the afternoon light. An earlier build had
the arc reversed, so the east face stood in shadow at every hour and rendered as a black wall.

## References

- Andrew Thomas, "Guardians from the Rock", Key Military — https://www.keymilitary.com/article/guardians-rock
- Wartime Memories Project, No. 202 Squadron — https://www.wartimememoriesproject.com/ww2/allied/royalairforce/sqdview.php?pid=400
- History of War, No. 202 Squadron — https://www.historyofwar.org/air/units/RAF/202_wwII.html
- RAFweb squadron histories 201–205 — https://www.rafweb.org/Squadrons/Sqn201-205.htm
- uboat.net: U-74, U-620, HMS *Wishart* — https://uboat.net
- Wikipedia: Saro London, Consolidated PBY Catalina, Short Sunderland, Fairey Swordfish,
  Italian submarine *Durbo*, Gibraltar Harbour moles, Europa Point, Strait of Gibraltar, ASV Mk II
- 404 game recipe — https://github.com/404-Repo/404-game-recipe
