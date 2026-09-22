// Le différentiel de l'option A ENTIÈRE contre l'oracle — les mécanismes
// (implementation-relique, lot 6, B.6 amendé : « cinquième point d'entrée,
// le différentiel de fidélité »).
//
// Extrait TEL QUEL de `tests/relic-queue.test.ts` (lot 5b, revu par la revue
// adversariale du diff), qui le réimporte : ses assertions de corpus n'ont
// pas bougé et prouvent que rien n'a bougé ici. Aucune étape du pipeline
// n'est réimplémentée — seuls les paramètres sont assemblés, comme l'écran
// les assemble (`faireParamsArtefacts`, `resoudreEquipement`,
// OptimizerSection.tsx), puis `resoudreEquipementDuBuild` (la partie pure de
// la file), `respecteConditionsAvecRelique`, `sortCandidates`, le traceur du
// moteur.
//
// ⚠️ Ce module ne LANCE aucune recherche de lui-même (hors `classerPerte`,
// qui rejoue UNE recherche tracée sur le build perdu, et `saturationDe`, qui
// reconstruit les deux moitiés sans appariement) : l'orchestrateur de B.6
// (`scripts/relic-differentiel.ts`, un processus par recherche) et le test
// (tout dans un processus, fixtures) décident où et quand chercher.
//
// ⚠️ **Le domaine comparé est la seule dimension relique** (B.6 amendé) : la
// paire d'artéfacts de RÉFÉRENCE est `params.artifacts` — celle que l'oracle
// note (`candidatAvecRelique`) —, figée côté A par `paireFixe` (choix
// `equipped` × 2, `equipes` = cette paire, inventaire vide, verrous
// neutralisés comme l'écran quand les deux emplacements sont figés). Le
// préfiltre de `chercherPaires` peut réintroduire un emplacement VIDE (revue
// externe de l'outil F, sonde « quatre paires ») : la paire retenue par A est
// donc VÉRIFIÉE contre la référence, jamais supposée (`paireFixeRespectee`).

import { ArtifactDetail, RelicDetail, RuneDetail } from '../../src/types';
import { StatKey } from '../../src/lib/effects';
import { computeStats, statsParPaire } from '../../src/lib/stats';
import { RelicContext } from '../../src/lib/relicOptim';
import { APPORT_NEUTRE, ContexteExclusive, apportExclusive } from '../../src/lib/relicExclusive';
import {
  BuildCandidate,
  Objective,
  RealDamageContext,
  SearchParams,
  SearchResult,
  TraceCandidat,
  buildBuckets,
  candidateMetricTotal,
  objectiveScore,
  prepareSearch,
  respecteConditionsAvecRelique,
  searchBuilds,
  sortCandidates,
} from '../../src/lib/runeBuildOptim';
import { ArtifactSearchParams, LigneVerrouillee, respecteMinimums } from '../../src/lib/artifactOptim';
import { PorteurArtefact } from '../../src/lib/artifacts';
import { RegimeArtefacts, evaluerPourRegime, regimeArtefacts, regimeEquipementDe } from '../../src/lib/artifactEvaluation';
import { ResultatArtefacts, candidatAvecSaPaire, cleBuild } from '../../src/lib/artifactQueue';
import { EntreeResolution, resoudreEquipementDuBuild } from '../../src/lib/relicQueue';
import { OracleResult } from './relicOracle';
import { drain } from './drain';

/* --------------------------------------------------------------------------
 * Le branchement de l'écran, reproduit TEL QUEL (OptimizerSection.tsx :
 * `faireParamsArtefacts`, `resoudreEquipement`) — aucune étape du pipeline
 * n'est réimplémentée, seuls les paramètres sont assemblés ici.
 * ----------------------------------------------------------------------- */

