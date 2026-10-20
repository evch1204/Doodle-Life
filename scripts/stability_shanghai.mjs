// Outline stability on the Bund: the same screen crops over consecutive small
// camera turns (and small steps), stacked side by side, so shimmer on the
// distant skyline, the railing and the ripple strokes is easy to spot.
// Usage: node scripts/stability_shanghai.mjs <out.png>
import { chromium } from 'playwright-core';
const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
await page.goto((process.env.URL || 'http://localhost:5173/') + '?scene=shanghai');
await page.waitForFunction(() => window.__dw && window.__dw.ready);
await page.waitForTimeout(1200);
const rows = [];
for (const [px, pz, yaw, pitch, crops] of [
  // spawn: the Pearl + Lujiazui, and the railing / water band
  [0, 3.4, 0, 0.05, [[500, 120, 420, 300], [800, 100, 420, 300], [400, 430, 420, 200]]],
  // at the railing: the skyline over the water
  [0.3, -2.25, 0.05, 0.08, [[560, 220, 420, 300]]],
  // along the promenade toward the café
  [-9.5, 1.2, -Math.PI / 2 + 0.45, 0.22, [[700, 200, 420, 300]]],
]) {
  const strip = await page.evaluate(async ({ px, pz, yaw, pitch, crops }) => {
    window.__dw.hud(false);
    const c = document.querySelector('#app canvas');
    const N = 5, W = 420;
    const o = document.createElement('canvas'); o.width = W * N; o.height = crops.reduce((a, cr) => a + cr[3], 0);
    const g = o.getContext('2d');
    for (let i = 0; i < N; i++) {
      window.__dw.setPlayer(px, pz - i * 0.01, Math.PI);
      window.__dw.setView(yaw + i * 0.004, pitch);
      await new Promise((r) => setTimeout(r, 120));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      let y = 0;
      for (const [sx, sy, w, h] of crops) { g.drawImage(c, sx, sy, w, h, i * W, y, W, h); y += h; }
    }
    return o.toDataURL('image/png');
  }, { px, pz, yaw, pitch, crops });
  rows.push(strip);
}
const html = `<body style="margin:0;background:#fff">${rows.map((r) => `<img style="display:block" src="${r}">`).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 2100, height: 900 } });
await p2.setContent(html);
await p2.waitForTimeout(300);
await p2.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
