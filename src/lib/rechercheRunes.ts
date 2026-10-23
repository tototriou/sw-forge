// Le moteur de recherche de runes d'un bloc, hors Worker : `prepareSearch`,
// les deux moitiés, puis leur appariement, dans le même fil. Cette API
// synchrone sert aux tests ; l'écran et les outils asynchrones passent par
// `lancerAppariement`, un Worker enfant par moitié et par préréglage construit.
//
// ⚠️ Module à part de `runeBuildOptim.ts` : l'orchestration appelle des
// modules qui importent eux-mêmes `runeBuildOptim.ts`, et un import de valeur
// dans l'autre sens ferait un cycle au chargement.
// Voir docs/03-developpeur/optimizer/moteur/pipeline.md.

import {
  Bucket,
  BuildBucketsContext,
  BuildingProgress,
  CranEmboite,
  PairingProgress,
  PreparedSearch,
  SearchParams,
  SearchResult,
  TraceCandidat,
  bucketKeyOf,
  buildBuckets,
  prepareSearch,
} from './runeBuildOptim';
import { RuneDetail } from '../types';
import { OrdreCombos, construireMoitieRapide, construireMoitieRapideTypee } from './constructionRapide';
import { apparierRapide } from './appariementRapide';
import { UnionDesRetentions, UnionDesRetentionsTypees } from './retentionEmboitee';
import { Compartiment, CompartimentType, typerCompartiments } from './demiBuildsTypes';
import { ColonnesCandidats, creerColonnesCandidats, objetsDesCandidats } from './candidatsCompacts';

/**
 * L'appariement séquentiel par le chemin de production : le noyau sur
 * tableaux typés (`apparierRapide`), qui saute sans les juger un à un les
 * comboB dont la paire échouerait au test rapide (`quickOk`) et visite les
 * autres dans l'ordre de `pairBuckets` ; parcours sans sauts hors contrat
 * numérique, `pairBuckets` avec un traceur (`verifierContrat`). Même résultat que
 * `pairBuckets` (`tests/appariement-rapide.test.ts`), mêmes points de passage
 * (toutes les `CHECKPOINT_EVERY` paires TRAITÉES, sautées comprises,
 * `explored` = paires traitées). Le résultat est un `SearchResult` strict :
 * les compteurs propres au noyau (`visitees`, `chemin`…) ne voyagent pas.
 */
export function* apparier(prepared: PreparedSearch, bucketsA: Compartiment[], bucketsB: Compartiment[]): Generator<PairingProgress<ColonnesCandidats>, SearchResult, void> {
  // L'API objet ne projette qu'à sa sortie ; les points de passage gardent les colonnes.
  const collecte = creerColonnesCandidats();
  const gen = apparierRapide(prepared, bucketsA, bucketsB, { collecte });
  let step = gen.next();
  while (!step.done) {
    yield step.value;
    step = gen.next();
  }
  const r = step.value;
  return {
    candidates: objetsDesCandidats(collecte),
    explored: r.explored,
    truncated: r.truncated,
    nearMissByCondition: r.nearMissByCondition,
    globalNearMiss: r.globalNearMiss,
    ...(r.traceur ? { traceur: r.traceur } : {}),
  };
}

/** Au-delà, le code entier d'un triplet ne tient plus dans 32 bits : `constructionRapide` refuse. */
const TRIPLETS_MAX_NOYAU = 0x7fffffff;

/**
 * Pourquoi une moitié se construit par `buildBuckets` plutôt que par le noyau
 * sur tableaux typés, ou `null` quand le noyau la prend. Trois cas : un
 * traceur de diagnostic (le noyau ne le remplit pas), une moitié de plus de
 * 2³¹ triplets (≈ 1 290 runes par emplacement), un `bucketCap` (override de
 * mesure) dont les tas sortiraient des entiers 32 bits.
 */
export function motifRepliConstruction(
  ctx: BuildBucketsContext,
  slotIdxs: readonly [number, number, number]
): string | null {
  if (ctx.traceur) return 'traceur de diagnostic demandé';
  const triplets = slotIdxs.reduce((p, i) => p * ctx.filtered[i].length, 1);
  if (triplets > TRIPLETS_MAX_NOYAU) return `${triplets} triplets dépassent le code entier 32 bits du noyau`;
  // Les capacités des tas entrent dans un `Int32Array` : `bucketCap` (un
  // override de mesure peut valoir 2³¹ ou `Infinity`), pour chaque tranche
  // (une par stat retenue, plus la générique et la combinée).
  const tranches = 2 + ctx.retentionKeys.length;
  if (!Number.isInteger(ctx.bucketCap) || ctx.bucketCap < 0 || ctx.bucketCap * tranches > TRIPLETS_MAX_NOYAU) {
    return `bucketCap ${ctx.bucketCap} hors des capacités entières du noyau (${tranches} tranches)`;
  }
  return null;
}

