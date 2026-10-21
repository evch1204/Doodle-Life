import { Sketch, makeRng } from './sketch.js';
import { planeGlyph } from './lobbyTextures.js';

// Line-art textures for the Bay Area chapter (the San Francisco waterfront):
// the same wobbly pen on paper. Shop signs are painted boards (a serif);
// wayfinding is dark boards with a clean sans, like the airport.

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const BOARD = '#2c2622';
const CREAM = '#f3ede3';

// fit a line of text into a width by shrinking the font
function fit(ctx, text, maxW, size, font, weight = 400, min = 20) {
  ctx.font = `${weight} ${size}px ${font}`;
  while (ctx.measureText(text).width > maxW && size > min) { size -= 2; ctx.font = `${weight} ${size}px ${font}`; }
  return size;
}

// ---- small glyphs (drawn in a ~100 px box around x, y) -----------------------------------
// the Golden Gate: two towers, the cable's sag, the deck
function bridgeGlyph(s, x, y, k, o = {}) {
  const c = o.color ?? '#000', w = (o.w ?? 3) * Math.max(0.6, k);
  const P = (a, b) => [x + a * k, y + b * k];
  for (const tx of [-28, 28]) {
    s.line(...P(tx - 4, 30), ...P(tx - 3, -40), { w, j: 0, color: c });
    s.line(...P(tx + 4, 30), ...P(tx + 3, -40), { w, j: 0, color: c });
    for (const ty of [-34, -18, -2]) s.line(...P(tx - 4, ty), ...P(tx + 4, ty), { w: w * 0.7, j: 0, color: c });
  }
  const cab = (u) => (Math.abs(u) <= 28 ? -38 + 34 * (1 - (u / 28) ** 2) : -38 + (Math.abs(u) - 28) * 1.3);
  const pts = []; for (let u = -58; u <= 58; u += 4) pts.push(P(u, Math.min(8, cab(u))));
  s.stroke(pts, { w: w * 0.8, j: 0, color: c });
  for (let u = -52; u <= 52; u += 8) if (Math.abs(Math.abs(u) - 28) > 4) s.line(...P(u, Math.min(8, cab(u))), ...P(u, 10), { w: w * 0.4, j: 0, color: c });
  s.line(...P(-62, 10), ...P(62, 10), { w, j: 0, color: c });
}
// the Ferry Building: a long hall and its clock tower
function ferryGlyph(s, x, y, k, o = {}) {
  const c = o.color ?? '#000', w = (o.w ?? 3) * Math.max(0.6, k);
  const P = (a, b) => [x + a * k, y + b * k];
  s.stroke([P(-48, 24), P(-48, 6), P(48, 6), P(48, 24)], { w, j: 0, color: c });
  s.stroke([P(-8, 6), P(-8, -30), P(8, -30), P(8, 6)], { w, j: 0, color: c });
  s.stroke([P(-6, -30), P(0, -44), P(6, -30)], { w, j: 0, color: c });
  s.ellipse(...P(0, -18), 4 * k, 4 * k, { w: w * 0.7, j: 0, color: c });
  for (let i = 0; i < 7; i++) s.line(...P(-42 + i * 14, 12), ...P(-42 + i * 14, 22), { w: w * 0.6, j: 0, color: c });
  s.line(...P(-56, 24), ...P(56, 24), { w, j: 0, color: c });
}
// Alcatraz: the island, the cellhouse and the lighthouse
function islandGlyph(s, x, y, k, o = {}) {
  const c = o.color ?? '#000', w = (o.w ?? 3) * Math.max(0.6, k);
  const P = (a, b) => [x + a * k, y + b * k];
  s.stroke([P(-54, 18), P(-38, 6), P(-20, 2), P(30, 2), P(44, 8), P(56, 18)], { w, j: 0, color: c });
  s.stroke([P(-26, 2), P(-26, -12), P(20, -12), P(20, 2)], { w, j: 0, color: c });
  for (let i = 0; i < 5; i++) s.line(...P(-20 + i * 9, -8), ...P(-20 + i * 9, -2), { w: w * 0.5, j: 0, color: c });
  s.stroke([P(28, 2), P(30, -26), P(34, -26), P(36, 2)], { w, j: 0, color: c });
  s.stroke([P(27, -26), P(32, -33), P(37, -26)], { w, j: 0, color: c });
  for (const d of [-1, 1]) s.line(...P(32 + d * 8, -30), ...P(32 + d * 18, -32), { w: w * 0.5, j: 0, color: c });
  for (const u of [-40, 0, 40]) s.line(...P(u - 10, 26), ...P(u + 10, 26), { w: w * 0.5, j: 0.3, color: c });
}
// a small sailboat
function boatGlyph(s, x, y, k, o = {}) {
  const c = o.color ?? '#000', w = (o.w ?? 3) * Math.max(0.6, k);
  const P = (a, b) => [x + a * k, y + b * k];
  s.stroke([P(-30, 10), P(30, 10), P(22, 22), P(-24, 22)], { w, j: 0, color: c, closed: true });
  s.line(...P(0, 10), ...P(0, -44), { w, j: 0, color: c });
  s.stroke([P(2, -40), P(26, 6), P(2, 6)], { w, j: 0, color: c, closed: true });
  s.stroke([P(-3, -34), P(-22, 6), P(-3, 6)], { w, j: 0, color: c, closed: true });
}
// an airliner seen from above, nose pointing right
const GLYPHS = { bridge: bridgeGlyph, ferry: ferryGlyph, island: islandGlyph, boat: boatGlyph };

