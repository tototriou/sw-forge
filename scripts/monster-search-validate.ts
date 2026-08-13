// Retrouve un monstre RÉEL d'un deck d'offense de siège en ne donnant à la
// recherche QU'UN SOUS-ENSEMBLE de stats en critère (au lieu des 8) — utile
// pour vérifier que l'Optimizer retrouve un build réel même quand le joueur
// ne se soucie que de quelques stats précises, comme il le ferait à l'écran.
// Utilise le moteur de PRODUCTION (searchBuilds, mêmes défauts que l'écran
// Optimizer) — voir monster-search-benchmark.ts pour une comparaison entre
// plusieurs stratégies d'algorithme, ce qui n'est PAS le but ici. Générique :
// monstre/deck/stats viennent des arguments, rien n'est en dur.
//
// Usage : monster-search-validate.ts <export.json> <deckId> <nomMonstre> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80] [bucketCap] [maxNodes] [maxMs=180000]

import { computeStats } from '../src/lib/stats';
import { activeSets, StatKey } from '../src/lib/effects';
import { searchBuilds, BuildRequirement, SearchParams, Objective } from '../src/lib/runeBuildOptim';
import { ArtifactDetail, BaseStats, RelicDetail } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';

const USAGE =
  'Usage: monster-search-validate.ts <export.json> <deckId> <nomMonstre> [--defense] [statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80] [bucketCap] [maxNodes] [maxMs=180000]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const statKeysArg = args.rest[0] ?? 'atk,cr,cd';
const statKeys = statKeysArg.split(',').map((s) => s.trim()) as StatKey[];
const objectiveArg = args.rest[1] ?? 'degats';
const objective = (objectiveArg === 'none' ? undefined : objectiveArg) as Objective | undefined;
// ⚠️ Défaut à 80 (preset « Moyen », le vrai défaut de l'app) — PAS 300
// (« Extrême ») comme les premières versions de ce script : un utilisateur
// réel qui n'a pas touché au pré-filtrage tourne à 80, pas 300, et NE
// choisit PAS non plus de laisser l'objectif vide.
const slotFilterCap = args.rest[2] ? Number(args.rest[2]) : 80;

const { gear, allRunes } = loadDeckMonster(args);

const targetRuneIds = new Set(gear.runes.map((r) => r.id));
const targetSets = activeSets(gear.runes.map((r) => r.set));
const targetStats = computeStats(gear);

console.log(`\n=== ${args.monsterName} — deck ${args.deckId} ===`);
console.log(`Sets actifs réels : ${targetSets.join(' + ') || '(aucun)'}`);
console.log(`Ids de runes réels : [${[...targetRuneIds].sort((a, b) => a - b).join(', ')}]`);
console.log('Stats réelles complètes (les 8) :');
for (const row of targetStats) console.log(`  ${row.label.padEnd(12)} total ${row.total}${row.suffix}`);

// Contrainte de statistique principale (slots 2/4/6) dérivée du VRAI runage —
// c'est ce qu'un joueur qui reconnaît son propre build coderait à l'écran,
// pas quelque chose que la recherche doit deviner.
const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];

const base: BaseStats = gear.base;
const artifacts: ArtifactDetail[] = gear.artifacts;
const relic: RelicDetail | undefined = gear.relic;

const minStats: BuildRequirement['minStats'] = {};
for (const key of statKeys) {
  const row = targetStats.find((r) => r.key === key);
  if (row) minStats[key] = row.total;
}
const requirement: BuildRequirement = { sets: targetSets, minStats, mainStats };

console.log(`\nCritères de recherche RESTREINTS (${statKeys.join(', ')}) :`, minStats);
console.log('Statistique principale imposée (dérivée du runage réel) :', mainStats);
console.log(`\nInventaire complet : ${allRunes.length} runes.`);

const params: SearchParams = {
  base,
  artifacts,
  relic,
  pool: allRunes,
  requirement,
  metric: 'eff',
  objective,
  slotFilterCap,
  maxMs: args.rest[5] ? Number(args.rest[5]) : 180_000,
  bucketCap: args.rest[3] ? Number(args.rest[3]) : undefined,
  maxNodes: args.rest[4] ? Number(args.rest[4]) : undefined,
};

console.log('\nRecherche en cours (peut prendre jusqu\'à quelques dizaines de secondes)...');
const t0 = performance.now();
const res = searchBuilds(params);
const ms = performance.now() - t0;

console.log(
  `\n=== Résultat (${(ms / 1000).toFixed(1)} s, ${res.explored.toLocaleString('fr-FR')} paires explorées, ` +
    `${res.candidates.length} candidats, ${res.truncated ? 'tronqué' : 'exhaustif'}) ===`
);

const exact = res.candidates.find((c) => c.runeIds.length === 6 && c.runeIds.every((id) => targetRuneIds.has(id)));
console.log(exact ? '✅ Le runage RÉEL exact a été retrouvé parmi les candidats.' : "❌ Le runage réel exact n'a PAS été retrouvé tel quel.");

if (res.candidates.length > 0) {
  const best = res.candidates.reduce((a, b) => (b.effTotal > a.effTotal ? b : a));
  const overlap = best.runeIds.filter((id) => targetRuneIds.has(id)).length;
  console.log(
    `\nMeilleur candidat trouvé (efficience totale) : [${best.runeIds
      .slice()
      .sort((a, b) => a - b)
      .join(', ')}] — ${overlap}/6 runes en commun avec le build réel.`
  );
  for (const row of best.stats) console.log(`  ${row.label.padEnd(12)} total ${row.total}${row.suffix}`);
}
