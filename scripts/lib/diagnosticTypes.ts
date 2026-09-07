// Le vocabulaire du harnais de diagnostic — types seuls, aucune logique.
// Cadrage complet : spec/outils/optimizer/harnais-diagnostic.md.
//
// **Principe directeur, qui tranche tout ce qui suit :**
//
// > Le harnais ORCHESTRE et OBSERVE les fonctions de production.
// > Il ne réimplémente AUCUNE étape algorithmique.
//
// Conséquence sur ces types : ils décrivent ce qu'on OBSERVE (quel étage a
// écarté quoi, quel régime s'est appliqué, pourquoi la recherche s'est
// arrêtée), jamais un état que le moteur ne produirait pas lui-même.

import { PrepareStage } from '../../src/lib/runeBuildOptim';
import { ModeChargement } from './chargerRecette';

/* --------------------------------------------------------------------------
 * Configuration — §4 du cadrage
 * ----------------------------------------------------------------------- */

/**
 * D'où vient le pool. ⚠️ Les deux sources ne répondent pas à la même
 * question, et la provenance figure TOUJOURS dans le résultat :
 * - `recette` : « pourquoi ce cas concret de mon compte donne-t-il ça ? » —
 *   fidélité maximale, chemin de prod complet.
 * - `synthetique` : « quel comportement produit ce mécanisme, de façon
 *   reproductible ? » — fidélité contrôlée, pool forcé.
 */
export type SourceHarnais =
  | { type: 'recette'; cheminCompte: string; cheminRecette: string; mode?: ModeChargement }
  | {
      type: 'synthetique';
      seed: number;
      runesParEmplacement: number;
      /** Défaut : `SETS_JOKER` (voir scripts/lib/randomPool.ts). */
      sets?: string[];
      requirement: SyntheticRequirement;
      objective?: SyntheticObjective;
      /**
       * ⚠️ **OBLIGATOIRE, aucun repli** (§4.4 règle 4). Omis, le moteur
       * retomberait sur `MAX_PER_SLOT_MATCH` = 40 — la MOITIÉ du préréglage
       * réel de l'app (« Moyen », 80) — et entraînerait `bucketCap` avec lui
       * (3000 au lieu de 6000). Le run mesurerait alors la moitié de la
       * rétention de production sur les DEUX axes, en silence.
       */
      slotFilterCap: number;
    };

// Réexports pour que l'appelant n'ait pas à importer le moteur juste pour
// décrire une exigence — le type reste celui du moteur, jamais une copie.
export type SyntheticRequirement = import('../../src/lib/runeBuildOptim').BuildRequirement;
export type SyntheticObjective = import('../../src/lib/runeBuildOptim').Objective;

/**
 * La surface d'override — exactement les paramètres que la recette ne porte
 * pas (ils ne sont pas exposés dans l'UI), plus `slotFilterCap` qu'elle
 * porte sous forme de préréglage.
 *
 * ⚠️ `maxNodes` N'EXISTE PLUS (piste 8) : il n'y a plus aucun plafond de
 * paires, et un harnais qui en réintroduirait un dans sa propre boucle de
 * pilotage mesurerait une recherche tronquée que la production ne fait pas.
 * ⚠️ `maxMs`, lui, est désormais la SEULE borne pouvant tronquer : c'est le
 * premier paramètre à vérifier dans tout run (15 s de défaut moteur contre
 * 10 min à l'écran).
 */
export interface OverridesHarnais {
  bucketCap?: number;
  maxCollected?: number;
  maxMs?: number;
  slotFilterCap?: number;
  combosOrderMode?: import('../../src/lib/runeBuildOptim').SearchParams['combosOrderMode'];
  /**
   * Forcer un régime d'appariement. ⚠️ Par défaut le harnais N'EN CHOISIT
   * PAS : il applique le seuil de la production (`PARALLEL_PAIRING_THRESHOLD`
   * contre `totalPairCount`), donc il est fidèle par construction. Forcer
   * est un override au sens plein — marqué, avec le drapeau de fidélité.
   * Deux usages légitimes : la reproductibilité (l'ordre de collecte
   * parallèle dépend de l'ordonnancement des fils) et le différentiel
   * séquentiel/parallèle.
   */
  regime?: RegimeAppariement;
}

