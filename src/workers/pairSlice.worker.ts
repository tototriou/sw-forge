/// <reference lib="webworker" />
// Worker enfant pour la parallélisation de l'APPARIEMENT — voir
// spec/outils/optimizer/pistes.md, point 9, et runeBuildOptim.worker.ts pour
// la décision de déclenchement (seuil de taille)/le découpage. Active en
// recherche EXHAUSTIVE **et** NORMALE (tronquée par défaut) depuis la
// vérification à grande échelle (49 essais réels, 0 perte, voir pistes.md).
//
// ⚠️ **COQUILLE SEULE — aucune logique ici.** Tout le mécanisme vit dans
// `pairSliceBody.ts` (`runPairSlice`), partagé TEL QUEL avec la coquille
// `worker_threads` Node : ce fichier ne fait que brancher `self.onmessage` /
// `postMessage` dessus. Voir
// spec/outils/optimizer/parallelisation-partagee.md pour pourquoi la logique
// a été sortie d'ici (elle existait en deux exemplaires, dont un seul
// expédié).
//
// ⚠️ Les types du protocole (`PairSliceRequest`, `PairSliceResponse`…) vivent
// désormais dans `pairSliceBody.ts` — ils sont réexportés ci-dessous pour que
// les importateurs existants (`runeBuildOptim.worker.ts`) et la coquille Node
// partent de la même source.

import { runPairSlice, PairSliceInbound } from './pairSliceBody';

export type {
  PairSliceRequest,
  PairSliceInbound,
  PairSliceProgressMessage,
  PairSliceResultMessage,
  PairSliceResponse,
} from './pairSliceBody';

let stopped = false;

self.onmessage = async (e: MessageEvent<PairSliceInbound>) => {
  if ('stop' in e.data) {
    stopped = true;
    return;
  }
  stopped = false;
  const out = await runPairSlice(
    e.data,
    () => stopped,
    (message) => (self as unknown as Worker).postMessage(message)
  );
  (self as unknown as Worker).postMessage(out);
};
