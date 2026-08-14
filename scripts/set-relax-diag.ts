// Diagnostic TEMPORAIRE : compare une recherche avec le set RÉEL du monstre
// choisi (ex. Rage+Blade) à la MÊME recherche avec un sous-ensemble de ce
// set demandé (ex. Rage seul) — une contrainte RELÂCHÉE devrait UNIQUEMENT
// élargir l'espace de recherche (jamais empêcher de retrouver un build déjà
// trouvable avec la contrainte plus stricte), donc si le build réel est
// retrouvé avec « Rage+Blade » mais pas avec « Rage » seul, quelque chose
// écarte à tort le Blade nécessaire quand il n'est plus explicitement
// demandé.
//
// Usage : set-relax-diag.ts <export.json> <deckId> <nomMonstre> <setsRelaches, ex: rage> [statKeys=atk,cr,cd] [objective=none] [slotFilterCap=80] [--explore-all]

import { computeStats } from '../src/lib/stats';
import { activeSets } from '../src/lib/effects';
import { searchBuilds, excludedRuneIds, BuildRequirement, SearchParams, Objective, prepareSearch, buildBuckets, totalPairCount } from '../src/lib/runeBuildOptim';
import { parseAccountSource, parseAccountBox, parseSiegeDefense, parseSiegeOffense } from '../src/lib/importAccount';
import { BaseStats } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';
import { readFileSync } from 'fs';

const USAGE =
  'Usage: set-relax-diag.ts <export.json> <deckId> <nomMonstre> <setsRelaches, ex: rage> [statKeys=atk,cr,cd] [objective=none] [slotFilterCap=80] [--explore-all]';
const exploreAll = process.argv.includes('--explore-all');
const positional = process.argv.slice(2).filter((a) => a !== '--explore-all');
const args = parseDeckMonsterArgs(positional.slice(0, 3), USAGE);
const relaxedSetsArg = positional[3];
if (!relaxedSetsArg) {
  console.error(USAGE);
  process.exit(1);
}
const relaxedSets = relaxedSetsArg.split(',').map((s) => s.trim());
const statKeysArg = positional[4] ?? 'atk,cr,cd';
const statKeys = statKeysArg.split(',').map((s) => s.trim());
const objectiveArg = positional[5] ?? 'none';
const objective = (objectiveArg === 'none' ? undefined : objectiveArg) as Objective | undefined;
const slotFilterCap = positional[6] ? Number(positional[6]) : 80;
const bucketCapOverride = positional[7] ? Number(positional[7]) : undefined;

const { gear, allRunes } = loadDeckMonster(args);

const raw = readFileSync(args.exportPath, 'utf8');
const data = parseAccountSource(raw)!;
const monstersRaw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const monstersList = Array.isArray(monstersRaw) ? monstersRaw : monstersRaw.monsters;
const nameByCom2us = new Map<number, string>(monstersList.map((m: any) => [m.com2usId, m.name]));
const { decks } = args.defense ? parseSiegeDefense(data) : parseSiegeOffense(data);
const deck = decks.find((d) => d.deckId === args.deckId)!;
const slot = deck.slots.find((s) => s && nameByCom2us.get(s.com2usId) === args.monsterName)!;
const monsterCom2usId = slot.com2usId;

const { monsters: box } = parseAccountBox(data);
const excluded = exploreAll
  ? new Set<number>()
  : excludedRuneIds(
      box.map((b) => ({ unitKey: String(b.unitId), com2usId: b.com2usId, gear: b.gear })),
      monsterCom2usId
    );
const pool = excluded.size === 0 ? allRunes : allRunes.filter((r) => !excluded.has(r.id));

const targetRuneIds = new Set(gear.runes.map((r) => r.id));
const realSets = activeSets(gear.runes.map((r) => r.set));
const targetStats = computeStats(gear);
const minStats: BuildRequirement['minStats'] = {};
for (const key of statKeys) {
  const row = targetStats.find((r) => r.key === key);
  if (row) (minStats as any)[key] = row.total;
}
const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];
const base: BaseStats = gear.base;

