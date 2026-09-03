// L'optimisation d'artéfacts EN TEMPS MASQUÉ ralentit-elle la recherche ?
//
// La file (`useArtifactOptimQueue`) travaille sur le fil PRINCIPAL pendant que
// l'appariement tourne dans ses Workers. Aucune API JavaScript ne permet de
// choisir un cœur : la seule vérification honnête est de MESURER si la
// recherche ralentit, pas de supposer que le temps est masqué.
//
// ⚠️ `optimizer-perf-testing` — MESURE DE TEMPS COMPARÉE, donc le régime où la
// contention fausse directement ce qu'on mesure : les deux essais tournent DOS
// À DOS, jamais simultanément.
//
// ⚠️ **De VRAIS `worker_threads`, pas une simulation séquentielle.** La
// question porte sur la CONCURRENCE entre le fil principal et les workers —
// `runSearchToCompletion` (scripts/lib/runSearch.ts) est toujours séquentiel
// (« Node n'a pas de Web Worker ») et ne peut donc PAS y répondre. Même patron
// que `pairing-parallel-diag.ts`, dont ce script emprunte le bundling et le
// pilotage.
//
// ── ÉCARTS CONNUS au chemin de production, à garder en tête ────────────────
//
// 1. ⚠️ `requestIdleCallback` n'existe pas en Node. La file y cède la main par
//    `setImmediate`, qui ne SAIT PAS si le fil est occupé et ne se retire donc
//    jamais. Cet essai est un **PIRE CAS** : plus agressif que la production.
//    Si le ralentissement mesuré ici est négligeable, il l'est a fortiori en
//    vrai.
// 2. `pairing-worker.ts` n'escalade pas son budget (budget infini ici, comme
//    le diagnostic dont il vient) — on mesure le débit d'appariement, pas le
//    mécanisme d'escalade.
// 3. Le navigateur fait aussi tourner React sur le fil principal ; Node non.
//    Ça joue contre la file, pas contre les workers.

import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { CASES, loadCase } from './lib/perfShared';
import { prepareSearch, buildBuckets, SearchParams, Bucket } from '../src/lib/runeBuildOptim';
import { PairingWorkerData, PairingWorkerResult } from './lib/pairing-worker';
import { drain } from './lib/drain';
import { loadSiegeMonster } from './lib/loadMonster';
import { loadMonstersList } from './lib/monstersData';
import { chercherPaires, nombreDePaires, type ArtifactSearchParams } from '../src/lib/artifactOptim';
import { buildRealDamageContext } from './lib/realDamageCli';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { artifactDamageProfile, computeTotalDamage, DEFAULT_DAMAGE_SETUP, type DamageSetup } from '../src/lib/damage';
import { computeStats } from '../src/lib/stats';
import type { ArtifactDetail } from '../src/types';

const RUN_ID = `${Date.now()}-${process.pid}`;
const BUNDLE_DIR = join(tmpdir(), `sw-forge-artifact-contention-${RUN_ID}`);
async function ensureWorkerBundle(): Promise<string> {
  const outfile = join(BUNDLE_DIR, 'pairing-worker.cjs');
  if (existsSync(outfile)) return outfile;
  mkdirSync(BUNDLE_DIR, { recursive: true });
  await build({ entryPoints: ['scripts/lib/pairing-worker.ts'], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error' });
  return outfile;
}
function runWorker(scriptPath: string, data: PairingWorkerData): Promise<PairingWorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(scriptPath, { workerData: data });
    worker.once('message', (msg: PairingWorkerResult) => {
      worker.terminate();
      resolve(msg);
    });
    worker.once('error', reject);
  });
}

// Même nombre qu'en production (`PARALLEL_PAIRING_WORKERS`), délibérément fixe.
const WORKERS = 4;
const SLOT_FILTER_CAP = 40; // préréglage « Bas », comme le diagnostic parent
// ⚠️ 5 répétitions par condition : un effet de quelques pour cent ne se
// distingue pas d'une interférence passagère sur un essai unique.
const REPETITIONS = 5;

