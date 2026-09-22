// Oracle de contrôle de la dimension relique (implementation-relique, lot 4).
//
// Il ne remplace aucune étape du moteur : chaque valeur distincte de
// principale éligible devient le `SearchParams.relic` d'un appel au vrai
// `searchBuilds`. Tous les autres champs restent ceux fournis par l'appelant.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { parseAccountInventory, parseAccountSource } from '../../src/lib/importAccount';
import {
  BuildCandidate,
  Objective,
  RechercheRefusee,
  SearchParams,
  candidateMetricTotal,
  objectiveScore,
  RealDamageContext,
  searchBuilds,
  sortCandidates,
} from '../../src/lib/runeBuildOptim';
import { computeStats } from '../../src/lib/stats';
import { ArtifactDetail, ElementKey, RelicDetail, RuneDetail } from '../../src/types';
import { DEFAULT_DAMAGE_SETUP } from '../../src/lib/damage';
import { PorteurArtefact, artifactFitsMonster, artifactPairAllowed } from '../../src/lib/artifacts';
import { RelicContext, bestRelicForBuild, resoudreContexteRelique } from '../../src/lib/relicOptim';
import { APPORT_NEUTRE, ContexteExclusive, apportExclusive } from '../../src/lib/relicExclusive';
import { loadMonstersList } from './monstersData';
import { buildCaseSearchParams, CASES, loadCase } from './perfShared';
import { libelleAvecRelique, parseOptionsRelique } from './perfRelicOptions';
import { DEFAULT_RELIC_MIN_UPGRADE } from '../../src/hooks/useOptimizerState';
import type { LigneVerrouillee } from '../../src/lib/artifactOptim';
import { chargerRecette, ModeChargement } from './chargerRecette';
import { recipeToRelicIntent } from './recipeToSearchParams';
import { buildRealDamageContext } from './realDamageCli';

export interface OracleCandidate extends BuildCandidate {
  rid?: number;
  score: number;
}

/**
 * La complétude de CHAQUE run de l'oracle (lot 6, revue externe de l'outil
 * F : `OracleResult` jetait `truncated`, C ne pouvait pas s'établir). Un point
 * de la grille B.6 n'est complet que si aucun des N runs n'est tronqué.
 */
export interface OracleRunOutcome {
  principale: { code: number; value: number } | null;
  truncated: boolean;
  explored: number;
  candidats: number;
}

export interface OracleResult {
  candidats: OracleCandidate[];
  optimum: OracleCandidate | null;
  rid?: number;
  N: number;
  runs: OracleRunOutcome[];
  // `true` ssi aucun run n'est tronqué (`maxMs` ou `MAX_COLLECTED`).
  complet: boolean;
}

/** Ce qu'un run de l'oracle doit rendre pour être fusionné — la forme d'un `SearchResult`, réduite à ce que la fusion lit. */
export interface OracleRunResultat {
  candidates: BuildCandidate[];
  truncated: boolean;
  explored: number;
}

export interface OracleSearchRun {
  principale: { code: number; value: number } | null;
  reliques: RelicDetail[];
  params: SearchParams;
}

function groupesDePrincipale(relicContext: RelicContext): { principale: { code: number; value: number } | null; reliques: RelicDetail[] }[] {
  if (relicContext.mode !== 'recherche') {
    const fixe = relicContext.equipee;
    return [{ principale: fixe ? { code: fixe.main.code, value: fixe.main.value } : null, reliques: fixe ? [fixe] : [] }];
  }

  const groupes = new Map<string, RelicDetail[]>();
  for (const relique of relicContext.eligibles) {
    const cle = `${relique.main.code}:${relique.main.value}`;
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(relique);
    else groupes.set(cle, [relique]);
  }
  return [...groupes.values()]
    .map((reliques) => ({
      principale: { code: reliques[0]!.main.code, value: reliques[0]!.main.value },
      reliques: [...reliques].sort((a, b) => a.id - b.id),
    }))
    .sort((a, b) => a.principale.code - b.principale.code || a.principale.value - b.principale.value);
}

