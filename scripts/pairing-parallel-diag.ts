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
import { drain } from './lib/drain';

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

const MAX_WORKERS = cpus().length;
const WORKER_COUNTS = [1, 2, 4, 8].filter((n) => n <= MAX_WORKERS);

// ⚠️ Deuxième itération de ce prototype. La première comparait à budget de
// paires FIXE (100M) — ce qui, pour les cas dont le total réel dépasse ce
// plafond (Sonia d14), mesurait en fait une recherche TRONQUÉE : régime déjà
// prouvé risqué (voir pistes.md, « point 9 », round-robin par rang ET
// équilibrage par charge perdent tous les deux des candidats valides sous
// troncature). Le mode visé ici (« Rechercher jusqu'à épuisement complet »)
// n'a PAR DÉFINITION aucun plafond — donc aucun risque de troncature, quel
// que soit le découpage. Mesure corrigée : nodeBudget INFINI pour N=1 ET
// pour chaque worker à N>1 (vraie complétion, pas une approximation
// plafonnée), sur les 7 cas connus au préréglage Bas (cap=40 — le plus
// rapide à atteindre l'épuisement réel, seul moyen de couvrir les 7 cas en
// un temps de diagnostic raisonnable).
const DIAG_CASES = CASES;
const SLOT_FILTER_CAP = 40; // préréglage « Bas »

async function main() {
  console.log(`Machine : ${MAX_WORKERS} cœurs logiques détectés (os.cpus().length). Aucun plafond de paires — vraie complétion à chaque essai, préréglage Bas (cap=${SLOT_FILTER_CAP}).\n`);
  const workerScript = await ensureWorkerBundle();

  for (const c of DIAG_CASES) {
    const { gear, allRunes, requirement } = loadCase(c);
    // ⚠️ Fidélité vérifiée contre le vrai appel de production
    // (`OptimizerSection.tsx`, `handleSearch`) : PAS de `maxCollected` ici,
    // volontairement — la prod ne le passe JAMAIS, même en mode exhaustif
    // (`exhaustiveSearch` ne touche QUE `maxMs`, décision actée), donc le
    // défaut réel `MAX_COLLECTED=100 000` doit s'appliquer tel quel. Une
    // première version de ce script le forçait à `MAX_SAFE_INTEGER` — un
    // vrai écart de fidélité, pas un détail (voir le skill
    // `optimizer-perf-testing`/section « Fidélité des scripts diagnostics »
    // d'`algo-verify`). `adaptiveTrancheWeighting` explicite à `false` pour
    // la même raison : ce prototype ne teste PAS ce réglage, jamais implicite.
    // `maxMs` reste infini : seul champ que `exhaustiveSearch` fait
    // réellement varier en prod, donc le seul qu'on a le droit de diverger
    // du défaut d'écran ici.
    const params: SearchParams = {
      base: gear.base,
      artifacts: gear.artifacts,
      relic: gear.relic,
      pool: allRunes,
      requirement,
      metric: 'eff',
      objective: c.objective,
      slotFilterCap: SLOT_FILTER_CAP,
      maxMs: Number.POSITIVE_INFINITY,
      adaptiveTrancheWeighting: false,
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
    let baselineFound = -1;
    for (const n of WORKER_COUNTS) {
      const t0 = performance.now();
      let explored = 0;
      let found = 0;
      if (n === 1) {
        const nodeBudget: NodeBudget = { max: Number.POSITIVE_INFINITY };
        const res = drain(pairBuckets(prepared, bucketsA, bucketsB, nodeBudget));
        explored = res.explored;
        found = res.candidates.length;
      } else {
        // Mode exhaustif = aucun plafond, donc aucun risque de troncature
        // quel que soit le découpage — l'ordre par potentiel décroissant
        // (qui protège les recherches TRONQUÉES) n'a plus d'importance ici.
        // Équilibrage GLOUTON par charge réelle (LPT) retenu pour le temps
        // MUR (moins de traînards), chaque worker reçoit un budget INFINI
        // (rien à répartir : chacun va simplement au bout de sa tranche).
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
        const results = await Promise.all(
          slices.map((slice) => runWorker(workerScript, { params, bucketASlice: slice, bucketsB, nodeBudgetMax: Number.POSITIVE_INFINITY }))
        );
        explored = results.reduce((s, r) => s + r.explored, 0);
        found = results.reduce((s, r) => s + r.foundCount, 0);
      }
      const ms = performance.now() - t0;
      if (n === 1) {
        baselineMs = ms;
        baselineFound = found;
      }
      const speedup = baselineMs > 0 ? baselineMs / ms : 1;
      const mismatch = found !== baselineFound ? '  ⚠️ DIVERGENCE vs N=1' : '';
      console.log(`  N=${String(n).padEnd(2)} : ${ms.toFixed(0).padStart(7)} ms   explored=${explored.toLocaleString('fr-FR').padStart(12)}   trouvés=${found.toString().padStart(6)}   accélération=×${speedup.toFixed(2)}${mismatch}`);
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
