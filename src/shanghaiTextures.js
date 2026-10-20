import * as THREE from 'three';
import { Sketch, makeRng } from './sketch.js';
import { HANZI } from './taiwanTextures.js';

// Line-art textures for the Shanghai chapter (the Bund): white paper, black ink,
// the same wobbly pen as the room and Jiufen.

// Square granite paving, 2 m tile (triplanar): 4 x 4 slabs with a few
// speckles and the odd hairline crack.
export function tileTexture(seed = 301) {
  const S = 1024, s = new Sketch(S, S, { seed });
  const n = 4, c = S / n;
  for (let i = 0; i <= n; i++) {
    for (const d of [0, S]) {
      s.line(-8, i * c + d + s.rand(-2, 2), S + 8, i * c + d + s.rand(-2, 2), { w: 3.2, j: 1.1 });
      s.line(i * c + d + s.rand(-2, 2), -8, i * c + d + s.rand(-2, 2), S + 8, { w: 3.2, j: 1.1 });
    }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    const x = i * c, y = k * c;
    for (let q = 0; q < 7; q++) s.ellipse(x + s.rand(14, c - 14), y + s.rand(14, c - 14), 1.5, 1.5, { w: 0, j: 0, fill: 'rgba(0,0,0,0.45)' });
    if (s.r() < 0.18) {
      const cx = x + s.rand(30, c - 30), cy = y + s.rand(30, c - 30);
      s.stroke([[cx, cy], [cx + s.rand(-24, 24), cy + s.rand(10, 26)], [cx + s.rand(-30, 30), cy + s.rand(24, 44)]], { w: 1.4, j: 0.6, alpha: 0.45 });
    }
    // a soft worn corner now and then
    if (s.r() < 0.25) s.hatch(x + 6, y + 6, c * 0.3, c * 0.3, { gap: 9, lw: 1, alpha: 0.18, angle: 0.8 });
  }
  return s.texture({ repeat: true });
}

// Granite kerb / coping: long blocks.
export function kerbTexture(seed = 303) {
  const S = 512, s = new Sketch(S, S, { seed });
  for (let i = 0; i < 2; i++) {
    const y = i * 256;
    s.line(-5, y + s.rand(-2, 2), S + 5, y + s.rand(-2, 2), { w: 3, j: 1 });
    let x = s.rand(-80, 0);
    while (x < S) { s.line(x, y + 2, x + s.rand(-3, 3), y + 254, { w: 2.6, j: 0.8 }); x += s.rand(220, 320); }
  }
  for (let i = 0; i < 30; i++) s.ellipse(s.rand(0, S), s.rand(0, S), 1.3, 1.3, { w: 0, j: 0, fill: 'rgba(0,0,0,0.4)' });
  return s.texture({ repeat: true });
}

// Facade windows for the skyline (world-space, mipmapped so they fade to an even tone).
// kind 'grid': punched windows; 'bands': floor bands (glass towers); 'vert': vertical fins.
export function towerTexture(kind = 'grid', seed = 311) {
  const S = 256, s = new Sketch(S, S, { seed });
  const ctx = s.ctx;
  const r = makeRng(seed + 2);
  ctx.fillStyle = '#000';
  if (kind === 'grid') {
    for (let row = 0; row < 8; row++) for (let col = 0; col < 6; col++) {
      if (r() < 0.12) continue;
      ctx.globalAlpha = 0.5 + r() * 0.4;
      ctx.fillRect(9 + col * 41, 7 + row * 32, 24, 17);
    }
  } else if (kind === 'bands') {
    for (let row = 0; row < 8; row++) {
      ctx.globalAlpha = 0.42 + r() * 0.2;
      ctx.fillRect(0, 8 + row * 32, S, 13);
    }
    ctx.globalAlpha = 0.5;
    for (let col = 0; col < 8; col++) ctx.fillRect(col * 32, 0, 2, S);
  } else if (kind === 'vert') {
    for (let col = 0; col < 10; col++) { ctx.globalAlpha = 0.5 + r() * 0.3; ctx.fillRect(4 + col * 25.6, 0, 9, S); }
    ctx.globalAlpha = 0.45;
    for (let row = 0; row < 4; row++) ctx.fillRect(0, row * 64, S, 3);
  } else {
    // 'fine': a light grid of mullions
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 8; i++) { ctx.fillRect(i * 32, 0, 3, S); ctx.fillRect(0, i * 32, S, 3); }
  }
  ctx.globalAlpha = 1;
  return s.texture({ repeat: true });
}

