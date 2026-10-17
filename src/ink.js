import * as THREE from 'three';
import { makeRng } from './sketch.js';

// Colors are stored raw (display values): the color pass renders into a
// linear render target with no conversion, and the post pass writes them
// straight to the screen.
export const PAPER = new THREE.Color(0.937, 0.914, 0.862);
export const INK = new THREE.Color(0.11, 0.102, 0.094);

const shared = {
  uPaper: { value: PAPER },
  uInk: { value: INK },
  uLightI: { value: 1 },
  // 1 = ignore shadow-map results on surfaces the light barely grazes (acne);
  // set per scene (outdoors), 0 keeps the original room look.
  uGrazeFix: { value: 0 },
};
export const inkShared = shared;

const VERT_DECL = /* glsl */`
varying vec3 vInkPos;
varying vec3 vInkN;
varying vec2 vInkUv;
varying vec3 vInkLocal;
varying vec3 vInkLN;`;

const FRAG_DECL = /* glsl */`
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uLightI;
uniform float uGrazeFix;
uniform float uTone;
uniform float uFacing;
uniform float uHatchAmt;
uniform float uHatchFreq;
uniform float uMapAmt;
uniform float uTriScale;
uniform vec2 uMapRepeat;
uniform sampler2D uMap;
varying vec3 vInkPos;
varying vec3 vInkN;
varying vec2 vInkUv;
varying vec3 vInkLocal;
varying vec3 vInkLN;

float inkHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

// One family of hand-drawn hatch strokes, anchored in world space so they
// stay glued to the surface when the camera moves.
float hatchLines(vec2 p, float ang, float freq, float width, float seed) {
  float c = cos(ang), s = sin(ang);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * freq;
  float row = floor(q.x + 0.5);
  q.y += inkHash(row * 3.7 + seed) * 5.0;
  float u = q.x + 0.1 * sin(q.y * 0.21 + row * 1.7 + seed) + 0.06 * sin(q.y * 0.9 + row * 3.1);
  float fw = fwidth(q.x);
  float d = abs(fract(u) - 0.5);
  float ln = 1.0 - smoothstep(width - fw * 0.7, width + fw * 0.7, d);
  // Break strokes into dashes of varying length, like individual pen strokes.
  float segLen = 3.0 + inkHash(row + seed) * 4.0;
  float sg = fract(q.y / segLen + inkHash(row * 1.37 + seed * 2.1));
  ln *= smoothstep(0.0, 0.04, sg) * (1.0 - smoothstep(0.76, 0.84, sg));
  // Too dense to resolve: fade to an even tone instead of moire.
  ln = mix(ln, width * 1.2, smoothstep(0.3, 0.7, fw));
  return ln;
}`;

const FRAG_MAIN = /* glsl */`
  vec3 wn = normalize(vInkN);
  vec3 an = abs(wn);
  vec2 tp;
  if (an.y > an.x && an.y > an.z) tp = vInkPos.xz;
  else if (an.x > an.z) tp = vInkPos.zy;
  else tp = vInkPos.xy;

  float facing = 1.0;
  float shadowF = 1.0;
  #if NUM_DIR_LIGHTS > 0
    facing = dot(normal, directionalLights[0].direction);
    float expected = max(facing, 0.0) * uLightI;
    float got = dot(reflectedLight.directDiffuse, vec3(0.33333)) * PI;
    shadowF = expected > 0.04 ? clamp(got / expected, 0.0, 1.0) : 1.0;
    shadowF = mix(shadowF, 1.0, uGrazeFix * (1.0 - smoothstep(0.1, 0.4, facing)));
  #endif

  // turned away -> one layer of hatching, in shadow -> one layer,
  // both -> crosshatch. Mirrors the sparse shading in the reference.
  float lightness = mix(1.0, mix(0.55, 1.0, smoothstep(-0.6, 0.15, facing)), uFacing);
  lightness *= mix(1.0, mix(0.86, 1.0, wn.y * 0.5 + 0.5), uFacing);
  lightness *= mix(0.55, 1.0, shadowF);
  float dark = 1.0 - lightness;

  #ifdef INK_LOCAL
    // hatch anchored to the object itself (for things that move, like the player)
    vec3 aln = abs(vInkLN);
    vec2 lp = (aln.y > aln.x && aln.y > aln.z) ? vInkLocal.xz : (aln.x > aln.z ? vInkLocal.zy : vInkLocal.xy);
    vec2 hp = lp * uHatchFreq;
  #else
    vec2 hp = tp * uHatchFreq;
  #endif
  float h = 0.0;
  h = max(h, hatchLines(hp, 0.85, 1.0, 0.08, 1.0) * smoothstep(0.28, 0.4, dark));
  h = max(h, hatchLines(hp, -0.75, 1.0, 0.07, 7.0) * smoothstep(0.58, 0.68, dark) * 0.85);
  h *= uHatchAmt;

  vec3 col = mix(uInk, uPaper, uTone);
  #ifdef INK_MAP
    #ifdef INK_TRI
      vec2 muv = tp * uTriScale;
    #else
      vec2 muv = vInkUv * uMapRepeat;
    #endif
    float m = texture2D(uMap, muv).r;
    col = mix(col, uInk, (1.0 - m) * uMapAmt);
  #endif
  col = mix(col, uInk, h * 0.72 * smoothstep(0.25, 0.6, uTone));
  col *= mix(0.94, 1.0, lightness);
  gl_FragColor = vec4(col, diffuseColor.a);
`;

