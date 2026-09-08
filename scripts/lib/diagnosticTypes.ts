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
   * §4.2 des extensions (A₂) — horodater les `BuildingProgress` que
   * `buildBuckets` émet déjà, pour CARTOGRAPHIER SON ÉLAGAGE.
   *
   * ⚠️ **Ce qu'A₂ ne fait PAS, et c'est le point le plus important de cette
   * option** : il ne départage PAS l'asymétrie A/B. Le temps par rune
   * extérieure MÉLANGE vitesse d'exécution et taux d'élagage — lire un temps
   * élevé côté A comme « A est plus lent » est exactement l'erreur que cet
   * instrument doit empêcher, pas produire.
   *
   * ⚠️ OPT-IN : le worker est PARTAGÉ avec `perf-battery.ts`, l'outil de
   * mesure de référence, qui ne doit rien payer ni rien voir changer.
   */
  horodaterProgression?: boolean;
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
  /**
   * ⚠️ **Toujours présente**, y compris sur un arrêt situé DANS la
   * préparation et sur une configuration invalide : la préparation est la
   * seule phase qui tourne dans TOUS les cas.
   *
   * ⚠️ Sa fenêtre enclot l'observateur `onStage` du harnais — voir
   * `perimetrePreparation`, imprimé avec elle.
   */
  preparation: SerieTemps;
  /**
   * ⚠️ **Ce que la fenêtre de `preparation` contient EN PLUS de la
   * production**, imprimé avec la mesure plutôt que rangé dans une spec où il
   * vivrait loin du nombre qu'il qualifie — même doctrine que
   * `coutInstrumentation` pour A₂ : la marque voyage avec le résultat.
   *
   * Le harnais observe la préparation étage par étage (`releverPreparation`),
   * et ce travail tombe DANS le chronomètre. `temps.preparation` n'est donc
   * pas un `prepareSearch` pur. L'écart a été MESURÉ, pas argumenté.
   */
  perimetrePreparation: string;
  /**
   * Le temps RÉEL de la phase de construction — les deux moitiés étant
   * bâties EN PARALLÈLE sur deux fils, comme en production. C'est donc le
   * plus lent des deux, pas leur somme.
   *
   * ⚠️ **ABSENT quand la phase n'a pas tourné**, jamais une série à zéro.
   * Le harnais rendait auparavant `temps` en bloc ou pas du tout : un arrêt
   * dans la préparation mesurait la préparation N fois puis JETAIT les N
   * relevés. Les rendre en remplissant les autres phases de zéros aurait
   * remplacé un silence par un mensonge — un lecteur de `--json` aurait lu
   * « la construction a coûté 0 ms » sur un run qui n'a rien construit.
   * D'où l'optionalité : `undefined` dit « pas exécutée », et `tsc` force
   * chaque lecteur à en tenir compte.
   */
  demiBuilds?: SerieTemps;
  /**
   * Le coût interne de chaque fil. ⚠️ Sans eux, une construction « lente
   * malgré la parallélisation » est inexplicable : paralléliser ne fait
   * jamais mieux que la moitié la plus lourde, et le déséquilibre A/B est
   * réel (5,5 s contre 2,9 s sur un cas de la baseline).
   *
   * ⚠️ Absents avec `demiBuilds`, pour la même raison.
   */
  demiBuildA?: SerieTemps;
  demiBuildB?: SerieTemps;
  /** ⚠️ Absent si l'arrêt a eu lieu avant l'appariement. */
  appariement?: SerieTemps;
  /**
   * ⚠️ **Toujours présent**, et il vaut ce qui a RÉELLEMENT tourné : sur un
   * arrêt de préparation, il est donc égal à `preparation`. Ce n'est pas une
   * approximation — c'est exactement le temps du run tel qu'il a été demandé.
   */
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
 * Taux de rétention de la CONSTRUCTION — §4.1 des extensions
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **Le nom compte, et il est IMPOSÉ.** C'est le taux de rétention **de la
 * CONSTRUCTION** (`buildBuckets` sous `bucketCap`) :
 *
 * - **jamais « du pré-filtrage »** — celui-là serait `filterSlot`, un étage
 *   PLUS HAUT. Le ratio est pris à la sortie de la construction, pas à son
 *   entrée ;
 * - **jamais un « rendement » ni une « efficacité »** — le ratio ne dit RIEN
 *   de la qualité des demi-builds retenus, ni de la probabilité que
 *   l'optimum survive. Ces deux mots suggèrent un jugement que le nombre ne
 *   porte pas.
 *
 * ⚠️ Les deux nombres sont **déjà rendus** par le harnais — le produit des
 * trois longueurs de `filtered` par moitié (majorant EXACT des triplets
 * énumérables) et `combosA`/`combosB`. Aucune mesure n'est ajoutée, aucun
 * fichier de `src/` n'est touché : niveau **A-passif**.
 */
