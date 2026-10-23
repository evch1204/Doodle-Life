import * as THREE from 'three';
import { Sketch, makeRng, HANZI, say, letteredTexture } from './sketch.js';

// Line-art textures for the Taiwan chapter (Jiufen): white paper, black ink, same pen as the room.
// Writing is { en, zh } and follows the language setting; boards are laid out for the
// hanzi (the shapes in the scene are sized for them) and English is fitted into the same board.

export { HANZI };

// The English on each hanzi sign: what a sign there would say, short enough for its board.
const SIGN_EN = {
  珍珠奶茶: 'Bubble Tea', 珍奶: 'Boba', 奶茶: 'Milk Tea', 臭豆腐: 'Stinky Tofu', 芋圓: 'Taro Balls',
  鳳梨酥: 'Pineapple Cakes', 茶館: 'Tea House', 茶: 'Tea', 麵: 'Noodles', 牛肉麵: 'Beef Noodles',
  水果: 'Fruit', 九份老街: 'Jiufen Old Street', 九份: 'Jiufen', 小籠包: 'Soup Dumplings',
  烤肉串: 'Skewers', 郵: 'Post', 機場: 'Airport', 外灘: 'The Bund', 福德宮: 'Fude Temple',
  福: 'Good Luck', 營業中: 'Open', 好吃: 'Tasty!', 便宜: 'Cheap!',
  民宿: 'Guesthouse', 書: 'Books', 古早味: 'Old-Time Snacks', 酒: 'Rice Wine', 老街: 'Old Street',
};
// a sign's text as { en, zh }: a plain string is the hanzi, its English looked up above
const bi = (t) => {
  if (typeof t !== 'string') return t;
  if (t && !SIGN_EN[t]) console.warn(`no English for the sign ${t}`);
  return { zh: t, en: SIGN_EN[t] ?? t };
};

// Irregular stone paving, 2 m tile (triplanar).
export function pavingTexture(seed = 31) {
  const S = 1024, s = new Sketch(S, S, { seed });
  const rows = 6;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    for (const dy of [0, S]) s.line(-10, y + dy + s.rand(-3, 3), S + 10, y + dy + s.rand(-3, 3), { w: 3, j: 1.4 });
    let x = s.rand(-80, 0);
    while (x < S) {
      const w = s.rand(120, 230);
      for (const dx of [0, S, -S]) {
        s.line(x + dx, y + 3, x + dx + s.rand(-6, 6), y + rh - 3, { w: 2.8, j: 1 });
      }
      // wear: a few short cracks and speckles
      if (s.r() < 0.45) {
        const cx = x + s.rand(20, w - 20), cy = y + s.rand(20, rh - 20);
        s.stroke([[cx, cy], [cx + s.rand(-20, 20), cy + s.rand(8, 22)], [cx + s.rand(-24, 24), cy + s.rand(20, 36)]], { w: 1.6, j: 0.8, alpha: 0.6 });
      }
      for (let k = 0; k < 4; k++) s.ellipse(x + s.rand(10, w - 10), y + s.rand(10, rh - 10), 1.4, 1.4, { w: 0, j: 0, fill: 'rgba(0,0,0,0.5)' });
      x += w;
    }
  }
  return s.texture({ repeat: true });
}

// Stair tread / riser: worn stone blocks.
export function stoneBlockTexture(seed = 33) {
  const S = 512, s = new Sketch(S, S, { seed });
  for (let i = 0; i < 4; i++) {
    const y = i * 128;
    s.line(-5, y + s.rand(-2, 2), S + 5, y + s.rand(-2, 2), { w: 2.6, j: 1 });
    let x = s.rand(-60, 0);
    while (x < S) { const w = s.rand(140, 260); s.line(x, y + 2, x + s.rand(-4, 4), y + 126, { w: 2.4, j: 0.8 }); x += w; }
    for (let k = 0; k < 3; k++) { const cx = s.rand(0, S), cy = y + s.rand(20, 108); s.line(cx, cy, cx + s.rand(10, 30), cy + s.rand(-6, 6), { w: 1.4, alpha: 0.5 }); }
  }
  return s.texture({ repeat: true });
}

