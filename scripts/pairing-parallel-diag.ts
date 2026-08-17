// Mesure si paralléliser la boucle d'APPARIEMENT (au-delà des 2 Workers déjà
// utilisés pour la CONSTRUCTION, voir spec/outils/optimizer/pistes.md,
// « point 9 ») réduit réellement le temps mur — avant de choisir un nombre
// de Workers par défaut, ou d'exposer quoi que ce soit à l'écran.
//
// ⚠️ Aucun SharedArrayBuffer disponible aujourd'hui (vérifié : ni
// vercel.json ni vite.config.ts ne posent d'en-têtes COOP/COEP) — chaque
// worker reçoit donc une VRAIE COPIE de sa tranche de bucketsA ET de la
// totalité de bucketsB (postMessage = clonage structuré), pas un pointeur
// partagé. Ce coût de transfert est INCLUS dans le temps mesuré, pas ignoré
// — c'est justement la question à trancher : le gain de calcul dépasse-t-il
// ce coût de copie ?
//
// ⚠️ Budget de paires FIXE, pas d'escalade coordonnée entre workers : ce
// prototype répond à UNE question (le débit brut parallélise-t-il ?), pas à
// la question distincte de coordonner un budget partagé/adaptatif entre N
// workers — à concevoir SI ce prototype montre un vrai gain.
import { cpus } from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { CASES, loadCase } from './lib/perfShared';
import { prepareSearch, buildBuckets, pairBuckets, SearchParams, Bucket, NodeBudget } from '../src/lib/runeBuildOptim';
import { PairingWorkerData, PairingWorkerResult } from './lib/pairing-worker';

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

// ── Bundling du worker, même patron que perf-battery.ts (répertoire par
// RUN_ID pour ne jamais servir un bundle figé si la source a changé depuis —
// voir « Suite — point 1 implémenté et mesuré », le bug de cache vécu). ──
const RUN_ID = `${Date.now()}-${process.pid}`;
const BUNDLE_DIR = join(tmpdir(), `sw-forge-pairing-diag-${RUN_ID}`);
async function ensureWorkerBundle(): Promise<string> {
  const outfile = join(BUNDLE_DIR, 'pairing-worker.cjs');
  if (existsSync(outfile)) return outfile;
  mkdirSync(BUNDLE_DIR, { recursive: true });
  await build({ entryPoints: ['scripts/lib/pairing-worker.ts'], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error' });
  return outfile;
}
function runWorker(scriptPath: string, data: PairingWorkerData): Promise<PairingWorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(scriptPath, { workerData: data });
    worker.once('message', (msg: PairingWorkerResult) => {
      worker.terminate();
      resolve(msg);
    });
    worker.once('error', reject);
  });
}

const TOTAL_BUDGET = 100_000_000; // même budget TOTAL quel que soit N, pour comparer à travail égal.
const MAX_WORKERS = cpus().length;
const WORKER_COUNTS = [1, 2, 4, 8].filter((n) => n <= MAX_WORKERS);

// Cas choisis pour ce prototype : représentatifs (un serré, un plus lâche),
// au préréglage Moyen (construction rapide, on isole le temps d'APPARIEMENT).
const DIAG_CASES = CASES.filter((c) => c.label.includes('Lushen d11') || c.label.includes('Sonia d14'));

