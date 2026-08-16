// Batterie de cas RÉELS connus, avec suivi persistant des temps mesurés
// (scripts/perf-baseline.json, suivi par git) — pour pouvoir juger l'impact
// d'une modification du moteur (ex. point 4 : pondération adaptative des
// tranches de rétention, voir spec/outils/optimizer/) par un DELTA
// mesuré, pas une impression.
//
// Deux nombres suivis par cas, pas un seul :
// - `foundMs`/`foundExplored` : le temps/les paires écoulés jusqu'au moment
//   où le build CIBLE (le runage réel) apparaît en premier parmi les
//   candidats — c'est la question « à quelle vitesse on le trouve »,
//   PAS « quand la recherche s'arrête » (elle continue après, jusqu'au
//   budget ou au budget-temps, pour rester fidèle au moteur réel).
// - `totalMs`/`totalExplored` : la fin réelle de la recherche (utile pour
//   voir si un changement alourdit ou allège la recherche dans son
//   ensemble, pas seulement la vitesse de découverte).
//
// Chronométré depuis l'ENTRÉE de `prepareSearch` jusqu'à la sortie du
// générateur — inclut donc la construction des deux moitiés
// (`buildBuckets`), pas seulement l'appariement : c'est ce qu'un
// utilisateur attend réellement entre le clic sur « Rechercher » et le
// résultat, et le point 4 (répartition du budget PAR TRANCHE) peut aussi
// influer sur le coût de construction, pas seulement sur l'appariement.
//
// ⚠️ Le temps est dépendant de la MACHINE — cet historique n'a de sens que
// pour des comparaisons RELATIVES (avant/après un changement, sur la même
// machine), jamais comme référence absolue si l'environnement change.
// Chaque cas est rejoué `--repeats` fois (défaut 2), le MINIMUM est retenu
// (le bruit ne peut que RALENTIR une mesure, jamais l'accélérer
// artificiellement) — pas de moyenne, qui laisserait un pic de bruit
// contaminer le résultat retenu.
//
// ⚠️ Chaque mesure tourne dans son PROPRE processus Node (voir `--case=`
// plus bas, mode worker interne) — mesuré directement : enchaîner les 7 cas
// dans un seul processus long fait dériver la mesure d'un facteur ×10 à
// ×27 sur les cas les plus légers (Ciri : <1 s isolé, 27 s enchaîné après
// des cas ayant exploré des centaines de millions de paires) et a fait
// échouer à tort Sonia deck 14 — pression mémoire/GC accumulée, pas un vrai
// ralentissement algorithmique. Coût : le lancement de `npx tsx` par mesure
// (~1-2 s), négligeable face à ce que ça évite. ⚠️ Cette isolation ne se
// PARALLÉLISE PAS pour autant (voir « leçons retenues sur la
// méthodologie de mesure » dans spec/outils/optimizer/) : la contention
// CPU/mémoire entre processus CONCURRENTS fausserait le temps mesuré
// exactement comme le chaînage séquentiel le fait — les 7 cas de CETTE
// batterie de TEMPS restent volontairement séquentiels. Seul
// `--monotonicity` (justesse, pas de temps comparé) est parallélisé. Voir
// le skill `optimizer-perf-testing` pour la boîte à outils complète (quel
// mode utiliser pour quelle question) et `scripts/perf-battery-compare.ts`
// pour un dos-à-dos fiable entre deux versions du code.
//
// ⚠️ `Case`/`CASES`/`loadCase`/`checkMonotonicityForCase` vivent dans
// `scripts/lib/perfShared.ts`, PAS ici — extraits pour que
// `monotonicity-worker.ts` (un `worker_threads`) ne bundle jamais les
// effets de bord de CLI de CE fichier (`process.exit()` en tête, lus au
// chargement du module) en important par erreur depuis perf-battery.ts.
//
// Usage : perf-battery.ts [--repeats=2] [--save]
//   --save : réécrit scripts/perf-baseline.json avec les résultats de cette
//            exécution (à faire une fois un changement accepté, jamais
//            avant de l'avoir comparé à l'ancienne baseline).
//   --case=<index> : mode WORKER interne (voir plus bas) — pas un usage
//            direct, l'orchestrateur se relance lui-même avec ce flag.
//   --monotonicity : mode INDÉPENDANT, PARALLÉLISÉ (voir plus bas) —
//            vérifie, sur les 7 cas connus, que le build cible reste
//            retrouvable à mesure que slotFilterCap grandit
//            (bas→moyen→haut→extrême), PAS seulement à cap=80 comme le
//            reste de cette batterie. Rapide (buildBuckets seul, jamais
//            pairBuckets), pas de baseline — la parallélisation est sans
//            risque ici puisqu'aucun temps n'est comparé. Voir
//            spec/outils/optimizer/, section « BUCKET_CAP mis à
//            l'échelle » pour le bug que cette vérification aurait détecté
//            plus tôt si elle avait existé avant.
//   --quick : mode INDÉPENDANT — 2 cas canari SEULEMENT (Ciri, Lushen d11 —
//            les deux seuls dont `foundMs` reste sous 10 s en temps normal,
//            voir scripts/perf-baseline.json), `maxMs` réduit à 45 s
//            (~5-6× leur temps normal, marge large pour le bruit machine),
//            1 répétition, MÊME processus (pas d'isolation — on ne compare
//            aucun temps précis). Un signal « rien d'évidemment cassé » en
//            quelques secondes, PAS un remplaçant de la batterie complète
//            ni de `--monotonicity` : ces deux cas sont les plus LÉGERS de
//            la batterie (jamais besoin de beaucoup d'escalade) et
//            n'auraient rien pu détecter du bug BUCKET_CAP, qui ne se
//            manifeste que sur des cas plus volumineux ou via
//            `--monotonicity`. Choisis pour l'itération rapide pendant le
//            développement, pas pour la validation avant de committer.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { Worker } from 'worker_threads';
import { build } from 'esbuild';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BuildRequirement,
  SearchParams,
  prepareSearch,
  pairBuckets,
  maybeEscalateNodeBudget,
  NodeBudget,
  Bucket,
} from '../src/lib/runeBuildOptim';
import { Case, CASES, loadCase } from './lib/perfShared';
// ⚠️ `import type` impératif ici : build-half-worker.ts / monotonicity-worker.ts
// exécutent du code au chargement du module (ils LISENT `workerData`, absent
// dans ce processus parent) — un import normal, même pour les seuls types,
// les chargerait et planterait en dehors d'un vrai worker_threads.
import type { BuildHalfWorkerData, BuildHalfWorkerResult } from './lib/build-half-worker';
import type { MonotonicityWorkerResult } from './lib/monotonicity-worker';