export type RegimeAppariement = 'sequentiel' | 'parallele';

/**
 * Où s'arrêter. ⚠️ Les quatre premières valeurs sont des étages de la
 * PRÉPARATION : s'y arrêter ne coupe pas `prepareSearch` en son milieu (les
 * quatre étages s'exécutent d'un bloc, pour ~2 s au total, et les couper
 * demanderait de lever une exception depuis l'observateur). Ça veut dire :
 * la préparation tourne, la restitution s'arrête à cet étage, et RIEN de la
 * construction des demi-builds n'est lancé — c'est là qu'est le vrai coût.
 */
export type ArretApres = PrepareStage | 'demi-builds' | 'appariement' | 'classement';

export interface ConfigHarnais {
  source: SourceHarnais;
  overrides?: OverridesHarnais;
  /** Défaut : `'classement'` — la recherche complète, classée. */
  arretApres?: ArretApres;
  /**
   * Pièces à suivre d'étage en étage (§6.1). Ids de runes en V1.
   * ⚠️ Un id absent du pool d'entrée est signalé comme tel, jamais confondu
   * avec « écartée dès le premier étage ».
   */
  suivre?: number[];
  /**
   * Force le classement des conditions bloquantes (`rankBlockingConditions`).
   *
   * ⚠️ COÛTEUX — une dichotomie PAR condition, chacune relançant le
   * pré-filtrage plusieurs fois. Sans ce drapeau, il n'est calculé QUE si la
   * recherche n'a rendu aucun candidat, c'est-à-dire au seul moment où on en
   * a besoin.
   */
  blocages?: boolean;
  /**
   * Répétitions de la mesure de temps (§6.4 bis). Défaut 1.
   * ⚠️ À 1, AUCUNE dispersion n'est disponible : la mesure est marquée comme
   * n'autorisant aucune conclusion comparative.
   */
  repetitions?: number;
}

/* --------------------------------------------------------------------------
 * Paramètres effectifs et fidélité — §4.4 du cadrage
 * ----------------------------------------------------------------------- */

/**
 * D'où vient la valeur d'un paramètre — pas seulement sa valeur.
 * ⚠️ `dérivé` rend visible le piège de la cascade : surcharger
 * `slotFilterCap` déplace AUSSI `bucketCap`. Deux paramètres bougent, un
 * seul a été touché.
 */
export type OrigineParametre =
  | 'recette'
  | 'config synthétique'
  | 'défaut moteur'
  | 'dérivé'
  | 'override'
  /**
   * ⚠️ **Un paramètre EFFECTIF que le harnais ne sait pas surcharger.**
   * `resoudreConfig` listait la surface d'OVERRIDE, pas la surface
   * EFFECTIVE — alors que le §4.4 règle 2 dit « chaque paramètre EFFECTIF
   * affiche son origine ». Manquaient `objective`/`objectiveStats` (un
   * levier de rétention ×4 : `PER_STAT_KEEP` 6 contre
   * `PER_STAT_KEEP_OBJECTIVE` 24), `adaptiveTrancheWeighting`, `metric`,
   * la recherche exhaustive et la composition du pool.
   *
   * ⚠️ **Ce n'est PAS une infidélité** : la valeur appliquée est bien celle
   * de la production. C'était un ANGLE MORT de l'aperçu — le drapeau de
   * fidélité ne change donc pas de verdict pour ces lignes (leur
   * `valeurProd` est leur valeur), seulement de libellé (§3.4).
   */
  | 'recette (non surchargeable)';

export interface ParametreEffectif {
  nom: string;
  valeur: number | string | boolean;
  origine: OrigineParametre;
  /** Pour `dérivé` : de quel paramètre cette valeur découle. */
  derivéDe?: string;
  /** La valeur qu'aurait la PRODUCTION, quand elle diffère. */
  valeurProd?: number | string | boolean;
}

