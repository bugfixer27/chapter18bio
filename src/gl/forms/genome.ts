/* Forms about what a genome holds and how it changes: genome size against
   gene number (Table 18.1), alternative splicing, the composition of the
   human genome (Figure 18.6), short tandem repeats, the rRNA gene family and
   the globin families (Figure 18.9), polyploidy, and the human chromosome 16
   blocks found on four mouse chromosomes (Figure 18.11).
   Text and labels are drawn by the DOM from the exported layouts. */
import { FB, BASE, hex, mixc, rng, gauss, finish, finishLinked, share, type RGB } from './base'
import { N } from '../swarm'
import { chromosomeInto, COMP } from './dna'
import { TABLE_18_1, COMPOSITION, SUBSLICES, ALPHA_FAMILY, BETA_FAMILY, HUMAN16_IN_MOUSE, STR_UNIT, type Org, type Gene } from '../../science/genomes'
import { clamp, lerp, ss, jit, rect, disc, ring, stroke, dotted, along, serpentine, sphere, Path, type V3, type Rand } from './charts'

/* ================================================== 7 · genome size (Table 18.1)
   'spheres': each genome as a sphere whose VOLUME is proportional to its size
   in Mb (radius ∝ ∛Mb), smallest to largest along a gentle arc, until the
   canopy plant Paris japonica (149,000 Mb, ~50× human) fills the sky.
   'scatter': the same genomes as points, log10(size) against number of genes:
   size and gene number do not rise together in eukaryotes.
   'density': one megabase of each genome, with a tick for every gene in it:
   bacteria pack ~950 genes per Mb, humans 7. */
type Kind = 'bacteria' | 'archaea' | 'animal' | 'plant' | 'fungus' | 'human' | 'paris'
const KIND_COLOR: Record<Kind, string> = {
  bacteria: '#00b4d8',
  archaea: '#f4a261',
  animal: '#ef476f',
  plant: '#52b788',
  fungus: '#9b5de5',
  human: '#ffc300',
  paris: '#1f6f45',
}
const PLANTS = ['Utricularia gibba', 'Arabidopsis thaliana', 'Zea mays']
export function kindOf(o: Org): Kind {
  if (o.group === 'Bacteria') return 'bacteria'
  if (o.group === 'Archaea') return 'archaea'
  if (o.name === 'Homo sapiens') return 'human'
  if (o.name === 'Paris japonica') return 'paris'
  if (o.name === 'Saccharomyces cerevisiae') return 'fungus'
  if (PLANTS.includes(o.name)) return 'plant'
  return 'animal'
}
export const orgColor = (o: Org) => hex(KIND_COLOR[kindOf(o)])

/** sphere layout, in TABLE_18_1 order; `rank` is the order along the arc (by size) */
export const SPHERES = (() => {
  const SPAN = [-12, 30]
  const byMb = TABLE_18_1.map((o, i) => ({ o, i })).sort((a, b) => a.o.mb - b.o.mb)
  const cb = byMb.map((s) => Math.cbrt(s.o.mb))
  const sum = cb.reduce((a, b) => a + b, 0)
  const gapOf = (k: number, i: number) => 0.3 + 0.12 * k * ((cb[i] + cb[i + 1]) / 2)
  let k = 0.15
  for (let it = 0; it < 6; it++) {
    let gaps = 0
    for (let i = 0; i + 1 < cb.length; i++) gaps += gapOf(k, i)
    k = (SPAN[1] - SPAN[0] - gaps) / (2 * sum)
  }
  const out: { name: string; common: string; kind: Kind; mb: number; genes: number | null; x: number; y: number; z: number; r: number; color: string; rank: number }[] = new Array(TABLE_18_1.length)
  let x = SPAN[0]
  byMb.forEach((s, rank) => {
    const R = k * cb[rank]
    x += R
    const t = (x - SPAN[0]) / (SPAN[1] - SPAN[0])
    const kind = kindOf(s.o)
    out[s.i] = { name: s.o.name, common: s.o.common, kind, mb: s.o.mb, genes: s.o.genes, x, y: -1.2 + 1.6 * Math.sin(Math.PI * t), z: 0, r: R, color: KIND_COLOR[kind], rank }
    x += R + (rank + 1 < cb.length ? gapOf(k, rank) : 0)
  })
  return { k, list: out }
})()

const SC = { x0: -11, x1: 12, y0: -7, y1: 7, logMax: 5.3, genesMax: 35000 }
export const SCATTER_AXES = {
  ...SC,
  logMb: [0, SC.logMax] as [number, number],
  genes: [0, SC.genesMax] as [number, number],
  xTicks: [1, 10, 100, 1e3, 1e4, 1e5],
  yTicks: [0, 5000, 10000, 15000, 20000, 25000, 30000, 35000],
  /** genes = null (not determined) sits on the x-axis */
  toWorld: (mb: number, genes: number | null): [number, number] => [
    SC.x0 + (Math.log10(mb) / SC.logMax) * (SC.x1 - SC.x0),
    SC.y0 + ((genes ?? 0) / SC.genesMax) * (SC.y1 - SC.y0),
  ],
  dotR: 0.35,
}
const DENSE_ROWS = TABLE_18_1.filter((o) => o.perMb !== null)
export const DENSITY = {
  x0: -8.5,
  x1: 11.5,
  tickH: 0.45,
  tickW: 0.05,
  /** one row per organism with a gene count, TABLE_18_1 order, top to bottom */
  rows: DENSE_ROWS.map((o, j) => ({ name: o.name, common: o.common, perMb: o.perMb as number, y: 7 - (j * 14) / (DENSE_ROWS.length - 1), color: KIND_COLOR[kindOf(o)] })),
}

export function sizeForms(seed = 91) {
  const r = rng(seed)
  const fbs = [new FB(), new FB(), new FB()]
  const T = TABLE_18_1
  const MIN = 3500
  const areas = SPHERES.list.map((s) => s.r * s.r)
  const extra = share(areas, N - MIN * T.length)
  const counts = extra.map((e) => e + MIN)
  const grey = hex('#8d99ae')
  const sph = new FB()
  T.forEach((o, i) => {
    const S = SPHERES.list[i]
    const col = hex(S.color)
    const n = counts[i]
    // sphere: front-facing cap (the far side is never seen), true normals
    const minNz = -0.35
    const area = 2 * Math.PI * S.r * S.r * (1 - minNz)
    const size = clamp(Math.sqrt((3.4 * area) / n), 0.035, 0.18)
    sph.n = 0
    sphere(sph, n, S.x, S.y, S.z, S.r, size, () => jit(col, r, 0.1), 1, 0.6, r, minNz, true)
    for (let k = 0; k < n; k++) {
      const j = k * 4
      fbs[0].pos.set(sph.pos.subarray(j, j + 4), fbs[0].n * 4)
      fbs[0].col.set(sph.col.subarray(j, j + 4), fbs[0].n * 4)
      fbs[0].nrm.set(sph.nrm.subarray(j, j + 4), fbs[0].n * 4)
      fbs[0].n++
    }

    // scatter
    const [sx, sy] = SCATTER_AXES.toWorld(o.mb, o.genes)
    if (o.genes !== null) {
      const vis = Math.min(n, 900)
      disc(fbs[1], vis, sx, sy, SCATTER_AXES.dotR, 0.07, col, 1, 0.45, r, 0.02)
      disc(fbs[1], n - vis, sx, sy, SCATTER_AXES.dotR * 0.9, 0.07, col, 0, 0.45, r, 0.02)
    } else {
      // genes not determined: a hollow ring on the axis and a dashed line up
      const nr = 800, nl = 2400
      ring(fbs[1], nr, sx, sy, SCATTER_AXES.dotR, 0.09, 0.06, col, 1, 0.45, r, 0.02)
      const line = new Path([[sx, sy + SCATTER_AXES.dotR + 0.1, 0], [sx, SC.y1, 0]])
      along(fbs[1], nl, line, 0.06, 0.05, col, 0.85, 0.3, r, [0.25, 0.5])
      along(fbs[1], n - nr - nl, line, 0.06, 0.05, col, 0, 0.3, r)
    }

    // density: 1 Mb of this genome, a tick per gene
    const row = DENSITY.rows.find((d) => d.name === o.name)
    if (!row) {
      rect(fbs[2], n, DENSITY.x0, -8.2, DENSITY.x1, -8.1, 0.05, col, 0, 0.3, r)
      return
    }
    const L = DENSITY.x1 - DENSITY.x0
    const Tn = row.perMb
    const ticks: number[] = []
    for (let j = 0; j < Tn; j++) ticks.push(DENSITY.x0 + ((j + 0.5 + (r() - 0.5) * 0.6) / Tn) * L)
    const nb = Math.min(600, Math.floor(n * 0.15))
    const nt = Math.min(n - nb, Tn * 160)
    rect(fbs[2], nb, DENSITY.x0, row.y - 0.02, DENSITY.x1, row.y + 0.02, 0.04, grey, 0.9, 0.2, r)
    for (let k = 0; k < nt; k++) {
      const tx = ticks[Math.floor(r() * Tn)]
      fbs[2].add(tx + (r() - 0.5) * DENSITY.tickW, row.y + r() * DENSITY.tickH, 0.02, Tn > 300 ? 0.06 : 0.05, col, 1, 0, 0, 1, 0.3)
    }
    rect(fbs[2], n - nb - nt, DENSITY.x0, row.y, DENSITY.x1, row.y + DENSITY.tickH, 0.05, col, 0, 0.3, r)
  })
  return finishLinked(fbs, 'x', 0, seed)
}

