import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ink } from '../ink.js';
import { makeRng } from '../sketch.js';
import * as LX from '../lobbyTextures.js';
import { t as tr, onLang } from '../i18n.js';
import { Batch } from './kit.js';

// The airport lobby: the destination picker. A round departure hall, every
// city a gate in the back wall. Walk up to a gate (its sign brightens, the arrow
// pulses, the view through the arch comes forward), press E: the traveler walks
// into the arch, the view pushes in, cuts to the jetway, runs down it toward the
// light and lands in that city. E or Esc skips; with reduced motion it is a fade.
//
// Gates come from GATES: adding a city is one entry here (plus its prompt in
// i18n.js); the hall spaces the gates evenly around the back wall.
//   id        stable id (remembered as the last gate)
//   nameEn / nameZh   the sign
//   icon      sign glyph: 'pearl' | 't101' | 'campus' | 'globe' (lobbyTextures.js ICONS)
//   sceneArt  the view through the arch: 'pudong' | 'taipei' | 'santaclara' | 'worldmap'
//   route     the scene id it flies to (scenes/index.js), or null
//   enabled   false: shows a "coming soon" card instead of the jetway
export const GATES = [
  { id: 'shanghai', nameEn: 'Shanghai', nameZh: '上海', icon: 'pearl', sceneArt: 'pudong', route: 'shanghai', enabled: true },
  { id: 'taipei', nameEn: 'Taipei', nameZh: '台北', icon: 't101', sceneArt: 'taipei', route: 'taiwan', enabled: true },
  { id: 'santaclara', nameEn: 'Santa Clara', nameZh: '聖克拉拉', icon: 'campus', sceneArt: 'santaclara', route: null, enabled: false },
  { id: 'next', nameEn: 'Next Stop', nameZh: '下一站', icon: 'globe', sceneArt: 'worldmap', route: null, enabled: false },
];
const ART = { pudong: LX.pudongView, taipei: LX.taipeiView, santaclara: LX.santaClaraView, worldmap: LX.worldMapView };
const LAST_GATE = 'doodleworld.lastGate';
const promptFor = (g) => (g.id === 'next' ? 'See the next stop' : `Check in to ${g.nameEn}`);

// Layout (meters): the hall is a circle of radius R around the origin, you
// enter at +z (the doors home) and face the gates at -z. Azimuth az is measured
// from -z, positive to the right (+x).
const R = 8.5, H = 5.0;
const OW = 2.4, OH = 2.95;            // the arch opening
const DESK = { x: 0, z: -2.0 };       // pillar + info desk centre
const TUNNEL = { z0: 40, L: 36 };     // the jetway set, out of sight behind the hall
const onWall = (az, r = R) => [Math.sin(az) * r, -Math.cos(az) * r];
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export default {
  id: 'lobby',
  name: 'the airport',
  travelText: 'Heading to the airport…',
  arrival: 'Arriving at the airport',
  hud: {
    title: 'Departures',
    sub: 'Choose your next destination',
    style: 'card',
    map: 'compass',
    objectives: [
      { id: 'gate', text: 'Choose a gate' },
      { id: 'desk', text: 'Visit the info desk' },
    ],
  },
  start: { x: 0, z: 4.6, facing: Math.PI, yaw: 0, pitch: 0.22 },
  sun: { dir: [0.35, 3.0, 1.1], extent: 10 },
  camera: { far: 100, dist: 3.0 },
  build: buildLobby,
};

