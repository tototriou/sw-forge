// Diagnostic TEMPORAIRE : pour la moitié B (slots 4-6) d'un monstre choisi,
// affiche les N demi-builds les MIEUX classés dans le compartiment qui
// contient aussi le demi-build RÉEL, avec leurs contributions brutes
// (pct/flat) par stat suivie et leur `relevanceScore` — pour comprendre
// CONCRÈTEMENT pourquoi le demi-build réel est classé loin derrière, plutôt
// que de le supposer. Reproduit EXACTEMENT le pipeline de
// monster-search-buildbuckets-diag.ts.
//
// Usage : half-build-rank-diag.ts <export.json> <deckId> <nomMonstre> [statKeys=atk,spd,cr,cd] [objective=degats] [slotFilterCap=80] [bucketCap=3000] [top=10]

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
  HalfCombo,
} from '../src/lib/runeBuildOptim';
import { BaseStats } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';
import { drain } from './lib/drain';

const USAGE =
  'Usage: half-build-rank-diag.ts <export.json> <deckId> <nomMonstre> [statKeys=atk,spd,cr,cd] [objective=degats] [slotFilterCap=80] [bucketCap=3000] [top=10]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const statKeysArg = args.rest[0] ?? 'atk,spd,cr,cd';
const statKeys = statKeysArg.split(',').map((s) => s.trim()) as StatKey[];
const objectiveArg = args.rest[1] ?? 'degats';
const objective = (objectiveArg === 'none' ? undefined : objectiveArg) as Objective | undefined;
const slotFilterCap = args.rest[2] ? Number(args.rest[2]) : 80;
const bucketCap = args.rest[3] ? Number(args.rest[3]) : 3000;
const top = args.rest[4] ? Number(args.rest[4]) : 10;

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
const filtered = bySlot.map((list) => filterSlot(list, requirement, base, slotFilterCap, slotFilterCap, objective));

const requiredPieces = distinctKeys.map((key) => setPieces(key) * requirement.sets.filter((s) => s === key).length);
const jokerCredit = anyJokerAvailable(filtered) ? 1 : 0;
const maxSetsForB = maxSetCountsForSlots(filtered, [0, 1, 2], distinctKeys);

const bucketsB = drain(
  buildBuckets('B', [3, 4, 5], { filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, jokerCredit, requiredPieces, base }, maxSetsForB)
);

const targetIdsB = gear.runes.filter((r) => r.slot >= 4).map((r) => r.id);
let targetBucket: (typeof bucketsB)[number] | undefined;
let targetIdx = -1;
for (const b of bucketsB) {
  const idx = b.combos.findIndex((c) => c.runes.every((r) => targetIdsB.includes(r.id)) && c.runes.length === targetIdsB.length);
  if (idx >= 0) {
    targetBucket = b;
    targetIdx = idx;
    break;
  }
}
if (!targetBucket) {
  console.log('demi-build cible ABSENT — rien à comparer.');
  process.exit(1);
}

function describe(c: HalfCombo, label: string) {
  const statsStr = retentionKeys.map((k) => `${k}: pct=${(c.pct[k] ?? 0).toFixed(1)} flat=${(c.flat[k] ?? 0).toFixed(1)}`).join('  ');
  console.log(`${label} — relevanceScore=${c.relevanceScore.toFixed(3)}  runes=[${c.runes.map((r) => `${r.id}(${r.set})`).join(', ')}]`);
  console.log(`    ${statsStr}`);
}

console.log(`Compartiment cible : ${targetBucket.combos.length} demi-builds. Cible au rang #${targetIdx + 1}.\n`);
console.log(`=== Top ${top} du compartiment (mieux classés que la cible) ===`);
for (let i = 0; i < Math.min(top, targetBucket.combos.length); i++) {
  describe(targetBucket.combos[i], `#${i + 1}`);
}
console.log(`\n=== Demi-build RÉEL de Sonia (rang #${targetIdx + 1}) ===`);
describe(targetBucket.combos[targetIdx], `#${targetIdx + 1}`);

// Pour référence : les seuils MINIMUM demandés (sur le TOTAL, pas juste
// cette moitié — la moitié réelle n'a besoin de fournir qu'une PART).
console.log('\nRappel — minimums demandés (total, 6 runes) :', minStats);
