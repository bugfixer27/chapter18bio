/* ==========================================================================
   DNA, ATOM BY ATOM
   A B-form double helix built from its atoms: 10.5 base pairs per turn,
   3.4 Å rise, 20 Å across. Each nucleotide has a phosphate (P and two
   non-bridging O), a deoxyribose ring, and its base: a purine (two fused
   rings, A and G) paired across the helix with a pyrimidine (one ring, T
   and C). The two glycosidic bonds of a pair sit 132° apart round the axis,
   which is what opens the minor and major grooves.

   Rendered as instanced glossy spheres with ambient occlusion baked from
   each atom's neighbours. The swarm's helix is sampled from the surfaces of
   these very atoms, so the particles can land where each atom will form.
   Units: 1 = 1 nm; the axis runs along x.
   ========================================================================== */
import * as THREE from 'three'
import { BASE, hex, mixc, type RGB } from './forms/base'
import { dissolvable, dissolveUniforms } from './creature'

export type Atom = { p: THREE.Vector3; r: number; c: RGB; el: string; base?: string; ao: number }

const A = 0.1 // one ångström in world units
const RISE = 3.38
const TWIST = (36 * Math.PI) / 180
const COMP: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' }
const EL: Record<string, { r: number; c: RGB }> = {
  P: { r: 1.55, c: hex('#ff8a00') },
  O: { r: 1.25, c: hex('#e22b36') },
  C: { r: 1.35, c: hex('#8d99ab') },
  N: { r: 1.3, c: hex('#2f58ff') },
}

/** a point in the helix's cylindrical frame: radius (Å), angle, rise (Å) → world */
function cyl(r: number, a: number, z: number, x0: number) {
  return new THREE.Vector3(x0 + z * A, Math.cos(a) * r * A, Math.sin(a) * r * A)
}

