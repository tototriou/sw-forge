import { useSyncExternalStore } from 'react';

// **Paramètre global de l'application** (menu ⚙, comme la mesure Efficience/
// Score ou l'overcap) : le speed tuning doit-il TOUJOURS poser en face une copie
// du monstre le plus rapide de l'équipe ?
//
// ⚠️ **Un réglage d'application, pas une préférence de page** : c'est une façon
// de travailler (« je tune toujours contre mon propre plus rapide »), pas un
// filtre qu'on change d'un écran à l'autre. Il vient donc ici, et le
// SettingsMenu le montre à côté des autres — jamais dupliqué en interrupteur sur
// la page (voir SettingsMenu.tsx).
//
// Sans lui, l'analyse ne pose la référence QUE lorsque personne n'est en face ;
// avec lui, elle la pose même face à une composition importée — l'adversaire de
// référence devient un repère permanent, à côté des vrais adversaires.
//
// Store externe (comme useRuneMetric) : le choix doit se propager EN DIRECT aux
// écrans montés. Persisté dans localStorage — un réglage d'application doit
// survivre au rechargement.
const STORAGE_KEY = 'sw-forge-adversaire-reference-v1';

// Défaut = désactivé : l'activer AJOUTE un monstre en face, et rien ne doit
// apparaître dans une composition sans qu'on l'ait demandé.
function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let current: boolean = load();
const listeners = new Set<() => void>();

export function setAdversaireReference(v: boolean) {
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

export function useAdversaireReference(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current
  );
}
