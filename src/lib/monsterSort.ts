// Tri de la liste de monstres du compte — calcul pur, testable sans rendu.
//
// Deux lectures d'une même box, et elles servent à des choses différentes :
//
//   - **alphabétique** : on cherche UN monstre dont on connaît le nom ;
//   - **ordre du jeu** : on parcourt sa collection comme le jeu la présente,
//     les 2A d'abord puis les familles par ordre de sortie. C'est celle qu'on
//     a en tête quand on se demande « qu'est-ce qu'il me manque ».

import { ElementKey, Monster } from '../types';

export type MonsterSortMode = 'jeu' | 'alpha';

// L'ordre des éléments du jeu, repris tel quel (Eau → Feu → Vent → Lumière →
// Ténèbres). ⚠️ Ce n'est pas l'ordre alphabétique ni celui des données : c'est
// celui des onglets de la collection, que le joueur connaît par cœur.
const RANG_ELEMENT: Record<ElementKey, number> = {
  water: 0,
  fire: 1,
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

// Comparateur pour un mode donné.
//
// ⚠️ Les deux modes départagent par NOM en dernier recours : sans ça, deux
// monstres de même rang s'échangeraient d'un rendu à l'autre, et la liste
// paraîtrait bouger toute seule.
export function comparateurMonstres(
  mode: MonsterSortMode
): (a: Monster, b: Monster) => number {
  const parNom = (a: Monster, b: Monster) => a.name.localeCompare(b.name, 'fr');

  if (mode === 'alpha') {
    // ⚠️ Le NOM D'ABORD, sans regrouper par élément : c'est tout l'intérêt de ce
    // mode — on cherche « Chloé » sans savoir de quel élément elle est. Grouper
    // par élément obligerait à parcourir cinq blocs.
    return parNom;
  }

  // Ordre du jeu : les 2A en tête, puis par famille (ordre de sortie), puis par
  // élément dans la famille.
  return (a, b) => {
    const a2 = estSecondEveil(a);
    const b2 = estSecondEveil(b);
    if (a2 !== b2) return a2 ? -1 : 1;

    const fa = a.com2usId != null ? familleDe(a.com2usId) : Infinity;
    const fb = b.com2usId != null ? familleDe(b.com2usId) : Infinity;
    if (fa !== fb) return fa - fb;

    // Même famille : l'ordre des éléments du jeu.
    const ea = RANG_ELEMENT[a.element] ?? 9;
    const eb = RANG_ELEMENT[b.element] ?? 9;
    if (ea !== eb) return ea - eb;

    return parNom(a, b);
  };
}
