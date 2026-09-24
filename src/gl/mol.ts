/* ==========================================================================
   THE MOLECULAR STAGE
   Glossy, lit 3-D models for the moments that are about mechanism:
     transposon     cut-and-paste, then copy-and-paste (Figure 18.7)
     retro          a retrotransposon through its RNA intermediate (18.8)
     hemoglobin     α2β2 with its hemes, and the family's developmental switch
     fusion         two ancestral chromosomes join into human 2 (18.10)
     unequal        unequal crossing over duplicates a gene (18.12)
   Each scene materialises out of the swarm with a glowing front and burns
   away the same way when its time is up. Everything is a pure function of F.
   ========================================================================== */
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { dissolvable, dissolveUniforms, type Dissolve } from './creature'
import { BASE, hex, rng, type RGB } from './forms/base'
import { ramp, smooth, band, lerp, clamp01 } from '../core/film'

const lin = (c: RGB) => new THREE.Color().setRGB(Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2), THREE.LinearSRGBColorSpace)
const SEQ = 'ATGCGTACCTAGGCATTCGATCGGATCCTAAGCTTGCAGTCAGGTACCATGCATGCTAGC'
const COMP: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' }

/* ------------------------------------------------------------ materials */
function glossy(d: Dissolve, opts: { color?: THREE.Color; vertex?: boolean; rough?: number; clear?: number; skin?: boolean; transmit?: boolean } = {}) {
  return dissolvable(
    new THREE.MeshPhysicalMaterial({
      color: opts.color ?? new THREE.Color(1, 1, 1),
      vertexColors: !!opts.vertex,
      roughness: opts.rough ?? 0.3,
      metalness: 0,
      clearcoat: opts.clear ?? 0.8,
      clearcoatRoughness: 0.12,
      iridescence: 0.12,
    }),
    d,
    { skin: opts.skin },
  )
}

/* ------------------------------------------------------------- DNA duplex
   A stylised B-DNA: two backbone tubes and base-pair rungs, 1 unit = 1 nm
   (radius 1, 0.34 per base pair, 10.5 bp per turn). Built as a segment that
   starts at base-pair index i0 so segments join with a continuous twist. */
const RISE = 0.34, TURN = 10.5, R = 0.95, GROOVE = 2.4
function duplex(n: number, i0: number, d: Dissolve, tint?: RGB, rungTint = 0) {
  const g = new THREE.Group()
  const back = tint ? lin(tint) : lin(hex('#c7d0dc'))
  const mat = glossy(d, { color: back, rough: 0.22, clear: 1 })
  for (const s of [0, 1]) {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= n * 4; k++) {
      const i = i0 + k / 4
      const a = (i / TURN) * Math.PI * 2 + (s ? GROOVE : 0)
      pts.push(new THREE.Vector3((i - i0) * RISE, Math.cos(a) * R, Math.sin(a) * R))
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 6, 0.17, 10, false), mat)
    g.add(tube)
  }
  // rungs: one instanced cylinder per half base pair, coloured by base
  const cyl = new THREE.CylinderGeometry(0.11, 0.11, 1, 10)
  cyl.rotateZ(Math.PI / 2)
  const rungs = new THREE.InstancedMesh(cyl, glossy(d, { rough: 0.35, clear: 0.6 }), n * 2)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color()
  for (let k = 0; k < n; k++) {
    const i = i0 + k + 0.5
    const a1 = (i / TURN) * Math.PI * 2, a2 = a1 + GROOVE
    const p1 = new THREE.Vector3((k + 0.5) * RISE, Math.cos(a1) * R * 0.92, Math.sin(a1) * R * 0.92)
    const p2 = new THREE.Vector3((k + 0.5) * RISE, Math.cos(a2) * R * 0.92, Math.sin(a2) * R * 0.92)
    const mid = p1.clone().add(p2).multiplyScalar(0.5)
    const b = SEQ[(i0 + k) % SEQ.length]
    for (const [from, base] of [[p1, b], [p2, COMP[b]]] as const) {
      const dir = mid.clone().sub(from)
      const len = dir.length()
      q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize())
      m.compose(from.clone().add(mid).multiplyScalar(0.5), q, new THREE.Vector3(len, 1, 1))
      const idx = k * 2 + (from === p1 ? 0 : 1)
      rungs.setMatrixAt(idx, m)
      let col = BASE[base as 'A']
      if (tint && rungTint) col = [col[0] * (1 - rungTint) + tint[0] * rungTint, col[1] * (1 - rungTint) + tint[1] * rungTint, col[2] * (1 - rungTint) + tint[2] * rungTint]
      rungs.setColorAt(idx, c.copy(lin(col)))
    }
  }
  rungs.instanceMatrix.needsUpdate = true
  g.add(rungs)
  g.userData.len = n * RISE
  return g
}