// ---- wayfinding --------------------------------------------------------------------------
// One arm of the fingerpost: a dark board, the name, a small line icon, an arrow.
// dir 1 points right, -1 left (the board is drawn the same on both faces).
export function armSignTexture(text, { icon = null, dir = 1, seed = 931 } = {}) {
  const W = 1024, H = 200, s = new Sketch(W, H, { seed, bg: BOARD });
  const ctx = s.ctx;
  s.rect(10, 10, W - 20, H - 20, { w: 4, j: 0.3, color: '#e9e2d6', alpha: 0.65 });
  const ax = dir > 0 ? W - 92 : 92, ay = H / 2;
  ctx.save(); ctx.translate(ax, ay); ctx.scale(dir, 1);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.moveTo(8, -26); ctx.lineTo(34, 0); ctx.lineTo(8, 26); ctx.stroke();
  ctx.restore();
  const x0 = dir > 0 ? 44 : 180, x1 = dir > 0 ? W - 180 : W - 44;
  let tx = x0;
  if (icon === 'plane') { planeGlyph(ctx, x0 + 56, ay, 92, '#fff'); tx = x0 + 128; }
  else if (icon) { GLYPHS[icon](s, x0 + 64, ay + 4, 1.0, { color: '#fff', w: 3.4 }); tx = x0 + 148; }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  fit(ctx, text, x1 - tx, 92, SANS, 500, 40);
  ctx.fillText(text, tx, ay + 4);
  return s.texture();
}

// A street-name blade (on a lamp post): white letters on a dark green-black board.
export function streetNameTexture(text, seed = 933) {
  const W = 768, H = 160, s = new Sketch(W, H, { seed, bg: '#24282a' });
  s.rect(8, 8, W - 16, H - 16, { w: 4, j: 0.2, color: '#fff', alpha: 0.85 });
  const ctx = s.ctx;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fit(ctx, text, W - 80, 92, SANS, 600);
  ctx.fillText(text, W / 2, H / 2 + 4);
  return s.texture();
}

// The pole banner: "San Francisco" over the bridge and a wave line.
export function cityBannerTexture(seed = 935) {
  const W = 256, H = 640, s = new Sketch(W, H, { seed, bg: '#35302b' });
  s.rect(12, 12, W - 24, H - 40, { w: 3, j: 0.3, color: '#e9e2d6', alpha: 0.75 });
  const ctx = s.ctx;
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `400 58px ${SERIF}`; ctx.fillText('San', W / 2, 150);
  fit(ctx, 'Francisco', W - 40, 54, SERIF); ctx.fillText('Francisco', W / 2, 216);
  bridgeGlyph(s, W / 2, 380, 1.45, { color: CREAM, w: 2.6 });
  for (const y of [470, 492]) s.stroke([[50, y], [80, y - 8], [110, y], [140, y - 8], [170, y], [200, y - 8]], { w: 3, j: 0.2, color: CREAM });
  for (let x = 18; x < W - 10; x += 14) s.line(x, H - 30, x, H - 6, { w: 3, j: 0.2, color: '#35302b' });
  return s.texture();
}