/**
 * Rend les N appels exacts que `oracleSearch` exécutera. Cette fonction est
 * exportée pour que la preuve de fidélité puisse différer les paramètres sans
 * espionner ni recopier l'intérieur du moteur.
 */
export function oracleSearchRuns(params: SearchParams, relicContext: RelicContext): OracleSearchRun[] {
  return groupesDePrincipale(relicContext).map(({ principale, reliques }) => ({
    principale,
    reliques,
    // Remplacement, jamais cumul : c'est le même paramètre que la production.
    // ⚠️ `relicContext: undefined` — garantie E : l'oracle n'applique AUCUNE
    // des éliminations qu'il sert à valider. Depuis le lot 5a, un
    // `SearchParams.relicContext` en mode `recherche` RELÂCHE les bornes du
    // moteur ; le laisser passer ici ferait mesurer l'option A contre
    // elle-même. Chaque run est le moteur d'avant, relique fixée.
    params: { ...params, relic: reliques[0] ?? relicContext.equipee, relicContext: undefined },
  }));
}

/**
 * Les options de l'oracle — `realDamage` voyage hors `SearchParams` (garantie
 * E), et `exclusive` est le contexte de l'assiette `Y` des propriétés uniques
 * (lot 7). ⚠️ **Le MÊME objet doit être donné à l'option A** : c'est ce qui
 * rend les deux scores comparables.
 */
export interface OptionsOracle {
  realDamage?: RealDamageContext | null;
  exclusive?: ContexteExclusive | null;
}

/**
 * Le score d'un candidat, avec l'apport de la relique qu'on lui essaie
 * (implementation-relique, lot 7).
 *
 * ⚠️ **L'apport se calcule ICI, sur les stats du candidat qui incluent déjà
 * la principale de cette relique** — et par le MÊME module que l'option A
 * (`relicExclusive.ts`), depuis le MÊME contexte (`exclusive`, transmis par
 * l'appelant aux deux côtés). Deux calculs parallèles rendraient la
 * comparaison de fidélité (F) vide de sens.
 *
 * `exclusive` absent → apport neutre : l'oracle d'avant le lot 7, à
 * l'identique.
 */
function scoreDuCandidat(
  candidate: BuildCandidate,
  params: SearchParams,
  runeById: Map<number, RuneDetail>,
  realDamage?: RealDamageContext | null,
  relique?: RelicDetail,
  exclusive?: ContexteExclusive | null
): number {
  const objectif = params.objective ?? 'efficience';
  if (objectif === 'efficience') return candidateMetricTotal(candidate, runeById, params.metric);
  const apport = exclusive ? apportExclusive(relique, candidate.stats, exclusive.setup, exclusive.element) : APPORT_NEUTRE;
  if (objectif === 'degats_reels') {
    if (!realDamage) throw new Error("oracleSearch : l'objectif « Dégâts réels » exige un contexte de combat.");
    return objectiveScore(candidate, objectif, realDamage, apport);
  }
  return objectiveScore(candidate, objectif, undefined, apport);
}

function candidatAvecRelique(
  candidate: BuildCandidate,
  reliques: RelicDetail[],
  params: SearchParams,
  runeById: Map<number, RuneDetail>,
  realDamage?: RealDamageContext | null,
  exclusive?: ContexteExclusive | null
): OracleCandidate | null {
  const runes = candidate.runeIds.map((id) => runeById.get(id)).filter((r): r is RuneDetail => r != null);
  if (runes.length !== candidate.runeIds.length) {
    throw new Error('oracleSearch : un candidat référence une rune absente de SearchParams.pool.');
  }

  if (reliques.length === 0) {
    const sansRelique: BuildCandidate = {
      ...candidate,
      stats: computeStats({ base: params.base, runes, artifacts: params.artifacts }),
    };
    // Aucune relique : aucun apport possible, quel que soit le contexte.
    return { ...sansRelique, score: scoreDuCandidat(sansRelique, params, runeById, realDamage) };
  }

  const evaluations = new Map<number, BuildCandidate>();
  const objectif = params.objective ?? 'efficience';
  const meilleure = bestRelicForBuild(reliques, (relique) => {
    const evalue: BuildCandidate = {
      ...candidate,
      stats: computeStats({ base: params.base, runes, artifacts: params.artifacts, relic: relique }),
    };
    evaluations.set(relique.id, evalue);
    return scoreDuCandidat(evalue, params, runeById, realDamage, relique, exclusive);
  }, { regimeAucun: objectif === 'efficience' || objectif === 'vitesse', equipee: params.relic });

  if (!meilleure) return null;
  const evalue = evaluations.get(meilleure.relique.id)!;
  // ⚠️ Le score RENDU est celui de la relique RETENUE, avec son apport — le
  // même nombre que celui qui l'a fait gagner, jamais un second calcul sans
  // exclusive (D6 : jamais deux notes).
  return {
    ...evalue,
    rid: meilleure.relique.id,
    score: scoreDuCandidat(evalue, params, runeById, realDamage, meilleure.relique, exclusive),
  };
}

