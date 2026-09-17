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
//
// Étendu (2026-09-07, voir spec/outils/optimizer/near-miss-appariement.md,
// §6 « Fusion parallèle ») : `combineParallelPairingResults` fusionne aussi
// le near-miss de N tranches — vérifie qu'elle garde le MEILLEUR entre
// elles, pas juste celui de la première/dernière, y compris quand une
// tranche n'en a AUCUN.

import { BuildCandidate, NearMiss, SearchResult, combineParallelPairingResults } from '../src/lib/runeBuildOptim';
import { egal, ok, titre } from './outils';

function fakeCandidates(n: number): BuildCandidate[] {
  return new Array(n).fill(null).map(() => ({ runeIds: [], stats: [], effTotal: 0 }) as BuildCandidate);
}

// Défauts near-miss VIDES par défaut — la plupart des cas ci-dessous testent
// `truncated`/`candidates`, pas le near-miss ; `tsc` exige ces deux champs
// depuis qu'ils sont devenus obligatoires sur `SearchResult` (délibéré, voir
// le cadrage §4).
function fakeResult(
  candidates: BuildCandidate[],
  explored: number,
  truncated: boolean,
  nearMiss?: { nearMissByCondition?: SearchResult['nearMissByCondition']; globalNearMiss?: SearchResult['globalNearMiss'] }
): SearchResult {
  return {
    candidates,
    explored,
    truncated,
    nearMissByCondition: nearMiss?.nearMissByCondition ?? [],
    globalNearMiss: nearMiss?.globalNearMiss ?? null,
  };
}

function fakeNearMiss(shortfall: number, requested = 100): NearMiss {
  return { runeIds: [shortfall], stats: [], effTotal: 0, shortfalls: [{ key: 'spd', kind: 'min', requested, actual: requested - shortfall, shortfall }] };
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
      fakeResult(fakeCandidates(PER_WORKER_MAX), 500_000, true), // quota rempli pile
      fakeResult(fakeCandidates(50), 10_000, false), // fini, pas tronqué
      fakeResult(fakeCandidates(30), 8_000, false),
      fakeResult(fakeCandidates(20), 5_000, false),
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
      fakeResult(fakeCandidates(200), 20_000_000, true), // budget épuisé, quota PAS rempli
      fakeResult(fakeCandidates(50), 10_000, false),
      fakeResult(fakeCandidates(30), 8_000, false),
      fakeResult(fakeCandidates(20), 5_000, false),
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
      fakeResult(fakeCandidates(1050), 100_000, false),
      fakeResult(fakeCandidates(1050), 100_000, false),
      fakeResult(fakeCandidates(1050), 100_000, false),
      fakeResult(fakeCandidates(1050), 100_000, false),
    ];
    const out = combineParallelPairingResults(results, wideQuota, GLOBAL_MAX);
    egal(out.candidates.length >= GLOBAL_MAX, true, 'le total atteint le plafond global dans ce scénario');
    egal(out.truncated, true, 'le total agrégé atteignant le plafond global reste tronqué, même sans aucune troncature individuelle');
  }

  // ── Cas 4 (référence) : rien tronqué nulle part, total loin du plafond —
  // doit rester `false`, comme avant ce correctif (pas de régression sur le
  // cas simple). ──
  {
    const results: SearchResult[] = [fakeResult(fakeCandidates(10), 1_000, false), fakeResult(fakeCandidates(5), 500, false)];
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX);
    egal(out.truncated, false, 'aucune troncature individuelle, total loin du plafond global : pas tronqué');
    egal(out.explored, 1_500, "'explored' reste la somme simple, inchangé par ce correctif");
  }

  titre('Optimizer · combineParallelPairingResults — fusion du near-miss entre tranches');

  // ── Par condition : deux tranches ont chacune un near-miss pour 'spd',
  // la fusion doit garder le PLUS PETIT manque (le plus proche), pas le
  // premier ou le dernier de la liste. ──
  {
    const results: SearchResult[] = [
      fakeResult(fakeCandidates(0), 100, false, { nearMissByCondition: [{ key: 'spd', kind: 'min', miss: fakeNearMiss(10) }] }),
      fakeResult(fakeCandidates(0), 100, false, { nearMissByCondition: [{ key: 'spd', kind: 'min', miss: fakeNearMiss(5) }] }),
      fakeResult(fakeCandidates(0), 100, false, { nearMissByCondition: [{ key: 'spd', kind: 'min', miss: fakeNearMiss(20) }] }),
    ];
    const out = combineParallelPairingResults(results, 1000, 4000);
    egal(out.nearMissByCondition.length, 1, "une seule entrée pour 'spd', pas une par tranche");
    egal(out.nearMissByCondition[0]?.miss.shortfalls[0]?.shortfall, 5, 'le manque le plus PETIT (5) gagne, ni le premier (10) ni le dernier (20)');
  }

  // ── Par condition : une tranche a un near-miss pour 'spd', une AUTRE pour
  // 'acc' (aucune tranche n'a les deux) — les deux doivent survivre à la
  // fusion, sans que l'absence chez une tranche efface l'entrée de l'autre. ──
  {
    const results: SearchResult[] = [
      fakeResult(fakeCandidates(0), 100, false, { nearMissByCondition: [{ key: 'spd', kind: 'min', miss: fakeNearMiss(8) }] }),
      fakeResult(fakeCandidates(0), 100, false, { nearMissByCondition: [{ key: 'acc', kind: 'min', miss: fakeNearMiss(3, 60) }] }),
    ];
    const out = combineParallelPairingResults(results, 1000, 4000);
    egal(out.nearMissByCondition.length, 2, 'les deux conditions survivent — aucune tranche ne les portait toutes les deux à la fois');
    ok(out.nearMissByCondition.some((e) => e.key === 'spd'), "l'entrée VIT (portée par une seule tranche) est bien présente");
    ok(out.nearMissByCondition.some((e) => e.key === 'acc'), "l'entrée Précision (portée par une seule tranche) est bien présente");
  }

  // ── Global : garde la plus petite distance (écart relatif max) entre
  // tranches, et une tranche SANS near-miss global (`null`) ne doit ni
  // gagner ni faire planter la fusion. ──
  {
    const results: SearchResult[] = [
      fakeResult(fakeCandidates(0), 100, false, { globalNearMiss: fakeNearMiss(30) }), // écart relatif 0.30
      fakeResult(fakeCandidates(0), 100, false, { globalNearMiss: null }), // rien trouvé sur cette tranche
      fakeResult(fakeCandidates(0), 100, false, { globalNearMiss: fakeNearMiss(10) }), // écart relatif 0.10 — le meilleur
    ];
    const out = combineParallelPairingResults(results, 1000, 4000);
    egal(out.globalNearMiss?.shortfalls[0]?.shortfall, 10, 'la tranche avec le plus petit écart relatif (10/100) gagne, malgré une tranche à null au milieu');
  }

  // ── Global : AUCUNE tranche n'a de near-miss global (quickOk a tout
  // rejeté partout) — la fusion doit rester `null`, pas planter. ──
  {
    const results: SearchResult[] = [fakeResult(fakeCandidates(0), 100, false), fakeResult(fakeCandidates(0), 100, false)];
    const out = combineParallelPairingResults(results, 1000, 4000);
    egal(out.globalNearMiss, null, 'aucune tranche → near-miss global toujours null, pas une erreur');
  }
}
