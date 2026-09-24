/* ==========================================================================
   THE SWARM
   131 072 particles that can become anything. Every picture in the film that
   is not a glossy molecule is one "form": a position (xyz + size) and a
   colour (rgb + alpha) for every particle, stored as one layer of a texture
   array. At any moment the film names two forms and a progress t; the vertex
   shader flies each particle from its place in the first to its place in the
   second. Because the forms are sorted along a shared axis, particles travel
   coherently: a shark pours into a helix, a helix shatters into fragments,
   fragments settle into a chart. Scroll back and every particle flies home.
   ========================================================================== */
import * as THREE from 'three'
import { HASH, NOISE } from './glsl'
import { U } from './uniforms'

export const SW = 512
export const SH = 256
export const N = SW * SH

export type Anim = 0 | 1 | 2 | 3 | 4 | 5 | 6
/** per-form motion that lives in the shader: 0 still · 1 swim · 2 spin about x · 3 breathe · 4 swirl · 5 drift · 6 hover */
export const ANIM = { still: 0, swim: 1, spin: 2, breathe: 3, swirl: 4, drift: 5, hover: 6 } as const

export type Flight = {
  /** 0 straight · 1 curl-noise swirl · 2 burst outward · 3 pour (gravity arc) · 4 spiral about the sweep axis */
  style: number
  /** direction the wave of departures travels (particles leave in this order) */
  sweep: [number, number, number]
  /** 0 = all at once … 0.9 = a long travelling wave */
  stagger: number
  /** how far particles stray mid-flight */
  scatter: number
}
export const FLIGHT_DEFAULT: Flight = { style: 1, sweep: [1, 0, 0], stagger: 0.55, scatter: 1 }

const VERT = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
${HASH}
${NOISE}
uniform sampler2DArray uPos, uCol, uNrm;
uniform int uA, uB, uAnimA, uAnimB;
uniform float uT, uTime, uStagger, uScatter, uStyle, uPoint, uAlphaA, uAlphaB, uHot;
uniform vec3 uSweep;
uniform vec2 uSweepR, uRes;
uniform mat4 uMatA, uMatB;
uniform float uPhaseA, uPhaseB;
/* a mesh stands in for the form: 1 = particles only exist while in flight */
uniform float uHideA, uHideB;
uniform float uFocus, uAperture;
in vec2 aRef;
in vec4 aRand;
out vec4 vCol;
out vec3 vN;
out vec3 vW;
out float vGloss, vHot, vCoc, vDepth;

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

void anim(inout vec3 p, inout vec3 n, int k, float ph, float r){
  if (k == 1) {
    // swim: a travelling wave down the body, stronger toward the tail (+x)
    float amp = 0.08 + 0.5 * smoothstep(-6.0, 12.0, p.x);
    float ph2 = p.x * 0.42 - uTime * 2.6 + ph;
    p.z += amp * sin(ph2) * 1.2;
    float slope = amp * 1.2 * 0.42 * cos(ph2);
    n = normalize(vec3(n.x - slope * n.z, n.y, n.z));
    p.y += 0.12 * sin(uTime * 0.9 + ph);
  } else if (k == 2) {
    float a = uTime * 0.3 + ph;
    p.yz = rot(a) * p.yz;
    n.yz = rot(a) * n.yz;
  } else if (k == 3) {
    p += 0.06 * vec3(sin(uTime * 1.3 + r * 40.0), cos(uTime * 1.1 + r * 31.0), sin(uTime * 0.9 + r * 17.0));
  } else if (k == 4) {
    float a = uTime * (0.18 + 0.4 * fract(r * 7.0)) / (0.3 + length(p.xz) * 0.08);
    p.xz = rot(a) * p.xz;
    p.y += 0.3 * sin(uTime * 0.7 + r * 20.0);
  } else if (k == 5) {
    p += 0.18 * vec3(sin(uTime * 0.31 + r * 40.0), cos(uTime * 0.27 + r * 31.0), sin(uTime * 0.23 + r * 17.0));
  } else if (k == 6) {
    p.y += 0.12 * sin(uTime * 0.8 + p.x * 0.2);
  }
}

