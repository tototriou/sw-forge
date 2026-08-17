// Fil `worker_threads` : reçoit une TRANCHE de bucketsA (round-robin) + la
// moitié B COMPLÈTE (pas de SharedArrayBuffer disponible aujourd'hui — voir
// scripts/pairing-parallel-diag.ts, en-tête — donc une vraie copie par
// worker, pas un pointeur partagé), et appareille jusqu'à un budget de
// paires FIXE (pas d'escalade ici : le prototype mesure le débit brut de
// pairBuckets en parallèle, pas le mécanisme de coordination d'un budget
// partagé entre workers — une question distincte, à traiter SI la
// parallélisation s'avère payante).
//
// ⚠️ `prepared` (avec sa fonction `totalOf`) n'est PAS clonable via
// `postMessage` (structured clone ne clone jamais de fonction) — chaque
// worker reconstruit donc `PreparedSearch` lui-même via `prepareSearch`,
// à partir des seuls `SearchParams` reçus (peu coûteux, voir
// runeBuildOptim.ts : « séquentielle et bon marché » comparé à `buildBuckets`).

import { parentPort, workerData } from 'worker_threads';
import { SearchParams, Bucket, NodeBudget, prepareSearch, pairBuckets } from '../../src/lib/runeBuildOptim';

export interface PairingWorkerData {
  params: SearchParams;
  bucketASlice: Bucket[];
  bucketsB: Bucket[];
  nodeBudgetMax: number;
}

export interface PairingWorkerResult {
  explored: number;
  foundCount: number;
  truncated: boolean;
}

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

const data = workerData as PairingWorkerData;
const prepared = prepareSearch(data.params);
if (!prepared) {
  const empty: PairingWorkerResult = { explored: 0, foundCount: 0, truncated: false };
  parentPort!.postMessage(empty);
} else {
  const nodeBudget: NodeBudget = { max: data.nodeBudgetMax };
  const result = drain(pairBuckets(prepared, data.bucketASlice, data.bucketsB, nodeBudget));
  const out: PairingWorkerResult = { explored: result.explored, foundCount: result.candidates.length, truncated: result.truncated };
  parentPort!.postMessage(out);
}
