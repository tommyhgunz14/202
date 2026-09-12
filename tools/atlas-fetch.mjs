// Downloads every asset named in an Atlas agent report into a folder.
//   node tools/atlas-fetch.mjs <report.json> <outdir> [ext]
// Handles two report styles: a row with one `clip_name` and one file id, and a material row with
// **(n) name** and ids labelled Albedo / Normal / Roughness (saved as name, name_normal, name_rough).
import fs from 'fs';
import { call } from './atlas.mjs';
const [, , reportPath, outDir, ext] = process.argv;
const rep = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const text = rep.response_text || '';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const seen = new Map();
for (const line of text.split(/\r?\n/)) {
  if (!line.trim().startsWith('|')) continue;
  const bold = line.match(/\*\*\(\d+\)\s*([a-z][a-z0-9_]+)\*\*/);
  const tick = line.match(/`([a-z][a-z0-9_]+)`/);
  const name = bold ? bold[1] : tick ? tick[1] : null;
  if (!name) continue;
  const labelled = [...line.matchAll(/(Albedo|Normal|Roughness)[^`]*`(\S+?)`/g)].filter((x) => UUID.test(x[2]));
  if (labelled.length) {
    for (const [, label, fid] of labelled) {
      const key = label === 'Albedo' ? name : label === 'Normal' ? name + '_normal' : name + '_rough';
      if (!seen.has(key)) seen.set(key, fid.match(UUID)[0]);
    }
  } else {
    const fid = line.match(UUID);
    if (fid && !seen.has(name)) seen.set(name, fid[0]);
  }
}
fs.mkdirSync(outDir, { recursive: true });
const KEY = process.env.ATLAS_API_KEY;
for (const [name, fid] of seen) {
  try {
    const a = await call('get_workspace_asset', { fid });
    const url = a.asset && ((a.asset.download && a.asset.download.url) || a.asset.download_url);
    if (!url) { console.log('no url for', name, JSON.stringify(a).slice(0, 240)); continue; }
    const r = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
    if (!r.ok) { console.log('download failed', name, r.status); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    const e = ext || (ct.includes('png') ? 'png' : ct.includes('jpeg') ? 'jpg' : ct.includes('wav') ? 'wav' : ct.includes('mpeg') ? 'mp3' : 'bin');
    fs.writeFileSync(`${outDir}/${name}.${e}`, buf);
    console.log('saved', `${name}.${e}`, buf.length, 'bytes');
  } catch (e) { console.log('error', name, String(e).slice(0, 200)); }
}
console.log('done', seen.size, 'assets');
