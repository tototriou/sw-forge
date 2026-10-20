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
// le même fichier que celui de `perf-battery.ts`, qui appelle la vraie
// construction de production (`construireMoitie`). Ce qui vit ici est
// uniquement le bundling et le spawn — exactement le découpage retenu pour
// l'appariement (`appariementRapideNode.ts` vs `lancerTravailleurNavigateur`),
// où la LOGIQUE est partagée et seule la coquille de plateforme diffère.
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
import { construireMoitiesEmboitees } from '../../src/lib/constructionEmboitee';
// ⚠️ `import type` IMPÉRATIF : `build-half-worker.ts` exécute du code au
// chargement (`workerData`, `parentPort!`) — c'est un point d'entrée de fil,
// jamais un module à importer. Même précaution que perf-battery.ts.
import type { BuildHalfWorkerData, BuildHalfWorkerResult, MemoireMoitie, ProgressionMoitie } from './build-half-worker';

// Bundlé UNE FOIS par exécution, réutilisé par les deux fils — le coût
// d'esbuild ne doit jamais entrer dans un temps de construction mesuré.
let cheminBundle: string | null = null;

export async function ensureBuildHalfBundle(): Promise<string> {
  if (cheminBundle && existsSync(cheminBundle)) return cheminBundle;
  const dossier = join(tmpdir(), `swblacksmith-build-half-${Date.now()}-${process.pid}`);
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
  /**
   * Relevé mémoire de fin de fil — chaque moitié ayant son propre
   * `worker_threads`, donc son propre tas, les deux chiffres ne peuvent pas
   * se confondre. ⚠️ Vaut pour comparer A à B DANS CE PROCESSUS Node,
   * jamais comme prédiction de ce que vit l'utilisateur : le ramasse-miettes
   * de Node n'est pas celui du navigateur.
   */
  memoireA: MemoireMoitie;
  memoireB: MemoireMoitie;
  /**
   * A₂ — les intervalles entre `BuildingProgress`, par moitié.
   * ⚠️ `undefined` quand l'horodatage n'a pas été demandé : c'est un
   * instrument OPT-IN, et son absence est le cas normal.
   */
  progressionA?: ProgressionMoitie;
  progressionB?: ProgressionMoitie;
  /** Le temps RÉELLEMENT écoulé pour la phase : c'est lui qui compte. */
  wallMs: number;
}

/**
 * ⚠️ Reproduit la topologie réelle (`construireMoitiesEmboitees`, le même
 * orchestrateur que `runeBuildOptim.worker.ts`) : un fil par moitié ET par
 * préréglage construit (préréglages emboîtés), tous lancés AVANT le premier
 * `await`, donc vraiment concurrents. Les créer dans un `await` successif
 * les rendrait séquentiels tout en donnant l'apparence du parallélisme —
 * c'est la précaution que `perf-battery.ts` documente déjà. `msA`,
 * `memoireA`, `progressionA` (et B) sont ceux du fil du préréglage de la
 * recherche ; les préréglages plus étroits ne sont jamais horodatés.
 */
export async function construireMoitiesEnParallele(
  prepared: PreparedSearch,
  params: SearchParams,
  chemin: string,
  /**
   * A₂. ⚠️ Par défaut `false` : `perf-battery.ts` n'appelle pas cette
   * coquille, mais le worker qu'elle lance lui est COMMUN — le défaut doit
   * donc être « rien de plus qu'avant », jamais l'inverse.
   */
  horodaterProgression = false
): Promise<MoitiesConstruites> {
  const propres: Partial<Record<'A' | 'B', BuildHalfWorkerResult>> = {};
  const t0 = performance.now();
  // ⚠️ `combosOrderMode` relayé depuis `params` : sans lui, le fil
  // retomberait sur le défaut interne de la construction et ignorerait
  // silencieusement ce que la recette demandait.
  const { bucketsA, bucketsB } = await construireMoitiesEmboitees(prepared, params.combosOrderMode, async (requete) => {
    // Le fil du préréglage de la recherche est celui qui porte le pool entier.
    const propre = requete.filtered === prepared.filtered;
    const r = await lancerFil(chemin, { ...requete, horodaterProgression: horodaterProgression && propre });
    if (propre) propres[requete.half] = r;
    return r.buckets;
  });
  const a = propres.A!;
  const b = propres.B!;
  return {
    bucketsA,
    bucketsB,
    msA: a.ms,
    msB: b.ms,
    memoireA: a.memoire,
    memoireB: b.memoire,
    progressionA: a.progression,
    progressionB: b.progression,
    wallMs: performance.now() - t0,
  };
}
