import { useCallback, useEffect, useState } from 'react';
import {
  ExclusionSelector,
  OptimizerList,
  OptimizerListMember,
  ValidatedBuild,
  exclusionSelectorKey,
} from '../lib/optimizerExclusion';
import { saveLocal, usePersistence } from './usePersistence';

// « Listes de travail » de l'Optimizer (Lot 3, voir spec/outils/optimizer/
// historique-import-monstres-a-optimiser.md) — remplace useOptimizerValidatedBuilds
// (Lot 2), qui ne portait qu'un tableau plat de runes validées, sans notion
// de liste. Trois pièces d'état, une seule persistance : les listes
// elles-mêmes (créées/renommées/supprimées par l'utilisateur, AUCUNE fixe —
// voir OptimizerList), leurs membres (« Inclure à la liste », zone C) et les
// builds validés (runes réservées, scopées PAR LISTE — voir ValidatedBuild).
// ⚠️ Volontairement séparé de `useOptimizerState` : ce dernier documente
// explicitement n'écrire JAMAIS sur disque (saisie d'écran, perdue à chaque
// rechargement) — cet état-ci, à l'inverse, DOIT survivre à un rechargement
// (un flux de plusieurs dizaines de minutes ne doit pas perdre le travail
// déjà fait), même statut que la prépa RTA/les équipes de siège.
const STORAGE_KEY = 'sw-forge-optimizer-lists-v1';

interface StoredState {
  lists: OptimizerList[];
  members: OptimizerListMember[];
  validated: ValidatedBuild[];
  activeListId: string | null;
}

function defaultState(): StoredState {
  return { lists: [], members: [], validated: [], activeListId: null };
}

function isSelector(v: unknown): v is ExclusionSelector {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (s.source === 'box') return typeof s.unitKey === 'string';
  if (s.source === 'rta') return typeof s.monsterId === 'string';
  if (s.source === 'siege-defense' || s.source === 'siege-offense') {
    return typeof s.teamId === 'string' && typeof s.slotIndex === 'number';
  }
  if (s.source === 'unowned') return typeof s.monsterId === 'string';
  return false;
}

