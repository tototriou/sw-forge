// Le message d'import d'une recette Optimizer (OptimizerSection.tsx) : son
// ton et sa durée, en fonctions pures pour que les tests les atteignent
// (le dépôt ne teste pas les composants React).
//
// Un message qui porte un AVERTISSEMENT de conversion (l'ancien mode critique
// « Moyenne » passé en « Critique », docs/02-app/optimizer/
// § Lancer la recherche) prend le token d'avertissement (`warn`,
// comme les autres avertissements de l'écran, jamais `good`) et ne s'efface
// plus tout seul : il reste jusqu'au prochain import de recette, réussi ou
// non, qui le remplace. Le message ordinaire (succès sans avertissement)
// garde sa minuterie de 5 s, le refus la sienne de 9 s.

export interface MessageImport {
  text: string;
  error?: boolean;
  avertissement?: boolean;
}

// `null` = jamais effacé par une minuterie (seul un nouvel import le remplace).
export function delaiEffacementImport(message: MessageImport): number | null {
  if (message.error) return 9000;
  if (message.avertissement) return null;
  return 5000;
}

// Classes de couleur, tokens de docs/03-developpeur/interface/ seulement.
export function classeMessageImport(message: MessageImport): string {
  if (message.error) return 'text-bad';
  if (message.avertissement) return 'text-warn';
  return 'text-good';
}
