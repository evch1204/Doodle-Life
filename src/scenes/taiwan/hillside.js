import * as THREE from 'three';
import { ink } from '../../ink.js';
import { makeRng } from '../../sketch.js';
import * as TX from '../../taiwanTextures.js';
import { Batch, farId, placer } from '../kit.js';

// The hillside below Jiufen old street: houses on stone terraces stepping down
// toward the city, built from a small kit in three types, plus the villages and
// tree clumps along the ridge crests further out.
//  - 'tile': a gabled house under gray tiles
//  - 'tar':  Jiufen's black tar-paper roof, low pitched, with battens
//  - 'flat': a concrete walk-up with a parapet, a water tank, sometimes an iron shed
// Every house stands on a stone plinth (the terrace wall), its walls carry one
// window per bay, and the gable ends are closed.

const FLH = 2.2, BAYW = 1.6;

export function makeHouseKit() {
  const M = {
    plaster: ink({ map: TX.houseWallTexture('plaster', 721), mapAmt: 0.6, tone: 0.98, facing: 0.5, hatchFreq: 5 }),
    plaster2: ink({ map: TX.houseWallTexture('plaster', 723), mapAmt: 0.6, tone: 0.9, facing: 0.5, hatchFreq: 5 }),
    boards: ink({ map: TX.houseWallTexture('boards', 725), mapAmt: 0.65, tone: 0.86, facing: 0.5, hatchFreq: 5 }),
    stone: ink({ map: TX.stoneBlockTexture(), tri: 1 / 1.6, mapAmt: 0.7, tone: 0.86, facing: 0.5, hatchFreq: 5 }),
    tile: ink({ map: TX.roofTexture(), tri: 1 / 1.8, mapAmt: 0.75, tone: 0.76, facing: 0.35, hatchFreq: 5 }),
    tar: ink({ map: TX.tarRoofTexture(), tri: 1 / 2.4, mapAmt: 0.85, tone: 0.9, facing: 0.4, hatchFreq: 5 }),
    ridge: ink({ tone: 0.3, facing: 0.3, hatch: 0 }),
    concrete: ink({ tone: 0.94, facing: 0.5, hatchFreq: 5 }),
    shed: ink({ map: TX.corrugatedTexture(), repeat: [3, 1], mapAmt: 0.55, tone: 0.82, facing: 0.5, hatchFreq: 5 }),
    tank: ink({ tone: 0.62, facing: 0.5, hatch: 0 }),
    leaf: ink({ tone: 0.97, facing: 0.6, hatchFreq: 4 }),
    leafFar: ink({ tone: 0.98, facing: 0.5, hatchFreq: 1 }),
    trunk: ink({ tone: 0.45, facing: 0.5, hatch: 0 }),
  };
  const walls = [M.plaster, M.plaster, M.plaster2, M.boards];
  // one house in its own frame: front toward -z, ridge along x, standing on y = 0
  function house(B, put, r, { w, d, type, floors, lod }) {
    const id = farId(r());
    const wall = type === 'flat' ? (r() < 0.6 ? M.concrete : M.plaster2) : walls[Math.floor(r() * walls.length)];
    const H = floors * FLH;
    const box = (bw, bh, bd, x, y, z, mat, bid = id, o = {}) => { const g = new THREE.BoxGeometry(bw, bh, bd); if (o.uv) uvBays(g, bw, bh, bd); g.translate(x, y + bh / 2, z); put(g, o.top ? [mat, mat, o.top, o.top, mat, mat] : mat, bid); };
    // the terrace: a stone plinth reaching down into the slope
    box(w + 0.5, 3.4, d + 0.5, 0, -3.0, 0, M.stone, farId(r()));
    if (type === 'flat') {
      box(w, H, d, 0, 0.4, 0, wall, id, { uv: true, top: M.concrete });
      if (!lod) {
        // parapet, water tank on legs, sometimes an iron shed on the roof
        const y = H + 0.4, pid = farId(r());
        for (const [pw, pd, px, pz] of [[w, 0.15, 0, -d / 2 + 0.075], [w, 0.15, 0, d / 2 - 0.075], [0.15, d, -w / 2 + 0.075, 0], [0.15, d, w / 2 - 0.075, 0]]) box(pw, 0.6, pd, px, y, pz, M.concrete, pid);
        const tx = (r() - 0.5) * w * 0.5, tz = (r() - 0.5) * d * 0.4;
        for (const [lx, lz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) box(0.08, 0.7, 0.08, tx + lx, y, tz + lz, M.ridge, pid);
        const t = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12); t.translate(tx, y + 0.7 + 0.55, tz); put(t, M.tank, farId(r()));
        if (r() < 0.45) {
          const sw = w * 0.5;
          box(sw, 1.9, d * 0.6, -tx * 0.5 - (tx > 0 ? sw * 0.3 : -sw * 0.3), y, 0, M.shed, farId(r()), { top: M.shed });
        }
      }
      return;
    }
    box(w, H, d, 0, 0.4, 0, wall, id, { uv: true });
    // the roof: two slopes with eaves, a dark ridge, closed gable ends
    const rise = type === 'tar' ? 0.5 + d * 0.06 : 0.75 + d * 0.12;
    const over = 0.35, half = d / 2 + over, L2 = Math.hypot(half, rise), a = Math.atan2(rise, half);
    const roofM = type === 'tar' ? M.tar : M.tile, y0 = H + 0.4, rid = farId(r());
    for (const sgn of [-1, 1]) {
      const g = new THREE.BoxGeometry(w + 2 * over, 0.1, L2);
      g.rotateX(sgn * a);
      g.translate(0, y0 + rise / 2, sgn * (half / 2));
      put(g, roofM, rid);
    }
    box(w + 2 * over + 0.05, 0.16, 0.22, 0, y0 + rise - 0.04, 0, M.ridge, rid);
    if (!lod) {
      const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, rise * (d / 2) / half); s.lineTo(-d / 2, 0);
      for (const sx of [-1, 1]) {
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false });
        g.rotateY(Math.PI / 2); g.translate(sx * (w / 2) - 0.05, y0, 0);
        put(g, [wall, wall], id);
      }
      // a door and an awning slab over it on the downhill front
      if (r() < 0.5) { box(0.9, 1.9, 0.06, (r() - 0.5) * (w - 1.4), 0.4, -d / 2 - 0.03, M.ridge, farId(r())); box(1.4, 0.07, 0.7, 0, 2.5, -d / 2 - 0.35, roofM, farId(r())); }
    }
  }
  // walls count bays across and floors up (window texture: 4 x 4 per tile)
  function uvBays(g, w, h, d) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      const nu = Math.max(1, Math.round(dims[f][0] / BAYW)) / 4, nv = dims[f][1] / FLH / 4;
      for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * nu, uv.getY(i) * nv); }
    }
  }
  // a clump of three crowns on a trunk
  function tree(B, x, y, z, s, r, lod) {
    const id = farId(r());
    for (const [dx, dy, dz, k] of [[0, 1.0, 0, 1], [0.7, 0.75, 0.3, 0.72], [-0.65, 0.8, -0.25, 0.75]]) {
      const g = new THREE.SphereGeometry(s * k, lod ? 7 : 10, lod ? 5 : 7); g.scale(1, 0.85, 1);
      g.translate(x + dx * s, y + 1.2 * s + dy * s, z + dz * s);
      B.add(g, lod ? M.leafFar : M.leaf, id);
    }
    if (!lod) { const t = new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 1.6 * s, 6); t.translate(x, y + 0.8 * s, z); B.add(t, M.trunk, id); }
  }
  return { M, house, tree };
}

