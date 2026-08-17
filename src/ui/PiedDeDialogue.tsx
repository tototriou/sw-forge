import { ReactNode } from 'react';

// Rangée d'actions au bas d'un dialogue ou d'un formulaire.
//
// ⚠️ **Une RANGÉE taquée à droite, aux deux formats.** Les enfants s'écrivent
// dans l'ordre de lecture — action secondaire d'abord, action mise en avant
// ensuite —, donc celle qu'on veut voir choisie se retrouve la plus à droite,
// sous la main.
//
// ⚠️ Il empilait ses boutons en colonne au doigt, chacun étiré sur toute la
// largeur. Deux longs libellés y prenaient deux bandes pleines, et un bouton
// seul s'étalait d'un bord à l'autre pour une action qui ne le mérite pas.
// `flex-wrap` remplace la règle de largeur : les boutons gardent leur taille et
// se replient d'eux-mêmes quand elle manque.
//
// ⚠️ C'est un composant plutôt qu'une classe recopiée parce que l'ordre
// d'écriture des enfants a un sens, et qu'un `justify-end` oublié le casse en
// silence — l'action mise en avant se retrouve à gauche, là où l'on ne la vise
// pas.
//
// ⚠️ **L'ordre d'insistance dépend de ce que l'action fait, pas de son rang
// syntaxique** : quand elle DÉTRUIT, c'est « Annuler » qui est mis en avant.
// Voir spec/README.md — le défaut ne perd jamais rien. Ce composant place ; il
// ne décide pas lequel des deux mérite l'accent.

export default function PiedDeDialogue({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      // ⚠️ **`flex-wrap` plutôt qu'un empilement sous `sm`.** Les boutons
      // étaient en colonne au doigt, étirés sur toute la largeur : deux longs
      // libellés y prenaient deux bandes pleines, et un bouton seul (« Créer »)
      // s'étalait d'un bord à l'autre pour une action qui ne le mérite pas.
      // En rangée alignée à droite, ils gardent leur taille et se replient d'eux-
      // mêmes quand la largeur manque — le pliage remplace la règle de largeur.
      // ⚠️ Le rendu de BUREAU ne change pas : il était déjà en rangée taquée à
      // droite au-dessus de `sm`.
      className={`mt-4 flex flex-wrap items-center justify-end gap-2 ${className}`}
    >
      {children}
    </div>
  );
}
