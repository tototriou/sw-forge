// Le cœur du harnais : il ORCHESTRE les fonctions de production et OBSERVE
// ce qu'elles font. Il ne réimplémente AUCUNE étape algorithmique.
//
// La séquence exécutée ici est celle de `runeBuildOptim.worker.ts`, c'est-à-
// dire du chemin de production : `prepareSearch` → `buildBuckets` ×2 EN
// PARALLÈLE (deux fils, comme les deux Web Workers de l'app) →
// `totalPairCount` (qui décide du régime) → `pairBuckets` séquentiel OU
// `driveParallelPairing` → `sortCandidates`.
//
// ⚠️ **Pourquoi le harnais orchestre lui-même au lieu d'appeler
// `runSearchToCompletion`** : ce dernier fait prepare + build + pair d'un
// bloc, et TOUJOURS en séquentiel. Or le régime que la production
// choisirait dépend de `totalPairCount`, qui n'existe qu'une fois les deux
// moitiés construites — impossible à décider depuis l'extérieur d'un appel
// monolithique. Piloter étage par étage est de toute façon nécessaire pour
// `arretApres` et pour les temps par phase. Aucune étape n'est pour autant
// recréée : chaque appel est celui de la prod.
//
// ⚠️ **Le régime n'est pas un choix offert à l'utilisateur.** Par défaut le
// harnais applique le MÊME seuil que la production
// (`PARALLEL_PAIRING_THRESHOLD` contre `totalPairCount`), donc il est fidèle
// par construction, et il affiche lequel s'est appliqué et pourquoi. Forcer
// un régime reste possible — c'est un override, marqué comme tel.

import {
  ALL_STAT_KEYS,
  Bucket,
  BuildCandidate,
  HalfCombo,
  NearMiss,
  PER_STAT_KEEP,
  PER_STAT_KEEP_OBJECTIVE,
  PrepareStage,
  PreparedSearch,
  SearchParams,
  SearchResult,
  candidateMetricTotal,
  diagnoseFeasibility,
  objectiveKeysOf,
  pairBuckets,
  prepareSearch,
  rankBlockingConditions,
  relevance,
  runeContribution,
  sortCandidates,
  totalPairCount,
  weightedContribution,
} from '../../src/lib/runeBuildOptim';
import { PARALLEL_PAIRING_THRESHOLD } from '../../src/workers/parallelPairing';
import { driveParallelPairing } from '../../src/workers/parallelPairing';
import { RuneDetail } from '../../src/types';
import { drain } from './drain';
import { ConfigResolue, resoudreConfig } from './diagnosticConfig';
import { ensurePairSliceBundle, makeSpawnSliceNode } from './spawnSliceNode';
import { construireMoitiesEnParallele, ensureBuildHalfBundle } from './buildHalvesNode';
import {
  ArretApres,
  Completude,
  ConfigHarnais,
  DemiBuildCombo,
  DetailDemiBuild,
  DetailFiltrage,
  EtagePopulation,
  Faisabilite,
  NatureEtage,
  PreuveFaisabilite,
  QuasiSucces,
  RegimeAppariement,
  ResultatHarnais,
  SerieTemps,
  TaillesParEtage,
  TraceSurvie,
} from './diagnosticTypes';

/**
 * La nature de chaque étage de préparation — ce qui décide de ce qu'une
 * disparition SIGNIFIE.
 *
 * ⚠️ `filterslot` est `mixte`, jamais `heuristique` : il contient AUSSI un
 * élagage SÛR en tête (le cas « combo à coût complet », documenté avec sa
 * preuve dans `filterSlot`). Le classer purement heuristique rendrait le
 * verdict faux dans un sens, purement sûr dans l'autre.
 */
const NATURE_ETAGE: Record<PrepareStage, NatureEtage> = {
  mainstat: 'contrainte',
  dominance: 'sûr',
  feasibility: 'sûr',
  filterslot: 'mixte',
};

const SIGNIFICATION: Record<NatureEtage, string> = {
  contrainte: 'ne satisfait pas une exigence posée (statistique principale imposée)',
  sûr: 'PROUVÉ : ne peut entrer dans aucun build valide — jamais un rejet heuristique',
  mixte:
    'écartée par le pré-filtrage — ⚠️ AMBIGU : `filterSlot` élague sûrement (combo à coût complet) ET retient ' +
    'heuristiquement (top-K). Sans autre indice, on ne peut PAS conclure que la rune était inutile.',
};

const ORDRE_ETAGES: PrepareStage[] = ['mainstat', 'dominance', 'feasibility', 'filterslot'];