// ── La charge d'artéfacts, identique à celle de la file ────────────────────
//
// ⚠️ **Le VRAI évaluateur de dégâts, pas un raccourci.** Une première version
// sommait les stats — donc ne dépendait d'AUCUNE sous-propriété. Conséquence en
// cascade : `analyserPertinence` ne trouvait aucune ligne croissante, la
// dominance ne comparait plus que les trois stats principales, l'inventaire
// s'effondrait à ~3 candidats par côté, et le fil principal ne faisait
// quasiment rien. La mesure disait « aucun ralentissement » parce qu'il n'y
// avait **aucune charge** — 0,4 ms par build au lieu de 341 ms, ce que le
// compteur de builds a trahi.
//
// Exactement le piège d'`algo-verify` : un script diagnostic qui diverge du
// chemin de production sans le dire.
function chargeArtefacts() {
  const lushen = loadSiegeMonster({ exportPath: 'ß☆Enzo-6399149.json', deckId: 15, monsterName: 'Lushen', defense: false, rest: [] });
  const espece = loadMonstersList().find((m) => m.com2usId === lushen.com2usId)!;
  const setup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: null,
    atkBuff: true,
    critMode: 'crit',
    summonerSkills: 'guilde',
    enemyHp: 50000,
    enemyElement: null,
  };
  const recipe = buildOptimizerRecipe({
    monsterCom2usId: lushen.com2usId,
    monsterName: 'Lushen',
    requirement: { sets: ['rage'], minStats: {}, mainStats: {} },
    objective: 'degats_reels',
    damageSetup: setup,
    metric: 'eff',
    slotFilterPreset: 'moyen',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'box',
    excludedSelectors: [],
    ignoreArtifacts: false,
    artifactMainByKind: { element: 'libre', archetype: 'libre' },
  });
  const ctx = buildRealDamageContext(recipe, lushen.com2usId, lushen.gear.artifacts)!;
  const params: ArtifactSearchParams = {
    porteur: { element: espece.element, archetype: espece.archetype },
    inventaire: lushen.allArtifacts,
    equipes: lushen.gear.artifacts,
    principaleParSorte: {},
    evaluer: (arts) =>
      computeTotalDamage(
        ctx.profile,
        ctx.passifs,
        computeStats({ ...lushen.gear, artifacts: arts }),
        setup,
        espece.element,
        artifactDamageProfile(arts)
      ),
  };
  return { charge: () => chercherPaires(params), params };
}

/**
 * Charge de CALCUL PUR, sans aucune allocation — le témoin discriminant.
 *
 * ⚠️ **Ce qu'elle sert à trancher.** La charge d'artéfacts occupe un cœur ET
 * alloue massivement (tableaux de stats reconstruits à chaque paire, objets de
 * profil). Si le ralentissement de l'appariement vient du partage de CŒURS,
 * cette charge-ci — qui occupe un cœur tout autant — doit ralentir la recherche
 * PAREIL. S'il vient de la pression MÉMOIRE (caches malmenés, GC), elle doit la
 * ralentir BEAUCOUP MOINS.
 *
 * La réponse décide de la suite : déplacer la file dans un Worker ne règlerait
 * RIEN contre une pression mémoire, alors que ça règlerait une famine de cœurs.
 *
 * ⚠️ Le résultat est accumulé dans un puits module-level et `Math.sqrt` empêche
 * le JIT d'éliminer la boucle : une boucle dont le résultat ne sert à rien peut
 * être supprimée entièrement, et on mesurerait alors l'absence de charge — le
 * genre d'écart qui a déjà invalidé une première version de ce script.
 */
let PUITS = 0;
function chargePureCPU(dureeCibleMs: number): () => void {
  // Calibrage : combien d'itérations pour approcher la durée visée ?
  const echantillon = 2_000_000;
  const t0 = performance.now();
  let x = 0;
  for (let i = 0; i < echantillon; i++) x += Math.sqrt(i + x * 1e-12);
  PUITS += x;
  const parIteration = (performance.now() - t0) / echantillon;
  const iterations = Math.max(1, Math.round(dureeCibleMs / parIteration));
  return () => {
    let y = 0;
    for (let i = 0; i < iterations; i++) y += Math.sqrt(i + y * 1e-12);
    PUITS += y;
  };
}

