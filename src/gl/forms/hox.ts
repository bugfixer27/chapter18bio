/* ==========================================================================
   HOX GENES, IN THE NOTEBOOK (Figures 18.17, 18.18) — and a guest, Ciona
   The homeotic genes of a fruit fly and a mouse, drawn as plates. Colour
   carries identity: the same colour = homologous genes (FLY_HOX). Every
   coloured particle belongs to one Hox gene for its whole life:
     chromosome box  →  its domain in the embryo  →  its region of the adult
   and in the mouse, the particles of the fly's genes wash over the mouse's
   paralog groups that match them. Ink is a separate shared pool that simply
   redraws itself from one engraving to the next.
   Figure 18.18: in a brine shrimp four Hox genes overlap across the whole
   thorax (every thoracic segment alike, each with swimming legs); in a
   grasshopper the same genes have separate domains, and in the abdomen Ubx
   and abd-A suppress legs.
   ========================================================================== */
import { FB, hex, mixc, scale, rng, gauss, finish, finishLinked, share, sdPoly, type RGB, type SDF } from './base'
import { N } from '../swarm'
import { FLY_HOX, CIONA } from '../../science/genomes'
import {
  PL, put, inkDot, fill, engrave, contour, wash, stroke, bez, arcPts, sdBox, strip, bake, cheap, grow, cir, ell, cap, smin, umin, boxOf, ss, clamp01, PIG, Path,
  type P2, type Box, type Poly,
} from './notebook'

/* ------------------------------------------------------------ colour pools */
const HOX_COL: RGB[] = FLY_HOX.map((h) => hex(h.color))
/** paralog group 3 has no fly counterpart: a paler Dfd teal */
const G3_COL = mixc(hex(FLY_HOX[2].color), hex('#ffffff'), 0.45)
const POOLS: RGB[] = [...HOX_COL, G3_COL]
const G3 = 8
/** mouse paralog group (1–13) → colour pool: 1 lab, 2 pb, 3 (none), 4 Dfd, 5 Scr, 6 Antp, 7 Ubx, 8 abd-A, 9–13 Abd-B.
    Groups 6–8 match the fly's central genes (Antp, Ubx, abd-A) as a group; their one-to-one pairing is schematic. */
export const GROUP_POOL = [-1, 0, 1, G3, 2, 3, 4, 5, 6, 7, 7, 7, 7, 7]

/* ------------------------------------------------------------ the engine
   A sheet is one drawing: colour domains (per pool: shapes to wash) and an
   ink routine. Each pool gets as many particles as its most demanding sheet
   needs; in the others the surplus waits, transparent, inside the domain. */
type Part = { f: SDF; box: Box }
type Domain = { k: number; parts: Part[]; dens?: (x: number, y: number) => number }
type Sheet = { domains: Domain[]; ink: (pl: PL, n: number, r: () => number) => void; fallback: P2; /** wash strength for this plate */ alpha?: number }

function partArea(p: Part, r: () => number, dens?: (x: number, y: number) => number) {
  const [x0, y0, x1, y1] = p.box
  let s = 0
  const M = 1500
  for (let i = 0; i < M; i++) {
    const x = x0 + (x1 - x0) * r(), y = y0 + (y1 - y0) * r()
    if (p.f(x, y) < 0) s += dens ? dens(x, y) : 1
  }
  return (s / M) * (x1 - x0) * (y1 - y0)
}

function linkedSheets(sheets: Sheet[], pools: RGB[], seed: number, perForm = 30000, poolMax = 48000, maxDens = 650) {
  const K = pools.length
  const r = rng(seed)
  const areas = sheets.map((sh) => sh.domains.map((d) => d.parts.map((p) => partArea(p, r, d.dens))))
  const A = sheets.map((sh, fi) => {
    const a = new Array<number>(K).fill(0)
    sh.domains.forEach((d, di) => areas[fi][di].forEach((v) => (a[d.k] += v)))
    return a
  })
  let V = A.map((a) => {
    const tot = a.reduce((s, v) => s + v, 0) || 1
    return a.map((v) => Math.min((perForm * v) / tot, maxDens * v))
  })
  const P0 = Array.from({ length: K }, (_, k) => Math.max(...V.map((v) => v[k])))
  const sum = P0.reduce((s, v) => s + v, 0)
  const f = sum > poolMax ? poolMax / sum : 1
  const P = P0.map((p) => Math.ceil(p * f))
  V = V.map((v) => v.map((x) => Math.floor(x * f)))
  const ink = N - P.reduce((s, v) => s + v, 0)
  const fbs = sheets.map(() => new FB())
  sheets.forEach((sh, fi) => {
    const rr = rng(seed * 31 + fi * 7)
    const aTot = A[fi].reduce((s, v) => s + v, 0) || 1, vTot = V[fi].reduce((s, v) => s + v, 0)
    // crowded colour is washed thinner, so every plate reads as the same watercolour
    const amul = Math.max(0.6, Math.min(1.2, 420 / Math.max(1, vTot / aTot))) * (sh.alpha ?? 1)
    for (let k = 0; k < K; k++) {
      const pl = new PL()
      const parts: { p: Part; dens?: (x: number, y: number) => number; a: number }[] = []
      sh.domains.forEach((d, di) => {
        if (d.k === k) d.parts.forEach((p, pi) => parts.push({ p, dens: d.dens, a: areas[fi][di][pi] }))
      })
      if (!parts.length || V[fi][k] <= 0) {
        for (let i = 0; i < P[k]; i++) pl.push(sh.fallback[0] + gauss(rr) * 0.5, sh.fallback[1] + gauss(rr) * 0.3, 0, 0.12, pools[k], 0, 0.1)
      } else {
        const cnt = share(parts.map((q) => q.a + 1e-6), P[k])
        parts.forEach((q, i) => wash(pl, cnt[i], q.p.f, q.p.box, rr, pools[k], { alpha: 0.14 * amul, pig: 0.14, dens: q.dens, bleed: 0.08 }))
        pl.thin(V[fi][k], rr)
      }
      put(fbs[fi], pl, P[k], 'x', seed + k)
    }
    const ip = new PL()
    sh.ink(ip, ink, rr)
    put(fbs[fi], ip, ink, 'x', seed + 99)
  })
  return fbs
}

/* ------------------------------------------------------------ shape helpers */
const chain = (pts: P2[], rad: number[]): SDF => umin(...pts.slice(0, -1).map((p, i) => cap(p[0], p[1], pts[i + 1][0], pts[i + 1][1], rad[i], rad[i + 1])))
const sminv = (a: number, b: number, k: number) => {
  const h = clamp01(0.5 + (0.5 * (b - a)) / k)
  return b + (a - b) * h - k * h * (1 - h)
}
/** a tube along a polyline with varying radius: distance, and the arc-length fraction s of the nearest point */
function tubeField(pts: P2[], rad: number[]) {
  const n = pts.length
  const cum = [0]
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.sqrt((pts[i][0] - pts[i - 1][0]) ** 2 + (pts[i][1] - pts[i - 1][1]) ** 2))
  const L = cum[n - 1]
  let lastS = 0
  const d = (x: number, y: number) => {
    let best = 1e9, bs = 0
    for (let i = 0; i < n - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0] - ax, by = pts[i + 1][1] - ay
      const px = x - ax, py = y - ay
      let h = (px * bx + py * by) / (bx * bx + by * by)
      h = h < 0 ? 0 : h > 1 ? 1 : h
      const qx = px - bx * h, qy = py - by * h
      const e = Math.sqrt(qx * qx + qy * qy) - (rad[i] + (rad[i + 1] - rad[i]) * h)
      if (e < best) ((best = e), (bs = (cum[i] + h * (cum[i + 1] - cum[i])) / L))
    }
    lastS = bs
    return best
  }
  return { d, s: () => lastS, L }
}
/** bake two fields over one grid (distance and a second scalar computed alongside it) */
function bake2(fn: (x: number, y: number) => [number, number], box: Box, c: number): [SDF, SDF] {
  const [x0, y0, x1, y1] = box
  const nx = Math.ceil((x1 - x0) / c) + 2, ny = Math.ceil((y1 - y0) / c) + 2
  const g0 = new Float32Array(nx * ny), g1 = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const [a, b] = fn(x0 + i * c, y0 + j * c)
      g0[j * nx + i] = a
      g1[j * nx + i] = b
    }
  const mk = (g: Float32Array, out: number): SDF => {
    const s = ((x: number, y: number) => {
      const fx = (x - x0) / c, fy = (y - y0) / c
      if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return out
      const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * nx + i
      const a = g[k] + (g[k + 1] - g[k]) * tx, b = g[k + nx] + (g[k + nx + 1] - g[k + nx]) * tx
      return a + (b - a) * ty
    }) as SDF & { baked?: boolean }
    s.baked = true
    return s
  }
  return [mk(g0, 1), mk(g1, 0)]
}
/** turn engraved dots into short hairs lying along dir(x, y) */
function furry(pl: PL, count: number, f: SDF, box: Box, r: () => number, dir: (x: number, y: number) => number, o: Parameters<typeof engrave>[5] = {}) {
  const tmp = new PL()
  engrave(tmp, Math.floor(count / 3), f, box, r, o)
  for (let i = 0; i < tmp.n; i++) {
    const a = dir(tmp.x[i], tmp.y[i]) + (r() - 0.5) * 0.4
    const ca = Math.cos(a) * 0.045, sa = Math.sin(a) * 0.045
    for (let j = 0; j < 3; j++) inkDot(pl, r, tmp.x[i] + ca * j, tmp.y[i] + sa * j, 0.95 - j * 0.1)
  }
}
/** a cast shadow the engraver's way: horizontal lines under the subject */
function groundShadow(pl: PL, count: number, cx: number, cy: number, rx: number, ry: number, r: () => number) {
  fill(count, ell(cx, cy, rx, ry), [cx - rx, cy - ry, cx + rx, cy + ry], r, (_x, y) => Math.pow(0.5 + 0.5 * Math.cos((2 * Math.PI * y) / 0.08), 6) * 0.7, (x, y) => inkDot(pl, r, x, y, 0.6, 0.03))
}
/** little tick marks across a polyline (segment joints, tail rings) */
function ticks(pl: PL, per: number, p: Poly, every: number, len: number, r: () => number, k = 1) {
  const path = new Path().add(p)
  const L = path.total
  for (let s = every; s < L; s += every) {
    const [x, y, tx, ty] = path.at(s / L)
    stroke(pl, per, [[x + ty * len, y - tx * len], [x - ty * len, y + tx * len]], r, 0.015, k)
  }
}