/** Un passage complet, mesuré. Rejoué à l'identique par répétition. */
interface Passage {
  prepared: PreparedSearch | null;
  etages: EtagePopulation[];
  taillesParEtage: TaillesParEtage[];
  /**
   * Le pool RÉEL en entrée de `filterSlot` (sortie de l'étage `feasibility`),
   * conservé pour `detailFiltrage` — jamais recalculé, lu depuis `onStage`.
   */
  feasibilityBySlot?: RuneDetail[][];
  bucketsA?: Bucket[];
  bucketsB?: Bucket[];
  totalPairs?: number;
  regime?: RegimeAppariement;
  resultat?: SearchResult;
  msPreparation: number;
  /** Le temps RÉEL de la phase — le maximum des deux fils, pas leur somme. */
  msDemiBuilds: number;
  /** Coût interne à chaque fil : diagnostic du DÉSÉQUILIBRE entre moitiés. */
  msDemiBuildA?: number;
  msDemiBuildB?: number;
  msAppariement: number;
  msTotal: number;
}

/**
 * Ce qu'une `ConfigHarnais` porte EN PLUS de ce que `resoudreConfig`
 * consomme — l'orchestration, pas la configuration du moteur.
 *
 * ⚠️ `ConfigHarnais` satisfait ce type par construction : c'est ce qui
 * permet à `executerHarnais` de relayer sa config telle quelle.
 */
export interface OptionsHarnais {
  arretApres?: ArretApres;
  suivre?: number[];
  blocages?: boolean;
  repetitions?: number;
}

/**
 * ⚠️ **La configuration est résolue UNE SEULE FOIS, par l'appelant.**
 *
 * `executerHarnais(config)` la résolvait à son tour alors que le CLI venait
 * de le faire pour afficher le palier 1 — donc DEUX résolutions par run. Ce
 * n'était pas qu'un coût : en mode recette, la seconde relit l'export de
 * compte et la recette sur le disque, qui ont pu changer entre-temps. Le
 * palier 1 pouvait alors décrire une configuration qui n'est PAS celle qui
 * s'exécute, sans que rien ne le dise — c'est-à-dire exactement la garantie
 * que le §5 du cadrage existe pour donner (« challenger la configuration
 * d'un run AVANT de le laisser tourner vingt minutes »).
 *
 * En mode synthétique le pool était reconstruit une seconde fois ; la seed
 * le rend identique, mais le défaut conceptuel était le même.
 */