function buildLobby(scene, ctx) {
  const rng = makeRng(77);
  const rand = (a, b) => a + (b - a) * rng();
  const n = GATES.length;
  const span = THREE.MathUtils.degToRad(Math.min(140, 44 * Math.max(1, n - 1)));
  const gateAz = GATES.map((_, i) => (n === 1 ? 0 : -span / 2 + (span * i) / (n - 1)));

  // ---- materials -------------------------------------------------------------------
  const M = {
    floor: ink({ map: LX.floorTexture(R + 0.2, { gates: gateAz.map((a) => onWall(a, R - 0.2)), desk: [DESK.x, DESK.z], viewer: [0, 7.5] }), mapAmt: 0.75, facing: 0.15, hatch: 0.6 }),
    wall: ink({ map: LX.wallPanelTexture(H), mapAmt: 0.75, tone: 0.97, facing: 0.35, hatchFreq: 14, side: THREE.DoubleSide }),
    stone: ink({ tone: 0.95, facing: 0.5, hatchFreq: 14 }),
    trim: ink({ tone: 0.86, facing: 0.5, hatchFreq: 14 }),
    reveal: ink({ tone: 0.78, facing: 0.5, hatchFreq: 14 }),
    ceiling: ink({ tone: 0.97, facing: 0.1, hatch: 0, side: THREE.DoubleSide }),
    vest: ink({ tone: 0.88, facing: 0.5, hatchFreq: 14, side: THREE.DoubleSide }),
    sign: ink({ tone: 0.2, facing: 0.2, hatch: 0 }),
    glow: ink({ tone: 1, facing: 0, hatch: 0 }),
    iron: ink({ tone: 0.18, facing: 0.3, hatch: 0 }),
    ironMid: ink({ tone: 0.38, facing: 0.4, hatch: 0.4 }),
    seat: ink({ tone: 0.5, facing: 0.5, hatchFreq: 24 }),
    wood: ink({ tone: 0.8, facing: 0.6 }),
    desk: ink({ tone: 0.93, facing: 0.5, hatchFreq: 14 }),
    deskTop: ink({ tone: 0.75, facing: 0.4, hatch: 0 }),
    pot: ink({ tone: 0.9, facing: 0.5 }),
    soil: ink({ tone: 0.3, hatch: 0 }),
    leaf: ink({ tone: 0.96, facing: 0.7, hatchFreq: 30, side: THREE.DoubleSide }),
    dark: ink({ tone: 0.22, hatch: 0 }),
    glass: ink({ tone: 0.88, facing: 0.1, hatch: 0 }),
    paper: ink(),
    banner: ink({ map: LX.bannerTexture('Choose Your Next Destination'), facing: 0.15, hatch: 0 }),
    skyBoard: ink({ map: LX.skyBoardTexture(), facing: 0.1, hatch: 0 }),
    clock: ink({ map: LX.clockFaceTexture(), facing: 0.05, hatch: 0 }),
    info: ink({ map: LX.infoTexture(), facing: 0.1, hatch: 0 }),
    exitSign: ink({ map: LX.exitSignTexture(), facing: 0.1, hatch: 0 }),
    jetWall: ink({ map: LX.jetwayWallTexture(), repeat: [TUNNEL.L / 1.4, 1], mapAmt: 0.9, tone: 0.95, facing: 0.3, hatchFreq: 14 }),
    jetFloor: ink({ map: LX.jetwayFloorTexture(), repeat: [1, TUNNEL.L / 2], mapAmt: 0.8, facing: 0.1, hatch: 0 }),
    rib: ink({ tone: 0.6, facing: 0.4, hatch: 0 }),
  };

  const root = new THREE.Group();
  root.name = 'lobby';
  scene.add(root);
  const colliders = [], interactables = [], updaters = [], camBlockers = [];

  // ---- helpers ---------------------------------------------------------------------
  function add(geo, mat, parent = root, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  function box(parent, w, h, d, x, y, z, mat, o = {}) {
    const g = o.r ? new RoundedBoxGeometry(w, h, d, 3, Math.min(o.r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
    const m = add(g, mat, parent, o);
    m.position.set(x, y + h / 2, z);
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    return m;
  }
  function facedBox(parent, w, h, d, x, y, z, base, front, o = {}) {
    const m = add(new THREE.BoxGeometry(w, h, d), [base, base, base, base, front, base], parent, o);
    m.position.set(x, y + h / 2, z);
    return m;
  }
  function cyl(parent, rt, rb, h, x, y, z, mat, o = {}) {
    const m = add(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20, 1, o.open ?? false), mat, parent, o);
    m.position.set(x, y + h / 2, z);
    return m;
  }
  function sphere(parent, r, x, y, z, mat, s = [1, 1, 1], o = {}) {
    const m = add(new THREE.SphereGeometry(r, o.seg ?? 16, Math.round((o.seg ?? 16) * 0.75)), mat, parent, o);
    m.position.set(x, y, z); m.scale.set(...s);
    return m;
  }
  function group(parent, x, y, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g;
  }
  const solid = (x1, x2, z1, z2) => colliders.push({ type: 'box', minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) });
  const solidCircle = (x, z, r) => colliders.push({ type: 'circle', x, z, r });
  // a rounded-top opening (the arch), as a path, centred on x = 0, standing on y0
  function archPath(p, w, h, rr, y0 = 0) {
    p.moveTo(-w / 2, y0); p.lineTo(w / 2, y0); p.lineTo(w / 2, y0 + h - rr);
    p.quadraticCurveTo(w / 2, y0 + h, w / 2 - rr, y0 + h); p.lineTo(-w / 2 + rr, y0 + h);
    p.quadraticCurveTo(-w / 2, y0 + h, -w / 2, y0 + h - rr); p.lineTo(-w / 2, y0);
  }
  function frameGeo(ow, oh, border, depth, rr) {
    const s = new THREE.Shape();
    s.moveTo(-ow / 2 - border, 0); s.lineTo(ow / 2 + border, 0); s.lineTo(ow / 2 + border, oh + border); s.lineTo(-ow / 2 - border, oh + border); s.lineTo(-ow / 2 - border, 0);
    const hole = new THREE.Path(); archPath(hole, ow, oh, rr); s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  }
  // a pot of broad leaves; returns the leaf group (it sways)
  function plant(parent, x, y, z, s = 1) {
    const p = group(parent, x, y, z);
    p.scale.setScalar(s);
    cyl(p, 0.24, 0.18, 0.5, 0, 0, 0, M.pot, { seg: 18 });
    cyl(p, 0.255, 0.255, 0.06, 0, 0.47, 0, M.pot, { seg: 18 });
    cyl(p, 0.22, 0.22, 0.01, 0, 0.5, 0, M.soil, { seg: 18, cast: false });
    const leaves = group(p, 0, 0.5, 0);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand(-0.2, 0.2);
      const st = group(leaves, 0, 0, 0, -a);
      st.rotation.z = rand(0.3, 0.75);
      const len = rand(0.25, 0.5);
      cyl(st, 0.008, 0.01, len, 0, 0, 0, M.iron, { seg: 4 });
      sphere(st, 0.16, 0, len + 0.12, 0, M.leaf, [0.55, 1.35, 0.1], { seg: 12 }).rotation.y = Math.PI / 2;
    }
    const ph = rand(0, 6.28);
    updaters.push((t) => { leaves.rotation.z = Math.sin(t * 0.7 + ph) * 0.025; leaves.rotation.x = Math.sin(t * 0.53 + ph * 1.7) * 0.02; });
    return p;
  }

  // =====================================================================
  // THE HALL: floor, wall with the gate openings, ceiling and lights
  // =====================================================================
  {
    const f = add(new THREE.CircleGeometry(R + 0.2, 96), M.floor, root, { cast: false });
    f.rotation.x = -Math.PI / 2;
    f.userData.noBlock = true;
    // wall pieces between the openings, and a full ring above them; u counts
    // 1.5 m panels round the wall, v the wall's height
    const halfGap = Math.asin((OW / 2 + 0.55) / R);
    const wallPiece = (a0, a1, y0, y1) => {
      const g = new THREE.CylinderGeometry(R, R, y1 - y0, Math.max(4, Math.ceil(((a1 - a0) * 48) / Math.PI)), 1, true, Math.PI - a1, a1 - a0);
      const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (a1 - a0) * R) / 1.5, (p.getY(i) + (y1 - y0) / 2 + y0) / H);
      const m = add(g, M.wall, root, { cast: false });
      m.position.y = (y0 + y1) / 2;
      camBlockers.push(m);
      return m;
    };
    const gaps = gateAz.map((a) => [a - halfGap, a + halfGap]).sort((a, b) => a[0] - b[0]);
    let a = gaps[gaps.length - 1][1] - Math.PI * 2;
    for (const [g0, g1] of gaps) { wallPiece(a, g0, 0, OH + 0.75); a = g1; }
    wallPiece(-Math.PI, Math.PI, OH + 0.75, H);
    // pilasters round the wall, between the gates and the doors
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2 - Math.PI;
      const clear = (b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      if (gateAz.some((b) => clear(b) < halfGap + 0.12) || clear(Math.PI) < 0.3) continue;
      const [x, z] = onWall(a, R - 0.12);
      const pg = group(root, x, 0, z, -a);
      box(pg, 0.42, H - 0.45, 0.2, 0, 0, 0, M.stone, { cast: false });
      box(pg, 0.56, 0.16, 0.28, 0, H - 0.6, 0, M.trim, { cast: false });
      box(pg, 0.52, 0.2, 0.26, 0, 0, 0, M.trim, { cast: false });
    }
    // a cornice ring
    const cornice = add(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.12, 96, 1, true), M.trim, root, { cast: false });
    cornice.position.y = H - 0.26;
    // the boundary: a ring of circles just outside the wall (the gates too: they are entered by checking in)
    for (let k = 0; k < 72; k++) { const [x, z] = onWall((k / 72) * Math.PI * 2, R + 0.45); solidCircle(x, z, 0.8); }
    // ceiling, a dropped ring around the pillar, recessed lights
    const c = add(new THREE.CircleGeometry(R + 0.2, 96), M.ceiling, root, { cast: false });
    c.rotation.x = Math.PI / 2; c.position.y = H;
    const drop = add(new THREE.CylinderGeometry(2.7, 2.7, 0.66, 64, 1, true), M.trim, root, { cast: false });
    drop.position.set(DESK.x, H - 0.33, DESK.z);
    const dropB = add(new THREE.RingGeometry(0.75, 2.7, 64), M.ceiling, root, { cast: false });
    dropB.rotation.x = Math.PI / 2; dropB.position.set(DESK.x, H - 0.66, DESK.z);
    const lights = new Batch();
    const light = (x, z, y, r) => {
      const g = new THREE.CylinderGeometry(r, r, 0.04, 20); g.translate(x, y - 0.02, z); lights.add(g, M.glow, 0.71);
      const t = new THREE.TorusGeometry(r + 0.03, 0.025, 4, 24); t.rotateX(Math.PI / 2); t.translate(x, y - 0.03, z); lights.add(t, M.ironMid, 0.72);
    };
    for (let k = 0; k < 14; k++) { const [x, z] = onWall((k / 14) * Math.PI * 2 + 0.2, 5.9); light(x, z, H, 0.17); }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; light(DESK.x + Math.cos(a) * 1.75, DESK.z + Math.sin(a) * 1.75, H - 0.66, 0.11); }
    lights.flush(root);
  }

  // =====================================================================
  // THE GATES: arch frame, its deep reveal, a short room behind with the
  // view, the sign with its arrow, plants either side
  // =====================================================================
  const gates = GATES.map((g, i) => {
    const az = gateAz[i];
    const [x, z] = onWall(az);
    const dir = az < 0 ? -1 : 1; // the arrow points the way round the hall
    const G = group(root, x, 0, z, -az);         // local +z faces the hall
    // frame (proud of the wall) and the deep reveal into the wall
    const fr = add(frameGeo(OW + 0.36, OH + 0.18, 0.42, 0.34, 0.9), M.stone, G);
    fr.position.set(0, 0, -0.02);
    const rv = add(frameGeo(OW, OH, 0.18, 1.0, 0.75), M.reveal, G);
    rv.position.set(0, 0, -1.0);
    camBlockers.push(fr, rv);
    // a keystone and a plinth line
    box(G, 0.5, 0.42, 0.42, 0, OH + 0.4, 0.17, M.trim);
    // the short gate room behind, flaring out so the view stays in sight from
    // across the hall: floor, sides, ceiling, and the view filling the far wall
    const d0 = -1.0, d1 = -2.9, w0 = OW / 2, w1 = OW / 2 + 0.9, top = OH + 0.25;
    const quad = (a, b, c, d) => {
      const q = new THREE.BufferGeometry();
      q.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
      q.computeVertexNormals();
      add(q, M.vest, G, { cast: false });
    };
    quad([-w0, 0.005, d0], [w0, 0.005, d0], [w1, 0.005, d1], [-w1, 0.005, d1]);
    quad([-w0, top, d0], [w0, top, d0], [w1, top, d1], [-w1, top, d1]);
    for (const sx of [-1, 1]) quad([sx * w0, 0, d0], [sx * w1, 0, d1], [sx * w1, top, d1], [sx * w0, top, d0]);
    const art = ink({ map: ART[g.sceneArt](), facing: 0, hatch: 0 });
    const view = add(new THREE.PlaneGeometry(2 * w1, top), art, G, { cast: false });
    const viewZ = d1 + 0.02;
    view.position.set(0, top / 2, viewZ);
    // the sign over the arch: a dark board, the arrow pulses beside the name
    const signMat = ink({ map: LX.gateSignTexture(g, dir), mapAmt: 1, facing: 0.15, hatch: 0 });
    const sign = group(G, 0, OH + 0.95, 0.42);
    sign.rotation.x = 0.1;
    const SW = 2.9, SH = SW * (320 / 1024);
    facedBox(sign, SW, SH, 0.1, 0, 0, 0, M.sign, signMat, { cast: false });
    const arrowMat = ink({ map: LX.arrowTexture(dir), facing: 0.1, hatch: 0 });
    const arrowX = dir * (SW / 2 - 0.29);
    const arrow = add(new THREE.PlaneGeometry(0.4, 0.4), arrowMat, sign, { cast: false });
    arrow.position.set(arrowX, SH / 2, 0.056);
    for (const sx of [-1, 1]) box(G, 0.05, 0.3, 0.05, sx * 1.1, OH + 0.95 + SH - 0.05, 0.3, M.iron);
    // plants either side of the arch
    for (const sx of [-1, 1]) plant(G, sx * (OW / 2 + 0.95), 0, 0.55, 0.95);
    // its spot on the floor: walk up here to check in
    const [ax, azz] = onWall(az, R - 1.7), [px, pz] = onWall(az, R - 0.3);
    const it = {
      id: `gate-${g.id}`, label: promptFor(g), kind: 'action', x: ax, z: azz, radius: 1.45,
      pos: new THREE.Vector3(px, OH + 0.1, pz), noReach: true,
      act: (c) => checkIn(gateRec, c),
    };
    interactables.push(it);
    const gateRec = { g, az, signMat, arrow, arrowX, view, viewZ, hover: 0, it };
    return gateRec;
  });

  // =====================================================================
  // THE CENTRE: pillar with the clock and the "Same Sky" board, the round info
  // desk with its "i", the banner over the hall
  // =====================================================================
  const clockHands = {};
  let cloudMesh = null;
  {
    const P = group(root, DESK.x, 0, DESK.z);
    const pw = 1.25;
    camBlockers.push(box(P, pw, H, pw, 0, 0, 0, M.stone, { r: 0.08 }));
    for (const y of [0, H - 0.9]) box(P, pw + 0.12, 0.16, pw + 0.12, 0, y, 0, M.trim, { r: 0.03 });
    // the clock, high on the front face
    const cy = 3.95, cz = pw / 2 + 0.02;
    const face = add(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 40), [M.trim, M.clock, M.trim], P);
    face.rotation.x = Math.PI / 2; face.rotation.y = Math.PI; face.position.set(0, cy, cz);
    const bez = add(new THREE.TorusGeometry(0.41, 0.04, 6, 40), M.iron, P);
    bez.position.set(0, cy, cz + 0.03);
    const hand = (len, w, z) => { const g = group(P, 0, cy, cz + z); const m = box(g, w, len, 0.012, 0, -0.04, 0, M.iron, { cast: false }); void m; return g; };
    clockHands.h = hand(0.22, 0.04, 0.035); clockHands.m = hand(0.32, 0.026, 0.045); clockHands.s = hand(0.34, 0.01, 0.055);
    sphere(P, 0.025, 0, cy, cz + 0.06, M.iron, [1, 1, 1], { seg: 8 });
    // the board: a plane, "Different Cities. Same Sky.", a cloud drifting across it
    const bw = 1.0, bh = 2.0, by = 1.45;
    facedBox(P, bw, bh, 0.06, 0, by, pw / 2 + 0.03, M.trim, M.skyBoard, { cast: false });
    const cs = new THREE.Shape();
    cs.moveTo(-0.6, 0); cs.lineTo(0.6, 0);
    cs.absarc(0.42, 0.18, 0.2, -Math.PI / 2, Math.PI * 0.6, false);
    cs.absarc(0.0, 0.32, 0.3, 0.1, Math.PI - 0.1, false);
    cs.absarc(-0.42, 0.16, 0.18, Math.PI * 0.4, Math.PI * 1.5, false);
    const cloud = add(new THREE.ExtrudeGeometry(cs, { depth: 0.02, bevelEnabled: false, curveSegments: 8 }), M.paper, P, { cast: false });
    cloud.scale.setScalar(0.2);
    cloud.position.set(0, by + 0.5, pw / 2 + 0.065);
    cloudMesh = cloud;
    // the desk: a ring segment round the front of the pillar, a lighter top, the "i"
    const sector = (r0, r1, a0, a1) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true);
      return s;
    };
    const a0 = -Math.PI / 2 - 1.85, a1 = -Math.PI / 2 + 1.85;
    const body = add(new THREE.ExtrudeGeometry(sector(1.55, 1.9, a0, a1), { depth: 0.95, bevelEnabled: false, curveSegments: 40 }), [M.desk, M.desk], P);
    body.rotation.x = -Math.PI / 2;
    camBlockers.push(body);
    const top = add(new THREE.ExtrudeGeometry(sector(1.48, 1.98, a0 - 0.03, a1 + 0.03), { depth: 0.07, bevelEnabled: false, curveSegments: 40 }), [M.deskTop, M.deskTop], P);
    top.rotation.x = -Math.PI / 2; top.position.y = 0.95;
    const kick = add(new THREE.ExtrudeGeometry(sector(1.5, 1.86, a0, a1), { depth: 0.12, bevelEnabled: false, curveSegments: 40 }), [M.iron, M.iron], P, { cast: false });
    kick.rotation.x = -Math.PI / 2;
    const medGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 32);
    medGeo.rotateY(-Math.PI / 2); // turns the cap's drawing upright once the disc faces the hall
    const med = add(medGeo, [M.sign, M.info, M.sign], P, { cast: false });
    med.rotation.x = Math.PI / 2; med.rotation.y = Math.PI; med.position.set(0, 0.52, 1.91);
    // a screen, a bell, two plants on the counter
    const scr = group(P, 0.3, 1.02, 1.45, -0.15);
    box(scr, 0.08, 0.16, 0.08, 0, 0, 0, M.iron);
    box(scr, 0.5, 0.32, 0.04, 0, 0.16, 0, M.iron, { rx: -0.12 });
    cyl(P, 0.05, 0.06, 0.04, -0.35, 1.02, 1.7, M.iron, { seg: 12 });
    sphere(P, 0.04, -0.35, 1.07, 1.7, M.ironMid, [1, 0.8, 1], { seg: 10 });
    plant(P, -1.25, 1.02, 1.1, 0.75);
    plant(P, 1.25, 1.02, 1.1, 0.75);
    solidCircle(DESK.x, DESK.z, 2.05);
    // the banner across the hall, hung from the ceiling in front of the pillar
    const ban = group(root, 0, 4.0, DESK.z + 3.3);
    facedBox(ban, 4.6, 0.58, 0.08, 0, 0, 0, M.sign, M.banner, { cast: false });
    for (const sx of [-1, 1]) cyl(ban, 0.015, 0.015, H - 4.58, sx * 1.9, 0.58, 0, M.iron, { seg: 5, cast: false });
  }

  // =====================================================================
  // DRESSING: rows of seats (left), luggage carts (right), the doors home (behind)
  // =====================================================================
  // a beam of four seats facing +x (local), the first seat at the origin
  function seatRow(x, z, ry) {
    const g = group(root, x, 0, z, ry);
    const n2 = 4, sw = 0.56, L = n2 * sw;
    box(g, 0.08, 0.06, L + 0.1, -0.05, 0.3, 0, M.iron);
    for (const sz of [-L / 2 + 0.1, L / 2 - 0.1]) { box(g, 0.06, 0.3, 0.06, -0.05, 0, sz, M.iron); box(g, 0.5, 0.03, 0.08, -0.05, 0, sz, M.iron); }
    for (let k = 0; k < n2; k++) {
      const zz = -L / 2 + (k + 0.5) * sw;
      box(g, 0.48, 0.07, 0.5, 0.02, 0.38, zz, M.seat, { r: 0.03 });
      const back = box(g, 0.07, 0.5, 0.5, -0.23, 0.45, zz, M.seat, { r: 0.03 });
      back.rotation.z = 0.1;
    }
    for (let k = 0; k <= n2; k++) { const zz = -L / 2 + k * sw; box(g, 0.36, 0.04, 0.04, 0.0, 0.6, zz, M.iron); box(g, 0.04, 0.2, 0.04, 0.14, 0.4, zz, M.iron); }
    return { g, L };
  }
  const SEATS = [[-5.0, 2.2], [-6.3, 2.2]]; // two rows, one behind the other, facing the hall
  for (const [x, z] of SEATS) {
    seatRow(x, z, 0);
    solid(x - 0.35, x + 0.3, z - 1.2, z + 1.2);
  }
  // luggage carts nested in a row, handles toward the hall
  function cart(x, z, ry) {
    const g = group(root, x, 0, z, ry);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = add(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), M.iron, g); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.26, 0.08, sz * 0.38);
    }
    box(g, 0.6, 0.04, 0.9, 0, 0.15, 0, M.ironMid);
    // the wire basket: a rim, corner posts and a few rails
    for (const sx of [-1, 1]) { box(g, 0.025, 0.025, 0.85, sx * 0.29, 0.62, 0.02, M.iron); box(g, 0.025, 0.025, 0.85, sx * 0.29, 0.38, 0.02, M.iron); }
    for (const sz of [-0.42, 0.44]) box(g, 0.6, 0.025, 0.025, 0, 0.62, sz, M.iron);
    for (const sx of [-1, 1]) for (const sz of [-0.42, 0.44]) box(g, 0.025, 0.47, 0.025, sx * 0.29, 0.17, sz, M.iron);
    for (let k = 0; k < 5; k++) box(g, 0.015, 0.24, 0.015, -0.29, 0.38, -0.36 + k * 0.18, M.iron, { cast: false });
    // handle frame rising at the back
    for (const sx of [-1, 1]) { const u = box(g, 0.03, 0.75, 0.03, sx * 0.27, 0.17, 0.5, M.iron); u.rotation.x = -0.18; }
    const hb = add(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10), M.dark, g); hb.rotation.z = Math.PI / 2; hb.position.set(0, 0.93, 0.62);
    return g;
  }
  for (let k = 0; k < 3; k++) cart(5.3 + k * 0.05, 1.3 + k * 0.42, Math.PI + 0.12);
  solid(4.9, 5.75, 0.7, 2.9);
  plant(root, 6.3, 0, 3.6, 1.15); solidCircle(6.3, 3.6, 0.32);
  plant(root, -6.4, 0, -0.4, 1.15); solidCircle(-6.4, -0.4, 0.32);
  // the doors home behind the start: glass doors in a frame, the exit sign
  {
    const G = group(root, 0, 0, R - 0.02, Math.PI);
    box(G, 3.2, 0.2, 0.3, 0, 2.7, 0, M.trim);
    for (const sx of [-1, 1]) box(G, 0.18, 2.9, 0.3, sx * 1.55, 0, 0, M.trim);
    for (const sx of [-1, 1]) {
      box(G, 1.36, 2.56, 0.04, sx * 0.72, 0.07, 0.05, M.glass, { cast: false });
      for (const [w, h, x, y] of [[1.44, 0.08, 0, 0.03], [1.44, 0.08, 0, 2.6], [0.08, 2.65, -0.68, 0.03], [0.08, 2.65, 0.68, 0.03], [1.44, 0.05, 0, 1.05]]) box(G, w, h, 0.07, sx * 0.72 + x, y, 0.06, M.ironMid, { cast: false });
    }
    for (const sx of [-1, 1]) box(G, 0.04, 0.5, 0.06, sx * 0.12, 1.0, 0.1, M.iron);
    facedBox(G, 1.4, 0.44, 0.08, 0, 3.05, 0.12, M.sign, M.exitSign, { cast: false });
    interactables.push({ id: 'home', label: 'Head home', kind: 'action', x: 0, z: R - 1.3, radius: 1.1, pos: new THREE.Vector3(0, 2.2, R - 0.3), act: (c) => c.travel('room') });
  }
  // the seats can be sat on (one spot per row)
  SEATS.forEach(([x, z], i) => {
    interactables.push({
      id: `seat${i}`, label: 'Sit down', kind: 'seat', x: x + 0.8, z, radius: 0.8, pos: new THREE.Vector3(x, 1.0, z),
      seat: { seat: [x + 0.02, 0.28, z + 0.28], exit: [x + 0.85, z + 0.28], via: [], pose: 'sit', facing: Math.PI / 2, caption: 'Plenty of time before boarding.', cam: { yaw: -Math.PI / 2 + 0.5, pitch: 0.18, dist: 3.0 } },
    });
  });
  // the info desk
  interactables.push({ id: 'desk', label: 'Ask at the info desk', kind: 'action', x: DESK.x, z: DESK.z + 2.75, radius: 1.1, pos: new THREE.Vector3(DESK.x, 1.55, DESK.z + 1.9), act: () => openCard('help') });

  // =====================================================================
  // THE JETWAY (out of sight behind the hall): a straight corridor of ribs
  // and windows, the light at the far end
  // =====================================================================
  const tun = group(root, 0, 0, TUNNEL.z0);
  {
    const { L } = TUNNEL, w = 2.5, h = 2.45;
    box(tun, w, 0.06, L, 0, -0.06, L / 2, M.jetFloor, { cast: false });
    for (const sx of [-1, 1]) {
      box(tun, 0.08, h, L, sx * (w / 2 + 0.04), 0, L / 2, M.jetWall, { cast: false });
    }
    box(tun, w, 0.08, L, 0, h, L / 2, M.trim, { cast: false });
    const ribs = new Batch();
    for (let zz = 0.7; zz < L - 0.5; zz += 1.4) {
      const g = frameGeo(w - 0.04, h - 0.1, 0.16, 0.16, 0.55); g.translate(0, 0, zz); ribs.add(g, M.rib, 0.31 + (zz % 3) * 0.01);
      const l = new THREE.BoxGeometry(0.9, 0.03, 0.4); l.translate(0, h - 0.04, zz + 0.7); ribs.add(l, M.glow, 0.4);
    }
    ribs.flush(tun);
    // the door at the end, full of light
    const end = add(new THREE.PlaneGeometry(w, h), M.glow, tun, { cast: false });
    end.position.set(0, h / 2, L);
    end.rotation.y = Math.PI;
    end.visible = true;
    tun.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noBlock = true; } });
  }

  // =====================================================================
  // HUD: the help card, the "coming soon" card, the jetway's light
  // =====================================================================
  const hud = document.getElementById('hud');
  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; parent?.appendChild(e); return e; };
  const flash = el('div', '', document.body); flash.id = 'lb-flash';
  const card = el('div', 'lb-card hidden', hud); card.id = 'lb-card';
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
  let cardKind = null, cardTimer = 0, cardGate = null;
  const renderCard = () => {
    if (!cardKind) return;
    card.replaceChildren();
    const title = el('div', 'title', card);
    if (cardKind === 'help') {
      const b = el('span', 'badge', title); b.textContent = 'i';
      title.append(tr('How this works'));
      const ol = el('ol', '', card);
      for (const line of HELP) el('li', '', ol).textContent = tr(line);
    } else {
      title.textContent = tr('Coming soon');
      el('p', '', card).textContent = tr(cardGate?.id === 'next' ? 'More gates opening soon.' : '{city}: this gate opens soon.', { city: tr(cardGate?.nameEn ?? '') });
    }
    const more = el('div', 'more', card);
    const [a, b] = tr('press {key} to close').split('{key}');
    const k = document.createElement('kbd'); k.textContent = 'E';
    more.append(a ?? '', k, b ?? '');
  };
  // the gates as buttons, left to right: Tab reaches them (shown while focused), Enter checks in
  const nav = el('nav', 'lb-gates', hud);
  nav.id = 'lb-gates';
  const navTitle = el('div', 'title', nav);
  const gateBtns = gates.map((r) => {
    const b = el('button', '', nav);
    b.type = 'button';
    b.addEventListener('click', () => { b.blur(); if (!seq) checkIn(r, ctx); });
    return b;
  });
  const renderNav = () => {
    nav.setAttribute('aria-label', tr('Gates'));
    navTitle.textContent = tr('Gates');
    gates.forEach((r, i) => {
      const label = tr(promptFor(r.g));
      gateBtns[i].setAttribute('aria-label', label);
      gateBtns[i].textContent = `${r.g.nameEn} ${r.g.nameZh}`;
      gateBtns[i].title = label;
    });
  };
  renderNav();
  const HELP = ['Walk up to a gate and press E to check in.', 'Walk through the jetway to fly to that city.', 'Every city has a signpost back to the airport.', 'The doors behind you lead home.'];
  function openCard(kind, gate = null) {
    cardKind = kind; cardGate = gate; cardTimer = kind === 'help' ? 12 : 6;
    renderCard();
    card.classList.remove('hidden');
    if (kind === 'help') ctx.complete('desk');
    ctx.sound('chime');
  }
  function closeCard() { cardKind = null; card.classList.add('hidden'); }
  const offLang = onLang(() => { renderCard(); renderNav(); });

  // =====================================================================
  // CHECKING IN: walk into the arch, push in, the jetway, land
  // =====================================================================
  let seq = null; // { gate, phase: 'walk' | 'push' | 'tunnel', t, from, to }
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function remember(g) { try { localStorage.setItem(LAST_GATE, g.id); } catch { /* storage unavailable */ } }
  function land(c) {
    const g = seq?.gate.g;
    if (!g) return;
    seq.phase = 'done';
    flash.classList.remove('snap'); flash.classList.add('on');
    c.travel(g.route, { quick: true, paper: true });
  }
  function checkIn(rec, c) {
    const { g, az } = rec;
    if (seq) return;
    if (!g.enabled || !g.route) { openCard('soon', g); return; }
    closeCard();
    remember(g);
    c.complete('gate');
    if (reducedMotion()) { c.travel(g.route, { quick: true }); return; }
    c.sound('chime');
    seq = { gate: rec, phase: 'walk', t: 0 };
    // look at the gate, walk up to the arch and through it; from elsewhere in
    // the hall (a gate picked from the list) go round the desk first
    c.pan({ yaw: Math.atan2(-Math.sin(az), Math.cos(az)), pitch: 0.12, dist: 3.0, rate: 2.4, lock: 30, lookUp: 0.35 });
    const route = [];
    const p = c.player.pos;
    if (Math.hypot(p.x - rec.it.x, p.z - rec.it.z) > rec.it.radius) {
      const RR = 4.6, a0 = Math.atan2(p.x, -p.z), da = Math.atan2(Math.sin(az - a0), Math.cos(az - a0));
      if (Math.hypot(p.x, p.z) < RR) route.push(onWall(a0, RR));
      for (let k = 1; k <= Math.ceil(Math.abs(da) / 0.35); k++) route.push(onWall(a0 + (da * k) / Math.ceil(Math.abs(da) / 0.35), RR));
    }
    c.walk([...route, onWall(az, R - 1.25), onWall(az, R - 0.1)], {
      speed: 2.0,
      onArrive: (cc) => {
        if (!seq || seq.phase !== 'walk') return;
        seq.phase = 'push'; seq.t = 0;
        seq.from = cc.camera.position.clone();
        seq.look = new THREE.Vector3();
        cc.camera.getWorldDirection(seq.look).multiplyScalar(4).add(seq.from);
        cc.walk([onWall(az, R + 1.5)], { speed: 1.6 });
      },
    });
  }
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  function cameraControl(camera, dt) {
    if (!seq || seq.phase === 'walk') return false;
    seq.t += dt;
    const { az } = seq.gate;
    if (seq.phase === 'push') {
      // over the traveler's head, into the arch, toward the view
      const k = ease(Math.min(1, seq.t / 0.6));
      const [tx, tz] = onWall(az, R + 2.3), [lx, lz] = onWall(az, R + 4.3);
      camera.position.lerpVectors(seq.from, tmpA.set(tx, 1.95, tz), k);
      camera.lookAt(tmpB.lerpVectors(seq.look, tmpA.set(lx, 1.45, lz), k));
      if (seq.t >= 0.6) {
        // a blink of paper, and we are in the jetway
        flash.classList.add('snap', 'on');
        requestAnimationFrame(() => requestAnimationFrame(() => { flash.classList.remove('snap'); flash.classList.remove('on'); }));
        seq.phase = 'tunnel'; seq.t = 0;
      }
      return true;
    }
    if (seq.phase === 'tunnel' || seq.phase === 'done') {
      const T = 1.55, k = ease(Math.min(1, seq.t / T));
      const z = TUNNEL.z0 + 0.4 + k * (TUNNEL.L - 2.2);
      camera.position.set(Math.sin(seq.t * 9) * 0.006, 1.3 + Math.sin(seq.t * 11) * 0.008, z);
      camera.lookAt(0, 1.25, z + 5);
      if (seq.phase === 'tunnel' && seq.t > T - 0.32) land(ctx);
      return true;
    }
    return false;
  }
  function onKey(code, c) {
    if (seq && seq.phase !== 'done' && (code === 'KeyE' || code === 'Escape' || code === 'Space' || code === 'Enter')) { land(c); return true; }
    if (seq) return true;
    if (cardKind && (code === 'KeyE' || code === 'Escape')) { closeCard(); return true; }
    return false;
  }

  // =====================================================================
  // START: in front of the gate you came back through (or the last one chosen)
  // =====================================================================
  let start = null;
  {
    let lastId = null;
    try { lastId = localStorage.getItem(LAST_GATE); } catch { /* storage unavailable */ }
    // the gate of the city you came back from, else the last one you chose
    const back = gates.find((r) => r.g.route && r.g.route === ctx.prevScene) ?? gates.find((r) => r.g.id === lastId);
    if (back) {
      const [x, z] = onWall(back.az, R - 2.6);
      start = { x, z, facing: Math.atan2(-x, -z), yaw: Math.atan2(x, z), pitch: 0.2 };
    }
  }

  // ---- per frame --------------------------------------------------------------------
  function update(t, dt, c) {
    for (const u of updaters) u(t, dt, c);
    const p = c.player.pos;
    // the gate you stand at: sign brightens, arrow pulses, the view comes forward
    for (const r of gates) {
      const near = !seq && Math.hypot(p.x - r.it.x, p.z - r.it.z) < r.it.radius;
      const want = near || seq?.gate === r ? 1 : 0;
      r.hover += (want - r.hover) * (1 - Math.exp(-dt * 6));
      r.signMat.userData.ink.uMapAmt.value = 1 - 0.22 * r.hover;
      const pulse = Math.sin(t * 6.5) * 0.5 + 0.5;
      const dirSign = Math.sign(r.arrowX);
      r.arrow.position.x = r.arrowX + dirSign * 0.05 * pulse * r.hover;
      r.arrow.scale.setScalar(1 + 0.12 * pulse * r.hover);
      r.view.position.z = r.viewZ + 0.3 * r.hover;
    }
    // the clock (real time, the second hand ticks), the cloud drifts across the board
    const now = new Date();
    const sec = now.getSeconds(), min = now.getMinutes() + sec / 60, hr = (now.getHours() % 12) + min / 60;
    clockHands.s.rotation.z = -(sec / 60) * Math.PI * 2;
    clockHands.m.rotation.z = -(min / 60) * Math.PI * 2;
    clockHands.h.rotation.z = -(hr / 12) * Math.PI * 2;
    const u = (t * 0.035) % 1;
    cloudMesh.position.x = -0.3 + u * 0.6;
    cloudMesh.scale.setScalar(0.2 * Math.min(1, Math.sin(u * Math.PI) * 4));
    // cards close on their own, or when you walk away
    if (cardKind) {
      cardTimer -= dt;
      const at = cardKind === 'help' ? [DESK.x, DESK.z + 2.75] : [cardGate ? gates.find((r) => r.g === cardGate).it.x : 0, cardGate ? gates.find((r) => r.g === cardGate).it.z : 0];
      if (cardTimer <= 0 || Math.hypot(p.x - at[0], p.z - at[1]) > 2.6) closeCard();
    }
  }

  return {
    root,
    colliders,
    camBlockers,
    interactables,
    stars: [],
    start,
    update,
    viewAt: () => ({ dist: 3.0 }),
    busy: () => !!seq,
    cameraControl,
    onKey,
    strings: ['Gates', 'How this works', ...HELP, 'Coming soon', 'More gates opening soon.', '{city}: this gate opens soon.', 'Santa Clara', 'Arriving in {place}', 'Arriving at the airport', ...GATES.map(promptFor)],
    debug: () => ({ seq: seq ? { gate: seq.gate.g.id, phase: seq.phase } : null, card: cardKind, hover: gates.map((r) => +r.hover.toFixed(2)), gates: GATES.map((g) => g.id) }),
    dispose() { offLang(); flash.remove(); card.remove(); nav.remove(); },
  };
}
