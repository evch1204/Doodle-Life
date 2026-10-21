import { Sketch, makeRng } from './sketch.js';
import { HANZI } from './taiwanTextures.js';

// Line-art textures for the airport lobby (the destination picker): the same
// wobbly pen on paper as everywhere else. Wayfinding signs are the one place a
// clean sans is used (white on dark), like real airport signs.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SANS_ZH = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const SIGN_BG = '#2c2622';

// ---- glyphs shared by signs ---------------------------------------------------------
// a small airliner seen from above, nose pointing right
export function planeGlyph(ctx, x, y, s, color = '#fff') {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(48, 0); ctx.quadraticCurveTo(50, -4, 44, -6);
  ctx.lineTo(10, -6); ctx.lineTo(-14, -40); ctx.lineTo(-24, -40); ctx.lineTo(-8, -6);
  ctx.lineTo(-30, -6); ctx.lineTo(-40, -18); ctx.lineTo(-48, -18); ctx.lineTo(-42, 0);
  ctx.lineTo(-48, 18); ctx.lineTo(-40, 18); ctx.lineTo(-30, 6); ctx.lineTo(-8, 6);
  ctx.lineTo(-24, 40); ctx.lineTo(-14, 40); ctx.lineTo(10, 6); ctx.lineTo(44, 6);
  ctx.quadraticCurveTo(50, 4, 48, 0);
  ctx.fill();
  ctx.restore();
}
function arrowGlyph(ctx, x, y, s, dir, color = '#fff') {
  ctx.save();
  ctx.translate(x, y); ctx.scale(dir * s / 100, s / 100);
  ctx.strokeStyle = color; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.moveTo(10, -30); ctx.lineTo(40, 0); ctx.lineTo(10, 30); ctx.stroke();
  ctx.restore();
}
// tiny skyline icons for the gate signs (white line drawings, ~100 px tall)
const ICONS = {
  pearl(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -95); ctx.lineTo(0, 50); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 18, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -42, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, 50); ctx.lineTo(-5, 5); ctx.moveTo(22, 50); ctx.lineTo(5, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-34, 50); ctx.lineTo(34, 50); ctx.stroke();
  },
  t101(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -98); ctx.lineTo(0, -78); ctx.stroke();
    let y = -78;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(10, y); ctx.lineTo(7, y + 17); ctx.lineTo(-7, y + 17); ctx.closePath(); ctx.stroke(); y += 17; }
    ctx.beginPath(); ctx.moveTo(-7, y); ctx.lineTo(-14, 50); ctx.moveTo(7, y); ctx.lineTo(14, 50); ctx.moveTo(-34, 50); ctx.lineTo(34, 50); ctx.stroke();
  },
  bridge(ctx) {
    // a Golden Gate tower and its cable sweeping down either side
    for (const x of [-10, 10]) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x * 0.8, -92); ctx.stroke(); }
    for (const y of [-80, -54, -28]) { ctx.beginPath(); ctx.moveTo(-9, y); ctx.lineTo(9, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-46, 6); ctx.quadraticCurveTo(-24, -10, -8, -88); ctx.moveTo(46, 6); ctx.quadraticCurveTo(24, -10, 8, -88); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-46, 6); ctx.lineTo(46, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-40, 50); ctx.lineTo(40, 50); ctx.stroke();
  },
  globe(ctx) {
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 44, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(44, 0); ctx.moveTo(-38, -22); ctx.lineTo(38, -22); ctx.moveTo(-38, 22); ctx.lineTo(38, 22); ctx.stroke();
  },
};