export async function executerHarnaisResolu(
  resolue: ConfigResolue,
  options: OptionsHarnais = {}
): Promise<ResultatHarnais> {
  const arretApres: ArretApres = options.arretApres ?? 'classement';
  const repetitions = Math.max(1, options.repetitions ?? 1);
  const avertissements = [...resolue.avertissements];

  // ⚠️ Les DEUX bundles sont produits UNE FOIS, AVANT la première mesure : le
  // coût d'esbuild ne doit jamais entrer dans un temps mesuré. Celui des
  // moitiés est préparé dès qu'on ira au-delà de la préparation ; celui des
  // tranches d'appariement seulement si l'appariement aura lieu.
  const bundleMoities = irAuDelaDeLaPreparation(arretApres) ? await ensureBuildHalfBundle() : null;
  const bundleTranches = doitPouvoirParalleliser(arretApres) ? await ensurePairSliceBundle() : null;

  const passages: Passage[] = [];
  for (let i = 0; i < repetitions; i++) {
    passages.push(await unPassage(resolue, arretApres, bundleMoities, bundleTranches));
  }
  // ⚠️ Le DERNIER passage sert de source aux résultats non temporels. Tous
  // sont identiques par construction (mêmes paramètres, même pool) SAUF
  // l'ordre de collecte en régime parallèle, qui dépend de l'ordonnancement
  // des fils — c'est précisément pourquoi forcer le séquentiel est l'outil
  // de la reproductibilité (§7.1).
  const dernier = passages[passages.length - 1];

  const resultat: ResultatHarnais = {
    source: resolue.source,
    descriptionSource: resolue.descriptionSource,
    parametres: resolue.parametres,
    fidelite: resolue.fidelite,
    avertissements,
    arretApres,
    preparation: dernier.taillesParEtage,
    suivi: (options.suivre ?? []).map((id) => {
      const trace = suivrePiece(id, resolue.poolInitial, dernier.etages);
      // ⚠️ Le rang dans `filterSlot` n'a de sens QUE pour une rune qui a
      // atteint son entrée réelle (sortie de `feasibility`) — pas pour une
      // rune déjà écartée avant.
      if (dernier.feasibilityBySlot && trace.parEtage.find((e) => e.etage === 'feasibility')?.present) {
        const slot = resolue.poolInitial.find((r) => r.id === id)?.slot;
        if (slot != null) trace.detailFiltrage = detailFiltrage(id, dernier.feasibilityBySlot[slot - 1], resolue.params);
      }
      return trace;
    }),
    bornesFaisabilite: bornes(dernier.prepared),
    faisabilite: evaluerFaisabilite(resolue.params),
  };
  // ⚠️ Les blocages sont calculés soit sur demande, soit quand la
  // configuration n'a AUCUNE issue — c'est-à-dire au seul moment où ils
  // servent, et jamais « au cas où » sur une recherche qui a bien abouti.
  if ((options.blocages ?? false) || dernier.prepared == null) {
    resultat.faisabilite.blocages = evaluerBlocages(resolue.params);
  }

  if (dernier.prepared == null) {
    // ⚠️ `prepareSearch` renvoie `null` quand un emplacement est VIDE après
    // filtrage. Ce n'est pas un verdict sur le build : c'est une
    // configuration qui ne peut rien produire, et le dire — avec sa CAUSE —
    // est tout l'objet du §6.2 (« jamais un 0 candidat nu »).
    resultat.completude = {
      complet: false,
      explored: 0,
      totalPairs: 0,
      configurationInvalide: causeConfigurationInvalide(resolue.params, dernier.taillesParEtage),
    };
    return resultat;
  }

  if (estEtagePreparation(arretApres)) return resultat;

  resultat.demiBuilds = {
    compartimentsA: dernier.bucketsA!.length,
    compartimentsB: dernier.bucketsB!.length,
    combosA: dernier.bucketsA!.reduce((s, b) => s + b.combos.length, 0),
    combosB: dernier.bucketsB!.reduce((s, b) => s + b.combos.length, 0),
  };
  // ⚠️ Déclenché AUTOMATIQUEMENT, sans option séparée : dès que `--suivre`
  // porte exactement les 3 runes d'UNE moitié (3 emplacements distincts,
  // 1-3 ou 4-6), c'est un demi-build suivi — extension naturelle du suivi
  // générique (§6.1 bis) plutôt qu'une deuxième surface de configuration.
  {
    const suivies = (options.suivre ?? []).map((id) => resolue.poolInitial.find((r) => r.id === id)).filter((r): r is RuneDetail => r != null);
    const groupeA = suivies.filter((r) => r.slot <= 3);
    const groupeB = suivies.filter((r) => r.slot >= 4);
    const detail: DetailDemiBuild[] = [];
    if (groupeA.length === 3 && new Set(groupeA.map((r) => r.slot)).size === 3) {
      detail.push(detailDemiBuild('A', groupeA.map((r) => r.id), dernier.bucketsA!, dernier.prepared!.retentionKeys));
    }
    if (groupeB.length === 3 && new Set(groupeB.map((r) => r.slot)).size === 3) {
      detail.push(detailDemiBuild('B', groupeB.map((r) => r.id), dernier.bucketsB!, dernier.prepared!.retentionKeys));
    }
    if (detail.length > 0) resultat.detailDemiBuilds = detail;
  }
  resultat.regime = {
    applique: dernier.regime!,
    totalPairs: dernier.totalPairs!,
    seuil: PARALLEL_PAIRING_THRESHOLD,
    // ⚠️ Lu sur la config RÉSOLUE, jamais re-dérivé des overrides bruts :
    // c'est `resoudreConfig` qui décide si un régime a été forcé, et le
    // harnais ne doit pas pouvoir répondre autrement qu'elle.
    force: resolue.regimeForce != null,
    explication:
      resolue.regimeForce != null
        ? `régime FORCÉ (${dernier.regime}) — ⚠️ ne décrit la production que par coïncidence`
        : dernier.totalPairs! >= PARALLEL_PAIRING_THRESHOLD
          ? `totalPairs ≥ seuil → PARALLÈLE (4 workers), comme la production pour ce cas`
          : `totalPairs < seuil → SÉQUENTIEL, comme la production pour ce cas`,
  };
  resultat.temps = agregerTemps(passages);

  if (arretApres === 'demi-builds') return resultat;

  resultat.completude = evaluerCompletude(dernier.resultat!, dernier.totalPairs!, resolue.params);

  if (arretApres === 'appariement') return resultat;

  // ⚠️ **Phase D : TOUJOURS par `sortCandidates`.** `SearchResult.candidates`
  // sort dans l'ordre de COLLECTE de l'appariement, pas classé par
  // l'objectif : `candidates[0]` n'est pas le meilleur build. Un diagnostic
  // a déjà conclu « le moteur manque un build meilleur » en lisant ce
  // premier élément — le build cherché était au rang 6.
  resultat.meilleurs = classer(dernier.resultat!.candidates, resolue);

  // ⚠️ **Une recherche qui aboutit à ZÉRO candidat est l'autre moment où les
  // blocages servent** — et le plus trompeur : la configuration était valide,
  // la recherche est allée au bout, et pourtant rien. Sans ce classement,
  // l'utilisateur n'a aucune prise sur ce qu'il faudrait relâcher. ⚠️ Les
  // PREUVES (au-dessus) restent la première chose à lire : si l'une d'elles
  // dit « impossible », le classement des blocages ne fait que confirmer.
  if (resultat.meilleurs.length === 0 && resultat.faisabilite.blocages == null) {
    resultat.faisabilite.blocages = evaluerBlocages(resolue.params);
  }
  // ⚠️ Sous-produit GRATUIT de `pairBuckets` (voir spec/outils/optimizer/
  // near-miss-appariement.md) — jamais recalculé, seulement mis en forme.
  // Rendu SEULEMENT quand `meilleurs` est vide : sinon rien à chercher.
  if (resultat.meilleurs.length === 0) {
    resultat.quasiSucces = evaluerQuasiSucces(dernier.resultat!, resolue);
  }
  return resultat;
}

