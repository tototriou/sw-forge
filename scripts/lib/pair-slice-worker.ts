// Coquille `worker_threads` d'une TRANCHE d'appariement — pendant Node de
// `src/workers/pairSlice.worker.ts` (coquille navigateur).
//
// ⚠️ **Aucune logique ici non plus.** Les deux coquilles appellent le MÊME
// `runPairSlice` (`src/workers/pairSliceBody.ts`) : c'est tout l'objet du
// chantier, voir spec/outils/optimizer/parallelisation-partagee.md. Ce
// fichier ne fait que traduire le protocole de messages du navigateur
// (`self.onmessage` / `postMessage`) vers celui de Node (`workerData` /
// `parentPort`).
//
// ⚠️ Il REMPLACE, pour tout ce qui doit être fidèle à la production, le
// prototype `pairing-worker.ts` — dont l'en-tête annonce lui-même « pas
// d'escalade ici : le prototype mesure le débit brut ». Celui-ci hérite de
// l'escalade, de l'écrasement de `startedAt` et de l'arrêt coopératif, parce
// qu'il n'en réimplémente aucun.
//
// ⚠️ La requête arrive par `workerData` (une seule fois, à la construction)
// et non par un message, contrairement au navigateur : c'est la seule
// divergence de protocole. L'ARRÊT, lui, reste un message entrant — il doit
// pouvoir survenir en cours de route. `drivePairing` rend la main à la boucle
// d'événements toutes les `YIELD_THROTTLE_MS`, ce qui laisse ce message être
// traité : sans cette respiration, un worker Node mono-tâche ne le verrait
// jamais avant la fin.

import { parentPort, workerData } from 'worker_threads';
import { runPairSlice, PairSliceRequest } from '../../src/workers/pairSliceBody';

let stopped = false;
parentPort!.on('message', (msg: unknown) => {
  if (msg && typeof msg === 'object' && 'stop' in msg) stopped = true;
});

async function run(): Promise<void> {
  const out = await runPairSlice(
    workerData as PairSliceRequest,
    () => stopped,
    (message) => parentPort!.postMessage(message)
  );
  parentPort!.postMessage(out);
}

void run();
