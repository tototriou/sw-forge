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
  empile = false,
  className = '',
}: {
  children: ReactNode;
  // Boutons EMPILÉS et pleine largeur, à toutes les tailles d'écran.
  //
  // ⚠️ **Pour des boutons dont le libellé est une PHRASE**, pas un verbe :
  // « Non, ne rien garder de mes informations » face à « Garder mes données
  // (recommandé) ». Deux phrases dans une rangée taquée à droite se serrent et
  // se replient au milieu d'un mot ; empilées, chacune se lit d'un trait. Un
  // « Valider » n'a rien à gagner à s'étaler d'un bord à l'autre — d'où la
  // rangée par défaut.
  //
  // ⚠️ La colonne met l'action recommandée EN BAS — sous le pouce, et au même
  // rang que le « à droite » d'une rangée — parce que les enfants s'écrivent
  // secondaire d'abord, mis en avant ensuite.
  empile?: boolean;
  className?: string;
}) {
  return (
    <div
      // ⚠️ **Rangée taquée à droite par DÉFAUT**, plutôt qu'un empilement sous
      // `sm`. Un bouton seul (« Créer ») s'étalait d'un bord à l'autre pour une
      // action qui ne le mérite pas ; en rangée, les boutons gardent leur taille
      // et se replient d'eux-mêmes quand la largeur manque.
      // ⚠️ Le rendu de BUREAU est le même dans les deux modes : rangée taquée à
      // droite, comme avant.
      className={`mt-4 flex gap-2 ${
        empile
          ? // ⚠️ **Empilé à TOUTES les largeurs, et pleine largeur.** Il repassait
            // en rangée au-dessus de `sm` : les deux libellés y étaient trop
            // longs pour tenir sur une ligne, se repliaient, et l'on obtenait
            // deux boutons de TAILLES DIFFÉRENTES alignés à droite — un escalier.
            // Une rangée qui se replie ne vaut jamais mieux qu'une colonne
            // assumée : autant empiler franchement, chaque bouton occupant la
            // même largeur que son voisin.
            // `items-stretch` (le défaut du flex) fait le reste : sans largeur
            // propre, les boutons s'étirent sur toute la boîte.
            //
            // ⚠️ `flex-col` et NON `flex-col-reverse` : les enfants s'écrivent
            // secondaire d'abord, mis en avant ensuite. En colonne simple, le
            // mis en avant tombe donc EN BAS — sous le pouce, et au même rang
            // que le « à droite » d'une rangée. Inversée, la colonne remontait
            // l'action recommandée en tête et laissait le refus sous le doigt.
            'flex-col'
          : 'flex-wrap items-center justify-end'
      } ${className}`}
    >
      {children}
    </div>
  );
}
