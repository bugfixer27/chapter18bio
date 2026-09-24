/* Forms made of DNA: the double helix, a metaphase chromosome, and the four
   linked stages of whole-genome shotgun sequencing (Figure 18.2). */
import { FB, BASE, hex, mixc, rng, gauss, finish, finishLinked, share, type RGB } from './base'
import { N } from '../swarm'
import { dnaAtoms } from '../atoms'

export const COMP: Record<string, 'A' | 'T' | 'C' | 'G'> = { A: 'T', T: 'A', C: 'G', G: 'C' }

/* The stretch of genome the whole of 18.1 is about. Its middle is the
   consensus in Figure 18.2, so the three fragments the book prints are real
   pieces of it: CGCCATCAGT · AGTCCGCTATACGA · ACGATACTGGT. */
export const CONSENSUS = 'CGCCATCAGTCCGCTATACGATACTGGT'
export const SEQ = 'TTAGCATGACCTGAATGGCA' + CONSENSUS + 'AGCTTCGGATCAATGCCTAGGTCA'
export const CON0 = 20 // where the consensus starts in SEQ
export const SPECIAL = [
  { a: CON0 + 0, b: CON0 + 10, text: 'CGCCATCAGT' },
  { a: CON0 + 7, b: CON0 + 21, text: 'AGTCCGCTATACGA' },
  { a: CON0 + 17, b: CON0 + 28, text: 'ACGATACTGGT' },
]

const BACK: RGB = hex('#8a9bb5')

/* ------------------------------------------------------------------ helix */
export const HELIX = { R: 1.0, rise: 0.34, bpTurn: 10.5, x0: -15, x1: 15, groove: 2.6 }
export function helixSeq() {
  const n = Math.floor((HELIX.x1 - HELIX.x0) / HELIX.rise)
  let s = ''
  for (let i = 0; i < n; i++) s += SEQ[(i + 6) % SEQ.length]
  return s
}

/** one strand's backbone position at base index i (fractional ok) */
export function strandAt(i: number, strand: 0 | 1, R = HELIX.R) {
  const x = HELIX.x0 + i * HELIX.rise
  const a = (i / HELIX.bpTurn) * Math.PI * 2 + (strand ? HELIX.groove : 0)
  return [x, Math.cos(a) * R, Math.sin(a) * R] as const
}

export function helixForm(seed = 3) {
  // sampled from the surfaces of the atomic model, weighted by each atom's area
  const atoms = dnaAtoms(helixSeq(), HELIX.x0)
  const fb = new FB()
  const r = rng(seed)
  const cum: number[] = []
  let tot = 0
  for (const a of atoms) cum.push((tot += a.r * a.r))
  for (let k = 0; k < N; k++) {
    const pick = r() * tot
    let lo = 0, hi = cum.length - 1
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (cum[m] < pick) lo = m + 1
      else hi = m
    }
    const a = atoms[lo]
    const z = r() * 2 - 1, t = r() * Math.PI * 2, q = Math.sqrt(1 - z * z)
    const nx = q * Math.cos(t), ny = q * Math.sin(t), nz = z
    const c = mixc([0, 0, 0], a.c, 0.35 + 0.65 * a.ao)
    fb.add(a.p.x + nx * a.r, a.p.y + ny * a.r, a.p.z + nz * a.r, 0.045, c, 1, nx, ny, nz, 0.85)
  }
  return finish(fb, 'x', seed)
}

/* ----------------------------------------------------------- chromosome
   A metaphase chromosome: two sister chromatids of coiled chromatin joined at
   the centromere, stained into light and dark bands. */
