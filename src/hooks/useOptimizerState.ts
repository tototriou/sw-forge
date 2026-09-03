import { Dispatch, SetStateAction, useState } from 'react';
import { StatKey } from '../lib/effects';
import { Objective, SlotFilterPresetKey } from '../lib/runeBuildOptim';
import { DamageSetup, DEFAULT_DAMAGE_SETUP } from '../lib/damage';
import { AutoExclusionScope, ExclusionSelector } from '../lib/optimizerExclusion';
import { ArtifactKind } from '../types';
import { LigneVerrouillee } from '../lib/artifactOptim';
import { useBuildOptimSearch } from './useBuildOptimSearch';

export type { SlotFilterPresetKey };
export type OptimizerSortKey = StatKey | Objective;
// Choix de statistique principale d'artéfact pour la recherche : les trois
// valeurs de jeu standard (voir ARTIFACT_MAIN dans effects.ts — 100=PV,
// 101=ATQ, 102=DEF), plus trois cas hors de cette table : `'equipped'`
// (défaut — reprend l'artéfact RÉELLEMENT équipé de ce type) et `'libre'`
// (chercher parmi TOUS les éligibles, quelle que soit la principale).
//
// ⚠️ `'libre'` n'a de sens qu'avec une recherche d'artéfacts : il n'a été
// ajouté qu'une fois celle-ci construite, pour ne pas laisser une option morte
// dans le sélecteur. Il aligne ce type sur `ChoixPrincipale`
// (artifactOptim.ts), dont il était jusque-là le sous-ensemble.
//
// ⚠️ **`'none'` (laisser l'emplacement vide) a été RETIRÉ.** Un monstre porte
// deux artéfacts ou n'en porte pas : vider UN emplacement pendant que l'autre
// cherche ne correspond à rien en jeu. Et « ne pas compter les artéfacts » se
// dit déjà d'un seul geste avec l'interrupteur, pour les deux emplacements à
// la fois. Les recettes exportées avant ce retrait sont ramenées sur `'libre'`
// à l'import (voir `mainsPourCeCompte`, optimizerRecipe.ts).
export type ArtifactMainChoice = 'equipped' | 'libre' | 100 | 101 | 102;

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
  /**
   * Chercher la meilleure paire d'artéfacts pour chaque build — **activé par
   * défaut**.
   *
   * ⚠️ **Désactivé ne veut PAS dire « sans artéfact ».** Le monstre garde les
   * pièces qu'il porte RÉELLEMENT, avec leurs statistiques : on cesse
   * simplement d'en chercher d'autres. C'est le sens du réglage — « je
   * compose un runage autour des artéfacts que j'ai déjà dessus ».
   *
   * ⚠️ Ce drapeau a été INVERSÉ (il s'appelait `ignoreArtifacts`) et son
   * comportement corrigé : il retirait auparavant TOUTE statistique
   * d'artéfact, ce que son libellé ne disait pas et qui rendait la recherche
   * plus stricte sans raison. La recette exportée garde, elle, le champ
   * `ignoreArtifacts` (format stable) — la conversion se fait à la frontière,
   * voir `exportRecipe`/`importRecipe` (OptimizerSection.tsx).
   */
  optimiserArtefacts: boolean;
  setOptimiserArtefacts: Dispatch<SetStateAction<boolean>>;
  /**
   * La paire retenue suit-elle le TRI affiché, ou l’OBJECTIF de la recherche ?
   * Activé par défaut.
   *
   * ⚠️ **Le tri est une VUE, l’optimisation d’artéfacts une DÉCISION.** Les
   * coupler d’office impose un arbitrage : trier par ATQ pour explorer
   * déplaçait la paire, alors qu’on voulait parfois garder celle qui
   * maximise les PV effectifs. Ce réglage rend l’arbitrage à l’utilisateur.
   *
   * - `true` — la paire suit `sortBy` : « les meilleurs artéfacts pour ce
   *   que je regarde ».
   * - `false` — la paire suit `objective` : « les meilleurs artéfacts pour
   *   ce que j’ai cherché ». La référence est stable pendant toute
   *   l’exploration, donc « Valider les artéfacts » propose la même chose
   *   quel que soit le tri.
   *
   * ⚠️ **Ne désactive PAS l’optimisation** — c’est `optimiserArtefacts` qui
   * le fait. Sans objectif de repli défini, « ne pas recalculer » ne
   * voudrait rien dire : il faut savoir par rapport à QUOI.
   */
  adapterArtefactsAuTri: boolean;
  setAdapterArtefactsAuTri: Dispatch<SetStateAction<boolean>>;
  // Statistique principale EXIGÉE pour chacun des deux emplacements d'artéfact
  // (Attribut/Type, voir ARTIFACT_KINDS dans types.ts) — n'a d'effet que si
  // `optimiserArtefacts` est activé.
  //
  // ⚠️ **Clé absente = `'libre'`**, et c'est la SEULE réponse valable : c'est
  // ce que `candidatsParSorte` (artifactOptim.ts) fait d'une clé absente, et
  // le moteur a le dernier mot. Ce commentaire disait `'equipped'`, le
  // sélecteur l'affichait, et la recherche cherchait pourtant librement —
  // trois sources, deux réponses. Tout ce qui se fiait à l'affichage
  // raisonnait donc sur un état faux.
  //
  // ⚠️ **C'est un FILTRE sur l'inventaire, plus une hypothèse.** Ce réglage a
  // d'abord servi de « et si j'avais un artéfact PV+1500 ? » et fabriquait pour
  // cela une pièce à `subs: []`. En « Dégâts réels », cette pièce faisait
  // calculer les dégâts SANS aucune ligne d'effet, quand « Comme équipé » les
  // comptait : deux réglages voisins, deux modèles de dégâts, sans que rien ne
  // le signale. Le cran désigne donc désormais les artéfacts RÉELLEMENT
  // possédés portant cette principale — et sans aucun, l'emplacement reste
  // vide. Le « et si… » est perdu, en connaissance de cause.
  artifactMainByKind: Partial<Record<ArtifactKind, ArtifactMainChoice>>;
  setArtifactMainByKind: Dispatch<SetStateAction<Partial<Record<ArtifactKind, ArtifactMainChoice>>>>;
  // Sous-propriétés d'artéfact EXIGÉES, avec leur minimum.
  //
  // ⚠️ Le minimum porte sur la PAIRE, pas sur une pièce : une même ligne peut
  // tomber sur les deux artéfacts et ses valeurs s'additionnent. D'où un
  // plafond doublé pour les lignes communes aux deux sortes (200-299) et
  // simple pour les autres — voir `plafondLigne` (artifactOptim.ts), qui borne
  // la saisie.
  //
  // ⚠️ Au plus 8 lignes : un artéfact porte 4 sous-propriétés, la paire 8, en
  // deux moitiés de 4 qui ne se prêtent rien. `budgetEmplacements` dit laquelle
  // des deux déborde.
  lignesVerrouillees: LigneVerrouillee[];
  setLignesVerrouillees: Dispatch<SetStateAction<LigneVerrouillee[]>>;
  mainStatsBySlot: Partial<Record<2 | 4 | 6, number[]>>;
  setMainStatsBySlot: Dispatch<SetStateAction<Partial<Record<2 | 4 | 6, number[]>>>>;
  // Runes IMPOSÉES par emplacement (1..6) — `lockedRunes[slot] = runeId`.
  // Réduit le pool de CE slot à cette seule rune (voir
  // `BuildRequirement.lockedRunes`, runeBuildOptim.ts). Vide = aucun
  // emplacement verrouillé, comportement inchangé.
  // ⚠️ Fait partie des CRITÈRES (remis à zéro par `resetSearch` au
  // changement de monstre) et non des réglages avancés : une rune précise
  // n'a de sens que pour le monstre pour lequel on l'a choisie.
  lockedRunes: Partial<Record<number, number>>;
  setLockedRunes: Dispatch<SetStateAction<Partial<Record<number, number>>>>;
  objective: Objective;
  setObjective: Dispatch<SetStateAction<Objective>>;
  // Réglage de l'objectif « Dégâts réels » (voir spec/outils/degats-reels.md) :
  // quel sort, quel adversaire, quels effets de combat actifs. N'a d'effet
  // que si `objective === 'degats_reels'` — mais reste saisi/conservé même
  // si l'utilisateur change d'objectif puis revient, pour ne pas lui faire
  // ressaisir un adversaire qu'il vient de configurer.
  // ⚠️ Ne contient AUCUNE donnée dérivée du monstre chargé : uniquement de la
  // saisie, pour rester sérialisable dans une recette partagée entre joueurs
  // et traversable par le Web Worker.
  damageSetup: DamageSetup;
  setDamageSetup: Dispatch<SetStateAction<DamageSetup>>;
  // « Exclure les runes déjà utilisées » — DÉCOCHÉ par défaut (inversion du
  // comportement historique de l'ancienne case « Utiliser tout l'inventaire »,
  // qui était COCHÉE par défaut avec la signification opposée : les deux
  // réglages laissent donc le comportement par défaut de la recherche
  // INCHANGÉ — voir OptimizerSection.tsx). Activé, exclut les runes
  // actuellement utilisées dans `excludeUsedScope` (un seul périmètre à la
  // fois) — voir `autoExcludedRuneIds`, optimizerExclusion.ts.
  excludeUsedRunes: boolean;
  setExcludeUsedRunes: Dispatch<SetStateAction<boolean>>;
  // Périmètre de `excludeUsedRunes` — n'a d'effet que si celui-ci est activé.
  // Défaut RTA (le cas d'usage le plus courant : ne pas défaire un build RTA
  // en optimisant un autre monstre).
  excludeUsedScope: AutoExclusionScope;
  setExcludeUsedScope: Dispatch<SetStateAction<AutoExclusionScope>>;
  // Exclusion MANUELLE, en plus d'`excludeUsedRunes` (se superpose, ne le
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
  // Pagination des résultats affichés (1-indexé) — état d'AFFICHAGE pur, pas
  // un paramètre de recherche : n'entre donc jamais dans `OptimizerRecipe`
  // ni les scripts CLI (voir le skill optimizer-field-propagation, dont la
  // checklist recette/CLI ne s'applique PAS à ce champ précisément pour
  // cette raison). Remise à 1 par l'écran à chaque nouvelle recherche ou
  // changement de tri — voir OptimizerSection.tsx.
  resultsPage: number;
  setResultsPage: Dispatch<SetStateAction<number>>;
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
  /**
   * La SEULE pièce d'équipement dont le détail est ouvert, parmi tous les
   * résultats affichés — rune OU artéfact, voir BuildCandidateCard.tsx.
   *
   * ⚠️ **Une seule clé pour les deux**, et c'est le fond du sujet. Les
   * artéfacts avaient leur propre état, LOCAL à chaque carte, au motif qu'ils
   * étaient « identiques d'une carte à l'autre, donc pas besoin d'un état
   * partagé ». Deux conséquences, la première dès l'origine : ouvrir un
   * artéfact puis une rune laissait les DEUX popovers ouverts, les états étant
   * distincts. Et depuis que chaque build porte SA paire, deux cartes
   * différentes pouvaient en ouvrir chacune un — la prémisse « identiques »
   * ayant cessé d'être vraie.
   *
   * Un seul état est la seule forme qui garantit l'exclusivité : deux états,
   * même bien synchronisés, se désynchronisent au premier chemin oublié.
   */
  openDetailKey: string | null;
  setOpenDetailKey: Dispatch<SetStateAction<string | null>>;
  search: ReturnType<typeof useBuildOptimSearch>;
  // Remet à zéro « Critères de recherche » (set, statistique principale
  // imposée, objectif, artéfacts, conditions min/max) ET « Combinaisons
  // trouvées » (résultat, progression, tri, pagination) — PAS les réglages
  // avancés (préfiltrage, exclusions, recherche exhaustive…), qui sont des
  // préférences générales et pas des critères propres au monstre en cours.
  // Appelée par OptimizerSection.tsx quand le monstre recherché change
  // (sélection manuelle, pas un import de recette — celui-ci pose ses
  // propres critères juste après, les effacer aussitôt les perdrait) et par
  // App.tsx quand un nouveau compte est importé (voir son `useEffect` sur
  // `box`) : dans les deux cas, la recherche affichée devient obsolète
  // (autre monstre, autre pool de runes).
  resetSearch: () => void;
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
  // Activee par defaut : chercher les artefacts est le comportement utile,
  // et il ne coute rien a la recherche de runes (temps masque).
  const [optimiserArtefacts, setOptimiserArtefacts] = useState(true);
  // Activé par défaut : ce qu’on affiche reste le meilleur pour ce qu’on
  // regarde. Ne coûte rien sur les tris qu’aucun artéfact ne touche
  // (efficience, VIT, TC, DCC, RES, PRE) — voir `regimeArtefacts`.
  const [adapterArtefactsAuTri, setAdapterArtefactsAuTri] = useState(true);
  const [artifactMainByKind, setArtifactMainByKind] = useState<Partial<Record<ArtifactKind, ArtifactMainChoice>>>({});
  const [lignesVerrouillees, setLignesVerrouillees] = useState<LigneVerrouillee[]>([]);
  const [mainStatsBySlot, setMainStatsBySlot] = useState<Partial<Record<2 | 4 | 6, number[]>>>({});
  const [lockedRunes, setLockedRunes] = useState<Partial<Record<number, number>>>({});
  const [objective, setObjective] = useState<Objective>('efficience');
  const [damageSetup, setDamageSetup] = useState<DamageSetup>(DEFAULT_DAMAGE_SETUP);
  const [excludeUsedRunes, setExcludeUsedRunes] = useState(false);
  const [excludeUsedScope, setExcludeUsedScope] = useState<AutoExclusionScope>('rta');
  const [excludedSelectors, setExcludedSelectors] = useState<ExclusionSelector[]>([]);
  const [adaptiveTrancheWeighting, setAdaptiveTrancheWeighting] = useState(false);
  const [exhaustiveSearch, setExhaustiveSearch] = useState(false);
  const [sortBy, setSortBy] = useState<OptimizerSortKey>('efficience');
  const [resultsPage, setResultsPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slotFilterPreset, setSlotFilterPreset] = useState<SlotFilterPresetKey>('moyen');
  const [diagnoseBlockingEnabled, setDiagnoseBlockingEnabled] = useState(false);
  const [stoppedManually, setStoppedManually] = useState(false);
  const [openDetailKey, setOpenDetailKey] = useState<string | null>(null);
  const search = useBuildOptimSearch();

  function resetSearch() {
    setComboSets([]);
    setSetPickerInvalid(false);
    setMinStats({});
    setMaxStats({});
    setExcludeBase(true);
    setOptimiserArtefacts(true);
    setAdapterArtefactsAuTri(true);
    setArtifactMainByKind({});
    // ⚠️ Remis à zéro au changement de monstre, comme les runes imposées : une
    // ligne verrouillée exclusive à une sorte (« Précision Compétence 3 »)
    // n'a de sens que pour le monstre pour lequel on l'a choisie, et une
    // exigence oubliée d'un monstre précédent rendrait « 0 build » sans que
    // rien ne rappelle d'où elle vient.
    setLignesVerrouillees([]);
    setMainStatsBySlot({});
    // ⚠️ Une rune imposée référence un `runeId` PRÉCIS, choisi pour l'ancien
    // monstre — le garder verrouillerait la recherche du nouveau sur une
    // rune qui n'a plus rien à voir (et la rendrait probablement vide).
    setLockedRunes({});
    setObjective('efficience');
    // ⚠️ Réinitialisé AVEC les autres critères : `skillCom2usId` désigne un
    // sort du monstre PRÉCÉDENT, qui n'existe pas chez le nouveau — le
    // garder afficherait un réglage muet, jamais appliqué.
    setDamageSetup(DEFAULT_DAMAGE_SETUP);
    setSortBy('efficience');
    setResultsPage(1);
    setStoppedManually(false);
    setOpenDetailKey(null);
    search.reset();
  }

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
    optimiserArtefacts,
    setOptimiserArtefacts,
    adapterArtefactsAuTri,
    setAdapterArtefactsAuTri,
    artifactMainByKind,
    setArtifactMainByKind,
    lignesVerrouillees,
    setLignesVerrouillees,
    mainStatsBySlot,
    setMainStatsBySlot,
    lockedRunes,
    setLockedRunes,
    objective,
    setObjective,
    damageSetup,
    setDamageSetup,
    excludeUsedRunes,
    setExcludeUsedRunes,
    excludeUsedScope,
    setExcludeUsedScope,
    excludedSelectors,
    setExcludedSelectors,
    adaptiveTrancheWeighting,
    setAdaptiveTrancheWeighting,
    exhaustiveSearch,
    setExhaustiveSearch,
    sortBy,
    setSortBy,
    resultsPage,
    setResultsPage,
    showAdvanced,
    setShowAdvanced,
    slotFilterPreset,
    setSlotFilterPreset,
    diagnoseBlockingEnabled,
    setDiagnoseBlockingEnabled,
    stoppedManually,
    setStoppedManually,
    openDetailKey,
    setOpenDetailKey,
    search,
    resetSearch,
  };
}
