// Recherche complète du CLI : préparation, moitiés typées dans leurs Workers,
// régime de l'écran, puis son lanceur compact et ses crédits. Les objets sont
// matérialisés après le scellement, pour le classement et la résolution.
// Usage : await runSearchToCompletion(params).
// Voir docs/03-developpeur/optimizer/moteur/pipeline.md.

import {
  SearchParams,
  SearchResult,
  prepareSearch,
} from '../../src/lib/runeBuildOptim';
import { analyserEspace } from '../../src/lib/appariementRapide';
import { nombreDeTravailleurs, regimeAppariement } from '../../src/workers/parallelPairing';
import { availableParallelism } from 'os';
import { construireMoitiesEnParallele, ensureBuildHalfBundle } from './buildHalvesNode';
import { apparierNode, assurerBundleAppariementRapide } from './appariementRapideNode';

export interface TimedSearchResult extends SearchResult {
  prepMs: number;
  buildWallMs: number;
  pairingMs: number;
  totalMs: number;
}

export async function runSearchToCompletion(params: SearchParams): Promise<TimedSearchResult> {
  const [bundleMoities, cheminBundle] = await Promise.all([ensureBuildHalfBundle(), assurerBundleAppariementRapide()]);
  const t0 = performance.now();
  const prepared = prepareSearch(params);
  const tPrepared = performance.now();
  if (!prepared) {
    return {
      candidates: [], explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null,
      prepMs: tPrepared - t0, buildWallMs: 0, pairingMs: 0, totalMs: tPrepared - t0,
    };
  }

  const { bucketsA, bucketsB } = await construireMoitiesEnParallele(prepared, params, bundleMoities);
  const tBuild = performance.now();

  // Comme le Worker de recherche : relevé, contrat et encodage une fois, repris par l'appariement.
  const espace = analyserEspace(prepared, bucketsA, bucketsB);
  const totalPaires = espace.releve.total;
  const { resultat: result } = await apparierNode({ params, prepared, bucketsA, bucketsB, totalPaires, espace,
    regime: regimeAppariement(totalPaires, espace.motifContrat),
    travailleurs: nombreDeTravailleurs(availableParallelism(), null), startedAt: prepared.startedAt, cheminBundle });
  const tEnd = performance.now();

  return {
    ...result,
    prepMs: tPrepared - t0,
    buildWallMs: tBuild - tPrepared,
    pairingMs: tEnd - tBuild,
    totalMs: tEnd - t0,
  };
}