function load(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const listIds = new Set<string>();
    const lists: OptimizerList[] = [];
    if (Array.isArray(parsed.lists)) {
      for (const item of parsed.lists) {
        if (!item || typeof item !== 'object') continue;
        const { id, name } = item as { id?: unknown; name?: unknown };
        if (typeof id !== 'string' || typeof name !== 'string') continue;
        lists.push({ id, name });
        listIds.add(id);
      }
    }
    const members: OptimizerListMember[] = [];
    if (Array.isArray(parsed.members)) {
      for (const item of parsed.members) {
        if (!item || typeof item !== 'object') continue;
        const { listId, selector } = item as { listId?: unknown; selector?: unknown };
        if (typeof listId !== 'string' || !listIds.has(listId)) continue;
        if (!isSelector(selector)) continue;
        members.push({ listId, selector });
      }
    }
    const validated: ValidatedBuild[] = [];
    if (Array.isArray(parsed.validated)) {
      for (const item of parsed.validated) {
        if (!item || typeof item !== 'object') continue;
        const { listId, selector, runeIds, artifactIds } = item as {
          listId?: unknown;
          selector?: unknown;
          runeIds?: unknown;
          artifactIds?: unknown;
        };
        if (typeof listId !== 'string' || !listIds.has(listId)) continue;
        if (!isSelector(selector)) continue;
        if (!Array.isArray(runeIds) || !runeIds.every((id) => typeof id === 'number')) continue;
        // ⚠️ `artifactIds` ABSENT d'un build validé avant ce champ : on garde
        // le build sans paire plutôt que de le jeter. Le perdre pour ça serait
        // une perte de données pure — la même faute qu'une revérification trop
        // stricte a déjà commise ici (voir `revalidateBuilds`).
        const arts = Array.isArray(artifactIds) && artifactIds.every((id) => typeof id === 'number') ? artifactIds : undefined;
        validated.push({ listId, selector, runeIds, ...(arts ? { artifactIds: arts } : {}) });
      }
    }
    const activeListId = typeof parsed.activeListId === 'string' && listIds.has(parsed.activeListId) ? parsed.activeListId : null;
    return { lists, members, validated, activeListId };
  } catch {
    return defaultState();
  }
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `list_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export interface UseOptimizerLists {
  lists: OptimizerList[];
  activeListId: string | null;
  setActiveListId: (id: string | null) => void;
  /** Crée une liste, la rend active, renvoie son id (pour y ajouter un membre dans le même geste). */
  createList: (name: string) => string;
  renameList: (id: string, name: string) => void;
  /** Supprime la liste ET tout ce qui lui appartient (membres, builds validés). */
  deleteList: (id: string) => void;
  members: OptimizerListMember[];
  addMember: (listId: string, selector: ExclusionSelector) => void;
  /** Retire un monstre de la liste — libère AUSSI son build validé s'il en avait un (jamais de réservation orpheline, invisible dans « Monstres de la liste »). */
  removeMember: (listId: string, selector: ExclusionSelector) => void;
  validated: ValidatedBuild[];
  /** Valide un build pour cet exemplaire DANS cette liste — REMPLACE l'entrée existante pour la même paire (liste, sélecteur) s'il y en a une. */
  validateBuild: (listId: string, selector: ExclusionSelector, runeIds: number[], artifactIds: number[]) => void;
  releaseBuild: (listId: string, selector: ExclusionSelector) => void;
  releaseAllInList: (listId: string) => void;
  /** Remplace membres + validés — utilisé UNIQUEMENT par App.tsx pour purger les entrées invalides après un réimport de compte (voir revalidateBuilds/revalidateMembers, optimizerExclusion.ts). */
  replaceMembersAndValidated: (members: OptimizerListMember[], validated: ValidatedBuild[]) => void;
}

export function useOptimizerLists(): UseOptimizerLists {
  const [state, setState] = useState<StoredState>(load);

  const persist = usePersistence();
  useEffect(() => {
    saveLocal(STORAGE_KEY, JSON.stringify(state));
  }, [state, persist]);

  const setActiveListId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeListId: id }));
  }, []);

  const createList = useCallback((name: string) => {
    const id = newId();
    setState((s) => ({ ...s, lists: [...s.lists, { id, name }], activeListId: id }));
    return id;
  }, []);

  const renameList = useCallback((id: string, name: string) => {
    setState((s) => ({ ...s, lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)) }));
  }, []);

  const deleteList = useCallback((id: string) => {
    setState((s) => ({
      lists: s.lists.filter((l) => l.id !== id),
      members: s.members.filter((m) => m.listId !== id),
      validated: s.validated.filter((v) => v.listId !== id),
      activeListId: s.activeListId === id ? null : s.activeListId,
    }));
  }, []);

  const addMember = useCallback((listId: string, selector: ExclusionSelector) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => {
      const already = s.members.some((m) => m.listId === listId && exclusionSelectorKey(m.selector) === key);
      if (already) return s;
      return { ...s, members: [...s.members, { listId, selector }] };
    });
  }, []);

  const removeMember = useCallback((listId: string, selector: ExclusionSelector) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => ({
      ...s,
      members: s.members.filter((m) => !(m.listId === listId && exclusionSelectorKey(m.selector) === key)),
      validated: s.validated.filter((v) => !(v.listId === listId && exclusionSelectorKey(v.selector) === key)),
    }));
  }, []);

  const validateBuild = useCallback((listId: string, selector: ExclusionSelector, runeIds: number[], artifactIds: number[] = []) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => ({
      ...s,
      // Valider inclut aussi implicitement le monstre dans la liste — pas
      // besoin d'un « Inclure » préalable pour pouvoir valider.
      members: s.members.some((m) => m.listId === listId && exclusionSelectorKey(m.selector) === key)
        ? s.members
        : [...s.members, { listId, selector }],
      validated: [
        ...s.validated.filter((v) => !(v.listId === listId && exclusionSelectorKey(v.selector) === key)),
        // ⚠️ Les ids ≤ 0 désignent une pièce SYNTHÉTIQUE, absente du compte :
        // la mémoriser ferait croire à un artéfact qu'on ne possède pas, et la
        // réserverait pour rien.
        { listId, selector, runeIds, artifactIds: artifactIds.filter((id) => id > 0) },
      ],
    }));
  }, []);

  const releaseBuild = useCallback((listId: string, selector: ExclusionSelector) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => ({
      ...s,
      validated: s.validated.filter((v) => !(v.listId === listId && exclusionSelectorKey(v.selector) === key)),
    }));
  }, []);

  const releaseAllInList = useCallback((listId: string) => {
    setState((s) => ({ ...s, validated: s.validated.filter((v) => v.listId !== listId) }));
  }, []);

  const replaceMembersAndValidated = useCallback((members: OptimizerListMember[], validated: ValidatedBuild[]) => {
    setState((s) => ({ ...s, members, validated }));
  }, []);

  return {
    lists: state.lists,
    activeListId: state.activeListId,
    setActiveListId,
    createList,
    renameList,
    deleteList,
    members: state.members,
    addMember,
    removeMember,
    validated: state.validated,
    validateBuild,
    releaseBuild,
    releaseAllInList,
    replaceMembersAndValidated,
  };
}
