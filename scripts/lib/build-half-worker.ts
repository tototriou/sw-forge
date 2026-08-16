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
import { RuneDetail } from '../../src/types';

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
}
export interface BuildHalfWorkerResult {
  buckets: Bucket[];
  ms: number;
}

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

const data = workerData as BuildHalfWorkerData;
const t0 = performance.now();
const buckets = drain(
  buildBuckets(
    data.half,
    data.slotIdxs,
    data.filtered,
    data.distinctKeys,
    data.constrainedKeys,
    data.retentionKeys,
    data.minEntries,
    data.bucketCap,
    data.otherHalfMaxSets,
    data.jokerCredit,
    data.requiredPieces
  )
);
const ms = performance.now() - t0;
const result: BuildHalfWorkerResult = { buckets, ms };
parentPort!.postMessage(result);