/**
 * La construction d'UN préréglage : le noyau sur tableaux typés
 * (`construireMoitieRapide`), qui rend EXACTEMENT les compartiments de
 * `buildBuckets` (mêmes combinaisons dans le même ordre, mêmes bornes, même
 * potentiel ; `tests/construction-rapide.test.ts`), avec le même point de
 * passage par rune du premier emplacement ; `buildBuckets` dans les cas de
 * `motifRepliConstruction`.
 */
function* construireUnPrereglage(
  half: 'A' | 'B',
  slotIdxs: readonly [number, number, number],
  ctx: BuildBucketsContext,
  otherHalfMaxSets: number[],
  combosOrderMode: OrdreCombos
): Generator<BuildingProgress, Bucket[], void> {
  if (motifRepliConstruction(ctx, slotIdxs) != null) {
    return yield* buildBuckets(half, slotIdxs, ctx, otherHalfMaxSets, undefined, combosOrderMode);
  }
  return yield* construireMoitieRapide(half, slotIdxs, ctx, otherHalfMaxSets, combosOrderMode);
}

/**
 * Ce que lit la construction d'une moitié : les champs de `buildBuckets`, plus
 * les préréglages plus étroits dont la rétention s'ajoute (`cransEmboites`,
 * OBLIGATOIRE : un constructeur qui l'oublie — requête d'un Worker de moitié,
 * coquille Node — échoue au typage au lieu de rendre en silence la rétention
 * d'un seul préréglage). Un `PreparedSearch` convient tel quel.
 */
export interface ContexteMoitie extends BuildBucketsContext {
  cransEmboites: readonly CranEmboite[];
}

/**
 * La progression de la construction d'une moitié, préréglages plus étroits
 * compris : UN compte, en runes du premier emplacement de la moitié, sommées
 * sur le préréglage de la recherche puis sur chaque préréglage plus étroit
 * (une même rune compte une fois par préréglage). C'est le `total` des points
 * de passage de `construireMoitie`.
 */
export function totalConstruction(ctx: ContexteMoitie, slotIdxs: readonly [number, number, number]): number {
  let total = ctx.filtered[slotIdxs[0]].length;
  for (const cran of ctx.cransEmboites) total += cran.indices[slotIdxs[0]].length;
  return total;
}

/** Les points de passage d'une construction, décalés dans le compte unique de la moitié. */
function* decaler<T>(gen: Generator<BuildingProgress, T, void>, deja: number, total: number): Generator<BuildingProgress, T, void> {
  let step = gen.next();
  while (!step.done) {
    yield { phase: 'building', half: step.value.half, scanned: deja + step.value.scanned, total };
    step = gen.next();
  }
  return step.value;
}

/**
 * La construction d'une moitié par le chemin de production : celle du
 * préréglage de la recherche (`construireUnPrereglage`), puis, préréglages
 * emboîtés, celle de chaque préréglage plus étroit (`ctx.cransEmboites`, avec
 * SES paramètres : pool, `bucketCap`, joker, bornes de sets de l'autre
 * moitié), dont les demi-builds absents s'ajoutent aux compartiments de la
 * recherche (`UnionDesRetentions`). Sans préréglage plus étroit (Bas), le
 * résultat et les points de passage sont exactement ceux du préréglage seul.
 * Un traceur ne suit que la construction du préréglage de la recherche ; sa
 * présence finale (`retenue`, `rang`, `population`) se relit après l'union.
 * Mêmes arguments que `buildBuckets`, sans `skylineKeys`, qu'aucun appel de
 * production ne passe.
 */
export function* construireMoitie(
  half: 'A' | 'B',
  slotIdxs: readonly [number, number, number],
  ctx: ContexteMoitie,
  otherHalfMaxSets: number[],
  combosOrderMode: OrdreCombos = 'objective'
): Generator<BuildingProgress, Bucket[], void> {
  if (ctx.cransEmboites.length === 0) {
    return yield* construireUnPrereglage(half, slotIdxs, ctx, otherHalfMaxSets, combosOrderMode);
  }
  const total = totalConstruction(ctx, slotIdxs);
  let deja = 0;
  const propre = yield* decaler(construireUnPrereglage(half, slotIdxs, ctx, otherHalfMaxSets, combosOrderMode), deja, total);
  deja += ctx.filtered[slotIdxs[0]].length;
  const pools = slotIdxs.map((s) => ctx.filtered[s]) as [RuneDetail[], RuneDetail[], RuneDetail[]];
  const union = new UnionDesRetentions(propre, pools);
  // Un préréglage plus étroit se construit sans traceur : la trace décrit la
  // rétention du préréglage de la recherche.
  for (const cran of ctx.cransEmboites) {
    const filtered = cran.indices.map((idx, s) => idx.map((i) => ctx.filtered[s][i]));
    const ctxCran: BuildBucketsContext = { ...ctx, filtered, bucketCap: cran.bucketCap, jokerCredit: cran.jokerCredit, traceur: undefined };
    const autre = half === 'A' ? cran.maxSetsForA : cran.maxSetsForB;
    union.ajouter(yield* decaler(construireUnPrereglage(half, slotIdxs, ctxCran, autre, combosOrderMode), deja, total));
    deja += filtered[slotIdxs[0]].length;
  }
  const buckets = union.resultat(ctx, combosOrderMode);
  if (ctx.traceur) relirePresenceTraceur(ctx.traceur, half, buckets);
  return buckets;
}

