// End-to-end playtest (the Bay Area / the Embarcadero): starts at the airport,
// checks in at the Bay Area gate, then drives the real game with keyboard +
// click-drag mouse input (never pointer lock): the spawn and the HUD, the café,
// the cable car (inspecting it, and it waiting for someone on the track), the
// bay boundary pushed all along the railing and round the pier, both ends of
// the street, the lookout, the map, a bench, camera orbits along the street,
// people / boats / water animating, fps, and the trip back to the airport.
// Usage: URL=http://localhost:5173/ node scripts/playtest_bayarea.mjs <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createHarness } from './harness.mjs';

const out = process.argv[2] || 'review/bayarea/playtest';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 853 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto((process.env.URL || 'http://localhost:5173/') + '?scene=lobby');
await page.waitForFunction(() => window.__dw && window.__dw.ready);
await page.waitForTimeout(1000);

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const H = createHarness(page);
const { sleep, st, wrap, dragTurn, press, loadModel, penetrating, goTo, interactAt } = H;
const dbg = () => page.evaluate(() => window.__dw.sceneDebug());
const TS = Number(process.env.TIMEOUT_SCALE || 1);

// the street frame (bayarea.js): s along the street, u across it (+ toward the water)
const S1 = 40, R = 160, S2 = 110, TH2 = (S2 - S1) / R;
const at = (s, u) => (s <= S1 ? [u, -s] : [-R + (R + u) * Math.cos((s - S1) / R), -S1 - (R + u) * Math.sin((s - S1) / R)]);
function toStreet(x, z) {
  if (z >= -S1) return [-z, x];
  const dx = x + R, dz = -(z + S1);
  return [S1 + R * Math.atan2(dz, dx), Math.hypot(dx, dz) - R];
}
// set the player down a short walk from a spot: the walk itself is tested in section 5
const near = (it, dx, dz) => page.evaluate(([x, z]) => window.__dw.setPlayer(x, z), [it.x + dx, it.z + dz]);
const RAIL_STOP = 7.6 - 0.2 - 0.26 + 0.02; // the player's centre never gets closer to the railing than this (u)

// =====================================================================================
// 1. The airport -> the Bay Area gate -> the street
// =====================================================================================
await H.checkInAt('bayarea', 'bayarea');
await sleep(500);
let s = await st();
check('arrives on the sidewalk at the start point, facing down the street', s.scene === 'bayarea' && Math.hypot(s.player.x + 4.6, s.player.z - 6.5) < 0.05 && Math.abs(wrap(s.player.facing - Math.PI)) < 0.01, `at ${s.player.x},${s.player.z} facing ${s.player.facing} yaw ${s.cam.yaw}`);
check('stands on the sidewalk (y 0.15)', Math.abs(s.player.y - 0.15) < 0.01, `y=${s.player.y}`);
const hud = await page.evaluate(() => [...document.querySelectorAll('#obj-list .obj')].map((e) => e.textContent));
check('HUD objectives: café / cable car / pier', hud.length === 3 && /Cafe/.test(hud[0]) && /cable car/.test(hud[1]) && /pier/.test(hud[2]), hud.join(' | '));
await loadModel();
await shot('01_arrival');

// =====================================================================================
// 2. The café's chalkboard (interaction 1)
// =====================================================================================
await page.evaluate(() => window.__dw.resetMaxDy());
const cafeIt = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'cafe'));
await near(cafeIt, 1.2, 1.4);
let r = await interactAt('cafe', cafeIt.x + 0.3, cafeIt.z + 0.4);
check('café prompt at the chalkboard', r.ok, `interact=${r.s.interact} at ${r.s.player.x},${r.s.player.z}`);
s = await st();
check('café caption', /Cafe Bay View/.test(s.caption ?? ''), s.caption);
check('café objective done', s.done.includes('cafe'), s.done.join(','));
await shot('02_cafe');

