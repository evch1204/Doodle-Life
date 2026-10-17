// End-to-end playtest (Milestone 3): starts in the room, travels to Taipei
// through the door, then drives the real game with keyboard + mouse input:
// stairs, building fronts, railings, camera orbits, every interaction and
// objective, and the trip back home. Records a video.
// Usage: node scripts/playtest_taipei.mjs <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createHarness } from './harness.mjs';

const out = process.argv[2] || 'review/m3/playtest';
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
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sleep = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

const H = createHarness(page);
const { dragTurn, press, loadModel, overlaps, penetrating, sample, goTo, interactAt, mon } = H;
// Camera sanity: never inside a building collider, never under the ground.
async function orbitCheck(label) {
  let bad = 0, n = 0, minDist = 99;
  for (let i = 0; i < 16; i++) {
    await dragTurn(Math.PI / 8, 3);
    await sleep(120);
    const s = await st();
    const camGround = await page.evaluate(({ x, z }) => window.__dw.heightAt(x, z), s.cam);
    const inside = H.model.colliders.some((c) => c.type === 'box' && (c.maxX - c.minX) > 0.6 && (c.maxZ - c.minZ) > 0.6 && s.cam.x > c.minX + 0.4 && s.cam.x < c.maxX - 0.4 && s.cam.z > c.minZ + 0.4 && s.cam.z < c.maxZ - 0.4 && s.cam.y < s.player.y + 4.3);
    const under = camGround > -50 && s.cam.y < camGround + 0.2;
    if (inside || under) bad++;
    minDist = Math.min(minDist, s.cam.dist);
    n++;
  }
  check(`camera orbit (${label}): never inside a building or under the ground`, bad === 0, `${bad}/${n} bad samples, closest ${minDist.toFixed(2)}m`);
}

// =====================================================================================
// 1. Room -> Taipei through the front door
// =====================================================================================
await loadModel();
check('starts in the room', (await st()).scene === 'room');
await goTo(-2.4, 3.45);
let s = await st();
check('door prompt in the room', s.interact === 'door', `interact=${s.interact}`);
await press('KeyE');
await sleep(900);
const card = await page.evaluate(() => ({ on: !document.getElementById('travel').classList.contains('off'), text: document.getElementById('travel-text').textContent }));
check('travel card shows', card.on && card.text.includes('Taipei'), JSON.stringify(card));
await shot('01_travel_card');
await page.waitForFunction(() => !window.__dw.state().traveling, null, { timeout: 15000 });
await sleep(300);
s = await st();
check('arrives in Taipei at the start point', s.scene === 'taipei' && Math.hypot(s.player.x - 0, s.player.z - 1.4) < 0.05, `scene=${s.scene} at ${s.player.x},${s.player.z}`);
await loadModel();
await shot('02_arrival');

// =====================================================================================
// 2. Walk from the top to the lookout (all main stairs), then back up
// =====================================================================================
const visitedRegions = new Set();
await page.evaluate(() => window.__dw.resetMaxDy());
const route = [[0, -1.0], [0.3, -4.9], [0.3, -9.2], [0.6, -12.3], [3.0, -15.6], [4.1, -18.8], [4.1, -22.0], [4.1, -25.5], [4.5, -27.6]];
for (const [x, z] of route) {
  await goTo(x, z, { tol: 0.25 });
  visitedRegions.add((await st()).ground);
}
s = await st();
check('top of the street -> lookout on foot', Math.hypot(s.player.x - 4.5, s.player.z + 27.6) < 0.5 && Math.abs(s.player.y + 3.9) < 0.01, `at ${s.player.x},${s.player.z} y=${s.player.y}`);
await shot('03_lookout_arrive');
for (const [x, z] of [...route].reverse().slice(1).concat([[0, 1.2]])) await goTo(x, z, { tol: 0.25 });
s = await st();
check('lookout -> back to the top on foot', Math.hypot(s.player.x - 0, s.player.z - 1.2) < 0.5 && Math.abs(s.player.y) < 0.01, `at ${s.player.x},${s.player.z} y=${s.player.y}`);
const vy = (await st()).maxVy;
check('stairs: no popping (fastest vertical body speed, frame-rate independent)', vy < 2.5, `max vertical speed ${vy} m/s (a 0.15 m pop in one frame would be ~9 m/s)`);
check('stairs: feet on the ground (no floating / sinking)', mon.float === 0 && mon.sink === 0, `float=${mon.float} sink=${mon.sink} of ${mon.samples}, highest above ground ${(mon.maxFloat ?? 0).toFixed(3)} m`);