export interface ReglagesDifferentiel {
  // Le critère effectif : `adapterAuTri ? sortBy : objective` — le régime en
  // découle par `regimeArtefacts`, le même pour la paire et la relique (D7).
  critere: StatKey | Objective;
  // Le contexte de dégâts SANS son profil d'artéfacts (`evaluerPourRegime`
  // recalcule celui de chaque paire) — DÉRIVÉ de `realDamage`, jamais un
  // second objet (revue externe de l'outil F, § 4).
  degats?: Omit<RealDamageContext, 'artefacts'> | null;
  porteur: PorteurArtefact;
  inventaireArtefacts?: ArtifactDetail[];
  /**
   * B.6 : la paire de référence figée côté A — `equipped` × 2, `equipes` =
   * cette paire, inventaire vide. Absente (tests du lot 5b) : `libre` sur un
   * inventaire vide, la paire vide.
   */
  paireFixe?: ArtifactDetail[];
  // Les verrous de la recette : neutralisés si `paireFixe` (les deux
  // emplacements figés — OptimizerSection.tsx, `artifactParams`), transmis
  // sinon.
  lignesVerrouillees?: LigneVerrouillee[];
  /**
   * Le contexte de l'assiette `Y` des propriétés uniques (lot 7) — le
   * `DamageSetup` et l'élément du monstre, disponibles quel que soit
   * l'objectif (« État de mon monstre » modifie les stats partout).
   *
   * ⚠️ **Le MÊME objet va à l'oracle** (`OptionsOracle.exclusive`) : c'est la
   * condition pour que les deux scores soient comparables. Absent des deux
   * côtés → apport neutre, le différentiel d'avant le lot 7.
   */
  exclusive?: ContexteExclusive | null;
}

export function regimeDe(r: ReglagesDifferentiel): RegimeArtefacts {
  // Sort non calculable : rabattu sur 'aucun' AVANT l'appel — la même
  // fonction que l'écran (`regimeEquipement`).
  return regimeEquipementDe(regimeArtefacts(r.critere), r.degats != null);
}

export function runesDe(p: SearchParams, c: BuildCandidate): RuneDetail[] {
  const byId = new Map(p.pool.map((r) => [r.id, r]));
  return c.runeIds.map((id) => byId.get(id)!).filter(Boolean);
}

// ⚠️ B.5b bis, bloquant 1 : le même calcul que `artifactParams`
// (OptimizerSection.tsx) — les stats sous MAXIMUM ACTIF, filtrées aux
// entrées réellement posées (> 0).
export function maxStatsActifsDe(p: SearchParams): StatKey[] {
  return (Object.keys(p.requirement.maxStats ?? {}) as StatKey[]).filter((k) => (p.requirement.maxStats?.[k] ?? 0) > 0);
}

export function entreeResolution(p: SearchParams, c: BuildCandidate, ctx: RelicContext | undefined, r: ReglagesDifferentiel): EntreeResolution {
  const gear = { base: p.base, runes: runesDe(p, c), artifacts: p.artifacts, relic: p.relic };
  const regime = regimeDe(r);
  const minimumsPoses = Object.values(p.requirement.minStats).some((v) => (v ?? 0) > 0);
  const fixe = r.paireFixe;
  return {
    gear,
    faireParams: (rel): ArtifactSearchParams => {
      const statsAvec = statsParPaire({ ...gear, relic: rel });
      // Le canal exclusive (lot 7) : la candidate essayée, plus le contexte de
      // son assiette `Y` — exactement ce que l'écran pose dans
      // `faireParamsArtefacts`.
      const exclusive = r.exclusive ? { relique: rel, setup: r.exclusive.setup, element: r.exclusive.element } : undefined;
      const evaluer =
        regime === 'degats_reels'
          ? evaluerPourRegime(regime, statsAvec, r.degats!, exclusive)
          : evaluerPourRegime(regime, statsAvec, exclusive);
      return {
        porteur: r.porteur,
        inventaire: fixe ? [] : (r.inventaireArtefacts ?? []),
        equipes: fixe ?? [],
        principaleParSorte: fixe ? { element: 'equipped', archetype: 'equipped' } : {},
        lignesVerrouillees: fixe ? [] : (r.lignesVerrouillees ?? []),
        maxStatsActifs: maxStatsActifsDe(p),
        evaluer,
      };
    },
    respecteConditions: minimumsPoses ? (arts) => respecteMinimums(computeStats({ ...gear, artifacts: arts }), p.requirement.minStats) : null,
    requirement: p.requirement,
    regimeAucun: regime === 'aucun',
    relicContext: ctx,
  };
}

export function resoudreCandidat(p: SearchParams, c: BuildCandidate, ctx: RelicContext | undefined, r: ReglagesDifferentiel): ResultatArtefacts {
  return resoudreEquipementDuBuild(entreeResolution(p, c, ctx, r));
}

