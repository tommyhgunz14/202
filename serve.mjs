// Tiny static server so the game runs from this folder with no build step: node serve.mjs
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, normalize } from 'path';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORT = +(process.env.PORT || 8202);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

createServer(async (req, res) => {
  try {
    // development helper: POST /_capture?name=x with a data-URL body saves captures/x.jpg
    if (req.method === 'POST' && req.url.startsWith('/_capture')) {
      const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'frame').replace(/[^a-z0-9_-]/gi, '');
      let body = ''; req.on('data', (d) => body += d); await new Promise((r) => req.on('end', r));
      const m = body.match(/^data:image\/\w+;base64,(.+)$/);
      if (!m) { res.writeHead(400); return res.end('bad'); }
      const { mkdirSync, writeFileSync } = await import('fs');
      mkdirSync(join(ROOT, 'captures'), { recursive: true });
      writeFileSync(join(ROOT, 'captures', name + '.jpg'), Buffer.from(m[1], 'base64'));
      res.writeHead(200); return res.end('ok');
    }
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end(); }
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(301, { Location: p + '/index.html' }); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`Guardians of the Rock: http://localhost:${PORT}`));
