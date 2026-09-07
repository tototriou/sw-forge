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

import { prepareSearch, pairBuckets, totalPairCount, PreparedSearch, SearchParams, SearchResult, Bucket, BuildCandidate } from '../lib/runeBuildOptim';
import { BuildHalfRequest, BuildHalfResponse } from './buildHalf.worker';
import { PairSliceRequest, PairSliceResponse } from './pairSliceBody';
import { driveParallelPairing, PARALLEL_PAIRING_THRESHOLD, SliceHandle } from './parallelPairing';
import { drivePairing, PROGRESS_THROTTLE_MS } from './pairingDriver';

export type WorkerRequest = SearchParams | { stop: true };

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
  // Taille RÉELLE de l'espace de recherche à épuiser (voir
  // `totalPairCount`) — CONSTANTE pour toute la phase d'appariement (les
  // deux moitiés sont déjà construites), et EXACTE : c'est le nombre de
  // paires que l'appariement parcourra s'il va au bout. Depuis la
  // suppression du budget de nœuds (piste 8), c'est le seul dénominateur
  // que le Worker ait à transmettre.
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
// ⚠️ Contre `totalPairs` (l'espace RÉEL à épuiser, voir `totalPairCount`) —
// c'était DÉJÀ le cas quand un plafond de nœuds existait encore à côté (il
// grandissait avec l'escalade et n'avait plus grand-chose à voir avec la
// taille réelle du travail restant, voir « Suite — espace de recherche
// affiché en direct ») ; ce choix de l'interface est l'un des arguments qui
// ont mené à sa suppression (piste 8). Affiché à
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
let activePairingWorkers: SliceHandle[] = [];

// ⚠️ Parallélisation de l'APPARIEMENT — voir spec/outils/optimizer/
// pistes.md, point 9. Historique en deux temps :
// 1. Mesuré sur 3 itérations (scripts/pairing-parallel-diag.ts) : un
//    découpage STATIQUE de bucketsA à budget INFINI (mode exhaustif
//    seulement) est SÛR — aucune perte, quel que soit le découpage.
//    Découpage à budget FIGÉ (round-robin ou LPT) en recherche NORMALE
//    (tronquée) perdait des candidats valides — mais ce prototype figeait
//    le budget au lieu de laisser chaque worker ESCALADER le sien, voir
//    point 2.
// 2. Chaque worker a ensuite reçu un budget ADAPTATIF (escalade par worker)
//    au lieu d'un budget figé. Sous ce mécanisme, vérifié à grande échelle
//    (49 essais réels, 7 cas × 7 durées, SOUS CONTENTION volontaire pour
//    durcir le test — skill `optimizer-perf-testing`) : **0 perte
//    détectée**, y compris en recherche NORMALE. La parallélisation
//    s'applique donc depuis aux DEUX modes — seul le seuil de taille
//    (`PARALLEL_PAIRING_THRESHOLD`, parallelPairing.ts) décide si ça vaut
//    le coût de coordination.
// 3. Le budget de paires a fini par être supprimé tout court (piste 8, voir
//    `totalPairCount`) : chaque worker parcourt sa tranche ENTIÈRE sous les
//    seules bornes `maxMs`/quota de candidats. C'est le cas LIMITE du
//    point 2 — l'escalade convergeait déjà vers « tout ce que le temps
//    permet » —, donc la vérification ci-dessus reste valable, et le
//    découpage du point 1 n'a plus de « budget figé » possible du tout.
//
// PARALLEL_PAIRING_THRESHOLD et PARALLEL_PAIRING_WORKERS ont tous deux
// déménagé dans `parallelPairing.ts`, avec l'orchestration qui les utilise —
// pour que le navigateur et Node emploient forcément les MÊMES valeurs. Voir
// leurs commentaires là-bas pour la calibration.

// Répartition GLOUTONNE par charge réelle (LPT) — voir `partitionBucketsALPT`
// dans runeBuildOptim.ts (déplacée là pour être testable en Node, voir
// tests/rune-optim-parallel-pairing.test.ts) pour la stratégie et sa preuve.

