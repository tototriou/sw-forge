/// <reference lib="webworker" />
// Premier Worker de l'app. Le calcul lui-même (pur, sans React) vit dans
// lib/runeBuildOptim.ts et reste réutilisable dans les tests sans passer par
// un Worker. Voir docs/02-app/compte/ §6 (Perf).
//
// ⚠️ Orchestre `prepareSearch` → `construireMoitie` (×2, EN PARALLÈLE, chacune
// dans son propre Worker enfant — buildHalf.worker.ts) → l'appariement par le
// noyau sur tableaux typés, plutôt que de piloter `searchBuildsSteps` d'un
// bloc : les deux moitiés A et B sont indépendantes (aucune ne dépend du
// résultat construit de l'autre, seulement de bornes calculées d'avance par
// `prepareSearch`), donc les construire sur deux cœurs plutôt qu'un seul
// accélère cette phase — voir docs/03-developpeur/optimizer/moteur/pipeline.md
// § Construction des moitiés. L'appariement séquentiel (`apparier`) est piloté
// PAS À PAS dans CE Worker : c'est ce qui permet de rendre la main à la
// boucle d'évènements entre deux points de passage, condition nécessaire pour
// qu'un message d'arrêt envoyé pendant que la recherche tourne soit reçu et
// traité. Au-delà du seuil, l'appariement parallèle
// (`apparierRapideEnParallele`) attend des Workers enfants, et la main revient
// d'elle-même entre deux messages.

import { totalPairCount, PreparedSearch, SearchParams, SearchResult, Bucket, BuildCandidate } from '../lib/runeBuildOptim';
import { RelicVide } from '../lib/relicOptim';
import { apparier } from '../lib/rechercheRunes';
import { verifierContrat } from '../lib/appariementRapide';
import {
  PoigneeTravailleur, apparierRapideEnParallele, enResultatDeRecherche, erreurDeWorkerEnfant, resultatApresErreur, type LancerTravailleur,
} from '../lib/appariementRapideParallele';
import { BuildHalfRequest, BuildHalfResponse } from './buildHalf.worker';
import { MessageVersAppariement } from './appariementRapide.worker';
import { nombreDeTravailleurs, regimeAppariement } from './parallelPairing';
import { drivePairing, PROGRESS_THROTTLE_MS } from './pairingDriver';
import { prepareOrRefuse } from './prepareForSearch';

export type WorkerRequest = SearchParams | { stop: true };

// ⚠️ Deux formes, comme `SearchProgress` côté moteur (voir son commentaire) :
// la construction des compartiments (`phase: 'building'`) peut à elle seule
// prendre jusqu'à environ une minute sur un compte réel avec beaucoup de
// conditions à la fois, ENTIÈREMENT AVANT que `phase: 'pairing'` (l'ancien
// comportement, inchangé) ne commence — sans cette distinction, l'UI n'avait
// aucune information pendant cette phase (voir docs/03-developpeur/optimizer/
// § Construction des moitiés).
export interface WorkerBuildingMessage {
  type: 'progress';
  phase: 'building';
  half: 'A' | 'B';
  scanned: number;
  total: number;
  pct: number; // 0..1, approximatif — voir `estimatePct`
}
export interface WorkerPairingMessage {
  type: 'progress';
  phase: 'pairing';
  explored: number;
  found: number;
  pct: number; // 0..1, approximatif — voir `estimatePct`
  // Taille RÉELLE de l'espace de recherche à épuiser (voir
  // `totalPairCount`) — CONSTANTE pour toute la phase d'appariement (les
  // deux moitiés sont déjà construites), et EXACTE : c'est le nombre de
  // paires que l'appariement parcourra s'il va au bout. Depuis la
  // suppression du budget de nœuds, c'est le seul dénominateur
  // que le Worker ait à transmettre.
  totalPairs: number;
  // ⚠️ Les candidats NOUVEAUX depuis le dernier message, PAS la liste
  // entière accumulée jusqu'ici (voir docs/03-developpeur/optimizer/
  // § Appariement séquentiel) : `progress.candidates` peut
  // grossir jusqu'à `maxCollected` (100 000 par défaut) sur une recherche
  // lâche — le retransmettre EN ENTIER à chaque point de passage throttlé
  // (~150 ms) recopierait le même préfixe des dizaines de fois pour rien.
  // Charge à qui reçoit (useBuildOptimSearch.ts) d'accumuler ce delta.
  newCandidates: BuildCandidate[];
}
export type WorkerProgressMessage = WorkerBuildingMessage | WorkerPairingMessage;
export type WorkerResultMessage = { type: 'result' } & SearchResult;
// Refus NOMMÉ (pool de reliques vide en mode `recherche`) — jamais un
// `result` vide qui se présenterait comme « 0 build ». `useBuildOptimSearch.ts` le distingue de
// `error` par un statut propre (`'refused'`).
export interface WorkerRefusMessage {
  type: 'refus';
  motif: 'relique-pool-vide';
  vide: RelicVide;
}
export interface WorkerErrorMessage {
  type: 'error';
  message: string;
}
export type WorkerResponse = WorkerProgressMessage | WorkerResultMessage | WorkerRefusMessage | WorkerErrorMessage;