// Le score d'un candidat RÉSOLU, par la fonction que l'oracle utilise
// (`scoreDuCandidat`) — jamais une formule propre. En Efficience, la métrique
// des runes (`candidateMetricTotal`), pas le score de paire (régime `aucun`).
//
// ⚠️ `relique` + `exclusive` (lot 7) : l'apport de la propriété unique de la
// relique RETENUE par ce candidat, calculé par le même module et depuis le
// même contexte que côté oracle (`scoreDuCandidat`, relicOracle.ts). Sans
// eux, A noterait sans exclusive ce que l'oracle note avec — et F ne
// comparerait plus rien.
export function scoreOracle(
  p: SearchParams,
  c: BuildCandidate,
  realDamage?: RealDamageContext | null,
  relique?: RelicDetail,
  exclusive?: ContexteExclusive | null
): number {
  const objectif = p.objective ?? 'efficience';
  if (objectif === 'efficience') return candidateMetricTotal(c, new Map(p.pool.map((r) => [r.id, r])), p.metric);
  const apport = exclusive ? apportExclusive(relique, c.stats, exclusive.setup, exclusive.element) : APPORT_NEUTRE;
  return objectiveScore(c, objectif, realDamage ?? undefined, apport);
}

export function cle(runeIds: number[]): string {
  return [...runeIds].sort((a, b) => a - b).join(',');
}

/* --------------------------------------------------------------------------
 * Saturation (instrumentation de 5a) et classement d'une perte (traceur)
 * ----------------------------------------------------------------------- */

export type ClasseDePerte = 'faux négatif' | 'dilution' | 'tronqué' | 'non observable';

export interface Saturation {
  filterSlot: boolean;
  compartiments: boolean;
  maxCollected: boolean;
  maxMs: boolean;
  detail: string;
}

/**
 * L'instrumentation de 5a : aucune capacité saturée ? `filterSlot` (la
 * première structure BORNÉE) n'a rien retiré de ce que les élagages SÛRS
 * (dominance, faisabilité) lui ont laissé — observé par `onStage`, jamais
 * « pool filtré = pool par slot » (un élagage sûr n'est pas une capacité) —,
 * aucun compartiment n'atteint `bucketCap`, `MAX_COLLECTED` et `maxMs` non
 * atteints. Coût : `prepareSearch` + `buildBuckets` des deux moitiés, sans
 * appariement (secondes, même à volume réel).
 */
export function saturationDe(p: SearchParams, trace: TraceCandidat, tronque: boolean, collectes: number): Saturation {
  const etages: Partial<Record<string, number[]>> = {};
  const prepared = prepareSearch(p, (etage, bySlot) => { etages[etage] = bySlot.map((l) => l.length); })!;
  const popA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA)).map((b) => b.combos.length);
  const popB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB)).map((b) => b.combos.length);
  const cap = prepared.bucketCap;
  const avantFiltre = etages.feasibility ?? trace.compteurs.poolParSlot;
  const apresFiltre = etages.filterslot ?? trace.compteurs.filtreParSlot;
  const filterSlot = apresFiltre.some((n, i) => n < avantFiltre[i]!);
  const compartiments = [...popA, ...popB].some((n) => n >= cap);
  const maxCollected = collectes >= prepared.maxCollected;
  const maxMs = tronque && !maxCollected;
  return {
    filterSlot,
    compartiments,
    maxCollected,
    maxMs,
    detail: `filterSlot ${apresFiltre.join('/')} sur ${avantFiltre.join('/')} après élagages sûrs (pool ${trace.compteurs.poolParSlot.join('/')}) ; compartiments A [${popA.join(',')}] B [${popB.join(',')}] / cap ${cap} ; collectés ${collectes} / ${prepared.maxCollected} ; tronqué ${tronque}`,
  };
}

/**
 * Classe une perte à partir de la trace PRODUITE par le moteur (jamais
 * rejouée) : rejeté par un prédicat de faisabilité → faux négatif ; évincé
 * d'une structure bornée (`filterSlot`, tranches) → dilution ; budget →
 * tronqué ; rien d'observé → « non observable » (nommé, jamais une cause
 * fabriquée — revue externe de l'outil F, § 2).
 */