export interface RetentionMoitie {
  /**
   * `|f₀|×|f₁|×|f₂|` — le **MAJORANT EXACT** des triplets énumérables de
   * cette moitié. ⚠️ Ce n'est PAS ce qui a été énuméré : les `continue` de
   * faisabilité et de jokers coupent des sous-arbres entiers.
   */
  produitBrut: number;
  parEmplacement: number[];
  /** Les demi-builds RETENUS — `Bucket.combos` sommés. */
  retenus: number;
  /** `retenus / produitBrut`. Sans unité. */
  taux: number;
}

/* --------------------------------------------------------------------------
 * Pic de tas par moitié — §4.1 bis des extensions (palier LÉGER)
 * ----------------------------------------------------------------------- */

/**
 * La **TROISIÈME hypothèse** de l'asymétrie A/B : A pourrait énumérer
 * autant, retenir autant, et être plus lent parce qu'il **alloue davantage
 * et paie plus de ramassage de miettes**. Aucun instrument ne la mesurait —
 * et son absence est le signe que « deux hypothèses » n'était pas une
 * énumération close, mais celles auxquelles on avait pensé.
 *
 * ⚠️ La mesure est propre parce que **chaque moitié tourne dans son propre
 * `worker_threads`**, donc dans son propre tas : aucune confusion possible
 * entre A et B.
 */
export interface MemoireConstruction {
  A: import('./build-half-worker').MemoireMoitie;
  B: import('./build-half-worker').MemoireMoitie;
  /**
   * ⚠️ **Caveat OBLIGATOIRE, de la même classe que la taxe navigateur** : le
   * ramasse-miettes de Node n'est pas celui du navigateur. Le chiffre vaut
   * pour comparer A à B **dans le même processus**, jamais comme prédiction
   * de ce que vit l'utilisateur. Imprimé avec la mesure, jamais laissé à la
   * prose du cadrage.
   */
  caveat: string;
}

/* --------------------------------------------------------------------------
 * Cartographie de l'ÉLAGAGE — §4.2 des extensions (A₂, **A-INSTRUMENTÉ**)
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **A₂ EST DE NIVEAU A-INSTRUMENTÉ, ET CE N'EST PAS GRATUIT.** Contrairement
 * à A₁ et A₁ bis (A-passif : de l'arithmétique sur des valeurs déjà rendues),
 * A₂ ASSOCIE une information externe — un `performance.now()` par émission —
 * à des événements que la production émet déjà. Le principe fondateur tient
 * (aucune étape algorithmique n'est réimplémentée, aucun `yield` n'est ajouté,
 * rien de `src/` n'est touché), mais « A » ne veut pas dire « sans coût » :
 * ce que l'horloge couvre doit être ÉCRIT avec la mesure, et le coût de
 * l'instrumentation MESURÉ plutôt qu'argumenté.
 *
 * La distribution des intervalles entre `BuildingProgress`, sur la seule
 * série homogène du relevé (voir `ProgressionMoitie` côté worker).
 *
 * ⚠️ **JAMAIS un scalaire.** Une moyenne écraserait une série possiblement
 * BIMODALE — une rune extérieure dont l'élagage coupe tout au premier test,
 * une autre qui force une exploration profonde. C'est cette DISPERSION qui
 * porte l'information : c'est elle qui dit *où* `buildBuckets` coupe. Réduite
 * à un nombre, elle accuserait un problème de performance là où il n'y a
 * qu'une asymétrie de topologie du pool.
 */