// Vertical wooden boards (shop fronts), 2 m tile.
export function boardsTexture(seed = 41) {
  const S = 512, s = new Sketch(S, S, { seed });
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * S;
    s.line(x + s.rand(-2, 2), -6, x + s.rand(-2, 2), S + 6, { w: 3, j: 1.2 });
  }
  for (let i = 0; i < n; i++) {
    const x0 = (i / n) * S;
    for (let g = 0; g < 2; g++) {
      const gx = x0 + s.rand(10, S / n - 10), y0 = s.rand(0, S * 0.6), len = s.rand(80, 220);
      const pts = [];
      for (let t = 0; t <= len; t += 20) pts.push([gx + Math.sin((y0 + t) * 0.03 + g) * 2.5, y0 + t]);
      s.stroke(pts, { w: 1.4, j: 0.8, alpha: 0.5 });
    }
    if (s.r() < 0.4) s.ellipse(x0 + s.rand(12, S / n - 12), s.rand(40, S - 40), 5, 8, { w: 1.5, alpha: 0.6 });
  }
  return s.texture({ repeat: true });
}

// Plaster wall with a few cracks and stains, 3 m tile.
export function plasterTexture(seed = 43) {
  const S = 512, s = new Sketch(S, S, { seed });
  for (let i = 0; i < 6; i++) {
    const x = s.rand(20, S - 20), y = s.rand(20, S - 20);
    const pts = [[x, y]];
    for (let k = 0; k < 4; k++) pts.push([pts[k][0] + s.rand(-18, 18), pts[k][1] + s.rand(6, 22)]);
    s.stroke(pts, { w: 1.5, j: 0.6, alpha: 0.55 });
  }
  for (let i = 0; i < 40; i++) s.ellipse(s.rand(0, S), s.rand(0, S), 1.2, 1.2, { w: 0, j: 0, fill: 'rgba(0,0,0,0.35)' });
  return s.texture({ repeat: true });
}

// Curved clay roof tiles seen from above: rows of arcs + ridges down the slope.
export function roofTexture(seed = 47) {
  const S = 512, s = new Sketch(S, S, { seed });
  const cols = 8, rows = 6;
  const cw = S / cols, rh = S / rows;
  for (let c = 0; c <= cols; c++) {
    const x = c * cw;
    s.line(x + s.rand(-2, 2), -4, x + s.rand(-2, 2), S + 4, { w: 3.4, j: 0.8 });
    s.line(x + cw * 0.5 + s.rand(-2, 2), -4, x + cw * 0.5 + s.rand(-2, 2), S + 4, { w: 1.4, j: 0.6, alpha: 0.55 });
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw, y = r * rh + (c % 2) * 6;
      s.arc(x + cw / 2, y + rh * 0.2, cw * 0.48, rh * 0.22, 0.1, Math.PI - 0.1, { w: 2.2, j: 0.5 });
    }
  }
  return s.texture({ repeat: true });
}

// Lattice window (upper floors), with paper behind.
export function latticeTexture(seed = 49) {
  const S = 256, s = new Sketch(S, S, { seed });
  s.rect(8, 8, S - 16, S - 16, { w: 6, j: 0.8 });
  for (let i = 1; i < 4; i++) {
    s.line(8 + (i * (S - 16)) / 4, 10, 8 + (i * (S - 16)) / 4, S - 10, { w: 3, j: 0.5 });
    s.line(10, 8 + (i * (S - 16)) / 4, S - 10, 8 + (i * (S - 16)) / 4, { w: 3, j: 0.5 });
  }
  s.hatch(14, 14, S - 28, S - 28, { gap: 14, lw: 1.2, alpha: 0.35, angle: 0.9 });
  return s.texture();
}

