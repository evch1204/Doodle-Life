import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ink } from './ink.js';
import { makeRng, Sketch } from './sketch.js';

// Chibi kid from the character sheet, built as one drawn figure:
//  - hair is a single sculpted mesh (a sphere pushed out into soft tufts and
//    pulled inside the head where the face shows), with spring follow-through
//  - parts of the same material share one outline id, so the outline pass
//    draws the silhouette and real creases, not a line around every primitive;
//    seams that should read as drawn lines (sleeves, pockets, hood) get their own id
//  - joint hierarchy: hips > spine > neck > head, shoulders > elbows,
//    hips > knees > ankles, with two-bone leg IK so feet land on steps.
// Player: ~1.17 m, head + hair ~41%, hoodie ~30%, legs ~29% (about three heads).

const ANKLE = 0.05; // ankle height above the sole
const HIP_J = -0.02; // hip joints relative to the hips pivot

// Body dimensions per style. The auntie keeps her original build.
const DIMS = {
  player: { L1: 0.168, L2: 0.168, HIP_Y: 0.39, hipX: 0.074, shX: 0.163, shY: 0.215, LA1: 0.112, LA2: 0.106, neckY: 0.29, headY: 0.2, headZ: 0.008 },
  auntie: { L1: 0.118, L2: 0.118, HIP_Y: 0.29, hipX: 0.068, shX: 0.122, shY: 0.24, LA1: 0.105, LA2: 0.095, neckY: 0.31, headY: 0.195, headZ: 0.012 },
};

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Black hair with a few light strand strokes (the reference has these).
// u runs around the head with the seam at the face (hidden inside the head).
function hairTexture(seed) {
  const s = new Sketch(512, 256, { seed, bg: '#000' });
  for (let i = 0; i < 16; i++) {
    const x = s.rand(70, 442), y = s.rand(20, 110), len = s.rand(22, 50), bend = s.rand(-10, 10);
    s.stroke([[x, y], [x + bend, y + len * 0.5], [x + bend * 0.2, y + len]], { w: 2.2, j: 0.4, color: '#fff', alpha: 0.6 });
  }
  return s.texture();
}

// Black cloth with sparse light flecks, like the speckled pants in the sheet.
function flecksTexture(seed) {
  const s = new Sketch(256, 256, { seed, bg: '#000' });
  for (let i = 0; i < 70; i++) {
    const x = s.rand(4, 252), y = s.rand(4, 252), a = s.rand(0, 6.28), l = s.rand(1.5, 4);
    s.stroke([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], { w: 1.4, j: 0, color: '#fff', alpha: s.rand(0.25, 0.5) });
  }
  return s.texture();
}

// A capsule spanning two points in a parent's local space.
function limb(a, b, r, mat, parent) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  parent.add(m);
  return m;
}

// Radius of a lathe profile ([r, y] pairs, y increasing) at height y.
function profR(prof, y) {
  for (let i = 1; i < prof.length; i++) {
    const [r0, y0] = prof[i - 1], [r1, y1] = prof[i];
    if (y <= y1 && y1 > y0) return r0 + (r1 - r0) * THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1);
  }
  return prof[prof.length - 1][0];
}