export interface DistributionIntervalles {
  /** Le nombre d'intervalles de la série homogène — jamais le nombre de runes. */
  n: number;
  minMs: number;
  medianeMs: number;
  p90Ms: number;
  maxMs: number;
  totalMs: number;
  /**
   * Classes linéaires de `minMs` à `maxMs` — de quoi VOIR la forme, donc
   * distinguer une série concentrée d'une série à deux bosses. Un seul
   * quantile de plus ne le montrerait pas.
   */
  histogramme: { basseMs: number; hauteMs: number; effectif: number }[];
}

/**
 * ⚠️ **DIVISION ARITHMÉTIQUE, présentée comme telle** — et surtout PAS un
 * « temps par triplet énumérable ». Le compteur d'A₂ ne mesure AUCUNE
 * itération interne : diviser un intervalle par `|f₁|×|f₂|` divise par le
 * MAJORANT des paires intérieures, pas par ce qui a été parcouru. Les
 * `continue` de faisabilité et de jokers coupent des sous-arbres entiers
 * sans laisser de trace dans ce compteur.
 */
export interface DivisionParPairesInterieures {
  /** `|f₁|×|f₂|` — les deux emplacements INTÉRIEURS de la moitié. */
  diviseur: number;
  parEmplacementInterieurs: number[];
  /** `medianeMs / diviseur`, exprimé en nanosecondes pour rester lisible. */
  medianeNs: number;
  libelle: string;
}

export interface ProgressionMoitieRendue {
  /** Annoncé par le moteur (`BuildingProgress.total`), jamais recompté. */
  runesExterieures: number;
  /** 1ᵉʳ `next()` : le prologue SEUL, aucune rune extérieure traitée. */
  prologueMs: number;
  /** Dernier `next()` : dernière rune extérieure **+ épilogue** (les tris). */
  derniereEtEpilogueMs: number;
  /** Sur la série HOMOGÈNE seule — ni le prologue, ni l'intervalle mixte. */
  distribution: DistributionIntervalles;
  divisionParPairesInterieures: DivisionParPairesInterieures;
}

export interface ProgressionConstruction {
  A: ProgressionMoitieRendue;
  B: ProgressionMoitieRendue;
  /**
   * ⚠️ **CE QU'A₂ N'EST PAS — imprimé avec la mesure, pas seulement écrit
   * dans la spec.** A₂ ne départage PAS l'asymétrie A/B : il en est
   * INCAPABLE, le temps par rune extérieure mélangeant vitesse d'exécution
   * et taux d'élagage. Quelqu'un qui le lirait comme un arbitre de l'A/B
   * conclurait « A est plus lent » d'un temps élevé côté A — faux, et
   * exactement la classe d'erreur que cet instrument existe pour empêcher.
   */
  avertissementPortee: string;
  /**
   * ⚠️ **LE PÉRIMÈTRE DE L'HORLOGE, imprimé AVEC la mesure.** L'intervalle
   * entre deux `yield` inclut la suspension/reprise du générateur et ce que
   * la coquille fait entre-temps — ce n'est donc pas « le temps passé dans
   * `buildBuckets` », et le laisser lire ainsi serait une infidélité.
   */
  perimetreHorloge: string;
  /**
   * ⚠️ **A₂ EST AUTO-VÉRIFIANT : son coût ne s'argumente pas, il se MESURE**
   * — et le chiffre part avec la fonctionnalité, pas dans un commentaire que
   * personne ne relira. C'est le seul instrument A-INSTRUMENTÉ du harnais ;
   * dire « ça devrait être invisible » n'aurait pas suffi.
   */
  coutInstrumentation: string;
}

export interface RetentionConstruction {
  A: RetentionMoitie;
  B: RetentionMoitie;
  /**
   * ⚠️ **La règle d'interprétation du §4.4, IMPRIMÉE avec le résultat** —
   * pas seulement écrite dans la spec. Ni ce taux ni aucun autre signal ne
   * DÉMONTRE quoi que ce soit ; ils peuvent produire une causalité fausse
   * (« A retient moins, A est plus lent, donc A est lent parce qu'il
   * travaille plus »). La corrélation autorise cette lecture, rien ne la
   * démontre.
   */
  regleInterpretation: string;
}