// =====================================================================================
// 3. The cable car: it runs; it waits for someone on the track; inspecting it (interaction 2)
// =====================================================================================
const c0 = (await dbg()).car;
await sleep(5000);
const c1 = (await dbg()).car;
check('the cable car runs along its stretch of track', Math.abs(c1.s - c0.s) > 0.5 || c0.v > 0 || c1.v > 0, `s ${c0.s} -> ${c1.s}`);
// stand on the track just ahead of the car while it is moving
await page.waitForFunction(() => window.__dw.sceneDebug().car.v > 0.6, null, { timeout: 40000 * TS });
let car = (await dbg()).car;
const dir = await page.evaluate(() => { const a = window.__dw.sceneDebug().car.s; return new Promise((res) => setTimeout(() => res(Math.sign(window.__dw.sceneDebug().car.s - a)), 300)); });
const ahead = car.s + dir * (4.2 + 2.0);
await page.evaluate(([x, z]) => window.__dw.setPlayer(x, z, Math.PI), at(ahead, 0));
await page.waitForFunction(() => window.__dw.sceneDebug().car.v < 0.05, null, { timeout: 20000 * TS }).catch(() => {});
await sleep(1000);
car = (await dbg()).car;
s = await st();
const [psA] = toStreet(s.player.x, s.player.z);
check('the cable car stops for the player on the track', car.waiting && car.v < 0.05 && Math.abs(car.s + dir * 4.2 - psA) > 0.3, JSON.stringify(car) + ` player s ${psA.toFixed(2)}`);
check('…and never pushes into the player', !penetrating(s.player), `${s.player.x},${s.player.z}`);
await page.evaluate(([x, z]) => window.__dw.setPlayer(x, z, Math.PI), at(ahead, -4.6));
await page.waitForFunction(() => window.__dw.sceneDebug().car.v > 0.1, null, { timeout: 20000 * TS }).catch(() => {});
check('…and moves on once the track is clear', (await dbg()).car.v > 0.1 || !(await dbg()).car.waiting, JSON.stringify((await dbg()).car));
// walk up to its side while it waits at a stop
await page.waitForFunction(() => { const c = window.__dw.sceneDebug().car; return c.v === 0 && (c.s < 9.05 || c.s > 20.95); }, null, { timeout: 60000 * TS });
car = (await dbg()).car;
await page.evaluate(([x, z]) => window.__dw.setPlayer(x, z), at(car.s + 1.5, -3.6));
await goTo(...at(car.s, -2.8));
await sleep(300);
s = await st();
check('cable car prompt beside it', s.interact === 'cablecar', `interact=${s.interact} car s ${car.s} player ${s.player.x},${s.player.z}`);
await press('KeyE'); await sleep(500);
s = await st();
check('cable car caption + objective', /cable cars/.test(s.caption ?? '') && s.done.includes('cablecar'), s.caption);
await shot('03_cablecar');

