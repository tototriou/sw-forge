import { useCallback, useEffect, useState } from 'react';
import { Monster, MonstersPayload } from '../types';

export type LoadState = 'loading' | 'live' | 'demo' | 'error';

export interface UseMonsters {
  monsters: Monster[];
  loadState: LoadState;
  generatedAt: string | null;
  reload: () => void;
}

// Charge public/data/monsters.json (même origine → jamais de CORS) et expose
// l'état de chargement. Partagé par le Bestiaire et la page RTA.
export function useMonsters(): UseMonsters {
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/monsters.json`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: MonstersPayload = await res.json();
      setMonsters(payload.monsters);
      setGeneratedAt(payload.meta?.generated_at ?? null);
      setLoadState(payload.meta?.source === 'live' ? 'live' : 'demo');
    } catch (err) {
      console.error('Impossible de charger data/monsters.json', err);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { monsters, loadState, generatedAt, reload };
}