// Wooden sign board with brush characters. vertical: one char per line (English runs
// along the board, turned). aspect: the board's width / height, for a horizontal board.
export function signTexture(text, { vertical = true, seed = 51, border = true, w = 128, h = 0, size = 0, invert = false, aspect = 0 } = {}) {
  text = bi(text);
  const chars = [...say(text, 'zh')];
  const H = h || (vertical ? chars.length * 116 + 40 : 160);
  const W = !vertical && aspect ? Math.round(H * aspect) : vertical ? w : Math.max(w, chars.length * 120 + 40);
  return letteredTexture((lang) => {
    const s = new Sketch(W, H, { seed, bg: invert ? '#000' : '#fff' });
    const ink = invert ? '#fff' : '#000';
    if (border) {
      s.rect(6, 6, W - 12, H - 12, { w: 5, j: 0.8, color: ink });
      s.rect(16, 16, W - 32, H - 32, { w: 1.6, j: 0.6, color: ink, alpha: 0.7 });
    }
    const pad = border ? 26 : 8;
    if (lang !== 'zh') {
      // English: along the board (turned to read top to bottom on a vertical one)
      if (vertical && H > W * 1.3) s.fitText(say(text, lang), W / 2, H / 2, H - pad * 2, W - pad * 2, { lines: 2, color: ink, rot: Math.PI / 2 });
      else s.fitText(say(text, lang), W / 2, H / 2 + 3, W - pad * 2, H - pad * 2, { lines: 2, color: ink });
      return s;
    }
    const fs = size || (vertical ? Math.min(W * 0.7, 96) : Math.min(H * 0.62, 100));
    // horizontal: evenly spaced, but not drifting apart on a long board
    const step = Math.min((W - 40) / chars.length, fs * 1.25);
    chars.forEach((c, i) => {
      if (vertical) s.text(c, W / 2, 20 + (i + 0.5) * ((H - 40) / chars.length), fs, { font: HANZI, color: ink });
      else s.text(c, W / 2 + (i - (chars.length - 1) / 2) * step, H / 2 + 4, fs, { font: HANZI, color: ink });
    });
    return s;
  });
}

// Paper lantern skin: vertical ribs wrap around, horizontal bands, optional big character.
export function lanternTexture(char = '', seed = 53) {
  // a plain lantern has no writing, so it need not follow the language
  const lettered = char ? letteredTexture : (draw, o) => draw('zh').texture(o);
  char = bi(char);
  return lettered((lang) => {
    const W = 512, H = 256, s = new Sketch(W, H, { seed });
    for (let i = 0; i < 16; i++) {
      const x = (i / 16) * W;
      s.stroke([[x, 26], [x + 2, H / 2], [x, H - 26]], { w: 1.4, j: 0.4, alpha: 0.5 });
    }
    s.line(0, 20, W, 20, { w: 4, j: 0.4 });
    s.line(0, H - 20, W, H - 20, { w: 4, j: 0.4 });
    // shaded edges so the round lantern reads as darker paper
    s.hatch(0, 22, W, 28, { gap: 7, lw: 1.2, alpha: 0.4, angle: 1.2 });
    s.hatch(0, H - 50, W, 28, { gap: 7, lw: 1.2, alpha: 0.4, angle: 1.2 });
    const str = say(char, lang);
    // character front and back (u = 0.25 and 0.75 face +z / -z on a lathe)
    if (str) for (const u of [0.25, 0.75]) {
      if (lang === 'zh') s.text(str, u * W, H / 2 + 4, 150, { font: HANZI });
      else s.fitText(str, u * W, H / 2 + 4, 190, 150, { max: 110, lines: 2 });
    }
    return s;
  }, { repeat: true });
}

// Noren (split doorway curtain) with a character.
export function norenTexture(text, seed = 55) {
  text = bi(text);
  return letteredTexture((lang) => {
    const W = 512, H = 256, s = new Sketch(W, H, { seed });
    s.hatch(0, 0, W, H, { gap: 12, lw: 1.3, alpha: 0.3, angle: 0.2 });
    const n = 3;
    for (let i = 1; i < n; i++) s.line((i / n) * W, 40, (i / n) * W, H, { w: 4, j: 0.6 });
    if (lang === 'zh') [...say(text, 'zh')].forEach((c, i, arr) => s.text(c, ((i + 0.5) / arr.length) * W, H * 0.55, 120, { font: HANZI }));
    else s.fitText(say(text, lang), W / 2, H * 0.56, W - 50, H * 0.5, { max: 104 });
    return s;
  });
}

