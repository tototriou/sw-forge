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

import { prepareSearch, pairBuckets, totalPairCount, partitionBucketsALPT, maybeEscalateNodeBudget, PreparedSearch, SearchParams, SearchResult, Bucket, NodeBudget, BuildCandidate } from '../lib/runeBuildOptim';
import { BuildHalfRequest, BuildHalfResponse } from './buildHalf.worker';
import { PairSliceRequest, PairSliceResponse } from './pairSlice.worker';

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
// Workers enfants EN COURS (phase d'APPARIEMENT parallèle uniquement, voir
// `runParallelPairing`) — contrairement à `activeHalfWorkers`, un arrêt
// manuel ici poste `{stop:true}` (coopératif) plutôt que `terminate()` :
// chaque worker répond avec les candidats déjà trouvés sur SA tranche, pour
// garder le même comportement qu'un arrêt en phase séquentielle (« garde le
// meilleur trouvé jusque-là »).
let activePairingWorkers: Worker[] = [];

// ⚠️ Parallélisation de l'APPARIEMENT — voir spec/outils/optimizer/
// pistes.md, point 9. Historique en deux temps :
// 1. Mesuré sur 3 itérations (scripts/pairing-parallel-diag.ts) : un
//    découpage STATIQUE de bucketsA à budget INFINI (mode exhaustif
//    seulement) est SÛR — aucune perte, quel que soit le découpage.
//    Découpage à budget FIGÉ (round-robin ou LPT) en recherche NORMALE
//    (tronquée) perdait des candidats valides — mais ce prototype figeait
//    le budget au lieu de laisser chaque worker ESCALADER le sien, voir
//    point 2.
// 2. Chaque worker utilise désormais le VRAI mécanisme de production
//    (`maybeEscalateNodeBudget`, budget ADAPTATIF par worker — voir
//    pairSlice.worker.ts), pas un budget figé. Sous ce mécanisme, vérifié
//    à grande échelle (49 essais réels, 7 cas × 7 durées, SOUS CONTENTION
//    volontaire pour durcir le test — skill `optimizer-perf-testing`) :
//    **0 perte détectée**, y compris en recherche NORMALE. La parallélisation
//    s'applique donc désormais aux DEUX modes — seul le seuil de taille
//    ci-dessous décide si ça vaut le coût de coordination.
//
// PARALLEL_PAIRING_THRESHOLD : calibré en mode EXHAUSTIF (sous ~46M paires
// réelles, perte nette mesurée jusqu'à ×0,32 — le coût de copie/démarrage
// des Workers dépasse le gain de calcul ; gain réel au-delà d'environ 250M,
// ×1,4 à ×2,3 mesuré). 100M est choisi DANS cet intervalle, qui n'a PAS été
// finement calibré (rien mesuré entre 46M et 250M) — à resserrer si un
// usage réel montre un cas proche de cette frontière qui se comporte mal.
// ⚠️ PAS reconfirmé spécifiquement en recherche NORMALE : la calibration du
// SEUIL vient du mode exhaustif, la vérification de NON-PERTE (point 2
// ci-dessus) couvre les deux modes mais ne re-teste pas si 100M reste le
// bon seuil de RENTABILITÉ quand la recherche peut aussi s'arrêter par
// `maxMs`/`maxCollected` avant `totalPairs`.
//
// PARALLEL_PAIRING_WORKERS : fixé à 4, délibérément PAS dérivé de
// `navigator.hardwareConcurrency`. Mesuré NON monotone : sur 3 des 4 plus
// gros cas connus, N=8 fait PIRE que N=4 (overhead croissant sans gain de
// calcul supplémentaire) — un réglage automatique basé sur les cœurs
// disponibles aurait été FAUX dans les deux sens (trop de workers sur un
// petit cas, pas forcément mieux sur un gros). Voir pistes.md, point 9,
// troisième mesure, pour le détail des 7 cas.
const PARALLEL_PAIRING_THRESHOLD = 100_000_000;
const PARALLEL_PAIRING_WORKERS = 4;

// Répartition GLOUTONNE par charge réelle (LPT) — voir `partitionBucketsALPT`
// dans runeBuildOptim.ts (déplacée là pour être testable en Node, voir
// tests/rune-optim-parallel-pairing.test.ts) pour la stratégie et sa preuve.