/* ================================================== 8 · alternative splicing
   One gene, several proteins. The pre-mRNA holds five exons (colours) and
   four introns (grey); splicing can join different subsets of exons, always
   in their original order, into different mature mRNAs, and each is
   translated into a different protein (its domains coloured by the exons that
   encode them). Schematic. */
const EXON_COLORS = ['#ef476f', '#f4a300', '#06a77d', '#118ab2', '#8338ec']
const SP_EW = [1.7, 1.3, 1.5, 1.1, 1.9]
const SP_IW = [2.1, 2.5, 1.9, 2.2]
export const SPLICE = (() => {
  const pre: { x0: number; x1: number; color: string }[] = []
  const introns: [number, number][] = []
  let x = -12
  SP_EW.forEach((w, i) => {
    pre.push({ x0: x, x1: x + w, color: EXON_COLORS[i] })
    x += w
    if (i < SP_IW.length) (introns.push([x, x + SP_IW[i]]), (x += SP_IW[i]))
  })
  const combos = [
    [0, 1, 2, 4],
    [0, 2, 3, 4],
    [0, 1, 3, 4],
  ]
  const ys = [2.4, -1.3, -5.0]
  const mrnas = combos.map((ex, m) => {
    let xx = -11
    const boxes = ex.map((e) => {
      const b = { exon: e, x0: xx, x1: xx + SP_EW[e] }
      xx += SP_EW[e] + 0.04
      return b
    })
    return { y: ys[m], exons: ex, boxes, cap: -11.25, tail: [xx + 0.05, xx + 0.95] as [number, number] }
  })
  return {
    pre: { y: 6.2, h: 0.8, exons: pre, introns },
    mrnaH: 0.8,
    mrnas,
    proteins: mrnas.map((m, i) => ({ x: 9.6, y: m.y, r: 1.4, exons: combos[i] })),
  }
})()

/** a lumpy protein: a sphere pushed out into one lobe (domain) per exon */
function proteinInto(fb: FB, n: number, cx: number, cy: number, R: number, exons: number[], r: Rand) {
  const lobes: V3[] = exons.map((_, i) => {
    const a = (i / exons.length) * Math.PI * 2 + 0.6 * r(), e = (r() - 0.5) * 1.4
    return [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e) * 0.7 + 0.35]
  })
  for (const l of lobes) {
    const q = Math.hypot(l[0], l[1], l[2])
    l[0] /= q, l[1] /= q, l[2] /= q
  }
  const ph = r() * 10
  const rad = (x: number, y: number, z: number) => {
    let s = 0.72
    for (const l of lobes) s += 0.34 * Math.pow(Math.max(0, x * l[0] + y * l[1] + z * l[2]), 3)
    return R * (s + 0.035 * Math.sin(x * 7 + ph) * Math.sin(y * 6 - ph) * Math.sin(z * 5 + 2 * ph))
  }
  const surf = (x: number, y: number, z: number): V3 => {
    const q = Math.hypot(x, y, z)
    const k = rad(x / q, y / q, z / q) / q
    return [x * k, y * k, z * k]
  }
  for (let k = 0; k < n; k++) {
    const dz = lerp(-0.35, 1, r()), t = r() * Math.PI * 2, q = Math.sqrt(1 - dz * dz)
    const dx = q * Math.cos(t), dy = q * Math.sin(t)
    const p = surf(dx, dy, dz)
    // normal by finite differences on the surface
    const ax: V3 = Math.abs(dz) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    const t1: V3 = [dy * ax[2] - dz * ax[1], dz * ax[0] - dx * ax[2], dx * ax[1] - dy * ax[0]]
    const t2: V3 = [dy * t1[2] - dz * t1[1], dz * t1[0] - dx * t1[2], dx * t1[1] - dy * t1[0]]
    const e = 0.02
    const p1 = surf(dx + t1[0] * e, dy + t1[1] * e, dz + t1[2] * e)
    const p2 = surf(dx + t2[0] * e, dy + t2[1] * e, dz + t2[2] * e)
    const u: V3 = [p1[0] - p[0], p1[1] - p[1], p1[2] - p[2]], v: V3 = [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]]
    let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]
    if (nx * dx + ny * dy + nz * dz < 0) (nx = -nx, ny = -ny, nz = -nz)
    // colour: the exon whose lobe this point belongs to
    let best = 0, bd = -2
    lobes.forEach((l, i) => {
      const d = dx * l[0] + dy * l[1] + dz * l[2]
      if (d > bd) ((bd = d), (best = i))
    })
    const c = jit(hex(EXON_COLORS[exons[best]]), r, 0.08)
    fb.add(cx + p[0], cy + p[1], p[2], 0.06, c, 1, nx, ny, nz, 0.6)
  }
}