// A gate sign: dark board, a frame line, the city icon, English name, Chinese
// name smaller beneath, a small plane. The arrow is a separate mesh (it pulses),
// so the sign leaves room for it on its side (dir -1: left, 1: right).
export function gateSignTexture(gate, dir) {
  const W = 1024, H = 320, s = new Sketch(W, H, { seed: 601, bg: SIGN_BG });
  const ctx = s.ctx;
  s.rect(10, 10, W - 20, H - 20, { w: 4, j: 0.4, color: '#e9e2d6', alpha: 0.6 });
  const pad = 150; // the arrow's side
  const x0 = dir < 0 ? pad : 40;
  ctx.save(); ctx.translate(x0 + 70, H / 2 + 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ICONS[gate.icon](ctx);
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let size = 112;
  ctx.font = `500 ${size}px ${SANS}`;
  const room = W - x0 - 170 - (dir > 0 ? pad : 40);
  while (ctx.measureText(gate.nameEn).width > room && size > 60) { size -= 4; ctx.font = `500 ${size}px ${SANS}`; }
  ctx.fillText(gate.nameEn, x0 + 160, 150);
  ctx.font = `400 74px ${SANS_ZH}`;
  ctx.fillText(gate.nameZh, x0 + 162, 262);
  planeGlyph(ctx, dir < 0 ? 70 : W - 70, H - 64, 46, 'rgba(255,255,255,0.75)');
  return s.texture();
}

// The arrow alone (white on the sign color), for the pulsing mesh.
export function arrowTexture(dir) {
  const S = 256, s = new Sketch(S, S, { seed: 603, bg: SIGN_BG });
  arrowGlyph(s.ctx, S / 2, S / 2, 170, dir);
  return s.texture();
}

// The banner across the hall: "→ ✈ Choose Your Next Destination".
export function bannerTexture(text) {
  const W = 2048, H = 256, s = new Sketch(W, H, { seed: 605, bg: SIGN_BG });
  const ctx = s.ctx;
  s.rect(12, 12, W - 24, H - 24, { w: 5, j: 0.5, color: '#e9e2d6', alpha: 0.6 });
  arrowGlyph(ctx, 150, H / 2, 120, 1);
  planeGlyph(ctx, 330, H / 2, 120);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  let size = 118;
  ctx.font = `500 ${size}px ${SANS}`;
  while (ctx.measureText(text).width > W - 520 && size > 60) { size -= 4; ctx.font = `500 ${size}px ${SANS}`; }
  ctx.fillText(text, 440, H / 2 + 6);
  return s.texture();
}

// The pillar board: a plane, "Different Cities. Same Sky.", a cloud line at the bottom (the cloud itself is a mesh).
export function skyBoardTexture() {
  const W = 512, H = 1024, s = new Sketch(W, H, { seed: 607 });
  const ctx = s.ctx;
  s.rect(14, 14, W - 28, H - 28, { w: 9, j: 0.6 });
  s.rect(36, 36, W - 72, H - 72, { w: 2.4, j: 0.5, alpha: 0.6 });
  // a plane in outline, banking up and to the right
  ctx.save(); ctx.translate(W / 2, 250); ctx.rotate(-0.6); ctx.scale(2.2, 2.2);
  ctx.lineWidth = 3.4; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(48, 0); ctx.quadraticCurveTo(50, -4, 44, -6); ctx.lineTo(10, -6); ctx.lineTo(-14, -40); ctx.lineTo(-24, -40); ctx.lineTo(-8, -6);
  ctx.lineTo(-30, -6); ctx.lineTo(-40, -18); ctx.lineTo(-48, -18); ctx.lineTo(-42, 0); ctx.lineTo(-48, 18); ctx.lineTo(-40, 18); ctx.lineTo(-30, 6);
  ctx.lineTo(-8, 6); ctx.lineTo(-24, 40); ctx.lineTo(-14, 40); ctx.lineTo(10, 6); ctx.lineTo(44, 6); ctx.quadraticCurveTo(50, 4, 48, 0);
  ctx.stroke(); ctx.restore();
  for (const [str, y] of [['Different', 480], ['Cities.', 580], ['Same Sky.', 690]]) s.text(str, W / 2, y, 92);
  s.line(120, 790, W - 120, 792, { w: 2, j: 1, alpha: 0.4 });
  return s.texture();
}

// Clock face without hands (the hands are meshes that tick).
export function clockFaceTexture() {
  const S = 256, s = new Sketch(S, S, { seed: 609 });
  const c = S / 2;
  s.ellipse(c, c, c - 8, c - 8, { w: 9, j: 0.2 });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
    const r0 = c - 22, r1 = c - (big ? 46 : 32);
    s.line(c + Math.cos(a) * r0, c + Math.sin(a) * r0, c + Math.cos(a) * r1, c + Math.sin(a) * r1, { w: big ? 6 : 2, j: 0 });
  }
  return s.texture();
}

