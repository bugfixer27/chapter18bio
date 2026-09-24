/* Where every label sits in the 3-D scene, and when it shows. Positions are
   world units (the swarm's space); r is the film-time band [in, full, full, out]. */
export type Lab = {
  id?: string
  n?: number
  r: [number, number, number, number]
  at: (F: number) => [number, number, number]
  text: string | ((F: number) => string)
  c?: string
  left?: boolean
  serif?: boolean
}

import type { Mol } from '../gl/mol'
import { BROWSER, NETWORK, META_GRID, DB_HIT_ROW, ENCODE } from '../gl/forms/charts'
import { SPHERES, GLOBIN_MAPS, SYNTENY, KARYO, STR, RRNA, SPLICE } from '../gl/forms/genome'
import { CORN, GLOBIN_MAP, GLOBIN_TREE, LYSO, EXON, TREE_LIFE, ALIGN, FOXP2, SNP } from '../gl/forms/notebook'
import { FLY_CHROM, FLY_EMBRYO, FLY_PARTS, MOUSE_CHROM, MOUSE_EMBRYO, MOUSE_PARTS, ARTEMIA, GRASSHOPPER, CIONA_PARTS } from '../gl/forms/hox'
import { ALPHA_FAMILY, BETA_FAMILY, FLY_HOX } from '../science/genomes'

/** the molecular stage, set once the engine exists (labels follow its parts) */
export const REF = { mol: null as Mol | null }
const fixed = (x: number, y: number, z = 0) => () => [x, y, z] as [number, number, number]
const M = (name: string, ox = 0, oy = 0, oz = 0) => () => (REF.mol ? REF.mol.at(name, ox, oy, oz) : ([0, 0, 0] as [number, number, number]))
const band4 = (a: number, b: number): [number, number, number, number] => [a, a + 0.015, b - 0.015, b]