export function classerPerteParTrace(t: TraceCandidat, runeIds: number[]): { classe: ClasseDePerte; detail: string } {
  const feas = t.preparation.find((e) => e.etage === 'feasibility')?.presentes ?? [];
  const predicats = ['bucketPairFeasibleMin', 'comboAFeasible', 'quickOkMin', 'quickOkMax', 'validationFinale'] as const;
  const rejete = predicats.find((k) => t.appariement[k] === false);
  if (feas.some((x) => !x) || rejete) return { classe: 'faux négatif', detail: rejete ?? 'eliminateInfeasible' };
  const filtre = t.preparation.find((e) => e.etage === 'filterslot')?.presentes ?? [];
  const evinceA = t.moities.A?.retenue === false;
  const evinceB = t.moities.B?.retenue === false;
  if (filtre.some((x) => !x)) return { classe: 'dilution', detail: `filterSlot : runes ${runeIds.filter((_, i) => !filtre[i]).join(',')} hors du pool filtré` };
  if (evinceA || evinceB) {
    const m = (evinceA ? t.moities.A : t.moities.B)!;
    return { classe: 'dilution', detail: `moitié ${evinceA ? 'A' : 'B'} évincée (${m.tranches?.map((x) => `${x.nom} ${x.retenue ? 'garde' : 'évince'} ${x.taille}/${x.cap}`).join(' ; ') ?? 'tranches non observées'})` };
  }
  if (t.budget.tronque) return { classe: 'tronqué', detail: `budget ${t.budget.motif}` };
  return { classe: 'non observable', detail: `non collecté sans explication — ${JSON.stringify(t)}` };
}

/** Rejoue UNE recherche tracée sur le build perdu, puis classe — le chemin des tests (fixtures) ; l'orchestrateur lit la trace portée par le run A. */
export function classerPerte(p: SearchParams, runeIds: number[]): { classe: ClasseDePerte; detail: string } {
  const r = searchBuilds({ ...p, traceur: { runeIds } });
  return classerPerteParTrace(r.traceur!, runeIds);
}

/* --------------------------------------------------------------------------
 * La résolution de TOUS les candidats relâchés, et la comparaison
 * ----------------------------------------------------------------------- */

export interface CandidatResolu {
  cle: string;
  rid: number;
  score: number;
  enrichi: BuildCandidate;
  // Les artéfacts retenus par la résolution, à comparer à la paire de référence.
  artefactsIds: number[];
  // La paire retenue est EXACTEMENT la paire de référence (`paireFixe`
  // absente → toujours vrai : rien à figer).
  paireFixeRespectee: boolean;
  // Assertion finale redondante : le couple retenu respecte minimums ET
  // maximums avec sa relique (`respecteConditionsAvecRelique`, côté mesure).
  conditionsRespectees: boolean;
}

/**
 * L'option A : chaque candidat relâché résolu par la partie pure de la file
 * — TOUS (K = ∞), pas seulement le top-K de l'écran ; les non conformes
 * (aucun couple faisable) sont écartés, comme `affichees` les écarte.
 */
export function resoudreTousLesCandidats(
  p: SearchParams,
  relaxed: Pick<SearchResult, 'candidates'>,
  ctx: RelicContext,
  reglages: ReglagesDifferentiel,
  realDamage?: RealDamageContext | null
): CandidatResolu[] {
  const reference = (reglages.paireFixe ?? []).map((a) => a.id).sort((a, b) => a - b).join(',');
  return relaxed.candidates
    .map((c) => ({ c, r: resoudreCandidat(p, c, ctx, reglages) }))
    .filter(({ r }) => r.conforme)
    .map(({ c, r }) => {
      const enrichi = candidatAvecSaPaire(c, new Map([[cleBuild(c), r]]));
      const artefactsIds = r.artefacts.map((a) => a.id).sort((a, b) => a - b);
      // Hors mode `recherche` (`equipped`, contexte `off`), la file ne pose pas
      // `relique` : la relique portée est fixe (`ctx.equipee`, le même
      // paramètre que le moteur) — même convention que `comparerOptionA`
      // (`ctx.equipee`, sentinelle `-1` sans relique). Lot 6 bis : le point
      // `equipped` de non-régression n'avait jamais été joué par A au lot 6.
      const relique = r.relique ?? (ctx.mode === 'recherche' ? undefined : ctx.equipee);
      const rid = relique?.id ?? -1;
      return {
        cle: cle(c.runeIds),
        rid,
        score: scoreOracle(p, enrichi, realDamage, relique, reglages.exclusive),
        enrichi,
        artefactsIds,
        paireFixeRespectee: reglages.paireFixe ? artefactsIds.join(',') === reference : true,
        conditionsRespectees: respecteConditionsAvecRelique({ base: p.base, runes: runesDe(p, enrichi), artifacts: r.artefacts }, relique, p.requirement).respecte,
      };
    });
}

export interface Optimum {
  score: number;
  rids: number[];
  cles: string[];
}

