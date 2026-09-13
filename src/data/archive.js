// The photograph archive shown from the title screen.
//
// Two kinds of plate, kept apart on purpose so the screen never passes one off as the other:
//   kind: 'archive'        a real photograph of the period, supplied to the project
//   kind: 'reconstruction' an image generated for this game, period in style but not a photograph
//
// To add a plate: drop the file in assets/archive/ and add an entry here. Anything whose file is
// missing is skipped, so a half-filled manifest is harmless.

export const PLATES = [
  {
    file: 'assets/archive/catalina_europa_point.jpg',
    kind: 'archive',
    title: 'Catalina over Europa Point',
    date: 'c. 1941–43',
    caption: 'A Consolidated Catalina of Coastal Command over the southern tip of Gibraltar, '
           + 'turning north-west across the mouth of the Strait. Europa Point is below with the '
           + 'lighthouse on the shoulder and the barrack terraces cut into the limestone behind; '
           + 'the Bay of Algeciras opens beyond the point and the Spanish shore runs away to the '
           + 'north. This is the ground the sorties in this game are flown over.',
    credit: 'Photographer unknown. Supplied for this project; rights not established.',
  },

  // The generated period pictures already in the game, gathered here so the archive shows what
  // the game looks at. Labelled as reconstructions, not photographs.
  { file: 'assets/intro/photo_london_gunwharf.jpg', kind: 'reconstruction', title: 'Saro London at the Gun Wharf', date: '1940',
    caption: 'A London Mk II of the squadron moored at the Gun Wharf and refuelling from a barge, the Rock behind.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/intro/photo_briefing.jpg', kind: 'reconstruction', title: 'Briefing on the North Mole', date: '1941',
    caption: 'Crews briefed in a hut on the North Mole, the chart of the Strait on the wall.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/intro/photo_swordfish_slip.jpg', kind: 'reconstruction', title: 'Swordfish on the slipway', date: '1940',
    caption: 'The Swordfish floatplane on the concrete slip with a beaching trolley under her floats.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/intro/photo_sunderland_moor.jpg', kind: 'reconstruction', title: 'Sunderland at her moorings', date: '1942',
    caption: 'A Sunderland lying to her buoy in the harbour, a dinghy at the bow and destroyers beyond.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/intro/photo_uboat_air.jpg', kind: 'reconstruction', title: 'U-boat under attack', date: '1941',
    caption: 'A surfaced Type VIIC seen from a Catalina at about 500 feet, charges going down beside her.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/intro/photo_destroyer.jpg', kind: 'reconstruction', title: 'HMS Wishart at speed', date: '1941',
    caption: 'The destroyer working up through the Strait, seen from the air.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/intro/photo_crew_dusk.jpg', kind: 'reconstruction', title: 'Aircrew on the jetty at dusk', date: '1941',
    caption: 'Five of a crew on the timber jetty after a patrol, their Catalina moored behind.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/intro/promo_horner.jpg', kind: 'reconstruction', title: 'Promotion on the quay', date: 'June 1942',
    caption: 'The wing commander\'s braid going on to a squadron leader\'s cuff. The date of T. Q. Horner\'s own '
           + 'promotion is not documented; this is staged at a squadron milestone. See Sources & accuracy.', credit: 'Generated for this project (Atlas).' },
];
