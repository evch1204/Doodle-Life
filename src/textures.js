import { makeRng, say, letteredTexture } from './sketch.js';
import { Sketch } from './sketch.js';
import { getLang, onLang } from './i18n.js';

// All textures are line art: white paper, black ink. Pixel densities are
// picked so drawn lines land at roughly the same on-screen weight as the
// post-process outlines (~2px). Writing is { en, zh } and follows the
// language setting.

// Floor: planks running front-to-back, 2.4m tile.
export function floorTexture() {
  const S = 1024, s = new Sketch(S, S, { seed: 11 });
  const plank = S / 8;
  const wrapLine = (x1, y1, x2, y2, o) => {
    for (const dy of [-S, 0, S]) s.line(x1, y1 + dy, x2, y2 + dy, o);
  };
  for (let i = 0; i <= 8; i++) {
    const x = i * plank;
    wrapLine(x, -20, x, S + 20, { w: 3.4, j: 1.6 });
  }
  for (let i = 0; i < 8; i++) {
    const x0 = i * plank;
    // board ends (staggered)
    const joints = [s.rand(0, S)];
    if (s.r() < 0.6) joints.push((joints[0] + S * s.rand(0.35, 0.65)) % S);
    for (const y of joints) {
      wrapLine(x0 + 2, y, x0 + plank - 2, y + s.rand(-2, 2), { w: 3, j: 0.8 });
      for (const dy of [-S, 0, S]) {
        s.ellipse(x0 + 12, y + 10 + dy, 2.2, 2.2, { w: 0, j: 0, fill: '#000' });
        s.ellipse(x0 + plank - 12, y + 10 + dy, 2.2, 2.2, { w: 0, j: 0, fill: '#000' });
      }
    }
    // grain
    const n = 2 + Math.floor(s.rand(0, 3));
    for (let g = 0; g < n; g++) {
      const gx = x0 + s.rand(18, plank - 18);
      const y0 = s.rand(0, S), len = s.rand(200, 600);
      const pts = [];
      for (let t = 0; t <= len; t += 30) pts.push([gx + Math.sin((y0 + t) * 0.012 + g) * 5, y0 + t]);
      for (const dy of [-S, 0]) s.stroke(pts.map(([x, y]) => [x, y + dy]), { w: 1.6, j: 1.2, alpha: 0.55 });
    }
    if (s.r() < 0.35) {
      const kx = x0 + s.rand(30, plank - 30), ky = s.rand(60, S - 60);
      s.ellipse(kx, ky, 9, 16, { w: 1.8, j: 0.5, alpha: 0.7 });
      s.ellipse(kx, ky, 4, 8, { w: 1.4, j: 0.3, alpha: 0.6 });
    }
  }
  return s.texture({ repeat: true });
}

