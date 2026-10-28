import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import modelUrl from './assets/chibi.glb?url';
import { ink } from './ink.js';
import { makeRng } from './sketch.js';

// The player: the reference character generated with Hunyuan3D 2.1, then
// decimated, re-proportioned to chibi height, re-textured and rigged in
// Blender (tools/chibi/prep.py -> src/assets/chibi.glb). The procedural motion
// (gait IK, lean / bank springs, arm swing, glances, pack sway, hair
// follow-through) drives a hierarchy of pivots; each frame the skeleton is
// posed to follow those pivots.

let gltf = null;

export async function loadChibi() {
  if (gltf) return;
  gltf = await new GLTFLoader().loadAsync(modelUrl);
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The model is built 0.985 m tall (2.7 heads); the world is real scale (seats
// 0.46 m, chair backs 0.96 m, desks ~0.75 m), so it's shown at 1.55x: ~1.53 m,
// shoulders at chair-back height, desk at the waist. Everything inside the
// root (pivots, animation offsets) is in model units; world distances (ground
// heights, stride) are divided by SCALE on the way in.
const SCALE = 1.55;

export function createChibi() {
  if (!gltf) throw new Error('loadChibi() must finish before createChibi()');
  const model = cloneSkinned(gltf.scene);
  const root = new THREE.Group();
  root.add(model);
  const rng = makeRng(77);

  model.traverse((o) => {
    if (!o.isMesh) return;
    const map = o.material.map;
    map.colorSpace = THREE.SRGBColorSpace;
    // the scan's own colours, softly shaded so it still sits in the drawn world
    o.material = ink({ albedo: true, local: true, map, facing: 0.35, softShade: 0.6, hatch: 0.06, hatchFreq: 40 });
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false; // skinned bounds don't follow the pose
    o.userData.outlineGroup = 0.2;
    o.userData.isPlayer = true;
  });

  // ---- skeleton and the pivots that drive it ----------------------------------------
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name.replace(/[^a-zA-Z]/g, '')] = o; });
  model.updateMatrixWorld(true);
  const restPos = (name) => bones[name].getWorldPosition(new THREE.Vector3());
  const group = (parent, at) => {
    const g = new THREE.Object3D();
    g.position.copy(at).sub(parent.userData.at ?? new THREE.Vector3());
    g.userData.at = at.clone();
    parent.add(g);
    return g;
  };
  const rig = new THREE.Object3D(); // pivots live here, beside the model
  root.add(rig);
  rig.userData.at = new THREE.Vector3();

  const hips = group(rig, restPos('hips'));
  const spine = group(hips, restPos('spine'));
  const neck = group(spine, restPos('neck'));
  const head = group(neck, restPos('head'));
  const hairG = group(head, restPos('hair'));
  const pack = group(spine, restPos('pack'));
  const HIP_Y = hips.position.y;
  const legs = [], arms = [];
  for (const [side, s] of [['R', -1], ['L', 1]]) {
    const thigh = group(hips, restPos('thigh' + side));
    const knee = group(thigh, restPos('shin' + side));
    const ankle = group(knee, restPos('foot' + side));
    legs.push({ thigh, knee, ankle, s, bones: ['thigh' + side, 'shin' + side, 'foot' + side] });
    const sh = group(spine, restPos('upperarm' + side));
    const elbow = group(sh, restPos('forearm' + side));
    arms.push({ sh, elbow, s, bones: ['upperarm' + side, 'forearm' + side] });
  }
  const L1 = -legs[0].knee.position.y, L2 = -legs[0].ankle.position.y;
  const HIP_J = legs[0].thigh.position.y;
  const ANKLE = legs[0].ankle.userData.at.y;
  const shY = arms[0].sh.position.y;
  const HEIGHT = new THREE.Box3().setFromObject(model).max.y; // model units
  const LIE_HIPS = 0.1; // torso back ~0.055 behind the hips; the big head needs a little more

  // bone -> pivot, with the bone's rest transform expressed in the pivot's frame
  const links = [];
  const pairs = [['hips', hips], ['spine', spine], ['neck', neck], ['head', head], ['hair', hairG], ['pack', pack]];
  for (const l of legs) l.bones.forEach((b, i) => pairs.push([b, [l.thigh, l.knee, l.ankle][i]]));
  for (const a of arms) a.bones.forEach((b, i) => pairs.push([b, [a.sh, a.elbow][i]]));
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const [name, g] of pairs) {
    const bone = bones[name];
    const rest = rootInv.clone().multiply(bone.matrixWorld);
    const offset = new THREE.Matrix4().makeTranslation(-g.userData.at.x, -g.userData.at.y, -g.userData.at.z).multiply(rest);
    links.push({ bone, g, offset, depth: 0 });
  }
  for (const l of links) { let d = 0, p = l.bone.parent; while (p) { d++; p = p.parent; } l.depth = d; }
  links.sort((a, b) => a.depth - b.depth);
  const want = new Map();
  const tmp = new THREE.Matrix4(), inv = new THREE.Matrix4(), parentRel = new THREE.Matrix4();
  function poseSkeleton() {
    root.updateMatrixWorld(true);
    rootInv.copy(root.matrixWorld).invert();
    for (const l of links) {
      const w = new THREE.Matrix4().multiplyMatrices(rootInv, l.g.matrixWorld).multiply(l.offset);
      want.set(l.bone, w);
      const pw = want.get(l.bone.parent);
      if (pw) parentRel.copy(pw);
      else parentRel.multiplyMatrices(rootInv, l.bone.parent.matrixWorld);
      tmp.multiplyMatrices(inv.copy(parentRel).invert(), w);
      tmp.decompose(l.bone.position, l.bone.quaternion, l.bone.scale);
    }
  }

  // ---- animation state (same motion as before) ----------------------------------------
  let phase = 0, walk = 0, hop = 0, reach = 0, reachT = 0, pick = 0, pickT = 0;
  let sitW = 0, lieW = 0, packS = 1;
  let pose = 'stand', packVisible = true;
  const lean = { x: 0, v: 0 }, bank = { x: 0, v: 0 };
  const packSway = { x: 0, v: 0, z: 0, vz: 0 };
  let prevSpeed = 0, prevFacing = null, headYaw = 0, glance = 0, glanceT = 3, glanceDur = 0;
  let groundY = null, groundV = 0;
  const hairOff = new THREE.Vector3(), hairVel = new THREE.Vector3(), hairTarget = new THREE.Vector3();
  const prevWorld = new THREE.Vector3(), prevVel = new THREE.Vector3(), curWorld = new THREE.Vector3(), curVel = new THREE.Vector3();
  let hairInit = false;
  const hairRest = hairG.position.clone(), packRest = pack.position.clone();

  function legIK(tz, ty) {
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
    // on / off at once: the bag is part of the body mesh, and a half-shrunk
    // bag stretches the triangles that join it to the back
    packS = packVisible ? 1 : 0;
    reachT = Math.max(0, reachT - dt);
    reach += ((reachT > 0.2 ? 1 : 0) - reach) * k(12);
    pickT = Math.max(0, pickT - dt);
    pick += ((pickT > 0.25 ? 1 : 0) - pick) * k(14);
    const still = 1 - Math.max(sitW, lieW);
    const f = root.rotation.y;

    // gait: cadence and stride follow speed so planted feet don't slide
    const omega = 8 + 9 * walk;
    if (speed > 0.03 || walk > 0.02) phase += dt * omega;
    const A = Math.min(0.15, speed / omega / SCALE) * still;
    const lift = 0.06 * Math.min(1, walk * 1.6) * still;

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
    // seats: thighs rest ~0.15 m above the seat spot; bed: back on the mattress
    hipsY = THREE.MathUtils.lerp(hipsY, 0.09 + 0.15 / SCALE, sitW);
    hipsY = THREE.MathUtils.lerp(hipsY, LIE_HIPS, lieW);
    hips.position.y = hipsY;
    hips.position.z = -0.25 / SCALE * lieW;
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
        const lx = legs[i].thigh.position.x * SCALE, lz = footZ[i] * SCALE;
        gY[i] = ground(rx + cs * lx + sn * lz, rz - sn * lx + cs * lz);
      }
      // body rides on the lower foot; the other knee bends to reach its step
      // ...and looks a little ahead so it starts down a step before the foot lands
      const ahead = ground(rx + prevVel.x * 0.17, rz + prevVel.z * 0.17);
      const target = Math.min(gY[0], gY[1], ground(rx, rz), ahead > -50 ? ahead : 1e9);
      // critically damped spring: each step starts and ends softly (no pops)
      if (groundY === null || o.snap) { groundY = target; groundV = 0; }
      const kk = target > groundY ? 18 : 34;
      groundV += (kk * kk * (target - groundY) - 2 * kk * groundV) * dt;
      // never faster than the walk could carry you down / up the steps
      const vmax = 0.5 + 0.75 * speed;
      groundV = THREE.MathUtils.clamp(groundV, -vmax, vmax);
      groundY += groundV * dt;
      root.position.y = groundY;
    }

    for (let i = 0; i < 2; i++) {
      const leg = legs[i];
      const relGround = ground ? (gY[i] - root.position.y) / SCALE : 0;
      const ty = relGround + ANKLE + footLift[i] - (hipsY + HIP_J);
      const [th, kn] = legIK(footZ[i], ty);
      // sit: thighs forward, shins hang; lie: legs nearly straight
      leg.thigh.rotation.x = th * still - sitW * 1.5 - lieW * 0.08;
      leg.knee.rotation.x = kn * still + sitW * 1.35 + lieW * 0.12;
      leg.thigh.rotation.z = -leg.s * (0.02 + sitW * 0.06);
      leg.ankle.rotation.x = -(leg.thigh.rotation.x + leg.knee.rotation.x) * still + footLift[i] * 2.2 - sitW * 0.1;
    }

    // spine: lean, counter-twist, sideways bank
    spine.rotation.x = lean.x + reach * 0.1 + pick * 0.32 - sitW * 0.06;
    spine.rotation.y = 0.16 * walk * Math.cos(phase) * still;
    spine.rotation.z = -shift * 0.04 - bank.x * 0.6;

    // arms swing opposite to the legs; rest on the lap when sitting
    const swing = 0.85 * walk * Math.cos(phase) * still;
    const armRest = 0.06 + breathe * 0.01 * (1 - walk);
    for (const a of arms) {
      const side = a.s;
      const legSign = side < 0 ? 1 : -1; // each arm swings with the opposite leg
      let x = legSign * swing - sitW * 0.3 - pick * 0.95;
      if (side > 0) x -= reach * 1.3;
      a.sh.rotation.x = x;
      a.sh.rotation.z = side * (armRest + lieW * 0.25 + walk * 0.04);
      a.sh.position.y = shY + breathe * 0.003 * (1 - walk);
      a.elbow.rotation.x = -(0.12 + 0.45 * walk * (0.5 + 0.5 * Math.max(0, -legSign * Math.cos(phase)))) - sitW * 0.75 - pick * 0.3 + (side > 0 ? reach * 0.15 : 0);
    }

    // head: leads turns, glances, small bob against the step, settles with lean
    neck.rotation.y = headYaw * 0.4;
    head.rotation.y = headYaw * 0.6;
    head.rotation.x = -lean.x * 0.6 + Math.sin(phase * 2) * 0.025 * walk + reach * 0.15 + pick * 0.2 + Math.sin(t * 1.3) * 0.03 * lieW;
    head.rotation.z = Math.sin(t * 0.9) * 0.03 * (1 - walk) * still - bank.x * 0.3;

    // the pack hangs from the shoulders: it swings back on starts, forward
    // on stops, bobs a little against each step and swings out in turns.
    // Taken off, it collapses into its pivot inside the back.
    pack.scale.setScalar(Math.max(0.001, packS));
    const swayT = THREE.MathUtils.clamp(-acc * 0.02, -0.14, 0.14) + walk * 0.05 * Math.sin(phase * 2);
    packSway.v += ((swayT - packSway.x) * 140 - packSway.v * 10) * dt;
    packSway.x += packSway.v * dt;
    packSway.vz += ((THREE.MathUtils.clamp(turnRate * 0.025 * walk, -0.1, 0.1) - packSway.z) * 120 - packSway.vz * 10) * dt;
    packSway.z += packSway.vz * dt;
    pack.rotation.x = packSway.x * still;
    pack.rotation.z = packSway.z * still;
    pack.position.y = packRest.y - Math.max(0, packSway.x) * 0.02;

    // ---- hair follow-through -----------------------------------------------------------
    // Spring on body acceleration (in the character's frame): loose hair lags
    // on starts, swings forward on stops, bounces on steps, trails on turns.
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
    hairG.position.copy(hairRest).add(hairOff);
    hairG.position.y += Math.sin(t * 9) * 0.0015 * walk;

    poseSkeleton();
  }

  root.scale.setScalar(SCALE);
  poseSkeleton();

  return {
    root,
    head,
    hair: hairG,
    setPose(p) { pose = p; },
    get pose() { return pose; },
    setBackpack(v) { packVisible = v; },
    reach() { reachT = 0.7; },
    pickup() { pickT = 0.65; },
    resetGround() { groundY = null; },
    get hairOffset() { return hairOff.length(); },
    // vertical walk bounce of the hips (0 when standing still)
    get bounce() { return pose === 'stand' ? (hips.position.y - HIP_Y) * SCALE : 0; },
    // height above the root the camera follows, per pose (world metres)
    get focus() { return pose === 'lie' ? 0.55 : (pose === 'sit' ? 0.7 : 0.82) * HEIGHT * SCALE; },
    update,
  };
}
