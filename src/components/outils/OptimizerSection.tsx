import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import type { ContenuListeOptimizer, EquipeOptimizer } from '../../lib/optimizerMemberStorage';
import OptimizerEquipeDialog from './OptimizerEquipeDialog';
import OptimizerCreateListDialog from './OptimizerCreateListDialog';
import OptimizerImportButton, { type SourceImportOptimizer } from './OptimizerImportButton';
import { importerRecoOptimizer } from '../../lib/importRecoOptimizer';
import { importerDefensesSiegeOptimizer, importerOffenseSiegeOptimizer, importerPrepaRtaOptimizer, type RapportImportOptimizer } from '../../lib/importEquipes';
import { ArtifactDetail, ArtifactKind, ARTIFACT_KINDS, ELEMENTS, RelicDetail, RuneDetail, Monster, RtaEntry, SiegeTeam, Reco } from '../../types';
import { computeStats } from '../../lib/stats';
import { cibleDeLaFile, classementResolu, cleBuild, compositionDePage, compteAffichable, compteConfirme, signatureArtefacts as calculerSignatureArtefacts } from '../../lib/artifactQueue';
import { entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild, runesDuBuild, etatReliqueDuBuild } from '../../lib/relicQueue';
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
} from '../../lib/artifactOptim';
import { BoxItem } from '../../lib/applyAccount';
import { regimeArtefacts, regimeEquipementDe, type RegimeArtefacts } from '../../lib/artifactEvaluation';
import { evaluateursArtefactsFiche, parametresArtefactsFiche, piecesFigeesDe, sortesFigeesDe, statsLignesArtefactsEquipables } from '../../lib/artifactFiche';
import {
  StatKey,
  runeEfficiency,
  runeScore,
} from '../../lib/effects';
import {
  BuildRequirement,
  estimateSearchSpace,
  diagnoseFeasibility,
  StatFeasibility,
  rankBlockingConditions,
  BlockingConditionsDiagnosis,
  avecAurasConditions,
  sortCandidates,
  scoreDuCandidat,
  optionsDeClassement,
  scoreDeReference,
  candidateMetricTotal,
  aurasPropresParRunes,
  RealDamageContext,
  SLOT_FILTER_PRESETS,
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
  ExclusionCandidate,
  ExclusionSelector,
  ExclusionSource,
  ExclusionSourceData,
  type OptimizerListMember,
  SOURCE_OPTIONS,
  autoExcludedRuneIds,
  etatAjoutListe,
  exclusionCandidatesFor,
  exclusionSelectorKey,
  findValidatedBuild,
  libellePuceSource,
  otherValidatedArtifactIds,
  otherValidatedRuneIds,
  runesManquantesDuBuild,
  artefactsManquantsDuBuild,
  resolveExcludedRuneIds,
  resolveExclusionEntry,
} from '../../lib/optimizerExclusion';
import { buildOptimizerRecipe, mainsPourCeCompte, parseOptimizerRecipe, relicMainPourCeCompte } from '../../lib/optimizerRecipe';
import { delaiEffacementImport, type MessageImport } from '../../lib/messageImport';
import { DUREE_ATTENTION_MS, doitRappeler, echoAurasExternes, guideVersResPre } from '../../lib/aurasExternes';
import { jourLocal, telechargerTexte } from '../../lib/telechargement';
import {
  OptimizerState,
  DEFAULT_RELIC_MIN_UPGRADE,
  defaultRelicMainChoice,
  criteresApresChangementEspece,
  relicIntentDepuisEtat,
  relicMainChoiceApresChangementExemplaire,
} from '../../hooks/useOptimizerState';
import { UseOptimizerLists } from '../../hooks/useOptimizerLists';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import { useMediaQuery, SOUS_LG, SOUS_SM } from '../../hooks/useMediaQuery';
import { type Selected as SelectionGear } from '../MonsterGear';
import { useHauteurDesCartes } from './BuildCandidateCard';
import DamageSetupModale from './DamageSetupModale';
import BoutonValiderBuild from './optimizer/BoutonValiderBuild';
import BandeauBuildValide from './optimizer/BandeauBuildValide';
import type { EtatValidation } from './optimizer/types';
import { CONFIGURABLE_SLOTS } from './optimizer/constantes';
import MonstreEquipementTelephone from './optimizer/MonstreEquipementTelephone';
import { type ExemplaireEtFicheProps } from './optimizer/ExemplaireEtFiche';
import MonsterSourcePicker from './MonsterSourcePicker';
import MonstreEquipement from './optimizer/MonstreEquipement';
import Conditions from './optimizer/Conditions';
import StatPrincipaleImposee from './optimizer/StatPrincipaleImposee';
import SetDeRunes from './optimizer/SetDeRunes';
import CriteresRecherche from './optimizer/CriteresRecherche';
import MeilleursArtefacts from './optimizer/MeilleursArtefacts';
import ArtefactsEtReliques from './optimizer/ArtefactsEtReliques';
import CarteEtatMonstre from './optimizer/CarteEtatMonstre';
import RunesDejaUtilisees from './optimizer/RunesDejaUtilisees';
import ExclusionMonstrePrecis from './optimizer/ExclusionMonstrePrecis';
import RunesImposees from './optimizer/RunesImposees';
import ExclusionRunesContenu from './optimizer/ExclusionRunesContenu';
import TitreExclusionRunes from './optimizer/TitreExclusionRunes';
import TitreReglagesAvances from './optimizer/TitreReglagesAvances';
import OptionsRechercheTelephone from './optimizer/OptionsRechercheTelephone';
import EstimationPool from './optimizer/EstimationPool';
import ObjectifEtActions from './optimizer/ObjectifEtActions';
import ProgressionRecherche from './optimizer/ProgressionRecherche';
import PaginationResultats from './optimizer/PaginationResultats';
import AvisRechercheTronquee from './optimizer/AvisRechercheTronquee';
import ConfirmationsLiberation from './optimizer/ConfirmationsLiberation';
import ReglagesAvancesContenu from './optimizer/ReglagesAvancesContenu';
import ChoixExemplaire from './optimizer/ChoixExemplaire';
import MonstresDeLaListe, { type MonstresDeLaListeProps } from './optimizer/MonstresDeLaListe';
import SelecteurListes from './optimizer/SelecteurListes';
import EnteteResultats from './optimizer/EnteteResultats';
import DiagnosticsSansResultat from './optimizer/DiagnosticsSansResultat';
import GrilleResultats from './optimizer/GrilleResultats';
import MessageImportRecette from './optimizer/MessageImportRecette';
import PageBureau from './optimizer/bureau/PageBureau';
import ListeDeTravailBureau from './optimizer/bureau/ListeDeTravailBureau';
import SetDeRunesCompact from './optimizer/bureau/SetDeRunesCompact';
import PrincipalesImposeesBureau from './optimizer/bureau/PrincipalesImposeesBureau';
import ConditionsBureau from './optimizer/bureau/ConditionsBureau';
import EtatMonstreEssentiels from './optimizer/bureau/EtatMonstreEssentiels';
import ArtefactsEtReliqueBureau from './optimizer/bureau/ArtefactsEtReliqueBureau';
import MeilleursArtefactsBureau from './optimizer/bureau/MeilleursArtefactsBureau';
import SetsAuraBureau from './optimizer/bureau/SetsAuraBureau';
import ExclusionRunesBureau from './optimizer/bureau/ExclusionRunesBureau';
import ReglagesAvancesBureau from './optimizer/bureau/ReglagesAvancesBureau';
import ExemplaireBureau from './optimizer/bureau/ExemplaireBureau';
import ObjectifEtRechercherBureau from './optimizer/bureau/ObjectifEtRechercherBureau';
import ResultatsBureau from './optimizer/bureau/ResultatsBureau';
import { attenteResultats, type ColonnesOuvertes } from '../../lib/optimizerColonnes';
import { PREFIXE_FICHIER } from '../../marque';

