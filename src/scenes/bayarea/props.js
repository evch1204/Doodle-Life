import * as THREE from 'three';
import { ink } from '../../ink.js';
import * as TW from '../../taiwanTextures.js';
import * as TX from '../../shanghaiTextures.js';
import * as BX from '../../bayTextures.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { farId, placer } from '../kit.js';

// Shared pieces for the Bay Area waterfront: one set of materials, and the
// trees, lamps, benches, bins and café furniture along the street and the
// promenade. Every builder adds to a Batch (one draw call per material) at a
// placement matrix.

export function bayMaterials() {
  const stucco = BX.stuccoTexture();
  return {
    stucco: ink({ map: stucco, tri: 1 / 3, mapAmt: 0.5, tone: 0.98, facing: 0.45, hatchFreq: 9 }),
    stucco2: ink({ map: stucco, tri: 1 / 3, mapAmt: 0.5, tone: 0.92, facing: 0.45, hatchFreq: 9 }),
    trim: ink({ tone: 0.99, facing: 0.55, hatchFreq: 9 }),
    ledge: ink({ tone: 0.88, facing: 0.5, hatch: 0 }),
    reveal: ink({ tone: 0.7, facing: 0.5, hatchFreq: 9 }),
    dark: ink({ tone: 0.24, facing: 0.2, hatch: 0 }),
    glass: ink({ map: TX.sashTexture(925), mapAmt: 0.85, facing: 0.1, hatch: 0 }),
    paving: ink({ map: TX.tileTexture(927), tri: 1 / 2, facing: 0.2, mapAmt: 0.6, hatch: 0.6 }),
    path: ink({ map: TW.pavingTexture(), tri: 1 / 2.2, facing: 0.2, mapAmt: 0.65, hatch: 0.6 }),
    kerb: ink({ map: TX.kerbTexture(), tri: 1 / 2.4, facing: 0.5, mapAmt: 0.7, tone: 0.92 }),
    stone: ink({ map: TW.stoneBlockTexture(), tri: 1 / 1.6, mapAmt: 0.65, tone: 0.88, facing: 0.5 }),
    leaf: ink({ tone: 0.95, facing: 0.7, hatchFreq: 16 }),
    leafDark: ink({ tone: 0.8, facing: 0.7, hatchFreq: 16 }),
    frond: ink({ map: BX.frondTexture(), mapAmt: 0.85, tone: 0.97, facing: 0.5, hatchFreq: 16, side: THREE.DoubleSide }),
    trunk: ink({ map: BX.trunkTexture(), repeat: [1, 6], mapAmt: 0.7, tone: 0.82, facing: 0.6, hatchFreq: 16 }),
    flower: ink({ tone: 1, facing: 0.4, hatch: 0 }),
    iron: ink({ tone: 0.16, facing: 0.3, hatch: 0 }),
    ironMid: ink({ tone: 0.36, facing: 0.4, hatch: 0.4 }),
    wood: ink({ tone: 0.8, facing: 0.6 }),
    woodDark: ink({ tone: 0.45, facing: 0.5, hatch: 0.6 }),
    glow: ink({ tone: 1, facing: 0, hatch: 0 }),
    paper: ink(),
    canvas: ink({ tone: 0.96, facing: 0.4, side: THREE.DoubleSide }),
    banner: ink({ map: BX.cityBannerTexture(), facing: 0.15, hatch: 0, side: THREE.DoubleSide }),
    foliage: ink({ map: BX.foliageTexture(), tri: 1 / 2.5, mapAmt: 0.6, tone: 0.97, facing: 0.75, hatchFreq: 14 }),
    foliageDark: ink({ map: BX.foliageTexture(958), tri: 1 / 2.5, mapAmt: 0.6, tone: 0.86, facing: 0.75, hatchFreq: 14 }),
    chalk: ink({ map: BX.chalkboardTexture(), facing: 0.1, hatch: 0 }),
    planks: ink({ map: BX.planksTexture(), tri: 1 / 3, mapAmt: 0.7, tone: 0.9, facing: 0.3, hatch: 0.6 }),
    // the street's buildings
    brick: ink({ map: BX.brickTexture(), tri: 1 / 1.6, mapAmt: 0.6, tone: 0.93, facing: 0.45, hatchFreq: 9 }),
    siding: ink({ map: BX.sidingTexture(), tri: 1 / 2, mapAmt: 0.55, tone: 0.97, facing: 0.45, hatchFreq: 9 }),
    awning: ink({ map: TX.awningTexture(), facing: 0.35, side: THREE.DoubleSide }),
    doorway: ink({ map: TX.doorTexture(), facing: 0.2, hatch: 0 }),
    shopWin: ['plain', 'bread', 'books', 'gifts'].reduce((o, k, i) => ({ ...o, [k]: ink({ map: BX.shopWindowTexture(k, 960 + i), facing: 0.1, hatch: 0 }) }), {}),
    boards: ink({ map: TW.boardsTexture(), tri: 1 / 2, facing: 0.3, mapAmt: 0.6, tone: 0.92, hatch: 0.6 }),
    plaster: ink({ map: TW.plasterTexture(), tri: 1 / 3, facing: 0.15, mapAmt: 0.5, tone: 0.97, hatch: 0.35 }),
    menuA: ink({ map: TX.menuTexture(['MENU', 'Espresso', 'Cappuccino', 'Latte', 'Mocha', 'Tea']), facing: 0 }),
    menuB: ink({ map: TX.menuTexture(['PASTRIES', 'Croissant', 'Scone', 'Sourdough', 'Muffin'], 366), facing: 0 }),
    street: ink({ map: BX.streetTexture(), tri: 1 / 4, mapAmt: 0.7, tone: 0.9, facing: 0.15, hatch: 0.5 }),
    rail: ink({ tone: 0.5, facing: 0.5, hatch: 0 }),
    signs: new Map(), // fascia sign materials by text (street.js)
  };
}