export function dnaAtoms(seq: string, x0: number) {
  const atoms: Atom[] = []
  const add = (p: THREE.Vector3, el: string, base?: string, tint?: RGB) => {
    const e = EL[el]
    atoms.push({ p, r: e.r * A * 0.78, c: tint ? mixc(e.c, tint, el === 'C' ? 0.9 : 0.55) : e.c, el, base, ao: 1 })
  }
  for (let i = 0; i < seq.length; i++) {
    const th = i * TWIST
    const z = i * RISE
    const b1 = seq[i], b2 = COMP[b1]
    for (const s of [0, 1]) {
      const sg = s ? 1 : -1 // strand 1 sits at −66°, strand 2 at +66°
      const a0 = th + sg * ((66 * Math.PI) / 180)
      const bb = (t: number, r: number, dz = 0) => cyl(r, a0 + t * TWIST * sg * 0.0 + t * TWIST, z + t * RISE + dz, x0)
      // sugar ring round C1′, then the backbone toward the next phosphate
      add(bb(0, 5.9), 'C')
      add(bb(0.06, 6.7, 0.9 * sg), 'O')
      add(bb(0.12, 7.6, 0.4 * sg), 'C')
      add(bb(0.02, 7.2, -0.8 * sg), 'C')
      add(bb(0.1, 8.0, -0.4 * sg), 'C')
      add(bb(0.2, 8.2, 1.2 * sg), 'C')
      add(bb(0.3, 8.7, 0.6 * sg), 'O')
      add(bb(0.45, 9.0, 0.2 * sg), 'P')
      add(bb(0.43, 10.4, 1.0 * sg), 'O')
      add(bb(0.5, 10.1, -1.0 * sg), 'O')
      add(bb(0.62, 8.9, -0.2 * sg), 'O')
    }
    // the base pair in the plane of this rise
    const c1 = cyl(5.9, th - (66 * Math.PI) / 180, z, x0)
    const c2 = cyl(5.9, th + (66 * Math.PI) / 180, z, x0)
    const u = new THREE.Vector3().subVectors(c2, c1)
    const L = u.length()
    u.normalize()
    // in-plane perpendicular, pointing away from the minor groove (toward the major)
    const mid = new THREE.Vector3().addVectors(c1, c2).multiplyScalar(0.5)
    const axisPt = new THREE.Vector3(mid.x, 0, 0)
    const v = new THREE.Vector3().subVectors(axisPt, mid).normalize()
    const ring = (ctr: number, off: number, n: number, rad: number, el: string, base: string, rot = 0) => {
      for (let k = 0; k < n; k++) {
        const a = rot + (k / n) * Math.PI * 2
        const q = new THREE.Vector3()
          .copy(c1)
          .addScaledVector(u, ctr + Math.cos(a) * rad)
          .addScaledVector(v, off + Math.sin(a) * rad)
        // alternate N and C round the rings, as in real bases
        add(q, k % 3 === 0 ? 'N' : el, base, BASE[base as 'A'])
      }
    }
    const purine = (b: string, fromStart: boolean) => {
      const at = (d: number) => (fromStart ? d : L / A - d) * A
      ring(at(2.1), 0.3 * A, 5, 1.2 * A, 'C', b, 0.3)
      ring(at(4.2), 0.9 * A, 6, 1.4 * A, 'C', b)
      // an exocyclic O or N on the Watson–Crick edge
      const q = new THREE.Vector3().copy(c1).addScaledVector(u, at(5.4)).addScaledVector(v, 2.3 * A)
      add(q, b === 'G' ? 'O' : 'N', b, BASE[b as 'A'])
    }
    const pyrimidine = (b: string, fromStart: boolean) => {
      const at = (d: number) => (fromStart ? d : L / A - d) * A
      ring(at(2.6), 0.4 * A, 6, 1.4 * A, 'C', b)
      const q = new THREE.Vector3().copy(c1).addScaledVector(u, at(2.4)).addScaledVector(v, -1.9 * A)
      add(q, 'O', b, BASE[b as 'A'])
    }
    const isPur = (b: string) => b === 'A' || b === 'G'
    if (isPur(b1)) (purine(b1, true), pyrimidine(b2, false))
    else (pyrimidine(b1, true), purine(b2, false))
  }
  // ambient occlusion from crowding: atoms buried among neighbours darken
  const R = 0.55
  const cell = new Map<string, number[]>()
  const key = (p: THREE.Vector3) => `${Math.floor(p.x / R)},${Math.floor(p.y / R)},${Math.floor(p.z / R)}`
  atoms.forEach((a, i) => {
    const k = key(a.p)
    if (!cell.has(k)) cell.set(k, [])
    cell.get(k)!.push(i)
  })
  for (const a of atoms) {
    let n = 0
    const cx = Math.floor(a.p.x / R), cy = Math.floor(a.p.y / R), cz = Math.floor(a.p.z / R)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const l = cell.get(`${cx + dx},${cy + dy},${cz + dz}`)
          if (l) for (const j of l) if (atoms[j] !== a && atoms[j].p.distanceTo(a.p) < R) n++
        }
    // outward-facing atoms (far from the axis) stay bright
    const out = Math.hypot(a.p.y, a.p.z) / 1.05
    a.ao = Math.max(0.35, Math.min(1, 1.25 - n * 0.045)) * (0.7 + 0.3 * Math.min(1, out))
  }
  return atoms
}

/** the instanced mesh, with the same dissolve/crystallise uniforms as the shark */
export function buildAtoms(atoms: Atom[]) {
  const geo = new THREE.IcosahedronGeometry(1, 3)
  const d = dissolveUniforms()
  const mat = dissolvable(
    new THREE.MeshPhysicalMaterial({
      roughness: 0.28,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      iridescence: 0.15,
      iridescenceIOR: 1.4,
    }),
    d,
  )
  const mesh = new THREE.InstancedMesh(geo, mat, atoms.length)
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  atoms.forEach((a, i) => {
    m.makeScale(a.r, a.r, a.r).setPosition(a.p)
    mesh.setMatrixAt(i, m)
    c.setRGB(Math.pow(a.c[0], 2.2) * a.ao, Math.pow(a.c[1], 2.2) * a.ao, Math.pow(a.c[2], 2.2) * a.ao)
    mesh.setColorAt(i, c)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
  const group = new THREE.Group()
  group.add(mesh)
  return { group, mesh, d }
}
