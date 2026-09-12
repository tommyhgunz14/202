// Run captured game frames through the exported Atlas "art-review" API (vision critique against
// reference photographs). Usage:
//   node tools/atlas-review.mjs <outdir> <name>=<context> [<name>=<context> ...]
// Reads captures/<name>.jpg, writes <outdir>/<name>.review.json. Needs ATLAS_API_KEY.
import fs from 'fs';
import path from 'path';
const KEY = process.env.ATLAS_API_KEY;
if (!KEY) { console.error('ATLAS_API_KEY not set'); process.exit(1); }
const BASE = 'https://api.prod-market.atlas.design/0.2';
const API_ID = '29689b43-ba97-4aba-b7c9-2952ff957ba8';
const H = { Authorization: `Bearer ${KEY}` };
const [, , outDir, ...jobs] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

async function upload(file) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)], { type: 'image/jpeg' }), path.basename(file));
  const r = await fetch(`${BASE}/upload`, { method: 'POST', headers: H, body: fd });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error('upload failed: ' + JSON.stringify(j));
  return j.file_id;
}

for (const job of jobs) {
  const eq = job.indexOf('=');
  const name = job.slice(0, eq), context = job.slice(eq + 1);
  const file = path.join('captures', name + '.jpg');
  try {
    const fid = await upload(file);
    const r = await fetch(`${BASE}/api_execute/${API_ID}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ context, frame: fid }) });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error('execute failed: ' + JSON.stringify(j).slice(0, 500));
    let review = j.outputs && j.outputs.review;
    try { review = JSON.parse(String(review).replace(/^```json\s*|```\s*$/g, '')); } catch { /* keep raw */ }
    fs.writeFileSync(path.join(outDir, name + '.review.json'), JSON.stringify({ name, context, review, raw: j }, null, 2));
    console.log(name, 'score', review && review.score, '| one change:', review && review.one_change);
  } catch (e) {
    console.log(name, 'ERROR', e.message);
  }
}
