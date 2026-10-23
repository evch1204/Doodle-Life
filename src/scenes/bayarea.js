import * as THREE from 'three';
import { ink, backdropMaterial } from '../ink.js';
import * as TX from '../shanghaiTextures.js';
import * as BX from '../bayTextures.js';
import { t as tr, onLang, getLang } from '../i18n.js';
import { createCharacter } from '../character.js';
import { clockFaceTexture } from '../lobbyTextures.js';
import { Batch, BOLD, farId, placer } from './kit.js';
import { buildRiver } from './shanghai/river.js';
import { bayMaterials, boxG, cylG, sphG, palm, lamp, bench, bin, shrubs, streetTree, cafeTable, aFrame, bollard } from './bayarea/props.js';
import { building, bladeSign, cafeRoom, DEPTH, GF } from './bayarea/street.js';
import { buildCableCar, cableCarMaterials, CAR } from './bayarea/cablecar.js';
import { buildSF, BRIDGE_MID } from './bayarea/sf.js';

// Chapter 3: the Bay Area. A walk down a San Francisco waterfront street (the
// Embarcadero toward Fisherman's Wharf): storefronts on the left, a cable car
// line down the middle, the promenade and the bay on the right, the Golden
// Gate Bridge and the skyline across the water ahead.
//
// The street is laid out in street coordinates: s along it (forward, from the
// spawn), u across it (+ toward the water), y up. It runs straight down -z for
// 40 m, then bends gently left (radius 160 m) until s = 110 and runs on
// straight. at(s, u) gives the world point.
//
//   u -9            the facades (buildings run back to u -21)
//   u -9 .. -2.45   the sidewalk (y 0.15): café seating, the walk, lamps and trees
//   u -2.45 .. 2.45 the street (y 0): the cable car tracks down the middle
//   u 2.45 .. 7.9   the promenade (y 0.15): planting, benches, signs, the railing at u 7.6
//   u > 7.9         the bay (y -1.6); the fishing pier at s 18..24 runs out to u 22
//   s -10 .. 30     walkable: one block, the café at the spawn, the pier ahead on the
//                   right; planter rows, bollards and chains close both ends (the cable
//                   car terminus behind, the street clock and the Fisherman's Wharf
//                   sign ahead). The street, its buildings and the promenade run on
//                   past both ends to keep the city going.
//
// Walkable ground is heightAt(); outside it is "no ground", so the bay can never be entered.

const WATER_Y = -1.6, WALK_Y = 0.15, SHORE_Y = WATER_Y + 3;
const S1 = 40, R = 160, S2 = 110, TH2 = (S2 - S1) / R;
const FACADE = -9, KERB = 2.45, RAIL_U = 7.6, EDGE_U = 7.9;
const S_MIN = -10, S_MAX = 30;
const PIER = { s0: 18, s1: 24, u1: 22 };
const OFF = -100;

// ---- the street frame -----------------------------------------------------------------
const P2 = [-R + R * Math.cos(TH2), -S1 - R * Math.sin(TH2)];
export function at(s, u) {
  if (s <= S1) return [u, -s];
  if (s <= S2) { const th = (s - S1) / R; return [-R + (R + u) * Math.cos(th), -S1 - (R + u) * Math.sin(th)]; }
  const ds = s - S2;
  return [P2[0] - Math.sin(TH2) * ds + Math.cos(TH2) * u, P2[1] - Math.cos(TH2) * ds - Math.sin(TH2) * u];
}
const heading = (s) => (s <= S1 ? 0 : s <= S2 ? (s - S1) / R : TH2); // the street's turn (radians, about +y)
// exact inverse near the street (the walkable part and the buildings)
function toStreet(x, z) {
  if (z >= -S1) return [-z, x];
  const dx = x + R, dz = -(z + S1), th = Math.atan2(dz, dx);
  if (th <= TH2) return [S1 + R * th, Math.hypot(dx, dz) - R];
  const qx = x - P2[0], qz = z - P2[1];
  return [S2 - Math.sin(TH2) * qx - Math.cos(TH2) * qz, Math.cos(TH2) * qx - Math.sin(TH2) * qz];
}
// a smooth (s, u) anywhere, for the land: the nearest point on the centre line
const LINE = [];
for (let s = -600; s <= 1600; s += 4) LINE.push([s, ...at(s, 0)]);
function toStreetFar(x, z) {
  if (Math.abs(x) < 60 && z > -S1 - 10 && z < 120) return toStreet(x, z);
  let best = Infinity, bs = 0, bu = 0;
  for (let i = 0; i < LINE.length - 1; i++) {
    const [s0, ax, az] = LINE[i], [, bx, bz] = LINE[i + 1];
    const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
    const px = ax + ex * t, pz = az + ez * t, d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < best) { best = d; bs = s0 + 4 * t; bu = ((x - px) * -ez + (z - pz) * ex) / Math.sqrt(L2); }
  }
  return [bs, bu];
}

export function heightAt(x, z) {
  const [s, u] = toStreet(x, z);
  if (s >= PIER.s0 && s <= PIER.s1 && u >= EDGE_U - 0.5 && u <= PIER.u1) return WALK_Y;
  if (s < S_MIN || s > S_MAX || u < FACADE - 0.2 || u > EDGE_U) return OFF;
  const a = Math.abs(u);
  if (a <= KERB - 0.15) return 0;
  if (a >= KERB + 0.15) return WALK_Y;
  return (WALK_Y * (a - (KERB - 0.15))) / 0.3;     // the kerb: a short ramp, so the step never pops
}

export default {
  id: 'bayarea',
  name: 'the Bay Area',
  travelText: 'Traveling to the Bay Area…',
  hud: {
    title: 'Bay Area',
    sub: 'San Francisco · The Embarcadero',
    style: 'card',
    map: 'compass',
    objectives: [
      { id: 'cafe', text: 'Stop by Cafe Bay View' },
      { id: 'cablecar', text: 'Take a look at the cable car' },
      { id: 'pier', text: 'See the Golden Gate from the pier' },
    ],
  },
  start: { x: -4.6, z: 6.5, facing: Math.PI, yaw: -0.04, pitch: 0.1 },
  sun: { dir: [0.95, 2.3, 0.9], extent: 18, follow: true, far: 70 },
  camera: { near: 0.2, far: 3200, dist: 3.0 },
  // distant lines thin and lighten, distant tones fade toward the paper; the bridge and the landmarks stay bold
  render: { grazeFix: 1, aerial: { near: 110, far: 1300, line: 0.5, tone: 0.3, bold: BOLD } },
  build: buildBayArea,
};