// ---- shop signs --------------------------------------------------------------------------
// The café's hanging sign: CAFE / BAY VIEW / COFFEE · TEA · PASTRIES.
export function cafeSignTexture(seed = 937) {
  const W = 1024, H = 600, s = new Sketch(W, H, { seed, bg: BOARD });
  s.rect(14, 14, W - 28, H - 28, { w: 6, j: 0.3, color: '#e9e2d6', alpha: 0.9 });
  s.rect(36, 36, W - 72, H - 72, { w: 2.4, j: 0.3, color: '#e9e2d6', alpha: 0.6 });
  const ctx = s.ctx;
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `400 150px ${SERIF}`; ctx.fillText('CAFE', W / 2, 170);
  ctx.font = `400 128px ${SERIF}`; ctx.fillText('BAY VIEW', W / 2, 325);
  s.line(170, 412, W - 170, 412, { w: 2.4, j: 0.3, color: CREAM, alpha: 0.7 });
  fit(ctx, 'COFFEE  •  TEA  •  PASTRIES', W - 140, 64, SERIF); ctx.fillText('COFFEE  •  TEA  •  PASTRIES', W / 2, 482);
  return s.texture();
}

// A painted shop sign: a board with a name (and an optional smaller line).
// dark: cream letters on a dark board; else dark letters on cream.
export function shopSignTexture(text, { sub = '', dark = true, seed = 911, W = 1024, H = 200 } = {}) {
  const bg = dark ? BOARD : '#efe9dc', fg = dark ? CREAM : '#211c18';
  const s = new Sketch(W, H, { seed, bg });
  s.rect(10, 10, W - 20, H - 20, { w: 5, j: 0.3, color: fg, alpha: 0.75 });
  const ctx = s.ctx;
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (sub) {
    fit(ctx, text, W - 90, H * 0.44, SERIF, 700); ctx.fillText(text, W / 2, H * 0.4);
    fit(ctx, sub, W - 120, H * 0.2, SERIF, 400); ctx.fillText(sub, W / 2, H * 0.76);
  } else {
    fit(ctx, text, W - 90, H * 0.56, SERIF, 700); ctx.fillText(text, W / 2, H / 2 + 4);
  }
  return s.texture();
}

// The A-frame chalkboard: hand lettering and a smile.
export function chalkboardTexture(lines = ['Good', 'Food', 'Better', 'Views'], seed = 939) {
  const W = 384, H = 560, s = new Sketch(W, H, { seed, bg: '#2a2725' });
  s.rect(8, 8, W - 16, H - 16, { w: 14, j: 0.4, color: '#6f6559' });
  for (let i = 0; i < 40; i++) { const x = s.rand(30, W - 30), y = s.rand(30, H - 30); s.line(x, y, x + s.rand(10, 30), y + s.rand(-4, 4), { w: 1, j: 0.2, color: '#fff', alpha: 0.06 }); }
  lines.forEach((t, i) => s.text(t, W / 2, 96 + i * 92, 86, { color: '#f4f1ea' }));
  s.arc(W / 2, H - 92, 34, 22, 0.3, Math.PI - 0.3, { w: 5, j: 0.3, color: '#f4f1ea' });
  for (const dx of [-16, 16]) s.ellipse(W / 2 + dx, H - 108, 3, 4, { w: 0, j: 0, fill: '#f4f1ea' });
  return s.texture();
}

