// Mesure P(optimum conservé | BUCKET_CAP) — voir spec/outils/optimizer/
// pistes.md, « Mesurer le rang de l'optimum dans relevanceScore ». Priorité
// n°1 unanime des 3 analyses externes (ChatGPT/Gemini) sur ce moteur :
// remplace l'anecdote actuelle (« le demi-build réel de Lushen deck 10 est
// classé 11 854ᵉ sur 342 654 dans son compartiment » — UN cas, trouvé par
// hasard en investiguant un signalement) par une vraie distribution mesurée
// sur N scénarios ALÉATOIRES mais DÉTERMINISTES (seed fixe).
//
// Discipline algo-verify : jamais un seul cas anecdotique pour juger une
// constante de rétention/capping — voir .claude/skills/algo-verify/SKILL.md.
//
// ── Méthode ──────────────────────────────────────────────────────────────
// Pour chaque scénario (pool synthétique + exigence aléatoires), UN seul
// `prepareSearch`/`buildBuckets` UNCAPPED fournit la référence, réutilisée
// pour comparer aux 4 VRAIS `bucketCap` de production (un par préréglage) :
//
//  1. Référence EXACTE : `buildBuckets` avec `bucketCap` porté à
//     `Number.MAX_SAFE_INTEGER` (aucune perte de rétention) pour les DEUX
//     moitiés. Le pool est volontairement PETIT (voir `PER_SLOT`) pour que
//     cette étape reste exacte ET rapide.
//  2. Meilleure paire EXACTE : PAS de recherche exhaustive de toutes les
//     paires (explosif même à petite échelle, O(|A|×|B|) par compartiment
//     compatible — a fait OOM en premier jet). À la place, un algorithme
//     « k plus grandes sommes » : chaque compartiment est trié une fois par
//     `relevanceScore` (= efficience du demi-build, correspond exactement à
//     `effTotal` pour `metric:'eff'` — voir `valueOf`/`precomputeSlot` dans
//     runeBuildOptim.ts), puis un tas MAX explore les paires (i,j) en ORDRE
//     STRICTEMENT DÉCROISSANT de somme — la PREMIÈRE paire qui satisfait
//     aussi les minimums demandés (vérifiés sur les VRAIES stats via
//     `computeStats`, comme le brute-force de rune-optim-differential.test.ts)
//     EST par construction la meilleure paire FAISABLE de ce compartiment.
//     Exact, jamais approximatif — seulement plus rapide qu'un produit
//     cartésien complet.
//  3. Pour chaque préréglage réel (Bas/Moyen/Haut/Extrême) : `buildBuckets`
//     au VRAI `bucketCap` de production (`prepared.bucketCap`, formule
//     réelle — jamais réimplémentée ici) sur le MÊME pool (aucun des 4 ne
//     trie le pool synthétique, volontairement plus petit que le plus
//     étroit des 4 — voir `PER_SLOT`). Les 2 demi-builds de l'optimum
//     EXACT sont-ils PRÉSENTS dans les compartiments retenus réels ? À quel
//     rang (position dans `bucket.combos`, 0 = meilleur) ?
//
// ⚠️ CALIBRÉ — voir spec/outils/optimizer/historique-dimensionnement.md,
// « Suite — mesure P(optimum conservé | BUCKET_CAP)… » pour le résultat de
// référence : `npx tsx scripts/optimum-retention-rate.ts 200 35 5000` →
// 696/696 mesures (174 scénarios × 4 préréglages), 100 % de survie, rang
// maximum 584 (bien sous le plus petit `bucketCap` réel, 3000). Les
// défauts ci-dessous restent volontairement plus légers, pour une
// vérification rapide pendant l'itération — relancer avec ces arguments
// explicites pour rejouer la mesure de référence complète.
//
// Usage : optimum-retention-rate.ts [scenarios=30] [perSlot=25] [seed=5000] [combosOrderMode=relevance]
//   scenarios — nombre de scénarios synthétiques (défaut 30, monter à
//               quelques centaines une fois le coût par scénario calibré).
//   perSlot   — runes par slot dans le pool synthétique (défaut 25 — reste
//               SOUS le plus étroit des 4 préréglages réels, « Bas »=40,
//               pour que `filterSlot` ne trie RIEN et que les 4 comparaisons
//               partagent exactement le même pool filtré).
//   seed      — graine de base du PRNG déterministe (défaut 5000 — 1000 et
//               3000 déjà pris par differential/scale-monotonicity).
//   combosOrderMode — 'relevance' (défaut ici ET en production depuis le
//               2026-08-18) ou 'potential' (ancien comportement, gardé
//               comme échappatoire de mesure/comparaison — voir
//               buildBuckets/SearchParams) — appliqué explicitement, PAS
//               via `undefined`/le défaut interne de `buildBuckets`, pour
//               que ce script reste fidèle à ce qu'il mesure même si ce
//               défaut change à nouveau un jour. Appliqué UNIQUEMENT aux
//               appels `buildBuckets` au VRAI bucketCap (rétention réelle) ;
//               la référence exacte reste indifférente à l'ordre par
//               construction (ré-triée indépendamment par
//               `exactOptimum` avant de chercher la meilleure paire).

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

