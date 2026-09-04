// Benchmark du moteur de recherche de builds (Outils · Optimizer), à des
// tailles de pool proches de comptes réels — voir spec/compte/runes.md
// (comptes réels à plusieurs milliers de runes) et
// .claude/skills/algo-verify/SKILL.md (« toute constante ajustable doit être
// calibrée sur des jeux synthétiques d'au moins 500/1000/2000/3000+
// éléments »).
//
// ⚠️ Mesure, ne vérifie rien : pas de assertions, pas dans `npm test`. Lancé
// à la demande via `npm run benchmark:optim`.

import { BaseStats, RuneDetail } from '../src/types';
import { BuildRequirement, SearchParams, searchBuilds } from '../src/lib/runeBuildOptim';
// Pool synthétique PARTAGÉ — voir scripts/lib/randomPool.ts.
import { SETS_VARIES, mulberry32, randomPool } from './lib/randomPool';

// ⚠️ Ce benchmark raisonne en taille TOTALE de pool, pas par emplacement —
// d'où la division par 6 (le pool obtenu compte donc `6 × round(totalSize/6)`
// runes, pas exactement `totalSize`). Comportement d'origine, conservé pour
// que les mesures restent comparables aux précédentes.
const poolDeTaille = (totalSize: number, seed: number): RuneDetail[] =>
  randomPool(mulberry32(seed), Math.round(totalSize / 6), SETS_VARIES);

const BASE: BaseStats = { hp: 10000, atk: 600, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

interface Scenario {
  label: string;
  requirement: BuildRequirement;
}

const SCENARIOS: Scenario[] = [
  { label: 'aucune contrainte', requirement: { sets: [], minStats: {} } },
  { label: 'set 4+2 seul', requirement: { sets: ['violent', 'will'], minStats: {} } },
  {
    // Le cas réellement remonté : un set + quelques minimums modérés.
    label: 'set 4+2 + 2 minimums (cas réel)',
    requirement: { sets: ['violent', 'will'], minStats: { spd: 130, hp: 11000 } },
  },
  {
    label: 'set 2+2+2 + 3 minimums (serré)',
    requirement: { sets: ['will', 'shield', 'fight'], minStats: { spd: 140, hp: 12000, cr: 40 } },
  },
];

const POOL_SIZES = [500, 1000, 2000, 3000, 5000];

interface Config {
  label: string;
  params: Partial<SearchParams>;
}

const CONFIGS: Config[] = [
  { label: 'défaut (plafond de collecte réel)', params: {} },
  { label: 'plafond relevé (10000 collectés)', params: { maxCollected: 10_000 } },
];

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

async function main() {
  console.log('Benchmark Optimizer — meet-in-the-middle\n');
  console.log(
    ['pool', 'scénario', 'config', 'temps (ms)', 'paires', 'candidats', 'tronqué'].join(' | ')
  );
  console.log('-'.repeat(100));

  for (const poolSize of POOL_SIZES) {
    const pool = poolDeTaille(poolSize, poolSize);
    for (const scenario of SCENARIOS) {
      for (const config of CONFIGS) {
        const params: SearchParams = {
          base: BASE,
          artifacts: [],
          pool,
          requirement: scenario.requirement,
          metric: 'eff',
          ...config.params,
        };
        const t0 = performance.now();
        const res = searchBuilds(params);
        const ms = performance.now() - t0;
        console.log(
          [
            fmt(poolSize).padStart(6),
            scenario.label.padEnd(30),
            config.label.padEnd(38),
            ms.toFixed(1).padStart(9),
            fmt(res.explored).padStart(8),
            fmt(res.candidates.length).padStart(9),
            res.truncated ? 'oui' : 'non',
          ].join(' | ')
        );
      }
    }
  }
}

main();
