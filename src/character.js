import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ink } from './ink.js';
import { makeRng, Sketch } from './sketch.js';

// Chibi kid from the reference: big black mop of hair with a scalloped,
// tufty edge, thick square glasses, cream hoodie with the hood bunched at the
// neck, small rounded backpack with dark straps, black pants, dark shoes.
// Total height ~1.08m, head + hair ~46% of it.

// Black hair with a few light strand strokes (the reference has these).
function hairTexture() {
  const s = new Sketch(512, 256, { seed: 404, bg: '#000' });
  for (let i = 0; i < 12; i++) {
    const x = s.rand(0, 512), y = s.rand(40, 150), len = s.rand(18, 40), bend = s.rand(-8, 8);
    s.stroke([[x, y], [x + bend, y + len * 0.5], [x + bend * 0.3, y + len]], { w: 2, j: 0.4, color: '#fff', alpha: 0.6 });
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

// A box spanning two points in a parent's local space (temples, straps).
function beam(a, b, w, h, mat, parent) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function createCharacter() {
  const M = {
    skin: ink({ tone: 1, facing: 0.3, hatch: 0.5, local: true, hatchFreq: 34 }),
    hoodie: ink({ tone: 1, facing: 0.6, local: true, hatchFreq: 34 }),
    pack: ink({ tone: 1, facing: 0.6, local: true, hatchFreq: 34 }),
    hair: ink({ tone: 0, hatch: 0 }),
    hairCap: ink({ tone: 1, hatch: 0, facing: 0, map: hairTexture() }),
    pants: ink({ tone: 0, hatch: 0 }),
    dark: ink({ tone: 0.08, hatch: 0 }),
    frame: ink({ tone: 0, hatch: 0 }),
  };
  const rng = makeRng(77);
  const mesh = (geo, mat, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const group = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new THREE.Group();
  const body = group(root);

  // ---- legs (pivot at hip) ------------------------------------------------------
  const legs = [-1, 1].map((s) => {
    const hip = group(body, s * 0.07, 0.25, 0);
    const leg = mesh(new THREE.CapsuleGeometry(0.068, 0.1, 6, 14), M.pants, hip);
    leg.position.y = -0.11;
    const shoe = mesh(new RoundedBoxGeometry(0.12, 0.075, 0.17, 2, 0.034), M.dark, hip);
    shoe.position.set(0, -0.215, 0.025);
    const sole = mesh(new RoundedBoxGeometry(0.124, 0.022, 0.175, 2, 0.01), M.skin, hip);
    sole.position.set(0, -0.245, 0.025);
    return hip;
  });

  // ---- torso: hoodie --------------------------------------------------------------
  const torso = group(body, 0, 0.25, 0);
  const profile = [[0, 0], [0.15, 0], [0.162, 0.05], [0.158, 0.16], [0.145, 0.25], [0.11, 0.31], [0.06, 0.34], [0, 0.345]].map(([r, y]) => new THREE.Vector2(r, y));
  const chest = mesh(new THREE.LatheGeometry(profile, 24), M.hoodie, torso);
  chest.scale.z = 0.82;
  const hem = mesh(new THREE.TorusGeometry(0.154, 0.022, 8, 24), M.hoodie, torso);
  hem.rotation.x = Math.PI / 2;
  hem.scale.y = 0.82;
  hem.position.y = 0.02;
  // hood bunched around the back of the neck
  const hoodRing = mesh(new THREE.TorusGeometry(0.1, 0.042, 10, 20, Math.PI * 1.35), M.hoodie, torso);
  hoodRing.rotation.set(Math.PI / 2, 0, Math.PI * 0.82);
  hoodRing.position.set(0, 0.33, -0.01);
  const hoodBack = mesh(new THREE.SphereGeometry(0.11, 18, 12), M.hoodie, torso);
  hoodBack.position.set(0, 0.33, -0.1);
  hoodBack.scale.set(1.25, 0.6, 0.75);
  for (const s of [-1, 1]) {
    const str = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6), M.dark, torso);
    str.position.set(s * 0.035, 0.27, 0.125);
    str.rotation.x = -0.15;
  }

  // backpack: small, rounded, with a flap seam, a top loop and dark straps
  const pack = group(torso, 0, 0.17, -0.15);
  mesh(new RoundedBoxGeometry(0.25, 0.27, 0.12, 4, 0.055), M.pack, pack);
  const flap = mesh(new RoundedBoxGeometry(0.235, 0.1, 0.04, 3, 0.018), M.pack, pack);
  flap.position.set(0, 0.075, -0.055);
  const pocket = mesh(new RoundedBoxGeometry(0.17, 0.1, 0.04, 3, 0.018), M.pack, pack);
  pocket.position.set(0, -0.06, -0.06);
  const loop = mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI), M.dark, pack);
  loop.position.set(0, 0.135, 0.0);
  const straps = group(torso);
  for (const s of [-1, 1]) {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // over the shoulder and down the front
    beam(v(s * 0.08, 0.14, -0.1), v(s * 0.09, 0.34, 0.0), 0.03, 0.014, M.dark, straps);
    beam(v(s * 0.09, 0.34, 0.0), v(s * 0.095, 0.29, 0.118), 0.03, 0.014, M.dark, straps);
    beam(v(s * 0.095, 0.29, 0.118), v(s * 0.105, 0.12, 0.138), 0.03, 0.014, M.dark, straps);
  }

  // ---- arms (pivot at shoulder) -------------------------------------------------------
  const arms = [-1, 1].map((s) => {
    const sh = group(torso, s * 0.145, 0.28, 0);
    const inner = group(sh);
    inner.rotation.z = s * 0.2;
    const arm = mesh(new THREE.CapsuleGeometry(0.05, 0.1, 6, 12), M.hoodie, inner);
    arm.position.y = -0.1;
    const cuff = mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.025, 14), M.hoodie, inner);
    cuff.position.y = -0.18;
    const hand = mesh(new THREE.SphereGeometry(0.046, 14, 10), M.skin, inner);
    hand.position.y = -0.22;
    return sh;
  });

  // ---- head ------------------------------------------------------------------------------
  const head = group(torso, 0, 0.57, 0);
  const face = mesh(new THREE.SphereGeometry(0.23, 32, 24), M.skin, head);
  face.scale.set(1.04, 0.96, 1);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.045, 12, 10), M.skin, head);
    ear.position.set(s * 0.232, -0.03, 0.0);
    ear.scale.set(0.55, 1, 0.8);
  }
  // face: dot eyes behind the glasses, small smile
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.019, 10, 8), M.frame, head);
    eye.position.set(s * 0.072, -0.008, 0.212);
    eye.scale.set(1, 1.3, 0.5);
  }
  const mouth = mesh(new THREE.TorusGeometry(0.022, 0.0055, 6, 14, Math.PI * 0.8), M.frame, head);
  mouth.position.set(0, -0.098, 0.208);
  mouth.rotation.set(-0.35, 0, Math.PI + Math.PI * 0.1);

  // glasses: two thick square frames, bridge, temples back to the ears
  const glasses = group(head, 0, -0.005, 0);
  const fg = frameGeometry(0.118, 0.098, 0.02, 0.016);
  for (const s of [-1, 1]) {
    const f = mesh(fg, M.frame, glasses);
    f.position.set(s * 0.075, 0, 0.232);
    f.rotation.y = s * 0.16;
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    beam(v(s * 0.13, 0.02, 0.222), v(s * 0.232, 0.01, 0.1), 0.019, 0.018, M.frame, glasses);
    beam(v(s * 0.232, 0.01, 0.1), v(s * 0.252, -0.02, -0.005), 0.019, 0.018, M.frame, glasses);
  }
  const bridge = mesh(new THREE.BoxGeometry(0.04, 0.016, 0.016), M.frame, glasses);
  bridge.position.set(0, 0.012, 0.243);

  // hair: a wide cap set back on the head, so the face shows in front
  const hair = group(head);
  const cap = mesh(new THREE.SphereGeometry(0.255, 32, 24), M.hairCap, hair);
  // raised and set back so the sides of the face (and the glasses temples) show
  cap.position.set(0, 0.1, -0.07);
  cap.scale.set(1.02, 0.98, 1.06);
  // tufts: flattened 5-sided cones with their base at the origin
  const tuft = new THREE.ConeGeometry(0.075, 0.15, 5);
  tuft.translate(0, 0.075, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const center = cap.position.clone();
  const addTuft = (n, len, w, droop, off = 0.215) => {
    const d = n.clone().normalize();
    const dir = d.clone().add(new THREE.Vector3(0, -droop, 0)).normalize();
    const m = mesh(tuft, M.hair, hair);
    m.position.copy(center).addScaledVector(d, off);
    m.position.x *= 1.08;
    m.quaternion.setFromUnitVectors(up, dir);
    m.rotateY(rng() * Math.PI);
    m.scale.set(w, len, w * 0.6);
  };
  // scalloped rim around the back and sides, pointing out and down
  for (let i = 0; i < 26; i++) {
    const az = Math.PI * 0.32 + (i / 26) * Math.PI * 1.36 + (rng() - 0.5) * 0.12; // skip the face
    const side = Math.abs(Math.sin(az));
    const el = -0.2 + rng() * 0.35 + (Math.cos(az) > -0.35 ? 0.34 : 0) + side * 0;
    const n = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    // tufts near the face are shorter and hang down instead of flaring out
    const front = Math.max(0, Math.cos(az));
    addTuft(n, (0.75 + rng() * 0.45) * (1 - 0.45 * front), 1.05 + rng() * 0.3, 1.0 + rng() * 0.35 + front * 0.9, 0.245 - front * 0.02);
  }
  // mid layer for volume
  for (let i = 0; i < 16; i++) {
    const az = rng() * Math.PI * 2;
    const el = 0.3 + rng() * 0.6;
    const n = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    if (n.z > 0.45 && n.y < 0.6) continue;
    addTuft(n, 0.38 + rng() * 0.22, 1.15, 0.9 + rng() * 0.3, 0.235);
  }
  // a few spiky tufts on top
  for (const [x, z, l] of [[-0.3, -0.2, 0.6], [0.15, -0.35, 0.55], [0.35, 0.05, 0.5], [-0.1, 0.25, 0.45]]) {
    addTuft(new THREE.Vector3(x, 1, z), l * 0.95, 1.1, 0.25 + rng() * 0.2, 0.235);
  }
  // fringe over the forehead, stopping above the glasses
  for (let i = -3; i <= 3; i++) {
    const n = new THREE.Vector3(i * 0.2, 0.62 - Math.abs(i) * 0.04, 0.8);
    addTuft(n, 0.55 + rng() * 0.15, 0.95, 1.6, 0.235);
  }

  root.traverse((o) => { if (o.isMesh) o.userData.isPlayer = true; });

  // ---- animation --------------------------------------------------------------------------
  let phase = 0, walk = 0, hop = 0, reach = 0, reachT = 0, pick = 0, pickT = 0;
  let sitW = 0, lieW = 0, packS = 1;
  let pose = 'stand', packVisible = true;

  return {
    root,
    head,
    glasses,
    setPose(p) { pose = p; },
    get pose() { return pose; },
    setBackpack(v) { packVisible = v; },
    hopNow() { hop = 1; },
    reach() { reachT = 0.7; },
    pickup() { pickT = 0.65; },
    update(dt, t, speed01) {
      const k = (r) => 1 - Math.exp(-dt * r);
      walk += (speed01 - walk) * k(10);
      sitW += ((pose === 'sit' ? 1 : 0) - sitW) * k(9);
      lieW += ((pose === 'lie' ? 1 : 0) - lieW) * k(7);
      packS += ((packVisible ? 1 : 0) - packS) * k(12);
      reachT = Math.max(0, reachT - dt);
      reach += ((reachT > 0.2 ? 1 : 0) - reach) * k(12);
      pickT = Math.max(0, pickT - dt);
      pick += ((pickT > 0.25 ? 1 : 0) - pick) * k(14);

      phase += dt * (5 + 6 * walk) * (walk > 0.02 ? 1 : 0);
      const sw = Math.sin(phase * 1.6) * walk;
      const breathe = Math.sin(t * 2.2) * (1 - walk);
      const still = 1 - Math.max(sitW, lieW);

      // legs: walk swing, or forward when sitting
      legs[0].rotation.x = sw * 0.7 * still - sitW * 1.45;
      legs[1].rotation.x = -sw * 0.7 * still - sitW * 1.45;
      legs[0].rotation.z = -sitW * 0.08;
      legs[1].rotation.z = sitW * 0.08;
      // arms: swing; rest on lap when sitting; reach / pickup
      arms[0].rotation.x = -sw * 0.55 - sitW * 0.55 - pick * 1.1;
      arms[1].rotation.x = sw * 0.55 - sitW * 0.55 - reach * 1.35 - pick * 1.1;
      arms[0].rotation.z = -0.02 - breathe * 0.015 - lieW * 0.25;
      arms[1].rotation.z = 0.02 + breathe * 0.015 + lieW * 0.25;

      hop = Math.max(0, hop - dt * 2.6);
      const bounce = Math.abs(Math.cos(phase * 1.6)) * 0.055 * walk * still;
      body.position.y = bounce + Math.sin(hop * Math.PI) * 0.13 - pick * 0.07 + lieW * 0.16;
      body.rotation.x = 0.07 * walk * still + reach * 0.12 + pick * 0.25 - lieW * Math.PI / 2;
      torso.rotation.x = -sitW * 0.08;
      torso.scale.y = 1 + breathe * 0.015;
      head.position.y = 0.57 + breathe * 0.006 + Math.sin(phase * 3.2) * 0.012 * walk;
      head.rotation.z = Math.sin(t * 0.9) * 0.035 * (1 - walk) * still + sw * 0.04;
      head.rotation.x = -0.04 * walk + reach * 0.15 + Math.sin(t * 1.3) * 0.03 * lieW;
      pack.scale.setScalar(Math.max(0.001, packS));
      straps.visible = packS > 0.2;
    },
  };
}
