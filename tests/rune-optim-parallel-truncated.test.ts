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
// Étendu (voir spec/outils/optimizer/moteur/diagnostics.md,
// « Quasi-succès à l'appariement ») : `combineParallelPairingResults` fusionne aussi
// le near-miss de N tranches — vérifie qu'elle garde le MEILLEUR entre
// elles, pas juste celui de la première/dernière, y compris quand une
// tranche n'en a AUCUN.
//
// ⚠️ **Cas 1 INVERSÉ (
// revue technique).** La correction de 2026-08-19 avait raison sur le motif
// (un quota de tranche n'est pas un budget-temps épuisé) et tort sur la
// conclusion : une tranche qui atteint SON quota s'arrête (`pairBuckets`,
// `break outer`), et le reste de SA tranche n'est jamais visité. Elle rend
// donc la recherche TRONQUÉE dès qu'il reste des paires non visitées
// (`explored < totalPairs`, l'espace exact que le Worker a déjà calculé pour
// choisir le régime) — sauf si le quota tombe sur la toute dernière paire.
// Le motif (`motifTroncature`) voyage désormais dans le résultat fusionné.

import { BuildCandidate, NearMiss, SearchResult, TraceCandidat, combineParallelPairingResults } from '../src/lib/runeBuildOptim';
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

// L'espace entier parcouru : les cas near-miss décrivent des recherches
// complètes, `totalPairs` vaut donc la somme des `explored`.
function espaceParcouru(results: SearchResult[]): number {
  return results.reduce((s, r) => s + r.explored, 0);
}

function fakeNearMiss(shortfall: number, requested = 100): NearMiss {
  return { runeIds: [shortfall], stats: [], effTotal: 0, shortfalls: [{ key: 'spd', kind: 'min', requested, actual: requested - shortfall, shortfall }] };
}

