// Exécute une recherche JUSQU'AU BOUT, avec la MÊME fidélité que l'app réelle
// (runeBuildOptim.worker.ts) et scripts/perf-battery.ts : prepareSearch →
// construireMoitie ×2 → apparier (src/lib/rechercheRunes.ts).
//
// ⚠️ Cette factorisation existe parce qu'un script qui pilote l'appariement
// sans reproduire le chemin de production peut n'explorer qu'une fraction
// dérisoire de l'espace réel (voir le skill `algo-verify`, section
// « Fidélité des scripts diagnostics »). Le moteur n'a plus de budget de
// paires à escalader, mais la raison d'être de ce module tient toujours :
// c'est ici, et pas dans chaque script, que vit la séquence fidèle au chemin
// de prod.
//
// ⚠️ Écart de fidélité CONNU : ce script reste TOUJOURS séquentiel, là où
// l'écran apparie en parallèle dès que `totalPairs ≥ PARALLEL_PAIRING_THRESHOLD`.
// Le parallèle rend l'ordre séquentiel (même plafond global, mêmes
// candidats, même quasi-succès) : seule une recherche coupée par le TEMPS
// peut différer, le parallèle ayant parcouru davantage dans le même délai.
// Sans conséquence en mode exhaustif (`exhaustiveSearch`) ni sous le seul
// plafond de candidats.
//
// Usage : `runSearchToCompletion(params)` — synchrone jusqu'au bout, pas de
// pilotage pas à pas (pas besoin de rendre la main à une UI dans un script).

import {
  SearchParams,
  SearchResult,
  prepareSearch,
} from '../../src/lib/runeBuildOptim';
import { apparier, construireMoitie } from '../../src/lib/rechercheRunes';
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
      candidates: [], explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null,
      prepMs: tPrepared - t0, buildWallMs: 0, pairingMs: 0, totalMs: tPrepared - t0,
    };
  }

  const bucketsA = drain(
    construireMoitie('A', [0, 1, 2], prepared, prepared.maxSetsForA, params.combosOrderMode)
  );
  const bucketsB = drain(
    construireMoitie('B', [3, 4, 5], prepared, prepared.maxSetsForB, params.combosOrderMode)
  );
  const tBuild = performance.now();

  const result = drain(apparier(prepared, bucketsA, bucketsB));
  const tEnd = performance.now();

  return {
    ...result,
    prepMs: tPrepared - t0,
    buildWallMs: tBuild - tPrepared,
    pairingMs: tEnd - tBuild,
    totalMs: tEnd - t0,
  };
}
