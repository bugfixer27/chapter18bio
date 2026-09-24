/* Forms that are charts and diagrams, printed on graph paper or lit in the
   lab: the falling cost of a genome, a rumen's 913 genomes, GenBank, a genome
   browser, a protein-interaction network and ENCODE's transcribed genome.
   Crisp text, axes and tick labels are the DOM's job: every chart exports its
   layout (world units) so the overlay can put labels exactly on the ink. */
import { FB, BASE, hex, mixc, rng, gauss, finish, finishLinked, share, type RGB } from './base'
import { N } from '../swarm'
import { COST, RUMEN, COMPOSITION } from '../../science/genomes'

/* ================================================================ helpers
   Small drawing tools shared with genome.ts. Flat chart ink faces the camera
   (normal 0,0,1); solids get true normals. */
export type V3 = [number, number, number]
export type Rand = () => number
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/** h, s, l all 0..1 → sRGB */
export function hsl(h: number, s: number, l: number): RGB {
  h = ((h % 1) + 1) % 1
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}
/** a printed-ink wobble in brightness */
export const jit = (c: RGB, r: Rand, k = 0.08): RGB => {
  const t = 1 + (r() - 0.5) * k
  return [c[0] * t, c[1] * t, c[2] * t]
}
export const GRID_INK = hex('#6f7c91')

/** fill an axis-aligned box */
export function rect(fb: FB, n: number, x0: number, y0: number, x1: number, y1: number, size: number, c: RGB, a: number, gloss: number, r: Rand, z = 0, dz = 0) {
  for (let k = 0; k < n; k++) fb.add(lerp(x0, x1, r()), lerp(y0, y1, r()), z + (r() - 0.5) * dz, size, c, a, 0, 0, 1, gloss)
}
/** fill a disc (uniform by area) */
export function disc(fb: FB, n: number, cx: number, cy: number, R: number, size: number, c: RGB, a: number, gloss: number, r: Rand, z = 0) {
  for (let k = 0; k < n; k++) {
    const q = R * Math.sqrt(r()), t = r() * Math.PI * 2
    fb.add(cx + Math.cos(t) * q, cy + Math.sin(t) * q, z, size, c, a, 0, 0, 1, gloss)
  }
}
/** an annulus of width w centred on radius R */
export function ring(fb: FB, n: number, cx: number, cy: number, R: number, w: number, size: number, c: RGB, a: number, gloss: number, r: Rand, z = 0) {
  for (let k = 0; k < n; k++) {
    const q = R + (r() - 0.5) * w, t = r() * Math.PI * 2
    fb.add(cx + Math.cos(t) * q, cy + Math.sin(t) * q, z, size, c, a, 0, 0, 1, gloss)
  }
}
/** a straight stroke of width w */
export function stroke(fb: FB, n: number, x0: number, y0: number, x1: number, y1: number, w: number, size: number, c: RGB, a: number, gloss: number, r: Rand, z0 = 0, z1 = z0) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1
  const nx = -dy / L, ny = dx / L
  for (let k = 0; k < n; k++) {
    const t = r(), u = (r() - 0.5) * w
    fb.add(x0 + dx * t + nx * u, y0 + dy * t + ny * u, lerp(z0, z1, t), size, c, a, 0, 0, 1, gloss)
  }
}
/** a dotted straight line: dots of length `on` every `period` */
export function dotted(fb: FB, n: number, x0: number, y0: number, x1: number, y1: number, w: number, on: number, period: number, size: number, c: RGB, a: number, gloss: number, r: Rand, z = 0) {
  const p = new Path([[x0, y0, z], [x1, y1, z]])
  along(fb, n, p, w, size, c, a, gloss, r, [on, period])
}

/** a polyline measured by arc length */
export class Path {
  pts: V3[]
  cum: Float64Array
  L: number
  constructor(pts: V3[]) {
    this.pts = pts
    this.cum = new Float64Array(pts.length)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]
      this.cum[i] = this.cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    }
    this.L = this.cum[pts.length - 1]
  }
  /** point and unit tangent at arc length s */
  at(s: number) {
    s = clamp(s, 0, this.L)
    let lo = 0, hi = this.cum.length - 1
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (this.cum[m] <= s) lo = m
      else hi = m
    }
    const a = this.pts[lo], b = this.pts[hi]
    const seg = this.cum[hi] - this.cum[lo] || 1
    const t = (s - this.cum[lo]) / seg
    return {
      x: a[0] + (b[0] - a[0]) * t,
      y: a[1] + (b[1] - a[1]) * t,
      z: a[2] + (b[2] - a[2]) * t,
      tx: (b[0] - a[0]) / seg,
      ty: (b[1] - a[1]) / seg,
    }
  }
}
/** a band of width w along a path (offset in the picture plane); optional dash [on, period] */
export function along(fb: FB, n: number, p: Path, w: number, size: number, c: RGB, a: number, gloss: number, r: Rand, dash?: [number, number], s0 = 0, s1 = p.L) {
  for (let k = 0; k < n; k++) {
    let s = lerp(s0, s1, r())
    if (dash) for (let g = 0; g < 50 && s % dash[1] > dash[0]; g++) s = lerp(s0, s1, r())
    const q = p.at(s)
    const tl = Math.hypot(q.tx, q.ty) || 1
    const u = (r() - 0.5) * w
    fb.add(q.x - (q.ty / tl) * u, q.y + (q.tx / tl) * u, q.z, size, c, a, 0, 0, 1, gloss)
  }
}
/** a folded band: rows (top to bottom) joined by half-turns at alternate ends */
export function serpentine(rows: number[], xa: number, xb: number, z = (_s: number) => 0) {
  const pts: V3[] = []
  const step = 0.05
  for (let i = 0; i < rows.length; i++) {
    const right = i % 2 === 0
    const [s, e] = right ? [xa, xb] : [xb, xa]
    const m = Math.ceil(Math.abs(e - s) / step)
    for (let j = 0; j <= m; j++) pts.push([lerp(s, e, j / m), rows[i], 0])
    if (i + 1 < rows.length) {
      const R = (rows[i] - rows[i + 1]) / 2, yc = (rows[i] + rows[i + 1]) / 2
      const mm = Math.ceil((Math.PI * R) / step)
      for (let j = 1; j < mm; j++) {
        const th = Math.PI / 2 - (j / mm) * Math.PI
        pts.push([e + (right ? 1 : -1) * R * Math.cos(th), yc + R * Math.sin(th), 0])
      }
    }
  }
  // depth wobble as a function of arc length
  const p = new Path(pts)
  for (let i = 0; i < pts.length; i++) pts[i][2] = z(p.cum[i])
  return new Path(pts)
}
/** sample a sphere surface with true normals; minNz culls the far side.
    even = a jittered Fibonacci lattice (no holes, for big solid spheres) */
