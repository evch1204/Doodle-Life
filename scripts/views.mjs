// Close turnaround of the player from fixed angles, composed into one strip.
// Usage: node scripts/views.mjs <out.png> [dist] [lookY] [camY] [scene] [x z]
import { chromium } from 'playwright-core';

const outPath = process.argv[2] || 'views.png';
const dist = Number(process.argv[3] ?? 1.6);
const lookY = Number(process.argv[4] ?? 0.6);
const camY = Number(process.argv[5] ?? 0.75);
const sceneId = process.argv[6] || 'room';
const px = Number(process.argv[7] ?? 0), pz = Number(process.argv[8] ?? 0.6);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto((process.env.URL || 'http://localhost:5173/') + `?scene=${sceneId}`);
await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(() => window.__dw.hud(false));
const angles = [['front', 0], ['front 3/4', 0.75], ['side', Math.PI / 2], ['back 3/4', 2.4], ['back', Math.PI], ['other side', -Math.PI / 2]];
const shots = [];
for (const [name, a] of angles) {
  await page.evaluate(({ px, pz, a, dist, lookY, camY }) => {
    const dw = window.__dw;
    dw.setPlayer(px, pz, 0);
    const y = dw.state().player.y;
    dw.freeCam([px + Math.sin(a) * dist, y + camY, pz + Math.cos(a) * dist], [px, y + lookY, pz]);
  }, { px, pz, a, dist, lookY, camY });
  await page.waitForTimeout(350);
  shots.push({ name, buf: await page.screenshot() });
}
const html = `<body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(6,350px);gap:3px">${shots.map((s) => `<div style="position:relative"><img style="width:350px;display:block" src="data:image/png;base64,${s.buf.toString('base64')}"><div style="position:absolute;left:6px;top:4px;font:16px sans-serif">${s.name}</div></div>`).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 2118, height: 460 } });
await p2.setContent(html);
await p2.waitForTimeout(200);
await p2.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log('wrote', outPath);
