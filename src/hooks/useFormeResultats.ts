import { useSyncExternalStore } from 'react';

// La forme des résultats de l'Optimizer au bureau : des cartes, ou un tableau
// d'une ligne par build (docs/02-app/optimizer/ecran/resultats.md, « Cartes
// ou tableau »). Le téléphone garde les cartes et ne lit pas ce réglage.
//
// ⚠️ Un RÉGLAGE, comme le thème ou la mesure : choisi au-dessus des
// résultats, il est écrit même sans l'accord de conservation
// (`CLES_DE_REGLAGE`, usePersistence.ts) — ce n'est pas une donnée de
// l'utilisateur. Store externe : un second écran monté (écran partagé) suit
// le changement en direct.
export type FormeResultats = 'cartes' | 'tableau';

export const CLE_FORME_RESULTATS = 'swblacksmith-optimizer-resultats-forme-v1';
export const FORMES_RESULTATS: readonly FormeResultats[] = ['cartes', 'tableau'];

// Tout ce qui n'est pas reconnu retombe sur les cartes, la forme historique.
export function lireFormeResultats(brut: string | null): FormeResultats {
  return brut === 'tableau' ? 'tableau' : 'cartes';
}

function load(): FormeResultats {
  try {
    return lireFormeResultats(localStorage.getItem(CLE_FORME_RESULTATS));
  } catch {
    return 'cartes';
  }
}

let current: FormeResultats = load();
const listeners = new Set<() => void>();

export function setFormeResultats(forme: FormeResultats) {
  if (forme === current) return;
  current = forme;
  try {
    localStorage.setItem(CLE_FORME_RESULTATS, forme);
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useFormeResultats(): FormeResultats {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