/* a single RNA strand: one backbone and half-rungs */
function rna(n: number, d: Dissolve) {
  const g = new THREE.Group()
  const pts: THREE.Vector3[] = []
  for (let k = 0; k <= n * 4; k++) {
    const i = k / 4
    pts.push(new THREE.Vector3(i * RISE, Math.sin(i * 0.6) * 0.25, Math.cos(i * 0.6) * 0.25))
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 5, 0.16, 8, false), glossy(d, { color: lin(hex('#ff8c1a')), rough: 0.25 })))
  const cyl = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8)
  const rungs = new THREE.InstancedMesh(cyl, glossy(d, { rough: 0.35 }), n)
  const m = new THREE.Matrix4(), c = new THREE.Color()
  for (let k = 0; k < n; k++) {
    m.makeTranslation((k + 0.5) * RISE, -0.4, 0)
    rungs.setMatrixAt(k, m)
    const b = SEQ[(k + 7) % SEQ.length]
    rungs.setColorAt(k, c.copy(lin(BASE[(b === 'T' ? 'A' : b) as 'A'])))
  }
  g.add(rungs)
  g.userData.len = n * RISE
  return g
}

/* an enzyme: a lumpy glossy globule */
function blob(r: number, color: string, d: Dissolve, seed: number) {
  // welded, so the normals are smooth rather than faceted
  const geo = mergeVertices(new THREE.IcosahedronGeometry(r, 6).deleteAttribute('normal').deleteAttribute('uv'))
  const p = geo.attributes.position
  const rr = rng(seed)
  const bumps = Array.from({ length: 14 }, () => new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize())
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = v.clone().normalize()
    let k = 0
    for (const b of bumps) k += Math.pow(Math.max(0, n.dot(b)), 8) * 0.22
    k += Math.sin(n.x * 9 + seed) * Math.sin(n.y * 7) * Math.sin(n.z * 8) * 0.05
    v.multiplyScalar(1 + k)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, glossy(d, { color: lin(hex(color)), rough: 0.42, clear: 0.5, skin: true }))
}

/* ------------------------------------------------------------ chromosomes
   A chromatid: a capsule of chromatin along a path, banded like a stained
   karyotype. bands: [start, end, colour] as fractions of its length. */
function chromatid(len: number, rad: number, bands: [number, number, string][], d: Dissolve, base = '#b7a4ff', pinchAt = -1) {
  const pts: THREE.Vector3[] = []
  for (let k = 0; k <= 40; k++) pts.push(new THREE.Vector3(0, -len / 2 + (len * k) / 40, 0))
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 1, 24, false)
  const p = tube.attributes.position
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const t = (v.y + len / 2) / len
    // rounded ends, a waist at the centromere
    const cap = Math.sqrt(Math.max(0.02, 1 - Math.pow(Math.max(0, Math.abs(t - 0.5) * 2 - 0.86) / 0.14, 2)))
    const pinch = pinchAt >= 0 ? 1 - 0.45 * Math.exp(-Math.pow((t - pinchAt) / 0.035, 2)) : 1
    // chromatin: irregular loops, not rings
    const ang = Math.atan2(v.z, v.x)
    const lump = 1 + 0.035 * Math.sin(v.y * 4.1 + ang * 3) * Math.sin(v.y * 2.3 - ang * 2 + 1.7) + 0.025 * Math.sin(v.y * 11 + ang * 7)
    const r = rad * cap * pinch * lump
    p.setXYZ(i, v.x * r, v.y, v.z * r)
    let c = hex(base)
    for (const [a, b, h] of bands) if (t >= a && t <= b) c = hex(h)
    const l = lin(c)
    col[i * 3] = l.r
    col[i * 3 + 1] = l.g
    col[i * 3 + 2] = l.b
  }
  tube.setAttribute('color', new THREE.BufferAttribute(col, 3))
  tube.computeVertexNormals()
  return new THREE.Mesh(tube, glossy(d, { vertex: true, rough: 0.5, clear: 0.35, skin: true }))
}
/* a stylised G-band pattern, mirrored so homologous chromosomes match */
function bandsFor(seed: number, n = 9, dark = '#4a2fb0'): [number, number, string][] {
  const r = rng(seed)
  const out: [number, number, string][] = []
  for (let i = 0; i < n; i++) {
    const a = (i + 0.2 + r() * 0.4) / n
    out.push([a, a + 0.25 / n + r() * 0.2 / n, dark])
  }
  return out
}