/**
 * Référence relative au moteur rune existant : N recherches de production,
 * une par couple distinct `(statistique, valeur)` de principale éligible.
 */
export function oracleSearch(
  params: SearchParams,
  relicContext: RelicContext,
  options: OptionsOracle = {}
): OracleResult {
  // Même classe de refus que le moteur, jamais un « 0 résultat » ordinaire
  // (revue adversariale du diff du lot 5a, BLOQUANT 2) : préexistait au lot
  // 4, ce lot raccorde l'oracle au refus nommé de `prepareSearch`/
  // `searchBuilds`/`runSearchToCompletion`/`runPairSlice` sur le même
  // contexte.
  if (relicContext.mode === 'recherche' && relicContext.vide) {
    throw new RechercheRefusee(relicContext.vide);
  }
  const runs = oracleSearchRuns(params, relicContext);
  return fusionnerRunsOracle(params, runs, runs.map((run) => searchBuilds(run.params)), options);
}

/**
 * La fusion des N runs — PARTAGÉE entre `oracleSearch` (les N `searchBuilds`
 * dans ce processus, la forme du lot 4, celle des tests) et l'orchestrateur
 * de B.6 (`scripts/relic-differentiel.ts` : un processus par run, résultats
 * relus depuis un JSON). Une seule fusion, une seule convention d'ex æquo
 * (score, puis `rid` croissant), jamais deux.
 */
export function fusionnerRunsOracle(
  params: SearchParams,
  runs: OracleSearchRun[],
  resultats: OracleRunResultat[],
  options: OptionsOracle = {}
): OracleResult {
  if (resultats.length !== runs.length) throw new Error(`fusionnerRunsOracle : ${runs.length} runs, ${resultats.length} résultats.`);
  const runeById = new Map(params.pool.map((r) => [r.id, r]));
  const fusion = new Map<string, OracleCandidate>();
  const ordre: string[] = [];
  const issues: OracleRunOutcome[] = [];

  for (const [i, run] of runs.entries()) {
    const resultat = resultats[i]!;
    issues.push({ principale: run.principale, truncated: resultat.truncated, explored: resultat.explored, candidats: resultat.candidates.length });
    for (const brut of resultat.candidates) {
      const candidat = candidatAvecRelique(brut, run.reliques, params, runeById, options.realDamage, options.exclusive);
      if (!candidat) continue;
      const cle = candidat.runeIds.join(',');
      const precedent = fusion.get(cle);
      if (!precedent) {
        fusion.set(cle, candidat);
        ordre.push(cle);
      } else if (candidat.score > precedent.score || (candidat.score === precedent.score && (candidat.rid ?? Infinity) < (precedent.rid ?? Infinity))) {
        fusion.set(cle, candidat);
      }
    }
  }

  const candidats = ordre.map((cle) => fusion.get(cle)!);
  const objectif: Objective = params.objective ?? 'efficience';
  const tries = sortCandidates(candidats, objectif, { runeById, metric: params.metric, realDamage: options.realDamage });
  const optimum = (tries[0] as OracleCandidate | undefined) ?? null;
  return { candidats, optimum, rid: optimum?.rid, N: runs.length, runs: issues, complet: issues.every((r) => !r.truncated) };
}

