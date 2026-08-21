// Point 4 (spec/outils/optimizer/) : mesure si une stat de `retentionKeys`
// DIFFÉRENCIE vraiment les demi-builds, ou si presque tous les demi-builds
// déjà bons (par `relevanceScore`, la tranche générique) l'ont de toute
// façon — c'est CE signal, pas `diagnoseFeasibility` (écarté, voir
// discussion), qui doit piloter une répartition adaptative du budget par
// tranche dans `buildBuckets`.
//
// Méthode : pour chaque moitié, regrouper tous les demi-builds retenus
// (toutes tranches confondues, déjà fusionnées dans `bucket.combos`), trier
// par `relevanceScore` (le critère de la tranche générique), garder les
// `bucketCap` meilleurs — reconstruit fidèlement la population de la
// tranche générique SANS avoir besoin d'un accès aux tranches internes
// avant fusion. Sur cette population, mesurer la dispersion (coefficient de
// variation = écart-type / moyenne) de `retentionScore(pct, flat, key)` —
// EXACTEMENT la métrique utilisée par le vrai classement par tranche (voir
// `retentionScore` dans runeBuildOptim.ts), pas une reformulation.
//
// Usage : retention-dispersion-diag.ts

import { computeStats } from '../src/lib/stats';
import { activeSets } from '../src/lib/effects';
import { parseAccountSource, parseAccountInventory } from '../src/lib/importAccount';
import { BuildRequirement, SearchParams, Objective, prepareSearch, buildBuckets, HalfCombo } from '../src/lib/runeBuildOptim';
import { BaseStats } from '../src/types';
import { loadDeckMonster } from './lib/deckMonster';
import { readFileSync } from 'fs';
import { drain } from './lib/drain';

// Pondéré par `base`, comme `weightedContribution`/`retentionScore` réels
// (runeBuildOptim.ts) depuis le correctif pct/flat — un `%` (PV/ATQ/DEF)
// s'applique à `base[key]`, pas la même échelle qu'un plat.
function retentionScoreLocal(base: BaseStats, pct: Record<string, number>, flat: Record<string, number>, key: string): number {
  const b = (base as unknown as Record<string, number>)[key] ?? 0;
  const p = pct[key] ?? 0;
  const f = flat[key] ?? 0;
  return key === 'hp' || key === 'atk' || key === 'def' ? Math.ceil((b * p) / 100) + f : f;
}

function dispersion(values: number[]): { mean: number; stdev: number; cv: number; min: number; max: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  return { mean, stdev, cv: mean !== 0 ? stdev / mean : 0, min: Math.min(...values), max: Math.max(...values) };
}

function reportHalf(label: string, half: 'A' | 'B', combos: HalfCombo[], bucketCap: number, retentionKeys: string[], base: BaseStats) {
  const sorted = [...combos].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const pop = sorted.slice(0, Math.min(bucketCap, sorted.length));
  console.log(`  Moitié ${half} — population générique reconstituée : ${pop.length}/${combos.length} demi-builds`);
  for (const key of retentionKeys) {
    const values = pop.map((c) => retentionScoreLocal(base, c.pct, c.flat, key));
    const d = dispersion(values);
    console.log(
      `    ${key.padEnd(4)} moyenne=${d.mean.toFixed(2)}  écart-type=${d.stdev.toFixed(2)}  CV=${d.cv.toFixed(3)}  [min=${d.min.toFixed(2)} max=${d.max.toFixed(2)}]`
    );
  }
}

function runPrepared(label: string, params: SearchParams) {
  console.log(`\n=== ${label} ===`);
  const prepared = prepareSearch(params);
  if (!prepared) {
    console.log('  prepareSearch = null');
    return;
  }
  if (prepared.retentionKeys.length === 0) {
    console.log('  Aucune retentionKey (aucun minimum posé, aucun objectif) — rien à mesurer.');
    return;
  }
  console.log(`  retentionKeys=[${prepared.retentionKeys.join(', ')}]  bucketCap=${prepared.bucketCap}`);
  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA)
  );
  const bucketsB = drain(
    buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB)
  );
  const combosA = bucketsA.flatMap((b) => b.combos);
  const combosB = bucketsB.flatMap((b) => b.combos);
  reportHalf(label, 'A', combosA, prepared.bucketCap, prepared.retentionKeys, prepared.base);
  reportHalf(label, 'B', combosB, prepared.bucketCap, prepared.retentionKeys, prepared.base);
}