/**
 * La signature historique — CONSERVÉE. Elle résout la configuration puis
 * délègue, ce qui reste correct pour tout appelant qui n'a pas déjà besoin
 * de la configuration résolue (les tests, notamment : ils la passent en
 * déclaratif et ne rendent aucun palier 1).
 *
 * ⚠️ `ConfigHarnais` satisfait `OptionsHarnais` par construction — elle est
 * donc relayée telle quelle, sans recopie champ à champ, qui serait
 * exactement le genre d'endroit où un champ ajouté plus tard s'oublierait.
 */
export async function executerHarnais(config: ConfigHarnais): Promise<ResultatHarnais> {
  return executerHarnaisResolu(resoudreConfig(config), config);
}

function evaluerQuasiSucces(resultat: SearchResult, resolue: ConfigResolue): NonNullable<ResultatHarnais['quasiSucces']> {
  const runeById = new Map(resolue.poolInitial.map((r) => [r.id, r]));
  const metric = resolue.params.metric;
  const versQuasiSucces = (miss: NearMiss): QuasiSucces => ({
    runeIds: miss.runeIds,
    total: candidateMetricTotal(miss, runeById, metric),
    manques: miss.shortfalls.map((s) => ({ stat: s.key, borne: s.kind, demande: s.requested, atteint: s.actual, manque: s.shortfall })),
  });
  return {
    parCondition: resultat.nearMissByCondition.map((e) => ({ stat: e.key, borne: e.kind, quasiSucces: versQuasiSucces(e.miss) })),
    global: resultat.globalNearMiss ? versQuasiSucces(resultat.globalNearMiss) : null,
  };
}

/* --------------------------------------------------------------------------
 * Un passage complet
 * ----------------------------------------------------------------------- */

async function unPassage(
  resolue: ConfigResolue,
  arretApres: ArretApres,
  cheminBundleMoities: string | null,
  cheminBundleTranches: string | null
): Promise<Passage> {
  const params = resolue.params;
  const t0 = performance.now();

  // ── Phase A : préparation, observée étage par étage.
  const etages: EtagePopulation[] = [];
  const taillesParEtage: TaillesParEtage[] = [];
  let feasibilityBySlot: RuneDetail[][] | undefined;
  const prepared = prepareSearch(params, (stage, bySlot) => {
    etages.push({ nom: stage, nature: NATURE_ETAGE[stage], presents: new Set(bySlot.flat().map((r) => r.id)) });
    taillesParEtage.push({
      etage: stage,
      nature: NATURE_ETAGE[stage],
      parEmplacement: bySlot.map((l) => l.length),
      total: bySlot.reduce((s, l) => s + l.length, 0),
    });
    if (stage === 'feasibility') feasibilityBySlot = bySlot;
  });
  const tPrepare = performance.now();

  const passage: Passage = {
    prepared,
    etages,
    taillesParEtage,
    feasibilityBySlot,
    msPreparation: tPrepare - t0,
    msDemiBuilds: 0,
    msAppariement: 0,
    msTotal: tPrepare - t0,
  };
  if (prepared == null || estEtagePreparation(arretApres)) return passage;

  // ── Phase B : les deux moitiés, construites EN PARALLÈLE sur deux fils —
  // comme la production, qui les confie à deux Web Workers.
  //
  // ⚠️ **Pas seulement pour que le temps affiché soit juste.** Le budget
  // `maxMs` court depuis `prepared.startedAt`, construction comprise : une
  // construction séquentielle vole ce budget à l'appariement, donc sur un run
  // tronqué par le temps le harnais trouverait MOINS de candidats que la
  // prod. Surcoût mesuré sur la baseline : +0,2 % du run là où l'appariement
  // domine, mais +7 % à +32 % sur les cas où il ne domine pas.
  const moities = await construireMoitiesEnParallele(prepared, params, cheminBundleMoities!);
  const bucketsA = moities.bucketsA;
  const bucketsB = moities.bucketsB;
  const tBuild = performance.now();
  passage.bucketsA = bucketsA;
  passage.bucketsB = bucketsB;
  passage.msDemiBuilds = tBuild - tPrepare;
  passage.msDemiBuildA = moities.msA;
  passage.msDemiBuildB = moities.msB;
  passage.msTotal = tBuild - t0;

  // ── Le régime, décidé comme la production le déciderait.
  const totalPairs = totalPairCount(prepared, bucketsA, bucketsB);
  passage.totalPairs = totalPairs;
  const regime: RegimeAppariement =
    resolue.regimeForce ?? (totalPairs >= PARALLEL_PAIRING_THRESHOLD ? 'parallele' : 'sequentiel');
  passage.regime = regime;

  if (arretApres === 'demi-builds') return passage;

  // ── Phase C : appariement, par le chemin que la production emprunterait.
  const resultat =
    regime === 'parallele'
      ? await apparierEnParallele(params, prepared, bucketsA, bucketsB, cheminBundleTranches!)
      : drain(pairBuckets(prepared, bucketsA, bucketsB));
  const tPair = performance.now();
  passage.resultat = resultat;
  passage.msAppariement = tPair - tBuild;
  passage.msTotal = tPair - t0;
  return passage;
}

