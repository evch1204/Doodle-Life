// README images: shoots every picture in README.md from the running game, so
// they can be redone whenever the world or the player changes.
// Usage: node scripts/readme_shots.mjs [outDir] [names...]   (default docs/images)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = process.argv[2] || 'docs/images';
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const angle = process.platform === 'darwin' ? 'metal' : 'd3d11';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${angle}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const sleep = (ms) => page.waitForTimeout(ms);
const st = () => page.evaluate(() => window.__dw.state());
const dbg = () => page.evaluate(() => window.__dw.sceneDebug());
async function open(scene, lang = 'en') {
  await page.goto(`${process.env.URL || 'http://localhost:5173/'}?scene=${scene}`);
  await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 60000 });
  await page.evaluate((l) => window.__dw.setLang(l), lang);
  await page.addStyleTag({ content: '#clickhint { display: none !important; }' });
  await sleep(1000);
}
// place the player and the camera; hud false hides the HUD for a clean picture
async function place({ player, view, free, hud = false }) {
  await page.evaluate(({ player, view, free, hud }) => {
    const dw = window.__dw;
    dw.freeCam(null);
    if (player) dw.setPlayer(...player);
    if (view) dw.setView(...view);
    if (free) dw.freeCam(...free);
    dw.hud(hud);
  }, { player, view, free, hud });
  await sleep(600);
}
const until = (fn, timeout = 30000) => page.waitForFunction(fn, null, { timeout });
const settled = () => until(() => window.__dw.state().occupied?.settled);
// stand on a spot, wait for its prompt, and press E
async function use(id, x, z, facing = 0) {
  await page.evaluate(([x, z, f]) => { window.__dw.setPlayer(x, z, f); window.__dw.hud(true); }, [x, z, facing]);
  await until(`window.__dw.state().interact === ${JSON.stringify(id)}`);
  await page.keyboard.press('KeyE');
}

// the barista at Bund Coffee, seen over the player's shoulder
async function talk(snap, lang) {
  await open('shanghai', lang);
  await use('barista', 13.1, 3.9, 0.4);
  await until(() => window.__dw.sceneDebug()?.dialogue);
  await page.evaluate(() => window.__dw.setView(Math.PI + 0.3, 0.2, 2.6));
  await sleep(800);
  await snap();
}

const SHOTS = {
  // ---- the hero and the destinations ----
  hero: async (snap) => { await open('bayarea'); await place({ player: [-4.6, 6.5, Math.PI], view: [-0.04, 0.1, 2.6] }); await snap(); },
  loft: async (snap) => { await open('room'); await place({ player: [-0.3, 1.4, Math.PI], free: [[4.3, 3.2, 4.0], [-0.9, 0.6, -2.4]] }); await snap(); },
  jiufen: async (snap) => { await open('taiwan'); await place({ player: [0, 1.4, Math.PI], view: [0, 0.36, 2.6] }); await snap(); },
  bund: async (snap) => { await open('shanghai'); await place({ player: [0, 3.4, Math.PI], view: [0, 0.05, 2.6] }); await snap(); },
  embarcadero: async (snap) => { await open('bayarea'); await place({ player: [19.6, -21.6, Math.PI], view: [-0.3, 0.06, 2.6] }); await snap(); },
  airport: async (snap) => { await open('lobby'); await place({ player: [-2.9, -4.7, Math.PI * 0.85], view: [0.36, 0.16, 2.6] }); await snap(); },
  // ---- landmarks ----
  golden_gate: async (snap) => { await open('bayarea'); await place({ player: [-4.6, 6.5, Math.PI], free: [[20, 30, -250], [215, 60, -630]] }); await snap(); },
  taipei_101: async (snap) => { await open('taiwan'); await place({ player: [0, 1.4, Math.PI], free: [[-10, 45, -390], [-22.7, 55, -546.8]] }); await snap(); },
  old_bund: async (snap) => { await open('shanghai'); await place({ player: [0, 5.6, 0], free: [[0, 9, 0], [0, 16, 47]] }); await snap(); },
  // ---- things to do ----
  barista: (snap) => talk(snap, 'en'),
  postcard: async (snap) => {
    await open('shanghai');
    await use('photo', 6.75, -2.05, Math.PI);
    await until(() => window.__dw.sceneDebug()?.postcard);
    await sleep(400);
    await snap();
  },
  zh: (snap) => talk(snap, 'zh'),
  sunset: async (snap) => {
    await open('taiwan');
    await use('lookout', 4.5, -28.2, Math.PI);
    await sleep(3000);
    await page.evaluate(() => window.__dw.hud(false));
    await sleep(200);
    await snap();
  },
  bench: async (snap) => {
    await open('bayarea');
    const b = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'bench1'));
    await use('bench1', b.x, b.z, 0);
    await settled();
    await sleep(1200);
    await page.evaluate(() => window.__dw.hud(false));
    await sleep(200);
    await snap();
  },
  jetway: async (snap) => {
    await open('lobby');
    const g = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'gate-shanghai'));
    await use('gate-shanghai', g.x, g.z, Math.PI);
    await until(() => window.__dw.sceneDebug()?.seq?.phase === 'tunnel');
    await sleep(500);
    await snap();
  },
  // ---- the traveler at home ----
  traveler: async (snap) => { await open('room'); await place({ player: [0, 0.6, 0], free: [[1.25, 1.2, 2.5], [0, 0.72, 0.6]] }); await snap(); },
  sit: async (snap) => {
    await open('room');
    await use('sofa', 2.1, -2.66);
    await settled();
    await sleep(1200);
    await page.evaluate(() => window.__dw.hud(false));
    await sleep(200);
    await snap();
  },
  desk: async (snap) => {
    await open('room');
    await use('deskchair', -3.25, -1.75);
    await settled();
    await sleep(1600);
    await page.evaluate(() => window.__dw.hud(false));
    await sleep(200);
    await snap();
  },
  sleep: async (snap) => {
    await open('room');
    await use('bed', 0.28, -2.4);
    await settled();
    await sleep(1500);
    await page.evaluate(() => window.__dw.hud(false));
    await sleep(200);
    await snap();
  },
};

let failed = 0;
for (const [name, shoot] of Object.entries(SHOTS)) {
  if (only.length && !only.includes(name)) continue;
  try {
    await shoot(() => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 88 }));
    console.log('shot', name);
  } catch (e) {
    failed++;
    console.log('FAILED', name, e.message.split('\n')[0], JSON.stringify(await st().catch(() => null)), JSON.stringify(await dbg().catch(() => null))?.slice(0, 200));
  }
}
await browser.close();
if (failed) process.exit(1);
