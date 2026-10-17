// End-to-end playtest (Milestone 2): drives the real game with keyboard +
// mouse input, records a video, and checks movement, collision, camera,
// sitting / lying, and every interaction.
// Usage: node scripts/playtest.mjs <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = process.argv[2] || 'review';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 853 }, recordVideo: { dir: out, size: { width: 1280, height: 853 } } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto(process.env.URL || 'http://localhost:5173/');
await page.waitForFunction(() => window.__dw && window.__dw.ready);
await page.waitForTimeout(1000);

const st = () => page.evaluate(() => window.__dw.state());
const its = () => page.evaluate(() => window.__dw.interactables());
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sleep = (ms) => page.waitForTimeout(ms);

// ---- collision model (same math as the game) ---------------------------------
const colliders = await page.evaluate(() => window.__dw.colliders);
const R = 0.26;
function overlaps(x, z, r = R, tol = 0.005) {
  for (const c of colliders) {
    if (c.type === 'box') {
      const cx = Math.max(c.minX, Math.min(x, c.maxX)), cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      if (Math.hypot(x - cx, z - cz) < r - tol) return true;
    } else if (Math.hypot(x - c.x, z - c.z) < c.r + r - tol) return true;
  }
  return false;
}
const penetrating = (p) => overlaps(p.x, p.z, R, 0.02);

// ---- grid A* pathfinding so routes through the dense room are deterministic --
const G = 0.1, X0 = -4.7, Z0 = -5.0, NX = 95, NZ = 93;
const free = new Uint8Array(NX * NZ);
for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) free[j * NX + i] = overlaps(X0 + i * G, Z0 + j * G, R + 0.06) ? 0 : 1;
const toCell = (x, z) => [Math.round((x - X0) / G), Math.round((z - Z0) / G)];
const cellPos = (i, j) => [X0 + i * G, Z0 + j * G];
function nearestFree(i, j) {
  for (let r = 0; r < 30; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
    const a = i + di, b = j + dj;
    if (a >= 0 && b >= 0 && a < NX && b < NZ && free[b * NX + a]) return [a, b];
  }
  return [i, j];
}
function lineFree(a, b) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05);
  for (let k = 0; k <= n; k++) { const t = k / n; if (overlaps(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, R + 0.04)) return false; }
  return true;
}
function findPath(from, to) {
  const [si, sj] = nearestFree(...toCell(...from)), [ti, tj] = nearestFree(...toCell(...to));
  const N = NX * NZ, gS = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [[0, sj * NX + si]];
  gS[sj * NX + si] = 0;
  const goal = tj * NX + ti;
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, cur] = open.shift();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % NX, cj = (cur / NX) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = ci + di, b = cj + dj;
      if (a < 0 || b < 0 || a >= NX || b >= NZ || !free[b * NX + a]) continue;
      const nb = b * NX + a, g = gS[cur] + Math.hypot(di, dj);
      if (g < gS[nb]) { gS[nb] = g; prev[nb] = cur; open.push([g + Math.hypot(a - ti, b - tj), nb]); }
    }
  }
  if (prev[goal] === -1 && goal !== sj * NX + si) return null;
  const cells = [];
  for (let c = goal; c !== -1; c = prev[c]) cells.unshift(cellPos(c % NX, (c / NX) | 0));
  // string-pull
  const pts = [from];
  let anchor = from;
  for (let k = 1; k < cells.length; k++) if (!lineFree(anchor, cells[k])) { pts.push(cells[k - 1]); anchor = cells[k - 1]; }
  pts.push(to);
  return pts;
}

