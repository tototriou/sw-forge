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
import { SortieCandidats } from '../../src/lib/candidatsCompacts';
import { BuildCandidate } from '../../src/lib/runeBuildOptim';
import { ColonnesCandidats, RecepteurCandidats, creerColonnesCandidats } from '../../src/lib/candidatsCompacts';
import { OptionsParallele, ResultatParallele } from '../../src/lib/appariementRapideParallele';
import { SearchResult } from '../../src/lib/runeBuildOptim';
import { EmetteurCandidats, lancerAppariement } from '../../src/workers/pairingDriver';

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

export function lancerTravailleurNode<C extends SortieCandidats = BuildCandidate[]>(chemin: string): LancerTravailleur<C> {
  return (init, transfert) => {
    const worker = new Worker(chemin, { workerData: init, transferList: transfert });
    return {
      envoyer: (message, t) => worker.postMessage(message, t),
      surMessage: (rappel) => worker.on('message', (m: ResultatMorceau<C>) => rappel(m)),
      acquitter: () => worker.postMessage({ type: 'credit' }),
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

/** Les objets appartiennent à la sortie de l'outil ; le transport reste celui de l'écran. */
export async function apparierNode(
  options: Omit<OptionsParallele<ColonnesCandidats>, 'lancer'> & {
    regime: 'sequentiel' | 'parallele';
    cheminBundle?: string;
    observer?: (explored: number, candidats: ColonnesCandidats) => void;
    estArrete?: () => boolean;
  }
): Promise<{ resultat: SearchResult; parallele?: ResultatParallele }> {
  const recepteur = new RecepteurCandidats(0);
  const flux = new EmetteurCandidats((bloc, transfert) => {
    recepteur.recevoir([structuredClone(bloc, { transfer: transfert })]);
    flux.acquitter();
  });
  const r = await lancerAppariement({
    ...options, collecte: creerColonnesCandidats(), flux,
    lancer: lancerTravailleurNode<ColonnesCandidats>(options.cheminBundle ?? await assurerBundleAppariementRapide()),
  });
  const candidates = recepteur.sceller(await flux.sceller(r.resultat.candidates));
  return { resultat: { ...r.resultat, candidates },
    ...(r.parallele ? { parallele: { ...r.parallele, candidates } } : {}) };
}
