import * as THREE from 'three';
import { getLang, onLang } from './i18n.js';

// Brush hanzi (Jiufen's signs). The pen hand is Patrick Hand for Latin and LXGW WenKai
// (pen-written, shipped with the game, like the HUD) for Chinese.
export const HANZI = '"DFKai-SB","KaiTi","BiauKai","STKaiti","LXGW WenKai TC","Microsoft JhengHei","PingFang TC",serif';
export const HAND = `"Patrick Hand", "LXGW WenKai TC", ${HANZI}`;

// Deterministic RNG so every texture is drawn the same way each load.
export function makeRng(seed = 1) {
  let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// A canvas you draw on with a wobbly ink pen. White = paper, black = ink.
export class Sketch {
  constructor(w, h, { seed = 1, bg = '#fff', transparent = false } = {}) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.r = makeRng(seed);
    if (!transparent) { this.ctx.fillStyle = bg; this.ctx.fillRect(0, 0, w, h); }
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  rand(a = 0, b = 1) { return a + (b - a) * this.r(); }

  // Resample a polyline and push each point sideways with smooth noise.
  wobble(pts, j, closed) {
    const P = closed ? [...pts, pts[0]] : pts;
    const out = [];
    const ph1 = this.rand(0, 6.28), ph2 = this.rand(0, 6.28), f1 = this.rand(0.025, 0.05), f2 = this.rand(0.09, 0.16);
    let acc = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const n = Math.max(2, Math.ceil(L / 8));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n, s = acc + L * t;
        const off = j * (Math.sin(s * f1 + ph1) * 0.65 + Math.sin(s * f2 + ph2) * 0.35);
        out.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
      }
      acc += L;
    }
    return out;
  }

  stroke(pts, { w = 3, j = 1.2, color = '#000', alpha = 1, closed = false, fill = null } = {}) {
    const ctx = this.ctx;
    const out = j > 0 ? this.wobble(pts, j, closed) : (closed ? [...pts, pts[0]] : pts);
    ctx.beginPath();
    ctx.moveTo(out[0][0], out[0][1]);
    for (let i = 1; i < out.length; i++) ctx.lineTo(out[i][0], out[i][1]);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (w > 0) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  line(x1, y1, x2, y2, o) { this.stroke([[x1, y1], [x2, y2]], o); }

  rect(x, y, w, h, o = {}) {
    this.stroke([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, closed: true });
  }

  ellipsePts(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 0) {
    n = n || Math.max(18, Math.ceil((rx + ry) / 3));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  }

  ellipse(cx, cy, rx, ry, o = {}) {
    const pts = this.ellipsePts(cx, cy, rx, ry);
    pts.pop();
    this.stroke(pts, { ...o, closed: true });
  }

  arc(cx, cy, rx, ry, a0, a1, o = {}) { this.stroke(this.ellipsePts(cx, cy, rx, ry, a0, a1), o); }

  // Parallel hatch strokes inside a clip path (rect by default).
  hatch(x, y, w, h, { angle = Math.PI / 4, gap = 8, lw = 1.5, alpha = 0.85, j = 0.6, clip = null } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    if (clip) clip(ctx); else ctx.rect(x, y, w, h);
    ctx.clip();
    const cx = x + w / 2, cy = y + h / 2, R = Math.hypot(w, h) / 2 + 4;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    for (let t = -R; t <= R; t += gap) {
      const ox = cx - sa * t, oy = cy + ca * t;
      this.line(ox - ca * R, oy - sa * R, ox + ca * R, oy + sa * R, { w: lw, alpha, j });
    }
    ctx.restore();
  }

  text(str, x, y, size, { align = 'center', color = '#000', rot = 0, font = HAND } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  // Write str in the w x h box centred on (x, y) (x is the left edge for align 'left'), at
  // the largest size up to max that fits. It wraps onto up to `lines` rows, at spaces or
  // between any two hanzi ('\n' always breaks), so a translation never runs off its board.
  // rot turns the box about (x, y). Returns the size used.
  fitText(str, x, y, w, h, { max = h, lines = 1, lead = 1.15, font = HAND, weight = 400, color = '#000', align = 'center', rot = 0 } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${weight} 100px ${font}`;
    // try each row count; more rows only when they buy a clearly bigger size
    let rows = null, size = 0;
    for (let n = 1; n <= lines; n++) {
      const r = layoutLines(ctx, String(str), n);
      if (r.rows.length > Math.max(n, r.hard)) continue;
      const sz = Math.min(max, (w * 100) / r.widest, h / (1 + (r.rows.length - 1) * lead));
      if (!rows || sz > size * 1.08) { rows = r.rows; size = sz; }
    }
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    rows.forEach((r, i) => ctx.fillText(r, 0, (i - (rows.length - 1) / 2) * size * lead));
    ctx.restore();
    return size;
  }

  // Hanzi stacked down a column (a vertical sign), centred on (x, y) in a w x h box.
  columnText(str, x, y, w, h, { max = w, font = HANZI, color = '#000' } = {}) {
    const chars = [...str];
    const step = h / chars.length, size = Math.min(max, w, step * 0.92);
    chars.forEach((c, i) => this.text(c, x, y - h / 2 + (i + 0.5) * step, size, { font, color }));
    return size;
  }

  star(cx, cy, r, o = {}) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    this.stroke(pts, { ...o, closed: true });
  }

  smiley(cx, cy, r, o = {}) {
    const w = o.w ?? 3;
    this.ellipse(cx, cy, r, r, { w, j: 0.6 });
    this.ellipse(cx - r * 0.35, cy - r * 0.2, r * 0.07, r * 0.1, { w, j: 0, fill: '#000' });
    this.ellipse(cx + r * 0.35, cy - r * 0.2, r * 0.07, r * 0.1, { w, j: 0, fill: '#000' });
    this.arc(cx, cy + r * 0.05, r * 0.45, r * 0.4, 0.4, Math.PI - 0.4, { w, j: 0.4 });
  }

  texture({ repeat = false } = {}) {
    const t = new THREE.CanvasTexture(this.canvas);
    t.anisotropy = 8;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }
}

// ---- writing that follows the language setting -------------------------------------------
// Signs, menus and posters read in the player's language, like the HUD. Their text is
// { en, zh } (a plain string reads the same in both); say() picks the current one.
export const say = (s, lang = getLang()) => (s == null || typeof s !== 'object' ? s : s[lang] ?? s.en);

// A texture with writing on it: draw(lang) returns its Sketch. On a language switch it is
// drawn again and swapped in under the same texture, so meshes and materials stay put.
const lettered = new Set();
export function letteredTexture(draw, opts) {
  const tex = draw(getLang()).texture(opts);
  const entry = { tex, draw };
  lettered.add(entry);
  tex.addEventListener('dispose', () => lettered.delete(entry));
  return tex;
}
// every live texture with writing on it (scripts/lettering_check.mjs lays them out)
export const letteredTextures = () => [...lettered].map((e) => e.tex);
function redrawLettering(lang = getLang()) {
  for (const e of lettered) { e.tex.image = e.draw(lang).canvas; e.tex.needsUpdate = true; }
}
onLang(redrawLettering);
// WenKai arrives in slices as new characters are first drawn; once a slice lands,
// draw the writing again so no sign keeps the fallback face
let fontsPending = false;
document.fonts?.addEventListener('loadingdone', () => {
  if (fontsPending) return;
  fontsPending = true;
  requestAnimationFrame(() => { fontsPending = false; redrawLettering(); });
});

// Break text into rows for fitText: '\n' always breaks; each paragraph is wrapped (at
// spaces, or between hanzi) to the narrowest width that keeps the total within maxLines.
const CLOSING = /^[、，。！？：；）」』·•・]$/;
function tokens(par) {
  const out = [];
  for (const m of par.matchAll(/(\s*)([\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]|[^\s\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]+)/g)) {
    const tok = { t: m[2], sp: m[1] };
    // closing punctuation and bullets stay on the line before them
    if (out.length && CLOSING.test(tok.t)) out[out.length - 1].t += tok.sp + tok.t;
    else out.push(tok);
  }
  return out;
}
const joinRow = (toks) => toks.map((k, i) => (i ? k.sp : '') + k.t).join('');
function wrap(ctx, toks, limit) {
  const rows = [];
  let row = [];
  for (const k of toks) {
    if (row.length && ctx.measureText(joinRow([...row, k])).width > limit) { rows.push(row); row = [k]; } else row.push(k);
  }
  if (row.length) rows.push(row);
  return rows.map(joinRow);
}
function layoutLines(ctx, str, maxLines) {
  const pars = str.split('\n').map(tokens);
  const width = (r) => ctx.measureText(r).width;
  const widest = (rows) => Math.max(...rows.map(width), 1);
  const at = (limit) => pars.flatMap((p) => wrap(ctx, p, limit));
  let rows = pars.map(joinRow);
  if (maxLines > pars.length) {
    // the narrowest wrap that keeps the row count within maxLines, by bisection
    let lo = Math.max(...pars.flat().map((k) => width(k.t)), 1), hi = widest(rows);
    for (let i = 0; i < 18 && hi - lo > 1; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid).length <= maxLines) hi = mid; else lo = mid;
    }
    rows = at(hi);
  }
  return { rows, widest: widest(rows), hard: pars.length };
}
