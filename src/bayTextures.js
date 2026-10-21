import { Sketch, makeRng } from './sketch.js';
import { HANZI } from './taiwanTextures.js';

// Line-art textures for the Bay Area chapter (San Francisco x Santa Clara
// University): the same wobbly pen on paper. Signs on campus are carved stone
// (a serif) or dark wayfinding boards (a clean sans, like the airport).

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const BOARD = '#2c2622';

// a little Mission Church: facade with a curved gable, the tower on its right
function missionGlyph(s, x, y, k, o = {}) {
  const w = o.w ?? 3.4, c = o.color ?? '#000';
  const P = (a, b) => [x + a * k, y + b * k];
  s.stroke([P(-40, 0), P(-40, -70), P(-26, -70), P(-12, -96), P(0, -104), P(12, -96), P(26, -70), P(26, 0)], { w, j: 0.3, color: c, closed: true, fill: o.fill ?? null });
  s.stroke([P(26, 0), P(26, -112), P(46, -112), P(46, 0)], { w, j: 0.3, color: c });
  s.stroke([P(24, -112), P(48, -112), P(48, -122), P(24, -122)], { w, j: 0.3, color: c, closed: true });
  s.arc(x + 36 * k, y - 122 * k, 10 * k, 12 * k, Math.PI, Math.PI * 2, { w, j: 0.2, color: c });
  s.line(...P(36, -134), ...P(36, -152), { w, j: 0, color: c }); s.line(...P(30, -146), ...P(42, -146), { w, j: 0, color: c });
  s.line(...P(0, -104), ...P(0, -120), { w, j: 0, color: c }); s.line(...P(-6, -114), ...P(6, -114), { w, j: 0, color: c });
  s.ellipse(...P(-7, -56), 8 * k, 8 * k, { w: w * 0.8, j: 0.2, color: c });
  s.stroke([P(-17, 0), P(-17, -26), ...s.ellipsePts(x - 7 * k, y - 26 * k, 10 * k, 10 * k, Math.PI, Math.PI * 2, 8), P(3, 0)], { w: w * 0.8, j: 0.2, color: c });
  for (const b of [-90, -60]) s.stroke([P(30, b + 14), P(30, b), ...s.ellipsePts(x + 36 * k, y + b * k, 6 * k, 6 * k, Math.PI, Math.PI * 2, 6), P(42, b + 14)], { w: w * 0.7, j: 0.2, color: c });
  s.stroke([P(-80, 0), P(-80, -46), P(-40, -46)], { w: w * 0.9, j: 0.3, color: c });
  for (let i = 0; i < 3; i++) s.rect(...P(-74 + i * 11, -34), 6 * k, 10 * k, { w: w * 0.6, j: 0.1, color: c });
}

// The carved stone entry sign: "Santa Clara University" with the mission.
export function scuSignTexture() {
  const W = 1024, H = 384, s = new Sketch(W, H, { seed: 901, bg: '#f4f1ea' });
  for (let i = 0; i < 26; i++) s.ellipse(s.rand(0, W), s.rand(0, H), 1.2, 1.2, { w: 0, j: 0, fill: 'rgba(0,0,0,0.25)' });
  missionGlyph(s, 210, 300, 1.55, { w: 4.4 });
  const ctx = s.ctx;
  ctx.fillStyle = '#211c18'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `400 104px ${SERIF}`; ctx.fillText('Santa Clara', 360, 172);
  ctx.font = `400 104px ${SERIF}`; ctx.fillText('University', 380, 292);
  return s.texture();
}

// A street banner: shield with the mission, "SCU" beneath, a fringe at the bottom.
export function scuBannerTexture() {
  const W = 256, H = 640, s = new Sketch(W, H, { seed: 903, bg: '#3a312b' });
  s.rect(10, 10, W - 20, H - 40, { w: 3, j: 0.3, color: '#e9e2d6', alpha: 0.7 });
  const cx = W / 2;
  s.stroke([[cx - 80, 110], [cx + 80, 110], [cx + 80, 250], [cx, 330], [cx - 80, 250]], { w: 5, j: 0.3, color: '#f3ede3', closed: true });
  missionGlyph(s, cx - 4, 280, 0.95, { w: 3, color: '#f3ede3' });
  const ctx = s.ctx;
  ctx.fillStyle = '#f3ede3'; ctx.textAlign = 'center'; ctx.font = `400 104px ${SERIF}`; ctx.fillText('SCU', cx, 470);
  for (let x = 16; x < W - 10; x += 14) s.line(x, H - 32, x, H - 6, { w: 3, j: 0.2, color: '#3a312b' });
  return s.texture();
}

