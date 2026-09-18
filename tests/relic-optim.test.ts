// Module pur `relicOptim.ts` (implementation-relique, lot 3) — les sept
// contrôles du plan § 8.2, plus les compléments D1/rév. 3/rév. 6, plus la
// dominance § 6 de reliques.md et son symétrique.

import { RelicDetail } from '../src/types';
import {
  RelicDimensions,
  bestRelicForBuild,
  dimensionsRetenues,
  eligibleRelics,
  relicDominates,
  relicPctMaxByStat,
  relicPctMinByStat,
  resoudreContexteRelique,
} from '../src/lib/relicOptim';
import { egal, ok, titre } from './outils';

function main(code: number, value: number) {
  return { code, value };
}

// PV%=100, ATQ%=101, DEF%=102 (`RELIC_MAIN`, effects.ts).
function relic(id: number, code: number, value: number, unique?: { type: number; tranche: number; percent?: number }, upgrade = 6): RelicDetail {
  return { id, upgrade, main: main(code, value), ...(unique ? { unique } : {}) };
}

export default function testRelicOptim() {
  titre('Optimizer · module relique (relicOptim.ts)');

  /* ------------------------------------------------------------------
   * Les sept contrôles du plan § 8.2
   * ---------------------------------------------------------------- */
  {
    // Une meilleure ATQ n'est jamais aussi une meilleure PV — bornes
    // indépendantes par statistique.
    const pool = [relic(1, 101, 14), relic(2, 100, 9)];
    egal(relicPctMaxByStat(pool), { hp: 9, atk: 14, def: 0 }, 'les bornes par statistique sont indépendantes');
  }
  {
    // +9 élimine +8 (Régénération, jamais pertinente) mais pas +15 : en
    // « Dégâts réels » scalant sur l'ATQ, Conquête (type 1) ET Bravoure·ATQ
    // (type 7, buffe l'ATQ) sont TOUTES DEUX pertinentes mais DE TYPES
    // DIFFÉRENTS — aucune ne domine l'autre (D6) ; +8 porte Régénération
    // (type 16, jamais pertinente) et se fait dominer par les deux.
    const dims = dimensionsRetenues('degats_reels', ['atk'], {});
    const r8 = relic(1, 101, 8, { type: 16, tranche: 27000, percent: 1 }); // Régénération
    const r9 = relic(2, 101, 9, { type: 1, tranche: 1000, percent: 1 }); // Conquête·ATQ
    const r15 = relic(3, 101, 15, { type: 7, tranche: 1000, percent: 1 }); // Bravoure·VIT (buffe l'ATQ)
    ok(relicDominates(r9, r8, dims), '+9 domine +8 (exclusive de +8 non pertinente ici)');
    ok(relicDominates(r15, r8, dims), '+15 domine +8');
    ok(!relicDominates(r9, r15, dims), '+9 ne domine pas +15 (deux exclusives pertinentes de types différents)');
    ok(!relicDominates(r15, r9, dims), '+15 ne domine pas +9 non plus : les deux survivent');
  }
  {
    // +15 acceptée sans qu'aucune pièce +15 n'existe déjà — la borne
    // n'exige pas de précédent, elle lit l'inventaire tel qu'il est.
    const pool = [relic(1, 100, 15)];
    egal(relicPctMaxByStat(pool), { hp: 15, atk: 0, def: 0 }, 'une +15 solitaire est acceptée telle quelle');
  }
  {
    // `libre` → les trois maxima simultanément (bornes permissives).
    const pool = [relic(1, 100, 9), relic(2, 101, 14), relic(3, 102, 6)];
    egal(relicPctMaxByStat(pool), { hp: 9, atk: 14, def: 6 }, "'libre' accorde les trois maxima à la fois");
  }
  {
    // Principale forcée → une seule statistique alimentée.
    const pool = [relic(1, 100, 9), relic(2, 101, 14)];
    egal(relicPctMinByStat(pool, 101), { hp: 0, atk: 14, def: 0 }, 'principale forcée (une seule éligible) → une seule statistique');
    const pool2 = [relic(1, 101, 9), relic(2, 101, 14)];
    egal(relicPctMinByStat(pool2, 101), { hp: 0, atk: 9, def: 0 }, 'principale forcée → le MINIMUM éligible sur cette statistique');
  }
  {
    // `equipped` : l'inventaire n'est jamais lu — la fonction dédiée à la
    // recherche (`eligibleRelics`) n'entre pas en jeu, `resoudreContexteRelique`
    // construit le pool directement depuis la pièce portée.
    const equipee = relic(9, 100, 11);
    const ctx = resoudreContexteRelique({ mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, equipee, []);
    egal(ctx.eligibles, [equipee], "mode 'equipped' : pool = la pièce portée, inventaire (vide ici) ignoré");
    egal(ctx.vide, undefined, "mode 'equipped' avec une pièce portée : pas de vide");
  }
  {
    // Indépendance du `unit_id` : la fonction ne prend jamais l'exemplaire en
    // paramètre — deux appels avec la même pièce équipée mais des inventaires
    // différents donnent le même résultat pour cette pièce.
    const equipee = relic(9, 100, 11);
    const ctxA = resoudreContexteRelique({ mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, equipee, [relic(1, 101, 5)]);
    const ctxB = resoudreContexteRelique({ mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, equipee, []);
    egal(ctxA.eligibles, ctxB.eligibles, "le résultat 'equipped' ne dépend que de la pièce portée, jamais de l'inventaire d'un autre exemplaire");
  }

  /* ------------------------------------------------------------------
   * Trois de D1 : type forcé, intersection, vide nommé
   * ---------------------------------------------------------------- */
  {
    const inventaire = [
      relic(1, 100, 9, { type: 1, tranche: 1000, percent: 1 }),
      relic(2, 100, 14, { type: 2, tranche: 1000, percent: 1 }),
    ];
    const { relics } = eligibleRelics(inventaire, 'libre', 1, 0);
    egal(relics.map((r) => r.id), [1], 'un type forcé réduit le pool à ce type');
    egal(relicPctMaxByStat(relics), { hp: 9, atk: 0, def: 0 }, 'les bornes se recalculent sur le pool RÉDUIT, jamais sur tout l’inventaire');
  }
  {
    // Principale ET type → intersection, pas union.
    const inventaire = [
      relic(1, 100, 9, { type: 1, tranche: 1000, percent: 1 }), // PV, type 1
      relic(2, 101, 9, { type: 1, tranche: 1000, percent: 1 }), // ATQ, type 1
      relic(3, 100, 9, { type: 2, tranche: 1000, percent: 1 }), // PV, type 2
    ];
    const { relics } = eligibleRelics(inventaire, 100, 1, 0);
    egal(relics.map((r) => r.id), [1], 'principale ET type = intersection (ni union de PV, ni union de type 1)');
  }
  {
    // Filtres qui vident le pool → `vide` nommé, un test par raison.
    egal(eligibleRelics([], 'libre', 'libre', 0).vide, 'inventaire', 'inventaire vide → vide = "inventaire"');
    egal(eligibleRelics([relic(1, 100, 9)], 101, 'libre', 0).vide, 'principale', 'aucune éligible sur la principale forcée → vide = "principale"');
    egal(eligibleRelics([relic(1, 100, 9, { type: 1, tranche: 1000, percent: 1 })], 'libre', 2, 0).vide, 'type', 'aucune éligible sur le type forcé → vide = "type"');
    egal(eligibleRelics([relic(1, 100, 9, undefined, 3)], 'libre', 'libre', 6).vide, 'seuil', 'aucune éligible au-dessus du seuil → vide = "seuil"');
    const ctxEquipee = resoudreContexteRelique({ mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, undefined, []);
    egal(ctxEquipee.vide, 'equipee', "mode 'equipped' sans relique portée → vide = 'equipee'");
    egal(ctxEquipee.bornes, { max: { hp: 0, atk: 0, def: 0 }, min: { hp: 0, atk: 0, def: 0 } }, 'pool vide → bornes nulles');
  }

  /* ------------------------------------------------------------------
   * Trois de la rév. 6 : borne infaisable, régime aucun, aucune écartée
   * ---------------------------------------------------------------- */
  {
    // +14 mieux notée mais rendrait le build infaisable (au-dessus d'un
    // maximum), +12 sous le maximum et faisable → +12 retenue, le build
    // survit (l'ancien contrat « meilleure, puis filtre » l'aurait perdu).
    const plus14 = relic(1, 100, 14);
    const plus12 = relic(2, 100, 12);
    const evaluate = (r: RelicDetail) => (r.id === 1 ? ('infaisable' as const) : 5);
    const res = bestRelicForBuild([plus14, plus12], evaluate);
    egal(res?.relique.id, 2, '+14 infaisable / +12 faisable → +12 retenue, le build est conservé');
  }
  {
    // Régime `aucun` : score constant, l'équipée gagne si faisable pour ce build.
    const equipee = relic(2, 100, 9);
    const autre = relic(1, 100, 14);
    const evaluateConstant = () => 0;
    const res = bestRelicForBuild([autre, equipee], evaluateConstant, { regimeAucun: true, equipee });
    egal(res, { relique: equipee, sansEffetSurLeTri: true }, "régime 'aucun' : l'équipée gagne si elle est candidate et faisable");

    // Équipée infaisable pour CE build → première candidate faisable par id.
    const evaluateEquipeeInfaisable = (r: RelicDetail) => (r.id === equipee.id ? ('infaisable' as const) : 0);
    const res2 = bestRelicForBuild([autre, equipee], evaluateEquipeeInfaisable, { regimeAucun: true, equipee });
    egal(res2, { relique: autre, sansEffetSurLeTri: true }, "régime 'aucun', équipée infaisable pour ce build → première faisable par id croissant");
  }
  {
    // Aucune dimension (Efficience sans minimum actif) → rien n'est écarté :
    // deux reliques, l'une strictement moins bonne sur toutes les valeurs
    // « brutes », ne se dominent pas puisqu'aucune dimension n'existe.
    const dims = dimensionsRetenues('efficience', [], {});
    egal(dims.principaleStats.size, 0, "'efficience' sans minimum actif : aucune statistique de principale retenue");
    egal(dims.exclusiveTypesPertinents.size, 0, "'efficience' : aucune exclusive retenue (T3)");
    const petite = relic(1, 100, 9, { type: 16, tranche: 27000, percent: 1 });
    const grande = relic(2, 100, 14, { type: 16, tranche: 27000, percent: 1 });
    ok(!relicDominates(grande, petite, dims), 'aucune dimension → aucune relique écartée, même strictement moins bonne en apparence');
  }

  /* ------------------------------------------------------------------
   * Quatre de la rév. 3 : minimum hors objectif, Vitesse, exclusives
   * incompatibles, scorePartiel PAR RÉGIME
   * ---------------------------------------------------------------- */
  {
    // Objectif dégâts sur l'ATQ, minimum DEF actif → la DEF % est pertinente ;
    // sans ce minimum, elle ne l'est pas.
    const avecMinimum = dimensionsRetenues('degats_reels', ['atk'], { def: 1600 });
    ok(avecMinimum.principaleStats.has('def'), 'minimum DEF actif → DEF % pertinente même hors du scaling');
    const sansMinimum = dimensionsRetenues('degats_reels', ['atk'], {});
    ok(!sansMinimum.principaleStats.has('def'), 'sans minimum actif sur DEF, elle n’est pas pertinente en Dégâts réels (ATQ)');
  }
  {
    // Vitesse → aucune dimension d'objectif ; les minimums actifs restent la
    // seule source de pertinence de principale.
    const dims = dimensionsRetenues('vitesse', [], { hp: 20000 });
    egal([...dims.principaleStats], ['hp'], "'vitesse' : seule la statistique sous minimum actif est retenue");
    egal(dims.exclusiveTypesPertinents.size, 0, "'vitesse' : aucune exclusive, jamais (T7)");
  }
  {
    // Deux exclusives pertinentes de types différents → aucune dominance,
    // dans aucun des deux sens (Éternité·PV = type 12, Origine·VIT = type 14,
    // toutes deux pertinentes en PV effectifs — reliques.md § 6).
    const dims = dimensionsRetenues('ehp', [], {});
    const eternitePv = relic(1, 100, 12, { type: 12, tranche: 500, percent: 5 });
    const origineVit = relic(2, 100, 12, { type: 14, tranche: 500, percent: 5 });
    ok(dims.exclusiveTypesPertinents.has(12) && dims.exclusiveTypesPertinents.has(14), 'les deux types sont bien pertinents en PV effectifs');
    ok(!relicDominates(eternitePv, origineVit, dims), 'Éternité·PV ne domine pas Origine·VIT');
    ok(!relicDominates(origineVit, eternitePv, dims), 'Origine·VIT ne domine pas Éternité·PV non plus');
  }
  {
    // `scorePartiel` PAR RÉGIME : faux en Vitesse et Efficience (aucune
    // exclusive n'y entre, dès ce lot), vrai en Dégâts réels et PV effectifs
    // dès qu'un type pertinent existe (aucun n'a de formule chiffrée avant B.7).
    egal(dimensionsRetenues('vitesse', [], { hp: 1 }).scorePartiel, false, "'vitesse' → scorePartiel faux");
    egal(dimensionsRetenues('efficience', [], { hp: 1 }).scorePartiel, false, "'efficience' → scorePartiel faux");
    egal(dimensionsRetenues('degats_reels', ['atk'], {}).scorePartiel, true, "'degats_reels' avec scaling ATQ → scorePartiel vrai (Conquête/Bravoure sans formule)");
    egal(dimensionsRetenues('ehp', [], {}).scorePartiel, true, "'ehp' → scorePartiel vrai (Ténacité/Éternité/Origine sans formule)");
  }

  /* ------------------------------------------------------------------
   * Le test de dominance § 6 (reliques.md) et son symétrique
   * ---------------------------------------------------------------- */
  {
    // Exemple donné par l'utilisateur, en PV effectifs : principales
    // identiques ; l'exclusive de la 1 (dégâts infligés selon la VIT — ici
    // Conquête·ATQ, type 1, comme représentant d'un type « dégâts infligés »
    // non pertinent en PV effectifs) n'entre dans aucun axe de l'objectif ;
    // celle de la 2 (Éternité·PV, type 12 → DEF+, pertinente) si.
    const dims = dimensionsRetenues('ehp', [], {});
    const relique1 = relic(1, 100, 12, { type: 1, tranche: 1000, percent: 1 }); // Conquête — non pertinente en ehp
    const relique2 = relic(2, 100, 12, { type: 12, tranche: 500, percent: 5 }); // Éternité·PV — pertinente en ehp
    ok(relicDominates(relique2, relique1, dims), 'relique 2 (Éternité·PV, pertinente) domine relique 1 (Conquête, non pertinente), principales égales');
    ok(!relicDominates(relique1, relique2, dims), 'relique 1 ne domine jamais relique 2 (elle n’est pas pertinente, la 2 l’est)');
  }

  /* ------------------------------------------------------------------
   * Garanties structurelles supplémentaires : max actif, type inconnu
   * ---------------------------------------------------------------- */
  {
    // Un maximum actif sur la statistique de la principale interdit toute
    // dominance dessus, dans les deux sens (contre-exemple B1).
    const dims: RelicDimensions = dimensionsRetenues('ehp', [], {});
    dims.maxActifs.add('hp');
    dims.principaleStats.add('hp');
    const plus14 = relic(1, 100, 14, { type: 16, tranche: 27000, percent: 1 });
    const plus12 = relic(2, 100, 12, { type: 16, tranche: 27000, percent: 1 });
    ok(!relicDominates(plus14, plus12, dims), 'maximum actif sur PV → +14 ne domine pas +12 (B1)');
    ok(!relicDominates(plus12, plus14, dims), 'et réciproquement');
  }
  {
    // Un `type` inconnu d'un côté → aucune dominance.
    const dims = dimensionsRetenues('ehp', [], {});
    const connu = relic(1, 100, 12, { type: 12, tranche: 500, percent: 5 });
    const sansUnique = relic(2, 100, 9);
    ok(!relicDominates(connu, sansUnique, dims), 'type inconnu (absent) d’un côté → aucune dominance');
    ok(!relicDominates(sansUnique, connu, dims), 'et réciproquement');
  }
  {
    // Statistiques de principale différentes → jamais de dominance, quelle
    // que soit la valeur (on ne compare jamais PV % à ATQ %).
    const dims = dimensionsRetenues('ehp', [], {});
    const pv = relic(1, 100, 20, { type: 12, tranche: 500, percent: 5 });
    const atk = relic(2, 101, 1, { type: 12, tranche: 500, percent: 5 });
    ok(!relicDominates(pv, atk, dims), 'statistiques de principale différentes → aucune dominance');
  }
}
