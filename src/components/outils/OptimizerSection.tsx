import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import { cleMemoireMembre, type EquipeOptimizer } from '../../lib/optimizerMemberStorage';
import { leadEffectifMembreOptimizer } from '../../lib/equipesOptimizer';
import LeadPill, { STAT_LABEL } from '../siege/LeadPill';
import OptimizerEquipeDialog from './OptimizerEquipeDialog';
import OptimizerCreateListDialog from './OptimizerCreateListDialog';
import {
  Search,
  Square,
  RotateCcw,
  FlaskConical,
  Target,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Wrench,
  Plus,
  CheckCircle2,
  Unlock,
  Trash2,
  Eye,
  Swords,
  Pencil,
} from 'lucide-react';
import { ArtifactDetail, ArtifactKind, ARTIFACT_KINDS, ELEMENTS, GearSet, RECO_STATS, RelicDetail, RuneDetail, Monster, RtaEntry, SiegeTeam } from '../../types';
import { computeStats } from '../../lib/stats';
import ArtifactLinesEditor from './ArtifactLinesEditor';
import { cibleDeLaFile, classementResolu, cleBuild, compositionDePage, compteAffichable, compteConfirme, signatureArtefacts as calculerSignatureArtefacts } from '../../lib/artifactQueue';
import { entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild, runesDuBuild, etatReliqueDuBuild, type EtatRelique } from '../../lib/relicQueue';
import { resoudreContexteRelique } from '../../lib/relicOptim';
import { artifactConditionFloor, relicConditionFloor } from '../../lib/artifactConditionFloor';
import { useArtifactOptimQueue, type ResolutionHorsFil } from '../../hooks/useArtifactOptimQueue';
import { entreesSerialisables } from '../../workers/resolutionBody';
import {
  bornesArtefacts,
  chercherPaires,
  meilleurCumulParLigne,
  type ArtifactSearchParams,
  nombreDePairesRetenues,
  paireRepresentative,
  respecteMinimums,
} from '../../lib/artifactOptim';
import { BoxItem } from '../../lib/applyAccount';
import { regimeArtefacts, regimeEquipementDe, type RegimeArtefacts } from '../../lib/artifactEvaluation';
import { evaluateursArtefactsFiche, parametresArtefactsFiche, piecesFigeesDe, sortesFigeesDe, statsLignesArtefactsEquipables } from '../../lib/artifactFiche';
import {
  CAPPED_STATS,
  RUNE_EFFECT,
  RELIC_MAIN,
  RELIC_MAIN_OPTIONS,
  RELIC_UNIQUE,
  StatKey,
  formatArtifactMain,
  relicUniqueEffectLabel,
  runeSetIconFilter,
  runeEfficiency,
  runeScore,
} from '../../lib/effects';
import RuneIcon from '../RuneIcon';
import {
  BuildRequirement,
  SLOT_MAIN_OPTIONS,
  estimateSearchSpace,
  diagnoseFeasibility,
  StatFeasibility,
  rankBlockingConditions,
  BlockingConditionsDiagnosis,
  NearMiss,
  StatShortfall,
  statTotal,
  objectiveScore,
  avecAurasConditions,
  sortCandidates,
  scoreDuCandidat,
  optionsDeClassement,
  scoreDeReference,
  candidateMetricTotal,
  pvEffectifs,
  aurasPropresParRunes,
  OBJECTIVE_LABELS,
  RealDamageContext,
  SLOT_FILTER_PRESETS,
  ARTIFACT_MAIN_OPTIONS,
  type BuildCandidate,
} from '../../lib/runeBuildOptim';
import { DetailMonstre, chargerDetail } from '../../lib/monsterSkills';
import { rappelsBuffsDePassif } from '../../lib/buffsDePassif';
import { monsterBaseStats } from '../../lib/stats';
import {
  DEFAULT_DAMAGE_SETUP,
  aurasPropresDesRunes,
  damageRelevantStats,
  monsterBonusDegatsConditionnel,
  monsterBonusDegatsSelonCr,
  monsterBonusDegatsSelonDef,
  monsterBonusDegatsSelonVit,
  monsterBonusSiAtqSeuil,
  monsterSeuilsPassifEivor,
  monsterBonusDegatsStackable,
  monsterBonusEcartDef,
  monsterBonusFixeCiblePvMax,
  monsterBonusFixeMaxHpPropre,
  monsterBonusParEffetCible,
  monsterBonusParEffetPropre,
  monsterBonusSacrifice,
  monsterBonusStatFixe,
  monsterCritRateSelonVit,
  monsterCritInterdit,
  monsterCritSiPlusRapide,
  monsterConditionsCombat,
  monsterCombatStatProfiles,
  monsterDamageSkills,
  monsterModificateursVit,
  monsterOffensivePassives,
  resolveDamageSkill,
  resumeCibleDegatsRetenue,
  champsDuCombat,
  CRIT_MODE_LABELS,
  SUMMONER_SKILLS_LABELS,
  type DamageSetup,
  artifactDamageProfile,
} from '../../lib/damage';
import {
  AUTO_EXCLUSION_SCOPES,
  AutoExclusionScope,
  ExclusionCandidate,
  ExclusionSelector,
  ExclusionSource,
  ExclusionSourceData,
  SOURCE_OPTIONS,
  ValidatedBuild,
  autoExcludedRuneIds,
  etatAjoutListe,
  exclusionCandidatesFor,
  exclusionSelectorKey,
  findValidatedBuild,
  libellePuceSource,
  otherValidatedArtifactIds,
  otherValidatedRuneIds,
  runesManquantesDuBuild,
  resolveExcludedRuneIds,
  resolveExclusionEntry,
} from '../../lib/optimizerExclusion';
import { buildOptimizerRecipe, mainsPourCeCompte, parseOptimizerRecipe, relicMainPourCeCompte } from '../../lib/optimizerRecipe';
import { classeMessageImport, delaiEffacementImport, type MessageImport } from '../../lib/messageImport';
import { DUREE_ATTENTION_MS, doitRappeler, echoAurasExternes, guideVersResPre } from '../../lib/aurasExternes';
import { jourLocal, telechargerTexte } from '../../lib/telechargement';
import {
  ArtifactMainChoice,
  OptimizerState,
  OptimizerSortKey,
  RelicMainChoice,
  RelicUniqueChoice,
  DEFAULT_RELIC_MIN_UPGRADE,
  defaultRelicMainChoice,
  criteresApresChangementEspece,
  relicIntentDepuisEtat,
  relicMainChoiceApresChangementExemplaire,
} from '../../hooks/useOptimizerState';
import { UseOptimizerLists } from '../../hooks/useOptimizerLists';
import { useRuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import { useMediaQuery, SOUS_LG, SOUS_SM } from '../../hooks/useMediaQuery';
import GameIcon from '../GameIcon';
import IconeInterdite from '../IconeInterdite';
import MonsterAvatar from '../MonsterAvatar';
import MonsterGear, { type Selected as SelectionGear } from '../MonsterGear';
import ArtifactFrameIcon from '../ArtifactFrameIcon';
import ArtifactSubLigne from '../ArtifactSubLigne';
import { WHEEL_IMG } from '../RuneWheel';
import Segmented from '../../ui/Segmented';
import HelpPopover from '../HelpPopover';
import {
  Bouton,
  BoutonIcone,
  Champ,
  ConfirmDialog,
  Flottant,
  FlottantAuto,
  Interrupteur,
  MobileSheet,
  NumberField,
  Pastille,
  Selecteur,
  ZoneCliquable,
} from '../../ui';
import MonsterSourcePicker from './MonsterSourcePicker';
import OptimizerListPicker from './OptimizerListPicker';
import ExclusionCandidateRow from './ExclusionCandidateRow';
import RuneExclusionPicker from './RuneExclusionPicker';
import SetComboPicker from './SetComboPicker';
import BuildCandidateCard, { PlaceEnVerification, useHauteurDesCartes } from './BuildCandidateCard';
import DamageSetupModale from './DamageSetupModale';
import EtatMonstre from './EtatMonstre';
import { PREFIXE_FICHIER } from '../../marque';

interface Props {
  box: BoxItem[];
  runes: RuneDetail[];
  // Inventaire COMPLET d’artéfacts, pas seulement ceux du monstre affiché :
  // le sélecteur de stat principale FILTRE cet inventaire au lieu
  // d’hypothéquer une pièce sans lignes d’effet (voir `searchArtifacts`).
  artifacts: ArtifactDetail[];
  // Inventaire COMPLET de reliques — même
  // rôle qu'`artifacts` ci-dessus pour la dimension relique : le pool que
  // `resoudreContexteRelique` filtre en mode `recherche`.
  relics: RelicDetail[];
  // Occupation par `rid` — combien d'exemplaires du compte portent CETTE
  // relique, affiché `n / 150` dans le détail d'une relique (AFFICHÉE,
  // jamais bloquante ni exclusive).
  relicUsageById: Record<number, number>;
  // Remontée dans App.tsx (voir useOptimizerState) : la page est démontée à
  // chaque changement d'onglet, comme les autres pages de l'app — sans cette
  // remontée, toute la saisie (monstre, conditions, résultats…) serait
  // perdue au moindre aller-retour vers un autre onglet.
  optimizer: OptimizerState;
  // Pour l'exclusion manuelle de runes (RuneExclusionPicker) — RTA/Siège
  // n'étaient jusqu'ici jamais lus par cet écran, voir optimizerExclusion.ts.
  allMonsters: Monster[];
  rtaEntries: Record<string, RtaEntry>;
  siegeDefenseTeams: SiegeTeam[];
  siegeOffenseTeams: SiegeTeam[];
  // Listes de travail — remonté dans App.tsx pour les mêmes raisons
  // qu'`optimizer` (survit au démontage) ET pour persister sur disque (voir
  // useOptimizerLists.ts), ce qu'`optimizer` lui-même ne fait délibérément
  // pas.
  lists: UseOptimizerLists;
  // Nom du joueur dont le compte est chargé — écrit dans la recette exportée,
  // et comparé à l'import pour reconnaître une recette venue d'AILLEURS (voir
  // `OptimizerRecipe.wizardName`). `null` quand le compte n'en porte pas.
  accountName: string | null;
  // Panneau d'actions mobile « Options » — piloté par le bouton de la barre
  // de nav (voir App.tsx), même patron que RunesOptim.tsx. Réglages avancés
  // et Exclusion de runes y vivent au doigt ; en ligne (cartes) au bureau.
  menuOuvert: boolean;
  onFermerMenu: () => void;
  // Ouvre ce même panneau depuis l'écran — l'ouverture guidée au doigt vers
  // l'interrupteur des auras RES/PRE. Le panneau reste
  // piloté par App.tsx (son bouton vit dans la barre de nav) : l'écran ne
  // peut que le DEMANDER.
  onOuvrirMenu: () => void;
}

// ⚠️ Le plafond de CAPPED_STATS (voir lib/effects.ts) ne s'applique QU'À la
// saisie d'une condition (minimum ou maximum) : la RECHERCHE, elle, ne doit
// surtout pas exclure un build dont la somme brute dépasse 100 % — c'est un
// résultat légitime, seule la demande d'un seuil > 100 % n'a pas de sens.
const CAPPED_100 = CAPPED_STATS;

// « Stats de base exclues » n'affecte QUE ces 4 stats (PV/ATQ/DEF/VIT) : elles
// ont une base qui grandit avec le niveau/l'éveil et que les runes viennent
// gonfler en % ou en plat. Taux Crit/Dgts Crit/RES/Précision partent d'une
// petite valeur d'éveil fixe et restent TOUJOURS en TOTAL, quel que soit ce
// réglage — demandé explicitement : elles « évoluent suivant la valeur
// d'éveil des monstres », pas selon un mode bonus/total.
const BASE_TOGGLE_STATS = new Set<StatKey>(['hp', 'atk', 'def', 'spd']);

const CONFIGURABLE_SLOTS: (2 | 4 | 6)[] = [2, 4, 6];

// Candidats de COMPTE pour une espèce précise, un tableau par source (Box/
// RTA/Défenses siège/Offenses siège) — fonction MODULE (pas un Hook) : appelée
// À LA FOIS depuis un `useMemo` (affichage courant, voir `candidatesBySource`
// plus bas) et directement depuis les gestionnaires qui changent d'espèce
// (recherche bestiaire, import de recette) pour résoudre l'exemplaire SANS
// attendre le rendu suivant (`selectedId`/`speciesMonster` n'auraient pas
// encore la nouvelle valeur dans le même appel). Sert deux choses : activer/
// désactiver chaque puce (une espèce jamais possédée dans une source
// précise désactive SA puce, voir
// docs/02-app/optimizer/) et peupler la désambiguïsation
// d'exemplaire (zone D, plusieurs candidats dans la même source — ex. 2
// équipes de siège).
// ⚠️ Box : `item.gear` truthy suffit (PAS `item.gear.runes.length>0`,
// contrairement à `exclusionCandidatesFor`) — un monstre possédé mais
// totalement nu reste une entrée Box valide (cas « construire un build
// depuis rien », déjà permis avant ce remaniement). ⚠️ RTA/siège :
// `requireRunes: false` (bug signalé — un monstre assigné à un deck
// d'offense siège mais non runé ne voyait pas son exemplaire proposé ici,
// alors que Box l'autorise juste au-dessus pour le même cas) — `exclusion
// CandidatesFor` garde son défaut `requireRunes: true` pour SON autre
// appelant (« Exclure les runes d'un monstre », où une entrée sans rune n'a
// rien à exclure).
function speciesCandidatesBySource(
  com2usId: number | null,
  box: BoxItem[],
  exclusionData: ExclusionSourceData
): Record<ExclusionSource, ExclusionCandidate[]> {
  if (com2usId == null) return { box: [], rta: [], 'siege-defense': [], 'siege-offense': [] };
  const boxCandidates: ExclusionCandidate[] = box
    .filter((item) => item.gear && item.monster.com2usId === com2usId)
    .map((item) => ({ selector: { source: 'box' as const, unitKey: item.key }, monster: item.monster, gear: item.gear! }));
  return {
    box: boxCandidates,
    rta: exclusionCandidatesFor('rta', exclusionData, null, null, false).filter((c) => c.monster.com2usId === com2usId),
    'siege-defense': exclusionCandidatesFor('siege-defense', exclusionData, null, null, false).filter((c) => c.monster.com2usId === com2usId),
    'siege-offense': exclusionCandidatesFor('siege-offense', exclusionData, null, null, false).filter((c) => c.monster.com2usId === com2usId),
  };
}

// Un sélecteur `unowned` pour une espèce absente des 4 sources du compte —
// demande explicite (« ajouter un monstre qu'on ne possède pas dans une
// liste : le joueur a obtenu le monstre et veut essayer des runages de
// teams sans avoir mis à jour son json »). `null` dès que l'espèce est
// possédée QUELQUE PART (même une seule source, même ambiguë) : ne
// masque JAMAIS un exemplaire réel derrière un sélecteur `unowned` — la
// désambiguïsation normale (zone D / clic sur une puce) garde la main.
// Factorisé : utilisé aux 3 points d'entrée qui choisissent une espèce
// (recherche bestiaire, continuité au montage, import de recette).
function unownedSelectorIfNoneOwned(monster: Monster, box: BoxItem[], exclusionData: ExclusionSourceData): ExclusionSelector | null {
  const candidates = speciesCandidatesBySource(monster.com2usId, box, exclusionData);
  const possedeQuelquePart = Object.values(candidates).some((list) => list.length > 0);
  return possedeQuelquePart ? null : { source: 'unowned', monsterId: String(monster.id) };
}

// L'exemplaire au montage de l'écran, d'après celui mémorisé
// (`useOptimizerState`) : `undefined` = le garder, il se résout encore contre
// le compte et désigne bien l'espèce choisie ; sinon son remplaçant, par la
// règle du choix d'une espèce — premier exemplaire Box, `unowned` si
// l'espèce n'est possédée nulle part, `null` si elle l'est ailleurs qu'en Box
// (à désambiguïser par une puce).
export function exemplaireAuMontage(
  species: Monster,
  memorise: ExclusionSelector | null,
  box: BoxItem[],
  exclusionData: ExclusionSourceData
): ExclusionSelector | null | undefined {
  const resolu = memorise ? resolveExclusionEntry(memorise, exclusionData) : null;
  if (resolu && resolu.monster.com2usId === species.com2usId) return undefined;
  const boxCandidates = speciesCandidatesBySource(species.com2usId, box, exclusionData).box;
  return boxCandidates[0]?.selector ?? unownedSelectorIfNoneOwned(species, box, exclusionData);
}

// Deux builds portent-ils EXACTEMENT le même jeu de 6 runes (peu importe
// l'ordre) ? Sert à repérer, parmi les candidats affichés, celui qui EST le
// build déjà validé pour ce monstre — un simple `===` sur les
// tableaux ne suffirait pas, `runeIds` n'est jamais garanti dans le même
// ordre d'un calcul à l'autre.
/**
 * L'état de validation d'un build affiché, vis-à-vis de celui qui est réservé.
 *
 * ⚠️ **Trois états, pas deux.** Comparer les seules runes rendait invalidable
 * un build aux MÊMES runes mais aux artéfacts DIFFÉRENTS : l'utilisateur
 * voyait des stats qui ne sont pas celles réservées, et le bouton disait
 * « Validé » sans rien offrir. Le cas est courant, puisque la paire
 * suit le critère de tri (voir docs/03-developpeur/optimizer/,
 * « Régime de la paire ») :
 * changer de tri change la paire, donc les stats, à runes identiques.
 *
 * Un artéfact entre dans les statistiques du monstre — deux paires
 * différentes, ce sont deux builds différents.
 */
type EtatValidation = 'non' | 'oui' | 'artefacts';

/**
 * Même ensemble d'ids ? Sert aux runes ET aux artéfacts — c'est la même
 * question, et un build validé mémorise les deux (`ValidatedBuild.runeIds`,
 * `ValidatedBuild.artifactIds`).
 */
/**
 * Sur QUOI la paire d’artéfacts doit-elle être optimisée, pour un critère de
 * classement donné ?
 *
 * ⚠️ **Un artéfact ne peut bouger que PV, ATQ et DEF** — sa stat principale
 * est plate et ne porte rien d’autre (`ARTIFACT_MAIN`, effects.ts). Tous les
 * autres critères (efficience, VIT, TC, DCC, RES, PRE) sont donc INSENSIBLES
 * à la paire : ils partagent un seul régime, `'aucun'`, et basculer de l’un à
 * l’autre ne doit RIEN recalculer.
 *
 * ⚠️ **Les stats plates sont un régime à part entière, et c’était un défaut.**
 * Trier par ATQ classait sur une ATQ dont la paire avait été choisie par la
 * somme des principales : PV+1500 × 2 (somme 3000) gagnait contre ATQ+100 × 2
 * (somme 200), alors que c’est la seconde qui maximise la valeur affichée.
 * Même défaut d’ordre que celui de la paire notée par la somme des
 * principales (docs/03-developpeur/optimizer/, « Régime de la
 * paire »), transposé au tri.
 *
 * ⚠️ Le régime sert AUSSI de clé de cache (`signatureArtefacts`) : deux
 * critères ne la partagent que si la paire optimale est démontrablement la
 * même. Trop regrouper afficherait une paire périmée.
 *
 * `RegimeArtefacts`/`regimeArtefacts`/`evaluerPourRegime` vivent dans
 * `artifactEvaluation.ts` — UNE seule définition, partagée avec le CLI
 * (`scripts/lib/recipeToSearchParams.ts`), pour que les deux ne puissent
 * plus diverger silencieusement (docs/03-developpeur/optimizer/).
 */

function memesIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

// Équipement NUL, affiché tant qu'aucun monstre n'est choisi — demande
// explicite de l'utilisateur : la fiche (stats, artéfacts, roue, relique)
// reste TOUJOURS visible, vide plutôt qu'absente, pour que choisir un
// monstre ne fasse jamais apparaître un bloc entier là où il n'y avait rien
// (voir docs/03-developpeur/interface/, « un clic ne déplace jamais ce qu'on vient de
// cliquer »). `MonsterGear` n'a besoin d'aucune adaptation : `computeStats`
// sur une base à zéro renvoie des lignes à zéro, `ArtifactSlots`/`RuneWheel`
// gèrent déjà nativement un tableau vide (voir leurs propres commentaires).
const EMPTY_GEAR: GearSet = {
  base: { hp: 0, atk: 0, def: 0, spd: 0, cr: 0, cd: 0, res: 0, acc: 0 },
  runes: [],
  artifacts: [],
};

function formatBig(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n < 1_000_000_000) return Math.round(n).toLocaleString('fr-FR');
  return n.toExponential(1);
}

// Outil « Optimizer » : cherche, parmi les runes du compte, la (les)
// meilleure(s) combinaison(s) de 6 pour un monstre, un combo de sets et des
// minimums de stats donnés. Voir docs/02-app/optimizer/.
// Les deux crans de « Meilleurs artéfacts offensifs pour ce build ».
//
// ⚠️ Défini ici et non dans `runeBuildOptim.ts` avec `OBJECTIVE_LABELS` : ce
// n'est PAS un objectif de recherche de runes — il ne change rien aux builds
// trouvés, seulement la paire d'artéfacts proposée par-dessus l'un d'eux.
const CRITERE_ARTEFACTS_LABELS: { key: 'brut' | 'reel'; label: string }[] = [
  { key: 'brut', label: 'Dégâts supplémentaires' },
  { key: 'reel', label: 'Dégâts réels' },
];

// ⚠️ **Largeur fixe et commune** aux quatre listes de la carte « Artéfacts
// et reliques » (Attribut, Type, Principale, Propriété unique) — un
// `<select>` natif sans largeur explicite prend celle de sa plus longue
// option (« Soins et boucliers accordés en fonction des PV » pour la
// relique). `truncate` tronque la valeur FERMÉE par « … » ; la liste
// ouverte garde le texte complet (comportement natif du `<select>`).
const LARGEUR_SELECTEUR_LISTE = 'w-44 truncate';
// ⚠️ Même principe pour les LIBELLÉS des deux rangées (Attribut / Type et
// Principale / Propriété unique / Niveau minimum) : une largeur commune,
// dimensionnée sur le plus long (« Propriété unique »), sans quoi les
// boutons de la seconde rangée ne tombent pas sous ceux de la première —
// « Type » et « Propriété unique » doivent être alignés (demande explicite).
const LARGEUR_LIBELLE_LISTE = 'w-28';

