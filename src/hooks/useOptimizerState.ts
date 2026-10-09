import { Dispatch, MutableRefObject, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { StatKey } from '../lib/effects';
import { Objective, SlotFilterPresetKey } from '../lib/runeBuildOptim';
import { DamageSetup } from '../lib/damage';
import { appliquerCriteres, baseCompleteCriteres, criteresApresChangementEspece, defaultRelicMainChoice, photoCriteres, type CriteresOptimizer } from '../lib/criteresOptimizer';
import { rattacherProprietaireCriteres, validerProprietaireCriteres, type ProprietaireCriteresOptimizer } from '../lib/optimizerCriteriaOwner';
import { cleMemoireMembre, type StockageOptimizer, type RapportReverificationOptimizer } from '../lib/optimizerMemberStorage';
import type { UseOptimizerLists } from './useOptimizerLists';
import { AutoExclusionScope, ExclusionSelector, ExclusionSource, resolveExclusionEntry, type ExclusionSourceData } from '../lib/optimizerExclusion';
import { ArtifactKind, type LeaderSkill } from '../types';
import { leadEffectifMembreOptimizer, modifierEquipeOptimizer } from '../lib/equipesOptimizer';
import type { EquipeOptimizer } from '../lib/optimizerMemberStorage';
import { LigneVerrouillee } from '../lib/artifactOptim';
import { useBuildOptimSearch } from './useBuildOptimSearch';

export type { SlotFilterPresetKey };
// API historique conservée pour l'écran, les recettes et les scripts.
export { defaultRelicMainChoice, relicMainChoiceApresChangementExemplaire, criteresApresChangementEspece, baseCompleteCriteres } from '../lib/criteresOptimizer';
export type OptimizerSortKey = StatKey | Objective;
// Choix de statistique principale d'artéfact pour la recherche : les trois
// valeurs de jeu standard (voir ARTIFACT_MAIN dans effects.ts — 100=PV,
// 101=ATQ, 102=DEF), plus trois cas hors de cette table : `'equipped'`
// (défaut — reprend l'artéfact RÉELLEMENT équipé de ce type) et `'libre'`
// (chercher parmi TOUS les éligibles, quelle que soit la principale).
//
// ⚠️ `'libre'` n'a de sens qu'avec une recherche d'artéfacts : sans elle
// ce serait une option morte dans le sélecteur. Il est aligné sur `ChoixPrincipale`
// (artifactOptim.ts).
//
// ⚠️ **Le sélecteur n'offre pas `'none'` (laisser l'emplacement vide).** Un monstre porte
// deux artéfacts ou n'en porte pas : vider UN emplacement pendant que l'autre
// cherche ne correspond à rien en jeu. Et « ne pas compter les artéfacts » se
// dit déjà d'un seul geste avec l'interrupteur, pour les deux emplacements à
// la fois. Une recette qui porterait encore `'none'` est ramenée sur `'libre'`
// à l'import (voir `mainsPourCeCompte`, optimizerRecipe.ts).
export type ArtifactMainChoice = 'equipped' | 'libre' | 100 | 101 | 102;

// Choix de statistique principale de RELIQUE pour la recherche — même
// domaine de valeurs qu'`ArtifactMainChoice` (100/101/102 = PV/ATQ/DEF,
// `'equipped'`, `'libre'`), mais une sémantique différente : la principale
// d'un artéfact est un PLAT (`ARTIFACT_MAIN`, effects.ts), celle d'une
// relique un POURCENTAGE (`stat = B + ceil(B × (R + L) / 100) + plats`,
// docs/03-developpeur/optimizer/ § Contexte transporté, bornes
// relâchées, filtre exact). Pas de
// `'none'` : une relique n'a pas d'emplacement à vider, comme pour
// l'artéfact.
export type RelicMainChoice = ArtifactMainChoice;

// Choix de propriété unique de relique — `'libre'` (défaut) ou l'un des 16
// types de `RELIC_UNIQUE` (lib/effects.ts). Pas d'union littérale des 16
// valeurs : le nombre de types est fixé par le jeu, pas par ce type — la
// validité se vérifie à la lecture contre `RELIC_UNIQUE`, comme
// `EffectLine.stat` (types.ts) le fait déjà pour les codes d'effet.
export type RelicUniqueChoice = 'libre' | number;

// Seuil de niveau par défaut d'une relique éligible (+6) — nommé une
// seule fois : repris par `optimizerRecipe.ts` pour la recette ancienne qui
// ne porte pas encore ce champ.
export const DEFAULT_RELIC_MIN_UPGRADE = 6;

/**
 * L'intention de recherche de relique — interrupteur, principale, type,
 * seuil — résolue en un objet UNIQUE : ni l'écran, ni
 * le CLI, ni la file ne relisent les trois champs séparément. Deux
 * constructeurs : côté recette (`recipeToRelicIntent`,
 * scripts/lib/recipeToSearchParams.ts) et côté écran (`relicIntentDepuisEtat`,
 * depuis `OptimizerState`) — les listes n'ont d'effet qu'avec la
 * recherche.
 */
export interface RelicIntent {
  mode: 'off' | 'equipped' | 'recherche';
  principale: RelicMainChoice;
  type: RelicUniqueChoice;
  seuil: number;
}

/**
 * Le constructeur ÉCRAN de `RelicIntent` (second constructeur, après
 * la recette) — mêmes règles que `recipeToRelicIntent`
 * (scripts/lib/recipeToSearchParams.ts), appliquées aux quatre champs de
 * `OptimizerState` au lieu d'une `OptimizerRecipe` : `mode: 'off'` suit
 * l'interrupteur (aucun interrupteur propre à la relique),
 * `'equipped'` si la principale l'est (le type est alors sans effet),
 * `'recherche'` sinon. `run()` (OptimizerSection.tsx) l'appelle pour poser
 * `SearchParams.relicContext` — troisième producteur, à
 * côté du CLI (`recipeToRelicIntent`) et de l'oracle.
 */
export function relicIntentDepuisEtat(
  optimiserArtefacts: boolean,
  relicMainChoice: RelicMainChoice,
  relicUniqueChoice: RelicUniqueChoice,
  relicMinUpgrade: number
): RelicIntent {
  return {
    mode: !optimiserArtefacts ? 'off' : relicMainChoice === 'equipped' ? 'equipped' : 'recherche',
    principale: relicMainChoice,
    type: relicUniqueChoice,
    seuil: relicMinUpgrade,
  };
}

// Toute la SAISIE de l'écran Outils → Optimizer, remontée ici (instancié dans
// App.tsx, jamais démonté) pour survivre à un changement d'onglet : comme les
// autres pages de l'app, OptimizerSection est démontée à chaque navigation —
// un `useState` local y perdrait tout à la moindre visite d'un autre onglet.
// Même principe que useRtaState/useSiegeState, mais SANS écriture disque :
// Les critères affichés restent en mémoire ; leurs photos personnelles sont
// confiées au hook des listes seulement par un geste de saisie ou d'inclusion.
// La sélection et le propriétaire ne sont jamais persistés par ce hook.
export interface OptimizerState {
  proprietaireCriteres: ProprietaireCriteresOptimizer | null;
  rapportCriteres: string[];
  lireCombatMembre: () => { setup: DamageSetup; equipe: EquipeOptimizer | null; motif: string | null };
  modifierLeadMembre: (lead: DamageSetup['leaderSkill']) => void;
  effacerProprietaireCriteres: () => void;
  choisirMembre: (listId: string, selector: ExclusionSelector) => CriteresOptimizer | null;
  capturerMembre: (listId: string, selector: ExclusionSelector) => void;
  poserTriRecherche: (tri: OptimizerSortKey) => void;
  poserCriteresAutomatiques: (patch: Partial<CriteresOptimizer> | ((courants: CriteresOptimizer) => Partial<CriteresOptimizer>)) => void;
  traiterReliqueImportee: (relique: Parameters<typeof defaultRelicMainChoice>[0]) => void;
  appliquerReverificationMembres: (stockage: StockageOptimizer, rapport: RapportReverificationOptimizer, data: ExclusionSourceData, runeIds: Set<number>) => void;
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  /**
   * L'EXEMPLAIRE de l'espèce choisie (`selectedId`) : la source dont la puce
   * est active, et l'entrée précise (le Lushen de la box, du deck RTA, d'une
   * équipe de siège). Ici, et non dans l'écran, pour survivre au changement
   * de page — l'écran se démonte, ce hook non — et entrer dans la sauvegarde
   * de session (docs/02-app/transverse/).
   *
   * ⚠️ Au remontage, l'écran revérifie l'entrée contre le compte affiché
   * (réimport, équipe supprimée entre-temps) : introuvable, elle retombe sur
   * le premier exemplaire de la box, la règle du choix d'une espèce.
   * ⚠️ Jamais dans `OptimizerRecipe` : une recette ne porte que l'espèce.
   */
  gearSource: ExclusionSource;
  setGearSource: Dispatch<SetStateAction<ExclusionSource>>;
  sourceSelector: ExclusionSelector | null;
  setSourceSelector: Dispatch<SetStateAction<ExclusionSelector | null>>;
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
   * ⚠️ Ce drapeau est l'INVERSE du champ `ignoreArtifacts` de la recette
   * exportée (format stable), et il ne retire PAS toute statistique
   * d'artéfact — la conversion se fait à la frontière, voir
   * `exportRecipe`/`importRecipe` (OptimizerSection.tsx).
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
  // le moteur a le dernier mot. Afficher `'equipped'` alors que la recherche
  // cherche librement ferait raisonner sur un état faux tout ce qui se fie à
  // l'affichage.
  //
  // ⚠️ **C'est un FILTRE sur l'inventaire, plus une hypothèse.** Une pièce
  // hypothétique (« et si j'avais un artéfact PV+1500 ? », à `subs: []`)
  // ferait calculer les dégâts SANS aucune ligne d'effet en « Dégâts réels »,
  // quand « Comme équipé » les compte : deux réglages voisins, deux modèles de
  // dégâts, sans que rien ne le signale. Le cran désigne donc les artéfacts
  // RÉELLEMENT possédés portant cette principale — et sans aucun,
  // l'emplacement reste vide.
  artifactMainByKind: Partial<Record<ArtifactKind, ArtifactMainChoice>>;
  setArtifactMainByKind: Dispatch<SetStateAction<Partial<Record<ArtifactKind, ArtifactMainChoice>>>>;
  // Principale ET propriété unique de RELIQUE demandées —
  // combinées en ET, comme `artifactMainByKind` un CRITÈRE remis à zéro par
  // `resetSearch` au changement de monstre (une valeur `equipped`/propriété
  // choisie pour l'ancien monstre n'a pas de sens pour le nouveau).
  //
  // ⚠️ `libre` et le type n'ont d'effet qu'avec la recherche de relique
  // (mode `recherche` de `RelicIntent`).
  relicMainChoice: RelicMainChoice;
  setRelicMainChoice: Dispatch<SetStateAction<RelicMainChoice>>;
  relicUniqueChoice: RelicUniqueChoice;
  setRelicUniqueChoice: Dispatch<SetStateAction<RelicUniqueChoice>>;
  // Seuil de niveau minimum d'une relique éligible (+0 à +15, +6 par
  // défaut) — un RÉGLAGE AVANCÉ, pas un critère : `resetSearch` ne le remet
  // PAS à zéro au changement de monstre, comme `slotFilterPreset` ou
  // `exhaustiveSearch`. Se règle par le champ « Niveau minimum » de la carte
  // relique (docs/02-app/optimizer/ § Relique).
  relicMinUpgrade: number;
  setRelicMinUpgrade: Dispatch<SetStateAction<number>>;
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
  // Réglage de l'objectif « Dégâts réels » (voir docs/02-app/degats-reels/) :
  // quel sort, quel adversaire, quels effets de combat actifs. N'a d'effet
  // que si `objective === 'degats_reels'` — mais reste saisi/conservé même
  // si l'utilisateur change d'objectif puis revient, pour ne pas lui faire
  // ressaisir un adversaire qu'il vient de configurer.
  // ⚠️ Ne contient AUCUNE donnée dérivée du monstre chargé : uniquement de la
  // saisie, pour rester sérialisable dans une recette partagée entre joueurs
  // et traversable par le Web Worker.
  damageSetup: DamageSetup;
  setDamageSetup: Dispatch<SetStateAction<DamageSetup>>;
  compterAurasResPre: boolean;
  setCompterAurasResPre: Dispatch<SetStateAction<boolean>>;
  // Cran de « Meilleurs artéfacts offensifs », personnel au membre.
  critereArtefacts: 'brut' | 'reel';
  setCritereArtefacts: Dispatch<SetStateAction<'brut' | 'reel'>>;
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
  // Toggle « Prioriser les stats les plus difficiles » (voir
  // docs/03-developpeur/optimizer/ § Pré-filtrage heuristique et
  // compartiments) — désactivé par défaut, lu par `handleSearch` au moment du
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
  // Toggle « Vérifier toutes les combinaisons trouvées » — désactivé par défaut : la file de résolution s'arrête à K
  // combinaisons confirmées (300 en relique « recherche », 100 sinon) ; activé,
  // elle vérifie tous les builds trouvés (`cibleDeLaFile`). Un RÉGLAGE AVANCÉ,
  // comme `exhaustiveSearch` : `resetSearch` ne le remet pas à zéro. Lu en
  // direct par la file, pas par `handleSearch` : il ne change pas la recherche
  // de runes. Gardé dans la recette (`OptimizerRecipe.verifierToutesLesCombinaisons`).
  verifierToutesLesCombinaisons: boolean;
  setVerifierToutesLesCombinaisons: Dispatch<SetStateAction<boolean>>;
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
  // runeBuildOptim.ts) : pour chaque condition posée, cherche par dichotomie
  // DE COMBIEN la desserrer suffit à faire grandir le pool le plus
  // restreint. Décoché par défaut — coûte O(N × log(plage)) passes de
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
  /**
   * L'IDENTITÉ de l'import du compte : son numéro dans la session, avancé
   * d'une unité par CHAQUE `resetSearch('compte')` — App.tsx l'appelle à
   * chaque import réel, jamais à la relecture du compte conservé. 0 tant
   * qu'aucun import n'a eu lieu. Entre dans la signature de la file
   * (`signatureArtefacts`) : tout réimport en vide le cache, même à nombre
   * d'artéfacts et identifiants de runes égaux.
   *
   * ⚠️ Une identité, pas une empreinte du contenu ; sans setter : rien d'autre
   * qu'un import ne l'avance.
   */
  importDuCompte: number;
  /**
   * Le dernier `importDuCompte` dont l'écran a déjà recalculé le défaut de
   * relique. Ici, et non dans l'écran : `OptimizerSection` se démonte à
   * chaque changement d'onglet, et un suivi local recalculait à chaque
   * remontage, écrasant le choix de l'utilisateur (seconde revue externe de
   * la v1.14.0). Une ref : la lire ou l'avancer ne provoque aucun rendu.
   */
  importReliqueTraite: MutableRefObject<number>;
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
  // (autre espèce ou autre pool de runes). La navigation entre exemplaires
  // d'une même espèce et listes ne passe pas par ici.
  resetSearch: (motif?: 'monstre' | 'compte') => void;
  /**
   * Efface les « Combinaisons trouvées » AFFICHÉES — résultat, progression,
   * page, arrêt manuel, détail ouvert — et RIEN d'autre : ni critère, ni
   * réglage de combat, ni tri, ni réglage avancé. C'est la partie
   * « résultats » de `resetSearch`, qui l'appelle : changer d'espèce et
   * changer d'exemplaire effacent donc la même chose.
   *
   * Appelée par le choix d’un membre après sa restauration et par la
   * sélection hors liste d’un autre exemplaire : la recherche affichée
   * disparaît ; l’utilisateur relance lui-même, jamais automatiquement.
   */
  effacerResultats: () => void;
}

export interface ContexteMembresOptimizer {
  lists: UseOptimizerLists;
  data: ExclusionSourceData;
  runeIds: Set<number>;
}

export function useOptimizerState(contexte?: ContexteMembresOptimizer): OptimizerState {
  const [base] = useState(() => baseCompleteCriteres(undefined));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gearSource, setGearSource] = useState<ExclusionSource>('box');
  const [sourceSelector, setSourceSelector] = useState<ExclusionSelector | null>(null);
  const [comboSets, setComboSets] = useState<string[]>(base.comboSets);
  const [setPickerInvalid, setSetPickerInvalid] = useState(false);
  const [minStats, setMinStats] = useState<Partial<Record<StatKey, number>>>(base.minStats);
  const [maxStats, setMaxStats] = useState<Partial<Record<StatKey, number>>>(base.maxStats);
  // ⚠️ Coché par défaut — règle dans l'introduction de
  // docs/02-app/optimizer/, sous son titre
  // « Conditions, inventaire et réglages avancés ».
  const [excludeBase, setExcludeBase] = useState(base.excludeBase);
  // Activee par defaut : chercher les artefacts est le comportement utile,
  // et il ne coute rien a la recherche de runes (temps masque).
  const [optimiserArtefacts, setOptimiserArtefacts] = useState(base.optimiserArtefacts);
  // Activé par défaut : ce qu’on affiche reste le meilleur pour ce qu’on
  // regarde. Ne coûte rien sur les tris qu’aucun artéfact ne touche
  // (efficience, VIT, TC, DCC, RES, PRE) — voir `regimeArtefacts`.
  const [adapterArtefactsAuTri, setAdapterArtefactsAuTri] = useState(base.adapterArtefactsAuTri);
  const [artifactMainByKind, setArtifactMainByKind] = useState<Partial<Record<ArtifactKind, ArtifactMainChoice>>>(base.artifactMainByKind);
  // ⚠️ Défaut STATIQUE ('libre') volontairement — le vrai défaut
  // ('equipped' si le monstre porte une relique) se calcule au choix du
  // monstre (`defaultRelicMainChoice`), câblé par `pickSpecies` hors liste et
  // par la base complète d’un membre ; pas à l’initialisation de ce hook.
  const [relicMainChoice, setRelicMainChoice] = useState<RelicMainChoice>(base.relicMainChoice);
  const [relicUniqueChoice, setRelicUniqueChoice] = useState<RelicUniqueChoice>(base.relicUniqueChoice);
  const [relicMinUpgrade, setRelicMinUpgrade] = useState(DEFAULT_RELIC_MIN_UPGRADE);
  const [lignesVerrouillees, setLignesVerrouillees] = useState<LigneVerrouillee[]>(base.lignesVerrouillees);
  const [mainStatsBySlot, setMainStatsBySlot] = useState<Partial<Record<2 | 4 | 6, number[]>>>(base.mainStatsBySlot);
  const [lockedRunes, setLockedRunes] = useState<Partial<Record<number, number>>>(base.lockedRunes);
  const [objective, setObjective] = useState<Objective>(base.objective);
  const [damageSetup, setDamageSetup] = useState<DamageSetup>(base.damageSetup);
  const [compterAurasResPre, setCompterAurasResPre] = useState(base.compterAurasResPre);
  /**
   * Sur quoi « Meilleurs artéfacts offensifs pour ce build » optimise.
   *
   * ⚠️ **Un segmenté, PAS un bouton qui déclenche.** La qualité première de ce
   * bloc est d'apparaître sans qu'on l'ait demandé : un bouton le ferait
   * disparaître par défaut. Le cran « Dégâts supplémentaires » est donc
   * calculé en permanence — il est bon marché (ni sort, ni cible, ni
   * critique) ; « Dégâts réels » ne coûte que quand on le choisit.
   *
   * ⚠️ Défaut sur le brut, et il le REDEVIENT à chaque changement de monstre
   * dans le bestiaire (voir `pickSpecies`) : un sort appartient à un monstre.
   * Il vit ici, pas dans `OptimizerSection`, pour survivre au changement
   * d'onglet.
   */
  const [critereArtefacts, setCritereArtefacts] = useState<'brut' | 'reel'>(base.critereArtefacts);
  const [excludeUsedRunes, setExcludeUsedRunes] = useState(false);
  const [excludeUsedScope, setExcludeUsedScope] = useState<AutoExclusionScope>('rta');
  const [excludedSelectors, setExcludedSelectors] = useState<ExclusionSelector[]>([]);
  const [adaptiveTrancheWeighting, setAdaptiveTrancheWeighting] = useState(false);
  const [exhaustiveSearch, setExhaustiveSearch] = useState(false);
  const [verifierToutesLesCombinaisons, setVerifierToutesLesCombinaisons] = useState(false);
  const [sortBy, setSortBy] = useState<OptimizerSortKey>(base.sortBy);
  const [resultsPage, setResultsPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slotFilterPreset, setSlotFilterPreset] = useState<SlotFilterPresetKey>('moyen');
  const [diagnoseBlockingEnabled, setDiagnoseBlockingEnabled] = useState(false);
  const [stoppedManually, setStoppedManually] = useState(false);
  const [openDetailKey, setOpenDetailKey] = useState<string | null>(null);
  const [importDuCompte, setImportDuCompte] = useState(0);
  const importReliqueTraite = useRef(0);
  const search = useBuildOptimSearch();
  const [proprietaireCriteres, setProprietaireCriteres] = useState<ProprietaireCriteresOptimizer | null>(null);
  const [rapportCriteres, setRapportCriteres] = useState<string[]>([]);
  const captureEnAttente = useRef<{ proprietaire: ProprietaireCriteresOptimizer; criteres: CriteresOptimizer } | null>(null);
  // Les callbacks retardés lisent le dernier affichage, jamais la fermeture
  // du membre qui était sélectionné au début d'une lecture de fichier.
  const criteresAffiches: CriteresOptimizer = { comboSets, minStats, maxStats, excludeBase, optimiserArtefacts, adapterArtefactsAuTri,
      artifactMainByKind, relicMainChoice, relicUniqueChoice, lignesVerrouillees, mainStatsBySlot,
      lockedRunes, objective, damageSetup, sortBy, compterAurasResPre, critereArtefacts };
  const vivant = useRef({ contexte, selectedId, sourceSelector, proprietaire: proprietaireCriteres, criteres: criteresAffiches, importDuCompte });
  vivant.current = { contexte, selectedId, sourceSelector, proprietaire: proprietaireCriteres, criteres: criteresAffiches, importDuCompte };

  function effacerProprietaireCriteres() {
    captureEnAttente.current = null;
    vivant.current.proprietaire = null;
    setProprietaireCriteres(null);
  }

  function appliquerPhoto(photo: CriteresOptimizer) {
    const suivante = appliquerCriteres(photo, { type: 'personnel' });
    vivant.current.criteres = suivante;
    setComboSets(suivante.comboSets); setMinStats(suivante.minStats); setMaxStats(suivante.maxStats);
    setExcludeBase(suivante.excludeBase); setOptimiserArtefacts(suivante.optimiserArtefacts);
    setAdapterArtefactsAuTri(suivante.adapterArtefactsAuTri); setArtifactMainByKind(suivante.artifactMainByKind);
    setRelicMainChoice(suivante.relicMainChoice); setRelicUniqueChoice(suivante.relicUniqueChoice);
    setLignesVerrouillees(suivante.lignesVerrouillees); setMainStatsBySlot(suivante.mainStatsBySlot);
    setLockedRunes(suivante.lockedRunes); setObjective(suivante.objective); setDamageSetup(suivante.damageSetup);
    setSortBy(suivante.sortBy); setCompterAurasResPre(suivante.compterAurasResPre); setCritereArtefacts(suivante.critereArtefacts);
  }

  // Défauts et restaurations modifient l'affichage, jamais la mémoire :
  // seuls les setters de saisie et l'inclusion photographient des critères.
  function poserCriteresAutomatiques(patch: Partial<CriteresOptimizer> | ((courants: CriteresOptimizer) => Partial<CriteresOptimizer>)) {
    const courants = vivant.current.criteres;
    appliquerPhoto({ ...courants, ...(typeof patch === 'function' ? patch(courants) : patch) });
  }

  function traiterReliqueImportee(relique: Parameters<typeof defaultRelicMainChoice>[0]) {
    const v = vivant.current;
    if (importReliqueTraite.current === v.importDuCompte) return;
    importReliqueTraite.current = v.importDuCompte;
    // Un choix de membre écran démonté prime sur le défaut différé du compte.
    if (v.contexte && validerProprietaireCriteres(v.proprietaire, v.contexte.lists, v, v.contexte.data)) return;
    poserCriteresAutomatiques({ relicMainChoice: defaultRelicMainChoice(relique) });
  }

  function restaurerMembre(listId: string, selector: ExclusionSelector, choisir: boolean): CriteresOptimizer | null {
    if (choisir) captureEnAttente.current = null;
    const v = vivant.current, c = v.contexte;
    if (!c) return null;
    const resolu = resolveExclusionEntry(selector, c.data);
    if (!resolu?.monster.com2usId) {
      effacerProprietaireCriteres(); setRapportCriteres(['Membre introuvable : critères non restaurés.']); return null;
    }
    const affichage = choisir ? { selectedId: String(resolu.monster.id), sourceSelector: selector } : v;
    const candidat = { listId, selector, com2usId: resolu.monster.com2usId };
    const valide = validerProprietaireCriteres(candidat, c.lists, affichage, c.data);
    if (!valide) {
      effacerProprietaireCriteres();
      const identite = c.lists.identities.get(cleMemoireMembre(listId, selector));
      if (identite && identite.com2usId !== resolu.monster.com2usId) {
        setRapportCriteres(['Critères non restaurés : l’identité enregistrée du membre diffère de l’espèce résolue.']);
      }
      return null;
    }
    const memoire = c.lists.memories.get(cleMemoireMembre(listId, selector));
    const messages: string[] = [];
    if (memoire && memoire.com2usId !== valide.com2usId) {
      messages.push('Mémoire conservée sans application : l’espèce du membre ne correspond pas.');
    }
    const photo = memoire?.com2usId === valide.com2usId ? appliquerCriteres(memoire.criteres, { type: 'personnel' }) : null;
    // Une navigation de liste n'attribue jamais les critères courants à un
    // membre sans mémoire ; le clic explicite lui donne la base complète.
    if (!choisir && !photo) { effacerProprietaireCriteres(); setRapportCriteres(messages); return null; }
    const suivante = photo ?? baseCompleteCriteres(resolu.gear);
    const locks = Object.entries(suivante.lockedRunes);
    suivante.lockedRunes = Object.fromEntries(locks.filter(([, id]) => id != null && c.runeIds.has(id)));
    const ignores = locks.length - Object.keys(suivante.lockedRunes).length;
    if (ignores) messages.push(`${ignores} rune(s) imposée(s) ignorée(s) : absentes de ton inventaire.`);
    effacerResultats(); setSetPickerInvalid(false);
    if (choisir) {
      v.selectedId = affichage.selectedId; v.sourceSelector = selector;
      setSelectedId(affichage.selectedId); setSourceSelector(selector);
      if (selector.source !== 'unowned') setGearSource(selector.source);
    }
    appliquerPhoto(suivante);
    v.proprietaire = valide; setProprietaireCriteres(valide); setRapportCriteres(messages);
    // Le geste peut lire la destination réellement appliquée sans attendre
    // un rendu, ni résoudre une seconde fois la mémoire ou sa base.
    return photoCriteres(v.criteres, { type: 'personnel' });
  }

  function choisirMembre(listId: string, selector: ExclusionSelector) {
    return restaurerMembre(listId, selector, true);
  }

  function appliquerReverificationMembres(stockage: StockageOptimizer, rapport: RapportReverificationOptimizer, data: ExclusionSourceData, runeIds: Set<number>) {
    const v = vivant.current, c = v.contexte;
    const p = rattacherProprietaireCriteres(v.proprietaire, rapport.rattachements);
    const resolu = p ? resolveExclusionEntry(p.selector, data) : null;
    const affichage = { selectedId: resolu ? String(resolu.monster.id) : null, sourceSelector: p?.selector ?? null };
    const listes = c ? { ...c.lists, ...stockage } : null;
    if (!p || !listes || !validerProprietaireCriteres(p, listes, affichage, data)) { resetSearch('compte'); return; }
    // Publier aussi le contexte immédiat : l'effet de cohérence du rendu
    // précédent ne doit pas juger la nouvelle clé contre les anciennes listes.
    v.contexte = { lists: listes, data, runeIds };
    captureEnAttente.current = null;
    v.proprietaire = p; v.selectedId = affichage.selectedId; v.sourceSelector = p.selector;
    setProprietaireCriteres(p); setSelectedId(affichage.selectedId); setSourceSelector(p.selector);
    if (p.selector.source !== 'unowned') setGearSource(p.selector.source);
    const locks = Object.entries(v.criteres.lockedRunes);
    const lockedRunes = Object.fromEntries(locks.filter(([, id]) => id != null && runeIds.has(id)));
    const ignores = locks.length - Object.keys(lockedRunes).length;
    poserCriteresAutomatiques({ lockedRunes,
      ...(v.criteres.relicMainChoice === 'equipped' && !resolu?.gear.relic ? { relicMainChoice: 'libre' } : {}) });
    setRapportCriteres(ignores ? [`${ignores} rune(s) imposée(s) ignorée(s) : absentes de ton inventaire.`] : []);
    setImportDuCompte(n => n + 1);
    importReliqueTraite.current = v.importDuCompte + 1;
    effacerResultats();
  }

  function capturerMembre(listId: string, selector: ExclusionSelector) {
    const v = vivant.current, c = v.contexte;
    if (!c) return;
    const resolu = resolveExclusionEntry(selector, c.data);
    if (!resolu?.monster.com2usId) return;
    // Photographier au geste, puis valider contre l'appartenance réellement
    // publiée par les listes. Cela couvre aussi « créer et ajouter ».
    captureEnAttente.current = { proprietaire: { listId, selector, com2usId: resolu.monster.com2usId },
      criteres: photoCriteres(v.criteres, { type: 'personnel' }) };
  }

  function saisie<K extends keyof CriteresOptimizer>(champ: K, setter: Dispatch<SetStateAction<CriteresOptimizer[K]>>): Dispatch<SetStateAction<CriteresOptimizer[K]>> {
    return (valeur) => {
      const v = vivant.current;
      const suivante = typeof valeur === 'function' ? (valeur as (a: CriteresOptimizer[K]) => CriteresOptimizer[K])(v.criteres[champ]) : valeur;
      v.criteres = { ...v.criteres, [champ]: suivante };
      setter(suivante);
      const c = v.contexte;
      const p = c ? validerProprietaireCriteres(v.proprietaire, c.lists, v, c.data) : null;
      if (p && c) c.lists.writeMemory(p, photoCriteres(v.criteres, { type: 'personnel' }), c.data);
      else if (v.proprietaire) effacerProprietaireCriteres();
    };
  }

  const lireCombatMembre = useCallback(() => {
    const v = vivant.current, c = v.contexte;
    const p = c ? validerProprietaireCriteres(v.proprietaire, c.lists, v, c.data) : null;
    const resolu = p && c ? resolveExclusionEntry(p.selector, c.data) : null;
    if (!p || !c || !resolu) return { setup: v.criteres.damageSetup, equipe: null, motif: null };
    const equipe = c.lists.teams.find(e => e.listId === p.listId && e.members.some(s => cleMemoireMembre(e.listId, s) === cleMemoireMembre(p.listId, p.selector))) ?? null;
    if (!equipe) return { setup: v.criteres.damageSetup, equipe: null, motif: null };
    const effectif = leadEffectifMembreOptimizer(c.lists, p.listId, p.selector, resolu.monster.element);
    return { setup: appliquerCriteres(v.criteres, effectif).damageSetup, equipe,
      motif: effectif.type === 'aucun' ? effectif.motif : null };
  }, []);

  function modifierLeadMembre(lead: DamageSetup['leaderSkill']) {
    const v = vivant.current, c = v.contexte;
    const { equipe } = lireCombatMembre();
    if (!equipe || !c) {
      saisie('damageSetup', setDamageSetup)({ ...v.criteres.damageSetup, leaderSkill: lead, leaderSpeedPct: undefined });
      return;
    }
    // Le contrôle d'état modifie le lead partagé, jamais le lead personnel.
    // Sa portée reste celle de l'équipe ; un premier choix est global.
    const nouveau: LeaderSkill | null = lead ? { stat: lead.stat, amount: lead.pct,
      area: equipe.lead?.area ?? 'General', element: equipe.lead?.element ?? null } : null;
    const resultat = modifierEquipeOptimizer(c.lists, { ...equipe, lead: nouveau });
    if (resultat.rapport.length) setRapportCriteres(resultat.rapport);
    else c.lists.setTeams(resultat.teams);
  }

  const listePrecedente = useRef(contexte?.lists.activeListId);
  function reconcilierMembre() {
    const v = vivant.current, c = v.contexte;
    if (!c) return;
    const capture = captureEnAttente.current;
    if (capture) {
      // Un effet du rendu précédent peut être vidé avant les mises à jour
      // du geste. Attendre son appartenance publiée, sans consommer la photo.
      if (c.lists.activeListId !== capture.proprietaire.listId
        || !c.lists.members.some(m => cleMemoireMembre(m.listId, m.selector) === cleMemoireMembre(capture.proprietaire.listId, capture.proprietaire.selector))) return;
      captureEnAttente.current = null;
      const p = validerProprietaireCriteres(capture.proprietaire, c.lists, v, c.data);
      if (p) {
        v.proprietaire = p; setProprietaireCriteres(p);
        c.lists.writeMemory(p, capture.criteres, c.data);
        listePrecedente.current = c.lists.activeListId;
      } else setRapportCriteres(['Critères non mémorisés : le membre affiché ou son espèce a changé.']);
    }
    if (listePrecedente.current !== c.lists.activeListId) {
      listePrecedente.current = c.lists.activeListId;
      if (c.lists.activeListId && v.sourceSelector) restaurerMembre(c.lists.activeListId, v.sourceSelector, false);
      else effacerProprietaireCriteres();
    } else if (v.proprietaire && !validerProprietaireCriteres(v.proprietaire, c.lists, v, c.data)) effacerProprietaireCriteres();
  }
  // Les callbacks utilisent le dernier contexte publié, y compris lorsqu'un
  // geste a été groupé avec une mutation des listes dans le même rendu.
  useEffect(() => { reconcilierMembre(); });

  function resetSearch(motif: 'monstre' | 'compte' = 'monstre') {
    effacerProprietaireCriteres();
    const raison = motif === 'compte' ? 'compte' : 'membre';
    const suivant = criteresApresChangementEspece({ damageSetup, compterAurasResPre, critereArtefacts }, raison, undefined);
    vivant.current.criteres = suivant;
    setComboSets(suivant.comboSets);
    setSetPickerInvalid(false);
    setMinStats(suivant.minStats);
    setMaxStats(suivant.maxStats);
    setExcludeBase(suivant.excludeBase);
    setOptimiserArtefacts(suivant.optimiserArtefacts);
    setAdapterArtefactsAuTri(suivant.adapterArtefactsAuTri);
    setArtifactMainByKind(suivant.artifactMainByKind);
    // ⚠️ Défaut statique ici — voir le commentaire du `useState` ci-dessus ;
    // `pickSpecies` surcharge avec `defaultRelicMainChoice` juste après cet
    // appel, comme il le fait déjà pour `objective`.
    setRelicMainChoice(suivant.relicMainChoice);
    setRelicUniqueChoice(suivant.relicUniqueChoice);
    // ⚠️ Remis à zéro au changement de monstre, comme les runes imposées : une
    // ligne verrouillée exclusive à une sorte (« Précision Compétence 3 »)
    // n'a de sens que pour le monstre pour lequel on l'a choisie, et une
    // exigence oubliée d'un monstre précédent rendrait « 0 build » sans que
    // rien ne rappelle d'où elle vient.
    setLignesVerrouillees(suivant.lignesVerrouillees);
    setMainStatsBySlot(suivant.mainStatsBySlot);
    // ⚠️ Une rune imposée référence un `runeId` PRÉCIS, choisi pour l'ancien
    // monstre — le garder verrouillerait la recherche du nouveau sur une
    // rune qui n'a plus rien à voir (et la rendrait probablement vide).
    setLockedRunes(suivant.lockedRunes);
    setObjective(suivant.objective);
    // Un compte importé efface tout ; un changement de monstre conserve le
    // contexte commun et vide les réglages indexés par sort ou passif.
    setDamageSetup((s) => criteresApresChangementEspece({ damageSetup: s, compterAurasResPre, critereArtefacts }, raison, undefined).damageSetup);
    if (motif === 'compte') setCompterAurasResPre(suivant.compterAurasResPre);
    // ⚠️ Chaque import est un NOUVEL import : remettre les réglages
    // par défaut ne changeait pas toujours la signature de la file (réglages
    // déjà par défaut, même monstre, même relique, même nombre d'artéfacts),
    // et une nouvelle recherche reprenait du cache des paires de l'ancien
    // compte. Avancé ici, la signature change à coup sûr.
    if (motif === 'compte') setImportDuCompte((n) => n + 1);
    // Le tri suit l'objectif (`handleSearch` le repose dessus au lancement) :
    // il retombe avec lui ici, et reste avec lui au changement d'exemplaire.
    setSortBy(suivant.sortBy);
    effacerResultats();
  }

  // ⚠️ **Une seule fonction pour l'effacement des résultats** :
  // le changement d'espèce (`resetSearch`) et le changement d'exemplaire de
  // la même espèce (OptimizerSection.tsx, zone C) effacent EXACTEMENT la même
  // chose — une copie de ces quatre lignes divergerait au premier ajout.
  function effacerResultats() {
    setResultsPage(1);
    setStoppedManually(false);
    setOpenDetailKey(null);
    search.reset();
  }

  return {
    proprietaireCriteres: contexte ? validerProprietaireCriteres(proprietaireCriteres, contexte.lists, { selectedId, sourceSelector }, contexte.data) : null,
    rapportCriteres,
    lireCombatMembre,
    modifierLeadMembre,
    effacerProprietaireCriteres,
    choisirMembre,
    capturerMembre,
    poserCriteresAutomatiques,
    traiterReliqueImportee,
    appliquerReverificationMembres,
    poserTriRecherche: (tri) => poserCriteresAutomatiques({ sortBy: tri }),
    selectedId,
    setSelectedId: (valeur) => { effacerProprietaireCriteres(); const v = vivant.current; v.selectedId = typeof valeur === 'function' ? valeur(v.selectedId) : valeur; setSelectedId(v.selectedId); },
    gearSource,
    setGearSource: (valeur) => { effacerProprietaireCriteres(); setGearSource(valeur); },
    sourceSelector,
    setSourceSelector: (valeur) => { effacerProprietaireCriteres(); const v = vivant.current; v.sourceSelector = typeof valeur === 'function' ? valeur(v.sourceSelector) : valeur; setSourceSelector(v.sourceSelector); },
    comboSets,
    setComboSets: saisie('comboSets', setComboSets),
    setPickerInvalid,
    setSetPickerInvalid,
    minStats,
    setMinStats: saisie('minStats', setMinStats),
    maxStats,
    setMaxStats: saisie('maxStats', setMaxStats),
    excludeBase,
    setExcludeBase: saisie('excludeBase', setExcludeBase),
    optimiserArtefacts,
    setOptimiserArtefacts: saisie('optimiserArtefacts', setOptimiserArtefacts),
    adapterArtefactsAuTri,
    setAdapterArtefactsAuTri: saisie('adapterArtefactsAuTri', setAdapterArtefactsAuTri),
    artifactMainByKind,
    setArtifactMainByKind: saisie('artifactMainByKind', setArtifactMainByKind),
    relicMainChoice,
    setRelicMainChoice: saisie('relicMainChoice', setRelicMainChoice),
    relicUniqueChoice,
    setRelicUniqueChoice: saisie('relicUniqueChoice', setRelicUniqueChoice),
    relicMinUpgrade,
    setRelicMinUpgrade,
    lignesVerrouillees,
    setLignesVerrouillees: saisie('lignesVerrouillees', setLignesVerrouillees),
    mainStatsBySlot,
    setMainStatsBySlot: saisie('mainStatsBySlot', setMainStatsBySlot),
    lockedRunes,
    setLockedRunes: saisie('lockedRunes', setLockedRunes),
    objective,
    setObjective: saisie('objective', setObjective),
    damageSetup,
    setDamageSetup: saisie('damageSetup', setDamageSetup),
    compterAurasResPre,
    setCompterAurasResPre: saisie('compterAurasResPre', setCompterAurasResPre),
    critereArtefacts,
    setCritereArtefacts: saisie('critereArtefacts', setCritereArtefacts),
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
    setSortBy: saisie('sortBy', setSortBy),
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
    importReliqueTraite,
    search,
    resetSearch,
    effacerResultats,
  };
}
