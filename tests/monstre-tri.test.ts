// Tri de la box — les deux lectures d'une même collection.
//
// L'ordre du jeu repose sur une lecture du `com2usId` (famille × 100 + suffixe)
// qui n'est écrite nulle part dans les données : c'est une régularité observée
// sur l'export réel. Ces vérifications la figent — si elle se révélait fausse,
// c'est ici qu'on le verrait, et non sur une liste de 300 monstres à l'œil.

import { Monster } from '../src/types';
import {
  comparateurMonstres,
  estSecondEveil,
  familleDe,
  suffixeDe,
} from '../src/lib/monsterSort';
import { egal, titre } from './outils';

function mon(p: Partial<Monster> & { name: string }): Monster {
  return {
    id: p.name,
    com2usId: null,
    element: 'water',
    secondAwaken: false,
    naturalStars: 4,
    stats: {},
    ...p,
  } as Monster;
}

const trie = (mode: 'jeu' | 'alpha', ms: Monster[]) =>
  [...ms].sort(comparateurMonstres(mode)).map((m) => m.name);

export default function testMonstreTri() {
  titre('Box · tri des monstres');

  /* --- décomposition du com2usId ---------------------------------------- */

  egal(familleDe(12302), 123, 'la famille est le com2usId sans ses deux derniers chiffres');
  egal(suffixeDe(12302), 2, 'le suffixe dit l’élément et l’éveil');
  egal(suffixeDe(10131), 31, 'un 2A porte un suffixe 31..35');

  /* --- reconnaissance du second éveil ------------------------------------ */

  egal(estSecondEveil(mon({ name: 'A', secondAwaken: true })), true, 'le champ secondAwaken suffit');
  egal(
    estSecondEveil(mon({ name: 'B', com2usId: 10131 })),
    true,
    'le suffixe 31 suffit, même sans le champ — il rattrape une donnée incomplète'
  );
  egal(
    estSecondEveil(mon({ name: 'C', com2usId: 10111 })),
    false,
    'un monstre simplement éveillé (suffixe 11) n’est pas un 2A'
  );

  /* --- l'ÉLÉMENT groupe, dans les DEUX modes ----------------------------- */

  // Ordre du jeu : Feu → Eau → Vent → Lumière → Ténèbres.
  const cinq = [
    mon({ name: 'Tenebres', element: 'dark' }),
    mon({ name: 'Lumiere', element: 'light' }),
    mon({ name: 'Vent', element: 'wind' }),
    mon({ name: 'Eau', element: 'water' }),
    mon({ name: 'Feu', element: 'fire' }),
  ];
  const attendu = ['Feu', 'Eau', 'Vent', 'Lumiere', 'Tenebres'];

  egal(trie('jeu', cinq), attendu, 'tri par sortie : les éléments dans l’ordre du jeu');
  egal(trie('alpha', cinq), attendu, 'tri A → Z : le MÊME regroupement par élément');

  /* --- dans un élément : 2A → nat5 → nat4 → nat3 ------------------------- */

  egal(
    trie('jeu', [
      mon({ name: 'Nat3', naturalStars: 3, com2usId: 10011 }),
      mon({ name: 'Nat5', naturalStars: 5, com2usId: 10011 }),
      mon({ name: 'Deux A', naturalStars: 4, com2usId: 10031, secondAwaken: true }),
      mon({ name: 'Nat4', naturalStars: 4, com2usId: 10011 }),
    ]),
    ['Deux A', 'Nat5', 'Nat4', 'Nat3'],
    'un 2A passe devant TOUS les autres, y compris les nat5 — puis rareté décroissante'
  );

  /* --- dans une catégorie : la date de sortie ---------------------------- */

  egal(
    trie('jeu', [
      mon({ name: 'Ancien', naturalStars: 5, com2usId: 10011 }),
      mon({ name: 'Recent', naturalStars: 5, com2usId: 50011 }),
      mon({ name: 'Milieu', naturalStars: 5, com2usId: 30011 }),
    ]),
    ['Recent', 'Milieu', 'Ancien'],
    'à catégorie égale, les DERNIERS SORTIS en premier'
  );

  // ⚠️ La rareté prime sur la date : un nat5 ancien reste devant un nat4 récent.
  egal(
    trie('jeu', [
      mon({ name: 'Nat4Recent', naturalStars: 4, com2usId: 90011 }),
      mon({ name: 'Nat5Ancien', naturalStars: 5, com2usId: 10011 }),
    ]),
    ['Nat5Ancien', 'Nat4Recent'],
    'la rareté prime sur la date : un nat5 ancien reste devant un nat4 récent'
  );

  /* --- alphabétique : par nom DANS l'élément ----------------------------- */

  egal(
    trie('alpha', [
      mon({ name: 'Zaiross', element: 'fire' }),
      mon({ name: 'Ariel', element: 'fire' }),
      mon({ name: 'Chloe', element: 'fire' }),
    ]),
    ['Ariel', 'Chloe', 'Zaiross'],
    'A → Z classe par nom à l’intérieur d’un élément'
  );

  egal(
    trie('alpha', [mon({ name: 'Élucia' }), mon({ name: 'Eladriel' })]),
    ['Eladriel', 'Élucia'],
    'les accents suivent l’ordre français (É se range comme E)'
  );

  /* --- données incomplètes : rien ne casse ------------------------------- */

  egal(
    trie('jeu', [
      mon({ name: 'Perso', naturalStars: null }),
      mon({ name: 'Connu', naturalStars: 5, com2usId: 10011 }),
    ]),
    ['Connu', 'Perso'],
    'une rareté inconnue passe derrière les raretés connues, sans faire échouer le tri'
  );
}