// The face of the round Fisherman's Wharf sign (on a disc; the wheel's
// handles are geometry): the name round the rim, a crab in the middle.
export function wharfWheelTexture(seed = 941) {
  const S = 768, s = new Sketch(S, S, { seed, bg: BOARD });
  const c = S / 2, ctx = s.ctx;
  s.ellipse(c, c, 368, 368, { w: 4, j: 0.2, color: '#e9e2d6' });
  s.ellipse(c, c, 200, 200, { w: 4, j: 0.2, color: '#e9e2d6', fill: '#efe9dc' });
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // the name round the top of the rim, letter by letter
  const name = "FISHERMAN'S WHARF";
  ctx.font = `700 70px ${SERIF}`;
  const span = 2.7, a0 = -Math.PI / 2 - span / 2;
  [...name].forEach((ch, i) => {
    const a = a0 + (span * (i + 0.5)) / name.length;
    ctx.save(); ctx.translate(c + Math.cos(a) * 290, c + Math.sin(a) * 290); ctx.rotate(a + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
  });
  ctx.font = `400 52px ${SERIF}`;
  const sub = 'SAN FRANCISCO', span2 = 1.7, b0 = Math.PI / 2 + span2 / 2;
  [...sub].forEach((ch, i) => {
    const a = b0 - (span2 * (i + 0.5)) / sub.length;
    ctx.save(); ctx.translate(c + Math.cos(a) * 292, c + Math.sin(a) * 292); ctx.rotate(a - Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
  });
  // the crab
  const k = 1.5;
  s.ellipse(c, c + 12, 62 * k, 40 * k, { w: 5, j: 0.3, fill: '#d9d2c4' });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) s.stroke([[c + sx * 56 * k, c + (6 + i * 16) * k], [c + sx * 90 * k, c + (2 + i * 22) * k], [c + sx * 104 * k, c + (30 + i * 22) * k]], { w: 5, j: 0.3 });
    s.stroke([[c + sx * 40 * k, c - 20 * k], [c + sx * 66 * k, c - 62 * k], [c + sx * 84 * k, c - 74 * k]], { w: 5, j: 0.3 });
    s.ellipse(c + sx * 88 * k, c - 84 * k, 20 * k, 14 * k, { w: 5, j: 0.3, fill: '#d9d2c4' });
    s.line(c + sx * 14 * k, c - 24 * k, c + sx * 18 * k, c - 44 * k, { w: 4, j: 0.2 });
    s.ellipse(c + sx * 18 * k, c - 48 * k, 5, 5, { w: 0, j: 0, fill: '#000' });
  }
  return s.texture();
}

// ---- maps and boards ---------------------------------------------------------------------
// The visitor map board on the promenade: "BAY AREA", the map, a key, the bridge.
export function mapBoardTexture() {
  const W = 768, H = 1024, s = new Sketch(W, H, { seed: 907, bg: '#efe9dc' });
  s.rect(12, 12, W - 24, H - 24, { w: 8, j: 0.4 });
  const ctx = s.ctx;
  ctx.fillStyle = '#211c18'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `700 76px ${SANS}`; ctx.fillText('BAY AREA', 46, 84);
  s.line(46, 130, W - 46, 130, { w: 3, j: 0.3 });
  s.rect(46, 150, W - 92, 470, { w: 3, j: 0.3 });
  drawBayMap(s, 52, 156, W - 104, 458, { labels: false });
  const keys = ['San Francisco', 'Golden Gate Bridge', 'Alcatraz Island', 'Ferry Building'];
  keys.forEach((k, i) => {
    s.ellipse(66, 668 + i * 50, 8, 8, { w: 0, j: 0, fill: '#000' });
    ctx.font = `500 38px ${SANS}`; ctx.fillStyle = '#211c18'; ctx.fillText(k, 92, 670 + i * 50);
  });
  s.rect(46, 880, W - 92, 110, { w: 2.4, j: 0.3 });
  bridgeGlyph(s, W / 2, 930, 2.6, { w: 2 });
  return s.texture();
}

