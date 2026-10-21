// Le dessin des colonnes de la page de bureau (docs/02-app/optimizer/ecran/README.md,
// « Panneaux et sections ») : chaque colonne — les essentiels, chaque colonne
// repliable, la colonne de droite — est UN panneau (fond `panel`, contour de
// 1 px) ; les boîtes qu'elle porte y sont des sections sans cadre ni ombre,
// séparées par un trait fin (`border-soft`). Décision de l'utilisateur : des
// cartes posées côte à côte se lisaient comme une mosaïque aérée ; le panneau
// dit la colonne, le trait dit la section.
//
// ⚠️ **Écarts serrés dans un panneau, larges entre deux** : 8 px de rembourrage
// et 8 px de part et d'autre d'un trait ; entre deux panneaux, la gouttière de
// la grille plus le retrait du panneau (`RETRAIT_PANNEAU`,
// src/lib/optimizerColonnes.ts), 24 px.
// ⚠️ Classes écrites en entier : Tailwind lit le source comme du texte.

// Le panneau d'une colonne.
export const PANNEAU = 'rounded-xl border border-border bg-panel p-2';

// La bande braise d'un panneau de COLONNE (pas d'un bloc posé dans une
// colonne) : son contour du haut est une bande de 3 px de braise, à la place
// du trait de 1 px, aux coins arrondis du panneau (seule exception à la règle
// du contour de 1 px, contours.md). Décision de l'utilisateur : distinguer
// les colonnes, que le seul panneau ne séparait pas assez. Le rembourrage du
// haut rend les 2 px du contour plus épais (3 + 6 = 1 + 8) : rien ne bouge
// dans le panneau. ⚠️ La braise VIVE (`--accent`, celle des aplats), pas
// celle des traits que donne `border-accent` (`--accent-lisible`) : la bande
// marque, elle ne cerne pas.
export const BANDE = 'border-t-[3px] border-t-[rgb(var(--accent))] pt-[6px]';

// ⚠️ **En A3, la bande reste en haut de sa colonne quand la colonne défile**
// (décision de l'utilisateur : elle ne part pas avec le contenu, et le haut
// de la colonne reste arrondi). C'est le pseudo-élément `::before` du
// panneau, collé (`sticky`) au pixel 0 de la boîte qui défile : le même
// dessin que le haut du panneau (bande de 3 px, contours de côté de 1 px,
// coins au rayon du panneau), posé dessus au repos, au-dessus du contenu
// une fois défilé, sans prendre de place (marges : -9 + R + (9 - R) = 0, où
// 9 = contour et rembourrage) ni recevoir de clic. Un pseudo-élément, pas un
// élément : les sélecteurs de sections (`[&>*+*]`) ne le comptent pas. Dans
// une grille, il se place en plus sur toutes les rangées, sinon il ne colle
// qu'à la hauteur de la sienne. Ce qui défile sous ses coins est rogné par
// la boîte (`coinsDuPanneau`).
export const BANDE_FIXE = '@[1180px]:border-t-transparent @[1180px]:before:pointer-events-none @[1180px]:before:sticky @[1180px]:before:top-0 @[1180px]:before:z-[1]'
  + ' @[1180px]:before:-mx-[9px] @[1180px]:before:-mt-[9px] @[1180px]:before:mb-[calc(9px-var(--radius-xl))] @[1180px]:before:block @[1180px]:before:h-[var(--radius-xl)] @[1180px]:before:self-stretch'
  + ' @[1180px]:before:rounded-t-xl @[1180px]:before:border-x @[1180px]:before:border-t-[3px] @[1180px]:before:border-border @[1180px]:before:border-t-[rgb(var(--accent))]';

// ⚠️ **Les coins d'une colonne qui défile** : la boîte qui défile est
// rectangulaire, et le contenu qui passe sous la bande se verrait dans les
// deux coins, hors de l'arrondi. Le chemin qui rogne la boîte (`clip-path`,
// fixe au défilement) retire ces deux coins : ce qui est derrière la colonne
// s'y voit, comme au repos. Il garde à droite du panneau l'écart et la barre
// de défilement. `largeur` : le panneau, depuis le bord gauche de la boîte ;
// `rayon` : le sien.
export function coinsDuPanneau(largeur: number, rayon: number): string {
  const R = rayon, W = largeur, LOIN = 100000;
  return `path('M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 H ${W - R} A ${R} ${R} 0 0 1 ${W} ${R} V 0 H ${LOIN} V ${LOIN} H 0 Z')`;
}

// Ses sections, empilées : un trait fin entre deux, 8 px de chaque côté.
export const SECTIONS = '[&>*+*]:mt-2 [&>*+*]:border-t [&>*+*]:border-border-soft [&>*+*]:pt-2';