// Plaster walls with faint vertical boards and sparse pencil marks, 3m tile.
export function wallTexture() {
  const S = 1024, s = new Sketch(S, S, { seed: 21 });
  for (let i = 0; i < 4; i++) {
    const x = i * (S / 4) + s.rand(-8, 8);
    let y = s.rand(-200, 0);
    while (y < S) {
      const len = s.rand(180, 420);
      s.line(x, y, x + s.rand(-3, 3), y + len, { w: 1.6, j: 1.2, alpha: 0.32 });
      y += len + s.rand(20, 80);
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = s.rand(20, S - 40), y = s.rand(20, S - 40);
    const n = 2 + Math.floor(s.rand(0, 3));
    for (let k = 0; k < n; k++) s.line(x + k * 7, y, x + k * 7 + 10, y - 16, { w: 1.3, j: 0.4, alpha: 0.28 });
  }
  return s.texture({ repeat: true });
}

// Generic wood grain for furniture, 1.2m tile, grain runs horizontally.
export function woodTexture() {
  const S = 512, s = new Sketch(S, S, { seed: 31 });
  for (let i = 0; i < 9; i++) {
    const y = s.rand(0, S), x0 = s.rand(-100, S * 0.5), len = s.rand(140, 380);
    const pts = [];
    for (let t = 0; t <= len; t += 16) pts.push([x0 + t, y + Math.sin((x0 + t) * 0.02 + i) * 4]);
    for (const dx of [0, S]) s.stroke(pts.map(([x, yy]) => [x - dx, yy]), { w: 1.4, j: 0.8, alpha: 0.45 });
  }
  const kx = s.rand(80, 400), ky = s.rand(80, 400);
  s.ellipse(kx, ky, 14, 6, { w: 1.4, alpha: 0.5 });
  return s.texture({ repeat: true });
}

// Ceiling boards running left-right, 2.4m tile.
export function ceilingTexture() {
  const S = 1024, s = new Sketch(S, S, { seed: 41 });
  const b = S / 10;
  for (let i = 0; i <= 10; i++) s.line(-10, i * b, S + 10, i * b, { w: 2.6, j: 1.2 });
  for (let i = 0; i < 10; i++) {
    const y = i * b + s.rand(20, b - 20), x = s.rand(0, S), len = s.rand(150, 420);
    s.line(x, y, x + len, y + s.rand(-3, 3), { w: 1.3, j: 1, alpha: 0.45 });
    s.line(x - S, y, x - S + len, y, { w: 1.3, j: 1, alpha: 0.45 });
  }
  return s.texture({ repeat: true });
}

// Book spines: binders with label windows + finger holes, and a few plain books.
export function spineTextures() {
  const out = [];
  for (let v = 0; v < 5; v++) {
    const W = 96, H = 384, s = new Sketch(W, H, { seed: 50 + v });
    if (v === 0 || v === 1) {
      s.rect(16, 34, W - 32, 110, { w: 5, j: 0.6 });
      s.line(26, 70, W - 26, 70, { w: 4, j: 0.6, alpha: 0.8 });
      s.line(26, 100, W - 34, 100, { w: 4, j: 0.6, alpha: 0.8 });
      s.ellipse(W / 2, H - 70, 14, 14, { w: 5, j: 0.3 });
    } else if (v === 2) {
      s.line(0, 40, W, 40, { w: 6 });
      s.line(0, H - 40, W, H - 40, { w: 6 });
      s.line(W / 2, 90, W / 2 + 2, H - 100, { w: 4, j: 1.5, alpha: 0.8 });
    } else if (v === 3) {
      s.hatch(0, 0, W, 60, { gap: 12, lw: 3.5 });
      s.line(0, 60, W, 60, { w: 5 });
      s.ellipse(W / 2, 200, 10, 10, { w: 4, j: 0.2 });
    } else {
      s.rect(20, 150, W - 40, 70, { w: 5, j: 0.5 });
    }
    out.push(s.texture());
  }
  return out;
}

function poster(text, extra, seed) {
  return letteredTexture((lang) => {
    const W = 512, H = 720, s = new Sketch(W, H, { seed });
    s.rect(10, 10, W - 20, H - 20, { w: 8, j: 1.6 });
    const top = 150, step = 130, lines = say(text, lang);
    lines.forEach((t, i) => s.fitText(t, W / 2, top + i * step, W - 80, 124, { max: 118, rot: s.rand(-0.03, 0.03) }));
    extra(s, top + lines.length * step, lang);
    // tape
    s.rect(W / 2 - 50, -6, 100, 34, { w: 4, j: 0.6, fill: '#fff' });
    return s;
  });
}

export function posterBetterDays() {
  return poster({ en: ['Better', 'Days', 'Ahead'], zh: ['明天', '會更好'] }, (s, y) => {
    s.smiley(256, y + 30, 56, { w: 7 });
  }, 61);
}

export function posterSmallSteps() {
  return poster({ en: ['Small', 'Steps', 'Big', 'Dreams'], zh: ['一小步', '大夢想'] }, (s, y, lang) => {
    if (lang === 'zh') { s.star(370, y + 40, 38, { w: 7 }); s.star(160, y + 90, 30, { w: 6 }); return; }
    s.star(380, 150 + 2 * 130, 38, { w: 7 });
    s.star(250, y - 10, 30, { w: 6 });
  }, 62);
}

// Small framed doodles for the walls.
export function frameTextures() {
  const doodles = [
    (s) => s.smiley(128, 128, 62, { w: 9 }),
    (s) => { s.ellipse(128, 140, 64, 54, { w: 9 }); s.stroke([[74, 110], [80, 50], [112, 92]], { w: 9 }); s.stroke([[144, 92], [176, 50], [182, 110]], { w: 9 }); s.ellipse(106, 136, 6, 9, { w: 0, fill: '#000', j: 0 }); s.ellipse(150, 136, 6, 9, { w: 0, fill: '#000', j: 0 }); },
    (s) => { s.rect(76, 120, 104, 80, { w: 9 }); s.stroke([[64, 124], [128, 60], [192, 124]], { w: 9 }); s.rect(114, 156, 28, 44, { w: 7 }); },
    (s) => s.star(128, 132, 70, { w: 9 }),
    (s) => { s.ellipse(128, 128, 34, 34, { w: 9 }); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s.line(128 + Math.cos(a) * 52, 128 + Math.sin(a) * 52, 128 + Math.cos(a) * 76, 128 + Math.sin(a) * 76, { w: 8 }); } },
    (s) => { s.ellipse(100, 120, 34, 40, { w: 8 }); s.ellipse(160, 140, 30, 36, { w: 8 }); s.line(70, 196, 190, 196, { w: 8 }); },
  ];
  return doodles.map((d, i) => {
    const s = new Sketch(256, 256, { seed: 70 + i });
    s.rect(8, 8, 240, 240, { w: 12, j: 1 });
    s.rect(30, 30, 196, 196, { w: 6, j: 1 });
    d(s);
    return s.texture();
  });
}

// Rug with a stitched/fringed edge and an inner border.
export function rugTexture() {
  const W = 1024, H = 700, s = new Sketch(W, H, { seed: 81 });
  const m = 26;
  s.rect(m, m, W - 2 * m, H - 2 * m, { w: 4, j: 1.5 });
  const fringe = (x1, y1, x2, y2, nx, ny) => {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(L / 13);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, l = s.rand(10, 22);
      s.line(x, y, x + nx * l, y + ny * l, { w: 3, j: 0.4 });
    }
  };
  fringe(m, m, W - m, m, 0, -1);
  fringe(m, H - m, W - m, H - m, 0, 1);
  fringe(m, m, m, H - m, -1, 0);
  fringe(W - m, m, W - m, H - m, 1, 0);
  s.rect(80, 80, W - 160, H - 160, { w: 3, j: 1.6 });
  s.rect(96, 96, W - 192, H - 192, { w: 2, j: 1.4, alpha: 0.7 });
  s.ellipse(W / 2, H / 2, 300, 170, { w: 2.5, j: 2, alpha: 0.6 });
  return s.texture();
}