/**
 * Point d'entrée réutilisable par B.6 :
 * `npx tsx scripts/lib/relicOracle.ts --case=<index> [--relic-main=<libre|100|101|102>] [--relic-type=<libre|1..16>] [--relic-min-upgrade=<0..15>] [--export-dir=<dossier>]`
 * ou `npx tsx scripts/lib/relicOracle.ts <export.json> <recette.json> [--rta] [--siege=<deckId>[:defense]]`.
 * Un appel exécute une seule mesure (les N runs), dans le processus courant ;
 * la sortie porte la complétude de chaque run.
 */
/**
 * Un point de mesure : les `SearchParams` de production, le contexte G résolu
 * UNE fois, le contexte de dégâts, et de quoi nommer le point. PARTAGÉ entre
 * ce CLI et l'orchestrateur de B.6 (`scripts/relic-differentiel.ts`) — un
 * seul chargement pour l'oracle et pour A, jamais deux lectures des trois
 * champs (garantie G).
 */
export interface PointOracle {
  params: SearchParams;
  contexte: RelicContext;
  realDamage: RealDamageContext | null;
  label: string;
  // L'espèce (porteur des artéfacts : élément, archétype) — `loadDeckMonster`
  // pour `--case`, `LoadedMonster` pour la recette.
  com2usId: number;
  // Les verrous de sous-propriété de la recette (`[]` en `--case`) : le
  // différentiel les neutralise comme l'écran quand la paire est figée.
  lignesVerrouillees: LigneVerrouillee[];
  /**
   * Le contexte de l'assiette `Y` des propriétés uniques (lot 7) — le
   * `DamageSetup` et l'élément de l'espèce, construits ICI, une fois, pour
   * que l'ORACLE et l'OPTION A partent du même. ⚠️ Indépendant de
   * `realDamage` : « État de mon monstre » agit sur tous les objectifs, et un
   * point `ehp` n'a pas de contexte de dégâts (`realDamage: null`) tout en
   * ayant un leader skill et des compétences d'invocateur.
   */
  exclusive: ContexteExclusive;
}

/**
 * La paire d'artéfacts de RÉFÉRENCE désignée explicitement
 * (`--paire-reference=<id>,<id>`, forme recette seulement — lot 6 bis) :
 * remplace `params.artifacts`, la paire représentative de `resolveArtifacts`,
 * quand celle-ci ne décrit pas le domaine que le différentiel doit comparer.
 *
 * ⚠️ Pourquoi : `paireRepresentative` choisit la meilleure paire AU SENS DU
 * RÉGIME sur l'équipement porté — en PV effectifs avec une principale ATQ
 * forcée, toutes les paires sont ex æquo avec la paire VIDE, qui sort la
 * première (relevé du lot 6 bis, Shihwa : `[]`). Le différentiel fige cette
 * paire des DEUX côtés (B.6 amendé, point 2) ; vide, elle rend infaisable
 * tout build dont le minimum d'ATQ dépend de l'apport +100 × 2 que
 * `artifactBounds.possibles` a pourtant admis à la recherche — le cas 3 (c)
 * de la revue externe de l'outil F (« choisir et archiver explicitement la
 * paire de référence »). L'option ne touche ni `artifactBounds` (le domaine
 * de la recherche) ni la recette : elle s'archive avec la commande du point.
 *
 * Contrôles, refus nommé sinon (jamais une paire partielle silencieuse) :
 * deux identifiants distincts présents dans l'inventaire, une pièce
 * d'attribut ET une de type, portables par l'espèce (`artifactFitsMonster`),
 * pas deux intangibles (`artifactPairAllowed`). Ordre rendu : attribut puis
 * type, celui de `paireRepresentative`.
 */