/* --------------------------------------------------------------------------
 * ÉTAGE 0 du build cible — l'ADMISSIBILITÉ À L'ENTRÉE — §5.1 des extensions
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **L'étage 0 se fait AVANT d'accuser l'élagage.** Sans lui, une absence
 * causée par l'ENTRÉE — une rune qui n'est pas dans le pool, un emplacement
 * en double, une principale imposée que la rune ne porte pas, un combo de
 * sets que les six runes n'activent pas — serait attribuée au moteur. C'est
 * exactement la classe d'erreur commise avec l'autorité d'un diagnostic que
 * ce chantier existe pour empêcher.
 *
 * ⚠️ **Aucune règle de compatibilité n'est RECOPIÉE ici** (§6.3 du cadrage :
 * « réutiliser, jamais recopier »). L'admissibilité par emplacement est lue
 * sur `mainStatFilteredBySlot`, la fonction de production qui applique les
 * verrous ET la statistique principale imposée — « le point le plus AMONT du
 * pipeline, traversé par TOUS les chemins ». Le combo de sets est lu par
 * `activeSets` + `missingSets`, c'est-à-dire l'appel EXACT que `pairBuckets`
 * fait pour accepter une paire. Le harnais ne sait donc pas répondre
 * autrement que le moteur.
 */
export interface AdmissibiliteRune {
  id: number;
  /**
   * ⚠️ `false` ne veut PAS dire « écartée par un étage » : le pool d'entrée
   * est DÉJÀ purgé des runes exclues (portées par un autre monstre, voir
   * `excludedRuneIds`) en amont du moteur. Une rune absente est donc exclue,
   * ou venue d'un autre compte — jamais un verdict sur les builds.
   */
  presenteDansLePool: boolean;
  /** `null` quand la rune est absente du pool : son emplacement est inconnu. */
  slot: number | null;
  /**
   * Présente dans `mainStatFilteredBySlot(pool, requirement)[slot-1]` — donc
   * survivante au verrou de son emplacement ET à la statistique principale
   * imposée. `null` si la question ne se pose pas (rune absente du pool).
   */
  admiseAuDepart: boolean | null;
  /** Renseigné SEULEMENT en cas de refus, et il NOMME la cause. */
  motif?: string;
}

export interface AdmissibiliteBuild {
  runeIds: number[];
  /** Le verdict d'étage 0, et lui seul : rien n'y est déduit de l'élagage. */
  admissible: boolean;
  parRune: AdmissibiliteRune[];
  /**
   * La structure du build lui-même : six identifiants distincts, couvrant les
   * six emplacements. ⚠️ Vérifiée AVANT tout le reste — deux runes du même
   * emplacement ne forment pas un build, et le dire vaut mieux que de rendre
   * un verdict sur un objet qui n'en est pas un.
   */
  structure: { motif: string } | null;
  /**
   * Le combo de sets demandé, évalué sur les SIX vraies runes — `null` quand
   * la structure ne permet pas de le calculer (une rune manquante).
   *
   * ⚠️ C'est le test RÉEL et EXACT, pas le pré-filtre optimiste au niveau des
   * compartiments (`satisfiesSets`, qui ignore la concurrence des jokers avec
   * des sets hors combo). Même appel que la décision finale de `pairBuckets`.
   */
  sets: { demandes: string[]; actifs: string[]; manquants: string[] } | null;
  /** Vide si admissible. Chaque motif est autonome et nomme sa cause. */
  motifs: string[];
}

/* --------------------------------------------------------------------------
 * ÉTAGES 4-5 du build cible — la PAIRE et le RANG — §5.1 des extensions
 * ----------------------------------------------------------------------- */

/**
 * L'étage auquel la paire de compartiments du build cible s'est arrêtée —
 * ⚠️ **dans l'ordre exact de `pairBuckets`**, pas celui de `totalPairCount`
 * (les deux appliquent les mêmes prédicats, mais pas dans le même ordre, et
 * c'est la boucle d'appariement qui décide vraiment).
 *
 * ⚠️ Chacun de ces étages est un élagage SÛR au sens du moteur — ils
 * n'écartent jamais une paire à tort. Une paire coupée ici n'est donc PAS
 * « perdue par une heuristique » : elle ne pouvait rien produire.
 */
export type EtapeAppariement =
  | 'sets-compartiment'
  | 'joker'
  | 'borne-compartiment'
  | 'borne-comboA'
  | 'explorée';

