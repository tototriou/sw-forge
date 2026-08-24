import { Fragment, useMemo, useRef, useState, useEffect } from 'react';
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
  Ban,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import { ArtifactDetail, ARTIFACT_KINDS, GearSet, RECO_STATS, RuneDetail, Monster, RtaEntry, SiegeTeam } from '../../types';
import { BoxItem } from '../../lib/applyAccount';
import { ARTIFACT_MAIN, CAPPED_STATS, RUNE_EFFECT, StatKey, runeEfficiency } from '../../lib/effects';
import {
  BuildRequirement,
  SLOT_MAIN_OPTIONS,
  estimateSearchSpace,
  diagnoseFeasibility,
  StatFeasibility,
  rankBlockingConditions,
  BlockingConditionsDiagnosis,
  statTotal,
  objectiveScore,
  candidateMetricTotal,
  OBJECTIVE_LABELS,
  RealDamageContext,
  SLOT_FILTER_PRESETS,
  ARTIFACT_MAIN_VALUE,
  ARTIFACT_MAIN_OPTIONS,
} from '../../lib/runeBuildOptim';
import { DetailMonstre, chargerDetail } from '../../lib/monsterSkills';
import {
  DEFAULT_DAMAGE_SETUP,
  computeSkillDamage,
  damageRelevantStats,
  monsterDamageSkills,
  resolveDamageSkill,
} from '../../lib/damage';
import {
  AUTO_EXCLUSION_SCOPES,
  AutoExclusionScope,
  ExclusionCandidate,
  ExclusionSelector,
  ExclusionSource,
  ExclusionSourceData,
  SOURCE_OPTIONS,
  autoExcludedRuneIds,
  exclusionCandidatesFor,
  exclusionSelectorKey,
  resolveExcludedRuneIds,
  resolveExclusionEntry,
} from '../../lib/optimizerExclusion';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../../lib/optimizerRecipe';
import { ArtifactMainChoice, OptimizerState, OptimizerSortKey } from '../../hooks/useOptimizerState';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import { useMediaQuery, SOUS_SM } from '../../hooks/useMediaQuery';
import GameIcon from '../GameIcon';
import MonsterAvatar from '../MonsterAvatar';
import MonsterGear from '../MonsterGear';
import { WHEEL_IMG } from '../RuneWheel';
import Segmented from '../../ui/Segmented';
import HelpPopover from '../HelpPopover';
import {
  Bouton,
  BoutonIcone,
  Champ,
  Interrupteur,
  MobileSheet,
  NumberField,
  Option,
  Pastille,
  Selecteur,
  ZoneCliquable,
} from '../../ui';
import MonsterGearPicker, { GearedMonster } from './MonsterGearPicker';
import RuneExclusionPicker from './RuneExclusionPicker';
import SetComboPicker from './SetComboPicker';
import BuildCandidateCard from './BuildCandidateCard';
import DamageSetupCard from './DamageSetupCard';