/* ======================================================= FLY CHROMOSOME */
const FLY_BOX = { hw: 1.0, hh: 0.65 }
export const FLY_CHROM = {
  y: 0,
  x0: -11.6,
  x1: 11.6,
  box: [FLY_BOX.hw * 2, FLY_BOX.hh * 2] as P2,
  genes: FLY_HOX.map((h, i) => ({ id: h.id, color: h.color, x: -9.8 + i * 2.8, y: 0 })),
}
function flyChromSheet(): Sheet {
  const boxes: Part[] = FLY_CHROM.genes.map((g) => ({ f: sdBox(g.x, 0, FLY_BOX.hw, FLY_BOX.hh, 0.1), box: [g.x - FLY_BOX.hw, -FLY_BOX.hh, g.x + FLY_BOX.hw, FLY_BOX.hh] as Box }))
  return {
    domains: boxes.map((p, k) => ({ k, parts: [p] })),
    fallback: [FLY_CHROM.genes[2].x, 0],
    alpha: 1.9,
    ink: (pl, _n, r) => {
      const line = new Path()
      let x = FLY_CHROM.x0
      for (const g of FLY_CHROM.genes) {
        line.add([[x, 0], [g.x - FLY_BOX.hw - 0.05, 0]])
        x = g.x + FLY_BOX.hw + 0.05
      }
      line.add([[x, 0], [FLY_CHROM.x1, 0]])
      for (const xe of [FLY_CHROM.x0, FLY_CHROM.x1]) line.add([[xe, -0.25], [xe, 0.25]])
      stroke(pl, 6000, line, r, 0.035)
      for (const p of boxes) {
        contour(pl, 1500, p.f, grow(p.box, 0.2), r, 0.035)
        engrave(pl, 700, p.f, p.box, r, { base: 0.02, edge: 0.35, ew: 0.12, shadow: 0.35, sw: 0.4, hatch: Math.PI / 4, freq: 6, amt: 0.9 })
      }
    },
  }
}

/* ======================================================= MOUSE CHROMOSOMES
   Four Hox clusters on four chromosomes (mouse: Hoxa on 6, Hoxb on 11, Hoxc
   on 15, Hoxd on 2), aligned by paralog group 1–13. Each cluster lacks some
   groups; the gaps follow the real mammalian pattern (39 genes). */
export const MOUSE_HOX = [
  { name: 'Hoxa', chromosome: 6, y: 4.5, groups: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13] },
  { name: 'Hoxb', chromosome: 11, y: 1.5, groups: [1, 2, 3, 4, 5, 6, 7, 8, 9, 13] },
  { name: 'Hoxc', chromosome: 15, y: -1.5, groups: [4, 5, 6, 8, 9, 10, 11, 12, 13] },
  { name: 'Hoxd', chromosome: 2, y: -4.5, groups: [1, 3, 4, 8, 9, 10, 11, 12, 13] },
]
const MBOX = { hw: 0.65, hh: 0.475 }
const mX = (g: number) => -10.8 + (g - 1) * 1.8
export const MOUSE_CHROM = {
  x0: -12,
  x1: 12,
  box: [MBOX.hw * 2, MBOX.hh * 2] as P2,
  columns: Array.from({ length: 13 }, (_, i) => ({ group: i + 1, x: mX(i + 1) })),
  clusters: MOUSE_HOX.map((c) => ({ ...c, genes: c.groups.map((g) => ({ group: g, x: mX(g), y: c.y, pool: GROUP_POOL[g] })) })),
}
function mouseChromSheet(): Sheet {
  const genes = MOUSE_CHROM.clusters.flatMap((c) => c.genes)
  const part = (g: (typeof genes)[number]): Part => ({ f: sdBox(g.x, g.y, MBOX.hw, MBOX.hh, 0.08), box: [g.x - MBOX.hw, g.y - MBOX.hh, g.x + MBOX.hw, g.y + MBOX.hh] })
  return {
    domains: POOLS.map((_, k) => ({ k, parts: genes.filter((g) => g.pool === k).map(part) })).filter((d) => d.parts.length),
    fallback: [0, 0],
    alpha: 1.9,
    ink: (pl, _n, r) => {
      for (const c of MOUSE_CHROM.clusters) {
        const line = new Path()
        let x = MOUSE_CHROM.x0
        for (const g of c.genes) {
          line.add([[x, c.y], [g.x - MBOX.hw - 0.04, c.y]])
          x = g.x + MBOX.hw + 0.04
        }
        line.add([[x, c.y], [MOUSE_CHROM.x1, c.y]])
        for (const xe of [MOUSE_CHROM.x0, MOUSE_CHROM.x1]) line.add([[xe, c.y - 0.22], [xe, c.y + 0.22]])
        stroke(pl, 2000, line, r, 0.032)
      }
      for (const g of genes) {
        const p = part(g)
        contour(pl, 700, p.f, grow(p.box, 0.2), r, 0.032)
        engrave(pl, 380, p.f, p.box, r, { base: 0.02, edge: 0.35, ew: 0.1, shadow: 0.35, sw: 0.3, hatch: Math.PI / 4, freq: 6.5, amt: 0.9 })
      }
    },
  }
}

/* ======================================================= FLY EMBRYO
   A fly embryo at about 10 hours: segmented, anterior to the left. The Hox
   genes paint their domains in chromosome order, head to tail (schematic
   bands, as in the figure: lab, pb, Dfd in the head, Scr and Antp in the
   thorax, Ubx, abd-A and Abd-B in the abdomen). */
const FE = { rx: 7, ry: 2.55 }
const FE_SEGS: [string, number, number][] = [
  ['head', -7, -5.0], ['Ic', -5.0, -4.35], ['Md', -4.35, -3.7], ['Mx', -3.7, -3.05], ['Lb', -3.05, -2.35], ['T1', -2.35, -1.5], ['T2', -1.5, -0.6], ['T3', -0.6, 0.3],
  ['A1', 0.3, 1.1], ['A2', 1.1, 1.9], ['A3', 1.9, 2.65], ['A4', 2.65, 3.4], ['A5', 3.4, 4.1], ['A6', 4.1, 4.8], ['A7', 4.8, 5.45], ['A8', 5.45, 6.1], ['telson', 6.1, 7],
]
const FE_POOL: Record<string, number> = { Ic: 0, Md: 1, Mx: 2, Lb: 3, T1: 3, T2: 4, T3: 4, A1: 5, A2: 6, A3: 6, A4: 6, A5: 7, A6: 7, A7: 7, A8: 7 }
const feX = (x: number, y: number) => x + 0.18 * (y / FE.ry) ** 2
const feRange = (k: number): P2 => {
  const segs = FE_SEGS.filter((s) => FE_POOL[s[0]] === k)
  return [segs[0][1], segs[segs.length - 1][2]]
}
export const FLY_EMBRYO = {
  centre: [0, 0] as P2,
  size: [FE.rx * 2, FE.ry * 2] as P2,
  head: [-5.4, 3.0] as P2,
  thorax: [-1.0, 3.0] as P2,
  abdomen: [3.4, 3.0] as P2,
  segments: FE_SEGS.map(([id, a, b]) => ({ id, x: (a + b) / 2, y: 0 })),
  domains: FLY_HOX.map((h, k) => {
    const [a, b] = feRange(k)
    return { id: h.id, x: (a + b) / 2, y: 0, from: a, to: b }
  }),
}
function flyEmbryoSheet(): Sheet {
  const box: Box = [-FE.rx, -FE.ry, FE.rx, FE.ry]
  const emb = bake(ell(0, 0, FE.rx, FE.ry), grow(box, 0.6), 0.03)
  const bounds = FE_SEGS.slice(1).map((s) => s[1])
  return {
    domains: FLY_HOX.map((_, k) => {
      const [a, b] = feRange(k)
      return { k, parts: [{ f: cheap((x: number, y: number) => Math.max(emb(x, y), a - feX(x, y), feX(x, y) - b)), box: [a - 0.3, -FE.ry, b + 0.3, FE.ry] as Box }] }
    }),
    fallback: [FLY_EMBRYO.domains[2].x, 0],
    ink: (pl, n, r) => {
      const [nE, nC, nF, nS] = share([62, 10, 14, 4], n)
      const tone = (x: number, y: number) => {
        const u = feX(x, y)
        let t = 0
        for (const b of bounds) t = Math.max(t, (b === -5.0 ? 0.8 : 0.45) * Math.exp(-(((u - b) / 0.08) ** 2)))
        return t
      }
      engrave(pl, nE, emb, box, r, { base: 0.04, edge: 0.5, ew: 0.22, shadow: 0.6, sw: 1.4, hatch: 0.3, freq: 6, amt: 0.45, tone, toneMax: 0.8 })
      contour(pl, nC, emb, grow(box, 0.3), r, 0.04)
      const furrows = new Path()
      for (const b of bounds) {
        const yb = FE.ry * Math.sqrt(Math.max(0, 1 - (b / FE.rx) ** 2)) * 0.97
        const pts: Poly = []
        for (let i = 0; i <= 12; i++) {
          const y = -yb + (2 * yb * i) / 12
          pts.push([b - 0.18 * (y / FE.ry) ** 2, y])
        }
        furrows.add(pts, b === -5.0 ? 1.8 : 1)
      }
      stroke(pl, nF, furrows, r, 0.022)
      groundShadow(pl, nS, 0.3, -FE.ry - 0.35, FE.rx * 0.9, 0.16, r)
    },
  }
}

