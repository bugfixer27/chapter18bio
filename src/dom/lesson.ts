/* The lesson layer: what turns the film into something you learn from.
     vocab       bold key terms light up one after another as a card is read,
                 and aim the spotlight at the thing they name (labels.ts)
     takeaways   each chapter ends on three lines that assemble from nothing
     predict     tap an answer before the scene shows it; a running score
     table 18.1  the book's table, beside the spheres, the row in view lit
     BLAST       a query aligned against database hits, letter by letter
   All of it but the answers is a function of film time. */
import { SplitText } from 'gsap/SplitText'
import { film, band, clamp01, smooth } from '../core/film'
import { TABLE_18_1 } from '../science/genomes'

export const vocab = { active: '' as string, strength: 0 }

export function buildLesson() {
  /* ---- vocab ---- */
  type Term = { el: HTMLElement; key: string }
  type Card = { el: HTMLElement; n: number; a: number; b: number; terms: Term[] }
  const cards: Card[] = []
  let hover: Term | null = null
  document.querySelectorAll<HTMLElement>('section.chapter').forEach((sec) => {
    const n = parseFloat(sec.dataset.f0!)
    sec.querySelectorAll<HTMLElement>('.beat').forEach((el) => {
      const [a, b] = el.dataset.at!.split(',').map(Number)
      const terms = Array.from(el.querySelectorAll<HTMLElement>('b.k')).map((t) => ({ el: t, key: t.dataset.k || '' }))
      terms.forEach((t) => {
        t.el.addEventListener('pointerenter', () => (hover = t))
        t.el.addEventListener('pointerleave', () => hover === t && (hover = null))
      })
      if (terms.length) cards.push({ el, n, a, b, terms })
    })
  })

  /* ---- takeaways: words drift in from scattered positions ---- */
  type Take = { el: HTMLElement; n: number; a: number; b: number; words: { el: HTMLElement; dx: number; dy: number; r: number; d: number }[]; last: number }
  const takes: Take[] = []
  document.querySelectorAll<HTMLElement>('[data-take]').forEach((el, k) => {
    const sec = el.closest('section')!
    const n = parseFloat(sec.dataset.f0!)
    const [a, b] = el.dataset.take!.split(',').map(Number)
    const split = SplitText.create(el.querySelectorAll('li > span, .tk-h'), { type: 'words', wordsClass: 'word' })
    const words = (split.words as HTMLElement[]).map((w, i) => {
      const h = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
      const f = h - Math.floor(h)
      const g = (Math.sin(i * 4.1 + k) + 1) / 2
      return { el: w, dx: (f - 0.5) * 520, dy: (g - 0.5) * 360, r: (f - 0.5) * 50, d: (i / Math.max(1, split.words.length)) * 0.5 }
    })
    takes.push({ el, n, a, b, words, last: -1 })
  })

  /* ---- predict ---- */
  const score = document.querySelector<HTMLElement>('[data-score]')
  const tally = { right: 0, done: 0 }
  const total = document.querySelectorAll('.predict').length
  document.querySelectorAll<HTMLElement>('.predict').forEach((card) => {
    const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('.opts button'))
    buttons.forEach((b) =>
      b.addEventListener('click', () => {
        if (card.classList.contains('answered')) return
        card.classList.add('answered')
        const right = b.hasAttribute('data-ok')
        b.classList.add(right ? 'ok' : 'no')
        for (const o of buttons) {
          if (o.hasAttribute('data-ok')) o.classList.add('ok')
          o.disabled = true
        }
        const why = card.querySelector<HTMLElement>('.why')
        if (why && !right) why.textContent = why.textContent!.replace(/^Right:\s*/, 'Not quite: ')
        tally.done++
        if (right) tally.right++
        if (score) {
          score.hidden = false
          score.textContent = `Predictions ${tally.right}/${tally.done} · ${total}`
        }
      }),
    )
  })

  /* ---- Table 18.1 ---- */
  const tbody = document.querySelector<HTMLElement>('[data-t181] tbody')
  const rows: HTMLElement[] = []
  if (tbody) {
    let grp = ''
    for (const o of TABLE_18_1) {
      if (o.group !== grp) {
        grp = o.group
        const g = document.createElement('tr')
        g.className = 'grp'
        g.innerHTML = `<td colspan="4">${grp}</td>`
        tbody.appendChild(g)
      }
      const tr = document.createElement('tr')
      const f = (n: number | null) => (n === null ? 'ND' : n.toLocaleString('en-US'))
      tr.innerHTML = `<td><i>${o.name}</i></td><td>${f(o.mb)}</td><td>${o.name === 'Homo sapiens' ? '&lt;21,000' : f(o.genes)}</td><td>${f(o.perMb)}</td>`
      tbody.appendChild(tr)
      rows.push(tr)
    }
  }
  const tableHot = (): number => {
    const F = film.F
    // the spheres pass left to right across the frame; light the one in view
    if (F >= 3.1 && F < 3.3) return Math.min(rows.length - 1, Math.floor(((F - 3.1) / 0.2) * rows.length))
    if (F >= 3.37 && F < 3.58) return rows.findIndex((_, i) => TABLE_18_1[i].common === 'human')
    return -1
  }

  /* ---- BLAST ---- */
  const blast = document.querySelector<HTMLElement>('[data-blast]')
  const bRows = document.querySelector<HTMLElement>('[data-blast-rows]')
  // An illustrative nucleotide query and hits (schematic: the identities are
  // chosen to show how BLAST reports similarity, not taken from real records)
  const Q = 'ATGAGCTCCCCGGGAACCGAGAGCGCGGGAAAGAGCCTGCAGTACCGAGTGGACCACCTG'
  const HITS = [
    { name: 'Query', seq: Q, q: true },
    { name: 'Species 1', seq: mutate(Q, 0.04, 1) },
    { name: 'Species 2', seq: mutate(Q, 0.12, 2) },
    { name: 'Species 3', seq: mutate(Q, 0.2, 3) },
    { name: 'Species 4', seq: mutate(Q, 0.31, 4) },
    { name: 'Unrelated', seq: mutate(Q, 0.72, 5) },
  ]
  const spans: HTMLElement[][] = []
  const scoreEls: HTMLElement[] = []
  if (bRows) {
    for (const h of HITS) {
      const row = document.createElement('div')
      row.className = 'bl-row' + (h.q ? ' q' : '')
      const nm = document.createElement('span')
      nm.className = 'nm'
      nm.textContent = h.name
      const sq = document.createElement('span')
      sq.className = 'sq'
      const sc = document.createElement('span')
      sc.className = 'sc'
      const letters: HTMLElement[] = []
      for (let i = 0; i < Q.length; i++) {
        const s = document.createElement('span')
        s.textContent = h.seq[i]
        if (!h.q) s.className = h.seq[i] === '-' ? 'g' : h.seq[i] === Q[i] ? 'm' : 'x'
        s.style.opacity = '0'
        sq.appendChild(s)
        letters.push(s)
      }
      row.append(nm, sq, sc)
      bRows.appendChild(row)
      spans.push(letters)
      scoreEls.push(sc)
    }
  }
  const ident = HITS.map((h) => (h.q ? 1 : h.seq.split('').filter((c, i) => c === Q[i]).length / Q.length))

  let lastBlast = -1
  return () => {
    const F = film.F

    /* vocab */
    let best: Term | null = null
    let strength = 0
    for (const c of cards) {
      const u = F - c.n
      const vis = band(c.a, c.a + 0.02, c.b - 0.02, c.b, u)
      if (vis < 0.02) {
        for (const t of c.terms) t.el.classList.remove('on', 'seen')
        continue
      }
      const p = clamp01((u - c.a - 0.01) / Math.max(0.02, c.b - c.a - 0.05))
      const i = Math.min(c.terms.length - 1, Math.floor(p * c.terms.length))
      c.terms.forEach((t, k) => {
        t.el.classList.toggle('on', k === i)
        t.el.classList.toggle('seen', k < i)
      })
      if (vis > strength) ((best = c.terms[i]), (strength = vis))
    }
    if (hover) ((best = hover), (strength = 1))
    vocab.active = best?.key ?? ''
    vocab.strength = strength

    /* takeaways */
    for (const t of takes) {
      const u = F - t.n
      const p = band(t.a, t.a + 0.02, t.b + 0.01, t.b + 0.04, u)
      const q = Math.round(p * 300) / 300
      if (q === t.last) continue
      t.last = q
      t.el.style.opacity = String(Math.min(1, q * 3))
      t.el.style.visibility = q < 0.003 ? 'hidden' : 'visible'
      for (const w of t.words) {
        const k = smooth(w.d, w.d + 0.5, q)
        w.el.style.transform = `translate3d(${(w.dx * (1 - k)).toFixed(1)}px, ${(w.dy * (1 - k)).toFixed(1)}px, 0) rotate(${(w.r * (1 - k)).toFixed(1)}deg)`
        w.el.style.opacity = k.toFixed(3)
      }
    }

    /* table */
    const hot = tableHot()
    rows.forEach((r, i) => r.classList.toggle('hot', i === hot))

    /* BLAST: the panel slides in; each hit's letters align and colour in turn */
    if (blast) {
      const u = F - 2
      const vis = band(0.2, 0.225, 0.29, 0.31, u)
      const q = Math.round(vis * 100) / 100
      if (q !== lastBlast) {
        lastBlast = q
        blast.style.opacity = String(q)
        blast.style.visibility = q < 0.01 ? 'hidden' : 'visible'
        blast.style.transform = `translate3d(${((1 - q) * 30).toFixed(1)}px, 0, 0)`
      }
      if (q > 0) {
        const prog = clamp01((u - 0.2) / 0.075)
        spans.forEach((letters, r) => {
          const rp = clamp01(prog * HITS.length - r * 0.6)
          const n = Math.floor(rp * letters.length)
          letters.forEach((l, i) => (l.style.opacity = i < n ? '1' : '0'))
          scoreEls[r].textContent = rp >= 1 ? (r === 0 ? 'query' : `${Math.round(ident[r] * 100)}%`) : ''
        })
      }
    }
  }
}

/** a deterministic copy of s with a fraction of positions changed (and a gap or two) */
function mutate(s: string, frac: number, seed: number) {
  let x = seed * 9301 + 49297
  const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
  const B = 'ACGT'
  return s
    .split('')
    .map((c) => {
      const t = r()
      if (t < frac * 0.12) return '-'
      if (t < frac) return B[(B.indexOf(c) + 1 + Math.floor(r() * 3)) % 4]
      return c
    })
    .join('')
}