/**
 * ⚠️ Le VRAI chemin parallèle de production : `driveParallelPairing` (la même
 * répartition LPT, la même division de plafond, la même fusion de résultats
 * que le navigateur) avec le spawn Node injecté, qui exécute `runPairSlice` —
 * le code de production lui-même. Rien n'est reproduit ici.
 */
async function apparierEnParallele(
  params: SearchParams,
  prepared: PreparedSearch,
  bucketsA: Bucket[],
  bucketsB: Bucket[],
  cheminBundle: string
): Promise<SearchResult> {
  const spawn = makeSpawnSliceNode(cheminBundle);
  return driveParallelPairing(
    spawn,
    params,
    prepared,
    bucketsA,
    bucketsB,
    () => {
      /* progression : sans objet pour un harnais qui ne rend rien en direct */
    },
    prepared.startedAt
  );
}

/**
 * §6.3 — ce que le moteur PROUVE impossible.
 *
 * ⚠️ **Réutiliser, jamais recopier**, et surtout conserver la sémantique des
 * deux fonctions : `diagnoseFeasibility` produit une PREUVE sur une stat
 * isolée (`satisfiable: false` = mathématiquement hors de portée, aucune
 * recherche n'y changera rien), `rankBlockingConditions` un simple INDICE de
 * classement. Un libellé qui les confondrait ferait exactement le dégât que
 * ce harnais existe pour empêcher : présenter une heuristique comme un
 * verdict.
 *
 * ⚠️ Appelé UNE fois, hors des chronos de phase — un diagnostic n'a pas à
 * entrer dans le temps attribué à la préparation.
 */
function evaluerFaisabilite(params: SearchParams): Faisabilite {
  return {
    preuves: diagnoseFeasibility(params).map((f) => ({
      stat: f.key,
      borne: f.kind,
      demande: f.requested,
      atteignable: f.bound,
      satisfiable: f.satisfiable,
    })),
  };
}

/**
 * ⚠️ **Séparé des preuves, et pour une raison de fond** : c'est un INDICE, il
 * est COÛTEUX (une dichotomie par condition, chacune relançant le
 * pré-filtrage plusieurs fois), et il n'a d'intérêt qu'au moment où la
 * recherche n'a rien rendu. Le fondre dans la fonction ci-dessus obligerait
 * soit à le payer toujours, soit à recalculer les preuves pour l'obtenir
 * après coup.
 *
 * Le prix est mesuré et rendu : un diagnostic dont on ignore le coût finit
 * lancé au mauvais moment.
 */
function evaluerBlocages(params: SearchParams): NonNullable<Faisabilite['blocages']> {
  const t0 = performance.now();
  const classement = rankBlockingConditions(params);
  return {
    poolMinActuel: classement.baselineMinSlot,
    impacts: classement.impacts.map((i) => ({
      stat: i.key,
      borne: i.kind,
      demande: i.requested,
      seuil: i.threshold,
      ecart: i.delta,
      poolAuSeuil: i.poolMinSlotAtThreshold,
    })),
    coutMs: performance.now() - t0,
  };
}

/**
 * §6.2 — POURQUOI la configuration ne peut rien produire.
 *
 * ⚠️ « Emplacement 3 vide » n'est pas un diagnostic : ça se lit comme une
 * limite de l'algorithme. La cause la plus fréquente ne l'est pas du tout —
 * une rune IMPOSÉE absente du pool, ou posée à un autre emplacement que celui
 * qu'on lui assigne, vide l'emplacement **exprès** (le moteur le documente :
 * mieux vaut zéro build qu'un build qui ignore le verrou). On lit donc le
 * verrou et le pool, sans rien recalculer, pour nommer la cause.
 */
