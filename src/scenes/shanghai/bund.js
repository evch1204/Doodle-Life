import * as THREE from 'three';
import { ink } from '../../ink.js';
import { makeRng } from '../../sketch.js';
import * as TX from '../../shanghaiTextures.js';
import { Batch, farId } from '../kit.js';

// The old Bund across the road from the promenade: granite banks and hotels
// built from one kit (a rusticated arcade, recessed windows with surrounds and
// hoods, giant columns, quoins, a bracketed cornice and a balustrade), each
// front cut with real openings so it keeps its depth from any angle. The
// signature crowns sit where the walk can see them: the Customs House clock
// tower straight behind the start, the HSBC dome to its south, the Peace Hotel
// pyramid and the Bank of China's hipped roof to the north across Nanjing Road.
//
// x runs south (+) to north (-); the fronts face the river (-z) on z = zF.

const FH = 3.7; // floor height

export function buildBund(root, { zF, groundY: Y }) {
  const r = makeRng(91);
  const M = {
    stone: ink({ map: TX.ashlarTexture(), tri: 1 / 2.4, mapAmt: 0.22, tone: 0.97, facing: 0.4, hatchFreq: 4 }),
    rustic: ink({ map: TX.rusticTexture(), tri: 1 / 2, mapAmt: 0.6, tone: 0.93, facing: 0.4, hatchFreq: 4 }),
    trim: ink({ tone: 0.99, facing: 0.55, hatchFreq: 4 }),
    plinth: ink({ tone: 0.6, facing: 0.4, hatchFreq: 4 }),
    glass: ink({ map: TX.sashTexture(405), mapAmt: 0.85, facing: 0.1, hatch: 0 }),
    glassDeco: ink({ map: TX.sashTexture(406, { kind: 'deco' }), mapAmt: 0.85, facing: 0.1, hatch: 0 }),
    door: ink({ map: TX.doorTexture(), mapAmt: 0.9, facing: 0.1, hatch: 0 }),
    dark: ink({ tone: 0.3, facing: 0.2, hatch: 0 }),
    roof: ink({ tone: 0.84, facing: 0.5, hatchFreq: 3 }),
    copper: ink({ map: TX.seamTexture(), repeat: [4, 1], mapAmt: 0.55, tone: 0.55, facing: 0.6, hatchFreq: 3 }),
    tiles: ink({ map: TX.seamTexture(412), repeat: [6, 2], mapAmt: 0.5, tone: 0.42, facing: 0.6, hatchFreq: 3 }),
    dome: ink({ map: TX.domeTexture(), mapAmt: 0.65, tone: 0.62, facing: 0.6, hatchFreq: 3 }),
    clock: ink({ map: TX.clockTexture(), facing: 0.1, hatch: 0 }),
    balus: ink({ map: TX.balusterTexture(), mapAmt: 0.85, facing: 0.3, hatchFreq: 4 }),
    side: ink({ map: TX.cityTexture('side', 451), mapAmt: 0.5, tone: 0.97, facing: 0.45, hatchFreq: 4 }),
    leaf: ink({ tone: 0.97, facing: 0.6, hatchFreq: 3 }),
    trunk: ink({ tone: 0.5, facing: 0.5, hatchFreq: 3 }),
    // the taller city behind the Bund (Puxi), lighter so the fronts stand forward
    back: [['curtain', 461], ['punched', 463], ['ribbon', 465], ['resi', 467]].map(([k, s]) => ink({ map: TX.cityTexture(k, s), mapAmt: 0.4, tone: 0.98, facing: 0.35, hatchFreq: 1.2 })),
    backRoof: ink({ tone: 0.88, facing: 0.4, hatchFreq: 1.2 }),
  };
  const B = new Batch();
  const id = () => farId(r());

  // ---- small pieces ---------------------------------------------------------------
  const glassPane = (x, y, w, h, z, mat) => {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY(Math.PI);
    g.translate(x, y + h / 2, z);
    B.add(g, mat, glassId);
  };
  let glassId = 0.5;
  const archPath = (p, x, y, w, h) => {
    const rr = w / 2, ys = y + h - rr;
    p.moveTo(x - rr, y); p.lineTo(x + rr, y); p.lineTo(x + rr, ys);
    p.absarc(x, ys, rr, 0, Math.PI, false);
    p.lineTo(x - rr, y);
  };
  const rectPath = (p, x, y, w, h) => { p.moveTo(x - w / 2, y); p.lineTo(x + w / 2, y); p.lineTo(x + w / 2, y + h); p.lineTo(x - w / 2, y + h); p.lineTo(x - w / 2, y); };
  // a wall slab from x0..x1, y0..y1 with real openings, its back on zBack, t thick
  function skin(x0, x1, y0, y1, holes, t, zBack, mat, sid) {
    const sh = new THREE.Shape();
    rectPath(sh, (x0 + x1) / 2, y0, x1 - x0, y1 - y0);
    for (const h of holes) {
      const p = new THREE.Path();
      if (h.arch) archPath(p, h.x, h.y, h.w, h.h); else rectPath(p, h.x, h.y, h.w, h.h);
      sh.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, zBack - t);
    B.add(g, mat, sid);
  }
  // a triangular (or segmental) pediment, front face on zFront
  function pediment(x, y, w, h, d, zFront, mat, pid, seg = false) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0);
    if (seg) s.quadraticCurveTo(0, h * 2, -w / 2, 0); else { s.lineTo(0, h); s.lineTo(-w / 2, 0); }
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 });
    g.translate(x, y, zFront);
    B.add(g, mat, pid);
  }
  // window surround on a wall face at zFace: architrave, sill, and a hood
  function surround(h, zFace, sid, hood) {
    const fw = 0.2, fp = 0.09, z = zFace - fp / 2;
    B.box(h.w + 2 * fw, fw, fp, h.x, h.y + h.h, z, M.trim, sid);
    B.box(fw, h.h, fp, h.x - h.w / 2 - fw / 2, h.y, z, M.trim, sid);
    B.box(fw, h.h, fp, h.x + h.w / 2 + fw / 2, h.y, z, M.trim, sid);
    B.box(h.w + 0.55, 0.15, 0.24, h.x, h.y - 0.15, zFace - 0.12, M.trim, sid);
    const top = h.y + h.h + fw;
    if (hood === 'cornice') B.box(h.w + 0.75, 0.2, 0.3, h.x, top + 0.04, zFace - 0.15, M.trim, sid);
    else if (hood === 'tri' || hood === 'seg') {
      B.box(h.w + 0.75, 0.16, 0.3, h.x, top + 0.04, zFace - 0.15, M.trim, sid);
      pediment(h.x, top + 0.2, h.w + 0.75, 0.55, 0.3, zFace - 0.3, M.trim, sid, hood === 'seg');
    }
  }
  // a column (base, tapering shaft, capital) standing on y0, capital top at y1
  function column(x, y0, y1, zc, rr, cid, sid) {
    B.box(rr * 2.7, 0.32, rr * 2.7, x, y0, zc, M.trim, sid);
    B.cyl(rr * 1.12, rr * 1.25, 0.26, x, y0 + 0.32, zc, M.trim, sid, { seg: 18 });
    B.cyl(rr * 0.86, rr, y1 - y0 - 1.18, x, y0 + 0.58, zc, M.trim, cid, { seg: 18 });
    B.cyl(rr * 1.3, rr * 0.88, 0.34, x, y1 - 0.6, zc, M.trim, sid, { seg: 18 });
    B.box(rr * 2.8, 0.26, rr * 2.8, x, y1 - 0.26, zc, M.trim, sid);
  }
  const finial = (x, y, z, h = 3) => { B.cyl(0.35, 0.5, 0.6, x, y, z, M.trim, id(), { seg: 10 }); B.cyl(0.06, 0.1, h, x, y + 0.6, z, M.dark, id(), { seg: 6 }); };
  const flag = (x, y, z) => {
    B.cyl(0.06, 0.09, 6, x, y, z, M.dark, id(), { seg: 6 });
    const g = new THREE.PlaneGeometry(2.2, 1.4); g.translate(x - 1.1, y + 5.2, z);
    B.add(g, M.dark, id());
  };
  // flat arched recess panels on one face of a tower (belfry / tower windows)
  function archPanels(cx, y, zc, half, n, w, h, ry) {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(cx, 0, zc);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Shape();
      archPath(s, (i - (n - 1) / 2) * (w + 0.9), y, w, h);
      const g = new THREE.ShapeGeometry(s, 8);
      g.rotateY(Math.PI);
      g.translate(0, 0, -half - 0.03);
      B.geo(g, M.dark, glassId, m);
    }
  }

  // ---- crowns -----------------------------------------------------------------------
  const crowns = {
    // Customs House: square shaft with arched recesses, a clock on each face,
    // an open belfry with corner columns, a stepped cap and a flag
    clock(b) {
      const cx = b.cx, zc = zF + 6.5, s0 = 9.6;
      let y = b.top;
      const tid = id(), cid = id();
      B.box(s0, 9, s0, cx, y, zc, M.stone, tid, { top: M.roof });
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(1.0, 9, 1.0, cx + dx * (s0 / 2 - 0.4), y, zc + dz * (s0 / 2 - 0.4), M.trim, cid);
      for (let k = 0; k < 4; k++) archPanels(cx, y + 1.2, zc, s0 / 2, 2, 2.0, 6.2, (k * Math.PI) / 2);
      y += 9;
      B.box(s0 + 1.1, 0.7, s0 + 1.1, cx, y, zc, M.trim, cid);
      y += 0.7;
      const s1 = s0 - 1.4;
      B.box(s1, 7.2, s1, cx, y, zc, M.stone, tid, { top: M.roof });
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Matrix4().makeRotationY((k * Math.PI) / 2).setPosition(cx, y + 3.7, zc);
        const ring = new THREE.CylinderGeometry(3.0, 3.0, 0.2, 40); ring.rotateX(Math.PI / 2); ring.translate(0, 0, -s1 / 2 - 0.1);
        B.geo(ring, M.trim, cid, m);
        const face = new THREE.CylinderGeometry(2.55, 2.55, 0.2, 40); face.rotateX(Math.PI / 2); face.translate(0, 0, -s1 / 2 - 0.3);
        B.geo(face, [M.dark, M.clock, M.clock], glassId + 0.02, m);
      }
      y += 7.2;
      B.box(s1 + 0.9, 0.6, s1 + 0.9, cx, y, zc, M.trim, cid);
      y += 0.6;
      const s2 = s0 - 3.2;
      B.box(s2, 5, s2, cx, y, zc, M.stone, tid, { top: M.roof });
      for (let k = 0; k < 4; k++) archPanels(cx, y + 0.6, zc, s2 / 2, 2, 1.5, 3.8, (k * Math.PI) / 2);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) column(cx + dx * (s2 / 2 + 0.2), y, y + 5, zc + dz * (s2 / 2 + 0.2), 0.32, cid, cid);
      y += 5;
      B.box(s2 + 1.4, 0.6, s2 + 1.4, cx, y, zc, M.trim, cid);
      y += 0.6;
      B.box(s2 - 0.6, 1.2, s2 - 0.6, cx, y, zc, M.stone, tid);
      y += 1.2;
      const py = new THREE.ConeGeometry((s2 - 0.6) * 0.72, 4.6, 4); py.rotateY(Math.PI / 4); py.translate(cx, y + 2.3, zc);
      B.add(py, M.copper, id());
      flag(cx, y + 4.4, zc);
    },
    // HSBC: a ribbed dome on a colonnaded drum, set back behind the front, with a lantern
    dome(b) {
      const cx = b.cx, zc = zF + 10, R = 7.2;
      let y = b.top + 0.2;
      const did = id(), cid = id();
      B.box(2 * R + 4, 2.2, 2 * R + 4, cx, y, zc, M.stone, did, { top: M.roof });
      y += 2.2;
      B.cyl(R + 1.4, R + 1.4, 0.45, cx, y, zc, M.trim, cid, { seg: 40 });
      B.cyl(R + 0.2, R + 0.2, 4.4, cx, y, zc, M.stone, did, { seg: 40, top: M.roof });
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; column(cx + Math.cos(a) * (R + 0.85), y + 0.45, y + 4.2, zc + Math.sin(a) * (R + 0.85), 0.24, cid, cid); }
      y += 4.4;
      B.cyl(R + 1.45, R + 1.45, 0.75, cx, y - 0.2, zc, M.trim, cid, { seg: 40 });
      y += 0.55;
      const dm = new THREE.SphereGeometry(R, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      dm.scale(1, 0.95, 1); dm.translate(cx, y, zc);
      B.add(dm, M.dome, id());
      y += R * 0.95 - 0.4;
      B.cyl(1.2, 1.3, 2.4, cx, y, zc, M.trim, cid, { seg: 16 });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B.cyl(0.12, 0.12, 2.0, cx + Math.cos(a) * 1.35, y + 0.2, zc + Math.sin(a) * 1.35, M.trim, did, { seg: 6 }); }
      const ld = new THREE.SphereGeometry(1.45, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); ld.translate(cx, y + 2.4, zc);
      B.add(ld, M.dome, id());
      finial(cx, y + 3.7, zc, 2.2);
    },
    // Peace Hotel: a two-storey tower over the Nanjing Road corner under a steep copper pyramid
    pyramid(b) {
      const cx = b.towerX ?? b.cx, zc = zF + 6.2, tw = 11;
      let y = b.top;
      const tid = id(), pid = id();
      B.box(tw, 7.6, tw, cx, y, zc, M.stone, tid, { top: M.roof });
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Matrix4().makeRotationY((k * Math.PI) / 2).setPosition(cx, 0, zc);
        for (let i = -1; i <= 1; i++) for (let f = 0; f < 2; f++) {
          const g = new THREE.PlaneGeometry(1.7, 2.6); g.rotateY(Math.PI); g.translate(i * 3.1, y + 0.6 + f * 3.6 + 1.3, -tw / 2 - 0.03);
          B.geo(g, M.glassDeco, glassId, m);
        }
        for (let i = 0; i < 4; i++) { const g = new THREE.BoxGeometry(0.5, 8.2, 0.35); g.translate((i - 1.5) * 3.1, y + 4.1, -tw / 2 - 0.17); B.geo(g, M.trim, pid, m); }
      }
      y += 7.6;
      B.box(tw + 1.0, 0.6, tw + 1.0, cx, y, zc, M.trim, pid);
      y += 0.6;
      const py = new THREE.ConeGeometry((tw + 0.6) * 0.707, 11, 4, 1); py.rotateY(Math.PI / 4); py.translate(cx, y + 5.5, zc);
      B.add(py, M.copper, id());
      finial(cx, y + 10.6, zc, 3.2);
    },
    // Bank of China: a central tower rising from the wings under a Chinese
    // hipped roof with flared eaves, its frieze carved with a lattice band
    hip(b) {
      const cx = b.cx, zc = zF + 7, tw = 13, nT = 4;
      let y = b.top;
      const tid = id(), pid = id();
      B.box(tw, nT * FH, tw, cx, y, zc, M.stone, tid, { top: M.roof });
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Matrix4().makeRotationY((k * Math.PI) / 2).setPosition(cx, 0, zc);
        for (let i = -1; i <= 1; i++) for (let f = 0; f < nT; f++) {
          const g = new THREE.PlaneGeometry(1.6, 2.5); g.rotateY(Math.PI); g.translate(i * 3.6, y + f * FH + 0.6 + 1.25, -tw / 2 - 0.03);
          B.geo(g, M.glassDeco, glassId, m);
        }
        for (let i = 0; i < 4; i++) { const g = new THREE.BoxGeometry(0.55, nT * FH + 0.4, 0.4); g.translate((i - 1.5) * 3.6, y + (nT * FH + 0.4) / 2, -tw / 2 - 0.2); B.geo(g, M.trim, pid, m); }
      }
      y += nT * FH;
      B.box(tw + 0.6, 1.1, tw + 0.6, cx, y, zc, M.trim, pid);
      y += 1.1;
      // the roof: a concave four-sided sweep from wide eaves up to a short ridge cap
      const rc = (tw / 2 + 1.8) * Math.SQRT2;
      const prof = [[0.01, 9.6], [rc * 0.12, 9.2], [rc * 0.3, 7.0], [rc * 0.52, 4.4], [rc * 0.78, 1.9], [rc * 0.97, 0.45], [rc * 1.03, 0.75], [rc * 0.9, -0.1]].reverse()
        .map(([px, py]) => new THREE.Vector2(px, py));
      const roof = new THREE.LatheGeometry(prof, 4);
      roof.rotateY(Math.PI / 4); roof.translate(cx, y, zc);
      B.add(roof, M.tiles, id());
      B.cyl(0.25, 0.5, 2.6, cx, y + 9.3, zc, M.dark, id(), { seg: 8 });
    },
    // a small domed cupola on columns, centred
    cupola(b) {
      const cx = b.cx, zc = zF + 4.5;
      let y = b.top + 0.3;
      const cid = id();
      B.box(5.6, 1.2, 5.6, cx, y, zc, M.stone, id(), { top: M.roof });
      y += 1.2;
      B.cyl(2.1, 2.1, 3.2, cx, y, zc, M.dark, id(), { seg: 20 });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; column(cx + Math.cos(a) * 2.35, y, y + 3.2, zc + Math.sin(a) * 2.35, 0.2, cid, cid); }
      y += 3.2;
      B.cyl(2.8, 2.8, 0.45, cx, y, zc, M.trim, cid, { seg: 24 });
      const dm = new THREE.SphereGeometry(2.5, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2); dm.scale(1, 1.15, 1); dm.translate(cx, y + 0.45, zc);
      B.add(dm, M.dome, id());
      finial(cx, y + 3.2, zc, 1.8);
    },
    // a domed turret over each end bay
    turrets(b) {
      for (const tx of [b.xa + 2.6, b.xb - 2.6]) {
        const zc = zF + 2.6;
        let y = b.top;
        const tid = id();
        B.box(4.4, 4.6, 4.4, tx, y, zc, M.stone, tid, { top: M.roof });
        archPanels(tx, y + 0.8, zc, 2.2, 1, 1.5, 2.9, 0);
        y += 4.6;
        B.box(5.0, 0.45, 5.0, tx, y, zc, M.trim, id());
        const dm = new THREE.SphereGeometry(2.1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2); dm.scale(1, 1.3, 1); dm.translate(tx, y + 0.45, zc);
        B.add(dm, M.dome, id());
        finial(tx, y + 3.0, zc, 1.6);
      }
    },
    // a triangular pediment over the middle three bays
    pediment(b) {
      const w = Math.min(b.w * 0.55, b.bw * 3 + 1.4);
      const pid = id();
      pediment(b.cx, b.top - 0.1, w + 0.9, w * 0.24 + 0.3, 1.4, zF - b.tu - 1.2, M.trim, pid);
      pediment(b.cx, b.top + 0.25, w - 0.6, w * 0.24 - 0.5, 1.2, zF - b.tu - 1.0, M.stone, id());
    },
    // a steep slate mansard with a dormer over each bay
    mansard(b) {
      const s = new THREE.Shape();
      const D = 14, h = 4.4;
      s.moveTo(0, 0); s.lineTo(-D, 0); s.lineTo(-D + 1.2, h); s.lineTo(-2.6, h); s.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: b.w - 1.2, bevelEnabled: false });
      g.rotateY(Math.PI / 2);
      g.translate(b.xa + 0.6, b.top - 0.1, zF + 0.6);
      B.add(g, [M.tiles, M.tiles], id());
      for (const x of b.xs) {
        const did = id();
        B.box(1.5, 1.9, 1.6, x, b.top + 0.5, zF + 1.6, M.stone, did, { top: M.roof });
        pediment(x, b.top + 2.4, 1.9, 0.75, 1.7, zF + 0.75, M.trim, did);
        glassPane(x, b.top + 0.75, 0.9, 1.35, zF + 0.77, M.glass);
      }
    },
  };

  // ---- one building -------------------------------------------------------------------
  function building(s) {
    const { xa, xb } = s, w = xb - xa, cx = (xa + xb) / 2;
    const lod = Math.abs(cx) > 115; // seen only at a glancing angle from the walk: fewer lines
    const nF = s.floors, baseF = s.base ?? 1, deco = s.style === 'deco';
    const H = nF * FH, D = 24;
    const wid = id(), fid = id(), cid = id();
    glassId = id();
    // bays: an odd number, so there is a middle bay for the door
    const end = deco ? 1.0 : 1.5, inner = w - 2 * end;
    let n = Math.max(3, Math.round(inner / (s.bay ?? 3.4)));
    if (n % 2 === 0) n += inner / n > (s.bay ?? 3.4) ? 1 : -1;
    const bw = inner / n, mid = (n - 1) / 2;
    const xs = Array.from({ length: n }, (_, i) => xa + end + (i + 0.5) * bw);
    const tb = 0.5, tu = 0.3;
    const yB = Y + baseF * FH;
    // colonnade: [half-width in bays about the middle, first floor, last floor]
    const col = s.colonnade && [Math.max(0, mid - s.colonnade[0]), Math.min(n - 1, mid + s.colonnade[0]), s.colonnade[1], s.colonnade[2]];
    const inCol = (i, f) => col && i >= col[0] && i <= col[1] && f >= col[2] && f <= col[3];

    // the core (glass sits on its face); alley sides carry plain windows
    B.box(w, H, D, cx, Y, zF + D / 2, M.stone, wid, { side: M.side, top: M.roof, bay: 3.4, floor: FH });
    B.box(w, 0.75, tb + 0.18, cx, Y, zF - (tb + 0.18) / 2, M.plinth, cid);

    // base: an arcade (or deco shopfronts) in rusticated stone
    const baseHoles = [];
    for (let i = 0; i < n; i++) {
      const door = i === mid;
      if (deco) baseHoles.push({ x: xs[i], y: Y + 0.8, w: bw * (door ? 0.62 : 0.68), h: FH * (door ? 0.86 : 0.74) - 0.8, door });
      else baseHoles.push({ x: xs[i], y: Y + 0.8, w: bw * (door ? 0.66 : 0.54), h: FH * 0.93 - 0.8, arch: true, door });
      for (let f = 1; f < baseF; f++) baseHoles.push({ x: xs[i], y: Y + f * FH + FH * 0.24, w: bw * 0.4, h: FH * 0.5 });
    }
    skin(xa, xb, Y + 0.75, yB, baseHoles, tb, zF, deco ? M.stone : M.rustic, wid);
    for (const h of baseHoles) {
      glassPane(h.x, h.y, h.w, h.h, zF - 0.02, h.arch ? M.door : deco && h.y < Y + FH ? M.glassDeco : M.glass);
      if (h.arch) B.box(0.5, 0.75, tb + 0.12, h.x, h.y + h.h - 0.62, zF - (tb + 0.12) / 2, M.trim, fid); // keystone
      if (h.door) for (let k = 0; k < 3; k++) B.box(h.w + 1.4 - k * 0.4, 0.17, 0.5 + (2 - k) * 0.42, h.x, Y + k * 0.17, zF - tb - 0.18 - (2 - k) * 0.21, M.plinth, cid + 0.01);
    }
    // string course over the base
    B.box(w + 0.2, 0.36, tb + 0.3, cx, yB - 0.18, zF - (tb + 0.3) / 2, M.trim, cid);

    // upper floors: recessed windows in surrounds, hoods by floor
    const holes = [], pieces = [];
    for (let f = baseF; f < nF; f++) for (let i = 0; i < n; i++) {
      if (inCol(i, f)) continue;
      const top = f === nF - 1 && nF >= 5 && !deco;
      const ww = bw * (deco ? 0.56 : 0.44), wh = FH * (deco ? 0.68 : top ? 0.4 : 0.56);
      const h = { x: xs[i], y: Y + f * FH + (FH - wh) * (top ? 0.5 : 0.4), w: ww, h: wh };
      holes.push(h);
      if (!deco) pieces.push([h, f === baseF ? (i % 2 ? 'seg' : 'tri') : top ? null : f === baseF + 1 ? 'cornice' : null]);
    }
    let zoneHole = null;
    if (col) {
      const x0 = xs[col[0]] - bw / 2, x1 = xs[col[1]] + bw / 2;
      zoneHole = { x: (x0 + x1) / 2, y: Y + col[2] * FH + 0.1, w: x1 - x0, h: (col[3] - col[2] + 1) * FH - 1.1 };
    }
    skin(xa, xb, yB, Y + H, zoneHole ? [...holes, zoneHole] : holes, tu, zF, M.stone, wid);
    for (const h of holes) glassPane(h.x, h.y, h.w, h.h, zF - 0.02, deco ? M.glassDeco : M.glass);
    for (const [h, hood] of pieces) {
      if (!lod) surround(h, zF - tu, fid, hood);
      else B.box(h.w + 0.5, 0.15, 0.24, h.x, h.y - 0.15, zF - tu - 0.12, M.trim, fid);
    }

    // giant order: columns standing forward of a recessed loggia, windows on its back wall
    if (col) {
      const zc = zF - tu - 0.85, rr = Math.min(0.55, bw * 0.15), y0 = zoneHole.y - 0.1, y1 = Y + (col[3] + 1) * FH - 0.95;
      B.box(zoneHole.w + 1.2, 0.45, 1.9, zoneHole.x, y0 - 0.45, zF - tu - 0.95 + 0.0, M.trim, cid);
      for (let i = col[0]; i <= col[1] + 1; i++) column(xa + end + i * bw, y0, y1, zc, rr, id(), fid);
      B.box(zoneHole.w + 1.2, 0.95, 1.9, zoneHole.x, y1, zF - tu - 0.95, M.trim, cid);
      for (let i = col[0]; i <= col[1]; i++) for (let f = col[2]; f <= col[3]; f++) {
        const h = { x: xs[i], y: Y + f * FH + FH * 0.24, w: bw * 0.44, h: FH * 0.55 };
        if (h.y + h.h > y1 - 0.2) continue;
        glassPane(h.x, h.y, h.w, h.h, zF - 0.03, M.glass);
        surround(h, zF - 0.01, fid, null);
      }
      if (s.colPediment) pediment(zoneHole.x, y1 + 0.95, zoneHole.w + 1.6, (zoneHole.w + 1.6) * 0.2, 1.9, zF - tu - 1.9, M.trim, cid);
    }

    // a Doric portico before the door (Customs House)
    if (s.portico) {
      const zc = zF - tb - 2.6, y1 = Y + 2 * FH - 0.2;
      for (const k of [-1.5, -0.5, 0.5, 1.5]) column(cx + k * 2.7, Y + 0.6, y1, zc, 0.55, id(), fid);
      B.box(4 * 2.7 + 1.2, 0.6, 3.6, cx, Y, zc + 0.6, M.plinth, cid);
      B.box(4 * 2.7 + 1.0, 1.0, 3.4, cx, y1, zc + 0.55, M.trim, cid);
      pediment(cx, y1 + 1.0, 4 * 2.7 + 1.6, 2.2, 3.5, zc - 1.25, M.trim, id());
    }

    // pilasters between the bays (classic fronts) / deco piers running up past the cornice
    if (s.pilasters && !deco && !lod) for (let i = 0; i <= n; i++) {
      const x = xa + end + i * bw;
      if (col && i >= col[0] && i <= col[1] + 1) continue;
      B.box(0.55, H - (yB - Y) - 0.1, 0.15, x, yB, zF - tu - 0.075, M.trim, fid);
      B.box(0.8, 0.32, 0.26, x, Y + H - 0.42, zF - tu - 0.13, M.trim, fid);
    }
    if (deco) for (let i = 0; i <= n; i++) {
      const x = xa + end + i * bw, edge = i === 0 || i === n;
      B.box(edge ? 0.9 : 0.5, H - (yB - Y) + (edge ? 1.6 : 1.1), 0.38, x, yB, zF - tu - 0.19, M.trim, fid);
    }
    // quoins up the corners
    if (!deco && !lod) for (const [x0, sgn] of [[xa, 1], [xb, -1]]) {
      for (let y = yB + 0.05, k = 0; y < Y + H - 0.6; y += 0.62, k++) {
        const wq = k % 2 ? 0.8 : 1.25;
        B.box(wq, 0.54, 0.12, x0 + sgn * wq / 2, y, zF - tu - 0.06, M.trim, cid + 0.005);
      }
    }

    // the cornice: frieze, brackets, corona, cymatium; then a balustrade or attic
    let top = Y + H;
    if (deco) {
      B.box(w, 0.5, tu + 0.3, cx, top, zF - (tu + 0.3) / 2, M.trim, cid);
      top += 0.5;
      B.box(w - 0.4, 1.2, 0.5, cx, top, zF - tu + 0.25, M.stone, wid);
      for (const dx of [-0.25, 0.25]) B.box(w * 0.3, 0.7, 0.5, cx + dx * w * 0.5, top + 1.2, zF - tu + 0.25, M.stone, wid);
      top += 1.2;
    } else {
      B.box(w + 0.1, 0.6, tu + 0.22, cx, top, zF - (tu + 0.22) / 2, M.trim, cid);
      if (!lod) for (let x = xa + 0.6; x < xb - 0.3; x += 0.95) B.box(0.22, 0.3, 0.75, x, top + 0.6, zF - tu - 0.37, M.trim, fid);
      B.box(w + 0.5, 0.4, tu + 1.15, cx, top + 0.9, zF - (tu + 1.15) / 2, M.trim, cid);
      B.box(w + 0.7, 0.15, tu + 1.3, cx, top + 1.3, zF - (tu + 1.3) / 2, M.trim, cid);
      top += 1.45;
      if (s.attic) {
        B.box(w - 0.2, 1.8, 0.6, cx, top, zF - tu + 0.3, M.stone, wid, { top: M.trim });
        for (const x of xs) glassPane(x, top + 0.45, bw * 0.3, 0.8, zF - tu - 0.01, M.glass);
        B.box(w + 0.1, 0.25, 0.85, cx, top + 1.8, zF - tu + 0.25, M.trim, cid);
        top += 2.05;
      } else {
        const bid = id();
        B.box(w - 0.6, 1.05, 0.32, cx, top, zF - tu + 0.1, M.balus, bid, { top: M.trim, bay: 1.6, floor: 1.05, tile: 1 });
        for (let i = 0; i <= n; i++) B.box(0.5, 1.3, 0.48, xa + end + i * bw, top, zF - tu + 0.1, M.trim, cid);
      }
    }
    // roof clutter for the skyline: chimney stacks and a skylight
    for (let k = 0; k < 2; k++) {
      const x = xa + 2 + r() * (w - 4), z = zF + 8 + r() * 10;
      B.box(0.9 + r() * 0.8, 1.6 + r() * 1.4, 0.9, x, Y + H, z, M.stone, id(), { top: M.dark });
    }
    B.box(Math.min(6, w * 0.3), 1.2, 4, cx + (r() - 0.5) * w * 0.4, Y + H, zF + 16, M.roof, id());

    const b = { ...s, w, cx, xs, bw, tu, top: Y + H + (deco ? 1.7 : 1.45) };
    if (s.crown) crowns[s.crown](b);
  }

  // ---- the row, north (-x) to south (+x) --------------------------------------------
  const ROW = [
    { xa: -147, xb: -118, floors: 8, style: 'deco', crown: 'hip' },                          // Bank of China
    { xa: -116, xb: -88, floors: 9, style: 'deco', crown: 'pyramid', towerX: -95.5 },        // Sassoon House (Peace Hotel)
    // Nanjing Road
    { xa: -80, xb: -66, floors: 6, base: 1, crown: 'cupola', pilasters: true },              // Palace Hotel
    { xa: -66, xb: -56.4, floors: 6, base: 2, crown: 'pediment' },                           // No. 18
    { xa: -56.4, xb: -43, floors: 7, base: 1, crown: 'turrets' },                            // North China Daily News
    { xa: -43, xb: -31, floors: 5, base: 2, attic: true, colonnade: [1, 2, 4] },         // Russo-Chinese Bank
    { xa: -31, xb: -16, floors: 6, style: 'deco' },                                          // Bank of Communications
    // Hankou Road
    { xa: -12, xb: 16, floors: 7, base: 2, crown: 'clock', portico: true, pilasters: true }, // Customs House
    { xa: 16, xb: 60, floors: 5, base: 2, crown: 'dome', colonnade: [2, 2, 4] },         // HSBC
    // Fuzhou Road
    { xa: 65, xb: 78, floors: 6, base: 1, crown: 'mansard' },
    { xa: 78, xb: 89, floors: 5, base: 1, pilasters: true, attic: true },
    { xa: 89, xb: 103, floors: 6, base: 2, crown: 'pediment' },
    // Guangdong Road
    { xa: 108, xb: 124, floors: 7, base: 1, crown: 'turrets' },
    { xa: 124, xb: 146, floors: 6, base: 2, crown: 'cupola', colonnade: [1, 2, 4], colPediment: true }, // Shanghai Club
    { xa: 146, xb: 162, floors: 7, base: 1, crown: 'cupola', pilasters: true },
  ];
  // the Bund carries on both ways, built from the same kit
  const gen = (xa, dir, until) => {
    let x = xa;
    const CROWNS = [null, null, 'pediment', 'turrets', 'cupola', 'mansard'];
    while (dir > 0 ? x < until : x > until) {
      const w = 12 + r() * 16, deco = r() < 0.25;
      const s = { floors: 5 + Math.floor(r() * 4), base: 1 + (r() < 0.5 ? 1 : 0), style: deco ? 'deco' : 'classic', crown: deco ? null : CROWNS[Math.floor(r() * CROWNS.length)], pilasters: r() < 0.4, attic: r() < 0.3 };
      if (dir > 0) { s.xa = x; s.xb = x + w; } else { s.xa = x - w; s.xb = x; }
      ROW.push(s);
      x += dir * (w + (r() < 0.3 ? 4 + r() * 4 : 0));
    }
  };
  gen(166, 1, 330);
  gen(-151, -1, -330);
  for (const s of ROW) building(s);

  // ---- street trees in front: London planes, a few crowns each ---------------------
  for (let tx = -320; tx < 320; tx += 10 + r() * 6) {
    const tid = id();
    for (const [dx, dy, dz, rr] of [[0, 5.6, 0, 1.7], [1.2, 4.9, 0.3, 1.3], [-1.2, 5.0, -0.2, 1.35], [0.3, 6.6, -0.3, 1.1]]) {
      const g = new THREE.SphereGeometry(rr, 10, 7); g.translate(tx + dx, Y + dy, zF - 4 + dz); B.add(g, M.leaf, tid);
    }
    B.cyl(0.15, 0.25, 4.4, tx, Y, zF - 4, M.trunk, 0.4, { seg: 6 });
  }

  // ---- Puxi behind: taller blocks well back, drawn lighter ----------------------------
  {
    const placed = [];
    for (let i = 0; i < 600 && placed.length < 70; i++) {
      const x = (r() - 0.5) * 760, z = zF + 60 + r() * 220;
      const w = 16 + r() * 18, d = 16 + r() * 14;
      if (placed.some(([px, pz, pw, pd]) => Math.abs(px - x) < (pw + w) / 2 + 4 && Math.abs(pz - z) < (pd + d) / 2 + 4)) continue;
      const h = Math.round((20 + r() * 50 + (z - zF) * 0.15) / FH) * FH;
      const mat = M.back[Math.floor(r() * M.back.length)];
      const bid = id();
      B.box(w, h, d, x, Y, z, mat, bid, { top: M.backRoof, bay: 3.2, floor: FH });
      if (r() < 0.45) B.box(w * 0.66, FH * 2, d * 0.66, x, Y + h, z, mat, bid, { top: M.backRoof, bay: 3.2, floor: FH });
      else if (r() < 0.5) B.box(w * 0.3, 2.4, d * 0.3, x - w * 0.15, Y + h, z, M.backRoof, id());
      placed.push([x, z, w, d]);
    }
  }

  B.flush(root);
}
