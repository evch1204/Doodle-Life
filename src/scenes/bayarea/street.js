import * as THREE from 'three';
import { ink } from '../../ink.js';
import * as BX from '../../bayTextures.js';
import { farId } from '../kit.js';
import { boxG, cylG, sphG, mulberry } from './props.js';

// The street's buildings, from one kit: three- and four-storey waterfront
// fronts with a real storefront (pilasters, kickplates, mullioned display
// windows, a recessed door, a sign band and its cornice), upper floors of
// stacked San Francisco bay windows or framed sash windows with hoods,
// pediments and iron balconies, and a bracketed cornice on top. Awnings and
// hanging blade signs are part of the kit too.
//
// Every building is built in its own frame: x along the street (forward),
// y up from the sidewalk, z out of the facade toward the street (the front
// wall is z = 0, the building runs back to z = -DEPTH). place(x0, x1) gives the
// matrix that puts a front running from x0 to x1 into the world.

export const GF = 4.2;        // ground floor height
export const FH = 3.3;        // upper floor height
export const DEPTH = 12;
export const REC = 0.5;       // the storefront glass sits this far back from the front wall

// fascia sign materials, shared by signs with the same text and shape; the cache lives
// on the scene's material set (M.signs), so it goes when the scene is disposed
function signMat(M, text, sub, w, h, dark = true) {
  const en = text.en ?? text;
  const key = `${en}|${sub.en ?? sub}|${Math.round((w / h) * 4)}|${dark}`;
  if (!M.signs.has(key)) {
    const W = Math.min(2048, Math.round(200 * (w / h)));
    M.signs.set(key, ink({ map: BX.shopSignTexture(text, { sub, dark, W, H: 200, seed: en.length * 7 + 11 }), facing: 0.15, hatch: 0 }));
  }
  return M.signs.get(key);
}