function buildBayArea(scene, ctx) {
  const M = bayMaterials();
  const root = new THREE.Group();
  root.name = 'bayarea';
  scene.add(root);
  const colliders = [], interactables = [], updaters = [], camBlockers = [];
  const solid = (x0, x1, z0, z1) => colliders.push({ type: 'box', minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
  const solidC = (c) => { colliders.push({ type: 'circle', x: c.x, z: c.z, r: c.r }); return c; };
  // a solid band in street coordinates: one box on the straight, short boxes round the bend
  const solidS = (s0, s1, u0, u1) => {
    const a = s0, b = s1;
    if (b <= S1) { const [x0, z0] = at(a, u0), [x1, z1] = at(b, u1); solid(x0, x1, z0, z1); return; }
    if (a < S1) { solidS(a, S1, u0, u1); solidS(S1, b, u0, u1); return; }
    for (let s = a; s < b - 1e-6; s += 0.8) {
      const e = Math.min(b, s + 0.8), pts = [at(s, u0), at(s, u1), at(e, u0), at(e, u1)];
      solid(Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1])));
    }
  };
  const blocker = (geo, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(geo, M.paper);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.visible = false; m.userData.noBlock = true;
    root.add(m); camBlockers.push(m);
    return m;
  };
  const B = new Batch();
  const id = (v) => farId(v);

  // =====================================================================
  // THE GROUND: sidewalk, kerbs, street and tracks, promenade, sea wall
  // =====================================================================
  // sweep a cross-section profile [[u, y], ...] along the street from s0 to s1
  const sweep = (profile, s0, s1, mat, idv) => {
    const ss = [s0];
    for (let s = Math.ceil(s0); s < s1; s++) if ((s > S1 && s < S2 + 2) || s % 8 === 0) ss.push(s);
    ss.push(s1);
    const pos = [], idx = [], n = profile.length;
    ss.forEach((s, i) => {
      for (const [u, y] of profile) { const [x, z] = at(s, u); pos.push(x, y, z); }
      if (i) for (let k = 0; k < n - 1; k++) { const a = (i - 1) * n + k, b2 = a + 1, c = a + n, d = c + 1; idx.push(a, b2, c, b2, d, c); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const flat = g.toNonIndexed(); flat.computeVertexNormals(); // hard corners: kerb tops and faces don't share normals
    B.add(flat, mat, idv);
  };
  const SA = -96, SB = 140; // the built street runs from SA (the Ferry Building's plaza) to SB
  sweep([[FACADE - 0.4, WALK_Y], [-KERB - 0.3, WALK_Y]], SA, SB, M.paving, id(0.11));
  sweep([[-KERB - 0.3, WALK_Y], [-KERB, WALK_Y], [-KERB, 0]], SA, SB, M.kerb, id(0.12));
  sweep([[-KERB, 0], [KERB, 0]], SA, SB, M.street, id(0.13));
  sweep([[KERB, 0], [KERB, WALK_Y], [KERB + 0.3, WALK_Y]], SA, SB, M.kerb, id(0.12));
  sweep([[KERB + 0.3, WALK_Y], [EDGE_U - 0.35, WALK_Y]], SA, SB, M.paving, id(0.14));
  sweep([[EDGE_U - 0.35, WALK_Y], [EDGE_U, WALK_Y], [EDGE_U, WATER_Y - 0.6]], SA, PIER.s0, M.stone, id(0.15));
  sweep([[EDGE_U - 0.35, WALK_Y], [EDGE_U, WALK_Y], [EDGE_U, WATER_Y - 0.6]], PIER.s1, SB, M.stone, id(0.15));
  // the cable car line: a band of setts, two rails, the cable slot between them
  sweep([[-1.0, 0.006], [1.0, 0.006]], SA, SB, M.path, id(0.16));
  sweep([[-0.03, 0.009], [0.03, 0.009]], SA, SB, M.dark, id(0.17));
  for (const ru of [-0.535, 0.535]) sweep([[ru - 0.04, 0.006], [ru - 0.04, 0.03], [ru + 0.04, 0.03], [ru + 0.04, 0.006]], SA, SB, M.rail, id(0.17));

  // =====================================================================
  // THE BUILDINGS along the left side, from one kit (street.js)
  // =====================================================================
  const ROW = [
    { s0: -90, s1: -80, floors: 4, wall: 'stucco', upper: 'bay', top: 'parapet' },
    { s0: -80, s1: -68, floors: 3, wall: 'stucco2', upper: 'flat', top: 'bracket' },
    { s0: -68, s1: -57, floors: 4, wall: 'brick', upper: 'balcony', top: 'parapet' },
    { s0: -57, s1: -47, floors: 3, wall: 'siding', upper: 'bay', top: 'bracket' },
    { s0: -47, s1: -37, floors: 3, wall: 'brick', upper: 'flat', top: 'bracket', shop: { sign: { en: 'MARINE SUPPLY', zh: '航海用品' }, door: 'center' } },
    { s0: -37, s1: -27, floors: 4, wall: 'stucco', upper: 'bay', top: 'parapet', shop: { sign: { en: 'SOURDOUGH', zh: '酸麵包' }, sub: { en: 'BREAD · CHOWDER', zh: '麵包・巧達濃湯' }, window: 'bread' } },
    { s0: -27, s1: -17, floors: 4, wall: 'brick', upper: 'balcony', top: 'bracket', shop: { sign: { en: 'HOTEL EMBARCADERO', zh: '內河碼頭飯店' }, door: 'center' } },
    { s0: -17, s1: -7.5, floors: 3, wall: 'siding', upper: 'bay', top: 'pediment', shop: { sign: { en: 'FLOWERS', zh: '花店' }, window: 'plain', awning: 1.3, dark: false } },
    { s0: -7.5, s1: 5, floors: 3, wall: 'stucco', upper: 'bay', top: 'pediment', cafe: true, shop: { sign: { en: 'CAFE BAY VIEW', zh: '灣景咖啡' }, sub: { en: 'COFFEE  •  TEA  •  PASTRIES', zh: '咖啡・茶・糕點' }, interior: true, awning: 2.3, door: 'right' } },
    { s0: 5, s1: 14, floors: 3, wall: 'siding', upper: 'bay', top: 'bracket', shop: { sign: { en: 'BAKERY', zh: '麵包坊' }, sub: { en: 'SOURDOUGH  ·  PASTRIES', zh: '酸麵包・糕點' }, window: 'bread', awning: 1.4, door: 'left', dark: false } },
    { s0: 14, s1: 23, floors: 4, wall: 'brick', upper: 'balcony', top: 'bracket', shop: { sign: { en: 'BOOKS & MAPS', zh: '書店・地圖' }, window: 'books' } },
    { s0: 23, s1: 31, floors: 3, wall: 'stucco2', upper: 'flat', top: 'pediment', shop: { sign: { en: 'CRAB HOUSE', zh: '螃蟹餐廳' }, sub: { en: 'CHOWDER  ·  OYSTERS', zh: '巧達濃湯・生蠔' }, awning: 1.5 } },
    { s0: 31, s1: 42, floors: 4, wall: 'siding', upper: 'bay', top: 'parapet', shop: { sign: { en: 'GIFTS & POSTCARDS', zh: '禮品・明信片' }, window: 'gifts', dark: false } },
    { s0: 42, s1: 51, floors: 3, wall: 'brick', upper: 'flat', top: 'bracket', shop: { sign: { en: 'ICE CREAM', zh: '冰淇淋' }, sub: { en: 'CHOCOLATE  ·  SUNDAES', zh: '巧克力・聖代' }, awning: 1.4, door: 'center' } },
    { s0: 51, s1: 61, floors: 4, wall: 'stucco', upper: 'bay', top: 'bracket', shop: { sign: { en: 'SEAFOOD GRILL', zh: '海鮮燒烤' } } },
    { s0: 61, s1: 70, floors: 3, wall: 'siding', upper: 'balcony', top: 'pediment', shop: { sign: { en: 'SAN FRANCISCO', zh: '舊金山' }, sub: { en: 'TRADING CO.', zh: '貿易商行' }, window: 'gifts', awning: 1.4 } },
    { s0: 70, s1: 81, floors: 4, wall: 'brick', upper: 'flat', top: 'parapet', shop: { sign: { en: 'WATERFRONT MARKET', zh: '海濱市場' }, door: 'left' } },
    { s0: 81, s1: 91, floors: 3, wall: 'stucco2', upper: 'bay', top: 'bracket', shop: { sign: { en: 'OYSTER BAR', zh: '生蠔吧' } } },
    { s0: 91, s1: 102, floors: 4, wall: 'siding', upper: 'balcony', top: 'bracket' },
    { s0: 102, s1: 112, floors: 3, wall: 'brick', upper: 'flat', top: 'pediment' },
    { s0: 112, s1: 124, floors: 4, wall: 'stucco', upper: 'bay', top: 'parapet' },
    { s0: 124, s1: 140, floors: 3, wall: 'brick', upper: 'flat', top: 'bracket' },
  ];
  let cafe = null;
  ROW.forEach((spec, i) => {
    const [x0, z0] = at(spec.s0, FACADE), [x1, z1] = at(spec.s1, FACADE);
    const w = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / w, dz = (z1 - z0) / w;
    const ry = Math.atan2(-dz, dx), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const mtx = new THREE.Matrix4().makeRotationY(ry).setPosition(cx, WALK_Y, cz);
    const put = (geo, mat, idv) => B.geo(geo, mat, idv, mtx);
    const b = building(put, M, { ...spec, x0: -w / 2, x1: w / 2, seed: 11 + i * 7 });
    if (spec.cafe) { cafeRoom(put, M, b.anchors.room); cafe = { mtx, room: b.anchors.room, w, ry }; }
    // the camera stays out of the buildings
    const bg = new THREE.BoxGeometry(w, b.H + 1.5, DEPTH);
    bg.translate(0, (b.H + 1.5) / 2, -DEPTH / 2 - 0.15);
    blocker(bg, cx, WALK_Y, cz, ry);
  });
  solidS(S_MIN - 2, S_MAX + 4, FACADE - 3, FACADE + 0.25);

  // ---- blade signs and the street's banners -----------------------------------------------
  const cafeSignMat = ink({ map: BX.cafeSignTexture(), facing: 0.1, hatch: 0 });
  const bladeAt = (s, mat, o) => { const [x, z] = at(s, FACADE); const mtx = new THREE.Matrix4().makeRotationY(heading(s) + Math.PI / 2).setPosition(x, WALK_Y, z); bladeSign((g, m, i) => B.geo(g, m, i, mtx), M, 0, GF + 0.85, mat, { seed: s, ...o }); };
  bladeAt(4.3, cafeSignMat, { bw: 1.9, bh: 1.1 });
  bladeAt(13.3, ink({ map: BX.shopSignTexture({ en: 'BAKERY', zh: '麵包坊' }, { sub: { en: 'est. 1906', zh: '創立於 1906 年' }, dark: true, W: 512, H: 300, seed: 977 }), facing: 0.1, hatch: 0 }), { bw: 1.2, bh: 0.7 });
  bladeAt(29.6, ink({ map: BX.shopSignTexture({ en: "FISHERMAN'S WHARF", zh: '漁人碼頭' }, { sub: '→', dark: true, W: 900, H: 300, seed: 979 }), facing: 0.1, hatch: 0 }), { bw: 1.9, bh: 0.62 });
  bladeAt(60.3, ink({ map: BX.shopSignTexture({ en: 'GRILL', zh: '燒烤' }, { sub: { en: 'OPEN', zh: '營業中' }, dark: false, W: 512, H: 300, seed: 981 }), facing: 0.1, hatch: 0 }), { bw: 1.1, bh: 0.65 });

  // =====================================================================
  // THE SIDEWALK: café seating, the chalkboard, lamps with banners, trees, bins
  // =====================================================================
  const TABLES = [[-5.6, -7.65], [-2.2, -7.65], [1.2, -7.65]];
  for (const [s, u] of TABLES) {
    const [x, z] = at(s, u);
    solidC(cafeTable(B, M, x, WALK_Y, z, { chairs: [heading(s) + Math.PI, heading(s)], seed: s }));
  }
  const chalk = { s: 3.6, u: -6.15 };
  { const [x, z] = at(chalk.s, chalk.u); solidC(aFrame(B, M, x, WALK_Y, z, heading(chalk.s))); chalk.x = x; chalk.z = z; }
  // potted plants by the café door
  for (const s of [3.1, 4.6]) { const [x, z] = at(s, FACADE + 0.45); B.add(cylG(0.24, 0.18, 0.5, x, WALK_Y, z, 10), M.stone, id(0.3)); shrubs(B, M, x, z, x + 0.01, z, WALK_Y + 0.35, { seed: s }); solidC({ x, z, r: 0.28 }); }
  const LAMPS_L = [-20, 4, 16, 28, 40, 52, 64, 76, 88, 100, 112, 124];
  for (const s of LAMPS_L) { const [x, z] = at(s, -KERB - 0.6); const c = lamp(B, M, x, WALK_Y, z, { h: 4.2, banner: true, basket: true, ry: heading(s) }); if (s <= S_MAX + 1) solidC(c); }
  const TREES = [-14, 22, 34, 46, 58, 70, 82, 94, 106, 118, 130]; // none just ahead of the spawn: it would hide the bridge
  for (const s of TREES) { const [x, z] = at(s, -KERB - 0.75); const c = streetTree(B, M, x, WALK_Y, z, { s: 1, seed: s * 1.7 + 3 }); if (s <= S_MAX + 1 && s >= S_MIN - 1) solidC(c); }
  for (const s of [7, 19, 43, 67]) { const [x, z] = at(s, -KERB - 0.65); solidC(bin(B, M, x, WALK_Y, z)); }
  // the street name on the lamp by the spawn
  {
    const [x, z] = at(4, -KERB - 0.6), put = placer(B, x, WALK_Y, z, 0), sid = id(0.33);
    const g = new THREE.BoxGeometry(0.04, 0.22, 1.05); g.translate(0, 3.15, 0);
    const nm = ink({ map: BX.streetNameTexture({ en: 'Embarcadero', zh: '內河碼頭' }), facing: 0.1, hatch: 0 });
    put(g, [nm, nm, M.dark, M.dark, M.dark, M.dark], sid);
    put(boxG(0.06, 0.06, 0.06, 0, 3.35, 0), M.iron, sid);
  }

  // =====================================================================
  // THE PROMENADE: planting beds, benches, lamps, the signpost and the map, the railing
  // =====================================================================
  const BEDS = [[-10, -3], [8, 14], [20, 24], [36, 46], [52, 60], [66, 72], [84, 96], [104, 116], [122, 134]];
  for (const [s0, s1] of BEDS) {
    sweep([[KERB + 0.45, WALK_Y], [KERB + 0.45, WALK_Y + 0.28], [KERB + 1.35, WALK_Y + 0.28], [KERB + 1.35, WALK_Y]], s0, s1, M.kerb, id(0.36));
    for (let s = s0; s <= s1; s += (s1 - s0) / 2) {
      const e = Math.min(s1, s + (s1 - s0) / 2);
      const [x0, z0] = at(s + 0.4, KERB + 0.9), [x1, z1] = at(e - 0.4, KERB + 0.9);
      if (e - s > 0.8) shrubs(B, M, x0, z0, x1, z1, WALK_Y + 0.2, { seed: s0 * 3 + s });
    }
    if (s1 >= S_MIN && s0 <= S_MAX + 2) solidS(s0, s1, KERB + 0.4, KERB + 1.4);
  }
  const LAMPS_R = [-6, 6, 15, 29.4, 46, 58, 70, 84, 98, 112, 126];
  for (const s of LAMPS_R) { if (s > PIER.s0 - 1 && s < PIER.s1 + 1) continue; const [x, z] = at(s, RAIL_U - 0.45); const c = lamp(B, M, x, WALK_Y, z, { h: 3.6, twin: true, ry: heading(s) }); if (s <= S_MAX + 1) solidC(c); }
  // benches facing the water (sit: look at the bridge)
  const BENCHES = [-3, 11, 27];
  const benchPos = [];
  for (const s of BENCHES) { const [x, z] = at(s, RAIL_U - 1.25); bench(B, M, x, WALK_Y, z, heading(s) - Math.PI / 2); solidC({ x, z, r: 0.78 }); benchPos.push({ s, x, z }); }
  for (const s of [9, 25.2, 48, 66]) { const [x, z] = at(s, RAIL_U - 0.5); solidC(bin(B, M, x, WALK_Y, z)); }
  // palms along the promenade (the Embarcadero's), past the bend
  for (const s of [55, 90, 109, 128]) { const [x, z] = at(s, KERB + 0.9); const c = palm(B, M, x, WALK_Y, z, { h: 9, seed: s }); if (s <= S_MAX + 1) solidC(c); }

  // the fingerpost: Ferry Building, Embarcadero, Golden Gate Bridge, Alcatraz Island, the airport
  const post = { s: 2.2, u: 5.0 };
  {
    const [x, z] = at(post.s, post.u); post.x = x; post.z = z;
    const put = placer(B, x, WALK_Y, z, 0), pid = id(0.41);
    put(cylG(0.11, 0.14, 0.3, 0, 0, 0, 12), M.iron, pid);
    put(cylG(0.07, 0.08, 4.0, 0, 0.3, 0, 10), M.iron, pid);
    put(cylG(0.1, 0.1, 0.12, 0, 4.25, 0, 10), M.iron, pid);
    put(sphG(0.09, 0, 4.45, 0, 1, 1.4, 1, 10), M.iron, pid);
    // arms: board name, icon, direction (1 = points ahead / right of the board), height, yaw
    const ARMS = [[{ en: 'Ferry Building', zh: '渡輪大廈' }, 'ferry', 3.75, Math.PI - 0.35], [{ en: 'Embarcadero', zh: '內河碼頭' }, null, 3.3, 0.12], [{ en: 'Golden Gate Bridge', zh: '金門大橋' }, 'bridge', 2.85, 0.3], [{ en: 'Alcatraz Island', zh: '惡魔島' }, 'island', 2.4, -0.2]];
    ARMS.forEach(([text, icon, y, yaw], i) => {
      // each board points along local -z (forward), turned by yaw toward its place
      const mat = ink({ map: BX.armSignTexture(text, { icon, dir: 1, seed: 931 + i }), facing: 0.15, hatch: 0 });
      const matB = ink({ map: BX.armSignTexture(text, { icon, dir: -1, seed: 931 + i }), facing: 0.15, hatch: 0 });
      const g = new THREE.BoxGeometry(0.05, 0.38, 1.9); g.translate(0, y, -1.0); g.rotateY(yaw);
      put(g, [mat, matB, M.dark, M.dark, M.dark, M.dark], pid + 0.002);
    });
    const AIRPORT = { en: 'Airport', zh: '機場' };
    const ap = ink({ map: BX.armSignTexture(AIRPORT, { icon: 'plane', dir: 1, seed: 939 }), facing: 0.15, hatch: 0 });
    const apB = ink({ map: BX.armSignTexture(AIRPORT, { icon: 'plane', dir: -1, seed: 939 }), facing: 0.15, hatch: 0 });
    const g = new THREE.BoxGeometry(0.05, 0.38, 1.5); g.translate(0, 1.85, 0.8);
    put(g, [apB, ap, M.dark, M.dark, M.dark, M.dark], pid + 0.002);
    solidC({ x, z, r: 0.3 });
  }
  // the BAY AREA visitor map, on two posts, angled back toward the spawn
  const mapBoard = { s: 6.0, u: 5.3 };
  {
    const [x, z] = at(mapBoard.s, mapBoard.u); mapBoard.x = x; mapBoard.z = z;
    const put = placer(B, x, WALK_Y, z, -0.55), bid = id(0.43);
    for (const sx of [-0.62, 0.62]) put(boxG(0.1, 2.2, 0.1, sx, 0, 0), M.iron, bid);
    const board = new THREE.BoxGeometry(1.3, 1.75, 0.07); board.translate(0, 1.4, 0.06);
    put(board, [M.iron, M.iron, M.iron, M.iron, ink({ map: BX.mapBoardTexture(), facing: 0.1, hatch: 0 }), M.iron], bid);
    put(boxG(1.46, 0.1, 0.2, 0, 2.27, 0.06), M.iron, bid);
    solid(x - 0.75, x + 0.75, z - 0.45, z + 0.45);
  }

  // ---- the railing: posts with ball caps, a top and a mid rail, pickets between ----------
  const railRun = (s0, s1) => {
    const rid = id(0.31);
    sweep([[RAIL_U - 0.04, WALK_Y + 1.0], [RAIL_U - 0.04, WALK_Y + 1.07], [RAIL_U + 0.04, WALK_Y + 1.07], [RAIL_U + 0.04, WALK_Y + 1.0], [RAIL_U - 0.04, WALK_Y + 1.0]], s0, s1, M.iron, rid);
    sweep([[RAIL_U - 0.025, WALK_Y + 0.12], [RAIL_U - 0.025, WALK_Y + 0.16], [RAIL_U + 0.025, WALK_Y + 0.16], [RAIL_U + 0.025, WALK_Y + 0.12], [RAIL_U - 0.025, WALK_Y + 0.12]], s0, s1, M.iron, rid);
    sweep([[RAIL_U - 0.02, WALK_Y + 0.84], [RAIL_U - 0.02, WALK_Y + 0.87], [RAIL_U + 0.02, WALK_Y + 0.87], [RAIL_U + 0.02, WALK_Y + 0.84], [RAIL_U - 0.02, WALK_Y + 0.84]], s0, s1, M.iron, rid);
    const n = Math.round((s1 - s0) / 2.4);
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n, [x, z] = at(s, RAIL_U);
      B.add(boxG(0.09, 1.1, 0.09, x, WALK_Y, z).rotateY(0), M.iron, rid + 0.004);
      B.add(cylG(0.07, 0.07, 0.04, x, WALK_Y + 1.1, z, 10), M.iron, rid + 0.004);
      B.add(sphG(0.065, x, WALK_Y + 1.18, z, 1, 1, 1, 10), M.iron, rid + 0.004);
    }
    for (let s = s0 + 0.13; s < s1 - 0.06; s += 0.13) { const [x, z] = at(s, RAIL_U); const g = boxG(0.018, 0.68, 0.018, 0, 0, 0); g.rotateY(heading(s)); g.translate(x, WALK_Y + 0.16, z); B.add(g, M.iron, rid + 0.008); }
  };
  railRun(SA + 10, PIER.s0); railRun(PIER.s1, SB - 4);
  solidS(S_MIN - 2, PIER.s0, RAIL_U - 0.2, EDGE_U + 2); solidS(PIER.s1, S_MAX + 4, RAIL_U - 0.2, EDGE_U + 2);
  // life rings on the railing
  const ringMat = ink({ map: TX.lifeRingTexture(), facing: 0.5, hatchFreq: 40 });
  for (const s of [-1.2, 28.8]) { const [x, z] = at(s, RAIL_U + 0.08); const g = new THREE.TorusGeometry(0.3, 0.075, 8, 22); g.rotateY(Math.PI / 2); g.translate(x, WALK_Y + 0.62, z); B.add(g, ringMat, id(0.39)); }

  // ---- the ends of the walk: the terminus behind, the street clock and the Wharf sign ahead ---
  // a near-continuous row of planters across the sidewalk and the promenade; on the
  // street, bollards joined by chains on both sides of the track's bumper post, so
  // every gap that is closed looks closed
  const chain = (x0, z0, x1, z1, y, sag = 0.16) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t)); }
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018, 4, false), M.iron, id(0.44));
  };
  for (const [s, dir] of [[S_MIN - 0.6, 1], [S_MAX + 0.8, -1]]) {
    for (const [u0, u1] of [[FACADE + 0.3, -KERB - 0.3], [KERB + 0.3, RAIL_U - 0.3]]) {
      const n = Math.max(1, Math.round((u1 - u0) / 2.2)), w = (u1 - u0) / n - 0.12;
      for (let i = 0; i < n; i++) {
        const u = u0 + ((u1 - u0) * (i + 0.5)) / n, [x, z] = at(s, u);
        const put = placer(B, x, WALK_Y, z, heading(s));
        put(boxG(w, 0.6, 0.8, 0, 0, 0), M.stone, id(0.45)); put(boxG(w + 0.08, 0.06, 0.88, 0, 0.6, 0), M.trim, id(0.45));
        shrubs(B, M, ...at(s, u - w / 2 + 0.25), ...at(s, u + w / 2 - 0.25), WALK_Y + 0.5, { seed: s * 13 + u });
      }
      solidS(s - 0.5, s + 0.5, u0, u1);
    }
    // bollards on the kerbs and either side of the track, chains between them
    const BU = [-KERB - 0.15, -1.7, 1.7, KERB + 0.15];
    for (const u of BU) { const [x, z] = at(s, u), y = Math.abs(u) > KERB ? WALK_Y : 0; solidC(bollard(B, M, x, y, z)); }
    for (const [ua, ub] of [[BU[0], BU[1]], [BU[2], BU[3]]]) chain(...at(s, ua), ...at(s, ub), 0.62);
    for (const ub of [BU[1], BU[2]]) chain(...at(s, ub), ...at(s - dir * 0.6, Math.sign(ub) * 0.85), 0.62, 0.08);
    const [x, z] = at(s - dir * 0.6, 0);
    const put = placer(B, x, 0, z, heading(s));
    put(boxG(1.6, 0.7, 0.35, 0, 0, 0), M.ironMid, id(0.46)); put(boxG(1.8, 0.12, 0.45, 0, 0.7, 0), M.iron, id(0.46));
    solidS(s - dir * 0.6 - 0.3, s - dir * 0.6 + 0.3, -1.4, 1.4);
    solidS(s - 0.5, s + 0.5, -KERB - 0.3, KERB + 0.3);
  }
  // the street clock on the sidewalk by the far end: a fluted post, a two-faced drum clock
  {
    const s = S_MAX - 4.6, [x, z] = at(s, -KERB - 0.9), put = placer(B, x, WALK_Y, z, heading(s)), cid = id(0.47);
    const face = ink({ map: clockFaceTexture(), facing: 0.1, hatch: 0 });
    put(cylG(0.22, 0.26, 0.5, 0, 0, 0, 14), M.iron, cid);
    put(cylG(0.1, 0.12, 2.9, 0, 0.5, 0, 12), M.iron, cid);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; put(cylG(0.03, 0.03, 2.6, Math.cos(a) * 0.115, 0.65, Math.sin(a) * 0.115, 4), M.ironMid, cid + 0.002); }
    put(cylG(0.16, 0.12, 0.2, 0, 3.4, 0, 12), M.iron, cid);
    const drum = new THREE.CylinderGeometry(0.42, 0.42, 0.24, 28); drum.rotateX(Math.PI / 2); drum.translate(0, 3.95, 0);
    put(drum, [M.iron, face, face], cid + 0.004);
    const rim = new THREE.TorusGeometry(0.43, 0.04, 6, 28); for (const sz of [-0.12, 0.12]) put(rim.clone().translate(0, 3.95, sz), M.iron, cid + 0.006);
    put(sphG(0.08, 0, 4.47, 0, 1, 1.5, 1, 10), M.iron, cid);
    solidC({ x, z, r: 0.3 });
  }
  // the round Fisherman's Wharf sign on its post, facing back up the street
  {
    const s = S_MAX - 1.5, [x, z] = at(s, 4.6), put = placer(B, x, WALK_Y, z, heading(s)), wid = id(0.48);
    put(cylG(0.16, 0.2, 0.4, 0, 0, 0, 12), M.iron, wid);
    put(cylG(0.09, 0.1, 4.0, 0, 0.4, 0, 10), M.iron, wid);
    const disc = new THREE.CylinderGeometry(1.15, 1.15, 0.14, 40); disc.rotateX(Math.PI / 2); disc.rotateZ(Math.PI / 2); disc.translate(0, 4.8, 0.15);
    put(disc, [M.woodDark, ink({ map: BX.wharfWheelTexture(), facing: 0.1, hatch: 0 }), M.woodDark], wid + 0.002);
    const rim = new THREE.TorusGeometry(1.2, 0.07, 6, 40); rim.translate(0, 4.8, 0.15); put(rim, M.woodDark, wid + 0.004);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const h = new THREE.CylinderGeometry(0.05, 0.07, 0.42, 8); h.translate(0, 1.42, 0); h.rotateZ(a); h.translate(0, 4.8, 0.15);
      put(h, M.woodDark, wid + 0.004);
      put(sphG(0.08, Math.cos(a + Math.PI / 2) * 1.66, 4.8 + Math.sin(a + Math.PI / 2) * 1.66, 0.15, 1, 1, 1, 8), M.woodDark, wid + 0.004);
    }
    solidC({ x, z, r: 0.3 });
  }
  // the cable car terminus booth behind the spawn, on the promenade side
  {
    const [x, z] = at(S_MIN + 1.6, KERB + 1.6), put = placer(B, x, WALK_Y, z, 0), bid = id(0.5);
    put(boxG(1.6, 2.3, 1.4, 0, 0, 0), M.siding, bid);
    put(boxG(1.9, 0.12, 1.7, 0, 2.3, 0), M.trim, bid);
    const roof = new THREE.ConeGeometry(1.35, 0.6, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 2.72, 0); put(roof, M.ironMid, bid);
    const g = new THREE.PlaneGeometry(1.1, 0.7); g.rotateY(-Math.PI / 2); g.translate(-0.81, 1.35, 0); put(g, M.glass, bid + 0.002);
    const sg = new THREE.PlaneGeometry(1.3, 0.3); sg.rotateY(-Math.PI / 2); sg.translate(-0.82, 2.0, 0);
    put(sg, ink({ map: BX.shopSignTexture({ en: 'CABLE CAR', zh: '叮噹車' }, { sub: { en: 'TICKETS', zh: '售票處' }, dark: true, W: 900, H: 210, seed: 983 }), facing: 0.1, hatch: 0 }), bid + 0.004);
    solid(x - 0.85, x + 0.85, z - 0.75, z + 0.75);
  }

  // =====================================================================
  // THE FISHING PIER: planks on pilings, rails, lamps, a bench, the lookout
  // =====================================================================
  {
    const [px0, pz0] = at(PIER.s0, EDGE_U - 0.35), [px1, pz1] = at(PIER.s1, PIER.u1); // the straight part: x across, z along
    const xa = Math.min(px0, px1), xb = Math.max(px0, px1), za = Math.min(pz0, pz1), zb = Math.max(pz0, pz1);
    B.box(xb - xa, 0.32, zb - za, (xa + xb) / 2, WALK_Y - 0.32, (za + zb) / 2, M.planks, id(0.23), { top: M.planks });
    B.box(xb - xa, 0.3, 0.18, (xa + xb) / 2, WALK_Y - 0.62, za + 0.1, M.woodDark, id(0.24));
    B.box(xb - xa, 0.3, 0.18, (xa + xb) / 2, WALK_Y - 0.62, zb - 0.1, M.woodDark, id(0.24));
    for (let x = xa + 1.5; x < xb; x += 3) for (const z of [za + 0.25, zb - 0.25]) B.add(cylG(0.17, 0.19, WALK_Y - WATER_Y + 1.2, x, WATER_Y - 1.2, z, 8), M.woodDark, id(0.24));
    // wooden rails on both sides and across the end
    const rid = id(0.25);
    const woodRail = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2));
      for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n; B.add(boxG(0.14, 1.1, 0.14, x, WALK_Y, z), M.woodDark, rid); }
      for (const [h, t] of [[1.0, 0.12], [0.5, 0.08]]) { const g = new THREE.BoxGeometry(L, t, 0.1); g.rotateY(-Math.atan2(z1 - z0, x1 - x0)); g.translate((x0 + x1) / 2, WALK_Y + h, (z0 + z1) / 2); B.add(g, M.wood, rid); }
    };
    woodRail(xa + 0.3, za + 0.1, xb - 0.1, za + 0.1); woodRail(xa + 0.3, zb - 0.1, xb - 0.1, zb - 0.1); woodRail(xb - 0.1, za + 0.1, xb - 0.1, zb - 0.1);
    solid(xa + 0.1, xb + 1, za - 1, za + 0.25); solid(xa + 0.1, xb + 1, zb - 0.25, zb + 1); solid(xb - 0.3, xb + 1, za - 1, zb + 1);
    // lamps on the pier, a bench, bollards with mooring lines
    for (const x of [xa + 4.5, xa + 10.5]) { solidC(lamp(B, M, x, WALK_Y, za + 0.45, { h: 3.4 })); solidC(lamp(B, M, x, WALK_Y, zb - 0.45, { h: 3.4 })); }
    for (const x of [xa + 2, xa + 7.5]) for (const z of [za + 0.4, zb - 0.4]) solidC(bollard(B, M, x, WALK_Y, z));
    // the lookout at the end's bay-side corner: coin binoculars aimed at the bridge, and the plaque
    const lk = { x: xb - 1.4, z: za + 1.2 };
    const put = placer(B, lk.x, WALK_Y, lk.z, Math.atan2(-(BRIDGE_MID[0] - lk.x), -(BRIDGE_MID[1] - lk.z))), lid = id(0.51);
    put(cylG(0.12, 0.16, 0.08, 0, 0, 0, 14), M.iron, lid);
    put(cylG(0.05, 0.07, 1.0, 0, 0.08, 0, 10), M.iron, lid);
    put(boxG(0.32, 0.2, 0.22, 0, 1.06, 0), M.ironMid, lid);
    for (const sx of [-1, 1]) put(cylG(0.05, 0.06, 0.18, 0, 0, 0, 12).rotateX(Math.PI / 2).translate(sx * 0.08, 1.16, -0.15), M.iron, lid);
    solidC({ x: lk.x, z: lk.z, r: 0.3 });
    const pl = { x: xb - 1.3, z: (za + zb) / 2 + 1.0 };
    const pput = placer(B, pl.x, WALK_Y, pl.z, Math.PI / 2);
    pput(boxG(0.1, 0.8, 0.1, 0, 0, 0.12), M.iron, lid + 0.002);
    const pg = new THREE.BoxGeometry(0.9, 0.6, 0.05); pg.rotateX(-0.6); pg.translate(0, 1.1, 0);
    pput(pg, [M.iron, M.iron, M.iron, M.iron, M.iron, ink({ map: BX.lookoutPlaqueTexture(), facing: 0.1, hatch: 0 })], lid + 0.002);
    solidC({ x: pl.x, z: pl.z, r: 0.35 });
    PIER.look = lk; PIER.plaque = pl; PIER.xa = xa; PIER.xb = xb; PIER.za = za; PIER.zb = zb;
  }
  // dock posts and buoys in the water
  for (const [s, u] of [[14, 10], [14.6, 12], [28, 11], [28.8, 13.5], [-6, 10.5], [-30, 11]]) { const [x, z] = at(s, u); B.add(cylG(0.2, 0.24, 2.6, x, WATER_Y - 1, z, 8), M.woodDark, id(0.52)); B.add(sphG(0.21, x, WATER_Y + 1.6, z, 1, 0.5, 1, 8), M.woodDark, id(0.52)); }
  const buoys = [[31, 18], [45, 26], [10, 30], [60, 22]].map(([s, u]) => at(s, u));

  // =====================================================================
  // THE PIER SHED behind the spawn: a bulkhead front with a great arch
  // =====================================================================
  {
    const s0 = -48, s1 = -16, u0 = EDGE_U + 1.5, u1 = 40, H = 11, sid = id(0.54);
    const [xa, za] = at(s1, u0), [xb, zb] = at(s0, u1); // xa < xb (out over the water), za < zb (back toward the Ferry Building)
    B.box(xb - xa, H - 2, zb - za, (xa + xb) / 2, WALK_Y + 2, (za + zb) / 2, M.stucco2, sid, { top: M.ledge });
    B.box(xb - xa, WALK_Y + 2 - (WATER_Y - 0.5), zb - za, (xa + xb) / 2, WATER_Y - 0.5, (za + zb) / 2, M.stone, sid);
    for (let z = za + 2; z < zb; z += 4) B.add(cylG(0.25, 0.28, 2, xa + 0.6, WATER_Y - 1, z, 8), M.woodDark, sid + 0.002);
    // the bulkhead front facing the promenade: pilasters, the arch, a cornice, the name
    const fx = xa - 0.02, zc = (za + zb) / 2, fw = zb - za;
    const putF = placer(B, fx, WALK_Y + 2, zc, -Math.PI / 2);
    for (const k of [-0.5, -0.17, 0.17, 0.5]) putF(boxG(0.7, H - 2, 0.4, k * fw, 0, 0.15), M.trim, sid + 0.004);
    const arch = new THREE.Shape(); const ar = 3.2; arch.moveTo(-ar, 0); arch.lineTo(ar, 0); arch.lineTo(ar, 3.5); arch.absarc(0, 3.5, ar, 0, Math.PI, false); arch.lineTo(-ar, 0);
    const ag = new THREE.ShapeGeometry(arch, 16); ag.translate(0, -0.01, 0.06); putF(ag, M.dark, sid + 0.006);
    const atr = new THREE.TorusGeometry(ar + 0.2, 0.2, 5, 24, Math.PI); atr.translate(0, 3.5, 0.15); putF(atr, M.trim, sid + 0.004);
    for (const k of [-0.33, 0.33]) for (const y of [2, 5.5]) { const g = new THREE.PlaneGeometry(1.6, 2.2); g.translate(k * fw, y, 0.08); putF(g, M.glass, sid + 0.008); }
    putF(boxG(fw + 0.6, 0.5, 0.9, 0, H - 2, 0.3), M.ledge, sid + 0.004);
    putF(boxG(fw * 0.4, 1.4, 0.4, 0, H - 1.5, 0.1), M.stucco2, sid + 0.004);
    const ng = new THREE.PlaneGeometry(4.6, 0.95); ng.translate(0, H - 0.95, 0.32);
    putF(ng, ink({ map: BX.shopSignTexture({ en: 'PIER 1', zh: '一號碼頭' }, { dark: false, W: 900, H: 190, seed: 985 }), facing: 0.1, hatch: 0 }), sid + 0.01);
    blocker(new THREE.BoxGeometry(xb - xa, H, zb - za), (xa + xb) / 2, WALK_Y + H / 2, zc);
  }

  // =====================================================================
  // THE FERRY BUILDING closes the street behind the spawn: a long arcaded
  // hall across the end of the street, its clock tower over the tracks
  // =====================================================================
  {
    const z0 = -SA + 5, x0 = -45, x1 = 55, D = 22, H = 12, fid = id(0.56), y0 = 0;
    const putF = placer(B, 0, y0, z0, Math.PI); // local +z faces back up the street (world -z)
    const X = (x) => -x;                         // world x -> local x (the frame is turned half round)
    const w = x1 - x0, cx = X((x0 + x1) / 2);
    putF(boxG(w, H, D, cx, 0, -D / 2), M.stucco, fid);
    putF(boxG(w + 0.6, 0.5, D + 0.6, cx, H, -D / 2 + 0.1), M.ledge, fid + 0.002);
    putF(boxG(w, 1.4, D - 4, cx, H + 0.5, -D / 2), M.stucco2, fid);
    putF(boxG(w, 0.25, 0.25, cx, 5.1, 0.12), M.trim, fid + 0.002);           // the belt course
    // the end pavilions, a storey higher
    for (const ex of [x0 + 5, x1 - 5]) { putF(boxG(10.4, H + 3, D + 0.6, X(ex), 0, -D / 2 + 0.3), M.stucco, fid + 0.004); putF(boxG(11, 0.5, D + 1.2, X(ex), H + 3, -D / 2 + 0.3), M.ledge, fid + 0.004); }
    // the arcade: round arches on piers along the ground floor, arched windows above
    const bay = 4, n = Math.floor((w - 20) / bay);
    for (let i = 0; i < n; i++) {
      const x = X(x0 + 10 + bay * (i + 0.5));
      const ar = new THREE.Shape(), r = 1.35; ar.moveTo(-r, 0); ar.lineTo(r, 0); ar.lineTo(r, 2.7); ar.absarc(0, 2.7, r, 0, Math.PI, false); ar.lineTo(-r, 0);
      const ag = new THREE.ShapeGeometry(ar, 10); ag.translate(x, 0, 0.1); putF(ag, M.dark, fid + 0.006);
      const tr2 = new THREE.TorusGeometry(r + 0.12, 0.12, 4, 14, Math.PI); tr2.translate(x, 2.7, 0.14); putF(tr2, M.trim, fid + 0.008);
      putF(boxG(0.7, 4.95, 0.3, x + bay / 2, 0, 0.15), M.trim, fid + 0.008);
      const wg = new THREE.PlaneGeometry(1.4, 2.4); wg.translate(x, 7.6, 0.1); putF(wg, M.glass, fid + 0.006);
      const wa = new THREE.TorusGeometry(0.78, 0.08, 4, 12, Math.PI); wa.translate(x, 8.8, 0.14); putF(wa, M.trim, fid + 0.008);
      putF(boxG(1.7, 0.1, 0.2, x, 6.3, 0.1), M.ledge, fid + 0.008);
    }
    // the clock tower, over the street's line: a shaft, four clocks, the belfry, the cupola
    const tx = X(4), clock = ink({ map: clockFaceTexture(), facing: 0.1, hatch: 0 });
    putF(boxG(12, 6, 12, tx, H, -6), M.stucco, fid + 0.01);
    putF(boxG(9, 20, 9, tx, H + 6, -6), M.stucco, fid + 0.01);
    for (let y = H + 9; y < H + 24; y += 3) putF(boxG(9.1, 0.12, 9.1, tx, y, -6), M.trim, fid + 0.012);
    for (let q = 0; q < 4; q++) {
      const c = new THREE.CylinderGeometry(2.3, 2.3, 0.4, 28); c.rotateX(Math.PI / 2); c.rotateZ(Math.PI / 2); c.translate(0, 0, 4.6); c.rotateY((q * Math.PI) / 2); c.translate(tx, H + 21, -6);
      putF(c, [M.trim, clock, clock], fid + 0.014);
    }
    putF(boxG(10.2, 0.8, 10.2, tx, H + 26, -6), M.ledge, fid + 0.012);
    putF(boxG(7.6, 5.4, 7.6, tx, H + 26.8, -6), M.stucco2, fid + 0.012);
    for (let q = 0; q < 4; q++) for (const k of [-1.7, 0, 1.7]) {
      const g = new THREE.PlaneGeometry(1.1, 3.4); g.translate(k, H + 28.8, 3.82); g.rotateY((q * Math.PI) / 2); g.translate(tx, 0, -6); putF(g, M.dark, fid + 0.016);
    }
    putF(boxG(8.4, 0.6, 8.4, tx, H + 32.2, -6), M.ledge, fid + 0.012);
    putF(boxG(5.6, 2.6, 5.6, tx, H + 32.8, -6), M.stucco, fid + 0.012);
    { const d = new THREE.SphereGeometry(3.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 1.3, 1); d.translate(tx, H + 35.4, -6); putF(d, M.stucco2, fid + 0.018); }
    putF(cylG(0.5, 0.6, 1.6, tx, H + 39.3, -6, 10), M.trim, fid + 0.018);
    putF(cylG(0.08, 0.12, 6, tx, H + 40.9, -6, 6), M.iron, fid + 0.018);
    // a name over the middle doors
    const ng = new THREE.PlaneGeometry(9, 1.2); ng.translate(tx, H - 1.0, 0.15);
    putF(ng, ink({ map: BX.shopSignTexture({ en: 'FERRY BUILDING', zh: '渡輪大廈' }, { dark: false, W: 1500, H: 200, seed: 987 }), facing: 0.1, hatch: 0 }), fid + 0.02);
    blocker(new THREE.BoxGeometry(w, H + 30, D), (x0 + x1) / 2, H / 2, z0 + D / 2);
  }

  // =====================================================================
  // SAN FRANCISCO, THE BAY
  // =====================================================================
  const sf = buildSF(root, { WATER_Y, SHORE_Y, street: { at, toStreet: toStreetFar, heading, built: [SA, SB] } });
  const river = buildRiver(root, { WATER_Y, SHORE_Z: -1400, SHORE_Y, sky: sf.sky, shore: [], skyZ: -850, zNear: 220 });
  updaters.push(river.update);

  // ---- the cable cars: one running up and down the block, one waiting past the far end -------
  const CM = cableCarMaterials();
  const carShape = (car, s) => { const [x, z] = at(s, 0); car.position.set(x, 0.03, z); car.rotation.y = heading(s) + Math.PI / 2; };
  const parked = buildCableCar(CM, { seed: 0.57 });
  root.add(parked); carShape(parked, 37);
  { const g = new THREE.BoxGeometry(CAR.W, 3.6, CAR.L); g.translate(0, 1.8, 0); blocker(g, ...((([x, z]) => [x, 0, z])(at(37, 0)))); }
  const car = buildCableCar(CM, { seed: 0.41 });
  root.add(car);
  const carCol = { type: 'box', minX: 0, maxX: 0, minZ: 0, maxZ: 0, moving: true };
  colliders.push(carCol);
  const carBlock = blocker((() => { const g = new THREE.BoxGeometry(CAR.W, 3.6, CAR.L); g.translate(0, 1.8, 0); return g; })(), 0, 0, 0);
  // the gripman, standing at the grip in the open front section
  const gripman = createCharacter({ style: 'auntie', bun: false, topTone: 0.32 });
  gripman.root.position.set(2.4, 0.95, 0); gripman.root.rotation.y = Math.PI / 2;
  car.add(gripman.root);
  const run = { s: 12, dir: 1, wait: 3, v: 0, waitingFor: false, bellT: 0 };
  const RUN = [9, 21];
  updaters.push((t, dt, c) => {
    const p = c.player.pos, [ps, pu] = toStreet(p.x, p.z);
    // waits for anyone on the track ahead
    const nose = run.s + run.dir * (CAR.L / 2);
    const blocked = Math.abs(pu) < CAR.W / 2 + 0.7 && (run.dir > 0 ? ps > nose - 0.2 && ps < nose + 3.2 : ps < nose + 0.2 && ps > nose - 3.2);
    if (blocked && run.v > 0.05 && run.bellT <= 0) { c.sound('chime'); run.bellT = 6; }
    run.bellT = Math.max(0, run.bellT - dt);
    run.waitingFor = blocked;
    if (run.wait > 0) { run.wait -= dt; run.v = Math.max(0, run.v - dt * 2); }
    else {
      const target = blocked ? 0 : 1.7, toEnd = run.dir > 0 ? RUN[1] - run.s : run.s - RUN[0];
      const cap = Math.sqrt(Math.max(0, 2 * 0.9 * toEnd));
      const want = Math.min(target, cap), acc = want < run.v ? (blocked ? 2.4 : 0.9) : 0.6; // the gripman brakes hard for people
      run.v += Math.sign(want - run.v) * Math.min(Math.abs(want - run.v), dt * acc);
      run.s += run.dir * run.v * dt;
      if (toEnd < 0.02) { run.s = run.dir > 0 ? RUN[1] : RUN[0]; run.dir *= -1; run.wait = 12; run.v = 0; }
    }
    carShape(car, run.s);
    const [cx, cz] = at(run.s, 0);
    Object.assign(carCol, { minX: cx - CAR.W / 2 - 0.12, maxX: cx + CAR.W / 2 + 0.12, minZ: cz - CAR.L / 2 - 0.12, maxZ: cz + CAR.L / 2 + 0.12 });
    carBlock.position.set(cx, 0, cz);
    gripman.update(dt, t, { speed: 0 });
  });

  // ---- people: a barista, passers-by on the sidewalk -----------------------------------
  const barista = createCharacter({ style: 'auntie', topTone: 0.85 });
  {
    const a = cafe.room, cx = (a.x0 + a.x1) / 2;
    const v = new THREE.Vector3(cx + 0.8, 0, a.zBack + 0.65).applyMatrix4(cafe.mtx);
    barista.root.position.set(v.x, WALK_Y, v.z); barista.root.rotation.y = cafe.ry;
    root.add(barista.root);
  }
  const walkers = [[8, -5.3, 1, 0.9, 0.55], [26, -4.6, -1, 0.95, 0.3], [16, -5.0, 1, 0.85, 0.75], [20, 4.4, -1, 0.8, 0.45]].map(([s, u, dir, v, tone], i) => {
    const ch = createCharacter({ style: 'auntie', bun: i % 2 === 0, topTone: tone });
    root.add(ch.root);
    const col = { type: 'circle', x: 0, z: 0, r: 0.3, moving: true };
    colliders.push(col);
    return { ch, s, u0: u, u, dir, v, col, lo: u > 0 ? 8.5 : 6, hi: 27.5, speed: 0 };
  });
  // the walkable band of each side (a walker steps aside within it to let the player by)
  const LANE = { side: [FACADE + 1.6, -KERB - 1.15], prom: [KERB + 1.55, RAIL_U - 2.5] }; // clear of the beds, benches, lamps
  updaters.push((t, dt, c) => {
    const p = c.player.pos;
    const [ps, pu] = toStreet(p.x, p.z);
    for (const w of walkers) {
      // someone in my lane just ahead: step to the far side of the lane and slow down, never block
      const [lo, hi] = w.u0 > 0 ? LANE.prom : LANE.side;
      const inLane = Math.abs(ps - w.s) < 3 && Math.abs(pu - w.u0) < 1.6;
      const side = pu > w.u0 ? -1 : 1;
      const wantU = inLane ? THREE.MathUtils.clamp(w.u0 + side * 1.3, lo, hi) : w.u0;
      w.u += (wantU - w.u) * Math.min(1, dt * 2.5);
      const [x, z] = at(w.s, w.u);
      const near = Math.hypot(p.x - x, p.z - z) < 1.1;
      const want = near ? 0 : inLane ? w.v * 0.5 : w.v;
      w.speed += (want - w.speed) * Math.min(1, dt * 4);
      w.s += w.dir * w.speed * dt;
      if (w.s > w.hi) { w.s = w.hi; w.dir = -1; } else if (w.s < w.lo) { w.s = w.lo; w.dir = 1; }
      const [nx, nz] = at(w.s, w.u);
      w.ch.root.position.set(nx, WALK_Y, nz);
      const face = heading(w.s) + (w.dir > 0 ? Math.PI : 0);
      w.ch.root.rotation.y = near ? Math.atan2(p.x - nx, p.z - nz) : face;
      w.col.x = nx; w.col.z = nz;
      w.ch.update(dt, t, { speed: w.speed, ground: () => WALK_Y });
    }
    barista.update(dt, t, { speed: 0 });
  });

  B.flush(root, { cast: true, receive: true });

  // ---- boats: sailboats moored by the pier and out on the bay, a ferry crossing ----------
  const boatMat = { hull: ink({ tone: 0.97, facing: 0.5, hatchFreq: 6 }), deck: ink({ tone: 0.7, facing: 0.4, hatch: 0 }), sail: ink({ tone: 0.99, facing: 0.5, hatchFreq: 6, side: THREE.DoubleSide }), mast: ink({ tone: 0.2, hatch: 0 }), stripe: ink({ tone: 0.35, hatch: 0 }), win: ink({ map: TX.boatWindowTexture(), repeat: [3, 1], facing: 0.4, hatchFreq: 2 }) };
  function sailboat(s = 1, furled = false) {
    const g = new THREE.Group();
    const sh = new THREE.Shape(); sh.moveTo(-3, -1); sh.lineTo(1.8, -1); sh.quadraticCurveTo(3.4, -0.4, 3.8, 0); sh.quadraticCurveTo(3.4, 0.4, 1.8, 1); sh.lineTo(-3, 1); sh.lineTo(-3, -1);
    const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false, curveSegments: 6 }); hull.rotateX(-Math.PI / 2); hull.translate(0, -0.3, 0);
    g.add(new THREE.Mesh(hull, boatMat.hull));
    const stripe = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false, curveSegments: 6 }); stripe.rotateX(-Math.PI / 2); stripe.scale(1.01, 1, 1.02); stripe.translate(0, 0.35, 0);
    g.add(new THREE.Mesh(stripe, boatMat.stripe));
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1.2), boatMat.hull); cab.position.set(-0.8, 0.85, 0); g.add(cab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 8, 6), boatMat.mast); mast.position.set(0.6, 4.6, 0); g.add(mast);
    if (furled) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 6), boatMat.sail); f.rotation.z = Math.PI / 2; f.position.set(-1.1, 1.6, 0); g.add(f); }
    else {
      const main = new THREE.BufferGeometry(); main.setAttribute('position', new THREE.Float32BufferAttribute([0.55, 1.3, 0, 0.55, 8.4, 0, -2.9, 1.3, 0], 3)); main.computeVertexNormals();
      g.add(new THREE.Mesh(main, boatMat.sail));
      const jib = new THREE.BufferGeometry(); jib.setAttribute('position', new THREE.Float32BufferAttribute([0.7, 7.6, 0, 3.6, 0.7, 0, 0.75, 1.2, 0], 3)); jib.computeVertexNormals();
      g.add(new THREE.Mesh(jib, boatMat.sail));
    }
    g.scale.setScalar(s);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noBlock = true; } });
    root.add(g);
    return g;
  }
  function ferry() {
    const g = new THREE.Group();
    const L = 30, W = 8;
    const sh = new THREE.Shape(); sh.moveTo(-L / 2, -W / 2); sh.lineTo(L / 2 - 6, -W / 2); sh.quadraticCurveTo(L / 2, -W * 0.3, L / 2 + 0.8, 0); sh.quadraticCurveTo(L / 2, W * 0.3, L / 2 - 6, W / 2); sh.lineTo(-L / 2, W / 2); sh.lineTo(-L / 2, -W / 2);
    const hull = new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false, curveSegments: 6 }); hull.rotateX(-Math.PI / 2); hull.translate(0, -0.9, 0);
    g.add(new THREE.Mesh(hull, boatMat.hull));
    const band = new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: false, curveSegments: 6 }); band.rotateX(-Math.PI / 2); band.scale(1.01, 1, 1.03); band.translate(0, 0.9, 0);
    g.add(new THREE.Mesh(band, boatMat.stripe));
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(L * 0.62, 2.4, W * 0.84), boatMat.hull); c1.position.set(-2, 2.7, 0); g.add(c1);
    const c1w = new THREE.Mesh(new THREE.BoxGeometry(L * 0.6, 0.9, W * 0.86), boatMat.win); c1w.position.set(-2, 2.9, 0); g.add(c1w);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, 2, W * 0.66), boatMat.hull); c2.position.set(-3, 4.9, 0); g.add(c2);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 2.4, 10), boatMat.stripe); st.position.set(-5, 7, 0); g.add(st);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noBlock = true; } });
    root.add(g);
    return g;
  }
  // moored along the pier (bow toward the shore), one off the promenade
  // (none off the pier's end on the bridge side: their masts would cross the lookout's view)
  const moored = [[PIER.xa + 4, PIER.za - 2.8, 0.9], [PIER.xa + 6, PIER.zb + 2.8, 1.0], [PIER.xa + 12.5, PIER.zb + 2.8, 0.8]].map(([x, z, s], i) => ({ g: sailboat(s, true), x, z, ph: i * 1.7 }));
  // out on the bay: each sails a long straight leg and turns back
  const sailing = [[60, -90, 1.2, 0.5, -0.9], [140, -200, 1.4, -0.45, -0.6], [-20, -300, 1.6, 0.35, 1.3], [210, -40, 1.3, 0.4, -0.2], [90, -420, 1.8, -0.3, 1.0]].map(([x, z, s, v, ang], i) => ({ g: sailboat(s), x, z, v, ang, ph: i * 2.1 }));
  const ferryBoat = { g: ferry(), x0: 120, z0: -220, ang: -0.35, v: 3.4 };
  const buoyMeshes = buoys.map(([x, z], i) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.7, 10), boatMat.hull); b.position.y = 0.2; g.add(b);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.16, 10), boatMat.stripe); band.position.y = 0.32; g.add(band);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8), boatMat.stripe); top.position.y = 0.75; g.add(top);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noBlock = true; } });
    root.add(g);
    return { g, x, z, ph: i * 1.3 };
  });
  updaters.push((t) => {
    for (const b of moored) { b.g.position.set(b.x, WATER_Y + 0.25 + Math.sin(t * 0.9 + b.ph) * 0.05, b.z); b.g.rotation.set(Math.sin(t * 0.7 + b.ph) * 0.02, 0, Math.sin(t * 0.8 + b.ph) * 0.03); }
    for (const b of sailing) {
      const L = 360, k = ((t * Math.abs(b.v) + b.ph * 40) % (2 * L)), d = (k < L ? k : 2 * L - k) - L / 2, back = k >= L;
      const ux = Math.cos(b.ang), uz = -Math.sin(b.ang);
      b.g.position.set(b.x + ux * d, WATER_Y + 0.25 + Math.sin(t * 0.8 + b.ph) * 0.06, b.z + uz * d);
      b.g.rotation.set(0, b.ang + (back ? Math.PI : 0), (back ? -0.1 : 0.1) + Math.sin(t * 0.6 + b.ph) * 0.02);
    }
    const L = 900, k = (t * ferryBoat.v) % (2 * L), d = (k < L ? k : 2 * L - k) - L / 2, back = k >= L;
    ferryBoat.g.position.set(ferryBoat.x0 + Math.cos(ferryBoat.ang) * d, WATER_Y + 0.15 + Math.sin(t * 0.7) * 0.05, ferryBoat.z0 - Math.sin(ferryBoat.ang) * d);
    ferryBoat.g.rotation.y = ferryBoat.ang + (back ? Math.PI : 0);
    for (const b of buoyMeshes) { b.g.position.set(b.x, WATER_Y - 0.1 + Math.sin(t * 1.1 + b.ph) * 0.06, b.z); b.g.rotation.set(Math.sin(t * 0.9 + b.ph) * 0.08, 0, Math.cos(t * 0.7 + b.ph) * 0.08); }
  });
  // gulls: little ink Vs gliding over the water
  const birdMat = ink({ tone: 0.15, hatch: 0, side: THREE.DoubleSide });
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const wings = [-1, 1].map((sx) => { const w = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.28), birdMat); m.position.x = sx * 0.45; w.add(m); g.add(w); return w; });
    g.traverse((o) => { if (o.isMesh) o.userData.noBlock = true; });
    root.add(g);
    birds.push({ g, wings, ph: i * 1.3, y: 10 + i * 2.5, cx: 30 + i * 14, cz: -20 - i * 22, rad: 25 + i * 6, v: 0.12 + (i % 3) * 0.03 });
  }
  updaters.push((t) => {
    for (const b of birds) {
      const a = t * b.v + b.ph;
      b.g.position.set(b.cx + Math.cos(a) * b.rad, b.y + Math.sin(t * 0.4 + b.ph) * 1.5, b.cz + Math.sin(a) * b.rad);
      b.g.rotation.y = -a;
      const f = Math.sin(t * 3.2 + b.ph) * 0.45 + 0.1; b.wings[0].rotation.z = f; b.wings[1].rotation.z = -f;
    }
  });

  // ---- the sky: the drawn panorama around the camera (shared with Shanghai) --------------
  const pano = (() => {
    const { ELB, ELT } = TX.PANO, Rr = 1500;
    const yb = Rr * Math.tan((ELB * Math.PI) / 180), yt = Rr * Math.tan((ELT * Math.PI) / 180);
    const geo = new THREE.CylinderGeometry(Rr, Rr, yt - yb, 160, 1, true);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    geo.translate(0, (yt + yb) / 2, 0);
    const mat = backdropMaterial(TX.panoramaTexture()); mat.side = THREE.BackSide; mat.depthWrite = false;
    const m = new THREE.Mesh(geo, mat); m.layers.set(1); m.renderOrder = -10; m.frustumCulled = false;
    root.add(m);
    return m;
  })();
  updaters.push((t, dt, c) => { pano.position.copy(c.camera.position); });

  // =====================================================================
  // INTERACTIONS
  // =====================================================================
  const hud = document.getElementById('hud');
  const card = document.createElement('div'); card.className = 'lb-card bay-card hidden'; card.id = 'bay-card';
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
  hud.appendChild(card);
  const CARD = { title: 'The San Francisco waterfront', alt: 'A map of the waterfront: the Golden Gate Bridge, Alcatraz, the Ferry Building and the Embarcadero.', text: 'You are on the Embarcadero, the city\'s waterfront. The Golden Gate is to the north-west, Alcatraz out in the bay.' };
  let cardOpen = false, cardTimer = 0;
  const renderCard = () => {
    card.replaceChildren();
    const title = document.createElement('div'); title.className = 'title'; title.textContent = tr(CARD.title); card.append(title);
    const img = document.createElement('img'); img.src = BX.mapCardImage(getLang()); img.alt = tr(CARD.alt); card.append(img);
    const p = document.createElement('p'); p.textContent = tr(CARD.text); card.append(p);
    const more = document.createElement('div'); more.className = 'more';
    const [a, b] = tr('press {key} to close').split('{key}'); const k = document.createElement('kbd'); k.textContent = 'E';
    more.append(a ?? '', k, b ?? ''); card.append(more);
  };
  const openCard = () => { renderCard(); card.classList.remove('hidden'); cardOpen = true; cardTimer = 14; };
  const closeCard = () => { card.classList.add('hidden'); cardOpen = false; };
  const offLang = onLang(() => { if (cardOpen) renderCard(); });

  const spot = (id2, label, x, z, radius, prompt, act, o = {}) => { const it = { id: id2, label, kind: 'action', x, z, radius, pos: new THREE.Vector3(...prompt), act, ...o }; interactables.push(it); return it; };
  // 1. the café: its chalkboard
  const cafeCaption = 'Cafe Bay View: coffee, tea and sourdough pastries, with the bay just across the street.';
  spot('cafe', 'Read the chalkboard', chalk.x + 0.5, chalk.z, 1.4, [chalk.x, WALK_Y + 1.45, chalk.z], (c) => {
    c.caption(cafeCaption, 5); c.complete('cafe'); c.sound('chime');
  });
  // 2. the cable car (its side, following it along the track)
  const carCaption = 'San Francisco\'s cable cars have climbed these hills since 1873, pulled along by a cable running under the street.';
  const carSpot = spot('cablecar', 'Look at the cable car', 0, 0, 2.3, [0, 3.0, 0], (c) => {
    c.caption(carCaption, 6); c.complete('cablecar'); c.sound('chime');
  });
  updaters.push(() => { const [x, z] = at(run.s, -1.9); carSpot.x = x; carSpot.z = z; carSpot.pos.set(x + 0.6, 3.2, z); });
  // 3. the lookout at the pier's end: pan to the bridge
  const toBridge = (x, z) => { const dx = BRIDGE_MID[0] - x, dz = BRIDGE_MID[1] - z, d = Math.hypot(dx, dz); return [dx / d, dz / d]; };
  const [lkx, lkz] = toBridge(PIER.look.x, PIER.look.z);
  spot('lookout', 'Look at the Golden Gate', PIER.look.x - lkx * 0.8, PIER.look.z - lkz * 0.8, 1.1, [PIER.look.x, WALK_Y + 1.6, PIER.look.z], (c) => {
    const [bx, bz] = sf.bridgeMid;
    c.face(bx, bz);
    const yaw = Math.atan2(-(bx - c.player.pos.x), -(bz - c.player.pos.z));
    c.pan({ yaw, pitch: 0.03, dist: 3.6, rate: 1.0, lock: 2.6, lookUp: 0.9 });
    c.caption('The Golden Gate Bridge, opened in 1937, spans the strait where the bay meets the Pacific.', 5.5);
    c.complete('pier'); c.sound('chime');
  }, { noReach: true });
  spot('plaque', 'Read the plaque', PIER.plaque.x - 0.8, PIER.plaque.z, 1.0, [PIER.plaque.x, WALK_Y + 1.6, PIER.plaque.z], (c) => {
    c.caption('The bridge is 1.7 miles long, and its towers rise 746 feet above the water. Alcatraz sits out in the bay in front of it.', 5.5); c.sound('chime');
  });
  // the visitor map
  spot('map', 'Read the Bay Area map', mapBoard.x - 0.55, mapBoard.z + 0.9, 1.3, [mapBoard.x, WALK_Y + 2.5, mapBoard.z], (c) => { openCard(); c.sound('chime'); });
  // 4. the way home
  spot('home', 'Back to the airport', post.x - 0.7, post.z + 0.4, 1.2, [post.x, WALK_Y + 4.7, post.z], (c) => c.travel('lobby'));
  // benches: sit and look out at the bay
  const benchCaption = 'The fog rolls in over the bridge. Nobody is in a hurry here.';
  benchPos.forEach(({ s, x, z }, i) => {
    const [ex, ez] = at(s, RAIL_U - 2.1), th = heading(s), [bdx, bdz] = toBridge(x, z);
    interactables.push({
      id: `bench${i}`, label: 'Sit on the bench', kind: 'seat', x: ex, z: ez, radius: 0.9, pos: new THREE.Vector3(x, WALK_Y + 0.95, z),
      seat: { seat: [x, WALK_Y + 0.28, z], exit: [ex, ez], via: [], pose: 'sit', facing: Math.PI / 2 + th, caption: benchCaption, cam: { yaw: Math.atan2(-bdx, -bdz) - 0.15, pitch: 0.1, dist: 3.2 } },
    });
  });
  // Fisherman's Wharf: arriving at the far end
  const wharfCaption = "Fisherman's Wharf: sourdough, chowder and the sea lions just past the next pier.";
  let atWharf = false;

  // ---- per frame ----------------------------------------------------------------------
  function update(t, dt, c) {
    for (const u of updaters) u(t, dt, c);
    const p = c.player.pos;
    const [ps] = toStreet(p.x, p.z);
    const near = ps > S_MAX - 5 && ps < S_MAX + 2;
    if (near && !atWharf) c.caption(wharfCaption, 4);
    atWharf = near;
    if (cardOpen) { cardTimer -= dt; if (cardTimer <= 0 || Math.hypot(p.x - mapBoard.x, p.z - mapBoard.z) > 3.2) closeCard(); }
  }
  function onKey(code) {
    if (cardOpen && (code === 'KeyE' || code === 'Escape')) { closeCard(); return true; }
    return false;
  }

  return {
    root,
    colliders,
    camBlockers,
    interactables,
    stars: [],
    update,
    heightAt,
    onKey,
    viewAt: () => ({ dist: 3.0 }),
    strings: [CARD.title, CARD.alt, CARD.text, wharfCaption, 'press {key} to close'],
    walkable: [{ id: 'street', s: [S_MIN, S_MAX], u: [FACADE, EDGE_U] }, { id: 'pier', s: [PIER.s0, PIER.s1], u: [EDGE_U, PIER.u1] }],
    debug: () => ({
      car: { s: +run.s.toFixed(2), v: +run.v.toFixed(2), waiting: run.waitingFor },
      boats: sailing.map((b) => [+b.g.position.x.toFixed(1), +b.g.position.z.toFixed(1)]),
      ferry: +ferryBoat.g.position.x.toFixed(1),
      walkers: walkers.map((w) => +w.s.toFixed(1)),
      waterTime: +river.mat.uniforms.uTime.value.toFixed(2),
      card: cardOpen,
    }),
    dispose() { offLang(); card.remove(); },
  };
}
