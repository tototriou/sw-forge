import { useSyncExternalStore } from 'react';
import { StatKey, CAPPED_STATS } from '../lib/effects';

// **Paramètre global de l'application** (menu ⚙, comme la mesure Efficience/
// Score) — pas une préférence par page : un réglage qui concerne plusieurs
// affichages vient ICI, jamais dupliqué en sélecteur sur chaque page (voir
// SettingsMenu.tsx). Décide si le TOTAL affiché de Taux Crit/RES/Précision
// peut dépasser 100 % (leur plafond réel en jeu — voir CAPPED_STATS) ou si
// l'affichage s'arrête à 100 % pile.
//
// ⚠️ Un réglage d'AFFICHAGE, pas de calcul : `computeStats` continue de
// renvoyer le total BRUT (nécessaire à la recherche de l'Optimizer, qui ne
// doit surtout pas exclure un build dont le total brut dépasse 100 % — c'est
// un résultat légitime, voir spec/outils/optimizer/). Seule la VALEUR
// MONTRÉE est bornée, jamais la donnée elle-même.
//
// Store externe (comme useRuneMetric) : le choix doit se propager EN DIRECT
// à tous les affichages montés (fiche de monstre en RTA/Siège/Optimizer,
// résultats de l'Optimizer, recommandations de siège), pas seulement au
// prochain montage. Persisté dans localStorage — un réglage d'application
// doit survivre au rechargement.
const STORAGE_KEY = 'sw-forge-overcap-display-v1';

// Défaut = affiché (comportement historique, non bornée) : activer ce
// réglage ne doit surprendre personne, seul le DÉSACTIVER change quelque
// chose à l'écran.
function load(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

let current: boolean = load();
const listeners = new Set<() => void>();

export function setOvercapDisplay(v: boolean) {
  if (v === current) return;
  current = v;
  try {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch {
    /* stockage indisponible : on ignore */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useOvercapDisplay(): boolean {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

// Valeur à AFFICHER pour un total, selon le réglage : bornée à 100 % pour les
// stats plafonnées (Taux Crit/RES/Précision) quand l'overcap est masqué,
// inchangée sinon (stats non plafonnées, ou overcap affiché).
export function displayedTotal(key: StatKey, total: number, showOvercap: boolean): number {
  if (!showOvercap && CAPPED_STATS.has(key)) return Math.min(total, 100);
  return total;
}