export function paireDeReference(ids: readonly number[], inventaire: readonly ArtifactDetail[], porteur: PorteurArtefact): ArtifactDetail[] {
  if (ids.length !== 2 || ids[0] === ids[1] || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error(`--paire-reference : deux identifiants d'artéfact distincts attendus (reçu ${JSON.stringify(ids)}).`);
  }
  const pieces = ids.map((id) => {
    const a = inventaire.find((x) => x.id === id);
    if (!a) throw new Error(`--paire-reference : artéfact ${id} absent de l'inventaire.`);
    return a;
  });
  const element = pieces.find((a) => a.kind === 'element');
  const archetype = pieces.find((a) => a.kind === 'archetype');
  if (!element || !archetype) {
    throw new Error(`--paire-reference : une pièce d'attribut ET une pièce de type attendues (reçu ${pieces.map((a) => a.kind).join(' + ')}).`);
  }
  for (const a of pieces) {
    if (!artifactFitsMonster(a, porteur)) {
      throw new Error(`--paire-reference : l'artéfact ${a.id} (${a.kind}) n'est pas portable par l'espèce (${porteur.element} / ${porteur.archetype}).`);
    }
  }
  if (!artifactPairAllowed(element, archetype)) throw new Error('--paire-reference : deux intangibles ne se portent pas ensemble.');
  return [element, archetype];
}

/**
 * Charge un point depuis un `argv` : forme `--case=<i> [--relic-main=]
 * [--relic-type=] [--relic-min-upgrade=] [--export-dir=]` (l'intention vient
 * du MÊME parseur que `perf-battery`, `parseOptionsRelique` ; sans option
 * relique : `libre/libre/+6`, la forme du lot 4 — `equipped` y est refusé,
 * un oracle à N = 1 sur l'équipée est le moteur lui-même), ou forme
 * `<export> <recette> [--rta] [--siege=<deckId>[:defense]]
 * [--paire-reference=<id>,<id>]` (`paireDeReference` ci-dessus).
 */
export function chargerPointOracle(argv: readonly string[]): PointOracle {
  const lire = (prefixe: string) => argv.find((a) => a.startsWith(prefixe))?.slice(prefixe.length);
  const caseArg = lire('--case=');
  const index = Number(caseArg);
  const exportDir = lire('--export-dir=');
  const paireArg = lire('--paire-reference=');

  if (caseArg != null) {
    const cas = CASES[index];
    if (!cas || !Number.isInteger(index)) throw new Error(`--case doit désigner un index entre 0 et ${CASES.length - 1}.`);
    if (paireArg != null) throw new Error("--paire-reference ne s'applique qu'à la forme <export> <recette> : un cas de batterie porte sa paire (`gear.artifacts`).");
    const option = parseOptionsRelique(argv) ?? { principale: 'libre', type: 'libre', seuil: DEFAULT_RELIC_MIN_UPGRADE };
    if (option.principale === 'equipped') throw new Error("--relic-main=equipped n'est pas un point d'oracle : l'oracle mesure la dimension relique, l'équipée est le moteur lui-même.");
    const exportPath = exportDir ? resolve(exportDir, cas.exportPath) : cas.exportPath;
    const casEffectif = { ...cas, exportPath };
    const charge = loadCase(casEffectif);
    const { gear } = charge;
    const data = parseAccountSource(readFileSync(exportPath, 'utf8'))!;
    const { relics } = parseAccountInventory(data);
    const contexte = resoudreContexteRelique({ mode: 'recherche', ...option }, gear.relic, relics);
    // `casEffectif` ne porte pas `relic` : `relicContext` reste absent des
    // params — l'oracle l'efface de toute façon sur chacun de ses runs.
    const params = buildCaseSearchParams(casEffectif, charge, 10 * 60 * 1000);
    return {
      params,
      contexte,
      realDamage: null,
      label: libelleAvecRelique(cas.label, option),
      com2usId: charge.com2usId,
      lignesVerrouillees: [],
      // Un cas de batterie n'a pas de recette : le réglage par défaut, celui
      // que l'écran présente tant que l'utilisateur n'a rien touché.
      exclusive: { setup: DEFAULT_DAMAGE_SETUP, element: elementDe(charge.com2usId) },
    };
  }

  const [exportPath, recipePath] = argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!exportPath || !recipePath) throw new Error('Usage: relicOracle.ts --case=<index> […] ou relicOracle.ts <export.json> <recette.json> [--rta] [--siege=<deckId>[:defense]].');
  const rtaMode = argv.includes('--rta');
  const siegeArg = lire('--siege=');
  if (rtaMode && siegeArg != null) throw new Error('--rta et --siege sont exclusifs.');
  const mode: ModeChargement = rtaMode
    ? { type: 'rta' }
    : siegeArg != null
      ? (() => {
          const [deckIdRaw, variant] = siegeArg.split(':');
          const deckId = Number(deckIdRaw);
          if (!Number.isFinite(deckId)) throw new Error(`--siege=<deckId>[:defense] : deckId invalide (${deckIdRaw}).`);
          return { type: 'siege' as const, deckId, defense: variant === 'defense' };
        })()
      : { type: 'box' };
  const chargee = chargerRecette(exportPath, recipePath, mode);
  const data = parseAccountSource(readFileSync(exportPath, 'utf8'))!;
  const { relics } = parseAccountInventory(data);
  const contexte = resoudreContexteRelique(recipeToRelicIntent(chargee.recipe, chargee.loaded), chargee.loaded.gear.relic, relics);
  let params = chargee.params;
  if (paireArg != null) {
    const espece = loadMonstersList().find((m) => m.com2usId === chargee.loaded.com2usId);
    if (!espece) throw new Error(`--paire-reference : espèce ${chargee.loaded.com2usId} absente du bestiaire — porteur introuvable.`);
    const ids = paireArg.split(',').map(Number);
    params = { ...params, artifacts: paireDeReference(ids, chargee.loaded.allArtifacts, { element: espece.element, archetype: espece.archetype }) };
  }
  // ⚠️ Construit APRÈS le remplacement : le profil d'artéfacts du contexte de
  // dégâts est celui de la paire de référence effective.
  const realDamage = buildRealDamageContext(chargee.recipe, chargee.loaded.com2usId, params.artifacts);
  return {
    params,
    contexte,
    realDamage,
    label: chargee.recipe.monsterName,
    com2usId: chargee.loaded.com2usId,
    lignesVerrouillees: chargee.recipe.lignesVerrouillees ?? [],
    // ⚠️ Les MÊMES deux champs que `buildRealDamageContext` lit, mais lus
    // INDÉPENDAMMENT de lui : une recette sans sort calculable
    // (`realDamage === null`) porte quand même son leader skill et ses
    // compétences d'invocateur, qui entrent dans l'assiette `Y`.
    exclusive: {
      setup: chargee.recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP,
      element: elementDe(chargee.loaded.com2usId),
    },
  };
}

