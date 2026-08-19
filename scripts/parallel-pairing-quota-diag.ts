// Chantier D (voir spec/outils/optimizer/pistes.md et historique-
// acceleration-et-outillage.md) — mesure si la répartition ÉGALE du plafond
// de candidats entre workers de pairing parallèle (`perWorkerMaxCollected =
// maxCollected / workerCount`, runeBuildOptim.worker.ts:220) perd des
// candidats au total sous un déséquilibre RÉEL de productivité entre
// tranches — `partitionBucketsALPT` équilibre par TAILLE de compartiment
// (combos.length), jamais par le taux de paires qui passent réellement les
// tests (sets/minStats/maxStats).
//
// Fidélité : réutilise le VRAI pipeline (prepareSearch → buildBuckets ×2 →
// partitionBucketsALPT → pairBuckets avec maybeEscalateNodeBudget), jamais
// une réimplémentation — voir le skill algo-verify, section « Fidélité des
// scripts diagnostics ». Chaque tranche simulée reconstruit sa PROPRE
// PreparedSearch (piège déjà documenté dans optimizer-perf-testing : un
// `prepared` partagé entre tranches traitées séquentiellement fausse
// `overBudget()`).
//
// Biais de productivité PROVOQUÉ délibérément (pas laissé au hasard) : les
// runes du set 'violent' ont un VIT élevé (rapide), les autres sets un VIT
// bas (lent). `maxStats.spd` bas élimine disproportionnellement les combos
// tirant sur 'violent' — les compartiments qui en dépendent ont un taux de
// réussite bien plus faible que les autres, créant l'inégalité de
// productivité que `partitionBucketsALPT` (qui équilibre par TAILLE, pas
// par ce taux) ne peut pas voir.
//
// Trois configurations comparées, MÊME scénario, MÊME maxCollected global :
//   1. Séquentiel (référence) — un seul pairBuckets, budget global entier.
//   2. Parallèle ACTUEL — partition LPT + part ÉGALE du plafond par tranche
//      (reproduction fidèle de runParallelPairing).
//   3. Parallèle QUOTA PARTAGÉ (prototype) — même partition, mais les
//      tranches sont pilotées EN ROUND-ROBIN (approxime la concurrence
//      réelle) et s'arrêtent TOUTES dès que le total CUMULÉ atteint le
//      plafond global — approxime un partage "mou" via les messages de
//      progression déjà existants (pas de SharedArrayBuffer, indisponible
//      aujourd'hui, voir pairSlice.worker.ts).
//
// Usage : parallel-pairing-quota-diag.ts [maxCollected=2000] [maxMsPerSlice=30000]

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import {
  BuildRequirement,
  SearchParams,
  buildBuckets,
  prepareSearch,
  partitionBucketsALPT,
  pairBuckets,
  maybeEscalateNodeBudget,
  Bucket,
  BuildCandidate,
  NodeBudget,
} from '../src/lib/runeBuildOptim';
import { drain } from './lib/drain';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SET_KEYS = ['violent', 'swift', 'will', 'shield', 'fight'];
const STAT_CODES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

// ⚠️ Biais délibéré : 'violent' = VIT élevé (rapide), le reste = VIT bas —
// voir l'en-tête du fichier pour pourquoi ce lien set→productivité crée le
// déséquilibre qu'on veut mesurer.
function randomRune(id: number, slot: number, rng: () => number): RuneDetail {
  const set = SET_KEYS[Math.floor(rng() * SET_KEYS.length)];
  const fast = set === 'violent';
  const mainCode = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
  const used = new Set([mainCode]);
  const subs: EffectLine[] = [];
  for (let i = 0; i < 4; i++) {
    let code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
    let tries = 0;
    while (used.has(code) && tries < 10) {
      code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
      tries++;
    }
    used.add(code);
    // Code 8 = VIT plat — biaisé par `fast` ; les autres stats, non biaisées.
    const value = code === 8 ? (fast ? 20 + Math.floor(rng() * 20) : Math.floor(rng() * 8)) : 5 + Math.floor(rng() * 30);
    subs.push({ code, value });
  }
  return { id, slot, set, rank: 6, rarity: 5, level: 15, main: { code: mainCode, value: 10 + Math.floor(rng() * 40) }, subs };
}

function randomPool(rng: () => number, perSlot: number): RuneDetail[] {
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) for (let i = 0; i < perSlot; i++) out.push(randomRune(id++, slot, rng));
  return out;
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const WORKER_COUNT = 4;

const argv = process.argv.slice(2);
const MAX_COLLECTED = argv[0] ? Number(argv[0]) : 2000;
const MAX_MS_PER_SLICE = argv[1] ? Number(argv[1]) : 30_000; // réaliste — voir algo-verify méthode point 2

