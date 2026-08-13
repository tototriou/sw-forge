/// <reference lib="webworker" />
// Premier Worker de l'app. Le calcul lui-même (pur, sans React) vit dans
// lib/runeBuildOptim.ts et reste réutilisable dans les tests sans passer par
// un Worker. Voir spec/compte/calcul-runes.md §6 (Perf).
//
// ⚠️ Pilote le générateur `searchBuildsSteps` PAS À PAS plutôt que d'appeler
// `searchBuilds` d'un bloc : c'est ce qui permet de rendre la main à la
// boucle d'évènements entre deux points de passage, condition nécessaire
// pour qu'un message d'arrêt envoyé pendant que la recherche tourne soit
// reçu et traité (JS reste single-threaded : un message ne peut être livré
// que quand le code en cours d'exécution le permet).

import {
  searchBuildsSteps,
  SearchParams,
  SearchResult,
  adaptiveMaxNodes,
  DEFAULT_MAX_MS,
  MAX_COLLECTED,
} from '../lib/runeBuildOptim';

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
// réel (~30-47 s mesurés en dehors du Worker, voir spec/outils/optimizer.md).
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
// aucune information pendant cette phase (voir spec/outils/optimizer.md).
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
function estimatePct(params: SearchParams, explored: number, found: number, elapsedMs: number): number {
  // ⚠️ `adaptiveMaxNodes`, pas une constante fixe : depuis le budget de
  // paires adaptatif (voir son commentaire dans runeBuildOptim.ts), la vraie
  // valeur utilisée par CETTE recherche dépend du nombre de conditions
  // posées — une constante fixe ici ferait dériver la barre de progression
  // (elle finirait à un pourcentage arbitraire au lieu de 100 %).
  const maxNodes = adaptiveMaxNodes(params);
  const maxCollected = params.maxCollected ?? MAX_COLLECTED;
  const maxMs = params.maxMs ?? DEFAULT_MAX_MS;
  const ratios = [explored / maxNodes, found / maxCollected, Number.isFinite(maxMs) ? elapsedMs / maxMs : 0];
  return Math.min(1, Math.max(0, ...ratios));
}

let stopped = false;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  if ('stop' in e.data) {
    stopped = true;
    return;
  }
  stopped = false;
  const params = e.data;
  const startedAt = Date.now();
  let lastProgressPost = 0;

  let lastYield = startedAt;
  const gen = searchBuildsSteps(params);
  let step = gen.next();
  while (!step.done) {
    if (stopped) {
      // Arrêt manuel : on ressort le dernier point de passage tel quel, en
      // le requalifiant « tronqué » — c'est un résultat partiel assumé, pas
      // une recherche allée au bout de son budget. Pendant `phase:'building'`
      // (avant même la première paire), il n'y a RIEN à ressortir : aucun
      // candidat n'a encore pu être trouvé — un résultat vide, tronqué, est
      // le seul choix honnête (sans ce cas, `progress.candidates` n'existe
      // même pas sur cette forme du point de passage).
      const progress = step.value;
      const message: WorkerResultMessage =
        progress.phase === 'pairing'
          ? { type: 'result', candidates: progress.candidates, explored: progress.explored, truncated: true }
          : { type: 'result', candidates: [], explored: 0, truncated: true };
      (self as unknown as Worker).postMessage(message);
      return;
    }
    const now = Date.now();
    if (now - lastProgressPost > PROGRESS_THROTTLE_MS) {
      lastProgressPost = now;
      const progress = step.value;
      const message: WorkerProgressMessage =
        progress.phase === 'pairing'
          ? {
              type: 'progress',
              phase: 'pairing',
              explored: progress.explored,
              found: progress.candidates.length,
              pct: estimatePct(params, progress.explored, progress.candidates.length, now - startedAt),
            }
          : {
              type: 'progress',
              phase: 'building',
              half: progress.half,
              scanned: progress.scanned,
              total: progress.total,
              pct: progress.total > 0 ? progress.scanned / progress.total : 0,
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