// L'élément de l'espèce — même lecture que `buildRealDamageContext`
// (realDamageCli.ts), jamais une seconde source.
function elementDe(com2usId: number): ElementKey | null {
  return loadMonstersList().find((m) => m.com2usId === com2usId)?.element ?? null;
}

export function relicOracleCli(): void {
  const { params, contexte, realDamage, label, exclusive } = chargerPointOracle(process.argv);
  const seuil = contexte.seuil;

  const debut = performance.now();
  let resultat: OracleResult;
  try {
    resultat = oracleSearch(params, contexte, { realDamage, exclusive });
  } catch (e) {
    // Refus NOMMÉ du moteur (pool de reliques vide en mode recherche, D1) :
    // imprimé tel quel, comme `optimizer-search.ts`, jamais présenté comme
    // « 0 build ».
    if (e instanceof RechercheRefusee) {
      process.stderr.write(`\n${e.message}\n`);
      process.exit(2);
    }
    throw e;
  }
  const ms = performance.now() - debut;
  process.stdout.write(JSON.stringify({
    case: label,
    seuil,
    objectif: params.objective,
    empreinte: contexte.empreinte,
    N: resultat.N,
    complet: resultat.complet,
    runs: resultat.runs,
    candidats: resultat.candidats.length,
    rid: resultat.rid ?? null,
    optimum: resultat.optimum ? { runeIds: resultat.optimum.runeIds, rid: resultat.optimum.rid ?? null, stats: resultat.optimum.stats, score: resultat.optimum.score } : null,
    ms,
  }));
}

const executeDirectement = process.argv[1] != null && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (executeDirectement) relicOracleCli();
