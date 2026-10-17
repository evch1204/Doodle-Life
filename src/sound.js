// Tiny synthesized sound effects (no audio files). The AudioContext is
// created lazily on the first effect, which always follows a key press.
let ctx = null;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function env(g, t0, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function tone(type, f0, f1, dur, peak = 0.15, delay = 0) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(g, t0, 0.01, dur, peak);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, peak, freq, q = 1, delay = 0) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); env(g, t0, 0.02, dur, peak);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}
// Karplus-Strong plucked string.
function pluck(freq, delay, peak = 0.25) {
  const c = ac(); if (!c) return;
  const sr = c.sampleRate, n = Math.floor(sr * 1.6), N = Math.round(sr / freq);
  const buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const ring = new Float32Array(N).map(() => Math.random() * 2 - 1);
  for (let i = 0; i < n; i++) {
    const j = i % N, k = (i + 1) % N;
    d[i] = ring[j];
    ring[j] = 0.497 * (ring[j] + ring[k]);
  }
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); g.gain.value = peak;
  src.connect(g).connect(c.destination);
  src.start(c.currentTime + delay);
}

const FX = {
  click: () => tone('square', 1800, 1200, 0.03, 0.05),
  pickup: () => { tone('sine', 880, 880, 0.09, 0.12); tone('sine', 1320, 1320, 0.16, 0.12, 0.08); },
  book: () => noise(0.25, 0.12, 2500, 0.6),
  squeak: () => tone('sine', 900, 1700, 0.18, 0.12),
  strum: () => [196, 247, 294, 392, 494, 784].forEach((f, i) => pluck(f * (1 + (Math.random() - 0.5) * 0.01), i * 0.025)),
  kettle: () => {
    noise(1.6, 0.05, 1200, 0.5);
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + 0.5;
    const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.frequency.value = 1700; lfo.frequency.value = 7; lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    env(g, t0, 0.3, 1.0, 0.04);
    o.connect(g).connect(c.destination);
    o.start(t0); lfo.start(t0); o.stop(t0 + 1.5); lfo.stop(t0 + 1.5);
  },
  fridgeOpen: () => { noise(0.12, 0.1, 300, 0.8); tone('sine', 60, 58, 0.8, 0.04, 0.05); },
  fridgeClose: () => noise(0.08, 0.15, 180, 0.8),
  sit: () => noise(0.18, 0.06, 500, 0.7),
};
export function playSound(name) { try { FX[name]?.(); } catch { /* audio unavailable */ } }
