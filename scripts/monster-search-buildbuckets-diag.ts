// Diagnostic TEMPORAIRE : reproduit EXACTEMENT ce que `searchBuildsSteps` fait
// pour construire `bucketsA`/`bucketsB` (mêmes appels, mêmes paramètres, y
// compris `objective` passé à `filterSlot` — un écart qu'avait
// `monster-search-rank-diag.ts`), puis répond à la question qui compte
// réellement : dans la liste FINALE `bucket.combos` (déjà fusionnée,
// dédupliquée, triée par potentiel normalisé — voir buildBuckets), à quel
// RANG se trouve le demi-build réel ? Et combien de paires (comboA,comboB)
// la boucle d'appariement doit-elle visiter AVANT d'atteindre la paire
// cible, dans SON compartiment ?
//
// Usage : monster-search-buildbuckets-diag.ts <export.json> <deckId> <nomMonstre> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80] [bucketCap=3000]

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
  'Usage: monster-search-buildbuckets-diag.ts <export.json> <deckId> <nomMonstre> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80] [bucketCap=3000]';
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
console.log('retentionKeys :', retentionKeys);
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

// buildBuckets est un GÉNÉRATEUR depuis le correctif « phase de préparation
// muette » (voir spec/outils/optimizer/) — le drainer jusqu'au bout donne
// le Bucket[] final via sa valeur de retour, exactement comme searchBuilds
// draine searchBuildsSteps.
const ctx = { filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, jokerCredit, requiredPieces };
const bucketsA = drain(buildBuckets('A', [0, 1, 2], ctx, maxSetsForA));
const bucketsB = drain(buildBuckets('B', [3, 4, 5], ctx, maxSetsForB));

function analyze(label: string, buckets: Bucket[], targetIds: number[]) {
  console.log(`\n${label} :`);
  console.log(`  ${buckets.length} compartiment(s), tailles = [${buckets.map((b) => b.combos.length).join(', ')}]`);
  let bucketRank = -1;
  let comboRank = -1;
  let comboTotal = -1;
  for (let bi = 0; bi < buckets.length; bi++) {
    const b = buckets[bi];
    const idx = b.combos.findIndex((c) => c.runes.every((r) => targetIds.includes(r.id)) && c.runes.length === targetIds.length);
    if (idx >= 0) {
      bucketRank = bi;
      comboRank = idx;
      comboTotal = b.combos.length;
      break;
    }
  }
  if (bucketRank < 0) {
    console.log('  ⚠️ demi-build cible ABSENT de tous les compartiments retenus (éliminé par bucketCap ou par le filtrage en amont).');
    return { bucketRank: -1, comboRank: -1, comboTotal: -1, buckets };
  }
  console.log(`  compartiment cible : rang #${bucketRank + 1} / ${buckets.length} dans l'ordre d'exploration des compartiments`);
  console.log(`  demi-build cible : rang #${comboRank + 1} / ${comboTotal} dans son compartiment (après fusion + tri par potentiel)`);
  return { bucketRank, comboRank, comboTotal, buckets };
}

const targetIdsA = gear.runes.filter((r) => r.slot <= 3).map((r) => r.id);
const targetIdsB = gear.runes.filter((r) => r.slot >= 4).map((r) => r.id);
const resA = analyze('Moitié A (slots 1-3)', bucketsA, targetIdsA);
const resB = analyze('Moitié B (slots 4-6)', bucketsB, targetIdsB);

if (resA.comboRank >= 0 && resB.comboRank >= 0) {
  // Coût d'exploration RÉEL de la boucle d'appariement : chaque compartiment
  // A AVANT le compartiment cible est croisé avec TOUS les compartiments B
  // compatibles (approximé ici par « tous », satisfiesSets élague certains —
  // borne haute, pas une valeur exacte) ; DANS le compartiment cible, chaque
  // comboA avant le comboA cible croise TOUT bB.combos, jusqu'à atteindre
  // enfin comboB cible.
  let pairsBeforeTargetBucketPair = 0;
  for (let bi = 0; bi < resA.bucketRank; bi++) {
    for (const bb of resB.buckets) pairsBeforeTargetBucketPair += resA.buckets[bi].combos.length * bb.combos.length;
  }
  const bBSizeInTargetPair = resB.buckets[resB.bucketRank].combos.length;
  const withinTargetBucketPair = resA.comboRank * bBSizeInTargetPair + (resB.comboRank + 1);
  console.log(`\nCoût d'exploration estimé (borne haute, satisfiesSets non appliqué) :`);
  console.log(`  paires avant le compartiment-pair cible : ~${pairsBeforeTargetBucketPair.toLocaleString('fr-FR')}`);
  console.log(`  paires DANS le compartiment-pair cible avant la paire cible : ~${withinTargetBucketPair.toLocaleString('fr-FR')}`);
  console.log(`  total estimé avant de trouver le Lushen : ~${(pairsBeforeTargetBucketPair + withinTargetBucketPair).toLocaleString('fr-FR')}`);
}
