import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ink, backdropMaterial, inkShared } from '../ink.js';
import { makeRng } from '../sketch.js';
import { createCharacter } from '../character.js';
import * as TW from '../taiwanTextures.js';
import * as TX from '../shanghaiTextures.js';
import { t as tr, onLang } from '../i18n.js';

// Chapter 2: Shanghai — the Bund promenade, looking across the Huangpu River
// at the Pudong skyline.
//
// Layout (meters; x along the river, -z across the water toward Pudong, y up):
//
//   z -3.3 .. -2.95   granite coping + the iron railing (hard boundary)
//   z -2.95 .. 7.2    the paved promenade, x -18.2 .. 16.2
//                     benches, lamps, viewpoint, photo spot, life ring, bin
//   x 9.5 .. 16, z 1.6 .. 7.2   Bund Coffee (enterable, barista at the counter)
//   z 7.2             stone balustrade; below it the road and the old Bund buildings
//   z -3.3 .. -140    the river (ferries); z -140 the Pudong embankment
//   z -150 .. -700    Pudong: Oriental Pearl Tower, Jin Mao, SWFC, Shanghai Tower, the city
//
// The walkable ground is flat; heightAt() marks everything outside the
// promenade as "no ground", and colliders hold the railing, so the river can
// never be entered.

const RAIL_Z = -2.95, EDGE_Z = -3.3, LAND_Z = 7.2, WEST_X = -18.2, EAST_X = 16.2;
const CAFE = { x0: 9.5, x1: 16.0, z0: 1.6, z1: 7.2, H: 3.5 };
const WATER_Y = -1.7, SHORE_Z = -140, SHORE_Y = 1.2, ROAD_Y = -3.4;
const OFF = -100;

export function heightAt(x, z) {
  if (x < WEST_X - 0.4 || x > EAST_X + 0.4 || z < EDGE_Z || z > LAND_Z + 0.3) return OFF;
  return 0;
}
const inCafe = (x, z) => x > CAFE.x0 + 0.15 && x < CAFE.x1 - 0.15 && z > CAFE.z0 + 0.1 && z < CAFE.z1 - 0.15;

// skyline landmarks: azimuth from the promenade (deg; 0 = straight across, + = right) and distance
// (set so that from the promenade the Shanghai Tower rises about 23 degrees,
// the Pearl 21, the SWFC 19 and Jin Mao 17, with sky left above them)
const SKY = {
  pearl: { az: -11, d: 345, hw: 3.6 },
  jinmao: { az: 8.5, d: 450, hw: 2.2 },
  tower: { az: 15, d: 470, hw: 2.4 },
  swfc: { az: 20.5, d: 445, hw: 2.0 },
};
const SKYLINE_AZ = 2; // the middle of the view across the river
const dirAt = (az) => { const a = THREE.MathUtils.degToRad(az); return [Math.sin(a), -Math.cos(a)]; };
const at = (az, d) => { const [dx, dz] = dirAt(az); return [dx * d, dz * d]; };

// the photo album lives for the whole session (it survives trips home and back)
const album = [];

export default {
  id: 'shanghai',
  name: 'Shanghai',
  travelText: 'Traveling to Shanghai…',
  hud: {
    title: 'Objective:',
    style: 'single',
    map: 'compass',
    objectives: [
      { id: 'explore', text: 'Explore the waterfront' },
      { id: 'cafe', text: 'Find the café' },
      { id: 'photo', text: 'Take a photo' },
    ],
  },
  start: { x: 0, z: 3.4, facing: Math.PI, yaw: 0, pitch: 0.05 },
  sun: { dir: [-0.55, 2.3, 1.35], extent: 15, follow: true, far: 60 },
  camera: { far: 2600, dist: 3.0 },
  render: { grazeFix: 1 },
  build: buildShanghai,
};

