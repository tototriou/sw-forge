// Étape 1/2 de la comparaison de VITESSE « rétention par tranches » vs
// l'ancien mécanisme à score unique — voir spec/outils/optimizer/
// historique-dimensionnement.md, « Suite — vitesse de convergence : tranches
// vs score unique ». Génère N scénarios synthétiques et calcule l'optimum
// EXACT de chacun (référence indépendante de la rétention — un fait sur le
// pool/l'exigence, pas sur le mécanisme testé), écrit le tout dans un JSON
// partagé. Ne tourne QUE dans le répertoire courant (code ACTUEL — importe
// `buildBuckets`/`prepareSearch`, absents de l'ancien commit comparé) :
// jamais copié dans le worktree de l'ancien code, contrairement à
// `optimum-speed-diag.ts`.
//
// Réutilise la même génération de scénarios que
// `scripts/optimum-retention-rate.ts` (même vocabulaire, seed différente
// pour ne pas collisionner — 1000/3000/5000 déjà pris) et la même méthode
// « k plus grandes sommes » pour l'optimum exact sans produit cartésien
// complet (a fait OOM en premier jet sur cette même piste).
//
// Usage : optimum-speed-targets.ts <sortie.json> [scenarios=60] [perSlot=35] [seed=7000]

import { writeFileSync } from 'fs';
import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import { StatKey, activeSets, runeEfficiency } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import { missingSets } from '../src/lib/recoMatch';
import { BuildRequirement, SearchParams, SLOT_FILTER_PRESETS, prepareSearch, buildBuckets, Bucket, HalfCombo } from '../src/lib/runeBuildOptim';
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
const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];

function randomRune(id: number, slot: number, rng: () => number): RuneDetail {
  const set = SET_KEYS[Math.floor(rng() * SET_KEYS.length)];
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
    subs.push({ code, value: 5 + Math.floor(rng() * 40) });
  }
  return { id, slot, set, rank: 6, rarity: 5, level: 15, main: { code: mainCode, value: 10 + Math.floor(rng() * 100) }, subs };
}

function randomPool(rng: () => number, perSlot: number): RuneDetail[] {
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) for (let i = 0; i < perSlot; i++) out.push(randomRune(id++, slot, rng));
  return out;
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

function bucketsCompatible(bA: Bucket, bB: Bucket, distinctKeys: string[], sets: string[]): boolean {
  if (bA.jokers + bB.jokers > 1) return false;
  if (sets.length === 0) return true;
  const synthetic: string[] = [];
  for (let i = 0; i < distinctKeys.length; i++) {
    const n = bA.counts[i] + bB.counts[i];
    for (let j = 0; j < n; j++) synthetic.push(distinctKeys[i]);
  }
  for (let j = 0; j < bA.jokers + bB.jokers; j++) synthetic.push('intangible');
  return missingSets(sets, activeSets(synthetic)).length === 0;
}

function feasibleFull(comboA: HalfCombo, comboB: HalfCombo, base: BaseStats, requirement: BuildRequirement): boolean {
  const runes = [...comboA.runes, ...comboB.runes];
  if (runes.filter((r) => r.set === 'intangible').length > 1) return false;
  const active = activeSets(runes.map((r) => r.set));
  if (missingSets(requirement.sets, active).length > 0) return false;
  const stats = computeStats({ base, runes, artifacts: [] });
  for (const [key, min] of Object.entries(requirement.minStats)) {
    if (min == null) continue;
    const row = stats.find((r) => r.key === key);
    if (!row || row.total < min) return false;
  }
  return true;
}

const HEAP_BUDGET = 20_000;
function bestFeasiblePair(combosA: HalfCombo[], combosB: HalfCombo[], base: BaseStats, requirement: BuildRequirement): { runeIds: number[]; effTotal: number } | null {
  if (combosA.length === 0 || combosB.length === 0) return null;
  interface Entry { i: number; j: number; sum: number }
  const heap: Entry[] = [];
  const seen = new Set<string>();
  function push(i: number, j: number) {
    if (i >= combosA.length || j >= combosB.length) return;
    const key = `${i},${j}`;
    if (seen.has(key)) return;
    seen.add(key);
    const entry: Entry = { i, j, sum: combosA[i].relevanceScore + combosB[j].relevanceScore };
    heap.push(entry);
    let idx = heap.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heap[parent].sum >= heap[idx].sum) break;
      [heap[parent], heap[idx]] = [heap[idx], heap[parent]];
      idx = parent;
    }
  }
  function pop(): Entry {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let idx = 0;
      for (;;) {
        const l = 2 * idx + 1, r = 2 * idx + 2;
        let largest = idx;
        if (l < heap.length && heap[l].sum > heap[largest].sum) largest = l;
        if (r < heap.length && heap[r].sum > heap[largest].sum) largest = r;
        if (largest === idx) break;
        [heap[largest], heap[idx]] = [heap[idx], heap[largest]];
        idx = largest;
      }
    }
    return top;
  }
  push(0, 0);
  let popped = 0;
  while (heap.length > 0 && popped < HEAP_BUDGET) {
    const { i, j } = pop();
    popped++;
    if (feasibleFull(combosA[i], combosB[j], base, requirement)) {
      const runes = [...combosA[i].runes, ...combosB[j].runes];
      return { runeIds: runes.map((r) => r.id), effTotal: runes.reduce((s, r) => s + runeEfficiency(r), 0) };
    }
    push(i + 1, j);
    push(i, j + 1);
  }
  return null;
}

