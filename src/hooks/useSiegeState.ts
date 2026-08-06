import { useCallback, useEffect, useState } from 'react';
import { SiegeState, SiegeTeam, SiegeSlot } from '../types';

// Défense et offense de siège = deux listes d'équipes indépendantes.
export type SiegeSide = 'offense' | 'defense';

const OLD_STORAGE_KEY = 'sw-forge-siege-v1'; // ancienne clé unique (→ migrée vers défense)
const storageKey = (side: SiegeSide) => `sw-forge-siege-${side}-v1`;

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `t_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function emptySlot(): SiegeSlot {
  return { monsterId: null, runeSpeed: null, tick: 0 };
}

function newTeam(): SiegeTeam {
  return { id: newId(), slots: [emptySlot(), emptySlot(), emptySlot()], lead: 0 };
}

function load(side: SiegeSide): SiegeState {
  try {
    let raw = localStorage.getItem(storageKey(side));
    // Migration : l'ancien état unique devient la DÉFENSE.
    if (raw === null && side === 'defense') raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return { teams: [] };
    const parsed = JSON.parse(raw) as Partial<SiegeState>;
    if (!Array.isArray(parsed.teams)) return { teams: [] };
    const teams: SiegeTeam[] = parsed.teams.map((t) => {
      // Migration : ancien tick d'équipe → tick par défaut de chaque slot.
      const legacyTick = typeof (t as { tick?: number })?.tick === 'number' ? (t as { tick?: number }).tick! : 0;
      const slots: SiegeSlot[] = [0, 1, 2].map((i) => {
        const s = t?.slots?.[i];
        return {
          monsterId: s && typeof s.monsterId === 'string' ? s.monsterId : null,
          runeSpeed: s && typeof s.runeSpeed === 'number' ? s.runeSpeed : null,
          tick: s && typeof s.tick === 'number' ? s.tick : legacyTick,
        };
      });
      return {
        id: typeof t?.id === 'string' ? t.id : newId(),
        slots,
        lead: typeof t?.lead === 'number' ? t.lead : 0,
      };
    });
    return { teams };
  } catch {
    return { teams: [] };
  }
}

export interface UseSiegeState {
  state: SiegeState;
  addTeam: () => void;
  removeTeam: (teamId: string) => void;
  setSlotMonster: (teamId: string, idx: number, monsterId: string) => void;
  clearSlot: (teamId: string, idx: number) => void;
  setSlotRune: (teamId: string, idx: number, value: number | null) => void;
  setLead: (teamId: string, lead: number) => void;
  setSlotTick: (teamId: string, idx: number, tick: number) => void;
  swapSlots: (teamId: string, from: number, to: number) => void;
  importTeams: (
    teams: { slots: { monsterId: string | null; runeSpeed: number | null }[] }[],
    replace: boolean
  ) => void;
  clearAll: () => void;
}

export function useSiegeState(side: SiegeSide): UseSiegeState {
  const [state, setState] = useState<SiegeState>(() => load(side));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(side), JSON.stringify(state));
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, [state, side]);

  // Applique une modification à une équipe donnée.
  const updateTeam = useCallback((teamId: string, fn: (t: SiegeTeam) => SiegeTeam) => {
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) => (t.id === teamId ? fn(t) : t)),
    }));
  }, []);

  const updateSlot = useCallback(
    (teamId: string, idx: number, fn: (sl: SiegeSlot) => SiegeSlot) => {
      updateTeam(teamId, (t) => ({
        ...t,
        slots: t.slots.map((sl, i) => (i === idx ? fn(sl) : sl)),
      }));
    },
    [updateTeam]
  );

  const addTeam = useCallback(() => setState((s) => ({ ...s, teams: [...s.teams, newTeam()] })), []);

  const removeTeam = useCallback(
    (teamId: string) => setState((s) => ({ ...s, teams: s.teams.filter((t) => t.id !== teamId) })),
    []
  );

  const setSlotMonster = useCallback(
    (teamId: string, idx: number, monsterId: string) =>
      updateSlot(teamId, idx, (sl) => ({ ...sl, monsterId })),
    [updateSlot]
  );

  const clearSlot = useCallback(
    (teamId: string, idx: number) => updateSlot(teamId, idx, () => emptySlot()),
    [updateSlot]
  );

  const setSlotRune = useCallback(
    (teamId: string, idx: number, value: number | null) =>
      updateSlot(teamId, idx, (sl) => ({ ...sl, runeSpeed: value })),
    [updateSlot]
  );

  const setLead = useCallback(
    (teamId: string, lead: number) => updateTeam(teamId, (t) => ({ ...t, lead })),
    [updateTeam]
  );

  const setSlotTick = useCallback(
    (teamId: string, idx: number, tick: number) =>
      updateSlot(teamId, idx, (sl) => ({ ...sl, tick })),
    [updateSlot]
  );

  const swapSlots = useCallback(
    (teamId: string, from: number, to: number) =>
      updateTeam(teamId, (t) => {
        if (from === to) return t;
        const slots = [...t.slots];
        [slots[from], slots[to]] = [slots[to], slots[from]];
        return { ...t, slots };
      }),
    [updateTeam]
  );

  // Import de decks (depuis un export de compte) : chaque deck devient une
  // équipe de 3 slots (slot 0 = leader). `replace` remplace les équipes
  // existantes, sinon on ajoute à la suite.
  const importTeams = useCallback(
    (
      teams: { slots: { monsterId: string | null; runeSpeed: number | null }[] }[],
      replace: boolean
    ) => {
      setState((s) => {
        const built: SiegeTeam[] = teams.map((t) => {
          const slots: SiegeSlot[] = [0, 1, 2].map((i) => {
            const sl = t.slots[i];
            return {
              monsterId: sl && typeof sl.monsterId === 'string' ? sl.monsterId : null,
              runeSpeed: sl && typeof sl.runeSpeed === 'number' ? sl.runeSpeed : null,
              tick: 0,
            };
          });
          return { id: newId(), slots, lead: 0 };
        });
        return { teams: replace ? built : [...s.teams, ...built] };
      });
    },
    []
  );

  const clearAll = useCallback(() => setState({ teams: [] }), []);

  return {
    state,
    addTeam,
    removeTeam,
    setSlotMonster,
    clearSlot,
    setSlotRune,
    setLead,
    setSlotTick,
    swapSlots,
    importTeams,
    clearAll,
  };
}
