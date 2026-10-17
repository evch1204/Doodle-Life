// Character turnaround sheet: idle + mid-walk from front / side / back / 3/4,
// composed into one image. Usage: node scripts/charsheet.mjs <out.png> [scene] [x z]
import { chromium } from 'playwright-core';

const outPath = process.argv[2] || 'charsheet.png';
const sceneId = process.argv[3] || 'room';
const px = Number(process.argv[4] ?? (sceneId === 'room' ? 0 : 0));
const pz = Number(process.argv[5] ?? (sceneId === 'room' ? 0.6 : 0));
const F = Number(process.argv[6] ?? 0); // which way the character faces
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto((process.env.URL || 'http://localhost:5173/') + `?scene=${sceneId}`);
await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(() => window.__dw.hud(false));

const angles = [['front', 0], ['3/4', 0.75], ['side', Math.PI / 2], ['back 3/4', 2.4], ['back', Math.PI]];
const shots = [];
for (const walking of [false, true]) {
  for (const [name, a] of angles) {
    const img = await page.evaluate(async ({ px, pz, a, walking, F }) => {
      const dw = window.__dw;
      dw.setPlayer(px, pz, F);
      const y = dw.state().player.y;
      const cam = [px + Math.sin(a) * 1.9, y + 0.85, pz + Math.cos(a) * 1.9];
      dw.freeCam(cam, [px, y + 0.55, pz]);
      if (walking) {
        // walk in place: drive the animation with a fake speed by moving back and forth
        window.__walkHold = true;
      }
      await new Promise((r) => setTimeout(r, 250));
      return true;
    }, { px, pz, a: a + F, walking, F });
    void img;
    if (walking) {
      // hold W with the camera yaw set so W walks toward +z (character facing +z)
      await page.evaluate((F) => window.__dw.setView(F + Math.PI, 0.4), F);
      await page.evaluate(({ px, pz, F }) => window.__dw.setPlayer(px - Math.sin(F) * 1.1, pz - Math.cos(F) * 1.1, F), { px, pz, F });
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(470);
      const st = await page.evaluate(() => window.__dw.state());
      await page.evaluate(({ a, st }) => window.__dw.freeCam([st.player.x + Math.sin(a) * 1.9, st.player.y + 0.85, st.player.z + Math.cos(a) * 1.9], [st.player.x, st.player.y + 0.55, st.player.z]), { a: a + F, st });
      await page.waitForTimeout(40);
      shots.push({ name: `walk ${name}`, buf: await page.screenshot({ clip: { x: 200, y: 120, width: 500, height: 640 } }) });
      await page.keyboard.up('KeyW');
      await page.waitForTimeout(300);
    } else {
      await page.waitForTimeout(300);
      shots.push({ name, buf: await page.screenshot({ clip: { x: 200, y: 120, width: 500, height: 640 } }) });
    }
  }
}
// compose
const html = `<body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(5,300px);gap:4px">${shots.map((s) => `<div style="position:relative"><img style="width:300px;display:block" src="data:image/png;base64,${s.buf.toString('base64')}"><div style="position:absolute;left:6px;top:4px;font:16px sans-serif">${s.name}</div></div>`).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 1516, height: 780 } });
await p2.setContent(html);
await p2.waitForTimeout(200);
await p2.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log('wrote', outPath);
