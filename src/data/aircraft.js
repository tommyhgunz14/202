// 202 Squadron's wartime types at Gibraltar with performance drawn from published figures.
// Speeds in mph, ceiling in ft, range in statute miles, weights in lb. Scores are 0–10 and
// drive both the selection screen and the flight model (see flight.js).
export const AIRCRAFT = {
  london: {
    id: 'london',
    name: 'Saro London Mk II',
    maker: 'Saunders-Roe A.27',
    asset: 'assets/saro_london.js',
    service: { from: '1937-12', to: '1941-06' },
    code: 'TQ-A', serial: 'K9683',
    crew: 6,
    engines: '2 × Bristol Pegasus X, 1,000 hp',
    maxSpeed: 155, cruise: 129, stall: 62, ceiling: 19900, range: 1100, climbFpm: 1200,
    guns: [
      { node: 'gun_nose', name: '.303 Lewis (bow)', rounds: 970, rpm: 550, arc: 'forward' },
      { node: 'gun_dorsal', name: '.303 Lewis (midships)', rounds: 970, rpm: 550, arc: 'upper' },
      { node: 'gun_tail', name: '.303 Lewis (tail)', rounds: 970, rpm: 550, arc: 'rear' },
    ],
    stores: { kind: '250 lb anti-submarine bomb', count: 10, label: 'A/S bombs' },
    asv: false,
    handling: { rollRate: 0.55, pitchRate: 0.33, yawRate: 0.35, accel: 3.0, drag: 1.0, stability: 0.8 },
    toughness: 4, draft: 0.9,
    scores: { speed: 3, endurance: 5, climb: 3, agility: 3, payload: 5, defence: 4, detection: 2, toughness: 4 },
    notes: 'Biplane flying boat that opened the war at Gibraltar: six were on the harbour moorings by 10 September 1939. Slow but docile, with an open bow gun and a good view. No radar: the search is by eye.',
  },
  swordfish: {
    id: 'swordfish',
    name: 'Fairey Swordfish I (floatplane)',
    maker: 'Fairey Aviation',
    asset: 'assets/swordfish_floatplane.js',
    service: { from: '1940-09', to: '1941-06' },
    code: 'TQ-B', serial: 'K8422',
    crew: 3,
    engines: '1 × Bristol Pegasus IIIM3, 690 hp',
    maxSpeed: 124, cruise: 100, stall: 52, ceiling: 10700, range: 546, climbFpm: 700,
    guns: [
      { node: 'gun_nose', name: '.303 Vickers (fixed, starboard)', rounds: 600, rpm: 700, arc: 'forward', fixed: true },
      { node: 'gun_dorsal', name: '.303 Vickers K (rear)', rounds: 600, rpm: 950, arc: 'rear' },
    ],
    stores: { kind: '250 lb anti-submarine bomb', count: 4, label: 'A/S bombs' },
    asv: false,
    handling: { rollRate: 1.0, pitchRate: 0.65, yawRate: 0.6, accel: 2.7, drag: 1.3, stability: 0.6 },
    toughness: 3, draft: 0.45,
    scores: { speed: 2, endurance: 2, climb: 2, agility: 8, payload: 2, defence: 2, detection: 2, toughness: 3 },
    notes: 'Floatplane Swordfish taken over from No. 3 AACU in September 1940 for short patrols across the mouth of the Strait. Very manoeuvrable, very slow, no radar, two bombs.',
  },
  catalina: {
    id: 'catalina',
    name: 'Consolidated Catalina Mk I',
    maker: 'Consolidated Model 28-5',
    asset: 'assets/catalina_mk1.js',
    service: { from: '1941-04', to: '1945-06' },
    code: 'AX-L', serial: 'Z2147',
    crew: 9,
    engines: '2 × Pratt & Whitney R-1830-S1C3-G Twin Wasp, 1,200 hp',
    maxSpeed: 196, cruise: 125, stall: 70, ceiling: 15800, range: 2520, climbFpm: 1000,
    guns: [
      { node: 'gun_nose', name: '.303 Vickers K (bow)', rounds: 1000, rpm: 950, arc: 'forward' },
      { node: 'gun_waist_l', name: '.303 Vickers K (port blister)', rounds: 1000, rpm: 950, arc: 'left' },
      { node: 'gun_waist_r', name: '.303 Vickers K (stbd blister)', rounds: 1000, rpm: 950, arc: 'right' },
      { node: 'gun_tail', name: '.303 (tunnel)', rounds: 500, rpm: 950, arc: 'rear' },
    ],
    stores: { kind: '250 lb Mk VIII depth charge', count: 8, label: 'depth charges' },
    asv: true,
    handling: { rollRate: 0.5, pitchRate: 0.36, yawRate: 0.35, accel: 3.2, drag: 0.9, stability: 0.9 },
    toughness: 6, draft: 1.1,
    scores: { speed: 5, endurance: 10, climb: 4, agility: 3, payload: 6, defence: 5, detection: 8, toughness: 6 },
    notes: 'Arrived April 1941. Z2147 “L” was credited with nine attacks on submarines while with the squadron. Twenty hours in the air, ASV Mk II radar, four depth charges on the wing racks.',
  },
  sunderland: {
    id: 'sunderland',
    name: 'Short Sunderland Mk I',
    maker: 'Short Brothers S.25',
    asset: 'assets/sunderland_mk1.js',
    service: { from: '1941-12', to: '1942-09' },
    code: 'TQ-K', serial: 'W3985',
    crew: 10,
    engines: '4 × Bristol Pegasus XXII, 1,010 hp',
    maxSpeed: 210, cruise: 178, stall: 78, ceiling: 15000, range: 1780, climbFpm: 1200,
    guns: [
      { node: 'gun_nose', name: '2 × .303 Browning (FN-11 nose turret)', rounds: 2000, rpm: 2300, arc: 'forward' },
      { node: 'gun_waist_l', name: '.303 Vickers K (port hatch)', rounds: 1000, rpm: 950, arc: 'left' },
      { node: 'gun_waist_r', name: '.303 Vickers K (stbd hatch)', rounds: 1000, rpm: 950, arc: 'right' },
      { node: 'gun_tail', name: '4 × .303 Browning (FN-13 tail turret)', rounds: 4000, rpm: 4600, arc: 'rear' },
    ],
    stores: { kind: '250 lb Mk VIII depth charge', count: 12, label: 'depth charges' },
    asv: true,
    handling: { rollRate: 0.42, pitchRate: 0.32, yawRate: 0.3, accel: 3.8, drag: 0.85, stability: 1.0 },
    toughness: 8, draft: 1.3,
    scores: { speed: 7, endurance: 7, climb: 5, agility: 2, payload: 9, defence: 9, detection: 8, toughness: 8 },
    notes: 'A flight of Sunderlands served alongside the Catalinas from December 1941 to September 1942. The “Flying Porcupine”: fastest, best armed, eight depth charges, ASV radar; heavy on the controls.',
  },
};

export const SCORE_LABELS = {
  speed: 'Speed', endurance: 'Endurance', climb: 'Climb', agility: 'Agility',
  payload: 'Payload', defence: 'Defence', detection: 'Detection', toughness: 'Toughness',
};

export function availableOn(dateISO) {
  return Object.values(AIRCRAFT).filter((a) => a.service.from <= dateISO.slice(0, 7) && a.service.to >= dateISO.slice(0, 7));
}
