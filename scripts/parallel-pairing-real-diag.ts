// Chantier D, revérifié sous VRAIE concurrence — le script précédent
// (parallel-pairing-quota-diag.ts) simulait les 4 tranches SÉQUENTIELLEMENT
// dans un seul thread Node, ce qui teste la JUSTESSE (le total de
// candidats) mais ne peut RIEN dire sur le coût réel en temps d'une
// coordination inter-workers — et surtout, teste un mécanisme différent de
// celui qui tourne réellement en prod (4 threads concurrents, pas une
// boucle séquentielle). Corrigé ici : 4 VRAIS `worker_threads` Node
// concurrents (`scripts/lib/pairing-quota-worker.ts`, bundlé via esbuild —
// même patron que `pairing-parallel-diag.ts`, déjà utilisé pour la décision
// initiale de paralléliser l'appariement).
//
// Usage : parallel-pairing-real-diag.ts <export.json> <recipe.json>

import { readFileSync } from 'fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadBoxMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import {
  prepareSearch, buildBuckets, pairBuckets, maybeEscalateNodeBudget,
  partitionBucketsALPT, totalPairCount, NodeBudget, Bucket, SearchParams,
} from '../src/lib/runeBuildOptim';
import { PairingQuotaWorkerData, PairingQuotaWorkerMessage } from './lib/pairing-quota-worker';
import { drain } from './lib/drain';

const WORKER_COUNT = 4;

const RUN_ID = `${Date.now()}-${process.pid}`;
const BUNDLE_DIR = join(tmpdir(), `sw-forge-pairing-quota-diag-${RUN_ID}`);
async function ensureWorkerBundle(): Promise<string> {
  const outfile = join(BUNDLE_DIR, 'pairing-quota-worker.cjs');
  if (existsSync(outfile)) return outfile;
  mkdirSync(BUNDLE_DIR, { recursive: true });
  await build({ entryPoints: ['scripts/lib/pairing-quota-worker.ts'], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error' });
  return outfile;
}

function runFixedWorker(scriptPath: string, data: PairingQuotaWorkerData): Promise<{ explored: number; foundCount: number; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(scriptPath, { workerData: data });
    worker.once('message', (msg: PairingQuotaWorkerMessage) => {
      if (msg.type === 'done') {
        worker.terminate();
        resolve(msg);
      }
    });
    worker.once('error', reject);
  });
}

// ── Mode partagé : chaque worker reçoit un plafond GÉNÉREUX (le plafond
// GLOBAL, pas divisé) — le parent totalise via les messages 'progress' déjà
// envoyés à chaque checkpoint, et envoie 'stop' à TOUS les workers encore
// actifs dès que le total cumulé atteint le plafond global. ──
function runSharedWorkers(scriptPath: string, slices: Bucket[][], bucketsB: Bucket[], params: SearchParams, startedAt: number, globalMaxCollected: number): Promise<{ perWorker: number[]; explored: number[] }> {
  return new Promise((resolve, reject) => {
    const perWorker = new Array(slices.length).fill(0);
    const explored = new Array(slices.length).fill(0);
    const done = new Array(slices.length).fill(false);
    let stopSent = false;
    const workers: Worker[] = [];
    let settled = 0;

    function maybeStopAll() {
      const cumulative = perWorker.reduce((s, v) => s + v, 0);
      if (!stopSent && cumulative >= globalMaxCollected) {
        stopSent = true;
        for (let i = 0; i < workers.length; i++) if (!done[i]) workers[i].postMessage('stop');
      }
    }

    slices.forEach((slice, i) => {
      const data: PairingQuotaWorkerData = {
        params: { ...params, maxCollected: globalMaxCollected },
        bucketASlice: slice,
        bucketsB,
        startedAt,
        mode: 'shared',
      };
      const worker = new Worker(scriptPath, { workerData: data });
      workers.push(worker);
      worker.on('message', (msg: PairingQuotaWorkerMessage) => {
        perWorker[i] = msg.foundCount;
        explored[i] = msg.explored;
        if (msg.type === 'progress') {
          maybeStopAll();
        } else {
          done[i] = true;
          worker.terminate();
          settled++;
          if (settled === slices.length) resolve({ perWorker, explored });
        }
      });
      worker.once('error', reject);
    });
  });
}

