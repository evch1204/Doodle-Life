// Review clip (Milestone 4): gameplay camera, real input (click-drag look,
// never pointer lock). Room -> postcard -> travel card -> the Bund; walk from
// the spawn to the railing, sweep the camera across the skyline, use the
// viewpoint, take a photo, walk to Bund Coffee and talk to the barista.
// Usage: URL=http://localhost:5174/ node scripts/clip_shanghai.mjs <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createHarness } from './harness.mjs';

const out = process.argv[2] || 'review/m4/clip';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 853 }, recordVideo: { dir: out, size: { width: 1280, height: 853 } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(process.env.URL || 'http://localhost:5173/');
await page.waitForFunction(() => window.__dw && window.__dw.ready);
const H = createHarness(page);
const { sleep, st, press, dragTurn, goTo, loadModel } = H;
const hold = async (key, ms) => { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); };

// room: start near the postcard so the clip gets to Shanghai quickly
await page.evaluate(() => { window.__dw.setPlayer(-2.6, 2.2, Math.PI * 0.85); window.__dw.setView(-0.6, 0.38); });
await sleep(1000);
await loadModel();
await goTo(-3.35, 3.62);
await sleep(500);
await press('KeyE');
await page.waitForFunction(() => window.__dw.state().scene === 'shanghai' && !window.__dw.state().traveling, null, { timeout: 15000 });
await loadModel();
await sleep(1500);

// spawn -> the railing, looking at the skyline
await hold('KeyW', 2700);
await sleep(800);
// sweep the camera slowly across the skyline and back
await dragTurn(-0.9, 40);
await sleep(400);
await dragTurn(1.6, 70);
await sleep(400);
await dragTurn(-0.7, 30);
await sleep(600);
// the viewpoint
await goTo(0.0, -2.1);
await sleep(300);
await press('KeyE');
await sleep(5200);
// along the railing to the photo spot, take a photo
await goTo(6.75, -2.05);
await sleep(300);
await press('KeyE');
await sleep(6000);
// to the café, inside, talk to the barista
await goTo(11.1, 0.4);
await goTo(11.1, 2.8);
await sleep(600);
await goTo(13.45, 4.55);
await sleep(300);
await press('KeyE');
await sleep(3500);
await press('KeyE');
await sleep(3500);
// turn around to the windows and the river
await dragTurn(Math.PI, 60);
await sleep(1500);
console.log('final', JSON.stringify(await st()));
await ctx.close();
await browser.close();