// The "i" medallion on the info desk.
export function infoTexture() {
  const S = 256, s = new Sketch(S, S, { seed: 611, bg: SIGN_BG });
  s.ellipse(S / 2, S / 2, 112, 112, { w: 6, j: 0.3, color: '#e9e2d6' });
  const ctx = s.ctx;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(S / 2, 70, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(S / 2 - 13, 104, 26, 92);
  ctx.fillRect(S / 2 - 28, 104, 30, 14); ctx.fillRect(S / 2 - 28, 184, 56, 14);
  return s.texture();
}

// Exit sign over the doors home.
export function exitSignTexture() {
  const W = 512, H = 160, s = new Sketch(W, H, { seed: 613, bg: SIGN_BG });
  const ctx = s.ctx;
  s.rect(8, 8, W - 16, H - 16, { w: 3, j: 0.4, color: '#e9e2d6', alpha: 0.6 });
  arrowGlyph(ctx, 70, H / 2, 70, -1);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `500 64px ${SANS}`; ctx.fillText('Exit', 130, H / 2 + 4);
  ctx.font = `400 54px ${SANS_ZH}`; ctx.fillText('出口', 300, H / 2 + 4);
  // a little house
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(430, 60); ctx.lineTo(462, 34); ctx.lineTo(494, 60); ctx.moveTo(438, 56); ctx.lineTo(438, 118); ctx.lineTo(486, 118); ctx.lineTo(486, 56); ctx.stroke();
  return s.texture();
}

// Lobby wall, one tile = one 1.5 m panel (u) by the full wall height (v):
// panel joints, a dado rail and a skirting board.
export function wallPanelTexture(H) {
  const W = 256, P = 1024, s = new Sketch(W, P, { seed: 615 });
  const y = (m) => P - (m / H) * P;
  s.line(2, -4, 2, P + 4, { w: 2.2, j: 0.3, alpha: 0.55 });
  s.line(W - 2, -4, W - 2, P + 4, { w: 1.2, j: 0.3, alpha: 0.25 });
  s.line(-4, y(1.05), W + 4, y(1.05), { w: 3, j: 0.3 });
  s.line(-4, y(1.12), W + 4, y(1.12), { w: 1.4, j: 0.3, alpha: 0.6 });
  s.line(-4, y(0.16), W + 4, y(0.16), { w: 2.4, j: 0.2 });
  s.hatch(0, y(0.16), W, P - y(0.16), { gap: 8, lw: 1.1, alpha: 0.35, angle: 0.9 });
  s.line(-4, y(H - 0.3), W + 4, y(H - 0.3), { w: 2, j: 0.3, alpha: 0.7 });
  for (let i = 0; i < 10; i++) s.ellipse(s.rand(10, W - 10), s.rand(y(H), y(1.2)), 1.2, 1.2, { w: 0, j: 0, fill: 'rgba(0,0,0,0.3)' });
  return s.texture({ repeat: true });
}

// The floor: the whole disc in one drawing (UV of a CircleGeometry of radius
// R): big square tiles, inlaid rings around the desk and the walk to the
// gates, and the polished stone's reflections: soft streaks running from each
// gate, the desk and the pillar toward the entrance (where you look from).
export function floorTexture(R, { gates, desk, viewer }) {
  const S = 2048, s = new Sketch(S, S, { seed: 617 });
  const ctx = s.ctx;
  const X = (x) => ((x / R + 1) / 2) * S, Y = (z) => ((z / R + 1) / 2) * S, M = S / (2 * R);
  // reflections first, under the tile lines
  const streaks = (px, pz, len, w, alpha, n) => {
    const dx = viewer[0] - px, dz = viewer[1] - pz, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    for (let k = 0; k < n; k++) {
      const off = (k / (n - 1) - 0.5) * w, ox = -uz * off, oz = ux * off;
      const l = len * (0.55 + 0.45 * Math.cos((k / (n - 1) - 0.5) * Math.PI));
      s.line(X(px + ox), Y(pz + oz), X(px + ox + ux * l), Y(pz + oz + uz * l), { w: 2.2, j: 0.6, alpha });
    }
  };
  for (const g of gates) streaks(g[0], g[1], 3.6, 2.4, 0.3, 11);
  streaks(desk[0], desk[1] + 1.9, 2.4, 3.4, 0.22, 13);
  // tiles: 1.2 m, with a darker joint every fifth line
  for (let i = -Math.ceil(R / 1.2); i <= Math.ceil(R / 1.2); i++) {
    const v = i * 1.2, strong = i % 5 === 0;
    s.line(X(v), 0, X(v) + s.rand(-2, 2), S, { w: strong ? 2.6 : 1.6, j: 0.6, alpha: strong ? 0.6 : 0.4 });
    s.line(0, Y(v), S, Y(v) + s.rand(-2, 2), { w: strong ? 2.6 : 1.6, j: 0.6, alpha: strong ? 0.6 : 0.4 });
  }
  // inlaid rings (paper inside, so the tile lines stop at them)
  const ring = (cx, cz, r0, r1, alpha) => {
    ctx.save(); ctx.beginPath(); ctx.arc(X(cx), Y(cz), r1 * M, 0, Math.PI * 2); ctx.arc(X(cx), Y(cz), r0 * M, 0, Math.PI * 2, true);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    s.ellipse(X(cx), Y(cz), r0 * M, r0 * M, { w: 2.6, j: 0.5, alpha });
    s.ellipse(X(cx), Y(cz), r1 * M, r1 * M, { w: 2.6, j: 0.5, alpha });
  };
  ring(desk[0], desk[1], 2.9, 3.25, 0.8);
  ring(0, 0, 6.3, 6.55, 0.6);
  // a soft polish: a few long diagonal glints
  for (let i = 0; i < 9; i++) {
    const x = s.rand(-R, R), z = s.rand(-R, R);
    s.line(X(x), Y(z), X(x + 1.4), Y(z - 1.0), { w: 1.4, j: 0.3, alpha: 0.18 });
  }
  return s.texture();
}

// ---- the views through the arches --------------------------------------------------------
// The far wall of a gate room is wider than the arch (4.2 x 3.2 m), so the
// canvas is too; each subject is drawn in the middle 832 px (what the arch
// frames from the hall, ox from the left) and the city / land runs the full width.
function viewBase(seed) {
  const W = 1344, H = 1024, s = new Sketch(W, H, { seed });
  return { W, H, s, ctx: s.ctx, r: makeRng(seed + 1), ox: (W - 832) / 2 };
}
const centred = (ctx, ox, draw) => { ctx.save(); ctx.translate(ox, 0); draw(); ctx.restore(); };
function cloud(s, x, y, w) {
  const n = 4, pts = [];
  for (let i = 0; i < n; i++) pts.push([x - w / 2 + ((i + 0.5) / n) * w, y - Math.sin(((i + 0.5) / n) * Math.PI) * w * 0.12, w * (0.12 + 0.08 * Math.sin(((i + 0.5) / n) * Math.PI))]);
  for (const [cx, cy, r] of pts) s.ellipse(cx, cy, r, r * 0.8, { w: 3, j: 0.5 });
  for (const [cx, cy, r] of pts) s.ellipse(cx, cy, r, r * 0.8, { w: 0, j: 0, fill: '#fff' });
  s.line(x - w / 2 - 8, y + 2, x + w / 2 + 8, y + 2, { w: 3, j: 0.6 });
}
function birds(s, r, n, x0, x1, y0, y1) {
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), w = 8 + r() * 6;
    s.stroke([[x - w, y - 3], [x - w * 0.3, y - 1], [x, y + 3], [x + w * 0.3, y - 1], [x + w, y - 3]], { w: 2, j: 0.2 });
  }
}
function block(s, x, base, w, h, { win = true, fill = '#fff' } = {}) {
  s.rect(x, base - h, w, h, { w: 2.6, j: 0.5, fill });
  if (!win) return;
  for (let y = base - h + 10; y < base - 10; y += 14) s.line(x + 5, y, x + w - 5, y, { w: 1.2, j: 0.2, alpha: 0.4 });
}

