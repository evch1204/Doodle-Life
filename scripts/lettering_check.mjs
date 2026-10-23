// Lettering check: every texture with writing on it (signs, menus, posters,
// screens) follows the language setting. For each scene it switches to English,
// then 中文, and saves a contact sheet of every lettered texture, so the wording
// and fit can be looked over side by side; it fails if a texture does not change
// with the language or the page throws.
// Usage: node scripts/lettering_check.mjs <outDir>   (SCENES=taiwan,lobby to pick)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = process.argv[2] || 'review/lettering';
fs.mkdirSync(out, { recursive: true });
const scenes = (process.env.SCENES || 'room,lobby,taiwan,shanghai,bayarea').split(',');
const angle = process.platform === 'darwin' ? 'metal' : 'd3d11';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${angle}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = process.env.URL || 'http://localhost:5173/';
let failed = 0;

// one sheet: each texture fitted into a cell, in a grid
const sheet = () => page.evaluate(async () => {
  const { letteredTextures } = await import('/src/sketch.js');
  const texs = letteredTextures();
  const C = 320, cols = 5, rows = Math.ceil(texs.length / cols);
  const c = document.createElement('canvas'); c.width = C * cols; c.height = C * rows;
  const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, c.width, c.height);
  const sums = texs.map((t, i) => {
    const img = t.image, k = Math.min((C - 12) / img.width, (C - 12) / img.height);
    const w = img.width * k, h = img.height * k, x = (i % cols) * C + (C - w) / 2, y = Math.floor(i / cols) * C + (C - h) / 2;
    g.drawImage(img, x, y, w, h);
    return img.toDataURL().length + ':' + img.toDataURL().slice(-64);
  });
  return { url: c.toDataURL('image/png'), sums, n: texs.length };
});

for (const id of scenes) {
  await page.goto(`${base}?scene=${id}`);
  await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 60000 });
  const shots = {};
  for (const lang of ['en', 'zh']) {
    await page.evaluate((l) => window.__dw.setLang(l), lang);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    shots[lang] = await sheet();
    fs.writeFileSync(`${out}/${id}_${lang}.png`, Buffer.from(shots[lang].url.split(',')[1], 'base64'));
  }
  const same = shots.en.sums.filter((s, i) => s === shots.zh.sums[i]).length;
  const ok = shots.en.n > 0 && same === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}: ${shots.en.n} lettered textures, ${same} unchanged by the language`);
}
await page.evaluate(() => window.__dw.setLang('en'));
if (errors.length) { failed++; console.log('FAIL  page errors:', errors.join(' | ')); }
await browser.close();
process.exit(failed ? 1 : 0);
