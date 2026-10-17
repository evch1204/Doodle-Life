import * as THREE from 'three';
import { Sketch, makeRng } from './sketch.js';

// Line-art textures for Jiufen: white paper, black ink, same pen as the room.

export const HANZI = '"DFKai-SB","KaiTi","BiauKai","STKaiti","Microsoft JhengHei","PingFang TC",serif';

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

// Wooden sign board with brush characters. vertical: one char per line.
export function signTexture(text, { vertical = true, seed = 51, border = true, w = 128, h = 0, size = 0, invert = false } = {}) {
  const chars = [...text];
  const W = vertical ? w : Math.max(w, chars.length * 120 + 40);
  const H = h || (vertical ? chars.length * 116 + 40 : 160);
  const s = new Sketch(W, H, { seed, bg: invert ? '#000' : '#fff' });
  const ink = invert ? '#fff' : '#000';
  if (border) {
    s.rect(6, 6, W - 12, H - 12, { w: 5, j: 0.8, color: ink });
    s.rect(16, 16, W - 32, H - 32, { w: 1.6, j: 0.6, color: ink, alpha: 0.7 });
  }
  const fs = size || (vertical ? Math.min(W * 0.7, 96) : Math.min(H * 0.62, 100));
  chars.forEach((c, i) => {
    if (vertical) s.text(c, W / 2, 20 + (i + 0.5) * ((H - 40) / chars.length), fs, { font: HANZI, color: ink });
    else s.text(c, 20 + (i + 0.5) * ((W - 40) / chars.length), H / 2 + 4, fs, { font: HANZI, color: ink });
  });
  return s.texture();
}

// Paper lantern skin: vertical ribs wrap around, horizontal bands, optional big character.
export function lanternTexture(char = '', seed = 53) {
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
  if (char) {
    // character front and back (u = 0.25 and 0.75 face +z / -z on a lathe)
    for (const u of [0.25, 0.75]) s.text(char, u * W, H / 2 + 4, 150, { font: HANZI });
  }
  return s.texture({ repeat: true });
}

// Noren (split doorway curtain) with a character.
export function norenTexture(text, seed = 55) {
  const W = 512, H = 256, s = new Sketch(W, H, { seed });
  s.hatch(0, 0, W, H, { gap: 12, lw: 1.3, alpha: 0.3, angle: 0.2 });
  const n = 3;
  for (let i = 1; i < n; i++) s.line((i / n) * W, 40, (i / n) * W, H, { w: 4, j: 0.6 });
  [...text].forEach((c, i, arr) => s.text(c, ((i + 0.5) / arr.length) * W, H * 0.55, 120, { font: HANZI }));
  return s.texture();
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
  const W = 512, H = 256, s = new Sketch(W, H, { seed: 59 });
  s.rect(10, 10, W - 20, H - 20, { w: 5, j: 0.8 });
  s.text('鳳梨酥', W * 0.62, H * 0.5, 84, { font: HANZI });
  const cx = 110, cy = 140;
  s.ellipse(cx, cy, 44, 58, { w: 3 });
  for (let i = -2; i <= 2; i++) { s.line(cx - 40, cy + i * 22 - 20, cx + 40, cy + i * 22 + 20, { w: 1.4, alpha: 0.7 }); s.line(cx + 40, cy + i * 22 - 20, cx - 40, cy + i * 22 + 20, { w: 1.4, alpha: 0.7 }); }
  for (const a of [-0.6, -0.2, 0.2, 0.6]) s.stroke([[cx, cy - 56], [cx + Math.sin(a) * 40, cy - 56 - Math.cos(a) * 46]], { w: 3 });
  return s.texture();
}

// Steamer basket: woven bamboo bands.
export function bambooTexture() {
  const W = 512, H = 128, s = new Sketch(W, H, { seed: 61 });
  s.line(0, 12, W, 12, { w: 4 });
  s.line(0, H - 12, W, H - 12, { w: 4 });
  for (let i = 0; i < 40; i++) { const x = (i / 40) * W; s.line(x, 16, x + 6, H - 16, { w: 1.3, alpha: 0.6 }); }
  return s.texture({ repeat: true });
}

// Small paper notices / menus taped to walls.
export function noticeTexture(lines, seed = 63) {
  const W = 256, H = 340, s = new Sketch(W, H, { seed });
  s.rect(8, 8, W - 16, H - 16, { w: 3, j: 1 });
  lines.forEach((c, i) => s.text(c, W / 2, 60 + i * 70, 56, { font: HANZI }));
  for (let i = 0; i < 4; i++) s.line(40, 60 + lines.length * 70 + i * 22, W - 40 - s.rand(0, 60), 60 + lines.length * 70 + i * 22, { w: 2, alpha: 0.6 });
  return s.texture();
}

