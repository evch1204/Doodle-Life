import * as THREE from 'three';
import { ink } from '../../ink.js';
import { makeRng } from '../../sketch.js';
import * as BX from '../../bayTextures.js';
import { cityTexture } from '../../shanghaiTextures.js';
import { clockFaceTexture } from '../../lobbyTextures.js';
import { Batch, boldId, farId, placer } from '../kit.js';

// San Francisco across the bay (about 0.4 of real size, distances compressed):
// the Golden Gate Bridge seen at an angle, receding into the strait; the city
// on its hills with Salesforce Tower, the Transamerica Pyramid, the Ferry
// Building and Coit Tower; Alcatraz in the bay; the Marin Headlands behind the
// bridge's north end; hills all round. Returns the silhouettes the bay reflects.
//
// Positions are given as azimuth (degrees from -z, + to the right) and
// distance from the overlook at the origin.

const far = (o) => ink({ facing: 0.5, hatchFreq: 0.5, tone: 1, ...o });

export function buildSF(root, { WATER_Y, SHORE_Y, at, BRIDGE }) {
  const B = new Batch();
  const r = makeRng(1937);
  const sky = [];
  const M = {
    tower: far({ tone: 0.5, facing: 0.5, hatch: 0 }),              // the bridge's towers: darker than everything near them
    towerEdge: far({ tone: 0.36, facing: 0.5, hatch: 0 }),
    cable: far({ tone: 0.3, hatch: 0 }),
    deck: far({ map: BX.trussTexture(), mapAmt: 0.6, tone: 0.62, facing: 0.4, hatch: 0 }),
    pier: far({ tone: 0.82, facing: 0.5, hatchFreq: 0.6 }),
    land: far({ tone: 0.95, facing: 0.6, hatchFreq: 0.5, side: THREE.DoubleSide }),
    landDark: far({ tone: 0.86, facing: 0.65, hatchFreq: 0.5, side: THREE.DoubleSide }),
    shore: far({ tone: 0.84, facing: 0.4, hatch: 0 }),
    roof: far({ tone: 0.86, facing: 0.4 }),
    house: far({ tone: 0.97, facing: 0.5, hatchFreq: 0.6 }),
    houseRoof: far({ tone: 0.7, facing: 0.4, hatch: 0 }),
    city: ['curtain', 'punched', 'ribbon', 'grid', 'fins', 'resi'].map((k, i) => far({ map: cityTexture(k, 951 + i * 2), mapAmt: 0.5, tone: 0.99, facing: 0.5, hatchFreq: 0.5 })),
    sales: far({ map: cityTexture('curtain', 971), mapAmt: 0.55, tone: 0.99, facing: 0.65, hatchFreq: 0.5 }),
    salesTop: far({ map: cityTexture('fins', 973), mapAmt: 0.6, tone: 0.9, facing: 0.6, hatch: 0 }),
    trans: far({ map: cityTexture('punched', 975), mapAmt: 0.45, tone: 1, facing: 0.7, hatchFreq: 0.5 }),
    stone: far({ tone: 0.97, facing: 0.6, hatchFreq: 0.5 }),
    clock: far({ map: clockFaceTexture(), facing: 0.1, hatch: 0 }),
    trim: far({ tone: 0.82, facing: 0.5, hatch: 0 }),
    tree: far({ tone: 0.93, facing: 0.6, hatchFreq: 0.6 }),
  };
  const polar = (az, d) => at(az, d);

  // =====================================================================
  // LAND: the city's peninsula, the Marin Headlands, ridges all round
  // =====================================================================
  // a terrain patch over a polar sector, from its shoreline outward, height h(az, d) above the water
  function terrain(az0, az1, shoreD, dMax, h, mat, id) {
    const NA = 72, ND = 26, pos = [], idx = [];
    for (let i = 0; i <= NA; i++) {
      const az = az0 + ((az1 - az0) * i) / NA, s0 = shoreD(az);
      for (let j = 0; j <= ND; j++) {
        const t = j / ND, d = s0 + (dMax - s0) * t * t;
        const [x, z] = polar(az, d);
        pos.push(x, WATER_Y + (j === 0 ? -0.5 : h(az, d)), z);
      }
    }
    for (let i = 0; i < NA; i++) for (let j = 0; j < ND; j++) { const a = i * (ND + 1) + j, b = a + ND + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    B.add(g, mat, id);
  }
  const gauss = (az, d, a0, d0, sa, sd) => Math.exp(-(((az - a0) / sa) ** 2) - (((d - d0) / sd) ** 2));
  // San Francisco: a shoreline at 700-760 m, the city on low ground, hills behind (Twin Peaks)
  const sfShore = (az) => az < -14 ? 700 + Math.max(0, -14 - az) * 13 : 700 + Math.max(0, az + 10) * 4 + Math.max(0, az - 8) * 20;
  const sfH = (az, d) => {
    const base = 3 + Math.min(1, (d - sfShore(az)) / 60) * 3;
    return base + 32 * gauss(az, d, -7, 980, 2.2, 90)            // Telegraph Hill
      + 26 * gauss(az, d, -18, 900, 4, 160)                       // Russian / Pacific Heights
      + 90 * gauss(az, d, -6, 1900, 7, 300)                       // Twin Peaks
      + 40 * gauss(az, d, -24, 1300, 5, 300)                      // the Presidio's rise
      + 55 * gauss(az, d, 12, 2000, 8, 400);
  };
  terrain(-30, 22, sfShore, 2700, sfH, M.land, farId(0.18));
  // the Marin Headlands: steep green bluffs north of the bridge
  const marinShore = (az) => 1280 + Math.max(0, az + 52) * 22;
  const marinH = (az, d) => 4 + 105 * Math.min(1, (d - marinShore(az)) / 260) * (0.75 + 0.25 * Math.sin(az * 0.35)) + 60 * gauss(az, d, -70, 2000, 12, 400);
  terrain(-100, -45, marinShore, 2700, marinH, M.landDark, farId(0.29));
  // a low sea wall along the city's shore
  {
    const pts = [];
    for (let az = -14; az <= 16; az += 1) { const [x, z] = polar(az, sfShore(az) + 2); pts.push(new THREE.Vector3(x, WATER_Y + 1.6, z)); }
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 1.2, 4, false), M.shore, farId(0.33));
  }
  // ridges all round the rest of the horizon (the East Bay, the South Bay, behind the campus)
  {
    const band = (R, a0, a1, el, amp, seed, mat) => {
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
      B.add(g, mat, farId(rr()));
    };
    // (not across the Golden Gate, az -45..-30: the strait stays open to the ocean)
    band(2300, 16, 300, 3.2, 1.6, 41, M.landDark);
    band(1500, 30, 290, 1.8, 1.1, 43, M.land);
  }

  // =====================================================================
  // THE CITY on its hills: downtown towers by the Ferry Building, rows of
  // houses up the hills to the west
  // =====================================================================
  const placed = [];
  const free = (x, z, w, d) => !placed.some(([px, pz, pw, pd]) => Math.abs(px - x) < (pw + w) / 2 + 3 && Math.abs(pz - z) < (pd + d) / 2 + 3);
  const groundAt = (az, d) => WATER_Y + sfH(az, d);
  const keepClear = [[1, 905, 16], [-4, 865, 14], [4.5, 750, 40], [-7, 980, 14]]; // landmark footprints [az, d, radius]
  for (let i = 0; i < 4000 && placed.length < 150; i++) {
    const az = -13 + r() * 25, d = 770 + r() * 330;
    if (d < sfShore(az) + 25) continue;
    const [x, z] = polar(az, d);
    if (keepClear.some(([a, dd, rad]) => Math.hypot(...[x - polar(a, dd)[0], z - polar(a, dd)[1]]) < rad + 10)) continue;
    const w = 12 + r() * 14, dep = 12 + r() * 12;
    if (!free(x, z, w, dep)) continue;
    const core = Math.exp(-(((az - 0) / 6) ** 2)) * Math.exp(-(((d - 900) / 120) ** 2));
    let h = 18 + r() * 22 + core * (20 + r() * 45);
    if (Math.abs(az + 7) < 2.5) h = Math.min(h, 24);             // keep Coit Tower's hill clear
    h = Math.round(h / 3.2) * 3.2;
    const y = groundAt(az, d) - 1, mat = M.city[Math.floor(r() * M.city.length)], id = farId(r());
    B.box(w, h, dep, x, y, z, mat, id, { top: M.roof, bay: 3.2, floor: 3.2, ry: 0.15 });
    if (h > 45 && r() < 0.5) B.box(w * 0.6, 6.4, dep * 0.6, x, y + h, z, mat, id, { top: M.roof, bay: 3.2, floor: 3.2, ry: 0.15 });
    else if (r() < 0.3) B.box(w * 0.4, 2.5, dep * 0.4, x, y + h, z, M.trim, farId(r()), { ry: 0.15 });
    placed.push([x, z, w, dep]);
    sky.push({ x, z, hw: Math.max(w, dep) / 2, top: y + h - SHORE_Y });
  }
  // the hills west of downtown: rows of narrow houses, roofs, a few trees
  for (let i = 0; i < 2600; i++) {
    const az = -27 + r() * 16, d = sfShore(az) + 20 + r() * 520;
    const [x, z] = polar(az, d);
    if (!free(x, z, 7, 9)) continue;
    const y = groundAt(az, d) - 0.5, id = farId(r());
    if (r() < 0.2) { const g = new THREE.SphereGeometry(4 + r() * 2, 7, 5); g.scale(1, 0.8, 1); g.translate(x, y + 5, z); B.add(g, M.tree, id); continue; }
    const h = 7 + r() * 5;
    B.box(7, h, 9, x, y, z, M.house, id, { ry: 0.15 });
    const roof = new THREE.ConeGeometry(5.6, 2.6, 4); roof.rotateY(Math.PI / 4 + 0.15); roof.scale(1, 1, 1.25); roof.translate(x, y + h + 1.3, z);
    B.add(roof, M.houseRoof, id);
    placed.push([x, z, 7, 9]);
  }

  // =====================================================================
  // THE LANDMARKS (ids in the bold band: they keep their line at distance)
  // =====================================================================
  let k = 0;
  const bid = () => boldId(k++);
  const cyl = (rt, rb, h, y, seg = 16) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, y + h / 2, 0); return g; };
  const bx = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; };

  // ---- the Golden Gate Bridge -------------------------------------------------------------
  {
    const [p1x, p1z] = polar(BRIDGE.south.az, BRIDGE.south.d), [p2x, p2z] = polar(BRIDGE.north.az, BRIDGE.north.d);
    const S = Math.hypot(p2x - p1x, p2z - p1z), ux = (p2x - p1x) / S, uz = (p2z - p1z) / S;
    const put = placer(B, p1x, WATER_Y, p1z, Math.atan2(-uz, ux)); // local +x runs from the south tower to the north tower
    const TH = 110, DECK = 30, CW = 7.2;                              // tower height, deck top, cable half-spacing
    const idTower = bid(), idCable = bid(), idDeck = bid(), idHang = bid();
    // the towers: two legs stepping in at every portal strut, the struts between them
    const tower = (x0) => {
      const portals = [[DECK + 12, 4], [DECK + 34, 3.6], [DECK + 54, 3.2], [DECK + 70, 3], [TH - 3, 3]];
      let y = 0, lx = 6.4, lz = 5.2;
      put(bx(30, 9, 22, x0, -2, 0), M.pier, idDeck);                 // the pier in the water
      for (const [py, ph] of portals) {
        for (const s of [-1, 1]) put(bx(lx, py + ph - y, lz, x0, y, s * (CW + 0.6)), M.tower, idTower);
        put(bx(lx * 0.8, ph, 2 * CW, x0, py, 0), M.towerEdge, idTower); // the strut
        y = py + ph - 0.01; lx *= 0.88; lz *= 0.9;
      }
      for (const s of [-1, 1]) put(bx(lx + 0.6, 1.4, lz + 0.6, x0, TH, s * (CW + 0.6)), M.towerEdge, idTower); // saddles
    };
    tower(0); tower(S);
    // cables: a parabola over the main span, sagging chords down to the anchorages
    const sideL = 230, top = TH + 1.4, mid = DECK + 2.5, anch = DECK + 1;
    const cableY = (x) => {
      if (x >= 0 && x <= S) { const t = (x - S / 2) / (S / 2); return mid + (top - mid) * t * t; }
      const t = x < 0 ? -x / sideL : (x - S) / sideL;
      return top + (anch - top) * t - 9 * 4 * t * (1 - t);
    };
    for (const s of [-1, 1]) {
      const pts = [];
      for (let x = -sideL; x <= S + sideL + 0.1; x += 8) pts.push(new THREE.Vector3(x, cableY(x), s * CW));
      put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 1.1, 6, false), M.cable, idCable);
      // hangers: every 9 m, from the cable down to the deck
      for (let x = -sideL + 9; x < S + sideL; x += 9) {
        if (Math.abs(x) < 5 || Math.abs(x - S) < 5) continue;
        const yc = cableY(x);
        if (yc - DECK < 1.5) continue;
        put(bx(0.7, yc - DECK, 0.7, x, DECK, s * CW), M.cable, idHang);
      }
    }
    // the deck with its side truss, running onto the land at both ends; the anchorages
    const d0 = -sideL - 60, d1 = S + sideL + 60;
    { const g = new THREE.BoxGeometry(d1 - d0, 5, 2 * CW + 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ((d1 - d0) / 8)); g.translate((d0 + d1) / 2, DECK - 2.5, 0); put(g, M.deck, idDeck); }
    for (const x of [-sideL, S + sideL]) put(bx(26, DECK + 6, 30, x, -2, 0), M.pier, idDeck);
    for (const x of [-sideL / 2, S + sideL / 2]) put(bx(8, DECK - 3, 10, x, -2, 0), M.pier, idDeck);
    for (const [x, hw] of [[0, 9], [S, 9]]) { const wx = p1x + ux * x, wz = p1z + uz * x; sky.push({ x: wx, z: wz, hw, top: TH - SHORE_Y + WATER_Y }); }
    for (let x = 30; x < S; x += 60) sky.push({ x: p1x + ux * x, z: p1z + uz * x, hw: 6, top: DECK - SHORE_Y + WATER_Y });
  }

  // ---- Salesforce Tower: a rounded-square shaft tapering to a rounded top, its crown lighter
  {
    const [x, z] = polar(1, 905), y0 = groundAt(1, 905) - 1, H = 122;
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
    const [x, z] = polar(-4, 865), y0 = groundAt(-4, 865) - 1, H = 96;
    const put = placer(B, x, y0, z, Math.PI / 4 + 0.3);
    const g = new THREE.ConeGeometry(11, H, 4, 1); g.translate(0, H / 2, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * (H / 12.8));
    put(g, M.trans, bid());
    for (const s of [-1, 1]) { const w = new THREE.BoxGeometry(2.4, H * 0.4, 4.2); w.translate(0, H * 0.48, s * 5.6); put(w, M.stone, bid()); }
    put(cyl(0.2, 1.2, 14, H - 4, 6), M.trim, bid());
    sky.push({ x, z, hw: 9, top: y0 + H + 8 - SHORE_Y });
  }
  // ---- the Ferry Building: a long arcaded hall on the water, its clock tower
  {
    const [x, z] = polar(4.5, 742), y0 = WATER_Y + 3;
    const put = placer(B, x, y0, z, Math.atan2(-x, -z)); // its arcaded front toward the bay
    const id = bid();
    put(bx(70, 10, 16, 0, 0, 0), M.stone, id);
    put(bx(72, 1.2, 17, 0, 10, 0), M.trim, id);
    put(bx(70, 4, 14, 0, 11.2, 0), M.roof, id);
    for (let i = 0; i < 12; i++) put(bx(3.2, 5, 0.3, -30 + i * 5.45, 1.5, 8.1), M.towerEdge, id);
    // the tower: a shaft, a clock on each face, an arcaded belfry, a domed cap and a flagpole
    const t0 = 15;
    put(bx(9, 28, 9, 0, t0 - 4, 0), M.stone, id);
    for (let q = 0; q < 4; q++) { const c = new THREE.CylinderGeometry(2.6, 2.6, 0.5, 24); c.rotateX(Math.PI / 2); c.rotateY(Math.PI); c.translate(0, t0 + 16, 4.75); c.rotateY((q * Math.PI) / 2); put(c, [M.trim, M.clock, M.clock], id); }
    put(bx(10, 1.2, 10, 0, t0 + 24, 0), M.trim, id);
    put(bx(7.4, 6, 7.4, 0, t0 + 25.2, 0), M.towerEdge, id);
    put(bx(8, 1, 8, 0, t0 + 31.2, 0), M.trim, id);
    { const d = new THREE.SphereGeometry(3.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 1.4, 1); d.translate(0, t0 + 32.2, 0); put(d, M.stone, id); }
    put(cyl(0.15, 0.25, 7, t0 + 36.6, 5), M.towerEdge, id);
    sky.push({ x, z, hw: 35, top: 15 + y0 - SHORE_Y }, { x, z, hw: 5, top: t0 + 40 + y0 - SHORE_Y });
  }
  // ---- Coit Tower on Telegraph Hill: a fluted column with a ring of windows at the top
  {
    const [x, z] = polar(-7, 980), y0 = groundAt(-7, 980) - 1;
    const put = placer(B, x, y0, z, 0);
    const g = new THREE.CylinderGeometry(4, 4.4, 26, 20); g.translate(0, 13, 0); put(g, M.stone, bid());
    put(cyl(4.6, 4.6, 1.2, 26, 20), M.trim, bid());
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; put(bx(1, 2.4, 0.5, 0, 22.5, 0).rotateY(a + Math.PI / 2).translate(Math.cos(a) * 4.1, 0, Math.sin(a) * 4.1), M.towerEdge, bid()); }
    put(cyl(5, 5, 3, -3, 20), M.trim, bid());
    sky.push({ x, z, hw: 5, top: y0 + 27 - SHORE_Y });
  }
  // ---- Alcatraz: an island with the cellhouse, the lighthouse and a water tower
  {
    const [x, z] = polar(-9, 430);
    const put = placer(B, x, WATER_Y, z, 0.4);
    const id = farId(0.66);
    const isl = new THREE.SphereGeometry(30, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); isl.scale(1.6, 0.42, 0.75); isl.translate(0, -1, 0); put(isl, M.landDark, id);
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
  return { sky };
}
