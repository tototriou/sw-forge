// Diagnostic TEMPORAIRE — mesure la piste « dominance de demi-builds »
// (skyline/frontière de Pareto, voir `dominatesHalfCombo`/`insertIntoSkyline`
// dans runeBuildOptim.ts) sur un compte réel, AVANT de décider si elle vaut
// la peine d'être intégrée à la recherche de production. Reproduit
// EXACTEMENT le pipeline de `searchBuildsSteps` (comme
// monster-search-buildbuckets-diag.ts), mais appelle `buildBuckets` avec
// `skylineKeys=retentionKeys` pour obtenir, EN PLUS des tranches
// habituelles, la frontière de Pareto exacte de chaque compartiment. Répond
// à trois questions : (1) le demi-build réel est-il TOUJOURS dans la
// skyline de son compartiment (sanity check — s'il ne l'était pas, la
// fonction de dominance aurait un bug) ? (2) quelle taille prend la skyline
// par rapport à la taille du compartiment complet ? (3) quel surcoût de
// temps la construction avec skyline ajoute-t-elle ?
//
// Usage : monster-search-skyline-diag.ts <export.json> <deckId> <nomMonstre> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80] [bucketCap=3000]

import { activeSets, setPieces, StatKey } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import {
  BuildRequirement,
  mainStatFilteredBySlot,
  pruneDominated,
  eliminateInfeasible,
  guaranteedSetBonus,
  artifactFlatBonus,
  relicPctBonus,
  filterSlot,
  buildBuckets,
  maxSetCountsForSlots,
  anyJokerAvailable,
  OBJECTIVE_RELEVANT_STATS,
  Objective,
  Bucket,
} from '../src/lib/runeBuildOptim';
import { BaseStats } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';
import { drain } from './lib/drain';

const USAGE =
  'Usage: monster-search-skyline-diag.ts <export.json> <deckId> <nomMonstre> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80] [bucketCap=3000]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const statKeysArg = args.rest[0] ?? 'atk,cr,cd';
const statKeys = statKeysArg.split(',').map((s) => s.trim()) as StatKey[];
const objectiveArg = args.rest[1] ?? 'degats';
const objective = (objectiveArg === 'none' ? undefined : objectiveArg) as Objective | undefined;
const slotFilterCap = args.rest[2] ? Number(args.rest[2]) : 80;
const bucketCap = args.rest[3] ? Number(args.rest[3]) : 3000;

const { gear, allRunes } = loadDeckMonster(args);

const targetSets = activeSets(gear.runes.map((r) => r.set));
const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];
const targetStats = computeStats(gear);
const minStats: BuildRequirement['minStats'] = {};
for (const key of statKeys) {
  const row = targetStats.find((r) => r.key === key);
  if (row) minStats[key] = row.total;
}
const requirement: BuildRequirement = { sets: targetSets, minStats, mainStats };
const base: BaseStats = gear.base;

const minEntries = statKeys.map((k) => ({ k, min: minStats[k]! })).filter((e) => e.min > 0);
const maxEntries: { k: StatKey; max: number }[] = [];
const constrainedKeys = Array.from(new Set([...minEntries.map((e) => e.k), ...maxEntries.map((e) => e.k)]));
const retentionKeys = Array.from(new Set<StatKey>([...minEntries.map((e) => e.k), ...(objective ? OBJECTIVE_RELEVANT_STATS[objective] : [])]));
const distinctKeys = Array.from(new Set(requirement.sets));
const requiredKeys = new Set(requirement.sets);

const guaranteed = guaranteedSetBonus(requirement, base);
const artFlat = artifactFlatBonus(gear.artifacts);
const relPct = relicPctBonus(gear.relic);
const baseRec = base as unknown as Record<string, number>;
function totalOf(k: StatKey, pct: number, flat: number): number {
  const b = baseRec[k] ?? 0;
  return k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * pct) / 100) + flat : b + flat;
}

const maxKeys = new Set(maxEntries.map((e) => e.k));
let bySlot = mainStatFilteredBySlot(allRunes, requirement);
bySlot = bySlot.map((list) => pruneDominated(list, requiredKeys, maxKeys));
bySlot = eliminateInfeasible(bySlot, minEntries, maxEntries, constrainedKeys, guaranteed, artFlat, relPct, totalOf);
const filtered = bySlot.map((list) => filterSlot(list, requirement, slotFilterCap, slotFilterCap, objective));

