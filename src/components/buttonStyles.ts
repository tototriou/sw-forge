// Classes de bouton PARTAGÉES.
//
// Elles vivaient en constantes locales dans [Dialogs.tsx](Dialogs.tsx). Remontées
// ici au deuxième usage plutôt que recopiées — même trajet que
// [Segmented.tsx](../ui/Segmented.tsx) et [elementStyles.ts](elementStyles.ts) : deux
// copies auraient divergé.
//
// ⚠️ C'est ICI que se pose la pression au clic (`active:scale-[0.97]`). Un seul
// endroit à modifier, toute l'app qui accuse réception. Un bouton qui ne bouge
// pas au clic laisse un doute d'un dixième de seconde : est-ce que ça a pris ?
// Voir spec/shared/design.md.

// Retour tactile commun à tout élément pressable.
export const PRESSION = 'transition-transform duration-150 ease-out active:scale-[0.97]';

// Action principale d'un dialogue ou d'un formulaire.
//
// ⚠️ Il garde fond ET bordure d'accent : ce n'est pas un état sélectionné mais
// la hiérarchie d'un bouton d'action — il doit se détacher de l'action
// secondaire posée juste à côté. L'`shadow` en revanche est partie : un bouton
// posé dans un dialogue ne flotte pas au-dessus de lui.
export const BOUTON_PRIMAIRE =
  `rounded-lg bg-accent-soft border border-accent px-3.5 py-2 text-sm font-semibold text-ink ` +
  `transition hoverable:brightness-110 ${PRESSION}`;

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
//
// ⚠️ UN SEUL style actif par rangée de filtres — trois surbrillances
// différentes se lisent comme trois natures de filtre.
//
// ⚠️ Et UN SEUL MARQUEUR sur la pastille active : le **fond**. Elle cumulait
// `bg-accent-soft` + `border-accent` + `shadow`, trois signaux pour dire une
// seule chose — la pastille se surlignait deux fois et bavait sur ses voisines.
// La bordure reste `border` (elle est déjà là au repos, la teinter ne fait que
// doubler le fond) et l'ombre part : une pastille active ne DÉCOLLE pas de la
// page, l'élévation est réservée à ce qui flotte. Voir spec/shared/design.md.
export const PASTILLE = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold select-none transition ${PRESSION} ` +
  (active
    ? 'bg-accent-soft border-border text-ink'
    : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent');
