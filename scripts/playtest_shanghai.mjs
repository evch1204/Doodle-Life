// End-to-end playtest (Milestone 4, Shanghai / the Bund): starts in the room,
// travels to Shanghai through the postcard by the door, then drives the real
// game with keyboard + click-drag mouse input (never pointer lock): spawn ->
// railing, the river boundary along the whole railing, props and the café,
// camera orbits, every interaction / objective, the boats and the river
// animating, fps, and the trip home (plus a Taiwan round trip).
// Usage: URL=http://localhost:5174/ node scripts/playtest_shanghai.mjs <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createHarness } from './harness.mjs';

const out = process.argv[2] || 'review/m4/playtest';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 853 }, recordVideo: process.env.NOVIDEO ? undefined : { dir: out, size: { width: 1280, height: 853 } } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto(process.env.URL || 'http://localhost:5173/');
await page.waitForFunction(() => window.__dw && window.__dw.ready);
await page.waitForTimeout(1000);

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const H = createHarness(page);
const { sleep, st, wrap, dragTurn, press, loadModel, penetrating, sample, goTo, interactAt, mon } = H;
const dbg = () => page.evaluate(() => window.__dw.sceneDebug());
const RAIL_STOP = -2.64; // the player's center can never get closer to the river than this

// =====================================================================================
// 1. Room -> the airport through the front door -> the Shanghai gate -> the Bund
// =====================================================================================
await loadModel();
check('starts in the room', (await st()).scene === 'room');
let s = await goTo(-2.4, 3.45);
check('door prompt in the room (to the airport)', s.interact === 'door', `interact=${s.interact}`);
check('the postcard is gone', await page.evaluate(() => !window.__dw.interactables().some((i) => i.id === 'postcard')));
await press('KeyE');
await sleep(900);
const card = await page.evaluate(() => ({ on: !document.getElementById('travel').classList.contains('off'), text: document.getElementById('travel-text').textContent }));
check('travel card shows', card.on && card.text.includes('airport'), JSON.stringify(card));
await shot('01_travel_card');
await H.checkInAt('shanghai', 'shanghai');
await sleep(400);
s = await st();
check('arrives on the Bund at the start point, facing the skyline', s.scene === 'shanghai' && Math.hypot(s.player.x, s.player.z - 3.4) < 0.05 && Math.abs(wrap(s.player.facing - Math.PI)) < 0.01 && Math.abs(s.cam.yaw) < 0.01, `scene=${s.scene} at ${s.player.x},${s.player.z} facing ${s.player.facing} yaw ${s.cam.yaw}`);
const hud = await page.evaluate(() => [...document.querySelectorAll('#obj-list .obj')].map((e) => e.textContent));
check('HUD objectives: explore / café / photo', hud.length === 3 && /waterfront/.test(hud[0]) && /café/.test(hud[1]) && /photo/.test(hud[2]), hud.join(' | '));
await loadModel();
await shot('02_arrival');

// =====================================================================================
// 2. Spawn -> railing, the viewpoint (interaction A)
// =====================================================================================
await page.evaluate(() => window.__dw.resetMaxDy());
s = await goTo(0.0, -2.1);
check('walk from the spawn to the railing', Math.hypot(s.player.x, s.player.z + 2.1) < 0.35, `${s.player.x},${s.player.z}`);
check('viewpoint prompt at the railing', s.interact === 'viewpoint', s.interact);
await press('KeyE');
await sleep(500);
const yawA = (await st()).cam.yaw;
s = await st();
check('viewpoint caption', /familiar skyline/.test(s.caption ?? ''), s.caption);
await sleep(2600);
s = await st();
check('viewpoint frames the skyline (slow pan)', Math.abs(wrap(s.cam.yaw - (-2 * Math.PI / 180))) < 0.12, `yaw ${yawA} -> ${s.cam.yaw}`);
await shot('03_viewpoint');
// the player keeps control afterwards
const p0 = (await st()).player;
await press('KeyD', 500);
await sleep(300);
const p1 = (await st()).player;
check('player keeps control after the viewpoint', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.3, `${p0.x},${p0.z} -> ${p1.x},${p1.z}`);