export function pudongView() {
  const { W, s, ctx, r, ox } = viewBase(621);
  const base = 700;
  // the band of towers
  for (let x = -10; x < W; x += 34 + r() * 30) block(s, x, base, 30 + r() * 30, 90 + r() * 140);
  centred(ctx, ox, () => {
  cloud(s, 200, 200, 220); cloud(s, 640, 150, 160);
  birds(s, r, 4, 420, 700, 240, 330);
  // Jin Mao: tiers and a spire
  { let y = base, w = 46; const cx = 470; for (let k = 0; k < 9; k++) { const h = 30 - k * 1.8; s.rect(cx - w / 2, y - h, w, h, { w: 2.4, j: 0.3, fill: '#fff' }); y -= h; w *= 0.92; } s.line(cx, y, cx, y - 60, { w: 2.6, j: 0.2 }); }
  // Shanghai Tower: a tall tapering twist
  s.stroke([[560, base], [548, 230], [566, 150], [600, 165], [612, 300], [618, base]], { w: 3, j: 0.4, closed: true, fill: '#fff' });
  s.stroke([[556, base - 20], [580, 420], [600, 200]], { w: 1.6, j: 0.4, alpha: 0.6 });
  // SWFC with its opening
  s.stroke([[650, base], [660, 210], [690, 200], [700, base]], { w: 3, j: 0.4, closed: true, fill: '#fff' });
  s.rect(668, 222, 16, 22, { w: 2.2, j: 0.2, fill: '#fff' });
  // the Pearl: legs, spheres, needle
  const px = 230;
  s.line(px - 30, base, px - 6, 520, { w: 4, j: 0.3 }); s.line(px + 30, base, px + 6, 520, { w: 4, j: 0.3 });
  s.line(px, base, px, 120, { w: 4, j: 0.3 });
  s.ellipse(px, 530, 42, 42, { w: 3.4, j: 0.3, fill: '#fff' }); s.hatch(px - 42, 530, 84, 42, { gap: 7, lw: 1.2, alpha: 0.35, clip: (c) => c.ellipse(px, 530, 42, 42, 0, 0, Math.PI * 2) });
  for (let k = 0; k < 3; k++) s.ellipse(px, 470 - k * 34, 10, 10, { w: 2.4, j: 0.2, fill: '#fff' });
  s.ellipse(px, 340, 28, 28, { w: 3.2, j: 0.3, fill: '#fff' });
  s.ellipse(px, 250, 12, 12, { w: 2.6, j: 0.2, fill: '#fff' });
  });
  // the river with its ripples
  s.line(-4, base, W + 4, base, { w: 3.4, j: 0.6 });
  for (let i = 0; i < 46; i++) { const y = base + 20 + r() * 300, x = r() * W, l = 20 + r() * 50 * (1 + (y - base) / 200); s.line(x, y, x + l, y + r() * 2 - 1, { w: 1.6 + (y - base) / 200, j: 0.4, alpha: 0.55 }); }
  return s.texture();
}

