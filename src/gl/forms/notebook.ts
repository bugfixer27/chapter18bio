/* ==========================================================================
   THE NATURALIST'S NOTEBOOK
   Forms drawn the way a Victorian natural-history plate was made: first the
   engraver's stipple and contour in sepia-black ink, then watercolour washed
   over by hand. Every drawing lies flat in the page plane (z ≈ 0, normal
   toward the reader), composed inside x ∈ [-13, 13], y ∈ [-8.5, 8.5].
     INK          many small dark dots, densest where the plate is darkest:
                  away from the lamp (upper left), near edges, in hatching
     WATERCOLOUR  fewer, larger, faint particles that bleed a little past the
                  line and pool darker where the wash dries at its edge
     PIGMENT      a few vivid dots where the lesson needs colour
   The pen (PL, engrave, contour, wash, stroke, Path…) is shared with hox.ts.
   ========================================================================== */
import { FB, hex, mixc, scale, rng, gauss, finish, finishLinked, share, BASE, subtract, type RGB, type SDF } from './base'
import { N } from '../swarm'
import { ALPHA_FAMILY, BETA_FAMILY, GLOBIN, TPA, HUMAN_CHIMP, DOMAINS_SPLIT_BYA, type Gene } from '../../science/genomes'

/* ================================================================== THE PEN */
export type P2 = [number, number]
export type Box = [number, number, number, number]
export type Poly = P2[]

export const INK_A = hex('#2b2118')
export const INK_B = hex('#3a2a1c')
export const PIG = {
  vermilion: hex('#d5402b'),
  ultramarine: hex('#2c4db4'),
  viridian: hex('#2e8a6b'),
  rose: hex('#d0788b'),
  crimson: hex('#8c1d43'),
  purple: hex('#5a1c52'),
  amber: hex('#d99b31'),
  teal: hex('#2f8e8c'),
  ochre: hex('#c8953d'),
  straw: hex('#d9c68e'),
  sage: hex('#a6b273'),
  maize: hex('#efcd66'),
  cream: hex('#f2e0a8'),
  pink: hex('#e6a097'),
  sepia: hex('#8a6a48'),
  greyViolet: hex('#8a80a8'),
  gold: hex('#ffb000'),
  brick: hex('#b0382c'),
  mauve: hex('#7d5a8c'),
}
/** the oil lamp: up and to the left */
export const LIGHT: P2 = [-0.6, 0.8]
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
/** soft value noise ∈ [0, 1]: the granulation of a watercolour wash */
export const vn = (x: number, y: number) =>
  0.5 + 0.25 * (Math.sin(x * 1.7 + Math.sin(y * 1.3) * 2) * Math.cos(y * 1.1 - x * 0.4) + 0.8 * Math.sin(y * 2.1 + Math.sin(x * 0.9) * 2))

/** a particle list, built freely and written into a buffer later (sorted, sized) */
export class PL {
  x: number[] = []
  y: number[] = []
  z: number[] = []
  s: number[] = []
  a: number[] = []
  g: number[] = []
  c: RGB[] = []
  get n() {
    return this.x.length
  }
  push(x: number, y: number, z: number, s: number, c: RGB, a: number, g = 0.15) {
    this.x.push(x)
    this.y.push(y)
    this.z.push(z)
    this.s.push(s)
    this.c.push(c)
    this.a.push(a)
    this.g.push(g)
  }
  /** keep `keep` of them visible, chosen at random; the rest stay in place, transparent */
  thin(keep: number, r: () => number) {
    const n = this.n
    if (keep >= n) return
    const idx = Array.from({ length: n }, (_, i) => i)
    for (let i = 0; i < n - keep; i++) {
      const j = i + Math.floor(r() * (n - i))
      const t = idx[i]
      idx[i] = idx[j]
      idx[j] = t
      this.a[idx[i]] = 0
    }
  }
}

/** write exactly `count` particles of a list into a buffer (ordered along x unless 'none');
    surplus is dropped at random, a shortfall is made up with transparent copies */
export function put(fb: FB, pl: PL, count = pl.n, order: 'x' | 'none' = 'x', seed = 1) {
  const r = rng(seed)
  const n = pl.n
  let idx = new Uint32Array(n)
  for (let i = 0; i < n; i++) idx[i] = i
  if (n > count) {
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(r() * (n - i))
      const t = idx[i]
      idx[i] = idx[j]
      idx[j] = t
    }
    idx = idx.slice(0, count)
    if (order === 'none') idx.sort()
  }
  if (order === 'x') {
    // pack (x quantised, index) into one exact float and sort natively: no comparator
    const m = idx.length, packed = new Float64Array(m)
    for (let k = 0; k < m; k++) packed[k] = Math.max(0, Math.min(4194303, Math.round((pl.x[idx[k]] + 32) * 65536))) * 524288 + idx[k]
    packed.sort()
    for (let k = 0; k < m; k++) idx[k] = packed[k] % 524288
  }
  const m = idx.length
  for (let k = 0; k < m; k++) {
    const i = idx[k]
    fb.add(pl.x[i], pl.y[i], pl.z[i], pl.s[i], pl.c[i], pl.a[i], 0, 0, 1, pl.g[i])
  }
  for (let k = m; k < count; k++) {
    if (!m) {
      fb.add(0, 0, 0, 0.04, INK_A, 0, 0, 0, 1, 0.15)
      continue
    }
    const i = idx[Math.floor(r() * m)]
    fb.add(pl.x[i], pl.y[i], pl.z[i], pl.s[i], pl.c[i], 0, 0, 0, 1, pl.g[i])
  }
}

/** rasterise an SDF over a box once, then sample it bilinearly: far cheaper for
    the many evaluations stippling needs (outside the grid it falls back to f) */
export function bake(f: SDF, box: Box, cell = 0): SDF {
  if ((f as SDF & { baked?: boolean }).baked) return f
  const [x0, y0, x1, y1] = box
  const w = x1 - x0, h = y1 - y0
  const c = cell || Math.max(0.03, Math.sqrt((w * h) / 25000))
  const nx = Math.ceil(w / c) + 2, ny = Math.ceil(h / c) + 2
  const g = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = f(x0 + i * c, y0 + j * c)
  const ic = 1 / c
  const out = ((x: number, y: number) => {
    const fx = (x - x0) * ic, fy = (y - y0) * ic
    if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return f(x, y)
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * nx + i
    const a = g[k] + (g[k + 1] - g[k]) * tx, b = g[k + nx] + (g[k + nx + 1] - g[k + nx]) * tx
    return a + (b - a) * ty
  }) as SDF & { baked?: boolean }
  out.baked = true
  return out
}
export const grow = (b: Box, m: number): Box => [b[0] - m, b[1] - m, b[2] + m, b[3] + m]
const auto = (f: SDF, box: Box, count: number, m: number) => (count > 3000 ? bake(f, grow(box, m)) : f)

/** one dot of ink */
export function inkDot(pl: PL, r: () => number, x: number, y: number, k = 1, size = 0) {
  pl.push(x, y, (r() - 0.5) * 0.04, size || 0.035 + 0.025 * r(), r() < 0.55 ? INK_A : INK_B, Math.min(1, (0.8 + 0.15 * r()) * k), 0.15)
}

/** sample the inside of a shape with density dens(x, y, d) ∈ [0, 1]. Large counts are
    guided: a coarse grid of per-cell density bounds (cells on the outline always 1, so
    thin parts survive) picks where to try, and each try is accepted against its bound. */
export function fill(count: number, f: SDF, box: Box, r: () => number, dens: (x: number, y: number, d: number) => number, emit: (x: number, y: number, d: number) => void, tries = 90) {
  const [x0, y0, x1, y1] = box
  const w = x1 - x0, h = y1 - y0
  let made = 0, t = 0
  const lim = count * tries
  if (count < 4000 || w <= 0 || h <= 0) {
    while (made < count && t < lim) {
      t++
      const x = x0 + w * r(), y = y0 + h * r()
      const d = f(x, y)
      if (d > 0) continue
      if (r() > dens(x, y, d)) continue
      emit(x, y, d)
      made++
    }
    return made
  }
  const gx = Math.max(8, Math.min(110, Math.ceil(w / 0.2))), gy = Math.max(8, Math.min(110, Math.ceil(h / 0.2)))
  const cw = w / gx, ch = h / gy, diag = Math.sqrt(cw * cw + ch * ch)
  const bound = new Float64Array(gx * gy), cum = new Float64Array(gx * gy)
  const SU = [0.5, 0.15, 0.85, 0.15, 0.85, 0.3, 0.7], SV = [0.5, 0.15, 0.15, 0.85, 0.85, 0.6, 0.35]
  let tot = 0
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      let mx = 0, near = false, inside = false
      for (let q = 0; q < SU.length; q++) {
        const x = x0 + (i + SU[q]) * cw, y = y0 + (j + SV[q]) * ch
        const d = f(x, y)
        if (Math.abs(d) < diag) near = true
        if (d <= 0) ((inside = true), (mx = Math.max(mx, dens(x, y, d))))
      }
      const b = near ? 1 : inside ? Math.min(1, mx * 1.35 + 0.06) : 0
      bound[j * gx + i] = b
      tot += b
      cum[j * gx + i] = tot
    }
  if (tot <= 0) return 0
  const n = gx * gy
  while (made < count && t < lim) {
    t++
    const pick = r() * tot
    let lo = 0, hi = n - 1
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (cum[m] < pick) lo = m + 1
      else hi = m
    }
    const i = lo % gx, j = (lo / gx) | 0
    const x = x0 + (i + r()) * cw, y = y0 + (j + r()) * ch
    const d = f(x, y)
    if (d > 0) continue
    if (r() * bound[lo] > dens(x, y, d)) continue
    emit(x, y, d)
    made++
  }
  return made
}

export type Eng = {
  /** hatch direction (radians) and lines per world unit */
  hatch?: number
  freq?: number
  /** how strongly the hatching modulates the stipple (0..1) */
  amt?: number
  /** tone: flat base, dark rim (width ew), shadow on the side away from the lamp (width sw), tilt across the box */
  base?: number
  edge?: number
  ew?: number
  shadow?: number
  sw?: number
  tilt?: number
  /** above this tone a second, crossing hatch appears */
  cross?: number
  /** extra tone added at (x, y, d) */
  tone?: (x: number, y: number, d: number) => number
  /** the most `tone` can add (lets light areas be rejected cheaply) */
  toneMax?: number
  k?: number
}
/** stipple a shape like an engraving: dark where the lamp does not reach */
export function engrave(pl: PL, count: number, f0: SDF, box: Box, r: () => number, o: Eng = {}) {
  const f = auto(f0, box, count, 0.1)
  const ha = o.hatch ?? 0.8, hc = Math.cos(ha), hs = Math.sin(ha)
  const fr = (o.freq ?? 5.5) * Math.PI * 2, amt = o.amt ?? 0.4
  const base = o.base ?? 0.1, edge = o.edge ?? 0.55, ew = o.ew ?? 0.16, sh = o.shadow ?? 0.6, sw = o.sw ?? 0.8, tilt = o.tilt ?? 0.18
  const cross = o.cross ?? 0.6, k = o.k ?? 1
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, hw = (box[2] - box[0]) / 2, hh = (box[3] - box[1]) / 2
  return fill(
    count,
    f,
    box,
    r,
    (x, y, d) => {
      const e = 0.025
      const gx = f(x + e, y) - d, gy = f(x, y + e) - d, gl = Math.sqrt(gx * gx + gy * gy) || 1
      const lam = (gx * LIGHT[0] + gy * LIGHT[1]) / gl
      let t = base + edge * Math.exp(d / ew) + sh * Math.exp(d / sw) * Math.max(0, -lam) + tilt * (((x - cx) / hw) * 0.6 - ((y - cy) / hh) * 0.8) * 0.5
      if (o.tone) t += o.tone(x, y, d)
      t = clamp01(t)
      const u = x * hc + y * hs + Math.sin(x * 1.3 - y * 0.7) * 0.05
      let m = Math.max(0, 1 - amt + amt * Math.sin(u * fr))
      if (t > cross) m = Math.max(m, 1 - amt + amt * Math.sin((-x * hs + y * hc) * fr))
      return t * m
    },
    (x, y) => inkDot(pl, r, x, y, k),
  )
}

