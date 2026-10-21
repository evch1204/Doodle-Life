import * as THREE from 'three';
import { ink } from '../../ink.js';
import * as BX from '../../bayTextures.js';
import { doorTexture } from '../../shanghaiTextures.js';
import { Batch, farId } from '../kit.js';
import { at, boxG, cylG, sphG, palm, cypress, oak, lamp, bench, bin, planter, hedge, shrubs } from './props.js';

// Santa Clara University: the Mission Church at the head of a palm walk, the
// Mediterranean halls with their arcades and tile roofs, the entry sign and
// the campus details of the reference sketch. All in world meters; the church
// faces +z (back toward the overlook), the walk runs along x = CAMPUS.axis.

export const CAMPUS = {
  axis: 18,                     // the palm walk's centre line (x)
  walkZ: [-6, -42],             // the walk, from the entry to the forecourt
  forecourt: [-42, -48.4],      // paved, in front of the steps
  facadeZ: -50,                 // the church front (steps rise to it)
  steps: [-48.4, -50],          // three steps up to the portal
  stepH: 0.54,
};
const FL = 3.6; // a hall storey

export function buildCampus(root, M) {
  const B = new Batch();
  const colliders = [], blockers = [];
  const solidBox = (x0, x1, z0, z1) => colliders.push({ type: 'box', minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
  const solidC = (c) => colliders.push({ type: 'circle', x: c.x, z: c.z, r: c.r });
  const blocker = (x0, x1, y0, y1, z0, z1) => blockers.push([x0, x1, y0, y1, z0, z1]);
  const { axis: AX } = CAMPUS;
  const mats = {
    rose: ink({ tone: 0.3, facing: 0.1, hatch: 0 }),
    doorArt: ink({ map: doorTexture(), mapAmt: 0.9, facing: 0.1, hatch: 0 }),
    sign: ink({ map: BX.scuSignTexture(), mapAmt: 1, tone: 1, facing: 0.15, hatch: 0 }),
    wayfinding: ink({ map: BX.wayfindingTexture([['Mission Church', 'up'], ['Main Quad', 'up'], ['Library', 'right'], ['Dining', 'right']]), facing: 0.1, hatch: 0 }),
    bell: ink({ tone: 0.35, facing: 0.4, hatch: 0 }),
    statue: ink({ tone: 0.9, facing: 0.6, hatchFreq: 30 }),
    umbrella: ink({ tone: 0.97, facing: 0.5, side: THREE.DoubleSide }),
  };

  // ---- shared shape helpers -------------------------------------------------------------
  const archPath = (p, x, y, w, h) => { const r = w / 2, ys = y + h - r; p.moveTo(x - r, y); p.lineTo(x + r, y); p.lineTo(x + r, ys); p.absarc(x, ys, r, 0, Math.PI, false); p.lineTo(x - r, y); };
  const rectPath = (p, x, y, w, h) => { p.moveTo(x - w / 2, y); p.lineTo(x + w / 2, y); p.lineTo(x + w / 2, y + h); p.lineTo(x - w / 2, y + h); p.lineTo(x - w / 2, y); };
  // a wall in its own frame (x along the wall, y up), front face at z = 0, t thick, with openings
  function wall(outline, holes, t) {
    const sh = new THREE.Shape();
    outline(sh);
    for (const h of holes) {
      const p = new THREE.Path();
      if (h.circle) p.absarc(h.x, h.y, h.r, 0, Math.PI * 2, true);
      else if (h.arch) archPath(p, h.x, h.y, h.w, h.h); else rectPath(p, h.x, h.y, h.w, h.h);
      sh.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, -t);
    return g;
  }
  // a hip roof over w x d (centred), eaves over, rising `rise`; UVs in tiles of 1.9 m
  function hipRoof(w, d, rise, over = 0.6) {
    const W = w / 2 + over, D = d / 2 + over, r = Math.max(0.01, Math.min(W, D) - 0.001);
    const rx = W - r, rz = D - r; // ridge half-lengths (one is ~0)
    const pos = [], uv = [];
    const face = (a, b, c, d2, e) => {
      // a, b: eave corners; c, d2: ridge ends (may coincide); e: the eave's outward direction
      const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const ux = (b[0] - a[0]) / L, uz = (b[2] - a[2]) / L;
      const slope = Math.hypot(r, rise);
      const proj = (p) => [((p[0] - a[0]) * ux + (p[2] - a[2]) * uz) / 1.9, (p[1] / rise) * (slope / 1.9)];
      for (const tri of [[a, b, c], [a, c, d2]]) for (const p of tri) { pos.push(...p); uv.push(...proj(p)); }
      void e;
    };
    const y0 = 0, y1 = rise;
    const A = [-W, y0, D], Bc = [W, y0, D], C = [W, y0, -D], Dd = [-W, y0, -D];
    const R1 = [-rx, y1, rz], R2 = [rx, y1, rz], R3 = [rx, y1, -rz], R4 = [-rx, y1, -rz];
    face(A, Bc, R2, R1); face(Bc, C, R3, R2); face(C, Dd, R4, R3); face(Dd, A, R1, R4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }
  // a window on a wall face (its frame: front at z = 0): glass set in, a surround and a sill
  function window_(put, x, y, w, h, id, { arch = false } = {}) {
    if (arch) {
      const s = new THREE.Shape(); archPath(s, x, y, w, h);
      const g = new THREE.ShapeGeometry(s, 10); g.translate(0, 0, 0.02); put(g, M.glass, id);
      const ring = new THREE.Shape(); archPath(ring, x, y - 0.08, w + 0.32, h + 0.24);
      const hole = new THREE.Path(); archPath(hole, x, y, w, h); ring.holes.push(hole);
      const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: false, curveSegments: 10 }); put(rg, M.trim, id);
    } else {
      const g = new THREE.PlaneGeometry(w, h); g.translate(x, y + h / 2, 0.02); put(g, M.glass, id);
      for (const [fw, fh, fx, fy] of [[w + 0.3, 0.14, x, y + h], [0.15, h, x - w / 2 - 0.075, y], [0.15, h, x + w / 2 + 0.075, y]]) put(boxG(fw, fh, 0.1, fx, fy, 0.05), M.trim, id);
    }
    put(boxG(w + 0.4, 0.12, 0.24, x, y - 0.12, 0.1), M.trim, id);
  }

  // =====================================================================
  // THE MISSION CHURCH (facade centre at (AX, 0, facadeZ), facing +z)
  // =====================================================================
  {
    const put = at(B, AX, 0, CAMPUS.facadeZ);
    const idWall = farId(0.13), idTrim = farId(0.27), idTower = farId(0.41), idRoof = farId(0.55), idDark = farId(0.69), idOrn = farId(0.83);
    const FW = 13, FH = 11.4, T = 1.0;
    // the facade: a curved mission gable over the wall, the portal, the rose window, two upper windows
    const gable = (sh) => {
      sh.moveTo(-FW / 2, 0); sh.lineTo(FW / 2, 0); sh.lineTo(FW / 2, FH + 0.4);
      sh.lineTo(FW / 2 - 0.9, FH + 0.4);
      sh.bezierCurveTo(4.2, FH + 0.7, 4.0, FH + 2.2, 2.6, FH + 2.6);
      sh.bezierCurveTo(1.8, FH + 2.9, 1.4, FH + 4.4, 0, FH + 4.8);
      sh.bezierCurveTo(-1.4, FH + 4.4, -1.8, FH + 2.9, -2.6, FH + 2.6);
      sh.bezierCurveTo(-4.0, FH + 2.2, -4.2, FH + 0.7, -FW / 2 + 0.9, FH + 0.4);
      sh.lineTo(-FW / 2, FH + 0.4); sh.lineTo(-FW / 2, 0);
    };
    const portal = { x: 0, y: CAMPUS.stepH, w: 2.8, h: 5.0, arch: true };
    const rose = { circle: true, x: 0, y: 8.7, r: 1.3 };
    const upper = [-4.5, 4.5].map((x) => ({ x, y: 7.5, w: 0.9, h: 2.2, arch: true }));
    put(wall(gable, [portal, rose, ...upper], T), M.stucco, idWall);
    // relief: plinth, pilasters with capitals, string course, entablature, the gable's coping
    put(boxG(FW + 0.3, 0.6, 0.3, 0, 0, 0.1), M.trim, idTrim);
    for (const x of [-6.05, -2.75, 2.75, 6.05]) {
      put(boxG(0.62, FH - 0.6, 0.28, x, 0.6, 0.14), M.trim, idTrim);
      put(boxG(0.82, 0.3, 0.36, x, FH - 0.55, 0.16), M.trim, idTrim);
    }
    put(boxG(FW + 0.6, 0.5, 0.55, 0, FH - 0.1, 0.2), M.trim, idTrim);
    put(boxG(FW - 0.5, 0.22, 0.24, 0, 6.2, 0.12), M.trim, idTrim);
    {
      // coping: the gable's top edge, slightly proud
      const pts = [];
      const curve = new THREE.CurvePath();
      curve.add(new THREE.CubicBezierCurve(new THREE.Vector2(FW / 2 - 0.9, FH + 0.4), new THREE.Vector2(4.2, FH + 0.7), new THREE.Vector2(4.0, FH + 2.2), new THREE.Vector2(2.6, FH + 2.6)));
      curve.add(new THREE.CubicBezierCurve(new THREE.Vector2(2.6, FH + 2.6), new THREE.Vector2(1.8, FH + 2.9), new THREE.Vector2(1.4, FH + 4.4), new THREE.Vector2(0, FH + 4.8)));
      for (const p of curve.getSpacedPoints(24)) pts.push(p);
      const half = pts.concat(pts.slice(0, -1).reverse().map((p) => new THREE.Vector2(-p.x, p.y)));
      const path3 = new THREE.CatmullRomCurve3(half.map((p) => new THREE.Vector3(p.x, p.y + 0.08, 0.12)));
      put(new THREE.TubeGeometry(path3, 80, 0.16, 6, false), M.trim, idTrim);
    }
    // the portal: an arch moulding, the doors (panels and fanlight) set back
    {
      const ring = new THREE.Shape(); archPath(ring, 0, CAMPUS.stepH - 0.04, portal.w + 0.8, portal.h + 0.44);
      const hole = new THREE.Path(); archPath(hole, 0, CAMPUS.stepH, portal.w, portal.h); ring.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(ring, { depth: 0.22, bevelEnabled: false, curveSegments: 14 }); put(g, M.trim, idTrim);
      put(boxG(0.5, 0.6, 0.3, 0, CAMPUS.stepH + portal.h - 0.15, 0.14), M.trim, idTrim); // keystone
      const ds = new THREE.Shape(); archPath(ds, 0, CAMPUS.stepH, portal.w, portal.h);
      const dg = new THREE.ShapeGeometry(ds, 12);
      // map the door drawing across the opening
      const uvA = dg.attributes.uv, p = dg.attributes.position;
      for (let i = 0; i < uvA.count; i++) uvA.setXY(i, (p.getX(i) + portal.w / 2) / portal.w, (p.getY(i) - CAMPUS.stepH) / portal.h);
      dg.translate(0, 0, -0.75);
      put(dg, mats.doorArt, idDark);
    }
    // niches either side of the portal, a saint in each
    for (const x of [-4.4, 4.4]) {
      const s = new THREE.Shape(); archPath(s, x, 1.6, 1.15, 3.1);
      const g = new THREE.ShapeGeometry(s, 10); g.translate(0, 0, 0.012); put(g, M.reveal, idDark);
      const ring = new THREE.Shape(); archPath(ring, x, 1.52, 1.45, 3.38); const h = new THREE.Path(); archPath(h, x, 1.6, 1.15, 3.1); ring.holes.push(h);
      put(new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: false, curveSegments: 10 }), M.trim, idTrim);
      put(boxG(1.2, 0.18, 0.4, x, 1.45, 0.12), M.trim, idTrim);
      put(cylG(0.2, 0.3, 1.9, x, 1.62, 0.25, 10), mats.statue, idOrn);
      put(sphG(0.17, x, 3.7, 0.25, 1, 1.1, 1, 10), mats.statue, idOrn);
    }
    // upper windows and the rose window: glass set in, tracery
    for (const u of upper) { const s = new THREE.Shape(); archPath(s, u.x, u.y, u.w, u.h); const g = new THREE.ShapeGeometry(s, 10); g.translate(0, 0, -0.6); put(g, M.glass, idDark); }
    {
      const cy = rose.y, z = 0.05;
      const disc = new THREE.CircleGeometry(rose.r, 36); disc.translate(0, cy, -0.5); put(disc, mats.rose, idDark);
      const ring = (R, tube, zz) => { const g = new THREE.TorusGeometry(R, tube, 6, 40); g.translate(0, cy, zz); put(g, M.trim, idOrn); };
      ring(rose.r + 0.16, 0.2, z); ring(0.45, 0.09, -0.3);
      for (let k = 0; k < 8; k++) { const g = new THREE.BoxGeometry(0.1, rose.r - 0.45, 0.1); g.translate(0, 0.45 + (rose.r - 0.45) / 2, 0); g.rotateZ((k / 8) * Math.PI * 2); g.translate(0, cy, -0.3); put(g, M.trim, idOrn); }
      for (let k = 0; k < 8; k++) { const a = ((k + 0.5) / 8) * Math.PI * 2; const g = new THREE.TorusGeometry(0.28, 0.05, 4, 16); g.translate(Math.cos(a) * 0.9, cy + Math.sin(a) * 0.9, -0.3); put(g, M.trim, idOrn); }
    }
    // a small medallion and the cross on the gable
    { const g = new THREE.TorusGeometry(0.38, 0.08, 6, 24); g.translate(0, FH + 2.75, 0.06); put(g, M.trim, idOrn); }
    put(boxG(0.16, 1.7, 0.16, 0, FH + 4.7, -0.3), M.dark, idOrn);
    put(boxG(0.9, 0.15, 0.16, 0, FH + 5.75, -0.3), M.dark, idOrn);

    // the nave behind: walls with tall arched windows between buttresses, a gable tile roof
    const NW = 12, NL = 28, NH = 10;
    put(boxG(NW, NH, NL, 0, 0, -T - NL / 2), M.stucco, idWall);
    for (const sx of [-1, 1]) {
      const sidePut = (g, mat, id) => { g.rotateY(sx * Math.PI / 2); g.translate(sx * NW / 2, 0, 0); put(g, mat, id); };
      for (let k = 0; k < 5; k++) {
        const z = -T - 3 - k * 5.2;
        // window (its frame front = the wall face, so build in the wall's frame, then place)
        const holder = [];
        const local = (g, mat, id) => holder.push([g, mat, id]);
        window_(local, 0, 3.6, 1.3, 3.6, idDark, { arch: true });
        for (const [g, mat, id] of holder) { g.translate(0, 0, 0); g.translate(sx > 0 ? -z : z, 0, 0); sidePut(g, mat, id); }
        const bz = z - 2.6;
        put(boxG(0.7, NH - 0.6, 0.9, sx * (NW / 2 + 0.3), 0, bz), M.trim, idTrim);
      }
      put(boxG(0.5, 0.5, NL, sx * (NW / 2 + 0.2), NH - 0.5, -T - NL / 2), M.trim, idTrim);
    }
    // the roof: two slopes and the gable end at the back
    const rise = 3.6, half = NW / 2 + 0.6, L2 = Math.hypot(half, rise), a = Math.atan2(rise, half);
    for (const sx of [-1, 1]) {
      const g = new THREE.BoxGeometry(L2, 0.18, NL + 0.6);
      const uvA = g.attributes.uv;
      for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * (NL / 1.9), uvA.getY(i) * (L2 / 1.9));
      g.rotateZ(-sx * a); g.translate(sx * half / 2, NH + rise / 2, -T - NL / 2 + 0.3);
      put(g, M.tile, idRoof);
    }
    { const s = new THREE.Shape(); s.moveTo(-NW / 2, 0); s.lineTo(NW / 2, 0); s.lineTo(0, rise * (NW / 2) / half); s.lineTo(-NW / 2, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); g.translate(0, NH, -T - NL); put(g, [M.stucco, M.stucco], idWall); }
    { const g = new THREE.BoxGeometry(0.3, 0.3, NL + 0.6); g.translate(0, NH + rise + 0.05, -T - NL / 2 + 0.3); put(g, M.dark, idRoof); }

    // the bell tower on the right: a shaft, two open belfry stages, a dome, a lantern, the cross
    const TX0 = FW / 2 + 2.6, TZ = -2.0; // tower centre (local)
    const TW0 = 5.0;
    put(boxG(TW0, 13.0, TW0, TX0, 0, TZ), M.stucco, idTower);
    put(boxG(TW0 + 0.3, 0.6, TW0 + 0.3, TX0, 0, TZ), M.trim, idTrim);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(boxG(0.5, 12.4, 0.5, TX0 + dx * (TW0 / 2 - 0.15), 0.6, TZ + dz * (TW0 / 2 - 0.15)), M.trim, idTrim);
    // a slit window and a clock-like round window on the shaft's front
    { const holder = []; window_((g, m, i) => holder.push([g, m, i]), 0, 5.2, 0.6, 1.6, idDark, { arch: true }); for (const [g, m, i] of holder) { g.translate(TX0, 0, TZ + TW0 / 2); put(g, m, i); } }
    { const g = new THREE.TorusGeometry(0.55, 0.1, 6, 24); g.translate(TX0, 9.6, TZ + TW0 / 2 + 0.04); put(g, M.trim, idOrn); const d = new THREE.CircleGeometry(0.5, 20); d.translate(TX0, 9.6, TZ + TW0 / 2 + 0.02); put(d, mats.rose, idDark); }
    put(boxG(TW0 + 0.7, 0.55, TW0 + 0.7, TX0, 13.0, TZ), M.trim, idTrim);
    const belfry = (s, y0, h, open) => {
      // four walls each cut by one arch, a dark core, a bell
      for (let k = 0; k < 4; k++) {
        const g = wall((sh) => rectPath(sh, 0, 0, s, h), [{ x: 0, y: 0.5, w: open, h: h - 1.3, arch: true }], 0.45);
        g.translate(0, y0, s / 2);
        g.rotateY((k * Math.PI) / 2);
        g.translate(TX0, 0, TZ);
        put(g, M.stucco, idTower);
      }
      put(boxG(s - 1.6, h - 0.2, s - 1.6, TX0, y0, TZ), M.dark, idDark);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(boxG(0.4, h, 0.4, TX0 + dx * (s / 2 - 0.05), y0, TZ + dz * (s / 2 - 0.05)), M.trim, idTrim);
    };
    belfry(4.2, 13.55, 4.8, 1.7);
    put(boxG(4.9, 0.5, 4.9, TX0, 18.35, TZ), M.trim, idTrim);
    belfry(3.2, 18.85, 3.0, 1.2);
    put(boxG(3.8, 0.45, 3.8, TX0, 21.85, TZ), M.trim, idTrim);
    { // the bell, seen in the lower belfry
      const prof = [[0.02, 0], [0.75, 0], [0.7, 0.15], [0.55, 0.5], [0.45, 1.0], [0.3, 1.25], [0.02, 1.3]].map(([r, y]) => new THREE.Vector2(r, y));
      const g = new THREE.LatheGeometry(prof, 14); g.translate(TX0, 15.1, TZ); put(g, mats.bell, idOrn);
    }
    { // dome, lantern, cross
      const y = 22.3;
      put(cylG(1.55, 1.6, 0.5, TX0, y, TZ, 20), M.stucco, idTower);
      const d = new THREE.SphereGeometry(1.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 1.1, 1); d.translate(TX0, y + 0.5, TZ); put(d, M.stucco2, idTower);
      put(cylG(0.32, 0.38, 0.9, TX0, y + 2.1, TZ, 10), M.trim, idTrim);
      put(sphG(0.34, TX0, y + 3.05, TZ, 1, 0.8, 1, 10), M.trim, idTrim);
      put(boxG(0.14, 1.6, 0.14, TX0, y + 3.2, TZ), M.dark, idOrn);
      put(boxG(0.8, 0.13, 0.14, TX0, y + 4.25, TZ), M.dark, idOrn);
    }
    // the steps up to the portal (three, the full width of the facade) and the platform
    const st = CAMPUS.steps, n = 3;
    for (let k = 0; k < n; k++) {
      const d = (st[0] - st[1]) * (1 - k / n);
      put(boxG(FW + 1.2 - k * 0.4, (CAMPUS.stepH * (k + 1)) / n, d, 0, 0, d / 2), M.kerb, idTrim + 0.01);
    }
    // colliders + camera blockers: the church body and tower (the step platform is walkable)
    const cz = CAMPUS.facadeZ;
    solidBox(AX - FW / 2 - 0.2, AX + FW / 2 + 0.2, cz - T - NL - 0.4, cz - 0.6);
    solidBox(AX + TX0 - TW0 / 2 - 0.4, AX + TX0 + TW0 / 2 + 0.4, cz + TZ - TW0 / 2 - 0.4, cz + TZ + TW0 / 2 + 0.4);
    solidBox(AX - NW / 2 - 1.0, AX + NW / 2 + 1.0, cz - T - NL - 0.4, cz - T);
    blocker(AX - FW / 2, AX + FW / 2, 0, 16, cz - T - NL, cz - 0.2);
    blocker(AX + TX0 - TW0 / 2, AX + TX0 + TW0 / 2, 0, 24, cz + TZ - TW0 / 2, cz + TZ + TW0 / 2);
  }

  // =====================================================================
  // THE HALLS: two-storey Mediterranean buildings, an arcade on the front,
  // windows in surrounds, a tile hip roof
  // =====================================================================
  // front: the direction the arcade faces, as a rotation (0: +z, PI: -z, PI/2: +x, -PI/2: -x)
  function hall(cx, cz, w, d, ry, { floors = 2, arcade = true, bay = 3.2, seed = 1 } = {}) {
    const put = at(B, cx, 0, cz, ry);
    const id = farId((seed * 0.137) % 1), idT = farId((seed * 0.311) % 1), idG = farId((seed * 0.523) % 1), idR = farId((seed * 0.719) % 1);
    const H = floors * FL;
    put(boxG(w, H, d, 0, 0, 0), seed % 2 ? M.stucco : M.stucco2, id);
    put(boxG(w + 0.2, 0.5, d + 0.2, 0, 0, 0), M.trim, idT);
    put(boxG(w + 0.3, 0.35, d + 0.3, 0, H - 0.35, 0), M.trim, idT);
    const n = Math.max(2, Math.round(w / bay)), bw = w / n;
    // windows on the four faces (the front's ground floor is behind the arcade: doors)
    const faces = [[0, d / 2, w, 0], [Math.PI, d / 2, w, 1], [Math.PI / 2, w / 2, d, 2], [-Math.PI / 2, w / 2, d, 3]];
    for (const [fr, off, len, k] of faces) {
      const nn = Math.max(1, Math.round(len / bay)), bb = len / nn;
      const holder = [];
      const local = (g, mat, i) => holder.push([g, mat, i]);
      for (let f = 0; f < floors; f++) for (let i = 0; i < nn; i++) {
        const x = -len / 2 + (i + 0.5) * bb;
        if (k === 0 && f === 0 && arcade) window_(local, x, 0.25, 1.3, 2.6, idG, { arch: true });
        else window_(local, x, f * FL + 0.95, 1.05, f === floors - 1 ? 1.7 : 1.9, idG, { arch: f === 0 });
      }
      for (const [g, mat, i] of holder) { g.translate(0, 0, off); g.rotateY(fr); put(g, mat, i); }
    }
    // the arcade: a run of arches on piers in front, its own small tile roof
    if (arcade) {
      const depth = 2.6, ah = FL + 0.2;
      const g = wall((sh) => rectPath(sh, 0, -0.3, w, ah + 0.3), Array.from({ length: n }, (_, i) => ({ x: -w / 2 + (i + 0.5) * bw, y: 0, w: bw * 0.74, h: ah - 0.75, arch: true })), 0.5);
      g.translate(0, 0, d / 2 + depth);
      put(g, M.stucco, id);
      for (let i = 0; i <= n; i++) put(boxG(0.7, ah, 0.62, -w / 2 + i * bw, 0, d / 2 + depth - 0.25), M.trim, idT);
      put(boxG(w + 0.2, 0.3, 0.7, 0, ah - 0.15, d / 2 + depth - 0.25), M.trim, idT);
      const rl = Math.hypot(depth + 0.6, 0.7), ra = Math.atan2(0.7, depth + 0.6);
      const rg = new THREE.BoxGeometry(w + 0.6, 0.14, rl);
      const uvA = rg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * (w / 1.9), uvA.getY(i) * (rl / 1.9));
      rg.rotateX(ra); rg.translate(0, ah + 0.45, d / 2 + depth / 2 + 0.1);
      put(rg, M.tile, idR);
      put(boxG(w, 0.06, depth, 0, 0, d / 2 + depth / 2), M.paving, idT + 0.01);
    }
    // the hip roof
    const roof = hipRoof(w, d, Math.min(w, d) * 0.28);
    roof.translate(0, H, 0);
    put(roof, M.tile, idR);
    // collider + camera blocker (the footprint with its arcade), in world axes
    const dd = d / 2 + (arcade ? 2.9 : 0.2), ww = w / 2 + 0.2;
    const c = Math.abs(Math.cos(ry)) > 0.5;
    const hx = c ? ww : dd, hz = c ? dd : ww;
    const ox = arcade ? Math.round(Math.sin(ry)) * 1.35 : 0, oz = arcade ? Math.round(Math.cos(ry)) * 1.35 : 0;
    solidBox(cx + ox - hx, cx + ox + hx, cz + oz - hz, cz + oz + hz);
    blocker(cx + ox - hx, cx + ox + hx, 0, H + 3, cz + oz - hz, cz + oz + hz);
  }
  // east of the walk: two halls with arcades onto it (the café under the first)
  hall(AX + 17, -21, 22, 9, -Math.PI / 2, { seed: 3 });
  hall(AX + 19, -42, 12, 9, -Math.PI / 2, { seed: 4 });
  // west, beside the church by the water: a smaller adobe hall
  hall(AX - 11.5, -55, 9, 12, 0, { floors: 1, arcade: true, bay: 3, seed: 5 });
  // the residence hall across the lawn north of the overlook, its arcade facing the bay
  hall(10, 22, 30, 9, Math.PI, { seed: 6 });

  // =====================================================================
  // THE WALK, THE FORECOURT, THE GARDENS
  // =====================================================================
  {
    const id = farId(0.91);
    const [z0, z1] = CAMPUS.walkZ;
    // the walk (paved) and the forecourt; kerbs; a lawn under everything else is drawn by the scene
    B.add(boxG(7, 0.04, z0 - z1, AX, 0, (z0 + z1) / 2), M.path, id);
    B.add(boxG(18, 0.04, CAMPUS.forecourt[0] - CAMPUS.forecourt[1], AX, 0, (CAMPUS.forecourt[0] + CAMPUS.forecourt[1]) / 2), M.paving, id + 0.01);
    for (const sx of [-1, 1]) B.add(boxG(0.2, 0.08, z0 - z1, AX + sx * 3.6, 0, (z0 + z1) / 2), M.kerb, id + 0.02);
    // palms in pairs down the walk, lamps with banners between them, flower beds behind
    for (const z of [-11, -20, -29, -38]) {
      for (const sx of z < -24 ? [1] : [-1, 1]) {
        const p = palm(B, M, AX + sx * 4.6, 0, z, { h: 8.5 + ((z * 7 + sx * 3) % 3 + 3) % 3 * 0.6, seed: z * sx + 50 });
        solidC(p);
      }
    }
    for (const z of [-15.5, -24.5, -33.5]) for (const sx of [-1, 1]) solidC(lamp(B, M, AX + sx * 3.9, 0, z, { banner: true, ry: sx > 0 ? 0 : Math.PI }));
    for (const z of [-15.5, -24.5, -33.5]) for (const sx of [-1, 1]) shrubs(B, M, AX + sx * 5.6, z - 3, AX + sx * 5.6, z + 3, 0, { seed: z * sx });
    // forecourt: planters at the corners, the old wooden Mission cross on its plinth
    for (const sx of [-1, 1]) { colliders.push(planter(B, M, AX + sx * 7.5, 0, -43.3, 2.2, 1.0, sx + 7)); colliders.push(planter(B, M, AX + sx * 7.5, 0, -47.4, 2.2, 1.0, sx + 9)); }
    {
      const cx = AX - 5.8, cz = -45.2, cid = farId(0.77);
      B.add(boxG(1.4, 0.5, 1.4, cx, 0, cz), M.stone, cid);
      B.add(boxG(0.3, 5.0, 0.3, cx, 0.5, cz), M.woodDark, cid);
      B.add(boxG(2.0, 0.28, 0.3, cx, 4.0, cz), M.woodDark, cid);
      solidBox(cx - 0.8, cx + 0.8, cz - 0.8, cz + 0.8);
    }
    // cypresses framing the church, oaks on the lawns
    for (const [x, z, h] of [[AX - 9.2, -68, 10], [AX - 8, -73, 8.5], [AX + 11, -60, 10.5], [AX + 9.4, -64, 9]]) solidC(cypress(B, M, x, 0, z, { h, seed: x + z }));
    for (const [x, z, s] of [[4.8, -24, 0.9], [4.6, -40, 0.9], [AX + 26, -2, 1.1], [AX + 9.5, -1, 0.85]]) solidC(oak(B, M, x, 0, z, { s, seed: x * 3 + z }));
    // hedges along the campus edges
    hedge(B, M, 3.2, -10, 3.2, -46);
    hedge(B, M, AX + 7.4, -6.5, AX + 7.4, -9.5);
  }

  // ---- the entry: the carved sign wall (left), the wayfinding post, bench and bin (right)
  const entry = {};
  {
    const z = CAMPUS.walkZ[0] - 1.0, x = AX - 6.6, id = farId(0.37);
    const put = at(B, x, 0, z);
    put(boxG(5.6, 0.5, 1.0, 0, 0, 0), M.stone, id);
    put(boxG(5.2, 1.5, 0.8, 0, 0.5, 0), M.stucco, id);
    put(boxG(5.5, 0.18, 0.95, 0, 2.0, 0), M.trim, id);
    const g = new THREE.PlaneGeometry(4.6, 1.72); g.translate(0, 1.27, 0.405); put(g, mats.sign, id + 0.01);
    shrubs(B, M, x - 2.7, z + 1.0, x + 2.7, z + 1.0, 0, { seed: 31 });
    solidBox(x - 2.9, x + 2.9, z - 0.6, z + 1.4);
    entry.sign = { x, z: z + 2.1, prompt: [x, 2.6, z + 0.5] };
    solidC(lamp(B, M, x + 3.4, 0, z + 0.2, { banner: true, h: 4.2 }));
    // the wayfinding post
    const wx = AX + 5.4, wz = z + 1.2;
    const wp = at(B, wx, 0, wz, -0.25);
    wp(boxG(0.14, 3.0, 0.14, -0.62, 0, 0), M.iron, id + 0.02);
    const sg = new THREE.BoxGeometry(1.25, 0.98, 0.06); sg.translate(0, 2.2, 0.05);
    wp(sg, [M.iron, M.iron, M.iron, M.iron, mats.wayfinding, M.iron], id + 0.03);
    solidC({ x: wx, z: wz, r: 0.4 });
    solidC(bench(B, M, AX + 6.4, 0, z - 2.2, Math.PI / 2)); // facing the walk
    solidC(bin(B, M, AX + 5.9, 0, z - 0.4));
    entry.bench = { x: AX + 6.4, z: z - 2.2 };
  }
  // ---- the café under the first east arcade: tables with umbrellas
  {
    for (const [x, z] of [[AX + 7.6, -16], [AX + 7.8, -24]]) {
      const id = farId(Math.abs(Math.sin(z)));
      B.add(cylG(0.5, 0.5, 0.05, x, 0.74, z, 18), M.wood, id);
      B.add(cylG(0.04, 0.04, 2.3, x, 0, z, 6), M.iron, id);
      B.add(cylG(0.25, 0.3, 0.05, x, 0, z, 12), M.iron, id);
      const c = new THREE.ConeGeometry(1.4, 0.55, 8, 1, true); c.translate(x, 2.45, z); B.add(c, mats.umbrella, id + 0.01);
      for (const a of [0, Math.PI]) { const cx = x + Math.cos(a) * 0.85, cz = z + Math.sin(a) * 0.85; B.add(boxG(0.4, 0.04, 0.4, cx, 0.45, cz), M.wood, id); for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) B.add(cylG(0.015, 0.015, 0.45, cx + dx, 0, cz + dz, 4), M.iron, id); }
      colliders.push({ type: 'circle', x, z, r: 1.3 });
    }
  }

  const meshes = B.flush(root, { cast: true, receive: true });
  return { colliders, blockers, entry, meshes };
}