export type { Case };
export { CASES };

const REPEATS = Number(process.argv.find((a) => a.startsWith('--repeats='))?.split('=')[1] ?? 2);
const SAVE = process.argv.includes('--save');
// ⚠️ IDENTIQUE à HARD_TIMEOUT_MS (OptimizerSection.tsx) — le vrai filet de
// temps que l'écran utilise, pas une valeur arbitraire plus courte : un
// budget plus court changerait le comportement de l'escalade (moins de
// paliers avant `overBudget()`) et rendrait cette mesure infidèle à ce
// qu'un utilisateur réel obtient.
const MAX_MS = 10 * 60 * 1000;
const BASELINE_PATH = 'scripts/perf-baseline.json';

interface RunResult {
  found: boolean;
  // ⚠️ Total de builds VALIDES retenus à la fin (`res.candidates.length`) —
  // pas seulement « le build cible est-il dedans ». Item 1 (voir spec/
  // outils/optimizer/ « BUCKET_CAP mis à l'échelle ») : `found` seul ne
  // peut PAS détecter qu'une régression a fait perdre la MOITIÉ des
  // résultats tant que le build cible reste par ailleurs présent — c'est
  // exactement ce qui a caché le bug BUCKET_CAP pendant plusieurs relevés.
  // Ce compteur, suivi dans la baseline, rend un tel recul visible même
  // sans que `found` ne bascule à faux.
  foundCount: number;
  // Écoulé depuis le tout début (entrée de `prepareSearch`) — vue globale.
  foundMs: number | null;
  foundExplored: number | null;
  totalMs: number;
  totalExplored: number;
  truncated: boolean;
  // Décomposition par PHASE — pour voir laquelle un changement affecte
  // réellement (ex. le point 4 touche `buildMs`, potentiellement aussi
  // `pairingTotalMs` si des tranches mieux dimensionnées changent l'ordre
  // d'exploration, mais ne devrait jamais changer `prepMs`).
  prepMs: number;
  // Coût INTERNE de chaque moitié, tel que mesuré PAR le fil qui la
  // construit — utile pour voir si A/B sont déséquilibrées, mais PAS le
  // temps réellement attendu par l'utilisateur (voir `buildWallMs`).
  buildAMs: number;
  buildBMs: number;
  // Temps RÉEL écoulé pour la phase de construction dans son ensemble, les
  // deux moitiés tournant EN PARALLÈLE sur deux `worker_threads` (comme les
  // deux Web Workers de l'app réelle, voir buildHalf.worker.ts) — proche de
  // max(buildAMs, buildBMs) plus une marge de démarrage des fils, jamais
  // leur SOMME. C'est CE nombre qui doit entrer dans `totalMs`/`foundMs`.
  buildWallMs: number;
  // Le temps de la SEULE phase d'appariement, sans le prep/build qui la
  // précèdent — complète `foundMs`/`totalMs` (globaux) plutôt que de les
  // remplacer.
  pairingFoundMs: number | null;
  pairingTotalMs: number;
}

