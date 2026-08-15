// Batterie de cas RÉELS connus, avec suivi persistant des temps mesurés
// (scripts/perf-baseline.json, suivi par git) — pour pouvoir juger l'impact
// d'une modification du moteur (ex. point 4 : pondération adaptative des
// tranches de rétention, voir spec/outils/optimizer.md) par un DELTA
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
// (~1-2 s), négligeable face à ce que ça évite.
//
// Usage : perf-battery.ts [--repeats=2] [--save]
//   --save : réécrit scripts/perf-baseline.json avec les résultats de cette
//            exécution (à faire une fois un changement accepté, jamais
//            avant de l'avoir comparé à l'ancienne baseline).
//   --case=<index> : mode WORKER interne (voir plus bas) — pas un usage
//            direct, l'orchestrateur se relance lui-même avec ce flag.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { Worker } from 'worker_threads';
import { build } from 'esbuild';
import { tmpdir } from 'os';
import { join } from 'path';
import { computeStats } from '../src/lib/stats';
import { activeSets } from '../src/lib/effects';
import {
  BuildRequirement,
  SearchParams,
  Objective,
  prepareSearch,
  pairBuckets,
  NodeBudget,
  CHECKPOINT_EVERY,
  Bucket,
} from '../src/lib/runeBuildOptim';
import { loadDeckMonster } from './lib/deckMonster';
// ⚠️ `import type` impératif ici : build-half-worker.ts exécute du code au
// chargement du module (il LIT `workerData`, absent dans ce processus
// parent) — un import normal, même pour les seuls types, le chargerait et
// planterait en dehors d'un vrai worker_threads.
import type { BuildHalfWorkerData, BuildHalfWorkerResult } from './lib/build-half-worker';

interface Case {
  label: string;
  exportPath: string;
  deckId: number;
  monsterName: string;
  defense: boolean;
  statKeys: string[];
  objective: Objective | undefined;
  // Sinon, les sets RÉELLEMENT actifs sur le monstre (le cas courant).
  setsOverride?: string[];
}

// ⚠️ Eivor (défense deck 2, 7 conditions) volontairement ABSENT de cette
// batterie : cas déjà connu comme cassé pour une raison indépendante de
// bucketCap/des tranches (`buildBuckets` dépasse `maxMs` à lui seul, voir
// spec/outils/optimizer.md) — l'inclure ralentirait cette batterie à
// chaque exécution sans mesurer ce qu'on cherche à suivre ici.
const CASES: Case[] = [
  { label: 'Lushen d15 (Rage+Blade, reel)', exportPath: 'ß☆Enzo-6399149.json', deckId: 15, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'degats' },
  { label: 'Lushen d15 (Rage seul, relache)', exportPath: 'ß☆Enzo-6399149.json', deckId: 15, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'degats', setsOverride: ['rage'] },
  { label: 'Lushen d10 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 10, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'degats' },
  { label: 'Lushen d11 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 11, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'degats' },
  { label: 'Sonia d6 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 6, monsterName: 'Sonia', defense: false, statKeys: ['atk', 'spd', 'cr', 'cd'], objective: 'degats' },
  { label: 'Sonia d14 (Enzo)', exportPath: 'ß☆Enzo-6399149.json', deckId: 14, monsterName: 'Sonia', defense: false, statKeys: ['atk', 'cr', 'cd', 'spd'], objective: 'degats' },
  { label: 'Ciri defense eq.3 (Enzo)', exportPath: 'ß☆Enzo-6399149.json', deckId: 32732517, monsterName: 'Ciri', defense: true, statKeys: ['hp', 'def', 'spd', 'acc'], objective: 'ehp' },
];

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

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

// Bundle build-half-worker.ts en .cjs (un worker_threads a besoin de JS pur,
// pas de TypeScript transpilé à la volée) — même patron que les lanceurs
// .mjs existants (voir monster-search-validate.mjs). Mis en cache sur un
// chemin FIXE, pas un dossier temporaire par appel : chaque cas de la
// batterie tourne dans son propre processus Node (voir `--case=` plus bas),
// donc un cache en mémoire de module ne survit jamais d'un cas à l'autre —
// sans ce cache disque, CHAQUE cas payait un bundling esbuild complet, un
// coût absent de tout segment mesuré (ni `prepMs` ni `buildWallMs`, tous
// deux chronométrés en dehors de cette fonction) qui ne contaminait donc que
// `totalMs`/`foundMs` d'un bruit variable — observé : +2.6s sur Sonia d14
// entre deux baselines au code strictement identique.
const BUILD_HALF_BUNDLE_DIR = join(tmpdir(), 'sw-forge-perf-buildhalf-cache');
const BUILD_HALF_SRC = 'scripts/lib/build-half-worker.ts';
async function ensureBuildHalfWorkerBundle(): Promise<string> {
  const outfile = join(BUILD_HALF_BUNDLE_DIR, 'build-half-worker.cjs');
  if (existsSync(outfile) && statSync(outfile).mtimeMs >= statSync(BUILD_HALF_SRC).mtimeMs) {
    return outfile;
  }
  mkdirSync(BUILD_HALF_BUNDLE_DIR, { recursive: true });
  await build({
    entryPoints: [BUILD_HALF_SRC],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'error',
  });
  return outfile;
}

function runBuildHalfWorker(scriptPath: string, data: BuildHalfWorkerData): Promise<BuildHalfWorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(scriptPath, { workerData: data });
    worker.once('message', (msg: BuildHalfWorkerResult) => {
      worker.terminate();
      resolve(msg);
    });
    worker.once('error', (err) => reject(err));
  });
}

