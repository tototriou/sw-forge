// Les colonnes des résultats de l'Optimizer : ce qui se trie et se borne une
// fois la recherche faite, dans le Worker de classement. Module sans
// dépendance de valeur : les lecteurs de mémoires et de session l'importent
// sans tirer le moteur.

import type { StatKey } from './effects';
import type { BornesResultats } from './filtresResultats';

/** Les onze colonnes : les huit stats de la fiche, puis trois objectifs. */
export type ColonneResultat = StatKey | 'efficience' | 'degats_reels' | 'ehp';

export const COLONNES_RESULTATS: readonly ColonneResultat[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc', 'efficience', 'degats_reels', 'ehp'];

export function estColonneResultat(cle: string): cle is ColonneResultat {
  return (COLONNES_RESULTATS as readonly string[]).includes(cle);
}

/**
 * La forme des bornes d'affichage qu'une mémoire de membre peut porter : un
 * objet dont chaque clé est une colonne, chaque valeur `{ min, max }` d'un
 * nombre ou de `null`, la forme qu'accepte `etatDesBornes` (filtresResultats.ts),
 * qui lève sur toute autre. Ici, sans tirer le moteur : une forme fausse est
 * refusée, rien n'est ramené.
 */
export function bornesBienFormees(v: unknown): v is BornesResultats {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const borne = (x: unknown) => x === null || x === undefined || (typeof x === 'number' && !Number.isNaN(x));
  return Object.entries(v).every(([cle, b]) => estColonneResultat(cle) && (b === undefined
    || (b !== null && typeof b === 'object' && !Array.isArray(b) && borne((b as Record<string, unknown>).min) && borne((b as Record<string, unknown>).max))));
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
