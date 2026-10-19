import type { GearSet } from '../../../types';

// Équipement NUL, affiché tant qu'aucun monstre n'est choisi — demande
// explicite de l'utilisateur : la fiche (stats, artéfacts, roue, relique)
// reste TOUJOURS visible, vide plutôt qu'absente, pour que choisir un
// monstre ne fasse jamais apparaître un bloc entier là où il n'y avait rien
// (voir docs/03-developpeur/interface/, « un clic ne déplace jamais ce qu'on vient de
// cliquer »). `MonsterGear` n'a besoin d'aucune adaptation : `computeStats`
// sur une base à zéro renvoie des lignes à zéro, `ArtifactSlots`/`RuneWheel`
// gèrent déjà nativement un tableau vide (voir leurs propres commentaires).
export const EMPTY_GEAR: GearSet = {
  base: { hp: 0, atk: 0, def: 0, spd: 0, cr: 0, cd: 0, res: 0, acc: 0 },
  runes: [],
  artifacts: [],
};