// Bubble tea cup: tea line, pearls at the bottom, a smiley.
export function bobaTexture() {
  const W = 512, H = 256, s = new Sketch(W, H, { seed: 57 });
  s.stroke([[0, 46], [W, 46]], { w: 2.4, j: 1.2 });
  s.hatch(0, 48, W, 140, { gap: 16, lw: 1.1, alpha: 0.22, angle: 1.35 });
  const rng = makeRng(58);
  for (let i = 0; i < 60; i++) {
    const x = rng() * W, y = 190 + rng() * 52;
    s.ellipse(x, y, 11, 11, { w: 0, j: 0, fill: '#000' });
    s.ellipse(x - 3, y - 3, 3, 3, { w: 0, j: 0, fill: '#fff' });
  }
  s.smiley(W * 0.25, 115, 22, { w: 2.5 });
  return s.texture({ repeat: true });
}

// Pineapple cake box: lid with characters and a pineapple doodle.
export function cakeBoxTexture() {
  return letteredTexture((lang) => {
  const W = 512, H = 256, s = new Sketch(W, H, { seed: 59 });
  s.rect(10, 10, W - 20, H - 20, { w: 5, j: 0.8 });
  if (lang === 'zh') s.text('鳳梨酥', W * 0.62, H * 0.5, 84, { font: HANZI });
  else s.fitText('Pineapple\nCakes', W * 0.64, H * 0.5, 270, 170, { max: 76 });
  const cx = 110, cy = 140;
  s.ellipse(cx, cy, 44, 58, { w: 3 });
  for (let i = -2; i <= 2; i++) { s.line(cx - 40, cy + i * 22 - 20, cx + 40, cy + i * 22 + 20, { w: 1.4, alpha: 0.7 }); s.line(cx + 40, cy + i * 22 - 20, cx - 40, cy + i * 22 + 20, { w: 1.4, alpha: 0.7 }); }
  for (const a of [-0.6, -0.2, 0.2, 0.6]) s.stroke([[cx, cy - 56], [cx + Math.sin(a) * 40, cy - 56 - Math.cos(a) * 46]], { w: 3 });
  return s;
  });
}

// Steamer basket: woven bamboo bands.
export function bambooTexture() {
  const W = 512, H = 128, s = new Sketch(W, H, { seed: 61 });
  s.line(0, 12, W, 12, { w: 4 });
  s.line(0, H - 12, W, H - 12, { w: 4 });
  for (let i = 0; i < 40; i++) { const x = (i / 40) * W; s.line(x, 16, x + 6, H - 16, { w: 1.3, alpha: 0.6 }); }
  return s.texture({ repeat: true });
}

// Small paper notices / menus taped to walls, a line of hanzi per row.
export function noticeTexture(rows, seed = 63) {
  rows = rows.map(bi);
  return letteredTexture((lang) => {
    const W = 256, H = 340, s = new Sketch(W, H, { seed });
    const lines = rows.map((r) => say(r, lang));
    s.rect(8, 8, W - 16, H - 16, { w: 3, j: 1 });
    lines.forEach((c, i) => {
      if (lang === 'zh') s.text(c, W / 2, 60 + i * 70, 56, { font: HANZI });
      else s.fitText(c, W / 2, 60 + i * 70, W - 50, 62, { max: 54 });
    });
    for (let i = 0; i < 4; i++) s.line(40, 60 + lines.length * 70 + i * 22, W - 40 - s.rand(0, 60), 60 + lines.length * 70 + i * 22, { w: 2, alpha: 0.6 });
    return s;
  });
}

// Shrine plaque / incense board.
export function plaqueTexture(text, aspect = 0) {
  return signTexture(text, { vertical: false, seed: 65, w: 420, h: 150, size: 92, aspect });
}

