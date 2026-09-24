/* ==========================================================================
   THE SCRIPT
   What happens when, in film time F. Chapter n spans [n, n + 1).
     TRACK    the swarm: at F = f it has become `form` (the morph from the
              previous form runs from `from` to f; a repeated form holds)
     WORLDS   where we are: from a to b the page wipes into world `to`
     CAMS     the camera: position, target, field of view, and `shift`, how
              far the picture sits right of centre to leave room for the copy
   The molecular scenes (mol.ts) keep their own clocks; while they play the
   swarm becomes 'motes', dust drifting in the light around them.
   ========================================================================== */
import type { Flight } from '../gl/swarm'
import type { WorldName } from '../gl/world'

export const CHAPTERS = [
  'Genomes',
  'Reading the genome',
  'Bioinformatics',
  'Size is not complexity',
  'What a genome holds',
  'Jumping genes',
  'Gene families',
  'Duplication and rearrangement',
  'New genes from old',
  'Comparing genomes',
  'Evo-devo',
  'Home water',
]
export const LAST = CHAPTERS.length

export type FormKey = {
  f: number
  form: string
  /** the morph into this form starts here (default: the previous key's f) */
  from?: number
  flight?: Partial<Flight>
  /** where the form sits: translate, rotate about y, scale, as a function of F */
  place?: (F: number) => [number, number, number, number, number]
  alpha?: number
}

/* flights: how particles travel between pictures */
const POUR: Partial<Flight> = { style: 4, sweep: [1, 0, 0], stagger: 0.7, scatter: 0.7 }
const SWIRL: Partial<Flight> = { style: 1, sweep: [1, 0, 0], stagger: 0.6, scatter: 0.6 }
const FALL: Partial<Flight> = { style: 3, sweep: [0, -1, 0], stagger: 0.55, scatter: 0.5 }
const BURST: Partial<Flight> = { style: 2, sweep: [1, 0, 0], stagger: 0.3, scatter: 0.45 }
const SLIDE: Partial<Flight> = { style: 0, sweep: [1, 0, 0], stagger: 0.55, scatter: 0 }
const RISE: Partial<Flight> = { style: 4, sweep: [0, 1, 0], stagger: 0.6, scatter: 0.6 }

const hold = (f: number, form: string, extra: Partial<FormKey> = {}): FormKey => ({ f, form, ...extra })
const to = (f: number, form: string, flight: Partial<Flight>, from?: number, extra: Partial<FormKey> = {}): FormKey => ({ f, form, flight, from, ...extra })
const swim = (F: number): [number, number, number, number, number] => [4 - F * 9, 0.4, 0, 0, 1]
const home = (F: number): [number, number, number, number, number] => [1.5 - Math.max(0, F - 11.4) * 6, 0.4, 0, 0, 1]

