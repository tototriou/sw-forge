import { RefObject, useLayoutEffect, useState } from 'react';

// Détecte si un contenu DÉBORDE la largeur RÉELLEMENT disponible d'un
// conteneur donné — contrairement à `useMediaQuery` (voir son en-tête), qui
// ne voit que la largeur de la FENÊTRE, jamais celle d'un conteneur précis
// pris dans un flex/grid partagé avec d'autres éléments (deux éléments
// peuvent se disputer l'espace sans que la fenêtre elle-même soit étroite).
//
// ⚠️ **`mesureRef` est un CLONE INVISIBLE du même contenu, en mode NON
// compact, positionné en `absolute` pour ne pas peser sur la mise en page
// réelle** — la seule façon de connaître la largeur NATURELLE (non
// contrainte) d'un contenu à `white-space: nowrap` sans la deviner en pixels
// (fragile : dépend de la police, de la langue, d'un libellé qui change).
// `conteneurRef` est l'élément RÉEL, visible, dont la largeur disponible
// varie avec la mise en page (`ResizeObserver`, pas `resize` — voir
// useMediaQuery.ts pour la même raison).
export function useDebordement(conteneurRef: RefObject<HTMLElement>, mesureRef: RefObject<HTMLElement>): boolean {
  const [deborde, setDeborde] = useState(false);

  // ⚠️ `useLayoutEffect`, pas `useEffect` — même raison que l'état initial
  // SYNCHRONE de `useMediaQuery.ts` : mesurer AVANT que le navigateur peigne
  // évite un instant visible en mode NON compact avant la correction. Ici,
  // impossible de connaître le résultat dès le tout premier rendu (il faut
  // les nœuds DOM des deux `ref`, qui n'existent qu'après ce rendu) — mais
  // `useLayoutEffect` reste la meilleure approximation : la correction
  // s'applique avant la peinture de CE rendu, pas après.
  useLayoutEffect(() => {
    const conteneur = conteneurRef.current;
    const mesure = mesureRef.current;
    if (!conteneur || !mesure) return;

    const verifier = () => setDeborde(mesure.scrollWidth > conteneur.clientWidth);
    verifier();

    const ro = new ResizeObserver(verifier);
    ro.observe(conteneur);
    return () => ro.disconnect();
  }, [conteneurRef, mesureRef]);

  return deborde;
}