// =====================================================================================
// 3. The river boundary: push into the railing every 1.5 m along its whole length
// =====================================================================================
async function pushToward(yaw, ms = 800) {
  const s0 = await st();
  await dragTurn(wrap(yaw - s0.cam.yaw), 4);
  await page.keyboard.down('KeyW');
  let minZ = 99, off = 0, pen = 0;
  for (let i = 0; i < ms / 50; i++) {
    await sleep(50);
    const q = await sample();
    minZ = Math.min(minZ, q.player.z);
    if (q.ground < -50) off++;
    if (penetrating(q.player)) pen++;
  }
  await page.keyboard.up('KeyW');
  return { minZ, off, pen };
}
let worstZ = 99, offs = 0, pens = 0, reached = 0, tried = 0;
for (let x = -17.2; x <= 15.6; x += 1.5) {
  tried++;
  const q = await goTo(x, -2.3, { tol: 0.3, timeout: 6000 });
  if (Math.abs(q.player.x - x) > 0.8 || q.player.z > -1.6) { console.log(`  rail x=${x.toFixed(1)}: could not get close (${q.player.x},${q.player.z}) - prop in the way`); continue; }
  reached++;
  for (const dy of [0, 0.7, -0.7]) {
    const r = await pushToward(dy, 700);
    worstZ = Math.min(worstZ, r.minZ); offs += r.off; pens += r.pen;
  }
}
check('railing reached along its whole length', reached >= tried - 6, `${reached}/${tried} spots (the rest are lamps / bin / binoculars in front of it)`);
check('river boundary holds at every push (never past the railing)', worstZ >= RAIL_STOP, `closest z ${worstZ.toFixed(3)} (limit ${RAIL_STOP})`);
check('never off the promenade, never inside the railing', offs === 0 && pens === 0, `off=${offs} pen=${pens}`);
// a run hugging the railing in a clear stretch, pressing into it at an angle
await goTo(-8.6, -2.5);
{
  const s0 = await st();
  await dragTurn(wrap(-Math.PI / 2 + 0.35 - s0.cam.yaw), 4);
  await page.keyboard.down('KeyW');
  let minZ = 99;
  for (let i = 0; i < 30; i++) { await sleep(50); const q = await sample(); minZ = Math.min(minZ, q.player.z); }
  await page.keyboard.up('KeyW');
  const q = await st();
  check('sliding along the railing (pressed into it at an angle)', minZ >= RAIL_STOP && q.player.x > -7.4, `x ${s0.player.x} -> ${q.player.x}, min z ${minZ.toFixed(3)}`);
}
await shot('04_railing');

// =====================================================================================
// 4. Props, ends, land side, café walls: never through, never stuck
// =====================================================================================
async function pushInto(x, z, yaw, ms = 900) {
  await goTo(x, z, { tol: 0.2, timeout: 20000 });
  const r = await pushToward(yaw, ms);
  const s1 = await st();
  await page.keyboard.down('KeyS');
  for (let i = 0; i < 12; i++) { await sleep(50); await sample(); }
  await page.keyboard.up('KeyS');
  const s2 = await st();
  return { ...r, away: Math.hypot(s2.player.x - s1.player.x, s2.player.z - s1.player.z), s1 };
}
const pushes = [
  ['west planter', -16.6, 2.0, Math.PI / 2], ['east planter', 15.2, -1.0, -Math.PI / 2], ['land balustrade', -6.0, 6.3, Math.PI],
  ['bench (front)', -6.6, -2.3, Math.PI], ['bench (back)', -6.6, -0.6, 0], ['lamp', -9.8, -1.6, 0], ['bin', 3.35, -1.7, 0],
  ['binoculars', 0.6, -1.8, 0], ['tree planter', -8.4, 5.2, Math.PI], ['外灘 pylon', 1.5, 5.6, Math.PI],
  ['café front wall (window)', 13.5, 0.2, Math.PI], ['café west wall', 8.6, 4.5, -Math.PI / 2], ['café front (left bay)', 9.9, 0.3, Math.PI],
  ['umbrella table', 7.25, 2.7, Math.PI], ['counter (inside)', 13.0, 4.3, Math.PI], ['café back corner (inside)', 10.4, 6.2, Math.PI],
];
let stuck = 0, through = 0;
for (const [name, x, z, yaw] of pushes) {
  const r = await pushInto(x, z, yaw);
  if (r.away < 0.15) stuck++;
  if (r.pen) through++;
  console.log(`  push ${name}: away=${r.away.toFixed(2)} pen=${r.pen} at ${r.s1.player.x},${r.s1.player.z}`);
}
check('props / ends / café walls: never walk through', through === 0, `${through} of ${pushes.length}`);
check('props / ends / café walls: never stuck', stuck === 0, `${stuck} of ${pushes.length}`);
check('the café door lets you in and out', await (async () => {
  await goTo(11.1, 0.6); const a = await goTo(11.1, 3.0); const b = await goTo(11.1, 0.4);
  return a.player.z > 2.6 && b.player.z < 0.8;
})());