function causeConfigurationInvalide(params: SearchParams, taillesParEtage: TaillesParEtage[]): string {
  const apresMainstat = taillesParEtage.find((t) => t.etage === 'mainstat')!.parEmplacement;
  const apresFiltrage = taillesParEtage.find((t) => t.etage === 'filterslot')!.parEmplacement;
  const vides = apresFiltrage.map((n, i) => ({ slot: i + 1, vide: n === 0 })).filter((e) => e.vide);
  const verrous = params.requirement.lockedRunes ?? {};
  const raisons: string[] = [];

  for (const { slot } of vides) {
    const idVerrouille = verrous[slot];
    if (idVerrouille != null) {
      const rune = params.pool.find((r) => r.id === idVerrouille);
      if (!rune) {
        raisons.push(
          `emplacement ${slot} : la rune IMPOSÉE #${idVerrouille} est absente du pool ` +
            `(exclue par ailleurs, ou venue d'un autre compte) — l'emplacement est vidé exprès, ce n'est pas un verdict sur les builds`
        );
        continue;
      }
      if (rune.slot !== slot) {
        raisons.push(
          `emplacement ${slot} : la rune IMPOSÉE #${idVerrouille} est en réalité à l'emplacement ${rune.slot} — ` +
            `un verrou ne déplace pas une rune, il vide l'emplacement`
        );
        continue;
      }
      raisons.push(`emplacement ${slot} : la rune imposée #${idVerrouille} existe bien, mais n'a survécu à aucun étage`);
      continue;
    }
    // Pas de verrou : l'étage fautif suffit à orienter.
    raisons.push(
      apresMainstat[slot - 1] === 0
        ? `emplacement ${slot} : aucune rune ne peut porter la statistique principale imposée`
        : `emplacement ${slot} : vidé après la statistique principale — dominance, faisabilité ou pré-filtrage`
    );
  }

  return (
    `Préparation impossible — aucune combinaison n'existe. ⚠️ Ce n'est PAS une conclusion sur la qualité des builds.\n` +
    raisons.map((r) => `  · ${r}`).join('\n')
  );
}

/**
 * Les bornes que l'étage de faisabilité a réellement appliquées.
 *
 * ⚠️ Lues sur le `PreparedSearch` de production, jamais recalculées : les
 * recalculer ici serait précisément la reconstruction qu'on supprime. Elles
 * servent à distinguer « aucune rune n'était à la marge » de « la correction
 * n'est pas active » — deux situations qui produisent le MÊME nombre.
 */
function bornes(prepared: PreparedSearch | null): ResultatHarnais['bornesFaisabilite'] {
  if (!prepared) return [];
  return prepared.constrainedKeys.map((k) => ({
    stat: k,
    guaranteed: { pct: prepared.guaranteed.pct[k] ?? 0, flat: prepared.guaranteed.flat[k] ?? 0 },
    guaranteedMin: { pct: prepared.guaranteedMin.pct[k] ?? 0, flat: prepared.guaranteedMin.flat[k] ?? 0 },
    artFlatMax: prepared.artFlatMax[k] ?? 0,
    artFlatMin: prepared.artFlatMin[k] ?? 0,
  }));
}

/**
 * ⚠️ **Remplace `monster-search-filterslot-diag.ts`.** Le rang exact d'une
 * rune sur `relevance()` (le score combiné qui alimente `matchCap`/
 * `fillCap`) et sur chaque stat individuelle (budgets `PER_STAT_KEEP`/
 * `PER_STAT_KEEP_OBJECTIVE`) — RÉUTILISE `relevance`/`runeContribution`/
 * `weightedContribution`, jamais une reformulation de `filterSlot`. Le
 * `matchCap`/`fillCap` réel de la production sont TOUJOURS égaux à
 * `slotFilterCap` (voir `prepareSearch`, `slotCap` passé deux fois à
 * `filterSlot`) — aucune valeur à redériver.
 */
function detailFiltrage(id: number, pool: RuneDetail[], params: SearchParams): DetailFiltrage | undefined {
  const rune = pool.find((r) => r.id === id);
  if (!rune) return undefined;
  const { requirement, base } = params;
  const requiredKeys = new Set(requirement.sets);

  const scored = pool.map((r) => ({ r, s: relevance(r, requirement, base) })).sort((a, b) => b.s - a.s);
  const rang = scored.findIndex((s) => s.r.id === id) + 1;
  const matches = scored.filter(({ r }) => requiredKeys.has(r.set) || r.set === 'intangible');
  const rangMatch = matches.findIndex((s) => s.r.id === id) + 1;

  const objectiveKeys = objectiveKeysOf(params.objective, params.objectiveStats);
  const parStat = ALL_STAT_KEYS.map((k) => {
    const keepN = objectiveKeys.includes(k) ? PER_STAT_KEEP_OBJECTIVE : PER_STAT_KEEP;
    const classes = pool
      .map((r) => {
        const c = runeContribution(r, k);
        return { r, v: weightedContribution(base, k, c.pct, c.flat) };
      })
      .sort((a, b) => b.v - a.v);
    const rangStat = classes.findIndex((c) => c.r.id === id) + 1;
    return {
      stat: k,
      rang: rangStat,
      total: pool.length,
      keepN,
      retenue: rangStat > 0 && rangStat <= keepN,
      valeur: classes[rangStat - 1]?.v ?? 0,
      meilleure: classes[0]?.v ?? 0,
    };
  });

  return {
    relevance: { rang, total: pool.length, score: scored[rang - 1]?.s ?? 0, meilleur: scored[0]?.s ?? 0 },
    relevanceParmiSet: rangMatch > 0 ? { rang: rangMatch, total: matches.length } : null,
    parStat,
  };
}

