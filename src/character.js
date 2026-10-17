import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ink } from './ink.js';
import { makeRng, Sketch } from './sketch.js';

// Chibi kid from the reference, built as one drawn figure:
//  - hair is a single sculpted mesh (a sphere pushed out into soft tufts and
//    pulled inside the head where the face shows), with spring follow-through
//  - parts of the same material share one outline id, so the outline pass
//    draws the silhouette and real creases, not a line around every primitive
//  - joint hierarchy: hips > spine > neck > head, shoulders > elbows,
//    hips > knees > ankles, with two-bone leg IK so feet land on steps.
// Total height ~1.1 m, head + hair ~47% of it.

const L1 = 0.118;   // thigh (hip joint -> knee)
const L2 = 0.118;   // shin (knee -> ankle)
const ANKLE = 0.05; // ankle height above the sole
const HIP_Y = 0.29; // hips pivot above the ground when standing
const HIP_J = -0.02; // hip joints relative to the hips pivot

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

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Thick square lens frame: outer rounded rect with a rounded-rect hole.
function frameGeometry(w, h, t, depth) {
  const outer = roundedRect(w, h, 0.022);
  outer.holes.push(roundedRect(w - t * 2, h - t * 2, 0.012));
  const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// A box spanning two points in a parent's local space (glasses temples).
function beam(a, b, w, h, mat, parent) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
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

// The player's messy mop: wide, slightly asymmetric, scalloped rim, a few
// soft spikes on top and a fringe stopping above the glasses.
function mopHair(rng) {
  const tufts = [];
  const dir = (az, el) => [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  // scalloped rim around the sides and back: spiky tufts hanging out and down
  const RIM = 19;
  for (let i = 0; i < RIM; i++) {
    const az = (i / RIM) * Math.PI * 2 + (rng() - 0.5) * 0.12;
    const front = Math.max(0, Math.cos(az));
    if (front > 0.8) continue;
    const back = Math.max(0, -Math.cos(az));
    const el = 0.02 + front * 0.22 - back * 0.32 + (rng() - 0.5) * 0.12;
    tufts.push({ dir: dir(az, el), w: 0.3 + rng() * 0.06, len: 0.075 + rng() * 0.035 - front * 0.03, droop: 0.75 + rng() * 0.35, sharp: 2.6, loose: 1 });
  }
  // second, higher ring that gives the mop its puffy, layered outline
  for (let i = 0; i < 11; i++) {
    const az = (i / 11) * Math.PI * 2 + 0.3 + (rng() - 0.5) * 0.2;
    if (Math.cos(az) > 0.75) continue;
    tufts.push({ dir: dir(az, 0.5 + (rng() - 0.5) * 0.15), w: 0.34, len: 0.05 + rng() * 0.02, droop: 0.5, sharp: 2.3, loose: 0.8 });
  }
  // a fuller mass on one side (asymmetry)
  tufts.push({ dir: dir(1.35, 0.25), w: 0.7, len: 0.03, droop: 0.4, sharp: 1.3, loose: 0.4 });
  // soft spikes on the crown
  for (const [az, el, len, lean] of [[-2.7, 1.05, 0.085, [0, 0, -0.35]], [2.3, 1.1, 0.075, [0.25, 0, -0.3]], [-1.2, 1.15, 0.07, [-0.35, 0, 0]], [0.5, 1.2, 0.06, [0.25, 0, 0.25]], [3.1, 0.85, 0.07, [0, -0.1, -0.4]]]) {
    tufts.push({ dir: dir(az, el), w: 0.27, len, droop: 0.1, sharp: 2.8, lean, loose: 1.3 });
  }
  // fringe over the forehead, drooping forward and down to the glasses
  for (const az of [-0.7, -0.38, -0.08, 0.22, 0.52, 0.8]) {
    tufts.push({ dir: dir(az + (rng() - 0.5) * 0.08, 0.6), w: 0.3, len: 0.085 + rng() * 0.015, droop: 1.9, lean: [0, 0, 0.55], sharp: 2.2, loose: 0.8 });
  }
  return sculptHair({
    R: 0.24,
    scale: [1.12, 1.0, 1.06],
    // hairline elevation by azimuth: forehead, just above the ears, low nape
    hairline: (az) => {
      const a = Math.abs(az);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.42, -0.05, smoothstep(0.45, 1.45, a)), -0.7, smoothstep(1.8, 2.7, a));
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
 * opts.style: 'player' (default) or 'auntie' (NPC: bun, apron, no glasses or
 * backpack). NPC options: bun (default true), topTone (shirt shade).
 */
export function createCharacter(opts = {}) {
  const style = opts.style ?? 'player';
  const isPlayer = style === 'player';
  const rng = makeRng(isPlayer ? 77 : 91);
  const M = {
    skin: ink({ tone: 1, facing: 0.3, hatch: 0.5, local: true, hatchFreq: 34 }),
    top: ink({ tone: isPlayer ? 1 : (opts.topTone ?? 0.7), facing: 0.6, local: true, hatchFreq: 34 }),
    apron: ink({ tone: 1, facing: 0.5, local: true, hatchFreq: 34 }),
    pack: ink({ tone: 1, facing: 0.6, local: true, hatchFreq: 34 }),
    hair: ink({ tone: 1, hatch: 0, facing: 0, map: hairTexture(isPlayer ? 404 : 405) }),
    pants: ink({ tone: 0, hatch: 0 }),
    dark: ink({ tone: 0.08, hatch: 0 }),
    sole: ink({ tone: 0.85, hatch: 0, facing: 0.2 }),
    frame: ink({ tone: 0, hatch: 0 }),
  };
  // Parts of one material read as one shape: same outline id.
  const ids = {};
  for (const [k, i] of Object.entries({ skin: 1, top: 2, apron: 3, pack: 4, hair: 5, pants: 6, dark: 7, sole: 8, frame: 9 })) ids[M[k].uuid] = (isPlayer ? 0.11 : 0.53) + i * 0.037;
  const mesh = (geo, mat, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.outlineGroup = ids[mat.uuid];
    parent.add(m);
    return m;
  };
  const group = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new THREE.Group();
  const hips = group(root, 0, HIP_Y, 0);

  // ---- pelvis + legs ------------------------------------------------------------
  const pelvis = mesh(new THREE.SphereGeometry(0.135, 24, 14), M.pants, hips);
  pelvis.scale.set(1.05, 0.55, 0.82);
  pelvis.position.y = -0.005;
  const legs = [-1, 1].map((s) => {
    const thigh = group(hips, s * 0.068, HIP_J, 0);
    mesh(new THREE.CapsuleGeometry(0.064, L1 * 0.7, 6, 16), M.pants, thigh).position.y = -L1 * 0.5;
    const knee = group(thigh, 0, -L1, 0);
    mesh(new THREE.CapsuleGeometry(0.058, L2 * 0.75, 6, 16), M.pants, knee).position.y = -L2 * 0.5;
    const ankle = group(knee, 0, -L2, 0);
    const shoe = mesh(new RoundedBoxGeometry(0.115, 0.07, 0.17, 3, 0.033), M.dark, ankle);
    shoe.position.set(0, -0.018, 0.032);
    const sole = mesh(new RoundedBoxGeometry(0.118, 0.02, 0.172, 2, 0.009), M.sole, ankle);
    sole.position.set(0, -0.046, 0.032);
    return { thigh, knee, ankle, s, prevY: 0 };
  });

  // ---- spine: one continuous hoodie shape ------------------------------------------
  const spine = group(hips, 0, 0.0, 0);
  const prof = [[0, -0.045], [0.148, -0.045], [0.162, -0.02], [0.166, 0.03], [0.162, 0.12], [0.154, 0.19], [0.14, 0.245], [0.115, 0.285], [0.082, 0.31], [0.055, 0.318], [0, 0.32]];
  const chest = mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32), M.top, spine);
  chest.scale.z = 0.8;
  const hem = mesh(new THREE.TorusGeometry(0.151, 0.02, 8, 32), M.top, spine);
  hem.rotation.x = Math.PI / 2;
  hem.scale.y = 0.8;
  hem.position.y = -0.035;
  if (isPlayer) {
    // hood: a soft roll around the back of the neck plus the folded hood on the back
    const roll = mesh(new THREE.TorusGeometry(0.088, 0.04, 12, 24, Math.PI * 1.3), M.top, spine);
    roll.rotation.set(Math.PI / 2, 0, Math.PI * 0.85);
    roll.position.set(0, 0.305, -0.01);
    const hood = mesh(new THREE.SphereGeometry(0.105, 20, 14), M.top, spine);
    hood.position.set(0, 0.29, -0.095);
    hood.scale.set(1.3, 0.62, 0.72);
    for (const s of [-1, 1]) {
      const str = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.085, 6), M.dark, spine);
      str.position.set(s * 0.032, 0.25, 0.122);
      str.rotation.x = -0.2;
    }
  } else {
    // apron over the front
    const ap = mesh(new RoundedBoxGeometry(0.22, 0.26, 0.02, 2, 0.008), M.apron, spine);
    ap.position.set(0, 0.06, 0.13);
    ap.rotation.x = -0.05;
    const tie = mesh(new THREE.TorusGeometry(0.152, 0.008, 6, 32), M.dark, spine);
    tie.rotation.x = Math.PI / 2; tie.scale.y = 0.8; tie.position.y = 0.12;
  }

  // backpack: rounded, flap, pocket, top loop; straps over the shoulders
  const pack = group(spine, 0, 0.165, -0.118);
  const straps = group(spine);
  if (isPlayer) {
    const body = mesh(new RoundedBoxGeometry(0.235, 0.25, 0.115, 5, 0.052), M.pack, pack);
    body.position.z = -0.05;
    const flap = mesh(new RoundedBoxGeometry(0.225, 0.1, 0.04, 4, 0.019), M.pack, pack);
    flap.position.set(0, 0.07, -0.1);
    const pocket = mesh(new RoundedBoxGeometry(0.16, 0.095, 0.04, 4, 0.018), M.pack, pack);
    pocket.position.set(0, -0.06, -0.105);
    const loop = mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 12, Math.PI), M.dark, pack);
    loop.position.set(0, 0.125, -0.04);
    for (const s of [-1, 1]) {
      const pts = [
        [s * 0.07, 0.25, -0.15], [s * 0.082, 0.302, -0.09], [s * 0.088, 0.318, -0.01], [s * 0.093, 0.29, 0.075],
        [s * 0.1, 0.2, 0.128], [s * 0.108, 0.09, 0.136], [s * 0.128, 0.05, 0.08], [s * 0.115, 0.07, -0.08], [s * 0.09, 0.09, -0.15],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0145, 6, false);
      const st = mesh(tube, M.dark, straps);
      st.scale.set(1, 1, 1);
    }
  }

  // ---- arms (shoulder > elbow > hand) ------------------------------------------------
  const LA1 = 0.105, LA2 = 0.095;
  const arms = [-1, 1].map((s) => {
    const sh = group(spine, s * 0.122, 0.24, 0);
    mesh(new THREE.CapsuleGeometry(0.049, LA1 * 0.85, 6, 14), M.top, sh).position.y = -LA1 * 0.5;
    const elbow = group(sh, 0, -LA1, 0);
    mesh(new THREE.CapsuleGeometry(0.046, LA2 * 0.7, 6, 14), M.top, elbow).position.y = -LA2 * 0.45;
    const cuff = mesh(new THREE.TorusGeometry(0.041, 0.012, 6, 16), M.top, elbow);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -LA2 + 0.005;
    const hand = mesh(new THREE.SphereGeometry(0.041, 16, 12), M.skin, elbow);
    hand.position.y = -LA2 - 0.03;
    return { sh, elbow, s };
  });

  // ---- head ---------------------------------------------------------------------------
  const neck = group(spine, 0, 0.31, 0);
  const head = group(neck, 0, 0.195, 0.012);
  const face = mesh(new THREE.SphereGeometry(0.215, 40, 30), M.skin, head);
  face.scale.set(1.06, 0.96, 1.0);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.042, 14, 10), M.skin, head);
    ear.position.set(s * 0.222, -0.03, 0.0);
    ear.scale.set(0.55, 1, 0.8);
  }
  // face: dot eyes behind the glasses, small smile
  const eyes = [-1, 1].map((s) => {
    const eye = mesh(new THREE.SphereGeometry(0.018, 10, 8), M.frame, head);
    eye.position.set(s * 0.07, -0.006, 0.2);
    eye.scale.set(1, 1.3, 0.5);
    return eye;
  });
  const mouth = mesh(new THREE.TorusGeometry(0.021, 0.0055, 6, 14, Math.PI * 0.8), M.frame, head);
  mouth.position.set(0, -0.092, 0.196);
  mouth.rotation.set(-0.4, 0, Math.PI + Math.PI * 0.1);

  // glasses: two thick square frames, bridge, temples back to the ears
  const glasses = group(head, 0, -0.004, 0);
  if (isPlayer) {
    const fg = frameGeometry(0.116, 0.096, 0.02, 0.016);
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const s of [-1, 1]) {
      const f = mesh(fg, M.frame, glasses);
      f.position.set(s * 0.072, 0, 0.222);
      f.rotation.y = s * 0.18;
      beam(v(s * 0.126, 0.018, 0.205), v(s * 0.222, 0.012, 0.085), 0.019, 0.018, M.frame, glasses).userData.outlineGroup = ids[M.frame.uuid];
      beam(v(s * 0.222, 0.012, 0.085), v(s * 0.236, -0.02, -0.005), 0.019, 0.018, M.frame, glasses).userData.outlineGroup = ids[M.frame.uuid];
    }
    const bridge = mesh(new THREE.BoxGeometry(0.036, 0.016, 0.016), M.frame, glasses);
    bridge.position.set(0, 0.012, 0.236);
  }

  // hair: one sculpted surface, slightly above and behind the head center
  const hairData = isPlayer ? mopHair(rng) : bunHair();
  const hair = mesh(hairData.geo, M.hair, head);
  hair.position.set(0, isPlayer ? 0.032 : 0.02, -0.018);
  if (!isPlayer && opts.bun !== false) {
    const bun = mesh(new THREE.SphereGeometry(0.085, 20, 14), M.hair, head);
    bun.position.set(0, 0.17, -0.17);
    bun.userData.outlineGroup = ids[M.hair.uuid];
  }

  root.traverse((o) => { if (o.isMesh) o.userData.isPlayer = isPlayer; });

  // ---- animation state --------------------------------------------------------------------
  let phase = 0, walk = 0, hop = 0, reach = 0, reachT = 0, pick = 0, pickT = 0;
  let sitW = 0, lieW = 0, packS = 1;
  let pose = 'stand', packVisible = true;
  const lean = { x: 0, v: 0 }, bank = { x: 0, v: 0 };
  let prevSpeed = 0, prevFacing = null, headYaw = 0, glance = 0, glanceT = 3, glanceDur = 0;
  let groundY = null, groundV = 0;
  // hair follow-through spring (offset in head space)
  const hairOff = new THREE.Vector3(), hairVel = new THREE.Vector3(), hairTarget = new THREE.Vector3();
  const prevWorld = new THREE.Vector3(), prevVel = new THREE.Vector3(), curWorld = new THREE.Vector3(), curVel = new THREE.Vector3();
  let hairInit = false;
  const hairPos = hairData.geo.attributes.position;
  hairPos.setUsage(THREE.DynamicDrawUsage);

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
    const lift = 0.055 * Math.min(1, walk * 1.6) * still;

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
        const lx = legs[i].s * 0.068, lz = footZ[i];
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
    const armRest = 0.1 + breathe * 0.01 * (1 - walk);
    for (const a of arms) {
      const side = a.s; // -1 left, +1 right
      const legSign = side < 0 ? 1 : -1; // left arm swings with the right leg
      let x = legSign * swing - sitW * 0.65 - pick * 0.95;
      if (side > 0) x -= reach * 1.3;
      a.sh.rotation.x = x;
      a.sh.rotation.z = side * (armRest + lieW * 0.25 + walk * 0.04);
      a.sh.position.y = 0.24 + breathe * 0.003 * (1 - walk);
      a.elbow.rotation.x = -(0.2 + 0.45 * walk * (0.5 + 0.5 * Math.max(0, -legSign * Math.cos(phase)))) - sitW * 0.55 - pick * 0.3 + (side > 0 ? reach * 0.15 : 0);
    }

    // head: leads turns, glances, small bob against the step, settles with lean
    neck.rotation.y = headYaw * 0.4;
    head.rotation.y = headYaw * 0.6;
    head.rotation.x = -lean.x * 0.6 + Math.sin(phase * 2) * 0.025 * walk + reach * 0.15 + pick * 0.2 + Math.sin(t * 1.3) * 0.03 * lieW;
    head.rotation.z = Math.sin(t * 0.9) * 0.03 * (1 - walk) * still - bank.x * 0.3;
    // blink now and then
    const blink = (t % 4.3) < 0.12 ? 0.15 : 1.3;
    for (const e of eyes) e.scale.y = blink;

    pack.scale.setScalar(Math.max(0.001, packS));
    straps.visible = packS > 0.2;

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
    glasses,
    hair,
    setPose(p) { pose = p; },
    get pose() { return pose; },
    setBackpack(v) { packVisible = v; },
    hopNow() { hop = 1; },
    reach() { reachT = 0.7; },
    pickup() { pickT = 0.65; },
    resetGround() { groundY = null; },
    get hairOffset() { return hairOff.length(); },
    // vertical walk bounce of the hips (0 when standing still)
    get bounce() { return pose === 'stand' ? hips.position.y - HIP_Y : 0; },
    update,
  };
}