// ---- input helpers --------------------------------------------------------------
// Pointer lock is unavailable headless, so the game falls back to click-drag look.
async function dragTurn(dYaw, minSteps = 6) {
  const steps = Math.max(minSteps, Math.ceil(Math.abs(dYaw) / 0.06));
  let px = -dYaw / 0.0026;
  while (Math.abs(px) > 0.5) {
    const chunk = Math.max(-1000, Math.min(1000, px));
    await page.evaluate(() => document.exitPointerLock && document.exitPointerLock());
    await sleep(15);
    const x0 = chunk > 0 ? 140 : 1140;
    await page.mouse.move(x0, 430);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(x0 + (chunk * i) / steps, 430); await sleep(16); }
    await page.mouse.up();
    px -= chunk;
  }
}
async function faceToward(x, z) {
  const s = await st();
  await dragTurn(wrap(Math.atan2(-(x - s.player.x), -(z - s.player.z)) - s.cam.yaw), 8);
}
async function walkStraight(x, z, { tol = 0.18, timeout = 6000 } = {}) {
  const t0 = Date.now();
  await faceToward(x, z);
  await page.keyboard.down('KeyW');
  let s, lastSteer = 0;
  while (Date.now() - t0 < timeout) {
    await sleep(50);
    s = await st();
    if (Math.hypot(x - s.player.x, z - s.player.z) < tol) break;
    if (Date.now() - lastSteer > 300) {
      const err = wrap(Math.atan2(-(x - s.player.x), -(z - s.player.z)) - s.cam.yaw);
      if (Math.abs(err) > 0.6) { await page.keyboard.up('KeyW'); await dragTurn(err, 4); await page.keyboard.down('KeyW'); }
      else if (Math.abs(err) > 0.1) await dragTurn(err, 3);
      lastSteer = Date.now();
    }
  }
  await page.keyboard.up('KeyW');
  return st();
}
async function goTo(x, z, opts = {}) {
  let q = await goToOnce(x, z, opts);
  // steering is done with real mouse drags, which can occasionally overshoot;
  // retry once from wherever we ended up
  if (Math.hypot(q.player.x - x, q.player.z - z) > (opts.tol ?? 0.15) + 0.2) q = await goToOnce(x, z, opts);
  return q;
}
async function goToOnce(x, z, opts = {}) {
  const s0 = await st();
  const path = findPath([s0.player.x, s0.player.z], [x, z]);
  if (!path) { console.log('  no path to', x, z); return st(); }
  for (let k = 1; k < path.length; k++) await walkStraight(path[k][0], path[k][1], { tol: k === path.length - 1 ? (opts.tol ?? 0.15) : 0.25, timeout: opts.timeout ?? 6000 });
  await sleep(350);
  return st();
}
async function holdKey(key, ms) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); await sleep(250); return st(); }
async function pressE(wait = 400) { await page.keyboard.press('KeyE'); await sleep(wait); return st(); }
async function waitFor(fn, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const s = await st(); if (fn(s)) return s; await sleep(80); }
  return st();
}
const spot = async (id) => (await its()).find((i) => i.id === id);

// Track every sampled position for penetration checks (only while walking).
const trail = [];
let sampling = true;
const sampler = setInterval(async () => { if (!sampling) return; try { trail.push(await st()); } catch { /* closing */ } }, 100);

// ---- 1. center -> desk, sit, monitors, stand ---------------------------------------
let s = await goTo(-3.25, -1.55);
check('walk center -> desk', Math.hypot(s.player.x + 3.25, s.player.z + 1.55) < 0.35, JSON.stringify(s.player));
check('desk chair prompt is the only prompt shown', s.interact === 'deskchair', `interact=${s.interact}`);
s = await pressE(100);
s = await waitFor((q) => q.occupied && q.occupied.settled);
await sleep(600);
s = await st();
check('sits in desk chair (settled, sit pose, at seat)', s.occupied?.id === 'deskchair' && s.hero.pose === 'sit' && Math.hypot(s.hero.x + 3.25, s.hero.z + 2.2) < 0.05, JSON.stringify(s.hero));
check('monitors wake up when seated', s.monitorsOn === true);
await page.screenshot({ path: `${out}/test_desk_seated.png` });
const cap1 = s.caption;
s = await pressE(500);
check('E while seated cycles monitor text', s.caption && s.caption !== cap1 && s.occupied?.settled, `caption="${s.caption}"`);
await page.screenshot({ path: `${out}/test_desk_monitors.png` });
// movement input while seated must not move the character
const heroBefore = s.hero;
await dragTurn(0.8, 8);
s = await st();
check('camera can rotate while seated, character stays put', Math.abs(s.hero.x - heroBefore.x) < 0.01 && Math.abs(s.hero.z - heroBefore.z) < 0.01);
await holdKey('KeyW', 150);
s = await waitFor((q) => !q.occupied, 5000);
check('movement key stands up to a free floor spot', !s.occupied && !overlaps(s.player.x, s.player.z, R, 0.01) && s.hero.y === 0, JSON.stringify(s.player));
await sleep(1500);
check('monitors sleep after standing', (await st()).monitorsOn === false);

// ---- 2. walk around the desk chair and both dining chairs ------------------------------
const loops = [[-2.4, -1.6], [-2.4, -1.1], [-3.9, -1.1], [-4.1, -1.7]];
for (const [x, z] of loops) await goTo(x, z, { tol: 0.25 });
const diningLoop = [[0.75, 1.5], [0.7, 3.1], [2.5, 3.1], [3.6, 3.1], [3.6, 1.45], [2.5, 1.45]];
for (const [x, z] of diningLoop) s = await goTo(x, z, { tol: 0.25 });
check('walked around desk chair + dining chairs', Math.hypot(s.player.x - 2.5, s.player.z - 1.45) < 0.4, JSON.stringify(s.player));
// push straight into the dining table and the kitchen counter
await faceToward(2.5, 3.0);
s = await holdKey('KeyW', 1200);
check('dining table blocks', s.player.z <= 1.8 - R + 0.02, `z=${s.player.z}`);
await goTo(3.6, -0.3);
await faceToward(5.0, -0.3);
s = await holdKey('KeyW', 1200);
check('kitchen counter blocks', s.player.x <= 4.06 - R + 0.02, `x=${s.player.x}`);