console.log(`Sets réels du monstre : ${realSets.join('+')}`);
console.log(`minStats : ${JSON.stringify(minStats)}  mainStats : ${JSON.stringify(mainStats)}`);
console.log(`Pool : ${pool.length} runes (${exploreAll ? 'tout l\'inventaire' : 'box, exclusion appliquée'})`);

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

function testWith(label: string, sets: string[]) {
  console.log(`\n=== ${label} (sets demandés = [${sets.join(',')}]) ===`);
  const requirement: BuildRequirement = { sets, minStats, mainStats };
  const params: SearchParams = { base, artifacts: gear.artifacts, relic: gear.relic, pool, requirement, metric: 'eff', slotFilterCap, objective, maxMs: 10 * 60 * 1000, bucketCap: bucketCapOverride };

  const prepared = prepareSearch(params);
  if (!prepared) {
    console.log('prepareSearch = null (au moins un emplacement vide après pré-filtrage)');
    return;
  }
  console.log(`bucketCap utilisé : ${prepared.bucketCap}`);
  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces)
  );
  const bucketsB = drain(
    buildBuckets('B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces)
  );
  console.log(`filtered (par slot) : ${prepared.filtered.map((l) => l.length).join(', ')}`);
  for (const tr of gear.runes) {
    const survives = prepared.filtered[tr.slot - 1].some((r) => r.id === tr.id);
    console.log(`  rune réelle slot ${tr.slot} (id ${tr.id}, set ${tr.set}) : ${survives ? 'survit à filterSlot' : '❌ ÉLIMINÉE avant buildBuckets'}`);
  }
  console.log(`bucketsA : ${bucketsA.length} compartiment(s), tailles = [${bucketsA.map((b) => b.combos.length).join(', ')}]`);
  console.log(`bucketsB : ${bucketsB.length} compartiment(s), tailles = [${bucketsB.map((b) => b.combos.length).join(', ')}]`);

  const targetIdsA = gear.runes.filter((r) => r.slot <= 3).map((r) => r.id);
  const targetIdsB = gear.runes.filter((r) => r.slot >= 4).map((r) => r.id);
  function findRank(buckets: typeof bucketsA, targetIds: number[]) {
    for (let bi = 0; bi < buckets.length; bi++) {
      const idx = buckets[bi].combos.findIndex((c) => c.runes.every((r) => targetIds.includes(r.id)) && c.runes.length === targetIds.length);
      if (idx >= 0) return { bucketRank: bi + 1, bucketTotal: buckets.length, comboRank: idx + 1, comboTotal: buckets[bi].combos.length };
    }
    return null;
  }
  const rankA = findRank(bucketsA, targetIdsA);
  const rankB = findRank(bucketsB, targetIdsB);
  console.log(`demi-build réel A : ${rankA ? `compartiment #${rankA.bucketRank}/${rankA.bucketTotal}, rang #${rankA.comboRank}/${rankA.comboTotal}` : '❌ ABSENT de tous les compartiments retenus'}`);
  console.log(`demi-build réel B : ${rankB ? `compartiment #${rankB.bucketRank}/${rankB.bucketTotal}, rang #${rankB.comboRank}/${rankB.comboTotal}` : '❌ ABSENT de tous les compartiments retenus'}`);

  const total = totalPairCount(prepared, bucketsA, bucketsB);
  console.log(`totalPairCount : ${total.toLocaleString('fr-FR')}`);

  const t0 = performance.now();
  const res = searchBuilds(params);
  const ms = performance.now() - t0;
  const foundExact = res.candidates.some((c) => c.runeIds.length === 6 && c.runeIds.every((id) => targetRuneIds.has(id)));
  console.log(`temps=${ms.toFixed(0)}ms explorés=${res.explored.toLocaleString('fr-FR')} trouvés=${res.candidates.length} runage EXACT retrouvé=${foundExact ? 'OUI' : 'NON'} tronqué=${res.truncated}`);
}

testWith('Set réel complet', realSets);
testWith('Set relâché', relaxedSets);
