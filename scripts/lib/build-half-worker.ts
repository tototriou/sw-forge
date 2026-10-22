// Coquille Node du pool de construction, réutilisée par toutes ses tâches.
// Même générateur que buildHalf.worker.ts ; seules messagerie et observations
// Node diffèrent. Voir docs/03-developpeur/optimizer/harnais/extensions.md.
import { parentPort } from 'worker_threads';
import { construireTrancheEtapes, ResultatTranche, tamponsDeTranche } from '../../src/lib/constructionRapide';
import { entreeDeTranche, type RequeteTranche } from '../../src/lib/constructionEmboitee';
import { drain } from './drain';

export interface BuildHalfWorkerData extends RequeteTranche {
  /** Instrument opt-in ; aucun relevé par rune sur le chemin ordinaire. */
  horodaterProgression?: boolean;
}
export interface MemoireMoitie {
  heapUsed: number;
  heapTotal: number;
  arrayBuffers: number;
  /** Mémoire résidente du processus entier, commune aux fils. */
  rss: number;
}
export interface ProgressionMoitie {
  tranches: number;
  prologueMs: number;
  intervallesMs: number[];
  derniereEtEpilogueMs: number;
  runesExterieures: number;
}
export interface BuildHalfWorkerResult {
  resultat: ResultatTranche;
  ms: number;
  memoire: MemoireMoitie;
  progression?: ProgressionMoitie;
}

function construire(data: BuildHalfWorkerData): Omit<BuildHalfWorkerResult, 'memoire'> {
  const gen = construireTrancheEtapes(entreeDeTranche(data));
  const t0 = performance.now();
  if (!data.horodaterProgression) {
    const resultat = drain(gen);
    return { resultat, ms: performance.now() - t0 };
  }
  const intervallesMs: number[] = [];
  let step = gen.next();
  let precedent = performance.now();
  const prologueMs = precedent - t0;
  let derniereEtEpilogueMs = 0;
  while (!step.done) {
    step = gen.next();
    const t = performance.now();
    if (step.done) derniereEtEpilogueMs = t - precedent;
    else intervallesMs.push(t - precedent);
    precedent = t;
  }
  return { resultat: step.value, ms: precedent - t0,
    progression: { tranches: 1, prologueMs, intervallesMs, derniereEtEpilogueMs, runesExterieures: data.idx0s.length } };
}

parentPort!.on('message', (data: BuildHalfWorkerData | { type: 'fin' }) => {
  if ('type' in data) { parentPort!.close(); return; }
  const r = construire(data);
  // Hors chrono, avant transfert ; le tas peut avoir servi une tâche précédente.
  const { heapUsed, heapTotal, arrayBuffers, rss } = process.memoryUsage();
  const message: BuildHalfWorkerResult = { ...r, memoire: { heapUsed, heapTotal, arrayBuffers, rss } };
  parentPort!.postMessage(message, tamponsDeTranche(r.resultat));
});