// Fridge door with doodle magnets.
export function fridgeTexture() {
  return letteredTexture((lang) => {
  const W = 256, H = 560, s = new Sketch(W, H, { seed: 91 });
  s.line(0, 190, W, 190, { w: 6 });
  s.line(210, 60, 210, 150, { w: 9 });
  s.line(210, 230, 210, 360, { w: 9 });
  s.smiley(70, 90, 26, { w: 4 });
  s.rect(110, 70, 60, 70, { w: 4, j: 0.8 });
  s.line(120, 92, 160, 92, { w: 3 }); s.line(120, 110, 155, 110, { w: 3 });
  s.star(70, 270, 26, { w: 4 });
  s.rect(110, 250, 66, 54, { w: 4, j: 0.8 });
  s.ellipse(132, 278, 10, 10, { w: 3 });
  s.ellipse(70, 360, 24, 20, { w: 4 });
  s.stroke([[56, 352], [62, 340], [70, 352]], { w: 3 });
  s.fitText(lang === 'zh' ? '待辦' : 'DO', 140, 400, 120, 56, { max: 52 });
  s.rect(40, 430, 80, 60, { w: 4, j: 0.8 });
  s.line(50, 450, 110, 450, { w: 3 });
  return s;
  });
}

export function crateTexture(seed, label) {
  const s = new Sketch(256, 256, { seed });
  s.rect(14, 14, 228, 228, { w: 6, j: 1 });
  s.line(14, 128, 242, 128, { w: 4, alpha: 0.5 });
  if (label === 'T') { s.line(98, 70, 158, 70, { w: 9 }); s.line(128, 70, 128, 116, { w: 9 }); }
  if (label === 'smile') s.smiley(128, 180, 34, { w: 6 });
  if (label === 'lines') { s.rect(80, 150, 96, 60, { w: 5 }); s.line(92, 170, 160, 170, { w: 4 }); s.line(92, 190, 150, 190, { w: 4 }); }
  return s.texture();
}

// Mug: smiley face wrapped on the side (cylinder uv: u goes around).
export function mugTexture() {
  const W = 512, H = 256, s = new Sketch(W, H, { seed: 101 });
  const cx = W * 0.5;
  s.ellipse(cx - 30, 100, 8, 12, { w: 0, j: 0, fill: '#000' });
  s.ellipse(cx + 30, 100, 8, 12, { w: 0, j: 0, fill: '#000' });
  s.arc(cx, 120, 44, 40, 0.35, Math.PI - 0.35, { w: 7, j: 0.6 });
  return s.texture();
}

// Journal cover: planet + stars, spiral holes along the left.
export function journalTexture() {
  const W = 512, H = 640, s = new Sketch(W, H, { seed: 111 });
  s.rect(8, 8, W - 16, H - 16, { w: 8, j: 1 });
  for (let y = 40; y < H - 30; y += 46) s.ellipse(44, y, 9, 9, { w: 5, j: 0 });
  s.ellipse(280, 300, 92, 92, { w: 8, j: 1 });
  s.arc(280, 304, 190, 44, -0.2, Math.PI + 0.2, { w: 7, j: 1 });
  s.arc(280, 300, 92, 92, Math.PI * 0.25, Math.PI * 0.6, { w: 5, j: 0.6 });
  s.star(150, 130, 26, { w: 6 });
  s.star(420, 480, 22, { w: 6 });
  s.star(410, 120, 14, { w: 5 });
  for (const [x, y] of [[130, 470], [200, 520], [450, 300], [360, 90], [110, 300]]) s.ellipse(x, y, 4, 4, { w: 0, j: 0, fill: '#000' });
  return s.texture();
}

// Pinboard with notes, a doodled map and a photo.
export function pinboardTexture() {
  const W = 512, H = 360, s = new Sketch(W, H, { seed: 171 });
  s.rect(6, 6, W - 12, H - 12, { w: 10, j: 1 });
  s.rect(22, 22, W - 44, H - 44, { w: 4, j: 1 });
  for (let i = 0; i < 40; i++) { const x = s.rand(30, W - 30), y = s.rand(30, H - 30); s.ellipse(x, y, 1.6, 1.6, { w: 0, j: 0, fill: '#000' }); }
  const note = (x, y, w, h, rot, lines) => {
    s.ctx.save(); s.ctx.translate(x, y); s.ctx.rotate(rot);
    s.rect(-w / 2, -h / 2, w, h, { w: 4, j: 0.6, fill: '#fff' });
    for (let i = 0; i < lines; i++) s.line(-w / 2 + 14, -h / 2 + 26 + i * 18, w / 2 - 14 - s.rand(0, 30), -h / 2 + 26 + i * 18, { w: 3, j: 0.6, alpha: 0.8 });
    s.ellipse(0, -h / 2 + 8, 7, 7, { w: 0, j: 0, fill: '#000' });
    s.ctx.restore();
  };
  note(110, 110, 130, 110, -0.08, 4);
  note(380, 120, 120, 120, 0.06, 5);
  note(120, 260, 120, 100, 0.05, 3);
  s.ctx.save(); s.ctx.translate(260, 220); s.ctx.rotate(-0.04);
  s.rect(-70, -60, 140, 120, { w: 4, j: 0.6, fill: '#fff' });
  s.stroke([[-50, 30], [-20, -10], [10, 20], [40, -30]], { w: 3, j: 0.8 });
  s.star(40, -30, 12, { w: 3 });
  s.ellipse(0, -52, 7, 7, { w: 0, j: 0, fill: '#000' });
  s.ctx.restore();
  s.star(400, 270, 30, { w: 5 });
  return s.texture();
}