// ---------------------------------------------------------------------------
// The sky: a drawn panorama on a cylinder around the camera with clouds, a low
// sun, birds, faint doodle mountains and the sea. Everything nearer (the
// hills, the city, Taipei 101) is 3D geometry in front of it. Canvas x spans azimuth -110..110 deg (0 = straight down
// the street, -z); rows are linear in tan(elevation).
export const PANO = { W: 6144, H: 1536, AZ: 110, ELB: -26, ELT: 40, T101: -3 };

export function panoramaTexture() {
  const { W, H, AZ, ELB, ELT } = PANO;
  const s = new Sketch(W, H, { seed: 71, transparent: false, bg: '#fff' });
  const ctx = s.ctx;
  const tb = Math.tan((ELB * Math.PI) / 180), tt = Math.tan((ELT * Math.PI) / 180);
  const X = (az) => ((az + AZ) / (2 * AZ)) * W;
  const Y = (el) => ((tt - Math.tan((el * Math.PI) / 180)) / (tt - tb)) * H;
  const pxPerDeg = W / (2 * AZ);
  const r = makeRng(72);
  const rand = (a, b) => a + (b - a) * r();

  // sky: a few clouds and long sunset streaks
  const cloud = (az, el, w, h) => {
    const cx = X(az), cy = Y(el), pw = w * pxPerDeg, ph = h * pxPerDeg;
    const pts = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const bump = 1 + 0.35 * Math.abs(Math.sin(i * 1.7));
      pts.push([cx + Math.cos(a) * pw * 0.5, cy + Math.sin(a) * ph * bump]);
    }
    s.stroke(pts, { w: 3, j: 2, fill: '#fff' });
    s.line(cx - pw * 0.55, cy, cx + pw * 0.55, cy, { w: 3, j: 1.5 });
  };
  for (const [az, el, w, h] of [[-80, 24, 16, 3.5], [-45, 30, 12, 3], [-20, 22, 9, 2.4], [25, 27, 14, 3.2], [60, 21, 11, 2.6], [92, 29, 15, 3.4], [5, 33, 8, 2]]) cloud(az, el, w, h);
  // low sun with a couple of cloud bars across it
  const sx = X(38), sy = Y(5.5), sr = 2.6 * pxPerDeg;
  s.ellipse(sx, sy, sr, sr, { w: 3.2, j: 0.8, fill: '#fff' });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s.line(sx + Math.cos(a) * sr * 1.3, sy + Math.sin(a) * sr * 1.3, sx + Math.cos(a) * sr * 1.65, sy + Math.sin(a) * sr * 1.65, { w: 2.4, j: 0.4 });
  }
  for (const [dy, w0, w1] of [[0.25, -1.8, 2.4], [0.6, -2.6, 1.6]]) s.line(sx + w0 * sr, sy + dy * sr, sx + w1 * sr, sy + dy * sr, { w: 6, j: 0.8, color: '#fff' });
  for (let i = 0; i < 9; i++) {
    const y = Y(rand(2, 12)), x0 = X(rand(10, 70)), len = rand(80, 340);
    s.line(x0, y, x0 + len, y + rand(-3, 3), { w: 1.6, j: 1, alpha: 0.55 });
  }
  // birds
  for (let i = 0; i < 5; i++) {
    const bx = X(rand(-30, 30)), by = Y(rand(14, 26)), bw = rand(10, 18);
    s.stroke([[bx - bw, by - 4], [bx - bw * 0.3, by - 2], [bx, by + 3]], { w: 2, j: 0.3 });
    s.stroke([[bx, by + 3], [bx + bw * 0.3, by - 2], [bx + bw, by - 4]], { w: 2, j: 0.3 });
  }

  // far mountains: faint ridge lines with light hatching
  const ridge = (el0, amp, seed, alpha, step = 24) => {
    const rr = makeRng(seed);
    const pts = [];
    let e = el0;
    for (let x = -40; x <= W + 40; x += step) {
      e += (rr() - 0.5) * amp - (e - el0) * 0.08;
      pts.push([x, Y(e)]);
    }
    return { pts, alpha };
  };
  const far = ridge(6.5, 1.3, 81, 0.45);
  s.stroke([...far.pts, [W + 40, H + 10], [-40, H + 10]], { w: 0, j: 0, fill: '#fff' });
  s.stroke(far.pts, { w: 2.6, j: 1, alpha: 0.55 });
  for (let i = 0; i < 70; i++) {
    const k = Math.floor(rand(0, far.pts.length - 1));
    const [x, y] = far.pts[k];
    s.line(x, y + 6, x - 14, y + 30, { w: 1.3, alpha: 0.32 });
  }

  // the sea + mist on the right, behind the city
  for (let i = 0; i < 26; i++) {
    const y = Y(rand(-0.6, 1.2)), x0 = X(rand(40, 105)), len = rand(30, 120);
    s.line(x0, y, x0 + len, y, { w: 1.6, j: 0.5, alpha: 0.5 });
  }
  s.line(X(38), Y(1.6), W + 10, Y(1.4), { w: 2.2, j: 1, alpha: 0.6 });

  // (the city, Taipei 101 and the hills in front of them are real 3D geometry now)
  const t = s.texture();
  t.anisotropy = 4;
  return t;
}

