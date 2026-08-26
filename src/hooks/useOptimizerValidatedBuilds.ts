import { useCallback, useEffect, useState } from 'react';
import { ExclusionSelector, ValidatedBuild, exclusionSelectorKey } from '../lib/optimizerExclusion';
import { saveLocal, usePersistence } from './usePersistence';

// « Monstres déjà runés » (Lot 2, voir spec/outils/optimizer/historique-
// import-monstres-a-optimiser.md) — la liste des builds VALIDÉS par
// l'utilisateur pendant une session d'optimisation, avec leurs runes
// réservées. ⚠️ Volontairement séparé de `useOptimizerState` : ce dernier
// documente explicitement n'écrire JAMAIS sur disque (saisie d'écran, perdue
// à chaque rechargement) — cette liste-ci, à l'inverse, DOIT survivre à un
// rechargement (un flux de plusieurs dizaines de minutes ne doit pas perdre
// le travail déjà validé), même statut que la prépa RTA/les équipes de
// siège. Mélanger les deux invaliderait le commentaire de tête de
// useOptimizerState.ts pour TOUT le reste de son état.
const STORAGE_KEY = 'sw-forge-optimizer-validated-v1';

function isSelector(v: unknown): v is ExclusionSelector {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (s.source === 'box') return typeof s.unitKey === 'string';
  if (s.source === 'rta') return typeof s.monsterId === 'string';
  if (s.source === 'siege-defense' || s.source === 'siege-offense') {
    return typeof s.teamId === 'string' && typeof s.slotIndex === 'number';
  }
  return false;
}

function load(): ValidatedBuild[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ValidatedBuild[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const { selector, runeIds } = item as { selector?: unknown; runeIds?: unknown };
      if (!isSelector(selector)) continue;
      if (!Array.isArray(runeIds) || !runeIds.every((id) => typeof id === 'number')) continue;
      out.push({ selector, runeIds });
    }
    return out;
  } catch {
    return [];
  }
}

export interface UseOptimizerValidatedBuilds {
  builds: ValidatedBuild[];
  // Valide un build pour cet exemplaire — REMPLACE l'entrée existante pour
  // le même sélecteur s'il y en a une (voir ValidatedBuild : un seul build
  // validé par exemplaire, pas un empilement).
  validate: (selector: ExclusionSelector, runeIds: number[]) => void;
  // Libère les runes d'un exemplaire déjà validé.
  release: (selector: ExclusionSelector) => void;
  // Remplace TOUTE la liste — utilisé UNIQUEMENT par App.tsx pour purger les
  // entrées devenues invalides après un réimport de compte (voir
  // `revalidateBuilds`, optimizerExclusion.ts).
  replaceAll: (next: ValidatedBuild[]) => void;
}

export function useOptimizerValidatedBuilds(): UseOptimizerValidatedBuilds {
  const [builds, setBuilds] = useState<ValidatedBuild[]>(load);

  // Conservation : même patron que useRtaState.ts — tout changement est
  // enregistré SI l'utilisateur a accepté (voir usePersistence). `persist`
  // en dépendance pour que l'activation du réglage écrive aussitôt ce qui
  // est déjà en mémoire.
  const persist = usePersistence();
  useEffect(() => {
    saveLocal(STORAGE_KEY, JSON.stringify(builds));
  }, [builds, persist]);

  const validate = useCallback((selector: ExclusionSelector, runeIds: number[]) => {
    const key = exclusionSelectorKey(selector);
    setBuilds((prev) => [...prev.filter((v) => exclusionSelectorKey(v.selector) !== key), { selector, runeIds }]);
  }, []);

  const release = useCallback((selector: ExclusionSelector) => {
    const key = exclusionSelectorKey(selector);
    setBuilds((prev) => prev.filter((v) => exclusionSelectorKey(v.selector) !== key));
  }, []);

  const replaceAll = useCallback((next: ValidatedBuild[]) => {
    setBuilds(next);
  }, []);

  return { builds, validate, release, replaceAll };
}