// Même vocabulaire que rune-optim-differential.test.ts/rune-optim-scale-
// monotonicity.test.ts — pas réinventé, juste reconduit ici.
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
  return {
    id, slot, set, rank: 6, rarity: 5, level: 15,
    main: { code: mainCode, value: 10 + Math.floor(rng() * 100) },
    subs,
  };
}

function randomPool(rng: () => number, perSlot: number): RuneDetail[] {
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) {
    for (let i = 0; i < perSlot; i++) out.push(randomRune(id++, slot, rng));
  }
  return out;
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

// Reproduit EXACTEMENT `satisfiesSets` (runeBuildOptim.ts, non exportée) —
// même formule (synthétise les pièces des DEUX compartiments + jokers,
// teste via `activeSets`/`missingSets`, déjà couverts ailleurs). Dupliquée
// ici plutôt qu'exportée : fonction interne courte, garder la surface
// publique du moteur inchangée pour un script de mesure.
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

// « k plus grandes sommes » : explore (i,j) en ordre décroissant de
// `relevanceScore(A[i]) + relevanceScore(B[j])` via un tas max, s'arrête à
// la PREMIÈRE paire faisable — c'est par construction la meilleure paire
// faisable de ce compartiment. `combosA`/`combosB` DOIVENT déjà être triés
// par `relevanceScore` décroissant.
const HEAP_BUDGET = 20_000;
function bestFeasiblePair(
  combosA: HalfCombo[],
  combosB: HalfCombo[],
  base: BaseStats,
  requirement: BuildRequirement
): { runeIds: number[]; effTotal: number } | null {
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
        const l = 2 * idx + 1;
        const r = 2 * idx + 2;
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
  return null; // budget épuisé sans paire faisable — rare, compté séparément
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
        // Budget épuisé OU aucune paire faisable dans ce compartiment —
        // les deux sont possibles ; on ne peut pas les distinguer sans
        // coût supplémentaire, donc on le signale prudemment.
        anyBudgetExceeded = true;
        continue;
      }
      if (!best || pair.effTotal > best.effTotal) best = pair;
    }
  }
  if (!anyCompatible) return null;
  // ⚠️ Conservateur À DESSEIN (même correctif que optimum-speed-targets.ts,
  // voir son commentaire) : dès qu'UN SEUL couple de compartiments a
  // atteint le budget du tas, le résultat n'est plus une preuve
  // d'optimalité, même si un AUTRE couple a produit un `best` — avant ce
  // correctif, cette troncature partielle était absorbée en silence
  // (`!best && anyBudgetExceeded` seulement), un optimum sous-optimal
  // pouvant être écrit comme vérité terrain sans le signaler.
  if (anyBudgetExceeded) return 'budget-exceeded';
  return best;
}

