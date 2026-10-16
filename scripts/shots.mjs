// Usage: node scripts/shots.mjs <outDir> [viewNames...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = process.argv[2] || 'review';
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });

const VIEWS = {
  char_front: { player: [0.0, 0.6, 0], free: [[0.0, 0.78, 1.95], [0.0, 0.58, 0.6]] },
  char_side: { player: [0.0, 0.6, 0], free: [[1.4, 0.78, 0.6], [0.0, 0.58, 0.6]] },
  char_back: { player: [0.0, 0.6, 0], free: [[0.0, 0.95, -0.75], [0.0, 0.58, 0.6]] },
  char_34: { player: [0.0, 0.6, 0], free: [[1.0, 1.0, 1.6], [0.0, 0.55, 0.6]] },
  char_34back: { player: [0.0, 0.6, 0], free: [[-0.95, 1.05, -0.4], [0.0, 0.55, 0.6]] },
  gameplay: { player: [-0.3, 1.4, Math.PI], view: [0.0, 0.4] },
  wide: { free: [[4.3, 3.2, 4.0], [-0.9, 0.6, -2.4]] },
  wide2: { free: [[-4.3, 3.2, 4.0], [1.2, 0.6, -2.0]] },
  wide_kitchen: { free: [[-1.2, 2.5, 3.9], [3.6, 0.8, -0.6]] },
  close_desk: { free: [[-2.6, 1.55, -1.45], [-3.25, 0.95, -3.2]] },
  close_kitchen: { free: [[2.6, 1.7, 0.0], [4.4, 1.05, -0.6]] },
  close_sofa: { free: [[3.4, 1.35, -0.6], [2.2, 0.5, -3.2]] },
  close_loft: { free: [[0.6, 1.8, -1.2], [-0.8, 1.2, -4.2]] },
  fridge_int: { free: [[2.9, 1.5, 0.55], [4.3, 0.9, 1.33]] },
  walking: { player: [-0.3, 1.8, Math.PI], view: [0.35, 0.38] },
};

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(process.env.URL || 'http://localhost:5173/');
await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 60000 });
await page.waitForTimeout(Number(process.env.DELAY || 800));
for (const [name, v] of Object.entries(VIEWS)) {
  if (only.length && !only.includes(name)) continue;
  await page.evaluate((v) => {
    window.__dw.freeCam(null);
    if (v.player) window.__dw.setPlayer(...v.player);
    window.__dw.setView(0, 0.4, 2.6);
    if (v.view) window.__dw.setView(...v.view);
    if (v.free) window.__dw.freeCam(...v.free);
    window.__dw.hud(!v.free);
  }, v);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('shot', name, JSON.stringify(await page.evaluate(() => window.__dw.state())));
}
// mid-walk frame from gameplay camera
if (!only.length || only.includes('walking')) {
  await page.evaluate(() => { window.__dw.freeCam(null); window.__dw.hud(true); window.__dw.setPlayer(-0.3, 1.9, Math.PI); window.__dw.setView(0.35, 0.38, 2.6); });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/walking.png' });
  await page.keyboard.up('KeyW');
}
await browser.close();
