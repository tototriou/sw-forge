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
// Position de défilement au moment du PREMIER verrou — c'est là qu'on revient.
let departY = 0;

export function useScrollBloque(actif: boolean): void {
  useEffect(() => {
    if (!actif) return;
    verrous += 1;

    // ⚠️ **`overflow: hidden` NE SUFFIT PAS sur iOS**, et c'est le piège de ce
    // hook. Safari continue d'y faire défiler le document au doigt : la propriété
    // est respectée pour la molette et les barres de défilement, pas pour le
    // geste tactile. On voyait donc la page glisser derrière une modale ouverte,
    // alors que le même code bloquait parfaitement le bureau.
    //
    // ⚠️ Le seul verrou fiable est de RETIRER `body` DU FLUX (`position: fixed`)
    // et de compenser le décalage par un `top` négatif : sans rien qui dépasse de
    // l'écran, il n'y a plus rien à faire défiler. C'est aussi ce qui empêche le
    // « rubber-band » de découvrir le fond de page sous le voile.
    //
    // ⚠️ **Le décalage se mémorise, sinon la page saute au sommet.** `position:
    // fixed` détache `body` : sa position de défilement est perdue à l'instant
    // où on l'applique, et rendue à la fermeture par le `scrollTo` ci-dessous.
    // Sans cela, fermer une confirmation vous ramenait en haut de la prépa.
    if (verrous === 1) {
      departY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${departY}px`;
      // ⚠️ `left`/`right` explicites : détaché du flux, `body` n'a plus de bord
      // gauche à hériter. Sans eux, sa largeur reste juste mais sa position
      // horizontale dépend du `width: 100%` que lui donne index.css — on
      // s'appuierait sur une règle voisine pour tenir en place.
      document.body.style.left = '0';
      document.body.style.right = '0';
    }
    // Conservé pour la molette et les navigateurs de bureau, où il suffit.
    document.documentElement.style.overflow = 'hidden';

    return () => {
      verrous -= 1;
      if (verrous > 0) return;
      // ⚠️ `''` et non une valeur : on rend la propriété au CSS de la feuille de
      // style, au lieu de lui imposer une valeur en ligne qui la masquerait.
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      // ⚠️ `instant` : un retour animé se voit comme un saut de la page au
      // moment où le dialogue disparaît, et l'utilisateur ne sait plus s'il a
      // été déplacé ou si la page a bougé toute seule.
      window.scrollTo({ top: departY, behavior: 'instant' });
    };
  }, [actif]);
}
