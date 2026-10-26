// Les colonnes des résultats de l'Optimizer : ce qui se trie et se borne une
// fois la recherche faite, dans le Worker de classement. Module sans
// dépendance de valeur : les lecteurs de mémoires et de session l'importent
// sans tirer le moteur.

import type { StatKey } from './effects';

/** Les onze colonnes : les huit stats de la fiche, puis trois objectifs. */
export type ColonneResultat = StatKey | 'efficience' | 'degats_reels' | 'ehp';

export const COLONNES_RESULTATS: readonly ColonneResultat[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc', 'efficience', 'degats_reels', 'ehp'];

export function estColonneResultat(cle: string): cle is ColonneResultat {
  return (COLONNES_RESULTATS as readonly string[]).includes(cle);
}

/**
 * Le seul point qui lit un objectif ou un tri enregistré comme colonne de tri.
 * L'objectif de recherche « Vitesse » reste ; son tri est la colonne VIT :
 * sa note (`objectiveScore`, VIT de la fiche, l'effet unique de la relique
 * ne portant que sur PV, ATQ et DEF) est celle de la colonne, candidat par
 * candidat, donc le même ordre. Un tri « vitesse » enregistré (mémoire de
 * membre, session) se relit VIT.
 */
export function triDesResultats(tri: ColonneResultat | 'vitesse'): ColonneResultat {
  return tri === 'vitesse' ? 'spd' : tri;
}
