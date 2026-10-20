import * as THREE from 'three';
import { ink } from '../../ink.js';
import { makeRng } from '../../sketch.js';
import * as TW from '../../taiwanTextures.js';
import { cityTexture } from '../../shanghaiTextures.js';
import { Batch, boldId, farId, placer } from '../kit.js';

// The view from Jiufen's lookout: the Taipei basin city and Taipei 101.
//  - Taipei 101 (about 0.39 of real size) from its real structure: the
//    notched-square plan, a tapering 25-storey base with the coin medallions
//    and ruyi on its faces, eight flaring 8-storey segments each sitting on a
//    ledge with ornaments at its corners, the stepped crown and the spire.
//    Its curtain wall carries mullions and floor lines.
//  - Taipei Nan Shan Plaza at its side, with the split crown.
//  - The city: walk-ups with caged windows, rooftop sheds and water tanks,
//    office towers with curtain walls and crowns, in three levels of detail.

const FL = 3.2, BAY = 3.2;
const far = (o) => ink({ facing: 0.5, hatchFreq: 0.4, tone: 1, ...o });

export function buildTaipei(root, { L, dirAt, az101, dist101, baseY }) {
  const cr = makeRng(4242);
  const B = new Batch();
  const [tx, tz] = dirAt(az101);
  const towerX = L.x + tx * dist101, towerZ = L.z + tz * dist101;
  const KINDS = { walkup: ['cage', 'resi', 'cage', 'punched'], office: ['curtain', 'ribbon', 'grid', 'fins'] };
  const mats = (band, amt, tone, hf) => Object.fromEntries(Object.entries(KINDS).map(([k, list]) => [k, list.map((kind, i) => far({ map: cityTexture(kind, 801 + i * 3 + (band.length * 7)), mapAmt: amt, tone, facing: 0.45, hatchFreq: hf }))]));
  const M = {
    near: mats('near', 0.6, 0.98, 0.6),
    mid: mats('mid', 0.48, 0.99, 0.45),
    far: mats('far-away', 0.34, 1, 0.3),
    roof: far({ tone: 0.88, facing: 0.4 }),
    shed: far({ map: TW.corrugatedTexture(), repeat: [3, 1], mapAmt: 0.5, tone: 0.8, facing: 0.5 }),
    tank: far({ tone: 0.7, facing: 0.5, hatch: 0 }),
    mast: far({ tone: 0.35, hatch: 0 }),
    trim: far({ tone: 0.9, facing: 0.5 }),
    // Taipei 101
    glass: far({ map: TW.t101Texture(), mapAmt: 0.62, tone: 0.98, facing: 0.6, hatchFreq: 0.45 }),
    ledge: far({ tone: 0.72, facing: 0.45, hatch: 0 }),
    stone: far({ tone: 0.95, facing: 0.55, hatchFreq: 0.45 }),
    orn: far({ tone: 0.86, facing: 0.4, hatch: 0 }),
    spire: far({ tone: 0.9, facing: 0.6, hatchFreq: 0.45 }),
    nanshan: far({ map: cityTexture('curtain', 851), mapAmt: 0.55, tone: 0.98, facing: 0.6, hatchFreq: 0.45 }),
  };

  // ---- the city ---------------------------------------------------------------------
  function building(x, z, w, d, h, band, kind) {
    const id = farId(cr());
    const list = M[band][kind];
    const fac = list[Math.floor(cr() * list.length)];
    const uv = { bay: BAY, floor: FL };
    h = Math.max(FL * 4, Math.round(h / FL) * FL);
    let tw = w, td = d, top = h;
    if (kind === 'office' && h > 55 && cr() < 0.45) {
      // setbacks
      const h1 = Math.round((h * 0.7) / FL) * FL, h2 = h - h1;
      B.box(w, h1, d, x, baseY, z, fac, id, { top: M.roof, ...uv });
      B.box(w * 0.74, h2, d * 0.74, x, baseY + h1, z, fac, id, { top: M.roof, ...uv });
      tw = w * 0.74; td = d * 0.74;
    } else {
      B.box(w, h, d, x, baseY, z, fac, id, { top: M.roof, ...uv });
    }
    const y = baseY + top;
    if (band === 'far') return;
    if (kind === 'walkup') {
      // the rooftop clutter of a Taipei walk-up: an iron shed, water tanks on a stand
      if (cr() < 0.7) {
        const sw = tw * (0.4 + cr() * 0.35), sd = td * (0.4 + cr() * 0.3);
        B.box(sw, 2.6, sd, x + (cr() - 0.5) * (tw - sw), y, z + (cr() - 0.5) * (td - sd), M.shed, farId(cr()), { top: M.shed });
      }
      for (let k = 0; k < 1 + Math.floor(cr() * 2); k++) {
        const px = x + (cr() - 0.5) * tw * 0.6, pz = z + (cr() - 0.5) * td * 0.6;
        B.box(2.2, 1.0, 2.2, px, y, pz, M.mast, farId(cr()));
        B.cyl(1.0, 1.0, 2.0, px, y + 1.0, pz, M.tank, farId(cr()), { seg: 10 });
      }
    } else {
      const k = cr();
      if (k < 0.35) {
        // a lit crown frame
        const cid = farId(cr());
        for (const [fw, fd, fx, fz] of [[tw + 0.6, 0.5, 0, -td / 2], [tw + 0.6, 0.5, 0, td / 2], [0.5, td, -tw / 2, 0], [0.5, td, tw / 2, 0]]) B.box(fw, 4, fd, x + fx, y, z + fz, M.trim, cid);
      } else if (k < 0.6) {
        B.box(tw * 0.5, FL * 2, td * 0.5, x, y, z, fac, id, { top: M.roof, ...uv });
        B.cyl(0.25, 0.45, h * 0.12, x, y + FL * 2, z, M.mast, farId(cr()), { seg: 5 });
      } else if (k < 0.8) {
        B.box(tw * 0.45, 3, td * 0.4, x - tw * 0.15, y, z, M.tank, farId(cr()), { top: M.roof });
      }
    }
  }
  // blocks in the basin; heights rise toward 101 but stay clearly below it
  const placed = [];
  const free = (x, z, w, d, gap) => !placed.some(([px, pz, pw, pd]) => Math.abs(px - x) < (pw + w) / 2 + gap && Math.abs(pz - z) < (pd + d) / 2 + gap);
  for (let i = 0; i < 4000 && placed.length < 300; i++) {
    const az = -70 + cr() * 140, dist = 470 + cr() * 560;
    const [dx, dz] = dirAt(az);
    const x = L.x + dx * dist, z = L.z + dz * dist;
    const near101 = Math.hypot(x - towerX, z - towerZ);
    const w = 12 + cr() * 18, d = 12 + cr() * 16;
    if (near101 < 42 || !free(x, z, w, d, 3 + dist * 0.004)) continue;
    const pull = Math.exp(-((near101 / 220) ** 2));
    let h = 20 + cr() * 22 + pull * cr() * 32;
    if (cr() < 0.06) h += 25 + cr() * 20;
    h = Math.min(h, 92);
    // in front of 101 (seen from the lookout) only low blocks: keep its base in view
    const azT = Math.abs(az - az101);
    if (azT < 2.6 && dist < dist101) h = Math.min(h, 34);
    const band = dist < 640 ? 'near' : dist < 860 ? 'mid' : 'far';
    building(x, z, w, d, h, band, h > 48 || (h > 36 && cr() < 0.3) ? 'office' : 'walkup');
    placed.push([x, z, w, d]);
  }

  // ---- Taipei 101 -------------------------------------------------------------------
  const put = placer(B, towerX, baseY, towerZ, Math.atan2(L.x - towerX, L.z - towerZ));
  // the plan: a square whose corners step in twice (the "sawtooth" corners)
  const plan = (s) => {
    const k = s * 0.085, q = [[s, s - 2 * k], [s - k, s - 2 * k], [s - k, s - k], [s - 2 * k, s - k], [s - 2 * k, s]];
    const P = [];
    for (let r = 0; r < 4; r++) for (const [x, z] of q) { let a = x, b = z; for (let t = 0; t < r; t++) [a, b] = [-b, a]; P.push([a, b]); }
    return P;
  };
  // a flaring (or tapering) prism on that plan, sB at the bottom, sT at the top;
  // u counts bays round the perimeter, v floors up (4 x 4 per texture tile)
  const BAYW = 1.5, FLH = 1.68;
  function prism(sB, sT, y0, h, mat, id, { caps = 'top' } = {}) {
    const pB = plan(sB), pT = plan(sT), n = pB.length;
    const pos = [], uv = [];
    let uB = 0, uT = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const lB = Math.hypot(pB[j][0] - pB[i][0], pB[j][1] - pB[i][1]), lT = Math.hypot(pT[j][0] - pT[i][0], pT[j][1] - pT[i][1]);
      const b0 = [pB[i][0], y0, pB[i][1]], b1 = [pB[j][0], y0, pB[j][1]], t0 = [pT[i][0], y0 + h, pT[i][1]], t1 = [pT[j][0], y0 + h, pT[j][1]];
      const ub0 = uB / BAYW / 4, ub1 = (uB + lB) / BAYW / 4, ut0 = uT / BAYW / 4, ut1 = (uT + lT) / BAYW / 4;
      const v0 = y0 / FLH / 4, v1 = (y0 + h) / FLH / 4;
      pos.push(...b0, ...t1, ...b1, ...b0, ...t0, ...t1);
      uv.push(ub0, v0, ut1, v1, ub1, v0, ub0, v0, ut0, v1, ut1, v1);
      uB += lB; uT += lT;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    put(g, mat, id);
    const cap = (P, y, up) => {
      const sh = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
      const c = new THREE.ShapeGeometry(sh);
      c.rotateX(-Math.PI / 2);
      if (!up) c.rotateX(Math.PI);
      c.translate(0, y, 0);
      put(c, mat === M.glass ? M.ledge : mat, id);
    };
    if (caps === 'top' || caps === 'both') cap(pT, y0 + h, true);
    if (caps === 'both') cap(pB, y0, false);
  }
  const ledge = (s, y, id, t = 0.55) => prism(s, s, y, t, M.ledge, id, { caps: 'both' });
  // a ruyi head: three lobes over a pointed chin, extruded
  const ruyiGeo = (sc, depth) => {
    const s = new THREE.Shape();
    s.moveTo(0, -1.0);
    s.quadraticCurveTo(0.55, -0.55, 0.62, -0.05);
    s.absarc(0.55, 0.25, 0.32, -Math.PI / 2, Math.PI * 0.8, false);
    s.absarc(0, 0.55, 0.36, -0.1, Math.PI + 0.1, false);
    s.absarc(-0.55, 0.25, 0.32, Math.PI * 0.2, Math.PI * 1.5, false);
    s.quadraticCurveTo(-0.55, -0.55, 0, -1.0);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
    g.scale(sc, sc, 1);
    return g;
  };
  // the coin: a disc with a square hole and a raised rim
  const coinGeo = (rr, depth) => {
    const s = new THREE.Shape(); s.absarc(0, 0, rr, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); const q = rr * 0.3; hole.moveTo(-q, -q); hole.lineTo(-q, q); hole.lineTo(q, q); hole.lineTo(q, -q); hole.lineTo(-q, -q);
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
  };
  // stick a flat ornament on each face of a prism at height y (the face leans by `lean`)
  const onFaces = (geo, sAt, y, lean, mat, id) => {
    for (let r = 0; r < 4; r++) {
      const g = geo.clone();
      g.rotateX(-lean);
      g.translate(0, y, sAt + 0.05);
      g.rotateY((r * Math.PI) / 2);
      put(g, mat, id);
    }
  };
  {
    const idBody = boldId(20), idLedge = boldId(21), idOrn = boldId(22), idCrown = boldId(23), idSpire = boldId(24), idPod = boldId(25);
    // podium (the mall): two stepped blocks, mostly hidden by the city
    put((() => { const g = new THREE.BoxGeometry(64, 13, 44); g.translate(0, 6.5, 6); return g; })(), M.stone, idPod);
    put((() => { const g = new THREE.BoxGeometry(46, 4, 34); g.translate(0, 15, 6); return g; })(), M.stone, idPod);
    // the base: 25 floors tapering in, coins and ruyi on its faces
    const HB = 42, sb0 = 13, sb1 = 8.6;
    prism(sb0, sb1, 0, HB, M.glass, idBody);
    const lean = Math.atan((sb0 - sb1) / HB), sAt = (y) => sb0 + (sb1 - sb0) * (y / HB);
    onFaces(coinGeo(3.4, 0.5), sAt(31) - 0.2, 31, lean, M.orn, idOrn);
    onFaces(ruyiGeo(1.9, 0.5), sAt(38.6) - 0.2, 38.6, lean, M.orn, idOrn);
    let y = HB;
    ledge(sb1 * 1.06, y, idLedge, 0.7);
    y += 0.7;
    // eight flaring segments of eight floors, each on a ledge, ornaments at the corners
    const sS0 = 8.6, sS1 = 10.8, HS = 8 * FLH;
    const orn = ruyiGeo(1.15, 0.45);
    for (let k = 0; k < 8; k++) {
      prism(sS0, sS1, y, HS, M.glass, idBody);
      // corner ornaments just above the ledge, facing out along the diagonals
      for (let r = 0; r < 4; r++) {
        const g = orn.clone();
        g.translate(0, 0, -0.22);
        g.rotateY(Math.PI / 4);
        const rad = sS0 * 0.915 * Math.SQRT2 + 0.35; // just outside the innermost step of the corner
        g.translate(rad * Math.SQRT1_2, y + 1.6, rad * Math.SQRT1_2);
        g.rotateY((r * Math.PI) / 2);
        put(g, M.orn, idOrn);
      }
      y += HS;
      ledge(sS1 * 1.03, y, idLedge, 0.5);
      y += 0.5;
    }
    // the crown: three receding tiers on ledges, a pinnacle, the spire
    for (const [s0, s1, h] of [[8.0, 7.3, 4.6], [6.1, 5.6, 4.0], [4.5, 4.1, 3.4]]) {
      prism(s0, s1, y, h, M.glass, idCrown);
      y += h;
      ledge(s1 * 1.1, y, idLedge, 0.45);
      y += 0.45;
    }
    prism(2.6, 2.2, y, 4.5, M.stone, idCrown);
    y += 4.5;
    const cyl = (rt, rb, h, y0, mat, id, seg = 12) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, y0 + h / 2, 0); put(g, mat, id); };
    cyl(0.95, 1.25, 8, y, M.spire, idSpire); y += 8;
    cyl(1.25, 1.25, 0.5, y, M.ledge, idLedge); y += 0.5;
    cyl(0.6, 0.85, 7, y, M.spire, idSpire); y += 7;
    cyl(0.9, 0.9, 0.4, y, M.ledge, idLedge); y += 0.4;
    cyl(0.08, 0.5, 11, y, M.spire, idSpire, 8);
    for (const yy of [y + 3, y + 6]) cyl(0.45 - (yy - y) * 0.04, 0.45 - (yy - y) * 0.04, 0.3, yy, M.ledge, idLedge, 8);
  }

  // ---- Taipei Nan Shan Plaza beside it: a curtain-wall slab under a split crown ------
  {
    const [nx, nz] = dirAt(az101 + 5.5);
    const x = L.x + nx * (dist101 + 40), z = L.z + nz * (dist101 + 40);
    const q = placer(B, x, baseY, z, Math.atan2(L.x - x, L.z - z));
    const id = farId(cr()), H = 84;
    const body = new THREE.Shape();
    body.moveTo(-11, 0); body.lineTo(11, 0); body.lineTo(12.5, H); body.lineTo(-12.5, H); body.lineTo(-11, 0);
    const g = new THREE.ExtrudeGeometry(body, { depth: 16, bevelEnabled: false });
    g.translate(0, 0, -8);
    const uvA = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, (Math.abs(p.getZ(i)) > 7.9 ? p.getX(i) : p.getZ(i)) / BAY / 4, p.getY(i) / FL / 4);
    q(g, [M.nanshan, M.nanshan], id);
    // two blades rising off the top, a notch between them
    for (const sx of [-1, 1]) {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(sx * 12.5, 0); s.lineTo(sx * 9, 13); s.lineTo(sx * 2.5, 9); s.lineTo(0, 0);
      const c = new THREE.ExtrudeGeometry(s, { depth: 14, bevelEnabled: false });
      c.translate(0, H, -7);
      q(c, [M.trim, M.nanshan], farId(cr()));
    }
  }

  B.flush(root);
  return { towerX, towerZ };
}
