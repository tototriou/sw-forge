import { forwardRef, ReactNode } from 'react';
import Bouton, { TonBouton } from './Bouton';

// Bouton réduit à son icône : une croix de fermeture, un crayon, une corbeille.
//
// ⚠️ **[Bouton](Bouton.tsx) préréglé**, comme [Pastille](Pastille.tsx) : il n'a
// pas de style propre, il fixe un carré et retire le libellé du rendu. Les axes
// du bouton (`ton`, `fond`, `trait`, `forme`) restent ouverts.
//
// ⚠️ **`libelle` est OBLIGATOIRE et n'est jamais dessiné.** Il alimente à la
// fois `aria-label` et `title` — sans lui le bouton est muet pour un lecteur
// d'écran, et l'app en comptait une dizaine dans ce cas. Le rendre obligatoire
// dans le type est la seule façon de ne pas avoir à y repenser.
//
// ⚠️ **`serre` n'est pas « plus petit », c'est une EXEMPTION tactile.** Il porte
// `data-cible-fine` et reste à 20 px, et ne sert qu'à un bouton posé DANS un
// contenant plus petit que la cible de 40 px — les deux boutons d'une pilule de
// 28 px de haut, par exemple. Portés à 40 px ils la débordaient ; dotés en plus
// d'une zone étendue de 44 px ils se chevaucheraient, et on supprimerait la
// catégorie en voulant l'éditer.

export interface BoutonIconeProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'aria-label' | 'title'
  > {
  icone: ReactNode;
  libelle: string;
  taille?: 'libre' | 'serre';
  ton?: TonBouton;
  // Pose un cadre autour de l'icône. Défaut : non — la plupart de ces boutons
  // vivent dans un en-tête déjà cadré, où une bordure de plus ferait du bruit.
  cadre?: boolean;
  actif?: boolean;
  // N'apparaît qu'au survol de son conteneur, qui doit porter `group`.
  //
  // ⚠️ **JAMAIS `hidden group-hover:flex`** : l'élément sortirait du flux, donc
  // ne serait ni focusable au clavier ni atteignable au doigt — on ne pouvait
  // plus retirer un monstre sur téléphone. On joue sur l'OPACITÉ (l'élément
  // reste dans le DOM), et il est rendu visible d'office là où il n'y a pas de
  // survol (`no-hover:`) ainsi qu'au focus clavier. Voir spec/shared/design.md.
  auSurvol?: boolean;
}

const BoutonIcone = forwardRef<HTMLButtonElement, BoutonIconeProps>(function BoutonIcone(
  {
    icone,
    libelle,
    taille = 'libre',
    ton = 'neutre',
    cadre = false,
    auSurvol = false,
    className = '',
    ...reste
  },
  ref,
) {
  const serre = taille === 'serre';
  const apparition = auSurvol
    ? 'opacity-0 no-hover:opacity-100 group-hoverable:opacity-100 focus-visible:opacity-100 ' +
      'transition-opacity duration-150 ease-out'
    : '';
  return (
    <Bouton
      ref={ref}
      ton={ton}
      fond={cadre ? 'doux' : 'vide'}
      trait={cadre ? 'plein' : 'aucun'}
      forme={serre ? 'pilule' : 'boite'}
      // ⚠️ Voir `TailleBouton.carre` : la taille `sm` posait un `py-1`, soit 8 px
      // de rembourrage vertical sur une hauteur forcée à 20 px. Il ne restait
      // plus rien pour l'icône — le bouton s'affichait, coloré et cliquable,
      // mais VIDE.
      taille="carre"
      aria-label={libelle}
      title={libelle}
      icone={icone}
      // ⚠️ Voir plus haut : `serre` s'exempte de la règle tactile parce que son
      // contenant est plus petit qu'elle, pas parce que 40 px gênait.
      {...(serre ? { 'data-cible-fine': true } : {})}
      className={`${serre ? 'h-5 w-5' : 'h-7 w-7'} ${
        cadre ? '' : 'hoverable:bg-black/25'
      } ${apparition} ${className}`}
      {...reste}
    />
  );
});

export default BoutonIcone;
