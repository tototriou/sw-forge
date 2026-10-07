// Charge et met en cache `public/data/monsters.json` — UNE SEULE lecture/
// parsage par exécution de script, quel que soit le nombre d'appelants.
// Centralisé ici : `loadMonster.ts`
// (`loadMonsterNames`/`loadMonsterSpeeds`/`loadAllMonstersByCom2us`) et
// `deckMonster.ts` ne reparsent pas ce même fichier chacun de leur côté —
// chacune de ces fonctions dérive du même parsage mis en cache.

import { readFileSync } from 'fs';
import { Monster } from '../../src/types';

let cache: Monster[] | null = null;

export function loadMonstersList(): Monster[] {
  if (!cache) {
    const raw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
    cache = Array.isArray(raw) ? raw : raw.monsters;
  }
  return cache!;
}