export function sphere(fb: FB, n: number, cx: number, cy: number, cz: number, R: number, size: number, c: RGB | ((nx: number, ny: number, nz: number) => RGB), a: number, gloss: number, r: Rand, minNz = -1, even = false) {
  const GA = Math.PI * (3 - Math.sqrt(5))
  for (let k = 0; k < n; k++) {
    const nz = even ? lerp(1, minNz, (k + 0.3 + 0.4 * r()) / n) : lerp(minNz, 1, r())
    const t = even ? k * GA + (r() - 0.5) * 0.3 : r() * Math.PI * 2, q = Math.sqrt(Math.max(0, 1 - nz * nz))
    const nx = q * Math.cos(t), ny = q * Math.sin(t)
    const col = typeof c === 'function' ? c(nx, ny, nz) : c
    fb.add(cx + nx * R, cy + ny * R, cz + nz * R, size, col, a, nx, ny, nz, gloss)
  }
}

/* ========================================================= 1 · cost chart
   The cost of sequencing one human genome, on a log scale: $100 million in
   2003 (the Human Genome Project, 13 years), $1 million in 2007 (4 months),
   $1,000 by 2018 (a day or less). Five orders of magnitude in fifteen years.
   The curve is a monotone interpolation in log space through the book's three
   points only: it starts at 2003 and ends at 2018, and invents nothing. */
const CB = { x0: -11, x1: 12, y0: -6.5, y1: 7 }
const yearX = (yr: number) => CB.x0 + ((yr - 2000) / 20) * (CB.x1 - CB.x0)
const usdY = (usd: number) => CB.y0 + ((Math.log10(usd) - 3) / 5) * (CB.y1 - CB.y0)
export const COST_AXES = {
  ...CB,
  years: [2000, 2020] as [number, number],
  usd: [1e3, 1e8] as [number, number],
  xTicks: [2000, 2005, 2010, 2015, 2020],
  yTicks: [1e3, 1e4, 1e5, 1e6, 1e7, 1e8],
  toWorld: (year: number, usd: number): [number, number] => [yearX(year), usdY(usd)],
  /** the three data points in world units (disc radius dotR) */
  points: COST.map((p) => ({ ...p, xy: [yearX(p.year), usdY(p.usd)] as [number, number] })),
  dotR: 0.45,
}

