/// <reference lib="webworker" />
// Premier Worker de l'app. Le calcul lui-même (pur, sans React) vit dans
// lib/runeBuildOptim.ts et reste réutilisable dans les tests sans passer par
// un Worker. Voir spec/compte/calcul-runes.md §6 (Perf).
//
// ⚠️ Orchestre `prepareSearch` → `buildBuckets` (×2, EN PARALLÈLE, chacune
// dans son propre Worker enfant — buildHalf.worker.ts) → `pairBuckets`,
// plutôt que de piloter `searchBuildsSteps` d'un bloc comme avant : les deux
// moitiés A et B sont indépendantes (aucune ne dépend du résultat construit
// de l'autre, seulement de bornes calculées d'avance par `prepareSearch`),
// donc les construire sur deux cœurs plutôt qu'un seul accélère cette phase
// d'environ 2× — voir spec/outils/optimizer/, « Suite — parallélisation de
// la construction des deux moitiés ». La phase d'appariement (`pairBuckets`)
// reste, elle, pilotée PAS À PAS dans CE Worker, exactement comme avant :
// c'est ce qui permet de rendre la main à la boucle d'évènements entre deux
// points de passage, condition nécessaire pour qu'un message d'arrêt envoyé
// pendant que la recherche tourne soit reçu et traité (JS reste
// single-threaded : un message ne peut être livré que quand le code en
// cours d'exécution le permet).

import { prepareSearch, pairBuckets, totalPairCount, maybeEscalateNodeBudget, PreparedSearch, SearchParams, SearchResult, Bucket, NodeBudget, BuildCandidate } from '../lib/runeBuildOptim';
import { BuildHalfRequest, BuildHalfResponse } from './buildHalf.worker';

export type WorkerRequest = SearchParams | { stop: true };

// ⚠️ Un message de progression par point de passage flooderait le fil
// principal (des centaines de `postMessage` par seconde quand l'élagage est
// efficace) — throttlé au temps écoulé plutôt qu'au nombre de points de
// passage, pour rester fluide quel que soit le rythme réel de la recherche.
const PROGRESS_THROTTLE_MS = 150;
// ⚠️ Rendre la main À CHAQUE point de passage (tous les 500 nœuds, voir
// CHECKPOINT_EVERY dans runeBuildOptim.ts) coûte bien plus cher qu'il n'y
// paraît : les navigateurs plafonnent `setTimeout(fn, 0)` appelé en boucle à
// ~4 ms (throttling standard, y compris dans un Worker) — sur une recherche à
// `maxNodes=20 000 000`, ça fait 40 000 rendus de main, soit jusqu'à ~160 s
// de pur overhead de planification, largement au-dessus du temps de calcul
// réel (~30-47 s mesurés en dehors du Worker, voir spec/outils/optimizer/).
// Confirmé être la cause d'un écart mesuré en usage réel (recherche « Dégâts »
// sur un vrai compte : ~30-47 s hors Worker contre 3 min 40 dans le
// navigateur, pour la MÊME recherche). Throttlé au temps écoulé, comme la
// progression ci-dessus, mais plus fréquemment (le bouton « Arrêter » doit
// rester réactif) — un ordre de grandeur sous le seuil de perceptibilité
// humaine, largement suffisant.
const YIELD_THROTTLE_MS = 50;

// ⚠️ Deux formes, comme `SearchProgress` côté moteur (voir son commentaire) :
// la construction des compartiments (`phase: 'building'`) peut à elle seule
// prendre jusqu'à environ une minute sur un compte réel avec beaucoup de
// conditions à la fois, ENTIÈREMENT AVANT que `phase: 'pairing'` (l'ancien
// comportement, inchangé) ne commence — sans cette distinction, l'UI n'avait
// aucune information pendant cette phase (voir spec/outils/optimizer/).
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
  // Plafond de nœuds ACTUEL (`nodeBudget.max`, voir « Suite — escalade
  // automatique du budget de nœuds ») — pas la valeur adaptative de départ,
  // qui peut avoir déjà doublé plusieurs fois depuis. Exposé pour que l'UI
  // puisse montrer où en est réellement la recherche, pas juste le point de
  // départ.
  nodeBudgetMax: number;
  // Taille RÉELLE de l'espace de recherche à épuiser (voir
  // `totalPairCount`) — CONSTANTE pour toute la phase d'appariement (les
  // deux moitiés sont déjà construites), contrairement à `nodeBudgetMax`
  // qui grandit. Une borne SUPÉRIEURE (paires structurellement compatibles,
  // sets/joker), pas le compte exact de paires réellement visitées — voir
  // le commentaire de `totalPairCount`.
  totalPairs: number;
  // ⚠️ Les candidats NOUVEAUX depuis le dernier message, PAS la liste
  // entière accumulée jusqu'ici (voir « Suite — affichage des résultats en
  // direct » dans spec/outils/optimizer/) : `progress.candidates` peut
  // grossir jusqu'à `maxCollected` (100 000 par défaut) sur une recherche
  // lâche — le retransmettre EN ENTIER à chaque point de passage throttlé
  // (~150 ms) recopierait le même préfixe des dizaines de fois pour rien.
  // Charge à qui reçoit (useBuildOptimSearch.ts) d'accumuler ce delta.
  newCandidates: BuildCandidate[];
}
export type WorkerProgressMessage = WorkerBuildingMessage | WorkerPairingMessage;
export type WorkerResultMessage = { type: 'result' } & SearchResult;
export type WorkerResponse = WorkerProgressMessage | WorkerResultMessage;

