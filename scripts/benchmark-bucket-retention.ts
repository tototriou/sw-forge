// Phase 0 du plan d'action Optimizer (voir la discussion « analyse du
// problème » dans l'historique du projet) : mesurer, PAS deviner, si
// `BUCKET_CAP` (600, le plafond de rétention par compartiment dans
// runeBuildOptim.ts) perd réellement de bons candidats — avant de décider
// s'il faut construire quoi que ce soit pour le corriger (Phase 2).
//
// Méthode : réutiliser le moteur RÉEL, déjà vérifié par le test différentiel
// (tests/rune-optim-differential.test.ts), via le nouveau paramètre
// `bucketCap` de SearchParams — PAS une réimplémentation séparée, qui
// risquerait de diverger subtilement de l'algorithme testé. Pour un même
// scénario, faire varier UNIQUEMENT `bucketCap` (100 → ~illimité) et
// regarder si le meilleur candidat trouvé continue de s'améliorer nettement
// après 600, ou si la courbe est déjà plate à ce niveau.
//
// ⚠️ Mesure, ne vérifie rien : pas d'assertions, pas dans `npm test`. Lancé à
// la demande via `npm run benchmark:bucket-retention`.

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

// Même palette de sets que benchmark-optim.ts — assez de sets DIFFÉRENTS
// pour que le regroupement par compte de pièces (le mécanisme dont
// BUCKET_CAP borne la mémoire) produise de vrais compartiments concurrents,
// pas un seul compartiment géant.
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

// Un pool par SLOT (perSlot runes dans chacun des 6 slots), comme un vrai
// inventaire filtré par emplacement.
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
    // Profil pas couvert par benchmark-optim.ts : un maximum, pour voir si
    // le comportement diverge de celui des minimums seuls.
    label: 'set 4 seul + 1 maximum (RES plafonné)',
    requirement: { sets: ['violent'], minStats: {}, maxStats: { res: 40 } },
  },
];

// ⚠️ Plafonné à 6000, pas « quasi illimité » : `insertBounded` fait un tri
// par insertion (`splice`, O(taille) par insertion) — à `bucketCap` élevé,
// la CONSTRUCTION des compartiments elle-même devient très coûteuse (mesuré :
// 50 000 → ~80 s rien que pour construire, avant même la recherche, alors
// que `overBudget()`/`maxMs` n'est vérifié que dans la boucle d'appariement,
// jamais pendant `buildBuckets`). Confirme au passage, empiriquement, le
// bénéfice attendu d'un tas binaire (Phase 1b) plutôt qu'une liste triée.
const BUCKET_CAPS = [100, 300, 600, 1500, 3000, 6000];

// 80/slot correspond au preset « Moyen » (défaut réel de l'app) après
// pré-filtrage par slot — le point de mesure le plus directement pertinent.
const POOL_SIZES_PER_SLOT = [80];

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

async function runExperiment(title: string, extra: Partial<SearchParams>) {
  console.log(`\n${'═'.repeat(90)}\n${title}\n${'═'.repeat(90)}`);

  for (const perSlot of POOL_SIZES_PER_SLOT) {
    const pool = randomPool(perSlot, perSlot);
    for (const scenario of SCENARIOS) {
      console.log(`\n${'─'.repeat(90)}`);
      console.log(`pool: ${perSlot}/slot · scénario: ${scenario.label}`);
      console.log(['bucketCap', 'meilleur effTotal', '% du plafond testé', 'candidats', 'paires', 'temps (ms)'].join(' | '));

      let ceiling = 0;
      const rows: { cap: number; best: number; count: number; explored: number; ms: number; truncated: boolean }[] = [];

      for (const cap of BUCKET_CAPS) {
        const params: SearchParams = {
          base: BASE,
          artifacts: [],
          pool,
          requirement: scenario.requirement,
          metric: 'eff',
          bucketCap: cap,
          ...extra,
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
            fmt(r.cap).padStart(9),
            fmt(r.best).padStart(17),
            (pct + ' %').padStart(19),
            fmt(r.count).padStart(9),
            fmt(r.explored).padStart(8),
            r.ms.toFixed(0).padStart(10) + (r.truncated ? ' (tronqué)' : ''),
          ].join(' | ')
        );
      }
    }
  }
}

async function main() {
  console.log('Phase 0 — BUCKET_CAP perd-il de bons candidats ? (moteur réel, bucketCap variable)');

  await runExperiment(
    'Budget LÂCHE (isole bucketCap : maxCollected/maxNodes très larges, slotFilterCap=300)',
    { slotFilterCap: 300, maxCollected: 500_000, maxNodes: 2_000_000, maxMs: 30_000 }
  );

  // ⚠️ Deuxième passe, SANS AUCUNE surcharge de budget — les vrais défauts de
  // production (DEFAULT_MAX_NODES=400 000, MAX_COLLECTED=5000,
  // DEFAULT_MAX_MS=15 000, slotFilterCap « Moyen »=80) : ce que vivrait
  // réellement un joueur aujourd'hui à différents bucketCap. La première
  // passe dit « bucketCap seul, budget illimité » ; celle-ci dit « bucketCap
  // dans les conditions réelles où maxCollected/maxNodes entrent aussi en
  // jeu ».
  await runExperiment('Budget de PRODUCTION (défauts réels de searchBuilds, slotFilterCap=80)', { slotFilterCap: 80 });
}

main();
