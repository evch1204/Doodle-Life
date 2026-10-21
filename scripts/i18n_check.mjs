// Language check: every player-facing string reachable in each scene has a
// Chinese entry, switching language updates the visible HUD instantly, the
// choice persists across a reload, and no string overflows its card, prompt,
// caption or menu (in English and in Chinese).
// Usage: node scripts/i18n_check.mjs [outDir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = process.argv[2];
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };
const base = process.env.URL || 'http://localhost:5173/';
const ready = () => page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 60000 });

await page.goto(base);
await ready();
await page.evaluate(() => localStorage.removeItem('doodleworld.lang'));
await page.reload();
await ready();
await page.waitForTimeout(600);
check('language defaults to English', await page.evaluate(() => window.__dw.getLang() === 'en' && document.querySelector('#controls [data-i18n="Move"]').textContent === 'Move'));

// ---- Esc opens / closes settings; Resume closes ----------------------------------
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc opens settings', await page.evaluate(() => window.__dw.settingsOpen()));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc again closes settings', !(await page.evaluate(() => window.__dw.settingsOpen())));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('#resume');
await page.waitForTimeout(300);
check('Resume closes settings', !(await page.evaluate(() => window.__dw.settingsOpen())));
// movement is frozen while the menu is open
await page.keyboard.press('Escape');
const p0 = await page.evaluate(() => window.__dw.state().player);
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
const p1 = await page.evaluate(() => window.__dw.state().player);
check('game is paused while settings are open', Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.01);

// ---- switch to 中文 from the menu: everything visible updates at once -------------
await page.click('#settings .choice[data-lang="zh"]');
await page.waitForTimeout(200);
const zhNow = await page.evaluate(() => ({
  move: document.querySelector('#controls [data-i18n="Move"]').textContent,
  title: document.getElementById('obj-title').textContent,
  first: document.querySelector('#obj-list .obj').textContent,
  menu: document.getElementById('settings-title').textContent,
  resume: document.getElementById('resume').textContent,
  lang: document.documentElement.lang,
}));
check('switching to 中文 updates the HUD and menu instantly', zhNow.move === '移動' && zhNow.title === '目標：' && zhNow.first === '探索房間' && zhNow.menu === '設定' && zhNow.resume === '繼續', JSON.stringify(zhNow));
if (out) await page.screenshot({ path: `${out}/settings_zh.png` });
await page.reload();
await ready();
await page.waitForTimeout(500);
check('language choice persists across reload', await page.evaluate(() => window.__dw.getLang() === 'zh' && document.querySelector('#controls [data-i18n="Move"]').textContent === '移動'));

// ---- every reachable string has a translation ---------------------------------------
const STR = {};
for (const scene of ['room', 'lobby', 'taiwan', 'shanghai', 'bayarea']) {
  await page.evaluate((s) => window.__dw.loadScene(s), scene);
  await page.waitForTimeout(300);
  STR[scene] = await page.evaluate(() => window.__dw.collectStrings());
  await page.evaluate((s) => window.__dw.loadScene(s), scene); // reset state the probing changed
}
const all = [...new Set(Object.values(STR).flat())];
const table = await page.evaluate(async () => (await import('/src/i18n.js')).STRINGS);
const missing = all.filter((s) => !table.includes(s));
check(`every reachable string has a Chinese entry (${all.length} strings)`, missing.length === 0, missing.join(' | '));

