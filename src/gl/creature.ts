/* ==========================================================================
   THE ELEPHANT SHARK, SOLID
   One sculpted mesh: a lofted body (flat belly, blunt head, upturned tail),
   fins with thickness, the fleshy hoe-shaped proboscis and big green eyes.
   Physically based skin (silver with an iridescent sheen, clearcoat, brown
   saddles), caustics from the surface above dancing over its back.

   It is also the source of the swarm's shark: particles are sampled from
   this very surface, so when the dissolve front burns across the body the
   particles lift off exactly where the skin disappears. The swim is the
   same function in both shaders.
   ========================================================================== */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { bodyAt, skinAt, sharkFins, snoutAt, finPoint, EYE, SHARK_X, SKIN, type Fin } from './forms/shark'
import { FB, finish, type RGB } from './forms/base'
import { N } from './swarm'
import { HASH, NOISE, CAUSTIC } from './glsl'
import { U } from './uniforms'

const [X0, X1] = SHARK_X
/* vertex colours are linear in three.js; the palette is written in sRGB */
const lin = (c: RGB): RGB => [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)]

function colorize(g: THREE.BufferGeometry, f: (x: number, y: number, z: number, i: number) => RGB) {
  const p = g.attributes.position
  const c = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const [r, gg, b] = lin(f(p.getX(i), p.getY(i), p.getZ(i), i))
    c[i * 3] = r
    c[i * 3 + 1] = gg
    c[i * 3 + 2] = b
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g
}