// A dark wayfinding board, one destination per row with an arrow.
// rows: [[text, dir]] with dir 'up' | 'left' | 'right'
export function wayfindingTexture(rows, { w = 640 } = {}) {
  const rh = 128, W = w, H = rows.length * rh, s = new Sketch(W, H, { seed: 905, bg: BOARD });
  const ctx = s.ctx;
  rows.forEach(([text, dir], i) => {
    const y = i * rh;
    if (i) s.line(10, y, W - 10, y, { w: 3, j: 0.2, color: '#8a8178' });
    s.rect(8, y + 8, W - 16, rh - 16, { w: 2.4, j: 0.3, color: '#e9e2d6', alpha: 0.5 });
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let size = 62; ctx.font = `500 ${size}px ${SANS}`;
    while (ctx.measureText(text).width > W - 170 && size > 30) { size -= 2; ctx.font = `500 ${size}px ${SANS}`; }
    ctx.fillText(text, 34, y + rh / 2 + 3);
    const ax = W - 70, ay = y + rh / 2;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(dir === 'up' ? -Math.PI / 2 : dir === 'left' ? Math.PI : 0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.moveTo(8, -22); ctx.lineTo(30, 0); ctx.lineTo(8, 22); ctx.stroke();
    ctx.restore();
  });
  return s.texture();
}

// The interpretive board at the overlook: a small map of the bay (the same
// drawing as the map card), titled.
export function mapBoardTexture() {
  const W = 1024, H = 768, s = new Sketch(W, H, { seed: 907, bg: '#efe9dc' });
  s.rect(12, 12, W - 24, H - 24, { w: 8, j: 0.5 });
  s.text('The San Francisco Bay Area', W / 2, 70, 58);
  s.text('舊金山灣區', W / 2, 128, 40, { font: HANZI });
  drawBayMap(s, 80, 160, W - 160, H - 210);
  return s.texture();
}

// The bay, simplified: the ocean on the left, the Golden Gate, the bay running
// south-east to Santa Clara, the peninsula and the East Bay hills.
export function drawBayMap(s, x0, y0, w, h, { labels = true } = {}) {
  const ctx = s.ctx;
  const X = (u) => x0 + u * w, Y = (v) => y0 + v * h;
  // the ocean (hatched) west of the coast
  const coast = [[0.0, 0.0], [0.26, 0.0], [0.27, 0.12], [0.24, 0.22], [0.3, 0.3], [0.27, 0.42], [0.24, 0.56], [0.26, 0.7], [0.22, 0.85], [0.2, 1.0], [0.0, 1.0]];
  ctx.save(); ctx.beginPath(); coast.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v)))); ctx.closePath(); ctx.clip();
  s.hatch(x0, y0, w * 0.32, h, { gap: 12, lw: 1.4, alpha: 0.35, angle: 0.4 }); ctx.restore();
  s.stroke(coast.slice(1, -1).map(([u, v]) => [X(u), Y(v)]), { w: 3.4, j: 0.8 });
  // the bay: from the Golden Gate (0.3, 0.3) east, then south-east to the far end
  const bay = [[0.3, 0.3], [0.38, 0.26], [0.46, 0.2], [0.52, 0.24], [0.5, 0.36], [0.56, 0.5], [0.66, 0.66], [0.76, 0.8], [0.82, 0.86], [0.74, 0.86], [0.62, 0.74], [0.5, 0.62], [0.42, 0.5], [0.38, 0.4], [0.33, 0.33]];
  ctx.save(); ctx.beginPath(); bay.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v)))); ctx.closePath(); ctx.clip();
  for (let k = 0; k < 40; k++) { const u = s.rand(0.3, 0.85), v = s.rand(0.2, 0.88); s.line(X(u), Y(v), X(u) + 18, Y(v), { w: 1.4, j: 0.3, alpha: 0.45 }); }
  ctx.restore();
  s.stroke(bay.map(([u, v]) => [X(u), Y(v)]), { w: 3, j: 0.8, closed: true });
  // hills (little arcs) on the peninsula and in the East Bay
  for (const [u, v] of [[0.34, 0.6], [0.38, 0.72], [0.46, 0.84], [0.68, 0.3], [0.74, 0.44], [0.86, 0.58], [0.9, 0.72]]) s.arc(X(u), Y(v), 22, 12, Math.PI, Math.PI * 2, { w: 2, j: 0.3, alpha: 0.7 });
  // the bridge across the Golden Gate
  s.line(X(0.265), Y(0.28), X(0.31), Y(0.33), { w: 5, j: 0 });
  for (const t of [0.3, 0.7]) { const u = 0.265 + 0.045 * t, v = 0.28 + 0.05 * t; s.line(X(u), Y(v) - 12, X(u), Y(v) + 4, { w: 3, j: 0 }); }
  // the two places and the road between them
  const sf = [0.33, 0.31], sc = [0.76, 0.9];
  s.stroke([[X(sf[0]), Y(sf[1])], [X(0.36), Y(0.5)], [X(0.48), Y(0.68)], [X(0.62), Y(0.8)], [X(sc[0]), Y(sc[1])]], { w: 2.6, j: 0.6, alpha: 0.8 });
  for (const [u, v] of [sf, sc]) { s.ellipse(X(u), Y(v), 11, 11, { w: 3, j: 0, fill: '#000' }); s.ellipse(X(u), Y(v), 19, 19, { w: 2.4, j: 0.2 }); }
  if (labels) {
    s.text('San Francisco', X(sf[0]) - 4, Y(sf[1]) - 44, 40, { align: 'left' });
    s.text('舊金山', X(sf[0]) - 4, Y(sf[1]) - 6 + 40, 30, { align: 'left', font: HANZI });
    s.text('Santa Clara', X(sc[0]) - 20, Y(sc[1]) - 40, 40, { align: 'right' });
    s.text('聖克拉拉', X(sc[0]) - 20, Y(sc[1]) - 6, 30, { align: 'right', font: HANZI });
    s.text('Golden Gate', X(0.1), Y(0.24), 30);
    s.text('Pacific', X(0.12), Y(0.6), 32);
    s.text('Bay', X(0.6), Y(0.56), 34, { rot: 0.85 });
    s.text('≈ 45 mi · 70 km', X(0.66), Y(0.62) + 70, 28, { rot: 0.85 });
  }
  // a compass rose
  const cx = X(0.9), cy = Y(0.12);
  s.line(cx, cy - 34, cx, cy + 34, { w: 2.4, j: 0 }); s.line(cx - 24, cy, cx + 24, cy, { w: 1.6, j: 0 });
  s.stroke([[cx - 9, cy - 16], [cx, cy - 38], [cx + 9, cy - 16]], { w: 2.4, j: 0, closed: true, fill: '#000' });
  s.text('N', cx, cy - 56, 28);
}