const rng = mulberry32(424242);
const pool = randomPool(rng, 400); // "Extrême" (slotFilterCap=300) et au-delà — échelle réelle
// ⚠️ `sets: []` collapse TOUS les combos dans un SEUL compartiment
// (bucketKeyOf n'a alors rien à distinguer) — constaté en 1re tentative.
// `sets: ['will']` SEUL produit exactement 4 compartiments — pile le
// nombre de workers (PARALLEL_PAIRING_WORKERS=4), donc LPT donne un
// compartiment PROPRE à chacun : le cas IDÉAL, pas celui qui dilue la
// productivité. Deux sets demandés (compte de pièces 'will' ET 'fight'
// combinés) multiplient la dimensionnalité des compartiments, forçant LPT
// à en REGROUPER plusieurs par tranche — la condition nécessaire au
// scénario de défaillance décrit par la revue.
const requirement: BuildRequirement = { sets: ['will', 'fight'], minStats: {}, maxStats: { spd: 150 } };
const params: SearchParams = { base: BASE, artifacts: [], pool, requirement, metric: 'eff', slotFilterCap: 300, maxMs: MAX_MS_PER_SLICE, maxCollected: MAX_COLLECTED };

const prepared0 = prepareSearch(params);
if (!prepared0) {
  console.error('prepareSearch a échoué — scénario infaisable, ajuster les paramètres.');
  process.exit(1);
}
const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared0, prepared0.maxSetsForA));
const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared0, prepared0.maxSetsForB));

console.log(`Scénario : ${bucketsA.length} compartiments A (tailles : ${bucketsA.map((b) => b.combos.length).join(', ')}), ${bucketsB.length} compartiments B.`);

// ── Diagnostic : taux de réussite RÉEL par compartiment A (échantillon des
// 200 premiers combos × tous les B), pour CONFIRMER le déséquilibre avant
// d'interpréter le reste — pas juste espérer qu'il existe. ──
function sampleYield(bA: Bucket): { sampled: number; passed: number } {
  let sampled = 0, passed = 0;
  const sampleCombos = bA.combos.slice(0, 200);
  for (const comboA of sampleCombos) {
    for (const bB of bucketsB) {
      for (const comboB of bB.combos.slice(0, 50)) {
        sampled++;
        // Vérification RAPIDE (mêmes seuils que quickOk dans pairBuckets) —
        // approximation suffisante pour un diagnostic de yield relatif.
        const spd = (comboA.pct['spd'] ?? 0) + (comboB.pct['spd'] ?? 0) + (comboA.flat['spd'] ?? 0) + (comboB.flat['spd'] ?? 0) + BASE.spd;
        if (spd <= 150) passed++;
      }
    }
  }
  return { sampled, passed };
}
for (const bA of bucketsA) {
  const { sampled, passed } = sampleYield(bA);
  console.log(`  compartiment (${bA.combos.length} combos) — échantillon ${sampled} paires, taux de réussite ≈ ${((passed / sampled) * 100).toFixed(1)}%`);
}

// ── 1. Séquentiel — référence ──
// ⚠️ `prepared0` a servi à CONSTRUIRE les compartiments (buildBuckets ×2)
// PUIS au diagnostic sampleYield ci-dessus — son `startedAt` (figé au tout
// début du script) a déjà grignoté une partie de `maxMs` avant même que
// `pairBuckets` démarre ici (constaté : avec 10 compartiments, ce travail
// préalable peut à lui seul dépasser 30 s, faisant "truncated" au 1er pas).
// `runSlice`/`runSlicesSharedQuota` ci-dessous appellent CHACUN leur propre
// `prepareSearch` juste avant leur `pairBuckets` (horloge fraîche) — pour
// une comparaison à armes égales, la référence séquentielle a besoin de la
// même fraîcheur (filtrage déterministe, donc rejouer prepareSearch produit
// les MÊMES compartiments, seul `startedAt` change).
const preparedSeq = prepareSearch(params)!;
const seqBudget: NodeBudget = { max: preparedSeq.maxNodes };
const seqGen = pairBuckets(preparedSeq, bucketsA, bucketsB, seqBudget);
let seqStep = seqGen.next();
while (!seqStep.done) {
  maybeEscalateNodeBudget(seqBudget, preparedSeq, seqStep.value, Date.now());
  seqStep = seqGen.next();
}
const seqResult = seqStep.value;
console.log(`\n1. SÉQUENTIEL (référence) — ${seqResult.candidates.length} candidats, ${seqResult.explored.toLocaleString('fr-FR')} explorés, truncated=${seqResult.truncated}`);

