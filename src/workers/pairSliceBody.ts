// Corps d'une TRANCHE d'appariement — la LOGIQUE seule, sans aucune API de
// messagerie. Extrait de `pairSlice.worker.ts` (qui n'en garde que la coquille
// `self.onmessage`/`postMessage`) pour qu'un fil `worker_threads` Node puisse
// exécuter EXACTEMENT le même code que le Web Worker du navigateur.
//
// ⚠️ **Pourquoi cette extraction** : la même logique existait en DEUX
// exemplaires — ici et dans `scripts/lib/pairing-quota-worker.ts`, dont
// l'en-tête annonce lui-même « reproduit EXACTEMENT le mécanisme réel de
// `pairSlice.worker.ts` ». Deux copies à synchroniser à la main, dont une
// seule est expédiée : un test portant sur la copie reste vert pendant que la
// production casse. Voir spec/outils/optimizer/parallelisation-partagee.md.
//
// ⚠️ **Ce module doit rester NEUTRE** : jamais d'import de `worker_threads`
// ni de dépendance à `self`/`postMessage`. Vite tenterait sinon de résoudre
// du code Node dans le bundle navigateur (échec de build, ou polyfill
// embarqué). C'est la raison d'être des rappels `isStopped`/`onProgress` :
// l'appelant fournit sa plateforme, ce module n'en connaît aucune.
//
// Reçoit une TRANCHE de bucketsA (répartie par charge réelle par l'appelant)
// + la moitié B COMPLÈTE — aucun SharedArrayBuffer disponible aujourd'hui
// (pas d'en-têtes COOP/COEP), donc une vraie copie par worker, pas un
// pointeur partagé.
//
// ⚠️ `PreparedSearch` (avec sa fonction `totalOf`) n'est PAS clonable via
// `postMessage` (structured clone ne clone jamais de fonction) — ce module
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
import { drivePairing } from './pairingDriver';

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
  // ⚠️ Le VRAI instant de départ de la recherche GLOBALE (calculé une seule
  // fois par runeBuildOptim.worker.ts, AVANT la phase de construction) —
  // PAS un `Date.now()` local à ce worker. Sans ce champ, ce worker
  // recréait son propre `PreparedSearch` via `prepareSearch(params)`, qui
  // fixe SON PROPRE `startedAt` interne — mesuré APRÈS la construction déjà
  // écoulée (jusqu'à ~1 min sur un gros compte), repoussant silencieusement
  // l'échéance du filet de sécurité `maxMs`. Trouvé par une revue de code
  // externe — voir spec/outils/optimizer/historique-dimensionnement.md.
  startedAt: number;
}
export type PairSliceInbound = PairSliceRequest | { stop: true };

export interface PairSliceProgressMessage {
  type: 'progress';
  explored: number;
  newCandidates: BuildCandidate[];
  // Plafond de nœuds ACTUEL de CE worker (grandit avec l'escalade, voir
  // plus bas) — l'orchestrateur (`runeBuildOptim.worker.ts`) additionne
  // celui de chaque worker pour un total honnête, plutôt que d'afficher
  // une valeur inventée (voir son commentaire sur `WorkerPairingMessage`).
  nodeBudgetMax: number;
}
export interface PairSliceResultMessage {
  type: 'result';
  explored: number;
  candidates: BuildCandidate[];
  truncated: boolean;
}
export type PairSliceResponse = PairSliceProgressMessage | PairSliceResultMessage;

/**
 * Exécute UNE tranche d'appariement et rend son résultat.
 *
 * `isStopped` et `onProgress` sont les deux seuls points de contact avec la
 * plateforme : la coquille navigateur les branche sur `self.onmessage` et
 * `postMessage`, la coquille Node sur `parentPort`. Ce module n'en sait rien.
 */
export async function runPairSlice(
  request: PairSliceRequest,
  isStopped: () => boolean,
  onProgress: (message: PairSliceProgressMessage) => void
): Promise<PairSliceResultMessage> {
  const { params, bucketASlice, bucketsB, startedAt } = request;
  const prepared = prepareSearch(params);
  if (!prepared) {
    return { type: 'result', explored: 0, candidates: [], truncated: false };
  }
  // ⚠️ Écrase le `startedAt` interne que `prepareSearch` vient de fixer
  // (Date.now() APPELÉ ICI, après la construction déjà écoulée) par le VRAI
  // instant de départ global reçu du parent — voir le commentaire de
  // `PairSliceRequest.startedAt`. `overBudget()` dans `pairBuckets` lit
  // `prepared.startedAt` : cette correction doit avoir lieu AVANT toute
  // utilisation du budget-temps ci-dessous.
  prepared.startedAt = startedAt;

  // ⚠️ Budget ADAPTATIF + escalade — EXACTEMENT le mécanisme réel du
  // chemin séquentiel (voir runeBuildOptim.worker.ts, même appel à
  // `maybeEscalateNodeBudget`), pas un budget figé. C'est CE mécanisme,
  // vérifié à grande échelle (49 essais réels sous contention volontaire,
  // 0 perte — voir spec/outils/optimizer/pistes.md, point 9), qui rend la
  // parallélisation sûre aussi en recherche NORMALE (tronquée par défaut) :
  // chaque worker démarre avec `prepared.maxNodes` (PAS divisé entre
  // workers, chacun a sa PROPRE trajectoire d'escalade) et grandit tant
  // qu'il reste du temps sous le même `prepared.maxMs` que le séquentiel
  // aurait respecté — en mode exhaustif, `maxMs=Infinity` fait que cette
  // escalade ne s'arrête jamais avant épuisement complet, retrouvant
  // exactement le comportement déjà prouvé sans perte de ce mode-là.
  const nodeBudget: NodeBudget = { max: prepared.maxNodes };
  const gen = pairBuckets(prepared, bucketASlice, bucketsB, nodeBudget);
  const result = await drivePairing(gen, prepared, nodeBudget, isStopped, (explored, newCandidates, nodeBudgetMax) => {
    onProgress({ type: 'progress', explored, newCandidates, nodeBudgetMax });
  });
  return { type: 'result', ...result };
}
