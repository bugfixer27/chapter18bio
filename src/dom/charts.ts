/* Chart overlays: the crisp half of every chart. The particles draw the data;
   these draw axes, ticks and words, projected from each form's layout every
   frame so they stay locked to the particles. A chart shows only once its
   form has (almost) finished arriving, and leaves as soon as it departs. */
import { film, smooth } from '../core/film'
import { COST_AXES, BROWSER } from '../gl/forms/charts'
import { SCATTER_AXES, DENSITY, PIE, SWITCH_AXES, SWITCH_PEAKS, SPHERES } from '../gl/forms/genome'
import { COMPOSITION, SUBSLICES, TABLE_18_1 } from '../science/genomes'

type Proj = (x: number, y: number, z?: number) => [number, number]
export type Chart = { build: (svg: SVGSVGElement) => { update: (proj: Proj) => void } }

const NS = 'http://www.w3.org/2000/svg'
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  parent.appendChild(e)
  return e
}

/** how present a form is: 1 while it holds, rising at the very end of its arrival */
function presence(names: string[]) {
  let v = 0
  if (names.includes(film.formA)) v = Math.max(v, 1 - smooth(0.0, 0.25, film.morph))
  if (names.includes(film.formB)) v = Math.max(v, smooth(0.8, 1.0, film.morph))
  return v
}

type Item = { node: SVGElement; place: (p: Proj) => void }
function chart(names: string[], make: (g: SVGGElement, items: Item[]) => void): Chart {
  return {
    build(svg) {
      const g = el('g', {}, svg) as SVGGElement
      const items: Item[] = []
      make(g, items)
      let last = -1
      return {
        update(proj) {
          const v = Math.round(presence(names) * 100) / 100
          if (v !== last) {
            last = v
            g.style.opacity = String(v)
            g.style.display = v < 0.01 ? 'none' : ''
          }
          if (v < 0.01) return
          for (const it of items) it.place(proj)
        },
      }
    },
  }
}

