import { ReactNode, RefObject, useLayoutEffect, useState } from 'react';
import Flottant from './Flottant';

// [Flottant](Flottant.tsx) qui CHOISIT SON CÔTÉ en mesurant la place autour de
// son ancre : il s'ouvre vers la gauche si l'ancre est près du bord droit, vers
// le haut si elle est près du bas.
//
// ⚠️ **Pour ce qui est ancré à un élément DONT LA POSITION VARIE** : une tuile
// dans une grille, une carte de monstre, un badge au bout d'une ligne. Ces
// ancres vont jusqu'aux bords de la page, et un flottant posé toujours du même
// côté s'y trouvait coupé — exactement là où l'on venait de cliquer pour lire
// quelque chose.
//
// ⚠️ Distinct de `useRecalageEcran`, qui TIRE une surface débordante vers
// l'intérieur après coup. Ici on choisit le bon côté AVANT de peindre : pas de
// saut visible, et la surface reste alignée sur son ancre au lieu de flotter à
// une position corrigée. Le recalage reste utile quand la surface doit garder
// son côté (le formulaire de catégorie, ancré à sa pilule).
//
// ⚠️ `useLayoutEffect` et non `useEffect` : la mesure doit être faite AVANT que
// le navigateur peigne. Avec `useEffect`, la surface apparaissait un instant du
// mauvais côté puis sautait — un scintillement d'une frame, mais visible.

export interface FlottantAutoProps {
  ouvert: boolean;
  // L'ancre à mesurer. ⚠️ Elle doit porter `position: relative` : la surface se
  // place en `absolute` par rapport à elle.
  ancre: RefObject<HTMLElement>;
  // Dimensions ESTIMÉES, en pixels. Elles servent à décider du côté avant que la
  // surface existe — on ne peut pas mesurer ce qui n'est pas encore rendu.
  largeur?: number;
  hauteur?: number;
  rembourrage?: 'aucun' | 'sm' | 'md';
  // Sert surtout à teinter la BORDURE quand le flottant porte un sens (une
  // alerte). ⚠️ Le contenu ne doit pas poser son propre cadre : deux traits
  // concentriques à 1 px l'un de l'autre se lisent comme un contour flou.
  className?: string;
  children: ReactNode;
}

// Marge de sécurité au bord de l'écran, en pixels : une surface qui touche
// exactement le bord paraît coupée même quand elle ne l'est pas.
const MARGE = 8;

export default function FlottantAuto({
  ouvert,
  ancre,
  largeur = 260,
  hauteur = 320,
  rembourrage = 'aucun',
  className = '',
  children,
}: FlottantAutoProps) {
  const [place, setPlace] = useState<{
    cote: 'gauche' | 'droite';
    ancrage: 'dessus' | 'dessous';
  }>({ cote: 'gauche', ancrage: 'dessous' });

  useLayoutEffect(() => {
    if (!ouvert || !ancre.current) return;
    const r = ancre.current.getBoundingClientRect();
    setPlace({
      cote: r.left + largeur > window.innerWidth - MARGE ? 'droite' : 'gauche',
      // ⚠️ On ne bascule vers le HAUT que s'il y a vraiment la place au-dessus :
      // sinon on échange un débordement par le bas contre un débordement par le
      // haut, et celui-là est pire — la surface sort de la fenêtre là où l'on ne
      // peut pas défiler pour la rattraper.
      ancrage:
        r.bottom + hauteur > window.innerHeight - MARGE && r.top - hauteur > MARGE
          ? 'dessus'
          : 'dessous',
    });
  }, [ouvert, largeur, hauteur, ancre]);

  if (!ouvert) return null;

  return (
    <Flottant
      cote={place.cote}
      ancrage={place.ancrage}
      rembourrage={rembourrage}
      // ⚠️ `maxWidth` en plus de la largeur : sur un téléphone, 260 px demandés
      // dépassent parfois l'écran à eux seuls, quel que soit le côté choisi.
      largeur=""
      style={{ width: largeur, maxWidth: '90vw' }}
      className={className}
    >
      {children}
    </Flottant>
  );
}
