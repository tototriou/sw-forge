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

// Ses sections, empilées : un trait fin entre deux, 8 px de chaque côté.
export const SECTIONS = '[&>*+*]:mt-2 [&>*+*]:border-t [&>*+*]:border-border-soft [&>*+*]:pt-2';
