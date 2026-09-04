// Orchestration de l'appariement PARALLÈLE — la logique seule, avec le
// lancement de worker INJECTÉ. Extraite de `runeBuildOptim.worker.ts`
// (`runParallelPairing`) pour qu'un fil `worker_threads` Node exécute
// exactement la même répartition, la même division de plafond et la même
// fusion de résultats que le navigateur.
//
// ⚠️ **Ce module doit rester NEUTRE** : jamais d'import de `worker_threads`,
// jamais de `Worker` DOM, jamais de `self`. Vite tenterait sinon de résoudre
// du code Node dans le bundle navigateur. C'est la raison d'être de
// `SpawnSlice` : l'appelant fournit sa plateforme, ce module n'en connaît
// aucune. Voir spec/outils/optimizer/parallelisation-partagee.md.

import {
  SearchParams,
  PreparedSearch,
  Bucket,
  BuildCandidate,
  SearchResult,
  partitionBucketsALPT,
  combineParallelPairingResults,
} from '../lib/runeBuildOptim';
import { PairSliceRequest } from './pairSliceBody';
import { PROGRESS_THROTTLE_MS } from './pairingDriver';

// PARALLEL_PAIRING_WORKERS : fixé à 4, délibérément PAS dérivé de
// `navigator.hardwareConcurrency`. Mesuré NON monotone : sur 3 des 4 plus
// gros cas connus, N=8 fait PIRE que N=4 (overhead croissant sans gain de
// calcul supplémentaire) — un réglage automatique basé sur les cœurs
// disponibles aurait été FAUX dans les deux sens (trop de workers sur un
// petit cas, pas forcément mieux sur un gros). Voir pistes.md, point 9,
// troisième mesure, pour le détail des 7 cas.
// ⚠️ Vit ICI, et non plus dans la coquille navigateur, précisément pour que
// les deux plateformes en utilisent la MÊME valeur : un Node qui choisirait
// son propre nombre de fils ne mesurerait plus la production.
export const PARALLEL_PAIRING_WORKERS = 4;

/**
 * Une tranche lancée, vue par l'orchestrateur — sans rien savoir de la
 * plateforme qui l'exécute.
 *
 * ⚠️ `stop` et `terminate` ne sont PAS interchangeables : `stop` est
 * l'arrêt COOPÉRATIF (le worker répond avec les candidats déjà trouvés sur sa
 * tranche, comportement du bouton « Arrêter »), `terminate` est l'arrêt
 * BRUTAL, réservé au nettoyage une fois les résultats obtenus.
 */
export interface SliceHandle {
  done: Promise<SearchResult>;
  stop: () => void;
  terminate: () => void;
}

export type SpawnSlice = (
  request: PairSliceRequest,
  onProgress: (explored: number, newCandidates: BuildCandidate[]) => void
) => SliceHandle;

// Découpe `bucketsA` en au plus `PARALLEL_PAIRING_WORKERS` tranches (jamais
// plus que `bucketsA.length`, sinon des workers recevraient une tranche
// vide pour rien), donne à CHAQUE worker une part ÉGALE du plafond GLOBAL
// de candidats collectés (`prepared.maxCollected`, 100 000 par défaut,
// INCHANGÉ par le mode exhaustif ET le mode normal — décision actée) pour
// que la somme des N workers ne dépasse jamais significativement ce
// plafond, et fusionne les résultats finaux (pas l'accumulateur de
// progression, qui ne sert qu'à l'affichage EN DIRECT) via
// `combineParallelPairingResults` — union simple pour `candidates` (sans
// dédoublonnage nécessaire, les tranches de bucketsA sont disjointes : un
// candidat donné ne peut exister que dans LA tranche qui contient son
// comboA) mais PAS un simple OR pour `truncated` : voir le commentaire de
// `combineParallelPairingResults` (runeBuildOptim.ts) — un worker sur une
// tranche riche qui remplit SON PROPRE quota n'est pas forcément le signe
// d'une recherche globalement incomplète.
//
// Répartition GLOUTONNE par charge réelle (LPT) — voir `partitionBucketsALPT`
// dans runeBuildOptim.ts (déplacée là pour être testable en Node, voir
// tests/rune-optim-parallel-pairing.test.ts) pour la stratégie et sa preuve.
//
// `onHandles` : l'appelant reçoit les poignées pour les inscrire dans SON
// registre d'arrêt (`activePairingWorkers` côté navigateur) — la neutralité
// interdit à ce module de connaître ce registre. Rappelé avec un tableau VIDE
// après le nettoyage, pour que l'appelant vide le sien au même instant.
export async function driveParallelPairing(
  spawnSlice: SpawnSlice,
  params: SearchParams,
  prepared: PreparedSearch,
  bucketsA: Bucket[],
  bucketsB: Bucket[],
  postProgress: (explored: number, found: number, newCandidates: BuildCandidate[]) => void,
  startedAt: number,
  onHandles?: (handles: SliceHandle[]) => void
): Promise<SearchResult> {
  const workerCount = Math.min(PARALLEL_PAIRING_WORKERS, bucketsA.length);
  const slices = partitionBucketsALPT(bucketsA, workerCount);
  const perWorkerMaxCollected = Math.max(1, Math.ceil(prepared.maxCollected / workerCount));

  const exploredByWorker: number[] = new Array(workerCount).fill(0);
  const allCandidates: BuildCandidate[] = [];
  let candidatesSent = 0;
  let lastProgressPost = 0;

  const flushProgress = () => {
    const now = Date.now();
    if (now - lastProgressPost <= PROGRESS_THROTTLE_MS) return;
    lastProgressPost = now;
    const newCandidatesSlice = allCandidates.slice(candidatesSent);
    candidatesSent = allCandidates.length;
    const explored = exploredByWorker.reduce((s, v) => s + v, 0);
    postProgress(explored, allCandidates.length, newCandidatesSlice);
  };

  const handles = slices.map((bucketASlice, i) => {
    const sliceParams: SearchParams = { ...params, maxCollected: perWorkerMaxCollected };
    return spawnSlice({ params: sliceParams, bucketASlice, bucketsB, startedAt }, (explored, newCandidates) => {
      exploredByWorker[i] = explored;
      if (newCandidates.length > 0) allCandidates.push(...newCandidates);
      flushProgress();
    });
  });
  onHandles?.(handles);

  // Arrêt manuel pendant cette phase : géré par le handler `stop` global
  // (`self.onmessage`), qui poste `{stop:true}` à chaque worker actif —
  // chacun répond gracieusement (voir pairSliceBody.ts), donc `Promise.
  // all` se résout normalement, juste plus tôt et avec `truncated: true`.
  const results = await Promise.all(handles.map((h) => h.done));
  for (const h of handles) h.terminate();
  onHandles?.([]);

  return combineParallelPairingResults(results, perWorkerMaxCollected, prepared.maxCollected);
}
