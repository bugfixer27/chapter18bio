# Genomes

*Biology in Focus* (3rd ed., AP), chapter 18: **Genomes and Their Evolution**,
as a real-time 3-D scroll film. It opens underwater with an elephant shark,
burns the animal away into its own DNA (atom by atom), and then walks through
every key concept of the chapter across four worlds: sunlit water, a lab,
graph paper, and a Victorian naturalist's field notebook. It ends back in the
water. It is a companion to *Membrane* (CellWall).

## Run it

**On GitHub Pages:** push to `main` and the workflow in
`.github/workflows/deploy.yml` builds and publishes the site. The first time,
open the repository's **Settings → Pages** and set **Source** to
**GitHub Actions**. The site appears at `https://<user>.github.io/<repo>/`.

**Locally:** double-click **`launch.command`**. It installs dependencies on
first run, starts the dev server on port 5181 and opens Chrome. Or:

```bash
npm install
npm run dev
```

Made for laptops: desktop Chrome on an Apple M1 Pro / M3 Air or similar.
The pixel ratio drops automatically if frames get slow.

## What's on the page

| | Chapter | Set piece |
|---|---|---|
| 00 | Genomes (overview, Fig 18.1) | A sculpted elephant shark in sunlit water: god rays, caustics across its skin, a rippled sea floor. **Morph:** a glowing front burns across the shark from the snout; its skin lifts off as particles at the burn line, spirals, and crystallises into a double helix of ~3 600 atoms while the sea drains away into the lab. |
| 01 | Reading the genome (18.1) | The helix coils into a chromosome, unravels into five copies, and shotgun sequencing plays out exactly as Figure 18.2: cut, clone (scattered), read, ordered by overlaps into the book's consensus. The fragments fall onto the cost curve ($100 M → $1 000). A rumen's worth of DNA swirls and sorts itself into 913 genomes. |
| 02 | Bioinformatics (18.2) | GenBank as an endless archive; a BLAST alignment types itself out; a genome browser (gene model, RNA-seq, conservation). **Field note:** *Ciona*'s conserved noncoding enhancers light up. A yeast-style interaction network; ENCODE's 75%. |
| 03 | Size is not complexity (18.3) | Table 18.1 as spheres, volume to scale; the camera pulls back until *Paris japonica* fills the sky. The spheres fall onto a size-vs-genes plot, then flatten into gene-density bars; alternative splicing. |
| 04 | What a genome holds (18.4) | The whole human genome as one ribbon, which wraps into the composition donut (exons 1.5 %). Short tandem repeats and genetic profiles. |
| 05 | Jumping genes (18.4) | McClintock's mottled corn, engraved in the notebook. The camera dives into one kernel and onto the molecular stage: a transposon cut-and-pastes and copy-and-pastes (transposase); a retrotransposon goes through RNA and reverse transcriptase. Alu and L1 slices. |
| 06 | Gene families (18.4) | rRNA tandem arrays with their "Christmas-tree" transcripts; the α- and β-globin families on chromosomes 16 and 11; a glossy hemoglobin changes its chains embryo → fetus → adult; the switch as a chart. |
| 07 | Duplication and rearrangement (18.5) | Polyploidy; **field note** on vertebrate genome duplications; chimp 12 + 13 fuse into human 2 (telomere-like join, vestigial centromere); human 16 reassembled from mouse blocks; unequal crossing over, exactly as Figure 18.12. |
| 08 | New genes from old (18.5) | **Morph:** the globin gene maps grow backwards into their 500-million-year family tree. Lysozyme and α-lactalbumin; exon shuffling builds TPA from three genes. |
| 09 | Comparing genomes (18.6) | The tree of life; human vs chimp (1.2 % / 2.7 %); FOXP2; SNPs and CNVs. |
| 10 | Evo-devo (18.6) | Hox colours flow from the fly's chromosome into its embryo and adult, then the mouse's four clusters into its embryo and adult (Fig 18.17); brine shrimp vs grasshopper (Fig 18.18). **Field note:** the *Ciona* tadpole and its 40 notochord cells. |
| 11 | Home water | The sea floods back. The Hox colours paint the shark, then the animal re-forms, solid, and swims on. Chapter summary. |

Throughout:

- **Predict.** Eleven questions (several are the book's own Concept Checks) ask you to tap an answer before the scene shows it; your score sits in the top bar.
- **Key terms.** Bold terms light up in reading order and light up the thing they name.
- **Takeaways.** Each chapter ends on three lines that assemble out of the scene.
- **Field notes.** *Ciona robusta* makes guest appearances where it illustrates the chapter (for the Di Gregorio lab).

## How it's built

```
index.html            all copy: semantic and readable without WebGL
src/
  science/genomes.ts  every number the page teaches
  core/script.ts      the film: forms, worlds and cameras in film time F
  core/film.ts        scroll → F → state; core/scroll.ts Lenis + GSAP
  gl/swarm.ts         131 072 lit particles; forms live in a texture array
  gl/forms/*          the ~45 forms (DNA, charts, genome, notebook, Hox)
  gl/creature.ts      the elephant-shark mesh, its dissolve and its swarm twin
  gl/atoms.ts         the atomic double helix
  gl/mol.ts           the molecular stage (transposons, hemoglobin, chromosomes)
  gl/world.ts         the four worlds and the wipes between them
  gl/world3d.ts       the sea floor and the environment maps
  gl/rig.ts           each world's light
  gl/post.ts          bloom, light shafts, grade
  dom/*               beats, labels, chart overlays, predicts, takeaways
```

The **signature trick** is the hand-off between solid meshes and particles:
the swarm's shark and helix are sampled from the surfaces of the real meshes,
and the mesh shader and the particle shader compute the same travelling front,
so skin burns away exactly where particles lift off, and atoms form exactly
where particles land.

## Dev handles

- `?f=5.5` jumps to a moment of the film (0 = hero … 12 = end).
- `__m.go(5.5)` scrolls there; `__m.pin(5.5)` freezes the film at that moment (`__m.pin(null)` releases).

## Science notes

- Numbers are the book's (Table 18.1, the Figure 18.5 composition, 1.2 % / 2.7 %,
  180-nt homeobox → 60-aa homeodomain, 450–500 million years for the globin
  duplication, and so on), checked against the Pearson lecture slides and
  Campbell Biology 11e/12e chapter 21, which share the figures.
- Schematic and labelled as such: the globin expression curves, the BLAST hits,
  the genome-browser tracks, the FOXP2 pups, the Hox expression domains.
- The atomic helix is a B-form model (10.5 bp per turn, 3.4 Å rise, 20 Å wide)
  built from idealised atom positions, not a crystal structure.
- *Ciona* facts: Dehal et al. 2002; Satou et al. 2008, 2019; Corbo, Levine &
  Zeller 1997 (434-bp Brachyury notochord enhancer); Dehal & Boore 2005 (two
  rounds of vertebrate genome duplication); Ikuta et al. 2004 (nine Hox genes,
  on two chromosomes). Older papers call *C. robusta* "*C. intestinalis* type A".

Source text: Urry, Cain, Wasserman, Minorsky & Orr, *Campbell Biology in Focus*,
3rd ed. (Pearson). No figures or text are reproduced; every picture is generated
in code.
