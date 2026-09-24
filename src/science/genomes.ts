/* ==========================================================================
   THE NUMBERS
   Every figure the page teaches, in one place. Sources: Urry et al.,
   Biology in Focus 3e (AP), ch. 18 (checked against the Pearson lecture
   slides and Campbell Biology 11e/12e ch. 21, which share its figures and
   tables), and the primary papers named in the notes.
   ========================================================================== */

/* 18.1 · sequencing */
export const HGP = { start: 1990, done: 2003, centers: 20, countries: 6, bp: 3e9 }
export const THROUGHPUT = [
  { when: '1980s', bpPerSec: 1000 / 86400, label: '1,000 bp per day' },
  { when: '2000', bpPerSec: 1000, label: '1,000 bp per second' },
  { when: '2018', bpPerSec: 35e6, label: '≈ 35 million bp per second' },
]
/* cost and time to sequence one human genome (the book's three points) */
export const COST = [
  { year: 2003, usd: 100e6, time: '13 years', label: 'The first human genome' },
  { year: 2007, usd: 1e6, time: '4 months', label: 'One individual' },
  { year: 2018, usd: 1e3, time: 'a day or less', label: 'A person, today' },
]
export const RUMEN = { year: 2018, genomes: 913, newCarbGenes: 60000 }

/* 18.3 · Table 18.1, genome sizes and estimated numbers of genes */
export type Org = { name: string; common: string; group: 'Bacteria' | 'Archaea' | 'Eukarya'; mb: number; genes: number | null; perMb: number | null }
export const TABLE_18_1: Org[] = [
  { name: 'Haemophilus influenzae', common: 'bacterium', group: 'Bacteria', mb: 1.8, genes: 1700, perMb: 940 },
  { name: 'Escherichia coli', common: 'bacterium', group: 'Bacteria', mb: 4.6, genes: 4400, perMb: 950 },
  { name: 'Archaeoglobus fulgidus', common: 'archaean', group: 'Archaea', mb: 2.2, genes: 2500, perMb: 1130 },
  { name: 'Methanosarcina barkeri', common: 'archaean', group: 'Archaea', mb: 4.8, genes: 3600, perMb: 750 },
  { name: 'Saccharomyces cerevisiae', common: 'yeast', group: 'Eukarya', mb: 12, genes: 6300, perMb: 525 },
  { name: 'Utricularia gibba', common: 'bladderwort', group: 'Eukarya', mb: 82, genes: 28500, perMb: 348 },
  { name: 'Caenorhabditis elegans', common: 'nematode', group: 'Eukarya', mb: 100, genes: 20100, perMb: 200 },
  { name: 'Arabidopsis thaliana', common: 'mustard plant', group: 'Eukarya', mb: 120, genes: 27000, perMb: 225 },
  { name: 'Drosophila melanogaster', common: 'fruit fly', group: 'Eukarya', mb: 165, genes: 14000, perMb: 85 },
  { name: 'Daphnia pulex', common: 'water flea', group: 'Eukarya', mb: 200, genes: 31000, perMb: 155 },
  { name: 'Zea mays', common: 'corn', group: 'Eukarya', mb: 2300, genes: 32000, perMb: 14 },
  { name: 'Ailuropoda melanoleuca', common: 'giant panda', group: 'Eukarya', mb: 2400, genes: 21000, perMb: 9 },
  { name: 'Homo sapiens', common: 'human', group: 'Eukarya', mb: 3000, genes: 21000, perMb: 7 },
  { name: 'Paris japonica', common: 'Japanese canopy plant', group: 'Eukarya', mb: 149000, genes: null, perMb: null },
]
export const HUMAN_GENES_NOTE = '< 21,000'

