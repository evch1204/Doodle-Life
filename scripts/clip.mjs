// Review clip (Milestone 3): gameplay camera, real input. Room -> door ->
// travel card -> Taiwan; walk down the stairs, turn, stop; talk to the cat;
// down to the lookout and watch the sunset; pick up a star; climb back up and
// head home. Usage: node scripts/clip.mjs <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createHarness } from './harness.mjs';

const out = process.argv[2] || 'review/m3/clip';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 853 }, recordVideo: { dir: out, size: { width: 1280, height: 853 } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto((process.env.URL || 'http://localhost:5173/'));
await page.waitForFunction(() => window.__dw && window.__dw.ready);
const H = createHarness(page);
const { sleep, st, press, dragTurn, goTo, loadModel } = H;
const hold = async (key, ms) => { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); };

// room: start near the door so the clip gets to Taiwan quickly
await page.evaluate(() => { window.__dw.setPlayer(-1.2, 2.3, Math.PI * 0.75); window.__dw.setView(-0.9, 0.38); });
await sleep(1200);
await loadModel();
await goTo(-2.4, 3.45);
await sleep(400);
await press('KeyE');
await page.waitForFunction(() => window.__dw.state().scene === 'taiwan' && !window.__dw.state().traveling, null, { timeout: 15000 });
await loadModel();
await sleep(800);

// walk down the first flight, stop (settle), look around, continue
await hold('KeyW', 2600);
await sleep(900);
await dragTurn(-0.9, 20);
await sleep(500);
await dragTurn(0.9, 20);
await hold('KeyW', 1800);
await hold('KeyA', 500);
await hold('KeyW', 1400);
await sleep(700);
// turn on the spot (head leads, hair follows), then on to the plaza
await hold('KeyD', 350);
await sleep(300);
await hold('KeyA', 350);
await sleep(400);
await goTo(2.55, -13.95);
await sleep(300);
await press('KeyE');
await sleep(2600);
// down the lower street to the lookout
await goTo(4.1, -18.8);
await goTo(4.1, -24.0);
await goTo(4.5, -28.2);
await sleep(300);
await press('KeyE');
await sleep(4800);
// a star on the lookout corner
await goTo(7.7, -27.9);
await sleep(200);
await press('KeyE');
await sleep(1500);
// back up the stairs, then (cut) home
await goTo(4.1, -22.4);
await goTo(4.1, -18.0);
await sleep(600);
await page.evaluate(() => { window.__dw.setPlayer(0.2, -0.4, 0); window.__dw.setView(Math.PI, 0.36); });
await sleep(500);
await goTo(0.75, 1.25);
await sleep(300);
await press('KeyE');
await page.waitForFunction(() => window.__dw.state().scene === 'room' && !window.__dw.state().traveling, null, { timeout: 15000 });
await sleep(1500);
console.log('final', JSON.stringify(await st()));
await ctx.close();
await browser.close();