// Paramètres RÉELLEMENT utilisés pour cette mesure — pas supposés, lus sur
// `prepared`/`params` après coup. Sert à documenter chaque entrée de la
// baseline avec ce qui a produit ces chiffres, pour qu'un changement de
// constante (BUCKET_CAP, slotFilterCap…) se voie dans le fichier suivi par
// git plutôt que de fausser silencieusement une comparaison future.
interface RunParams {
  slotFilterCap: number;
  maxMsConfigured: number;
  bucketCap: number;
  maxNodesInitial: number;
  objective: string | undefined;
  sets: string[];
  minStats: BuildRequirement['minStats'];
  mainStats: BuildRequirement['mainStats'];
  retentionKeys: string[];
  distinctKeys: string[];
}

interface CaseOutcome {
  result: RunResult;
  params: RunParams | null;
}

// Bundle un script worker en .cjs (un worker_threads a besoin de JS pur, pas
// de TypeScript transpilé à la volée) — même patron que les lanceurs .mjs
// existants (voir monster-search-validate.mjs). Mis en cache sur un chemin
// PROPRE À CETTE EXÉCUTION (dérivé du PID de l'orchestrateur, passé aux
// enfants via `--bundle-dir=`), pas un chemin fixe partagé entre invocations
// séparées : chaque cas de la batterie tourne dans son propre processus Node
// (voir `--case=` plus bas), donc un cache en mémoire de module ne survit
// jamais d'un cas à l'autre — sans CE cache disque, CHAQUE cas payait un
// bundling esbuild complet, un coût absent de tout segment mesuré (ni
// `prepMs` ni `buildWallMs`, tous deux chronométrés en dehors de cette
// fonction) qui ne contaminait donc que `totalMs`/`foundMs` d'un bruit
// variable — observé : +2.6s sur Sonia d14 entre deux baselines au code
// strictement identique.
// ⚠️ **Bug corrigé** : une première version utilisait un chemin FIXE
// (`sw-forge-perf-buildhalf-cache`, sans le PID), invalidé seulement si
// `build-half-worker.ts` LUI-MÊME avait changé — jamais si un fichier qu'il
// IMPORTE (`runeBuildOptim.ts`, bundlé DEDANS par esbuild) changeait. Deux
// mesures dos-à-dos prises pour chiffrer une optimisation de
// `runeBuildOptim.ts` (précalcul par rune, voir « Suite — relecture du
// pipeline ») se sont révélées IDENTIQUES au bit près — repéré en comparant
// les dates du bundle caché (20:19) et du source modifié (20:30, APRÈS le
// bundle) : les deux mesures tournaient sur le MÊME bundle figé, ni l'une ni
// l'autre ne reflétait le vrai code. Un chemin par PID élimine le risque à
// la racine (jamais réutilisé entre deux exécutions à du code différent),
// au prix d'un rebundling une fois par exécution complète de la batterie
// (~1 s) plutôt que jamais — un coût négligeable face au risque de mesures
// silencieusement fausses.
const RUN_ID = process.argv.find((a) => a.startsWith('--bundle-dir='))?.slice('--bundle-dir='.length) ?? String(process.pid);
const BUNDLE_DIR = join(tmpdir(), `sw-forge-perf-bundle-${RUN_ID}`);
async function ensureWorkerBundle(entrySrc: string, outname: string): Promise<string> {
  const outfile = join(BUNDLE_DIR, outname);
  if (existsSync(outfile)) return outfile;
  mkdirSync(BUNDLE_DIR, { recursive: true });
  await build({
    entryPoints: [entrySrc],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'error',
  });
  return outfile;
}
const ensureBuildHalfWorkerBundle = () => ensureWorkerBundle('scripts/lib/build-half-worker.ts', 'build-half-worker.cjs');
const ensureMonotonicityWorkerBundle = () => ensureWorkerBundle('scripts/lib/monotonicity-worker.ts', 'monotonicity-worker.cjs');

