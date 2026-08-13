// Diagnostic TEMPORAIRE : trace, étape par étape du pipeline réel de
// searchBuildsSteps (mainStat → dominance → faisabilité → filterSlot →
// buildBuckets), si chacune des 6 runes RÉELLEMENT portées par un monstre
// choisi survit encore — pour localiser PRÉCISÉMENT à quelle étape une
// combinaison réelle disparaît, plutôt que de deviner.
//
// Usage : monster-search-pipeline-diag.ts <export.json> <deckId> <nomMonstre> [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80]

import { computeStats } from '../src/lib/stats';
import { activeSets, StatKey } from '../src/lib/effects';
import {
  BuildRequirement,
  filterSlot,
  mainStatFilteredBySlot,
  pruneDominated,
  eliminateInfeasible,
  guaranteedSetBonus,
  artifactFlatBonus,
  relicPctBonus,
  Objective,
} from '../src/lib/runeBuildOptim';
import { BaseStats } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';

const USAGE =
  'Usage: monster-search-pipeline-diag.ts <export.json> <deckId> <nomMonstre> [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const statKeysArg = process.argv[5] ?? 'atk,cr,cd';
const statKeys = statKeysArg.split(',').map((s) => s.trim()) as StatKey[];
const objectiveArg = process.argv[6] ?? 'degats';
const objective = (objectiveArg === 'none' ? undefined : objectiveArg) as Objective | undefined;
// ⚠️ Défaut à 80 (preset « Moyen », le vrai défaut de l'app) — PAS 300.
const slotFilterCap = process.argv[7] ? Number(process.argv[7]) : 80;

const { gear, allRunes } = loadDeckMonster(args);
const targetSets = activeSets(gear.runes.map((r) => r.set));
const targetStats = computeStats(gear);

const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];

const minStats: BuildRequirement['minStats'] = {};
for (const key of statKeys) {
  const row = targetStats.find((r) => r.key === key);
  if (row) minStats[key] = row.total;
}
const requirement: BuildRequirement = { sets: targetSets, minStats, mainStats };
const base: BaseStats = gear.base;

console.log(`Sets: ${targetSets.join('+')}  minStats: ${JSON.stringify(minStats)}  mainStats: ${JSON.stringify(mainStats)}`);

function survivors(bySlot: { id: number }[][]) {
  return gear.runes.map((tr) => {
    const list = bySlot[tr.slot - 1];
    return { slot: tr.slot, id: tr.id, set: tr.set, survit: list.some((r) => r.id === tr.id) };
  });
}
function report(label: string, bySlot: { id: number }[][]) {
  console.log(`\n=== ${label} ===`);
  for (const s of survivors(bySlot)) console.log(`  slot ${s.slot} (id ${s.id}, ${s.set}) : ${s.survit ? 'OUI' : '❌ NON'}`);
}

// Étape 1 — mainStat
const step1 = mainStatFilteredBySlot(allRunes, requirement);
report('1. mainStatFilteredBySlot', step1);

// Étape 2 — dominance
const requiredKeys = new Set(requirement.sets);
const maxEntries = statKeys
  .map((k) => ({ k, max: requirement.maxStats?.[k] }))
  .filter((e): e is { k: StatKey; max: number } => e.max != null && e.max > 0);
const maxKeys = new Set(maxEntries.map((e) => e.k));
const step2 = step1.map((list) => pruneDominated(list, requiredKeys, maxKeys));
report('2. pruneDominated', step2);

// Étape 3 — faisabilité
const minEntries = statKeys
  .map((k) => ({ k, min: requirement.minStats[k] }))
  .filter((e): e is { k: StatKey; min: number } => e.min != null && e.min > 0);
const constrainedKeys = Array.from(new Set([...minEntries.map((e) => e.k), ...maxEntries.map((e) => e.k)]));
const guaranteed = guaranteedSetBonus(requirement, base);
const artFlat = artifactFlatBonus(gear.artifacts);
const relPct = relicPctBonus(gear.relic);
const baseRec = base as unknown as Record<string, number>;
function totalOf(k: StatKey, pct: number, flat: number): number {
  const b = baseRec[k] ?? 0;
  return k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * pct) / 100) + flat : b + flat;
}
const step3 = eliminateInfeasible(step2, minEntries, maxEntries, constrainedKeys, guaranteed, artFlat, relPct, totalOf);
report('3. eliminateInfeasible', step3);

// Étape 4 — filterSlot, aux réglages réels de l'écran (cap + objectif)
const step4 = step3.map((list) => filterSlot(list, requirement, slotFilterCap, slotFilterCap, objective));
report(`4. filterSlot (cap ${slotFilterCap}, objective=${objective ?? '(aucun)'})`, step4);

console.log('\nTailles par slot à chaque étape :');
for (let s = 0; s < 6; s++) {
  console.log(`  slot ${s + 1} : brut=${allRunes.filter((r) => r.slot === s + 1).length} → mainStat=${step1[s].length} → dominance=${step2[s].length} → faisabilité=${step3[s].length} → filterSlot=${step4[s].length}`);
}