/** the engraver's contour: dots along f = 0, the line swelling on the shadow side */
export function contour(pl: PL, count: number, f0: SDF, box: Box, r: () => number, w = 0.035, k = 1, band = 0.35) {
  const f = auto(f0, box, count * 4, 0.1)
  const [x0, y0, x1, y1] = box
  let made = 0, t = 0
  while (made < count && t < count * 300) {
    t++
    let x = x0 + (x1 - x0) * r(), y = y0 + (y1 - y0) * r()
    let d = f(x, y)
    if (Math.abs(d) > band) continue
    let gx = 0, gy = 0
    for (let it = 0; it < 2; it++) {
      const e = 0.01
      gx = (f(x + e, y) - f(x - e, y)) / (2 * e)
      gy = (f(x, y + e) - f(x, y - e)) / (2 * e)
      const g2 = gx * gx + gy * gy || 1
      x -= (d * gx) / g2
      y -= (d * gy) / g2
      d = f(x, y)
    }
    if (Math.abs(d) > 0.02) continue
    const gl = Math.sqrt(gx * gx + gy * gy) || 1, nx = gx / gl, ny = gy / gl
    const lam = nx * LIGHT[0] + ny * LIGHT[1]
    const off = (r() - 0.5) * 2 * w * (0.6 + Math.max(0, -lam))
    inkDot(pl, r, x + nx * off, y + ny * off, k)
    made++
  }
  return made
}

export type Wash = {
  /** how far the wash creeps past the line */
  bleed?: number
  /** width of the darker rim where the wash dried */
  pool?: number
  alpha?: number
  size?: [number, number]
  /** share of vivid pigment dots */
  pig?: number
  /** extra density at (x, y) ∈ [0, 1] */
  dens?: (x: number, y: number) => number
}
/** a watercolour wash over a shape */
export function wash(pl: PL, count: number, f0: SDF, box: Box, r: () => number, col: RGB | ((x: number, y: number, d: number) => RGB), o: Wash = {}) {
  const f = auto(f0, box, count, 0.4)
  const bleed = o.bleed ?? 0.1, pool = o.pool ?? 0.22, al = o.alpha ?? 0.12, pig = o.pig ?? 0.1
  const [s0, s1] = o.size ?? [0.12, 0.28]
  const bx: Box = [box[0] - bleed, box[1] - bleed, box[2] + bleed, box[3] + bleed]
  const g = (x: number, y: number) => f(x, y) - bleed * (0.5 + 0.5 * Math.sin(x * 2.3 + Math.sin(y * 1.7) * 2))
  return fill(
    count,
    g,
    bx,
    r,
    (x, y) => (0.55 + 0.45 * vn(x, y)) * (o.dens ? o.dens(x, y) : 1),
    (x, y) => {
      const d = f(x, y)
      const c0 = typeof col === 'function' ? col(x, y, d) : col
      const edge = Math.exp(-Math.abs(d) / pool)
      if (d < -0.03 && r() < pig) {
        pl.push(x, y, (r() - 0.5) * 0.04, 0.045 + 0.03 * r(), scale(c0, 0.84), 0.55 + 0.3 * r(), 0.2)
        return
      }
      const c = mixc(c0, scale(c0, 0.72), edge * 0.7)
      pl.push(x, y, (r() - 0.5) * 0.04 - 0.01, s0 + (s1 - s0) * r(), c, al * 0.75 * (0.6 + 0.9 * edge) * (0.7 + 0.5 * vn(x * 1.7, y * 1.7)), 0.1)
    },
  )
}


/* fast SDF primitives (Math.sqrt, precomputed frames): same shapes as base.ts */
export const cir = (cx: number, cy: number, rad: number): SDF => (x, y) => {
  const dx = x - cx, dy = y - cy
  return Math.sqrt(dx * dx + dy * dy) - rad
}
export const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0): SDF => {
  const c = Math.cos(rot), s = Math.sin(rot), m = Math.min(rx, ry), irx = 1 / rx, iry = 1 / ry
  return (x, y) => {
    const dx = x - cx, dy = y - cy
    const u = (dx * c + dy * s) * irx, v = (-dx * s + dy * c) * iry
    return (Math.sqrt(u * u + v * v) - 1) * m
  }
}
export const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): SDF => {
  const bax = bx - ax, bay = by - ay, inv = 1 / (bax * bax + bay * bay || 1), dr = rb - ra
  return (x, y) => {
    const px = x - ax, py = y - ay
    let h = (px * bax + py * bay) * inv
    h = h < 0 ? 0 : h > 1 ? 1 : h
    const qx = px - bax * h, qy = py - bay * h
    return Math.sqrt(qx * qx + qy * qy) - (ra + dr * h)
  }
}
export const smin = (k: number, ...f: SDF[]): SDF => {
  const n = f.length, ik = 0.5 / k
  return (x, y) => {
    let d = f[0](x, y)
    for (let i = 1; i < n; i++) {
      const e = f[i](x, y)
      let h = 0.5 + (e - d) * ik
      h = h < 0 ? 0 : h > 1 ? 1 : h
      d = e + (d - e) * h - k * h * (1 - h)
    }
    return d
  }
}
export const umin = (...f: SDF[]): SDF => (x, y) => {
  let d = f[0](x, y)
  for (let i = 1; i < f.length; i++) {
    const e = f[i](x, y)
    if (e < d) d = e
  }
  return d
}

/* ---------------------------------------------------------------- lines */
export function polyCum(p: Poly) {
  const c = [0]
  for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]))
  return c
}
/** point and unit tangent at fraction u of a polyline's length */
export function polyAt(p: Poly, cum: number[], u: number): [number, number, number, number] {
  const L = cum[cum.length - 1]
  const s = Math.max(0, Math.min(1, u)) * L
  let lo = 0, hi = cum.length - 2
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1
    if (cum[m] <= s) lo = m
    else hi = m - 1
  }
  const a = p[lo], b = p[Math.min(lo + 1, p.length - 1)]
  const seg = cum[lo + 1] - cum[lo] || 1
  const t = (s - cum[lo]) / seg
  const tx = (b[0] - a[0]) / seg, ty = (b[1] - a[1]) / seg
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, tx || 1, ty]
}
/** several polylines treated as one, each with a weight (thicker lines get more ink) */
export class Path {
  parts: { p: Poly; cum: number[]; len: number; w: number }[] = []
  acc: number[] = [0]
  total = 0
  add(p: Poly, w = 1) {
    const cum = polyCum(p)
    const len = cum[cum.length - 1]
    if (len > 1e-6) {
      this.parts.push({ p, cum, len, w })
      this.total += len * w
      this.acc.push(this.total)
    }
    return this
  }
  /** [x, y, tx, ty, weight] at fraction u of the weighted length */
  at(u: number): [number, number, number, number, number] {
    if (!this.parts.length) return [0, 0, 1, 0, 1]
    const s = Math.max(0, Math.min(1, u)) * this.total
    let lo = 0, hi = this.parts.length - 1
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1
      if (this.acc[m] <= s) lo = m
      else hi = m - 1
    }
    const q = this.parts[lo]
    const [x, y, tx, ty] = polyAt(q.p, q.cum, (s - this.acc[lo]) / (q.len * q.w))
    return [x, y, tx, ty, q.w]
  }
}
/** ink along a polyline (or Path); w = half-width of the line */
export function stroke(pl: PL, count: number, p: Poly | Path, r: () => number, w = 0.035, k = 1, taper?: [number, number]) {
  const path = p instanceof Path ? p : new Path().add(p)
  for (let i = 0; i < count; i++) {
    const u = r()
    const [x, y, tx, ty, pw] = path.at(u)
    const ww = w * pw * (taper ? taper[0] + (taper[1] - taper[0]) * u : 1)
    const off = (r() - 0.5) * 2 * ww
    inkDot(pl, r, x - ty * off, y + tx * off, k)
  }
}
export function bez(a: P2, b: P2, c: P2, d: P2, n = 24): Poly {
  const out: Poly = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t
    out.push([
      m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0],
      m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1],
    ])
  }
  return out
}
export function arcPts(cx: number, cy: number, R: number, a0: number, a1: number, n = 32): Poly {
  const out: Poly = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)])
  }
  return out
}
/** an S-shaped connection: leaves horizontally, arrives horizontally */
export function sCurve(a: P2, b: P2, n = 12): Poly {
  const out: Poly = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * ss(0, 1, t)])
  }
  return out
}
export function catmull(pts: P2[], per = 10): Poly {
  const out: Poly = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t
      const f = (k: 0 | 1) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
      out.push([f(0), f(1)])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
export const rrect = (x: number, y: number, hw: number, hh: number, rad: number) => {
  if (hw <= 0 || hh <= 0) return 1
  rad = Math.max(0, Math.min(rad, hw, hh))
  const qx = Math.abs(x) - hw + rad, qy = Math.abs(y) - hh + rad
  const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0
  return Math.sqrt(mx * mx + my * my) + Math.min(Math.max(qx, qy), 0) - rad
}
export const sdBox = (cx: number, cy: number, hw: number, hh: number, rad = 0): SDF => (x, y) => rrect(x - cx, y - cy, hw, hh, rad)
export const boxOf = (pts: P2[], pad = 0): Box => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)))
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]
}
/** intersect a shape with a vertical strip x ∈ [a, b] */
export const strip = (f: SDF, a: number, b: number): SDF => cheap((x, y) => Math.max(f(x, y), a - x, x - b), isCheap(f))
/** mark a composite of baked fields as cheap enough not to bake again */
export function cheap(f: SDF, yes = true): SDF {
  if (yes) (f as SDF & { baked?: boolean }).baked = true
  return f
}
export const isCheap = (f: SDF) => !!(f as SDF & { baked?: boolean }).baked

/* A gene box drawn in its own frame (centre 0, half-size hw × hh): contour,
   diagonal hatching toward the shadowed corner, wash and pigment. Linked forms
   place the same local particles at different centres and scales. */
