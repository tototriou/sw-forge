// Charge et met en cache `public/data/monsters.json` — UNE SEULE lecture/
// parsage par exécution de script, quel que soit le nombre d'appelants.
// Centralisé ici après une revue de code externe (point 2, duplication) :
// `loadMonster.ts` reparsait ce même fichier trois fois indépendamment
// (`loadMonsterNames`/`loadMonsterSpeeds`/`loadAllMonstersByCom2us`), et
// `deckMonster.ts` (préexistant) une quatrième fois — chacune de ces
// fonctions dérive maintenant du même parsage mis en cache.

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
