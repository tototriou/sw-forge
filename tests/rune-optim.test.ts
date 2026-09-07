// Moteur de recherche de builds (Outils · Optimizer) — un résultat annoncé
// comme valide mais faux pousserait à re-runer sur une base erronée : même
// catégorie « grave et invisible » que la vitesse de combat (voir README).

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import {
  BuildCandidate,
  BuildRequirement,
  HalfCombo,
  buildBuckets,
  candidateMetricTotal,
  diagnoseFeasibility,
  dominatesHalfCombo,
  insertIntoSkyline,
  pairBuckets,
  poolMinSlotSafe,
  prepareSearch,
  rankBlockingConditions,
  excludedRuneIds,
  searchBuilds,
  totalPairCount,
  sortCandidates,
  statTotal,
} from '../src/lib/runeBuildOptim';
import type { StatRow } from '../src/lib/stats';
import { StatKey, runeEfficiency, runeScore } from '../src/lib/effects';
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

  // ── Runes IMPOSÉES (`requirement.lockedRunes`) ───────────────────────
  // ⚠️ Vérifie que le verrou est bien une RÉDUCTION DE POOL et rien d'autre :
  // il doit se comporter EXACTEMENT comme si le slot n'avait jamais contenu
  // que cette rune. Sans test, un verrou pourrait être appliqué trop tard
  // dans le pipeline (après dominance/pré-filtrage) et se faire écarter
  // silencieusement — un build « optimal » ignorant la rune imposée, sans
  // aucun signal.
  {
    // Le pool n'a qu'UNE rune par slot : verrouiller celle qui est déjà la
    // seule possible ne doit RIEN changer au résultat.
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {}, lockedRunes: { 3: 3 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'rune imposée déjà seule candidate de son slot → résultat inchangé');
    egal(res.candidates[0]?.runeIds.includes(3), true, 'la rune imposée est bien dans la combinaison retenue');
  }
  {
    // Verrou sur une rune qui n'existe PAS dans le pool (id inconnu) : le
    // slot devient vide, donc AUCUN build — jamais un repli silencieux qui
    // ignorerait le verrou posé.
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: poolViolentWill(),
      requirement: { sets: ['violent', 'will'], minStats: {}, lockedRunes: { 3: 999 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 0, 'rune imposée absente du pool → aucune combinaison, jamais un verrou ignoré');
  }
  {
    // Deux runes possibles en slot 1, verrou sur la seconde : la recherche
    // doit retenir CELLE-LÀ, même si l'autre est meilleure en efficience.
    const pool = poolViolentWill();
    const rivale = rune(99, 1, 'violent', 8, 20); // même slot/set, MEILLEURE valeur
    const res = searchBuilds({
      base: ZERO_BASE,
      artifacts: [],
      pool: [...pool, rivale],
      requirement: { sets: ['violent', 'will'], minStats: {}, lockedRunes: { 1: 1 } },
      metric: 'eff',
    });
    egal(res.candidates.length, 1, 'slot verrouillé → une seule combinaison possible');
    egal(res.candidates[0]?.runeIds.includes(1), true, 'la rune IMPOSÉE est retenue');
    egal(res.candidates[0]?.runeIds.includes(99), false, 'la rune concurrente, pourtant meilleure, est écartée');
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

  titre('Optimizer · palier 2 — DE COMBIEN desserrer (rankBlockingConditions)');

  // `poolViolentWill()` : 1 rune/slot, VIT 10 chacune (défaut de `rune()`) —
  // maximum TOTAL de VIT atteignable = 100 (base) + 6×10 = 160. Poser
  // spd=175 rend la condition GLOBALEMENT hors de portée (voir
  // `diagnoseFeasibility` plus haut pour ce type de preuve) : TOUS les slots
  // se vident, pas seulement un. atk=50 reste TOUJOURS trivialement
  // satisfait (base ATQ = 100 ≥ 50 sans la moindre contribution de rune) —
  // jamais bloquant, quel que soit le pool : même desserrée à 0, aucun gain.
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
    egal(diag.impacts[0]?.key, 'spd', 'VIT est la moins coûteuse à desserrer → classée en premier');
    egal(diag.impacts[0]?.threshold, 160, 'seuil : pile le maximum total atteignable (100 base + 6×10)');
    egal(diag.impacts[0]?.delta, 15, '175 − 160 = 15 : desserrer VIT de 15 suffit');
    egal(diag.impacts[0]?.poolMinSlotAtThreshold, 1, 'à ce seuil, le pool complet (1 rune/slot) redevient valide');
    egal(diag.impacts[1]?.key, 'atk', 'ATQ classée en second, sans gain');
    egal(diag.impacts[1]?.threshold, null, 'ATQ n’était déjà pas bloquant → aucun seuil ne change quoi que ce soit');
    egal(diag.impacts[1]?.delta, null, 'delta null ssi threshold l’est');
    egal(diag.impacts[1]?.poolMinSlotAtThreshold, null, 'poolMinSlotAtThreshold null ssi threshold l’est');
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

  // ⚠️ algo-verify — dichotomie sur un seuil : oracle indépendant (balayage
  // exhaustif de CHAQUE valeur entière du domaine via `poolMinSlotSafe`, la
  // même fonction de pré-filtrage que `rankBlockingConditions` réutilise en
  // interne — voir son commentaire) pour vérifier DEUX choses séparément :
  // 1) la monotonicité que la dichotomie SUPPOSE (jamais présumée) tient
  //    réellement sur ce pool ; 2) le seuil qu'elle trouve est bien le plus
  //    PROCHE de la valeur demandée parmi tous ceux qui font grandir le pool
  //    — pas seulement UN seuil qui marche.
  //
  // Pool en escalier : 5 variantes par emplacement, VIT ∈ {0,5,10,15,20} —
  // à minStats.spd = t, une variante v survient au pré-filtrage ssi
  // 100 (base) + v + 5×20 (les 5 AUTRES emplacements à leur maximum
  // observé, 20 chacun) ≥ t, soit v ≥ t − 200. Le pool le plus restreint
  // (identique sur les 6 emplacements) DÉCROÎT par paliers de 5 en 5 à
  // mesure que t grandit : 5 variantes passent pour t ≤ 200, jusqu'à 0 pour
  // t > 220 — jamais un seul saut, un vrai test pour une dichotomie.
  // ⚠️ Chaque variante porte aussi une sous-stat PV anti-corrélée à sa VIT
  // (v=0 → PV le plus haut, v=20 → PV le plus bas) — sans ça, `pruneDominated`
  // (même set 'violent' pour les 5, donc comparables) éliminerait purement et
  // simplement les variantes les moins rapides, qui n'auraient plus rien de
  // « meilleur » sur AUCUN axe : plus de palier à mesurer, juste un binaire.
  // PV n'entre dans AUCUN calcul ci-dessous (hors `constrainedKeys`, qui ne
  // contient que `spd`) — un simple leurre pour rester sur la frontière de
  // Pareto.
  {
    const spdStaircase: RuneDetail[] = [];
    let id = 1000;
    for (let slot = 1; slot <= 6; slot++) {
      for (const v of [0, 5, 10, 15, 20]) {
        spdStaircase.push({
          id: id++,
          slot,
          set: 'violent',
          rank: 6,
          rarity: 5,
          level: 15,
          main: main(8, v),
          subs: [{ code: 1, value: 1000 - v * 10 }],
        });
      }
    }
    const requirement: BuildRequirement = { sets: ['violent'], minStats: { spd: 225 } };

    // 1) Monotonicité RÉELLEMENT vérifiée sur tout le domaine [0, 225], pas
    // supposée : chaque pas ne doit jamais faire DÉCROÎTRE le pool quand le
    // minimum demandé DIMINUE.
    let previous = -1;
    for (let t = 225; t >= 0; t--) {
      const size = poolMinSlotSafe(ZERO_BASE, [], undefined, spdStaircase, { ...requirement, minStats: { spd: t } });
      ok(size >= previous, `poolMinSlot ne doit jamais décroître quand minStats.spd diminue (t=${t} → ${size}, précédent ${previous})`);
      previous = size;
    }

    // 2) Oracle par balayage exhaustif : le plus petit delta (le seuil le
    // plus PROCHE de 225) qui fait grandir le pool au-delà de la baseline.
    const baseline = poolMinSlotSafe(ZERO_BASE, [], undefined, spdStaircase, requirement);
    egal(baseline, 0, 'à spd=225, aucune variante (max 220) ne passe → pool vide');
    let oracleDelta: number | null = null;
    for (let delta = 1; delta <= 225; delta++) {
      const size = poolMinSlotSafe(ZERO_BASE, [], undefined, spdStaircase, { ...requirement, minStats: { spd: 225 - delta } });
      if (size > baseline) {
        oracleDelta = delta;
        break;
      }
    }
    egal(oracleDelta, 5, 'oracle exhaustif : desserrer de 5 (seuil 220) est le premier à faire grandir le pool');

    const diag = rankBlockingConditions({ base: ZERO_BASE, artifacts: [], pool: spdStaircase, requirement, metric: 'eff' });
    egal(diag.impacts[0]?.delta, oracleDelta, 'la dichotomie trouve EXACTEMENT le même delta que le balayage exhaustif');
    egal(diag.impacts[0]?.threshold, 220, 'seuil correspondant : 225 − 5');
    egal(diag.impacts[0]?.poolMinSlotAtThreshold, 1, 'à seuil=220, seule la variante VIT=20 passe sur les 6 emplacements');
  }

  // Même vérification côté MAXIMUM (ATQ%, code 4 — pourcentage, pas plat) :
  // à maxStats.atk = t, une variante avec ATQ%=p survit au pré-filtrage ssi
  // 100 (base) + p (aucun autre emplacement ne peut RETIRER, le pire cas
  // d'un maximum ignore les 5 autres) ≤ t, soit p ≤ t − 100. Même leurre PV
  // anti-corrélé que ci-dessus, même raison (rester sur la frontière de
  // Pareto malgré le même set pour les 5 variantes).
  {
    const atkStaircase: RuneDetail[] = [];
    let id = 2000;
    for (let slot = 1; slot <= 6; slot++) {
      for (const p of [0, 5, 10, 15, 20]) {
        atkStaircase.push({
          id: id++,
          slot,
          set: 'violent',
          rank: 6,
          rarity: 5,
          level: 15,
          main: main(4, p),
          subs: [{ code: 1, value: 1000 - p * 10 }],
        });
      }
    }
    const requirement: BuildRequirement = { sets: ['violent'], minStats: {}, maxStats: { atk: 95 } };

    let previous = -1;
    for (let t = 95; t <= 200; t++) {
      const size = poolMinSlotSafe(ZERO_BASE, [], undefined, atkStaircase, { ...requirement, maxStats: { atk: t } });
      ok(size >= previous, `poolMinSlot ne doit jamais décroître quand maxStats.atk augmente (t=${t} → ${size}, précédent ${previous})`);
      previous = size;
    }

    const baseline = poolMinSlotSafe(ZERO_BASE, [], undefined, atkStaircase, requirement);
    egal(baseline, 0, 'à atk≤95, même la variante ATQ%=0 (total 100) dépasse déjà le plafond → pool vide');
    let oracleDelta: number | null = null;
    for (let delta = 1; delta <= 105; delta++) {
      const size = poolMinSlotSafe(ZERO_BASE, [], undefined, atkStaircase, { ...requirement, maxStats: { atk: 95 + delta } });
      if (size > baseline) {
        oracleDelta = delta;
        break;
      }
    }
    egal(oracleDelta, 5, 'oracle exhaustif : relever le plafond de 5 (seuil 100) est le premier à faire grandir le pool');

    const diag = rankBlockingConditions({ base: ZERO_BASE, artifacts: [], pool: atkStaircase, requirement, metric: 'eff' });
    egal(diag.impacts[0]?.delta, oracleDelta, 'la dichotomie trouve EXACTEMENT le même delta que le balayage exhaustif');
    egal(diag.impacts[0]?.threshold, 100, 'seuil correspondant : 95 + 5');
    egal(diag.impacts[0]?.poolMinSlotAtThreshold, 1, 'à seuil=100, seule la variante ATQ%=0 passe sur les 6 emplacements');
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
    // ⚠️ **Aucun plafond de PAIRES** — voir spec/outils/optimizer/pistes.md,
    // piste 8 (`maxNodes` et son escalade supprimés au profit de la borne
    // exacte `totalPairs`). Ce bloc vérifiait auparavant que le plafond
    // mutable était LU EN DIRECT par le générateur ; il vérifie désormais les
    // deux propriétés qui l'ont remplacé, et qui sont celles dont dépend tout
    // le reste :
    //   1. un appel nu à `pairBuckets` (aucun 4ᵉ argument à oublier, il n'en
    //      existe plus) épuise TOUT l'espace, sans troncature — c'est ce qui
    //      a cessé de tronquer silencieusement `searchBuilds` et les scripts
    //      de mesure ;
    //   2. `totalPairCount` annonce EXACTEMENT ce nombre de paires.
    // Pool synthétique sans contrainte (6 runes par slot, aucun set/minimum
    // demandé) pour que bucketsA/bucketsB contiennent plusieurs combos chacun
    // (6³ × 6³ = 46 656 paires) — bien au-delà de l'ancien plafond initial,
    // donc un cas où l'ancien comportement TRONQUAIT là où le nouveau va au
    // bout.
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
    // moitié, bien trop peu pour que l'espace parcouru soit significatif.
    // Un code DIFFÉRENT par rune (chacune
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
    ok(prepared !== null, 'borne exacte : préparation réussie sur le pool synthétique');
    if (prepared) {
      const bucketsA = drain(
        buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA)
      );
      const bucketsB = drain(
        buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB)
      );

      // ⚠️ Appel NU : trois arguments, rien d'autre à passer. C'est
      // exactement ce que fait `searchBuildsSteps` (donc `searchBuilds`, donc
      // les tests et les scripts de mesure) — et c'est précisément CE
      // chemin-là qui, tant qu'un 4ᵉ argument existait avec un défaut figé,
      // s'arrêtait en silence au budget initial. Sur ce pool, 46 656 paires :
      // largement au-dessus de ce qu'un plafond « à vue de nez » aurait
      // laissé passer, et pourtant plus rien ne tronque.
      const resultFull = drain(pairBuckets(prepared, bucketsA, bucketsB));
      ok(!resultFull.truncated, 'borne exacte : un appel nu à `pairBuckets` épuise tout l’espace, sans troncature');
      ok(resultFull.explored > 40_000, `borne exacte : l’espace parcouru est bien celui du pool complet (${resultFull.explored} paires, 6³×6³ = 46 656 au maximum structurel)`);

      // `totalPairCount` : sur CE pool précis (aucun set ni minimum demandé,
      // donc `pairFeasibleMin`/`comboAOk` n'élaguent RIEN de plus que
      // `satisfiesSets`/le joker) l'espace annoncé est trivialement EXACT.
      // ⚠️ L'égalité vaut en RÉALITÉ dans tous les cas, minimums compris —
      // vérifiée là-dessus par `rune-optim-differential.test.ts` sur des
      // scénarios aléatoires contraints. C'est d'elle que dépend l'absence de
      // tout plafond de paires (piste 8) : ici on la vérifie sur un espace
      // dont on connaît la taille théorique à la main.
      const total = totalPairCount(prepared, bucketsA, bucketsB);
      egal(total, resultFull.explored, "totalPairCount : l'espace annoncé correspond EXACTEMENT au nombre de paires réellement explorées par une recherche exhaustive");
    }
  }

  titre('Optimiseur — l’ordre des candidats n’est PAS celui de l’objectif');

  // ⚠️ **Incident.** `SearchResult.candidates` sort dans l'ordre de collecte
  // de l'appariement, jamais classé par ce qu'on a demandé de maximiser. Un
  // diagnostic a conclu « le moteur manque un build meilleur et faisable » en
  // lisant `candidates[0]` — le build cherché était là, au RANG 6. Et le vrai
  // CLI affichait `slice(0, 20)` en présentant ces 20 comme des résultats.
  //
  // `sortCandidates` est désormais la SEULE porte, partagée par l'écran et
  // les scripts. Ce test verrouille son contrat.
  {
    const st = (spd: number, hp: number): StatRow[] => [
      { key: 'spd', label: 'VIT', base: 0, bonus: spd, total: spd, suffix: '' },
      { key: 'hp', label: 'PV', base: 0, bonus: hp, total: hp, suffix: '' },
      { key: 'def', label: 'DEF', base: 0, bonus: 0, total: 0, suffix: '' },
    ];
    // Volontairement dans le DÉSORDRE : c'est l'état réel d'une sortie moteur.
    const bruts = [
      { runeIds: [1], stats: st(100, 5000), effTotal: 0 },
      { runeIds: [2], stats: st(250, 1000), effTotal: 0 },
      { runeIds: [3], stats: st(180, 9000), effTotal: 0 },
    ] as unknown as Parameters<typeof sortCandidates>[0];

    const parVitesse = sortCandidates(bruts, 'vitesse');
    egal(
      parVitesse.map((c) => c.runeIds[0]),
      [2, 3, 1],
      'trié par « Vitesse » : le plus rapide d’abord, quel que soit l’ordre d’entrée'
    );
    // ⚠️ Le premier candidat BRUT n'est pas le meilleur — c'est tout le sujet.
    ok(bruts[0]!.runeIds[0] !== parVitesse[0]!.runeIds[0], 'candidates[0] n’est PAS le meilleur : il faut trier');

    // ⚠️ Ne mute pas l'entrée : un tri en place rendrait l'ordre dépendant de
    // qui a affiché en premier.
    egal(bruts.map((c) => c.runeIds[0]), [1, 2, 3], 'le tableau d’origine n’est jamais réordonné');

    // Un tri par stat brute passe par le même point d'entrée.
    egal(
      sortCandidates(bruts, 'hp').map((c) => c.runeIds[0]),
      [3, 1, 2],
      'trié par une STAT : même porte, même contrat'
    );

    // ⚠️ « Dégâts réels » sans contexte : on laisse l'ordre en place plutôt
    // que de lever — un `sortBy` hérité d'un monstre précédent peut porter
    // cet objectif alors que le monstre courant n'a aucun sort calculable.
    egal(
      sortCandidates(bruts, 'degats_reels').map((c) => c.runeIds[0]),
      [1, 2, 3],
      '« Dégâts réels » sans contexte : ordre inchangé, jamais une exception'
    );
    // Idem pour « Efficience » sans les runes ni la mesure.
    egal(
      sortCandidates(bruts, 'efficience').map((c) => c.runeIds[0]),
      [1, 2, 3],
      '« Efficience » sans runeById/metric : ordre inchangé'
    );
  }

  titre('sortCandidates — le score PRÉ-CALCULÉ donne le même ordre que le comparateur');

  // ⚠️ **Ce que ce test protège.** `sortCandidates` calculait le score DANS le
  // comparateur, donc ~2 n log n fois — pour « Dégâts réels », autant d'appels
  // à `computeTotalDamage` : ~3,4 millions pour 100 000 candidats, mesurés à
  // 1 084 ms par tri sur le FIL PRINCIPAL. Il le calcule désormais UNE fois par
  // candidat, puis trie sur des nombres.
  //
  // ⚠️ C'est censé être EXACTEMENT équivalent, parce que le score est une
  // fonction PURE des stats du candidat. Ce test le vérifie contre une
  // référence naïve — la forme d'avant — au lieu de s'en remettre à
  // l'argument. Vérifié en plus par différentiel sur 5 monstres réels ×
  // 100 000 candidats (Sonia/VIT, Shahat/PV propres, Momo et Trevor/bonus
  // accumulable) : ordre strictement identique.
  {
    const st = (spd: number, hp: number, def: number): StatRow[] => [
      { key: 'spd', label: 'VIT', base: 0, bonus: spd, total: spd, suffix: '' },
      { key: 'hp', label: 'PV', base: 0, bonus: hp, total: hp, suffix: '' },
      { key: 'def', label: 'DEF', base: 0, bonus: def, total: def, suffix: '' },
    ];
    // ⚠️ Des ÉGALITÉS volontaires (deux candidats à 180 de VIT) : c'est là que
    // la stabilité du tri se joue, et une régression y serait invisible sur un
    // jeu à valeurs toutes distinctes.
    const lot = [
      { runeIds: [1], stats: st(180, 5000, 700), effTotal: 0 },
      { runeIds: [2], stats: st(250, 1000, 300), effTotal: 0 },
      { runeIds: [3], stats: st(180, 9000, 500), effTotal: 0 },
      { runeIds: [4], stats: st(120, 9000, 900), effTotal: 0 },
      { runeIds: [5], stats: st(250, 4000, 100), effTotal: 0 },
    ] as unknown as Parameters<typeof sortCandidates>[0];

    // La RÉFÉRENCE : la forme d'avant, score recalculé à chaque comparaison.
    const referenceNaive = (cs: typeof lot, cle: 'spd' | 'hp' | 'def') =>
      cs.slice().sort((a, b) => statTotal(b.stats, cle) - statTotal(a.stats, cle));

    for (const cle of ['spd', 'hp', 'def'] as const) {
      egal(
        sortCandidates(lot, cle).map((c) => c.runeIds[0]),
        referenceNaive(lot, cle).map((c) => c.runeIds[0]),
        `tri par ${cle} : le pré-calcul rend le MÊME ordre que le comparateur naïf, ex æquo compris`
      );
    }

    // ⚠️ La STABILITÉ explicitement : à VIT égale, l'ordre d'entrée tient.
    // Sans elle, deux builds équivalents changeraient de rang d'un rendu à
    // l'autre, sans que rien n'ait bougé à l'écran.
    egal(
      sortCandidates(lot, 'spd').map((c) => c.runeIds[0]),
      [2, 5, 1, 3, 4],
      'à score ÉGAL, l’ordre d’entrée est préservé (tri stable)'
    );

    // Et l'entrée reste intacte, comme pour les autres branches.
    egal(lot.map((c) => c.runeIds[0]), [1, 2, 3, 4, 5], 'le pré-calcul ne mute pas davantage l’entrée');
  }
}