export type LP = { x: number; y: number; kind: 0 | 1 | 2 | 3; t: number; e: number; s: number; a: number }
export function geneBox(r: () => number, hw: number, hh: number, nO: number, nH: number, nW: number, nP: number): LP[] {
  const out: LP[] = []
  const per = 4 * (hw + hh)
  for (let i = 0; i < nO; i++) {
    const t0 = r()
    let t = t0 * per, x: number, y: number, nx = 0, ny = 0
    if (t < 2 * hw) ((x = -hw + t), (y = hh), (ny = 1))
    else if ((t -= 2 * hw) < 2 * hh) ((x = hw), (y = hh - t), (nx = 1))
    else if ((t -= 2 * hh) < 2 * hw) ((x = hw - t), (y = -hh), (ny = -1))
    else ((t -= 2 * hw), (x = -hw), (y = -hh + t), (nx = -1))
    const lam = nx * LIGHT[0] + ny * LIGHT[1]
    const off = (r() - 0.5) * 2 * 0.032 * (0.6 + Math.max(0, -lam))
    out.push({ x: x + nx * off, y: y + ny * off, kind: 0, t: t0, e: 0, s: 0.035 + 0.025 * r(), a: 0.82 + 0.13 * r() })
  }
  for (let made = 0, tries = 0; made < nH && tries < nH * 60; tries++) {
    const x = (r() * 2 - 1) * hw * 0.96, y = (r() * 2 - 1) * hh * 0.94
    const dens = Math.pow(0.5 + 0.5 * Math.cos((2 * Math.PI * (x + y)) / 0.17), 6) * (0.3 + 0.7 * ss(-1, 1, x / hw - y / hh))
    if (r() > dens) continue
    out.push({ x, y, kind: 1, t: 0, e: 0, s: 0.03 + 0.02 * r(), a: 0.7 + 0.2 * r() })
    made++
  }
  for (let i = 0; i < nW; i++) {
    const x = (r() * 2 - 1) * (hw + 0.07), y = (r() * 2 - 1) * (hh + 0.07)
    const d = rrect(x, y, hw, hh, 0.05)
    const e = Math.exp(-Math.abs(d) / 0.12)
    out.push({ x, y, kind: 2, t: 0, e, s: 0.1 + 0.12 * r(), a: 0.065 * (0.6 + 1.1 * e) * (0.7 + 0.5 * vn(x * 3, y * 3)) })
  }
  for (let i = 0; i < nP; i++) {
    const x = (r() * 2 - 1) * hw * 0.92, y = (r() * 2 - 1) * hh * 0.9
    out.push({ x, y, kind: 3, t: 0, e: 0, s: 0.04 + 0.025 * r(), a: 0.45 + 0.3 * r() })
  }
  return out
}
/** colour of a gene-box particle */
export const lpColour = (p: LP, col: RGB, i: number): RGB =>
  p.kind < 2 ? (i & 1 ? INK_A : INK_B) : p.kind === 2 ? mixc(col, scale(col, 0.72), p.e * 0.7) : scale(col, 0.84)

/* ======================================================= 1 · McCLINTOCK'S CORN
   Figure 18.6: an ear of Indian corn, whose mottled kernels McClintock read
   as the footprints of transposable elements. The pigment gene of a kernel
   is disrupted by an element that jumped in (pale kernel); where, in some
   cells, it jumps out again, pigment returns in a spot or a streak of that
   cell's descendants. An engraved ear on a slight diagonal: 16 rows of
   kernels across its face, the husk peeling back at the base. */
const EAR = { angle: 0.6, L: 15, c: [1.3, 1.1] as P2, R: 1.95, rows: 16, thm: 1.38, kl: 0.46 }
const EU: P2 = [Math.cos(EAR.angle), Math.sin(EAR.angle)]
const EV: P2 = [-EU[1], EU[0]]
const EB: P2 = [EAR.c[0] - (EU[0] * EAR.L) / 2, EAR.c[1] - (EU[1] * EAR.L) / 2]
/** ear frame (u along the ear from its base, v across; +v faces the lamp) → page */
const earW = (u: number, v: number): P2 => [EB[0] + EU[0] * u + EV[0] * v, EB[1] + EU[1] * u + EV[1] * v]
const earL = (x: number, y: number): P2 => {
  const dx = x - EB[0], dy = y - EB[1]
  return [dx * EU[0] + dy * EU[1], dx * EV[0] + dy * EV[1]]
}
function earR(u: number) {
  if (u < 0 || u > EAR.L) return 0
  const swell = 0.8 + 0.2 * ss(0, 2.2, u)
  const taper = u < 7 ? 1 : Math.sqrt(Math.max(0, 1 - ((u - 7) / (EAR.L - 7)) ** 2))
  return EAR.R * swell * taper
}
const DTH = (2 * EAR.thm) / EAR.rows
/** which kernel a point of the cob's surface (u, θ) falls in, and how deep inside it */
function kernelAt(u: number, th: number) {
  const row = Math.floor((th + EAR.thm) / DTH)
  if (row < 0 || row >= EAR.rows) return null
  const off = 0.3 + (row % 2) * EAR.kl * 0.5
  const col = Math.floor((u - off) / EAR.kl)
  if (col < 0) return null
  const fu = (u - off) / EAR.kl - col, ft = (th + EAR.thm) / DTH - row
  const R = earR(u)
  const hv = (DTH * R) / 2
  const d = rrect((fu - 0.5) * EAR.kl, (ft - 0.5) * DTH * R, EAR.kl / 2 - 0.035, hv - 0.03, Math.min(0.12, hv * 0.6))
  return { row, col, fu, ft, d }
}
/* the kernel the camera dives into: on the lit flank, halfway up the ear */
const HL = { row: 10, col: 14 }
type Kern = { type: 0 | 1 | 2; tint: number; spots: [number, number, number][]; streaks: [number, number, number, number, number][] }
const KCACHE = new Map<number, Kern>()
function kern(row: number, col: number): Kern {
  const key = row * 1000 + col
  const hit = KCACHE.get(key)
  if (hit) return hit
  const r = rng(9001 + key * 7919)
  const p = r()
  const hl = row === HL.row && col === HL.col
  // pale (element sitting in the pigment gene), mottled (it jumped out in some cells), solid purple (never in)
  const type: 0 | 1 | 2 = hl ? 1 : p < 0.07 ? 2 : p < 0.5 ? 1 : 0
  const spots: [number, number, number][] = []
  const streaks: [number, number, number, number, number][] = []
  if (type === 1) {
    const ns = hl ? 9 : 3 + Math.floor(r() * 5)
    for (let i = 0; i < ns; i++) spots.push([0.1 + 0.8 * r(), 0.1 + 0.8 * r(), 0.07 + 0.15 * r()])
    const nk = hl ? 3 : Math.floor(r() * 2.6)
    for (let i = 0; i < nk; i++) {
      const a = r() * Math.PI * 2, l = 0.3 + 0.4 * r()
      const u0 = 0.2 + 0.6 * r(), t0 = 0.2 + 0.6 * r()
      streaks.push([u0, t0, u0 + Math.cos(a) * l, t0 + Math.sin(a) * l, 0.04 + 0.05 * r()])
    }
  }
  const k: Kern = { type, tint: r(), spots, streaks }
  KCACHE.set(key, k)
  return k
}
function inSpot(k: Kern, fu: number, ft: number) {
  for (const [u, t, rad] of k.spots) if (Math.hypot(fu - u, ft - t) < rad) return true
  for (const [u0, t0, u1, t1, w] of k.streaks) {
    const bx = u1 - u0, by = t1 - t0, px = fu - u0, py = ft - t0
    const h = clamp01((px * bx + py * by) / (bx * bx + by * by))
    if (Math.hypot(px - bx * h, py - by * h) < w) return true
  }
  return false
}
const HL_U = 0.3 + (HL.row % 2) * EAR.kl * 0.5 + (HL.col + 0.5) * EAR.kl
const HL_T = -EAR.thm + (HL.row + 0.5) * DTH

/* husk leaves in the ear frame: attach, bend, tip, width */
const HUSK: { a: P2; c: P2; e: P2; W: number }[] = [
  // peeled back from the base, then drooping under their own weight
  { a: [1.3, 1.6], c: [-1.8, 4.4], e: [-4.6, 2.2], W: 1.75 },
  { a: [0.8, 0.8], c: [-3.0, 2.8], e: [-5.4, -0.4], W: 1.9 },
  { a: [0.5, -0.2], c: [-3.0, -0.8], e: [-4.2, -3.3], W: 1.8 },
  { a: [0.9, -1.3], c: [-1.2, -3.4], e: [-2.4, -4.6], W: 1.6 },
  { a: [1.6, -1.6], c: [1.4, -3.8], e: [0.6, -5.0], W: 1.2 },
]
function huskAt(h: (typeof HUSK)[number], s: number, t: number): P2 {
  const m = 1 - s
  const qx = m * m * h.a[0] + 2 * m * s * h.c[0] + s * s * h.e[0]
  const qy = m * m * h.a[1] + 2 * m * s * h.c[1] + s * s * h.e[1]
  const tx = 2 * m * (h.c[0] - h.a[0]) + 2 * s * (h.e[0] - h.c[0])
  const ty = 2 * m * (h.c[1] - h.a[1]) + 2 * s * (h.e[1] - h.c[1])
  const tl = Math.hypot(tx, ty) || 1
  const w = huskW(h, s)
  return earW(qx - (ty / tl) * t * w, qy + (tx / tl) * t * w)
}
const huskW = (h: (typeof HUSK)[number], s: number) => h.W * Math.pow(1 - s, 0.78) * (0.45 + 0.55 * ss(0, 0.35, s)) * (1 + 0.07 * Math.sin(s * 23 + h.W * 9))

export const CORN = {
  centre: EAR.c,
  base: EB,
  tip: earW(EAR.L, 0),
  /** the ear's axis, radians from +x */
  angle: EAR.angle,
  length: EAR.L,
  radius: EAR.R,
  rows: EAR.rows,
  /** the mottled kernel the camera dives into */
  kernel: earW(HL_U, earR(HL_U) * Math.sin(HL_T)),
  kernelSize: [EAR.kl, DTH * earR(HL_U) * Math.cos(HL_T)] as P2,
  husk: earW(-3.2, 0.2),
}