// =====================================================================================
// 3. Shrine stairs (up and down)
// =====================================================================================
await goTo(0.5, -13.8);
await goTo(-5.4, -14.6);
s = await st();
check('climb the shrine steps', Math.abs(s.player.y + 1.35) < 0.01, `y=${s.player.y}`);
await goTo(-2.2, -14.6);
s = await st();
check('descend the shrine steps', Math.abs(s.player.y + 1.8) < 0.01, `y=${s.player.y}`);

// =====================================================================================
// 4. Push against every building front, railing and drop: no stuck spots, no falls
// =====================================================================================
async function pushInto(x, z, yaw, ms = 900) {
  await goTo(x, z, { tol: 0.2 });
  const s0 = await st();
  await dragTurn(wrap(yaw - s0.cam.yaw), 4);
  await page.keyboard.down('KeyW');
  for (let i = 0; i < ms / 50; i++) { await sleep(50); await sample(); }
  await page.keyboard.up('KeyW');
  const s1 = await st();
  // then walk away: must not be stuck
  await page.keyboard.down('KeyS');
  for (let i = 0; i < 12; i++) { await sleep(50); await sample(); }
  await page.keyboard.up('KeyS');
  const s2 = await st();
  return { pushed: s1, away: Math.hypot(s2.player.x - s1.player.x, s2.player.z - s1.player.z), ground: s1.ground };
}
const pushes = [
  ['left fronts (top)', 0, 0.5, Math.PI / 2], ['left fronts (bubble tea)', 0, -6.0, Math.PI / 2], ['left fronts (lower)', 0, -11.5, Math.PI / 2],
  ['right fronts (top)', 0, 0.5, -Math.PI / 2], ['right fronts (taro)', 0, -3.0, -Math.PI / 2], ['tea house counter', 0, -11.4, -Math.PI / 2],
  ['end of street', 0, 3.0, Math.PI], ['plaza overlook rail', 0.5, -15.8, 0], ['plaza east shop', 3.8, -15.2, -Math.PI / 2],
  ['steamer cart', 4.2, -14.4, Math.PI], ['cat ledge', 2.55, -14.0, Math.PI], ['lower street rail', 3.4, -20.5, Math.PI / 2],
  ['lower street fronts', 4.6, -18.0, -Math.PI / 2], ['lookout rail (front)', 4.5, -28.0, 0], ['lookout rail (west)', 1.2, -26.8, Math.PI / 2],
  ['lookout rail (east)', 7.8, -26.5, -Math.PI / 2], ['shrine', -5.3, -14.6, Math.PI / 2], ['alley wall', -3.6, -14.6, Math.PI],
];
let stuck = 0, fell = 0, through = 0;
for (const [name, x, z, yaw] of pushes) {
  const r = await pushInto(x, z, yaw);
  const pen = penetrating(r.pushed.player);
  if (r.away < 0.15) stuck++;
  if (r.ground < -50) fell++;
  if (pen) through++;
  console.log(`  push ${name}: away=${r.away.toFixed(2)} ground=${r.ground} pen=${pen}`);
}
check('building fronts / railings / stalls: never walk through', through === 0, `${through} of ${pushes.length}`);
check('building fronts / railings / stalls: never stuck', stuck === 0, `${stuck} of ${pushes.length}`);
check('never off the walkable ground (no falls)', fell === 0 && mon.fell === 0, `fell=${fell} monitor=${mon.fell}`);

