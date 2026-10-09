import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData, type OptimizerList, type OptimizerListMember } from './optimizerExclusion';
import { cleMemoireMembre, type IdentiteMembreOptimizer, type MemoireMembreOptimizer } from './optimizerMemberStorage';
import type { RattachementMembreOptimizer } from './optimizerRattachement';

export type ProprietaireCriteresOptimizer = Omit<MemoireMembreOptimizer, 'criteres'>;

export function rattacherProprietaireCriteres(proprietaire: ProprietaireCriteresOptimizer | null, rattachements: readonly RattachementMembreOptimizer[]) {
  if (!proprietaire) return null;
  const rattachement = rattachements.find(r => r.listId === proprietaire.listId
    && exclusionSelectorKey(r.avant) === exclusionSelectorKey(proprietaire.selector) && r.com2usId === proprietaire.com2usId);
  return rattachement ? { ...proprietaire, selector: rattachement.apres } : proprietaire;
}

// La même garde protège la restauration et l'écriture : liste active,
// appartenance, exemplaire affiché, identité enregistrée et espèce résolue.
export function validerProprietaireCriteres(
  proprietaire: ProprietaireCriteresOptimizer | null,
  listes: { lists: OptimizerList[]; members: OptimizerListMember[]; activeListId: string | null; identities: Map<string, IdentiteMembreOptimizer> },
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
  const identite = listes.identities.get(cleMemoireMembre(proprietaire.listId, proprietaire.selector));
  if (identite && identite.com2usId !== resolu?.monster.com2usId) return null;
  return resolu?.monster.com2usId === proprietaire.com2usId
    && String(resolu.monster.id) === affichage.selectedId ? proprietaire : null;
}
