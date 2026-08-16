import { useEffect, useState } from 'react';

// Une media query, lue depuis React.
//
// ⚠️ **Pour ce que le CSS ne peut PAS faire**, jamais pour masquer un bloc :
// `sm:hidden` reste la bonne réponse à « cacher sur mobile ». Ce hook sert
// quand une VALEUR doit changer — la taille d'un dessin calculée en pixels, le
// nombre d'éléments d'une liste — et qu'aucune classe ne peut l'exprimer.
//
// ⚠️ `matchMedia` et non `window.innerWidth` + `resize` : le navigateur ne
// notifie qu'aux franchissements du seuil, là où `resize` déclenche à chaque
// pixel et provoque un rendu par image pendant tout un redimensionnement.
//
// ⚠️ L'état initial est lu SYNCHRONEMENT (fonction d'initialisation), pas dans
// un effet : sinon le premier rendu utilise toujours la valeur de bureau, et un
// téléphone voit la roue de runes s'afficher en grand avant de rétrécir.
export function useMediaQuery(query: string): boolean {
  const [correspond, setCorrespond] = useState(() =>
    // `window` est absent au rendu serveur — l'app est statique, mais la garde
    // évite un plantage si elle est un jour pré-rendue.
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setCorrespond(mq.matches);
    // Resynchronisation : la largeur a pu changer entre le premier rendu et
    // l'attachement de l'écouteur.
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return correspond;
}

// Les seuils de Tailwind, nommés une fois.
//
// ⚠️ Écrits en dur ici ET dans la config Tailwind : c'est le seul endroit où
// une valeur est dupliquée, faute de pouvoir lire la config au runtime. Elles
// doivent rester alignées — d'où ces constantes plutôt que des littérales
// disséminées dans les composants.
export const SOUS_SM = '(max-width: 639px)';
export const SOUS_LG = '(max-width: 1023px)';

// ⚠️ **L'affichage resserré du TACTILE**, quel que soit l'appareil et quelle que
// soit son orientation.
//
// C'est le POINTEUR seul qui décide, jamais la largeur. `SOUS_SM` faisait
// basculer un iPhone d'un rendu à l'autre en le tournant (390 px en portrait,
// 844 en paysage) : portraits, écarts et tailles changeaient d'un quart de tour,
// alors que c'est le même téléphone dans la même main. Une tablette, elle, a la
// largeur d'un bureau mais les gestes d'un mobile — et donc les mêmes besoins de
// densité.
//
// ⚠️ Doit rester ALIGNÉ avec la variante `compact:` de tailwind.config.js.
export const COMPACT = '(pointer: coarse)';