/**
 * ⚠️ **La marque voyage avec le résultat.** Un nombre produit par le harnais
 * ne doit jamais pouvoir être relu comme « ce que fait la prod » s'il ne
 * l'est pas — y compris une fois collé dans une conversation, détaché de son
 * contexte.
 */
export interface Fidelite {
  /**
   * ⚠️ **Porte sur les paramètres de la table `parametres`, et sur eux
   * seuls.** Le libellé rendu dit donc « fidélité des paramètres SUIVIS »,
   * jamais « conforme à la production » tout court : la phrase que le code
   * démontre est *« les paramètres que le harnais compare sont
   * conformes »*, ce qui n'est pas la même proposition.
   */
  divergeDeLaProd: boolean;
  ecarts: { nom: string; valeur: number | string | boolean; valeurProd: number | string | boolean }[];
  /**
   * Ce que la comparaison des paramètres ne peut PAS prouver, quelle que
   * soit l'étendue de la table — à imprimer avec le verdict, plutôt que de
   * laisser lire le drapeau comme une garantie générale.
   */
  horsPerimetre: string[];
  /**
   * ⚠️ Un écart que même la parallélisation partagée ne comble pas : le
   * navigateur rend la main toutes les 50 ms et plafonne à ~4 ms un
   * `setTimeout(0)` enchaîné — ~7 % de surcoût que Node ne paie pas.
   *
   * ⚠️ **Le mot « plancher » a été RETIRÉ** (2026-09-07) : c'était une
   * affirmation de DIRECTION, et la direction n'est pas établie. La taxe de
   * `setTimeout(0)` est bien un terme à sens unique, mais ce n'est pas le
   * seul écart entre les deux plateformes (JIT, démarrage des workers,
   * sérialisation). Chiffre ARITHMÉTIQUE, jamais mesuré.
   */
  noteNavigateur: string;
}

/* --------------------------------------------------------------------------
 * Complétude — §6.2 du cadrage
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **DEUX motifs, et deux seulement** depuis la piste 8 : le budget de
 * paires n'existe plus.
 */
export type MotifTroncature = 'maxMs' | 'maxCollected';

export interface Completude {
  /**
   * ⚠️ **Jamais `true` en même temps qu'une `incoherence`.** Le harnais a
   * porté cette contradiction : il annonçait dans le même objet « la
   * recherche est complète » ET « elle n'a pas exploré tout l'espace ». Un
   * lecteur JSON qui teste ce booléen était trompé — et un outil de
   * diagnostic se trompe avec l'autorité d'un diagnostic.
   */
  complet: boolean;
  /**
   * ⚠️ **`undefined` quand la cause n'est pas DÉDUCTIBLE**, jamais un motif
   * par défaut. La déduction quota/temps ne vaut que là où `truncated` sort
   * vrai (voir `evaluerCompletude`) ; dans le cas incohérent ci-dessous, on
   * sait que la recherche est incomplète et on ne sait PAS pourquoi.
   */
  motif?: MotifTroncature;
  explored: number;
  /** La borne EXACTE de l'espace (`totalPairCount`). */
  totalPairs: number;
  /**
   * ⚠️ **Autodiagnostic gratuit.** `totalPairCount` vaut exactement ce que
   * `pairBuckets` explore sur une recherche non tronquée (égalité vérifiée
   * sur 15 scénarios par `rune-optim-differential.test.ts`). Un run annoncé
   * complet dont `explored < totalPairs` a donc été tronqué malgré tout —
   * on le DIT, on ne le laisse pas déduire, et le verdict public bascule
   * en INCOMPLET SANS MOTIF plutôt que de rester « complet ».
   */
  incoherence?: string;
  /**
   * ⚠️ Une configuration invalide (un emplacement vidé, une condition prouvée
   * infaisable) n'est PAS un verdict algorithmique sur le build. Renseigné,
   * ce champ dit que le « 0 candidat » ne conclut rien.
   *
   * ⚠️ Il NOMME la cause quand elle est identifiable — en particulier une
   * rune IMPOSÉE introuvable ou posée au mauvais emplacement, qui vide
   * l'emplacement *exprès* (comportement documenté du moteur : mieux vaut
   * zéro build qu'un build qui ignore le verrou). Dire « emplacement 3
   * vide » sans dire « parce que la rune imposée #X n'existe pas dans ce
   * pool » laisserait lire une limite de l'algorithme là où il n'y a qu'une
   * configuration impossible.
   */
  configurationInvalide?: string;
}

