/* Things that belong to a world and live in 3-D, so the camera can move
   through them: the sea floor (rippled sand, scattered rock, caustic light,
   blue haze) and the environment maps the glossy meshes reflect.
   Each object is cut by the same wipe as its world's background. */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { HASH, NOISE, WIPE, CAUSTIC } from './glsl'
import { U } from './uniforms'

export function seafloor(wipe: Record<string, { value: any }>) {
  const geo = new THREE.PlaneGeometry(420, 260, 360, 220)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...wipe, uTime: U.uTime, uRes: U.uRes, uFogCol: { value: new THREE.Color() } },
    vertexShader: /* glsl */ `
      ${HASH}
      ${NOISE}
      out vec3 vW;
      out float vH;
      float height(vec2 p){
        // long dunes, ripples across them, and a few rock outcrops
        float d = fbm(vec3(p * 0.03, 1.0), 4) * 3.2;
        float rock = smoothstep(0.35, 0.6, fbm(vec3(p * 0.06, 7.0), 4)) * 4.5;
        return d + rock;
      }
      void main(){
        vec3 p = position;
        p.y += height(p.xz);
        vH = p.y;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${HASH}
      ${NOISE}
      ${CAUSTIC}
      uniform float uTime, uWT, uWRad;
      uniform int uW0, uW1;
      uniform vec2 uRes, uWDir;
      uniform vec3 uFogCol;
      ${WIPE}
      in vec3 vW;
      in float vH;
      layout(location = 0) out vec4 o;
      void main(){
        float here = worldHere(0, gl_FragCoord.xy);
        if (here < 0.01) discard;
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        if (n.y < 0.0) n = -n;
        float rip = sin(vW.x * 2.4 + fbm(vec3(vW.xz * 0.3, 2.0), 2) * 6.0) * 0.5 + 0.5;
        vec3 sand = mix(vec3(0.62, 0.55, 0.42), vec3(0.8, 0.74, 0.6), rip * 0.4 + 0.3 * fbm(vec3(vW.xz * 1.5, 3.0), 3));
        float rock = smoothstep(2.6, 4.2, vH - fbm(vec3(vW.xz * 0.03, 1.0), 4) * 3.2 + 2.0);
        sand = mix(sand, vec3(0.28, 0.3, 0.3) * (0.7 + 0.5 * fbm(vec3(vW.xz * 2.0, 5.0), 3)), rock);
        // light from above: diffuse, plus the caustic net focused by the waves
        float diff = clamp(n.y, 0.0, 1.0);
        float cs = caustic(vW.xz * 0.28, uTime);
        vec3 c = pow(sand, vec3(2.2)) * (vec3(0.08, 0.28, 0.4) + vec3(0.5, 0.85, 0.9) * diff * (0.35 + 1.3 * cs));
        // blue haze with distance
        float d = length(vW - cameraPosition);
        c = mix(c, uFogCol, 1.0 - exp(-d * 0.012));
        // dissolve into the water column rather than ending at a horizon
        float a = exp(-max(0.0, d - 18.0) * 0.022) * here;
        o = vec4(c, a);
      }`,
  })
  mat.transparent = true
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = -11
  mesh.frustumCulled = false
  mesh.renderOrder = -5
  return { mesh, mat }
}

/** a bright sky seen from under water: a sunlit ceiling fading to deep blue */
export function oceanEnv(r: THREE.WebGLRenderer) {
  const s = new THREE.Scene()
  const g = new THREE.SphereGeometry(10, 64, 32)
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vP; void main(){
      vec3 d = normalize(vP);
      vec3 c = mix(vec3(0.004, 0.03, 0.07), vec3(0.04, 0.3, 0.5), smoothstep(-0.4, 0.4, d.y));
      c += vec3(0.5, 0.8, 0.9) * smoothstep(0.75, 0.98, d.y);
      c += vec3(2.5) * smoothstep(0.985, 0.998, dot(d, normalize(vec3(0.15, 1.0, 0.25))));
      gl_FragColor = vec4(c, 1.0);
    }`,
  })
  s.add(new THREE.Mesh(g, m))
  const pm = new THREE.PMREMGenerator(r)
  const t = pm.fromScene(s, 0.02).texture
  pm.dispose()
  return t
}

export function labEnv(r: THREE.WebGLRenderer) {
  const pm = new THREE.PMREMGenerator(r)
  const t = pm.fromScene(new RoomEnvironment(), 0.03).texture
  pm.dispose()
  return t
}

/* A kelp forest far behind the shark: tall ribbons swaying in the swell,
   dissolving into the blue. It gives the water depth and parallax. */
export function kelp(wipe: Record<string, { value: any }>) {
  const blades: THREE.BufferGeometry[] = []
  let seed = 7
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const pos: number[] = [], aux: number[] = [], idx: number[] = []
  for (let k = 0; k < 70; k++) {
    const x = -90 + r() * 180, z = -28 - r() * 90, h = 18 + r() * 26, w = 0.5 + r() * 0.9, ph = r() * 6.28
    const base = pos.length / 3
    const S = 40
    for (let i = 0; i <= S; i++) {
      const t = i / S
      for (const s of [-1, 1]) {
        pos.push(x + s * w * (0.6 + 0.4 * Math.sin(t * 9 + ph)), -11 + t * h, z)
        aux.push(t, ph, s)
      }
    }
    for (let i = 0; i < S; i++) {
      const a = base + i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  void blades
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aux', new THREE.Float32BufferAttribute(aux, 3))
  g.setIndex(idx)
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: { ...wipe, uTime: U.uTime, uRes: U.uRes, uFogCol: { value: new THREE.Color() } },
    vertexShader: /* glsl */ `
      in vec3 aux;
      uniform float uTime;
      out float vT;
      out float vD;
      out float vS;
      void main(){
        vec3 p = position;
        float t = aux.x;
        // the swell bends each blade more toward its tip
        p.x += sin(uTime * 0.5 + aux.y + t * 2.0) * 2.2 * t * t;
        p.z += cos(uTime * 0.4 + aux.y) * 0.8 * t;
        vT = t;
        vS = aux.z;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vD = length(w.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${HASH}
      uniform float uTime, uWT, uWRad;
      uniform int uW0, uW1;
      uniform vec2 uRes, uWDir;
      uniform vec3 uFogCol;
      ${WIPE}
      in float vT;
      in float vD;
      in float vS;
      layout(location = 0) out vec4 o;
      void main(){
        float here = worldHere(0, gl_FragCoord.xy);
        if (here < 0.01) discard;
        vec3 c = mix(vec3(0.02, 0.05, 0.02), vec3(0.09, 0.16, 0.05), vT);
        // sunlight through the blade near the top
        c += vec3(0.08, 0.14, 0.03) * smoothstep(0.5, 1.0, vT) * (0.6 + 0.4 * vS);
        c = mix(c, uFogCol, 1.0 - exp(-vD * 0.02));
        float a = here * smoothstep(0.0, 0.08, vT) * (1.0 - smoothstep(0.93, 1.0, vT)) * 0.92;
        o = vec4(c, a);
      }`,
  })
  const mesh = new THREE.Mesh(g, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -6
  return { mesh, mat }
}