// Appariement parallèle, avec ou sans charge concurrente sur le fil principal.
async function essai(
  scriptPath: string,
  params: SearchParams,
  bucketsA: Bucket[],
  bucketsB: Bucket[],
  avecCharge: (() => unknown) | null
): Promise<{ ms: number; found: number; builds: number }> {
  const slices: Bucket[][] = Array.from({ length: WORKERS }, () => []);
  bucketsA.forEach((b, i) => slices[i % WORKERS]!.push(b));

  let enCours = true;
  let builds = 0;
  // ⚠️ `setImmediate` et non une boucle serrée : la file cède la main entre
  // deux builds, exactement comme en production. Ce qu'elle ne fait PAS ici,
  // c'est se retirer quand le fil est occupé — d'où le pire cas annoncé.
  const boucle = () => {
    if (!enCours || !avecCharge) return;
    avecCharge();
    builds++;
    setImmediate(boucle);
  };

  const t0 = performance.now();
  if (avecCharge) setImmediate(boucle);
  const res = await Promise.all(
    slices.map((s) =>
      runWorker(scriptPath, { params, bucketASlice: s, bucketsB, nodeBudgetMax: Number.POSITIVE_INFINITY })
    )
  );
  const ms = performance.now() - t0;
  enCours = false;
  return { ms, found: res.reduce((n, r) => n + r.foundCount, 0), builds };
}