// =====================================================================================
// 5. Camera: orbits on the promenade, at the railing, by the café and inside it
// =====================================================================================
async function orbitCheck(label) {
  let bad = 0, n = 0, minDist = 99;
  for (let i = 0; i < 16; i++) {
    await dragTurn(Math.PI / 8, 3);
    await sleep(120);
    const q = await st();
    const inside = H.model.colliders.some((c) => c.type === 'box' && (c.maxX - c.minX) > 0.6 && (c.maxZ - c.minZ) > 0.6 && (c.maxX - c.minX) < 50 && q.cam.x > c.minX + 0.05 && q.cam.x < c.maxX - 0.05 && q.cam.z > c.minZ + 0.05 && q.cam.z < c.maxZ - 0.05 && q.cam.y < 3.5);
    const playerIn = q.player.x > 9.6 && q.player.x < 15.9 && q.player.z > 1.7 && q.player.z < 7.1;
    const camIn = q.cam.x > 9.5 && q.cam.x < 16 && q.cam.z > 1.6 && q.cam.z < 7.2 && q.cam.y < 3.5;
    const under = q.cam.y < 0.25;
    if (inside || under || (camIn && !playerIn)) bad++;
    minDist = Math.min(minDist, q.cam.dist);
    n++;
  }
  check(`camera orbit (${label}): never inside walls / props, never under the ground`, bad === 0, `${bad}/${n} bad samples, closest ${minDist.toFixed(2)}m`);
}
await goTo(0, 2.0); await orbitCheck('open promenade');
await goTo(-1.0, -2.5); await orbitCheck('at the railing');
await goTo(8.9, 2.5); await orbitCheck('beside the café');
await goTo(11.1, 0.7); await orbitCheck('at the café door');
await goTo(12.8, 3.4); await orbitCheck('inside the café');

// =====================================================================================
// 6. Interactions + objectives
// =====================================================================================
// C. café: stepping in finds it; the barista talks in a dialogue panel
await goTo(11.1, 0.5);
await goTo(11.1, 2.8);
s = await st();
check('objective: Find the café (step inside)', s.done.includes('cafe'), s.caption);
let r = await interactAt('barista', 13.45, 4.55);
await sleep(300);
let d = await dbg();
check('talk to the barista: dialogue panel', r.ok && /Take a moment/.test(d.dialogue ?? ''), d.dialogue);
await shot('05_barista');
await press('KeyE'); await sleep(400);
const d2 = (await dbg()).dialogue;
check('barista has more than one line', d2 && d2 !== d.dialogue, d2);
await goTo(11.1, 2.6);
await sleep(300);
check('dialogue closes when you walk away', (await dbg()).dialogue === null);

// B. the photo spot
await goTo(11.1, 0.4);
r = await interactAt('photo', 6.75, -2.05);
check('photo spot prompt', r.ok, r.s.interact);
await sleep(1900);
d = await dbg();
s = await st();
check('take a photo: postcard + album', d.album >= 1 && d.postcard, JSON.stringify(d));
check('objective: Take a photo', s.done.includes('photo'));
await shot('06_photo_postcard');
await sleep(3800);
const albumUi = await page.evaluate(() => { const a = document.getElementById('sh-album'); return a && getComputedStyle(a).display !== 'none' ? a.textContent : null; });
check('the postcard files into the album (bottom right)', albumUi && /1/.test(albumUi) && !(await dbg()).postcard, albumUi);
await shot('07_album');

// bench: sit, orbit, stand
await goTo(-6.6, -2.2);
s = await st();
check('bench prompt', /^bench/.test(s.interact ?? ''), s.interact);
await press('KeyE');
await sleep(2200);
s = await st();
check('sit on the bench (facing the river)', s.occupied && s.occupied.settled && s.hero.pose === 'sit', JSON.stringify(s.occupied));
await shot('08_bench');
const yaw0 = s.cam.yaw;
await dragTurn(1.0, 6);
check('camera orbits while sitting', Math.abs(wrap((await st()).cam.yaw - yaw0)) > 0.7);
await press('KeyW', 120);
await sleep(1600);
s = await st();
check('stand up to a free spot', !s.occupied && s.hero.pose === 'stand' && !penetrating(s.player), `${s.player.x},${s.player.z}`);

r = await interactAt('seagull', -2.25, -2.2);
check('say hi to the seagull', r.ok && /Squawk/.test(r.s.caption ?? ''), r.s.caption);
r = await interactAt('lifering', 2.25, -2.15);
check('life ring', r.ok && /life ring/i.test(r.s.caption ?? ''), r.s.caption);

// explore: the four marked spots
for (const [x, z] of [[-14.5, 1.5], [-6.5, 5.2], [0.4, -2.0], [8.4, -1.2]]) await goTo(x, z, { tol: 0.4, timeout: 15000 });
await sleep(400);
s = await st();
check('objective: Explore the waterfront', s.done.includes('explore'), `explored ${s.explore}`);
check('all objectives ticked', ['explore', 'cafe', 'photo'].every((k) => s.done.includes(k)), s.done.join(','));
await sleep(2600);
check('closing line ("Different place. Same you.") once everything is done', (await dbg()).ended);
await shot('09_objectives');

