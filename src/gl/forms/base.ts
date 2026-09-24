/* Tools for building forms: a buffer of N particles, seeded randomness,
   colour helpers, surface and region samplers, and the final sort that makes
   morphs flow instead of scatter. */
import { N } from '../swarm'

export type RGB = [number, number, number]
export const hex = (h: string): RGB => {
  const v = parseInt(h.replace('#', ''), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
export const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k]

/* the film's shared palette */
export const BASE: Record<'A' | 'T' | 'C' | 'G', RGB> = {
  A: hex('#16c784'),
  T: hex('#ff4b5c'),
  C: hex('#2f7bff'),
  G: hex('#ffb31a'),
}
export const INK = hex('#2b2118')
export const SEPIA = hex('#5a4330')

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const gauss = (r: () => number) => {
  const u = Math.max(1e-9, r())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

export type Order = 'x' | 'y' | 'r' | 'none' | 'shuffle' | ((x: number, y: number, z: number, i: number) => number)

export class FB {
  pos = new Float32Array(N * 4)
  col = new Uint8Array(N * 4)
  /** surface normal (xyz, packed 0..255) and material: w = gloss 0..1 (emissive above 0.9) */
  nrm = new Uint8Array(N * 4)
  n = 0
  get left() {
    return N - this.n
  }
  add(x: number, y: number, z: number, size: number, c: RGB, a = 1, nx = 0, ny = 0, nz = 1, gloss = 0.3) {
    if (this.n >= N) return false
    const i = this.n++ * 4
    const nl = Math.hypot(nx, ny, nz) || 1
    this.nrm[i] = (nx / nl) * 127.5 + 127.5
    this.nrm[i + 1] = (ny / nl) * 127.5 + 127.5
    this.nrm[i + 2] = (nz / nl) * 127.5 + 127.5
    this.nrm[i + 3] = Math.max(0, Math.min(255, gloss * 255))
    this.pos[i] = x
    this.pos[i + 1] = y
    this.pos[i + 2] = z
    this.pos[i + 3] = size
    this.col[i] = Math.max(0, Math.min(255, c[0] * 255))
    this.col[i + 1] = Math.max(0, Math.min(255, c[1] * 255))
    this.col[i + 2] = Math.max(0, Math.min(255, c[2] * 255))
    this.col[i + 3] = Math.max(0, Math.min(255, a * 255))
    return true
  }
  /** pad to N with invisible copies of existing points (they fade in place) */
  pad(seed = 7) {
    const r = rng(seed)
    const m = Math.max(1, this.n)
    while (this.n < N) {
      const j = Math.floor(r() * m) * 4
      const i = this.n++ * 4
      this.pos[i] = this.pos[j]
      this.pos[i + 1] = this.pos[j + 1]
      this.pos[i + 2] = this.pos[j + 2]
      this.pos[i + 3] = this.pos[j + 3]
      this.col[i] = this.col[j]
      this.col[i + 1] = this.col[j + 1]
      this.col[i + 2] = this.col[j + 2]
      this.col[i + 3] = 0
      this.nrm.copyWithin(i, j, j + 4)
    }
  }
}

function keyOf(fb: FB, order: Order, seed: number) {
  const k = new Float32Array(N)
  const r = rng(seed)
  for (let i = 0; i < N; i++) {
    const x = fb.pos[i * 4], y = fb.pos[i * 4 + 1], z = fb.pos[i * 4 + 2]
    if (order === 'x') k[i] = x + y * 0.002
    else if (order === 'y') k[i] = y + x * 0.002
    else if (order === 'r') k[i] = Math.hypot(x, y, z)
    else if (order === 'shuffle') k[i] = r()
    else if (order === 'none') k[i] = i
    else k[i] = order(x, y, z, i)
  }
  return k
}

function permute(fb: FB, idx: Uint32Array) {
  const p = new Float32Array(N * 4)
  const c = new Uint8Array(N * 4)
  const m = new Uint8Array(N * 4)
  for (let i = 0; i < N; i++) {
    const j = idx[i] * 4
    p.set(fb.pos.subarray(j, j + 4), i * 4)
    c.set(fb.col.subarray(j, j + 4), i * 4)
    m.set(fb.nrm.subarray(j, j + 4), i * 4)
  }
  fb.pos = p
  fb.col = c
  fb.nrm = m
}

/* argsort without a comparator: rank each key into 32 bits, pack rank and
   index into one exactly-representable double, and let the engine's native
   numeric sort do the work (an order of magnitude faster than idx.sort(cmp)) */
function argsort(k: Float32Array) {
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < N; i++) {
    const v = k[i]
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const sc = hi > lo ? 4294967295 / (hi - lo) : 0
  const packed = new Float64Array(N)
  for (let i = 0; i < N; i++) packed[i] = Math.floor((k[i] - lo) * sc) * 262144 + i
  packed.sort()
  const idx = new Uint32Array(N)
  for (let i = 0; i < N; i++) idx[i] = packed[i] % 262144
  return idx
}

/** sort a form's particles along an axis so morphs between forms flow */
export function finish(fb: FB, order: Order = 'x', seed = 1) {
  fb.pad(seed)
  if (order === 'none') return fb
  permute(fb, argsort(keyOf(fb, order, seed)))
  return fb
}

/** forms built in lockstep (particle i is the same thing in each): one permutation for all */
export function finishLinked(fbs: FB[], order: Order, from = 0, seed = 1) {
  for (const f of fbs) f.pad(seed)
  const idx = argsort(keyOf(fbs[from], order, seed))
  for (const f of fbs) permute(f, idx)
  return fbs
}

/** split N particles between parts in proportion to weights */
export function share(weights: number[], total = N) {
  const s = weights.reduce((a, b) => a + b, 0)
  const out = weights.map((w) => Math.floor((w / s) * total))
  let rest = total - out.reduce((a, b) => a + b, 0)
  for (let i = 0; rest > 0; i = (i + 1) % out.length, rest--) out[i]++
  return out
}

/* ---------------------------------------------------------------- 2-D SDFs
   The notebook's drawings are signed-distance shapes in the page plane,
   stippled: dots fall densest where the engraving is darkest. */
export type SDF = (x: number, y: number) => number
export const sdCircle = (cx: number, cy: number, r: number): SDF => (x, y) => Math.hypot(x - cx, y - cy) - r
export const sdEllipse = (cx: number, cy: number, rx: number, ry: number, rot = 0): SDF => {
  const c = Math.cos(rot), s = Math.sin(rot)
  return (x, y) => {
    const dx = x - cx, dy = y - cy
    const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry
    const k = Math.hypot(u, v)
    return (k - 1) * Math.min(rx, ry)
  }
}
export const sdCapsule = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): SDF => (x, y) => {
  const px = x - ax, py = y - ay, bax = bx - ax, bay = by - ay
  const h = Math.max(0, Math.min(1, (px * bax + py * bay) / (bax * bax + bay * bay)))
  return Math.hypot(px - bax * h, py - bay * h) - (ra + (rb - ra) * h)
}
export const sdPoly = (pts: [number, number][]): SDF => (x, y) => {
  let d = Infinity, s = 1
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    const ex = xj - xi, ey = yj - yi, wx = x - xi, wy = y - yi
    const h = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
    d = Math.min(d, Math.hypot(wx - ex * h, wy - ey * h))
    const c1 = yi <= y, c2 = yj > y, c3 = ex * wy > ey * wx
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s
  }
  return s * d
}
export const union = (...f: SDF[]): SDF => (x, y) => {
  let d = Infinity
  for (const g of f) d = Math.min(d, g(x, y))
  return d
}
export const smoothUnion = (k: number, ...f: SDF[]): SDF => (x, y) => {
  let d = f[0](x, y)
  for (let i = 1; i < f.length; i++) {
    const e = f[i](x, y)
    const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (e - d)) / k))
    d = e + (d - e) * h - k * h * (1 - h)
  }
  return d
}
export const subtract = (a: SDF, b: SDF): SDF => (x, y) => Math.max(a(x, y), -b(x, y))