void main(){
  vec4 pa = texture(uPos, vec3(aRef, float(uA)));
  vec4 pb = texture(uPos, vec3(aRef, float(uB)));
  vec4 ca = texture(uCol, vec3(aRef, float(uA)));
  vec4 cb = texture(uCol, vec3(aRef, float(uB)));
  vec4 na = texture(uNrm, vec3(aRef, float(uA)));
  vec4 nb = texture(uNrm, vec3(aRef, float(uB)));
  vec3 a = pa.xyz, b = pb.xyz;
  vec3 an = na.xyz * 2.0 - 1.0, bn = nb.xyz * 2.0 - 1.0;
  anim(a, an, uAnimA, uPhaseA, aRand.x);
  anim(b, bn, uAnimB, uPhaseB, aRand.x);
  a = (uMatA * vec4(a, 1.0)).xyz;
  b = (uMatB * vec4(b, 1.0)).xyz;
  an = normalize(mat3(uMatA) * an);
  bn = normalize(mat3(uMatB) * bn);

  // the wave of departures: position along the sweep axis, blurred a little
  float key = (dot(uHideA > 0.5 ? a : mix(a, b, 0.3), uSweep) - uSweepR.x) / max(1e-3, uSweepR.y - uSweepR.x);
  key = clamp(key * 0.92 + aRand.y * 0.08, 0.0, 1.0);
  float t = clamp(uT * (1.0 + uStagger) - key * uStagger, 0.0, 1.0);
  float e = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  float arc = sin(3.14159265 * e);

  vec3 p = mix(a, b, e);
  if (arc > 0.001) {
    vec3 off = vec3(0.0);
    if (uStyle < 0.5) {
      off = vec3(0.0);
    } else if (uStyle < 1.5) {
      vec3 q = p * 0.09 + vec3(0.0, 0.0, aRand.z * 3.0);
      off = vec3(gnoise(q), gnoise(q + 19.1), gnoise(q + 47.3)) * 7.0;
    } else if (uStyle < 2.5) {
      vec3 d = normalize(p + (aRand.xyz - 0.5) * 0.8);
      off = d * (4.0 + 10.0 * aRand.w);
    } else if (uStyle < 3.5) {
      off = vec3((aRand.x - 0.5) * 3.0, 6.0 + 6.0 * aRand.w, (aRand.z - 0.5) * 5.0);
    } else {
      // a vortex about the sweep axis, with curl-noise turbulence on top
      vec3 ax = normalize(uSweep);
      vec3 rel = p - ax * dot(p, ax);
      float ang = arc * (2.0 + 3.0 * aRand.w);
      vec3 tng = normalize(cross(ax, rel + 1e-3));
      vec3 q = p * 0.12 + aRand.z * 2.0;
      off = tng * (length(rel) + 2.0) * sin(ang) * 0.9 + rel * (cos(ang) - 1.0) * 0.5 + vec3(gnoise(q), gnoise(q + 9.1), gnoise(q + 21.7)) * 3.0;
    }
    p += off * arc * uScatter;
  }

  vec4 c = mix(ca, cb, e);
  c.a *= mix(uAlphaA, uAlphaB, e);
  // mesh hand-offs: invisible until the skin burns away / after the atom forms
  c.a *= mix(1.0, smoothstep(0.0, 0.03, t), uHideA);
  c.a *= mix(1.0, 1.0 - smoothstep(0.93, 1.0, t), uHideB);
  float size = mix(pa.w, pb.w, e);
  vHot = arc * uHot;
  vCol = c;
  vN = normalize(mix(an, bn, e) + 1e-4);
  vW = p;
  vGloss = mix(na.w, nb.w, e);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * uPoint * uRes.y / max(0.5, -mv.z) * (1.0 + 0.5 * vHot);
  // depth of field: a circle of confusion from the focal plane, in pixels
  float coc = abs(-mv.z - uFocus) * uAperture * uRes.y / max(1.0, -mv.z);
  vCoc = coc;
  vDepth = -mv.z;
  gl_PointSize = clamp(px + min(coc, 22.0), 1.0, 64.0);
  // spread light over the larger disc: energy stays the same
  vCol.a *= clamp((px * px) / ((px + coc) * (px + coc)), 0.04, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
${HASH}
uniform float uInk, uSoft, uTime, uLit, uCaustic, uFogDen;
uniform vec3 uKeyDir, uKeyCol, uSkyCol, uGroundCol, uRimCol, uFogCol;
in vec4 vCol;
in vec3 vN;
in vec3 vW;
in float vGloss, vHot, vCoc, vDepth;
layout(location = 0) out vec4 o;

float caust(vec2 p, float t){
  // cheap animated caustic net: two warped cell patterns multiplied
  vec2 q = p * 0.55;
  float c = 0.0;
  for (int i = 0; i < 2; i++){
    vec2 w = q + vec2(sin(q.y * 1.7 + t * 0.9), cos(q.x * 1.3 - t * 0.7)) * 0.6;
    vec2 f = fract(w) - 0.5;
    c += pow(1.0 - clamp(min(abs(f.x), abs(f.y)) * 3.0, 0.0, 1.0), 5.0);
    q = q * 1.7 + 3.1;
  }
  return c;
}

void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  // a defocused particle is a flat bokeh disc with a bright rim; in focus, a lit bead
  float blur = clamp(vCoc / 6.0, 0.0, 1.0);
  float disc = mix(1.0 - smoothstep(0.7, 1.0, r2), exp(-r2 * 3.0), uSoft);
  disc = mix(disc, smoothstep(1.0, 0.8, r2) * (0.75 + 0.35 * smoothstep(0.4, 0.95, r2)), blur);
  float a = vCol.a * disc;
  if (a < 0.003) discard;
  vec3 base = pow(vCol.rgb, vec3(2.2));

  // shading: the form's surface normal, bent by the bead's own curvature
  vec3 bead = vec3(q.x, -q.y, sqrt(max(0.0, 1.0 - r2)));
  vec3 beadW = normalize((inverse(mat3(viewMatrix)) * bead));
  vec3 n = normalize(vN * 0.85 + beadW * 0.35 * (1.0 - blur));
  vec3 V = normalize(cameraPosition - vW);
  float nl = max(dot(n, uKeyDir), 0.0);
  float hemi = n.y * 0.5 + 0.5;
  vec3 amb = mix(uGroundCol, uSkyCol, hemi);
  vec3 H = normalize(uKeyDir + V);
  float gloss = vGloss;
  float spec = pow(max(dot(n, H), 0.0), mix(12.0, 90.0, gloss)) * gloss * 1.6;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 lit = base * (amb + uKeyCol * nl) + uKeyCol * spec + uRimCol * rim * 0.6;
  // sunlight through waves: caustics dance over everything that faces up
  float cs = caust(vW.xz + vW.y * 0.3, uTime) * max(n.y * 0.7 + 0.3, 0.0) * uCaustic;
  lit += base * vec3(0.7, 1.0, 1.0) * cs * 0.9;
  vec3 c = mix(base, lit, uLit);
  // emissive particles (gloss > 0.9) glow instead
  c = mix(c, base * 2.2, step(0.92, gloss));
  c *= 1.0 + vHot * 2.0;
  // distance fog: water and air thicken with depth
  float fog = 1.0 - exp(-vDepth * uFogDen);
  c = mix(c, uFogCol, fog);
  o = vec4(c * a, a * uInk);
}
`

export class Swarm {
  points: THREE.Points
  mat: THREE.ShaderMaterial
  posTex: THREE.DataArrayTexture
  colTex: THREE.DataArrayTexture
  nrmTex: THREE.DataArrayTexture
  layers: number
  names = new Map<string, number>()
  anims: number[] = []

  constructor(layers: number) {
    this.layers = layers
    const pos = new Float32Array(N * 4 * layers)
    const col = new Uint8Array(N * 4 * layers)
    this.posTex = new THREE.DataArrayTexture(pos, SW, SH, layers)
    this.posTex.format = THREE.RGBAFormat
    this.posTex.type = THREE.FloatType
    this.posTex.minFilter = this.posTex.magFilter = THREE.NearestFilter
    this.colTex = new THREE.DataArrayTexture(col, SW, SH, layers)
    this.colTex.format = THREE.RGBAFormat
    this.colTex.type = THREE.UnsignedByteType
    this.colTex.minFilter = this.colTex.magFilter = THREE.NearestFilter
    this.colTex.colorSpace = THREE.NoColorSpace
    this.nrmTex = new THREE.DataArrayTexture(new Uint8Array(N * 4 * layers), SW, SH, layers)
    this.nrmTex.format = THREE.RGBAFormat
    this.nrmTex.type = THREE.UnsignedByteType
    this.nrmTex.minFilter = this.nrmTex.magFilter = THREE.NearestFilter
    this.nrmTex.colorSpace = THREE.NoColorSpace

    const g = new THREE.BufferGeometry()
    const ref = new Float32Array(N * 2)
    const rnd = new Float32Array(N * 4)
    let s = 1234567
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < N; i++) {
      ref[i * 2] = ((i % SW) + 0.5) / SW
      ref[i * 2 + 1] = (Math.floor(i / SW) + 0.5) / SH
      rnd[i * 4] = rand()
      rnd[i * 4 + 1] = rand()
      rnd[i * 4 + 2] = rand()
      rnd[i * 4 + 3] = rand()
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('aRef', new THREE.BufferAttribute(ref, 2))
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)

    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uPos: { value: this.posTex },
        uCol: { value: this.colTex },
        uNrm: { value: this.nrmTex },
        uHideA: { value: 0 },
        uHideB: { value: 0 },
        uFocus: { value: 30 },
        uAperture: { value: 0.0 },
        uLit: { value: 1 },
        uCaustic: { value: 0 },
        uFogDen: { value: 0 },
        uKeyDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
        uKeyCol: { value: new THREE.Color(1, 1, 1) },
        uSkyCol: { value: new THREE.Color(0.5, 0.5, 0.5) },
        uGroundCol: { value: new THREE.Color(0.2, 0.2, 0.2) },
        uRimCol: { value: new THREE.Color(0.3, 0.3, 0.3) },
        uFogCol: { value: new THREE.Color(0, 0, 0) },
        uA: { value: 0 },
        uB: { value: 0 },
        uAnimA: { value: 0 },
        uAnimB: { value: 0 },
        uPhaseA: { value: 0 },
        uPhaseB: { value: 0 },
        uT: { value: 0 },
        uTime: U.uTime,
        uRes: U.uRes,
        uStagger: { value: 0.5 },
        uScatter: { value: 1 },
        uStyle: { value: 1 },
        uSweep: { value: new THREE.Vector3(1, 0, 0) },
        uSweepR: { value: new THREE.Vector2(-15, 15) },
        uPoint: { value: 1 },
        uAlphaA: { value: 1 },
        uAlphaB: { value: 1 },
        uHot: { value: 0.25 },
        uMatA: { value: new THREE.Matrix4() },
        uMatB: { value: new THREE.Matrix4() },
        uInk: { value: 1 },
        uSoft: { value: 0 },
      },
    })
    this.points = new THREE.Points(g, this.mat)
    this.points.frustumCulled = false
  }

  /** copy one generated form into its layer */
  put(name: string, layer: number, pos: Float32Array, col: Uint8Array, nrm: Uint8Array, anim: number) {
    ;(this.posTex.image.data as Float32Array).set(pos, layer * N * 4)
    ;(this.colTex.image.data as Uint8Array).set(col, layer * N * 4)
    ;(this.nrmTex.image.data as Uint8Array).set(nrm, layer * N * 4)
    this.names.set(name, layer)
    this.anims[layer] = anim
  }

  /** send one layer to the GPU (the rest of the array is untouched) */
  uploadLayer(layer: number) {
    for (const t of [this.posTex, this.colTex, this.nrmTex]) {
      t.addLayerUpdate(layer)
      t.needsUpdate = true
    }
  }

  upload() {
    this.posTex.needsUpdate = true
    this.colTex.needsUpdate = true
    this.nrmTex.needsUpdate = true
  }

  private missing = new Set<string>()
  layer(name: string) {
    const l = this.names.get(name)
    if (l === undefined) {
      if (!this.missing.has(name)) (this.missing.add(name), console.warn('no form', name))
      return 0
    }
    return l
  }
}