// ---- small geometry helpers -------------------------------------------------------------
export const boxG = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; };
export const cylG = (rt, rb, h, x, y, z, seg = 12) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y + h / 2, z); return g; };
export const sphG = (r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 12) => { const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };

// ---- trees ------------------------------------------------------------------------------
// A Washingtonia palm: a slender ringed trunk with a slight lean, a skirt and
// a crown of drooping fronds (drawn leaflets).
export function palm(B, M, x, y, z, { h = 9, lean = 0.06, seed = 1 } = {}) {
  const r = mulberry(seed);
  const put = placer(B, x, y, z, r() * Math.PI * 2);
  const id = farId(r());
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 1.4) * lean * h, t * h, 0)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.TubeGeometry(curve, 16, 0.2, 8, false);
  // taper: thicker at the foot
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / h, c = curve.getPoint(Math.min(1, Math.max(0, t))); const k = 1.35 - 0.45 * t; p.setX(i, c.x + (p.getX(i) - c.x) * k); p.setZ(i, c.z + (p.getZ(i) - c.z) * k); }
  trunk.computeVertexNormals();
  put(trunk, M.trunk, id);
  const top = curve.getPoint(1);
  put(sphG(0.42, top.x, top.y - 0.15, top.z, 1, 1.2, 1, 10), M.leafDark, id);
  // fronds: ribbons arching out and drooping
  const n = 13;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r() * 0.3, up = 0.55 - (k % 3) * 0.35 + r() * 0.2, L = 2.6 + r() * 0.8;
    const pos = [], uv = [], idx = [];
    const S = 8;
    for (let i = 0; i <= S; i++) {
      const t = i / S, w = 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.05;
      const dist = t * L, rise = Math.sin(up) * dist - 1.6 * t * t * L * 0.45;
      const cx = top.x + Math.cos(a) * dist * Math.cos(up * 0.5), cz = top.z + Math.sin(a) * dist * Math.cos(up * 0.5), cy = top.y + rise;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      pos.push(cx - px, cy - 0.05 * w, cz - pz, cx + px, cy - 0.05 * w, cz + pz);
      uv.push(0, t, 1, t);
      if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    put(g, M.frond, id + 0.003);
  }
  return { x, z, r: 0.35 };
}
// A low shrub / flower bed: a rounded mound with white blossoms.
export function shrubs(B, M, x0, z0, x1, z1, y = 0, { seed = 4, flowers = true } = {}) {
  const r = mulberry(seed), id = farId(r());
  const n = Math.max(2, Math.round((Math.hypot(x1 - x0, z1 - z0)) / 0.8));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t + (r() - 0.5) * 0.2, z = z0 + (z1 - z0) * t + (r() - 0.5) * 0.2;
    B.add(sphG(0.45 + r() * 0.15, x, y + 0.28, z, 1.1, 0.7, 1.1, 10), M.leaf, id);
    if (flowers) for (let k = 0; k < 3; k++) B.add(sphG(0.07, x + (r() - 0.5) * 0.6, y + 0.55 + r() * 0.12, z + (r() - 0.5) * 0.6, 1, 1, 1, 5), M.flower, id + 0.002);
  }
}