export default function testRuneOptimParallelTruncated() {
  titre('Optimizer · combineParallelPairingResults — signal truncated fiable en pairing parallèle');

  const PER_WORKER_MAX = 1000;
  const GLOBAL_MAX = 4000; // 4 workers x 1000

  // ── Cas 1 (INVERSÉ) : un worker remplit SON PROPRE quota
  // (tranche riche) et s'arrête ; les 3 autres finissent leur tranche ENTIÈRE.
  // Le total reste très en-deçà du plafond GLOBAL, mais 77 000 paires de la
  // tranche riche n'ont jamais été visitées : la recherche est TRONQUÉE, motif
  // « quota de tranche ». L'ancienne attente (`false`) annonçait complète une
  // recherche qui ne l'était pas — c'est le « INCOHÉRENT » du cas réel de b4. ──
  const tranchesQuota = (): SearchResult[] => [
    fakeResult(fakeCandidates(PER_WORKER_MAX), 500_000, true), // quota rempli pile
    fakeResult(fakeCandidates(50), 10_000, false), // fini, pas tronqué
    fakeResult(fakeCandidates(30), 8_000, false),
    fakeResult(fakeCandidates(20), 5_000, false),
  ];
  {
    const out = combineParallelPairingResults(tranchesQuota(), PER_WORKER_MAX, GLOBAL_MAX, 600_000);
    egal(out.candidates.length, PER_WORKER_MAX + 50 + 30 + 20, 'total = somme des 4 tranches');
    egal(out.truncated, true, 'une tranche arrêtée sur SON quota avec des paires non visitées (523 000 < 600 000) rend la recherche tronquée, même sous le plafond global');
    egal(out.motifTroncature, 'quotaTranche', 'motif transmis : quota de tranche, ni temps ni plafond global');
  }

  // ── Cas 1 bis : la même tranche atteint son quota sur sa TOUTE DERNIÈRE
  // paire — `explored` couvre exactement l'espace (523 000 = totalPairs).
  // Rien n'a été laissé de côté : pas de troncature, pas de motif. ──
  {
    const out = combineParallelPairingResults(tranchesQuota(), PER_WORKER_MAX, GLOBAL_MAX, 523_000);
    egal(out.truncated, false, 'quota atteint sur la dernière paire : explored = totalPairs, recherche complète');
    egal(out.motifTroncature, undefined, 'aucun motif fabriqué sur une recherche complète');
  }

  // ── Cas 2 : un worker épuise son budget-temps AVANT de remplir son
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
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX, 30_000_000);
    egal(out.truncated, true, 'un worker qui épuise son budget-temps AVANT son propre quota est une vraie troncature, toujours reportée');
    egal(out.motifTroncature, 'maxMs', 'motif transmis : le temps');
  }

  // ── Cas 2 bis : une tranche sur son quota ET une autre sur le temps — le
  // temps l'emporte dans le motif (ordre : plafond global, temps, quota de
  // tranche). ──
  {
    const results: SearchResult[] = [
      fakeResult(fakeCandidates(PER_WORKER_MAX), 500_000, true), // quota
      fakeResult(fakeCandidates(200), 900_000, true), // temps
    ];
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX, 5_000_000);
    egal(out.truncated, true, 'quota + temps : tronqué');
    egal(out.motifTroncature, 'maxMs', 'quota + temps : le motif est le temps');
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
    const out = combineParallelPairingResults(results, wideQuota, GLOBAL_MAX, 400_000);
    egal(out.candidates.length >= GLOBAL_MAX, true, 'le total atteint le plafond global dans ce scénario');
    egal(out.truncated, true, 'le total agrégé atteignant le plafond global reste tronqué, même sans aucune troncature individuelle');
    egal(out.motifTroncature, 'maxCollected', 'motif transmis : le plafond global');
  }

  // ── Cas 3 bis : les quatre tranches pleines (plafond global atteint par
  // la somme des quotas) — le plafond global l'emporte sur le quota de
  // tranche dans le motif. ──
  {
    const results: SearchResult[] = [0, 1, 2, 3].map(() => fakeResult(fakeCandidates(PER_WORKER_MAX), 100_000, true));
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX, 1_000_000);
    egal(out.truncated, true, 'quatre quotas pleins : tronqué');
    egal(out.motifTroncature, 'maxCollected', 'quatre quotas pleins : le motif est le plafond global');
  }

  // ── Cas 4 (référence) : rien tronqué nulle part, total loin du plafond —
  // doit rester `false`, comme avant ce correctif (pas de régression sur le
  // cas simple). ──
  {
    const results: SearchResult[] = [fakeResult(fakeCandidates(10), 1_000, false), fakeResult(fakeCandidates(5), 500, false)];
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX, 1_500);
    egal(out.truncated, false, 'aucune troncature individuelle, total loin du plafond global : pas tronqué');
    egal(out.motifTroncature, undefined, 'pas tronqué : aucun motif');
    egal(out.explored, 1_500, "'explored' reste la somme simple, inchangé par ce correctif");
  }

  // ── Traceur : la trace retenue porte le budget GLOBAL, pas celui de sa
  // tranche. Ici la tranche dont la paire est atteinte a fini sa tranche
  // (`tronque: false`), une autre s'est arrêtée sur son quota : le résultat
  // fusionné est tronqué, sa trace doit le dire — sans modifier la trace de
  // tranche reçue. ──
  {
    const trace = (paireAtteinte: boolean, tronque: boolean): TraceCandidat =>
      ({ appariement: { paireAtteinte, collecte: false }, budget: { tronque, motif: tronque ? 'maxCollected' : null } }) as unknown as TraceCandidat;
    const traceTranche = trace(true, false);
    const results: SearchResult[] = [
      { ...fakeResult(fakeCandidates(PER_WORKER_MAX), 500_000, true), traceur: trace(false, true) },
      { ...fakeResult(fakeCandidates(50), 10_000, false), traceur: traceTranche },
    ];
    const out = combineParallelPairingResults(results, PER_WORKER_MAX, GLOBAL_MAX, 600_000);
    egal(out.traceur?.appariement.paireAtteinte, true, 'la trace retenue est celle de la tranche qui a atteint la paire');
    egal(JSON.stringify(out.traceur?.budget), JSON.stringify({ tronque: true, motif: 'quotaTranche' }), 'son budget est celui du résultat fusionné');
    egal(JSON.stringify(traceTranche.budget), JSON.stringify({ tronque: false, motif: null }), 'la trace de tranche reçue reste intacte');
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
    const out = combineParallelPairingResults(results, 1000, 4000, espaceParcouru(results));
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
    const out = combineParallelPairingResults(results, 1000, 4000, espaceParcouru(results));
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
    const out = combineParallelPairingResults(results, 1000, 4000, espaceParcouru(results));
    egal(out.globalNearMiss?.shortfalls[0]?.shortfall, 10, 'la tranche avec le plus petit écart relatif (10/100) gagne, malgré une tranche à null au milieu');
  }

  // ── Global : AUCUNE tranche n'a de near-miss global (quickOk a tout
  // rejeté partout) — la fusion doit rester `null`, pas planter. ──
  {
    const results: SearchResult[] = [fakeResult(fakeCandidates(0), 100, false), fakeResult(fakeCandidates(0), 100, false)];
    const out = combineParallelPairingResults(results, 1000, 4000, espaceParcouru(results));
    egal(out.globalNearMiss, null, 'aucune tranche → near-miss global toujours null, pas une erreur');
  }
}