export function spliceForm(seed = 101) {
  const fb = new FB()
  const r = rng(seed)
  const S = SPLICE
  const intronC = hex('#9aa0a6')
  const ink = hex('#3d4656')
  const [nPre, nM, nArc, nProt, nTrans] = share([0.15, 0.27, 0.1, 0.44, 0.04], N)

  // pre-mRNA: exon boxes and thinner grey introns
  {
    const exA = S.pre.exons.map((e) => (e.x1 - e.x0) * S.pre.h)
    const inA = S.pre.introns.map(([a, b]) => (b - a) * 0.16)
    const w = share([...exA, ...inA], nPre)
    S.pre.exons.forEach((e, i) => rect(fb, w[i], e.x0, S.pre.y - S.pre.h / 2, e.x1, S.pre.y + S.pre.h / 2, 0.06, hex(e.color), 1, 0.3, r, 0, 0.1))
    S.pre.introns.forEach(([a, b], i) => rect(fb, w[exA.length + i], a, S.pre.y - 0.08, b, S.pre.y + 0.08, 0.05, intronC, 1, 0.2, r))
  }
  // mature mRNAs: 5' cap, joined exons, poly-A tail
  const pm = share([1, 1, 1], nM)
  S.mrnas.forEach((m, i) => {
    const [nb, ncap, ntail] = share([0.9, 0.03, 0.07], pm[i])
    const bw = share(m.boxes.map((b) => b.x1 - b.x0), nb)
    m.boxes.forEach((b, j) => rect(fb, bw[j], b.x0, m.y - S.mrnaH / 2, b.x1, m.y + S.mrnaH / 2, 0.06, hex(EXON_COLORS[b.exon]), 1, 0.3, r, 0, 0.1))
    disc(fb, ncap, m.cap, m.y, 0.2, 0.05, ink, 1, 0.3, r)
    rect(fb, ntail, m.tail[0], m.y - 0.05, m.tail[1], m.y + 0.05, 0.045, ink, 0.9, 0.2, r)
  })
  // splice arcs: dotted curves from each exon in the pre-mRNA to where it lands
  {
    const arcs: { p: Path; c: RGB }[] = []
    for (const m of S.mrnas) {
      for (const b of m.boxes) {
        const e = S.pre.exons[b.exon]
        const xa = (e.x0 + e.x1) / 2, ya = S.pre.y - S.pre.h / 2 - 0.08
        const xb = (b.x0 + b.x1) / 2, yb = m.y + S.mrnaH / 2 + 0.08
        const pts: V3[] = []
        for (let i = 0; i <= 80; i++) {
          const t = i / 80, u = 1 - t
          const k = (ya - yb) * 0.45
          const p0 = [xa, ya], p1 = [xa, ya - k], p2 = [xb, yb + k], p3 = [xb, yb]
          const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
          const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
          pts.push([x, y, -0.1])
        }
        arcs.push({ p: new Path(pts), c: hex(EXON_COLORS[b.exon]) })
      }
    }
    const aw = share(arcs.map((a) => a.p.L), nArc)
    arcs.forEach((a, i) => along(fb, aw[i], a.p, 0.06, 0.05, a.c, 0.4, 0.2, r, [0.07, 0.2]))
  }
  // translation: a dotted arrow from each mRNA's tail to its protein
  {
    const pt = share([1, 1, 1], nTrans)
    S.mrnas.forEach((m, i) => {
      const P = S.proteins[i]
      dotted(fb, pt[i], m.tail[1] + 0.3, m.y, P.x - P.r - 0.4, P.y, 0.05, 0.1, 0.25, 0.05, ink, 0.6, 0.2, r)
    })
  }
  // three different proteins
  const pp = share([1, 1, 1], nProt)
  S.proteins.forEach((P, i) => proteinInto(fb, pp[i], P.x, P.y, P.r, P.exons, r))
  return finish(fb, 'x', seed)
}

/* ============================================ 9 · human genome composition
   Figure 18.6. 'ribbon': the genome as one long folded band, every stretch
   coloured by what it is, in the true proportions and in realistic order:
   genes (a regulatory region, then exons as rare glints between introns,
   some introns carrying an Alu) scattered among transposable-element
   sequences (L1, Alu and others), unique noncoding DNA and non-TE repeats.
   'pie': the same particles as a donut chart. 'pie-te': the transposable-
   element slice pulled out (L1 17%, Alu 10%, others 17%) and the repeat slice
   split (simple sequence DNA 3%, large-segment duplications 5–6%). */
type Leaf = { id: string; parent: string; pct: number; color: string }
const OTHER_TE = 'te-other', OTHER_REP = 'rep-other'
const LEAVES: Leaf[] = (() => {
  const out: Leaf[] = []
  for (const s of COMPOSITION) {
    const subs = SUBSLICES.filter((u) => u.parent === s.id)
    if (!subs.length) {
      out.push({ id: s.id, parent: s.id, pct: s.pct, color: s.color })
      continue
    }
    let rest = s.pct
    for (const u of subs) (out.push({ id: u.id, parent: s.id, pct: u.pct, color: u.color }), (rest -= u.pct))
    out.push({ id: s.id === 'te' ? OTHER_TE : OTHER_REP, parent: s.id, pct: rest, color: s.color })
  }
  return out
})()

/* angles are radians clockwise from 12 o'clock; each slice spans exactly its
   percentage of 360°. The figures sum to 99.5% (the book's rounding): the
   remaining 0.5% is shared out as the gaps between slices. */
const PIE_R0 = 3.2, PIE_R1 = 7.5
export const PIE = (() => {
  const TAU = Math.PI * 2
  const total = COMPOSITION.reduce((s, c) => s + c.pct, 0)
  const gap = (TAU * (1 - total / 100)) / COMPOSITION.length
  const slices: Record<string, { a0: number; a1: number; mid: number; pct: number; color: string }> = {}
  const subs: Record<string, { a0: number; a1: number; mid: number; pct: number; color: string; parent: string }> = {}
  let a = gap / 2
  for (const c of COMPOSITION) {
    const a1 = a + (c.pct / 100) * TAU
    slices[c.id] = { a0: a, a1, mid: (a + a1) / 2, pct: c.pct, color: c.color }
    let b = a
    for (const l of LEAVES.filter((l) => l.parent === c.id && l.id !== c.id)) {
      const b1 = b + (l.pct / 100) * TAU
      subs[l.id] = { a0: b, a1: b1, mid: (b + b1) / 2, pct: l.pct, color: l.color, parent: c.id }
      b = b1
    }
    a = a1 + gap
  }
  return {
    cx: 0,
    cy: 0,
    r0: PIE_R0,
    r1: PIE_R1,
    thick: 0.3,
    slices,
    subs,
    /** how far each slice is pulled out along its mid-angle, per form */
    pull: { pie: { exon: 0.7 } as Record<string, number>, pieTe: { exon: 0.7, te: 0.9, rep: 0.45 } as Record<string, number> },
    /** world position of (angle, radius), pushed out by `pull` along `pullAngle` */
    toWorld: (angle: number, radius: number, pull = 0, pullAngle = angle): [number, number] => [
      Math.sin(angle) * radius + Math.sin(pullAngle) * pull,
      Math.cos(angle) * radius + Math.cos(pullAngle) * pull,
    ],
  }
})()

export const RIBBON = { rows: [6.4, 3.2, 0, -3.2, -6.4], x0: -11.3, x1: 11.3, width: 1.0 }

