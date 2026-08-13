// Suite de la Phase 0 : la mesure précédente (benchmark-bucket-retention.ts)
// a montré que sous les VRAIS budgets de production (MAX_COLLECTED=5000,
// DEFAULT_MAX_NODES=400 000), `maxCollected` coupe TOUJOURS la recherche en
// premier, avant que `bucketCap` n'ait la moindre importance — et donc avant
// que la recherche n'ait exploré grand-chose de l'espace réel. Cette mesure-
// ci répond à la question directe qui en découle : si on accepte d'attendre
// plus longtemps (jusqu'à ~1 minute, jugé acceptable), qu'est-ce que ça
// achète réellement en qualité de résultat ?
//
// bucketCap et slotFilterCap restent FIXES aux valeurs de production
// (5000 et 80, le preset « Moyen » — bucketCap relevé une seconde fois
// depuis, voir spec/outils/optimizer.md) — seul le budget de collecte
// (`maxCollected`/`maxNodes`) varie, avec un temps de mur mesuré à chaque
// palier pour vérifier qu'on reste bien dans l'ordre de grandeur annoncé.
//
// ⚠️ Mesure, ne vérifie rien : pas d'assertions, pas dans `npm test`. Lancé à
// la demande via `npm run benchmark:search-budget`.

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

function randomPool(perSlot: number, seed: number): RuneDetail[] {
  const rng = mulberry32(seed);
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
  { label: 'set 4+2 seul', requirement: { sets: ['violent', 'will'], minStats: {} } },
  {
    label: 'set 4+2 + 2 minimums (cas réel)',
    requirement: { sets: ['violent', 'will'], minStats: { spd: 130, hp: 11000 } },
  },
  {
    label: 'set 2+2+2 + 3 minimums (serré)',
    requirement: { sets: ['will', 'shield', 'fight'], minStats: { spd: 140, hp: 12000, cr: 40 } },
  },
  {
    label: 'set 4 seul + 1 maximum (RES plafonné)',
    requirement: { sets: ['violent'], minStats: {}, maxStats: { res: 40 } },
  },
];

// bucketCap et slotFilterCap FIXES aux valeurs de production — seul le budget
// de collecte change ici. maxNodes suit largement au-dessus de maxCollected
// à chaque palier pour ne jamais devenir le facteur limitant à sa place.
const PRODUCTION_BUCKET_CAP = 1500; // valeur de production réelle (BUCKET_CAP, par tranche depuis la 3e recalibration)
// ⚠️ Testé aux DEUX presets réels, pas seulement « Moyen » : à 300/slot
// (« Extrême »), la construction des compartiments (O(slotFilterCap³), fixe
// quel que soit `maxCollected`) domine largement le temps total — 20 à 55 s
// avant même que le budget de collecte n'entre en jeu, et relever
// `maxCollected` n'y change ni la qualité ni le temps de façon notable.
// Repasser `PRODUCTION_SLOT_FILTER_CAP`/`POOL_PER_SLOT` à 300 pour le
// revérifier (compter plusieurs minutes pour les 4 scénarios).
const PRODUCTION_SLOT_FILTER_CAP = 80; // preset « Moyen », le défaut réel de l'app

const MAX_COLLECTED_LEVELS = [5_000, 20_000, 50_000, 100_000, 250_000];

const POOL_PER_SLOT = 80;

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

async function main() {
  console.log('Suite Phase 0 — augmenter le budget de collecte améliore-t-il vraiment le résultat ?');
  console.log(`bucketCap=${PRODUCTION_BUCKET_CAP} · slotFilterCap=${PRODUCTION_SLOT_FILTER_CAP} (valeurs de production, fixes)\n`);

  const pool = randomPool(POOL_PER_SLOT, POOL_PER_SLOT);

  for (const scenario of SCENARIOS) {
    console.log(`\n${'─'.repeat(90)}`);
    console.log(`scénario: ${scenario.label}`);
    console.log(['maxCollected', 'meilleur effTotal', '% du plafond testé', 'candidats', 'paires', 'temps (ms)'].join(' | '));

    let ceiling = 0;
    const rows: { cap: number; best: number; count: number; explored: number; ms: number; truncated: boolean }[] = [];

    for (const cap of MAX_COLLECTED_LEVELS) {
      const params: SearchParams = {
        base: BASE,
        artifacts: [],
        pool,
        requirement: scenario.requirement,
        metric: 'eff',
        bucketCap: PRODUCTION_BUCKET_CAP,
        slotFilterCap: PRODUCTION_SLOT_FILTER_CAP,
        maxCollected: cap,
        maxNodes: Math.max(cap * 50, 5_000_000), // très large, pour que ce ne soit jamais lui le facteur limitant
        maxMs: 90_000, // marge au-delà de la minute « acceptable » annoncée
      };
      const t0 = performance.now();
      const res = searchBuilds(params);
      const ms = performance.now() - t0;
      const best = res.candidates.reduce((m, c) => Math.max(m, c.effTotal), 0);
      if (best > ceiling) ceiling = best;
      rows.push({ cap, best, count: res.candidates.length, explored: res.explored, ms, truncated: res.truncated });
    }

    for (const r of rows) {
      const pct = ceiling > 0 ? ((r.best / ceiling) * 100).toFixed(1) : '—';
      console.log(
        [
          fmt(r.cap).padStart(12),
          fmt(r.best).padStart(17),
          (pct + ' %').padStart(19),
          fmt(r.count).padStart(9),
          fmt(r.explored).padStart(8),
          r.ms.toFixed(0).padStart(10) + (r.truncated ? ' (tronqué)' : ' (exhaustif)'),
        ].join(' | ')
      );
    }
  }
}

main();