// Shanghai Tower skin: floor lines (u around, v up), mapped by UV.
export function spiralTowerTexture(seed = 321) {
  const S = 512, s = new Sketch(S, S, { seed });
  for (let i = 0; i < 16; i++) s.line(-4, i * 32 + 16, S + 4, i * 32 + 16, { w: 2.2, j: 0.4, alpha: 0.6 });
  for (let i = 0; i < 8; i++) s.line(i * 64 + 20, -4, i * 64 + 22, S + 4, { w: 1.2, j: 0.3, alpha: 0.3 });
  return s.texture({ repeat: true });
}

// The pearls: a few latitude bands and soft shading strokes.
export function pearlTexture(seed = 331) {
  const W = 512, H = 256, s = new Sketch(W, H, { seed });
  for (const v of [0.3, 0.42, 0.5, 0.58, 0.7]) s.line(-4, v * H, W + 4, v * H, { w: v === 0.5 ? 3.2 : 1.6, j: 0.3, alpha: v === 0.5 ? 0.85 : 0.45 });
  for (let i = 0; i < 24; i++) {
    const x = (i / 24) * W;
    s.line(x, H * 0.46, x, H * 0.54, { w: 1.6, j: 0.2, alpha: 0.6 });
  }
  s.hatch(0, H * 0.72, W, H * 0.26, { gap: 10, lw: 1.2, alpha: 0.3, angle: 1.2 });
  return s.texture({ repeat: true });
}

// Historic Bund facade: rusticated base with arches, rows of windows with
// pediments, a cornice. Drawn for the whole front of one building.
export function facadeTexture(seed = 341, { floors = 6, cols = 7, arches = true } = {}) {
  const W = 512, H = 512, s = new Sketch(W, H, { seed });
  const base = H * 0.22;
  // cornice + string courses
  s.line(-4, 18, W + 4, 18, { w: 4, j: 0.6 });
  s.line(-4, 30, W + 4, 30, { w: 2, j: 0.5 });
  s.line(-4, H - base, W + 4, H - base, { w: 3.4, j: 0.6 });
  // rustication on the ground floor
  for (let y = H - base + 16; y < H; y += 16) s.line(-4, y, W + 4, y, { w: 1.3, j: 0.4, alpha: 0.5 });
  const cw = W / cols;
  for (let c = 0; c < cols; c++) {
    const cx = (c + 0.5) * cw;
    if (arches) {
      const aw = cw * 0.52, top = H - base + 22;
      s.stroke([[cx - aw / 2, H], [cx - aw / 2, top + aw / 2], ...s.ellipsePts(cx, top + aw / 2, aw / 2, aw / 2, Math.PI, Math.PI * 2, 12), [cx + aw / 2, H]], { w: 2.6, j: 0.5, fill: '#3a3a3a' });
    }
    const fh = (H - base - 44) / floors;
    for (let f = 0; f < floors; f++) {
      const y = 40 + f * fh, ww = cw * 0.42, wh = fh * 0.58;
      s.rect(cx - ww / 2, y + fh * 0.22, ww, wh, { w: 2.2, j: 0.4, fill: '#555' });
      s.line(cx, y + fh * 0.22, cx, y + fh * 0.22 + wh, { w: 1.2, j: 0.2, color: '#fff', alpha: 0.7 });
      if (f === 1 || f === 3) s.stroke([[cx - ww / 2 - 5, y + fh * 0.2], [cx, y + fh * 0.06], [cx + ww / 2 + 5, y + fh * 0.2]], { w: 2, j: 0.3 });
      else s.line(cx - ww / 2 - 5, y + fh * 0.18, cx + ww / 2 + 5, y + fh * 0.18, { w: 2, j: 0.3 });
    }
    // pilasters between bays
    if (c > 0) s.line(c * cw, 34, c * cw, H - base, { w: 1.4, j: 0.4, alpha: 0.45 });
  }
  return s.texture();
}

// The 外灘 pylon sign (and other vertical hanzi signs) - dark board, light characters.
export function verticalSign(text, seed = 351) {
  const chars = [...text];
  const W = 160, H = chars.length * 150 + 60;
  const s = new Sketch(W, H, { seed, bg: '#5a5a5a' });
  s.hatch(0, 0, W, H, { gap: 9, lw: 1.2, alpha: 0.3, angle: 0.8, j: 0.3 });
  s.rect(8, 8, W - 16, H - 16, { w: 5, j: 0.6, color: '#fff' });
  chars.forEach((c, i) => s.text(c, W / 2, 30 + (i + 0.5) * ((H - 60) / chars.length), 112, { font: HANZI, color: '#fff' }));
  return s.texture();
}

