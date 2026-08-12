// Moteur de recherche de builds (Outils · Optimizer) — un résultat annoncé
// comme valide mais faux pousserait à re-runer sur une base erronée : même
// catégorie « grave et invisible » que la vitesse de combat (voir README).

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import { excludedRuneIds, searchBuilds } from '../src/lib/runeBuildOptim';
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
}