// =====================================================================================
// 4. The bay boundary: push toward the water every 3 m along the railing (straight and bend)
// =====================================================================================
let worstU = -Infinity, offGround = 0, inWater = 0;
for (let sp = -9; sp <= 29; sp += 2) {
  if (sp > 16 && sp < 26) continue; // the pier's mouth (tested below)
  const [x, z] = at(sp, 6.4);
  await page.evaluate(([x, z]) => { window.__dw.setPlayer(x, z); }, [x, z]);
  // face the water: the camera yaw that looks along +u
  const th = sp <= S1 ? 0 : (sp - S1) / R;
  await page.evaluate((y) => window.__dw.setView(y, 0.2), -Math.PI / 2 + th);
  await page.keyboard.down('KeyW'); await sleep(700); await page.keyboard.up('KeyW');
  s = await st();
  const [, u] = toStreet(s.player.x, s.player.z);
  worstU = Math.max(worstU, u);
  if (s.ground < -50) offGround++;
  if (s.player.y < 0) inWater++;
}
check('the railing holds all along the promenade (never past it)', worstU < 7.6 && offGround === 0 && inWater === 0, `max u ${worstU.toFixed(3)} (rail at 7.6), off-ground ${offGround}`);
// the pier (s 18..24 -> z -18..-24, out to x 22): its two sides and its end
const pier = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'lookout'));
let pierOk = true, pierDetail = [];
for (const [x, z, yaw] of [[14, -19.0, 0], [14, -23.0, Math.PI], [20.0, -21, -Math.PI / 2], [10, -18.6, 0], [17, -23.4, Math.PI]]) {
  await page.evaluate(([x, z, y]) => { window.__dw.setPlayer(x, z); window.__dw.setView(y, 0.2); }, [x, z, yaw]);
  await page.keyboard.down('KeyW'); await sleep(900); await page.keyboard.up('KeyW');
  s = await st();
  const ok = s.ground > -50 && s.player.y > 0.1 && s.player.z < -18.0 && s.player.z > -24.0 && s.player.x < 22;
  pierOk &&= ok; pierDetail.push(`${s.player.x.toFixed(2)},${s.player.z.toFixed(2)}`);
}
check('the pier rails hold (sides and end)', pierOk, pierDetail.join(' '));
// both ends of the walk
// both ends, pushed across the sidewalk, the street (bollards, chains, the bumper) and the promenade
let endWorst = [Infinity, -Infinity], endOff = 0;
for (const u of [-7.5, -5.5, -4.2, -2.1, -1.2, 0, 1.2, 2.1, 4.0, 5.4]) {
  for (const [s0, yaw] of [[-7.2, Math.PI], [28, 0]]) {
    await page.evaluate(([x, z, y]) => { window.__dw.setPlayer(x, z); window.__dw.setView(y, 0.2); }, [...at(s0, u), yaw]);
    await page.keyboard.down('KeyW'); await sleep(1300); await page.keyboard.up('KeyW');
    s = await st();
    const [ps] = toStreet(s.player.x, s.player.z);
    endWorst = [Math.min(endWorst[0], ps), Math.max(endWorst[1], ps)];
    if (s.ground < -50) endOff++;
  }
}
check('both ends hold all the way across (terminus behind, the Wharf end ahead)', endWorst[0] > -10.6 && endWorst[1] < 30.3 && endOff === 0, `s ${endWorst[0].toFixed(2)} .. ${endWorst[1].toFixed(2)}, off-ground ${endOff}`);
// the facades: walk into the shopfronts
let worstF = Infinity;
for (const sp of [-8, 6, 20, 27]) {
  const th = sp <= S1 ? 0 : (sp - S1) / R;
  await page.evaluate(([x, z, y]) => { window.__dw.setPlayer(x, z); window.__dw.setView(y, 0.2); }, [...at(sp, -5.4), Math.PI / 2 + th]);
  await page.keyboard.down('KeyW'); await sleep(1200); await page.keyboard.up('KeyW');
  s = await st();
  worstF = Math.min(worstF, toStreet(s.player.x, s.player.z)[1]);
}
check('the shopfronts hold (never inside a building)', worstF > -9.0, `min u ${worstF.toFixed(3)} (facades at -9)`);