/* ======================================================= ADULT FLY
   Drosophila in side view, head to the left: big compound eye, arista,
   proboscis; humped thorax with bristles; wing with its veins, the haltere
   behind it; three near legs and the three far ones fainter; striped abdomen.
   Washes follow the same order as the embryo: head (lab, pb, Dfd), thorax
   (Scr with the first legs, Antp with the second, Ubx with the third legs
   and the halteres), abdomen (abd-A, then Abd-B). */
const FLY_HEAD = ell(-6.6, 1.25, 1.25, 1.45, 0.1)
const FLY_BODY = smin(0.35, FLY_HEAD, cap(-6.0, 1.1, -5.0, 1.2, 0.5), ell(-3.6, 1.35, 2.35, 1.8, -0.05), ell(-1.55, 2.3, 0.65, 0.38, -0.3), ell(1.45, 0.55, 3.35, 1.72, -0.13))
const FLY_EYE = ell(-6.72, 1.42, 0.92, 1.12, 0.1)
const FLY_WING = cap(-2.0, 2.5, 6.4, 2.95, 0.28, 1.3)
const FLY_LEGS: { pts: P2[]; rad: number[] }[] = [
  { pts: [[-4.9, -0.15], [-5.25, -0.9], [-6.3, -1.9], [-6.75, -3.3], [-7.55, -4.2]], rad: [0.28, 0.2, 0.16, 0.1, 0.06] },
  { pts: [[-3.6, -0.35], [-3.55, -1.1], [-2.4, -2.1], [-2.75, -3.6], [-3.3, -4.4]], rad: [0.28, 0.2, 0.16, 0.1, 0.06] },
  { pts: [[-2.3, -0.25], [-1.9, -0.95], [-0.35, -1.9], [0.3, -3.5], [1.3, -4.35]], rad: [0.28, 0.2, 0.17, 0.11, 0.06] },
]
const FLY_HALTERE = umin(cap(-1.35, 1.25, -1.0, 0.5, 0.07), cir(-0.95, 0.38, 0.24))
export const FLY_PARTS = {
  head: [-6.6, 1.25] as P2,
  eye: [-6.72, 1.42] as P2,
  antenna: [-8.0, 1.9] as P2,
  proboscis: [-7.55, -0.8] as P2,
  thorax: [-3.6, 1.6] as P2,
  wing: [3.2, 2.9] as P2,
  haltere: [-0.95, 0.38] as P2,
  abdomen: [1.6, 0.4] as P2,
  legs: FLY_LEGS.map((l) => l.pts[2]),
  /** where each gene's colour sits on the adult */
  regions: {
    lab: [-7.45, 1.2] as P2, pb: [-6.6, 1.2] as P2, Dfd: [-5.8, 1.1] as P2, Scr: [-4.9, 1.2] as P2,
    Antp: [-3.4, 1.4] as P2, Ubx: [-1.45, 1.0] as P2, 'abd-A': [1.0, 0.6] as P2, 'Abd-B': [3.7, 0.2] as P2,
  } as Record<string, P2>,
}
function flySheet(): Sheet {
  const bbox: Box = [-7.9, -0.6, 4.9, 3.4]
  const body = bake(FLY_BODY, grow(bbox, 0.6), 0.025)
  const legs = FLY_LEGS.map((l) => chain(l.pts, l.rad))
  const legBox = FLY_LEGS.map((l) => boxOf(l.pts, 0.35))
  const eyeBox: Box = [-7.7, 0.2, -5.7, 2.65]
  const wingBox: Box = [-2.35, 1.35, 7.8, 4.3]
  const halBox: Box = [-1.5, 0.1, -0.65, 1.35]
  const strips: [number, number, number][] = [[0, -7.9, -7.05], [1, -7.05, -6.2], [2, -6.2, -5.35], [3, -5.35, -4.5], [4, -4.5, -2.3], [5, -2.3, -0.6], [6, -0.6, 2.6], [7, 2.6, 5.0]]
  const extra: Record<number, Part[]> = {
    3: [{ f: legs[0], box: legBox[0] }],
    4: [{ f: legs[1], box: legBox[1] }],
    5: [{ f: legs[2], box: legBox[2] }, { f: FLY_HALTERE, box: halBox }],
  }
  const domains: Domain[] = strips.map(([k, a, b]) => ({ k, parts: [{ f: strip(body, a, b), box: [a, bbox[1], b, bbox[3]] as Box }, ...(extra[k] ?? [])] }))
  return {
    domains,
    fallback: [-6.0, 1.0],
    ink: (pl, n, r) => {
      const [nB, nC, nEye, nEw, nWs, nWc, nV, nL, nLc, nFar, nHal, nHead, nBr] = share([30, 5, 8, 2.5, 2.2, 3, 4, 6, 3, 2.5, 0.8, 2, 1.5], n)
      // abdominal tergites: a dark band at the back of each, on the dorsal side
      const tone = (x: number, y: number) => {
        let t = FLY_EYE(x, y) < 0 ? -0.5 : 0
        if (x > -1.3) {
          const fr = (x + 1.6) / 1.05 - Math.floor((x + 1.6) / 1.05)
          const dorsal = y > 0.55 - 0.13 * (x - 1.45) - 0.35 ? 1 : 0.25
          t += 0.5 * ss(0.55, 0.82, fr) * dorsal
        }
        return t
      }
      engrave(pl, nB, body, bbox, r, { base: 0.06, edge: 0.5, ew: 0.18, shadow: 0.6, sw: 1.0, hatch: 0.6, freq: 6.5, amt: 0.45, tone, toneMax: 0.5 })
      contour(pl, nC, body, grow(bbox, 0.3), r, 0.04)
      // the compound eye: a lattice of facets, darker away from the lamp
      const K = (2 * Math.PI) / 0.15
      fill(nEye, FLY_EYE, eyeBox, r, (x, y, d) => {
        const h = Math.cos(K * x) + Math.cos(K * (0.5 * x + 0.866 * y)) + Math.cos(K * (0.5 * x - 0.866 * y))
        return clamp01((0.25 + 0.75 * ss(1.2, -1.0, h)) * (0.45 + 0.35 * (x + 6.72) - 0.25 * (y - 1.42)) + 0.6 * Math.exp(d / 0.08))
      }, (x, y) => inkDot(pl, r, x, y, 1, 0.03 + 0.02 * r()))
      wash(pl, nEw, FLY_EYE, eyeBox, r, PIG.brick, { alpha: 0.16, pig: 0.05 })
      // wing: a faint membrane, its margin, and the veins L2–L5 with two cross-veins
      engrave(pl, nWs, FLY_WING, wingBox, r, { base: 0.02, edge: 0.25, ew: 0.1, shadow: 0.15, sw: 0.5, hatch: 1.2, freq: 8, amt: 0.6 })
      contour(pl, nWc, FLY_WING, grow(wingBox, 0.3), r, 0.028)
      const veins = new Path()
      const base: P2 = [-1.6, 2.55]
      veins.add(bez(base, [1, 3.1], [3.5, 3.7], [5.2, 3.95]))
      veins.add(bez(base, [2, 2.95], [5, 3.2], [7.55, 3.35]))
      veins.add(bez(base, [2, 2.45], [5, 2.3], [7.3, 2.25]))
      veins.add(bez(base, [1.5, 2.1], [3.5, 1.8], [5.3, 1.75]))
      veins.add([[2.3, 3.03], [2.35, 2.42]])
      veins.add([[4.2, 2.34], [4.1, 1.88]])
      stroke(pl, nV, veins, r, 0.022)
      // legs: engraved segments; tarsal joints ticked; the far three fainter behind
      const perL = share(FLY_LEGS.map(() => 1), nL), perLc = share(FLY_LEGS.map(() => 1), nLc)
      legs.forEach((f, i) => {
        engrave(pl, perL[i], f, legBox[i], r, { base: 0.25, edge: 0.6, ew: 0.08, shadow: 0.6, sw: 0.2, hatch: 0.2, freq: 8, amt: 0.4 })
        contour(pl, perLc[i], f, grow(legBox[i], 0.2), r, 0.025)
        const t = FLY_LEGS[i].pts
        ticks(pl, 12, [t[3], t[4]], 0.2, 0.06, r)
      })
      const far = new Path()
      for (const l of FLY_LEGS) far.add(l.pts.map(([x, y]) => [x + 0.45, y + 0.3] as P2), 1)
      stroke(pl, nFar, far, r, 0.05, 0.5)
      engrave(pl, Math.floor(nHal * 0.6), FLY_HALTERE, halBox, r, { base: 0.3, edge: 0.6, ew: 0.06 })
      contour(pl, nHal - Math.floor(nHal * 0.6), FLY_HALTERE, grow(halBox, 0.2), r, 0.02)
      // head parts: antenna with its feathered arista, proboscis
      const ant = ell(-7.95, 1.85, 0.22, 0.3, 0.4)
      const prob = umin(cap(-7.2, 0.1, -7.55, -0.65, 0.2), ell(-7.6, -0.85, 0.35, 0.22, 0.3))
      const [nA, nP, nAr] = share([1, 2, 1], nHead)
      engrave(pl, nA, ant, [-8.3, 1.4, -7.6, 2.3], r, { base: 0.3, edge: 0.6, ew: 0.06 })
      engrave(pl, Math.floor(nP * 0.6), prob, [-8.0, -1.1, -6.9, 0.35], r, { base: 0.2, edge: 0.6, ew: 0.08 })
      contour(pl, nP - Math.floor(nP * 0.6), prob, [-8.2, -1.3, -6.7, 0.5], r, 0.025)
      const arista = new Path().add(bez([-8.05, 2.05], [-8.3, 2.3], [-8.6, 2.55], [-8.95, 2.75]))
      for (let i = 1; i < 6; i++) {
        const [x, y] = arista.at(i / 6)
        arista.add([[x, y], [x - 0.12, y + 0.22]], 0.6)
        arista.add([[x, y], [x + 0.12, y - 0.16]], 0.6)
      }
      stroke(pl, nAr, arista, r, 0.015)
      // bristles: the macrochaetae an entomologist counts
      const br = new Path()
      const bristle: [P2, P2][] = [
        [[-4.8, 2.95], [-4.15, 3.45]], [[-4.0, 3.1], [-3.3, 3.55]], [[-3.2, 3.12], [-2.5, 3.5]], [[-2.4, 2.95], [-1.7, 3.3]], [[-1.3, 2.62], [-0.45, 2.95]],
        [[-6.4, 2.6], [-6.0, 3.05]], [[-6.9, 2.58], [-6.65, 3.08]], [[-5.6, 2.3], [-5.1, 2.8]],
      ]
      for (const [a, b] of bristle) br.add([a, b])
      stroke(pl, nBr, br, r, 0.02)
    },
  }
}