// Barre de progression, pas une roue qui tourne : approxime « à quel point on
// approche d'un arrêt » en prenant le plus avancé des trois budgets qui
// peuvent chacun déclencher la fin de la recherche (le premier atteint
// l'arrête, donc c'est LUI qui compte). ⚠️ Approximatif par nature — le
// meet-in-the-middle ne consomme pas ces budgets à un rythme constant d'une
// recherche à l'autre, donc la barre peut accélérer ou ralentir en cours de
// route plutôt que progresser régulièrement.
// ⚠️ Contre `totalPairs` (l'espace RÉEL à épuiser, voir `totalPairCount`) —
// c'était DÉJÀ le cas quand un plafond de nœuds existait encore à côté (il
// grandissait avec l'escalade et n'avait plus grand-chose à voir avec la
// taille réelle du travail restant, voir docs/02-app/optimizer/
// § Barre de progression) ; ce choix de l'interface est l'un des arguments qui
// ont mené à sa suppression. Affiché à
// l'écran comme `X / totalPairs`, cohérent avec la ligne « Espace de
// recherche à épuiser » juste en dessous : les DEUX doivent montrer le
// MÊME dénominateur, sous peine de désaccord visible entre deux lignes
// voisines du même écran.
function estimatePct(prepared: PreparedSearch, totalPairs: number, explored: number, found: number, elapsedMs: number): number {
  const ratios = [
    totalPairs > 0 ? explored / totalPairs : 0,
    found / prepared.maxCollected,
    Number.isFinite(prepared.maxMs) ? elapsedMs / prepared.maxMs : 0,
  ];
  return Math.min(1, Math.max(0, ...ratios));
}

let stopped = false;
// Workers enfants EN COURS (phase de construction des moitiés uniquement) —
// vidé dès qu'on en sort, dans un sens ou dans l'autre. Un arrêt manuel
// PENDANT cette phase les tue directement (`terminate()`, instantané) plutôt
// que d'attendre une coopération qu'ils n'ont pas (voir buildHalf.worker.ts).
let activeHalfWorkers: Worker[] = [];
// Rejette la promesse qui attend les deux moitiés, pour qu'un arrêt pendant
// cette phase fasse sortir `await` immédiatement plutôt que de rester
// bloqué indéfiniment (les Workers tués ne posteront plus jamais de message).
let stopBuildReject: (() => void) | null = null;
// L'arrêt COOPÉRATIF de l'appariement parallèle en cours, reçu du
// coordinateur (`surControle`) — contrairement à `activeHalfWorkers`, un arrêt
// manuel ici ne termine rien : le coordinateur cesse de distribuer des
// morceaux, demande à chaque Worker d'arrêter le sien à sa ligne suivante,
// attend leurs réponses et rend tout ce qui a été trouvé, comme un
// arrêt en phase séquentielle (« garde le meilleur trouvé jusque-là »).
let arreterAppariement: (() => void) | null = null;

