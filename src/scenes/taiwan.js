import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ink, backdropMaterial } from '../ink.js';
import { makeRng, Sketch } from '../sketch.js';
import { createCharacter } from '../character.js';
import * as TX from '../taiwanTextures.js';
import { t } from '../i18n.js';
import { BOLD } from './kit.js';
import { buildTaipei } from './taiwan/taipei.js';
import { makeHouseKit, buildHillside, buildRidges } from './taiwan/hillside.js';

// Chapter 1: Taiwan — the walk is set on Jiufen old street.
//
// Layout (meters; x right, z toward the start, y up; the street runs downhill
// toward -z, where the city and Taipei 101 are):
//
//   z  2.5 .. -2.0   top landing (start, signpost home, 九份老街 arch)
//   z -2.0 .. -4.4   steps (6)
//   z -4.4 .. -7.8   landing: bubble tea (left), taro balls (right)
//   z -7.8 .. -9.8   steps (5)
//   z -9.8 .. -13    landing: tea house (right, 茶 lantern)
//   z -13  .. -16.6  plaza (bend): food stalls, cat on a ledge, scooter, mailbox,
//                    overlook rail; alley west -> 3 steps up -> small shrine
//   x 2.6..5.6, z -16.6 .. -24.6  lower street: steps (7), landing, steps (6),
//                    open rail on the left above the roofs
//   z -24.6 .. -29   lookout platform, rail, bench, the view
//
// Walkable ground is a set of regions; heightAt() reads them, the stairs and
// slabs are built from the same numbers, and the controller refuses moves onto
// ground more than a step away, so nothing can fall off the hillside.

const REGIONS = [
  { id: 'top', x: [-1.6, 1.6], z: [-2.0, 4.6], y: 0 },
  { id: 'f1', x: [-1.6, 1.6], z: [-4.4, -2.0], axis: 'z', from: -2.0, to: -4.4, y0: 0, y1: -0.9, steps: 6 },
  { id: 'l1', x: [-1.6, 1.6], z: [-7.8, -4.4], axis: 'z', from: -4.4, to: -7.8, y0: -0.9, y1: -1.05 },
  { id: 'f2', x: [-1.6, 1.6], z: [-9.8, -7.8], axis: 'z', from: -7.8, to: -9.8, y0: -1.05, y1: -1.8, steps: 5 },
  { id: 'l2', x: [-1.6, 1.6], z: [-13.0, -9.8], y: -1.8 },
  { id: 'plaza', x: [-1.6, 5.6], z: [-16.6, -13.0], y: -1.8 },
  { id: 'alley', x: [-3.0, -1.6], z: [-15.8, -13.4], y: -1.8 },
  { id: 'f3', x: [-4.2, -3.0], z: [-15.8, -13.4], axis: 'x', from: -3.0, to: -4.2, y0: -1.8, y1: -1.35, steps: 3 },
  { id: 'shrine', x: [-7.2, -4.2], z: [-15.8, -13.4], y: -1.35 },
  { id: 'f4', x: [2.6, 5.6], z: [-19.4, -16.6], axis: 'z', from: -16.6, to: -19.4, y0: -1.8, y1: -2.85, steps: 7 },
  { id: 'l3', x: [2.6, 5.6], z: [-22.2, -19.4], axis: 'z', from: -19.4, to: -22.2, y0: -2.85, y1: -3.0 },
  { id: 'f5', x: [2.6, 5.6], z: [-24.6, -22.2], axis: 'z', from: -22.2, to: -24.6, y0: -3.0, y1: -3.9, steps: 6 },
  { id: 'look', x: [0.4, 8.6], z: [-29.0, -24.6], y: -3.9 },
];
const OFF = -100; // "no ground here"

function regionAt(x, z) {
  for (const r of REGIONS) if (x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1]) return r;
  return null;
}
function regionY(r, x, z) {
  if (r.y !== undefined) return r.y;
  const c = r.axis === 'x' ? x : z;
  const t = THREE.MathUtils.clamp((c - r.from) / (r.to - r.from), 0, 1);
  if (!r.steps) return r.y0 + (r.y1 - r.y0) * t;
  const i = Math.min(r.steps - 1, Math.floor(t * r.steps));
  return r.y0 + ((r.y1 - r.y0) * (i + 1)) / r.steps;
}
export function heightAt(x, z) {
  const r = regionAt(x, z);
  return r ? regionY(r, x, z) : OFF;
}

export default {
  id: 'taiwan',
  name: 'Taiwan',
  travelText: 'Traveling to Taiwan…',
  hud: {
    title: 'Taiwan',
    sub: 'Jiufen old street',
    style: 'card',
    map: 'compass',
    objectives: [
      { id: 'explore', text: 'Explore the old streets' },
      { id: 'teahouse', text: 'Find the tea house' },
      { id: 'sunset', text: 'Watch the sunset' },
      { id: 'stars', text: 'Collectibles', count: true },
    ],
  },
  start: { x: 0, z: 1.4, facing: Math.PI, yaw: 0, pitch: 0.36 },
  sun: { dir: [0.5, 3.2, 0.8], extent: 14, follow: true, far: 60 },
  camera: { near: 0.15, far: 1600, dist: 2.5 },
  // distant lines thin and lighten, distant tones fade toward the paper; Taipei 101 stays bold
  render: { grazeFix: 1, aerial: { near: 110, far: 1000, line: 0.5, tone: 0.3, bold: BOLD } },
  build: buildTaiwan,
};

