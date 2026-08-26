// Données et logique PURES (aucun effet de bord, aucune lecture de
// `process.argv`) partagées entre `perf-battery.ts` (l'orchestrateur — a des
// effets de bord de CLI en tête de fichier) et `monotonicity-worker.ts` (un
// `worker_threads`, qui ne doit JAMAIS charger de code à effets de bord —
// voir le commentaire de tête de build-half-worker.ts pour le même principe
// déjà appliqué). Extrait de perf-battery.ts pour permettre au mode
// `--monotonicity` de paralléliser ses 7 cas sans risquer de bundler les
// `process.exit()` de l'orchestrateur dans un fil qui ne les attend pas.

import { computeStats } from '../../src/lib/stats';
import { activeSets, StatKey } from '../../src/lib/effects';
import {
  BuildRequirement,
  SearchParams,
  Objective,
  SLOT_FILTER_PRESETS,
  prepareSearch,
  buildBuckets,
} from '../../src/lib/runeBuildOptim';
import { loadDeckMonster } from './deckMonster';
import { drain } from './drain';
import { GearSet, RuneDetail } from '../../src/types';

export interface Case {
  label: string;
  exportPath: string;
  deckId: number;
  monsterName: string;
  defense: boolean;
  statKeys: string[];
  objective: Objective | undefined;
  // ⚠️ `'degats'` retiré de `Objective` (2026-08-27, voir runeBuildOptim.ts)
  // — les cas qui en dépendaient pour privilégier ATQ/Dgts Crit au
  // pré-filtrage passent par CET override explicite à la place
  // (`objective: 'efficience'` + `objectiveStats` ci-dessous), pour mesurer
  // EXACTEMENT le même biais qu'avant, sans dépendre d'un objectif retiré.
  objectiveStats?: StatKey[];
  // Sinon, les sets RÉELLEMENT actifs sur le monstre (le cas courant).
  setsOverride?: string[];
}

// ⚠️ Eivor (défense deck 2, 7 conditions) volontairement ABSENT de cette
// batterie : cas déjà connu comme cassé pour une raison indépendante de
// bucketCap/des tranches (`buildBuckets` dépasse `maxMs` à lui seul, voir
// spec/outils/optimizer/) — l'inclure ralentirait cette batterie à
// chaque exécution sans mesurer ce qu'on cherche à suivre ici.
export const CASES: Case[] = [
  { label: 'Lushen d15 (Rage+Blade, reel)', exportPath: 'ß☆Enzo-6399149.json', deckId: 15, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'efficience', objectiveStats: ['atk', 'cd'] },
  { label: 'Lushen d15 (Rage seul, relache)', exportPath: 'ß☆Enzo-6399149.json', deckId: 15, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'efficience', objectiveStats: ['atk', 'cd'], setsOverride: ['rage'] },
  { label: 'Lushen d10 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 10, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'efficience', objectiveStats: ['atk', 'cd'] },
  { label: 'Lushen d11 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 11, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'efficience', objectiveStats: ['atk', 'cd'] },
  { label: 'Sonia d6 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 6, monsterName: 'Sonia', defense: false, statKeys: ['atk', 'spd', 'cr', 'cd'], objective: 'efficience', objectiveStats: ['atk', 'cd'] },
  { label: 'Sonia d14 (Enzo)', exportPath: 'ß☆Enzo-6399149.json', deckId: 14, monsterName: 'Sonia', defense: false, statKeys: ['atk', 'cr', 'cd', 'spd'], objective: 'efficience', objectiveStats: ['atk', 'cd'] },
  { label: 'Ciri defense eq.3 (Enzo)', exportPath: 'ß☆Enzo-6399149.json', deckId: 32732517, monsterName: 'Ciri', defense: true, statKeys: ['hp', 'def', 'spd', 'acc'], objective: 'ehp' },
];

// Reconstruit le monstre + l'exigence (sets/minStats/mainStats) d'un cas —
// partagé par la mesure de temps ET la vérification de justesse, pour ne
// jamais faire diverger les deux méthodes sur un même cas.
export function loadCase(c: Case): { gear: GearSet; allRunes: RuneDetail[]; targetRuneIds: Set<number>; requirement: BuildRequirement } {
  const { gear, allRunes } = loadDeckMonster({ exportPath: c.exportPath, deckId: c.deckId, monsterName: c.monsterName, defense: c.defense, rest: [] });
  const targetRuneIds = new Set(gear.runes.map((r) => r.id));
  const realSets = activeSets(gear.runes.map((r) => r.set));
  const targetStats = computeStats(gear);
  const minStats: BuildRequirement['minStats'] = {};
  for (const key of c.statKeys) {
    const row = targetStats.find((r) => r.key === key);
    if (row) (minStats as any)[key] = row.total;
  }
  const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
  for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];
  const requirement: BuildRequirement = { sets: c.setsOverride ?? realSets, minStats, mainStats };
  return { gear, allRunes, targetRuneIds, requirement };
}

// ── Vérification de MONOTONICITÉ (voir spec/outils/optimizer/ « BUCKET_CAP
// mis à l'échelle ») — rapide : `buildBuckets` SEUL, jamais `pairBuckets`,
// pas besoin d'appariement complet pour savoir si les runes cible SURVIVENT
// à la rétention. `maxMs` n'a ici aucun effet réel (jamais vérifié en dehors
// de `pairBuckets`) — une valeur fixe suffit.
export interface MonotonicityRow {
  preset: string;
  cap: number;
  bucketCap: number;
  inFilteredPool: boolean;
  halfARetained: boolean;
  halfBRetained: boolean;
}

const MONOTONICITY_MAX_MS = 10 * 60 * 1000; // jamais consulté par buildBuckets seul — juste une valeur plausible pour SearchParams.

export function checkMonotonicityForCase(c: Case): MonotonicityRow[] {
  const { gear, allRunes, targetRuneIds, requirement } = loadCase(c);
  const rows: MonotonicityRow[] = [];
  for (const preset of SLOT_FILTER_PRESETS) {
    const params: SearchParams = {
      base: gear.base, artifacts: gear.artifacts, relic: gear.relic, pool: allRunes, requirement,
      metric: 'eff', objective: c.objective, objectiveStats: c.objectiveStats, maxMs: MONOTONICITY_MAX_MS, slotFilterCap: preset.cap,
      // ⚠️ Pas de `bucketCap` ici : on veut vérifier la résolution PAR
      // DÉFAUT (`bucketCapFor`), le vrai chemin de production.
    };
    const prepared = prepareSearch(params);
    if (!prepared) {
      rows.push({ preset: preset.key, cap: preset.cap, bucketCap: 0, inFilteredPool: false, halfARetained: false, halfBRetained: false });
      continue;
    }
    const inFilteredPool = prepared.filtered.flat().some((r) => targetRuneIds.has(r.id)) && prepared.filtered.every((slotList) => slotList.some((r) => targetRuneIds.has(r.id)));
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB));
    const isTargetHalf = (ids: number[]) => ids.every((id) => targetRuneIds.has(id));
    const halfARetained = bucketsA.some((b) => b.combos.some((combo) => isTargetHalf(combo.runes.map((r) => r.id))));
    const halfBRetained = bucketsB.some((b) => b.combos.some((combo) => isTargetHalf(combo.runes.map((r) => r.id))));
    rows.push({ preset: preset.key, cap: preset.cap, bucketCap: prepared.bucketCap, inFilteredPool, halfARetained, halfBRetained });
  }
  return rows;
}