export function compositionForms(seed = 111) {
  const r = rng(seed)
  const fbs = [new FB(), new FB(), new FB()]
  const counts = share(LEAVES.map((l) => l.pct), N)
  const leafIdx = new Map(LEAVES.map((l, i) => [l.id, i]))

  // ---- the ribbon's order: genes among intergenic chunks
  type Chunk = { leaf: number; w: number }
  const pieces = (id: string, n: number, lo: number, hi: number) => Array.from({ length: n }, () => ({ leaf: leafIdx.get(id) as number, w: lo + (hi - lo) * r() }))
  const GENES = 12, EX = 5
  const exons = pieces('exon', GENES * EX, 0.6, 1.4)
  const introns = pieces('intron', GENES * (EX - 1), 0.3, 1.7)
  const regs = pieces('reg', GENES * 2, 0.5, 1.5)
  const alus = pieces('alu', 90, 0.6, 1.4)
  const pool: Chunk[] = [
    ...pieces('unique', 30, 0.4, 1.6),
    ...pieces('simple', 30, 0.5, 1.5),
    ...pieces('lsd', 5, 0.7, 1.3),
    ...pieces(OTHER_REP, 15, 0.5, 1.5),
    ...pieces('l1', 40, 0.4, 1.6),
    ...pieces(OTHER_TE, 40, 0.4, 1.6),
    ...regs.slice(GENES),
  ]
  // normalise weights so each leaf's chunks total exactly its share of length
  const all = [...exons, ...introns, ...regs, ...alus, ...pool.filter((c) => !regs.includes(c))]
  const wsum = new Map<number, number>()
  for (const c of all) wsum.set(c.leaf, (wsum.get(c.leaf) ?? 0) + c.w)
  const totalPct = LEAVES.reduce((s, l) => s + l.pct, 0)
  for (const c of all) c.w = (c.w / (wsum.get(c.leaf) as number)) * (LEAVES[c.leaf].pct / totalPct)
  // build genes; about a third of introns carry an Alu in the middle
  let aluLeft = alus.slice()
  const genes: Chunk[][] = []
  for (let g = 0; g < GENES; g++) {
    const gene: Chunk[] = [regs[g]]
    for (let e = 0; e < EX; e++) {
      gene.push(exons[g * EX + e])
      if (e < EX - 1) {
        const it = introns[g * (EX - 1) + e]
        if (r() < 0.35 && aluLeft.length) {
          const half = { leaf: it.leaf, w: it.w / 2 }
          it.w /= 2
          gene.push(it, aluLeft.pop() as Chunk, half)
        } else gene.push(it)
      }
    }
    genes.push(gene)
  }
  pool.push(...aluLeft)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const seq: Chunk[] = []
  const every = pool.length / (GENES + 1)
  let gi = 0
  pool.forEach((c, i) => {
    if (gi < GENES && i >= Math.round(every * (gi + 0.6))) seq.push(...genes[gi++])
    seq.push(c)
  })
  while (gi < GENES) seq.push(...genes[gi++])
  const band = serpentine(RIBBON.rows, RIBBON.x0, RIBBON.x1, (s) => 0.3 * Math.sin(s * 0.17))
  const L = band.L
  // chunk ranges along the band, grouped by leaf
  const ranges: [number, number][][] = LEAVES.map(() => [])
  let s0 = 0
  for (const c of seq) {
    ranges[c.leaf].push([s0 * L, (s0 + c.w) * L])
    s0 += c.w
  }

  // ---- pie geometry
  const inset = 0.07
  const sampleSlice = (a0: number, a1: number, cutA: boolean, cutB: boolean, rr: Rand) => {
    for (let g = 0; g < 200; g++) {
      const a = lerp(a0, a1, rr()), q = Math.sqrt(lerp(PIE_R0 * PIE_R0, PIE_R1 * PIE_R1, rr()))
      if (cutA && (a - a0) * q < inset) continue
      if (cutB && (a1 - a) * q < inset) continue
      return [a, q]
    }
    return [(a0 + a1) / 2, (PIE_R0 + PIE_R1) / 2]
  }
  LEAVES.forEach((leaf, li) => {
    const n = counts[li]
    const P = PIE.slices[leaf.parent]
    const sub = PIE.subs[leaf.id]
    const isSub = !!sub
    const exon = leaf.id === 'exon'
    const main = hex(P.color)
    const own = hex(leaf.color)
    // ribbon
    const rg = ranges[li]
    const rw = share(rg.map(([a, b]) => b - a), n)
    rg.forEach(([a, b], j) => {
      for (let k = 0; k < rw[j]; k++) {
        const q = band.at(lerp(a, b, r()))
        const tl = Math.hypot(q.tx, q.ty) || 1
        const u = (r() - 0.5) * RIBBON.width
        fbs[0].add(q.x - (q.ty / tl) * u, q.y + (q.tx / tl) * u, q.z + (exon ? 0.04 : 0), exon ? 0.08 : 0.07, jit(main, r, 0.08), 1, 0, 0, 1, exon ? 0.95 : 0.3)
      }
    })
    // pie: the leaf occupies its angular share of the parent slice, no inner gaps
    const pullPie = PIE.pull.pie[leaf.parent] ?? 0
    const pullTe = PIE.pull.pieTe[leaf.parent] ?? 0
    const a0 = isSub ? sub.a0 : P.a0, a1 = isSub ? sub.a1 : P.a1
    const firstSub = !isSub || Math.abs(a0 - P.a0) < 1e-9
    const lastSub = !isSub || Math.abs(a1 - P.a1) < 1e-9
    const focus = leaf.parent === 'te' || leaf.parent === 'rep'
    for (let k = 0; k < n; k++) {
      const z = (r() - 0.5) * PIE.thick
      const [a, q] = sampleSlice(a0, a1, firstSub, lastSub, r)
      const [x, y] = PIE.toWorld(a, q, pullPie, P.mid)
      fbs[1].add(x, y, z + (exon ? 0.1 : 0), exon ? 0.08 : 0.075, jit(main, r, 0.08), 1, 0, 0, 1, exon ? 0.95 : 0.3)
      // pie-te: sub-bands separated, the TE and repeat slices pulled, the rest dimmed
      const [b, qq] = sampleSlice(a0, a1, true, true, r)
      const [x2, y2] = PIE.toWorld(b, qq, pullTe, P.mid)
      fbs[2].add(x2, y2, z + (focus ? 0.15 : 0), 0.075, jit(focus ? own : main, r, 0.08), focus ? 1 : 0.35, 0, 0, 1, 0.3)
    }
  })
  return finishLinked(fbs, 'x', 0, seed)
}

/* ============================================ 10 · short tandem repeats
   Simple sequence DNA: a short unit repeated in tandem, here the 5-nt unit
   GTTAC eight times (the book's example; STR units are 2–5 nt). The number
   of repeats at such loci varies between people, so a set of STR loci makes
   a genetic profile. Below, a schematic gel: five people, three loci, two
   alleles each; more repeats = a longer fragment = a band that runs less far. */
const STR_SEQ_UNIT = 'GTTAC'
const STR_N = 8
const STR_LEFT = 'TTAGCATGAC', STR_RIGHT = 'CATTGGACTA'
const STR_SEQ = STR_LEFT + STR_SEQ_UNIT.repeat(STR_N) + STR_RIGHT
const STR_BW = 24 / STR_SEQ.length
export const STR = (() => {
  const lanes = [-8, -4, 0, 4, 8]
  const loci = [
    { name: 'locus 1 (GTTAC)', color: '#ff006e', top: -0.9, bot: -3.1, min: 5, max: 14 },
    { name: 'locus 2', color: '#3a86ff', top: -3.6, bot: -5.6, min: 6, max: 15 },
    { name: 'locus 3', color: '#fb5607', top: -6.1, bot: -7.9, min: 7, max: 16 },
  ]
  const r = rng(1234)
  const bands: { lane: number; locus: number; count: number; x: number; y: number; homo: boolean }[] = []
  lanes.forEach((x, li) => {
    loci.forEach((lo, k) => {
      let a = lo.min + Math.floor(r() * (lo.max - lo.min + 1))
      const b = lo.min + Math.floor(r() * (lo.max - lo.min + 1))
      if (li === 0 && k === 0) a = STR_N // the person whose DNA is shown above
      const yOf = (c: number) => lerp(lo.bot, lo.top, (c - lo.min) / (lo.max - lo.min))
      if (a === b) bands.push({ lane: li, locus: k, count: a, x, y: yOf(a), homo: true })
      else (bands.push({ lane: li, locus: k, count: a, x, y: yOf(a), homo: false }), bands.push({ lane: li, locus: k, count: b, x, y: yOf(b), homo: false }))
    })
  })
  const x0 = -12
  return {
    unitNt: STR_SEQ_UNIT.length,
    unitRange: STR_UNIT,
    ladder: { y: 3.6, x0, x1: 12, bw: STR_BW, seq: STR_SEQ, rail: 0.55 },
    repeat: { unit: STR_SEQ_UNIT, n: STR_N, x0: x0 + STR_LEFT.length * STR_BW, x1: x0 + (STR_LEFT.length + STR_N * STR_SEQ_UNIT.length) * STR_BW },
    lanes,
    laneW: 2.4,
    laneTop: 0.2,
    laneBottom: -8.3,
    loci,
    bands,
    bandW: 2.0,
  }
})()