// Curtain folds (vertical lines).
export function curtainTexture() {
  const W = 256, H = 1024, s = new Sketch(W, H, { seed: 121 });
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 42 + s.rand(-6, 6);
    s.line(x, s.rand(10, 120), x + s.rand(-6, 6), H - s.rand(0, 60), { w: 3, j: 2, alpha: 0.75 });
  }
  return s.texture();
}

// ---------------------------------------------------------------------------
// Window view, painted as three parallax layers. Each layer is described in
// world meters on its own plane: cx/cy = plane center, w/h = plane size.

function layer(def, seed, draw) {
  const ppm = def.ppm;
  const s = new Sketch(Math.round(def.w * ppm), Math.round(def.h * ppm), { seed, transparent: true });
  const X = (x) => (x - (def.cx - def.w / 2)) * ppm;
  const Y = (y) => ((def.cy + def.h / 2) - y) * ppm;
  draw(s, X, Y, ppm);
  return s.texture();
}

function cloud(s, X, Y, ppm, x, y, w) {
  // bumpy top, flat-ish bottom
  const pts = [];
  const bumps = 4 + Math.floor(s.rand(0, 2));
  const h = w * 0.32;
  pts.push([X(x - w / 2), Y(y)]);
  for (let i = 0; i < bumps; i++) {
    const a = x - w / 2 + (w * i) / bumps, b = x - w / 2 + (w * (i + 1)) / bumps;
    const mid = (a + b) / 2, hh = h * (0.55 + 0.45 * Math.sin((i + 0.5) / bumps * Math.PI)) * s.rand(0.85, 1.1);
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push([X(a + (b - a) * t), Y(y + Math.sin(t * Math.PI) * hh * 0.6 + hh * 0.4 * Math.sin((mid - x + w / 2) / w * Math.PI))]);
    }
  }
  pts.push([X(x + w / 2), Y(y)]);
  s.stroke(pts, { w: 3, j: 0.8, fill: '#fff', closed: true });
  s.arc(X(x - w * 0.12), Y(y + h * 0.35), w * 0.09 * ppm, h * 0.22 * ppm, Math.PI * 1.1, Math.PI * 1.9, { w: 2.2, j: 0.4, alpha: 0.8 });
}

// Positions below are tuned so that, from the starting camera, the window
// frames the same composition as the reference: sun + clouds in the top band,
// the castle town centre-right ~18% down, bridge ~60% down, river winding to
// the bottom right.
export const SKY = { cx: 11, cy: 1, w: 44, h: 16, ppm: 46, z: -32 };
export const MID = { cx: 7.5, cy: -2.5, w: 26, h: 12, ppm: 80, z: -19 };
export const NEAR = { cx: 3.8, cy: -3.4, w: 16, h: 9, ppm: 128, z: -9.5 };

export function skyTexture() {
  return layer(SKY, 141, (s, X, Y, ppm) => {
    s.ctx.fillStyle = '#fff';
    s.ctx.fillRect(0, 0, s.w, s.h);
    s.ellipse(X(14.7), Y(2.85), 0.55 * ppm, 0.55 * ppm, { w: 3.2, j: 0.5 });
    cloud(s, X, Y, ppm, 5.4, 2.35, 2.6);
    cloud(s, X, Y, ppm, 10.9, 3.05, 1.5);
    cloud(s, X, Y, ppm, 16.9, 2.4, 2.2);
    cloud(s, X, Y, ppm, 0.5, 2.8, 2.4);
    cloud(s, X, Y, ppm, 21.5, 2.9, 2.0);
    for (const [bx, by] of [[8.4, 2.85], [8.9, 3.05], [12.6, 3.3]]) {
      s.arc(X(bx - 0.14), Y(by), 0.14 * ppm, 0.1 * ppm, Math.PI * 1.15, Math.PI * 1.85, { w: 2, j: 0.2 });
      s.arc(X(bx + 0.14), Y(by), 0.14 * ppm, 0.1 * ppm, Math.PI * 1.15, Math.PI * 1.85, { w: 2, j: 0.2 });
    }
  });
}

