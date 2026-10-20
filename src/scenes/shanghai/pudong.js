import * as THREE from 'three';
import { ink } from '../../ink.js';
import { makeRng } from '../../sketch.js';
import * as TX from '../../shanghaiTextures.js';
import * as TW from '../../taiwanTextures.js';
import { Batch, boldId, farId, placer } from '../kit.js';

// Pudong across the river: the embankment and riverside park, the four
// landmarks (Oriental Pearl Tower, Jin Mao, Shanghai World Financial Center,
// Shanghai Tower) modelled from their real structure, and the city around them
// built from a small library of tower types, facades and crowns in three
// levels of detail. Returns the silhouettes the river reflects.

const FL = 3.6, BAY = 3.2;
const far = (o) => ink({ facing: 0.5, hatchFreq: 0.6, tone: 1, ...o });

export function buildPudong(root, { SKY, at, SHORE_Z, SHORE_Y, WATER_Y }) {
  const cr = makeRng(777);
  const B = new Batch();
  const sky = [];   // skyline silhouettes {x, z, hw, top} (top above the shore)
  const shore = []; // the band right on the far bank (trees), for the waterline reflection
  const KINDS = ['punched', 'curtain', 'ribbon', 'fins', 'resi', 'grid'];
  const M = {
    shore: far({ map: TW.stoneBlockTexture(), tri: 1 / 3, mapAmt: 0.55, tone: 0.84 }),
    walk: far({ tone: 0.93, facing: 0, hatch: 0 }),
    rail: far({ tone: 0.3, hatch: 0 }),
    ground: far({ tone: 0.95, facing: 0, hatch: 0 }),
    tree: far({ tone: 0.95, facing: 0.6, hatchFreq: 0.8 }),
    trunk: far({ tone: 0.45, hatch: 0 }),
    roof: far({ tone: 0.86, facing: 0.4 }),
    equip: far({ tone: 0.62, facing: 0.5, hatchFreq: 0.8 }),
    mast: far({ tone: 0.35, hatch: 0 }),
    // city facades by distance band: near / mid carry the drawn modules, far is lighter and simpler
    near: KINDS.map((k, i) => far({ map: TX.cityTexture(k, 481 + i * 2), mapAmt: 0.62, tone: 0.98, facing: 0.5, hatchFreq: 0.9 })),
    mid: KINDS.map((k, i) => far({ map: TX.cityTexture(k, 501 + i * 2), mapAmt: 0.5, tone: 0.99, facing: 0.45, hatchFreq: 0.6 })),
    far: ['far', 'curtain', 'grid', 'far'].map((k, i) => far({ map: TX.cityTexture(k, 521 + i * 2), mapAmt: 0.36, tone: 1, facing: 0.35, hatchFreq: 0.4 })),
    // landmarks
    concrete: far({ tone: 0.96, facing: 0.65, hatchFreq: 0.7 }),
    pearl: far({ map: TX.pearlSphereTexture(), mapAmt: 0.7, tone: 0.97, facing: 0.7, hatchFreq: 0.8 }),
    pearlBand: far({ map: TX.cityTexture('ribbon', 541), repeat: [12, 0.5], mapAmt: 0.75, tone: 0.95, facing: 0.4, hatchFreq: 0.8 }),
    spiral: far({ map: TX.shTowerTexture(), mapAmt: 0.6, tone: 0.99, facing: 0.6, hatchFreq: 0.5 }),
    swfc: far({ map: TX.cityTexture('curtain', 543), repeat: [1 / 12.8, 1 / 14.4], mapAmt: 0.5, tone: 0.99, facing: 0.6, hatchFreq: 0.5 }),
    jinmao: far({ map: TX.jinmaoTexture(), repeat: [1 / 12, 1 / 16], mapAmt: 0.65, tone: 0.96, facing: 0.6, hatchFreq: 0.5 }),
    trim: far({ tone: 0.9, facing: 0.5, hatchFreq: 0.6 }),
    // thin ledges and rings: shaded but never hatched (a hatch line across a sliver reads as dots)
    ledge: far({ tone: 0.88, facing: 0.5, hatch: 0 }),
    globe: far({ map: TX.pearlSphereTexture(545), mapAmt: 0.55, tone: 0.97, facing: 0.65, hatchFreq: 0.8 }),
  };

  // ---- the far bank: embankment wall, riverside walk with its railing, the park ------
  {
    B.box(3200, SHORE_Y - WATER_Y + 1.2, 8, 0, WATER_Y - 1.2, SHORE_Z - 4, M.shore, 0.9);
    B.box(3200, 0.5, 6, 0, SHORE_Y - 0.5, SHORE_Z - 3.2, M.walk, 0.92);
    B.box(3200, 0.12, 0.12, 0, SHORE_Y + 1.0, SHORE_Z - 0.4, M.rail, 0.93);
    B.box(3200, 1, 1200, 0, SHORE_Y - 0.5, SHORE_Z - 8 - 600, M.ground, 0.91);
    for (let x = -900; x < 900; x += 6 + cr() * 5) {
      const z = SHORE_Z - 10 - cr() * 7, rr = 2.2 + cr() * 1.4, tid = farId(cr());
      for (const [dx, dy, dz, k] of [[0, 0.75, 0, 1], [rr * 0.6, 0.5, 0.4, 0.7], [-rr * 0.55, 0.55, -0.3, 0.72]]) {
        const g = new THREE.SphereGeometry(rr * k, 9, 6); g.scale(1, 0.85, 1);
        g.translate(x + dx, SHORE_Y + 2.4 + rr * dy, z + dz);
        B.add(g, M.tree, tid);
      }
      B.cyl(0.25, 0.35, 2.6, x, SHORE_Y, z, M.trunk, 0.4, { seg: 5 });
      shore.push({ x, hw: rr * 1.3, top: SHORE_Y + 2.4 + rr * 1.5 });
    }
  }

  // ---- the city kit -------------------------------------------------------------------
  // one tower: a body (slab / setback / round / octagon), an optional podium, a crown
  function tower(x, z, w, d, h, band, o = {}) {
    const id = farId(cr());
    const fac = o.mat ?? (band === 'far' ? M.far[Math.floor(cr() * M.far.length)] : M[band][Math.floor(cr() * KINDS.length)]);
    const uv = { bay: BAY, floor: FL };
    h = Math.max(FL * 3, Math.round(h / FL) * FL);
    let type = o.type ?? 'slab';
    if (!o.type) {
      const t = cr();
      if (h > 60 && t < 0.13) type = 'round';
      else if (h > 50 && t < 0.24) type = 'octa';
      else if (h > 45 && t < 0.48) type = 'setback';
    }
    let top = h, tw = w, td = d;
    if (band !== 'far' && h > 40 && cr() < 0.45) {
      // podium: a wide low base with ribbon windows
      const ph = FL * (2 + Math.floor(cr() * 3));
      B.box(w * 1.5, ph, d * 1.4, x, SHORE_Y, z, M[band][2], farId(cr()), { top: M.roof, ...uv });
    }
    if (type === 'round' || type === 'octa') {
      const seg = type === 'round' ? 22 : 8, rr = (w / 2) * (type === 'octa' ? 1.08 : 1);
      const circ = 2 * Math.PI * rr;
      B.cyl(rr, rr, h, x, SHORE_Y, z, fac, id, { seg, top: M.roof, u: Math.max(1, Math.round(circ / BAY)) / 4, v: h / FL / 4, ry: type === 'octa' ? Math.PI / 8 : 0 });
      if (type === 'round') { B.cyl(rr * 0.82, rr, FL * 2, x, SHORE_Y + h, z, fac, id, { seg, top: M.roof, u: Math.round((circ * 0.9) / BAY) / 4, v: 0.5 }); top += FL * 2; }
      tw = td = rr * 1.6;
    } else if (type === 'setback') {
      const h1 = Math.round((h * 0.62) / FL) * FL, h2 = Math.round((h * 0.24) / FL) * FL, h3 = h - h1 - h2;
      B.box(w, h1, d, x, SHORE_Y, z, fac, id, { top: M.roof, ...uv });
      B.box(w * 0.8, h2, d * 0.8, x, SHORE_Y + h1, z, fac, id, { top: M.roof, ...uv });
      B.box(w * 0.58, h3, d * 0.58, x, SHORE_Y + h1 + h2, z, fac, id, { top: M.roof, ...uv });
      tw = w * 0.58; td = d * 0.58;
    } else {
      B.box(w, h, d, x, SHORE_Y, z, fac, id, { top: M.roof, ry: o.ry ?? 0, ...uv });
    }
    // crown
    const yT = SHORE_Y + top, k = o.crown ?? cr();
    if (band === 'far' && k < 0.7) { /* plain flat top far away */ }
    else if (k < 0.32) {
      // rooftop plant: two boxes and a water tank
      B.box(tw * 0.45, 3.2, td * 0.4, x - tw * 0.12, yT, z + td * 0.1, M.equip, farId(cr()), { top: M.roof });
      B.box(tw * 0.25, 2.2, td * 0.25, x + tw * 0.25, yT, z - td * 0.15, M.equip, farId(cr()));
      B.cyl(1.4, 1.4, 2.6, x + tw * 0.2, yT, z + td * 0.25, M.equip, farId(cr()), { seg: 8 });
      top += 3.2;
    } else if (k < 0.48) {
      // a lantern storey and a mast
      B.box(tw * 0.55, FL * 2, td * 0.55, x, yT, z, fac, id, { top: M.roof, ...uv });
      B.cyl(0.25, 0.45, h * 0.14, x, yT + FL * 2, z, M.mast, farId(cr()), { seg: 5 });
      top += FL * 2 + h * 0.14;
    } else if (k < 0.55) {
      // a slender pyramid crown on a short drum
      const m = Math.min(tw, td);
      B.box(m * 0.62, FL, m * 0.62, x, yT, z, M.trim, id);
      const cone = new THREE.ConeGeometry(m * 0.44, m * 1.1, 4);
      cone.rotateY(Math.PI / 4); cone.translate(x, yT + FL + m * 0.55, z);
      B.add(cone, M.trim, farId(cr()));
      top += FL + m * 1.1;
    } else if (k < 0.76) {
      // an open crown frame (a lit-up band of fins at the top)
      const cid = farId(cr());
      for (const [fw, fd, fx, fz] of [[tw + 0.6, 0.5, 0, -td / 2], [tw + 0.6, 0.5, 0, td / 2], [0.5, td, -tw / 2, 0], [0.5, td, tw / 2, 0]]) B.box(fw, 4.5, fd, x + fx, yT, z + fz, M.trim, cid);
      top += 4.5;
    } else if (k < 0.86) {
      // a sloped top
      const s = new THREE.Shape(); s.moveTo(-tw / 2, 0); s.lineTo(tw / 2, 0); s.lineTo(tw / 2, tw * 0.22); s.lineTo(-tw / 2, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: td, bevelEnabled: false }); g.translate(x, yT, z - td / 2);
      B.add(g, [fac, fac], id);
      top += tw * 0.22;
    } else {
      // a helipad disc
      B.cyl(Math.min(tw, td) * 0.4, Math.min(tw, td) * 0.4, 0.6, x, yT, z, M.equip, farId(cr()), { seg: 16 });
    }
    sky.push({ x, z, hw: Math.max(tw, td) * 0.5 + 1, top: Math.min(top, h + 30) });
  }

  // ---- placement --------------------------------------------------------------------
  const marks = Object.values(SKY).map(({ az, d }) => at(az, d));
  const conv = at(-30, 215), ifc = at(1.5, 300);
  const clear = (x, z, pad) => marks.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 26 + pad) || Math.hypot(x - conv[0], z - conv[1]) < 40 + pad || Math.hypot(x - ifc[0], z - ifc[1]) < 26 + pad;
  const placed = [];
  const free = (x, z, w, d, gap) => !placed.some(([px, pz, pw, pd]) => Math.abs(px - x) < (pw + w) * 0.5 + gap && Math.abs(pz - z) < (pd + d) * 0.5 + gap);
  // the riverside row behind the park: mid-rise, the most detailed
  for (let x = -900; x < 900; x += 16 + cr() * 14) {
    const z = SHORE_Z - 34 - cr() * 22, w = 12 + cr() * 12, d = 12 + cr() * 10;
    if (clear(x, z, 0) || !free(x, z, w, d, 5)) continue;
    const az = THREE.MathUtils.radToDeg(Math.atan2(x, -z));
    const front = Object.values(SKY).some((L) => Math.abs(az - L.az) < L.hw + 3.5);
    const h = front ? 9 + cr() * 3 : 14 + cr() * 22;
    tower(x, z, w, d, h, 'near', { type: 'slab', crown: front ? 0.95 : undefined });
    placed.push([x, z, w, d]);
  }
  // the city: density and height rise toward Lujiazui. Heights are chosen as
  // viewing angles from the promenade, so the band stays under the landmarks.
  for (let i = 0; i < 5000 && placed.length < 380; i++) {
    const x = (cr() - 0.5) * 1800, z = SHORE_Z - 70 - cr() * 640;
    const az = THREE.MathUtils.radToDeg(Math.atan2(x, -z)), dist = Math.hypot(x, z);
    const core = Math.exp(-(((az - 4) / 24) ** 2)) * Math.exp(-(((dist - 430) / 190) ** 2));
    if (cr() > 0.3 + core * 0.9) continue;
    const w = 13 + cr() * 14, d = 13 + cr() * 14;
    if (clear(x, z, w * 0.5) || !free(x, z, w, d, 4 + dist * 0.008)) continue;
    let deg = 2.5 + cr() * 4 + core * (2 + cr() * 7.5);
    // nothing tall in front of a landmark: keep their feet and pearls in view
    const wdeg = THREE.MathUtils.radToDeg(w / dist) * 0.6;
    let front = false;
    for (const L of Object.values(SKY)) if (Math.abs(az - L.az) < L.hw + wdeg + 1 && dist < L.d + 40) { deg = Math.min(deg, L === SKY.pearl ? 2.2 : 5.0); front = true; }
    const h = Math.max(12, dist * Math.tan(THREE.MathUtils.degToRad(deg)));
    tower(x, z, w, d, h, dist < 300 ? 'near' : dist < 560 ? 'mid' : 'far', front ? { type: 'slab', crown: 0.95 } : { ry: cr() < 0.15 ? 0.3 : 0 });
    placed.push([x, z, w, d]);
  }
  // the far city on the horizon: low, light and simple, closing the gaps between towers
  for (let i = 0; i < 3000 && placed.length < 560; i++) {
    const x = (cr() - 0.5) * 2200, z = SHORE_Z - 720 - cr() * 380;
    const w = 18 + cr() * 22, d = 16 + cr() * 18;
    if (!free(x, z, w, d, 6)) continue;
    const dist = Math.hypot(x, z);
    tower(x, z, w, d, Math.max(14, dist * Math.tan(THREE.MathUtils.degToRad(1.2 + cr() * 2.6))), 'far', { type: cr() < 0.2 ? 'setback' : 'slab' });
    placed.push([x, z, w, d]);
  }
  // IFC: twin slabs with stepped crowns by the river, right of the Pearl, on a shared podium
  {
    B.box(48, 12, 24, ifc[0], SHORE_Y, ifc[1] + 6, M.near[2], farId(cr()), { top: M.roof, bay: BAY, floor: FL });
    for (const dx of [-11, 11]) {
      const [x, z] = [ifc[0] + dx, ifc[1] - Math.abs(dx) * 0.4];
      const id = farId(cr());
      B.box(15, 61.2, 15, x, SHORE_Y, z, M.near[1], id, { top: M.roof, bay: BAY, floor: FL });
      B.box(11, 7.2, 11, x, SHORE_Y + 61.2, z, M.near[1], id, { top: M.roof, bay: BAY, floor: FL });
      B.box(6, 6, 6, x, SHORE_Y + 68.4, z, M.trim, farId(cr()));
      sky.push({ x, z, hw: 8.5, top: 74 });
    }
  }
  // the convention center: a long low hall with two globes, by the river left of the Pearl
  {
    const [x, z] = conv;
    B.box(46, 14.4, 22, x, SHORE_Y, z, M.near[3], farId(cr()), { top: M.roof, bay: BAY, floor: FL });
    B.box(50, 1.6, 24, x, SHORE_Y + 14.4, z, M.trim, farId(cr()));
    for (const [dx, rr] of [[-12, 8.5], [12, 6]]) {
      const g = new THREE.SphereGeometry(rr, 32, 20);
      g.translate(x + dx, SHORE_Y + 16.6 + rr * 0.8, z);
      B.add(g, M.globe, farId(cr()));
      sky.push({ x: x + dx, z, hw: rr, top: 16.6 + rr * 1.8 });
    }
    sky.push({ x, z, hw: 25, top: 16 });
  }

  // =====================================================================
  // THE LANDMARKS (about 0.32 of real size; ids in the bold band)
  // =====================================================================
  let k = 0;
  const bid = () => boldId(k++);
  const cylG = (rt, rb, h, y, seg = 16) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, y + h / 2, 0); return g; };
  const sphG = (rr, y, seg = 32) => { const g = new THREE.SphereGeometry(rr, seg, Math.round(seg * 0.6)); g.translate(0, y, 0); return g; };
  const torG = (R, tube, y, seg = 48) => { const g = new THREE.TorusGeometry(R, tube, 6, seg); g.rotateX(Math.PI / 2); g.translate(0, y, 0); return g; };
  const off = (g, x, z) => { g.translate(x, 0, z); return g; };
  const rod = (a, b, r0, r1, seg = 14) => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
    const g = new THREE.CylinderGeometry(r1, r0, A.distanceTo(Bv), seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize()));
    const m = A.clone().add(Bv).multiplyScalar(0.5);
    g.translate(m.x, m.y, m.z);
    return g;
  };

  // ---- Oriental Pearl Tower: three columns from the ground to the upper sphere,
  // three inclined legs to the lower sphere, five small spheres between, the
  // upper sphere with its deck ring, the space module and the stepped mast.
  {
    const [x, z] = at(SKY.pearl.az, SKY.pearl.d);
    const put = placer(B, x, SHORE_Y, z, Math.atan2(-x, -z));
    const C = M.concrete, idCol = bid(), idLeg = bid(), idSph = bid(), idRim = bid(), idSmall = bid(), idMast = bid();
    put(cylG(10, 11, 1.6, 0, 40), M.trim, bid());
    put(cylG(7.4, 8.2, 3.6, 1.6, 40), M.near[2], bid());
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2, b = a + Math.PI / 3;
      put(off(cylG(1.45, 1.6, 92, 0, 18), Math.cos(a) * 3.7, Math.sin(a) * 3.7), C, idCol);
      put(rod([Math.cos(b) * 17.5, 0.8, Math.sin(b) * 17.5], [Math.cos(b) * 4.6, 23, Math.sin(b) * 4.6], 1.35, 1.1), C, idLeg);
      put(off(cylG(2.2, 2.9, 2.2, 0, 16), Math.cos(b) * 17.5, Math.sin(b) * 17.5), M.trim, idRim);
    }
    put(torG(4.6, 0.75, 22.5), C, idRim);
    // lower sphere, its observation band and rims
    put(sphG(9.6, 31, 48), M.pearl, idSph);
    put(cylG(9.72, 9.72, 2.0, 30.4, 48), M.pearlBand, idRim);
    put(torG(9.75, 0.32, 32.4), M.ledge, idRim);
    put(torG(9.75, 0.32, 30.4), M.ledge, idRim);
    // the five small spheres up the columns
    for (let i = 0; i < 5; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      put(off(sphG(2.35, 47 + i * 6.1, 20), Math.cos(a) * 3.7, Math.sin(a) * 3.7), M.pearl, idSmall);
    }
    // collars tying the columns between the spheres
    for (const y of [44, 75]) put(torG(3.7, 0.55, y, 30), M.trim, idRim);
    // upper sphere: the revolving deck ring and its window belt
    put(sphG(7.5, 85, 44), M.pearl, idSph);
    put(cylG(8.7, 8.7, 0.5, 86.6, 48), M.ledge, idRim);
    put(cylG(7.75, 7.75, 1.7, 84.9, 48), M.pearlBand, idRim);
    // the shaft to the space module, the module, the mast
    put(cylG(1.7, 2.1, 15, 92, 16), C, idCol);
    put(sphG(3.0, 109.5, 24), M.pearl, idSph);
    put(torG(3.1, 0.25, 109.5, 30), M.trim, idRim);
    put(cylG(1.0, 1.35, 6.5, 112, 12), C, idMast);
    put(cylG(0.16, 0.95, 34, 118.5, 10), C, idMast);
    for (const [y, rr] of [[122, 1.05], [128, 0.85], [134, 0.65], [140, 0.45]]) put(cylG(rr, rr, 0.7, y, 10), M.trim, idRim);
    for (const [hw, top] of [[4.5, 152], [9.6, 41], [7.5, 92.5], [11, 6]]) sky.push({ x, z, hw, top });
  }

  // ---- Shanghai Tower: a rounded-triangle plan with a V notch, tapering and
  // twisting 120 degrees up its height; nine zones split by refuge-floor belts;
  // the crown sloping toward the notch.
  {
    const [x, z] = at(SKY.tower.az, SKY.tower.d);
    const H = 210, R0 = 15, N = 90, MS = 132;
    const twist = (y) => (y / H) * 2.0;
    const scaleAt = (y) => 1 - 0.47 * Math.pow(y / H, 1.15);
    const topAt = (th) => H * (0.92 + 0.08 * (0.5 + 0.5 * Math.cos(th - Math.PI)));
    const radiusAt = (th) => {
      const dn = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
      return 1 + 0.11 * Math.cos(3 * th) - 0.17 * Math.max(0, 1 - dn / 0.085);
    };
    const pt = (th, y, dr = 0) => { const rr = R0 * scaleAt(y) * radiusAt(th) + dr, a = th + twist(y); return [Math.cos(a) * rr, y, Math.sin(a) * rr]; };
    const loft = (rows, closeTop) => {
      // rows: [[dr, yFn(th)], ...] -> a ring strip through them
      const pos = [], uv = [], idx = [];
      rows.forEach(([dr, yf], i) => {
        for (let j = 0; j <= MS; j++) {
          const th = (j / MS) * Math.PI * 2, y = yf(th);
          pos.push(...pt(th, y, dr));
          uv.push((j / MS) * 8, y / H);
        }
        if (i) for (let j = 0; j < MS; j++) { const a = (i - 1) * (MS + 1) + j, b2 = a + MS + 1; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
      });
      if (closeTop) {
        const c0 = pos.length / 3, last = (rows.length - 1) * (MS + 1);
        pos.push(0, H * 0.955, 0); uv.push(0, 1);
        for (let j = 0; j < MS; j++) idx.push(last + j, c0, last + j + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    // turned so the notch faces the Bund at mid-height and spirals away above and below
    const put = placer(B, x, SHORE_Y, z, -0.8);
    const bodyId = bid();
    put(loft(Array.from({ length: N + 1 }, (_, i) => [0, (th) => (i / N) * topAt(th)]), true), M.spiral, bodyId);
    // refuge-floor belts: a slim ledge that follows the twist and the notch
    for (let zn = 1; zn < 9; zn++) {
      const yb = H * 0.93 * (zn / 9);
      put(loft([[-0.05, () => yb - 0.45], [0.35, () => yb - 0.45], [0.35, () => yb + 0.45], [-0.05, () => yb + 0.45]]), M.ledge, bodyId);
    }
    put(cylG(R0 * 1.25, R0 * 1.32, 9, 0, 40), M.near[1], bid());
    for (const [hw, top] of [[14, 100], [11.5, 170], [9, 208]]) sky.push({ x, z, hw, top });
  }

  // ---- Shanghai World Financial Center: a square prism whose two opposite
  // faces sweep in to a blade at the top, with the trapezoid opening.
  {
    const [x, z] = at(SKY.swfc.az, SKY.swfc.d);
    const H = 160, W0 = 21, Wt = 12, D0 = 21;
    const side = (y) => W0 / 2 + (Wt / 2 - W0 / 2) * Math.pow(y / H, 0.85);
    const sh = new THREE.Shape();
    sh.moveTo(-W0 / 2, 0); sh.lineTo(W0 / 2, 0);
    for (let i = 1; i <= 24; i++) { const y = (i / 24) * H; sh.lineTo(side(y), y); }
    for (let i = 24; i >= 1; i--) { const y = (i / 24) * H; sh.lineTo(-side(y), y); }
    sh.lineTo(-W0 / 2, 0);
    const hole = new THREE.Path();
    const hy0 = H - 17, hy1 = H - 3.2;
    hole.moveTo(-3.2, hy0); hole.lineTo(3.2, hy0); hole.lineTo(side(hy1) - 1.4, hy1); hole.lineTo(-side(hy1) + 1.4, hy1); hole.lineTo(-3.2, hy0);
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: D0, bevelEnabled: false, curveSegments: 4, steps: 1 });
    geo.translate(0, 0, -D0 / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - 0.82 * Math.pow(p.getY(i) / H, 1.1)));
    // the side walls get UVs across their own width (depth) and up (height), like the faces
    const uvA = geo.attributes.uv, sides = geo.groups.find((g) => g.materialIndex === 1);
    for (let i = sides.start; i < sides.start + sides.count; i++) uvA.setXY(i, p.getZ(i), p.getY(i));
    geo.computeVertexNormals();
    const put = placer(B, x, SHORE_Y, z, Math.atan2(-x, -z) * 0.6);
    put(geo, [M.swfc, M.swfc], bid());
    // the opening's frame and a podium
    put(cylG(13, 14, 7.2, 0, 4).rotateY(Math.PI / 4), M.near[2], bid());
    for (const [hw, top] of [[10.5, 40], [8, 120], [6, 160]]) sky.push({ x, z, hw, top });
  }

  // ---- Jin Mao Tower: a notched-square shaft rising in tiers, each shorter and
  // set back with a ledge, then a stepped crown and a needle spire.
  {
    const [x, z] = at(SKY.jinmao.az, SKY.jinmao.d);
    const put = placer(B, x, SHORE_Y, z, Math.PI / 4 - 0.2);
    const plan = (s) => {
      const n = s * 0.2, P = [[-s + n, -s], [s - n, -s], [s - n, -s + n], [s, -s + n], [s, s - n], [s - n, s - n], [s - n, s], [-s + n, s], [-s + n, s - n], [-s, s - n], [-s, -s + n], [-s + n, -s + n]];
      const sh = new THREE.Shape(); sh.moveTo(...P[0]); for (const q of P.slice(1)) sh.lineTo(...q); sh.lineTo(...P[0]);
      return sh;
    };
    const tier = (s, h, y, mat, tid) => {
      const g = new THREE.ExtrudeGeometry(plan(s), { depth: h, bevelEnabled: false });
      g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
      put(g, [mat === M.ledge ? M.ledge : M.trim, mat], tid);
    };
    const idA = bid(), idB = idA;
    put(cylG(16, 17, 8, 0, 4).rotateY(Math.PI / 4), M.near[2], bid());
    let y = 8, s = 10.2, h = 15;
    for (let t = 0; t < 13; t++) {
      tier(s, h, y, M.jinmao, idA);
      tier(s * 1.05 + 0.25, 0.6, y + h, M.ledge, idB);
      y += h + 0.6;
      s *= t < 3 ? 0.975 : 0.945;
      h = Math.max(3.2, h * 0.86);
    }
    for (let t = 0; t < 4; t++) {
      tier(s, 2.8, y, M.jinmao, idA);
      tier(s * 1.12 + 0.25, 0.5, y + 2.8, M.ledge, idB);
      y += 3.3;
      s *= 0.8;
    }
    put(cylG(0.12, s * 0.8, 22, y, 8), M.concrete, bid());
    for (const [yy, rr] of [[y + 4, s * 0.75], [y + 9, s * 0.55], [y + 14, s * 0.35]]) put(cylG(rr, rr, 0.6, yy, 8), M.trim, idB);
    for (const [hw, top] of [[11, 60], [8, 105], [3, y + 22]]) sky.push({ x, z, hw, top });
  }

  B.flush(root);
  return { sky, shore };
}