export function strForm(seed = 121) {
  const fb = new FB()
  const r = rng(seed)
  const back = hex('#8a9bb5')
  const tintA = hex('#fb8500'), tintB = hex('#6a4cff')
  const { ladder: Ld, repeat: Rp } = STR
  const [nLad, nWash, nLane, nWell, nBand] = share([0.44, 0.04, 0.08, 0.02, 0.42], N)
  const per = Math.floor(nLad / STR_SEQ.length)
  for (let i = 0; i < STR_SEQ.length; i++) {
    const b = STR_SEQ[i] as 'A' | 'T' | 'C' | 'G'
    const x0 = Ld.x0 + i * Ld.bw
    const rep = i - STR_LEFT.length
    const inRep = rep >= 0 && rep < STR_N * STR_SEQ_UNIT.length
    const tint = inRep ? (Math.floor(rep / STR_SEQ_UNIT.length) % 2 ? tintB : tintA) : back
    for (let k = 0; k < per; k++) {
      const t = r()
      if (t < 0.55) {
        // rung: top half is this base, bottom half its partner
        const y = (r() - 0.5) * 2 * (Ld.rail - 0.06)
        const c = y > 0 ? BASE[b] : BASE[COMP[b]]
        fb.add(x0 + Ld.bw * (0.22 + 0.56 * r()), Ld.y + y, (r() - 0.5) * 0.1, 0.07, c, 1, 0, 0, 1, 0.35)
      } else {
        const top = t < 0.775
        fb.add(x0 + r() * Ld.bw, Ld.y + (top ? Ld.rail : -Ld.rail) + (r() - 0.5) * 0.14, (r() - 0.5) * 0.12, 0.07, tint, 1, 0, 0, 1, 0.4)
      }
    }
  }
  // a wash behind each repeat unit, alternating tints
  const uw = share(new Array(STR_N).fill(1), nWash)
  for (let u = 0; u < STR_N; u++) {
    const x0 = Rp.x0 + u * STR_SEQ_UNIT.length * Ld.bw
    rect(fb, uw[u], x0 + 0.03, Ld.y - Ld.rail - 0.25, x0 + STR_SEQ_UNIT.length * Ld.bw - 0.03, Ld.y + Ld.rail + 0.25, 0.12, u % 2 ? tintB : tintA, 0.14, 0.2, r, -0.2)
  }
  // gel: lanes, wells, glowing bands
  const lw = share(STR.lanes.map(() => 1), nLane)
  const ww = share(STR.lanes.map(() => 1), nWell)
  STR.lanes.forEach((x, i) => {
    rect(fb, lw[i], x - STR.laneW / 2, STR.laneBottom, x + STR.laneW / 2, STR.laneTop, 0.09, hex('#6c7a8c'), 0.1, 0.2, r, -0.1)
    rect(fb, ww[i], x - STR.bandW / 2, STR.laneTop - 0.08, x + STR.bandW / 2, STR.laneTop + 0.12, 0.05, hex('#2f3a4a'), 1, 0.2, r)
  })
  const bw = share(STR.bands.map((b) => (b.homo ? 1.6 : 1)), nBand)
  STR.bands.forEach((b, i) => {
    const c = hex(STR.loci[b.locus].color)
    const h = b.homo ? 0.2 : 0.14
    const core = Math.floor(bw[i] * 0.85)
    rect(fb, core, b.x - STR.bandW / 2, b.y - h / 2, b.x + STR.bandW / 2, b.y + h / 2, 0.06, c, 1, 0.95, r, 0.05)
    rect(fb, bw[i] - core, b.x - STR.bandW / 2 - 0.1, b.y - h / 2 - 0.12, b.x + STR.bandW / 2 + 0.1, b.y + h / 2 + 0.12, 0.14, c, 0.1, 0.95, r, 0.04)
  })
  return finish(fb, 'x', seed)
}

/* ==================================== 11 · the rRNA gene family (Fig 18.9a)
   Hundreds of identical rRNA genes lie in tandem, each transcription unit
   separated from the next by nontranscribed spacer DNA. Each unit is being
   transcribed by many RNA polymerases at once: the transcripts grow longer
   along the unit, so each unit looks like a feathery Christmas tree, as in the
   famous electron micrograph. Each unit's transcript holds 18S, 5.8S and 28S
   rRNA (with transcribed spacers between). Segment lengths are schematic (5.8S
   enlarged so it can be seen). */
const RR_SEG = [
  { id: 'ets5', frac: 0.12, color: '#9aa5b1', rna: false },
  { id: '18S', frac: 0.26, color: '#2a9d8f', rna: true },
  { id: 'its1', frac: 0.06, color: '#9aa5b1', rna: false },
  { id: '5.8S', frac: 0.05, color: '#f4a300', rna: true },
  { id: 'its2', frac: 0.06, color: '#9aa5b1', rna: false },
  { id: '28S', frac: 0.4, color: '#e76f51', rna: true },
  { id: 'ets3', frac: 0.05, color: '#9aa5b1', rna: false },
]
export const RRNA = (() => {
  const U = 5, Lu = 3.3, sp = 1.2
  const total = U * Lu + (U - 1) * sp
  const x0 = -total / 2
  const segs = (a: number, b: number) => {
    const out: Record<string, [number, number]> = {}
    let x = a
    for (const s of RR_SEG) (out[s.id] = [x, x + s.frac * (b - a)]), (x += s.frac * (b - a))
    return out
  }
  const units = Array.from({ length: U }, (_, i) => {
    const a = x0 + i * (Lu + sp)
    return { x0: a, x1: a + Lu, seg: segs(a, a + Lu) }
  })
  const spacers = units.slice(0, -1).map((u, i) => [u.x1, units[i + 1].x0] as [number, number])
  return {
    axisY: 1.0,
    axis: [x0 - 0.9, x0 + total + 0.9] as [number, number],
    maxLen: 4.0,
    units,
    spacers,
    /** one unit enlarged below, with spacer stubs either side */
    key: { y: -6.5, h: 0.55, x0: -8, x1: 8, seg: segs(-8, 8), stubs: [[-10.5, -8], [8, 10.5]] as [number, number][] },
  }
})()