interface Props {
  box: BoxItem[];
  runes: RuneDetail[];
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
  // Panneau d'actions mobile « Options » — piloté par le bouton de la barre
  // de nav (voir App.tsx), même patron que RunesOptim.tsx. Réglages avancés
  // et Exclusion de runes y vivent au doigt ; en ligne (cartes) au bureau.
  menuOuvert: boolean;
  onFermerMenu: () => void;
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

// Équipement NUL, affiché tant qu'aucun monstre n'est choisi — demande
// explicite de l'utilisateur : la fiche (stats, artéfacts, roue, relique)
// reste TOUJOURS visible, vide plutôt qu'absente, pour que choisir un
// monstre ne fasse jamais apparaître un bloc entier là où il n'y avait rien
// (voir spec/shared/design.md, « un clic ne déplace jamais ce qu'on vient de
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

// Télécharge un texte en fichier (aucun envoi réseau) — même patron que
// RtaBackupBar.tsx.
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Outil « Optimizer » : cherche, parmi les runes du compte, la (les)
// meilleure(s) combinaison(s) de 6 pour un monstre, un combo de sets et des
// minimums de stats donnés. Voir spec/outils/optimizer/.
export default function OptimizerSection({ box, runes, optimizer, allMonsters, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, menuOuvert, onFermerMenu }: Props) {
  const metric = useRuneMetric();
  // ⚠️ Sous `sm`, les `Segmented` pleine largeur à libellés longs (l'objectif :
  // « PV effectifs ») débordent leur quart de rangée que `whitespace-nowrap`
  // interdit de couper. `dense` (texte réduit, retour à la ligne) est le
  // mécanisme prévu pour ça — activé seulement au format étroit, le bureau garde
  // le rendu normal.
  const etroit = useMediaQuery(SOUS_SM);
  const {
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
    openRuneKey,
    setOpenRuneKey,
    search,
    resetSearch,
  } = optimizer;
  const { status, result, progress, run, stop } = search;

  // TOUS les monstres 6★ de la box importée (avec ou sans runes actuellement
  // équipées — voir « Mon compte » → Monstres), dédupliqués par monstre : on
  // garde le meilleur exemplaire équipé pour les stats/artéfacts affichés —
  // voir spec/outils/optimizer/ pour cette simplification.
  // ⚠️ `gearedMonsters` ET la clé de box (`unitKey`) du meilleur exemplaire
  // PAR MONSTRE sont dérivés du MÊME passage sur `box` (un seul `score`, un
  // seul balayage) — auparavant deux calculs séparés (revue de code externe,
  // duplication) : `gearedMonsters` perdait `unitKey` en aplatissant vers
  // `GearedMonster` (le type partagé avec MonsterGearPicker.tsx, qui n'en a
  // pas besoin), obligeant `selectedUnitKey` à rebalayer `box` et
  // redéfinir SA PROPRE copie de `score` juste pour le retrouver.
  const { gearedMonsters, bestUnitKeyByMonsterId } = useMemo(() => {
    const best = new Map<string, BoxItem>();
    const score = (b: BoxItem) => (b.gear?.runes ?? []).reduce((s, r) => s + runeEfficiency(r), 0);
    for (const item of box) {
      if (!item.gear) continue;
      const id = String(item.monster.id);
      const prev = best.get(id);
      if (!prev || score(item) > score(prev)) best.set(id, item);
    }
    const gearedMonsters: GearedMonster[] = Array.from(best.values()).map((item) => ({ monster: item.monster, gear: item.gear! }));
    const bestUnitKeyByMonsterId = new Map<string, string>(Array.from(best, ([id, item]) => [id, item.key]));
    return { gearedMonsters, bestUnitKeyByMonsterId };
  }, [box]);

  // ⚠️ **Identité de l'ESPÈCE recherchée** — le champ de recherche du haut
  // (« Monstre à optimiser ») ne choisit QUE ça, jamais un exemplaire précis
  // (voir `speciesSelected` : toujours le meilleur exemplaire box, comme
  // avant). L'exemplaire RÉELLEMENT optimisé (`selected`, plus bas) peut
  // provenir d'une AUTRE source — voir le sélecteur de runage.
  const speciesSelected = gearedMonsters.find((g) => String(g.monster.id) === selectedId) ?? null;

  // ── Objectif « Dégâts réels » ────────────────────────────────────────
  // Fiche de compétences du monstre choisi. ⚠️ Chargée pour TOUT monstre
  // sélectionné, pas seulement quand l'objectif est « Dégâts réels » : sans
  // ça, choisir l'objectif afficherait un panneau vide le temps d'un
  // aller-retour réseau, juste après le clic. `chargerDetail` met en cache
  // (y compris les absences), donc ce préchargement ne coûte rien à la
  // seconde visite.
  const [skillDetail, setSkillDetail] = useState<DetailMonstre | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const selectedCom2usId = speciesSelected?.monster.com2usId ?? null;
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
  // Le sort RÉELLEMENT retenu — `resolveDamageSkill` est la source unique de
  // cette résolution, partagée avec la relecture d'une recette en ligne de
  // commande (scripts/lib/recipeToSearchParams.ts).
  const resolvedSkill = useMemo(
    () => resolveDamageSkill(damageSkills, damageSetup.skillCom2usId),
    [damageSkills, damageSetup.skillCom2usId]
  );
  // Stats que le pré-filtrage doit privilégier — `undefined` hors de cet
  // objectif, auquel cas le moteur retombe sur `OBJECTIVE_RELEVANT_STATS`
  // (comportement strictement inchangé pour les cinq autres objectifs).
  const objectiveStats = useMemo(
    () => (objective === 'degats_reels' ? damageRelevantStats(resolvedSkill) : undefined),
    [objective, resolvedSkill]
  );
  // Contexte de score, exigé par `objectiveScore` pour cet objectif — `null`
  // si aucun sort n'est calculable, auquel cas l'écran ne propose jamais le
  // tri « Dégâts réels » (voir `sortOptions`).
  const realDamage = useMemo<RealDamageContext | null>(
    () => (resolvedSkill ? { profile: resolvedSkill, setup: damageSetup, element: speciesSelected?.monster.element ?? null } : null),
    [resolvedSkill, damageSetup, speciesSelected?.monster.element]
  );

  // Statistiques principales autorisées sur les slots 2/4/6 — vide = libre.
  // Voir spec/outils/optimizer/ : pour un Lushen, ATQ% en 2, Dmg Crit en 4,
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
  // voir « Validation grandeur nature ») ne doit pas être coupée avant
  // d'avoir eu sa chance d'aboutir.
  const HARD_TIMEOUT_MS = 10 * 60 * 1000;

  const runeById = useMemo(() => new Map(runes.map((r) => [r.id, r])), [runes]);

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
  // sur la box. Voir spec/outils/optimizer/ « Suite — case cochée par
  // défaut » pour l'historique de la case d'origine.
  // Indexé par `String(monster.id)` — même clé que `RtaEntry.monsterId`/
  // `SiegeSlot.monsterId` (voir applyAccount.ts). Recalculé seulement si la
  // liste de monstres change, pas à chaque rendu.
  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of allMonsters) m.set(String(mon.id), mon);
    return m;
  }, [allMonsters]);

  const exclusionData = useMemo<ExclusionSourceData>(
    () => ({ box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, monsterById }),
    [box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, monsterById]
  );

  // Quel EXEMPLAIRE du monstre recherché optimiser — box (défaut), RTA, ou
  // un deck de siège. ⚠️ **N'affecte QUE l'équipement** (`gear` : base,
  // runes, artéfacts, relique) : l'espèce elle-même (`speciesSelected.
  // monster`) reste celle choisie par la recherche du haut, quel que soit
  // l'onglet — changer de source ne permet pas de changer de monstre, ça
  // choisit lequel de SES exemplaires optimiser. État LOCAL (pas dans
  // `useOptimizerState`) : même statut que `resultsPage` (voir son
  // commentaire dans useOptimizerState.ts), donc hors recette exportée/
  // scripts CLI pour l'instant (limite connue, voir spec).
  const [gearSource, setGearSource] = useState<ExclusionSource>('box');
  // ⚠️ Choix EXPLICITE de l'utilisateur parmi `sourceCandidates` (plus bas) —
  // jamais un « meilleur exemplaire » deviné en silence (une tentative
  // précédente choisissait celui à la plus haute efficience de runes ;
  // explicitement écartée : l'utilisateur veut CHOISIR, pas se voir imposer
  // un choix).
  const [sourceSelector, setSourceSelector] = useState<ExclusionSelector | null>(null);
  // Réinitialisés à « Box » / vide sur un changement de monstre : un
  // exemplaire RTA/siège du monstre PRÉCÉDENT n'a aucun sens pour le nouveau.
  useEffect(() => {
    setGearSource('box');
    setSourceSelector(null);
  }, [selectedId]);

  // Exemplaires du monstre recherché disponibles dans la source choisie —
  // même fonction que « Exclure les runes d'un monstre » (`exclusionCandidatesFor`,
  // AUCUNE exclusion de soi ici : c'est justement lui qu'on veut lister),
  // filtrée à la SEULE espèce recherchée. Pour le siège, `teamContext`
  // affiche l'équipe complète — demande explicite (« afficher les équipes
  // pour pouvoir sélectionner le bon exemplaire »).
  const sourceCandidates = useMemo<ExclusionCandidate[]>(() => {
    if (gearSource === 'box' || !speciesSelected || speciesSelected.monster.com2usId == null) return [];
    const com2usId = speciesSelected.monster.com2usId;
    return exclusionCandidatesFor(gearSource, exclusionData, null, null).filter((c) => c.monster.com2usId === com2usId);
  }, [gearSource, speciesSelected, exclusionData]);

  // Un seul exemplaire possible : le retenir directement, sans exiger un
  // clic pour une « liste » à une seule entrée — mais il reste affiché (voir
  // le rendu plus bas), donc toujours visible QUELLE source a été retenue.
  // ⚠️ `sourceCandidates` est un `useMemo` stable (ne change de RÉFÉRENCE que
  // si ses dépendances changent réellement) : cet effet ne boucle pas.
  useEffect(() => {
    if (gearSource === 'box') return;
    if (sourceCandidates.length === 1) {
      setSourceSelector(sourceCandidates[0].selector);
      return;
    }
    // Le sélecteur retenu n'existe plus dans cette liste (changement de
    // source, ou de compte) — plutôt que de garder un choix caduc.
    setSourceSelector((prev) => (prev && sourceCandidates.some((c) => exclusionSelectorKey(c.selector) === exclusionSelectorKey(prev)) ? prev : null));
  }, [gearSource, sourceCandidates]);

  // L'exemplaire RÉELLEMENT optimisé : box (le build de base, comme avant)
  // ou l'entrée choisie ci-dessus. ⚠️ Monstre SANS exemplaire dans la source
  // choisie (aucun candidat, ou aucun encore cliqué parmi plusieurs) →
  // équipement VIDE plutôt que de retomber sur box en silence — même
  // traitement qu'un monstre nu, déjà pris en charge partout ailleurs dans
  // l'app (« un monstre nu se recherche tout aussi bien »).
  const selected = useMemo(() => {
    if (!speciesSelected) return null;
    if (gearSource === 'box') return speciesSelected;
    const gear = sourceSelector ? (resolveExclusionEntry(sourceSelector, exclusionData)?.gear ?? EMPTY_GEAR) : EMPTY_GEAR;
    return { monster: speciesSelected.monster, gear };
  }, [speciesSelected, gearSource, sourceSelector, exclusionData]);
  const gearSourceEmpty = gearSource !== 'box' && !!speciesSelected && selected!.gear.runes.length === 0;

  // `unitKey` (box) de l'entrée à protéger contre sa propre exclusion —
  // UNIQUEMENT quand c'est ELLE qui est optimisée (`gearSource === 'box'`).
  // ⚠️ Quand la source est RTA/siège, le build BOX de cette même espèce
  // n'est PLUS l'exemplaire optimisé : c'est alors une entrée comme une
  // autre, légitimement excluable — la protéger aurait empêché de l'exclure
  // à tort. La protection de l'exemplaire RTA/siège réellement optimisé,
  // elle, passe par `ownCom2usId` (species-level, déjà correct dans
  // `resolveExcludedRuneIds`/`autoExcludedRuneIds` pour CE cas précis, voir
  // leurs propres commentaires).
  const selectedUnitKey =
    gearSource === 'box' && speciesSelected ? (bestUnitKeyByMonsterId.get(String(speciesSelected.monster.id)) ?? null) : null;

  const pool = useMemo(() => {
    if (!selected) return runes;
    // Se SUPERPOSENT, ne se remplacent pas : `excludeUsedRunes` l'exclusion
    // automatique (un périmètre entier, RTA/Défenses siège/Box),
    // `excludedSelectors` l'exclusion manuelle en plus (entrée par entrée,
    // n'importe laquelle des 4 sources) — voir optimizerExclusion.ts.
    const auto = excludeUsedRunes
      ? autoExcludedRuneIds(excludeUsedScope, exclusionData, selected.monster.com2usId)
      : new Set<number>();
    const manual = resolveExcludedRuneIds(excludedSelectors, exclusionData, selectedUnitKey, selected.monster.com2usId);
    if (auto.size === 0 && manual.size === 0) return runes;
    return runes.filter((r) => !auto.has(r.id) && !manual.has(r.id));
  }, [selected, selectedUnitKey, excludeUsedRunes, excludeUsedScope, excludedSelectors, exclusionData, runes]);

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
  // deuxième revue de code externe (2026-08-19) a trouvé cette version
  // précédente : `SiegeTeam.id` peut retomber sur `t_${Date.now()}_
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
  // jamais modifiée par ces réglages). `ignoreArtifacts` coché = aucun
  // artéfact compté. Sinon, chaque emplacement (Attribut/Type, voir
  // ARTIFACT_KINDS) suit son propre choix : `'equipped'` (défaut) reprend
  // l'artéfact réellement porté à cet emplacement DU BUILD DE BASE —
  // comportement historique inchangé tant que rien n'est touché — un code
  // de stat HYPOTHÈQUE un artéfact différent (même sans le posséder),
  // `'none'` retire cet emplacement même s'il est réellement équipé.
  // ⚠️ **`selected.gear` est TOUJOURS le build de base** (voir
  // `gearedMonsters`, dérivé de `box`) — jamais celui de RTA ni d'un deck de
  // siège, qui peuvent porter des artéfacts DIFFÉRENTS pour le MÊME monstre
  // (presets de runage/artéfacts séparés, pas une seule vérité par monstre).
  // `'equipped'` par défaut est donc une hypothèse implicite (« le build de
  // base »), pas une garantie que ça matche le build qu'un joueur cherche
  // réellement à reproduire — d'où l'intérêt des deux autres choix pour
  // hypothéquer un artéfact différent sans avoir à changer de monstre.
  const searchArtifacts = useMemo<ArtifactDetail[]>(() => {
    if (!selected || ignoreArtifacts) return [];
    const out: ArtifactDetail[] = [];
    for (const { key } of ARTIFACT_KINDS) {
      const choice = artifactMainByKind[key] ?? 'equipped';
      if (choice === 'none') continue;
      if (choice === 'equipped') {
        const real = selected.gear.artifacts.find((a) => a.kind === key);
        if (real) out.push(real);
        continue;
      }
      out.push({ kind: key, level: 1, rarity: 5, main: { code: choice, value: ARTIFACT_MAIN_VALUE[choice] }, subs: [] });
    }
    return out;
  }, [selected, ignoreArtifacts, artifactMainByKind]);

  // Ce que le moteur reçoit réellement — partagé entre la recherche et
  // l'estimation affichée avant de lancer quoi que ce soit (voir plus bas) :
  // les deux doivent voir EXACTEMENT la même exigence.
  const requirement = useMemo<BuildRequirement>(() => {
    const mainStatsReq: NonNullable<BuildRequirement['mainStats']> = {};
    for (const slot of CONFIGURABLE_SLOTS) {
      const codes = mainStatsBySlot[slot];
      if (codes && codes.length > 0) mainStatsReq[slot] = codes;
    }
    return { sets: comboSets, minStats, maxStats, mainStats: mainStatsReq };
  }, [comboSets, minStats, maxStats, mainStatsBySlot]);

  // Indication du nombre de builds qui vont être testés — un ORDRE DE
  // GRANDEUR (le produit des pools filtrés par emplacement), pas le nombre
  // réellement exploré : le meet-in-the-middle n'énumère jamais ce produit en
  // entier. Utile pour juger si les critères actuels sont trop larges ou trop
  // stricts avant d'attendre un résultat.
  const estimate = useMemo(() => {
    if (!selected || comboSets.length === 0) return null;
    return estimateSearchSpace(pool, requirement, selected.gear.base, slotFilterCap, objective, objectiveStats);
  }, [selected, comboSets, pool, requirement, slotFilterCap, objective, objectiveStats]);

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
    return diagnoseFeasibility({ base: selected.gear.base, artifacts: searchArtifacts, relic: selected.gear.relic, pool, requirement, metric });
  }, [selected, searchArtifacts, pool, requirement, metric]);
  const impossibleFeasibility = useMemo(() => feasibilityDiagnosis.filter((f) => !f.satisfiable), [feasibilityDiagnosis]);

  // Palier 2 (voir `rankBlockingConditions` dans runeBuildOptim.ts) — bien
  // plus coûteux que le palier 1 ci-dessus (N passes de pré-filtrage, N =
  // nombre de conditions posées, contre une seule) : calculé UNIQUEMENT
  // quand il sera réellement affiché — activé (`diagnoseBlockingEnabled`,
  // « Réglages avancés ») ET une recherche vient de renvoyer 0 résultat —
  // jamais à chaque frappe comme le palier 1.
  const blockingDiagnosis = useMemo<BlockingConditionsDiagnosis | null>(() => {
    if (!selected || !diagnoseBlockingEnabled) return null;
    if (!result || result.candidates.length > 0) return null;
    return rankBlockingConditions({ base: selected.gear.base, artifacts: searchArtifacts, relic: selected.gear.relic, pool, requirement, metric });
  }, [selected, diagnoseBlockingEnabled, result, searchArtifacts, pool, requirement, metric]);

  // `adaptiveTrancheWeighting` (toggle « Prioriser les stats les plus
  // difficiles », voir SearchParams dans runeBuildOptim.ts) — réalloue le
  // budget de rétention par tranche entre les stats demandées selon leur
  // dispersion mesurée, au lieu d'un plafond uniforme. Désactivé (défaut) :
  // comportement historique inchangé, coût nul (vérifié par mesure — voir
  // spec/outils/optimizer/, « Suite — piste B gatée derrière un
  // paramètre »). Activé : recherche plus longue (+20 % de temps de
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
    setSortBy(objective);
    setResultsPage(1);
    run({
      base: selected.gear.base,
      artifacts: searchArtifacts,
      relic: selected.gear.relic,
      pool,
      requirement,
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
      requirement,
      objective,
      damageSetup,
      metric,
      slotFilterPreset,
      adaptiveTrancheWeighting,
      exhaustiveSearch,
      excludeUsedRunes,
      excludeUsedScope,
      excludedSelectors,
      ignoreArtifacts,
      artifactMainByKind,
    });
    const jour = new Date().toISOString().slice(0, 10);
    const DIACRITICS = new RegExp('[̀-ͯ]', 'g');
    const slug = selected.monster.name.toLowerCase().normalize('NFD').replace(DIACRITICS, '').replace(/[^a-z0-9]+/g, '-');
    download(`swforge-optimizer-${slug}-${jour}.json`, JSON.stringify(recipe, null, 2));
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
  const [importMsg, setImportMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), importMsg.error ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [importMsg]);

  function importRecipe(file: File) {
    file.text().then((text) => {
      const { recipe, error } = parseOptimizerRecipe(text);
      if (!recipe) {
        setImportMsg({ text: `Import refusé : ${error}`, error: true });
        return;
      }
      setComboSets(recipe.requirement.sets);
      setMinStats(recipe.requirement.minStats);
      setMaxStats(recipe.requirement.maxStats ?? {});
      setMainStatsBySlot(recipe.requirement.mainStats ?? {});
      // ⚠️ Repli sur l'objectif « Dégâts » : `speed_nuker` a été RETIRÉ
      // (branche forge/calcul-degats-reels), remplacé par « Dégâts réels ».
      // Une recette exportée pendant sa courte durée de vie (v1.8.1) porte
      // encore cette valeur — `parseOptimizerRecipe` ne valide pas
      // `objective` contre le type, donc sans ce repli l'état affiché
      // porterait une valeur qu'aucun bouton ne peut représenter. « Dégâts »
      // est le choix le plus proche : c'est la formule que `speed_nuker`
      // réutilisait déjà lui-même au tri (voir historique).
      const legacyObjective = recipe.objective as unknown as string;
      setObjective(legacyObjective === 'speed_nuker' ? 'degats' : recipe.objective);
      // ⚠️ `?? DEFAULT_DAMAGE_SETUP` : une recette exportée AVANT ce champ n'a
      // pas de `damageSetup`. Le `skillCom2usId` qu'elle porte, lui, peut
      // désigner un sort d'un AUTRE monstre que celui de cette box — c'est
      // `resolveDamageSkill` qui retombe alors sur le sort par défaut, pas
      // une erreur d'import (même tolérance que le monstre lui-même, plus bas).
      setDamageSetup(recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP);
      setSlotFilterPreset(recipe.slotFilterPreset);
      setAdaptiveTrancheWeighting(recipe.adaptiveTrancheWeighting);
      // ⚠️ `?? false` : une recette exportée AVANT ce réglage ne porte pas ce
      // champ (`undefined`) — repli sur le défaut plutôt que de propager une
      // valeur non booléenne à l'état.
      setExhaustiveSearch(recipe.exhaustiveSearch ?? false);
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
      setIgnoreArtifacts(recipe.ignoreArtifacts);
      setArtifactMainByKind(recipe.artifactMainByKind);

      const match = gearedMonsters.find((g) => g.monster.com2usId === recipe.monsterCom2usId);
      if (match) {
        setSelectedId(String(match.monster.id));
        setImportMsg({ text: `Réglages importés pour ${recipe.monsterName} — monstre sélectionné automatiquement.` });
      } else {
        setImportMsg({
          text: `Réglages importés (${recipe.monsterName}), mais ce monstre n'est pas dans ta box — choisis-en un manuellement.`,
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
  const fullSortedCandidates = useMemo(() => {
    if (!candidatesSource) return [];
    const list = candidatesSource.slice();
    if (sortBy === 'efficience') {
      // ⚠️ PAS `objectiveScore`/`effTotal` ici : ce champ est figé dans la
      // mesure active AU MOMENT DE LA RECHERCHE, et deviendrait incohérent
      // avec le popover d'une rune (recalculé en direct) si l'utilisateur
      // bascule Efficience ↔ Score après coup sans relancer.
      list.sort((a, b) => candidateMetricTotal(b, runeById, metric) - candidateMetricTotal(a, runeById, metric));
    } else if (sortBy === 'degats_reels') {
      // ⚠️ `realDamage` peut être `null` (aucun sort calculable pour ce
      // monstre) : ce tri n'est alors même pas proposé (voir `sortOptions`),
      // mais un `sortBy` hérité d'un monstre précédent pourrait encore le
      // porter — on laisse l'ordre en place plutôt que de lever.
      if (realDamage) {
        list.sort((a, b) => objectiveScore(b, sortBy, realDamage) - objectiveScore(a, sortBy, realDamage));
      }
    } else if (sortBy === 'degats' || sortBy === 'ehp' || sortBy === 'vitesse') {
      list.sort((a, b) => objectiveScore(b, sortBy) - objectiveScore(a, sortBy));
    } else {
      list.sort((a, b) => statTotal(b.stats, sortBy) - statTotal(a.stats, sortBy));
    }
    return list;
  }, [candidatesSource, sortBy, runeById, metric, realDamage]);

  const RESULTS_PAGE_SIZE = 20;
  const totalResultsPages = Math.max(1, Math.ceil(fullSortedCandidates.length / RESULTS_PAGE_SIZE));

  // ⚠️ CORRIGE la page courante, ne la remet PAS à 1 : un aperçu EN DIRECT
  // (pendant la phase d'appariement) grandit au fil de la recherche sans
  // que ce soit une NOUVELLE recherche — recommencer à la page 1 à chaque
  // candidat qui arrive rendrait la pagination inutilisable pendant qu'une
  // recherche tourne. Seuls `handleSearch` (nouvelle recherche) et le choix
  // de tri (classement entièrement différent) remettent explicitement à 1.
  useEffect(() => {
    setResultsPage((p) => Math.min(Math.max(p, 1), totalResultsPages));
  }, [totalResultsPages, setResultsPage]);

  const pageCandidates = useMemo(
    () => fullSortedCandidates.slice((resultsPage - 1) * RESULTS_PAGE_SIZE, resultsPage * RESULTS_PAGE_SIZE),
    [fullSortedCandidates, resultsPage]
  );

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

  // Contribution des artéfacts EFFECTIVEMENT comptés (voir searchArtifacts)
  // à une stat donnée — 0 si `ignoreArtifacts` ou si aucun artéfact n'est
  // supposé sur cette stat. Sert de PLANCHER pour les conditions ci-dessous :
  // avec zéro rune, un monstre a déjà AU MOINS ce bonus en jeu (voir
  // `baseOf`) — le champ ne doit jamais laisser demander moins. N'affecte
  // que PV/ATQ/DEF (ARTIFACT_MAIN ne couvre que ces trois stats — VIT/TC/
  // DCC/RES/Précision ne reçoivent jamais rien d'un artéfact).
  function artifactBonusOf(key: StatKey): number {
    return searchArtifacts.reduce((sum, a) => {
      const def = ARTIFACT_MAIN[a.main.code];
      return def?.stat === key ? sum + a.main.value : sum;
    }, 0);
  }

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
          réglages (Monstre, Exclusion/Réglages avancés, Critères,
          Objectif) ────────────────────────────────────────────────────
          ⚠️ **Placement EXPLICITE (`col-start`/`row-start`/`row-span`) sur
          CHAQUE bloc** — l'ordre du DOM peut alors rester celui de l'ordre
          d'USAGE (1. monstre, 2. objectif, 3. critères, puis
          optionnellement exclusion/réglages avancés) SANS dicter l'ordre
          VISUEL au bureau, qui suit une logique de PAIRES : Monstre à côté
          d'Exclusion/Réglages avancés (rangées 1-2), Critères à côté
          d'Objectif (rangée 3). Sous `xl`, une seule colonne : ces classes
          ne s'appliquent plus, l'ordre du DOM (= l'ordre d'usage) devient
          l'ordre de lecture.
          ⚠️ `items-start` : sans lui, chaque bloc s'étire à la hauteur de sa
          rangée et les cartes courtes se retrouvent avec un grand vide
          bordé. */}
      <div className="grid gap-5 items-start xl:grid-cols-[minmax(480px,560px)_1fr]">
      {/* Étape 1 — carte À PART, en tête du DOM. ⚠️ **La fiche reste
          TOUJOURS affichée, vide (`EMPTY_GEAR`) tant qu'aucun monstre n'est
          choisi**, plutôt que de n'apparaître qu'au clic : l'espace qu'elle
          occupe est réservé d'avance (voir spec/shared/design.md).
          `row-span-2` : occupe les DEUX rangées où « Exclusion de runes »
          puis « Réglages avancés » s'empilent à sa droite. */}
      <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-1 xl:row-start-1 xl:row-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
              <GameIcon name="monster" size={15} />
            </div>
            <p className="text-[13.5px] font-bold text-ink">Monstre &amp; équipement</p>
          </div>
          {/* ⚠️ Choix de l'EXEMPLAIRE optimisé — box/RTA/Défenses siège/
              Offenses siège, EXACTEMENT le même sélecteur (mêmes 4 options,
              même composant) que la source d'« Exclure les runes d'un
              monstre » plus bas — `SOURCE_OPTIONS`, remonté dans
              optimizerExclusion.ts pour ne pas dupliquer ces 4 libellés.
              ⚠️ Change RÉELLEMENT ce que la recherche optimise (voir
              `selected`, plus haut dans le fichier) — PAS une simple
              prévisualisation. */}
          <Segmented options={SOURCE_OPTIONS} value={gearSource} onChange={setGearSource} dense />
        </div>
        {/* ⚠️ Liste des EXEMPLAIRES de l'espèce recherchée dans la source
            choisie — même comportement que « Exclure les runes d'un monstre »
            (demande explicite) : un choix EXPLICITE, jamais deviné en
            silence, avec l'équipe complète affichée pour le siège (un même
            monstre peut apparaître dans plusieurs équipes, indiscernables
            par le seul nom). Affichée même à UN SEUL candidat (auto-retenu,
            voir l'effet plus haut) : on voit toujours QUELLE entrée a été
            choisie. */}
        {gearSource !== 'box' && sourceCandidates.length > 0 && (
          <div className="mb-3 flex flex-col gap-1.5">
            {sourceCandidates.map((c) => {
              const key = exclusionSelectorKey(c.selector);
              const actif = !!sourceSelector && exclusionSelectorKey(sourceSelector) === key;
              return (
                <Option
                  key={key}
                  actif={actif}
                  onClick={() => setSourceSelector(c.selector)}
                  icone={<MonsterAvatar monster={c.monster} size={28} />}
                  titre={c.teamContext ? `Équipe ${c.teamContext.teamNumber}` : c.monster.name}
                  description={
                    c.teamContext
                      ? c.teamContext.slots.map((m) => m?.name ?? '—').join(' · ')
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          {/* ⚠️ `lg:w-56 flex-none` : une largeur FIXE, pas `flex-1` — sans
              ça, sur un très grand écran, le champ de recherche s'étirerait
              autant que la fiche d'équipement à côté, alors que son contenu
              (un mot, quelques suggestions) n'a besoin que d'une largeur de
              champ ordinaire. */}
          <div className="lg:w-56 lg:flex-none">
            <p className="label mb-1.5">Monstre à optimiser</p>
            {/* ⚠️ Réinitialise « Critères de recherche » et « Combinaisons
                trouvées » (`resetSearch`, voir useOptimizerState.ts) AVANT de
                changer de monstre — sinon des critères/résultats posés pour
                l'ANCIEN monstre resteraient affichés comme s'ils valaient pour
                le nouveau. Garde `id !== selectedId` : re-cliquer le monstre
                déjà sélectionné ne doit rien effacer, ce n'est pas un
                changement. Uniquement dans CE picker, pas dans `setSelectedId`
                lui-même — l'import d'une recette (plus bas) l'appelle aussi
                mais pose ses PROPRES critères juste avant : les effacer
                ensuite les perdrait aussitôt. ⚠️ Choisit l'ESPÈCE seulement
                (toujours son meilleur exemplaire box) — voir le sélecteur de
                source ci-dessus pour choisir un autre exemplaire. */}
            <MonsterGearPicker
              items={gearedMonsters}
              onPick={(id) => {
                if (id !== selectedId) resetSearch();
                setSelectedId(id);
              }}
            />
            {selected && (
              <div className="mt-3 flex items-center gap-2">
                <MonsterAvatar monster={selected.monster} size={32} />
                <span className="font-semibold text-[14px]">{selected.monster.name}</span>
              </div>
            )}
            {gearSourceEmpty && (
              <p className="mt-2 text-micro text-ink-dim">
                {selected!.monster.name} n&apos;a pas de runage dans cette source — rien à optimiser.
              </p>
            )}
          </div>

          {/* ⚠️ Même composant que RTA/Siège quand on clique un monstre — pas
              une réimplémentation : stats base/bonus, artéfacts, roue de
              runes et relique, chacun cliquable pour son détail complet
              (RuneDetailBox/ArtifactDetailBox/RelicDetailBox), inline sous
              la roue. `scale` : artéfacts et roue COMPACTÉS (demande
              explicite) — pour que la carte reste raisonnable une fois
              « Exclusion de runes » installée à sa droite. `StatPanel`, lui,
              garde sa largeur fixe (voir le commentaire de `scale` sur
              `MonsterGear.tsx`). `flex-1` : occupe tout l'espace restant à
              droite de la recherche. */}
          <div className="rounded-xl border border-border-soft bg-panel2/60 p-3 lg:flex-1">
            <MonsterGear gear={selected?.gear ?? EMPTY_GEAR} scale={0.65} />
          </div>
        </div>
      </div>

      {/* Étape 3 — carte compactée AU MAXIMUM (`w-fit`, voir plus bas) pour
          laisser de la place visuelle à « Objectif de recherche » à sa
          droite — demande explicite. `xl:row-start-3` : troisième rangée de
          la grille, sous le duo Monstre/Exclusion+Réglages avancés
          (rangées 1-2). */}
      <div className="w-fit rounded-xl border border-border bg-panel p-3 xl:col-start-1 xl:row-start-3">
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
        {/* ⚠️ `space-y-4` restaure l'espacement entre blocs (Set/Statistique
            principale/Artéfacts/Conditions) — ces blocs comptaient sur le
            `space-y-5` du CONTENEUR DE PAGE avant leur regroupement dans
            cette carte ; devenus des enfants directs de la carte, ils en
            ont hérité aucun espacement propre sans ce wrapper. */}
        <div className="space-y-4">
      {/* ⚠️ `max-w-md` EN PLUS du `w-fit` de la carte (ceinture et
          bretelles) : `fit-content` se laisse pousser jusqu'à la largeur
          disponible de la piste de grille (480-560px) si le contenu peut la
          remplir sans repasser à la ligne — ce plafond garantit que le set
          reste compact même dans ce cas. */}
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
          }}
        />
        {setPickerInvalid && (
          <p className="mt-1.5 text-micro font-semibold text-bad">
            Sélectionne au moins un set avant de lancer la recherche.
          </p>
        )}
      </div>

      <div>
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

      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <p className="label">Artéfacts</p>
            <HelpPopover title="Artéfacts">
              <b className="text-ink">« Comme équipé »</b> reprend l'artéfact du build de base (celui affiché
              ci-dessus) porté à cet emplacement. Choisir une statistique l'hypothèque pour la recherche sans avoir
              besoin de le posséder — utile si ce monstre porte des artéfacts différents en RTA ou dans un deck de
              siège, puisque ce build de base n'est pas forcément celui que tu cherches à reproduire ;{' '}
              <b className="text-ink">« Aucun »</b> retire l'emplacement même s'il est réellement équipé.
            </HelpPopover>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-dim">Ignorer les statistiques des artéfacts</span>
            <HelpPopover title="Ignorer les statistiques des artéfacts">
              Activé, la recherche ne compte <b className="text-ink">aucune</b> statistique d'artéfact (comme si le
              monstre n'en portait pas). Désactivé, choisis la statistique principale à supposer pour chaque
              emplacement ci-dessous.
            </HelpPopover>
            <Interrupteur
              actif={ignoreArtifacts}
              onChange={setIgnoreArtifacts}
              aria-label="Ignorer les statistiques des artéfacts"
            />
          </div>
        </div>
        {!ignoreArtifacts && (
          <div className="flex flex-wrap gap-3">
            {ARTIFACT_KINDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-xs text-ink w-14">{label}</span>
                <Selecteur
                  value={String(artifactMainByKind[key] ?? 'equipped')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next: ArtifactMainChoice = raw === 'equipped' || raw === 'none' ? raw : (Number(raw) as 100 | 101 | 102);
                    setArtifactMainByKind((prev) => ({ ...prev, [key]: next }));
                  }}
                  taille="sm"
                  surface="panel2"
                  pleineLargeur={false}
                >
                  <option value="equipped">Comme équipé</option>
                  {ARTIFACT_MAIN_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                  <option value="none">Aucun</option>
                </Selecteur>
              </div>
            ))}
          </div>
        )}
      </div>

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
            const artBonus = artifactBonusOf(st.key);
            const capped = CAPPED_100.has(st.key);
            const bonusMode = affectedByToggle && excludeBase;
            const ceiling = capped ? (bonusMode ? 100 - base : 100) : undefined;
            // ⚠️ Plancher affiché/autorisé, PAS la même chose que `base` (qui
            // sert à la conversion affichage↔stockage, voir `baseOf`) : avec
            // zéro rune, un monstre a déjà AU MOINS ce bonus/total en jeu
            // (base nue + artéfacts éventuellement comptés) — voir
            // `artifactBonusOf`. En mode bonus, seul l'artéfact compte (la
            // base nue est déjà soustraite par la conversion elle-même) ; en
            // mode total, base ET artéfact s'additionnent.
            const floor = bonusMode ? artBonus : base + artBonus;

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

      {/* Étape 2 de l'ordre d'usage voulu — une carte À PART, PAS un bloc
          DANS « Critères de recherche » : l'objectif se choisit avant même
          de composer le set recherché, ce n'est pas un critère de plus
          parmi d'autres. Placée en TROISIÈME rangée (aux côtés de « Critères
          de recherche », compactée juste au-dessus) : demande explicite —
          « à droite des critères de recherche ». `1fr`, colonne large :
          contrairement à Critères (compactée au maximum), Objectif profite
          de tout l'espace restant — utile une fois « Dégâts réels » choisi
          (`DamageSetupCard` a besoin de place pour ses vignettes d'effet). */}
      <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-accent/40 bg-accent-soft">
            <Target size={13} className="text-accent" />
          </div>
          <p className="text-[13.5px] font-bold text-ink">Objectif de recherche</p>
        </div>
        <div className="mb-2.5 flex items-center gap-1.5">
          <HelpPopover title="Objectif de recherche">
            Élargit la sélection de runes candidates pour ses stats dès le pré-filtrage, avant même de
            lancer la recherche — les minimums posés plus bas (Conditions) restent ce qui décide quels
            demi-builds sont conservés pendant la recherche elle-même. <b className="text-ink">Dégâts</b> considère{' '}
            <b className="text-ink">ATQ</b>, <b className="text-ink">Taux Crit</b> et{' '}
            <b className="text-ink">Dgts Crit</b> ensemble (espérance moyenne).{' '}
            <b className="text-ink">Dégâts réels</b> va plus loin : la vraie formule d&apos;un sort précis
            contre un adversaire configuré.
          </HelpPopover>
        </div>
        <Segmented options={OBJECTIVE_LABELS} value={objective} onChange={setObjective} size="lg" dense={etroit} />
        {/* ⚠️ Le réglage vit SOUS l'objectif qui l'active, pas dans une
            section séparée plus bas : c'est le choix « Dégâts réels » qui
            rend ces champs pertinents, et rien d'autre à l'écran ne les
            concerne. Un panneau permanent à moitié grisé aurait alourdi les
            cinq autres objectifs pour rien. */}
        {objective === 'degats_reels' && (
          <div className="mt-2.5">
            <DamageSetupCard
              skills={damageSkills}
              resolved={resolvedSkill}
              setup={damageSetup}
              setSetup={setDamageSetup}
              chargement={skillLoading}
              etroit={etroit}
            />
          </div>
        )}
      </div>

      {/* ── Réglages avancés + Exclusion de runes ──────────────────────
          Contenu factorisé une fois, affiché deux fois : en cartes en
          ligne au bureau (ordre : Exclusion de runes, puis Réglages
          avancés), dans le panneau « Options » au doigt — jamais dupliqué.
          Même patron que RunesOptim.tsx (voir MobileSheet plus bas).
          ⚠️ **Fragment, PAS un `<div>`** : les deux cartes desktop qu'il
          rend (Exclusion de runes, Réglages avancés) doivent devenir des
          ENFANTS DIRECTS de la grille pour se placer chacune dans sa propre
          rangée (`xl:row-start-1`/`xl:row-start-2`, à côté du duo
          Monstre/Critères) — un `<div>` intermédiaire les aurait fait
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
          <>
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

            {/* Toggle, même patron que « Prioriser les stats les plus
                difficiles » : désactivé par défaut, lu par `handleSearch` au
                clic sur « Rechercher », jamais un bouton qui lance sa propre
                recherche. */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
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

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
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
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
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
          </>
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
              <div className="relative flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
                <img src={WHEEL_IMG} alt="" className="h-4 w-4 object-contain" />
                <Ban size={20} strokeWidth={1.75} className="pointer-events-none absolute text-bad/85" />
              </div>
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
        // ⚠️ `dansPanneau` : dans le panneau resserré, les 4 onglets de
        // source (Box/RTA/Défenses siège/Offenses siège) restent sur UNE
        // seule ligne mais en texte/rembourrage réduits (voir
        // Segmented.tsx `dense`) — au bureau, la carte a la largeur pour le
        // rendu normal.
        const monstrePrecisBlock = (dansPanneau: boolean) => (
          <div>
            <div className="mb-2.5 flex items-center gap-1.5">
              {/* Même icône que « Monstre & équipement » (GameIcon
                  "monster"), barrée du symbole « interdit » — même
                  traitement que l'icône « Exclusion de runes » plus bas :
                  cette action RETIRE le monstre choisi du pool de runes. */}
              <div className="relative flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
                {/* ⚠️ L'artwork du monstre n'est pas parfaitement centré dans
                    son canevas — invisible seul, ça se voit à côté du cercle
                    « interdit », lui parfaitement centré par positionnement
                    absolu. Léger recalage manuel, propre à cet usage précis. */}
                <GameIcon name="monster" size={13} className="-translate-x-[1.5px]" />
                <Ban size={20} strokeWidth={1.75} className="pointer-events-none absolute text-bad/85" />
              </div>
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
              denseSourceTabs={dansPanneau}
            />
          </div>
        );

        // ⚠️ `dansPanneau` : dans le panneau, « Exclure les runes d'un
        // monstre » passe AU-DESSUS de « Exclure les runes déjà utilisées »
        // (demande explicite — c'est le réglage le plus utilisé au doigt),
        // et les deux restent EMPILÉS (jamais côte à côte, même sur un
        // panneau assez large pour `sm:` — la largeur calibrée de la
        // colonne de gauche, pensée pour la carte du bureau, ne vaudrait
        // plus rien ici). Au bureau, ordre et grille inchangés.
        const exclusionRunesInner = (dansPanneau: boolean) => (
          <>
            <p className="mb-3 pl-8 text-[11px] text-ink-dim">Deux réglages indépendants, qui se superposent.</p>

            {dansPanneau ? (
              // ⚠️ `space-y-4` (blocs) et non `flex flex-col` : sous
              // `[data-tiroir]`, `align-items: flex-start` raboterait ces deux
              // blocs — et donc leurs contrôles pleine largeur — à leur contenu.
              <div className="space-y-4">
                {monstrePrecisBlock(true)}
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
                {monstrePrecisBlock(false)}
              </div>
            )}
          </>
        );

        const exclusionRunesTitre = (
          <>
            {/* Icône « Runes » de Mon compte (même GameIcon que le menu),
                barrée du vrai symbole « interdit » (cercle barré, comme le
                curseur non-cliquable) plutôt qu'un simple trait — l'exclusion
                RETIRE des runes de la recherche. */}
            <div className="relative flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
              <GameIcon name="rune" size={13} />
              <Ban size={22} strokeWidth={1.75} className="pointer-events-none absolute text-bad/85" />
            </div>
            <p className="text-[13.5px] font-bold text-ink">Exclusion de runes</p>
          </>
        );

        return (
          <>
            {/* Bureau : deux cartes empilées à DROITE de « Monstre &
                équipement » (`xl:col-start-2`, rangées 1 puis 2 — voir le
                commentaire d'ouverture de la grille), masquées au doigt
                (voir le panneau plus bas). Exclusion de runes en tête —
                fonctionnalité vedette, Réglages avancés en second. */}
            <div className="hidden lg:block rounded-xl border border-accent/50 bg-panel p-3 xl:col-start-2 xl:row-start-1">
              <div className="mb-0.5 flex items-center gap-2">{exclusionRunesTitre}</div>
              {exclusionRunesInner(false)}
            </div>

            <div className="hidden lg:block rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-2">
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
              {showAdvanced && (
                <div className="mt-3 rounded-lg border border-border bg-panel2 p-3">{reglagesAvancesInner(false)}</div>
              )}
            </div>

            {/* ⚠️ Placée en rangée 4 (`xl:col-span-2`, pleine largeur) : ni
                dans la paire Monstre/Exclusion+Avancés (rangées 1-2) ni dans
                la paire Critères/Objectif (rangée 3), cette ligne
                d'estimation n'a pas sa place dans une cellule précise —
                simple info sous tout le reste. */}
            {estimate && (
              <p className="font-mono text-micro text-ink-dim xl:col-span-2 xl:row-start-4">
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

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel p-3 shadow-lg">
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

      {importMsg && (
        <p className={`text-[12.5px] ${importMsg.error ? 'text-bad' : 'text-good'}`} role="status">
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
          en cours — voir spec/outils/optimizer/. */}
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
              PAS `nodeBudgetMax` (le plafond de nœuds, qui grandit avec
              l'escalade — voir « Suite — escalade automatique du budget de
              nœuds ») : les deux racontent des choses différentes, et
              `nodeBudgetMax` grandissant en cours de route ferait reculer la
              barre au lieu d'avancer. */}
          <p className="mt-1 font-mono text-micro text-ink-dim">
            {progress === null
              ? 'Préparation…'
              : `${progress.explored.toLocaleString('fr-FR')} / ${progress.totalPairs.toLocaleString('fr-FR')} combinaisons examinées · ${progress.found.toLocaleString('fr-FR')} trouvée(s)`}
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
            <p className="label">
              {result
                ? result.candidates.length === 0
                  ? 'Aucune combinaison ne répond à ces critères'
                  : `${result.candidates.length} combinaison(s) trouvée(s)`
                : `${(progress?.phase === 'pairing' ? progress.found : fullSortedCandidates.length).toLocaleString(
                    'fr-FR'
                  )} combinaison(s) trouvée(s) pour l'instant — recherche en cours…`}
            </p>
            {(result ? result.candidates.length > 0 : true) && (
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
                    const gain = imp.poolMinSlotWithout - blockingDiagnosis.baselineMinSlot;
                    return (
                      <li key={`${imp.key}-${imp.kind}`} className="text-xs text-ink-dim">
                        Retirer <span className="font-semibold text-ink">{st.label}</span> (
                        {imp.kind === 'min' ? '≥' : '≤'} {imp.requested}
                        {st.suffix}) : {imp.poolMinSlotWithout} candidat(s){gain > 0 ? ` (+${gain})` : ' (aucun gain)'}.
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-3">
            {pageCandidates.map((c, i) => (
              <BuildCandidateCard
                key={c.runeIds.join('-')}
                rank={(resultsPage - 1) * RESULTS_PAGE_SIZE + i + 1}
                candidate={c}
                runeById={runeById}
                // ⚠️ `searchArtifacts`, PAS `selected.gear.artifacts` : les
                // stats affichées sur chaque carte (candidate.stats) ont été
                // calculées avec CES artéfacts (réels, hypothétiques ou
                // aucun selon les réglages ci-dessus) — montrer les VRAIS
                // artéfacts ici serait incohérent dès qu'ils diffèrent
                // (`ignoreArtifacts`, ou une hypothèse choisie).
                artifacts={searchArtifacts}
                metric={metric}
                openRuneKey={openRuneKey}
                onToggleRune={(key) => setOpenRuneKey((cur) => (cur === key ? null : key))}
                // ⚠️ Affiché dès qu'un sort est résolu ET que c'est bien le
                // critère de classement courant (objectif OU tri) — pas
                // seulement quand `objective` vaut « Dégâts réels » : on peut
                // avoir lancé la recherche sur un autre objectif puis re-trier
                // par dégâts réels, auquel cas le chiffre qui ordonne les
                // cartes doit être visible dessus.
                degatsReels={
                  realDamage && (objective === 'degats_reels' || sortBy === 'degats_reels')
                    ? (() => {
                        const total = computeSkillDamage(realDamage.profile, c.stats, realDamage.setup, realDamage.element);
                        return { total, partPvCible: damageSetup.enemyHp > 0 ? (total / damageSetup.enemyHp) * 100 : 0 };
                      })()
                    : undefined
                }
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
    </div>
  );
}
