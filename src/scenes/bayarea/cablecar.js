import * as THREE from 'three';
import { ink } from '../../ink.js';
import * as BX from '../../bayTextures.js';
import { Batch, farId } from '../kit.js';
import { boxG, cylG, sphG } from './props.js';

// A Powell Street cable car: an open grip section with outward-facing benches
// and grab poles at the front, an enclosed cabin of wainscot panels and a band
// of windows at the back, platforms with dash panels at both ends (the car
// number, a headlight), a clerestory roof with the destination boards, and
// two trucks of wheels under the sill. Built in its own frame (x forward along
// the track, y up from the rail head, z across) into one movable group.

export const CAR = { L: 8.4, W: 2.5 };

// one set per scene load, shared by every car
export function cableCarMaterials() {
  return {
    body: ink({ tone: 0.5, facing: 0.5, hatchFreq: 18 }),
    panel: ink({ tone: 0.62, facing: 0.5, hatch: 0.5 }),
    cream: ink({ tone: 0.97, facing: 0.5, hatchFreq: 18 }),
    trim: ink({ tone: 0.88, facing: 0.5, hatch: 0 }),
    roof: ink({ tone: 0.4, facing: 0.5, hatchFreq: 18 }),
    dark: ink({ tone: 0.16, facing: 0.3, hatch: 0 }),
    glass: ink({ tone: 0.42, facing: 0.15, hatch: 0 }),
    seat: ink({ tone: 0.74, facing: 0.6, hatchFreq: 18 }),
    brass: ink({ tone: 0.7, facing: 0.6, hatch: 0 }),
    glow: ink({ tone: 1, facing: 0, hatch: 0 }),
    people: ink({ tone: 0.9, facing: 0.6, hatchFreq: 30 }),
    peopleDark: ink({ tone: 0.3, facing: 0.4, hatch: 0 }),
    sign: ink({ map: BX.cableCarSignTexture(), facing: 0.1, hatch: 0 }),
    num: ink({ map: BX.cableCarNumberTexture('28'), facing: 0.1, hatch: 0 }),
    side: ink({ map: BX.cableCarSideTexture(), facing: 0.1, hatch: 0 }),
  };
}

