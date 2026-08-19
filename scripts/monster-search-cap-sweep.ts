// Balaie plusieurs valeurs de slotFilterCap (ou une seule, en argument) pour
// mesurer à partir de quel pré-filtrage par emplacement le moteur retrouve le
// runage RÉEL d'un monstre d'un vrai compte. A servi à calibrer BUCKET_CAP —
// voir spec/outils/optimizer/ « Validation grandeur nature ». Générique :
// monstre/deck viennent des arguments, mainStats dérivé du runage réel.
//
// Usage : monster-search-cap-sweep.ts <export.json> <deckId> <nomMonstre> [cap]

import { searchBuilds, BuildRequirement, SearchParams } from '../src/lib/runeBuildOptim';
import { computeStats } from '../src/lib/stats';
import { activeSets } from '../src/lib/effects';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';

const USAGE = 'Usage: monster-search-cap-sweep.ts <export.json> <deckId> <nomMonstre> [cap]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const ONLY_CAP = process.argv[5] ? Number(process.argv[5]) : null;

const { gear, allRunes } = loadDeckMonster(args);
const targetRuneIds = new Set(gear.runes.map((r) => r.id));
const targetSets = activeSets(gear.runes.map((r) => r.set));

const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];

const targetStats = computeStats(gear);
const minStats: BuildRequirement['minStats'] = {};
for (const row of targetStats) minStats[row.key] = row.total;
const requirement: BuildRequirement = { sets: targetSets, minStats, mainStats };

for (const cap of ONLY_CAP != null ? [ONLY_CAP] : [40, 60, 80]) {
  const t0 = performance.now();
  const params: SearchParams = {
    base: gear.base,
    artifacts: gear.artifacts,
    relic: gear.relic,
    pool: allRunes,
    requirement,
    metric: 'eff',
    maxMs: 60_000,
    maxNodes: 20_000_000,
    slotFilterCap: cap,
  };
  const res = searchBuilds(params);
  const ms = performance.now() - t0;
  const foundExact = res.candidates.some((c) => c.runeIds.length === 6 && c.runeIds.every((id) => targetRuneIds.has(id)));
  console.log(
    `cap=${cap} → temps=${ms.toFixed(0)}ms  explorés=${res.explored.toLocaleString('fr-FR')}  ` +
      `candidats=${res.candidates.length}  exact=${foundExact ? 'OUI' : 'non'}  tronqué=${res.truncated}`
  );
}
