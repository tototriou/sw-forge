// Construction des DEUX moitiés EN PARALLÈLE, côté Node — la coquille de
// lancement, pendant de ce que `runeBuildOptim.worker.ts` fait avec deux Web
// Workers.
//
// ⚠️ **Pourquoi ça ne peut pas rester séquentiel dans un outil de mesure.**
// Construire A puis B dans le même fil ne fausse pas qu'un affichage : le
// budget `maxMs` court depuis `prepared.startedAt`, CONSTRUCTION COMPRISE
// (voir `pairBuckets` — sinon paralléliser la construction reculerait
// silencieusement l'échéance). Une construction séquentielle vole donc ce
// budget à l'appariement, et sur un run tronqué par le temps l'outil trouve
// MOINS de candidats que la production. C'est un écart de RÉSULTAT, pas de
// présentation.
//
// Surcoût mesuré sur la baseline figée (`scripts/perf-baseline.json`,
// `buildAMs + buildBMs` contre `buildWallMs`) : +0,5 s à +2,4 s selon le
// cas, soit +0,2 % du run là où l'appariement domine… mais **+7 %, +25 % et
// +32 %** sur les trois cas où il ne domine pas (Lushen d15 Rage+Blade,
// Lushen d11, Ciri défense). Négligeable seulement en moyenne.
//
// ⚠️ **Le travail lui-même n'est PAS dupliqué** : `build-half-worker.ts` est
// le même fichier que celui de `perf-battery.ts`, qui appelle le vrai
// `buildBuckets`. Ce qui vit ici est uniquement le bundling et le spawn —
// exactement le découpage retenu pour l'appariement (`spawnSliceNode.ts` vs
// `pairSliceInWorker`), où la LOGIQUE est partagée et seule la coquille de
// plateforme diffère.
//
// ⚠️ `perf-battery.ts` garde sa propre coquille, délibérément : son cache de
// bundle est indexé par PID parce que chaque cas y tourne dans son propre
// processus (voir son commentaire, et le bug de bundle figé qu'il documente).
// Lui imposer celle-ci changerait la mécanique de l'outil de mesure de
// référence pour un gain nul.
//
// ⚠️ **Sur un PETIT cas, paralléliser coûte plus que ça ne rapporte** —
// mesuré : deux fils à 25 et 24 ms pour un temps de phase de 127 ms, le spawn
// et la copie des compartiments pesant plus que le travail lui-même. Ce n'est
// PAS une raison de conditionner la parallélisation à la taille : la
// production lance ses deux Web Workers dans TOUS les cas, et un harnais qui
// choisirait autrement cesserait de mesurer la production. Le surcoût est donc
// reproduit tel quel — et rendu visible, `msA`/`msB` étant rapportés à côté du
// temps réel de la phase.

import { Worker } from 'worker_threads';
import { existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { build } from 'esbuild';
import { Bucket, PreparedSearch, SearchParams } from '../../src/lib/runeBuildOptim';
import { BuildHalfWorkerData, BuildHalfWorkerResult } from './build-half-worker';

// Bundlé UNE FOIS par exécution, réutilisé par les deux fils — le coût
// d'esbuild ne doit jamais entrer dans un temps de construction mesuré.
let cheminBundle: string | null = null;

export async function ensureBuildHalfBundle(): Promise<string> {
  if (cheminBundle && existsSync(cheminBundle)) return cheminBundle;
  const dossier = join(tmpdir(), `sw-forge-build-half-${Date.now()}-${process.pid}`);
  mkdirSync(dossier, { recursive: true });
  cheminBundle = join(dossier, 'build-half-worker.cjs');
  await build({
    entryPoints: ['scripts/lib/build-half-worker.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: cheminBundle,
    logLevel: 'error',
  });
  return cheminBundle;
}

function lancerFil(chemin: string, data: BuildHalfWorkerData): Promise<BuildHalfWorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(chemin, { workerData: data });
    worker.once('message', (msg: BuildHalfWorkerResult) => {
      void worker.terminate();
      resolve(msg);
    });
    worker.once('error', reject);
  });
}

export interface MoitiesConstruites {
  bucketsA: Bucket[];
  bucketsB: Bucket[];
  /** Coût INTERNE à chaque fil — diagnostic, jamais la durée de la phase. */
  msA: number;
  msB: number;
  /** Le temps RÉELLEMENT écoulé pour la phase : c'est lui qui compte. */
  wallMs: number;
}

/**
 * ⚠️ Reproduit la topologie réelle : les deux `Worker` sont lancés AVANT le
 * premier `await`, donc vraiment concurrents. Les créer dans un `await`
 * successif les rendrait séquentiels tout en donnant l'apparence du
 * parallélisme — c'est la précaution que `perf-battery.ts` documente déjà.
 */
export async function construireMoitiesEnParallele(
  prepared: PreparedSearch,
  params: SearchParams,
  chemin: string
): Promise<MoitiesConstruites> {
  const commun = {
    filtered: prepared.filtered,
    distinctKeys: prepared.distinctKeys,
    constrainedKeys: prepared.constrainedKeys,
    retentionKeys: prepared.retentionKeys,
    minEntries: prepared.minEntries,
    bucketCap: prepared.bucketCap,
    jokerCredit: prepared.jokerCredit,
    requiredPieces: prepared.requiredPieces,
    base: prepared.base,
    objectiveKeys: prepared.objectiveKeys,
    // ⚠️ Relayés depuis `params` : sans eux, le worker retomberait sur le
    // défaut interne de `buildBuckets` et ignorerait silencieusement ce que
    // la recette demandait — trou déjà rencontré côté navigateur.
    adaptiveTrancheWeighting: params.adaptiveTrancheWeighting,
    combosOrderMode: params.combosOrderMode,
  };
  const t0 = performance.now();
  const [a, b] = await Promise.all([
    lancerFil(chemin, { ...commun, half: 'A', slotIdxs: [0, 1, 2], otherHalfMaxSets: prepared.maxSetsForA }),
    lancerFil(chemin, { ...commun, half: 'B', slotIdxs: [3, 4, 5], otherHalfMaxSets: prepared.maxSetsForB }),
  ]);
  return { bucketsA: a.buckets, bucketsB: b.buckets, msA: a.ms, msB: b.ms, wallMs: performance.now() - t0 };
}