export function buildCableCar(M, { passengers = true, seed = 0.41 } = {}) {
  const B = new Batch();
  const id = farId(seed), idW = id + 0.004, idR = id + 0.008, idP = id + 0.012;
  const add = (g, m, i = id) => B.add(g, m, i);
  const { L } = CAR, HL = L / 2, BW = 2.3, HW = BW / 2;
  const SILL = 0.72, FLOOR = 0.95, WIN0 = 1.72, WIN1 = 2.6, EAVE = 2.95;
  const cabin = [-3.55, 0.55], open = [0.55, 3.55];

  // ---- trucks and wheels ------------------------------------------------------------------
  for (const tx of [-2.6, 2.6]) {
    add(boxG(1.9, 0.26, 1.5, tx, 0.42, 0), M.dark);
    for (const ax of [-0.6, 0.6]) for (const sz of [-0.56, 0.56]) {
      const w = new THREE.CylinderGeometry(0.32, 0.32, 0.09, 16); w.rotateX(Math.PI / 2); w.translate(tx + ax, 0.32, sz);
      add(w, M.dark, idR);
      const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8); hub.rotateX(Math.PI / 2); hub.translate(tx + ax, 0.32, sz + Math.sign(sz) * 0.03);
      add(hub, M.brass, idR);
    }
    add(boxG(0.3, 0.2, 1.7, tx, 0.5, 0), M.dark, idR); // the bolster
  }
  // the grip: a slotted shoe under the middle, its lever up through the floor
  add(boxG(0.5, 0.35, 0.14, 1.8, 0.12, 0), M.dark, idR);
  add(boxG(0.06, 1.6, 0.06, 1.8, FLOOR - 0.1, 0), M.dark, idR);
  add(sphG(0.06, 1.8, FLOOR + 1.52, 0, 1, 1, 1, 8), M.brass, idR);

  // ---- the sill, the floor, running boards and platform steps ----------------------------
  add(boxG(L, 0.24, BW, 0, SILL, 0), M.body);
  add(boxG(L - 0.1, 0.03, BW - 0.1, 0, FLOOR - 0.01, 0), M.seat);
  for (const sz of [-1, 1]) {
    add(boxG(open[1] - open[0] + 0.4, 0.05, 0.32, (open[0] + open[1]) / 2, SILL - 0.02, sz * (HW + 0.16)), M.seat);
    for (const sx of [-1, 1]) add(boxG(0.1, 0.22, 0.32, (open[0] + open[1]) / 2 + sx * 1.6, SILL - 0.22, sz * (HW + 0.16)), M.dark);
    // the side panel of the sill: painted lettering along the cabin
    const g = new THREE.PlaneGeometry(cabin[1] - cabin[0] - 0.4, 0.2); g.rotateY(sz > 0 ? 0 : Math.PI); g.translate((cabin[0] + cabin[1]) / 2, SILL + 0.12, sz * (HW + 0.012));
    add(g, M.side, idW);
  }
  for (const ex of [-1, 1]) add(boxG(0.4, 0.06, 1.0, ex * (HL + 0.12), SILL - 0.25, 0), M.dark); // end steps

  // ---- the enclosed cabin ----------------------------------------------------------------
  const cL = cabin[1] - cabin[0], cX = (cabin[0] + cabin[1]) / 2;
  const nWin = 5, pitch = cL / nWin;
  for (const sz of [-1, 1]) {
    const zf = sz * HW;
    // wainscot: a dark panel band with raised panels framed in trim
    add(boxG(cL, WIN0 - FLOOR, 0.08, cX, FLOOR, zf - sz * 0.04), M.body);
    for (let i = 0; i < nWin; i++) {
      const px = cabin[0] + pitch * (i + 0.5);
      add(boxG(pitch - 0.3, 0.42, 0.03, px, FLOOR + 0.17, zf + sz * 0.012), M.panel, idW);
      for (const dy of [0.12, 0.62]) add(boxG(pitch - 0.2, 0.04, 0.03, px, FLOOR + dy, zf + sz * 0.02), M.trim, idW);
    }
    add(boxG(cL + 0.04, 0.07, 0.12, cX, WIN0 - 0.06, zf), M.trim, idW);             // the window sill rail
    // the window band: posts between the windows, glass, sashes split in two
    for (let i = 0; i <= nWin; i++) add(boxG(0.13, WIN1 - WIN0, 0.1, cabin[0] + pitch * i, WIN0, zf - sz * 0.03), M.cream, idW);
    for (let i = 0; i < nWin; i++) {
      const px = cabin[0] + pitch * (i + 0.5);
      const g = new THREE.PlaneGeometry(pitch - 0.13, WIN1 - WIN0); g.rotateY(sz > 0 ? 0 : Math.PI); g.translate(px, (WIN0 + WIN1) / 2, zf - sz * 0.05);
      add(g, M.glass, idW);
      add(boxG(pitch - 0.13, 0.05, 0.05, px, WIN0 + (WIN1 - WIN0) * 0.55, zf - sz * 0.02), M.cream, idW);
    }
    // the letterboard above the windows
    add(boxG(cL, EAVE - WIN1, 0.1, cX, WIN1, zf - sz * 0.03), M.cream, idW);
    add(boxG(cL + 0.1, 0.05, 0.14, cX, WIN1, zf), M.trim, idW);
  }
  // the cabin's end bulkheads: a door with a window, windows either side
  for (const [ex, sx] of [[cabin[0], -1], [cabin[1], 1]]) {
    add(boxG(0.08, WIN0 - FLOOR, BW, ex, FLOOR, 0), M.body);
    for (const sz of [-1, 1]) add(boxG(0.1, WIN1 - WIN0, 0.55, ex, WIN0, sz * (HW - 0.28)), M.cream, idW);
    add(boxG(0.1, WIN1 - WIN0, 0.14, ex, WIN0, 0), M.cream, idW);
    for (const sz of [-1, 1]) {
      const g = new THREE.PlaneGeometry(0.52, WIN1 - WIN0 - 0.1); g.rotateY(sx > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(ex + sx * 0.055, (WIN0 + WIN1) / 2, sz * 0.36);
      add(g, M.glass, idW);
    }
    add(boxG(0.1, EAVE - WIN1, BW, ex, WIN1, 0), M.cream, idW);
  }

  // ---- the open grip section: outward benches back to back, grab poles, the end screen ----
  const oL = open[1] - open[0], oX = (open[0] + open[1]) / 2;
  add(boxG(oL - 0.2, 0.5, 0.12, oX, FLOOR, 0), M.body);                            // the bench backs' base
  for (const sz of [-1, 1]) {
    add(boxG(oL - 0.3, 0.08, 0.5, oX, FLOOR + 0.42, sz * 0.36), M.seat, idW);
    add(boxG(oL - 0.3, 0.42, 0.07, oX, FLOOR + 0.5, sz * 0.1), M.seat, idW);
    add(boxG(oL - 0.3, 0.42, 0.05, oX, FLOOR, sz * 0.6), M.body, idW);
    for (let i = 0; i <= 3; i++) add(cylG(0.035, 0.035, EAVE - FLOOR, open[0] + 0.15 + ((oL - 0.3) * i) / 3, FLOOR, sz * (HW - 0.05), 8), M.brass, idW);
    add(boxG(oL, EAVE - WIN1, 0.08, oX, WIN1, sz * (HW - 0.04)), M.cream, idW);
  }
  // the front dash and the rear dash: low walls with the number plate and a headlight
  for (const [ex, sx] of [[HL - 0.04, 1], [-HL + 0.04, -1]]) {
    add(boxG(0.08, 1.05, BW, ex, FLOOR, 0), M.body);
    add(boxG(0.14, 0.06, BW + 0.04, ex, FLOOR + 1.05, 0), M.trim);
    const g = new THREE.PlaneGeometry(1.4, 0.7); g.rotateY(sx > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(ex + sx * 0.052, FLOOR + 0.5, 0);
    add(g, M.num, idW);
    const hl = new THREE.CylinderGeometry(0.15, 0.17, 0.2, 14); hl.rotateZ(Math.PI / 2); hl.translate(ex + sx * 0.14, FLOOR + 1.28, 0);
    add(hl, M.dark, idW);
    const lens = new THREE.CircleGeometry(0.12, 14); lens.rotateY(sx > 0 ? Math.PI / 2 : -Math.PI / 2); lens.translate(ex + sx * 0.245, FLOOR + 1.28, 0);
    add(lens, M.glow, idW + 0.001);
    for (const sz of [-1, 1]) add(cylG(0.035, 0.035, EAVE - FLOOR, ex - sx * 0.05, FLOOR, sz * (HW - 0.05), 8), M.brass, idW);
  }
  // the bell on the roof's front edge
  add(sphG(0.11, HL - 0.6, EAVE + 0.35, 0, 1, 0.9, 1, 10), M.brass, idR);

  // ---- the roof: eaves over the whole car, the raised clerestory, the bonnets ------------
  add(boxG(L + 0.1, 0.1, BW + 0.24, 0, EAVE, 0), M.roof, idR);
  add(boxG(L - 1.6, 0.34, 1.3, 0, EAVE + 0.1, 0), M.cream, idR);
  for (const sz of [-1, 1]) {
    const g = new THREE.PlaneGeometry(L - 1.8, 0.2); g.rotateY(sz > 0 ? 0 : Math.PI); g.translate(0, EAVE + 0.27, sz * 0.66);
    add(g, M.glass, idW);
    for (let i = 0; i <= 12; i++) add(boxG(0.05, 0.22, 0.02, -(L - 1.8) / 2 + ((L - 1.8) * i) / 12, EAVE + 0.16, sz * 0.66), M.cream, idW);
  }
  add(boxG(L - 1.4, 0.07, 1.55, 0, EAVE + 0.44, 0), M.roof, idR);
  for (const sx of [-1, 1]) {
    const bon = new THREE.BoxGeometry(0.95, 0.07, BW + 0.2); bon.rotateZ(sx * -0.22); bon.translate(sx * (HL - 0.35), EAVE + 0.2, 0);
    add(bon, M.roof, idR);
    // the destination board over each end
    const sg = new THREE.BoxGeometry(0.06, 0.32, 1.7); sg.translate(sx * (HL - 0.78), EAVE + 0.68, 0);
    add(sg, [M.sign, M.sign, M.dark, M.dark, M.dark, M.dark], idW);
    for (const sz of [-0.7, 0.7]) add(boxG(0.04, 0.2, 0.04, sx * (HL - 0.78), EAVE + 0.5, sz), M.dark, idW);
  }

  // ---- passengers: simple seated figures in the cabin windows and on the benches ---------
  if (passengers) {
    const person = (x, z, dark, h = 1) => {
      add(sphG(0.17, x, FLOOR + 0.5 + 0.38 * h, z, 1, 1.3, 0.9, 10), dark ? M.peopleDark : M.people, idP);
      add(sphG(0.12, x, FLOOR + 0.93 + 0.38 * h, z, 1, 1.05, 1, 10), M.people, idP + 0.002);
      add(sphG(0.125, x, FLOOR + 0.98 + 0.38 * h, z - 0.01, 1, 0.8, 1, 10), M.peopleDark, idP + 0.004);
    };
    person(-2.6, 0.55, false); person(-1.1, -0.55, true); person(-0.3, 0.55, false, 0.9);
    person(1.3, 0.62, true); person(2.9, -0.62, false, 0.95);
  }

  const group = new THREE.Group();
  group.name = 'cablecar';
  B.flush(group, { cast: true, receive: true });
  return group;
}