export function taipeiView() {
  const { W, H, s, ctx, r, ox } = viewBase(623);
  const base = 720;
  centred(ctx, ox, () => { cloud(s, 640, 210, 200); birds(s, r, 3, 120, 320, 220, 300); });
  // mountains behind
  const ridge = (y0, amp, ph, fill, w) => {
    const pts = [[-10, base]];
    for (let x = -10; x <= W + 10; x += 24) pts.push([x, y0 - amp * (0.6 * Math.sin(x * 0.009 + ph) + 0.4 * Math.sin(x * 0.023 + ph * 2))]);
    pts.push([W + 10, base]);
    s.stroke(pts, { w, j: 0.6, closed: true, fill });
  };
  ridge(470, 90, 1.3, '#fff', 2.4);
  ridge(560, 60, 0.4, '#fff', 3);
  // the city
  for (let x = -10; x < W; x += 30 + r() * 26) block(s, x, base, 28 + r() * 26, 40 + r() * 100);
  // Taipei 101: a tapering base, eight flaring segments, the crown and spire
  const cx = W / 2;
  s.stroke([[cx - 34, base], [cx - 22, 560], [cx + 22, 560], [cx + 34, base]], { w: 3, j: 0.3, closed: true, fill: '#fff' });
  s.ellipse(cx, 610, 9, 9, { w: 2.2, j: 0.1 });
  let y = 560;
  for (let k = 0; k < 8; k++) { s.stroke([[cx - 22, y], [cx - 28, y - 46], [cx + 28, y - 46], [cx + 22, y]], { w: 2.8, j: 0.3, closed: true, fill: '#fff' }); s.line(cx - 30, y - 46, cx + 30, y - 46, { w: 3.4, j: 0.2 }); y -= 46; }
  for (const [w, h] of [[20, 16], [14, 14], [9, 12]]) { s.rect(cx - w, y - h, w * 2, h, { w: 2.6, j: 0.2, fill: '#fff' }); y -= h; }
  s.line(cx, y, cx, y - 90, { w: 3, j: 0.2 });
  // a road toward it
  s.stroke([[cx - 60, H], [cx - 14, base + 4]], { w: 2.6, j: 0.6 }); s.stroke([[cx + 60, H], [cx + 14, base + 4]], { w: 2.6, j: 0.6 });
  s.line(-4, base, W + 4, base, { w: 3, j: 0.5 });
  for (let i = 0; i < 12; i++) s.line(r() * W, base + 40 + r() * 260, r() * W, base + 40 + r() * 260, { w: 1.4, j: 1.2, alpha: 0.25 });
  return s.texture();
}