// ── 2. Parallèle ACTUEL — reproduction fidèle de runParallelPairing ──
const slices = partitionBucketsALPT(bucketsA, Math.min(WORKER_COUNT, bucketsA.length));
const perWorkerMaxCollected = Math.max(1, Math.ceil(MAX_COLLECTED / slices.length));
console.log(`\nPartition LPT (${slices.length} tranches) — tailles : ${slices.map((s) => s.reduce((n, b) => n + b.combos.length, 0)).join(', ')}`);

function runSlice(bucketASlice: Bucket[], maxCollectedForSlice: number): { candidates: BuildCandidate[]; explored: number; truncated: boolean } {
  // ⚠️ prepareSearch RECONSTRUIT ici, indépendamment — même piège déjà
  // documenté dans optimizer-perf-testing (un `prepared` partagé entre
  // tranches traitées séquentiellement fausse le budget-temps).
  const sliceParams: SearchParams = { ...params, maxCollected: maxCollectedForSlice };
  const prepared = prepareSearch(sliceParams)!;
  const nodeBudget: NodeBudget = { max: prepared.maxNodes };
  const gen = pairBuckets(prepared, bucketASlice, bucketsB, nodeBudget);
  let step = gen.next();
  while (!step.done) {
    maybeEscalateNodeBudget(nodeBudget, prepared, step.value, Date.now());
    step = gen.next();
  }
  return step.value;
}

const t2 = Date.now();
const currentResults = slices.map((slice) => runSlice(slice, perWorkerMaxCollected));
const currentTotal = currentResults.reduce((s, r) => s + r.candidates.length, 0);
const currentTruncated = currentResults.some((r) => r.truncated);
console.log(`2. PARALLÈLE ACTUEL (part égale, ${perWorkerMaxCollected}/tranche) — ${currentTotal} candidats au total, truncated=${currentTruncated} (${Date.now() - t2}ms, séquentiel dans ce script — pas une mesure de temps réel multi-cœur)`);
currentResults.forEach((r, i) => console.log(`   tranche ${i} : ${r.candidates.length} candidats, truncated=${r.truncated}`));

// ── 3. Parallèle QUOTA PARTAGÉ — round-robin, arrêt sur le total CUMULÉ ──
function runSlicesSharedQuota(bucketSlices: Bucket[][], globalMaxCollected: number): { totals: number[]; truncated: boolean[] } {
  const gens = bucketSlices.map((slice) => {
    const sliceParams: SearchParams = { ...params, maxCollected: globalMaxCollected }; // plafond INDIVIDUEL généreux, le vrai arrêt vient du total partagé
    const prepared = prepareSearch(sliceParams)!;
    const nodeBudget: NodeBudget = { max: prepared.maxNodes };
    return { gen: pairBuckets(prepared, slice, bucketsB, nodeBudget), prepared, nodeBudget, done: false, count: 0, truncated: false };
  });
  let cumulative = 0;
  while (cumulative < globalMaxCollected && gens.some((g) => !g.done)) {
    for (const g of gens) {
      if (g.done) continue;
      const step = g.gen.next();
      if (step.done) {
        g.done = true;
        g.count = step.value.candidates.length;
        g.truncated = step.value.truncated;
        continue;
      }
      maybeEscalateNodeBudget(g.nodeBudget, g.prepared, step.value, Date.now());
      g.count = step.value.candidates.length;
      cumulative = gens.reduce((s, x) => s + x.count, 0);
      if (cumulative >= globalMaxCollected) break;
    }
  }
  return { totals: gens.map((g) => g.count), truncated: gens.map((g) => g.truncated || cumulative >= globalMaxCollected) };
}

const t3 = Date.now();
const shared = runSlicesSharedQuota(slices, MAX_COLLECTED);
const sharedTotal = shared.totals.reduce((s, v) => s + v, 0);
console.log(`3. PARALLÈLE QUOTA PARTAGÉ (round-robin, total cumulé ≤ ${MAX_COLLECTED}) — ${sharedTotal} candidats au total (${Date.now() - t3}ms, séquentiel dans ce script)`);
shared.totals.forEach((n, i) => console.log(`   tranche ${i} : ${n} candidats`));

console.log(`\n=== Bilan ===`);
console.log(`Séquentiel (référence)     : ${seqResult.candidates.length} candidats`);
console.log(`Parallèle actuel (égal)    : ${currentTotal} candidats (${((currentTotal / seqResult.candidates.length) * 100).toFixed(1)}% du séquentiel)`);
console.log(`Parallèle quota partagé    : ${sharedTotal} candidats (${((sharedTotal / seqResult.candidates.length) * 100).toFixed(1)}% du séquentiel)`);
