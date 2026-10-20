// Usage: node scripts/shots.mjs <outDir> [viewNames...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = process.argv[2] || 'review';
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });

const SCENE = process.env.SCENE || "room";
const ROOM_VIEWS = {
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
const TAIPEI_VIEWS = {
  t_start: { player: [0, 1.4, Math.PI], view: [0, 0.36] },
  t_wide_top: { player: [0, 1.2, Math.PI], free: [[0.55, 5.6, 3.7], [-0.5, 2.1, -14]] },
  t_char_front: { player: [1.6, -14.4, Math.PI], free: [[1.75, -0.95, -16.0], [1.6, -1.25, -14.4]] },
  t_char_back: { player: [1.6, -14.4, Math.PI], free: [[1.45, -0.75, -12.85], [1.6, -1.3, -14.4]] },
  t_mid: { player: [0.2, -5.6, Math.PI], view: [0.1, 0.34] },
  t_tea: { player: [0.3, -9.6, Math.PI], view: [0.5, 0.3] },
  t_plaza: { player: [1.4, -14.6, Math.PI * 0.75], view: [-0.8, 0.35] },
  t_plaza_back: { player: [2.5, -15.6, 0], view: [Math.PI, 0.35] },
  t_shrine: { player: [-3.4, -14.6, -Math.PI / 2], view: [Math.PI / 2, 0.32] },
  t_lower: { player: [4.0, -18.0, Math.PI], view: [0.25, 0.32] },
  t_lookout: { player: [4.5, -28.2, Math.PI], view: [0.12, 0.08, 3.4] },
  t_close_tea: { free: [[0.2, -0.3, -10.4], [1.6, -0.9, -11.6]] },
  t_close_boba: { free: [[-0.55, 0.55, -5.4], [-1.45, 0.05, -5.95]] },
  t_cat: { free: [[2.4, -0.55, -14.6], [2.55, -0.85, -13.2]] },
  t_tofu: { free: [[0.6, -0.2, -10.9], [-1.5, -0.8, -11.7]] },
  t_noodle: { free: [[3.2, -0.5, -14.2], [5.4, -0.9, -14.9]] },
  t_fruit: { free: [[3.3, -1.5, -20.2], [5.4, -2.0, -20.9]] },
  t_cake: { free: [[0.2, 0.2, -5.4], [1.6, -0.3, -6.3]] },
  t_taro: { free: [[0.1, 1.1, -2.4], [1.6, 0.6, -3.1]] },
  t_flag: { player: [0, 1.4, Math.PI], view: [0, 0.36] },
  t_wide_plaza: { free: [[-1.0, 3.0, -21.5], [1.5, -1.5, -12]] },
};
const SHANGHAI_VIEWS = {
  sh_start: { player: [0, 3.4, Math.PI], view: [0, 0.05] },
  sh_rail: { player: [0.3, -2.25, Math.PI], view: [0.05, 0.08, 3.4] },
  sh_side: { player: [-9.5, 1.2, Math.PI / 2], view: [-Math.PI / 2 + 0.45, 0.22] },
  sh_side_back: { player: [6.0, 0.4, -Math.PI / 2], view: [Math.PI / 2 - 0.5, 0.2] },
  sh_cafe: { player: [11.6, -0.7, 0.3], view: [Math.PI + 0.35, 0.16, 3.4] },
  sh_cafe_in: { player: [13.2, 4.3, 0], view: [Math.PI + 0.25, 0.22] },
  sh_cafe_win: { player: [14.0, 3.6, Math.PI], view: [0.2, 0.12] },
  sh_land: { player: [0, 5.6, 0], view: [Math.PI, 0.18] },
  sh_close: { free: [[-2.75, 1.25, -0.55], [-1.6, 0.55, -2.4]] },
  sh_close_ring: { free: [[1.6, 1.1, -1.4], [2.4, 0.75, -2.9]] },
  sh_iso: { player: [0, 3.4, Math.PI], free: [[-17, 15, 19], [1.5, 0, 0.5]] },
  sh_iso2: { player: [0, 3.4, Math.PI], free: [[22, 11, 14], [6, 0, 1.5]] },
  sh_sky: { player: [0.3, -2.25, Math.PI], free: [[0.3, 1.6, -1.6], [30, 40, -420]] },
};
const VIEWS = SCENE === 'taiwan' ? TAIPEI_VIEWS : SCENE === 'shanghai' ? SHANGHAI_VIEWS : ROOM_VIEWS;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto((process.env.URL || 'http://localhost:5173/') + '?scene=' + SCENE);
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
if (SCENE === 'room' && (!only.length || only.includes('walking'))) {
  await page.evaluate(() => { window.__dw.freeCam(null); window.__dw.hud(true); window.__dw.setPlayer(-0.3, 1.9, Math.PI); window.__dw.setView(0.35, 0.38, 2.6); });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/walking.png' });
  await page.keyboard.up('KeyW');
}
await browser.close();