// The Bay Area: the Golden Gate Bridge across the water, a cable car and a street lamp in front.
export function bayAreaView() {
  const { W, H, s, ctx, r, ox } = viewBase(629);
  const base = 640;
  // hills either side of the strait
  s.stroke([[-10, base], [120, 560], [300, 520], [470, base]], { w: 2.6, j: 0.8, fill: '#fff' });
  s.stroke([[820, base], [1000, 540], [1180, 570], [W + 10, 600], [W + 10, base]], { w: 2.6, j: 0.8, fill: '#fff' });
  centred(ctx, ox, () => {
    cloud(s, 640, 170, 190);
    birds(s, r, 3, 80, 300, 200, 280);
    // the bridge: two towers, the cable's sag, the deck, hangers
    const deck = 540, t1 = 180, t2 = 600, top = 250;
    for (const tx of [t1, t2]) {
      for (const dx of [-12, 12]) s.line(tx + dx, base + 10, tx + dx * 0.75, top, { w: 4.4, j: 0.2 });
      for (const y of [top + 14, top + 70, top + 130, top + 190]) s.line(tx - 11, y, tx + 11, y, { w: 3.4, j: 0.1 });
    }
    const cab = (x) => { if (x < t1) return top + (deck - 8 - top) * ((t1 - x) / t1) ** 1.4; if (x > t2) return top + (deck - 8 - top) * ((x - t2) / (832 - t2)) ** 1.4; const u = (x - (t1 + t2) / 2) / ((t2 - t1) / 2); return deck - 14 - (deck - 14 - top) * u * u; };
    const pts = []; for (let x = -40; x <= 872; x += 12) pts.push([x, cab(x)]);
    s.stroke(pts, { w: 3, j: 0.3 });
    for (let x = -30; x < 870; x += 16) if (Math.abs(x - t1) > 14 && Math.abs(x - t2) > 14) s.line(x, cab(x), x, deck, { w: 1.2, j: 0, alpha: 0.7 });
    s.rect(-40, deck, 912, 14, { w: 3, j: 0.3, fill: '#bbb' });
  });
  // the water
  s.line(-4, base, W + 4, base, { w: 3, j: 0.5 });
  for (let i = 0; i < 40; i++) { const y = base + 20 + r() * 200, x = r() * W, l = 20 + r() * 60; s.line(x, y, x + l, y, { w: 1.6, j: 0.4, alpha: 0.5 }); }
  // in front: a cable car on the right, a lamp post with its banner on the left
  const cx = W - 430, cy = H - 40;
  s.stroke([[cx, cy], [cx, cy - 250], [cx + 340, cy - 250], [cx + 340, cy]], { w: 3.4, j: 0.3, fill: '#fff' });
  s.rect(cx - 16, cy - 286, 372, 36, { w: 3.4, j: 0.3, fill: '#bbb' });
  s.rect(cx + 40, cy - 330, 260, 44, { w: 3, j: 0.3, fill: '#fff' });
  for (let i = 0; i < 5; i++) s.rect(cx + 20 + i * 62, cy - 230, 46, 92, { w: 2.6, j: 0.2, fill: '#888' });
  s.rect(cx, cy - 120, 340, 26, { w: 2.4, j: 0.2 });
  for (let i = 0; i < 6; i++) s.rect(cx + 14 + i * 54, cy - 84, 40, 60, { w: 1.8, j: 0.2, alpha: 0.7 });
  for (const wx of [cx + 60, cx + 120, cx + 230, cx + 290]) s.ellipse(wx, cy + 6, 22, 22, { w: 3, j: 0.2, fill: '#555' });
  s.line(cx - 200, cy + 28, W + 10, cy + 28, { w: 3, j: 0.3 });
  const lx = 150;
  s.line(lx, H + 6, lx, 330, { w: 7, j: 0.2 });
  s.stroke([[lx - 26, 330], [lx - 18, 280], [lx + 18, 280], [lx + 26, 330]], { w: 3, j: 0.2, closed: true, fill: '#fff' });
  s.line(lx - 30, 330, lx + 30, 330, { w: 4, j: 0.2 });
  s.rect(lx + 10, 380, 90, 200, { w: 3, j: 0.3, fill: '#555' });
  s.line(lx, 380, lx + 104, 380, { w: 4, j: 0.2 });
  return s.texture();
}