export function cornForm(seed = 18) {
  const r = rng(seed)
  const pl = new PL()
  const [nKi, nCon, nHi, nKw, nLi, nLe, nLw, nSh, nSilk] = share([50, 4.5, 2.2, 29, 21, 4, 10, 6.5, 1.75])
  const cyl = (th: number) => 0.5 - 0.5 * Math.sin(th)

  // ink on the cob: grooves between kernels black, each kernel a small shaded pillow
  for (let made = 0, t = 0; made < nKi && t < nKi * 60; t++) {
    const u = r() * EAR.L, th = (r() * 2 - 1) * (Math.PI / 2)
    const R = earR(u)
    if (R <= 0 || r() > (R * Math.cos(th)) / EAR.R) continue
    const v = R * Math.sin(th)
    let dens: number
    if (Math.abs(th) > EAR.thm) dens = 0.85
    else {
      const k = kernelAt(u, th)
      if (!k || k.d > -0.022) dens = 0.92
      else {
        const rim = Math.exp(k.d / 0.05)
        const lower = k.ft < 0.5 ? 1 : 0.35
        const limb = Math.pow(Math.abs(th) / (Math.PI / 2), 6)
        dens = (0.04 + 0.55 * cyl(th) ** 2 + 0.45 * rim * lower + 0.4 * limb) * (0.6 + 0.4 * Math.sin(v * Math.PI * 2 * 6.5))
      }
    }
    if (r() > dens) continue
    const [x, y] = earW(u, v)
    inkDot(pl, r, x, y)
    made++
  }
  // the ear's contour
  const earF: SDF = (x, y) => {
    const [u, v] = earL(x, y)
    if (u < 0) return Math.hypot(u, Math.max(0, Math.abs(v) - earR(0.001)))
    if (u > EAR.L) return Math.hypot(u - EAR.L, v)
    return Math.max(Math.abs(v) - earR(u), -u, u - EAR.L) * 0.95
  }
  const earBox = boxOf([earW(0, 2), earW(0, -2), earW(EAR.L, 0), earW(7, 2), earW(7, -2), earW(EAR.L - 1, 1.2), earW(EAR.L - 1, -1.2)], 0.3)
  contour(pl, nCon, earF, earBox, r, 0.035)

  // watercolour on the kernels: pale, mottled with purple-red spots and streaks, a few solid purple
  const kernelColour = (k: Kern, fu: number, ft: number, th: number, d: number, extra: boolean) => {
    let c: RGB
    let a = 0.14, s = 0.08 + 0.08 * r(), pig = false
    if (k.type === 2) {
      c = mixc(PIG.purple, PIG.crimson, 0.35 * k.tint)
      if (r() < 0.35) ((pig = true), (s = 0.04 + 0.02 * r()), (a = 0.7 + 0.2 * r()))
      else a = 0.3
    } else c = mixc(PIG.maize, PIG.cream, k.tint)
    if (k.type === 1 && inSpot(k, fu, ft)) {
      c = mixc(PIG.crimson, PIG.purple, 0.5 * k.tint)
      if (r() < (extra ? 0.7 : 0.6)) ((pig = true), (s = 0.035 + 0.02 * r()), (a = 0.8 + 0.2 * r()))
      else a = 0.3
    }
    if (!pig) {
      c = mixc(c, PIG.sepia, 0.35 * cyl(th))
      const edge = Math.exp(d / 0.04)
      a *= 1 + 0.8 * edge
      c = mixc(c, scale(c, 0.75), 0.6 * edge)
    }
    return { c, a, s }
  }
  for (let made = 0, t = 0; made < nKw && t < nKw * 60; t++) {
    const u = 0.2 + r() * (EAR.L - 0.5), th = (r() * 2 - 1) * EAR.thm
    const R = earR(u)
    if (R <= 0 || r() > (R * Math.cos(th)) / EAR.R) continue
    const k = kernelAt(u, th)
    if (!k || k.d > 0.03) continue
    const K = kern(k.row, k.col)
    const p = kernelColour(K, k.fu, k.ft, th, k.d, false)
    const [x, y] = earW(u, R * Math.sin(th))
    pl.push(x, y, (r() - 0.5) * 0.04 - 0.01, p.s, p.c, p.a, 0.1)
    made++
  }
  // the highlighted kernel, drawn finer for the close-up
  {
    const K = kern(HL.row, HL.col)
    const nI = Math.floor(nHi * 0.5)
    const off = 0.3 + (HL.row % 2) * EAR.kl * 0.5
    for (let made = 0, t = 0; made < nHi && t < nHi * 40; t++) {
      const fu = 0.02 + 0.96 * r(), ft = 0.02 + 0.96 * r()
      const u = off + (HL.col + fu) * EAR.kl, th = -EAR.thm + (HL.row + ft) * DTH
      const k = kernelAt(u, th)
      if (!k) continue
      const [x, y] = earW(u, earR(u) * Math.sin(th))
      if (made < nI) {
        const dens = k.d > -0.025 ? 1 : 0.03 + 0.45 * Math.exp(k.d / 0.035) * (k.ft < 0.5 ? 1 : 0.4)
        if (r() > dens) continue
        inkDot(pl, r, x, y, 1, 0.022 + 0.012 * r())
      } else {
        if (k.d > -0.015) continue
        const p = kernelColour(K, k.fu, k.ft, th, k.d, true)
        pl.push(x, y, (r() - 0.5) * 0.03, p.s * 0.7, p.c, p.s < 0.07 ? p.a : p.a * 0.45, 0.1)
      }
      made++
    }
  }

  // husk leaves peeling back: parallel veins, a curled (shadowed) half, straw-green wash
  const perLeaf = share(HUSK.map((h) => h.W), nLi)
  const perEdge = share(HUSK.map((h) => h.W), nLe)
  const perWash = share(HUSK.map((h) => h.W), nLw)
  HUSK.forEach((h, i) => {
    for (let made = 0, t = 0; made < perLeaf[i] && t < perLeaf[i] * 60; t++) {
      const s = r(), tt = r() * 2 - 1
      if (r() > huskW(h, s) / h.W) continue
      const vein = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * tt * 9), 14)
      const edge = Math.abs(tt) > 0.92 ? 1 : 0
      // the papery leaf twists: first one half is in shadow, then the other
      const tw = Math.sin((s - 0.45) * 4 + i)
      const shade = (tt * tw < 0 ? 0.3 : 0.04) * Math.abs(tw) + 0.1 * s
      const dens = clamp01(0.03 + shade + 0.5 * vein + 0.85 * edge)
      if (r() > dens) continue
      const [x, y] = huskAt(h, s, tt)
      inkDot(pl, r, x, y)
      made++
    }
    for (let j = 0; j < perEdge[i]; j++) {
      const s = r(), side = j & 1 ? 1 : -1
      const [x, y] = huskAt(h, s, side * (1 - 0.04 * r()))
      inkDot(pl, r, x, y)
    }
    for (let made = 0, t = 0; made < perWash[i] && t < perWash[i] * 40; t++) {
      const s = r(), tt = (r() * 2 - 1) * 1.05
      if (r() > huskW(h, s) / h.W) continue
      const [x, y] = huskAt(h, s, tt)
      const edge = Math.exp(-(1.05 - Math.abs(tt)) / 0.15)
      const c0 = mixc(PIG.straw, PIG.sage, 0.5 + 0.5 * Math.sin(s * 3.3 + i))
      pl.push(x, y, -0.01, 0.14 + 0.14 * r(), mixc(c0, scale(c0, 0.75), edge * 0.6), 0.1 * (0.7 + 0.8 * edge) * (0.7 + 0.5 * vn(x, y)), 0.1)
      made++
    }
  })
  // the shank the ear grew on, heavily cross-hatched
  const [sa, sb] = [earW(0.4, 0), earW(-1.7, -0.15)]
  const shank = cap(sa[0], sa[1], sb[0], sb[1], 0.5, 0.42)
  const shBox = boxOf([sa, sb], 0.8)
  engrave(pl, Math.floor(nSh * 0.78), shank, shBox, r, { base: 0.3, edge: 0.5, hatch: EAR.angle + 1.2, freq: 7, amt: 0.6, cross: 0.4 })
  contour(pl, nSh - Math.floor(nSh * 0.78), shank, shBox, r)
  // silk at the tip
  const nS = share([1, 1, 1, 1, 1, 1, 1], nSilk)
  for (let i = 0; i < 7; i++) {
    const o = i - 3
    const a = earW(EAR.L - 0.25, o * 0.08)
    const e = earW(EAR.L + 1.8 + 0.4 * Math.sin(i * 2.1), o * 0.5 + 0.3 * Math.sin(i))
    stroke(pl, nS[i], bez(a, earW(EAR.L + 0.7, o * 0.1 + 0.3), earW(EAR.L + 1.2, o * 0.4 - 0.3), e), r, 0.012, 0.75)
  }
  const fb = new FB()
  put(fb, pl, Math.min(pl.n, N), 'none')
  return finish(fb, 'x', seed)
}

/* ============================================= 2 · THE GLOBIN FAMILIES (18.13)
   One ancestral globin gene, 450–500 million years ago, duplicated; the two
   copies mutated into the α and β lineages; transposition carried them to
   different chromosomes (16 and 11); further duplications and mutations made
   today's clusters, some copies surviving only as pseudogenes (ψ).
   'globin-map' draws the clusters as gene maps; 'globin-tree' is the same
   particles as the tree they descend from: each gene box of the map is its
   leaf in the tree, and the DNA line becomes the branches.
   The branching order and dates inside each cluster are schematic (the
   figure shows the model, not a dated phylogeny); leaves follow the
   chromosome order so that the map folds straight into the tree. */
const MAPBOX = { hw: 0.8, hh: 0.475 }
const LEAF_K = 0.75 // leaf boxes are the map boxes at 3/4 size
const LEAF_Y = -6.5
const yMya = (m: number) => LEAF_Y + (m / 500) * 14
const [ANC_LO, ANC_HI] = GLOBIN.ancestorMya

export const GLOBIN_MAP = {
  alphaY: 3,
  betaY: -3,
  x0: -10.8,
  x1: 11.2,
  box: [MAPBOX.hw * 2, MAPBOX.hh * 2] as P2,
  alphaChromosome: GLOBIN.alphaChromosome,
  betaChromosome: GLOBIN.betaChromosome,
  genes: {} as Record<string, P2>,
}
ALPHA_FAMILY.forEach((g, i) => (GLOBIN_MAP.genes[g.id] = [-9 + i * 3.15, GLOBIN_MAP.alphaY]))
BETA_FAMILY.forEach((g, i) => (GLOBIN_MAP.genes[g.id] = [-8.6 + i * 3.7, GLOBIN_MAP.betaY]))

type TN = { id?: string; mya: number; kids: TN[]; x: number; y: number }
const lf = (id: string): TN => ({ id, mya: 0, kids: [], x: 0, y: 0 })
const nd = (mya: number, ...kids: TN[]): TN => ({ mya, kids, x: 0, y: 0 })
const ALPHA_TREE = nd(300, nd(150, lf('zeta'), lf('psizeta')), nd(240, nd(120, lf('psia2'), nd(60, lf('psia1'), nd(20, lf('a2'), lf('a1')))), lf('psitheta')))
const BETA_TREE = nd(300, nd(200, lf('eps'), nd(40, lf('Gg'), lf('Ag'))), nd(170, lf('psib'), nd(50, lf('delta'), lf('beta'))))
const LEAF_X: Record<string, number> = {}
ALPHA_FAMILY.forEach((g, i) => (LEAF_X[g.id] = -11.2 + i * 1.62))
BETA_FAMILY.forEach((g, i) => (LEAF_X[g.id] = 1.6 + i * 1.96))
function placeTree(t: TN) {
  if (t.id) {
    t.x = LEAF_X[t.id]
    t.y = LEAF_Y
    return
  }
  t.kids.forEach(placeTree)
  t.x = t.kids.reduce((s, k) => s + k.x, 0) / t.kids.length
  t.y = yMya(t.mya)
}
placeTree(ALPHA_TREE)
placeTree(BETA_TREE)
const DUP: P2 = [(ALPHA_TREE.x + BETA_TREE.x) / 2, yMya(ANC_LO)]
const ANC: P2 = [DUP[0], yMya(ANC_HI)]
const ANCBOX = { hw: 0.75, hh: 0.45 }
const TRANSPOSE_MYA = 350
const nodesOf = (t: TN, out: { mya: number; x: number; y: number }[] = []) => {
  if (!t.id) {
    out.push({ mya: t.mya, x: t.x, y: t.y })
    t.kids.forEach((k) => nodesOf(k, out))
  }
  return out
}
export const GLOBIN_TREE = {
  ancestor: ANC,
  duplication: DUP,
  alphaNode: [ALPHA_TREE.x, ALPHA_TREE.y] as P2,
  betaNode: [BETA_TREE.x, BETA_TREE.y] as P2,
  transposition: { mya: TRANSPOSE_MYA, alpha: [ALPHA_TREE.x, yMya(TRANSPOSE_MYA)] as P2, beta: [BETA_TREE.x, yMya(TRANSPOSE_MYA)] as P2 },
  leaves: Object.fromEntries(Object.entries(LEAF_X).map(([id, x]) => [id, [x, LEAF_Y] as P2])) as Record<string, P2>,
  leafBox: [MAPBOX.hw * 2 * LEAF_K, MAPBOX.hh * 2 * LEAF_K] as P2,
  nodes: [...nodesOf(ALPHA_TREE), ...nodesOf(BETA_TREE)],
  /** the time axis: a rule at x with a tick at each 100 million years */
  axis: { x: -12.6, ticks: [500, 400, 300, 200, 100, 0].map((mya) => ({ mya, y: yMya(mya) })) },
}