// ---- travel card text in Chinese -------------------------------------------------------
await page.evaluate(() => window.__dw.loadScene('room'));
await page.evaluate(() => window.__dw.travel('taiwan'));
await page.waitForTimeout(900);
const card = await page.evaluate(() => document.getElementById('travel-text').textContent);
check('travel card in Chinese', card === '前往台灣中……', card);
await page.waitForFunction(() => !window.__dw.state().traveling, null, { timeout: 15000 });
const head = await page.evaluate(() => [document.getElementById('obj-title').textContent, document.getElementById('obj-sub').textContent]);
check('objective card says 台灣 / 九份老街', head[0] === '台灣' && head[1] === '九份老街', head.join(' / '));
await page.evaluate(() => window.__dw.travel('shanghai'));
await page.waitForTimeout(900);
const card2 = await page.evaluate(() => document.getElementById('travel-text').textContent);
check('travel card in Chinese (Shanghai)', card2 === '前往上海中……', card2);
await page.waitForFunction(() => !window.__dw.state().traveling, null, { timeout: 15000 });
const objs = await page.evaluate(() => [...document.querySelectorAll('#obj-list .obj')].map((e) => e.textContent));
check('Shanghai objectives in Chinese', objs.length === 3 && objs[0].startsWith('探索江邊步道') && objs[1] === '找到咖啡館' && objs[2] === '拍一張照片', objs.join(' / '));
await page.evaluate(() => window.__dw.loadScene('room'));

// ---- overflow: render every string in every slot, both languages -------------------------
const longest = (arr) => [...arr].sort((a, b) => b.length - a.length)[0];
for (const lang of ['en', 'zh']) {
  await page.evaluate((l) => window.__dw.setLang(l), lang);
  const bad = await page.evaluate(async (strings) => {
    const { t } = await import('/src/i18n.js');
    const problems = [];
    const fits = (el, label) => {
      const r = el.getBoundingClientRect();
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) problems.push(`${label}: content overflows`);
      if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) problems.push(`${label}: off screen`);
      for (const c of el.querySelectorAll('*')) {
        const cr = c.getBoundingClientRect();
        if (cr.width && (cr.right > r.right + 1 || cr.left < r.left - 1)) { problems.push(`${label}: child spills out`); break; }
      }
    };
    const cap = document.getElementById('caption');
    const pr = document.getElementById('prompt');
    const prText = document.getElementById('prompt-text');
    for (const s of strings) {
      const txt = t(s);
      cap.textContent = txt; cap.classList.remove('hidden');
      fits(cap, `caption "${txt}"`);
      prText.textContent = txt; pr.classList.remove('hidden');
      pr.style.left = `${innerWidth / 2}px`; pr.style.top = '300px';
      fits(pr, `prompt "${txt}"`);
    }
    cap.classList.add('hidden'); pr.classList.add('hidden');
    // the objective card, the controls panel and the settings menu as they are
    for (const id of ['objective', 'controls']) fits(document.getElementById(id), id);
    for (const el of document.querySelectorAll('#objective .panel, #objective .obj')) fits(el, `objective part "${el.textContent}"`);
    return problems;
  }, all);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const menuBad = await page.evaluate(() => {
    const sheet = document.querySelector('#settings .sheet');
    const r = sheet.getBoundingClientRect();
    const p = [];
    for (const c of sheet.querySelectorAll('*')) { const cr = c.getBoundingClientRect(); if (cr.width && (cr.right > r.right + 1 || cr.left < r.left - 1 || cr.bottom > r.bottom + 1)) p.push(`menu child "${c.textContent.slice(0, 20)}" spills out`); }
    return p;
  });
  if (out) await page.screenshot({ path: `${out}/menu_${lang}.png` });
  await page.keyboard.press('Escape');
  check(`no overflow in ${lang} (captions, prompts, objective card, controls, menu)`, bad.length + menuBad.length === 0, [...bad, ...menuBad].slice(0, 6).join(' | '));
  // show the longest caption + the objective card for a visual check
  if (out) {
    await page.evaluate(async (s) => { const { t } = await import('/src/i18n.js'); const c = document.getElementById('caption'); c.textContent = t(s); c.classList.remove('hidden'); }, longest(all));
    await page.screenshot({ path: `${out}/hud_${lang}.png` });
  }
}
await page.evaluate(() => window.__dw.setLang('en'));
check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
await browser.close();
