// Shared helpers for scripted runs: real mouse/keyboard driving, a collision +
// ground model read from the running game, grid A* routes and a monitor that
// samples the player for penetration, popping and falls.
export function createHarness(page) {
  const sleep = (ms) => page.waitForTimeout(ms);
  const st = () => page.evaluate(() => window.__dw.state());
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // ---- input helpers (pointer lock is unavailable headless: click-drag look) ------
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
  async function press(key, ms = 80) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }
  
  // ---- per-scene collision model + grid A* (binary heap) ----------------------------
  let model = null;
  async function loadModel() {
    const colliders = await page.evaluate(() => window.__dw.colliders);
    const sceneId = (await st()).scene;
    const B = sceneId === 'taiwan' ? { x0: -7.6, x1: 9.0, z0: -29.4, z1: 4.8 } : { x0: -4.7, x1: 4.7, z0: -5.0, z1: 4.2 };
    const G = 0.12;
    const NX = Math.ceil((B.x1 - B.x0) / G) + 1, NZ = Math.ceil((B.z1 - B.z0) / G) + 1;
    const hs = await page.evaluate(({ B, G, NX, NZ }) => {
      const a = [];
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) a.push(window.__dw.heightAt(B.x0 + i * G, B.z0 + j * G));
      return a;
    }, { B, G, NX, NZ });
    model = { colliders, B, G, NX, NZ, hs, sceneId };
    model.free = new Uint8Array(NX * NZ);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = B.x0 + i * G, z = B.z0 + j * G;
      model.free[j * NX + i] = hs[j * NX + i] > -50 && !overlaps(x, z, R + 0.06) && edgeClear(x, z) ? 1 : 0;
    }
  }
  const R = 0.26;
  function overlaps(x, z, r = R, tol = 0.005) {
    for (const c of model.colliders) {
      if (c.type === 'box') {
        const cx = Math.max(c.minX, Math.min(x, c.maxX)), cz = Math.max(c.minZ, Math.min(z, c.maxZ));
        if (Math.hypot(x - cx, z - cz) < r - tol) return true;
      } else if (Math.hypot(x - c.x, z - c.z) < c.r + r - tol) return true;
    }
    return false;
  }
  // keep test routes away from walkable edges (where the controller refuses the move)
  function hAt(x, z) {
    const { B, G, NX, NZ, hs } = model;
    const i = Math.round((x - B.x0) / G), j = Math.round((z - B.z0) / G);
    if (i < 0 || j < 0 || i >= NX || j >= NZ) return -100;
    return hs[j * NX + i];
  }
  function edgeClear(x, z) {
    const h = hAt(x, z);
    for (let a = 0; a < 8; a++) {
      const px = x + Math.cos((a * Math.PI) / 4) * (R + 0.08), pz = z + Math.sin((a * Math.PI) / 4) * (R + 0.08);
      if (Math.abs(hAt(px, pz) - h) > 0.42) return false;
    }
    return true;
  }
  const penetrating = (p) => overlaps(p.x, p.z, R, 0.02);
  function lineFree(a, b) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (overlaps(x, z, R + 0.04) || !edgeClear(x, z) || hAt(x, z) < -50) return false;
    }
    return true;
  }
  function findPath(from, to) {
    const { B, G, NX, NZ, free } = model;
    const toCell = (x, z) => [Math.round((x - B.x0) / G), Math.round((z - B.z0) / G)];
    const cellPos = (i, j) => [B.x0 + i * G, B.z0 + j * G];
    const nearestFree = (i, j) => {
      for (let r = 0; r < 30; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < NX && b < NZ && free[b * NX + a]) return [a, b];
      }
      return [i, j];
    };
    const [si, sj] = nearestFree(...toCell(...from)), [ti, tj] = nearestFree(...toCell(...to));
    const N = NX * NZ, gS = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [];
    const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    gS[sj * NX + si] = 0;
    push(0, sj * NX + si);
    const goal = tj * NX + ti;
    while (heap.length) {
      const [, cur] = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % NX, cj = (cur / NX) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = ci + di, b = cj + dj;
        if (a < 0 || b < 0 || a >= NX || b >= NZ || !free[b * NX + a]) continue;
        const nb = b * NX + a, g = gS[cur] + Math.hypot(di, dj);
        if (g < gS[nb]) { gS[nb] = g; prev[nb] = cur; push(g + Math.hypot(a - ti, b - tj), nb); }
      }
    }
    if (prev[goal] === -1 && goal !== sj * NX + si) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = prev[c]) cells.unshift(cellPos(c % NX, (c / NX) | 0));
    const pts = [from];
    let anchor = from;
    for (let k = 1; k < cells.length; k++) if (!lineFree(anchor, cells[k])) { pts.push(cells[k - 1]); anchor = cells[k - 1]; }
    pts.push(to);
    return pts;
  }
  
  // ---- movement + continuous monitoring --------------------------------------------
  const mon = { samples: 0, pen: 0, maxDy: 0, float: 0, sink: 0, fell: 0, last: null, worst: null };
  async function sample() {
    const s = await st();
    mon.samples++;
    if (penetrating(s.player)) mon.pen++;
    if (s.scene === 'taiwan') {
      if (s.ground < -50) mon.fell++;
      if (!s.occupied && !s.traveling) {
        if (s.hero.y > s.ground + 0.04) mon.float++;
        mon.maxFloat = Math.max(mon.maxFloat ?? 0, s.hero.y - s.ground);
        if (s.hero.y < s.ground - 0.2) mon.sink++;
        if (mon.last && mon.last.scene === 'taiwan' && !mon.last.occupied) {
          const dy = Math.abs(s.hero.y - mon.last.hero.y);
          if (dy > mon.maxDy) { mon.maxDy = dy; mon.worst = { from: mon.last.hero, to: s.hero }; }
        }
      }
    }
    mon.last = s;
    return s;
  }
  async function faceToward(x, z) {
    const s = await st();
    await dragTurn(wrap(Math.atan2(-(x - s.player.x), -(z - s.player.z)) - s.cam.yaw), 8);
  }
  async function walkStraight(x, z, { tol = 0.18, timeout = 7000 } = {}) {
    const t0 = Date.now();
    await faceToward(x, z);
    await page.keyboard.down('KeyW');
    let s, lastSteer = 0;
    while (Date.now() - t0 < timeout) {
      await sleep(50);
      s = await sample();
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
  async function goToOnce(x, z, opts = {}) {
    const s0 = await st();
    const path = findPath([s0.player.x, s0.player.z], [x, z]);
    if (!path) { console.log('  no path to', x, z); return st(); }
    for (let k = 1; k < path.length; k++) await walkStraight(path[k][0], path[k][1], { tol: k === path.length - 1 ? (opts.tol ?? 0.15) : 0.25, timeout: opts.timeout ?? 7000 });
    await sleep(250);
    return st();
  }
  async function goTo(x, z, opts = {}) {
    let q = await goToOnce(x, z, opts);
    if (Math.hypot(q.player.x - x, q.player.z - z) > (opts.tol ?? 0.15) + 0.2) q = await goToOnce(x, z, opts);
    return q;
  }
  async function interactAt(id, standX, standZ) {
    await goTo(standX, standZ);
    await sleep(200);
    const s = await st();
    if (s.interact !== id) return { ok: false, s };
    await press('KeyE');
    await sleep(500);
    return { ok: true, s: await st() };
  }
  
  
  return { sleep, st, wrap, dragTurn, press, loadModel, overlaps, penetrating, findPath, sample, faceToward, walkStraight, goTo, interactAt, mon, get model() { return model; }, hAt };
}
