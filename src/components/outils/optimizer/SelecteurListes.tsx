import { type ReactNode } from 'react';
import OptimizerListPicker from '../OptimizerListPicker';
import { type UseOptimizerLists } from '../../../hooks/useOptimizerLists';

export interface SelecteurListesProps {
  lists: UseOptimizerLists;
  memberCounts: Record<string, number>;
  action?: ReactNode;
  // Au bureau, « Liste active » prend le style d'un titre de section
  // (décision de l'utilisateur) ; le téléphone garde l'étiquette.
  titreSection?: boolean;
}

// Le sélecteur de listes branché tel quel sur `lists` : naviguer entre les
// listes ou les gérer ne remet jamais la recherche à zéro.
export default function SelecteurListes({ lists, memberCounts, action, titreSection }: SelecteurListesProps) {
  return (
    <OptimizerListPicker
      action={action}
      titreSection={titreSection}
      lists={lists.lists}
      activeListId={lists.activeListId}
      memberCounts={memberCounts}
      listContents={lists.listContents}
      onSelect={lists.setActiveListId}
      onCreate={lists.createList}
      onEdit={lists.editList}
      onDelete={lists.deleteList}
    />
  );
}