// The map card (the HUD), drawn on a canvas and handed over as an image URL.
export function mapCardImage() {
  const W = 760, H = 560, s = new Sketch(W, H, { seed: 909, bg: '#efe9dc' });
  drawBayMap(s, 20, 20, W - 40, H - 40);
  return s.canvas.toDataURL('image/png');
}

// Painted wharf sign (on the waterfront facades): a board with a name.
export function wharfSignTexture(text, seed = 911) {
  const W = 768, H = 160, s = new Sketch(W, H, { seed, bg: '#3a312b' });
  s.rect(10, 10, W - 20, H - 20, { w: 4, j: 0.4, color: '#e9e2d6', alpha: 0.7 });
  const ctx = s.ctx;
  ctx.fillStyle = '#f3ede3'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 88; ctx.font = `700 ${size}px ${SERIF}`;
  while (ctx.measureText(text).width > W - 70 && size > 40) { size -= 4; ctx.font = `700 ${size}px ${SERIF}`; }
  ctx.fillText(text, W / 2, H / 2 + 4);
  return s.texture();
}

// Stucco for the mission and the halls (triplanar): a few trowel marks, clean.
export function stuccoTexture(seed = 913) {
  const S = 512, s = new Sketch(S, S, { seed });
  for (let i = 0; i < 18; i++) { const x = s.rand(0, S), y = s.rand(0, S); s.arc(x, y, s.rand(14, 30), s.rand(6, 12), 0.3, Math.PI - 0.3, { w: 1.1, j: 0.4, alpha: 0.18 }); }
  for (let i = 0; i < 30; i++) s.ellipse(s.rand(0, S), s.rand(0, S), 1, 1, { w: 0, j: 0, fill: 'rgba(0,0,0,0.2)' });
  return s.texture({ repeat: true });
}

// Barrel tiles (UV over each roof slope: u along the eave, v up the slope),
// one tile = 6 x 6 tiles of 0.32 m: dark troughs, lighter caps with a curve.
export function barrelTileTexture(seed = 915) {
  const S = 256, s = new Sketch(S, S, { seed, bg: '#bdbdbd' });
  const c = S / 6;
  for (let i = 0; i < 6; i++) {
    s.ctx.fillStyle = '#8a8a8a'; s.ctx.fillRect(i * c + c * 0.55, 0, c * 0.45, S);
    s.line(i * c + c * 0.55, -2, i * c + c * 0.55, S + 2, { w: 2.2, j: 0.2 });
    for (let r = 0; r < 6; r++) s.arc(i * c + c * 0.27, r * c + c * 0.08, c * 0.3, c * 0.12, 0, Math.PI, { w: 1.8, j: 0.2, alpha: 0.8 });
  }
  return s.texture({ repeat: true });
}

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
