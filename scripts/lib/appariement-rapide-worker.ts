// Coquille `worker_threads` d'un Worker de l'appariement parallèle de
// production — pendant Node de src/workers/appariementRapide.worker.ts —,
// aucune logique ici : `initialiserTravailleur` et `traiterMorceau`
// (src/lib/appariementRapide.ts) font tout. L'initialisation arrive par
// `workerData` (tableaux typés transférés une fois, seule divergence de
// protocole avec le navigateur), les morceaux par message, à la demande.

import { parentPort, workerData } from 'worker_threads';
import { InitTravailleur, Morceau, initialiserTravailleur, traiterMorceau } from '../../src/lib/appariementRapide';

const ctx = initialiserTravailleur(workerData as InitTravailleur);
parentPort!.on('message', (msg: Morceau | { type: 'fin' }) => {
  if (msg && msg.type === 'morceau') parentPort!.postMessage(traiterMorceau(ctx, msg));
  // Fin coopérative : le fil se termine de lui-même, port fermé. Un
  // `terminate()` pendant le transfert initial a fait planter Node (segfault).
  else if (msg && msg.type === 'fin') parentPort!.close();
});