// Hillside scrub: grass tufts, little bushes, a path scribble here and there.
export function scrubTexture() {
  const S = 512, s = new Sketch(S, S, { seed: 67 });
  for (let i = 0; i < 70; i++) {
    const x = s.rand(0, S), y = s.rand(0, S);
    for (let k = -1; k <= 1; k++) s.line(x + k * 4, y, x + k * 7, y - s.rand(8, 14), { w: 1.4, j: 0.2, alpha: 0.6 });
  }
  for (let i = 0; i < 14; i++) {
    const x = s.rand(30, S - 30), y = s.rand(30, S - 30), r = s.rand(10, 22);
    s.arc(x, y, r, r * 0.7, Math.PI, Math.PI * 2, { w: 1.8, j: 0.8, alpha: 0.7 });
    s.hatch(x - r, y - r * 0.5, r * 2, r * 0.5, { gap: 5, lw: 1, alpha: 0.4, clip: (c) => c.ellipse(x, y, r, r * 0.6, 0, Math.PI, Math.PI * 2) });
  }
  return s.texture({ repeat: true });
}

// Hill bands between the street and the city. kind 'town': rooftops and trees
// stepping down the slope; 'trees': scattered tree clumps; 'ridge': light hatching.
export function hillTexture(kind, seed = 81) {
  const W = 1024, H = 512, s = new Sketch(W, H, { seed });
  const ctx = s.ctx;
  const r = makeRng(seed + 1);
  const roof = (x, base, w, h) => {
    const body = h * 0.55;
    ctx.fillStyle = '#fff'; ctx.fillRect(x, base - body, w, body + 2);
    ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1.5, w / 20); ctx.strokeRect(x, base - body, w, body);
    ctx.fillStyle = '#000'; ctx.fillRect(x + w * 0.3, base - body * 0.7, w * 0.14, body * 0.35);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, base - body); ctx.lineTo(x + w * 0.12, base - h); ctx.lineTo(x + w * 0.88, base - h); ctx.lineTo(x + w * 1.1, base - body); ctx.closePath();
    ctx.fillStyle = '#c8c8c8'; ctx.fill(); ctx.stroke();
    ctx.lineWidth = Math.max(1, w / 36);
    for (let k = 1; k < 5; k++) { const u = k / 5; ctx.beginPath(); ctx.moveTo(x - w * 0.1 + u * w * 1.2, base - body); ctx.lineTo(x + w * 0.12 + u * w * 0.76, base - h); ctx.stroke(); }
  };
  const tree = (x, base, rad) => {
    ctx.beginPath(); ctx.ellipse(x, base - rad * 0.8, rad, rad * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = Math.max(1.5, rad / 9); ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.globalAlpha = 0.5;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + (k - 1) * rad * 0.4, base - rad * 0.6, rad * 0.35, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
  if (kind === 'town') {
    // a loose scatter of houses among trees (calm, so it does not compete with the street)
    for (let y = 40; y < H + 40; y += 70) {
      let x = -30 + r() * 60;
      while (x < W + 30) {
        if (r() < 0.3) tree(x + 20, y, 18 + r() * 8); else if (r() < 0.75) roof(x, y + r() * 12, 34 + r() * 20, 28 + r() * 8);
        x += 80 + r() * 60;
      }
    }
  } else if (kind === 'forest') {
    // tree clumps overlapping in rows down the slope, nothing built (the villages are geometry)
    // loose rows of clumps with open slope between them (a few lines, not a texture of bubbles)
    for (let y = 60; y < H + 40; y += 70) for (let x = -20 + r() * 60; x < W + 20; x += 90 + r() * 120) {
      if (r() < 0.35) continue;
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) tree(x + k * 30, y + r() * 16, 20 + r() * 14);
    }
    for (let i = 0; i < 14; i++) { const y = r() * H; s.line(r() * W, y, r() * W, y + r() * 30 - 15, { w: 1.2, j: 1.2, alpha: 0.25 }); }
  } else if (kind === 'trees') {
    for (let i = 0; i < 70; i++) tree(r() * W, 30 + r() * (H - 30), 16 + r() * 16);
    for (let i = 0; i < 10; i++) roof(r() * W, 60 + r() * (H - 60), 30, 26);
  } else {
    s.hatch(0, 0, W, H, { gap: 22, lw: 1.6, alpha: 0.35, angle: 0.9 });
    for (let i = 0; i < 40; i++) tree(r() * W, 40 + r() * (H - 40), 10 + r() * 10);
  }
  return s.texture({ repeat: true });
}