function treeBranches(t: TN, p: Path, w: number) {
  if (t.id) return
  const xs = t.kids.map((k) => k.x)
  p.add([[Math.min(...xs), t.y], [Math.max(...xs), t.y]], w)
  for (const k of t.kids) {
    p.add([[k.x, t.y], [k.x, k.id ? LEAF_Y + MAPBOX.hh * LEAF_K + 0.04 : k.y]], w)
    treeBranches(k, p, w)
  }
}
function mapLine(y: number, fam: Gene[]) {
  const p = new Path()
  const xs = fam.map((g) => GLOBIN_MAP.genes[g.id][0]).sort((a, b) => a - b)
  let x = GLOBIN_MAP.x0
  for (const gx of xs) {
    p.add([[x, y], [gx - MAPBOX.hw - 0.06, y]])
    x = gx + MAPBOX.hw + 0.06
  }
  p.add([[x, y], [GLOBIN_MAP.x1, y]])
  p.add([[GLOBIN_MAP.x0, y - 0.24], [GLOBIN_MAP.x0, y + 0.24]])
  p.add([[GLOBIN_MAP.x1, y - 0.24], [GLOBIN_MAP.x1, y + 0.24]])
  return p
}

export function globinForms(seed = 13) {
  const r = rng(seed)
  const fm = new FB(), ft = new FB()
  const ULTRA = PIG.ultramarine, VERM = PIG.vermilion
  const z = () => (r() - 0.5) * 0.04
  // 1 · gene boxes: the same local particles in the map and at the leaf
  const genes: [Gene, RGB][] = [...ALPHA_FAMILY.map((g) => [g, ULTRA] as [Gene, RGB]), ...BETA_FAMILY.map((g) => [g, VERM] as [Gene, RGB])]
  for (const [g, col] of genes) {
    const lps = g.pseudo ? geneBox(r, MAPBOX.hw, MAPBOX.hh, 1900, 0, 0, 0) : geneBox(r, MAPBOX.hw, MAPBOX.hh, 1700, 900, 2600, 250)
    const [mx, my] = GLOBIN_MAP.genes[g.id]
    const tx = LEAF_X[g.id], ty = LEAF_Y
    lps.forEach((p, i) => {
      const c = lpColour(p, col, i), zz = z(), gl = p.kind < 2 ? 0.15 : 0.1
      fm.add(mx + p.x, my + p.y, zz, p.s, c, p.a, 0, 0, 1, gl)
      ft.add(tx + p.x * LEAF_K, ty + p.y * LEAF_K, zz, p.s, c, p.a, 0, 0, 1, gl)
    })
  }
  // 2 · the DNA lines become the branches (α line → trunk and α side, β line → β side)
  const mapA = mapLine(GLOBIN_MAP.alphaY, ALPHA_FAMILY), mapB = mapLine(GLOBIN_MAP.betaY, BETA_FAMILY)
  const left = new Path(), right = new Path()
  left.add([[ANC[0], ANC[1] - ANCBOX.hh - 0.04], DUP], 1.6)
  left.add([DUP, [ALPHA_TREE.x, DUP[1]]], 1.6)
  left.add([[ALPHA_TREE.x, DUP[1]], [ALPHA_TREE.x, ALPHA_TREE.y]], 1.6)
  treeBranches(ALPHA_TREE, left, 1)
  right.add([DUP, [BETA_TREE.x, DUP[1]]], 1.6)
  right.add([[BETA_TREE.x, DUP[1]], [BETA_TREE.x, BETA_TREE.y]], 1.6)
  treeBranches(BETA_TREE, right, 1)
  const LINES = 46000
  const nL = Math.round((LINES * left.total) / (left.total + right.total))
  const lines: [Path, Path, number][] = [
    [mapA, left, nL],
    [mapB, right, LINES - nL],
  ]
  for (const [pm, pt, n] of lines) {
    for (let j = 0; j < n; j++) {
      const u = (j + r()) / n
      const o = (r() - 0.5) * 2
      const [x0, y0, tx0, ty0, w0] = pm.at(u)
      const [x1, y1, tx1, ty1, w1] = pt.at(u)
      const s = 0.035 + 0.025 * r(), c = j & 1 ? INK_A : INK_B, a = 0.82 + 0.13 * r(), zz = z()
      const ow0 = o * 0.03 * w0, ow1 = o * 0.03 * w1 * (0.8 + 0.4 * Math.sin(y1 * 30) ** 2)
      fm.add(x0 - ty0 * ow0, y0 + tx0 * ow0, zz, s, c, a, 0, 0, 1, 0.15)
      ft.add(x1 - ty1 * ow1, y1 + tx1 * ow1, zz, s, c, a, 0, 0, 1, 0.15)
    }
  }
  // hidden in the map: particles that only exist in the tree rise out of the DNA lines
  const hideAt = (): P2 => {
    const [x, y] = (r() < 0.5 ? mapA : mapB).at(r())
    return [x, y]
  }
  // 3 · the ancestral gene
  {
    const col = PIG.mauve
    geneBox(r, ANCBOX.hw, ANCBOX.hh, 2000, 800, 3200, 300).forEach((p, i) => {
      const c = lpColour(p, col, i), zz = z(), [hx, hy] = hideAt()
      fm.add(hx, hy, zz, p.s, c, 0, 0, 0, 1, 0.15)
      ft.add(ANC[0] + p.x, ANC[1] + p.y, zz, p.s, c, p.a, 0, 0, 1, 0.15)
    })
  }
  // 4 · transposition marks (//) across both lineages, and the time axis
  const marks = new Path()
  for (const x of [ALPHA_TREE.x, BETA_TREE.x]) {
    const y = yMya(TRANSPOSE_MYA)
    for (const dy of [-0.1, 0.1]) marks.add([[x - 0.32, y + dy - 0.14], [x + 0.32, y + dy + 0.14]])
  }
  const axis = new Path()
  const AX = GLOBIN_TREE.axis.x
  axis.add([[AX, yMya(500)], [AX, yMya(0)]], 1.2)
  for (let m = 0; m <= 500; m += 50) axis.add([[AX, yMya(m)], [AX + (m % 100 ? 0.2 : 0.42), yMya(m)]], 2.2)
  for (const [p, n] of [
    [marks, 1400],
    [axis, 3600],
  ] as [Path, number][]) {
    for (let j = 0; j < n; j++) {
      const [x, y, tx, ty, w] = p.at(r())
      const o = (r() - 0.5) * 2 * 0.03 * w
      const [hx, hy] = hideAt()
      const s = 0.035 + 0.025 * r(), c = j & 1 ? INK_A : INK_B, zz = z()
      fm.add(hx, hy, zz, s, c, 0, 0, 0, 1, 0.15)
      ft.add(x - ty * o, y + tx * o, zz, s, c, 0.85, 0, 0, 1, 0.15)
    }
  }
  return finishLinked([fm, ft], 'x', 0, seed)
}

/* ====================================== 3 · LYSOZYME AND α-LACTALBUMIN (18.5)
   A duplicated gene can take on a new function: lysozyme (an enzyme that
   helps fight bacteria) and α-lactalbumin (a protein of milk production in
   mammals) have similar amino acid sequences and nearly the same 3-D fold.
   Two engraved globular folds, the same ribbon drawn inside each, joined by a
   duplication fork to one ancestral gene. */
const LYSO_S = 3.3
export const LYSO = {
  lysozyme: [-5, -1.0] as P2,
  lactalbumin: [6, -1.0] as P2,
  radius: LYSO_S,
  ancestor: [0.5, 6.3] as P2,
  fork: [0.5, 4.8] as P2,
}
function foldSDF(cx: number, cy: number, S: number, j: number[]): SDF {
  const c = (x: number, y: number, rr: number) => cir(cx + x * S, cy + y * S, rr * S)
  const body = smin(0.25 * S, c(-0.32, 0.12, 0.6 * (1 + j[0])), c(0.34, 0.02, 0.58 * (1 + j[1])), c(0.02, -0.46, 0.46), c(-0.4, -0.38, 0.36), c(0.36, 0.46, 0.3 * (1 + j[2])), c(-0.2, 0.55, 0.3))
  // the active-site cleft between the two lobes
  const cleft = cap(cx + 0.06 * S, cy + 0.98 * S, cx + 0.02 * S, cy + 0.24 * S, 0.1 * S, 0.06 * S)
  return subtract(body, cleft)
}
const RIB: P2[] = [
  [-0.78, -0.2], [-0.55, 0.35], [-0.2, 0.62], [-0.45, 0.05], [-0.62, -0.45], [-0.2, -0.7], [0.2, -0.55], [0.5, -0.2], [0.72, 0.2],
  [0.45, 0.55], [0.2, 0.25], [0.25, -0.1], [-0.05, -0.25], [-0.25, 0.2], [0.0, 0.45], [0.6, 0.35], [0.75, -0.25], [0.35, -0.75],
]
/* secondary structure along the chain: helices and β-strands (arrows), loops between */
const SSE: [number, number, 'h' | 'e'][] = [
  [0.03, 0.15, 'h'], [0.29, 0.4, 'h'], [0.45, 0.51, 'e'], [0.53, 0.59, 'e'], [0.63, 0.73, 'h'], [0.77, 0.83, 'e'], [0.87, 0.97, 'h'],
]
function ribbon(pl: PL, count: number, cx: number, cy: number, S: number, wob: number, r: () => number) {
  const pts: P2[] = RIB.map(([x, y], i) => [cx + (0.86 * x + wob * Math.sin(i * 1.7)) * S, cy + (0.86 * y - 0.03 + wob * Math.cos(i * 2.3)) * S])
  const path = catmull(pts, 14)
  const cum = polyCum(path)
  const L = cum[cum.length - 1]
  for (let made = 0, t = 0; made < count && t < count * 40; t++) {
    const u = r()
    const el = SSE.find(([a, b]) => u >= a && u <= b)
    const [x, y, tx, ty] = polyAt(path, cum, u)
    const nx = -ty, ny = tx
    const tt = r() * 2 - 1
    let off = 0, hw = 0.05, dens = 1
    if (el && el[2] === 'h') {
      const len = (el[1] - el[0]) * L, turns = Math.max(1, Math.round(len / 0.9))
      const phi = (2 * Math.PI * turns * (u - el[0]) * L) / len
      hw = 0.07 + 0.16 * Math.abs(Math.cos(phi))
      off = 0.22 * Math.sin(phi)
      const back = Math.cos(phi) < 0
      dens = back ? 0.75 + 0.25 * (Math.abs(tt) > 0.7 ? 1 : 0) : Math.abs(tt) > 0.72 ? 1 : 0.2 * (0.5 + 0.5 * Math.sin(tt * Math.PI * 3))
    } else if (el) {
      const f = (u - el[0]) / (el[1] - el[0])
      hw = f > 0.75 ? 0.36 * (1 - (f - 0.75) / 0.25) + 0.02 : 0.2
      dens = Math.abs(tt) > 0.78 ? 1 : 0.1 + 0.7 * Math.pow(0.5 + 0.5 * Math.cos((2 * Math.PI * u * L) / 0.12), 4)
    }
    if (r() > (hw / 0.36) * dens) continue
    const o = off + tt * hw
    inkDot(pl, r, x + nx * o, y + ny * o)
    made++
  }
}
export function lysoForm(seed = 21) {
  const r = rng(seed)
  const pl = new PL()
  const [nB, nC, nR, nW, nF, nA] = share([19, 4.5, 17, 10, 2.8, 4.2], N)
  const folds: [P2, number[], number, RGB][] = [
    [LYSO.lysozyme, [0, 0, 0], 0, PIG.viridian],
    [LYSO.lactalbumin, [0.03, -0.025, 0.05], 0.02, PIG.rose],
  ]
  const perFold = (n: number) => Math.floor(n / 2)
  for (const [[cx, cy], jit, wob, col] of folds) {
    const box: Box = [cx - LYSO_S, cy - LYSO_S, cx + LYSO_S, cy + LYSO_S]
    const f = bake(foldSDF(cx, cy, LYSO_S, jit), grow(box, 0.5))
    engrave(pl, perFold(nB), f, box, r, { base: 0.04, edge: 0.45, shadow: 0.55, sw: 1.2, hatch: 0.9, freq: 6, amt: 0.45 })
    contour(pl, perFold(nC), f, box, r, 0.04)
    ribbon(pl, perFold(nR), cx, cy, LYSO_S, wob, r)
    wash(pl, perFold(nW), f, box, r, col, { alpha: 0.09, pig: 0.04, size: [0.14, 0.3] })
  }
  // the duplication fork: one ancestral gene above, a line to each protein
  const [ax, ay] = LYSO.ancestor, [fx, fy] = LYSO.fork
  const fork = new Path()
  fork.add([[ax, ay - 0.45], [fx, fy]], 1.3)
  fork.add([[LYSO.lysozyme[0], fy], [LYSO.lactalbumin[0], fy]], 1.3)
  for (const [x] of [LYSO.lysozyme, LYSO.lactalbumin]) {
    fork.add([[x, fy], [x, 2.35]], 1.3)
    fork.add([[x - 0.28, 2.75], [x, 2.35], [x + 0.28, 2.75]], 1)
  }
  stroke(pl, nF, fork, r, 0.035)
  const lps = geneBox(r, 0.9, 0.42, Math.floor(nA * 0.4), Math.floor(nA * 0.15), Math.floor(nA * 0.38), Math.floor(nA * 0.07))
  lps.forEach((p, i) => pl.push(ax + p.x, ay + p.y, 0, p.s, lpColour(p, PIG.mauve, i), p.a, p.kind < 2 ? 0.15 : 0.1))
  for (let i = 0; i < 400; i++) {
    const a = r() * Math.PI * 2, rr = 0.13 * Math.sqrt(r())
    inkDot(pl, r, fx + Math.cos(a) * rr, fy + Math.sin(a) * rr)
  }
  const fb = new FB()
  put(fb, pl, Math.min(pl.n, N), 'none')
  return finish(fb, 'x', seed)
}

