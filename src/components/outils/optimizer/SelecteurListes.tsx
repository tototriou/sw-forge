import { type ReactNode } from 'react';
import OptimizerListPicker from '../OptimizerListPicker';
import { type UseOptimizerLists } from '../../../hooks/useOptimizerLists';

export interface SelecteurListesProps {
  lists: UseOptimizerLists;
  memberCounts: Record<string, number>;
  action?: ReactNode;
}

// Le sélecteur de listes branché tel quel sur `lists` : naviguer entre les
// listes ou les gérer ne remet jamais la recherche à zéro.
export default function SelecteurListes({ lists, memberCounts, action }: SelecteurListesProps) {
  return (
    <OptimizerListPicker
      action={action}
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