// 青天白日滿地紅 in ink: a 3:2 field with a canton (upper-left quarter of the
// area) holding a white sun with twelve rays and a ring. Monochrome: the field
// is a light hatched gray, the canton dark cross-hatched, the sun paper white.
export function flagTexture() {
  const W = 768, H = 512, s = new Sketch(W, H, { seed: 91, bg: '#b4b4b4' });
  const ctx = s.ctx;
  s.hatch(0, 0, W, H, { gap: 14, lw: 1.6, alpha: 0.3, angle: 0.8, j: 0.4 });
  const cw = W / 2, ch = H / 2;
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 0, cw, ch);
  s.hatch(0, 0, cw, ch, { gap: 10, lw: 1.6, alpha: 0.55, angle: 0.8, j: 0.3 });
  s.hatch(0, 0, cw, ch, { gap: 10, lw: 1.6, alpha: 0.55, angle: -0.8, j: 0.3 });
  s.line(cw, 0, cw, ch, { w: 3, j: 0.4 });
  s.line(0, ch, cw, ch, { w: 3, j: 0.4 });
  // the sun: twelve rays (one triangle each), a ring, a disc
  const cx = cw / 2, cy = ch / 2, R = ch * 0.38, rIn = R * 0.53;
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2, da = Math.PI / 12;
    rays.push([[cx + Math.cos(a) * R, cy + Math.sin(a) * R], [cx + Math.cos(a + da) * rIn, cy + Math.sin(a + da) * rIn], [cx + Math.cos(a - da) * rIn, cy + Math.sin(a - da) * rIn]]);
  }
  for (const tri of rays) s.stroke(tri, { w: 2.6, j: 0.2, closed: true, fill: '#fff' });
  s.ellipse(cx, cy, rIn * 1.02, rIn * 1.02, { w: 0, j: 0, fill: '#fff' });
  s.ellipse(cx, cy, rIn * 0.97, rIn * 0.97, { w: 2.6, j: 0.2, fill: '#4a4a4a' }); // the blue ring
  s.ellipse(cx, cy, rIn * 0.8, rIn * 0.8, { w: 2.6, j: 0.2, fill: '#fff' });       // the white disc
  s.rect(3, 3, W - 6, H - 6, { w: 5, j: 0.5 });
  const t = s.texture();
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------
// Background architecture kit (the hillside town, Taipei, Taipei 101). Tiles
// count whole bays across and floors up (4 x 4 per tile), so a window never
// gets cut at a corner.

