// Le régime de l'appariement — séquentiel ou parallèle — et le nombre de
// Workers du parallèle, pour le navigateur ET Node : une seule règle, que
// chaque plateforme alimente de sa propre concurrence
// (`navigator.hardwareConcurrency`, `os.availableParallelism()`).
//
// ⚠️ **Ce module doit rester NEUTRE** : jamais d'import de `worker_threads`,
// jamais de `Worker` DOM, jamais de `self`. Vite tenterait sinon de résoudre
// du code Node dans le bundle navigateur. Un outil Node lit ces valeurs, il ne
// les recode jamais, sinon il cesse de reproduire le régime que la production
// choisirait. Voir docs/03-developpeur/optimizer/moteur/parallelisation.md.

// PARALLEL_PAIRING_THRESHOLD : la taille d'espace (`totalPairCount`) à partir
// de laquelle l'appariement se répartit entre plusieurs Workers. Calibré sur
// l'ancien appariement (perte nette sous ~46 M de paires, gain au-delà de
// ~250 M, 100 M choisi entre les deux sans mesure fine) ; pas remesuré pour le
// noyau sur tableaux typés.
export const PARALLEL_PAIRING_THRESHOLD = 100_000_000;

// Nombre de Workers de l'appariement parallèle, DÉRIVÉ de la machine :
// `concurrence` compte les fils logiques ; sa moitié vaut le nombre de cœurs
// physiques sur une machine à deux fils par cœur. Mesuré sur 8 cœurs / 16
// fils : 8 Workers font mieux que 16 sur tous les cas. Au plus
// `TRAVAILLEURS_MAX` : au-delà rien n'est mesuré, et chaque Worker reçoit sa
// copie des tableaux et refait la préparation (mémoire). Concurrence
// inconnue : `TRAVAILLEURS_PAR_DEFAUT`.
export const TRAVAILLEURS_MAX = 8;
export const TRAVAILLEURS_PAR_DEFAUT = 4;

export function nombreDeTravailleurs(concurrence: number | undefined): number {
  if (concurrence == null || !Number.isFinite(concurrence) || concurrence < 1) return TRAVAILLEURS_PAR_DEFAUT;
  return Math.min(TRAVAILLEURS_MAX, Math.max(1, Math.floor(concurrence / 2)));
}

export type RegimeAppariement = 'sequentiel' | 'parallele';

/**
 * Le régime d'une recherche, une fois les moitiés construites : parallèle à
 * partir du seuil, sauf hors contrat numérique du noyau (`motifContrat` non
 * nul, traceur compris), où l'appariement reste séquentiel pour retomber sur
 * `pairBuckets` en rendant la main.
 */
export function regimeAppariement(totalPairs: number, motifContrat: string | null): RegimeAppariement {
  return totalPairs >= PARALLEL_PAIRING_THRESHOLD && motifContrat == null ? 'parallele' : 'sequentiel';
}