// A trapezoid in plan (back width bw, front width fw, projection p) extruded
// up by h from y0, centred on x: the shape of a San Francisco bay window.
function bayPrism(bw, fw, p, h, x, y0, z = 0) {
  const s = new THREE.Shape();
  s.moveTo(-bw / 2, 0); s.lineTo(-fw / 2, -p); s.lineTo(fw / 2, -p); s.lineTo(bw / 2, 0); s.lineTo(-bw / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(x, y0, z);
  return g;
}

/**
 * One building. o:
 *   x0, x1      the front's extent along the street (local x)
 *   floors      3 | 4
 *   wall        material key ('stucco' | 'stucco2' | 'brick' | 'siding')
 *   upper       'bay' (stacked bay windows) | 'flat' | 'balcony'
 *   top         'bracket' | 'pediment' | 'parapet'
 *   shop        { sign, sub, dark, window ('plain' | 'bread' | ...), door ('left' | 'right' | 'center'),
 *                 awning (depth in m, 0 = none), interior (the café: open windows onto a room) }
 *   seed
 * put(geo, mat, id) adds a piece in the building's frame.
 */
export function building(put, M, o) {
  const r = mulberry(o.seed ?? 1);
  const w = o.x1 - o.x0, cx = (o.x0 + o.x1) / 2;
  const H = GF + (o.floors - 1) * FH + 0.7;          // the top floor plus the frieze zone
  const wall = M[o.wall] ?? M.stucco;
  const id = farId(r()), idT = id + 0.002, idW = id + 0.004, idS = id + 0.006;
  const out = { H, anchors: {} };

  // ---- the mass: upper floors full depth, the ground floor behind the storefront ----------
  const deep = o.shop?.interior ? REC + 3.4 : REC + 1.0;
  put(boxG(w, H - GF, DEPTH, cx, GF, -DEPTH / 2), wall, id);
  put(boxG(w, GF, DEPTH - deep, cx, 0, -deep - (DEPTH - deep) / 2), wall, id);

  // ---- the storefront --------------------------------------------------------------------
  const pw = 0.42;                                     // pilaster width
  const inner0 = o.x0 + pw, inner1 = o.x1 - pw, iw = inner1 - inner0;
  for (const px of [o.x0 + pw / 2, o.x1 - pw / 2]) {
    put(boxG(pw, GF - 0.95, REC + 0.14, px, 0, -REC / 2 + 0.07), M.trim, idT);
    put(boxG(pw + 0.1, 0.3, REC + 0.24, px, 0, -REC / 2 + 0.07), M.ledge, idT);   // plinth
    put(boxG(pw + 0.08, 0.16, REC + 0.22, px, GF - 1.11, -REC / 2 + 0.07), M.ledge, idT); // capital
  }
  // the sign band (fascia) with its board, and the storefront cornice over it
  put(boxG(w, 0.95, REC + 0.16, cx, GF - 0.95, -REC / 2 + 0.08), M.trim, idT);
  if (o.shop?.sign) {
    const sw = Math.min(iw - 0.3, 9), sh = 0.62;
    const g = new THREE.PlaneGeometry(sw, sh); g.translate(cx, GF - 0.48, 0.18);
    put(g, signMat(M, o.shop.sign, o.shop.sub ?? '', sw, sh, o.shop.dark !== false), idS);
  }
  put(boxG(w + 0.12, 0.2, REC + 0.5, cx, GF, -REC / 2 + 0.25), M.ledge, idT);
  put(boxG(w + 0.2, 0.1, REC + 0.6, cx, GF + 0.2, -REC / 2 + 0.3), M.trim, idT);

  // the door: where along the front, and whether it sits in a recess
  const dW = 1.3, dPos = o.shop?.door ?? 'right';
  const dx = dPos === 'left' ? inner0 + 0.35 + dW / 2 : dPos === 'center' ? cx : inner1 - 0.35 - dW / 2;
  const doorTop = GF - 1.3;
  const zS = -REC;                                     // the storefront plane
  if (o.shop?.interior) {
    // the café: a shallow room behind open windows (floor, side walls, ceiling, back wall)
    const zb = -deep;
    put(boxG(iw, 0.02, deep - REC, cx, 0, (zS + zb) / 2), M.boards, idW);
    put(boxG(iw, 0.12, deep - REC, cx, GF - 1.07, (zS + zb) / 2), M.plaster, idW);
    for (const sx of [inner0 - 0.05, inner1 + 0.05]) put(boxG(0.1, GF - 0.95, deep - REC, sx, 0, (zS + zb) / 2), M.plaster, idW);
    out.anchors.room = { x0: inner0, x1: inner1, zFront: zS, zBack: zb, ceil: GF - 1.07 };
  } else {
    // ground-floor fronts either side of the door recess, the recess head, the door
    const segs = [[inner0, dx - dW / 2], [dx + dW / 2, inner1]].filter(([a, b]) => b - a > 0.05);
    for (const [a, b] of segs) put(boxG(b - a, GF - 0.95, deep - REC, (a + b) / 2, 0, -(deep + REC) / 2), wall, id);
    put(boxG(dW, GF - 0.95 - doorTop, deep - REC, dx, doorTop, -(deep + REC) / 2), M.trim, idT);
    const dg = new THREE.PlaneGeometry(dW - 0.1, doorTop - 0.02); dg.translate(dx, (doorTop - 0.02) / 2, -deep + 0.012);
    put(dg, M.doorway, idW);
    put(boxG(dW + 0.04, 0.05, 1.0, dx, 0, -deep + 0.5), M.ledge, idT);   // the step / threshold
  }
  // display windows: kickplate, glass (or open, for the café), mullions, the transom bar
  const winSegs = o.shop?.interior ? [[inner0, inner1]] : [[inner0, dx - dW / 2], [dx + dW / 2, inner1]].filter(([a, b]) => b - a > 0.3);
  const glass = M.shopWin[o.shop?.window ?? 'plain'];
  const kick = 0.55;
  for (const [a, b] of winSegs) {
    const sw = b - a, sx = (a + b) / 2;
    put(boxG(sw, kick, 0.14, sx, 0, zS + 0.07), M.reveal, idT);
    put(boxG(sw, 0.06, 0.24, sx, kick, zS + 0.08), M.ledge, idT);
    if (!o.shop?.interior) {
      const g = new THREE.PlaneGeometry(sw, doorTop - kick - 0.06); g.translate(sx, (kick + doorTop) / 2 + 0.03, zS + 0.02);
      put(g, glass, idW);
      const tg = new THREE.PlaneGeometry(sw, GF - 0.95 - doorTop - 0.12); tg.translate(sx, (doorTop + GF - 0.95) / 2 + 0.03, zS + 0.02);
      put(tg, M.glass, idW);
    }
    put(boxG(sw, 0.08, 0.1, sx, doorTop, zS + 0.05), M.dark, idT);
    const n = Math.max(1, Math.round(sw / 1.25));
    for (let i = 0; i <= n; i++) put(boxG(0.07, GF - 0.95 - kick, 0.1, a + (sw * i) / n, kick, zS + 0.05), M.dark, idT);
  }
  if (o.shop?.interior) {
    // the open doorway in the café front: a frame with its door folded back
    put(boxG(0.08, GF - 0.95, 0.12, dx - dW / 2, 0, zS + 0.06), M.dark, idT);
    put(boxG(0.08, GF - 0.95, 0.12, dx + dW / 2, 0, zS + 0.06), M.dark, idT);
  }
  // the awning over the windows: a sloped canvas with a valance and side cheeks
  if (o.shop?.awning) {
    const ad = o.shop.awning, ah = 0.55 + ad * 0.12, top = GF - 1.0, aw = iw + 0.2;
    const len = Math.hypot(ad, ah), ang = Math.atan2(ah, ad);
    const g = new THREE.BoxGeometry(aw, 0.04, len); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * aw / 1.6);
    g.rotateX(ang); g.translate(cx, top - ah / 2, ad / 2 + 0.05);
    put(g, M.awning, idS + 0.002);
    const v = new THREE.BoxGeometry(aw, 0.32, 0.03); const uv2 = v.attributes.uv; for (let i = 0; i < uv2.count; i++) uv2.setX(i, uv2.getX(i) * aw / 1.6);
    v.translate(cx, top - ah - 0.16, ad + 0.05);
    put(v, M.awning, idS + 0.002);
    for (const sx of [cx - aw / 2 + 0.01, cx + aw / 2 - 0.01]) { // inset off the awning's end faces
      const t = new THREE.BufferGeometry();
      t.setAttribute('position', new THREE.Float32BufferAttribute([sx, top, 0.05, sx, top - ah, ad + 0.05, sx, top - ah - 0.3, ad + 0.05], 3));
      t.computeVertexNormals(); put(t, M.canvas, idS + 0.002);
    }
    out.anchors.awning = { depth: ad, low: top - ah - 0.32 };
  }

  // ---- the upper floors ------------------------------------------------------------------
  const bays = Math.max(2, Math.round(w / 3.1));
  const bw = w / bays;
  const yU = GF + 0.3;
  const upper = o.upper ?? 'flat';
  // which bays carry a projecting bay window (every other one, never both ends of a narrow front)
  const oriel = new Set();
  if (upper === 'bay') {
    if (bays === 2) oriel.add(0);
    else if (bays === 3) oriel.add(1);
    else if (bays % 2 === 0) { oriel.add(0); oriel.add(bays - 1); }
    else { oriel.add(1); oriel.add(bays - 2); }
  }
  const orielX = [...oriel].map((i) => o.x0 + bw * (i + 0.5));
  const flatWindow = (x, y, ww, wh, f, i) => {
    const g = new THREE.PlaneGeometry(ww, wh); g.translate(x, y + wh / 2, 0.02); put(g, M.glass, idW);
    // the architrave round it, the sill, a hood or a pediment
    put(boxG(ww + 0.24, 0.1, 0.07, x, y + wh, 0.035), M.trim, idT);
    put(boxG(0.12, wh, 0.07, x - ww / 2 - 0.06, y, 0.035), M.trim, idT);
    put(boxG(0.12, wh, 0.07, x + ww / 2 + 0.06, y, 0.035), M.trim, idT);
    put(boxG(ww + 0.36, 0.08, 0.17, x, y - 0.08, 0.085), M.ledge, idT);
    for (const sx of [-1, 1]) put(boxG(0.08, 0.14, 0.12, x + sx * (ww / 2 + 0.08), y - 0.22, 0.06), M.trim, idT);
    if ((f + i) % 3 === 0 && f > 0) {
      const s = new THREE.Shape(); s.moveTo(-ww / 2 - 0.22, 0); s.lineTo(ww / 2 + 0.22, 0); s.lineTo(0, 0.34); s.lineTo(-ww / 2 - 0.22, 0);
      const pg = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false }); pg.translate(x, y + wh + 0.12, 0);
      put(pg, M.trim, idT);
      put(boxG(ww + 0.5, 0.06, 0.18, x, y + wh + 0.08, 0.09), M.ledge, idT);
    } else {
      put(boxG(ww + 0.42, 0.13, 0.16, x, y + wh + 0.1, 0.08), M.ledge, idT);
      put(boxG(ww + 0.3, 0.08, 0.1, x, y + wh + 0.23, 0.05), M.trim, idT);
    }
  };
  for (let i = 0; i < bays; i++) {
    const x = o.x0 + bw * (i + 0.5);
    if (oriel.has(i)) {
      // a bay window stacked up the floors: three faces of windows, belts at each floor,
      // a corbelled base and a cornice cap
      const B0 = Math.min(bw * 1.6, 2.7), F0 = B0 * 0.58, P = 0.72;
      const hgt = H - yU - 0.55;
      put(bayPrism(B0, F0, P, hgt, x, yU), wall, idT + 0.001);
      put(bayPrism(B0 * 0.92, F0 * 0.84, P * 0.8, 0.28, x, yU - 0.28), M.trim, idT);
      put(bayPrism(B0 * 0.7, F0 * 0.6, P * 0.5, 0.26, x, yU - 0.54), M.trim, idT);
      put(bayPrism(B0 * 1.08, F0 * 1.12, P + 0.14, 0.3, x, yU + hgt), M.ledge, idT);
      put(bayPrism(B0 * 1.04, F0 * 1.06, P + 0.08, 0.12, x, yU + hgt + 0.3), M.trim, idT);
      const sideL = Math.hypot((B0 - F0) / 2, P), nAng = Math.atan2(P, (B0 - F0) / 2);
      for (let f = 0; f < o.floors - 1; f++) {
        const y = yU + f * FH + 0.75, wh = 1.75;
        if (f > 0) put(bayPrism(B0 * 1.03, F0 * 1.05, P + 0.05, 0.14, x, yU + f * FH + 0.05), M.trim, idT);
        // front face
        const fg = new THREE.PlaneGeometry(F0 - 0.34, wh); fg.translate(x, y + wh / 2, P + 0.02); put(fg, M.glass, idW);
        put(boxG(F0 - 0.1, 0.08, 0.12, x, y - 0.08, P + 0.04), M.ledge, idT);
        // the two angled faces
        for (const sd of [-1, 1]) {
          const g = new THREE.PlaneGeometry(sideL - 0.3, wh);
          g.rotateY(sd * nAng); g.translate(x + sd * (B0 + F0) / 4 + sd * 0.02 * Math.sin(nAng), y + wh / 2, P / 2 + 0.02 * Math.cos(nAng));
          put(g, M.glass, idW);
          const sg = boxG(sideL - 0.06, 0.08, 0.12, 0, 0, 0); sg.rotateY(sd * nAng); sg.translate(x + sd * (B0 + F0) / 4, y - 0.08, P / 2 + 0.04);
          put(sg, M.ledge, idT);
        }
        // panels under the windows
        put(boxG(F0 - 0.4, 0.42, 0.04, x, y - 0.6, P + 0.01), M.trim, idT);
      }
    } else {
      for (let f = 0; f < o.floors - 1; f++) {
        const y = yU + f * FH + 0.7;
        const ww = Math.min(1.05, bw * 0.4), wh = f === 0 && upper === 'balcony' ? 2.15 : 1.8;
        const yy = f === 0 && upper === 'balcony' ? y - 0.35 : y;
        flatWindow(x, yy, ww, wh, f, i);
        if (upper === 'balcony' && (f === 0 || (f === o.floors - 2 && i % 2 === 0))) {
          // an iron balcony: a stone slab on brackets, railing posts and a top rail
          const bw2 = ww + 0.9, by = yy - 0.12;
          put(boxG(bw2, 0.12, 0.62, x, by, 0.31), M.ledge, idT);
          for (const sx of [-1, 1]) put(boxG(0.1, 0.28, 0.4, x + sx * (bw2 / 2 - 0.15), by - 0.28, 0.2), M.trim, idT);
          const n = Math.round(bw2 / 0.12);
          for (let k = 0; k <= n; k++) put(cylG(0.012, 0.012, 0.9, x - bw2 / 2 + 0.04 + ((bw2 - 0.08) * k) / n, by + 0.12, 0.58, 4), M.iron, idS);
          for (let k = 0; k <= 4; k++) put(cylG(0.012, 0.012, 0.6, x + (k % 2 ? 1 : -1) * (bw2 / 2 - 0.04), by + 0.12, 0.04 + k * 0.13, 4), M.iron, idS);
          put(boxG(bw2, 0.04, 0.05, x, by + 1.02, 0.58), M.iron, idS);
          for (const sx of [-1, 1]) put(boxG(0.04, 0.04, 0.6, x + sx * (bw2 / 2 - 0.02), by + 1.02, 0.29), M.iron, idS);
          put(boxG(bw2, 0.03, 0.04, x, by + 0.3, 0.58), M.iron, idS);
          // a planter box with flowers on the rail of the first floor's balconies
          if (f === 0 && i % 2 === 1) {
            put(boxG(bw2 * 0.6, 0.18, 0.2, x, by + 1.05, 0.62), M.woodDark, idS);
            for (let k = 0; k < 4; k++) put(sphG(0.11, x - bw2 * 0.24 + k * bw2 * 0.16, by + 1.26, 0.62, 1.2, 0.8, 1, 8), M.leaf, idS + 0.001);
          }
        } else if (upper !== 'balcony' && f === 0 && r() < 0.35) {
          // a flower box under the window
          put(boxG(ww + 0.1, 0.2, 0.22, x, yy - 0.42, 0.17), M.woodDark, idS);
          for (let k = 0; k < 4; k++) put(sphG(0.12, x - ww * 0.36 + k * ww * 0.24, yy - 0.2, 0.2, 1.2, 0.75, 1, 8), M.leaf, idS + 0.001);
        }
      }
    }
  }
  // belt courses between the floors (across the flat wall)
  for (let f = 1; f < o.floors - 1; f++) put(boxG(w, 0.12, 0.1, cx, yU + f * FH + 0.02, 0.05), M.trim, idT);
  // quoins / corner boards at both ends
  for (const ex of [o.x0 + 0.16, o.x1 - 0.16]) put(boxG(0.32, H - GF - 0.3, 0.06, ex, GF + 0.3, 0.03), M.trim, idT);

  // ---- the roofline ------------------------------------------------------------------------
  const top = o.top ?? 'bracket';
  put(boxG(w, 0.55, 0.12, cx, H - 0.55, 0.06), M.trim, idT);                       // frieze
  put(boxG(w + 0.3, 0.26, 0.82, cx, H, 0.41 - 0.1), M.ledge, idT);                    // cornice
  put(boxG(w + 0.36, 0.1, 0.9, cx, H + 0.26, 0.45 - 0.1), M.trim, idT);
  const nb = Math.max(3, Math.round(w / 0.85));
  for (let k = 0; k < nb; k++) {
    const bx = o.x0 + 0.2 + ((w - 0.4) * k) / (nb - 1);
    if (orielX.some((ox) => Math.abs(bx - ox) < 1.55)) continue;
    put(boxG(0.13, 0.48, 0.58, bx, H - 0.48, 0.29), M.trim, idT);
    put(boxG(0.13, 0.12, 0.2, bx, H - 0.6, 0.1), M.trim, idT);
  }
  if (top === 'pediment') {
    const s = new THREE.Shape(); s.moveTo(-w * 0.22, 0); s.lineTo(w * 0.22, 0); s.lineTo(0, 1.1); s.lineTo(-w * 0.22, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); g.translate(cx, H + 0.36, -0.1);
    put(g, wall, idT);
    const s2 = new THREE.Shape(); s2.moveTo(-w * 0.24, 0); s2.lineTo(-w * 0.24 + 0.2, 0); s2.lineTo(0, 1.1); s2.lineTo(w * 0.24 - 0.2, 0); s2.lineTo(w * 0.24, 0); s2.lineTo(0, 1.24); s2.lineTo(-w * 0.24, 0);
    const g2 = new THREE.ExtrudeGeometry(s2, { depth: 0.42, bevelEnabled: false }); g2.translate(cx, H + 0.34, -0.12);
    put(g2, M.ledge, idT);
    put(sphG(0.2, cx, H + 0.6, 0.22, 1, 1, 0.4, 10), M.trim, idT);
  } else if (top === 'parapet') {
    put(boxG(w * 0.5, 0.9, 0.3, cx, H + 0.36, -0.05), wall, idT);
    put(boxG(w * 0.5 + 0.16, 0.12, 0.42, cx, H + 1.26, -0.05), M.ledge, idT);
    put(boxG(w * 0.2, 0.5, 0.3, cx, H + 1.38, -0.05), wall, idT);
    put(boxG(w * 0.2 + 0.14, 0.1, 0.4, cx, H + 1.88, -0.05), M.ledge, idT);
  }
  // roof clutter: a chimney or two, a little penthouse
  put(boxG(0.7, 1.4, 0.7, o.x0 + w * (0.2 + r() * 0.2), H, -DEPTH * 0.55), M.brick, id);
  if (r() < 0.5) put(boxG(2.2, 1.6, 2.2, o.x0 + w * 0.7, H, -DEPTH * 0.7), wall, id);

  return out;
}