// Taipei 101's curtain wall: tall glass panes between strong mullions, a
// spandrel line at each floor, a heavier rail every fourth floor.
export function t101Texture(seed = 711) {
  const S = 256, s = new Sketch(S, S, { seed });
  const ctx = s.ctx, c = S / 4;
  ctx.fillStyle = '#d6d6d6'; ctx.fillRect(0, 0, S, S);
  for (let f = 0; f < 4; f++) { ctx.fillStyle = '#b4b4b4'; ctx.fillRect(0, f * c + c * 0.08, S, c * 0.7); }
  ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#fff'; ctx.lineWidth = 12;
  for (const x of [-40, 120]) { ctx.beginPath(); ctx.moveTo(x, S); ctx.lineTo(x + 150, 0); ctx.stroke(); }
  ctx.restore();
  for (let b = 0; b < 8; b++) s.line(b * (c / 2), -2, b * (c / 2), S + 2, { w: b % 2 ? 1.3 : 2.4, j: 0, alpha: b % 2 ? 0.45 : 0.75 });
  for (let f = 0; f < 4; f++) s.line(-2, f * c + c * 0.82, S + 2, f * c + c * 0.82, { w: f === 0 ? 2.6 : 1.6, j: 0, alpha: f === 0 ? 0.8 : 0.55 });
  return s.texture({ repeat: true });
}

// Hillside house walls: one window per bay (a few blank, a few with an iron
// grille), on plaster or boards. Tile = 4 bays x 4 floors.
export function houseWallTexture(kind = 'plaster', seed = 721) {
  const S = 256, s = new Sketch(S, S, { seed });
  const ctx = s.ctx, r = makeRng(seed + 1), c = S / 4;
  if (kind === 'boards') for (let i = 0; i < 16; i++) s.line(i * 16 + 8, -2, i * 16 + 8 + s.rand(-1, 1), S + 2, { w: 1.1, j: 0.3, alpha: 0.35 });
  else for (let i = 0; i < 40; i++) s.ellipse(s.rand(0, S), s.rand(0, S), 1.2, 1.2, { w: 0, j: 0, fill: 'rgba(0,0,0,0.25)' });
  for (let f = 0; f < 4; f++) {
    s.line(-2, f * c + 2, S + 2, f * c + 2, { w: 1.4, j: 0.3, alpha: 0.4 });
    for (let b = 0; b < 4; b++) {
      const k = r();
      if (k < 0.18) continue;
      const x = b * c + c * 0.24, y = f * c + c * 0.24, w = c * 0.52, h = c * 0.46;
      ctx.fillStyle = k < 0.4 ? '#5a5a5a' : '#808080'; ctx.fillRect(x, y, w, h);
      s.rect(x, y, w, h, { w: 2.2, j: 0.2 });
      s.line(x + w / 2, y, x + w / 2, y + h, { w: 1.6, j: 0.1, color: '#fff', alpha: 0.8 });
      s.line(x - 3, y + h + 3, x + w + 3, y + h + 3, { w: 2.4, j: 0.2 });
      if (k > 0.78) for (let g = 1; g < 5; g++) s.line(x + (g * w) / 5, y - 2, x + (g * w) / 5, y + h + 2, { w: 1.2, j: 0.1 });
    }
  }
  return s.texture({ repeat: true });
}

// Jiufen's black tar-paper roofs: dark felt with lighter battens running down the slope.
export function tarRoofTexture(seed = 731) {
  const S = 256, s = new Sketch(S, S, { seed, bg: '#5c5c5c' });
  s.hatch(0, 0, S, S, { gap: 7, lw: 1, alpha: 0.25, angle: 0.3, j: 0.4 });
  for (let i = 0; i < 6; i++) { const x = i * (S / 6) + 8; s.line(x, -2, x + s.rand(-2, 2), S + 2, { w: 4, j: 0.4, color: '#bdbdbd' }); }
  return s.texture({ repeat: true });
}

// Corrugated sheet (rooftop sheds): close ridges.
export function corrugatedTexture(seed = 741) {
  const S = 128, s = new Sketch(S, S, { seed });
  for (let i = 0; i < 16; i++) s.line(i * 8 + 4, -2, i * 8 + 4, S + 2, { w: 1.6, j: 0.1, alpha: 0.55 });
  return s.texture({ repeat: true });
}