function buildShanghai(scene) {
  const rng = makeRng(2024);
  const rand = (a, b) => a + (b - a) * rng();

  // ---- materials -----------------------------------------------------------------
  const signCache = new Map();
  const signMat = (text, o = {}) => {
    const key = text + JSON.stringify(o);
    if (!signCache.has(key)) signCache.set(key, ink({ map: TW.signTexture(text, o), facing: 0.2, hatch: 0.4 }));
    return signCache.get(key);
  };
  const far = (o) => ink({ facing: 0.5, hatchFreq: 0.35, tone: 1, ...o });
  const M = {
    paving: ink({ map: TX.tileTexture(), tri: 1 / 2, facing: 0.25, mapAmt: 0.75, hatch: 0.7 }),
    kerb: ink({ map: TX.kerbTexture(), tri: 1 / 2.4, facing: 0.5, mapAmt: 0.8, tone: 0.92 }),
    wallStone: ink({ map: TW.stoneBlockTexture(), tri: 1 / 1.6, facing: 0.5, mapAmt: 0.8, tone: 0.86 }),
    stone: ink({ tone: 0.9, facing: 0.5 }),
    iron: ink({ tone: 0.14, facing: 0.3, hatch: 0 }),
    ironMid: ink({ tone: 0.32, facing: 0.4, hatch: 0.4 }),
    wood: ink({ tone: 0.8, facing: 0.6 }),
    woodDark: ink({ tone: 0.42, facing: 0.5, hatch: 0.6 }),
    frame: ink({ tone: 0.28, facing: 0.4, hatch: 0.5 }),
    paper: ink(),
    paper2: ink({ side: THREE.DoubleSide }),
    light: ink({ tone: 0.94 }),
    gray: ink({ tone: 0.78 }),
    mid: ink({ tone: 0.55 }),
    dark: ink({ tone: 0.2, hatch: 0 }),
    black: ink({ tone: 0.04, hatch: 0 }),
    glow: ink({ tone: 1, facing: 0, hatch: 0 }),
    leaf: ink({ tone: 0.96, facing: 0.7, hatchFreq: 30 }),
    soil: ink({ tone: 0.3, hatch: 0 }),
    plaster: ink({ map: TW.plasterTexture(), tri: 1 / 3, facing: 0.5, mapAmt: 0.7, tone: 0.97 }),
    floor: ink({ map: TW.boardsTexture(), tri: 1 / 2, facing: 0.3, mapAmt: 0.6, tone: 0.92, hatch: 0.6 }),
    boardsDark: ink({ map: TW.boardsTexture(44), tri: 1 / 2.0, facing: 0.6, mapAmt: 0.9, tone: 0.62 }),
    road: ink({ tone: 0.8, facing: 0, hatch: 0 }),
    leafFar: ink({ tone: 0.97, facing: 0.6, hatchFreq: 3 }),
    lifeRing: ink({ map: TX.lifeRingTexture(), repeat: [1, 1], facing: 0.5, hatchFreq: 40 }),
    coffee: ink({ map: TX.coffeeSignTexture(), facing: 0.2, hatch: 0.3 }),
    fascia: ink({ map: TX.fasciaTexture(), facing: 0.2, hatch: 0.3 }),
    menuA: ink({ map: TX.menuTexture(['MENU', 'Espresso', 'Americano', 'Latte', 'Mocha', 'Tea']), facing: 0 }),
    menuB: ink({ map: TX.menuTexture(['CAKES', 'Egg tart', 'Scone', 'Cookie', 'Croissant'], 366), facing: 0 }),
    awning: ink({ map: TX.awningTexture(), facing: 0.35, side: THREE.DoubleSide }),
    photoSign: ink({ map: TX.photoSignTexture(), facing: 0.1, hatch: 0.3 }),
    plaque: ink({ map: TX.plaqueTexture(), facing: 0.1, hatch: 0.3 }),
    bund: ink({ map: TX.verticalSign('外灘'), facing: 0.2, hatch: 0.3 }),
    boatWin: ink({ map: TX.boatWindowTexture(), repeat: [3, 1], facing: 0.4, hatchFreq: 2 }),
    boat: ink({ tone: 0.98, facing: 0.5, hatchFreq: 2 }),
    hull: ink({ tone: 0.55, facing: 0.4, hatchFreq: 2.5 }),
    boatDark: ink({ tone: 0.3, facing: 0.4, hatch: 0 }),
    gull: ink({ tone: 1, facing: 0.5, local: true, hatchFreq: 40 }),
    gullWing: ink({ tone: 0.6, facing: 0.5, local: true, hatchFreq: 40 }),
    bird: ink({ tone: 0.15, hatch: 0, side: THREE.DoubleSide }),
    // far field (very low hatch frequency so it never turns into moire)
    fGrid: far({ map: TX.towerTexture('grid', 311), tri: 1 / 14, mapAmt: 0.5 }),
    fGrid2: far({ map: TX.towerTexture('grid', 313), tri: 1 / 12, mapAmt: 0.5, tone: 0.86 }),
    fBands: far({ map: TX.towerTexture('bands', 315), tri: 1 / 16, mapAmt: 0.45, tone: 0.94 }),
    fVert: far({ map: TX.towerTexture('vert', 317), tri: 1 / 14, mapAmt: 0.45 }),
    fFine: far({ map: TX.towerTexture('fine', 319), tri: 1 / 10, mapAmt: 0.4 }),
    fPlain: far({ tone: 0.97 }),
    fDark: far({ tone: 0.5 }),
    fTree: far({ tone: 0.95, hatchFreq: 0.8 }),
    fGround: far({ tone: 0.95, facing: 0, hatch: 0 }),
    fShore: far({ map: TW.stoneBlockTexture(), tri: 1 / 3, mapAmt: 0.6, tone: 0.85 }),
    spiral: far({ map: TX.spiralTowerTexture(), mapAmt: 0.5, tone: 0.98, facing: 0.55 }),
    pearl: far({ map: TX.pearlTexture(), mapAmt: 0.7, tone: 0.96, facing: 0.65, hatchFreq: 0.7 }),
    concrete: far({ tone: 0.93, facing: 0.55, hatchFreq: 0.6 }),
    trim: far({ tone: 0.55, facing: 0.4, hatchFreq: 0.6 }),
    facades: [341, 343, 345, 347].map((s, i) => far({ map: TX.facadeTexture(s, { floors: 5 + (i % 2), cols: 6 + i }), facing: 0.4, hatchFreq: 0.8, tone: i % 2 ? 0.92 : 0.98 })),
    bundStone: far({ tone: 0.9, facing: 0.5, hatchFreq: 0.8 }),
    bundRoof: far({ tone: 0.5, facing: 0.5, hatchFreq: 0.8 }),
  };

  const root = new THREE.Group();
  root.name = 'shanghai';
  scene.add(root);
  const colliders = [];
  const interactables = [];
  const updaters = [];
  const stars = [];
  const npcs = [];

  // ---- helpers ------------------------------------------------------------------
  function add(geo, mat, parent = root, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  function box(parent, w, h, d, x, y, z, mat, o = {}) {
    const g = o.r ? new RoundedBoxGeometry(w, h, d, o.seg ?? 3, Math.min(o.r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
    const m = add(g, mat, parent, o);
    m.position.set(x, y + h / 2, z);
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    return m;
  }
  function facedBox(parent, w, h, d, x, y, z, base, front, faces = [4], o = {}) {
    const mats = [base, base, base, base, base, base];
    for (const f of faces) mats[f] = front;
    const m = add(new THREE.BoxGeometry(w, h, d), mats, parent, o);
    m.position.set(x, y + h / 2, z);
    if (o.ry) m.rotation.y = o.ry;
    return m;
  }
  function cyl(parent, rt, rb, h, x, y, z, mat, o = {}) {
    const m = add(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20, 1, o.open ?? false), mat, parent, o);
    m.position.set(x, y + h / 2, z);
    return m;
  }
  function sphere(parent, r, x, y, z, mat, s = [1, 1, 1], o = {}) {
    const m = add(new THREE.SphereGeometry(r, o.seg ?? 20, Math.round((o.seg ?? 20) * 0.75)), mat, parent, o);
    m.position.set(x, y, z);
    m.scale.set(...s);
    return m;
  }
  function torus(parent, R, r, x, y, z, mat, o = {}) {
    const m = add(new THREE.TorusGeometry(R, r, o.tseg ?? 8, o.seg ?? 24, o.arc ?? Math.PI * 2), mat, parent, o);
    m.position.set(x, y, z);
    return m;
  }
  function group(parent, x, y, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    parent.add(g);
    return g;
  }
  // a rod between two points
  const UP = new THREE.Vector3(0, 1, 0);
  function strut(parent, a, b, r0, r1, mat, o = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const m = add(new THREE.CylinderGeometry(r1, r0, len, o.seg ?? 10), mat, parent, o);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
    return m;
  }
  const withId = (geo, id) => { geo.setAttribute('inkIdAttr', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count).fill(id), 1)); return geo; };
  const solid = (x1, x2, z1, z2) => colliders.push({ type: 'box', minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) });
  const solidCircle = (x, z, r) => colliders.push({ type: 'circle', x, z, r });
  function actionSpot(id, label, { x, z, radius = 1.0, prompt, act, noReach }) {
    const it = { id, label, kind: 'action', x, z, radius, pos: new THREE.Vector3(...prompt), act, noReach };
    interactables.push(it);
    return it;
  }
  // Bake a built group into per-material merged geometry (one draw call per
  // material for the far repeats); each baked group keeps its own outline id.
  function bake(parts, obj, id) {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      withId(g, id ?? (0.05 + rng() * 0.95));
      if (!parts.has(o.material)) parts.set(o.material, []);
      parts.get(o.material).push(g);
    });
    obj.parent?.remove(obj);
  }
  function flush(parts, o = {}) {
    for (const [mat, geos] of parts) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.castShadow = o.cast ?? false;
      m.receiveShadow = o.receive ?? false;
      m.userData.noBlock = true;
      if (o.far) m.userData.farField = true;
      root.add(m);
    }
    parts.clear();
  }

  // =====================================================================
  // THE PROMENADE: paving, coping, retaining wall, the railing
  // =====================================================================
  // paving (the café has its own wooden floor), long enough to read as the Bund continuing both ways
  box(root, 800, 0.6, LAND_Z - EDGE_Z + 0.25, 0, -0.6, (LAND_Z + EDGE_Z) / 2 + 0.12, M.paving, { cast: false }).userData.noBlock = true;
  // granite coping along the river edge + the flood wall down to the water
  box(root, 800, 0.08, 0.42, 0, 0, -3.09, M.kerb, { cast: false }).userData.noBlock = true;
  box(root, 800, -WATER_Y + 1.0, 0.5, 0, WATER_Y - 1.0, EDGE_Z - 0.2, M.wallStone, { cast: false }).userData.noBlock = true;
  box(root, 800, 0.16, 0.14, 0, -0.62, EDGE_Z - 0.48, M.kerb, { cast: false }).userData.noBlock = true; // a lip on the wall face

  // the iron railing: round posts with ball tops, two tube rails (one long run, baked)
  {
    const parts = new Map();
    const span = 1.5;
    for (let x = -399; x <= 399; x += span) {
      const near = Math.abs(x) < 40;
      const g = group(root, x, 0.08, RAIL_Z);
      cyl(g, 0.034, 0.04, 1.0, 0, 0, 0, M.iron, { seg: near ? 12 : 6 });
      sphere(g, 0.058, 0, 1.06, 0, M.iron, [1, 1, 1], { seg: near ? 12 : 6 });
      cyl(g, 0.07, 0.08, 0.06, 0, 0, 0, M.iron, { seg: near ? 12 : 6 });
      if (near) torus(g, 0.045, 0.012, 0, 0.98, 0, M.iron, { seg: 12, tseg: 4 }).rotation.x = Math.PI / 2;
      bake(parts, g, 0.31);
    }
    for (const y of [0.52, 0.94]) {
      const r = cyl(root, 0.026, 0.026, 798, 0, 0.08 + y, RAIL_Z, M.iron, { seg: 10 });
      r.rotation.z = Math.PI / 2;
      r.position.y = 0.08 + y;
      bake(parts, r, 0.37);
    }
    flush(parts, { cast: true, receive: false });
    // hard boundary: the railing and the whole river behind it
    solid(-400, 400, -300, RAIL_Z + 0.07);
  }

  // ends of the walkable stretch: granite planters with shrubs (the promenade continues beyond)
  function planterWall(x0, x1, z0, z1) {
    const w = x1 - x0, d = z1 - z0;
    box(root, w, 0.75, d, (x0 + x1) / 2, 0, (z0 + z1) / 2, M.kerb);
    box(root, w + 0.08, 0.06, d + 0.08, (x0 + x1) / 2, 0.75, (z0 + z1) / 2, M.stone);
    box(root, w - 0.12, 0.05, d - 0.12, (x0 + x1) / 2, 0.76, (z0 + z1) / 2, M.soil, { cast: false });
    const n = Math.max(2, Math.round(d / 0.7));
    for (let i = 0; i < n; i++) {
      const z = z0 + (i + 0.5) * (d / n);
      sphere(root, 0.36 + rand(0, 0.12), (x0 + x1) / 2 + rand(-0.08, 0.08), 1.02, z, M.leaf, [1.1, 0.75, 1], { seg: 12 });
    }
  }
  planterWall(-18.9, WEST_X + 0.6, -2.85, 7.15);
  solid(-20, WEST_X + 0.6, -3, 8);
  planterWall(EAST_X - 0.15, EAST_X + 0.6, -2.85, CAFE.z0 - 0.05);
  solid(EAST_X - 0.15, 18, -3, CAFE.z0);

  // land side: stone balustrade over the drop to the road
  {
    const parts = new Map();
    const z = LAND_Z + 0.1;
    for (let x = -399.5; x <= 399.5; x += 2.0) {
      const near = Math.abs(x) < 40;
      const g = group(root, x, 0, z);
      box(g, 2.0, 0.18, 0.42, 0, 0, 0, M.kerb);
      box(g, 2.04, 0.12, 0.46, 0, 0.98, 0, M.stone);
      box(g, 0.3, 0.98, 0.34, -0.85, 0.0, 0, M.stone);
      const nb = near ? 6 : 3;
      for (let k = 0; k < nb; k++) {
        const bx = -0.6 + (k + 0.5) * (1.6 / nb);
        if (near) { cyl(g, 0.06, 0.06, 0.8, bx, 0.18, 0, M.stone, { seg: 8 }); sphere(g, 0.075, bx, 0.5, 0, M.stone, [1, 1.3, 1], { seg: 8 }); }
        else box(g, 0.12, 0.8, 0.12, bx, 0.18, 0, M.stone);
      }
      bake(parts, g, 0.2 + ((x + 400) % 7) * 0.1);
    }
    flush(parts, { cast: true, receive: true });
    solid(-400, 400, LAND_Z - 0.12, LAND_Z + 2);
    // the drop to the road + the road and pavement along the old buildings
    box(root, 800, -ROAD_Y + 0.0, 0.5, 0, ROAD_Y, LAND_Z + 0.55, M.wallStone, { cast: false }).userData.noBlock = true;
    const road = box(root, 800, 0.1, 44, 0, ROAD_Y - 0.1, LAND_Z + 22.8, M.road, { cast: false });
    road.userData.noBlock = true;
    box(root, 800, 0.2, 9, 0, ROAD_Y - 0.05, LAND_Z + 37, M.paving, { cast: false, receive: false }).userData.noBlock = true; // the pavement
    for (const zl of [LAND_Z + 13, LAND_Z + 21]) for (let x = -400; x < 400; x += 6) box(root, 3, 0.02, 0.18, x, ROAD_Y, zl, M.light, { cast: false, receive: false }).userData.noBlock = true;
  }

  // =====================================================================
  // THE RIVER: a big plane with drawn ripple strokes. Seen this flat, strokes
  // fixed in world space would vanish, so the rows are spaced by viewing angle
  // (even on screen, like a drawing) and the strokes drift with the current.
  // =====================================================================
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uPaper: inkShared.uPaper, uInk: inkShared.uInk },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCam, uPaper, uInk; uniform float uTime;
      varying vec3 vW;
      float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        vec2 dv = vW.xz - uCam.xz;
        float d = max(length(dv), 0.5);
        float a = max(uCam.y - vW.y, 0.3) / d;          // depression angle
        float rowf = a / 0.0125;
        float row = floor(rowf), fy = fract(rowf);
        float az = atan(dv.x, -dv.y);
        float rh = hash(row * 1.7 + 3.0);
        float cw = 0.035 + 0.045 * hash(row + 11.0);     // stroke cell, in radians of azimuth
        float u = az / cw + uTime * (0.05 + 0.06 * rh) + rh * 37.0;
        float cell = floor(u), fu = fract(u);
        float on = step(0.45, hash(cell * 1.31 + row * 7.13));
        float len = 0.3 + 0.5 * hash(cell * 2.7 + row * 1.9);
        float fwu = fwidth(u);
        float inS = smoothstep(0.0, 0.05 + fwu, fu) * (1.0 - smoothstep(len - 0.05 - fwu, len, fu));
        float wav = 0.1 * sin(fu * 9.4 + row);
        float fw = fwidth(rowf);
        float lw = 0.09 + 0.05 * hash(cell + row * 0.37);
        float ln = 1.0 - smoothstep(lw - fw * 0.7, lw + fw * 0.7, abs(fy - 0.5 - wav));
        float ink = ln * inS * on * (1.0 - smoothstep(0.35, 0.8, fw));
        gl_FragColor = vec4(mix(uPaper * 0.985, uInk, ink * 0.72), 1.0);
      }`,
  });
  const water = add(new THREE.PlaneGeometry(3200, -SHORE_Z + 10, 1, 1), waterMat, root, { cast: false, receive: false });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, SHORE_Z / 2 - 2);
  water.userData.noBlock = true;
  updaters.push((t, dt, ctx) => { waterMat.uniforms.uTime.value = t; waterMat.uniforms.uCam.value.copy(ctx.camera.position); });

  // =====================================================================
  // PUDONG: embankment, riverside park, low buildings, the dense skyline
  // =====================================================================
  {
    const parts = new Map();
    const put = (geo, mat, id) => {
      let g = geo.index ? geo.toNonIndexed() : geo;
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      withId(g, id);
      if (!parts.has(mat)) parts.set(mat, []);
      parts.get(mat).push(g);
    };
    const boxAt = (w, h, d, x, y, z, mat, id, ry = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (ry) g.rotateY(ry);
      g.translate(x, y + h / 2, z);
      put(g, mat, id);
    };
    const cylAt = (rt, rb, h, x, y, z, mat, id, seg = 12) => {
      const g = new THREE.CylinderGeometry(rt, rb, h, seg);
      g.translate(x, y + h / 2, z);
      put(g, mat, id);
    };
    // embankment + ground
    const em = new THREE.BoxGeometry(3200, SHORE_Y - WATER_Y + 1.2, 8);
    em.translate(0, (SHORE_Y + WATER_Y - 1.2) / 2, SHORE_Z - 4);
    put(em, M.fShore, 0.9);
    const gr = new THREE.BoxGeometry(3200, 1, 1200);
    gr.translate(0, SHORE_Y - 0.5, SHORE_Z - 8 - 600);
    put(gr, M.fGround, 0.91);
    // riverside park: a row of round trees, a few low pavilions
    const cr = makeRng(777);
    for (let x = -900; x < 900; x += 5 + cr() * 5) {
      const z = SHORE_Z - 11 - cr() * 8;
      const r = 2.4 + cr() * 1.6;
      const g = new THREE.SphereGeometry(r, 8, 6);
      g.scale(1, 0.85, 1);
      g.translate(x, SHORE_Y + 2.2 + r * 0.7, z);
      put(g, M.fTree, 0.05 + cr() * 0.95);
      cylAt(0.3, 0.4, 2.6, x, SHORE_Y, z, M.fDark, 0.4, 5);
    }
    // keep the landmarks' footprints clear of generic blocks
    const marks = Object.values(SKY).map(({ az, d }) => at(az, d));
    const conv = at(-30, 215);
    const ifc = at(1.5, 300);
    const clear = (x, z, pad) => marks.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 26 + pad) || Math.hypot(x - conv[0], z - conv[1]) < 40 + pad || Math.hypot(x - ifc[0], z - ifc[1]) < 26 + pad;
    // low riverside buildings behind the trees
    for (let x = -900; x < 900; x += 14 + cr() * 14) {
      const z = SHORE_Z - 30 - cr() * 20;
      if (clear(x, z, 0)) continue;
      const w = 10 + cr() * 14, d = 10 + cr() * 10;
      const az = THREE.MathUtils.radToDeg(Math.atan2(x, -z));
      const h = Math.abs(az - SKY.pearl.az) < SKY.pearl.hw + 2 ? 5 + cr() * 2 : 6 + cr() * 14;
      boxAt(w, h, d, x, SHORE_Y, z, cr() < 0.5 ? M.fGrid2 : M.fPlain, 0.05 + cr() * 0.95);
    }
    // the city: density and height rise toward Lujiazui (behind the landmarks).
    // Heights are chosen as viewing angles from the promenade, so the band
    // stays below the four landmarks wherever a block lands.
    const placed = [];
    const mats = [M.fGrid, M.fGrid, M.fBands, M.fVert, M.fFine, M.fGrid2];
    for (let i = 0; i < 3000 && placed.length < 320; i++) {
      const x = (cr() - 0.5) * 1800, z = SHORE_Z - 60 - cr() * 620;
      const az = THREE.MathUtils.radToDeg(Math.atan2(x, -z)), dist = Math.hypot(x, z);
      const core = Math.exp(-(((az - 4) / 24) ** 2)) * Math.exp(-(((dist - 430) / 190) ** 2));
      if (cr() > 0.3 + core * 0.9) continue;
      const w = 13 + cr() * 15, d = 13 + cr() * 15;
      if (clear(x, z, w * 0.5)) continue;
      if (placed.some(([px, pz, pw]) => Math.abs(px - x) < (pw + w) * 0.5 && Math.abs(pz - z) < (pw + d) * 0.5)) continue;
      let deg = 2.5 + cr() * 4 + core * (2 + cr() * 7.5);
      // nothing tall in front of a landmark: keep their feet and pearls in view
      const wdeg = THREE.MathUtils.radToDeg(w / dist) * 0.6;
      for (const L of Object.values(SKY)) {
        if (Math.abs(az - L.az) < L.hw + wdeg && dist < L.d + 40) deg = Math.min(deg, L === SKY.pearl ? 2.6 : 5.5);
      }
      const h = Math.max(12, dist * Math.tan(THREE.MathUtils.degToRad(deg)));
      const id = 0.05 + cr() * 0.95;
      const mat = mats[Math.floor(cr() * mats.length)];
      const kind = cr();
      if (kind < 0.12 && h > 50) {
        // round glass tower with a mast
        cylAt(w * 0.48, w * 0.5, h, x, SHORE_Y, z, M.fBands, id, 14);
        cylAt(w * 0.3, w * 0.42, 5, x, SHORE_Y + h, z, M.fPlain, id, 14);
        cylAt(0.3, 0.6, 14, x, SHORE_Y + h + 5, z, M.fDark, id, 5);
      } else if (kind < 0.3 && h > 45) {
        // stepped top
        boxAt(w, h, d, x, SHORE_Y, z, mat, id);
        boxAt(w * 0.72, 8, d * 0.72, x, SHORE_Y + h, z, mat, id);
        boxAt(w * 0.4, 6, d * 0.4, x, SHORE_Y + h + 8, z, M.fPlain, id);
      } else if (kind < 0.42 && h > 40) {
        // pointed crown
        boxAt(w, h, d, x, SHORE_Y, z, mat, id);
        const cone = new THREE.ConeGeometry(w * 0.7, 12, 4);
        cone.rotateY(Math.PI / 4);
        cone.translate(x, SHORE_Y + h + 6, z);
        put(cone, M.fPlain, id);
      } else {
        boxAt(w, h, d, x, SHORE_Y, z, mat, id, cr() < 0.2 ? 0.3 : 0);
        if (cr() < 0.3) boxAt(w * 0.5, 3, d * 0.5, x, SHORE_Y + h, z, M.fDark, id);
      }
      placed.push([x, z, w]);
    }
    // IFC: twin slabs with crowns by the river, right of the Pearl
    for (const dx of [-11, 11]) {
      const [x, z] = [ifc[0] + dx, ifc[1] - Math.abs(dx) * 0.4];
      const id = 0.3 + dx * 0.01;
      boxAt(15, 62, 15, x, SHORE_Y, z, M.fFine, id);
      boxAt(11, 5, 11, x, SHORE_Y + 62, z, M.fPlain, id);
      boxAt(5, 8, 5, x, SHORE_Y + 67, z, M.fFine, id);
    }
    boxAt(46, 12, 22, ifc[0], SHORE_Y, ifc[1] + 6, M.fGrid2, 0.62);
    // the convention center: a long low hall with two globes, by the river left of the Pearl
    {
      const [x, z] = conv;
      boxAt(46, 15, 22, x, SHORE_Y, z, M.fVert, 0.71);
      boxAt(50, 1.6, 24, x, SHORE_Y + 15, z, M.fPlain, 0.72);
      for (const [dx, r] of [[-12, 8.5], [12, 6]]) {
        const g = new THREE.SphereGeometry(r, 18, 12);
        g.translate(x + dx, SHORE_Y + 17.6 + r * 0.8, z);
        put(g, M.pearl, 0.73 + dx * 0.001);
      }
    }
    for (const [mat, geos] of parts) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.castShadow = false; m.receiveShadow = false;
      m.userData.farField = true; m.userData.noBlock = true;
      root.add(m);
    }
  }

  const farMesh = (m) => { m.castShadow = false; m.receiveShadow = false; m.userData.farField = true; m.userData.noBlock = true; return m; };
  const farGroup = (x, z) => { const g = group(root, x, SHORE_Y, z); return g; };
  const finishFar = (g) => { g.traverse((o) => { if (o.isMesh) farMesh(o); }); };

  // ---- Oriental Pearl Tower (about 0.32 of the real 468 m): tripod legs,
  // three columns, the big lower pearl, five small pearls, the upper pearl,
  // the space module and the needle.
  {
    const [x, z] = at(SKY.pearl.az, SKY.pearl.d);
    const g = farGroup(x, z);
    g.rotation.y = Math.atan2(-x, -z);
    const C = M.concrete, P = M.pearl, T = M.trim;
    // (the pearls and columns are drawn a little fatter than life so they read from across the river)
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
      cyl(g, 1.8, 2.0, 96, Math.cos(a) * 3.8, 0, Math.sin(a) * 3.8, C, { seg: 14 });
      // the inclined legs between the columns
      const b = a + Math.PI / 3;
      strut(g, [Math.cos(b) * 16, 0, Math.sin(b) * 16], [Math.cos(b) * 3.6, 25, Math.sin(b) * 3.6], 1.6, 1.3, C, { seg: 12 });
      cyl(g, 2.6, 3.0, 2.4, Math.cos(b) * 16, 0, Math.sin(b) * 16, C, { seg: 12 });
    }
    cyl(g, 7, 9, 4.5, 0, 0, 0, C, { seg: 24 });               // entrance podium
    sphere(g, 10.2, 0, 32, 0, P, [1, 1, 1], { seg: 32 });       // lower pearl
    torus(g, 10.3, 0.55, 0, 32, 0, T, { seg: 40 }).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      sphere(g, 2.7, Math.cos(a) * 3.8, 49 + i * 6.0, Math.sin(a) * 3.8, P, [1, 1, 1], { seg: 16 });
    }
    sphere(g, 7.8, 0, 86, 0, P, [1, 1, 1], { seg: 30 });        // upper pearl
    torus(g, 7.9, 0.5, 0, 86, 0, T, { seg: 36 }).rotation.x = Math.PI / 2;
    cyl(g, 2.0, 2.3, 22, 0, 90, 0, C, { seg: 14 });
    sphere(g, 3.3, 0, 113, 0, P, [1, 1, 1], { seg: 18 });       // space module
    cyl(g, 1.2, 1.6, 6, 0, 115, 0, C, { seg: 12 });
    cyl(g, 0.2, 1.15, 32, 0, 120, 0, C, { seg: 10 });          // the needle
    for (const [y, r] of [[124, 1.25], [130, 0.95], [136, 0.65]]) cyl(g, r, r, 0.8, 0, y, 0, T, { seg: 10 });
    finishFar(g);
  }

  // ---- Shanghai Tower: a rounded-triangle plan with a notch, tapering and
  // twisting about 120 degrees up its height, the crown sloping toward the notch.
  {
    const [x, z] = at(SKY.tower.az, SKY.tower.d);
    const H = 210, R0 = 15, N = 56, Mseg = 48;
    const notch = 0;
    const twist = (y) => (y / H) * 2.0;
    const scaleAt = (y) => 1 - 0.47 * Math.pow(y / H, 1.15);
    const topAt = (th) => H * (0.92 + 0.08 * (0.5 + 0.5 * Math.cos(th - notch - Math.PI)));
    const radiusAt = (th) => {
      let r = 1 + 0.11 * Math.cos(3 * th);
      const dn = Math.abs(Math.atan2(Math.sin(th - notch), Math.cos(th - notch)));
      r -= 0.13 * Math.max(0, 1 - dn / 0.2);
      return r;
    };
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= Mseg; j++) {
        const th = (j / Mseg) * Math.PI * 2;
        const y = (i / N) * topAt(th);
        const r = R0 * scaleAt(y) * radiusAt(th);
        const a = th + twist(y);
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        uv.push((j / Mseg) * 5, y / 50);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < Mseg; j++) {
      const a = i * (Mseg + 1) + j, b = a + Mseg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    // crown cap
    const c0 = pos.length / 3;
    pos.push(0, H * 0.955, 0); uv.push(0, 0);
    for (let j = 0; j < Mseg; j++) { const a = N * (Mseg + 1) + j; idx.push(a, c0, a + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const g = farGroup(x, z);
    g.rotation.y = 0.9;
    add(geo, M.spiral, g);
    // the notch reads as a dark seam spiralling up the tower
    const seam = [];
    for (let i = 0; i <= 40; i++) {
      const y = (i / 40) * topAt(notch) * 0.995;
      const r = R0 * scaleAt(y) * radiusAt(notch) + 0.3;
      seam.push(new THREE.Vector3(Math.cos(notch + twist(y)) * r, y, Math.sin(notch + twist(y)) * r));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam), 80, 0.9, 6, false), M.trim, g);
    cyl(g, R0 * 1.25, R0 * 1.3, 9, 0, 0, 0, M.fGrid, { seg: 24 }); // podium
    finishFar(g);
  }

  // ---- Shanghai World Financial Center: a tapered slab (square at the foot,
  // a blade at the top) with the trapezoid "bottle opener" opening.
  {
    const [x, z] = at(SKY.swfc.az, SKY.swfc.d);
    const H = 160, W0 = 21, Wt = 12, D0 = 21;
    const side = (y) => W0 / 2 + (Wt / 2 - W0 / 2) * Math.pow(y / H, 0.85);
    const sh = new THREE.Shape();
    sh.moveTo(-W0 / 2, 0); sh.lineTo(W0 / 2, 0);
    for (let i = 1; i <= 12; i++) { const y = (i / 12) * H; sh.lineTo(side(y), y); }
    for (let i = 12; i >= 1; i--) { const y = (i / 12) * H; sh.lineTo(-side(y), y); }
    sh.lineTo(-W0 / 2, 0);
    const hole = new THREE.Path();
    const hy0 = H - 17, hy1 = H - 3.2;
    hole.moveTo(-3.2, hy0); hole.lineTo(3.2, hy0); hole.lineTo(side(hy1) - 1.4, hy1); hole.lineTo(-side(hy1) + 1.4, hy1); hole.lineTo(-3.2, hy0);
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: D0, bevelEnabled: false, curveSegments: 4, steps: 1 });
    geo.translate(0, 0, -D0 / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - 0.82 * Math.pow(p.getY(i) / H, 1.1)));
    geo.computeVertexNormals();
    const g = farGroup(x, z);
    g.rotation.y = Math.atan2(-x, -z) * 0.6;
    add(geo, M.fFine, g);
    finishFar(g);
  }

  // ---- Jin Mao Tower: a pagoda of receding tiers with ledges, a crown and a spire.
  {
    const [x, z] = at(SKY.jinmao.az, SKY.jinmao.d);
    const g = farGroup(x, z);
    g.rotation.y = Math.PI / 8;
    let y = 0, r = 10.5, h = 21;
    for (let k = 0; k < 13; k++) {
      const top = r * 0.95;
      cyl(g, top, r, h, 0, y, 0, M.fVert, { seg: 8 });
      cyl(g, top + 0.7, top + 0.7, 0.8, 0, y + h, 0, M.trim, { seg: 8 });
      y += h + 0.8;
      r = top * (k < 4 ? 0.96 : 0.9);
      h = Math.max(2.4, h * 0.82);
    }
    cyl(g, r * 0.8, r, 4, 0, y, 0, M.concrete, { seg: 8 }); y += 4;
    cyl(g, r * 0.5, r * 0.75, 3, 0, y, 0, M.trim, { seg: 8 }); y += 3;
    cyl(g, 0.2, r * 0.5, 20, 0, y, 0, M.concrete, { seg: 8 });
    cyl(g, 14, 15, 8, 0, 0, 0, M.fGrid2, { seg: 8 }); // podium
    finishFar(g);
  }

  // =====================================================================
  // THE OLD BUND: neoclassical fronts across the road (clock tower, dome, pyramid roof)
  // =====================================================================
  {
    const zF = LAND_Z + 40;
    const parts = new Map();
    const fr = makeRng(91);
    const put = (geo, mat, id) => { let gg = geo.index ? geo.toNonIndexed() : geo; withId(gg, id); if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(gg); };
    let x = -260;
    let k = 0;
    while (x < 260) {
      const w = 22 + fr() * 16, h = 26 + fr() * 16, d = 26;
      const id = 0.05 + fr() * 0.95;
      const fm = M.facades[k % M.facades.length];
      // front face drawn, the rest plain stone
      const gb = new THREE.BoxGeometry(w - 0.6, h, d);
      gb.translate(x + w / 2, ROAD_Y + h / 2, zF + d / 2);
      // split materials by group: BoxGeometry groups 0..5; use the facade only on -z (group 5)
      const geoms = [];
      for (const gr of gb.groups) {
        const sub = new THREE.BufferGeometry();
        const ia = gb.index.array.slice(gr.start, gr.start + gr.count);
        sub.setAttribute('position', gb.attributes.position); sub.setAttribute('normal', gb.attributes.normal); sub.setAttribute('uv', gb.attributes.uv);
        sub.setIndex(Array.from(ia));
        geoms.push([sub.toNonIndexed(), gr.materialIndex === 5 ? fm : M.bundStone]);
      }
      for (const [sg, m] of geoms) put(sg, m, id);
      const cornice = new THREE.BoxGeometry(w - 0.2, 1.2, 1.6);
      cornice.translate(x + w / 2, ROAD_Y + h, zF - 0.3);
      put(cornice, M.bundStone, id);
      const cx = x + w / 2;
      if (Math.abs(cx - 18) < 14 && k % 3 === 0 || k === 7) {
        // clock tower (the Customs House)
        const tw = 9;
        const g1 = new THREE.BoxGeometry(tw, 16, tw); g1.translate(cx, ROAD_Y + h + 8, zF + 6); put(g1, M.bundStone, id);
        const g2 = new THREE.BoxGeometry(tw - 2, 8, tw - 2); g2.translate(cx, ROAD_Y + h + 20, zF + 6); put(g2, M.bundStone, id);
        const cl = new THREE.CylinderGeometry(2.4, 2.4, 0.4, 20); cl.rotateX(Math.PI / 2); cl.translate(cx, ROAD_Y + h + 11, zF + 6 - tw / 2 - 0.2); put(cl, M.light, id + 0.01);
        const sp = new THREE.ConeGeometry(2.5, 6, 4); sp.rotateY(Math.PI / 4); sp.translate(cx, ROAD_Y + h + 27, zF + 6); put(sp, M.bundRoof, id);
      } else if (k % 4 === 1) {
        // dome (the old HSBC bank)
        const dr = Math.min(8, w * 0.28);
        const drum = new THREE.CylinderGeometry(dr, dr, 4, 20); drum.translate(cx, ROAD_Y + h + 2, zF + 10); put(drum, M.bundStone, id);
        const dm = new THREE.SphereGeometry(dr, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); dm.translate(cx, ROAD_Y + h + 4, zF + 10); put(dm, M.bundRoof, id);
      } else if (k % 4 === 3) {
        // green pyramid roof (the Peace Hotel)
        const tb = new THREE.BoxGeometry(10, 10, 10); tb.translate(cx, ROAD_Y + h + 5, zF + 5); put(tb, M.bundStone, id);
        const py = new THREE.ConeGeometry(7.4, 9, 4); py.rotateY(Math.PI / 4); py.translate(cx, ROAD_Y + h + 14.5, zF + 5); put(py, M.bundRoof, id);
      }
      x += w;
      k++;
    }
    // street trees between the road and the buildings: clusters of small crowns
    for (let tx = -250; tx < 250; tx += 10 + fr() * 6) {
      const id = 0.05 + fr() * 0.95;
      for (const [dx, dy, dz, rr] of [[0, 5.6, 0, 1.7], [1.2, 4.9, 0.3, 1.3], [-1.2, 5.0, -0.2, 1.35], [0.3, 6.6, -0.3, 1.1]]) {
        const gS = new THREE.SphereGeometry(rr, 10, 7); gS.translate(tx + dx, ROAD_Y + dy, zF - 4 + dz); put(gS, M.leafFar, id);
      }
      const gT = new THREE.CylinderGeometry(0.15, 0.25, 4.4, 5); gT.translate(tx, ROAD_Y + 2.2, zF - 4); put(gT, M.fDark, 0.4);
    }
    for (const [mat, geos] of parts) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.castShadow = false; m.receiveShadow = false; m.userData.farField = true; m.userData.noBlock = true;
      root.add(m);
    }
  }

  // =====================================================================
  // WATERFRONT PROPS
  // =====================================================================
  // Wooden bench with cast-iron ends, facing the river (-z).
  function bench(x, z, ry = 0) {
    const g = group(root, x, 0, z, ry);
    for (const sx of [-1, 1]) {
      const e = group(g, sx * 0.82, 0, 0);
      box(e, 0.06, 0.44, 0.06, 0, 0, -0.2, M.iron);
      box(e, 0.06, 0.86, 0.06, 0, 0, 0.21, M.iron, { rx: -0.08 });
      box(e, 0.05, 0.05, 0.5, 0, 0.4, 0.0, M.iron);
      box(e, 0.06, 0.05, 0.42, 0, 0.66, -0.02, M.iron);       // armrest
      box(e, 0.06, 0.24, 0.05, 0, 0.42, -0.2, M.iron);
      torus(e, 0.07, 0.014, 0, 0.66, -0.24, M.iron, { seg: 10, tseg: 4, arc: Math.PI }).rotation.y = Math.PI / 2;
      box(e, 0.14, 0.03, 0.12, 0, 0, -0.2, M.iron);
      box(e, 0.14, 0.03, 0.12, 0, 0, 0.22, M.iron);
    }
    for (let i = 0; i < 4; i++) box(g, 1.78, 0.04, 0.095, 0, 0.42, -0.17 + i * 0.115, M.wood, { r: 0.01 });
    for (let i = 0; i < 3; i++) box(g, 1.78, 0.09, 0.03, 0, 0.55 + i * 0.13, 0.23 + i * 0.012, M.wood, { r: 0.01, rx: -0.12 });
    solid(x - 0.9, x + 0.9, z - 0.27, z + 0.3);
    return g;
  }
  // Vintage cast-iron streetlamp: fluted base, tapered post, collars, a lantern
  // head with a cap and finial. double: twin lanterns on a scrolled crossbar.
  function lamp(x, z, { double = false, h = 3.1 } = {}) {
    const g = group(root, x, 0, z);
    cyl(g, 0.17, 0.21, 0.1, 0, 0, 0, M.iron, { seg: 16 });
    cyl(g, 0.13, 0.17, 0.5, 0, 0.1, 0, M.iron, { seg: 12 });
    for (const y of [0.18, 0.4]) torus(g, 0.155, 0.02, 0, y, 0, M.iron, { seg: 16, tseg: 4 }).rotation.x = Math.PI / 2;
    cyl(g, 0.045, 0.075, h - 0.6, 0, 0.6, 0, M.iron, { seg: 10 });
    for (const y of [1.1, 2.2]) cyl(g, 0.075, 0.075, 0.07, 0, y, 0, M.iron, { seg: 10 });
    const head = (hx, hy) => {
      const l = group(g, hx, hy, 0);
      cyl(l, 0.07, 0.11, 0.08, 0, 0, 0, M.iron, { seg: 8 });
      cyl(l, 0.2, 0.13, 0.42, 0, 0.08, 0, M.glow, { seg: 6 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; strut(l, [Math.cos(a) * 0.13, 0.08, Math.sin(a) * 0.13], [Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2], 0.012, 0.012, M.iron, { seg: 4 }); }
      cyl(l, 0.06, 0.25, 0.14, 0, 0.5, 0, M.iron, { seg: 6 });
      sphere(l, 0.045, 0, 0.7, 0, M.iron, [1, 1, 1], { seg: 8 });
      cyl(l, 0.01, 0.025, 0.12, 0, 0.72, 0, M.iron, { seg: 4 });
      return l;
    };
    if (double) {
      box(g, 1.1, 0.06, 0.06, 0, h - 0.05, 0, M.iron);
      for (const sx of [-1, 1]) {
        torus(g, 0.16, 0.016, sx * 0.3, h - 0.2, 0, M.iron, { seg: 12, tseg: 4, arc: Math.PI * 1.3 }).rotation.z = sx > 0 ? -0.2 : Math.PI + 0.2;
        head(sx * 0.55, h);
      }
      head(0, h + 0.05).scale.setScalar(0.85);
    } else {
      for (const sx of [-1, 1]) torus(g, 0.12, 0.014, sx * 0.12, h - 0.25, 0, M.iron, { seg: 10, tseg: 4, arc: Math.PI * 1.2 }).rotation.z = sx > 0 ? 0 : Math.PI;
      head(0, h);
    }
    solidCircle(x, z, 0.2);
    return g;
  }
  function planterTree(x, z, s = 1) {
    const g = group(root, x, 0, z);
    cyl(g, 0.55, 0.5, 0.55, 0, 0, 0, M.kerb, { seg: 20 });
    cyl(g, 0.5, 0.5, 0.02, 0, 0.53, 0, M.soil, { seg: 20, cast: false });
    cyl(g, 0.07, 0.1, 1.9 * s, 0, 0.5, 0, M.woodDark, { seg: 8 });
    for (const [dx, dy, dz, r] of [[0, 2.5, 0, 0.75], [0.45, 2.2, 0.2, 0.55], [-0.4, 2.25, -0.2, 0.58], [0.1, 2.9, -0.15, 0.5], [-0.15, 2.15, 0.42, 0.45]]) {
      sphere(g, r * s, dx * s, 0.5 + dy * s, dz * s, M.leaf, [1, 0.9, 1], { seg: 14 });
    }
    solidCircle(x, z, 0.6);
    return g;
  }
  function pot(parent, x, z, s = 1) {
    const p = group(parent, x, 0, z);
    p.scale.setScalar(s);
    cyl(p, 0.2, 0.15, 0.36, 0, 0, 0, M.paper, { seg: 16 });
    cyl(p, 0.19, 0.19, 0.01, 0, 0.34, 0, M.soil, { seg: 16, cast: false });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand(-0.2, 0.2);
      const st = group(p, 0, 0.34, 0, -a);
      st.rotation.z = rand(0.25, 0.7);
      const len = rand(0.2, 0.38);
      cyl(st, 0.007, 0.007, len, 0, 0, 0, M.black, { seg: 5 });
      sphere(st, 0.12, 0, len + 0.07, 0, M.leaf, [0.6, 1.25, 0.12], { seg: 12 }).rotation.y = Math.PI / 2;
    }
    return p;
  }

  // river side: benches, lamps; land side: tall double lamps, trees in planters
  const BENCHES = [[-13.0, -1.55], [-6.6, -1.55], [-1.35, -1.55], [8.6, -1.55]];
  for (const [x, z] of BENCHES) bench(x, z);
  for (const x of [-15.6, -9.8, -3.7, 4.7, 11.4]) lamp(x, -2.35);
  for (const x of [-12.0, -4.6, 4.4]) lamp(x, 6.55, { double: true, h: 3.7 });
  for (const x of [-15.6, -8.4, -0.9]) planterTree(x, 6.35);
  // far lamps along the rest of the Bund (baked)
  {
    const parts = new Map();
    for (let x = -390; x <= 390; x += 12) {
      if (x > WEST_X - 4 && x < EAST_X + 4) continue;
      const l = lamp(x, -2.35);
      colliders.pop();
      bake(parts, l, 0.27);
      if (Math.abs(x) % 36 === 0) { const b = bench(x + 5, -1.55); colliders.pop(); bake(parts, b, 0.55); }
    }
    flush(parts, { cast: false, receive: false });
  }

  // trash bin against the railing
  {
    const g = group(root, 3.35, 0, -2.45);
    box(g, 0.46, 0.82, 0.42, 0, 0, 0, M.dark, { r: 0.03 });
    box(g, 0.5, 0.08, 0.46, 0, 0.82, 0, M.iron, { r: 0.02 });
    box(g, 0.3, 0.04, 0.02, 0, 0.62, 0.215, M.black);
    for (const sx of [-1, 1]) box(g, 0.02, 0.6, 0.02, sx * 0.12, 0.1, 0.215, M.ironMid);
    solid(3.1, 3.6, -2.7, -2.22);
  }
  // life ring hung on the railing (on a little iron bracket between two posts)
  const ring = (() => {
    const g = group(root, 2.25, 0.6, RAIL_Z + 0.09);
    box(g, 0.06, 0.08, 0.06, 0, 0.44, -0.02, M.iron);
    const r = add(new THREE.TorusGeometry(0.3, 0.065, 12, 36), M.lifeRing, g);
    r.position.y = 0.12;
    for (const a of [-0.5, 0.5]) { const rope = torus(g, 0.36, 0.008, 0, 0.12, 0.0, M.light, { seg: 18, tseg: 3, arc: 0.7 }); rope.rotation.z = Math.PI / 2 + a - 0.35; }
    return g;
  })();
  // coin binoculars + brass plaque at the viewpoint
  {
    const g = group(root, 0.6, 0, -2.5);
    cyl(g, 0.12, 0.16, 0.08, 0, 0, 0, M.iron, { seg: 14 });
    cyl(g, 0.05, 0.07, 1.0, 0, 0.08, 0, M.iron, { seg: 10 });
    box(g, 0.32, 0.2, 0.22, 0, 1.06, 0, M.ironMid, { r: 0.05 });
    for (const sx of [-1, 1]) { const tb = cyl(g, 0.05, 0.06, 0.18, sx * 0.08, 1.1, -0.15, M.iron, { seg: 12 }); tb.rotation.x = Math.PI / 2; tb.position.y = 1.16; }
    solidCircle(0.6, -2.5, 0.2);
    const pl = facedBox(root, 0.46, 0.23, 0.02, -0.45, 0.64, RAIL_Z + 0.06, M.ironMid, M.plaque, [4], { cast: false });
    void pl;
  }
  // photo spot sign hung on the railing
  {
    facedBox(root, 0.34, 0.34, 0.02, 6.75, 0.62, RAIL_Z + 0.06, M.iron, M.photoSign, [4], { cast: false });
    // two painted footprints on the paving
    for (const sx of [-1, 1]) {
      sphere(root, 1, 6.75 + sx * 0.11, 0.002, -1.92, M.mid, [0.055, 0.004, 0.1], { seg: 14, cast: false, receive: false }).rotation.y = sx * 0.1;
      sphere(root, 1, 6.75 + sx * 0.115, 0.002, -1.77, M.mid, [0.045, 0.004, 0.045], { seg: 12, cast: false, receive: false });
    }
  }
  // the 外灘 pylon on the land side (tall vertical sign)
  {
    const g = group(root, 1.5, 0, 6.6);
    box(g, 0.5, 0.25, 0.3, 0, 0, 0, M.kerb);
    facedBox(g, 0.42, 2.0, 0.12, 0, 0.25, 0, M.dark, M.bund, [4, 5]);
    box(g, 0.5, 0.08, 0.18, 0, 2.25, 0, M.iron);
    solid(1.2, 1.8, 6.4, 6.8);
  }
  // signpost home (回家) near the start
  {
    const g = group(root, 2.6, 0, 5.1, 0.35);
    box(g, 0.08, 1.4, 0.08, 0, 0, 0, M.woodDark);
    facedBox(g, 0.72, 0.22, 0.04, 0.22, 1.08, 0, M.wood, signMat('回家', { vertical: false, seed: 21, w: 300, h: 120, size: 70 }), [4, 5]);
    facedBox(g, 0.6, 0.2, 0.04, -0.15, 0.8, 0.02, M.wood, signMat('外灘', { vertical: false, seed: 23, w: 300, h: 120, size: 70 }), [4, 5]).rotation.y = 0.5;
    solidCircle(2.6, 5.1, 0.12);
    actionSpot('home', 'Head home', { x: 2.3, z: 4.6, radius: 0.85, prompt: [2.6, 1.6, 5.1], act: (ctx) => ctx.travel('room') });
  }

  // a seagull perched on the railing
  const gull = (() => {
    const g = group(root, -2.25, 0.08 + 0.94 + 0.02, RAIL_Z, -0.4);
    const body = group(g, 0, 0, 0);
    sphere(body, 0.09, 0, 0.09, 0, M.gull, [0.8, 0.68, 1.6], { seg: 16 }).rotation.x = -0.12;
    for (const sx of [-1, 1]) { const w = sphere(body, 0.075, sx * 0.06, 0.12, -0.05, M.gullWing, [0.3, 0.45, 1.75], { seg: 12 }); w.rotation.x = -0.12; }
    const tail = box(body, 0.07, 0.018, 0.12, 0, 0.115, -0.19, M.dark, { rx: 0.15 });
    void tail;
    const head = group(body, 0, 0.18, 0.12);
    sphere(head, 0.055, 0, 0, 0, M.gull, [1, 1, 1.1], { seg: 14 });
    const beak = add(new THREE.ConeGeometry(0.017, 0.08, 6), M.gray, head);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.01, 0.08);
    for (const sx of [-1, 1]) sphere(head, 0.009, sx * 0.04, 0.012, 0.03, M.black, [1, 1, 1], { seg: 6 });
    for (const sx of [-1, 1]) cyl(g, 0.006, 0.006, 0.05, sx * 0.025, -0.02, 0, M.dark, { seg: 4, cast: false });
    return { g, body, head, flap: 0, look: 2 };
  })();

  // =====================================================================
  // BUND COFFEE (enterable): big windows on the river, awning, hanging sign,
  // counter, espresso machine, menu boards, the barista.
  // =====================================================================
  const cafeBlockers = [];
  {
    const { x0, x1, z0, z1, H } = CAFE;
    const T = 0.15;
    const wall = (w, h, d, x, y, z) => { const m = box(root, w, h, d, x, y, z, M.plaster); cafeBlockers.push(m); return m; };
    const frame = (w, h, d, x, y, z) => box(root, w, h, d, x, y, z, M.frame);
    // floor
    box(root, x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, -0.296, (z0 + z1) / 2, M.floor, { cast: false }).userData.noBlock = true;
    // front (river side): window bay | door | big window
    const DX0 = 10.45, DX1 = 11.75, TOP = 2.55;
    wall(DX0 - x0, 0.8, T, (x0 + DX0) / 2, 0, z0);                            // sill (left bay)
    wall(x1 - DX1, 0.55, T, (DX1 + x1) / 2, 0, z0);                            // sill (big window)
    wall(x1 - x0, H - TOP, T, (x0 + x1) / 2, TOP, z0);                          // above the windows
    frame(x1 - x0 + 0.04, 0.1, T + 0.04, (x0 + x1) / 2, TOP - 0.1, z0);         // transom
    for (const xx of [x0 + 0.05, DX0, DX1, 12.8, 13.85, 14.9, x1 - 0.05]) frame(0.09, TOP, T + 0.03, xx, 0, z0);
    frame(x1 - DX1, 0.06, T + 0.02, (DX1 + x1) / 2, 1.95, z0);                 // a glazing bar
    frame(DX0 - x0, 0.07, T + 0.03, (x0 + DX0) / 2, 0.8, z0);
    frame(x1 - DX1, 0.07, T + 0.03, (DX1 + x1) / 2, 0.55, z0);
    // the open door leaf (swung in)
    {
      const hinge = group(root, DX0 + 0.06, 0, z0 + 0.05, -1.25);
      box(hinge, 1.12, 2.4, 0.05, 0.56, 0.02, 0, M.frame);
      box(hinge, 0.8, 1.3, 0.055, 0.56, 0.9, 0, M.light);
      box(hinge, 0.06, 0.25, 0.06, 1.0, 1.0, 0.05, M.iron);
    }
    // sides + back
    wall(T, H, z1 - z0, x1 - T / 2, 0, (z0 + z1) / 2);
    wall(x1 - x0, H, T, (x0 + x1) / 2, 0, z1 - T / 2);
    // the west wall, with a window (sill + head + jambs)
    {
      const wz0 = 3.0, wz1 = 5.4;
      const wx = x0 + T / 2;
      wall(T, H, wz0 - z0, wx, 0, (z0 + wz0) / 2);
      wall(T, H, z1 - wz1, wx, 0, (wz1 + z1) / 2);
      wall(T, 0.85, wz1 - wz0, wx, 0, (wz0 + wz1) / 2);
      wall(T, H - 2.45, wz1 - wz0, wx, 2.45, (wz0 + wz1) / 2);
      for (const zz of [wz0, (wz0 + wz1) / 2, wz1]) frame(T + 0.03, 1.6, 0.08, wx, 0.85, zz);
      frame(T + 0.04, 0.07, wz1 - wz0, wx, 0.85, (wz0 + wz1) / 2);
    }
    // roof + cornice (roof casts no shadow so the room stays readable inside)
    const roof = box(root, x1 - x0 + 0.3, 0.25, z1 - z0 + 0.3, (x0 + x1) / 2, H, (z0 + z1) / 2, M.stone, { cast: false });
    cafeBlockers.push(roof);
    // parapet rim + a roof hatch / vent so the roof reads from above
    for (const [w, d, x, z] of [[x1 - x0 + 0.42, 0.2, (x0 + x1) / 2, z0 - 0.11], [x1 - x0 + 0.42, 0.2, (x0 + x1) / 2, z1 + 0.11], [0.2, z1 - z0 + 0.42, x0 - 0.11, (z0 + z1) / 2], [0.2, z1 - z0 + 0.42, x1 + 0.11, (z0 + z1) / 2]]) {
      box(root, w, 0.3, d, x, H + 0.2, z, M.frame, { cast: false });
    }
    box(root, 1.0, 0.5, 0.8, 14.6, H + 0.25, 5.8, M.light, { r: 0.05 });
    cyl(root, 0.15, 0.15, 0.7, 11.2, H + 0.25, 6.2, M.mid, { seg: 10 });
    box(root, x1 - x0 + 0.1, 0.06, 0.1, (x0 + x1) / 2, TOP + 0.1, z0 - 0.1, M.frame);
    // fascia sign over the big window, facing the river
    facedBox(root, 3.9, 0.55, 0.06, (DX1 + x1) / 2 + 0.05, 2.78, z0 - 0.1, M.frame, M.fascia, [5], { cast: false });
    // striped awning sloping out over the outdoor seats
    {
      const aw = new THREE.PlaneGeometry(x1 - x0 + 0.2, 1.25);
      const m = add(aw, M.awning, root, { cast: true, receive: false });
      m.position.set((x0 + x1) / 2, 2.42, z0 - 0.52);
      m.rotation.x = -Math.PI / 2 - 0.55;
      box(root, x1 - x0 + 0.2, 0.18, 0.02, (x0 + x1) / 2, 1.98, z0 - 1.06, M.awning, { cast: false });
      for (const xx of [x0 - 0.05, x1 + 0.05]) strut(root, [xx, 2.6, z0 - 0.02], [xx, 2.15, z0 - 1.06], 0.015, 0.015, M.iron, { seg: 5 });
    }
    // the "Coffee" sign hanging from an iron bracket at the corner, facing along the promenade
    const coffeeSign = (() => {
      const g = group(root, x0 - 0.02, 2.75, z0 + 0.25);
      box(g, 0.05, 0.05, 0.05, 0, 0, 0, M.iron);
      box(g, 0.9, 0.045, 0.045, -0.45, 0.0, 0, M.iron);
      strut(g, [-0.02, -0.35, 0], [-0.6, 0.0, 0], 0.012, 0.012, M.iron, { seg: 4 });
      torus(g, 0.1, 0.01, -0.3, -0.1, 0, M.iron, { seg: 12, tseg: 3 });
      const sw = group(g, -0.55, -0.02, 0);
      for (const sx of [-0.28, 0.28]) cyl(sw, 0.005, 0.005, 0.14, sx, -0.14, 0, M.black, { seg: 3, cast: false });
      const board = facedBox(sw, 0.72, 0.42, 0.04, 0, -0.56, 0, M.frame, M.coffee, [4, 5]);
      board.rotation.y = Math.PI / 2;
      board.position.set(0, -0.35, 0);
      return sw;
    })();
    updaters.push((t) => { coffeeSign.rotation.x = Math.sin(t * 0.9) * 0.04; });
    // invisible panes in the window openings: the camera never slips through a window
    for (const [w, h, x, y, z, ry] of [
      [DX0 - x0, TOP - 0.8, (x0 + DX0) / 2, 0.8, z0, 0], [x1 - DX1, TOP - 0.55, (DX1 + x1) / 2, 0.55, z0, 0],
      [2.4, 1.6, x0 + T / 2, 0.85, 4.2, Math.PI / 2],
      [DX1 - DX0, TOP, (DX0 + DX1) / 2, 0, z0, 0], // the doorway too (you walk through it; the camera does not)
    ]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.paper2);
      pane.position.set(x, y + h / 2, z);
      pane.rotation.y = ry;
      pane.visible = false;
      pane.userData.noBlock = true;
      root.add(pane);
      cafeBlockers.push(pane);
    }
    // colliders: front wall pieces (open door), side walls, back wall
    solid(x0 - 0.05, DX0 + 0.05, z0 - 0.1, z0 + 0.1);
    solid(DX1 - 0.05, x1 + 0.05, z0 - 0.1, z0 + 0.1);
    solid(x0 - 0.05, x0 + T + 0.03, z0 - 0.1, z1 + 0.1);
    solid(x1 - T - 0.03, x1 + 0.6, z0 - 0.1, z1 + 0.1);
    solid(x0, x1, z1 - T - 0.03, z1 + 0.5);
    solid(DX0 - 0.05, DX0 + 0.42, z0, z0 + 1.15); // the open door leaf

    // ---- inside ----
    const CX0 = 11.6, CZ0 = 5.15, CZ1 = 5.85;
    // counter: dark boards front, light top, the return at the west end
    box(root, x1 - T - CX0, 1.0, CZ1 - CZ0, (CX0 + x1 - T) / 2, 0, (CZ0 + CZ1) / 2, M.boardsDark);
    box(root, x1 - T - CX0 + 0.06, 0.06, CZ1 - CZ0 + 0.12, (CX0 + x1 - T) / 2, 1.0, (CZ0 + CZ1) / 2 - 0.03, M.wood);
    box(root, 0.35, 1.0, z1 - T - CZ1, CX0 + 0.175, 0, (CZ1 + z1 - T) / 2, M.boardsDark);
    box(root, 0.41, 0.06, z1 - T - CZ1, CX0 + 0.175, 1.0, (CZ1 + z1 - T) / 2, M.wood);
    solid(CX0 - 0.03, x1, CZ0 - 0.03, CZ1);
    solid(CX0 - 0.03, CX0 + 0.38, CZ0, z1);
    const CT = 1.06;
    // espresso machine
    {
      const g = group(root, 14.45, CT, 5.55);
      box(g, 0.74, 0.42, 0.42, 0, 0, 0, M.light, { r: 0.04 });
      box(g, 0.74, 0.05, 0.42, 0, 0.42, 0, M.mid);
      for (const sx of [-1, 1]) { cyl(g, 0.045, 0.05, 0.08, sx * 0.17, 0.12, -0.24, M.iron, { seg: 10 }); box(g, 0.03, 0.03, 0.14, sx * 0.17, 0.12, -0.3, M.black); }
      for (let i = 0; i < 6; i++) cyl(g, 0.035, 0.028, 0.06, -0.28 + i * 0.11, 0.47, 0, M.paper, { seg: 10 });
      const wand = cyl(g, 0.008, 0.008, 0.2, 0.33, 0.05, -0.22, M.iron, { seg: 4 }); wand.rotation.x = 0.4;
      box(g, 0.3, 0.32, 0.3, 0.68, 0, 0.0, M.dark, { r: 0.03 });  // grinder
      cyl(g, 0.1, 0.06, 0.2, 0.68, 0.32, 0, M.light, { seg: 12 });
    }
    // register, a cake stand, cups
    box(root, 0.36, 0.2, 0.3, 12.55, CT, 5.5, M.dark, { r: 0.03, ry: 0.15 });
    box(root, 0.3, 0.12, 0.04, 12.55, CT + 0.2, 5.58, M.mid, { rx: -0.4 });
    {
      const g = group(root, 15.2, CT, 5.45);
      cyl(g, 0.17, 0.17, 0.015, 0, 0.12, 0, M.paper, { seg: 18 });
      cyl(g, 0.02, 0.05, 0.12, 0, 0, 0, M.paper, { seg: 8 });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cyl(g, 0.038, 0.034, 0.03, Math.cos(a) * 0.1, 0.135, Math.sin(a) * 0.1, M.light, { seg: 10 }); }
      const dome = add(new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.paper2, g); dome.position.y = 0.13; dome.scale.y = 0.8;
    }
    for (let i = 0; i < 3; i++) cyl(root, 0.045, 0.035, 0.1, 12.95 + i * 0.12, CT, 5.3, M.paper, { seg: 10 });
    // back wall: shelf with jars and bags, two chalk menus, pendant lamps
    box(root, 3.6, 0.04, 0.28, 13.7, 1.45, z1 - T - 0.14, M.wood);
    for (let i = 0; i < 9; i++) {
      const xx = 12.1 + i * 0.38;
      if (i % 3 === 0) box(root, 0.18, 0.26, 0.12, xx, 1.49, z1 - T - 0.14, M.light, { r: 0.03 });
      else cyl(root, 0.07, 0.07, 0.22, xx, 1.49, z1 - T - 0.14, i % 2 ? M.paper : M.mid, { seg: 12 });
    }
    facedBox(root, 0.95, 1.25, 0.04, 12.6, 1.75, z1 - T - 0.02, M.frame, M.menuA, [5], { cast: false });
    facedBox(root, 0.95, 1.25, 0.04, 14.85, 1.75, z1 - T - 0.02, M.frame, M.menuB, [5], { cast: false });
    for (const xx of [12.5, 13.6, 14.7]) {
      cyl(root, 0.006, 0.006, 0.85, xx, H - 0.85, 5.5, M.black, { seg: 4, cast: false });
      cyl(root, 0.05, 0.2, 0.2, xx, H - 1.05, 5.5, M.dark, { seg: 14, open: true });
      sphere(root, 0.06, xx, H - 1.03, 5.5, M.glow, [1, 1, 1], { seg: 8 });
    }
    // tables by the windows
    const table = (x, z, r = 0.38, y = 0.74, parent = root) => {
      const g = group(parent, x, 0, z);
      cyl(g, 0.2, 0.24, 0.03, 0, 0, 0, M.iron, { seg: 14 });
      cyl(g, 0.025, 0.025, y - 0.03, 0, 0.03, 0, M.iron, { seg: 8 });
      cyl(g, r, r, 0.035, 0, y, 0, M.wood, { seg: 22 });
      solidCircle(x, z, r + 0.02);
      return g;
    };
    const chair = (x, z, ry) => {
      const g = group(root, x, 0, z, ry);
      for (const [cx, cz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) cyl(g, 0.012, 0.012, 0.45, cx, 0, cz, M.iron, { seg: 5 });
      box(g, 0.4, 0.04, 0.4, 0, 0.45, 0, M.wood, { r: 0.01 });
      for (const cx of [-0.17, 0.17]) cyl(g, 0.012, 0.012, 0.42, cx, 0.47, 0.18, M.iron, { seg: 5 });
      box(g, 0.38, 0.12, 0.03, 0, 0.74, 0.18, M.wood, { r: 0.01 });
      solidCircle(x, z, 0.24);
      return g;
    };
    const cup = (x, z, y = 0.775) => { cyl(root, 0.04, 0.032, 0.07, x, y, z, M.paper, { seg: 12 }); cyl(root, 0.07, 0.07, 0.006, x, y, z, M.paper, { seg: 14 }); };
    table(14.4, 2.75); chair(13.78, 2.75, -Math.PI / 2); chair(15.08, 2.75, Math.PI / 2); cup(14.32, 2.7); cup(14.5, 2.85);
    table(10.45, 4.25, 0.34); chair(10.45, 3.6, Math.PI); chair(10.45, 4.9, 0); cup(10.4, 4.2);
    pot(root, 10.0, 6.65, 1.6); solidCircle(10.0, 6.65, 0.33);
    pot(root, 15.55, 4.3, 1.3); solidCircle(15.55, 4.3, 0.28);
    for (const xx of [12.3, 13.3, 14.3, 15.3]) pot(root, xx, CAFE.z0, 0.45).position.y = 0.56;

    // ---- outside: umbrella table, a front table under the awning, plants ----
    {
      const g = table(7.25, 3.75, 0.45);
      cyl(g, 0.02, 0.02, 1.6, 0, 0.77, 0, M.iron, { seg: 6 });
      const can = add(new THREE.ConeGeometry(1.25, 0.45, 8, 1, true), M.awning, g, { cast: true });
      can.position.y = 2.55;
      sphere(g, 0.04, 0, 2.8, 0, M.iron, [1, 1, 1], { seg: 6 });
      chair(6.55, 3.75, -Math.PI / 2); chair(7.95, 3.75, Math.PI / 2);
      cup(7.15, 3.7, 0.775);
    }
    table(14.6, 0.75, 0.34); chair(13.95, 0.75, -Math.PI / 2); chair(15.25, 0.75, Math.PI / 2); cup(14.65, 0.8);
    pot(root, 10.1, 1.2, 1.1); solidCircle(10.1, 1.2, 0.24);
    pot(root, 12.15, 1.2, 1.1); solidCircle(12.15, 1.2, 0.24);
    planterTree(8.65, 6.35, 0.9);
    // a little A-frame board by the door
    {
      const g = group(root, 9.05, 0, 0.95, 0.3);
      for (const s of [-1, 1]) { const b = facedBox(g, 0.5, 0.8, 0.03, 0, 0, s * 0.1, M.frame, M.menuA, [s > 0 ? 4 : 5]); b.rotation.x = -s * 0.15; }
      solidCircle(9.05, 0.95, 0.3);
    }
  }
  // the barista behind the counter
  const barista = createCharacter({ style: 'auntie', bun: false, topTone: 0.35 });
  // (on a raised floor behind the counter, like the tea house auntie, so she reads over it)
  box(root, CAFE.x1 - 0.15 - 11.95, 0.5, 1.05, (11.95 + CAFE.x1 - 0.15) / 2, 0, 6.5, M.boardsDark, { cast: false }).userData.noBlock = true;
  barista.root.position.set(13.45, 0.5, 6.45);
  barista.root.rotation.y = Math.PI;
  root.add(barista.root);
  npcs.push(barista);
  let baristaLook = Math.PI, baristaTalk = 0;

  // =====================================================================
  // BOATS on the river, birds in the sky
  // =====================================================================
  function ferry(big) {
    const g = new THREE.Group();
    const L = big ? 34 : 22, W = big ? 7.5 : 5.6;
    // hull: a pointed plan extruded upward
    const sh = new THREE.Shape();
    sh.moveTo(-L / 2, -W / 2); sh.lineTo(L / 2 - W * 0.9, -W / 2); sh.quadraticCurveTo(L / 2, -W * 0.35, L / 2 + 0.6, 0);
    sh.quadraticCurveTo(L / 2, W * 0.35, L / 2 - W * 0.9, W / 2); sh.lineTo(-L / 2, W / 2); sh.lineTo(-L / 2, -W / 2);
    const hull = new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: false, curveSegments: 8 });
    hull.rotateX(-Math.PI / 2);
    hull.translate(0, -1.0, 0);
    add(hull, M.hull, g);
    const band = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 8 });
    band.rotateX(-Math.PI / 2); band.scale(1.01, 1, 1.03); band.translate(0, -0.6, 0);
    add(band, M.boatDark, g);
    // a dark sheer stripe along the top of the hull, and a raised bow bulwark
    const sheer = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: false, curveSegments: 8 });
    sheer.rotateX(-Math.PI / 2); sheer.scale(1.005, 1, 1.02); sheer.translate(0, 1.3, 0);
    add(sheer, M.boatDark, g);
    const bow = box(g, W * 0.9, 0.9, 0.12, L / 2 - W * 0.62, 1.6, 0, M.boat);
    bow.rotation.y = Math.PI / 2;
    // deck 1: rounded cabin set back from the open fore-deck
    const c1 = big ? L * 0.6 : L * 0.5;
    facedBox(g, c1, 2.3, W * 0.84, -L * 0.12, 1.6, 0, M.boat, M.boatWin, [4, 5]);
    box(g, c1 + 1.2, 0.2, W * 0.95, -L * 0.12 + 0.3, 3.9, 0, M.boatDark);
    if (big) {
      const c2 = L * 0.4;
      facedBox(g, c2, 2.0, W * 0.74, -L * 0.18, 4.1, 0, M.boat, M.boatWin, [4, 5]);
      box(g, c2 + 0.8, 0.16, W * 0.84, -L * 0.18, 6.1, 0, M.boatDark);
      box(g, 3.2, 1.6, 3.4, L * 0.1, 4.1, 0, M.boat, { r: 0.3 });   // wheelhouse
      box(g, 3.6, 0.14, 3.8, L * 0.1, 5.7, 0, M.boatDark);
      cyl(g, 0.08, 0.08, 3.2, -L * 0.36, 6.26, 0, M.dark, { seg: 5 });
      const flag = add(new THREE.PlaneGeometry(1.5, 0.95), M.boatDark, g); flag.position.set(-L * 0.36 - 0.75, 9.0, 0);
      // top deck railing (posts + rail)
      for (let i = 0; i <= 8; i++) for (const s of [-1, 1]) box(g, 0.06, 0.8, 0.06, -L * 0.38 + i * (c2 / 8), 6.26, s * W * 0.38, M.dark);
      for (const s of [-1, 1]) box(g, c2, 0.06, 0.06, -L * 0.18, 7.04, s * W * 0.38, M.dark);
    } else {
      box(g, 2.6, 1.5, W * 0.6, L * 0.05, 3.9, 0, M.boat, { r: 0.25 });
      box(g, 3.0, 0.12, W * 0.7, L * 0.05, 5.4, 0, M.boatDark);
      cyl(g, 0.07, 0.07, 2.4, -L * 0.3, 3.9, 0, M.dark, { seg: 5 });
    }
    // deck rail along the hull + the fore-deck
    for (const s of [-1, 1]) box(g, L * 0.8, 0.06, 0.06, -L * 0.04, 2.55, s * W * 0.47, M.dark);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(g, 0.05, 0.95, 0.05, L * 0.14 + i * L * 0.06, 1.6, s * W * 0.44, M.dark);
    // a small wake: two dark strokes on the water behind and beside the bow
    for (const s of [-1, 1]) {
      const w = box(g, 9, 0.03, 0.18, -L / 2 - 4, 0, s * 1.3, M.mid, { cast: false, receive: false, ry: s * 0.12 });
      w.position.y = -0.12;
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.userData.noBlock = true; } });
    root.add(g);
    return g;
  }
  const boats = [
    { g: ferry(true), z: -64, v: 3.0, x0: -44, span: 760 },
    { g: ferry(false), z: -104, v: -2.3, x0: 58, span: 760 },
  ];
  updaters.push((t) => {
    for (const b of boats) {
      const s = ((b.x0 + 380 + t * b.v) % b.span + b.span) % b.span - 380;
      b.g.position.set(s, WATER_Y + 0.15 + Math.sin(t * 0.8 + b.z) * 0.06, b.z);
      b.g.rotation.y = b.v > 0 ? 0 : Math.PI;
      b.g.rotation.x = Math.sin(t * 0.6 + b.z) * 0.006;
    }
  });
  // birds: little ink Vs gliding across the sky with a lazy flap
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const g = group(root, 0, 0, 0);
    const wings = [-1, 1].map((s) => {
      const w = group(g, 0, 0, 0);
      const m = add(new THREE.BoxGeometry(1.0, 0.06, 0.32), M.bird, w, { cast: false, receive: false });
      m.position.x = s * 0.5;
      return w;
    });
    sphere(g, 0.16, 0, 0, 0.05, M.bird, [0.8, 0.6, 1.5], { seg: 8, cast: false });
    g.traverse((o) => { if (o.isMesh) o.userData.noBlock = true; });
    birds.push({ g, wings, ph: i * 1.7, y: 22 + rand(0, 26), z: -40 - rand(0, 80), v: 3 + rand(0, 2.5), x0: rand(-150, 150), s: 1.4 + rand(0, 1.2) });
  }
  updaters.push((t) => {
    for (const b of birds) {
      const x = ((b.x0 + 200 + t * b.v) % 400) - 200;
      b.g.position.set(x, b.y + Math.sin(t * 0.4 + b.ph) * 2, b.z + Math.sin(t * 0.13 + b.ph) * 6);
      b.g.rotation.y = Math.PI / 2;
      b.g.scale.setScalar(b.s);
      const f = Math.sin(t * 3.2 + b.ph) * 0.45 + 0.1;
      b.wings[0].rotation.z = f; b.wings[1].rotation.z = -f;
    }
  });

  // ---- the sky: drawn panorama around the camera (not outlined) ---------------------
  const pano = (() => {
    const { ELB, ELT } = TX.PANO;
    const Rr = 1200;
    const yb = Rr * Math.tan((ELB * Math.PI) / 180), yt = Rr * Math.tan((ELT * Math.PI) / 180);
    const geo = new THREE.CylinderGeometry(Rr, Rr, yt - yb, 160, 1, true);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    geo.translate(0, (yt + yb) / 2, 0);
    const mat = backdropMaterial(TX.panoramaTexture());
    mat.side = THREE.BackSide;
    mat.depthWrite = false;
    const m = new THREE.Mesh(geo, mat);
    m.layers.set(1);
    m.renderOrder = -10;
    m.frustumCulled = false;
    root.add(m);
    return m;
  })();
  updaters.push((t, dt, ctx) => { pano.position.copy(ctx.camera.position); });

  // =====================================================================
  // HUD extras: photo postcard + album, the café dialogue panel
  // =====================================================================
  const hud = document.getElementById('hud');
  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; parent?.appendChild(e); return e; };
  const flash = el('div', '', document.body); flash.id = 'sh-flash';
  const postcard = el('div', 'hidden', hud); postcard.id = 'sh-postcard';
  const pcImg = el('img', '', postcard); pcImg.alt = '';
  const pcCap = el('div', 'cap', postcard);
  const pcTitle = el('span', '', pcCap), pcNum = el('span', 'num', pcCap);
  const albumEl = el('div', 'panel', hud); albumEl.id = 'sh-album';
  albumEl.innerHTML = '<svg viewBox="0 0 26 20" aria-hidden="true"><rect x="1.5" y="4.5" width="23" height="14" rx="2.5"/><path d="M8 4.5 L10 1.5 H16 L18 4.5"/><circle cx="13" cy="11.5" r="4.2"/></svg>';
  const albumThumb = el('img', '', albumEl); albumThumb.alt = '';
  const albumLabel = el('span', '', albumEl);
  const dlg = el('div', 'hidden', hud); dlg.id = 'sh-dialogue';
  const dlgWho = el('div', 'who', dlg), dlgLine = el('div', 'line', dlg);
  const dlgMore = el('div', 'more', dlg); dlgMore.innerHTML = '<kbd>E</kbd> ▸';
  let dlgKey = null, dlgTimer = 0;
  const renderAlbum = () => {
    albumLabel.textContent = `${tr('Photos')} ${album.length}`;
    albumEl.style.display = album.length ? '' : 'none';
    if (album.length) albumThumb.src = album[album.length - 1];
  };
  const renderText = () => {
    pcTitle.textContent = tr('The Bund, Shanghai');
    dlgWho.textContent = tr('Barista');
    if (dlgKey) dlgLine.textContent = tr(dlgKey);
    renderAlbum();
  };
  renderText();
  const offLang = onLang(renderText);

  const photo = { pending: -1, show: -1 };
  function takePhoto() {
    const src = document.querySelector('#app canvas');
    const W = 900, Hh = 600;
    const c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const g2 = c.getContext('2d');
    // a 3:2 crop around the skyline (upper middle of the frame, the traveler at the bottom)
    const sw = src.width, sh = src.height;
    const cw = Math.min(sw * 0.74, sh * 0.82 * 1.5), ch = cw / 1.5;
    g2.drawImage(src, (sw - cw) / 2, Math.max(0, sh * 0.5 - ch * 0.62), cw, ch, 0, 0, W, Hh);
    const url = c.toDataURL('image/jpeg', 0.85);
    album.push(url);
    pcImg.src = url;
    pcNum.textContent = `№ ${album.length}`;
    flash.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => flash.classList.remove('on')));
    postcard.classList.remove('hidden', 'away');
    photo.show = 3.4;
    renderAlbum();
  }

  // =====================================================================
  // INTERACTIONS
  // =====================================================================
  const skyYaw = -SKYLINE_AZ * Math.PI / 180;
  const [skyX, skyZ] = at(SKYLINE_AZ, 300);
  actionSpot('viewpoint', 'Look at the skyline', {
    x: 0.0, z: -2.1, radius: 1.05, prompt: [0.6, 1.55, -2.5], noReach: true,
    act(ctx) {
      ctx.face(skyX, skyZ);
      ctx.pan({ yaw: skyYaw, pitch: 0.03, dist: 3.8, rate: 1.0, lock: 2.6, lookUp: 0.75 });
      ctx.caption('The Bund, Shanghai. A familiar skyline, seen from a different perspective.', 5);
      ctx.sound('chime');
      visited.add(2);
    },
  });
  actionSpot('photo', 'Take a photo', {
    x: 6.75, z: -2.05, radius: 0.95, prompt: [6.75, 1.45, -2.85],
    act(ctx) {
      if (photo.pending > 0) return;
      ctx.face(skyX, skyZ);
      ctx.pan({ yaw: skyYaw + 0.06, pitch: 0.02, dist: 4.4, rate: 1.6, lock: 1.6, lookUp: 0.9 });
      photo.pending = 1.45;
      ctx.caption(album.length ? 'Another one for the album.' : 'Click! Saved to your photo album.', 3.4);
      ctx.complete('photo');
    },
  });
  const baristaLines = [
    'Take a moment. Watch the boats pass, and let the city move around you.',
    'First time on the Bund? The skyline looks different from every bench.',
    'One latte, coming up. The window seat has the best view.',
  ];
  let baristaI = 0;
  actionSpot('barista', 'Talk to the barista', {
    x: 13.45, z: 4.55, radius: 1.3, prompt: [13.45, 1.95, 6.45],
    act(ctx) {
      dlgKey = baristaLines[baristaI % baristaLines.length];
      baristaI++;
      dlgLine.textContent = tr(dlgKey);
      dlgWho.textContent = tr('Barista');
      dlg.classList.remove('hidden');
      document.getElementById('caption')?.classList.add('hidden'); // one voice at a time
      dlgTimer = 7;
      baristaTalk = 4;
      barista.reach();
      ctx.sound('talk');
      ctx.complete('cafe');
    },
  });
  actionSpot('lifering', 'Check the life ring', {
    x: 2.25, z: -2.15, radius: 0.7, prompt: [2.25, 1.15, -2.85],
    act(ctx) { ringSwing = 1; ctx.caption('A life ring, just in case. The river is wide here.', 3.4); },
  });
  actionSpot('seagull', 'Say hi to the seagull', {
    x: -2.25, z: -2.2, radius: 0.6, prompt: [-2.25, 1.45, RAIL_Z],
    act(ctx) { gull.flap = 1.6; ctx.sound('squeak'); ctx.caption('Squawk! The seagull eyes your backpack.', 3.2); },
  });
  let ringSwing = 0;
  const benchCaption = 'The ferries glide by. Nobody is in a hurry here.';
  BENCHES.forEach(([x, z], i) => {
    interactables.push({
      id: `bench${i}`, label: 'Sit on the bench', kind: 'seat', x, z: z - 0.6, radius: 0.8,
      pos: new THREE.Vector3(x, 0.95, z),
      seat: { seat: [x, 0.28, z + 0.0], exit: [x, z - 0.72], via: [], pose: 'sit', facing: Math.PI, caption: benchCaption, cam: { yaw: 0.1, pitch: 0.12, dist: 3.2 } },
    });
  });
  const cafeEnterCaption = 'Bund Coffee. It smells like fresh espresso.';

  // ---- explore objective: four spots along the waterfront ----------------------
  const ZONES = [[-14.5, 1.5], [-6.5, 5.2], [0.4, -2.0], [8.4, -1.2]];
  const visited = new Set();
  const exploreText = () => tr('Explore the waterfront ({n}/{m})', { n: visited.size, m: ZONES.length });
  const finished = new Set();
  let endT = -1, wasInCafe = false, ended = false;

  // ---- camera blockers: café walls/roof + every solid chunk near the walk ----------
  root.updateMatrixWorld(true);
  const camBlockers = [...cafeBlockers];
  const size = new THREE.Vector3(), wp = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.layers.mask !== 1 || camBlockers.includes(o) || o === pano) return;
    if (o.userData.noBlock || o.userData.farField) return;
    if (npcs.some((v) => v.root.getObjectById(o.id))) return;
    o.getWorldPosition(wp);
    if (Math.abs(wp.x) > 30 || wp.z < -4 || wp.z > 10) return;
    o.geometry.computeBoundingBox();
    o.geometry.boundingBox.getSize(size);
    size.multiply(new THREE.Vector3().setFromMatrixScale(o.matrixWorld));
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    if (dims[0] > 0.05 && dims[1] > 0.3 && dims[2] > 0.5) camBlockers.push(o);
  });

  // ---- per-frame -------------------------------------------------------------------
  function update(t, dt, ctx) {
    for (const u of updaters) u(t, dt, ctx);
    const p = ctx.player.pos;
    for (let i = 0; i < ZONES.length; i++) if (Math.hypot(p.x - ZONES[i][0], p.z - ZONES[i][1]) < 1.8) visited.add(i);
    if (visited.size >= ZONES.length) ctx.complete('explore');
    const objEl = document.getElementById('obj-explore');
    if (objEl && !objEl.classList.contains('done')) { const txt = exploreText(); if (objEl.textContent !== txt) objEl.textContent = txt; }
    // finding the café: step inside
    const inside = inCafe(p.x, p.z);
    if (inside && !wasInCafe) { if (!finished.has('cafe')) ctx.caption(cafeEnterCaption, 3.2); ctx.complete('cafe'); }
    wasInCafe = inside;

    // barista: watches you while you are near, otherwise works the machine
    baristaTalk = Math.max(0, baristaTalk - dt);
    const near = inside && p.z > 3.2;
    const want = near || baristaTalk > 0 ? Math.atan2(p.x - barista.root.position.x, p.z - barista.root.position.z) : Math.PI + 0.9 + Math.sin(t * 0.4) * 0.25;
    baristaLook += Math.atan2(Math.sin(want - baristaLook), Math.cos(want - baristaLook)) * (1 - Math.exp(-dt * 3));
    barista.root.rotation.y = baristaLook;
    for (const v of npcs) v.update(dt, t, { speed: 0 });

    // dialogue: closes on its own, or when you walk away
    if (!dlg.classList.contains('hidden')) {
      dlgTimer -= dt;
      if (dlgTimer <= 0 || Math.hypot(p.x - 13.45, p.z - 4.6) > 2.6) { dlg.classList.add('hidden'); dlgKey = null; }
    }
    // photo: shutter after the camera settles, postcard shows, then flies to the album
    if (photo.pending > 0) { photo.pending -= dt; if (photo.pending <= 0) { takePhoto(); ctx.sound('click'); } }
    if (photo.show > 0) { photo.show -= dt; if (photo.show <= 0) postcard.classList.add('away'); }

    // seagull: looks around, flaps when greeted
    gull.look -= dt;
    if (gull.look < 0) { gull.look = 1.5 + Math.random() * 2.5; gull.headTarget = (Math.random() - 0.5) * 1.8; }
    gull.head.rotation.y += ((gull.headTarget ?? 0) - gull.head.rotation.y) * (1 - Math.exp(-dt * 8));
    gull.flap = Math.max(0, gull.flap - dt);
    const fl = gull.flap > 0 ? Math.sin(t * 22) * 0.5 * Math.min(1, gull.flap) : 0;
    gull.body.children[1].rotation.z = -0.1 - Math.max(0, fl) * 1.6;
    gull.body.children[2].rotation.z = 0.1 + Math.max(0, fl) * 1.6;
    gull.body.position.y = gull.flap > 0 ? Math.abs(Math.sin(t * 11)) * 0.06 * Math.min(1, gull.flap) : 0;
    // life ring swings when touched
    ringSwing = Math.max(0, ringSwing - dt * 0.5);
    ring.rotation.z = Math.sin(t * 5) * 0.12 * ringSwing;

    // all three done: the closing line
    if (endT > 0) { endT -= dt; if (endT <= 0) { ended = true; ctx.caption('The Bund, Shanghai. Different place. Same you.', 5); ctx.sound('chime'); } }
  }

  function viewAt(x, z) {
    if (inCafe(x, z)) return { dist: 2.2 };
    return { dist: 3.0 };
  }

  return {
    root,
    colliders,
    camBlockers,
    interactables,
    stars,
    update,
    heightAt,
    viewAt,
    explored: () => visited.size,
    objectiveText: (id, isDone) => (id === 'explore' && !isDone ? exploreText() : undefined),
    onComplete(id) {
      finished.add(id);
      if (['explore', 'cafe', 'photo'].every((k) => finished.has(k)) && endT < 0) endT = 2.2;
    },
    // strings shown outside captions / prompts (for the language check)
    strings: [...baristaLines, 'Barista', 'Photos', 'The Bund, Shanghai', 'Explore the waterfront ({n}/{m})', cafeEnterCaption, 'The Bund, Shanghai. Different place. Same you.'],
    walkable: [{ id: 'promenade', x: [WEST_X, EAST_X], z: [RAIL_Z, LAND_Z] }],
    // test hooks: moving things + HUD extras
    debug: () => ({
      boats: boats.map((b) => +b.g.position.x.toFixed(2)),
      birds: birds.map((b) => +b.g.position.x.toFixed(2)),
      waterTime: +waterMat.uniforms.uTime.value.toFixed(2),
      album: album.length,
      postcard: !postcard.classList.contains('hidden') && !postcard.classList.contains('away'),
      dialogue: dlg.classList.contains('hidden') ? null : dlgLine.textContent,
      ended,
    }),
    dispose() {
      offLang();
      flash.remove(); postcard.remove(); albumEl.remove(); dlg.remove();
    },
  };
}
