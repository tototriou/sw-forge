// Benchmark du moteur de recherche de builds (Outils · Optimizer), à des
// tailles de pool proches de comptes réels — voir spec/compte/runes.md
// (comptes réels à plusieurs milliers de runes) et
// .claude/skills/algo-verify/SKILL.md (« toute constante ajustable doit être
// calibrée sur des jeux synthétiques d'au moins 500/1000/2000/3000+
// éléments »).
//
// ⚠️ Mesure, ne vérifie rien : pas de assertions, pas dans `npm test`. Lancé
// à la demande via `npm run benchmark:optim`.

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import { BuildRequirement, SearchParams, searchBuilds } from '../src/lib/runeBuildOptim';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SET_KEYS = ['violent', 'swift', 'despair', 'will', 'shield', 'fight', 'focus', 'endure', 'intangible'];
const STAT_CODES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

function randomRune(id: number, slot: number, rng: () => number): RuneDetail {
  const set = SET_KEYS[Math.floor(rng() * SET_KEYS.length)];
  const mainCode = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
  const used = new Set([mainCode]);
  const subs: EffectLine[] = [];
  for (let i = 0; i < 4; i++) {
    let code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
    let tries = 0;
    while (used.has(code) && tries < 10) {
      code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
      tries++;
    }
    used.add(code);
    subs.push({ code, value: 5 + Math.floor(rng() * 40) });
  }
  return {
    id,
    slot,
    set,
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: mainCode, value: 10 + Math.floor(rng() * 100) },
    subs,
  };
}

// Réparti également sur les 6 slots, comme un vrai inventaire.
function randomPool(totalSize: number, seed: number): RuneDetail[] {
  const rng = mulberry32(seed);
  const perSlot = Math.round(totalSize / 6);
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) {
    for (let i = 0; i < perSlot; i++) out.push(randomRune(id++, slot, rng));
  }
  return out;
}

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
  { label: 'défaut (500 collectés / 400k paires)', params: {} },
  { label: 'plafond relevé (5000 collectés / 2M paires)', params: { maxCollected: 5000, maxNodes: 2_000_000 } },
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
    const pool = randomPool(poolSize, poolSize);
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
