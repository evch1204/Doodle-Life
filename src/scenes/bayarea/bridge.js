import * as THREE from 'three';

// The Golden Gate Bridge, built in its own frame and placed by sf.js: +x runs
// along the deck from the south tower (x 0) to the north tower (x S), y up from
// the water, z across (the cable planes at z = ±CW).
//
// The real bridge's proportions, compressed to fit the bay: towers 135 m (for
// 227), the road 40 m up on a 7.5 m deep stiffening truss, side spans a little
// over a quarter of the main span, hangers every 15 m (two truss panels).
// Each tower is two legs that step in at every portal strut; four struts above
// the road with the openings between them shrinking toward the top, a strut
// and an X-brace below it; the legs and the struts are fluted.

export const GG = { TH: 135, DECK: 40, TRUSS: 7.5, CW: 10, PANEL: 7.5, HANG: 15 };
const IN = GG.CW + 0.6;  // the legs' inner faces: the deck passes between them
// leg sections, [y0, y1, along the bridge, across]: each steps in at a strut's top
const SEG = [[8, 76, 9, 7], [76, 100.5, 8, 6.2], [100.5, 119, 7.2, 5.5], [119, GG.TH, 6.4, 4.8]];
// the portal struts above the road, [bottom, height]: openings of 29, 19, 13.5 and 9 m
const STRUTS = [[70, 6], [95, 5.5], [114, 5], [128, 7]];

const bx = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; };