/**
 * ⚠️ **Remplace `half-build-rank-diag.ts` et
 * `monster-search-buildbuckets-diag.ts`.** Le rang du demi-build CIBLE dans
 * son compartiment, et les mieux classés à côté de lui — lu directement sur
 * `Bucket.combos` (déjà fusionné, dédupliqué, trié par potentiel), jamais
 * recalculé.
 */
function detailDemiBuild(moitie: 'A' | 'B', runeIds: number[], buckets: Bucket[], retentionKeys: string[], top = 10): DetailDemiBuild {
  const toDto = (c: HalfCombo): DemiBuildCombo => ({
    runeIds: c.runes.map((r) => r.id),
    relevanceScore: c.relevanceScore,
    parStat: retentionKeys.map((k) => ({ stat: k, pct: c.pct[k] ?? 0, flat: c.flat[k] ?? 0 })),
  });
  for (let bi = 0; bi < buckets.length; bi++) {
    const b = buckets[bi];
    const idx = b.combos.findIndex((c) => c.runes.length === runeIds.length && c.runes.every((r) => runeIds.includes(r.id)));
    if (idx >= 0) {
      return {
        moitie,
        runeIds,
        compartimentRang: bi + 1,
        compartimentTotal: buckets.length,
        comboRang: idx + 1,
        comboTotal: b.combos.length,
        cible: toDto(b.combos[idx]),
        meilleurs: b.combos.slice(0, top).map(toDto),
      };
    }
  }
  return { moitie, runeIds, absent: 'ABSENT de tous les compartiments retenus — éliminé par bucketCap, ou en amont de la construction.' };
}

/* --------------------------------------------------------------------------
 * Complétude — §6.2
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **`SearchResult` ne porte pas le motif de troncature**, juste un
 * booléen. On le déduit SANS toucher au moteur, par la règle déjà prouvée et
 * documentée dans `combineParallelPairingResults` : `pairBuckets` teste le
 * budget-TEMPS *avant* de pousser un candidat et ne tronque par quota
 * qu'*après* un push. Donc au moment où `truncated` sort vrai, le nombre de
 * candidats vaut exactement le plafond si la cause est le quota, et
 * strictement moins si c'est le temps.
 */
export function evaluerCompletude(resultat: SearchResult, totalPairs: number, params: SearchParams): Completude {
  const plafond = params.maxCollected!;
  const annonceComplet = !resultat.truncated;
  // ⚠️ L'autodiagnostic gratuit : `totalPairCount` est la borne EXACTE de
  // l'espace (mêmes prédicats que `pairBuckets`, égalité stricte vérifiée sur
  // 15 scénarios par le test différentiel). Un run annoncé complet qui n'a
  // pas exploré tout l'espace a donc été tronqué sans le dire — ou l'un des
  // deux comptages a divergé de l'autre, ce qui est tout aussi grave.
  const incoherent = annonceComplet && resultat.explored < totalPairs;
  const completude: Completude = {
    // ⚠️ **`complet` et `incoherence` ne peuvent PLUS être vrais ensemble.**
    // Le harnais disait auparavant, dans le même objet, « la recherche est
    // complète » ET « elle n'a pas exploré tout l'espace » : un lecteur JSON
    // qui teste `complet` était trompé, et c'est le genre de contradiction
    // qu'un outil de diagnostic commet avec l'autorité d'un diagnostic.
    complet: annonceComplet && !incoherent,
    // ⚠️ **Aucun motif FABRIQUÉ dans le cas incohérent.** On sait que la
    // recherche n'est pas complète ; on ne sait PAS pourquoi — la déduction
    // quota/temps ne vaut que quand `truncated` sort vrai, et il est faux
    // ici. Inventer `maxMs` par défaut serait un diagnostic inventé.
    motif: annonceComplet ? undefined : resultat.candidates.length >= plafond ? 'maxCollected' : 'maxMs',
    explored: resultat.explored,
    totalPairs,
  };
  if (incoherent) {
    completude.incoherence =
      `Run annoncé COMPLET mais explored (${resultat.explored.toLocaleString('fr-FR')}) < totalPairs ` +
      `(${totalPairs.toLocaleString('fr-FR')}) — il a été tronqué, ou totalPairCount et pairBuckets ` +
      'ne comptent plus la même chose (voir rune-optim-differential.test.ts, qui vérifie leur égalité stricte). ' +
      'Le verdict rendu est donc INCOMPLET SANS MOTIF : la cause n’est pas déductible ici.';
  }
  return completude;
}

/* --------------------------------------------------------------------------
 * Suivi d'une pièce — §6.1
 * ----------------------------------------------------------------------- */

/**
 * ⚠️ **Générique sur (population, étages nommés, identifiant)** — le principe
 * vaut pour les runes, les artéfacts et les reliques. Seuls les ÉTAGES
 * changent d'un équipement à l'autre, et ils sont passés en paramètre. V1 ne
 * branche que les runes.
 */
