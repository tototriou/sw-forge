// Tri de la liste de monstres du compte — calcul pur, testable sans rendu.
//
// ⚠️ **L'ÉLÉMENT groupe toujours**, quel que soit le mode : Feu → Eau → Vent →
// Lumière → Ténèbres, l'ordre du jeu. Le mode ne décide que de ce qui se passe
// **à l'intérieur** d'un élément :
//
//   - **date de sortie** : par catégorie (**2A → nat5 → nat4 → nat3…**), et dans
//     chacune les **derniers sortis en premier**. C'est la lecture qu'on a en
//     tête devant sa collection — « qu'est-ce qu'il me manque » ;
//   - **alphabétique** : par nom, pour retrouver un monstre précis.

import { ElementKey, Monster } from '../types';

export type MonsterSortMode = 'jeu' | 'alpha';

// L'ordre des éléments du jeu : **Feu → Eau → Vent → Lumière → Ténèbres**.
//
// ⚠️ Ce n'est ni l'ordre alphabétique, ni celui des données, ni celui des codes
// com2us — c'est celui des onglets de la collection, que le joueur connaît par
// cœur. Le changer déroute plus qu'un tri absent.
const RANG_ELEMENT: Record<ElementKey, number> = {
  fire: 0,
  water: 1,
  wind: 2,
  light: 3,
  dark: 4,
  unknown: 5,
};

// Le `com2usId` encode la FAMILLE et la variante :
//
//     12302  =  famille 123  ·  suffixe 02
//
// Le suffixe dit l'élément et le niveau d'éveil — 1..5 non éveillé, 11..15
// éveillé, 31..35 second éveil. La famille, elle, **croît avec l'ordre de
// sortie** : c'est ce qui donne l'ordre du jeu sans avoir de date nulle part.
export const familleDe = (com2usId: number) => Math.floor(com2usId / 100);
export const suffixeDe = (com2usId: number) => com2usId % 100;

// ⚠️ Les 2A se reconnaissent au suffixe 31..35, pas au champ `secondAwaken`
// seul : celui-ci vient des données SWARFARM et peut manquer sur une entrée
// incomplète, alors que le suffixe est porté par l'identifiant lui-même.
// On accepte les deux — l'un rattrape l'autre.
export function estSecondEveil(m: Monster): boolean {
  if (m.secondAwaken) return true;
  if (m.com2usId == null) return false;
  const s = suffixeDe(m.com2usId);
  return s >= 31 && s <= 35;
}

// Rang de la CATÉGORIE dans laquelle le jeu range un monstre, à l'intérieur de
// son élément : **2A, puis nat5, nat4, nat3…**
//
// ⚠️ Un 2A sort de sa rareté naturelle : il passe devant TOUS les autres, y
// compris les nat5. C'est le classement de la collection en jeu — et c'est aussi
// ce qu'on veut voir en premier, un 2A étant l'aboutissement d'un monstre.
//
// ⚠️ Rareté DÉCROISSANTE (5 avant 3), d'où la soustraction : les nat5 sont ce
// qu'on cherche en premier dans une box.
function rangCategorie(m: Monster): number {
  if (estSecondEveil(m)) return 0;
  // `naturalStars` absent (donnée incomplète) → derrière les raretés connues,
  // plutôt qu'assimilé à un nat0 qui le mettrait en tête.
  const nat = m.naturalStars ?? 0;
  return 10 - nat;
}

// Comparateur pour un mode donné.
//
// ⚠️ Les deux modes départagent par NOM en dernier recours : sans ça, deux
// monstres de même rang s'échangeraient d'un rendu à l'autre, et la liste
// paraîtrait bouger toute seule.
// ⚠️ **L'ÉLÉMENT PASSE EN PREMIER, dans les deux modes.** C'est le regroupement
// que le jeu impose partout : on lit sa collection élément par élément, et une
// liste qui les mêle oblige à balayer tout l'écran pour rassembler ses monstres
// d'un même élément. Le mode ne change donc que ce qui se passe **à l'intérieur**
// d'un élément.
export function comparateurMonstres(
  mode: MonsterSortMode
): (a: Monster, b: Monster) => number {
  const parNom = (a: Monster, b: Monster) => a.name.localeCompare(b.name, 'fr');

  const parElement = (a: Monster, b: Monster) =>
    (RANG_ELEMENT[a.element] ?? 9) - (RANG_ELEMENT[b.element] ?? 9);

  if (mode === 'alpha') {
    return (a, b) => parElement(a, b) || parNom(a, b);
  }

  // Ordre du jeu, DANS chaque élément : par catégorie (2A, puis nat5, nat4,
  // nat3…), et dans chaque catégorie par date de sortie.
  return (a, b) => {
    const e = parElement(a, b);
    if (e) return e;

    const c = rangCategorie(a) - rangCategorie(b);
    if (c) return c;

    // Même catégorie : les DERNIERS SORTIS en premier.
    //
    // ⚠️ Famille DÉCROISSANTE (`fb - fa`) : c'est ce qu'on veut voir en haut —
    // les nouveautés, celles dont on ne sait pas encore si on les a. Les
    // anciennes, on les connaît par cœur.
    // ⚠️ Un monstre sans `com2usId` (perso) vaut `-Infinity` et non `+Infinity` :
    // en ordre décroissant, c'est ce qui le laisse en FIN de liste.
    const fa = a.com2usId != null ? familleDe(a.com2usId) : -Infinity;
    const fb = b.com2usId != null ? familleDe(b.com2usId) : -Infinity;
    if (fa !== fb) return fb - fa;

    return parNom(a, b);
  };
}