/**
 * ⚠️ **Le rang vient de `sortCandidates` sur la liste ENTIÈRE**, jamais d'un
 * top-20 déjà tronqué et jamais de `candidates[0]`. C'est le cœur de l'oracle :
 * sur 100 000 candidats collectés, un build au rang 250 est autrement
 * indistinguable d'un build ABSENT — l'incident fondateur d'`algo-verify`,
 * où le build cherché était au rang 6.
 */
export interface RangBuildCible {
  /** 1 = le meilleur. */
  rang: number;
  /**
   * ⚠️ La population du CLASSEMENT, c'est-à-dire les candidats COLLECTÉS —
   * jamais l'espace de recherche. Sur un run tronqué elle est plus petite que
   * ce que le moteur aurait rendu, et le rang avec elle.
   */
  population: number;
  tailleTopRendu: number;
  dansLeTopRendu: boolean;
  /** Recalculé par `candidateMetricTotal`, jamais `effTotal` figé. */
  totalMetrique: number;
}

export interface AppariementBuildCible {
  /**
   * Le rang (1-based) du compartiment de chaque moitié dans `bucketsA` /
   * `bucketsB`. `null` = la moitié n'est dans AUCUN compartiment retenu,
   * auquel cas il n'y a pas de paire à évaluer.
   */
  compartimentA: number | null;
  compartimentB: number | null;
  /** `null` quand une moitié manque : l'étage 4 ne se pose alors pas. */
  arreteA: EtapeAppariement | null;
  explication: string;
  /**
   * La cible figure-t-elle parmi les candidats RÉELLEMENT collectés par la
   * recherche ? ⚠️ Lu sur `SearchResult.candidates`, le résultat du moteur —
   * aucun test n'est rejoué ici.
   */
  presenteDansLesCandidats: boolean;
  rang?: RangBuildCible;
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
   * ÉTAGE 0 du build cible (§5.1 des extensions) — l'admissibilité des SIX
   * runes suivies, prise à l'ENTRÉE.
   *
   * ⚠️ Déclenché quand `--suivre` porte exactement SIX identifiants — aucune
   * option séparée, même raison que `detailDemiBuilds` pour trois : le suivi
   * générique (§6.1 bis) s'étend naturellement à un build complet dès que ses
   * six pièces sont suivies ensemble, et une seconde surface de configuration
   * porterait exactement la même information.
   *
   * ⚠️ **Rendu même sur un arrêt précoce**, et c'est le but : l'étage 0 ne
   * coûte rien et il passe AVANT toute accusation d'élagage.
   */
  admissibiliteBuildCible?: AdmissibiliteBuild;
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
  demiBuilds?: {
    compartimentsA: number;
    compartimentsB: number;
    combosA: number;
    combosB: number;
    retention: RetentionConstruction;
    /**
     * ⚠️ Relevé du DERNIER passage — avec `--repetitions`, ce n'est pas une
     * série : le palier léger rend un chiffre par moitié, pas une
     * distribution. Le dire ici vaut mieux que de laisser croire à une
     * mesure agrégée.
     */
    memoire: MemoireConstruction;
    /**
     * §4.2 (A₂) — la cartographie de l'ÉLAGAGE. ⚠️ Absente sauf si
     * `horodaterProgression` a été demandé : c'est le seul instrument
     * A-INSTRUMENTÉ du harnais, donc le seul qui se paie.
     *
     * ⚠️ Comme `memoire`, c'est le relevé du DERNIER passage — avec
     * `--repetitions`, ce n'est pas une série de séries.
     */
    progression?: ProgressionConstruction;
  };
  /**
   * Rang et voisinage d'un demi-build suivi dans son compartiment — voir
   * `DetailDemiBuild`. Absent si aucun trio de `--suivre` ne forme une moitié
   * complète, ou si l'arrêt a eu lieu avant la construction des demi-builds.
   */
  detailDemiBuilds?: DetailDemiBuild[];
  /**
   * ÉTAGES 4-5 du build cible (§5.1 des extensions) — la paire de
   * compartiments a-t-elle été explorée, et à quel RANG la cible sort-elle ?
   *
   * ⚠️ Absent si l'arrêt a eu lieu avant l'appariement : c'est alors une
   * question qui ne s'est pas posée, jamais une réponse négative.
   */
  appariementBuildCible?: AppariementBuildCible;
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