export const CHROMO = { cy: 3.0, top: 8.6, bot: -9.0 }
const DARK_BANDS: [number, number][] = [
  [7.2, 7.8], [5.2, 6.0], [3.8, 4.3], [1.2, 1.9], [-0.6, -1.5], [-2.6, -3.2], [-4.4, -5.4], [-6.3, -6.8], [-7.6, -8.2],
]
export function bandAt(y: number) {
  for (const [a, b] of DARK_BANDS) if (y <= a && y >= b) return 1
  return 0
}
export function chromosomeForm(seed = 5, opts: { x?: number; s?: number; hue?: RGB; dark?: RGB } = {}) {
  const fb = new FB()
  const r = rng(seed)
  chromosomeInto(fb, N, r, opts)
  return finish(fb, 'y', seed)
}
export function chromosomeInto(fb: FB, count: number, r: () => number, opts: { x?: number; y?: number; s?: number; hue?: RGB; dark?: RGB; size?: number } = {}) {
  const X = opts.x ?? 0, Y = opts.y ?? 0, S = opts.s ?? 1
  const light = opts.hue ?? hex('#b8a2ff')
  const dark = opts.dark ?? hex('#4a2fb0')
  const cen = hex('#ff5fa2')
  const tel = hex('#ffd24a')
  const { cy, top, bot } = CHROMO
  for (let k = 0; k < count; k++) {
    const side = k & 1 ? 1 : -1
    // arm: 0.32 short arm (p), 0.68 long arm (q)
    const onP = r() < 0.34
    const t = r()
    const y = onP ? cy + t * (top - cy) : cy - t * (cy - bot)
    const u = onP ? t : t
    // chromatids bow apart away from the centromere
    const spread = 0.28 + 1.05 * Math.pow(u, 0.7)
    const cxl = side * spread - (onP ? 0 : 0.15 * u)
    const pinch = 1 - 0.55 * Math.exp(-Math.pow((y - cy) / 0.5, 2))
    const cap = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, u - 0.9) / 0.1, 2)))
    const rad = 1.02 * pinch * (0.35 + 0.65 * cap)
    // chromatin: coils around the chromatid axis
    const coil = y * 5.5 + side
    const cr = rad * (0.55 + 0.4 * r())
    const a = coil + gauss(r) * 0.9
    const x = cxl + Math.cos(a) * cr
    const z = Math.sin(a) * cr
    let c = bandAt(y) ? dark : light
    if (Math.abs(y - cy) < 0.45) c = mixc(c, cen, 0.8)
    if (u > 0.93) c = mixc(c, tel, 0.7)
    const lit = 0.72 + 0.28 * Math.cos(a - 2.2)
    fb.add(X + x * S, Y + y * S, z * S, (opts.size ?? 0.09) * S, mixc([0, 0, 0], c, lit), 0.9)
  }
}

/* ------------------------------------------------------- shotgun (Fig 18.2)
   Five copies of one stretch → cut at random → cloned and scattered →
   sequenced in rows → ordered by overlaps into one sequence. The same
   particle is the same base of the same fragment in all four forms. */
export type Frag = { copy: number; a: number; b: number; special: number }
export const SG = { x0: -12.5, x1: 12.5, bw: 25 / SEQ.length, copyY: [6.2, 4.2, 2.2, 0.2, -1.8], conY: -7.2 }

export function shotgunLayout(seed = 11) {
  const r = rng(seed)
  const L = SEQ.length
  const frags: Frag[] = []
  for (let c = 0; c < 5; c++) {
    const sp = c < 3 ? SPECIAL[c] : null
    let a = 0
    const cuts: number[] = [0]
    if (sp) {
      // lay random cuts up to the special fragment, keep it whole, continue after
      while (a + 7 < sp.a) {
        a += 6 + Math.floor(r() * 9)
        if (a >= sp.a - 3) break
        cuts.push(a)
      }
      if (cuts[cuts.length - 1] !== sp.a) cuts.push(sp.a)
      cuts.push(sp.b)
      a = sp.b
    }
    while (a < L) {
      a += 6 + Math.floor(r() * 10)
      if (a > L - 4) a = L
      cuts.push(a)
    }
    const uniq = Array.from(new Set(cuts)).sort((p, q) => p - q)
    for (let i = 0; i + 1 < uniq.length; i++) {
      const fa = uniq[i], fbb = uniq[i + 1]
      const special = sp && fa === sp.a && fbb === sp.b ? c : -1
      frags.push({ copy: c, a: fa, b: fbb, special })
    }
  }
  return frags
}

export type FragPlace = { x: number; y: number; z: number; rz: number; ry: number }
export const SHOTGUN = {
  frags: [] as Frag[],
  read: [] as FragPlace[],
  tiled: [] as FragPlace[],
}