// =====================================================================================
// 5. Camera: full orbits on the narrow street and at the lookout
// =====================================================================================
await goTo(0, -6.0);
await orbitCheck('narrow street');
await shot('04_orbit_street');
await goTo(-2.2, -14.6);
await orbitCheck('shrine alley');
await goTo(4.0, -20.5);
await orbitCheck('lower street');
await goTo(4.5, -27.0);
await orbitCheck('lookout');
s = await st();
const streetDist = (await (async () => { await goTo(0.0, -8.6); await sleep(1500); return (await st()).cam.dist; })());
await goTo(4.6, -27.0); await sleep(1800);
const lookDist = (await st()).cam.dist;
check('camera pulls in on the narrow street, opens up at the lookout', lookDist > streetDist + 0.5, `street ${streetDist} vs lookout ${lookDist}`);

// =====================================================================================
// 6. Interactions + objectives
// =====================================================================================
let r = await interactAt('auntie', 0.9, -11.4);
s = r.s;
check('talk to the tea house auntie', r.ok && /oolong|Welcome/.test(s.caption ?? ''), s.caption);
await shot('05_auntie');
await press('KeyE'); await sleep(400);
const second = (await st()).caption;
check('auntie has more than one line', second && second !== s.caption, second);
check('objective: Find the tea house', (await st()).done.includes('teahouse'));

r = await interactAt('lantern', 0.85, -9.95);
check('tea lantern sways when touched', r.ok && /lantern/i.test(r.s.caption ?? ''), r.s.caption);

r = await interactAt('cat', 2.55, -13.95);
check('talk to the cat', r.ok && /cat/i.test(r.s.caption ?? ''), r.s.caption);
await sleep(300);
await shot('06_cat');

r = await interactAt('steamer', 4.0, -14.2);
check('steamer puffs steam', r.ok && /xiaolongbao/i.test(r.s.caption ?? ''), r.s.caption);
await sleep(400);
await shot('07_steamer');

r = await interactAt('incense', -5.3, -14.6);
check('shrine incense', r.ok && /wish/i.test(r.s.caption ?? ''), r.s.caption);

// bench at the lookout: sit, camera still orbits, stand up with a move key
await goTo(2.3, -26.95);
s = await st();
check('bench prompt', s.interact === 'bench', s.interact);
await press('KeyE');
await sleep(2200);
s = await st();
check('sit on the bench', s.occupied && s.occupied.settled && s.hero.pose === 'sit', JSON.stringify(s.occupied));
await shot('08_bench');
const yaw0 = s.cam.yaw;
await dragTurn(1.2, 6);
check('camera orbits while sitting', Math.abs(wrap((await st()).cam.yaw - yaw0)) > 0.8);
await press('KeyW', 120);
await sleep(1600);
s = await st();
check('stand up from the bench to a free spot', !s.occupied && s.hero.pose === 'stand' && !penetrating(s.player), `${s.player.x},${s.player.z}`);

// lookout: slow pan toward Taipei 101, completes "Watch the sunset"
await goTo(4.5, -28.2);
s = await st();
check('lookout prompt', s.interact === 'lookout', s.interact);
await press('KeyE');
await sleep(400);
const yawA = (await st()).cam.yaw;
await sleep(2600);
s = await st();
const target = 7 * Math.PI / 180;
check('lookout: camera pans slowly toward Taipei 101', Math.abs(wrap(s.cam.yaw - target)) < 0.2 && Math.abs(wrap(yawA - target)) > Math.abs(wrap(s.cam.yaw - target)), `yaw ${yawA.toFixed(2)} -> ${s.cam.yaw.toFixed(2)} (target ${target.toFixed(2)})`);
check('objective: Watch the sunset', s.done.includes('sunset'), s.caption);
await shot('09_sunset');