/* ------------------------------------------------------------------ scenes */
type Scene = { g: THREE.Group; d: Dissolve[]; a: number; b: number; update: (F: number) => void }

function withDissolve(n: number) {
  return Array.from({ length: n }, () => dissolveUniforms())
}

export class Mol {
  root = new THREE.Group()
  scenes: Scene[] = []
  /** parts the labels point at */
  named: Record<string, THREE.Object3D> = {}
  private tmp = new THREE.Vector3()
  /** world position of a named part (plus an offset in its own frame) */
  at(name: string, ox = 0, oy = 0, oz = 0): [number, number, number] {
    const o = this.named[name]
    if (!o) return [0, 0, 0]
    o.updateWorldMatrix(true, false)
    this.tmp.set(ox, oy, oz).applyMatrix4(o.matrixWorld)
    return [this.tmp.x, this.tmp.y, this.tmp.z]
  }
  constructor() {
    this.scenes.push(this.transposon(), this.retro(), this.hemoglobin(), this.fusion(), this.unequal())
    for (const s of this.scenes) this.root.add(s.g)
  }

  update(F: number) {
    for (const s of this.scenes) {
      const on = F > s.a - 0.001 && F < s.b + 0.001
      s.g.visible = on
      if (!on) continue
      // materialise at the start, burn away at the end, solid between
      const inT = ramp(s.a, s.a + 0.035, F)
      const outT = ramp(s.b - 0.035, s.b, F)
      for (const d of s.d) {
        d.uStagger.value = 0.7
        d.uSweep.value.set(1, 0.15, 0).normalize()
        d.uSweepR.value.set(-16, 16)
        if (inT < 1) ((d.uMode.value = 1), (d.uT.value = inT))
        else if (outT > 0) ((d.uMode.value = 0), (d.uT.value = outT))
        else d.uMode.value = -1
      }
      s.update(F)
    }
  }

  /* ---- transposon: cut-and-paste, then copy-and-paste ---- */
  transposon(): Scene {
    const a = 5.22, b = 5.52
    const [d] = withDissolve(1)
    const g = new THREE.Group()
    const TE = hex('#d62fe0')
    const L = duplex(22, 0, d), T = duplex(12, 22, d, TE, 0.5), M = duplex(16, 34, d), Rr = duplex(22, 50, d)
    const copy = duplex(12, 22, d, TE, 0.5)
    const e1 = blob(0.85, '#18b7a6', d, 3), e2 = blob(0.85, '#18b7a6', d, 7)
    g.add(L, T, M, Rr, copy, e1, e2)
    Object.assign(this.named, { te: T, teCopy: copy, transposase: e1, teL: L, teR: Rr })
    const lT = T.userData.len as number, lL = L.userData.len as number, lM = M.userData.len as number
    const x0 = -(lL + lT + lM + (Rr.userData.len as number)) / 2
    const update = (F: number) => {
      const s = clamp01((F - a) / (b - a))
      // part 1: cut and paste (s 0 → 0.5)
      const bind = smooth(0.04, 0.12, s)
      const lift = smooth(0.12, 0.2, s) * (1 - smooth(0.36, 0.44, s))
      const close = smooth(0.18, 0.28, s) // the donor gap is repaired: M slides left
      const travel = smooth(0.24, 0.38, s)
      const open = smooth(0.3, 0.38, s) // the target site opens
      const release = smooth(0.44, 0.5, s)
      // part 2: copy and paste (s 0.55 → 1): a copy peels off and inserts further right
      const cp = smooth(0.58, 0.66, s)
      const cpTravel = smooth(0.66, 0.84, s)
      const cpOpen = smooth(0.76, 0.84, s)
      const cpIn = smooth(0.84, 0.92, s)
      L.position.set(x0, 0, 0)
      M.position.set(x0 + lL + lT * (1 - close), 0, 0)
      const targetX = x0 + lL + lM + lT * (1 - close) // where R starts before opening
      T.position.set(lerp(x0 + lL, targetX, travel), 3.2 * lift, 0)
      Rr.position.set(targetX + lT * open + lT * cpOpen, 0, 0)
      // the copy: born from the inserted element, carried to a new site inside R
      copy.visible = s > 0.58
      const cx = T.position.x
      const dest = Rr.position.x + 4.4
      copy.position.set(lerp(cx, dest, cpTravel), (-3.2 * cp) * (1 - cpIn), 0)
      copy.scale.setScalar(0.6 + 0.4 * cp)
      // transposase: two enzymes that grip the element's ends
      const ey = 1.4 + (1 - bind) * 8
      const onCopy = s > 0.56
      const host = onCopy ? copy : T
      const hl = lT
      e1.position.set(host.position.x - 0.3, host.position.y + (onCopy ? -1.4 : ey), 0.6)
      e2.position.set(host.position.x + hl + 0.3, host.position.y + (onCopy ? -1.4 : ey), 0.6)
      const gone = onCopy ? smooth(0.9, 0.97, s) : release * (1 - smooth(0.52, 0.58, s))
      e1.position.y += gone * 9
      e2.position.y += gone * 9
      e1.rotation.set(F * 40, F * 30, 0)
      e2.rotation.set(-F * 35, F * 25, 0)
      // the untouched DNA of R holds the copy's landing site closed until it opens
      Rr.children.forEach(() => {})
    }
    return { g, d: [d], a, b, update }
  }

