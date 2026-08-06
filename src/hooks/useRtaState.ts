import { useCallback, useEffect, useState } from 'react';
import { RtaState, RtaEntry, RTA_UNASSIGNED, RTA_OTHER, RTA_DEFAULT_SECTIONS } from '../types';

const STORAGE_KEY = 'sky-arena-rta-v1';

function defaultState(): RtaState {
  return { sections: [...RTA_DEFAULT_SECTIONS], entries: {} };
}

function load(): RtaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<RtaState>;
    const sections = Array.isArray(parsed.sections) ? parsed.sections : [...RTA_DEFAULT_SECTIONS];
    // « Autre » est une section permanente : on la garantit toujours présente.
    if (!sections.includes(RTA_OTHER)) sections.push(RTA_OTHER);
    const entries: Record<string, RtaEntry> = {};
    if (parsed.entries && typeof parsed.entries === 'object') {
      for (const [id, e] of Object.entries(parsed.entries)) {
        if (!e || typeof e !== 'object') continue;
        entries[id] = {
          monsterId: id,
          section: typeof e.section === 'string' ? e.section : RTA_UNASSIGNED,
          runeSpeed: typeof e.runeSpeed === 'number' ? e.runeSpeed : null,
        };
      }
    }
    return { sections, entries };
  } catch {
    return defaultState();
  }
}

export interface UseRtaState {
  state: RtaState;
  addMonster: (id: string) => void;
  removeMonster: (id: string) => void;
  moveMonster: (id: string, section: string) => void;
  setRuneSpeed: (id: string, value: number | null) => void;
  addSection: (key: string) => void;
  removeSection: (key: string) => void;
  importEntries: (items: { monsterId: string; runeSpeed: number | null }[]) => void;
  clearAll: () => void;
}

export function useRtaState(): UseRtaState {
  const [state, setState] = useState<RtaState>(load);

  // Persistance : tout changement est sauvegardé dans le navigateur.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota plein ou stockage indisponible : on ignore silencieusement */
    }
  }, [state]);

  const addMonster = useCallback((id: string) => {
    setState((s) => {
      if (s.entries[id]) return s; // déjà présent → une seule carte par monstre
      return {
        ...s,
        entries: { ...s.entries, [id]: { monsterId: id, section: RTA_UNASSIGNED, runeSpeed: null } },
      };
    });
  }, []);

  const removeMonster = useCallback((id: string) => {
    setState((s) => {
      if (!s.entries[id]) return s;
      const entries = { ...s.entries };
      delete entries[id];
      return { ...s, entries };
    });
  }, []);

  const moveMonster = useCallback((id: string, section: string) => {
    setState((s) => {
      const e = s.entries[id];
      if (!e || e.section === section) return s;
      return { ...s, entries: { ...s.entries, [id]: { ...e, section } } };
    });
  }, []);

  const setRuneSpeed = useCallback((id: string, value: number | null) => {
    setState((s) => {
      const e = s.entries[id];
      if (!e) return s;
      return { ...s, entries: { ...s.entries, [id]: { ...e, runeSpeed: value } } };
    });
  }, []);

  const addSection = useCallback((key: string) => {
    setState((s) => {
      if (!key || s.sections.includes(key)) return s; // n'existe pas déjà
      // On insère avant « Autre » pour garder le fourre-tout en dernier.
      const idx = s.sections.indexOf(RTA_OTHER);
      const sections = [...s.sections];
      if (idx === -1) sections.push(key);
      else sections.splice(idx, 0, key);
      return { ...s, sections };
    });
  }, []);

  const removeSection = useCallback((key: string) => {
    setState((s) => {
      if (key === RTA_OTHER || !s.sections.includes(key)) return s;
      // Les monstres de la section supprimée retournent en « Non classé ».
      const entries = { ...s.entries };
      for (const [id, e] of Object.entries(entries)) {
        if (e.section === key) entries[id] = { ...e, section: RTA_UNASSIGNED };
      }
      return { sections: s.sections.filter((k) => k !== key), entries };
    });
  }, []);

  // Import en masse (depuis un compte) : ajoute les nouveaux monstres en
  // « Non classé » avec leur vitesse de runes ; met à jour la vitesse des
  // monstres déjà présents (sans changer leur section).
  const importEntries = useCallback(
    (items: { monsterId: string; runeSpeed: number | null }[]) => {
      setState((s) => {
        const entries = { ...s.entries };
        for (const it of items) {
          const existing = entries[it.monsterId];
          if (existing) {
            entries[it.monsterId] = { ...existing, runeSpeed: it.runeSpeed };
          } else {
            entries[it.monsterId] = {
              monsterId: it.monsterId,
              section: RTA_UNASSIGNED,
              runeSpeed: it.runeSpeed,
            };
          }
        }
        return { ...s, entries };
      });
    },
    []
  );

  const clearAll = useCallback(() => setState(defaultState()), []);

  return {
    state,
    addMonster,
    removeMonster,
    moveMonster,
    setRuneSpeed,
    addSection,
    removeSection,
    importEntries,
    clearAll,
  };
}
