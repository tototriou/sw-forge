import { forwardRef, ReactNode } from 'react';
import Bouton, { TonBouton } from './Bouton';

// Pastille : petite, cumulable, dans une rangée. Un filtre, un interrupteur
// d'affichage — quelque chose qui a **deux états** et qu'on lit d'un coup d'œil
// au milieu de ses voisines.
//
// ⚠️ **Ce n'est PAS un second bouton : c'est [Bouton](Bouton.tsx) préréglé.**
// Elle en fixe la forme (`pilule`), la taille (`sm`) et la hauteur, et n'ajoute
// qu'une chose que le bouton n'a pas : la PUCE. Tout le reste — fond, tracé,
// ton, pression au clic, `aria-pressed` — descend du bouton. Un changement de
// tracé fait dans `Bouton` traverse donc jusqu'ici sans qu'on y touche, ce qui
// est exactement ce qu'on attend d'une librairie partagée.
//
// ⚠️ **UN SEUL MARQUEUR sur la pastille active : le fond.** Elle cumulait
// `bg-accent-soft` + `border-accent` + `shadow`, trois signaux pour dire une
// seule chose — elle se surlignait deux fois et bavait sur ses voisines. La
// bordure reste neutre (elle est déjà là au repos, la teinter ne fait que
// doubler le fond) et l'ombre part : une pastille active ne DÉCOLLE pas de la
// page, l'élévation est réservée à ce qui flotte. Voir spec/shared/design.md.

export interface PastilleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  actif: boolean;
  libelle: ReactNode;
  icone?: ReactNode;
  ton?: TonBouton;
  // Puce pleine (affiché) ou creuse (coupé), à la place d'une icône.
  //
  // ⚠️ C'est le rendu du TACTILE pour les interrupteurs d'affichage : un œil
  // ouvert / barré demande de se rappeler s'il montre l'état courant ou l'action
  // à venir. À 12 px sur un téléphone l'ambiguïté ne se lève plus ; un point
  // plein ou creux se lit sans être interprété.
  puce?: boolean;
}

const Pastille = forwardRef<HTMLButtonElement, PastilleProps>(function Pastille(
  { actif, libelle, icone, ton = 'neutre', puce = false, className = '', ...reste },
  ref,
) {
  return (
    <Bouton
      ref={ref}
      actif={actif}
      ton={ton}
      forme="pilule"
      taille="sm"
      libelle={libelle}
      icone={
        puce ? (
          // `border-current` : la puce emprunte la couleur du texte, donc elle
          // suit l'état sans qu'on ait à le déclarer deux fois.
          <span
            aria-hidden
            className={`h-2 w-2 flex-none rounded-full border border-current transition ${
              actif ? 'bg-current' : 'bg-transparent'
            }`}
          />
        ) : (
          icone
        )
      }
      // ⚠️ `data-hauteur-fixe` : la hauteur est dessinée ici (`h-7`), la règle
      // tactile globale ne doit pas la remplacer par son minimum de 40 px — une
      // rangée de pastilles y perdrait sa raison d'être, qui est d'être basse.
      // Voir index.css.
      data-hauteur-fixe
      className={`h-7 ${className}`}
      {...reste}
    />
  );
});

export default Pastille;