/* 18.4 · types of DNA sequences in the human genome (the pie) */
export type Slice = { id: string; label: string; pct: number; color: string; parent?: string; coding?: boolean }
export const COMPOSITION: Slice[] = [
  { id: 'exon', label: 'Exons (protein-coding)', pct: 1.5, color: '#ff2e63', coding: true },
  { id: 'reg', label: 'Regulatory sequences', pct: 5, color: '#ff9f1c' },
  { id: 'intron', label: 'Introns', pct: 20, color: '#ffd166' },
  { id: 'unique', label: 'Unique noncoding DNA', pct: 15, color: '#8ecae6' },
  { id: 'rep', label: 'Repetitive DNA unrelated to transposable elements', pct: 14, color: '#219ebc' },
  { id: 'te', label: 'Repetitive DNA: transposable elements and related sequences', pct: 44, color: '#7b2cbf' },
]
export const SUBSLICES: Slice[] = [
  { id: 'l1', label: 'L1 sequences', pct: 17, color: '#9d4edd', parent: 'te' },
  { id: 'alu', label: 'Alu elements', pct: 10, color: '#c77dff', parent: 'te' },
  { id: 'simple', label: 'Simple sequence DNA', pct: 3, color: '#023e8a', parent: 'rep' },
  { id: 'lsd', label: 'Large-segment duplications', pct: 5.5, color: '#48cae4', parent: 'rep' },
]
export const ALU_NT = 300 // Alu elements are about 300 nucleotides long
export const STR_UNIT = [2, 5] // short tandem repeats: units of 2–5 nucleotides

/* 18.4 · the globin gene families (Figure 18.9b) */
export type Gene = { id: string; label: string; pseudo?: boolean; stage?: 'embryo' | 'fetus' | 'adult' | 'fetus+adult' }
export const ALPHA_FAMILY: Gene[] = [
  { id: 'zeta', label: 'ζ', stage: 'embryo' },
  { id: 'psizeta', label: 'ψζ', pseudo: true },
  { id: 'psia2', label: 'ψα2', pseudo: true },
  { id: 'psia1', label: 'ψα1', pseudo: true },
  { id: 'a2', label: 'α2', stage: 'fetus+adult' },
  { id: 'a1', label: 'α1', stage: 'fetus+adult' },
  { id: 'psitheta', label: 'ψθ', pseudo: true },
]
export const BETA_FAMILY: Gene[] = [
  { id: 'eps', label: 'ε', stage: 'embryo' },
  { id: 'Gg', label: 'Gγ', stage: 'fetus' },
  { id: 'Ag', label: 'Aγ', stage: 'fetus' },
  { id: 'psib', label: 'ψβ', pseudo: true },
  { id: 'delta', label: 'δ', stage: 'adult' },
  { id: 'beta', label: 'β', stage: 'adult' },
]
export const GLOBIN = { alphaChromosome: 16, betaChromosome: 11, ancestorMya: [450, 500] }

/* 18.5 */
export const CHIMP_HUMAN_CHR = { human: 2, chimp: [12, 13], humanPairs: 23, chimpPairs: 24 }
export const HUMAN16_IN_MOUSE = [7, 8, 16, 17]
export const TPA = {
  sources: [
    { gene: 'Epidermal growth factor gene', exon: 'EGF', color: '#2a9d8f' },
    { gene: 'Fibronectin gene', exon: 'F', color: '#e76f51' },
    { gene: 'Plasminogen gene', exon: 'K', color: '#8338ec' },
  ],
  // the TPA gene as it exists today: F, EGF, K, K, then the protease region
  tpa: ['F', 'EGF', 'K', 'K', 'protease'],
}

/* 18.6 */
export const HUMAN_CHIMP = { snp: 1.2, indel: 2.7 }
export const DOMAINS_SPLIT_BYA = [2, 4]
export const HOMEOBOX = { nt: 180, aa: 60 }
/* Hox: fly genes in chromosome order, and the mouse paralog groups they match
   (colours follow the book's convention: same colour = homologous genes) */
export const FLY_HOX = [
  { id: 'lab', color: '#6a4c93' },
  { id: 'pb', color: '#1982c4' },
  { id: 'Dfd', color: '#2ec4b6' },
  { id: 'Scr', color: '#8ac926' },
  { id: 'Antp', color: '#ffca3a' },
  { id: 'Ubx', color: '#ff924c' },
  { id: 'abd-A', color: '#ff595e' },
  { id: 'Abd-B', color: '#c9184a' },
]

/* guest: Ciona robusta (Dehal et al. 2002; Satou et al. 2008, 2019; Corbo et al. 1997) */
export const CIONA = {
  genes: '≈ 15,000–16,000',
  mb: '≈ 115–160',
  notochordCells: 40,
  hoxGenes: 9,
  hoxMissing: [7, 8, 9, 11],
  braEnhancerBp: 434,
}
