/// <reference lib="webworker" />
// Coquille navigateur d'un Worker de l'appariement parallèle — aucune logique
// ici : `servirAppariement` (src/lib/travailleurAppariement.ts) fait tout, comme
// dans la coquille Node (scripts/lib/appariement-rapide-worker.ts). Le
// coordinateur (`apparierRapideEnParallele`, lancé par runeBuildOptim.worker.ts)
// envoie d'abord l'initialisation, ses tableaux typés TRANSFÉRÉS, puis des
// morceaux à la demande, et `arret` sur « Arrêter » ; le Worker rend un
// résultat par morceau. Il est terminé de l'extérieur (`terminate()`).

import { MessageVersTravailleur, servirAppariement } from '../lib/travailleurAppariement';
import { ResultatMorceau } from '../lib/appariementRapide';

export type MessageVersAppariement = MessageVersTravailleur;

const serveur = servirAppariement((resultat: ResultatMorceau) => (self as unknown as Worker).postMessage(resultat));

self.onmessage = (e: MessageEvent<MessageVersAppariement>) => {
  // ⚠️ Une promesse rejetée n'atteint pas le `onerror` du coordinateur : on
  // relève l'erreur hors de la promesse, où elle devient une erreur du Worker.
  serveur.recevoir(e.data).catch((erreur: unknown) => {
    setTimeout(() => {
      throw erreur;
    }, 0);
  });
};
