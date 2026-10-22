import * as THREE from 'three';
import { ink } from '../../ink.js';
import { makeRng } from '../../sketch.js';
import * as BX from '../../bayTextures.js';
import { cityTexture } from '../../shanghaiTextures.js';
import { Batch, boldId, farId, placer } from '../kit.js';
import { buildBridge } from './bridge.js';

// Everything beyond the street, compressed into a postcard of the bay:
//  - our side: the city climbing the hills behind the street's buildings
//    (Telegraph Hill with Coit Tower), the shore running on past the street's
//    bend to a headland (the Presidio) that carries the Golden Gate Bridge's
//    south end
//  - the bridge itself (bridge.js), seen at an angle: the south tower nearer,
//    the span running away to the right, so the towers' portals show
//  - across the water: the Marin Headlands at the bridge's north end, and to
//    their right the downtown skyline (Salesforce Tower, the Transamerica
//    Pyramid) on its own shore; the open strait under the bridge; ridges all round
//  - Alcatraz in the bay, in front of Marin
// Positions are given as azimuth (degrees from -z, + to the right) and distance
// from the spawn at the origin, or in street coordinates (s along the street,
// u across it, + toward the water). Returns the silhouettes the bay reflects.

const far = (o) => ink({ facing: 0.5, hatchFreq: 0.5, tone: 1, ...o });

const polar = (az, d) => { const a = THREE.MathUtils.degToRad(az); return [Math.sin(a) * d, -Math.cos(a) * d]; };
// the south tower, the deck's heading (degrees, turned from +x toward -z), the main and side spans
const BRIDGE = { south: polar(9, 520), heading: 38, span: 360, side: 100 };
const bridgeAt = (x) => { const a = THREE.MathUtils.degToRad(BRIDGE.heading); return [BRIDGE.south[0] + Math.cos(a) * x, BRIDGE.south[1] - Math.sin(a) * x]; };
export const BRIDGE_MID = bridgeAt(BRIDGE.span / 2); // where the lookout and the benches turn to
const gauss = (x, y, x0, y0, sx, sy) => Math.exp(-(((x - x0) / sx) ** 2) - (((y - y0) / sy) ** 2));

