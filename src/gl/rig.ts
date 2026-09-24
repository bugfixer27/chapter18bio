/* The light of each world. The swarm, the glossy meshes and the fog all read
   one blended rig, so when the page wipes from sea to lab the light itself
   changes: caustic blue from above → white softboxes → the warm oil lamp of
   a naturalist's desk. */
import * as THREE from 'three'

export type Rig = {
  keyDir: [number, number, number]
  key: [number, number, number]
  sky: [number, number, number]
  ground: [number, number, number]
  rim: [number, number, number]
  fog: [number, number, number]
  fogDen: number
  caustic: number
  lit: number
  aperture: number
  env: number
}

/* colours are linear */
export const RIGS: Rig[] = [
  // 0 · ocean: sun straight down through waves, blue fill, deep blue fog
  { keyDir: [0.15, 1, 0.25], key: [1.35, 1.6, 1.6], sky: [0.16, 0.42, 0.62], ground: [0.01, 0.05, 0.1], rim: [0.25, 0.75, 1.0], fog: [0.006, 0.09, 0.2], fogDen: 0.012, caustic: 1, lit: 1, aperture: 0.007, env: 0.55 },
  // 1 · lab: a big warm-white softbox up left, cool fill, white rim
  { keyDir: [-0.6, 0.7, 0.45], key: [2.0, 1.9, 1.75], sky: [0.16, 0.18, 0.22], ground: [0.03, 0.03, 0.04], rim: [1.3, 1.35, 1.45], fog: [0.86, 0.89, 0.93], fogDen: 0.002, caustic: 0, lit: 1, aperture: 0.008, env: 0.45 },
  // 2 · graph: flat, even, almost unlit, so data reads as printed ink
  { keyDir: [0.0, 0.5, 1.0], key: [0.9, 0.9, 0.9], sky: [0.75, 0.75, 0.75], ground: [0.6, 0.6, 0.6], rim: [0.0, 0.0, 0.0], fog: [0.95, 0.95, 0.93], fogDen: 0.0, caustic: 0, lit: 0.25, aperture: 0.0, env: 0.6 },
  // 3 · notebook: an oil lamp low on the left, warm; drawings are ink first
  { keyDir: [-0.7, 0.45, 0.55], key: [2.0, 1.35, 0.7], sky: [0.5, 0.38, 0.26], ground: [0.22, 0.14, 0.08], rim: [0.8, 0.5, 0.25], fog: [0.8, 0.7, 0.52], fogDen: 0.0, caustic: 0, lit: 0.3, aperture: 0.004, env: 0.5 },
]

const tmp: Rig = JSON.parse(JSON.stringify(RIGS[0]))
const mix3 = (a: number[], b: number[], t: number, o: number[]) => {
  for (let i = 0; i < 3; i++) o[i] = a[i] + (b[i] - a[i]) * t
}
export function rigAt(w0: number, w1: number, t: number) {
  const a = RIGS[w0], b = RIGS[w1]
  const k = t * t * (3 - 2 * t)
  mix3(a.keyDir, b.keyDir, k, tmp.keyDir)
  mix3(a.key, b.key, k, tmp.key)
  mix3(a.sky, b.sky, k, tmp.sky)
  mix3(a.ground, b.ground, k, tmp.ground)
  mix3(a.rim, b.rim, k, tmp.rim)
  mix3(a.fog, b.fog, k, tmp.fog)
  tmp.fogDen = a.fogDen + (b.fogDen - a.fogDen) * k
  tmp.caustic = a.caustic + (b.caustic - a.caustic) * k
  tmp.lit = a.lit + (b.lit - a.lit) * k
  tmp.aperture = a.aperture + (b.aperture - a.aperture) * k
  tmp.env = a.env + (b.env - a.env) * k
  return tmp
}

/** real three.js lights that follow the rig, for the glossy meshes */
export class Lights {
  key = new THREE.DirectionalLight(0xffffff, 1)
  hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1)
  rim = new THREE.DirectionalLight(0xffffff, 0.5)
  group = new THREE.Group()
  constructor() {
    this.group.add(this.key, this.key.target, this.hemi, this.rim, this.rim.target)
  }
  apply(r: Rig, cam: THREE.Camera) {
    const d = new THREE.Vector3(...r.keyDir).normalize()
    this.key.position.copy(d).multiplyScalar(40)
    this.key.color.setRGB(r.key[0], r.key[1], r.key[2], THREE.LinearSRGBColorSpace)
    this.key.intensity = 1.6
    this.hemi.color.setRGB(r.sky[0], r.sky[1], r.sky[2], THREE.LinearSRGBColorSpace)
    this.hemi.groundColor.setRGB(r.ground[0], r.ground[1], r.ground[2], THREE.LinearSRGBColorSpace)
    this.hemi.intensity = 1.6
    // the rim light sits behind the subject, opposite the camera
    const back = new THREE.Vector3().subVectors(new THREE.Vector3(), cam.position).normalize()
    this.rim.position.copy(back).multiplyScalar(40).add(new THREE.Vector3(0, 12, 0))
    this.rim.color.setRGB(r.rim[0], r.rim[1], r.rim[2], THREE.LinearSRGBColorSpace)
    this.rim.intensity = 2.0
  }
}
