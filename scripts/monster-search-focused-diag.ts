// Diagnostic TEMPORAIRE : reproduit EXACTEMENT la recherche telle qu'un
// utilisateur la lance dans l'écran Optimizer — y compris l'exclusion des
// runes portées par les AUTRES monstres de la box (« Explorer tout
// l'inventaire » décochée, le défaut) — contrairement aux autres scripts
// monster-search-*-diag.ts qui utilisent l'inventaire COMPLET sans exclusion
// (`allRunes` brut). Sert à vérifier si un signalement « je ne trouve pas ce
// build » vient de la recherche elle-même, ou de la taille du pool réel une
// fois l'exclusion appliquée.
//
// Usage : monster-search-focused-diag.ts <export.json> <deckId> <nomMonstre> [statKeys=atk,spd,cr,cd] [objective=none] [slotFilterCap=80] [--explore-all]

import { resolveObjectifCli } from './lib/objectifCli';
import { computeStats } from '../src/lib/stats';
import { activeSets } from '../src/lib/effects';
import { searchBuilds, excludedRuneIds, BuildRequirement, SearchParams, adaptiveMaxNodes, Objective, prepareSearch, buildBuckets, totalPairCount } from '../src/lib/runeBuildOptim';
import { parseAccountSource, parseAccountBox, parseSiegeDefense, parseSiegeOffense } from '../src/lib/importAccount';
import { BaseStats } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';
import { readFileSync } from 'fs';
import { drain } from './lib/drain';

const USAGE = 'Usage: monster-search-focused-diag.ts <export.json> <deckId> <nomMonstre> [statKeys=atk,spd,cr,cd] [objective=none] [slotFilterCap=80] [--explore-all]';
const exploreAll = process.argv.includes('--explore-all');
const args = parseDeckMonsterArgs(process.argv.slice(2).filter((a) => a !== '--explore-all'), USAGE);
const statKeysArg = args.rest[0] ?? 'atk,spd,cr,cd';
const statKeys = statKeysArg.split(',').map((s) => s.trim());
const objectiveArg = args.rest[1] ?? 'none';
const { objective, objectiveStats } = resolveObjectifCli(objectiveArg);
// ⚠️ Défaut à 80 (preset « Moyen », le vrai défaut de l'app) — PAS 40
// (MAX_PER_SLOT_MATCH, le défaut interne du moteur QUAND l'appelant ne
// précise rien) ni 300 — voir monster-search-pipeline-diag.ts.
const slotFilterCap = args.rest[2] ? Number(args.rest[2]) : 80;
// ⚠️ Surcharge EXPLICITE de maxNodes — jamais exposée dans l'UI, réservée à
// la mesure : répond à « le budget adaptatif est-il trop CONSERVATEUR pour
// CE cas précis (temps réellement écoulé très inférieur au filet de 10 min),
// ou le vrai obstacle est ailleurs (ordre d'exploration) ? ».
const maxNodesOverride = args.rest[3] ? Number(args.rest[3]) : undefined;
const { gear, allRunes } = loadDeckMonster(args);

// Le com2usId RÉEL de Sonia dans ce deck (pas simplement le nom) — nécessaire
// pour reproduire l'exclusion exactement comme excludedRuneIds() le fait.
const raw = readFileSync(args.exportPath, 'utf8');
const data = parseAccountSource(raw)!;
const monstersRaw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const monstersList = Array.isArray(monstersRaw) ? monstersRaw : monstersRaw.monsters;
const nameByCom2us = new Map<number, string>(monstersList.map((m: any) => [m.com2usId, m.name]));
const { decks } = args.defense ? parseSiegeDefense(data) : parseSiegeOffense(data);
const deck = decks.find((d) => d.deckId === args.deckId)!;
const slot = deck.slots.find((s) => s && nameByCom2us.get(s.com2usId) === args.monsterName)!;
const soniaCom2usId = slot.com2usId;

const { monsters: box, error: boxError } = parseAccountBox(data);
if (boxError) console.error('Erreur box :', boxError);
console.log(`Box : ${box.length} monstre(s) 6★.`);

const excluded = exploreAll
  ? new Set<number>()
  : excludedRuneIds(
      box.map((b) => ({ unitKey: String(b.unitId), com2usId: b.com2usId, gear: b.gear })),
      soniaCom2usId
    );
