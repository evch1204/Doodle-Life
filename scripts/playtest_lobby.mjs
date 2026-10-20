// Usage: node scripts/playtest_lobby.mjs <outDir> — the airport lobby (destination picker):
// the room's door -> the lobby; every gate (prompt, hover, check-in walk, push, jetway, landing),
// skipping the jetway, "coming soon" gates, the info desk card, the signposts back to the airport
// (start at the gate you came from), the remembered gate, deep links, reduced motion.
// Positions are set through the test hooks; the sequences themselves run in real time.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = process.argv[2] || 'review/lobby';
fs.mkdirSync(out, { recursive: true });
const URL = process.env.URL || 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${info}`); };

async function open(scene, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  if (opts.storage) await page.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, opts.storage);
  await page.goto(URL + (scene ? `?scene=${scene}` : ''));
  await page.waitForFunction(() => window.__dw && window.__dw.ready, null, { timeout: 120000 });
  await page.waitForTimeout(800);
  return page;
}
const st = (page) => page.evaluate(() => window.__dw.state());
const dbg = (page) => page.evaluate(() => window.__dw.sceneDebug());
const until = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const arrived = (page, id) => until(page, (id) => { const s = window.__dw.state(); return s.scene === id && !s.traveling; }, id, 60000);
// stand at a gate's check-in spot (az from -z, + to the right; R - 1.7 from the centre)
const gateSpot = async (page, id) => page.evaluate((id) => { const it = window.__dw.interactables().find((i) => i.id === `gate-${id}`); window.__dw.setPlayer(it.x, it.z, Math.atan2(-it.x, -it.z)); window.__dw.setView(Math.atan2(it.x, it.z), 0.2); return it; }, id);

// ---- 1. the room's door goes to the airport; the postcard is gone ---------------------------
{
  const page = await open('');
  const ints = await page.evaluate(() => window.__dw.interactables().map((i) => [i.id, i.label]));
  check('room door now reads "Go to the airport"', ints.some(([id, l]) => id === 'door' && l === 'Go to the airport'), JSON.stringify(ints.filter(([id]) => id === 'door')));
  check('the old postcard path is removed', !ints.some(([id]) => id === 'postcard'));
  await page.evaluate(() => window.__dw.setPlayer(-2.4, 3.3, 0));
  await page.waitForTimeout(400);
  check('door prompt', (await st(page)).interact === 'door', (await st(page)).interact);
  await page.keyboard.press('KeyE');
  check('door travels to the lobby', await arrived(page, 'lobby'));
  const s = await st(page);
  check('arrives at the entrance facing the gates', Math.abs(s.player.z - 4.6) < 0.05 && Math.abs(s.player.x) < 0.05, JSON.stringify(s.player));
  await page.screenshot({ path: `${out}/01_arrival.png` });
  const d = await dbg(page);
  check('gates come from the config, in order', JSON.stringify(d.gates) === JSON.stringify(['shanghai', 'taipei', 'santaclara', 'next']), JSON.stringify(d.gates));
  await page.context().close();
}

// ---- 2. each enabled gate: prompt, hover, walk, push, jetway, landing; back to its gate ------
for (const [gate, route, label] of [['shanghai', 'shanghai', 'Check in to Shanghai'], ['taipei', 'taiwan', 'Check in to Taipei']]) {
  const page = await open('lobby');
  await gateSpot(page, gate);
  await page.waitForTimeout(900);
  let s = await st(page);
  check(`${gate}: prompt "${label}"`, s.interact === `gate-${gate}` && (await page.textContent('#prompt-text')) === label, `${s.interact} / ${await page.textContent('#prompt-text')}`);
  const hov = (await dbg(page)).hover;
  const gi = (await dbg(page)).gates.indexOf(gate);
  check(`${gate}: standing at the gate brightens it (only it)`, hov[gi] > 0.8 && hov.every((h, i) => i === gi || h < 0.05), JSON.stringify(hov));
  await page.screenshot({ path: `${out}/02_${gate}_hover.png` });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(150);
  check(`${gate}: E starts the walk to the arch`, (await dbg(page)).seq?.phase === 'walk', JSON.stringify((await dbg(page)).seq));
  const p0 = (await st(page)).player;
  await page.waitForTimeout(500);
  const p1 = (await st(page)).player;
  check(`${gate}: the traveler walks toward the arch (no input)`, Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.12, `${JSON.stringify(p0)} -> ${JSON.stringify(p1)}`);
  check(`${gate}: no prompts during the sequence`, (await st(page)).interact === null);
  const sawPush = await until(page, () => window.__dw.sceneDebug()?.seq?.phase === 'push', null, 8000);
  check(`${gate}: the camera pushes into the arch`, sawPush);
  await page.screenshot({ path: `${out}/03_${gate}_push.png` });
  const sawTunnel = await until(page, () => window.__dw.sceneDebug()?.seq?.phase === 'tunnel', null, 4000);
  check(`${gate}: then the jetway`, sawTunnel);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/04_${gate}_jetway.png` });
  const t0 = Date.now();
  check(`${gate}: lands in ${route}`, await arrived(page, route), `${((Date.now() - t0) / 1000).toFixed(1)}s after the jetway frame`);
  const ann = await page.textContent('#announce');
  check(`${gate}: arrival announced for screen readers`, /Arriving in/.test(ann ?? ''), ann);
  check(`${gate}: last gate remembered`, (await page.evaluate(() => localStorage.getItem('doodleworld.lastGate'))) === gate);
  await page.screenshot({ path: `${out}/05_${gate}_landed.png` });
  // the signpost goes back to the airport, in front of this gate
  const home = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'home'));
  check(`${route}: the signpost reads "Back to the airport"`, home?.label === 'Back to the airport', home?.label);
  await page.evaluate((h) => window.__dw.setPlayer(h.x, h.z, Math.PI), home);
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyE');
  check(`${route}: signpost travels to the lobby`, await arrived(page, 'lobby'));
  s = await st(page);
  const it = await page.evaluate((g) => window.__dw.interactables().find((i) => i.id === `gate-${g}`), gate);
  const dGate = Math.hypot(s.player.x - it.x, s.player.z - it.z);
  check(`${route}: back in the lobby in front of the ${gate} gate`, dGate < 1.2, `${dGate.toFixed(2)} m from its check-in spot`);
  await page.screenshot({ path: `${out}/06_${gate}_back.png` });
  await page.context().close();
}