// "Coffee" hanging sign: a board with a cup doodle and steam.
export function coffeeSignTexture(seed = 361) {
  const W = 512, H = 300, s = new Sketch(W, H, { seed });
  s.rect(10, 10, W - 20, H - 20, { w: 7, j: 0.8 });
  s.rect(26, 26, W - 52, H - 52, { w: 2, j: 0.6, alpha: 0.7 });
  s.text('Coffee', W * 0.6, H * 0.52, 118);
  // cup
  const cx = 104, cy = 170;
  s.stroke([[cx - 46, cy - 34], [cx - 38, cy + 34], [cx + 38, cy + 34], [cx + 46, cy - 34]], { w: 5, j: 0.6, closed: true, fill: '#fff' });
  s.arc(cx + 50, cy - 6, 18, 18, -Math.PI / 2, Math.PI / 2, { w: 5, j: 0.4 });
  s.line(cx - 64, cy + 44, cx + 64, cy + 44, { w: 5, j: 0.5 });
  for (const dx of [-18, 0, 18]) s.stroke([[cx + dx, cy - 50], [cx + dx + 8, cy - 70], [cx + dx - 4, cy - 88], [cx + dx + 6, cy - 106]], { w: 3.4, j: 0.5 });
  return s.texture();
}

// Fascia sign over the windows.
export function fasciaTexture(seed = 363) {
  const W = 1024, H = 160, s = new Sketch(W, H, { seed, bg: '#3c3c3c' });
  s.rect(8, 8, W - 16, H - 16, { w: 4, j: 0.6, color: '#fff' });
  s.text('BUND  COFFEE', W * 0.42, H * 0.55, 92, { color: '#fff' });
  s.text('咖啡', W * 0.86, H * 0.53, 86, { font: HANZI, color: '#fff' });
  return s.texture();
}

// Chalk menu board.
export function menuTexture(items, seed = 365) {
  const W = 384, H = 512, s = new Sketch(W, H, { seed, bg: '#2e2e2e' });
  s.rect(10, 10, W - 20, H - 20, { w: 8, j: 0.6, color: '#8a8a8a' });
  s.text(items[0], W / 2, 62, 64, { color: '#fff' });
  s.line(70, 102, W - 70, 102, { w: 2.4, j: 0.6, color: '#fff', alpha: 0.8 });
  items.slice(1).forEach((it, i) => {
    s.text(it, 40, 150 + i * 62, 42, { color: '#fff', align: 'left' });
    for (let d = 0; d < 5; d++) s.ellipse(W - 110 + d * 10, 158 + i * 62, 1.6, 1.6, { w: 0, j: 0, fill: '#ddd' });
    s.text(`${18 + ((i * 7) % 15)}`, W - 44, 150 + i * 62, 40, { color: '#fff', align: 'right' });
  });
  return s.texture();
}

// Striped awning.
export function awningTexture(seed = 367) {
  const W = 512, H = 256, s = new Sketch(W, H, { seed });
  const n = 8;
  for (let i = 0; i < n; i++) {
    if (i % 2) {
      s.ctx.fillStyle = '#6a6a6a';
      s.ctx.fillRect((i / n) * W, 0, W / n, H);
      s.hatch((i / n) * W, 0, W / n, H, { gap: 9, lw: 1.2, alpha: 0.35, angle: 1.1 });
    }
    s.line((i / n) * W, -4, (i / n) * W, H + 4, { w: 2.2, j: 0.4 });
  }
  // scalloped valance line at the bottom edge
  for (let i = 0; i < n * 2; i++) s.arc(((i + 0.5) / (n * 2)) * W, H - 26, W / (n * 4), 14, 0, Math.PI, { w: 2.4, j: 0.3 });
  return s.texture({ repeat: true });
}

// Life ring: four light / dark segments around the ring, two rope loops.
export function lifeRingTexture(seed = 371) {
  const W = 512, H = 128, s = new Sketch(W, H, { seed });
  const ctx = s.ctx;
  for (let i = 0; i < 8; i++) {
    if (i % 2) continue;
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect((i / 8) * W, 0, W / 8, H);
    s.hatch((i / 8) * W, 0, W / 8, H, { gap: 8, lw: 1.2, alpha: 0.4, angle: 0.9 });
  }
  for (let i = 0; i < 8; i++) s.line((i / 8) * W, -2, (i / 8) * W, H + 2, { w: 2.4, j: 0.2 });
  return s.texture({ repeat: true });
}