export function buildSF(root, { WATER_Y, SHORE_Y, street }) {
  const B = new Batch();
  const r = makeRng(1937);
  const sky = [];
  const M = {
    // the bridge: darker than everything near it; shaded faces take a sparse hatch
    tower: far({ tone: 0.5, facing: 0.55, hatch: 0.7, hatchFreq: 0.4 }),
    strut: far({ tone: 0.44, facing: 0.5, hatch: 0.7, hatchFreq: 0.4 }),
    rib: far({ tone: 0.32, facing: 0.4, hatch: 0 }),
    towerEdge: far({ tone: 0.36, facing: 0.5, hatch: 0 }),
    cable: far({ tone: 0.3, hatch: 0 }),
    deck: far({ tone: 0.5, facing: 0.5, hatch: 0.6, hatchFreq: 0.4 }),
    truss: far({ map: BX.trussTexture(), mapAmt: 0.75, tone: 0.6, facing: 0.4, hatch: 0 }),
    pier: far({ tone: 0.82, facing: 0.5, hatchFreq: 0.6 }),
    land: far({ tone: 0.95, facing: 0.6, hatchFreq: 0.5 }),
    shore: far({ tone: 0.84, facing: 0.4, hatch: 0 }),
    roof: far({ tone: 0.86, facing: 0.4 }),
    house: far({ tone: 0.97, facing: 0.5, hatchFreq: 0.6 }),
    houseRoof: far({ tone: 0.7, facing: 0.4, hatch: 0 }),
    city: ['curtain', 'punched', 'ribbon', 'grid', 'fins', 'resi'].map((k, i) => far({ map: cityTexture(k, 951 + i * 2), mapAmt: 0.5, tone: 0.99, facing: 0.5, hatchFreq: 0.5 })),
    sales: far({ map: cityTexture('curtain', 971), mapAmt: 0.55, tone: 0.99, facing: 0.65, hatchFreq: 0.5 }),
    salesTop: far({ map: cityTexture('fins', 973), mapAmt: 0.6, tone: 0.9, facing: 0.6, hatch: 0 }),
    trans: far({ map: cityTexture('punched', 975), mapAmt: 0.45, tone: 1, facing: 0.7, hatchFreq: 0.5 }),
    stone: far({ tone: 0.97, facing: 0.6, hatchFreq: 0.5 }),
    trim: far({ tone: 0.82, facing: 0.5, hatch: 0 }),
    tree: far({ tone: 0.93, facing: 0.6, hatchFreq: 0.6 }),
  };

  // =====================================================================
  // THE LAND: one heightfield on a polar grid round the spawn
  // =====================================================================
  // our side, in street coordinates: flat (hidden) under the street, then the
  // hills behind the buildings; the headland bulges out toward the strait
  const BACK = 12; // the land starts rising this far behind the facades' line (u = -9): behind the buildings
  const [SA, SB] = street.built;
  // the headland reaches out under the bridge's south approach and stops short of the tower
  const [hs, hu] = street.toStreet(...bridgeAt(-BRIDGE.side / 2)), [, tu] = street.toStreet(...bridgeAt(0));
  const HEAD = { s: hs + 8, u: (hu + tu) / 2 };
  const headU = (s) => 7.8 + (HEAD.u - 7.8) * Math.exp(-(((s - HEAD.s) / 85) ** 2));
  const ourH = (s, u) => {
    if (u > headU(s)) return -Infinity;
    const dd = -9 - BACK - u;                                     // distance behind the street's buildings
    if (dd < 0) {
      if (s >= SA && s <= SB) return u > -9.5 ? -0.4 : 1.6;     // under the street (hidden), level ground under the buildings
      if (u <= 7.8) return 1.6;
      // the headland: a plateau with a bluff at the bridge's end (the Presidio)
      return 1.6 + Math.min(1, (headU(s) - u) / 30) * (20 + 8 * Math.sin(s * 0.03 + u * 0.02)) + 28 * gauss(s, u, HEAD.s - 20, HEAD.u * 0.45, 70, 60);
    }
    return 2 + Math.min(1, dd / 30) * 6 + Math.min(dd * 0.08, 30)
      + 48 * gauss(s, dd, 72, 115, 40, 50)                        // Telegraph Hill
      + 60 * gauss(s, dd, 190, 230, 80, 90)                       // Russian Hill
      + 52 * gauss(s, dd, -40, 240, 90, 90)                       // Nob Hill
      + 140 * gauss(s, dd, 300, 900, 260, 300)                    // Twin Peaks, far behind
      + 40 * gauss(s, dd, HEAD.s - 20, -120, 110, 120);           // the headland's bluff (the Presidio)
  };
  // across the water, by azimuth: the open strait under the bridge, Marin (az 20..35)
  // coming round to just past the north tower, the city's shore (35..68), the East Bay
  const [nx, nz] = bridgeAt(BRIDGE.span), N_AZ = THREE.MathUtils.radToDeg(Math.atan2(nx, -nz)), N_D = Math.hypot(nx, nz) + 26;
  const farShore = (az) => {
    if (az < 20 || az > 230) return Infinity;
    if (az < N_AZ) return N_D + 200 * ((N_AZ - az) / (N_AZ - 20)) ** 2;
    if (az < 35) return N_D + 6 * (az - N_AZ);
    if (az < 68) return 640 + 20 * Math.sin(az * 0.3);
    return 1400 + 500 * Math.sin((az - 68) * 0.03);
  };
  const farH = (az, d) => {
    const s0 = farShore(az);
    if (d < s0) return -Infinity;
    const k = d - s0;
    if (az < 35) return 3 + 150 * Math.min(1, k / 260) * (0.75 + 0.25 * Math.sin(az * 0.5)) + 70 * gauss(az, d, 27, 1500, 6, 300) + 30 * gauss(az, d, 31, N_D + 90, 3, 60);
    if (az < 68) return 3 + Math.min(1, k / 60) * 4 + 45 * gauss(az, d, 54, 1100, 8, 200) + 70 * gauss(az, d, 39, 1500, 10, 300);
    return 3 + 110 * Math.min(1, k / 400) * (0.7 + 0.3 * Math.sin(az * 0.09));
  };
  const landH = (x, z) => {
    const [s, u] = street.toStreet(x, z);
    const d = Math.hypot(x, z), az = THREE.MathUtils.radToDeg(Math.atan2(x, -z));
    return Math.max(ourH(s, u), farH(az, d));
  };
  {
    const NA = 360, ND = 76, D0 = 26, D1 = 3000, pos = [], idx = [], hs = [];
    for (let i = 0; i <= NA; i++) {
      const az = -180 + (360 * i) / NA;
      for (let j = 0; j <= ND; j++) {
        const t = j / ND, d = D0 + (D1 - D0) * t * t;
        const [x, z] = polar(az, d);
        const h = landH(x, z);
        hs.push(h);
        pos.push(x, h === -Infinity ? WATER_Y - 4 : WATER_Y + Math.max(-4, h), z);
      }
    }
    for (let i = 0; i < NA; i++) for (let j = 0; j < ND; j++) {
      const a = i * (ND + 1) + j, b = a + ND + 1;
      if (Math.max(hs[a], hs[b], hs[a + 1], hs[b + 1]) < 0) continue; // all under water
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    B.add(g, M.land, farId(0.18));
  }
  // a low sea wall along the far city's shore
  {
    const pts = [];
    for (let az = 36; az <= 67; az += 1) { const [x, z] = polar(az, farShore(az) + 2); pts.push(new THREE.Vector3(x, WATER_Y + 1.6, z)); }
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 1.2, 4, false), M.shore, farId(0.33));
  }
  // ridges on the horizon all round (not across the Golden Gate, which stays open to the ocean)
  {
    const band = (R, a0, a1, el, amp, seed) => {
      const rr = makeRng(seed), ph = [rr() * 6, rr() * 6, rr() * 6];
      const N = Math.ceil((a1 - a0) / 1.5), pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const az = a0 + ((a1 - a0) * i) / N, [x, z] = polar(az, R);
        const e = el + amp * (0.55 * Math.sin(az * 0.05 + ph[0]) + 0.3 * Math.sin(az * 0.13 + ph[1]) + 0.15 * Math.sin(az * 0.31 + ph[2]));
        pos.push(x, R * Math.tan(THREE.MathUtils.degToRad(e)), z, x, WATER_Y - 2, z);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      B.add(g, M.land, farId(rr()));
    };
    band(2900, 60, 330, 3.0, 1.4, 41);
  }

  // =====================================================================
  // OUR SIDE: rows of houses up the hills behind the street, a few trees
  // =====================================================================
  const placed = [];
  const free = (x, z, w, d) => !placed.some(([px, pz, pw, pd]) => Math.abs(px - x) < (pw + w) / 2 + 2 && Math.abs(pz - z) < (pd + d) / 2 + 2);
  const telegraph = street.at(72, -9 - BACK - 115);
  for (let i = 0; i < 6000 && placed.length < 420; i++) {
    // past both ends of the built street the houses fill the street's line too
    const s = -160 + r() * 560, ddMin = s < SA - 6 || s > SB + 6 ? -BACK - 15 : 6, dd = ddMin + r() * (s > 200 ? 520 : 380), u = -9 - BACK - dd;
    if (u > headU(s) - 40) continue;
    const [x, z] = street.at(s, u);
    if (Math.hypot(x - telegraph[0], z - telegraph[1]) < 22) continue; // the top of Telegraph Hill stays green
    if (!free(x, z, 8, 10)) continue;
    const y = WATER_Y + ourH(s, u) - 0.5, id = farId(r()), ry = street.heading(s);
    if (r() < 0.18) { const g = new THREE.SphereGeometry(3.5 + r() * 2, 7, 5); g.scale(1, 0.8, 1); g.translate(x, y + 4, z); B.add(g, M.tree, id); placed.push([x, z, 6, 6]); continue; }
    const h = 7 + r() * 6, w = 7 + r() * 3;
    B.box(w, h, 10, x, y, z, M.house, id, { ry });
    if (r() < 0.6) { const roof = new THREE.ConeGeometry(w * 0.75, 2.4, 4); roof.rotateY(Math.PI / 4 + ry); roof.scale(1, 1, 1.2); roof.translate(x, y + h + 1.2, z); B.add(roof, M.houseRoof, id); }
    else B.box(w + 0.6, 0.6, 10.6, x, y + h, z, M.trim, id, { ry });
    placed.push([x, z, w, 10]);
  }

  // =====================================================================
  // ACROSS THE WATER: the downtown skyline on its shore
  // =====================================================================
  const groundFar = (az, d) => WATER_Y + Math.max(1, farH(az, d));
  const keepClear = [[44, 830, 16], [54, 760, 14]]; // landmark footprints [az, d, radius]
  for (let i = 0; i < 4000 && placed.length < 600; i++) {
    const az = 36 + r() * 30, d = farShore(az) + 25 + r() * 320;
    const [x, z] = polar(az, d);
    if (keepClear.some(([a, dd, rad]) => { const [lx, lz] = polar(a, dd); return Math.hypot(x - lx, z - lz) < rad + 10; })) continue;
    const w = 12 + r() * 14, dep = 12 + r() * 12;
    if (!free(x, z, w, dep)) continue;
    const core = Math.exp(-(((az - 48) / 7) ** 2)) * Math.exp(-(((d - 820) / 120) ** 2));
    let h = 16 + r() * 20 + core * (25 + r() * 50);
    h = Math.round(h / 3.2) * 3.2;
    const y = groundFar(az, d) - 1, mat = M.city[Math.floor(r() * M.city.length)], id = farId(r()), ry = -THREE.MathUtils.degToRad(az) * 0.3;
    B.box(w, h, dep, x, y, z, mat, id, { top: M.roof, bay: 3.2, floor: 3.2, ry });
    if (h > 45 && r() < 0.5) B.box(w * 0.6, 6.4, dep * 0.6, x, y + h, z, mat, id, { top: M.roof, bay: 3.2, floor: 3.2, ry });
    else if (r() < 0.3) B.box(w * 0.4, 2.5, dep * 0.4, x, y + h, z, M.trim, farId(r()), { ry });
    placed.push([x, z, w, dep]);
    sky.push({ x, z, hw: Math.max(w, dep) / 2, top: y + h - SHORE_Y });
  }

  // =====================================================================
  // THE LANDMARKS (ids in the bold band: they keep their line at distance)
  // =====================================================================
  let k = 0;
  const bid = () => boldId(k++);
  const cyl = (rt, rb, h, y, seg = 16) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, y + h / 2, 0); return g; };
  const bx = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; };

  // ---- the Golden Gate Bridge (bridge.js) ---------------------------------------------------
  {
    const { span: S, side } = BRIDGE, [sx, sz] = BRIDGE.south;
    const put = placer(B, sx, WATER_Y, sz, THREE.MathUtils.degToRad(BRIDGE.heading));
    const gg = buildBridge(put, M, { S, side, bold: bid, fine: (r2) => farId(r2) });
    // what the bay reflects: the towers, the deck between them
    for (const x of [0, S]) { const [wx, wz] = bridgeAt(x); sky.push({ x: wx, z: wz, hw: 12, top: gg.top + WATER_Y - SHORE_Y }); }
    for (let x = -side + 20; x < S + side; x += 40) { const [wx, wz] = bridgeAt(x); sky.push({ x: wx, z: wz, hw: 8, top: gg.deck + WATER_Y - SHORE_Y }); }
  }
  // ---- Salesforce Tower: a rounded-square shaft tapering to a rounded top, its crown lighter
  {
    const [x, z] = polar(44, 830), y0 = groundFar(44, 830) - 1, H = 122;
    const put = placer(B, x, y0, z, 0.3);
    const NS = 48, NY = 24, pos = [], uv = [], idx = [];
    const rsq = (a) => { const c = Math.cos(a), s = Math.sin(a), p = 4; return 1 / Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), 1 / p); };
    for (let j = 0; j <= NY; j++) {
      const t = j / NY, y = t * H;
      const sc = 9 * (1 - 0.18 * t) * (t > 0.88 ? Math.sqrt(Math.max(0, 1 - ((t - 0.88) / 0.12) ** 2)) * 0.9 + 0.1 : 1);
      for (let i = 0; i <= NS; i++) { const a = (i / NS) * Math.PI * 2, rr = sc * rsq(a); pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); uv.push((i / NS) * 18, y / 3.2 / 4); }
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NS; i++) { const a = j * (NS + 1) + i, b = a + NS + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    // the body and its crown (the top tenth) take different materials
    const split = (NY - 3) * NS * 6;
    g.addGroup(0, split, 0); g.addGroup(split, idx.length - split, 1);
    put(g, [M.sales, M.salesTop], bid());
    sky.push({ x, z, hw: 9, top: y0 + H - SHORE_Y });
  }
  // ---- the Transamerica Pyramid: a slender four-sided pyramid, its two wings, the spire
  {
    const [x, z] = polar(54, 760), y0 = groundFar(54, 760) - 1, H = 96;
    const put = placer(B, x, y0, z, Math.PI / 4 + 0.3);
    const g = new THREE.ConeGeometry(11, H, 4, 1); g.translate(0, H / 2, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * (H / 12.8));
    put(g, M.trans, bid());
    for (const s of [-1, 1]) { const w = new THREE.BoxGeometry(2.4, H * 0.4, 4.2); w.translate(0, H * 0.48, s * 5.6); put(w, M.stone, bid()); }
    put(cyl(0.2, 1.2, 14, H - 4, 6), M.trim, bid());
    sky.push({ x, z, hw: 9, top: y0 + H + 8 - SHORE_Y });
  }
  // ---- Coit Tower on Telegraph Hill, behind the street: a fluted column with a ring of windows at the top
  {
    const [x, z] = telegraph, y0 = WATER_Y + ourH(72, -9 - BACK - 115) - 1;
    const put = placer(B, x, y0, z, 0);
    const g = new THREE.CylinderGeometry(3.4, 3.8, 24, 20); g.translate(0, 12, 0); put(g, M.stone, bid());
    put(cyl(4, 4, 1.1, 24, 20), M.trim, bid());
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; put(bx(0.9, 2.2, 0.5, 0, 20.6, 0).rotateY(a + Math.PI / 2).translate(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5), M.towerEdge, bid()); }
    put(cyl(4.6, 4.6, 3, -3, 20), M.trim, bid());
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const t = new THREE.SphereGeometry(3 + (i % 3), 7, 5); t.scale(1, 0.8, 1); t.translate(x + Math.cos(a) * 10, y0 + 2, z + Math.sin(a) * 10); B.add(t, M.tree, farId(0.71)); }
  }
  // ---- Alcatraz: an island with the cellhouse, the lighthouse and a water tower
  {
    const [x, z] = polar(31, 400);
    const put = placer(B, x, WATER_Y, z, 0.4);
    const id = farId(0.66);
    const isl = new THREE.SphereGeometry(30, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); isl.scale(1.6, 0.42, 0.75); isl.translate(0, -1, 0); put(isl, M.land, id);
    put(bx(36, 7, 12, 0, 9, 0), M.stone, farId(0.67));
    put(bx(36.6, 0.8, 12.6, 0, 16, 0), M.trim, farId(0.67));
    put(bx(8, 5, 8, -24, 6, 6), M.stone, farId(0.68));
    put(cyl(1, 1.5, 14, 11, 8), M.stone, bid());
    put(cyl(1.6, 1.6, 2.2, 25, 8), M.towerEdge, bid());
    put(cyl(0.2, 1.8, 1.4, 27.2, 8), M.trim, bid());
    for (const [lx, lz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) put(bx(0.4, 7, 0.4, 20 + lx, 10, -6 + lz), M.towerEdge, farId(0.69));
    put(cyl(2.4, 2.4, 3, 17, 10).translate(20, 0, -6), M.trim, farId(0.69));
    sky.push({ x, z, hw: 40, top: 16 + WATER_Y - SHORE_Y }, { x, z, hw: 3, top: 28 + WATER_Y - SHORE_Y });
  }

  B.flush(root);
  return { sky, bridgeMid: BRIDGE_MID };
}
