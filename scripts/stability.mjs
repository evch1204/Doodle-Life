// Outline stability check: captures the same screen crops over consecutive
// small camera turns and stacks them side by side, so shimmer / flicker on
// small objects is easy to spot. Usage: node scripts/stability.mjs <out.png>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
await page.goto(process.env.URL || 'http://localhost:5173/');
await page.waitForFunction(() => window.__dw && window.__dw.ready);
await page.evaluate(() => { window.__dw.hud(false); window.__dw.setPlayer(-0.3, 1.4, Math.PI); window.__dw.setView(0.0, 0.4, 2.6); });
await page.waitForTimeout(600);
const strip = await page.evaluate(async () => {
  const c = document.querySelector('#app canvas');
  // three crops: desk + bookshelf, loft + string lights, kitchen shelves
  const crops = [[150, 280, 420, 300], [560, 120, 420, 300], [1120, 300, 416, 300]];
  const N = 5, W = 420, H = 300;
  const o = document.createElement('canvas'); o.width = W * N; o.height = H * crops.length;
  const g = o.getContext('2d');
  for (let i = 0; i < N; i++) {
    window.__dw.setView(i * 0.004, 0.4, 2.6);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    crops.forEach(([sx, sy, w, h], k) => g.drawImage(c, sx, sy, w, h, i * W, k * H, W, H));
  }
  return o.toDataURL('image/png');
});
fs.writeFileSync(out, Buffer.from(strip.split(',')[1], 'base64'));
await browser.close();