// Small sign with a camera icon (the photo spot).
export function photoSignTexture(seed = 373) {
  const W = 256, H = 256, s = new Sketch(W, H, { seed });
  s.rect(8, 8, W - 16, H - 16, { w: 6, j: 0.6 });
  const cx = W / 2, cy = 112;
  s.rect(cx - 66, cy - 36, 132, 88, { w: 6, j: 0.5, fill: '#fff' });
  s.rect(cx - 30, cy - 52, 50, 18, { w: 5, j: 0.4, fill: '#fff' });
  s.ellipse(cx, cy + 8, 30, 30, { w: 6, j: 0.4 });
  s.ellipse(cx, cy + 8, 14, 14, { w: 0, j: 0, fill: '#000' });
  s.ellipse(cx + 44, cy - 20, 6, 6, { w: 0, j: 0, fill: '#000' });
  s.text('PHOTO', cx, 206, 50);
  return s.texture();
}

// Brass viewpoint plaque: a little skyline outline + "外灘 THE BUND".
export function plaqueTexture(seed = 375) {
  const W = 512, H = 256, s = new Sketch(W, H, { seed, bg: '#d8d8d8' });
  s.rect(8, 8, W - 16, H - 16, { w: 6, j: 0.6 });
  const base = 150;
  s.line(40, base, W - 40, base, { w: 3, j: 0.5 });
  // pearl tower
  s.line(150, base, 150, 40, { w: 3, j: 0.3 });
  s.ellipse(150, 108, 16, 16, { w: 3, j: 0.3, fill: '#fff' });
  s.ellipse(150, 68, 10, 10, { w: 3, j: 0.3, fill: '#fff' });
  for (const [x, h, w] of [[70, 40, 26], [100, 60, 20], [210, 70, 22], [250, 96, 18], [300, 112, 20], [345, 84, 24], [400, 50, 30], [440, 34, 26]]) s.rect(x - w / 2, base - h, w, h, { w: 2.4, j: 0.4 });
  s.text('外灘  THE BUND', W / 2, 200, 52, { font: `"Patrick Hand", ${HANZI}` });
  return s.texture();
}

// Boat: a strip of cabin windows along the side.
export function boatWindowTexture(seed = 377) {
  const W = 1024, H = 128, s = new Sketch(W, H, { seed });
  for (let i = 0; i < 16; i++) s.rect(12 + i * 63, 22, 44, 70, { w: 3, j: 0.4, fill: '#5a5a5a' });
  return s.texture({ repeat: true });
}

// Postcard for the room wall: "Shanghai" + a little skyline + airmail border.
export function postcardTexture(seed = 381) {
  const W = 512, H = 340, s = new Sketch(W, H, { seed });
  const ctx = s.ctx;
  for (let i = -2; i < 40; i++) {
    for (const [y0, y1] of [[0, 16], [H - 16, H]]) {
      ctx.fillStyle = i % 2 ? '#000' : '#999';
      ctx.beginPath(); ctx.moveTo(i * 30, y0); ctx.lineTo(i * 30 + 15, y0); ctx.lineTo(i * 30 + 30 - 15 + (y1 - y0), y1); ctx.lineTo(i * 30 + (y1 - y0), y1); ctx.closePath(); ctx.fill();
    }
  }
  s.rect(6, 6, W - 12, H - 12, { w: 5, j: 0.6 });
  const base = 238;
  for (let i = 0; i < 5; i++) s.line(30 + i * 12, base + 18 + i * 10, W - 40 - i * 20, base + 18 + i * 10, { w: 1.6, j: 1, alpha: 0.6 });
  s.line(24, base, W - 24, base, { w: 3, j: 0.6 });
  s.line(150, base, 150, 52, { w: 3.4, j: 0.3 });
  s.ellipse(150, 168, 24, 24, { w: 3.4, j: 0.3, fill: '#fff' });
  s.ellipse(150, 110, 14, 14, { w: 3.4, j: 0.3, fill: '#fff' });
  for (const [x, h, w] of [[60, 50, 30], [100, 80, 26], [210, 110, 24], [256, 150, 22], [300, 120, 24], [350, 90, 30], [410, 60, 34], [460, 40, 30]]) s.rect(x - w / 2, base - h, w, h, { w: 2.6, j: 0.4, fill: '#fff' });
  s.text('Shanghai', W * 0.7, 66, 64);
  s.text('上海', W * 0.7, 120, 44, { font: HANZI });
  return s.texture();
}

