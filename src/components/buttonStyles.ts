// Classes de bouton PARTAGÉES.
//
// Elles vivaient en constantes locales dans [Dialogs.tsx](Dialogs.tsx). Remontées
// ici au deuxième usage plutôt que recopiées — même trajet que
// [Segmented.tsx](Segmented.tsx) et [elementStyles.ts](elementStyles.ts) : deux
// copies auraient divergé.
//
// ⚠️ C'est ICI que se pose la pression au clic (`active:scale-[0.97]`). Un seul
// endroit à modifier, toute l'app qui accuse réception. Un bouton qui ne bouge
// pas au clic laisse un doute d'un dixième de seconde : est-ce que ça a pris ?
// Voir spec/shared/design.md.

// Retour tactile commun à tout élément pressable.
export const PRESSION = 'transition-transform duration-150 ease-out active:scale-[0.97]';

// Action principale d'un dialogue ou d'un formulaire.
export const BOUTON_PRIMAIRE =
  `rounded-lg bg-accent-soft border border-accent px-3.5 py-2 text-sm font-semibold text-ink ` +
  `shadow transition hoverable:brightness-110 ${PRESSION}`;

// Action secondaire : présente, mais qui ne réclame pas le regard.
export const BOUTON_SECONDAIRE =
  `rounded-lg border border-border bg-panel2 px-3.5 py-2 text-sm font-semibold text-ink-dim ` +
  `transition hoverable:text-ink hoverable:border-accent ${PRESSION}`;

// ⚠️ Action DESTRUCTRICE : elle porte la couleur d'alerte, et n'est jamais le
// bouton mis en avant. Voir la règle dans spec/README.md — le défaut ne perd
// jamais rien.
export const BOUTON_DESTRUCTIF =
  `rounded-lg border border-bad/50 bg-bad/10 px-3.5 py-2 text-sm font-semibold text-bad ` +
  `transition hoverable:bg-bad/20 ${PRESSION}`;

// Pastille de filtre : petite, cumulable, dans une rangée.
// ⚠️ UN SEUL style actif par rangée de filtres — trois surbrillances
// différentes se lisent comme trois natures de filtre.
export const PASTILLE = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold select-none transition ${PRESSION} ` +
  (active
    ? 'bg-accent-soft border-accent text-ink shadow'
    : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent');