/* ======================================================= MOUSE EMBRYO
   A mouse embryo at 12 days: curled into a C, the big head with its eye,
   pharyngeal arches below it, the heart bulge, fore- and hindlimb buds, a
   row of somites down the back and the curling tail. Hox colours run along
   the body axis, head to tail: nothing in the forebrain and midbrain,
   group 1 at the hindbrain, groups 9–13 toward the tail. */
const ME = { C: [0.6, -0.1] as P2, S: 1.32 }
const meTh = (s: number) => 2.35 - 5.3 * s
const meR = (s: number) => 4.3 - 1.9 * s
const meAt = (s: number): P2 => [ME.C[0] + ME.S * meR(s) * Math.cos(meTh(s)), ME.C[1] + ME.S * meR(s) * Math.sin(meTh(s))]
/** inward normal (toward the curl's centre = the embryo's belly) */
const meIn = (s: number): P2 => {
  const a = meAt(Math.max(0, s - 0.005)), b = meAt(Math.min(1, s + 0.005))
  const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.sqrt(tx * tx + ty * ty) || 1
  return [ty / l, -tx / l]
}
const ME_RAD: P2[] = [[0, 1.9], [0.12, 1.75], [0.18, 1.62], [0.3, 1.78], [0.45, 1.85], [0.6, 1.7], [0.75, 1.1], [0.88, 0.55], [1.0, 0.12]]
const meRad = (s: number) => {
  for (let i = 0; i < ME_RAD.length - 1; i++) {
    const [s0, r0] = ME_RAD[i], [s1, r1] = ME_RAD[i + 1]
    if (s <= s1) return (r0 + (r1 - r0) * ss(s0, s1, s)) * ME.S
  }
  return ME_RAD[ME_RAD.length - 1][1] * ME.S
}
const ME_DOM: [number, number, number][] = [
  [0, 0.13, 0.17], [1, 0.17, 0.21], [G3, 0.21, 0.25], [2, 0.25, 0.3], [3, 0.3, 0.36], [4, 0.36, 0.43], [5, 0.43, 0.5], [6, 0.5, 0.57], [7, 0.57, 0.97],
]
const meOff = (s: number, k: number): P2 => {
  const p = meAt(s), n = meIn(s)
  return [p[0] + n[0] * k, p[1] + n[1] * k]
}
const ME_HEAD = meAt(0)
const ME_ANT: P2 = (() => {
  const a = meAt(0), b = meAt(0.01), l = Math.hypot(b[0] - a[0], b[1] - a[1])
  return [-(b[0] - a[0]) / l, -(b[1] - a[1]) / l]
})()
const meHd = (a: number, i: number): P2 => [ME_HEAD[0] + ME_ANT[0] * a + meIn(0)[0] * i, ME_HEAD[1] + ME_ANT[1] * a + meIn(0)[1] * i]
/* the head, flexed forward at the midbrain (cranial flexure): the midbrain dome on top,
   the forebrain folded down beneath it, the face turned in toward the heart */
const ME_MID = meHd(0.3, -0.1)
const ME_FORB = meHd(0.6, 1.9)
const ME_FACE = meHd(0.2, 3.3)
const ME_EYE = meHd(1.15, 1.55)
const ME_FORE = meOff(0.34, meRad(0.34) * 0.95)
const ME_HIND = meOff(0.64, meRad(0.64) * 0.95)
export const MOUSE_EMBRYO = {
  head: ME_HEAD,
  eye: ME_EYE,
  heart: meOff(0.26, meRad(0.26) * 0.85),
  forelimb: ME_FORE,
  hindlimb: ME_HIND,
  tail: meAt(0.97),
  somites: meOff(0.5, -meRad(0.5) * 0.7),
  /** a point just outside the back for each colour's domain: pool index, paralog groups, place */
  domains: ME_DOM.map(([k, s0, s1]) => ({
    pool: k,
    groups: GROUP_POOL.map((p, g) => (p === k ? g : -1)).filter((g) => g > 0),
    at: meOff((s0 + s1) / 2, -meRad((s0 + s1) / 2) - 0.6),
  })),
}
function mouseEmbryoSheet(): Sheet {
  const pts: P2[] = [], rad: number[] = []
  for (let i = 0; i <= 60; i++) (pts.push(meAt(i / 60)), rad.push(meRad(i / 60)))
  const T = tubeField(pts, rad)
  const inA = meIn(0)
  const head = smin(0.6, cir(ME_HEAD[0], ME_HEAD[1], 2.2), cir(ME_FORB[0], ME_FORB[1], 2.0), cir(ME_FACE[0], ME_FACE[1], 1.1))
  const midbrain = cir(ME_MID[0], ME_MID[1], 2.4)
  const heartC = meOff(0.26, meRad(0.26) * 0.85)
  const heart = cir(heartC[0], heartC[1], 1.5)
  const bud = (c: P2, s: number, rx: number, ry: number) => {
    const n = meIn(s)
    return ell(c[0], c[1], rx, ry, Math.atan2(n[1], n[0]))
  }
  const fore = bud(ME_FORE, 0.34, 0.95, 0.6), hind = bud(ME_HIND, 0.64, 0.9, 0.58)
  const box: Box = [-7.2, -5.8, 8.0, 7.0]
  const [body, sOf] = bake2(
    (x, y) => {
      const td = T.d(x, y), s = T.s()
      let d = sminv(td, Math.min(head(x, y), midbrain(x, y)), 0.7)
      d = sminv(d, heart(x, y), 0.3)
      d = sminv(d, Math.min(fore(x, y), hind(x, y)), 0.25)
      return [d, s]
    },
    grow(box, 0.4),
    0.035,
  )
  const LEN = T.L
  const domains: Domain[] = ME_DOM.map(([k, s0, s1]) => {
    const seg: P2[] = []
    for (let s = s0; s <= s1 + 1e-6; s += 0.01) seg.push(meAt(Math.min(1, s)))
    const f = cheap((x: number, y: number) => {
      const d = body(x, y), s = sOf(x, y)
      return Math.max(d, (s0 - s) * LEN, (s - s1) * LEN)
    })
    return { k, parts: [{ f, box: boxOf(seg, meRad((s0 + s1) / 2) + 1.4) }] }
  })
  return {
    domains,
    fallback: ME_HEAD,
    ink: (pl, n, r) => {
      const [nB, nC, nSo, nEye, nAr, nS] = share([60, 10, 10, 4, 2, 3], n)
      // tone: dorsal somite band, and the cervical flexure where head meets neck
      const tone = (x: number, y: number) => {
        const s = sOf(x, y)
        if (s < 0.17 || s > 0.93) return 0
        const p = meAt(s), no = meIn(s)
        const depth = -((x - p[0]) * no[0] + (y - p[1]) * no[1]) / meRad(s) // 1 at the back
        return depth > 0.4 ? 0.25 * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (s / 0.0165)), 3) : 0
      }
      engrave(pl, nB, body, box, r, { base: 0.05, edge: 0.5, ew: 0.22, shadow: 0.6, sw: 1.6, hatch: 0.9, freq: 6, amt: 0.4, tone, toneMax: 0.25 })
      contour(pl, nC, body, grow(box, 0.3), r, 0.04)
      // somites: a row of short grooves down the back
      const som = new Path()
      for (let s = 0.17; s < 0.93; s += 0.0165) {
        const rr = meRad(s)
        som.add([meOff(s, -rr * 0.42), meOff(s, -rr * 0.9)])
      }
      stroke(pl, nSo, som, r, 0.022)
      // the eye: pigmented retina, a paler lens
      fill(nEye, cir(ME_EYE[0], ME_EYE[1], 0.46), [ME_EYE[0] - 0.46, ME_EYE[1] - 0.46, ME_EYE[0] + 0.46, ME_EYE[1] + 0.46], r, (x, y) => {
        const d = Math.hypot(x - ME_EYE[0] - 0.08, y - ME_EYE[1] - 0.06)
        return d < 0.16 ? 0.08 : 0.95
      }, (x, y) => inkDot(pl, r, x, y))
      // pharyngeal arches below the eye, a groove where the head folds onto the body
      const arch = new Path()
      for (const s of [0.13, 0.155, 0.18]) arch.add(bez(meOff(s, meRad(s) * 0.45), meOff(s - 0.01, meRad(s) * 0.7), meOff(s - 0.015, meRad(s) * 0.9), meOff(s - 0.02, meRad(s) * 1.05)))
      stroke(pl, nAr, arch, r, 0.03)
      groundShadow(pl, nS, 0.8, -6.0, 3.5, 0.18, r)
      void inA
    },
  }
}