// =====================================================================================
// 7. Animation + frame rate
// =====================================================================================
const b0 = await dbg();
await sleep(1500);
const b1 = await dbg();
check('boats move along the river', b0.boats.every((x, i) => Math.abs(b1.boats[i] - x) > 1.5), `${b0.boats} -> ${b1.boats}`);
check('birds cross the sky', b0.birds.some((x, i) => Math.abs(b1.birds[i] - x) > 2), `${b0.birds.slice(0, 3)} -> ${b1.birds.slice(0, 3)}`);
// river strokes drift: compare a water-only strip of the canvas over time (camera still)
await goTo(0, 0.5);
await page.evaluate(() => { window.__dw.setView(0, 0.05, 3.0); window.__dw.hud(false); });
const grab = () => page.evaluate(() => {
  const c = document.querySelector('#app canvas'); const k = c.width / innerWidth;
  const o = document.createElement('canvas'); o.width = 600; o.height = 40; const g = o.getContext('2d');
  g.drawImage(c, 340 * k, 446 * k, 600 * k, 40 * k, 0, 0, 600, 40);
  const a = g.getImageData(0, 0, 600, 40).data; const v = []; for (let i = 0; i < a.length; i += 4) v.push(a[i]); return v;
});
const w0 = await grab(); await sleep(1200); const w1 = await grab();
const wd = w0.reduce((acc, v, i) => acc + Math.abs(v - w1[i]), 0) / w0.length;
check('river surface animates', wd > 1.0, `mean pixel change ${wd.toFixed(2)}`);
await page.evaluate(() => window.__dw.hud(true));
const fpsS = [];
await page.keyboard.down('KeyD');
for (let i = 0; i < 24; i++) { if (i % 6 === 3) await dragTurn(0.5, 3); await sleep(120); fpsS.push((await st()).fps); }
await page.keyboard.up('KeyD');
const fpsMin = Math.min(...fpsS.slice(3)), fpsAvg = fpsS.slice(3).reduce((a, b) => a + b, 0) / (fpsS.length - 3);
check('Shanghai frame rate while walking + turning (headless Chrome, 1280x853)', fpsMin > 45, `min ${fpsMin}, avg ${fpsAvg.toFixed(0)}`);

// =====================================================================================
// 8. Back to the airport, home, and the other chapters still work
// =====================================================================================
await goTo(2.3, 4.6);
s = await st();
check('signpost prompt (back to the airport)', s.interact === 'home', s.interact);
await press('KeyE');
await sleep(900);
check('travel card shows (to the airport)', await page.evaluate(() => !document.getElementById('travel').classList.contains('off') && /airport/i.test(document.getElementById('travel-text').textContent)));
await page.waitForFunction(() => window.__dw.state().scene === 'lobby' && !window.__dw.state().traveling, null, { timeout: 30000 });
s = await st();
const sha = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'gate-shanghai'));
check('back at the airport, in front of the Shanghai gate', Math.hypot(s.player.x - sha.x, s.player.z - sha.z) < 1.2, JSON.stringify(s.player));
await H.homeFromLobby();
s = await st();
check('back in the room at its start point', s.scene === 'room' && Math.hypot(s.player.x + 0.3, s.player.z - 1.4) < 0.05, `${s.scene} ${s.player.x},${s.player.z}`);
check('Shanghai HUD extras are gone in the room', await page.evaluate(() => !document.getElementById('sh-album') && !document.getElementById('sh-dialogue') && !document.getElementById('sh-postcard')));
await page.evaluate(() => window.__dw.travel('taiwan', true));
await page.waitForFunction(() => window.__dw.state().scene === 'taiwan' && !window.__dw.state().traveling, null, { timeout: 15000 });
check('Taiwan still loads', (await st()).scene === 'taiwan');
await page.evaluate(() => window.__dw.travel('shanghai', true));
await page.waitForFunction(() => window.__dw.state().scene === 'shanghai' && !window.__dw.state().traveling, null, { timeout: 15000 });
await sleep(800);
check('photo album survives the trip home and back', (await dbg()).album >= 1, JSON.stringify(await dbg()));
await page.evaluate(() => window.__dw.travel('room', true));
await page.waitForFunction(() => window.__dw.state().scene === 'room' && !window.__dw.state().traveling, null, { timeout: 15000 });
await sleep(1500);
check('repeat trips are clean (room fps after several loads)', (await st()).fps > 50, `fps=${(await st()).fps}`);
check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
check('never inside a collider during the whole run', mon.pen === 0, `${mon.pen}/${mon.samples} samples`);

const passed = results.filter((x) => x.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
fs.writeFileSync(`${out}/playtest.json`, JSON.stringify({ results, monitor: { ...mon, last: undefined }, fps: { min: fpsMin, avg: fpsAvg } }, null, 2));
await ctx.close();
await browser.close();
