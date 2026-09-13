// Headless screenshots of the running game with puppeteer (for checking visuals without the
// desktop preview pane). Usage:
//   PUPPETEER_DIR=<dir containing node_modules/puppeteer> node tools/shoot.mjs <url> <scenario.mjs>
// The scenario module exports an async function (page, shot) => {}; shot(name) saves
// captures/<name>.png (full page, including HUD and overlays). Keys: page.keyboard.
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
const dir = process.env.PUPPETEER_DIR;
if (!dir) { console.error('PUPPETEER_DIR not set'); process.exit(1); }
const require = createRequire(dir.replace(/\/?$/, '/') + 'package.json');
const puppeteer = require('puppeteer');
const [, , url, scenarioPath] = process.argv;
mkdirSync('captures', { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800'], protocolTimeout: 300000 });
const page = await browser.newPage();
await page.setViewport({ width: +(process.env.SHOT_W || 1280), height: +(process.env.SHOT_H || 800), deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'load' });
const shot = async (name) => { await page.screenshot({ path: `captures/${name}.png` }); console.log('shot', name); };
const scenario = (await import(pathToFileURL(scenarioPath).href)).default;
try { await scenario(page, shot); } catch (e) { console.log('SCENARIO ERROR', e.message); }
await browser.close();