// Shrine plaque / incense board.
export function plaqueTexture(text) {
  return signTexture(text, { vertical: false, seed: 65, w: 420, h: 150, size: 92 });
}

// ---------------------------------------------------------------------------
// The view: a drawn panorama on a cylinder around the camera. Taipei 101 and
// the city sit beyond doodle hills, faint mountains behind, the sea and a low
// sun on the right. Canvas x spans azimuth -110..110 deg (0 = straight down
// the street, -z); rows are linear in tan(elevation).
export const PANO = { W: 6144, H: 1536, AZ: 110, ELB: -26, ELT: 40, T101: -7 };

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

  // city: rows of blocky buildings with window grids, lighter further back
  const building = (x, base, w, h, alpha, windows = true) => {
    s.stroke([[x, base], [x, base - h], [x + w, base - h], [x + w, base]], { w: 2.2, j: 0.5, alpha, fill: '#fff' });
    if (windows && w > 14 && h > 20) {
      const cols = Math.max(1, Math.floor(w / 9)), rows = Math.max(1, Math.floor(h / 11));
      for (let rI = 0; rI < rows; rI++) for (let c = 0; c < cols; c++) {
        if (r() < 0.45) continue;
        const wx = x + 4 + (c * (w - 8)) / cols, wy = base - h + 6 + (rI * (h - 10)) / rows;
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#000';
        ctx.fillRect(wx, wy, 3, 4);
        ctx.globalAlpha = 1;
      }
    }
  };
  const cityBase = (az) => Y(-3.6 + 0.6 * Math.sin(az * 0.05));
  for (const [layer, alpha, hMin, hMax, wMin, wMax] of [[0, 0.45, 12, 40, 14, 30], [1, 0.75, 16, 60, 16, 36]]) {
    let az = -AZ;
    while (az < 70) {
      const w = rand(wMin, wMax), h = rand(hMin, hMax) * (1 - Math.abs(az + 10) / 160);
      const base = cityBase(az) - (layer === 0 ? 14 : 0);
      if (Math.abs(az - PANO.T101) > 3.2 || layer === 0) building(X(az), base, w, h, alpha, layer === 1);
      az += (w + rand(-4, 3)) / pxPerDeg;
    }
  }
  // a few taller towers around the center
  for (const [az, h, w] of [[-24, 120, 30], [-17, 95, 26], [8, 140, 34], [15, 92, 24], [-36, 80, 26], [26, 78, 28]]) building(X(az), cityBase(az), w, h, 0.85);

  // Taipei 101: podium, eight flared sections, crown, spire
  {
    const cx = X(PANO.T101), base = cityBase(PANO.T101) + 4;
    const top = Y(17.5);
    const total = base - top;
    const pod = total * 0.09;
    const spire = total * 0.12;
    const crown = total * 0.06;
    const secH = (total - pod - spire - crown - total * 0.13) / 8;
    const lw = 3.2;
    // podium
    const pw = total * 0.13;
    s.stroke([[cx - pw, base], [cx - pw, base - pod], [cx + pw, base - pod], [cx + pw, base]], { w: lw, j: 0.4, fill: '#fff' });
    // shaft between podium and first section
    let y = base - pod;
    const shaftW = total * 0.055, shaftH = total * 0.13;
    s.stroke([[cx - shaftW, y], [cx - shaftW * 0.9, y - shaftH], [cx + shaftW * 0.9, y - shaftH], [cx + shaftW, y]], { w: lw, j: 0.4, fill: '#fff' });
    // ruyi coin ornament on the shaft
    s.ellipse(cx, y - shaftH * 0.55, shaftW * 0.55, shaftW * 0.55, { w: 2.4, j: 0.3 });
    s.ellipse(cx, y - shaftH * 0.55, shaftW * 0.2, shaftW * 0.2, { w: 2, j: 0.3 });
    y -= shaftH;
    for (let i = 0; i < 8; i++) {
      const b = total * 0.048, t = total * 0.068;
      const pts = [[cx - b, y], [cx - t, y - secH], [cx + t, y - secH], [cx + b, y]];
      s.stroke(pts, { w: lw, j: 0.3, fill: '#fff' });
      // window bands + center line on each section
      for (let k = 1; k < 4; k++) {
        const yy = y - (secH * k) / 4, ww = b + (t - b) * (k / 4);
        s.line(cx - ww + 3, yy, cx + ww - 3, yy, { w: 1.3, j: 0.2, alpha: 0.7 });
      }
      s.line(cx - b * 0.35, y - 2, cx - t * 0.35, y - secH + 2, { w: 1.3, j: 0.2, alpha: 0.7 });
      s.line(cx + b * 0.35, y - 2, cx + t * 0.35, y - secH + 2, { w: 1.3, j: 0.2, alpha: 0.7 });
      // little dragon-curl ornaments at the corners
      s.arc(cx - t - 3, y - secH + 6, 5, 5, 0, Math.PI * 1.4, { w: 1.8, j: 0 });
      s.arc(cx + t + 3, y - secH + 6, 5, 5, Math.PI * 1.6, Math.PI * 3, { w: 1.8, j: 0 });
      y -= secH;
    }
    // crown + spire
    const cw = total * 0.045;
    s.stroke([[cx - cw, y], [cx - cw * 0.7, y - crown], [cx + cw * 0.7, y - crown], [cx + cw, y]], { w: lw, j: 0.3, fill: '#fff' });
    y -= crown;
    s.stroke([[cx - 5, y], [cx - 3, y - spire * 0.55], [cx + 3, y - spire * 0.55], [cx + 5, y]], { w: 2.4, j: 0.2, fill: '#fff' });
    s.line(cx, y - spire * 0.55, cx, y - spire, { w: 2.2, j: 0 });
  }

  // near hills: a valley ridge hiding the city's feet, then a dense town of
  // rooftops stepping down toward the viewer (bigger = closer), with trees.
  const near = ridge(-4.2, 1.6, 91, 1, 30);
  near.pts = near.pts.map(([x, y]) => {
    const az = (x / W) * 2 * AZ - AZ;
    const dip = Math.exp(-((az - PANO.T101) ** 2) / (2 * 22 ** 2)) * 2.0; // valley toward 101
    return [x, Math.max(y, Y(-4.2 - dip + (Math.abs(az) > 60 ? (Math.abs(az) - 60) * 0.06 : 0)))];
  });
  s.stroke([...near.pts, [W + 40, H + 10], [-40, H + 10]], { w: 0, j: 0, fill: '#fff' });
  s.stroke(near.pts, { w: 3.2, j: 1.2 });
  const ridgeY = (x) => { const i = Math.max(0, Math.min(near.pts.length - 1, Math.round((x + 40) / 30))); return near.pts[i][1]; };
  const roof = (x, base, w, h, alpha) => {
    const body = h * 0.55;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, base - body, w, body + 2);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1.2, w / 22);
    ctx.strokeRect(x, base - body, w, body);
    if (w > 18) { ctx.fillStyle = '#000'; ctx.fillRect(x + w * 0.3, base - body * 0.7, w * 0.14, body * 0.35); }
    // roof: light gray with tile lines
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, base - body);
    ctx.lineTo(x + w * 0.12, base - h);
    ctx.lineTo(x + w * 0.88, base - h);
    ctx.lineTo(x + w * 1.1, base - body);
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#cfcfcf';
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, w / 40);
    for (let k = 1; k < 5; k++) {
      const u = k / 5;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.1 + u * w * 1.2, base - body);
      ctx.lineTo(x + w * 0.12 + u * w * 0.76, base - h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const tree = (x, base, r) => {
    ctx.beginPath();
    ctx.ellipse(x, base - r * 0.8, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = Math.max(1.2, r / 10); ctx.strokeStyle = '#000'; ctx.globalAlpha = 0.8; ctx.stroke();
    ctx.globalAlpha = 0.45;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + (k - 1) * r * 0.4, base - r * 0.6, r * 0.35, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
  // rows from the far valley (small) down to the near slope (big)
  for (let el = -4.8; el > ELB - 1; el -= 0.55 + (-el - 4) * 0.06) {
    const size = 9 + (-el - 4) * 2.6;
    let x = -20 + r() * size;
    while (x < W + 20) {
      const base = Y(el) + r() * size * 0.25;
      if (base > ridgeY(x) + size * 0.2) {
        if (r() < 0.14) tree(x + size * 0.4, base, size * 0.55);
        else roof(x, base, size * (0.9 + r() * 0.6), size * (0.75 + r() * 0.3), Math.min(1, 0.45 + (-el - 4) * 0.05));
      }
      x += size * (1.0 + r() * 0.5);
    }
  }
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
