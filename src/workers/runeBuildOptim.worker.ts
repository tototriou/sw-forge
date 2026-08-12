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

import { searchBuildsSteps, SearchParams, SearchResult } from '../lib/runeBuildOptim';

export type WorkerRequest = SearchParams | { stop: true };

let stopped = false;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  if ('stop' in e.data) {
    stopped = true;
    return;
  }
  stopped = false;

  const gen = searchBuildsSteps(e.data);
  let step = gen.next();
  while (!step.done) {
    if (stopped) {
      // Arrêt manuel : on ressort le dernier point de passage tel quel, en
      // le requalifiant « tronqué » — c'est un résultat partiel assumé, pas
      // une recherche allée au bout de son budget.
      const progress = step.value;
      const result: SearchResult = { candidates: progress.candidates, explored: progress.explored, truncated: true };
      (self as unknown as Worker).postMessage(result);
      return;
    }
    // Rend la main à la boucle d'évènements : sans ce point de passage
    // explicite, le message « stop » resterait en attente jusqu'à la fin de
    // la recherche, ce qui viderait le bouton Arrêter de son sens.
    await new Promise((resolve) => setTimeout(resolve, 0));
    step = gen.next();
  }
  (self as unknown as Worker).postMessage(step.value);
};