function bucketFor(buckets: Bucket[], runeIds: number[]): { bucket: Bucket; idx: number } | null {
  for (const b of buckets) {
    const idx = b.combos.findIndex((c) => c.runes.length === runeIds.length && c.runes.every((r) => runeIds.includes(r.id)));
    if (idx >= 0) return { bucket: b, idx };
  }
  return null;
}

const argv = process.argv.slice(2);
const SCENARIOS = argv[0] ? Number(argv[0]) : 30;
const PER_SLOT = argv[1] ? Number(argv[1]) : 25;
const SEED_BASE = argv[2] ? Number(argv[2]) : 5000;
const combosOrderMode = argv[3] === 'potential' ? ('potential' as const) : ('relevance' as const);

interface Row {
  scenario: number;
  preset: string;
  nMin: number;
  hasSets: boolean;
  refBucketSizeA: number;
  refBucketSizeB: number;
  bucketCapReal: number;
  survivedA: boolean;
  survivedB: boolean;
  rankA: number | null;
  rankB: number | null;
  bothSurvived: boolean;
}

const rows: Row[] = [];
let skippedInfeasible = 0;
let skippedBudget = 0;

console.log(`P(optimum conservé | BUCKET_CAP) — ${SCENARIOS} scénario(s), ${PER_SLOT} runes/slot, seed base ${SEED_BASE}, combosOrderMode=${combosOrderMode}.\n`);

for (let s = 0; s < SCENARIOS; s++) {
  const t0 = Date.now();
  const rng = mulberry32(SEED_BASE + s);
  const pool = randomPool(rng, PER_SLOT);

  // Seuils calibrés pour forcer une tension comparable ou supérieure aux
  // pires cas réels connus (Sonia deck 14, 4 conditions simultanées) — voir
  // spec/outils/optimizer/historique-dimensionnement.md, « Suite — mesure
  // P(optimum conservé | BUCKET_CAP)… » pour le calibrage complet (un
  // premier jet plus doux n'avait déjà rien perdu ; celui-ci vérifie que ce
  // n'était pas juste un signal trop faible). 2-4 conditions simultanées
  // (pas 4 fixe) pour une distribution de difficulté représentative.
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
    else minStats[k] = 55 + Math.floor(rng() * 30); // acc
  }
  const hasSets = rng() < 0.6;
  const sets = hasSets ? [SET_KEYS[Math.floor(rng() * SET_KEYS.length)], SET_KEYS[Math.floor(rng() * SET_KEYS.length)]] : [];
  const requirement: BuildRequirement = { sets, minStats };

  // Un seul `prepareSearch` (préréglage "bas" — sans effet ici puisque
  // PER_SLOT ≤ 40, voir l'en-tête) donne tout le contexte dérivé
  // (`filtered`/`distinctKeys`/`retentionKeys`/`minEntries`/`maxSetsForA-B`/
  // `jokerCredit`/`requiredPieces`), IDENTIQUE quel que soit le préréglage
  // testé ensuite pour `bucketCap` — voir la boucle des 4 préréglages plus
  // bas, qui n'appelle plus que `buildBuckets` (jamais `prepareSearch` à
  // nouveau).
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
  const refBucketSizeA = Math.max(0, ...bucketsA_ref.map((b) => b.combos.length));
  const refBucketSizeB = Math.max(0, ...bucketsB_ref.map((b) => b.combos.length));

  const optimum = exactOptimum(bucketsA_ref, bucketsB_ref, prepared.distinctKeys, BASE, requirement);
  if (optimum === null) {
    skippedInfeasible++;
    continue;
  }
  if (optimum === 'budget-exceeded') {
    skippedBudget++;
    continue;
  }

  const idsA = optimum.runeIds.slice(0, 3);
  const idsB = optimum.runeIds.slice(3, 6);

  for (const preset of SLOT_FILTER_PRESETS) {
    const bucketCapReal = preset.key === 'bas' ? prepared.bucketCap : prepareSearch({ base: BASE, artifacts: [], pool, requirement, metric: 'eff', slotFilterCap: preset.cap })!.bucketCap;

    const bucketsA_real = drain(
      buildBuckets('A', [0, 1, 2], { ...prepared, bucketCap: bucketCapReal }, prepared.maxSetsForA, undefined, false, combosOrderMode)
    );
    const bucketsB_real = drain(
      buildBuckets('B', [3, 4, 5], { ...prepared, bucketCap: bucketCapReal }, prepared.maxSetsForB, undefined, false, combosOrderMode)
    );

    const foundA = bucketFor(bucketsA_real, idsA);
    const foundB = bucketFor(bucketsB_real, idsB);

    const row: Row = {
      scenario: s,
      preset: preset.key,
      nMin,
      hasSets,
      refBucketSizeA,
      refBucketSizeB,
      bucketCapReal,
      survivedA: !!foundA,
      survivedB: !!foundB,
      rankA: foundA ? foundA.idx : null,
      rankB: foundB ? foundB.idx : null,
      bothSurvived: !!foundA && !!foundB,
    };
    rows.push(row);
  }
  console.log(
    `#${s} nMin=${nMin} sets=${hasSets ? 'oui' : 'non'} — réf max compartiment ${refBucketSizeA}/${refBucketSizeB} — ` +
      `${rows.filter((r) => r.scenario === s && r.bothSurvived).length}/4 préréglages conservent l'optimum en entier — ${Date.now() - t0}ms`
  );
}

