// Fiches de compétences (`public/data/skills/<com2usId>.json`) lues DEPUIS LE
// DISQUE, pour les scripts Node.
//
// ⚠️ **Ne remplace pas `chargerDetail`** (src/lib/monsterSkills.ts), qui reste
// le seul point d'entrée de l'APPLICATION : celle-ci passe par `fetch` et
// `import.meta.env.BASE_URL`, deux choses qui n'existent pas dans un script.
// Même données, même forme, deux transports — c'est le transport seul qui est
// dupliqué ici, jamais la moindre logique métier (le profil de dégâts se
// calcule des deux côtés avec `src/lib/damage.ts`, source unique).
//
// Mis en cache comme `monstersData.ts` : un script qui rejoue une recette lit
// la même fiche plusieurs fois (résolution du sort, puis stats à privilégier).

import { existsSync, readFileSync } from 'fs';
import { DetailMonstre } from '../../src/lib/monsterSkills';

const cache = new Map<number, DetailMonstre | null>();

// ⚠️ On mémorise AUSSI les absences (`null`), même raison que le cache de
// `chargerDetail` : un monstre sans fiche relirait le disque à chaque appel.
export function loadMonsterSkills(com2usId: number | null): DetailMonstre | null {
  if (com2usId == null) return null;
  if (cache.has(com2usId)) return cache.get(com2usId) ?? null;
  const chemin = `public/data/skills/${com2usId}.json`;
  if (!existsSync(chemin)) {
    cache.set(com2usId, null);
    return null;
  }
  try {
    const d = JSON.parse(readFileSync(chemin, 'utf8')) as DetailMonstre;
    cache.set(com2usId, d);
    return d;
  } catch {
    // Fiche illisible : traitée comme absente, jamais une exception — même
    // parti pris que `chargerDetail` (une fiche indisponible n'est pas une
    // erreur d'application).
    cache.set(com2usId, null);
    return null;
  }
}