// put(geo, mat, id) adds a piece in the bridge's frame. M: tower, strut, rib,
// cable, deck, truss, pier. bold(): the next landmark id (keeps its line at any
// distance); fine(k): a far id for the small members, whose lines thin out
// and lighten with distance. Returns the cable height along the bridge.
export function buildBridge(put, M, { S, side, bold, fine }) {
  const { TH, DECK, TRUSS, CW, PANEL, HANG } = GG;
  const id = { leg: bold(), strut: bold(), cable: bold(), deck: bold(), truss: bold(), pier: bold(), brace: bold() };
  const idRib = fine(0.31), idHang = fine(0.47), idRail = fine(0.53), idCap = fine(0.37);

  // =====================================================================
  // THE TOWERS
  // =====================================================================
  const segAt = (y) => SEG.find(([y0, y1]) => y >= y0 && y < y1) ?? SEG[SEG.length - 1];
  const tower = (x0) => {
    // the pier: a rounded fender, long across the bridge, standing in the water
    {
      const hx = 9, hz = IN + 9;
      const sh = new THREE.Shape();
      sh.moveTo(-hx, -hz + hx); sh.lineTo(-hx, hz - hx); sh.absarc(0, hz - hx, hx, Math.PI, 0, true);
      sh.lineTo(hx, -hz + hx); sh.absarc(0, -hz + hx, hx, 0, Math.PI, true);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 10, bevelEnabled: false, curveSegments: 10 });
      g.rotateX(-Math.PI / 2); g.translate(x0, -2, 0);
      put(g, M.pier, id.pier);
      put(bx(2 * hx - 2, 0.8, 2 * hz - 2, x0, 8, 0), M.pier, id.pier);
    }
    // the legs, each face fluted with two shallow fillets
    for (const s of [-1, 1]) {
      for (const [y0, y1, lx, lz] of SEG) {
        const zc = s * (IN + lz / 2), h = y1 - y0 - 1.2;
        put(bx(lx, y1 - y0, lz, x0, y0, zc), M.tower, id.leg);
        for (const k of [-1, 1]) {
          put(bx(0.7, h, 0.3, x0 + k * lx * 0.22, y0 + 0.6, zc + s * (lz / 2 + 0.15)), M.rib, idRib);
          for (const f of [-1, 1]) put(bx(0.3, h, 0.7, x0 + f * (lx / 2 + 0.15), y0 + 0.6, zc + k * lz * 0.22), M.rib, idRib);
        }
      }
      // the saddle housing on top, reaching in over the cable
      const [, , lx, lz] = SEG[SEG.length - 1];
      put(bx(lx + 1, 2.4, lz + 2.2, x0, TH, s * (IN + lz / 2 - 1)), M.strut, id.strut);
    }
    // the portal struts: a deep beam with a cornice, vertical ribs across both faces
    for (const [y, h] of STRUTS) {
      const lx = segAt(y)[2] * 0.72, w = 2 * IN;
      put(bx(lx, h, w + 0.6, x0, y, 0), M.strut, id.strut);
      put(bx(lx + 0.9, 0.7, w, x0, y + h - 0.7, 0), M.rib, idCap);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const z = -IN + (w * (i + 0.5)) / n;
        put(bx(lx + 0.5, h - 1.3, 0.45, x0, y + 0.3, z), M.rib, idRib);
      }
    }
    // below the road: a strut under the truss, an X-brace down to the pier
    {
      const lx = SEG[0][2] * 0.6, yb = 9, yt = 24;
      put(bx(lx, 6.5, 2 * IN + 0.6, x0, yt, 0), M.strut, id.strut);
      const L = Math.hypot(2 * IN, yt - yb), a = Math.atan2(yt - yb, 2 * IN);
      for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(lx * 0.7, 1.8, L); g.rotateX(s * a); g.translate(x0, (yb + yt) / 2, 0); put(g, M.strut, id.brace); }
    }
  };
  tower(0); tower(S);

  // =====================================================================
  // THE CABLES: a parabola over the main span (the shape a cable takes under a
  // level deck), a shallow sag down to the anchorages, a kink at each saddle
  // =====================================================================
  const top = TH + 1.6, low = DECK + 2.4, anchY = DECK + 3, SAG = 5;
  const cableY = (x) => {
    if (x >= 0 && x <= S) { const t = (x - S / 2) / (S / 2); return low + (top - low) * t * t; }
    const t = x < 0 ? -x / side : (x - S) / side;          // 0 at the tower, 1 at the anchorage
    return top + (anchY - top) * t - SAG * 4 * t * (1 - t);
  };
  const run = (x0, x1, n, z) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; pts.push(new THREE.Vector3(x, cableY(x), z)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.9, 6, false);
  };
  for (const s of [-1, 1]) {
    const z = s * CW;
    put(run(-side, 0, 24, z), M.cable, id.cable);
    put(run(0, S, 90, z), M.cable, id.cable);
    put(run(S, S + side, 24, z), M.cable, id.cable);
    // the hangers: straight down to the truss, every HANG metres from mid-span out
    const xs = [];
    for (let x = S / 2; x < S - 6; x += HANG) xs.push(x);
    for (let x = S / 2 - HANG; x > 6; x -= HANG) xs.push(x);
    for (let x = -HANG; x > -side + 6; x -= HANG) xs.push(x, S - x);
    for (const x of xs) {
      const yc = cableY(x) - 0.6;
      if (yc - DECK > 0.8) put(bx(0.5, yc - DECK, 0.5, x, DECK, z), M.cable, idHang);
    }
    // cable bands where the cable comes down to the road at mid-span
    put(bx(2.4, 1.6, 2.2, S / 2, low - 0.8, z), M.strut, id.strut);
  }

  // =====================================================================
  // THE DECK: the road slab, a Warren truss along each side (chords as solid
  // members, the web drawn on), railings; it runs on into the land at both ends
  // =====================================================================
  const d0 = -side - 40, d1 = S + side + 40, L = d1 - d0, xm = (d0 + d1) / 2;
  put(bx(L, 1.2, 2 * CW + 0.8, xm, DECK - 1.2, 0), M.deck, id.deck);
  for (const s of [-1, 1]) {
    const z = s * CW;
    put(bx(L, 0.9, 0.9, xm, DECK - 1.0, z), M.deck, id.deck);                    // top chord
    put(bx(L, 0.9, 0.9, xm, DECK - TRUSS, z), M.deck, id.deck);                  // bottom chord
    const web = new THREE.BoxGeometry(L, TRUSS - 1.9, 0.35);
    const uv = web.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (L / (4 * PANEL)));
    web.translate(xm, DECK - TRUSS + 0.9 + (TRUSS - 1.9) / 2, z);
    put(web, M.truss, id.truss);
    put(bx(L, 0.25, 0.3, xm, DECK + 1.1, s * (CW + 0.25)), M.deck, idRail);     // the railing's top rail
  }
  // floor beams under the road, one a panel, seen from below between the trusses
  for (let x = d0 + PANEL / 2; x < d1; x += PANEL) put(bx(0.7, 1.4, 2 * CW, x, DECK - 2.6, 0), M.deck, idCap);

  // =====================================================================
  // THE ANCHORAGES: stepped concrete blocks the cables run into, a pair of
  // pylons where they come down past the road
  // =====================================================================
  for (const [x, dir] of [[-side, -1], [S + side, 1]]) {
    put(bx(30, anchY + 4, 2 * CW + 12, x + dir * 11, -3, 0), M.pier, id.pier);
    put(bx(18, 5, 2 * CW + 7, x + dir * 15, anchY + 1, 0), M.pier, id.pier);
    for (const s of [-1, 1]) {
      const px = x - dir * 7, pz = s * (CW + 3.5);
      put(bx(6, DECK + 18, 4.5, px, -2, pz), M.tower, id.leg);
      put(bx(4.6, 6, 3.4, px, DECK + 16, pz), M.tower, id.leg);
      put(bx(6.8, 0.8, 5.2, px, DECK + 15.4, pz), M.rib, idCap);
    }
  }
  // the approach viaducts' columns, past the anchorages
  for (const x of [-side - 26, S + side + 26]) for (const s of [-1, 1]) put(bx(3, DECK - 2, 3, x, -2, s * (CW - 1.5)), M.pier, id.pier);

  return { cableY, top: TH, deck: DECK };
}
