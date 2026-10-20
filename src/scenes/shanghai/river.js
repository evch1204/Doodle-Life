import * as THREE from 'three';
import { inkShared } from '../../ink.js';

// The Huangpu: one plane, drawn in the shader as a pen would draw water.
//  - ripple strokes in rows spaced by viewing angle (even on screen, like a
//    drawing), measured from the player at a fixed eye height so the rows do
//    not slide when the camera pitches or orbits; strokes taper, bow a little
//    and drift with the current (faster near, slower far: real parallax)
//  - a slow ripple field (world space) makes calmer and busier patches
//  - reflections: the reflected ray is followed to the far bank and to the
//    skyline, and looked up in a silhouette profile built from the real
//    buildings, so each tower drops a column of denser, longer strokes and a
//    soft wash straight below itself, broken by the ripples; the trees and
//    embankment leave a darker band along the waterline
//  - toward the horizon the strokes merge into an even, lighter tone

const SKY_Z = -420, SKY_HALF = 1100, SHORE_HALF = 1600, SKY_MAX = 300, SHORE_MAX = 30;

export function buildRiver(root, { WATER_Y, SHORE_Z, SHORE_Y, sky, shore }) {
  // silhouette profiles: row 0 = skyline height on the plane z = SKY_Z (seen
  // from the promenade), row 1 = the bank band on the plane z = SHORE_Z
  const N = 2048;
  const skyH = new Float32Array(N), shoreH = new Float32Array(N);
  const bank = SHORE_Y - WATER_Y;
  shoreH.fill(bank + 0.4);
  for (const s of sky) {
    const f = SKY_Z / s.z;
    const xc = s.x * f, hw = s.hw * f, top = (s.top + bank) * f;
    const i0 = Math.floor(((xc - hw) / (2 * SKY_HALF) + 0.5) * N), i1 = Math.ceil(((xc + hw) / (2 * SKY_HALF) + 0.5) * N);
    for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) skyH[i] = Math.max(skyH[i], top);
  }
  for (const s of shore) {
    const i0 = Math.floor(((s.x - s.hw) / (2 * SHORE_HALF) + 0.5) * N), i1 = Math.ceil(((s.x + s.hw) / (2 * SHORE_HALF) + 0.5) * N);
    for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) shoreH[i] = Math.max(shoreH[i], s.top - WATER_Y);
  }
  // soften the profile edges a little (a reflection never has a ruled edge)
  const soft = (a) => a.map((_, i) => (a[Math.max(0, i - 1)] + 2 * a[i] + a[Math.min(N - 1, i + 1)]) / 4);
  const skyS = soft(skyH);
  const data = new Uint8Array(N * 2 * 4);
  for (let i = 0; i < N; i++) {
    data[i * 4] = Math.min(255, (skyS[i] / SKY_MAX) * 255);
    data[(N + i) * 4 + 1] = Math.min(255, (shoreH[i] / SHORE_MAX) * 255);
  }
  const prof = new THREE.DataTexture(data, N, 2);
  prof.magFilter = prof.minFilter = THREE.LinearFilter;
  prof.needsUpdate = true;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3() }, uH0: { value: 3.0 },
      uTime: { value: 0 }, uProf: { value: prof }, uWaterY: { value: WATER_Y },
      uPlane: { value: new THREE.Vector4(SKY_Z, SHORE_Z, SKY_HALF, SHORE_HALF) },
      uMax: { value: new THREE.Vector2(SKY_MAX, SHORE_MAX) },
      uPaper: inkShared.uPaper, uInk: inkShared.uInk,
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCam, uCenter, uPaper, uInk;
      uniform float uTime, uH0, uWaterY;
      uniform sampler2D uProf;
      uniform vec4 uPlane;
      uniform vec2 uMax;
      varying vec3 vW;
      const float ROWK = 0.0105;
      float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
      }
      // the mirrored skyline (x) and far bank (y) at a point on the water: follow
      // the reflected eye ray to the bank and to the skyline plane, look the
      // silhouette heights up, and say how far down the mirror image we are
      vec2 reflAt(vec2 P, float row) {
        vec2 cd = P - uCam.xz;
        float cl = max(length(cd), 0.5);
        vec2 dir = cd / cl;
        float ta = max(uCam.y - uWaterY, 0.05) / cl;
        float fz = max(-dir.y, 0.05);
        float Ds = max(P.y - uPlane.y, 0.0) / fz, Dk = max(P.y - uPlane.x, 0.0) / fz;
        // each row of ripples shifts the image a little sideways, so the edges break up
        float jit = (hash(row * 5.3 + floor(uTime * 0.6 + hash(row) * 3.0)) - 0.5) * 0.014;
        float xs = P.x + (dir.x + jit) * Ds, xk = P.x + (dir.x + jit) * Dk;
        float hShore = texture2D(uProf, vec2(xs / (2.0 * uPlane.w) + 0.5, 0.75)).g * uMax.y;
        float hSky = texture2D(uProf, vec2(xk / (2.0 * uPlane.z) + 0.5, 0.25)).r * uMax.x;
        float qS = ta * Ds / max(hShore * 0.95, 0.1);
        float qK = ta * Dk / max(hSky * 0.62, 0.1);
        // the tall towers mirror strongly, the ordinary city only faintly
        float sky = (1.0 - smoothstep(0.7, 1.0, qK)) * mix(0.28, 1.0, smoothstep(70.0, 150.0, hSky)) * smoothstep(2.0, 6.0, hSky) * (1.0 - 0.45 * qK);
        float bank = 1.0 - smoothstep(0.8, 1.05, qS);
        float gap = step(0.84, hash(row * 3.3 + 5.0));  // a glint row cuts across
        return vec2(sky, bank) * (1.0 - 0.85 * gap);
      }
      // one family of ripple strokes in (row, azimuth) space; returns ink coverage.
      // mirror = 1: the strokes are the reflection, switched on per stroke by the
      // reflection at the stroke's own centre (so an image ends on whole strokes)
      float ripples(float rowf, float az, float dens, float lenK, float wid, float seed, float mirror) {
        float row = floor(rowf), fy = fract(rowf);
        float rh = hash(row * 1.7 + seed);
        float cw = mix(0.03, 0.07, rh) * lenK;           // stroke cell, radians of azimuth
        float dRow = uH0 / ((row + 0.5) * ROWK);         // the row's distance
        float drift = uTime * (0.35 + 0.5 * rh) / dRow;  // the current: faster near, slower far
        float u = (az + drift) / cw + rh * 37.0;
        float cell = floor(u), fu = fract(u);
        float hc = hash(cell * 1.31 + row * 7.13 + seed);
        float len = 0.45 + 0.45 * hash(cell * 2.7 + row * 1.9 + seed);
        float on = step(1.0 - dens, hc);
        if (mirror > 0.5) {
          float azc = (cell + 0.5 - rh * 37.0) * cw - drift;
          vec2 r = reflAt(uCenter.xz + vec2(sin(azc), -cos(azc)) * dRow, row);
          float k = max(r.x, r.y);
          on = step(1.0 - k * 0.97, hc);
          len = mix(len, 0.96, k);
        }
        float st = fu / len;
        float fwu = fwidth(u) / len;
        float inS = smoothstep(0.0, 0.08 + fwu, st) * (1.0 - smoothstep(0.92 - fwu, 1.0, st));
        float bow = 0.1 * sin(clamp(st, 0.0, 1.0) * 3.14159) * (hash(cell + row * 3.1 + seed) - 0.5) * 2.0;
        float taper = 0.6 + 0.4 * sin(clamp(st, 0.0, 1.0) * 3.14159);
        float fw = fwidth(rowf);
        float lw = wid * taper;
        float ln = 1.0 - smoothstep(lw - fw * 0.7, lw + fw * 0.7, abs(fy - 0.5 - bow));
        return ln * inS * on * (1.0 - smoothstep(0.3, 0.75, fw));
      }
      void main() {
        vec2 dv = vW.xz - uCenter.xz;
        float d = max(length(dv), 0.5);
        float az = atan(dv.x, -dv.y);
        float rowf = (uH0 / d) / ROWK;
        float fwr = fwidth(rowf);

        // calm and busy patches, drifting downstream
        vec2 wp = vW.xz * vec2(0.012, 0.035) + vec2(-uTime * 0.012, 0.0);
        float field = vnoise(wp) * 0.65 + vnoise(wp * 2.3 + 13.0) * 0.35;
        float dens = mix(0.14, 0.52, smoothstep(0.3, 0.72, field));

        float ink = ripples(rowf, az, dens, 1.0, 0.085, 3.0, 0.0) * 0.72;
        // the reflections: longer, darker strokes laid between the ripple rows
        ink = max(ink, ripples(rowf + 0.5, az, 0.0, 0.5, 0.12, 11.0, 1.0));
        // a light in-between layer where the water is busy
        ink = max(ink, ripples(rowf + 0.5, az, dens * 0.3, 0.6, 0.055, 17.0, 0.0) * 0.34);

        // tone: a faint gray surface, darker under the bank, an even gray where the rows merge
        vec2 r = reflAt(vW.xz, floor(rowf));
        float horizon = smoothstep(0.3, 0.9, fwr);
        float tone = mix(0.045, 0.085, horizon) + 0.06 * r.y + 0.03 * r.x * horizon;
        vec3 col = mix(uPaper, uInk, tone);
        col = mix(col, uInk, ink * 0.88);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3200, -SHORE_Z + 10, 1, 1), mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, SHORE_Z / 2 - 2);
  water.castShadow = water.receiveShadow = false;
  water.userData.noBlock = true;
  root.add(water);

  const update = (t, dt, ctx) => {
    mat.uniforms.uTime.value = t;
    const cam = ctx.camera.position, p = ctx.player.pos;
    mat.uniforms.uCam.value.copy(cam);
    // rows centre on the player (the third-person camera orbits it); a free camera far from the player uses its own spot and height
    const away = Math.hypot(cam.x - p.x, cam.z - p.z) > 4.2 || cam.y > 5;
    mat.uniforms.uCenter.value.set(away ? cam.x : p.x, 0, away ? cam.z : p.z);
    mat.uniforms.uH0.value = away ? cam.y - WATER_Y : 3.0;
  };
  return { water, mat, update };
}