function inkCompile(shader) {
  Object.assign(shader.uniforms, shared, this.userData.ink);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_DECL)
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vInkPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vInkN = normalize(mat3(modelMatrix) * objectNormal);
      vInkUv = uv;
      vInkLocal = transformed;
      vInkLN = objectNormal;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
    .replace('#include <opaque_fragment>', FRAG_MAIN);
}

/**
 * Ink-on-paper surface material.
 *  tone:     1 = paper, 0 = solid ink
 *  facing:   how much the surface darkens when turned away from the light (walls use 0)
 *  map:      grayscale line art texture (white paper / black ink)
 *  tri:      if set, map is projected in world space with this many repeats per meter
 */
export function ink({
  tone = 1, facing = 1, hatch = 1, hatchFreq = 21,
  map = null, mapAmt = 1, tri = 0, repeat = [1, 1],
  side = THREE.FrontSide, flat = false, local = false,
} = {}) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side, flatShading: flat });
  m.userData.ink = {
    uTone: { value: tone },
    uFacing: { value: facing },
    uHatchAmt: { value: hatch },
    uHatchFreq: { value: hatchFreq },
    uMap: { value: map },
    uMapAmt: { value: mapAmt },
    uTriScale: { value: tri },
    uMapRepeat: { value: new THREE.Vector2(...repeat) },
  };
  m.defines = {};
  if (map) m.defines.INK_MAP = '';
  if (map && tri) m.defines.INK_TRI = '';
  if (local) m.defines.INK_LOCAL = '';
  m.onBeforeCompile = inkCompile;
  m.customProgramCacheKey = () => 'ink';
  return m;
}

// Unlit drawn backdrop (the view through the window).
export function backdropMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uPaper: shared.uPaper, uInk: shared.uInk, uOffset: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uPaper; uniform vec3 uInk; uniform vec2 uOffset;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(uMap, vUv + uOffset);
        if (t.a < 0.5) discard;
        gl_FragColor = vec4(mix(uInk, uPaper, t.r), 1.0);
      }`,
  });
}

// ---------------------------------------------------------------------------
// Post-processing: normal/depth/id pass + edge detection + paper composite.

const normalMaterial = new THREE.ShaderMaterial({
  uniforms: { uId: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec3 vN;
    void main() {
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform float uId;
    varying vec3 vN;
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      gl_FragColor = vec4(n * 0.5 + 0.5, uId);
    }`,
  side: THREE.DoubleSide,
});

// Each mesh gets a random id so touching objects with matching normals
// still get a separating line.
const idRng = makeRng(7);
function setId() {
  return function (renderer, scene, camera, geometry, material) {
    if (material === normalMaterial) {
      material.uniforms.uId.value = this.userData.inkId;
      material.uniformsNeedUpdate = true;
    }
  };
}
export function tagOutlines(root) {
  root.traverse((o) => {
    if (o.isMesh && o.userData.inkId === undefined) {
      o.userData.inkId = o.userData.outlineGroup ?? (0.05 + idRng() * 0.95);
      o.onBeforeRender = setId();
    }
  });
}

