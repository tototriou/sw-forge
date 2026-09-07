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

import { prepareSearch, pairBuckets, SearchParams, Bucket, BuildCandidate, NearMiss } from '../lib/runeBuildOptim';
import { StatKey } from '../lib/effects';
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
}
export interface PairSliceResultMessage {
  type: 'result';
  explored: number;
  candidates: BuildCandidate[];
  truncated: boolean;
  nearMissByCondition: { key: StatKey; kind: 'min' | 'max'; miss: NearMiss }[];
  globalNearMiss: NearMiss | null;
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
    return { type: 'result', explored: 0, candidates: [], truncated: false, nearMissByCondition: [], globalNearMiss: null };
  }
  // ⚠️ Écrase le `startedAt` interne que `prepareSearch` vient de fixer
  // (Date.now() APPELÉ ICI, après la construction déjà écoulée) par le VRAI
  // instant de départ global reçu du parent — voir le commentaire de
  // `PairSliceRequest.startedAt`. `overBudget()` dans `pairBuckets` lit
  // `prepared.startedAt` : cette correction doit avoir lieu AVANT toute
  // utilisation du budget-temps ci-dessous.
  prepared.startedAt = startedAt;

  // ⚠️ **Aucun budget de paires ici — et il n'y en a plus nulle part** (voir
  // `totalPairCount` dans runeBuildOptim.ts, piste 8). Ce worker parcourt SA
  // tranche en entier, et ne s'arrête que sur les DEUX bornes qui restent :
  // sa part de plafond de candidats (`params.maxCollected`, déjà divisée par
  // le parent) et le même `prepared.maxMs` que le séquentiel aurait respecté,
  // couru depuis le `startedAt` GLOBAL ci-dessus.
  // ⚠️ Ce que ça préserve : la sûreté de la parallélisation en recherche
  // NORMALE (tronquée) reposait jusqu'ici sur le fait que chaque worker
  // ESCALADAIT son propre budget au lieu d'en recevoir un figé — vérifié à
  // grande échelle (49 essais réels sous contention volontaire, 0 perte, voir
  // spec/outils/optimizer/pistes.md, point 9). Ne plus avoir de budget du
  // tout est le cas LIMITE de cette escalade (elle convergeait vers « tout ce
  // que le temps permet »), donc strictement au moins aussi sûr : aucun
  // worker ne peut plus s'arrêter avant l'heure sur un plafond de paires.
  const gen = pairBuckets(prepared, bucketASlice, bucketsB);
  const result = await drivePairing(gen, isStopped, (explored, newCandidates) => {
    onProgress({ type: 'progress', explored, newCandidates });
  });
  return { type: 'result', ...result };
}
