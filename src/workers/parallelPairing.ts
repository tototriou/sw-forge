// Le régime de l'appariement — séquentiel ou parallèle — et le nombre de
// Workers du parallèle, pour le navigateur ET Node : une seule règle, que
// chaque plateforme alimente de ce qu'elle sait de la machine (fils logiques :
// `navigator.hardwareConcurrency`, `os.availableParallelism()` ; cœurs
// physiques : l'application de bureau, par la demande au Worker de
// recherche).
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

// Nombre de Workers de l'appariement parallèle, DÉRIVÉ de la machine : ses
// cœurs physiques moins `COEURS_LAISSES`, bornés à
// [`TRAVAILLEURS_MIN`, `TRAVAILLEURS_MAX`].
//  - Les cœurs physiques, quand la plateforme les connaît (`coeursPhysiques` :
//    l'application de bureau les lit, bureau/coeurs.ts) ; sinon la moitié des
//    fils logiques
//    (`concurrence` : `navigator.hardwareConcurrency`,
//    `os.availableParallelism()`), qui les vaut sur une machine à deux fils
//    par cœur.
//  - Deux cœurs laissés : mesuré sur 8 cœurs / 16 fils, 6 Workers vont aussi
//    vite que 8 sur la plus lourde recherche (20 milliards de paires) et
//    plus vite sur une autre (10 milliards, 7,1 s contre 8,1 s) ; avec 8 fils
//    occupés par d'autres tâches, le débit de celles-ci baisse de 8 % à 6
//    Workers et de 13 % à 8 (par rapport à 2 Workers), pour une recherche
//    aussi rapide à 6 qu'à 8 ; et sous la seconde, où lancement, copie des
//    compartiments et préparation par Worker dominent, 2 Workers battent 8
//    de 27 % — écart de 0,14 à 0,23 s, laissé sans règle propre aux petits
//    espaces (décision).
//  - Au moins 2 : une machine de moins de 8 fils n'est pas mesurée.
//  - Au plus 8 : au-delà rien n'est mesuré, et chaque Worker reçoit sa copie
//    des tableaux et refait la préparation (mémoire).
//  - Rien de connu (ni cœurs, ni concurrence) : `TRAVAILLEURS_PAR_DEFAUT`.
export const TRAVAILLEURS_MIN = 2;
export const TRAVAILLEURS_MAX = 8;
export const TRAVAILLEURS_PAR_DEFAUT = 4;
export const COEURS_LAISSES = 2;

const connu = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n >= 1;

/**
 * `coeursPhysiques` est obligatoire, `null` quand la plateforme ne les donne
 * pas : chaque appelant décide d'où vient le nombre, et `tsc` signale celui
 * qui l'oublie.
 */
export function nombreDeTravailleurs(concurrence: number | undefined, coeursPhysiques: number | null): number {
  const coeurs = connu(coeursPhysiques) ? Math.floor(coeursPhysiques) : connu(concurrence) ? Math.floor(concurrence / 2) : null;
  if (coeurs == null) return TRAVAILLEURS_PAR_DEFAUT;
  return Math.min(TRAVAILLEURS_MAX, Math.max(TRAVAILLEURS_MIN, coeurs - COEURS_LAISSES));
}

/**
 * Nombre de Workers du pool de résolution de l'équipement : la règle de
 * l'appariement (`nombreDeTravailleurs`), parce que les deux ne tournent pas
 * en même temps sur le gros du travail — l'appariement finit en une à
 * quelques secondes, la résolution dure ensuite des dizaines de secondes, un
 * build à la fois par Worker.
 *
 * Mémoire, relevée en Node sur une recherche « Dégâts réels » à relique
 * libre (300 builds) : chaque Worker garde ~21 Mo vivants (fil vide ~8 Mo,
 * contexte cloné ~6 Mo, caches de résolution ~7 Mo) ; un seul Worker en
 * garde autant, le pool les multiplie par N. Pas de borne propre : le
 * plafond de la règle (8) reste sous ~170 Mo.
 */
export function nombreDeResolveurs(concurrence: number | undefined, coeursPhysiques: number | null): number {
  return nombreDeTravailleurs(concurrence, coeursPhysiques);
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
