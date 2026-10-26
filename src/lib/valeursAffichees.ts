// Ce qu'une carte de résultat de l'Optimizer ÉCRIT d'une valeur, en nombre :
// la même expression sert l'affichage (carte, quasi-succès, mesure d'une
// rune) et les bornes des colonnes de résultats (filtresResultats.ts), pour
// qu'une carte qui affiche « 78.8% » passe une borne ≥ 78.8. Une seconde
// écriture de l'arrondi divergerait au premier changement de présentation.

import type { OptimMetric } from './runeOptim';

/** La mesure moyenne par rune d'un build : la mesure de ses six runes, divisée par six. */
export function moyenneParRune(total: number): number {
  return total / 6;
}

/**
 * Les chiffres qu'écrit l'écran d'une mesure de rune, sans son unité :
 * une décimale en efficience (« 140.2 »), un entier en score SW (la formule
 * du jeu arrondit).
 */
export function chiffresMesureRune(valeur: number, metric: OptimMetric): string {
  return metric === 'eff' ? valeur.toFixed(1) : String(Math.round(valeur));
}

/** L'entier qu'une carte écrit des PV effectifs et des dégâts réels, avant les séparateurs de milliers. */
export function entierAffiche(valeur: number): number {
  return Math.round(valeur);
}
