/* ==========================================================================
   THE FOUR WORLDS
   Behind everything, one full-screen shader paints where we are:
     0 OCEAN      sunlit water, seen from below the surface: Snell's window,
                  god rays, caustic shimmer, drifting motes
     1 LAB        a bright, clean studio sweep: where molecules are shown
     2 GRAPH      engineering paper: where numbers are shown
     3 NOTEBOOK   a Victorian naturalist's field notebook: where life and
                  history are drawn
   Worlds hand over through a wipe that never looks like a fade: ink bleeds
   across the page, water floods in, light washes a room white.
   ========================================================================== */
import * as THREE from 'three'
import { HASH, NOISE, WIPE } from './glsl'
import { U } from './uniforms'

export const WORLD = { ocean: 0, lab: 1, graph: 2, note: 3 } as const
export type WorldName = keyof typeof WORLD

const FRAG = /* glsl */ `
precision highp float;
${HASH}
${NOISE}
uniform float uTime, uWT, uDepth, uCam;
uniform int uW0, uW1;
uniform vec2 uRes, uWDir;
uniform float uWRad;
in vec2 vUv;
layout(location = 0) out vec4 o;
${WIPE}

/* caustics: the classic domain-warped interference of refracted sunlight */
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s / 0.875; }
float caustic(vec2 p, float t){
  vec2 q = p;
  float c = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    q = p * (1.0 + fi * 0.7) + vec2(sin(t * 0.3 + fi), cos(t * 0.27 - fi)) * 0.6;
    vec2 w = vec2(fbm3(q + t * 0.12), fbm3(q - t * 0.1 + 5.2));
    float d = abs(sin((q.x + w.x * 2.2) * 3.0) * sin((q.y + w.y * 2.2) * 3.0));
    c += pow(1.0 - d, 6.0) / (1.0 + fi);
  }
  return c;
}

vec3 ocean(vec2 uv, vec2 p){
  float t = uTime;
  // deeper water is darker and bluer; the camera's depth shifts the whole column
  float y = uv.y + uCam * 0.0;
  vec3 deep = vec3(0.012, 0.19, 0.34);
  vec3 mid = vec3(0.03, 0.47, 0.70);
  vec3 top = vec3(0.35, 0.86, 0.97);
  vec3 c = mix(deep, mid, smoothstep(-0.1, 0.62, y));
  c = mix(c, top, smoothstep(0.55, 1.05, y));
  c *= mix(1.0, 0.55, uDepth);
  // Snell's window: the sky seen through the surface, a bright disc overhead, rippled
  vec2 sw = vec2(p.x * 0.8, (uv.y - 1.28) * 1.4);
  float win = smoothstep(0.62, 0.3, length(sw + vec2(fbm3(p * 3.0 + t * 0.3) * 0.05)));
  c += vec3(0.75, 0.97, 1.0) * win * 0.9 * (1.0 - uDepth * 0.7);
  // the underside of the surface: bright, broken by waves
  float surf = smoothstep(0.9, 1.0, uv.y);
  float wav = caustic(p * vec2(1.2, 3.0) + vec2(0.0, t * 0.05), t);
  c += vec3(0.6, 0.95, 1.0) * surf * (0.25 + 0.6 * wav) * (1.0 - uDepth);
  // god rays: shafts converging on a sun above the frame
  vec2 sun = vec2(0.22, 1.9);
  vec2 d = p - sun;
  float ang = atan(d.x, -d.y);
  float rays = 0.0;
  rays += pow(vnoise(vec2(ang * 18.0, t * 0.12)), 3.0);
  rays += 0.6 * pow(vnoise(vec2(ang * 41.0 + 3.0, t * 0.2)), 4.0);
  float fall = smoothstep(-0.2, 1.0, uv.y) * smoothstep(3.2, 0.8, length(d));
  c += vec3(0.55, 0.92, 1.0) * rays * fall * 0.42 * (1.0 - uDepth * 0.6);
  // caustic shimmer in the water column, strongest near the top
  c += vec3(0.4, 0.9, 1.0) * caustic(p * 1.6, t) * 0.05 * smoothstep(0.0, 1.0, uv.y);
  // marine snow: tiny motes, some near and out of focus
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 g = p * (8.0 + fi * 9.0) + vec2(t * 0.05 * (fi + 1.0), -t * 0.08 * (1.0 + fi * 0.5));
    vec2 id = floor(g), f = fract(g) - 0.5;
    vec3 h = hash32(id + fi * 17.0);
    vec2 off = (h.xy - 0.5) * 0.7;
    float r = mix(0.02, 0.09, h.z) * (1.0 + fi * 0.2);
    float m = smoothstep(r, r * 0.3, length(f - off)) * step(0.55, h.z);
    c += vec3(0.7, 0.95, 1.0) * m * (0.14 - fi * 0.03);
  }
  return c;
}

vec3 lab(vec2 uv, vec2 p){
  // a studio sweep: a bright seamless backdrop curving into a floor
  vec3 wall = vec3(0.93, 0.945, 0.965);
  vec3 floorC = vec3(0.8, 0.83, 0.87);
  float horizon = smoothstep(0.18, -0.05, uv.y - 0.12);
  vec3 c = mix(wall, floorC, horizon);
  c *= 1.0 - 0.1 * smoothstep(0.4, 1.4, length(p * vec2(0.8, 1.1)));
  // a large soft key light from the upper left
  c += vec3(0.05, 0.045, 0.03) * smoothstep(1.4, 0.0, length(p - vec2(-0.7, 0.55)));
  // faint registration dots, like a light table
  vec2 g = fract(p * 18.0) - 0.5;
  c -= vec3(0.03) * smoothstep(0.06, 0.02, length(g)) * (1.0 - horizon * 0.6);
  return c;
}

vec3 graph(vec2 uv, vec2 p){
  vec3 c = vec3(0.985, 0.982, 0.968);
  vec2 q = p * 28.0;
  vec2 f = abs(fract(q) - 0.5);
  float fine = smoothstep(0.47, 0.5, max(f.x, f.y));
  vec2 F = abs(fract(q / 5.0) - 0.5);
  float bold = smoothstep(0.485, 0.5, max(F.x, F.y));
  c = mix(c, vec3(0.68, 0.84, 0.93), fine * 0.35);
  c = mix(c, vec3(0.45, 0.72, 0.88), bold * 0.45);
  c *= 1.0 - 0.06 * smoothstep(0.6, 1.5, length(p));
  return c;
}

vec3 note(vec2 uv, vec2 p){
  // laid paper, aged: warm cream, fibres, foxing, darkened edges
  vec3 c = vec3(0.95, 0.905, 0.8);
  // smooth mottling (gradient noise, no value-noise blocks) and fine isotropic fibre
  float n = gnoise(vec3(p * 2.6, 1.0)) * 0.6 + gnoise(vec3(p * 7.0, 2.0)) * 0.3;
  c *= 0.965 + 0.05 * n;
  float fib = gnoise(vec3(p * vec2(140.0, 32.0), 3.0));
  c *= 0.992 + 0.012 * fib;
  // chain lines of laid paper, very faint
  c *= 1.0 - 0.01 * smoothstep(0.92, 1.0, abs(sin(p.x * 22.0)));
  // ink bleeding through from the other side of the leaf: faint mirrored script lines
  vec2 q = vec2(-p.x, p.y) * vec2(11.0, 26.0);
  float line = smoothstep(0.12, 0.0, abs(fract(q.y) - 0.5) - 0.1);
  float word = smoothstep(0.1, 0.35, gnoise(vec3(q.x * 0.7, floor(q.y) * 3.1, 4.0)));
  float margin = smoothstep(-0.95, -0.85, p.x) * smoothstep(0.95, 0.85, p.x) * smoothstep(-0.46, -0.4, p.y) * smoothstep(0.46, 0.4, p.y);
  c = mix(c, vec3(0.62, 0.52, 0.44), line * word * margin * 0.05);
  // foxing: small rust spots
  vec2 g = p * 6.0;
  vec2 id = floor(g);
  vec3 h = hash32(id + 3.0);
  float fox = smoothstep(0.12 * h.z, 0.0, length(fract(g) - 0.5 - (h.xy - 0.5) * 0.6)) * step(0.82, h.x);
  c = mix(c, vec3(0.78, 0.6, 0.4), fox * 0.35);
  // a tea stain ring, once
  float ring = abs(length(p - vec2(1.05, -0.62)) - 0.2);
  c = mix(c, vec3(0.82, 0.68, 0.48), smoothstep(0.012, 0.0, ring) * 0.22 + smoothstep(0.2, 0.0, length(p - vec2(1.05, -0.62))) * 0.06);
  // the oil lamp: warm light pooled up and to the left, falling off across the page
  float lamp = smoothstep(1.9, 0.1, length(p - vec2(-0.75, 0.55)));
  c *= mix(vec3(0.8, 0.72, 0.62), vec3(1.06, 1.0, 0.9), lamp);
  // the gutter of the open book on the far left, and the page's curl
  c *= 1.0 - 0.35 * smoothstep(-0.62, -0.9, p.x - 0.0) * smoothstep(-1.2, -0.85, p.x);
  // edges burn darker
  vec2 e = abs(uv - 0.5) * 2.0;
  c *= 1.0 - 0.3 * pow(max(e.x, e.y), 5.0);
  return c;
}

vec3 world(int w, vec2 uv, vec2 p){
  if (w == 0) return ocean(uv, p);
  if (w == 1) return lab(uv, p);
  if (w == 2) return graph(uv, p);
  return note(uv, p);
}

/* each world arrives with its own edge: foam, light, a ruled blue line, ink */
vec3 edgeCol(int w){
  if (w == 0) return vec3(0.85, 1.0, 1.0);
  if (w == 1) return vec3(1.0);
  if (w == 2) return vec3(0.25, 0.55, 0.85);
  return vec3(0.22, 0.14, 0.08);
}

void main(){
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 a = world(uW0, uv, p);
  if (uWT <= 0.0 || uW0 == uW1) { o = vec4(pow(a, vec3(2.2)), 1.0); return; }
  vec3 b = world(uW1, uv, p);
  // the wipe front: a direction (or a circle from the centre) roughened by noise
  float field = wipeField(p);
  float front = wipeFront();
  float m = smoothstep(front + 0.02, front - 0.02, field);
  float edge = smoothstep(0.06, 0.0, abs(field - front)) * (1.0 - m * 0.5);
  vec3 c = mix(a, b, m);
  c = mix(c, edgeCol(uW1), edge * (uW1 == 3 ? 0.75 : 0.55) * step(0.001, uWT) * step(uWT, 0.999));
  o = vec4(pow(max(c, 0.0), vec3(2.2)), 1.0);
}
`

export function worldPass() {
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: FRAG,
    uniforms: {
      uTime: U.uTime,
      uRes: U.uRes,
      uW0: { value: 0 },
      uW1: { value: 0 },
      uWT: { value: 0 },
      uWDir: { value: new THREE.Vector2(1, 0) },
      uWRad: { value: 0 },
      uDepth: { value: 0 },
      uCam: { value: 0 },
    },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  const scene = new THREE.Scene()
  scene.add(mesh)
  return { scene, mat, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) }
}