console.log(`Runes exclues (portées par un AUTRE monstre de la box) : ${excluded.size} / ${allRunes.length}`);

const pool = excluded.size === 0 ? allRunes : allRunes.filter((r) => !excluded.has(r.id));
console.log(`Pool transmis au moteur : ${pool.length} runes (${exploreAll ? 'Explorer tout l\'inventaire COCHÉ' : 'défaut, décochée'}).`);
for (let s = 1; s <= 6; s++) console.log(`  slot ${s} : ${pool.filter((r) => r.slot === s).length} runes`);

const targetRuneIds = new Set(gear.runes.map((r) => r.id));
const manquantes = [...targetRuneIds].filter((id) => !pool.some((r) => r.id === id));
console.log(`Runes du build cible absentes du POOL (après exclusion) : ${manquantes.length === 0 ? 'aucune ✓' : manquantes}`);

const targetSets = activeSets(gear.runes.map((r) => r.set));
const targetStats = computeStats(gear);
const minStats: BuildRequirement['minStats'] = {};
for (const key of statKeys) {
  const row = targetStats.find((r) => r.key === key);
  if (row) (minStats as any)[key] = row.total;
}
const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];

const requirement: BuildRequirement = { sets: targetSets, minStats, mainStats };
const base: BaseStats = gear.base;
console.log('\nsets:', targetSets, 'minStats:', minStats, 'mainStats:', mainStats);

if (manquantes.length > 0) {
  console.log('\n⚠️ Le build cible est structurellement IMPOSSIBLE à retrouver : au moins une de ses propres runes a été exclue du pool.');
  process.exit(0);
}

// ⚠️ maxMs EXPLICITE = le vrai filet de sécurité de l'écran (10 min,
// HARD_TIMEOUT_MS dans OptimizerSection.tsx) — SANS lui, searchBuilds()
// retombe sur DEFAULT_MAX_MS (15s SEULEMENT), une troncature bien plus
// courte que ce que l'app réelle laisse tourner, qui fausserait la mesure.
const params: SearchParams = {
  base, artifacts: gear.artifacts, relic: gear.relic, pool, requirement, metric: 'eff', slotFilterCap, objective,
  maxMs: 10 * 60 * 1000, maxNodes: maxNodesOverride,
};
console.log(`objective=${objective ?? '(aucun)'} slotFilterCap=${slotFilterCap}`);
console.log('maxNodes adaptatif utilisé :', adaptiveMaxNodes(params).toLocaleString('fr-FR'));

// ⚠️ totalPairCount, calculé À PART de searchBuilds (qui ne l'expose pas) —
// même prepareSearch/buildBuckets que la vraie recherche, pour comparer
// directement l'estimation affichée à l'écran au nombre réellement explore.
const preparedForEstimate = prepareSearch(params);
if (preparedForEstimate) {
  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], preparedForEstimate, preparedForEstimate.maxSetsForA)
  );
  const bucketsB = drain(
    buildBuckets('B', [3, 4, 5], preparedForEstimate, preparedForEstimate.maxSetsForB)
  );
  const total = totalPairCount(preparedForEstimate, bucketsA, bucketsB);
  console.log(`totalPairCount (pairFeasibleMin + comboAOk) : ${total.toLocaleString('fr-FR')}`);
  console.log(`bucketsA : ${bucketsA.length} compartiment(s), tailles = [${bucketsA.map((b) => b.combos.length).join(', ')}]`);
  console.log(`bucketsB : ${bucketsB.length} compartiment(s), tailles = [${bucketsB.map((b) => b.combos.length).join(', ')}]`);
}

const t0 = performance.now();
const res = searchBuilds(params);
const ms = performance.now() - t0;
const foundExact = res.candidates.some((c) => c.runeIds.length === 6 && c.runeIds.every((id) => targetRuneIds.has(id)));
console.log(`\ntemps=${ms.toFixed(0)}ms explorés=${res.explored.toLocaleString('fr-FR')} trouvés=${res.candidates.length} runage EXACT retrouvé=${foundExact ? 'OUI' : 'NON'} tronqué=${res.truncated}`);