/* ============================================== 4 · EXON SHUFFLING (18.14)
   The gene for TPA (tissue plasminogen activator) is assembled from exons
   borrowed from three other genes: a fibronectin finger (F), an epidermal
   growth factor exon (EGF), and a plasminogen kringle (K) that was then
   duplicated (K, K) — followed by the protease region. 'exon-src' draws the
   three source genes; in 'tpa' the moved exons' particles form the TPA gene,
   the kringle's particles splitting between the two K boxes. */
const EXH = { hw: 0.85, hh: 0.5 }
type ExonKind = 'EGF' | 'F' | 'K'
const SRC_LAYOUT: Record<ExonKind, { y: number; xs: number[]; pick: number }> = {
  EGF: { y: 5, xs: [-7.5, -3.5, 0.5, 4.5], pick: 1 },
  F: { y: 0, xs: [-6, -1, 4], pick: 1 },
  K: { y: -5, xs: [-2], pick: 0 },
}
const TPA_Y = -1
const TPA_BOXES = (() => {
  const out: { kind: string; x: number; y: number; hw: number; hh: number }[] = []
  let x = -8.1
  for (const k of TPA.tpa) {
    const hw = k === 'protease' ? 3.1 : EXH.hw
    out.push({ kind: k, x: x + hw, y: TPA_Y, hw, hh: EXH.hh })
    x += 2 * hw + 0.8
  }
  return out
})()
export const EXON = {
  sources: TPA.sources.map((s) => {
    const L = SRC_LAYOUT[s.exon as ExonKind]
    return { gene: s.gene, exon: s.exon, color: s.color, y: L.y, exons: L.xs.map((x, i) => ({ x, y: L.y, moved: i === L.pick })) }
  }),
  tpa: { y: TPA_Y, boxes: TPA_BOXES.map((b) => ({ kind: b.kind, x: b.x, y: b.y, w: b.hw * 2, h: b.hh * 2 })) },
  box: [EXH.hw * 2, EXH.hh * 2] as P2,
  x0: -11,
  x1: 11,
}
function lineWithGaps(y: number, boxes: { x: number; hw: number }[]) {
  const p = new Path()
  let x = EXON.x0
  for (const b of [...boxes].sort((a, c) => a.x - c.x)) {
    p.add([[x, y], [b.x - b.hw - 0.05, y]])
    x = b.x + b.hw + 0.05
  }
  p.add([[x, y], [EXON.x1, y]])
  return p
}
export function exonForms(seed = 14) {
  const r = rng(seed)
  const fs = new FB(), ftp = new FB()
  const z = () => (r() - 0.5) * 0.04
  const colOf = (k: string) => hex(TPA.sources.find((s) => s.exon === k)!.color)
  const tpaBox = (k: string, nth = 0) => TPA_BOXES.filter((b) => b.kind === k)[nth]
  const prot = tpaBox('protease')
  const unused: { x: number; y: number; kind: ExonKind }[] = []
  const one = () => geneBox(r, EXH.hw, EXH.hh, 1500, 700, 2600, 250)
  for (const kind of ['EGF', 'F', 'K'] as ExonKind[]) {
    const L = SRC_LAYOUT[kind]
    L.xs.forEach((x, i) => {
      if (i !== L.pick) return unused.push({ x, y: L.y, kind })
      const col = colOf(kind)
      const dests = kind === 'K' ? [tpaBox('K', 0), tpaBox('K', 1)] : [tpaBox(kind)]
      dests.forEach((d, u) => {
        // the second kringle is born inside the first: invisible in the source gene
        one().forEach((p, j) => {
          const c = lpColour(p, col, j), zz = z()
          fs.add(x + p.x, L.y + p.y, zz, p.s, c, u === 0 ? p.a : 0, 0, 0, 1, 0.15)
          ftp.add(d.x + p.x, d.y + p.y, zz, p.s, c, p.a, 0, 0, 1, 0.15)
        })
      })
    })
  }
  // exons that stay behind become the protease region (outline around it, hatch and wash inside)
  const protCol = PIG.greyViolet
  const per = 4 * (prot.hw + prot.hh)
  unused.forEach((ex, i) => {
    const col = colOf(ex.kind)
    one().forEach((p, j) => {
      const zz = z()
      let px: number, py: number
      if (p.kind === 0) {
        let t = ((i + p.t) / unused.length) * per
        const off = rrect(p.x, p.y, EXH.hw, EXH.hh, 0)
        if (t < 2 * prot.hw) ((px = -prot.hw + t), (py = prot.hh + off))
        else if ((t -= 2 * prot.hw) < 2 * prot.hh) ((px = prot.hw + off), (py = prot.hh - t))
        else if ((t -= 2 * prot.hh) < 2 * prot.hw) ((px = prot.hw - t), (py = -prot.hh - off))
        else ((t -= 2 * prot.hw), (px = -prot.hw - off), (py = -prot.hh + t))
      } else if (p.kind === 2) {
        const m = 0.07
        px = -prot.hw - m + ((i + (p.x / (EXH.hw + m) + 1) / 2) / unused.length) * 2 * (prot.hw + m)
        py = p.y
      } else {
        px = -prot.hw + ((i + (p.x / EXH.hw + 1) / 2) / unused.length) * 2 * prot.hw
        py = p.y
      }
      let q = p
      if (p.kind === 2) {
        const e = Math.exp(-Math.abs(rrect(px, py, prot.hw, prot.hh, 0.05)) / 0.12)
        q = { ...p, e, a: 0.055 * (0.6 + 1.1 * e) * (0.7 + 0.5 * vn(px * 3, py * 3)) }
      }
      fs.add(ex.x + p.x, ex.y + p.y, zz, p.s, lpColour(p, col, j), p.a, 0, 0, 1, 0.15)
      ftp.add(prot.x + px, prot.y + py, zz, p.s, lpColour(q, protCol, j), q.a, 0, 0, 1, 0.15)
    })
  })
  // the introns: three source lines pour into the one TPA line (the surplus fades)
  const src = new Path()
  for (const kind of ['EGF', 'F', 'K'] as ExonKind[]) {
    const L = SRC_LAYOUT[kind]
    for (const q of lineWithGaps(L.y, L.xs.map((x) => ({ x, hw: EXH.hw }))).parts) src.add(q.p)
  }
  const dst = lineWithGaps(TPA_Y, TPA_BOXES)
  for (const y of [TPA_Y]) for (const x of [EXON.x0, EXON.x1]) dst.add([[x, y - 0.22], [x, y + 0.22]])
  const LN = 20000
  for (let j = 0; j < LN; j++) {
    const u = (j + r()) / LN
    const o = (r() - 0.5) * 2 * 0.03
    const [x0, y0, tx0, ty0] = src.at(u)
    const [x1, y1, tx1, ty1] = dst.at(u)
    const s = 0.035 + 0.025 * r(), c = j & 1 ? INK_A : INK_B, a = 0.82 + 0.13 * r(), zz = z()
    fs.add(x0 - ty0 * o, y0 + tx0 * o, zz, s, c, a, 0, 0, 1, 0.15)
    ftp.add(x1 - ty1 * o, y1 + tx1 * o, zz, s, c, j % 3 === 0 ? a : 0, 0, 0, 1, 0.15)
  }
  return finishLinked([fs, ftp], 'x', 0, seed)
}

/* ====================================== 5 · THE THREE DOMAINS (18.15)
   Comparisons of genomes place all life on one tree: from the most recent
   common ancestor of all living things, some 4 billion years ago, Bacteria
   split off first; Archaea and Eukarya are sister groups. Time runs left to
   right, 4 → 0 billion years ago (the split within 2–4 billion years ago,
   the window the book gives). The Eukarya branch runs on to mouse, human and
   chimpanzee — drawn to scale, so their divergences (≈ 80 and ≈ 6 million
   years ago) crowd against the present. */