/** stipple the inside of a shape; density(x, y, d) ∈ [0, 1] */
export function stipple(
  fb: FB,
  count: number,
  f: SDF,
  box: [number, number, number, number],
  r: () => number,
  paint: (x: number, y: number, d: number) => { c: RGB; a: number; s: number; z?: number } | null,
  density: (x: number, y: number, d: number) => number = () => 1,
) {
  const [x0, y0, x1, y1] = box
  let made = 0, tries = 0
  while (made < count && tries < count * 60) {
    tries++
    const x = x0 + (x1 - x0) * r(), y = y0 + (y1 - y0) * r()
    const d = f(x, y)
    if (d > 0) continue
    if (r() > density(x, y, d)) continue
    const p = paint(x, y, d)
    if (!p) continue
    fb.add(x, y, p.z ?? 0, p.s, p.c, p.a)
    made++
  }
  return made
}

/** dots along the outline of a shape: the engraver's contour line */
export function outline(fb: FB, count: number, f: SDF, box: [number, number, number, number], r: () => number, c: RGB, a: number, s: number, w = 0.05) {
  const [x0, y0, x1, y1] = box
  let made = 0, tries = 0
  while (made < count && tries < count * 400) {
    tries++
    const x = x0 + (x1 - x0) * r(), y = y0 + (y1 - y0) * r()
    if (Math.abs(f(x, y)) > w) continue
    fb.add(x, y, 0, s, c, a)
    made++
  }
  return made
}

/** light an SDF shape like an engraving: normal from the gradient, light from the top-left */
export function shade(f: SDF, x: number, y: number, d: number, depth = 0.6) {
  const e = 0.02
  const gx = f(x + e, y) - f(x - e, y), gy = f(x, y + e) - f(x, y - e)
  const gl = Math.hypot(gx, gy) || 1
  // pretend the shape is a pillow: normal leans out near the edge
  const rim = Math.min(1, Math.max(0, -d / depth))
  const nz = rim
  const nx = (-gx / gl) * (1 - rim) * -1, ny = (-gy / gl) * (1 - rim) * -1
  const l = Math.max(0, nx * -0.5 + ny * 0.6 + nz * 0.62)
  return Math.min(1, l)
}
