// Diagnostic TEMPORAIRE : pour UN slot donné, calcule le rang exact de la
// rune réellement portée sur `relevance()` (le score combiné utilisé pour
// matchCap/fillCap) ET sur chaque stat individuelle (PER_STAT_KEEP/
// PER_STAT_KEEP_OBJECTIVE) — répond directement à « pourquoi cette rune ne
// survit pas à filterSlot ? » sans deviner.
//
// Usage : monster-search-filterslot-diag.ts <export.json> <deckId> <nomMonstre> <slot 1-6> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80]

import { resolveObjectifCli } from './lib/objectifCli';
import { activeSets, StatKey } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import {
  BuildRequirement,
  mainStatFilteredBySlot,
  pruneDominated,
  eliminateInfeasible,
  guaranteedSetBonus,
  artifactFlatBonus,
  relicPctBonus,
  relevance,
  runeContribution,
  Objective,
  objectiveKeysOf,
} from '../src/lib/runeBuildOptim';
import { BaseStats } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';

const USAGE =
  'Usage: monster-search-filterslot-diag.ts <export.json> <deckId> <nomMonstre> <slot 1-6> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const targetSlot = Number(args.rest[0]);
if (!Number.isFinite(targetSlot) || targetSlot < 1 || targetSlot > 6) {
  console.error(USAGE);
  process.exit(1);
}
const statKeysArg = args.rest[1] ?? 'atk,cr,cd';
const statKeys = statKeysArg.split(',').map((s) => s.trim()) as StatKey[];
const objectiveArg = args.rest[2] ?? 'degats';
const { objective, objectiveStats } = resolveObjectifCli(objectiveArg);
const slotFilterCap = args.rest[3] ? Number(args.rest[3]) : 80;
// Mêmes constantes que filterSlot (privées à runeBuildOptim.ts, dupliquées
// ici pour ce diagnostic — voir PER_STAT_KEEP/PER_STAT_KEEP_OBJECTIVE).
const PER_STAT_KEEP = 6;
const PER_STAT_KEEP_OBJECTIVE = 24;
const ALL_STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];

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

const requiredKeys = new Set(requirement.sets);
const maxKeys = new Set<StatKey>();
const step1 = mainStatFilteredBySlot(allRunes, requirement);
const step2 = step1.map((l) => pruneDominated(l, requiredKeys, maxKeys));
const guaranteed = guaranteedSetBonus(requirement, base);
const artFlat = artifactFlatBonus(gear.artifacts);
const relPct = relicPctBonus(gear.relic);
const baseRec = base as unknown as Record<string, number>;
function totalOf(k: StatKey, pct: number, flat: number): number {
  const b = baseRec[k] ?? 0;
  return k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * pct) / 100) + flat : b + flat;
}
const minEntries = statKeys.map((k) => ({ k, min: minStats[k]! })).filter((e) => e.min > 0);
const step3 = eliminateInfeasible(step2, minEntries, [], statKeys, guaranteed, artFlat, relPct, totalOf);

const pool = step3[targetSlot - 1];
const targetRune = gear.runes.find((r) => r.slot === targetSlot)!;
console.log(`Slot ${targetSlot} — rune réelle id=${targetRune.id} (${targetRune.set}) — pool avant filterSlot : ${pool.length} runes`);
console.log(`minStats : ${JSON.stringify(minStats)} · objective=${objective ?? '(aucun)'} · slotFilterCap=${slotFilterCap}`);

const scored = pool.map((r) => ({ r, s: relevance(r, requirement, base) })).sort((a, b) => b.s - a.s);
const relRank = scored.findIndex((s) => s.r.id === targetRune.id) + 1;
console.log(`\nrelevance() combinée (matchCap/fillCap=${slotFilterCap}) : rang #${relRank} / ${pool.length}`);
console.log(`  score cible=${scored[relRank - 1]?.s.toFixed(3)}, meilleur=${scored[0]?.s.toFixed(3)}`);

// ⚠️ La MÊME résolution que le moteur (`objectiveKeysOf`), override compris :
// une table recopiée ici connaissait encore `'degats'`, retiré du type, et
// divergeait donc de ce que la recherche applique réellement.
const objectiveKeys: string[] = objectiveKeysOf(objective, objectiveStats);
console.log('\nPar stat individuelle :');
for (const k of ALL_STAT_KEYS) {
  const keepN = objectiveKeys.includes(k) ? PER_STAT_KEEP_OBJECTIVE : PER_STAT_KEEP;
  const top = pool
    .map((r) => {
      const c = runeContribution(r, k);
      const b = (baseRec[k] ?? 0);
      const v = k === 'hp' || k === 'atk' || k === 'def' ? Math.ceil((b * c.pct) / 100) + c.flat : c.flat;
      return { r, v };
    })
    .sort((a, b) => b.v - a.v);
  const rank = top.findIndex((t) => t.r.id === targetRune.id) + 1;
  const kept = rank > 0 && rank <= keepN;
  console.log(`  ${k.padEnd(4)} (garde ${keepN}) : rang #${rank} / ${pool.length} ${kept ? '✅ retenue' : '❌ hors budget'} (cible=${top[rank - 1]?.v}, meilleur=${top[0]?.v})`);
}

const matchesOnly = scored.filter(({ r }) => requiredKeys.has(r.set) || r.set === 'intangible');
const matchRank = matchesOnly.findIndex((s) => s.r.id === targetRune.id) + 1;
console.log(`\nrelevance() PARMI LE SET DEMANDÉ seulement (matchCap=${slotFilterCap}) : rang #${matchRank} / ${matchesOnly.length}`);
