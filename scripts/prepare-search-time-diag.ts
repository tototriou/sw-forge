// Mesure le temps de `prepareSearch` SEUL (mainStatFilteredBySlot +
// pruneDominated + eliminateInfeasible + filterSlot + deriveMinMaxContext),
// sans buildBuckets ni pairBuckets, sur les 7 cas connus réels — préréglage
// « moyen » (le vrai défaut de production). SÉQUENTIEL, jamais parallélisé :
// comparaison de TEMPS, voir .claude/skills/optimizer-perf-testing/SKILL.md.
//
// Sert à mesurer le coût du point 3 de la deuxième revue externe
// (2026-08-19) : `pairSlice.worker.ts` rappelle `prepareSearch` en entier
// à chaque worker de pairing parallèle (jusqu'à 4×), alors que le parent
// (`runeBuildOptim.worker.ts`) l'a déjà calculé une fois — ce script mesure
// le coût d'UN appel, pour juger si le fixer localement (`isDominated`
// précalculé, déjà fait) suffit ou si partager `prepared.filtered` entre
// parent et enfants (éviter la redondance ×4 elle-même) vaut la complexité.
//
// Usage : prepare-search-time-diag.ts

import { SearchParams, SLOT_FILTER_PRESETS, prepareSearch } from '../src/lib/runeBuildOptim';
import { CASES, loadCase } from './lib/perfShared';

const MOYEN_CAP = SLOT_FILTER_PRESETS.find((p) => p.key === 'moyen')!.cap;

console.log(`Temps de prepareSearch SEUL — préréglage moyen (cap=${MOYEN_CAP}), séquentiel.\n`);

let totalMs = 0;
for (const c of CASES) {
  const { gear, allRunes, requirement } = loadCase(c);
  const params: SearchParams = {
    base: gear.base, artifacts: gear.artifacts, relic: gear.relic, pool: allRunes, requirement,
    metric: 'eff', objective: c.objective, maxMs: 10 * 60 * 1000, slotFilterCap: MOYEN_CAP,
  };
  const t0 = performance.now();
  const prepared = prepareSearch(params);
  const ms = performance.now() - t0;
  totalMs += ms;
  if (!prepared) {
    console.log(`${c.label} : pool vide après filtrage, ignoré (${ms.toFixed(1)}ms)`);
    continue;
  }
  console.log(`${c.label} : ${ms.toFixed(1)}ms (pools filtrés : ${prepared.filtered.map((s) => s.length).join(' x ')})`);
}
console.log(`\nTOTAL (7 cas) : ${totalMs.toFixed(1)}ms — coût d'UN appel. En pairing parallèle (jusqu'à 4 workers), ce coût est payé jusqu'à 4× en plus du parent.`);