export function midTexture() {
  return layer(MID, 151, (s, X, Y, ppm) => {
    const W = (m) => m * ppm;
    const town = 8.1;
    const hillY = (x) => {
      const d = (x - town) / 3.4;
      return 0.22 + Math.sin(x * 0.55) * 0.12 + Math.sin(x * 1.3 + 1) * 0.05 + Math.max(0, 1 - d * d) * 0.62;
    };
    const hill = [];
    for (let x = -5.5; x <= 20.5; x += 0.2) hill.push([X(x), Y(hillY(x))]);
    s.stroke([...hill, [X(20.5), Y(-9)], [X(-5.5), Y(-9)]], { w: 3, j: 0.7, fill: '#fff' });
    // a second, farther ridge line
    const far = [];
    for (let x = -5.5; x <= 20.5; x += 0.25) far.push([X(x), Y(0.42 + Math.sin(x * 0.33 + 2) * 0.16)]);
    s.stroke(far, { w: 2.2, j: 0.6, alpha: 0.7 });
    for (let i = 0; i < 30; i++) {
      const x = s.rand(-3, 18), y = hillY(x) - s.rand(0.08, 0.5);
      s.line(X(x), Y(y), X(x + 0.22), Y(y + 0.07), { w: 1.8, alpha: 0.5, j: 0.3 });
    }
    // castle town: [x, width, height]
    const bld = [
      [5.9, 0.42, 0.24], [6.35, 0.4, 0.36], [6.8, 0.38, 0.3], [7.2, 0.36, 0.55], [7.6, 0.4, 0.72], [8.0, 0.34, 1.02],
      [8.38, 0.4, 0.66], [8.8, 0.38, 0.82], [9.22, 0.4, 0.5], [9.65, 0.38, 0.4], [10.1, 0.42, 0.28], [10.55, 0.38, 0.2],
    ];
    for (const [x, w, h] of bld) {
      const b = hillY(x) - 0.06;
      s.rect(X(x - w / 2), Y(b + h), W(w), W(h), { w: 2.6, j: 0.4, fill: '#fff' });
      if (h > 0.5) {
        s.stroke([[X(x - w / 2 - 0.04), Y(b + h)], [X(x), Y(b + h + 0.26)], [X(x + w / 2 + 0.04), Y(b + h)]], { w: 2.6, j: 0.3, fill: '#fff' });
      } else {
        for (let k = 0; k < 3; k++) s.rect(X(x - w / 2 + k * w / 3 + 0.02), Y(b + h + 0.06), W(w / 6), W(0.06), { w: 2, j: 0.1, fill: '#fff' });
      }
      for (let r = 0; r < 4; r++) {
        const wy = b + h - 0.12 - r * 0.2;
        if (wy < b + 0.08) break;
        s.rect(X(x - 0.06), Y(wy), W(0.05), W(0.075), { w: 1.6, j: 0, fill: '#000' });
        if (w > 0.37) s.rect(X(x + 0.04), Y(wy), W(0.045), W(0.075), { w: 1.6, j: 0, fill: '#000' });
      }
    }
    // flag on the main tower
    const top = hillY(8.0) - 0.06 + 1.02 + 0.26;
    s.line(X(8.0), Y(top), X(8.0), Y(top + 0.22), { w: 2.2 });
    s.stroke([[X(8.0), Y(top + 0.22)], [X(8.2), Y(top + 0.16)], [X(8.0), Y(top + 0.1)]], { w: 2, fill: '#000' });
    for (const tx of [3.6, 4.0, 4.4, 11.6, 12.0, 13.2]) {
      const ty = hillY(tx);
      s.ellipse(X(tx), Y(ty + 0.14), W(0.11), W(0.14), { w: 2.2, j: 0.4, fill: '#fff' });
      s.line(X(tx), Y(ty), X(tx), Y(ty - 0.06), { w: 2.2 });
    }
  });
}

