// Saves a data-URL (read from stdin) to a file: node tools/save-frame.mjs out.jpg < data.txt
import fs from 'fs';
const out = process.argv[2];
let s = ''; process.stdin.on('data', (d) => s += d).on('end', () => {
  const m = s.trim().match(/^"?data:image\/\w+;base64,([A-Za-z0-9+/=]+)"?$/);
  if (!m) { console.error('no data url'); process.exit(1); }
  fs.writeFileSync(out, Buffer.from(m[1], 'base64')); console.log('saved', out, fs.statSync(out).size);
});
