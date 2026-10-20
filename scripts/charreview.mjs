// Character review: front / side / back / 3/4 stills, gameplay-camera stills
// (room + Taiwan) and a recording of walking, turning, stopping and idling.
// Usage: node scripts/charreview.mjs <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createHarness } from './harness.mjs';

const out = process.argv[2] || 'review/character';
fs.mkdirSync(out, { recursive: true });
const URL = process.env.URL || 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

// ---- turnaround stills -------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(URL + '?scene=room');
  await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__dw.hud(false));
  const views = { front: 0, three_quarter: 0.7, side: Math.PI / 2, back: Math.PI, back_three_quarter: 2.45 };
  for (const [name, a] of Object.entries(views)) {
    await page.evaluate((a) => {
      const dw = window.__dw;
      dw.setPlayer(0, 0.6, 0);
      dw.freeCam([Math.sin(a) * 1.75, 0.8, 0.6 + Math.cos(a) * 1.75], [0, 0.58, 0.6]);
    }, a);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/char_${name}.png` });
  }
  await page.close();
}

// ---- gameplay camera stills + recording ------------------------------------------------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: out, size: { width: 1280, height: 800 } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(URL + '?scene=room');
await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 60000 });
const H = createHarness(page);
const { sleep, dragTurn } = H;
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await sleep(ms); for (const k of keys) await page.keyboard.up(k); };

await page.evaluate(() => { window.__dw.setPlayer(-0.3, 1.6, Math.PI); window.__dw.setView(0, 0.4); });
await sleep(1500);
await page.screenshot({ path: `${out}/gameplay_room.png` });

// walk away from the camera, turn left and right while walking, stop, idle
const samples = [];
const sample = async () => samples.push(await page.evaluate(() => window.__dw.state()));
await hold(['KeyW'], 1100); await sample();
await page.keyboard.down('KeyW');
await dragTurn(0.9, 24); await sample();
await dragTurn(-1.6, 30); await sample();
await page.keyboard.up('KeyW');
await sleep(1400); await sample();
await hold(['KeyS'], 900);
await sleep(600);
await hold(['KeyA'], 700);
await hold(['KeyD'], 1300);
await sleep(700); await sample();
await page.screenshot({ path: `${out}/gameplay_room_after_walk.png` });

// side-on walk past a fixed camera (shows the gait, pack sway, hair follow-through)
await page.evaluate(() => { window.__dw.setPlayer(-1.4, 0.9, Math.PI / 2); window.__dw.setView(-Math.PI / 2, 0.3); });
await sleep(300);
await page.evaluate(() => window.__dw.freeCam([0, 0.75, 2.9], [0, 0.55, 0.9]));
await sleep(500);
await hold(['KeyW'], 1500);
await sleep(1200);
await page.evaluate(() => window.__dw.freeCam(null));

// Taiwan: walk down the stairs from the gameplay camera
await page.evaluate(() => window.__dw.travel('taiwan', true));
await page.waitForFunction(() => window.__dw.state().scene === 'taiwan' && !window.__dw.state().traveling, null, { timeout: 20000 });
await sleep(1200);
await page.screenshot({ path: `${out}/gameplay_taiwan.png` });
await hold(['KeyW'], 2600);
await sleep(900);
await page.screenshot({ path: `${out}/gameplay_taiwan_stairs.png` });
await sample();

fs.writeFileSync(`${out}/review.json`, JSON.stringify(samples, null, 1));
const video = page.video();
await ctx.close();
if (video) fs.renameSync(await video.path(), `${out}/walk_and_turn.webm`);
await browser.close();
console.log('wrote', out, samples.map((s) => `${s.scene} ${s.player.x},${s.player.z} fps=${s.fps}`).join(' | '));
