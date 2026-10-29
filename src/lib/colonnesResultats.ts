// Les colonnes des résultats de l'Optimizer : ce qui se trie et se borne une
// fois la recherche faite, dans le Worker de classement. Module sans
// dépendance de valeur : les lecteurs de mémoires et de session l'importent
// sans tirer le moteur.

import type { StatKey } from './effects';
import type { BorneColonne, BornesResultats } from './filtresResultats';
import type { OptimMetric } from './runeOptim';

/** Les onze colonnes : les huit stats de la fiche, puis trois objectifs. */
export type ColonneResultat = StatKey | 'efficience' | 'degats_reels' | 'ehp';

export const COLONNES_RESULTATS: readonly ColonneResultat[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc', 'efficience', 'degats_reels', 'ehp'];

export function estColonneResultat(cle: string): cle is ColonneResultat {
  return (COLONNES_RESULTATS as readonly string[]).includes(cle);
}

/**
 * Les colonnes dont l'échelle suit la mesure des runes : « Efficience » vaut
 * une moyenne d'efficience en % ou un Score SW entier, deux grandeurs sans
 * rapport fixe (la principale compte dans l'une seulement, les plates n'y
 * pèsent pas pareil). Leur borne retient la mesure sous laquelle elle a été
 * posée (`BorneColonne.mesure`) ; sous l'autre, elle est mise de côté.
 */
export const COLONNES_SELON_MESURE: readonly ColonneResultat[] = ['efficience'];

/**
 * La borne vaut-elle sous cette mesure ? Une borne d'une autre colonne,
 * toujours ; une borne sans mesure (écrite avant que la borne la retienne)
 * est réputée posée sous la mesure courante.
 */
export function borneSousMesure(colonne: ColonneResultat, borne: BorneColonne | undefined, mesure: OptimMetric): boolean {
  return !COLONNES_SELON_MESURE.includes(colonne) || borne?.mesure === undefined || borne.mesure === mesure;
}

function partager(bornes: BornesResultats, mesure: OptimMetric, garder: boolean): BornesResultats {
  const entrees = Object.entries(bornes) as [ColonneResultat, BorneColonne | undefined][];
  if (entrees.every(([c, b]) => borneSousMesure(c, b, mesure) === garder)) return bornes;
  return Object.fromEntries(entrees.filter(([c, b]) => borneSousMesure(c, b, mesure) === garder)) as BornesResultats;
}

/**
 * Les bornes qui valent sous cette mesure : celles que la vue applique et que
 * l'écran montre. Une borne posée sous l'autre mesure est mise de côté, sans
 * conversion. Rien de mis de côté : les mêmes bornes (même objet).
 */
export function bornesSousMesure(bornes: BornesResultats, mesure: OptimMetric): BornesResultats {
  return partager(bornes, mesure, true);
}

/** Les seules bornes mises de côté sous cette mesure (posées sous l'autre) : ce qu'« Effacer » laisse. */
export function bornesMisesDeCote(bornes: BornesResultats, mesure: OptimMetric): BornesResultats {
  return partager(bornes, mesure, false);
}

/**
 * Les bornes dont la mesure est fixée : une borne d'une colonne qui suit la
 * mesure, écrite sans elle, prend `mesure`. Sans telle borne : les mêmes
 * bornes (même objet).
 */
export function bornesAvecMesure(bornes: BornesResultats, mesure: OptimMetric): BornesResultats {
  if (!COLONNES_SELON_MESURE.some((c) => bornes[c] !== undefined && bornes[c]!.mesure === undefined)) return bornes;
  const next = { ...bornes };
  for (const c of COLONNES_SELON_MESURE) if (next[c] !== undefined && next[c]!.mesure === undefined) next[c] = { ...next[c]!, mesure };
  return next;
}

/**
 * La forme des bornes d'affichage qu'une mémoire de membre peut porter : un
 * objet dont chaque clé est une colonne, chaque valeur `{ min, max }` d'un
 * nombre ou de `null`, la forme qu'accepte `etatDesBornes` (filtresResultats.ts),
 * qui lève sur toute autre ; une colonne qui suit la mesure peut porter
 * `mesure` (`eff` ou `score`), aucune autre. Ici, sans tirer le moteur : une
 * forme fausse est refusée, rien n'est ramené.
 */
export function bornesBienFormees(v: unknown): v is BornesResultats {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const borne = (x: unknown) => x === null || x === undefined || (typeof x === 'number' && !Number.isNaN(x));
  const mesure = (cle: ColonneResultat, x: unknown) => x === undefined || (COLONNES_SELON_MESURE.includes(cle) && (x === 'eff' || x === 'score'));
  return Object.entries(v).every(([cle, b]) => estColonneResultat(cle) && (b === undefined
    || (b !== null && typeof b === 'object' && !Array.isArray(b) && borne((b as Record<string, unknown>).min) && borne((b as Record<string, unknown>).max)
      && mesure(cle, (b as Record<string, unknown>).mesure))));
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