/** Chemin en colonnes de la recherche ; seul le traceur demande la référence objet. */
export function* construireMoitieTypee(
  half: 'A' | 'B', slotIdxs: readonly [number, number, number], ctx: ContexteMoitie,
  otherHalfMaxSets: number[], mode: OrdreCombos = 'objective'
): Generator<BuildingProgress, CompartimentType[], void> {
  if (ctx.traceur) return typerCompartiments(yield* construireMoitie(half, slotIdxs, ctx, otherHalfMaxSets, mode));
  const un = function* (c: BuildBucketsContext, autre: number[]): Generator<BuildingProgress, CompartimentType[], void> {
    return yield* construireMoitieRapideTypee(half, slotIdxs, c, autre, mode);
  };
  if (ctx.cransEmboites.length === 0) return yield* un(ctx, otherHalfMaxSets);
  const total = totalConstruction(ctx, slotIdxs);
  const propre = yield* decaler(un(ctx, otherHalfMaxSets), 0, total);
  let deja = ctx.filtered[slotIdxs[0]].length;
  const pools = slotIdxs.map((s) => ctx.filtered[s]) as [RuneDetail[], RuneDetail[], RuneDetail[]];
  const union = new UnionDesRetentionsTypees(propre, pools);
  for (const cran of ctx.cransEmboites) {
    const filtered = cran.indices.map((idx, s) => idx.map((i) => ctx.filtered[s][i]));
    const c = { ...ctx, filtered, bucketCap: cran.bucketCap, jokerCredit: cran.jokerCredit };
    union.ajouter(yield* decaler(un(c, half === 'A' ? cran.maxSetsForA : cran.maxSetsForB), deja, total));
    deja += filtered[slotIdxs[0]].length;
  }
  return union.resultat(ctx, mode);
}

/**
 * La présence finale de la moitié traceuse, relue sur les compartiments de
 * l'union : un préréglage plus étroit peut avoir ajouté un demi-build que les
 * tranches de la recherche (`tranches`, inchangées) avaient évincé.
 */
function relirePresenceTraceur(traceur: TraceCandidat, half: 'A' | 'B', buckets: Bucket[]): void {
  const t = traceur.moities[half];
  if (!t || t.compartiment == null) return;
  const ids = (half === 'A' ? [0, 1, 2] : [3, 4, 5]).map((i) => traceur.runeIds[i]);
  const b = buckets.find((x) => bucketKeyOf(x.counts, x.jokers) === t.compartiment);
  const rang = b ? b.combos.findIndex((c) => c.runes.every((r, i) => r.id === ids[i])) : -1;
  t.retenue = rang >= 0;
  if (rang >= 0) t.rang = rang + 1;
  else delete t.rang;
  t.population = b?.combos.length ?? 0;
}

/**
 * Cœur du moteur, sous forme de GÉNÉRATEUR : un point de passage à chaque
 * rune du premier emplacement d'une moitié pendant la construction, puis
 * toutes les `CHECKPOINT_EVERY` paires à l'appariement. `searchBuilds` le
 * draine d'un bloc.
 */
export function* searchBuildsSteps(params: SearchParams): Generator<BuildingProgress | PairingProgress<ColonnesCandidats>, SearchResult, void> {
  // Le traceur d'un rejet par pré-filtrage : `prepareSearch` le construit puis le perd en rendant
  // `null` — récupéré ici via `onReject` pour qu'un résultat vide reste
  // diagnosticable (étage `feasibility`/`filterslot` à 0), au lieu de
  // disparaître précisément quand l'instrumentation sert le plus.
  let traceurRejet: TraceCandidat | undefined;
  const prepared = prepareSearch(params, undefined, (t) => { traceurRejet = t; });
  if (!prepared) {
    return { candidates: [], explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null, ...(traceurRejet ? { traceur: traceurRejet } : {}) };
  }
  const bucketsA = yield* construireMoitieTypee(
    'A', [0, 1, 2], prepared, prepared.maxSetsForA, params.combosOrderMode
  );
  const bucketsB = yield* construireMoitieTypee(
    'B', [3, 4, 5], prepared, prepared.maxSetsForB, params.combosOrderMode
  );
  return yield* apparier(prepared, bucketsA, bucketsB);
}

/** Le générateur drainé jusqu'au bout, en un appel synchrone. */
export function searchBuilds(params: SearchParams): SearchResult {
  const gen = searchBuildsSteps(params);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}