// ── Les deux scénarios synthétiques (même pool réel, seul le mainstat du
// slot 4 change) — voir la discussion sur le mainstat/TC. ──────────────────
function runSyntheticScenarios() {
  const raw = readFileSync('ß☆Enzo-6399149.json', 'utf8');
  const data = parseAccountSource(raw)!;
  const { runes: pool } = parseAccountInventory(data);
  const base: BaseStats = { hp: 10000, atk: 700, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
  // ⚠️ atk=2900 (pas 3000) : la mesure diagnoseFeasibility précédente a
  // révélé que 3000 est INFAISABLE pour le scénario 1 (bound=2990, mainstat
  // slot4=TC laisse moins de place à l'ATQ) — prepareSearch renvoyait null.
  // 2900 reste sous cette borne pour les DEUX scénarios, comparables.
  const minStats: BuildRequirement['minStats'] = { atk: 2900, spd: 150, cd: 200, cr: 100 };

  function scenario(label: string, mainStats: NonNullable<BuildRequirement['mainStats']>) {
    const requirement: BuildRequirement = { sets: [], minStats, mainStats };
    const params: SearchParams = { base, artifacts: [], relic: undefined, pool, requirement, metric: 'eff', slotFilterCap: 80 };
    runPrepared(label, params);
  }

  // Codes stat (effects.ts) : 4=ATQ% 8=VIT 9=Taux Crit 10=Dmg Crit
  scenario('Synthétique 1 — Vitesse/TC/ATQ (slot4=TC)', { 2: [8], 4: [9], 6: [4] });
  scenario('Synthétique 2 — ATQ/Dégâts Crit/ATQ (slot4=DCC)', { 2: [4], 4: [10], 6: [4] });
}

// ── La même batterie de cas réels que perf-battery.ts. ─────────────────────
interface Case {
  label: string;
  exportPath: string;
  deckId: number;
  monsterName: string;
  defense: boolean;
  statKeys: string[];
  objective: Objective | undefined;
  setsOverride?: string[];
}
const CASES: Case[] = [
  { label: 'Lushen d15 (Rage+Blade, reel)', exportPath: 'ß☆Enzo-6399149.json', deckId: 15, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'degats' },
  { label: 'Lushen d15 (Rage seul, relache)', exportPath: 'ß☆Enzo-6399149.json', deckId: 15, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'degats', setsOverride: ['rage'] },
  { label: 'Lushen d10 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 10, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'degats' },
  { label: 'Lushen d11 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 11, monsterName: 'Lushen', defense: false, statKeys: ['atk', 'cr', 'cd'], objective: 'degats' },
  { label: 'Sonia d6 (tototriou)', exportPath: 'tototriou-12889591.json', deckId: 6, monsterName: 'Sonia', defense: false, statKeys: ['atk', 'spd', 'cr', 'cd'], objective: 'degats' },
  { label: 'Sonia d14 (Enzo)', exportPath: 'ß☆Enzo-6399149.json', deckId: 14, monsterName: 'Sonia', defense: false, statKeys: ['atk', 'cr', 'cd', 'spd'], objective: 'degats' },
  { label: 'Ciri defense eq.3 (Enzo)', exportPath: 'ß☆Enzo-6399149.json', deckId: 32732517, monsterName: 'Ciri', defense: true, statKeys: ['hp', 'def', 'spd', 'acc'], objective: 'ehp' },
];

function runBattery() {
  for (const c of CASES) {
    const { gear, allRunes } = loadDeckMonster({ exportPath: c.exportPath, deckId: c.deckId, monsterName: c.monsterName, defense: c.defense, rest: [] });
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
    const params: SearchParams = { base: gear.base, artifacts: gear.artifacts, relic: gear.relic, pool: allRunes, requirement, metric: 'eff', objective: c.objective, slotFilterCap: 80 };
    runPrepared(c.label, params);
  }
}

runSyntheticScenarios();
runBattery();