// ---------------------------------------------------------------------------
// The sky all around: puffy outlined clouds and a few far birds, drawn on a
// cylinder around the camera. Canvas x spans azimuth -180..180 (0 = across the
// river, -z), rows are linear in tan(elevation). Everything else is geometry.
export const PANO = { W: 8192, H: 1280, ELB: -8, ELT: 48 };

export function panoramaTexture() {
  const { W, H, ELB, ELT } = PANO;
  const s = new Sketch(W, H, { seed: 391 });
  const tb = Math.tan((ELB * Math.PI) / 180), tt = Math.tan((ELT * Math.PI) / 180);
  const X = (az) => ((az + 180) / 360) * W;
  const Y = (el) => ((tt - Math.tan((el * Math.PI) / 180)) / (tt - tb)) * H;
  const pxPerDeg = W / 360;
  const r = makeRng(392);
  const rand = (a, b) => a + (b - a) * r();
  // puffy cloud: overlapping round bulges (stroke them all, then fill them
  // all, so only the outer silhouette keeps its line), a flat-ish base, a
  // couple of inner curls and a little hatching underneath.
  const cloud = (az, el, w, h) => {
    const cx = X(az), cy = Y(el), pw = w * pxPerDeg, ph = h * pxPerDeg;
    const n = 4 + Math.floor(r() * 3);
    const bumps = [];
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const rr = ph * (0.5 + 0.55 * Math.sin(u * Math.PI)) * (0.85 + r() * 0.3);
      bumps.push([cx - pw / 2 + u * pw, cy - rr * 0.35 + rand(-0.06, 0.06) * ph, rr]);
    }
    for (const [x, y, rr] of bumps) s.ellipse(x, y, rr * 1.05, rr * 0.9, { w: 7, j: 0.8 });
    for (const [x, y, rr] of bumps) s.ellipse(x, y, rr * 1.05, rr * 0.9, { w: 0, j: 0, fill: '#fff' });
    const ctx = s.ctx;
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - pw / 2 - ph * 1.2, cy + 1, pw + ph * 2.4, ph * 1.4);
    s.stroke([[cx - pw / 2 - ph * 0.45, cy], [cx, cy + 2], [cx + pw / 2 + ph * 0.45, cy - 1]], { w: 3.4, j: 1.2 });
    for (let k = 0; k < 2; k++) {
      const [x, y, rr] = bumps[1 + Math.floor(r() * (n - 2))];
      s.arc(x - rr * 0.1, y + rr * 0.15, rr * 0.45, rr * 0.35, Math.PI * 1.15, Math.PI * 1.7, { w: 2.2, j: 0.4, alpha: 0.7 });
    }
    s.hatch(cx - pw * 0.4, cy - ph * 0.22, pw * 0.8, ph * 0.2, { gap: 11, lw: 1.3, alpha: 0.25, angle: 1.0 });
  };
  for (const [az, el, w, h] of [
    [-48, 19, 17, 3.6], [-26, 24.5, 12, 2.8], [-4, 21, 10, 2.4], [30, 26, 15, 3.2], [46, 18, 11, 2.6], [78, 22, 16, 3.4],
    [120, 21, 20, 4.2], [160, 26, 14, 3.0], [-100, 22, 18, 3.6], [-140, 18, 13, 2.8], [-180, 24, 16, 3.4], [180, 24, 16, 3.4],
  ]) cloud(az, el, w, h);
  // long thin streaks
  for (let i = 0; i < 18; i++) {
    const y = Y(rand(8, 22)), x0 = X(rand(-170, 160)), len = rand(120, 420);
    s.line(x0, y, x0 + len, y + rand(-3, 3), { w: 1.6, j: 1, alpha: 0.4 });
  }
  // far birds (the near ones are 3D)
  for (let i = 0; i < 10; i++) {
    const bx = X(rand(-60, 60)), by = Y(rand(16, 28)), bw = rand(7, 13);
    s.stroke([[bx - bw, by - 4], [bx - bw * 0.3, by - 2], [bx, by + 3]], { w: 2, j: 0.3 });
    s.stroke([[bx, by + 3], [bx + bw * 0.3, by - 2], [bx + bw, by - 4]], { w: 2, j: 0.3 });
  }
  // a faint far haze line at the horizon for the up / down river views
  for (let i = 0; i < 40; i++) {
    const az = rand(-180, 180), y = Y(rand(0.2, 1.4));
    s.line(X(az), y, X(az) + rand(30, 160), y, { w: 1.4, j: 0.6, alpha: 0.3 });
  }
  const t = s.texture();
  t.anisotropy = 4;
  return t;
}
