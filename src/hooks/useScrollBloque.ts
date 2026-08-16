import { useEffect } from 'react';

// Empêche la page de défiler tant qu'un panneau ou un dialogue est ouvert.
//
// ⚠️ **Un COMPTEUR, pas une mémorisation.** Chaque composant sauvegardait la
// valeur d'`overflow` à son ouverture pour la restaurer à sa fermeture. Avec un
// seul flottant à la fois, cela marche ; imbriqués, non :
//
//   1. le panneau d'actions s'ouvre, mémorise `''`, pose `hidden` ;
//   2. une confirmation s'ouvre par-dessus, mémorise `hidden`, repose `hidden` ;
//   3. on confirme — le panneau se ferme d'abord et restaure `''` ;
//   4. le dialogue se ferme ensuite et restaure… `hidden`.
//
// La page restait bloquée, sans qu'aucun flottant ne soit visible pour
// l'expliquer. Le compteur ne dépend pas de l'ordre de démontage : le blocage
// tombe quand le DERNIER verrou est relâché, jamais avant, jamais après.
let verrous = 0;

export function useScrollBloque(actif: boolean): void {
  useEffect(() => {
    if (!actif) return;
    verrous += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      verrous -= 1;
      // ⚠️ `''` et non `'auto'` : on rend la propriété au CSS de la feuille de
      // style, au lieu de lui imposer une valeur en ligne qui la masquerait.
      if (verrous === 0) document.body.style.overflow = '';
    };
  }, [actif]);
}
