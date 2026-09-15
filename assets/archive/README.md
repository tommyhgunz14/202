# Photograph archive

Real photographs of the period go in this folder. They are listed in `src/data/archive.js` and
shown on the **Photograph archive** screen, reached from the title screen or from Sources &
accuracy.

The archive screen keeps photographs and generated reconstructions in separate sections, so a
picture made for this game is never shown as though it were a contemporary photograph.

## Expected files

| File | Plate |
|---|---|
| `catalina_europa_point.jpg` | A Catalina of Coastal Command over Europa Point, Gibraltar, c. 1941–43 |
| `catalina_europa_point_colour.jpg` | The same, colourised by `tools/colourise-catalina.mjs` (colour only; lightness untouched) |
| `passing_out_1930_original.jpg` | The passing-out term, winter 1930 (colourised copy in `assets/intro/`) |

A plate whose file is missing still lists, and says the file is not here yet, so the screen never
breaks on an incomplete folder.

## Rights

Note the provenance and rights of anything placed here in its entry in `src/data/archive.js`.
Wartime British official photographs are often held by the Imperial War Museum under their own
licence terms; none are included in this repository.
