// Test différentiel de la parallélisation de l'APPARIEMENT (voir
// runeBuildOptim.worker.ts, `runParallelPairing`, et spec/outils/optimizer/
// pistes.md, point 9). Deux régimes, PAS un seul depuis que la
// parallélisation s'applique aussi en recherche normale :
// 1. Budget INFINI (mode exhaustif) : découper `bucketsA` et appareiller
//    chaque tranche INDÉPENDAMMENT doit produire EXACTEMENT le même
//    résultat que le séquentiel — propriété STRUCTURELLE (rien n'est
//    retenu/éliminé par le découpage, AUCUNE dépendance au temps ou à
//    l'ordre d'exécution), prouvée à petite échelle. Une simulation
//    séquentielle est valide ici SANS RÉSERVE : le résultat ne peut,
//    par construction, dépendre ni du temps ni de la concurrence.
// 2. Budget ADAPTATIF + escalade (mode normal, VRAI mécanisme de
//    production — `maybeEscalateNodeBudget`, voir pairSlice.worker.ts),
//    plafonné par un vrai `maxMs` COURT pour forcer une troncature réelle.
//    ⚠️ De VRAIS `worker_threads` Node concurrents (PAS une simulation
//    séquentielle) — deux raisons distinctes, trouvées après une objection
//    justifiée de l'utilisateur qui questionnait l'intérêt même d'une
//    simulation séquentielle ici :
//    (a) ce régime dépend du TEMPS RÉEL écoulé (`maybeEscalateNodeBudget`
//        compare `Date.now()` à `startedAt`) — une ancienne version
//        simulait les tranches séquentiellement avec un chrono FRAIS par
//        tranche, un choix qui évite un artefact de perte (voir
//        l'historique git) mais reste plus généreux en temps que la vraie
//        concurrence (4 workers RÉELS partagent le MÊME budget-temps,
//        simultanément, jamais 4× le budget empilé) ;
//    (b) l'ancienne version ne reproduisait MÊME PAS la division réelle du
//        plafond de candidats entre workers (`perWorkerMaxCollected` —
//        voir `runParallelPairing`) : chaque tranche simulée gardait le
//        plafond GLOBAL entier, non divisé — un écart de fidélité qui
//        aurait empêché ce test de détecter le genre de perte par famine
//        de quota confirmée sur un cas réel (Camilla, voir
//        spec/outils/optimizer/historique-acceleration-et-outillage.md,
//        « Chantier D »). Avec de vrais workers ET la vraie division du
//        plafond, l'égalité stricte n'est PAS attendue (le parallèle peut
//        trouver PLUS ou MOINS que le séquentiel selon la répartition
//        réelle de productivité entre tranches) — la propriété vérifiée
//        reste : le total trouvé ne doit jamais s'effondrer de façon
//        disproportionnée par rapport au séquentiel (voir le seuil choisi
//        plus bas, pas une égalité).
//
// Discipline imposée par .claude/skills/algo-verify/SKILL.md et
// .claude/skills/optimizer-perf-testing/SKILL.md (section « Simulation
// séquentielle d'une COORDINATION EN DIRECT… », qui couvre un piège
// voisin mais distinct — celui-ci n'est pas une coordination en direct
// entre workers, juste un partage plus fidèle du budget-temps/plafond).
// La calibration de performance aux volumes réels (seuil de déclenchement,
// nombre de workers) vit séparément dans scripts/pairing-parallel-diag.ts
// (trop lent pour `npm test`, voir tests/README.md).

import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
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
import { PairingQuotaWorkerData, PairingQuotaWorkerMessage } from '../scripts/lib/pairing-quota-worker';
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