// The waterfront, simplified: the city's corner of the peninsula, the Golden
// Gate with its bridge, Marin above it, Alcatraz in the bay, the Ferry Building
// and the Embarcadero along the eastern shore ("you are here").
export function drawBayMap(s, x0, y0, w, h, { labels = true } = {}) {
  const ctx = s.ctx;
  const X = (u) => x0 + u * w, Y = (v) => y0 + v * h;
  const poly = (pts) => { ctx.beginPath(); pts.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v)))); ctx.closePath(); };
  // water everywhere, hatched lightly; land drawn over it in paper
  s.hatch(x0, y0, w, h, { gap: 14, lw: 1.2, alpha: 0.28, angle: 0.4 });
  const sf = [[0.0, 0.44], [0.16, 0.42], [0.3, 0.4], [0.46, 0.38], [0.6, 0.36], [0.7, 0.4], [0.74, 0.5], [0.78, 0.62], [0.84, 0.78], [0.86, 1.0], [0.0, 1.0]];
  const marin = [[0.0, 0.0], [0.62, 0.0], [0.54, 0.08], [0.42, 0.14], [0.3, 0.2], [0.18, 0.26], [0.0, 0.3]];
  const east = [[1.0, 0.0], [0.86, 0.06], [0.92, 0.2], [0.96, 0.42], [1.0, 0.5]];
  for (const p of [sf, marin, east]) { poly(p); ctx.fillStyle = '#efe9dc'; ctx.fill(); s.stroke(p.map(([u, v]) => [X(u), Y(v)]), { w: 3, j: 0.6, closed: true }); }
  // streets on the city, hills on Marin
  for (let i = 0; i < 6; i++) s.line(X(0.06 + i * 0.12), Y(0.5), X(0.06 + i * 0.12), Y(0.96), { w: 1.2, j: 0.2, alpha: 0.35 });
  for (let i = 0; i < 4; i++) s.line(X(0.02), Y(0.56 + i * 0.1), X(0.72), Y(0.56 + i * 0.1), { w: 1.2, j: 0.2, alpha: 0.35 });
  for (const [u, v] of [[0.12, 0.14], [0.26, 0.1], [0.42, 0.06]]) s.arc(X(u), Y(v), 26, 14, Math.PI, Math.PI * 2, { w: 2, j: 0.3, alpha: 0.7 });
  // the bridge across the strait
  s.line(X(0.14), Y(0.43), X(0.2), Y(0.25), { w: 6, j: 0 });
  for (const t of [0.3, 0.7]) { const u = 0.14 + 0.06 * t, v = 0.43 - 0.18 * t; s.line(X(u) - 8, Y(v), X(u) + 8, Y(v), { w: 4, j: 0 }); }
  // Alcatraz, the Ferry Building, the Embarcadero ("you are here")
  s.ellipse(X(0.5), Y(0.24), 16, 9, { w: 2.6, j: 0.2, fill: '#efe9dc' });
  s.rect(X(0.74) - 6, Y(0.52) - 6, 12, 12, { w: 2.4, j: 0, fill: '#000' });
  s.stroke([[X(0.58), Y(0.37)], [X(0.68), Y(0.4)], [X(0.73), Y(0.5)]], { w: 4, j: 0.2, alpha: 0.8 });
  s.ellipse(X(0.62), Y(0.385), 10, 10, { w: 0, j: 0, fill: '#000' });
  s.ellipse(X(0.62), Y(0.385), 18, 18, { w: 2.6, j: 0.2 });
  if (labels) {
    s.text('Golden Gate Bridge', X(0.17), Y(0.33), 30, { align: 'left', rot: -0.05 });
    s.text('Marin', X(0.26), Y(0.06), 34);
    s.text('Alcatraz', X(0.5), Y(0.18), 28);
    s.text('San Francisco', X(0.34), Y(0.72), 40);
    s.text('Ferry Building', X(0.73), Y(0.58), 26, { align: 'right' });
    s.text('you are here', X(0.6), Y(0.45), 28);
    s.text('San Francisco Bay', X(0.86), Y(0.3), 28, { rot: 1.1 });
  }
  // a compass rose
  const cx = X(0.92), cy = Y(0.86);
  s.line(cx, cy - 30, cx, cy + 30, { w: 2.4, j: 0 }); s.line(cx - 20, cy, cx + 20, cy, { w: 1.6, j: 0 });
  s.stroke([[cx - 8, cy - 14], [cx, cy - 34], [cx + 8, cy - 14]], { w: 2.4, j: 0, closed: true, fill: '#000' });
  s.text('N', cx, cy - 50, 26);
}

// The map card (the HUD), drawn on a canvas and handed over as an image URL.
export function mapCardImage() {
  const W = 760, H = 560, s = new Sketch(W, H, { seed: 909, bg: '#efe9dc' });
  drawBayMap(s, 20, 20, W - 40, H - 40);
  return s.canvas.toDataURL('image/png');
}

