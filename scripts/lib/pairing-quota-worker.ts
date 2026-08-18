// Fil `worker_threads` FIDÈLE au Chantier D — contrairement à
// `pairing-worker.ts` (débit brut, budget FIXE, pas d'escalade), celui-ci
// reproduit EXACTEMENT le mécanisme réel de `pairSlice.worker.ts` :
// `prepareSearch` reconstruit localement (postMessage ne clone pas
// `totalOf`), `startedAt` VRAI partagé écrasant celui de `prepareSearch`
// (voir le correctif B1, historique-acceleration-et-outillage.md),
// escalade réelle (`maybeEscalateNodeBudget`) à chaque checkpoint.
//
// Deux modes, MÊME code de recherche, seule la coordination diffère :
//  - `fixed` : `params.maxCollected` est déjà la part ÉGALE de ce worker
//    (reproduction fidèle de runParallelPairing actuel) — tourne jusqu'à
//    son propre plafond/budget, aucune coordination avec les autres.
//  - `shared` : `params.maxCollected` est le plafond GLOBAL généreux (pas
//    divisé) — le worker rapporte sa progression à CHAQUE checkpoint
//    (`postMessage`, déjà l'infrastructure existante en prod) et VÉRIFIE
//    un signal d'arrêt envoyé par le parent une fois le total cumulé
//    atteint. `await setImmediate` à chaque checkpoint : cède la main à
//    la boucle d'événements Node pour que le message 'stop' entrant ait
//    une chance d'être traité AVANT l'itération suivante — c'est la seule
//    façon de coordonner sans SharedArrayBuffer/Atomics (indisponible
//    dans le vrai navigateur, voir l'en-tête de pairing-parallel-diag.ts),
//    donc la seule mesure qui reflète honnêtement ce qui est déployable.

import { parentPort, workerData } from 'worker_threads';
import { setImmediate } from 'node:timers/promises';
import { SearchParams, Bucket, BuildCandidate, NodeBudget, prepareSearch, pairBuckets, maybeEscalateNodeBudget } from '../../src/lib/runeBuildOptim';

export interface PairingQuotaWorkerData {
  params: SearchParams;
  bucketASlice: Bucket[];
  bucketsB: Bucket[];
  startedAt: number;
  mode: 'fixed' | 'shared';
}

// ⚠️ Le message `'done'` porte les VRAIS candidats (`BuildCandidate[]`), pas
// seulement leur compte — comme le vrai `pairSlice.worker.ts` en prod
// (`PairSliceResultMessage.candidates`). Nécessaire pour tout appelant qui
// doit comparer l'ENSEMBLE exact trouvé, pas seulement combien.
export type PairingQuotaWorkerMessage =
  | { type: 'progress'; explored: number; foundCount: number }
  | { type: 'done'; explored: number; foundCount: number; truncated: boolean; candidates: BuildCandidate[] };

const data = workerData as PairingQuotaWorkerData;

let stopRequested = false;
if (data.mode === 'shared') {
  parentPort!.on('message', (msg: string) => {
    if (msg === 'stop') stopRequested = true;
  });
}

async function run() {
  const prepared = prepareSearch(data.params);
  if (!prepared) {
    const msg: PairingQuotaWorkerMessage = { type: 'done', explored: 0, foundCount: 0, truncated: false, candidates: [] };
    parentPort!.postMessage(msg);
    return;
  }
  prepared.startedAt = data.startedAt;
  const nodeBudget: NodeBudget = { max: prepared.maxNodes };
  const gen = pairBuckets(prepared, data.bucketASlice, data.bucketsB, nodeBudget);
  let step = gen.next();
  while (!step.done) {
    maybeEscalateNodeBudget(nodeBudget, prepared, step.value, Date.now());
    if (data.mode === 'shared') {
      const progress: PairingQuotaWorkerMessage = { type: 'progress', explored: step.value.explored, foundCount: step.value.candidates.length };
      parentPort!.postMessage(progress);
      await setImmediate(); // laisse passer un éventuel message 'stop' avant l'itération suivante
      if (stopRequested) {
        const done: PairingQuotaWorkerMessage = { type: 'done', explored: step.value.explored, foundCount: step.value.candidates.length, truncated: true, candidates: step.value.candidates };
        parentPort!.postMessage(done);
        return;
      }
    }
    step = gen.next();
  }
  const r = step.value;
  const done: PairingQuotaWorkerMessage = { type: 'done', explored: r.explored, foundCount: r.candidates.length, truncated: r.truncated, candidates: r.candidates };
  parentPort!.postMessage(done);
}

run();