export function shotgunForms(seed = 11) {
  const frags = shotgunLayout(seed)
  SHOTGUN.frags = frags
  const r = rng(seed + 1)
  const { x0, bw, copyY, conY } = SG
  // places for each stage
  const copies: FragPlace[] = frags.map((f) => ({ x: x0 + f.a * bw, y: copyY[f.copy], z: 0, rz: 0, ry: 0 }))
  const scatter: FragPlace[] = frags.map(() => ({ x: -11 + 23 * r(), y: -7 + 14 * r(), z: -4 + 8 * r(), rz: (r() - 0.5) * 1.3, ry: (r() - 0.5) * 1.6 }))
  // sequencing: flowed into reading lanes
  const read: FragPlace[] = []
  {
    let x = -12.2, y = 7.0
    const order = frags.map((_, i) => i).sort((p, q) => (frags[q].special >= 0 ? 1 : 0) - (frags[p].special >= 0 ? 1 : 0) || r() - 0.5)
    const tmp: FragPlace[] = new Array(frags.length)
    for (const i of order) {
      const w = (frags[i].b - frags[i].a) * bw
      if (x + w > 12.8) ((x = -12.2), (y -= 1.3))
      tmp[i] = { x, y, z: 0, rz: 0, ry: 0 }
      x += w + 0.55
    }
    read.push(...tmp)
  }
  // assembly: at true coordinates, stacked greedily so none overlap
  const tiled: FragPlace[] = new Array(frags.length)
  {
    const rowsEnd: number[] = []
    const idx = frags.map((_, i) => i).sort((p, q) => frags[p].a - frags[q].a || frags[q].b - frags[p].b)
    for (const i of idx) {
      const f = frags[i]
      let row = rowsEnd.findIndex((e) => e <= f.a - 0.5)
      if (row < 0) ((row = rowsEnd.length), rowsEnd.push(0))
      rowsEnd[row] = f.b
      tiled[i] = { x: x0 + f.a * bw, y: 5.8 - row * 1.0, z: 0, rz: 0, ry: 0 }
    }
  }
  SHOTGUN.read = read
  SHOTGUN.tiled = tiled

  const fbs = [new FB(), new FB(), new FB(), new FB()]
  const totalBases = frags.reduce((s, f) => s + (f.b - f.a), 0) + SEQ.length
  const per = Math.floor(N / totalBases)
  const hi = hex('#ffffff')

  const put = (fbIdx: number, pl: FragPlace, lx: number, ly: number, lz: number, size: number, c: RGB, a: number) => {
    // rotate the local fragment frame (y about z, then about y)
    const cz = Math.cos(pl.rz), sz = Math.sin(pl.rz), cy = Math.cos(pl.ry), sy = Math.sin(pl.ry)
    let x = lx * cz - ly * sz
    const y = lx * sz + ly * cz
    let z = lz
    const x2 = x * cy + z * sy
    z = -x * sy + z * cy
    x = x2
    fbs[fbIdx].add(pl.x + x, pl.y + y, pl.z + z, size, c, a)
  }

  const base = (seqIdx: number, k: number, lx0: number) => {
    // one particle of one base: where, what colour
    const b = SEQ[seqIdx] as 'A' | 'T' | 'C' | 'G'
    const t = r()
    const lx = lx0 + r() * bw * 0.86
    if (t < 0.5) {
      // rung
      const ly = (r() - 0.5) * 0.44
      return { lx, ly, lz: (r() - 0.5) * 0.08, c: ly > 0 ? BASE[b] : BASE[COMP[b]], back: false }
    }
    const top = t < 0.75
    return { lx: lx0 + r() * bw, ly: (top ? 0.26 : -0.26) + (r() - 0.5) * 0.08, lz: (r() - 0.5) * 0.12, c: BACK, back: true }
  }

  for (let fi = 0; fi < frags.length; fi++) {
    const f = frags[fi]
    const sp = f.special >= 0
    for (let s = f.a; s < f.b; s++) {
      for (let k = 0; k < per; k++) {
        const q = base(s, k, (s - f.a) * bw)
        const c = sp && !q.back ? mixc(q.c, hi, 0.05) : q.c
        const size = 0.11
        put(0, copies[fi], q.lx, q.ly, q.lz, size, c, 0.95)
        put(1, scatter[fi], q.lx, q.ly, q.lz, size, c, 0.95)
        // unsequenced fragments quieten once the special ones are being read
        put(2, read[fi], q.lx, q.ly, q.lz, size, sp ? c : mixc(c, [0.75, 0.78, 0.84], 0.35), sp ? 1 : 0.8)
        put(3, tiled[fi], q.lx, q.ly, q.lz, size, sp ? c : mixc(c, [0.75, 0.78, 0.84], 0.2), sp ? 1 : 0.85)
      }
    }
  }
  // the consensus: invisible until the fragments are ordered
  const conPl: FragPlace = { x: x0, y: conY, z: 0, rz: 0, ry: 0 }
  for (let s = 0; s < SEQ.length; s++) {
    for (let k = 0; k < per; k++) {
      const q = base(s, k, s * bw)
      const inCon = s >= CON0 && s < CON0 + CONSENSUS.length
      const c = inCon ? q.c : mixc(q.c, [0.75, 0.78, 0.84], 0.4)
      for (let j = 0; j < 3; j++) put(j, conPl, q.lx, q.ly * 1.2, q.lz, 0.09, c, 0)
      put(3, conPl, q.lx, q.ly * 1.2, q.lz, 0.095, c, 1)
    }
  }
  return finishLinked(fbs, 'x', 3)
}
