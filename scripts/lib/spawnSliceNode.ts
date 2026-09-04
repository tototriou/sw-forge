// Le `SpawnSlice` de Node — pendant de `pairSliceInWorker`
// (src/workers/runeBuildOptim.worker.ts), qui est son équivalent navigateur.
//
// Avec ce fichier, `driveParallelPairing` tourne à l'identique sur les deux
// plateformes : même répartition LPT, même division de plafond, même fusion
// de résultats, même corps de tranche. Seul le LANCEMENT diffère — c'est
// exactement ce que l'injection isole. Voir
// spec/outils/optimizer/parallelisation-partagee.md.

import { Worker } from 'worker_threads';
import { existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { build } from 'esbuild';
import { SearchResult } from '../../src/lib/runeBuildOptim';
import { PairSliceResponse } from '../../src/workers/pairSliceBody';
import { SliceHandle, SpawnSlice } from '../../src/workers/parallelPairing';

// ⚠️ Un `worker_threads` a besoin de JS pur : le TypeScript est bundlé en
// `.cjs` via esbuild (déjà une dépendance de Vite, pas un ajout) — même
// patron que `tests/rune-optim-parallel-pairing.test.ts` et
// `scripts/perf-battery.ts`. Bundlé UNE FOIS par exécution, réutilisé par
// toutes les tranches : le coût de bundling ne doit jamais entrer dans une
// mesure de temps d'appariement.
let bundlePath: string | null = null;

export async function ensurePairSliceBundle(): Promise<string> {
  if (bundlePath && existsSync(bundlePath)) return bundlePath;
  const dir = join(tmpdir(), `sw-forge-pair-slice-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  bundlePath = join(dir, 'pair-slice-worker.cjs');
  await build({
    entryPoints: ['scripts/lib/pair-slice-worker.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundlePath,
    logLevel: 'error',
  });
  return bundlePath;
}

/**
 * Fabrique le `SpawnSlice` attendu par `driveParallelPairing`.
 *
 * ⚠️ `stop` poste `{stop:true}` (arrêt COOPÉRATIF, le worker rend les
 * candidats déjà trouvés) et `terminate` tue le fil — exactement la même
 * distinction que côté navigateur, où la confondre ferait perdre les
 * résultats d'une recherche interrompue.
 */
export function makeSpawnSliceNode(workerBundlePath: string): SpawnSlice {
  return (request, onProgress): SliceHandle => {
    const worker = new Worker(workerBundlePath, { workerData: request });
    const done = new Promise<SearchResult>((resolve, reject) => {
      worker.on('message', (msg: PairSliceResponse) => {
        if (msg.type === 'progress') {
          onProgress(msg.explored, msg.newCandidates);
          return;
        }
        resolve({ candidates: msg.candidates, explored: msg.explored, truncated: msg.truncated });
      });
      worker.on('error', reject);
    });
    return {
      done,
      stop: () => worker.postMessage({ stop: true }),
      terminate: () => {
        void worker.terminate();
      },
    };
  };
}
