import './styles/main.css'
import { gsap } from 'gsap'
import { initScroll, tickScroll, measure, scroll, yForF } from './core/scroll'
import { film, updateFilm } from './core/film'
import { buildChoreo } from './dom/choreo'
import { buildType } from './dom/type'
import { buildLesson } from './dom/lesson'
import { buildCursor } from './dom/cursor'

/* Surface anything that escapes the render loop: a throw inside rAF would
   otherwise just freeze the film silently. */
function trap(msg: string) {
  let el = document.getElementById('err')
  if (!el) {
    el = document.createElement('pre')
    el.id = 'err'
    el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;max-width:60vw;font:11px/1.4 ui-monospace,monospace;color:#d33;white-space:pre-wrap;pointer-events:none'
    document.body.appendChild(el)
  }
  el.textContent = (el.textContent || '') + msg + '\n'
}
addEventListener('error', (e) => trap('ERR ' + e.message))
addEventListener('unhandledrejection', (e) => trap('REJ ' + String((e as PromiseRejectionEvent).reason)))

async function boot() {
  await document.fonts?.ready
  buildType()
  initScroll()
  const canvas = document.getElementById('gl') as HTMLCanvasElement
  const loader = document.querySelector<HTMLElement>('[data-loader]')
  const bar = document.querySelector<HTMLElement>('[data-loadbar]')
  const choreo = buildChoreo()
  const lesson = buildLesson()
  const cursor = buildCursor()

  let engine: import('./gl/engine').Engine | null = null
  let labels: (() => void) | null = null
  let overlay: (() => void) | null = null
  if (document.createElement('canvas').getContext('webgl2')) {
    const { Engine } = await import('./gl/engine')
    engine = new Engine(canvas)
    await engine.build((p) => bar && (bar.style.transform = `scaleX(${p.toFixed(3)})`))
    const { buildLabels } = await import('./dom/labels')
    const { buildOverlay } = await import('./dom/overlay')
    labels = buildLabels(engine)
    overlay = buildOverlay(engine)
  } else document.body.classList.add('no-gl')
  loader?.classList.add('done')
  engine?.warm()

  let pinned: number | null = null
  // dev handles: __m.go(5.5) scrolls to a moment; __m.pin(5.5) freezes the film there (null to release)
  ;(window as any).__m = { engine, film, go: (F: number) => scroll.lenis?.scrollTo(yForF(F), { immediate: true, force: true }), pin: (F: number | null) => (pinned = F), frame: () => { tickScroll(); updateFilm(pinned ?? scroll.F); engine?.frame(0.016); choreo(); lesson(); labels?.(); overlay?.() } }
  const qF = new URLSearchParams(location.search).get('f')
  measure()
  if (qF) requestAnimationFrame(() => (window as any).__m.go(parseFloat(qF)))

  let last = performance.now()
  gsap.ticker.add(() => {
    const now = performance.now()
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    tickScroll()
    updateFilm(pinned ?? scroll.F)
    engine?.frame(dt)
    choreo()
    lesson()
    labels?.()
    overlay?.()
    cursor(dt)
  })
}

boot()