// Lanceur de plateforme passé à `apparierRapideEnParallele` — la SEULE partie
// du chemin parallèle qui reste liée à Vite/navigateur (`new Worker(new
// URL(...))`). Son pendant Node : `lancerTravailleurNode`
// (scripts/lib/appariementRapideNode.ts). L'initialisation part en premier,
// ses tableaux typés transférés ; l'ordre des messages garantit qu'elle
// précède tout morceau.
const lancerTravailleurNavigateur: LancerTravailleur = (init, transfert): PoigneeTravailleur => {
  const worker = new Worker(new URL('./appariementRapide.worker.ts', import.meta.url), { type: 'module' });
  const message: MessageVersAppariement = { type: 'init', init };
  worker.postMessage(message, transfert);
  return {
    envoyer: (morceau, t) => worker.postMessage(morceau, t),
    surMessage: (rappel) => {
      worker.onmessage = (e) => rappel(e.data);
    },
    surErreur: (rappel) => {
      // ⚠️ L'événement est annulé (voir `erreurDeWorkerEnfant`) : il ne doit
      // pas remonter au hook, le coordinateur rend ce qui a été trouvé.
      worker.onerror = erreurDeWorkerEnfant(rappel);
      worker.onmessageerror = (e) => rappel(e);
    },
    arreter: () => {
      const arret: MessageVersAppariement = { type: 'arret' };
      worker.postMessage(arret);
    },
    terminer: () => worker.terminate(),
  };
};

