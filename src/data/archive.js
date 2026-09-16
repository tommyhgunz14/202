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
    file: 'assets/archive/passing_out_1930_original.jpg',
    kind: 'archive',
    title: 'Passing-out term, winter 1930',
    date: 'Winter 1930',
    caption: 'The passing-out term photographed in front of a timber hut, thirteen standing and eleven seated, '
           + 'with the names printed on the mount. T. Q. Horner is seated second from the left. This is the '
           + 'print as it was supplied.',
    credit: 'Photograph by Gale & Polden Ltd, Aldershot, as printed on the mount. Family collection; rights not established.',
  },
  {
    file: 'assets/intro/passing_out_1930.jpg',
    kind: 'archive',
    title: 'Passing-out term, winter 1930 (colourised)',
    date: 'Winter 1930',
    caption: 'The same print tinted by hand for this project, the way studio prints were coloured at the time. '
           + 'Only colour is added: the lightness of every point is the original photograph\'s, so no face or '
           + 'detail has been redrawn. The colours are informed guesses (RAF blue-grey cloth, a dark timber hut, '
           + 'winter grass), not a record.',
    credit: 'Gale & Polden Ltd, Aldershot. Colourised for this project (tools/colourise-passing-out.mjs).',
  },

  // The generated period pictures already in the game, gathered here so the archive shows what
  // the game looks at. Labelled as reconstructions, not photographs.
  { file: 'assets/cine/crew_london_1.jpg', kind: 'reconstruction', title: 'Walking out to a Saro London', date: '1940',
    caption: 'A crew in Sidcot suits and Mae Wests going out along the pontoon to their twin-finned London biplane flying boat. From the pre-flight walk-out sequence.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/cine/crew_swordfish_2.jpg', kind: 'reconstruction', title: 'Boarding the Swordfish floatplane', date: '1941',
    caption: 'A crewman climbing the float strut to the open cockpit of a Swordfish floatplane at the pontoon. From the pre-flight walk-out sequence.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/cine/crew_catalina_1.jpg', kind: 'reconstruction', title: 'A Catalina crew walking out', date: '1941',
    caption: 'Nine men in Irvin jackets and Mae Wests heading for a Coastal Command Catalina, the Rock behind. From the pre-flight walk-out sequence.', credit: 'Generated for this project (Atlas).' },
  { file: 'assets/cine/crew_sunderland_2.jpg', kind: 'reconstruction', title: 'Boarding a Sunderland', date: '1942',
    caption: 'Kit passed up from a dinghy through the forward entry door of a Sunderland. From the pre-flight walk-out sequence.', credit: 'Generated for this project (Atlas).' },
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