interface Props {
  recommandations?: Reco[];
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
  onImporterEquipe: OptimizerState['importerEquipe'];
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
  /** Monstre à montrer dans le bouton « Options » quand sa ligne sort de l'écran. */
  onMonstreHorsVue?: (monstre: Monster | null) => void;
}


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

// Outil « Optimizer » : cherche, parmi les runes du compte, la (les)
// meilleure(s) combinaison(s) de 6 pour un monstre, un combo de sets et des
// minimums de stats donnés. Voir docs/02-app/optimizer/.
const AUCUNE_RECOMMANDATION: Reco[] = [];

export default function OptimizerSection({ recommandations = AUCUNE_RECOMMANDATION, box, runes, artifacts, relics, relicUsageById, optimizer, onImporterEquipe, allMonsters, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, lists, accountName, menuOuvert, onFermerMenu, onOuvrirMenu, onMonstreHorsVue }: Props) {
  const [rapportImport, setRapportImport] = useState<RapportImportOptimizer | null>(null);
  // Zone C du téléphone (« Gérer mes listes »), repliée par défaut.
  const [zoneCOpen, setZoneCOpen] = useState(false);
  // « Meilleurs artéfacts offensifs pour ce build » au téléphone, replié par défaut.
  const [artefactsOuverts, setArtefactsOuverts] = useState(false);
  // Éclat bref de « Gérer mes listes » et de la liste active après un import.
  const [eclatImport, setEclatImport] = useState(false);
  useEffect(() => {
    if (!eclatImport) return;
    const id = setTimeout(() => setEclatImport(false), 1400);
    return () => clearTimeout(id);
  }, [eclatImport]);
  const importerDepuisEcran = useCallback((produire: Parameters<OptimizerState['importerEquipe']>[0]) => {
    const rapport = onImporterEquipe(produire);
    setRapportImport(rapport);
    if (rapport.listeCreee) {
      // La liste créée s'affiche aussitôt au téléphone, dépliée et illuminée ;
      // le bouton d'import confirme lui-même (OptimizerImportButton).
      setZoneCOpen(true);
      setEclatImport(true);
    }
    return rapport;
  }, [onImporterEquipe]);
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
    exhaustiveSearch,
    setExhaustiveSearch,
    verifierToutesLesCombinaisons,
    setVerifierToutesLesCombinaisons,
    sortBy,
    setSortBy,
    resultsPage,
    setResultsPage,
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
    [lireCombatMembre, damageSetupPersonnel, lists.teams, lists.listContents, lists.activeListId, lists.lists, optimizer.proprietaireCriteres, box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, allMonsters]);
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
   * ⚠️ **En lecture seule, jamais des contrôles.** Les réglages manuels vivent dans
   * la carte « État de mon monstre » ; les compétences viennent du contenu
   * de la liste. Rendre ces réglages AUSSI dans la fenêtre en
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

  // Basculer sur Haut/Extrême active « Rechercher jusqu'à épuisement
  // complet » — un novice qui choisit un pré-filtrage large n'a aucune raison
  // de savoir que ce réglage est ce qui le rend réellement utile. Reste un
  // COUP DE POUCE, pas un verrouillage : l'interrupteur garde son `onChange`
  // propre, remettre à false ensuite reste un clic normal dessus. Bas/Moyen
  // ne le touchent pas dans l'autre sens — décoché une fois, il le reste.
  function handleSlotFilterPresetChange(preset: typeof slotFilterPreset) {
    setSlotFilterPreset(preset);
    if (preset === 'haut' || preset === 'extreme') {
      setExhaustiveSearch(true);
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
  // Les deux formats partagent les propositions calculées sur les seules sources.
  // Le nom complet reste le nom accessible ; l'écran montre les monstres
  // importés puis un libellé court, sous l'en-tête de leur section.
  const sourcesImport = useMemo<SourceImportOptimizer[]>(() => [
    { groupe: 'Prépa RTA', libelle: 'Tous les monstres', nom: 'Prépa RTA', produire: importerPrepaRtaOptimizer },
    { groupe: 'Défenses de siège', libelle: 'Toutes les défenses', nom: 'Défenses de siège', produire: importerDefensesSiegeOptimizer },
    ...exclusionData.siegeOffenseTeams.map((team, i) => ({
      groupe: 'Offenses de siège', libelle: `Offense ${i + 1}`,
      nom: `Offense de siège ${i + 1} · ${team.slots.map(s => s.monsterId && exclusionData.monsterById.get(s.monsterId)?.name).filter(Boolean).join(', ') || 'Deck vide'}`,
      produire: (courantes: ExclusionSourceData) => importerOffenseSiegeOptimizer(team.id, courantes),
    })),
    ...recommandations.flatMap((reco, ri) => reco.decks.map((deck, di) => ({
      groupe: 'Recommandations', libelle: `${reco.name || `Recommandation ${ri + 1}`} · Deck ${di + 1}`,
      nom: `Recommandation ${ri + 1} · ${reco.name || 'Sans nom'} · Deck ${di + 1} · ${deck.slots.map(s => s.com2usId != null && [...exclusionData.monsterById.values()].find(m => m.com2usId === s.com2usId)?.name || s.name).filter(Boolean).join(', ') || 'Deck vide'}`,
      produire: (courantes: ExclusionSourceData) => importerRecoOptimizer(deck, courantes),
    }))),
  ].map(source => {
    const { membres } = source.produire(exclusionData);
    return { ...source, utilisable: membres.length > 0,
      monstres: membres.flatMap(m => resolveExclusionEntry(m.selector, exclusionData)?.monster ?? []) };
  }), [exclusionData, recommandations]);

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
  // l'utilisateur est gardé, sauf « Comme équipée » sur un
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
      inclureSelectionRecherche(candidates[0].selector, candidates[0].monster);
    } else if (candidates.length > 1) {
      setSourceSelector(null);
      setZoneDOpen(true);
    } else {
      setSourceSelector(null);
      setZoneDOpen(false);
    }
  }

  // Choisit l'ESPÈCE (recherche bestiaire, voir `MonsterSourcePicker mode=
  // "bestiary"` plus bas) — rappelle d'abord le membre présent de l'espèce
  // dans la liste active ; sinon remet la source à Box et résout le PREMIER
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
    const membrePresent = lists.activeListId && monster.com2usId ? lists.members.find(m => m.listId === lists.activeListId
      && resolveExclusionEntry(m.selector, exclusionData)?.monster.com2usId === monster.com2usId) : null;
    if (membrePresent) {
      optimizer.choisirMembre(membrePresent.listId, membrePresent.selector);
      setZoneDOpen(false);
      return;
    }
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
    const selector = boxCandidates[0]?.selector ?? unownedSelectorIfNoneOwned(monster, box, exclusionData);
    setSourceSelector(selector);
    setZoneDOpen(false);
    if (!lists.activeListId) setAddListPromptOpen('recherche');
    else inclureSelectionRecherche(selector, monster);
  }

  // Une résolution explicite partage l'inclusion ordinaire : capture au geste,
  // puis attribution après publication ; un membre présent rappelle sa mémoire.
  function inclureSelectionRecherche(selector: ExclusionSelector | null, monster: Monster, listId = lists.activeListId) {
    if (!listId || !selector || !monster.com2usId) return;
    const resolu = resolveExclusionEntry(selector, exclusionData);
    if (resolu?.monster.com2usId !== monster.com2usId) return;
    const present = lists.members.some(m => m.listId === listId && exclusionSelectorKey(m.selector) === exclusionSelectorKey(selector));
    if (present) optimizer.choisirMembre(listId, selector);
    else {
      lists.addMember(listId, selector, monster.com2usId);
      optimizer.capturerMembre(listId, selector);
    }
  }

  // Bureau uniquement : ferme la désambiguïsation d'exemplaire (zone D) au
  // clic extérieur, comme HelpPopover.tsx. Au doigt, la zone D est un bloc INLINE (pas un `Flottant`), donc ce
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
  // en ligne, voir le rendu plus bas). État déclaré plus haut : l'import
  // l'ouvre.

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
  const [addListPromptOpen, setAddListPromptOpen] = useState<'add' | 'validate' | 'recherche' | null>(null);
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
  const artefactsAbsentsValides = ownValidatedBuild ? artefactsManquantsDuBuild(ownValidatedBuild, artifactById) : [];

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
    // construits, avec « Comme équipé » IMPOSÉ des deux côtés : le
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
        ? 'Les deux emplacements sont sur « Comme équipé » : la paire est déjà décidée, il n’y a rien à chercher.'
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
      // ⚠️ Toujours `false` : l'interrupteur « Prioriser les stats les plus
      // difficiles » est retiré de l'écran (sans gain mesuré). Ni une
      // session reprise ni une recette importée ne le réactivent.
      adaptiveTrancheWeighting: false,
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
      // Le lead reste personnel ; les compétences portent le mode effectif
      // décidé par le contenu, pour reproduire la recherche sans liste au CLI.
      damageSetup: { ...damageSetupPersonnel, summonerSkills: damageSetup.summonerSkills },
      compterAurasResPre,
      metric,
      slotFilterPreset,
      // Toujours `false`, comme la recherche (`handleSearch`).
      adaptiveTrancheWeighting: false,
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
    // Préfixe de la marque : `swblacksmith-optimizer-…`.
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

  // ── Ouverture guidée vers l'interrupteur des auras RES/PRE
  // Ajouter Accuracy ou Tolerance aux auras externes (« État de mon
  // monstre ») ou le choisir comme set recherché guide vers « Compter les
  // effets d'auras Tolerance et Précision dans les conditions ». La décision
  // est `guideVersResPre` (aurasExternes.ts), prise au geste, jamais à
  // l'import ni au changement de monstre.
  // ⚠️ **Deux formes, une par format**, choisies par `SOUS_LG` comme le
  // panneau lui-même (`MobileSheet`) et la page de bureau (`PageBureau`) :
  // - au bureau, la colonne repliable « Aura, exclusion, avancés », où
  //   l'interrupteur vit en ligne, s'ouvre (`guideComplements`, lu par
  //   `PageBureau` : l'état des onglets se résout avec la largeur), puis
  //   l'interrupteur est amené à l'écran (effet plus bas) ;
  // - au doigt, le panneau « Options de recherche » s'ouvre par-dessus la
  //   carte (demandé à App.tsx par `onOuvrirMenu`), puis son contenu défile
  //   jusqu'à l'interrupteur (effet plus bas).
  // L'interrupteur est surligné `DUREE_ATTENTION_MS` (3 s), au même token que
  // le rappel ; il reste rendu dans sa surface tant qu'elle est montée
  // (panneau au téléphone, colonne ouverte au bureau).
  const sousLg = useMediaQuery(SOUS_LG);
  const [attentionResPre, setAttentionResPre] = useState<number | null>(null);
  useEffect(() => {
    if (attentionResPre === null) return;
    const t = setTimeout(() => setAttentionResPre(null), DUREE_ATTENTION_MS);
    return () => clearTimeout(t);
  }, [attentionResPre]);
  // Une ref par surface : la colonne « Aura, exclusion, avancés » au bureau,
  // le panneau « Options » au doigt.
  const interrupteurResPreBureauRef = useRef<HTMLDivElement>(null);
  const interrupteurResPrePanneauRef = useRef<HTMLDivElement>(null);
  // Les états des onglets du bureau (`PageBureau`) : `null` tant que
  // l'utilisateur n'y a pas touché, l'état de départ suit alors la largeur.
  // Local à l'écran, comme tout état d'ouverture (src/lib/optimizerColonnes.ts).
  const [colonnesBureau, setColonnesBureau] = useState<ColonnesOuvertes | null>(null);
  // Le jeton du guidage vers « Aura, exclusion, avancés ».
  const [guideComplements, setGuideComplements] = useState<number | null>(null);

  function guiderVersResPre() {
    if (sousLg) {
      onOuvrirMenu();
      setAttentionResPre((n) => (n ?? 0) + 1);
      return;
    }
    setGuideComplements((n) => (n ?? 0) + 1);
    setAttentionResPre((n) => (n ?? 0) + 1);
  }

  // Puis l'interrupteur lui-même, une fois sa surface ouverte : au doigt, il
  // est le DERNIER réglage du panneau, sous « Exclusion de runes » ; au
  // bureau, le bas de la colonne peut dépasser de l'écran (`nearest` : le
  // moindre défilement qui le montre). `requestAnimationFrame` : la colonne
  // ouverte se met en page dans un effet, à laisser finir avant de mesurer.
  useEffect(() => {
    if (attentionResPre === null) return;
    // Au bureau, l'interrupteur n'est rendu que colonne ouverte : l'effet se
    // rejoue quand l'état des onglets change (`colonnesBureau`).
    const el = sousLg
      ? menuOuvert
        ? interrupteurResPrePanneauRef.current
        : null
      : interrupteurResPreBureauRef.current;
    if (!el) return;
    // Au bureau, en A3, c'est la colonne repliable qui défile, seule.
    const image = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: sousLg ? 'center' : 'nearest' });
    });
    return () => cancelAnimationFrame(image);
  }, [attentionResPre, sousLg, menuOuvert, colonnesBureau]);

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
      // `adaptiveTrancheWeighting` n'est pas relu : une recette qui le porte
      // à vrai s'importe sans erreur et n'active rien (réglage retiré).
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
      // ⚠️ « Comme équipé » ne se partage pas — la règle, son
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
        // ⚠️ La bascule « Comme équipé » → « Libre » se DIT : elle
        // change ce que la recherche va renvoyer, exactement comme un verrou
        // perdu. Une recette qui se comporte autrement que chez son auteur,
        // sans un mot, serait pire que la donnée transportée telle quelle.
        + (bascules ? ` Cette recette vient d'un autre compte : « Comme équipé » est passé sur « Libre ».` : '')
        + (relicBascule ? ` Cette recette vient d'un autre compte : « Comme équipée » est passé sur « Libre ».` : '')
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
        // ⚠️ Un emplacement figé sur « Comme équipé » n'a qu'un
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

  // Contenu de la zone D (désambiguïsation d'exemplaire) — construit UNE fois :
  // réutilisé tel quel dans le `Flottant` du bureau et le bloc en ligne du
  // mobile (voir le rendu plus bas), qui ne diffèrent QUE par leur
  // présentation (flottant vs en ligne), pas par leur contenu.
  // Le geste d'un exemplaire de la zone D : il devient l'exemplaire optimisé.
  function choisirExemplaireZoneD(c: ExclusionCandidate) {
    setSourceSelector(c.selector);
    reliqueCoherenteAvecExemplaire(c.gear.relic);
    setZoneDOpen(false);
    inclureSelectionRecherche(c.selector, c.monster);
  }
  const zoneDList =
    <ChoixExemplaire
      candidatesBySource={candidatesBySource}
      gearSource={gearSource}
      choisirExemplaireZoneD={choisirExemplaireZoneD}
    />;

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
  // Au téléphone, la ligne du monstre choisi est observée : hors de l'écran,
  // le bouton « Options » prend son icône (aucun élément de plus à l'écran).
  const ligneMonstreTelephoneRef = useRef<HTMLDivElement>(null);
  const monstreAffiche = selected?.monster ?? null;
  useEffect(() => {
    const ligne = ligneMonstreTelephoneRef.current;
    if (!onMonstreHorsVue || !ligne || !monstreAffiche) { onMonstreHorsVue?.(null); return; }
    // La marge haute retire l'en-tête collant : la ligne passée dessous est hors de vue.
    const observateur = new IntersectionObserver(([e]) => onMonstreHorsVue(e.isIntersecting ? null : monstreAffiche),
      { rootMargin: '-64px 0px 0px 0px' });
    observateur.observe(ligne);
    return () => { observateur.disconnect(); onMonstreHorsVue(null); };
  }, [onMonstreHorsVue, monstreAffiche]);
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
  const validatedBadge = <BandeauBuildValide
    ownValidatedBuild={ownValidatedBuild}
    showRealGear={showRealGear}
    runesAbsentesValidees={runesAbsentesValidees}
    artefactsAbsentsValides={artefactsAbsentsValides}
    setShowRealGear={setShowRealGear}
  />;

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
    <MeilleursArtefacts
      modeArtefactsSeuls={modeArtefactsSeuls}
      etroit={etroit}
      setArtefactsOuverts={setArtefactsOuverts}
      artefactsOuverts={artefactsOuverts}
      critereArtefacts={critereArtefacts}
      setCritereArtefacts={setCritereArtefacts}
      setSetupOuvert={setSetupOuvert}
      sortesFigees={sortesFigees}
      resolvedSkill={resolvedSkill}
      sourceSelector={sourceSelector}
      lists={lists}
      ownValidatedBuild={ownValidatedBuild}
      canValidateDisplayed={canValidateDisplayed}
      handleValidateArtefacts={handleValidateArtefacts}
      artefactsProposesDejaReserves={artefactsProposesDejaReserves}
    />
  );

  const validateBuildButton = (
    <BoutonValiderBuild
      handleValidateDisplayed={handleValidateDisplayed}
      canValidateDisplayed={canValidateDisplayed}
      matchesValidatedBuild={matchesValidatedBuild}
      etatFiche={etatFiche}
      displayedRuneConflicts={displayedRuneConflicts}
    />
  );

  // Assemblage des cartes de réglage (composants d'`optimizer/`).
  const listesBureau = (
    <SelecteurListes
      action={<OptimizerImportButton enLigne sources={sourcesImport} onImporter={importerDepuisEcran} rapport={rapportImport} />}
      lists={lists}
      memberCounts={memberCountsByList}
      titreSection
    />
  );

  const listesTelephone = <SelecteurListes lists={lists} memberCounts={memberCountsByList} />;

  // Le geste du set recherché.
  function choisirSetsRecherches(next: string[]) {
    setComboSets(next);
    if (next.length > 0) setSetPickerInvalid(false);
    // Ouverture guidée : Accuracy ou Tolerance
    // CHOISI comme set recherché guide vers l'interrupteur des auras
    // RES/PRE, sans toucher aux auras externes. Au geste seulement :
    // l'import d'une recette pose `comboSets` sans passer par ici.
    if (guideVersResPre({ setsRecherches: comboSets }, { setsRecherches: next })) guiderVersResPre();
  }

  const setDeRunes = (
    <SetDeRunes
      setPickerSectionRef={setPickerSectionRef}
      setPickerInvalid={setPickerInvalid}
      comboSets={comboSets}
      onChangeSets={choisirSetsRecherches}
    />
  );

  const statPrincipaleImposee = (
    <StatPrincipaleImposee
      mainStatsBySlot={mainStatsBySlot}
      toggleMainStat={toggleMainStat}
    />
  );

  const conditions = (
    <Conditions
      excludeBase={excludeBase}
      setExcludeBase={setExcludeBase}
      baseOf={baseOf}
      artifactFloorOf={artifactFloorOf}
      minStats={minStats}
      maxStats={maxStats}
      setMinStats={setMinStats}
      setMaxStats={setMaxStats}
    />
  );

  // Le geste d'un membre de la liste de travail (zone C) : il devient le
  // monstre optimisé, avec ses critères.
  function choisirMembreDeLaListe(m: OptimizerListMember, resolved: ReturnType<typeof resolveExclusionEntry>) {
    if (!resolved) return;
    const id = String(resolved.monster.id);
    const key = exclusionSelectorKey(m.selector);
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
  }

  const rapportZoneC = [...lists.rapportStockage, ...optimizer.rapportCriteres];
  // La liste de travail (zone C), une fois : dans « Monstre & équipement » au
  // téléphone, dans les essentiels au bureau.
  const proprietesListe: MonstresDeLaListeProps = {
    activeList,
    activeMembers,
    ajoutListe,
    handleAddToList,
    setEquipeOuverte,
    lists,
    optimizer,
    exclusionData,
    artifacts,
    rapportZoneC,
    groupesMembres,
    runeById,
    artifactById,
    choisirMembreDeLaListe,
    setReleaseConfirm,
    setReleaseArtifactsConfirm,
    setRemoveMemberConfirm,
    rappelAuras: rappelAuras !== null,
    listHasValidated,
    setReleaseAllConfirm,
  };
  const zoneCContent = <MonstresDeLaListe {...proprietesListe} />;

  // Le geste « Créer » de la fenêtre de création de liste : la liste créée,
  // puis, selon l'intention qui l'a ouverte, l'ajout, la validation ou la
  // recherche du monstre affiché.
  function creerListeDepuisDialogue(valeur: string, contenu: ContenuListeOptimizer) {
    const nom = valeur.trim();
    const intent = addListPromptOpen;
    setAddListPromptOpen(null);
    if (!selected?.monster.com2usId || (!sourceSelector && intent !== 'recherche')) return;
    const id = lists.createList(nom, contenu);
    if (intent === 'recherche') {
      inclureSelectionRecherche(sourceSelector, selected.monster, id);
      return;
    }
    if (!sourceSelector) return;
    if (intent === 'validate') {
      if (canValidateDisplayed) lists.validateBuild(id, sourceSelector, displayedRuneIds, displayedArtifactIds, selected.monster.com2usId);
    } else {
      lists.addMember(id, sourceSelector, selected.monster.com2usId);
    }
    if (intent !== 'validate' || canValidateDisplayed) optimizer.capturerMembre(id, sourceSelector);
  }

  // Ce que chaque carte de résultat reçoit de l'écran : sa paire, sa relique,
  // ses chiffres de classement et ses gestes (comparer, valider).
  function proprietesCarte(c: BuildCandidate) {
    return {
      // ⚠️ La paire de CE build, jamais une paire commune : deux
      // builds voisins n'appellent pas les mêmes artéfacts, et ce
      // sont ces pièces-là qui ont servi à calculer ses stats.
      // Le repli sur la paire SUPPOSÉE ne sert que sans file
      // (optimisation coupée : la paire portée, la seule possible) —
      // avec file, une carte affichée est résolue.
      artifacts: fileArtefacts.parBuild.get(cleBuild(c))?.artefacts ?? searchArtifacts,
      // ⚠️ **Seule source** :
      // `etatReliqueDuBuild` lit le cache de la file, jamais
      // recalculé ici — `fixe` (hors mode `recherche`) n'affiche
      // rien de nouveau, `rejete` n'arrive jamais jusqu'ici (le
      // classement écarte déjà ces builds). Par
      // `etatReliqueDe` : la relique que le score compte.
      etatRelique: etatReliqueDe(c),
      ...(() => {
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
      })(),
      // ⚠️ Affiché dès qu'un sort est résolu ET que c'est bien le
      // critère de classement courant (objectif OU tri) — pas
      // seulement quand `objective` vaut « Dégâts réels » : on peut
      // avoir lancé la recherche sur un autre objectif puis re-trier
      // par dégâts réels, auquel cas le chiffre qui ordonne les
      // cartes doit être visible dessus.
      degatsReels:
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
          : undefined,
      // « Valider » — réserve les 6 runes RÉELLES de CE
      // candidat pour `sourceSelector`, qu'il pointe un exemplaire
      // réel OU un sélecteur `unowned` (monstre non possédé,
      // demande explicite — « essayer des runages de teams sans
      // avoir mis à jour son json » : les runes trouvées restent de
      // VRAIES runes du compte, réservables comme n'importe quel
      // autre build validé). Absent uniquement si `sourceSelector`
      // est `null` (aucune espèce choisie, ou possédée ailleurs
      // sans exemplaire encore désambiguïsé — zone D).
      // ⚠️ Exige `sourceSelector` non nul ET une liste active (un build
      // validé appartient TOUJOURS à une liste, voir
      // ValidatedBuild). Valider ajoute aussi implicitement le
      // monstre à la liste s'il n'y était pas déjà (voir
      // `validateBuild`, useOptimizerLists.ts).
      onValidate:
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
          : undefined,
      // ⚠️ La paire QUE CETTE CARTE MONTRE — celle de la file si
      // elle l'a trouvée, la représentative sinon. Exactement la
      // même expression que `onValidate` ci-dessus : comparer autre
      // chose que ce qu'on validerait rendrait le libellé menteur.
      validated: etatValidation(
        c.runeIds,
        (fileArtefacts.parBuild.get(cleBuild(c))?.artefacts ?? searchArtifacts).map((a) => a.id)
      ),
      conflit: (() => {
        const conflits = conflitsDeRunes(c.runeIds);
        if (conflits.length === 0) return null;
        const noms = [...new Set(conflits.map((x) => x.monsterName))];
        return `${conflits.length > 1 ? 'Runes déjà réservées' : 'Rune déjà réservée'} dans cette liste pour ${noms.join(', ')}`;
      })(),
    };
  }

  // Ce que les deux formats partagent hors des réglages : les résultats et
  // les fenêtres (modales, dialogues), écrits une fois.
  const resultatsPresents = result != null || fullSortedCandidates.length > 0;
  const blocResultats = (
    <>
      {resultatsPresents && (
        <div>
          <EnteteResultats
            result={result}
            compteConfirmes={compteConfirmes}
            resoudreEquipement={resoudreEquipement}
            optimiserArtefacts={optimiserArtefacts}
            adapterArtefactsAuTri={adapterArtefactsAuTri}
            setAdapterArtefactsAuTri={setAdapterArtefactsAuTri}
            sortBy={sortBy}
            setSortBy={setSortBy}
            setResultsPage={setResultsPage}
            realDamage={realDamage}
            fileArtefacts={fileArtefacts}
            compteAffiche={compteAffiche}
          />
  
          <DiagnosticsSansResultat
            bureau={!sousLg}
            result={result}
            feasibilityDiagnosis={feasibilityDiagnosis}
            impossibleFeasibility={impossibleFeasibility}
            blockingDiagnosis={blockingDiagnosis}
            diagnoseBlockingEnabled={diagnoseBlockingEnabled}
            runeById={runeById}
            metric={metric}
            objective={objective}
            aurasPropresDe={aurasPropresDe}
            damageSetup={damageSetup}
          />
  
          {result?.truncated && (
            <AvisRechercheTronquee result={result} stoppedManually={stoppedManually} />
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
          <GrilleResultats
            bureau={!sousLg}
            grilleResultatsRef={grilleResultatsRef}
            composition={composition}
            runeById={runeById}
            relicUsageById={relicUsageById}
            metric={metric}
            openDetailKey={openDetailKey}
            onToggleDetail={(key: string) => setOpenDetailKey((cur) => (cur === key ? null : key))}
            proprietesCarte={proprietesCarte}
            hauteurCarte={hauteurCarte}
          />
  
          {/* Pagination — remplace l'ancienne troncature dure à 20 : la
              liste complète (jusqu'à MAX_COLLECTED, voir runeBuildOptim.ts)
              reste consultable, 20 par page. Flèches précédent/suivant +
              saisie directe du numéro de page (même convention que les
              champs numériques de l'app : `type="text"` + `inputMode=
              "numeric"`, jamais de flèches natives de navigateur — voir
              NumberField.tsx). */}
          {totalResultsPages > 1 && (
            <PaginationResultats
              setResultsPage={setResultsPage}
              resultsPage={resultsPage}
              pageDraft={pageDraft}
              setPageDraft={setPageDraft}
              totalResultsPages={totalResultsPages}
            />
          )}
        </div>
      )}
    </>
  );
  const modaleDegats = (
    <>
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
    </>
  );
  const fenetresListes = (
    <>
      <ConfirmationsLiberation
        lists={lists}
        releaseConfirm={releaseConfirm}
        setReleaseConfirm={setReleaseConfirm}
        releaseArtifactsConfirm={releaseArtifactsConfirm}
        setReleaseArtifactsConfirm={setReleaseArtifactsConfirm}
        releaseAllConfirm={releaseAllConfirm}
        setReleaseAllConfirm={setReleaseAllConfirm}
        removeMemberConfirm={removeMemberConfirm}
        setRemoveMemberConfirm={setRemoveMemberConfirm}
      />
      {addListPromptOpen && (
        <OptimizerCreateListDialog
          listes={lists.lists}
          libelleAction={addListPromptOpen === 'validate' ? 'Créer et valider' : addListPromptOpen === 'recherche' ? 'Créer' : 'Créer et ajouter'}
          onValider={creerListeDepuisDialogue}
          onCancel={() => setAddListPromptOpen(null)}
        />
      )}
      {equipeOuverte && <OptimizerEquipeDialog contexte={lists} listId={equipeOuverte.listId} equipe={equipeOuverte.equipe}
        data={exclusionData} onValider={lists.setTeams} onClose={() => setEquipeOuverte(null)} />}
    </>
  );

  // « Exemplaire » et la fiche : dans « Monstre & équipement » au téléphone,
  // dans sa carte de la colonne de droite au bureau.
  const proprietesExemplaire: ExemplaireEtFicheProps = {
    zoneDRef,
    sourceOptions,
    matchesValidatedBuild,
    unowned,
    gearSource,
    pickSource,
    allSourcesEmpty,
    zoneDOpen,
    zoneDList,
    validatedBadge,
    selected,
    selectionFiche,
    setSelectionFiche,
    relicUsageById,
    validateBuildButton,
  };

  // ── Format bureau : la page en colonnes (`PageBureau`) ─────────────────
  // Le format se décide comme partout (`SOUS_LG`, relu dans un volet) ;
  // l'agencement, ensuite, sur la largeur du conteneur de l'écran. Les mêmes
  // contenus que le téléphone, dans leurs formes de bureau
  // (src/components/outils/optimizer/bureau/) : le téléphone garde la grille
  // ci-dessous, inchangée.
  // ⚠️ **Les fenêtres (modales, dialogues) hors des deux arbres**, à une place
  // fixe : changer de format (fenêtre ou volet redimensionné) remonte la page,
  // jamais une fenêtre ouverte, qui garde son brouillon. Elles passent toutes
  // par un portail : leur place ici ne change rien au DOM de la page.
  const pageBureau = sousLg ? null : (
      <PageBureau
        liste={
          <ListeDeTravailBureau
            listes={listesBureau}
            recherche={<MonsterSourcePicker mode="bestiary" candidates={allMonsters} onPick={pickSpecies} />}
            monstreActif={selected?.monster ?? null}
            liste={proprietesListe}
          />
        }
        set={
          <SetDeRunesCompact
            setPickerSectionRef={setPickerSectionRef}
            setPickerInvalid={setPickerInvalid}
            comboSets={comboSets}
            onChangeSets={choisirSetsRecherches}
          />
        }
        conditions={
          <ConditionsBureau
            excludeBase={excludeBase}
            setExcludeBase={setExcludeBase}
            baseOf={baseOf}
            artifactFloorOf={artifactFloorOf}
            minStats={minStats}
            maxStats={maxStats}
            setMinStats={setMinStats}
            setMaxStats={setMaxStats}
          />
        }
        principales={<PrincipalesImposeesBureau mainStatsBySlot={mainStatsBySlot} toggleMainStat={toggleMainStat} />}
        etat={
          <EtatMonstreEssentiels
            setup={damageSetup}
            maj={majDamageSetup}
            equipe={combatMembre.equipe !== null}
            motifLead={combatMembre.motif}
            etroit={etroit}
            rappelsBuffs={rappelsBuffs}
          />
        }
        artefacts={
          <ArtefactsEtReliqueBureau
            optimiserArtefacts={optimiserArtefacts}
            setOptimiserArtefacts={setOptimiserArtefacts}
            artifactMainByKind={artifactMainByKind}
            setArtifactMainByKind={setArtifactMainByKind}
            lignesVerrouillees={lignesVerrouillees}
            setLignesVerrouillees={setLignesVerrouillees}
            diagnosticVerrous={diagnosticVerrous}
            sortesFigees={sortesFigees}
            relicMainChoice={relicMainChoice}
            setRelicMainChoice={setRelicMainChoice}
            relicUniqueChoice={relicUniqueChoice}
            setRelicUniqueChoice={setRelicUniqueChoice}
            relicMinUpgrade={relicMinUpgrade}
            setRelicMinUpgrade={setRelicMinUpgrade}
          />
        }
        meilleurs={modeArtefactsSeuls && (
          <MeilleursArtefactsBureau
            modeArtefactsSeuls={modeArtefactsSeuls}
            setArtefactsOuverts={setArtefactsOuverts}
            artefactsOuverts={artefactsOuverts}
            critereArtefacts={critereArtefacts}
            setCritereArtefacts={setCritereArtefacts}
            setSetupOuvert={setSetupOuvert}
            sortesFigees={sortesFigees}
            resolvedSkill={resolvedSkill}
            sourceSelector={sourceSelector}
            lists={lists}
            ownValidatedBuild={ownValidatedBuild}
            canValidateDisplayed={canValidateDisplayed}
            handleValidateArtefacts={handleValidateArtefacts}
            artefactsProposesDejaReserves={artefactsProposesDejaReserves}
          />
        )}
        auras={<SetsAuraBureau setup={damageSetup} maj={majDamageSetup} rappel={rappelAuras !== null} onGuiderResPre={guiderVersResPre} />}
        exclusion={
          <ExclusionRunesBureau
            monstrePrecisBlock={
              <ExclusionMonstrePrecis
                exclusionData={exclusionData}
                selectedUnitKey={selectedUnitKey}
                selected={selected}
                excludedSelectors={excludedSelectors}
                setExcludedSelectors={setExcludedSelectors}
                bureau
              />
            }
            dejaUtiliseesBlock={
              <RunesDejaUtilisees
                excludeUsedRunes={excludeUsedRunes}
                setExcludeUsedRunes={setExcludeUsedRunes}
                excludeUsedScope={excludeUsedScope}
                setExcludeUsedScope={setExcludeUsedScope}
                bureau
              />
            }
            runesImposeesBlock={<RunesImposees selected={selected} lockedRunes={lockedRunes} setLockedRunes={setLockedRunes} bureau />}
          />
        }
        avances={
          <ReglagesAvancesBureau>
            <ReglagesAvancesContenu
              slotFilterPreset={slotFilterPreset}
              handleSlotFilterPresetChange={handleSlotFilterPresetChange}
              dansPanneau={false}
              estimate={estimate}
              exhaustiveSearch={exhaustiveSearch}
              setExhaustiveSearch={setExhaustiveSearch}
              diagnoseBlockingEnabled={diagnoseBlockingEnabled}
              setDiagnoseBlockingEnabled={setDiagnoseBlockingEnabled}
              optimiserArtefacts={optimiserArtefacts}
              verifierToutesLesCombinaisons={verifierToutesLesCombinaisons}
              setVerifierToutesLesCombinaisons={setVerifierToutesLesCombinaisons}
              interrupteurResPrePanneauRef={interrupteurResPrePanneauRef}
              interrupteurResPreBureauRef={interrupteurResPreBureauRef}
              attentionResPre={attentionResPre}
              compterAurasResPre={compterAurasResPre}
              setCompterAurasResPre={setCompterAurasResPre}
              bureau
            />
          </ReglagesAvancesBureau>
        }
        // La colonne de droite : « Exemplaire », le bloc « Objectif et
        // Rechercher » (estimation, objectif, lancement, message d'import,
        // progression compacte) et les résultats, que la page place.
        exemplaire={<ExemplaireBureau {...proprietesExemplaire} />}
        objectif={(presentation) => (
          <ObjectifEtRechercherBureau
            {...presentation}
            estimation={estimate ? <EstimationPool estimate={estimate} /> : null}
            messageImport={<MessageImportRecette message={importMsg} />}
            progression={{ progress, refusal, compteAffiche }}
            objective={objective}
            setObjective={setObjective}
            setSetupOuvert={setSetupOuvert}
            resumeCombat={resumeCombat}
            handleSearch={handleSearch}
            selected={selected}
            status={status}
            comboSets={comboSets}
            exportRecipe={exportRecipe}
            importFileRef={importFileRef}
            importRecipe={importRecipe}
            setStoppedManually={setStoppedManually}
            stop={stop}
          />
        )}
        resultats={<ResultatsBureau attente={attenteResultats(selected != null, resultatsPresents, status)}>{blocResultats}</ResultatsBureau>}
        colonnes={colonnesBureau}
        onColonnes={setColonnesBureau}
        rappelAuras={rappelAuras !== null}
        guideComplements={guideComplements}
      />
  );

  // ── Format téléphone ───────────────────────────────────────────────────
  // Une colonne, dans l'ordre d'usage : le DOM est l'ordre de lecture. Rendu
  // sous `SOUS_LG` seulement : aucune classe `lg:`/`xl:` n'y a d'effet.
  return (
    <>
    {pageBureau ?? (
    <div className="space-y-5">
      {/* La phrase d'introduction, au téléphone seulement : la page de bureau
          n'a rien au-dessus de ses colonnes. */}
      <p className="text-sm text-ink-dim">
        Recherche parmi tes runes possédées ; rien n'est appliqué à ton compte, l'outil est purement
        indicatif — c'est à toi de re-runer dans le jeu.
      </p>

      {/* Les cartes de réglage, une par rangée. `minmax(0,1fr)` : la colonne
          suit l'écran — une colonne implicite grandissait jusqu'au contenu le
          plus large (la roue de la fiche, `w-max`), décentrant la page. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 items-start">
      {/* Étape 1 — carte À PART, en tête du DOM. ⚠️ **La fiche reste
          TOUJOURS affichée, vide (`EMPTY_GEAR`) tant qu'aucun monstre n'est
          choisi**, plutôt que de n'apparaître qu'au clic : l'espace qu'elle
          occupe est réservé d'avance (voir docs/03-developpeur/interface/). */}
      <MonstreEquipement>
          <MonstreEquipementTelephone
            allMonsters={allMonsters}
            pickSpecies={pickSpecies}
            ligneMonstreTelephoneRef={ligneMonstreTelephoneRef}
            selected={selected}
            sourcesImport={sourcesImport}
            importerDepuisEcran={importerDepuisEcran}
            rapportImport={rapportImport}
            setZoneCOpen={setZoneCOpen}
            zoneCOpen={zoneCOpen}
            eclatImport={eclatImport}
            listesTelephone={listesTelephone}
            sourceOptions={sourceOptions}
            matchesValidatedBuild={matchesValidatedBuild}
            unowned={unowned}
            gearSource={gearSource}
            pickSource={pickSource}
            allSourcesEmpty={allSourcesEmpty}
            zoneDOpen={zoneDOpen}
            zoneDList={zoneDList}
            zoneCContent={zoneCContent}
            validatedBadge={validatedBadge}
            selectionFiche={selectionFiche}
            setSelectionFiche={setSelectionFiche}
            relicUsageById={relicUsageById}
            validateBuildButton={validateBuildButton}
          />
      </MonstreEquipement>

      {/* Étape 3. */}
      <CriteresRecherche
        setDeRunes={setDeRunes}
        statPrincipaleImposee={statPrincipaleImposee}
        conditions={conditions}
      />

      {/* Carte À PART, PAS un bloc dans « Critères de recherche » : une
          carte dédiée Artéfacts. ⚠️ L'interrupteur « Ignorer les
          statistiques » masque d'un coup les sélecteurs ET les lignes
          verrouillées : dans « Critères de recherche », ce clic ferait
          REMONTER « Conditions » — un clic qui déplace ce qui le suit,
          interdit par docs/03-developpeur/interface/. Isolé ici, il ne déplace
          que ce qui suit la carte entière. */}
      <ArtefactsEtReliques
        optimiserArtefacts={optimiserArtefacts}
        setOptimiserArtefacts={setOptimiserArtefacts}
        artifactMainByKind={artifactMainByKind}
        setArtifactMainByKind={setArtifactMainByKind}
        lignesVerrouillees={lignesVerrouillees}
        setLignesVerrouillees={setLignesVerrouillees}
        diagnosticVerrous={diagnosticVerrous}
        sortesFigees={sortesFigees}
        blocArtefactsSeuls={blocArtefactsSeuls}
        relicMainChoice={relicMainChoice}
        setRelicMainChoice={setRelicMainChoice}
        relicUniqueChoice={relicUniqueChoice}
        setRelicUniqueChoice={setRelicUniqueChoice}
        relicMinUpgrade={relicMinUpgrade}
        setRelicMinUpgrade={setRelicMinUpgrade}
      />

      {/* ⚠️ **Carte à part, sous « Artéfacts et relique »** — ces cinq
          réglages ne sont PAS des réglages d'artéfact ni de relique. Ils
          décrivent le monstre : buffs reçus, leader skill d'équipe,
          compétences d'invocateur. Ils vivaient en bas de la carte
          Artéfacts, séparés par un simple trait, ce qui laissait croire
          qu'ils la servaient — alors qu'ils changent les statistiques du
          monstre tout court, donc aussi bien les dégâts supplémentaires que
          n'importe quel calcul de dégâts réels.
          ⚠️ **Toujours visible, indépendamment de l'objectif de recherche** :
          les laisser dans la fenêtre « Dégâts réels » les rendait invisibles à
          qui optimise l'efficience, alors qu'ils s'appliquaient quand même. */}
      <CarteEtatMonstre
        setup={damageSetup}
        maj={majDamageSetup}
        equipe={combatMembre.equipe !== null}
        motifLead={combatMembre.motif}
        etroit={etroit}
        rappelAuras={rappelAuras !== null}
        onGuiderResPre={guiderVersResPre}
        rappelsBuffs={rappelsBuffs}
      />

      {/* ⚠️ « Objectif de recherche » N'EST PAS ICI — il est dans la carte
          du bouton Rechercher, plus bas : *quoi* chercher et *chercher* vont
          ensemble, et sa description de combat est en fenêtre (voir
          DamageSetupModale.tsx). */}

      {/* ── Réglages avancés + Exclusion de runes : dans le panneau
          « Options » (`MobileSheet`, en portail), avec la ligne
          d'estimation. ⚠️ **Fragment, PAS un `<div>`** : la ligne
          d'estimation est une rangée de la grille. */}
      <>
      {(() => {
        // ⚠️ `dansPanneau` : la version DANS LE PANNEAU affiche « Pool de
        // runes = X » à côté du pré-filtrage — la page, où la même info existe
        // déjà, est masquée par le voile : sans ce doublon local, aucun moyen
        // de voir l'effet du réglage qu'on vient de toucher sans d'abord
        // refermer le panneau.
        // ⚠️ **DEUX colonnes dès que la place le permet** (demande explicite)
        // — le pré-filtrage d'un côté, les interrupteurs de l'autre — par
        // `auto-fit`/`minmax`, NON un point de rupture d'écran : ce qui décide
        // est la largeur du panneau, pas celle de la fenêtre.
        const reglagesAvancesPanneau = (
          <ReglagesAvancesContenu
            slotFilterPreset={slotFilterPreset}
            handleSlotFilterPresetChange={handleSlotFilterPresetChange}
            dansPanneau
            estimate={estimate}
            exhaustiveSearch={exhaustiveSearch}
            setExhaustiveSearch={setExhaustiveSearch}
            diagnoseBlockingEnabled={diagnoseBlockingEnabled}
            setDiagnoseBlockingEnabled={setDiagnoseBlockingEnabled}
            optimiserArtefacts={optimiserArtefacts}
            verifierToutesLesCombinaisons={verifierToutesLesCombinaisons}
            setVerifierToutesLesCombinaisons={setVerifierToutesLesCombinaisons}
            interrupteurResPrePanneauRef={interrupteurResPrePanneauRef}
            interrupteurResPreBureauRef={interrupteurResPreBureauRef}
            attentionResPre={attentionResPre}
            compterAurasResPre={compterAurasResPre}
            setCompterAurasResPre={setCompterAurasResPre}
          />
        );

        const reglagesAvancesTitre = (
          <TitreReglagesAvances />
        );

        const dejaUtiliseesBlock = (
          <RunesDejaUtilisees
            excludeUsedRunes={excludeUsedRunes}
            setExcludeUsedRunes={setExcludeUsedRunes}
            excludeUsedScope={excludeUsedScope}
            setExcludeUsedScope={setExcludeUsedScope}
          />
        );

        // Exclusion MANUELLE — se superpose à « Exclure les runes déjà
        // utilisées », ne la remplace pas (voir optimizerExclusion.ts).
        // Choisir un monstre ici, dans n'importe laquelle des 4 sources,
        // retire ses runes ACTUELLEMENT équipées du pool considéré, en plus
        // de l'exclusion automatique éventuelle. `Segmented` mesure lui-même
        // la place qu'il reçoit et se resserre tout seul (voir Segmented.tsx).
        const monstrePrecisBlock = (
          <ExclusionMonstrePrecis
            exclusionData={exclusionData}
            selectedUnitKey={selectedUnitKey}
            selected={selected}
            excludedSelectors={excludedSelectors}
            setExcludedSelectors={setExcludedSelectors}
          />
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
          <RunesImposees
            selected={selected}
            lockedRunes={lockedRunes}
            setLockedRunes={setLockedRunes}
          />
        );

        // L'ordre et l'empilement des trois réglages : ExclusionRunesContenu.tsx.
        const exclusionRunesPanneau = (
          <ExclusionRunesContenu
            monstrePrecisBlock={monstrePrecisBlock}
            dejaUtiliseesBlock={dejaUtiliseesBlock}
            runesImposeesBlock={runesImposeesBlock}
          />
        );

        const exclusionRunesTitre = (
          <TitreExclusionRunes />
        );

        return (
          <>
            {/* La ligne d'estimation, sous toutes les cartes. */}
            {estimate && (
              <EstimationPool
                estimate={estimate}
              />
            )}

            {/* Doigt : panneau « Options de recherche », ordre Exclusion de
                runes → Réglages avancés, jamais replié (ouvrir le panneau EST
                déjà le geste « je veux voir les options »). Chaque groupe
                dans son propre cadre (`bg-panel2`) : deux unités visuelles
                distinctes, pas juste un trait de séparation entre deux blocs
                de texte. */}
            <OptionsRechercheTelephone
              menuOuvert={menuOuvert}
              onFermerMenu={onFermerMenu}
              exclusionRunesTitre={exclusionRunesTitre}
              exclusionRunesPanneau={exclusionRunesPanneau}
              reglagesAvancesTitre={reglagesAvancesTitre}
              reglagesAvancesPanneau={reglagesAvancesPanneau}
            />
          </>
        );
      })()}
      </>
      {/* fin de la grille de réglages — tout ce qui suit reprend la pleine
          largeur : la barre d'actions, la progression et les résultats
          (une grille de cartes qui, elle, PROFITE de la largeur). */}
      </div>

      <ObjectifEtActions
        objective={objective}
        setObjective={setObjective}
        setSetupOuvert={setSetupOuvert}
        resumeCombat={resumeCombat}
        handleSearch={handleSearch}
        selected={selected}
        status={status}
        comboSets={comboSets}
        exportRecipe={exportRecipe}
        importFileRef={importFileRef}
        importRecipe={importRecipe}
        setStoppedManually={setStoppedManually}
        stop={stop}
      />

      <MessageImportRecette message={importMsg} />

      <ProgressionRecherche
        status={status}
        progress={progress}
        refusal={refusal}
        compteAffiche={compteAffiche}
      />

      {/* ⚠️ S'affiche AUSSI pendant la phase d'appariement, dès qu'au moins
          un candidat est trouvé (`sortedCandidates` vient alors de l'aperçu
          EN DIRECT de `progress`, pas de `result` — voir `candidatesSource`
          ci-dessus) : voir des builds apparaître au fur et à mesure plutôt
          que d'attendre l'épuisement complet de l'espace de recherche.
          `result === null` tant que rien n'est trouvé : rien à montrer de
          plus utile que les barres de progression déjà affichées. */}
      {blocResultats}
    </div>
    )}
    {/* ⚠️ Rendues HORS de la page (et de la grille de réglages, dont un
        enfant direct compterait comme une cellule) : elles n'ont aucune place
        à prendre dans le flux — c'est tout leur objet. */}
    {modaleDegats}
    {fenetresListes}
    </>
  );
}
