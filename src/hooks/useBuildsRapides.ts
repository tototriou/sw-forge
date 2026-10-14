import { useSyncExternalStore } from 'react';
import {
  BUILDS_PAR_COMBO_DEFAUT,
  BUILDS_PAR_COMBO_MAX,
  BUILDS_PAR_COMBO_MIN,
  COMBOS_PAR_DEFAUT,
  ComboVitesse,
  cleCombo,
  comboValide,
} from '../lib/buildsRapides';

// Ce qu'affiche « Builds les plus rapides » au Résumé des runes : les
// combinaisons de sets, dans leur ordre, et le nombre de builds par
// combinaison. Voir docs/02-app/compte/feat-runes/resume.md.
//
// ⚠️ Un RÉGLAGE, posé dans les Paramètres (demande explicite), et non un
// filtre de page : on choisit une fois les combinaisons qu'on joue. Il est donc
// écrit même sans l'accord de conservation (`CLES_DE_REGLAGE`,
// usePersistence.ts), comme le thème ou la mesure de score.
//
// Store externe, comme useRuneMetric : le Résumé déjà monté suit le changement
// en direct.
export interface ReglageBuildsRapides {
  combos: ComboVitesse[];
  nombre: number; // builds par combinaison
}

const STORAGE_KEY = 'swblacksmith-builds-rapides-v1';

export const REGLAGE_BUILDS_RAPIDES_DEFAUT: ReglageBuildsRapides = {
  combos: COMBOS_PAR_DEFAUT,
  nombre: BUILDS_PAR_COMBO_DEFAUT,
};

// Relit une valeur venue du stockage, ou d'une session chargée : tout ce qui
// n'est pas reconnu retombe sur le défaut, combinaison par combinaison. Une
// combinaison en double n'est gardée qu'une fois.
export function lireReglageBuildsRapides(brut: string | null): ReglageBuildsRapides {
  if (brut === null) return REGLAGE_BUILDS_RAPIDES_DEFAUT;
  try {
    const v = JSON.parse(brut) as { combos?: unknown; nombre?: unknown };
    let combos = REGLAGE_BUILDS_RAPIDES_DEFAUT.combos;
    if (Array.isArray(v.combos)) {
      const vus = new Set<string>();
      combos = [];
      for (const c of v.combos as { quatre?: unknown; deux?: unknown }[]) {
        if (!comboValide(c) || vus.has(cleCombo(c))) continue;
        vus.add(cleCombo(c));
        combos.push({ quatre: c.quatre, deux: c.deux });
      }
    }
    const nombre =
      typeof v.nombre === 'number' && Number.isFinite(v.nombre)
        ? Math.min(BUILDS_PAR_COMBO_MAX, Math.max(BUILDS_PAR_COMBO_MIN, Math.round(v.nombre)))
        : BUILDS_PAR_COMBO_DEFAUT;
    return { combos, nombre };
  } catch {
    return REGLAGE_BUILDS_RAPIDES_DEFAUT;
  }
}

function load(): ReglageBuildsRapides {
  try {
    return lireReglageBuildsRapides(localStorage.getItem(STORAGE_KEY));
  } catch {
    return REGLAGE_BUILDS_RAPIDES_DEFAUT;
  }
}

let current: ReglageBuildsRapides = load();
const listeners = new Set<() => void>();

export function setReglageBuildsRapides(v: ReglageBuildsRapides) {
  current = lireReglageBuildsRapides(JSON.stringify(v));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* stockage indisponible : on ignore */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBuildsRapides(): ReglageBuildsRapides {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