export function suivrePiece(id: number, population: RuneDetail[], etages: EtagePopulation[]): TraceSurvie {
  const presenteAuDepart = population.some((r) => r.id === id);
  const parEtage = etages.map((e) => ({ etage: e.nom, nature: e.nature, present: e.presents.has(id) }));
  const trace: TraceSurvie = { id, presenteAuDepart, parEtage };
  if (!presenteAuDepart) return trace;
  const disparition = parEtage.find((e) => !e.present);
  if (disparition) {
    trace.premiereDisparition = {
      etage: disparition.etage,
      nature: disparition.nature,
      signification: SIGNIFICATION[disparition.nature],
    };
  }
  return trace;
}

/* --------------------------------------------------------------------------
 * Temps — §6.4 bis
 * ----------------------------------------------------------------------- */

export function serie(valeurs: number[]): SerieTemps {
  const tri = [...valeurs].sort((a, b) => a - b);
  const min = tri[0];
  const max = tri[tri.length - 1];
  const mediane = tri.length % 2 === 1 ? tri[(tri.length - 1) / 2] : (tri[tri.length / 2 - 1] + tri[tri.length / 2]) / 2;
  return {
    repetitions: valeurs.length,
    min,
    mediane,
    dispersionPct: min > 0 ? ((max - min) / min) * 100 : 0,
    valeurs,
    avertissement:
      valeurs.length === 1
        ? '⚠️ UNE SEULE répétition : aucune dispersion disponible, donc aucune conclusion comparative permise.'
        : undefined,
  };
}

function agregerTemps(passages: Passage[]) {
  return {
    preparation: serie(passages.map((p) => p.msPreparation)),
    demiBuilds: serie(passages.map((p) => p.msDemiBuilds)),
    // ⚠️ Le coût INTERNE de chaque fil, à côté du temps réel de la phase :
    // c'est le seul moyen de voir le DÉSÉQUILIBRE entre moitiés. Paralléliser
    // ne fait jamais mieux que le fil le plus lent — un cas où A coûte 5,5 s
    // et B 2,9 s (Lushen d15, baseline) ne gagne pas ×2, il gagne ce que
    // porte la moitié la plus légère. Sans ces deux nombres, une phase de
    // construction « lente malgré la parallélisation » reste inexplicable.
    demiBuildA: serie(passages.map((p) => p.msDemiBuildA ?? 0)),
    demiBuildB: serie(passages.map((p) => p.msDemiBuildB ?? 0)),
    appariement: serie(passages.map((p) => p.msAppariement)),
    total: serie(passages.map((p) => p.msTotal)),
    avertissementComparaison:
      '⚠️ COMPARER DEUX CONFIGURATIONS : ne pas lancer deux runs séparés et soustraire. ' +
      'C’est le protocole en BLOCS — chaque condition occupe toujours la même position dans la ' +
      'séquence, donc tout effet lié à cette position (échauffement, GC, montée en fréquence) ' +
      'revient identique à chaque exécution et RESSEMBLE à un résultat reproductible. Vécu : ' +
      '+4,8 % obtenu deux fois de suite, +0,3 % au protocole entrelacé. Le harnais sait répéter ' +
      'UNE condition, il ne sait pas encore ENTRELACER deux conditions (témoin, A, B, témoin, A, B…) : ' +
      'pour un dos-à-dos fiable, passer par scripts/perf-battery-compare.ts. ' +
      '⚠️ Et ne jamais conclure sur un écart PLUS PETIT que la dispersion affichée ci-dessus.',
  };
}

/* --------------------------------------------------------------------------
 * Classement — §3, phase D
 * ----------------------------------------------------------------------- */

function classer(candidats: BuildCandidate[], resolue: ConfigResolue) {
  const runeById = new Map(resolue.poolInitial.map((r) => [r.id, r]));
  const objectif = resolue.recette?.objective ?? resolue.params.objective ?? 'efficience';
  const classes = sortCandidates(candidats, objectif, { runeById, metric: resolue.params.metric });
  return classes.slice(0, 20).map((c) => ({
    runeIds: c.runeIds,
    // ⚠️ `candidateMetricTotal` recalcule depuis les VRAIES runes dans la
    // mesure courante — jamais `effTotal`, figé au moment de la recherche.
    total: candidateMetricTotal(c, runeById, resolue.params.metric),
  }));
}

/* --------------------------------------------------------------------------
 * Utilitaires
 * ----------------------------------------------------------------------- */

function estEtagePreparation(arret: ArretApres): arret is PrepareStage {
  return (ORDRE_ETAGES as string[]).includes(arret);
}

function irAuDelaDeLaPreparation(arret: ArretApres): boolean {
  return !estEtagePreparation(arret);
}

function doitPouvoirParalleliser(arret: ArretApres): boolean {
  return arret === 'appariement' || arret === 'classement';
}

export { resoudreConfig };
