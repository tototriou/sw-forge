import { ReactNode } from 'react';

// Rangée d'actions au bas d'un dialogue ou d'un formulaire.
//
// ⚠️ **`flex-col-reverse` sous `sm`, et l'inversion n'est PAS un détail.** Les
// enfants s'écrivent dans l'ordre de LECTURE — action secondaire d'abord, action
// mise en avant ensuite —, ce qui donne sur un écran large la convention
// attendue : le bouton qu'on veut voir choisi est à droite, sous la main.
//
// Sur un téléphone, l'ordre s'inverse : la mise en avant passe EN BAS, là où le
// pouce tombe, et le secondaire remonte. Empilés dans l'ordre d'écriture, on
// aurait « Annuler » sous le pouce et l'action à atteindre plus haut — soit
// l'inverse exact de ce qu'on veut sur les deux formats à la fois.
//
// ⚠️ C'est pourquoi ce composant existe plutôt qu'une classe recopiée : l'ordre
// d'écriture des enfants a un sens qu'un `flex-col` oublié casse en silence. Le
// bug ne se voit que sur un téléphone, donc jamais pendant qu'on écrit le code.
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
      className={`mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${className}`}
    >
      {children}
    </div>
  );
}
