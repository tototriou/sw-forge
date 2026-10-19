import type { GearSet } from '../../../types';
import { CAPPED_STATS, type StatKey } from '../../../lib/effects';

// ⚠️ Le plafond de CAPPED_STATS (voir lib/effects.ts) ne s'applique QU'À la
// saisie d'une condition (minimum ou maximum) : la RECHERCHE, elle, ne doit
// surtout pas exclure un build dont la somme brute dépasse 100 % — c'est un
// résultat légitime, seule la demande d'un seuil > 100 % n'a pas de sens.
export const CAPPED_100 = CAPPED_STATS;

// « Stats de base exclues » n'affecte QUE ces 4 stats (PV/ATQ/DEF/VIT) : elles
// ont une base qui grandit avec le niveau/l'éveil et que les runes viennent
// gonfler en % ou en plat. Taux Crit/Dgts Crit/RES/Précision partent d'une
// petite valeur d'éveil fixe et restent TOUJOURS en TOTAL, quel que soit ce
// réglage — demandé explicitement : elles « évoluent suivant la valeur
// d'éveil des monstres », pas selon un mode bonus/total.
export const BASE_TOGGLE_STATS = new Set<StatKey>(['hp', 'atk', 'def', 'spd']);

export const CONFIGURABLE_SLOTS: (2 | 4 | 6)[] = [2, 4, 6];

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
