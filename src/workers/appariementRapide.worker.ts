/// <reference lib="webworker" />
// Coquille navigateur d'un Worker de l'appariement parallèle — aucune logique
// ici : `initialiserTravailleur` et `traiterMorceau` (src/lib/appariementRapide.ts)
// font tout, comme dans la coquille Node (scripts/lib/appariement-rapide-worker.ts).
// Le coordinateur (`apparierRapideEnParallele`, lancé par
// runeBuildOptim.worker.ts) envoie d'abord l'initialisation, ses tableaux
// typés TRANSFÉRÉS, puis des morceaux à la demande ; le Worker rend un
// résultat par morceau. Il est terminé de l'extérieur (`terminate()`).
//
// ⚠️ Un morceau se traite d'un bloc : l'arrêt manuel ne l'interrompt pas, il
// cesse seulement d'en distribuer (voir le coordinateur).

import { ContexteTravailleur, InitTravailleur, Morceau, ResultatMorceau, initialiserTravailleur, traiterMorceau } from '../lib/appariementRapide';

export type MessageVersAppariement = { type: 'init'; init: InitTravailleur } | Morceau;

let contexte: ContexteTravailleur | null = null;

self.onmessage = (e: MessageEvent<MessageVersAppariement>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    contexte = initialiserTravailleur(msg.init);
    return;
  }
  // Une exception ici atteint le `onerror` du coordinateur : la recherche
  // rend alors un résultat vide, tronqué, et tous les Workers sont terminés.
  if (!contexte) throw new Error('appariementRapide.worker : morceau reçu avant l’initialisation');
  const resultat: ResultatMorceau = traiterMorceau(contexte, msg);
  (self as unknown as Worker).postMessage(resultat);
};
