import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

/* Typographic motion. Reveals are masked (overflow-clipped lines, chars that
   rise into place), all reversible. */
export function buildType() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  /* chapter titles: characters rise out of a hairline mask */
  document.querySelectorAll<HTMLElement>('[data-chars]').forEach((h) => {
    const split = SplitText.create(h, { type: 'chars,words', charsClass: 'char', mask: 'words' })
    const section = h.closest('section')!
    if (reduce) return
    gsap.set(split.chars, { yPercent: 110 })
    gsap.to(split.chars, {
      yPercent: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.028,
      scrollTrigger: { trigger: section, start: 'top 55%', end: 'bottom top', toggleActions: 'play reverse play reverse' },
    })
  })

  /* the hero line: lines wipe up on load */
  document.querySelectorAll<HTMLElement>('[data-lines]').forEach((p) => {
    const split = SplitText.create(p, { type: 'lines', mask: 'lines', linesClass: 'ln' })
    if (reduce) return
    gsap.from(split.lines, { yPercent: 105, duration: 1.4, ease: 'expo.out', stagger: 0.09, delay: 0.5 })
  })

  /* interlude headlines */
  document.querySelectorAll<HTMLElement>('[data-mega]').forEach((m) => {
    const split = SplitText.create(m, { type: 'lines,words', mask: 'lines', linesClass: 'line' })
    if (reduce) return
    gsap.from(split.words, {
      yPercent: 115,
      rotate: 4,
      duration: 1.3,
      ease: 'expo.out',
      stagger: 0.06,
      scrollTrigger: { trigger: m, start: 'top 82%', toggleActions: 'play none none reverse' },
    })
  })
}