/** Fritsch–Carlson monotone cubic through (xs, ys) */
export function monotone(xs: number[], ys: number[]) {
  const n = xs.length
  const d: number[] = [], m: number[] = new Array(n)
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  return (x: number) => {
    let i = 0
    while (i < n - 2 && x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i], t = clamp((x - xs[i]) / h, 0, 1)
    const t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}

export function costForm(seed = 31) {
  const fb = new FB()
  const r = rng(seed)
  const teal = hex('#00a6a6')
  const dot = hex('#e0314f')
  const logc = monotone(COST.map((p) => p.year), COST.map((p) => Math.log10(p.usd)))
  const ya = COST[0].year, yb = COST[COST.length - 1].year
  const curveY = (x: number) => {
    const yr = 2000 + ((x - CB.x0) / (CB.x1 - CB.x0)) * 20
    return usdY(Math.pow(10, logc(yr)))
  }
  const [nDots, nHalo, nRibbon, nArea, nGrid, nDrop] = share([0.25, 0.012, 0.358, 0.28, 0.05, 0.05], N)

  // faint gridlines at each decade of dollars
  const per = Math.floor(nGrid / 6)
  for (const v of COST_AXES.yTicks) stroke(fb, per, CB.x0, usdY(v), CB.x1, usdY(v), 0.03, 0.045, GRID_INK, 0.22, 0.2, r)

  // stippled area beneath the curve
  const xa = yearX(ya), xb = yearX(yb)
  for (let k = 0, g = 0; k < nArea && g < nArea * 20; g++) {
    const x = lerp(xa, xb, r()), y = lerp(CB.y0, CB.y1, r())
    if (y > curveY(x)) continue
    // a touch denser towards the curve, as if the ink pooled there
    if (r() > 0.55 + 0.45 * ss(CB.y0, curveY(x), y)) continue
    fb.add(x, y, 0, 0.07, jit(mixc(teal, [1, 1, 1], 0.15), r), 0.25, 0, 0, 1, 0.2)
    k++
  }

  // the ribbon
  const pts: V3[] = []
  for (let i = 0; i <= 600; i++) {
    const x = lerp(xa, xb, i / 600)
    pts.push([x, curveY(x), 0.02])
  }
  along(fb, nRibbon, new Path(pts), 0.14, 0.07, teal, 1, 0.35, r)

  // reading guides: dotted drops from each point to both axes
  const perDrop = Math.floor(nDrop / 6)
  for (const p of COST_AXES.points) {
    const [x, y] = p.xy
    dotted(fb, perDrop, x, y, x, CB.y0, 0.035, 0.12, 0.28, 0.05, GRID_INK, 0.55, 0.2, r)
    dotted(fb, perDrop, x, y, CB.x0, y, 0.035, 0.12, 0.28, 0.05, GRID_INK, 0.55, 0.2, r)
  }

  // the three textbook points: glowing discs, with a crisp rim and a soft halo
  const pd = share([1, 1, 1], nDots), ph = share([1, 1, 1], nHalo)
  COST_AXES.points.forEach((p, i) => {
    const [x, y] = p.xy
    const core = Math.floor(pd[i] * 0.86)
    disc(fb, core, x, y, COST_AXES.dotR - 0.04, 0.075, dot, 1, 0.96, r, 0.05)
    ring(fb, pd[i] - core, x, y, COST_AXES.dotR - 0.02, 0.07, 0.06, mixc(dot, [0, 0, 0], 0.25), 1, 0.3, r, 0.05)
    for (let k = 0; k < ph[i]; k++) {
      const q = COST_AXES.dotR + 0.55 * Math.pow(r(), 1.6), t = r() * Math.PI * 2
      fb.add(x + Math.cos(t) * q, y + Math.sin(t) * q, 0.04, 0.2, dot, 0.05, 0, 0, 1, 0.96)
    }
  })
  return finish(fb, 'x', seed)
}

/* ===================================================== 2 · metagenomics
   One sample of cow rumen, sequenced whole: DNA from a crowd of microbes that
   cannot be grown in the lab. Assembly sorted the fragments into 913 genomes
   (2018). The cloud: every fragment coloured by the genome it belongs to,
   swirling unsorted. Sorted: each genome gathered into its own small cluster
   on a hexagonal grid. Particle i is the same piece of the same genome in both. */
export const META_GRID = {
  count: RUMEN.genomes,
  cols: 36,
  rows: Math.ceil(RUMEN.genomes / 36),
  box: [-12, -7.5, 12, 7.5] as [number, number, number, number],
  dx: 24 / 35.5,
  dy: 15 / (Math.ceil(RUMEN.genomes / 36) - 1),
  r: 0.18,
  /** cluster centre of genome g (row-major from the top-left; odd rows shifted half a cell) */
  centres: [] as [number, number][],
  /** hue (0..1) of genome g; the grid is sorted by hue */
  hues: [] as number[],
}
{
  const { cols, dx, dy, count } = META_GRID
  for (let g = 0; g < count; g++) {
    const row = Math.floor(g / cols), col = g % cols
    const inRow = Math.min(cols, count - row * cols)
    const off = (row % 2 ? dx / 2 : 0) + ((cols - inRow) / 2) * dx
    META_GRID.centres.push([-12 + off + col * dx, 7.5 - row * dy])
    META_GRID.hues.push((g / count) * 0.94)
  }
}
export const metaColor = (g: number): RGB => {
  const h = META_GRID.hues[g]
  // yellows print pale on paper: darken them a little
  const l = 0.5 - 0.13 * Math.exp(-Math.pow((h - 0.16) / 0.07, 2)) + 0.05 * ((g % 3) - 1)
  return hsl(h, 0.82, l)
}

export function metaForms(seed = 41) {
  const r = rng(seed)
  const fbs = [new FB(), new FB()]
  const G = META_GRID.count
  const per = share(new Array(G).fill(1), N)
  for (let g = 0; g < G; g++) {
    const c = metaColor(g)
    const [gx, gy] = META_GRID.centres[g]
    // this genome's reads: a handful of short fragments scattered through the vortex
    const nf = 6
    const fr = share(new Array(nf).fill(1), per[g])
    for (let f = 0; f < nf; f++) {
      const rho = 8.2 * Math.pow(r(), 0.72), th = r() * Math.PI * 2
      const h = 1.1 + 3.4 * (1 - Math.pow(rho / 8.2, 2))
      const cx = Math.cos(th) * rho, cz = Math.sin(th) * rho, cy = clamp(gauss(r) * h * 0.5, -4.5, 4.5)
      // fragments lie roughly along the flow
      let ux = -Math.sin(th) + (r() - 0.5) * 0.9, uy = (r() - 0.5) * 0.7, uz = Math.cos(th) + (r() - 0.5) * 0.9
      const ul = Math.hypot(ux, uy, uz)
      ux /= ul, uy /= ul, uz /= ul
      const len = 0.35 + 0.4 * r()
      for (let k = 0; k < fr[f]; k++) {
        const t = (r() - 0.5) * len
        const strand = (k & 1 ? 1 : -1) * 0.035
        const cc = jit(c, r, 0.1)
        fbs[0].add(cx + ux * t, cy + uy * t + strand, cz + uz * t, 0.06, cc, 0.95, 0, 0, 1, 0.5)
        const q = META_GRID.r * Math.sqrt(r()), a = r() * Math.PI * 2
        fbs[1].add(gx + Math.cos(a) * q, gy + Math.sin(a) * q, 0, 0.055, cc, 1, 0, 0, 1, 0.45)
      }
    }
  }
  return finishLinked(fbs, 'x', 1, seed)
}

/* ========================================================= 3 · GenBank
   The database as a vast archive: record after record, each a header line
   and lines of sequence, receding up and away without end. A BLAST query
   finds its match somewhere in the middle; that one line is lit. */
const DB = { yb: -9, zb: -2, rise: 21, depth: 10 }
const DB_V = Math.hypot(DB.rise, DB.depth)
const dbAt = (v: number) => {
  const t = v / DB_V
  return { y: DB.yb + t * DB.rise, z: DB.zb - t * DB.depth }
}
const DB_LINE = 0.2
const DB_COLS = 7
const DB_HIT_K = Math.round(((0 - DB.yb) / DB.rise) * DB_V / DB_LINE)
const dbHalf = (z: number) => 13.2 * ((32 - z) / 32) + 0.6
const dbCol = (half: number, c: number) => {
  const w = (2 * half) / DB_COLS
  return [-half + c * w + 0.3, -half + (c + 1) * w - 0.3]
}
export const DB_HIT_ROW = (() => {
  const { y, z } = dbAt(DB_HIT_K * DB_LINE)
  const [x0, x1] = dbCol(dbHalf(z), 3)
  return { x0, x1, y, z }
})()

export function databaseForm(seed = 51) {
  const fb = new FB()
  const r = rng(seed)
  const grey: RGB = [0.55, 0.57, 0.6]
  const head = hex('#3d4656')
  const soft = { A: mixc(BASE.A, grey, 0.28), T: mixc(BASE.T, grey, 0.28), C: mixc(BASE.C, grey, 0.28), G: mixc(BASE.G, grey, 0.28) }
  const letters = ['A', 'T', 'C', 'G'] as const
  const nrm: V3 = [0, Math.sin(Math.atan2(DB.depth, DB.rise)), Math.cos(Math.atan2(DB.depth, DB.rise))]
  type Dash = { x0: number; x1: number; v: number; c: RGB; a: number; hit: boolean }
  const dashes: Dash[] = []
  const lines = Math.floor(DB_V / DB_LINE)
  // each column runs its own sequence of records
  const state = Array.from({ length: DB_COLS }, () => ({ left: Math.floor(r() * 5), kind: 'seq' as 'head' | 'seq' | 'gap' }))
  for (let k = 0; k < lines; k++) {
    const v = k * DB_LINE
    const { z } = dbAt(v)
    const half = dbHalf(z)
    const far = 1 - ss(DB_V - 4, DB_V, v)
    for (let c = 0; c < DB_COLS; c++) {
      const st = state[c]
      // advance the record: header, 3–7 sequence lines, a blank line
      if (st.left <= 0) {
        if (st.kind === 'seq') ((st.kind = 'gap'), (st.left = 1))
        else if (st.kind === 'gap') ((st.kind = 'head'), (st.left = 1 + Math.floor(r() * 2)))
        else ((st.kind = 'seq'), (st.left = 3 + Math.floor(r() * 5)))
      }
      st.left--
      const hit = k === DB_HIT_K && c === 3
      const kind = hit ? 'seq' : st.kind
      if (kind === 'gap') continue
      const [cx0, cx1] = dbCol(half, c)
      const end = kind === 'head' ? lerp(cx0, cx1, 0.3 + 0.4 * r()) : st.left === 0 && r() < 0.6 ? lerp(cx0, cx1, 0.2 + 0.7 * r()) : cx1
      let x = cx0
      while (x < end) {
        const L = 0.08 + 0.17 * r()
        const x1 = Math.min(end, x + L)
        const edge = 1 - ss(half - 2.2, half, Math.abs((x + x1) / 2))
        const a = 0.9 * far * edge
        if (a > 0.02) {
          const b = letters[Math.floor(r() * 4)]
          dashes.push({ x0: x, x1, v, c: kind === 'head' ? head : hit ? BASE[b] : soft[b], a: kind === 'head' ? a * 0.8 : a, hit })
        }
        x = x1 + 0.055
      }
    }
  }
  const [nHitWash, nDash] = share([0.012, 0.988], N)
  let tot = 0
  for (const d of dashes) tot += (d.x1 - d.x0) * (d.hit ? 4 : 1)
  const dens = nDash / tot
  let carry = 0
  for (const d of dashes) {
    const want = (d.x1 - d.x0) * (d.hit ? 4 : 1) * dens + carry
    const m = Math.floor(want)
    carry = want - m
    for (let j = 0; j < m; j++) {
      const v = d.v + (r() - 0.5) * 0.075
      const { y, z } = dbAt(v)
      fb.add(lerp(d.x0, d.x1, r()), y, z, d.hit ? 0.055 : 0.045, d.c, d.hit ? 1 : d.a, nrm[0], nrm[1], nrm[2], d.hit ? 0.95 : 0.2)
    }
  }
  // a soft highlighter wash behind the hit
  {
    const { x0, x1 } = DB_HIT_ROW
    for (let j = 0; j < nHitWash; j++) {
      const v = DB_HIT_K * DB_LINE + (r() - 0.5) * 0.2
      const { y, z } = dbAt(v)
      fb.add(lerp(x0 - 0.15, x1 + 0.15, r()), y, z - 0.01, 0.12, hex('#ffc933'), 0.18, nrm[0], nrm[1], nrm[2], 0.2)
    }
  }
  return finish(fb, 'x', seed)
}

/* =================================================== 4 · genome browser
   A window on one stretch of a chromosome, as a genome browser draws it:
   a ruler; a gene model (5 exons on the + strand, the thinner ends are the
   untranslated regions, chevrons show the direction of transcription, green
   = start codon, red = stop codon); RNA-seq coverage, piled up over the
   exons; and conservation with a related species. Most noncoding DNA is not
   conserved, but two peaks upstream of the gene, in noncoding DNA, are:
   conserved enhancers. 'browser-cons' lights them up. Schematic data. */
export const BROWSER = {
  x0: -12.5,
  x1: 12.5,
  ruler: { y: 7.2 },
  gene: { y: 4.6, h: 0.9, utrH: 0.45, strand: '+' as const, x0: -4.6, x1: 11.2 },
  /** exon x ranges; cds = the coding part of each exon */
  exons: [
    { x0: -4.6, x1: -3.2, cds: [-3.9, -3.2] },
    { x0: -0.8, x1: 0.2, cds: [-0.8, 0.2] },
    { x0: 2.6, x1: 3.5, cds: [2.6, 3.5] },
    { x0: 5.6, x1: 6.6, cds: [5.6, 6.6] },
    { x0: 9.0, x1: 11.2, cds: [9.0, 9.9] },
  ] as { x0: number; x1: number; cds: [number, number] }[],
  startCodon: -3.9,
  stopCodon: 9.9,
  rnaseq: { y0: 0.2, h: 2.8 },
  cons: { y0: -6.6, h: 3.8 },
  enhancers: [-10.2, -7.4],
}

export function browserForms(seed = 61) {
  const r = rng(seed)
  const fbs = [new FB(), new FB()]
  const both = (x: number, y: number, z: number, s: number, c: RGB, a: number, g = 0.3) => {
    fbs[0].add(x, y, z, s, c, a, 0, 0, 1, g)
    fbs[1].add(x, y, z, s, c, a, 0, 0, 1, g)
  }
  const B = BROWSER
  const ink = hex('#343a46')
  const exonC = hex('#ff2e63')
  const intronC = hex('#a3123f')
  const [nRuler, nGene, nMark, nRna, nCons, nBand] = share([0.035, 0.2, 0.035, 0.29, 0.38, 0.06], N)

  // ruler: a line with major ticks every 2.5 and minor every 0.5
  {
    const [nl, nt] = share([0.45, 0.55], nRuler)
    for (let k = 0; k < nl; k++) both(lerp(B.x0, B.x1, r()), B.ruler.y + (r() - 0.5) * 0.05, 0, 0.045, ink, 0.9)
    const ticks: [number, number][] = []
    for (let j = 0; j <= Math.round((B.x1 - B.x0) / 0.5); j++) ticks.push([B.x0 + j * 0.5, j % 5 === 0 ? 0.4 : 0.16])
    const tw = share(ticks.map((t) => t[1]), nt)
    ticks.forEach(([x, h], i) => {
      for (let k = 0; k < tw[i]; k++) both(x + (r() - 0.5) * 0.035, B.ruler.y - r() * h, 0, 0.04, ink, 0.9)
    })
  }

  // gene model
  {
    const g = B.gene
    const boxes: [number, number, number][] = []
    for (const e of B.exons) {
      if (e.x0 < e.cds[0]) boxes.push([e.x0, e.cds[0], g.utrH])
      boxes.push([e.cds[0], e.cds[1], g.h])
      if (e.cds[1] < e.x1) boxes.push([e.cds[1], e.x1, g.utrH])
    }
    const introns: [number, number][] = []
    for (let i = 0; i + 1 < B.exons.length; i++) introns.push([B.exons[i].x1, B.exons[i + 1].x0])
    const [nBox, nLine, nChev, nTss] = share([0.72, 0.1, 0.12, 0.06], nGene)
    const bw = share(boxes.map(([a, b, h]) => (b - a) * h), nBox)
    boxes.forEach(([a, b, h], i) => {
      for (let k = 0; k < bw[i]; k++) both(lerp(a, b, r()), g.y + (r() - 0.5) * h, 0.02, 0.06, jit(exonC, r, 0.06), 1, 0.35)
    })
    const lw = share(introns.map(([a, b]) => b - a), nLine)
    introns.forEach(([a, b], i) => {
      for (let k = 0; k < lw[i]; k++) both(lerp(a, b, r()), g.y + (r() - 0.5) * 0.06, 0, 0.045, intronC, 1)
    })
    // chevrons '>' every 0.7 along the introns
    const chev: number[] = []
    for (const [a, b] of introns) for (let x = a + 0.45; x < b - 0.3; x += 0.7) chev.push(x)
    const cw = share(chev.map(() => 1), nChev)
    chev.forEach((x, i) => {
      for (let k = 0; k < cw[i]; k++) {
        const t = r(), up = k & 1 ? 1 : -1
        both(x - 0.14 + t * 0.14 + (r() - 0.5) * 0.02, g.y + up * (1 - t) * 0.17, 0, 0.04, intronC, 1)
      }
    })
    // transcription start: a bent arrow rising from the gene's first base
    const tss = new Path([[g.x0, g.y + g.utrH / 2, 0], [g.x0, g.y + 1.05, 0], [g.x0 + 0.7, g.y + 1.05, 0]])
    const [na, nh] = share([0.75, 0.25], nTss)
    for (let k = 0; k < na; k++) {
      const q = tss.at(r() * tss.L)
      both(q.x + (r() - 0.5) * 0.05, q.y + (r() - 0.5) * 0.05, 0, 0.045, ink, 1)
    }
    for (let k = 0; k < nh; k++) {
      const t = r(), up = k & 1 ? 1 : -1
      both(g.x0 + 0.7 - t * 0.2, g.y + 1.05 + up * t * 0.16, 0, 0.045, ink, 1)
    }
  }

  // start and stop codon markers
  {
    const [ns, ne] = share([1, 1], nMark)
    const put = (n: number, x: number, c: RGB) => {
      const core = Math.floor(n * 0.8)
      for (let k = 0; k < n; k++) {
        const halo = k >= core
        const q = (halo ? 0.2 + 0.18 * r() : 0.2 * Math.sqrt(r())), t = r() * Math.PI * 2
        both(x + Math.cos(t) * q, B.gene.y + 0.9 + Math.sin(t) * q, 0.05, halo ? 0.14 : 0.06, c, halo ? 0.12 : 1, 0.96)
      }
    }
    put(ns, B.startCodon, hex('#12b84a'))
    put(ne, B.stopCodon, hex('#e02020'))
  }

  // histograms: bins of 0.12, filled
  const bin = 0.12
  const nb = Math.round((B.x1 - B.x0) / bin)
  const inExon = (x: number) => B.exons.find((e) => x >= e.x0 && x <= e.x1)
  const noise = (x: number, f: number) => 0.5 + 0.25 * Math.sin(x * f + 1.3) + 0.25 * Math.sin(x * f * 2.7 + 4.1)
  const rnaH: number[] = [], consH: number[] = []
  for (let i = 0; i < nb; i++) {
    const x = B.x0 + (i + 0.5) * bin
    const e = inExon(x)
    let h = 0
    if (e) {
      const edge = ss(e.x0, e.x0 + 0.25, x) * (1 - ss(e.x1 - 0.25, e.x1, x))
      h = (0.55 + 0.4 * noise(x, 3.1)) * (0.35 + 0.65 * edge)
    } else if (x > B.gene.x0 && x < B.gene.x1) h = 0.02 + 0.05 * noise(x, 5.3) * r()
    else h = 0.01 * r()
    rnaH.push(h)
    let c = 0.04 + 0.1 * noise(x, 4.7) * (0.5 + 0.5 * r()) + (r() < 0.04 ? 0.15 * r() : 0)
    if (e) {
      const coding = x >= e.cds[0] && x <= e.cds[1]
      c = Math.max(c, (coding ? 0.82 + 0.15 * r() : 0.5 + 0.15 * r()) * (0.6 + 0.4 * ss(e.x0, e.x0 + 0.2, x) * (1 - ss(e.x1 - 0.2, e.x1, x))))
    }
    for (const ex of B.enhancers) c = Math.max(c, 0.95 * Math.exp(-Math.pow((x - ex) / 0.38, 2)) * (0.9 + 0.1 * r()))
    consH.push(Math.min(1, c))
  }
  const rnaC = hex('#1d6fd8')
  const rw = share(rnaH.map((h) => h + 0.002), nRna)
  rnaH.forEach((h, i) => {
    const x = B.x0 + i * bin
    for (let k = 0; k < rw[i]; k++) both(x + 0.01 + r() * (bin - 0.02), B.rnaseq.y0 + r() * h * B.rnaseq.h, 0, 0.055, rnaC, 0.95, 0.25)
  })
  const grey = hex('#6c757d'), vio = hex('#7b2cbf'), gold = hex('#ffb000')
  const cw = share(consH.map((h) => h + 0.002), nCons)
  consH.forEach((h, i) => {
    const x = B.x0 + (i + 0.5) * bin
    const enh = B.enhancers.some((ex) => Math.abs(x - ex) < 0.75) && h > 0.35
    for (let k = 0; k < cw[i]; k++) {
      const px = x - bin / 2 + 0.01 + r() * (bin - 0.02), py = B.cons.y0 + r() * h * B.cons.h
      fbs[0].add(px, py, 0, 0.055, grey, 0.35, 0, 0, 1, 0.2)
      fbs[1].add(px, py, 0.02, 0.055, enh ? gold : vio, 1, 0, 0, 1, enh ? 0.95 : 0.3)
    }
  })
  // gold columns through every track at the enhancers (invisible in 'browser')
  {
    const per = share([1, 1], nBand)
    B.enhancers.forEach((ex, i) => {
      for (let k = 0; k < per[i]; k++) {
        const px = ex + (r() - 0.5) * 1.1, py = lerp(B.cons.y0 - 0.2, B.ruler.y - 0.3, r())
        fbs[0].add(px, py, -0.05, 0.1, gold, 0, 0, 0, 1, 0.2)
        fbs[1].add(px, py, -0.05, 0.1, gold, 0.1, 0, 0, 1, 0.2)
      }
    })
  }
  return finishLinked(fbs, 'x', 0, seed)
}
/* ============================================ 5 · systems biology network
   Proteins as nodes, physical interactions as edges: about 1,200 proteins in
   10 functional modules (a colour each), ~2,800 interactions, mostly within a
   module, a few bridging modules. A few hubs have many partners. Laid out by
   a short force simulation. Schematic: a model network, not a real dataset. */
export const NETWORK = {
  nodes: 1200,
  edges: 2800,
  /** filled by networkForm(): module centroids (for labels) and colours */
  modules: [] as { x: number; y: number; z: number; color: string; count: number }[],
}
const MOD_COLORS = ['#ef476f', '#f77f00', '#06a77d', '#118ab2', '#8338ec', '#e63946', '#3a86ff', '#d6336c', '#2a9d8f', '#9c6644']

export function networkForm(seed = 71) {
  const fb = new FB()
  const r = rng(seed)
  const M = MOD_COLORS.length, NN = NETWORK.nodes, NE = NETWORK.edges
  const sizes = share(Array.from({ length: M }, () => 0.6 + 0.8 * r()), NN)
  const mod = new Int32Array(NN)
  const first: number[] = []
  const centres: V3[] = []
  for (let m = 0, i = 0; m < M; m++) {
    first.push(i)
    for (let k = 0; k < sizes[m]; k++) mod[i++] = m
    const a = Math.PI / 2 - (m / M) * Math.PI * 2 + 0.3
    centres.push([Math.cos(a) * 8.6, Math.sin(a) * 5.2, m % 2 ? 1.2 : -1.2])
  }
  first.push(NN)
  const pick = (m: number) => first[m] + Math.floor(r() * sizes[m])

  // edges: preferential attachment inside modules (hubs), some bridges
  const ea = new Int32Array(NE), eb = new Int32Array(NE)
  const seen = new Set<number>()
  const ends: number[][] = Array.from({ length: M }, () => [])
  const intra = Math.round(NE * 0.86)
  let ne = 0
  for (let g = 0; ne < NE && g < NE * 50; g++) {
    let a: number, b: number
    if (ne < intra) {
      const m = Math.floor(r() * M)
      const E = ends[m]
      a = E.length && r() < 0.55 ? E[Math.floor(r() * E.length)] : pick(m)
      b = E.length && r() < 0.25 ? E[Math.floor(r() * E.length)] : pick(m)
    } else {
      const m = Math.floor(r() * M)
      const m2 = r() < 0.7 ? (m + (r() < 0.5 ? 1 : M - 1)) % M : Math.floor(r() * M)
      if (m2 === m) continue
      a = ends[m].length ? ends[m][Math.floor(r() * ends[m].length)] : pick(m)
      b = pick(m2)
    }
    if (a === b) continue
    const key = Math.min(a, b) * NN + Math.max(a, b)
    if (seen.has(key)) continue
    seen.add(key)
    ea[ne] = a
    eb[ne] = b
    ne++
    if (mod[a] === mod[b]) ends[mod[a]].push(a, b)
  }
  const deg = new Int32Array(NN)
  for (let e = 0; e < ne; e++) (deg[ea[e]]++, deg[eb[e]]++)

  // force layout on a spatial grid
  const px = new Float32Array(NN), py = new Float32Array(NN), pz = new Float32Array(NN)
  const vx = new Float32Array(NN), vy = new Float32Array(NN), vz = new Float32Array(NN)
  for (let i = 0; i < NN; i++) {
    const c = centres[mod[i]]
    px[i] = c[0] + gauss(r) * 1.6
    py[i] = c[1] + gauss(r) * 1.6
    pz[i] = c[2] + gauss(r) * 0.9
  }
  const H = 0.75, GX = Math.ceil(30 / H), GY = Math.ceil(22 / H), GZ = Math.ceil(10 / H)
  const cells = GX * GY * GZ
  const start = new Int32Array(cells + 1), items = new Int32Array(NN), cid = new Int32Array(NN)
  const cellOf = (i: number) => {
    const ix = clamp(Math.floor((px[i] + 15) / H), 0, GX - 1)
    const iy = clamp(Math.floor((py[i] + 11) / H), 0, GY - 1)
    const iz = clamp(Math.floor((pz[i] + 5) / H), 0, GZ - 1)
    return ix + iy * GX + iz * GX * GY
  }
  const fx = new Float32Array(NN), fy = new Float32Array(NN), fz = new Float32Array(NN)
  for (let it = 0; it < 60; it++) {
    fx.fill(0), fy.fill(0), fz.fill(0)
    start.fill(0)
    for (let i = 0; i < NN; i++) ((cid[i] = cellOf(i)), start[cid[i] + 1]++)
    for (let c = 0; c < cells; c++) start[c + 1] += start[c]
    const fill = start.slice(0, cells)
    for (let i = 0; i < NN; i++) items[fill[cid[i]]++] = i
    // repulsion between near neighbours
    for (let i = 0; i < NN; i++) {
      const c = cid[i]
      const ix = c % GX, iy = Math.floor(c / GX) % GY, iz = Math.floor(c / (GX * GY))
      for (let dz = -1; dz <= 1; dz++) {
        const zz = iz + dz
        if (zz < 0 || zz >= GZ) continue
        for (let dy = -1; dy <= 1; dy++) {
          const yy = iy + dy
          if (yy < 0 || yy >= GY) continue
          for (let dx = -1; dx <= 1; dx++) {
            const xx = ix + dx
            if (xx < 0 || xx >= GX) continue
            const cc = xx + yy * GX + zz * GX * GY
            for (let q = start[cc]; q < start[cc + 1]; q++) {
              const j = items[q]
              if (j <= i) continue
              const ddx = px[i] - px[j], ddy = py[i] - py[j], ddz = pz[i] - pz[j]
              const d2 = ddx * ddx + ddy * ddy + ddz * ddz
              if (d2 > H * H) continue
              const f = 0.014 / (d2 + 0.02)
              fx[i] += ddx * f, fy[i] += ddy * f, fz[i] += ddz * f
              fx[j] -= ddx * f, fy[j] -= ddy * f, fz[j] -= ddz * f
            }
          }
        }
      }
    }
    // springs
    for (let e = 0; e < ne; e++) {
      const a = ea[e], b = eb[e]
      const same = mod[a] === mod[b]
      const ddx = px[b] - px[a], ddy = py[b] - py[a], ddz = pz[b] - pz[a]
      const d = Math.hypot(ddx, ddy, ddz) || 1e-3
      const f = ((same ? 0.03 : 0.004) * (d - (same ? 1.0 : 4))) / d
      fx[a] += ddx * f, fy[a] += ddy * f, fz[a] += ddz * f
      fx[b] -= ddx * f, fy[b] -= ddy * f, fz[b] -= ddz * f
    }
    // each module is held near its place on the ring
    for (let i = 0; i < NN; i++) {
      const c = centres[mod[i]]
      fx[i] += (c[0] - px[i]) * 0.008
      fy[i] += (c[1] - py[i]) * 0.008
      fz[i] += (c[2] - pz[i]) * 0.02
      vx[i] = (vx[i] + fx[i]) * 0.8
      vy[i] = (vy[i] + fy[i]) * 0.8
      vz[i] = (vz[i] + fz[i]) * 0.8
      const v = Math.hypot(vx[i], vy[i], vz[i])
      if (v > 0.25) (vx[i] *= 0.25 / v, vy[i] *= 0.25 / v, vz[i] *= 0.25 / v)
      px[i] = clamp(px[i] + vx[i], -12.6, 12.6)
      py[i] = clamp(py[i] + vy[i], -8.2, 8.2)
      pz[i] = clamp(pz[i] + vz[i], -3, 3)
    }
  }

  NETWORK.modules = centres.map((_, m) => {
    let x = 0, y = 0, z = 0
    for (let i = first[m]; i < first[m + 1]; i++) ((x += px[i]), (y += py[i]), (z += pz[i]))
    const n = sizes[m]
    return { x: x / n, y: y / n, z: z / n, color: MOD_COLORS[m], count: n }
  })
  NETWORK.edges = ne

  const [nEdge, nNode] = share([0.35, 0.65], N)
  // edges: thin, faint lines of particles, split by length
  const len = new Float32Array(ne)
  for (let e = 0; e < ne; e++) len[e] = Math.hypot(px[eb[e]] - px[ea[e]], py[eb[e]] - py[ea[e]], pz[eb[e]] - pz[ea[e]])
  const ew = share(Array.from(len), nEdge)
  const bridge = hex('#7d8797')
  for (let e = 0; e < ne; e++) {
    const a = ea[e], b = eb[e]
    const same = mod[a] === mod[b]
    const c = same ? mixc(hex(MOD_COLORS[mod[a]]), [0.5, 0.52, 0.56], 0.35) : bridge
    for (let k = 0; k < ew[e]; k++) {
      const t = r()
      fb.add(lerp(px[a], px[b], t) + (r() - 0.5) * 0.02, lerp(py[a], py[b], t) + (r() - 0.5) * 0.02, lerp(pz[a], pz[b], t), 0.04, c, same ? 0.35 : 0.3, 0, 0, 1, 0.2)
    }
  }
  // nodes: glossy spheres, radius grows with the number of partners
  const rad = Array.from(deg, (d) => Math.min(0.42, 0.09 + 0.045 * Math.sqrt(d)))
  const nw = share(rad.map((q) => q * q + 0.012), nNode)
  for (let i = 0; i < NN; i++) {
    const R = rad[i]
    sphere(fb, nw[i], px[i], py[i], pz[i], R, clamp(R * 0.4, 0.045, 0.1), jit(hex(MOD_COLORS[mod[i]]), r, 0.08), 1, 0.7, r, -0.3)
  }
  return finish(fb, 'x', seed)
}

/* ================================================================ 6 · ENCODE
   The ENCODE project mapped what the genome does in many cell types: about
   75% of it is transcribed into RNA at some point in at least one cell type
   (warm light), though only 1.5% codes for protein (bright magenta ticks,
   which lie inside transcribed stretches). The rest stays dark. The fraction
   of the ribbon that is lit is exactly ENCODE_FRACTION. */
export const ENCODE_FRACTION = 0.75
const EXON_FRACTION = (COMPOSITION.find((s) => s.id === 'exon')?.pct ?? 1.5) / 100
export const ENCODE = {
  rows: [5, 0, -5],
  x0: -10.5,
  x1: 10.5,
  width: 0.9,
  transcribed: ENCODE_FRACTION,
  exonFraction: EXON_FRACTION,
}

export function encodeForm(seed = 81) {
  const fb = new FB()
  const r = rng(seed)
  const path = serpentine(ENCODE.rows, ENCODE.x0, ENCODE.x1, (s) => 0.35 * Math.sin(s * 0.21))
  const L = path.L
  // alternate dark and lit chunks, scaled so the lit ones total exactly 75%
  const K = 34
  const wl = Array.from({ length: K }, () => 0.4 + 2.2 * r()), wd = Array.from({ length: K }, () => 0.3 + 1.4 * r())
  const sl = wl.reduce((a, b) => a + b, 0), sd = wd.reduce((a, b) => a + b, 0)
  const bounds: number[] = [0]
  const lit: boolean[] = []
  const warm: RGB[] = []
  for (let i = 0; i < K; i++) {
    bounds.push(bounds[bounds.length - 1] + (wd[i] / sd) * (1 - ENCODE_FRACTION) * L)
    lit.push(false)
    warm.push([0, 0, 0])
    bounds.push(bounds[bounds.length - 1] + (wl[i] / sl) * ENCODE_FRACTION * L)
    lit.push(true)
    warm.push(mixc(hex('#ff7a00'), hex('#ffb000'), r()))
  }
  const chunkAt = (s: number) => {
    let lo = 0, hi = lit.length - 1
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1
      if (bounds[m] <= s) lo = m
      else hi = m - 1
    }
    return lo
  }
  const slate = hex('#3b4a5c')
  const [nBand, nTick] = share([0.96, 0.04], N)
  for (let k = 0; k < nBand; k++) {
    const s = r() * L
    const q = path.at(s)
    const tl = Math.hypot(q.tx, q.ty) || 1
    const u = (r() - 0.5) * ENCODE.width
    const c = chunkAt(s)
    const on = lit[c]
    fb.add(q.x - (q.ty / tl) * u, q.y + (q.tx / tl) * u, q.z, 0.07, on ? jit(warm[c], r, 0.1) : jit(slate, r, 0.1), 1, 0, 0, 1, on ? 0.95 : 0.25)
  }
  // protein-coding exons: 1.5% of the length, as short ticks inside lit chunks
  const tickLen = 0.06
  const nT = Math.round((EXON_FRACTION * L) / tickLen)
  const litIdx = lit.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
  const litW = litIdx.map((i) => bounds[i + 1] - bounds[i])
  const tw = share(new Array(nT).fill(1), nTick)
  const magenta = hex('#ff1f8e')
  for (let t = 0; t < nT; t++) {
    let pickW = r() * litW.reduce((a, b) => a + b, 0), j = 0
    while (pickW > litW[j] && j < litW.length - 1) pickW -= litW[j++]
    const i = litIdx[j]
    const s0 = lerp(bounds[i] + 0.1, bounds[i + 1] - 0.1 - tickLen, r())
    for (let k = 0; k < tw[t]; k++) {
      const q = path.at(s0 + r() * tickLen)
      const tl = Math.hypot(q.tx, q.ty) || 1
      const u = (r() - 0.5) * (ENCODE.width + 0.35)
      fb.add(q.x - (q.ty / tl) * u, q.y + (q.tx / tl) * u, q.z + 0.03, 0.06, magenta, 1, 0, 0, 1, 0.96)
    }
  }
  return finish(fb, 'x', seed)
}
