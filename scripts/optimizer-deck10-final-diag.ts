// Diagnostic AD HOC (temporaire) — reprise du test précédent, cette fois via
// le VRAI chemin de production (recipeToSearchParams, comme optimizer-
// search.ts) pour la construction des SearchParams — corrige l'omission
// mainStats/artefacts du script précédent. Compare ensuite combosOrderMode
// 'potential' vs 'relevance' sur ces mêmes params, exactement comme
// combos-order-mode-real-account-diag.ts.
//
// Usage : optimizer-deck10-final-diag.ts <export.json> <recipe.json> <deckId> [maxMs=300000]

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadSiegeMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { prepareSearch, buildBuckets, pairBuckets, totalPairCount, NodeBudget, maybeEscalateNodeBudget } from '../src/lib/runeBuildOptim';
import { drain } from './lib/drain';

const [exportPath, recipePath, deckIdArg, maxMsArg] = process.argv.slice(2);
if (!exportPath || !recipePath || !deckIdArg) {
  console.error('Usage: optimizer-deck10-final-diag.ts <export.json> <recipe.json> <deckId> [maxMs=300000]');
  process.exit(1);
}
const MAX_MS = maxMsArg ? Number(maxMsArg) : 300_000;

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}
console.log(
  `Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — mainStats ${JSON.stringify(recipe.requirement.mainStats)} — ` +
    `objectif ${recipe.objective} — métrique ${recipe.metric} — préfiltrage ${recipe.slotFilterPreset} — artefacts ${JSON.stringify(recipe.artifactMainByKind)}`
);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);

const loaded = loadSiegeMonster({ exportPath, deckId: Number(deckIdArg), monsterName: recipe.monsterName, defense: false, rest: [] });
printMonsterSummary('siège offense', loaded);

const targetRuneIds = new Set(loaded.gear.runes.map((r) => r.id));
console.log(`Cible (build réellement équipé) : [${[...targetRuneIds].join(',')}]\n`);

// ⚠️ Chemin RÉEL de production — même fonction que optimizer-search.ts,
// jamais une reconstruction manuelle de SearchParams (voir la question
// posée cette session sur la fidélité de recipeToSearchParams.ts).
const baseParams = recipeToSearchParams(recipe, loaded);
console.log(`Artefacts résolus : ${JSON.stringify(baseParams.artifacts.map((a) => ({ kind: a.kind, main: a.main })))}`);

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sb = [...b].sort((x, y) => x - y);
  return [...a].sort((x, y) => x - y).every((v, i) => v === sb[i]);
}

const CHECKPOINTS = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0];

function measure(combosOrderMode: 'potential' | 'relevance' | 'combined') {
  const params = { ...baseParams, maxMs: MAX_MS, combosOrderMode, maxCollected: 1_500_000 };
  const prepared = prepareSearch(params);
  if (!prepared) return null;
  const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, false, combosOrderMode));
  const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, false, combosOrderMode));
  const total = totalPairCount(prepared, bucketsA, bucketsB);

  const nodeBudget: NodeBudget = { max: prepared.maxNodes };
  const gen = pairBuckets(prepared, bucketsA, bucketsB, nodeBudget);
  let step = gen.next();
  let foundExplored: number | null = null;
  let nextCheckpointIdx = 0;
  const yieldCurve: (number | null)[] = CHECKPOINTS.map(() => null);
  let lastExplored = 0;
  let lastCandidates = 0;
  while (!step.done) {
    const progress = step.value;
    lastExplored = progress.explored;
    lastCandidates = progress.candidates.length;
    if (foundExplored === null && progress.candidates.some((c) => sameIds(c.runeIds, [...targetRuneIds]))) {
      foundExplored = progress.explored;
    }
    while (nextCheckpointIdx < CHECKPOINTS.length && total > 0 && progress.explored >= CHECKPOINTS[nextCheckpointIdx] * total) {
      yieldCurve[nextCheckpointIdx] = progress.candidates.length;
      nextCheckpointIdx++;
    }
    maybeEscalateNodeBudget(nodeBudget, prepared, progress, Date.now());
    step = gen.next();
  }
  const result = step.value;
  if (foundExplored === null && result.candidates.some((c) => sameIds(c.runeIds, [...targetRuneIds]))) {
    foundExplored = lastExplored;
  }
  return {
    foundExplored,
    foundRank: foundExplored != null && total > 0 ? foundExplored / total : null,
    totalPairCount: total,
    candidatesCount: result.candidates.length,
    truncated: result.truncated,
  };
}

for (const mode of ['potential', 'relevance', 'combined'] as const) {
  const t0 = performance.now();
  const r = measure(mode);
  const ms = performance.now() - t0;
  console.log(`=== ${mode} (${(ms / 1000).toFixed(1)}s) ===`);
  if (!r) {
    console.log('  prepareSearch = null (infaisable)');
    continue;
  }
  console.log(`  ${r.candidatesCount} candidat(s) — tronqué : ${r.truncated} — totalPairCount=${r.totalPairCount.toLocaleString('fr-FR')}`);
  console.log(
    r.foundRank == null
      ? '  CIBLE NON TROUVÉE'
      : `  CIBLE TROUVÉE — rang=${r.foundRank.toFixed(4)} (explored=${r.foundExplored!.toLocaleString('fr-FR')}/${r.totalPairCount.toLocaleString('fr-FR')})`
  );
}