/* ======================================================= ADULT MOUSE
   Side view, facing left: pointed snout with whiskers, a big round ear, the
   eye, the fur engraved as short hairs, four legs (far ones fainter) and the
   long ringed tail. Hox washes follow the axis: the back of the head and the
   neck (groups 1–5), the chest (6–8), lumbar, sacral and the tail's root (9–13). */
const MA_TORSO = smin(
  0.7,
  smin(0.8, ell(0.5, -0.3, 4.1, 2.25, 0.04), cir(-2.6, -0.55, 1.75), cir(3.2, -0.25, 2.05)),
  smin(0.6, ell(-4.9, 0.35, 1.7, 1.35, 0.15), cap(-5.3, 0.2, -7.55, -0.3, 1.0, 0.28)),
)
const MA_EAR = ell(-4.05, 2.1, 0.95, 1.1, -0.25)
const MA_FORE = umin(cap(-2.7, -1.6, -2.9, -2.9, 0.55, 0.28), cap(-2.9, -2.9, -3.15, -3.5, 0.28, 0.2), ell(-3.45, -3.62, 0.42, 0.16))
const MA_HIND = umin(ell(2.6, -1.35, 1.3, 1.55, 0.3), cap(2.3, -2.4, 1.9, -3.35, 0.32, 0.2), cap(1.9, -3.5, 0.55, -3.65, 0.18, 0.12))
const MA_TAIL_PTS = bez([5.0, -0.6], [7.5, -2.8], [9.8, -0.2], [12.0, -1.6], 40)
export const MOUSE_PARTS = {
  snout: [-7.7, -0.3] as P2,
  eye: [-5.55, 0.75] as P2,
  ear: [-4.05, 2.1] as P2,
  head: [-5.2, 0.4] as P2,
  body: [0.5, -0.3] as P2,
  foreleg: [-3.0, -2.9] as P2,
  hindleg: [2.2, -2.6] as P2,
  tail: [9.8, -0.9] as P2,
  whiskers: [-9.8, 0.2] as P2,
  /** where each colour sits on the adult (pool index → point) */
  regions: [
    [0, -4.0, 0.9], [1, -3.5, 0.9], [G3, -3.0, 0.7], [2, -2.45, 0.5], [3, -1.8, 0.3], [4, -1.0, 0.2], [5, -0.1, 0.1], [6, 0.8, 0.0], [7, 3.0, -0.2],
  ].map(([k, x, y]) => ({ pool: k, at: [x, y] as P2 })),
}
function mouseSheet(): Sheet {
  const tubeR = MA_TAIL_PTS.map((_, i) => 0.3 - 0.24 * (i / (MA_TAIL_PTS.length - 1)))
  const tail = tubeField(MA_TAIL_PTS, tubeR)
  const tailB = bake(tail.d, [4.4, -3.3, 12.5, 0.5], 0.03)
  const box: Box = [-8.1, -3.9, 5.4, 3.3]
  const torso = bake(MA_TORSO, grow(box, 0.5), 0.03)
  const fore = bake(MA_FORE, [-4.2, -4.1, -1.9, -1.0], 0.02), hind = bake(MA_HIND, [0.1, -4.1, 4.1, 0.4], 0.02)
  const paint = cheap(umin(torso, fore, hind, tailB))
  const ranges: [number, number, number][] = [
    [0, -4.3, -3.75], [1, -3.75, -3.25], [G3, -3.25, -2.75], [2, -2.75, -2.15], [3, -2.15, -1.45], [4, -1.45, -0.55], [5, -0.55, 0.35], [6, 0.35, 1.25], [7, 1.25, 8.5],
  ]
  return {
    domains: ranges.map(([k, a, b]) => ({ k, parts: [{ f: strip(paint, a, b), box: [a, -4.0, b, 3.2] as Box }] })),
    fallback: [-5.2, 0.4],
    ink: (pl, n, r) => {
      const [nF, nC, nEar, nEw, nEye, nWh, nLeg, nLc, nFar, nTail, nTc, nS, nNose] = share([34, 6, 4, 1.5, 1.5, 2.5, 5, 2.5, 2, 5, 2, 2, 0.6], n)
      // fur: hairs lie back along the body and sweep down the flanks
      const dir = (_x: number, y: number) => -0.2 - 0.45 * clamp01(-(y + 0.3) / 2)
      furry(pl, nF, torso, box, r, dir, { base: 0.08, edge: 0.45, ew: 0.2, shadow: 0.7, sw: 1.2, hatch: -0.3, freq: 5, amt: 0.35 })
      contour(pl, nC, torso, grow(box, 0.3), r, 0.04)
      // the ear: engraved rim, pale pink inside
      const earBox: Box = [-5.2, 0.9, -2.9, 3.35]
      const inner = ell(-4.0, 2.05, 0.58, 0.72, -0.25)
      engrave(pl, Math.floor(nEar * 0.6), MA_EAR, earBox, r, { base: 0.05, edge: 0.6, ew: 0.12, shadow: 0.5, sw: 0.5, tone: (x, y) => (inner(x, y) < 0 ? 0.25 : 0), toneMax: 0.25 })
      contour(pl, nEar - Math.floor(nEar * 0.6), MA_EAR, grow(earBox, 0.3), r, 0.04)
      wash(pl, nEw, inner, [-4.8, 1.2, -3.2, 2.9], r, PIG.pink, { alpha: 0.2, pig: 0.02 })
      // eye: a black bead with the lamp's highlight
      fill(nEye, cir(-5.55, 0.75, 0.3), [-5.85, 0.45, -5.25, 1.05], r, (x, y) => (Math.hypot(x + 5.63, y - 0.84) < 0.08 ? 0 : 1), (x, y) => inkDot(pl, r, x, y))
      // nose, and the whiskers fanning from the snout
      fill(nNose, cir(-7.78, -0.28, 0.17), [-7.95, -0.45, -7.61, -0.11], r, () => 0.8, (x, y) => inkDot(pl, r, x, y))
      const wh = new Path()
      const root: P2 = [-7.0, -0.2]
      for (const [ex, ey] of [[-10.2, 0.9], [-10.6, 0.25], [-10.4, -0.5], [-9.9, -1.25], [-9.2, -1.75], [-9.6, 1.5]] as P2[])
        wh.add(bez(root, [(root[0] + ex) / 2, root[1] + (ey - root[1]) * 0.2 + 0.25], [ex + 0.6, ey + 0.1], [ex, ey]))
      stroke(pl, nWh, wh, r, 0.012, 0.75, [1, 0.4])
      // legs, toes, far legs
      const legsB: [SDF, Box][] = [[fore, [-4.0, -3.9, -2.0, -1.0]], [hind, [0.2, -3.9, 4.0, 0.3]]]
      legsB.forEach(([f, b], i) => {
        engrave(pl, Math.floor(nLeg / 2), f, b, r, { base: 0.1, edge: 0.5, ew: 0.1, shadow: 0.7, sw: 0.4, hatch: 0.3, freq: 7, amt: 0.4, tone: i ? undefined : undefined })
        contour(pl, Math.floor(nLc / 2), f, grow(b, 0.3), r, 0.035)
      })
      const far = new Path()
      far.add([[-2.0, -1.8], [-2.1, -3.2], [-2.45, -3.55], [-2.8, -3.55]])
      far.add([[3.4, -2.0], [3.1, -3.25], [2.0, -3.45]])
      stroke(pl, nFar, far, r, 0.1, 0.45)
      ticks(pl, 20, [[-3.85, -3.62], [-3.05, -3.62]], 0.18, 0.08, r)
      // tail: ringed, tapering
      const tailBox: Box = [4.4, -3.2, 12.4, 0.4]
      engrave(pl, nTail, tailB, tailBox, r, { base: 0.15, edge: 0.6, ew: 0.08, shadow: 0.6, sw: 0.2, hatch: 0.2, freq: 5, amt: 0.3 })
      contour(pl, nTc, tailB, grow(tailBox, 0.3), r, 0.03)
      ticks(pl, 10, MA_TAIL_PTS, 0.16, 0.18, r, 0.7)
      groundShadow(pl, nS, 0.0, -3.85, 5.2, 0.16, r)
    },
  }
}