/* --------------------------------------------------------------------------
 * Faisabilité — §6.3 du cadrage
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **PREUVE, pas indice.** `diagnoseFeasibility` isole UNE stat et
 * calcule sa borne atteignable : `satisfiable: false` est une impossibilité
 * MATHÉMATIQUE — aucune recherche, aussi longue soit-elle, ne satisfera
 * jamais cette condition. L'inverse n'est PAS vrai : `true` ne dit pas
 * qu'un build existe, seulement que rien ne prouve le contraire sur cette
 * stat prise seule (les contraintes conjuguées peuvent rester infaisables).
 * Confondre les deux sens est exactement ce que le harnais doit empêcher.
 */
export interface PreuveFaisabilite {
  stat: string;
  borne: 'min' | 'max';
  demande: number;
  /** Minimum : meilleur total ATTEIGNABLE. Maximum : plancher INCOMPRESSIBLE. */
  atteignable: number;
  /** `false` = preuve d'impossibilité. `true` = absence de preuve, rien de plus. */
  satisfiable: boolean;
}

/**
 * ⚠️ **INDICE, pas preuve.** `rankBlockingConditions` cherche par dichotomie,
 * pour chaque condition posée, DE COMBIEN la desserrer suffit à faire
 * grandir le pool le plus restreint (toutes les AUTRES conditions restent en
 * l'état). Ça classe les conditions par effort de desserrage — ça ne
 * démontre rien : un seuil qui libère peu de candidats ICI peut quand même,
 * une fois combiné aux autres via `filterSlot`/`buildBuckets`, se comporter
 * différemment en pratique.
 *
 * ⚠️ **Coûteux** : une dichotomie par condition, chacune relançant le
 * pré-filtrage O(log(plage)) fois. D'où `coutMs`, rendu avec le résultat —
 * un diagnostic dont on ignore le prix finit par être lancé au mauvais
 * moment.
 */
export interface IndiceBlocage {
  stat: string;
  borne: 'min' | 'max';
  demande: number;
  /**
   * Nouveau seuil (min abaissé, ou max relevé) à partir duquel le pool le
   * plus restreint dépasse `poolMinActuel`. `null` : aucun gain, même
   * desserrée jusqu'à l'extrême praticable.
   */
  seuil: number | null;
  /** `demande - seuil` (min) ou `seuil - demande` (max). `null` ssi `seuil` l'est. */
  ecart: number | null;
  /** Taille du pool le plus restreint À `seuil`. `null` ssi `seuil` l'est. */
  poolAuSeuil: number | null;
}

export interface Faisabilite {
  /** Toujours calculé : une seule passe sur le pool. */
  preuves: PreuveFaisabilite[];
  /** ⚠️ Renseigné SEULEMENT si demandé ou si la recherche n'a rien rendu. */
  blocages?: {
    /** Le repère : le pool le plus restreint avec TOUTES les conditions. */
    poolMinActuel: number;
    impacts: IndiceBlocage[];
    coutMs: number;
  };
}

/* --------------------------------------------------------------------------
 * Temps — §6.4 et §6.4 bis du cadrage
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **Aucun temps livré NU.** Le MINIMUM est l'estimateur le plus propre
 * (une interférence ne peut qu'AJOUTER du temps), la MÉDIANE dit si la série
 * est stable, la DISPERSION dit si un écart observé veut dire quelque chose.
 */
