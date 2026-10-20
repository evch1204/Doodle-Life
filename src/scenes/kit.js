import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Geometry batching for the far scenery (the Bund, Pudong, Taipei): every piece is merged
// into one mesh per material (one draw call each), and keeps its own outline
// id so the ink pass still draws the line between touching parts.

// Outline ids in this band stay bold however far away they are (the four
// landmarks); everything else in the far field fades with distance (ink.js).
export const BOLD = [0.6, 0.64];
export const boldId = (k) => BOLD[0] + 0.004 + (k % 9) * 0.004;
export function farId(r) {
  let v = 0.05 + r * 0.9;
  if (v > BOLD[0] - 0.006 && v < BOLD[1] + 0.006) v += 0.06;
  return v;
}

const KEEP = new Set(['position', 'normal', 'uv']);
function prep(geo, id) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
  const n = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('inkIdAttr', new THREE.Float32BufferAttribute(new Float32Array(n).fill(id), 1));
  g.clearGroups();
  return g;
}

// One geometry per material group (box faces, cylinder caps, extrude caps / sides).
function splitGroups(geo) {
  if (!geo.groups.length) return [[geo, 0]];
  return geo.groups.map((gr) => {
    const sub = new THREE.BufferGeometry();
    if (geo.index) {
      for (const k of Object.keys(geo.attributes)) sub.setAttribute(k, geo.attributes[k]);
      sub.setIndex(Array.from(geo.index.array.slice(gr.start, gr.start + gr.count)));
      return [sub.toNonIndexed(), gr.materialIndex];
    }
    for (const [k, a] of Object.entries(geo.attributes)) {
      sub.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
    }
    return [sub, gr.materialIndex];
  });
}

// A box whose faces count whole bays across (u) and floors up (v), in tiles of
// `tile` bays / floors, so a facade module never gets cut at a corner.
export function boxGeo(w, h, d, { bay = 0, floor = 0, tile = 4 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (bay) {
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      const nu = Math.max(1, Math.round(dims[f][0] / bay)) / tile;
      const nv = (floor ? dims[f][1] / floor : 1) / tile;
      for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * nu, uv.getY(i) * nv); }
    }
  }
  return g;
}

export class Batch {
  constructor() { this.parts = new Map(); }
  // mat: one material, or an array indexed by the geometry's groups (null skips a group)
  add(geo, mat, id) {
    if (Array.isArray(mat)) {
      for (const [sub, mi] of splitGroups(geo)) if (mat[mi]) this.add(sub, mat[mi], id);
      return;
    }
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(prep(geo, id));
  }
  // y is the bottom of the box. o: ry, top (roof material), bay / floor / tile (facade UVs)
  box(w, h, d, x, y, z, mat, id, o = {}) {
    const g = boxGeo(w, h, d, o);
    if (o.ry) g.rotateY(o.ry);
    g.translate(x, y + h / 2, z);
    this.add(g, o.top || o.side ? [o.side ?? mat, o.side ?? mat, o.top ?? mat, o.top ?? mat, mat, mat] : mat, id);
  }
  cyl(rt, rb, h, x, y, z, mat, id, o = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 16, o.hseg ?? 1, o.open ?? false);
    if (o.u || o.v) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (o.u ?? 1), uv.getY(i) * (o.v ?? 1)); }
    if (o.ry) g.rotateY(o.ry);
    g.translate(x, y + h / 2, z);
    this.add(g, o.top ? [mat, o.top, o.top] : mat, id);
  }
  // a transformed copy of any geometry (m: Matrix4)
  geo(geo, mat, id, m) {
    if (m) geo.applyMatrix4(m);
    this.add(geo, mat, id);
  }
  flush(root, { cast = false, receive = false } = {}) {
    const meshes = [];
    for (const [mat, geos] of this.parts) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      m.userData.noBlock = true;
      m.userData.farField = true;
      root.add(m);
      meshes.push(m);
    }
    this.parts.clear();
    return meshes;
  }
}

// A frame for building one object at (x, y, z) turned by ry: put(geo, ...)
// applies the placement and adds the piece to the batch.
export function placer(batch, x, y, z, ry = 0) {
  const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  return (geo, mat, id) => batch.geo(geo, mat, id, M);
}