export function rrnaForm(seed = 131) {
  const fb = new FB()
  const r = rng(seed)
  const dna = hex('#34405a')
  const rna = hex('#ff6b35')
  const pol = hex('#1d3557')
  const [nAxis, nSeg, nTr, nPol, nKey] = share([0.07, 0.07, 0.72, 0.03, 0.11], N)
  const Y = RRNA.axisY
  // the DNA axis
  stroke(fb, nAxis, RRNA.axis[0], Y, RRNA.axis[1], Y, 0.1, 0.05, dna, 1, 0.3, r)
  // within each unit, the axis shows its segments
  const segW = share(RRNA.units.map(() => 1), nSeg)
  RRNA.units.forEach((u, i) => {
    const ids = RR_SEG.map((s) => s.id)
    const w = share(ids.map((id) => u.seg[id][1] - u.seg[id][0]), segW[i])
    ids.forEach((id, j) => rect(fb, w[j], u.seg[id][0], Y - 0.13, u.seg[id][1], Y + 0.13, 0.05, hex(RR_SEG[j].color), 1, 0.3, r, 0.05))
  })
  // transcripts: short at the start of each unit, longest at its end
  const TPU = 46
  type Tr = { x: number; len: number; dir: V3; ph: number }
  const trs: Tr[] = []
  for (const u of RRNA.units) {
    for (let j = 0; j < TPU; j++) {
      const f = (j + 0.5) / TPU
      const x = lerp(u.x0 + 0.08, u.x1 - 0.08, f) + (r() - 0.5) * 0.02
      const up = j % 2 === 0
      const psi = (up ? 0 : Math.PI) + (r() - 0.5) * 1.0
      trs.push({ x, len: 0.2 + f * (RRNA.maxLen - 0.2) * (0.92 + 0.08 * r()), dir: [0, Math.cos(psi), Math.sin(psi)], ph: r() * 6.28 })
    }
  }
  const tw = share(trs.map((t) => t.len + 0.1), nTr)
  trs.forEach((t, i) => {
    const knob = Math.floor(tw[i] * 0.12)
    for (let k = 0; k < tw[i]; k++) {
      const atTip = k < knob
      const s = atTip ? t.len : r() * t.len
      const wig = 0.07 * Math.sin(s * 5 + t.ph)
      const jx = atTip ? gauss(r) * 0.05 : (r() - 0.5) * 0.04
      const jy = atTip ? gauss(r) * 0.05 : 0
      const c = mixc(rna, hex('#c1121f'), s / RRNA.maxLen * 0.5)
      fb.add(t.x + wig + jx, Y + t.dir[1] * s + jy, t.dir[2] * s + jy, atTip ? 0.07 : 0.055, c, 1, 0, t.dir[1], Math.max(0.3, t.dir[2]), 0.45)
    }
  })
  // polymerases: small beads on the axis where each transcript starts
  const pw = share(trs.map(() => 1), nPol)
  trs.forEach((t, i) => sphere(fb, pw[i], t.x, Y, 0, 0.09, 0.05, pol, 1, 0.7, r, -0.3))
  // the key: one unit enlarged
  {
    const K = RRNA.key
    const ids = RR_SEG.map((s) => s.id)
    const [nk, ns] = share([0.9, 0.1], nKey)
    const w = share(ids.map((id) => K.seg[id][1] - K.seg[id][0]), nk)
    ids.forEach((id, j) => rect(fb, w[j], K.seg[id][0], K.y - K.h / 2, K.seg[id][1], K.y + K.h / 2, 0.06, hex(RR_SEG[j].color), 1, 0.3, r, 0.1))
    const sw = share([1, 1], ns)
    K.stubs.forEach(([a, b], j) => stroke(fb, sw[j], a, K.y, b, K.y, 0.1, 0.05, dna, 1, 0.3, r))
  }
  return finish(fb, 'x', seed)
}

/* ================================== 12 · the globin gene families (Fig 18.9b)
   The α-globin family sits on human chromosome 16 (at the tip of 16p), the
   β-globin family on chromosome 11 (on 11p). Each family is a cluster of
   genes, expressed at different stages of development (embryo / fetus /
   adult), and of pseudogenes (ψ): similar sequences that no longer make a
   protein (hollow grey boxes). Gene spacing in the maps is schematic. The
   chromosomes' banding is the film's generic metaphase chromosome, scaled to
   the two chromosomes' relative sizes; loci are placed approximately. */
const STAGE_COLOR: Record<string, string> = { embryo: '#ff6b6b', fetus: '#ffd166', adult: '#06d6a0', 'fetus+adult': '#06d6a0' }
export const GLOBIN_MAPS = (() => {
  const chr16 = { x: -10, y: 2.3, s: 0.45, locusLocal: 8.3 }
  const chr11 = { x: -5.6, y: -2.2, s: 0.66, locusLocal: 7.85 }
  const map = (fam: Gene[], y: number) => {
    const x0 = 0, x1 = 12.5, w = 1.0, h = 0.9
    const pitch = (x1 - x0 - 1.2) / (fam.length - 1)
    const genes: Record<string, { x: number; y: number; w: number; h: number; label: string; pseudo: boolean; stage?: string }> = {}
    fam.forEach((g, i) => (genes[g.id] = { x: x0 + 0.6 + i * pitch, y, w, h, label: g.label, pseudo: !!g.pseudo, stage: g.stage }))
    return { y, x0, x1, genes, order: fam.map((g) => g.id) }
  }
  const locus = (c: typeof chr16): [number, number] => [c.x, c.y + c.locusLocal * c.s]
  return {
    alpha: { chromosome: 16, ...map(ALPHA_FAMILY, 3.5), chr: chr16, locus: locus(chr16) },
    beta: { chromosome: 11, ...map(BETA_FAMILY, -3.5), chr: chr11, locus: locus(chr11) },
  }
})()

export function globinChromsForm(seed = 141) {
  const fb = new FB()
  const r = rng(seed)
  const gold = hex('#ffc300')
  const dnaC = hex('#5c677d')
  const pseudoC = hex('#8d99ae')
  const [n16, n11, nMapA, nMapB, nWedge, nGlow] = share([0.18, 0.27, 0.24, 0.22, 0.06, 0.03], N)
  const chrom = (n: number, c: { x: number; y: number; s: number; locusLocal: number }, hue: RGB, dark: RGB) => {
    const from = fb.n
    chromosomeInto(fb, n, r, { x: c.x, y: c.y, s: c.s, hue, dark, size: 0.2 })
    // the globin locus glows
    for (let i = from; i < fb.n; i++) {
      const ly = (fb.pos[i * 4 + 1] - c.y) / c.s
      if (Math.abs(ly - c.locusLocal) < 0.28) {
        fb.col[i * 4] = gold[0] * 255
        fb.col[i * 4 + 1] = gold[1] * 255
        fb.col[i * 4 + 2] = gold[2] * 255
        fb.col[i * 4 + 3] = 255
        fb.nrm[i * 4 + 3] = 0.95 * 255
      }
    }
  }
  chrom(n16, GLOBIN_MAPS.alpha.chr, hex('#8e9be0'), hex('#34409a'))
  chrom(n11, GLOBIN_MAPS.beta.chr, hex('#b39ddb'), hex('#5e35b1'))
  // halo band at each locus
  const gw = share([1, 1], nGlow)
  ;[GLOBIN_MAPS.alpha, GLOBIN_MAPS.beta].forEach((M, i) => {
    const [lx, ly] = M.locus
    const hw = 1.9 * M.chr.s
    rect(fb, gw[i], lx - hw, ly - 0.14, lx + hw, ly + 0.14, 0.12, gold, 0.12, 0.95, r, 0.4)
  })
  // gene maps
  const drawMap = (M: typeof GLOBIN_MAPS.alpha, n: number) => {
    const ids = M.order
    const [nLine, nGenes] = share([0.08, 0.92], n)
    stroke(fb, nLine, M.x0 - 0.2, M.y, M.x1 + 0.2, M.y, 0.07, 0.045, dnaC, 1, 0.2, r)
    // pseudogene outlines carry fewer particles than solid boxes
    const gw2 = share(ids.map((id) => (M.genes[id].pseudo ? 0.35 : 1)), nGenes)
    ids.forEach((id, i) => {
      const g = M.genes[id]
      const x0 = g.x - g.w / 2, x1 = g.x + g.w / 2, y0 = g.y - g.h / 2, y1 = g.y + g.h / 2
      if (!g.pseudo) {
        rect(fb, gw2[i], x0, y0, x1, y1, 0.06, jit(hex(STAGE_COLOR[g.stage as string]), r, 0.04), 1, 0.35, r, 0.05, 0.1)
        return
      }
      const t = 0.07
      const per = gw2[i]
      const P = 2 * (g.w + g.h)
      for (let k = 0; k < per; k++) {
        let s = r() * P
        let x: number, y: number
        if (s < g.w) ((x = x0 + s), (y = y0))
        else if ((s -= g.w) < g.h) ((x = x1), (y = y0 + s))
        else if ((s -= g.h) < g.w) ((x = x1 - s), (y = y1))
        else ((s -= g.w), (x = x0), (y = y1 - s))
        fb.add(x + (r() - 0.5) * t, y + (r() - 0.5) * t, 0.05, 0.045, pseudoC, 1, 0, 0, 1, 0.2)
      }
    })
  }
  drawMap(GLOBIN_MAPS.alpha, nMapA)
  drawMap(GLOBIN_MAPS.beta, nMapB)
  // zoom wedges: from the locus to both ends of its map
  const ww = share([1, 1, 1, 1], nWedge)
  ;[GLOBIN_MAPS.alpha, GLOBIN_MAPS.beta].forEach((M, i) => {
    const [lx, ly] = M.locus
    const sx = lx + 1.9 * M.chr.s
    const top = M.y + 0.6
    dotted(fb, ww[i * 2], sx, ly, M.x0 - 0.2, top, 0.035, 0.1, 0.24, 0.045, dnaC, 0.45, 0.2, r)
    dotted(fb, ww[i * 2 + 1], sx, ly, M.x1 + 0.2, top, 0.035, 0.1, 0.24, 0.045, dnaC, 0.45, 0.2, r)
  })
  return finish(fb, 'x', seed)
}