function pairSliceInWorker(
  request: PairSliceRequest,
  onProgress: (explored: number, newCandidates: BuildCandidate[], nodeBudgetMax: number) => void
): { worker: Worker; done: Promise<SearchResult> } {
  const worker = new Worker(new URL('./pairSlice.worker.ts', import.meta.url), { type: 'module' });
  const done = new Promise<SearchResult>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<PairSliceResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress(msg.explored, msg.newCandidates, msg.nodeBudgetMax);
        return;
      }
      resolve({ candidates: msg.candidates, explored: msg.explored, truncated: msg.truncated });
    };
    worker.onerror = reject;
  });
  worker.postMessage(request);
  return { worker, done };
}

// Découpe `bucketsA` en au plus `PARALLEL_PAIRING_WORKERS` tranches (jamais
// plus que `bucketsA.length`, sinon des workers recevraient une tranche
// vide pour rien), donne à CHAQUE worker une part ÉGALE du plafond GLOBAL
// de candidats collectés (`prepared.maxCollected`, 100 000 par défaut,
// INCHANGÉ par le mode exhaustif ET le mode normal — décision actée) pour
// que la somme des N workers ne dépasse jamais significativement ce
// plafond, et fusionne les résultats finaux (pas l'accumulateur de
// progression, qui ne sert qu'à l'affichage EN DIRECT) — union simple, sans
// dédoublonnage nécessaire puisque les tranches de bucketsA sont
// disjointes : un candidat donné ne peut exister que dans LA tranche qui
// contient son comboA.
async function runParallelPairing(
  params: SearchParams,
  prepared: PreparedSearch,
  bucketsA: Bucket[],
  bucketsB: Bucket[],
  postProgress: (explored: number, found: number, newCandidates: BuildCandidate[], nodeBudgetMax: number) => void,
  startedAt: number
): Promise<SearchResult> {
  const workerCount = Math.min(PARALLEL_PAIRING_WORKERS, bucketsA.length);
  const slices = partitionBucketsALPT(bucketsA, workerCount);
  const perWorkerMaxCollected = Math.max(1, Math.ceil(prepared.maxCollected / workerCount));

  const exploredByWorker: number[] = new Array(workerCount).fill(0);
  // Chaque worker escalade son PROPRE plafond (voir pairSlice.worker.ts) —
  // additionnés pour un total honnête, plutôt qu'une valeur inventée
  // (Infinity n'est plus vrai depuis que ce chemin s'applique aussi en
  // recherche normale). Champ non affiché tel quel dans l'UI (débogage/
  // évolution future, voir useBuildOptimSearch.ts) : l'honnêteté du chiffre
  // compte plus que sa précision exacte.
  const nodeBudgetMaxByWorker: number[] = new Array(workerCount).fill(0);
  const allCandidates: BuildCandidate[] = [];
  let candidatesSent = 0;
  let lastProgressPost = 0;

  const flushProgress = () => {
    const now = Date.now();
    if (now - lastProgressPost <= PROGRESS_THROTTLE_MS) return;
    lastProgressPost = now;
    const newCandidatesSlice = allCandidates.slice(candidatesSent);
    candidatesSent = allCandidates.length;
    const explored = exploredByWorker.reduce((s, v) => s + v, 0);
    const nodeBudgetMax = nodeBudgetMaxByWorker.reduce((s, v) => s + v, 0);
    postProgress(explored, allCandidates.length, newCandidatesSlice, nodeBudgetMax);
  };

  const handles = slices.map((bucketASlice, i) => {
    const sliceParams: SearchParams = { ...params, maxCollected: perWorkerMaxCollected };
    return pairSliceInWorker({ params: sliceParams, bucketASlice, bucketsB, startedAt }, (explored, newCandidates, nodeBudgetMax) => {
      exploredByWorker[i] = explored;
      nodeBudgetMaxByWorker[i] = nodeBudgetMax;
      if (newCandidates.length > 0) allCandidates.push(...newCandidates);
      flushProgress();
    });
  });
  activePairingWorkers = handles.map((h) => h.worker);

  // Arrêt manuel pendant cette phase : géré par le handler `stop` global
  // (`self.onmessage`), qui poste `{stop:true}` à chaque worker actif —
  // chacun répond gracieusement (voir pairSlice.worker.ts), donc `Promise.
  // all` se résout normalement, juste plus tôt et avec `truncated: true`.
  const results = await Promise.all(handles.map((h) => h.done));
  for (const w of activePairingWorkers) w.terminate();
  activePairingWorkers = [];

  return {
    candidates: results.flatMap((r) => r.candidates),
    explored: results.reduce((s, r) => s + r.explored, 0),
    truncated: results.some((r) => r.truncated),
  };
}

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
    for (const w of activePairingWorkers) w.postMessage({ stop: true });
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
      combosOrderMode: params.combosOrderMode,
    };
    const requestB: BuildHalfRequest = {
      half: 'B', slotIdxs: [3, 4, 5], filtered: prepared.filtered, distinctKeys: prepared.distinctKeys,
      constrainedKeys: prepared.constrainedKeys, retentionKeys: prepared.retentionKeys, minEntries: prepared.minEntries,
      bucketCap: prepared.bucketCap, otherHalfMaxSets: prepared.maxSetsForB, jokerCredit: prepared.jokerCredit,
      requiredPieces: prepared.requiredPieces, adaptiveTrancheWeighting: params.adaptiveTrancheWeighting,
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

  // Taille RÉELLE de l'espace à épuiser (voir `totalPairCount`) — calculée
  // UNE SEULE FOIS, maintenant que les deux moitiés sont construites (avant
  // ça, seule l'estimation brute pré-recherche, `estimateSearchSpace`,
  // existe). Coût négligeable : O(compartiments A × compartiments B), une
  // poignée de compartiments de chaque côté, jamais les combos eux-mêmes.
  const totalPairs = totalPairCount(prepared, bucketsA, bucketsB);

  // Voir la définition de `runParallelPairing` et le commentaire de
  // `PARALLEL_PAIRING_THRESHOLD` plus haut : depuis la vérification à
  // grande échelle (budget adaptatif par worker, 0 perte sur 49 essais),
  // le SEUL critère de déclenchement est la taille de l'espace à explorer —
  // plus de condition sur le mode (exhaustif ou normal).
  if (totalPairs >= PARALLEL_PAIRING_THRESHOLD) {
    const postProgress = (explored: number, found: number, newCandidates: BuildCandidate[], nodeBudgetMax: number) => {
      const message: WorkerPairingMessage = {
        type: 'progress',
        phase: 'pairing',
        explored,
        found,
        pct: estimatePct(prepared, totalPairs, explored, found, Date.now() - startedAt),
        // Somme des plafonds ACTUELS de chaque worker (chacun escalade le
        // sien indépendamment, voir `runParallelPairing`) — pas une valeur
        // unique comme en séquentiel, mais honnête : reflète le VRAI total
        // actuellement autorisé, pas une approximation figée.
        nodeBudgetMax,
        totalPairs,
        newCandidates,
      };
      (self as unknown as Worker).postMessage(message);
    };
    // ⚠️ `try/catch` ajouté après une revue de code externe — ABSENT jusqu'ici,
    // contrairement à la phase de construction juste au-dessus (qui, elle,
    // l'est). Si un des workers `pairSlice.worker.ts` lève une erreur
    // (`worker.onerror = reject` dans `pairSliceInWorker`), la `Promise.all`
    // de `runParallelPairing` rejette — et une rejection de promesse NON
    // interceptée à l'intérieur d'un handler `async self.onmessage` de
    // Worker ne remonte PAS via `Worker.onerror` au parent (piège JS/
    // navigateur réel, vérifié) : sans ce `catch`, aucun message `result`/
    // `error` n'était plus jamais posté — l'UI restait bloquée en
    // `'running'` indéfiniment, ET les workers enfants NON fautifs
    // fuyaient (le code qui les termine, juste après `Promise.all` dans
    // `runParallelPairing`, n'était jamais atteint).
    try {
      const finalResult = await runParallelPairing(params, prepared, bucketsA, bucketsB, postProgress, startedAt);
      const result: WorkerResultMessage = { type: 'result', ...finalResult };
      (self as unknown as Worker).postMessage(result);
    } catch {
      // `runParallelPairing` a pu être interrompue avant son propre nettoyage
      // (juste après `Promise.all`, voir son commentaire) — les workers
      // enfants encore listés ici n'ont alors jamais été terminés.
      for (const w of activePairingWorkers) w.terminate();
      activePairingWorkers = [];
      const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: true };
      (self as unknown as Worker).postMessage(result);
    }
    return;
  }

  // ── Chemin séquentiel existant, INCHANGÉ (recherche normale, ou
  // recherche exhaustive sous le seuil de parallélisation) ──
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