  /* ---- retrotransposon: DNA → RNA → (reverse transcriptase) → new DNA ---- */
  retro(): Scene {
    const a = 5.54, b = 5.82
    const [d] = withDissolve(1)
    const g = new THREE.Group()
    const RT = hex('#7b2cbf')
    const L = duplex(18, 0, d), E = duplex(12, 18, d, RT, 0.5), M = duplex(20, 30, d), Rr = duplex(20, 50, d)
    const r = rna(12, d)
    const nd = duplex(12, 18, d, RT, 0.5)
    const pol = blob(1.0, '#3a86ff', d, 11)
    const rt = blob(1.15, '#ffbe0b', d, 5)
    g.add(L, E, M, Rr, r, nd, pol, rt)
    Object.assign(this.named, { retroEl: E, rna: r, rt, newDna: nd, pol })
    const lL = L.userData.len as number, lE = E.userData.len as number, lM = M.userData.len as number
    const x0 = -(lL + lE + lM + (Rr.userData.len as number)) / 2
    const update = (F: number) => {
      const s = clamp01((F - a) / (b - a))
      L.position.set(x0, 0, 0)
      E.position.set(x0 + lL, 0, 0)
      M.position.set(x0 + lL + lE, 0, 0)
      const site = x0 + lL + lE + lM
      const open = smooth(0.66, 0.76, s)
      Rr.position.set(site + lE * open, 0, 0)
      // 1 · transcription: the polymerase runs along the element, RNA grows above
      const tx = smooth(0.04, 0.24, s)
      pol.position.set(E.position.x + lE * tx, 1.6, 0.4)
      pol.visible = s < 0.3
      pol.position.y += smooth(0.24, 0.3, s) * 8
      r.scale.set(Math.max(0.001, tx), 1, 1)
      // 2 · the RNA drifts to the target; reverse transcriptase takes hold
      const drift = smooth(0.26, 0.44, s)
      r.position.set(lerp(E.position.x, site, drift), lerp(2.2, 3.2, drift), 0)
      const grab = smooth(0.36, 0.46, s)
      rt.position.set(r.position.x + lE * 0.5, lerp(9, 4.4, grab), 0.5)
      rt.rotation.set(F * 20, F * 16, 0)
      // 3 · reverse transcription: new DNA grows beneath the RNA
      const rtx = smooth(0.46, 0.64, s)
      nd.scale.set(Math.max(0.001, rtx), 1, 1)
      nd.position.set(r.position.x, 3.2 - 1.9 * smooth(0.6, 0.66, s), 0)
      // 4 · the RNA is broken down; the new copy drops into the opened site
      const fall = smooth(0.7, 0.84, s)
      nd.position.y = lerp(nd.position.y, 0, fall)
      nd.position.x = lerp(r.position.x, site, fall)
      r.visible = s < 0.72
      r.position.y += smooth(0.64, 0.72, s) * 5
      rt.position.y += smooth(0.66, 0.74, s) * 9
      // the original stays: both copies glow at the end
      const both = smooth(0.86, 0.94, s)
      E.position.y = 0.0 + 0.0 * both
    }
    return { g, d: [d], a, b, update }
  }

