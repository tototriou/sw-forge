import { useCallback, useEffect, useState } from 'react';
import { RtaState } from '../types';
import { RtaCategory } from './useRtaCategories';
import { loadLocal, saveLocal, usePersistence } from './usePersistence';

// **Point de restauration de la prépa RTA** — l'instantané que pose
// « Sauvegarder » et que rappelle « Reprendre ».
//
// ⚠️ **Ce n'est PAS de la sauvegarde automatique.** La prépa est déjà écrite à
// chaque changement ([useRtaState](useRtaState.ts), [useRtaCategories](useRtaCategories.ts)) :
// on retrouve son écran exactement tel qu'on l'a laissé, sans rien cliquer. Ce
// hook répond à un autre besoin — **essayer sans risque**. On fige un classement
// qui convient, on remanie librement, et on revient au point posé si l'essai ne
// donne rien.
//
// ⚠️ **État ET catégories dans le MÊME instantané.** Les deux vivent dans des
// hooks séparés, mais les catégories désignent des monstres de la prépa :
// restaurer l'un sans l'autre laisserait des anneaux sur des monstres absents,
// ou des monstres qui ont perdu leur étiquette. Une seule clé, un seul geste.
//
// ⚠️ **DEUX instantanés, sur deux clés distinctes :**
//
//   - `backup`  — posé par l'utilisateur (« Sauvegarder ») ;
//   - `importe` — posé automatiquement à chaque import de compte, et jamais
//                 autrement. C'est le point de retour de « Réinitialiser » :
//                 la prépa telle que le fichier l'a produite.
//
// Les confondre ferait qu'importer un compte effacerait sans un mot le point
// qu'on venait de poser — ou que « Réinitialiser » ramènerait à un classement
// remanié à la main, ce qui n'est pas ce qu'il promet.

const KEY = 'sw-forge-rta-backup-v1';
// ⚠️ Clé SÉPARÉE du point manuel : les deux instantanés coexistent.
//
// Le point d'import est posé automatiquement, celui-là est posé par
// l'utilisateur. Les mettre dans la même case ferait qu'importer un compte
// effacerait sans un mot le point qu'on venait de poser — ou l'inverse.
const KEY_IMPORT = 'sw-forge-rta-import-v1';

export interface RtaBackup {
  date: string; // ISO — sert à dire « sauvegardé le … »
  state: RtaState;
  categories: RtaCategory[];
}

// Relecture défensive : le contenu peut venir d'une version antérieure ou avoir
// été bricolé à la main. Un instantané douteux vaut mieux absent que restauré de
// travers — d'où `null` plutôt qu'une réparation approximative.
function load(cle = KEY): RtaBackup | null {
  try {
    const raw = loadLocal(cle);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<RtaBackup>;
    if (!o || typeof o !== 'object') return null;
    const st = o.state;
    if (!st || typeof st !== 'object' || !st.entries || typeof st.entries !== 'object') return null;
    return {
      date: typeof o.date === 'string' ? o.date : '',
      state: {
        sections: Array.isArray(st.sections) ? st.sections.filter((s) => typeof s === 'string') : [],
        entries: st.entries,
      },
      categories: Array.isArray(o.categories) ? o.categories : [],
    };
  } catch {
    return null;
  }
}

export interface UseRtaBackup {
  /** L'instantané en place, ou `null` si aucun n'a jamais été posé. */
  backup: RtaBackup | null;
  /** Fige l'état courant comme nouveau point de retour. */
  sauvegarder: (state: RtaState, categories: RtaCategory[]) => void;
  /** Oublie le point de retour (sans toucher à la prépa). */
  oublier: () => void;
  /**
   * L'état **tel que l'import de compte l'a produit**, ou `null` si aucun compte
   * n'a jamais été importé. C'est le point de retour de « Réinitialiser ».
   */
  importe: RtaBackup | null;
  /** Posé automatiquement à chaque import de compte. */
  poserImport: (state: RtaState, categories: RtaCategory[]) => void;
}

export function useRtaBackup(): UseRtaBackup {
  const [backup, setBackup] = useState<RtaBackup | null>(load);
  const [importe, setImporte] = useState<RtaBackup | null>(() => load(KEY_IMPORT));

  // ⚠️ Écrit à CHAQUE changement d'instantané, et à l'activation de la
  // conservation (`persist` en dépendance) — sinon un point posé avant
  // d'accepter la conservation resterait en mémoire seule et disparaîtrait au
  // rechargement, alors que l'utilisateur croit l'avoir enregistré.
  const persist = usePersistence();
  useEffect(() => {
    if (backup) saveLocal(KEY, JSON.stringify(backup));
  }, [backup, persist]);

  const sauvegarder = useCallback((state: RtaState, categories: RtaCategory[]) => {
    setBackup({ date: new Date().toISOString(), state, categories });
  }, []);

  const oublier = useCallback(() => {
    setBackup(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* stockage indisponible : l'oubli vaut pour la session */
    }
  }, []);

  // Point d'import, écrit sur sa propre clé et à l'activation de la
  // conservation, comme le point manuel.
  useEffect(() => {
    if (importe) saveLocal(KEY_IMPORT, JSON.stringify(importe));
  }, [importe, persist]);

  const poserImport = useCallback((state: RtaState, categories: RtaCategory[]) => {
    setImporte({ date: new Date().toISOString(), state, categories });
  }, []);

  return { backup, sauvegarder, oublier, importe, poserImport };
}