// ---- street furniture ------------------------------------------------------------------
// A vintage lamppost: fluted base, slim post, lantern; banner: a city banner on an arm;
// basket: a hanging flower basket.
export function lamp(B, M, x, y, z, { h = 3.6, banner = false, ry = 0, twin = false, basket = false } = {}) {
  const put = placer(B, x, y, z, ry), id = farId(Math.abs(Math.sin(x * 12.9 + z * 7.1)));
  put(cylG(0.2, 0.25, 0.14, 0, 0, 0, 14), M.iron, id);
  put(cylG(0.13, 0.18, 0.6, 0, 0.14, 0, 12), M.iron, id);
  put(cylG(0.05, 0.08, h - 0.7, 0, 0.74, 0, 10), M.iron, id);
  const head = (hx) => {
    put(cylG(0.07, 0.1, 0.1, hx, h, 0, 8), M.iron, id);
    put(cylG(0.2, 0.12, 0.42, hx, h + 0.1, 0, 8), M.glow, id + 0.004);
    put(cylG(0.05, 0.26, 0.16, hx, h + 0.52, 0, 8), M.iron, id);
    put(sphG(0.05, hx, h + 0.74, 0, 1, 1, 1, 8), M.iron, id);
  };
  if (twin) {
    put(boxG(1.0, 0.05, 0.05, 0, h - 0.06, 0), M.iron, id);
    head(-0.5); head(0.5);
  } else head(0);
  if (banner) {
    put(boxG(0.62, 0.04, 0.04, 0.3, h - 0.55, 0), M.iron, id);
    put(boxG(0.62, 0.04, 0.04, 0.3, h - 1.95, 0), M.iron, id);
    const g = new THREE.PlaneGeometry(0.56, 1.4);
    g.translate(0.33, h - 1.25, 0);
    put(g, M.banner, id + 0.006);
  }
  if (basket) {
    // a hanging flower basket on a short arm opposite the banner
    put(boxG(0.5, 0.04, 0.04, -0.25, h - 0.45, 0), M.iron, id);
    for (const dz of [-0.1, 0.1]) put(cylG(0.006, 0.006, 0.3, -0.45, h - 0.75, dz, 4), M.iron, id);
    put(sphG(0.22, -0.45, h - 0.82, 0, 1, 0.6, 1, 10), M.woodDark, id + 0.008);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; put(sphG(0.13, -0.45 + Math.cos(a) * 0.17, h - 0.74 - (k % 2) * 0.12, Math.sin(a) * 0.17, 1, 0.8, 1, 8), M.leaf, id + 0.01); }
    put(sphG(0.14, -0.45, h - 0.66, 0, 1, 0.8, 1, 8), M.leaf, id + 0.01);
  }
  return { x, z, r: 0.22 };
}
// A bench with cast-iron ends and wooden slats, facing local -z.
export function bench(B, M, x, y, z, ry = 0) {
  const put = placer(B, x, y, z, ry), id = farId(Math.abs(Math.sin(x * 3.1 + z * 5.7)));
  for (const sx of [-0.82, 0.82]) {
    put(boxG(0.06, 0.44, 0.06, sx, 0, -0.2), M.iron, id);
    const back = boxG(0.06, 0.86, 0.06, 0, 0, 0); back.rotateX(-0.08); back.translate(sx, 0, 0.21); put(back, M.iron, id);
    put(boxG(0.05, 0.05, 0.5, sx, 0.4, 0), M.iron, id);
    put(boxG(0.06, 0.05, 0.42, sx, 0.66, -0.02), M.iron, id);
    put(boxG(0.06, 0.24, 0.05, sx, 0.42, -0.2), M.iron, id);
  }
  for (let i = 0; i < 4; i++) put(boxG(1.78, 0.04, 0.095, 0, 0.42, -0.17 + i * 0.115), M.wood, id + 0.002);
  for (let i = 0; i < 3; i++) { const g = boxG(1.78, 0.09, 0.03, 0, 0, 0); g.rotateX(-0.12); g.translate(0, 0.55 + i * 0.13, 0.23 + i * 0.012); put(g, M.wood, id + 0.002); }
  return { x, z, r: 0.75 };
}
// A slatted round bin.
export function bin(B, M, x, y, z) {
  const id = farId(Math.abs(Math.sin(x * 9.1 + z)));
  B.add(cylG(0.27, 0.25, 0.85, x, y, z, 14), M.ironMid, id);
  B.add(cylG(0.3, 0.3, 0.06, x, y + 0.85, z, 14), M.iron, id);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; B.add(boxG(0.025, 0.7, 0.025, x + Math.cos(a) * 0.275, y + 0.08, z + Math.sin(a) * 0.275), M.iron, id); }
  return { x, z, r: 0.3 };
}

