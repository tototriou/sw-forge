import { useCallback, useEffect, useState } from 'react';
import {
  ExclusionSelector,
  OptimizerList,
  OptimizerListMember,
  ValidatedBuild,
  exclusionSelectorKey,
} from '../lib/optimizerExclusion';
import { loadLocal, saveLocal, usePersistence } from './usePersistence';
import type { CriteresOptimizer } from '../lib/criteresOptimizer';
import type { ExclusionSourceData } from '../lib/optimizerExclusion';
import { enregistrerIdentiteMembre } from '../lib/optimizerRattachement';
import {
  OPTIMIZER_MEMBERS_STORAGE_KEY, cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer,
  enregistrerMemoireMembre, validerEquipesOptimizer, retirerRejetsOptimizer,
  type DonneesMembresOptimizer, type EquipeOptimizer, type MemoireMembreOptimizer, type StockageOptimizer,
} from '../lib/optimizerMemberStorage';

// « Listes de travail » de l'Optimizer (docs/02-app/optimizer/
// § Créer, valider et réserver dans une liste) :
// pas un tableau plat de runes validées, mais des listes. Trois pièces
// d'état, une seule persistance : les listes
// elles-mêmes (créées/renommées/supprimées par l'utilisateur, AUCUNE fixe —
// voir OptimizerList), leurs membres (« Inclure à la liste », zone C) et les
// builds validés (runes réservées, scopées PAR LISTE — voir ValidatedBuild).
// ⚠️ Volontairement séparé de `useOptimizerState` : ce dernier documente
// explicitement n'écrire JAMAIS sur disque (saisie d'écran, perdue à chaque
// rechargement) — cet état-ci, à l'inverse, DOIT survivre à un rechargement
// (un flux de plusieurs dizaines de minutes ne doit pas perdre le travail
// déjà fait), même statut que la prépa RTA/les équipes de siège.
const STORAGE_KEY = 'swblacksmith-optimizer-lists-v1';

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
  if (s.source === 'unowned') return typeof s.monsterId === 'string' && (s.copie === undefined
    || typeof s.copie === 'number' && Number.isSafeInteger(s.copie) && s.copie >= 2);
  return false;
}

export function loadOptimizerLists(): StoredState {
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
        const { listId, selector, runeIds, artifactIds, runesManquantes } = item as {
          listId?: unknown;
          selector?: unknown;
          runeIds?: unknown;
          artifactIds?: unknown;
          runesManquantes?: unknown;
        };
        if (typeof listId !== 'string' || !listIds.has(listId)) continue;
        if (!isSelector(selector)) continue;
        if (!Array.isArray(runeIds) || !runeIds.every((id) => typeof id === 'number')) continue;
        // ⚠️ `artifactIds` ABSENT d'un build validé avant ce champ : on garde
        // le build sans paire plutôt que de le jeter. Le perdre pour ça serait
        // une perte de données pure — la même faute qu'une revérification trop
        // stricte a déjà commise ici (voir `revalidateBuilds`).
        const arts = Array.isArray(artifactIds) && artifactIds.every((id) => typeof id === 'number') ? artifactIds : undefined;
        const absentes = Array.isArray(runesManquantes) && runesManquantes.every(id => typeof id === 'number' && runeIds.includes(id)) ? runesManquantes : undefined;
        validated.push({ listId, selector, runeIds, ...(arts ? { artifactIds: arts } : {}), ...(absentes?.length ? { runesManquantes: absentes } : {}) });
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
  addMember: (listId: string, selector: ExclusionSelector, com2usId: number) => void;
  /** Retire un monstre de la liste — libère AUSSI son build validé s'il en avait un (jamais de réservation orpheline, invisible dans « Monstres de la liste »). */
  removeMember: (listId: string, selector: ExclusionSelector) => void;
  validated: ValidatedBuild[];
  /** Valide un build pour cet exemplaire DANS cette liste — REMPLACE l'entrée existante pour la même paire (liste, sélecteur) s'il y en a une. */
  validateBuild: (listId: string, selector: ExclusionSelector, runeIds: number[], artifactIds: number[], com2usId: number) => void;
  releaseBuild: (listId: string, selector: ExclusionSelector) => void;
  /** Rend les artéfacts d’un build validé, ses runes restant réservées. */
  releaseArtifacts: (listId: string, selector: ExclusionSelector) => void;
  /** Réserve une paire d’artéfacts sur un build DÉJÀ validé, sans toucher aux runes. */
  validateArtifacts: (listId: string, selector: ExclusionSelector, artifactIds: number[]) => void;
  releaseAllInList: (listId: string) => void;
  memories: DonneesMembresOptimizer['memories'];
  identities: DonneesMembresOptimizer['identities'];
  teams: EquipeOptimizer[];
  listContents: DonneesMembresOptimizer['listContents'];
  rapportStockage: string[];
  rejets: DonneesMembresOptimizer['rejets'];
  writeMemory: (membre: Omit<MemoireMembreOptimizer, 'criteres'>, criteres: CriteresOptimizer, data: ExclusionSourceData) => void;
  setTeams: (teams: EquipeOptimizer[]) => void;
  /** Applique en une mise à jour le résultat de la revérification commune. */
  replaceAfterRevalidation: (stockage: StockageOptimizer) => void;
}

