// The mission plan shown before take-off: the photograph the plan is laid over, what the sortie is
// for, and — where a second aircraft of the squadron is flying with you — which part you take.
//
// Roles: the first is always the sortie as the record has it, with the other crew doing what they
// did; the second gives their job to you and sends them up as cover. A role may override the
// objectives, the other aircraft's script, the entity settings and the mission's triggers; anything
// it leaves out comes from the mission itself (src/data/missions.js).
//
// The photographs are the generated period pictures already in the game (see docs/HISTORY.md:
// they are reconstructions, not documents), except the Catalina over Europa Point, which is a real
// photograph supplied to the project.

// everything that happens once the player is down on the water beside the submarine
const onceDown = (acts) => [{ when: { flag: 'player-down' }, acts }];

export const PLANS = {
  range: {
    photo: 'assets/intro/photo_swordfish_slip.jpg',
    caption: 'The slipway at the seaplane base',
    aim: 'A morning on the practice range four miles south-east of Europa Point: depth charges against the moored rafts, then the guns against the condemned coaster.',
  },
  'first-patrol': {
    photo: 'assets/intro/photo_london_gunwharf.jpg',
    caption: 'A London of the squadron at the Gun Wharf',
    aim: 'The squadron\'s first patrol from the Rock. A German merchantman is reported in the Strait: find her, make sure of what she is, and get a sighting report back to Gibraltar.',
  },
  gluckauf: {
    photo: 'assets/intro/photo_destroyer.jpg',
    caption: 'A destroyer of the Gibraltar force at speed',
    aim: 'Contraband control. Find the German freighter, order her to stop with a low pass across her bows, report her for HMS Wishart and shadow her until the destroyer is up.',
  },
  'oran-recce': {
    photo: 'assets/intro/photo_briefing.jpg',
    caption: 'Briefing on the North Mole',
    aim: 'A look at the French fleet at Mers-el-Kébir, with orders not to provoke them: photograph what is there, count the heavy ships and come away.',
  },
  durbo: {
    photo: 'assets/intro/photo_uboat_air.jpg',
    caption: 'A submarine under attack from the air',
    aim: 'Oil and bubbles off Alborán. Find the trail, bomb the position, call in Firedrake and Wrestler, and stay with them until the submarine is finished.',
  },
  casablanca: {
    photo: 'assets/cine/crew_london_1.jpg',
    caption: 'A London crew walking out',
    aim: 'A long reconnaissance down the Moroccan coast in a Saro London. Vichy fighters are up from Casablanca; the flying boat has to take what comes and bring the photographs home.',
  },
  'straits-dawn': {
    photo: 'assets/cine/crew_swordfish_2.jpg',
    caption: 'Boarding the Swordfish floatplane',
    aim: 'A dawn sweep of the Strait. An Italian submarine is working the narrows on the surface: identify her, attack before she dives, and report the contact.',
  },
  'velella-brin': {
    photo: 'assets/intro/photo_uboat_air.jpg',
    caption: 'A boat caught on the surface',
    aim: 'Two Italian boats in two days. Strafe and bomb the first, then find the second, which will shoot back.',
  },
  w8407: {
    photo: 'assets/intro/photo_crew_dusk.jpg',
    caption: 'Aircrew on the jetty at dusk',
    aim: 'A missing Catalina. Search the reported area, find the wreckage and the dinghy, mark it for the launch and stand by while the Swordfish takes the crew off.',
  },
  u74: {
    photo: 'assets/intro/photo_destroyer.jpg',
    caption: 'HMS Wishart working up',
    aim: 'A submarine hunt east of Cartagena with Wishart and Wrestler. Hold the contact, attack her when she shows, and keep the destroyers on her.',
  },
  veniero: {
    photo: 'assets/intro/photo_uboat_air.jpg',
    caption: 'Charges going down beside a boat',
    aim: 'A boat reported west of Gibraltar. Find her, attack, and see it through to the end.',
  },
  harpoon: {
    photo: 'assets/intro/photo_sunderland_moor.jpg',
    caption: 'A Sunderland at her buoy',
    aim: 'Close escort for the Harpoon convoy through the Strait. Keep station over the ships, put down any boat that tries to work into an attacking position, and stay until they are clear.',
  },
  alabastro: {
    photo: 'assets/intro/photo_sunderland_moor.jpg',
    caption: 'A Sunderland of the squadron',
    aim: 'A surfaced Italian submarine north-west of Bougie. Flt Lt Walshe in W6002/AX-R has the attack; the Alabastro\'s gunners fight back, and her crew go over the side before she sinks.',
    roles: [
      { id: 'cover', name: 'Second aircraft — cover Walshe', historic: true,
        blurb: 'Walshe attacks with his pattern of six, as he did on the day. You stay with him through the run, rake her casing to put her gunners down, and signal the survivors\' position.' },
      { id: 'lead', name: 'Lead — make the attack yourself',
        blurb: 'You take the attack and Walshe stands off to watch the sky and photograph the result. The record gives this attack to Walshe; this is the game\'s change, not history.',
        entitySet: { Alabastro: { holdFor: null, hpFloor: 0.15 } },
        scripts: {
          'Sunderland W6002/AX-R': [
            { do: 'goto', lat: 36.13, lon: -5.12, alt: 450 },
            { do: 'orbit', lat: 36.14, lon: -5.02, radius: 2200, alt: 400, until: { any: [{ near: ['Alabastro', 5000] }, { after: 420 }] } },
            { do: 'orbit', at: 'Alabastro', radius: 2000, alt: 430, until: { flag: 'alabastro-sunk' },
              log: 'AX-R: "She is yours. We will stand off, watch the sky and get the photographs."' },
            { do: 'orbit', at: 'Crew of the Alabastro', radius: 800, alt: 200, until: { stepTime: 100 }, log: 'AX-R: "Forty or so in the water. Circling them for a fix."' },
            { do: 'home', log: 'AX-R: "Setting course for the Rock."' },
          ],
        },
        triggers: [
          { when: { hpBelow: ['Alabastro', 0.9] },
            acts: [
              { flag: 'walshe-attacked' }, { music: 'combat' },
              { vessel: 'Alabastro', set: { behaviour: 'circle', circleRate: 0.06, speedKt: 4, stopped: false, flakRate: 1.4 },
                log: 'Your attack has told: the submarine is circling out of control, and her gunners are firing back.', cls: 'bad' },
            ] },
          { when: { flag: 'strafed' }, acts: [{ vessel: 'Alabastro', set: { flakRate: 0.25 } }, { log: 'Her gun crews are down or sheltering. The fire is slackening.' }] },
          { when: { any: [{ since: ['walshe-attacked', 160] }, { all: [{ flag: 'strafed' }, { since: ['walshe-attacked', 50] }] }] },
            acts: [
              { vessel: 'Alabastro', log: 'Men are coming up out of the conning tower and going over the side. They are abandoning her.' },
              { vessel: 'Alabastro', abandon: 30, survivors: 'Crew of the Alabastro', sunkFlag: 'alabastro-sunk', sunkLog: 'The Alabastro has gone down. About forty men in the water.' },
            ] },
        ],
        objectives: [
          { id: 'takeoff', kind: 'takeoff', text: 'Take off' },
          { id: 'join', kind: 'join', target: 'AX-R', radius: 1200, text: 'Form on Walshe\'s Sunderland, AX-R' },
          { id: 'id', kind: 'identify', target: 'Alabastro', text: 'Find the submarine and identify her' },
          { id: 'attack', kind: 'share', target: 'Alabastro', amount: 0.3, text: 'Attack from astern: your own charges across her' },
          { id: 'guns', kind: 'share', target: 'Alabastro', amount: 0.06, raise: 'strafed', text: 'Silence her guns: rake the casing' },
          { id: 'sink', kind: 'sink', target: 'Alabastro', text: 'The Alabastro abandoned and sunk' },
          { id: 'wt', kind: 'report', target: 'Crew of the Alabastro', text: 'Signal the survivors\' position to Gibraltar' },
          { id: 'home', kind: 'return', text: 'Return to Gibraltar' },
        ] },
    ],
  },
  clark: {
    photo: 'assets/archive/catalina_europa_point_colour.jpg',
    caption: 'A Catalina over Europa Point',
    aim: 'A submarine is waiting at sea with General Mark Clark aboard, back from his clandestine trip to Algeria. One Catalina puts down beside her and takes the party off; the other keeps watch overhead while she is on the water.',
    roles: [
      { id: 'cover', name: 'Second aircraft — keep watch overhead', historic: true,
        blurb: 'Wg Cdr Case puts FP164/L down beside Seraph and takes the General off, as he did. You look the boat over for him first, then circle while the folding canoes cross and see the General home.' },
      { id: 'lead', name: 'Lead — take the pick-up yourself',
        blurb: 'You alight beside Seraph and take the General aboard; Case holds above you and watches the sky. The record gives the pick-up to Case.',
        scripts: {
          'Catalina FP164/L': [
            { do: 'form', side: -1, until: { any: [{ near: ['HMS Seraph', 4000] }, { after: 480 }] } },
            { do: 'orbit', at: 'HMS Seraph', radius: 1500, alt: 400, until: { flag: 'clark-aboard' },
              log: 'FP164/L: "That is Seraph. She is yours — go down and we will hold above you and watch the sky."' },
            { do: 'home', flag: 'case-home', log: 'FP164/L: "Formating on you for the Rock."', log2: 'FP164/L has the Rock ahead.' },
          ],
        },
        triggers: onceDown([
          { after: 10, do: [{ log: 'Seraph\'s folding boats are putting off with General Clark and his party.' },
            { ferry: { from: 'HMS Seraph', to: 'You', boat: 'folboats', trip: 26 } }] },
          { after: 42, do: [{ log: 'The boats are alongside and the passengers are climbing aboard.' }, { ferryDo: { to: 'You', board: true } }] },
        ]),
        objectives: [
          { id: 'takeoff', kind: 'takeoff', text: 'Take off' },
          { id: 'join', kind: 'join', target: 'FP164/L', radius: 1200, text: 'Form up with Wg Cdr Case in FP164/L' },
          { id: 'id', kind: 'identify', target: 'HMS Seraph', text: 'Make sure the submarine is ours before you go down' },
          { id: 'down', kind: 'pickup', target: 'HMS Seraph', radius: 450, seconds: 60, downFlag: 'player-down', raise: 'clark-aboard',
            text: 'Alight beside Seraph and hold her while the boats come across',
            log: 'Down beside Seraph. Hold her steady: her boats are putting off.',
            doneLog: 'General Clark and his party are aboard. Get her off the water.' },
          { id: 'home', kind: 'return', text: 'Bring the General back to Gibraltar' },
        ] },
    ],
  },
  giraud: {
    photo: 'assets/intro/ac_catalina.jpg',
    caption: 'A Catalina of Coastal Command',
    aim: 'General Giraud has been smuggled out of France by submarine and must be in Gibraltar before the Torch landings. One Catalina alights beside the boat and takes him off; a Vichy fighter may come out while she is on the water.',
    roles: [
      { id: 'cover', name: 'Second aircraft — guard the aircraft on the water', historic: true,
        blurb: 'Flt Lt Louw puts FP122/K down and takes the General off — including his fall into the sea. You circle above, and deal with the fighter if it comes.' },
      { id: 'lead', name: 'Lead — take the General off yourself',
        blurb: 'You alight beside Seraph and take the party aboard, fall in the water and all; Louw covers you overhead. The Légion d\'honneur went to Louw for this.',
        scripts: {
          'Catalina FP122/K': [
            { do: 'goto', at: 'HMS Seraph', alt: 380 },
            { do: 'orbit', at: 'HMS Seraph', radius: 1500, alt: 380, until: { flag: 'giraud-aboard' },
              log: 'FP122/K: "Seraph is flashing the signal. Go down — we will hold above you and watch for fighters."' },
            { do: 'home', flag: 'louw-home', log: 'FP122/K: "Formating on you for Gibraltar."', log2: 'FP122/K has the Rock ahead.' },
          ],
        },
        triggers: onceDown([
          { bandit: { name: 'Vichy Curtiss H-75', delay: 30, from: 30, chance: 0.6 } },
          { after: 8, do: [{ log: 'Seraph\'s boat is putting off with General Giraud and his party.' },
            { ferry: { from: 'HMS Seraph', to: 'You', boat: 'dinghy', trip: 19 } }] },
          { after: 30, do: [{ log: 'The General has missed his footing between the boat and your hull. He is in the water!', cls: 'bad' }, { ferryDo: { to: 'You', dunk: true } }] },
          { after: 44, do: [{ log: 'They have him: hauled aboard, soaked through.' }, { flag: 'giraud-aboard' }, { ferryDo: { to: 'You', board: true } }] },
        ]),
        objectives: [
          { id: 'takeoff', kind: 'takeoff', text: 'Take off' },
          { id: 'join', kind: 'join', target: 'FP122/K', radius: 1200, text: 'Form up with Flt Lt Louw in FP122/K' },
          { id: 'down', kind: 'pickup', target: 'HMS Seraph', radius: 450, seconds: 55, downFlag: 'player-down',
            text: 'Alight beside Seraph and hold her while the boat comes across',
            log: 'Down beside Seraph. Her boat is putting off with the General.',
            doneLog: 'The General is aboard, soaked through. Get her off the water.' },
          { id: 'giraud', kind: 'event', flag: 'giraud-aboard', text: 'General Giraud aboard' },
          { id: 'home', kind: 'return', text: 'Bring the General back to Gibraltar' },
        ] },
    ],
  },
  torch: {
    photo: 'assets/intro/photo_briefing.jpg',
    caption: 'Crews briefed for the landings',
    aim: 'The morning of the Torch landings. Cover the invasion shipping coming through the Strait and keep the U-boats down and away from it.',
  },
  u620: {
    photo: 'assets/intro/photo_uboat_air.jpg',
    caption: 'A night attack with the landing lights',
    aim: 'Off Cape St Vincent by night. Hold the ASV contact, light her up on the run in and put your charges across her.',
  },
  u343: {
    photo: 'assets/intro/photo_uboat_air.jpg',
    caption: 'A boat on the surface at night',
    aim: 'U-343 is on the surface in the dark after a Wellington\'s attack. Flt Lt Finch is out after her with you: find her on the ASV, get eyes on her and put out the report he can home on. Her flak is heavy and it hurt Finch\'s aircraft badly.',
    roles: [
      { id: 'cover', name: 'Second aircraft — find her and draw her fire', historic: true,
        blurb: 'You find her and put out the W/T report; Finch runs in and is hit doing it. Rake her gunners as he comes, then see his damaged Catalina home.' },
      { id: 'lead', name: 'Lead — make the attack yourself',
        blurb: 'You run in on her and Finch holds off as cover. It was Finch who went in, and it cost him his port wing, his tanks and a wounded engineer.',
        scripts: {
          'Catalina (Flt Lt Finch)': [
            { do: 'form', side: 1, until: { any: [{ near: ['U-343', 6000] }, { after: 500 }] } },
            { do: 'orbit', at: 'U-343', radius: 3000, alt: 300, until: { flag: 'u343-attacked' },
              log: 'Finch: "Your contact. Run in when you are ready — we will hold off and watch her flak."' },
            { do: 'orbit', at: 'U-343', radius: 2500, alt: 320, until: { stepTime: 60 }, log: 'Finch: "Good work. We are staying up while you clear."' },
            { do: 'home', flag: 'finch-home', log2: 'Finch has the Rock in sight.' },
          ],
        },
        triggers: [
          { when: { identified: 'U-343' }, acts: [{ flag: 'u343-seen' }] },
          { when: { hpBelow: ['U-343', 0.8] },
            acts: [
              { flag: 'u343-attacked' }, { music: 'combat' },
              { vessel: 'U-343', set: { behaviour: 'stayDown', surfaced: false, targetDepth: 35, diveCooldown: 999, leaking: true, speedKt: 6 },
                route: [[36.06, -4.84]], log: 'U-343 has submerged, trailing oil, heading east.' },
            ] },
        ],
        objectives: [
          { id: 'takeoff', kind: 'takeoff', text: 'Take off' },
          { id: 'join', kind: 'join', target: 'Finch', radius: 1500, text: 'Join Flt Lt Finch' },
          { id: 'find', kind: 'identify', target: 'U-343', text: 'Find U-343 on the ASV and get eyes on her' },
          { id: 'wt', kind: 'report', target: 'U-343', text: 'W/T her position before you go in' },
          { id: 'attack', kind: 'share', target: 'U-343', amount: 0.2, text: 'Run in through her flak and put your charges across her' },
          { id: 'home', kind: 'return', text: 'Return to Gibraltar' },
        ] },
    ],
  },
  u761: {
    photo: 'assets/intro/photo_destroyer.jpg',
    caption: 'Destroyers hunting in the Strait',
    aim: 'The squadron\'s last action. U-761 is trying to get through the Strait with HMS Anthony and HMS Wishart tracking her and US Navy aircraft attacking. When she is forced up, Flt Lt Finch goes in after her; the destroyers hunt her down and her crew abandon her.',
    roles: [
      { id: 'cover', name: 'Second aircraft — join the hunt with Finch', historic: true,
        blurb: 'Finch makes the attack that puts her back under. You get your own attack in when you can, report her for the destroyers and circle the survivors.' },
      { id: 'lead', name: 'Lead — put her back under yourself',
        blurb: 'You attack her when she comes up, and Finch stays high to keep the sky and mark her for the destroyers. The straddle on the day was Finch\'s.',
        scripts: {
          'Catalina (Flt Lt Finch)': [
            { do: 'orbit', at: 'U-761', radius: 2500, alt: 350, until: { flag: 'u761-up' } },
            { do: 'orbit', at: 'U-761', radius: 1500, alt: 300, until: { flag: 'u761-sunk' },
              log: 'Finch: "She is yours. We will keep the sky and mark her for the destroyers."' },
            { do: 'orbit', at: 'Survivors of U-761', radius: 700, alt: 180, until: { flag: 'pickup-done' }, log: 'Finch: "Circling the survivors for the destroyers."' },
            { do: 'home', flag: 'finch-home' },
          ],
        },
        triggers: [
          { when: { all: [{ flag: 'u761-up' }, { hpBelow: ['U-761', 0.75] }] },
            acts: [
              { flag: 'finch-attacked' },
              { vessel: 'U-761', set: { behaviour: 'stayDown', surfaced: false, targetDepth: 40, diveCooldown: 999, speedKt: 5 }, log: 'U-761 has submerged again.' },
              { after: 25, do: [{ vessel: 'HMS Anthony', hunt: 'U-761' }, { vessel: 'HMS Wishart', hunt: 'U-761' }, { log: 'HMS Anthony and HMS Wishart are going in after her with depth charges.' }] },
            ] },
          { when: { all: [{ since: ['finch-attacked', 70] }, { hpBelow: ['U-761', 0.3] }] },
            acts: [
              { vessel: 'U-761', log: 'U-761 has come up again, partly surfaced, with men pouring out of the conning tower. She is being abandoned.' },
              { vessel: 'U-761', abandon: 30, sternFirst: true, survivors: 'Survivors of U-761', sunkFlag: 'u761-sunk', sunkLog: 'U-761 has gone down stern first.' },
              { vessel: 'HMS Anthony', set: { hunting: false, huntTarget: null, stopped: true } },
              { vessel: 'HMS Wishart', set: { hunting: false, huntTarget: null, stopped: true } },
            ] },
          { when: { since: ['finch-attacked', 72] }, acts: [{ vessel: 'U-761', damageTo: 0.25 }] },
          { when: { flag: 'u761-sunk' }, acts: [{ after: 70, do: [{ log: 'HMS Anthony and HMS Wishart have picked up 48 survivors.' }, { flag: 'pickup-done' }] }] },
        ],
        objectives: [
          { id: 'takeoff', kind: 'takeoff', text: 'Take off' },
          { id: 'reach', kind: 'reach', target: 'U-761', radius: 3000, text: 'Join the hunt north of Tangier' },
          { id: 'id', kind: 'identify', target: 'U-761', text: 'Get eyes on U-761 when she comes up' },
          { id: 'attack', kind: 'share', target: 'U-761', amount: 0.25, text: 'Straddle her before she can dive again' },
          { id: 'wt', kind: 'report', target: 'U-761', text: 'W/T her position for the destroyers' },
          { id: 'sink', kind: 'sink', target: 'U-761', text: 'U-761 sunk' },
          { id: 'cover', kind: 'cover', target: 'Survivors of U-761', start: 'u761-sunk', flag: 'pickup-done', radius: 2500, text: 'Circle overhead while the survivors are picked up' },
          { id: 'home', kind: 'return', text: 'Return to Gibraltar' },
        ] },
    ],
  },
  free: {
    photo: 'assets/intro/photo_crew_dusk.jpg',
    caption: 'After a patrol',
    aim: 'An open sweep of the Strait with whatever is serviceable. What you meet is placed at random: neutrals, a submarine or two, perhaps a blockade-runner.',
  },
};

// the fallback for anything not listed: a photograph and a plain line
export const DEFAULT_PLAN = { photo: 'assets/intro/photo_briefing.jpg', caption: 'Briefing on the North Mole', aim: '' };