export function nearTexture() {
  return layer(NEAR, 161, (s, X, Y, ppm) => {
    const W = (m) => m * ppm;
    const ridgeY = (x) => 0.98 + Math.sin(x * 0.7 + 0.5) * 0.14 + Math.sin(x * 1.9) * 0.04;
    const ridge = [];
    for (let x = -4.2; x <= 11.8; x += 0.2) ridge.push([X(x), Y(ridgeY(x))]);
    s.stroke([...ridge, [X(11.8), Y(-8)], [X(-4.2), Y(-8)]], { w: 3.2, j: 0.8, fill: '#fff' });

    // river: from under the bridge, winding down to the bottom right
    const river = (off) => {
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.04) {
        const x = 3.55 + t * 1.6 + Math.sin(t * 5.2) * 0.45 + off * (0.12 + t * 0.45);
        const y = 0.55 - t * 1.9;
        pts.push([X(x), Y(y)]);
      }
      return pts;
    };
    s.stroke(river(-1), { w: 3, j: 0.8 });
    s.stroke(river(1), { w: 3, j: 0.8 });
    for (let i = 0; i < 8; i++) {
      const t = 0.12 + i * 0.1, x = 3.55 + t * 1.6 + Math.sin(t * 5.2) * 0.45, y = 0.55 - t * 1.9;
      s.line(X(x - 0.08), Y(y), X(x + 0.07), Y(y + 0.01), { w: 1.8, alpha: 0.6, j: 0.2 });
    }

    // arched stone bridge
    const bx = 3.5, by = 0.66, bw = 1.15;
    s.stroke([[X(bx - bw / 2 - 0.14), Y(by - 0.1)], [X(bx - bw / 2), Y(by + 0.06)], [X(bx + bw / 2), Y(by + 0.06)], [X(bx + bw / 2 + 0.14), Y(by - 0.1)], [X(bx + bw / 2 + 0.14), Y(by - 0.26)], [X(bx - bw / 2 - 0.14), Y(by - 0.26)]], { w: 3, j: 0.4, fill: '#fff', closed: true });
    s.line(X(bx - bw / 2), Y(by - 0.02), X(bx + bw / 2), Y(by - 0.02), { w: 2 });
    for (const ax of [-0.32, 0.32]) s.arc(X(bx + ax), Y(by - 0.27), W(0.22), W(0.17), Math.PI, Math.PI * 2, { w: 2.6, j: 0.2, fill: '#fff' });
    for (let k = -0.5; k <= 0.51; k += 0.125) s.line(X(bx + k), Y(by + 0.06), X(bx + k), Y(by + 0.15), { w: 2 });
    s.line(X(bx - bw / 2), Y(by + 0.15), X(bx + bw / 2), Y(by + 0.15), { w: 2.2 });
    for (let k = -0.45; k <= 0.45; k += 0.15) s.line(X(bx + k), Y(by - 0.12), X(bx + k + 0.06), Y(by - 0.12), { w: 1.6, alpha: 0.6 });

    // footpath on the left leading toward the bridge
    s.stroke([[X(1.6), Y(-0.9)], [X(2.1), Y(-0.1)], [X(2.55), Y(0.45)], [X(2.85), Y(0.6)]], { w: 2.4, j: 0.8 });
    s.stroke([[X(2.3), Y(-0.9)], [X(2.55), Y(-0.1)], [X(2.85), Y(0.4)], [X(3.0), Y(0.52)]], { w: 2.4, j: 0.8 });

    // trees on the left ridge
    for (const [tx, tr] of [[1.75, 0.2], [2.12, 0.16], [1.35, 0.17], [0.4, 0.22]]) {
      const ty = ridgeY(tx) - 0.02;
      s.line(X(tx), Y(ty), X(tx), Y(ty + tr * 0.9), { w: 2.4 });
      const blob = [];
      for (let a = 0; a < Math.PI * 2; a += 0.3) blob.push([X(tx + Math.cos(a) * tr * (1 + 0.12 * Math.sin(a * 5))), Y(ty + tr * 1.6 + Math.sin(a) * tr * 1.1 * (1 + 0.12 * Math.sin(a * 5)))]);
      s.stroke(blob, { w: 2.4, j: 0.4, fill: '#fff', closed: true });
    }
    // fence posts on the right
    for (let i = 0; i < 5; i++) {
      const fx = 5.75 + i * 0.32, fy = 0.6 - i * 0.03;
      s.line(X(fx), Y(fy), X(fx), Y(fy + 0.3), { w: 3 });
    }
    s.line(X(5.75), Y(0.82), X(7.05), Y(0.7), { w: 2.2 });
    for (let i = 0; i < 40; i++) {
      const x = s.rand(-2, 10), y = s.rand(-2.5, 0.55);
      s.stroke([[X(x - 0.04), Y(y)], [X(x), Y(y + 0.07)], [X(x + 0.04), Y(y)]], { w: 1.8, j: 0.1, alpha: 0.65 });
    }
  });
}

// ---------------------------------------------------------------------------
// Milestone 2: desk, kitchen and clutter textures.

// Monitor screens are redrawn at runtime (off / on / cycling text), so these
// return the Sketch plus a redraw function.
const CHAT = {
  en: [['mom', 'did you eat yet?'], ['me', 'yes!! noodles again'], ['note', 'drink water. stretch.'], ['me', 'small steps, big dreams'], ['todo', 'finish the room sketch'], ['friend', 'call this weekend?']],
  zh: [['媽', '吃飯了沒？'], ['我', '吃了！！又是麵'], ['備忘', '喝水。伸展一下。'], ['我', '一小步，大夢想'], ['待辦', '把房間草圖畫完'], ['朋友', '這週末通個電話？']],
};
const SKETCH_TITLES = {
  en: ['untitled_room.png', 'castle_on_hill.png', 'self_portrait_v3.png', 'cat_doodles.png'],
  zh: ['未命名房間.png', '山丘上的城堡.png', '自畫像_v3.png', '貓咪塗鴉.png'],
};