/* ================================= 13 · the developmental switch in globins
   SCHEMATIC, qualitative shapes only (no data): as a human develops, different
   members of each globin family are expressed. y = share of that family's
   chains (α-like: ζ then α; β-like: ε, then fetal γ, then adult β; δ, a minor
   adult chain, is omitted). Embryonic ζ and ε are made first and fall; fetal
   γ rises in the fetus and falls after birth as adult β takes over; α rises
   early and stays high (drawn as a line). */
const SW_BOX = { x0: -11, x1: 12, y0: -6, y1: 6 }
const SW_STAGES = { embryo: [0, 0.18] as [number, number], fetus: [0.18, 0.6] as [number, number], adult: [0.6, 1] as [number, number] }
const swX = (t: number) => lerp(SW_BOX.x0, SW_BOX.x1, t)
const swY = (p: number) => lerp(SW_BOX.y0, SW_BOX.y1, p / 100)
const SW_CURVES = (() => {
  const zeta = (t: number) => 100 * (1 - ss(0.05, 0.22, t))
  const alpha = (t: number) => 100 - zeta(t)
  const eps = (t: number) => 100 * (1 - ss(0.03, 0.2, t))
  const b = (t: number) => 0.05 + 0.93 * ss(0.42, 0.8, t)
  const beta = (t: number) => (100 - eps(t)) * b(t)
  const gamma = (t: number) => (100 - eps(t)) * (1 - b(t))
  return [
    { id: 'zeta', label: 'ζ', f: zeta, color: '#ff6b6b', fill: true },
    { id: 'eps', label: 'ε', f: eps, color: '#d62839', fill: true },
    { id: 'gamma', label: 'γ', f: gamma, color: '#f4a300', fill: true },
    { id: 'beta', label: 'β', f: beta, color: '#06a77d', fill: true },
    { id: 'alpha', label: 'α', f: alpha, color: '#1b6fa8', fill: false },
  ]
})()
export const SWITCH_AXES = {
  ...SW_BOX,
  t: [0, 1] as [number, number],
  pct: [0, 100] as [number, number],
  /** fraction of the x-axis for each stage; birth at t = 0.6 */
  stages: SW_STAGES,
  birthX: swX(SW_STAGES.adult[0]),
  embryoFetusX: swX(SW_STAGES.fetus[0]),
  toWorld: (t: number, pct: number): [number, number] => [swX(t), swY(pct)],
  note: 'schematic: % of each family’s chains (α-like, β-like); shapes are qualitative',
}
/** where each curve peaks (world units), for labels */
export const SWITCH_PEAKS = (() => {
  const out: Record<string, [number, number]> = {}
  for (const c of SW_CURVES) {
    let bt = 0, bv = -1
    for (let i = 0; i <= 400; i++) {
      const t = i / 400, v = c.f(t)
      if (v > bv + 1e-6) ((bv = v), (bt = t))
    }
    out[c.id] = [swX(bt), swY(bv)]
  }
  return out
})()

export function switchForm(seed = 151) {
  const fb = new FB()
  const r = rng(seed)
  const fills = SW_CURVES.filter((c) => c.fill)
  const area = fills.map((c) => {
    let s = 0
    for (let i = 0; i < 200; i++) s += c.f((i + 0.5) / 200)
    return s / 200
  })
  const [nLines, nFill, nStage] = share([0.4, 0.55, 0.05], N)
  const lw = share(SW_CURVES.map((c) => (c.fill ? 1 : 1.4)), nLines)
  SW_CURVES.forEach((c, i) => {
    const pts: V3[] = []
    for (let j = 0; j <= 500; j++) {
      const t = j / 500
      pts.push([swX(t), swY(c.f(t)), c.fill ? 0.02 : 0.06])
    }
    along(fb, lw[i], new Path(pts), c.fill ? 0.1 : 0.14, 0.06, hex(c.color), 1, c.fill ? 0.3 : 0.5, r)
  })
  const fw = share(area, nFill)
  fills.forEach((c, i) => {
    const col = hex(c.color)
    for (let k = 0, g = 0; k < fw[i] && g < fw[i] * 30; g++) {
      const t = r(), p = r() * 100
      if (p > c.f(t)) continue
      fb.add(swX(t), swY(p), 0, 0.08, jit(col, r, 0.08), 0.28, 0, 0, 1, 0.2)
      k++
    }
  })
  // faint dotted lines at the embryo|fetus boundary and at birth
  const sw = share([1, 1], nStage)
  ;[SWITCH_AXES.embryoFetusX, SWITCH_AXES.birthX].forEach((x, i) => dotted(fb, sw[i], x, SW_BOX.y0, x, SW_BOX.y1, 0.04, 0.12, 0.3, 0.05, hex('#6f7c91'), 0.55, 0.2, r))
  return finish(fb, 'x', seed)
}

/* ============================================================ 14 · polyploidy
   Errors in meiosis or mitosis can leave a cell with extra sets of
   chromosomes. 'karyo2': a diploid set, three homologous pairs (a pair = one
   colour, same length and banding). 'karyo4': a tetraploid set, four of each:
   the new copies split off from the originals (each keeps half its
   particles). Schematic chromosomes. */
const KARYO_PAIRS = [
  { id: 'A', s: 0.44, hue: '#ff6b8f', dark: '#a4133c', spacing: 2.4 },
  { id: 'B', s: 0.34, hue: '#4cc9f0', dark: '#1d4e89', spacing: 1.9 },
  { id: 'C', s: 0.25, hue: '#74c69d', dark: '#1b4332', spacing: 1.45 },
]
export const KARYO = (() => {
  const halfW = (s: number) => 2.3 * s
  const cenY = 1
  const groups: number[][] = []
  const widths = KARYO_PAIRS.map((p) => 3 * p.spacing + 2 * halfW(p.s))
  const gap = 1.4
  let x = -(widths.reduce((a, b) => a + b, 0) + gap * (KARYO_PAIRS.length - 1)) / 2
  KARYO_PAIRS.forEach((p, i) => {
    const first = x + halfW(p.s)
    groups.push([0, 1, 2, 3].map((j) => first + j * p.spacing))
    x += widths[i] + gap
  })
  return {
    centromereY: cenY,
    pairs: KARYO_PAIRS.map((p) => ({ id: p.id, s: p.s, color: p.hue, top: cenY + (8.6 - 3) * p.s, bottom: cenY - (3 + 9) * p.s })),
    /** diploid: the middle two slots of each group */
    diploid: KARYO_PAIRS.flatMap((p, i) => [1, 2].map((j) => ({ pair: p.id, x: groups[i][j], y: cenY }))),
    /** tetraploid: all four slots */
    tetraploid: KARYO_PAIRS.flatMap((p, i) => [0, 1, 2, 3].map((j) => ({ pair: p.id, x: groups[i][j], y: cenY }))),
    groups,
  }
})()

