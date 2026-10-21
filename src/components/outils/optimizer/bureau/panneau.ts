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
// contour. Décision de l'utilisateur à l'arrêt 4 : distinguer les colonnes,
// que le seul panneau ne séparait pas assez. Une colonne superposée y ajoute
// son ombre de flottant (`COLONNE_A3` de PageBureau.tsx), écrite avec elle :
// deux classes `shadow-*` ne se cumulent pas.
export const LISERE = 'shadow-[inset_0_3px_0_rgb(var(--accent))]';

// Ses sections, empilées : un trait fin entre deux, 8 px de chaque côté.
export const SECTIONS = '[&>*+*]:mt-2 [&>*+*]:border-t [&>*+*]:border-border-soft [&>*+*]:pt-2';
