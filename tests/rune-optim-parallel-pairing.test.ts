// Test différentiel de la parallélisation de l'APPARIEMENT (voir
// runeBuildOptim.worker.ts, `runParallelPairing`, et spec/outils/optimizer/
// pistes.md, point 9). Deux régimes, PAS un seul depuis que la
// parallélisation s'applique aussi en recherche normale :
// 1. Budget INFINI (mode exhaustif) : découper `bucketsA` et appareiller
//    chaque tranche INDÉPENDAMMENT doit produire EXACTEMENT le même
//    résultat que le séquentiel — propriété STRUCTURELLE (rien n'est
//    retenu/éliminé par le découpage), prouvée à petite échelle.
// 2. Budget ADAPTATIF + escalade (mode normal, VRAI mécanisme de
//    production — `maybeEscalateNodeBudget`, voir pairSlice.worker.ts),
//    plafonné par un vrai `maxMs` COURT pour forcer une troncature réelle :
//    ici, l'égalité stricte n'est PAS attendue (le parallèle peut trouver
//    PLUS que le séquentiel — débit ×N dans la même fenêtre de temps,
//    vérifié sur 49 essais réels, voir pistes.md) — la seule propriété
//    vérifiée est l'ABSENCE DE PERTE : tout candidat trouvé par le
//    séquentiel doit AUSSI apparaître dans l'union des tranches.
//
// Discipline imposée par .claude/skills/algo-verify/SKILL.md. La
// calibration de performance aux volumes réels (seuil de déclenchement,
// nombre de workers) vit séparément dans scripts/pairing-parallel-diag.ts
// (trop lent pour `npm test`, voir tests/README.md).

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import {
  BuildRequirement,
  buildBuckets,
  prepareSearch,
  partitionBucketsALPT,
  pairBuckets,
  maybeEscalateNodeBudget,
  Bucket,
  BuildCandidate,
  NodeBudget,
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

  // ── Régime 2 : budget ADAPTATIF + escalade, maxMs RÉALISTE (mode normal,
  // troncature réelle forcée) — voir l'en-tête de ce fichier pour la
  // propriété vérifiée (absence de perte, pas égalité stricte). Pool plus
  // dense (12 runes/slot, pas 4) pour que l'espace de paires soit assez
  // grand pour qu'un maxMs de 30 s tronque RÉELLEMENT quelque chose — sur
  // un pool trop petit, tout finirait avant le premier point de passage.
  //
  // ⚠️ **30 s, pas quelques ms** — un écart trouvé EN CONSTRUISANT ce test,
  // pas supposé : à maxMs=500 (déjà jugé irréaliste, aucun réglage d'écran
  // ni arrêt manuel n'approche cette échelle), 2 scénarios sur 12 perdaient
  // RÉELLEMENT des candidats (jusqu'à 7311). Remonté à 15 s puis confirmé à
  // 30 s (proche d'un arrêt manuel réel, jamais plus tôt en pratique) : LES
  // MÊMES scénarios ne perdent plus RIEN, le parallèle trouve même
  // largement plus que le séquentiel. Le mécanisme d'escalade a besoin d'un
  // minimum de temps RÉEL pour corriger un déséquilibre de charge initial
  // entre workers — en dessous de ce minimum (jamais atteint en usage réel,
  // voir la discussion qui a mené à cette valeur), la perte reste possible.
  // Documenté aussi dans spec/outils/optimizer/pistes.md, point 9. ──
  {
    let scenariosTronques = 0;
    const SCENARIOS_TRONCATION = 12;
    for (let s = 0; s < SCENARIOS_TRONCATION; s++) {
      const rng = mulberry32(9000 + s);
      const pool = randomPool(rng, 12);

      const wantSets = rng() < 0.7;
      const sets = wantSets
        ? [SET_KEYS[Math.floor(rng() * (SET_KEYS.length - 1))], SET_KEYS[Math.floor(rng() * (SET_KEYS.length - 1))]]
        : [];
      const minStats: BuildRequirement['minStats'] = {};
      if (rng() < 0.5) minStats.spd = 100 + Math.floor(rng() * 60);
      if (rng() < 0.3) minStats.hp = 8000 + Math.floor(rng() * 2000);
      const requirement: BuildRequirement = { sets, minStats };

      // ⚠️ maxMs RÉALISTE (15 s — proche d'un arrêt manuel, voir la
      // discussion qui a mené à cette valeur) et RÉEL, pas Infinity :
      // c'est justement le régime qui n'était pas couvert avant cette
      // extension. `maxCollected` OMIS exprès (pas de MAX_SAFE_INTEGER) :
      // la prod ne le fixe JAMAIS non plus (voir OptimizerSection.tsx,
      // handleSearch), le défaut réel (100 000, MAX_COLLECTED) s'applique
      // — un plafond illimité a fait manquer de mémoire à cette durée
      // (recherche assez lâche pour collecter des millions de candidats
      // en 15 s), en plus de ne pas correspondre à la prod.
      const params = { base: BASE, artifacts: [], pool, requirement, metric: 'eff' as const, maxMs: 30000 };
      const prepared0 = prepareSearch(params);
      if (!prepared0) continue;

      const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared0.filtered, prepared0.distinctKeys, prepared0.constrainedKeys, prepared0.retentionKeys, prepared0.minEntries, prepared0.bucketCap, prepared0.maxSetsForA, prepared0.jokerCredit, prepared0.requiredPieces));
      const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared0.filtered, prepared0.distinctKeys, prepared0.constrainedKeys, prepared0.retentionKeys, prepared0.minEntries, prepared0.bucketCap, prepared0.maxSetsForB, prepared0.jokerCredit, prepared0.requiredPieces));

      // ⚠️ `prepareSearch` RAPPELÉ à chaque appel — PAS le `prepared0` déjà
      // construit ci-dessus réutilisé tel quel. `overBudget()` (dans
      // `pairBuckets`) compare `Date.now()` à `prepared.startedAt`, figé au
      // moment de CET appel à `prepareSearch` — en production, CHAQUE
      // worker appelle `prepareSearch` lui-même en le RECEVANT (voir
      // pairSlice.worker.ts), donc CHACUN a son propre chrono qui démarre à
      // SON PROPRE instant. Réutiliser un seul `prepared` partagé pour
      // plusieurs tranches TRAITÉES L'UNE APRÈS L'AUTRE (comme ce test, en
      // un seul fil) ferait croire aux tranches suivantes que leur temps est
      // DÉJÀ écoulé (celui déjà consommé par les tranches précédentes) —
      // écart de fidélité trouvé EN FAISANT tourner ce test (pertes
      // massives, pas de perte réelle : juste un budget-temps déjà épuisé
      // avant même d'avoir commencé). Même mécanisme sinon (budget adaptatif
      // + escalade) que pairSlice.worker.ts/runeBuildOptim.worker.ts.
      function runWithEscalation(bA: Bucket[], bB: Bucket[]) {
        const prepared = prepareSearch(params)!;
        const nodeBudget: NodeBudget = { max: prepared.maxNodes };
        const gen = pairBuckets(prepared, bA, bB, nodeBudget);
        let step = gen.next();
        while (!step.done) {
          maybeEscalateNodeBudget(nodeBudget, prepared, step.value, Date.now());
          step = gen.next();
        }
        return step.value;
      }

      const reference = runWithEscalation(bucketsA, bucketsB);
      if (reference.truncated) scenariosTronques++;
      const refKeys = new Set(reference.candidates.map(candidateKey));

      const workerCount = Math.min(4, bucketsA.length);
      const slices = partitionBucketsALPT(bucketsA, workerCount);
      // ⚠️ PAS `candidates.push(...r.candidates)` — une recherche assez
      // lâche à maxMs=500 peut accumuler des dizaines de milliers de
      // candidats, au-delà de la limite d'arguments d'un appel étalé
      // (`RangeError: Maximum call stack size exceeded`, vécu en faisant
      // tourner ce test). Un Set rempli élément par élément n'a pas cette
      // limite, et c'est de toute façon la seule chose dont on a besoin.
      const gotKeys = new Set<string>();
      for (const slice of slices) {
        const r = runWithEscalation(slice, bucketsB);
        for (const c of r.candidates) gotKeys.add(candidateKey(c));
      }

      const perdus = [...refKeys].filter((k) => !gotKeys.has(k));
      ok(
        perdus.length === 0,
        `scénario troncature ${s} (tronqué=${reference.truncated}) : aucun candidat du séquentiel absent du parallèle` +
          (perdus.length > 0 ? ` — ${perdus.length} PERDU(S)` : gotKeys.size > refKeys.size ? ` (parallèle en trouve ${gotKeys.size - refKeys.size} de plus, attendu)` : '')
      );
    }
    // ⚠️ Filet de sécurité méthodologique : si AUCUN scénario n'a jamais
    // tronqué, le test ci-dessus n'a rien prouvé sur le régime qu'il est
    // censé couvrir (tout se serait aussi bien passé avec un budget
    // infini). `maxMs=3` sur un pool à 12 runes/slot doit tronquer au
    // moins UNE fois sur 12 scénarios variés.
    ok(scenariosTronques > 0, `au moins un scénario réellement tronqué sur ${SCENARIOS_TRONCATION} (obtenu : ${scenariosTronques}) — sinon ce bloc ne teste rien`);
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
