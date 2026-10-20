import * as THREE from 'three';
import { InkRenderer, inkShared, tagOutlines } from './ink.js';
import { createCharacter } from './character.js';
import { playSound } from './sound.js';
import { t as tr, getLang, setLang, onLang } from './i18n.js';

// The shared game: renderer + ink post pass, one player character, the
// third-person controller and camera, collision, HUD, interactions and the
// scene transition. Each place is a scene module (see scenes/) that only
// builds its own geometry, colliders and interactables.
//
// Scene module shape:
//   { id, travelText, hud: { title, sub?, style: 'single'|'card', map: 'minimap'|'compass',
//       objectives: [{ id, text, count? }] },
//     start: { x, z, facing, yaw, pitch }, sun: { dir, extent, follow }, camera: { far, dist },
//     build(ctx) -> { root, colliders, camBlockers, interactables, stars, update(t, dt, ctx),
//                     heightAt?(x, z), viewAt?(x, z), camBounds?, minimap?, monitors? } }

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));
const smooth = (t) => t * t * (3 - 2 * t);
const flat = () => 0;

export async function startGame(SCENES, firstId) {
  await document.fonts.load('100px "Patrick Hand"');
  // the CJK face loads per unicode subset; fetch the common ones up front (bounded wait)
  await Promise.race([document.fonts.load('40px "LXGW WenKai TC"', '台灣九份老街中文設定繼續語言'), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});

  // ---- renderer -------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  document.getElementById('app').appendChild(renderer.domElement);
  const inkR = new InkRenderer(renderer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 100);

  // One key light. Its shadows become hatching.
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  inkShared.uLightI.value = sun.intensity;
  const sunDir = new THREE.Vector3();

  const hero = createCharacter();
  scene.add(hero.root);

  // ---- state ----------------------------------------------------------------
  let def = null;      // current scene module
  let world = null;    // what its build() returned
  let heightAt = flat;
  const player = {
    pos: new THREE.Vector3(),
    y: 0,
    vel: new THREE.Vector3(),
    facing: Math.PI,
    radius: 0.26,
    maxSpeed: 2.3,
  };
  let wishFacing = Math.PI;
  const view = { yaw: 0.0, pitch: 0.4, dist: 2.6, curDist: 2.6, shoulder: 0.36, ahead: 1.2, goal: null, baseDist: 2.6 };
  const camTarget = new THREE.Vector3();
  let freeCam = null;
  let paused = false;
  let traveling = false;
  // occupy state: null, or { it, path, d, dir: 1 (sitting down) / -1 (getting up), settled, exit }
  let occ = null;

  // ---- input ----------------------------------------------------------------
  const keys = new Set();
  // Automated runs (Playwright sets navigator.webdriver) never ask for pointer
  // lock: in headless Chrome it can capture the real OS cursor of whoever is
  // using the machine. Those runs look around with click-drag instead.
  const automated = navigator.webdriver === true;
  const canvas = renderer.domElement;
  const hint = document.getElementById('clickhint');
  let dragging = false;
  const look = (dx, dy) => {
    if (view.goal?.lock && view.goal.t < view.goal.lock) return;
    view.goal = null; // the player takes over from any automatic framing
    view.yaw -= dx * 0.0026 * sensitivity;
    view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.0022 * sensitivity, -0.1, 1.1);
  };
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  window.addEventListener('keydown', (e) => {
    if (e.repeat && (e.code === 'KeyE' || e.code === 'Escape')) return;
    keys.add(e.code);
    if (traveling) return;
    if (e.code === 'Escape') {
      // Esc that just released the mouse was already handled by pointerlockchange
      if (performance.now() - escHandledAt < 400) return;
      if (settingsOpen) closeSettings();
      else if (journalOpen) closeJournal();
      else if (occ && occ.settled) standUp();
      else openSettings();
      return;
    }
    if (settingsOpen) return;
    if (e.code === 'KeyE') onInteract();
    if (MOVE_KEYS.includes(e.code) && occ && occ.settled && !journalOpen) standUp();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', () => {
    if (settingsOpen) return;
    dragging = true;
    if (!automated && document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not available */ }
    }
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (paused) return;
    if (document.pointerLockElement === canvas || dragging) look(e.movementX, e.movementY);
  });
  let hintDismissed = false;
  const updateHint = () => hint.classList.toggle('show', document.pointerLockElement !== canvas && !hintDismissed);
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) hintDismissed = true;
    else if (!releasingMouse && !traveling) {
      // the browser swallows the Esc that releases a captured mouse: treat the release as that Esc
      escHandledAt = performance.now();
      if (journalOpen) closeJournal();
      else if (occ && occ.settled) standUp();
      else if (!settingsOpen) openSettings();
    }
    releasingMouse = false;
    updateHint();
  });
  setTimeout(() => { hintDismissed = true; updateHint(); }, 6000);
  updateHint();

  // ---- settings: language + mouse sensitivity --------------------------------
  const settingsEl = document.getElementById('settings');
  const sensEl = document.getElementById('sens');
  let settingsOpen = false, escHandledAt = -1e9, releasingMouse = false;
  let sensitivity = 1;
  try { const v = parseFloat(localStorage.getItem('doodleworld.sensitivity')); if (v >= 0.4 && v <= 2) sensitivity = v; } catch { /* storage unavailable */ }
  sensEl.value = String(sensitivity);
  sensEl.addEventListener('input', () => {
    sensitivity = parseFloat(sensEl.value);
    try { localStorage.setItem('doodleworld.sensitivity', String(sensitivity)); } catch { /* storage unavailable */ }
  });
  function releaseMouse() {
    if (document.pointerLockElement) { releasingMouse = true; document.exitPointerLock(); }
  }
  function openSettings() {
    settingsOpen = true;
    paused = true;
    dragging = false;
    keys.clear();
    releaseMouse();
    settingsEl.classList.remove('hidden');
    syncLangButtons();
    settingsEl.querySelector('.choice[aria-checked="true"]')?.focus({ preventScroll: true });
  }
  function closeSettings(relock = false) {
    settingsOpen = false;
    paused = journalOpen;
    settingsEl.classList.add('hidden');
    document.activeElement?.blur?.();
    if (relock && !automated && canvas.requestPointerLock) {
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not available */ }
    }
  }
  function syncLangButtons() {
    for (const b of settingsEl.querySelectorAll('.choice')) b.setAttribute('aria-checked', b.dataset.lang === getLang() ? 'true' : 'false');
  }
  for (const b of settingsEl.querySelectorAll('.choice')) {
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { setLang(b.dataset.lang); syncLangButtons(); });
  }
  document.getElementById('resume').addEventListener('click', () => closeSettings(true));
  settingsEl.addEventListener('mousedown', (e) => { if (e.target === settingsEl) closeSettings(); });

  // ---- collisions -----------------------------------------------------------
  function resolve(p, r) {
    for (let iter = 0; iter < 3; iter++) {
      for (const c of world.colliders) {
        if (c.type === 'box') {
          const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
          const cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
          const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              p.x += (dx / d) * (r - d);
              p.z += (dz / d) * (r - d);
            } else {
              // center inside the box: push out along the shallowest side
              const pen = [p.x - c.minX + r, c.maxX - p.x + r, p.z - c.minZ + r, c.maxZ - p.z + r];
              const i = pen.indexOf(Math.min(...pen));
              if (i === 0) p.x = c.minX - r; else if (i === 1) p.x = c.maxX + r; else if (i === 2) p.z = c.minZ - r; else p.z = c.maxZ + r;
            }
          }
        } else {
          const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
          if (d < m && d > 1e-6) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); }
        }
      }
    }
  }
  function overlaps(x, z, r) {
    for (const c of world.colliders) {
      if (c.type === 'box') {
        const cx = THREE.MathUtils.clamp(x, c.minX, c.maxX), cz = THREE.MathUtils.clamp(z, c.minZ, c.maxZ);
        if (Math.hypot(x - cx, z - cz) < r - 0.005) return true;
      } else if (Math.hypot(x - c.x, z - c.z) < c.r + r - 0.005) return true;
    }
    return false;
  }
  // Nearest free floor spot to (x, z), searching outward in rings.
  function freeSpot(x, z) {
    if (!overlaps(x, z, player.radius)) return [x, z];
    for (let r = 0.05; r < 2; r += 0.05) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!overlaps(px, pz, player.radius)) return [px, pz];
      }
    }
    return [def.start.x, def.start.z];
  }

  // ---- camera -----------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), pivot = new THREE.Vector3();
  function updateCamera(dt, snap = false) {
    if (view.goal) {
      const g = view.goal;
      g.t = (g.t ?? 0) + dt;
      view.yaw = dampAngle(view.yaw, g.yaw, g.rate ?? 3.5, dt);
      view.pitch = damp(view.pitch, g.pitch, g.rate ?? 3.5, dt);
    }
    const seated = occ && occ.settled;
    const hint = world.viewAt?.(player.pos.x, player.pos.z);
    const wantDist = view.goal?.dist ?? (seated && occ.it.seat.cam ? occ.it.seat.cam.dist : hint?.dist ?? view.baseDist);
    view.dist = snap ? wantDist : damp(view.dist, wantDist, 2.5, dt);
    view.ahead = damp(view.ahead, seated ? 0 : 1.2, 4, dt);
    const k = snap ? 1 : 1 - Math.exp(-14 * dt);
    camTarget.x += (hero.root.position.x - camTarget.x) * k;
    camTarget.z += (hero.root.position.z - camTarget.z) * k;
    // follow the character's height (stairs, sitting, lying in the loft) gently
    const ty = hero.root.position.y + (hero.pose === 'lie' ? 0.55 : hero.pose === 'sit' ? 0.85 : 1.0);
    camTarget.y += (ty - camTarget.y) * (snap ? 1 : 1 - Math.exp(-6 * dt));
    const right = tmp.set(Math.cos(view.yaw), 0, -Math.sin(view.yaw));
    const dir = tmp2.set(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch));
    const blockers = world.camBlockers;

    const roomFrom = (origin) => {
      ray.set(origin, dir);
      ray.far = view.dist + 0.3;
      const h = ray.intersectObjects(blockers, false);
      return h.length ? Math.max(0.35, h[0].distance - 0.3) : view.dist;
    };

    // keep the shoulder pivot itself out of walls
    ray.set(camTarget, right);
    ray.far = view.shoulder + 0.2;
    const sh = ray.intersectObjects(blockers, false);
    const shoulderMax = sh.length ? Math.max(0, sh[0].distance - 0.2) : view.shoulder;

    // In tight pockets the shoulder offset can trap the camera even when the
    // view straight behind the character is clear: slide back to center then.
    pivot.copy(camTarget).addScaledVector(right, shoulderMax);
    const wantShoulder = roomFrom(camTarget) > roomFrom(pivot) + 0.25 ? 0 : 1;
    view.shoulderK = snap || view.shoulderK === undefined ? wantShoulder : damp(view.shoulderK, wantShoulder, 6, dt);
    pivot.copy(camTarget).addScaledVector(right, shoulderMax * view.shoulderK);

    const allowed = roomFrom(pivot);
    if (snap) view.curDist = allowed;
    else view.curDist = allowed < view.curDist ? damp(view.curDist, allowed, 30, dt) : damp(view.curDist, allowed, 4, dt);

    camera.position.copy(pivot).addScaledVector(dir, view.curDist);
    // when something pulls the camera in, lift it so it looks over the head,
    // then make sure the lift itself didn't push it into geometry
    const lift = Math.max(0, view.dist - view.curDist) * 0.32;
    if (lift > 0.01) {
      camera.position.y += lift;
      const to = camera.position.clone().sub(pivot);
      const len = to.length();
      ray.set(pivot, to.divideScalar(len));
      ray.far = len + 0.25;
      const h2 = ray.intersectObjects(blockers, false);
      if (h2.length && h2[0].distance - 0.25 < len) camera.position.copy(pivot).addScaledVector(ray.ray.direction, Math.max(0.3, h2[0].distance - 0.25));
    }
    const b = world.camBounds;
    if (b) {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, b.minX + 0.12, b.maxX - 0.12);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, b.minZ + 0.12, b.maxZ - 0.12);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.3, b.H - 0.2);
    }
    if (world.heightAt) camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + 0.35);
    const fwd = new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
    camera.lookAt(pivot.x + fwd.x * view.ahead, pivot.y - 0.05 + (view.goal?.lookUp ?? 0), pivot.z + fwd.z * view.ahead);
  }

  // ---- player -------------------------------------------------------------
  const wish = new THREE.Vector3();
  function updatePlayer(dt) {
    wish.set(0, 0, 0);
    if (!paused && !occ && !traveling) {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw);
      const rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw);
      wish.set(fx * f + rx * s, 0, fz * f + rz * s);
      if (wish.lengthSq() > 1) wish.normalize();
      wish.multiplyScalar(player.maxSpeed);
    }
    if (occ) return updateOccupy(dt);
    if (wish.lengthSq() > 0 && !(view.goal?.lock && view.goal.t < view.goal.lock)) view.goal = null;
    const k = wish.lengthSq() > 0 ? 11 : 14;
    player.vel.x = damp(player.vel.x, wish.x, k, dt);
    player.vel.z = damp(player.vel.z, wish.z, k, dt);
    if (player.vel.lengthSq() < 1e-5) player.vel.set(0, 0, 0);
    const before = player.pos.clone();
    player.pos.addScaledVector(player.vel, dt);
    resolve(player.pos, player.radius);
    // never step onto ground that is much higher / lower (ledges, drops):
    // the colliders should prevent it, this is the safety net
    const h0 = heightAt(before.x, before.z);
    if (Math.abs(heightAt(player.pos.x, player.pos.z) - h0) > 0.42) {
      const tryX = Math.abs(heightAt(player.pos.x, before.z) - h0) <= 0.42;
      const tryZ = Math.abs(heightAt(before.x, player.pos.z) - h0) <= 0.42;
      if (tryX) player.pos.z = before.z; else if (tryZ) player.pos.x = before.x; else player.pos.copy(before);
    }
    // velocity follows what actually happened (so sliding along walls feels right)
    if (dt > 0) {
      const actual = player.pos.clone().sub(before).divideScalar(dt);
      player.vel.x = Math.abs(actual.x) < Math.abs(player.vel.x) ? actual.x : player.vel.x;
      player.vel.z = Math.abs(actual.z) < Math.abs(player.vel.z) ? actual.z : player.vel.z;
    }
    player.y = heightAt(player.pos.x, player.pos.z);
    const speed = Math.hypot(player.vel.x, player.vel.z);
    if (wish.lengthSq() > 0.01) {
      wishFacing = Math.atan2(wish.x, wish.z);
      player.facing = dampAngle(player.facing, wishFacing, 10, dt);
    }
    hero.root.position.x = player.pos.x;
    hero.root.position.z = player.pos.z;
    hero.root.rotation.y = player.facing;
    return { speed, ground: heightAt };
  }

  // ---- occupy furniture (sit / lie) -------------------------------------------
  // The character follows a polyline from where they stand to the seat
  // (via the ladder for the loft bed) and back out to a checked free spot.
  function buildPath(pts) {
    const seg = [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) { const l = pts[i - 1].distanceTo(pts[i]); seg.push(l); len += l; }
    return { pts, seg, len };
  }
  function pointOnPath(path, d) {
    let acc = 0;
    for (let i = 0; i < path.seg.length; i++) {
      if (d <= acc + path.seg[i] || i === path.seg.length - 1) {
        const u = path.seg[i] > 0 ? THREE.MathUtils.clamp((d - acc) / path.seg[i], 0, 1) : 1;
        return { p: path.pts[i].clone().lerp(path.pts[i + 1], u), i };
      }
      acc += path.seg[i];
    }
    return { p: path.pts[path.pts.length - 1].clone(), i: path.seg.length - 1 };
  }
  function occupy(it) {
    const s = it.seat;
    const [ex, ez] = freeSpot(...s.exit);
    const pts = [new THREE.Vector3(player.pos.x, heightAt(player.pos.x, player.pos.z), player.pos.z), new THREE.Vector3(ex, heightAt(ex, ez), ez)];
    for (const v of s.via) pts.push(new THREE.Vector3(...v));
    pts.push(new THREE.Vector3(...s.seat));
    occ = { it, path: buildPath(pts), d: 0, dir: 1, settled: false, exit: [ex, ez] };
    player.vel.set(0, 0, 0);
    hero.setBackpack(false);
    playSound('sit');
  }
  function standUp() {
    if (!occ || occ.dir < 0) return;
    const s = occ.it.seat;
    s.onStand?.(ictx);
    // the way out: reverse of the way in, ending at a free floor spot
    const [ex, ez] = freeSpot(...occ.exit);
    const pts = [new THREE.Vector3(...s.seat)];
    for (const v of [...s.via].reverse()) pts.push(new THREE.Vector3(...v));
    pts.push(new THREE.Vector3(ex, heightAt(ex, ez), ez));
    occ = { it: occ.it, path: buildPath(pts), d: 0, dir: -1, settled: false, exit: [ex, ez] };
    hero.setPose('stand');
    view.goal = null;
    captionEl.classList.add('hidden');
    captionTimer = 0;
  }
  function updateOccupy(dt) {
    const s = occ.it.seat;
    const speed = occ.dir > 0 && occ.d > occ.path.len - 0.6 ? 1.3 : 1.9;
    occ.d = Math.min(occ.path.len, occ.d + dt * speed);
    const { p, i } = pointOnPath(occ.path, occ.d);
    const a = occ.path.pts[i], b = occ.path.pts[i + 1];
    const horiz = Math.hypot(b.x - a.x, b.z - a.z);
    const climbing = Math.abs(b.y - a.y) > horiz * 0.8;
    hero.root.position.copy(p);
    // face along the path while walking; face the ladder while climbing
    let want = player.facing;
    if (horiz > 0.05 && !climbing) want = Math.atan2(b.x - a.x, b.z - a.z);
    if (climbing) want = Math.PI;
    const finalLeg = occ.dir > 0 && i === occ.path.seg.length - 1;
    if (finalLeg && occ.d > occ.path.len - 0.35) want = s.facing;
    player.facing = dampAngle(player.facing, want, 10, dt);
    hero.root.rotation.y = player.facing;
    if (occ.d >= occ.path.len) {
      if (occ.dir > 0 && !occ.settled) {
        occ.settled = true;
        hero.setPose(s.pose);
        if (s.cam) view.goal = { yaw: s.cam.yaw, pitch: s.cam.pitch };
        if (s.caption) showCaption(s.caption, 3.5);
        s.onSit?.(ictx);
      } else if (occ.dir < 0) {
        player.pos.set(p.x, 0, p.z);
        resolve(player.pos, player.radius);
        hero.root.position.set(player.pos.x, heightAt(player.pos.x, player.pos.z), player.pos.z);
        hero.resetGround();
        hero.setBackpack(true);
        occ = null;
      }
    }
    const moving = occ && !occ.settled && occ.d < occ.path.len;
    return { speed: moving ? (climbing ? 0.9 : 1.7) : 0, ground: null };
  }

  // ---- HUD: objectives + interactions ---------------------------------------------
  const promptEl = document.getElementById('prompt');
  const promptText = document.getElementById('prompt-text');
  const promptKey = promptEl.querySelector('kbd');
  const captionEl = document.getElementById('caption');
  const journalEl = document.getElementById('journal');
  const objEl = document.getElementById('objective');
  const objList = document.getElementById('obj-list');
  let current = null;
  let journalOpen = false;
  let captionTimer = 0;
  let starsCollected = 0;
  let used = new Set();
  let done = new Set();
  let objEls = {};
  let countEl = null;

  function buildHud() {
    const h = def.hud;
    document.getElementById('obj-title').textContent = tr(h.title);
    document.getElementById('obj-sub').textContent = h.sub ? tr(h.sub) : '';
    objEl.className = h.style ?? 'single';
    objList.innerHTML = '';
    objEls = {};
    countEl = null;
    for (const o of h.objectives) {
      const d = document.createElement('div');
      d.className = 'obj';
      d.id = `obj-${o.id}`;
      if (o.count) {
        d.append(`${tr(o.text)} `);
        const c = document.createElement('span'); c.id = 'star-count'; c.textContent = String(starsCollected);
        const tot = document.createElement('span'); tot.id = 'star-total'; tot.textContent = world.stars.length;
        d.append(c, '/', tot);
        countEl = c;
      } else d.textContent = world.objectiveText?.(o.id, done.has(o.id)) ?? tr(o.text);
      if (done.has(o.id)) d.classList.add('done');
      objList.appendChild(d);
      objEls[o.id] = d;
    }
    document.getElementById('minimap').style.display = '';
  }
  function complete(id) {
    if (done.has(id)) return;
    done.add(id);
    objEls[id]?.classList.add('done');
    if (objEls[id] && !def.hud.objectives.find((o) => o.id === id)?.count) objEls[id].textContent = tr(def.hud.objectives.find((o) => o.id === id).text);
    world.onComplete?.(id, ictx);
  }

  const ictx = {
    caption: (t, s) => showCaption(t, s),
    sound: playSound,
    hero,
    openJournal,
    complete,
    travel: (id) => travel(id),
    frame: (yaw, pitch) => { view.goal = { yaw, pitch }; },
    // slow cinematic pan (the lookout): movement and mouse are held for `lock` seconds
    pan: ({ yaw, pitch, dist, rate = 1.1, lock = 2.5, lookUp = 0 }) => { view.goal = { yaw, pitch, dist, rate, lock, lookUp, t: 0 }; },
    face: (x, z) => { player.facing = Math.atan2(x - player.pos.x, z - player.pos.z); },
    get player() { return player; },
    get camera() { return camera; },
    get view() { return view; },
  };

  function distTo(it) { return Math.hypot(player.pos.x - it.x, player.pos.z - it.z); }
  function findInteractable() {
    let best = null, bd = Infinity;
    for (const it of world.interactables) {
      if (it.star && it.star.collected) continue;
      if (it.enabled && !it.enabled()) continue;
      const d = distTo(it);
      if (d < it.radius && d < bd) {
        // ignore things on another level of the terrain
        if (world.heightAt && Math.abs(heightAt(it.x, it.z) - player.y) > 0.9) continue;
        best = it; bd = d;
      }
    }
    return best;
  }
  function onInteract() {
    if (journalOpen) { closeJournal(); return; }
    if (paused) return;
    if (occ) {
      if (!occ.settled) return;
      const s = occ.it.seat;
      if (s.onUse) { s.onUse(ictx); hero.reach(); } else standUp();
      return;
    }
    if (!current) return;
    used.add(current.id);
    if (current.kind === 'seat') { occupy(current); return; }
    if (current.star) { collectStar(current.star); return; }
    player.facing = Math.atan2(current.pos.x - player.pos.x, current.pos.z - player.pos.z);
    if (!current.noReach) hero.reach();
    current.act(ictx);
  }
  function openJournal() {
    journalOpen = true;
    paused = true;
    journalEl.classList.remove('hidden');
    complete('journal');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function closeJournal() {
    journalOpen = false;
    paused = false;
    journalEl.classList.add('hidden');
  }
  let captionSrc = null;
  function showCaption(text, secs = 4) {
    captionSrc = text;
    captionEl.textContent = tr(text);
    captionEl.classList.remove('hidden');
    captionTimer = secs;
  }
  function collectStar(s) {
    s.collected = true;
    s.anim = 0;
    player.facing = Math.atan2(s.base.x - player.pos.x, s.base.z - player.pos.z);
    hero.pickup();
    playSound('pickup');
    starsCollected++;
    if (s.caption) showCaption(s.caption, 3);
    if (countEl) {
      countEl.textContent = starsCollected;
      countEl.classList.remove('pop');
      void countEl.offsetWidth;
      countEl.classList.add('pop');
    }
    s.onCollect?.(ictx);
    if (starsCollected === world.stars.length) complete('stars');
  }

  // ---- minimap (room) / compass (outdoors) ---------------------------------------------
  const mm = document.getElementById('minimap-canvas');
  const mctx = mm.getContext('2d');
  function drawMinimap() {
    const S = 240, c = S / 2;
    const info = world.minimap;
    mctx.clearRect(0, 0, S, S);
    mctx.save();
    mctx.beginPath(); mctx.arc(c, c, 112, 0, Math.PI * 2);
    mctx.fillStyle = 'rgba(28,26,24,0.9)'; mctx.fill();
    mctx.lineWidth = 3; mctx.strokeStyle = '#f3eee3'; mctx.stroke();
    mctx.clip();
    const sc = info.scale;
    const X = (x) => c + (x + info.ox) * sc, Y = (z) => c + (z + info.oz) * sc;
    mctx.strokeStyle = '#f3eee3';
    mctx.lineWidth = 2.5;
    mctx.lineJoin = 'round';
    mctx.beginPath();
    info.outline.forEach(([x, z], i) => (i ? mctx.lineTo(X(x), Y(z)) : mctx.moveTo(X(x), Y(z))));
    mctx.closePath();
    mctx.stroke();
    mctx.lineWidth = 1.5;
    mctx.globalAlpha = 0.7;
    for (const col of world.colliders) {
      if (col.type === 'box') {
        if (col.maxX - col.minX > 5 || col.maxZ - col.minZ > 5) continue;
        mctx.strokeRect(X(col.minX), Y(col.minZ), (col.maxX - col.minX) * sc, (col.maxZ - col.minZ) * sc);
      } else if (col.r > 0.15) {
        mctx.beginPath(); mctx.arc(X(col.x), Y(col.z), col.r * sc, 0, Math.PI * 2); mctx.stroke();
      }
    }
    mctx.globalAlpha = 1;
    mctx.fillStyle = '#f3eee3';
    mctx.font = '18px "Patrick Hand"';
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    for (const s of world.stars) if (!s.collected) mctx.fillText('☆', X(s.base.x), Y(s.base.z));
    mctx.translate(X(hero.root.position.x), Y(hero.root.position.z));
    mctx.rotate(-player.facing + Math.PI);
    mctx.beginPath();
    mctx.moveTo(0, -11); mctx.lineTo(8, 8); mctx.lineTo(0, 3); mctx.lineTo(-8, 8); mctx.closePath();
    mctx.fill();
    mctx.restore();
    mctx.fillStyle = '#f3eee3';
    mctx.font = '20px "Patrick Hand", "LXGW WenKai TC"';
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    mctx.fillText(tr('N'), c, 16); mctx.fillText(tr('S'), c, S - 15); mctx.fillText(tr('W'), 15, c); mctx.fillText(tr('E'), S - 15, c);
  }
  // Compass: the dial turns with the camera; the needle always points north (-z).
  function drawCompass() {
    const S = 240, c = S / 2;
    mctx.clearRect(0, 0, S, S);
    mctx.save();
    mctx.beginPath(); mctx.arc(c, c, 112, 0, Math.PI * 2);
    mctx.fillStyle = 'rgba(28,26,24,0.9)'; mctx.fill();
    mctx.lineWidth = 3; mctx.strokeStyle = '#f3eee3'; mctx.stroke();
    mctx.beginPath(); mctx.arc(c, c, 92, 0, Math.PI * 2);
    mctx.lineWidth = 1.5; mctx.globalAlpha = 0.5; mctx.stroke(); mctx.globalAlpha = 1;
    mctx.translate(c, c);
    mctx.rotate(view.yaw);
    mctx.strokeStyle = '#f3eee3';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r0 = i % 4 ? 84 : 76;
      mctx.lineWidth = i % 4 ? 1.5 : 2.5;
      mctx.beginPath(); mctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); mctx.lineTo(Math.sin(a) * 92, -Math.cos(a) * 92); mctx.stroke();
    }
    mctx.fillStyle = '#f3eee3';
    mctx.font = '24px "Patrick Hand", "LXGW WenKai TC"';
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    for (const [l, a] of [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]]) {
      mctx.save(); mctx.translate(Math.sin(a) * 58, -Math.cos(a) * 58); mctx.rotate(-view.yaw); mctx.fillText(tr(l), 0, 0); mctx.restore();
    }
    // north needle
    mctx.beginPath(); mctx.moveTo(0, -46); mctx.lineTo(9, 0); mctx.lineTo(0, 6); mctx.lineTo(-9, 0); mctx.closePath(); mctx.fill();
    mctx.beginPath(); mctx.moveTo(0, 46); mctx.lineTo(9, 0); mctx.lineTo(-9, 0); mctx.closePath();
    mctx.lineWidth = 2; mctx.stroke();
    mctx.restore();
    // heading marker
    mctx.fillStyle = '#f3eee3';
    mctx.beginPath(); mctx.moveTo(c, 4); mctx.lineTo(c + 7, 16); mctx.lineTo(c - 7, 16); mctx.closePath(); mctx.fill();
  }

  // ---- scenes: load / unload / travel ---------------------------------------------------
  function disposeTree(root) {
    const mats = new Set();
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
    });
    for (const m of mats) {
      const tex = m.userData.ink?.uMap?.value ?? m.uniforms?.uMap?.value;
      tex?.dispose?.();
      m.map?.dispose?.();
      m.dispose();
    }
  }
  function unloadScene() {
    if (!world) return;
    world.dispose?.();
    scene.remove(world.root);
    for (const extra of world.extraRoots ?? []) scene.remove(extra);
    disposeTree(world.root);
    for (const extra of world.extraRoots ?? []) disposeTree(extra);
    renderer.renderLists.dispose();
    world = null;
  }
  function loadScene(id) {
    unloadScene();
    def = SCENES[id];
    if (!def) throw new Error(`unknown scene ${id}`);
    world = def.build(scene, ictx);
    heightAt = world.heightAt ?? flat;
    tagOutlines(scene);
    // light + camera setup for this scene
    sunDir.set(...def.sun.dir).normalize();
    const ext = def.sun.extent;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: def.sun.far ?? 45 });
    sun.shadow.camera.updateProjectionMatrix();
    placeSun(true);
    inkShared.uGrazeFix.value = def.render?.grazeFix ?? 0;
    inkR.setAerial(def.render?.aerial);
    camera.far = def.camera?.far ?? 100;
    camera.updateProjectionMatrix();
    view.baseDist = def.camera?.dist ?? 2.6;
    // player at the start point
    occ = null;
    paused = false;
    journalOpen = false;
    journalEl.classList.add('hidden');
    starsCollected = 0;
    used = new Set();
    done = new Set();
    hero.setPose('stand');
    hero.setBackpack(true);
    const st = def.start;
    player.pos.set(st.x, 0, st.z);
    player.vel.set(0, 0, 0);
    player.facing = wishFacing = st.facing ?? Math.PI;
    player.y = heightAt(st.x, st.z);
    hero.root.position.set(st.x, player.y, st.z);
    hero.root.rotation.y = player.facing;
    hero.resetGround();
    hero.update(0, t, { speed: 0, ground: heightAt, snap: true });
    view.yaw = st.yaw ?? 0;
    view.pitch = st.pitch ?? 0.4;
    view.goal = null;
    view.dist = view.baseDist;
    camTarget.set(st.x, player.y + 1, st.z);
    updateCamera(0, true);
    captionEl.classList.add('hidden');
    captionTimer = 0;
    buildHud();
  }
  // Fade to black, show the doodle travel card, swap scenes, fade back in.
  const travelEl = document.getElementById('travel');
  const travelText = document.getElementById('travel-text');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function travel(id, { fast = false } = {}) {
    if (traveling || !SCENES[id]) return;
    traveling = true;
    pendingTravel = id;
    if (settingsOpen) closeSettings();
    if (occ) occ = null;
    keys.clear();
    travelText.textContent = tr(SCENES[id].travelText);
    playSound('whoosh');
    travelEl.classList.remove('off');
    await wait(fast ? 120 : 750);
    travelEl.classList.add('card-on');
    await wait(fast ? 50 : 300);
    const t0 = performance.now();
    loadScene(id);
    // render once while hidden so shaders compile behind the card
    inkR.render(scene, camera);
    const spent = performance.now() - t0;
    await wait(Math.max(0, (fast ? 100 : 1500) - spent));
    travelEl.classList.remove('card-on');
    await wait(fast ? 50 : 350);
    travelEl.classList.add('off');
    await wait(fast ? 100 : 700);
    traveling = false;
  }

  function placeSun(snap) {
    // Shadow frustum follows the player outdoors, snapped to whole texels so
    // shadow edges (and the hatching that comes from them) don't crawl.
    const c = new THREE.Vector3();
    if (def.sun.follow) {
      const ext = def.sun.extent, texel = (ext * 2) / sun.shadow.mapSize.x;
      // snap in light space
      const lz = sunDir.clone().negate();
      const lx = new THREE.Vector3(0, 1, 0).cross(lz).normalize();
      const ly = lz.clone().cross(lx);
      const p = hero.root.position;
      const a = Math.round(p.dot(lx) / texel) * texel, b = Math.round(p.dot(ly) / texel) * texel, d = p.dot(lz);
      c.copy(lx).multiplyScalar(a).addScaledVector(ly, b).addScaledVector(lz, d);
    }
    sun.target.position.copy(c);
    sun.position.copy(c).addScaledVector(sunDir, 20);
    sun.target.updateMatrixWorld();
    void snap;
  }

  // ---- language: static HTML text, and re-render everything on a switch -------------
  function applyStaticText() {
    for (const el of document.querySelectorAll('[data-i18n]')) {
      const key = el.dataset.i18n;
      if (el.dataset.i18nKey) {
        // "press {key} to close": keep the key cap as a <kbd>
        const [a, b] = tr(key).split('{key}');
        const k = document.createElement('kbd');
        k.textContent = el.dataset.i18nKey;
        el.replaceChildren(a ?? '', k, b ?? '');
      } else el.textContent = tr(key);
    }
    document.title = 'Doodle World';
  }
  applyStaticText();
  onLang(() => {
    applyStaticText();
    buildHud();
    if (captionSrc) captionEl.textContent = tr(captionSrc);
    if (traveling && pendingTravel) travelText.textContent = tr(SCENES[pendingTravel].travelText);
  });
  let pendingTravel = null;

  // ---- resize -------------------------------------------------------------------
  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    inkR.setSize(s.x, s.y);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  onResize();

  // ---- loop -----------------------------------------------------------------------
  const timer = new THREE.Timer();
  let t = 0;
  let fpsAcc = 0, fpsN = 0, fps = 0;
  let maxFrameDy = 0, lastHeroY = null;
  const projected = new THREE.Vector3();
  loadScene(firstId);

  function placePrompt(worldPos, label, key) {
    projected.copy(worldPos).project(camera);
    const vis = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
    const px = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const py = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    if (promptText.textContent !== label) promptText.textContent = label;
    promptKey.textContent = key;
    // keep the whole prompt on screen, whatever the length of the label
    const half = promptEl.offsetWidth / 2 + 10, h = promptEl.offsetHeight;
    promptEl.style.left = `${THREE.MathUtils.clamp(px, half, Math.max(half, window.innerWidth - half))}px`;
    promptEl.style.top = `${THREE.MathUtils.clamp(vis ? py : window.innerHeight * 0.7, h + 10, window.innerHeight - 10)}px`;
    promptEl.classList.remove('hidden');
  }

  function frame(now) {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    t += dt;
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

    const mv = updatePlayer(dt);
    const yBefore = hero.root.position.y;
    const turn = occ ? 0 : wrapAngle(wishFacing - player.facing) * (Math.hypot(player.vel.x, player.vel.z) > 0.1 ? 1 : 0);
    hero.update(dt, t, { speed: mv.speed, maxSpeed: player.maxSpeed, ground: mv.ground, turn });
    // per-frame vertical jump of the body (stairs should never pop)
    if (!occ && !traveling && lastHeroY !== null && dt > 0) maxFrameDy = Math.max(maxFrameDy, Math.abs(hero.root.position.y - yBefore) / dt);
    lastHeroY = hero.root.position.y;
    world.update(t, dt, ictx);
    for (const it of world.interactables) it.autoClose?.(player.pos.x, player.pos.z);

    // collectibles: idle spin/bob, pickup = rise, spin up, pop
    for (const s of world.stars) {
      const m = s.mesh;
      if (!s.collected) {
        if (s.spin !== false) m.rotation.y = t * 1.6;
        m.position.y = s.base.y + Math.sin(t * 2.2 + s.base.x) * (s.bob ?? 0.05);
      } else if (s.anim >= 0) {
        s.anim += dt;
        const a = Math.min(s.anim / 0.7, 1);
        m.rotation.y += dt * (8 + a * 20);
        m.position.y = s.base.y + smooth(a) * 0.7;
        m.scale.setScalar(a < 0.35 ? 1 + a * 1.4 : Math.max(0, 1.5 * (1 - (a - 0.35) / 0.65)));
        if (a >= 1) { m.visible = false; s.anim = -1; }
      }
    }

    if (freeCam) {
      camera.position.copy(freeCam.pos);
      camera.lookAt(freeCam.target);
    } else {
      updateCamera(dt);
    }
    if (def.sun.follow) placeSun(false);

    // prompt: nearest interactable, or the "get up" hint while seated
    current = paused || occ || traveling ? null : findInteractable();
    if (occ && occ.settled && !paused) {
      const s = occ.it.seat;
      const p = hero.root.position.clone();
      p.y += s.pose === 'lie' ? 0.6 : 1.25;
      placePrompt(p, s.onUse ? `${tr(s.useLabel)}  ·  ${tr('Esc to get up')}` : tr(s.pose === 'lie' ? 'Get up' : 'Stand up'), 'E');
    } else if (current) {
      placePrompt(current.pos, tr(current.label), 'E');
    } else {
      promptEl.classList.add('hidden');
    }
    if (captionTimer > 0) {
      captionTimer -= dt;
      if (captionTimer <= 0) captionEl.classList.add('hidden');
    }

    if (def.hud.map === 'compass') drawCompass(); else drawMinimap();
    inkR.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- debug / test hooks ------------------------------------------------------------
  window.__dw = {
    ready: true,
    state: () => ({
      scene: def.id,
      traveling,
      player: { x: +player.pos.x.toFixed(3), z: +player.pos.z.toFixed(3), y: +player.y.toFixed(3), facing: +player.facing.toFixed(3), speed: +Math.hypot(player.vel.x, player.vel.z).toFixed(3) },
      hero: { x: +hero.root.position.x.toFixed(3), y: +hero.root.position.y.toFixed(3), z: +hero.root.position.z.toFixed(3), pose: hero.pose },
      cam: { x: +camera.position.x.toFixed(3), y: +camera.position.y.toFixed(3), z: +camera.position.z.toFixed(3), yaw: +view.yaw.toFixed(3), pitch: +view.pitch.toFixed(3), dist: +view.curDist.toFixed(3) },
      interact: current ? current.id : null,
      occupied: occ ? { id: occ.it.id, settled: occ.settled, dir: occ.dir } : null,
      stars: starsCollected,
      starTotal: world.stars.length,
      journalOpen,
      caption: captionTimer > 0 ? captionEl.textContent : null,
      monitorsOn: world.monitors?.on ?? null,
      fps: Math.round(fps),
      bob: +hero.bounce.toFixed(4),
      hair: +hero.hairOffset.toFixed(4),
      explore: world.explored?.() ?? null,
      done: [...done],
      used: [...used],
      ground: +heightAt(player.pos.x, player.pos.z).toFixed(3),
      maxVy: +maxFrameDy.toFixed(3),
    }),
    setPlayer(x, z, facing) { occ = null; hero.setPose('stand'); hero.setBackpack(true); player.pos.set(x, 0, z); player.vel.set(0, 0, 0); if (facing !== undefined) player.facing = wishFacing = facing; player.y = heightAt(x, z); hero.root.position.set(x, player.y, z); hero.root.rotation.y = player.facing; hero.resetGround(); hero.update(0, t, { speed: 0, ground: heightAt, snap: true }); updateCamera(0, true); },
    setView(yaw, pitch, dist) { view.yaw = yaw; if (pitch !== undefined) view.pitch = pitch; if (dist !== undefined) view.baseDist = view.dist = dist; updateCamera(0, true); },
    look,
    resetMaxDy() { maxFrameDy = 0; },
    // scene load for the perf script: meshes (x2 passes = draw calls) and triangles
    renderInfo() {
      let meshes = 0, tris = 0;
      scene.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
      return { meshes, tris: Math.round(tris) };
    },
    freeCam(p, tg) { freeCam = p ? { pos: new THREE.Vector3(...p), target: new THREE.Vector3(...tg) } : null; if (!p) updateCamera(0, true); },
    hud(on) { document.getElementById('hud').style.display = on ? '' : 'none'; },
    interactables: () => world.interactables.map((i) => ({ id: i.id, label: i.label, x: i.x, z: i.z, r: i.radius, kind: i.kind, y: heightAt(i.x, i.z), stand: i.star ? i.star.stand : null, collected: i.star ? i.star.collected : undefined })),
    get colliders() { return world.colliders; },
    heightAt: (x, z) => heightAt(x, z),
    travel: (id, fast) => travel(id, { fast }),
    loadScene,
    scenes: () => Object.keys(SCENES),
    walkable: () => world.walkable ?? null,
    sceneDebug: () => world.debug?.() ?? null,
    settingsOpen: () => settingsOpen,
    setLang,
    getLang,
    // every label / caption reachable in the current scene (for the i18n check)
    collectStrings() {
      const out = new Set();
      const fake = {
        caption: (x) => out.add(x), sound() {}, hero: { reach() {}, pickup() {} }, openJournal() {}, complete() {}, travel() {},
        frame() {}, pan() {}, face() {}, player, camera, view,
      };
      for (const o of def.hud.objectives) out.add(o.text);
      out.add(def.hud.title); if (def.hud.sub) out.add(def.hud.sub);
      out.add(def.travelText);
      for (const s of world.strings ?? []) out.add(s);
      for (const it of world.interactables) {
        out.add(it.label);
        if (it.star?.caption) out.add(it.star.caption);
        if (it.seat) { if (it.seat.caption) out.add(it.seat.caption); if (it.seat.useLabel) out.add(it.seat.useLabel); for (let i = 0; i < 6; i++) it.seat.onUse?.(fake); }
        if (it.act && !it.star) for (let i = 0; i < 6; i++) { it.act(fake); out.add(it.label); }
      }
      return [...out].filter(Boolean);
    },
  };
}