// The interpretive plaque at the pier's lookout: the bridge and a few facts.
export function lookoutPlaqueTexture(seed = 943) {
  const W = 768, H = 512, s = new Sketch(W, H, { seed, bg: '#efe9dc' });
  s.rect(10, 10, W - 20, H - 20, { w: 7, j: 0.3 });
  const ctx = s.ctx;
  ctx.fillStyle = '#211c18'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 54px ${SANS}`; ctx.fillText('GOLDEN GATE BRIDGE', W / 2, 70);
  bridgeGlyph(s, W / 2, 230, 3.6, { w: 1.6 });
  for (let i = 0; i < 14; i++) { const x = s.rand(80, W - 80), y = s.rand(300, 330); s.line(x, y, x + 30, y, { w: 1.4, j: 0.3, alpha: 0.5 }); }
  ctx.font = `400 34px ${SANS}`;
  ctx.fillText('Opened 1937  ·  1.7 miles long', W / 2, 382);
  ctx.fillText('Towers 746 ft above the water', W / 2, 432);
  return s.texture();
}

// ---- the cable car -----------------------------------------------------------------------
// The roof-end destination board.
export function cableCarSignTexture(text = 'POWELL & HYDE STS.', seed = 945) {
  const W = 1024, H = 128, s = new Sketch(W, H, { seed, bg: '#f2ede2' });
  s.rect(6, 6, W - 12, H - 12, { w: 5, j: 0.2 });
  const ctx = s.ctx;
  ctx.fillStyle = '#1c1916'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fit(ctx, text, W - 60, 84, SERIF, 700); ctx.fillText(text, W / 2, H / 2 + 4);
  return s.texture();
}
// The dash panel at each end: the car number in a round plate.
export function cableCarNumberTexture(num = '28', seed = 947) {
  const W = 512, H = 256, s = new Sketch(W, H, { seed, bg: '#d9d2c4' });
  s.rect(8, 8, W - 16, H - 16, { w: 4, j: 0.2 });
  s.rect(26, 26, W - 52, H - 52, { w: 2, j: 0.2, alpha: 0.6 });
  s.ellipse(W / 2, H / 2, 78, 78, { w: 5, j: 0.1, fill: '#f6f2ea' });
  const ctx = s.ctx;
  ctx.fillStyle = '#1c1916'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 96px ${SERIF}`; ctx.fillText(num, W / 2, H / 2 + 6);
  for (const x of [70, W - 70]) s.ellipse(x, H / 2, 26, 26, { w: 4, j: 0.1 });
  return s.texture();
}
// Painted lettering along the car's side panel (u along the car).
export function cableCarSideTexture(seed = 949) {
  const W = 1024, H = 128, s = new Sketch(W, H, { seed, bg: '#d9d2c4' });
  s.rect(6, 6, W - 12, H - 12, { w: 3, j: 0.2 });
  for (const x of [W * 0.12, W * 0.88]) s.ellipse(x, H / 2, 24, 24, { w: 3, j: 0.2 });
  const ctx = s.ctx;
  ctx.fillStyle = '#1c1916'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 60px ${SERIF}`; ctx.fillText('MUNICIPAL  RAILWAY', W / 2, H / 2 + 4);
  return s.texture();
}

// ---- surfaces ----------------------------------------------------------------------------
// Stucco (triplanar): a few trowel marks, clean.
export function stuccoTexture(seed = 913) {
  const S = 512, s = new Sketch(S, S, { seed });
  for (let i = 0; i < 18; i++) { const x = s.rand(0, S), y = s.rand(0, S); s.arc(x, y, s.rand(14, 30), s.rand(6, 12), 0.3, Math.PI - 0.3, { w: 1.1, j: 0.4, alpha: 0.18 }); }
  for (let i = 0; i < 30; i++) s.ellipse(s.rand(0, S), s.rand(0, S), 1, 1, { w: 0, j: 0, fill: 'rgba(0,0,0,0.2)' });
  return s.texture({ repeat: true });
}
// Brick in running bond (triplanar, 1 tile = 1.6 m): light joints, a few
// bricks picked out, so the wall reads as brick without going gray.
export function brickTexture(seed = 951) {
  const S = 512, s = new Sketch(S, S, { seed });
  const r = makeRng(seed), rows = 20, rh = S / rows, bw = rh * 3.2;
  for (let i = 0; i <= rows; i++) s.line(-4, i * rh, S + 4, i * rh, { w: 1.4, j: 0.3, alpha: 0.4 });
  for (let i = 0; i < rows; i++) {
    const off = (i % 2) * bw * 0.5;
    for (let x = -off; x < S; x += bw) {
      s.line(x, i * rh + 1, x, (i + 1) * rh - 1, { w: 1.2, j: 0.1, alpha: 0.38 });
      if (r() < 0.06) s.hatch(x + 2, i * rh + 2, bw - 4, rh - 4, { gap: 5, lw: 1, alpha: 0.25, angle: 0.9 });
    }
  }
  return s.texture({ repeat: true });
}
// Clapboard siding (triplanar, 1 tile = 2 m): horizontal boards, a shadow line under each.
export function sidingTexture(seed = 953) {
  const S = 512, s = new Sketch(S, S, { seed });
  const n = 12, rh = S / n;
  for (let i = 0; i < n; i++) {
    s.line(-4, i * rh, S + 4, i * rh + s.rand(-0.5, 0.5), { w: 2.2, j: 0.25, alpha: 0.7 });
    s.line(-4, i * rh + 4, S + 4, i * rh + 4, { w: 1, j: 0.2, alpha: 0.25 });
  }
  return s.texture({ repeat: true });
}
// Concrete street with expansion joints and a few patches (triplanar, 1 tile = 4 m).
export function streetTexture(seed = 955) {
  const S = 512, s = new Sketch(S, S, { seed });
  s.line(-4, 2, S + 4, 2, { w: 1.6, j: 0.4, alpha: 0.4 });
  s.line(2, -4, 2, S + 4, { w: 1.6, j: 0.4, alpha: 0.4 });
  for (let i = 0; i < 3; i++) { const x = s.rand(40, S - 80), y = s.rand(40, S - 80); s.stroke([[x, y], [x + s.rand(20, 50), y + s.rand(-10, 10)], [x + s.rand(40, 80), y + s.rand(0, 30)]], { w: 1.2, j: 0.8, alpha: 0.35 }); }
  for (let i = 0; i < 60; i++) s.ellipse(s.rand(0, S), s.rand(0, S), 1, 1, { w: 0, j: 0, fill: 'rgba(0,0,0,0.22)' });
  return s.texture({ repeat: true });
}

// ---- the far field and the pier (kept from the earlier waterfront) ---------------------
// The bridge deck's side truss (u along the deck, 1 tile = 8 m): verticals and diagonals.
export function trussTexture(seed = 917) {
  const W = 256, H = 64, s = new Sketch(W, H, { seed });
  s.line(-2, 4, W + 2, 4, { w: 4, j: 0 }); s.line(-2, H - 4, W + 2, H - 4, { w: 4, j: 0 });
  for (let i = 0; i <= 4; i++) s.line(i * 64, 0, i * 64, H, { w: 3, j: 0 });
  for (let i = 0; i < 4; i++) { s.line(i * 64, 4, i * 64 + 32, H - 4, { w: 2, j: 0 }); s.line(i * 64 + 32, H - 4, i * 64 + 64, 4, { w: 2, j: 0 }); }
  return s.texture({ repeat: true });
}

// Pier planks (triplanar): long boards with nail dots.
export function planksTexture(seed = 919) {
  const S = 512, s = new Sketch(S, S, { seed });
  const r = makeRng(seed);
  for (let i = 0; i <= 16; i++) s.line(-4, i * 32, S + 4, i * 32 + s.rand(-1, 1), { w: 2, j: 0.4, alpha: 0.7 });
  for (let i = 0; i < 16; i++) {
    let x = r() * 200;
    while (x < S) { s.line(x, i * 32 + 2, x, i * 32 + 30, { w: 1.6, j: 0.1, alpha: 0.6 }); x += 160 + r() * 200; }
    for (let k = 0; k < 4; k++) s.ellipse(r() * S, i * 32 + 16, 1.4, 1.4, { w: 0, j: 0, fill: '#000' });
  }
  return s.texture({ repeat: true });
}

// A palm frond (UV: u across the frond, v from the stem to the tip): a rib
// down the middle and leaflets raking out from it, drawn as a herringbone.
export function frondTexture(seed = 921) {
  const W = 128, H = 512, s = new Sketch(W, H, { seed });
  const c = W / 2;
  s.line(c, 0, c, H, { w: 4, j: 0.2 });
  for (let y = 10; y < H; y += 14) {
    const k = 1 - y / H;
    s.line(c, y, c - (c - 4) * (0.6 + 0.4 * k), y + 30, { w: 1.8, j: 0.2, alpha: 0.85 });
    s.line(c, y, c + (c - 4) * (0.6 + 0.4 * k), y + 30, { w: 1.8, j: 0.2, alpha: 0.85 });
  }
  return s.texture();
}

// Palm trunk rings (cylinder UV, v up the trunk): close rough bands.
export function trunkTexture(seed = 923) {
  const W = 128, H = 512, s = new Sketch(W, H, { seed });
  for (let y = 6; y < H; y += 16) s.stroke([[-4, y], [W * 0.3, y + s.rand(-3, 3)], [W * 0.7, y + s.rand(-3, 3)], [W + 4, y]], { w: 2.2, j: 0.6, alpha: 0.75 });
  return s.texture({ repeat: true });
}

// Leaf clusters for the street trees (triplanar): small scalloped strokes.
export function foliageTexture(seed = 957) {
  const S = 512, s = new Sketch(S, S, { seed });
  for (let i = 0; i < 140; i++) { const x = s.rand(0, S), y = s.rand(0, S), r = s.rand(8, 16); s.arc(x, y, r, r * 0.7, 0.2, Math.PI - 0.2, { w: 1.4, j: 0.3, alpha: 0.55 }); }
  return s.texture({ repeat: true });
}

// A shop's display window (UV 0..1 over the glass): dark glass with a glint,
// a shelf and the goods on it, drawn small. kind: 'bread' | 'books' | 'gifts' | 'plain'
export function shopWindowTexture(kind = 'plain', seed = 959) {
  const W = 512, H = 384, s = new Sketch(W, H, { seed });
  const ctx = s.ctx;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7c7a76'); g.addColorStop(1, '#4a4844');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const shelf = H * 0.7;
  ctx.fillStyle = '#cfcac0'; ctx.fillRect(0, shelf, W, H - shelf);
  s.line(-4, shelf, W + 4, shelf, { w: 3, j: 0.3 });
  const r = makeRng(seed);
  if (kind === 'bread') for (let x = 30; x < W - 40; x += 70 + r() * 20) { s.ellipse(x + 26, shelf - 18, 32, 18, { w: 3, j: 0.4, fill: '#e8e2d6' }); for (let k = 0; k < 3; k++) s.line(x + 10 + k * 14, shelf - 28, x + 18 + k * 14, shelf - 10, { w: 2, j: 0.2 }); }
  else if (kind === 'books') for (let x = 20; x < W - 30; x += 18 + r() * 10) { const h = 50 + r() * 50; s.rect(x, shelf - h, 14 + r() * 6, h, { w: 2, j: 0.2, fill: r() < 0.5 ? '#e8e2d6' : '#9a958c' }); }
  else if (kind === 'gifts') for (let x = 30; x < W - 50; x += 80 + r() * 30) { const h = 40 + r() * 50; s.rect(x, shelf - h, 46, h, { w: 2.6, j: 0.3, fill: '#e8e2d6' }); s.line(x + 23, shelf - h, x + 23, shelf, { w: 2, j: 0.2 }); s.line(x, shelf - h * 0.5, x + 46, shelf - h * 0.5, { w: 2, j: 0.2 }); }
  ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 26;
  ctx.beginPath(); ctx.moveTo(W * 0.05, H * 0.75); ctx.lineTo(W * 0.5, H * 0.05); ctx.stroke();
  ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(W * 0.3, H * 0.85); ctx.lineTo(W * 0.78, H * 0.1); ctx.stroke();
  ctx.restore();
  return s.texture();
}