console.log(`\n${skippedInfeasible} scénario(s) infaisable(s), ${skippedBudget} budget de recherche de paire épuisé (voir HEAP_BUDGET).`);

const n = rows.length;
if (n === 0) {
  console.log('Aucun scénario exploitable — ajuster perSlot/seed.');
  process.exit(1);
}
const bothSurvived = rows.filter((r) => r.bothSurvived).length;
const lostA = rows.filter((r) => !r.survivedA).length;
const lostB = rows.filter((r) => !r.survivedB).length;

console.log(`\n=== Bilan sur ${n} mesure(s) (scénario × préréglage) ===`);
console.log(`P(optimum ENTIÈREMENT conservé | BUCKET_CAP) = ${bothSurvived}/${n} = ${((bothSurvived / n) * 100).toFixed(1)}%`);
console.log(`  moitié A perdue : ${lostA}/${n} (${((lostA / n) * 100).toFixed(1)}%)`);
console.log(`  moitié B perdue : ${lostB}/${n} (${((lostB / n) * 100).toFixed(1)}%)`);

const ranks = [...rows.filter((r) => r.rankA != null).map((r) => r.rankA!), ...rows.filter((r) => r.rankB != null).map((r) => r.rankB!)].sort((a, b) => a - b);
if (ranks.length > 0) {
  const pct = (p: number) => ranks[Math.min(ranks.length - 1, Math.floor((p / 100) * ranks.length))];
  console.log(`\nRang (0 = meilleur) parmi les demi-builds SURVIVANTS (n=${ranks.length}) :`);
  console.log(`  médiane=${pct(50)}  p90=${pct(90)}  p99=${pct(99)}  max=${ranks[ranks.length - 1]}`);
}

console.log('\nPar préréglage :');
for (const preset of SLOT_FILTER_PRESETS) {
  const sub = rows.filter((r) => r.preset === preset.key);
  if (sub.length === 0) continue;
  const subBoth = sub.filter((r) => r.bothSurvived).length;
  const capMin = Math.min(...sub.map((r) => r.bucketCapReal));
  console.log(`  ${preset.key.padEnd(8)} (bucketCap réel=${capMin}) : ${subBoth}/${sub.length} = ${((subBoth / sub.length) * 100).toFixed(1)}%`);
}
