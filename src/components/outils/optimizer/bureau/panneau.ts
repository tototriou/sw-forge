// Un panneau par colonne, des sections séparées par un trait fin.
// docs/02-app/optimizer/ecran/README.md, « Panneaux et sections ».
export const PANNEAU = 'rounded-xl border border-border bg-panel p-2';
export const SECTIONS = '[&>*+*]:mt-2 [&>*+*]:border-t [&>*+*]:border-border-soft [&>*+*]:pt-2';

// Le contour supérieur reste au sommet du défilement. Le pseudo-élément
// n'entre pas dans le compte des sections et ne prend aucune hauteur.
export const HAUT_FIXE = 'border-t-transparent before:pointer-events-none before:sticky before:top-0 before:z-[1]'
  + ' before:-mx-[9px] before:-mt-[9px] before:mb-[calc(9px-var(--radius-xl))] before:block before:h-[var(--radius-xl)] before:flex-none'
  + ' before:rounded-t-xl before:border-x before:border-t before:border-border'
  + " before:content-['']";

// Le panneau sous un groupe d'onglets : le coin haut gauche est carré (le
// premier onglet s'y pose), la ligne de base des onglets fait le haut du
// panneau et s'arrête avant le coin haut droit, qui reste arrondi. Seul ce
// coin est dessiné ici, fixe au défilement comme `HAUT_FIXE`.
export const HAUT_FIXE_RACCORD = 'rounded-tl-none border-t-transparent before:pointer-events-none before:sticky before:top-0 before:z-[1]'
  + ' before:-mr-[9px] before:-mt-[9px] before:mb-[calc(9px-var(--radius-xl))] before:ml-auto before:block before:h-[var(--radius-xl)]'
  + ' before:w-[var(--radius-xl)] before:flex-none before:rounded-tr-xl before:border-r before:border-t before:border-border'
  + " before:content-['']";

// Le même coin, sur un panneau qui ne défile pas seul (deux piles).
export const COIN_RACCORD = "relative rounded-tl-none border-t-0 before:pointer-events-none before:absolute before:-right-px before:-top-px"
  + " before:h-[var(--radius-xl)] before:w-[var(--radius-xl)] before:rounded-tr-xl before:border-r before:border-t before:border-border before:content-['']";

// Le contenu qui passe sous les coins arrondis ne doit pas s'y voir.
// La découpe laisse libres les 4 px d'écart et la barre de défilement.
// `gauche` : le rayon du coin haut gauche, carré sous un groupe d'onglets.
export function coinsDuPanneau(largeur: number, rayon: number, gauche = rayon): string {
  const R = rayon, G = gauche, W = largeur, LOIN = 100000;
  return `path('M 0 ${G} A ${G} ${G} 0 0 1 ${G} 0 H ${W - R} A ${R} ${R} 0 0 1 ${W} ${R} V 0 H ${LOIN} V ${LOIN} H 0 Z')`;
}
