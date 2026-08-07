import { useCallback, useEffect, useState } from 'react';
import { ElementKey, Monster } from '../types';

const STORAGE_KEY = 'sw-forge-custom-monsters-v1';

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return `custom-${c.randomUUID()}`;
  return `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export interface CustomLead {
  stat: string; // "Attack Speed", "Attack Power", "HP"…
  amount: number;
  area: 'General' | 'Element'; // toutes cibles, ou allié du même élément
}

function makeMonster(
  name: string,
  element: ElementKey,
  speed: number,
  lead?: CustomLead | null
): Monster {
  return {
    id: newId(),
    com2usId: null,
    name: name.trim() || 'Monstre perso',
    element,
    stars: null,
    naturalStars: null,
    secondAwaken: false,
    image: null,
    stats: {
      hp: null,
      attack: null,
      defense: null,
      speed,
      critRate: null,
      critDamage: null,
      resistance: null,
      accuracy: null,
    },
    leaderSkill:
      lead && lead.amount > 0 && lead.stat
        ? {
            stat: lead.stat,
            amount: lead.amount,
            area: lead.area,
            element: lead.area === 'Element' ? element : null,
          }
        : null,
  };
}

function load(): Monster[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // On garde uniquement les entrées plausibles.
    return parsed.filter(
      (m) => m && typeof m === 'object' && typeof m.id === 'string' && m.stats && typeof m.name === 'string'
    ) as Monster[];
  } catch {
    return [];
  }
}

export interface UseCustomMonsters {
  customMonsters: Monster[];
  addCustomMonster: (
    name: string,
    element: ElementKey,
    speed: number,
    lead?: CustomLead | null
  ) => Monster;
  removeCustomMonster: (id: string) => void;
}

// Monstres créés à la main (ex. sorties récentes absentes des données SWARFARM).
// Persistés dans le navigateur et fusionnés au reste des monstres.
export function useCustomMonsters(): UseCustomMonsters {
  const [customMonsters, setCustomMonsters] = useState<Monster[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customMonsters));
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, [customMonsters]);

  const addCustomMonster = useCallback(
    (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => {
      const mon = makeMonster(name, element, speed, lead);
      setCustomMonsters((list) => [...list, mon]);
      return mon;
    },
    []
  );

  const removeCustomMonster = useCallback((id: string) => {
    setCustomMonsters((list) => list.filter((m) => String(m.id) !== String(id)));
  }, []);

  return { customMonsters, addCustomMonster, removeCustomMonster };
}
