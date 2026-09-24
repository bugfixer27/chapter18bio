/* The elephant shark, Callorhinchus milii (Figure 18.1): not a true shark
   but a chimaera, a cartilaginous fish whose genome has changed more slowly
   than any other vertebrate's sequenced so far. Its shape lives here;
   the mesh and the swarm are both built from it (creature.ts):
   the hoe-shaped fleshy proboscis, big green eyes, a tall first dorsal fin
   with a spine, wing-like pectorals, a long second dorsal and an upturned
   tapering tail. Silver, with dark brown blotches along the upper flank. */
import { hex, mixc, type RGB } from './base'

const X0 = -10.2 // front of the head (the proboscis starts here)
const X1 = 13.2 // tail tip
const u = (x: number) => (x - X0) / (X1 - X0)
const ss = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** half-height, half-width and centre-line of the body at x */
export function bodyAt(x: number) {
  const t = u(x)
  const head = ss(0, 0.16, t)
  const tail = Math.max(0, (t - 0.16) / 0.84)
  const H = t < 0.16 ? 0.95 + 1.2 * head : 0.07 + 2.08 * Math.pow(1 - tail, 1.55)
  const W = H * (0.82 - 0.3 * t)
  const yc = 0.55 * ss(0.72, 1, t) - 0.15 * (1 - head)
  return { H, W, yc }
}

type Tri = [number, number, number][]

export type SharkPaint = (x: number, y: number, z: number, base: RGB, part: string) => RGB

export const SKIN = {
  silver: hex('#aeb8bc'),
  belly: hex('#f3f6f7'),
  bronze: hex('#5d5852'),
  blotch: hex('#3a2a1e'),
  fin: hex('#a9b3b6'),
  snout: hex('#bca99a'),
}
const SADDLES = [-5.2, -1.2, 2.6, 6.1]
/** skin colour at a body point; cy = cos of the angle round the body (1 = top) */
export function skinAt(x: number, y: number, cy: number) {
  const { yc, H } = bodyAt(x)
  let m = 0
  for (const s of SADDLES) m = Math.max(m, Math.exp(-Math.pow((x - s + 0.4 * Math.sin(y * 2.0)) / 1.1, 2)))
  const hi = ss(-0.7, 0.05, (y - yc) / Math.max(0.2, H))
  const noise = 0.5 + 0.5 * Math.sin(x * 3.1 + y * 5.7) * Math.sin(x * 1.7 - y * 2.3)
  const blot = Math.min(1, m * hi * (0.7 + 0.5 * noise))
  // countershaded: dark bronze back, silver flanks, white belly
  let c = mixc(SKIN.silver, SKIN.bronze, ss(0.25, 0.95, cy))
  c = mixc(c, SKIN.belly, ss(-0.2, -0.9, cy))
  c = mixc(c, SKIN.blotch, Math.min(1, blot * 1.15))
  if (Math.abs(cy - 0.15) < 0.035 && u(x) > 0.1) c = mixc(c, SKIN.blotch, 0.35)
  return c
}

/* Fins as swept surfaces: a root chord along the body, a span vector out to
   the tip, a sweep that slides the tip back, and a chord that narrows and
   rounds toward the tip. u runs leading → trailing edge, v root → tip. */
export type Fin = {
  root: (u: number) => [number, number, number]
  span: [number, number, number]
  sweep: number
  tip: number
  thick: number
  c: RGB
  part: string
  /** the leading edge carries a spine (first dorsal) */
  spine?: boolean
}
export function finPoint(f: Fin, u: number, v: number): [number, number, number] {
  const chord = 1 - (1 - f.tip) * Math.pow(v, 1.4)
  // round the tip: the chord collapses on a circle over the last 15%
  const round = v > 0.85 ? Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.85) / 0.15, 2))) : 1
  const uu = f.sweep * Math.pow(v, 1.2) + u * chord * round + (1 - round) * 0.5 * chord
  const [rx, ry, rz] = f.root(Math.min(1, uu))
  const extra = Math.max(0, uu - 1)
  const [x1] = f.root(1)
  const [x0] = f.root(0)
  return [rx + extra * (x1 - x0) + f.span[0] * v, ry + f.span[1] * v, rz + f.span[2] * v]
}
export function sharkFins() {
  const fins: Fin[] = []
  const top = (x: number) => {
    const b = bodyAt(x)
    return b.yc + b.H - 0.06
  }
  const bot = (x: number) => {
    const b = bodyAt(x)
    return b.yc - b.H * 0.82 + 0.08
  }
  const side = (x: number, y: number, s: number) => {
    const b = bodyAt(x)
    const k = Math.max(0, 1 - Math.pow((y - b.yc) / b.H, 2))
    return s * b.W * Math.sqrt(k) * 0.95
  }
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const C = SKIN.fin
  for (const sgn of [1, -1]) {
    fins.push({ root: (u) => { const x = lerp(-7.0, -4.2, u), y = -0.75; return [x, y, side(x, y, sgn)] }, span: [2.6, -1.6, sgn * 4.4], sweep: 0.55, tip: 0.12, thick: 0.07, c: C, part: 'pectoral' })
    fins.push({ root: (u) => { const x = lerp(0.4, 2.9, u), y = bot(x) + 0.25; return [x, y, side(x, y, sgn)] }, span: [1.0, -1.25, sgn * 1.0], sweep: 0.55, tip: 0.18, thick: 0.05, c: C, part: 'pelvic' })
  }
  fins.push({ root: (u) => { const x = lerp(-6.1, -3.6, u); return [x, top(x), 0] }, span: [0.7, 3.3, 0], sweep: 0.2, tip: 0.07, thick: 0.07, c: C, part: 'dorsal1', spine: true })
  fins.push({ root: (u) => { const x = lerp(-1.4, 6.9, u); return [x, top(x), 0] }, span: [0.3, 0.95, 0], sweep: 0.08, tip: 0.6, thick: 0.05, c: C, part: 'dorsal2' })
  fins.push({ root: (u) => { const x = lerp(6.0, 12.9, u); return [x, bot(x), 0] }, span: [1.6, -1.25, 0], sweep: 0.28, tip: 0.35, thick: 0.045, c: C, part: 'caudal' })
  fins.push({ root: (u) => { const x = lerp(8.6, 13.1, u); return [x, top(x), 0] }, span: [0.4, 0.4, 0], sweep: 0.2, tip: 0.5, thick: 0.03, c: C, part: 'caudal' })
  return fins
}
/** the proboscis centre-line: a quadratic curve forward and down, s ∈ [0, 1] */
export function snoutAt(s: number): [number, number, number] {
  const bx = (1 - s) * (1 - s) * (X0 + 0.2) + 2 * (1 - s) * s * (X0 - 1.9) + s * s * (X0 - 2.3)
  const by = (1 - s) * (1 - s) * -0.1 + 2 * (1 - s) * s * 0.25 + s * s * -1.9
  return [bx, by, 0.42 - 0.2 * s]
}
export const EYE = { x: -8.55, y: 0.45, r: 0.5 }
export const SHARK_X = [X0, X1] as const