export function optimumDe(liste: { score: number; rid: number; cle: string }[]): Optimum | null {
  if (liste.length === 0) return null;
  let max = -Infinity;
  for (const x of liste) if (x.score > max) max = x.score;
  const tete = liste.filter((x) => x.score === max);
  return { score: max, rids: [...new Set(tete.map((x) => x.rid))].sort((a, b) => a - b), cles: [...new Set(tete.map((x) => x.cle))].sort() };
}

export interface PerteClassee {
  build: string;
  classe: ClasseDePerte;
  detail: string;
}

export interface TopK {
  k: number;
  // Les clés des K meilleurs de chaque côté, par `sortCandidates` (jamais
  // l'ordre de fusion de l'oracle), frontière traitée « ≥ score du K-ième ».
  oracle: string[];
  A: string[];
  communs: number;
  scoreFrontiereOracle: number | null;
}

export interface ResultatDifferentiel {
  // Complétude : les N runs de l'oracle ET le run A.
  complet: boolean;
  tronqueA: boolean;
  runsOracleTronques: number;
  N: number;
  optimumA: Optimum | null;
  optimumOracle: Optimum | null;
  // F du point : même score d'optimum (égalité exacte) ; `null` si un côté
  // est vide (deux `null` ne sont PAS deux scores égaux — statut distinct).
  fidele: boolean | null;
  statut: 'fidele' | 'perte' | 'surplus' | 'vide des deux cotes' | 'A vide' | 'oracle vide';
  ratioScore: number | null;
  faisablesA: string[];
  faisablesOracle: string[];
  // Faisable pour l'oracle, absent de A.
  perdus: string[];
  // Faisable pour A, absent de l'oracle — pas une perte de A : une perte de
  // l'ORACLE par ses propres structures bornées (chaque run a le même
  // `bucketCap`), à diagnostiquer dans l'autre sens.
  surplus: string[];
  // Relâché mais rejeté par la résolution exacte alors que l'oracle le trouve
  // faisable : un faux négatif de la RÉSOLUTION (classé sans trace).
  rejetesParResolution: string[];
  // Les candidats de l'oracle qui ne respectent PAS les conditions avec la
  // paire de référence (bornes d'artéfacts plus larges que la paire — revue
  // externe de l'outil F, § 3) : contrôlé, rapporté.
  oracleNonConformes: string[];
  paireFixeViolee: string[];
  conditionsVioleesA: string[];
  top20: TopK;
  sature: Saturation | null;
  // L'optimum de l'oracle perdu : classé par la trace (fournie par l'appelant
  // — le run A la porte en B.6 ; les tests rejouent une recherche tracée).
  perteOptimum: PerteClassee | null;
}

export interface EntreesComparaison {
  p: SearchParams;
  ctx: RelicContext;
  oracle: OracleResult;
  relaxed: Pick<SearchResult, 'candidates' | 'truncated'>;
  resolus: CandidatResolu[];
  realDamage?: RealDamageContext | null;
  // La trace de l'optimum de l'oracle dans le run A (`SearchResult.traceur`),
  // si l'appelant l'a demandée ; sinon `classerPerte` rejoue une recherche.
  traceOptimum?: TraceCandidat | null;
  // La saturation, si l'appelant l'a calculée (coûte `buildBuckets`).
  sature?: Saturation | null;
  k?: number;
}

function topKDe(p: SearchParams, candidats: BuildCandidate[], scores: Map<string, number>, k: number, realDamage?: RealDamageContext | null): { cles: string[]; frontiere: number | null } {
  const objectif: Objective = p.objective ?? 'efficience';
  const tries = sortCandidates(candidats, objectif, { runeById: new Map(p.pool.map((r) => [r.id, r])), metric: p.metric, realDamage });
  if (tries.length === 0) return { cles: [], frontiere: null };
  const kieme = tries[Math.min(k, tries.length) - 1]!;
  const frontiere = scores.get(cle(kieme.runeIds)) ?? null;
  const cles = frontiere == null ? tries.slice(0, k).map((c) => cle(c.runeIds)) : tries.filter((c) => (scores.get(cle(c.runeIds)) ?? -Infinity) >= frontiere).map((c) => cle(c.runeIds));
  return { cles: [...new Set(cles)].sort(), frontiere };
}

