import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData, type OptimizerList, type OptimizerListMember } from './optimizerExclusion';
import type { MemoireMembreOptimizer } from './optimizerMemberStorage';

export type ProprietaireCriteresOptimizer = Omit<MemoireMembreOptimizer, 'criteres'>;

// La même garde protège la restauration et l'écriture : liste active,
// appartenance, exemplaire affiché et espèce réellement résolue.
export function validerProprietaireCriteres(
  proprietaire: ProprietaireCriteresOptimizer | null,
  listes: { lists: OptimizerList[]; members: OptimizerListMember[]; activeListId: string | null },
  affichage: { selectedId: string | null; sourceSelector: ExclusionSelector | null },
  data: ExclusionSourceData,
): ProprietaireCriteresOptimizer | null {
  if (!proprietaire || proprietaire.listId !== listes.activeListId
    || !listes.lists.some(l => l.id === proprietaire.listId)
    || !affichage.sourceSelector) return null;
  const cle = exclusionSelectorKey(proprietaire.selector);
  if (cle !== exclusionSelectorKey(affichage.sourceSelector)
    || !listes.members.some(m => m.listId === proprietaire.listId && exclusionSelectorKey(m.selector) === cle)) return null;
  const resolu = resolveExclusionEntry(proprietaire.selector, data);
  return resolu?.monster.com2usId === proprietaire.com2usId
    && String(resolu.monster.id) === affichage.selectedId ? proprietaire : null;
}
