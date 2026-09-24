/* In-place labels: DOM tags pinned to points in the 3-D scene, fading in and
   out with film time, like the callouts on a textbook figure. The key term
   being read (vocab) lights its label and aims the spotlight at it. */
import * as THREE from 'three'
import { film, band } from '../core/film'
import type { Engine } from '../gl/engine'
import { vocab } from './lesson'
import { LABELS, REF, type Lab } from './anchors'

export function buildLabels(engine: Engine) {
  const root = document.querySelector<HTMLElement>('[data-labels]')
  if (!root) return () => {}
  REF.mol = engine.mol
  type L = Lab & { el: HTMLElement; sub: HTMLElement; last: number; x: number; y: number; vis: number }
  const list: L[] = LABELS.map((l) => {
    const el = document.createElement('div')
    el.className = 'lab' + (l.left ? ' l' : '') + (l.serif ? ' serif' : '')
    if (l.c) el.style.setProperty('--c', l.c)
    el.innerHTML = `<i></i><span>${l.n ? `<b>${l.n}</b>` : ''}<em></em></span>`
    root.appendChild(el)
    return { ...l, el, sub: el.querySelector('em')!, last: -1, x: 0, y: 0, vis: 0 }
  })
  const byId = new Map(list.filter((l) => l.id).map((l) => [l.id!, l]))
  const v = new THREE.Vector3()
  let hot: L | null = null
  return () => {
    const F = film.F
    for (const l of list) {
      let a = band(l.r[0], l.r[1], l.r[2], l.r[3], F)
      if (a < 0.005) {
        if (l.last !== 0) ((l.el.style.opacity = '0'), (l.last = 0))
        l.vis = 0
        continue
      }
      const p = l.at(F)
      const [x, y, ok] = engine.project(v.set(p[0], p[1], p[2]))
      if (!ok || x < -50 || y < -50 || x > innerWidth + 50 || y > innerHeight + 50) a = 0
      l.x = x
      l.y = y
      l.vis = a
      l.el.style.opacity = a.toFixed(3)
      l.last = a
      l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(${l.left ? '-100%' : '0'}, -50%)`
      const t = typeof l.text === 'function' ? l.text(F) : l.text
      if (l.sub.textContent !== t) l.sub.textContent = t
    }
    const vk = vocab.active ? byId.get(vocab.active) : undefined
    const target = vk && vk.vis > 0.5 ? vk : null
    if (target !== hot) {
      hot?.el.classList.remove('hot')
      target?.el.classList.add('hot')
      hot = target
    }
    if (target) {
      engine.spot.x = target.x
      engine.spot.y = target.y
      engine.spot.r = 260 * (innerHeight / 900)
    }
    engine.spot.amt = target ? 0.55 * vocab.strength * (film.w0 === 3 || film.w1 === 3 ? 0.4 : 1) : 0
  }
}