function buildTaiwan(scene) {
  const rng = makeRng(808);
  const rand = (a, b) => a + (b - a) * rng();
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  // ---- textures + materials ----------------------------------------------------
  const roofTex = TX.roofTexture();
  const rotated = (tex) => {
    const src = tex.image, c = document.createElement('canvas');
    c.width = src.height; c.height = src.width;
    const g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); g.drawImage(src, -src.width / 2, -src.height / 2);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  };
  const signCache = new Map();
  const signMat = (text, o = {}) => {
    const key = text + JSON.stringify(o);
    if (!signCache.has(key)) signCache.set(key, ink({ map: TX.signTexture(text, o), facing: 0.2, hatch: 0.4 }));
    return signCache.get(key);
  };
  const M = {
    paving: ink({ map: TX.pavingTexture(), tri: 1 / 2.2, facing: 0.25, mapAmt: 0.85, hatch: 0.7 }),
    steps: ink({ map: TX.stoneBlockTexture(), tri: 1 / 1.6, facing: 0.7, mapAmt: 0.85 }),
    boards: ink({ map: TX.boardsTexture(), tri: 1 / 2.0, facing: 0.35, mapAmt: 0.85, tone: 0.95, hatch: 0.8 }),
    boardsDark: ink({ map: TX.boardsTexture(44), tri: 1 / 2.0, facing: 0.6, mapAmt: 0.9, tone: 0.72 }),
    plaster: ink({ map: TX.plasterTexture(), tri: 1 / 3, facing: 0.5, mapAmt: 0.8 }),
    roof: ink({ map: roofTex, tri: 1 / 1.6, tone: 0.62, facing: 0.35, mapAmt: 0.9 }),
    roofR: ink({ map: rotated(roofTex), tri: 1 / 1.6, tone: 0.62, facing: 0.35, mapAmt: 0.9 }),
    lattice: ink({ map: TX.latticeTexture(), facing: 0.2, hatch: 0.3 }),
    paper: ink(),
    paper2: ink({ side: THREE.DoubleSide }),
    light: ink({ tone: 0.93 }),
    gray: ink({ tone: 0.8 }),
    mid: ink({ tone: 0.55 }),
    wood: ink({ tone: 0.82, facing: 0.6 }),
    woodDark: ink({ tone: 0.42, facing: 0.5, hatch: 0.6 }),
    dark: ink({ tone: 0.2, hatch: 0 }),
    black: ink({ tone: 0.04, hatch: 0 }),
    interior: ink({ tone: 0.3, hatch: 0.5, facing: 0.2 }),
    lantern: ink({ map: TX.lanternTexture(''), facing: 0.35, hatchFreq: 30 }),
    lanternTea: ink({ map: TX.lanternTexture('茶'), facing: 0.3, hatchFreq: 30 }),
    lanternFu: ink({ map: TX.lanternTexture('福'), facing: 0.3, hatchFreq: 30 }),
    boba: ink({ map: TX.bobaTexture(), facing: 0.25, hatch: 0.3 }),
    cakeBox: ink({ map: TX.cakeBoxTexture(), facing: 0.2 }),
    bamboo: ink({ map: TX.bambooTexture(), facing: 0.4, repeat: [3, 1] }),
    scrub: ink({ map: TX.scrubTexture(), tri: 1 / 5, facing: 0.2, hatch: 0.4 }),
    noticeA: ink({ map: TX.noticeTexture(['營業中']), facing: 0, side: THREE.DoubleSide }),
    noticeB: ink({ map: TX.noticeTexture(['好吃', '便宜']), facing: 0, side: THREE.DoubleSide }),
    noticeC: ink({ map: TX.noticeTexture(['福']), facing: 0, side: THREE.DoubleSide }),
    norenTea: ink({ map: TX.norenTexture('茶館'), facing: 0.3, side: THREE.DoubleSide }),
    norenBoba: ink({ map: TX.norenTexture('奶茶'), facing: 0.3, side: THREE.DoubleSide }),
    norenTaro: ink({ map: TX.norenTexture('芋圓'), facing: 0.3, side: THREE.DoubleSide }),
    cloth: ink({ tone: 0.95, facing: 0.6, side: THREE.DoubleSide }),
    clothDark: ink({ tone: 0.5, facing: 0.6, side: THREE.DoubleSide }),
    star: ink({ tone: 0.02, hatch: 0 }),
    norenTofu: ink({ map: TX.norenTexture('臭豆腐'), facing: 0.3, side: THREE.DoubleSide }),
    norenCake: ink({ map: TX.norenTexture('鳳梨酥'), facing: 0.3, side: THREE.DoubleSide }),
    norenNoodle: ink({ map: TX.norenTexture('牛肉麵'), facing: 0.3, side: THREE.DoubleSide }),
    norenFruit: ink({ map: TX.norenTexture('水果'), facing: 0.3, side: THREE.DoubleSide }),
    metal: ink({ tone: 0.72, facing: 0.6 }),
    soup: ink({ tone: 0.35, hatch: 0.5, facing: 0.2 }),
    tofu: ink({ tone: 0.86, facing: 0.6, hatchFreq: 60 }),
    fruitLight: ink({ tone: 0.95, facing: 0.7, hatchFreq: 50 }),
    fruitDark: ink({ tone: 0.62, facing: 0.6, hatchFreq: 50 }),
    flag: ink({ map: TX.flagTexture(), side: THREE.DoubleSide, facing: 0.3, hatch: 0.5 }),
  };

  const root = new THREE.Group();
  root.name = 'taiwan';
  scene.add(root);
  const colliders = [];
  const camBlockers = [];
  const interactables = [];
  const updaters = [];
  const stars = [];

  // ---- helpers ------------------------------------------------------------
  function add(geo, mat, parent = root, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  function box(parent, w, h, d, x, y, z, mat, o = {}) {
    const g = o.r ? new RoundedBoxGeometry(w, h, d, o.seg ?? 3, Math.min(o.r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
    const m = add(g, mat, parent, o);
    m.position.set(x, y + h / 2, z);
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    return m;
  }
  function facedBox(parent, w, h, d, x, y, z, base, front, faces = [4], o = {}) {
    const mats = [base, base, base, base, base, base];
    for (const f of faces) mats[f] = front;
    const m = add(new THREE.BoxGeometry(w, h, d), mats, parent, o);
    m.position.set(x, y + h / 2, z);
    if (o.ry) m.rotation.y = o.ry;
    return m;
  }
  function cyl(parent, rt, rb, h, x, y, z, mat, o = {}) {
    const m = add(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20, 1, o.open ?? false), mat, parent, o);
    m.position.set(x, y + h / 2, z);
    return m;
  }
  function sphere(parent, r, x, y, z, mat, s = [1, 1, 1], o = {}) {
    const m = add(new THREE.SphereGeometry(r, o.seg ?? 20, Math.round((o.seg ?? 20) * 0.75)), mat, parent, o);
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
  // per-vertex outline id, so merged geometry still draws a line between its parts
  const solid = (x1, x2, z1, z2) => colliders.push({ type: 'box', minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) });
  const solidCircle = (x, z, r) => colliders.push({ type: 'circle', x, z, r });
  // collider from a box in a group's local frame (group rotated about y only)
  function solidLocal(g, x0, x1, z0, z1) {
    const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y);
    const xs = [], zs = [];
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      xs.push(g.position.x + c * x + s * z);
      zs.push(g.position.z - s * x + c * z);
    }
    solid(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs));
  }
  function wobbler(obj, axis = 'z', amp = 0.25, k = 40, c = 2.2) {
    const s = { v: 0, x: 0, base: obj.rotation[axis] };
    updaters.push((t, dt) => {
      s.v += (-s.x * k - s.v * c) * dt;
      s.x += s.v * dt;
      obj.rotation[axis] = s.base + s.x;
    });
    return (a = amp) => { s.v += a * 6; };
  }
  function actionSpot(id, label, { x, z, radius = 1.0, prompt, act, noReach }) {
    const it = { id, label, kind: 'action', x, z, radius, pos: new THREE.Vector3(...prompt), act, noReach };
    interactables.push(it);
    return it;
  }
  const H = heightAt;
  const npcs = [];
  // A little doodle steam / smoke: puffs rising and fading in a loop.
  function addSteam(parent, local, n, { spread = 0.15, rise = 0.6, size = 0.05 } = {}) {
    const puffs = [];
    for (let i = 0; i < n; i++) puffs.push({ m: sphere(parent, 1, 0, 0, 0, M.paper, [0.001, 0.001, 0.001], { seg: 10, cast: false }), ph: i / n, sx: (Math.sin(i * 7.3) * 0.5) * spread });
    updaters.push((t) => {
      for (const p of puffs) {
        const a = (t * 0.35 + p.ph) % 1;
        p.m.position.set(local.x + p.sx + Math.sin(a * 6 + p.ph * 9) * 0.04, local.y + a * rise, local.z + Math.cos(a * 5 + p.ph) * 0.04);
        p.m.scale.setScalar(Math.max(0.001, Math.sin(a * Math.PI) * (size + a * size)));
      }
    });
  }

  // ---- ground: slabs + real stone steps ---------------------------------------------
  const DEPTH = 1.6;
  for (const r of REGIONS) {
    const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0];
    const cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
    if (r.steps) {
      for (let i = 0; i < r.steps; i++) {
        const a = r.from + ((r.to - r.from) * i) / r.steps, b = r.from + ((r.to - r.from) * (i + 1)) / r.steps;
        const y = r.y0 + ((r.y1 - r.y0) * (i + 1)) / r.steps;
        const bottom = Math.min(r.y0, r.y1) - DEPTH;
        const m = r.axis === 'z'
          ? box(root, w, y - bottom, Math.abs(b - a), cx, bottom, (a + b) / 2, M.steps, { cast: false })
          : box(root, Math.abs(b - a), y - bottom, d, (a + b) / 2, bottom, cz, M.steps, { cast: false });
        camBlockers.push(m);
        // nosing: a lip on each tread, 1 cm proud of the tread and overhanging the riser
        if (r.axis === 'z') box(root, w, 0.03, 0.05, cx, y - 0.02, a - Math.sign(b - a) * 0.015, M.steps, { cast: false });
        else box(root, 0.05, 0.03, d, a - Math.sign(b - a) * 0.015, y - 0.02, cz, M.steps, { cast: false });
      }
    } else if (r.y !== undefined) {
      camBlockers.push(box(root, w, DEPTH, d, cx, r.y - DEPTH, cz, M.paving, { cast: false }));
    } else {
      // gentle slope
      const len = Math.abs(r.to - r.from), dy = r.y1 - r.y0;
      const m = box(root, w, DEPTH, Math.hypot(len, dy), cx, (r.y0 + r.y1) / 2 - DEPTH, cz, M.paving, { cast: false });
      m.position.y = (r.y0 + r.y1) / 2 - DEPTH / 2;
      const hiZ = r.from > r.to ? r.y0 : r.y1, loZ = r.from > r.to ? r.y1 : r.y0;
      m.rotation.x = -Math.atan2(hiZ - loZ, len);
      camBlockers.push(m);
    }
  }

  // ---- buildings ------------------------------------------------------------------
  // Two-storey shophouse. Local frame: origin at the front-center at street
  // level, +z out toward the street, x along the street.
  function shophouse(x, z, ry, W, o = {}) {
    const floor = o.floor ?? 0;
    const g = group(root, x, floor, z, ry);
    const D = o.depth ?? 3.6;
    const H1 = 2.45, H2 = o.h2 ?? 2.05, top = H1 + H2 + (o.extra ?? 0);
    const roofM = Math.abs(Math.sin(ry)) > 0.5 ? M.roofR : M.roof;
    const wallM = o.plaster ? M.plaster : M.boards;
    const base = -(o.plinth ?? 0) - 3;
    // body (upper floor flush with the front, ground floor recessed when it's a shop)
    const shop = o.shop !== false;
    const recess = shop ? 1.3 : 0.05;
    camBlockers.push(box(g, W, top - H1 + 0.02, D, 0, H1 - 0.02, -D / 2, wallM));
    camBlockers.push(box(g, W, H1 - base, D - recess, 0, base, -recess - (D - recess) / 2, shop ? M.interior : wallM));
    // stone plinth where the street drops away along the frontage
    if (o.plinth) box(g, W + 0.02, o.plinth + 0.01, 0.12, 0, -o.plinth - 0.02, 0.05, M.steps, { cast: false }); // top 1 cm under the street
    // ground floor front
    if (shop) {
      box(g, W, 0.1, recess, 0, -0.1, -recess / 2, M.paving, { cast: false });
      // invisible: keeps the camera out of the open shop front
      const shield = new THREE.Mesh(new THREE.PlaneGeometry(W, H1), M.paper);
      shield.position.set(0, H1 / 2, 0.02);
      shield.visible = false;
      g.add(shield);
      camBlockers.push(shield);
      for (const sx of [-1, 1]) {
        box(g, 0.16, H1, 0.16, sx * (W / 2 - 0.08), 0, -0.08, M.woodDark);
        box(g, 0.08, H1, recess, sx * (W / 2 - 0.04), 0, -recess / 2, wallM, { cast: false });
      }
      box(g, W, 0.22, 0.16, 0, H1 - 0.22, -0.08, M.woodDark);
      // shelves and shapes inside the dark shop
      for (let k = 0; k < 2; k++) box(g, W - 0.6, 0.04, 0.35, 0, 1.1 + k * 0.5, -recess + 0.2, M.wood, { cast: false });
      for (let k = 0; k < 7; k++) box(g, rand(0.12, 0.22), rand(0.12, 0.3), 0.18, rand(-W / 2 + 0.5, W / 2 - 0.5), 1.14 + (k % 2) * 0.5, -recess + 0.2, pick([M.light, M.paper, M.gray]), { cast: false });
      if (o.noren) {
        const nr = add(new THREE.PlaneGeometry(Math.min(1.6, W - 0.8), 0.7), o.noren, g, { cast: false });
        nr.position.set(0, H1 - 0.6, -0.2);
      }
    } else {
      // house front: door + window
      box(g, 0.95, 2.05, 0.06, o.doorX ?? -W / 4, 0, 0.01, M.woodDark);
      box(g, 0.05, 2.0, 0.07, (o.doorX ?? -W / 4), 0, 0.03, M.dark);
      facedBox(g, 0.9, 0.8, 0.06, (o.doorX ?? -W / 4) + W / 2 - 0.1, 1.0, 0.01, M.wood, M.lattice, [4]);
    }
    // upper floor: lattice windows, beam, optional balcony
    box(g, W + 0.04, 0.14, 0.2, 0, H1 - 0.04, 0.0, M.woodDark);
    const nWin = W > 3 ? 2 : 1;
    for (let k = 0; k < nWin; k++) {
      const wx = nWin === 1 ? 0 : (k - 0.5) * (W / 2);
      facedBox(g, 0.85, 0.85, 0.08, wx, H1 + 0.55, 0.02, M.woodDark, M.lattice, [4]);
    }
    if (o.balcony) {
      box(g, W - 0.2, 0.08, 0.55, 0, H1 + 0.1, 0.27, M.woodDark);
      for (let k = 0; k <= 6; k++) box(g, 0.04, 0.55, 0.04, -W / 2 + 0.15 + (k * (W - 0.3)) / 6, H1 + 0.18, 0.52, M.woodDark);
      box(g, W - 0.2, 0.05, 0.06, 0, H1 + 0.72, 0.52, M.woodDark);
      if (o.laundry) {
        // drying rack: a bamboo pole with laundry on it
        cyl(g, 0.018, 0.018, W - 0.4, 0, H1 + 1.55, 0.45, M.wood, { seg: 8 }).rotation.z = Math.PI / 2;
        for (const [px, w, h, m] of [[-0.9, 0.42, 0.5, M.cloth], [-0.35, 0.36, 0.62, M.clothDark], [0.2, 0.5, 0.42, M.cloth], [0.75, 0.3, 0.5, M.cloth]]) {
          if (Math.abs(px) > W / 2 - 0.4) continue;
          const c = add(new THREE.PlaneGeometry(w, h), m, g);
          c.position.set(px, H1 + 1.55 - h / 2, 0.45);
          wobbler(c, 'x', 0.05);
          updaters.push((t) => { c.rotation.x = Math.sin(t * 1.3 + px * 3) * 0.06; });
        }
      }
    }
    // gable roof: ridge along local x, deep eaves over the street
    const rise = 1.05, over = 0.75;
    const front = [0, top, over], ridge = [0, top + rise, -D / 2], back = [0, top, -D - 0.3];
    const slope = (a, b) => {
      const dz = b[2] - a[2], dy = b[1] - a[1];
      const L = Math.hypot(dz, dy);
      const m = box(g, W + 0.5, 0.09, L, 0, 0, 0, roofM, { cast: true });
      m.position.set(0, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      m.rotation.x = -Math.atan2(dy, dz);
      camBlockers.push(m);
      return m;
    };
    slope(front, ridge); slope(ridge, back);
    // fascia board along the eave + ridge cap with upturned ends
    box(g, W + 0.5, 0.12, 0.08, 0, top - 0.1, over + 0.02, M.woodDark);
    const cap = cyl(g, 0.07, 0.07, W + 0.6, 0, top + rise - 0.02, -D / 2, M.mid, { seg: 10 });
    cap.rotation.z = Math.PI / 2;
    cap.position.y = top + rise + 0.03;
    for (const sx of [-1, 1]) {
      const tip = cyl(g, 0.02, 0.07, 0.28, sx * (W / 2 + 0.38), top + rise - 0.05, -D / 2, M.mid, { seg: 8 });
      tip.rotation.z = -sx * 0.9;
    }
    // gable ends
    const tri = new THREE.Shape([new THREE.Vector2(-D, top), new THREE.Vector2(0, top), new THREE.Vector2(-D / 2, top + rise)]);
    const gg = new THREE.ExtrudeGeometry(tri, { depth: W - 0.02, bevelEnabled: false });
    gg.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    gg.translate((W - 0.02) / 2, 0, 0);
    add(gg, wallM, g);
    // awning over the shop front
    if (shop && o.awning !== false) {
      const aw = box(g, W + 0.1, 0.06, 1.0, 0, 0, 0, roofM);
      aw.position.set(0, H1 + 0.02, 0.45);
      aw.rotation.x = 0.32;
      box(g, W + 0.1, 0.1, 0.05, 0, H1 - 0.24, 0.93, M.woodDark);
    }
    // hanging sign perpendicular to the facade
    if (o.sign) {
      const sg = o.sign;
      const mat = signMat(sg, { vertical: true, seed: sg.length * 7 });
      const sx = (o.signSide ?? 1) * (W / 2 - 0.25);
      facedBox(g, 0.06, 0.25 + [...sg].length * 0.3, 0.42, sx, H1 + 0.15, 0.55, M.woodDark, mat, [0, 1]);
      box(g, 0.03, 0.03, 0.55, sx, H1 + 0.5 + [...sg].length * 0.3, 0.3, M.black);
    }
    // a horizontal shop board over the opening
    if (o.board) facedBox(g, Math.min(W - 0.6, [...o.board].length * 0.48 + 0.4), 0.42, 0.06, 0, H1 + 1.42, 0.08, M.woodDark, signMat(o.board, { vertical: false, seed: 3 }), [4]);
    // lanterns under the eaves
    if (o.lanterns !== false) {
      for (const sx of [-1, 1]) lantern(g, sx * (W / 2 - 0.55), top - 0.2, 0.55, 0.12, o.lanternMat ?? M.lantern, 0.32);
    }
    // collider for the body (+ counter)
    solidLocal(g, -W / 2, W / 2, -D, o.counter ? 0.32 : 0.02);
    if (o.counter) {
      box(g, W - 0.5, 0.95, 0.45, 0, 0, 0.08, M.boardsDark);
      box(g, W - 0.4, 0.05, 0.55, 0, 0.95, 0.1, M.wood);
    }
    return { g, H1, top, D, W };
  }

  // Paper lantern: lathe body, dark caps, tassel. Returns the swinging group.
  const lanternGeo = (() => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      pts.push(new THREE.Vector2(Math.sin(a) * 1.0 + 0.05, -Math.cos(a) * 1.2));
    }
    return new THREE.LatheGeometry(pts, 20);
  })();
  function lantern(parent, x, y, z, r, mat = M.lantern, drop = 0.25) {
    const pivot = group(parent, x, y, z);
    cyl(pivot, 0.006, 0.006, drop, 0, -drop, 0, M.black, { seg: 5, cast: false });
    const body = add(lanternGeo, mat, pivot);
    body.scale.set(r, r, r);
    body.position.y = -drop - r * 1.25;
    cyl(pivot, r * 0.45, r * 0.45, r * 0.22, 0, -drop - r * 0.15, 0, M.black, { seg: 12 });
    cyl(pivot, r * 0.45, r * 0.45, r * 0.22, 0, -drop - r * 2.45, 0, M.black, { seg: 12 });
    cyl(pivot, 0.01, 0.03, r * 1.1, 0, -drop - r * 3.5, 0, M.black, { seg: 6, cast: false });
    const ph = rand(0, 6);
    updaters.push((t) => { pivot.rotation.z = Math.sin(t * 0.9 + ph) * 0.025; });
    return pivot;
  }

  // A string of small lanterns sagging between two points.
  function lanternString(a, b, n, sag = 0.4) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0)));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 5, false), M.black, root, { cast: false });
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      lantern(root, p.x, p.y, p.z, 0.1, i % 3 === 1 && n > 3 ? M.lanternFu : M.lantern, 0.06);
    }
  }

  function plant(parent, x, y, z, s = 1, pot = M.paper) {
    const p = group(parent, x, y, z);
    p.scale.setScalar(s);
    cyl(p, 0.13, 0.1, 0.22, 0, 0, 0, pot);
    cyl(p, 0.12, 0.12, 0.01, 0, 0.2, 0, M.dark, { cast: false });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand(-0.2, 0.2);
      const st = group(p, 0, 0.2, 0, -a);
      st.rotation.z = rand(0.3, 0.85);
      const len = rand(0.16, 0.3);
      cyl(st, 0.006, 0.006, len, 0, 0, 0, M.black, { seg: 5 });
      const leaf = sphere(st, 0.1, 0, len + 0.06, 0, M.paper, [0.6, 1.25, 0.12], { seg: 14 });
      leaf.rotation.y = Math.PI / 2;
    }
    return p;
  }

  // Wooden railing along a line (posts + two rails) with a collider.
  function railing(x1, z1, x2, z2, yAt, { h = 0.95, posts = 1.1, solidW = 0.12 } = {}) {
    const L = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(L / posts));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, y = yAt(x, z);
      box(root, 0.09, h + 0.05, 0.09, x, y, z, M.woodDark);
    }
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const ax = x1 + (x2 - x1) * t0, az = z1 + (z2 - z1) * t0, bx = x1 + (x2 - x1) * t1, bz = z1 + (z2 - z1) * t1;
      const ya = yAt(ax, az), yb = yAt(bx, bz);
      for (const [hh, th] of [[h, 0.07], [h * 0.5, 0.04]]) {
        const a = new THREE.Vector3(ax, ya + hh, az), b = new THREE.Vector3(bx, yb + hh, bz);
        const len = a.distanceTo(b);
        const m = add(new THREE.BoxGeometry(th, th, len), M.woodDark, root);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.lookAt(b);
      }
      // balusters
      for (let k = 1; k < 4; k++) {
        const t = k / 4, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ya + (yb - ya) * t;
        box(root, 0.03, h * 0.5, 0.03, x, y + h * 0.02, z, M.woodDark, { cast: false });
      }
    }
    const minX = Math.min(x1, x2) - solidW / 2, maxX = Math.max(x1, x2) + solidW / 2;
    const minZ = Math.min(z1, z2) - solidW / 2, maxZ = Math.max(z1, z2) + solidW / 2;
    solid(minX, maxX, minZ, maxZ);
  }
  // street height just inside a railing (railings stand on the edge)
  const yNear = (dx, dz) => (x, z) => { const y = H(x + dx, z + dz); return y > OFF + 1 ? y : H(x - dx, z - dz); };

  // =====================================================================
  // STREET A (top -> tea house), both sides lined with shophouses
  // =====================================================================
  const L = Math.PI / 2, R = -Math.PI / 2;   // left side faces +x, right side faces -x
  const maxH = (z0, z1) => { let m = -1e9; for (let z = z0; z >= z1; z -= 0.2) m = Math.max(m, H(0, z)); return m; };
  const minH = (z0, z1) => { let m = 1e9; for (let z = z0; z >= z1; z -= 0.2) m = Math.min(m, H(0, z)); return m; };
  const side = (sx, z0, z1, o) => {
    const fl = maxH(z0, z1);
    return shophouse(sx * 1.6, (z0 + z1) / 2, sx < 0 ? L : R, z0 - z1, { floor: fl, plinth: fl - minH(z0, z1), ...o });
  };
  // left
  side(-1, 4.6, 1.5, { shop: false, sign: '茶', plaster: true });
  side(-1, 1.5, -1.5, { shop: false, sign: '民宿', balcony: true, plaster: true });
  side(-1, -1.5, -4.4, { shop: false, sign: '書', doorX: 0.5 });
  const boba = side(-1, -4.4, -7.8, { counter: true, noren: M.norenBoba, sign: '珍珠奶茶', board: '珍奶', balcony: true, laundry: true });
  side(-1, -7.8, -10.2, { shop: false, plaster: true, sign: '古早味', signSide: -1 });
  const tofuShop = side(-1, -10.2, -13.0, { counter: true, sign: '臭豆腐', board: '臭豆腐', noren: M.norenTofu });
  // right
  side(1, 4.6, 1.5, { shop: false, sign: '酒', balcony: true });
  side(1, 1.5, -1.5, { shop: false, sign: '老街', plaster: true });
  const taroShop = side(1, -1.5, -4.4, { counter: true, sign: '芋圓', board: '芋圓', noren: M.norenTaro, balcony: true });
  const cakeShop = side(1, -4.4, -7.8, { counter: true, sign: '鳳梨酥', board: '鳳梨酥', signSide: -1, noren: M.norenCake });
  side(1, -7.8, -9.8, { shop: false, sign: '福', plaster: true, balcony: true, laundry: true });
  // the tea house: wider, three storeys, 茶 lantern, noren, counter with teapots
  const tea = shophouse(1.6, -11.4, R, 3.2, { floor: -1.8, counter: true, noren: M.norenTea, sign: '茶館', board: '茶館', extra: 0.9, depth: 4.4, lanternMat: M.lanternTea, balcony: true });
  // top end of the street: a closed shop across the head of the street
  shophouse(0, 4.6, Math.PI, 3.2, { floor: 0, shop: false, sign: '九份', plaster: true, lanterns: true });
  solid(-1.7, 1.7, 4.55, 5.4);

  // archway over the top of the stairs: 九份老街
  {
    const g = group(root, 0, 0, -1.75);
    // tall enough that Taipei 101 shows under the sign from the start of the street
    for (const sx of [-1, 1]) box(g, 0.2, 3.95, 0.2, sx * 1.42, 0, 0, M.woodDark);
    box(g, 3.3, 0.18, 0.24, 0, 3.7, 0, M.woodDark);
    facedBox(g, 1.9, 0.5, 0.08, 0, 3.15, 0, M.woodDark, signMat('九份老街', { vertical: false, seed: 9 }), [4, 5]);
    box(g, 3.7, 0.08, 0.7, 0, 3.9, 0, M.roof, { r: 0.02 });
    for (const sx of [-1, 1]) lantern(g, sx * 1.1, 3.65, 0.2, 0.13, M.lanternFu, 0.15);
    solidCircle(-1.42, -1.75, 0.14);
    solidCircle(1.42, -1.75, 0.14);
  }

  // Tea house props: counter with teapots, stacked cups, tea tins; the auntie.
  {
    const g = tea.g;
    const pot = (x, z, s = 1) => {
      const p = group(g, x, 1.0, z);
      p.scale.setScalar(s);
      const prof = [[0, 0], [0.07, 0.005], [0.095, 0.05], [0.09, 0.1], [0.055, 0.13], [0.03, 0.14], [0, 0.14]].map(([a, b]) => new THREE.Vector2(a, b));
      add(new THREE.LatheGeometry(prof, 20), M.paper, p);
      sphere(p, 0.022, 0, 0.15, 0, M.dark);
      const sp = cyl(p, 0.012, 0.02, 0.09, 0.1, 0.04, 0, M.paper, { seg: 8 });
      sp.rotation.z = -0.9;
      const hd = add(new THREE.TorusGeometry(0.045, 0.01, 6, 12, Math.PI * 1.2), M.paper, p);
      hd.position.set(-0.1, 0.08, 0); hd.rotation.z = Math.PI * 0.45;
      return p;
    };
    pot(-0.9, 0.12); pot(-0.55, 0.2, 0.8); pot(0.75, 0.15, 1.1);
    // cup stacks
    for (const [x, n] of [[-0.2, 4], [-0.08, 3], [0.06, 5], [0.35, 2]]) {
      for (let i = 0; i < n; i++) cyl(g, 0.035, 0.028, 0.045, x, 1.0 + i * 0.035, 0.2, M.paper, { seg: 12 });
    }
    // tea tins on the shelf behind
    for (let i = 0; i < 6; i++) cyl(g, 0.07, 0.07, 0.18, -1.0 + i * 0.4, 1.15, -1.1, i % 2 ? M.mid : M.paper, { seg: 14 });
    facedBox(g, 0.5, 0.65, 0.02, 1.2, 1.4, -0.06, M.paper, M.noticeA, [4]);
  }
  const auntie = createCharacter({ style: 'auntie' });
  // behind the counter, facing the street
  auntie.root.position.set(2.15, -1.8 + 0.38, -11.55); // on the raised shop floor
  box(tea.g, 3.0, 0.38, 0.9, 0, 0, -0.75, M.boardsDark, { cast: false });
  auntie.root.rotation.y = -Math.PI / 2;
  root.add(auntie.root);
  let auntieLook = -Math.PI / 2;

  // the big 茶 lantern at the tea house corner (touch: it sways)
  const bigLantern = lantern(root, 1.25, -1.8 + 2.4, -10.1, 0.3, M.lanternTea, 0.12);
  const swingBig = wobbler(bigLantern, 'x', 0.28, 9, 0.9);
  const swingBig2 = wobbler(bigLantern, 'z', 0.15, 11, 1.0);

  // Bubble tea counter: the cup (a collectible) + menu + sealer machine
  {
    const g = boba.g;
    box(g, 0.32, 0.38, 0.3, -0.9, 1.0, 0.0, M.light, { r: 0.03 });
    cyl(g, 0.07, 0.07, 0.04, -0.9, 1.38, 0.0, M.dark);
    facedBox(g, 0.7, 0.9, 0.03, 0.95, 1.25, -0.05, M.paper, M.noticeB, [4]);
    for (let i = 0; i < 4; i++) cyl(g, 0.045, 0.04, 0.14, 0.2 + i * 0.12, 1.0, 0.18, M.paper, { seg: 12 });
  }

  // =====================================================================
  // PLAZA (the bend): stalls, cat, scooter, mailbox, overlook, shrine alley
  // =====================================================================
  const PY = -1.8;
  // east building (snack shop facing the plaza, -x)
  const noodleShop = shophouse(5.6, -14.8, R, 3.6, { floor: PY, counter: true, sign: '麵', board: '牛肉麵', noren: M.norenNoodle });
  // tea house's south wall gets a stone ledge for the cat
  box(root, 1.1, 0.85, 0.36, 2.55, PY, -13.18, M.steps);
  solid(2.0, 3.1, -13.36, -13.0);
  // west wall corners + alley walls with tiled coping
  const wallWithCoping = (x0, x1, z0, z1, y0, h) => {
    const w = Math.abs(x1 - x0) || 0.3, d = Math.abs(z1 - z0) || 0.3;
    camBlockers.push(box(root, w, h + 3, d, (x0 + x1) / 2, y0 - 3, (z0 + z1) / 2, M.plaster));
    box(root, w + 0.12, 0.1, d + 0.12, (x0 + x1) / 2, y0 + h, (z0 + z1) / 2, M.roof);
    solid(Math.min(x0, x1) - (w === 0.3 ? 0.15 : 0), Math.max(x0, x1) + (w === 0.3 ? 0.15 : 0), Math.min(z0, z1) - (d === 0.3 ? 0.15 : 0), Math.max(z0, z1) + (d === 0.3 ? 0.15 : 0));
  };
  wallWithCoping(-7.4, -1.6, -13.25, -13.55, PY, 2.6);   // alley north
  wallWithCoping(-7.4, -1.6, -15.65, -15.95, PY, 2.6);   // alley south
  wallWithCoping(-1.75, -1.45, -15.8, -16.75, PY, 1.1);  // plaza west corner (low)
  // shrine alley gate (paifang) with a plaque
  {
    const g = group(root, -2.0, PY, -14.6, Math.PI / 2);
    for (const sx of [-1, 1]) {
      box(g, 0.22, 2.9, 0.22, sx * 1.0, 0, 0, M.woodDark);
      box(g, 0.34, 0.3, 0.34, sx * 1.0, 0, 0, M.steps);
    }
    box(g, 2.5, 0.16, 0.22, 0, 2.55, 0, M.woodDark);
    facedBox(g, 1.15, 0.38, 0.06, 0, 2.1, 0, M.dark, ink({ map: TX.plaqueTexture('福德宮'), facing: 0.2 }), [4, 5]);
    box(g, 2.9, 0.08, 0.6, 0, 2.95, 0, M.roof);
    for (const sx of [-1, 1]) { const t = cyl(g, 0.02, 0.06, 0.25, sx * 1.48, 2.95, 0, M.mid, { seg: 8 }); t.rotation.z = -sx * 1.0; }
    box(g, 0.1, 0.1, 2.0, 0, 3.05, 0, M.mid).rotation.z = Math.PI / 2;
  }
  // the shrine at the end of the alley
  const SY = -1.35;
  {
    const g = group(root, -6.75, SY, -14.6, Math.PI / 2);
    box(g, 2.0, 0.35, 0.9, 0, 0, -0.1, M.steps);
    box(g, 1.6, 1.5, 0.75, 0, 0.35, -0.15, M.boardsDark);
    box(g, 1.1, 0.95, 0.1, 0, 0.55, 0.24, M.interior);
    sphere(g, 0.16, 0, 0.75, 0.15, M.paper, [1, 1.2, 0.8]);
    box(g, 2.1, 0.1, 1.2, 0, 1.85, -0.1, M.roof, { rx: 0.0 });
    box(g, 1.4, 0.4, 0.9, 0, 1.95, -0.15, M.roof, { r: 0.08 });
    for (const sx of [-1, 1]) { const t = cyl(g, 0.02, 0.07, 0.3, sx * 1.08, 1.85, 0.5, M.mid, { seg: 8 }); t.rotation.z = -sx * 1.0; }
    for (const sx of [-1, 1]) lantern(g, sx * 0.7, 1.8, 0.45, 0.11, M.lanternFu, 0.12);
    // offering table + incense burner with smoking sticks
    box(g, 1.2, 0.75, 0.45, 0, 0, 0.8, M.woodDark);
    cyl(g, 0.17, 0.13, 0.2, 0, 0.75, 0.8, M.dark, { seg: 18 });
    for (const sx of [-1, 1]) { const ear = add(new THREE.TorusGeometry(0.05, 0.012, 6, 12), M.dark, g); ear.position.set(sx * 0.17, 0.98, 0.8); ear.rotation.y = Math.PI / 2; }
    for (let i = 0; i < 3; i++) cyl(g, 0.005, 0.005, 0.32, -0.05 + i * 0.05, 0.9, 0.8, M.black, { seg: 4 });
    for (const sx of [-1, 1]) { cyl(g, 0.05, 0.06, 0.12, sx * 0.42, 0.75, 0.8, M.paper); sphere(g, 0.045, sx * 0.42, 0.9, 0.8, M.light); }
    solidLocal(g, -1.05, 1.05, -0.6, 1.05);
    // incense smoke wisps
    const smoke = [];
    for (let i = 0; i < 6; i++) smoke.push({ m: sphere(root, 1, 0, 0, 0, M.paper, [0.03, 0.03, 0.03], { seg: 10, cast: false }), ph: i / 6 });
    const base = new THREE.Vector3(-6.75 + 0.8, SY + 1.25, -14.6);
    updaters.push((t) => {
      for (const s of smoke) {
        const a = (t * 0.25 + s.ph) % 1;
        s.m.position.set(base.x + Math.sin(a * 9 + s.ph * 6) * 0.05, base.y + a * 0.9, base.z + Math.cos(a * 7) * 0.04);
        s.m.scale.setScalar(0.02 + a * 0.06 * (1 - a));
      }
    });
    plant(root, -4.5, SY, -13.75, 1.6);
    plant(root, -4.5, SY, -15.45, 1.4);
  }

  // overlook railing on the plaza's south edge, low wall at the alley corner
  railing(-1.45, -16.55, 2.6, -16.55, yNear(0, 0.3));
  // steamer stall (xiaolongbao): cart with stacked bamboo baskets
  const steamer = { puffs: [], t: 9 };
  {
    const g = group(root, 4.25, PY, -13.42, Math.PI);
    box(g, 1.3, 0.85, 0.62, 0, 0, 0, M.boardsDark);
    box(g, 1.4, 0.05, 0.7, 0, 0.85, 0, M.wood);
    for (const sx of [-1, 1]) box(g, 0.06, 1.25, 0.06, sx * 0.66, 0.9, 0.3, M.woodDark);
    const sh = box(g, 1.55, 0.06, 0.9, 0, 2.15, 0.12, M.roof);
    sh.rotation.x = -0.18;
    facedBox(g, 0.9, 0.3, 0.04, 0, 1.75, 0.31, M.woodDark, signMat('小籠包', { vertical: false, seed: 13 }), [4]);
    for (const [x, n] of [[-0.3, 3], [0.18, 2]]) {
      for (let i = 0; i < n; i++) {
        const b = add(new THREE.CylinderGeometry(0.2, 0.2, 0.11, 24, 1, false), [M.bamboo, M.paper, M.paper], g);
        b.position.set(x, 0.92 + i * 0.12, 0.02);
      }
      const lid = add(new THREE.SphereGeometry(0.2, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.bamboo, g);
      lid.position.set(x, 0.87 + n * 0.12, 0.02);
      lid.scale.y = 0.35;
    }
    // little dumplings on a plate
    cyl(g, 0.14, 0.12, 0.02, 0.5, 0.88, 0.12, M.paper);
    for (let i = 0; i < 4; i++) sphere(g, 0.035, 0.45 + (i % 2) * 0.08, 0.92, 0.08 + Math.floor(i / 2) * 0.08, M.light, [1, 0.8, 1]);
    solid(4.25 - 0.72, 4.25 + 0.72, -13.42 - 0.38, -13.0);
    for (let i = 0; i < 12; i++) steamer.puffs.push({ m: sphere(root, 1, 0, 0, 0, M.paper, [0.001, 0.001, 0.001], { seg: 12, cast: false }), ph: i / 12 });
  }
  const steamBase = new THREE.Vector3(4.25 + 0.3, PY + 1.32, -13.44);
  // skewer stall (烤肉串): grill with rows of skewers, a basket of sauces, a sign
  {
    const g = group(root, 4.72, PY, -15.2, -Math.PI / 2);
    box(g, 1.2, 0.85, 0.6, 0, 0, 0, M.boardsDark);
    box(g, 0.82, 0.12, 0.44, -0.15, 0.85, 0, M.dark);
    box(g, 0.78, 0.01, 0.4, -0.15, 0.97, 0, M.metal);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 7; i++) {
        const x = -0.5 + i * 0.105, z = -0.1 + row * 0.2;
        const sk = cyl(g, 0.005, 0.005, 0.34, x, 0.985, z, M.wood, { seg: 5 });
        sk.rotation.x = Math.PI / 2;
        for (let k = 0; k < 3; k++) box(g, 0.04, 0.035, 0.045, x, 0.97, z - 0.07 + k * 0.06, k % 2 ? M.mid : M.dark);
      }
    }
    // sauce basket: woven basket with three bottles + a brush
    const bk = group(g, 0.42, 0.85, 0.02);
    add(new THREE.CylinderGeometry(0.13, 0.11, 0.12, 18, 1, true), M.bamboo, bk).position.y = 0.06;
    cyl(bk, 0.11, 0.11, 0.01, 0, 0, 0, M.wood);
    for (const [x, z, h, m] of [[-0.05, -0.03, 0.2, M.dark], [0.05, -0.02, 0.17, M.paper], [0.0, 0.05, 0.22, M.mid]]) { cyl(bk, 0.03, 0.03, h, x, 0.01, z, m, { seg: 10 }); cyl(bk, 0.012, 0.016, 0.04, x, 0.01 + h, z, M.black, { seg: 8 }); }
    const brush = cyl(bk, 0.008, 0.008, 0.3, 0.09, 0.1, 0.05, M.wood, { seg: 5 }); brush.rotation.z = -0.35;
    // sign on a post
    box(g, 0.05, 1.2, 0.05, 0.55, 0.85, -0.25, M.woodDark);
    facedBox(g, 0.62, 0.3, 0.04, 0.3, 1.75, -0.25, M.woodDark, signMat('烤肉串', { vertical: false, seed: 31 }), [4]);
    // smoke from the grill
    addSteam(g, new THREE.Vector3(-0.15, 1.05, 0), 5, { spread: 0.25, rise: 0.55, size: 0.022 });
    solidLocal(g, -0.65, 0.65, -0.35, 0.35);
  }
  // scooter parked by the low wall
  {
    const g = group(root, -0.8, PY, -16.05, Math.PI / 2 + 0.08);
    const body = M.light;
    box(g, 0.32, 0.12, 0.85, 0, 0.18, 0, body, { r: 0.05 });
    box(g, 0.36, 0.42, 0.55, 0, 0.3, -0.25, body, { r: 0.12 });
    box(g, 0.3, 0.12, 0.5, 0, 0.72, -0.22, M.dark, { r: 0.05 });
    box(g, 0.3, 0.75, 0.16, 0, 0.18, 0.4, body, { r: 0.07, rx: -0.25 });
    cyl(g, 0.02, 0.02, 0.5, 0, 0.95, 0.47, M.dark, { seg: 8 }).rotation.z = Math.PI / 2;
    sphere(g, 0.06, 0, 0.88, 0.52, M.paper);
    for (const z of [-0.45, 0.48]) { const wh = cyl(g, 0.17, 0.17, 0.09, 0, 0.0, z, M.dark, { seg: 20 }); wh.rotation.z = Math.PI / 2; wh.position.y = 0.17; }
    for (const sx of [-1, 1]) { cyl(g, 0.008, 0.008, 0.2, sx * 0.24, 0.95, 0.45, M.black, { seg: 4 }); sphere(g, 0.04, sx * 0.26, 1.15, 0.45, M.dark, [1, 0.7, 0.4]); }
    solidLocal(g, -0.22, 0.22, -0.65, 0.62);
  }
  // mailboxes (one for local mail, one for express) by the lower stairs
  {
    const g = group(root, 2.15, PY, -16.15, -0.25);
    for (const [sx, m] of [[-0.21, M.light], [0.21, M.mid]]) {
      box(g, 0.08, 0.6, 0.08, sx, 0, 0, M.dark);
      box(g, 0.36, 0.5, 0.36, sx, 0.6, 0, m, { r: 0.04 });
      sphere(g, 0.18, sx, 1.1, 0, m, [1, 0.5, 1]);
      box(g, 0.2, 0.025, 0.02, sx, 0.98, 0.18, M.black);
    }
    facedBox(g, 0.18, 0.18, 0.02, -0.21, 0.75, 0.18, M.light, signMat('郵', { vertical: true, w: 128, h: 128, border: false }), [4]);
    solid(1.85, 2.48, -16.45, -15.85);
  }
  // potted plants on the steps + paper signs
  plant(root, 1.3, H(1.3, -8.0), -8.0, 1.2);
  plant(root, -1.3, H(-1.3, -9.4), -9.4, 1.0);
  plant(root, -1.32, H(-1.32, -2.3), -2.3, 1.1);
  plant(root, 1.32, H(1.32, -3.9), -3.9, 0.9);
  for (const [x, z] of [[1.3, -8.0], [-1.3, -9.4], [-1.32, -2.3], [1.32, -3.9]]) solidCircle(x, z, 0.22);

  // =====================================================================
  // LOWER STREET + LOOKOUT
  // =====================================================================
  const sideC = (z0, z1, o) => {
    let fl = -1e9, lo = 1e9;
    for (let z = z0; z >= z1; z -= 0.2) { fl = Math.max(fl, H(4, z)); lo = Math.min(lo, H(4, z)); }
    return shophouse(5.6, (z0 + z1) / 2, R, z0 - z1, { floor: fl, plinth: fl - lo, ...o });
  };
  sideC(-16.6, -19.4, { shop: false, sign: '茶', plaster: true, balcony: true, laundry: true });
  const fruitShop = sideC(-19.4, -22.2, { counter: true, sign: '水果', board: '水果', noren: M.norenFruit });
  sideC(-22.2, -24.6, { shop: false, sign: '民宿' });
  // open left side: railing above the roofs
  railing(2.62, -16.6, 2.62, -24.55, yNear(0.3, 0));
  // lookout edges
  railing(0.45, -24.6, 2.6, -24.6, yNear(0, -0.3));
  railing(0.45, -24.6, 0.45, -28.95, yNear(0.3, 0));
  railing(0.45, -28.95, 8.55, -28.95, yNear(0, 0.3));
  railing(8.55, -24.6, 8.55, -28.95, yNear(-0.3, 0));
  wallWithCoping(5.6, 8.6, -24.45, -24.75, -3.9, 1.0);
  const LY = -3.9;
  // bench (sit) + coin binoculars
  {
    const g = group(root, 2.3, LY, -27.6, Math.PI);
    box(g, 1.5, 0.06, 0.45, 0, 0.42, 0, M.wood, { r: 0.01 });
    for (const sx of [-1, 1]) { box(g, 0.08, 0.42, 0.4, sx * 0.62, 0, 0, M.woodDark); }
    box(g, 1.5, 0.3, 0.05, 0, 0.6, -0.22, M.wood, { rx: -0.1 });
    solidLocal(g, -0.78, 0.78, -0.28, 0.25);
    const gb = group(root, 7.3, LY, -28.3);
    cyl(gb, 0.05, 0.08, 1.0, 0, 0, 0, M.dark, { seg: 12 });
    box(gb, 0.34, 0.2, 0.2, 0, 1.0, 0, M.mid, { r: 0.05 });
    for (const sx of [-1, 1]) { const tb = cyl(gb, 0.05, 0.05, 0.16, sx * 0.08, 1.02, -0.12, M.dark, { seg: 12 }); tb.rotation.x = Math.PI / 2; tb.position.y = 1.1; }
    solidCircle(7.3, -28.3, 0.22);
  }
  plant(root, 0.85, LY, -25.1, 1.5);
  plant(root, 8.15, LY, -25.1, 1.3);
  solidCircle(0.85, -25.1, 0.25);
  solidCircle(8.15, -25.1, 0.24);

  // ---- the Taiwan flag on a pole by the start landing ----------------------------------
  // 青天白日滿地紅: a 3:2 cloth waving with a sine wave in the vertices (pinned at the pole)
  {
    const g = group(root, -1.28, 0, -0.9);
    cyl(g, 0.16, 0.18, 0.14, 0, 0, 0, M.steps);
    cyl(g, 0.028, 0.036, 2.55, 0, 0.14, 0, M.metal, { seg: 12 });
    sphere(g, 0.06, 0, 2.72, 0, M.metal);
    const W = 1.05, Hh = 0.7;
    const geo = new THREE.PlaneGeometry(W, Hh, 28, 14);
    geo.translate(W / 2, 0, 0);
    const cloth = add(geo, M.flag, g, { cast: true, receive: false });
    cloth.position.set(0.03, 2.32, 0);
    const pos = geo.attributes.position;
    pos.setUsage(THREE.DynamicDrawUsage);
    const base = Float32Array.from(pos.array);
    for (const y of [2.67, 1.97]) { const r = add(new THREE.TorusGeometry(0.04, 0.008, 6, 12), M.black, g); r.position.set(0, y, 0); r.rotation.x = Math.PI / 2; }
    solidCircle(-1.28, -0.9, 0.2);
    updaters.push((t) => {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1], u = x / W;
        const wave = Math.sin(x * 5.2 - t * 3.1 + y * 0.8) * 0.065 + Math.sin(x * 9.0 - t * 4.7) * 0.018;
        pos.setXYZ(i, x - u * u * 0.03, y - u * u * 0.04 + Math.sin(x * 4 - t * 2.3) * 0.01 * u, wave * u);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    });
  }
  actionSpot('flag', 'Look at the flag', {
    x: -0.75, z: -0.6, radius: 0.75, prompt: [-0.85, 1.75, -0.9],
    act(ctx) { ctx.frame(0.9, 0.18); ctx.caption('The flag of Taiwan, waving over the old street.', 3.6); },
  });

  // ---- food stalls: every counter gets its food, a sign, and some a vendor ----------------
  // (shophouse frames: origin at the front-center floor, +z out to the street,
  //  counter top at y 1.0 between z -0.15 and 0.38)
  const CT = 1.0;
  const bowl = (g, x, y, z, r = 0.075, fill = null) => {
    const b = add(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.paper2, g);
    b.position.set(x, y + r, z);
    const rim = add(new THREE.TorusGeometry(r, 0.006, 5, 18), M.paper, g);
    rim.rotation.x = Math.PI / 2; rim.position.set(x, y + r, z);
    if (fill) cyl(g, r * 0.9, r * 0.9, 0.005, x, y + r * 0.75, z, fill, { seg: 16, cast: false });
    return b;
  };
  const pot = (g, x, z, r, h, y = CT) => {
    add(new THREE.CylinderGeometry(r, r * 0.95, h, 22, 1, true), M.metal, g).position.set(x, y + h / 2, z);
    add(new THREE.CylinderGeometry(r * 0.97, r * 0.92, h * 0.98, 22, 1, true), M.paper2, g).position.set(x, y + h / 2, z);
    cyl(g, r * 0.95, r * 0.95, 0.01, x, y + h * 0.75, z, M.soup, { seg: 20, cast: false });
    cyl(g, r * 0.95, r * 0.95, 0.01, x, y, z, M.metal, { seg: 20 });
    for (const sx of [-1, 1]) { const hd = add(new THREE.TorusGeometry(0.035, 0.01, 6, 10, Math.PI), M.metal, g); hd.position.set(x + sx * (r + 0.02), y + h * 0.8, z); hd.rotation.y = Math.PI / 2; hd.rotation.x = Math.PI / 2; }
  };
  const vendor = (g, x, z, opts, line, label, stand) => {
    box(g, 1.2, 0.38, 0.6, x, 0, z, M.boardsDark, { cast: false });
    const v = createCharacter({ style: 'auntie', ...opts });
    v.root.position.set(x, 0.38, z);
    g.add(v.root);
    npcs.push(v);
    const wp = g.localToWorld(new THREE.Vector3(x, 1.95, z));
    const sp = g.localToWorld(new THREE.Vector3(stand[0], 0, stand[1]));
    actionSpot(`vendor-${label}`, label, {
      x: sp.x, z: sp.z, radius: 1.0, prompt: [wp.x, wp.y, wp.z],
      act(ctx) { ctx.caption(line, 3.8); v.reach(); ctx.sound('talk'); },
    });
    return v;
  };
  root.updateMatrixWorld(true);

  // 臭豆腐 stinky tofu: a fryer, a tray of tofu cubes, pickled cabbage, steam, the tofu uncle
  {
    const g = tofuShop.g;
    box(g, 0.5, 0.22, 0.36, -0.75, CT, 0.12, M.metal);
    box(g, 0.44, 0.01, 0.3, -0.75, CT + 0.215, 0.12, M.soup, { cast: false });
    box(g, 0.2, 0.1, 0.16, -0.75, CT + 0.17, 0.12, M.metal);
    cyl(g, 0.008, 0.008, 0.3, -0.75, CT + 0.25, 0.25, M.black, { seg: 5 }).rotation.x = -1.0;
    box(g, 0.42, 0.04, 0.3, 0.05, CT, 0.14, M.wood);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) box(g, 0.075, 0.06, 0.075, -0.1 + i * 0.1, CT + 0.04, 0.04 + k * 0.1, M.tofu, { r: 0.008 });
    bowl(g, 0.55, CT, 0.16, 0.09, M.mid);
    for (let i = 0; i < 4; i++) box(g, 0.08, 0.02, 0.05, 0.5 + (i % 2) * 0.06, CT + 0.07, 0.12 + (i >> 1) * 0.06, M.light, { ry: i });
    addSteam(g, new THREE.Vector3(-0.75, CT + 0.28, 0.12), 6, { spread: 0.16, rise: 0.6, size: 0.024 });
    vendor(g, 0, -0.62, { bun: false, topTone: 0.88 }, 'Stinky tofu! Smells strong, tastes even better.', 'Talk to the tofu vendor', [0, 1.05]);
  }
  // 芋圓 taro balls: a big pot of taro balls, dessert bowls, a ladle
  {
    const g = taroShop.g;
    pot(g, -0.7, 0.12, 0.17, 0.2);
    for (let i = 0; i < 9; i++) sphere(g, 0.028, -0.7 + Math.cos(i * 2.4) * 0.09, CT + 0.17, 0.12 + Math.sin(i * 2.4) * 0.09, i % 3 ? M.fruitDark : M.light, [1, 0.8, 1], { seg: 8 });
    const ladle = cyl(g, 0.008, 0.008, 0.35, -0.6, CT + 0.15, 0.12, M.metal, { seg: 5 }); ladle.rotation.z = -0.7;
    for (let i = 0; i < 3; i++) {
      bowl(g, 0.0 + i * 0.22, CT, 0.18, 0.07, M.light);
      for (let k = 0; k < 4; k++) sphere(g, 0.018, i * 0.22 + (k - 1.5) * 0.025, CT + 0.06, 0.18 + (k % 2) * 0.02, k % 2 ? M.fruitDark : M.mid, [1, 0.8, 1], { seg: 6 });
    }
    for (let i = 0; i < 4; i++) cyl(g, 0.075, 0.05, 0.035, 0.75, CT + i * 0.033, 0.12, M.paper, { seg: 16 });
    facedBox(g, 0.5, 0.65, 0.02, -0.9, 1.35, -1.2, M.paper, M.noticeB, [4]);
  }
  // 鳳梨酥 pineapple cakes: boxes stacked in the window and on the counter
  {
    const g = cakeShop.g;
    for (let col = 0; col < 3; col++) for (let k = 0; k < 4 - col; k++) facedBox(g, 0.3, 0.075, 0.22, -0.75 + col * 0.34, CT + k * 0.075, 0.12, M.paper, M.cakeBox, [2], { ry: (k % 2) * 0.06 });
    facedBox(g, 0.36, 0.08, 0.25, 0.45, CT, 0.15, M.paper, M.cakeBox, [2], { ry: 0.25 });
    // a plate of samples
    cyl(g, 0.12, 0.1, 0.015, 0.85, CT, 0.15, M.paper, { seg: 18 });
    for (let i = 0; i < 4; i++) box(g, 0.05, 0.03, 0.04, 0.8 + (i % 2) * 0.07, CT + 0.015, 0.12 + (i >> 1) * 0.06, M.fruitLight, { r: 0.006 });
    // the shop window: more boxes on the shelves inside
    for (let k = 0; k < 2; k++) for (let i = 0; i < 5; i++) facedBox(g, 0.26, 0.07, 0.2, -1.0 + i * 0.5, 1.14 + k * 0.5, -1.1, M.paper, M.cakeBox, [4]);
  }
  // 牛肉麵 noodles: a steaming pot, stacked bowls, chopsticks in a holder, the cook
  {
    const g = noodleShop.g;
    pot(g, -0.85, 0.12, 0.2, 0.26);
    addSteam(g, new THREE.Vector3(-0.85, CT + 0.3, 0.12), 6, { spread: 0.18, rise: 0.65, size: 0.026 });
    for (let i = 0; i < 5; i++) cyl(g, 0.08, 0.055, 0.04, -0.3, CT + i * 0.035, 0.15, M.paper, { seg: 16 });
    for (let i = 0; i < 4; i++) cyl(g, 0.08, 0.055, 0.04, -0.12, CT + i * 0.035, 0.2, M.paper, { seg: 16 });
    bowl(g, 0.3, CT, 0.17, 0.085, M.soup);
    cyl(g, 0.04, 0.04, 0.12, 0.7, CT, 0.15, M.wood, { seg: 12 });
    for (let i = 0; i < 6; i++) { const c = cyl(g, 0.004, 0.004, 0.2, 0.7 + Math.cos(i) * 0.02, CT + 0.05, 0.15 + Math.sin(i) * 0.02, M.light, { seg: 4 }); c.rotation.z = (i - 2.5) * 0.04; }
    vendor(g, 0.2, -0.62, { bun: false, topTone: 1 }, 'Beef noodles, simmered since dawn. Want a bowl?', 'Talk to the noodle cook', [0.2, 1.05]);
  }
  // 水果 fruit: baskets of fruit and a hanging scale, the fruit seller
  {
    const g = fruitShop.g;
    const basket = (x, z, fruit) => {
      add(new THREE.CylinderGeometry(0.17, 0.13, 0.12, 20, 1, true), M.bamboo, g).position.set(x, CT + 0.06, z);
      cyl(g, 0.13, 0.13, 0.01, x, CT, z, M.wood);
      fruit(x, z);
    };
    basket(-0.85, 0.12, (x, z) => { for (let i = 0; i < 7; i++) sphere(g, 0.05, x + Math.cos(i * 2.2) * 0.08, CT + 0.12 + (i > 4 ? 0.05 : 0), z + Math.sin(i * 2.2) * 0.07, M.fruitLight, [1, 1.1, 1], { seg: 12 }); }); // guavas
    basket(-0.35, 0.16, (x, z) => { for (let i = 0; i < 5; i++) { const m = sphere(g, 0.055, x + Math.cos(i * 1.9) * 0.07, CT + 0.13, z + Math.sin(i * 1.9) * 0.06, M.fruitDark, [1.35, 0.95, 0.9], { seg: 12 }); m.rotation.y = i; } }); // mangoes
    basket(0.25, 0.14, (x, z) => { for (let i = 0; i < 6; i++) sphere(g, 0.04, x + Math.cos(i * 2.5) * 0.08, CT + 0.11, z + Math.sin(i * 2.5) * 0.07, M.mid, [1, 1, 1], { seg: 10 }); }); // wax apples
    // a pineapple
    sphere(g, 0.08, 0.75, CT + 0.11, 0.15, M.fruitDark, [1, 1.35, 1], { seg: 14 });
    for (let i = 0; i < 6; i++) { const lf = cyl(g, 0.0, 0.025, 0.14, 0.75, CT + 0.2, 0.15, M.dark, { seg: 4 }); lf.rotation.set(Math.cos(i) * 0.5, 0, Math.sin(i) * 0.5); }
    // hanging scale from the awning beam: hook, dial, pan on three cords
    const sc = group(g, 0.6, 1.55, 0.55);
    cyl(sc, 0.006, 0.006, 0.55, 0, 0.2, 0, M.black, { seg: 4 });
    const dial = cyl(sc, 0.09, 0.09, 0.04, 0, 0.12, 0, M.paper, { seg: 18 }); dial.rotation.x = Math.PI / 2;
    const ring = add(new THREE.TorusGeometry(0.09, 0.012, 6, 18), M.metal, sc); ring.position.y = 0.14;
    box(sc, 0.006, 0.06, 0.004, 0, 0.15, 0.025, M.black, { rz: 0.5 });
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const cord = cyl(sc, 0.003, 0.003, 0.24, Math.cos(a) * 0.06, -0.2, Math.sin(a) * 0.06, M.black, { seg: 3 }); cord.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); }
    cyl(sc, 0.13, 0.11, 0.03, 0, -0.24, 0, M.metal, { seg: 18 });
    wobbler(sc, 'z', 0.1, 12, 1.2);
    updaters.push((t) => { sc.rotation.x = Math.sin(t * 0.8) * 0.03; });
    vendor(g, -0.3, -0.62, { bun: true, topTone: 0.6 }, 'Guava and mango, picked this morning. Sweet as can be!', 'Talk to the fruit seller', [-0.3, 1.05]);
  }

  // ---- overhead lantern strings across the streets ------------------------------------
  for (let z = 2.8; z > -13; z -= 2.2) {
    const yA = H(0, z) + 3.55, yB = H(0, z - 1.1) + 3.55;
    lanternString(new THREE.Vector3(-1.6, yA, z), new THREE.Vector3(1.6, yB, z - 1.1), 5, 0.42);
  }
  for (let z = -17.2; z > -24.5; z -= 2.4) {
    const yA = H(4, z) + 3.4;
    box(root, 0.1, 3.75, 0.1, 2.62, H(4, z), z, M.woodDark);
    lanternString(new THREE.Vector3(2.65, yA + 0.2, z), new THREE.Vector3(5.6, yA, z - 1.0), 4, 0.38);
  }
  // across the plaza diagonal
  lanternString(new THREE.Vector3(-1.6, PY + 3.6, -13.2), new THREE.Vector3(5.6, PY + 3.6, -16.4), 8, 0.6);

  // ---- hillside below: houses on terraces stepping down toward the city (./taiwan/hillside.js)
  const houseKit = makeHouseKit(); // the hillside and the ridge villages share one set of materials
  {
    const HS = 0.32; // hillside drops 0.32 m per meter toward the city
    const hillY = (x, z) => -5.6 + (z + 17) * HS - Math.max(0, -x - 4) * 0.1;
    const hill = new THREE.Mesh(new THREE.PlaneGeometry(220, 190 / Math.cos(Math.atan(HS)), 1, 1), M.scrub);
    hill.rotation.x = -Math.PI / 2 - Math.atan(HS);
    hill.position.set(0, hillY(0, -112) - 0.35, -112);
    hill.receiveShadow = true;
    root.add(hill);
    const blocked = (x, z) => (x > 2.2 && z > -29.6) || (x > 9.2 && z > -34) || (x > -2 && x < 6 && z > -17.6);
    buildHillside(root, { kit: houseKit, hillY, blocked, lookout: { x: 4.5, z: -27 } });
  }

  // ---- the skyline: three hill bands, the city in the basin, Taipei 101 -----------------
  // Real geometry far out (150 m - 1 km), so it parallaxes and turns with the
  // camera; only the sky, sun, clouds and far mountains are a drawn backdrop.
  // Distances / heights are set from the lookout (eye about y -2.6) so the hills
  // hide the city's feet and Taipei 101 rises clearly above everything.
  {
    const L = new THREE.Vector3(4.5, -2.6, -27.5);
    const dirAt = (azDeg) => { const a = THREE.MathUtils.degToRad(azDeg); return [Math.sin(a), -Math.cos(a)]; };
    const far = (m) => { m.castShadow = false; m.receiveShadow = false; m.userData.farField = true; return m; };
    // hill bands: curtains along arcs around the lookout, ridge line from layered sines
    const band = (R, elTop, amp, seed, mat, dip) => {
      const N = 180, span = 210, bottom = -170;
      const rr = makeRng(seed);
      const ph = [rr() * 6, rr() * 6, rr() * 6];
      const pos = [], uv = [], idx = [];
      let arc = 0, prev = null;
      for (let i = 0; i <= N; i++) {
        const az = -span / 2 + (span * i) / N;
        const [dx, dz] = dirAt(az);
        const x = L.x + dx * R, z = L.z + dz * R;
        const valley = dip * Math.exp(-(((az - TX.PANO.T101) / 16) ** 2));
        const el = elTop + amp * (0.55 * Math.sin(az * 0.05 + ph[0]) + 0.3 * Math.sin(az * 0.13 + ph[1]) + 0.15 * Math.sin(az * 0.31 + ph[2])) - valley;
        const top = L.y + R * Math.tan(THREE.MathUtils.degToRad(el));
        if (prev) arc += Math.hypot(x - prev[0], z - prev[1]);
        prev = [x, z];
        pos.push(x, top, z, x, bottom, z);
        uv.push(arc / 70, (top - bottom) / 35, arc / 70, 0);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      far(add(geo, mat, root));
      // the crest height at an azimuth (the same ridge formula)
      return (az) => {
        const valley = dip * Math.exp(-(((az - TX.PANO.T101) / 16) ** 2));
        const el = elTop + amp * (0.55 * Math.sin(az * 0.05 + ph[0]) + 0.3 * Math.sin(az * 0.13 + ph[1]) + 0.15 * Math.sin(az * 0.31 + ph[2])) - valley;
        return L.y + R * Math.tan(THREE.MathUtils.degToRad(el));
      };
    };
    const hillMat = (kind, seed, tone) => ink({ map: TX.hillTexture(kind, seed), tone, facing: 0.35, hatchFreq: 0.5, side: THREE.DoubleSide, mapAmt: 0.85 });
    band(380, -3.7, 0.9, 11, hillMat('ridge', 83, 0.97), 0.6);
    const crest260 = band(260, -5.0, 1.4, 12, hillMat('trees', 85, 1), 1.1);
    const crest150 = band(150, -7.8, 1.6, 13, hillMat('forest', 87, 1), 1.0);
    // villages and tree clumps on the crests (the nearer band's houses are geometry, not drawn)
    buildRidges(root, { kit: houseKit, L, dirAt, crests: [{ R: 150, top: crest150, houses: true, tree: 2.6 }, { R: 260, top: crest260, houses: false, tree: 3.4 }] });

    // the basin city, Taipei 101 and Nan Shan Plaza (./taiwan/taipei.js)
    buildTaipei(root, { L, dirAt, az101: TX.PANO.T101, dist101: 520, baseY: -46 });
  }

  // ---- the view: drawn panorama around the camera (not outlined) ---------------------
  const pano = (() => {
    const { AZ, ELB, ELT } = TX.PANO;
    const Rr = 400;
    const span = (2 * AZ * Math.PI) / 180;
    const yb = Rr * Math.tan((ELB * Math.PI) / 180), yt = Rr * Math.tan((ELT * Math.PI) / 180);
    const geo = new THREE.CylinderGeometry(Rr, Rr, yt - yb, 96, 1, true, Math.PI - span / 2, span);
    // flip u so the drawing reads left-to-right from inside
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    geo.translate(0, (yt + yb) / 2, 0);
    const mat = backdropMaterial(TX.panoramaTexture());
    mat.side = THREE.BackSide;
    mat.depthWrite = false;
    const m = new THREE.Mesh(geo, mat);
    m.layers.set(1);
    m.renderOrder = -10;
    m.frustumCulled = false;
    root.add(m);
    return m;
  })();
  updaters.push((t, dt, ctx) => { pano.position.copy(ctx.camera.position); });

  // ---- the cat on the ledge -------------------------------------------------------------
  const cat = (() => {
    const s = new Sketch(256, 128, { seed: 77 });
    for (const [x, y, rx, ry] of [[60, 40, 30, 22], [170, 70, 36, 26], [220, 30, 20, 16]]) s.ellipse(x, y, rx, ry, { w: 2, fill: '#555' });
    const patch = ink({ map: s.texture(), facing: 0.4, hatch: 0.6, local: true, hatchFreq: 40 });
    const white = ink({ tone: 1, facing: 0.4, hatch: 0.6, local: true, hatchFreq: 40 });
    const g = group(root, 2.55, PY + 0.85, -13.2, Math.PI);
    const bodyG = group(g, 0, 0, 0);
    sphere(bodyG, 0.13, 0, 0.14, 0, patch, [1, 1.2, 1.05], { seg: 24 });
    sphere(bodyG, 0.09, 0, 0.16, 0.07, white, [1, 1.2, 0.8], { seg: 18 });
    for (const sx of [-1, 1]) { const l = add(new THREE.CapsuleGeometry(0.028, 0.1, 4, 8), white, bodyG); l.position.set(sx * 0.045, 0.06, 0.1); }
    for (const sx of [-1, 1]) sphere(bodyG, 0.06, sx * 0.08, 0.05, -0.04, patch, [0.8, 0.7, 1.3], { seg: 14 });
    const headG = group(bodyG, 0, 0.33, 0.04);
    sphere(headG, 0.105, 0, 0, 0, white, [1.1, 0.95, 0.95], { seg: 24 });
    sphere(headG, 0.045, 0.05, 0.05, -0.03, patch, [1.2, 1, 1], { seg: 12 });
    for (const sx of [-1, 1]) {
      const ear = add(new THREE.ConeGeometry(0.04, 0.075, 4), white, headG);
      ear.position.set(sx * 0.06, 0.09, -0.01);
      ear.rotation.z = -sx * 0.25;
    }
    const eyes = [-1, 1].map((sx) => sphere(headG, 0.013, sx * 0.04, 0.01, 0.095, M.black, [1, 1.3, 0.6], { seg: 8 }));
    sphere(headG, 0.01, 0, -0.025, 0.104, M.black, [1.3, 0.8, 0.6], { seg: 8 });
    for (const sx of [-1, 1]) for (const dy of [-0.012, 0.004]) {
      const wh = cyl(headG, 0.002, 0.002, 0.09, sx * 0.08, -0.03 + dy, 0.08, M.black, { seg: 3, cast: false });
      wh.rotation.z = Math.PI / 2 + sx * dy * 8;
    }
    // tail: curls around the paws
    const tailPts = [[0, 0.05, -0.13], [0.1, 0.03, -0.12], [0.16, 0.03, 0.0], [0.12, 0.03, 0.12], [0.03, 0.05, 0.16]].map((p) => new THREE.Vector3(...p));
    const tailG = group(bodyG, 0, 0, 0);
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 20, 0.025, 8, false), patch, tailG);
    sphere(tailG, 0.025, ...tailPts[tailPts.length - 1].toArray(), patch, [1, 1, 1], { seg: 10 });
    return { g, bodyG, headG, eyes, tailG, stretch: 0, blinkT: 2 };
  })();

  // ---- interactions ------------------------------------------------------------------------
  // back to the airport: a wooden signpost at the top of the street
  {
    const g = group(root, 1.1, 0, 1.6, -0.4);
    box(g, 0.08, 1.35, 0.08, 0, 0, 0, M.woodDark);
    facedBox(g, 0.72, 0.22, 0.04, 0.22, 1.05, 0, M.wood, signMat('機場', { vertical: false, seed: 21, w: 300, h: 120, size: 70 }), [4, 5]);
    facedBox(g, 0.6, 0.2, 0.04, -0.15, 0.78, 0.02, M.wood, signMat('九份', { vertical: false, seed: 22, w: 300, h: 120, size: 70 }), [4, 5]).rotation.y = 0.5;
    solidCircle(1.1, 1.6, 0.12);
    actionSpot('home', 'Back to the airport', { x: 0.75, z: 1.25, radius: 0.85, prompt: [1.1, 1.6, 1.6], act: (ctx) => ctx.travel('lobby') });
  }

  const auntieLines = [
    'Welcome, welcome! The oolong is fresh today.',
    'You walked all the way down? Rest your feet, have a cup.',
    'Go down to the lookout before dark. Jiufen is prettiest at sunset.',
  ];
  let auntieI = 0, auntieTalk = 0;
  actionSpot('auntie', 'Talk to Tea Auntie', {
    x: 0.9, z: -11.4, radius: 1.15, prompt: [2.1, -1.8 + 1.75, -11.55],
    act(ctx) {
      ctx.caption(auntieLines[auntieI % auntieLines.length], 4.2);
      auntieI++;
      auntieTalk = 3.5;
      auntie.reach();
      ctx.sound('talk');
      ctx.complete('teahouse');
      ctx.frame(-Math.PI / 2 + 0.55, 0.26);
    },
  });
  actionSpot('lantern', 'Tap the lantern', {
    x: 0.85, z: -9.95, radius: 0.75, prompt: [1.3, -1.8 + 2.2, -10.05],
    act(ctx) { swingBig(0.5); swingBig2(0.2); ctx.sound('chime'); ctx.caption('The lantern sways. 茶 — tea, this way.', 3); },
  });
  actionSpot('cat', 'Talk to Cat', {
    x: 2.55, z: -13.95, radius: 0.95, prompt: [2.55, PY + 1.45, -13.2],
    act(ctx) { ctx.frame(Math.PI - 0.6, 0.3); cat.stretch = 1.6; cat.blinkT = 0.05; ctx.sound('meow'); ctx.caption('Mrrp. The cat blinks slowly at you.', 3.2); },
  });
  actionSpot('steamer', 'Peek in the steamer', {
    x: 4.0, z: -14.2, radius: 0.9, prompt: [4.0, PY + 1.6, -13.4],
    act(ctx) { ctx.frame(Math.PI + 0.5, 0.34); steamer.t = 0; ctx.sound('steam'); ctx.caption('Fresh xiaolongbao. Careful, they’re hot!', 3.2); },
  });
  actionSpot('incense', 'Light incense', {
    x: -5.3, z: -14.4, radius: 0.75, prompt: [-5.95, SY + 1.4, -14.6],
    act(ctx) { ctx.sound('chime'); ctx.caption('A quiet wish for safe travels.', 3.2); },
  });
  let sunsetDone = false;
  actionSpot('lookout', 'Watch the sunset', {
    x: 4.5, z: -28.2, radius: 1.3, prompt: [5.9, LY + 1.1, -28.9], noReach: true,
    act(ctx) {
      ctx.face(4.5 + Math.sin(TX.PANO.T101 * Math.PI / 180) * 5, -28.2 - 5);
      ctx.pan({ yaw: -TX.PANO.T101 * Math.PI / 180, pitch: 0.06, dist: 3.4, rate: 0.9, lock: 3.2, lookUp: 0.55 });
      ctx.caption(sunsetDone ? 'Taipei 101 against the evening sky.' : 'The sun sinks behind Taipei. Worth every step.', 4.5);
      ctx.sound('chime');
      sunsetDone = true;
      ctx.complete('sunset');
    },
  });
  interactables.push({
    id: 'bench', label: 'Sit on the bench', kind: 'seat', x: 2.3, z: -27.0, radius: 0.85,
    pos: new THREE.Vector3(2.3, LY + 0.95, -27.6),
    seat: { seat: [2.3, LY + 0.28, -27.62], exit: [2.3, -26.9], via: [], pose: 'sit', facing: Math.PI, caption: 'The city lights are coming on.', cam: { yaw: 0.25, pitch: 0.2, dist: 2.6 } },
  });

  // ---- collectibles: four stars + the bubble tea ------------------------------------
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.065 : 0.15;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  starGeo.center();
  const STAR_SPOTS = [
    { p: [1.15, H(1.0, -8.7) + 0.45, -8.75], stand: [0.6, -8.7] },        // on the steps by the plants
    { p: [-4.5, SY + 0.95, -15.45], stand: [-4.6, -15.0] },             // on the shrine's potted plant
    { p: [-0.95, PY + 1.25, -16.05], stand: [-0.4, -15.6] },             // over the scooter
    { p: [8.15, LY + 1.3, -28.5], stand: [7.7, -27.9] },                 // lookout corner
  ];
  for (const { p: [x, y, z], stand } of STAR_SPOTS) {
    const m = add(starGeo, M.star, root);
    m.position.set(x, y, z);
    const s = { mesh: m, base: new THREE.Vector3(x, y, z), collected: false, anim: -1, stand };
    stars.push(s);
    interactables.push({ id: 'star', label: 'Pick Up', kind: 'action', pos: new THREE.Vector3(x, y + 0.3, z), radius: 0.95, x: stand[0], z: stand[1], star: s });
  }
  // the bubble tea cup on the counter (matches the reference close-up)
  {
    const g = group(root, -1.45, -0.9 + 1.0, -5.9);
    const cup = add(new THREE.CylinderGeometry(0.075, 0.058, 0.2, 28, 1, true), M.boba, g);
    cup.position.y = 0.1;
    cyl(g, 0.058, 0.058, 0.006, 0, 0, 0, M.paper);
    const lid = add(new THREE.SphereGeometry(0.077, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.paper, g);
    lid.position.y = 0.2; lid.scale.y = 0.45;
    const straw = cyl(g, 0.012, 0.012, 0.22, 0.02, 0.18, 0, M.light, { seg: 10 });
    straw.rotation.z = -0.12;
    const s = { mesh: g, base: g.position.clone(), collected: false, anim: -1, stand: [-0.75, -5.9], spin: false, bob: 0.0, caption: 'Good food, good mood.' };
    stars.push(s);
    interactables.push({ id: 'boba', label: 'Pick Up', kind: 'action', pos: new THREE.Vector3(-1.45, 0.45, -5.9), radius: 0.95, x: -0.75, z: -5.9, star: s });
  }

  // ---- explore objective: a few marked spots along the street ----------------------
  const ZONES = [[0, -6.1], [2.0, -14.8], [-5.6, -14.6], [4.1, -20.8]];
  const visited = new Set();
  const exploreText = () => t('Explore the old streets ({n}/{m})', { n: visited.size, m: ZONES.length });

  // ---- camera blockers: every solid chunk, never thin rods or lanterns ------------------
  root.updateMatrixWorld(true);
  const size = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.layers.mask !== 1 || camBlockers.includes(o) || o === pano) return;
    if (o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 1) return;
    if (o.parent && auntie.root.getObjectById(o.id)) return;
    if (o.userData.noBlock || o.userData.farField || npcs.some((v) => v.root.getObjectById(o.id))) return;
    o.geometry.computeBoundingBox();
    o.geometry.boundingBox.getSize(size);
    size.multiply(new THREE.Vector3().setFromMatrixScale(o.matrixWorld));
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    if (dims[0] > 0.05 && dims[1] > 0.3 && dims[2] > 0.5) camBlockers.push(o);
  });
  // the hillside houses are far below the street; only the street's own geometry matters
  const blockers = camBlockers.filter((m) => { const p = new THREE.Vector3(); m.getWorldPosition(p); return p.y > -9; });

  // ---- per-frame -------------------------------------------------------------------------
  function update(t, dt, ctx) {
    for (const u of updaters) u(t, dt, ctx);
    const p = ctx.player.pos;
    for (let i = 0; i < ZONES.length; i++) if (Math.hypot(p.x - ZONES[i][0], p.z - ZONES[i][1]) < 1.6) visited.add(i);
    if (visited.size >= ZONES.length) ctx.complete('explore');
    ctx.refreshObjective('explore');

    // auntie: turns to face you while you talk, otherwise tends the counter
    auntieTalk = Math.max(0, auntieTalk - dt);
    const near = Math.hypot(p.x - 0.9, p.z - -11.4) < 2.2;
    const want = near || auntieTalk > 0 ? Math.atan2(p.x - auntie.root.position.x, p.z - auntie.root.position.z) : -Math.PI / 2 + Math.sin(t * 0.3) * 0.3;
    auntieLook += Math.atan2(Math.sin(want - auntieLook), Math.cos(want - auntieLook)) * (1 - Math.exp(-dt * 3));
    auntie.root.rotation.y = auntieLook;
    auntie.update(dt, t, { speed: 0 });
    for (const v of npcs) v.update(dt, t, { speed: 0 });

    // cat: tail sways, blinks, stretches when you talk to it, watches you
    cat.tailG.rotation.y = Math.sin(t * 1.1) * 0.12;
    cat.blinkT -= dt;
    if (cat.blinkT < -0.14) cat.blinkT = 2 + Math.random() * 3;
    for (const e of cat.eyes) e.scale.y = cat.blinkT < 0 ? 0.15 : 1.3;
    cat.stretch = Math.max(0, cat.stretch - dt);
    const st = Math.sin(Math.min(1, cat.stretch / 1.6) * Math.PI);
    cat.bodyG.scale.set(1, 1 - st * 0.12, 1 + st * 0.25);
    cat.bodyG.rotation.x = st * 0.25;
    const look = Math.atan2(p.x - cat.g.position.x, p.z - cat.g.position.z) - cat.g.rotation.y;
    cat.headG.rotation.y = THREE.MathUtils.clamp(Math.atan2(Math.sin(look), Math.cos(look)), -0.8, 0.8) * (Math.hypot(p.x - 2.55, p.z + 13.2) < 3 ? 1 : 0.2);
    cat.headG.rotation.z = st * 0.2;

    // steamer: a little doodle steam all the time, a big puff when you peek
    steamer.t += dt;
    const burst = Math.max(0, 1 - steamer.t / 2.2);
    for (const s of steamer.puffs) {
      const a = (t * (0.35 + burst * 0.6) + s.ph) % 1;
      const amt = (s.ph < 0.35 ? 1 : burst) * Math.sin(a * Math.PI);
      s.m.position.set(steamBase.x + Math.sin(a * 7 + s.ph * 9) * 0.08 + (s.ph > 0.5 ? -0.48 : 0), steamBase.y + a * (0.5 + burst * 0.6), steamBase.z + Math.cos(a * 5 + s.ph) * 0.05);
      s.m.scale.setScalar(Math.max(0.001, amt * (0.035 + a * 0.07 + burst * 0.04)));
    }
  }

  // camera distance: closer in the narrow streets, wider in the plaza and at the lookout
  function viewAt(x, z) {
    if (z < -24.6) return { dist: 3.4 };
    if (z < -13 && z > -16.6) return { dist: 2.8 };
    return { dist: 2.45 };
  }

  return {
    root,
    colliders,
    camBlockers: blockers,
    interactables,
    stars,
    update,
    heightAt,
    viewAt,
    explored: () => visited.size,
    objectiveText: (id, isDone) => (id === 'explore' && !isDone ? exploreText() : undefined),
    walkable: REGIONS.map((r) => ({ id: r.id, x: r.x, z: r.z })),
  };
}
