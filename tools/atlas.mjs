// Minimal Atlas MCP client over Streamable HTTP (JSON-RPC), for use from scripts.
//   node tools/atlas.mjs call <tool> '<json-args>'
//   node tools/atlas.mjs download <url> <outfile>
// Needs ATLAS_API_KEY in the environment. Responses are printed as JSON.
import fs from 'fs';
const KEY = process.env.ATLAS_API_KEY;
if (!KEY) { console.error('ATLAS_API_KEY not set'); process.exit(1); }
const URL_ = 'https://mcp.prod-market.atlas.design/mcp';
const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

async function rpc(method, params) {
  const res = await fetch(URL_, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
  const payload = lines.length ? lines[lines.length - 1] : text;
  return JSON.parse(payload);
}

export async function call(name, args = {}) {
  const j = await rpc('tools/call', { name, arguments: args });
  if (j.error) throw new Error(JSON.stringify(j.error));
  const c = j.result && j.result.content && j.result.content[0];
  if (c && c.type === 'text') { try { return JSON.parse(c.text); } catch { return c.text; } }
  return j.result;
}

const [, , cmd, a, b] = process.argv;
if (cmd === 'call') {
  const out = await call(a, b ? JSON.parse(b) : {});
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
} else if (cmd === 'download') {
  const res = await fetch(a, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!res.ok) { console.error('download failed', res.status); process.exit(1); }
  fs.writeFileSync(b, Buffer.from(await res.arrayBuffer()));
  console.log('saved', b, fs.statSync(b).size, 'bytes');
}