export default function OptimizerSection({ box, runes, artifacts, relics, relicUsageById, optimizer, allMonsters, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, lists, accountName, menuOuvert, onFermerMenu, onOuvrirMenu }: Props) {
  const metric = useRuneMetric();
  // ⚠️ Ne sert PAS aux `Segmented` — ils se resserrent tout seuls
  // en mesurant la place qu'ils reçoivent (voir `Segmented.tsx`), ce qu'un
  // seuil de FENÊTRE ne pouvait pas voir. Reste utilisé par les vignettes
  // d'effet de `DamageSetupCard`, dont la disposition (et pas seulement la
  // taille du texte) change au format étroit.
  const etroit = useMediaQuery(SOUS_SM);
  const {
    selectedId,
    setSelectedId,
    gearSource: gearSourceMemorise,
    setGearSource,
    sourceSelector: selecteurMemorise,
    setSourceSelector,
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
    relicMainChoice,
    setRelicMainChoice,
    relicUniqueChoice,
    setRelicUniqueChoice,
    relicMinUpgrade,
    setRelicMinUpgrade,
    lignesVerrouillees,
    setLignesVerrouillees,
    mainStatsBySlot,
    setMainStatsBySlot,
    lockedRunes,
    setLockedRunes,
    objective,
    setObjective,
    damageSetup: damageSetupPersonnel,
    setDamageSetup,
    compterAurasResPre,
    setCompterAurasResPre,
    critereArtefacts,
    setCritereArtefacts,
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
    verifierToutesLesCombinaisons,
    setVerifierToutesLesCombinaisons,
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
    importDuCompte,
    traiterReliqueImportee,
    search,
    resetSearch,
    effacerResultats,
    lireCombatMembre,
  } = optimizer;
  const combatMembre = useMemo(() => lireCombatMembre(),
    // Le getter lit les refs vivantes du hook ; ces dépendances publient
    // leurs changements sans recopier le lead d'équipe dans l'état personnel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lireCombatMembre, damageSetupPersonnel, lists.teams, lists.listContents, optimizer.proprietaireCriteres, box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, allMonsters]);
  const damageSetup = combatMembre.setup;
  // `relicContextRecherche` : le contexte relique de la recherche LANCÉE
  // — `undefined` tant que l'écran n'en pose pas dans `run()` ; la file de
  // résolution le lit ici, jamais dans les trois champs.
  const { status, result, progress, refusal, relicContext: relicContextRecherche, run, stop } = search;

  // Tous les monstres du BESTIAIRE, indexés par id — la recherche du
  // monstre à optimiser résout une ESPÈCE dans TOUT le bestiaire
  // (monstre possédé ou non), pas seulement dans les 4 sources du compte.
  // Indexé par `String(monster.id)` — même clé que
  // `RtaEntry.monsterId`/`SiegeSlot.monsterId` (voir applyAccount.ts).
  // Recalculé seulement si la liste de monstres change, pas à chaque rendu.
  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of allMonsters) m.set(String(mon.id), mon);
    return m;
  }, [allMonsters]);

  // L'ESPÈCE choisie par la recherche — nom, icône, stats de base, sorts,
  // indépendamment de toute source du compte. Le choix RÉEL de l'exemplaire
  // (build précis dans Box/RTA/Défenses siège/Offenses siège) passe par les 4
  // puces, plus bas (`selected`) — une espèce non possédée reste
  // sélectionnable ici (`selected` retombe alors sur ses stats de base 6★,
  // voir `monsterBaseStats`).
  const speciesMonster = selectedId ? (monsterById.get(selectedId) ?? null) : null;

  // ── Objectif « Dégâts réels » ────────────────────────────────────────
  // Fiche de compétences du monstre choisi. ⚠️ Chargée pour TOUT monstre
  // sélectionné, pas seulement quand l'objectif est « Dégâts réels » : sans
  // ça, choisir l'objectif afficherait un panneau vide le temps d'un
  // aller-retour réseau, juste après le clic. `chargerDetail` met en cache
  // (y compris les absences), donc ce préchargement ne coûte rien à la
  // seconde visite.
  const [skillDetail, setSkillDetail] = useState<DetailMonstre | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const selectedCom2usId = speciesMonster?.com2usId ?? null;
  useEffect(() => {
    let vivant = true;
    setSkillLoading(true);
    chargerDetail(selectedCom2usId).then((d) => {
      // ⚠️ Garde de démontage/changement de monstre : on peut changer de
      // monstre avant la fin du chargement, et écrire l'ancienne fiche
      // écraserait la bonne (même garde que MonsterDetailDialog.tsx).
      if (!vivant) return;
      setSkillDetail(d);
      setSkillLoading(false);
    });
    return () => {
      vivant = false;
    };
  }, [selectedCom2usId]);

  const damageSkills = useMemo(() => monsterDamageSkills(skillDetail), [skillDetail]);
  // Rappel « tel passif pose tel buff » d'« État de mon monstre » :
  // affichage seul, aucun calcul ne le lit. ⚠️ Garde
  // sur l'identité de la fiche : au changement de monstre, l'ancienne reste
  // en mémoire le temps du chargement, et son rappel ne doit pas s'afficher
  // sous le nouveau monstre.
  const rappelsBuffs = useMemo(
    () => (skillDetail?.com2usId === selectedCom2usId ? rappelsBuffsDePassif(skillDetail) : []),
    [skillDetail, selectedCom2usId]
  );
  // Le sort RÉELLEMENT retenu — `resolveDamageSkill` est la source unique de
  // cette résolution, partagée avec la relecture d'une recette en ligne de
  // commande (scripts/lib/recipeToSearchParams.ts).
  const resolvedSkill = useMemo(
    () => resolveDamageSkill(damageSkills, damageSetup.skillCom2usId),
    [damageSkills, damageSetup.skillCom2usId]
  );
  /**
   * Quel build de résultat est actuellement COMPARÉ à la référence — sa clé
   * de runes, ou `null`. Un seul à la fois : deux comparaisons ouvertes
   * n'auraient pas de sens, elles partagent la même référence.
   *
   * ⚠️ **La référence, c'est la fiche affichée**, et ça suffit à couvrir les
   * deux cas demandés. `selected.gear` EST déjà le build validé quand il en
   * existe un (substitution des runes ET des artéfacts, voir le `useMemo` de
   * `selected`), et l'équipement réel sinon. Recalculer ici « validé sinon
   * courant » aurait dupliqué cette résolution — et raté le cas « Voir le
   * runage réellement porté », qui la désactive exprès.
   */
  const [compareKey, setCompareKey] = useState<string | null>(null);
  // La description du combat sort du flux (voir DamageSetupModale.tsx) : cet
  // état dit seulement si elle est ouverte.
  const [setupOuvert, setSetupOuvert] = useState(false);
  // `EtatMonstre` écrit un PATCH, là où `DamageSetupCard` reçoit le `setState`
  // entier — même état, deux vues (voir EtatMonstre.tsx).
  const majDamageSetup = (patch: Partial<DamageSetup>) => {
    const { leaderSkill, ...personnel } = patch;
    if ('leaderSkill' in patch) optimizer.modifierLeadMembre(leaderSkill);
    if (Object.keys(personnel).length) setDamageSetup(s => ({ ...s, ...personnel }));
  };
  /**
   * Ce que l'état du monstre suppose, en une ligne — l'écho posé dans le
   * sous-titre de la fenêtre « Dégâts réels ».
   *
   * ⚠️ **En lecture seule, jamais des contrôles.** Ces réglages vivent dans
   * la carte « État de mon monstre » ; les rendre AUSSI dans la fenêtre en
   * ferait deux exemplaires vivants du même interrupteur, visibles en même
   * temps. Qui ouvre la fenêtre pour décrire un combat doit néanmoins savoir
   * sous quelles hypothèses il travaille — d'où la phrase, et rien de plus.
   *
   * ⚠️ **Les auras externes y sont NOMMÉES par set** ;
   * l'écho les ignorait. Les activations propres du build, elles, se
   * résolvent par candidat : la fenêtre n'en connaît aucun, elle dit
   * seulement qu'elles s'ajoutent sur chaque résultat (`echoAurasExternes`).
   */
  const echoEtatMonstre = useMemo(() => {
    const bouts = [
      damageSetup.atkBuff && 'buff ATQ',
      damageSetup.defBuff && 'buff DEF',
      damageSetup.spdBuff && 'buff VIT',
      damageSetup.leaderSkill && `lead ${damageSetup.leaderSkill.stat} +${damageSetup.leaderSkill.pct} %`,
      SUMMONER_SKILLS_LABELS.find((s) => s.key === damageSetup.summonerSkills)?.label,
    ].filter(Boolean);
    return `État du monstre : ${bouts.length > 0 ? bouts.join(' · ') : 'aucun buff, aucun lead'} · ${echoAurasExternes(damageSetup.setsAuraExternes)}`;
  }, [damageSetup]);
  const critInterdit = useMemo(() => monsterCritInterdit(skillDetail), [skillDetail]);
  /**
   * Ce que l'objectif « Dégâts réels » suppose, en une ligne — le résumé qui
   * remplace la carte dans le flux, et la rouvre au clic.
   *
   * ⚠️ **Des valeurs RÉSOLUES, jamais celles stockées.** `skillCom2usId`
   * désigne un sort d'un monstre DONNÉ : après un changement de monstre,
   * `resolveDamageSkill` retombe silencieusement sur le sort par défaut du
   * nouveau. Tant que la carte était affichée, on voyait le sort revenir au
   * défaut ; derrière une modale fermée, afficher l'identifiant stocké ferait
   * croire à un réglage qui n'est pas celui du calcul. On lit donc
   * `resolvedSkill`, la même source que le calcul lui-même.
   */
  const resumeCombat = useMemo(() => {
    const bouts: string[] = [];
    bouts.push(resolvedSkill ? `S${resolvedSkill.slot} ${resolvedSkill.nom}` : 'Aucun sort exploitable');
    // La cible calculée d'un sort à coup de zone curé (Blade Surge), quand ce
    // n'est pas la cible visée : celle que RETIENT le calcul pour le sort
    // RÉSOLU, même règle que le reste de cette ligne.
    const cibleRetenue = resolvedSkill && resumeCibleDegatsRetenue(resolvedSkill, damageSetup);
    if (cibleRetenue) bouts.push(cibleRetenue);
    const cible = ELEMENTS.find((e) => e.key === damageSetup.enemyElement);
    bouts.push(cible ? `vs ${cible.label}` : 'élément ignoré');
    bouts.push(`PV ${damageSetup.enemyHp.toLocaleString('fr-FR')}`);
    // ⚠️ **La DEF et le critique seulement si le sort les CONSOMME**, via le
    // même prédicat que la fenêtre (`champsDuCombat`). Cette ligne affichait
    // « DEF 1000 » en dur — donc sur un S3 qui ignore la défense, où le champ
    // n'existe même pas dans la fenêtre qu'elle résume. Signalé à l'usage.
    const champs = champsDuCombat(resolvedSkill);
    if (champs.defEnnemie) bouts.push(`DEF ${damageSetup.enemyDef.toLocaleString('fr-FR')}`);
    if (champs.crit && !critInterdit) {
      bouts.push(CRIT_MODE_LABELS.find((c) => c.key === damageSetup.critMode)?.label ?? damageSetup.critMode);
    }
    if (critInterdit) bouts.push('critique impossible');
    // ⚠️ **Plus de buffs ici.** Cette ligne résume la FENÊTRE qu'elle rouvre,
    // et les buffs n'y sont plus — ils ont leurs propres contrôles, toujours
    // visibles, dans « État de mon monstre ». Les répéter en texte alors qu'ils
    // sont réglables trois cartes plus haut ne fait que du bruit.
    return bouts.join(' · ');
  }, [resolvedSkill, damageSetup, critInterdit]);
  // Passifs offensifs de CE monstre (Feng Yan, Sia, Roid… — voir
  // docs/02-app/degats-reels/) — indépendants du sort choisi, calculés dès
  // qu'une fiche est chargée, comme `damageSkills`.
  const offensivePassives = useMemo(() => monsterOffensivePassives(skillDetail), [skillDetail]);
  // Modificateurs monstre-wide liés à la VIT (Ciri Eau/Rigna/Magic Order
  // Swordsinger, Sonia/Battle Angel) — ne dépendent que de la fiche, pas des
  // artéfacts (contrairement à `artefactsDegats`, calculé plus bas après
  // `searchArtifacts`) : ils font travailler la VIT au pré-filtrage même
  // pour un sort dont la formule ne la lit pas (voir `damageRelevantStats`).
  const critSiPlusRapide = useMemo(() => monsterCritSiPlusRapide(skillDetail), [skillDetail]);
  const bonusDegatsSelonVit = useMemo(() => monsterBonusDegatsSelonVit(skillDetail), [skillDetail]);
  // Momo/Mage — le pourcentage EFFECTIF vit dans `damageSetup.stackPersonnalise`
  // (saisi par l'utilisateur), pas ici : ceci ne porte que la DÉTECTION du
  // passif (nom/plafond), comme les deux modificateurs ci-dessus.
  const bonusDegatsStack = useMemo(() => monsterBonusDegatsStackable(skillDetail), [skillDetail]);
  // Ciri (Feu)/MOS (Feu)/Reyka — Taux Crit selon la VIT, avec surplus
  // reversé en Dgts Crit. Lizardman/Glinodon — points flats de Taux
  // Crit/Dgts Crit, inconditionnels. Les deux touchent directement le
  // Taux/Dgts Crit à chaque instance, groupés en un seul objet pour
  // `computeTotalDamage`/`computeSkillDamageDetail` (voir `monsterWide`).
  const critRateSelonVit = useMemo(() => monsterCritRateSelonVit(skillDetail), [skillDetail]);
  const bonusStatFixe = useMemo(() => monsterBonusStatFixe(skillDetail), [skillDetail]);
  // Spear of Tenacity/Martial Arts Specialist/Sickle Blade/Sand Blade/
  // Calculated Sacrifice — modificateurs ADDITIFS au multiplicateur du sort
  // choisi, toujours actifs (aucun bouton), déduits du passif comme les deux
  // ci-dessus. Backup Code/Blessing of Curse — MULTIPLICATIFS selon un
  // compte d'effets (cible/soi) saisi par l'utilisateur, même famille que
  // `bonusParEffetCible` propre à un sort mais MONSTRE-WIDE ici.
  const bonusFixeCiblePvMax = useMemo(() => monsterBonusFixeCiblePvMax(skillDetail), [skillDetail]);
  const bonusEcartDef = useMemo(() => monsterBonusEcartDef(skillDetail), [skillDetail]);
  const bonusFixeMaxHpPropre = useMemo(() => monsterBonusFixeMaxHpPropre(skillDetail), [skillDetail]);
  const bonusSacrifice = useMemo(() => monsterBonusSacrifice(skillDetail), [skillDetail]);
  const bonusParEffetCibleMonstre = useMemo(() => monsterBonusParEffetCible(skillDetail), [skillDetail]);
  const bonusParEffetPropre = useMemo(() => monsterBonusParEffetPropre(skillDetail), [skillDetail]);
  const conditionsCombatMonstre = useMemo(() => monsterConditionsCombat(skillDetail), [skillDetail]);
  const combatStats = useMemo(() => monsterCombatStatProfiles(skillDetail), [skillDetail]);
  const monsterWide = useMemo(
    () => ({
      critRateSelonVit: critRateSelonVit ?? undefined,
      bonusStatFixe: bonusStatFixe ?? undefined,
      bonusFixeCiblePvMax: bonusFixeCiblePvMax ?? undefined,
      bonusEcartDef: bonusEcartDef ?? undefined,
      bonusFixeMaxHpPropre: bonusFixeMaxHpPropre ?? undefined,
      bonusSacrifice: bonusSacrifice ?? undefined,
      bonusParEffetCible: bonusParEffetCibleMonstre ?? undefined,
      bonusParEffetPropre: bonusParEffetPropre ?? undefined,
      conditionsCombat: conditionsCombatMonstre,
      combatStats,
      critInterdit,
    }),
    [
      critRateSelonVit,
      bonusStatFixe,
      bonusFixeCiblePvMax,
      bonusEcartDef,
      bonusFixeMaxHpPropre,
      bonusSacrifice,
      bonusParEffetCibleMonstre,
      bonusParEffetPropre,
      conditionsCombatMonstre,
      combatStats,
      critInterdit,
    ]
  );
  // Bonus conditionnel à bouton (Jin Kazama, Cyborg, Brownie Magician,
  // Astar, Jean, Kyle, Satoru Gojo, Werner, Zenitsu, Qilin Slasher, Panda
  // Warrior, Mi Ying…) — condition que l'app ne peut pas déduire (PV
  // propres, état d'un allié, tour précédent…), toggle dans `damageSetup.
  // passifsOffensifs` comme un passif `bonus`/`conditionnel` classique.
  const bonusDegatsConditionnel = useMemo(() => monsterBonusDegatsConditionnel(skillDetail), [skillDetail]);
  // Zenitsu Agatsuma (Ténèbres)/Qilin Slasher (Ténèbres) — même famille que
  // `bonusDegatsSelonVit`, mais selon le Taux Crit BRUT (voir
  // `monsterBonusDegatsSelonCr`).
  const bonusDegatsSelonCr = useMemo(() => monsterBonusDegatsSelonCr(skillDetail), [skillDetail]);
  // Gideon (« Aegis Shell ») — même famille ENCORE, mais selon TA PROPRE DEF
  // (voir `monsterBonusDegatsSelonDef`).
  const bonusDegatsSelonDef = useMemo(() => monsterBonusDegatsSelonDef(skillDetail), [skillDetail]);
  // Brita (« Might of the Mercenary ») — même famille que `critSiPlusRapide`
  // (entièrement déduit, aucun bouton), mais un SEUIL d'ATQ plutôt qu'un
  // écart de VIT (voir `monsterBonusSiAtqSeuil`).
  const bonusSiAtqSeuil = useMemo(() => monsterBonusSiAtqSeuil(skillDetail), [skillDetail]);
  const seuilsPassifEivor = useMemo(() => monsterSeuilsPassifEivor(skillDetail), [skillDetail]);
  // Contexte commun aux TROIS évaluations de dégâts d'artéfacts de l'écran.
  // Il est volontairement typé depuis `RealDamageContext` : si le moteur gagne
  // un modificateur monstre-wide, ces chemins ne peuvent plus l'oublier sans
  // faire échouer `tsc`.
  const contexteDegatsArtefacts = useMemo<Omit<RealDamageContext, 'artefacts'> | null>(
    () =>
      resolvedSkill
        ? {
            profile: resolvedSkill,
            setup: damageSetup,
            element: speciesMonster?.element ?? null,
            passifs: offensivePassives,
            critSiPlusRapide,
            bonusDegatsSelonVit,
            bonusDegatsStack,
            monsterWide,
            bonusDegatsConditionnel,
            bonusDegatsSelonCr,
            bonusDegatsSelonDef,
            bonusSiAtqSeuil,
          }
        : null,
    [
      resolvedSkill,
      damageSetup,
      speciesMonster?.element,
      offensivePassives,
      critSiPlusRapide,
      bonusDegatsSelonVit,
      bonusDegatsStack,
      monsterWide,
      bonusDegatsConditionnel,
      bonusDegatsSelonCr,
      bonusDegatsSelonDef,
      bonusSiAtqSeuil,
    ]
  );
  // Affichage seul (icône/nom/description) des deux modificateurs VIT
  // ci-dessus, pour « Passifs offensifs » — voir `DamageSetupCard.tsx`.
  const modificateursVit = useMemo(() => monsterModificateursVit(skillDetail), [skillDetail]);
  // Stats que le pré-filtrage doit privilégier — `undefined` hors de cet
  // objectif, auquel cas le moteur retombe sur `OBJECTIVE_RELEVANT_STATS`
  // (comportement strictement inchangé pour les cinq autres objectifs).
  const objectiveStats = useMemo(
    () =>
      objective === 'degats_reels'
        ? damageRelevantStats(
            resolvedSkill,
            offensivePassives,
            damageSetup,
            critSiPlusRapide,
            bonusDegatsSelonVit,
            critRateSelonVit,
            bonusEcartDef,
            bonusFixeMaxHpPropre != null || bonusSacrifice != null,
            bonusDegatsSelonCr,
            bonusDegatsSelonDef,
            bonusSiAtqSeuil,
            monsterWide
          )
        : undefined,
    [
      objective,
      resolvedSkill,
      offensivePassives,
      damageSetup,
      critSiPlusRapide,
      bonusDegatsSelonVit,
      critRateSelonVit,
      bonusEcartDef,
      bonusFixeMaxHpPropre,
      bonusSacrifice,
      bonusDegatsSelonCr,
      bonusDegatsSelonDef,
      bonusSiAtqSeuil,
      monsterWide,
    ]
  );
  // Statistiques principales autorisées sur les slots 2/4/6 — vide = libre.
  // Voir docs/02-app/optimizer/ : pour un Lushen, ATQ% en 2, Dmg Crit en 4,
  // ATQ% en 6 — sans cette contrainte, ces slots partent dans n'importe quel
  // sens et noient le pré-filtrage sous des runes hors sujet.
  function toggleMainStat(slot: 2 | 4 | 6, code: number) {
    setMainStatsBySlot((prev) => {
      const cur = prev[slot] ?? [];
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      return { ...prev, [slot]: next };
    });
  }

  // Basculer sur Haut/Extrême active « Rechercher jusqu'à épuisement complet »
  // et « Prioriser les stats les plus difficiles » — un novice qui choisit un
  // pré-filtrage large n'a aucune raison de savoir que ces deux réglages sont
  // ce qui le rend réellement utile. Reste un COUP DE POUCE, pas un
  // verrouillage : chaque interrupteur garde son `onChange` propre, remettre
  // à false ensuite reste un clic normal dessus. Bas/Moyen ne les touchent
  // pas dans l'autre sens — décochés une fois, ils le restent.
  function handleSlotFilterPresetChange(preset: typeof slotFilterPreset) {
    setSlotFilterPreset(preset);
    if (preset === 'haut' || preset === 'extreme') {
      setExhaustiveSearch(true);
      setAdaptiveTrancheWeighting(true);
    }
  }

  const slotFilterCap = SLOT_FILTER_PRESETS.find((p) => p.key === slotFilterPreset)!.cap;
  // Filet de sécurité fixe, large, PAS un réglage utilisateur : le bouton
  // « Arrêter » reste le vrai moyen de reprendre la main. 10 min, pas 15 s :
  // une recherche légitimement longue (preset Extrême sur un gros compte,
  // voir docs/03-developpeur/optimizer/,
  // « Validation grandeur nature ») ne doit pas être coupée avant
  // d'avoir eu sa chance d'aboutir.
  const HARD_TIMEOUT_MS = 10 * 60 * 1000;

  const runeById = useMemo(() => new Map(runes.map((r) => [r.id, r])), [runes]);
  // Activations d'aura PROPRES aux runes de chaque candidat, lues
  // par le tri, les cartes et le near-miss — jamais celles de la fiche.
  const aurasPropresDe = useMemo(() => aurasPropresParRunes(runeById), [runeById]);
  // Jumeau de `runeById` : sert à rejouer la paire d'un build validé, qui n'en
  // mémorise que les identifiants.
  const artifactById = useMemo(() => new Map(artifacts.map((a) => [a.id, a])), [artifacts]);

  // ⚠️ La page que la file sert en priorité : les builds qui rempliront les
  // places « Vérification… » de la page affichée (`composition.aVerifier`).
  // Elle est remplie APRÈS `composition` (plus bas) : une ref, parce
  // que la file est déclarée AVANT elle et ne peut donc pas recevoir sa valeur.
  const pageAfficheeRef = useRef<BuildCandidate[]>([]);
  // La grille des résultats : `useHauteurDesCartes` y mesure les cartes.
  const grilleResultatsRef = useRef<HTMLDivElement>(null);

  /**
   * La sélection de « Équipement actuel », dérivée de la MÊME clé que les
   * cartes de résultat.
   *
   * ⚠️ **Un seul état pour tout l'écran.** La fiche gérait sa propre sélection :
   * son détail restait donc ouvert en même temps que celui d'une carte. Plutôt
   * qu'un second état à synchroniser — qui se désynchronise au premier chemin
   * oublié —, elle est CONTRÔLÉE depuis `openDetailKey`, avec son propre
   * préfixe `fiche-`.
   *
   * ⚠️ Les deux `<MonsterGear>` de cet écran (bureau et téléphone) sont deux
   * rendus du MÊME contenu : les brancher sur la même clé est ce qui leur évite
   * de diverger.
   */
  const selectionFiche = useMemo((): SelectionGear => {
    if (!openDetailKey?.startsWith('fiche-')) return null;
    const reste = openDetailKey.slice('fiche-'.length);
    if (reste === 'relic') return { kind: 'relic' };
    if (reste.startsWith('r')) return { kind: 'rune', i: Number(reste.slice(1)) };
    if (reste.startsWith('a')) return { kind: 'artifact', i: Number(reste.slice(1)) };
    return null;
  }, [openDetailKey]);

  const setSelectionFiche = (s: SelectionGear) => {
    if (!s) return setOpenDetailKey(null);
    if (s.kind === 'relic') return setOpenDetailKey('fiche-relic');
    setOpenDetailKey(`fiche-${s.kind === 'rune' ? 'r' : 'a'}${s.i}`);
  };

  // Sert à ramener l'écran sur « Set de runes recherché » quand une
  // recherche est tentée sans set choisi (voir `handleSearch`) — sans ça, le
  // cadre rouge pouvait rester hors champ (page longue, écran petit), auquel
  // cas rien ne signalait visuellement à l'utilisateur POURQUOI le clic sur
  // « Rechercher » ne s'est rien passé.
  const setPickerSectionRef = useRef<HTMLDivElement>(null);

  // ⚠️ « Exclure les runes déjà utilisées » DÉCOCHÉE PAR DÉFAUT — inversion
  // volontaire de l'ancienne case « Utiliser tout l'inventaire » (COCHÉE par
  // défaut, avec la signification opposée : décochée = exclusion box). Les
  // deux réglages laissent le comportement PAR DÉFAUT de la recherche
  // inchangé (tout l'inventaire considéré, rien exclu) — seule la case à
  // activer explicitement pour restreindre a changé de sens et de nom, avec
  // en plus un périmètre au choix (RTA/Défenses siège/Box, un seul à la
  // fois, voir `AUTO_EXCLUSION_SCOPES`) là où l'ancienne case ne portait QUE
  // sur la box. Voir docs/02-app/optimizer/,
  // « Exclusion des runes déjà portées ailleurs ».
  const exclusionData = useMemo<ExclusionSourceData>(
    () => ({ box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, monsterById }),
    [box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, monsterById]
  );

  // Candidats de compte pour l'ESPÈCE COURANTE, un tableau par source —
  // pilote À LA FOIS l'état actif/grisé/désactivé de chaque puce et le contenu de la désambiguïsation d'exemplaire (zone
  // D, plus bas) une fois une puce cliquée. Voir `speciesCandidatesBySource`
  // (fonction module, en tête de fichier) pour pourquoi ce n'est PAS un
  // simple appel direct dans les gestionnaires qui changent d'espèce.
  const candidatesBySource = useMemo(
    () => speciesCandidatesBySource(speciesMonster?.com2usId ?? null, box, exclusionData),
    [speciesMonster, box, exclusionData]
  );

  // Source active — box (défaut), RTA, ou un deck de siège. ⚠️ Ne filtre
  // pas la RECHERCHE : une fois l'ESPÈCE choisie par la recherche
  // bestiaire (`speciesMonster`), les puces choisissent seulement quel
  // EXEMPLAIRE de cette espèce afficher/optimiser. `gearSource` et
  // `sourceSelector` vivent dans `useOptimizerState` : ils survivent au
  // changement de page et entrent dans la sauvegarde de session ; jamais
  // dans la recette exportée ni les scripts CLI (une recette ne porte que
  // l'espèce).
  //
  // ⚠️ Choix EXPLICITE de l'utilisateur (via `pickSource`, plus bas) pour
  // changer d'exemplaire ensuite ; l'exemplaire affiché au départ est le
  // premier de la box (`boxCandidates[0]`, PAS un « meilleur » deviné :
  // deviner un « meilleur » exemplaire est exactement ce que refusait
  // l'ancien `ownGearForSource`), même
  // règle que `pickSpecies` plus bas — repli sur `unowned` seulement si la
  // box n'en compte AUCUN.
  //
  // ⚠️ Revérifié au MONTAGE (retour sur l'onglet, session chargée) : le
  // compte a pu changer entre-temps (réimport, équipe de siège supprimée).
  // Un exemplaire qui ne se résout plus, ou d'une autre espèce, retombe sur
  // la même règle, source Box. Le remplaçant vaut DÈS le premier rendu, puis
  // l'effet l'enregistre dans `useOptimizerState` : la fiche ne montre jamais
  // l'exemplaire périmé. Au montage seulement : pendant que l'écran est
  // affiché, les gestes de l'utilisateur (zone D en attente d'un choix, qui
  // laisse `sourceSelector` à `null`) et les imports suivent leurs chemins.
  const [remplacantAuMontage] = useState(() => {
    const species = selectedId ? monsterById.get(selectedId) : undefined;
    return species ? exemplaireAuMontage(species, selecteurMemorise, box, exclusionData) : undefined;
  });
  const montageEnregistre = useRef(false);
  useLayoutEffect(() => {
    montageEnregistre.current = true;
    if (remplacantAuMontage === undefined) return;
    setGearSource('box');
    setSourceSelector(remplacantAuMontage);
  }, []);
  const avantEnregistrement = !montageEnregistre.current && remplacantAuMontage !== undefined;
  const gearSource: ExclusionSource = avantEnregistrement ? 'box' : gearSourceMemorise;
  const sourceSelector: ExclusionSelector | null = avantEnregistrement ? remplacantAuMontage : selecteurMemorise;
  // Zone D — désambiguïsation d'exemplaire (plusieurs candidats dans la
  // source active pour l'espèce choisie, ex. 2 équipes de siège) : un
  // `Flottant` ouvert EXPLICITEMENT par un clic sur une puce (`pickSource`),
  // jamais automatiquement — voir le rendu plus bas.
  const [zoneDOpen, setZoneDOpen] = useState(false);

  // Choisit la source active ET résout l'exemplaire s'il n'y en a qu'UN pour
  // l'espèce courante dans cette source — sinon ouvre la désambiguïsation
  // (zone D) plutôt que de deviner. Une puce désactivée (aucun candidat,
  // voir `candidatesBySource`) n'appelle jamais cette fonction (voir
  // `disabled` du `Segmented`, plus bas).
  // Un autre exemplaire de la MÊME espèce est désigné (puce de source,
  // zone D, même espèce rechoisie au bestiaire) : le choix de relique de
  // l'utilisateur est gardé, sauf « Garder la relique équipée » sur un
  // exemplaire qui n'en porte pas — la recherche tournerait alors sans
  // relique, sans rien en dire.
  function reliqueCoherenteAvecExemplaire(relique: RelicDetail | undefined) {
    optimizer.poserCriteresAutomatiques((c) => ({ relicMainChoice: relicMainChoiceApresChangementExemplaire(c.relicMainChoice, relique, true) }));
  }

  function pickSource(source: ExclusionSource) {
    optimizer.effacerProprietaireCriteres();
    setGearSource(source);
    const candidates = candidatesBySource[source];
    if (candidates.length === 1) {
      setSourceSelector(candidates[0].selector);
      reliqueCoherenteAvecExemplaire(candidates[0].gear.relic);
      setZoneDOpen(false);
    } else if (candidates.length > 1) {
      setSourceSelector(null);
      setZoneDOpen(true);
    } else {
      setSourceSelector(null);
      setZoneDOpen(false);
    }
  }

  // Choisit l'ESPÈCE (recherche bestiaire, voir `MonsterSourcePicker mode=
  // "bestiary"` plus bas) — remet TOUJOURS la source à Box (valeur par
  // défaut) et résout directement le PREMIER
  // exemplaire Box (demande explicite : plutôt qu'ouvrir la désambiguïsation
  // dès qu'il y en a plusieurs, choisir un exemplaire par défaut — l'utilisateur
  // reste libre de changer via la zone D). Aucun exemplaire Box, mais possédée
  // ailleurs (RTA/siège) : repli sur `null`, jamais la désambiguïsation
  // ouverte automatiquement — un clic sur la recherche ne doit pas faire
  // surgir un panneau qu'on n'a pas demandé, voir docs/03-developpeur/interface/.
  // ⚠️ Possédée NULLE PART : `unownedSelectorIfNoneOwned` — permet
  // « Ajouter à la liste »/« Valider ce build » sur ses stats de base 6★
  // seules (demande explicite, voir ExclusionSelector « unowned »).
  function pickSpecies(monster: Monster) {
    optimizer.effacerProprietaireCriteres();
    const id = String(monster.id);
    // ⚠️ Calculé AVANT le `if` : le défaut de
    // relique (ci-dessous) a besoin du premier exemplaire Box pour
    // connaître la relique RÉELLEMENT portée, comme `setSourceSelector` plus
    // bas — un seul calcul, pas une résolution séparée qui pourrait diverger.
    const boxCandidates = speciesCandidatesBySource(monster.com2usId, box, exclusionData).box;
    if (id !== selectedId) {
      resetSearch();
      const defauts = criteresApresChangementEspece(optimizer, 'bestiaire', boxCandidates[0]?.gear);
      // ⚠️ **Le défaut affiché doit être celui qui s'applique — jamais un
      // défaut faux, comme cela s'est vu pour les artéfacts** : `defaultRelicMainChoice` (useOptimizerState.ts)
      // est la SOURCE du défaut, câblée ici parce que c'est le seul site qui
      // connaît le monstre choisi (le hook n'y a pas accès) — comme
      // `objective` juste en dessous, remis à zéro puis surchargé au même
      // endroit.
      optimizer.poserCriteresAutomatiques({ relicMainChoice: defauts.relicMainChoice });
      /**
       * ⚠️ **Un sort appartient à un MONSTRE.** `skillCom2usId` désigne un
       * sort précis ; après un changement de monstre, `resolveDamageSkill`
       * retombe silencieusement sur le sort par défaut du nouveau. Tant que
       * la carte de combat était dépliée sous l'objectif on voyait le sort
       * revenir au défaut ; derrière une fenêtre fermée, ce repli devient
       * invisible et l'on croirait calculer sur un sort qu'on a choisi.
       *
       * Remettre les deux sélecteurs au défaut rend ce repli IMPOSSIBLE
       * plutôt que visible. Réoptimiser en dégâts demande alors de recliquer
       * « Dégâts réels » et de rechoisir le sort — le geste qui manquait.
       *
       * Le reset garde le contexte commun mais vide le sort et ses réglages
       * associés. Recliquer « Dégâts réels » retrouve le combat décrit.
       *
       * ⚠️ **Ici et surtout PAS dans un `useEffect` sur le monstre
       * sélectionné** : `importRecipe` pose le monstre ET l'objectif
       * directement, sans passer par cette fonction — un effet se
       * déclencherait APRÈS l'import et écraserait l'objectif de la recette
       * qu'on vient de charger.
       *
       * ⚠️ Granularité : l'ESPÈCE. Passer de Box à RTA ne passe pas par ici,
       * et c'est voulu — les sorts restent les mêmes.
       */
      optimizer.poserCriteresAutomatiques({ objective: defauts.objective, critereArtefacts: defauts.critereArtefacts });
    }
    else reliqueCoherenteAvecExemplaire(boxCandidates[0]?.gear.relic);
    setSelectedId(id);
    setGearSource('box');
    setSourceSelector(boxCandidates[0]?.selector ?? unownedSelectorIfNoneOwned(monster, box, exclusionData));
    setZoneDOpen(false);
  }

  // Bureau uniquement : ferme la désambiguïsation d'exemplaire (zone D) au
  // clic extérieur — même patron que `avancesRef`/« Réglages avancés » plus
  // bas. Au doigt, la zone D est un bloc INLINE (pas un `Flottant`), donc ce
  // garde n'a rien à fermer par-dessus autre chose.
  const zoneDRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!zoneDOpen) return;
    const onDown = (e: MouseEvent) => {
      if (zoneDRef.current && !zoneDRef.current.contains(e.target as Node)) setZoneDOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [zoneDOpen]);

  // Mobile uniquement : la zone C (liste des
  // monstres à optimiser) est un dépliement REPLIÉ par défaut, rattaché
  // sous la barre de recherche — sur bureau, elle reste un encart FIXE
  // toujours visible. La zone D, elle, n'a pas besoin
  // d'un second état : `zoneDOpen` ci-dessus pilote déjà sa visibilité des
  // deux côtés, seule sa PRÉSENTATION change (`Flottant` flottant vs bloc
  // en ligne, voir le rendu plus bas).
  const [zoneCOpen, setZoneCOpen] = useState(false);

  // Confirmation avant de libérer un build validé — demande explicite de
  // l'utilisateur. Porte la PAIRE (liste, sélecteur) à libérer (`null` =
  // dialogue fermé), pas juste un booléen, pour savoir LAQUELLE confirmer —
  // un build validé est identifié par les DEUX (le même
  // exemplaire peut porter un build différent dans deux listes).
  const [releaseConfirm, setReleaseConfirm] = useState<{ listId: string; selector: ExclusionSelector } | null>(null);
  // Confirmation avant de libérer TOUTES les runes validées d'une liste
  // d'un coup — porte l'id de la liste concernée.
  // Confirmation avant de rendre la PAIRE d’artéfacts d’un build validé,
  // ses runes restant réservées — destructif comme `releaseConfirm`, donc
  // confirmé de la même façon.
  const [releaseArtifactsConfirm, setReleaseArtifactsConfirm] = useState<{
    listId: string;
    selector: ExclusionSelector;
  } | null>(null);
  const [releaseAllConfirm, setReleaseAllConfirm] = useState<string | null>(null);
  // Confirmation avant de retirer un monstre DÉJÀ VALIDÉ de la liste — le
  // retrait libère aussi ses runes (voir `removeMember`), donc destructif
  // comme `releaseConfirm` ; un monstre PAS ENCORE validé se retire sans
  // rien demander (rien à perdre).
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<{ listId: string; selector: ExclusionSelector } | null>(null);
  // Ouvre la saisie du nom quand on veut ajouter le monstre courant (ou
  // valider son runage actuel) alors qu'aucune liste n'est encore active —
  // crée la liste ET fait l'action d'origine dans le même geste. Porte
  // laquelle des deux actions relancer une fois la liste créée (voir
  // `handleAddToList`/`handleValidateDisplayed` plus bas), pas juste un
  // booléen — les deux boutons partagent ce même prompt.
  const [addListPromptOpen, setAddListPromptOpen] = useState<'add' | 'validate' | null>(null);
  const [equipeOuverte, setEquipeOuverte] = useState<{ listId: string; equipe: EquipeOptimizer | null } | null>(null);

  // L'exemplaire RÉELLEMENT optimisé — l'entrée choisie explicitement (ou
  // résolue sans ambiguïté, voir `pickSource`/la revérification au montage
  // ci-dessus) via `sourceSelector`. ⚠️ Repli sur l'ESPÈCE SEULE (stats de
  // base 6★ niveau max, `monsterBaseStats`, sans rune ni artéfact) — deux
  // chemins DISTINCTS y mènent : `sourceSelector` porte un sélecteur
  // `unowned` (espèce possédée dans AUCUNE des 4 sources, voir
  // `unownedSelectorIfNoneOwned` — même stats de base, mais un sélecteur
  // RÉEL, ajoutable à une liste/validable comme un exemplaire) ; OU
  // `sourceSelector` reste `null` (repli tout en bas de ce `useMemo`) parce
  // que la source active propose PLUSIEURS candidats sans qu'un choix ait
  // encore été fait (zone D ouverte) — possédée quelque part, juste pas
  // encore désambiguïsée. `null` UNIQUEMENT si aucune espèce n'est choisie
  // du tout (recherche vide).
  // Clé du sélecteur ACTIF — sert d'auto-exemption pour les runes validées
  // (voir `otherValidatedRuneIds` plus bas) et à retrouver si CET exemplaire
  // a déjà un build validé (`findValidatedBuild`).
  const ownSelectorKey = sourceSelector ? exclusionSelectorKey(sourceSelector) : null;
  const ownValidatedBuild = findValidatedBuild(lists.validated, lists.activeListId, ownSelectorKey);
  const runesAbsentesValidees = ownValidatedBuild ? runesManquantesDuBuild(ownValidatedBuild, runeById) : [];

  // Bascule d'affichage de la fiche quand un build VALIDÉ existe pour
  // l'exemplaire actif — demande explicite : « une fois le runage validé,
  // on ne peut plus voir à quoi ressemblait le runage précédent tant qu'on
  // est dans la liste ». `false` = build validé (défaut, l'illusion
  // habituelle) ; `true` = équipement RÉELLEMENT porté, celui qu'aurait
  // affiché la fiche SANS validation. ⚠️ Réinitialisée à CHAQUE changement
  // d'exemplaire (`ownSelectorKey`) — sans quoi choisir un autre monstre
  // garderait « runage actuel » affiché pour un exemplaire dont ce n'est
  // pas ce qu'on a demandé à voir.
  const [showRealGear, setShowRealGear] = useState(false);
  useEffect(() => {
    setShowRealGear(false);
  }, [ownSelectorKey]);

  const selected = useMemo(() => {
    if (sourceSelector) {
      const resolved = resolveExclusionEntry(sourceSelector, exclusionData);
      if (resolved) {
        // ⚠️ **Runes VALIDÉES affichées comme équipées** — un build
        // trouvé par la recherche puis validé n'est PAS réellement reruné en
        // jeu ; substituer seulement `runes` (base/artéfacts/relique restent
        // ceux réellement équipés, voir docs/02-app/optimizer/,
        // « Zone C — Monstres de la liste ») donne l'illusion voulue « ce
        // monstre porte déjà ce build » sans toucher au reste de la fiche.
        // `showRealGear` désactive CETTE substitution (mais pas la
        // résolution elle-même) pour retrouver l'équipement réel sur
        // demande.
        if (ownValidatedBuild && !showRealGear) {
          const validatedRunes = ownValidatedBuild.runeIds
            .map((id) => runeById.get(id))
            .filter((r): r is RuneDetail => !!r);
          // ⚠️ **Les ARTÉFACTS aussi, pas seulement les runes.** Ne substituer
          // que les runes rejouait la paire que le monstre porte AUJOURD'HUI,
          // alors que la recherche en avait retenu une autre — défaut signalé à
          // l'usage. Un build validé est un instantané complet.
          //
          // ⚠️ Repli sur les artéfacts réels quand le build validé n'en porte
          // pas : c'est le cas des builds validés AVANT que ce champ existe.
          // Mieux vaut la paire réelle que pas d'artéfact du tout.
          const validatedArts = (ownValidatedBuild.artifactIds ?? [])
            .map((id) => artifactById.get(id))
            .filter((a): a is ArtifactDetail => !!a);
          return {
            monster: resolved.monster,
            gear: {
              ...resolved.gear,
              runes: validatedRunes,
              artifacts: validatedArts.length > 0 ? validatedArts : resolved.gear.artifacts,
            },
          };
        }
        return resolved;
      }
    }
    if (!speciesMonster) return null;
    return { monster: speciesMonster, gear: { base: monsterBaseStats(speciesMonster), runes: [], artifacts: [] } };
  }, [sourceSelector, exclusionData, speciesMonster, ownValidatedBuild, runeById, artifactById, showRealGear]);

  // Un réimport du compte remet les critères à zéro (`resetSearch('compte')`,
  // App.tsx) sans connaître le monstre resté sélectionné : le défaut de
  // relique se recalcule ici, contre la relique qu'il porte dans le compte
  // réimporté — UNE fois par import. Le traitement partagé garde aussi les
  // critères d'un membre choisi après le réimport pendant l'absence de l'écran.
  const reliqueAffichee = useRef<RelicDetail | undefined>(undefined);
  reliqueAffichee.current = selected?.gear.relic;
  useEffect(() => {
    traiterReliqueImportee(reliqueAffichee.current);
  }, [importDuCompte, traiterReliqueImportee]);

  /**
   * Les stats de RÉFÉRENCE du bouton « Comparer » — celles de la fiche.
   *
   * ⚠️ Déclarées ICI, juste après `selected`, et pas à côté de `compareKey`
   * plus haut : `selected` est un `useMemo` déclaré à cette ligne, et le lire
   * avant produit un « used before its declaration » que seul `tsc` attrape —
   * `npm run build` passait sans broncher.
   *
   * ⚠️ **Rien à recalculer pour couvrir « validé sinon courant »** :
   * `selected.gear` EST déjà le build validé quand il en existe un (runes ET
   * artéfacts substitués, voir juste au-dessus), et l'équipement réel sinon.
   * Refaire cette résolution ici l'aurait dupliquée, et aurait raté « Voir le
   * runage réellement porté », qui la désactive exprès.
   */
  const statsReference = useMemo(() => (selected ? computeStats(selected.gear) : null), [selected]);
  // Les activations d'aura des runes de CETTE fiche : elles
  // accompagnent `statsReference` et tout calcul fait sur `selected.gear`
  // (paire représentative, bloc « Meilleurs artéfacts »). Sans rune, zéro.
  const aurasPropresFiche = useMemo(() => aurasPropresDesRunes(selected?.gear.runes ?? []), [selected]);
  /**
   * La référence d'efficience/score total du bouton « Comparer » (celles des
   * PV effectifs et des dégâts réels : `refEhp`/`refDegats`, plus bas).
   *
   * ⚠️ L'efficience se somme sur les runes de la fiche dans la mesure
   * COURANTE, comme `candidateMetricTotal` le fait pour un candidat : figer la
   * mesure de la recherche donnerait un écart faux dès qu'on bascule
   * Efficience ↔ Score sans relancer.
   */
  const refMetric = useMemo(
    () =>
      selected
        ? selected.gear.runes.reduce((n, r) => n + (metric === 'eff' ? runeEfficiency(r) : runeScore(r)), 0)
        : null,
    [selected, metric]
  );

  // `unitKey` (box) de l'entrée à protéger contre sa propre exclusion —
  // seulement quand l'exemplaire RÉELLEMENT résolu est un exemplaire Box
  // (`sourceSelector` porte alors sa clé précise). ⚠️ Quand la source est
  // RTA/siège, le build BOX de cette même espèce n'est PAS l'exemplaire
  // optimisé : c'est alors une entrée comme une autre, légitimement
  // excluable — la protéger aurait empêché de l'exclure à tort. La
  // protection de l'exemplaire RTA/siège réellement optimisé, elle, passe
  // par `ownCom2usId` (species-level, déjà correct dans
  // `resolveExcludedRuneIds`/`autoExcludedRuneIds` pour CE cas précis, voir
  // leurs propres commentaires).
  const selectedUnitKey = sourceSelector?.source === 'box' ? sourceSelector.unitKey : null;

  const pool = useMemo(() => {
    if (!selected) return runes;
    // Se SUPERPOSENT, ne se remplacent pas : `excludeUsedRunes` l'exclusion
    // automatique (un périmètre entier, RTA/Défenses siège/Box),
    // `excludedSelectors` l'exclusion manuelle en plus (entrée par entrée,
    // n'importe laquelle des 4 sources), `lists.validated` les runes déjà
    // VALIDÉES pour un AUTRE monstre de LA MÊME liste active (scopé
    // par liste, deux listes ne se bloquent jamais entre elles) — voir
    // optimizerExclusion.ts. Jamais les siennes propres (`ownSelectorKey`) :
    // sans cette exemption, relancer une recherche sur un monstre déjà
    // validé s'auto-bloquerait avec ses propres runes.
    const auto = excludeUsedRunes
      ? autoExcludedRuneIds(excludeUsedScope, exclusionData, selected.monster.com2usId)
      : new Set<number>();
    const manual = resolveExcludedRuneIds(excludedSelectors, exclusionData, selectedUnitKey, selected.monster.com2usId);
    const reserved = otherValidatedRuneIds(lists.validated, lists.activeListId, ownSelectorKey);
    if (auto.size === 0 && manual.size === 0 && reserved.size === 0) return runes;
    return runes.filter((r) => !auto.has(r.id) && !manual.has(r.id) && !reserved.has(r.id));
  }, [selected, selectedUnitKey, excludeUsedRunes, excludeUsedScope, excludedSelectors, exclusionData, runes, lists.validated, lists.activeListId, ownSelectorKey]);

  // Artéfacts déjà réservés par les AUTRES builds validés de la liste active.
  //
  // ⚠️ Pendant symétrique de `reserved` ci-dessus, et pour la même raison : un
  // artéfact physique ne se porte que sur UN monstre à la fois. Il n'a en
  // revanche PAS d'équivalent des exclusions automatique et manuelle — celles-là
  // portent sur des périmètres de runes (RTA / défenses de siège / box) et sur
  // des sélecteurs de runes, sans notion d'artéfact.
  const artefactsReserves = useMemo(
    () => otherValidatedArtifactIds(lists.validated, lists.activeListId, ownSelectorKey),
    [lists.validated, lists.activeListId, ownSelectorKey]
  );

  // ⚠️ Purge les sélecteurs d'exclusion manuelle devenus AUTO-exclusion
  // depuis un changement de monstre recherché — `resolveExcludedRuneIds`
  // (ci-dessus, dans `pool`) les ignore déjà pour le calcul réel du pool
  // (garantie de justesse, pas juste cosmétique), mais sans cette purge un
  // sélecteur devenu inerte resterait affiché comme « sélectionné » dans
  // RuneExclusionPicker sans plus rien faire — trompeur. Trouvé par une
  // revue de code externe (`excludedSelectors` ne réagissait jusqu'ici à
  // aucun changement de `selectedId`). Même double granularité que
  // `resolveExcludedRuneIds` : box par ENTRÉE (`selectedUnitKey`), RTA/
  // siège par ESPÈCE (`com2usId`) — un second exemplaire box de la même
  // espèce reste une sélection légitime, jamais purgée à tort.
  //
  // ⚠️ `resolveExclusionEntry` (déjà exporté, résout box/rta/siège-défense/
  // siège-offense par `sel.source`), PAS un `.concat(siegeDefenseTeams,
  // siegeOffenseTeams).find(t => t.id === sel.teamId)` maison — une
  // revue de code a relevé que cette version
  // précédente est fautive : `SiegeTeam.id` peut retomber sur `t_${Date.now()}_
  // ${random}` quand `crypto.randomUUID` est indisponible (contexte non
  // sécurisé, voir `useSiegeState.ts`), avec un risque de collision entre
  // une équipe défense et une équipe offense créées à la même
  // milliseconde — chercher dans les deux listes concaténées sans
  // regarder `sel.source` pouvait alors résoudre la MAUVAISE équipe.
  useEffect(() => {
    const ownCom2usId = selected?.monster.com2usId ?? null;
    if (ownCom2usId == null) return;
    setExcludedSelectors((prev) => {
      const next = prev.filter((sel) => {
        if (sel.source === 'box') return sel.unitKey !== selectedUnitKey;
        const monster = resolveExclusionEntry(sel, exclusionData)?.monster;
        return monster?.com2usId !== ownCom2usId;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [selected?.monster.com2usId, selectedUnitKey, exclusionData, setExcludedSelectors]);

  // Artéfacts RÉELLEMENT transmis au moteur — indépendants de ceux affichés
  // dans « Équipement actuel » (toujours les VRAIS, une photo de l'existant,
  // jamais modifiée par ces réglages). Optimisation COUPÉE = on garde les
  // pièces réellement portées, avec leurs statistiques — on cesse seulement
  // d'en chercher d'autres. Activée, chaque emplacement (Attribut/Type, voir
  // ARTIFACT_KINDS) suit son propre choix : `'equipped'` (défaut) reprend
  // l'artéfact réellement porté à cet emplacement DU BUILD DE BASE, `'libre'`
  // cherche parmi tous les éligibles, et un code de stat FILTRE l'inventaire
  // sur cette principale.
  //
  // ⚠️ **Il n'y a pas de cran « Aucun ».** Vider UN emplacement pendant que
  // l'autre cherche ne correspond à rien en jeu ; ne pas compter les artéfacts
  // est une décision GLOBALE, portée par `optimiserArtefacts`. L'emplacement peut
  // toujours rester vide si la recherche n'a rien de mieux à y mettre —
  // `candidatsParSorte` propose `null` quel que soit le réglage.
  //
  // ⚠️ **Un code de stat n'hypothèque plus une pièce.** Il fabriquait avant un
  // artéfact `subs: []` : en « Dégâts réels », choisir « ATQ » faisait alors
  // calculer les dégâts SANS aucune ligne d'effet, quand « Comme équipé » les
  // comptait — deux réglages voisins, deux modèles de dégâts, sans que rien ne
  // le signale. On prend donc la paire RÉELLE que le choix d'artéfacts
  // retiendrait pour l'équipement affiché (`paireRepresentative`).
  //
  // ⚠️ Ce `useMemo` doit rester le JUMEAU EXACT de `resolveArtifacts`
  // (scripts/lib/recipeToSearchParams.ts) — deux constructeurs pour un même
  // contrat, dont `tsc` ne verra jamais la divergence.
  // ⚠️ **`selected.gear` suit l'EXEMPLAIRE choisi par les 4 puces**
  // (`sourceSelector` — Box/RTA/Défenses siège/Offenses siège), pas
  // forcément un build Box : RTA et un deck de siège peuvent porter des
  // artéfacts DIFFÉRENTS pour le MÊME monstre (presets de runage/artéfacts
  // séparés, pas une seule vérité par monstre). `'equipped'` par défaut est
  // donc une hypothèse implicite (« le build actuellement affiché »), pas
  // une garantie que ça matche le build qu'un joueur cherche réellement à
  // reproduire — d'où l'intérêt des deux autres choix pour hypothéquer un
  // artéfact différent sans avoir à changer de monstre.
  //
  // ⚠️ Les paramètres sont extraits dans leur PROPRE memo : la paire retenue et
  // le diagnostic « pourquoi aucune ne passe » doivent partager EXACTEMENT la
  // même définition. Deux constructions parallèles finiraient par diverger, et
  // le diagnostic expliquerait alors une recherche qui n'a pas eu lieu.
  /**
   * Les emplacements d'artéfact dont la pièce est DÉJÀ décidée — « Garder
   * l'artéfact équipé », donc un seul candidat, rien à chercher.
   *
   * ⚠️ **C'est le défaut**, pour les deux sortes : à l'ouverture, aucun
   * emplacement ne cherche. Un verrou de sous-propriété y est alors sans
   * effet — au mieux la pièce portée le tient déjà, au pire plus aucune paire
   * ne passe et la recherche refuse de partir.
   */
  /**
   * Le critère sur lequel la paire d’artéfacts est optimisée.
   *
   * ⚠️ **Le TRI si l’utilisateur le demande, l’OBJECTIF sinon.** Le tri est
   * une VUE, l’optimisation une DÉCISION : les coupler d’office déplaçait la
   * paire dès qu’on changeait de tri pour explorer. Voir
   * `adapterArtefactsAuTri`.
   */
  const critereArtefactsPaire = adapterArtefactsAuTri ? sortBy : objective;
  const regimePaire = regimeArtefacts(critereArtefactsPaire);
  /**
   * Le régime EFFECTIF de l'équipement complet — paire ET relique (le bouton
   * gouverne les deux, aucun interrupteur parallèle) : sort
   * non calculable → rabattu sur `'aucun'` ICI, une seule fois, jamais un
   * contexte de dégâts optionnel absorbé en silence par `evaluerPourRegime`.
   */
  const regimeEquipement: RegimeArtefacts = regimeEquipementDe(regimePaire, !!contexteDegatsArtefacts);

  /**
   * Le contexte de l'assiette `Y` des propriétés uniques de relique
   * (`relicExclusive.ts`) : le `DamageSetup` et l'élément de l'espèce.
   *
   * ⚠️ **Indépendant du contexte de dégâts** : « État de mon monstre » (lead,
   * compétences d'invocateur) modifie les statistiques quel que soit
   * l'objectif choisi, et « PV effectifs » n'a pas de sort calculable à
   * fournir. Un seul objet, donné au choix de l'équipement ET au classement —
   * jamais deux lectures qui divergeraient.
   */
  const contexteExclusive = useMemo(
    () => ({ setup: damageSetup, element: speciesMonster?.element ?? null }),
    [damageSetup, speciesMonster?.element]
  );

  /**
   * Les valeurs de référence « PV effectifs » et « Dégâts réels » du bouton
   * « Comparer » : la FICHE notée comme un candidat, par `scoreDeReference`
   * (runeBuildOptim.ts) — ses stats, ses auras propres, le profil de SA paire
   * d'artéfacts et l'effet unique de SA relique, avec des options propres à
   * la référence, jamais les accesseurs du cache des résultats.
   *
   * ⚠️ L'écart « Dégâts réels » mêlait les stats de la fiche
   * au profil de `searchArtifacts` (la paire de la recherche, hypothétique
   * comprise) et omettait l'effet unique des deux côtés de la référence :
   * faux dans les deux sens. Déclarées APRÈS
   * `contexteExclusive`, qu'elles lisent pendant le rendu.
   */
  const contexteReference = useMemo(
    () => ({ degats: contexteDegatsArtefacts, damageSetup, exclusive: contexteExclusive }),
    [contexteDegatsArtefacts, damageSetup, contexteExclusive]
  );
  const refEhp = useMemo(
    () => (selected ? scoreDeReference('ehp', selected.gear, contexteReference) : null),
    [selected, contexteReference]
  );
  const refDegats = useMemo(
    () => (selected ? scoreDeReference('degats_reels', selected.gear, contexteReference) : null),
    [selected, contexteReference]
  );

  const sortesFigees = useMemo<ArtifactKind[]>(() => sortesFigeesDe(artifactMainByKind), [artifactMainByKind]);

  const evaluateursFiche = useMemo(
    () => selected ? evaluateursArtefactsFiche(
      selected.gear, objective, aurasPropresFiche, contexteDegatsArtefacts, contexteExclusive, combatStats
    ) : null,
    [selected, objective, aurasPropresFiche, contexteDegatsArtefacts, contexteExclusive, combatStats]
  );

  const artifactParams = useMemo(() => {
    // ⚠️ **Optimisation désactivée ≠ sans artéfact.** Les paramètres restent
    // construits, avec « Garder l'artéfact équipé » IMPOSÉ des deux côtés : le
    // monstre conserve les pièces qu'il porte réellement et leurs statistiques,
    // on cesse seulement d'en chercher d'autres. Le réglage retirait avant
    // TOUTE contribution d'artéfact, ce qui rendait les conditions minimales
    // plus dures à franchir sans que rien ne le dise.
    if (!selected || !evaluateursFiche) return null;
    const espece = selected.monster;
    // ⚠️ Le score de la paire dépend de l'OBJECTIF, et PAS de la même façon
    // pour tous : `pvEffectifs` (PV effectifs) n'est PAS une somme des deux
    // principales, contrairement à l'efficience/la VIT (voir
    // docs/03-developpeur/optimizer/).
    // `evaluerPourRegime` centralise ce contrat, partagé avec le site « au
    // fil de l'eau » plus bas et le CLI (`recipeToSearchParams.ts`).
    //
    // ⚠️ **Le RÉGIME suit `objective`, jamais `regimePaire`/`sortBy`** : cette
    // paire sert à LANCER/BORNER la recherche avant qu'aucun résultat
    // n'existe, alors que `regimePaire` répond à « qu'est-ce que je REGARDE
    // en ce moment » (docs/03-developpeur/optimizer/, « Régime de
    // la paire »). `objective` (`Objective`,
    // runeBuildOptim.ts) ne peut jamais valoir `'hp'`/`'atk'`/`'def'` : seuls
    // `degats_reels`/`ehp`/`aucun` sont possibles ici.
    //
    // ⚠️ `resolvedSkill`/`offensivePassives` (plus haut) ne dépendent QUE de la
    // fiche du monstre, jamais des artéfacts — c'est ce qui évite la
    // circularité avec `realDamage`, qui est construit APRÈS ce bloc et lit
    // `searchArtifacts`.
    //
    // ⚠️ **Producteur partagé** (`parametresArtefactsFiche`) : le CLI
    // et le différentiel relique l'appellent aussi, neutralisation des verrous
    // comprise. Appelé DANS ce mémo, avec ses dépendances d'avant : sorti du
    // mémo, `paireRepresentative` se recalculerait à chaque rendu.
    // `sortesFigees` y reste : dérivé d'`artifactMainByKind` seul, il change
    // exactement avec lui.
    //
    // ⚠️ `artefactsReserves` : les artéfacts RÉSERVÉS par les autres builds
    // validés de la liste active sortent de l'inventaire — un artéfact
    // physique ne se porte que sur un monstre à la fois, comme une rune. Ceux
    // que CE monstre a lui-même réservés restent disponibles (auto-exemption
    // dans `otherValidatedArtifactIds`).
    const evaluer = evaluateursFiche.representatif;
    return {
      ...parametresArtefactsFiche({
        porteur: { element: espece.element, archetype: espece.archetype },
        inventaire: artifacts,
        reserves: artefactsReserves,
        equipes: selected.gear.artifacts,
        optimiserArtefacts,
        principaleParSorte: artifactMainByKind,
        lignesVerrouillees,
        damageSetup,
        maxStats,
      }),
      evaluer,
    };
  }, [selected, evaluateursFiche, optimiserArtefacts, artifactMainByKind, sortesFigees, artifacts, artefactsReserves, lignesVerrouillees, damageSetup, maxStats]);

  const searchArtifacts = useMemo<ArtifactDetail[]>(
    () => (artifactParams ? paireRepresentative(artifactParams) : []),
    [artifactParams]
  );

  /**
   * « Meilleurs artéfacts offensifs pour ce build » — l'optimisation d'artéfacts SEULE,
   * sans recherche de runes.
   *
   * ⚠️ **Le calcul existe déjà** : `searchArtifacts` EST la meilleure paire
   * pour l'équipement affiché, sous les contraintes courantes. Ce mode ne
   * calcule donc rien de neuf — il MONTRE ce qui était jusqu'ici invisible, et
   * le chiffre contre la paire réellement portée.
   *
   * Sert au cas qui a motivé la fonctionnalité : un monstre dont le build est
   * figé par un autre objectif (un tank runé pour survivre) et à qui les
   * artéfacts ajoutent des dégâts par-dessus, sans toucher aux runes.
   *
   * `null` quand la comparaison n'aurait pas de sens : hors « Dégâts réels »
   * le score d'une paire est une somme de stats principales, pas un total
   * comparable.
   */
  const modeArtefactsSeuls = useMemo(() => {
    // ⚠️ **PAS de condition sur l'objectif — c'est tout l'intérêt.** Ce bloc
    // était limité à « Dégâts réels », ce qui le rendait inutile exactement là
    // où il sert le plus : un monstre runé pour SURVIVRE (efficience, PV
    // effectifs, vitesse) porte de gros PV/DEF/VIT, que les lignes 218-221
    // convertissent en dégâts — son build est déjà figé par un autre objectif,
    // et les artéfacts se posent par-dessus. C'est le cas fondateur de ce bloc
    // (docs/02-app/optimizer/).
    // ⚠️ Rien à montrer sans optimisation : ce bloc EST une optimisation
    // d'artéfacts, et il répondrait « la meilleure paire est celle que tu
    // portes » — vrai, mais uniquement parce qu'on lui a interdit d'en
    // chercher une autre. Une réponse qui n'est vraie que par construction.
    if (!artifactParams || !selected || !evaluateursFiche || !optimiserArtefacts) return null;
    // ⚠️ Un seul `computeStats` pour toutes les paires : l’apport d’un artefact
    // est PLAT, donc les stats sans artefact se calculent une fois et chaque
    // paire ne coute plus que trois additions (voir `statsParPaire`).
    /**
     * ⚠️ **Les dégâts BRUTS des artéfacts (218-221), et rien d'autre.**
     *
     * Une première version notait avec `computeTotalDamage`, donc avec un
     * SORT, une CIBLE et un mode de CRITIQUE. Trois choix que l'utilisateur n'a
     * jamais faits quand son objectif de recherche n'est pas les dégâts : le
     * sort tombait sur un défaut arbitraire, l'adversaire et le taux critique
     * sur ceux d'un réglage jamais ouvert. Un classement bâti là-dessus a l'air
     * juste et repose sur des hypothèses invisibles.
     *
     * Les lignes 218-221 ne critent pas et ignorent la défense adverse : elles
     * se chiffrent donc **entièrement** à partir des stats du build et des
     * buffs — base, runes, artéfacts, compétences d'invocateur, leader skill,
     * et l'amplification des buffs par les artéfacts eux-mêmes. Aucun sort,
     * aucune cible, aucun critique.
     *
     * ⚠️ Le nombre de coups n'entre pas : il multiplie toutes les paires
     * pareil et ne change donc aucun classement.
     */
    const evaluerBrut = evaluateursFiche.brut;
    /**
     * ⚠️ **Le cran « Dégâts réels » choisit une AUTRE paire**, il ne réaffiche
     * pas la même autrement. Il maximise les dégâts
     * TOTAUX du sort visé contre l'adversaire décrit, quand `evaluerBrut`
     * maximise les seuls dégâts supplémentaires. Les deux optima diffèrent :
     * une paire chargée en Dgts CRIT bat une paire chargée en 218-221 sur le
     * total, et perd sur le brut.
     *
     * ⚠️ **Ce que la fenêtre rend légitime.** Une telle optimisation sans
     * fenêtre reposerait sur un sort, une cible et un mode de critique
     * jamais choisis — « un classement qui a l'air juste et repose sur des
     * hypothèses invisibles ». Choisir ce cran OUVRE la fenêtre : les
     * hypothèses sont vues et posées.
     *
     * ⚠️ Le contexte complet est le même que celui du moteur et de la file
     * (voir `contexteDegatsArtefacts`) : modificateurs monstre-wide compris.
     */
    const evaluerReel = evaluateursFiche.reel;
    // ⚠️ Repli sur le brut si aucun sort n'est calculable pour ce monstre —
    // jamais un bloc vide : le cran resterait sur « Dégâts réels » sans que
    // rien n'explique le silence.
    const surLeReel = critereArtefacts === 'reel' && evaluerReel != null;
    const evaluerDegats = surLeReel ? evaluerReel : evaluerBrut;
    const paramsDegats: ArtifactSearchParams = { ...artifactParams, evaluer: evaluerDegats };
    // ⚠️ Et donc une PAIRE propre : celle que la recherche a supposée maximise
    // l'objectif de recherche, pas les dégâts. Les deux coïncident en « Dégâts
    // réels » et divergent partout ailleurs.
    const retenue = paireRepresentative(paramsDegats);
    const actuels = selected.gear.artifacts;
    const scoreActuel = evaluerDegats(actuels);
    const scoreRetenu = evaluerDegats(retenue);
    /**
     * Pourquoi il n'y a rien à proposer — une PHRASE, jamais un bloc qui
     * s'efface.
     *
     * ⚠️ **Le bloc disparaissait en silence** (`return null` sur
     * `scoreRetenu <= 0`), et c'était la cause réelle du « il est affiché,
     * sinon il disparaît » signalé à l'usage. Avec un emplacement figé il n'y a
     * qu'une paire candidate — celle qui est portée : le bloc apparaissait ou
     * non selon qu'elle porte des lignes de dégâts bruts. Un bloc qui va et
     * vient sans raison visible se lit comme une panne.
     *
     * ⚠️ **Le figeage passe DEVANT « tu portes déjà la meilleure ».** Cette
     * phrase-là serait vraie, mais uniquement parce qu'on a interdit de
     * chercher : elle ferait passer une contrainte posée par l'utilisateur pour
     * un verdict sur son inventaire.
     */
    const explication =
      sortesFigees.length >= ARTIFACT_KINDS.length
        ? 'Les deux emplacements sont sur « Garder l’artéfact équipé » : la paire est déjà décidée, il n’y a rien à chercher.'
        : scoreRetenu <= 0
          ? 'Aucun artéfact équipable n’apporte de dégâts supplémentaires pour ce critère.'
          : null;
    // ⚠️ Comparaison par IDENTIFIANT, jamais par référence : les pièces
    // retenues viennent de l'inventaire, celles portées du `gear` — deux
    // objets distincts peuvent désigner le même artéfact.
    const memesPieces =
      actuels.length === retenue.length &&
      actuels.every((a) => retenue.some((b) => b.id === a.id && a.id > 0));
    // ⚠️ **Ce que les VERROUS coûtent, chiffré ici et nulle part ailleurs.**
    // Le calcul exige de désactiver l'élagage par obligation — on ne peut pas à
    // la fois écarter une paire sans l'évaluer et connaître son score. C'est
    // donc fait pour UN build, celui qu'on regarde, jamais pour les K de la
    // file. L'élagage par pertinence et dominance reste actif : l'ordre de
    // grandeur est celui d'une recherche sans verrou (~80 ms), pas d'un
    // balayage complet.
    //
    // ⚠️ **Coût SUR CE BUILD, jamais coût global.** La recherche de runes
    // tourne elle aussi sous le modèle contraint (les verrous s'appliquent à la
    // paire supposée) : sans eux, d'autres builds auraient pu émerger. Le
    // chiffrer exigerait de relancer toute la recherche — d'où le libellé, qui
    // dit « sur ce build » et ne laisse pas croire au contrefactuel global.
    const verrous = lignesVerrouillees.filter((l) => l.min > 0);
    let coutVerrousPct: number | null = null;
    // ⚠️ Pas de balayage supplémentaire quand il n'y a rien à proposer : ce
    // calcul coûte une recherche de paires (~80 ms) pour un chiffre qu'on
    // n'affichera pas.
    if (explication == null && verrous.length > 0) {
      const sans = chercherPaires({ ...paramsDegats, avecCoutDesVerrous: true }).meilleurSansVerrous;
      if (sans != null && sans > scoreRetenu) coutVerrousPct = (1 - scoreRetenu / sans) * 100;
    }
    return {
      // `null` = il y a bien une proposition à montrer. Sinon, la raison.
      explication,
      paire: retenue,
      // ⚠️ Un DELTA ABSOLU, pas un pourcentage. La référence — les dégâts
      // bruts des artéfacts portés — vaut ZÉRO dès que le monstre n’a aucune
      // ligne 218-221, ce qui est le cas le plus intéressant : « tu n’en as
      // pas, voilà ce que tu gagnerais ». Un pourcentage y serait infini ou
      // masquerait le bloc.
      //
      // ⚠️ **Il peut être NÉGATIF, et ce n’est pas une anomalie.** La paire
      // portée n’est candidate que si RIEN ne l’exclut : une principale
      // imposée, une ligne verrouillée ou une pièce déjà réservée par un
      // autre monstre de la liste la sortent du jeu. Le meilleur atteignable
      // passe alors SOUS ce qu’on porte, et l’écart chiffre ce que la
      // contrainte coûte — l’écran l’affiche donc dans les deux sens.
      gainBrutParCoup: scoreRetenu - scoreActuel,
      /**
       * Ce que la paire retenue apporte EN ABSOLU, pas seulement l'écart avec
       * celle qui est portée (demande explicite).
       *
       * ⚠️ Les deux répondent à des questions différentes, et le delta seul
       * laissait la première sans réponse : « combien cette paire me
       * rapporte-t-elle ? » contre « combien j'y gagne par rapport à
       * maintenant ? ». Un gros gain sur une base nulle et un petit gain sur
       * une grosse base affichaient le même nombre.
       */
      degatsParCoup: scoreRetenu,
      // Ce que le chiffre MESURE, pour que l'écran n'ait pas à le redéduire :
      // des dégâts bruts par coup, ou les dégâts totaux du sort visé.
      surLeReel,
      // ⚠️ Le cran demandé n'a pas pu être servi (aucun sort calculable pour
      // ce monstre) : l'écran le DIT, plutôt que d'afficher un chiffre brut
      // sous un libellé « Dégâts réels ».
      reelIndisponible: critereArtefacts === 'reel' && evaluerReel == null,
      dejaPorte: memesPieces,
      coutVerrousPct,
    };
  }, [artifactParams, selected, evaluateursFiche, optimiserArtefacts, sortesFigees, lignesVerrouillees, critereArtefacts]);

  /**
   * Pourquoi aucune paire ne satisfait les verrous — OBSERVÉ, jamais déduit.
   *
   * ⚠️ On ne pré-calcule pas la faisabilité : un contrôle théorique pourrait
   * annoncer « impossible » sur une combinaison en fait réalisable, ce qui est
   * bien pire que de se taire. Le balayage étant exhaustif, il sait exactement
   * ce que l'inventaire permet — on rapporte donc le meilleur cumul RÉELLEMENT
   * atteignable, ligne par ligne, et l'utilisateur voit laquelle bloque et de
   * combien.
   *
   * `null` tant qu'au moins une paire passe : ce bloc n'apparaît qu'en cas
   * d'échec, il n'a rien à dire le reste du temps.
   */
  const diagnosticVerrous = useMemo(() => {
    const verrous = lignesVerrouillees.filter((l) => l.min > 0);
    if (!artifactParams || verrous.length === 0) return null;
    if (nombreDePairesRetenues(artifactParams) > 0) return null;
    return meilleurCumulParLigne(artifactParams, verrous);
  }, [artifactParams, lignesVerrouillees]);

  // Contexte de score, exigé par `objectiveScore` pour cet objectif — `null`
  // si aucun sort n'est calculable, auquel cas l'écran ne propose jamais le
  // tri « Dégâts réels » (voir `sortOptions`). Après `searchArtifacts` :
  // `artefactsDegats` en dépend (mêmes artéfacts que ceux réellement envoyés
  // au moteur, hypothétiques compris — jamais `selected.gear.artifacts`).
  const artefactsDegats = useMemo(() => artifactDamageProfile(searchArtifacts), [searchArtifacts]);
  const realDamage = useMemo<RealDamageContext | null>(
    () => (contexteDegatsArtefacts ? { ...contexteDegatsArtefacts, artefacts: artefactsDegats } : null),
    [contexteDegatsArtefacts, artefactsDegats]
  );

  // Ce que le moteur reçoit réellement — partagé entre la recherche et
  // l'estimation affichée avant de lancer quoi que ce soit (voir plus bas) :
  // les deux doivent voir EXACTEMENT la même exigence.
  const requirement = useMemo<BuildRequirement>(() => {
    const mainStatsReq: NonNullable<BuildRequirement['mainStats']> = {};
    for (const slot of CONFIGURABLE_SLOTS) {
      const codes = mainStatsBySlot[slot];
      if (codes && codes.length > 0) mainStatsReq[slot] = codes;
    }
    return { sets: comboSets, minStats, maxStats, mainStats: mainStatsReq, lockedRunes };
  }, [comboSets, minStats, maxStats, mainStatsBySlot, lockedRunes]);
  const requirementAvecAuras = useMemo(
    () => avecAurasConditions(requirement, damageSetup, compterAurasResPre),
    [requirement, damageSetup, compterAurasResPre]
  );

  /**
   * Ce que l'INVENTAIRE d'artéfacts peut apporter, borné des deux côtés —
   * ce qui décide de la FAISABILITÉ, là où `searchArtifacts` ne décide que
   * de la NOTATION.
   *
   * ⚠️ **La paire représentative ne pouvait pas tenir ce rôle.** Elle est
   * choisie pour son score ; en « Libre », `evaluer` somme les stats
   * principales et retient donc deux PV+1500, apportant `+0 DEF` alors que
   * l'inventaire contient des artéfacts DEF. Un minimum de DEF devait alors
   * être franchi par les runes seules, sans raison — au point que forcer la
   * principale sur DEF rendait PLUS de résultats que « Libre », qui autorise
   * pourtant strictement plus de paires. Voir
   * docs/03-developpeur/optimizer/, « Bornes d'apport pendant la recherche ».
   *
   * ⚠️ **La borne est calculée PAR STAT ISOLÉE, donc pas conjointement
   * atteignable** : avec des minimums sur PV, ATQ et DEF à la fois, le vecteur
   * porte les trois maxima, alors qu'une paire ne compte que deux
   * emplacements. C'est assumé — une borne optimiste ne peut que retenir trop.
   * La vérification conjointe est faite en aval par `respecteMinimums`, qui
   * n'est donc PAS optionnelle.
   *
   * ⚠️ Ne balaie que les stats réellement contraintes, dans le sens qui l'est
   * (voir `bornesArtefacts`) — sans minimum ni maximum posé, aucun balayage.
   */
  const searchArtifactBounds = useMemo(() => {
    if (!artifactParams) return undefined;
    const avecMinimum = (Object.keys(requirement.minStats) as StatKey[]).filter((k) => (requirement.minStats[k] ?? 0) > 0);
    const avecMaximum = (Object.keys(requirement.maxStats ?? {}) as StatKey[]).filter((k) => (requirement.maxStats?.[k] ?? 0) > 0);
    if (avecMinimum.length === 0 && avecMaximum.length === 0) return undefined;
    return bornesArtefacts(artifactParams, avecMinimum, avecMaximum);
  }, [artifactParams, requirement]);

  // Indication du nombre de builds qui vont être testés — un ORDRE DE
  // GRANDEUR (le produit des pools filtrés par emplacement), pas le nombre
  // réellement exploré : le meet-in-the-middle n'énumère jamais ce produit en
  // entier. Utile pour juger si les critères actuels sont trop larges ou trop
  // stricts avant d'attendre un résultat.
  const estimate = useMemo(() => {
    if (!selected || comboSets.length === 0) return null;
    return estimateSearchSpace(pool, requirementAvecAuras, selected.gear.base, slotFilterCap, objective, objectiveStats);
  }, [selected, comboSets, pool, requirementAvecAuras, slotFilterCap, objective, objectiveStats]);

  // Diagnostic affiché UNIQUEMENT si une recherche aboutit à 0 résultat (voir
  // le rendu plus bas) : pour chaque condition posée, le meilleur cas
  // MATHÉMATIQUEMENT atteignable en l'isolant des autres — permet de
  // distinguer, au moins pour certaines stats, une preuve d'impossibilité
  // d'un simple échec de la recherche à trouver ce qui existe pourtant. Coût
  // négligeable (une passe O(pool), pas une recherche) : calculée à chaque
  // rendu plutôt que seulement sur clic, elle reste bon marché même si
  // jamais affichée. Voir `diagnoseFeasibility` dans runeBuildOptim.ts pour
  // ce que « satisfiable » garantit et ne garantit PAS.
  const feasibilityDiagnosis = useMemo<StatFeasibility[]>(() => {
    if (!selected) return [];
    return diagnoseFeasibility({ base: selected.gear.base, artifacts: searchArtifacts, artifactBounds: searchArtifactBounds, relic: selected.gear.relic, pool, requirement: requirementAvecAuras, metric });
  }, [selected, searchArtifacts, searchArtifactBounds, pool, requirementAvecAuras, metric]);
  const impossibleFeasibility = useMemo(() => feasibilityDiagnosis.filter((f) => !f.satisfiable), [feasibilityDiagnosis]);

  // Palier 2 (voir `rankBlockingConditions` dans runeBuildOptim.ts) — bien
  // plus coûteux que le palier 1 ci-dessus (une dichotomie par condition
  // posée, O(N × log(plage)) passes de pré-filtrage contre une seule) :
  // calculé UNIQUEMENT quand il sera réellement affiché — activé
  // (`diagnoseBlockingEnabled`, « Réglages avancés ») ET une recherche vient
  // de renvoyer 0 résultat — jamais à chaque frappe comme le palier 1.
  const blockingDiagnosis = useMemo<BlockingConditionsDiagnosis | null>(() => {
    if (!selected || !diagnoseBlockingEnabled) return null;
    if (!result || result.candidates.length > 0) return null;
    return rankBlockingConditions({ base: selected.gear.base, artifacts: searchArtifacts, artifactBounds: searchArtifactBounds, relic: selected.gear.relic, pool, requirement: requirementAvecAuras, metric });
  }, [selected, diagnoseBlockingEnabled, result, searchArtifacts, searchArtifactBounds, pool, requirementAvecAuras, metric]);

  // `adaptiveTrancheWeighting` (toggle « Prioriser les stats les plus
  // difficiles », voir SearchParams dans runeBuildOptim.ts) — réalloue le
  // budget de rétention par tranche entre les stats demandées selon leur
  // dispersion mesurée, au lieu d'un plafond uniforme. Désactivé (défaut) :
  // comportement historique inchangé, coût nul (vérifié par mesure). Activé : recherche plus longue (+20 % de temps de
  // construction mesuré en moyenne), pour les cas où la recherche normale
  // ne trouve pas un build qui semble pourtant montable.
  //
  // `exhaustiveSearch` (toggle « Rechercher jusqu'à épuisement complet ») :
  // remplace le filet de temps de 10 min (`HARD_TIMEOUT_MS`) par `Infinity` —
  // déjà un budget-temps VALIDE pour le moteur, pas un cas spécial ajouté ici
  // (le Worker sait déjà ignorer un `maxMs` non fini, voir `estimatePct` dans
  // runeBuildOptim.worker.ts). ⚠️ Ne retire QUE la limite de temps : le
  // plafond de `maxCollected` (100 000 candidats, non exposé dans l'UI) reste
  // actif — une recherche assez lâche pour en trouver plus s'arrêtera quand
  // même avant d'avoir visité tout l'espace. Désactivé par défaut : sans lui,
  // une recherche mal contrainte peut tourner très longtemps (le bouton
  // « Arrêter » reste le seul filet, coopératif comme toujours).
  function handleSearch() {
    if (!selected) return;
    if (comboSets.length === 0) {
      setSetPickerInvalid(true);
      setPickerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSetPickerInvalid(false);
    setStoppedManually(false);
    optimizer.poserTriRecherche(objective);
    setResultsPage(1);
    run({
      base: selected.gear.base,
      artifacts: searchArtifacts,
      // ⚠️ La FAISABILITÉ se décide ici, plus sur `artifacts` — voir
      // `searchArtifactBounds` et SearchParams.artifactBounds.
      artifactBounds: searchArtifactBounds,
      // Les lignes 218–221 de TOUTES les pièces que la file peut retenir, pas
      // seulement de la représentative : la dominance protège les bonus de
      // set qui les nourrissent. Même producteur que le CLI.
      statsLignesArtefactsEquipables: artifactParams ? statsLignesArtefactsEquipables(artifactParams) : undefined,
      relic: selected.gear.relic,
      // ⚠️ **Troisième producteur de `relicContext`** (les deux autres : `recipeToSearchParams.ts` pour le CLI,
      // `buildCaseSearchParams` pour le harnais). L'intention vient d'UNE
      // seule fonction pure (`relicIntentDepuisEtat`, useOptimizerState.ts),
      // mêmes règles que `recipeToRelicIntent` — jamais une relecture séparée
      // des trois champs ici.
      relicContext: resoudreContexteRelique(
        relicIntentDepuisEtat(optimiserArtefacts, relicMainChoice, relicUniqueChoice, relicMinUpgrade),
        selected.gear.relic,
        relics
      ),
      pool,
      requirement: requirementAvecAuras,
      metric,
      maxMs: exhaustiveSearch ? Number.POSITIVE_INFINITY : HARD_TIMEOUT_MS,
      slotFilterCap,
      objective,
      // ⚠️ `undefined` hors de « Dégâts réels » — le moteur retombe alors sur
      // `OBJECTIVE_RELEVANT_STATS[objective]`, comportement inchangé.
      objectiveStats,
      adaptiveTrancheWeighting,
    });
  }

  // Exporte la RECETTE de cette recherche (set, minimums, objectif,
  // réglages) — jamais le pool de runes ni le compte, qui appartiennent à
  // qui la relance. Sert à trois choses : (1) reproduire fidèlement un cas
  // signalé sans retranscrire les réglages à la main (source de plusieurs
  // erreurs vécues en investigation — conversion bonus/total, défauts
  // d'écran périmés), (2) partager une recherche entre joueurs, chacun
  // l'appliquant à son propre inventaire, (3) réutilisable tel quel par un
  // script Node (voir scripts/lib/) ou, plus tard, par les recommandations
  // de decks. Voir src/lib/optimizerRecipe.ts.
  function exportRecipe() {
    if (!selected || selected.monster.com2usId == null) return;
    const recipe = buildOptimizerRecipe({
      monsterCom2usId: selected.monster.com2usId,
      monsterName: selected.monster.name,
      // Sert au lecteur à savoir si la recette vient de SON compte — voir
      // `OptimizerRecipe.wizardName` et le repli de `importRecipe`.
      wizardName: accountName,
      requirement,
      objective,
      damageSetup,
      compterAurasResPre,
      metric,
      slotFilterPreset,
      adaptiveTrancheWeighting,
      exhaustiveSearch,
      verifierToutesLesCombinaisons,
      excludeUsedRunes,
      excludeUsedScope,
      excludedSelectors,
      ignoreArtifacts: !optimiserArtefacts,
      artifactMainByKind,
      lignesVerrouillees,
      relicMainChoice,
      relicUniqueChoice,
      relicMinUpgrade,
    });
    const jour = jourLocal();
    const DIACRITICS = new RegExp('[̀-ͯ]', 'g');
    const slug = selected.monster.name.toLowerCase().normalize('NFD').replace(DIACRITICS, '').replace(/[^a-z0-9]+/g, '-');
    // Préfixe de la marque (rebranding, décision 14) : `swblacksmith-optimizer-…`.
    // Seul le NOM du fichier change ; son contenu et son format, non.
    telechargerTexte(`${PREFIXE_FICHIER}-optimizer-${slug}-${jour}.json`, JSON.stringify(recipe, null, 2));
  }

  // Reprend une recette importée (export d'un autre joueur, ou la sienne
  // gardée de côté) — remplit les réglages tels quels, et sélectionne le
  // monstre de CETTE box si son com2usId s'y trouve (peut différer du
  // joueur qui a exporté : chacun l'applique à son propre inventaire, voir
  // src/lib/optimizerRecipe.ts). Rien n'est irréversible : ça REMPLACE la
  // saisie en cours, comme changer n'importe quel réglage à la main —
  // aucune confirmation nécessaire.
  // Brouillon de saisie du champ « Page X / Y » — `null` tant qu'on n'y
  // tape pas (affiche alors `resultsPage`, la vraie valeur). Distinct de
  // `resultsPage` lui-même : un numéro de page ne peut jamais être « vide »
  // en soi (contrairement à une condition de stat, voir NumberField.tsx/
  // `allowEmpty`), mais le CHAMP, pendant la frappe, doit pouvoir passer par
  // un état vide (tout sélectionner puis taper un nouveau nombre) sans que
  // React ne le re-remplisse aussitôt avec l'ancienne valeur — c'est
  // exactement le bug vécu ici : `onChange` ignorait la chaîne vide sans
  // jamais mettre à jour l'état, donc le champ contrôlé revenait TOUJOURS
  // à l'ancien chiffre, rendant impossible de le vider avant de retaper.
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<MessageImport | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!importMsg) return;
    // Un message porteur d'un avertissement de conversion n'a pas de délai
    // (`null`) : il reste jusqu'au prochain import — voir `delaiEffacementImport` (messageImport.ts).
    const delai = delaiEffacementImport(importMsg);
    if (delai === null) return;
    const t = setTimeout(() => setImportMsg(null), delai);
    return () => clearTimeout(t);
  }, [importMsg]);

  // Rappel « Pense à vérifier les sets d'aura externes. »
  // — décidé par `doitRappeler` dans le seul geste de la liste de travail
  // (zone C, plus bas), effacé après `DUREE_ATTENTION_MS` (3 s) par le même
  // patron de minuterie qu'`importMsg`. Un JETON qui s'incrémente, pas un
  // booléen : un second changement de monstre pendant les 3 s relance la
  // minuterie au lieu de laisser la première éteindre le second rappel.
  // ⚠️ **Un seul état pour DEUX rendus** : la boîte des
  // auras d'« État de mon monstre » et le message sous la liste de la zone C
  // lisent tous deux `rappelAuras !== null` — aucun n'a sa minuterie à lui.
  const [rappelAuras, setRappelAuras] = useState<number | null>(null);
  useEffect(() => {
    if (rappelAuras === null) return;
    const t = setTimeout(() => setRappelAuras(null), DUREE_ATTENTION_MS);
    return () => clearTimeout(t);
  }, [rappelAuras]);

  // « Réglages avancés » (bureau) : ancre du `FlottantAuto`, PAS un bloc
  // inline — un panneau replié par défaut ne peut pas réserver sa place à
  // l'avance sans perdre l'intérêt d'être replié, donc il flotte PAR-DESSUS
  // la page plutôt que de pousser « Critères de recherche » en dessous
  // (voir docs/03-developpeur/interface/, « un clic ne déplace jamais ce qu'on vient
  // de cliquer »). Même patron que HelpPopover.tsx : ferme au clic extérieur.
  const avancesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showAdvanced) return;
    const onDown = (e: MouseEvent) => {
      if (avancesRef.current && !avancesRef.current.contains(e.target as Node)) setShowAdvanced(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showAdvanced, setShowAdvanced]);

  // ── Ouverture guidée vers l'interrupteur des auras RES/PRE
  // Ajouter Accuracy ou Tolerance aux auras externes (« État de mon
  // monstre ») ou le choisir comme set recherché guide vers « Compter les
  // effets d'auras Tolerance et Précision dans les conditions ». La décision
  // est `guideVersResPre` (aurasExternes.ts), prise au geste, jamais à
  // l'import ni au changement de monstre.
  // ⚠️ **Deux formes, une par format**, choisies par `SOUS_LG` comme le
  // panneau lui-même (`MobileSheet`) et la carte du bureau (`hidden lg:block`) :
  // - à la souris, la page défile jusqu'à l'ANCRE du flottant (`avancesRef`),
  //   PUIS le flottant s'ouvre : `FlottantAuto` choisit son côté en mesurant
  //   l'ancre à l'ouverture, et ouvert pendant le défilement il mesurerait une
  //   position périmée. Le défilement peut déplacer la carte cliquée (accepté
  //   par l'utilisateur, comme pour « Set de runes recherché ») ; le flottant
  //   se referme au clic suivant hors de lui (effet ci-dessus) ;
  // - au doigt, le panneau « Options de recherche » s'ouvre par-dessus la
  //   carte (demandé à App.tsx par `onOuvrirMenu`), puis son contenu défile
  //   jusqu'à l'interrupteur (effet plus bas).
  // L'interrupteur est surligné `DUREE_ATTENTION_MS` (3 s), au même token que
  // le rappel ; il reste toujours rendu dans sa surface (`reglagesAvancesInner`).
  const sousLg = useMediaQuery(SOUS_LG);
  const [attentionResPre, setAttentionResPre] = useState<number | null>(null);
  useEffect(() => {
    if (attentionResPre === null) return;
    const t = setTimeout(() => setAttentionResPre(null), DUREE_ATTENTION_MS);
    return () => clearTimeout(t);
  }, [attentionResPre]);
  // Une ref par surface : les deux exemplaires de `reglagesAvancesInner`
  // peuvent être montés ensemble (le flottant reste monté, masqué, sous `lg`).
  const interrupteurResPreFlottantRef = useRef<HTMLDivElement>(null);
  const interrupteurResPrePanneauRef = useRef<HTMLDivElement>(null);
  // Le défilement du bureau en attente de sa fin : annulé par un nouveau
  // guidage ou au démontage, pour ne jamais ouvrir un flottant périmé.
  const annulerDefilementGuide = useRef<(() => void) | null>(null);
  useEffect(() => () => annulerDefilementGuide.current?.(), []);

  // Défile jusqu'à `el` (patron de « Set de runes recherché » : `smooth`,
  // `center`), PUIS appelle `suite` — à la fin du défilement (`scrollend`),
  // ou au bout d'une seconde si l'événement n'arrive pas (navigateur qui ne le
  // connaît pas). Déjà entièrement visible : rien à défiler, tout de suite.
  function defilerPuis(el: HTMLElement, suite: () => void) {
    annulerDefilementGuide.current?.();
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) {
      suite();
      return;
    }
    let filet = 0;
    const annuler = () => {
      document.removeEventListener('scrollend', fin);
      window.clearTimeout(filet);
      annulerDefilementGuide.current = null;
    };
    const fin = () => {
      annuler();
      suite();
    };
    document.addEventListener('scrollend', fin);
    filet = window.setTimeout(fin, 1000);
    annulerDefilementGuide.current = annuler;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function guiderVersResPre() {
    if (sousLg) {
      annulerDefilementGuide.current?.();
      onOuvrirMenu();
      setAttentionResPre((n) => (n ?? 0) + 1);
      return;
    }
    const ancre = avancesRef.current;
    if (!ancre) return;
    defilerPuis(ancre, () => {
      setShowAdvanced(true);
      setAttentionResPre((n) => (n ?? 0) + 1);
    });
  }

  // Puis l'interrupteur lui-même, une fois sa surface ouverte : au doigt, il
  // est le DERNIER réglage du panneau, sous « Exclusion de runes » ; au
  // bureau, le bas du flottant peut dépasser de l'écran (`nearest` : le
  // moindre défilement qui le montre). `requestAnimationFrame` : le flottant
  // choisit sa place dans un effet de mise en page, à laisser finir avant de
  // mesurer.
  useEffect(() => {
    if (attentionResPre === null) return;
    const el = sousLg
      ? menuOuvert
        ? interrupteurResPrePanneauRef.current
        : null
      : showAdvanced
        ? interrupteurResPreFlottantRef.current
        : null;
    if (!el) return;
    const image = requestAnimationFrame(() =>
      el.scrollIntoView({ behavior: 'smooth', block: sousLg ? 'center' : 'nearest' })
    );
    return () => cancelAnimationFrame(image);
  }, [attentionResPre, sousLg, menuOuvert, showAdvanced]);

  // « Exclusion de runes » (bureau) : même patron, mêmes raisons — repliée par
  // défaut (demande explicite), donc dépliée hors flux pour ne pousser ni
  // « Réglages avancés » en dessous ni la ligne d'estimation.
  //
  // ⚠️ État LOCAL et non remonté dans `useOptimizerState`, contrairement à
  // `showAdvanced` : c'est de l'ouverture/fermeture d'écran, pas un critère de
  // recherche. Rien à exporter dans une recette, rien à remettre à zéro au
  // changement de monstre.
  const exclusionRef = useRef<HTMLDivElement>(null);
  const [showExclusion, setShowExclusion] = useState(false);
  useEffect(() => {
    if (!showExclusion) return;
    const onDown = (e: MouseEvent) => {
      if (exclusionRef.current && !exclusionRef.current.contains(e.target as Node)) setShowExclusion(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showExclusion]);

  function importRecipe(file: File) {
    file.text().then((text) => {
      const { recipe, error, avertissements } = parseOptimizerRecipe(text);
      if (!recipe) {
        setImportMsg({ text: `Import refusé : ${error}`, error: true });
        return;
      }
      optimizer.effacerProprietaireCriteres();
      optimizer.poserCriteresAutomatiques({ comboSets: recipe.requirement.sets, minStats: recipe.requirement.minStats,
        maxStats: recipe.requirement.maxStats ?? {}, mainStatsBySlot: recipe.requirement.mainStats ?? {} });
      // ⚠️ **Runes imposées : gardées SEULEMENT si elles existent dans CET
      // inventaire.** Un `runeId` est propre à un compte — une recette reçue
      // d'un autre joueur en porte forcément d'inconnus, et les garder
      // viderait le pool du slot concerné (donc zéro résultat) sans que rien
      // n'explique pourquoi. Même tolérance que `excludedSelectors` : ce qui
      // ne se résout pas est ignoré, jamais une erreur d'import — mais on le
      // DIT (voir le message plus bas), contrairement aux sélecteurs
      // d'exclusion dont la perte est sans conséquence sur le résultat.
      const locksRecus = recipe.requirement.lockedRunes ?? {};
      const locksValides: Partial<Record<number, number>> = {};
      let locksIgnores = 0;
      for (const [slot, runeId] of Object.entries(locksRecus)) {
        if (runeId != null && runeById.has(runeId)) locksValides[Number(slot)] = runeId;
        else locksIgnores++;
      }
      optimizer.poserCriteresAutomatiques({ lockedRunes: locksValides });
      // ⚠️ Repli sur « Efficience » pour DEUX valeurs devenues invalides :
      // `speed_nuker` (retiré, remplacé par « Dégâts réels ») et `degats`
      // (formule générique sans sort ni adversaire, retirée —
      // approximation strictement inférieure de « Dégâts réels » une fois
      // celle-ci mature). Une recette exportée avant l'un ou l'autre retrait
      // porte encore ces valeurs — `parseOptimizerRecipe` les accepte
      // explicitement pour cette compatibilité, donc sans ce repli l'état affiché
      // porterait une valeur qu'aucun bouton ne peut représenter. « Efficience »,
      // pas « Dégâts réels » : celle-ci EXIGE un sort/adversaire résolus
      // (`objectiveScore` lève sans contexte, voir runeBuildOptim.ts) — une
      // recette ancienne n'en a pas forcément un valide pour CE compte-ci.
      const legacyObjective = recipe.objective as unknown as string;
      optimizer.poserCriteresAutomatiques({ objective: legacyObjective === 'speed_nuker' || legacyObjective === 'degats' ? 'efficience' : recipe.objective });
      // ⚠️ `?? DEFAULT_DAMAGE_SETUP` : une recette exportée AVANT ce champ n'a
      // pas de `damageSetup`. Le `skillCom2usId` qu'elle porte, lui, peut
      // désigner un sort d'un AUTRE monstre que celui de cette box — c'est
      // `resolveDamageSkill` qui retombe alors sur le sort par défaut, pas
      // une erreur d'import (même tolérance que le monstre lui-même, plus bas).
      optimizer.poserCriteresAutomatiques({ damageSetup: recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP,
        compterAurasResPre: recipe.compterAurasResPre ?? true });
      setSlotFilterPreset(recipe.slotFilterPreset);
      setAdaptiveTrancheWeighting(recipe.adaptiveTrancheWeighting);
      // ⚠️ `?? false` : une recette exportée AVANT ce réglage ne porte pas ce
      // champ (`undefined`) — repli sur le défaut plutôt que de propager une
      // valeur non booléenne à l'état.
      setExhaustiveSearch(recipe.exhaustiveSearch ?? false);
      // ⚠️ `?? false`, même repli : une recette exportée avant ce
      // champ ne le porte pas — désactivé, le défaut.
      setVerifierToutesLesCombinaisons(recipe.verifierToutesLesCombinaisons ?? false);
      // ⚠️ Repli sur l'ANCIEN champ `exploreAll` (recette exportée avant ce
      // renommage/inversion) : `exploreAll` coché = pas d'exclusion
      // (`excludeUsedRunes = false`, comportement identique) ; décoché =
      // exclusion box (`excludeUsedRunes = true`, `excludeUsedScope = 'box'`
      // — seul périmètre que l'ancienne case connaissait). Une recette déjà
      // à jour porte directement `excludeUsedRunes`/`excludeUsedScope`.
      const legacy = recipe as unknown as { exploreAll?: boolean };
      setExcludeUsedRunes(recipe.excludeUsedRunes ?? legacy.exploreAll === false);
      setExcludeUsedScope(recipe.excludeUsedScope ?? 'box');
      // ⚠️ `?? []` : même repli qu'`exhaustiveSearch` ci-dessus, pour les
      // recettes exportées avant ce champ. Les sélecteurs sont re-résolus
      // contre CE compte au moment de la recherche (voir optimizerExclusion.
      // ts) — un monstre absent ici est silencieusement ignoré, pas une erreur.
      setExcludedSelectors(recipe.excludedSelectors ?? []);
      optimizer.poserCriteresAutomatiques({ optimiserArtefacts: !recipe.ignoreArtifacts });
      // ⚠️ « Garder l'artéfact équipé » ne se partage pas — la règle, son
      // pourquoi et le repli sur une provenance inconnue vivent dans
      // `mainsPourCeCompte` (optimizerRecipe.ts), fonction pure et testée.
      const { mains, bascules } = mainsPourCeCompte(recipe, accountName);
      optimizer.poserCriteresAutomatiques({ artifactMainByKind: mains });
      // ⚠️ `?? []` : une recette exportée AVANT ce champ ne le porte pas (voir
      // `OptimizerRecipe.lignesVerrouillees`, optionnel exprès).
      optimizer.poserCriteresAutomatiques({ lignesVerrouillees: recipe.lignesVerrouillees ?? [] });
      // ⚠️ **Même canal que la bascule artéfact** (« mêmes trois
      // règles ») : `relicMainPourCeCompte` (optimizerRecipe.ts) applique la
      // bascule « equipped » → « libre » sur compte différent ; le défaut
      // (`defaultRelicMainChoice`, contre la relique réellement portée)
      // ne s'applique QUE si la recette ne porte pas le champ (recette
      // antérieure à ce champ) — résolu plus bas, une fois le monstre trouvé.
      const { main: relicMainResolu, bascule: relicBascule } = relicMainPourCeCompte(recipe, accountName);
      optimizer.poserCriteresAutomatiques({ relicUniqueChoice: recipe.relicUniqueChoice ?? 'libre' });
      setRelicMinUpgrade(recipe.relicMinUpgrade ?? DEFAULT_RELIC_MIN_UPGRADE);

      // Les runes imposées ignorées (voir plus haut) sont signalées en
      // SUFFIXE du message d'import — un verrou perdu change réellement le
      // résultat, contrairement à un sélecteur d'exclusion introuvable.
      const suffixeLocks = locksIgnores > 0 ? ` ${locksIgnores} rune(s) imposée(s) ignorée(s) : absentes de ton inventaire.` : ''
        // ⚠️ La bascule « Garder l'artéfact équipé » → « Libre » se DIT : elle
        // change ce que la recherche va renvoyer, exactement comme un verrou
        // perdu. Une recette qui se comporte autrement que chez son auteur,
        // sans un mot, serait pire que la donnée transportée telle quelle.
        + (bascules ? ` Cette recette vient d'un autre compte : « Garder l'artéfact équipé » est passé sur « Libre ».` : '')
        + (relicBascule ? ` Cette recette vient d'un autre compte : « Garder la relique équipée » est passé sur « Libre ».` : '')
        // ⚠️ Ce que le parseur a CONVERTI (l'ancien mode critique « Moyenne »
        // → « Critique ») se dit aussi, mot pour mot
        // comme le CLI (`chargerRecette`) : jamais une conversion silencieuse.
        + (avertissements ?? []).map((a) => ` ${a}`).join('');
      // Un avertissement de conversion change le TON et la DURÉE du message :
      // token `warn`, sans effacement automatique (`messageImport.ts`).
      const avecAvertissement = (avertissements ?? []).length > 0;
      // ⚠️ Résolu dans TOUT le bestiaire (`allMonsters`), pas seulement les
      // monstres possédés — la recherche « Monstre à optimiser » couvre
      // tout le bestiaire, donc une
      // recette reçue d'un autre joueur pour un monstre qu'on ne possède pas
      // reste sélectionnable (repli sur ses stats de base 6★, voir
      // `selected`) au lieu d'échouer.
      const match = allMonsters.find((m) => m.com2usId === recipe.monsterCom2usId);
      if (match) {
        // ⚠️ Une recette ne porte que l'ESPÈCE (`monsterCom2usId`), jamais un
        // exemplaire précis (voir le commentaire de `gearSource` plus haut) —
        // repli sur Box, comme si l'utilisateur venait de le choisir dans
        // cette source (même règle que `pickSpecies` : premier exemplaire de
        // la box, PAS un repli sur « non possédé » dès que la box en compte
        // plusieurs) ; possédée NULLE PART → sélecteur `unowned`.
        setGearSource('box');
        const boxCandidates = speciesCandidatesBySource(match.com2usId, box, exclusionData).box;
        setSourceSelector(boxCandidates[0]?.selector ?? unownedSelectorIfNoneOwned(match, box, exclusionData));
        setZoneDOpen(false);
        setSelectedId(String(match.id));
        // ⚠️ Défaut calculé contre la relique de l'EXEMPLAIRE résolu ici
        // (même source que `pickSpecies`), jamais une constante — seulement
        // si la recette ne porte pas le champ (`relicMainResolu` absent).
        optimizer.poserCriteresAutomatiques({ relicMainChoice: relicMainResolu ?? defaultRelicMainChoice(boxCandidates[0]?.gear.relic) });
        setImportMsg({ text: `Réglages importés pour ${recipe.monsterName} — monstre sélectionné automatiquement.${suffixeLocks}`, avertissement: avecAvertissement });
      } else {
        // Cas limite : le `com2usId` de la recette ne correspond à AUCUN
        // monstre des données actuellement chargées (ex. retiré du jeu) —
        // devrait rester rare maintenant que `allMonsters` couvre tout le
        // bestiaire (autrement, ce message apparaîtrait dès que le
        // monstre n'est simplement pas POSSÉDÉ, un cas bien plus courant).
        // ⚠️ Aucun exemplaire résolu : pas de relique connue pour calculer le
        // défaut, repli sur « libre » (même situation que `pickSpecies`
        // sur une espèce possédée nulle part).
        optimizer.poserCriteresAutomatiques({ relicMainChoice: relicMainResolu ?? 'libre' });
        setImportMsg({
          text: `Réglages importés (${recipe.monsterName}), mais ce monstre est introuvable dans les données actuelles — choisis-en un manuellement.${suffixeLocks}`,
          avertissement: avecAvertissement,
        });
      }
    });
  }

  // Source des candidats affichés : le résultat FINAL une fois la recherche
  // terminée, sinon l'aperçu EN DIRECT accumulé pendant qu'elle tourne (voir
  // useBuildOptimSearch.ts) — pour voir des builds apparaître au fur et à
  // mesure plutôt que d'attendre l'épuisement complet de l'espace de
  // recherche. `null` tant qu'aucun des deux n'existe (recherche jamais
  // lancée, ou encore en phase `building` — pas de candidat possible avant
  // que l'appariement ait commencé).
  const candidatesSource = result ? result.candidates : status === 'running' && progress?.phase === 'pairing' ? progress.candidates : null;

  // Tri CLIENT, sans relancer la recherche : le moteur collecte déjà les
  // stats complètes de chaque candidat valide (voir runeBuildOptim.ts).
  // ⚠️ Liste COMPLÈTE, plus limitée à 20 — la pagination ci-dessous découpe
  // cette liste en pages, pour pouvoir visualiser TOUS les builds trouvés
  // (jusqu'à `MAX_COLLECTED`, voir runeBuildOptim.ts), pas seulement les
  // meilleurs 20.
  // ⚠️ Le tri vit dans `sortCandidates` (runeBuildOptim.ts), PAS ici — il
  // était inline, donc invisible et irréutilisable pour tout autre
  // consommateur. Les scripts CLI prenaient `candidates[0]` ou
  // `slice(0, 20)` en croyant lire les meilleurs, alors que le moteur ne
  // trie pas par l'objectif. Une seule porte, comme `damageRelevantStats`.
  // ⚠️ La relique de l'ordre de BASE, SANS le cache de la file : la file lit
  // cet ordre (`triees`), il ne peut donc jamais se nourrir de ses résultats.
  // Mais une relique FIXE (`off`, `equipped`) est connue d'avance : son effet
  // unique compte dès ici — cet ordre est affiché tel quel tant que
  // la file n'a rien résolu, toujours quand l'optimisation d'artéfacts est
  // coupée, et les cartes le comptent. En `recherche` : neutre (`en attente`).
  const etatReliqueDeBase = useCallback(
    (_c: BuildCandidate) => etatReliqueDuBuild(undefined, relicContextRecherche, selected?.gear.relic),
    [relicContextRecherche, selected?.gear.relic]
  );
  const fullSortedCandidates = useMemo(
    () =>
      candidatesSource
        ? sortCandidates(
            candidatesSource,
            sortBy,
            optionsDeClassement({
              realDamage,
              damageSetup,
              runeById,
              metric,
              aurasPropresDe,
              // La paire SUPPOSÉE pour tous (`realDamage.artefacts`).
              artefactsDuBuild: () => null,
              etatReliqueDe: etatReliqueDeBase,
              contexteExclusive,
            })
          )
        : [],
    [candidatesSource, sortBy, runeById, metric, realDamage, damageSetup, aurasPropresDe, etatReliqueDeBase, contexteExclusive]
  );

  const RESULTS_PAGE_SIZE = 20;

  // ⚠️ `composition` (la page affichée) est définie PLUS BAS, après la file
  // d'optimisation d'artéfacts : elle dépend du classement corrigé par les
  // paires trouvées, qui n'existe qu'une fois la file déclarée.

  /**
   * Optimisation d'artéfacts des meilleurs builds, EN TEMPS MASQUÉ pendant que
   * les Workers cherchent encore.
   *
   * ⚠️ Chaque build a SA paire : deux builds voisins n'appellent pas les mêmes
   * artéfacts. `searchArtifacts` (la paire supposée, commune) ne sert qu'à
   * noter les candidats pendant la recherche et de repli d'affichage tant que
   * le vrai calcul n'a pas atteint ce build.
   *
   * ⚠️ La signature vide le cache dès qu'un réglage change QUELLES LIGNES
   * COMPTENT — pas seulement l'inventaire : `analyserPertinence` en dépend,
   * donc la paire gagnante aussi.
   */
  const signatureArtefacts = useMemo(
    () =>
      calculerSignatureArtefacts({
        monstreCom2usId: selected?.monster.com2usId ?? -1,
        // ⚠️ Le réglage ENTIER : n'en prendre que quelques champs laissait le
        // cache intact quand on changeait le buff ATQ ou les PV de la cible.
        damageSetup,
        compterAurasResPre,
        // ⚠️ Le TRI, pas l'objectif : c'est lui qui décide du critère
        // de choix de la paire (voir `resoudreEquipement`). Changer de tri
        // entre Dégâts réels et PV effectifs change donc la meilleure paire, et
        // doit vider le cache. Entre Efficience et Vitesse, rien ne change —
        // aucun artéfact n'entre dans ces deux scores — mais `sortBy` variant
        // quand même, le cache est refait pour rien : coût borné (K builds en
        // temps masqué), contre le risque d'afficher une paire périmée.
        // ⚠️ **Le RÉGIME EFFECTIF (`regimeEquipement`), jamais `regimePaire`
        // brut** :
        // `regimePaire` ne rabat PAS « Dégâts réels » sur `aucun` quand le
        // sort n'est pas encore calculable — c'est `regimeEquipement` qui le
        // fait, une fois, AVANT `entreeResolutionDuBuild`. Utiliser `regimePaire`
        // ici laissait la signature identique pendant la transition « sort
        // indisponible → calculable » (`contexteDegatsArtefacts` passe de
        // `null` à un contexte, `regimePaire` reste `'degats_reels'` dans les
        // deux cas) : le cache restait celui du régime `aucun`, périmé.
        // ⚠️ Deux critères ne partagent cette clé que si la paire optimale
        // est démontrablement la même : c'est le cas de tous ceux qu'aucun
        // artéfact ne touche (efficience, VIT, TC, DCC, RES, PRE), regroupés
        // sous `'aucun'`. Basculer entre eux ne recalcule donc plus 100
        // builds pour retrouver la même paire. Trop regrouper afficherait une
        // paire périmée — le régime est établi sur ce qu'un artéfact peut
        // bouger, jamais sur une intuition.
        regimeEquipement,
        ignoreArtifacts: !optimiserArtefacts,
        principaleParSorte: artifactMainByKind,
        lignesVerrouillees,
        relique: selected?.gear.relic ?? null,
        nbArtefacts: artifacts.length,
        // ⚠️ La dimension relique de la recherche : mode, pool
        // éligible, choix, seuil — tout dans l'empreinte canonique. Un tri
        // qui change de régime invalide déjà par `objective` ci-dessus ; un
        // tri qui n'en change pas ne relance rien.
        empreinteRelique: relicContextRecherche?.empreinte ?? null,
        // ⚠️ Le résolveur consomme `requirement`
        // (minimums ET maximums) ; sans lui ici, relancer
        // avec un autre maximum gardait un couple devenu infaisable en cache.
        requirement: requirementAvecAuras,
        // ⚠️ Les artéfacts RÉSERVÉS par les autres builds validés de la liste
        // active sortent de l'inventaire de la paire (`artifactParams`) : les
        // libérer (« Libérer les artéfacts », zone C) ou changer de liste
        // active doit vider le cache. Sans eux ici, les cartes déjà calculées
        // gardaient leur paire d'avant, même après une nouvelle recherche.
        // Un ensemble : l'ordre est sans effet.
        artefactsReserves,
        // ⚠️ Un emplacement figé sur « Garder l'artéfact équipé » n'a qu'un
        // candidat : la pièce que porte la fiche. Valider un build de CE
        // monstre, « Voir le runage réellement porté » ou changer d'exemplaire
        // de la même espèce la remplacent. Les sortes libres n'y
        // entrent pas : leur pièce portée n'est jamais lue.
        piecesFigees: piecesFigeesDe(artifactMainByKind, selected?.gear.artifacts ?? []),
        // ⚠️ L'identité de l'import du compte : le cache est indexé
        // par les identifiants de runes et ne voyait de l'inventaire que le
        // nombre d'artéfacts. Un réimport qui changeait des pièces ou des
        // runes à nombre et identifiants égaux gardait les paires de l'ancien
        // compte ; chaque import vide le cache.
        importDuCompte,
      }),
    [selected?.monster.com2usId, selected?.gear.relic, selected?.gear.artifacts, damageSetup, compterAurasResPre, regimeEquipement, optimiserArtefacts, artifactMainByKind, lignesVerrouillees, artifacts.length, relicContextRecherche?.empreinte, requirementAvecAuras, artefactsReserves, importDuCompte]
  );

  /**
   * Résout l'équipement d'UN build — paire ET relique, ensemble — pour la
   * file : `resoudreEquipementDuBuild` (relicQueue.ts), la partie
   * pure que `tests/relic-queue.test.ts` compare à l'oracle, avec l'entrée
   * construite par `entreeResolutionDuBuild` — le producteur que le CLI
   * appelle aussi : le build, le prédicat à relique
   * fixe (`respecteConditionsPaireFixe` : minimums et maximums RES/PRE, les
   * autres maximums restant hors filtre), les conditions complètes et
   * le contexte relique de la recherche LANCÉE (jamais une
   * relecture des trois champs).
   *
   * ⚠️ `null` quand l'optimisation est coupée : il n'y a alors qu'UNE paire
   * possible (celle qui est portée), déjà comptée par `searchArtifacts`. La
   * faire passer par la file lui ferait « choisir » entre un seul candidat,
   * pour un résultat identique et cent tranches de temps masqué en pure
   * perte.
   *
   * ⚠️ **La paire se choisit sur le critère RÉELLEMENT regardé** : le régime
   * effectif (`regimeEquipement`) suit `sortBy`, pas `objective`, quand
   * « Adapter les artéfacts et reliques au tri » est activé. L'objectif fige
   * le critère au lancement ; le tri, lui, peut changer après coup. Une paire
   * optimisée pour les dégâts affichée dans une liste triée par PV effectifs
   * montrerait une valeur qui n'est pas la meilleure atteignable.
   */
  // Les caches partagés par les builds de la file (`CachesResolution`) :
  // profil de dégâts par paire et préfiltre. Neufs dès que la signature des
  // réglages ou les paramètres de paires (donc l'inventaire) changent.
  const cachesResolution = useMemo(() => nouveauxCachesResolution(), [signatureArtefacts, artifactParams]);
  const resoudreEquipement = useMemo(() => {
    if (!artifactParams || !selected || !optimiserArtefacts) return null;
    return (c: BuildCandidate) =>
      resoudreEquipementDuBuild(
        entreeResolutionDuBuild({
          fiche: selected.gear,
          runes: runesDuBuild(c, runeById),
          artifactParams,
          regime: regimeEquipement,
          degats: contexteDegatsArtefacts,
          exclusive: contexteExclusive,
          requirement: requirementAvecAuras,
          relicContext: relicContextRecherche,
          caches: cachesResolution,
        })
      );
  }, [artifactParams, selected, optimiserArtefacts, runeById, regimeEquipement, contexteDegatsArtefacts, contexteExclusive, requirementAvecAuras, relicContextRecherche, cachesResolution]);

  // La MÊME résolution, hors du fil de l'écran : les mêmes
  // arguments que `resoudreEquipement`, en données — `entreesSerialisables`
  // ne retire que `evaluer`, le Worker reconstruit l'entrée par
  // `entreeResolutionDuBuild`. ⚠️ Comparé par IDENTITÉ par la file : chaque
  // nouvel objet est un contexte renvoyé au Worker (tout l'inventaire
  // d'artéfacts) — mêmes dépendances que `resoudreEquipement`, sans
  // `runeById` (les runes voyagent avec chaque demande) ni les caches (le
  // Worker a les siens, neufs à chaque contexte). Les runes d'un build sortent
  // du MÊME producteur que celles de `resoudreEquipement` (`runesDuBuild`) :
  // jamais une seconde expression recopiée.
  const entreesResolution = useMemo(() => {
    if (!artifactParams || !selected || !optimiserArtefacts) return null;
    return entreesSerialisables({
      fiche: selected.gear,
      artifactParams,
      regime: regimeEquipement,
      degats: contexteDegatsArtefacts,
      exclusive: contexteExclusive,
      requirement: requirementAvecAuras,
      relicContext: relicContextRecherche,
    });
  }, [artifactParams, selected, optimiserArtefacts, regimeEquipement, contexteDegatsArtefacts, contexteExclusive, requirementAvecAuras, relicContextRecherche]);
  const resolutionHorsFil = useMemo<ResolutionHorsFil | null>(
    () =>
      entreesResolution
        ? { entrees: entreesResolution, runesDe: (c: BuildCandidate) => runesDuBuild(c, runeById) }
        : null,
    [entreesResolution, runeById]
  );

  const fileArtefacts = useArtifactOptimQueue({
    // ⚠️ La file lit l'ordre de BASE (paire supposée), jamais un ordre déjà
    // corrigé par ses propres résultats : se nourrir de sa sortie créerait une
    // boucle — chaque paire trouvée changerait le classement, donc le top K,
    // donc la file.
    triees: fullSortedCandidates,
    // ⚠️ Accesseur : `composition` se calcule PLUS BAS (elle dépend du
    // classement corrigé par cette file). Lu au moment de traiter, il voit
    // toujours les builds qui rempliront les places en attente de la page
    // réellement à l’écran.
    pageAffichee: () => pageAfficheeRef.current,
    // Paire ET relique, ensemble — les stats du résultat sont recalculées
    // avec le couple retenu (voir `resoudreEquipement`) : sans ça, la carte
    // montrerait des stats qui ne vont pas avec l'équipement affiché à côté,
    // et un tri par ATQ porterait sur une valeur périmée.
    resoudre: resoudreEquipement,
    signature: signatureArtefacts,
    // ⚠️ 300 en mode relique « recherche », 100 sinon, dès le
    // lancement : le contexte de la recherche LANCÉE, jamais les réglages
    // courants — les changer après coup ne change pas K. Des combinaisons
    // CONFIRMÉES : la file continue au-delà des écartés ; et
    // TOUT avec « Vérifier toutes les combinaisons trouvées », lu EN DIRECT
    // (il ne change pas la recherche de runes, seulement jusqu'où la file
    // vérifie — voir `cibleDeLaFile`).
    K: cibleDeLaFile({ relicContext: relicContextRecherche, toutVerifier: verifierToutesLesCombinaisons }),
    // Le Worker de résolution quand il est disponible ; `resoudre` reste le
    // chemin de repli.
    horsFil: resolutionHorsFil,
  });

  /**
   * Le profil de dégâts des artéfacts DE CE BUILD, quand sa paire est connue.
   *
   * ⚠️ Doit accompagner partout le remplacement des stats : noter des stats
   * recalculées avec la vraie paire en gardant les lignes d'effet de la paire
   * supposée mélangerait deux modèles.
   *
   * Mémoïsé sur le cache : `artifactDamageProfile` est appelé à chaque
   * comparaison de tri, soit O(n log n) fois sur des dizaines de milliers de
   * candidats.
   */
  const profilsParBuild = useMemo(() => {
    const m = new Map<string, ReturnType<typeof artifactDamageProfile>>();
    for (const [cle, r] of fileArtefacts.parBuild) m.set(cle, artifactDamageProfile(r.artefacts));
    return m;
  }, [fileArtefacts.parBuild]);
  const profilArtefactsDuBuild = (c: BuildCandidate) => profilsParBuild.get(cleBuild(c)) ?? null;

  // L'état de la relique d'un candidat, tel que sa carte l'AFFICHE — et la
  // relique dont son score compte l'effet unique : une seule expression pour
  // les deux. ⚠️ Dépend de la PIÈCE de la fiche (l'objet), jamais
  // de son identifiant : une relique réimportée avec un autre effet unique
  // sous le même `rid` doit renoter.
  const etatReliqueDe = useCallback(
    (c: BuildCandidate) => etatReliqueDuBuild(fileArtefacts.parBuild.get(cleBuild(c)), relicContextRecherche, selected?.gear.relic),
    [fileArtefacts.parBuild, relicContextRecherche, selected?.gear.relic]
  );
  /**
   * Les options du classement AFFICHÉ (`affichees` ci-dessous) — partagées
   * avec les cartes, qui affichent leur chiffre par `scoreDuCandidat` avec
   * CET objet : la carte montre la valeur même qui l'a classée (la
   * carte « Dégâts réels » recopiait `computeTotalDamage` sans la Conquête de
   * la relique retenue, « PV effectifs » `pvEffectifs` sans Ténacité).
   * Construites par `optionsDeClassement` (runeBuildOptim.ts), le producteur
   * que le CLI et les tests appellent aussi : l'effet unique y compte dans
   * les trois modes de relique.
   */
  const optionsDuTriAffiche = useMemo(
    () =>
      optionsDeClassement({
        realDamage,
        damageSetup,
        runeById,
        metric,
        aurasPropresDe,
        // ⚠️ Le profil de CE build, pas celui de la paire supposée : ses stats
        // viennent d'être recalculées avec sa vraie paire, ses lignes d'effet
        // doivent suivre. Sinon on note les stats d'un modèle avec les effets
        // d'un autre.
        artefactsDuBuild: profilArtefactsDuBuild,
        etatReliqueDe,
        contexteExclusive,
      }),
    // `profilArtefactsDuBuild` ne lit que `profilsParBuild`.
    [profilsParBuild, realDamage, damageSetup, runeById, metric, aurasPropresDe, etatReliqueDe, contexteExclusive]
  );

  /**
   * Le classement RÉEL : chaque build vu à travers sa vraie paire dès qu'elle
   * est connue, puis retrié.
   *
   * ⚠️ **Un build optimisé peut donc passer devant, et c'est le comportement
   * voulu** — plutôt qu'afficher un total supérieur à un rang inférieur, ce qui
   * se lirait comme un défaut.
   *
   * ⚠️ Cette boucle « trier → optimiser → retrier » CONVERGE, elle ne
   * s'emballe pas : optimiser un build ne peut que faire MONTER son score (la
   * paire supposée fait partie des paires candidates, le maximum lui est donc
   * toujours ≥). Un build optimisé monte ou reste ; un build non optimisé ne
   * peut qu'être repoussé vers le bas. Aucun ne peut ENTRER dans les K premiers
   * de ce fait — l'ensemble à traiter rétrécit, il ne s'élargit jamais.
   *
   * ⚠️ La file, elle, lit `fullSortedCandidates` (l'ordre de BASE) et non ce
   * classement-ci : c'est ce qui borne le nombre de re-tris, et c'est ce qui
   * fait que changer le tri d'affichage repriorise la file sans rien invalider
   * (le cache est indexé par build).
   *
   * ⚠️ Les stats remplacées INCLUENT la relique retenue
   * (`ResultatArtefacts.relique`) — c'est ici, AVANT `sortCandidates`, que
   * la résolution exacte entre dans le classement ; un build qu'aucun couple
   * (paire, relique) ne rend faisable est `conforme: false` et sort par le
   * même filtre que les paires. En mode `recherche`, un candidat non encore
   * résolu (« en attente ») garde ses stats SANS relique : son rang n'est
   * pas exact tant que la file ne l'a pas traité — la page affichée passe
   * en priorité.
   */
  // ⚠️ **Les builds qu'AUCUNE paire réelle ne rend équipables sont écartés
  // ICI** (docs/03-developpeur/optimizer/, « Test conjoint exact à
  // la validation finale »). Ils ont franchi la borne du moteur, calculée par stat
  // isolée, sans qu'une paire puisse fournir les appoints simultanément.
  // Un build pas encore résolu (absent du cache) reste dans ce classement —
  // on ne sait pas encore —, mais il n'est plus MONTRÉ : la
  // page n'affiche que les vérifiés (`compositionDePage`, plus bas), et la
  // file résout en priorité ceux qui rempliront ses places en attente.
  // ⚠️ `sortCandidates` est un tri
  // STABLE, à score égal l'ordre d'entrée est préservé — mais cet ordre
  // d'entrée (celui de l'appariement) n'a rien de canonique. Le départage
  // (`ordonnerParDepartage`, `rid` croissant puis `cleBuild`, la convention
  // du contrat, la même que l'oracle) est appliqué AVANT, sur les candidats
  // conformes : le tri stable qui suit préserve ensuite CET ordre pour
  // toute égalité de score, quel que soit l'ordre d'arrivée des Workers.
  // Les trois étapes vivent dans `classementResolu` (artifactQueue.ts), que le
  // CLI appelle aussi.
  const affichees = useMemo(
    () => classementResolu(fullSortedCandidates, fileArtefacts.parBuild, sortBy, optionsDuTriAffiche),
    [fullSortedCandidates, fileArtefacts.parBuild, sortBy, optionsDuTriAffiche]
  );

  // Le compte du MOTEUR : les candidats du résultat à la fin, le compte de la
  // progression pendant l'appariement (non plafonné, contrairement à l'aperçu).
  const trouvesParLeMoteur = result ? result.candidates.length : progress?.phase === 'pairing' ? progress.found : fullSortedCandidates.length;
  // Le compte des TROUVÉES : trouvés par le moteur,
  // moins les builds que la résolution a écartés — ces derniers mesurés comme
  // reçus moins affichables, jamais lus dans le cache de la file (voir
  // `compteAffichable`). `affichees` change à chaque publication du cache : le
  // compte suit, en pleine recherche comme après. Seule source de la ligne de
  // progression et de la ligne de raison ; l'en-tête et les
  // pages lisent les CONFIRMÉES (`compteConfirmes`, ci-dessous).
  const compteAffiche = useMemo(
    () =>
      compteAffichable({
        trouves: trouvesParLeMoteur,
        recus: fullSortedCandidates.length,
        affichables: affichees.length,
        modeRecherche: relicContextRecherche?.mode === 'recherche',
      }),
    [trouvesParLeMoteur, fullSortedCandidates.length, affichees.length, relicContextRecherche?.mode]
  );
  // Le compte des CONFIRMÉES : les builds de cette recherche résolus ET
  // conformes, lus dans le cache publié de la file — un compte qui ne baisse
  // jamais pendant une recherche. Seule source de l'en-tête, du nombre de pages
  // et des contrôles masqués sous « Aucune combinaison… ». Sans file
  // (optimisation d'artéfacts coupée), les trouvés, comme avant.
  const compteConfirmes = useMemo(
    () =>
      compteConfirme({
        recus: fullSortedCandidates,
        parBuild: resoudreEquipement != null ? fileArtefacts.parBuild : null,
        trouves: trouvesParLeMoteur,
        taillePage: RESULTS_PAGE_SIZE,
        termine: result != null,
      }),
    [fullSortedCandidates, resoudreEquipement, fileArtefacts.parBuild, trouvesParLeMoteur, result]
  );
  const totalResultsPages = compteConfirmes.pages;

  // ⚠️ CORRIGE la page courante, ne la remet PAS à 1 : un aperçu EN DIRECT
  // (pendant la phase d'appariement) grandit au fil de la recherche sans
  // que ce soit une NOUVELLE recherche — recommencer à la page 1 à chaque
  // candidat qui arrive rendrait la pagination inutilisable pendant qu'une
  // recherche tourne. Seuls `handleSearch` (nouvelle recherche) et le choix
  // de tri (classement entièrement différent) remettent explicitement à 1.
  // Le nombre de pages peut aussi DIMINUER (la page au-delà des confirmées disparaît quand ses derniers builds non
  // vérifiés sont écartés) : la page courante revient alors sur la dernière.
  useEffect(() => {
    setResultsPage((p) => Math.min(Math.max(p, 1), totalResultsPages));
  }, [totalResultsPages, setResultsPage]);

  // La page affichée : les builds VÉRIFIÉS seuls,
  // dans l'ordre réel, puis des places « Vérification… » jusqu'à ce que la page
  // attend — une seule fonction pure, `compositionDePage`. Un build reçu de la
  // recherche ne s'affiche pas avec sa paire supposée pour disparaître à la
  // résolution : il apparaît une fois résolu et conforme, ou jamais. Sans file
  // (optimisation d'artéfacts coupée), rien n'est à vérifier : la tranche du
  // classement.
  const composition = useMemo(
    () =>
      compositionDePage({
        classement: affichees,
        parBuild: resoudreEquipement != null ? fileArtefacts.parBuild : null,
        page: resultsPage,
        taillePage: RESULTS_PAGE_SIZE,
      }),
    [affichees, resoudreEquipement, fileArtefacts.parBuild, resultsPage]
  );
  // ⚠️ Renseignée à CHAQUE rendu : c’est ce qui fait qu’un changement de page
  // repriorise la file sans rien relancer ni invalider. La file sert ces
  // builds avant l'avance de fond (`prochainsATraiter`) ; vide quand la page est
  // complète.
  pageAfficheeRef.current = composition.aVerifier;
  const hauteurCarte = useHauteurDesCartes(grilleResultatsRef);

  // Base « nue » du monstre choisi pour une stat — 0 tant qu'aucun monstre
  // n'est sélectionné. ⚠️ N'inclut PAS les artéfacts : en jeu, le mode
  // « bonus » (stats de base exclues) désigne tout ce qui n'est PAS la base
  // pure du monstre — runes ET artéfacts ensemble — un monstre sans la
  // moindre rune mais avec deux artéfacts ATQ+100 affiche déjà +200 ATQ en
  // bonus. La conversion affichage↔stockage doit donc rester bâtie sur la
  // seule base brute ; c'est `artifactBonusOf` ci-dessous qui sert de
  // PLANCHER visible dans le champ, séparément.
  function baseOf(key: StatKey): number {
    return selected ? (selected.gear.base as unknown as Record<StatKey, number>)[key] : 0;
  }

  // Plancher des conditions : compter chaque principale garantie par son
  // choix d'emplacement, jamais la paire représentative de searchArtifacts.
  // Les artéfacts ne contribuent qu'à PV/ATQ/DEF ; baseOf ajoute la base
  // en affichage total et l'exclut pour ces stats en affichage bonus.
  function artifactFloorOf(key: StatKey, base: number, bonusMode: boolean): number {
    const choices = optimiserArtefacts
      ? artifactMainByKind
      : { element: 'equipped' as const, archetype: 'equipped' as const };
    return artifactConditionFloor(key, base, bonusMode, choices, selected?.gear.artifacts ?? [])
      + relicConditionFloor(key, base, relicMainChoice, selected?.gear.relic);
  }

  // Puces avec disponibilité PAR OPTION — une
  // source sans AUCUN candidat pour l'espèce courante voit SA puce
  // désactivée (voir l'axe `disabled` ajouté à Segmented.tsx), le contrôle
  // entier en plus si les 4 le sont (aucune source ne possède l'espèce).
  // Dès deux exemplaires dans une source, sa puce le dit (« Box · 2 ») : c'est le seul signe qu'un clic dessus ouvre la zone D,
  // y compris sur la puce déjà allumée. Le compte ne dépend que de l'espèce,
  // jamais d'un clic : les puces, à largeur égale (`size="lg"`), ne bougent pas.
  const sourceOptions = SOURCE_OPTIONS.map((o) => ({
    ...o,
    label: libellePuceSource(o.label, candidatesBySource[o.key].length),
    disabled: candidatesBySource[o.key].length === 0,
  }));
  const allSourcesEmpty = sourceOptions.every((o) => o.disabled);

  // Effectif par liste — affiché dans `OptimizerListPicker`, à côté
  // de chaque nom de liste.
  const memberCountsByList = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of lists.members) out[m.listId] = (out[m.listId] ?? 0) + 1;
    return out;
  }, [lists.members]);

  // Contenu de la zone D (désambiguïsation d'exemplaire) — factorisé, PAS un
  // composant à part : réutilisé tel quel dans le `Flottant` du bureau et le
  // bloc en ligne du mobile (voir le rendu plus bas), qui ne diffèrent QUE
  // par leur présentation (flottant vs en ligne), pas par leur contenu.
  const zoneDList =
    candidatesBySource[gearSource].length === 0 ? (
      <div className="px-3 py-2 text-ink-dim text-[12.5px]">Aucun exemplaire.</div>
    ) : (
      candidatesBySource[gearSource].map((c) => (
        <button
          key={exclusionSelectorKey(c.selector)}
          type="button"
          onClick={() => {
            setSourceSelector(c.selector);
            reliqueCoherenteAvecExemplaire(c.gear.relic);
            setZoneDOpen(false);
          }}
          className={`flex w-full items-center gap-3 px-3 text-left transition hoverable:bg-accent-soft ${
            c.teamContext ? 'py-1' : 'py-1.5'
          }`}
        >
          <ExclusionCandidateRow candidate={c} />
        </button>
      ))
    );

  // Zone C — les monstres de la liste ACTIVE : chaque ligne porte
  // directement son état validé, une section séparée ailleurs dans l'écran
  // pour la même info aurait été redondante (voir
  // docs/02-app/optimizer/,
  // « Zone C — Monstres de la liste »).
  const activeList = lists.lists.find((l) => l.id === lists.activeListId) ?? null;
  const activeMembers = lists.activeListId ? lists.members.filter((m) => m.listId === lists.activeListId) : [];
  const equipesActives = lists.teams.filter(e => e.listId === lists.activeListId);
  const groupesMembres = [
    ...equipesActives.map(equipe => ({ equipe, members: activeMembers.filter(m => equipe.members.some(s => exclusionSelectorKey(s) === exclusionSelectorKey(m.selector))) })),
    { equipe: null, members: activeMembers.filter(m => !equipesActives.some(e => e.members.some(s => exclusionSelectorKey(s) === exclusionSelectorKey(m.selector)))) },
  ];
  const listHasValidated = activeList != null && lists.validated.some((v) => v.listId === activeList.id);

  // « Ajouter à la liste » — agit sur `sourceSelector`, qui porte soit un
  // exemplaire RÉELLEMENT résolu, soit (demande explicite : « ajouter un
  // monstre qu'on ne possède pas ») un sélecteur `unowned` quand l'espèce
  // n'est possédée dans AUCUNE des 4 sources (voir `unownedSelectorIfNoneOwned`) —
  // `null` seulement si aucune espèce n'est choisie, ou si elle est possédée
  // mais pas encore désambiguïsée (zone D). Sans liste active, crée-en une
  // ET y ajoute le monstre dans le même geste plutôt que d'obliger un
  // aller-retour par le menu déroulant.
  // ⚠️ L'exemplaire affiché déjà membre, un autre
  // exemplaire Box de l'espèce absent de la liste → le bouton reste actif
  // (« Ajouter un autre exemplaire de … ») et vise le premier exemplaire Box
  // absent, dans l'ordre de la zone D. Décision pure : `etatAjoutListe`.
  const ajoutListe = etatAjoutListe({
    monstre: selected?.monster.name ?? null,
    selecteur: sourceSelector,
    listeActiveId: lists.activeListId,
    nomListe: activeList?.name ?? '',
    membres: lists.members,
    candidatsBox: candidatesBySource.box,
  });

  // Change l'exemplaire optimisé — chemin UNIQUE des gestes qui désignent un
  // exemplaire précis hors des puces de source : un membre de la zone C et
  // le bouton « Ajouter un autre exemplaire ». Autre espèce :
  // `resetSearch` habituel. Même espèce, AUTRE exemplaire : la recherche
  // affichée a été faite pour l'ancien — sa
  // fiche, sa relique, ses artéfacts portés ; effacée comme au changement
  // d'espèce (`effacerResultats` est la partie « résultats » de
  // `resetSearch`), sans toucher aux critères ni au combat décrit ; jamais
  // relancée : l'utilisateur relance lui-même. Recliquer l'exemplaire déjà
  // affiché n'efface rien. ⚠️ Aucun rappel des auras externes ici : il reste
  // décidé dans le seul `onClick` d'un membre de la zone C (7b).
  function choisirExemplaire(selector: ExclusionSelector, monster: Monster) {
    optimizer.effacerProprietaireCriteres();
    const id = String(monster.id);
    const key = exclusionSelectorKey(selector);
    const autreEspece = id !== selectedId;
    if (id !== selectedId) resetSearch();
    else if (key !== ownSelectorKey) effacerResultats();
    setSelectedId(id);
    // Le défaut de relique suit l'exemplaire désigné, comme dans
    // `pickSpecies` : `resetSearch` le remet à « Libre » sans connaître la
    // relique portée. Après lui : la mise à jour fonctionnelle s'applique
    // dans l'ordre des appels.
    if (autreEspece || key !== ownSelectorKey) {
      const relique = resolveExclusionEntry(selector, exclusionData)?.gear.relic;
      optimizer.poserCriteresAutomatiques((c) => ({ relicMainChoice: relicMainChoiceApresChangementExemplaire(c.relicMainChoice, relique, !autreEspece) }));
    }
    // ⚠️ `unowned` n'est PAS une `ExclusionSource` (pas une des 4 puces) —
    // `gearSource` reste sur sa dernière valeur réelle, la puce active se
    // désallume de toute façon (`value={... || unowned ? null : gearSource}`).
    if (selector.source !== 'unowned') setGearSource(selector.source);
    setSourceSelector(selector);
    setZoneDOpen(false);
  }

  function handleAddToList() {
    if (!sourceSelector) return;
    if (!lists.activeListId) {
      setAddListPromptOpen('add');
      return;
    }
    const suivant = ajoutListe.exemplaireSuivant;
    if (suivant) {
      choisirExemplaire(suivant.selector, suivant.monster);
      lists.addMember(lists.activeListId, suivant.selector, suivant.monster.com2usId!);
      optimizer.capturerMembre(lists.activeListId, suivant.selector);
      return;
    }
    if (!selected?.monster.com2usId) return;
    lists.addMember(lists.activeListId, sourceSelector, selected.monster.com2usId);
    optimizer.capturerMembre(lists.activeListId, sourceSelector);
  }
  const unowned = sourceSelector?.source === 'unowned';

  // « Valider ce build » (sous la fiche stats+artéfacts+runes+relique,
  // demande explicite) — valide directement les runes ACTUELLEMENT
  // affichées sur l'exemplaire, sans passer par une recherche : utile pour
  // un runage déjà composé (en jeu ou dans le planning) qu'on veut juste
  // RÉSERVER dans la liste. Exige exactement 6 runes affichées (même
  // contrainte qu'un build trouvé par la recherche, `ValidatedBuild.
  // runeIds` porte toujours 6 ids) — rien à valider sur un exemplaire
  // partiellement runé ou nu (`unowned`, `EMPTY_GEAR`). ⚠️ Si `selected.gear
  // .runes` reflète déjà un build VALIDÉ (voir `selected`, substitution des
  // runes) le bouton affiche « Validé » (identique à `BuildCandidateCard`)
  // plutôt que de re-valider inutilement les mêmes runes.
  const displayedRuneIds = selected?.gear.runes.map((r) => r.id) ?? [];
  // Jumeau de `displayedRuneIds` : la paire réellement affichée sur la fiche.
  // ⚠️ Nécessaire pour qu’un build validé rejoue SES artéfacts et non ceux que
  // le monstre porte aujourd’hui — le défaut signalé à l’usage.
  const displayedArtifactIds = selected?.gear.artifacts.map((a) => a.id) ?? [];
  // Les runes AFFICHÉES sont-elles EXACTEMENT le build validé ? Presque
  // toujours équivalent à `!!ownValidatedBuild` (la substitution dans
  // `selected` le garantit dès que `showRealGear` est `false`) — mais PAS
  // quand `showRealGear` est `true` : la fiche montre alors l'équipement
  // RÉEL, qui peut différer du build validé (c'est justement le but du
  // bouton). Sert à distinguer « un build validé EXISTE pour cet
  // exemplaire » de « ce qui est affiché EN CE MOMENT est ce build ».
  /**
   * L'état de validation d'un build donné (ses runes, sa paire) face à celui
   * qui est réservé pour cet exemplaire.
   *
   * ⚠️ `?? []` sur `artifactIds` : les builds validés AVANT ce champ n'en ont
   * pas (voir `ValidatedBuild`). On les traite comme « artéfacts à valider »
   * dès que la paire affichée n'est pas vide — c'est vrai, et ça permet de
   * les compléter au lieu de les laisser figés sans recours.
   */
  const etatValidation = (runeIds: number[], artifactIds: number[]): EtatValidation => {
    if (!ownValidatedBuild || !memesIds(ownValidatedBuild.runeIds, runeIds)) return 'non';
    // ⚠️ **Le MÊME filtre que `validateBuild`** (useOptimizerLists.ts) : les
    // ids ≤ 0 désignent une pièce SYNTHÉTIQUE, absente du compte, et ne sont
    // jamais mémorisés. Comparer sans ce filtre laisserait le bouton bloqué
    // sur « Valider les artéfacts » à l'infini — on validerait, puis on
    // comparerait la paire affichée à une paire stockée forcément plus courte.
    const reels = artifactIds.filter((id) => id > 0);
    return memesIds(ownValidatedBuild.artifactIds ?? [], reels) ? 'oui' : 'artefacts';
  };
  const etatFiche = etatValidation(displayedRuneIds, displayedArtifactIds);
  // ⚠️ « Déjà réservé À L'IDENTIQUE » — donc plus rien à faire. Un build aux
  // mêmes runes mais à une autre paire N'EN FAIT PAS partie : il reste à
  // valider, sur ses artéfacts.
  const matchesValidatedBuild = etatFiche === 'oui';
  /**
   * La paire proposée par « Meilleurs artéfacts offensifs » est-elle déjà
   * celle qui est réservée ?
   *
   * ⚠️ Même filtre `id > 0` que `validateBuild`/`validateArtifacts` : les
   * pièces SYNTHÉTIQUES ne sont jamais mémorisées, et comparer sans ce filtre
   * laisserait le bouton indéfiniment sur « Valider ces artéfacts ».
   */
  const artefactsProposesDejaReserves =
    !!ownValidatedBuild &&
    !!modeArtefactsSeuls &&
    memesIds(
      ownValidatedBuild.artifactIds ?? [],
      modeArtefactsSeuls.paire.map((a) => a.id).filter((id) => id > 0)
    );
  // ⚠️ Jamais valider une rune déjà réservée pour un AUTRE monstre de LA
  // MÊME liste active — demande explicite. Contrairement à un résultat de
  // recherche (dont le pool exclut déjà `otherValidatedRuneIds`, voir
  // `pool` plus bas), les runes AFFICHÉES ici viennent de l'équipement
  // réel de l'exemplaire (ou d'un build déjà validé) : rien n'empêche
  // structurellement qu'elles chevauchent une réservation posée APRÈS coup
  // pour un autre monstre. `otherValidatedBuilds` (pas juste l'ensemble des
  // ids, voir `reservedByOthers`) sert aussi à nommer le monstre concerné
  // dans le message.
  const otherValidatedBuilds = useMemo(
    () => (lists.activeListId ? lists.validated.filter((v) => v.listId === lists.activeListId && exclusionSelectorKey(v.selector) !== ownSelectorKey) : []),
    [lists.validated, lists.activeListId, ownSelectorKey]
  );
  // ⚠️ **Le même calcul pour la FICHE et pour les CARTES DE RÉSULTAT.** Il ne
  // vivait qu'ici : « Valider » sur une carte de résultat ne vérifiait rien,
  // en s'appuyant sur le fait que le pool de recherche exclut déjà
  // `otherValidatedRuneIds`. Vrai AU MOMENT de la recherche seulement — des
  // résultats affichés avant un changement de liste active, ou avant qu'un
  // autre monstre ne réserve, permettaient de réserver DEUX FOIS la même rune
  // dans une même liste. La garde doit être là où l'on valide, pas là où l'on
  // cherche.
  const conflitsDeRunes = (ids: number[]) =>
    ids
      .map((id) => {
        const build = otherValidatedBuilds.find((v) => v.runeIds.includes(id));
        if (!build) return null;
        const rune = runeById.get(id);
        const monsterName = resolveExclusionEntry(build.selector, exclusionData)?.monster.name ?? 'un autre monstre';
        return { slot: rune?.slot ?? null, monsterName };
      })
      .filter((c): c is { slot: number | null; monsterName: string } => c != null);
  const displayedRuneConflicts = conflitsDeRunes(displayedRuneIds);
  const canValidateDisplayed = !!sourceSelector && displayedRuneIds.length === 6 && displayedRuneConflicts.length === 0;
  /**
   * Réserve la paire proposée par « Meilleurs artéfacts offensifs ».
   *
   * ⚠️ **Deux gestes derrière un seul bouton, et le libellé les
   * distingue.** Sur un exemplaire DÉJÀ validé, seule la paire change — les
   * runes réservées ne bougent pas. Sur un exemplaire qui ne l’est pas
   * encore, réserver une paire seule fabriquerait une entrée sans runage,
   * que tout le reste du code lit comme « 6 runes » : on valide donc le
   * build affiché AVEC cette paire, ce que le bouton annonce.
   */
  function handleValidateArtefacts() {
    if (!sourceSelector || !lists.activeListId || !modeArtefactsSeuls) return;
    const ids = modeArtefactsSeuls.paire.map((a) => a.id);
    if (ownValidatedBuild) lists.validateArtifacts(lists.activeListId, sourceSelector, ids);
    else if (canValidateDisplayed) {
      lists.validateBuild(lists.activeListId, sourceSelector, displayedRuneIds, ids, selected!.monster.com2usId!);
      optimizer.capturerMembre(lists.activeListId, sourceSelector);
    }
  }

  function handleValidateDisplayed() {
    if (!sourceSelector || !canValidateDisplayed) return;
    if (!lists.activeListId) {
      setAddListPromptOpen('validate');
      return;
    }
    lists.validateBuild(lists.activeListId, sourceSelector, displayedRuneIds, displayedArtifactIds, selected!.monster.com2usId!);
    optimizer.capturerMembre(lists.activeListId, sourceSelector);
  }

  // Bandeau « build validé », devenu une BASCULE — demande explicite : en
  // plus des 4 puces grisées (voir plus haut), un signal explicite dans la
  // fiche elle-même, pour que ce qui est affiché (le build validé, PAS
  // l'équipement réellement porté) ne prête jamais à confusion. ⚠️ Suite —
  // « on ne peut plus voir à quoi ressemblait le runage précédent tant
  // qu'on est dans la liste » : `showRealGear` (voir `selected`) permet de
  // rebasculer vers l'équipement RÉEL sans quitter la liste ni changer
  // d'exemplaire. Factorisé, réutilisé aux deux endroits où la fiche
  // s'affiche (bureau/mobile).
  const validatedBadge = ownValidatedBuild ? (
    <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
      <CheckCircle2 size={13} className="flex-none" />
      <span className="grid min-w-0 flex-1">
        <span className={`col-start-1 row-start-1 ${showRealGear ? 'invisible' : ''}`} aria-hidden={showRealGear}>
          Build validé affiché — pas l'équipement réellement porté
        </span>
        <span className={`col-start-1 row-start-1 ${showRealGear ? '' : 'invisible'}`} aria-hidden={!showRealGear}>
          Équipement réellement porté affiché
        </span>
        {runesAbsentesValidees.length > 0 && <span role="status" className="text-warn">
          Build conservé : {runesAbsentesValidees.length} rune(s) absente(s) du compte. Seules les runes présentes sont affichées et réservées.
        </span>}
      </span>
      <BoutonIcone
        cadre
        libelle={showRealGear ? 'Revoir le build validé' : "Voir le runage réellement porté"}
        icone={showRealGear ? <CheckCircle2 size={13} /> : <Eye size={13} />}
        onClick={() => setShowRealGear((v) => !v)}
        className="h-6 w-6 flex-none"
      />
    </div>
  ) : null;

  // Même bouton que sur une carte de résultat (`BuildCandidateCard`), sous
  // la fiche cette fois — demande explicite : valider un runage déjà
  // composé (en jeu ou planifié) sans passer par une recherche. `disabled`
  // dès qu'il n'y a rien de validable (pas 6 runes affichées, OU au moins
  // une rune déjà réservée pour un autre monstre de la liste — voir
  // `displayedRuneConflicts`) OU que c'est déjà EXACTEMENT le build validé
  // (`matchesValidatedBuild` — PAS `ownValidatedBuild` seul, qui reste vrai
  // même en vue « runage réellement porté », voir son commentaire).
  /**
   * Le bloc « Meilleurs artéfacts offensifs pour ce build », sous la fiche.
   *
   * ⚠️ Rendu à CÔTÉ de la fiche et jamais À LA PLACE de ses artéfacts : la
   * fiche montre l'équipement RÉEL, c'est son rôle. Y substituer une
   * proposition ferait croire à un équipement qu'on ne porte pas — le défaut
   * exact qu'on vient de corriger pour les builds validés.
   */
  const blocArtefactsSeuls = modeArtefactsSeuls && (
    <div className="mt-2.5 rounded-lg border border-border-soft bg-panel2/60 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {/* ⚠️ **« offensifs » reste dans le titre** : le segmenté
            ci-dessous dit précisément ce que le bloc maximise, mais le mot
            dit autre chose : ce bloc ne
            cherche pas la meilleure paire dans l'absolu, il cherche la plus
            offensive — et ses deux crans (dégâts bruts, dégâts du sort) sont
            offensifs l'un comme l'autre. Sans lui, « meilleurs » se lirait
            comme un verdict général, alors qu'un tank peut parfaitement
            vouloir tout autre chose. */}
        <span className="label">Meilleurs artéfacts offensifs pour ce build</span>
        {/* ⚠️ **L'ABSOLU d'abord, l'écart ensuite** (demande explicite). Le
            delta seul laissait sans réponse « combien cette paire me
            rapporte-t-elle ? » : un gros gain sur une base nulle et un petit
            gain sur une grosse base affichaient le même nombre.
            ⚠️ L'absolu s'affiche TOUJOURS, même quand on porte déjà la
            meilleure paire — c'est justement là qu'il est seul à dire quelque
            chose, l'écart valant zéro. L'écart, lui, ne s'affiche que si la meilleure
            paire n'est pas déjà portée et que l'écart n'est pas nul à
            l'arrondi, en plus comme en moins (voir plus bas). */}
        {/* ⚠️ Aucun chiffre quand il n'y a rien à proposer : un « 0 / coup »
            se lirait comme un résultat, alors que rien n'a été cherché. */}
        {modeArtefactsSeuls.explication == null && (
          <span className="flex items-baseline gap-1.5 font-mono text-micro">
            <span className="text-ink">
              {Math.round(modeArtefactsSeuls.degatsParCoup).toLocaleString('fr-FR')}
              {modeArtefactsSeuls.surLeReel ? ' dégâts' : ' / coup'}
            </span>
            {/* ⚠️ **L’écart s’affiche AUSSI quand il est négatif.** Il ne
                l’était que s’il était positif : on cachait donc exactement
                l’information défavorable, en laissant un absolu qui avait
                l’air d’un gain.

                ⚠️ Un écart négatif n’est PAS une anomalie : la paire
                portée sort des candidates dès qu’une contrainte l’exclut —
                une principale imposée, une ligne verrouillée, ou une pièce
                déjà réservée par un autre monstre de la liste. Le nombre dit
                alors ce que cette contrainte coûte, ce qui est précisément
                ce qu’on veut savoir.

                ⚠️ Test sur l’ARRONDI, pas sur la valeur brute : un écart
                de 0,4 aurait affiché « +0 ». */}
            {!modeArtefactsSeuls.dejaPorte && Math.round(modeArtefactsSeuls.gainBrutParCoup) !== 0 && (
              <span className={modeArtefactsSeuls.gainBrutParCoup > 0 ? 'text-good' : 'text-bad'}>
                {modeArtefactsSeuls.gainBrutParCoup > 0 ? '+' : '−'}
                {Math.abs(Math.round(modeArtefactsSeuls.gainBrutParCoup)).toLocaleString('fr-FR')}
              </span>
            )}
          </span>
        )}
      </div>
      {/* ⚠️ Choisir « Dégâts réels » OUVRE la fenêtre du combat, comme le cran
          homonyme de l'objectif de recherche : sans ce geste, le classement
          reposerait sur un sort, une cible et un critique jamais choisis —
          exactement ce qui avait fait RETIRER cette optimisation. */}
      <Segmented<'brut' | 'reel'>
        options={CRITERE_ARTEFACTS_LABELS}
        value={critereArtefacts}
        onChange={(v) => {
          setCritereArtefacts(v);
          if (v === 'reel') setSetupOuvert(true);
        }}
        size="sm"
        // ⚠️ `w-fit` : le `flex-none` que `Segmented` pose en taille `sm` ne
        // vaut que s'il est ENFANT d'un conteneur flex. Ici le parent est en
        // flux de bloc, donc sa propre boîte flex prenait toute la largeur —
        // deux crans étirés sur 700 px. Même piège que la grille Conditions,
        // qui porte déjà ce `w-fit` pour la même raison.
        className="mt-1 w-fit"
      />
      {modeArtefactsSeuls.reelIndisponible && (
        <p className="mt-1 text-micro text-warn">
          Aucun sort de ce monstre n’est calculable : classement sur les dégâts supplémentaires.
        </p>
      )}
      {/* ⚠️ **Un seul emplacement figé : la proposition reste valable, mais
          CONTRAINTE.** Sans cette ligne, « le meilleur » se lirait comme « le
          meilleur de ton inventaire », alors qu'une moitié était imposée. La
          question reste bonne — « à artéfact d'attribut donné, quel type ? » —
          il faut juste dire qu'on y répond. */}
      {modeArtefactsSeuls.explication == null && sortesFigees.length === 1 && (
        // ⚠️ **Un BANDEAU, pas une phrase de bas de bloc.** La mention
        // vivait en `text-ink-dimmer` sous le titre, loin du regard : on
        // lisait la paire en croyant à deux propositions. Elle passe donc
        // AU-DESSUS des pièces, dans une boîte qui se détache du bloc.
        //
        // ⚠️ **Neutre appuyé, pas `alerte`** : un
        // réglage que l’utilisateur a lui-même posé n’est pas un
        // avertissement. L’ambre reste réservé à ce qui réclame une action
        // (« Valider les artéfacts ») — deux ambres de sens différents dans
        // la même carte auraient dévalué les deux. Le contraste vient donc
        // du contour (`border` plein là où le bloc porte `border-soft`) et
        // de l’encre pleine, pas de la couleur.
        //
        // ⚠️ UN seul contour : ce bandeau est un FRÈRE des pièces, jamais
        // une boîte posée sur une autre boîte déjà bordée.
        <p className="mt-1.5 rounded border border-border bg-panel px-2 py-1 text-micro leading-tight text-ink">
          <b className="font-semibold">
            Emplacement {sortesFigees[0] === 'element' ? 'attribut' : 'type'} figé
          </b>{' — '}
          il est gardé tel que porté, pas optimisé. Seul l’emplacement{' '}
          {sortesFigees[0] === 'element' ? 'type' : 'attribut'} est cherché ici.
        </p>
      )}
      {/* ⚠️ **La raison passe DEVANT tout le reste.** Elle dit ce que
          l'utilisateur a lui-même posé (un emplacement figé) ou ce que
          l'inventaire ne peut pas donner — dans les deux cas, afficher une
          proposition ou un « déjà porté » serait trompeur. */}
      {modeArtefactsSeuls.explication != null ? (
        <p className="mt-0.5 text-micro leading-tight text-ink-dim">{modeArtefactsSeuls.explication}</p>
      ) : modeArtefactsSeuls.dejaPorte ? (
        // ⚠️ Le dire plutôt que d'afficher « +0 » : « tu portes déjà les
        // meilleurs » est une réponse, un zéro ressemble à une panne.
        <p className="mt-0.5 text-micro text-ink-dim">
          Tu portes déjà la meilleure paire disponible pour ce critère.
        </p>
      ) : modeArtefactsSeuls.paire.length === 0 ? (
        <p className="mt-0.5 text-micro text-ink-dim">Aucun artéfact équipable ne correspond aux critères.</p>
      ) : (
        // ⚠️ **Le rendu du JEU, pas une ligne aplatie.** Les quatre
        // sous-propriétés étaient jointes par des « · » sur une seule ligne qui
        // repassait à la ligne n'importe où, avec un formatage maison
        // (`artifactSubLabel(...).replace('X', …)`) — un second rendu de la
        // même donnée, que rien ne rapprochait de l'inventaire ni du jeu.
        // `ArtifactSubLigne` est PARTAGÉ avec la tuile d'inventaire :
        // une ligne par propriété, la pastille de procs, la valeur en gras, le
        // marqueur des propriétés modifiées.
        // ⚠️ **Côte à côte, pas empilés** : une PAIRE se lit d'un coup d'œil,
        // et l'empilement doublait la hauteur du bloc dans une carte déjà
        // longue. `sm:` et non une largeur de conteneur : sous ce seuil la
        // carte est pleine largeur mais étroite (téléphone), où deux colonnes
        // couperaient les libellés longs — ils repassent alors l'un sous
        // l'autre. `items-start` : l'artéfact qui a la principale la plus
        // courte ne s'étire pas à la hauteur de l'autre.
        <div className="mt-1.5 grid grid-cols-1 items-start gap-x-4 gap-y-2 sm:grid-cols-2">
          {modeArtefactsSeuls.paire.map((a) => (
            /* ⚠️ **Atténuation LÉGÈRE sur la pièce figée** — elle
                n’est pas une proposition, elle est un fait. Le bandeau et le
                marqueur le disent déjà ; ceci ne fait qu’établir la
                hiérarchie, pour que l’œil tombe d’abord sur la moitié
                réellement cherchée.

                ⚠️ **80 %, et surtout PAS moins.** Le vocabulaire
                « désactivé » de ce dépôt vit à 30-40 % (`Bouton`,
                `NumberField`) : descendre là ferait lire « indisponible »
                une pièce qui est justement celle qu’on portera. Rester
                nettement au-dessus garde le sens « secondaire ». */
            <div key={`${a.kind}-${a.id}`} className={`flex items-start gap-2 ${sortesFigees.includes(a.kind) ? 'opacity-80' : ''}`}>
              <ArtifactFrameIcon artifact={a} size={24} />
              <div className="min-w-0 flex-1">
                {/* La principale en tête, comme sur une pièce en jeu : sans
                    elle, on lisait quatre sous-propriétés sans savoir ce que
                    l'artéfact apporte d'abord. */}
                {/* ⚠️ **Le marqueur désigne LAQUELLE.** Le bandeau dit ce
                    qui se passe, ce jeton dit sur quelle pièce — sans lui,
                    il fallait retraduire « attribut » en « celle de
                    gauche ». Même gabarit que la pastille de sorte de
                    ArtifactLinesEditor : rien de nouveau dans la librairie. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-micro font-semibold leading-tight text-ink">{formatArtifactMain(a.main)}</p>
                  {sortesFigees.includes(a.kind) && (
                    <span className="shrink-0 rounded-full border border-border bg-panel px-1.5 py-px text-nano font-semibold text-ink-dim">
                      figé
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-[3px]">
                  {a.subs.map((s, i) => (
                    <ArtifactSubLigne key={i} sub={s} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ⚠️ **Dire ce que le chiffre EST.** Le « +X % grâce aux artéfacts » des
          cartes de résultat a été retiré précisément parce que personne ne
          pouvait le nommer. Celui-ci se nomme : des dégâts BRUTS, par coup,
          qui ne critent pas et ignorent la défense — donc calculables sans
          choisir de sort ni décrire d'adversaire. */}
      {/* ⚠️ Affichée dès qu'un chiffre l'est — donc AUSSI quand on porte déjà
          la meilleure paire, puisque l'absolu s'affiche dans ce cas-là. Un
          nombre sans sa légende serait exactement le défaut du « +X % grâce
          aux artéfacts » qu'on a retiré. */}
      {modeArtefactsSeuls.paire.length > 0 && (
        <p className="mt-1 text-nano text-ink-dimmer">
          {modeArtefactsSeuls.surLeReel
            ? `Dégâts totaux de ${resolvedSkill ? `« ${resolvedSkill.nom} »` : 'ce sort'} contre l’adversaire décrit — ouvre « Dégâts réels » pour changer le sort, la cible ou le traitement du critique.`
            : 'Dégâts supplémentaires bruts, à chaque coup — ils ne peuvent pas être critiques et ignorent la défense adverse, donc ce gain ne dépend ni du sort utilisé ni de la cible.'}
        </p>
      )}
      {modeArtefactsSeuls.coutVerrousPct != null && (
        // ⚠️ « sur ce build » n'est PAS une précaution de langage : la recherche
        // de runes a elle aussi tourné sous le modèle contraint, donc sans les
        // verrous d'AUTRES builds auraient pu émerger. Un libellé sans cette
        // précision laisserait croire à un contrefactuel global qu'on ne
        // calcule pas.
        <p className="mt-1 text-micro text-warn">
          Vos lignes verrouillées coûtent −{modeArtefactsSeuls.coutVerrousPct.toFixed(1)} % sur ce build.
        </p>
      )}
      {/* ⚠️ **La proposition devient actionnable.** Le bloc calculait la
          meilleure paire sans qu’on puisse la prendre : il fallait la
          retrouver à la main dans l’inventaire. Le bouton n’apparaît qu’avec
          une liste active — une réservation appartient toujours à une liste
          — et jamais sur une pièce figée ou une absence de proposition. */}
      {modeArtefactsSeuls.explication == null &&
        modeArtefactsSeuls.paire.length > 0 &&
        sourceSelector &&
        lists.activeListId &&
        (ownValidatedBuild || canValidateDisplayed) && (
          <Bouton
            onClick={handleValidateArtefacts}
            disabled={artefactsProposesDejaReserves}
            // ⚠️ Même code couleur que « Valider les artéfacts » des cartes
            // de résultat : `alerte` signale un état des DONNÉES — ce qui est
            // montré n’est pas ce qui est réservé. Une fois réservée, la
            // paire repasse en `accent`, comme tout ce qui est validé.
            ton={artefactsProposesDejaReserves ? 'accent' : 'alerte'}
            fond="doux"
            taille="sm"
            pleineLargeur
            icone={artefactsProposesDejaReserves ? <CheckCircle2 size={14} /> : undefined}
            libelle={
              artefactsProposesDejaReserves
                ? 'Artéfacts validés'
                : ownValidatedBuild
                  ? 'Valider ces artéfacts'
                  : 'Valider ce build avec ces artéfacts'
            }
            className="mt-2"
          />
        )}
    </div>
  );

  const validateBuildButton = (
    <>
      <Bouton
        onClick={handleValidateDisplayed}
        disabled={!canValidateDisplayed || matchesValidatedBuild}
        // ⚠️ Même code couleur que les cartes de résultat (BuildCandidateCard) :
        // `alerte` sur « Valider les artéfacts », parce qu'il signale un état
        // des DONNÉES — ce qui est affiché n'est pas ce qui est réservé.
        ton={etatFiche === 'oui' ? 'accent' : etatFiche === 'artefacts' ? 'alerte' : 'neutre'}
        fond={etatFiche === 'non' ? 'plein' : 'doux'}
        taille="sm"
        pleineLargeur
        icone={matchesValidatedBuild ? <CheckCircle2 size={14} /> : undefined}
        // ⚠️ Trois libellés, pas deux : mêmes runes + autre paire, il reste
        // quelque chose à valider — les artéfacts. Voir `EtatValidation`.
        libelle={etatFiche === 'oui' ? 'Validé' : etatFiche === 'artefacts' ? 'Valider les artéfacts' : 'Valider ce build'}
        className="mt-2.5"
      />
      {/* Message listant les runes déjà utilisées — demande explicite,
          « il faut afficher quelles runes sont déjà utilisées dans la
          liste ». Absent si déjà validé (le bandeau `validatedBadge`
          suffit alors, ce build EST la réservation). */}
      {displayedRuneConflicts.length > 0 && !matchesValidatedBuild && (
        <p className="mt-1.5 text-[11px] text-warn">
          {displayedRuneConflicts.length > 1 ? 'Runes déjà réservées' : 'Rune déjà réservée'} dans cette liste :{' '}
          {displayedRuneConflicts.map((c, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {c.slot != null ? `emplacement ${c.slot}` : 'une rune'} ({c.monsterName})
            </span>
          ))}
          .
        </p>
      )}
    </>
  );

  const zoneCContent = (
    <div className="rounded-lg border border-border-soft bg-panel2/60 p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold text-ink-dim truncate">
          {activeList ? `Monstres de « ${activeList.name} »` : 'Monstres de la liste'}
        </p>
        {activeList && <span className="flex-none text-[11px] text-ink-dimmer">{activeMembers.length}</span>}
      </div>

      <Bouton
        trait="pointille"
        taille="sm"
        pleineLargeur
        icone={<Plus size={14} />}
        libelle={ajoutListe.libelle}
        disabled={!ajoutListe.actif}
        onClick={handleAddToList}
        className="mb-2"
      />
      <Bouton libelle="Lier une team" taille="sm" pleineLargeur disabled={!activeList || activeMembers.length < 2}
        onClick={() => activeList && setEquipeOuverte({ listId: activeList.id, equipe: null })} />

      <div className="h-16 overflow-y-auto text-[11px] text-warn" role="status" aria-label="Rapport des critères">
        {[...lists.rapportStockage, ...optimizer.rapportCriteres].map((message, index) => <p key={index}>{message}</p>)}
      </div>

      {activeMembers.length === 0 ? (
        <p className="px-0.5 py-3 text-center text-[12px] italic text-ink-dim">
          {activeList ? "Aucun monstre dans cette liste pour l'instant." : 'Choisis ou crée une liste ci-dessus.'}
        </p>
      ) : (
        <div className="max-h-[220px] space-y-1 overflow-y-auto">
          {groupesMembres.filter(g => g.members.length > 0).map((g, numero) => <section key={g.equipe?.id ?? 'sans-equipe'} aria-label={g.equipe ? `Équipe ${numero + 1}` : 'Sans équipe'} className="space-y-1">
            {g.equipe && <div className="flex flex-wrap items-center justify-between gap-2 py-1">
              <span className="text-xs font-semibold text-ink">Équipe {numero + 1}
                {g.equipe.leader && <span className="ml-1 font-normal text-ink-dim">· Leader : {resolveExclusionEntry(g.equipe.leader, exclusionData)?.monster.name ?? 'Introuvable'}</span>}
              </span>
              {g.equipe.lead ? <LeadPill ls={g.equipe.lead} titre={`Lead de l’équipe : +${g.equipe.lead.amount} % ${STAT_LABEL[g.equipe.lead.stat ?? ''] ?? g.equipe.lead.stat ?? ''} · ${g.equipe.lead.area === 'Guild' ? 'Guilde' : g.equipe.lead.area === 'Dungeon' ? 'Donjon' : g.equipe.lead.area === 'Arena' ? 'Arène' : g.equipe.lead.area === 'Element' ? 'Élément' : 'Général'}`} /> : <span className="text-xs text-ink-dim">Sans lead</span>}
              <Bouton taille="xs" fond="vide" libelle="Modifier l’équipe" onClick={() => setEquipeOuverte({ listId: g.equipe!.listId, equipe: g.equipe })} />
            </div>}
          {g.members.map((m) => {
            const key = exclusionSelectorKey(m.selector);
            const resolved = resolveExclusionEntry(m.selector, exclusionData);
            const build = findValidatedBuild(lists.validated, lists.activeListId, key);
            const absentes = build ? runesManquantesDuBuild(build, runeById) : [];
            const lead = resolved ? leadEffectifMembreOptimizer(lists, m.listId, m.selector, resolved.monster.element) : null;
            return (
              <div key={key} className="flex flex-wrap items-center gap-x-2 rounded-lg border border-border-soft bg-panel/60 px-2 py-1.5">
                <ZoneCliquable
                  imbrique
                  disabled={!resolved}
                  onClick={() => {
                    if (!resolved) return;
                    const id = String(resolved.monster.id);
                    // L'action partagée valide l'identité puis restaure la
                    // mémoire ou la base complète, sans déclencher de guide.
                    const criteres = optimizer.choisirMembre(m.listId, m.selector);
                    setZoneDOpen(false);
                    // ⚠️ **Rappel des auras externes — ICI,
                    // dans le geste de la liste de travail, et nulle part
                    // ailleurs** : ni dans `resetSearch`, ni dans un effet sur
                    // `selectedId` — l'import d'une recette ou d'un compte pose
                    // aussi le monstre, et le bestiaire, les puces de source et
                    // la zone D restent sans rappel. Autre espèce OU autre exemplaire de la
                    // même espèce ; la décision lit la destination réellement
                    // appliquée, jamais les auras du membre précédent.
                    if (
                      criteres && doitRappeler(
                        'liste',
                        { espece: selectedId, exemplaire: ownSelectorKey, aurasExternes: damageSetup.setsAuraExternes },
                        { espece: id, exemplaire: key, aurasExternes: criteres.damageSetup.setsAuraExternes }
                      )
                    ) {
                      setRappelAuras((n) => (n ?? 0) + 1);
                    } else setRappelAuras(null);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MonsterAvatar monster={resolved?.monster ?? null} size={24} className="flex-none" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
                    {resolved?.monster.name ?? 'Introuvable'}
                    {m.selector.source === 'unowned' && (
                      <span className="ml-1 text-[10px] font-normal text-ink-dimmer">(non possédé)</span>
                    )}
                  </span>
                  <span className="w-4 flex-none text-center text-[12px] text-ink-dim" title={lists.memories.has(cleMemoireMembre(m.listId, m.selector)) ? 'Critères mémorisés' : undefined}>
                    {lists.memories.has(cleMemoireMembre(m.listId, m.selector)) ? <span aria-label="Critères mémorisés">●</span> : null}
                  </span>
                </ZoneCliquable>
                {build ? (
                  <>
                    <span className={`flex flex-none items-center gap-1 text-[10.5px] font-semibold ${absentes.length ? 'text-warn' : 'text-accent'}`}
                      title={absentes.length ? 'Build conservé ; les runes absentes du compte ne sont plus réservées.' : undefined}>
                      <CheckCircle2 size={12} />
                      {absentes.length ? `${absentes.length} rune(s) absente(s)` : 'Validé'}
                    </span>
                    {/* ⚠️ **L’icône disait le contraire de l’action.** Ce
                        bouton LIBÈRE, et portait le `CheckCircle2` de la
                        validation — le même pictogramme que le badge
                        « Validé » posé juste à sa gauche. Il porte désormais
                        la roue barrée d’une interdiction, celle d’« Exclure
                        les runes déjà utilisées » : du point de vue du
                        monstre, libérer, c’est lui retirer ses runes. */}
                    <BoutonIcone
                      cadre
                      libelle="Libérer ce build (runes et artéfacts)"
                      icone={
                        <IconeInterdite cadre={false} taille={16}>
                          <img src={WHEEL_IMG} alt="" className="h-3.5 w-3.5 object-contain" />
                        </IconeInterdite>
                      }
                      onClick={() => setReleaseConfirm({ listId: m.listId, selector: m.selector })}
                      className="h-6 w-6 flex-none"
                    />
                    {/* ⚠️ **Rendre la PAIRE sans défaire le runage.** Un
                        artéfact physique ne se porte que sur un monstre à la
                        fois : on veut souvent le récupérer pour un autre sans
                        renoncer au runage déjà planifié. Affiché seulement
                        s’il y a quelque chose à rendre — un bouton qui ne
                        ferait rien serait pire qu’un bouton absent. */}
                    {(build.artifactIds ?? []).length > 0 && (
                      <BoutonIcone
                        cadre
                        libelle="Libérer les artéfacts (le runage reste réservé)"
                        icone={
                          <IconeInterdite cadre={false} taille={16}>
                            <GameIcon name="artifact" size={13} />
                          </IconeInterdite>
                        }
                        onClick={() => setReleaseArtifactsConfirm({ listId: m.listId, selector: m.selector })}
                        className="h-6 w-6 flex-none"
                      />
                    )}
                  </>
                ) : (
                  <span className="flex-none text-[10.5px] text-ink-dimmer">pas encore validé</span>
                )}
                <BoutonIcone
                  cadre
                  libelle="Retirer de la liste"
                  icone={<Trash2 size={14} className="text-ink-dim" />}
                  onClick={() =>
                    build
                      ? setRemoveMemberConfirm({ listId: m.listId, selector: m.selector })
                      : lists.removeMember(m.listId, m.selector)
                  }
                  className="h-6 w-6 flex-none"
                />
              {g.equipe && <p className={`h-8 w-full overflow-y-auto text-[11px] text-warn ${lead?.type === 'aucun' ? '' : 'invisible'}`}>{lead?.type === 'aucun' ? lead.motif : 'Aucun lead inactif.'}</p>}
              </div>
            );
          })}
          </section>)}
        </div>
      )}

      {/* ⚠️ **Le rappel des auras, AUSSI sous la liste**
          — là où l'on vient de cliquer : « État de mon monstre » est souvent
          hors de l'écran à ce moment, toujours au téléphone. Le MÊME rappel que la boîte des
          auras : même état (`rappelAuras`, posé par le seul `onClick` d'un
          membre ci-dessus), donc même minuterie (`DUREE_ATTENTION_MS`) —
          jamais un second minuteur ni une seconde condition —, même message,
          même token (`warn` / `warn-soft`, un seul contour de 1 px).
          Rendu SANS condition du rappel, invisible le reste du temps : sa
          place est réservée sous la liste, rien ne bouge quand il paraît ni
          quand il s'efface (docs/03-developpeur/interface/, réponse n° 1). Monté avec
          la liste seulement : sans membre, aucun clic ne peut le poser.
          Pas d'`aria-live` : la boîte des auras, montée en permanence,
          l'annonce déjà — deux régions liraient deux fois la même phrase.
          Commun aux deux formats : au téléphone, il vit dans le dépliement
          de la zone C, ouvert au moment du clic. */}
      {activeMembers.length > 0 && (
        <p
          className={`mt-1 rounded-lg border border-warn bg-warn-soft px-2 py-1 text-xs font-semibold text-warn ${
            rappelAuras !== null ? 'animate-[apparition_200ms_var(--ease-out)]' : 'invisible'
          }`}
        >
          Pense à vérifier les sets d&apos;aura externes.
        </p>
      )}

      {listHasValidated && activeList && (
        <Bouton
          ton="neutre"
          fond="vide"
          trait="plein"
          taille="sm"
          pleineLargeur
          icone={<Unlock size={13} />}
          libelle={`Libérer toutes les runes de « ${activeList.name} »`}
          onClick={() => setReleaseAllConfirm(activeList.id)}
          className="mt-2"
        />
      )}
    </div>
  );

  return (
    // ⚠️ **Pleine largeur**, comme RTA/Siège/Mon compte — l'ancienne colonne
    // bornée à 768 px était le seul écran de l'app à s'en imposer une, et
    // empilait ~2 000 px de réglages à faire défiler sur un écran large à
    // moitié vide. La raison d'origine (« une ligne "libellé … champ" étalée
    // sur tout l'écran devient un aller-retour du regard ») reste vraie et
    // est traitée AUTREMENT : ce ne sont pas les lignes qui s'étirent, ce
    // sont les COLONNES qui se juxtaposent (voir la grille ci-dessous) — la
    // longueur de chaque ligne reste courte.
    <div className="space-y-5">
      {/* ⚠️ Pas de `useStickyState`/case à fermer, contrairement à
          MobileNotice : ce n'est pas un avertissement ponctuel mais un statut
          qui reste vrai tant que l'outil est en rodage — il doit rester
          visible à chaque visite, pas disparaître après un premier clic. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-warn/60 bg-warn/10 px-3 py-2.5">
        <FlaskConical size={16} className="mt-0.5 flex-none text-warn" />
        <p className="flex-1 text-xs leading-relaxed text-ink-dim">
          <b className="text-ink">Optimizer en bêta.</b> L'outil est encore en rodage : le moteur de
          recherche peut mettre du temps sur des critères serrés ou manquer un build sur un cas
          inhabituel — vérifie toujours le résultat avant de re-runer.
        </p>
      </div>

      <p className="text-sm text-ink-dim">
        Recherche parmi tes runes possédées ; rien n'est appliqué à ton compte, l'outil est purement
        indicatif — c'est à toi de re-runer dans le jeu.
      </p>

      {/* ── UNE SEULE grille, à partir de `xl`, pour tout l'écran de
          réglages (Monstre, Critères, Artéfacts, État de mon monstre,
          Exclusion, Réglages avancés) ────────────────────────────────────
          ⚠️ **Disposition au bureau** (`xl:grid-cols-[1.35fr_1fr]`) : rangée 1
          = Monstre & équipement, PLEINE LARGEUR (`xl:col-span-2`). Colonne 1,
          rangées 2 à 5 (`row-span-4`) = Critères de recherche. Colonne 2,
          de haut en bas : Artéfacts et reliques (rangée 2), État de mon
          monstre (3), Exclusion de runes (4), Réglages avancés (5). Rangée 6,
          pleine largeur = estimation.
          ⚠️ **Placement EXPLICITE (`col-start`/`row-start`/`row-span`) sur
          CHAQUE bloc** — l'ordre du DOM peut alors rester celui de l'ordre
          d'USAGE (1. monstre, 2. objectif, 3. critères, puis
          optionnellement exclusion/réglages avancés) SANS dicter l'ordre
          VISUEL au bureau. Sous `xl`, une seule colonne : ces classes ne
          s'appliquent plus, l'ordre du DOM (= l'ordre d'usage) devient
          l'ordre de lecture.
          ⚠️ **Réglages avancés reste EMPILÉ sous Exclusion de runes**
          (colonne 2, rangées 4 et 5) : son contenu déplié n'est pas un bloc
          INLINE qui grandit la carte, mais un **`FlottantAuto`** qui flotte
          PAR-DESSUS la page — la carte elle-même garde toujours la même
          hauteur repliée, donc aucune rangée ne bouge quand on déplie, quel
          que soit l'endroit où le bloc vit dans la grille. Voir
          `avancesRef`/`showAdvanced` plus bas, et
          [design.md](../../../docs/03-developpeur/interface/) : « un clic ne déplace
          jamais ce qu'on vient de cliquer » — un panneau replié par défaut
          ne peut pas réserver sa place à l'avance sans perdre l'intérêt
          d'être replié, donc il sort du flux (flottant), l'autre option
          prévue par cette règle.
          ⚠️ `items-start` : sans lui, chaque bloc s'étire à la hauteur de sa
          rangée et les cartes courtes se retrouvent avec un grand vide
          bordé.
          ⚠️ **Colonne 1 en `1.35fr`, pas une largeur en pixels** : une
          colonne bornée à `minmax(480px,560px)` est trop étroite pour la
          rangée d'équipement (recherche 224 + stats 200 + artéfacts 58 + roue
          208 + relique ≈ 800 px) — la roue puis la relique passeraient à la
          ligne, cette dernière finissant hors du cadre. En `fr`, la colonne
          suit la largeur réelle de l'écran (≈ 700 px à `xl`, ≈ 965 px sur un
          1920), et « Critères de recherche » (`w-fit`, même colonne) se
          serre sur son contenu. */}
      <div className="grid gap-5 items-start xl:grid-cols-[1.35fr_1fr]">
      {/* Étape 1 — carte À PART, en tête du DOM. ⚠️ **La fiche reste
          TOUJOURS affichée, vide (`EMPTY_GEAR`) tant qu'aucun monstre n'est
          choisi**, plutôt que de n'apparaître qu'au clic : l'espace qu'elle
          occupe est réservé d'avance (voir docs/03-developpeur/interface/). */}
      {/* ⚠️ Carte en PLEINE LARGEUR (`xl:col-span-2`, `xl:row-start-1`) : la
          fiche stats/artéfacts/runes/relique vit DANS cette carte (colonne
          interne de droite, sous les puces) et a besoin de la largeur des
          DEUX colonnes de la page pour tenir stats+artéfacts+roue+relique sur
          une seule ligne sans repasser à la ligne. « Exclusion de runes » et
          « Réglages avancés » occupent la colonne 2, rangées 4 et 5 (voir
          plus bas). */}
      <div className="rounded-xl border border-border bg-panel p-3 xl:col-span-2 xl:row-start-1">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
            <GameIcon name="monster" size={15} />
          </div>
          <p className="text-[13.5px] font-bold text-ink">Monstre &amp; équipement</p>
        </div>
        {/* ⚠️ Bureau et mobile ont des dispositions RÉELLEMENT DIFFÉRENTES
            ici, une par bloc `hidden`/`lg:hidden`, pas l'une déclinée de
            l'autre (voir docs/02-app/optimizer/) : recherche +
            puces CÔTE À CÔTE avec zones C/D en encarts fixes sur bureau,
            contre 3 blocs empilés avec un dépliement propre chacun au
            doigt. La fiche (zone E) a deux `<MonsterGear>`, un par format (ici,
            et dans le bloc 3 du téléphone), branchés sur le MÊME état
            (`selectionFiche`) — son contenu ne change pas entre les deux
            formats. */}
        {/* ⚠️ Carte en PLEINE LARGEUR — nécessaire pour que la fiche
            stats/artéfacts/roue/relique, déplacée ici SOUS les puces
            (colonne de droite), tienne sur une seule ligne sans repasser à
            la ligne (gabarit réel : ~200px stats + ~60px artéfacts + ~210px
            roue + ~60px relique).
            ⚠️ **`lg:grid-cols-[1.35fr_1fr]`, PAS `lg:grid-cols-2`** (demande
            explicite) : la séparation entre « Monstre à optimiser » et
            « Exemplaire » s'aligne ainsi avec celle des deux colonnes
            PRINCIPALES de la grille (`xl:grid-cols-[1.35fr_1fr]`, voir le
            commentaire d'ouverture de la grille) — un seul ratio de
            colonnes pour tout l'écran, pas deux proportions différentes
            qui se contrediraient visuellement l'une sous l'autre. */}
        <div className="hidden lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-6">
          {/* Zone A (recherche — résout une ESPÈCE dans tout le bestiaire,
              possédée ou non) + liste active
              + zone C (monstres de cette liste), à GAUCHE. */}
          <div>
            <p className="label mb-1.5">Monstre à optimiser</p>
            {/* ⚠️ Mode BESTIAIRE (voir MonsterSourcePicker.tsx) : résout une
                ESPÈCE (nom, icône, stats de base,
                sorts) dans TOUT le bestiaire — la recherche ne se fait pas
                PAR SOURCE (les 4 puces ne cherchent pas). Choisir
                un résultat pose l'espèce et tente une résolution Box
                silencieuse (`pickSpecies`, jamais en cas d'ambiguïté — voir
                sa définition). */}
            <MonsterSourcePicker mode="bestiary" candidates={allMonsters} onPick={pickSpecies} />
            {selected && (
              <div className="mt-3 flex items-center gap-2">
                <MonsterAvatar monster={selected.monster} size={32} />
                <span className="font-semibold text-[14px]">{selected.monster.name}</span>
              </div>
            )}
            {/* ⚠️ Aucune liste FIXE (Box/RTA/Défense siège ne sont pas des
                cas spéciaux, voir
                docs/02-app/optimizer/,
                « Créer, valider et réserver dans une liste ») —
                tout est créé/renommé/supprimé par l'utilisateur. Flotte par-
                dessus zone C, ne la pousse jamais (voir OptimizerListPicker.tsx). */}
            <div className="mt-3">
              <p className="label mb-1.5">Liste active</p>
              <OptimizerListPicker
                lists={lists.lists}
                activeListId={lists.activeListId}
                memberCounts={memberCountsByList}
                listContents={lists.listContents}
                onContent={lists.setListContent}
                onSelect={lists.setActiveListId}
                onCreate={lists.createList}
                onRename={lists.renameList}
                onDelete={lists.deleteList}
              />
            </div>
            <div className="mt-3">{zoneCContent}</div>
          </div>

          {/* Zone B (les 4 puces — choisissent l'EXEMPLAIRE de l'espèce
              déjà choisie à gauche dans un « contenu » précis) + zone D
              (désambiguïsation
              d'exemplaire, en `Flottant` sous les puces — ex. 2 équipes de
              siège) + fiche, à DROITE. */}
          <div className="flex flex-col gap-3">
            <div ref={zoneDRef} className="relative">
              <p className="label mb-1.5">Exemplaire</p>
              {/* ⚠️ Puce individuellement grisée si l'espèce n'est PAS
                  possédée dans CETTE source précise, tout le contrôle grisé
                  si elle ne l'est dans AUCUNE des 4 — voir l'axe `disabled` par option, ajouté à
                  Segmented.tsx pour ce cas précis. ⚠️ **`value={null}`
                  quand le build VALIDÉ est ACTUELLEMENT affiché**
                  (`matchesValidatedBuild`, PAS `ownValidatedBuild` seul —
                  la bascule « voir le runage réellement porté »,
                  `showRealGear`, peut en montrer l'équipement réel, qui
                  LUI reste la source réelle d'une puce) **ou quand
                  `sourceSelector` est `unowned`** (monstre non possédé,
                  demande explicite) : dans les deux cas, aucune puce ne
                  doit s'allumer — voir l'axe `value: T | null` ajouté à
                  Segmented.tsx pour ce cas précis. */}
              <Segmented
                options={sourceOptions}
                value={matchesValidatedBuild || unowned ? null : gearSource}
                onChange={pickSource}
                disabled={allSourcesEmpty}
                size="lg"
              />
              {zoneDOpen && (
                <Flottant aria-label="Choisir l'exemplaire" rembourrage="aucun" className="max-h-[300px] overflow-y-auto">
                  {zoneDList}
                </Flottant>
              )}
            </div>
            <div className="rounded-xl border border-border-soft bg-panel2/60 p-3">
              {validatedBadge}
              <MonsterGear
                gear={selected?.gear ?? EMPTY_GEAR}
                selection={selectionFiche}
                onSelectionChange={setSelectionFiche}
                relicUsageById={relicUsageById}
              />
              {validateBuildButton}
            </div>
          </div>
        </div>

        {/* Mobile : 3 blocs empilés, chacun son propre
            dépliement — pas les zones fixes ci-dessus. */}
        <div className="lg:hidden space-y-3">
          {/* Bloc 1 — recherche TOUJOURS visible, liste active + zone C
              rattachées EN DESSOUS en dépliement (`zoneCOpen`, repliée par
              défaut). */}
          <div>
            <p className="label mb-1.5">Monstre à optimiser</p>
            <MonsterSourcePicker mode="bestiary" candidates={allMonsters} onPick={pickSpecies} />
            {selected && (
              <div className="mt-3 flex items-center gap-2">
                <MonsterAvatar monster={selected.monster} size={32} />
                <span className="font-semibold text-[14px]">{selected.monster.name}</span>
              </div>
            )}
            <ZoneCliquable
              onClick={() => setZoneCOpen((v) => !v)}
              aria-expanded={zoneCOpen}
              className="mt-2 flex w-full items-center gap-1.5 text-[12.5px] font-semibold text-ink-dim"
            >
              Monstres à optimiser
              <ChevronDown size={13} className={`ml-auto transition-transform ${zoneCOpen ? 'rotate-180' : ''}`} />
            </ZoneCliquable>
            {zoneCOpen && (
              <div className="mt-2 space-y-3">
                <OptimizerListPicker
                  lists={lists.lists}
                  activeListId={lists.activeListId}
                  memberCounts={memberCountsByList}
                  listContents={lists.listContents}
                  onContent={lists.setListContent}
                  onSelect={lists.setActiveListId}
                  onCreate={lists.createList}
                  onRename={lists.renameList}
                  onDelete={lists.deleteList}
                />
                {zoneCContent}
              </div>
            )}
          </div>

          {/* Bloc 2 — puces TOUJOURS visibles, zone D rattachée EN DESSOUS
              en dépliement (`zoneDOpen`, EN LIGNE plutôt qu'en `Flottant` —
              un panneau flottant se prête mal à un écran étroit). */}
          <div>
            <p className="label mb-1.5">Exemplaire</p>
            <Segmented
              options={sourceOptions}
              value={matchesValidatedBuild || unowned ? null : gearSource}
              onChange={pickSource}
              disabled={allSourcesEmpty}
              size="lg"
            />
            {zoneDOpen && <div className="mt-2 rounded-lg border border-border-soft overflow-hidden">{zoneDList}</div>}
          </div>

          {/* Bloc 3 — fiche stats/artéfacts/runes/relique (même composant
              `MonsterGear` que RTA/Siège), bandeau « build validé » +
              bouton « Valider ce build » en plus, voir leur commentaire
              plus haut (`validatedBadge`/`validateBuildButton`). */}
          <div className="rounded-xl border border-border-soft bg-panel2/60 p-3">
            {validatedBadge}
            <MonsterGear
              gear={selected?.gear ?? EMPTY_GEAR}
              selection={selectionFiche}
              onSelectionChange={setSelectionFiche}
              relicUsageById={relicUsageById}
            />
              {validateBuildButton}
          </div>
        </div>
      </div>

      {/* Étape 3. ⚠️ **`w-fit` RETIRÉ** (demande explicite) : sans lui, la
          carte profite de toute la largeur de la colonne 1 plutôt que de se
          serrer sur son contenu — même patron que « Monstre & équipement »
          (carte haute à gauche, cartes plus courtes empilées à sa droite).
          ⚠️ **`xl:row-span-4`** : la colonne 2 empile QUATRE cartes —
          Artéfacts et reliques (2, bloc Relique fusionné dedans),
          État de mon monstre (3), Exclusion
          de runes (4), Réglages avancés (5). Ce nombre suit la colonne d'EN
          FACE, il ne décrit pas le contenu de celle-ci : toute carte ajoutée
          ou retirée à droite se répercute ici, et sur la rangée de la ligne
          d'estimation (pleine largeur, toujours en dernier). */}
      <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-1 xl:row-start-2 xl:row-span-4">
        <div className="mb-3 flex items-center gap-2">
          {/* Curseurs de réglage, colorés (accent) — plus parlant qu'une
              cible générique pour « plusieurs critères ajustables », et
              distinct du `Target` déjà utilisé plus bas pour un réglage
              précis (« Prioriser les stats les plus difficiles »). */}
          <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-accent/40 bg-accent-soft">
            <SlidersHorizontal size={13} className="text-accent" />
          </div>
          <p className="text-[13.5px] font-bold text-ink">Critères de recherche</p>
        </div>
        {/* ⚠️ **Deux colonnes** (demande explicite) : Set de runes recherché
            + Statistique principale imposée à GAUCHE (les deux contraintes
            qui portent sur les runes elles-mêmes), Artéfacts + Conditions à
            DROITE — vérifié sur un écran réel (capture d'écran) qu'il reste
            assez de place pour « Objectif de recherche » à côté, malgré la
            carte élargie par cette deuxième colonne. `items-start` : la
            colonne la plus courte ne s'étire pas à la hauteur de l'autre.
            Sous `lg`, retour à l'empilement (ordre du DOM inchangé : Set,
            Statistique principale, Artéfacts, Conditions). */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* ⚠️ **Trait vertical entre les deux colonnes** (demande explicite,
            capture d'écran à l'appui) — `lg:border-r` posé sur la colonne de
            GAUCHE uniquement (pas de `border-l` en plus sur la droite : deux
            traits à 1 px l'un de l'autre se liraient comme un contour flou,
            voir docs/03-developpeur/interface/). `lg:pr-6` : le trait respire du même
            écart que `lg:gap-6` sur le conteneur, sans quoi il collerait au
            texte de gauche. UNIQUEMENT à partir de `lg` — sous ce seuil, les
            deux « colonnes » s'empilent (`flex-col`), un trait vertical n'y
            aurait aucun sens. */}
        <div className="lg:border-r lg:border-border-soft lg:pr-6">
      {/* ⚠️ `max-w-md` — SEUL rempart (la carte elle-même n'a pas de
          `w-fit`, voir le commentaire d'ouverture de cette carte) : sans lui, ce
          bloc se laisserait pousser jusqu'à la largeur disponible de la
          piste de grille, beaucoup plus large que ce set n'en a besoin. */}
      <div
        ref={setPickerSectionRef}
        className={`max-w-md ${
          setPickerInvalid
            ? 'rounded-lg border border-bad bg-bad/15 p-2 -m-2 transition'
            : 'transition'
        }`}
      >
        <p className="label mb-1.5">Set de runes recherché</p>
        <SetComboPicker
          sets={comboSets}
          onChange={(next) => {
            setComboSets(next);
            if (next.length > 0) setSetPickerInvalid(false);
            // Ouverture guidée : Accuracy ou Tolerance
            // CHOISI comme set recherché guide vers l'interrupteur des auras
            // RES/PRE, sans toucher aux auras externes. Au geste seulement :
            // l'import d'une recette pose `comboSets` sans passer par ici.
            if (guideVersResPre({ setsRecherches: comboSets }, { setsRecherches: next })) guiderVersResPre();
          }}
        />
        {setPickerInvalid && (
          <p className="mt-1.5 text-micro font-semibold text-bad">
            Sélectionne au moins un set avant de lancer la recherche.
          </p>
        )}
      </div>

      {/* ⚠️ Trait horizontal entre Set de runes recherché et Statistique
          principale imposée (demande explicite) — `mt-4 border-t pt-4`
          remplace le `space-y-4` qu'avait le conteneur parent (sinon la
          marge automatique ET la bordure s'additionneraient, doublant
          l'écart visuel). */}
      <div className="mt-4 border-t border-border-soft pt-4">
        <div className="mb-2.5 flex items-center gap-1.5">
          <p className="label">Statistique principale imposée (slots pairs)</p>
          <HelpPopover title="Statistique principale imposée (slots pairs)">
            Aucune coche sur un slot = pas de contrainte. Pour un{' '}
            <b className="text-ink">Lushen</b> classique par exemple : <b className="text-ink">ATQ%</b> en 2,{' '}
            <b className="text-ink">Dmg Crit</b> en 4, <b className="text-ink">ATQ%</b> en 6.
          </HelpPopover>
        </div>
        <div className="flex flex-col gap-1.5">
          {CONFIGURABLE_SLOTS.map((slot) => (
            <div key={slot} className="flex items-center gap-2 flex-wrap">
              <span className="text-micro text-ink-dim w-14">Slot {slot}</span>
              {SLOT_MAIN_OPTIONS[slot].map((code) => {
                const active = (mainStatsBySlot[slot] ?? []).includes(code);
                return (
                  <Pastille
                    key={code}
                    actif={active}
                    onClick={() => toggleMainStat(slot, code)}
                    libelle={RUNE_EFFECT[code]?.label ?? code}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
        </div>

        <div>
      {/* ⚠️ Le bloc « Artéfacts » vivait ICI, en tête de cette colonne, au-
          dessus de Conditions. Déplacé dans sa PROPRE carte (colonne 2,
          rangée 2 — voir plus bas) : son interrupteur « Ignorer les
          statistiques » masquait sélecteurs et lignes verrouillées d'un coup,
          ce qui faisait REMONTER Conditions sous le doigt. Cette colonne ne
          porte donc plus que Conditions, et le trait qui les séparait a
          disparu avec lui — un trait en TÊTE de colonne, sans rien au-dessus,
          ne sépare plus rien. */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="label">Conditions</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-dim">Stats de base exclues</span>
            <HelpPopover title="Stats de base exclues">
              <b className="text-ink">PV/ATQ/DEF/VIT</b> : activé, la valeur est ce que l'équipement (runes ET
              artéfacts comptés) doit apporter <b className="text-ink">au-dessus de la base</b> du monstre. Désactivé,
              elle porte sur le total. <b className="text-ink">Taux Crit/Dgts Crit/RES/Précision</b> restent toujours
              en total, quel que soit ce réglage — ils partent de la valeur d'éveil du monstre.
            </HelpPopover>
            <Interrupteur
              actif={excludeBase}
              onChange={setExcludeBase}
              aria-label="Stats de base exclues des conditions PV/ATQ/DEF/VIT"
            />
          </div>
        </div>
        {/* ⚠️ `boxWidth` fixe sur CHAQUE NumberField ci-dessous (voir
            NumberField.tsx) : sans ça, un champ avec suffixe « % » serait
            TOUJOURS plus large qu'un champ sans suffixe à largeur de texte
            égale (le suffixe prend de la place en plus), et les colonnes
            Min/Max ne s'aligneraient pas d'une stat à l'autre. */}
        {/* ⚠️ `gap-x` réduit sous `sm` : trois colonnes plus deux écarts de
            16 px ne laissaient plus de place aux champs sur 348 px utiles. */}
        {/* ⚠️ `w-fit` : sans lui, un conteneur `grid` en bloc prend TOUTE la
            largeur de son parent, et les colonnes `auto` (Min/Max) SE
            PARTAGENT l'espace libre restant (comportement CSS Grid par
            défaut dès qu'aucune piste n'est en `fr`) — sur une carte large,
            Min et Max se retrouvaient étirés à des dizaines de pixels l'un
            de l'autre. `w-fit` borne la grille à son contenu réel : les
            colonnes redeviennent SERRÉES, quelle que soit la largeur de la
            carte qui l'entoure. Demande explicite : « resserré ». */}
        <div className="grid w-fit grid-cols-[minmax(76px,auto)_auto_auto] items-center gap-x-2 gap-y-1.5 sm:grid-cols-[minmax(90px,auto)_auto_auto] sm:gap-x-4">
          {/* ⚠️ En-têtes Min/Max AU DOIGT seulement. Sur téléphone, le libellé
              « Min »/« Max » collé à chaque champ faisait déborder la rangée
              (label + 2 champs + 2 mots > largeur utile) ; on les masque et on
              pose ces deux en-têtes une seule fois. Au bureau (`sm:`), chaque
              champ garde son libellé à côté et ces en-têtes disparaissent —
              rendu inchangé. */}
          <span className="sm:hidden" aria-hidden />
          <span className="label sm:hidden text-center">Min</span>
          <span className="label sm:hidden text-center">Max</span>
          {RECO_STATS.map((st) => {
            const affectedByToggle = BASE_TOGGLE_STATS.has(st.key);
            const base = baseOf(st.key);
            const capped = CAPPED_100.has(st.key);
            const bonusMode = affectedByToggle && excludeBase;
            const ceiling = capped ? (bonusMode ? 100 - base : 100) : undefined;
            // ⚠️ Plancher affiché/autorisé, PAS la même chose que `base` (qui
            // sert à la conversion affichage↔stockage, voir `baseOf`) : avec
            // zéro rune, un monstre a déjà AU MOINS ce bonus/total en jeu
            // (base nue + artéfacts éventuellement comptés) — voir
            // `artifactFloorOf`. En mode bonus, seul l'artéfact compte (la
            // base nue est déjà soustraite par la conversion elle-même) ; en
            // mode total, base ET artéfact s'additionnent.
            const floor = artifactFloorOf(st.key, base, bonusMode);

            const minTotal = minStats[st.key] ?? null;
            const minDisplayed = minTotal == null ? null : bonusMode ? minTotal - base : minTotal;
            const maxTotalVal = maxStats[st.key] ?? null;
            const maxDisplayed = maxTotalVal == null ? null : bonusMode ? maxTotalVal - base : maxTotalVal;

            return (
              <Fragment key={st.key}>
                <span className="text-xs text-ink">{st.label}</span>
                <div className="flex items-center gap-1.5">
                  <NumberField
                    value={minDisplayed}
                    onChange={(v) =>
                      setMinStats((prev) => {
                        const next = { ...prev };
                        if (v == null) delete next[st.key];
                        else next[st.key] = bonusMode ? v + base : v;
                        return next;
                      })
                    }
                    allowEmpty
                    // ⚠️ Le total (ou le bonus, artéfacts comptés) ne descend
                    // jamais sous ce plancher — même sans la moindre rune, il
                    // est déjà garanti (base nue en mode total, artéfacts en
                    // mode bonus).
                    min={floor}
                    max={ceiling}
                    placeholder={String(floor)}
                    suffix={st.suffix || undefined}
                    boxWidth="w-24"
                    ariaLabel={`${st.label} minimum`}
                    title="Minimum"
                  />
                  <span className="hidden sm:inline text-ink-dim text-micro">Min</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <NumberField
                    value={maxDisplayed}
                    onChange={(v) =>
                      setMaxStats((prev) => {
                        const next = { ...prev };
                        if (v == null) delete next[st.key];
                        else next[st.key] = bonusMode ? v + base : v;
                        return next;
                      })
                    }
                    allowEmpty
                    min={floor}
                    max={ceiling}
                    placeholder={capped ? String(ceiling) : '—'}
                    suffix={st.suffix || undefined}
                    boxWidth="w-24"
                    // ⚠️ **Un maximum sous le minimum retombe au défaut**
                    // (demande explicite) : la condition serait insatisfaisable
                    // par construction, et la recherche renverrait « 0 build »
                    // sans que rien ne dise pourquoi.
                    //
                    // ⚠️ À la SORTIE du champ, jamais à la frappe : on ne
                    // saurait pas distinguer un « 5 » définitif d'un « 50 » en
                    // cours d'écriture — c'est le même piège que celui que
                    // `NumberField` documente déjà pour le bornage par `min`.
                    //
                    // ⚠️ On EFFACE plutôt que de remonter à la valeur du
                    // minimum : le champ retrouve alors son placeholder, donc
                    // son défaut (le plafond pour une stat bornée à 100,
                    // « aucun maximum » sinon). Le corriger silencieusement en
                    // « max = min » poserait une contrainte que l'utilisateur
                    // n'a pas demandée, et qui ne laisse passer qu'une valeur.
                    onBlur={() => {
                      const mn = minStats[st.key];
                      const mx = maxStats[st.key];
                      if (mn == null || mx == null || mx >= mn) return;
                      setMaxStats((prev) => {
                        const next = { ...prev };
                        delete next[st.key];
                        return next;
                      });
                    }}
                    ariaLabel={`${st.label} maximum`}
                    title="Maximum"
                  />
                  <span className="hidden sm:inline text-ink-dim text-micro">Max</span>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="flex justify-end mt-1.5">
          <Bouton
            fond="vide"
            trait="aucun"
            taille="sm"
            onClick={() => {
              setMinStats({});
              setMaxStats({});
            }}
            icone={<RotateCcw size={13} />}
            libelle="Réinitialiser les conditions"
            className="text-ink-dim hoverable:text-bad"
          />
        </div>
      </div>

        </div>
        </div>
      </div>

      {/* Carte À PART, PAS un bloc dans « Critères de recherche » : une
          carte dédiée Artéfacts.
          ⚠️ 1. L'interrupteur « Ignorer les statistiques » masque d'un coup
          les sélecteurs ET les lignes verrouillées. Tant que le bloc vivait
          en tête de la colonne de droite de « Critères de recherche », ce
          clic faisait REMONTER « Conditions » — un clic qui déplace ce qui le
          suit, interdit par docs/03-developpeur/interface/. Isolé ici, il ne déplace
          plus que ce qui suit la carte entière.
          2. `xl:col-start-2 xl:row-start-2` — SOUS « Exemplaire », à la place
          libérée par « Objectif de recherche » (parti rejoindre le bouton
          Rechercher) : le bloc se lit « ces artéfacts, sur CE build », il doit
          toucher l'exemplaire qui fixe les runes.
          ⚠️ **Pas en pleine largeur** : essayé, capturé, rejeté — la pleine
          largeur projette la puce de sorte, le champ de minimum et la croix à
          ~1 400 px de leur propre libellé, soit une saccade d'un bout à
          l'autre de l'écran pour lire UNE ligne verrouillée.
          ⚠️ Le placement de grille est en `xl:` UNIQUEMENT : au doigt, l'ordre
          est celui du DOM, d'où cette carte déclarée juste après « Critères de
          recherche ». Les deux formats sont servis par le même JSX. */}
      <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-2">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {/* Même gabarit d'en-tête que les autres cartes (icône encadrée 6×6
              + titre 13,5 px) : `GameIcon name="artifact"` existait déjà et
              n'était pas utilisé ici — pas une icône de plus à inventer. */}
          <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
            <GameIcon name="artifact" size={15} />
          </div>
          {/* ⚠️ Titre étendu à la relique (voir le bloc « Relique »
              ci-dessous) : le titre suit l'interrupteur, qui porte déjà les
              deux mots — à confirmer par l'utilisateur au premier rendu. */}
          <p className="text-[13.5px] font-bold text-ink">Artéfacts et reliques</p>
          <HelpPopover title="Artéfacts et reliques">
            <b className="text-ink">« Libre »</b> cherche parmi tous tes artéfacts équipables ; une{' '}
            <b className="text-ink">principale</b> restreint la recherche à ceux qui la portent.{' '}
            <b className="text-ink">« Garder l&apos;artéfact équipé »</b> conserve la pièce entière portée sur le
            build affiché ci-dessus, sans rien chercher.
            <br />
            <br />
            <b className="text-ink">« Libre » ne donne jamais moins de résultats</b> qu&apos;une principale
            imposée : un build n&apos;est retenu que s&apos;il existe vraiment, chez toi, une paire qui lui fait
            tenir toutes tes conditions.
            <br />
            <br />
            La paire retenue suit le <b className="text-ink">tri</b> affiché — trier par PV effectifs ne choisit
            pas les mêmes artéfacts que trier par dégâts.
            <br />
            <br />
            La <b className="text-ink">relique</b> suit la même grammaire : une principale ET une propriété unique
            se combinent, et la propriété unique compte pour retenir ou écarter une relique{' '}
            <b className="text-ink">comme pour la noter</b> — son gain vaut un palier entier par tranche de
            statistique atteinte au début du combat.
          </HelpPopover>
          {/* `ml-auto` plutôt qu'un `justify-between` sur la rangée : le titre
              et son aide restent collés, l'interrupteur part à droite — même
              lecture qu'avant, dans le gabarit d'en-tête de carte. */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-dim">Activer l&apos;optimisation d&apos;artéfacts et reliques</span>
            <HelpPopover title="Activer l&apos;optimisation d&apos;artéfacts et reliques">
              Activé (défaut), chaque build reçoit la meilleure paire d&apos;artéfacts ET la meilleure relique
              parmi les tiennes, selon les réglages ci-dessous.
              <br />
              <br />
              Désactivé, le monstre <b className="text-ink">garde les artéfacts et la relique qu&apos;il porte</b>,
              statistiques comprises — on cesse simplement d&apos;en chercher d&apos;autres. Utile pour composer un
              runage autour des pièces déjà en place.
            </HelpPopover>
            <Interrupteur
              actif={optimiserArtefacts}
              onChange={setOptimiserArtefacts}
              aria-label="Activer l'optimisation d'artéfacts et reliques"
            />
          </div>
        </div>
        {/* Rangée Attribut/Type — la relique a rejoint le bas de la carte
            (le bloc Relique
            FERME la carte, plus de variante `xl:border-l`, voir plus bas). */}
        {optimiserArtefacts && (
          <div className="flex flex-wrap gap-3">
            {ARTIFACT_KINDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`text-xs text-ink ${LARGEUR_LIBELLE_LISTE}`}>{label}</span>
                {/* ⚠️ **`'libre'`, parce que c'est ce que le MOTEUR fait**
                    d'une clé absente (`candidatsParSorte`, artifactOptim.ts).
                    Ce sélecteur affichait « Garder l'artéfact équipé » tant
                    qu'aucun choix n'avait été fait, pendant que la recherche
                    cherchait librement : l'écran annonçait le contraire de ce
                    qui se passait, et tout ce qui se fiait à cet affichage
                    (les emplacements « figés », donc l'éditeur de verrous)
                    raisonnait sur un état faux. Le défaut se lit désormais au
                    même endroit pour tout le monde. */}
                <Selecteur
                  value={String(artifactMainByKind[key] ?? 'libre')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next: ArtifactMainChoice =
                      raw === 'equipped' || raw === 'libre' ? raw : (Number(raw) as 100 | 101 | 102);
                    setArtifactMainByKind((prev) => ({ ...prev, [key]: next }));
                  }}
                  taille="sm"
                  surface="panel2"
                  pleineLargeur={false}
                  className={LARGEUR_SELECTEUR_LISTE}
                >
                  {/* ⚠️ « Garder l'artéfact équipé », et non « Comme équipé » :
                      ce choix conserve la PIÈCE entière — le pool tombe à un
                      seul candidat, l'exemplaire porté avec ses quatre
                      sous-propriétés (voir `candidatsParSorte`,
                      artifactOptim.ts). L'ancien libellé, posé au milieu de
                      trois statistiques principales, se lisait « la
                      principale, comme équipé ». Signalé à l'usage. */}
                  <option value="equipped">Garder l&apos;artéfact équipé</option>
                  {/* ⚠️ « Libre » n’a de sens qu’avec une recherche d’artéfacts : il n’a
                      été ajouté qu’une fois celle-ci construite, pour ne pas laisser
                      une option morte dans le sélecteur. */}
                  <option value="libre">Libre</option>
                  {ARTIFACT_MAIN_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                  {/* ⚠️ Pas de « Aucun ». Retiré : vider UN emplacement pendant
                      que l'autre cherche ne correspond à rien en jeu, et « ne
                      pas compter les artéfacts » se dit d'un seul geste avec
                      l'interrupteur ci-dessus, pour les deux à la fois.
                      L'emplacement peut toujours RESTER vide si la recherche
                      n'a rien de mieux à y mettre — c'est l'imposer par sorte
                      qui n'avait pas de sens. */}
                </Selecteur>
              </div>
            ))}
          </div>
        )}
        {/* Sous les sélecteurs, et jamais au-dessus : les lignes
            verrouillées se lisent comme un raffinement du choix de pièce, pas
            comme une condition indépendante. Masqué avec le reste quand les
            artéfacts sont ignorés — un verrou n'aurait alors aucun effet, et
            une saisie sans effet est pire qu'une saisie absente. */}
        {optimiserArtefacts && (
          <div className="mt-3">
            <ArtifactLinesEditor
              lignes={lignesVerrouillees}
              onChange={setLignesVerrouillees}
              diagnostic={diagnosticVerrous}
              figees={sortesFigees}
            />
          </div>
        )}
        {/* ⚠️ **Le résultat rejoint ses commandes.** « Meilleurs artéfacts pour
            ce build » vivait sous la fiche d'équipement, avec une raison qui
            TIENT TOUJOURS : la fiche montre l'équipement RÉEL, on n'y
            substitue pas une proposition. Elle est satisfaite autrement — la
            fiche dit ce qu'on PORTE, cette carte voisine ce qu'on DEVRAIT
            porter, et elles restent côte à côte sous « Exemplaire ». Laisser
            les réglages ici et le résultat là-bas aurait séparé la cause de
            son effet.
            ⚠️ Rendu UNE seule fois désormais : il était interpolé deux fois
            (branche bureau et branche téléphone de « Monstre & équipement »),
            alors qu'un grep de son libellé n'en montrait qu'une — cette carte
            n'a pas de jumelle masquée. */}
        {blocArtefactsSeuls}
        {/* ⚠️ **Relique — ferme la carte, PAS une carte propre** (les variantes à droite de la rangée Attribut/Type, ou
            en carte à part, sont écartées). Trait horizontal sous « Meilleurs artéfacts », un seul
            contour, puis le sous-titre et sa rangée — même JSX pour les deux
            formats, ordinateur et téléphone : la rangée se replie seule via
            `flex-wrap` comme la rangée Attribut/Type juste au-dessus. Même
            interrupteur que les listes d'artéfacts : masqué
            avec elles plutôt que grisé à part — pas de carte séparée à
            expliquer, donc pas de texte « Coupée avec… ». */}
        {optimiserArtefacts && (
          <div className="mt-3 border-t border-border-soft pt-3">
            <div className="flex items-center gap-1">
              <span className="label">Relique</span>
              <HelpPopover title="Relique">
                Une <b className="text-ink">principale</b> ET une <b className="text-ink">propriété unique</b>{' '}
                se combinent. La propriété unique compte pour retenir ou écarter une relique, et{' '}
                <b className="text-ink">sa valeur entre dans la note</b> : le gain vaut un palier entier par
                tranche de statistique atteinte au début du combat, lu sur la pièce. Les soins et boucliers
                (Régénération) ne sont mesurés par aucun objectif, donc jamais notés.
                <br />
                <br />
                <b className="text-ink">« Garder la relique équipée »</b> conserve la pièce entière portée sur
                le build affiché ci-dessus, sans rien chercher.
              </HelpPopover>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs text-ink ${LARGEUR_LIBELLE_LISTE}`}>Principale</span>
                <Selecteur
                  value={String(relicMainChoice)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next: RelicMainChoice =
                      raw === 'equipped' || raw === 'libre' ? raw : (Number(raw) as 100 | 101 | 102);
                    setRelicMainChoice(next);
                  }}
                  taille="sm"
                  surface="panel2"
                  pleineLargeur={false}
                  className={LARGEUR_SELECTEUR_LISTE}
                >
                  <option value="equipped">Garder la relique équipée</option>
                  <option value="libre">Libre</option>
                  {RELIC_MAIN_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </Selecteur>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs text-ink ${LARGEUR_LIBELLE_LISTE}`}>Propriété unique</span>
                {/* ⚠️ **Sans effet avec « Garder la relique équipée »** (la
                    pièce est fixée) — désactivé plutôt que retiré, et le
                    dit, même règle que les sous-propriétés verrouillées sans
                    effet. */}
                <Selecteur
                  value={String(relicUniqueChoice)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setRelicUniqueChoice(raw === 'libre' ? 'libre' : Number(raw));
                  }}
                  taille="sm"
                  surface="panel2"
                  pleineLargeur={false}
                  className={LARGEUR_SELECTEUR_LISTE}
                  disabled={relicMainChoice === 'equipped'}
                  title={relicMainChoice === 'equipped' ? 'Sans effet : la relique équipée est fixée' : undefined}
                >
                  <option value="libre">Libre</option>
                  {/* ⚠️ Libellé DÉRIVÉ de `RELIC_UNIQUE` (`relicUniqueEffectLabel`,
                      effects.ts) — « <effet> en fonction <stat> » avec les mots du
                      jeu des deux moitiés, jamais une table séparée
                      (game-data-curation). Même libellé que sur la carte candidat
                      (RelicSlot → `RelicDetailBox` → `formatRelicUnique`, qui
                      reste la phrase COMPLÈTE, trop longue pour un sélecteur). */}
                  {Object.keys(RELIC_UNIQUE)
                    .map(Number)
                    .map((type) => (
                      <option key={type} value={type}>
                        {relicUniqueEffectLabel(type)}
                      </option>
                    ))}
                </Selecteur>
                {relicMainChoice === 'equipped' && (
                  <span className="text-nano text-ink-dimmer">sans effet : relique équipée fixée</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs text-ink ${LARGEUR_LIBELLE_LISTE}`}>Niveau minimum</span>
                {/* ⚠️ Filtre d'ENTRÉE sur le pool de reliques cherché, jamais
                    un critère de classement (la dominance départage les
                    reliques qui passent le seuil). Sans effet tant que
                    « Principale » ne vaut pas « Libre » ou une principale
                    forcée — pas désactivé pour autant : la combinaison
                    reste rare, et un champ qui apparaît/disparaît selon un
                    AUTRE champ de la même carte serait plus déroutant que
                    sans effet à l'occasion (contrairement à « Propriété
                    unique », désactivée seulement par « Garder la relique
                    équipée », qui la rend vraiment inerte). */}
                <NumberField
                  value={relicMinUpgrade}
                  onChange={(v) => setRelicMinUpgrade(v ?? DEFAULT_RELIC_MIN_UPGRADE)}
                  min={0}
                  max={15}
                  title="Niveau minimum de la relique — filtre d'entrée sur le pool cherché, jamais un critère de classement"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ⚠️ **Carte à part, sous « Artéfacts et reliques »** — ces cinq
          réglages ne sont PAS des réglages d'artéfact ni de relique. Ils
          décrivent le monstre : buffs reçus, leader skill d'équipe,
          compétences d'invocateur. Ils vivaient en bas de la carte
          Artéfacts, séparés par un simple trait, ce qui laissait croire
          qu'ils la servaient — alors qu'ils changent les statistiques du
          monstre tout court, donc aussi bien les dégâts supplémentaires que
          n'importe quel calcul de dégâts réels.
          ⚠️ **Toujours visible, indépendamment de l'objectif de recherche** :
          les laisser dans la fenêtre « Dégâts réels » les rendait invisibles à
          qui optimise l'efficience, alors qu'ils s'appliquaient quand même.
          ⚠️ `xl:col-start-2 xl:row-start-3` — la colonne 2 passe donc à QUATRE
          cartes empilées, d'où le `row-span-4` de « Critères de recherche » et
          le décalage d'une rangée de tout ce qui suit. */}
      <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-3">
        <EtatMonstre
          setup={damageSetup}
          maj={majDamageSetup}
          equipe={combatMembre.equipe !== null}
          motifLead={combatMembre.motif}
          etroit={etroit}
          artefacts={artefactsDegats}
          rappelAuras={rappelAuras !== null}
          onGuiderResPre={guiderVersResPre}
          rappelsBuffs={rappelsBuffs}
        />
      </div>

      {/* ⚠️ « Objectif de recherche » N'EST PAS ICI — il est dans la carte
          du bouton Rechercher, plus bas : *quoi* chercher et *chercher* vont
          ensemble, et sa description de combat est en fenêtre (voir
          DamageSetupModale.tsx). La colonne 2 rangée 2 est à la carte
          « Artéfacts ». */}

      {/* ── Réglages avancés + Exclusion de runes ──────────────────────
          Contenu factorisé une fois, affiché deux fois : en cartes en
          ligne au bureau (ordre : Exclusion de runes, puis Réglages
          avancés), dans le panneau « Options » au doigt — jamais dupliqué.
          Même patron que RunesOptim.tsx (voir MobileSheet plus bas).
          ⚠️ **Fragment, PAS un `<div>`** : les deux cartes desktop qu'il
          rend (Exclusion de runes, Réglages avancés) doivent devenir des
          ENFANTS DIRECTS de la grille pour se placer chacune dans sa propre
          rangée (`xl:row-start-4`/`xl:row-start-5`, colonne 2, sous
          Artéfacts et État de mon monstre) — un `<div>` intermédiaire les aurait fait
          compter comme UNE seule cellule de grille. `MobileSheet` (portail)
          et le paragraphe d'estimation n'ont pas besoin de cette
          contrainte, voir leurs commentaires plus bas. */}
      <>
      {(() => {
        // ⚠️ `dansPanneau` : seule la version DANS LE PANNEAU affiche « Pool de
        // runes = X » à côté du pré-filtrage — sur la page principale, la
        // même info existe déjà juste en dessous (voir plus bas), à un
        // défilement de distance. Dans le panneau, cette page est masquée par
        // le voile : sans ce doublon local, aucun moyen de voir l'effet du
        // réglage qu'on vient de toucher sans d'abord refermer le panneau.
        const reglagesAvancesInner = (dansPanneau: boolean) => (
          /* ⚠️ **DEUX colonnes dès que la place le permet** (demande explicite)
              — le pré-filtrage et son avertissement d'un côté, les
              interrupteurs de l'autre.
              ⚠️ `auto-fit`/`minmax` et NON un point de rupture d'écran
              (`sm:`/`xl:`) : ce qui décide ici est la largeur du PANNEAU, pas
              celle de la fenêtre. Le panneau prend la largeur de sa carte
              (`largeurAncre`), qui dépend elle-même de la colonne de grille —
              une même fenêtre peut donc donner un panneau large ou étroit. En
              dessous de ~520 px, une seule colonne ; au-delà, deux. Ça vaut
              aussi pour le panneau « Options » au doigt, sans une seule classe
              conditionnelle. */
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {/* ⚠️ Mêmes classes de boîte que les trois groupes d'« État de mon
              monstre » (EtatMonstre.tsx) : deux façons de cadrer un groupe
              dans cet écran se liraient comme deux natures différentes. */}
          <div className="rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
            <p className="text-[11.5px] text-ink-dim mb-1">Pré-filtrage par emplacement</p>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                options={SLOT_FILTER_PRESETS}
                value={slotFilterPreset}
                onChange={handleSlotFilterPresetChange}
                // Dans le panneau « Options » : pleine largeur, comme les autres
                // contrôles du tiroir. En ligne au bureau : serré à son contenu.
                size={dansPanneau ? 'lg' : undefined}
                className={dansPanneau ? '' : 'w-fit'}
              />
              {dansPanneau && estimate && (
                <span className="font-mono text-micro text-ink-dim">
                  Pool de runes = {formatBig(estimate.perSlot.reduce((a, b) => a + b, 0))}
                </span>
              )}
            </div>
            <p className="mt-1 text-micro text-warn max-w-[280px]">
              ⚠️ {SLOT_FILTER_PRESETS.find((p) => p.key === slotFilterPreset)?.hint}
            </p>
          </div>

          {/* ⚠️ `divide-y` et non un `border-t` par interrupteur : un trait ne
              se pose qu'ENTRE deux voisins, jamais au-dessus du premier. Avec
              des bordures individuelles, le premier interrupteur portait un
              trait en tête de colonne — anodin quand tout était empilé sous le
              pré-filtrage, mais lu comme une ligne perdue une fois le groupe
              posé en colonne à côté. */}
          <div className="divide-y divide-border rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
            {/* Toggle, même patron que « Prioriser les stats les plus
                difficiles » : désactivé par défaut, lu par `handleSearch` au
                clic sur « Rechercher », jamais un bouton qui lance sa propre
                recherche. */}
            <div className="flex items-center justify-between gap-2 py-3 first:pt-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] text-ink-dim">Rechercher jusqu'à épuisement complet</span>
                <HelpPopover title="Rechercher jusqu'à épuisement complet">
                  Retire la limite de temps de 10 minutes : la recherche continue tant qu'il reste des combinaisons
                  à examiner. Peut prendre très longtemps sur une recherche avec peu de conditions — le bouton{' '}
                  <b className="text-ink">« Arrêter »</b> reste disponible et garde le meilleur trouvé jusque-là.
                  Le plafond de 100 000 résultats collectés, lui, reste actif.
                </HelpPopover>
              </div>
              <Interrupteur
                actif={exhaustiveSearch}
                onChange={setExhaustiveSearch}
                aria-label="Rechercher jusqu'à épuisement complet"
              />
            </div>

            <div className="flex items-center justify-between gap-2 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] text-ink-dim">Diagnostic approfondi sur 0 résultat</span>
                <HelpPopover title="Diagnostic approfondi sur 0 résultat">
                  Après une recherche à 0 résultat, identifie quelle condition posée libère le plus de candidats si
                  on la retire — <b className="text-ink">un indice, pas une preuve</b>. Coûte plusieurs passes de
                  pré-filtrage au lieu d'une seule, jamais une recherche complète.
                </HelpPopover>
              </div>
              <Interrupteur
                actif={diagnoseBlockingEnabled}
                onChange={setDiagnoseBlockingEnabled}
                aria-label="Diagnostic approfondi sur 0 résultat"
              />
            </div>

            {/* Déplacé depuis son ancien emplacement (juste avant les
                boutons d'action) — même toggle, même logique, regroupé ici
                avec les autres réglages secondaires. */}
            <div className="flex items-center justify-between gap-2 py-3 last:pb-0">
              <div className="flex items-center gap-1.5">
                <Target size={15} className="text-ink-dim" />
                <span className="text-[11.5px] text-ink-dim">Prioriser les stats les plus difficiles</span>
                <HelpPopover title="Prioriser les stats les plus difficiles">
                  Par défaut, le budget de recherche est réparti également entre toutes les stats demandées en
                  même temps. Une stat rare (peu de runes candidates en apportent beaucoup) peut alors être
                  étouffée par une stat plus commune. Ce réglage réalloue davantage de budget vers{' '}
                  <b className="text-ink">les stats les plus difficiles à combiner</b> — peut retrouver un build
                  qu'une recherche normale rate, au prix d'une recherche plus longue.
                </HelpPopover>
              </div>
              <Interrupteur
                actif={adaptiveTrancheWeighting}
                onChange={setAdaptiveTrancheWeighting}
                aria-label="Prioriser les stats les plus difficiles"
              />
            </div>

            {/* « Vérifier toutes les combinaisons trouvées » : désactivé par défaut, lu EN DIRECT par la file
                (`cibleDeLaFile`), jamais par `handleSearch` — il ne change pas
                la recherche de runes, seulement jusqu'où la file vérifie.
                MASQUÉ sans optimisation d'artéfacts : sans file, rien n'est
                vérifié, et une saisie sans effet est pire qu'une saisie
                absente (même règle que « Adapter les artéfacts et reliques
                au tri »). L'interrupteur qui le masque vit dans une autre
                carte : rien ne bouge sous le clic. */}
            {optimiserArtefacts && (
              <div className="flex items-center justify-between gap-2 py-3 last:pb-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] text-ink-dim">Vérifier toutes les combinaisons trouvées</span>
                  <HelpPopover title="Vérifier toutes les combinaisons trouvées">
                    Par défaut, la vérification des artéfacts et de la relique s'arrête dès que{' '}
                    <b className="text-ink">100 combinaisons sont confirmées</b> (300 quand la relique est cherchée) :
                    les suivantes ne sont vérifiées que si tu ouvres leur page.
                    <br />
                    <br />
                    Activé, toutes les combinaisons trouvées sont vérifiées, au-delà de ces confirmées : le compte
                    devient complet, mais cela peut prendre plusieurs minutes.
                  </HelpPopover>
                </div>
                <Interrupteur
                  actif={verifierToutesLesCombinaisons}
                  onChange={setVerifierToutesLesCombinaisons}
                  aria-label="Vérifier toutes les combinaisons trouvées"
                />
              </div>
            )}

            {/* « Compter les effets d'auras Tolerance et Précision dans les
                conditions » (libellé de l'utilisateur) :
                activé par défaut, branché sur `compterAurasResPre`, qu'une
                recette porte déjà et que la recherche lit au clic sur
                « Rechercher » (`avecAurasConditions`).
                ⚠️ **Rendu SANS condition**, même sans aucune aura RES/PRE
                saisie : les activations Tolerance/Accuracy PROPRES d'un build
                comptent aussi, et un réglage qui apparaît et disparaît avec
                la saisie d'une autre carte ne se retrouve pas. Ce contenu est
                commun aux deux formats — le flottant du bureau et le panneau
                « Options » au doigt.
                ⚠️ EN DERNIER : la rangée conditionnelle du dessus
                (« Vérifier toutes… ») ne le décale qu'au geste d'une autre
                carte, jamais sous le clic.
                ⚠️ **Cible de l'ouverture guidée** : le
                cadre intérieur porte le surlignage d'attention, au même token
                que le rappel (`warn` / `warn-soft`). Il existe EN PERMANENCE,
                transparent : se colorer ne bouge rien. Intérieur et non sur la
                rangée elle-même, dont le trait du haut vient de `divide-y` :
                un contour posé dessus en ferait deux superposés. `-mx-1` le
                tient à 4 px du cadre de la boîte ; `px-[3px]` + 1 px de bord
                gardent le libellé aligné sur ceux du dessus, et `py-2` +
                `py-[3px]` + 1 px refont les 12 px de `py-3`. Une ref par
                surface (flottant, panneau), pour y défiler. */}
            <div className="py-2 last:pb-0">
              <div
                ref={dansPanneau ? interrupteurResPrePanneauRef : interrupteurResPreFlottantRef}
                className={`-mx-1 flex items-center justify-between gap-2 rounded-md border px-[3px] py-[3px] transition-colors duration-200 ${
                  attentionResPre !== null ? 'border-warn bg-warn-soft' : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] text-ink-dim">
                    Compter les effets d'auras Tolerance et Précision dans les conditions
                  </span>
                  <HelpPopover title="Compter les effets d'auras Tolerance et Précision dans les conditions">
                    Activé, chaque set <b className="text-ink">Tolerance</b> ou <b className="text-ink">Accuracy</b> ajoute
                    8 points de RES ou de Précision aux <b className="text-ink">minimums et aux maximums</b> de ces deux
                    conditions : ceux des autres monstres, saisis dans « État de mon monstre », et ceux que forment les
                    runes de chaque build.
                    <br />
                    <br />
                    Désactivé, ces deux conditions portent sur les statistiques sans aucune aura. Les dégâts et les PV
                    effectifs comptent les auras dans les deux cas.
                  </HelpPopover>
                </div>
                <Interrupteur
                  actif={compterAurasResPre}
                  onChange={setCompterAurasResPre}
                  aria-label="Compter les effets d'auras Tolerance et Précision dans les conditions"
                />
              </div>
            </div>
          </div>
          </div>
        );

        const reglagesAvancesTitre = (
          <>
            {/* Clé à molette, distincte des curseurs de « Critères de
                recherche » (forme différente, pas seulement une couleur) —
                même traitement accent que les autres en-têtes de carte. */}
            <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-accent/40 bg-accent-soft">
              <Wrench size={13} className="text-accent" />
            </div>
            Réglages avancés
          </>
        );

        const dejaUtiliseesBlock = (
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {/* Roue de runes (le fond derrière les runes des résultats de
                  build, RuneWheel.tsx), barrée du symbole « interdit » —
                  même traitement que l'icône « Exclusion de runes » : ce
                  réglage retire des runes DÉJÀ PORTÉES de la recherche. */}
              <IconeInterdite>
                <img src={WHEEL_IMG} alt="" className="h-4 w-4 object-contain" />
              </IconeInterdite>
              <span className="text-[12.5px] font-semibold text-ink-dim">Exclure les runes déjà utilisées</span>
              <HelpPopover title="Exclure les runes déjà utilisées">
                Par défaut, la recherche considère TOUT l'inventaire, runes déjà portées ailleurs comprises. Active ce
                réglage pour retirer de la recherche les runes déjà portées par d'AUTRES monstres dans le périmètre
                choisi ci-dessous (un seul à la fois) — un build réellement montable sans déruner quelqu'un. Le monstre
                recherché lui-même n'est jamais exclu de ses propres runes.
              </HelpPopover>
              <Interrupteur actif={excludeUsedRunes} onChange={setExcludeUsedRunes} aria-label="Exclure les runes déjà utilisées" />
            </div>
            <Segmented
              options={AUTO_EXCLUSION_SCOPES}
              value={excludeUsedScope}
              onChange={setExcludeUsedScope}
              disabled={!excludeUsedRunes}
              size="lg"
            />
          </div>
        );

        // Exclusion MANUELLE — se superpose à « Exclure les runes déjà
        // utilisées », ne la remplace pas (voir optimizerExclusion.ts).
        // Choisir un monstre ici, dans n'importe laquelle des 4 sources,
        // retire ses runes ACTUELLEMENT équipées du pool considéré, en plus
        // de l'exclusion automatique éventuelle.
        // ⚠️ **Pas de paramètre `dansPanneau`** : `Segmented` mesure lui-même
        // la place qu'il reçoit et se resserre tout seul, au bureau comme au
        // doigt (voir Segmented.tsx). Le bloc est donc identique dans les
        // deux rendus.
        const monstrePrecisBlock = (
          <div>
            <div className="mb-2.5 flex items-center gap-1.5">
              {/* Même icône que « Monstre & équipement » (GameIcon
                  "monster"), barrée du symbole « interdit » — même
                  traitement que l'icône « Exclusion de runes » plus bas :
                  cette action RETIRE le monstre choisi du pool de runes. */}
              <IconeInterdite>
                {/* ⚠️ L'artwork du monstre n'est pas parfaitement centré dans
                    son canevas — invisible seul, ça se voit à côté du cercle
                    « interdit », lui parfaitement centré par positionnement
                    absolu. Léger recalage manuel, propre à cet usage précis. */}
                <GameIcon name="monster" size={13} className="-translate-x-[1.5px]" />
              </IconeInterdite>
              <span className="text-[12.5px] font-semibold text-ink-dim">Exclure les runes d'un monstre</span>
              <HelpPopover title="Exclure les runes d'un monstre">
                Choisis un monstre (box, RTA, défenses ou offenses de siège) pour retirer SES runes actuellement
                équipées de la recherche — utile pour un build que tu ne veux pas défaire, en plus de{' '}
                <b className="text-ink">« Exclure les runes déjà utilisées »</b>.
              </HelpPopover>
            </div>
            <RuneExclusionPicker
              data={exclusionData}
              excludeOwnUnitKey={selectedUnitKey}
              excludeOwnCom2usId={selected?.monster.com2usId ?? null}
              selected={excludedSelectors}
              onChange={setExcludedSelectors}
            />
          </div>
        );

        // ⚠️ **Runes imposées** — déplacé depuis « Critères de recherche »
        // (demande explicite) : verrouille un emplacement sur UNE rune
        // précise, ce slot n'a plus qu'un seul candidat, les cinq autres
        // restent optimisés normalement. Le cas d'usage réel est « je garde
        // CETTE rune, cherche les cinq autres autour » — d'où un choix
        // limité aux runes que le monstre PORTE DÉJÀ (celles de
        // « Monstre & équipement »), et non un second sélecteur parmi les
        // milliers de runes de l'inventaire : désigner une rune qu'on ne
        // porte pas n'a pas de sens pour ce geste-là.
        // ⚠️ Techniquement une RÉDUCTION DE POOL, pas une contrainte de plus
        // — voir `BuildRequirement.lockedRunes` (runeBuildOptim.ts) : le
        // moteur n'a rien appris de la notion de verrou, il travaille juste
        // sur un pool où ce slot ne contient plus qu'une rune. Regroupé
        // avec l'exclusion : même thème (agir sur le POOL de runes à partir
        // de l'exemplaire recherché), même carte.
        const runesImposeesBlock = (
          <div>
            <div className="mb-2.5 flex items-center gap-1.5">
              <p className="label">Runes imposées</p>
              <HelpPopover title="Runes imposées">
                Verrouille un emplacement sur la rune que le monstre porte déjà : la recherche gardera
                <b className="text-ink"> exactement cette rune</b> et n'optimisera que les autres. Utile pour
                conserver une rune que tu ne veux pas déruner. Les emplacements laissés libres sont optimisés
                normalement.
              </HelpPopover>
            </div>
            {!selected || selected.gear.runes.length === 0 ? (
              <p className="text-micro text-ink-dim">Aucune rune équipée sur cet exemplaire — rien à imposer.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((slot) => {
                  const portee = selected.gear.runes.find((r) => r.slot === slot);
                  const verrouille = lockedRunes[slot] != null;
                  if (!portee) {
                    return (
                      <span
                        key={slot}
                        className="rounded-full border border-border bg-panel2 px-2.5 py-1 text-micro text-ink-dimmer opacity-50"
                        title={`Aucune rune en emplacement ${slot}`}
                      >
                        Slot {slot} —
                      </span>
                    );
                  }
                  return (
                    <Pastille
                      key={slot}
                      actif={verrouille}
                      onClick={() =>
                        setLockedRunes((prev) => {
                          const next = { ...prev };
                          if (next[slot] != null) delete next[slot];
                          else next[slot] = portee.id;
                          return next;
                        })
                      }
                      icone={<RuneIcon setKey={portee.set} size={13} filter={runeSetIconFilter(verrouille)} />}
                      libelle={`Slot ${slot} · ${RUNE_EFFECT[portee.main.code]?.label ?? portee.main.code}`}
                      title={
                        verrouille
                          ? `Libérer l'emplacement ${slot}`
                          : `Imposer cette rune en emplacement ${slot} (le pool de ce slot tombe à 1)`
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        );

        // ⚠️ `dansPanneau` : dans le panneau, « Exclure les runes d'un
        // monstre » passe AU-DESSUS de « Exclure les runes déjà utilisées »
        // (demande explicite — c'est le réglage le plus utilisé au doigt),
        // et les deux restent EMPILÉS (jamais côte à côte, même sur un
        // panneau assez large pour `sm:` — la largeur calibrée de la
        // colonne de gauche, pensée pour la carte du bureau, ne vaudrait
        // plus rien ici). Au bureau, ordre et grille inchangés. « Runes
        // imposées », un mécanisme DISTINCT (verrou, pas exclusion), suit en
        // dernier après un séparateur, pleine largeur dans les deux cas.
        const exclusionRunesInner = (dansPanneau: boolean) => (
          <>
            <p className="mb-3 pl-8 text-[11px] text-ink-dim">Deux réglages indépendants, qui se superposent.</p>

            {dansPanneau ? (
              // ⚠️ `space-y-4` (blocs) et non `flex flex-col` : sous
              // `[data-tiroir]`, `align-items: flex-start` raboterait ces deux
              // blocs — et donc leurs contrôles pleine largeur — à leur contenu.
              <div className="space-y-4">
                {monstrePrecisBlock}
                {dejaUtiliseesBlock}
              </div>
            ) : (
              // Côte à côte à partir de `sm` — cette carte vit maintenant
              // dans la colonne LARGE (`1fr`) de la grille de réglages, aux
              // côtés de « Monstre & équipement » (voir le commentaire
              // d'ouverture de la grille), largement assez pour ce layout
              // interne. ⚠️ Un `xl:grid-cols-1` a existé ici le temps d'une
              // révision antérieure de la mise en page, où cette carte se
              // retrouvait confinée à une colonne étroite (340-400px) —
              // retiré avec cette colonne, voir historique. Colonne de
              // gauche plus étroite (toggle + 3 options) que celle de droite
              // (recherche + liste), pas un 50/50 aveugle.
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(200px,260px)_1fr] sm:gap-5">
                <div className="sm:border-r sm:border-border-soft sm:pr-5">{dejaUtiliseesBlock}</div>
                {monstrePrecisBlock}
              </div>
            )}

            <div className="mt-4 border-t border-border-soft pt-4">{runesImposeesBlock}</div>
          </>
        );

        const exclusionRunesTitre = (
          <>
            {/* Icône « Runes » de Mon compte (même GameIcon que le menu),
                barrée du vrai symbole « interdit » (cercle barré, comme le
                curseur non-cliquable) plutôt qu'un simple trait — l'exclusion
                RETIRE des runes de la recherche. */}
            <IconeInterdite taille={22}>
              <GameIcon name="rune" size={13} />
            </IconeInterdite>
            <p className="text-[13.5px] font-bold text-ink">Exclusion de runes</p>
          </>
        );

        return (
          <>
            {/* Bureau : « Réglages avancés », colonne 2, rangée 5 — SOUS
                « Exclusion de runes » (ordre inversé sur demande explicite,
                voir le commentaire d'Exclusion ci-dessous) — ⚠️ **`relative`**
                : ancre du `FlottantAuto` ci-dessous, qui se positionne en
                `absolute` par rapport à CETTE carte, pas à la page. La carte
                elle-même ne change JAMAIS de hauteur au dépliement — son
                contenu déplié flotte par-dessus, il ne s'ajoute plus au DOM
                en flux normal. */}
            <div
              ref={avancesRef}
              className="hidden lg:block relative rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-5"
            >
              <ZoneCliquable
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="flex w-full items-center gap-1.5 text-sm font-bold text-ink"
              >
                {reglagesAvancesTitre}
                <ChevronDown
                  size={14}
                  className={`ml-auto text-ink-dim transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </ZoneCliquable>
              {/* ⚠️ `largeurAncre` : le panneau prend EXACTEMENT la largeur de
                  la carte qui l'ancre, et la suit quand l'écran change de
                  taille. Les 340 px d'origine en faisaient à peu près la
                  moitié — une largeur en dur ne peut pas suivre une carte dont
                  la largeur dépend de la fenêtre.
                  ⚠️ `hauteur` reste une ESTIMATION, et volontairement
                  généreuse : elle ne sert qu'à choisir le côté AVANT que le
                  contenu existe. La surestimer biaise le placement vers le
                  haut, sans conséquence ; la sous-estimer ouvre du mauvais
                  côté. `max-h-[70vh] overflow-y-auto` reste le garde-fou sur
                  une fenêtre basse. */}
              <FlottantAuto ouvert={showAdvanced} ancre={avancesRef} largeurAncre hauteur={420} rembourrage="md">
                <div className="max-h-[70vh] overflow-y-auto">{reglagesAvancesInner(false)}</div>
              </FlottantAuto>
            </div>

            {/* Bureau : « Exclusion de runes », colonne 2, rangée 3 — SOUS
                « Objectif de recherche » (même colonne, rangée 2, voir son
                commentaire) — ordre inversé avec « Réglages avancés » sur
                demande explicite. Masquée au doigt (voir le panneau plus
                bas). */}
            {/* ⚠️ **Repliée par défaut** (demande explicite), et dépliée en
                FLOTTANT hors flux — jamais un bloc qui s'ajoute.
                C'est la contrainte de docs/03-developpeur/interface/ : la carte
                elle-même ne change JAMAIS de hauteur, donc « Réglages
                avancés » juste en dessous et la ligne d'estimation ne
                bougent pas d'un pixel quand on l'ouvre. Un dépliement en
                flux les aurait poussés au moment précis du clic.
                ⚠️ Patron RÉUTILISÉ tel quel de « Réglages avancés » (ancre
                `ref` + `ZoneCliquable` + `FlottantAuto` + fermeture au clic
                extérieur) plutôt que réécrit : deux mécanismes de dépliement
                voisins auraient divergé, et celui-là avait déjà été corrigé
                une fois pour cette même raison. */}
            <div
              ref={exclusionRef}
              className="hidden lg:block relative rounded-xl border border-accent/50 bg-panel p-3 xl:col-start-2 xl:row-start-4"
            >
              <ZoneCliquable
                onClick={() => setShowExclusion((v) => !v)}
                aria-expanded={showExclusion}
                className="flex w-full items-center gap-2 text-sm font-bold text-ink"
              >
                {exclusionRunesTitre}
                <ChevronDown
                  size={14}
                  className={`ml-auto text-ink-dim transition-transform ${showExclusion ? 'rotate-180' : ''}`}
                />
              </ZoneCliquable>
              {/* `largeurAncre` comme « Réglages avancés » — voir son
                  commentaire juste au-dessus.
                  ⚠️ `hauteur` plus généreuse (560) : ce contenu porte deux
                  réglages d'exclusion, le picker de monstre et la liste des
                  runes imposées. Estimation seulement. */}
              <FlottantAuto ouvert={showExclusion} ancre={exclusionRef} largeurAncre hauteur={560} rembourrage="md">
                <div className="max-h-[70vh] overflow-y-auto">{exclusionRunesInner(false)}</div>
              </FlottantAuto>
            </div>

            {/* ⚠️ Placée en rangée 6 (`xl:col-span-2`, pleine largeur) : ni
                dans la colonne Critères (rangées 2-5) ni dans la colonne
                Artéfacts/État/Exclusion/Avancés (rangées 2-5), cette ligne
                d'estimation n'a pas sa place dans une cellule précise —
                simple info sous tout le reste. Ne bouge plus JAMAIS au
                dépliement de Réglages avancés, désormais un flottant hors
                flux plutôt qu'un bloc qui poussait tout ce qui suivait. */}
            {estimate && (
              <p className="font-mono text-micro text-ink-dim xl:col-span-2 xl:row-start-6">
                {formatBig(estimate.perSlot.reduce((a, b) => a + b, 0))} runes gardées après pré-filtrage
                (pool par emplacement : {estimate.perSlot.join(' + ')})
              </p>
            )}

            {/* Doigt : panneau « Options de recherche », ordre Exclusion de
                runes → Réglages avancés, jamais replié (ouvrir le panneau EST
                déjà le geste « je veux voir les options »). Chaque groupe
                dans son propre cadre (`bg-panel2`) : deux unités visuelles
                distinctes, pas juste un trait de séparation entre deux blocs
                de texte. */}
            <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre="Options de recherche">
              {/* ⚠️ `space-y-3` et NON `flex flex-col` : le corps du panneau
                  porte `data-tiroir`, et index.css y pose
                  `[data-tiroir] .flex-col { align-items: flex-start }` — écrit
                  pour les rangées d'actions, mais qui rabote ici les deux cartes
                  à la largeur de leur contenu au lieu de les étirer. En blocs
                  (`space-y`), les cartes reprennent d'elles-mêmes toute la
                  largeur du panneau. Même piège que MobileNavSheet. */}
              <div className="space-y-3">
                <div className="rounded-lg border border-border-soft bg-panel2 p-3">
                  <div className="mb-0.5 flex items-center gap-2">{exclusionRunesTitre}</div>
                  {exclusionRunesInner(true)}
                </div>
                <div className="rounded-lg border border-border-soft bg-panel2 p-3">
                  <div className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-ink">
                    {reglagesAvancesTitre}
                  </div>
                  {reglagesAvancesInner(true)}
                </div>
              </div>
            </MobileSheet>
          </>
        );
      })()}
      </>
      {/* fin de la grille de réglages — tout ce qui suit reprend la pleine
          largeur : la barre d'actions, la progression et les résultats
          (une grille de cartes qui, elle, PROFITE de la largeur). */}
      </div>

      {/* ⚠️ Rendue HORS de la grille de réglages : un enfant direct de la
          grille compterait comme une cellule à part entière. Elle n'a de toute
          façon aucune place à prendre dans le flux — c'est tout son objet. */}
      {setupOuvert && (
        <DamageSetupModale
          onClose={() => setSetupOuvert(false)}
          echoEtatMonstre={echoEtatMonstre}
          skills={damageSkills}
          resolved={resolvedSkill}
          passifs={offensivePassives}
          modificateursVit={modificateursVit}
          setup={damageSetup}
          setSetup={setDamageSetup}
          chargement={skillLoading}
          etroit={etroit}
          critSiPlusRapide={critSiPlusRapide}
          bonusDegatsSelonVit={bonusDegatsSelonVit}
          bonusDegatsStack={bonusDegatsStack}
          critRateSelonVit={critRateSelonVit}
          bonusDegatsConditionnel={bonusDegatsConditionnel}
          bonusParEffetCibleMonstre={bonusParEffetCibleMonstre}
          bonusParEffetPropre={bonusParEffetPropre}
          bonusSacrifice={bonusSacrifice}
          conditionsCombatMonstre={conditionsCombatMonstre}
          combatStats={combatStats}
          seuilsPassifEivor={seuilsPassifEivor}
          elementAttaquant={speciesMonster?.element ?? null}
          critInterdit={critInterdit}
        />
      )}

      <div className="rounded-xl border border-border bg-panel p-3 shadow-lg">
        {/* ⚠️ **L'objectif vit avec le bouton qui lance la recherche**, plus
            dans une cellule de la grille de réglages. Il y était « une carte
            À PART » parce qu'il portait AUSSI la description du combat, qui
            réclamait de la place ; celle-ci partie en fenêtre, il ne reste
            qu'un segmenté à quatre crans — et *quoi* chercher se lit mieux
            juste au-dessus de *chercher* que parmi les critères.
            ⚠️ Titre en `label`, sans le carré d'icône accentué qu'il portait
            comme en-tête de carte : ce n'en est plus une, c'est une section
            dans celle des actions — même traitement que « Set de runes
            recherché » ou « Conditions ». */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <p className="label">Objectif de recherche</p>
            <HelpPopover title="Objectif de recherche">
              Élargit la sélection de runes candidates pour ses stats dès le pré-filtrage, avant même de
              lancer la recherche — les minimums posés plus haut (Conditions) restent ce qui décide quels
              demi-builds sont conservés pendant la recherche elle-même. <b className="text-ink">Dégâts réels</b>{' '}
              va plus loin que les autres : la vraie formule d&apos;un sort précis contre un adversaire
              configuré.
            </HelpPopover>
          </div>
          {/* ⚠️ Choisir « Dégâts réels » OUVRE la description du combat, il ne
              fait pas que la révéler. La carte apparaissait auparavant sous
              l'objectif, et rien n'obligeait à la regarder : on pouvait classer
              des milliers de builds sur un sort, une cible et un mode de
              critique jamais choisis. Le geste devient explicite — cet objectif
              ne se choisit plus sans voir ses hypothèses. */}
          <Segmented
            options={OBJECTIVE_LABELS}
            value={objective}
            onChange={(o) => {
              setObjective(o);
              if (o === 'degats_reels') setSetupOuvert(true);
            }}
            size="lg"
          />
          {/* Le résumé remplace la carte dans le flux ET sert de porte de
              réouverture : sans lui, une fenêtre fermée rendrait les
              hypothèses inatteignables autant qu'invisibles. */}
          {objective === 'degats_reels' && (
            <ZoneCliquable
              onClick={() => setSetupOuvert(true)}
              className="mt-2.5 flex w-full items-center gap-1.5 rounded-lg border border-border-soft bg-panel2 px-2 py-1.5 text-left"
              aria-label="Modifier la description du combat"
            >
              <Swords size={13} className="flex-none text-ink-dim" />
              <span className="text-micro leading-tight text-ink-dim">{resumeCombat}</span>
              <Pencil size={12} className="ml-auto flex-none text-ink-dim" />
            </ZoneCliquable>
          )}
        </div>

        {/* ⚠️ Rangée d'actions inchangée — mêmes classes qu'avant que
            l'objectif ne la rejoigne : elle était la carte entière, elle en
            devient la seconde moitié. Une rangée à part, et non un `flex-wrap`
            commun avec l'objectif : le segmenté et les boutons se seraient
            réarrangés l'un autour de l'autre au gré de la largeur. */}
        <div className="flex flex-wrap items-center gap-3">
        {/* ⚠️ `comboSets.length === 0` reste HORS de `disabled` — un bouton
            HTML natif `disabled` ne déclenche JAMAIS `onClick` (règle du
            DOM, pas un oubli), ce qui aurait rendu le défilement vers « Set
            de runes recherché » plus haut inatteignable : plus aucun clic
            ne pouvait jamais arriver jusqu'à `handleSearch`. Grisé
            visuellement à la place (mêmes classes que `disabled:*`,
            appliquées manuellement) tout en restant cliquable, pour que le
            clic sur un set manquant décale toujours vers la section fautive
            plutôt que de ne rien faire silencieusement. */}
        <Bouton
          ton="accent"
          onClick={handleSearch}
          disabled={!selected || status === 'running'}
          title={selected && status !== 'running' && comboSets.length === 0 ? 'Choisis d\'abord un set de runes recherché' : undefined}
          icone={<Search size={15} />}
          libelle={status === 'running' ? 'Recherche…' : 'Rechercher'}
          className={comboSets.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}
        />

        {/* Exporte les réglages de CETTE recherche (set, minimums, objectif…),
            jamais le pool de runes ni le compte — pour reproduire fidèlement
            un cas signalé, partager une recherche entre joueurs (chacun
            l'applique à son propre inventaire), ou la réutiliser depuis un
            script. Voir src/lib/optimizerRecipe.ts. */}
        <Bouton
          onClick={exportRecipe}
          disabled={!selected || comboSets.length === 0}
          title="Télécharger les réglages de cette recherche en fichier .json (set, minimums, objectif…) — pour la partager ou la reproduire, jamais tes runes ni ton compte."
          icone={<Upload size={14} />}
          libelle="Exporter les paramètres de recherche"
          libelleCourt="Exporter"
        />

        {/* Reprend une recette importée (fichier reçu d'un autre joueur, ou
            gardée de côté) — remplit les réglages et sélectionne le monstre
            si son com2usId existe dans CETTE box. Aucune confirmation :
            remplacer les réglages en cours n'est pas plus destructeur que
            les modifier à la main un par un. */}
        <Bouton
          onClick={() => importFileRef.current?.click()}
          title="Reprendre les réglages d'un fichier .json exporté depuis l'Optimizer (le tien ou celui d'un autre joueur)."
          icone={<Download size={14} />}
          libelle="Importer les paramètres de recherche"
          libelleCourt="Importer"
        />
        <input
          ref={importFileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // permet de réimporter le même fichier
            if (f) importRecipe(f);
          }}
        />

        {status === 'running' && (
          <Bouton
            ton="danger"
            fond="vide"
            onClick={() => {
              setStoppedManually(true);
              stop();
            }}
            title="Arrêter la recherche et garder ce qui a déjà été trouvé"
            icone={<Square size={13} />}
            libelle="Arrêter"
          />
        )}
        </div>
      </div>

      {importMsg && (
        <p className={`text-[12.5px] ${classeMessageImport(importMsg)}`} role="status">
          {importMsg.text}
        </p>
      )}

      {/* ⚠️ Deux phases distinctes affichées différemment, pas une seule
          barre continue : `building` (construction des compartiments, avant
          même de savoir combien de paires il y aura à explorer) et `pairing`
          (l'ancienne barre, inchangée) ne partagent pas la même notion de
          progression — les mélanger sous un seul repère aurait été plus
          trompeur qu'utile (la barre aurait pu reculer en changeant de
          phase). Avant ce correctif, `progress` restait `null` pendant toute
          la phase `building` (jusqu'à ~1 minute sur un compte réel à
          beaucoup de conditions) : la barre affichait 0 % sans bouger et le
          texte « 0 combinaisons examinées », sans dire qu'un TRAVAIL était
          en cours — voir docs/02-app/optimizer/,
          « Barre de progression ». */}
      {/* ⚠️ Deux barres empilées, une par moitié, pas une seule — depuis leur
          construction EN PARALLÈLE (deux Workers, voir
          runeBuildOptim.worker.ts), A et B avancent en même temps ; une seule
          barre ne pourrait montrer que la dernière moitié à avoir posté un
          message, faisant croire à tort que l'autre est à l'arrêt. */}
      {status === 'running' && progress?.phase === 'building' && (
        <div className="space-y-2">
          {(['A', 'B'] as const).map((half) => {
            const h = progress.halves[half];
            return (
              <div key={half}>
                <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
                  <div
                    className="h-full bg-accent/60 transition-[width] duration-150 ease-out"
                    style={{ width: `${Math.round((h?.pct ?? 0) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-micro text-ink-dim">
                  Préparation — moitié {half} :{' '}
                  {h ? `${h.scanned.toLocaleString('fr-FR')} / ${h.total.toLocaleString('fr-FR')} runes` : 'en attente…'}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {status === 'running' && (progress === null || progress.phase === 'pairing') && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-panel2">
            <div
              className="h-full bg-accent transition-[width] duration-150 ease-out"
              style={{ width: `${Math.round((progress?.pct ?? 0) * 100)}%` }}
            />
          </div>
          {/* ⚠️ Le dénominateur ici est `totalPairs` (voir `totalPairCount`),
              la taille EXACTE de l'espace à épuiser — un plafond de nœuds a
              longtemps coexisté avec lui, écarté d'ici parce qu'il
              grandissait en cours de route et aurait fait RECULER la barre.
              C'est ce choix de l'interface qui a fini par emporter sa
              suppression du moteur. */}
          <p className="mt-1 font-mono text-micro text-ink-dim">
            {progress === null
              ? 'Préparation…'
              : `${progress.explored.toLocaleString('fr-FR')} / ${progress.totalPairs.toLocaleString('fr-FR')} combinaisons examinées · ${compteAffiche.compte.toLocaleString('fr-FR')} trouvée(s)`}
          </p>
          {progress !== null && (
            <p className="mt-0.5 font-mono text-[11px] font-bold text-star">
              Attendez la fin de la recherche pour être sûr de trouver votre build optimal.
            </p>
          )}
          {progress !== null && (
            <p className="mt-0.5 font-mono text-[11px] text-ink-dimmer">
              Le budget de recherche s'élargit automatiquement tant qu'il reste du temps et que le plafond de
              résultats (100 000) n'est pas atteint — pas seulement tant que rien n'est trouvé.
            </p>
          )}
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-bad">La recherche a échoué. Réessaie avec des critères moins stricts.</p>
      )}

      {/* ⚠️ Refus NOMMÉ : `search.status ===
          'refused'` et `search.refusal.vide` sont la SEULE source de ce
          texte — un par raison, jamais un pool recalculé pour deviner
          pourquoi. `'refused'` se traite ici comme `'error'` l'est
          juste au-dessus, à la place du lancement. */}
      {status === 'refused' && refusal && (
        <p className="text-xs text-bad">
          {refusal.vide === 'seuil'
            ? 'Aucune relique éligible : abaisse le niveau minimum.'
            : refusal.vide === 'principale'
              ? 'Aucune relique de cette principale dans ton inventaire.'
              : refusal.vide === 'type'
                ? 'Aucune relique de cette propriété unique dans ton inventaire.'
                : refusal.vide === 'inventaire'
                  ? "Aucune relique dans le compte importé : réimporte le compte, ou coupe l'optimisation d'artéfacts et reliques."
                  : 'Ce monstre ne porte pas de relique.'}
        </p>
      )}

      {/* ⚠️ S'affiche AUSSI pendant la phase d'appariement, dès qu'au moins
          un candidat est trouvé (`sortedCandidates` vient alors de l'aperçu
          EN DIRECT de `progress`, pas de `result` — voir `candidatesSource`
          ci-dessus) : voir des builds apparaître au fur et à mesure plutôt
          que d'attendre l'épuisement complet de l'espace de recherche.
          `result === null` tant que rien n'est trouvé : rien à montrer de
          plus utile que les barres de progression déjà affichées. */}
      {(result || fullSortedCandidates.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            {/* ⚠️ Le compte des CONFIRMÉES (`compteConfirmes`) :
                seulement les builds vérifiés (résolus et conformes), un
                compte qui ne baisse jamais pendant une recherche. « Aucune
                combinaison… » seulement quand tout est vérifié sans aucune
                confirmée. La ligne de progression garde les trouvées :
                l'infobulle dit la différence. */}
            <div className="flex items-center gap-1.5">
              <p className="label">
                {result
                  ? compteConfirmes.aucune
                    ? 'Aucune combinaison ne répond à ces critères'
                    : `${compteConfirmes.confirmees.toLocaleString('fr-FR')} combinaison(s) confirmée(s)`
                  : `${compteConfirmes.confirmees.toLocaleString('fr-FR')} combinaison(s) confirmée(s) pour l'instant — recherche en cours…`}
              </p>
              {/* Seulement quand une file vérifie : sans elle, confirmées et
                  trouvées sont le même nombre. */}
              {resoudreEquipement != null && !compteConfirmes.aucune && (
                <HelpPopover title="Combinaisons confirmées">
                  Une combinaison est <b className="text-ink">confirmée</b> quand ses artéfacts et sa relique ont
                  été vérifiés avec les pièces de ton inventaire : elle tient vraiment toutes les conditions.
                  <br />
                  <br />
                  Le nombre « trouvée(s) » de la barre de progression compte tout ce que la recherche a retenu stat
                  par stat : une estimation optimiste, pas encore vérifiée. Une partie de ces combinaisons est
                  écartée à la vérification.
                  <br />
                  <br />
                  La vérification s'arrête à 100 confirmées (300 quand la relique est cherchée) ; « Vérifier toutes
                  les combinaisons trouvées », dans les réglages avancés, va jusqu'au bout.
                </HelpPopover>
              )}
            </div>
            {/* ⚠️ **Le tri est une VUE, l’optimisation d’artéfacts une
                DÉCISION.** Les coupler d’office déplaçait la paire dès qu’on
                changeait de tri pour explorer — alors qu’on veut souvent
                garder celle qui maximise les PV effectifs tout en regardant
                les builds classés par une stat.

                ⚠️ MASQUÉ quand l’optimisation est désactivée : il n’y a alors
                qu’une paire possible, celle qui est portée. Une saisie sans
                effet est pire qu’une saisie absente — même règle que les
                sélecteurs de principale et les sous-propriétés verrouillées. */}
            {optimiserArtefacts && !compteConfirmes.aucune && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs font-semibold text-ink-dim">Adapter les artéfacts et reliques au tri</span>
                <HelpPopover title="Adapter les artéfacts et reliques au tri">
                  Activé (défaut), chaque build reçoit les artéfacts ET la relique qui maximisent le{' '}
                  <b className="text-ink">critère de tri</b> affiché : trier par ATQ ne retient pas les mêmes
                  pièces que trier par PV effectifs.
                  <br />
                  <br />
                  Désactivé, les artéfacts et la relique restent ceux qui servent l’<b className="text-ink">objectif de la
                  recherche</b>, quel que soit le tri. Utile pour parcourir les résultats classés autrement sans
                  que l’équipement bouge — et « Valider les artéfacts » propose alors toujours le même.
                  <br />
                  <br />
                  Sans effet sur Efficience, Vitesse, Taux CRIT, Dgts CRIT, Résistance et Précision : aucun
                  artéfact ni aucune propriété de relique n’entre dans ces classements.
                </HelpPopover>
                <Interrupteur
                  actif={adapterArtefactsAuTri}
                  onChange={setAdapterArtefactsAuTri}
                  aria-label="Adapter les artéfacts et reliques au tri"
                />
              </div>
            )}
            {/* Masqués (avec « Adapter… ») seulement quand tout est vérifié
                sans aucune confirmée. */}
            {!compteConfirmes.aucune && (
              <Selecteur
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as OptimizerSortKey);
                  // Classement entièrement différent : la page courante
                  // n'a plus le même sens, on repart du meilleur résultat.
                  setResultsPage(1);
                }}
                taille="sm"
                surface="panel"
                pleineLargeur={false}
              >
                <optgroup label="Stats">
                  {RECO_STATS.map((st) => (
                    <option key={st.key} value={st.key}>
                      Trier par {st.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Objectifs">
                  {/* ⚠️ « Dégâts réels » n'est proposé que si un sort est
                      réellement calculable pour ce monstre : sans sort, ce
                      tri n'aurait aucune formule à appliquer et laisserait la
                      liste dans son ordre précédent, sans rien dire. */}
                  {OBJECTIVE_LABELS.filter((o) => o.key !== 'degats_reels' || realDamage).map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </Selecteur>
            )}
          </div>

          {/* Combien la file doit encore vérifier : les builds des
              places en attente de la page, puis l'avance de fond vers K
              confirmées — le compte
              ci-dessus les inclut, la page ne les
              montre qu'une fois vérifiés. `enAttente` est le reste de la file,
              tenu par le hook pour l'affichage. ⚠️ Rangée TOUJOURS présente
              quand la file tourne : quand elle se vide, l'espace insécable
              garde sa hauteur, et la grille ne remonte pas. */}
          {resoudreEquipement != null && (
            <p className="mb-2 text-xs text-ink-dim">
              {fileArtefacts.enAttente > 0
                ? `${fileArtefacts.enAttente.toLocaleString('fr-FR')} combinaison(s) en vérification…`
                : ' '}
            </p>
          )}

          {/* ⚠️ Zéro dû aux seuls builds écartés par la résolution :
              le moteur a trouvé, aucun couple réel ne tient. Sous « Aucune combinaison… » seulement — tout vérifié, aucune
              confirmée —, la ligne qu'elle explique. Les blocs ci-dessous
              (diagnostic, « suffirait ») gardent leur condition, moteur vide :
              leurs chiffres viennent des bornes du moteur. */}
          {compteConfirmes.aucune && compteAffiche.raison && (
            <p className="mb-3 text-xs text-ink-dim">{compteAffiche.raison}</p>
          )}

          {/* ⚠️ Diagnostic affiché UNIQUEMENT sur 0 résultat — voir
              `diagnoseFeasibility` dans runeBuildOptim.ts pour ce qu'il
              prouve exactement. Deux cas : au moins une condition
              PROUVÉE hors de portée (rouge, liste précise) ; ou aucune ne
              l'est individuellement (message neutre — le blocage vient de
              leur combinaison ou de la recherche elle-même, pas d'une seule
              stat identifiable). */}
          {result?.candidates.length === 0 && feasibilityDiagnosis.length > 0 && (
            <div className="mb-3 rounded-lg border border-border bg-panel p-3">
              {impossibleFeasibility.length > 0 ? (
                <>
                  <p className="mb-1.5 text-xs font-semibold text-bad">
                    {impossibleFeasibility.length === 1
                      ? 'Une condition est'
                      : `${impossibleFeasibility.length} conditions sont`}{' '}
                    mathématiquement hors de portée, quel que soit le runage choisi :
                  </p>
                  <ul className="space-y-1">
                    {impossibleFeasibility.map((f) => {
                      const st = RECO_STATS.find((s) => s.key === f.key)!;
                      return (
                        <li key={`${f.key}-${f.kind}`} className="text-xs text-ink-dim">
                          <span className="font-semibold text-ink">{st.label}</span>{' '}
                          {f.kind === 'min'
                            ? `minimum demandé ${f.requested}${st.suffix} — maximum atteignable ${f.bound}${st.suffix} avec ce pool, ce set et ces statistiques principales.`
                            : `maximum demandé ${f.requested}${st.suffix} — ${f.bound}${st.suffix} déjà garanti sans la moindre rune (base, artéfacts, bonus de set).`}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-ink-dim">
                  Aucune condition n'est, à elle seule, mathématiquement hors de portée — le blocage
                  vient probablement de leur <b className="text-ink">combinaison</b> (rare qu'un seul
                  build satisfasse tout à la fois), ou du pré-filtrage de la recherche elle-même. Essaie
                  de desserrer une condition, ou un pré-filtrage plus large (Réglages avancés).
                </p>
              )}
            </div>
          )}

          {/* ⚠️ Palier 2 — voir `rankBlockingConditions` dans
              runeBuildOptim.ts : un INDICE (pas une preuve, contrairement au
              palier 1 ci-dessus), désactivé par défaut (coûte plus cher).
              Deux affichages selon l'état de la bascule : le classement s'il
              est activé, une invitation discrète sinon. */}
          {result?.candidates.length === 0 &&
            (blockingDiagnosis && blockingDiagnosis.impacts.length > 0 ? (
              <div className="mb-3 rounded-lg border border-border bg-panel p-3">
                <p className="mb-1.5 text-xs font-semibold text-ink">
                  Diagnostic approfondi — pool le plus restreint : {blockingDiagnosis.baselineMinSlot} candidat(s)
                  actuellement.
                </p>
                <ul className="space-y-1">
                  {blockingDiagnosis.impacts.map((imp) => {
                    const st = RECO_STATS.find((s) => s.key === imp.key)!;
                    return (
                      <li key={`${imp.key}-${imp.kind}`} className="text-xs text-ink-dim">
                        {imp.delta == null ? (
                          <>
                            <span className="font-semibold text-ink">{st.label}</span> ({imp.kind === 'min' ? '≥' : '≤'}{' '}
                            {imp.requested}
                            {st.suffix}) : aucun gain, même desserrée entièrement.
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-ink">{st.label}</span>{' '}
                            {imp.kind === 'min' ? `−${imp.delta}` : `+${imp.delta}`}
                            {st.suffix} suffit ({imp.kind === 'min' ? '≥' : '≤'} {imp.threshold}
                            {st.suffix}) : {imp.poolMinSlotAtThreshold} candidat(s).
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1.5 text-micro text-ink-dim">
                  Un indice, pas une preuve — basé sur le pré-filtrage sûr, pas sur une recherche complète.
                </p>
              </div>
            ) : (
              !diagnoseBlockingEnabled && (
                <p className="mb-3 text-[11px] text-ink-dim">
                  Astuce : active le diagnostic approfondi (Réglages avancés) pour identifier quelle
                  condition libère le plus de candidats.
                </p>
              )
            ))}

          {/* ⚠️ Quasi-succès à l'appariement — sous-produit GRATUIT de la
              vraie recherche (`pairBuckets`, jamais recalculé), affiché
              SYSTÉMATIQUEMENT (contrairement au palier 2 ci-dessus, dont le
              coût réel justifie un réglage) : voir docs/03-developpeur/optimizer/,
              « Quasi-succès à l'appariement ». Ne voit que ce que la recherche a
              RÉELLEMENT exploré avant troncature — une paire encore plus
              proche, jamais atteinte, resterait invisible. */}
          {result?.candidates.length === 0 && (result.globalNearMiss || result.nearMissByCondition.length > 0) && (() => {
            // ⚠️ Même vocabulaire que le palier 2 ci-dessus (« −15 suffit ») :
            // un seul réflexe de lecture
            // pour tout l'écran diagnostic, plutôt que deux formulations
            // (« manque »/« suffit ») pour la même idée de desserrage.
            // ⚠️ Le score affiché doit être celui que l'utilisateur reconnaît
            // des cartes de résultat (`BuildCandidateCard.tsx`) : la moyenne
            // PAR RUNE (pas la somme brute), formatée par `formatRuneMetric`
            // (« 140.2% », jamais un nombre nu) ; « PV effectifs » en plus
            // quand c'est l'objectif choisi — sinon un nombre sans légende
            // reconnaissable ressemble à une erreur, pas à un score (« 1309.0 »
            // affiché pour une recherche PV effectifs n'aurait aucun rapport
            // avec ce qui est cherché).
            const nearMissScoreText = (miss: NearMiss): string => {
              const moyenne = candidateMetricTotal(miss, runeById, metric) / 6;
              const base = `${metric === 'eff' ? 'Efficience moyenne' : 'Score moyen'} ${formatRuneMetric(moyenne, metric)}`;
              if (objective !== 'ehp') return base;
              return `${base}, PV effectifs ${Math.round(pvEffectifs(miss.stats, aurasPropresDe(miss), damageSetup)).toLocaleString('fr-FR')}`;
            };
            const suffiraitText = (s: StatShortfall) => {
              const st = RECO_STATS.find((r) => r.key === s.key)!;
              const nouveauSeuil = s.kind === 'min' ? s.requested - s.shortfall : s.requested + s.shortfall;
              return (
                <span key={`${s.key}-${s.kind}`}>
                  <span className="font-semibold text-ink">{st.label}</span> {s.kind === 'min' ? '−' : '+'}
                  {s.shortfall}
                  {st.suffix} suffirait ({s.kind === 'min' ? '≥' : '≤'} {nouveauSeuil}
                  {st.suffix})
                </span>
              );
            };
            return (
              <div className="mb-3 rounded-lg border border-border bg-panel p-3">
                <p className="mb-1.5 text-xs font-semibold text-ink">Quoi ajuster pour trouver des builds</p>
                {result.globalNearMiss && (
                  <p className="mb-1.5 text-xs text-ink-dim">
                    Build le plus proche, toutes conditions confondues :{' '}
                    {result.globalNearMiss.shortfalls.map((s, i) => (
                      <span key={`${s.key}-${s.kind}`}>
                        {i > 0 ? ', ' : ''}
                        {suffiraitText(s)}
                      </span>
                    ))}{' '}
                    — {nearMissScoreText(result.globalNearMiss)}.
                  </p>
                )}
                {result.nearMissByCondition.length > 0 && (
                  <>
                    <p className="mb-1 text-xs text-ink-dim">
                      Par condition (satisfait tout le reste, ne manque que celle-ci) :
                    </p>
                    <ul className="space-y-1">
                      {result.nearMissByCondition.map(({ key, kind, miss }: { key: StatKey; kind: 'min' | 'max'; miss: NearMiss }) => (
                        <li key={`${key}-${kind}`} className="text-xs text-ink-dim">
                          {suffiraitText(miss.shortfalls[0])} — {nearMissScoreText(miss)}.
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-1.5 text-micro text-ink-dim">
                  Ne voit que ce que la recherche a réellement exploré avant troncature — une paire encore
                  plus proche, jamais atteinte, resterait invisible.
                </p>
              </div>
            );
          })()}

          {result?.truncated && (
            <p className="mb-2 text-micro text-warn">
              {stoppedManually
                ? `Recherche arrêtée après examen de ${result.explored.toLocaleString('fr-FR')} combinaisons — voici le meilleur trouvé jusque-là.`
                : `Recherche interrompue après examen de ${result.explored.toLocaleString('fr-FR')} combinaisons — resserre tes critères pour un résultat exhaustif.`}
            </p>
          )}

          {/* ⚠️ minmax calibré à 360px pour que DEUX cartes tiennent par
              ligne dans le conteneur `max-w-3xl` (768px, voir plus haut) :
              2×360 + le gap (12px) = 732px, sous les 768px disponibles. Les
              cartes affichent stats + artéfacts + roue sur une seule LIGNE
              (voir BuildCandidateCard.tsx), calibrées pour tenir dans cette
              largeur (`WHEEL_SCALE`/`ARTIFACT_SCALE` = 0,45). */}
          {/* ⚠️ Les cartes VÉRIFIÉES, puis les places « Vérification… »
              (`composition`) : aucune carte non vérifiée, pendant la
              recherche comme après. Une place a la hauteur d'une carte
              (`useHauteurDesCartes`), pour que rien ne saute quand la carte
              arrive. */}
          <div ref={grilleResultatsRef} className="grid grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-3">
            {composition.cartes.map((c, i) => (
              <BuildCandidateCard
                key={c.runeIds.join('-')}
                rank={composition.premierRang + i}
                candidate={c}
                runeById={runeById}
                // ⚠️ La paire de CE build, jamais une paire commune : deux
                // builds voisins n'appellent pas les mêmes artéfacts, et ce
                // sont ces pièces-là qui ont servi à calculer ses stats.
                // Le repli sur la paire SUPPOSÉE ne sert que sans file
                // (optimisation coupée : la paire portée, la seule possible) —
                // avec file, une carte affichée est résolue.
                artifacts={fileArtefacts.parBuild.get(cleBuild(c))?.artefacts ?? searchArtifacts}
                // ⚠️ **Seule source** :
                // `etatReliqueDuBuild` lit le cache de la file, jamais
                // recalculé ici — `fixe` (hors mode `recherche`) n'affiche
                // rien de nouveau, `rejete` n'arrive jamais jusqu'ici (le
                // classement écarte déjà ces builds). Par
                // `etatReliqueDe` : la relique que le score compte.
                etatRelique={etatReliqueDe(c)}
                relicUsageById={relicUsageById}
                // Plus de mention « artéfacts pas encore optimisés » : avec
                // file, une carte n'apparaît qu'une fois résolue ; sans file,
                // rien n'est à attendre.
                metric={metric}
                openDetailKey={openDetailKey}
                onToggleDetail={(key: string) => setOpenDetailKey((cur) => (cur === key ? null : key))}
                {...(() => {
                  // ⚠️ Comparaison contre les stats de la FICHE — donc contre
                  // le build validé quand il en existe un, sans avoir à le
                  // redemander ici (voir `statsReference`).
                  const cle = c.runeIds.join('-');
                  const compare = compareKey === cle && statsReference != null;
                  return {
                    onCompare: statsReference ? () => setCompareKey((k) => (k === cle ? null : cle)) : undefined,
                    // ⚠️ Affichée dès que les PV effectifs sont le critère de
                    // CLASSEMENT — objectif OU tri —, exactement comme les
                    // dégâts réels : on peut avoir cherché sur un objectif puis
                    // re-trié par PV effectifs, auquel cas le chiffre qui
                    // ordonne les cartes doit être visible dessus.
                    // ⚠️ `scoreDuCandidat` avec les options du classement
                    // affiché : le chiffre qui a CLASSÉ la carte, Ténacité et
                    // points de la relique retenue compris.
                    pvEffectifs:
                      objective === 'ehp' || sortBy === 'ehp'
                        ? (() => {
                            const total = scoreDuCandidat(c, 'ehp', optionsDuTriAffiche)!;
                            return { total, delta: compare && refEhp != null ? total - refEhp : undefined };
                          })()
                        : undefined,
                    metricDelta:
                      compare && refMetric != null
                        ? candidateMetricTotal(c, runeById, metric) - refMetric
                        : undefined,
                    // ⚠️ Le delta est calculé PAR STAT contre la référence, et
                    // seulement pour la carte comparée : le faire pour les 20
                    // cartes de la page coûterait 20 fois plus pour 19 valeurs
                    // qu'on n'affiche pas.
                    comparaison:
                      compareKey === cle && statsReference
                        ? c.stats.map((ligne) => ({
                            key: ligne.key,
                            label: ligne.label,
                            suffix: ligne.suffix,
                            delta: ligne.total - (statsReference.find((r) => r.key === ligne.key)?.total ?? 0),
                          }))
                        : undefined,
                  };
                })()}
                // ⚠️ Affiché dès qu'un sort est résolu ET que c'est bien le
                // critère de classement courant (objectif OU tri) — pas
                // seulement quand `objective` vaut « Dégâts réels » : on peut
                // avoir lancé la recherche sur un autre objectif puis re-trier
                // par dégâts réels, auquel cas le chiffre qui ordonne les
                // cartes doit être visible dessus.
                degatsReels={
                  realDamage && (objective === 'degats_reels' || sortBy === 'degats_reels')
                    ? (() => {
                        // ⚠️ Le chiffre qui a CLASSÉ la carte : `scoreDuCandidat`
                        // avec les options du classement affiché — profil
                        // d'artéfacts de CE build et Conquête de sa relique
                        // retenue compris. Une recopie de `computeTotalDamage`
                        // omettait la Conquête que le tri compte.
                        const total = scoreDuCandidat(c, 'degats_reels', optionsDuTriAffiche)!;
                        return {
                          total,
                          partPvCible: damageSetup.enemyHp > 0 ? (total / damageSetup.enemyHp) * 100 : 0,
                          // ⚠️ L'écart se calcule contre les dégâts de la
                          // RÉFÉRENCE (`refDegats`) : la fiche notée avec SES
                          // stats, SA paire d'artéfacts et SA relique — jamais
                          // contre le total d'un autre candidat, jamais avec
                          // la paire de la recherche.
                          delta:
                            compareKey === c.runeIds.join('-') && refDegats != null
                              ? total - refDegats
                              : undefined,
                        };
                      })()
                    : undefined
                }
                // « Valider » — réserve les 6 runes RÉELLES de CE
                // candidat pour `sourceSelector`, qu'il pointe un exemplaire
                // réel OU un sélecteur `unowned` (monstre non possédé,
                // demande explicite — « essayer des runages de teams sans
                // avoir mis à jour son json » : les runes trouvées restent de
                // VRAIES runes du compte, réservables comme n'importe quel
                // autre build validé). Absent uniquement si `sourceSelector`
                // est `null` (aucune espèce choisie, ou possédée ailleurs
                // sans exemplaire encore désambiguïsé — zone D).
                // ⚠️ Exige `sourceSelector` non nul ET une liste active (Lot
                // 3 — un build validé appartient TOUJOURS à une liste, voir
                // ValidatedBuild). Valider ajoute aussi implicitement le
                // monstre à la liste s'il n'y était pas déjà (voir
                // `validateBuild`, useOptimizerLists.ts).
                onValidate={
                  sourceSelector && lists.activeListId
                    ? () => {
                        // ⚠️ Garde de DERNIÈRE minute en plus du bouton
                        // désactivé : le clic peut partir d'un rendu périmé.
                        if (conflitsDeRunes(c.runeIds).length > 0) return;
                        // ⚠️ La paire DE CE CANDIDAT, pas celle du monstre
                        // affiché : c’est elle que la carte montre et qui a
                        // servi à calculer ses stats.
                        lists.validateBuild(
                          lists.activeListId!,
                          sourceSelector,
                          c.runeIds,
                          (fileArtefacts.parBuild.get(cleBuild(c))?.artefacts ?? searchArtifacts).map((a) => a.id),
                          selected!.monster.com2usId!
                        );
                        optimizer.capturerMembre(lists.activeListId!, sourceSelector);
                      }
                    : undefined
                }
                // ⚠️ La paire QUE CETTE CARTE MONTRE — celle de la file si
                // elle l'a trouvée, la représentative sinon. Exactement la
                // même expression que `onValidate` ci-dessus : comparer autre
                // chose que ce qu'on validerait rendrait le libellé menteur.
                validated={etatValidation(
                  c.runeIds,
                  (fileArtefacts.parBuild.get(cleBuild(c))?.artefacts ?? searchArtifacts).map((a) => a.id)
                )}
                conflit={(() => {
                  const conflits = conflitsDeRunes(c.runeIds);
                  if (conflits.length === 0) return null;
                  const noms = [...new Set(conflits.map((x) => x.monsterName))];
                  return `${conflits.length > 1 ? 'Runes déjà réservées' : 'Rune déjà réservée'} dans cette liste pour ${noms.join(', ')}`;
                })()}
              />
            ))}
            {Array.from({ length: composition.placesEnAttente }, (_, j) => (
              <PlaceEnVerification
                key={`verification-${composition.premierRang + composition.cartes.length + j}`}
                rank={composition.premierRang + composition.cartes.length + j}
                hauteur={hauteurCarte}
              />
            ))}
          </div>

          {/* Pagination — remplace l'ancienne troncature dure à 20 : la
              liste complète (jusqu'à MAX_COLLECTED, voir runeBuildOptim.ts)
              reste consultable, 20 par page. Flèches précédent/suivant +
              saisie directe du numéro de page (même convention que les
              champs numériques de l'app : `type="text"` + `inputMode=
              "numeric"`, jamais de flèches natives de navigateur — voir
              NumberField.tsx). */}
          {totalResultsPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <BoutonIcone
                cadre
                libelle="Page précédente"
                icone={<ChevronLeft size={16} />}
                onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                disabled={resultsPage <= 1}
                className="h-8 w-8"
              />

              <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-ink-dim">
                <span>Page</span>
                <Champ
                  inputMode="numeric"
                  value={pageDraft ?? String(resultsPage)}
                  aria-label="Aller à la page"
                  pleineLargeur={false}
                  onChange={(e) => {
                    const brut = e.target.value.trim();
                    // ⚠️ La chaîne VIDE est un état de brouillon valide (tout
                    // sélectionner puis taper) — contrairement à l'ancienne
                    // version, ne JAMAIS `return` sans mettre à jour l'état
                    // ici, sinon le champ contrôlé revient aussitôt à
                    // l'ancienne valeur et le chiffre ne peut plus disparaître.
                    if (brut !== '' && !/^\d+$/.test(brut)) return; // frappe invalide ignorée
                    setPageDraft(brut);
                  }}
                  onBlur={() => {
                    if (pageDraft !== null && pageDraft !== '') {
                      setResultsPage(Math.min(Math.max(Number(pageDraft), 1), totalResultsPages));
                    }
                    setPageDraft(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-11 px-1 py-1 text-center"
                />
                <span>/ {totalResultsPages}</span>
              </div>

              <BoutonIcone
                cadre
                libelle="Page suivante"
                icone={<ChevronRight size={16} />}
                onClick={() => setResultsPage((p) => Math.min(totalResultsPages, p + 1))}
                disabled={resultsPage >= totalResultsPages}
                className="h-8 w-8"
              />
            </div>
          )}
        </div>
      )}

      {/* Confirmations de libération — demande explicite de l'utilisateur.
          `Modale` est portalisée : sa position dans l'arbre n'a pas
          d'importance pour son rendu. */}
      {releaseConfirm && (
        <ConfirmDialog
          titre="Libérer ce build validé ?"
          message="Ces 6 runes ET la paire d’artéfacts redeviendront disponibles pour les autres monstres de cette liste."
          libelleAction="Libérer"
          onConfirm={() => {
            lists.releaseBuild(releaseConfirm.listId, releaseConfirm.selector);
            setReleaseConfirm(null);
          }}
          onCancel={() => setReleaseConfirm(null)}
        />
      )}
      {releaseArtifactsConfirm && (
        <ConfirmDialog
          titre="Libérer les artéfacts validés ?"
          message="Cette paire redeviendra disponible pour les autres monstres de cette liste. Les 6 runes du build restent réservées."
          libelleAction="Libérer"
          onConfirm={() => {
            lists.releaseArtifacts(releaseArtifactsConfirm.listId, releaseArtifactsConfirm.selector);
            setReleaseArtifactsConfirm(null);
          }}
          onCancel={() => setReleaseArtifactsConfirm(null)}
        />
      )}
      {releaseAllConfirm && (
        <ConfirmDialog
          titre="Libérer toutes les runes validées de cette liste ?"
          message="Tous les builds validés de cette liste seront libérés d'un coup — leurs runes redeviennent disponibles."
          libelleAction="Tout libérer"
          destructif
          onConfirm={() => {
            lists.releaseAllInList(releaseAllConfirm);
            setReleaseAllConfirm(null);
          }}
          onCancel={() => setReleaseAllConfirm(null)}
        />
      )}
      {removeMemberConfirm && (
        <ConfirmDialog
          titre="Retirer ce monstre de la liste ?"
          message="Ses runes validées seront aussi libérées — elles redeviennent disponibles pour les recherches des autres monstres de cette liste."
          libelleAction="Retirer"
          destructif
          onConfirm={() => {
            lists.removeMember(removeMemberConfirm.listId, removeMemberConfirm.selector);
            setRemoveMemberConfirm(null);
          }}
          onCancel={() => setRemoveMemberConfirm(null)}
        />
      )}
      {addListPromptOpen && (
        <OptimizerCreateListDialog
          libelleAction={addListPromptOpen === 'validate' ? 'Créer et valider' : 'Créer et ajouter'}
          onValider={(valeur, contenu) => {
            const nom = valeur.trim();
            const intent = addListPromptOpen;
            setAddListPromptOpen(null);
            if (!nom || !sourceSelector || !selected?.monster.com2usId) return;
            const id = lists.createList(nom, contenu);
            if (intent === 'validate') {
              if (canValidateDisplayed) lists.validateBuild(id, sourceSelector, displayedRuneIds, displayedArtifactIds, selected.monster.com2usId);
            } else {
              lists.addMember(id, sourceSelector, selected.monster.com2usId);
            }
            if (intent !== 'validate' || canValidateDisplayed) optimizer.capturerMembre(id, sourceSelector);
          }}
          onCancel={() => setAddListPromptOpen(null)}
        />
      )}
      {equipeOuverte && <OptimizerEquipeDialog contexte={lists} listId={equipeOuverte.listId} equipe={equipeOuverte.equipe}
        data={exclusionData} onValider={lists.setTeams} onClose={() => setEquipeOuverte(null)} />}
    </div>
  );
}
