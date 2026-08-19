// Moteur de recherche de builds (Outils · Optimizer) — un résultat annoncé
// comme valide mais faux pousserait à re-runer sur une base erronée : même
// catégorie « grave et invisible » que la vitesse de combat (voir README).

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import {
  BuildCandidate,
  BuildRequirement,
  CHECKPOINT_EVERY,
  HalfCombo,
  NodeBudget,
  buildBuckets,
  candidateMetricTotal,
  diagnoseFeasibility,
  dominatesHalfCombo,
  insertIntoSkyline,
  pairBuckets,
  prepareSearch,
  rankBlockingConditions,
  excludedRuneIds,
  objectiveScore,
  searchBuilds,
  totalPairCount,
} from '../src/lib/runeBuildOptim';
import { StatKey, runeEfficiency, runeScore } from '../src/lib/effects';
import { StatRow } from '../src/lib/stats';
import { egal, ok, titre } from './outils';

const ZERO_BASE: BaseStats = { hp: 1000, atk: 100, def: 100, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

function main(code: number, value: number): EffectLine {
  return { code, value };
}

function rune(id: number, slot: number, set: string, mainCode = 8, mainValue = 10): RuneDetail {
  return {
    id,
    slot,
    set,
    rank: 6,
    rarity: 5,
    level: 15,
    main: main(mainCode, mainValue),
    subs: [],
  };
}

// Pool minimal : exactement une rune par slot, formant Violent(4) + Will(2).
function poolViolentWill(): RuneDetail[] {
  return [
    rune(1, 1, 'violent'),
    rune(2, 2, 'violent'),
    rune(3, 3, 'violent'),
    rune(4, 4, 'violent'),
    rune(5, 5, 'will'),
    rune(6, 6, 'will'),
  ];
}

export default function testRuneOptim() {
  titre('Optimizer · recherche de builds');

  // Combo satisfait : Violent 4p + Will 2p, un seul candidat possible dans ce pool.
  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'Violent+Will satisfait par le pool → 1 combinaison trouvée');
    egal(
      res.candidates[0]?.runeIds.slice().sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6],
      'la combinaison retenue utilise bien les 6 runes du pool'
    );
  }

  // Même pool, mais combo demandant 2× Will (4 pièces) : le pool n'en a que 2.
  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['will', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(res.candidates.length, 0, '2× Will exigé, seulement 2 pièces Will possédées → aucune combinaison');
  }

  // Minimum de stat hors de portée avec ce pool → aucun candidat.
  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: { spd: 999_999 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 0, 'minimum de VIT inatteignable → aucune combinaison');
  }

  // Minimum de stat atteignable : mêmes runes, un minimum bas doit repasser.
  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: { spd: 105 } },
      metric: 'eff',
    });
    ok(res.candidates.length === 1, 'minimum de VIT atteignable (base 100 + 6×VIT plat 10) → 1 combinaison');
  }

  // ⚠️ Cas soulevé en revue : le meet-in-the-middle scinde les 6 slots en
  // deux moitiés de 3 (slots 1-3 / 4-6) — si les DEUX sets demandés sont
  // répartis à cheval sur les deux moitiés (aucune des deux ne porte, à elle
  // seule, assez de pièces d'AUCUN des deux sets), le moteur doit quand même
  // trouver la combinaison en additionnant les comptes des deux côtés au
  // moment de les apparier (voir `satisfiesSets` dans runeBuildOptim.ts).
  // Une implémentation qui vérifierait chaque moitié indépendamment, sans
  // combiner les comptes, manquerait ce cas.
  {
    const pool = [
      // Moitié A (slots 1-3) : 2 Violent + 1 Will — ni 4 Violent, ni 2 Will à elle seule.
      rune(1, 1, 'violent'),
      rune(2, 2, 'will'),
      rune(3, 3, 'violent'),
      // Moitié B (slots 4-6) : 2 Violent + 1 Will — même chose, isolément insuffisant.
      rune(4, 4, 'violent'),
      rune(5, 5, 'violent'),
      rune(6, 6, 'will'),
    ];
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['violent', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(
      res.candidates.length,
      1,
      'Violent(4)+Will(2) réparti à cheval sur les deux moitiés (2+1 de chaque côté) → trouvé quand même'
    );
  }

  // Variante : la somme des deux moitiés N'ATTEINT PAS le compte requis
  // (3 Violent au lieu de 4) → aucune combinaison, même si chaque moitié
  // « a l'air » de contribuer.
  {
    const pool = [
      rune(1, 1, 'violent'),
      rune(2, 2, 'will'),
      rune(3, 3, 'violent'),
      rune(4, 4, 'violent'),
      rune(5, 5, 'shield'), // au lieu d'un 2e Violent : le total tombe à 3
      rune(6, 6, 'will'),
    ];
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['violent', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(res.candidates.length, 0, 'somme des deux moitiés = 3 Violent (4 exigés) → aucune combinaison');
  }

  titre('Optimizer · exclusion des runes portées ailleurs');

  const gearWith = (runes: RuneDetail[]) => ({ base: ZERO_BASE, runes, artifacts: [] });
  const monA = { unitKey: 'a', com2usId: 111, gear: gearWith([rune(1, 1, 'violent')]) };
  const monB = { unitKey: 'b', com2usId: 222, gear: gearWith([rune(2, 2, 'violent'), rune(3, 3, 'violent')]) };

  {
    const excluded = excludedRuneIds([monA, monB], 111);
    egal(Array.from(excluded).sort(), [2, 3], "exclut les runes d'un AUTRE monstre, jamais les siennes propres");
  }

  {
    // Le seul candidat du slot 1 (rune 1) appartient à un AUTRE monstre : une
    // fois exclu, la combinaison Violent+Will devient impossible.
    const pool = poolViolentWill();
    const excluded = excludedRuneIds(
      [{ unitKey: 'other', com2usId: 999, gear: gearWith([rune(1, 1, 'violent')]) }],
      111 // le monstre optimisé n'est pas 999 : sa propre rune 1 n'existe pas ici, seule celle d'un autre compte
    );
    const filtered = pool.filter((r) => !excluded.has(r.id));
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: filtered,
      requirement: { sets: ['violent', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(res.candidates.length, 0, 'rune du slot 1 exclue (portée ailleurs) → plus aucune combinaison possible');

    const resNonFiltre = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['violent', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(resNonFiltre.candidates.length, 1, 'sans exclusion (« explorer tout l\'inventaire »), la combinaison revient');
  }

  titre('Optimizer · statistique principale imposée (slots 2/4/6)');

  // Deux candidats possibles sur le slot 2 : l'un en ATQ% (code 4), l'autre
  // en DEF% (code 6) — même set, mêmes autres slots inchangés.
  function poolSlot2Choice(): RuneDetail[] {
    return [
      rune(1, 1, 'violent'),
      rune(2, 2, 'violent', 4, 20), // ATQ%
      rune(20, 2, 'violent', 6, 20), // DEF% — même slot, mainstat différente
      rune(3, 3, 'violent'),
      rune(4, 4, 'violent'),
      rune(5, 5, 'will'),
      rune(6, 6, 'will'),
    ];
  }

  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolSlot2Choice(),
      requirement: { sets: ['violent', 'will'], minStats: {}, mainStats: { 2: [4] } },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'mainStats {2:[ATQ%]} → une seule combinaison possible');
    ok(
      res.candidates[0]?.runeIds.includes(2) && !res.candidates[0]?.runeIds.includes(20),
      'la rune DEF% du slot 2 (id 20) est écartée, celle en ATQ% (id 2) retenue'
    );
  }

  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolSlot2Choice(),
      requirement: { sets: ['violent', 'will'], minStats: {}, mainStats: { 2: [6] } },
      metric: 'eff',
    });
    ok(
      !!res.candidates[0]?.runeIds.includes(20) && !res.candidates[0]?.runeIds.includes(2),
      'mainStats {2:[DEF%]} → bascule sur la rune DEF% (id 20), la ATQ% (id 2) écartée'
    );
  }

  {
    // Aucune rune du slot 2 n'est en Taux Crit (code 9) dans ce pool.
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolSlot2Choice(),
      requirement: { sets: ['violent', 'will'], minStats: {}, mainStats: { 2: [9] } },
      metric: 'eff',
    });
    egal(res.candidates.length, 0, 'mainStats exigeant une stat absente du slot → aucune combinaison');
  }

  titre('Optimizer · conditions maximum');

  {
    // Base 100 VIT + 6 runes à +10 VIT plat chacune (voir `rune()`) = 160.
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {}, maxStats: { spd: 150 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 0, 'total réel (160) au-delà du maximum demandé (150) → rejeté');
  }

  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {}, maxStats: { spd: 200 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'total réel (160) sous le maximum demandé (200) → accepté');
  }

  {
    // Minimum ET maximum encadrant exactement la valeur réelle (160).
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: { spd: 160 }, maxStats: { spd: 160 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'minimum = maximum = valeur réelle exacte → toujours accepté');
  }

  titre('Optimizer · élagage sûr — dominance');

  // Deux candidats sur le slot 2, MÊME set, l'un strictement meilleur que
  // l'autre (VIT 20 contre 10, rien d'autre ne les distingue) — sans
  // l'élagage de dominance, les DEUX formeraient une combinaison valide
  // distincte (le set exigé ne dépend pas de laquelle est choisie), donc les
  // deux apparaîtraient dans les résultats. Avec l'élagage, la dominée ne
  // doit plus jamais y figurer.
  {
    const pool = [
      rune(1, 1, 'violent'),
      rune(2, 2, 'violent', 8, 20), // dominante : VIT 20
      rune(21, 2, 'violent', 8, 10), // dominée : VIT 10, rien d'autre ne la distingue
      rune(3, 3, 'violent'),
      rune(4, 4, 'violent'),
      rune(5, 5, 'will'),
      rune(6, 6, 'will'),
    ];
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['violent', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'rune dominée écartée avant la recherche → une seule combinaison, pas deux');
    ok(
      !!res.candidates[0]?.runeIds.includes(2) && !res.candidates[0]?.runeIds.includes(21),
      'la combinaison retenue utilise la dominante (id 2), jamais la dominée (id 21)'
    );
  }

  titre('Optimizer · élagage sûr — faisabilité (minimum)');

  // Slot 1 : deux candidats. Slots 2-6 : un seul chacun, VIT 10 (défaut de
  // `rune()`) → 50 de VIT garantis quoi qu'il arrive. Minimum posé EXACTEMENT
  // au meilleur cas atteignable avec la rune forte (100 base + 50 + 30 = 180) :
  // doit encore passer (pas de rejet par excès de zèle sur la frontière), et
  // la rune faible (max atteignable 100+50+5=155 < 180) ne doit jamais
  // apparaître — elle est mathématiquement incapable d'atteindre 180, quel
  // que soit ce qui remplit les 5 autres emplacements.
  //
  // ⚠️ La faible porte aussi un peu d'ATQ (absent de la forte) : sans ça,
  // la forte DOMINERAIT la faible (voir « élagage sûr — dominance » plus
  // haut) et ce test finirait par vérifier la dominance, pas la faisabilité,
  // sans qu'on s'en aperçoive — les deux mécanismes doivent rester isolables.
  function poolFeasibilityMin(): RuneDetail[] {
    const faible: RuneDetail = {
      id: 1,
      slot: 1,
      set: 'violent',
      rank: 6,
      rarity: 5,
      level: 15,
      main: main(8, 5), // VIT 5
      subs: [main(3, 100)], // ATQ +100 — incomparable à la forte, pas dominée
    };
    return [
      faible,
      rune(11, 1, 'violent', 8, 30), // forte : VIT 30
      rune(2, 2, 'violent'),
      rune(3, 3, 'violent'),
      rune(4, 4, 'violent'),
      rune(5, 5, 'will'),
      rune(6, 6, 'will'),
    ];
  }

  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolFeasibilityMin(),
      requirement: { sets: ['violent', 'will'], minStats: { spd: 180 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'minimum = meilleur cas exact de la rune forte → toujours trouvé (pas de faux rejet)');
    ok(
      !!res.candidates[0]?.runeIds.includes(11) && !res.candidates[0]?.runeIds.includes(1),
      'la combinaison utilise la rune forte (id 11) ; la faible (id 1) est mathématiquement hors de portée'
    );
  }

  {
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolFeasibilityMin(),
      requirement: { sets: ['violent', 'will'], minStats: { spd: 181 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 0, 'minimum un cran au-dessus du meilleur cas possible → aucune combinaison');
  }

  titre('Optimizer · élagage sûr — faisabilité (maximum)');

  // Symétrique : slot 1 a une rune « risquée » dont la seule contribution
  // (même sans compter les 5 autres emplacements) dépasse déjà le maximum
  // demandé, et une rune sûre qui, combinée aux 5 autres, reste dessous.
  {
    const pool = [
      rune(1, 1, 'violent', 8, 60), // risquée : seule, 100+60=160 > 157
      rune(11, 1, 'violent', 8, 5), // sûre : combinaison complète = 100+50+5=155 ≤ 157
      rune(2, 2, 'violent'),
      rune(3, 3, 'violent'),
      rune(4, 4, 'violent'),
      rune(5, 5, 'will'),
      rune(6, 6, 'will'),
    ];
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['violent', 'will'], minStats: {}, maxStats: { spd: 157 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'la rune risquée est hors course, la sûre reste sous le maximum → une combinaison');
    ok(
      !!res.candidates[0]?.runeIds.includes(11) && !res.candidates[0]?.runeIds.includes(1),
      'la combinaison retenue utilise la rune sûre (id 11), jamais la risquée (id 1)'
    );
  }

  titre('Optimizer · diagnostic de faisabilité (diagnoseFeasibility)');

  // Même pool que « faisabilité (minimum) » ci-dessus : meilleur cas atteignable
  // sur VIT = 180 (100 base + 50 des 5 autres emplacements fixes + 30 de la
  // rune forte). ⚠️ Prouve une IMPOSSIBILITÉ, ne prouve jamais une possibilité
  // — `satisfiable=true` à 180 ne garantit pas qu'une recherche complète
  // trouve un candidat, seulement qu'aucune preuve mathématique ne l'exclut.
  {
    const diag = diagnoseFeasibility({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolFeasibilityMin(),
      requirement: { sets: ['violent', 'will'], minStats: { spd: 181 } },
      metric: 'eff',
    });
    egal(diag.length, 1, 'une seule condition posée → un seul verdict');
    egal(diag[0]?.key, 'spd', 'porte sur la bonne stat');
    egal(diag[0]?.kind, 'min', 'condition minimum');
    egal(diag[0]?.bound, 180, 'meilleur cas atteignable = 180 (identique au calcul de recherche)');
    egal(diag[0]?.satisfiable, false, '181 > 180 → preuve d’impossibilité');
  }
  {
    const diag = diagnoseFeasibility({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolFeasibilityMin(),
      requirement: { sets: ['violent', 'will'], minStats: { spd: 180 } },
      metric: 'eff',
    });
    egal(diag[0]?.satisfiable, true, 'exactement au meilleur cas → pas de preuve d’impossibilité (frontière exacte)');
  }

  // Symétrique côté maximum : ZERO_BASE a 15 de Taux Crit de base, aucune
  // rune ne peut jamais RETIRER — le plancher incompressible (aucune
  // contribution de rune) vaut donc 15, quel que soit le pool.
  {
    const diag = diagnoseFeasibility({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {}, maxStats: { cr: 10 } },
      metric: 'eff',
    });
    egal(diag[0]?.kind, 'max', 'condition maximum');
    egal(diag[0]?.bound, 15, 'plancher incompressible = la base nue (aucune rune ne contribue au Taux Crit ici)');
    egal(diag[0]?.satisfiable, false, 'le plancher (15) dépasse déjà le maximum demandé (10) → impossible même sans rune');
  }
  {
    const diag = diagnoseFeasibility({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {}, maxStats: { cr: 20 } },
      metric: 'eff',
    });
    egal(diag[0]?.satisfiable, true, 'le plancher (15) reste sous le maximum demandé (20) → pas de preuve d’impossibilité');
  }

  // Aucune condition posée → aucun verdict à afficher (pas une liste de
  // huit stats toutes « satisfaisables », un tableau vide).
  {
    const diag = diagnoseFeasibility({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(diag.length, 0, 'sans minStats ni maxStats posés, rien à diagnostiquer');
  }

  titre('Optimizer · palier 2 — condition la plus bloquante (rankBlockingConditions)');

  // `poolViolentWill()` : 1 rune/slot, VIT 10 chacune (défaut de `rune()`) —
  // maximum TOTAL de VIT atteignable = 100 (base) + 6×10 = 160. Poser
  // spd=175 rend la condition GLOBALEMENT hors de portée (voir
  // `diagnoseFeasibility` plus haut pour ce type de preuve) : TOUS les slots
  // se vident, pas seulement un. atk=50 reste TOUJOURS trivialement
  // satisfait (base ATQ = 100 ≥ 50 sans la moindre contribution de rune) —
  // jamais bloquant, quel que soit le pool.
  {
    const diag = rankBlockingConditions({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: { spd: 175, atk: 50 } },
      metric: 'eff',
    });
    egal(diag.baselineMinSlot, 0, 'spd=175 dépasse le maximum total atteignable (160) → tous les slots vidés');
    egal(diag.impacts.length, 2, 'deux conditions posées → deux verdicts');
    egal(diag.impacts[0]?.key, 'spd', 'retirer VIT est le plus impactant → classé en premier');
    egal(diag.impacts[0]?.poolMinSlotWithout, 1, 'sans la contrainte VIT, le pool complet (1 rune/slot) redevient valide');
    egal(diag.impacts[1]?.key, 'atk', 'retirer ATQ est classé en second, jamais devant un vrai gain');
    egal(
      diag.impacts[1]?.poolMinSlotWithout,
      0,
      'ATQ n’était déjà pas bloquant (base 100 ≥ 50 sans la moindre rune) → aucun gain à le retirer'
    );
  }

  // Sans condition posée, rien à classer — un tableau vide, pas une liste
  // dégénérée.
  {
    const diag = rankBlockingConditions({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {} },
      metric: 'eff',
    });
    egal(diag.impacts.length, 0, 'sans condition posée, rien à classer');
  }

  titre('Optimizer · élagage sûr — faisabilité de set (précoce, avec joker)');

  // Violent (4 pièces) demandé. Slot par slot :
  //  - slots 1, 2 : une rune Violent chacun → la moitié A (slots 1-3) peut au
  //    mieux apporter 2 pièces réelles ;
  //  - slot 3     : Intangible (le joker) ;
  //  - slot 4     : une rune Violent → la moitié B (slots 4-6) peut au mieux
  //    apporter 1 pièce réelle ;
  //  - slots 5, 6 : Fight (2 pièces), une chacune → 1 activation Fight
  //    COMPLÈTE, sans reste — sans ça, un second set incomplet empêcherait le
  //    joker d'aider Violent (règle du jeu, voir effects.ts « activeSets »).
  // Total Violent réel possédé = 3 (2 côté A + 1 côté B), PILE 1 en dessous
  // des 4 exigés : seul le joker peut combler ce dernier manque.
  // ⚠️ Sans le crédit de joker dans l'élagage précoce sur les sets
  // (`buildBuckets`), la moitié A serait coupée dès le choix du premier slot
  // — 2 (son propre maximum) + 1 (maximum de l'autre moitié) = 3 < 4 exigés,
  // sans savoir qu'un joker existe ailleurs dans le pool — avant même que la
  // vérification finale sur les runes réelles n'ait sa chance. Ce test
  // échouerait silencieusement (0 combinaison au lieu de 1) si ce crédit
  // n'était pas correctement appliqué.
  {
    const pool = [
      rune(1, 1, 'violent'),
      rune(2, 2, 'violent'),
      rune(3, 3, 'intangible'),
      rune(4, 4, 'violent'),
      rune(5, 5, 'fight'),
      rune(6, 6, 'fight'),
    ];
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['violent'], minStats: {} },
      metric: 'eff',
    });
    egal(
      res.candidates.length,
      1,
      '3 pièces Violent réelles + 1 joker (seul set incomplet) → le joker comble la 4e, combinaison trouvée'
    );
  }

  // Variante « sans issue » : même pool, mais un DEUXIÈME set incomplet
  // apparaît (Fight à 1 pièce au lieu de 2) — le joker ne peut plus aider
  // Violent (règle du jeu : deux sets incomplets ou plus → le joker n'aide
  // personne). L'élagage précoce reste sûr (il ne coupe jamais à tort), mais
  // la vérification finale doit quand même rejeter cette combinaison.
  {
    const pool = [
      rune(1, 1, 'violent'),
      rune(2, 2, 'violent'),
      rune(3, 3, 'intangible'),
      rune(4, 4, 'violent'),
      rune(5, 5, 'fight'),
      rune(6, 6, 'shield'), // au lieu d'un 2e Fight : Fight ET Shield restent incomplets
    ];
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['violent'], minStats: {} },
      metric: 'eff',
    });
    egal(
      res.candidates.length,
      0,
      'deux sets incomplets en plus de Violent (Fight, Shield) → le joker n\'aide plus personne, aucune combinaison'
    );
  }

  titre('Optimizer · élagage sûr — efficacité mesurée (pas seulement sûr)');

  // 20 candidats sur le slot 1 (VIT 1 à 20), seuls les 3 meilleurs (VIT 18,
  // 19, 20) peuvent mathématiquement atteindre le minimum demandé. Aucun set
  // exigé (sets: []) : chaque moitié ne forme qu'UN SEUL compartiment, donc le
  // nombre de paires explorées (`explored`) vaut EXACTEMENT
  // (candidats survivants du slot 1) × 1 × 1 (slots 2/3, un seul chacun) × 1
  // (moitié B, un seul candidat par slot). Sans l'élagage, les 20 candidats
  // survivraient tous (bien en dessous de tout plafond de pré-filtrage) et
  // `explored` vaudrait 20, pas 3 — un test qui mesure l'ÉLAGAGE en action,
  // pas seulement l'absence de faux rejet.
  //
  // ⚠️ Chaque rune porte aussi un peu d'ATQ, inversement corrélé au VIT
  // (21−v) : sans ça, la dominance (testée séparément plus haut) collapserait
  // À ELLE SEULE les 20 candidats à 1 seul avant même d'atteindre l'élagage
  // de faisabilité — les deux mécanismes se chevaucheraient sans qu'on
  // puisse isoler celui qu'on prétend mesurer ici.
  {
    const pool: RuneDetail[] = [];
    for (let v = 1; v <= 20; v++) {
      pool.push({
        id: 100 + v,
        slot: 1,
        set: 'violent',
        rank: 6,
        rarity: 5,
        level: 15,
        main: main(8, v),
        subs: [main(3, 21 - v)],
      });
    }
    pool.push(rune(2, 2, 'violent'), rune(3, 3, 'violent'), rune(4, 4, 'violent'), rune(5, 5, 'violent'), rune(6, 6, 'violent'));

    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: [], minStats: { spd: 168 } }, // 100 base + 50 (slots 2-6) + 18 exigé du slot 1
      metric: 'eff',
    });
    egal(res.candidates.length, 3, 'seuls les 3 candidats du slot 1 capables d\'atteindre 168 (VIT 18/19/20) passent');
    egal(
      res.explored,
      3,
      'exactement 3 paires explorées — la preuve que les 17 candidats hors de portée ont été écartés AVANT la recherche, pas juste ignorés au tri final'
    );
  }

  titre('Optimizer · objectif Dégâts — Taux Crit plafonné à 100 %');

  // `objectiveScore` opère sur un candidat déjà calculé (stats + effTotal),
  // pas besoin de faire tourner la recherche pour ce test.
  {
    function statRow(key: StatKey, total: number): StatRow {
      return { key, label: '', base: 0, bonus: 0, total, suffix: '' };
    }
    function candidateAvecCr(cr: number): BuildCandidate {
      return {
        runeIds: [1, 2, 3, 4, 5, 6],
        stats: [
          statRow('hp', 1),
          statRow('atk', 1000),
          statRow('def', 1),
          statRow('spd', 1),
          statRow('cr', cr),
          statRow('cd', 100),
          statRow('res', 1),
          statRow('acc', 1),
        ],
        effTotal: 0,
      };
    }

    const a100 = objectiveScore(candidateAvecCr(100), 'degats');
    const a110 = objectiveScore(candidateAvecCr(110), 'degats');
    egal(
      a110,
      a100,
      '110% de Taux Crit ne rapporte pas plus de dégâts espérés que 100% — plafonné dans la formule, comme en jeu'
    );

    const a90 = objectiveScore(candidateAvecCr(90), 'degats');
    ok(
      a90 < a100,
      'en-dessous de 100%, plus de Taux Crit augmente bien les dégâts espérés — le plafond ne coupe pas prématurément'
    );
  }

  titre('Optimizer · affichage cohérent avec la mesure courante (pas figé à la recherche)');

  // ⚠️ Un candidat garde un `effTotal` FIGÉ dans la mesure active au moment
  // de la recherche (voir BuildCandidate.effTotal) — si l'utilisateur bascule
  // Efficience ↔ Score dans le menu ⚙ APRÈS avoir cherché, sans relancer,
  // `effTotal` ment. `candidateMetricTotal` doit toujours recalculer depuis
  // les VRAIES runes dans la mesure DEMANDÉE, sans jamais lire `effTotal`.
  {
    const runes = poolViolentWill();
    const runeById = new Map(runes.map((r) => [r.id, r]));
    // `effTotal` délibérément erroné (une valeur qui ne correspond à AUCUNE
    // des deux mesures réelles), pour prouver que `candidateMetricTotal` ne
    // s'y fie pas du tout.
    const candidate: BuildCandidate = { runeIds: runes.map((r) => r.id), stats: [], effTotal: -999_999 };

    const attenduEff = runes.reduce((s, r) => s + runeEfficiency(r), 0);
    const attenduScore = runes.reduce((s, r) => s + runeScore(r), 0);

    egal(
      candidateMetricTotal(candidate, runeById, 'eff'),
      attenduEff,
      "recalcule l'efficience réelle des 6 runes, jamais `effTotal`"
    );
    egal(
      candidateMetricTotal(candidate, runeById, 'score'),
      attenduScore,
      "recalcule le score SW réel des 6 runes, jamais `effTotal`"
    );
    ok(
      candidateMetricTotal(candidate, runeById, 'eff') !== candidateMetricTotal(candidate, runeById, 'score'),
      'efficience et score restent deux mesures distinctes, pas interchangeables'
    );
  }

  titre('Optimizer · règle du joker Intangible');

  // ⚠️ Reproduit le bug signalé : « Swift » annoncé actif alors qu'un second
  // ET un troisième set, ni l'un ni l'autre demandés, sont eux aussi
  // incomplets parmi les 6 runes réellement choisies — activeSets (voir
  // effects.ts) ne doit alors compléter AUCUN des trois. Le pool n'offre
  // qu'UNE seule rune par slot : une seule combinaison possible, ce test
  // vérifie donc directement si LE moteur l'accepte ou la rejette.
  {
    const pool = [
      rune(1, 1, 'swift'),
      rune(2, 2, 'swift'),
      rune(3, 3, 'swift'),
      rune(4, 4, 'intangible'),
      rune(5, 5, 'blade'), // 1 pièce d'un set 2 pièces → lui aussi incomplet
      rune(6, 6, 'shield'), // idem — DEUX sets incomplets en plus de Swift
    ];
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['swift'], minStats: {} },
      metric: 'eff',
    });
    egal(
      res.candidates.length,
      0,
      'Swift manque 1 pièce, mais DEUX autres sets sont aussi incomplets → le joker n\'aide personne, aucune combinaison'
    );
  }

  // ⚠️ Seule 1 rune Intangible peut être sertie par monstre (règle du jeu) :
  // une proposition qui en utiliserait plusieurs n'est pas équipable, même si
  // `activeSets` calculerait quand même des stats correctes (il plafonne lui-
  // même à 1 joker effectif). Pool à un seul candidat par slot, 3 runes
  // Intangible réparties sur la seconde moitié (slots 4-6) : la seule
  // combinaison possible doit être rejetée par ce garde-fou, pas seulement
  // par la règle « deux sets incomplets » ci-dessus (ici Swift est le SEUL
  // set incomplet, donc un unique joker suffirait à l'activer).
  {
    const pool = [
      rune(1, 1, 'violent'),
      rune(2, 2, 'violent'),
      rune(3, 3, 'violent'),
      rune(4, 4, 'intangible'),
      rune(5, 5, 'intangible'),
      rune(6, 6, 'intangible'),
    ];
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool,
      requirement: { sets: ['violent'], minStats: {} },
      metric: 'eff',
    });
    egal(
      res.candidates.length,
      0,
      '3 runes Intangible dans la seule combinaison possible → rejetée (une seule sertie par monstre en jeu)'
    );
  }

  titre('Optimizer · dominance de demi-builds — prototype skyline (dominatesHalfCombo/insertIntoSkyline)');

  // Demi-build minimal, seuls `pct`/`flat` important pour ces tests — les
  // autres champs sont des valeurs de remplissage sans effet sur la
  // dominance elle-même (qui ne regarde que `pct`/`flat` sur `keys`).
  function combo(pct: Partial<Record<StatKey, number>>, flat: Partial<Record<StatKey, number>>): HalfCombo {
    return {
      runes: [rune(1, 1, 'violent'), rune(2, 2, 'violent'), rune(3, 3, 'violent')],
      counts: [],
      jokers: 0,
      pct: pct as Record<string, number>,
      flat: flat as Record<string, number>,
      relevanceScore: 0,
    };
  }

  {
    const a = combo({}, { atk: 100, cr: 10 });
    const b = combo({}, { atk: 150, cr: 20 });
    ok(dominatesHalfCombo(a, b, ['atk', 'cr']), 'b ≥ a sur les deux dimensions, strictement mieux sur les deux → b domine a');
    ok(!dominatesHalfCombo(b, a, ['atk', 'cr']), 'l’inverse est faux : a n’est jamais meilleur que b ici');
  }
  {
    // Cas MIXTE : b meilleur en ATQ, moins bon en Taux Crit — ni l’un ni
    // l’autre ne domine, exactement comme pour `isDominated` au niveau
    // d’une rune (comparaison SÉPARÉE par dimension, jamais une somme).
    const a = combo({}, { atk: 100, cr: 30 });
    const b = combo({}, { atk: 150, cr: 10 });
    ok(!dominatesHalfCombo(a, b, ['atk', 'cr']), 'mélange (b mieux en ATQ, moins bon en Taux Crit) → aucune dominance');
    ok(!dominatesHalfCombo(b, a, ['atk', 'cr']), 'symétrique : a ne domine pas b non plus');
  }
  {
    // Égalité stricte sur toutes les dimensions suivies : aucun avantage
    // strict nulle part → pas de dominance (sinon a et b se domineraient
    // mutuellement et disparaîtraient tous les deux).
    const a = combo({}, { atk: 100 });
    const b = combo({}, { atk: 100 });
    ok(!dominatesHalfCombo(a, b, ['atk']), 'égalité stricte sur toutes les dimensions suivies → pas de dominance');
  }
  {
    // pct et flat comparés SÉPARÉMENT, jamais combinés : b a plus de pct
    // mais moins de flat sur la MÊME stat → mélange, pas de dominance —
    // même piège que `isDominated` sur les runes individuelles.
    const a = combo({ atk: 10 }, { atk: 100 });
    const b = combo({ atk: 20 }, { atk: 50 });
    ok(!dominatesHalfCombo(a, b, ['atk']), 'pct et flat en sens opposés sur la même stat → pas de dominance (comparés séparément)');
  }

  {
    // Skyline incrémentale : un membre strictement dominé disparaît dès son
    // arrivée (jamais ajouté) ; un nouvel arrivant qui domine un membre
    // EXISTANT le retire à son tour ; deux demi-builds incomparables (mélange)
    // cohabitent tous les deux.
    const skyline: HalfCombo[] = [];
    const fort = combo({}, { atk: 200, cr: 50 });
    const domine = combo({}, { atk: 100, cr: 20 }); // dominé par « fort » sur les deux axes
    const incomparable = combo({}, { atk: 300, cr: 10 }); // meilleur en ATQ, moins bon en Taux Crit
    insertIntoSkyline(skyline, fort, ['atk', 'cr']);
    insertIntoSkyline(skyline, domine, ['atk', 'cr']);
    egal(skyline.length, 1, 'un demi-build strictement dominé par un membre déjà présent → jamais ajouté');
    ok(skyline.includes(fort), 'le membre existant (fort) reste');

    insertIntoSkyline(skyline, incomparable, ['atk', 'cr']);
    egal(skyline.length, 2, 'un demi-build incomparable (mélange) au membre existant → les deux cohabitent');

    const encoreMeilleur = combo({}, { atk: 400, cr: 60 }); // domine « fort » ET « incomparable »
    insertIntoSkyline(skyline, encoreMeilleur, ['atk', 'cr']);
    egal(skyline.length, 1, 'un nouvel arrivant qui domine TOUS les membres existants les remplace tous');
    ok(skyline.includes(encoreMeilleur), 'seul le nouvel arrivant, meilleur sur tout, reste');
  }

  {
    // ⚠️ Escalade du budget de nœuds (`NodeBudget`) — voir spec/outils/
    // optimizer/ « Suite — escalade automatique du budget de nœuds ». Le
    // point à vérifier N'EST PAS « le résultat final est correct » (ça,
    // n'importe quelle implémentation correcte, même une qui relancerait
    // `pairBuckets` depuis le début à chaque escalade, le donnerait aussi,
    // l'algorithme étant déterministe) : c'est que `nodeBudget.max` est LU EN
    // DIRECT à chaque vérification, PAS figé dans une constante locale au
    // démarrage du générateur. Pool synthétique sans contrainte (3 runes par
    // slot, aucun set/minimum demandé) pour que bucketsA/bucketsB contiennent
    // plusieurs combos chacun (jusqu'à 27×27 paires) — assez pour qu'un
    // plafond initial de 2 soit largement insuffisant sans escalade.
    function drain<T>(gen: Generator<unknown, T, void>): T {
      let step = gen.next();
      while (!step.done) step = gen.next();
      return step.value;
    }
    // ⚠️ Codes de mainstat DIFFÉRENTS par rune (pas juste une valeur qui
    // varie) : des runes qui ne diffèrent QUE par la valeur d'un même code
    // seraient éliminées par `pruneDominated` (dominance au niveau rune,
    // voir plus haut) avant même d'atteindre `buildBuckets` — s'écroulant à
    // 1 seule rune survivante par emplacement, donc 1 seul demi-build par
    // moitié, bien trop peu pour dépasser CHECKPOINT_EVERY (500) et
    // solliciter la moindre escalade. Un code DIFFÉRENT par rune (chacune
    // meilleure sur UN axe, nulle sur les autres) les rend mutuellement
    // INCOMPARABLES : aucune n'est prunée, les 6 survivent par emplacement.
    const MAIN_CODES = [3, 4, 5, 6, 9, 10];
    const pool: RuneDetail[] = [];
    let nextId = 1;
    for (let slot = 1; slot <= 6; slot++) {
      for (const code of MAIN_CODES) pool.push(rune(nextId++, slot, 'will', code, 20));
    }
    const requirement: BuildRequirement = { sets: [], minStats: {} };
    const prepared = prepareSearch({ base: ZERO_BASE, artifacts: [], pool, requirement, metric: 'eff' });
    ok(prepared !== null, 'escalade NodeBudget : préparation réussie sur le pool synthétique');
    if (prepared) {
      const bucketsA = drain(
        buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA)
      );
      const bucketsB = drain(
        buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB)
      );

      // Référence : plafond large dès le départ, jamais atteint → exhaustif.
      // ⚠️ Doit dépasser le nombre RÉEL de paires possibles (6³ × 6³ =
      // 46 656 ici, aucune contrainte ne les élague — sans contrainte,
      // presque toutes les paires sont des candidats valides) : un plafond
      // « à vue de nez » plus petit que ce total tronquerait la référence
      // elle-même, et le test comparerait alors deux troncatures au lieu
      // d'une troncature contre une recherche exhaustive.
      const resultFull = drain(pairBuckets(prepared, bucketsA, bucketsB, { max: 200_000 }));
      ok(!resultFull.truncated, 'escalade NodeBudget : la référence (grand plafond dès le départ) est exhaustive');

      // Escalade : plafond MINUSCULE au départ, doublé entre chaque point de
      // passage — jamais un second appel à `pairBuckets`, jamais un
      // `explored` remis à zéro. ⚠️ Doit démarrer à AU MOINS
      // `CHECKPOINT_EVERY` : le repli (`explored > nodeBudget.max`) est
      // vérifié à CHAQUE paire, mais un point de passage (`yield`, seul
      // moment où CE TEST peut intervenir) n'a lieu que tous les
      // `CHECKPOINT_EVERY` — un plafond initial plus PETIT que cet
      // intervalle tronquerait la recherche AVANT le tout premier point de
      // passage, sans jamais laisser la moindre chance d'escalader (piège
      // réel, rencontré en écrivant ce test avec un plafond initial de 2).
      const nodeBudget: NodeBudget = { max: CHECKPOINT_EVERY };
      const genEscalated = pairBuckets(prepared, bucketsA, bucketsB, nodeBudget);
      let step = genEscalated.next();
      let escalations = 0;
      while (!step.done) {
        nodeBudget.max *= 2;
        escalations++;
        step = genEscalated.next();
      }
      const resultEscalated = step.value;
      ok(escalations > 1, `escalade NodeBudget : le plafond initial (${CHECKPOINT_EVERY}) a bien dû être relevé plusieurs fois (${escalations} fois)`);
      ok(!resultEscalated.truncated, 'escalade NodeBudget : la recherche escaladée finit, elle aussi, par devenir exhaustive');
      egal(resultEscalated.explored, resultFull.explored, "escalade NodeBudget : même nombre de paires explorées qu'avec un grand plafond dès le départ — la mutation de `nodeBudget.max` est bien lue EN DIRECT, pas figée au démarrage du générateur");
      egal(resultEscalated.candidates.length, resultFull.candidates.length, 'escalade NodeBudget : même nombre de candidats trouvés');

      // `totalPairCount` : sur CE pool précis (aucun set ni minimum demandé,
      // donc `pairFeasibleMin`/`comboAOk`/`quickOk` n'élaguent RIEN de plus
      // que `satisfiesSets`/le joker) l'espace annoncé doit être EXACT, pas
      // juste une borne large — une occasion rare de vérifier l'égalité
      // stricte plutôt que « au moins autant que ».
      const total = totalPairCount(prepared, bucketsA, bucketsB);
      egal(total, resultFull.explored, "totalPairCount : sur un pool sans minimum ni set demandé (aucun élagage combo par combo au-delà de satisfiesSets), l'espace annoncé correspond EXACTEMENT au nombre de paires réellement explorées par une recherche exhaustive");
    }
  }
}
