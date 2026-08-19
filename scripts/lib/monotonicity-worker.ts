// Fil `worker_threads` : vérifie la monotonicité d'UN cas (voir
// `checkMonotonicityForCase`, perfShared.ts). Permet à `perf-battery.ts
// --monotonicity` de traiter les 7 cas connus EN PARALLÈLE plutôt qu'un par
// un — sans risque de précision à protéger ici (ce mode ne mesure aucun
// temps comparé à une baseline, seulement un verdict de justesse), donc
// aucune raison de garder ces 7 vérifications séquentielles comme le fait
// le mode de mesure de temps (voir son propre commentaire sur la
// contention CPU/mémoire).
//
// Repris via esbuild en .cjs par perf-battery.ts avant d'être passé à
// `new Worker(...)` — même patron que build-half-worker.ts.

import { parentPort, workerData } from 'worker_threads';
import { checkMonotonicityForCase, Case, MonotonicityRow } from './perfShared';

export interface MonotonicityWorkerResult {
  label: string;
  rows: MonotonicityRow[];
}

const c = workerData as Case;
const rows = checkMonotonicityForCase(c);
const result: MonotonicityWorkerResult = { label: c.label, rows };
parentPort!.postMessage(result);
