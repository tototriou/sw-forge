// Test dédié de `combineParallelPairingResults` (src/lib/runeBuildOptim.ts)
// — la fusion des résultats des N workers de l'appariement PARALLÈLE
// (`runParallelPairing`, runeBuildOptim.worker.ts). Trouvé par une revue de
// code externe (2026-08-19, point 4) : l'ancien `results.some(r =>
// r.truncated)` confondait deux causes distinctes de `truncated=true` par
// worker — quota PROPRE rempli (tranche riche, pas forcément un signe de
// recherche globalement incomplète) vs budget nœuds/temps épuisé (une vraie
// troncature). Pure agrégation, testable SANS `worker_threads` (voir
// `algo-verify`, point 6 — vérifier au bon étage) : distinct de
// `rune-optim-parallel-pairing.test.ts`, qui vérifie le VOLUME de candidats
// retrouvé sous vraie concurrence, pas la justesse du signal `truncated`.

import { BuildCandidate, SearchResult, combineParallelPairingResults } from '../src/lib/runeBuildOptim';
import { egal, titre } from './outils';

function fakeCandidates(n: number): BuildCandidate[] {
  return new Array(n).fill(null).map(() => ({ runeIds: [], stats: [], effTotal: 0 }) as BuildCandidate);
}

export default function testRuneOptimParallelTruncated() {
  titre('Optimizer · combineParallelPairingResults — signal truncated fiable en pairing parallèle');

  const PER_WORKER_MAX = 1000;
  const GLOBAL_MAX = 4000; // 4 workers x 1000

  // ── Cas 1 (LE BUG CORRIGÉ) : un worker remplit SON PROPRE quota (tranche
  // riche), les 3 autres finissent leur exploration ENTIÈRE sans jamais
  // rien tronquer — total très en-deçà du plafond GLOBAL. L'ancien
  // `results.some(r => r.truncated)` aurait annoncé `true` à tort. ──
  {
    const results: SearchResult[] = [
      { candidates: fakeCandidates(PER_WORKER_MAX), explored: 500_000, truncated: true }, // quota rempli pile
      { candidates: fakeCandidates(50), explored: 10_000, truncated: false }, // fini, pas tronqué
      { candidates: fakeCandidates(30), explored: 8_000, truncated: false },
      { candidates: fakeCandidates(20), explored: 5_000, truncated: false },
    ];
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX);
    egal(out.candidates.length, PER_WORKER_MAX + 50 + 30 + 20, 'total = somme des 4 tranches');
    egal(out.truncated, false, "une tranche riche qui remplit SON quota n'annonce PAS une recherche tronquée si le total reste sous le plafond global et que le reste a fini");
  }

  // ── Cas 2 : un worker épuise son budget nœuds/temps AVANT de remplir son
  // propre quota (candidates.length < PER_WORKER_MAX, truncated=true) — une
  // VRAIE troncature, doit se propager au résultat global même si le total
  // reste loin du plafond. ──
  {
    const results: SearchResult[] = [
      { candidates: fakeCandidates(200), explored: 20_000_000, truncated: true }, // budget épuisé, quota PAS rempli
      { candidates: fakeCandidates(50), explored: 10_000, truncated: false },
      { candidates: fakeCandidates(30), explored: 8_000, truncated: false },
      { candidates: fakeCandidates(20), explored: 5_000, truncated: false },
    ];
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX);
    egal(out.truncated, true, 'un worker qui épuise son budget nœuds/temps AVANT son propre quota est une vraie troncature, toujours reportée');
  }

  // ── Cas 3 : aucun worker individuellement tronqué (tous en-deçà de leur
  // PROPRE quota, ici volontairement plus large que dans les cas 1/2 pour
  // que ce scénario reste réaliste — un worker dont `candidates.length`
  // atteint son propre quota est TOUJOURS `truncated=true` chez
  // `pairBuckets`, jamais `false`), mais le TOTAL agrégé atteint quand même
  // le plafond GLOBAL — doit rester reporté comme tronqué (le plafond
  // global compte, pas seulement les plafonds individuels). ──
  {
    const wideQuota = 2000; // largement au-dessus de ce que chaque tranche trouve ici
    const results: SearchResult[] = [
      { candidates: fakeCandidates(1050), explored: 100_000, truncated: false },
      { candidates: fakeCandidates(1050), explored: 100_000, truncated: false },
      { candidates: fakeCandidates(1050), explored: 100_000, truncated: false },
      { candidates: fakeCandidates(1050), explored: 100_000, truncated: false },
    ];
    const out = combineParallelPairingResults(results, wideQuota, GLOBAL_MAX);
    egal(out.candidates.length >= GLOBAL_MAX, true, 'le total atteint le plafond global dans ce scénario');
    egal(out.truncated, true, 'le total agrégé atteignant le plafond global reste tronqué, même sans aucune troncature individuelle');
  }

  // ── Cas 4 (référence) : rien tronqué nulle part, total loin du plafond —
  // doit rester `false`, comme avant ce correctif (pas de régression sur le
  // cas simple). ──
  {
    const results: SearchResult[] = [
      { candidates: fakeCandidates(10), explored: 1_000, truncated: false },
      { candidates: fakeCandidates(5), explored: 500, truncated: false },
    ];
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX);
    egal(out.truncated, false, 'aucune troncature individuelle, total loin du plafond global : pas tronqué');
    egal(out.explored, 1_500, "'explored' reste la somme simple, inchangé par ce correctif");
  }
}
