/// <reference lib="webworker" />
// Worker enfant pour la parallélisation de l'APPARIEMENT, réservée au mode
// « Rechercher jusqu'à épuisement complet » (voir spec/outils/optimizer/
// pistes.md, point 9, et runeBuildOptim.worker.ts pour la décision de
// déclenchement/le découpage). Reçoit une TRANCHE de bucketsA (répartie par
// charge réelle par l'appelant) + la moitié B COMPLÈTE — aucun
// SharedArrayBuffer disponible aujourd'hui (pas d'en-têtes COOP/COEP), donc
// une vraie copie par worker, pas un pointeur partagé.
//
// ⚠️ `PreparedSearch` (avec sa fonction `totalOf`) n'est PAS clonable via
// `postMessage` (structured clone ne clone jamais de fonction) — ce worker
// reconstruit donc `PreparedSearch` lui-même via `prepareSearch`, à partir
// des seuls `SearchParams` reçus. Peu coûteux (séquentiel, bon marché
// comparé à `buildBuckets` — voir le commentaire de `PreparedSearch` dans
// runeBuildOptim.ts) ; déjà le design du prototype de mesure
// (scripts/lib/pairing-worker.ts), dont les temps mesurés incluent déjà ce
// coût de reconstruction.
//
// Générateur piloté PAS À PAS (comme runeBuildOptim.worker.ts pour la
// phase séquentielle), PAS un simple `drain()` : un `{stop:true}` doit
// pouvoir interrompre ce worker et récupérer les candidats déjà trouvés sur
// SA tranche, exactement comme le comportement séquentiel existant (bouton
// « Arrêter » qui garde le meilleur trouvé jusque-là).

import { prepareSearch, pairBuckets, SearchParams, Bucket, NodeBudget, BuildCandidate } from '../lib/runeBuildOptim';

export interface PairSliceRequest {
  // ⚠️ `maxCollected` DOIT déjà être la part de CE worker (le plafond
  // global divisé par le nombre de workers), pas le défaut de production —
  // voir `runeBuildOptim.worker.ts`, `runParallelPairing`. Tout le reste
  // est transmis TEL QUEL (même objectif, même pool, même requirement,
  // même `adaptiveTrancheWeighting`) : la seule divergence volontaire entre
  // workers est cette part de plafond.
  params: SearchParams;
  bucketASlice: Bucket[];
  bucketsB: Bucket[];
}
export type PairSliceInbound = PairSliceRequest | { stop: true };

export interface PairSliceProgressMessage {
  type: 'progress';
  explored: number;
  newCandidates: BuildCandidate[];
}
export interface PairSliceResultMessage {
  type: 'result';
  explored: number;
  candidates: BuildCandidate[];
  truncated: boolean;
}
export type PairSliceResponse = PairSliceProgressMessage | PairSliceResultMessage;

// Mêmes paliers que runeBuildOptim.worker.ts (voir ses commentaires pour le
// détail des mesures qui les justifient) — pas de raison de diverger ici.
const PROGRESS_THROTTLE_MS = 150;
const YIELD_THROTTLE_MS = 50;

let stopped = false;

self.onmessage = async (e: MessageEvent<PairSliceInbound>) => {
  if ('stop' in e.data) {
    stopped = true;
    return;
  }
  stopped = false;
  const { params, bucketASlice, bucketsB } = e.data;
  const prepared = prepareSearch(params);
  if (!prepared) {
    const result: PairSliceResultMessage = { type: 'result', explored: 0, candidates: [], truncated: false };
    (self as unknown as Worker).postMessage(result);
    return;
  }

  // Budget INFINI, jamais d'escalade : ce worker n'est appelé qu'en mode
  // exhaustif (garanti par l'appelant — voir `useParallelPairing`), donc
  // rien ne doit jamais tronquer cette tranche avant qu'elle soit épuisée.
  const nodeBudget: NodeBudget = { max: Number.POSITIVE_INFINITY };

  let candidatesSent = 0;
  let lastProgressPost = 0;
  let lastYield = Date.now();
  const gen = pairBuckets(prepared, bucketASlice, bucketsB, nodeBudget);
  let step = gen.next();
  while (!step.done) {
    if (stopped) {
      const progress = step.value;
      const result: PairSliceResultMessage = { type: 'result', explored: progress.explored, candidates: progress.candidates, truncated: true };
      (self as unknown as Worker).postMessage(result);
      return;
    }
    const now = Date.now();
    const progress = step.value;
    if (now - lastProgressPost > PROGRESS_THROTTLE_MS) {
      lastProgressPost = now;
      const newCandidates = progress.candidates.slice(candidatesSent);
      candidatesSent = progress.candidates.length;
      const message: PairSliceProgressMessage = { type: 'progress', explored: progress.explored, newCandidates };
      (self as unknown as Worker).postMessage(message);
    }
    if (now - lastYield > YIELD_THROTTLE_MS) {
      lastYield = now;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    step = gen.next();
  }
  const result: PairSliceResultMessage = { type: 'result', ...step.value };
  (self as unknown as Worker).postMessage(result);
};
