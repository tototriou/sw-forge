import type { OptimizerState } from '../../../../hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../../../hooks/useOptimizerLists';

// ⚠️ **La vue des gabarits ne modifie jamais l'Optimizer.** Elle LIT l'état réel
// (listes, critères, compte) ; ses gestes agissent sur un état local à chaque
// gabarit, ou sur ces copies inertes, dont chaque fonction ne fait rien. Un
// clic dans la vue ne doit pas réécrire les listes ni les critères de
// l'utilisateur.
function inerte<T extends object>(objet: T): T {
  return Object.fromEntries(
    Object.entries(objet).map(([cle, valeur]) => [cle, typeof valeur === 'function' ? () => undefined : valeur]),
  ) as T;
}

export function listesInertes(lists: UseOptimizerLists, donnees: Partial<UseOptimizerLists> = {}): UseOptimizerLists {
  return { ...inerte(lists), ...donnees };
}

export function optimizerInerte(optimizer: OptimizerState): OptimizerState {
  return inerte(optimizer);
}
