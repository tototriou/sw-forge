// Adaptateur Node du lanceur de construction de l'écran. Un pool borné par
// la règle des cœurs sert les tranches des deux moitiés et de tous les crans.
// Le budget global comprend toujours la construction ; aucun chrono remis à zéro.
// Voir docs/03-developpeur/optimizer/moteur/pipeline.md § Construction des moitiés.
import { Worker } from 'worker_threads';
import { existsSync, mkdtempSync } from 'fs';
import { availableParallelism, tmpdir } from 'os';
import { join } from 'path';
import { build } from 'esbuild';
import { Bucket, PreparedSearch, SearchParams } from '../../src/lib/runeBuildOptim';
import { lancerConstruction, RequeteTranche, TravailleurConstruction } from '../../src/lib/constructionEmboitee';
import { CompartimentType, objetsDesCompartiments } from '../../src/lib/demiBuildsTypes';
import type { BuildHalfWorkerResult, MemoireMoitie, ProgressionMoitie } from './build-half-worker';

let bundle: Promise<string> | undefined;
export async function ensureBuildHalfBundle(): Promise<string> {
  if (bundle) {
    const chemin = await bundle;
    if (existsSync(chemin)) return chemin;
  }
  bundle = (async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-build-half-'));
    const chemin = join(dossier, 'build-half-worker.cjs');
    await build({ entryPoints: ['scripts/lib/build-half-worker.ts'], bundle: true,
      platform: 'node', format: 'cjs', outfile: chemin, logLevel: 'error' });
    return chemin;
  })();
  try { return await bundle; } catch (e) { bundle = undefined; throw e; }
}

/** Poignée réutilisable ; une sortie sans réponse rejette aussi une tâche en cours. */
export function creerConstructionNode(
  chemin: string,
  observer?: (requete: RequeteTranche, r: BuildHalfWorkerResult) => void,
  horodaterProgression = false
): TravailleurConstruction {
  const worker = new Worker(chemin);
  let fin = false;
  let rejeter: ((e: Error) => void) | undefined;
  let panne: Error | undefined;
  const echouer = (e: Error) => { panne = e; rejeter?.(e); };
  worker.on('error', echouer);
  const sortie = new Promise<void>((resolve) => worker.once('exit', (code) => {
    if (!fin) echouer(new Error(`Worker de construction sorti sans réponse (code ${code}).`));
    resolve();
  }));
  return {
    construire: (requete, progression) => new Promise((resolve, reject) => {
      if (panne) { reject(panne); return; }
      rejeter = reject;
      worker.once('message', (r: BuildHalfWorkerResult) => {
        rejeter = undefined;
        try {
          observer?.(requete, r);
          progression(requete.idx0s.length);
          resolve(r.resultat);
        } catch (e) { reject(e); }
      });
      worker.postMessage({ ...requete, horodaterProgression: horodaterProgression && requete.rangPrereglage === 0 });
    }),
    terminer: async () => {
      fin = true;
      // Pas de terminate pendant un transfert initial : le fil termine sa
      // tâche puis ferme son port, même sur l'erreur d'un autre fil.
      worker.postMessage({ type: 'fin' });
      await sortie;
    },
  };
}

export interface MoitiesConstruites {
  bucketsA: CompartimentType[];
  bucketsB: CompartimentType[];
  /** Somme des coûts internes des tranches du cran de recherche, hors fusion. */
  msA: number;
  msB: number;
  /** Pics observés par fil, sommés ; rss = maximum global, sans double compte. */
  memoireA: MemoireMoitie;
  memoireB: MemoireMoitie;
  progressionA?: ProgressionMoitie;
  progressionB?: ProgressionMoitie;
  wallMs: number;
}

export async function construireMoitiesEnParallele(
  prepared: PreparedSearch, params: SearchParams, chemin: string, horodaterProgression = false
): Promise<MoitiesConstruites> {
  const propres: Record<'A' | 'B', Omit<BuildHalfWorkerResult, 'resultat'>[]> = { A: [], B: [] };
  const pics: Record<'A' | 'B', MemoireMoitie[]> = { A: [], B: [] };
  const t0 = performance.now();
  const { bucketsA, bucketsB } = await lancerConstruction(prepared, params.combosOrderMode, {
    concurrence: availableParallelism(), coeursPhysiques: null,
    creer: () => {
      const parMoitie: Partial<Record<'A' | 'B', MemoireMoitie>> = {};
      const fil = creerConstructionNode(chemin, (r, resultat) => {
        if (r.rangPrereglage === 0) propres[r.half].push({ ms: resultat.ms, memoire: resultat.memoire, progression: resultat.progression });
        const pic = parMoitie[r.half] ??= { heapUsed: 0, heapTotal: 0, arrayBuffers: 0, rss: 0 };
        for (const k of ['heapUsed', 'heapTotal', 'arrayBuffers', 'rss'] as const) pic[k] = Math.max(pic[k], resultat.memoire[k]);
      }, horodaterProgression);
      return { construire: fil.construire, terminer: async () => {
        await fil.terminer();
        for (const h of ['A', 'B'] as const) if (parMoitie[h]) pics[h].push(parMoitie[h]!);
      } };
    },
  });
  const memoire = (h: 'A' | 'B'): MemoireMoitie => pics[h].reduce((a, b) => ({
    heapUsed: a.heapUsed + b.heapUsed, heapTotal: a.heapTotal + b.heapTotal,
    arrayBuffers: a.arrayBuffers + b.arrayBuffers, rss: Math.max(a.rss, b.rss),
  }), { heapUsed: 0, heapTotal: 0, arrayBuffers: 0, rss: 0 });
  const progression = (h: 'A' | 'B'): ProgressionMoitie | undefined => !horodaterProgression ? undefined : propres[h].reduce((a, r) => {
    const p = r.progression!;
    a.tranches += p.tranches;
    a.prologueMs += p.prologueMs;
    for (const intervalle of p.intervallesMs) a.intervallesMs.push(intervalle);
    a.derniereEtEpilogueMs += p.derniereEtEpilogueMs;
    a.runesExterieures += p.runesExterieures;
    return a;
  }, { tranches: 0, prologueMs: 0, intervallesMs: [] as number[], derniereEtEpilogueMs: 0, runesExterieures: 0 });
  return { bucketsA, bucketsB, msA: propres.A.reduce((n, r) => n + r.ms, 0), msB: propres.B.reduce((n, r) => n + r.ms, 0),
    memoireA: memoire('A'), memoireB: memoire('B'), progressionA: progression('A'), progressionB: progression('B'), wallMs: performance.now() - t0 };
}

/** Adaptation seulement à la sortie, pour les outils qui lisent des HalfCombo. */
export async function construireMoitiesObjetsEnParallele(
  ...args: Parameters<typeof construireMoitiesEnParallele>
): Promise<Omit<MoitiesConstruites, 'bucketsA' | 'bucketsB'> & { bucketsA: Bucket[]; bucketsB: Bucket[] }> {
  const r = await construireMoitiesEnParallele(...args);
  return { ...r, bucketsA: objetsDesCompartiments(r.bucketsA, args[0].filtered), bucketsB: objetsDesCompartiments(r.bucketsB, args[0].filtered) };
}