export const TRACK: FormKey[] = [
  /* 00 · the elephant shark crosses the sunlit water, then pours into its DNA */
  hold(0, 'shark', { place: swim }),
  hold(0.46, 'shark', { place: swim }),
  to(0.9, 'helix', { style: 4, sweep: [1, 0, 0], stagger: 0.85, scatter: 0.55 }),

  /* 01 · reading the genome */
  hold(1.08, 'helix'),
  to(1.18, 'chromosome', { style: 4, sweep: [0, 1, 0], stagger: 0.5, scatter: 0.8 }),
  hold(1.24, 'chromosome'),
  to(1.32, 'sg-copies', { style: 1, sweep: [0, -1, 0], stagger: 0.6, scatter: 0.6 }),
  hold(1.36, 'sg-copies'),
  to(1.42, 'sg-scatter', BURST),
  hold(1.48, 'sg-scatter'),
  to(1.54, 'sg-read', { style: 1, sweep: [0, -1, 0], stagger: 0.5, scatter: 0.5 }),
  hold(1.58, 'sg-read'),
  to(1.66, 'sg-tiled', SLIDE),
  hold(1.7, 'sg-tiled'),
  to(1.78, 'cost', FALL),
  hold(1.84, 'cost'),
  to(1.9, 'meta-cloud', SWIRL),
  hold(1.93, 'meta-cloud'),
  to(2.0, 'meta-sorted', SWIRL),

  /* 02 · bioinformatics */
  hold(2.03, 'meta-sorted'),
  to(2.1, 'database', RISE),
  hold(2.3, 'database'),
  to(2.36, 'browser', SLIDE),
  hold(2.44, 'browser'),
  to(2.5, 'browser-cons', { ...SLIDE, stagger: 0.2 }),
  hold(2.62, 'browser-cons'),
  to(2.72, 'network', BURST),
  hold(2.84, 'network'),
  to(2.9, 'encode', POUR),
  hold(3.0, 'encode'),

  /* 03 · size is not complexity */
  to(3.08, 'spheres', POUR),
  hold(3.3, 'spheres'),
  to(3.4, 'scatter', FALL),
  hold(3.58, 'scatter'),
  to(3.66, 'density', SLIDE),
  hold(3.78, 'density'),
  to(3.86, 'splice', SWIRL),
  hold(4.0, 'splice'),

  /* 04 · what a genome holds */
  to(4.06, 'ribbon', POUR),
  hold(4.14, 'ribbon'),
  to(4.22, 'pie', { style: 4, sweep: [1, 0, 0], stagger: 0.5, scatter: 0.4 }),
  hold(4.56, 'pie'),
  to(4.62, 'str', SWIRL),
  hold(4.78, 'str'),
  to(4.9, 'corn', { style: 1, sweep: [-1, 0, 0], stagger: 0.7, scatter: 0.5 }),

  /* 05 · jumping genes: the kernel opens onto the molecules */
  hold(5.12, 'corn'),
  to(5.2, 'motes', BURST),
  hold(5.82, 'motes'),
  to(5.9, 'pie-te', SWIRL),
  hold(6.0, 'pie-te'),

  /* 06 · gene families */
  to(6.08, 'rrna', SWIRL),
  hold(6.2, 'rrna'),
  to(6.28, 'globin-chroms', SLIDE),
  hold(6.42, 'globin-chroms'),
  to(6.48, 'motes', BURST),
  hold(6.7, 'motes'),
  to(6.78, 'switch', FALL),
  hold(7.0, 'switch'),

  /* 07 · duplication and rearrangement */
  to(7.06, 'karyo2', SWIRL),
  hold(7.08, 'karyo2'),
  to(7.14, 'karyo4', { style: 1, sweep: [0, 1, 0], stagger: 0.3, scatter: 0.3 }),
  hold(7.2, 'karyo4'),
  to(7.24, 'motes', BURST),
  hold(7.46, 'motes'),
  to(7.52, 'synteny-mouse', RISE),
  hold(7.54, 'synteny-mouse'),
  to(7.6, 'synteny-human', { style: 4, sweep: [0, -1, 0], stagger: 0.6, scatter: 0.5 }),
  hold(7.62, 'synteny-human'),
  to(7.66, 'motes', BURST),
  hold(7.92, 'motes'),
  to(8.0, 'globin-map', SWIRL),

  /* 08 · new genes from old */
  hold(8.06, 'globin-map'),
  to(8.2, 'globin-tree', { style: 1, sweep: [0, 1, 0], stagger: 0.7, scatter: 0.4 }),
  hold(8.34, 'globin-tree'),
  to(8.4, 'lyso', SWIRL),
  hold(8.5, 'lyso'),
  to(8.56, 'exon-src', SWIRL),
  hold(8.62, 'exon-src'),
  to(8.7, 'tpa', { style: 1, sweep: [0, -1, 0], stagger: 0.5, scatter: 0.3 }),
  hold(8.9, 'tpa'),
  to(9.04, 'tree-life', RISE),

  /* 09 · comparing genomes */
  hold(9.2, 'tree-life'),
  to(9.28, 'align', SLIDE),
  hold(9.4, 'align'),
  to(9.48, 'foxp2', SWIRL),
  hold(9.6, 'foxp2'),
  to(9.68, 'snp', SLIDE),
  hold(9.8, 'snp'),
  to(9.88, 'tree-life', RISE),
  hold(10.0, 'tree-life'),

  /* 10 · evo-devo */
  to(10.08, 'fly-chrom', SWIRL),
  hold(10.12, 'fly-chrom'),
  to(10.18, 'fly-embryo', { style: 1, sweep: [1, 0, 0], stagger: 0.4, scatter: 0.3 }),
  hold(10.2, 'fly-embryo'),
  to(10.26, 'fly', { style: 1, sweep: [1, 0, 0], stagger: 0.4, scatter: 0.3 }),
  hold(10.32, 'fly'),
  to(10.38, 'mouse-chrom', SWIRL),
  hold(10.4, 'mouse-chrom'),
  to(10.44, 'mouse-embryo', { style: 1, sweep: [1, 0, 0], stagger: 0.4, scatter: 0.3 }),
  hold(10.46, 'mouse-embryo'),
  to(10.52, 'mouse', { style: 1, sweep: [1, 0, 0], stagger: 0.4, scatter: 0.3 }),
  hold(10.56, 'mouse'),
  to(10.62, 'artemia', SWIRL),
  hold(10.66, 'artemia'),
  to(10.74, 'grasshopper', { style: 1, sweep: [1, 0, 0], stagger: 0.5, scatter: 0.3 }),
  hold(10.8, 'grasshopper'),
  to(10.88, 'ciona', SWIRL),
  hold(10.94, 'ciona'),

  /* 11 · home water: the Hox colours paint the shark, then the animal returns */
  to(11.1, 'shark-hox', POUR, undefined, { place: home }),
  hold(11.24, 'shark-hox', { place: home }),
  to(11.4, 'shark', { style: 1, sweep: [-1, 0, 0], stagger: 0.7, scatter: 0.2 }, undefined, { place: home }),
  hold(12, 'shark', { place: home }),
]

