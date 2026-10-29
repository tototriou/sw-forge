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

// Le contenu qui passe sous les coins arrondis ne doit pas s'y voir.
// La découpe laisse libres les 4 px d'écart et la barre de défilement.
export function coinsDuPanneau(largeur: number, rayon: number): string {
  const R = rayon, W = largeur, LOIN = 100000;
  return `path('M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 H ${W - R} A ${R} ${R} 0 0 1 ${W} ${R} V 0 H ${LOIN} V ${LOIN} H 0 Z')`;
}
