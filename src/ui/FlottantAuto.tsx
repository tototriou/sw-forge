import { ReactNode, RefObject, useLayoutEffect, useRef, useState } from 'react';
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
// l'intérieur après coup. Ici on mesure AVANT de peindre : on choisit le côté
// d'ouverture puis on BORNE la position horizontale au viewport, en un seul
// passage sans saut visible. Le recalage reste utile quand la surface doit
// garder son côté (le formulaire de catégorie, ancré à sa pilule).
//
// ⚠️ **Le côté seul ne suffit pas près d'un bord.** Ancrée à un élément étroit
// (une tuile de grille à deux colonnes du téléphone), une surface large alignée
// sur un côté déborde de l'AUTRE — `html { overflow-x: hidden }` la coupe et
// elle devient invisible. On borne donc sa position finale à l'écran, tout en la
// gardant ancrée à ce qui l'a ouverte.
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
  /**
   * La surface prend EXACTEMENT la largeur de son ancre, à chaque instant.
   *
   * ⚠️ **Pas une mesure, du CSS** : la surface est déjà `position: absolute`
   * dans l'ancre (qui porte `position: relative`), donc un `width: 100%` la
   * cale dessus — et la SUIT au redimensionnement de la fenêtre, ce qu'une
   * largeur mesurée à l'ouverture ne ferait pas. `largeur` est alors ignorée.
   *
   * ⚠️ Le placement horizontal en devient trivial : une surface aussi large
   * que son ancre ne peut pas déborder d'un côté sans déborder de l'ancre,
   * donc elle se pose à `gauche: 0`. C'est le cas d'un panneau dépliant
   * ancré à une CARTE, par opposition à un menu ancré à une petite tuile —
   * pour celui-là, une largeur propre reste la bonne réponse.
   */
  largeurAncre?: boolean;
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
  largeurAncre = false,
  rembourrage = 'aucun',
  className = '',
  children,
}: FlottantAutoProps) {
  const boiteRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{
    cote: 'gauche' | 'droite';
    ancrage: 'dessus' | 'dessous';
    // Décalage horizontal FINAL, en coordonnées de l'ancre (elle est
    // `position: relative`) : c'est lui qui borne la surface à l'écran.
    gauche: number;
  }>({ cote: 'gauche', ancrage: 'dessous', gauche: 0 });

  useLayoutEffect(() => {
    if (!ouvert || !ancre.current) return;
    const r = ancre.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // ⚠️ **Dimensions RÉELLES, pas estimées.** La surface est déjà rendue (on ne
    // rend rien tant que `!ouvert`), donc on mesure sa boîte — `maxWidth: 90vw`
    // compris. Un flottant de 340 px ancré à une tuile de ~170 px de la grille à
    // deux colonnes du téléphone débordait sinon hors de l'écran, coupé par
    // `html { overflow-x: hidden }` : le détail devenait invisible au doigt.
    // ⚠️ En mode `largeurAncre`, la largeur voulue EST celle de l'ancre : on la
    // mesure sur `r`, jamais sur l'estimation, qui ne veut plus rien dire.
    const voulue = largeurAncre ? r.width : largeur;
    const w = boiteRef.current?.offsetWidth ?? Math.min(voulue, vw - 2 * MARGE);
    const h = boiteRef.current?.offsetHeight ?? hauteur;

    // Côté préféré — celui d'où la surface s'ouvre (sert l'ancrage visuel ET le
    // sens de l'animation). À droite si l'ancre est trop près du bord droit.
    // ⚠️ En `largeurAncre`, `r.left + r.width === r.right` : le test est donc
    // toujours faux et la surface s'ouvre à gauche, alignée sur l'ancre. C'est
    // le comportement voulu, pas un cas dégénéré — elle recouvre exactement la
    // carte, elle ne déborde d'aucun côté.
    const cote = r.left + voulue > vw - MARGE ? 'droite' : 'gauche';
    // Position absolue voulue selon le côté, PUIS bornée à l'écran : la surface
    // reste ancrée à la tuile, mais ne sort jamais du viewport (ce que le choix
    // binaire gauche/droite seul ne garantissait pas — près d'un bord, aligner
    // sur l'autre côté la faisait déborder de CE côté-là).
    const alPref = cote === 'droite' ? r.right - w : r.left;
    const al = Math.max(MARGE, Math.min(alPref, vw - MARGE - w));

    setPlace({
      cote,
      // ⚠️ On ne bascule vers le HAUT que s'il y a vraiment la place au-dessus :
      // sinon on échange un débordement par le bas contre un débordement par le
      // haut, et celui-là est pire — la surface sort de la fenêtre là où l'on ne
      // peut pas défiler pour la rattraper.
      ancrage: r.bottom + h > vh - MARGE && r.top - h > MARGE ? 'dessus' : 'dessous',
      gauche: al - r.left,
    });
  }, [ouvert, largeur, hauteur, largeurAncre, ancre]);

  if (!ouvert) return null;

  return (
    <Flottant
      ref={boiteRef}
      cote={place.cote}
      ancrage={place.ancrage}
      rembourrage={rembourrage}
      // ⚠️ `maxWidth` en plus de la largeur : sur un téléphone, 260 px demandés
      // dépassent parfois l'écran à eux seuls, quel que soit le côté choisi.
      // ⚠️ **`left` explicite (et `right: auto`) : la position horizontale est
      // pilotée par le décalage borné ci-dessus**, pas par le `left-0`/`right-0`
      // que `cote` pose sur la classe. On neutralise donc `right` pour que seul
      // notre `left` compte, quel que soit le côté choisi pour l'animation.
      largeur=""
      // ⚠️ `'100%'` et non une valeur mesurée : la surface étant `absolute`
      // dans l'ancre `relative`, le pourcentage la cale dessus ET l'y garde au
      // redimensionnement, sans effet ni recalcul.
      style={{
        width: largeurAncre ? '100%' : largeur,
        maxWidth: '90vw',
        left: place.gauche,
        right: 'auto',
      }}
      className={className}
    >
      {children}
    </Flottant>
  );
}
