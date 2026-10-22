// Coquille `worker_threads` d'un Worker de l'appariement parallèle de
// production — pendant Node de src/workers/appariementRapide.worker.ts —,
// aucune logique ici : `servirAppariement` (src/lib/travailleurAppariement.ts)
// fait tout. L'initialisation arrive par `workerData` (tableaux typés
// transférés une fois, seule divergence de protocole avec le navigateur), les
// morceaux et l'arrêt par message.

import { parentPort, workerData } from 'worker_threads';
import { InitTravailleur } from '../../src/lib/appariementRapide';
import { MessageVersTravailleur, servirAppariement, tamponsResultatMorceau } from '../../src/lib/travailleurAppariement';
import { SortieCandidats } from '../../src/lib/candidatsCompacts';

const serveur = servirAppariement<SortieCandidats>((resultat) => parentPort!.postMessage(resultat, tamponsResultatMorceau(resultat)));
const relever = (erreur: unknown) => {
  // Hors de la promesse : une exception non rattrapée termine le fil et
  // devient l'événement `error` du coordinateur.
  setTimeout(() => {
    throw erreur;
  }, 0);
};
serveur.recevoir({ type: 'init', init: workerData as InitTravailleur }).catch(relever);
parentPort!.on('message', (msg: MessageVersTravailleur | { type: 'fin' }) => {
  // Fin coopérative : le fil se termine de lui-même, port fermé. Un
  // `terminate()` pendant le transfert initial a fait planter Node (segfault).
  // Le morceau éventuellement en cours s'arrête à sa prochaine ligne.
  if (msg && msg.type === 'fin') {
    void serveur.recevoir({ type: 'arret' });
    parentPort!.close();
  }
  else if (msg) serveur.recevoir(msg).catch(relever);
});