/* the body, lofted from bodyAt(), capped at the nose and the tail tip */
function bodyGeometry() {
  const NX = 280, NT = 128
  const nose = 0.6
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= NX; i++) {
    const s = i / NX
    const x = X0 - nose + (X1 + 0.15 - (X0 - nose)) * Math.pow(s, 1.0)
    let { H, W, yc } = bodyAt(Math.min(X1, Math.max(X0, x)))
    if (x < X0) {
      const k = Math.sqrt(Math.max(0, 1 - Math.pow((X0 - x) / nose, 2)))
      H *= k
      W *= k
    }
    if (x > X1) {
      const k = Math.max(0, 1 - (x - X1) / 0.15)
      H *= k
      W *= k
    }
    for (let j = 0; j <= NT; j++) {
      const th = (j / NT) * Math.PI * 2
      const cy = Math.cos(th), sz = Math.sin(th)
      const flat = cy < 0 ? 0.82 : 1
      const y = yc + H * cy * flat
      const z = W * sz
      pos.push(x, y, z)
      col.push(...lin(skinAt(Math.max(X0, x), y, cy)))
    }
  }
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NT; j++) {
      const a = i * (NT + 1) + j, b = a + NT + 1
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/* a fin: a swept surface with thickness that tapers to the edges */
function finGeometry(f: Fin) {
  const NU = 26, NV = 30
  const pos: number[] = []
  const idx: number[] = []
  const col: number[] = []
  const P = (u: number, v: number) => new THREE.Vector3(...finPoint(f, u, v))
  for (const sd of [1, -1]) {
    const base = pos.length / 3
    for (let j = 0; j <= NV; j++)
      for (let i = 0; i <= NU; i++) {
        const u = i / NU, v = j / NV
        const p = P(u, v)
        const du = P(Math.min(1, u + 0.01), v).sub(P(Math.max(0, u - 0.01), v))
        const dv = P(u, Math.min(1, v + 0.01)).sub(P(u, Math.max(0, v - 0.01)))
        const n = du.cross(dv).normalize()
        // thickest at the root and toward the leading edge; a knife edge elsewhere
        const th = f.thick * (1 - v * 0.85) * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) * (f.spine && u < 0.08 ? 2.2 : 1)
        p.addScaledVector(n, sd * th)
        pos.push(p.x, p.y, p.z)
        // fins darken toward the trailing edge; the dorsal spine is pale
        const k = 1 - 0.28 * u * v - 0.12 * v
        let c: RGB = [f.c[0] * k, f.c[1] * k, f.c[2] * k * 1.02]
        if (f.spine && u < 0.07) c = [0.93, 0.9, 0.84]
        col.push(...lin(c))
      }
    for (let j = 0; j < NV; j++)
      for (let i = 0; i < NU; i++) {
        const a = base + j * (NU + 1) + i, b = a + NU + 1
        if (sd > 0) idx.push(a, b, a + 1, a + 1, b, b + 1)
        else idx.push(a, a + 1, b, a + 1, b + 1, b)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function snoutGeometry() {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 40; i++) {
    const [x, y] = snoutAt(i / 40)
    pts.push(new THREE.Vector3(x, y, 0))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const tube = new THREE.TubeGeometry(curve, 80, 1, 24, false)
  // taper the tube along its length
  const p = tube.attributes.position
  const n = tube.attributes.normal
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / 25) / 80
    const ctr = curve.getPointAt(ring)
    const rad = snoutAt(ring)[2]
    const dx = p.getX(i) - ctr.x, dy = p.getY(i) - ctr.y, dz = p.getZ(i) - ctr.z
    p.setXYZ(i, ctr.x + dx * rad, ctr.y + dy * rad, ctr.z + dz * rad * 0.9)
    void n
  }
  tube.computeVertexNormals()
  // the hoe: a flattened ellipsoid at the tip, facing forward and down
  const [hx, hy] = snoutAt(1)
  const hoe = new THREE.SphereGeometry(1, 32, 16)
  hoe.scale(0.3, 0.2, 0.66)
  hoe.rotateZ(-0.5)
  hoe.translate(hx - 0.05, hy - 0.08, 0)
  const tip = new THREE.SphereGeometry(1, 20, 12)
  const [bx, by] = snoutAt(0)
  tip.scale(0.45, 0.45, 0.4)
  tip.translate(bx, by, 0)
  const bits = [tube.toNonIndexed(), hoe.toNonIndexed(), tip.toNonIndexed()]
  for (const q of bits) q.deleteAttribute('uv')
  const g = mergeGeometries(bits)!
  const c = SKIN.snout
  return colorize(g, (x) => {
    const k = 0.9 + 0.1 * Math.sin(x * 9)
    return [c[0] * k, c[1] * k, c[2] * k]
  })
}

function eyeGeometry(side: number) {
  const { W, H, yc } = bodyAt(EYE.x)
  const g = new THREE.SphereGeometry(EYE.r, 32, 20)
  g.scale(1, 0.85, 0.55)
  const z = side * W * Math.sqrt(Math.max(0, 1 - Math.pow((EYE.y - yc) / H, 2))) * 0.93
  g.translate(EYE.x, EYE.y, z)
  return colorize(g, (x, y, zz) => {
    const out = (zz - z) * side
    const d = Math.hypot(x - EYE.x, (y - EYE.y) / 0.85)
    // a black pupil, a green iridescent ring (chimaeras' eyes shine green)
    if (out > 0.12 && d < 0.2) return [0.01, 0.015, 0.012]
    if (out > 0.05 && d < 0.36) return [0.12, 0.85, 0.55]
    return [0.05, 0.25, 0.2]
  })
}

const clean = (parts: THREE.BufferGeometry[]) => {
  for (const q of parts) for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k)
  const g = mergeGeometries(parts)!
  g.computeBoundingSphere()
  return g
}
export function sharkBodyGeometry() {
  return clean([bodyGeometry().toNonIndexed(), snoutGeometry(), eyeGeometry(1).toNonIndexed(), eyeGeometry(-1).toNonIndexed()])
}
export function sharkFinGeometry() {
  return clean(sharkFins().map((f) => finGeometry(f).toNonIndexed()))
}
let GEO: THREE.BufferGeometry | null = null
export function sharkGeometry() {
  return (GEO ??= clean([sharkBodyGeometry(), sharkFinGeometry()]))
}