// =====================================================================================
// 5. The walk: down the sidewalk from the spawn to the far end, then the promenade back
// =====================================================================================
await page.evaluate(() => window.__dw.setPlayer(-4.6, 6.5, Math.PI));
await loadModel();
H.mon.pen = 0;
const t0 = Date.now();
s = await goTo(...at(27.5, -4.6), { timeout: 20000 });
const walked = toStreet(s.player.x, s.player.z)[0];
check('walks the whole sidewalk to the Wharf end', walked > 27, `reached s ${walked.toFixed(1)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
check('Fisherman\'s Wharf caption at the far end', /Fisherman/.test(s.caption ?? ''), s.caption);
await shot('04_wharf');
s = await goTo(...at(16, 5.2), { timeout: 20000 });
check('crosses the street to the promenade', toStreet(s.player.x, s.player.z)[1] > 3, `u ${toStreet(s.player.x, s.player.z)[1].toFixed(2)}`);
check('no penetration of colliders while walking', H.mon.pen === 0, `samples ${H.mon.samples} pen ${H.mon.pen}`);

// =====================================================================================
// 6. The lookout at the pier's end (interaction 3), the plaque
// =====================================================================================
r = await interactAt('lookout', pier.x, pier.z);
check('lookout prompt at the end of the pier', r.ok, `interact=${r.s.interact} at ${r.s.player.x},${r.s.player.z}`);
s = await st();
check('lookout caption + objective', /Golden Gate Bridge/.test(s.caption ?? '') && s.done.includes('pier'), s.caption);
await sleep(2800 * TS);
s = await st();
// the bridge's middle (sf.js BRIDGE_MID)
const bridgeYaw = Math.atan2(-(223.2 - s.player.x), -(-624.4 - s.player.z));
check('the lookout turns the view to the bridge', Math.abs(wrap(s.cam.yaw - bridgeYaw)) < 0.25, `yaw ${s.cam.yaw} want ~${bridgeYaw.toFixed(2)}`);
await shot('05_lookout');
const plaque = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'plaque'));
r = await interactAt('plaque', plaque.x, plaque.z);
check('plaque prompt + caption', r.ok && /746 feet/.test(r.s.caption ?? ''), r.s.caption);
check('all three objectives done', ['cafe', 'cablecar', 'pier'].every((k) => r.s.done.includes(k)), r.s.done.join(','));

// =====================================================================================
// 7. The map card, a bench
// =====================================================================================
const mapIt = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'map'));
await near(mapIt, 0, 1.5);
r = await interactAt('map', mapIt.x, mapIt.z);
const cardOpen = await page.evaluate(() => !document.getElementById('bay-card').classList.contains('hidden'));
check('the map card opens', r.ok && cardOpen, `interact=${r.s.interact}`);
await shot('06_map');
await press('KeyE'); await sleep(300);
check('E closes the map card', await page.evaluate(() => document.getElementById('bay-card').classList.contains('hidden')));
const benchIt = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'bench1'));
await near(benchIt, -1.5, 0);
r = await interactAt('bench1', benchIt.x, benchIt.z);
await page.waitForFunction(() => window.__dw.state().occupied?.settled, null, { timeout: 10000 * TS }).catch(() => {});
await sleep(1500 * TS); // let the camera settle on the bridge
s = await st();
check('sits on a bench facing the bay', r.ok && s.occupied?.settled && s.hero.pose === 'sit', JSON.stringify(s.occupied));
await shot('07_bench');
await press('KeyW', 120);
await page.waitForFunction(() => !window.__dw.state().occupied && window.__dw.state().hero.pose === 'stand', null, { timeout: 10000 * TS }).catch(() => {});
s = await st();
check('stands up again', !s.occupied && s.hero.pose === 'stand', `pose ${s.hero.pose}`);

// =====================================================================================
// 8. Camera orbits along the street: never inside a building, never under the ground
// =====================================================================================
let camBad = 0, camDetail = '';
for (const sp of [-8, 3, 12, 20, 28]) {
  await page.evaluate(([x, z]) => window.__dw.setPlayer(x, z, Math.PI), at(sp, -6.4));
  for (let k = 0; k < 8; k++) {
    await page.evaluate((y) => window.__dw.setView(y, 0.25), (k / 8) * Math.PI * 2);
    await sleep(120);
    s = await st();
    const [cs, cu] = toStreet(s.cam.x, s.cam.z);
    if (cs > -10 && cs < 30 && cu < -9.25) { camBad++; camDetail = `s ${cs.toFixed(1)} u ${cu.toFixed(2)}`; }
    if (s.cam.y < 0.3) { camBad++; camDetail = `cam y ${s.cam.y}`; }
  }
}
check('camera orbits stay out of the buildings', camBad === 0, camDetail);

// =====================================================================================
// 9. The world animates; performance
// =====================================================================================
const d0 = await dbg(); await sleep(2000 * TS); const d1 = await dbg();
check('passers-by walk', d0.walkers.some((w, i) => Math.abs(w - d1.walkers[i]) > 0.3), `${d0.walkers} -> ${d1.walkers}`);
check('boats sail and the ferry crosses', d0.boats.some((b, i) => Math.hypot(b[0] - d1.boats[i][0], b[1] - d1.boats[i][1]) > 0.3) && Math.abs(d0.ferry - d1.ferry) > 0.3, `${d0.ferry} -> ${d1.ferry}`);
check('the water moves', d1.waterTime > d0.waterTime, `${d0.waterTime} -> ${d1.waterTime}`);
await page.evaluate(() => window.__dw.setPlayer(-4.6, 6.5, Math.PI));
await page.evaluate(() => window.__dw.setView(-0.04, 0.1));
await sleep(3000);
s = await st();
check('frame rate at the spawn (headless)', s.fps >= 20, `fps ${s.fps}`);
const info = await page.evaluate(() => window.__dw.renderInfo());
console.log('render', JSON.stringify(info));

// =====================================================================================
// 10. Back to the airport (interaction 4)
// =====================================================================================
const home = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'home'));
await near(home, -1.5, 0);
r = await interactAt('home', home.x, home.z);
check('"Back to the airport" prompt at the fingerpost', r.ok, `interact=${r.s.interact}`);
await page.waitForFunction(() => window.__dw.state().scene === 'lobby' && !window.__dw.state().traveling, null, { timeout: 60000 * TS });
s = await st();
const gate = await page.evaluate(() => window.__dw.interactables().find((i) => i.id === 'gate-bayarea'));
check('lands in front of the Bay Area gate', Math.hypot(s.player.x - gate.x, s.player.z - gate.z) < 2.5, `${s.player.x},${s.player.z} gate ${gate.x},${gate.z}`);

check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);