export interface SerieTemps {
  repetitions: number;
  min: number;
  mediane: number;
  /** (max − min) / min, en %. Le plancher de bruit connu vaut 2 à 4,5 %. */
  dispersionPct: number;
  valeurs: number[];
  /** Renseigné à `repetitions === 1` : aucune conclusion comparative. */
  avertissement?: string;
}

/**
 * Le budget `maxMs` court depuis `startedAt`, CONSTRUCTION DES DEMI-BUILDS
 * COMPRISE — sinon paralléliser la construction reculerait silencieusement
 * l'échéance. D'où le découpage par phase, jamais le seul appariement
 * présenté comme la durée du run.
 */
export interface TempsParPhase {
  preparation: SerieTemps;
  /**
   * Le temps RÉEL de la phase de construction — les deux moitiés étant
   * bâties EN PARALLÈLE sur deux fils, comme en production. C'est donc le
   * plus lent des deux, pas leur somme.
   */
  demiBuilds: SerieTemps;
  /**
   * Le coût interne de chaque fil. ⚠️ Sans eux, une construction « lente
   * malgré la parallélisation » est inexplicable : paralléliser ne fait
   * jamais mieux que la moitié la plus lourde, et le déséquilibre A/B est
   * réel (5,5 s contre 2,9 s sur un cas de la baseline).
   */
  demiBuildA: SerieTemps;
  demiBuildB: SerieTemps;
  appariement: SerieTemps;
  total: SerieTemps;
  /**
   * ⚠️ **Le garde-fou du niveau 2** (§6.4 bis). Le harnais sait répéter UNE
   * condition ; il ne sait pas ENTRELACER deux conditions. Quelqu'un qui veut
   * comparer deux configurations lancera donc deux runs séparés — c'est-à-dire
   * exactement le protocole en BLOCS dont le biais est documenté : chaque
   * condition occupe toujours la même position dans la séquence, donc tout
   * effet lié à cette position (échauffement thermique, état du GC, montée en
   * fréquence) revient identique à chaque exécution. Vécu : +4,8 % obtenu
   * DEUX FOIS de suite, pris pour une reproductibilité ; +0,3 % au protocole
   * entrelacé. **Répéter ne corrige que le bruit aléatoire, jamais un biais
   * systématique.** Ce texte accompagne donc toute mesure de temps, plutôt
   * que de laisser la limite se découvrir après une conclusion fausse.
   */
  avertissementComparaison: string;
}

/* --------------------------------------------------------------------------
 * Suivi d'une pièce d'étage en étage — §6.1 et §6.1 bis du cadrage
 * ----------------------------------------------------------------------- */

/**
 * La nature d'un étage décide de ce qu'une disparition SIGNIFIE — sans elle,
 * le verdict ne veut rien dire.
 * - `contrainte` : la pièce ne pouvait pas satisfaire une exigence posée.
 * - `sûr` : élagage PROUVÉ — la pièce ne peut entrer dans aucun build valide.
 * - `mixte` : ⚠️ `filterSlot` contient un élagage SÛR en tête (le cas
 *   « combo à coût complet ») ET une rétention HEURISTIQUE top-K. Dire
 *   « éliminée par filterSlot » resterait donc ambigu.
 */
export type NatureEtage = 'contrainte' | 'sûr' | 'mixte';

/**
 * ⚠️ **Générique par construction, un seul consommateur en V1.** Le principe
 * (identifiant stable suivi d'étage en étage, première disparition, nature de
 * l'étage) vaut pour les runes, les artéfacts et les reliques — mais les
 * ÉTAGES, eux, ne transposent PAS d'un équipement à l'autre. On pose la
 * couture, on ne la multiplie pas : V1 ne branche que les runes.
 */
export interface EtagePopulation {
  nom: string;
  nature: NatureEtage;
  /** Les identifiants encore présents à la SORTIE de cet étage. */
  presents: Set<number>;
}

