// Mesure le temps de CONSTRUCTION des demi-builds (buildBuckets ×2), sans
// appariement, sur les 7 cas connus réels — préréglage « moyen » (le vrai
// défaut de production). SÉQUENTIEL, jamais parallélisé : c'est une
// comparaison de TEMPS, voir .claude/skills/optimizer-perf-testing/SKILL.md
// (« pas la même règle pour la justesse et le temps » — la contention
// fausserait directement ce qu'on mesure ici).
//
// Sert à vérifier si la restriction de l'itération sur r2 (buildBuckets,
// « sous-ensemble de secours » quand r0+r1 n'ont ni pièce ni joker d'un set
// >3 pièces) apporte un gain mesurable AU-DELÀ du seul cas Camilla déjà
// testé — voir spec/outils/optimizer/historique/historique-acceleration-et-outillage.md,
// « Chantier D ».
//
// ⚠️ **POURQUOI CE SCRIPT SURVIT AU HARNAIS** (vérifié le 2026-09-08, en même
// temps que `--cas=<index|nom|tous>`). `diagnostic-harness.ts --cas=tous
// --arret=demi-builds` rend `demiBuildA`/`demiBuildB` sur les mêmes 7 cas —
// mais ce ne sont PAS les mêmes grandeurs : le harnais construit les deux
// moitiés dans deux `worker_threads` SIMULTANÉS, parce que la production
// parallélise toujours et qu'un harnais qui choisirait autrement cesserait de
// mesurer la production (spec/outils/optimizer/harnais-diagnostic.md §7.2).
// Ses deux nombres sont donc le coût de chaque moitié SOUS CONCURRENCE de
// l'autre. Ce script-ci mesure le coût ISOLÉ d'une moitié, un fil à la fois.
// Le harnais ne peut pas produire cette seconde grandeur sans adopter un
// régime que sa doctrine lui interdit : ce script est le seul endroit où elle
// existe. ⚠️ Ne pas le supprimer « parce que le harnais couvre ».
//
// ⚠️ Ce qu'il PARTAGE avec le script `prepare-search-time-diag.ts` supprimé,
// et qui a été MESURÉ plutôt que supposé : le `SearchParams` monté à la main
// ci-dessous (sans `artifactBounds` ni exclusions, là où le harnais passe par
// `recipeToSearchParams`) donne, sur ces 7 cas, EXACTEMENT les mêmes pools
// filtrés que le chemin de production — comparés emplacement par emplacement.
// Son `prepared` est donc bien celui de la prod, et le coût qu'il mesure est
// celui de la vraie construction.
//
// Usage : construction-time-diag.ts

import { SearchParams, SLOT_FILTER_PRESETS, prepareSearch, buildBuckets } from '../src/lib/runeBuildOptim';
import { CASES, loadCase } from './lib/perfShared';
import { drain } from './lib/drain';

const MOYEN_CAP = SLOT_FILTER_PRESETS.find((p) => p.key === 'moyen')!.cap;

console.log(`Temps de construction (buildBuckets ×2, PAS d'appariement) — préréglage moyen (cap=${MOYEN_CAP}), séquentiel.\n`);

let totalMs = 0;
for (const c of CASES) {
  const { gear, allRunes, requirement } = loadCase(c);
  const params: SearchParams = {
    base: gear.base, artifacts: gear.artifacts, relic: gear.relic, pool: allRunes, requirement,
    metric: 'eff', objective: c.objective, maxMs: 10 * 60 * 1000, slotFilterCap: MOYEN_CAP,
  };
  const prepared = prepareSearch(params);
  if (!prepared) {
    console.log(`${c.label} : pool vide après filtrage, ignoré`);
    continue;
  }
  const t0 = performance.now();
  const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA));
  const tA = performance.now();
  const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB));
  const tB = performance.now();
  const ms = tB - t0;
  totalMs += ms;
  console.log(`${c.label} : A=${(tA - t0).toFixed(1)}ms (${bucketsA.length} compartiments) · B=${(tB - tA).toFixed(1)}ms (${bucketsB.length} compartiments) · total=${ms.toFixed(1)}ms`);
}
console.log(`\nTOTAL (7 cas) : ${totalMs.toFixed(1)}ms`);