// ---- 3. kitchen: fridge, kettle, dining chair ----------------------------------------------
s = await goTo(3.6, 1.33);
check('fridge prompt', s.interact === 'fridge', `interact=${s.interact}`);
s = await pressE(900);
check('fridge opens with caption', (await spot('fridge')).label === 'Close the fridge' && !!s.caption, `caption="${s.caption}"`);
await page.screenshot({ path: `${out}/test_fridge_open.png` });
s = await pressE(700);
check('fridge closes again', (await spot('fridge')).label === 'Open the fridge');
s = await goTo(3.72, -1.45);
check('kettle prompt', s.interact === 'kettle', `interact=${s.interact}`);
s = await pressE(700);
check('kettle: steam + "Tea’s ready."', s.caption === 'Tea’s ready.', `caption="${s.caption}"`);
await page.screenshot({ path: `${out}/test_kettle.png` });
s = await goTo(3.72, 2.95);
check('dining chair prompt', s.interact === 'chairE', `interact=${s.interact}`);
await pressE(100);
s = await waitFor((q) => q.occupied && q.occupied.settled);
await sleep(500);
s = await st();
check('sits at dining table', s.occupied?.id === 'chairE' && s.hero.pose === 'sit', JSON.stringify(s.hero));
await page.screenshot({ path: `${out}/test_dining_seated.png` });
// camera orbit in the kitchen corner while seated
let dists = [];
let camOk = true;
for (let i = 0; i < 12; i++) {
  await dragTurn(Math.PI / 6, 5);
  const q = await st();
  dists.push(q.cam.dist);
  if (q.cam.x < -4.6 || q.cam.x > 4.6 || q.cam.z > 4.1 || q.cam.z < -4.9 || q.cam.y > 3.5) camOk = false;
}
check('camera 360 orbit in kitchen corner stays in room', camOk && dists.every((d) => d > 0.3), `dists=${dists.map((d) => d.toFixed(2)).join(',')}`);
await page.keyboard.press('Escape');
s = await waitFor((q) => !q.occupied, 5000);
check('Esc stands up from dining chair, free spot', !s.occupied && !overlaps(s.player.x, s.player.z, R, 0.01), JSON.stringify(s.player));

// ---- 4. bed: climb, lie, get up; sofa ----------------------------------------------------------
s = await goTo(0.28, -2.3);
check('bed prompt at ladder', s.interact === 'bed', `interact=${s.interact}`);
await pressE(100);
s = await waitFor((q) => q.occupied && q.occupied.settled, 8000);
await sleep(900);
s = await st();
check('climbs ladder and lies in loft bed', s.hero.pose === 'lie' && s.hero.y > 1.9 && s.caption === 'Just five more minutes…', `${JSON.stringify(s.hero)} caption="${s.caption}"`);
await page.screenshot({ path: `${out}/test_bed.png` });
dists = []; camOk = true;
for (let i = 0; i < 12; i++) {
  await dragTurn(Math.PI / 6, 5);
  const q = await st();
  dists.push(q.cam.dist);
  if (q.cam.y > 3.45 || q.cam.z < -4.95) camOk = false;
}
check('camera 360 orbit near bed stays in room', camOk && dists.every((d) => d > 0.3), `dists=${dists.map((d) => d.toFixed(2)).join(',')}`);
await page.screenshot({ path: `${out}/test_bed_orbit.png` });
await pressE(100);
s = await waitFor((q) => !q.occupied, 8000);
check('E gets out of bed, back on the floor, not clipped', !s.occupied && s.hero.y === 0 && !overlaps(s.player.x, s.player.z, R, 0.01), JSON.stringify(s.player));
s = await goTo(2.12, -2.62);
check('sofa prompt', s.interact === 'sofa', `interact=${s.interact}`);
await pressE(100);
s = await waitFor((q) => q.occupied && q.occupied.settled);
await sleep(400);
s = await st();
check('sits on sofa with caption', s.occupied?.id === 'sofa' && s.caption === 'The afternoon light is nice from here.', `caption="${s.caption}"`);
await page.screenshot({ path: `${out}/test_sofa.png` });
await pressE(100);
s = await waitFor((q) => !q.occupied, 5000);
check('E stands up from sofa, free spot', !s.occupied && !overlaps(s.player.x, s.player.z, R, 0.01), JSON.stringify(s.player));

