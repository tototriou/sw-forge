// Le `LancerTravailleur` de Node de l'appariement parallèle de production —
// pendant de `lancerTravailleurNavigateur` (src/workers/runeBuildOptim.worker.ts) :
// bundle esbuild UNE fois par processus, hors de l'arbre, puis un
// `worker_threads` par Worker, tableaux typés transférés à la création. Le
// harnais, le banc et les tests apparient par lui.

import { Worker } from 'worker_threads';
import { existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { build } from 'esbuild';
import { ResultatMorceau } from '../../src/lib/appariementRapide';
import { LancerTravailleur } from '../../src/lib/appariementRapideParallele';

let bundlePath: string | null = null;

export async function assurerBundleAppariementRapide(): Promise<string> {
  if (bundlePath && existsSync(bundlePath)) return bundlePath;
  const dir = join(tmpdir(), `swblacksmith-appariement-rapide-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  bundlePath = join(dir, 'appariement-rapide-worker.cjs');
  await build({
    entryPoints: ['scripts/lib/appariement-rapide-worker.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundlePath,
    logLevel: 'error',
  });
  return bundlePath;
}

export function lancerTravailleurNode(chemin: string): LancerTravailleur {
  return (init, transfert) => {
    const worker = new Worker(chemin, { workerData: init, transferList: transfert });
    return {
      envoyer: (message, t) => worker.postMessage(message, t),
      surMessage: (rappel) => worker.on('message', (m: ResultatMorceau) => rappel(m)),
      surErreur: (rappel) => {
        worker.on('error', rappel);
        worker.on('exit', (code) => {
          if (code !== 0) rappel(new Error(`Worker d’appariement sorti avec le code ${code}`));
        });
      },
      arreter: () => worker.postMessage({ type: 'arret' }),
      // Fin coopérative (voir la coquille) ; le fil sort seul une fois son port fermé.
      terminer: () => {
        worker.postMessage({ type: 'fin' });
      },
    };
  };
}
