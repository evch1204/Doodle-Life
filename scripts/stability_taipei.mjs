// Outline stability in Taipei: the same screen crops over consecutive small
// camera turns (and small steps forward), stacked side by side, so shimmer on
// the skyline, the lantern strings and the signs is easy to spot.
// Usage: node scripts/stability_taipei.mjs <out.png>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
await page.goto('http://localhost:5173/?scene=taipei');
await page.waitForFunction(() => window.__dw && window.__dw.ready);
await page.waitForTimeout(1200);
const rows = [];
for (const [px, pz, yaw, pitch, crops] of [
  // mid-street: lantern strings + signs, and Taipei 101 down the street
  [0.2, -5.6, 0.1, 0.34, [[560, 0, 420, 300], [300, 60, 420, 300]]],
  // lookout: skyline + railing
  [4.5, -27.4, 0.12, 0.08, [[560, 160, 420, 300]]],
]) {
  const strip = await page.evaluate(async ({ px, pz, yaw, pitch, crops }) => {
    window.__dw.hud(false);
    const c = document.querySelector('#app canvas');
    const N = 5, W = 420, H = 300;
    const o = document.createElement('canvas'); o.width = W * N; o.height = H * crops.length;
    const g = o.getContext('2d');
    for (let i = 0; i < N; i++) {
      window.__dw.setPlayer(px, pz - i * 0.01, Math.PI);
      window.__dw.setView(yaw + i * 0.004, pitch);
      await new Promise((r) => setTimeout(r, 120));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      crops.forEach(([sx, sy, w, h], k) => g.drawImage(c, sx, sy, w, h, i * W, k * H, W, H));
    }
    return o.toDataURL('image/png');
  }, { px, pz, yaw, pitch, crops });
  rows.push(strip);
}
// stack the rows into one image
const html = `<body style="margin:0;background:#fff">${rows.map((r) => `<img style="display:block" src="${r}">`).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 2100, height: 900 } });
await p2.setContent(html);
await p2.waitForTimeout(300);
await p2.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