// "Next Stop": a faded world map on the wall of an empty gate, a plane badge.
export function worldMapView() {
  const { W, s, ctx, r, ox } = viewBase(627);
  ctx.save(); ctx.translate(ox, 0);
  const Wc = 832;
  ctx.globalAlpha = 0.55;
  const blob = (cx, cy, rx, ry, n = 14) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.75 + r() * 0.45; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    s.stroke(pts, { w: 2.6, j: 1.2, closed: true, fill: '#eee' });
  };
  s.rect(60, 200, Wc - 120, 440, { w: 3, j: 0.5 });
  blob(200, 330, 90, 70); blob(250, 500, 50, 90);          // the Americas
  blob(420, 320, 60, 50); blob(440, 470, 55, 90);          // Europe, Africa
  blob(590, 330, 120, 80); blob(660, 540, 50, 34);          // Asia, Australia
  ctx.globalAlpha = 1;
  // a dotted flight path and the plane badge
  for (let t = 0; t < 1; t += 0.035) { const x = 230 + t * 380, y = 360 - Math.sin(t * Math.PI) * 120; s.ellipse(x, y, 2.6, 2.6, { w: 0, j: 0, fill: '#000' }); }
  s.ellipse(Wc - 170, 780, 70, 70, { w: 4, j: 0.3 });
  planeGlyph(ctx, Wc - 170, 780, 80, '#000');
  s.rect(110, 820, 200, 18, { w: 2.6, j: 0.3, fill: '#fff' }); s.line(130, 838, 130, 880, { w: 3, j: 0.2 }); s.line(290, 838, 290, 880, { w: 3, j: 0.2 });
  ctx.restore();
  // the floor of the empty gate room
  s.line(-4, 880, W + 4, 880, { w: 3, j: 0.5 });
  return s.texture();
}

// ---- the jetway ---------------------------------------------------------------------
// side wall: one tile = one 1.4 m bay, a rounded window in each
export function jetwayWallTexture() {
  const W = 256, H = 512, s = new Sketch(W, H, { seed: 631 });
  s.line(2, -4, 2, H + 4, { w: 3.2, j: 0.3 });
  const x = 60, y = 150, w = 136, h = 190, rr = 40;
  s.stroke([[x + rr, y], [x + w - rr, y], ...s.ellipsePts(x + w - rr, y + rr, rr, rr, -Math.PI / 2, 0, 6), [x + w, y + h - rr], ...s.ellipsePts(x + w - rr, y + h - rr, rr, rr, 0, Math.PI / 2, 6), [x + rr, y + h], ...s.ellipsePts(x + rr, y + h - rr, rr, rr, Math.PI / 2, Math.PI, 6), [x, y + rr], ...s.ellipsePts(x + rr, y + rr, rr, rr, Math.PI, Math.PI * 1.5, 6)], { w: 4, j: 0.2, closed: true, fill: '#fff' });
  s.line(-4, H - 70, W + 4, H - 70, { w: 2, j: 0.3, alpha: 0.6 });
  s.hatch(0, H - 70, W, 70, { gap: 9, lw: 1, alpha: 0.3, angle: 0.8 });
  return s.texture({ repeat: true });
}
// floor: a carpet runner with a border stripe
export function jetwayFloorTexture() {
  const W = 256, H = 256, s = new Sketch(W, H, { seed: 633, bg: '#d8d8d8' });
  s.line(30, -4, 30, H + 4, { w: 3, j: 0.3 }); s.line(W - 30, -4, W - 30, H + 4, { w: 3, j: 0.3 });
  s.hatch(34, 0, W - 68, H, { gap: 10, lw: 1, alpha: 0.25, angle: 0.3 });
  return s.texture({ repeat: true });
}
