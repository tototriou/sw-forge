// Équivalent Node (`worker_threads`) de `src/workers/buildHalf.worker.ts`, à
// l'usage EXCLUSIF de scripts/perf-battery.ts — pour que la mesure de
// construction reflète le vrai comportement de l'app (les deux moitiés A/B
// construites EN PARALLÈLE sur deux fils séparés, voir spec/outils/
// optimizer/ « Suite — parallélisation de la construction des deux
// moitiés »), pas une simulation séquentielle dans le même processus qui
// gonflerait artificiellement le temps de construction mesuré.
//
// Repris via esbuild en .cjs par perf-battery.ts avant d'être passé à
// `new Worker(...)` — un fil `worker_threads` a besoin de JS pur, pas de
// TypeScript transpilé à la volée.

import { parentPort, workerData } from 'worker_threads';
import { buildBuckets, Bucket } from '../../src/lib/runeBuildOptim';
import { StatKey } from '../../src/lib/effects';
import { RuneDetail, BaseStats } from '../../src/types';
import { drain } from './drain';

export interface BuildHalfWorkerData {
  half: 'A' | 'B';
  slotIdxs: readonly [number, number, number];
  filtered: RuneDetail[][];
  distinctKeys: string[];
  constrainedKeys: StatKey[];
  retentionKeys: StatKey[];
  minEntries: { k: StatKey; min: number }[];
  bucketCap: number;
  otherHalfMaxSets: number[];
  jokerCredit: number;
  requiredPieces: number[];
  // ⚠️ Nécessaire à `retentionScore`/`combinedRetentionScore` (pondération
  // pct/flat par base) — voir BuildBucketsContext dans runeBuildOptim.ts.
  base: BaseStats;
  // PROTOTYPE (combosOrderMode='objective') — même discipline que `base`.
  objectiveKeys: StatKey[];
  // ⚠️ Manquaient tous les deux jusqu'ici — ce worker (utilisé par
  // perf-battery.ts pour mesurer la construction « comme en prod ») ignorait
  // silencieusement adaptiveTrancheWeighting ET combosOrderMode, retombant
  // TOUJOURS sur le défaut interne de buildBuckets quel que soit ce que
  // SearchParams portait — trouvé en corrigeant le même trou côté
  // src/workers/buildHalf.worker.ts (voir spec/outils/optimizer/
  // historique/historique-dimensionnement.md, « revue de code externe »).
  adaptiveTrancheWeighting?: boolean;
  combosOrderMode?: 'potential' | 'relevance' | 'combined' | 'objective';
}
/**
 * Relevé mémoire de FIN de moitié — §4.1 bis de spec/outils/optimizer/
 * harnais-diagnostic-extensions.md, palier **LÉGER**.
 *
 * ⚠️ **Pourquoi la mesure est propre ici et nulle part ailleurs** : chaque
 * moitié tourne dans son PROPRE `worker_threads`, donc dans son propre tas.
 * Un relevé par fil ne peut pas confondre A et B.
 *
 * ⚠️ **Palier LÉGER, et c'est un arbitrage** : trois lignes après la
 * construction, donc aucune perturbation de la phase mesurée. Le palier
 * complet — un `PerformanceObserver` sur les événements `gc`, pour compter
 * les pauses et leur durée — est ÉCARTÉ tant que le relevé léger ne montre
 * pas d'écart A/B : l'observateur a son propre coût et s'insère dans la
 * phase qu'on mesure.
 */
export interface MemoireMoitie {
  heapUsed: number;
  heapTotal: number;
  rss: number;
}

export interface BuildHalfWorkerResult {
  buckets: Bucket[];
  ms: number;
  memoire: MemoireMoitie;
}

const data = workerData as BuildHalfWorkerData;
const t0 = performance.now();
const buckets = drain(
  buildBuckets(
    data.half,
    data.slotIdxs,
    data,
    data.otherHalfMaxSets,
    undefined,
    data.adaptiveTrancheWeighting,
    data.combosOrderMode
  )
);
const ms = performance.now() - t0;
// ⚠️ APRÈS le chronomètre : le relevé ne doit entrer dans aucun temps
// mesuré, et il est pris avant que quoi que ce soit ne soit sérialisé vers
// le fil parent — donc sur l'état laissé par la construction elle-même.
const usage = process.memoryUsage();
const result: BuildHalfWorkerResult = {
  buckets,
  ms,
  memoire: { heapUsed: usage.heapUsed, heapTotal: usage.heapTotal, rss: usage.rss },
};
parentPort!.postMessage(result);
