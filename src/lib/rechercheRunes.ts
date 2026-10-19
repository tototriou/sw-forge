// Le moteur de recherche de runes d'un bloc, hors Worker : `prepareSearch`,
// les deux moitiés, puis leur appariement, dans le même fil. Les tests, le
// CLI et les scripts passent par ici ; le Worker de l'écran
// (`src/workers/runeBuildOptim.worker.ts`) enchaîne les mêmes étapes, les
// moitiés dans deux Workers enfants.
//
// ⚠️ Module à part de `runeBuildOptim.ts` : l'orchestration appelle des
// modules qui importent eux-mêmes `runeBuildOptim.ts`, et un import de valeur
// dans l'autre sens ferait un cycle au chargement.
// Voir docs/03-developpeur/optimizer/moteur/pipeline.md.

import {
  SearchParams,
  SearchProgress,
  SearchResult,
  TraceCandidat,
  buildBuckets,
  pairBuckets,
  prepareSearch,
} from './runeBuildOptim';

/**
 * Cœur du moteur, sous forme de GÉNÉRATEUR : un point de passage à chaque
 * rune du premier emplacement d'une moitié pendant la construction, puis
 * toutes les `CHECKPOINT_EVERY` paires à l'appariement. `searchBuilds` le
 * draine d'un bloc.
 */
export function* searchBuildsSteps(params: SearchParams): Generator<SearchProgress, SearchResult, void> {
  // Le traceur d'un rejet par pré-filtrage : `prepareSearch` le construit puis le perd en rendant
  // `null` — récupéré ici via `onReject` pour qu'un résultat vide reste
  // diagnosticable (étage `feasibility`/`filterslot` à 0), au lieu de
  // disparaître précisément quand l'instrumentation sert le plus.
  let traceurRejet: TraceCandidat | undefined;
  const prepared = prepareSearch(params, undefined, (t) => { traceurRejet = t; });
  if (!prepared) {
    return { candidates: [], explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null, ...(traceurRejet ? { traceur: traceurRejet } : {}) };
  }
  const bucketsA = yield* buildBuckets(
    'A', [0, 1, 2], prepared, prepared.maxSetsForA,
    undefined, params.adaptiveTrancheWeighting, params.combosOrderMode
  );
  const bucketsB = yield* buildBuckets(
    'B', [3, 4, 5], prepared, prepared.maxSetsForB,
    undefined, params.adaptiveTrancheWeighting, params.combosOrderMode
  );
  return yield* pairBuckets(prepared, bucketsA, bucketsB);
}

/** Le générateur drainé jusqu'au bout, en un appel synchrone. */
export function searchBuilds(params: SearchParams): SearchResult {
  const gen = searchBuildsSteps(params);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}
