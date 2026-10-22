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
  // close-ups for the visual pass (Taipei 101, the basin city, the hillside town below the street)
  t_101: { player: [0, 1.4, Math.PI], free: [[-10, 45, -390], [-22.7, 55, -546.8]] },
  t_101_top: { player: [0, 1.4, Math.PI], free: [[-14, 110, -470], [-22.7, 115, -546.8]] },
  t_city: { player: [0, 1.4, Math.PI], free: [[30, 25, -160], [-20, -15, -560]] },
  t_hill: { player: [0, 1.4, Math.PI], free: [[6, 1, -28], [-6, -20, -75]] },
  t_view: { player: [4.5, -28.2, Math.PI], free: [[4.5, -2.4, -27.6], [-22.7, 30, -546.8]] },
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
  // close-ups for the visual pass (the landmarks, the old Bund fronts, the river, the city)
  sh_pearl: { player: [0, 3.4, Math.PI], free: [[-40, 55, -215], [-65.8, 62, -338.7]] },
  sh_jinmao: { player: [0, 3.4, Math.PI], free: [[50, 95, -315], [66.5, 95, -445]] },
  sh_tower: { player: [0, 3.4, Math.PI], free: [[95, 115, -320], [121.6, 110, -454]] },
  sh_swfc: { player: [0, 3.4, Math.PI], free: [[140, 115, -290], [155.8, 112, -417]] },
  sh_city: { player: [0, 3.4, Math.PI], free: [[-20, 26, -95], [60, 30, -430]] },
  sh_river: { player: [0, 3.4, Math.PI], free: [[-3, 2.2, -2.6], [6, -1.7, -40]] },
  sh_bund: { player: [0, 5.6, 0], free: [[-6, 3.2, 5.8], [14, 9, 47]] },
  sh_bund_close: { player: [0, 5.6, 0], free: [[-4, 1.5, 28], [6, 5, 47]] },
  sh_peace: { player: [0, 5.6, 0], free: [[-82, 4, 10], [-118, 24, 47]] },
  sh_bund_wide: { player: [0, 5.6, 0], free: [[0, 9, 0], [0, 16, 47]] },
};
const LOBBY_VIEWS = {
  lb_start: { player: [0, 4.6, Math.PI], view: [0, 0.22] },
  lb_ref: { player: [-1.6, 4.4, Math.PI], free: [[0.4, 2.1, 8.0], [0, 2.4, -4]] },
  lb_gate: { player: [-2.9, -4.7, Math.PI * 0.85], view: [0.36, 0.16] },
  lb_desk: { player: [0, 1.0, Math.PI], view: [0, 0.2] },
  lb_seats: { player: [-3.6, 3.4, -Math.PI / 2], view: [Math.PI / 2 - 0.6, 0.25] },
  lb_back: { player: [0, 1.6, 0], view: [Math.PI, 0.18] },
  lb_wide: { player: [0, 4.6, Math.PI], free: [[4.6, 4.2, 5.4], [-1.5, 1.0, -3.5]] },
  lb_sign: { player: [0, 4.6, Math.PI], free: [[-1.6, 2.6, -3.6], [-3.2, 3.4, -7.9]] },
  lb_tunnel: { player: [0, 4.6, Math.PI], free: [[0, 1.3, 46], [0, 1.25, 60]] },
};
const BAY_VIEWS = {
  // street coordinates: s along the street (z = -s until the bend at s 40), u across (x = u); the spawn is s -6.5, u -4.6
  ba_start: { player: [-4.6, 6.5, Math.PI], view: [-0.04, 0.1] },
  ba_walk: { player: [-4.4, -14, Math.PI], view: [0.1, 0.1] },
  ba_cafe: { player: [-4.4, 3.5, -Math.PI / 2], view: [Math.PI / 2 - 0.45, 0.14] },
  ba_cafe_close: { player: [-4.4, 3.5, Math.PI], free: [[-3.6, 2.2, 6.8], [-8.6, 2.6, -1.5]] },
  ba_car: { player: [-3.6, -6, Math.PI], view: [-0.55, 0.12] },
  ba_car_close: { player: [-4.4, -8, Math.PI], free: [[-3.2, 1.8, -7.5], [0, 1.6, -15]] },
  ba_rail: { player: [6.5, -12, Math.PI / 2], view: [-0.75, 0.08, 3.2] },
  ba_pier: { player: [19.6, -21.6, Math.PI], view: [-0.3, 0.06] },
  ba_wharf: { player: [-4.2, -24, Math.PI], view: [0.1, 0.12] },
  ba_end_prom: { player: [5.2, -25, Math.PI], view: [-0.15, 0.14] },
  ba_end_back: { player: [-1.5, -4, 0], view: [Math.PI - 0.3, 0.16] },
  ba_back: { player: [-4.4, 4, 0], view: [Math.PI, 0.12] },
  // the bridge (sf.js BRIDGE): the south tower at (81, -514), the north tower at (365, -735)
  ba_bridge: { player: [-4.6, 6.5, Math.PI], free: [[20, 30, -250], [215, 60, -630]] },
  ba_tower: { player: [-4.6, 6.5, Math.PI], free: [[-10, 55, -420], [81, 75, -514]] },
  ba_deck: { player: [-4.6, 6.5, Math.PI], free: [[150, 22, -520], [200, 45, -600]] },
  ba_city: { player: [-4.6, 6.5, Math.PI], free: [[40, 30, -200], [480, 40, -700]] },
  ba_aerial: { player: [-4.6, 6.5, Math.PI], free: [[45, 42, 30], [-6, 0, -30]] },
  ba_block: { player: [-4.6, 6.5, Math.PI], free: [[30, 30, 14], [0, 0, -10]] },
  ba_aerial2: { player: [-4.6, 6.5, Math.PI], free: [[-45, 60, -110], [10, 0, -30]] },
};

const VIEWS = SCENE === 'taiwan' ? TAIPEI_VIEWS : SCENE === 'shanghai' ? SHANGHAI_VIEWS : SCENE === 'lobby' ? LOBBY_VIEWS : SCENE === 'bayarea' ? BAY_VIEWS : ROOM_VIEWS;

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