// Adaptateur de plateforme passé à `driveParallelPairing` — la SEULE partie
// du chemin parallèle qui reste liée à Vite/navigateur (`new Worker(new
// URL(...))`). Son pendant Node vit dans `scripts/lib/`.
function pairSliceInWorker(
  request: PairSliceRequest,
  onProgress: (explored: number, newCandidates: BuildCandidate[]) => void
): SliceHandle {
  const worker = new Worker(new URL('./pairSlice.worker.ts', import.meta.url), { type: 'module' });
  const done = new Promise<SearchResult>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<PairSliceResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress(msg.explored, msg.newCandidates);
        return;
      }
      // ⚠️ Reconstruction EXPLICITE, pas un spread de `msg` — un champ ajouté
      // à `SearchResult` sans être listé ICI serait perdu en silence. Voir
      // spec/outils/optimizer/near-miss-appariement.md, §5 : un des deux
      // points identifiés à l'avance pour cette raison précise.
      resolve({
        candidates: msg.candidates,
        explored: msg.explored,
        truncated: msg.truncated,
        nearMissByCondition: msg.nearMissByCondition,
        globalNearMiss: msg.globalNearMiss,
      });
    };
    worker.onerror = reject;
  });
  worker.postMessage(request);
  return {
    done,
    stop: () => worker.postMessage({ stop: true }),
    terminate: () => worker.terminate(),
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
    for (const h of activePairingWorkers) h.stop();
    return;
  }
  stopped = false;
  const params = e.data;
  const startedAt = Date.now();
  let lastProgressPost = 0;

  const prepared = prepareSearch(params);
  if (!prepared) {
    const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null };
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

  // Voir la définition de `driveParallelPairing` et le commentaire de
  // `PARALLEL_PAIRING_THRESHOLD` (parallelPairing.ts) : depuis la vérification à
  // grande échelle (budget adaptatif par worker, 0 perte sur 49 essais),
  // le SEUL critère de déclenchement est la taille de l'espace à explorer —
  // plus de condition sur le mode (exhaustif ou normal).
  if (totalPairs >= PARALLEL_PAIRING_THRESHOLD) {
    const postProgress = (explored: number, found: number, newCandidates: BuildCandidate[]) => {
      const message: WorkerPairingMessage = {
        type: 'progress',
        phase: 'pairing',
        explored,
        found,
        pct: estimatePct(prepared, totalPairs, explored, found, Date.now() - startedAt),
        // ⚠️ `explored` est la SOMME des tranches et `totalPairs` l'espace
        // GLOBAL : les deux restent comparables parce que les tranches de
        // `bucketsA` partitionnent la moitié A, donc la somme des espaces
        // par tranche vaut exactement `totalPairs`.
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
      const finalResult = await driveParallelPairing(
        pairSliceInWorker, params, prepared, bucketsA, bucketsB, postProgress, startedAt,
        (handles) => { activePairingWorkers = handles; }
      );
      const result: WorkerResultMessage = { type: 'result', ...finalResult };
      (self as unknown as Worker).postMessage(result);
    } catch {
      // `runParallelPairing` a pu être interrompue avant son propre nettoyage
      // (juste après `Promise.all`, voir son commentaire) — les workers
      // enfants encore listés ici n'ont alors jamais été terminés.
      for (const h of activePairingWorkers) h.terminate();
      activePairingWorkers = [];
      const result: WorkerResultMessage = { type: 'result', candidates: [], explored: 0, truncated: true, nearMissByCondition: [], globalNearMiss: null };
      (self as unknown as Worker).postMessage(result);
    }
    return;
  }

  // ── Chemin séquentiel existant, INCHANGÉ (recherche normale, ou
  // recherche exhaustive sous le seuil de parallélisation) ──
  // ⚠️ **Aucun budget de paires à piloter ici** (piste 8, voir
  // `totalPairCount` dans runeBuildOptim.ts) : l'appariement va au bout de
  // `totalPairs`, sauf arrêt par `maxMs`, par `maxCollected` ou par le bouton
  // « Arrêter » (`stopped`). Ce qui l'imposait auparavant, gardé comme repère
  // de dimensionnement : sur un vrai compte (Sonia, tototriou-12889591.json),
  // le plafond adaptatif était épuisé en 22 s (38,4M paires, 0 résultat)
  // alors qu'un plafond 13× plus large retrouvait le build exact en 32 s
  // (86,8M paires) — le budget-TEMPS n'était jamais sollicité. Ce cas se
  // termine désormais par construction. Voir spec/outils/optimizer/.
  const gen = pairBuckets(prepared, bucketsA, bucketsB);
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