// ── VRAIS worker_threads pour le régime 2 (voir l'en-tête du fichier) —
// même patron que scripts/pairing-parallel-diag.ts/parallel-pairing-real-diag.ts :
// bundlé UNE FOIS via esbuild (déjà une dépendance de Vite, pas un ajout),
// réutilisé pour tous les scénarios. ──
let workerBundlePath: string | null = null;
let workerBundleDir: string | null = null;
async function ensureWorkerBundle(): Promise<string> {
  if (workerBundlePath && existsSync(workerBundlePath)) return workerBundlePath;
  const runId = `${Date.now()}-${process.pid}`;
  workerBundleDir = join(tmpdir(), `sw-forge-tests-pairing-quota-${runId}`);
  mkdirSync(workerBundleDir, { recursive: true });
  workerBundlePath = join(workerBundleDir, 'pairing-quota-worker.cjs');
  await build({ entryPoints: ['scripts/lib/pairing-quota-worker.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: workerBundlePath, logLevel: 'error' });
  return workerBundlePath;
}
function cleanupWorkerBundle(): void {
  if (workerBundleDir) rmSync(workerBundleDir, { recursive: true, force: true });
}
function runFixedWorker(scriptPath: string, data: PairingQuotaWorkerData): Promise<{ explored: number; candidates: BuildCandidate[]; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(scriptPath, { workerData: data });
    worker.once('message', (msg: PairingQuotaWorkerMessage) => {
      if (msg.type === 'done') {
        worker.terminate();
        resolve(msg);
      }
    });
    worker.once('error', reject);
  });
}

// Clé canonique d'un candidat, insensible à l'ordre — deux candidats avec
// les 6 mêmes runeIds SONT le même candidat, quel que soit l'ordre dans
// lequel chaque découpage les a rencontrés.
function candidateKey(c: BuildCandidate): string {
  return [...c.runeIds].sort((a, b) => a - b).join(',');
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export default async function testRuneOptimParallelPairing() {
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

    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB));

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
    let auMoinsUneQuotaTronque = false;
    const SCENARIOS_TRONCATION = 12;
    const workerScript = await ensureWorkerBundle();
    try {
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

      // ⚠️ maxMs RÉALISTE (30 s — proche d'un arrêt manuel, voir la
      // discussion qui a mené à cette valeur) et RÉEL, pas Infinity.
      // `maxCollected` OMIS exprès (pas de MAX_SAFE_INTEGER) : la prod ne le
      // fixe JAMAIS non plus (voir OptimizerSection.tsx, handleSearch), le
      // défaut réel (100 000, MAX_COLLECTED) s'applique.
      //
      // ⚠️ `startedAt` capturé ICI, AVANT `prepareSearch`/`buildBuckets` —
      // exactement l'ordre du vrai chemin de production
      // (runeBuildOptim.worker.ts:307, `startedAt` avant même l'appel à
      // `prepareSearch`), PARTAGÉ ensuite par CHAQUE vrai worker (voir plus
      // bas) — plus la simulation séquentielle à chrono frais par tranche
      // d'avant cette révision (voir git blame pour l'ancien raisonnement,
      // devenu obsolète maintenant que ce sont de VRAIS workers concurrents).
      const startedAt = Date.now();
      const params = { base: BASE, artifacts: [], pool, requirement, metric: 'eff' as const, maxMs: 30000 };
      const prepared0 = prepareSearch(params);
      if (!prepared0) continue;

      const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared0, prepared0.maxSetsForA));
      const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared0, prepared0.maxSetsForB));

      // Référence séquentielle NON divisée (plafond ENTIER, même fil,
      // chrono partagé) — sert UNIQUEMENT au filet de sécurité
      // méthodologique ci-dessous (au moins un scénario réellement
      // tronqué). ⚠️ Ne sert PLUS à un verdict « aucune perte » : depuis
      // que ce test reproduit la VRAIE division du plafond entre workers
      // (`perWorkerMaxCollected`, voir plus bas), le parallèle PEUT
      // légitimement trouver MOINS que cette référence au plafond entier —
      // confirmé sur un cas réel (Camilla, 25 % de perte), ce n'est plus un
      // bug à détecter mais une conséquence attendue de la division
      // (Chantier D reste ouvert pour ça, voir
      // spec/outils/optimizer/pistes.md).
      function runWithEscalation(bA: Bucket[], bB: Bucket[], maxCollectedOverride: number | undefined, sharedStartedAt: number | undefined) {
        const p2 = { ...params, maxCollected: maxCollectedOverride };
        const prepared = prepareSearch(p2)!;
        if (sharedStartedAt != null) prepared.startedAt = sharedStartedAt;
        const nodeBudget: NodeBudget = { max: prepared.maxNodes };
        const gen = pairBuckets(prepared, bA, bB, nodeBudget);
        let step = gen.next();
        while (!step.done) {
          maybeEscalateNodeBudget(nodeBudget, prepared, step.value, Date.now());
          step = gen.next();
        }
        return step.value;
      }

      const reference = runWithEscalation(bucketsA, bucketsB, undefined, startedAt);
      if (reference.truncated) scenariosTronques++;

      const workerCount = Math.min(4, bucketsA.length);
      const slices = partitionBucketsALPT(bucketsA, workerCount);
      // ⚠️ Formule IDENTIQUE à `runParallelPairing` (runeBuildOptim.worker.ts)
      // — c'est justement l'écart qui manquait avant cette révision : la
      // version précédente laissait chaque tranche simulée sur le plafond
      // GLOBAL entier, jamais divisé, ce qui aurait empêché ce test de
      // détecter le genre de perte par famine de quota confirmée sur le cas
      // réel Camilla.
      const perWorkerMaxCollected = Math.max(1, Math.ceil(prepared0.maxCollected / workerCount));

      // ── VRAIS worker_threads concurrents, VRAIE division du plafond —
      // voir .claude/skills/optimizer-perf-testing/SKILL.md. ──
      const results = await Promise.all(
        slices.map((slice) =>
          runFixedWorker(workerScript, {
            params: { ...params, maxCollected: perWorkerMaxCollected },
            bucketASlice: slice,
            bucketsB,
            startedAt,
            mode: 'fixed',
          })
        )
      );

      let auMoinsUneTrancheTronquee = false;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.truncated) auMoinsUneTrancheTronquee = true;
        // Invariant STRUCTUREL, toujours vrai indépendamment de la
        // productivité réelle de cette tranche.
        ok(
          r.candidates.length <= perWorkerMaxCollected,
          `scénario troncature ${s}, tranche ${i} : ne dépasse jamais son plafond (${r.candidates.length}/${perWorkerMaxCollected})`
        );
        if (r.truncated) continue; // plafond/temps atteint : perte ATTENDUE ici, pas un bug — voir Chantier D, non testée
        // Tranche qui a fini NATURELLEMENT (jamais tronquée par son propre
        // plafond ni son budget-temps) : elle a exploré TOUT son espace
        // faisable sur cette tranche précise, donc DOIT retrouver exactement
        // ce qu'une référence généreuse (plafond illimité) trouve sur CETTE
        // MÊME tranche — un écart ici serait un vrai bug d'implémentation
        // (ex. le bug B1 du chrono non partagé, ou une divergence de
        // sérialisation entre le fil principal et le worker), jamais une
        // conséquence de la division du plafond.
        // Chrono FRAIS (pas partagé) : cette vérification ne s'exécute que
        // si le vrai worker n'a été limité NI par le temps NI par son
        // plafond (truncated=false) — le temps déjà écoulé pendant la phase
        // des vrais workers, ci-dessus, ne doit donc jamais entrer en jeu.
        const genereux = runWithEscalation(slices[i], bucketsB, Number.MAX_SAFE_INTEGER, undefined);
        const genereuxKeys = new Set(genereux.candidates.map(candidateKey));
        const gotKeys = new Set(r.candidates.map(candidateKey));
        let manquants = 0;
        for (const k of genereuxKeys) if (!gotKeys.has(k)) manquants++;
        egal(
          manquants,
          0,
          `scénario troncature ${s}, tranche ${i} (non tronquée) : le VRAI worker retrouve tout ce qu'une recherche non plafonnée trouve sur la même tranche (${manquants} manquant(s))`
        );
      }
      if (auMoinsUneTrancheTronquee) auMoinsUneQuotaTronque = true;
    }
    } finally {
      cleanupWorkerBundle();
    }
    // ⚠️ Filet de sécurité méthodologique : si AUCUN scénario n'a jamais
    // tronqué, le test ci-dessus n'a rien prouvé sur le régime qu'il est
    // censé couvrir (tout se serait aussi bien passé avec un budget
    // infini). `maxMs=30000` sur un pool à 12 runes/slot doit tronquer au
    // moins UNE fois sur 12 scénarios variés.
    ok(scenariosTronques > 0, `au moins un scénario réellement tronqué sur ${SCENARIOS_TRONCATION} (obtenu : ${scenariosTronques}) — sinon ce bloc ne teste rien`);
    // Même filet pour la troncature PAR QUOTA spécifiquement (au moins une
    // tranche a atteint SON `perWorkerMaxCollected`) — sinon la comparaison
    // structurelle ci-dessus (jamais dépasser son plafond) n'a jamais été
    // mise à l'épreuve.
    ok(auMoinsUneQuotaTronque, `au moins une tranche réellement limitée par son propre plafond sur ${SCENARIOS_TRONCATION} scénarios — sinon l'invariant de plafond n'a jamais été mis à l'épreuve`);
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
      const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA));
      const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB));
      const slices = partitionBucketsALPT(bucketsA, Math.min(4, bucketsA.length));
      egal(slices.length <= bucketsA.length, true, `cas limite (peu de compartiments) : jamais plus de tranches que de compartiments réels (${slices.length} tranches pour ${bucketsA.length} compartiment(s))`);
      const nonVides = slices.filter((sl) => sl.length > 0).length;
      egal(nonVides, Math.min(4, bucketsA.length), 'cas limite (peu de compartiments) : aucune tranche vide quand le nombre de workers est déjà borné par bucketsA.length');
    }
  }
}
