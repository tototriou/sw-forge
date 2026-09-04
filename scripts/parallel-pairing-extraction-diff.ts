// Différentiel de l'EXTRACTION de l'appariement parallèle — étape 6 du
// chantier `spec/outils/optimizer/parallelisation-partagee.md`.
//
// Question posée : `driveParallelPairing` (extrait de `runParallelPairing`,
// avec le lancement de worker INJECTÉ) trouve-t-il EXACTEMENT les mêmes
// candidats que le chemin séquentiel de référence, en passant par de VRAIS
// `worker_threads` qui exécutent le corps partagé `runPairSlice` ?
//
// ⚠️ **De VRAIS fils, jamais une simulation en processus.** Exécuter les
// tranches séquentiellement fausserait le budget-temps de chacune
// (`overBudget()` lit l'horloge) et ne prouverait rien sur la concurrence —
// leçon du Chantier D, voir le skill `optimizer-perf-testing`.
//
// ⚠️ **Budget INFINI des deux côtés.** C'est le seul régime où l'égalité est
// démontrable : sous troncature, le découpage change légitimement QUELS
// candidats sont gardés (chaque worker a sa part de `maxCollected`), donc une
// différence n'y serait pas un bug. Ce régime-là est déjà couvert par
// `tests/rune-optim-parallel-pairing.test.ts` (invariants de plafond). Ici on
// vérifie que l'EXTRACTION n'a rien changé, pas que la troncature est sûre.
//
// Usage : npx tsx scripts/parallel-pairing-extraction-diff.ts [--cas=<n>]

import { drain } from './lib/drain';
import { CASES, loadCase } from './lib/perfShared';
import { ensurePairSliceBundle, makeSpawnSliceNode } from './lib/spawnSliceNode';
import { driveParallelPairing } from '../src/workers/parallelPairing';
import {
  SearchParams,
  BuildCandidate,
  prepareSearch,
  buildBuckets,
  pairBuckets,
  totalPairCount,
} from '../src/lib/runeBuildOptim';

// Clé canonique d'un candidat, insensible à l'ordre — deux candidats avec les
// 6 mêmes runeIds SONT le même candidat, quel que soit l'ordre dans lequel
// chaque découpage les a rencontrés. Même définition que
// tests/rune-optim-parallel-pairing.test.ts.
function candidateKey(c: BuildCandidate): string {
  return [...c.runeIds].sort((a, b) => a - b).join(',');
}

const arg = process.argv.find((a) => a.startsWith('--cas='));
const seulement = arg ? Number(arg.slice('--cas='.length)) : null;

async function main(): Promise<void> {
  const bundle = await ensurePairSliceBundle();
  const spawnSlice = makeSpawnSliceNode(bundle);
  console.log(`Worker bundlé : ${bundle}\n`);

  let echecs = 0;
  let cas = 0;

  for (const c of CASES) {
    cas++;
    if (seulement != null && cas !== seulement) continue;

    const { gear, allRunes, requirement } = loadCase(c);
    const params: SearchParams = {
      base: gear.base,
      artifacts: gear.artifacts,
      relic: gear.relic,
      pool: allRunes,
      requirement,
      metric: 'eff',
      objective: c.objective,
      objectiveStats: c.objectiveStats,
      // ⚠️ Les deux bornes qui rendent l'égalité démontrable (voir en-tête).
      maxMs: Number.POSITIVE_INFINITY,
      maxCollected: Number.MAX_SAFE_INTEGER,
    };

    const prepared = prepareSearch(params);
    if (!prepared) {
      console.log(`${cas}. ${c.label} : pool vide après filtrage, ignoré`);
      continue;
    }

    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB));
    const totalPairs = totalPairCount(prepared, bucketsA, bucketsB);

    // ── Référence : le chemin séquentiel, budget infini.
    const tRef = performance.now();
    const reference = drain(pairBuckets(prepared, bucketsA, bucketsB, { max: Number.POSITIVE_INFINITY }));
    const refMs = performance.now() - tRef;
    const refKeys = new Set(reference.candidates.map(candidateKey));

    // ── Sous test : l'orchestration EXTRAITE, sur de vrais worker_threads.
    const tPar = performance.now();
    const parallele = await driveParallelPairing(
      spawnSlice,
      params,
      prepared,
      bucketsA,
      bucketsB,
      () => {},
      Date.now()
    );
    const parMs = performance.now() - tPar;
    const parKeys = new Set(parallele.candidates.map(candidateKey));

    const manquants = [...refKeys].filter((k) => !parKeys.has(k));
    const enTrop = [...parKeys].filter((k) => !refKeys.has(k));
    const doublons = parallele.candidates.length - parKeys.size;
    const ok = manquants.length === 0 && enTrop.length === 0 && doublons === 0;
    if (!ok) echecs++;

    console.log(`${cas}. ${c.label}`);
    console.log(`   totalPairs=${totalPairs.toLocaleString('fr-FR')} (seuil prod 100M : ${totalPairs >= 100_000_000 ? 'PARALLÈLE' : 'séquentiel'})`);
    console.log(`   référence  : ${refKeys.size} candidats uniques, explored=${reference.explored}, ${refMs.toFixed(0)}ms`);
    console.log(`   extraction : ${parKeys.size} candidats uniques, explored=${parallele.explored}, ${parMs.toFixed(0)}ms`);
    console.log(`   ${ok ? 'OK — ensembles IDENTIQUES' : `ÉCHEC — ${manquants.length} manquant(s), ${enTrop.length} en trop, ${doublons} doublon(s)`}`);
    console.log('');
  }

  console.log(echecs === 0
    ? 'TOUS LES CAS IDENTIQUES — l\'extraction ne change rien au résultat.'
    : `${echecs} CAS EN ÉCHEC — ne pas continuer le chantier.`);
  process.exit(echecs === 0 ? 0 : 1);
}

void main();
