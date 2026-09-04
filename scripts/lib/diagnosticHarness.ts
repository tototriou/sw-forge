// Le cœur du harnais : il ORCHESTRE les fonctions de production et OBSERVE
// ce qu'elles font. Il ne réimplémente AUCUNE étape algorithmique.
//
// La séquence exécutée ici est celle de `runeBuildOptim.worker.ts`, c'est-à-
// dire du chemin de production : `prepareSearch` → `buildBuckets` ×2 →
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
  Bucket,
  BuildCandidate,
  PrepareStage,
  PreparedSearch,
  SearchParams,
  SearchResult,
  buildBuckets,
  candidateMetricTotal,
  pairBuckets,
  prepareSearch,
  sortCandidates,
  totalPairCount,
} from '../../src/lib/runeBuildOptim';
import { PARALLEL_PAIRING_THRESHOLD } from '../../src/workers/parallelPairing';
import { driveParallelPairing } from '../../src/workers/parallelPairing';
import { RuneDetail } from '../../src/types';
import { drain } from './drain';
import { ConfigResolue, resoudreConfig } from './diagnosticConfig';
import { ensurePairSliceBundle, makeSpawnSliceNode } from './spawnSliceNode';
import {
  ArretApres,
  Completude,
  ConfigHarnais,
  EtagePopulation,
  NatureEtage,
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
  bucketsA?: Bucket[];
  bucketsB?: Bucket[];
  totalPairs?: number;
  regime?: RegimeAppariement;
  resultat?: SearchResult;
  msPreparation: number;
  msDemiBuilds: number;
  msAppariement: number;
  msTotal: number;
}

export async function executerHarnais(config: ConfigHarnais): Promise<ResultatHarnais> {
  const resolue = resoudreConfig(config);
  const arretApres: ArretApres = config.arretApres ?? 'classement';
  const repetitions = Math.max(1, config.repetitions ?? 1);
  const avertissements = [...resolue.avertissements];

  // ⚠️ Bundlé UNE FOIS, AVANT la première mesure : le coût d'esbuild ne doit
  // jamais entrer dans un temps d'appariement. Préparé même si le régime
  // s'avère séquentiel — quelques centaines de ms, hors chrono.
  const cheminBundle = doitPouvoirParalleliser(arretApres) ? await ensurePairSliceBundle() : null;

  const passages: Passage[] = [];
  for (let i = 0; i < repetitions; i++) {
    passages.push(await unPassage(resolue, arretApres, cheminBundle));
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
    suivi: (config.suivre ?? []).map((id) => suivrePiece(id, resolue.poolInitial, dernier.etages)),
    bornesFaisabilite: bornes(dernier.prepared),
  };

  if (dernier.prepared == null) {
    // ⚠️ `prepareSearch` renvoie `null` quand un emplacement est VIDE après
    // filtrage. Ce n'est pas un verdict sur le build : c'est une
    // configuration qui ne peut rien produire, et le dire est tout l'objet
    // du §6.2 (« jamais un 0 candidat nu »).
    const vides = dernier.taillesParEtage
      .find((t) => t.etage === 'filterslot')!
      .parEmplacement.map((n, i) => (n === 0 ? i + 1 : 0))
      .filter((n) => n > 0);
    resultat.completude = {
      complet: false,
      explored: 0,
      totalPairs: 0,
      configurationInvalide:
        `Préparation impossible : emplacement(s) ${vides.join(', ')} vide(s) après pré-filtrage. ` +
        `Aucune combinaison n'existe — ce n'est PAS une conclusion sur la qualité des builds.`,
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
  resultat.regime = {
    applique: dernier.regime!,
    totalPairs: dernier.totalPairs!,
    seuil: PARALLEL_PAIRING_THRESHOLD,
    force: config.overrides?.regime != null,
    explication:
      config.overrides?.regime != null
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
  return resultat;
}

/* --------------------------------------------------------------------------
 * Un passage complet
 * ----------------------------------------------------------------------- */

async function unPassage(
  resolue: ConfigResolue,
  arretApres: ArretApres,
  cheminBundle: string | null
): Promise<Passage> {
  const params = resolue.params;
  const t0 = performance.now();

  // ── Phase A : préparation, observée étage par étage.
  const etages: EtagePopulation[] = [];
  const taillesParEtage: TaillesParEtage[] = [];
  const prepared = prepareSearch(params, (stage, bySlot) => {
    etages.push({ nom: stage, nature: NATURE_ETAGE[stage], presents: new Set(bySlot.flat().map((r) => r.id)) });
    taillesParEtage.push({
      etage: stage,
      nature: NATURE_ETAGE[stage],
      parEmplacement: bySlot.map((l) => l.length),
      total: bySlot.reduce((s, l) => s + l.length, 0),
    });
  });
  const tPrepare = performance.now();

  const passage: Passage = {
    prepared,
    etages,
    taillesParEtage,
    msPreparation: tPrepare - t0,
    msDemiBuilds: 0,
    msAppariement: 0,
    msTotal: tPrepare - t0,
  };
  if (prepared == null || estEtagePreparation(arretApres)) return passage;

  // ── Phase B : les deux moitiés.
  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, params.adaptiveTrancheWeighting, params.combosOrderMode)
  );
  const bucketsB = drain(
    buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, params.adaptiveTrancheWeighting, params.combosOrderMode)
  );
  const tBuild = performance.now();
  passage.bucketsA = bucketsA;
  passage.bucketsB = bucketsB;
  passage.msDemiBuilds = tBuild - tPrepare;
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
      ? await apparierEnParallele(params, prepared, bucketsA, bucketsB, cheminBundle!)
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
  const complet = !resultat.truncated;
  const completude: Completude = {
    complet,
    motif: complet ? undefined : resultat.candidates.length >= plafond ? 'maxCollected' : 'maxMs',
    explored: resultat.explored,
    totalPairs,
  };
  // ⚠️ L'autodiagnostic gratuit : `totalPairCount` est la borne EXACTE de
  // l'espace (mêmes prédicats que `pairBuckets`, égalité stricte vérifiée sur
  // 15 scénarios par le test différentiel). Un run annoncé complet qui n'a
  // pas exploré tout l'espace a donc été tronqué sans le dire — ou l'un des
  // deux comptages a divergé de l'autre, ce qui est tout aussi grave.
  if (complet && resultat.explored < totalPairs) {
    completude.incoherence =
      `Run annoncé COMPLET mais explored (${resultat.explored.toLocaleString('fr-FR')}) < totalPairs ` +
      `(${totalPairs.toLocaleString('fr-FR')}) — il a été tronqué, ou totalPairCount et pairBuckets ` +
      'ne comptent plus la même chose (voir rune-optim-differential.test.ts, qui vérifie leur égalité stricte).';
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
    appariement: serie(passages.map((p) => p.msAppariement)),
    total: serie(passages.map((p) => p.msTotal)),
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

function doitPouvoirParalleliser(arret: ArretApres): boolean {
  return arret === 'appariement' || arret === 'classement';
}

export { resoudreConfig };
