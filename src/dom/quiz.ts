/* The final quiz: twenty multiple-choice questions after the film. One try
   each; the explanation opens as soon as you choose. At the end, a score by
   textbook section with a link back into the film for anything missed.
   Retaking reshuffles every question's options. */
import { scrollToF } from '../core/scroll'

/* where each section is taught in the film (film time of its chapter) */
const SECTION_F: Record<string, number> = { '18.1': 1, '18.2': 2, '18.3': 3, '18.4': 4, '18.5': 7, '18.6': 9 }

export function buildQuiz() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.qz'))
  const scoreEl = document.querySelector<HTMLElement>('[data-qz-score]')
  const fill = document.querySelector<HTMLElement>('[data-qz-fill]')
  const result = document.querySelector<HTMLElement>('[data-qz-result]')
  const finalEl = document.querySelector<HTMLElement>('[data-qz-final]')
  const secsEl = document.querySelector<HTMLElement>('[data-qz-secs]')
  const retake = document.querySelector<HTMLButtonElement>('[data-qz-retake]')
  if (!cards.length) return
  const answers = new Map<HTMLElement, boolean>()

  const update = () => {
    const done = answers.size
    const right = [...answers.values()].filter(Boolean).length
    if (scoreEl) scoreEl.textContent = done < cards.length ? `${done} / ${cards.length} answered · ${right} right` : `${right} / ${cards.length} right`
    if (fill) fill.style.transform = `scaleX(${done / cards.length})`
    if (done < cards.length || !result) return
    // the result: overall, then by section with a way back to each
    result.hidden = false
    const pct = Math.round((right / cards.length) * 100)
    if (finalEl) finalEl.textContent = `${right} of ${cards.length} · ${pct}%`
    if (secsEl) {
      secsEl.innerHTML = ''
      const secs = [...new Set(cards.map((c) => c.dataset.sec!))]
      for (const sec of secs) {
        const mine = cards.filter((c) => c.dataset.sec === sec)
        const ok = mine.filter((c) => answers.get(c)).length
        const li = document.createElement('li')
        li.className = ok === mine.length ? 'full' : 'miss'
        li.innerHTML = `<b>${sec}</b><span>${ok} / ${mine.length}</span>`
        if (ok < mine.length) {
          const b = document.createElement('button')
          b.className = 'mono'
          b.textContent = `Review ${sec} ↑`
          b.addEventListener('click', () => scrollToF(SECTION_F[sec] + 0.001))
          li.appendChild(b)
        }
        secsEl.appendChild(li)
      }
    }
  }

  for (const card of cards) {
    card.querySelectorAll<HTMLButtonElement>('.qz-opts button').forEach((b) =>
      b.addEventListener('click', () => {
        if (answers.has(card)) return
        const right = b.hasAttribute('data-ok')
        answers.set(card, right)
        card.classList.add('answered', right ? 'right' : 'wrong')
        b.classList.add(right ? 'ok' : 'no')
        card.querySelectorAll<HTMLButtonElement>('.qz-opts button').forEach((o) => {
          if (o.hasAttribute('data-ok')) o.classList.add('ok')
          o.disabled = true
        })
        update()
      }),
    )
  }

  retake?.addEventListener('click', () => {
    answers.clear()
    // a fresh, still balanced answer key: each letter correct equally often,
    // in a random order, and the wrong options shuffled around it
    const shuffle = <T,>(a: T[]) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }
    const n = cards[0].querySelectorAll('.qz-opts li').length
    const key = shuffle(cards.map((_, i) => i % n))
    cards.forEach((card, k) => {
      card.classList.remove('answered', 'right', 'wrong')
      const ol = card.querySelector('.qz-opts')!
      const lis = Array.from(ol.children) as HTMLElement[]
      const right = lis.find((li) => li.querySelector('[data-ok]'))!
      const wrong = shuffle(lis.filter((li) => li !== right))
      wrong.splice(key[k], 0, right)
      wrong.forEach((li) => ol.appendChild(li))
      ol.querySelectorAll('button').forEach((o) => {
        o.classList.remove('ok', 'no')
        o.disabled = false
      })
    })
    if (result) result.hidden = true
    update()
    document.getElementById('quiz')?.scrollIntoView({ behavior: 'smooth' })
  })
  update()
}
