# Guardians of the Rock — the locked style

> Every object is 1939–1943 military hardware built from hard-edged Three.js primitives at true
> proportions, painted in flat matte period colours with nothing on it that was not on the real
> thing (roundels, code letters, serials, boot-topping, pennant numbers), sized in real metres.

Read together with `ASSET-BRIEF.md` (the contract every module must obey).

## Palette (exact hex — use these, do not invent shades)

| role | hex | where it belongs |
|---|---|---|
| Extra Dark Sea Grey | `0x4b5057` | RAF upper surfaces (Temperate Sea Scheme), disruptive pattern colour A |
| Dark Slate Grey | `0x4d5a4c` | RAF upper surfaces (Temperate Sea Scheme), disruptive pattern colour B |
| Sky (Type S) | `0xc9d3b4` | RAF under surfaces 1940–41 (London, Swordfish, early Catalina) |
| Sky Grey | `0xa7aeae` | RAF under surfaces 1939–40 (Saro London at outbreak of war) |
| Insignia / Coastal White | `0xeeeeea` | Catalina & Sunderland sides and undersides from 1942 (anti-submarine white) |
| Aluminium dope | `0xc6c8c7` | Bare metal / silver-doped detail only (float struts, prop hubs) |
| Roundel Dull Red | `0xa02a30` | roundel centres, fin flash forward stripe |
| Roundel Dull Blue | `0x1f3468` | roundel outer ring, fin flash rear stripe |
| Roundel Yellow | `0xd8b43c` | Type A1 roundel outer ring (fuselage) |
| Code letter Medium Sea Grey | `0x8e949a` | squadron codes TQ / AX and individual letters on RAF aircraft |
| Black | `0x141517` | serial numbers, hull anti-fouling bottoms, tyres, exhausts, gun barrels |
| Kriegsmarine Hellgrau 50 | `0x707881` | U-boat upper hull / tower |
| Kriegsmarine Dunkelgrau 51 | `0x41464c` | U-boat lower hull, saddle tanks, deck |
| Regia Marina Grigio | `0x6c7570` | Italian submarine hull |
| Regia Marina deck | `0x4a4f4a` | Italian submarine deck & tower top |
| RN Mediterranean Light Grey (507C) | `0x9da4a8` | Royal Navy destroyer hull & superstructure |
| RN deck Corticene | `0x7a4d3c` | Royal Navy destroyer decks |
| Marine Nationale Gris Bleu | `0x5c6872` | Vichy French destroyer hull & superstructure |
| Merchant black hull | `0x1e2023` | German freighter & neutral coaster hulls above waterline |
| Boot-topping red | `0x8a2f24` | anti-fouling band at merchant waterlines |
| Merchant superstructure buff | `0xd7cbb0` | freighter deckhouses, derrick posts |
| Funnel buff | `0xc9a46a` | merchant funnels |
| Timber deck | `0xb08a5a` | wooden decks, fishing boat hull planking |
| Canvas | `0xb9b09a` | tarpaulins, boat covers, gun covers |
| Brass | `0xb08d3e` | ship fittings, propellers |

## Fixed decisions
- Metres, real size. Front faces +Z (aircraft nose, ship bow both point along +Z).
- Base at y = 0, centred on x and z. For aircraft that is the bottom of the hull / floats. For
  ships it is the KEEL — waterline height goes in `g.userData.waterline` (metres above y=0) so the
  game can sink the hull to the right depth.
- Flat colours with sensible roughness (paint 0.85, bare metal 0.45, glass 0.15 with slight
  transparency). No textures, no images.
- Material names from the contract list only: `metal | timber | fabric | canvas | glass`.
- Aircraft: Saro London Mk II span 24.38 m, length 17.31 m. Fairey Swordfish floatplane span
  13.87 m, length 12.06 m. Consolidated Catalina Mk I span 31.70 m, length 19.46 m. Short
  Sunderland Mk I span 34.38 m, length 26.01 m.
- Vessels: Type VIIC U-boat 67.1 m × 6.2 m beam. Italian Brin-class 72.5 m × 6.9 m. Modified
  W-class destroyer (HMS Wishart) 95.1 m × 9.0 m. Le Fantasque-class 132.4 m × 12.0 m. German
  tramp freighter 118 m × 16 m. Spanish coaster 48 m × 8 m. Spanish fishing boat 16 m × 4.5 m.