const line = (g: Element, items: Item[], cls: string, a: () => [number, number], b: () => [number, number]) => {
  const n = el('line', { class: cls }, g)
  items.push({
    node: n,
    place: (p) => {
      const [x1, y1] = p(...a())
      const [x2, y2] = p(...b())
      n.setAttribute('x1', x1.toFixed(1))
      n.setAttribute('y1', y1.toFixed(1))
      n.setAttribute('x2', x2.toFixed(1))
      n.setAttribute('y2', y2.toFixed(1))
    },
  })
}
const text = (g: Element, items: Item[], s: string, at: () => [number, number], opts: { anchor?: string; dx?: number; dy?: number; cls?: string; fill?: string } = {}) => {
  const n = el('text', { 'text-anchor': opts.anchor ?? 'middle', class: opts.cls ?? '' }, g)
  if (opts.fill) n.setAttribute('fill', opts.fill)
  n.textContent = s
  items.push({
    node: n,
    place: (p) => {
      const [x, y] = p(...at())
      n.setAttribute('x', (x + (opts.dx ?? 0)).toFixed(1))
      n.setAttribute('y', (y + (opts.dy ?? 0)).toFixed(1))
    },
  })
}
const usd = (v: number) => (v >= 1e6 ? `$${v / 1e6}M` : v >= 1e3 ? `$${v / 1e3}K` : `$${v}`)
const mbLabel = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('en-US')},000` : String(v))

export const CHARTS: Chart[] = [
  /* 18.1 · the cost of a human genome */
  chart(['cost'], (g, it) => {
    const A = COST_AXES
    line(g, it, 'ax', () => [A.x0, A.y1], () => [A.x0, A.y0])
    line(g, it, 'ax', () => [A.x0, A.y0], () => [A.x1, A.y0])
    for (const yr of A.xTicks) text(g, it, String(yr), () => A.toWorld(yr, 1e3), { dy: 20 })
    for (const v of A.yTicks) {
      line(g, it, 'grid', () => A.toWorld(2000, v), () => A.toWorld(2020, v))
      text(g, it, usd(v), () => A.toWorld(2000, v), { anchor: 'end', dx: -10, dy: 4 })
    }
    text(g, it, 'Cost to sequence one human genome (log scale)', () => [A.x0, A.y1], { anchor: 'start', dy: -14, cls: 't-dim' })
    for (const p of A.points) {
      text(g, it, `${usd(p.usd)} · ${p.time}`, () => p.xy, { anchor: 'start', dx: 18, dy: -6, cls: 't-big' })
      text(g, it, `${p.year} · ${p.label}`, () => p.xy, { anchor: 'start', dx: 18, dy: 10, cls: 't-dim' })
    }
  }),

  /* 18.2 · the genome browser's tracks */
  chart(['browser', 'browser-cons'], (g, it) => {
    const B = BROWSER
    text(g, it, 'Gene model', () => [B.x0, B.gene.y], { anchor: 'start', dy: -18, cls: 't-dim' })
    text(g, it, 'RNA-seq · where it is transcribed', () => [B.x0, B.rnaseq.y0 + B.rnaseq.h], { anchor: 'start', dy: -6, cls: 't-dim' })
    text(g, it, 'Conservation in a related species', () => [B.x0, B.cons.y0 + B.cons.h], { anchor: 'start', dy: -6, cls: 't-dim' })
    text(g, it, 'start', () => [B.startCodon, B.gene.y + 0.9], { cls: 't-dim' })
    text(g, it, 'stop', () => [B.stopCodon, B.gene.y + 0.9], { cls: 't-dim' })
    text(g, it, 'exon', () => [(B.exons[2].x0 + B.exons[2].x1) / 2, B.gene.y - 0.9], { dy: 8 })
    text(g, it, 'intron', () => [(B.exons[2].x1 + B.exons[3].x0) / 2, B.gene.y - 0.9], { dy: 8, cls: 't-dim' })
  }),
  chart(['browser-cons'], (g, it) => {
    const B = BROWSER
    for (const x of B.enhancers) text(g, it, 'conserved · noncoding', () => [x, B.cons.y0 + B.cons.h + 0.4], { cls: 't-big', fill: '#b07800' })
  }),

  /* 18.3 · genome size vs number of genes */
  chart(['scatter'], (g, it) => {
    const A = SCATTER_AXES
    line(g, it, 'ax', () => [A.x0, A.y1], () => [A.x0, A.y0])
    line(g, it, 'ax', () => [A.x0, A.y0], () => [A.x1, A.y0])
    for (const v of A.xTicks) text(g, it, mbLabel(v), () => A.toWorld(v, 0), { dy: 20 })
    for (const v of A.yTicks) {
      line(g, it, 'grid', () => A.toWorld(1, v), () => A.toWorld(Math.pow(10, A.logMax), v))
      text(g, it, v.toLocaleString('en-US'), () => A.toWorld(1, v), { anchor: 'end', dx: -10, dy: 4 })
    }
    text(g, it, 'Haploid genome size (Mb, log scale) →', () => A.toWorld(Math.pow(10, A.logMax / 2), 0), { dy: 42, cls: 't-dim' })
    text(g, it, 'Number of genes', () => [A.x0, A.y1], { anchor: 'start', dy: -12, cls: 't-dim' })
    for (const o of TABLE_18_1) {
      const lab = o.name === 'Paris japonica' ? 'Paris japonica · genes ND' : o.common
      text(g, it, lab, () => A.toWorld(o.mb, o.genes), { anchor: 'start', dx: 12, dy: o.common === 'human' ? -10 : 4, cls: o.common === 'human' || o.common === 'corn' || o.common === 'nematode' ? 't-big' : 't-dim' })
    }
  }),
  chart(['density'], (g, it) => {
    const D = DENSITY
    text(g, it, 'Genes in 1 Mb (one million base pairs)', () => [D.x0, D.rows[0].y + 1.1], { anchor: 'start', cls: 't-dim' })
    for (const r of D.rows) {
      text(g, it, r.common, () => [D.x0, r.y], { anchor: 'end', dx: -12, dy: 4, cls: r.common === 'human' ? 't-big' : '' })
      text(g, it, String(r.perMb), () => [D.x1, r.y], { anchor: 'start', dx: 12, dy: 4, cls: 't-big' })
    }
  }),

  /* 18.4 · the composition of the human genome */
  chart(['pie', 'pie-te'], (g, it) => {
    for (const c of COMPOSITION) {
      const s = PIE.slices[c.id]
      const out = PIE.r1 + 1.5
      const at = () => {
        const pull = (film.formA === 'pie-te' || film.formB === 'pie-te' ? PIE.pull.pieTe : PIE.pull.pie)[c.id] ?? 0
        return PIE.toWorld(s.mid, out + pull)
      }
      const right = Math.sin(s.mid) >= 0
      text(g, it, `${c.pct}%`, at, { anchor: right ? 'start' : 'end', cls: 't-big', dy: -3 })
      text(g, it, c.label, at, { anchor: right ? 'start' : 'end', cls: 't-dim', dy: 12 })
    }
  }),
  chart(['pie-te'], (g, it) => {
    for (const sub of SUBSLICES) {
      const s = PIE.subs[sub.id]
      if (!s) continue
      const pull = PIE.pull.pieTe[sub.parent!] ?? 0
      text(g, it, `${sub.label} · ${sub.pct}%`, () => PIE.toWorld(s.mid, (PIE.r0 + PIE.r1) / 2 + pull, 0), { cls: 't-big', fill: '#fff' })
    }
  }),

  /* 18.4 · the globin switch */
  chart(['switch'], (g, it) => {
    const A = SWITCH_AXES
    line(g, it, 'ax', () => [A.x0, A.y1], () => [A.x0, A.y0])
    line(g, it, 'ax', () => [A.x0, A.y0], () => [A.x1, A.y0])
    line(g, it, 'tk', () => [A.birthX, A.y0], () => [A.birthX, A.y1])
    text(g, it, 'birth', () => [A.birthX, A.y1], { dy: -8, cls: 't-dim' })
    for (const [k, r] of Object.entries(A.stages)) text(g, it, k, () => A.toWorld((r[0] + r[1]) / 2, 0), { dy: 20 })
    text(g, it, '% of chains made (schematic)', () => [A.x0, A.y1], { anchor: 'start', dy: -12, cls: 't-dim' })
    const names: Record<string, string> = { zeta: 'ζ (α family) · embryo', eps: 'ε · embryo', gamma: 'γ · fetus', beta: 'β · adult', alpha: 'α · fetus → adult', delta: 'δ · adult (minor)' }
    for (const [id, p] of Object.entries(SWITCH_PEAKS)) text(g, it, names[id] ?? id, () => p, { dy: -10, cls: 't-big' })
  }),
]

/* labels for the genome spheres, used by anchors.ts */
export const SPHERE_LABELS = SPHERES.list.map((s) => ({ name: s.common === 'human' ? 'Human · 3,000 Mb' : `${s.common} · ${s.mb.toLocaleString('en-US')} Mb`, x: s.x, y: s.y + s.r, z: s.z, big: s.common === 'Japanese canopy plant' || s.common === 'human' }))