function buildHalfInWorker(request: BuildHalfRequest, onProgress: (scanned: number, total: number) => void): Promise<Bucket[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./buildHalf.worker.ts', import.meta.url), { type: 'module' });
    activeHalfWorkers.push(worker);
    const cleanup = () => {
      worker.terminate();
      activeHalfWorkers = activeHalfWorkers.filter((w) => w !== worker);
    };
    worker.onmessage = (e: MessageEvent<BuildHalfResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress(msg.scanned, msg.total);
        return;
      }
      cleanup();
      resolve(msg.buckets);
    };
    worker.onerror = (err) => {
      cleanup();
      reject(err);
    };
    worker.postMessage(request);
  });
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  if ('stop' in e.data) {
    stopped = true;
    for (const w of activeHalfWorkers) w.terminate();
    activeHalfWorkers = [];
    if (stopBuildReject) stopBuildReject();
    arreterAppariement?.();
    return;
  }
  stopped = false;
  const params = e.data;
  const startedAt = Date.now();

  // ⚠️ `prepareSearch` peut lever `RechercheRefusee` (pool de reliques vide
  // en mode `recherche`) — jamais un simple appel direct ICI : un rejet
  // dans un handler `async self.onmessage` non intercepté ne déclenche NI
  // réponse du Worker NI `Worker.onerror` côté parent (piège JS/navigateur
  // réel) — l'UI restait
  // bloquée en `'running'` indéfiniment. `prepareOrRefuse` (module neutre,
  // testable en Node sans `self`) convertit refus et erreur en résultats
  // NOMMÉS plutôt que de laisser échapper l'exception.
  const outcome = prepareOrRefuse(params);
  if (outcome.kind === 'refus') {
    const refus: WorkerRefusMessage = { type: 'refus', motif: outcome.motif, vide: outcome.vide };
    (self as unknown as Worker).postMessage(refus);
    return;
  }
  if (outcome.kind === 'error') {
    const error: WorkerErrorMessage = { type: 'error', message: outcome.message };
    (self as unknown as Worker).postMessage(error);
    return;
  }
  if (outcome.kind === 'empty') {
    const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null };
    (self as unknown as Worker).postMessage(result);
    return;
  }
  const prepared = outcome.prepared;

  // ⚠️ Deux moitiés INDÉPENDANTES (aucune ne dépend du résultat CONSTRUIT de
  // l'autre — seulement de `maxSetsForA`/`maxSetsForB`, déjà calculés par
  // `prepareSearch`) : construites en parallèle, chacune dans son propre
  // Worker, pour utiliser deux cœurs plutôt qu'un seul pendant cette phase.
  let bucketsA: Bucket[];
  let bucketsB: Bucket[];
  try {
    const requestA: BuildHalfRequest = {
      half: 'A', slotIdxs: [0, 1, 2], filtered: prepared.filtered, distinctKeys: prepared.distinctKeys,
      constrainedKeys: prepared.constrainedKeys, retentionKeys: prepared.retentionKeys, minEntries: prepared.minEntries,
      bucketCap: prepared.bucketCap, otherHalfMaxSets: prepared.maxSetsForA, jokerCredit: prepared.jokerCredit,
      requiredPieces: prepared.requiredPieces, base: prepared.base, objectiveKeys: prepared.objectiveKeys, adaptiveTrancheWeighting: params.adaptiveTrancheWeighting,
      combosOrderMode: params.combosOrderMode,
    };
    const requestB: BuildHalfRequest = {
      half: 'B', slotIdxs: [3, 4, 5], filtered: prepared.filtered, distinctKeys: prepared.distinctKeys,
      constrainedKeys: prepared.constrainedKeys, retentionKeys: prepared.retentionKeys, minEntries: prepared.minEntries,
      bucketCap: prepared.bucketCap, otherHalfMaxSets: prepared.maxSetsForB, jokerCredit: prepared.jokerCredit,
      requiredPieces: prepared.requiredPieces, base: prepared.base, objectiveKeys: prepared.objectiveKeys, adaptiveTrancheWeighting: params.adaptiveTrancheWeighting,
      combosOrderMode: params.combosOrderMode,
    };
    // ⚠️ Pas de throttle ICI (contrairement à la phase d'appariement plus
    // bas) : chacun des deux Workers enfants (buildHalf.worker.ts) throttle
    // déjà SES PROPRES messages indépendamment — un throttle commun aux DEUX
    // moitiés ferait courir le message de l'une contre celui de l'autre (un
    // message de A qui arrive juste après un de B ferait sauter celui de B,
    // et vice-versa), aggravant le risque qu'aucun des deux ne semble jamais
    // atteindre 100 % — voir le point de passage final garanti dans
    // buildHalf.worker.ts. Relayer sans throttle supplémentaire reste sûr :
    // le débit combiné des deux Workers enfants (chacun ≤ ~1 message/150ms)
    // ne peut pas flooder le fil principal.
    const postBuildProgress = (half: 'A' | 'B', scanned: number, total: number) => {
      const message: WorkerBuildingMessage = { type: 'progress', phase: 'building', half, scanned, total, pct: total > 0 ? scanned / total : 0 };
      (self as unknown as Worker).postMessage(message);
    };
    const abortPromise = new Promise<never>((_, reject) => {
      stopBuildReject = () => reject(new Error('stopped'));
    });
    [bucketsA, bucketsB] = await Promise.race([
      Promise.all([
        buildHalfInWorker(requestA, (scanned, total) => postBuildProgress('A', scanned, total)),
        buildHalfInWorker(requestB, (scanned, total) => postBuildProgress('B', scanned, total)),
      ]),
      abortPromise,
    ]);
  } catch {
    // Arrêt manuel pendant la construction : rien n'existe encore à ressortir
    // (aucune paire n'a pu être évaluée) — un résultat vide, tronqué, est le
    // seul choix honnête, même comportement que l'ancien code pour
    // `phase: 'building'`.
    const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: true, nearMissByCondition: [], globalNearMiss: null };
    (self as unknown as Worker).postMessage(result);
    return;
  } finally {
    stopBuildReject = null;
  }
  if (stopped) {
    const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: true, nearMissByCondition: [], globalNearMiss: null };
    (self as unknown as Worker).postMessage(result);
    return;
  }

  // Taille RÉELLE de l'espace à épuiser (voir `totalPairCount`) — calculée
  // UNE SEULE FOIS, maintenant que les deux moitiés sont construites (avant
  // ça, seule l'estimation brute pré-recherche, `estimateSearchSpace`,
  // existe). Coût négligeable : O(compartiments A × compartiments B), une
  // poignée de compartiments de chaque côté, jamais les combos eux-mêmes.
  const totalPairs = totalPairCount(prepared, bucketsA, bucketsB);

  // Le régime (parallelPairing.ts) : parallèle à partir du seuil, séquentiel
  // en dessous ET hors contrat numérique du noyau, où `apparier` retombe sur
  // `pairBuckets` en rendant la main — le coordinateur parallèle, lui, n'a
  // pas de repli.
  if (regimeAppariement(totalPairs, verifierContrat(prepared, bucketsA, bucketsB)) === 'parallele') {
    let envoyes = 0;
    let dernierMessage = 0;
    const postProgress = (explored: number, candidats: readonly BuildCandidate[]) => {
      const now = Date.now();
      if (now - dernierMessage <= PROGRESS_THROTTLE_MS) return;
      dernierMessage = now;
      const message: WorkerPairingMessage = {
        type: 'progress',
        phase: 'pairing',
        explored,
        found: candidats.length,
        pct: estimatePct(prepared, totalPairs, explored, candidats.length, now - startedAt),
        totalPairs,
        // Les candidats FUSIONNÉS, dans l'ordre séquentiel : l'aperçu est
        // toujours un préfixe du résultat final.
        newCandidates: candidats.slice(envoyes),
      };
      envoyes = candidats.length;
      (self as unknown as Worker).postMessage(message);
    };
    // ⚠️ `try/catch` à ne pas retirer, comme pour la phase de construction
    // juste au-dessus : sur l'erreur d'un Worker enfant, le coordinateur
    // termine tous les Workers puis rejette, et une rejection NON interceptée
    // dans un handler `async self.onmessage` ne remonte PAS via
    // `Worker.onerror` au parent — sans ce `catch`, aucun message `result`/
    // `error` ne serait posté, l'UI resterait bloquée en `'running'`. Le rejet
    // porte ce qui a été fusionné avant l'erreur (`resultatApresErreur`) :
    // l'écran garde les candidats déjà montrés, et l'erreur est journalisée.
    try {
      const resultat = await apparierRapideEnParallele({
        params, prepared, bucketsA, bucketsB, totalPaires: totalPairs,
        travailleurs: nombreDeTravailleurs(self.navigator?.hardwareConcurrency),
        lancer: lancerTravailleurNavigateur, startedAt,
        surControle: (controle) => {
          arreterAppariement = controle.arreter;
        },
        surProgression: postProgress,
      });
      const result: WorkerResultMessage = { type: 'result', ...enResultatDeRecherche(resultat) };
      (self as unknown as Worker).postMessage(result);
    } catch (erreur) {
      console.error('Appariement parallèle interrompu par une erreur ; résultat rendu tronqué, avec ce qui a été fusionné :', erreur);
      const result: WorkerResultMessage = { type: 'result', ...resultatApresErreur(erreur) };
      (self as unknown as Worker).postMessage(result);
    } finally {
      arreterAppariement = null;
    }
    return;
  }

  // ── Appariement séquentiel ──
  // ⚠️ **Aucun budget de paires à piloter ici** (voir
  // `totalPairCount` dans runeBuildOptim.ts) : l'appariement va au bout de
  // `totalPairs`, sauf arrêt par `maxMs`, par `maxCollected` ou par le bouton
  // « Arrêter » (`stopped`).
  const gen = apparier(prepared, bucketsA, bucketsB);
  const result = await drivePairing(gen, () => stopped, (explored, newCandidates, foundTotal) => {
    const message: WorkerPairingMessage = {
      type: 'progress',
      phase: 'pairing',
      explored,
      found: foundTotal,
      pct: estimatePct(prepared, totalPairs, explored, foundTotal, Date.now() - startedAt),
      totalPairs,
      newCandidates,
    };
    (self as unknown as Worker).postMessage(message);
  });
  const message: WorkerResultMessage = { type: 'result', ...result };
  (self as unknown as Worker).postMessage(message);
};
