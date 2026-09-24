/* ==========================================================================
   THE RENDER GRAPH (one frame)
     world     full-screen: ocean, lab, graph paper or notebook (and the wipe)
     scene     the glossy molecules (depth-tested), then the swarm
     post      bloom → grade → screen
   All in one linear half-float buffer, multisampled.
   ========================================================================== */
import * as THREE from 'three'
import { film, camAt } from '../core/film'
import { Swarm, FLIGHT_DEFAULT, N } from './swarm'
import { worldPass } from './world'
import { Bloom, finalPass, rt } from './post'
import { U } from './uniforms'
import { GENS, FORM_COUNT } from './forms/index'
import { NETWORK } from './forms/charts'
import { scroll } from '../core/scroll'
import { rigAt, Lights } from './rig'
import { buildShark, type Dissolve } from './creature'
import { buildAtoms, dnaAtoms } from './atoms'
import { helixSeq, HELIX } from './forms/dna'
import { seafloor, kelp, oceanEnv, labEnv } from './world3d'
import { Mol } from './mol'

const M4 = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const V = new THREE.Vector3()
const S = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)

export class Engine {
  renderer: THREE.WebGLRenderer
  cam = new THREE.PerspectiveCamera(38, 1, 0.1, 2000)
  scene = new THREE.Scene()
  world = worldPass()
  swarm = new Swarm(FORM_COUNT)
  A = rt(2, 2, true, 4)
  bloom = new Bloom(6)
  finalP = finalPass()
  w = 1
  h = 1
  dpr = 1
  spot = { x: 0, y: 0, r: 280, amt: 0 }
  private camPos = new THREE.Vector3()
  private camTgt = new THREE.Vector3()
  private slow = 0
  lights = new Lights()
  shark = buildShark()
  atoms = buildAtoms(dnaAtoms(helixSeq(), HELIX.x0))
  floor: ReturnType<typeof seafloor>
  kelp: ReturnType<typeof kelp>
  envs: THREE.Texture[] = []
  mol = new Mol()
  /** forms that a solid mesh stands in for while they hold still */
  backers: Record<string, { obj: THREE.Object3D; d: Dissolve; sync: (F: number, m: THREE.Matrix4) => void }> = {}

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.autoClear = false
    this.renderer.setClearColor(0x000000, 1)
    this.scene.add(this.swarm.points)
    this.swarm.points.renderOrder = 10
    this.renderer.toneMapping = THREE.NoToneMapping
    this.scene.add(this.lights.group)
    this.floor = seafloor(this.world.mat.uniforms)
    this.scene.add(this.floor.mesh)
    this.kelp = kelp(this.world.mat.uniforms)
    this.scene.add(this.kelp.mesh)
    this.scene.add(this.shark.mesh, this.atoms.group, this.mol.root)
    this.envs = [oceanEnv(this.renderer), labEnv(this.renderer)]
    this.backers = {
      shark: {
        obj: this.shark.mesh,
        d: this.shark.d,
        sync: (_F, m) => this.shark.mesh.matrix.copy(m),
      },
      helix: {
        obj: this.atoms.group,
        d: this.atoms.d,
        // the atoms turn exactly as the swarm's spin animation does
        sync: (_F, m) => {
          this.atoms.group.matrixAutoUpdate = false
          const R = new THREE.Matrix4().makeRotationX(-(U.uTime.value * 0.3))
          this.atoms.group.matrix.multiplyMatrices(m, R)
        },
      },
    }
    this.resize()
    addEventListener('resize', () => this.resize())
  }

  /** build every form in a worker; resolve once the opening chapter's forms are in */
  build(progress?: (p: number) => void) {
    const worker = new Worker(new URL('./forms/worker.ts', import.meta.url), { type: 'module' })
    let layer = 0
    const first = GENS.slice(0, 2).reduce((s, g) => s + g.names.length, 0)
    return new Promise<void>((resolve) => {
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data
        if (m.done) {
          worker.terminate()
          return
        }
        m.out.forEach((o: { pos: Float32Array; col: Uint8Array; nrm: Uint8Array }, i: number) => {
          this.swarm.put(m.names[i], layer, o.pos, o.col, o.nrm, m.anims[i] ?? 0)
          this.swarm.uploadLayer(layer)
          layer++
        })
        if (m.meta?.network) NETWORK.modules.splice(0, NETWORK.modules.length, ...(m.meta.network as typeof NETWORK.modules))
        progress?.(Math.min(1, layer / first))
        if (layer >= first) resolve()
      }
      worker.postMessage('go')
    })
  }

  /** compile every shader now (in parallel, off the critical path) so no
      scene stalls the first time it appears */
  async warm() {
    const hidden: THREE.Object3D[] = []
    this.scene.traverse((o) => {
      if (!o.visible) (hidden.push(o), (o.visible = true))
    })
    for (const sc of this.mol.scenes) for (const d of sc.d) d.uMode.value = 0
    try {
      await this.renderer.compileAsync(this.scene, this.cam)
    } catch {
      this.renderer.compile(this.scene, this.cam)
    }
    for (const o of hidden) o.visible = false
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, this.slow > 30 ? 1.15 : 1.5)
    this.w = innerWidth
    this.h = innerHeight
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(this.w, this.h, false)
    const W = Math.floor(this.w * this.dpr), H = Math.floor(this.h * this.dpr)
    this.A.setSize(W, H)
    this.bloom.setSize(W, H)
    U.uRes.value.set(W, H)
    this.cam.aspect = this.w / this.h
    this.cam.updateProjectionMatrix()
  }

  /** screen position (CSS px) of a world point */
  project(v: THREE.Vector3): [number, number, boolean] {
    V.copy(v).project(this.cam)
    return [(V.x * 0.5 + 0.5) * this.w, (-V.y * 0.5 + 0.5) * this.h, V.z < 1]
  }

  private placeMatrix(key: typeof film.keyA, F: number, out: THREE.Matrix4) {
    if (!key?.place) return out.identity()
    const [x, y, z, ry, s] = key.place(F)
    Q.setFromAxisAngle(Y, ry)
    return out.compose(V.set(x, y, z), Q, S.set(s, s, s))
  }

  frame(dt: number) {
    const F = film.F
    U.uTime.value += dt
    U.uScrollVel.value = scroll.velN
    // adaptive quality: a sustained slow frame rate drops the pixel ratio once
    if (dt > 1 / 40) this.slow++
    else this.slow = Math.max(0, this.slow - 0.2)
    if (this.slow > 30 && this.dpr > 1.15) this.resize()

    /* camera */
    const c = camAt(F, this.camPos, this.camTgt)
    this.cam.position.copy(this.camPos)
    this.cam.up.set(Math.sin(c.roll), Math.cos(c.roll), 0)
    this.cam.lookAt(this.camTgt)
    this.cam.fov = c.fov
    // shift the picture right of centre, leaving the left for the copy
    const sx = -c.shift * this.w
    this.cam.setViewOffset(this.w, this.h, sx, 0, this.w, this.h)
    this.cam.updateProjectionMatrix()
    film.shift = c.shift

    /* world */
    const wu = this.world.mat.uniforms
    wu.uW0.value = film.w0
    wu.uW1.value = film.w1
    wu.uWT.value = film.wt
    wu.uWDir.value.set(film.wdir[0], film.wdir[1])
    wu.uWRad.value = film.wrad

    /* swarm */
    const su = this.swarm.mat.uniforms
    const sw = this.swarm
    su.uA.value = sw.layer(film.formA)
    su.uB.value = sw.layer(film.formB)
    su.uAnimA.value = sw.anims[su.uA.value]
    su.uAnimB.value = sw.anims[su.uB.value]
    su.uT.value = film.morph
    const fl = { ...FLIGHT_DEFAULT, ...(film.keyB?.flight ?? {}) }
    su.uStyle.value = fl.style
    su.uStagger.value = fl.stagger
    su.uScatter.value = fl.scatter
    su.uSweep.value.set(...fl.sweep).normalize()
    su.uSweepR.value.set(-16, 16)
    this.placeMatrix(film.keyA, F, su.uMatA.value)
    this.placeMatrix(film.keyB, F, su.uMatB.value)
    su.uAlphaA.value = film.keyA?.alpha ?? 1
    su.uAlphaB.value = film.keyB?.alpha ?? 1
    su.uInk.value = film.ink
    su.uSoft.value = 0

    /* the light of the world we're in (blended through the wipe) */
    const rig = rigAt(film.w0, film.w1, film.wt)
    su.uKeyDir.value.set(...rig.keyDir).normalize()
    su.uKeyCol.value.setRGB(...rig.key)
    su.uSkyCol.value.setRGB(...rig.sky)
    su.uGroundCol.value.setRGB(...rig.ground)
    su.uRimCol.value.setRGB(...rig.rim)
    su.uFogCol.value.setRGB(...rig.fog)
    su.uFogDen.value = rig.fogDen
    su.uCaustic.value = rig.caustic
    su.uLit.value = rig.lit
    su.uAperture.value = rig.aperture
    su.uFocus.value = this.camPos.distanceTo(this.camTgt)
    this.lights.apply(rig, this.cam)
    this.floor.mat.uniforms.uFogCol.value.setRGB(...rig.fog)
    const nowWorld = film.wt > 0.5 ? film.w1 : film.w0
    this.scene.environment = this.envs[nowWorld === 0 ? 0 : 1]
    this.scene.environmentIntensity = rig.env
    this.floor.mesh.visible = this.kelp.mesh.visible = film.w0 === 0 || film.w1 === 0
    this.kelp.mat.uniforms.uFogCol.value.setRGB(...rig.fog)

    this.mol.update(F)

    /* solid stand-ins: burn away as their form leaves, crystallise as it arrives */
    su.uHideA.value = 0
    su.uHideB.value = 0
    for (const [name, b] of Object.entries(this.backers)) {
      const isA = film.formA === name, isB = film.formB === name
      b.obj.visible = isA || isB
      if (!b.obj.visible) continue
      const d = b.d
      d.uT.value = film.morph
      d.uStagger.value = fl.stagger
      d.uSweep.value.copy(su.uSweep.value)
      d.uSweepR.value.copy(su.uSweepR.value)
      d.uCaustic.value = rig.caustic
      d.uKeyCol.value.setRGB(...rig.key)
      if (isA && isB) d.uMode.value = -1
      else if (isA) d.uMode.value = film.morph > 0 ? 0 : -1
      else d.uMode.value = 1
      if (isA) su.uHideA.value = 1
      if (isB) su.uHideB.value = 1
      b.sync(F, isA ? su.uMatA.value : su.uMatB.value)
    }
    // size in world units → pixels for this camera
    su.uPoint.value = 1 / (2 * Math.tan((this.cam.fov * Math.PI) / 360))
    this.swarm.points.visible = film.swarmAlpha > 0.001

    /* render */
    const r = this.renderer
    r.setRenderTarget(this.A)
    r.clear(true, true, true)
    r.render(this.world.scene, this.world.cam)
    r.render(this.scene, this.cam)

    const bl = this.bloom.render(r, this.A.texture, 0.95)
    const fu = this.finalP.mat.uniforms
    fu.uMap.value = this.A.texture
    fu.uBloom.value = bl
    fu.uBloomAmt.value = 0.35 + 0.4 * film.dark
    fu.uVignette.value = 0.18 + 0.3 * film.dark
    fu.uSpotAmt.value = this.spot.amt
    // the sun, high above the water, projected to the screen
    V.set(this.camTgt.x + 6, this.camTgt.y + 80, this.camTgt.z - 20).project(this.cam)
    fu.uSun.value.set(V.x * 0.5 + 0.5, V.y * 0.5 + 0.5)
    fu.uShafts.value = rig.caustic * 0.55
    fu.uSpot.value.set(this.spot.x / this.w, 1 - this.spot.y / this.h, (this.spot.r / this.h) * 1.0)
    this.finalP.render(r, null)
  }
}

export { N }
