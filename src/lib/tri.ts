// Sens d'un tri — partagé par toutes les listes qui en proposent un.
//
// ⚠️ **Un SENS, pas deux entrées de plus dans chaque liste déroulante.** Le
// Bestiaire portait « Étoiles ↓ » et « Étoiles ↑ » comme deux tris distincts :
// chaque critère ajouté doublait la liste, et rien ne disait que les deux
// entrées étaient le même classement à l'envers. Le sens est un axe à part, et
// il vaut pour le critère courant quel qu'il soit.
export type SensTri = 'desc' | 'asc';

// ⚠️ **`desc` par défaut PARTOUT.** Une liste d'inventaire répond d'abord à
// « qu'est-ce que j'ai de mieux ? » — c'est ce que fait le jeu, et c'est le
// classement qu'on lit sans y penser. L'ordre inverse sert à une question
// précise (« qu'est-ce que je peux nourrir ? »), qu'on pose en le demandant.
export const SENS_PAR_DEFAUT: SensTri = 'desc';

// Le facteur à appliquer à un comparateur écrit en DÉCROISSANT.
//
// ⚠️ **Il ne s'applique pas à tout.** Une valeur ABSENTE (rune qui ne porte pas
// la propriété triée) reste en dernier dans les deux sens : « absent » n'est pas
// une petite valeur, c'est l'absence de valeur — la remonter en tête à l'endroit
// où l'on cherche justement les plus faibles serait un contresens. C'est
// pourquoi les comparateurs prennent le SENS plutôt que d'être simplement
// négociés de l'extérieur (voir `comparateurRunes`).
export const signeTri = (sens: SensTri): 1 | -1 => (sens === 'asc' ? -1 : 1);
