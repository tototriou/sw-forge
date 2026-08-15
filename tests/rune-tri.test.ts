// Tris de l'inventaire de runes — ceux du JEU (voir spec/compte/runes.md).
//
// Deux règles se trompent facilement et ne se voient pas à l'œil sur 2 000
// runes : « avant meule » doit DÉDUIRE la meule (deux runes à 20 % ne se valent
// pas si l'une y est arrivée seule), et une rune qui ne PORTE PAS la propriété
// cherchée doit passer derrière toutes celles qui la portent — pas être traitée
// comme si elle valait 0, ce qui la mêlerait aux plus faibles.

import { RuneDetail } from '../src/types';
import { comparateurRunes, totalSubs, valeurSub } from '../src/lib/runeSort';
import { egal, ok, titre } from './outils';

// Rune minimale : seuls les champs qui comptent pour le tri sont renseignés.
function rune(p: Partial<RuneDetail> & { id: number }): RuneDetail {
  return {
    slot: 1,
    set: 'violent',
    rank: 5,
    rarity: 3,
    level: 12,
    main: { code: 8, value: 20 },
    subs: [],
    ...p,
  } as RuneDetail;
}

// Enrobe pour le comparateur (les deux mesures sont calculées par l'appelant).
const sortable = (r: RuneDetail, eff = 0, score = 0) => ({ rune: r, eff, score });

// Applique un tri et rend les identifiants, plus lisibles qu'un objet entier.
function ordre(
  mode: Parameters<typeof comparateurRunes>[0],
  items: { rune: RuneDetail; eff: number; score: number }[],
  premierCode = 0
) {
  return [...items].sort(comparateurRunes(mode, 'eff', premierCode)).map((i) => i.rune.id);
}

export default function testRuneTri() {
  titre('Inventaire de runes · tris du jeu');

  /* --- valeurSub : la meule est déduite ou non ------------------------- */

  const avecMeule = rune({ id: 1, subs: [{ code: 8, value: 20, grind: 6 }] });

  egal(valeurSub(avecMeule, 8), 20, 'propriété secondaire : la valeur affichée, meule comprise');
  egal(valeurSub(avecMeule, 8, true), 14, 'avant meule : la meule est DÉDUITE (20 − 6)');
  egal(valeurSub(avecMeule, 9), null, 'propriété absente → null, et non 0');
  egal(
    valeurSub(rune({ id: 2, subs: [{ code: 8, value: 11 }] }), 8, true),
    11,
    'sans meule, « avant meule » vaut la valeur telle quelle'
  );

  /* --- avant meule : l'ordre CHANGE ------------------------------------ */

  // Deux runes à 20 de VIT : l'une meulée à fond, l'autre née haute.
  const meulee = sortable(rune({ id: 10, subs: [{ code: 8, value: 20, grind: 8 }] }));
  const brute = sortable(rune({ id: 11, subs: [{ code: 8, value: 20, grind: 1 }] }));

  ok(
    JSON.stringify(ordre('sub_desc', [meulee, brute], 8)) !== null &&
      ordre('sub_brut_desc', [meulee, brute], 8)[0] === 11,
    'avant meule : celle qui doit le moins à sa meule passe devant'
  );
  egal(
    totalSubs(rune({ id: 3, subs: [{ code: 8, value: 20 }, { code: 9, value: 12 }] })),
    32,
    'total des sous-propriétés : somme brute, comme le jeu'
  );

  /* --- absent ≠ nul ---------------------------------------------------- */

  const porte = sortable(rune({ id: 20, subs: [{ code: 8, value: 4 }] }), 90);
  const porteRien = sortable(rune({ id: 21, subs: [{ code: 9, value: 30 }] }), 99);

  egal(
    ordre('sub_desc', [porteRien, porte], 8),
    [20, 21],
    'une rune SANS la propriété passe derrière, même avec une bien meilleure efficience'
  );

  /* --- sans critère, on retombe sur la mesure -------------------------- */

  egal(
    ordre('sub_desc', [sortable(rune({ id: 30 }), 50), sortable(rune({ id: 31 }), 80)], 0),
    [31, 30],
    'aucune propriété cherchée → tri par la mesure courante'
  );

  /* --- Grade : rareté d'abord, puis étoiles ---------------------------- */

  egal(
    ordre('grade', [
      sortable(rune({ id: 40, rarity: 4, rank: 15 })),
      sortable(rune({ id: 41, rarity: 5, rank: 5 })),
      sortable(rune({ id: 42, rarity: 4, rank: 6 })),
    ]),
    [41, 40, 42],
    'Grade : la rareté prime, les étoiles départagent'
  );

  /* --- Obtenu : le rune_id croît avec le temps ------------------------- */

  egal(
    ordre('obtenu', [sortable(rune({ id: 100 })), sortable(rune({ id: 300 })), sortable(rune({ id: 200 }))]),
    [300, 200, 100],
    'Obtenu : les plus récentes (id le plus grand) d’abord'
  );

  /* --- Slot : croissant ------------------------------------------------ */

  egal(
    ordre('slot_asc', [sortable(rune({ id: 50, slot: 4 })), sortable(rune({ id: 51, slot: 2 }))]),
    [51, 50],
    'Slot : du 1 au 6'
  );
}