const xBya = (t: number) => 11.6 - 5.65 * t
export const TREE_LIFE = (() => {
  const [lo, hi] = DOMAINS_SPLIT_BYA
  const root: P2 = [xBya(hi), 0.4]
  const ae: P2 = [xBya(lo + 0.8), -1.6]
  return {
    root,
    /** Archaea–Eukarya split */
    aeSplit: ae,
    bacteria: [xBya(3.4), 5.2] as P2,
    archaea: [xBya(2.2), 0.8] as P2,
    eukarya: [xBya(2.0), -3.2] as P2,
    crowns: { bacteria: [2.8, 7.6] as P2, archaea: [-0.6, 1.9] as P2, eukarya: [-4.6, -1.6] as P2 },
    mhSplit: [xBya(0.08), -5.6] as P2,
    hcSplit: [xBya(0.006), -6.18] as P2,
    tips: { mouse: [xBya(0), -5.1] as P2, human: [xBya(0), -5.85] as P2, chimpanzee: [xBya(0), -6.5] as P2 },
    axis: { y: -7.6, x0: xBya(4), x1: xBya(0), ticks: [4, 3, 2, 1, 0].map((bya) => ({ bya, x: xBya(bya) })) },
  }
})()
function crown(p: Path, tips: P2[], x: number, y: number, y0: number, y1: number, depth: number, r: () => number, xEnd: number) {
  const w = 0.35 + 0.13 * depth
  if (depth === 0 || xEnd - x < 0.5) {
    p.add([[x, y], [xEnd, y]], w)
    tips.push([xEnd, y])
    return
  }
  const xs = x + (xEnd - x) * (0.12 + 0.3 * r())
  p.add([[x, y], [xs, y]], w)
  const ym = (y0 + y1) / 2 + (r() - 0.5) * (y1 - y0) * 0.2
  const kids: [number, number, number][] = [
    [(ym + y1) / 2, ym, y1],
    [(y0 + ym) / 2, y0, ym],
  ]
  for (const [yc, a, b] of kids) {
    const dx = Math.min(0.9, (xEnd - xs) * 0.35)
    p.add(sCurve([xs, y], [xs + dx, yc], 10), w * 0.9)
    crown(p, tips, xs + dx, yc, a, b, depth - 1, r, xEnd)
  }
}
export function treeLifeForm(seed = 15) {
  const r = rng(seed)
  const pl = new PL()
  const T = TREE_LIFE
  const X1 = T.axis.x1
  const trunk = new Path()
  trunk.add([[T.root[0] - 0.7, T.root[1]], T.root], 2.4)
  trunk.add(sCurve(T.root, T.bacteria, 16), 2)
  trunk.add(sCurve(T.root, T.aeSplit, 16), 2.2)
  trunk.add(sCurve(T.aeSplit, T.archaea, 14), 1.8)
  trunk.add(sCurve(T.aeSplit, T.eukarya, 14), 1.9)
  // the lineage leading to the three mammals
  trunk.add(sCurve(T.eukarya, [xBya(0.6), -5.6], 20), 1.2)
  trunk.add([[xBya(0.6), -5.6], T.mhSplit], 1.1)
  trunk.add(sCurve(T.mhSplit, T.tips.mouse, 6), 1)
  trunk.add(sCurve(T.mhSplit, T.hcSplit, 6), 1)
  trunk.add([[T.hcSplit[0], T.tips.human[1]], [T.hcSplit[0], T.tips.chimpanzee[1]]], 0.9)
  trunk.add([[T.hcSplit[0], T.tips.human[1]], T.tips.human], 0.9)
  trunk.add([[T.hcSplit[0], T.tips.chimpanzee[1]], T.tips.chimpanzee], 0.9)
  const doms: [Path, P2[], RGB][] = []
  const spec: [P2, P2, number][] = [
    [T.bacteria, T.crowns.bacteria, 6],
    [T.archaea, T.crowns.archaea, 5],
    [T.eukarya, T.crowns.eukarya, 6],
  ]
  const cols = [PIG.teal, PIG.amber, PIG.rose]
  spec.forEach(([st, [y0, y1], depth], i) => {
    const p = new Path(), tips: P2[] = []
    p.add(sCurve(st, [st[0] + 0.8, (y0 + y1) / 2], 8), 1.4)
    crown(p, tips, st[0] + 0.8, (y0 + y1) / 2, y0, y1, depth, r, X1)
    doms.push([p, tips, cols[i]])
  })
  const [nTrunk, nCrown, nWash, nTips, nAxis] = share([12, 50, 36, 4, 3])
  stroke(pl, nTrunk, trunk, r, 0.03)
  const crownTot = doms.reduce((s, d) => s + d[0].total, 0)
  for (const [p] of doms) stroke(pl, Math.floor((nCrown * p.total) / crownTot), p, r, 0.028)
  // washes follow each domain's crown, soft and bleeding
  const nWd = share([1.1, 0.8, 1.1], nWash)
  doms.forEach(([p, , col], i) => {
    for (let j = 0; j < nWd[i]; j++) {
      const [x, y] = p.at(r())
      const px = x + gauss(r) * 0.28, py = y + gauss(r) * 0.34
      const e = Math.exp(-Math.abs(py - y) / 0.2)
      pl.push(px, py, -0.01, 0.15 + 0.15 * r(), mixc(col, scale(col, 0.78), e * 0.4), 0.085 * (0.7 + 0.5 * vn(px, py)), 0.1)
    }
  })
  // leaves of the crown: a dot of pigment at each living tip; three larger for the mammals
  const allTips = doms.flatMap(([, tips, col]) => tips.map((t) => [t, col] as [P2, RGB]))
  const nPer = Math.max(4, Math.floor((nTips * 0.8) / allTips.length))
  for (const [[x, y], col] of allTips)
    for (let k = 0; k < nPer; k++) {
      const a = r() * Math.PI * 2, rr = 0.07 * Math.sqrt(r())
      pl.push(x + 0.05 + Math.cos(a) * rr, y + Math.sin(a) * rr, 0, 0.04 + 0.02 * r(), scale(col, 0.85), 0.8, 0.2)
    }
  for (const t of [T.tips.mouse, T.tips.human, T.tips.chimpanzee, T.root])
    for (let k = 0; k < Math.floor(nTips * 0.05); k++) {
      const a = r() * Math.PI * 2, rr = 0.14 * Math.sqrt(r())
      inkDot(pl, r, t[0] + Math.cos(a) * rr, t[1] + Math.sin(a) * rr)
    }
  // the time axis (DOM labels 4 … 0 billion years ago)
  const ax = new Path()
  ax.add([[T.axis.x0, T.axis.y], [T.axis.x1, T.axis.y]], 1.2)
  for (let b = 0; b <= 4; b += 0.5) ax.add([[xBya(b), T.axis.y], [xBya(b), T.axis.y - (b % 1 ? 0.16 : 0.32)]], 1)
  stroke(pl, nAxis, ax, r, 0.03)
  const fb = new FB()
  put(fb, pl, Math.min(pl.n, N), 'none')
  return finish(fb, 'x', seed)
}

/* =============================================== 6 · HUMAN AND CHIMPANZEE
   The two genomes aligned: identical at almost every position. About 1.2%
   of positions differ by a single base (vermilion, joined by a tick), and
   insertions and deletions account for about 2.7% more (ink dashes where
   one genome has bases the other lacks). 252 columns, set as three blocks
   of 84 like lines of type. */
export const GLYPH: Record<'A' | 'C' | 'G' | 'T', Poly[]> = {
  A: [[[0, 0], [0.5, 1], [1, 0]], [[0.22, 0.42], [0.78, 0.42]]],
  T: [[[0, 1], [1, 1]], [[0.5, 1], [0.5, 0]]],
  C: [arcPts(0.55, 0.5, 0.5, 0.8, 5.48, 20)],
  G: [arcPts(0.55, 0.5, 0.5, 0.8, 5.6, 20), [[0.6, 0.42], [1.0, 0.42], [1.0, 0.12]]],
}
const GLYPH_PATH = Object.fromEntries(Object.entries(GLYPH).map(([k, ps]) => [k, ps.reduce((p, q) => p.add(q), new Path())])) as Record<'A' | 'C' | 'G' | 'T', Path>
/** set one letter of type: w × h at (cx, cy) */
export function glyph(pl: PL, count: number, b: 'A' | 'C' | 'G' | 'T', cx: number, cy: number, w: number, h: number, col: RGB, r: () => number, a = 0.9, size = 0.035) {
  const p = GLYPH_PATH[b]
  for (let i = 0; i < count; i++) {
    const [x, y, tx, ty] = p.at(r())
    const o = (r() - 0.5) * 0.09
    pl.push(cx + (x - 0.5 + -ty * o) * w, cy + (y - 0.5 + tx * o) * h, (r() - 0.5) * 0.02, size + 0.012 * r(), col, a, 0.15)
  }
}
const BASES = ['A', 'C', 'G', 'T'] as const
export const ALIGN = (() => {
  const per = 84, cols = per * 3, x0 = -12.3, dx = 24.6 / (per - 1)
  const blocks = [5.2, 0, -5.2].map((y, b) => ({ y, human: y + 0.85, chimp: y - 0.85, c0: b * per, c1: b * per + per - 1, x0, x1: x0 + (per - 1) * dx }))
  const nSub = Math.round((cols * HUMAN_CHIMP.snp) / 100)
  const nGap = Math.round((cols * HUMAN_CHIMP.indel) / 100)
  const subCols = Array.from({ length: nSub }, (_, i) => Math.round(((i + 0.3) * cols) / nSub) - 3)
  // indels: a deletion in chimp, an insertion (gap in human), another in chimp
  const lens = [Math.floor(nGap / 3), nGap - 2 * Math.floor(nGap / 3), Math.floor(nGap / 3)]
  const gapStarts = [40, 130, 205]
  const gaps = gapStarts.map((c0, i) => ({ row: (i === 1 ? 'human' : 'chimp') as 'human' | 'chimp', c0, c1: c0 + lens[i] - 1 }))
  const colX = (c: number) => x0 + (c % per) * dx
  const blockOf = (c: number) => blocks[Math.floor(c / per)]
  return {
    per,
    cols,
    dx,
    blocks,
    subs: subCols.map((c) => ({ col: c, x: colX(c), y: blockOf(c).y })),
    gaps: gaps.map((g) => ({ ...g, x0: colX(g.c0), x1: colX(g.c1), y: blockOf(g.c0)[g.row] })),
    colX,
    blockOf,
  }
})()
export function alignForm(seed = 16) {
  const r = rng(seed)
  const pl = new PL()
  const A = ALIGN
  const human: string[] = [], chimp: string[] = []
  const subSet = new Set(A.subs.map((s) => s.col))
  for (let c = 0; c < A.cols; c++) {
    const b = BASES[Math.floor(r() * 4)]
    human.push(b)
    chimp.push(subSet.has(c) ? BASES[(BASES.indexOf(b) + 1 + Math.floor(r() * 3)) % 4] : b)
  }
  for (const g of A.gaps) for (let c = g.c0; c <= g.c1; c++) (g.row === 'human' ? human : chimp)[c] = '-'
  const type = (b: string): RGB => mixc(BASE[b as 'A'], hex('#5a4a3a'), 0.45)
  const extra = A.subs.length * 400 + A.gaps.reduce((s, g) => s + (g.c1 - g.c0 + 1), 0) * 60
  const per = Math.floor((N * 0.97 - extra) / (A.cols * 2))
  const gw = 0.19, gh = 0.32
  for (let c = 0; c < A.cols; c++) {
    const B = A.blockOf(c), x = A.colX(c)
    const sub = subSet.has(c)
    for (const [row, seq] of [
      [B.human, human],
      [B.chimp, chimp],
    ] as [number, string[]][]) {
      const b = seq[c]
      if (b === '-') {
        // a gap: the typesetter's dash
        stroke(pl, per, [[x - A.dx * 0.5, row], [x + A.dx * 0.5, row]], r, 0.018)
        continue
      }
      glyph(pl, per, b as 'A', x, row, sub ? gw * 1.12 : gw, sub ? gh * 1.12 : gh, sub ? PIG.vermilion : type(b), r, sub ? 0.95 : 0.88, sub ? 0.042 : 0.034)
    }
    if (sub) stroke(pl, 400, [[x, B.chimp + gh * 0.72], [x, B.human - gh * 0.72]], r, 0.02)
  }
  const fb = new FB()
  put(fb, pl, Math.min(pl.n, N), 'none')
  return finish(fb, 'x', seed)
}

