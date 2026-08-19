import { useMemo } from 'react';
import { Monster } from '../types';

// Filtre par nom (sous-chaîne, insensible à la casse), plafonné à
// `maxResults` — même logique que MonsterGearPicker.tsx/RuneExclusionPicker.tsx
// avaient chacun réimplémentée à l'identique (revue de code externe,
// duplication). Générique sur tout item portant un `.monster` (les deux
// items concernés, `GearedMonster` et `ExclusionCandidate`, en ont un).
// Requête vide → aucun résultat (pas « tout » — même comportement que les
// deux pickers avant extraction, la liste ne s'ouvre qu'une fois une saisie
// commencée).
const MAX_RESULTS = 25;

export function useNameFilteredResults<T extends { monster: Monster }>(items: T[], query: string, maxResults = MAX_RESULTS): T[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: T[] = [];
    for (const it of items) {
      if (it.monster.name.toLowerCase().includes(q)) {
        out.push(it);
        if (out.length >= maxResults) break;
      }
    }
    return out;
  }, [items, query, maxResults]);
}