console.log(`objective=${objective ?? '(aucun)'} · slotFilterCap=${slotFilterCap} · bucketCap=${bucketCap}`);
console.log('retentionKeys (= skylineKeys pour cette mesure) :', retentionKeys);
console.log('minStats utilisés :', minStats);
console.log(
  'Tailles après pipeline complet (mainStat+dominance+faisabilité+filterSlot) :',
  filtered.map((l) => l.length)
);
if (filtered.some((l) => l.length === 0)) {
  console.log('⚠️ Un slot est vide après filtrage — aucun candidat possible.');
  process.exit(1);
}

const requiredPieces = distinctKeys.map((key) => setPieces(key) * requirement.sets.filter((s) => s === key).length);
const jokerCredit = anyJokerAvailable(filtered) ? 1 : 0;
const maxSetsForA = maxSetCountsForSlots(filtered, [3, 4, 5], distinctKeys);
const maxSetsForB = maxSetCountsForSlots(filtered, [0, 1, 2], distinctKeys);

// ⚠️ Deux passes chronométrées séparément : SANS skyline (le comportement de
// production actuel, inchangé) puis AVEC (`skylineKeys=retentionKeys`) — le
// delta de temps est le VRAI surcoût de cette piste, pas une estimation.
const t0 = performance.now();
const bucketsA_noSkyline = drain(
  buildBuckets('A', [0, 1, 2], filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, maxSetsForA, jokerCredit, requiredPieces)
);
const bucketsB_noSkyline = drain(
  buildBuckets('B', [3, 4, 5], filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, maxSetsForB, jokerCredit, requiredPieces)
);
const tSansSkyline = performance.now() - t0;

const t1 = performance.now();
const bucketsA = drain(
  buildBuckets(
    'A', [0, 1, 2], filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, maxSetsForA, jokerCredit, requiredPieces, retentionKeys
  )
);
const bucketsB = drain(
  buildBuckets(
    'B', [3, 4, 5], filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, maxSetsForB, jokerCredit, requiredPieces, retentionKeys
  )
);
const tAvecSkyline = performance.now() - t1;

console.log(`\nTemps construction SANS skyline (comportement de production actuel) : ${tSansSkyline.toFixed(0)} ms`);
console.log(`Temps construction AVEC skyline (skylineKeys=retentionKeys)          : ${tAvecSkyline.toFixed(0)} ms`);
console.log(`Surcoût : ${(tAvecSkyline - tSansSkyline).toFixed(0)} ms (×${(tAvecSkyline / tSansSkyline).toFixed(2)})`);

function analyze(label: string, buckets: Bucket[], targetIds: number[]) {
  console.log(`\n${label} :`);
  console.log(`  ${buckets.length} compartiment(s)`);
  for (const b of buckets) {
    const idx = b.combos.findIndex((c) => c.runes.every((r) => targetIds.includes(r.id)) && c.runes.length === targetIds.length);
    const skylineIdx = b.skyline?.findIndex((c) => c.runes.every((r) => targetIds.includes(r.id)) && c.runes.length === targetIds.length) ?? -1;
    const isTargetBucket = idx >= 0 || skylineIdx >= 0;
    const marker = isTargetBucket ? '  ⭐' : '   ';
    console.log(
      `${marker} compartiment (${b.counts.join(',')}|${b.jokers}) : combos=${b.combos.length} · skyline=${b.skyline?.length ?? 0}` +
        (b.combos.length > 0 ? ` (skyline = ${(((b.skyline?.length ?? 0) / b.combos.length) * 100).toFixed(1)}% du compartiment retenu)` : '')
    );
    if (isTargetBucket) {
      console.log(`      demi-build cible : ${idx >= 0 ? `présent dans combos (rang #${idx + 1})` : 'ABSENT de combos'}`);
      console.log(`      demi-build cible : ${skylineIdx >= 0 ? `présent dans la skyline (rang #${skylineIdx + 1})` : '❌ ABSENT DE LA SKYLINE — la fonction de dominance a un bug'}`);
    }
  }
}

const targetIdsA = gear.runes.filter((r) => r.slot <= 3).map((r) => r.id);
const targetIdsB = gear.runes.filter((r) => r.slot >= 4).map((r) => r.id);
analyze('Moitié A (slots 1-3)', bucketsA, targetIdsA);
analyze('Moitié B (slots 4-6)', bucketsB, targetIdsB);
