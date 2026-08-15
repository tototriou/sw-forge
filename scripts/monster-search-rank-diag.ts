// Diagnostic TEMPORAIRE : calcule le RANG exact du demi-build réel (slots
// 1-3, puis 4-6) au sein de son compartiment (même clé exacte de comptage de
// sets), pour CHAQUE tranche de rétention (générique, combinée, par stat —
// voir buildBuckets dans runeBuildOptim.ts) — répond directement à « quelle
// tranche protège ce demi-build, et à quelle taille ? » sans payer le coût
// d'une recherche complète à chaque essai.
//
// Usage : monster-search-rank-diag.ts <export.json> <deckId> <nomMonstre> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80]

import { activeSets, runeEfficiency, RUNE_EFFECT, StatKey } from '../src/lib/effects';
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
  Objective,
} from '../src/lib/runeBuildOptim';
import { BaseStats, RuneDetail } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';

const USAGE =
  'Usage: monster-search-rank-diag.ts <export.json> <deckId> <nomMonstre> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const statKeysArg = args.rest[0] ?? 'atk,cr,cd';
const statKeys = statKeysArg.split(',').map((s) => s.trim()) as StatKey[];
const objectiveArg = args.rest[1] ?? 'degats';
const objective = (objectiveArg === 'none' ? undefined : objectiveArg) as Objective | undefined;
// ⚠️ Défaut à 80 (preset « Moyen », le vrai défaut de l'app) — PAS 300
// (« Extrême ») comme les premières versions de ce script : un utilisateur
// réel qui n'a pas touché au pré-filtrage tourne à 80, pas 300.
const slotFilterCap = args.rest[2] ? Number(args.rest[2]) : 80;

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
const filtered = step3.map((l) => filterSlot(l, requirement, slotFilterCap, slotFilterCap, objective));

console.log(`objective = ${objective ?? '(aucun)'} · slotFilterCap = ${slotFilterCap}`);
console.log('Tailles après pipeline complet :', filtered.map((l) => l.length));
console.log('minStats utilisés :', minStats);

// Reproduit runeContribution (privée à runeBuildOptim.ts) pour ce diagnostic.
function contribution(rune: RuneDetail, key: StatKey): { pct: number; flat: number } {
  let pct = 0;
  let flat = 0;
  const add = (code: number, value: number) => {
    const def = RUNE_EFFECT[code];
    if (!def || def.stat !== key) return;
    if (def.pct) pct += value;
    else flat += value;
  };
  add(rune.main.code, rune.main.value);
  if (rune.innate) add(rune.innate.code, rune.innate.value);
  for (const s of rune.subs) add(s.code, s.value);
  return { pct, flat };
}

interface Scored {
  ids: number[];
  counts: number[];
  jokers: number;
  generic: number;
  combined: number;
  perKey: Record<string, number>;
}

function rankInBucket(slotIdxs: [number, number, number], targetIds: number[]) {
  const [i0, i1, i2] = slotIdxs;
  const distinctKeys = Array.from(new Set(requirement.sets));
  const scored: Scored[] = [];
  for (const r0 of filtered[i0]) {
    for (const r1 of filtered[i1]) {
      for (const r2 of filtered[i2]) {
        const runes = [r0, r1, r2];
        const counts = distinctKeys.map((key) => runes.filter((r) => r.set === key).length);
        const jokers = runes.filter((r) => r.set === 'intangible').length;
        const generic = (runeEfficiency(r0) + runeEfficiency(r1) + runeEfficiency(r2)) / 1000;
        const pct: Record<string, number> = {};
        const flat: Record<string, number> = {};
        for (const k of statKeys) {
          let p = 0;
          let f = 0;
          for (const r of runes) {
            const c = contribution(r, k);
            p += c.pct;
            f += c.flat;
          }
          pct[k] = p;
          flat[k] = f;
        }
        let combined = 0;
        for (const { k, min } of minEntries) combined += ((pct[k] ?? 0) + (flat[k] ?? 0)) / min;
        const perKey: Record<string, number> = {};
        for (const k of statKeys) perKey[k] = (pct[k] ?? 0) + (flat[k] ?? 0);
        scored.push({ ids: runes.map((r) => r.id), counts, jokers, generic, combined, perKey });
      }
    }
  }
  const targetCombo = scored.find((s) => s.ids.length === targetIds.length && s.ids.every((id) => targetIds.includes(id)));
  if (!targetCombo) {
    console.log(`  ⚠️ demi-build cible INTROUVABLE parmi les ${scored.length} combos générés.`);
    return;
  }
  const sameBucket = scored.filter((s) => s.counts.join(',') === targetCombo.counts.join(',') && s.jokers === targetCombo.jokers);
  console.log(`  compartiment (counts=[${targetCombo.counts}], jokers=${targetCombo.jokers}) : ${sameBucket.length} demi-builds au total`);

  function rankBy(scoreOf: (s: Scored) => number, label: string) {
    const sorted = sameBucket.slice().sort((a, b) => scoreOf(b) - scoreOf(a));
    const rank = sorted.findIndex((s) => s.ids.every((id) => targetIds.includes(id))) + 1;
    console.log(`    ${label.padEnd(22)} rang #${rank} / ${sameBucket.length} (score cible=${scoreOf(targetCombo).toFixed(3)}, meilleur=${scoreOf(sorted[0]).toFixed(3)})`);
  }
  rankBy((s) => s.generic, 'générique (efficience)');
  if (minEntries.length > 0) rankBy((s) => s.combined, 'combinée (minEntries)');
  for (const k of statKeys) rankBy((s) => s.perKey[k] ?? 0, `stat « ${k} » seule`);
}

console.log('\nMoitié A (slots 1-3) :');
rankInBucket([0, 1, 2], gear.runes.filter((r) => r.slot <= 3).map((r) => r.id));
console.log('\nMoitié B (slots 4-6) :');
rankInBucket([3, 4, 5], gear.runes.filter((r) => r.slot >= 4).map((r) => r.id));
