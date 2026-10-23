import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ink, backdropMaterial } from './ink.js';
import * as TX from './textures.js';
import { makeRng } from './sketch.js';

// Room layout (meters). x: left(-) / right(+), z: back(-) / front(+), y: up.
// ~78 m² floor (Milestone 1 was ~128 m²).
//   Left wall x=-4.7, right wall x=4.7, front wall z=4.2, ceiling y=3.6.
//   Stepped back wall like the reference:
//     desk wall      z=-3.4   for x in [-4.7, -2.0]
//     loft alcove    z=-5.0   for x in [-2.0, 0.6]
//     window wall    z=-4.0   for x in [0.6, 4.7]
//   Kitchen along the right wall, dining table in the front-right.
export const ROOM = { minX: -4.7, maxX: 4.7, minZ: -5.0, maxZ: 4.2, H: 3.6 };
export const OUTLINE = [[-4.7, 4.2], [-4.7, -3.4], [-2.0, -3.4], [-2.0, -5.0], [0.6, -5.0], [0.6, -4.0], [4.7, -4.0], [4.7, 4.2]];

export function buildRoom(scene) {
  const rng = makeRng(2024);
  const rand = (a, b) => a + (b - a) * rng();

  const screens = TX.screenSketches();
  const T = {
    floor: TX.floorTexture(), wall: TX.wallTexture(), wood: TX.woodTexture(), ceiling: TX.ceilingTexture(),
    spines: TX.spineTextures(), better: TX.posterBetterDays(), small: TX.posterSmallSteps(), frames: TX.frameTextures(),
    rug: TX.rugTexture(), fridge: TX.fridgeTexture(), mug: TX.mugTexture(), journal: TX.journalTexture(),
    curtain: TX.curtainTexture(), pinboard: TX.pinboardTexture(),
    crates: [TX.crateTexture(1, 'lines'), TX.crateTexture(2, 'smile'), TX.crateTexture(3, 'T'), TX.crateTexture(4, '')],
    keyboard: TX.keyboardTexture(), tiles: TX.tileTexture(), towel: TX.towelTexture(), basket: TX.basketTexture(),
    stickies: [TX.stickyTexture(1), TX.stickyTexture(2), TX.stickyTexture(3)],
    labels: [TX.labelTexture({ en: 'TEA', zh: '茶' }, 5), TX.labelTexture({ en: 'RICE', zh: '米' }, 6), TX.labelTexture({ en: 'SUGAR', zh: '糖' }, 7)],
    cabinet: TX.cabinetTexture(9), cereal: TX.cerealTexture(),
    tea: TX.posterTea(), clock: TX.clockTexture(), calendar: TX.calendarTexture(), mirror: TX.mirrorTexture(),
  };

  const M = {
    paper: ink(),
    paperBack: ink({ side: THREE.BackSide }),
    paper2: ink({ side: THREE.DoubleSide }),
    floor: ink({ map: T.floor, tri: 1 / 2.4, facing: 0 }),
    wall: ink({ map: T.wall, tri: 1 / 3, facing: 0, mapAmt: 0.8 }),
    ceiling: ink({ map: T.ceiling, tri: 1 / 2.4, facing: 0, hatch: 0 }),
    wood: ink({ map: T.wood, tri: 1 / 1.2, mapAmt: 0.8 }),
    beam: ink({ map: T.wood, tri: 1 / 1.2, mapAmt: 0.8, facing: 0.15 }),
    black: ink({ tone: 0.04, hatch: 0 }),
    dark: ink({ tone: 0.2, hatch: 0 }),
    gray: ink({ tone: 0.82 }),
    light: ink({ tone: 0.93 }),
    spines: T.spines.map((t) => ink({ map: t })),
    better: ink({ map: T.better, facing: 0 }),
    small: ink({ map: T.small, facing: 0 }),
    frames: T.frames.map((t) => ink({ map: t, facing: 0 })),
    rug: ink({ map: T.rug, facing: 0 }),
    fridge: ink({ map: T.fridge, facing: 0.3 }),
    mug: ink({ map: T.mug }),
    journal: ink({ map: T.journal, facing: 0.3 }),
    curtain: ink({ map: T.curtain, side: THREE.DoubleSide, facing: 0.6, hatchFreq: 30 }),
    crates: T.crates.map((t) => ink({ map: t })),
    pinboard: ink({ map: T.pinboard, facing: 0 }),
    screenL: ink({ map: screens.land.tex, facing: 0, hatch: 0 }),
    screenP: ink({ map: screens.port.tex, facing: 0, hatch: 0 }),
    keyboard: ink({ map: T.keyboard, facing: 0.3 }),
    tiles: ink({ map: T.tiles, tri: 1 / 0.9, facing: 0, mapAmt: 0.7 }),
    towel: ink({ map: T.towel, side: THREE.DoubleSide, facing: 0.5 }),
    basket: ink({ map: T.basket, repeat: [3, 1] }),
    stickies: T.stickies.map((t) => ink({ map: t, facing: 0, side: THREE.DoubleSide })),
    labels: T.labels.map((t) => ink({ map: t })),
    cabinet: ink({ map: T.cabinet, facing: 0.2 }),
    cereal: ink({ map: T.cereal }),
    lampShade: ink({ tone: 1, facing: 0.4, side: THREE.DoubleSide }),
    tea: ink({ map: T.tea, facing: 0 }),
    clock: ink({ map: T.clock, facing: 0 }),
    calendar: ink({ map: T.calendar, facing: 0 }),
    mirror: ink({ map: T.mirror, tone: 0.97, facing: 0, hatch: 0 }),
  };

  const root = new THREE.Group();
  root.name = 'room';
  scene.add(root);

  const colliders = [];
  const camBlockers = [];
  const interactables = [];
  const updaters = [];

  // ---- helpers ------------------------------------------------------------
  function add(geo, mat, parent = root, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  // Box with its *bottom* at y.
  function box(parent, w, h, d, x, y, z, mat, o = {}) {
    const g = o.r ? new RoundedBoxGeometry(w, h, d, o.seg ?? 3, Math.min(o.r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
    const m = add(g, mat, parent, o);
    m.position.set(x, y + h / 2, z);
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    return m;
  }
  // Box where one face carries a texture (0:+x 1:-x 2:+y 3:-y 4:+z 5:-z).
  function facedBox(parent, w, h, d, x, y, z, base, front, face = 4, o = {}) {
    const mats = [base, base, base, base, base, base];
    mats[face] = front;
    const m = add(new THREE.BoxGeometry(w, h, d), mats, parent, o);
    m.position.set(x, y + h / 2, z);
    if (o.ry) m.rotation.y = o.ry;
    return m;
  }
  function cyl(parent, rt, rb, h, x, y, z, mat, o = {}) {
    const m = add(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 24, 1, o.open ?? false), mat, parent, o);
    m.position.set(x, y + h / 2, z);
    return m;
  }
  function sphere(parent, r, x, y, z, mat, s = [1, 1, 1], o = {}) {
    const m = add(new THREE.SphereGeometry(r, o.seg ?? 24, Math.round((o.seg ?? 24) * 0.75)), mat, parent, o);
    m.position.set(x, y, z);
    m.scale.set(...s);
    return m;
  }
  function group(parent, x, y, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    parent.add(g);
    return g;
  }
  const solid = (x1, x2, z1, z2) => colliders.push({ type: 'box', minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) });
  const solidCircle = (x, z, r) => colliders.push({ type: 'circle', x, z, r });
  // Damped spring helper for little wobble reactions.
  function wobbler(obj, axis = 'z', amp = 0.25) {
    const s = { v: 0, x: 0, base: obj.rotation[axis] };
    updaters.push((t, dt) => {
      s.v += (-s.x * 90 - s.v * 6) * dt;
      s.x += s.v * dt;
      obj.rotation[axis] = s.base + s.x;
    });
    return () => { s.v += amp * 12; };
  }

  // ---- shell ----------------------------------------------------------------
  const shell = { cast: false, receive: true };
  const floor = add(new THREE.PlaneGeometry(9.4, 9.2), M.floor, root, shell);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -0.4);
  camBlockers.push(floor);
  const ceil = add(new THREE.PlaneGeometry(9.4, 9.2), M.ceiling, root, shell);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ROOM.H, -0.4);
  camBlockers.push(ceil);

  function wall(x1, x2, z1, z2, y1 = 0, y2 = ROOM.H) {
    const m = box(root, x2 - x1, y2 - y1, z2 - z1, (x1 + x2) / 2, y1, (z1 + z2) / 2, M.wall, shell);
    camBlockers.push(m);
    return m;
  }
  wall(-4.95, -4.7, -3.65, 4.45);        // left
  wall(4.7, 4.95, -4.25, 4.45);          // right
  wall(-4.95, 4.95, 4.2, 4.45);          // front
  wall(-4.95, -2.0, -3.65, -3.4);        // desk wall
  wall(-2.2, -2.0, -5.2, -3.4);          // alcove left side
  wall(-2.2, 0.8, -5.25, -5.0);          // alcove back
  wall(0.6, 0.8, -5.2, -4.0);            // alcove right side
  wall(0.6, 1.3, -4.25, -4.0);           // pillar left of window
  wall(4.0, 4.95, -4.25, -4.0);          // right of window
  wall(1.3, 4.0, -4.25, -4.0, 0, 0.3);   // under sill
  wall(1.3, 4.0, -4.25, -4.0, 2.65);     // over window

  solid(-6, -4.7, -6, 6); solid(4.7, 6, -6, 6); solid(-6, 6, 4.2, 6);
  solid(-6, -2.0, -6, -3.4);
  solid(-6, 6, -6, -5.0);
  solid(0.6, 6, -6, -4.0);

  // timber: beams, posts, window frame
  for (const z of [-2.6, -0.2, 2.2]) box(root, 9.4, 0.2, 0.2, 0, ROOM.H - 0.2, z, M.beam, { cast: false });
  box(root, 4.1, 0.3, 0.16, 2.65, 2.65, -3.92, M.beam, { cast: false });
  for (const [x, z] of [[1.22, -3.92], [4.08, -3.92], [0.68, -3.92], [-2.08, -3.32]]) {
    box(root, 0.16, ROOM.H, 0.16, x, 0, z, M.wood, { cast: false });
    solidCircle(x, z, 0.11);
  }
  box(root, 2.7, 0.07, 0.3, 2.65, 0.26, -4.04, M.wood, { cast: false });   // sill
  box(root, 0.05, 2.35, 0.25, 1.33, 0.3, -4.12, M.wood, { cast: false });  // jambs
  box(root, 0.05, 2.35, 0.25, 3.97, 0.3, -4.12, M.wood, { cast: false });

  // ---- window view (parallax layers, unlit, not outlined) --------------------
  const skyMats = [];
  for (const [def, tex] of [[TX.SKY, TX.skyTexture()], [TX.MID, TX.midTexture()], [TX.NEAR, TX.nearTexture()]]) {
    const mat = backdropMaterial(tex);
    skyMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.h), mat);
    m.position.set(def.cx, def.cy, def.z + 0.6);
    m.layers.set(1);
    root.add(m);
  }
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), backdropMaterial(white));
  voidPlane.position.set(0, 0, -40);
  voidPlane.layers.set(1);
  root.add(voidPlane);
  updaters.push((t) => { skyMats[0].uniforms.uOffset.value.x = Math.sin(t * 0.02) * 0.012; });

  // ---- reusable props ------------------------------------------------------------
  function plant(parent, x, y, z, s = 1, potMat = M.paper) {
    const p = group(parent, x, y, z);
    p.scale.setScalar(s);
    cyl(p, 0.12, 0.09, 0.2, 0, 0, 0, potMat);
    cyl(p, 0.11, 0.11, 0.01, 0, 0.18, 0, M.dark, { cast: false });
    const leaves = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand(-0.2, 0.2);
      const st = group(p, 0, 0.18, 0, -a);
      st.rotation.z = rand(0.35, 0.9);
      const len = rand(0.16, 0.3);
      cyl(st, 0.006, 0.006, len, 0, 0, 0, M.black, { seg: 5 });
      const leaf = sphere(st, 0.1, 0, len + 0.06, 0, M.paper, [0.65, 1.25, 0.12], { seg: 16 });
      leaf.rotation.y = Math.PI / 2;
      leaves.push(st);
    }
    updaters.push((t) => leaves.forEach((l, i) => { l.rotation.x = Math.sin(t * 0.7 + i * 1.7) * 0.025; }));
    return p;
  }

  function mug(parent, x, y, z, ry = 0, face = true, s = 1) {
    const g = group(parent, x, y, z, ry);
    g.scale.setScalar(s);
    add(new THREE.CylinderGeometry(0.052, 0.048, 0.11, 28, 1, true), face ? M.mug : M.paper, g).position.y = 0.055;
    add(new THREE.CylinderGeometry(0.049, 0.049, 0.1, 28, 1, true), M.paperBack, g).position.y = 0.06;
    cyl(g, 0.048, 0.048, 0.006, 0, 0, 0, M.paper);
    cyl(g, 0.049, 0.049, 0.004, 0, 0.085, 0, M.dark, { cast: false });
    const h = add(new THREE.TorusGeometry(0.03, 0.009, 8, 16, Math.PI * 1.2), M.paper, g);
    h.position.set(-0.055, 0.058, 0);
    h.rotation.z = Math.PI * 0.4;
    return g;
  }

  // Wooden chair, user faces local +z, back at local -z. Seat top 0.46.
  function woodChair(parent, x, z, ry, mat = M.wood, legMat = M.wood) {
    const c = group(parent, x, 0, z, ry);
    box(c, 0.44, 0.04, 0.42, 0, 0.42, 0, mat, { r: 0.008 });
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) box(c, 0.04, lz < 0 ? 0.96 : 0.42, 0.04, lx, 0, lz, legMat);
    box(c, 0.42, 0.08, 0.03, 0, 0.84, -0.18, mat);
    box(c, 0.42, 0.04, 0.03, 0, 0.6, -0.18, mat);
    for (const lx of [-0.07, 0.07]) box(c, 0.05, 0.2, 0.02, lx, 0.64, -0.18, mat);
    box(c, 0.38, 0.03, 0.03, 0, 0.15, 0.18, legMat);
    return c;
  }

  // Seat interactable. `seat` = where the root sits, `exit` = floor spot to
  // stand at, `via` = optional waypoints between them (e.g. the ladder).
  function seatSpot(id, label, { x, z, radius = 1.0, prompt, seat, exit, via = [], pose = 'sit', facing, caption, onSit, onStand, onUse, useLabel, cam }) {
    interactables.push({
      id, label, kind: 'seat', x, z, radius,
      pos: new THREE.Vector3(...prompt),
      seat: { seat, exit, via, pose, facing, caption, onSit, onStand, onUse, useLabel, cam },
    });
  }
  function actionSpot(id, label, { x, z, radius = 1.0, prompt, act }) {
    interactables.push({ id, label, kind: 'action', x, z, radius, pos: new THREE.Vector3(...prompt), act });
  }

  // ===========================================================================
  // LEFT: bookshelf
  // ===========================================================================
  let pullBook = null;
  {
    const W = 2.0, H = 2.5, D = 0.42;
    const g = group(root, -4.7 + D / 2, 0, -2.3, Math.PI / 2);
    box(g, 0.05, H, D, -W / 2 + 0.025, 0, 0, M.wood);
    box(g, 0.05, H, D, W / 2 - 0.025, 0, 0, M.wood);
    box(g, W, 0.05, D, 0, H - 0.05, 0, M.wood);
    box(g, W - 0.1, 0.1, D, 0, 0, 0, M.wood);
    box(g, W - 0.1, H, 0.02, 0, 0, -D / 2 + 0.01, M.paper, { cast: false });
    for (const y of [0.56, 1.02, 1.48, 1.94]) box(g, W - 0.1, 0.04, D - 0.03, 0, y - 0.04, 0, M.wood);
    const books = [];
    const book = (x, y, t, h, d, tilt = 0, dark = false) => {
      const sp = dark ? M.dark : M.spines[Math.floor(rng() * M.spines.length)];
      const m = add(new THREE.BoxGeometry(t, h, d), [M.paper, M.paper, M.paper, M.paper, sp, M.paper], g);
      m.position.set(x, y + h / 2, D / 2 - d / 2 - rand(0.02, 0.05));
      m.rotation.z = tilt;
      if (tilt) m.position.x += Math.sin(-tilt) * h * 0.5;
      books.push(m);
      return m;
    };
    const row = (y, x0, x1, hMax) => {
      let x = x0;
      while (x < x1 - 0.05) {
        const t = rand(0.045, 0.09), h = rand(hMax * 0.72, hMax);
        if (x + t > x1) break;
        book(x + t / 2, y, t, h, rand(0.26, 0.32), 0, rng() < 0.12);
        x += t + rand(0, 0.006);
      }
      return x;
    };
    facedBox(g, 0.6, 0.38, 0.36, -0.55, 0.1, 0.01, M.paper, M.crates[0]);
    facedBox(g, 0.6, 0.38, 0.36, 0.15, 0.1, 0.01, M.paper, M.crates[3]);
    for (let i = 0; i < 3; i++) box(g, 0.3, 0.06, 0.24, 0.72, 0.1 + i * 0.06, 0.03, i === 1 ? M.gray : M.paper, { ry: rand(-0.1, 0.1) });
    row(0.56, -W / 2 + 0.06, W / 2 - 0.06, 0.4);
    const xe = row(1.02, -W / 2 + 0.06, 0.4, 0.4);
    book(xe + 0.12, 1.02, 0.06, 0.34, 0.28, -0.32);
    for (let i = 0; i < 4; i++) box(g, 0.34, 0.055, 0.26, 0.72, 1.02 + i * 0.055, 0.04, i % 2 ? M.paper : M.light, { ry: rand(-0.12, 0.12) });
    row(1.48, -W / 2 + 0.06, -0.1, 0.38);
    facedBox(g, 0.42, 0.3, 0.34, 0.28, 1.48, 0.02, M.paper, M.crates[2]);
    row(1.48, 0.55, W / 2 - 0.06, 0.36);
    facedBox(g, 0.44, 0.32, 0.34, -0.66, 1.94, 0.02, M.paper, M.crates[1]);
    row(1.94, -0.38, 0.12, 0.38);
    facedBox(g, 0.2, 0.25, 0.03, 0.72, 1.94, 0.05, M.paper, M.frames[4], 4, { ry: -0.1 });
    // hanging vine from the top
    cyl(g, 0.11, 0.08, 0.14, W / 2 - 0.16, H, 0.06, M.paper);
    const vineRoot = group(g, W / 2 - 0.12, H + 0.08, D / 2 + 0.02);
    const vines = [];
    for (let v = 0; v < 3; v++) {
      const strand = group(vineRoot, v * 0.06 - 0.06, 0, 0);
      const n = 7 + v * 2;
      for (let i = 0; i < n; i++) {
        const leaf = sphere(strand, 0.05, Math.sin(i * 1.3 + v) * 0.035, -0.12 - i * 0.11, 0.02 * Math.cos(i), M.paper, [0.8, 1.15, 0.35], { seg: 12 });
        leaf.rotation.z = i % 2 ? 0.6 : -0.6;
      }
      cyl(strand, 0.006, 0.006, n * 0.11, 0, -n * 0.11, 0, M.black, { seg: 6 });
      vines.push(strand);
    }
    updaters.push((t) => vines.forEach((s, i) => { s.rotation.x = Math.sin(t * 0.8 + i) * 0.05; s.rotation.z = Math.sin(t * 0.6 + i * 2) * 0.04; }));
    solid(-4.7, -4.27, -3.4, -1.28);

    // the book that gets pulled: a tall one on the eye-level row
    pullBook = books.filter((b) => Math.abs(b.position.y - (1.02 + 0.2)) < 0.12).sort((a, b) => Math.abs(a.position.x + 0.3) - Math.abs(b.position.x + 0.3))[0];
    const base = pullBook.position.z;
    let pullT = 0;
    updaters.push((t, dt) => {
      pullT = Math.max(0, pullT - dt);
      const target = pullT > 0.4 ? 0.14 : 0;
      pullBook.position.z += (base + target - pullBook.position.z) * (1 - Math.exp(-dt * 10));
    });
    const quotes = [
      '“The Little Prince” — what is essential is invisible to the eye.',
      '“Drawing on the Right Side of the Brain.” Margins full of doodles.',
      '“A Field Guide to Getting Lost.” Seems fitting.',
      '“Kitchen” by Banana Yoshimoto. Someone underlined half of it.',
      'An old sketchbook. Every page is the same window.',
    ];
    let qi = 0;
    pullBook.updateWorldMatrix(true, false);
    const bp = new THREE.Vector3().setFromMatrixPosition(pullBook.matrixWorld);
    actionSpot('bookshelf', 'Pull a book', {
      x: -4.0, z: bp.z, radius: 1.0, prompt: [bp.x + 0.1, bp.y + 0.25, bp.z],
      act(ctx) { pullT = 3.2; ctx.sound('book'); ctx.caption(quotes[qi++ % quotes.length], 3.6); },
    });
  }

  // ===========================================================================
  // BACK-LEFT: dual-monitor desk + office chair
  // ===========================================================================
  const monitors = { on: false, page: 0 };
  const timers = []; // pending screen wake / sleep timeouts (cleared on dispose)
  {
    const g = group(root, -3.15, 0, -3.04);
    box(g, 2.1, 0.05, 0.72, 0, 0.71, 0, M.wood, { r: 0.012 });
    for (const [x, z] of [[-1.0, -0.31], [1.0, -0.31], [-1.0, 0.31], [1.0, 0.31]]) box(g, 0.05, 0.71, 0.05, x, 0, z, M.wood);
    box(g, 1.95, 0.08, 0.03, 0, 0.62, -0.32, M.wood);
    // rolling drawers, right side
    const cab = group(g, 0.68, 0, 0.0);
    box(cab, 0.42, 0.5, 0.5, 0, 0.07, 0, M.paper, { r: 0.012 });
    for (let i = 0; i < 2; i++) {
      box(cab, 0.38, 0.21, 0.02, 0, 0.1 + i * 0.24, 0.255, M.paper);
      box(cab, 0.12, 0.02, 0.02, 0, 0.25 + i * 0.24, 0.275, M.black);
    }
    for (const [x, z] of [[-0.17, -0.2], [0.17, -0.2], [-0.17, 0.2], [0.17, 0.2]]) sphere(cab, 0.03, x, 0.03, z, M.black, [1, 1, 1], { seg: 10 });
    facedBox(g, 0.48, 0.36, 0.5, -0.7, 0, -0.02, M.paper, M.crates[0]);

    // landscape monitor
    const top = 0.76;
    box(g, 0.24, 0.02, 0.16, -0.36, top, -0.16, M.paper);
    box(g, 0.05, 0.22, 0.04, -0.36, top, -0.2, M.paper);
    box(g, 0.68, 0.43, 0.05, -0.36, top + 0.16, -0.17, M.paper, { r: 0.015 });
    facedBox(g, 0.62, 0.38, 0.005, -0.36, top + 0.185, -0.142, M.black, M.screenL);
    // portrait monitor, rotated on its stand
    box(g, 0.2, 0.02, 0.16, 0.36, top, -0.16, M.paper);
    box(g, 0.05, 0.12, 0.04, 0.36, top, -0.2, M.paper);
    box(g, 0.39, 0.66, 0.05, 0.36, top + 0.1, -0.17, M.paper, { r: 0.015 });
    facedBox(g, 0.34, 0.61, 0.005, 0.36, top + 0.125, -0.142, M.black, M.screenP);
    // blinking text cursor on the portrait screen
    const cursor = box(g, 0.006, 0.03, 0.004, 0.27, top + 0.15, -0.138, M.black, { cast: false });
    updaters.push((t) => { cursor.visible = monitors.on && Math.sin(t * 6) > 0; });
    // sticky notes on the bezels
    facedBox(g, 0.07, 0.07, 0.003, -0.66, top + 0.53, -0.143, M.paper, M.stickies[0], 4, { cast: false }).rotation.z = 0.12;
    facedBox(g, 0.07, 0.07, 0.003, 0.52, top + 0.68, -0.143, M.paper, M.stickies[1], 4, { cast: false }).rotation.z = -0.1;
    // keyboard + mouse
    facedBox(g, 0.46, 0.025, 0.15, -0.3, top, 0.12, M.paper, M.keyboard, 2);
    box(g, 0.05, 0.025, 0.08, 0.06, top, 0.14, M.paper, { r: 0.012 });
    box(g, 0.24, 0.003, 0.2, 0.06, top, 0.14, M.dark, { cast: false });
    // desk lamp (left): base -> elbow -> head reaching forward, shade pointing down
    const lamp = group(g, -0.9, top, -0.22, 0.35);
    cyl(lamp, 0.08, 0.09, 0.03, 0, 0, 0, M.paper);
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const arm = (a, b) => {
      const m = add(new THREE.CylinderGeometry(0.012, 0.012, a.distanceTo(b), 8), M.paper, lamp);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(P(0, 1, 0), b.clone().sub(a).normalize());
    };
    const E = P(0, 0.42, -0.06), Hd = P(0, 0.5, 0.26);
    arm(P(0, 0.03, 0), E); arm(E, Hd);
    sphere(lamp, 0.024, E.x, E.y, E.z, M.paper);
    const shade = add(new THREE.CylinderGeometry(0.035, 0.11, 0.15, 20, 1, true), M.lampShade, lamp);
    shade.position.copy(Hd).add(P(0, -0.05, 0.04));
    shade.rotation.x = 0.35;
    // books, mug, headphones, notes
    box(g, 0.24, 0.05, 0.3, 0.86, top, -0.12, M.paper, { ry: 0.15 });
    box(g, 0.22, 0.04, 0.28, 0.86, top + 0.05, -0.12, M.gray, { ry: -0.05 });
    box(g, 0.2, 0.05, 0.26, 0.87, top + 0.09, -0.12, M.paper, { ry: 0.2 });
    mug(g, 0.62, top, 0.2, -0.5, true, 0.9);
    const hp = group(g, -0.72, top, 0.16, 0.5);
    const band = add(new THREE.TorusGeometry(0.09, 0.013, 8, 20, Math.PI), M.dark, hp);
    band.position.y = 0.03;
    for (const s of [-1, 1]) { const cup = cyl(hp, 0.05, 0.05, 0.045, s * 0.09, 0, 0, M.paper); cup.rotation.z = s * 0.25; }
    for (const [x, z, r, i] of [[-0.95, 0.2, 0.3, 2], [0.33, 0.22, -0.2, 0], [0.2, 0.26, 0.5, 1]]) {
      const n = facedBox(g, 0.075, 0.002, 0.075, x, top, z, M.paper, M.stickies[i], 2, { cast: false });
      n.rotation.y = r;
    }
    box(g, 0.21, 0.003, 0.3, -0.98, top, 0.0, M.paper, { ry: -0.25, cast: false });
    // cable from the desk down to the wall outlet
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.2, top, -0.3), new THREE.Vector3(-0.1, 0.4, -0.34), new THREE.Vector3(0.1, 0.02, -0.25), new THREE.Vector3(0.5, 0.01, -0.3), new THREE.Vector3(0.9, 0.1, -0.35)]);
    add(new THREE.TubeGeometry(cable, 30, 0.007, 5, false), M.black, g, { cast: false });
    box(g, 0.08, 0.1, 0.02, 0.9, 0.06, -0.355, M.paper, { cast: false });
    solid(-4.22, -2.08, -3.4, -2.66);

    // office chair: 5-star base, gas lift, seat, back, arms. faces -z.
    const c = group(root, -3.25, 0, -2.18, Math.PI);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = box(c, 0.04, 0.035, 0.27, Math.sin(a) * 0.13, 0.05, Math.cos(a) * 0.13, M.dark);
      leg.rotation.y = a;
      sphere(c, 0.026, Math.sin(a) * 0.26, 0.026, Math.cos(a) * 0.26, M.black, [1, 1, 1], { seg: 10 });
    }
    cyl(c, 0.025, 0.025, 0.32, 0, 0.08, 0, M.dark, { seg: 10 });
    box(c, 0.48, 0.08, 0.46, 0, 0.4, 0, M.paper, { r: 0.035 });
    box(c, 0.05, 0.36, 0.03, 0, 0.42, -0.25, M.dark);
    box(c, 0.45, 0.5, 0.07, 0, 0.62, -0.27, M.paper, { r: 0.03, rx: -0.1 });
    for (const s of [-1, 1]) {
      box(c, 0.03, 0.18, 0.03, s * 0.23, 0.46, -0.02, M.dark);
      box(c, 0.05, 0.03, 0.26, s * 0.23, 0.64, 0.0, M.dark, { r: 0.012 });
    }
    solidCircle(-3.25, -2.18, 0.31);

    const wake = (on) => {
      monitors.on = on;
      screens.drawLand(on, monitors.page);
      screens.drawPort(on, monitors.page);
      screens.land.tex.needsUpdate = true;
      screens.port.tex.needsUpdate = true;
    };
    monitors.wake = wake;
    const lines = [
      'Sketch saved. The castle looks better today.',
      'Mom: did you eat yet?  (yes… noodles again)',
      'New idea: a game set in this room.',
      'Reminder: small steps, big dreams.',
    ];
    seatSpot('deskchair', 'Sit at the desk', {
      x: -3.25, z: -1.9, radius: 0.95, prompt: [-3.25, 1.25, -2.18],
      seat: [-3.25, 0.32, -2.2], exit: [-3.25, -1.5], facing: Math.PI,
      cam: { yaw: 0.35, pitch: 0.42, dist: 1.9 },
      caption: 'Back to work… or at least, back to doodling.',
      onSit(ctx) { monitors.seated = true; timers.push(setTimeout(() => wake(true), 350)); ctx.sound('click'); },
      onStand() {
        monitors.seated = false; timers.push(setTimeout(() => { if (!monitors.seated) wake(false); }, 1200));
      },
      useLabel: 'Next screen',
      onUse(ctx) {
        monitors.page = (monitors.page + 1) % lines.length;
        wake(true);
        ctx.sound('click');
        ctx.caption(lines[monitors.page], 3.2);
      },
    });

    // posters + frames + stickies on the desk wall
    facedBox(root, 0.5, 0.7, 0.012, -2.5, 1.62, -3.394, M.paper, M.better, 4, { cast: false });
    const frames = [[-4.45, 2.0, 0.2, 0.24], [-4.4, 1.55, 0.2, 0.18], [-3.15, 2.2, 0.18, 0.22], [-2.9, 1.95, 0.16, 0.16], [-3.55, 2.15, 0.2, 0.2], [-4.0, 2.25, 0.16, 0.2]];
    frames.forEach(([x, y, w, h], i) => facedBox(root, w, h, 0.02, x, y, -3.39, M.paper, M.frames[i % M.frames.length], 4, { cast: false }));
    for (const [x, y, i] of [[-3.95, 1.62, 0], [-3.82, 1.7, 2], [-2.85, 1.6, 1]]) {
      const n = facedBox(root, 0.08, 0.08, 0.004, x, y, -3.396, M.paper, M.stickies[i], 4, { cast: false });
      n.rotation.z = rand(-0.2, 0.2);
    }
  }

  // ---- string lights ----------------------------------------------------------
  function stringLights(a, b, sag, spacing) {
    const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    add(new THREE.TubeGeometry(curve, 40, 0.007, 5, false), M.black, root, { cast: false });
    const n = Math.floor(a.distanceTo(b) / spacing);
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n);
      cyl(root, 0.012, 0.012, 0.03, p.x, p.y - 0.03, p.z, M.black, { seg: 8, cast: false });
      sphere(root, 0.032, p.x, p.y - 0.065, p.z, M.paper, [1, 1.3, 1], { seg: 12, cast: false });
    }
  }
  stringLights(new THREE.Vector3(-4.66, 2.95, -3.34), new THREE.Vector3(-2.12, 2.85, -3.34), 0.32, 0.3);
  stringLights(new THREE.Vector3(-2.0, 3.3, -3.36), new THREE.Vector3(0.6, 3.3, -3.36), 0.14, 0.3); // high, so it clears the loft
  stringLights(new THREE.Vector3(-4.64, 2.95, -3.3), new THREE.Vector3(-4.64, 2.9, -0.6), 0.3, 0.3);

  // ===========================================================================
  // BACK: loft bed (climb the ladder to lie down), closet, crates, guitar
  // ===========================================================================
  let strum = null;
  {
    const L = root;
    const top = 1.84;
    for (const [x, z] of [[-1.93, -3.47], [0.53, -3.47], [-1.93, -4.93], [0.53, -4.93]]) {
      box(L, 0.1, 2.42, 0.1, x, 0, z, M.wood);
    }
    solidCircle(-1.93, -3.47, 0.09); solidCircle(0.53, -3.47, 0.09);
    camBlockers.push(box(L, 2.6, 0.12, 1.6, -0.7, top - 0.12, -4.2, M.wood));
    box(L, 2.6, 0.22, 0.05, -0.7, top - 0.16, -3.42, M.wood);
    // rail with a gap above the ladder
    box(L, 1.9, 0.06, 0.06, -0.98, 2.38, -3.45, M.wood);
    box(L, 1.9, 0.04, 0.05, -0.98, 2.14, -3.45, M.wood);
    for (let x = -1.75; x <= -0.2; x += 0.31) box(L, 0.04, 0.48, 0.04, x, top, -3.45, M.wood);
    box(L, 0.06, 0.6, 0.06, -0.02, top, -3.45, M.wood);
    // mattress, pillow, blanket
    box(L, 1.95, 0.2, 1.3, -0.95, top, -4.28, M.paper, { r: 0.07 });
    box(L, 0.42, 0.12, 0.6, -1.65, top + 0.19, -4.3, M.paper, { r: 0.05 });
    box(L, 1.05, 0.08, 1.32, -0.45, top + 0.17, -4.28, M.light, { r: 0.04 });
    // plush bear peeking over the rail
    const bear = group(L, -1.6, top + 0.2, -3.75);
    sphere(bear, 0.17, 0, 0.12, 0, M.paper, [1, 0.9, 0.85]);
    sphere(bear, 0.15, 0, 0.34, 0.02, M.paper);
    sphere(bear, 0.055, -0.11, 0.46, 0, M.paper, [1, 1, 0.6]);
    sphere(bear, 0.055, 0.11, 0.46, 0, M.paper, [1, 1, 0.6]);
    sphere(bear, 0.06, 0, 0.3, 0.13, M.paper, [1, 0.8, 0.7]);
    sphere(bear, 0.018, -0.055, 0.37, 0.135, M.black);
    sphere(bear, 0.018, 0.055, 0.37, 0.135, M.black);
    sphere(bear, 0.016, 0, 0.32, 0.175, M.black);

    // ladder (leaning, base toward the room)
    const lad = group(L, 0.28, 0, -2.86);
    const a = Math.atan2(0.58, 2.45);
    lad.rotation.x = -a;
    const len = 2.55;
    box(lad, 0.05, len, 0.05, -0.19, 0, 0, M.wood);
    box(lad, 0.05, len, 0.05, 0.19, 0, 0, M.wood);
    for (let h = 0.3; h < len - 0.1; h += 0.33) box(lad, 0.38, 0.04, 0.04, 0, h, 0, M.wood);
    solid(0.03, 0.6, -3.47, -2.8);

    // under the loft: crates, closet, small rug
    facedBox(L, 0.7, 0.42, 0.44, -1.6, 0, -4.76, M.paper, M.crates[0]);
    facedBox(L, 0.64, 0.36, 0.4, -1.62, 0.42, -4.78, M.paper, M.crates[1]);
    facedBox(L, 0.46, 0.26, 0.36, -1.64, 0.78, -4.8, M.paper, M.crates[2]);
    box(L, 0.7, 0.03, 0.24, -1.62, 1.36, -4.86, M.wood);
    cyl(L, 0.05, 0.05, 0.12, -1.8, 1.39, -4.85, M.paper);
    box(L, 0.16, 0.14, 0.15, -1.48, 1.39, -4.85, M.paper);
    const cl = group(L, -0.72, 0, -4.7);
    box(cl, 0.03, 1.66, 0.58, -0.46, 0, 0, M.wood);
    box(cl, 0.03, 1.66, 0.58, 0.46, 0, 0, M.wood);
    box(cl, 0.95, 0.03, 0.58, 0, 1.3, 0, M.wood);
    box(cl, 0.95, 0.06, 0.58, 0, 0, 0, M.wood);
    const rod = cyl(cl, 0.012, 0.012, 0.9, 0, 1.2, 0, M.wood, { seg: 8 });
    rod.rotation.z = Math.PI / 2; rod.position.y = 1.2;
    for (let i = 0; i < 5; i++) {
      const x = -0.32 + i * 0.16;
      const tor = add(new THREE.TorusGeometry(0.03, 0.005, 6, 12, Math.PI), M.black, cl);
      tor.position.set(x, 1.19, 0);
      tor.rotation.y = Math.PI / 2;
      box(cl, 0.006, 0.08, 0.32, x, 1.09, 0, M.black);
      box(cl, 0.08, rand(0.58, 0.74), 0.44, x, 1.1 - 0.74, 0, i === 2 ? M.gray : M.paper, { r: 0.03 });
    }
    box(cl, 0.3, 0.2, 0.3, -0.25, 1.33, 0, M.paper);
    box(cl, 0.32, 0.14, 0.26, 0.2, 1.33, 0, M.light);
    box(cl, 0.36, 0.12, 0.24, 0, 0.06, 0.08, M.paper);
    solid(-2.0, 0.6, -5.0, -4.42);
    const or = cyl(L, 0.55, 0.55, 0.012, -0.7, 0, -3.92, M.paper, { seg: 40, cast: false });
    or.scale.z = 0.5;

    // guitar leaning against the alcove side wall
    const gt = group(L, 0.38, 0, -4.32);
    gt.rotation.set(0, -Math.PI / 2, 0.14);
    const gtInner = group(gt, 0, 0, 0);
    const body = (r, y) => { const m = cyl(gtInner, r, r, 0.09, 0, y, 0, M.paper, { seg: 28 }); m.rotation.x = Math.PI / 2; m.position.y = y; return m; };
    body(0.18, 0.23);
    body(0.14, 0.46);
    const hole = cyl(gtInner, 0.05, 0.05, 0.01, 0, 0.4, 0.046, M.black);
    hole.rotation.x = Math.PI / 2; hole.position.y = 0.4;
    box(gtInner, 0.12, 0.025, 0.02, 0, 0.15, 0.05, M.black);
    box(gtInner, 0.05, 0.6, 0.03, 0, 0.58, 0.01, M.paper);
    box(gtInner, 0.08, 0.16, 0.03, 0, 1.18, 0.0, M.paper, { r: 0.01 });
    box(gtInner, 0.008, 1.0, 0.004, -0.01, 0.16, 0.05, M.black);
    box(gtInner, 0.008, 1.0, 0.004, 0.012, 0.16, 0.05, M.black);
    solidCircle(0.38, -4.32, 0.2);
    const wob = wobbler(gtInner, 'z', 0.12);
    strum = wob;
    actionSpot('guitar', 'Strum the guitar', {
      x: 0.2, z: -4.1, radius: 1.0, prompt: [0.3, 1.0, -4.3],
      act(ctx) { wob(); ctx.sound('strum'); ctx.caption('♪ A slightly out-of-tune G chord.', 2.6); },
    });

    // lie down on the loft bed: walk to the ladder, climb, lie on the mattress
    seatSpot('bed', 'Climb into bed', {
      x: 0.28, z: -2.5, radius: 0.85, prompt: [0.28, 1.2, -2.8],
      exit: [0.28, -2.25],
      via: [[0.28, 0, -2.58], [0.28, 0.95, -2.95], [0.28, 1.86, -3.35], [0.15, 1.86, -3.9]],
      seat: [-0.3, 2.04, -4.22], pose: 'lie', facing: Math.PI / 2,
      cam: { yaw: 0.35, pitch: 0.38, dist: 1.8 },
      caption: 'Just five more minutes…',
    });

    // beanbag in front of the loft
    const bb = sphere(L, 0.48, -1.25, 0.26, -2.62, M.paper, [1, 0.58, 0.9], { seg: 32 });
    bb.rotation.z = 0.12;
    sphere(L, 0.28, -1.36, 0.46, -2.78, M.paper, [1.1, 0.5, 0.8]);
    solidCircle(-1.25, -2.62, 0.47);
  }

  // ---- pillar + hanging plant by the window ------------------------------------
  facedBox(root, 0.2, 0.24, 0.02, 0.95, 1.5, -3.99, M.paper, M.frames[3], 4, { cast: false });
  facedBox(root, 0.16, 0.16, 0.02, 1.02, 1.15, -3.99, M.paper, M.frames[5], 4, { cast: false });
  {
    const hang = group(root, 1.0, ROOM.H, -3.55);
    cyl(hang, 0.004, 0.004, 1.15, 0, -1.15, 0, M.black, { seg: 4, cast: false });
    const swing = group(hang, 0, -1.15, 0);
    cyl(swing, 0.13, 0.09, 0.16, 0, -0.16, 0, M.paper);
    const vines = [];
    for (let v = 0; v < 5; v++) {
      const a = (v / 5) * Math.PI * 2;
      const s = group(swing, Math.cos(a) * 0.1, -0.05, Math.sin(a) * 0.1);
      const n = 4 + (v % 3) * 2;
      for (let i = 0; i < n; i++) {
        const leaf = sphere(s, 0.045, Math.sin(i * 1.4 + v) * 0.03, -0.06 - i * 0.1, 0, M.paper, [0.8, 1.1, 0.35], { seg: 10 });
        leaf.rotation.set(0, a, i % 2 ? 0.6 : -0.6);
      }
      vines.push(s);
    }
    updaters.push((t) => {
      swing.rotation.z = Math.sin(t * 0.7) * 0.04;
      swing.rotation.x = Math.sin(t * 0.5 + 1) * 0.03;
      vines.forEach((s, i) => { s.rotation.x = Math.sin(t * 0.9 + i) * 0.06; });
    });
  }

  // ---- curtain, poster, side table with lamp ---------------------------------------
  {
    const geo = new THREE.PlaneGeometry(0.6, 2.42, 16, 24);
    const base = geo.attributes.position.array.slice();
    const curtain = add(geo, M.curtain, root);
    curtain.position.set(4.32, 1.5, -3.86);
    const pos = geo.attributes.position;
    const shape = (t) => {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const v = (1.21 - y) / 2.42;
        const fold = Math.sin((x + 0.3) * 26) * 0.04 * (0.6 + 0.6 * v);
        pos.setXYZ(i, x + Math.sin(t * 0.7 + y) * 0.008 * v, y, fold + Math.sin(t * 0.9 + y * 1.3) * 0.022 * v * v);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };
    shape(0);
    updaters.push((t) => shape(t));
    const rod = cyl(root, 0.018, 0.018, 1.2, 4.1, 2.76, -3.86, M.black, { seg: 8, cast: false });
    rod.rotation.z = Math.PI / 2; rod.position.y = 2.76;
    sphere(root, 0.035, 3.5, 2.76, -3.86, M.black);

    facedBox(root, 0.012, 0.7, 0.5, 4.694, 1.45, -2.8, M.paper, M.small, 1, { cast: false });
    facedBox(root, 0.02, 0.2, 0.16, 4.69, 1.25, -3.3, M.paper, M.frames[1], 1, { cast: false });

    const st = group(root, 4.22, 0, -3.42);
    cyl(st, 0.24, 0.24, 0.035, 0, 0.55, 0, M.wood, { seg: 32 });
    cyl(st, 0.2, 0.2, 0.02, 0, 0.2, 0, M.wood, { seg: 32 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      cyl(st, 0.018, 0.018, 0.56, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16, M.wood, { seg: 8 });
    }
    cyl(st, 0.07, 0.08, 0.03, -0.06, 0.585, 0.02, M.paper);
    cyl(st, 0.012, 0.012, 0.3, -0.06, 0.6, 0.02, M.paper, { seg: 8 });
    const lampShade = cyl(st, 0.09, 0.14, 0.16, -0.06, 0.86, 0.02, M.lampShade, { open: true });
    box(st, 0.16, 0.05, 0.12, 0.1, 0.585, -0.05, M.paper, { ry: 0.4 });
    box(st, 0.14, 0.04, 0.11, 0.1, 0.635, -0.05, M.gray, { ry: 0.2 });
    solidCircle(4.22, -3.42, 0.27);
    let lampOn = true;
    actionSpot('lamp', 'Toggle lamp', {
      x: 4.05, z: -2.85, radius: 0.85, prompt: [4.16, 1.15, -3.4],
      act(ctx) {
        lampOn = !lampOn;
        lampShade.material = lampOn ? M.lampShade : M.dark;
        ctx.sound('click');
        ctx.caption(lampOn ? 'Click. Warm light again.' : 'Click. The afternoon is bright enough.', 2.2);
      },
    });
  }

  // ===========================================================================
  // CENTER-RIGHT: sofa, plush, rug, coffee table
  // ===========================================================================
  {
    const g = group(root, 2.55, 0, -3.45);
    for (const [x, z] of [[-0.98, -0.36], [0.98, -0.36], [-0.98, 0.36], [0.98, 0.36]]) cyl(g, 0.025, 0.02, 0.08, x, 0, z, M.black, { seg: 8 });
    box(g, 2.12, 0.26, 0.88, 0, 0.08, 0, M.paper, { r: 0.05 });
    box(g, 2.12, 0.54, 0.26, 0, 0.32, -0.31, M.paper, { r: 0.08 });
    for (const s of [-1, 1]) {
      box(g, 0.22, 0.32, 0.9, s * 0.95, 0.32, 0.0, M.paper, { r: 0.08 });
      box(g, 0.84, 0.16, 0.62, s * 0.43, 0.32, 0.1, M.paper, { r: 0.06 });
    }
    box(g, 0.5, 0.04, 0.4, -0.5, 0.48, -0.05, M.light, { r: 0.02, ry: 0.2 });
    const pl = group(g, 0.5, 0.48, -0.08, -0.2);
    const plIn = group(pl, 0, 0, 0);
    sphere(plIn, 0.2, 0, 0.16, 0, M.paper, [1.25, 0.85, 0.7]);
    sphere(plIn, 0.06, -0.15, 0.32, 0, M.paper, [1, 1, 0.7]);
    sphere(plIn, 0.06, 0.15, 0.32, 0, M.paper, [1, 1, 0.7]);
    sphere(plIn, 0.018, -0.08, 0.18, 0.138, M.black);
    sphere(plIn, 0.018, 0.08, 0.18, 0.138, M.black);
    const mouth = add(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), M.black, plIn);
    mouth.position.set(0, 0.13, 0.14);
    mouth.rotation.z = Math.PI;
    solid(1.47, 3.63, -3.9, -3.0);
    const squish = wobbler(plIn, 'z', 0.35);
    actionSpot('plush', 'Squeeze the plush', {
      x: 3.05, z: -2.66, radius: 0.75, prompt: [3.05, 1.0, -3.5],
      act(ctx) { squish(); ctx.sound('squeak'); ctx.caption('Squeak!', 1.6); },
    });
    seatSpot('sofa', 'Sit on the sofa', {
      x: 2.1, z: -2.66, radius: 0.8, prompt: [2.12, 1.0, -3.35],
      seat: [2.12, 0.32, -3.32], exit: [2.12, -2.62], facing: 0,
      cam: { yaw: 0.45, pitch: 0.3, dist: 2.1 },
      caption: 'The afternoon light is nice from here.',
    });

    const rug = add(new THREE.BoxGeometry(3.2, 0.012, 2.2), [M.paper, M.paper, M.rug, M.paper, M.paper, M.paper], root, { cast: false });
    rug.position.set(2.55, 0.006, -2.3);

    const ct = group(root, 2.55, 0, -1.95);
    box(ct, 1.3, 0.06, 0.7, 0, 0.4, 0, M.wood, { r: 0.012 });
    for (const [x, z] of [[-0.59, -0.29], [0.59, -0.29], [-0.59, 0.29], [0.59, 0.29]]) box(ct, 0.06, 0.4, 0.06, x, 0, z, M.wood);
    box(ct, 1.18, 0.03, 0.58, 0, 0.12, 0, M.wood);
    box(ct, 0.36, 0.04, 0.26, -0.3, 0.15, 0.02, M.paper, { ry: 0.15 });
    box(ct, 0.3, 0.03, 0.22, -0.28, 0.19, 0.0, M.gray, { ry: -0.1 });
    mug(ct, -0.25, 0.46, -0.06, 0.5, false);
    box(ct, 0.2, 0.06, 0.15, -0.02, 0.46, -0.1, M.paper, { ry: 0.3 });
    box(ct, 0.24, 0.03, 0.3, 0.36, 0.46, 0.06, M.paper, { ry: -0.25 });
    solid(1.88, 3.22, -2.32, -1.58);
  }

  // ===========================================================================
  // RIGHT WALL: kitchen counter, stove + kettle, sink, shelves, fridge
  // ===========================================================================
  let steam = null;
  {
    const K = group(root, 4.7, 0, 0); // local x points into the room when negated
    const z0 = -1.9, z1 = 0.9, D = 0.62, H = 0.9;
    const len = z1 - z0, zc = (z0 + z1) / 2;
    // base cabinets with doors on the room-facing side (-x)
    facedBox(K, D - 0.04, H - 0.1, len, -D / 2 + 0.02, 0.1, zc, M.paper, M.paper, 1);
    box(K, D - 0.1, 0.1, len - 0.04, -D / 2 + 0.06, 0, zc, M.dark, { cast: false });
    const doors = 4;
    for (let i = 0; i < doors; i++) {
      const dz = z0 + (i + 0.5) * (len / doors);
      facedBox(K, 0.02, H - 0.2, len / doors - 0.03, -D + 0.03, 0.12, dz, M.paper, M.cabinet, 1);
      box(K, 0.02, 0.12, 0.02, -D + 0.01, 0.6, dz + (i % 2 ? -1 : 1) * (len / doors / 2 - 0.08), M.black);
    }
    box(K, D + 0.03, 0.05, len + 0.04, -D / 2 - 0.01, H, zc, M.wood, { r: 0.008 });
    // backsplash tiles + upper open shelves
    box(K, 0.02, 0.55, len, -0.01, H + 0.05, zc, M.tiles, { cast: false });
    for (const y of [1.55, 1.98]) {
      box(K, 0.3, 0.035, len - 0.2, -0.15, y, zc + 0.05, M.wood);
      for (const z of [z0 + 0.3, z1 - 0.2]) box(K, 0.03, 0.12, 0.03, -0.05, y - 0.12, z, M.dark);
    }
    // shelf 1: mugs + jars with labels
    for (let i = 0; i < 4; i++) mug(K, -0.14, 1.585, -1.55 + i * 0.16, Math.PI / 2 + 0.3 * i, i === 1, 0.85);
    T.labels.forEach((_, i) => {
      const z = -0.6 + i * 0.22;
      cyl(K, 0.065, 0.065, 0.2, -0.15, 1.585, z, M.paper, { seg: 20 });
      cyl(K, 0.07, 0.07, 0.035, -0.15, 1.785, z, M.dark, { seg: 20 });
      const lab = add(new THREE.PlaneGeometry(0.11, 0.055), M.labels[i], K, { cast: false });
      lab.position.set(-0.217, 1.69, z);
      lab.rotation.y = -Math.PI / 2;
    });
    facedBox(K, 0.16, 0.26, 0.07, -0.15, 1.585, 0.42, M.paper, M.cereal, 1);
    plant(K, -0.15, 1.585, 0.66, 0.65);
    // shelf 2: bowls + plates
    for (let i = 0; i < 3; i++) {
      const b = add(new THREE.SphereGeometry(0.1 - i * 0.008, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.paper2, K);
      b.position.set(-0.15, 2.1 + i * 0.03, -1.3);
    }
    for (let i = 0; i < 5; i++) cyl(K, 0.11, 0.09, 0.012, -0.15, 2.015 + i * 0.014, -0.75, M.paper, { seg: 24 });
    cyl(K, 0.06, 0.07, 0.2, -0.15, 2.015, -0.2, M.paper);
    cyl(K, 0.05, 0.05, 0.25, -0.15, 2.015, 0.05, M.dark);
    box(K, 0.2, 0.22, 0.05, -0.15, 2.015, 0.4, M.paper, { ry: 0.1 });

    // stovetop with two burners + kettle
    const sz = -1.45;
    box(K, 0.5, 0.025, 0.56, -0.3, H + 0.05, sz, M.dark, { cast: false });
    for (const [bz, r] of [[sz - 0.13, 0.08], [sz + 0.13, 0.07]]) {
      const ring = add(new THREE.TorusGeometry(r, 0.01, 6, 24), M.paper, K);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-0.3, H + 0.08, bz);
    }
    for (let i = 0; i < 3; i++) { const k = cyl(K, 0.02, 0.02, 0.03, -D - 0.005, 0.78, sz - 0.12 + i * 0.12, M.paper, { seg: 10 }); k.rotation.z = Math.PI / 2; k.position.y = 0.78; }
    const kettle = group(K, -0.3, H + 0.085, sz - 0.13);
    const kp = [[0, 0], [0.1, 0], [0.115, 0.04], [0.11, 0.12], [0.08, 0.17], [0.03, 0.19], [0, 0.19]].map(([r, y]) => new THREE.Vector2(r, y));
    add(new THREE.LatheGeometry(kp, 24), M.paper, kettle);
    cyl(kettle, 0.02, 0.025, 0.03, 0, 0.185, 0, M.black, { seg: 10 });
    const spout = cyl(kettle, 0.015, 0.03, 0.14, 0, 0.0, 0, M.paper, { seg: 10 });
    spout.position.set(-0.13, 0.12, 0);
    spout.rotation.z = 0.9;
    const handle = add(new THREE.TorusGeometry(0.075, 0.012, 8, 16, Math.PI), M.black, kettle);
    handle.position.set(0, 0.18, 0);
    handle.rotation.y = Math.PI / 2;
    const kettleWob = wobbler(kettle, 'x', 0.05);

    // steam puffs that rise, swell and shrink from the spout
    const puffs = [];
    const puffGeo = new THREE.SphereGeometry(1, 12, 9);
    for (let i = 0; i < 12; i++) {
      const p = add(puffGeo, M.paper, root, { cast: false, receive: false });
      p.visible = false;
      puffs.push({ m: p, t: -1, d: 0 });
    }
    kettle.updateWorldMatrix(true, false);
    const spoutTip = new THREE.Vector3(-0.2, 0.18, 0).applyMatrix4(kettle.matrixWorld);
    let steamT = 0;
    steam = () => { steamT = 2.8; kettleWob(); };
    let emit = 0;
    updaters.push((t, dt) => {
      if (steamT > 0) {
        steamT -= dt;
        emit -= dt;
        if (emit <= 0) {
          emit = 0.16;
          const p = puffs.find((q) => q.t < 0);
          if (p) { p.t = 0; p.d = rand(1.2, 1.6); p.ox = rand(-0.03, 0.03); p.oz = rand(-0.03, 0.03); p.m.visible = true; }
        }
      }
      for (const p of puffs) {
        if (p.t < 0) continue;
        p.t += dt;
        const a = p.t / p.d;
        if (a >= 1) { p.t = -1; p.m.visible = false; continue; }
        p.m.position.set(spoutTip.x - a * 0.1 + p.ox + Math.sin(p.t * 5 + p.oz * 50) * 0.03, spoutTip.y + a * 0.75, spoutTip.z + p.oz);
        p.m.scale.setScalar(0.07 * Math.sin(Math.min(a * 1.3, 1) * Math.PI) + 0.004);
      }
    });
    actionSpot('kettle', 'Make tea', {
      x: 3.75, z: -1.45, radius: 0.85, prompt: [4.4, 1.35, -1.55],
      act(ctx) { steam(); ctx.sound('kettle'); ctx.caption('Tea’s ready.', 2.8); },
    });

    // towel hanging from the oven rail
    box(K, 0.02, 0.02, 0.45, -D - 0.03, 0.82, sz, M.paper);
    const towel = add(new THREE.PlaneGeometry(0.2, 0.36, 4, 6), M.towel, K);
    towel.position.set(-D - 0.045, 0.66, sz + 0.05);
    towel.rotation.y = -Math.PI / 2;
    updaters.push((t) => { towel.rotation.x = Math.sin(t * 1.1) * 0.03; });

    // sink + faucet
    const kz = -0.35;
    box(K, 0.42, 0.012, 0.5, -0.32, H + 0.051, kz, M.black, { cast: false });
    box(K, 0.38, 0.004, 0.46, -0.32, H + 0.064, kz, M.dark, { cast: false });
    const fau = group(K, -0.08, H + 0.05, kz);
    cyl(fau, 0.022, 0.025, 0.25, 0, 0, 0, M.paper, { seg: 12 });
    const neck = add(new THREE.TorusGeometry(0.09, 0.016, 8, 16, Math.PI), M.paper, fau);
    neck.position.set(-0.09, 0.25, 0);
    cyl(fau, 0.018, 0.018, 0.04, -0.18, 0.21, 0, M.paper, { seg: 10 });
    for (const s of [-1, 1]) cyl(fau, 0.015, 0.015, 0.05, 0, 0.05, s * 0.06, M.black, { seg: 8 });
    // dish rack with plates
    const rack = group(K, -0.3, H + 0.05, 0.18);
    box(rack, 0.3, 0.02, 0.32, 0, 0, 0, M.dark);
    for (const s of [-1, 1]) box(rack, 0.3, 0.12, 0.01, 0, 0.02, s * 0.15, M.dark);
    for (let i = 0; i < 4; i++) { const p = cyl(rack, 0.11, 0.11, 0.012, 0, 0.13, -0.1 + i * 0.065, M.paper, { seg: 24 }); p.rotation.x = Math.PI / 2 - 0.15; p.position.y = 0.13; }
    mug(rack, 0.06, 0.02, 0.1, 0.4, false, 0.8);
    // toaster
    const toaster = group(K, -0.3, H + 0.05, 0.65);
    box(toaster, 0.2, 0.18, 0.3, 0, 0, 0, M.paper, { r: 0.04 });
    for (const s of [-1, 1]) box(toaster, 0.03, 0.005, 0.2, s * 0.045, 0.18, 0, M.black, { cast: false });
    box(toaster, 0.02, 0.04, 0.02, -0.11, 0.1, 0.08, M.black);
    solid(4.06, 4.7, -1.92, 0.92);

    // fridge with a hinged door that opens
    const F = group(root, 4.36, 0, 1.33);
    const FW = 0.66, FH = 1.72, FD = 0.68;
    box(F, 0.04, FH, FD, FD / 2 - 0.02 - 0.02, 0, 0, M.paper);             // back (toward the wall)
    box(F, FD, FH, 0.04, 0, 0, -FW / 2 + 0.02, M.paper);                    // sides
    box(F, FD, FH, 0.04, 0, 0, FW / 2 - 0.02, M.paper);
    box(F, FD, 0.04, FW, 0, FH - 0.04, 0, M.paper);                         // top
    box(F, FD, 0.06, FW, 0, 0, 0, M.paper);                                 // bottom
    box(F, FD - 0.06, 0.03, FW - 0.08, 0, 0.6, 0, M.paper);                 // shelves
    box(F, FD - 0.06, 0.03, FW - 0.08, 0, 1.1, 0, M.paper);
    box(F, FD - 0.06, 0.02, FW - 0.08, 0, 1.4, 0, M.paper);
    // sparse interior: milk, eggs, apple, jar, leftovers
    const milk = group(F, 0.05, 1.13, -0.15);
    box(milk, 0.1, 0.2, 0.1, 0, 0, 0, M.paper);
    add(new THREE.ConeGeometry(0.075, 0.06, 4), M.paper, milk).position.set(0, 0.23, 0);
    for (let i = 0; i < 3; i++) sphere(F, 0.03, -0.05, 0.665, -0.15 + i * 0.065, M.paper, [1, 1.3, 1], { seg: 10 });
    sphere(F, 0.05, 0.0, 0.68, 0.15, M.paper);
    cyl(F, 0.05, 0.05, 0.12, 0.05, 1.13, 0.12, M.paper);
    box(F, 0.18, 0.08, 0.14, 0.0, 0.07, 0.0, M.light, { r: 0.02 });
    box(F, 0.22, 0.03, 0.18, -0.05, 1.43, 0.05, M.paper, { r: 0.01 });
    // door: hinged on the front-wall side edge
    const hinge = group(F, -FD / 2, 0, FW / 2);
    const door = facedBox(hinge, 0.06, FH - 0.02, FW, -0.03, 0.01, -FW / 2, M.paper, M.fridge, 1);
    box(hinge, 0.03, 0.4, 0.03, -0.075, 0.95, -FW + 0.08, M.black);
    box(hinge, 0.03, 0.18, 0.03, -0.075, 0.35, -FW + 0.08, M.black);
    let fridgeOpen = false, fridgeA = 0;
    updaters.push((t, dt) => {
      fridgeA += ((fridgeOpen ? 1.85 : 0) - fridgeA) * (1 - Math.exp(-dt * 6));
      hinge.rotation.y = fridgeA;
    });
    solid(4.0, 4.7, 0.96, 1.7);
    const fridgeLines = ['Milk, three eggs, one apple. Grocery day tomorrow.', 'Leftover noodles. Again.', 'The light still works. That counts.'];
    let fi = 0;
    actionSpot('fridge', 'Open the fridge', {
      x: 3.6, z: 1.33, radius: 0.85, prompt: [3.95, 1.45, 1.33],
      act(ctx) {
        fridgeOpen = !fridgeOpen;
        ctx.sound(fridgeOpen ? 'fridgeOpen' : 'fridgeClose');
        if (fridgeOpen) { ctx.caption(fridgeLines[fi++ % fridgeLines.length], 3.2); ctx.frame(-2.35, 0.3); }
        this.label = fridgeOpen ? 'Close the fridge' : 'Open the fridge';
      },
      autoClose(px, pz) { if (fridgeOpen && Math.hypot(px - 3.6, pz - 1.33) > 1.8) { fridgeOpen = false; this.label = 'Open the fridge'; } },
    });
  }

  // ===========================================================================
  // FRONT-RIGHT: dining table with two chairs, mug + journal + fruit bowl
  // ===========================================================================
  let journal;
  {
    const g = group(root, 2.55, 0, 2.25);
    box(g, 1.45, 0.05, 0.85, 0, 0.72, 0, M.wood, { r: 0.012 });
    for (const [x, z] of [[-0.65, -0.36], [0.65, -0.36], [-0.65, 0.36], [0.65, 0.36]]) box(g, 0.06, 0.72, 0.06, x, 0, z, M.wood);
    box(g, 1.3, 0.08, 0.03, 0, 0.62, -0.39, M.wood);
    mug(g, 0.42, 0.77, -0.12, Math.PI + 0.25, true);
    journal = group(g, -0.12, 0.77, 0.08, 0.12);
    const jb = add(new THREE.BoxGeometry(0.34, 0.025, 0.42), [M.paper, M.paper, M.journal, M.paper, M.paper, M.paper], journal);
    jb.position.y = 0.0125;
    for (let i = 0; i < 9; i++) {
      const r = add(new THREE.TorusGeometry(0.014, 0.003, 6, 12), M.black, journal, { cast: false });
      r.position.set(-0.17, 0.015, -0.18 + i * 0.045);
      r.rotation.y = Math.PI / 2;
    }
    const pen = cyl(journal, 0.008, 0.008, 0.18, 0.24, 0.008, 0.0, M.paper, { seg: 10 });
    pen.rotation.set(Math.PI / 2, 0, 0.3); pen.position.y = 0.01;
    // fruit bowl
    const fb = group(g, -0.45, 0.77, -0.15);
    const bowl = add(new THREE.SphereGeometry(0.14, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.paper2, fb);
    bowl.position.y = 0.12;
    bowl.scale.y = 0.75;
    for (const [x, z, r] of [[-0.04, 0.02, 0.05], [0.05, -0.03, 0.048], [0.0, 0.06, 0.045]]) sphere(fb, r, x, 0.1, z, M.paper);
    sphere(fb, 0.04, 0.02, 0.15, 0.0, M.gray);
    solid(1.8, 3.3, 1.8, 2.7);

    woodChair(root, 1.4, 2.25, Math.PI / 2);
    solidCircle(1.4, 2.25, 0.29);
    woodChair(root, 3.7, 2.25, -Math.PI / 2, M.dark, M.black);
    solidCircle(3.7, 2.25, 0.29);
    seatSpot('chairW', 'Sit at the table', {
      x: 0.8, z: 2.25, radius: 0.75, prompt: [1.4, 1.2, 2.25],
      seat: [1.36, 0.28, 2.25], exit: [0.7, 2.25], facing: Math.PI / 2,
      cam: { yaw: Math.PI / 2 + 0.35, pitch: 0.35, dist: 2.0 },
      caption: 'A quiet meal for one. Not bad.',
    });
    seatSpot('chairE', 'Sit at the table', {
      x: 3.72, z: 2.85, radius: 0.75, prompt: [3.7, 1.2, 2.25],
      seat: [3.74, 0.28, 2.25], exit: [3.72, 3.02], facing: -Math.PI / 2,
      cam: { yaw: -Math.PI / 2 - 0.35, pitch: 0.35, dist: 2.0 },
      caption: 'From here you can see the whole room.',
    });
  }

  // ===========================================================================
  // LEFT/FRONT: low cabinet, pinboard, floor plant, door, hooks, laundry, slippers
  // ===========================================================================
  {
    const g = group(root, -4.35, 0, 1.4, Math.PI / 2);
    box(g, 0.98, 0.04, 0.68, 0, 0.6, 0, M.wood, { r: 0.008 });
    for (const [x, z] of [[-0.44, -0.29], [0.44, -0.29], [-0.44, 0.29], [0.44, 0.29]]) box(g, 0.05, 0.6, 0.05, x, 0, z, M.wood);
    box(g, 0.86, 0.12, 0.56, 0, 0.47, 0, M.paper);
    box(g, 0.14, 0.02, 0.02, 0, 0.52, 0.29, M.black);
    box(g, 0.9, 0.03, 0.6, 0, 0.14, 0, M.wood);
    box(g, 0.34, 0.08, 0.26, 0.2, 0.17, 0, M.paper, { ry: 0.2 });
    box(g, 0.26, 0.04, 0.34, -0.28, 0.64, -0.05, M.paper, { ry: -0.15 });
    solid(-4.7, -4.0, 0.9, 1.9);
    facedBox(root, 0.03, 0.66, 0.96, -4.685, 1.2, 1.4, M.wood, M.pinboard, 0, { cast: false });

    const pot = group(root, -4.25, 0, 3.75);
    cyl(pot, 0.22, 0.17, 0.4, 0, 0, 0, M.paper);
    cyl(pot, 0.23, 0.23, 0.04, 0, 0.38, 0, M.paper);
    plant(pot, 0, 0.24, 0, 2.4);
    solidCircle(-4.25, 3.75, 0.36);

    // door + hooks on the front wall
    box(root, 0.95, 2.1, 0.05, -2.4, 0, 4.18, M.paper, { cast: false });
    box(root, 1.1, 0.08, 0.08, -2.4, 2.1, 4.17, M.wood, { cast: false });
    for (const x of [-2.92, -1.88]) box(root, 0.08, 2.1, 0.08, x, 0, 4.17, M.wood, { cast: false });
    box(root, 0.68, 0.78, 0.02, -2.4, 1.15, 4.15, M.paper, { cast: false });
    box(root, 0.68, 0.7, 0.02, -2.4, 0.25, 4.15, M.paper, { cast: false });
    sphere(root, 0.035, -2.05, 1.0, 4.13, M.black);
    box(root, 0.8, 0.02, 0.5, -2.4, 0, 3.85, M.gray, { r: 0.01, cast: false });
    box(root, 1.0, 0.06, 0.04, -1.0, 1.55, 4.18, M.wood, { cast: false });
    for (let i = 0; i < 4; i++) cyl(root, 0.015, 0.015, 0.08, -1.36 + i * 0.24, 1.59, 4.14, M.black, { seg: 6 });
    box(root, 0.32, 0.55, 0.1, -1.36, 1.06, 4.1, M.light, { r: 0.05 });
    box(root, 0.22, 0.34, 0.08, -0.88, 1.25, 4.1, M.paper, { r: 0.04 });
    // slippers by the door
    for (const s of [-1, 1]) {
      box(root, 0.1, 0.05, 0.24, -1.55 + s * 0.07, 0, 3.86, M.paper, { r: 0.025, ry: s * 0.15 });
    }
    // laundry basket
    const lb = group(root, -0.1, 0, 3.82);
    add(new THREE.CylinderGeometry(0.27, 0.22, 0.42, 24, 1, true), M.basket, lb).position.y = 0.21;
    add(new THREE.CylinderGeometry(0.265, 0.215, 0.42, 24, 1, true), M.paperBack, lb).position.y = 0.21;
    cyl(lb, 0.22, 0.22, 0.01, 0, 0, 0, M.paper);
    sphere(lb, 0.22, 0.02, 0.38, 0, M.light, [1, 0.45, 1]);
    box(lb, 0.28, 0.02, 0.36, 0.12, 0.42, -0.05, M.paper, { rx: 0.5, rz: 0.4 });
    solidCircle(-0.1, 3.82, 0.29);
    // pair of socks on the floor
    box(root, 0.08, 0.025, 0.2, 0.45, 0, 3.4, M.light, { r: 0.01, ry: 0.8, cast: false });
  }

  // ---- front-right reading nook: floor cushion, books, floor lamp ----------------
  {
    const cu = cyl(root, 0.32, 0.34, 0.14, 4.05, 0, 3.6, M.paper, { seg: 28 });
    cu.scale.z = 0.9;
    sphere(root, 0.06, 4.05, 0.14, 3.6, M.paper, [1, 0.4, 1]);
    for (let i = 0; i < 3; i++) box(root, 0.3 - i * 0.03, 0.06, 0.22, 3.55, i * 0.06, 3.95, i === 1 ? M.gray : M.paper, { ry: 0.3 + i * 0.2 });
    const fl = group(root, 4.45, 0, 3.95);
    cyl(fl, 0.13, 0.14, 0.03, 0, 0, 0, M.dark);
    cyl(fl, 0.012, 0.012, 1.5, 0, 0.03, 0, M.dark, { seg: 8 });
    cyl(fl, 0.13, 0.2, 0.26, 0, 1.45, 0, M.lampShade, { open: true });
    solidCircle(4.05, 3.6, 0.34);
    solidCircle(4.45, 3.95, 0.18);
    facedBox(root, 0.02, 0.36, 0.28, 4.69, 1.4, 3.2, M.paper, M.frames[2], 1, { cast: false });
    facedBox(root, 0.02, 0.24, 0.24, 4.69, 1.5, 2.7, M.paper, M.frames[0], 1, { cast: false });
  }

  // ---- fill the remaining walls / floor ------------------------------------------
  {
    // right wall above the dining table: poster, calendar, clock
    facedBox(root, 0.012, 0.66, 0.47, 4.694, 1.35, 2.35, M.paper, M.tea, 1, { cast: false });
    facedBox(root, 0.012, 0.4, 0.32, 4.694, 1.45, 1.75, M.paper, M.calendar, 1, { cast: false }).position.z = 1.72;
    const clk = cyl(root, 0.17, 0.17, 0.04, 4.68, 2.3, 2.95, M.paper, { seg: 32 });
    clk.rotation.z = Math.PI / 2; clk.position.y = 2.3;
    const face = add(new THREE.CircleGeometry(0.15, 32), M.clock, root, { cast: false });
    face.position.set(4.655, 2.3, 2.95); face.rotation.y = -Math.PI / 2;
    // front wall: floating shelf with records + books + a small plant
    box(root, 1.5, 0.035, 0.24, 1.55, 1.5, 4.08, M.wood);
    for (let i = 0; i < 6; i++) box(root, 0.04, rand(0.2, 0.28), 0.18, 0.95 + i * 0.05, 1.535, 4.08, i % 3 ? M.paper : M.dark, { rz: i === 5 ? -0.2 : 0 });
    for (let i = 0; i < 3; i++) box(root, 0.3, 0.012, 0.3, 1.6, 1.535 + i * 0.012, 4.06, M.paper);
    plant(root, 2.05, 1.535, 4.08, 0.6);
    facedBox(root, 0.34, 0.26, 0.02, 1.55, 1.9, 4.19, M.paper, M.frames[5], 5, { cast: false });
    facedBox(root, 0.2, 0.26, 0.02, 3.2, 1.6, 4.19, M.paper, M.frames[3], 5, { cast: false });
    // left wall: leaning mirror + small wall shelf + tote bag
    const mir = group(root, -4.55, 0, 2.75, Math.PI / 2);
    mir.rotation.x = 0;
    const mi = group(mir, 0, 0, 0); mi.rotation.x = -0.1;
    box(mi, 0.5, 1.5, 0.05, 0, 0, 0, M.wood);
    facedBox(mi, 0.42, 1.42, 0.01, 0, 0.04, 0.026, M.paper, M.mirror, 4);
    solid(-4.7, -4.38, 2.45, 3.05);
    box(root, 0.22, 0.03, 0.8, -4.59, 1.62, -0.3, M.wood);
    plant(root, -4.6, 1.65, -0.5, 0.55);
    facedBox(root, 0.03, 0.2, 0.16, -4.6, 1.65, -0.12, M.paper, M.frames[2], 0, { cast: false });
    box(root, 0.18, 0.14, 0.12, -4.6, 1.65, 0.1, M.paper, { ry: 0.2 });
    const tote = group(root, -4.45, 0, -0.35, 0.3);
    box(tote, 0.36, 0.34, 0.14, 0, 0, 0, M.light, { r: 0.03, rz: 0.05 });
    const strap = add(new THREE.TorusGeometry(0.11, 0.012, 6, 16, Math.PI), M.dark, tote);
    strap.position.y = 0.33;
    solidCircle(-4.45, -0.35, 0.24);
    // round rug in the middle of the floor + a stray sketch page
    const rr = cyl(root, 1.05, 1.05, 0.012, -0.8, 0, -0.5, M.paper, { seg: 48, cast: false });
    rr.scale.z = 0.8;
    const rr2 = add(new THREE.TorusGeometry(0.9, 0.012, 4, 64), M.black, root, { cast: false });
    rr2.rotation.x = Math.PI / 2; rr2.position.set(-0.8, 0.014, -0.5); rr2.scale.y = 0.8;
    box(root, 0.21, 0.004, 0.3, -0.3, 0.013, -0.2, M.paper, { ry: 0.6, cast: false });
  }

  // ---- ceiling fan + pendants --------------------------------------------------
  const fan = group(root, 0.4, ROOM.H, 0.2);
  cyl(fan, 0.02, 0.02, 0.32, 0, -0.32, 0, M.black, { seg: 8, cast: false });
  cyl(fan, 0.11, 0.09, 0.09, 0, -0.41, 0, M.paper, { cast: false });
  const blades = group(fan, 0, -0.38, 0);
  for (let i = 0; i < 4; i++) {
    const b = box(blades, 0.6, 0.015, 0.13, 0, 0, 0, M.paper, { cast: false });
    b.position.set(Math.cos((i * Math.PI) / 2) * 0.4, 0, Math.sin((i * Math.PI) / 2) * 0.4);
    b.rotation.y = -(i * Math.PI) / 2;
    b.rotation.x = 0.12;
  }
  updaters.push((t, dt) => { blades.rotation.y += dt * 1.4; });
  for (const [x, z, l] of [[2.55, 2.25, 1.1], [-3.0, -0.8, 0.6]]) {
    cyl(root, 0.006, 0.006, l, x, ROOM.H - l, z, M.black, { seg: 6, cast: false });
    cyl(root, 0.03, 0.03, 0.05, x, ROOM.H - l - 0.05, z, M.black, { cast: false });
    sphere(root, 0.065, x, ROOM.H - l - 0.1, z, M.paper, [1, 1.15, 1], { cast: false });
  }

  // ---- interactables carried over from Milestone 1 --------------------------------
  journal.updateWorldMatrix(true, false);
  const jp = new THREE.Vector3().setFromMatrixPosition(journal.matrixWorld);
  actionSpot('journal', 'Read journal', { x: jp.x, z: 3.0, radius: 0.85, prompt: [jp.x, jp.y + 0.2, jp.z], act(ctx) { ctx.openJournal(); } });
  actionSpot('window', 'Look outside', {
    x: 1.05, z: -3.65, radius: 0.85, prompt: [1.6, 1.7, -4.0],
    act(ctx) { ctx.caption('A quiet afternoon, somewhere far from home.', 4.5); },
  });

  // ---- stars (collectibles) ---------------------------------------------------
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.065 : 0.15;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  starGeo.center();
  const starMat = ink({ tone: 0.02, hatch: 0 });
  const stars = [];
  const STAR_SPOTS = [
    { p: [4.36, 1.15, -0.72], stand: [3.75, -0.6] },    // kitchen counter
    { p: [-0.7, 0.35, -3.85], stand: [-0.7, -3.35] },   // under the loft
    { p: [-4.3, 0.86, 1.4], stand: [-3.7, 1.4] },       // low cabinet
    { p: [-1.25, 0.72, -2.62], stand: [-1.25, -1.9] },  // on the beanbag
    { p: [3.4, 0.35, 3.62], stand: [3.0, 3.5] },        // reading nook
  ];
  for (const { p: [x, y, z], stand } of STAR_SPOTS) {
    const m = add(starGeo, starMat, root);
    m.position.set(x, y, z);
    const s = { mesh: m, base: new THREE.Vector3(x, y, z), collected: false, anim: -1, stand };
    stars.push(s);
    interactables.push({ id: 'star', label: 'Pick up star', kind: 'action', pos: new THREE.Vector3(x, y + 0.3, z), radius: 0.95, x, z, star: s });
  }

  // Camera collision: every solid piece of furniture blocks the camera, but
  // thin rods (rails, rungs, wires, vines) are skipped so the camera doesn't
  // pop in and out behind them.
  root.updateMatrixWorld(true);
  const size = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.layers.mask !== 1 || camBlockers.includes(o) || !o.visible) return;
    if (puffGeoOf(o)) return;
    o.geometry.computeBoundingBox();
    o.geometry.boundingBox.getSize(size);
    size.multiply(new THREE.Vector3().setFromMatrixScale(o.matrixWorld));
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    if (dims[1] > 0.15 && dims[0] > 0.012 && dims[2] > 0.3) camBlockers.push(o);
  });
  function puffGeoOf(o) { return o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 1; }

  function update(t, dt) {
    for (const u of updaters) u(t, dt);
  }

  // the screens' wake timers must not fire into textures disposed with the room
  const dispose = () => { for (const id of timers) clearTimeout(id); };
  return { root, colliders, camBlockers, interactables, stars, update, monitors, dispose };
}