/** Figure 18.17: fly and mouse, chromosome → embryo → adult, colour for colour */
export function hoxForms(seed = 17) {
  const fbs = linkedSheets([flyChromSheet(), flyEmbryoSheet(), flySheet(), mouseChromSheet(), mouseEmbryoSheet(), mouseSheet()], POOLS, seed)
  return finishLinked(fbs, 'x', 0, seed)
}

/* ======================================================= 18.18 · CRUSTACEAN vs INSECT
   Brine shrimp (Artemia): a head with stalked eyes; a long thorax of eleven
   alike segments, each with a pair of leaf-like swimming legs (phyllopods);
   genital segments; a slender legless abdomen. Scr, Antp, Ubx and abd-A are
   all expressed, overlapping, across the whole thorax.
   Grasshopper: the same genes in separate domains — Scr in the first thoracic
   segment, Antp in the second, Ubx in the third (the jumping legs), abd-A in
   the abdomen, where Ubx and abd-A suppress legs. */
const CRUST_POOLS = [3, 4, 5, 6].map((i) => HOX_COL[i])
export const CRUST_GENES = [3, 4, 5, 6].map((i) => FLY_HOX[i].id)
const ART_SEG0 = -8.6, ART_SEGW = (2.0 - -8.6) / 11
const artY = (x: number) => (x < 2 ? 0.5 : 0.5 - 0.05 * (x - 2))
const artR = (x: number) => (x < -8.6 ? 0.85 : x < 2 ? 0.78 - 0.006 * (x + 8.6) : x < 3.8 ? 0.8 : 0.55 - 0.25 * ss(3.8, 10.2, x))
const ART_LEAVES = Array.from({ length: 11 }, (_, i) => {
  const xs = ART_SEG0 + i * ART_SEGW, sc = 1 - 0.025 * Math.abs(i - 4)
  return { x: xs + 0.55, sc, f: smin(0.2, ell(xs + 0.55, -1.45, 0.46 * sc, 1.12 * sc, 0.34), ell(xs + 0.95, -1.0, 0.3 * sc, 0.45 * sc, -0.4), cir(xs + 0.9, -2.35 * sc + 0.1, 0.2 * sc)), box: [xs - 0.25, -2.9, xs + 1.45, -0.2] as Box }
})
export const ARTEMIA = {
  head: [-9.8, 0.75] as P2,
  eye: [-11.15, 2.35] as P2,
  thorax: [-3.3, 0.5] as P2,
  thoraxRange: [ART_SEG0, 2.0] as P2,
  phyllopods: ART_LEAVES.map((l) => [l.x, -1.5] as P2),
  genital: [2.9, 0.4] as P2,
  abdomen: [7.0, 0.2] as P2,
  furca: [10.55, 0.25] as P2,
}
const GH = {
  head: ell(-8.5, 1.3, 1.3, 1.6, 0.35),
  eye: ell(-8.3, 2.0, 0.55, 0.8, 0.2),
  pronotum: sdPoly([[-7.5, 2.7], [-4.9, 2.75], [-4.7, 1.2], [-5.2, 0.5], [-7.2, 0.4], [-7.6, 1.3]]),
  thorax: ell(-4.6, 1.1, 2.9, 1.5),
  abdomen: cap(-2.2, 1.0, 7.4, 0.8, 1.4, 0.55),
  tegmen: cap(-5.0, 2.5, 8.0, 1.95, 0.35, 0.5),
  leg1: chain([[-6.3, 0.2], [-6.6, -0.5], [-7.4, -1.8], [-6.9, -3.3], [-7.7, -3.75]], [0.28, 0.22, 0.17, 0.1, 0.07]),
  leg2: chain([[-4.4, 0.0], [-4.3, -0.7], [-3.9, -2.0], [-2.9, -3.3], [-2.2, -3.75]], [0.28, 0.22, 0.17, 0.1, 0.07]),
  leg3: umin(cap(-2.6, 0.3, 3.4, 2.2, 0.78, 0.28), cap(3.4, 2.2, 0.9, -3.1, 0.15, 0.12), cap(0.9, -3.1, 2.3, -3.65, 0.1, 0.07)),
}
export const GRASSHOPPER = {
  head: [-8.5, 1.3] as P2,
  eye: [-8.3, 2.0] as P2,
  antenna: [-10.5, 4.3] as P2,
  thorax: [-4.6, 1.0] as P2,
  T1: [-6.4, 1.2] as P2,
  T2: [-4.45, 0.9] as P2,
  T3: [-2.8, 0.9] as P2,
  hindLeg: [1.0, 1.5] as P2,
  wing: [3.0, 2.3] as P2,
  abdomen: [3.2, 0.6] as P2,
}
function artemiaSheet(): Sheet {
  const pts: P2[] = [], rad: number[] = []
  for (let x = -9.4; x <= 10.21; x += 0.35) (pts.push([x, artY(x)]), rad.push(artR(x)))
  const T = tubeField(pts, rad)
  const headC = cir(-9.8, 0.75, 0.95)
  const pouch = ell(2.9, -0.55, 1.05, 0.8, 0.1)
  const bbox: Box = [-10.9, -1.5, 10.6, 1.9]
  const body = bake((x, y) => sminv(sminv(T.d(x, y), headC(x, y), 0.3), pouch(x, y), 0.25), grow(bbox, 0.5), 0.025)
  // all four genes across the whole thorax, in soft overlapping stripes
  const stripe = (j: number) => (x: number, y: number) => {
    const ph = (x + y * 0.45) / 1.15 - j / 4
    return 0.08 + 0.92 * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph), 3)
  }
  const thorax: Part = { f: strip(body, ART_SEG0, 2.0), box: [ART_SEG0, -0.6, 2.0, 1.4] }
  const leaves: Part[] = ART_LEAVES.map((l) => ({ f: l.f, box: l.box }))
  return {
    domains: [0, 1, 2, 3].map((k) => ({ k, parts: [thorax, ...leaves], dens: stripe(k) })),
    fallback: [-3.3, 0.5],
    ink: (pl, n, r) => {
      const [nB, nC, nL, nLc, nSet, nSeg, nEye, nAnt, nF] = share([30, 6, 14, 8, 5, 4, 4, 2, 2], n)
      engrave(pl, nB, body, bbox, r, { base: 0.06, edge: 0.5, ew: 0.15, shadow: 0.6, sw: 0.6, hatch: 1.1, freq: 7, amt: 0.4 })
      contour(pl, nC, body, grow(bbox, 0.3), r, 0.035)
      const perL = share(ART_LEAVES.map((l) => l.sc), nL), perC = share(ART_LEAVES.map((l) => l.sc), nLc)
      const perS = Math.floor(nSet / (11 * 7))
      ART_LEAVES.forEach((l, i) => {
        engrave(pl, perL[i], l.f, l.box, r, { base: 0.03, edge: 0.55, ew: 0.08, shadow: 0.45, sw: 0.35, hatch: 1.3, freq: 9, amt: 0.6 })
        contour(pl, perC[i], l.f, grow(l.box, 0.2), r, 0.025)
        // a fringe of setae along the leaf's hind margin
        for (let j = 0; j < 7; j++) {
          const a = -2.5 + j * 0.36, sc = l.sc
          const ca = Math.cos(a), sa = Math.sin(a), c = Math.cos(0.3), s = Math.sin(0.3)
          const ex = 0.42 * sc * ca, ey = 1.15 * sc * sa
          const x0 = l.x + ex * c - ey * s, y0 = -1.5 + ex * s + ey * c
          const nx = (ex * c - ey * s) / (0.42 * sc), ny = (ex * s + ey * c) / (1.15 * sc)
          const nl = Math.hypot(nx, ny) || 1
          stroke(pl, perS, [[x0, y0], [x0 + (nx / nl) * 0.38 + 0.08, y0 + (ny / nl) * 0.38]], r, 0.01, 0.8)
        }
      })
      // segment rings along thorax, genital segments and abdomen
      const rings = new Path()
      const segX: number[] = []
      for (let i = 1; i <= 11; i++) segX.push(ART_SEG0 + i * ART_SEGW)
      segX.push(2.9)
      for (let i = 0; i <= 6; i++) segX.push(3.8 + i * 1.06)
      for (const x of segX) rings.add(arcPts(x + 0.15, artY(x), artR(x) * 0.98, 1.9, 4.38, 8))
      stroke(pl, nSeg, rings, r, 0.018)
      // stalked compound eyes and the median eye
      const stalk = cap(-10.2, 1.35, -10.95, 2.15, 0.16, 0.13), eye = ell(-11.15, 2.35, 0.48, 0.4, 0.6)
      engrave(pl, Math.floor(nEye * 0.35), stalk, [-11.2, 1.1, -9.9, 2.4], r, { base: 0.2, edge: 0.6, ew: 0.06 })
      fill(nEye - Math.floor(nEye * 0.35), eye, [-11.7, 1.9, -10.6, 2.8], r, (_x, _y, d) => 0.55 + 0.45 * Math.exp(d / 0.1), (x, y) => inkDot(pl, r, x, y))
      for (let k = 0; k < 150; k++) {
        const a = r() * Math.PI * 2, rr = 0.11 * Math.sqrt(r())
        inkDot(pl, r, -10.45 + Math.cos(a) * rr, 1.0 + Math.sin(a) * rr)
      }
      // antennae
      const ant = new Path()
      ant.add(bez([-10.5, 0.55], [-11.0, 0.8], [-11.6, 1.0], [-12.1, 1.15]))
      ant.add(bez([-10.3, 0.1], [-10.9, -0.2], [-11.3, -0.55], [-11.55, -1.0]), 1.8)
      stroke(pl, nAnt, ant, r, 0.02)
      // the furca: two small lobes with bristles
      const furca = umin(ell(10.55, 0.45, 0.35, 0.13, 0.35), ell(10.55, 0.05, 0.35, 0.13, -0.35))
      engrave(pl, Math.floor(nF * 0.5), furca, [10.1, -0.25, 11.0, 0.75], r, { base: 0.3, edge: 0.6, ew: 0.05 })
      const fs = new Path()
      for (const [x, y, a] of [[10.85, 0.6, 0.5], [10.9, 0.45, 0.2], [10.85, -0.1, -0.5], [10.9, 0.05, -0.2]] as [number, number, number][]) fs.add([[x, y], [x + 0.55 * Math.cos(a), y + 0.55 * Math.sin(a)]])
      stroke(pl, nF - Math.floor(nF * 0.5), fs, r, 0.01)
    },
  }
}
function grasshopperSheet(): Sheet {
  const bbox: Box = [-9.9, -0.6, 7.95, 2.9]
  const body = bake(smin(0.3, GH.head, GH.thorax, GH.abdomen, GH.pronotum), grow(bbox, 0.5), 0.025)
  const l1B: Box = [-8.0, -4.0, -5.9, 0.5], l2B: Box = [-4.8, -4.0, -1.9, 0.3], l3B: Box = [-3.4, -3.9, 4.0, 3.1]
  const leg1 = bake(GH.leg1, grow(l1B, 0.4), 0.02), leg2 = bake(GH.leg2, grow(l2B, 0.4), 0.02), leg3 = bake(GH.leg3, grow(l3B, 0.4), 0.025)
  return {
    domains: [
      { k: 0, parts: [{ f: strip(body, -7.7, -5.3), box: [-7.7, -0.6, -5.3, 2.9] as Box }, { f: leg1, box: l1B }] },
      { k: 1, parts: [{ f: strip(body, -5.3, -3.6), box: [-5.3, -0.6, -3.6, 2.9] as Box }, { f: leg2, box: l2B }] },
      { k: 2, parts: [{ f: strip(body, -3.6, -2.0), box: [-3.6, -0.6, -2.0, 2.9] as Box }, { f: leg3, box: l3B }] },
      { k: 3, parts: [{ f: strip(body, -2.0, 8.0), box: [-2.0, -0.6, 8.0, 2.5] as Box }] },
    ],
    fallback: [-4.6, 1.0],
    ink: (pl, n, r) => {
      const [nB, nC, nEye, nTeg, nTv, nL, nLc, nFem, nSp, nAnt, nPro, nMisc] = share([30, 6, 4, 4, 3, 12, 5, 4, 1.5, 2, 2, 2], n)
      // abdomen rings; the head's face darker
      const tone = (x: number) => (x > -2 ? 0.45 * Math.pow(0.5 + 0.5 * Math.cos((2 * Math.PI * (x + 2)) / 0.95), 8) : 0)
      engrave(pl, nB, body, bbox, r, { base: 0.07, edge: 0.5, ew: 0.16, shadow: 0.6, sw: 0.9, hatch: 1.0, freq: 6.5, amt: 0.4, tone, toneMax: 0.45 })
      contour(pl, nC, body, grow(bbox, 0.3), r, 0.04)
      fill(nEye, GH.eye, [-8.9, 1.15, -7.7, 2.85], r, (x, y, d) => 0.35 + 0.35 * (x + 8.3) - 0.2 * (y - 2.0) + 0.5 * Math.exp(d / 0.08), (x, y) => inkDot(pl, r, x, y))
      // folded forewings (tegmina) along the back, with their long veins
      const tegB: Box = [-5.4, 1.4, 8.6, 3.0]
      engrave(pl, nTeg, GH.tegmen, tegB, r, { base: 0.1, edge: 0.55, ew: 0.1, shadow: 0.4, sw: 0.3, hatch: 0.1, freq: 9, amt: 0.6 })
      const tv = new Path()
      for (const o of [-0.22, 0, 0.2]) tv.add(bez([-4.6, 2.5 + o], [-0.5, 2.35 + o * 1.2], [4.0, 2.15 + o * 1.3], [7.9, 1.95 + o * 0.8]))
      stroke(pl, nTv, tv, r, 0.016)
      // legs: T1 and T2 walking legs, T3 the big jumping leg
      const legs: [SDF, Box][] = [[leg1, l1B], [leg2, l2B], [leg3, l3B]]
      const perL = share([1, 1, 2.2], nL), perC = share([1, 1, 2], nLc)
      legs.forEach(([f, b], i) => {
        engrave(pl, perL[i], f, b, r, { base: 0.1, edge: 0.55, ew: 0.08, shadow: 0.6, sw: 0.3, hatch: 0.9, freq: 8, amt: 0.4 })
        contour(pl, perC[i], f, grow(b, 0.2), r, 0.03)
      })
      // the hind femur's herringbone
      const fem = cap(-2.6, 0.3, 3.4, 2.2, 0.72, 0.24)
      const ax = 6.0, ay = 1.9, al = Math.hypot(ax, ay)
      fill(nFem, fem, [-3.4, -0.5, 3.8, 2.6], r, (x, y) => {
        const u = ((x + 2.6) * ax + (y - 0.3) * ay) / al, v = (-(x + 2.6) * ay + (y - 0.3) * ax) / al
        return Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (u / 0.42 + Math.abs(v) * 0.9)), 10)
      }, (x, y) => inkDot(pl, r, x, y))
      const sp = new Path()
      for (let t = 0.1; t < 0.95; t += 0.09) {
        const x = 3.4 + (0.9 - 3.4) * t, y = 2.2 + (-3.1 - 2.2) * t
        sp.add([[x + 0.12, y], [x + 0.32, y + 0.1]])
      }
      stroke(pl, nSp, sp, r, 0.012)
      // antenna, pronotum edges, mouthparts, cerci
      const ant = new Path().add(bez([-8.9, 2.75], [-9.6, 3.6], [-10.5, 4.4], [-11.5, 5.4]))
      stroke(pl, Math.floor(nAnt * 0.7), ant, r, 0.035)
      ticks(pl, 8, bez([-8.9, 2.75], [-9.6, 3.6], [-10.5, 4.4], [-11.5, 5.4]), 0.22, 0.07, r)
      const pro = new Path().add([[-7.5, 2.7], [-4.9, 2.75], [-4.7, 1.2], [-5.2, 0.5]]).add([[-7.3, 1.85], [-5.0, 1.9]], 0.6)
      stroke(pl, nPro, pro, r, 0.03)
      const misc = new Path()
      misc.add(bez([-9.2, 0.0], [-9.35, -0.3], [-9.2, -0.55], [-9.0, -0.7]))
      misc.add([[7.7, 0.95], [8.35, 1.3]])
      misc.add([[7.7, 0.6], [8.3, 0.45]])
      stroke(pl, nMisc, misc, r, 0.025)
    },
  }
}
/** Figure 18.18: brine shrimp and grasshopper, Hox colour for Hox colour */
export function crustForms(seed = 18) {
  const fbs = linkedSheets([artemiaSheet(), grasshopperSheet()], CRUST_POOLS, seed, 26000, 40000)
  return finishLinked(fbs, 'x', 0, seed)
}

