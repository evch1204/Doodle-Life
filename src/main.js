import * as THREE from 'three';
import '@fontsource/patrick-hand';
import './style.css';
import { InkRenderer, inkShared, tagOutlines } from './ink.js';
import { buildRoom, ROOM, OUTLINE } from './room.js';
import { createCharacter } from './character.js';
import { playSound } from './sound.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));
const smooth = (t) => t * t * (3 - 2 * t);

async function start() {
  await document.fonts.load('100px "Patrick Hand"');

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

  // One key light from the upper front-left. Its shadows become hatching.
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const sunDir = new THREE.Vector3(-0.3, 2.2, 1.0).normalize();
  sun.position.copy(sunDir).multiplyScalar(20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 45 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  inkShared.uLightI.value = sun.intensity;

  const room = buildRoom(scene);
  const hero = createCharacter();
  scene.add(hero.root);
  tagOutlines(scene);

  // ---- state ----------------------------------------------------------------
  const START = { x: -0.3, z: 1.4 };
  const player = {
    pos: new THREE.Vector3(START.x, 0, START.z),
    y: 0,
    vel: new THREE.Vector3(),
    facing: Math.PI,
    radius: 0.26,
    maxSpeed: 2.3,
  };
  const view = { yaw: 0.0, pitch: 0.4, dist: 2.6, curDist: 2.6, shoulder: 0.36, ahead: 1.2, goal: null };
  const BASE_DIST = 2.6;
  const camTarget = new THREE.Vector3(player.pos.x, 1.0, player.pos.z);
  let freeCam = null;
  let paused = false;

  // occupy state: null, or { it, path, t, len, dir: 1 (sitting down) / -1 (getting up), settled }
  let occ = null;

  // ---- input ----------------------------------------------------------------
  const keys = new Set();
  const canvas = renderer.domElement;
  const hint = document.getElementById('clickhint');
  let dragging = false;
  const look = (dx, dy) => {
    view.goal = null; // the player takes over from any automatic framing
    view.yaw -= dx * 0.0026;
    view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.0022, -0.1, 1.1);
  };
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  window.addEventListener('keydown', (e) => {
    if (e.repeat && (e.code === 'KeyE' || e.code === 'Escape')) return;
    keys.add(e.code);
    if (e.code === 'KeyE') onInteract();
    if (e.code === 'Escape') {
      if (journalOpen) closeJournal();
      else if (occ && occ.settled) standUp();
    }
    if (MOVE_KEYS.includes(e.code) && occ && occ.settled && !journalOpen) standUp();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', () => {
    dragging = true;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
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
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas) hintDismissed = true; updateHint(); });
  setTimeout(() => { hintDismissed = true; updateHint(); }, 6000);
  updateHint();

  // ---- collisions -----------------------------------------------------------
  function resolve(p, r) {
    for (let iter = 0; iter < 3; iter++) {
      for (const c of room.colliders) {
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
    for (const c of room.colliders) {
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
    return [START.x, START.z];
  }

  // ---- camera -----------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), pivot = new THREE.Vector3();
  function updateCamera(dt, snap = false) {
    if (view.goal) {
      view.yaw = dampAngle(view.yaw, view.goal.yaw, 3.5, dt);
      view.pitch = damp(view.pitch, view.goal.pitch, 3.5, dt);
    }
    const seated = occ && occ.settled;
    view.dist = damp(view.dist, seated && occ.it.seat.cam ? occ.it.seat.cam.dist : BASE_DIST, 3, dt);
    view.ahead = damp(view.ahead, seated ? 0 : 1.2, 4, dt);
    const k = snap ? 1 : 1 - Math.exp(-14 * dt);
    camTarget.x += (hero.root.position.x - camTarget.x) * k;
    camTarget.z += (hero.root.position.z - camTarget.z) * k;
    // follow the character's height (sitting, lying in the loft) gently
    const ty = hero.root.position.y + (hero.pose === 'lie' ? 0.55 : hero.pose === 'sit' ? 0.85 : 1.0);
    camTarget.y += (ty - camTarget.y) * (snap ? 1 : 1 - Math.exp(-6 * dt));
    const right = tmp.set(Math.cos(view.yaw), 0, -Math.sin(view.yaw));
    const dir = tmp2.set(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch));

    const roomFrom = (origin) => {
      ray.set(origin, dir);
      ray.far = view.dist + 0.3;
      const h = ray.intersectObjects(room.camBlockers, false);
      return h.length ? Math.max(0.35, h[0].distance - 0.3) : view.dist;
    };

    // keep the shoulder pivot itself out of walls
    ray.set(camTarget, right);
    ray.far = view.shoulder + 0.2;
    const sh = ray.intersectObjects(room.camBlockers, false);
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
      const h2 = ray.intersectObjects(room.camBlockers, false);
      if (h2.length && h2[0].distance - 0.25 < len) camera.position.copy(pivot).addScaledVector(ray.ray.direction, Math.max(0.3, h2[0].distance - 0.25));
    }
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, ROOM.minX + 0.12, ROOM.maxX - 0.12);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, ROOM.minZ + 0.12, ROOM.maxZ - 0.12);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.3, ROOM.H - 0.2);
    const fwd = new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
    camera.lookAt(pivot.x + fwd.x * view.ahead, pivot.y - 0.05, pivot.z + fwd.z * view.ahead);
  }

  // ---- player -------------------------------------------------------------
  const wish = new THREE.Vector3();
  function updatePlayer(dt) {
    wish.set(0, 0, 0);
    if (!paused && !occ) {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw);
      const rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw);
      wish.set(fx * f + rx * s, 0, fz * f + rz * s);
      if (wish.lengthSq() > 1) wish.normalize();
      wish.multiplyScalar(player.maxSpeed);
    }
    if (occ) return updateOccupy(dt);
    if (wish.lengthSq() > 0) view.goal = null;
    const k = wish.lengthSq() > 0 ? 11 : 14;
    player.vel.x = damp(player.vel.x, wish.x, k, dt);
    player.vel.z = damp(player.vel.z, wish.z, k, dt);
    if (player.vel.lengthSq() < 1e-5) player.vel.set(0, 0, 0);
    const before = player.pos.clone();
    player.pos.addScaledVector(player.vel, dt);
    resolve(player.pos, player.radius);
    // velocity follows what actually happened (so sliding along walls feels right)
    if (dt > 0) {
      const actual = player.pos.clone().sub(before).divideScalar(dt);
      player.vel.x = Math.abs(actual.x) < Math.abs(player.vel.x) ? actual.x : player.vel.x;
      player.vel.z = Math.abs(actual.z) < Math.abs(player.vel.z) ? actual.z : player.vel.z;
    }
    const speed = Math.hypot(player.vel.x, player.vel.z);
    if (wish.lengthSq() > 0.01) player.facing = dampAngle(player.facing, Math.atan2(wish.x, wish.z), 12, dt);
    hero.root.position.set(player.pos.x, 0, player.pos.z);
    hero.root.rotation.y = player.facing;
    return speed / player.maxSpeed;
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
    const pts = [new THREE.Vector3(player.pos.x, 0, player.pos.z), new THREE.Vector3(ex, 0, ez)];
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
    pts.push(new THREE.Vector3(ex, 0, ez));
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
        hero.root.position.set(player.pos.x, 0, player.pos.z);
        hero.setBackpack(true);
        occ = null;
      }
    }
    const moving = occ && !occ.settled && occ.d < occ.path.len;
    return moving ? (climbing ? 0.4 : 0.75) : 0;
  }

  // ---- interactions ------------------------------------------------------------
  const promptEl = document.getElementById('prompt');
  const promptText = document.getElementById('prompt-text');
  const promptKey = promptEl.querySelector('kbd');
  const captionEl = document.getElementById('caption');
  const journalEl = document.getElementById('journal');
  const starCountEl = document.getElementById('star-count');
  let current = null;
  let journalOpen = false;
  let captionTimer = 0;
  let starsCollected = 0;
  const used = new Set();
  document.getElementById('star-total').textContent = room.stars.length;

  const ictx = {
    caption: (t, s) => showCaption(t, s),
    sound: playSound,
    hero,
    openJournal,
    frame: (yaw, pitch) => { view.goal = { yaw, pitch }; },
  };

  function distTo(it) { return Math.hypot(player.pos.x - it.x, player.pos.z - it.z); }
  function findInteractable() {
    let best = null, bd = Infinity;
    for (const it of room.interactables) {
      if (it.star && it.star.collected) continue;
      const d = distTo(it);
      if (d < it.radius && d < bd) { best = it; bd = d; }
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
    hero.reach();
    current.act(ictx);
  }
  function openJournal() {
    journalOpen = true;
    paused = true;
    journalEl.classList.remove('hidden');
    document.getElementById('obj-journal').classList.add('done');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function closeJournal() {
    journalOpen = false;
    paused = false;
    journalEl.classList.add('hidden');
  }
  function showCaption(text, secs = 4) {
    captionEl.textContent = text;
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
    starCountEl.textContent = starsCollected;
    starCountEl.classList.remove('pop');
    void starCountEl.offsetWidth;
    starCountEl.classList.add('pop');
    if (starsCollected === room.stars.length) document.getElementById('obj-stars').classList.add('done');
  }

  // explore objective: visit the main areas of the room
  const zones = [[-3.2, -1.5], [-0.7, -3.6], [2.4, -2.6], [3.6, -0.6], [2.5, 3.2], [-3.4, 2.6]];
  const visited = new Set();

  // ---- minimap ----------------------------------------------------------------
  const mm = document.getElementById('minimap-canvas');
  const mctx = mm.getContext('2d');
  function drawMinimap() {
    const S = 240, c = S / 2;
    mctx.clearRect(0, 0, S, S);
    mctx.save();
    mctx.beginPath(); mctx.arc(c, c, 112, 0, Math.PI * 2);
    mctx.fillStyle = 'rgba(28,26,24,0.9)'; mctx.fill();
    mctx.lineWidth = 3; mctx.strokeStyle = '#f3eee3'; mctx.stroke();
    mctx.clip();
    const sc = 17;
    const X = (x) => c + x * sc, Y = (z) => c + (z + 0.4) * sc;
    mctx.strokeStyle = '#f3eee3';
    mctx.lineWidth = 2.5;
    mctx.lineJoin = 'round';
    mctx.beginPath();
    OUTLINE.forEach(([x, z], i) => (i ? mctx.lineTo(X(x), Y(z)) : mctx.moveTo(X(x), Y(z))));
    mctx.closePath();
    mctx.stroke();
    mctx.lineWidth = 1.5;
    mctx.globalAlpha = 0.7;
    for (const col of room.colliders) {
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
    for (const s of room.stars) if (!s.collected) mctx.fillText('☆', X(s.base.x), Y(s.base.z));
    mctx.translate(X(hero.root.position.x), Y(hero.root.position.z));
    mctx.rotate(-player.facing + Math.PI);
    mctx.beginPath();
    mctx.moveTo(0, -11); mctx.lineTo(8, 8); mctx.lineTo(0, 3); mctx.lineTo(-8, 8); mctx.closePath();
    mctx.fill();
    mctx.restore();
    mctx.fillStyle = '#f3eee3';
    mctx.font = '20px "Patrick Hand"';
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    mctx.fillText('N', c, 16); mctx.fillText('S', c, S - 15); mctx.fillText('W', 15, c); mctx.fillText('E', S - 15, c);
  }

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
  const projected = new THREE.Vector3();
  hero.root.position.set(player.pos.x, 0, player.pos.z);
  hero.root.rotation.y = player.facing;
  updateCamera(0, true);

  function placePrompt(worldPos, label, key) {
    projected.copy(worldPos).project(camera);
    const vis = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
    const px = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const py = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    promptEl.style.left = `${THREE.MathUtils.clamp(px, 120, window.innerWidth - 120)}px`;
    promptEl.style.top = `${THREE.MathUtils.clamp(vis ? py : window.innerHeight * 0.7, 60, window.innerHeight - 40)}px`;
    promptText.textContent = label;
    promptKey.textContent = key;
    promptEl.classList.remove('hidden');
  }

  function frame(now) {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    t += dt;
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

    const speed01 = updatePlayer(dt);
    hero.update(dt, t, speed01);
    room.update(t, dt);
    for (const it of room.interactables) it.autoClose?.(player.pos.x, player.pos.z);

    // stars: idle spin/bob, pickup = rise, spin up, pop
    for (const s of room.stars) {
      const m = s.mesh;
      if (!s.collected) {
        m.rotation.y = t * 1.6;
        m.position.y = s.base.y + Math.sin(t * 2.2 + s.base.x) * 0.05;
      } else if (s.anim >= 0) {
        s.anim += dt;
        const a = Math.min(s.anim / 0.7, 1);
        m.rotation.y += dt * (8 + a * 20);
        m.position.y = s.base.y + smooth(a) * 0.7;
        m.scale.setScalar(a < 0.35 ? 1 + a * 1.4 : Math.max(0, 1.5 * (1 - (a - 0.35) / 0.65)));
        if (a >= 1) { m.visible = false; s.anim = -1; }
      }
    }

    for (let i = 0; i < zones.length; i++) {
      if (Math.hypot(player.pos.x - zones[i][0], player.pos.z - zones[i][1]) < 1.3) visited.add(i);
    }
    if (visited.size >= 5) document.getElementById('obj-explore').classList.add('done');

    if (freeCam) {
      camera.position.copy(freeCam.pos);
      camera.lookAt(freeCam.target);
    } else {
      updateCamera(dt);
    }

    // prompt: nearest interactable, or the "get up" hint while seated
    current = paused || occ ? null : findInteractable();
    if (occ && occ.settled && !paused) {
      const s = occ.it.seat;
      const p = hero.root.position.clone();
      p.y += s.pose === 'lie' ? 0.6 : 1.25;
      placePrompt(p, s.onUse ? `${s.useLabel}  ·  Esc to get up` : (s.pose === 'lie' ? 'Get up' : 'Stand up'), 'E');
    } else if (current) {
      placePrompt(current.pos, current.label, 'E');
    } else {
      promptEl.classList.add('hidden');
    }
    if (captionTimer > 0) {
      captionTimer -= dt;
      if (captionTimer <= 0) captionEl.classList.add('hidden');
    }

    drawMinimap();
    inkR.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- debug / test hooks ------------------------------------------------------------
  window.__dw = {
    ready: true,
    state: () => ({
      player: { x: +player.pos.x.toFixed(3), z: +player.pos.z.toFixed(3), facing: +player.facing.toFixed(3), speed: +Math.hypot(player.vel.x, player.vel.z).toFixed(3) },
      hero: { x: +hero.root.position.x.toFixed(3), y: +hero.root.position.y.toFixed(3), z: +hero.root.position.z.toFixed(3), pose: hero.pose },
      cam: { x: +camera.position.x.toFixed(3), y: +camera.position.y.toFixed(3), z: +camera.position.z.toFixed(3), yaw: +view.yaw.toFixed(3), pitch: +view.pitch.toFixed(3), dist: +view.curDist.toFixed(3) },
      interact: current ? current.id : null,
      occupied: occ ? { id: occ.it.id, settled: occ.settled, dir: occ.dir } : null,
      stars: starsCollected,
      journalOpen,
      caption: captionTimer > 0 ? captionEl.textContent : null,
      monitorsOn: room.monitors.on,
      fps: Math.round(fps),
      bob: hero.root.children[0].position.y,
      explore: visited.size,
      used: [...used],
    }),
    setPlayer(x, z, facing) { occ = null; hero.setPose('stand'); hero.setBackpack(true); player.pos.set(x, 0, z); player.vel.set(0, 0, 0); if (facing !== undefined) player.facing = facing; hero.root.position.set(x, 0, z); hero.root.rotation.y = player.facing; updateCamera(0, true); },
    setView(yaw, pitch, dist) { view.yaw = yaw; if (pitch !== undefined) view.pitch = pitch; if (dist !== undefined) view.dist = dist; updateCamera(0, true); },
    look,
    freeCam(p, tg) { freeCam = p ? { pos: new THREE.Vector3(...p), target: new THREE.Vector3(...tg) } : null; if (!p) updateCamera(0, true); },
    hud(on) { document.getElementById('hud').style.display = on ? '' : 'none'; },
    interactables: () => room.interactables.map((i) => ({ id: i.id, label: i.label, x: i.x, z: i.z, r: i.radius, kind: i.kind, stand: i.star ? i.star.stand : null, collected: i.star ? i.star.collected : undefined })),
    colliders: room.colliders,
  };
}

start();
