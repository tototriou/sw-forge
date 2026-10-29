import { type Dispatch, type SetStateAction } from 'react';
import { ConfirmDialog } from '../../../ui';
import { type UseOptimizerLists } from '../../../hooks/useOptimizerLists';
import { type ExclusionSelector } from '../../../lib/optimizerExclusion';

export interface ConfirmationsLiberationProps {
  lists: UseOptimizerLists;
  releaseConfirm: { listId: string; selector: ExclusionSelector } | null;
  setReleaseConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector } | null>>;
  releaseArtifactsConfirm: { listId: string; selector: ExclusionSelector } | null;
  setReleaseArtifactsConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector } | null>>;
  releaseAllConfirm: string | null;
  setReleaseAllConfirm: Dispatch<SetStateAction<string | null>>;
  removeMemberConfirm: { listId: string; selector: ExclusionSelector } | null;
  setRemoveMemberConfirm: Dispatch<SetStateAction<{ listId: string; selector: ExclusionSelector } | null>>;
}

export default function ConfirmationsLiberation({
  lists,
  releaseConfirm,
  setReleaseConfirm,
  releaseArtifactsConfirm,
  setReleaseArtifactsConfirm,
  releaseAllConfirm,
  setReleaseAllConfirm,
  removeMemberConfirm,
  setRemoveMemberConfirm,
}: ConfirmationsLiberationProps) {
  return (
    <>
      {/* Confirmations de libération — demande explicite de l'utilisateur.
          `Modale` est portalisée : sa position dans l'arbre n'a pas
          d'importance pour son rendu. */}
      {releaseConfirm && (
        <ConfirmDialog
          titre="Libérer ce build validé ?"
          message="Ces 6 runes ET la paire d’artéfacts redeviendront disponibles pour les autres monstres de cette liste."
          libelleAction="Libérer"
          onConfirm={() => {
            lists.releaseBuild(releaseConfirm.listId, releaseConfirm.selector);
            setReleaseConfirm(null);
          }}
          onCancel={() => setReleaseConfirm(null)}
        />
      )}
      {releaseArtifactsConfirm && (
        <ConfirmDialog
          titre="Libérer les artéfacts validés ?"
          message="Cette paire redeviendra disponible pour les autres monstres de cette liste. Les 6 runes du build restent réservées."
          libelleAction="Libérer"
          onConfirm={() => {
            lists.releaseArtifacts(releaseArtifactsConfirm.listId, releaseArtifactsConfirm.selector);
            setReleaseArtifactsConfirm(null);
          }}
          onCancel={() => setReleaseArtifactsConfirm(null)}
        />
      )}
      {releaseAllConfirm && (
        <ConfirmDialog
          titre="Libérer toutes les runes validées de cette liste ?"
          message="Tous les builds validés de cette liste seront libérés d'un coup — leurs runes redeviennent disponibles."
          libelleAction="Tout libérer"
          destructif
          onConfirm={() => {
            lists.releaseAllInList(releaseAllConfirm);
            setReleaseAllConfirm(null);
          }}
          onCancel={() => setReleaseAllConfirm(null)}
        />
      )}
      {removeMemberConfirm && (
        <ConfirmDialog
          titre="Retirer ce monstre de la liste ?"
          message="Ses runes validées seront aussi libérées — elles redeviennent disponibles pour les recherches des autres monstres de cette liste."
          libelleAction="Retirer"
          destructif
          onConfirm={() => {
            lists.removeMember(removeMemberConfirm.listId, removeMemberConfirm.selector);
            setRemoveMemberConfirm(null);
          }}
          onCancel={() => setRemoveMemberConfirm(null)}
        />
      )}
    </>
  );
}
