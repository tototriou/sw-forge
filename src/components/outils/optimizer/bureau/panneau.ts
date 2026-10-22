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
//
// ⚠️ **La bande descend en dégradé jusqu'au bas de l'arrondi** : 3 px pleins
// en haut, puis la braise s'efface vers le contour de 1 px sur la hauteur du
// rayon (`--radius-xl`), le long des coins. Un contour CSS n'a qu'une couleur
// par côté : la bande est donc le contour d'un pseudo-élément de la hauteur du
// rayon (3 px en haut, 1 px de côté, coins du panneau), dont le fond (braise
// en dégradé sur la couleur du contour) est rogné à l'anneau par un masque
// (`mask-composite: exclude` entre la boîte pleine et sa boîte intérieure).
// Le contour du panneau, lui, est transparent en haut. Ici, hors de l'A3, le
// pseudo-élément est posé sur le contour du haut du panneau (`absolute`) ;
// `BANDE_FIXE` le rend collant dès 952 px (A3).
export const BANDE = 'relative border-t-[3px] border-t-transparent pt-[6px]'
  + ' before:pointer-events-none before:absolute before:-inset-x-px before:-top-[3px] before:block before:h-[var(--radius-xl)]'
  + ' before:rounded-t-xl before:border-x before:border-t-[3px] before:border-transparent'
  + ' before:[background:linear-gradient(to_bottom,rgb(var(--accent))_3px,rgb(var(--accent)/0)_100%)_border-box,linear-gradient(rgb(var(--border)),rgb(var(--border)))_border-box]'
  + ' before:[mask-image:linear-gradient(#000,#000),linear-gradient(#000,#000)] before:[mask-clip:padding-box,border-box] before:[mask-composite:exclude]'
  + " before:content-['']";

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
// la boîte (`coinsDuPanneau`). Le dessin (anneau en dégradé, voir `BANDE`) est
// repris en entier, sous le seuil : la colonne de droite n'a pas `BANDE`.
export const BANDE_FIXE = '@[952px]:border-t-transparent @[952px]:before:pointer-events-none @[952px]:before:sticky @[952px]:before:inset-x-auto @[952px]:before:top-0 @[952px]:before:z-[1]'
  + ' @[952px]:before:-mx-[9px] @[952px]:before:-mt-[9px] @[952px]:before:mb-[calc(9px-var(--radius-xl))] @[952px]:before:block @[952px]:before:h-[var(--radius-xl)] @[952px]:before:self-stretch'
  + ' @[952px]:before:rounded-t-xl @[952px]:before:border-x @[952px]:before:border-t-[3px] @[952px]:before:border-transparent'
  + ' @[952px]:before:[background:linear-gradient(to_bottom,rgb(var(--accent))_3px,rgb(var(--accent)/0)_100%)_border-box,linear-gradient(rgb(var(--border)),rgb(var(--border)))_border-box]'
  + ' @[952px]:before:[mask-image:linear-gradient(#000,#000),linear-gradient(#000,#000)] @[952px]:before:[mask-clip:padding-box,border-box] @[952px]:before:[mask-composite:exclude]'
  + " @[952px]:before:content-['']";

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