/* ======================================================= GUEST · CIONA
   The tadpole larva of the sea squirt Ciona robusta, in side view: the trunk
   with its three adhesive papillae in front and, in the sensory vesicle, the
   otolith and the ocellus (two dark pigment spots); the long tail with its fin
   fold. Down the middle of the tail runs the notochord: a single file of
   exactly forty cells stacked like coins, glowing gold for Brachyury. Muscle
   cells flank it (pale rose), the dorsal nerve cord runs above it and the
   endodermal strand below. Muscle-cell boundaries are schematic. */
const CI_TAIL0 = -3.4, CI_TAIL1 = 8.6
const ciY = (x: number) => 0.2 - 0.0125 * (x - CI_TAIL0) + 0.15 * Math.sin((x - CI_TAIL0) * 0.35) * ss(0, 12, x - CI_TAIL0)
const ciR = (x: number) => 0.8 - 0.55 * ss(CI_TAIL0, CI_TAIL1, x)
const NOTO0 = -3.1, NOTO1 = 8.1
const NOTO_W = (NOTO1 - NOTO0) / CIONA.notochordCells
const notoH = (i: number) => 0.3 - 0.14 * (i / (CIONA.notochordCells - 1))
export const CIONA_PARTS = {
  trunk: [-5.6, 0.2] as P2,
  tail: [3.0, ciY(3.0)] as P2,
  papillae: [[-8.2, 1.0], [-8.4, 0.2], [-8.2, -0.6]] as P2[],
  otolith: [-5.15, 0.9] as P2,
  ocellus: [-4.6, 1.05] as P2,
  sensoryVesicle: [-4.9, 0.95] as P2,
  notochordStart: [NOTO0, ciY(NOTO0)] as P2,
  notochordEnd: [NOTO1, ciY(NOTO1)] as P2,
  cells: Array.from({ length: CIONA.notochordCells }, (_, i) => {
    const x = NOTO0 + (i + 0.5) * NOTO_W
    return [x, ciY(x)] as P2
  }),
  nerveCord: [2.0, ciY(2.0) + 0.42] as P2,
  muscle: [1.0, ciY(1.0) - 0.5] as P2,
  fin: [6.0, ciY(6.0) + 1.0] as P2,
}
export function cionaForm(seed = 40) {
  const r = rng(seed)
  const pl = new PL()
  const tpts: P2[] = [], trad: number[] = [], fpts: number[] = []
  for (let x = CI_TAIL0; x <= CI_TAIL1 + 1e-6; x += 0.25) (tpts.push([x, ciY(x)]), trad.push(ciR(x)), fpts.push(ciR(x) + 0.6 * ss(-3.2, -1.2, x)))
  const tail = tubeField(tpts, trad), finT = tubeField(tpts, fpts)
  const trunkE = ell(-5.6, 0.2, 2.5, 1.85, 0.05)
  const pap = umin(...CIONA_PARTS.papillae.map(([x, y]) => cir(x, y, 0.24)))
  const bbox: Box = [-8.8, -1.9, 9.6, 2.3]
  const body = bake((x, y) => sminv(sminv(trunkE(x, y), tail.d(x, y), 0.6), pap(x, y), 0.15), grow(bbox, 0.4), 0.025)
  const fin = bake((x, y) => sminv(trunkE(x, y) + 0.12, finT.d(x, y), 0.5), grow(bbox, 0.6), 0.03)
  const trunkOnly = cheap((x: number, y: number) => Math.max(body(x, y), x - CI_TAIL0 - 0.4))
  const tailOnly = strip(body, CI_TAIL0 + 0.4, 9.6)
  const [nTr, nTc, nTl, nFc, nRay, nGold, nCell, nNerve, nEndo, nMus, nMb, nTw, nDet, nS] = share([22, 4, 9, 3, 2.5, 24, 5, 3.5, 1.2, 4, 1.8, 7, 4, 1.5])
  // trunk: engraved, the gut stippled darker; tail lightly engraved
  const gut = ell(-5.8, -0.45, 1.35, 0.9, 0.2)
  engrave(pl, nTr, trunkOnly, [-8.8, -1.8, -2.9, 2.2], r, { base: 0.06, edge: 0.5, ew: 0.18, shadow: 0.6, sw: 1.0, hatch: 0.7, freq: 6.5, amt: 0.45, tone: (x, y) => (gut(x, y) < 0 ? 0.28 : 0), toneMax: 0.28 })
  engrave(pl, nTl, tailOnly, [CI_TAIL0, -1.0, 9.6, 1.3], r, { base: 0.01, edge: 0.5, ew: 0.1, shadow: 0.35, sw: 0.4, hatch: 1.4, freq: 7, amt: 0.5 })
  contour(pl, nTc, body, grow(bbox, 0.3), r, 0.035)
  // the fin fold (tunic): a fine outline and faint radiating rays
  contour(pl, nFc, fin, grow(bbox, 0.9), r, 0.02, 0.7)
  fill(nRay, (x, y) => Math.max(fin(x, y), -body(x, y)), [-2.8, -1.6, 9.8, 2.0], r, (x, y) => {
    const s = Math.sign(y - ciY(x)) || 1
    return 0.5 * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ((x - s * 0.35 * (y - ciY(x))) / 0.22)), 12)
  }, (x, y) => inkDot(pl, r, x, y, 0.5, 0.03))
  // the notochord: forty stacked cells, glowing gold
  const gold = PIG.gold
  const perCell = Math.floor(nGold / CIONA.notochordCells), perEdge = Math.floor(nCell / CIONA.notochordCells)
  for (let i = 0; i < CIONA.notochordCells; i++) {
    const x0 = NOTO0 + i * NOTO_W, cx = x0 + NOTO_W / 2, cy = ciY(cx), h = notoH(i)
    for (let k = 0; k < perCell; k++) {
      const u = (r() * 2 - 1) * (NOTO_W / 2 - 0.02), v = (r() * 2 - 1) * h
      const e = Math.abs(v) / h
      pl.push(cx + u, cy + v, (r() - 0.5) * 0.02, 0.045 + 0.02 * r(), mixc(gold, hex('#fff1b0'), 0.35 * (1 - e) * (1 - (2 * Math.abs(u)) / NOTO_W)), 0.55 + 0.35 * (1 - e * e), 1)
    }
    // the coin edges: a dark line between cells, the sheath above and below
    for (let k = 0; k < perEdge; k++) {
      const t = r()
      if (t < 0.5) pl.push(x0 + (r() - 0.5) * 0.02, cy + (r() * 2 - 1) * h, 0, 0.03, scale(hex('#7a4a00'), 1), 0.85, 0.15)
      else {
        const sgn = t < 0.75 ? 1 : -1
        inkDot(pl, r, x0 + r() * NOTO_W, cy + sgn * (h + 0.02 + (r() - 0.5) * 0.02), 0.9, 0.03)
      }
    }
  }
  // dorsal nerve cord (two walls) from the sensory vesicle to the tail tip, endodermal strand below
  const nerve = new Path()
  for (const o of [0.34, 0.46]) {
    const p: Poly = [[-4.5, 1.25 + o * 0.3], [-3.5, ciY(-3.5) + 0.62 + o * 0.2]]
    for (let x = NOTO0; x <= NOTO1 + 0.3; x += 0.25) p.push([x, ciY(x) + notoH(Math.min(39, Math.max(0, (x - NOTO0) / NOTO_W))) + o - 0.2])
    nerve.add(p)
  }
  stroke(pl, nNerve, nerve, r, 0.014)
  const endo = new Path()
  const ep: Poly = []
  for (let x = NOTO0 + 0.2; x <= NOTO1 - 0.8; x += 0.25) ep.push([x, ciY(x) - notoH(Math.max(0, (x - NOTO0) / NOTO_W)) - 0.1])
  endo.add(ep)
  for (let i = 0; i < nEndo; i++) {
    const [x, y] = endo.at(r())
    if (Math.sin(x * 40) > 0.2) inkDot(pl, r, x, y, 0.8, 0.03)
  }
  // muscle bands flanking the notochord: rose wash, cell boundaries
  const muscle = (x: number, y: number) => {
    if (x < NOTO0 || x > NOTO1) return 1
    const i = Math.min(39, Math.max(0, (x - NOTO0) / NOTO_W))
    const dy = Math.abs(y - ciY(x))
    return Math.max(notoH(i) + 0.04 - dy, dy - ciR(x) + 0.06, tailOnly(x, y))
  }
  wash(pl, nMus, muscle, [NOTO0, -1.0, NOTO1, 1.2], r, PIG.rose, { alpha: 0.07, pig: 0.02, bleed: 0.04 })
  const mb = new Path()
  for (let x = NOTO0 + 1.85; x < NOTO1; x += 1.85)
    for (const s of [1, -1]) mb.add([[x - 0.1, ciY(x) + s * (notoH((x - NOTO0) / NOTO_W) + 0.06)], [x + 0.12, ciY(x) + s * (ciR(x) - 0.06)]])
  stroke(pl, nMb, mb, r, 0.014, 0.7)
  // a pale ochre wash over the trunk
  wash(pl, nTw, trunkOnly, [-8.8, -1.8, -2.9, 2.2], r, PIG.ochre, { alpha: 0.08, pig: 0.02 })
  // sensory vesicle with the otolith and the ocellus; papillae outlined
  const [nO, nOc] = share([1, 1.4], nDet)
  // in the sensory vesicle: the otolith a round grain, the ocellus a pigment cup
  fill(nO, cir(-5.15, 0.9, 0.11), [-5.27, 0.78, -5.03, 1.02], r, () => 1, (x, y) => inkDot(pl, r, x, y, 1, 0.03))
  const cup = (x: number, y: number) => Math.max(Math.hypot(x + 4.6, y - 1.05) - 0.19, 0.12 - Math.hypot(x + 4.5, y - 0.99))
  fill(nOc, cup, [-4.8, 0.85, -4.4, 1.25], r, () => 1, (x, y) => inkDot(pl, r, x, y, 1, 0.03))
  groundShadow(pl, nS, 0.0, -2.1, 8.5, 0.12, r)
  const fb = new FB()
  put(fb, pl, Math.min(pl.n, N), 'none')
  return finish(fb, 'x', seed)
}
