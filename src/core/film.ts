/* ==========================================================================
   THE FILM
   Scroll becomes one continuous film time F. Chapter n spans [n, n + 1).
   This file turns F into everything the renderer and the page need: which
   world we are in, which two forms the swarm is flying between and how far,
   the camera, and the stage of every molecular scene. It is a pure function
   of F, so scrolling back reverses everything exactly.
   ========================================================================== */
import * as THREE from 'three'
import { WORLD, type WorldName } from '../gl/world'
import { TRACK, WORLDS, CAMS, type FormKey } from './script'

export { CHAPTERS, LAST } from './script'

/* ---------------------------------------------------------------- helpers */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const band = (a: number, b: number, c: number, d: number, x: number) => smooth(a, b, x) * (1 - smooth(c, d, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const ramp = (a: number, b: number, x: number) => clamp01((x - a) / (b - a))

/* ------------------------------------------------------------ film state */
export const film = {
  F: 0,
  chapter: 0,
  u: 0,

  /* the swarm */
  formA: '' as string,
  formB: '' as string,
  keyA: null as FormKey | null,
  keyB: null as FormKey | null,
  morph: 0,
  swarmAlpha: 1,

  /* the world */
  w0: 0,
  w1: 0,
  wt: 0,
  wdir: [1, 0] as [number, number],
  wrad: 0,
  /** 0 = ink on light pages · 1 = light text on water */
  dark: 1,
  ink: 0,

  /* camera */
  shift: 0,

  /* stages: named scalars owned by each scene (see script.ts) */
  s: {} as Record<string, number>,
}
export type Film = typeof film

/* worlds that read as dark (text goes light) */
const DARKNESS: Record<number, number> = { 0: 1, 1: 0, 2: 0, 3: 0 }
/* how the swarm composites: 0 additive light (water) · 1 ink laid over */
const INKNESS: Record<number, number> = { 0: 0.82, 1: 1, 2: 1, 3: 1 }

export function updateFilm(F: number) {
  const f = film
  f.F = F
  f.chapter = Math.max(0, Math.floor(F))
  f.u = F - f.chapter

  /* ---- the swarm: find the pair of keys around F ---- */
  let i = 0
  while (i < TRACK.length - 1 && F >= TRACK[i + 1].f) i++
  const a = TRACK[i]
  const b = TRACK[Math.min(TRACK.length - 1, i + 1)]
  f.keyA = a
  f.keyB = b
  f.formA = a.form
  f.formB = b.form
  // a key holds its form until the next key's morph begins (b.from ?? a.f)
  const start = b.from ?? a.f
  f.morph = a === b || a.form === b.form ? 0 : ramp(start, b.f, F)

  /* ---- the world ---- */
  let w = WORLDS[0]
  let prev: WorldName = WORLDS[0].to
  for (const k of WORLDS) {
    if (F >= k.a) {
      w = k
    }
  }
  const wi = WORLDS.indexOf(w)
  prev = wi > 0 ? WORLDS[wi - 1].to : w.to
  const wt = ramp(w.a, w.b, F)
  f.w0 = WORLD[wt >= 1 ? w.to : prev]
  f.w1 = WORLD[w.to]
  f.wt = wt >= 1 ? 0 : wt
  f.wdir = w.dir ?? [1, 0]
  f.wrad = w.rad ?? 0
  const e = smooth(0, 1, wt)
  f.dark = lerp(DARKNESS[WORLD[prev]], DARKNESS[WORLD[w.to]], e)
  f.ink = lerp(INKNESS[WORLD[prev]], INKNESS[WORLD[w.to]], e)
  return f
}

/* ----------------------------------------------------------- camera path */
type Path = { pos: THREE.CatmullRomCurve3; tgt: THREE.CatmullRomCurve3 }
let PATH: Path | null = null
function path() {
  if (!PATH)
    PATH = {
      pos: new THREE.CatmullRomCurve3(CAMS.map((q) => new THREE.Vector3(...q.p)), false, 'centripetal'),
      tgt: new THREE.CatmullRomCurve3(CAMS.map((q) => new THREE.Vector3(...q.t)), false, 'centripetal'),
    }
  return PATH
}
export function camAt(F: number, pos: THREE.Vector3, tgt: THREE.Vector3) {
  const keys = CAMS
  const n = keys.length
  let i = 0
  while (i < n - 2 && F > keys[i + 1].f) i++
  const a = keys[i]
  const b = keys[i + 1]
  const l = clamp01((F - a.f) / Math.max(1e-6, b.f - a.f))
  const e = l * l * (3 - 2 * l)
  const u = (i + e) / (n - 1)
  const p = path()
  p.pos.getPoint(u, pos)
  p.tgt.getPoint(u, tgt)
  return { fov: lerp(a.fov, b.fov, e), shift: lerp(a.shift ?? 0.17, b.shift ?? 0.17, e), roll: lerp(a.roll ?? 0, b.roll ?? 0, e) }
}