/* =========================================== 7 · FOXP2 IN MICE (18.16)
   Mouse pups with both copies of FOXP2 working (wild type), one copy
   disrupted (heterozygote) or both disrupted (homozygote). Separated from
   their mothers, pups whistle ultrasonically: the wild type many times, the
   heterozygote less, the homozygote not at all. Schematic: no numbers. */
export const FOXP2 = (() => {
  const Y = -1.5
  const pup = (X: number) => ({ at: [X, Y] as P2, mouth: [X + 2.85, Y + 0.15] as P2 })
  return { wt: pup(-8), het: pup(0), homo: pup(8), arcs: { wt: 6, het: 3, homo: 0 } }
})()
/* a newborn mouse lying on its belly: big head, tapered snout, closed eyes,
   ear pinna still folded flat, short splayed limbs, long thin tail */
function pupSDF(X: number, Y: number): SDF {
  const soft = smin(
    0.35,
    ell(X - 0.45, Y - 0.1, 1.75, 0.98, 0.1),
    cir(X + 1.35, Y + 0.25, 0.98),
    ell(X + 2.2, Y - 0.02, 0.62, 0.4, -0.42),
    cir(X - 1.7, Y - 0.2, 0.82),
    cap(X + 0.95, Y - 0.7, X + 1.55, Y - 1.02, 0.2, 0.12),
    cap(X - 1.35, Y - 0.72, X - 0.85, Y - 1.05, 0.26, 0.13),
  )
  const tail = umin(cap(X - 2.35, Y - 0.45, X - 3.05, Y - 0.98, 0.12, 0.08), cap(X - 3.05, Y - 0.98, X - 3.95, Y - 0.95, 0.08, 0.035))
  return umin(soft, tail)
}
export function foxp2Form(seed = 17) {
  const r = rng(seed)
  const pl = new PL()
  const [nE, nC, nW, nD, nS] = share([20, 4.5, 7, 0.8, 1.0])
  const pups: [P2, number][] = [
    [FOXP2.wt.at, FOXP2.arcs.wt],
    [FOXP2.het.at, FOXP2.arcs.het],
    [FOXP2.homo.at, FOXP2.arcs.homo],
  ]
  const perPup = (n: number) => Math.floor((n * 0.88) / 3)
  for (const [[X, Y], nArc] of pups) {
    const box: Box = [X - 4.05, Y - 1.25, X + 2.85, Y + 1.3]
    const f = bake(pupSDF(X, Y), grow(box, 0.5))
    engrave(pl, perPup(nE), f, box, r, { base: 0.04, edge: 0.45, shadow: 0.5, sw: 0.55, hatch: 0.5, freq: 7, amt: 0.45 })
    contour(pl, perPup(nC), f, box, r, 0.035)
    wash(pl, perPup(nW), f, box, r, PIG.pink, { alpha: 0.12, pig: 0.03 })
    // closed eye, folded ear, nostril, neck wrinkles, toes
    const det = new Path()
    det.add(arcPts(X + 1.75, Y + 0.5, 0.2, Math.PI + 0.4, 2 * Math.PI - 0.4, 10))
    det.add(arcPts(X + 1.0, Y + 0.72, 0.3, 0.2, 2.2, 12))
    det.add(arcPts(X + 0.45, Y + 0.25, 0.5, -0.6, 0.45, 8))
    for (const [tx, ty] of [
      [X + 1.58, Y - 1.05],
      [X - 0.8, Y - 1.1],
    ])
      for (let k = -1; k <= 1; k++) det.add([[tx + k * 0.08, ty + 0.04], [tx + 0.05 + k * 0.1, ty - 0.08]])
    stroke(pl, perPup(nD), det, r, 0.02)
    for (let k = 0; k < 120; k++) {
      const a = r() * Math.PI * 2, rr = 0.08 * Math.sqrt(r())
      inkDot(pl, r, X + 2.76 + Math.cos(a) * rr, Y - 0.12 + Math.sin(a) * rr)
    }
    // the engraver's cast shadow: horizontal hatching under the belly
    fill(perPup(nS), ell(X - 0.4, Y - 1.14, 2.7, 0.14), [X - 3.1, Y - 1.3, X + 2.3, Y - 1.0], r, (_x, y) => Math.pow(0.5 + 0.5 * Math.cos((2 * Math.PI * y) / 0.07), 6) * 0.7, (x, y) => inkDot(pl, r, x, y, 0.6, 0.03))
    // ultrasonic whistles: arcs from the mouth
    const [mx, my] = FOXP2.wt.mouth.map((v, i) => v + [X, Y][i] - FOXP2.wt.at[i]) as P2
    for (let i = 0; i < nArc; i++) {
      const R = 0.55 + i * 0.36
      stroke(pl, Math.round(900 + 260 * R), arcPts(mx, my, R, 0.3, 1.3, 20), r, 0.03, 0.95, [0.5, 1.0])
    }
  }
  const fb = new FB()
  put(fb, pl, Math.min(pl.n, N), 'none')
  return finish(fb, 'x', seed)
}

/* ============================================ 8 · VARIATION IN A SPECIES
   Fourteen human genomes, one per row: almost every position identical
   (ink dashes). In a few columns some genomes carry a different base — single
   nucleotide polymorphisms, coloured dots aligned in columns — and one genome
   carries a copy-number variant: a segment present twice, drawn as a raised
   block holding the extra copy. */
export const SNP = (() => {
  const rows = 14, pos = 64, x0 = -12.4, dx = 24.8 / (pos - 1)
  const ys = Array.from({ length: rows }, (_, i) => 6.5 - i)
  const snpCols = [5, 13, 22, 31, 36, 52, 59]
  const cnv = { row: 9, c0: 40, c1: 47 }
  const cx = (c: number) => x0 + c * dx
  return {
    rows: ys,
    x0,
    dx,
    snps: snpCols.map((c) => ({ col: c, x: cx(c) })),
    cnv: { ...cnv, y: ys[cnv.row], x0: cx(cnv.c0) - 0.2, x1: cx(cnv.c1) + 0.2, block: [(cx(cnv.c0) + cx(cnv.c1)) / 2, ys[cnv.row] + 0.5, cx(cnv.c1) - cx(cnv.c0) + 0.4, 0.5] as [number, number, number, number] },
    cx,
  }
})()
export function snpForm(seed = 19) {
  const r = rng(seed)
  const pl = new PL()
  const S = SNP
  const ref: string[] = Array.from({ length: 64 }, () => BASES[Math.floor(r() * 4)])
  const alt = new Map<number, { b: string; rows: Set<number> }>()
  for (const { col } of S.snps) {
    const rows = new Set<number>()
    const k = 3 + Math.floor(r() * 4)
    while (rows.size < k) rows.add(Math.floor(r() * S.rows.length))
    alt.set(col, { b: BASES[(BASES.indexOf(ref[col] as 'A') + 1 + Math.floor(r() * 3)) % 4], rows })
  }
  const [nDash, nDot, nCol, nCnv] = share([66, 14, 8, 6])
  const dashes = S.rows.length * 64
  const perDash = Math.floor(nDash / dashes)
  const altCount = [...alt.values()].reduce((s, a) => s + a.rows.size, 0)
  const perDot = Math.floor(nDot / altCount)
  S.rows.forEach((y, ri) => {
    for (let c = 0; c < 64; c++) {
      const x = S.cx(c)
      const a = alt.get(c)
      if (a && a.rows.has(ri)) {
        const col = BASE[a.b as 'A']
        for (let k = 0; k < perDot; k++) {
          const ang = r() * Math.PI * 2, rr = 0.14 * Math.sqrt(r())
          const halo = k % 5 === 0
          pl.push(x + Math.cos(ang) * rr * (halo ? 1.3 : 1), y + Math.sin(ang) * rr * (halo ? 1.3 : 1), 0, halo ? 0.12 : 0.045 + 0.02 * r(), halo ? col : scale(col, 0.9), halo ? 0.12 : 0.85, 0.2)
        }
        continue
      }
      stroke(pl, perDash, [[x, y - 0.14], [x, y + 0.14]], r, 0.014)
    }
  })
  // a faint wash down each SNP column, so the eye reads them as columns
  const perCol = Math.floor(nCol / S.snps.length)
  const top = S.rows[0] + 0.45, bot = S.rows[S.rows.length - 1] - 0.45
  for (const { x } of S.snps) wash(pl, perCol, sdBox(x, (top + bot) / 2, 0.16, (top - bot) / 2, 0.1), [x - 0.2, bot, x + 0.2, top], r, PIG.amber, { alpha: 0.05, pig: 0, bleed: 0.06 })
  // the copy-number variant: the duplicated segment raised as a block over its row
  const [bx, by, bw, bh] = S.cnv.block
  const blk = sdBox(bx, by, bw / 2, bh / 2, 0.06)
  const bbox: Box = [bx - bw / 2 - 0.1, by - bh / 2 - 0.1, bx + bw / 2 + 0.1, by + bh / 2 + 0.1]
  const [nO, nWsh, nIn, nH] = share([3, 3, 3, 1], nCnv)
  contour(pl, nO, blk, bbox, r, 0.03)
  wash(pl, nWsh, blk, bbox, r, PIG.ochre, { alpha: 0.09, pig: 0.03 })
  const inside = S.cnv.c1 - S.cnv.c0 + 1
  for (let c = S.cnv.c0; c <= S.cnv.c1; c++) stroke(pl, Math.floor(nIn / inside), [[S.cx(c), by - 0.11], [S.cx(c), by + 0.11]], r, 0.013)
  const hinge = new Path()
  hinge.add([[S.cnv.x0, S.cnv.y + 0.08], [S.cnv.x0, by - bh / 2]])
  hinge.add([[S.cnv.x1, S.cnv.y + 0.08], [S.cnv.x1, by - bh / 2]])
  hinge.add([[S.cnv.x0, S.cnv.y - 0.22], [S.cnv.x1, S.cnv.y - 0.22]])
  stroke(pl, nH, hinge, r, 0.02)
  const fb = new FB()
  put(fb, pl, Math.min(pl.n, N), 'none')
  return finish(fb, 'x', seed)
}

/* ================================================================ 9 · MOTES
   Dust in the lamplight: sparse warm motes in a deep volume, for the moments
   when solid molecular meshes take the stage. Most particles wait unseen. */
export function motesForm(seed = 91) {
  const fb = new FB()
  const r = rng(seed)
  const warm = hex('#fff1d6'), amber = hex('#ffd9a0')
  for (let i = 0; i < N; i++) {
    const vis = r() < 0.22
    const x = (r() * 2 - 1) * 20, y = (r() * 2 - 1) * 12, z = -25 + 33 * r()
    fb.add(x, y, z, vis ? 0.02 + 0.045 * r() : 0.03, mixc(warm, amber, r() * 0.5), vis ? 0.15 + 0.2 * r() : 0, 0, 0, 1, 0.2)
  }
  return finish(fb, 'x', seed)
}
