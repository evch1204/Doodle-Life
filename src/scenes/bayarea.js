import * as THREE from 'three';
import { ink, backdropMaterial } from '../ink.js';
import * as TX from '../shanghaiTextures.js';
import * as BX from '../bayTextures.js';
import { t as tr, onLang } from '../i18n.js';
import { Batch, BOLD, farId } from './kit.js';
import { buildRiver } from './shanghai/river.js';
import { bayMaterials, at as place, boxG, cylG, sphG, palm, oak, lamp, bench, hedge, shrubs } from './bayarea/props.js';
import { buildCampus, CAMPUS } from './bayarea/campus.js';
import { buildSF } from './bayarea/sf.js';

// Chapter 3: the Bay Area. San Francisco and Santa Clara University in one
// compressed, walkable postcard of the region, seen from a regional overlook.
//
// Layout (meters; -z across the bay toward San Francisco, x to the right, y up):
//
//   the overlook plaza  x -9..9,  z -8..14  (y 0): spawn, the Bay Area map, the signpost
//   the campus          x 2..46,  z -66..-8 (y 0): the palm walk along x = 18 to the
//                       Mission Church (front at z -50, three steps up), halls with arcades
//   the path            curves down the planted slope west of the plaza (y 0 -> -2.4)
//   the waterfront      x -44..2, z -17.3..-8 (y -2.4): promenade, wharf fronts, palms;
//                       the pier x -16..-10 out to z -46 with the lookout at its end
//   the bay             y -3.6; Alcatraz, then San Francisco 700 m+ away across it,
//                       the Golden Gate Bridge receding to the left into the strait
//
// Walkable ground is a set of regions (heightAt); outside them is "no ground",
// so the bay and the drops can never be entered.

const WATER_Y = -3.6, PROM_Y = -2.4, SHORE_Y = WATER_Y + 3;
const BRIDGE = { south: { az: -27, d: 820 }, north: { az: -47, d: 1200 } };
const OFF = -100;
const at = (az, d) => { const a = THREE.MathUtils.degToRad(az); return [Math.sin(a) * d, -Math.cos(a) * d]; };

// ---- the walkable ground ----------------------------------------------------------------
const AX = CAMPUS.axis;
const REGIONS = [
  { id: 'platform', x: [AX - 6.9, AX + 6.9], z: [-50.7, CAMPUS.steps[1]], y: CAMPUS.stepH },
  { id: 'steps', x: [AX - 6.9, AX + 6.9], z: [CAMPUS.steps[1], CAMPUS.steps[0]], from: CAMPUS.steps[0], to: CAMPUS.steps[1], y0: 0, y1: CAMPUS.stepH, steps: 3 },
  { id: 'overlook', x: [-9, 46], z: [-8, 14], y: 0 },
  { id: 'campus', x: [2, 46], z: [-66, -8], y: 0 },
  { id: 'waterfront', x: [-44, 2], z: [-17.3, -8], y: PROM_Y },
  { id: 'pier', x: [-16, -10], z: [-46, -17.3], y: PROM_Y },
];
// the path down the slope: a polyline (x, z, y), 3.2 m wide
const PATH = [[-9.6, 1.5, 0], [-14, 2.2, -0.35], [-19, 1.4, -0.95], [-22.6, -1.2, -1.6], [-24.8, -4.4, -2.15], [-25.6, -8.6, PROM_Y]];
const PATH_W = 3.2;
function nearestOnPath(x, z) {
  let best = { d: Infinity, y: 0, t: 0 };
  let acc = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az, ay] = PATH[i], [bx, bz, by] = PATH[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best.d) best = { d, y: ay + (by - ay) * t, s: acc + L * t };
    acc += L;
  }
  return best;
}
export function heightAt(x, z) {
  for (const r of REGIONS) {
    if (x < r.x[0] || x > r.x[1] || z < r.z[0] || z > r.z[1]) continue;
    if (r.y !== undefined) return r.y;
    const t = THREE.MathUtils.clamp((z - r.from) / (r.to - r.from), 0, 1);
    const i = Math.min(r.steps - 1, Math.floor(t * r.steps));
    return r.y0 + ((r.y1 - r.y0) * (i + 1)) / r.steps;
  }
  const p = nearestOnPath(x, z);
  return p.d <= PATH_W / 2 ? p.y : OFF;
}