// A blade sign hanging from a scrolled iron bracket, perpendicular to the
// facade: its board spans z from 0.4 to 0.4 + bw, hung below y.
export function bladeSign(put, M, x, y, mat, { bw = 1.6, bh = 0.95, seed = 0 } = {}) {
  const id = farId(Math.abs(Math.sin(x * 2.3 + y + seed * 7.1))), reach = bw + 0.6;
  put(boxG(0.1, 0.5, 0.06, x, y - 0.3, 0.03), M.iron, id);                     // wall plate
  put(boxG(0.05, 0.05, reach, x, y, reach / 2), M.iron, id);                    // the arm
  const brace = new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(reach * 0.6, 0.45), 5);
  brace.rotateX(Math.atan2(reach * 0.6, 0.45)); brace.translate(x, y - 0.22, reach * 0.3);
  put(brace, M.iron, id);
  const scroll = new THREE.TorusGeometry(0.16, 0.018, 4, 14, Math.PI * 1.5); scroll.rotateY(Math.PI / 2); scroll.translate(x, y - 0.17, 0.32);
  put(scroll, M.iron, id);
  put(sphG(0.045, x, y + 0.02, reach, 1, 1, 1, 6), M.iron, id);
  for (const z of [0.5, 0.3 + bw]) put(cylG(0.008, 0.008, 0.16, x, y - 0.16, z, 4), M.iron, id);
  const board = new THREE.BoxGeometry(0.06, bh, bw);
  board.translate(x, y - 0.16 - bh / 2, 0.4 + bw / 2);
  put(board, [mat, mat, M.dark, M.dark, M.dark, M.dark], id + 0.003);
}