/**
 * ⚠️ **Remplace `monster-search-filterslot-diag.ts`.** Le rang exact d'une
 * rune SUIVIE dans le classement interne de `filterSlot` — sur `relevance()`
 * (le score combiné qui alimente `matchCap`/`fillCap`) et sur chaque stat
 * individuelle (budgets `PER_STAT_KEEP`/`PER_STAT_KEEP_OBJECTIVE`). Calculé
 * sur le pool RÉEL en entrée de `filterSlot` (la sortie de l'étage
 * `feasibility`, jamais reconstruit) — seulement pour une rune qui a survécu
 * jusque-là : le rang n'a aucun sens pour une rune déjà écartée avant.
 */
export interface DetailFiltrage {
  relevance: { rang: number; total: number; score: number; meilleur: number };
  /** `null` si la rune n'appartient à aucun set demandé (hors « matches »). */
  relevanceParmiSet: { rang: number; total: number } | null;
  parStat: {
    stat: string;
    rang: number;
    total: number;
    /** Le budget de rétention pour cette stat — 24 si stat de l'objectif, 6 sinon. */
    keepN: number;
    retenue: boolean;
    valeur: number;
    meilleure: number;
  }[];
}

export interface TraceSurvie {
  id: number;
  /** `false` = jamais entrée dans le pool — pas « écartée au premier étage ». */
  presenteAuDepart: boolean;
  parEtage: { etage: string; nature: NatureEtage; present: boolean }[];
  /** Le premier étage qui l'a fait disparaître, avec ce que ça signifie. */
  premiereDisparition?: { etage: string; nature: NatureEtage; signification: string };
  /** Présent seulement si la rune a survécu à `feasibility` (entrée réelle de `filterSlot`). */
  detailFiltrage?: DetailFiltrage;
}

/* --------------------------------------------------------------------------
 * Détail d'un demi-build suivi — remplace `half-build-rank-diag.ts` et
 * `monster-search-buildbuckets-diag.ts`
 * ----------------------------------------------------------------------- */

/** Une entrée de `Bucket.combos`, restituée sans recalcul (déjà produite par `buildBuckets`). */
export interface DemiBuildCombo {
  runeIds: number[];
  relevanceScore: number;
  parStat: { stat: string; pct: number; flat: number }[];
}

/**
 * ⚠️ Déclenché automatiquement quand `--suivre` porte EXACTEMENT les 3 runes
 * d'une même moitié (3 emplacements distincts, 1-3 ou 4-6) — aucune option
 * séparée : le principe de suivi générique (§6.1 bis du cadrage) s'étend
 * naturellement à un demi-build dès que ses 3 pièces sont suivies ensemble.
 */
export interface DetailDemiBuild {
  moitie: 'A' | 'B';
  runeIds: number[];
  /** Renseigné seulement si le demi-build cible est ABSENT de tous les compartiments retenus. */
  absent?: string;
  compartimentRang?: number;
  compartimentTotal?: number;
  comboRang?: number;
  comboTotal?: number;
  cible?: DemiBuildCombo;
  /** Les mieux classés de son compartiment — jamais recalculés, lus sur `Bucket.combos`. */
  meilleurs?: DemiBuildCombo[];
}

/* --------------------------------------------------------------------------
 * Le résultat complet
 * ----------------------------------------------------------------------- */

export interface TaillesParEtage {
  etage: string;
  nature: NatureEtage;
  /** Le nombre de runes restantes, emplacement par emplacement. */
  parEmplacement: number[];
  total: number;
}

export interface ResultatHarnais {
  /** La provenance du pool figure TOUJOURS dans le résultat (§4.2). */
  source: 'recette' | 'synthetique';
  descriptionSource: string;
  parametres: ParametreEffectif[];
  fidelite: Fidelite;
  avertissements: string[];
  arretApres: ArretApres;