// ---- 5. small reactions + carried-over interactions ------------------------------------
async function tryAction(id, expectCaption) {
  const sp = await spot(id);
  let q = await goTo(sp.x, sp.z);
  if (q.interact !== id) { q = await goTo(sp.x + (q.player.x - sp.x) * 0.5, sp.z + (q.player.z - sp.z) * 0.5); }
  const had = q.interact;
  q = await pressE(500);
  check(`${id}: prompt + reaction`, had === id && (expectCaption ? (q.caption || '').includes(expectCaption) : !!q.caption), `interact=${had} caption="${q.caption}"`);
  return q;
}
await tryAction('plush', 'Squeak');
await tryAction('lamp', 'Click');
await tryAction('window', 'A quiet afternoon');
await page.screenshot({ path: `${out}/test_window.png` });
await tryAction('guitar', 'G chord');
await tryAction('bookshelf');
await page.screenshot({ path: `${out}/test_book.png` });
{
  const sp = await spot('journal');
  s = await goTo(sp.x, sp.z);
  const had = s.interact;
  s = await pressE(500);
  check('journal opens sketchbook overlay', had === 'journal' && s.journalOpen, `interact=${had}`);
  await page.screenshot({ path: `${out}/test_journal.png` });
  s = await pressE(400);
  check('journal closes', !s.journalOpen);
}

// ---- 6. walls + corners: every corner must be reachable and never stuck -----------------
const corners = [[-4.6, 4.1], [4.6, 4.1], [4.6, -3.9], [-0.1, -2.0], [-4.6, -0.6], [-1.9, -3.2], [0.4, -3.75], [-4.6, 0.6], [1.0, 3.95]];
let stuck = [];
for (const [x, z] of corners) {
  const [fi, fj] = nearestFree(...toCell(x, z));
  const [tx, tz] = cellPos(fi, fj);
  s = await goTo(tx, tz, { tol: 0.2, timeout: 7000 });
  if (Math.hypot(s.player.x - tx, s.player.z - tz) > 0.3) stuck.push([x, z, s.player.x, s.player.z]);
  // then push into the wall/corner for a moment and back out
  await faceToward(x + (x - tx) * 5 + Math.sign(x) * 0.5, z + (z - tz) * 5 + Math.sign(z) * 0.5);
  await holdKey('KeyW', 500);
  const b = await holdKey('KeyS', 450);
  if (Math.hypot(b.player.x - s.player.x, b.player.z - s.player.z) < 0.15) stuck.push(['backout', x, z]);
}
check('every corner reachable, can back out (no stuck spots)', stuck.length === 0, JSON.stringify(stuck));
await page.screenshot({ path: `${out}/test_corner.png` });

// ---- 7. collect every star -------------------------------------------------------------------
const starIts = (await its()).filter((i) => i.id === 'star');
let collected = (await st()).stars;
for (let k = 0; k < starIts.length; k++) {
  const sp = starIts[k];
  s = await goTo(sp.stand[0], sp.stand[1]);
  const had = s.interact;
  if (k === 0) await page.screenshot({ path: `${out}/test_star_prompt.png` });
  await page.keyboard.press('KeyE');
  await sleep(220);
  if (k === 0) await page.screenshot({ path: `${out}/test_star_pickup.png` });
  await sleep(600);
  s = await st();
  check(`star ${k + 1}/${starIts.length}: prompt + pickup + counter`, had === 'star' && s.stars === collected + 1, `interact=${had} stars=${s.stars}`);
  collected = s.stars;
}
check('all stars collected, counter matches', collected === starIts.length && (await page.evaluate(() => document.getElementById('star-count').textContent)) === String(starIts.length));

// ---- 8. idle ----------------------------------------------------------------------------------------
await sleep(800);
s = await st();
check('idle after stopping (no velocity, no walk bob)', s.player.speed < 0.01 && Math.abs(s.bob) < 0.005, `speed=${s.player.speed} bob=${s.bob}`);

const explore = await page.evaluate(() => [...document.querySelectorAll('#objective .obj')].map((e) => e.classList.contains('done')));
check('objectives update (explore, journal, stars)', explore.every(Boolean), JSON.stringify(explore));

sampling = false;
clearInterval(sampler);
await sleep(150);
const walkingSamples = trail.filter((t) => !t.occupied);
const bad = walkingSamples.filter((t) => penetrating(t.player));
check('no sampled walking position inside furniture/walls', bad.length === 0, `${walkingSamples.length} samples, ${bad.length} inside ${JSON.stringify(bad.slice(0, 3).map((t) => t.player))}`);
check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
const fpsVals = trail.map((t) => t.fps).filter((f) => f > 0);
console.log('fps min/avg', Math.min(...fpsVals), Math.round(fpsVals.reduce((a, b) => a + b, 0) / fpsVals.length));

await page.screenshot({ path: `${out}/test_end.png` });
await ctx.close();
await browser.close();
fs.writeFileSync(`${out}/playtest.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