// Barre de progression, pas une roue qui tourne : approxime « à quel point on
// approche d'un arrêt » en prenant le plus avancé des trois budgets qui
// peuvent chacun déclencher la fin de la recherche (le premier atteint
// l'arrête, donc c'est LUI qui compte). ⚠️ Approximatif par nature — le
// meet-in-the-middle ne consomme pas ces budgets à un rythme constant d'une
// recherche à l'autre, donc la barre peut accélérer ou ralentir en cours de
// route plutôt que progresser régulièrement.
// ⚠️ Contre `totalPairs` (l'espace RÉEL à épuiser, voir `totalPairCount`),
// PAS `nodeBudget.max` (le plafond de nœuds, qui grandit avec l'escalade et
// n'a plus grand-chose à voir avec la taille réelle du travail restant —
// voir « Suite — espace de recherche affiché en direct »). Affiché à
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
    return;
  }
  stopped = false;
  const params = e.data;
  const startedAt = Date.now();
  let lastProgressPost = 0;

  const prepared = prepareSearch(params);
  if (!prepared) {
    const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: false };
    (self as unknown as Worker).postMessage(result);
    return;
  }

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
      requiredPieces: prepared.requiredPieces, adaptiveTrancheWeighting: params.adaptiveTrancheWeighting,
    };
    const requestB: BuildHalfRequest = {
      half: 'B', slotIdxs: [3, 4, 5], filtered: prepared.filtered, distinctKeys: prepared.distinctKeys,
      constrainedKeys: prepared.constrainedKeys, retentionKeys: prepared.retentionKeys, minEntries: prepared.minEntries,
      bucketCap: prepared.bucketCap, otherHalfMaxSets: prepared.maxSetsForB, jokerCredit: prepared.jokerCredit,
      requiredPieces: prepared.requiredPieces, adaptiveTrancheWeighting: params.adaptiveTrancheWeighting,
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
    const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: true };
    (self as unknown as Worker).postMessage(result);
    return;
  } finally {
    stopBuildReject = null;
  }
  if (stopped) {
    const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: true };
    (self as unknown as Worker).postMessage(result);
    return;
  }

  // ⚠️ Escalade automatique du budget de nœuds — voir `maybeEscalateNodeBudget`
  // dans runeBuildOptim.ts pour le détail complet. Signalé sur un vrai compte
  // (Sonia, tototriou-12889591.json) : plafond adaptatif épuisé en 22 s
  // (38,4M nœuds, 0 résultat), alors qu'un plafond 13× plus large retrouve le
  // build exact en 32 s (86,8M nœuds réellement explorés) — le budget-TEMPS
  // n'était simplement jamais sollicité. Voir spec/outils/optimizer/.
  //
  // `nodeBudget` est un objet MUTABLE : le relever ICI, entre deux appels à
  // `gen.next()`, laisse le générateur CONTINUER exactement où il en était
  // (mêmes compartiments, mêmes combos, `explored` jamais remis à zéro) —
  // aucune paire déjà visitée n'est revisitée, aucun des deux Workers de
  // construction n'est rappelé.
  const nodeBudget: NodeBudget = { max: prepared.maxNodes };

  // Taille RÉELLE de l'espace à épuiser (voir `totalPairCount`) — calculée
  // UNE SEULE FOIS, maintenant que les deux moitiés sont construites (avant
  // ça, seule l'estimation brute pré-recherche, `estimateSearchSpace`,
  // existe). Coût négligeable : O(compartiments A × compartiments B), une
  // poignée de compartiments de chaque côté, jamais les combos eux-mêmes.
  const totalPairs = totalPairCount(prepared, bucketsA, bucketsB);

  let lastYield = Date.now();
  // Nombre déjà relayé au fil principal (voir `WorkerPairingMessage.
  // newCandidates`) — sert à ne transmettre à chaque point de passage QUE
  // les candidats trouvés depuis le message précédent.
  let candidatesSent = 0;
  const gen = pairBuckets(prepared, bucketsA, bucketsB, nodeBudget);
  let step = gen.next();
  while (!step.done) {
    if (stopped) {
      // Arrêt manuel pendant l'appariement : on ressort le dernier point de
      // passage tel quel, requalifié « tronqué » — un résultat partiel
      // assumé, pas une recherche allée au bout de son budget.
      const progress = step.value;
      const message: WorkerResultMessage = { type: 'result', candidates: progress.candidates, explored: progress.explored, truncated: true };
      (self as unknown as Worker).postMessage(message);
      return;
    }
    const now = Date.now();
    const progress = step.value;
    maybeEscalateNodeBudget(nodeBudget, prepared, progress, now);
    if (now - lastProgressPost > PROGRESS_THROTTLE_MS) {
      lastProgressPost = now;
      const newCandidates = progress.candidates.slice(candidatesSent);
      candidatesSent = progress.candidates.length;
      const message: WorkerPairingMessage = {
        type: 'progress',
        phase: 'pairing',
        explored: progress.explored,
        found: progress.candidates.length,
        pct: estimatePct(prepared, totalPairs, progress.explored, progress.candidates.length, now - startedAt),
        nodeBudgetMax: nodeBudget.max,
        totalPairs,
        newCandidates,
      };
      (self as unknown as Worker).postMessage(message);
    }
    // Rend la main à la boucle d'évènements, mais throttlé (voir
    // YIELD_THROTTLE_MS) : sans au moins CE rendu de main occasionnel, le
    // message « stop » resterait en attente jusqu'à la fin de la recherche,
    // ce qui viderait le bouton Arrêter de son sens — mais le faire à CHAQUE
    // point de passage (tous les 500 nœuds) coûte bien plus cher que la
    // recherche elle-même, voir le commentaire de la constante.
    if (now - lastYield > YIELD_THROTTLE_MS) {
      lastYield = now;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    step = gen.next();
  }
  const result: WorkerResultMessage = { type: 'result', ...step.value };
  (self as unknown as Worker).postMessage(result);
};