function noiseTexture(size, seed) {
  // Smooth value noise in RGB, tileable.
  const rng = makeRng(seed);
  const g = 16;
  const grid = [0, 1, 2].map(() => Array.from({ length: g * g }, () => rng()));
  const data = new Uint8Array(size * size * 4);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * g, fy = (y / size) * g;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const i = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) {
      const G = grid[c];
      const v = (a, b) => G[((b % g) * g) + (a % g)];
      const a = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx;
      const b = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx;
      data[i + c] = (a * (1 - ty) + b * ty) * 255;
    }
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function paperTexture(size, seed) {
  // Fine grain + a few soft fibres; kept subtle.
  const rng = makeRng(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 235 + rng() * 20;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#000';
  for (let i = 0; i < 140; i++) {
    const x = rng() * size, y = rng() * size, a = rng() * Math.PI * 2, l = 6 + rng() * 22;
    ctx.lineWidth = 0.6 + rng() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class InkRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.colorRT = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType });
    this.niRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType });
    this.niRT.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.FloatType);
    this.niRT.texture.minFilter = this.niRT.texture.magFilter = THREE.NearestFilter;

    this.post = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.colorRT.texture },
        tNI: { value: this.niRT.texture },
        tDepth: { value: this.niRT.depthTexture },
        tNoise: { value: noiseTexture(256, 3) },
        tPaper: { value: paperTexture(512, 5) },
        uRes: { value: size.clone() },
        uNear: { value: 0.05 },
        uFar: { value: 100 },
        uThick: { value: 1 },
        uWobble: { value: 1.1 },
        uProjInv: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uInk: shared.uInk,
        uPaper: shared.uPaper,
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor, tNI, tDepth, tNoise, tPaper;
        uniform vec2 uRes;
        uniform float uNear, uFar, uThick, uWobble;
        uniform mat4 uProjInv, uCamWorld;
        uniform vec3 uInk, uPaper;
        varying vec2 vUv;

        float lin(vec2 uv) {
          float z = texture2D(tDepth, uv).x;
          return (uNear * uFar) / (uFar - z * (uFar - uNear));
        }
        float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float vnoise(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        vec3 worldAt(vec2 uv) {
          float z = texture2D(tDepth, uv).x;
          vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
          return (uCamWorld * vec4(v.xyz / v.w, 1.0)).xyz;
        }

        // Edge strength at uv: depth steps (near side only), creases, object ids.
        float edgeAt(vec2 uv, vec2 px) {
          vec4 c0 = texture2D(tNI, uv);
          float d0 = lin(uv);
          vec3 n0 = c0.rgb * 2.0 - 1.0;
          float graze = 1.0 - clamp(abs(n0.z), 0.0, 1.0);
          float dThr = 0.022 * (1.0 + 7.0 * graze * graze) * (c0.a > 0.0 ? 1.0 : 3.0);
          vec2 offs[8];
          offs[0] = vec2(1.0, 0.0); offs[1] = vec2(-1.0, 0.0); offs[2] = vec2(0.0, 1.0); offs[3] = vec2(0.0, -1.0);
          offs[4] = vec2(0.7, 0.7); offs[5] = vec2(-0.7, 0.7); offs[6] = vec2(0.7, -0.7); offs[7] = vec2(-0.7, -0.7);
          float e = 0.0;
          for (int i = 0; i < 8; i++) {
            vec2 o = offs[i] * uThick * px;
            float rel = (lin(uv + o) - d0) / max(d0, 1e-3);
            float eDepth = smoothstep(dThr, dThr * 1.8, rel);
            // creases / id changes draw on both sides, so sample half as far
            vec4 cn = texture2D(tNI, uv + o * 0.5);
            float relh = (lin(uv + o * 0.5) - d0) / max(d0, 1e-3);
            float eNorm = 0.0, eId = 0.0;
            if (c0.a > 0.0 && cn.a > 0.0) {
              vec3 nn = cn.rgb * 2.0 - 1.0;
              eNorm = smoothstep(0.28, 0.5, 1.0 - dot(n0, nn));
              eId = step(0.003, abs(c0.a - cn.a)) * step(abs(relh), 0.08);
            }
            e = max(e, max(eDepth, max(eNorm, eId * 0.9)));
          }
          return e;
        }

        void main() {
          vec2 px = 1.0 / uRes;
          // Hand-drawn jitter, anchored to world space so the wobble sticks to
          // the geometry instead of swimming when the camera moves.
          vec3 w = worldAt(vUv);
          vec2 wob = vec2(vnoise(w * 4.0) - 0.5, vnoise(w * 4.0 + 17.3) - 0.5) * 2.0
                   + vec2(vnoise(w * 13.0 + 5.1) - 0.5, vnoise(w * 13.0 + 9.7) - 0.5);
          vec2 uv = vUv + wob * uWobble * px;
          // two sub-pixel taps -> anti-aliased line edges
          float e = 0.5 * (edgeAt(uv + vec2(0.35, 0.3) * px, px) + edgeAt(uv - vec2(0.3, 0.35) * px, px));

          vec3 col = texture2D(tColor, vUv).rgb;
          float pressure = mix(0.74, 1.0, vnoise(w * 6.0 + 3.3));
          col = mix(col, uInk, clamp(e, 0.0, 1.0) * pressure);

          float grain = texture2D(tPaper, gl_FragCoord.xy / 512.0).r;
          col *= mix(1.0, grain, 0.55);
          vec2 q = vUv - 0.5;
          col *= 1.0 - dot(q, q) * 0.16;
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h) {
    this.colorRT.setSize(w, h);
    this.niRT.setSize(w, h);
    this.post.uniforms.uRes.value.set(w, h);
    // Keep line weight roughly constant relative to screen height.
    this.post.uniforms.uThick.value = Math.max(1.5, h / 440);
  }

  render(scene, camera) {
    const r = this.renderer;
    this.post.uniforms.uNear.value = camera.near;
    this.post.uniforms.uFar.value = camera.far;
    camera.updateMatrixWorld();
    this.post.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
    this.post.uniforms.uCamWorld.value.copy(camera.matrixWorld);

    // 1. Ink-shaded color (also refreshes the shadow map).
    r.shadowMap.needsUpdate = true;
    camera.layers.enableAll();
    r.setRenderTarget(this.colorRT);
    r.setClearColor(PAPER, 1);
    r.render(scene, camera);

    // 2. Normals + object ids + depth for the outline detector (backdrop excluded).
    camera.layers.set(0);
    scene.overrideMaterial = normalMaterial;
    r.setRenderTarget(this.niRT);
    r.setClearColor(0x808080, 0);
    r.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.enableAll();

    // 3. Composite to screen.
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }
}
