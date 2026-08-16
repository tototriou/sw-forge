import { RefObject, useCallback, useLayoutEffect, useState } from 'react';

// Ramène dans l'écran un élément flottant qui en dépasse par la droite.
//
// ⚠️ **Un `max-width` ne suffit pas.** Il borne la largeur, mais un panneau
// ancré à gauche d'un bouton déjà proche du bord droit sort quand même : sa
// largeur tient dans l'écran, sa POSITION non. C'est le cas de tous les
// flottants ancrés sur un déclencheur dont la place varie — une pilule de
// catégorie au bout d'une rangée, un bouton qui a bougé parce qu'un libellé
// s'est allongé. Aucune règle CSS statique ne peut savoir où ce déclencheur-là
// se trouve.
//
// ⚠️ **Mesuré, pas déduit.** `useLayoutEffect` lit la position réelle après
// rendu et avant peinture : l'élément ne s'affiche jamais hors cadre, même une
// image. Un `useEffect` l'aurait laissé déborder le temps d'une frame.
//
// Usage : appliquer `style` sur le flottant, et lui passer sa `ref`.
//
//   const { style, remesurer } = useRecalageEcran(ref, ouvert);
//   {ouvert && <div ref={ref} className="absolute left-0 …" style={style} />}
//
// Appeler `remesurer` quand le CONTENU change de taille (une liste qui se
// filtre, un texte qui s'allonge) : la mesure initiale ne vaut plus.
export function useRecalageEcran(
  ref: RefObject<HTMLElement>,
  // ⚠️ **Doit changer quand l'élément est monté ou démonté.** Le flottant n'est
  // rendu que lorsqu'il est ouvert : au premier passage du hook sa `ref` est
  // vide, et rien ne redéclencherait la mesure à l'ouverture — une `ref` ne
  // provoque pas de rendu. On passe donc l'état d'ouverture, qui, lui, en
  // provoque un.
  ouvert: boolean,
  // Distance minimale au bord de l'écran.
  marge = 8
): { style: { transform: string } | undefined; remesurer: () => void } {
  const [decalage, setDecalage] = useState(0);

  const mesurer = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // On repart de la position naturelle : sans cela, la correction s'ajoute à
    // elle-même à chaque passage et l'élément part vers la gauche.
    el.style.transform = '';
    const r = el.getBoundingClientRect();
    const debord = r.right - (document.documentElement.clientWidth - marge);
    if (debord <= 0) {
      setDecalage(0);
      return;
    }
    // ⚠️ Borné par la place disponible à GAUCHE. Sur un écran plus étroit que
    // l'élément, corriger le débordement droit le ferait sortir de l'autre
    // côté, où rien ne le rattraperait. Le `max-width` du composant gère ce
    // cas-là ; le décalage ne fait que ce qu'il peut.
    setDecalage(-Math.min(debord, Math.max(0, r.left - marge)));
  }, [ref, marge]);

  useLayoutEffect(() => {
    if (!ouvert) {
      // Remis à zéro à la fermeture : rouvert ailleurs (une autre pilule de
      // catégorie), le flottant repartirait sinon du décalage précédent avant
      // d'être recalculé, et sauterait visiblement.
      setDecalage(0);
      return;
    }
    mesurer();
  }, [ouvert, mesurer]);

  // ⚠️ Au REDIMENSIONNEMENT aussi : une rotation de téléphone change la largeur
  // sous un flottant déjà ouvert, et le décalage calculé pour le portrait
  // devient faux en paysage.
  useLayoutEffect(() => {
    if (!ouvert) return;
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [ouvert, mesurer]);

  return {
    style: decalage ? { transform: `translateX(${decalage}px)` } : undefined,
    remesurer: mesurer,
  };
}