export function buildHillside(root, { hillY, blocked, lookout }) {
  const r = makeRng(5150);
  const kit = makeHouseKit();
  const B = new Batch();
  for (let gz = -18.6, row = 0; gz > -152; gz -= 4.6 + row * 0.02, row++) {
    const spread = 28 + Math.max(0, -gz - 40) * 0.55, lod = gz < -80;
    let gx = -spread + r() * 3;
    while (gx < spread * 0.85) {
      // just below the lookout only low roofs, so nothing rises into the view
      const low = Math.hypot(gx - lookout.x, gz - lookout.z) < 26;
      let type = r() < 0.38 ? 'tar' : r() < 0.6 ? 'tile' : 'flat';
      if (low && type === 'flat') type = 'tar';
      const w = type === 'flat' ? 3.6 + r() * 1.6 : 3 + r() * 1.8, d = 3 + r() * 1.2;
      const x = gx + w / 2, z = gz + (r() - 0.5) * 0.8;
      gx += w + 0.5 + r() * 1.4;
      if (blocked(x, z) || r() < 0.12) continue;
      const y = hillY(x, z);
      if (r() < 0.16) { kit.tree(B, x, y, z, 1.3 + r() * 0.5, r, lod); continue; }
      const ry = r() < 0.82 ? (r() - 0.5) * 0.12 : Math.PI / 2;
      const floors = low ? 1 : type === 'flat' ? 2 + (r() < 0.4 ? 1 : 0) : 1 + (r() < 0.45 ? 1 : 0);
      kit.house(B, placer(B, x, y, z, ry), r, { w, d, type, floors, lod });
    }
  }
  B.flush(root, { receive: true }); // shadows received, none cast (they are below the walk)
}

// Villages and tree clumps along the crests of the nearer hill bands, so their
// ridge lines break up into roofs and trees. crest(R, az) gives the top of a band.
export function buildRidges(root, { L, dirAt, crests }) {
  const r = makeRng(5170);
  const kit = makeHouseKit();
  const B = new Batch();
  for (const { R, top, houses, tree } of crests) {
    for (let az = -104; az < 104; az += 0.9 + r() * 1.4) {
      const [dx, dz] = dirAt(az);
      const cluster = Math.sin(az * 0.11 + R) > 0.15;
      if (houses && cluster && r() < 0.75) {
        const d = R + 2 + r() * 8, x = L.x + dx * d, z = L.z + dz * d;
        const y = top(az) - 1.4 - (d - R) * 0.15;
        const type = r() < 0.45 ? 'tar' : r() < 0.7 ? 'tile' : 'flat';
        kit.house(B, placer(B, x, y, z, Math.atan2(L.x - x, L.z - z) + Math.PI + (r() - 0.5) * 0.3), r, { w: 3.4 + r() * 1.8, d: 3.2 + r(), type, floors: type === 'flat' ? 2 : 1 + (r() < 0.4 ? 1 : 0), lod: true });
      } else if (r() < 0.8) {
        const d = R + 0.5 + r() * 3, x = L.x + dx * d, z = L.z + dz * d;
        kit.tree(B, x, top(az) - tree * 0.9, z, tree * (0.8 + r() * 0.5), r, true);
      }
    }
  }
  B.flush(root);
}