function exactOptimum(bucketsA: Bucket[], bucketsB: Bucket[], distinctKeys: string[], base: BaseStats, requirement: BuildRequirement): { runeIds: number[]; effTotal: number } | 'budget-exceeded' | null {
  let best: { runeIds: number[]; effTotal: number } | null = null;
  let anyCompatible = false;
  let anyBudgetExceeded = false;
  for (const bA of bucketsA) {
    const sortedA = [...bA.combos].sort((x, y) => y.relevanceScore - x.relevanceScore);
    for (const bB of bucketsB) {
      if (!bucketsCompatible(bA, bB, distinctKeys, requirement.sets)) continue;
      anyCompatible = true;
      const sortedB = [...bB.combos].sort((x, y) => y.relevanceScore - x.relevanceScore);
      const pair = bestFeasiblePair(sortedA, sortedB, base, requirement);
      if (pair === null) {
        anyBudgetExceeded = true;
        continue;
      }
      if (!best || pair.effTotal > best.effTotal) best = pair;
    }
  }
  if (!anyCompatible) return null;
  // ⚠️ Conservateur À DESSEIN : dès qu'UN SEUL couple de compartiments a
  // atteint HEAP_BUDGET (anyBudgetExceeded), le résultat n'est PLUS une
  // preuve d'optimalité — un autre couple tronqué peut porter un meilleur
  // effTotal jamais atteint. Avant ce correctif, une troncature partielle
  // était absorbée en silence dès qu'AU MOINS UN couple avait produit un
  // résultat (`!best && anyBudgetExceeded` seulement) : un optimum
  // SOUS-OPTIMAL pouvait être écrit comme vérité terrain sans le signaler
  // — trouvé par une revue de code externe, voir historique-
  // dimensionnement.md, « revue de code externe ». Ce script sert de
  // référence pour valider d'autres mesures : mieux vaut sauter un
  // scénario incertain que lui faire confiance à tort.
  if (anyBudgetExceeded) return 'budget-exceeded';
  return best;
}

const argv = process.argv.slice(2);
const OUT = argv[0];
if (!OUT) {
  console.error('Usage: optimum-speed-targets.ts <sortie.json> [scenarios=60] [perSlot=35] [seed=7000]');
  process.exit(1);
}
const SCENARIOS = argv[1] ? Number(argv[1]) : 60;
const PER_SLOT = argv[2] ? Number(argv[2]) : 35;
const SEED_BASE = argv[3] ? Number(argv[3]) : 7000;

interface ScenarioOut {
  id: number;
  pool: RuneDetail[];
  requirement: BuildRequirement;
  targetRuneIds: number[];
}

const out: ScenarioOut[] = [];
let skippedInfeasible = 0;
let skippedBudget = 0;

console.log(`Calcul des cibles exactes — ${SCENARIOS} scénario(s), ${PER_SLOT} runes/slot, seed base ${SEED_BASE}.`);

for (let s = 0; s < SCENARIOS; s++) {
  const rng = mulberry32(SEED_BASE + s);
  const pool = randomPool(rng, PER_SLOT);

  const nMin = 2 + Math.floor(rng() * 3);
  const shuffledStats = [...STAT_KEYS].sort(() => rng() - 0.5).slice(0, nMin);
  const minStats: BuildRequirement['minStats'] = {};
  for (const k of shuffledStats) {
    if (k === 'spd') minStats[k] = 160 + Math.floor(rng() * 40);
    else if (k === 'cr') minStats[k] = 55 + Math.floor(rng() * 30);
    else if (k === 'cd') minStats[k] = 110 + Math.floor(rng() * 50);
    else if (k === 'hp') minStats[k] = 11000 + Math.floor(rng() * 4000);
    else if (k === 'atk') minStats[k] = 1500 + Math.floor(rng() * 600);
    else if (k === 'def') minStats[k] = 800 + Math.floor(rng() * 300);
    else if (k === 'res') minStats[k] = 55 + Math.floor(rng() * 30);
    else minStats[k] = 55 + Math.floor(rng() * 30);
  }
  const hasSets = rng() < 0.6;
  const sets = hasSets ? [SET_KEYS[Math.floor(rng() * SET_KEYS.length)], SET_KEYS[Math.floor(rng() * SET_KEYS.length)]] : [];
  const requirement: BuildRequirement = { sets, minStats };

  const prepared = prepareSearch({ base: BASE, artifacts: [], pool, requirement, metric: 'eff', slotFilterCap: SLOT_FILTER_PRESETS[0].cap });
  if (!prepared) {
    skippedInfeasible++;
    continue;
  }
  const bucketsA_ref = drain(
    buildBuckets('A', [0, 1, 2], { ...prepared, bucketCap: Number.MAX_SAFE_INTEGER }, prepared.maxSetsForA)
  );
  const bucketsB_ref = drain(
    buildBuckets('B', [3, 4, 5], { ...prepared, bucketCap: Number.MAX_SAFE_INTEGER }, prepared.maxSetsForB)
  );
  const optimum = exactOptimum(bucketsA_ref, bucketsB_ref, prepared.distinctKeys, BASE, requirement);
  if (optimum === null) {
    skippedInfeasible++;
    continue;
  }
  if (optimum === 'budget-exceeded') {
    skippedBudget++;
    continue;
  }
  out.push({ id: s, pool, requirement, targetRuneIds: optimum.runeIds });
  console.log(`  #${s} ok (nMin=${nMin} sets=${hasSets ? 'oui' : 'non'})`);
}

writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\n${out.length} scénario(s) exploitable(s) écrit(s) dans ${OUT} (${skippedInfeasible} infaisable(s), ${skippedBudget} budget épuisé).`);