function runWorker<TData, TResult>(scriptPath: string, data: TData): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(scriptPath, { workerData: data });
    worker.once('message', (msg: TResult) => {
      worker.terminate();
      resolve(msg);
    });
    worker.once('error', (err) => reject(err));
  });
}

// ── Vérification de MONOTONICITÉ, PARALLÉLISÉE (voir spec/outils/
// optimizer/ « BUCKET_CAP mis à l'échelle ») ────────────────────────────
// Chaque cas dans son propre `worker_threads` (voir monotonicity-worker.ts),
// tous lancés EN MÊME TEMPS — sans risque de précision à protéger : ce mode
// ne mesure aucun temps comparé à une baseline, seulement un verdict de
// justesse (trouvé/perdu), contrairement à la batterie de TEMPS ci-dessous
// qui reste, elle, volontairement séquentielle (voir le commentaire de tête
// du fichier sur la contention CPU/mémoire).
async function runMonotonicityCheck(): Promise<void> {
  console.log(`Vérification de monotonicité — ${CASES.length} cas EN PARALLÈLE, 4 préréglages chacun (bas/moyen/haut/extrême), buildBuckets seul (pas d'appariement).\n`);
  console.log("⚠️ Le build cible doit rester retrouvable à mesure que le pré-filtrage s'élargit — toute case qui passe de 'oui' à 'non' signale une régression.\n");

  const workerScript = await ensureMonotonicityWorkerBundle();
  const outcomes = await Promise.all(
    CASES.map((c) => runWorker<Case, MonotonicityWorkerResult>(workerScript, c))
  );

  let anyRegression = false;
  for (const { label, rows } of outcomes) {
    console.log(label);
    let sawRetained = false;
    for (const r of rows) {
      const retained = r.halfARetained && r.halfBRetained;
      const regressed = sawRetained && !retained;
      if (retained) sawRetained = true;
      if (regressed) anyRegression = true;
      console.log(
        `  ${r.preset.padEnd(7)} (cap=${String(r.cap).padEnd(3)}) bucketCap=${String(r.bucketCap).padEnd(6)} pool=${r.inFilteredPool ? 'oui' : 'non'} moitié A=${r.halfARetained ? 'oui' : 'non'} moitié B=${r.halfBRetained ? 'oui' : 'non'}${regressed ? '  ⚠️ RÉGRESSION (perdu après avoir été retenu à un préréglage plus étroit)' : ''}`
      );
    }
  }
  console.log(anyRegression ? '\n⚠️ Au moins une régression de monotonicité détectée — voir ci-dessus.' : '\nAucune régression de monotonicité détectée sur ces 7 cas.');
}

