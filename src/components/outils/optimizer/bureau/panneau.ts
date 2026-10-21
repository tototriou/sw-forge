// Le dessin des colonnes de la page de bureau (docs/02-app/optimizer/ecran/README.md,
// « Panneaux et sections ») : chaque colonne — les essentiels, chaque colonne
// repliable, la colonne de droite — est UN panneau (fond `panel`, contour de
// 1 px) ; les boîtes qu'elle porte y sont des sections sans cadre ni ombre,
// séparées par un trait fin (`border-soft`). Décision de l'utilisateur à
// l'arrêt 4 : des cartes posées côte à côte se lisaient comme une mosaïque
// aérée ; le panneau dit la colonne, le trait dit la section.
//
// ⚠️ **Écarts serrés dans un panneau, larges entre deux** : 8 px de rembourrage
// et 8 px de part et d'autre d'un trait ; entre deux panneaux, la gouttière de
// la grille plus le retrait du panneau (`RETRAIT_PANNEAU`,
// src/lib/optimizerColonnes.ts), 24 px.
// ⚠️ Classes écrites en entier : Tailwind lit le source comme du texte.

// Le panneau d'une colonne.
export const PANNEAU = 'rounded-xl border border-border bg-panel p-2';

// La bande braise en haut d'un panneau de COLONNE (pas d'un bloc posé dans une
// colonne) : 3 px d'ombre intérieure, le contour de 1 px restant le seul
// contour (seule exception à la règle du contour unique, contours.md).
// Décision de l'utilisateur : distinguer les colonnes, que le seul panneau ne
// séparait pas assez. Posée sur le panneau en A1 et A2, où la page défile ;
// en A3, `BANDE_FIXE` la remplace.
export const LISERE = 'shadow-[inset_0_3px_0_rgb(var(--accent))]';

// ⚠️ **En A3, la bande reste en haut de sa colonne quand la colonne défile**
// (décision de l'utilisateur : elle ne part pas avec le contenu). C'est le
// pseudo-élément `::before` du panneau, collé (`sticky`) au haut de la boîte
// qui défile, 1 px sous son bord (la place du contour) : même dessin que
// `LISERE` (la même ombre sur le haut de la boîte de rembourrage : coins du
// rayon intérieur du panneau, `--radius-xl` moins le contour ; haute de ce
// rayon et des 3 px, pour couvrir la courbe de l'ombre décalée), au-dessus du
// contenu, sans prendre de place (marges : -8 + (R + 2) + (6 - R) = 0) ni
// recevoir de clic. Un pseudo-élément, pas un élément : les sélecteurs de
// sections (`[&>*+*]`) ne le comptent pas. Le panneau qui le porte retire
// `LISERE` en A3 (`@[1180px]:shadow-none`, ou l'ombre de flottant seule).
// Dans une grille, il se place en plus sur toutes les rangées, sinon il ne
// colle qu'à la hauteur de la sienne.
export const BANDE_FIXE = '@[1180px]:before:pointer-events-none @[1180px]:before:sticky @[1180px]:before:top-px @[1180px]:before:z-[1]'
  + ' @[1180px]:before:-mx-2 @[1180px]:before:-mt-2 @[1180px]:before:mb-[calc(6px-var(--radius-xl))] @[1180px]:before:block @[1180px]:before:h-[calc(var(--radius-xl)+2px)] @[1180px]:before:self-stretch'
  + ' @[1180px]:before:rounded-t-[calc(var(--radius-xl)-1px)] @[1180px]:before:shadow-[inset_0_3px_0_rgb(var(--accent))]';

// Ses sections, empilées : un trait fin entre deux, 8 px de chaque côté.
export const SECTIONS = '[&>*+*]:mt-2 [&>*+*]:border-t [&>*+*]:border-border-soft [&>*+*]:pt-2';
