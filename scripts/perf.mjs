// Usage: [SCENE=shanghai|taiwan|bayarea] node scripts/perf.mjs — frame time and renderer load
// from a few gameplay views (headless numbers: compare runs, not absolute fps).
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto((process.env.URL || 'http://localhost:5173/') + '?scene=' + (process.env.SCENE || 'shanghai'));
await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 90000 });
console.log('load', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await page.waitForTimeout(1500);
// player x, z, facing, view yaw, pitch
const VIEWS = {
  shanghai: { river: [0, 3.4, Math.PI, 0, 0.05], land: [0, 5.6, 0, Math.PI, 0.18], along: [-9.5, 1.2, Math.PI / 2, -Math.PI / 2 + 0.45, 0.22] },
  taiwan: { start: [0, 1.4, Math.PI, 0, 0.36], plaza: [1.4, -14.6, Math.PI * 0.75, -0.8, 0.35], lookout: [4.5, -28.2, Math.PI, 0.12, 0.08] },
  bayarea: { start: [-4.6, 6.5, Math.PI, -0.04, 0.1], rail: [6.2, -12, Math.PI / 2, -0.75, 0.08], pier: [31, -29, Math.PI / 2, -1.0, 0.06] },
};
for (const [name, v] of Object.entries(VIEWS[process.env.SCENE || 'shanghai'])) {
  await page.evaluate((v) => { window.__dw.freeCam(null); window.__dw.setPlayer(v[0], v[1], v[2]); window.__dw.setView(v[3], v[4], 3.0); }, v);
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => new Promise((res) => {
    const ts = [];
    const tick = (t) => { ts.push(t); if (ts.length < 121) requestAnimationFrame(tick); else res(ts); };
    requestAnimationFrame(tick);
  }));
  const dts = r.slice(1).map((t, i) => t - r[i]).sort((a, b) => a - b);
  const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
  const info = await page.evaluate(() => window.__dw.renderInfo?.());
  console.log(name, 'avg', avg.toFixed(1) + 'ms', 'p95', dts[Math.floor(dts.length * 0.95)].toFixed(1) + 'ms', info ? JSON.stringify(info) : '');
}
await browser.close();
