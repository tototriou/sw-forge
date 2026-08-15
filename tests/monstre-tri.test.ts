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

  /* --- ordre du jeu : 2A d'abord ----------------------------------------- */

  egal(
    trie('jeu', [
      mon({ name: 'Vieux', com2usId: 10111 }),
      mon({ name: 'Recent2A', com2usId: 99931, secondAwaken: true }),
    ]),
    ['Recent2A', 'Vieux'],
    'les 2A passent devant, même si leur famille est plus récente'
  );

  /* --- puis par famille (ordre de sortie) -------------------------------- */

  egal(
    trie('jeu', [
      mon({ name: 'Tardif', com2usId: 50011 }),
      mon({ name: 'Premier', com2usId: 10111 }),
      mon({ name: 'Milieu', com2usId: 30011 }),
    ]),
    ['Premier', 'Milieu', 'Tardif'],
    'à éveil égal, la famille croît avec l’ordre de sortie'
  );

  /* --- puis par élément DANS la famille ---------------------------------- */

  egal(
    trie('jeu', [
      mon({ name: 'Sombre', com2usId: 10115, element: 'dark' }),
      mon({ name: 'Eau', com2usId: 10111, element: 'water' }),
      mon({ name: 'Feu', com2usId: 10112, element: 'fire' }),
    ]),
    ['Eau', 'Feu', 'Sombre'],
    'même famille → l’ordre des éléments du jeu (Eau, Feu, Vent, Lumière, Ténèbres)'
  );

  /* --- alphabétique : le nom, sans regrouper par élément ------------------ */

  egal(
    trie('alpha', [
      mon({ name: 'Zaiross', element: 'fire' }),
      mon({ name: 'Ariel', element: 'light' }),
      mon({ name: 'Chloe', element: 'water' }),
    ]),
    ['Ariel', 'Chloe', 'Zaiross'],
    'A → Z ignore l’élément : on cherche un nom, pas une catégorie'
  );

  egal(
    trie('alpha', [mon({ name: 'Élucia' }), mon({ name: 'Eladriel' })]),
    ['Eladriel', 'Élucia'],
    'les accents suivent l’ordre français (É se range comme E)'
  );

  /* --- un monstre sans com2usId ne casse pas le tri ---------------------- */

  egal(
    trie('jeu', [mon({ name: 'Perso' }), mon({ name: 'Connu', com2usId: 10111 })]),
    ['Connu', 'Perso'],
    'un monstre perso (sans com2usId) passe en fin de liste, sans faire échouer le tri'
  );
}
