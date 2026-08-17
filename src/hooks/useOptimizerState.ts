import { Dispatch, SetStateAction, useState } from 'react';
import { StatKey } from '../lib/effects';
import { Objective, SlotFilterPresetKey } from '../lib/runeBuildOptim';
import { ExclusionSelector } from '../lib/optimizerExclusion';
import { ArtifactKind } from '../types';
import { useBuildOptimSearch } from './useBuildOptimSearch';

export type { SlotFilterPresetKey };
export type OptimizerSortKey = StatKey | Objective;
// Choix de statistique principale d'artéfact pour la recherche : les trois
// valeurs de jeu standard (voir ARTIFACT_MAIN dans effects.ts — 100=PV,
// 101=ATQ, 102=DEF), plus deux cas hors de cette table : `'equipped'`
// (défaut — reprend l'artéfact RÉELLEMENT équipé de ce type, comportement
// historique inchangé) et `'none'` (aucun artéfact supposé dans cet
// emplacement, même si un est réellement équipé).
export type ArtifactMainChoice = 'equipped' | 'none' | 100 | 101 | 102;

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
  // Même principe qu'`excludeBase`, un étage plus tôt : ignorer entièrement
  // la contribution des artéfacts (PV/ATQ/DEF plats, voir ARTIFACT_MAIN dans
  // effects.ts) dans le calcul — pas seulement dans son AFFICHAGE. Décoché
  // par défaut : comportement historique inchangé (les artéfacts RÉELLEMENT
  // équipés comptent toujours, comme avant l'ajout de cette bascule).
  ignoreArtifacts: boolean;
  setIgnoreArtifacts: Dispatch<SetStateAction<boolean>>;
  // Statistique principale supposée pour chacun des deux emplacements
  // d'artéfact (Attribut/Type, voir ARTIFACT_KINDS dans types.ts) — n'a
  // d'effet que si `ignoreArtifacts` est décoché. Clé absente = `'equipped'`
  // (défaut, voir ArtifactMainChoice) : permet d'hypothéquer un artéfact
  // différent de celui réellement possédé, SANS avoir à le posséder pour de
  // vrai (ex. « et si j'avais un artéfact PV+1500 au lieu de mon DEF+100
  // actuel ? »).
  artifactMainByKind: Partial<Record<ArtifactKind, ArtifactMainChoice>>;
  setArtifactMainByKind: Dispatch<SetStateAction<Partial<Record<ArtifactKind, ArtifactMainChoice>>>>;
  mainStatsBySlot: Partial<Record<2 | 4 | 6, number[]>>;
  setMainStatsBySlot: Dispatch<SetStateAction<Partial<Record<2 | 4 | 6, number[]>>>>;
  objective: Objective;
  setObjective: Dispatch<SetStateAction<Objective>>;
  exploreAll: boolean;
  setExploreAll: Dispatch<SetStateAction<boolean>>;
  // Exclusion MANUELLE, en plus d'`exploreAll` (se superpose, ne le
  // remplace pas) — voir lib/optimizerExclusion.ts. Vide par défaut.
  excludedSelectors: ExclusionSelector[];
  setExcludedSelectors: Dispatch<SetStateAction<ExclusionSelector[]>>;
  // Toggle « Prioriser les stats les plus difficiles » (piste B, voir
  // spec/outils/optimizer/ « Suite — piste B gatée derrière un
  // paramètre ») — désactivé par défaut, lu par `handleSearch` au moment du
  // clic sur « Rechercher », pas un bouton séparé qui lance sa propre
  // recherche.
  adaptiveTrancheWeighting: boolean;
  setAdaptiveTrancheWeighting: Dispatch<SetStateAction<boolean>>;
  // Toggle « Rechercher jusqu'à épuisement complet » — désactivé par défaut,
  // lu par `handleSearch` comme `adaptiveTrancheWeighting` ci-dessus. Retire
  // la limite de temps de 10 minutes (`maxMs: Infinity`, déjà supporté par le
  // moteur — voir OptimizerSection.tsx) ; ne touche PAS au plafond de 100 000
  // candidats collectés, qui reste une limite indépendante.
  exhaustiveSearch: boolean;
  setExhaustiveSearch: Dispatch<SetStateAction<boolean>>;
  sortBy: OptimizerSortKey;
  setSortBy: Dispatch<SetStateAction<OptimizerSortKey>>;
  showAdvanced: boolean;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
  slotFilterPreset: SlotFilterPresetKey;
  setSlotFilterPreset: Dispatch<SetStateAction<SlotFilterPresetKey>>;
  // Palier 2 du diagnostic « 0 résultat » (voir `rankBlockingConditions` dans
  // runeBuildOptim.ts) : identifie quelle condition posée libère le plus de
  // candidats si on la retire seule. Décoché par défaut — coûte N passes de
  // pré-filtrage (N = nombre de conditions posées) au lieu d'une seule pour
  // le palier 1 (`diagnoseFeasibility`, toujours actif) : un coût réel, même
  // s'il reste sans commune mesure avec une recherche complète, donc rendu
  // optionnel plutôt qu'automatique.
  diagnoseBlockingEnabled: boolean;
  setDiagnoseBlockingEnabled: Dispatch<SetStateAction<boolean>>;
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
  // (décoché par défaut, puis revenu sur cochée) — voir spec/outils/optimizer/.
  const [excludeBase, setExcludeBase] = useState(true);
  const [ignoreArtifacts, setIgnoreArtifacts] = useState(false);
  const [artifactMainByKind, setArtifactMainByKind] = useState<Partial<Record<ArtifactKind, ArtifactMainChoice>>>({});
  const [mainStatsBySlot, setMainStatsBySlot] = useState<Partial<Record<2 | 4 | 6, number[]>>>({});
  const [objective, setObjective] = useState<Objective>('efficience');
  const [exploreAll, setExploreAll] = useState(true);
  const [excludedSelectors, setExcludedSelectors] = useState<ExclusionSelector[]>([]);
  const [adaptiveTrancheWeighting, setAdaptiveTrancheWeighting] = useState(false);
  const [exhaustiveSearch, setExhaustiveSearch] = useState(false);
  const [sortBy, setSortBy] = useState<OptimizerSortKey>('efficience');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slotFilterPreset, setSlotFilterPreset] = useState<SlotFilterPresetKey>('moyen');
  const [diagnoseBlockingEnabled, setDiagnoseBlockingEnabled] = useState(false);
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
    ignoreArtifacts,
    setIgnoreArtifacts,
    artifactMainByKind,
    setArtifactMainByKind,
    mainStatsBySlot,
    setMainStatsBySlot,
    objective,
    setObjective,
    exploreAll,
    setExploreAll,
    excludedSelectors,
    setExcludedSelectors,
    adaptiveTrancheWeighting,
    setAdaptiveTrancheWeighting,
    exhaustiveSearch,
    setExhaustiveSearch,
    sortBy,
    setSortBy,
    showAdvanced,
    setShowAdvanced,
    slotFilterPreset,
    setSlotFilterPreset,
    diagnoseBlockingEnabled,
    setDiagnoseBlockingEnabled,
    stoppedManually,
    setStoppedManually,
    openRuneKey,
    setOpenRuneKey,
    search,
  };
}