// ---- 3. skipping the jetway (E / Esc) -------------------------------------------------------
for (const key of ['KeyE', 'Escape']) {
  const page = await open('lobby');
  await gateSpot(page, 'taipei');
  await page.waitForTimeout(700);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  const t0 = Date.now();
  await page.keyboard.press(key);
  await page.waitForTimeout(100);
  check(`skip with ${key}: lands at once`, (await dbg(page)).seq?.phase === 'done' || (await st(page)).traveling, JSON.stringify(await dbg(page)));
  check(`skip with ${key}: arrives in Taiwan`, await arrived(page, 'taiwan'), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  check(`skip with ${key}: no settings menu opened`, await page.evaluate(() => document.getElementById('settings').classList.contains('hidden')));
  await page.context().close();
}

// ---- 4. coming soon: Santa Clara, Next Stop; the info desk ---------------------------------
{
  const page = await open('lobby');
  for (const [gate, re] of [['santaclara', /Santa Clara/], ['next', /More gates/]]) {
    await gateSpot(page, gate);
    await page.waitForTimeout(700);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    const d = await dbg(page);
    const txt = await page.textContent('#lb-card');
    check(`${gate}: shows the coming-soon card, no jetway`, d.card === 'soon' && !d.seq && re.test(txt) && /Coming soon/.test(txt), txt);
    await page.screenshot({ path: `${out}/07_${gate}_soon.png` });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
    check(`${gate}: E closes the card`, (await dbg(page)).card === null);
    check(`${gate}: still in the lobby`, (await st(page)).scene === 'lobby');
  }
  await page.evaluate(() => { const it = window.__dw.interactables().find((i) => i.id === 'desk'); window.__dw.setPlayer(it.x, it.z, Math.PI); window.__dw.setView(0, 0.2); });
  await page.waitForTimeout(600);
  check('info desk prompt', (await st(page)).interact === 'desk');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  const txt = await page.textContent('#lb-card');
  check('info desk: "How this works" card', /How this works/.test(txt) && (await dbg(page)).card === 'help', txt);
  check('info desk: objective ticked', (await st(page)).done.includes('desk'), JSON.stringify((await st(page)).done));
  await page.screenshot({ path: `${out}/08_desk_help.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Esc closes the help card (not the settings)', (await dbg(page)).card === null && await page.evaluate(() => document.getElementById('settings').classList.contains('hidden')));
  // walking away closes it too
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__dw.setPlayer(0, 4.6, Math.PI));
  await page.waitForTimeout(500);
  check('walking away closes the card', (await dbg(page)).card === null);
  // the doors home
  await page.evaluate(() => { const it = window.__dw.interactables().find((i) => i.id === 'home'); window.__dw.setPlayer(it.x, it.z, 0); });
  await page.waitForTimeout(500);
  check('doors home prompt', (await st(page)).interact === 'home');
  await page.keyboard.press('KeyE');
  check('doors home go to the room', await arrived(page, 'room'));
  await page.context().close();
}

// ---- 4b. keyboard only: Tab to the gate list, Enter checks in from anywhere -------------------
{
  const page = await open('lobby');
  const btns = await page.evaluate(() => [...document.querySelectorAll('#lb-gates button')].map((b) => b.getAttribute('aria-label')));
  check('gate buttons, left to right, labelled "Check in to ..."', JSON.stringify(btns) === JSON.stringify(['Check in to Shanghai', 'Check in to Taipei', 'Check in to Santa Clara', 'See the next stop']), JSON.stringify(btns));
  check('the gate list is out of sight until focused', await page.evaluate(() => getComputedStyle(document.getElementById('lb-gates')).opacity === '0'));
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  check('Tab reaches the gates in order', focused === 'Check in to Taipei', focused);
  check('the list shows while focused', await page.evaluate(() => getComputedStyle(document.getElementById('lb-gates')).opacity === '1'));
  await page.screenshot({ path: `${out}/09_gate_list.png` });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  check('Enter on a gate starts the check-in from the entrance', (await dbg(page)).seq?.gate === 'taipei', JSON.stringify((await dbg(page)).seq));
  let minDesk = 99;
  for (let k = 0; k < 40 && (await dbg(page))?.seq?.phase === 'walk'; k++) {
    const p = (await st(page)).player;
    minDesk = Math.min(minDesk, Math.hypot(p.x, p.z + 2.0));
    await page.waitForTimeout(150);
  }
  check('the walk goes round the info desk', minDesk > 2.05 + 0.2, `closest ${minDesk.toFixed(2)} m from the desk centre`);
  check('...and lands in Taiwan', await arrived(page, 'taiwan'));
  await page.context().close();
}

// ---- 5. the remembered gate; deep links; reduced motion; boundary ---------------------------
{
  const page = await open('lobby', { storage: { 'doodleworld.lastGate': 'taipei' } });
  const s = await st(page);
  const it = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'gate-taipei'));
  check('a stored last gate: start in front of it', Math.hypot(s.player.x - it.x, s.player.z - it.z) < 1.2, JSON.stringify(s.player));
  // walls hold: push into every gate and the wall for a while
  let worst = 0;
  for (const az of [-1.2, -0.4, 0.4, 1.2, 2.2, -2.6, Math.PI]) {
    await page.evaluate((az) => { window.__dw.setPlayer(Math.sin(az) * 6.2, -Math.cos(az) * 6.2, 0); window.__dw.setView(Math.atan2(Math.sin(az), -Math.cos(az)) + Math.PI, 0.2); }, az);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW');
    const p = (await st(page)).player;
    worst = Math.max(worst, Math.hypot(p.x, p.z));
  }
  check('the hall wall and the gates hold (walk in only by checking in)', worst < 8.5 - 0.26 + 0.02, `farthest ${worst.toFixed(2)} m from the centre`);
  await page.context().close();
}
for (const [scene, title] of [['shanghai', null], ['taiwan', null]]) {
  const page = await open(scene);
  check(`deep link ?scene=${scene} still works`, (await st(page)).scene === scene);
  void title;
  await page.context().close();
}
{
  const page = await open('lobby', { reduced: true });
  await gateSpot(page, 'shanghai');
  await page.waitForTimeout(700);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  check('reduced motion: no walk / jetway, a quick fade', (await dbg(page)).seq === null && (await st(page)).traveling);
  check('reduced motion: lands in Shanghai', await arrived(page, 'shanghai'));
  await page.context().close();
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
await browser.close();