export function comparerOptionA(e: EntreesComparaison): ResultatDifferentiel {
  const { p, ctx, oracle, relaxed, resolus, realDamage } = e;
  const k = e.k ?? 20;
  const parCleA = new Map(resolus.map((x) => [x.cle, x]));
  const parCleOracle = new Map(oracle.candidats.map((c) => [cle(c.runeIds), c]));
  const clesRelachees = new Set(relaxed.candidates.map((c) => cle(c.runeIds)));

  const faisablesA = [...parCleA.keys()].sort();
  const faisablesOracle = [...parCleOracle.keys()].sort();
  const perdus = faisablesOracle.filter((c) => !parCleA.has(c));
  const surplus = faisablesA.filter((c) => !parCleOracle.has(c));
  const rejetesParResolution = perdus.filter((c) => clesRelachees.has(c));

  const oracleNonConformes = oracle.candidats
    .filter((c) => !respecteConditionsAvecRelique({ base: p.base, runes: runesDe(p, c), artifacts: p.artifacts }, ctx.eligibles.find((r) => r.id === c.rid) ?? (ctx.mode === 'recherche' ? undefined : ctx.equipee), p.requirement).respecte)
    .map((c) => cle(c.runeIds));

  const optimumA = optimumDe(resolus);
  const optimumOracle = optimumDe(oracle.candidats.map((c) => ({ score: c.score, rid: c.rid ?? -1, cle: cle(c.runeIds) })));

  let statut: ResultatDifferentiel['statut'];
  let fidele: boolean | null;
  if (!optimumA && !optimumOracle) { statut = 'vide des deux cotes'; fidele = null; }
  else if (!optimumA) { statut = 'A vide'; fidele = false; }
  else if (!optimumOracle) { statut = 'oracle vide'; fidele = null; }
  else if (optimumA.score === optimumOracle.score) { statut = 'fidele'; fidele = true; }
  else if (optimumA.score > optimumOracle.score) { statut = 'surplus'; fidele = false; }
  else { statut = 'perte'; fidele = false; }
  const ratioScore = optimumA && optimumOracle && optimumOracle.score !== 0 ? optimumA.score / optimumOracle.score : null;

  const scoresOracle = new Map(oracle.candidats.map((c) => [cle(c.runeIds), c.score]));
  const scoresA = new Map(resolus.map((x) => [x.cle, x.score]));
  const topOracle = topKDe(p, oracle.candidats, scoresOracle, k, realDamage);
  const topA = topKDe(p, resolus.map((x) => x.enrichi), scoresA, k, realDamage);
  const top20: TopK = { k, oracle: topOracle.cles, A: topA.cles, communs: topOracle.cles.filter((c) => topA.cles.includes(c)).length, scoreFrontiereOracle: topOracle.frontiere };

  let perteOptimum: PerteClassee | null = null;
  if (optimumOracle && optimumA && optimumA.score < optimumOracle.score) {
    const build = optimumOracle.cles[0]!;
    const runeIds = parCleOracle.get(build)!.runeIds;
    if (clesRelachees.has(build)) perteOptimum = { build, classe: 'faux négatif', detail: 'candidat relâché, rejeté par la résolution exacte' };
    else if (e.traceOptimum) perteOptimum = { build, ...classerPerteParTrace(e.traceOptimum, runeIds) };
    else perteOptimum = { build, ...classerPerte(p, runeIds) };
  } else if (optimumOracle && !optimumA) {
    const build = optimumOracle.cles[0]!;
    const runeIds = parCleOracle.get(build)!.runeIds;
    perteOptimum = e.traceOptimum ? { build, ...classerPerteParTrace(e.traceOptimum, runeIds) } : { build, ...classerPerte(p, runeIds) };
  }

  return {
    complet: oracle.complet && !relaxed.truncated,
    tronqueA: relaxed.truncated,
    runsOracleTronques: oracle.runs.filter((r) => r.truncated).length,
    N: oracle.N,
    optimumA,
    optimumOracle,
    fidele,
    statut,
    ratioScore,
    faisablesA,
    faisablesOracle,
    perdus,
    surplus,
    rejetesParResolution,
    oracleNonConformes,
    paireFixeViolee: resolus.filter((x) => !x.paireFixeRespectee).map((x) => x.cle),
    conditionsVioleesA: resolus.filter((x) => !x.conditionsRespectees).map((x) => x.cle),
    top20,
    sature: e.sature ?? null,
    perteOptimum,
  };
}

/** Le contexte de dégâts SANS profil d'artéfacts, dérivé de `realDamage` — un seul objet source. */
export function degatsSansArtefacts(realDamage: RealDamageContext | null | undefined): Omit<RealDamageContext, 'artefacts'> | null {
  if (!realDamage) return null;
  const { artefacts: _a, ...reste } = realDamage;
  return reste;
}

export type { RelicDetail };