  /** Palier 2 — tailles de pool par emplacement à chaque étage. */
  preparation: TaillesParEtage[];
  suivi: TraceSurvie[];
  /**
   * §6.3 — ce qui est PROUVÉ impossible, et ce qui n'est qu'un indice.
   * ⚠️ Calculé HORS des chronos de phase : c'est un diagnostic, il n'a
   * aucune raison d'entrer dans le temps qu'on attribue à la préparation.
   */
  faisabilite: Faisabilite;
  /**
   * Les bornes RÉELLEMENT utilisées par l'étage de faisabilité, stat
   * contrainte par stat contrainte.
   *
   * ⚠️ **Sans elles, « aucune rune éliminée » est indistinguable de « la
   * correction n'est pas active ».** Les 6 scripts historiques appelaient
   * `eliminateInfeasible` sans `guaranteedMin` ni `artFlatMin`, et bornaient
   * l'apport d'artéfact à la paire FIGÉE du monstre au lieu de ce que
   * l'inventaire peut donner. Un diagnostic qui ne montre pas ses bornes ne
   * permet pas de savoir laquelle des deux versions il exécute — c'est
   * exactement le genre de silence qui a coûté cher.
   */
  bornesFaisabilite: {
    stat: string;
    /** Apport de sets GARANTI (sert les maximums). */
    guaranteed: { pct: number; flat: number };
    /** Apport de sets garanti côté MINIMUM — inclut la marge d'activation
     *  supplémentaire, donc ≥ `guaranteed`. Absent des 6 scripts. */
    guaranteedMin: { pct: number; flat: number };
    /** Meilleur apport d'artéfact ATTEIGNABLE (sert les minimums). */
    artFlatMax: number;
    /** Apport d'artéfact INCOMPRESSIBLE (sert les maximums). */
    artFlatMin: number;
  }[];

  /** Absents si l'arrêt a eu lieu avant leur phase. */
  demiBuilds?: { compartimentsA: number; compartimentsB: number; combosA: number; combosB: number };
  /**
   * Rang et voisinage d'un demi-build suivi dans son compartiment — voir
   * `DetailDemiBuild`. Absent si aucun trio de `--suivre` ne forme une moitié
   * complète, ou si l'arrêt a eu lieu avant la construction des demi-builds.
   */
  detailDemiBuilds?: DetailDemiBuild[];
  regime?: { applique: RegimeAppariement; totalPairs: number; seuil: number; force: boolean; explication: string };
  completude?: Completude;
  /**
   * ⚠️ **Toujours classés par `sortCandidates`**, jamais `candidates[0]` :
   * l'ordre de collecte de l'appariement n'est PAS celui de l'objectif. Un
   * diagnostic a déjà conclu « le moteur manque un build meilleur » en lisant
   * le premier élément d'une liste non triée — le build cherché était au
   * rang 6.
   */
  meilleurs?: { runeIds: number[]; total: number }[];
  temps?: TempsParPhase;
  /**
   * Diagnostic « quasi-succès » — voir spec/outils/optimizer/
   * near-miss-appariement.md. Sous-produit GRATUIT de l'appariement réel
   * (`pairBuckets`), jamais recalculé : les paires EXPLORÉES qui échouent
   * le test conjoint exact, mais s'en approchent le plus. Absent si
   * `meilleurs` n'est PAS vide (rien à chercher), ou si l'arrêt a eu lieu
   * avant la phase d'appariement.
   */
  quasiSucces?: {
    /** Une entrée par condition où une paire explorée échoue SEULEMENT sur elle. */
    parCondition: { stat: string; borne: 'min' | 'max'; quasiSucces: QuasiSucces }[];
    /** La paire la plus proche toutes conditions confondues. `null` si aucune paire n'a jamais atteint le test conjoint. */
    global: QuasiSucces | null;
  };
}

export interface QuasiSucces {
  runeIds: number[];
  /** Recalculé (`candidateMetricTotal`), jamais `effTotal` figé — même
   *  convention que `meilleurs` ci-dessus. */
  total: number;
  manques: { stat: string; borne: 'min' | 'max'; demande: number; atteint: number; manque: number }[];
}