// A patch lying on a lathe surface (in the lathe's own space), front-centred:
// rows from y0 to y1, half-angle per row from half0 to half1. Used for the
// kangaroo pocket so it hugs the hoodie and gets its own outline.
function shellPatch(prof, y0, y1, half0, half1, off, nu = 18, nv = 6) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, y = y0 + (y1 - y0) * v, h = half0 + (half1 - half0) * v, r = profR(prof, y) + off;
    for (let i = 0; i <= nu; i++) {
      const phi = (i / nu * 2 - 1) * h;
      pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Hair as one continuous surface. Every vertex of a dense sphere is placed by
 * direction: on the shell where hair grows, tucked inside the head where the
 * face / neck show, and pushed out along soft tufts. Returns the geometry and
 * a per-vertex "looseness" weight used for follow-through motion.
 */
function sculptHair({ R, scale, hairline, tufts }) {
  let g = new THREE.SphereGeometry(1, 112, 84);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const n = pos.count;
  const uv = new Float32Array(n * 2);
  const weight = new Float32Array(n);
  const d = new THREE.Vector3(), p = new THREE.Vector3();
  for (const t of tufts) {
    t.d = new THREE.Vector3(...t.dir).normalize();
    t.c = Math.cos(t.w);
    t.push = t.d.clone().addScaledVector(new THREE.Vector3(0, -1, 0), t.droop ?? 0).add(new THREE.Vector3(...(t.lean ?? [0, 0, 0]))).normalize();
  }
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const az = Math.atan2(d.x, d.z); // 0 = straight ahead (the face)
    const el = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    const bare = smoothstep(hairline(az) + 0.03, hairline(az) - 0.1, el); // 1 = no hair here
    const r = R * (1 + 0.05 * d.y) * (1 - 0.3 * bare);
    p.set(d.x * r * scale[0], d.y * r * scale[1], d.z * r * scale[2]);
    let w = 0;
    for (const t of tufts) {
      const k = (d.dot(t.d) - t.c) / (1 - t.c);
      if (k <= 0) continue;
      const prof = Math.pow(k, t.sharp ?? 1.8);
      p.addScaledVector(t.push, t.len * prof * (1 - bare * 0.7));
      w += prof * (t.loose ?? 1);
    }
    pos.setXYZ(i, p.x, p.y, p.z);
    weight[i] = Math.min(1, w + Math.max(0, d.y) * 0.25) * (1 - bare);
    uv[i * 2] = Math.atan2(-d.x, -d.z) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = 1 - (d.y * 0.5 + 0.5);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return { geo: g, weight, base: Float32Array.from(pos.array) };
}

// The player's mop from the sheet: a big round mass, layered with small
// pointed tips around the rim, a thick fringe stopping just above the eyes,
// the ears showing below, and a cowlick on the crown.
function mopHair(rng) {
  const tufts = [];
  const dir = (az, el) => [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  // rim around the sides and back: short pointed tips hanging down
  const RIM = 26;
  for (let i = 0; i < RIM; i++) {
    const az = (i / RIM) * Math.PI * 2 + (rng() - 0.5) * 0.1;
    const front = Math.max(0, Math.cos(az));
    if (front > 0.72) continue;
    const back = Math.max(0, -Math.cos(az));
    const el = 0.04 + front * 0.18 - back * 0.4 + (rng() - 0.5) * 0.1;
    tufts.push({ dir: dir(az, el), w: 0.2 + rng() * 0.05, len: 0.055 + rng() * 0.03, droop: 2.4 + rng() * 0.6, sharp: 3.2, loose: 1 });
  }
  // a higher ring of soft bulges: the puffy, layered outline
  for (let i = 0; i < 12; i++) {
    const az = (i / 12) * Math.PI * 2 + 0.25 + (rng() - 0.5) * 0.2;
    if (Math.cos(az) > 0.8) continue;
    tufts.push({ dir: dir(az, 0.35 + (rng() - 0.5) * 0.14), w: 0.5, len: 0.022 + rng() * 0.01, droop: 1.2, sharp: 1.4, loose: 0.7 });
  }
  // cowlick: a few tufts on the crown flicking up and back
  for (const [az, el, len, lean] of [[2.75, 1.15, 0.045, [0, 0.2, -0.5]], [2.3, 1.05, 0.03, [0.25, 0.15, -0.35]]]) {
    tufts.push({ dir: dir(az, el), w: 0.2, len, droop: 0, sharp: 2.8, lean, loose: 1.4 });
  }
  // fringe over the forehead, heavy, drooping to just above the eyes
  for (const az of [-0.86, -0.56, -0.27, 0.02, 0.3, 0.6, 0.88]) {
    tufts.push({ dir: dir(az + (rng() - 0.5) * 0.06, 0.62), w: 0.27, len: 0.108 + rng() * 0.012 - Math.abs(az) * 0.012, droop: 2.1, lean: [0, 0, 0.5], sharp: 2.0, loose: 0.8 });
  }
  return sculptHair({
    R: 0.236,
    scale: [1.14, 1.06, 1.12],
    // hairline elevation by azimuth: forehead, above the ears, low nape
    hairline: (az) => {
      const a = Math.abs(az);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.42, -0.2, smoothstep(0.55, 1.35, a)), -0.8, smoothstep(1.5, 2.4, a));
    },
    tufts,
  });
}

// A neat bun for the tea house auntie.
function bunHair() {
  const dir = (az, el) => [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  return sculptHair({
    R: 0.226,
    scale: [1.04, 0.98, 1.03],
    hairline: (az) => { const a = Math.abs(az); return THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.62, 0.15, smoothstep(0.5, 1.5, a)), -0.45, smoothstep(1.9, 2.8, a)); },
    tufts: [
      { dir: dir(-0.3, 0.75), w: 0.35, len: 0.02, droop: 0.8, sharp: 1.5, loose: 0.3 },
      { dir: dir(0.35, 0.72), w: 0.32, len: 0.018, droop: 0.8, sharp: 1.5, loose: 0.3 },
    ],
  });
}

/**
 * opts.style: 'player' (default) or 'auntie' (NPC: bun, apron, no
 * backpack). NPC options: bun (default true), topTone (shirt shade).
 */
