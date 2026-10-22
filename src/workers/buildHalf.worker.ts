/// <reference lib="webworker" />
// Coquille réutilisable du pool de construction. Le parent termine le pool
// à la fin, sur erreur ou arrêt ; aucun protocole coopératif pendant une tâche.
// Voir docs/03-developpeur/optimizer/moteur/pipeline.md § Construction des moitiés.
import { construireTrancheEtapes, ResultatTranche, tamponsDeTranche } from '../lib/constructionRapide';
import { entreeDeTranche, RequeteTranche } from '../lib/constructionEmboitee';

export type BuildHalfRequest = RequeteTranche;
export type BuildHalfResponse =
  | { type: 'progress'; scanned: number }
  | { type: 'result'; resultat: ResultatTranche };

const PROGRESS_THROTTLE_MS = 150;
self.onmessage = (e: MessageEvent<BuildHalfRequest>) => {
  const gen = construireTrancheEtapes(entreeDeTranche(e.data));
  let lastPost = 0;
  let step = gen.next();
  while (!step.done) {
    const now = Date.now();
    if (now - lastPost > PROGRESS_THROTTLE_MS) {
      lastPost = now;
      const message: BuildHalfResponse = { type: 'progress', scanned: step.value };
      self.postMessage(message);
    }
    step = gen.next();
  }
  // Le dernier point est garanti même si le palier a absorbé les précédents.
  const fin: BuildHalfResponse = { type: 'progress', scanned: e.data.idx0s.length };
  self.postMessage(fin);
  const message: BuildHalfResponse = { type: 'result', resultat: step.value };
  self.postMessage(message, tamponsDeTranche(step.value));
};