async function main() {
  const [exportPath, recipePath] = process.argv.slice(2);
  if (!exportPath || !recipePath) {
    console.error('Usage: parallel-pairing-real-diag.ts <export.json> <recipe.json>');
    process.exit(1);
  }
  const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
  if (!recipe) { console.error(error); process.exit(1); }

  const loaded = loadBoxMonster(exportPath, recipe.monsterName);
  printMonsterSummary('box', loaded);
  const params = recipeToSearchParams(recipe, loaded);

  const workerScript = await ensureWorkerBundle();

  try {
    const prepared0 = prepareSearch(params);
    if (!prepared0) { console.error('infaisable'); process.exit(1); }
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared0.filtered, prepared0.distinctKeys, prepared0.constrainedKeys, prepared0.retentionKeys, prepared0.minEntries, prepared0.bucketCap, prepared0.maxSetsForA, prepared0.jokerCredit, prepared0.requiredPieces, undefined, params.adaptiveTrancheWeighting, params.combosOrderMode));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared0.filtered, prepared0.distinctKeys, prepared0.constrainedKeys, prepared0.retentionKeys, prepared0.minEntries, prepared0.bucketCap, prepared0.maxSetsForB, prepared0.jokerCredit, prepared0.requiredPieces, undefined, params.adaptiveTrancheWeighting, params.combosOrderMode));
    const totalPairs = totalPairCount(prepared0, bucketsA, bucketsB);
    console.log(`\ncompartiments A : ${bucketsA.length} — compartiments B : ${bucketsB.length} — totalPairs : ${totalPairs.toLocaleString('fr-FR')}`);

    const globalMaxCollected = params.maxCollected ?? 100_000;

    // ── 1. Séquentiel (référence, thread principal, vraie escalade) ──
    const preparedSeq = prepareSearch(params)!;
    const seqBudget: NodeBudget = { max: preparedSeq.maxNodes };
    const t1 = performance.now();
    const seqGen = pairBuckets(preparedSeq, bucketsA, bucketsB, seqBudget);
    let seqStep = seqGen.next();
    while (!seqStep.done) {
      maybeEscalateNodeBudget(seqBudget, preparedSeq, seqStep.value, Date.now());
      seqStep = seqGen.next();
    }
    const seqResult = seqStep.value;
    const seqMs = performance.now() - t1;
    console.log(`\n1. SÉQUENTIEL (référence) — ${seqResult.candidates.length} candidats, ${seqResult.explored.toLocaleString('fr-FR')} explorés, ${seqMs.toFixed(0)}ms`);

    const slices = partitionBucketsALPT(bucketsA, Math.min(WORKER_COUNT, bucketsA.length));
    const perWorkerMaxCollected = Math.max(1, Math.ceil(globalMaxCollected / slices.length));
    console.log(`\nPartition LPT (${slices.length} tranches) — tailles : ${slices.map((s) => s.reduce((n, b) => n + b.combos.length, 0)).join(', ')}`);

    // ── 2. Parallèle ACTUEL — VRAIS worker_threads concurrents, part égale ──
    const startedAt2 = Date.now();
    const t2 = performance.now();
    const fixedResults = await Promise.all(
      slices.map((slice) =>
        runFixedWorker(workerScript, {
          params: { ...params, maxCollected: perWorkerMaxCollected },
          bucketASlice: slice,
          bucketsB,
          startedAt: startedAt2,
          mode: 'fixed',
        })
      )
    );
    const fixedMs = performance.now() - t2;
    const fixedTotal = fixedResults.reduce((s, r) => s + r.foundCount, 0);
    console.log(`\n2. PARALLÈLE ACTUEL (VRAIS workers concurrents, part égale ${perWorkerMaxCollected}/tranche) — ${fixedMs.toFixed(0)}ms réelles (mur)`);
    fixedResults.forEach((r, i) => console.log(`   tranche ${i} : ${r.foundCount} candidats, ${r.explored.toLocaleString('fr-FR')} explorés, truncated=${r.truncated}`));
    console.log(`   TOTAL : ${fixedTotal} candidats`);

    // ── 3. Parallèle QUOTA PARTAGÉ — VRAIS worker_threads concurrents ──
    const startedAt3 = Date.now();
    const t3 = performance.now();
    const shared = await runSharedWorkers(workerScript, slices, bucketsB, params, startedAt3, globalMaxCollected);
    const sharedMs = performance.now() - t3;
    const sharedTotal = shared.perWorker.reduce((s, v) => s + v, 0);
    console.log(`\n3. PARALLÈLE QUOTA PARTAGÉ (VRAIS workers concurrents, coordination par messages) — ${sharedMs.toFixed(0)}ms réelles (mur)`);
    shared.perWorker.forEach((n, i) => console.log(`   tranche ${i} : ${n} candidats, ${shared.explored[i].toLocaleString('fr-FR')} explorés`));
    console.log(`   TOTAL : ${sharedTotal} candidats`);

    console.log(`\n=== Bilan ===`);
    console.log(`Séquentiel (référence)         : ${seqResult.candidates.length} candidats — ${seqMs.toFixed(0)}ms (1 seul thread, pas comparable en temps)`);
    console.log(`Parallèle actuel (part égale)   : ${fixedTotal} candidats (${((fixedTotal / seqResult.candidates.length) * 100).toFixed(1)}%) — ${fixedMs.toFixed(0)}ms réelles`);
    console.log(`Parallèle quota partagé         : ${sharedTotal} candidats (${((sharedTotal / seqResult.candidates.length) * 100).toFixed(1)}%) — ${sharedMs.toFixed(0)}ms réelles`);
    console.log(`Delta de temps (partagé vs actuel) : ${(sharedMs - fixedMs).toFixed(0)}ms (${(((sharedMs - fixedMs) / fixedMs) * 100).toFixed(1)}%)`);
  } finally {
    rmSync(BUNDLE_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  rmSync(BUNDLE_DIR, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
