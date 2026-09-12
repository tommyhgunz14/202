You are building ONE or more Three.js asset modules for a WWII game about 202 Squadron RAF at
Gibraltar. Read these two files first and obey them exactly:
  D:\github\202\docs\STYLE-LOCK.md
  D:\github\202\docs\ASSET-BRIEF.md

Each module is an ES module with `export default function (THREE) { ... return group; }`.
Do NOT import anything. Do not use the game code; only THREE primitives.

Build method (be economical with tokens): write ONE careful module, run the verifier, LOOK at
the PNG it produces with the Read tool, then do up to TWO refinement rounds fixing proportions,
silhouette and markings, re-rendering each time. No more than ~6 verifier runs per object.

Work in your own scratch directory so parallel agents do not collide:
  C:\Users\thetb\AppData\Local\Temp\claude\D--github-202\59196325-8f5c-44d4-ab2f-d77197c476a6\scratchpad\work_<name>\
Put the module there as <name>.js and run the verifier on that directory (puppeteer is installed):
  node "C:/Users/thetb/AppData/Local/Temp/claude/D--github-202/59196325-8f5c-44d4-ab2f-d77197c476a6/scratchpad/404-game-recipe/harness/verify.mjs" "<your work dir>" --size=480
It writes <work dir>/_verify/*.png (front, right, back, left, three-quarter). Read the PNG.
When satisfied, copy the final module to D:\github\202\assets\<name>.js. Use Bash (Git Bash).

Hard requirements for every final module:
- The named nodes listed in ASSET-BRIEF.md (prop / gun_* / cockpit / bomb_bay for aircraft;
  bridge / gun / userData.waterline for vessels) must exist.
- Triangle count 3,000–40,000. Real metres. Front (+Z) = nose/bow. Base at y=0, centred x/z.
- Colours only from STYLE-LOCK.md. Markings built as geometry (roundels, codes, serials, flashes).
- The final file must load cleanly (no syntax errors, no console errors) in the verifier.

When finished, report in under 200 words: final file path(s), triangle count, dimensions measured
by the verifier, and any historical detail you were unsure about.