interface MemberStorage extends DonneesMembresOptimizer { rapport: string[]; raw: string | null }
interface State extends StoredState { memberStorage: MemberStorage }
function loadState(): State {
  const raw = loadLocal(OPTIMIZER_MEMBERS_STORAGE_KEY);
  const lu = lireMembresOptimizer(raw);
  return { ...loadOptimizerLists(), memberStorage: { ...lu, raw } };
}

export function useOptimizerLists(): UseOptimizerLists {
  const [state, setState] = useState<State>(loadState);

  const persist = usePersistence();
  useEffect(() => {
    const { memberStorage, ...historique } = state;
    saveLocal(STORAGE_KEY, JSON.stringify(historique));
    // Garder le texte initial préserve ses octets et ses futurs champs inconnus
    // tant qu'aucun geste ou réimport ne modifie le stockage.
    saveLocal(OPTIMIZER_MEMBERS_STORAGE_KEY, memberStorage.raw ?? ecrireMembresOptimizer(memberStorage));
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
      ...s,
      lists: s.lists.filter((l) => l.id !== id),
      members: s.members.filter((m) => m.listId !== id),
      validated: s.validated.filter((v) => v.listId !== id),
      activeListId: s.activeListId === id ? null : s.activeListId,
      memberStorage: { ...s.memberStorage, raw: null,
        rejets: retirerRejetsOptimizer(s.memberStorage.rejets, id),
        memories: new Map([...s.memberStorage.memories].filter(([, m]) => m.listId !== id)),
        identities: new Map([...s.memberStorage.identities].filter(([, m]) => m.listId !== id)),
        listContents: new Map([...s.memberStorage.listContents].filter(([listId]) => listId !== id)),
        teams: s.memberStorage.teams.filter((e) => e.listId !== id) },
    }));
  }, []);

  const addMember = useCallback((listId: string, selector: ExclusionSelector, com2usId: number) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => {
      const already = s.members.some((m) => m.listId === listId && exclusionSelectorKey(m.selector) === key);
      if (already) return s;
      return { ...s, members: [...s.members, { listId, selector }], memberStorage: { ...s.memberStorage, raw: null,
        identities: enregistrerIdentiteMembre(s.memberStorage.identities, { listId, selector, com2usId }) } };
    });
  }, []);

  const removeMember = useCallback((listId: string, selector: ExclusionSelector) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => ({
      ...s,
      members: s.members.filter((m) => !(m.listId === listId && exclusionSelectorKey(m.selector) === key)),
      validated: s.validated.filter((v) => !(v.listId === listId && exclusionSelectorKey(v.selector) === key)),
      memberStorage: { ...s.memberStorage, raw: null,
        rejets: retirerRejetsOptimizer(s.memberStorage.rejets, listId, selector),
        memories: new Map([...s.memberStorage.memories].filter(([k]) => k !== cleMemoireMembre(listId, selector))),
        identities: new Map([...s.memberStorage.identities].filter(([k]) => k !== cleMemoireMembre(listId, selector))),
        teams: s.memberStorage.teams.flatMap((e) => {
          if (e.listId !== listId) return [e];
          const members = e.members.filter((m) => exclusionSelectorKey(m) !== key);
          const { leader, ...reste } = e;
          return members.length < 2 ? [] : [{ ...reste, members, ...(leader && exclusionSelectorKey(leader) !== key ? { leader } : {}) }];
        }) },
    }));
  }, []);

  const validateBuild = useCallback((listId: string, selector: ExclusionSelector, runeIds: number[], artifactIds: number[], com2usId: number) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => ({
      ...s,
      memberStorage: { ...s.memberStorage, raw: null,
        identities: enregistrerIdentiteMembre(s.memberStorage.identities, { listId, selector, com2usId }) },
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

  /**
   * Rend les ARTÉFACTS d’un build validé, en gardant ses runes réservées.
   *
   * ⚠️ **Pas de symétrie avec les runes, et c’est voulu.** Libérer les
   * runes en gardant les artéfacts n’aurait aucun sens : `runeIds` porte
   * TOUJOURS 6 ids (voir `ValidatedBuild`), la réservation existe POUR ce
   * runage — sans lui il n’y a plus de build à qui les artéfacts
   * appartiendraient. L’inverse, si : on garde le runage planifié et on rend
   * la paire disponible pour un autre monstre de la liste.
   *
   * ⚠️ Sans effet si aucun build n’est validé pour cet exemplaire — rien à
   * rendre, et surtout aucune entrée créée au passage.
   */
  const releaseArtifacts = useCallback((listId: string, selector: ExclusionSelector) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => ({
      ...s,
      validated: s.validated.map((v) =>
        v.listId === listId && exclusionSelectorKey(v.selector) === key ? { ...v, artifactIds: [] } : v
      ),
    }));
  }, []);

  /**
   * Réserve une PAIRE d’artéfacts sans toucher aux runes.
   *
   * ⚠️ **N’agit que sur un build DÉJÀ validé.** Valider des artéfacts pour
   * un exemplaire sans runage réservé fabriquerait une entrée à `runeIds`
   * vide, que tout le reste du code lit comme « 6 runes » (badge « Validé »,
   * `otherValidatedRuneIds`, `revalidateBuilds`). L’appelant doit donc
   * valider le build d’abord — l’écran ne propose ce geste que dans ce cas.
   *
   * ⚠️ Même filtre que `validateBuild` sur les ids ≤ 0 : une pièce
   * SYNTHÉTIQUE n’existe pas dans le compte, la mémoriser ferait croire à un
   * artéfact qu’on ne possède pas et le réserverait pour rien.
   */
  const validateArtifacts = useCallback((listId: string, selector: ExclusionSelector, artifactIds: number[]) => {
    const key = exclusionSelectorKey(selector);
    setState((s) => ({
      ...s,
      validated: s.validated.map((v) =>
        v.listId === listId && exclusionSelectorKey(v.selector) === key
          ? { ...v, artifactIds: artifactIds.filter((id) => id > 0) }
          : v
      ),
    }));
  }, []);

  const releaseAllInList = useCallback((listId: string) => {
    setState((s) => ({ ...s, validated: s.validated.filter((v) => v.listId !== listId) }));
  }, []);

  const replaceAfterRevalidation = useCallback((stockage: StockageOptimizer) => {
    setState((s) => {
      if (stockage.members === s.members && stockage.validated === s.validated
        && stockage.identities === s.memberStorage.identities
        && stockage.memories === s.memberStorage.memories && stockage.teams === s.memberStorage.teams
        && stockage.listContents === s.memberStorage.listContents && stockage.rejets === s.memberStorage.rejets) return s;
      return { ...s, members: stockage.members, validated: stockage.validated,
        memberStorage: { ...s.memberStorage, raw: null, rejets: stockage.rejets, memories: new Map(stockage.memories), teams: stockage.teams,
          identities: new Map(stockage.identities),
          listContents: new Map(stockage.listContents) } };
    });
  }, []);

  const writeMemory = useCallback((membre: Omit<MemoireMembreOptimizer, 'criteres'>, criteres: CriteresOptimizer, data: ExclusionSourceData) => {
    setState((s) => {
      if (s.activeListId !== membre.listId || !s.lists.some(l => l.id === membre.listId)
        || !s.members.some((m) => cleMemoireMembre(m.listId, m.selector) === cleMemoireMembre(membre.listId, membre.selector))) {
        return { ...s, memberStorage: { ...s.memberStorage, rapport: [...s.memberStorage.rapport, 'Mémoire non écrite : membre absent de la liste.'] } };
      }
      const r = enregistrerMemoireMembre(s.memberStorage.memories, membre, criteres, data);
      return { ...s, memberStorage: { ...s.memberStorage, memories: r.memories,
        rejets: r.rapport.length ? s.memberStorage.rejets : retirerRejetsOptimizer(s.memberStorage.rejets, membre.listId, membre.selector),
        raw: r.rapport.length ? s.memberStorage.raw : null, rapport: [...s.memberStorage.rapport, ...r.rapport] } };
    });
  }, []);

  const setTeams = useCallback((teams: EquipeOptimizer[]) => {
    setState((s) => {
      const r = validerEquipesOptimizer(teams);
      const horsListe = teams.some((e) => !s.lists.some((l) => l.id === e.listId)
        || e.members.some((sel) => !s.members.some((m) => cleMemoireMembre(m.listId, m.selector) === cleMemoireMembre(e.listId, sel))));
      const rapport = [...r.rapport, ...(horsListe ? ['Équipe non écrite : membre absent de la liste.'] : [])];
      return { ...s, memberStorage: { ...s.memberStorage, teams: rapport.length ? s.memberStorage.teams : structuredClone(r.teams),
        raw: rapport.length ? s.memberStorage.raw : null, rapport: [...s.memberStorage.rapport, ...rapport] } };
    });
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
    releaseArtifacts,
    validateArtifacts,
    releaseAllInList,
    memories: state.memberStorage.memories,
    identities: state.memberStorage.identities,
    teams: state.memberStorage.teams,
    listContents: state.memberStorage.listContents,
    rapportStockage: state.memberStorage.rapport,
    rejets: state.memberStorage.rejets,
    writeMemory,
    setTeams,
    replaceAfterRevalidation,
  };
}
