// Librairie UI de SW Forge — le vocabulaire visuel commun à toute l'app.
//
// ⚠️ **Un composant dessiné ici ne se redessine nulle part ailleurs.** C'est la
// raison d'être de ce dossier : un changement demandé sur un bouton mobile doit
// se faire UNE fois et se voir sur les neuf pages, pas être repris fichier par
// fichier. L'app avait déjà tenté le coup avec un fichier de constantes de
// classes ([buttonStyles.ts](../components/buttonStyles.ts)) — sept fichiers
// l'importaient sur quarante qui dessinaient des boutons, parce qu'une constante
// se contourne d'un `className` sans que rien ne s'y oppose.
//
// ⚠️ **Un composant monte ici au DEUXIÈME usage, jamais au premier.** Remonter
// trop tôt fabrique une abstraction taillée pour un seul appelant, que le second
// fait éclater en options. C'est le trajet qu'ont suivi `Segmented` et
// `elementStyles` avant ce dossier.
//
// ⚠️ **Ces composants ne connaissent AUCUNE couleur en dur.** Ils ne parlent
// qu'en tokens (`bg-panel`, `text-ink-dim`, `border-accent`), donc les deux
// thèmes et les deux formats suivent sans qu'ils aient à les distinguer. Voir
// spec/shared/design.md, qui reste la source de vérité de ces valeurs.

// ⚠️ **Des AXES, pas un catalogue.** `ton` (couleur), `fond` (remplissage),
// `trait` (contour), `forme`, `taille` se choisissent SÉPARÉMENT : un bouton
// d'ajout en pointillés, un retrait plein en rouge et un filtre creux sont trois
// combinaisons, pas trois entrées à ajouter ici. Une librairie qui nomme ses
// styles par intention grossit d'une variante à chaque écran neuf ; celle-ci ne
// grossit que si un AXE manque.
export { default as Bouton, PRESSION } from './Bouton';
export type {
  BoutonProps,
  TonBouton,
  FondBouton,
  TraitBouton,
  FormeBouton,
  TailleBouton,
} from './Bouton';

// Bouton portant des ACTIONS ACCOLÉES à sa droite (une pilule de catégorie, une
// pilule de lead). ⚠️ Ce n'est pas un bouton de plus : c'est la forme que trois
// endroits redessinaient déjà à la main, dont deux avec le même bug de hauteur
// tactile.
export { default as BoutonGroupe } from './BoutonGroupe';
export type { BoutonGroupeProps } from './BoutonGroupe';

export { default as BoutonIcone } from './BoutonIcone';
export type { BoutonIconeProps } from './BoutonIcone';

export { default as Champ } from './Champ';
export type { ChampProps } from './Champ';

export { default as Selecteur } from './Selecteur';
export type { SelecteurProps } from './Selecteur';

export { default as Option } from './Option';
export type { OptionProps } from './Option';

export { default as Interrupteur } from './Interrupteur';
export type { InterrupteurProps } from './Interrupteur';

export { default as Vignette } from './Vignette';
export type { VignetteProps } from './Vignette';

export { default as Case } from './Case';
export type { CaseProps } from './Case';

export { default as PiedDeDialogue } from './PiedDeDialogue';