export default {
  id: 'bayarea',
  name: 'the Bay Area',
  travelText: 'Traveling to the Bay Area…',
  hud: {
    title: 'Bay Area',
    sub: 'San Francisco · Santa Clara',
    style: 'card',
    map: 'compass',
    objectives: [
      { id: 'church', text: 'Visit the Mission Church' },
      { id: 'map', text: 'Read the Bay Area map' },
      { id: 'pier', text: 'Look out from the pier' },
    ],
  },
  start: { x: -1, z: 2.2, facing: Math.PI + 0.17, yaw: 0.17, pitch: 0.12 },
  sun: { dir: [-0.6, 2.4, 1.2], extent: 18, follow: true, far: 70 },
  camera: { far: 3200, dist: 3.0 },
  // distant lines thin and lighten, distant tones fade toward the paper; the bridge and the landmarks stay bold
  render: { grazeFix: 1, aerial: { near: 120, far: 1300, line: 0.5, tone: 0.3, bold: BOLD } },
  build: buildBayArea,
};

function buildBayArea(scene, ctx) {
  const M = bayMaterials();
  const root = new THREE.Group();
  root.name = 'bayarea';
  scene.add(root);
  const colliders = [], interactables = [], updaters = [], camBlockers = [];
  const solid = (x0, x1, z0, z1) => colliders.push({ type: 'box', minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
  const solidC = (c) => colliders.push({ type: 'circle', x: c.x, z: c.z, r: c.r });
  const blocker = (x0, x1, y0, y1, z0, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), M.paper);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.visible = false; m.userData.noBlock = true;
    root.add(m); camBlockers.push(m);
  };
  const B = new Batch();
  const id = (v) => farId(v);

  // =====================================================================
  // THE GROUND: terrace, plaza, slope with its path, waterfront, pier
  // =====================================================================
  // the upper terrace (overlook + campus) and the lawns beyond it
  B.box(59, 9, 146, 20.5, -9, -13, M.lawn, id(0.11), { top: M.lawn });           // x -9..50, z -86..60
  B.box(111, 4, 50, -64.5, -4.6, 55, M.lawn, id(0.12));                            // north-west, behind the slope (x -120..-9, z 30..80)
  B.box(74, 4, 38, -83, PROM_Y - 4, 11, M.lawn, id(0.12));                         // west of the wharf (x -120..-46, z -8..30)
  // the plaza paving and a kerb round it
  B.box(18, 0.05, 22, 0, 0, 3, M.paving, id(0.14));
  // the slope west of the plaza: its surface follows the path, which is laid on it
  {
    const x0 = -46, x1 = -9, z0 = -8, z1 = 30, nx = 37, nz = 38, pos = [], idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz;
      pos.push(x, nearestOnPath(x, z).y - 0.04, z);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    B.add(g, M.lawn, id(0.15));
    // the retaining wall where the slope meets the waterfront
    const wp = [], wi = [];
    for (let i = 0; i <= 20; i++) { const x = -26 + (17 * i) / 20, y = nearestOnPath(x, -8).y; wp.push(x, y, -8, x, PROM_Y - 0.1, -8); if (i) { const a = (i - 1) * 2; wi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const w = new THREE.BufferGeometry();
    w.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); w.setIndex(wi); w.computeVertexNormals();
    B.add(w, M.stone, id(0.16));
    // the path: a paved ribbon with kerbs, laid along the polyline
    const L = [];
    for (let i = 0; i < PATH.length - 1; i++) for (let k = 0; k < 6; k++) { const t = k / 6; L.push(PATH[i].map((v, q) => v + (PATH[i + 1][q] - v) * t)); }
    L.push(PATH[PATH.length - 1]);
    const curve = new THREE.CatmullRomCurve3(L.map(([x, z, y]) => new THREE.Vector3(x, y, z)));
    const pts = curve.getSpacedPoints(60);
    const rp = [], ri = [], ru = [];
    let s = 0;
    pts.forEach((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1, nx2 = -dz / l, nz2 = dx / l;
      if (i) s += p.distanceTo(pts[i - 1]);
      for (const sd of [-1, 1]) { rp.push(p.x + nx2 * sd * PATH_W / 2, p.y + 0.03, p.z + nz2 * sd * PATH_W / 2); ru.push(sd, s); }
      if (i) { const a = (i - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      if (i % 3 === 0) for (const sd of [-1, 1]) B.add(boxG(0.25, 0.14, 0.9, 0, 0, 0).rotateY(Math.atan2(dx, dz)).translate(p.x + nx2 * sd * (PATH_W / 2 + 0.1), p.y - 0.02, p.z + nz2 * sd * (PATH_W / 2 + 0.1)), M.kerb, id(0.17));
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(ru, 2)); pg.setIndex(ri); pg.computeVertexNormals();
    B.add(pg, M.path, id(0.18));
  }
  // the overlook's drop to the waterfront, the campus's edge down to the water
  B.box(11, 2.5, 0.6, -3.5, PROM_Y - 0.1, -8.3, M.stone, id(0.19));
  B.box(1.2, -WATER_Y + 0.5, 78, 2, WATER_Y - 0.5, -47, M.stone, id(0.2));
  // the waterfront: promenade slab with its sea wall; the pier on its pilings
  B.box(46, PROM_Y - WATER_Y + 1, 9.3, -21, WATER_Y - 1, -12.65, M.stone, id(0.21), { top: M.paving });
  B.box(46.2, 0.12, 0.5, -21, PROM_Y, -17.35, M.kerb, id(0.22));
  B.box(6, 0.3, 28.7, -13, PROM_Y - 0.3, -31.65, M.planks, id(0.23), { top: M.planks });
  for (let z = -19; z > -46; z -= 3) for (const x of [-15.6, -10.4]) B.add(cylG(0.18, 0.2, PROM_Y - WATER_Y + 1.2, x, WATER_Y - 1, z, 8), M.woodDark, id(0.24));

  // ---- railings: iron posts with ball tops and two tube rails (promenade, pier) ---------
  const rail = (x0, z0, x1, z1, y = PROM_Y) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.5)), rid = id(0.31);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      B.add(cylG(0.035, 0.04, 1.0, x, y, z, 8), M.iron, rid);
      B.add(sphG(0.055, x, y + 1.06, z, 1, 1, 1, 8), M.iron, rid);
    }
    for (const h of [0.5, 0.94]) {
      const g = new THREE.CylinderGeometry(0.025, 0.025, L, 6);
      g.rotateZ(Math.PI / 2); g.rotateY(-Math.atan2(z1 - z0, x1 - x0)); g.translate((x0 + x1) / 2, y + h, (z0 + z1) / 2);
      B.add(g, M.iron, rid + 0.01);
    }
  };
  rail(-44, -17.2, -16, -17.2); rail(-10, -17.2, 1.5, -17.2);
  rail(-15.85, -17.3, -15.85, -45.85); rail(-10.15, -17.3, -10.15, -45.85); rail(-15.85, -45.85, -10.15, -45.85);
  solid(-44, -16, -17.6, -17.0); solid(-10, 2, -17.6, -17.0);
  solid(-16.4, -15.6, -46.4, -17.3); solid(-10.4, -9.6, -46.4, -17.3); solid(-16.4, -9.6, -46.4, -45.6);
  // ---- balustrades on the drops: the overlook's edge and the campus's water edge -----------
  const balustrade = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.42)), bid = id(0.35), ry = -Math.atan2(z1 - z0, x1 - x0);
    const piece = (w, h, d, x, y, z, mat) => B.add(boxG(w, h, d, 0, y, 0).rotateY(ry).translate(x, 0, z), mat, bid);
    piece(L, 0.16, 0.42, (x0 + x1) / 2, 0, (z0 + z1) / 2, M.kerb);
    piece(L + 0.1, 0.12, 0.48, (x0 + x1) / 2, 0.96, (z0 + z1) / 2, M.trim);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (i % 6 === 0) piece(0.32, 0.8, 0.36, x, 0.16, z, M.trim);
      else { B.add(cylG(0.05, 0.07, 0.8, x, 0.16, z, 8), M.trim, bid); B.add(sphG(0.075, x, 0.5, z, 1, 1.3, 1, 8), M.trim, bid); }
    }
  };
  balustrade(-9, -7.8, 2.3, -7.8);
  balustrade(2.3, -7.8, 2.3, -66);
  solid(-9.2, 2.6, -8.3, -7.55); solid(1.6, 2.65, -66.5, -7.55);
  solid(46, 48, -66, 14); // the campus's east edge (a hedge line)
  hedge(B, M, 46.4, -66, 46.4, 14);

  // =====================================================================
  // THE OVERLOOK: the Bay Area map board, the signpost, benches, lamps, trees
  // =====================================================================
  const mapBoard = { x: -5.2, z: -7.2 };
  {
    const put = place(B, mapBoard.x, 0, mapBoard.z), bid = id(0.41);
    for (const sx of [-0.7, 0.7]) put(boxG(0.1, 1.0, 0.1, sx, 0, 0), M.iron, bid);
    const board = new THREE.BoxGeometry(1.8, 1.35, 0.08);
    board.rotateX(-0.55); board.translate(0, 1.15, 0.05);
    put(board, [M.iron, M.iron, M.iron, M.iron, ink({ map: BX.mapBoardTexture(), facing: 0.1, hatch: 0 }), M.iron], bid);
    solid(mapBoard.x - 1, mapBoard.x + 1, mapBoard.z - 0.4, mapBoard.z + 0.5);
  }
  const signpost = { x: -7.6, z: 4.6 };
  {
    const put = place(B, signpost.x, 0, signpost.z, 0.5), bid = id(0.43);
    put(boxG(0.14, 3.2, 0.14, 0, 0, 0), M.iron, bid);
    put(sphG(0.1, 0, 3.25, 0), M.iron, bid);
    const wf = ink({ map: BX.wayfindingTexture([['San Francisco', 'left'], ['Santa Clara University', 'right'], ['Airport', 'up']], { w: 768 }), facing: 0.1, hatch: 0 });
    const sg = new THREE.BoxGeometry(1.5, 0.75, 0.06); sg.translate(0.78, 2.35, 0);
    put(sg, [M.iron, M.iron, M.iron, M.iron, wf, wf], bid);
    solidC({ x: signpost.x, z: signpost.z, r: 0.25 });
  }
  const BENCHES = [[-1.4, -5.9], [3.6, -5.9]];
  for (const [x, z] of BENCHES) solidC(bench(B, M, x, 0, z, 0));
  for (const [x, z] of [[-8.3, -6.8], [1.3, -6.9], [8.6, 9]]) solidC(lamp(B, M, x, 0, z, { twin: true, h: 3.4 }));
  for (const [x, z, s] of [[-5.5, 12.5, 1.1], [7.5, 13, 0.95]]) solidC(oak(B, M, x, 0, z, { s, seed: x }));
  shrubs(B, M, -8.6, 7, -8.6, 13, 0, { seed: 61 });
  // the shared landscaping down the slope: palms, a cypress, an oak, flowering shrubs
  for (const [x, z, h] of [[-13, -4, 8.5], [-18.5, 5.5, 9.2], [-28.5, 2.5, 8.8]]) palm(B, M, x, nearestOnPath(x, z).y - 0.05, z, { h, seed: x * z });
  oak(B, M, -16, nearestOnPath(-16, -5).y, -5, { s: 0.9, seed: 7 });
  for (const [x0, z0, x1, z1] of [[-11, -1, -17, -1.6], [-20, 4.5, -24, 2.5], [-27.6, -2, -27.8, -6.5]]) shrubs(B, M, x0, z0, x1, z1, nearestOnPath((x0 + x1) / 2, (z0 + z1) / 2).y, { seed: x0 });

  // =====================================================================
  // THE WATERFRONT: wharf fronts, the pier arch, palms, lamps, benches, bollards
  // =====================================================================
  {
    // wharf fronts: two-storey, arched ground floor, a stepped parapet and a painted sign
    const front = (x0, x1, h, sign, seed) => {
      const w = x1 - x0, cx = (x0 + x1) / 2, z = -8.2, wid = farId((seed * 0.31) % 1);
      B.add(boxG(w, h, 6, cx, PROM_Y, z + 3), seed % 2 ? M.stucco : M.stucco2, wid);
      B.add(boxG(w + 0.2, 0.4, 6.2, cx, PROM_Y + h, z + 3), M.trim, wid);
      // a stepped parapet over the middle
      B.add(boxG(w * 0.5, 1.2, 0.4, cx, PROM_Y + h, z + 0.2), seed % 2 ? M.stucco : M.stucco2, wid);
      B.add(boxG(w * 0.26, 0.8, 0.4, cx, PROM_Y + h + 1.2, z + 0.2), seed % 2 ? M.stucco : M.stucco2, wid);
      const sm = ink({ map: BX.wharfSignTexture(sign, seed), facing: 0.1, hatch: 0 });
      const g2 = new THREE.PlaneGeometry(Math.min(w - 1.5, 6.5), 1.3); g2.rotateY(Math.PI); g2.translate(cx, PROM_Y + h - 0.85, z - 0.03);
      B.add(g2, sm, wid + 0.01);
      // arched openings below, windows above
      const n = Math.max(2, Math.round(w / 3));
      for (let i = 0; i < n; i++) {
        const x = x0 + ((i + 0.5) * w) / n;
        const s = new THREE.Shape(); const r = 0.9; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, 2.0); s.absarc(0, 2.0, r, 0, Math.PI, false); s.lineTo(-r, 0);
        const ag = new THREE.ShapeGeometry(s, 10); ag.rotateY(Math.PI); ag.translate(x, PROM_Y, z - 0.02); B.add(ag, M.dark, wid + 0.02);
        const fr = new THREE.TorusGeometry(r + 0.1, 0.09, 4, 16, Math.PI); fr.translate(x, PROM_Y + 2.0, z - 0.05); B.add(fr, M.trim, wid + 0.03);
        const wg = new THREE.PlaneGeometry(1.0, 1.3); wg.rotateY(Math.PI); wg.translate(x, PROM_Y + 4.0, z - 0.02); B.add(wg, M.glass, wid + 0.02);
        B.add(boxG(1.3, 0.12, 0.2, x, PROM_Y + 3.88, z - 0.1), M.trim, wid + 0.03);
      }
      // an awning over the first opening
      const aw = new THREE.BoxGeometry(2.4, 0.06, 1.2); aw.rotateX(-0.35); aw.translate(x0 + w / n / 2, PROM_Y + 3.1, z - 0.6); B.add(aw, M.canvas, wid + 0.04);
    };
    front(-44, -38.5, 6.4, "FISHERMAN'S WHARF", 3);
    front(-38.5, -33, 5.6, 'CRAB · CHOWDER', 4);
    front(-33, -28.2, 6.0, 'SOURDOUGH', 5);
    solid(-46, -28, -8.3, -1);
    blocker(-46, -28, PROM_Y, 6, -8.2, -2);
    // the pier arch with its sign
    {
      const aid = farId(0.47);
      for (const x of [-16.2, -9.8]) { B.add(boxG(0.6, 4.6, 0.6, x, PROM_Y, -17.6), M.stucco, aid); B.add(boxG(0.8, 0.3, 0.8, x, PROM_Y + 4.6, -17.6), M.trim, aid); }
      B.add(boxG(7.4, 0.9, 0.4, -13, PROM_Y + 4.0, -17.6), M.stucco, aid);
      const g = new THREE.PlaneGeometry(4.2, 0.8); g.translate(-13, PROM_Y + 4.45, -17.38);
      B.add(g, ink({ map: BX.wharfSignTexture('PIER 7', 7), facing: 0.1, hatch: 0 }), aid + 0.01);
      solid(-16.6, -15.7, -18, -17.2); solid(-10.3, -9.4, -18, -17.2);
    }
    // Embarcadero palms, lamps and benches along the promenade; bollards on the pier
    for (const x of [-40, -33, -24]) solidC(palm(B, M, x, PROM_Y, -9.6, { h: 9.5, seed: x }));
    for (const x of [-36.5, -27.5, -19, -6]) solidC(lamp(B, M, x, PROM_Y, -16.6, { h: 3.4 }));
    for (const x of [-30, -21.5, -3.5]) solidC(bench(B, M, x, PROM_Y, -15.6, 0));
    for (let z = -21; z > -45; z -= 4) for (const x of [-15.4, -10.6]) { B.add(cylG(0.14, 0.17, 0.55, x, PROM_Y, z, 10), M.iron, farId(0.49)); B.add(sphG(0.16, x, PROM_Y + 0.56, z, 1, 0.6, 1, 10), M.iron, farId(0.49)); }
    // the lookout at the pier's end: coin binoculars
    const lk = { x: -13, z: -44.9 };
    const put = place(B, lk.x, PROM_Y, lk.z, 0.45), lid = farId(0.51);
    put(cylG(0.12, 0.16, 0.08, 0, 0, 0, 14), M.iron, lid);
    put(cylG(0.05, 0.07, 1.0, 0, 0.08, 0, 10), M.iron, lid);
    put(boxG(0.32, 0.2, 0.22, 0, 1.06, 0), M.ironMid, lid);
    for (const sx of [-1, 1]) put(cylG(0.05, 0.06, 0.18, 0, 0, 0, 12).rotateX(Math.PI / 2).translate(sx * 0.08, 1.16, -0.15), M.iron, lid);
    solidC({ x: lk.x, z: lk.z, r: 0.25 });
  }

  // =====================================================================
  // CAMPUS, SAN FRANCISCO, THE BAY
  // =====================================================================
  const campus = buildCampus(root, M);
  colliders.push(...campus.colliders);
  for (const b of campus.blockers) blocker(...b);
  const sf = buildSF(root, { WATER_Y, SHORE_Y, at, BRIDGE });
  const river = buildRiver(root, { WATER_Y, SHORE_Z: -1400, SHORE_Y, sky: sf.sky, shore: [], skyZ: -800 });
  updaters.push(river.update);
  for (const m of B.flush(root, { cast: true, receive: true })) void m;

  // ---- boats: sailboats moored by the pier and out on the bay, a ferry crossing ----------
  const boatMat = { hull: ink({ tone: 0.97, facing: 0.5, hatchFreq: 6 }), deck: ink({ tone: 0.7, facing: 0.4, hatch: 0 }), sail: ink({ tone: 0.99, facing: 0.5, hatchFreq: 6, side: THREE.DoubleSide }), mast: ink({ tone: 0.2, hatch: 0 }), stripe: ink({ tone: 0.35, hatch: 0 }) };
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
    const c1w = new THREE.Mesh(new THREE.BoxGeometry(L * 0.6, 0.9, W * 0.86), boatMat.deck); c1w.position.set(-2, 2.9, 0); g.add(c1w);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, 2, W * 0.66), boatMat.hull); c2.position.set(-3, 4.9, 0); g.add(c2);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 2.4, 10), boatMat.stripe); st.position.set(-5, 7, 0); g.add(st);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noBlock = true; } });
    root.add(g);
    return g;
  }
  const moored = [[-21, -25, 0.95], [-21, -36, 0.85], [-5, -28, 0.9], [-5.5, -40, 1.0]].map(([x, z, s], i) => ({ g: sailboat(s, true), x, z, ph: i * 1.7 }));
  const sailing = [[-120, -170, 1.2, 0.55], [60, -260, 1.4, -0.4], [-260, -330, 1.6, 0.35]].map(([x, z, s, v], i) => ({ g: sailboat(s), x, z, v, ph: i * 2.1 }));
  const ferryBoat = { g: ferry(), z: -140, v: 3.6, x0: -60 };
  updaters.push((t) => {
    for (const b of moored) { b.g.position.set(b.x, WATER_Y + 0.25 + Math.sin(t * 0.9 + b.ph) * 0.05, b.z); b.g.rotation.set(Math.sin(t * 0.7 + b.ph) * 0.02, Math.PI / 2, Math.sin(t * 0.8 + b.ph) * 0.03); }
    for (const b of sailing) {
      const x = ((b.x + t * b.v + 400) % 800 + 800) % 800 - 400;
      b.g.position.set(x, WATER_Y + 0.25 + Math.sin(t * 0.8 + b.ph) * 0.06, b.z);
      b.g.rotation.set(0, b.v > 0 ? 0 : Math.PI, 0.1 * Math.sign(b.v) + Math.sin(t * 0.6 + b.ph) * 0.02);
    }
    const fx = ((ferryBoat.x0 + 500 + t * ferryBoat.v) % 1000 + 1000) % 1000 - 500;
    ferryBoat.g.position.set(fx, WATER_Y + 0.15 + Math.sin(t * 0.7) * 0.05, ferryBoat.z);
  });
  // gulls: little ink Vs gliding over the water
  const birdMat = ink({ tone: 0.15, hatch: 0, side: THREE.DoubleSide });
  const birds = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const wings = [-1, 1].map((sx) => { const w = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.32), birdMat); m.position.x = sx * 0.5; w.add(m); g.add(w); return w; });
    g.traverse((o) => { if (o.isMesh) o.userData.noBlock = true; });
    root.add(g);
    birds.push({ g, wings, ph: i * 1.3, y: 14 + i * 3, z: -30 - i * 18, v: 3 + (i % 3), x0: i * 70 - 200, s: 1.3 + (i % 2) * 0.6 });
  }
  updaters.push((t) => {
    for (const b of birds) {
      b.g.position.set(((b.x0 + 200 + t * b.v) % 400) - 200, b.y + Math.sin(t * 0.4 + b.ph) * 2, b.z + Math.sin(t * 0.13 + b.ph) * 6);
      b.g.rotation.y = Math.PI / 2; b.g.scale.setScalar(b.s);
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
  const mapImg = BX.mapCardImage();
  let cardOpen = false, cardTimer = 0;
  const renderCard = () => {
    card.replaceChildren();
    const title = document.createElement('div'); title.className = 'title'; title.textContent = tr('The San Francisco Bay Area'); card.append(title);
    const img = document.createElement('img'); img.src = mapImg; img.alt = tr('A map of the bay: San Francisco at the Golden Gate in the north, Santa Clara at the south end of the bay.'); card.append(img);
    const p = document.createElement('p'); p.textContent = tr('San Francisco and Santa Clara: two ends of one bay, about 45 miles (70 km) apart.'); card.append(p);
    const more = document.createElement('div'); more.className = 'more';
    const [a, b] = tr('press {key} to close').split('{key}'); const k = document.createElement('kbd'); k.textContent = 'E';
    more.append(a ?? '', k, b ?? ''); card.append(more);
  };
  const openCard = () => { renderCard(); card.classList.remove('hidden'); cardOpen = true; cardTimer = 14; };
  const closeCard = () => { card.classList.add('hidden'); cardOpen = false; };
  const offLang = onLang(() => { if (cardOpen) renderCard(); });

  const spot = (id2, label, x, z, radius, prompt, act, o = {}) => interactables.push({ id: id2, label, kind: 'action', x, z, radius, pos: new THREE.Vector3(...prompt), act, ...o });
  spot('scusign', 'Read the sign', campus.entry.sign.x, campus.entry.sign.z, 1.6, campus.entry.sign.prompt, (c) => {
    c.caption('Santa Clara University, founded in 1851 beside Mission Santa Clara de Asís, the eighth of California\'s 21 missions.', 6);
    c.sound('chime');
  });
  spot('map', 'Read the Bay Area map', mapBoard.x, mapBoard.z + 1.1, 1.2, [mapBoard.x, 1.9, mapBoard.z], (c) => { openCard(); c.complete('map'); c.sound('chime'); });
  const bridgeMid = at((BRIDGE.south.az + BRIDGE.north.az) / 2, (BRIDGE.south.d + BRIDGE.north.d) / 2);
  spot('lookout', 'Look at the Golden Gate', -13, -44.2, 1.0, [-13, PROM_Y + 1.6, -44.9], (c) => {
    c.face(bridgeMid[0], bridgeMid[1]);
    const yaw = Math.atan2(-(bridgeMid[0] - c.player.pos.x), -(bridgeMid[1] - c.player.pos.z));
    c.pan({ yaw, pitch: 0.03, dist: 3.6, rate: 1.0, lock: 2.6, lookUp: 0.9 });
    c.caption('The Golden Gate Bridge, opened in 1937, spans the strait where the bay meets the Pacific.', 5.5);
    c.complete('pier');
    c.sound('chime');
  }, { noReach: true });
  spot('home', 'Back to the airport', signpost.x + 0.4, signpost.z - 0.6, 1.0, [signpost.x, 3.4, signpost.z], (c) => c.travel('lobby'));
  // benches: sit and look at the bay
  const benchCaption = 'The fog rolls in over the bridge. Nobody is in a hurry here.';
  [...BENCHES.map(([x, z]) => [x, z, 0]), [-21.5, -15.6, PROM_Y], [-3.5, -15.6, PROM_Y]].forEach(([x, z, y], i) => {
    interactables.push({
      id: `bench${i}`, label: 'Sit on the bench', kind: 'seat', x, z: z + 0.6, radius: 0.8, pos: new THREE.Vector3(x, y + 0.95, z),
      seat: { seat: [x, y + 0.28, z], exit: [x, z + 0.75], via: [], pose: 'sit', facing: Math.PI, caption: benchCaption, cam: { yaw: 0.1, pitch: 0.12, dist: 3.2 } },
    });
  });
  // the church: arriving on the forecourt
  const churchCaption = 'Mission Santa Clara de Asís, the heart of the campus.';
  let atChurch = false;

  // ---- per frame ----------------------------------------------------------------------
  function update(t, dt, c) {
    for (const u of updaters) u(t, dt, c);
    const p = c.player.pos;
    const near = p.x > AX - 8 && p.x < AX + 8 && p.z < CAMPUS.forecourt[0] + 1 && p.z > -51;
    if (near && !atChurch) { c.caption(churchCaption, 4); c.complete('church'); }
    atChurch = near;
    if (cardOpen) { cardTimer -= dt; if (cardTimer <= 0 || Math.hypot(p.x - mapBoard.x, p.z - mapBoard.z - 1.1) > 3) closeCard(); }
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
    strings: ['The San Francisco Bay Area', 'A map of the bay: San Francisco at the Golden Gate in the north, Santa Clara at the south end of the bay.', 'San Francisco and Santa Clara: two ends of one bay, about 45 miles (70 km) apart.', churchCaption, 'press {key} to close'],
    walkable: REGIONS.map((r) => ({ id: r.id, x: r.x, z: r.z })),
    debug: () => ({
      boats: sailing.map((b) => +b.g.position.x.toFixed(1)),
      ferry: +ferryBoat.g.position.x.toFixed(1),
      waterTime: +river.mat.uniforms.uTime.value.toFixed(2),
      card: cardOpen,
    }),
    dispose() { offLang(); card.remove(); },
  };
}