/* ---------------------------------------------------------- the material */
export type Dissolve = {
  uT: { value: number }
  uStagger: { value: number }
  uSweep: { value: THREE.Vector3 }
  uSweepR: { value: THREE.Vector2 }
  /** 0 = solid until the front passes (it burns away) · 1 = appears after the front (it crystallises) · -1 = always solid */
  uMode: { value: number }
  uCaustic: { value: number }
  uKeyCol: { value: THREE.Color }
  uPhase: { value: number }
  uSwim: { value: number }
  uGlow: { value: THREE.Color }
}

export function dissolveUniforms(): Dissolve {
  return {
    uT: { value: 0 },
    uStagger: { value: 0.5 },
    uSweep: { value: new THREE.Vector3(1, 0, 0) },
    uSweepR: { value: new THREE.Vector2(-16, 16) },
    uMode: { value: -1 },
    uCaustic: { value: 0 },
    uKeyCol: { value: new THREE.Color(1, 1, 1) },
    uPhase: { value: 0 },
    uSwim: { value: 1 },
    uGlow: { value: new THREE.Color(0.6, 1.4, 1.8) },
  }
}

/** inject swim, dissolve and caustics into a physical material */
export function dissolvable(mat: THREE.MeshPhysicalMaterial, d: Dissolve, opts: { swim?: boolean; skin?: boolean } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, d, { uTime: U.uTime })
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime, uPhase, uSwim;
        varying vec3 vWP;
        varying vec3 vWN;
        varying vec3 vOP;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        ${
          opts.swim
            ? `{
          float amp = (0.08 + 0.5 * smoothstep(-6.0, 12.0, position.x)) * uSwim;
          float ph2 = position.x * 0.42 - uTime * 2.6 + uPhase;
          float slope = amp * 1.2 * 0.42 * cos(ph2);
          objectNormal = normalize(vec3(objectNormal.x - slope * objectNormal.z, objectNormal.y, objectNormal.z));
        }`
            : ''
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vOP = transformed;
        ${
          opts.swim
            ? `{
          float amp = (0.08 + 0.5 * smoothstep(-6.0, 12.0, position.x)) * uSwim;
          float ph2 = position.x * 0.42 - uTime * 2.6 + uPhase;
          transformed.z += amp * sin(ph2) * 1.2;
          transformed.y += 0.12 * sin(uTime * 0.9 + uPhase) * uSwim;
        }`
            : ''
        }`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWN = normalize(mat3(modelMatrix) * objectNormal);
        #endif`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${HASH}
        ${NOISE}
        ${CAUSTIC}
        uniform float uT, uStagger, uMode, uCaustic, uTime;
        uniform vec3 uSweep, uKeyCol, uGlow;
        uniform vec2 uSweepR;
        varying vec3 vWP;
        varying vec3 vWN;
        varying vec3 vOP;
        float edgeGlow = 0.0;`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if (uMode > -0.5) {
          float key = (dot(vWP, uSweep) - uSweepR.x) / max(1e-3, uSweepR.y - uSweepR.x);
          key = clamp(key * 0.92 + (fbm(vWP * 1.3, 3) * 0.5 + 0.5) * 0.08, 0.0, 1.0);
          float tl = uT * (1.0 + uStagger) - key * uStagger;
          if (uMode < 0.5) {
            if (tl > 0.0) discard;
            edgeGlow = smoothstep(-0.035, 0.0, tl);
          } else {
            if (tl < 0.96) discard;
            edgeGlow = 1.0 - smoothstep(0.96, 1.0, tl);
          }
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${
          opts.skin
            ? `{
          // dermal texture: fine mottling and tiny pale denticle glints
          float m = fbm(vOP * vec3(2.2, 3.0, 3.0), 4);
          diffuseColor.rgb *= 0.88 + 0.22 * m;
          float sp = smoothstep(0.82, 0.9, hash13(floor(vOP * 38.0)));
          diffuseColor.rgb += sp * 0.05;
        }`
            : ''
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        ${
          opts.skin
            ? `{
          // skin relief: soft folds plus fine grain, so light breaks up across it
          vec3 q = vOP * vec3(3.0, 5.0, 5.0);
          vec3 g = vec3(gnoise(q), gnoise(q + 7.1), gnoise(q + 13.7)) * 0.16 + vec3(gnoise(q * 6.0), gnoise(q * 6.0 + 3.3), gnoise(q * 6.0 + 9.1)) * 0.07;
          normal = normalize(normal + g);
        }`
            : ''
        }`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          float cs = caustic(vWP.xz * 0.42 + vec2(0.0, vWP.y * 0.1), uTime);
          float up = clamp(vWN.y * 0.8 + 0.25, 0.0, 1.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * uKeyCol * cs * up * uCaustic * 0.55;
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * edgeGlow * 4.0;`,
      )
  }
  mat.customProgramCacheKey = () => 'dissolve' + (opts.swim ? 's' : '') + (opts.skin ? 'k' : '')
  return mat
}

export function buildShark() {
  const d = dissolveUniforms()
  const skin = dissolvable(
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.58,
      metalness: 0.0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.35,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0.5, 0.75, 0.9),
      iridescence: 0.35,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [200, 480],
      envMapIntensity: 0.45,
    }),
    d,
    { swim: true, skin: true },
  )
  // fins: thin, a little translucent, lit from both sides
  const finMat = dissolvable(
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.5,
      clearcoat: 0.3,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      sheen: 0.4,
      sheenColor: new THREE.Color(0.6, 0.8, 0.95),
    }),
    d,
    { swim: true, skin: true },
  )
  const body = new THREE.Mesh(sharkBodyGeometry(), skin)
  const fins = new THREE.Mesh(sharkFinGeometry(), finMat)
  const mesh = new THREE.Group()
  mesh.add(body, fins)
  mesh.matrixAutoUpdate = false
  body.frustumCulled = fins.frustumCulled = false
  return { mesh, d }
}

/* The swarm's shark: N points sampled from the same surface, with its normals
   and colours, so the hand-off from skin to particles is seamless. */
export function sharkFormFromMesh(seed = 21) {
  const geo = sharkGeometry()
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
  const s = new MeshSurfaceSampler(mesh).build()
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color()
  const fb = new FB()
  for (let i = 0; i < N; i++) {
    s.sample(p, n, c)
    const g = 1 / 2.2
    fb.add(p.x, p.y, p.z, 0.075, [Math.pow(c.r, g), Math.pow(c.g, g), Math.pow(c.b, g)], 1, n.x, n.y, n.z, 0.7)
  }
  return finish(fb, 'x', seed)
}

/* The finale: the same shark, its surface painted head to tail in the Hox
   colours (anterior genes at the snout, posterior at the tail), glowing. */
export function sharkHoxForm(colors: RGB[], seed = 23) {
  const geo = sharkGeometry()
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
  const s = new MeshSurfaceSampler(mesh).build()
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color()
  const fb = new FB()
  const [a, b] = [X0 + 1.5, X1 - 1]
  for (let i = 0; i < N; i++) {
    s.sample(p, n, c)
    const t = Math.min(0.999, Math.max(0, (p.x - a) / (b - a)))
    const k = t * colors.length
    const j = Math.floor(k), f = k - j
    const c0 = colors[j], c1 = colors[Math.min(colors.length - 1, j + 1)]
    const w = Math.max(0, (f - 0.8) / 0.2) // soft seams between domains
    const hox: RGB = [c0[0] + (c1[0] - c0[0]) * w, c0[1] + (c1[1] - c0[1]) * w, c0[2] + (c1[2] - c0[2]) * w]
    // paint over the skin rather than replace it: the animal's own shading stays
    const g = 1 / 2.2
    const skin: RGB = [Math.pow(c.r, g), Math.pow(c.g, g), Math.pow(c.b, g)]
    const col: RGB = [hox[0] * (0.45 + 0.55 * skin[0]), hox[1] * (0.45 + 0.55 * skin[1]), hox[2] * (0.45 + 0.55 * skin[2])]
    fb.add(p.x, p.y, p.z, 0.075, col, 1, n.x, n.y, n.z, 0.75)
  }
  return finish(fb, 'x', seed)
}