// The café's room: counter, pastry case, espresso machine, menu boards on the
// back wall, pendant lamps. a: the room anchors from building().
export function cafeRoom(put, M, a) {
  const id = farId(0.37), cx = (a.x0 + a.x1) / 2, zb = a.zBack;
  // the counter along the back, with a wooden front and a pale top
  put(boxG(a.x1 - a.x0 - 1.6, 1.0, 0.7, cx - 0.3, 0, zb + 1.25), M.woodDark, id);
  put(boxG(a.x1 - a.x0 - 1.5, 0.06, 0.8, cx - 0.3, 1.0, zb + 1.25), M.trim, id);
  // the pastry case on the counter: a frame with a light inside
  put(boxG(1.6, 0.45, 0.6, cx - 1.6, 1.06, zb + 1.25), M.glow, id + 0.002);
  for (const sx of [-0.8, 0.8]) put(boxG(0.04, 0.45, 0.6, cx - 1.6 + sx, 1.06, zb + 1.25), M.dark, id);
  put(boxG(1.64, 0.04, 0.62, cx - 1.6, 1.51, zb + 1.25), M.dark, id);
  for (let k = 0; k < 4; k++) put(sphG(0.09, cx - 2.15 + k * 0.36, 1.18, zb + 1.2, 1.3, 0.7, 1, 8), M.wood, id + 0.004);
  // the espresso machine and cups
  put(boxG(0.7, 0.5, 0.45, cx + 0.8, 1.06, zb + 1.3), M.ironMid, id + 0.006);
  put(boxG(0.74, 0.06, 0.5, cx + 0.8, 1.56, zb + 1.3), M.iron, id + 0.006);
  for (let k = 0; k < 4; k++) put(cylG(0.05, 0.04, 0.09, cx + 1.4 + k * 0.14, 1.06, zb + 1.1, 8), M.trim, id + 0.008);
  // shelves and menu boards on the back wall
  for (const [mx, mat] of [[cx - 1.2, M.menuA], [cx + 0.6, M.menuB]]) {
    const g = new THREE.PlaneGeometry(0.9, 1.2); g.translate(mx, 2.35, zb + 0.035); put(g, mat, id + 0.01); // in front of the frame (zb - 0.015 .. zb + 0.025)
    put(boxG(1.0, 1.3, 0.04, mx, 1.7, zb + 0.005), M.dark, id + 0.012);
  }
  put(boxG(1.8, 0.05, 0.25, cx + 2.4, 1.9, zb + 0.13), M.wood, id + 0.014);
  for (let k = 0; k < 6; k++) put(cylG(0.06, 0.05, 0.12, cx + 1.7 + k * 0.28, 1.95, zb + 0.13, 8), M.trim, id + 0.016);
  // pendant lamps
  for (let k = 0; k < 3; k++) {
    const lx = cx - 2 + k * 2, lz = zb + 1.6;
    put(cylG(0.006, 0.006, 0.6, lx, a.ceil - 0.6, lz, 4), M.iron, id + 0.018);
    put(cylG(0.06, 0.24, 0.22, lx, a.ceil - 0.82, lz, 12), M.iron, id + 0.018);
    put(sphG(0.07, lx, a.ceil - 0.84, lz, 1, 1, 1, 8), M.glow, id + 0.02);
  }
}
