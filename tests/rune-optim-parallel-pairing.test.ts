// Test différentiel de la parallélisation de l'APPARIEMENT (voir
// runeBuildOptim.worker.ts, `runParallelPairing`, et spec/outils/optimizer/
// pistes.md, point 9) : découper `bucketsA` (via `partitionBucketsALPT`) et
// appareiller chaque tranche INDÉPENDAMMENT (budget infini par tranche, le
// seul régime où c'est mesuré sans perte — voir pistes.md) doit produire
// EXACTEMENT le même résultat qu'un appariement séquentiel unique sur les
// bucketsA/bucketsB complets : même nombre exploré, même ensemble de
// candidats (à l'ordre près).
//
// Discipline imposée par .claude/skills/algo-verify/SKILL.md. Cette
// propriété (union de tranches DISJOINTES de bucketsA × bucketsB complet =
// même résultat que non-découpé) est structurelle, pas sensible au volume
// comme l'était la dilution BUCKET_CAP (rien n'est retenu/éliminé par le
// découpage lui-même) — un balayage à petite échelle, exhaustif par
// construction, suffit donc comme preuve ; la calibration de performance aux
// volumes réels (seuil de déclenchement, nombre de workers) vit séparément
// dans scripts/pairing-parallel-diag.ts (trop lent pour `npm test`, voir
// tests/README.md sur la place des scripts par rapport aux tests).

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import {
  BuildRequirement,
  buildBuckets,
  prepareSearch,
  partitionBucketsALPT,
  pairBuckets,
  Bucket,
  BuildCandidate,
} from '../src/lib/runeBuildOptim';
import { egal, ok, titre } from './outils';

// Même PRNG déterministe que rune-optim-differential.test.ts (mulberry32,
// pas de dépendance) — seed distincte pour rester indépendant de cet autre
// fichier.
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

const SET_KEYS = ['violent', 'swift', 'will', 'shield', 'fight', 'intangible'];
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

function randomPool(rng: () => number, perSlot: number): RuneDetail[] {
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) {
    for (let i = 0; i < perSlot; i++) out.push(randomRune(id++, slot, rng));
  }
  return out;
}

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

// Clé canonique d'un candidat, insensible à l'ordre — deux candidats avec
// les 6 mêmes runeIds SONT le même candidat, quel que soit l'ordre dans
// lequel chaque découpage les a rencontrés.
function candidateKey(c: BuildCandidate): string {
  return [...c.runeIds].sort((a, b) => a - b).join(',');
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export default function testRuneOptimParallelPairing() {
  titre('Optimizer · parallélisation de l\'appariement (découpage vs séquentiel)');

  const SCENARIOS = 20;
  for (let s = 0; s < SCENARIOS; s++) {
    const rng = mulberry32(5000 + s);
    // 4 runes/slot (un peu plus dense que le différentiel principal, sans
    // exploser le temps) : plus de compartiments côté A pour donner au
    // découpage LPT quelque chose de réel à répartir sur 2/3/4 tranches.
    const pool = randomPool(rng, 4);

    const wantSets = rng() < 0.7;
    const sets = wantSets
      ? [SET_KEYS[Math.floor(rng() * (SET_KEYS.length - 1))], SET_KEYS[Math.floor(rng() * (SET_KEYS.length - 1))]]
      : [];
    const minStats: BuildRequirement['minStats'] = {};
    if (rng() < 0.5) minStats.spd = 100 + Math.floor(rng() * 60);
    if (rng() < 0.3) minStats.hp = 8000 + Math.floor(rng() * 2000);
    if (rng() < 0.2) minStats.cr = 15 + Math.floor(rng() * 40);
    const requirement: BuildRequirement = { sets, minStats };

    // ⚠️ Budget INFINI des deux côtés de la comparaison — c'est le SEUL
    // régime où le découpage est prouvé sans perte (voir l'en-tête de ce
    // fichier). Comparer sous troncature reproduirait le régime déjà connu
    // comme cassé (pistes.md, point 9), pas celui que ce code active.
    const params = { base: BASE, artifacts: [], pool, requirement, metric: 'eff' as const, maxMs: Number.POSITIVE_INFINITY, maxCollected: Number.MAX_SAFE_INTEGER };
    const prepared = prepareSearch(params);
    if (!prepared) continue; // pool vide après filtrage — rien à comparer sur ce scénario

    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces));

    const reference = drain(pairBuckets(prepared, bucketsA, bucketsB, { max: Number.POSITIVE_INFINITY }));
    const refKeys = new Set(reference.candidates.map(candidateKey));

    for (const workerCount of [1, 2, 3, 4]) {
      const slices: Bucket[][] = partitionBucketsALPT(bucketsA, Math.min(workerCount, bucketsA.length));
      let explored = 0;
      const candidates: BuildCandidate[] = [];
      for (const slice of slices) {
        const r = drain(pairBuckets(prepared, slice, bucketsB, { max: Number.POSITIVE_INFINITY }));
        explored += r.explored;
        candidates.push(...r.candidates);
      }
      const gotKeys = new Set(candidates.map(candidateKey));

      egal(
        explored,
        reference.explored,
        `scénario ${s}, N=${workerCount} : paires explorées identiques au séquentiel (${explored} vs ${reference.explored})`
      );
      egal(
        gotKeys.size,
        refKeys.size,
        `scénario ${s}, N=${workerCount} : même NOMBRE de candidats trouvés (${gotKeys.size} vs ${refKeys.size})`
      );
      let memeEnsemble = gotKeys.size === refKeys.size;
      if (memeEnsemble) for (const k of gotKeys) if (!refKeys.has(k)) { memeEnsemble = false; break; }
      ok(memeEnsemble, `scénario ${s}, N=${workerCount} : exactement le MÊME ensemble de candidats que le séquentiel (aucun perdu, aucun inventé)`);
    }
  }

  // ⚠️ Cas limite dédié : moins de compartiments côté A que de workers
  // demandés (`Math.min(workerCount, bucketsA.length)` dans le code de
  // production, voir runeBuildOptim.worker.ts) — certaines tranches
  // seraient sinon vides pour rien. Pool minimal, un seul compartiment
  // plausible côté A.
  {
    const rng = mulberry32(999);
    const pool = randomPool(rng, 1);
    const requirement: BuildRequirement = { sets: [], minStats: {} };
    const params = { base: BASE, artifacts: [], pool, requirement, metric: 'eff' as const, maxMs: Number.POSITIVE_INFINITY, maxCollected: Number.MAX_SAFE_INTEGER };
    const prepared = prepareSearch(params);
    if (prepared) {
      const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces));
      const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces));
      const slices = partitionBucketsALPT(bucketsA, Math.min(4, bucketsA.length));
      egal(slices.length <= bucketsA.length, true, `cas limite (peu de compartiments) : jamais plus de tranches que de compartiments réels (${slices.length} tranches pour ${bucketsA.length} compartiment(s))`);
      const nonVides = slices.filter((sl) => sl.length > 0).length;
      egal(nonVides, Math.min(4, bucketsA.length), 'cas limite (peu de compartiments) : aucune tranche vide quand le nombre de workers est déjà borné par bucketsA.length');
    }
  }
}