async function runOnce(c: Case): Promise<CaseOutcome> {
  const { gear, allRunes } = loadDeckMonster({ exportPath: c.exportPath, deckId: c.deckId, monsterName: c.monsterName, defense: c.defense, rest: [] });
  const targetRuneIds = new Set(gear.runes.map((r) => r.id));
  const realSets = activeSets(gear.runes.map((r) => r.set));
  const targetStats = computeStats(gear);
  const minStats: BuildRequirement['minStats'] = {};
  for (const key of c.statKeys) {
    const row = targetStats.find((r) => r.key === key);
    if (row) (minStats as any)[key] = row.total;
  }
  const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
  for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];
  const requirement: BuildRequirement = { sets: c.setsOverride ?? realSets, minStats, mainStats };
  // ⚠️ slotFilterCap=80 explicite : préréglage « Moyen », le défaut réel de
  // l'écran (voir OptimizerSection.tsx) et la valeur utilisée dans TOUTES
  // les mesures Phase 0 — l'omettre retombe sur MAX_PER_SLOT_MATCH=40 (le
  // défaut interne du moteur), un pré-filtrage plus étroit que ce que
  // l'app utilise réellement, faussant toute comparaison.
  const params: SearchParams = { base: gear.base, artifacts: gear.artifacts, relic: gear.relic, pool: allRunes, requirement, metric: 'eff', objective: c.objective, maxMs: MAX_MS, slotFilterCap: 80 };

  const t0 = performance.now();
  const prepared = prepareSearch(params);
  const tPrepared = performance.now();
  if (!prepared) {
    return {
      result: {
        found: false,
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
    maxMsConfigured: MAX_MS,
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
    runBuildHalfWorker(workerScript, { ...inputBase, half: 'A', slotIdxs: [0, 1, 2], otherHalfMaxSets: prepared.maxSetsForA }),
    runBuildHalfWorker(workerScript, { ...inputBase, half: 'B', slotIdxs: [3, 4, 5], otherHalfMaxSets: prepared.maxSetsForB }),
  ]);
  const tBuildB = performance.now();
  const bucketsA: Bucket[] = outA.buckets;
  const bucketsB: Bucket[] = outB.buckets;
  // Coût interne à CHAQUE fil (diagnostic), vs le temps RÉEL écoulé pour la
  // phase dans son ensemble (`buildWallMs`, ce qui compte pour l'utilisateur).
  const buildAMs = outA.ms;
  const buildBMs = outB.ms;
  const buildWallMs = tBuildB - tBuildStart;

  const ESCALATION_FACTOR = 2;
  const ESCALATION_TIME_SAFETY = 0.95;
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
    if (
      nodeBudget.max - progress.explored <= CHECKPOINT_EVERY &&
      now - prepared.startedAt < prepared.maxMs * ESCALATION_TIME_SAFETY &&
      progress.candidates.length < prepared.maxCollected
    ) {
      nodeBudget.max *= ESCALATION_FACTOR;
    }
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

// ── Mode ORCHESTRATEUR : relance CE MÊME fichier via `npx tsx`, une fois
// par répétition, dans un processus FRAIS à chaque fois. ─────────────────
function runCaseIsolated(idx: number): CaseOutcome {
  const runs: CaseOutcome[] = [];
  for (let i = 0; i < REPEATS; i++) {
    // `idx` est un entier borné par CASES.length, jamais une entrée
    // externe — l'interpolation directe est sûre, pas d'échappement requis.
    const out = execSync(`npx tsx scripts/perf-battery.ts --case=${idx}`, {
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
  ['cas', 'trouvé', 'prep', 'buildA (fil)', 'buildB (fil)', 'build réel (parallèle)', 'appariement (jusqu\'à trouvé / total)', 'foundMs global (delta)', 'totalMs global (delta)'].join(
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
  console.log(
    `${c.label} | ${result.found ? 'oui' : 'NON'} | ${fmtMs(result.prepMs)} | ${fmtMs(result.buildAMs)} | ${fmtMs(result.buildBMs)} | ${fmtMs(result.buildWallMs)} | ${pairingStr} | ${foundStr} | ${totalStr}`
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