export function screenSketches() {
  const land = new Sketch(512, 320, { seed: 201 });
  const port = new Sketch(256, 420, { seed: 202 });
  const off = (s) => {
    s.ctx.fillStyle = '#121212'; s.ctx.fillRect(0, 0, s.w, s.h);
    s.line(s.w * 0.12, s.h * 0.16, s.w * 0.3, s.h * 0.08, { w: 6, color: '#fff', alpha: 0.5 });
  };
  const drawLand = (on, k) => {
    const s = land;
    s.r = makeRng(300 + k);
    if (!on) return off(s);
    s.ctx.fillStyle = '#fff'; s.ctx.fillRect(0, 0, s.w, s.h);
    s.rect(0, 0, s.w, 34, { w: 0, fill: '#1a1a1a', j: 0 });
    const titles = say(SKETCH_TITLES);
    s.fitText(titles[k % titles.length], 70, 18, s.w - 84, 26, { max: 22, align: 'left', color: '#fff' });
    for (let i = 0; i < 3; i++) s.ellipse(20 + i * 16, 17, 5, 5, { w: 0, fill: '#fff', j: 0 });
    // tool column
    s.line(56, 34, 56, s.h, { w: 3, j: 0 });
    s.stroke([[18, 64], [38, 44], [44, 50], [24, 70]], { w: 3, closed: true, j: 0.3 });
    s.ellipse(28, 104, 10, 10, { w: 3, fill: '#000' });
    s.rect(18, 132, 22, 18, { w: 3 });
    s.ellipse(28, 182, 11, 11, { w: 3 });
    // drawing on the canvas: a different doodle per page
    const cx = 290, cy = 180;
    if (k % 4 === 0) {
      s.rect(cx - 120, cy - 50, 240, 120, { w: 4 });
      s.stroke([[cx - 120, cy - 50], [cx - 60, cy - 110], [cx + 60, cy - 110], [cx + 120, cy - 50]], { w: 4 });
      s.rect(cx - 20, cy, 40, 70, { w: 4 });
      s.smiley(cx + 70, cy + 10, 22, { w: 3 });
    } else if (k % 4 === 1) {
      s.stroke([[cx - 170, cy + 80], [cx - 60, cy - 20], [cx + 70, cy - 30], [cx + 180, cy + 80]], { w: 4 });
      for (const [x, h] of [[-50, 60], [-15, 100], [20, 75], [55, 50]]) s.rect(cx + x, cy - 20 - h, 30, h, { w: 3, fill: '#fff' });
      s.ellipse(cx + 140, cy - 90, 22, 22, { w: 4 });
    } else if (k % 4 === 2) {
      s.ellipse(cx, cy - 10, 70, 70, { w: 4 });
      s.rect(cx - 50, cy - 30, 40, 30, { w: 7 }); s.rect(cx + 10, cy - 30, 40, 30, { w: 7 });
      s.arc(cx, cy + 20, 20, 14, 0.3, Math.PI - 0.3, { w: 4 });
      s.hatch(cx - 75, cy - 95, 150, 50, { gap: 7, lw: 3, alpha: 1 });
    } else {
      for (let i = 0; i < 3; i++) {
        const x = cx - 120 + i * 120;
        s.ellipse(x, cy, 34, 30, { w: 4 });
        s.stroke([[x - 30, cy - 10], [x - 24, cy - 46], [x - 8, cy - 28]], { w: 4 });
        s.stroke([[x + 8, cy - 28], [x + 24, cy - 46], [x + 30, cy - 10]], { w: 4 });
      }
    }
    land.tex && (land.tex.needsUpdate = true);
  };
  const drawPort = (on, k) => {
    const s = port;
    s.r = makeRng(400 + k);
    if (!on) return off(s);
    s.ctx.fillStyle = '#fff'; s.ctx.fillRect(0, 0, s.w, s.h);
    s.rect(0, 0, s.w, 40, { w: 0, fill: '#1a1a1a', j: 0 });
    s.text(getLang() === 'zh' ? '訊息' : 'messages', s.w / 2, 21, 24, { color: '#fff' });
    const chat = say(CHAT);
    let y = 64;
    for (let i = 0; i < 4; i++) {
      const [who, msg] = chat[(k + i) % chat.length];
      const mine = who === 'me' || who === '我';
      const w = 200, h = 66, x = mine ? s.w - w - 12 : 12;
      s.rect(x, y, w, h, { w: 3, j: 0.6, fill: mine ? '#ddd' : '#fff' });
      s.text(who, x + 10, y + 16, 18, { align: 'left' });
      s.fitText(msg, x + 10, y + 44, w - 20, 24, { max: 20, align: 'left' });
      y += h + 14;
    }
    s.rect(12, s.h - 46, s.w - 24, 34, { w: 3 });
    port.tex && (port.tex.needsUpdate = true);
  };
  // a language switch redraws whatever the screens show now
  let shown = [false, 0];
  const show = (fn) => (on, k) => { shown = [on, k]; fn(on, k); };
  drawLand(false, 0); drawPort(false, 0);
  land.tex = land.texture(); port.tex = port.texture();
  const offLang = onLang(() => { drawLand(...shown); drawPort(...shown); });
  land.tex.addEventListener('dispose', offLang);
  return { land, port, drawLand: show(drawLand), drawPort: show(drawPort) };
}

export function keyboardTexture() {
  const s = new Sketch(512, 160, { seed: 211 });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) {
    if (r === 3 && c > 3 && c < 10) continue;
    s.rect(10 + c * 35.5, 10 + r * 36, 30, 30, { w: 2.5, j: 0.3 });
  }
  s.rect(10 + 4 * 35.5, 10 + 3 * 36, 6 * 35.5 - 5, 30, { w: 2.5, j: 0.3 });
  return s.texture();
}

export function stickyTexture(seed) {
  const s = new Sketch(128, 128, { seed });
  s.rect(4, 4, 120, 120, { w: 5, j: 0.5 });
  for (let i = 0; i < 3; i++) s.line(18, 36 + i * 26, 110 - s.rand(0, 40), 36 + i * 26, { w: 4, j: 0.8 });
  if (seed % 2) s.star(96, 100, 12, { w: 3 });
  return s.texture();
}

