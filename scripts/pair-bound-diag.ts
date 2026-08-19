// Mesure, sur les cas réels connus (voir scripts/lib/perfShared.ts), l'écart
// entre estimatePairBound (majorant calculable AVANT buildBuckets) et
// totalPairCount (le nombre réel, connu seulement APRÈS construction) — pour
// savoir si le majorant reste un signal utile ou s'il est trop lâche pour
// être affiché tel quel à l'écran.
//
// ⚠️ Conclusion mesurée (voir estimatePairBound, runeBuildOptim.ts) : écart
// de ×6 à ×300 000 000 selon le cas — le majorant n'est PAS affiché à
// l'écran. Script conservé pour rejouer la mesure si le calcul est affiné un
// jour (voir spec/outils/optimizer/pistes.md).
import { CASES, loadCase } from './lib/perfShared';
import { prepareSearch, buildBuckets, totalPairCount, estimatePairBound, SLOT_FILTER_PRESETS } from '../src/lib/runeBuildOptim';
import { drain } from './lib/drain';

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

for (const c of CASES) {
  const { gear, allRunes, requirement } = loadCase(c);
  console.log(`\n=== ${c.label} (${Object.keys(requirement.minStats).length} minStats, sets=${requirement.sets.join(',')}) ===`);
  for (const preset of SLOT_FILTER_PRESETS) {
    const params = { base: gear.base, artifacts: gear.artifacts, relic: gear.relic, pool: allRunes, requirement, metric: 'eff' as const, objective: c.objective, slotFilterCap: preset.cap };
    const prepared = prepareSearch(params);
    if (!prepared) {
      console.log(`  ${preset.label.padEnd(8)} pool vide après filtrage, ignoré`);
      continue;
    }
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces));
    const real = totalPairCount(prepared, bucketsA, bucketsB);
    const bound = estimatePairBound(requirement, preset.cap, c.objective);
    const ratio = real > 0 ? bound / real : Infinity;
    console.log(`  ${preset.label.padEnd(8)} bucketCap=${String(prepared.bucketCap).padEnd(6)} réel=${fmt(real).padEnd(15)} borne=${fmt(bound).padEnd(20)} ratio=×${ratio > 1e6 ? ratio.toExponential(1) : Math.round(ratio)}`);
  }
}
