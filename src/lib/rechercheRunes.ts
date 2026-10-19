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
  Bucket,
  BuildBucketsContext,
  BuildingProgress,
  PairingProgress,
  PreparedSearch,
  SearchParams,
  SearchProgress,
  SearchResult,
  TraceCandidat,
  buildBuckets,
  prepareSearch,
  trancheReallocation,
} from './runeBuildOptim';
import { OrdreCombos, construireMoitieRapide } from './constructionRapide';
import { apparierRapide } from './appariementRapide';

/**
 * L'appariement séquentiel par le chemin de production : le noyau sur
 * tableaux typés (`apparierRapide`), qui saute sans les juger un à un les
 * comboB dont la paire échouerait au test rapide (`quickOk`) et visite les
 * autres dans l'ordre de `pairBuckets` ; `pairBuckets` lui-même hors contrat
 * numérique ou avec un traceur (`verifierContrat`). Même résultat que
 * `pairBuckets` (`tests/appariement-rapide.test.ts`), mêmes points de passage
 * (toutes les `CHECKPOINT_EVERY` paires TRAITÉES, sautées comprises,
 * `explored` = paires traitées). Le résultat est un `SearchResult` strict :
 * les compteurs propres au noyau (`visitees`, `chemin`…) ne voyagent pas.
 */
export function* apparier(prepared: PreparedSearch, bucketsA: Bucket[], bucketsB: Bucket[]): Generator<PairingProgress, SearchResult, void> {
  const r = yield* apparierRapide(prepared, bucketsA, bucketsB);
  return {
    candidates: r.candidates,
    explored: r.explored,
    truncated: r.truncated,
    nearMissByCondition: r.nearMissByCondition,
    globalNearMiss: r.globalNearMiss,
    ...(r.traceur ? { traceur: r.traceur } : {}),
  };
}

/** Au-delà, le code entier d'un triplet ne tient plus dans 32 bits : `constructionRapide` refuse. */
const TRIPLETS_MAX_NOYAU = 0x7fffffff;

/**
 * Pourquoi une moitié se construit par `buildBuckets` plutôt que par le noyau
 * sur tableaux typés, ou `null` quand le noyau la prend. Quatre cas : un
 * traceur de diagnostic (le noyau ne le remplit pas), une moitié de plus de
 * 2³¹ triplets (≈ 1 290 runes par emplacement), un `bucketCap` (override de
 * mesure) dont les tas sortiraient des entiers 32 bits, ou une capacité
 * redistribuée par « Prioriser les stats les plus difficiles » qui en
 * sortirait.
 */
export function motifRepliConstruction(
  ctx: BuildBucketsContext,
  slotIdxs: readonly [number, number, number],
  adaptiveTrancheWeighting = false
): string | null {
  if (ctx.traceur) return 'traceur de diagnostic demandé';
  const triplets = slotIdxs.reduce((p, i) => p * ctx.filtered[i].length, 1);
  if (triplets > TRIPLETS_MAX_NOYAU) return `${triplets} triplets dépassent le code entier 32 bits du noyau`;
  // Les capacités des tas entrent dans un `Int32Array` : `bucketCap` (un
  // override de mesure peut valoir 2³¹ ou `Infinity`) et celles que
  // « Prioriser les stats les plus difficiles » en redistribue, dont aucune ne
  // dépasse le budget total (une tranche par stat retenue, plus la générique
  // et la combinée).
  const tranches = 2 + ctx.retentionKeys.length;
  if (!Number.isInteger(ctx.bucketCap) || ctx.bucketCap < 0 || ctx.bucketCap * tranches > TRIPLETS_MAX_NOYAU) {
    return `bucketCap ${ctx.bucketCap} hors des capacités entières du noyau (${tranches} tranches)`;
  }
  if (adaptiveTrancheWeighting && ctx.retentionKeys.length > 0) {
    const { reallocatedCap } = trancheReallocation(ctx.filtered, [...slotIdxs], ctx.retentionKeys, ctx.base, ctx.bucketCap);
    for (const k of ctx.retentionKeys) {
      const cap = reallocatedCap[k];
      if (!Number.isInteger(cap) || cap < 0 || cap > TRIPLETS_MAX_NOYAU) return `capacité redistribuée de ${k} (${cap}) hors des entiers 32 bits du noyau`;
    }
  }
  return null;
}

/**
 * La construction d'une moitié par le chemin de production : le noyau sur
 * tableaux typés (`construireMoitieRapide`), qui rend EXACTEMENT les
 * compartiments de `buildBuckets` (mêmes combinaisons dans le même ordre,
 * mêmes bornes, même potentiel ; `tests/construction-rapide.test.ts`), avec
 * le même point de passage par rune du premier emplacement ; `buildBuckets`
 * dans les cas de `motifRepliConstruction`. Mêmes arguments que
 * `buildBuckets`, sans `skylineKeys`, qu'aucun appel de production ne passe.
 */
export function* construireMoitie(
  half: 'A' | 'B',
  slotIdxs: readonly [number, number, number],
  ctx: BuildBucketsContext,
  otherHalfMaxSets: number[],
  adaptiveTrancheWeighting = false,
  combosOrderMode: OrdreCombos = 'objective'
): Generator<BuildingProgress, Bucket[], void> {
  if (motifRepliConstruction(ctx, slotIdxs, adaptiveTrancheWeighting) != null) {
    return yield* buildBuckets(half, slotIdxs, ctx, otherHalfMaxSets, undefined, adaptiveTrancheWeighting, combosOrderMode);
  }
  return yield* construireMoitieRapide(half, slotIdxs, ctx, otherHalfMaxSets, adaptiveTrancheWeighting, combosOrderMode);
}

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
  const bucketsA = yield* construireMoitie(
    'A', [0, 1, 2], prepared, prepared.maxSetsForA, params.adaptiveTrancheWeighting, params.combosOrderMode
  );
  const bucketsB = yield* construireMoitie(
    'B', [3, 4, 5], prepared, prepared.maxSetsForB, params.adaptiveTrancheWeighting, params.combosOrderMode
  );
  return yield* apparier(prepared, bucketsA, bucketsB);
}

/** Le générateur drainé jusqu'au bout, en un appel synchrone. */
export function searchBuilds(params: SearchParams): SearchResult {
  const gen = searchBuildsSteps(params);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}
