import { Fragment, useMemo, useRef, useState, useEffect } from 'react';
import {
  Search,
  Square,
  Settings2,
  HelpCircle,
  RotateCcw,
  FlaskConical,
  Target,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  UserX,
} from 'lucide-react';
import { ArtifactDetail, ARTIFACT_KINDS, RECO_STATS, RuneDetail, Monster, RtaEntry, SiegeTeam } from '../../types';
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
  SLOT_FILTER_PRESETS,
  ARTIFACT_MAIN_VALUE,
  ARTIFACT_MAIN_OPTIONS,
} from '../../lib/runeBuildOptim';
import {
  AUTO_EXCLUSION_SCOPES,
  AutoExclusionScope,
  ExclusionSourceData,
  autoExcludedRuneIds,
  resolveExcludedRuneIds,
} from '../../lib/optimizerExclusion';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../../lib/optimizerRecipe';
import { ArtifactMainChoice, OptimizerState, OptimizerSortKey } from '../../hooks/useOptimizerState';
import { useRuneMetric } from '../../hooks/useRuneMetric';
import NumberField from '../NumberField';
import GameIcon from '../GameIcon';
import MonsterAvatar from '../MonsterAvatar';
import MonsterGear from '../MonsterGear';
import Segmented from '../Segmented';
import Switch from '../Switch';
import HelpPopover from '../HelpPopover';
import MonsterGearPicker, { GearedMonster } from './MonsterGearPicker';
import RuneExclusionPicker from './RuneExclusionPicker';
import SetComboPicker from './SetComboPicker';
import BuildCandidateCard from './BuildCandidateCard';

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
export default function OptimizerSection({ box, runes, optimizer, allMonsters, rtaEntries, siegeDefenseTeams, siegeOffenseTeams }: Props) {
  const metric = useRuneMetric();
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
  } = optimizer;
  const { status, result, progress, run, stop } = search;

  // TOUS les monstres 6★ de la box importée (avec ou sans runes actuellement
  // équipées — voir « Mon compte » → Monstres), dédupliqués par monstre : on
  // garde le meilleur exemplaire équipé pour les stats/artéfacts affichés —
  // voir spec/outils/optimizer/ pour cette simplification.
  const gearedMonsters = useMemo<GearedMonster[]>(() => {
    const best = new Map<string, BoxItem>();
    const score = (b: BoxItem) => (b.gear?.runes ?? []).reduce((s, r) => s + runeEfficiency(r), 0);
    for (const item of box) {
      if (!item.gear) continue;
      const id = String(item.monster.id);
      const prev = best.get(id);
      if (!prev || score(item) > score(prev)) best.set(id, item);
    }
    return Array.from(best.values()).map((item) => ({ monster: item.monster, gear: item.gear! }));
  }, [box]);

  const selected = gearedMonsters.find((g) => String(g.monster.id) === selectedId) ?? null;

  // `unitKey` (box) du monstre RECHERCHÉ, pour l'exclure de ses propres
  // propositions dans RuneExclusionPicker (s'exclure soi-même n'a pas de
  // sens) — même règle de dédup (meilleur exemplaire par efficience) que
  // `gearedMonsters` ci-dessus, appliquée seulement au monstre sélectionné.
  const selectedUnitKey = useMemo(() => {
    if (!selected) return null;
    const score = (b: BoxItem) => (b.gear?.runes ?? []).reduce((s, r) => s + runeEfficiency(r), 0);
    let best: BoxItem | null = null;
    for (const item of box) {
      if (!item.gear || String(item.monster.id) !== String(selected.monster.id)) continue;
      if (!best || score(item) > score(best)) best = item;
    }
    return best?.key ?? null;
  }, [selected, box]);

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

  const pool = useMemo(() => {
    if (!selected) return runes;
    // Se SUPERPOSENT, ne se remplacent pas : `excludeUsedRunes` l'exclusion
    // automatique (un périmètre entier, RTA/Défenses siège/Box),
    // `excludedSelectors` l'exclusion manuelle en plus (entrée par entrée,
    // n'importe laquelle des 4 sources) — voir optimizerExclusion.ts.
    const auto = excludeUsedRunes
      ? autoExcludedRuneIds(excludeUsedScope, exclusionData, selected.monster.com2usId)
      : new Set<number>();
    const manual = resolveExcludedRuneIds(excludedSelectors, exclusionData);
    if (auto.size === 0 && manual.size === 0) return runes;
    return runes.filter((r) => !auto.has(r.id) && !manual.has(r.id));
  }, [selected, excludeUsedRunes, excludeUsedScope, excludedSelectors, exclusionData, runes]);

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
    return estimateSearchSpace(pool, requirement, slotFilterCap, objective);
  }, [selected, comboSets, pool, requirement, slotFilterCap, objective]);

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
  // « Options avancées ») ET une recherche vient de renvoyer 0 résultat —
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
      setObjective(recipe.objective);
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
    } else if (sortBy === 'degats' || sortBy === 'ehp' || sortBy === 'vitesse' || sortBy === 'speed_nuker') {
      // ⚠️ `speed_nuker` : sonde expérimentale (voir Objective dans
      // runeBuildOptim.ts), jamais réellement sélectionnable ici (absente
      // de OBJECTIVE_LABELS) — cette branche n'existe que pour que le
      // typeur narrove correctement le `else` ci-dessous en StatKey pur.
      list.sort((a, b) => objectiveScore(b, sortBy) - objectiveScore(a, sortBy));
    } else {
      list.sort((a, b) => statTotal(b.stats, sortBy) - statTotal(a.stats, sortBy));
    }
    return list;
  }, [candidatesSource, sortBy, runeById, metric]);

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
    <div className="max-w-3xl space-y-5">
      {/* ⚠️ Pas de `useStickyState`/case à fermer, contrairement à
          MobileNotice : ce n'est pas un avertissement ponctuel mais un statut
          qui reste vrai tant que l'outil est en rodage — il doit rester
          visible à chaque visite, pas disparaître après un premier clic. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-warn/60 bg-warn/10 px-3 py-2.5">
        <FlaskConical size={16} className="mt-0.5 flex-none text-warn" />
        <p className="flex-1 text-[12px] leading-relaxed text-ink-dim">
          <b className="text-ink">Optimizer en bêta.</b> L'outil est encore en rodage : le moteur de
          recherche peut mettre du temps sur des critères serrés ou manquer un build sur un cas
          inhabituel — vérifie toujours le résultat avant de re-runer.
        </p>
      </div>

      <p className="text-[13px] text-ink-dim">
        Recherche parmi tes runes possédées ; rien n'est appliqué à ton compte, l'outil est purement
        indicatif — c'est à toi de re-runer dans le jeu.
      </p>

      {/* Regroupement visuel — voir spec/outils/optimizer/, proposition
          d'ergonomie 2026-08-18 : la page était une pile plate de ~12
          sections au même poids visuel. Cette carte et les suivantes
          regroupent des réglages apparentés sous un en-tête commun,
          comportement des champs eux-mêmes INCHANGÉ. */}
      <div className="rounded-xl border border-border bg-panel p-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
            <GameIcon name="monster" size={15} />
          </div>
          <p className="text-[13.5px] font-bold text-ink">Monstre &amp; équipement</p>
        </div>
        <div>
          <p className="label mb-1.5">Monstre à optimiser</p>
          <MonsterGearPicker items={gearedMonsters} onPick={setSelectedId} />
        </div>

        {selected && (
          <div className="mt-3 rounded-xl border border-accent bg-panel/60 p-3">
            <div className="flex items-center gap-2 mb-2">
              <MonsterAvatar monster={selected.monster} size={32} />
              <span className="font-semibold text-[14px]">{selected.monster.name}</span>
            </div>
            {/* ⚠️ Même composant que RTA/Siège quand on clique un monstre — pas
                une réimplémentation : stats base/bonus, artéfacts, roue de
                runes et relique tels qu'ACTUELLEMENT équipés, chacun cliquable
                pour son détail complet (RuneDetailBox/ArtifactDetailBox/
                RelicDetailBox), inline sous la roue. Ce que l'Optimizer part
                d'optimiser, visible d'un coup d'œil avant de lancer quoi que
                ce soit. */}
            <MonsterGear gear={selected.gear} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-panel p-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
            <Target size={13} className="text-ink-dim" />
          </div>
          <p className="text-[13.5px] font-bold text-ink">Critères de recherche</p>
        </div>
      <div
        ref={setPickerSectionRef}
        className={
          setPickerInvalid
            ? 'rounded-lg border-2 border-red-500 bg-red-500/15 ring-4 ring-red-500/50 p-2 -m-2 transition'
            : 'transition'
        }
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
          <p className="mt-1.5 text-[11.5px] font-semibold text-red-500">
            Sélectionne au moins un set avant de lancer la recherche.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
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
              <span className="text-[11.5px] text-ink-dim w-14">Slot {slot}</span>
              {SLOT_MAIN_OPTIONS[slot].map((code) => {
                const active = (mainStatsBySlot[slot] ?? []).includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleMainStat(slot, code)}
                    aria-pressed={active}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition select-none ${
                      active
                        ? 'border-accent bg-accent-soft text-ink shadow'
                        : 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
                    }`}
                  >
                    {RUNE_EFFECT[code]?.label ?? code}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <p className="label">Objectif de recherche</p>
          <HelpPopover title="Objectif de recherche">
            Élargit la sélection de runes candidates pour ses stats dès le pré-filtrage, avant même de
            lancer la recherche — les minimums posés ci-dessus restent ce qui décide quels demi-builds
            sont conservés pendant la recherche elle-même. <b className="text-ink">Dégâts</b> considère{' '}
            <b className="text-ink">ATQ</b>, <b className="text-ink">Taux Crit</b> et{' '}
            <b className="text-ink">Dgts Crit</b> ensemble (espérance moyenne).
          </HelpPopover>
        </div>
        <Segmented options={OBJECTIVE_LABELS} value={objective} onChange={setObjective} size="lg" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
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
            <span className="text-[12px] font-semibold text-ink-dim">Ignorer les statistiques des artéfacts</span>
            <HelpPopover title="Ignorer les statistiques des artéfacts">
              Activé, la recherche ne compte <b className="text-ink">aucune</b> statistique d'artéfact (comme si le
              monstre n'en portait pas). Désactivé, choisis la statistique principale à supposer pour chaque
              emplacement ci-dessous.
            </HelpPopover>
            <Switch
              checked={ignoreArtifacts}
              onChange={setIgnoreArtifacts}
              label="Ignorer les statistiques des artéfacts"
            />
          </div>
        </div>
        {!ignoreArtifacts && (
          <div className="flex flex-wrap gap-3">
            {ARTIFACT_KINDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-[12.5px] text-ink w-14">{label}</span>
                <select
                  value={String(artifactMainByKind[key] ?? 'equipped')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next: ArtifactMainChoice = raw === 'equipped' || raw === 'none' ? raw : (Number(raw) as 100 | 101 | 102);
                    setArtifactMainByKind((prev) => ({ ...prev, [key]: next }));
                  }}
                  className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1.5 text-[13px] outline-none"
                >
                  <option value="equipped">Comme équipé</option>
                  {ARTIFACT_MAIN_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                  <option value="none">Aucun</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <p className="label">Conditions</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-ink-dim">Stats de base exclues</span>
            <HelpPopover title="Stats de base exclues">
              <b className="text-ink">PV/ATQ/DEF/VIT</b> : activé, la valeur est ce que l'équipement (runes ET
              artéfacts comptés) doit apporter <b className="text-ink">au-dessus de la base</b> du monstre. Désactivé,
              elle porte sur le total. <b className="text-ink">Taux Crit/Dgts Crit/RES/Précision</b> restent toujours
              en total, quel que soit ce réglage — ils partent de la valeur d'éveil du monstre.
            </HelpPopover>
            <Switch
              checked={excludeBase}
              onChange={setExcludeBase}
              label="Stats de base exclues des conditions PV/ATQ/DEF/VIT"
            />
          </div>
        </div>
        {/* ⚠️ `boxWidth` fixe sur CHAQUE NumberField ci-dessous (voir
            NumberField.tsx) : sans ça, un champ avec suffixe « % » serait
            TOUJOURS plus large qu'un champ sans suffixe à largeur de texte
            égale (le suffixe prend de la place en plus), et les colonnes
            Min/Max ne s'aligneraient pas d'une stat à l'autre. */}
        <div className="grid grid-cols-[minmax(90px,auto)_auto_auto] gap-y-1.5 gap-x-4 items-center">
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
                <span className="text-[12.5px] text-ink">{st.label}</span>
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
                  <span className="text-ink-dim text-[11px]">Min</span>
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
                  <span className="text-ink-dim text-[11px]">Max</span>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="flex justify-end mt-1.5">
          <button
            type="button"
            onClick={() => {
              setMinStats({});
              setMaxStats({});
            }}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-dim transition hoverable:text-bad"
          >
            <RotateCcw size={13} /> Réinitialiser les conditions
          </button>
        </div>
      </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="flex w-full items-center gap-1.5 text-[13px] font-bold text-ink"
        >
          <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
            <Settings2 size={13} className="text-ink-dim" />
          </div>
          Réglages avancés
          <ChevronDown
            size={14}
            className={`ml-auto text-ink-dim transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
        </button>
        {showAdvanced && (
          <div className="mt-3 rounded-lg border border-border bg-panel2 p-3">
            <p className="text-[11.5px] text-ink-dim mb-1">Pré-filtrage par emplacement</p>
            <div className="flex items-center gap-1 bg-panel2 border border-border rounded-lg p-0.5 w-fit">
              {SLOT_FILTER_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSlotFilterPreset(p.key)}
                  title={p.hint}
                  aria-pressed={slotFilterPreset === p.key}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
                    slotFilterPreset === p.key ? 'bg-accent-soft text-ink' : 'text-ink-dim hoverable:text-ink'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11.5px] text-warn max-w-[280px]">
              ⚠️ {SLOT_FILTER_PRESETS.find((p) => p.key === slotFilterPreset)?.hint}
            </p>

            {/* Toggle, même patron que « Prioriser les stats les plus
                difficiles » : désactivé par défaut, lu par `handleSearch` au
                clic sur « Rechercher », jamais un bouton qui lance sa propre
                recherche. */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] text-ink-dim">Rechercher jusqu'à épuisement complet</span>
                <span title="Retire la limite de temps de 10 minutes : la recherche continue tant qu'il reste des combinaisons à examiner. Peut prendre très longtemps sur une recherche avec peu de conditions — le bouton « Arrêter » reste disponible et garde le meilleur trouvé jusque-là. Le plafond de 100 000 résultats collectés, lui, reste actif.">
                  <HelpCircle size={13} className="text-ink-dim" />
                </span>
              </div>
              <Switch
                checked={exhaustiveSearch}
                onChange={setExhaustiveSearch}
                label="Rechercher jusqu'à épuisement complet"
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] text-ink-dim">Diagnostic approfondi sur 0 résultat</span>
                <span title="Après une recherche à 0 résultat, identifie quelle condition posée libère le plus de candidats si on la retire — un indice, pas une preuve. Coûte plusieurs passes de pré-filtrage au lieu d'une seule, jamais une recherche complète.">
                  <HelpCircle size={13} className="text-ink-dim" />
                </span>
              </div>
              <Switch
                checked={diagnoseBlockingEnabled}
                onChange={setDiagnoseBlockingEnabled}
                label="Diagnostic approfondi sur 0 résultat"
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
              <Switch
                checked={adaptiveTrancheWeighting}
                onChange={setAdaptiveTrancheWeighting}
                label="Prioriser les stats les plus difficiles"
              />
            </div>
          </div>
        )}
      </div>

      {estimate && (
        <p className="font-mono text-[11.5px] text-ink-dim">
          ≈ {formatBig(estimate.product)} combinaisons brutes après filtrage (pool par emplacement :{' '}
          {estimate.perSlot.join(' × ')}) — un ordre de grandeur, pas le nombre réellement exploré par
          l'algorithme.
        </p>
      )}

      {/* Catégorie « Exclusion de runes » — les deux réglages ci-dessous
          existaient déjà séparément (voir git blame), simplement regroupés
          sous un en-tête commun ; comportement/logique INCHANGÉS. Se
          superposent l'un à l'autre (voir optimizerExclusion.ts), jamais
          l'un ne remplace l'autre. */}
      <div className="rounded-xl border border-accent/50 bg-panel p-3">
        <div className="mb-0.5 flex items-center gap-2">
          {/* Icône « Runes » de Mon compte (même GameIcon que le menu),
              barrée d'un trait diagonal — l'exclusion RETIRE des runes de la
              recherche, pas un pictogramme d'inventaire générique. */}
          <div className="relative flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
            <GameIcon name="rune" size={15} />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="h-[1.5px] w-[19px] rotate-45 rounded-full bg-bad" />
            </span>
          </div>
          <p className="text-[13.5px] font-bold text-ink">Exclusion de runes</p>
        </div>
        <p className="mb-3 pl-8 text-[11px] text-ink-dim">Deux réglages indépendants, qui se superposent.</p>

        {/* Côte à côte à partir de `sm` (les deux tiennent dans les 768px du
            conteneur) ; empilés en dessous, comme avant, pour rester
            praticable sur mobile. Colonne de gauche plus étroite (toggle +
            3 options) que celle de droite (recherche + liste), pas un
            50/50 aveugle. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(200px,260px)_1fr] sm:gap-5">
          <div className="sm:border-r sm:border-border-soft sm:pr-5">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Layers size={15} className="text-ink-dim" />
              <span className="text-[12.5px] font-semibold text-ink-dim">Exclure les runes déjà utilisées</span>
              <HelpPopover title="Exclure les runes déjà utilisées">
                Par défaut, la recherche considère TOUT l'inventaire, runes déjà portées ailleurs comprises. Active ce
                réglage pour retirer de la recherche les runes déjà portées par d'AUTRES monstres dans le périmètre
                choisi ci-contre (un seul à la fois) — un build réellement montable sans déruner quelqu'un. Le monstre
                recherché lui-même n'est jamais exclu de ses propres runes.
              </HelpPopover>
              <Switch checked={excludeUsedRunes} onChange={setExcludeUsedRunes} label="Exclure les runes déjà utilisées" />
            </div>
            <Segmented
              options={AUTO_EXCLUSION_SCOPES}
              value={excludeUsedScope}
              onChange={setExcludeUsedScope}
              disabled={!excludeUsedRunes}
              size="lg"
            />
          </div>

          {/* Exclusion MANUELLE — se superpose à « Exclure les runes déjà
              utilisées » à gauche, ne la remplace pas (voir
              optimizerExclusion.ts). Choisir un monstre ici, dans n'importe
              laquelle des 4 sources, retire ses runes ACTUELLEMENT équipées
              du pool considéré, en plus de l'exclusion automatique
              éventuelle. */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <UserX size={15} className="text-ink-dim" />
              <span className="text-[12.5px] font-semibold text-ink-dim">Exclure les runes d'un monstre</span>
              <HelpPopover title="Exclure les runes d'un monstre">
                Choisis un monstre (box, RTA, siège défense ou offense) pour retirer SES runes actuellement équipées de
                la recherche — utile pour un build que tu ne veux pas défaire, en plus de{' '}
                <b className="text-ink">« Exclure les runes déjà utilisées »</b> à gauche.
              </HelpPopover>
            </div>
            <RuneExclusionPicker
              data={exclusionData}
              excludeOwnUnitKey={selectedUnitKey}
              selected={excludedSelectors}
              onChange={setExcludedSelectors}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel/95 p-3 shadow-lg backdrop-blur">
        {/* ⚠️ `comboSets.length === 0` reste HORS de `disabled` — un bouton
            HTML natif `disabled` ne déclenche JAMAIS `onClick` (règle du
            DOM, pas un oubli), ce qui aurait rendu le défilement vers « Set
            de runes recherché » ci-dessous inatteignable : plus aucun clic
            ne pouvait jamais arriver jusqu'à `handleSearch`. Grisé
            visuellement à la place (mêmes classes que `disabled:*`,
            appliquées manuellement) tout en restant cliquable, pour que le
            clic sur un set manquant décale toujours vers la section fautive
            plutôt que de ne rien faire silencieusement. */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={!selected || status === 'running'}
          title={selected && status !== 'running' && comboSets.length === 0 ? 'Choisis d\'abord un set de runes recherché' : undefined}
          className={`flex items-center gap-1.5 rounded-lg border border-accent bg-accent-soft px-3.5 py-2 text-[13px] font-semibold
                     text-ink transition hoverable:shadow disabled:opacity-40 disabled:cursor-not-allowed ${
                       comboSets.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                     }`}
        >
          <Search size={15} />
          {status === 'running' ? 'Recherche…' : 'Rechercher'}
        </button>

        {/* Exporte les réglages de CETTE recherche (set, minimums, objectif…),
            jamais le pool de runes ni le compte — pour reproduire fidèlement
            un cas signalé, partager une recherche entre joueurs (chacun
            l'applique à son propre inventaire), ou la réutiliser depuis un
            script. Voir src/lib/optimizerRecipe.ts. */}
        <button
          type="button"
          onClick={exportRecipe}
          disabled={!selected || comboSets.length === 0}
          title="Télécharger les réglages de cette recherche en fichier .json (set, minimums, objectif…) — pour la partager ou la reproduire, jamais tes runes ni ton compte."
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-2 text-[12.5px]
                     text-ink-dim transition hoverable:text-ink hoverable:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Upload size={14} />
          Exporter les paramètres de recherche
        </button>

        {/* Reprend une recette importée (fichier reçu d'un autre joueur, ou
            gardée de côté) — remplit les réglages et sélectionne le monstre
            si son com2usId existe dans CETTE box. Aucune confirmation :
            remplacer les réglages en cours n'est pas plus destructeur que
            les modifier à la main un par un. */}
        <button
          type="button"
          onClick={() => importFileRef.current?.click()}
          title="Reprendre les réglages d'un fichier .json exporté depuis l'Optimizer (le tien ou celui d'un autre joueur)."
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-2 text-[12.5px]
                     text-ink-dim transition hoverable:text-ink hoverable:border-accent"
        >
          <Download size={14} />
          Importer les paramètres de recherche
        </button>
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
          <button
            type="button"
            onClick={() => {
              setStoppedManually(true);
              stop();
            }}
            title="Arrêter la recherche et garder ce qui a déjà été trouvé"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-[13px] font-semibold
                       text-ink-dim transition hoverable:text-bad hoverable:border-bad"
          >
            <Square size={13} /> Arrêter
          </button>
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
                <p className="mt-1 font-mono text-[11px] text-ink-dim">
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
              afficher `nodeBudgetMax` ici créait un désaccord visible avec
              la ligne « Espace de recherche à épuiser » juste en dessous,
              qui montre TOUJOURS `totalPairs`. Les deux lignes partagent
              maintenant le même chiffre. */}
          <p className="mt-1 font-mono text-[11px] text-ink-dim">
            {progress === null
              ? 'Préparation…'
              : `${progress.explored.toLocaleString('fr-FR')} / ${progress.totalPairs.toLocaleString('fr-FR')} combinaisons examinées · ${progress.found.toLocaleString('fr-FR')} trouvée(s)`}
          </p>
          {progress !== null && (
            <p className="mt-0.5 font-mono text-[11px] text-ink-dimmer">
              Espace de recherche à épuiser (au pire) : {progress.totalPairs.toLocaleString('fr-FR')} combinaisons
            </p>
          )}
          {progress !== null && (
            <p className="mt-0.5 font-mono text-[11px] text-ink-dimmer">
              Le budget de recherche s'élargit automatiquement tant qu'il reste du temps et rien de trouvé.
            </p>
          )}
        </div>
      )}

      {status === 'error' && (
        <p className="text-[12.5px] text-bad">La recherche a échoué. Réessaie avec des critères moins stricts.</p>
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
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as OptimizerSortKey);
                  // Classement entièrement différent : la page courante
                  // n'a plus le même sens, on repart du meilleur résultat.
                  setResultsPage(1);
                }}
                className="bg-panel border border-border rounded-lg px-2 py-1 text-[12px] text-ink outline-none
                           focus:border-accent"
              >
                <optgroup label="Stats">
                  {RECO_STATS.map((st) => (
                    <option key={st.key} value={st.key}>
                      Trier par {st.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Objectifs">
                  {OBJECTIVE_LABELS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </select>
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
                  <p className="mb-1.5 text-[12px] font-semibold text-bad">
                    {impossibleFeasibility.length === 1
                      ? 'Une condition est'
                      : `${impossibleFeasibility.length} conditions sont`}{' '}
                    mathématiquement hors de portée, quel que soit le runage choisi :
                  </p>
                  <ul className="space-y-1">
                    {impossibleFeasibility.map((f) => {
                      const st = RECO_STATS.find((s) => s.key === f.key)!;
                      return (
                        <li key={`${f.key}-${f.kind}`} className="text-[12px] text-ink-dim">
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
                <p className="text-[12px] text-ink-dim">
                  Aucune condition n'est, à elle seule, mathématiquement hors de portée — le blocage
                  vient probablement de leur <b className="text-ink">combinaison</b> (rare qu'un seul
                  build satisfasse tout à la fois), ou du pré-filtrage de la recherche elle-même. Essaie
                  de desserrer une condition, ou un pré-filtrage plus large (Options avancées).
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
                <p className="mb-1.5 text-[12px] font-semibold text-ink">
                  Diagnostic approfondi — pool le plus restreint : {blockingDiagnosis.baselineMinSlot} candidat(s)
                  actuellement.
                </p>
                <ul className="space-y-1">
                  {blockingDiagnosis.impacts.map((imp) => {
                    const st = RECO_STATS.find((s) => s.key === imp.key)!;
                    const gain = imp.poolMinSlotWithout - blockingDiagnosis.baselineMinSlot;
                    return (
                      <li key={`${imp.key}-${imp.kind}`} className="text-[12px] text-ink-dim">
                        Retirer <span className="font-semibold text-ink">{st.label}</span> (
                        {imp.kind === 'min' ? '≥' : '≤'} {imp.requested}
                        {st.suffix}) : {imp.poolMinSlotWithout} candidat(s){gain > 0 ? ` (+${gain})` : ' (aucun gain)'}.
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1.5 text-[11px] text-ink-dim">
                  Un indice, pas une preuve — basé sur le pré-filtrage sûr, pas sur une recherche complète.
                </p>
              </div>
            ) : (
              !diagnoseBlockingEnabled && (
                <p className="mb-3 text-[11px] text-ink-dim">
                  Astuce : active le diagnostic approfondi (Options avancées) pour identifier quelle
                  condition libère le plus de candidats.
                </p>
              )
            ))}

          {result?.truncated && (
            <p className="mb-2 text-[11.5px] text-warn">
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3">
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
              <button
                type="button"
                onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                disabled={resultsPage <= 1}
                aria-label="Page précédente"
                title="Page précédente"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border
                           bg-panel text-ink-dim transition hoverable:text-ink hoverable:border-accent
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-ink-dim">
                <span>Page</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={resultsPage}
                  aria-label="Aller à la page"
                  onChange={(e) => {
                    const brut = e.target.value.trim();
                    if (brut === '' || !/^\d+$/.test(brut)) return; // frappe invalide/vide ignorée
                    // ⚠️ PAS borné ici (même raison que NumberField.tsx) :
                    // borner chaque frappe empêcherait de composer un
                    // nombre à plusieurs chiffres au-delà de `totalResultsPages`
                    // en cours de saisie. Le clampage définitif se fait au
                    // blur/Entrée.
                    setResultsPage(Number(brut));
                  }}
                  onBlur={() => setResultsPage((p) => Math.min(Math.max(p, 1), totalResultsPages))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-11 rounded-md border border-border bg-panel px-1 py-1 text-center text-ink
                             outline-none focus:border-accent"
                />
                <span>/ {totalResultsPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setResultsPage((p) => Math.min(totalResultsPages, p + 1))}
                disabled={resultsPage >= totalResultsPages}
                aria-label="Page suivante"
                title="Page suivante"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border
                           bg-panel text-ink-dim transition hoverable:text-ink hoverable:border-accent
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