// collectibles: four stars + the bubble tea
const items = await page.evaluate(() => window.__dw.interactables().filter((i) => i.stand));
for (const it of items) {
  await goTo(it.stand[0], it.stand[1]);
  await sleep(150);
  s = await st();
  if (s.interact === 'star' || s.interact === 'boba') {
    const before = s.stars;
    await press('KeyE');
    await sleep(900);
    const s2 = await st();
    console.log(`  collect ${s.interact} at ${it.stand}: ${before} -> ${s2.stars} ${s2.caption ?? ''}`);
    if (s.interact === 'boba') { check('bubble tea: pick up + caption', s2.stars === before + 1 && /Good food/.test(s2.caption ?? ''), s2.caption); await shot('10_boba'); }
  } else console.log(`  no prompt at ${it.stand} (interact=${s.interact})`);
}
s = await st();
check('all collectibles picked up', s.stars === s.starTotal && s.starTotal === 5, `${s.stars}/${s.starTotal}`);
check('objective: Explore the old streets', s.done.includes('explore'), `explored ${s.explore}`);
check('all objectives ticked', ['explore', 'teahouse', 'sunset', 'stars'].every((k) => s.done.includes(k)), s.done.join(','));
await shot('11_objectives');

// =====================================================================================
// 7. Back home: the signpost at the top of the street
// =====================================================================================
await goTo(0.75, 1.25);
s = await st();
check('home signpost prompt', s.interact === 'home', s.interact);
await press('KeyE');
await sleep(900);
check('travel card shows (going home)', await page.evaluate(() => !document.getElementById('travel').classList.contains('off') && /home/i.test(document.getElementById('travel-text').textContent)));
await page.waitForFunction(() => !window.__dw.state().traveling, null, { timeout: 15000 });
s = await st();
check('back in the room at its start point', s.scene === 'room' && Math.hypot(s.player.x + 0.3, s.player.z - 1.4) < 0.05, `${s.scene} ${s.player.x},${s.player.z}`);
await shot('12_home');
// the room still works after the round trip
await loadModel();
await goTo(-3.25, -1.6);
await press('KeyE'); await sleep(2600);
s = await st();
check('room still works after the trip (desk chair + monitors)', s.occupied?.id === 'deskchair' && s.monitorsOn === true, JSON.stringify(s.occupied));
await press('Escape'); await sleep(1800);
// and a second trip there and back is clean
await page.evaluate(() => window.__dw.travel('taipei', true));
await page.waitForFunction(() => window.__dw.state().scene === 'taipei' && !window.__dw.state().traveling, null, { timeout: 15000 });
await page.evaluate(() => window.__dw.travel('room', true));
await page.waitForFunction(() => window.__dw.state().scene === 'room' && !window.__dw.state().traveling, null, { timeout: 15000 });
await sleep(1500);
const fpsRoom = (await st()).fps;
check('repeat trips are clean (fps after 3 loads)', fpsRoom > 50, `fps=${fpsRoom}`);

// fps in Taipei while walking
await page.evaluate(() => window.__dw.travel('taipei', true));
await page.waitForFunction(() => window.__dw.state().scene === 'taipei' && !window.__dw.state().traveling, null, { timeout: 15000 });
await loadModel();
const fpsS = [];
await page.keyboard.down('KeyW');
for (let i = 0; i < 20; i++) { await sleep(150); fpsS.push((await st()).fps); }
await page.keyboard.up('KeyW');
const fpsMin = Math.min(...fpsS.slice(3)), fpsAvg = fpsS.slice(3).reduce((a, b) => a + b, 0) / (fpsS.length - 3);
check('Taipei frame rate (headless Chrome, 1280x853)', fpsMin > 45, `min ${fpsMin}, avg ${fpsAvg.toFixed(0)}`);
check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
check('never inside a collider during the whole run', mon.pen === 0, `${mon.pen}/${mon.samples} samples`);

const passed = results.filter((x) => x.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
fs.writeFileSync(`${out}/playtest.json`, JSON.stringify({ results, monitor: { ...mon, last: undefined }, fps: { min: fpsMin, avg: fpsAvg } }, null, 2));
await ctx.close();
await browser.close();
