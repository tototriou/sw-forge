// Exécute une recherche JUSQU'AU BOUT, avec la MÊME fidélité que l'app réelle
// (runeBuildOptim.worker.ts) et scripts/perf-battery.ts : prepareSearch →
// buildBuckets ×2 → pairBuckets.
//
// ⚠️ Cette factorisation existe à cause d'un incident : un script pilotait
// `pairBuckets` sans reproduire l'escalade du budget de paires du chemin de
// production, et n'explorait donc qu'une fraction dérisoire de l'espace réel
// (voir le skill `algo-verify`, section « Fidélité des scripts
// diagnostics »). Ce budget a depuis été supprimé du moteur (piste 8) : il
// n'y a plus rien à reproduire de ce côté-là, mais la raison d'être de ce
// module tient toujours — c'est ici, et pas dans chaque script, que vit la
// séquence fidèle au chemin de prod.
//
// ⚠️ Écart de fidélité CONNU depuis l'extension de la parallélisation de
// l'appariement au mode normal (voir pistes.md, point 9) : ce script reste
// TOUJOURS séquentiel (Node n'a pas de Web Worker) — la vraie app peut
// paralléliser l'appariement (4 workers) dès que `totalPairs ≥ 100M`, quel
// que soit le mode. Sur une recherche NORMALE (tronquée) assez grande, le
// séquentiel ici peut donc trouver MOINS de candidats que ce que l'écran a
// réellement affiché pour la MÊME recette (le parallèle bénéficie d'un
// débit ×N dans la même fenêtre de temps) — jamais l'inverse (le
// parallèle ne perd rien, vérifié par différentiel). Sans conséquence en
// mode exhaustif (`exhaustiveSearch`) : les deux chemins convergent vers le
// même ensemble complet, juste à des vitesses différentes.
//
// Usage : `runSearchToCompletion(params)` — synchrone jusqu'au bout, pas de
// pilotage pas à pas (pas besoin de rendre la main à une UI dans un script).

import {
  SearchParams,
  SearchResult,
  prepareSearch,
  buildBuckets,
  pairBuckets,
} from '../../src/lib/runeBuildOptim';
import { drain } from './drain';

export interface TimedSearchResult extends SearchResult {
  prepMs: number;
  buildWallMs: number;
  pairingMs: number;
  totalMs: number;
}

export function runSearchToCompletion(params: SearchParams): TimedSearchResult {
  const t0 = performance.now();
  const prepared = prepareSearch(params);
  const tPrepared = performance.now();
  if (!prepared) {
    return {
      candidates: [], explored: 0, truncated: false,
      prepMs: tPrepared - t0, buildWallMs: 0, pairingMs: 0, totalMs: tPrepared - t0,
    };
  }

  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA,
      undefined, params.adaptiveTrancheWeighting, params.combosOrderMode
    )
  );
  const bucketsB = drain(
    buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB,
      undefined, params.adaptiveTrancheWeighting, params.combosOrderMode
    )
  );
  const tBuild = performance.now();

  const result = drain(pairBuckets(prepared, bucketsA, bucketsB));
  const tEnd = performance.now();

  return {
    ...result,
    prepMs: tPrepared - t0,
    buildWallMs: tBuild - tPrepared,
    pairingMs: tEnd - tBuild,
    totalMs: tEnd - t0,
  };
}