export function createCharacter(opts = {}) {
  const style = opts.style ?? 'player';
  const isPlayer = style === 'player';
  const { L1, L2, HIP_Y, hipX, shX, shY, LA1, LA2, neckY, headY, headZ } = DIMS[isPlayer ? 'player' : 'auntie'];
  const rng = makeRng(isPlayer ? 77 : 91);
  const M = {
    skin: ink({ tone: 1, facing: 0.3, hatch: isPlayer ? 0 : 0.5, local: true, hatchFreq: 34 }),
    top: ink({ tone: isPlayer ? 1 : (opts.topTone ?? 0.7), facing: 0.6, hatch: isPlayer ? 0.4 : 1, local: true, hatchFreq: isPlayer ? 40 : 34 }),
    apron: ink({ tone: 1, facing: 0.5, local: true, hatchFreq: 34 }),
    pack: ink({ tone: 0.97, facing: 0.6, hatch: 0.4, local: true, hatchFreq: 40 }),
    hair: ink({ tone: 1, hatch: 0, facing: 0, map: hairTexture(isPlayer ? 404 : 405) }),
    pants: isPlayer ? ink({ tone: 1, hatch: 0, facing: 0, map: flecksTexture(406), repeat: [2, 2] }) : ink({ tone: 0, hatch: 0 }),
    dark: ink({ tone: 0.08, hatch: 0 }),
    sole: ink({ tone: 0.92, hatch: 0, facing: 0.2 }),
    frame: ink({ tone: 0, hatch: 0 }),
  };
  // Parts of one material read as one shape: same outline id. Extra keys are
  // seams that should still draw a line (sleeve over body, pockets, hood).
  const KEYS = ['skin', 'top', 'apron', 'pack', 'hair', 'pants', 'dark', 'sole', 'frame', 'sleeve', 'hood', 'pocket', 'packPocket', 'packTag', 'packSide', 'toe'];
  const ids = {};
  KEYS.forEach((k, i) => { ids[k] = (isPlayer ? 0.11 : 0.53) + i * 0.022; });
  if (!isPlayer) ids.sleeve = ids.top;
  const keyOf = new Map(Object.entries(M).map(([k, m]) => [m, k]));
  const mesh = (geo, mat, parent, key) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.outlineGroup = ids[key ?? keyOf.get(mat)];
    parent.add(m);
    return m;
  };
  const tag = (m, key) => { m.castShadow = m.receiveShadow = true; m.userData.outlineGroup = ids[key]; return m; };
  const group = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  const root = new THREE.Group();
  const hips = group(root, 0, HIP_Y, 0);

  // ---- pelvis + legs ------------------------------------------------------------
  const legs = [];
  if (isPlayer) {
    // loose, wide black trousers falling straight over the shoes
    const pelvis = mesh(new THREE.SphereGeometry(0.15, 24, 14), M.pants, hips);
    pelvis.scale.set(1.0, 0.6, 0.8);
    pelvis.position.y = -0.01;
    const cuffY = -(L2 - 0.008);
    const shinProf = [[0, 0.055], [0.034, 0.05], [0.058, 0.032], [0.071, 0.0], [0.074, -0.06], [0.078, -0.12], [0.081, cuffY + 0.012], [0.079, cuffY], [0, cuffY]];
    const shinGeo = new THREE.LatheGeometry(shinProf.map(([r, y]) => new THREE.Vector2(r, y)).reverse(), 22);
    for (const s of [-1, 1]) {
      const thigh = group(hips, s * hipX, HIP_J, 0);
      mesh(new THREE.CapsuleGeometry(0.074, L1 * 0.72, 6, 18), M.pants, thigh).position.y = -L1 * 0.5;
      const knee = group(thigh, 0, -L1, 0);
      mesh(shinGeo, M.pants, knee);
      const ankle = group(knee, 0, -L2, 0);
      // sneaker: black upper, white sole and rubber toe cap
      const upper = mesh(new RoundedBoxGeometry(0.12, 0.072, 0.21, 3, 0.034), M.dark, ankle);
      upper.position.set(0, -0.014, 0.04);
      const sole = mesh(new RoundedBoxGeometry(0.13, 0.03, 0.22, 2, 0.012), M.sole, ankle);
      sole.position.set(0, -0.04, 0.04);
      const toe = mesh(new THREE.SphereGeometry(0.062, 18, 12), M.sole, ankle, 'toe');
      toe.scale.set(0.98, 0.58, 0.8);
      toe.position.set(0, -0.026, 0.1);
      legs.push({ thigh, knee, ankle, s, prevY: 0 });
    }
  } else {
    const pelvis = mesh(new THREE.SphereGeometry(0.135, 24, 14), M.pants, hips);
    pelvis.scale.set(1.05, 0.55, 0.82);
    pelvis.position.y = -0.005;
    for (const s of [-1, 1]) {
      const thigh = group(hips, s * hipX, HIP_J, 0);
      mesh(new THREE.CapsuleGeometry(0.064, L1 * 0.7, 6, 16), M.pants, thigh).position.y = -L1 * 0.5;
      const knee = group(thigh, 0, -L1, 0);
      mesh(new THREE.CapsuleGeometry(0.058, L2 * 0.75, 6, 16), M.pants, knee).position.y = -L2 * 0.5;
      const ankle = group(knee, 0, -L2, 0);
      const shoe = mesh(new RoundedBoxGeometry(0.115, 0.07, 0.17, 3, 0.033), M.dark, ankle);
      shoe.position.set(0, -0.018, 0.032);
      const sole = mesh(new RoundedBoxGeometry(0.118, 0.02, 0.172, 2, 0.009), M.sole, ankle);
      sole.position.set(0, -0.046, 0.032);
      legs.push({ thigh, knee, ankle, s, prevY: 0 });
    }
  }

  // ---- spine: one continuous top -------------------------------------------------------
  const spine = group(hips, 0, 0.0, 0);
  const pack = group(spine, 0, 0.165, -0.118);
  const straps = group(spine);
  let chest;
  if (isPlayer) {
    // oversized hoodie: boxy, dropped shoulders, ribbed hem
    const prof = [[0, -0.062], [0.168, -0.062], [0.184, -0.044], [0.19, 0.0], [0.188, 0.08], [0.182, 0.15], [0.172, 0.2], [0.155, 0.238], [0.126, 0.265], [0.092, 0.281], [0.06, 0.288], [0, 0.29]];
    const ZS = 0.8;
    chest = mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 36), M.top, spine);
    chest.scale.z = ZS;
    const hem = mesh(new THREE.TorusGeometry(0.17, 0.021, 8, 36), M.top, spine);
    hem.rotation.x = Math.PI / 2;
    hem.scale.y = ZS;
    hem.position.y = -0.058;
    // kangaroo pocket: wide at the bottom, slanted hand openings
    mesh(shellPatch(prof, -0.03, 0.1, 0.66, 0.4, 0.006), M.top, chest, 'pocket');
    // z of the hoodie surface at (x, y), front (+1) or back (-1)
    const surf = (x, y, side, out = 0) => side * ZS * Math.sqrt(Math.max(0, profR(prof, y) ** 2 - x * x)) + side * out;

    // hood: a fat roll around the neck that crosses into a V at the front,
    // and the folded hood lying on the upper back
    const roll = mesh(new THREE.TorusGeometry(0.092, 0.043, 12, 30, Math.PI * 1.5), M.top, spine, 'hood');
    roll.rotation.set(Math.PI / 2, 0, Math.PI * 0.75);
    roll.position.set(0, 0.283, -0.012);
    for (const s of [-1, 1]) tag(limb(v3(s * 0.064, 0.283, 0.05), v3(s * 0.006, 0.222, surf(0, 0.222, 1, 0.012)), 0.026, M.top, spine), 'hood');
    const hood = mesh(new THREE.SphereGeometry(0.11, 22, 16), M.top, spine, 'hood');
    hood.position.set(0, 0.272, -0.112);
    hood.scale.set(1.38, 0.88, 0.72);
    // drawstrings with little tips
    for (const s of [-1, 1]) {
      const a = v3(s * 0.026, 0.236, surf(0.026, 0.236, 1, 0.01)), b = v3(s * 0.032, 0.15, surf(0.032, 0.15, 1, 0.008));
      tag(limb(a, b, 0.0055, M.dark, spine), 'dark');
      const tip = mesh(new THREE.CapsuleGeometry(0.008, 0.014, 3, 8), M.sole, spine, 'toe');
      tip.position.copy(b).add(v3(0, -0.012, 0.001));
    }

    // backpack: cream, rounded; zip pocket, tag, side pockets, top handle
    pack.position.set(0, 0.128, -0.148);
    const body = mesh(new RoundedBoxGeometry(0.27, 0.27, 0.12, 5, 0.052), M.pack, pack);
    body.position.z = -0.062;
    const pocket = mesh(new RoundedBoxGeometry(0.214, 0.115, 0.05, 4, 0.022), M.pack, pack, 'packPocket');
    pocket.position.set(0, -0.06, -0.128);
    const zip = mesh(new THREE.BoxGeometry(0.17, 0.005, 0.006), M.dark, pack);
    zip.position.set(0, -0.016, -0.153);
    const tagM = mesh(new RoundedBoxGeometry(0.052, 0.024, 0.012, 2, 0.005), M.pack, pack, 'packTag');
    tagM.position.set(0, 0.05, -0.124);
    for (const s of [-1, 1]) {
      const sp = mesh(new RoundedBoxGeometry(0.036, 0.11, 0.08, 3, 0.014), M.pack, pack, 'packSide');
      sp.position.set(s * 0.14, -0.06, -0.062);
    }
    tag(limb(v3(0.142, -0.07, -0.062), v3(0.142, 0.03, -0.062), 0.017, M.dark, pack), 'dark'); // bottle
    const handle = mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 14, Math.PI), M.dark, pack);
    handle.position.set(0, 0.132, -0.06);
    // straps: from the top of the pack, over the shoulders, down the chest,
    // under the arms and back into the bottom corners
    for (const s of [-1, 1]) {
      const pts = [
        v3(s * 0.08, 0.255, -0.2), v3(s * 0.112, 0.276, -0.11), v3(s * 0.12, 0.284, -0.02), v3(s * 0.123, 0.272, 0.06),
        v3(s * 0.126, 0.235, surf(0.126, 0.235, 1, 0.014)), v3(s * 0.138, 0.175, surf(0.138, 0.175, 1, 0.015)),
        v3(s * 0.172, 0.14, 0.05), v3(s * 0.192, 0.11, -0.05), v3(s * 0.165, 0.05, -0.14), v3(s * 0.1, 0.02, -0.19),
      ];
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.015, 7, false), M.dark, straps);
    }
  } else {
    const prof = [[0, -0.045], [0.148, -0.045], [0.162, -0.02], [0.166, 0.03], [0.162, 0.12], [0.154, 0.19], [0.14, 0.245], [0.115, 0.285], [0.082, 0.31], [0.055, 0.318], [0, 0.32]];
    chest = mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32), M.top, spine);
    chest.scale.z = 0.8;
    const hem = mesh(new THREE.TorusGeometry(0.151, 0.02, 8, 32), M.top, spine);
    hem.rotation.x = Math.PI / 2;
    hem.scale.y = 0.8;
    hem.position.y = -0.035;
    // apron over the front
    const ap = mesh(new RoundedBoxGeometry(0.22, 0.26, 0.02, 2, 0.008), M.apron, spine);
    ap.position.set(0, 0.06, 0.13);
    ap.rotation.x = -0.05;
    const tie = mesh(new THREE.TorusGeometry(0.152, 0.008, 6, 32), M.dark, spine);
    tie.rotation.x = Math.PI / 2; tie.scale.y = 0.8; tie.position.y = 0.12;
  }

  // ---- arms (shoulder > elbow > hand) ------------------------------------------------
  const arms = [-1, 1].map((s) => {
    const sh = group(spine, s * shX, shY, 0);
    const elbow = group(sh, 0, -LA1, 0);
    if (isPlayer) {
      // baggy sleeves, ribbed cuffs, slightly oversized mitten hands
      mesh(new THREE.CapsuleGeometry(0.062, LA1 * 0.8, 6, 16), M.top, sh, 'sleeve').position.y = -LA1 * 0.5;
      mesh(new THREE.CapsuleGeometry(0.058, LA2 * 0.7, 6, 16), M.top, elbow, 'sleeve').position.y = -LA2 * 0.45;
      const cuff = mesh(new THREE.TorusGeometry(0.047, 0.014, 6, 18), M.top, elbow, 'sleeve');
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -LA2 + 0.008;
      const hand = mesh(new THREE.SphereGeometry(0.047, 16, 12), M.skin, elbow);
      hand.position.y = -LA2 - 0.032;
      hand.scale.set(0.92, 1.05, 0.95);
    } else {
      mesh(new THREE.CapsuleGeometry(0.049, LA1 * 0.85, 6, 14), M.top, sh).position.y = -LA1 * 0.5;
      mesh(new THREE.CapsuleGeometry(0.046, LA2 * 0.7, 6, 14), M.top, elbow).position.y = -LA2 * 0.45;
      const cuff = mesh(new THREE.TorusGeometry(0.041, 0.012, 6, 16), M.top, elbow);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -LA2 + 0.005;
      const hand = mesh(new THREE.SphereGeometry(0.041, 16, 12), M.skin, elbow);
      hand.position.y = -LA2 - 0.03;
    }
    return { sh, elbow, s };
  });

  // ---- head ---------------------------------------------------------------------------
  const neck = group(spine, 0, neckY, 0);
  const head = group(neck, 0, headY, headZ);
  let eyes;
  if (isPlayer) {
    const FR = 0.2, FS = [1.05, 0.95, 0.96];
    const face = mesh(new THREE.SphereGeometry(FR, 40, 30), M.skin, head);
    face.scale.set(...FS);
    // a point on the face surface and its outward normal
    const onFace = (x, y, lift = 0) => {
      const z = FS[2] * FR * Math.sqrt(Math.max(0, 1 - (x / (FS[0] * FR)) ** 2 - (y / (FS[1] * FR)) ** 2));
      const n = v3(x / FS[0] ** 2, y / FS[1] ** 2, z / FS[2] ** 2).normalize();
      return { p: v3(x, y, z).addScaledVector(n, lift), n };
    };
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.04, 14, 10), M.skin, head);
      ear.position.set(s * 0.205, -0.055, -0.005);
      ear.scale.set(0.55, 1, 0.8);
    }
    // tall oval eyes set wide and low, tiny smile
    const Z = v3(0, 0, 1);
    eyes = [-1, 1].map((s) => {
      const { p, n } = onFace(s * 0.078, -0.058, -0.004);
      const eye = mesh(new THREE.SphereGeometry(0.023, 14, 10), M.frame, head);
      eye.position.copy(p);
      eye.quaternion.setFromUnitVectors(Z, n);
      eye.scale.set(1, 1.5, 0.5);
      return eye;
    });
    const { p: mp, n: mn } = onFace(0, -0.122, -0.001);
    const mouth = mesh(new THREE.TorusGeometry(0.014, 0.0045, 6, 14, Math.PI * 0.7), M.frame, head);
    mouth.position.copy(mp);
    mouth.quaternion.setFromUnitVectors(Z, mn).multiply(new THREE.Quaternion().setFromAxisAngle(Z, Math.PI * 1.15));
  } else {
    const face = mesh(new THREE.SphereGeometry(0.215, 40, 30), M.skin, head);
    face.scale.set(1.06, 0.96, 1.0);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.042, 14, 10), M.skin, head);
      ear.position.set(s * 0.222, -0.03, 0.0);
      ear.scale.set(0.55, 1, 0.8);
    }
    eyes = [-1, 1].map((s) => {
      const eye = mesh(new THREE.SphereGeometry(0.018, 10, 8), M.frame, head);
      eye.position.set(s * 0.07, -0.006, 0.2);
      eye.scale.set(1, 1.3, 0.5);
      return eye;
    });
    const mouth = mesh(new THREE.TorusGeometry(0.021, 0.0055, 6, 14, Math.PI * 0.8), M.frame, head);
    mouth.position.set(0, -0.092, 0.196);
    mouth.rotation.set(-0.4, 0, Math.PI + Math.PI * 0.1);
  }
  const eyeY = eyes[0].scale.y;

  // hair: one sculpted surface, slightly above and behind the head center
  const hairData = isPlayer ? mopHair(rng) : bunHair();
  const hair = mesh(hairData.geo, M.hair, head);
  hair.position.set(0, isPlayer ? 0.034 : 0.02, isPlayer ? -0.024 : -0.018);
  if (!isPlayer && opts.bun !== false) {
    const bun = mesh(new THREE.SphereGeometry(0.085, 20, 14), M.hair, head);
    bun.position.set(0, 0.17, -0.17);
  }

  root.traverse((o) => { if (o.isMesh) o.userData.isPlayer = isPlayer; });

  // ---- animation state --------------------------------------------------------------------
  let phase = 0, walk = 0, hop = 0, reach = 0, reachT = 0, pick = 0, pickT = 0;
  let sitW = 0, lieW = 0, packS = 1;
  let pose = 'stand', packVisible = true;
  const lean = { x: 0, v: 0 }, bank = { x: 0, v: 0 };
  // backpack sway: lags the body on starts / stops / steps / turns
  const packSway = { x: 0, v: 0, z: 0, vz: 0 };
  let prevSpeed = 0, prevFacing = null, headYaw = 0, glance = 0, glanceT = 3, glanceDur = 0;
  let groundY = null, groundV = 0;
  // hair follow-through spring (offset in head space)
  const hairOff = new THREE.Vector3(), hairVel = new THREE.Vector3(), hairTarget = new THREE.Vector3();
  const prevWorld = new THREE.Vector3(), prevVel = new THREE.Vector3(), curWorld = new THREE.Vector3(), curVel = new THREE.Vector3();
  let hairInit = false;
  const hairPos = hairData.geo.attributes.position;
  hairPos.setUsage(THREE.DynamicDrawUsage);
  const packRest = pack.position.clone();

  function legIK(leg, tz, ty) {
    // two-bone IK in the leg's sagittal plane; knee bends forward
    const D = THREE.MathUtils.clamp(Math.hypot(tz, ty), 0.06, L1 + L2 - 0.0005);
    const alpha = Math.atan2(tz, -ty);
    const a1 = Math.acos(THREE.MathUtils.clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
    const g = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
    return [-(alpha + a1), Math.PI - g];
  }

  function update(dt, t, o = {}) {
    const speed = o.speed ?? 0;
    const maxSpeed = o.maxSpeed ?? 2.3;
    const speed01 = Math.min(1, speed / maxSpeed);
    const ground = o.ground ?? null;
    const k = (r) => 1 - Math.exp(-dt * r);
    walk += (speed01 - walk) * k(10);
    sitW += ((pose === 'sit' ? 1 : 0) - sitW) * k(9);
    lieW += ((pose === 'lie' ? 1 : 0) - lieW) * k(7);
    packS += ((packVisible ? 1 : 0) - packS) * k(12);
    reachT = Math.max(0, reachT - dt);
    reach += ((reachT > 0.2 ? 1 : 0) - reach) * k(12);
    pickT = Math.max(0, pickT - dt);
    pick += ((pickT > 0.25 ? 1 : 0) - pick) * k(14);
    const still = 1 - Math.max(sitW, lieW);
    const f = root.rotation.y;

    // gait: cadence and stride follow speed so planted feet don't slide
    const omega = 8 + 9 * walk;
    if (speed > 0.03 || walk > 0.02) phase += dt * omega;
    const A = Math.min(0.15, speed / omega) * still;
    const lift = (isPlayer ? 0.06 : 0.055) * Math.min(1, walk * 1.6) * still;

    // forward acceleration -> lean spring (leans into starts, settles on stops)
    const acc = dt > 0 ? (speed - prevSpeed) / dt : 0;
    prevSpeed = speed;
    const leanTarget = (0.1 * walk + THREE.MathUtils.clamp(acc, -12, 12) * 0.012) * still;
    lean.v += ((leanTarget - lean.x) * 160 - lean.v * 13) * dt;
    lean.x += lean.v * dt;
    // turn rate -> bank into turns + head leads
    const turnRate = prevFacing === null || dt <= 0 ? 0 : wrap(f - prevFacing) / dt;
    prevFacing = f;
    bank.v += ((THREE.MathUtils.clamp(-turnRate * 0.03 * walk, -0.12, 0.12) - bank.x) * 120 - bank.v * 12) * dt;
    bank.x += bank.v * dt;

    // idle: occasional glance
    glanceT -= dt;
    if (walk > 0.1 || !still) { glanceT = Math.max(glanceT, 2.5); glanceDur = 0; }
    if (glanceT <= 0) { glance = (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.25); glanceDur = 1.3 + rng(); glanceT = 4 + rng() * 4; }
    if (glanceDur > 0) { glanceDur -= dt; if (glanceDur <= 0) glance = 0; }
    const lead = THREE.MathUtils.clamp(o.turn ?? 0, -1, 1) * 0.45;
    headYaw += ((walk > 0.1 ? lead : glance + lead) * still - headYaw) * k(6);

    // hips: bounce per step, crouch for pickups, weight shift when idle
    hop = Math.max(0, hop - dt * 2.6);
    const breathe = Math.sin(t * 2.2);
    const shift = Math.sin(t * 0.43) * (1 - walk) * still;
    const bounce = walk * 0.024 * (Math.abs(Math.sin(phase)) - 0.55) * still;
    let hipsY = HIP_Y + bounce - pick * 0.085 + Math.sin(hop * Math.PI) * 0.13;
    hipsY = THREE.MathUtils.lerp(hipsY, 0.25, sitW);
    hipsY = THREE.MathUtils.lerp(hipsY, 0.16, lieW);
    hips.position.y = hipsY;
    hips.position.z = -0.25 * lieW;
    hips.position.x = shift * 0.012;
    hips.rotation.z = shift * 0.03 + bank.x * 0.3;
    hips.rotation.y = -0.1 * walk * Math.cos(phase) * still;
    hips.rotation.x = -lieW * Math.PI / 2;

    // feet: target positions in the root's frame; ground under each foot
    const cs = Math.cos(f), sn = Math.sin(f);
    const rx = root.position.x, rz = root.position.z;
    const footZ = [A * Math.cos(phase), A * Math.cos(phase + Math.PI)];
    const footLift = [lift * Math.max(0, -Math.sin(phase)), lift * Math.max(0, -Math.sin(phase + Math.PI))];
    const gY = [0, 0];
    if (ground) {
      for (let i = 0; i < 2; i++) {
        const lx = legs[i].s * hipX, lz = footZ[i];
        gY[i] = ground(rx + cs * lx + sn * lz, rz - sn * lx + cs * lz);
      }
      // body rides on the lower foot; the other knee bends to reach its step
      // ...and looks a little ahead so it starts down a step before the foot lands
      const ahead = ground(rx + prevVel.x * 0.17, rz + prevVel.z * 0.17);
      const want = Math.min(gY[0], gY[1], ground(rx, rz), ahead > -50 ? ahead : 1e9);
      // critically damped spring: each step starts and ends softly (no pops)
      if (groundY === null || o.snap) { groundY = want; groundV = 0; }
      const kk = want > groundY ? 18 : 34;
      groundV += (kk * kk * (want - groundY) - 2 * kk * groundV) * dt;
      // never faster than the walk could carry you down / up the steps
      const vmax = 0.5 + 0.75 * speed;
      groundV = THREE.MathUtils.clamp(groundV, -vmax, vmax);
      groundY += groundV * dt;
      root.position.y = groundY;
    }

    for (let i = 0; i < 2; i++) {
      const leg = legs[i];
      const relGround = ground ? gY[i] - root.position.y : 0;
      const ty = relGround + ANKLE + footLift[i] - (hipsY + HIP_J);
      const [th, kn] = legIK(leg, footZ[i], ty);
      // sit: thighs forward, shins hang; lie: legs nearly straight
      leg.thigh.rotation.x = th * still - sitW * 1.5 - lieW * 0.08;
      leg.knee.rotation.x = kn * still + sitW * 1.35 + lieW * 0.12;
      leg.thigh.rotation.z = -leg.s * (0.02 + sitW * 0.06);
      leg.ankle.rotation.x = -(leg.thigh.rotation.x + leg.knee.rotation.x) * still + footLift[i] * 2.2 - sitW * 0.1;
    }

    // spine: lean, counter-twist, sideways bank, breathing
    spine.rotation.x = lean.x + reach * 0.1 + pick * 0.32 - sitW * 0.06;
    spine.rotation.y = 0.16 * walk * Math.cos(phase) * still;
    spine.rotation.z = -shift * 0.04 - bank.x * 0.6;
    chest.scale.y = 1 + breathe * 0.012 * (1 - walk);

    // arms swing opposite to the legs; rest on the lap when sitting
    const swing = 0.85 * walk * Math.cos(phase) * still;
    const armRest = (isPlayer ? 0.13 : 0.1) + breathe * 0.01 * (1 - walk);
    for (const a of arms) {
      const side = a.s; // -1 left, +1 right
      const legSign = side < 0 ? 1 : -1; // left arm swings with the right leg
      let x = legSign * swing - sitW * 0.65 - pick * 0.95;
      if (side > 0) x -= reach * 1.3;
      a.sh.rotation.x = x;
      a.sh.rotation.z = side * (armRest + lieW * 0.25 + walk * 0.04);
      a.sh.position.y = shY + breathe * 0.003 * (1 - walk);
      a.elbow.rotation.x = -(0.2 + 0.45 * walk * (0.5 + 0.5 * Math.max(0, -legSign * Math.cos(phase)))) - sitW * 0.55 - pick * 0.3 + (side > 0 ? reach * 0.15 : 0);
    }

    // head: leads turns, glances, small bob against the step, settles with lean
    neck.rotation.y = headYaw * 0.4;
    head.rotation.y = headYaw * 0.6;
    head.rotation.x = -lean.x * 0.6 + Math.sin(phase * 2) * 0.025 * walk + reach * 0.15 + pick * 0.2 + Math.sin(t * 1.3) * 0.03 * lieW;
    head.rotation.z = Math.sin(t * 0.9) * 0.03 * (1 - walk) * still - bank.x * 0.3;
    // blink now and then
    const blink = (t % 4.3) < 0.12 ? 0.12 : eyeY;
    for (const e of eyes) e.scale.y = blink;

    pack.scale.setScalar(Math.max(0.001, packS));
    straps.visible = packS > 0.2;
    if (isPlayer) {
      // the pack hangs from the shoulders: it swings back on starts, forward
      // on stops, bobs a little against each step and swings out in turns
      const swayT = THREE.MathUtils.clamp(-acc * 0.02, -0.14, 0.14) + walk * 0.05 * Math.sin(phase * 2);
      packSway.v += ((swayT - packSway.x) * 140 - packSway.v * 10) * dt;
      packSway.x += packSway.v * dt;
      packSway.vz += ((THREE.MathUtils.clamp(turnRate * 0.025 * walk, -0.1, 0.1) - packSway.z) * 120 - packSway.vz * 10) * dt;
      packSway.z += packSway.vz * dt;
      pack.rotation.x = packSway.x * still;
      pack.rotation.z = packSway.z * still;
      pack.position.y = packRest.y - Math.max(0, packSway.x) * 0.02;
    }

    // ---- hair follow-through -----------------------------------------------------------
    // Spring on head acceleration (in the character's frame): tufts lag on
    // starts, swing forward on stops, bounce on steps, trail on turns.
    curWorld.set(root.position.x, root.position.y + hips.position.y, root.position.z);
    if (!hairInit || dt <= 0) { prevWorld.copy(curWorld); prevVel.set(0, 0, 0); hairInit = true; }
    curVel.copy(curWorld).sub(prevWorld).divideScalar(Math.max(dt, 1e-4));
    const ax = (curVel.x - prevVel.x) / Math.max(dt, 1e-4), ay = (curVel.y - prevVel.y) / Math.max(dt, 1e-4), az = (curVel.z - prevVel.z) / Math.max(dt, 1e-4);
    prevWorld.copy(curWorld); prevVel.copy(curVel);
    const lax = cs * ax - sn * az, laz = sn * ax + cs * az; // world -> character frame
    hairTarget.set(
      THREE.MathUtils.clamp(-lax * 0.0016 + turnRate * 0.004, -0.02, 0.02),
      THREE.MathUtils.clamp(-ay * 0.0012, -0.014, 0.014),
      THREE.MathUtils.clamp(-laz * 0.0016 - walk * 0.006, -0.02, 0.02),
    );
    if (o.snap) { hairOff.copy(hairTarget); hairVel.set(0, 0, 0); }
    hairVel.addScaledVector(hairTarget.clone().sub(hairOff), 260 * dt).multiplyScalar(Math.exp(-11 * dt));
    hairOff.addScaledVector(hairVel, dt);
    if (!isPlayer) return; // NPCs stand at their counters: no hair follow-through needed
    const arr = hairPos.array, base = hairData.base, w = hairData.weight;
    const wob = Math.sin(t * 9) * 0.0015 * walk;
    for (let i = 0, n = w.length; i < n; i++) {
      const wi = w[i];
      if (wi === 0) continue;
      arr[i * 3] = base[i * 3] + hairOff.x * wi;
      arr[i * 3 + 1] = base[i * 3 + 1] + (hairOff.y + wob) * wi;
      arr[i * 3 + 2] = base[i * 3 + 2] + hairOff.z * wi;
    }
    hairPos.needsUpdate = true;
  }

  return {
    root,
    head,
    hair,
    setPose(p) { pose = p; },
    get pose() { return pose; },
    setBackpack(v) { packVisible = v; },
    reach() { reachT = 0.7; },
    pickup() { pickT = 0.65; },
    resetGround() { groundY = null; },
    get hairOffset() { return hairOff.length(); },
    // vertical walk bounce of the hips (0 when standing still)
    get bounce() { return pose === 'stand' ? hips.position.y - HIP_Y : 0; },
    update,
  };
}
