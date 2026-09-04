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
export type OrigineParametre = 'recette' | 'config synthétique' | 'défaut moteur' | 'dérivé' | 'override';

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
  divergeDeLaProd: boolean;
  ecarts: { nom: string; valeur: number | string | boolean; valeurProd: number | string | boolean }[];
  /**
   * ⚠️ Un écart que même la parallélisation partagée ne comble pas : le
   * navigateur rend la main toutes les 50 ms et les navigateurs plafonnent à
   * ~4 ms un `setTimeout(0)` enchaîné — ~7 % de surcoût que Node ne paie
   * pas. Un temps mesuré ici est donc un PLANCHER pour le navigateur.
   * Arithmétique, pas mesuré.
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
  complet: boolean;
  motif?: MotifTroncature;
  explored: number;
  /** La borne EXACTE de l'espace (`totalPairCount`). */
  totalPairs: number;
  /**
   * ⚠️ **Autodiagnostic gratuit.** `totalPairCount` vaut exactement ce que
   * `pairBuckets` explore sur une recherche non tronquée (égalité vérifiée
   * sur 15 scénarios par `rune-optim-differential.test.ts`). Un run annoncé
   * complet dont `explored < totalPairs` a donc été tronqué malgré tout —
   * on le DIT, on ne le laisse pas déduire.
   */
  incoherence?: string;
  /**
   * ⚠️ Une configuration invalide (un emplacement vidé, une condition prouvée
   * infaisable) n'est PAS un verdict algorithmique sur le build. Renseigné,
   * ce champ dit que le « 0 candidat » ne conclut rien.
   */
  configurationInvalide?: string;
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
  demiBuilds: SerieTemps;
  appariement: SerieTemps;
  total: SerieTemps;
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

export interface TraceSurvie {
  id: number;
  /** `false` = jamais entrée dans le pool — pas « écartée au premier étage ». */
  presenteAuDepart: boolean;
  parEtage: { etage: string; nature: NatureEtage; present: boolean }[];
  /** Le premier étage qui l'a fait disparaître, avec ce que ça signifie. */
  premiereDisparition?: { etage: string; nature: NatureEtage; signification: string };
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

  /** Absents si l'arrêt a eu lieu avant leur phase. */
  demiBuilds?: { compartimentsA: number; compartimentsB: number; combosA: number; combosB: number };
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
}
