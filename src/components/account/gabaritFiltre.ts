// ⚠️ **À la SOURIS, les filtres des runes prennent le gabarit du `Segmented`**
// de la librairie (refonte graphique, lot 8a — le mainteneur : « ce serait bien que
// les boutons aient tous la même tête ») : sur une ligne, sets · emplacements
// · antiques se lisaient comme trois contrôles différents — deux barres
// maison de 38 px au fond `panel`, cases cerclées d'accent, à côté d'un
// `Segmented` de 32 px au fond `panel2`, cran posé en fond d'accent doux.
// Désormais, à la souris : cadre `panel2` de 32 px, cases de 26 px, et
// l'élément actif marqué comme le cran posé d'un `Segmented`, SANS contour
// (voir ui/Segmented.tsx) — depuis le rebranding (décision 19), un APLAT de
// braise, texte `accent-ink` ; il suit le `Segmented` pour que la ligne garde
// une seule tête de bouton. Au doigt, rien ne change (lot 11) : les variantes
// `lg:` passent après les classes de base dans la feuille.
// Partagé par `SetFilter` et `SlotFilter`.

export const CADRE_FILTRE_LG = 'lg:gap-0.5 lg:bg-panel2 lg:p-0.5';
export const CASE_FILTRE_LG = 'lg:h-[26px] lg:w-[26px]';
export const ACTIF_FILTRE_LG = 'lg:border-transparent lg:bg-accent lg:text-accent-ink';
