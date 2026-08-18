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

// Surface qui FLOTTE au-dessus de la page, ancrée à ce qui l'a ouverte : popup,
// menu, liste de résultats. ⚠️ La seule chose de l'app qui ait droit à une ombre
// — et le seul endroit où se règle son `z-index`, qui est un ordre et non un
// nombre libre.
export { default as Flottant } from './Flottant';
export type { FlottantProps } from './Flottant';

// Le même, mais qui CHOISIT SON CÔTÉ en mesurant la place autour de son ancre.
// ⚠️ Pour ce qui est ancré à un élément dont la position varie — une tuile dans
// une grille, un badge au bout d'une ligne : ces ancres vont jusqu'aux bords de
// la page, où un flottant posé toujours du même côté se fait couper.
export { default as FlottantAuto } from './FlottantAuto';
export type { FlottantAutoProps } from './FlottantAuto';

// Saisie NUMÉRIQUE bornée, avec ses deux flèches. ⚠️ Vivait dans `components/`
// alors que sept écrans l'utilisaient : sa place est ici.
export { default as NumberField } from './NumberField';

export { default as Selecteur } from './Selecteur';
export type { SelecteurProps } from './Selecteur';

export { default as Option } from './Option';
export type { OptionProps } from './Option';

export { default as Interrupteur } from './Interrupteur';
export type { InterrupteurProps } from './Interrupteur';

export { default as Vignette } from './Vignette';
export type { VignetteProps } from './Vignette';

// PASTILLE de filtre : la pilule à deux états d'une rangée de critères (élément,
// rareté, doublons). ⚠️ Distincte d'un `Bouton actif` — voir le composant : un
// bouton dit un mode, une pastille pose un filtre et vit en rangée. C'est la
// brique que `Bouton` annonçait sans qu'elle existe encore.
export { default as Pastille } from './Pastille';
export type { PastilleProps } from './Pastille';

// SURFACE rendue cliquable (ligne de carte, poignée de glissement) : un
// <button> volontairement NU. Voir le composant — la nudité y est la règle, pas
// un oubli.
export { default as ZoneCliquable } from './ZoneCliquable';
export type { ZoneCliquableProps } from './ZoneCliquable';

export { default as Case } from './Case';
export type { CaseProps } from './Case';

export { default as PiedDeDialogue } from './PiedDeDialogue';

// ⚠️ **`Modale` est la coquille de TOUTE boîte modale de l'app**, et elle vivait
// dans `components/` alors que deux écrans la recopiaient au lieu de l'importer.
// Ces copies perdaient EN SILENCE le piège à focus, le retour du focus à
// l'ouvreur, la fermeture à Échap et le blocage du défilement — rien ne le
// signalait à l'écran. C'est précisément ce qu'une coquille partagée existe pour
// empêcher, et le mettre ici est ce qui rend la copie moins tentante que
// l'import.
export { Modale, ConfirmDialog, PromptDialog, KeepAccountDialog } from './Dialogs';

// Panneau montant du TÉLÉPHONE. ⚠️ Ce n'est pas une modale : il coexiste avec la
// page, monte du bas et se pose SOUS les dialogues dans l'échelle des `z-index`.
export { default as MobileSheet } from './MobileSheet';