async function main() {
  console.log(`Machine : ${cpus().length} cœurs logiques · ${WORKERS} workers d'appariement (comme en prod)\n`);
  console.log('⚠️ Essais DOS À DOS, jamais simultanés — une mesure de temps comparée');
  console.log('⚠️ PIRE CAS : la file ne se retire pas quand le fil est occupé (pas de requestIdleCallback en Node)\n');
  const scriptPath = await ensureWorkerBundle();
  const { charge, params: pArt } = chargeArtefacts();

  // ⚠️ **Le script DIT sa propre fidélité** plutôt que de la supposer. Une
  // charge effondrée (évaluateur qui ne lit pas les sous-propriétés) se voyait
  // seulement au compteur de builds, après coup. Ici, on affiche AVANT de
  // mesurer : si ces deux nombres ne ressemblent pas à la production, la
  // mesure ne vaut rien.
  const t = performance.now();
  charge();
  const coutUnBuild = performance.now() - t;
  console.log(
    `Charge par build : ${coutUnBuild.toFixed(0)} ms sur ${nombreDePaires(pArt).toLocaleString('fr')} paires parcourues.`
  );
  // ⚠️ ~75-85 ms sur ~12 000 paires, c'est l'espace APRÈS élagage (107 451
  // paires brutes, −88,5 % mesuré). Le chiffre non élagué (341 ms) ne serait
  // PAS le bon repère : la production élague aussi.
  console.log('(attendu ~75-85 ms sur ~12 000 paires — bien moins signale une charge effondrée)\n');

  // ⚠️ d10 écarté : 5 essais × ~78 s pour le cas le plus BRUITÉ de la série
  // (8,2 % de dérive entre témoins). Les trois retenus ont une dérive ≤ 1,2 %,
  // donc un signal exploitable.
  // ⚠️ Les deux cas COURTS : 5 répétitions × 3 conditions, donc 15 recherches
  // par cas. Le cas « Rage seul » (25 s) coûterait 6 min à lui seul pour un
  // signal déjà cohérent entre les deux mesures précédentes (+4,8 % deux fois).
  for (const c of [CASES[1]!]) {
    const { gear, allRunes, requirement } = loadCase(c);
    const params: SearchParams = {
      base: gear.base,
      artifacts: gear.artifacts,
      relic: gear.relic,
      pool: allRunes,
      requirement,
      metric: 'eff',
      objective: c.objective,
      slotFilterCap: SLOT_FILTER_CAP,
      maxMs: Number.POSITIVE_INFINITY,
      adaptiveTrancheWeighting: false,
    };
    const prepared = prepareSearch(params);
    if (!prepared) continue;
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB));

    // ⚠️ Un tour d'échauffement AVANT de mesurer : le JIT et le premier
    // clonage structuré des buckets fausseraient le premier essai.
    await essai(scriptPath, params, bucketsA, bucketsB, null);

    // ⚠️ **RÉPÉTITIONS ENTRELACÉES, pas en blocs.** Une première version ne
    // faisait qu'UN essai par condition, encadré de deux témoins. Insuffisant :
    // deux témoins qui encadrent attrapent une dérive LENTE, jamais une
    // perturbation TRANSITOIRE tombée pendant l'essai chargé. Vécu — un cas a
    // donné +20,1 % « avec 0,2 % de dérive », puis −2,5 % à la reprise.
    //
    // Entrelacer (témoin, artéfacts, CPU, témoin, artéfacts, CPU…) plutôt que
    // grouper : une perturbation frappe alors une répétition de chaque
    // condition, pas une condition entière.
    const mesures = { temoin: [] as number[], artefacts: [] as number[], pur: [] as number[] };
    const chargePure = chargePureCPU(coutUnBuild);
    let buildsTotal = 0;
    let candidatsIdentiques = true;
    let refFound = -1;
    for (let rep = 0; rep < REPETITIONS; rep++) {
      const t = await essai(scriptPath, params, bucketsA, bucketsB, null);
      const a = await essai(scriptPath, params, bucketsA, bucketsB, charge);
      const p = await essai(scriptPath, params, bucketsA, bucketsB, chargePure);
      mesures.temoin.push(t.ms);
      mesures.artefacts.push(a.ms);
      mesures.pur.push(p.ms);
      buildsTotal += a.builds;
      if (refFound < 0) refFound = t.found;
      if (t.found !== refFound || a.found !== refFound || p.found !== refFound) candidatsIdentiques = false;
    }

    // ⚠️ Le MINIMUM est l'estimateur le plus propre du coût réel : une
    // interférence ne peut qu'AJOUTER du temps, jamais en retirer. La médiane
    // l'accompagne pour montrer si la série est stable ou dispersée.
    const mini = (xs: number[]) => Math.min(...xs);
    const mediane = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)]!;
    const ref = mini(mesures.temoin);
    const ligne = (nom: string, xs: number[]) => {
      const dispersion = ((Math.max(...xs) / mini(xs) - 1) * 100).toFixed(1);
      console.log(
        `  ${nom.padEnd(18)} min ${mini(xs).toFixed(0).padStart(7)} ms   méd ${mediane(xs).toFixed(0).padStart(7)} ms` +
          `   → ${((mini(xs) / ref - 1) * 100 >= 0 ? '+' : '')}${((mini(xs) / ref - 1) * 100).toFixed(1)} %` +
          `   (dispersion ${dispersion} %)`
      );
    };
    console.log(`=== ${c.label} — ${REPETITIONS} répétitions entrelacées ===`);
    ligne('témoin', mesures.temoin);
    ligne('charge ARTÉFACTS', mesures.artefacts);
    ligne('charge CPU PUR', mesures.pur);
    // ⚠️ LE verdict de ce script : si les deux charges ralentissent PAREIL,
    // c'est le partage de cœurs — et un Worker n'y changerait rien non plus.
    // Si la charge d'artéfacts fait bien pire à durée CPU égale, c'est la
    // pression mémoire, et le levier est de réduire les allocations, pas de
    // déplacer le calcul ailleurs.
    console.log(
      `  → imputable aux ALLOCATIONS : ${((mini(mesures.artefacts) / mini(mesures.pur) - 1) * 100).toFixed(1)} %` +
        `   ·   ${Math.round(buildsTotal / REPETITIONS)} builds par essai`
    );
    if (!candidatsIdentiques) {
      console.log(`  ✗ NOMBRE DE CANDIDATS DIFFÉRENT — une charge a changé le RÉSULTAT, pas seulement le temps`);
    }
    console.log('');
  }
}

main();