export type WorldKey = { a: number; b: number; to: WorldName; dir?: [number, number]; rad?: number }
export const WORLDS: WorldKey[] = [
  { a: -1, b: -0.5, to: 'ocean' },
  // the helix rises out of the water; the sea drains away beneath it
  { a: 0.74, b: 0.96, to: 'lab', dir: [0, -1] },
  { a: 1.7, b: 1.77, to: 'graph', dir: [1, 0] },
  { a: 1.84, b: 1.89, to: 'lab', rad: 1 },
  { a: 2.92, b: 3.02, to: 'graph', dir: [1, 0.3] },
  // ink bleeds across the page: McClintock's notebook
  { a: 4.78, b: 4.9, to: 'note', dir: [-1, 0.2] },
  // into one kernel: the lab opens from the centre
  { a: 5.12, b: 5.2, to: 'lab', rad: 1 },
  { a: 6.7, b: 6.77, to: 'graph', dir: [0, 1] },
  { a: 6.98, b: 7.05, to: 'lab', dir: [1, 0] },
  { a: 7.92, b: 8.0, to: 'note', dir: [-1, -0.3] },
  // the sea floods back in from below
  { a: 10.94, b: 11.06, to: 'ocean', dir: [0, 1] },
]

export type CamKey = { f: number; p: [number, number, number]; t: [number, number, number]; fov: number; shift?: number; roll?: number }
const flat = (f: number, z = 39, x = 0, y = 0, shift = 0.17): CamKey => ({ f, p: [x, y, z], t: [x, y, 0], fov: 38, shift })
export const CAMS: CamKey[] = [
  /* 00 */
  { f: 0, p: [2, -3.5, 25], t: [0, 1.2, 0], fov: 36, shift: 0 },
  { f: 0.4, p: [-4, -2.5, 21], t: [-2, 0.8, 0], fov: 36, shift: 0.08 },
  { f: 0.75, p: [-8, 1, 17], t: [0, 0, 0], fov: 36, shift: 0.14 },
  { f: 0.95, p: [-9, 2.4, 9.5], t: [1, 0, 0], fov: 34, shift: 0.17 },
  /* 01 */
  { f: 1.08, p: [-5, 3, 12], t: [2, 0, 0], fov: 36 },
  { f: 1.2, p: [5, 1, 30], t: [0, 0, 0], fov: 38 },
  { f: 1.28, p: [-13, 6, 21], t: [2, 1, 0], fov: 40 },
  { f: 1.36, p: [-9, 3, 19], t: [3, 2, 0], fov: 40 },
  { f: 1.45, p: [2, -1, 22], t: [1, 0, 0], fov: 42 },
  { f: 1.56, p: [0, 1, 30], t: [0, 1, 0], fov: 38 },
  { f: 1.64, p: [-11, -5, 25], t: [1, 0, 0], fov: 38 },
  { f: 1.72, p: [0, 0, 37], t: [0, 0, 0], fov: 38 },
  flat(1.84),
  { f: 1.93, p: [0, 11, 32], t: [0, 0, 0], fov: 38 },
  flat(2.02),
  /* 02 */
  { f: 2.12, p: [-3, 1, 24], t: [1, 0, -4], fov: 40 },
  { f: 2.3, p: [3, -1, 22], t: [1, 0, -4], fov: 40 },
  flat(2.38),
  flat(2.62),
  { f: 2.74, p: [7, 3, 34], t: [0, 0, 0], fov: 38 },
  { f: 2.84, p: [-7, -2, 33], t: [0, 0, 0], fov: 38 },
  flat(2.92),
  /* 03 · the camera travels from the smallest genome to the largest */
  { f: 3.08, p: [-9, 1, 14], t: [-9, 0, 0], fov: 38 },
  { f: 3.18, p: [-1, 2, 22], t: [-1, 0, 0], fov: 38 },
  { f: 3.3, p: [10, 6, 64], t: [10, 0, 0], fov: 38 },
  flat(3.4),
  flat(3.58),
  flat(3.78),
  { f: 3.9, p: [3, 1, 35], t: [0, 0, 0], fov: 38 },
  flat(4.0),
  /* 04 */
  { f: 4.08, p: [-2, 7, 37], t: [0, 0, 0], fov: 38 },
  flat(4.22),
  flat(4.56),
  flat(4.8),
  /* 05 · into one kernel, onto the molecular stage */
  flat(5.1),
  { f: 5.14, p: [0.4, 1.47, 14], t: [0.4, 1.47, 0], fov: 38, shift: 0 },
  { f: 5.19, p: [0.4, 1.47, 1.4], t: [0.4, 1.47, 0], fov: 38, shift: 0 },
  { f: 5.24, p: [0, 3, 25], t: [0, 1.2, 0], fov: 38 },
  { f: 5.38, p: [-5, 4, 22], t: [0, 1.2, 0], fov: 38 },
  { f: 5.52, p: [4, 3, 24], t: [0, 1.5, 0], fov: 38 },
  { f: 5.7, p: [-3, 4, 24], t: [0, 2, 0], fov: 38 },
  { f: 5.82, p: [0, 3, 25], t: [0, 1.5, 0], fov: 38 },
  flat(5.92),
  flat(6.0),
  /* 06 */
  { f: 6.1, p: [-4, 4, 35], t: [0, 0, 0], fov: 38 },
  flat(6.3),
  flat(6.42),
  { f: 6.5, p: [0, 0, 17], t: [0, 0, 0], fov: 38 },
  { f: 6.7, p: [0, 1, 19], t: [0, 0, 0], fov: 38 },
  flat(6.78),
  flat(7.0),
  /* 07 */
  flat(7.1),
  { f: 7.24, p: [0, 0, 26], t: [0, 0, 0], fov: 38 },
  { f: 7.46, p: [0, 0, 27], t: [0, 0, 0], fov: 38 },
  flat(7.54),
  flat(7.62),
  { f: 7.66, p: [0, 1, 25], t: [0, 0, 0], fov: 38 },
  { f: 7.92, p: [0, 0, 27], t: [0, 0, 0], fov: 38 },
  flat(8.0),
  /* 08 – 10 · the notebook */
  flat(8.34),
  flat(8.5),
  flat(8.9),
  flat(9.2),
  flat(9.8),
  flat(10.12),
  flat(10.32),
  flat(10.56),
  flat(10.8),
  flat(10.94),
  /* 11 · home water */
  { f: 11.1, p: [-2, -2, 24], t: [1, 0.8, 0], fov: 36, shift: 0.1 },
  { f: 11.4, p: [-5, -2.5, 21], t: [0, 0.8, 0], fov: 36, shift: 0.1 },
  { f: 12.0, p: [-4, -1, 26], t: [-2, 1, 0], fov: 36, shift: 0.05 },
]
