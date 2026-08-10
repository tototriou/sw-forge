import { useSyncExternalStore } from 'react';
import { RuneDetail } from '../types';
import { runeEfficiency, runeScore } from '../lib/effects';

// Mesure de la qualité d'une rune, au choix de l'utilisateur :
//  - `eff`   : efficience (convention communautaire, principale incluse, /2,8) ;
//  - `score` : score SW, celui affiché dans le jeu (secondaires uniquement).
// Voir spec/compte/calcul-runes.md §3 et §3 bis.
export type RuneMetric = 'eff' | 'score';

export const RUNE_METRICS: { key: RuneMetric; label: string; hint: string }[] = [
  { key: 'eff', label: 'Efficience', hint: 'Efficience communautaire (principale incluse, /2,8)' },
  { key: 'score', label: 'Score SW', hint: 'Score affiché dans le jeu (stats secondaires uniquement)' },
];

// **Paramètre global de l'application** (réglé une fois dans la barre de nav),
// et non une préférence par page.
//
// Store externe plutôt qu'un `useStickyState` par composant : le choix doit se
// propager EN DIRECT à tous les affichages montés (liste des runes, détail
// d'équipement en RTA et en siège…), or `useStickyState` ne relit son cache
// qu'au montage.
//
// **Persisté** dans `localStorage` — contrairement aux filtres et tris, qui sont
// des préférences de vue jetables : un réglage d'application doit survivre au
// rechargement. Effacé par « Supprimer mes données » (préfixe `sw-forge`).
const STORAGE_KEY = 'sw-forge-rune-metric-v1';

function load(): RuneMetric {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'score' ? 'score' : 'eff';
  } catch {
    return 'eff';
  }
}

let current: RuneMetric = load();
const listeners = new Set<() => void>();

export function setRuneMetric(metric: RuneMetric) {
  if (metric === current) return;
  current = metric;
  try {
    localStorage.setItem(STORAGE_KEY, metric);
  } catch {
    /* stockage indisponible : on ignore */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRuneMetric(): RuneMetric {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

// Valeur d'une rune selon la mesure — utile pour trier.
export function runeMetricValue(rune: RuneDetail, metric: RuneMetric): number {
  return metric === 'eff' ? runeEfficiency(rune) : runeScore(rune);
}

// Affichage court : « 140.2% » (efficience) ou « 152 » (score — toujours un
// entier, la formule du jeu arrondit).
export function formatRuneMetric(value: number, metric: RuneMetric): string {
  return metric === 'eff' ? `${value.toFixed(1)}%` : String(Math.round(value));
}

// Convertit un PALIER d'une mesure vers l'autre, en **préservant la sélection** :
// le nouveau palier laisse passer exactement les mêmes runes.
//
// ⚠️ **Il n'existe pas de facteur de conversion.** Mesuré sur un compte réel de
// 3 163 runes, le rapport score/efficience s'étale de **0,98 à 2,37** — la
// principale compte dans l'une et pas dans l'autre, et les deux tables de max
// diffèrent. Appliquer le ratio médian à un palier de 110 % laisserait passer
// 457 runes au lieu de 139 : un palier qui change de sens en changeant d'unité
// est pire que pas de conversion du tout.
//
// D'où la conversion par **rang** : on compte ce qui passait, et on prend la
// valeur de la n-ième meilleure dans la nouvelle mesure. C'est exact pour la
// question que le palier pose vraiment — « où je coupe ».
//
// `paires` : une entrée par rune, sa valeur dans l'ancienne et la nouvelle mesure.
export function convertirPalier(
  paires: { avant: number; apres: number }[],
  palier: number
): number {
  if (paires.length === 0) return palier; // rien à quoi se caler : on n'invente pas
  const gardees = paires.filter((p) => p.avant >= palier).length;
  const valeurs = paires.map((p) => p.apres).sort((a, b) => b - a);
  // Palier qui ne gardait rien → il ne doit toujours rien garder : un cran
  // au-dessus du maximum. Sans ça, une liste vide se remplirait toute seule.
  if (gardees === 0) return Math.ceil(valeurs[0]) + 1;
  return Math.round(valeurs[gardees - 1]);
}

// Libellé court devant la valeur (« Eff. » / « Score »).
export function runeMetricLabel(metric: RuneMetric): string {
  return metric === 'eff' ? 'Eff.' : 'Score';
}