// ---- the street ----------------------------------------------------------------------
// A street tree in an iron grate (a London plane): a leaning trunk that forks,
// and a crown of lumpy leaf clusters (the lumps give the drawn, scalloped edge).
export function streetTree(B, M, x, y, z, { s = 1, seed = 6 } = {}) {
  const r = mulberry(seed), put = placer(B, x, y, z, r() * Math.PI * 2), id = farId(r());
  put(boxG(1.2, 0.03, 1.2, 0, 0, 0), M.iron, id);
  for (let i = -2; i <= 2; i++) put(boxG(1.1, 0.035, 0.04, 0, 0.005, i * 0.22), M.ironMid, id);
  const branch = (pts, r0, r1) => {
    const c = new THREE.CatmullRomCurve3(pts.map(([a, b, d]) => new THREE.Vector3(a * s, b * s, d * s)));
    const g = new THREE.TubeGeometry(c, 8, 1, 6, false);
    const p = g.attributes.position, n = 9;
    for (let i = 0; i < p.count; i++) {
      const k = Math.floor(i / 7) / (n - 1), q = c.getPointAt(Math.min(1, k)), rr = (r0 + (r1 - r0) * k) * s;
      p.setXYZ(i, q.x + (p.getX(i) - q.x) * rr, q.y + (p.getY(i) - q.y) * rr, q.z + (p.getZ(i) - q.z) * rr);
    }
    g.computeVertexNormals();
    put(g, M.woodDark, id);
  };
  branch([[0, 0, 0], [0.05, 1.4, 0.02], [0.12, 2.6, 0.05]], 0.15, 0.11);
  branch([[0.12, 2.5, 0.05], [0.6, 3.3, 0.3], [1.1, 4.0, 0.4]], 0.09, 0.05);
  branch([[0.12, 2.5, 0.05], [-0.4, 3.4, -0.2], [-0.9, 4.2, -0.3]], 0.09, 0.05);
  branch([[0.12, 2.6, 0.05], [0.2, 3.6, -0.5], [0.1, 4.6, -0.6]], 0.08, 0.04);
  const blob = (bx, by, bz, rad, mat) => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(rad * s, 2));
    const p = g.attributes.position, v = new THREE.Vector3();
    const ph = r() * 10;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const k = 1 + 0.13 * Math.sin(v.x * 7 + ph) * Math.sin(v.y * 6 + ph * 0.7) * Math.sin(v.z * 7 + ph * 1.3) + 0.07 * Math.sin(v.x * 13 + v.z * 11 + ph);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.82, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    g.translate(bx * s, by * s, bz * s);
    put(g, mat, id + 0.003);
  };
  blob(0.1, 4.7, 0, 1.55, M.foliage);
  blob(1.2, 4.2, 0.5, 1.15, M.foliage);
  blob(-1.0, 4.4, -0.3, 1.2, M.foliage);
  blob(0.2, 5.6, -0.5, 1.05, M.foliage);
  blob(-0.3, 3.9, 0.9, 0.95, M.foliageDark);
  blob(0.7, 3.8, -0.9, 0.9, M.foliageDark);
  return { x, z, r: 0.2 };
}
// A café table (round marble top on a cast-iron stand) with chairs round it.
// chairs: angles (radians) where the chairs stand.
export function cafeTable(B, M, x, y, z, { chairs = [0, Math.PI], seed = 7 } = {}) {
  const id = farId(mulberry(seed)());
  B.add(cylG(0.36, 0.36, 0.04, x, y + 0.72, z, 20), M.trim, id);
  B.add(cylG(0.03, 0.04, 0.7, x, y + 0.02, z, 8), M.iron, id);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const g = boxG(0.36, 0.03, 0.05, 0.16, 0, 0); g.rotateY(a); g.translate(x, y, z); B.add(g, M.iron, id); }
  for (const a of chairs) cafeChair(B, M, x + Math.sin(a) * 0.62, y, z + Math.cos(a) * 0.62, a, id + 0.002);
  return { x, z, r: 0.95 };
}
// A bistro chair facing local -z after the turn ry (its back toward +z).
export function cafeChair(B, M, x, y, z, ry, id) {
  const put = placer(B, x, y, z, ry);
  for (const [sx, sz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) put(cylG(0.014, 0.016, 0.45, sx, 0, sz, 6), M.iron, id);
  put(cylG(0.22, 0.22, 0.03, 0, 0.45, 0, 14), M.wood, id);
  for (const sx of [-0.17, 0.17]) put(cylG(0.013, 0.013, 0.42, sx, 0.47, 0.19, 6), M.iron, id);
  const back = new THREE.TorusGeometry(0.18, 0.016, 5, 12, Math.PI); back.translate(0, 0.86, 0.19); put(back, M.iron, id);
  put(boxG(0.34, 0.08, 0.02, 0, 0.7, 0.19), M.wood, id);
}
// The A-frame chalkboard, its faces toward local +z and -z.
export function aFrame(B, M, x, y, z, ry = 0) {
  const put = placer(B, x, y, z, ry), id = farId(Math.abs(Math.sin(x * 4.1 + z * 2.3)));
  for (const sd of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.62, 0.95, 0.04);
    g.translate(0, 0.475, 0); g.rotateX(sd * 0.2); g.translate(0, 0, sd * 0.1);
    put(g, [M.woodDark, M.woodDark, M.woodDark, M.woodDark, sd > 0 ? M.chalk : M.woodDark, sd > 0 ? M.woodDark : M.chalk], id);
  }
  return { x, z, r: 0.4 };
}
// A cast-iron bollard.
export function bollard(B, M, x, y, z) {
  const id = farId(Math.abs(Math.sin(x * 5.3 + z * 3.9)));
  B.add(cylG(0.11, 0.14, 0.75, x, y, z, 10), M.iron, id);
  B.add(cylG(0.15, 0.15, 0.06, x, y + 0.62, z, 10), M.iron, id);
  B.add(sphG(0.12, x, y + 0.78, z, 1, 0.7, 1, 10), M.iron, id);
  return { x, z, r: 0.18 };
}

// small deterministic rng per object
export function mulberry(a) {
  let t = (Math.floor(a * 1e6) | 0) + 0x6d2b79f5;
  return () => { t |= 0; t = (t + 0x6d2b79f5) | 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