  /* ---- hemoglobin: two α-type and two β-type globins, each holding a heme ---- */
  hemoglobin(): Scene {
    const a = 6.44, b = 6.72
    const [d] = withDissolve(1)
    const g = new THREE.Group()
    const subs: THREE.Mesh[] = []
    const pos: [number, number, number][] = [
      [-1.7, 1.6, 1.2],
      [1.7, -1.6, 1.2],
      [1.7, 1.6, -1.2],
      [-1.7, -1.6, -1.2],
    ]
    pos.forEach((p, i) => {
      const m = blob(2.1, i < 2 ? '#8e5bd6' : '#22b8c9', d, 20 + i)
      m.position.set(...p)
      g.add(m)
      subs.push(m)
      this.named['hb' + i] = m
      // the heme: a flat iron-porphyrin disc, half buried in its pocket
      const heme = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 24), glossy(d, { color: lin(hex('#e01e37')), rough: 0.25 }))
      const out = new THREE.Vector3(...p).normalize()
      heme.position.copy(new THREE.Vector3(...p).add(out.multiplyScalar(1.8)))
      heme.lookAt(heme.position.clone().add(out))
      heme.rotateX(Math.PI / 2)
      const fe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), glossy(d, { color: lin(hex('#ff9f1c')), rough: 0.15 }))
      heme.add(fe)
      g.add(heme)
      if (i === 0) this.named.heme = heme
    })
    // stage colours: embryo ζ2ε2 → fetus α2γ2 → adult α2β2
    const cols = {
      zeta: lin(hex('#ff6b6b')),
      eps: lin(hex('#ff9e7a')),
      alpha: lin(hex('#8e5bd6')),
      gamma: lin(hex('#ffd166')),
      beta: lin(hex('#22b8c9')),
    }
    const tmp = new THREE.Color()
    const update = (F: number) => {
      const s = clamp01((F - a) / (b - a))
      g.rotation.set(0.3 + s * 0.6, F * 3.0, 0.1)
      const fetal = smooth(0.62, 0.74, s)
      const adult = smooth(0.8, 0.92, s)
      const embryo = 1 - smooth(0.5, 0.62, s)
      subs.forEach((m, i) => {
        const mat = m.material as THREE.MeshPhysicalMaterial
        if (i < 2) tmp.copy(cols.alpha).lerp(cols.zeta, embryo)
        else tmp.copy(cols.beta).lerp(cols.gamma, fetal * (1 - adult)).lerp(cols.eps, embryo)
        mat.color.copy(tmp)
      })
    }
    return { g, d: [d], a, b, update }
  }

  /* ---- chromosome 2: two ancestral chromosomes fuse end to end ---- */
  fusion(): Scene {
    const a = 7.22, b = 7.48
    const [d] = withDissolve(1)
    const g = new THREE.Group()
    // chimp 12 (shorter) and chimp 13, each as a pair of sister chromatids
    const pair = (len: number, seed: number, pin: number) => {
      const p = new THREE.Group()
      const bands = bandsFor(seed, 8)
      const c1 = chromatid(len, 0.95, bands, d, '#c9b8ff', pin)
      const c2 = chromatid(len, 0.95, bands, d, '#c9b8ff', pin)
      c1.position.x = -0.85
      c2.position.x = 0.85
      p.add(c1, c2)
      p.userData.len = len
      return p
    }
    const A = pair(8.5, 4, 0.8), B = pair(10.5, 9, 0.8)
    // the telomere-like ring and the second, vestigial centromere at the join
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 16, 48), glossy(d, { color: lin(hex('#ffd24a')), rough: 0.2 }))
    ring.rotation.x = Math.PI / 2
    const glowMat = ring.material as THREE.MeshPhysicalMaterial
    glowMat.emissive = new THREE.Color(1.0, 0.7, 0.15)
    const ghost = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.1, 12, 40), glossy(d, { color: lin(hex('#ff5fa2')), rough: 0.3 }))
    ghost.rotation.x = Math.PI / 2
    g.add(A, B, ring, ghost)
    Object.assign(this.named, { chimpA: A, chimpB: B, tel: ring, cen2: ghost })
    const update = (F: number) => {
      const s = clamp01((F - a) / (b - a))
      const join = smooth(0.28, 0.58, s)
      const lA = A.userData.len as number, lB = B.userData.len as number
      // apart and upright → swing end to end → one long chromosome
      const turn = smooth(0.1, 0.3, s)
      A.rotation.z = lerp(0, Math.PI / 2, turn)
      B.rotation.z = lerp(0, Math.PI / 2, turn)
      const gap = lerp(7, 0, join)
      A.position.set(lerp(-4, -(lA / 2 + gap / 2), turn), lerp(0, 0, turn), 0)
      B.position.set(lerp(4, lB / 2 + gap / 2, turn), 0, 0)
      const joinX = (A.position.x + lA / 2 + B.position.x - lB / 2) / 2
      ring.position.set(joinX, 0, 0)
      ring.rotation.set(0, 0, Math.PI / 2)
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(F * 60))
      ring.visible = join > 0.95
      glowMat.emissiveIntensity = 1.5 * smooth(0.58, 0.66, s) * pulse
      ghost.visible = join > 0.95
      ghost.position.set(A.position.x + lA / 2 - lA * 0.2, 0, 0)
      ghost.rotation.set(0, 0, Math.PI / 2)
      g.rotation.y = Math.sin(F * 8) * 0.25
    }
    return { g, d: [d], a, b, update }
  }

  /* ---- unequal crossing over (Figure 18.12) ----
     Two nonsister chromatids pair out of register: the transposable element
     to the RIGHT of the top chromatid's gene lines up with the one to the
     LEFT of the bottom chromatid's gene. A crossover inside that element
     swaps the right-hand ends: the top chromatid leaves with two copies of
     the gene, the bottom with none. */
  unequal(): Scene {
    const a = 7.62, b = 7.94
    const [d] = withDissolve(1)
    const g = new THREE.Group()
    const gene = '#ffb000', te = '#b04ae0', base = '#9fd3ff'
    const L = 9
    const half = (bands: [number, number, string][]) => {
      const m = chromatid(L, 0.75, bands, d, base)
      m.rotation.z = -Math.PI / 2 // along +x, t = 0 at the left end
      return m
    }
    const topL = half([[0.52, 0.74, gene], [0.86, 1.0, te]])
    const topR = half([[0.0, 0.14, te]])
    const botL = half([[0.86, 1.0, te]])
    const botR = half([[0.0, 0.14, te], [0.26, 0.48, gene]])
    const X = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 12, 40), glossy(d, { color: lin(hex('#ff2e63')), rough: 0.2 }))
    ;(X.material as THREE.MeshPhysicalMaterial).emissive = new THREE.Color(1, 0.15, 0.35)
    g.add(topL, topR, botL, botR, X)
    Object.assign(this.named, { topL, topR, botL, botR, cross: X })
    const update = (F: number) => {
      const s = clamp01((F - a) / (b - a))
      const pairUp = smooth(0.06, 0.26, s)
      const cross = smooth(0.32, 0.46, s)
      const swap = smooth(0.48, 0.7, s)
      const part = smooth(0.76, 0.92, s)
      const yTop = lerp(4.8, 1.05, pairUp) + part * 2.8
      const yBot = lerp(-4.8, -1.05, pairUp) - part * 2.8
      topL.position.set(-L / 2, yTop, 0)
      botL.position.set(-L / 2, yBot, 0)
      // the right-hand ends trade places, arcing past each other in depth
      topR.position.set(L / 2, lerp(yTop, yBot, swap), 2.0 * Math.sin(Math.PI * swap))
      botR.position.set(L / 2, lerp(yBot, yTop, swap), -2.0 * Math.sin(Math.PI * swap))
      X.visible = s > 0.3 && s < 0.74
      X.position.set(0, (yTop + yBot) / 2, 0)
      X.rotation.set(0, Math.PI / 2, 0)
      X.scale.setScalar(0.4 + 0.9 * cross)
      ;(X.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 2 * band(0.3, 0.38, 0.66, 0.74, s)
      g.rotation.y = Math.sin(F * 6) * 0.12
    }
    return { g, d: [d], a, b, update }
  }
}
