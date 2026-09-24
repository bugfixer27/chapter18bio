/* Every form the swarm can take, built once at load. Each entry is a
   generator; linked generators (the shotgun stages) return several forms
   whose particles correspond one to one. */
import { ANIM } from '../swarm'
import type { FB } from './base'
import { sharkFormFromMesh, sharkHoxForm } from '../creature'
import { FLY_HOX } from '../../science/genomes'
import { hex } from './base'
import { helixForm, chromosomeForm, shotgunForms } from './dna'
import { costForm, metaForms, databaseForm, browserForms, networkForm, encodeForm } from './charts'
import { cornForm, globinForms, lysoForm, exonForms, treeLifeForm, alignForm, foxp2Form, snpForm, motesForm } from './notebook'
import { hoxForms, crustForms, cionaForm } from './hox'
import { sizeForms, spliceForm, compositionForms, strForm, rrnaForm, globinChromsForm, switchForm, karyoForms, syntenyForms } from './genome'

type Gen = { names: string[]; anims: number[]; make: () => FB[] }

export const GENS: Gen[] = [
  { names: ['shark'], anims: [ANIM.swim], make: () => [sharkFormFromMesh()] },
  { names: ['helix'], anims: [ANIM.spin], make: () => [helixForm()] },
  { names: ['chromosome'], anims: [ANIM.hover], make: () => [chromosomeForm()] },
  { names: ['sg-copies', 'sg-scatter', 'sg-read', 'sg-tiled'], anims: [ANIM.still, ANIM.drift, ANIM.still, ANIM.still], make: () => shotgunForms() },
  { names: ['cost'], anims: [ANIM.still], make: () => [costForm()] },
  { names: ['meta-cloud', 'meta-sorted'], anims: [ANIM.swirl, ANIM.still], make: () => metaForms() },
  { names: ['database'], anims: [ANIM.still], make: () => [databaseForm()] },
  { names: ['browser', 'browser-cons'], anims: [ANIM.still, ANIM.still], make: () => browserForms() },
  { names: ['network'], anims: [ANIM.breathe], make: () => [networkForm()] },
  { names: ['encode'], anims: [ANIM.hover], make: () => [encodeForm()] },
  { names: ['spheres', 'scatter', 'density'], anims: [ANIM.hover, ANIM.still, ANIM.still], make: () => sizeForms() },
  { names: ['splice'], anims: [ANIM.still], make: () => [spliceForm()] },
  { names: ['ribbon', 'pie', 'pie-te'], anims: [ANIM.hover, ANIM.still, ANIM.still], make: () => compositionForms() },
  { names: ['str'], anims: [ANIM.still], make: () => [strForm()] },
  { names: ['rrna'], anims: [ANIM.hover], make: () => [rrnaForm()] },
  { names: ['globin-chroms'], anims: [ANIM.still], make: () => [globinChromsForm()] },
  { names: ['switch'], anims: [ANIM.still], make: () => [switchForm()] },
  { names: ['karyo2', 'karyo4'], anims: [ANIM.hover, ANIM.hover], make: () => karyoForms() },
  { names: ['synteny-mouse', 'synteny-human'], anims: [ANIM.still, ANIM.still], make: () => syntenyForms() },
  { names: ['motes'], anims: [ANIM.drift], make: () => [motesForm()] },
  { names: ['corn'], anims: [ANIM.still], make: () => [cornForm()] },
  { names: ['globin-map', 'globin-tree'], anims: [ANIM.still, ANIM.still], make: () => globinForms() },
  { names: ['lyso'], anims: [ANIM.still], make: () => [lysoForm()] },
  { names: ['exon-src', 'tpa'], anims: [ANIM.still, ANIM.still], make: () => exonForms() },
  { names: ['tree-life'], anims: [ANIM.still], make: () => [treeLifeForm()] },
  { names: ['align'], anims: [ANIM.still], make: () => [alignForm()] },
  { names: ['foxp2'], anims: [ANIM.still], make: () => [foxp2Form()] },
  { names: ['snp'], anims: [ANIM.still], make: () => [snpForm()] },
  { names: ['fly-chrom', 'fly-embryo', 'fly', 'mouse-chrom', 'mouse-embryo', 'mouse'], anims: [ANIM.still, ANIM.hover, ANIM.hover, ANIM.still, ANIM.hover, ANIM.hover], make: () => hoxForms() },
  { names: ['artemia', 'grasshopper'], anims: [ANIM.hover, ANIM.hover], make: () => crustForms() },
  { names: ['ciona'], anims: [ANIM.hover], make: () => [cionaForm()] },
  { names: ['shark-hox'], anims: [ANIM.swim], make: () => [sharkHoxForm(FLY_HOX.map((h) => hex(h.color)))] },
]

export const FORM_COUNT = GENS.reduce((s, g) => s + g.names.length, 0)
