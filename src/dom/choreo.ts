/* The DOM half of the film: which copy block is on screen, which panel is
   lit, the chrome, and the theme (light text on water, ink on paper). All a
   function of film time, so it reverses exactly on scroll-up. */
import { film, band, smooth, CHAPTERS } from '../core/film'
import { scroll, scrollToF } from '../core/scroll'

type Beat = { el: HTMLElement; a: number; b: number; last: number }
type Panel = { el: HTMLElement; a: number; b: number; last: number }
type Chapter = { n: number; beats: Beat[]; panels: Panel[] }

const WORLD_NAMES = ['Sunlit water', 'The lab', 'Graph paper', 'Field notebook']
const WORLD_KEYS = ['ocean', 'lab', 'graph', 'note']

export function buildChoreo() {
  const chapters: Chapter[] = []
  document.querySelectorAll<HTMLElement>('section.chapter').forEach((sec) => {
    const n = parseFloat(sec.dataset.f0!)
    const beats: Beat[] = []
    sec.querySelectorAll<HTMLElement>('.beat').forEach((el) => {
      const [a, b] = el.dataset.at!.split(',').map(Number)
      beats.push({ el, a, b, last: -1 })
    })
    const panels: Panel[] = []
    sec.querySelectorAll<HTMLElement>('[data-inst]').forEach((el) => {
      const [a, b] = el.dataset.inst!.split(',').map(Number)
      panels.push({ el, a, b, last: -1 })
    })
    chapters.push({ n, beats, panels })
  })

  const chnum = document.querySelector('[data-chnum]')
  const chname = document.querySelector('[data-chname]')
  const worldEl = document.querySelector('[data-world]')
  const fill = document.querySelector<HTMLElement>('.rail-fill')
  const hero = document.querySelector<HTMLElement>('[data-hero]')
  const heroChrome = Array.from(document.querySelectorAll<HTMLElement>('.hero-top, .hero-foot'))
  const root = document.documentElement

  const rail = document.querySelector('.rail-line')!
  const ticks = CHAPTERS.map((name, i) => {
    const b = document.createElement('button')
    b.className = 'rail-tick'
    b.dataset.label = `${String(i).padStart(2, '0')} ${name}`
    b.setAttribute('aria-label', `Go to ${name}`)
    b.addEventListener('click', () => (i === 0 ? scroll.lenis?.scrollTo(0, { duration: 2.2 }) : scrollToF(i + 0.001)))
    rail.appendChild(b)
    return b
  })
  const placeTicks = () => {
    for (let i = 0; i < ticks.length; i++) {
      const s = scroll.sections.find((q) => q.f0 === i && q.el.classList.contains('chapter'))
      if (s) ticks[i].style.top = `${((s.top / scroll.max) * 100).toFixed(2)}%`
    }
  }
  placeTicks()
  addEventListener('resize', () => requestAnimationFrame(placeTicks))
  document.fonts?.ready.then(placeTicks)
  document.querySelectorAll<HTMLElement>('[data-to]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault()
      scroll.lenis?.scrollTo(0, { duration: 3 })
    }),
  )

  let lastCh = -1
  let lastDark = -1
  let lastW = ''
  return () => {
    const F = film.F
    for (const c of chapters) {
      const u = F - c.n
      if (u < -0.3 || u > 1.3) {
        for (const b of c.beats) if (b.last !== 0) ((b.last = 0), (b.el.style.opacity = '0'), (b.el.style.visibility = 'hidden'))
        for (const p of c.panels) if (p.last !== 0) ((p.last = 0), (p.el.style.opacity = '0'), (p.el.style.visibility = 'hidden'))
        continue
      }
      for (const b of c.beats) {
        // the first card is already up as the chapter arrives; the last stays as it leaves
        const a0 = b.a <= 0.001 ? -0.03 : b.a
        const b1 = b.b >= 0.999 ? 1.03 : b.b
        const w = Math.min(0.025, (b1 - a0) * 0.2)
        const al = band(a0, a0 + w, b1 - w, b1, u)
        const q = Math.round(al * 200) / 200
        if (q === b.last) continue
        b.last = q
        const dir = u < (b.a + b.b) / 2 ? 1 : -1
        b.el.style.opacity = String(q)
        b.el.style.visibility = q < 0.005 ? 'hidden' : 'visible'
        b.el.style.transform = `translate3d(0, ${((1 - q) * 22 * dir).toFixed(1)}px, 0)`
      }
      for (const p of c.panels) {
        const al = band(p.a, p.a + 0.03, p.b - 0.03, p.b, u)
        const q = Math.round(al * 200) / 200
        if (q === p.last) continue
        p.last = q
        p.el.style.opacity = String(q)
        p.el.style.visibility = q < 0.005 ? 'hidden' : 'visible'
        p.el.style.setProperty('--ix', `${((1 - q) * 24).toFixed(1)}px`)
      }
    }

    /* chrome */
    if (film.chapter !== lastCh) {
      lastCh = film.chapter
      const c = Math.min(CHAPTERS.length - 1, film.chapter)
      if (chnum) chnum.textContent = String(c).padStart(2, '0')
      if (chname) chname.textContent = CHAPTERS[c]
      ticks.forEach((t, i) => t.classList.toggle('on', i === c))
    }
    if (fill) fill.style.transform = `scaleY(${(scroll.y / scroll.max).toFixed(4)})`
    if (hero) {
      const o = 1 - smooth(0.16, 0.3, F)
      hero.style.opacity = o.toFixed(3)
      hero.style.transform = `translate3d(0, ${(-60 * smooth(0.1, 0.3, F)).toFixed(1)}px, 0)`
      for (const h of heroChrome) h.style.opacity = o.toFixed(3)
    }

    /* theme: which world is (mostly) on screen */
    const d = Math.round(film.dark * 100) / 100
    if (d !== lastDark) {
      lastDark = d
      root.style.setProperty('--dark', String(d))
    }
    const w = film.wt > 0.5 ? film.w1 : film.w0
    const wk = WORLD_KEYS[w]
    if (wk !== lastW) {
      lastW = wk
      document.body.dataset.w = wk
      if (worldEl) worldEl.textContent = WORLD_NAMES[w]
    }
  }
}
