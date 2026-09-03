// Pour chacune des 6 runes RÉELLEMENT portées par un monstre choisi, indique
// si elle survit à la contrainte de statistique principale puis au
// pré-filtrage par emplacement (filterSlot) — utile pour distinguer « le
// pré-filtrage par slot a éliminé cette rune » de « elle survit au slot mais
// son demi-combo est ensuite évincé du compartiment » (voir
// spec/outils/optimizer/ « Validation grandeur nature »). Générique :
// monstre/deck viennent des arguments, mainStats dérivé du runage réel.
//
// Usage : monster-search-diag.ts <export.json> <deckId> <nomMonstre> [cap]

import { filterSlot, BuildRequirement } from '../src/lib/runeBuildOptim';
import { activeSets } from '../src/lib/effects';
import { RuneDetail } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';

const USAGE = 'Usage: monster-search-diag.ts <export.json> <deckId> <nomMonstre> [cap]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const cap = Number(process.argv[5] || 40);

const { gear, allRunes } = loadDeckMonster(args);
const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
for (const r of allRunes) bySlot[r.slot - 1].push(r);

const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];
const requirement: BuildRequirement = {
  sets: activeSets(gear.runes.map((r) => r.set)),
  minStats: {},
  mainStats,
};

for (const lr of gear.runes) {
  const allowed = requirement.mainStats?.[lr.slot as 2 | 4 | 6];
  const raw = bySlot[lr.slot - 1];
  const pool = allowed ? raw.filter((r) => allowed.includes(r.main.code)) : raw;
  const filtered = filterSlot(pool, requirement, gear.base, cap, cap);
  const survit = filtered.some((r) => r.id === lr.id);
  console.log(
    `slot ${lr.slot} (id ${lr.id}, set ${lr.set}) : brut=${raw.length} → après mainstat=${pool.length} → pré-filtré=${filtered.length} → survit=${survit ? 'OUI' : 'NON'}`
  );
}