export const LABELS: Lab[] = [
  /* hero: the shark swims left as F grows (place: x = 4 − 9F) */
  { id: 'shark', r: [0.3, 0.33, 0.44, 0.47], at: (F) => [4 - F * 9 - 8.6, 1.6, 1], text: 'Callorhinchus milii · elephant shark', c: '#9fe8ff' },
  { r: [0.33, 0.36, 0.44, 0.47], at: (F) => [4 - F * 9 - 12.5, -1.5, 0.5], text: 'Proboscis: senses prey in the sand', c: '#9fe8ff', left: true },
  { r: [0.34, 0.37, 0.44, 0.47], at: (F) => [4 - F * 9 - 5, 3.6, 0], text: 'Dorsal spine', c: '#9fe8ff' },
  /* the atomic helix */
  { id: 'backbone', r: [0.86, 0.9, 1.06, 1.08], at: fixed(-2.3, 1.05, 0.2), text: 'Sugar–phosphate backbone', c: '#ff8a00' },
  { id: 'bases', r: [0.88, 0.92, 1.06, 1.08], at: fixed(1.2, 0.0, 0.1), text: 'Base pairs', c: '#16c784' },

  /* transposons (Figure 18.7) */
  { id: 'transposon', r: band4(5.25, 5.5), at: M('te', 2.0, 1.5, 0), text: (F) => (F < 5.37 ? 'Transposon · cut and paste' : F < 5.44 ? 'Inserted at a new site' : 'Transposon'), c: '#d62fe0' },
  { id: 'transposase', r: band4(5.25, 5.37), at: M('transposase', 0, 1.1, 0), text: 'Transposase', c: '#18b7a6' },
  { r: band4(5.44, 5.51), at: M('teCopy', 2.0, 1.6, 0), text: 'Copy and paste · original stays', c: '#d62fe0' },
  /* retrotransposons (Figure 18.8) */
  { id: 'retro', r: band4(5.56, 5.81), at: M('retroEl', 2.0, -1.6, 0), text: 'Retrotransposon', c: '#7b2cbf', left: true },
  { r: band4(5.56, 5.62), at: M('pol', 0, 1.2, 0), text: 'RNA polymerase · transcribes', c: '#3a86ff' },
  { r: band4(5.6, 5.73), at: M('rna', 3.5, 0.6, 0), text: 'RNA intermediate', c: '#ff8c1a' },
  { id: 'rt', r: band4(5.64, 5.74), at: M('rt', 0, 1.3, 0), text: 'Reverse transcriptase · RNA → DNA', c: '#ffbe0b' },
  { r: band4(5.76, 5.82), at: M('newDna', 2.0, 1.6, 0), text: 'New copy inserted', c: '#7b2cbf' },
  { r: band4(5.76, 5.82), at: M('retroEl', 2.0, -1.6, 0), text: 'Original stays', c: '#7b2cbf', left: true },
  /* hemoglobin */
  { id: 'hb', r: band4(6.47, 6.7), at: M('hb0', 0, 2.2, 0), text: (F) => (F < 6.59 ? 'α-globin (×2)' : F < 6.64 ? 'ζ-globin · embryo' : 'α-globin · fetus and adult'), c: '#8e5bd6' },
  { r: band4(6.47, 6.7), at: M('hb2', 0, 2.2, 0), text: (F) => (F < 6.59 ? 'β-globin (×2)' : F < 6.63 ? 'ε-globin · embryo' : F < 6.665 ? 'γ-globin · fetus' : 'β-globin · adult'), c: '#22b8c9' },
  { id: 'heme', r: band4(6.49, 6.6), at: M('heme', 0, 0, 0), text: 'Heme · Fe binds O₂', c: '#e01e37' },
  /* chromosome 2 (Figure 18.10) */
  { r: band4(7.24, 7.33), at: M('chimpA', 0, 4.8, 0), text: 'Chimp chromosome 12', c: '#b7a4ff' },
  { r: band4(7.24, 7.33), at: M('chimpB', 0, 5.8, 0), text: 'Chimp chromosome 13', c: '#b7a4ff' },
  { id: 'fuse', r: band4(7.36, 7.47), at: M('chimpB', 0, 2.5, 1.2), text: 'Human chromosome 2', c: '#b7a4ff' },
  { id: 'tel', r: band4(7.37, 7.47), at: M('tel', 0, 0, 1.4), text: 'Telomere-like sequences', c: '#ffd24a' },
  { id: 'cen', r: band4(7.38, 7.47), at: M('cen2', 0, 0, 1.2), text: 'Vestigial centromere', c: '#ff5fa2', left: true },
  /* unequal crossing over (Figure 18.12) */
  { r: band4(7.64, 7.76), at: M('topL', 0, 1.2, 0.9), text: 'Gene', c: '#ffb000' },
  { id: 'teAlign', r: band4(7.64, 7.76), at: M('topL', 0, 4.0, 0.9), text: 'Transposable element', c: '#b04ae0' },
  { r: band4(7.66, 7.76), at: M('botR', 0, -1.2, 0.9), text: 'Gene', c: '#ffb000' },
  { id: 'uneq', r: band4(7.72, 7.8), at: M('cross', 0, 1.2, 0), text: 'Crossover · out of register', c: '#ff2e63' },
  { r: band4(7.84, 7.94), at: M('topL', 0, 0, 1.0), text: 'Two copies of the gene', c: '#ffb000' },
  { r: band4(7.84, 7.94), at: M('botL', 0, 0, 1.0), text: 'No copy', c: '#9fd3ff' },

  /* 18.1 · the rumen */
  { r: band4(1.96, 2.05), at: () => [0, META_GRID.box[3] + 1.2, 0], text: '913 genomes, sorted from one sample', c: '#7b2cbf' },
  /* 18.2 */
  { id: 'genbank', r: band4(2.1, 2.3), at: () => [DB_HIT_ROW.x0, DB_HIT_ROW.y + 0.8, DB_HIT_ROW.z], text: 'GenBank · millions of records', c: '#2f7bff' },
  { id: 'blast', r: band4(2.16, 2.3), at: () => [(DB_HIT_ROW.x0 + DB_HIT_ROW.x1) / 2, DB_HIT_ROW.y - 0.5, DB_HIT_ROW.z], text: 'Best BLAST hit', c: '#ffb000' },
  { id: 'start', r: band4(2.37, 2.6), at: () => [BROWSER.startCodon, BROWSER.gene.y + 1.6, 0], text: 'Start codon (ATG)', c: '#16c784' },
  { id: 'stop', r: band4(2.39, 2.6), at: () => [BROWSER.stopCodon, BROWSER.gene.y + 1.6, 0], text: 'Stop codon', c: '#ff4b5c', left: true },
  { id: 'rnaseq', r: band4(2.4, 2.6), at: () => [BROWSER.exons[3].x1, BROWSER.rnaseq.y0 + BROWSER.rnaseq.h, 0], text: 'RNA piles up over exons', c: '#2f7bff' },
  { id: 'enh', r: band4(2.5, 2.62), at: () => [BROWSER.enhancers[1], BROWSER.cons.y0 + BROWSER.cons.h + 1.4, 0], text: 'Candidate enhancers', c: '#ffb000' },
  ...['Translation', 'Transcription', 'DNA replication and repair', 'Mitochondrial functions', 'Vesicle transport', 'Cell division'].map(
    (name, i): Lab => ({ id: i === 0 ? 'systems' : undefined, r: band4(2.73 + i * 0.008, 2.86), at: () => { const m = NETWORK.modules[i]; return m ? [m.x, m.y + 1.2, m.z] : [0, 0, 0] }, text: name, c: NETWORK.modules[i]?.color }),
  ),
  { id: 'encode', r: band4(2.91, 3.0), at: () => [ENCODE.x1, ENCODE.rows[0] + 1.2, 0], text: 'Transcribed somewhere, sometime: ≥ 75%', c: '#ff8c1a', left: true },
  /* 18.3 · the spheres, to scale */
  ...SPHERES.list.map((sp, i): Lab => ({
    id: sp.common === 'nematode' ? 'worm' : sp.common === 'fruit fly' ? 'fly' : undefined,
    r: band4(3.1 + (sp.rank / 14) * 0.12, 3.33),
    at: () => [sp.x, sp.y + sp.r + 0.5, sp.z],
    text: `${sp.common} · ${sp.mb.toLocaleString('en-US')} Mb`,
    c: sp.color,
    n: sp.rank + 1,
  })),
  /* 18.4 */
  { id: 'str', r: band4(4.63, 4.78), at: () => [(STR.repeat.x0 + STR.repeat.x1) / 2, STR.ladder.y + 1.3, 0], text: `${STR.repeat.unit} × ${STR.repeat.n} · a short tandem repeat`, c: '#ff006e' },
  { id: 'profile', r: band4(4.65, 4.78), at: () => [STR.lanes[4] + 1.8, STR.laneTop - 0.3, 0], text: 'Genetic profiles · five people', c: '#3a86ff', left: true },
  /* 18.4 · gene families */
  { id: 'rrna', r: band4(6.08, 6.22), at: () => [RRNA.units[0].x0, RRNA.axisY + 4.9, 0], text: 'Transcription unit', c: '#ff8c1a' },
  { r: band4(6.09, 6.22), at: () => [(RRNA.spacers[1][0] + RRNA.spacers[1][1]) / 2, RRNA.axisY - 0.9, 0], text: 'Nontranscribed spacer', c: '#8a9bb5' },
  ...['18S', '5.8S', '28S'].map((id): Lab => ({ r: band4(6.1, 6.22), at: () => { const k = RRNA.key.seg[id] ?? [0, 0]; return [(k[0] + k[1]) / 2, RRNA.key.y - 1.0, 0] }, text: id, c: '#ff8c1a' })),
  ...Object.values(GLOBIN_MAPS.alpha.genes).map((g): Lab => ({ id: g.pseudo ? (g.label === 'ψζ' ? 'pseudo' : undefined) : g.label === 'α1' ? 'alpha' : undefined, r: band4(6.28, 6.44), at: () => [g.x, g.y + g.h, 0], text: g.label, c: g.pseudo ? '#8a8f99' : '#06d6a0' })),
  ...Object.values(GLOBIN_MAPS.beta.genes).map((g): Lab => ({ id: g.label === 'β' ? 'beta' : undefined, r: band4(6.28, 6.44), at: () => [g.x, g.y + g.h, 0], text: g.label, c: g.pseudo ? '#8a8f99' : '#ff6b6b' })),
  { r: band4(6.28, 6.44), at: () => [GLOBIN_MAPS.alpha.chr.x, GLOBIN_MAPS.alpha.chr.y - 5.4, 0], text: 'Chromosome 16', c: '#b7a4ff' },
  { r: band4(6.28, 6.44), at: () => [GLOBIN_MAPS.beta.chr.x, GLOBIN_MAPS.beta.chr.y - 7.6, 0], text: 'Chromosome 11', c: '#b7a4ff' },
  /* 18.3 · splicing */
  { id: 'splice', r: band4(3.86, 4.0), at: () => [SPLICE.pre.exons[0].x0, SPLICE.pre.y + 1.0, 0], text: 'pre-mRNA · 5 exons', c: '#ff2e63' },
  ...SPLICE.mrnas.map((m, i): Lab => ({ r: band4(3.87 + i * 0.01, 4.0), at: () => [SPLICE.proteins[i].x, SPLICE.proteins[i].y + SPLICE.proteins[i].r + 0.4, 0], text: `Protein ${i + 1}`, c: '#7b2cbf' })),
  /* 18.5 */
  { id: 'poly', r: band4(7.14, 7.22), at: () => [KARYO.tetraploid[KARYO.tetraploid.length - 1].x, KARYO.pairs[0].top + 1, 0], text: 'Tetraploid: every chromosome ×4', c: '#b7a4ff', left: true },
  { r: band4(7.05, 7.12), at: () => [KARYO.diploid[KARYO.diploid.length - 1].x, KARYO.pairs[0].top + 1, 0], text: 'Diploid: pairs', c: '#b7a4ff', left: true },
  ...SYNTENY.mouse.map((m): Lab => ({ r: band4(7.5, 7.58), at: () => [m.x, m.y1 + 0.6, 0], text: `Mouse ${m.chr}`, c: m.color })),
  { r: band4(7.58, 7.64), at: () => [SYNTENY.human.x + 1.2, SYNTENY.human.y1, 0], text: 'Human chromosome 16', c: '#b7a4ff' },

  /* ---------------------------------------------------------- the notebook */
  { id: 'mcclintock', r: band4(4.92, 5.13), at: () => [CORN.kernel[0], CORN.kernel[1], 0], text: 'Mottled kernel: an element jumped out of a pigment gene', c: '#7b2c6f', serif: true },
  { r: band4(4.94, 5.12), at: () => [CORN.husk[0], CORN.husk[1], 0], text: 'Zea mays · Indian corn', c: '#6b5238', serif: true },
  /* 18.5 · the globin families, then their tree */
  { r: band4(8.0, 8.1), at: () => [GLOBIN_MAP.x0, GLOBIN_MAP.alphaY + 1.3, 0], text: 'α-globin family · chromosome 16', c: '#2f58c9', serif: true },
  { r: band4(8.0, 8.1), at: () => [GLOBIN_MAP.x0, GLOBIN_MAP.betaY + 1.3, 0], text: 'β-globin family · chromosome 11', c: '#c9303f', serif: true },
  ...[...ALPHA_FAMILY, ...BETA_FAMILY].map((g): Lab => ({ r: band4(8.0, 8.1), at: () => { const p = GLOBIN_MAP.genes[g.id as keyof typeof GLOBIN_MAP.genes] as unknown as [number, number]; return [p[0], p[1] - 1.0, 0] }, text: g.label, c: g.pseudo ? '#8a7a66' : '#3a2a1c', serif: true })),
  { id: 'anc', r: band4(8.2, 8.35), at: () => [GLOBIN_TREE.ancestor[0], GLOBIN_TREE.ancestor[1] + 0.7, 0], text: 'Ancestral globin gene', c: '#3a2a1c', serif: true },
  { r: band4(8.21, 8.35), at: () => [GLOBIN_TREE.duplication[0] + 0.4, GLOBIN_TREE.duplication[1], 0], text: 'Duplication · 450–500 million years ago', c: '#7b2c6f', serif: true },
  { r: band4(8.22, 8.35), at: () => [GLOBIN_TREE.alphaNode[0] - 0.4, GLOBIN_TREE.alphaNode[1], 0], text: 'α lineage', c: '#2f58c9', serif: true, left: true },
  { r: band4(8.22, 8.35), at: () => [GLOBIN_TREE.betaNode[0] + 0.4, GLOBIN_TREE.betaNode[1], 0], text: 'β lineage', c: '#c9303f', serif: true },
  { id: 'transp', r: band4(8.23, 8.35), at: () => [GLOBIN_TREE.transposition.alpha[0] + 0.4, GLOBIN_TREE.transposition.alpha[1], 0], text: 'Transposition to another chromosome', c: '#7b2c6f', serif: true },
  ...GLOBIN_TREE.axis.ticks.map((t): Lab => ({ r: band4(8.2, 8.35), at: () => [GLOBIN_TREE.axis.x, t.y, 0], text: `${t.mya}`, c: '#6b5238', serif: true, left: true })),
  { r: band4(8.2, 8.35), at: () => [GLOBIN_TREE.axis.x, GLOBIN_TREE.axis.ticks[0].y + 1.0, 0], text: 'millions of years ago', c: '#6b5238', serif: true },
  ...[...ALPHA_FAMILY, ...BETA_FAMILY].map((g): Lab => ({ r: band4(8.22, 8.35), at: () => { const p = (GLOBIN_TREE.leaves as Record<string, number[]>)[g.id]; return [p[0], p[1] - 0.9, 0] }, text: g.label, c: g.pseudo ? '#8a7a66' : '#3a2a1c', serif: true })),
  { id: 'lysozyme', r: band4(8.4, 8.5), at: () => [LYSO.lysozyme[0], LYSO.lysozyme[1] - LYSO.radius - 0.6, 0], text: 'Lysozyme · an enzyme against bacteria', c: '#2a7a5a', serif: true },
  { id: 'lact', r: band4(8.4, 8.5), at: () => [LYSO.lactalbumin[0], LYSO.lactalbumin[1] - LYSO.radius - 0.6, 0], text: 'α-Lactalbumin · milk production', c: '#b4455f', serif: true },
  { r: band4(8.41, 8.5), at: () => [LYSO.ancestor[0], LYSO.ancestor[1] + 0.8, 0], text: 'one ancestral gene, duplicated', c: '#3a2a1c', serif: true },
  ...EXON.sources.map((g): Lab => ({ r: band4(8.56, 8.66), at: () => [-11, g.y + 0.9, 0], text: g.gene, c: g.color, serif: true })),
  ...EXON.tpa.boxes.map((b, i): Lab => ({ id: i === 2 ? 'tpa' : undefined, r: band4(8.7, 8.9), at: () => [b.x, b.y + 1.0, 0], text: b.kind === 'protease' ? 'Protease region' : b.kind === 'K' ? 'Kringle' : b.kind === 'F' ? 'Finger' : 'EGF', c: '#3a2a1c', serif: true })),
  { r: band4(8.71, 8.9), at: () => [EXON.tpa.boxes[0].x - 1, EXON.tpa.y - 1.2, 0], text: 'TPA gene, as it exists today', c: '#3a2a1c', serif: true },
  /* 18.6 */
  ...(['bacteria', 'archaea', 'eukarya'] as const).map((d): Lab => ({ id: d === 'eukarya' ? 'conserved' : undefined, r: band4(9.05, 9.22), at: () => [TREE_LIFE[d][0], TREE_LIFE[d][1] + 0.8, 0], text: d[0].toUpperCase() + d.slice(1), c: d === 'bacteria' ? '#2a8a8a' : d === 'archaea' ? '#b8742a' : '#b4455f', serif: true })),
  { r: band4(9.06, 9.22), at: () => [TREE_LIFE.root[0], TREE_LIFE.root[1] + 0.8, 0], text: 'Common ancestor of all life', c: '#3a2a1c', serif: true },
  ...(['mouse', 'human', 'chimpanzee'] as const).map((t): Lab => ({ r: band4(9.08, 9.22), at: () => [TREE_LIFE.tips[t][0] + 0.3, TREE_LIFE.tips[t][1], 0], text: t, c: '#3a2a1c', serif: true })),
  ...TREE_LIFE.axis.ticks.map((t): Lab => ({ r: band4(9.05, 9.22), at: () => [t.x, TREE_LIFE.axis.y - 0.7, 0], text: `${t.bya}`, c: '#6b5238', serif: true })),
  { r: band4(9.05, 9.22), at: () => [TREE_LIFE.axis.x1 - 3, TREE_LIFE.axis.y - 1.5, 0], text: 'billions of years ago', c: '#6b5238', serif: true },
  ...ALIGN.blocks.flatMap((b, i): Lab[] => [
    { id: i === 0 ? 'subs' : undefined, r: band4(9.29, 9.41), at: () => [b.x0, b.human, 0], text: 'Human', c: '#3a2a1c', serif: true, left: true },
    { r: band4(9.29, 9.41), at: () => [b.x0, b.chimp, 0], text: 'Chimp', c: '#3a2a1c', serif: true, left: true },
  ]),
  { id: 'foxp2', r: band4(9.49, 9.6), at: () => [FOXP2.wt.at[0], FOXP2.wt.at[1] - 2.2, 0], text: 'Wild type · whistles', c: '#3a2a1c', serif: true },
  { r: band4(9.49, 9.6), at: () => [FOXP2.het.at[0], FOXP2.het.at[1] - 2.2, 0], text: 'Heterozygote · fewer', c: '#3a2a1c', serif: true },
  { r: band4(9.49, 9.6), at: () => [FOXP2.homo.at[0], FOXP2.homo.at[1] - 2.2, 0], text: 'Homozygote · silent', c: '#b4455f', serif: true },
  { id: 'snp', r: band4(9.69, 9.8), at: () => [SNP.snps[2].x, SNP.rows[0] + 0.8, 0], text: 'SNP', c: '#b4455f', serif: true },
  { id: 'cnv', r: band4(9.7, 9.8), at: () => [(SNP.cnv.x0 + SNP.cnv.x1) / 2, SNP.cnv.y + 1.4, 0], text: 'Copy-number variant', c: '#2f58c9', serif: true },
  /* 18.6 · Hox (Figure 18.17) */
  ...FLY_CHROM.genes.map((g, i): Lab => ({ id: i === 0 ? 'hox' : undefined, r: band4(10.08, 10.14), at: () => [g.x, g.y + 1.3, 0], text: g.id, c: g.color, serif: true })),
  { id: 'flyEmbryo', r: band4(10.18, 10.22), at: () => [FLY_EMBRYO.head[0], FLY_EMBRYO.head[1], 0], text: 'Fruit fly embryo · 10 hours', c: '#3a2a1c', serif: true },
  { id: 'flyAdult', r: band4(10.26, 10.33), at: () => [FLY_PARTS.wing[0], FLY_PARTS.wing[1] + 1.6, 0], text: 'Adult fruit fly', c: '#3a2a1c', serif: true },
  ...MOUSE_CHROM.clusters.map((c): Lab => ({ r: band4(10.38, 10.42), at: () => [MOUSE_CHROM.x0 - 0.3, c.y, 0], text: `${c.name} · chr ${c.chromosome}`, c: '#3a2a1c', serif: true, left: true })),
  { id: 'mouseEmbryo', r: band4(10.44, 10.47), at: () => [MOUSE_EMBRYO.head[0], MOUSE_EMBRYO.head[1] + 1.2, 0], text: 'Mouse embryo · 12 days', c: '#3a2a1c', serif: true },
  { r: band4(10.52, 10.57), at: () => [MOUSE_PARTS.ear[0], MOUSE_PARTS.ear[1] + 1.4, 0], text: 'Adult mouse', c: '#3a2a1c', serif: true },
  /* Figure 18.18 */
  { id: 'artemia', r: band4(10.62, 10.68), at: () => [ARTEMIA.head[0], ARTEMIA.head[1] + 2.4, 0], text: 'Brine shrimp · a crustacean', c: '#3a2a1c', serif: true },
  { r: band4(10.62, 10.68), at: () => [ARTEMIA.thorax[0], ARTEMIA.thorax[1] - 3.3, 0], text: 'Thorax: four Hox genes overlap · every segment swims', c: '#7b2c6f', serif: true },
  { r: band4(10.63, 10.68), at: () => [ARTEMIA.genital[0], ARTEMIA.genital[1] + 1.5, 0], text: 'Genital segments', c: '#3a2a1c', serif: true },
  { r: band4(10.63, 10.68), at: () => [ARTEMIA.abdomen[0], ARTEMIA.abdomen[1] + 1.2, 0], text: 'Abdomen', c: '#3a2a1c', serif: true },
  { id: 'grass', r: band4(10.74, 10.81), at: () => [GRASSHOPPER.head[0], GRASSHOPPER.head[1] + 2.4, 0], text: 'Grasshopper · an insect', c: '#3a2a1c', serif: true },
  { r: band4(10.74, 10.81), at: () => [GRASSHOPPER.T2[0], GRASSHOPPER.T2[1] - 3.2, 0], text: 'Thorax: each gene its own segments · legs', c: '#7b2c6f', serif: true },
  { r: band4(10.75, 10.81), at: () => [GRASSHOPPER.abdomen[0], GRASSHOPPER.abdomen[1] - 1.8, 0], text: 'Abdomen: Hox genes suppress legs', c: '#b4455f', serif: true },
  /* guest: the Ciona tadpole */
  { id: 'noto', r: band4(10.88, 10.97), at: () => [(CIONA_PARTS.notochordStart[0] + CIONA_PARTS.notochordEnd[0]) / 2, CIONA_PARTS.notochordStart[1] - 1.6, 0], text: 'Notochord · 40 cells · Brachyury on', c: '#b07800', serif: true },
  { r: band4(10.88, 10.97), at: () => [CIONA_PARTS.trunk[0], CIONA_PARTS.trunk[1] + 2.4, 0], text: 'Ciona robusta tadpole', c: '#3a2a1c', serif: true },
  { r: band4(10.89, 10.97), at: () => [CIONA_PARTS.sensoryVesicle[0], CIONA_PARTS.sensoryVesicle[1] + 1.0, 0], text: 'sensory vesicle', c: '#6b5238', serif: true },
  /* home water */
  { r: band4(11.12, 11.3), at: () => [1.5 - 8.5, 1.8, 1.2], text: 'anterior Hox genes', c: FLY_HOX[0].color },
  { r: band4(11.12, 11.3), at: () => [1.5 + 9.5, 1.2, 0.6], text: 'posterior Hox genes', c: FLY_HOX[7].color, left: true },
]