export function karyoForms(seed = 161) {
  const r = rng(seed)
  const fbs = [new FB(), new FB()]
  const tmp = new FB()
  const per = share(new Array(KARYO_PAIRS.length * 2).fill(0).map((_, i) => KARYO_PAIRS[i >> 1].s), N)
  KARYO_PAIRS.forEach((p, pi) => {
    for (let h = 0; h < 2; h++) {
      const n = per[pi * 2 + h]
      tmp.n = 0
      chromosomeInto(tmp, n, r, { x: 0, y: 0, s: p.s, hue: hex(p.hue), dark: hex(p.dark), size: 0.2 })
      const y0 = KARYO.centromereY - 3 * p.s
      const home = KARYO.groups[pi][1 + h]
      const copy = KARYO.groups[pi][h === 0 ? 0 : 3]
      for (let k = 0; k < n; k++) {
        const j = k * 4
        const x = tmp.pos[j], y = tmp.pos[j + 1], z = tmp.pos[j + 2], s = tmp.pos[j + 3]
        const c: RGB = [tmp.col[j] / 255, tmp.col[j + 1] / 255, tmp.col[j + 2] / 255]
        const a = tmp.col[j + 3] / 255
        fbs[0].add(home + x, y0 + y, z, s, c, a, 0, 0, 1, 0.3)
        // every other pair of particles (both chromatids) leaves for the new copy
        const moves = ((k >> 1) & 1) === 1
        fbs[1].add((moves ? copy : home) + x, y0 + y, z, s * 1.3, c, a, 0, 0, 1, 0.3)
      }
    }
  })
  return finishLinked(fbs, 'x', 0, seed)
}

/* ============================================ 15 · synteny (Figure 18.11)
   Human chromosome 16 is made of large blocks whose genes lie together, in
   the same order, on mouse chromosomes 7, 8, 16 and 17: since the two
   lineages split, chromosomes were broken and rejoined, but the blocks
   survived. 'synteny-mouse': the four mouse chromosomes, each with its block
   coloured. 'synteny-human': the coloured blocks fly together into human 16.
   Block order along human 16 (from 16p) follows the human–mouse synteny map
   (17, 16, 7 on 16p; 8 on 16q); chromosome and block lengths are schematic. */
const SYN_COLORS: Record<number, string> = { 7: '#ef476f', 8: '#f4a300', 16: '#00a884', 17: '#118ab2' }
export const SYNTENY = (() => {
  const human = { x: 0, y0: -7.6, y1: 6.2, w: 1.3, cen: 0 }
  const L = human.y1 - human.y0
  const fracs: [number, number][] = [
    [17, 0.14],
    [16, 0.19],
    [7, 0.15],
    [8, 0.52],
  ]
  let y = human.y1
  const hBlocks = fracs.map(([chr, f]) => {
    const b = { mouseChr: chr, y1: y, y0: y - f * L, color: SYN_COLORS[chr] }
    y -= f * L
    return b
  })
  human.cen = hBlocks[2].y0
  const mouseLen: Record<number, number> = { 7: 7.2, 8: 6.6, 16: 5.0, 17: 4.9 }
  const blockAt: Record<number, number> = { 7: 0.5, 8: 0.25, 16: 0.35, 17: 0.55 }
  const xs = [-9, -3, 3, 9]
  const mouse = HUMAN16_IN_MOUSE.map((chr, i) => {
    const top = 8.2, len = mouseLen[chr]
    const hb = hBlocks.find((b) => b.mouseChr === chr) as (typeof hBlocks)[number]
    const bl = (hb.y1 - hb.y0) * 0.55
    const b1 = top - 0.5 - blockAt[chr] * (len - 0.5 - bl)
    return { chr, x: xs[i], y0: top - len, y1: top, w: 0.9, cen: top - 0.25, block: [b1 - bl, b1] as [number, number], color: SYN_COLORS[chr] }
  })
  return { human: { ...human, blocks: hBlocks }, mouse }
})()

/** a point inside a chromosome bar (rounded ends, optional centromere pinch), with a cylinder normal */
function barPoint(cx: number, y0: number, y1: number, w: number, cen: number | null, ya: number, yb: number, r: Rand) {
  const hw0 = w / 2
  for (let g = 0; g < 60; g++) {
    const y = lerp(ya, yb, r())
    const dEnd = Math.min(y - y0, y1 - y)
    let hw = dEnd < hw0 ? hw0 * Math.sqrt(Math.max(0, 1 - Math.pow((hw0 - dEnd) / hw0, 2))) : hw0
    if (cen !== null) hw *= 1 - 0.42 * Math.exp(-Math.pow((y - cen) / 0.22, 2))
    const u = r() * 2 - 1
    if (Math.abs(u) * hw0 > hw) continue
    const uu = clamp((u * hw0) / hw, -1, 1)
    return { x: cx + u * hw0, y, nx: uu * 0.8, nz: Math.sqrt(Math.max(0.05, 1 - 0.64 * uu * uu)), edge: Math.abs(u * hw0) / Math.max(1e-3, hw) }
  }
  return { x: cx, y: (ya + yb) / 2, nx: 0, nz: 1, edge: 0 }
}

export function syntenyForms(seed = 171) {
  const r = rng(seed)
  const fbs = [new FB(), new FB()]
  const S = SYNTENY
  const grey = hex('#a3acb9')
  const [nCol, nGrey] = share([0.47, 0.53], N)
  const cw = share(S.human.blocks.map((b) => b.y1 - b.y0), nCol)
  S.human.blocks.forEach((hb, i) => {
    const m = S.mouse.find((mm) => mm.chr === hb.mouseChr) as (typeof S.mouse)[number]
    const c = hex(hb.color)
    for (let k = 0; k < cw[i]; k++) {
      const p = barPoint(m.x, m.y0, m.y1, m.w, m.cen, m.block[0], m.block[1], r)
      const q = barPoint(S.human.x, S.human.y0, S.human.y1, S.human.w, S.human.cen, hb.y0, hb.y1, r)
      const cc = jit(c, r, 0.08)
      fbs[0].add(p.x, p.y, 0, 0.06, cc, 1, p.nx, 0, p.nz, 0.4)
      fbs[1].add(q.x, q.y, 0, 0.065, cc, 1, q.nx, 0, q.nz, 0.4)
    }
  })
  // grey remainder of each mouse chromosome; in the human form it stays behind
  // as a faint ghost outline (interior fades out)
  const greyLen = S.mouse.map((m) => m.y1 - m.y0 - (m.block[1] - m.block[0]))
  const gw = share(greyLen, nGrey)
  S.mouse.forEach((m, i) => {
    const lenAbove = m.y1 - m.block[1]
    for (let k = 0; k < gw[i]; k++) {
      const t = r() * greyLen[i]
      const [ya, yb] = t < lenAbove ? [m.block[1], m.y1] : [m.y0, m.block[0]]
      const p = barPoint(m.x, m.y0, m.y1, m.w, m.cen, ya, yb, r)
      const cc = jit(grey, r, 0.06)
      fbs[0].add(p.x, p.y, 0, 0.06, cc, 1, p.nx, 0, p.nz, 0.3)
      fbs[1].add(p.x, p.y, 0, 0.06, cc, p.edge > 0.8 ? 0.2 : 0, p.nx, 0, p.nz, 0.3)
    }
  })
  return finishLinked(fbs, 'x', 0, seed)
}