async function main() {
  console.log(`Machine : ${MAX_WORKERS} cœurs logiques détectés (os.cpus().length). Budget total fixe par essai : ${TOTAL_BUDGET.toLocaleString('fr-FR')} paires.\n`);
  const workerScript = await ensureWorkerBundle();

  for (const c of DIAG_CASES) {
    const { gear, allRunes, requirement } = loadCase(c);
    // ⚠️ maxMs/maxCollected LAISSÉS À LEUR DÉFAUT (DEFAULT_MAX_MS=15s,
    // MAX_COLLECTED=100 000) faussaient silencieusement la mesure — un essai
    // pouvait être tronqué par l'UN OU L'AUTRE sans jamais toucher au
    // nodeBudget qu'on croyait être le SEUL frein. Rendus infinis
    // explicitement : seul nodeBudget.max (contrôlé ci-dessous) doit pouvoir
    // arrêter un essai, pour comparer les N à budget de PAIRES égal, pas un
    // mélange de budgets différents selon la vitesse de chaque essai.
    const params: SearchParams = {
      base: gear.base,
      artifacts: gear.artifacts,
      relic: gear.relic,
      pool: allRunes,
      requirement,
      metric: 'eff',
      objective: c.objective,
      slotFilterCap: 80,
      maxMs: Number.POSITIVE_INFINITY,
      maxCollected: Number.MAX_SAFE_INTEGER,
    };
    const prepared = prepareSearch(params);
    if (!prepared) {
      console.log(`${c.label} : pool vide après filtrage, ignoré`);
      continue;
    }
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces));
    console.log(`=== ${c.label} (bucketCap=${prepared.bucketCap}, |bucketsA|=${bucketsA.length}, |bucketsB|=${bucketsB.length}) ===`);

    let baselineMs = 0;
    for (const n of WORKER_COUNTS) {
      const t0 = performance.now();
      let explored = 0;
      let found = 0;
      if (n === 1) {
        const nodeBudget: NodeBudget = { max: TOTAL_BUDGET };
        const res = drain(pairBuckets(prepared, bucketsA, bucketsB, nodeBudget));
        explored = res.explored;
        found = res.candidates.length;
      } else {
        // ⚠️ Round-robin par RANG (première version) donnait un budget ÉGAL
        // à des tranches de travail INÉGALES (un compartiment peut contenir
        // jusqu'à bucketCap² paires brutes, un autre bien moins) — un worker
        // pouvait s'arrêter AU MILIEU d'un compartiment disproportionné,
        // là où le séquentiel ne se serait jamais arrêté à cet endroit précis.
        // Corrigé en DEUX temps : (1) répartition GLOUTONNE par charge réelle
        // (nombre de combos, LPT — Longest Processing Time first : les plus
        // gros compartiments d'abord, toujours au worker le moins chargé),
        // pas par rang ; (2) budget PROPORTIONNEL à la charge assignée à
        // CHAQUE worker, pas un partage égal aveugle — pour que le point
        // d'arrêt de chaque worker corresponde à la même PROFONDEUR relative
        // que le séquentiel aurait atteinte dans ce même sous-ensemble.
        const withWorkload = bucketsA.map((b) => ({ b, workload: b.combos.length }));
        withWorkload.sort((a, b) => b.workload - a.workload);
        const slices: Bucket[][] = Array.from({ length: n }, () => []);
        const sliceWorkload = new Array(n).fill(0);
        for (const { b, workload } of withWorkload) {
          let target = 0;
          for (let i = 1; i < n; i++) if (sliceWorkload[i] < sliceWorkload[target]) target = i;
          slices[target].push(b);
          sliceWorkload[target] += workload;
        }
        const totalWorkload = sliceWorkload.reduce((s, w) => s + w, 0);
        const results = await Promise.all(
          slices.map((slice, i) => {
            const share = totalWorkload > 0 ? sliceWorkload[i] / totalWorkload : 1 / n;
            const nodeBudgetMax = Math.max(1, Math.round(TOTAL_BUDGET * share));
            return runWorker(workerScript, { params, bucketASlice: slice, bucketsB, nodeBudgetMax });
          })
        );
        explored = results.reduce((s, r) => s + r.explored, 0);
        found = results.reduce((s, r) => s + r.foundCount, 0);
      }
      const ms = performance.now() - t0;
      if (n === 1) baselineMs = ms;
      const speedup = baselineMs > 0 ? baselineMs / ms : 1;
      console.log(`  N=${String(n).padEnd(2)} : ${ms.toFixed(0).padStart(6)} ms   explored=${explored.toLocaleString('fr-FR').padStart(12)}   trouvés=${found.toString().padStart(6)}   accélération=×${speedup.toFixed(2)}`);
    }
    console.log('');
  }

  rmSync(BUNDLE_DIR, { recursive: true, force: true });
}

main().catch((err) => {
  rmSync(BUNDLE_DIR, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
