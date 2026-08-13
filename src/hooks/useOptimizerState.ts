import { Dispatch, SetStateAction, useState } from 'react';
import { StatKey } from '../lib/effects';
import { Objective } from '../lib/runeBuildOptim';
import { useBuildOptimSearch } from './useBuildOptimSearch';

export type SlotFilterPresetKey = 'bas' | 'moyen' | 'haut' | 'extreme';
export type OptimizerSortKey = StatKey | Objective;

// Toute la SAISIE de l'écran Outils → Optimizer, remontée ici (instancié dans
// App.tsx, jamais démonté) pour survivre à un changement d'onglet : comme les
// autres pages de l'app, OptimizerSection est démontée à chaque navigation —
// un `useState` local y perdrait tout à la moindre visite d'un autre onglet.
// Même principe que useRtaState/useSiegeState, mais SANS écriture disque :
// cette saisie n'a rien à voir avec le compte importé ni le système de
// conservation (voir usePersistence) — elle ne doit survivre qu'à la session
// en cours (onglet fermé = repartir de zéro), pas à un rechargement de page.
export interface OptimizerState {
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  comboSets: string[];
  setComboSets: Dispatch<SetStateAction<string[]>>;
  setPickerInvalid: boolean;
  setSetPickerInvalid: Dispatch<SetStateAction<boolean>>;
  minStats: Partial<Record<StatKey, number>>;
  setMinStats: Dispatch<SetStateAction<Partial<Record<StatKey, number>>>>;
  maxStats: Partial<Record<StatKey, number>>;
  setMaxStats: Dispatch<SetStateAction<Partial<Record<StatKey, number>>>>;
  excludeBase: boolean;
  setExcludeBase: Dispatch<SetStateAction<boolean>>;
  mainStatsBySlot: Partial<Record<2 | 4 | 6, number[]>>;
  setMainStatsBySlot: Dispatch<SetStateAction<Partial<Record<2 | 4 | 6, number[]>>>>;
  objective: Objective;
  setObjective: Dispatch<SetStateAction<Objective>>;
  exploreAll: boolean;
  setExploreAll: Dispatch<SetStateAction<boolean>>;
  sortBy: OptimizerSortKey;
  setSortBy: Dispatch<SetStateAction<OptimizerSortKey>>;
  showAdvanced: boolean;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
  slotFilterPreset: SlotFilterPresetKey;
  setSlotFilterPreset: Dispatch<SetStateAction<SlotFilterPresetKey>>;
  stoppedManually: boolean;
  setStoppedManually: Dispatch<SetStateAction<boolean>>;
  // Rune actuellement ouverte dans un popover de détail, parmi TOUS les
  // résultats affichés — voir BuildCandidateCard.tsx. Une seule à la fois,
  // comme Mon compte → Runes → Optimisation : cliquer une autre rune ferme
  // celle déjà ouverte plutôt que d'empiler les popovers.
  openRuneKey: string | null;
  setOpenRuneKey: Dispatch<SetStateAction<string | null>>;
  search: ReturnType<typeof useBuildOptimSearch>;
}

export function useOptimizerState(): OptimizerState {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comboSets, setComboSets] = useState<string[]>([]);
  const [setPickerInvalid, setSetPickerInvalid] = useState(false);
  const [minStats, setMinStats] = useState<Partial<Record<StatKey, number>>>({});
  const [maxStats, setMaxStats] = useState<Partial<Record<StatKey, number>>>({});
  // ⚠️ Coché par défaut : demande reconfirmée après un premier aller-retour
  // (décoché par défaut, puis revenu sur cochée) — voir spec/outils/optimizer.md.
  const [excludeBase, setExcludeBase] = useState(true);
  const [mainStatsBySlot, setMainStatsBySlot] = useState<Partial<Record<2 | 4 | 6, number[]>>>({});
  const [objective, setObjective] = useState<Objective>('efficience');
  const [exploreAll, setExploreAll] = useState(false);
  const [sortBy, setSortBy] = useState<OptimizerSortKey>('efficience');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slotFilterPreset, setSlotFilterPreset] = useState<SlotFilterPresetKey>('moyen');
  const [stoppedManually, setStoppedManually] = useState(false);
  const [openRuneKey, setOpenRuneKey] = useState<string | null>(null);
  const search = useBuildOptimSearch();

  return {
    selectedId,
    setSelectedId,
    comboSets,
    setComboSets,
    setPickerInvalid,
    setSetPickerInvalid,
    minStats,
    setMinStats,
    maxStats,
    setMaxStats,
    excludeBase,
    setExcludeBase,
    mainStatsBySlot,
    setMainStatsBySlot,
    objective,
    setObjective,
    exploreAll,
    setExploreAll,
    sortBy,
    setSortBy,
    showAdvanced,
    setShowAdvanced,
    slotFilterPreset,
    setSlotFilterPreset,
    stoppedManually,
    setStoppedManually,
    openRuneKey,
    setOpenRuneKey,
    search,
  };
}
