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
}