export function tileTexture() {
  const s = new Sketch(512, 512, { seed: 221 });
  const n = 6, t = 512 / n;
  for (let i = 0; i <= n; i++) {
    s.line(i * t, -4, i * t, 516, { w: 3, j: 0.8 });
    s.line(-4, i * t, 516, i * t, { w: 3, j: 0.8 });
  }
  for (let i = 0; i < 5; i++) { const x = s.rand(0, n) | 0, y = s.rand(0, n) | 0; s.line(x * t + 12, y * t + 14, x * t + 30, y * t + 10, { w: 2, alpha: 0.5 }); }
  return s.texture({ repeat: true });
}

export function labelTexture(text, seed) {
  return letteredTexture((lang) => {
    const s = new Sketch(256, 128, { seed });
    s.rect(30, 24, 196, 80, { w: 5, j: 0.6 });
    s.fitText(say(text, lang), 128, 66, 170, 60, { max: 52 });
    return s;
  });
}

export function towelTexture() {
  const s = new Sketch(128, 256, { seed: 231 });
  for (const y of [36, 50, 206, 220]) s.line(0, y, 128, y, { w: 5, j: 0.6 });
  s.rect(4, 4, 120, 248, { w: 3, j: 0.6, alpha: 0.6 });
  return s.texture();
}

export function basketTexture() {
  const s = new Sketch(512, 128, { seed: 241 });
  for (let x = 0; x < 512; x += 24) s.line(x, 0, x, 128, { w: 3, j: 0.5 });
  for (let y = 16; y < 128; y += 22) for (let x = 0; x < 512; x += 48) s.line(x + ((y / 22) % 2) * 24, y, x + 24 + ((y / 22) % 2) * 24, y, { w: 4, j: 0.4 });
  return s.texture({ repeat: true });
}

export function cabinetTexture(seed) {
  const s = new Sketch(256, 256, { seed });
  s.rect(10, 10, 236, 236, { w: 6, j: 0.8 });
  s.rect(34, 34, 188, 188, { w: 3, j: 0.8, alpha: 0.7 });
  return s.texture();
}

export function cerealTexture() {
  return letteredTexture((lang) => {
    const s = new Sketch(160, 256, { seed: 251 });
    s.rect(6, 6, 148, 244, { w: 5 });
    s.fitText(lang === 'zh' ? '麥片' : 'O\'s', 80, 70, 130, 64, { max: 56 });
    s.ellipse(80, 160, 40, 34, { w: 4 });
    for (const [x, y] of [[66, 150], [92, 166], [78, 176]]) s.ellipse(x, y, 7, 7, { w: 3 });
    return s;
  });
}

export function posterTea() {
  return poster({ en: ['Tea', 'First', 'Then'], zh: ['先喝茶', '其他的', '再說'] }, (s, y, lang) => {
    if (lang !== 'zh') s.text('everything', 256, y - 30, 64);
    s.ellipse(256, y + 70, 46, 30, { w: 6 });
    s.arc(312, y + 70, 18, 16, -1.3, 1.3, { w: 6 });
    for (let i = 0; i < 3; i++) s.stroke([[226 + i * 28, y + 20], [236 + i * 28, y], [226 + i * 28, y - 16]], { w: 4 });
  }, 63);
}

export function clockTexture() {
  const s = new Sketch(256, 256, { seed: 261 });
  s.ellipse(128, 128, 118, 118, { w: 8, j: 0.6 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s.line(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92, 128 + Math.cos(a) * (i % 3 ? 102 : 108), 128 + Math.sin(a) * (i % 3 ? 102 : 108), { w: i % 3 ? 4 : 7 });
  }
  s.line(128, 128, 128 + 46, 128 + 30, { w: 8 });
  s.line(128, 128, 128 - 10, 128 - 76, { w: 5 });
  s.ellipse(128, 128, 7, 7, { w: 0, fill: '#000', j: 0 });
  return s.texture();
}

export function calendarTexture() {
  return letteredTexture((lang) => {
  const s = new Sketch(256, 320, { seed: 271 });
  s.rect(8, 8, 240, 304, { w: 6 });
  s.fitText(lang === 'zh' ? '十月' : 'OCTOBER', 128, 44, 210, 46, { max: 40 });
  s.line(20, 72, 236, 72, { w: 4 });
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
    const x = 22 + c * 31, y = 86 + r * 42;
    s.rect(x, y, 28, 36, { w: 2, j: 0.3, alpha: 0.6 });
    if (r * 7 + c === 15) s.ellipse(x + 14, y + 18, 18, 18, { w: 4 });
    if (r * 7 + c < 15 && r * 7 + c > 2) { s.line(x + 4, y + 4, x + 24, y + 32, { w: 2.5 }); s.line(x + 24, y + 4, x + 4, y + 32, { w: 2.5 }); }
  }
  return s;
  });
}

export function mirrorTexture() {
  const s = new Sketch(256, 640, { seed: 281 });
  for (const [x, y, l] of [[60, 120, 90], [90, 110, 60], [150, 380, 80], [176, 372, 50]]) s.line(x, y + l, x + l * 0.6, y, { w: 5, alpha: 0.6 });
  return s.texture();
}