async function runOnce(c: Case, maxMs: number = MAX_MS): Promise<CaseOutcome> {
  const { gear, allRunes, requirement } = loadCase(c);
  const targetRuneIds = new Set(gear.runes.map((r) => r.id));
  // ⚠️ slotFilterCap=80 explicite : préréglage « Moyen », le défaut réel de
  // l'écran (voir OptimizerSection.tsx) et la valeur utilisée dans TOUTES
  // les mesures Phase 0 — l'omettre retombe sur MAX_PER_SLOT_MATCH=40 (le
  // défaut interne du moteur), un pré-filtrage plus étroit que ce que
  // l'app utilise réellement, faussant toute comparaison.
  const params: SearchParams = { base: gear.base, artifacts: gear.artifacts, relic: gear.relic, pool: allRunes, requirement, metric: 'eff', objective: c.objective, maxMs, slotFilterCap: 80 };

  const t0 = performance.now();
  const prepared = prepareSearch(params);
  const tPrepared = performance.now();
  if (!prepared) {
    return {
      result: {
        found: false,
        foundCount: 0,
        foundMs: null,
        foundExplored: null,
        totalMs: tPrepared - t0,
        totalExplored: 0,
        truncated: false,
        prepMs: tPrepared - t0,
        buildAMs: 0,
        buildBMs: 0,
        buildWallMs: 0,
        pairingFoundMs: null,
        pairingTotalMs: 0,
      },
      params: null,
    };
  }
  const runParams: RunParams = {
    slotFilterCap: params.slotFilterCap!,
    maxMsConfigured: maxMs,
    bucketCap: prepared.bucketCap,
    maxNodesInitial: prepared.maxNodes,
    objective: c.objective,
    sets: requirement.sets,
    minStats: requirement.minStats,
    mainStats: requirement.mainStats,
    retentionKeys: prepared.retentionKeys,
    distinctKeys: prepared.distinctKeys,
  };
  const prepMs = tPrepared - t0;

  // ⚠️ Reproduit EXACTEMENT la topologie réelle (runeBuildOptim.worker.ts) :
  // `Promise.all` sur DEUX `Worker` déjà lancés au moment où `Promise.all`
  // est appelé (les deux `new Worker(...)` s'exécutent avant tout `await`),
  // donc vraiment concurrents — pas l'un après l'autre.
  const workerScript = await ensureBuildHalfWorkerBundle();
  const inputBase = {
    filtered: prepared.filtered,
    distinctKeys: prepared.distinctKeys,
    constrainedKeys: prepared.constrainedKeys,
    retentionKeys: prepared.retentionKeys,
    minEntries: prepared.minEntries,
    bucketCap: prepared.bucketCap,
    jokerCredit: prepared.jokerCredit,
    requiredPieces: prepared.requiredPieces,
  };
  const tBuildStart = performance.now();
  const [outA, outB] = await Promise.all([
    runWorker<BuildHalfWorkerData, BuildHalfWorkerResult>(workerScript, { ...inputBase, half: 'A', slotIdxs: [0, 1, 2], otherHalfMaxSets: prepared.maxSetsForA }),
    runWorker<BuildHalfWorkerData, BuildHalfWorkerResult>(workerScript, { ...inputBase, half: 'B', slotIdxs: [3, 4, 5], otherHalfMaxSets: prepared.maxSetsForB }),
  ]);
  const tBuildB = performance.now();
  const bucketsA: Bucket[] = outA.buckets;
  const bucketsB: Bucket[] = outB.buckets;
  // Coût interne à CHAQUE fil (diagnostic), vs le temps RÉEL écoulé pour la
  // phase dans son ensemble (`buildWallMs`, ce qui compte pour l'utilisateur).
  const buildAMs = outA.ms;
  const buildBMs = outB.ms;
  const buildWallMs = tBuildB - tBuildStart;

  const nodeBudget: NodeBudget = { max: prepared.maxNodes };
  let foundMs: number | null = null;
  let foundExplored: number | null = null;
  let pairingFoundMs: number | null = null;
  const isTarget = (ids: number[]) => ids.length === 6 && ids.every((id) => targetRuneIds.has(id));

  const gen = pairBuckets(prepared, bucketsA, bucketsB, nodeBudget);
  let step = gen.next();
  while (!step.done) {
    const progress = step.value;
    if (foundMs === null && progress.candidates.some((c2) => isTarget(c2.runeIds))) {
      foundMs = performance.now() - t0;
      pairingFoundMs = performance.now() - tBuildB;
      foundExplored = progress.explored;
    }
    const now = Date.now();
    maybeEscalateNodeBudget(nodeBudget, prepared, progress, now);
    step = gen.next();
  }
  const res = step.value;
  const tEnd = performance.now();
  const totalMs = tEnd - t0;
  const pairingTotalMs = tEnd - tBuildB;
  if (foundMs === null && res.candidates.some((c2) => isTarget(c2.runeIds))) {
    foundMs = totalMs;
    pairingFoundMs = pairingTotalMs;
    foundExplored = res.explored;
  }
  return {
    result: {
      found: foundMs !== null,
      foundCount: res.candidates.length,
      foundMs,
      foundExplored,
      totalMs,
      totalExplored: res.explored,
      truncated: res.truncated,
      prepMs,
      buildAMs,
      buildBMs,
      buildWallMs,
      pairingFoundMs,
      pairingTotalMs,
    },
    params: runParams,
  };
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

interface Baseline {
  measuredAt: string;
  repeats: number;
  cases: Record<string, CaseOutcome>;
}

// ── Mode WORKER : une seule mesure, un seul cas, ce processus et rien
// d'autre — imprime le JSON du résultat sur stdout et sort. ──────────────
const caseArg = process.argv.find((a) => a.startsWith('--case='));
if (caseArg) {
  const idx = Number(caseArg.slice('--case='.length));
  const outcome = await runOnce(CASES[idx]);
  process.stdout.write(JSON.stringify(outcome));
  process.exit(0);
}

// ── Mode MONOTONICITÉ : --monotonicity, indépendant du reste (pas de
// mesure de temps, pas de baseline), PARALLÉLISÉ — voir
// runMonotonicityCheck ci-dessus. ─────────────────────────────────────────
if (process.argv.includes('--monotonicity')) {
  await runMonotonicityCheck();
  rmSync(BUNDLE_DIR, { recursive: true, force: true });
  process.exit(0);
}

// ── Mode RAPIDE : --quick, indépendant, 2 cas canari, MÊME processus (pas
// d'isolation — voir le commentaire de tête du fichier). ─────────────────
const QUICK_CASE_LABELS = ['Lushen d11 (tototriou)', 'Ciri defense eq.3 (Enzo)'];
const QUICK_MAX_MS = 45_000;
if (process.argv.includes('--quick')) {
  const quickCases = CASES.filter((c) => QUICK_CASE_LABELS.includes(c.label));
  console.log(
    `Mode rapide — ${quickCases.length} cas canari (${QUICK_MAX_MS / 1000}s de budget, 1 exécution, même processus). ` +
      `Signal « rien d'évidemment cassé », PAS un remplaçant de la batterie complète ni de --monotonicity : ` +
      `ce sont les 2 cas les plus légers de la batterie, choisis pour l'itération rapide en développement.\n`
  );
  for (const c of quickCases) {
    const outcome = await runOnce(c, QUICK_MAX_MS);
    const r = outcome.result;
    console.log(`${c.label} | ${r.found ? 'oui' : 'NON'} | compte=${r.foundCount} | foundMs=${fmtMs(r.foundMs)} | totalMs=${fmtMs(r.totalMs)}${r.truncated ? ' | TRONQUÉ' : ''}`);
  }
  rmSync(BUNDLE_DIR, { recursive: true, force: true });
  process.exit(0);
}

// ── Mode ORCHESTRATEUR : relance CE MÊME fichier via `npx tsx`, une fois
// par répétition, dans un processus FRAIS à chaque fois. ─────────────────
function runCaseIsolated(idx: number): CaseOutcome {
  const runs: CaseOutcome[] = [];
  for (let i = 0; i < REPEATS; i++) {
    // `idx` est un entier borné par CASES.length, `RUN_ID` un PID — tous
    // deux sûrs à interpoler directement. `--bundle-dir=` transmet le
    // répertoire de cache DE CET ORCHESTRATEUR à l'enfant, pour qu'ils
    // bundlent tous dans le MÊME dossier (voir `ensureWorkerBundle`) sans
    // jamais retomber sur un chemin fixe partagé entre exécutions.
    const out = execSync(`npx tsx scripts/perf-battery.ts --case=${idx} --bundle-dir=${RUN_ID}`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    runs.push(JSON.parse(out));
  }
  const results = runs.map((r) => r.result);
  const best = (sel: (r: RunResult) => number | null): number | null => {
    const vals = results.map(sel).filter((v): v is number => v != null);
    return vals.length > 0 ? Math.min(...vals) : null;
  };
  return {
    result: {
      found: results.every((r) => r.found),
      // Déterministe (même pool, même requirement à chaque répétition) : le
      // minimum est une précaution, pas une vraie agrégation nécessaire.
      foundCount: Math.min(...results.map((r) => r.foundCount)),
      foundMs: best((r) => r.foundMs),
      foundExplored: best((r) => r.foundExplored),
      totalMs: best((r) => r.totalMs)!,
      totalExplored: Math.min(...results.map((r) => r.totalExplored)),
      truncated: results[results.length - 1].truncated,
      prepMs: best((r) => r.prepMs)!,
      buildAMs: best((r) => r.buildAMs)!,
      buildBMs: best((r) => r.buildBMs)!,
      buildWallMs: best((r) => r.buildWallMs)!,
      pairingFoundMs: best((r) => r.pairingFoundMs),
      pairingTotalMs: best((r) => r.pairingTotalMs)!,
    },
    // Déterministe (même pool, même requirement) : les répétitions donnent
    // les mêmes paramètres, on garde la dernière plutôt que d'agréger.
    params: runs[runs.length - 1].params,
  };
}

const previous: Baseline | null = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : null;
const current: Baseline = { measuredAt: new Date().toISOString(), repeats: REPEATS, cases: {} };

console.log(`Batterie de perf — ${CASES.length} cas, ${REPEATS} répétition(s) en processus isolés, min retenu.\n`);
console.log(
  ['cas', 'trouvé', 'compte', 'prep', 'buildA (fil)', 'buildB (fil)', 'build réel (parallèle)', 'appariement (jusqu\'à trouvé / total)', 'foundMs global (delta)', 'totalMs global (delta)'].join(
    ' | '
  )
);

for (let idx = 0; idx < CASES.length; idx++) {
  const c = CASES[idx];
  const outcome = runCaseIsolated(idx);
  current.cases[c.label] = outcome;
  const result = outcome.result;
  const prevResult = previous?.cases[c.label]?.result;
  const deltaFound = prevResult?.foundMs != null && result.foundMs != null ? result.foundMs - prevResult.foundMs : null;
  const deltaTotal = prevResult != null ? result.totalMs - prevResult.totalMs : null;
  const foundStr = `${fmtMs(result.foundMs)}${deltaFound != null ? ` (${deltaFound >= 0 ? '+' : ''}${fmtMs(Math.abs(deltaFound))})` : ''}`;
  const totalStr = `${fmtMs(result.totalMs)}${deltaTotal != null ? ` (${deltaTotal >= 0 ? '+' : ''}${fmtMs(Math.abs(deltaTotal))})` : ''}`;
  const pairingStr = `${fmtMs(result.pairingFoundMs)} / ${fmtMs(result.pairingTotalMs)}`;
  // ⚠️ Delta de COMPTE affiché avec le même relief que les temps : un recul
  // (moins de builds valides retenus qu'avant) est le signal qu'aurait dû
  // donner `perf-battery.ts` pendant les relevés BUCKET_CAP précédents —
  // voir foundCount dans RunResult.
  const deltaCount = prevResult != null ? result.foundCount - prevResult.foundCount : null;
  const countStr = `${result.foundCount}${deltaCount != null && deltaCount !== 0 ? ` (${deltaCount > 0 ? '+' : ''}${deltaCount})` : ''}`;
  console.log(
    `${c.label} | ${result.found ? 'oui' : 'NON'} | ${countStr} | ${fmtMs(result.prepMs)} | ${fmtMs(result.buildAMs)} | ${fmtMs(result.buildBMs)} | ${fmtMs(result.buildWallMs)} | ${pairingStr} | ${foundStr} | ${totalStr}`
  );
}

if (SAVE) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(`\nBaseline enregistrée dans ${BASELINE_PATH}.`);
} else if (!previous) {
  console.log(`\nAucune baseline existante (${BASELINE_PATH}) — relancer avec --save pour en créer une.`);
} else {
  console.log(`\nBaseline précédente du ${previous.measuredAt} (${previous.repeats} répétition(s)) — relancer avec --save pour la remplacer.`);
}

// Nettoyage du dossier de bundle propre à CETTE exécution (voir
// `ensureWorkerBundle`) — un chemin par PID évite toute mesure
// silencieusement faussée, mais laisserait sinon un dossier orphelin par
// exécution dans %TEMP% (le même genre d'accumulation déjà nettoyée une
// fois cette session, voir « Suite — investigation de la dérive »).
rmSync(BUNDLE_DIR, { recursive: true, force: true });
