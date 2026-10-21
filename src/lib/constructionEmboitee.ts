// La construction des moitiés en parallèle, préréglages emboîtés compris : UN
// fil par moitié ET par préréglage construit (le préréglage de la recherche,
// puis chaque préréglage plus étroit, `PreparedSearch.cransEmboites`), chacun
// construisant UN seul préréglage, tous lancés ensemble ; puis, par moitié,
// l'union des rétentions (`UnionDesRetentions`) dans l'ordre des préréglages.
// `construireMoitiesEmboiteesTypees` garde les colonnes de l'écran ; l'API
// objet `construireMoitiesEmboitees` sert les outils. Chacune rend exactement
// sa construction d'un bloc (même construction et union, dans le même ordre :
// tests/retention-emboitee.test.ts).
//
// ⚠️ Module neutre (ni `self`, ni `worker_threads`) : la plateforme arrive par
// le lanceur injecté (`LancerConstruction`) — Web Workers de moitié dans
// `runeBuildOptim.worker.ts`, `worker_threads` dans la coquille Node
// (`scripts/lib/buildHalvesNode.ts`, `perf-battery`).
//
// Pourquoi des fils séparés, et pas une seule passe qui remplirait la liste de
// chaque préréglage : l'ordre du pool d'un préréglage plus étroit n'est pas
// une sous-suite de celui du préréglage de la recherche (les tranches par stat
// de `filterSlot` s'y rangent ailleurs), et les tas de la rétention départagent
// les scores égaux — fréquents, les scores par stat sont entiers — par l'ordre
// d'arrivée : parcouru dans l'ordre du pool large, un préréglage plus étroit ne
// retient pas les mêmes demi-builds. Voir
// docs/03-developpeur/optimizer/moteur/elagages.md § Préréglages emboîtés.

import { BaseStats, RuneDetail } from '../types';
import { StatKey } from './effects';
import { Bucket, CranEmboite, PreparedSearch } from './runeBuildOptim';
import { UnionDesRetentions, UnionDesRetentionsTypees } from './retentionEmboitee';
import { CompartimentType } from './demiBuildsTypes';

type OrdreCombos = 'potential' | 'relevance' | 'combined' | 'objective';

/**
 * Ce qu'un fil de construction reçoit : sérialisable tel quel
 * (`postMessage`, `workerData`), et structurellement un `ContexteMoitie`.
 * Dans la construction en parallèle, `cransEmboites` est toujours vide : un
 * fil construit UN préréglage.
 */
export interface RequeteMoitie {
  half: 'A' | 'B';
  // Le préréglage que ce fil construit : 0 pour celui de la recherche (le
  // pool entier), i ≥ 1 pour le i-ème de `PreparedSearch.cransEmboites`, du
  // plus large au plus étroit. Un appelant qui distingue le fil de la
  // recherche (relevés des outils de mesure) le lit ici, jamais par
  // l'identité de `filtered`.
  rangPrereglage: number;
  slotIdxs: readonly [number, number, number];
  filtered: RuneDetail[][];
  distinctKeys: string[];
  constrainedKeys: StatKey[];
  retentionKeys: StatKey[];
  minEntries: { k: StatKey; min: number }[];
  bucketCap: number;
  otherHalfMaxSets: number[];
  jokerCredit: number;
  requiredPieces: number[];
  base: BaseStats;
  objectiveKeys: StatKey[];
  cransEmboites: CranEmboite[];
  // ⚠️ Relayé depuis `SearchParams.combosOrderMode` : sans lui, le fil
  // retomberait sur le défaut interne de la construction, quoi que demande
  // l'appelant.
  combosOrderMode?: OrdreCombos;
}

/**
 * Les requêtes d'une moitié : le préréglage de la recherche, puis chaque
 * préréglage plus étroit dans l'ordre de `cransEmboites` (du plus large au
 * plus étroit), chacun avec SES paramètres (pool, `bucketCap`, joker, bornes
 * de sets de l'autre moitié) — ceux que `construireMoitie` lui donne.
 */
export function requetesDeLaMoitie(prepared: PreparedSearch, half: 'A' | 'B', combosOrderMode: OrdreCombos | undefined): RequeteMoitie[] {
  const slotIdxs: readonly [number, number, number] = half === 'A' ? [0, 1, 2] : [3, 4, 5];
  const commun = {
    half, slotIdxs, distinctKeys: prepared.distinctKeys, constrainedKeys: prepared.constrainedKeys,
    retentionKeys: prepared.retentionKeys, minEntries: prepared.minEntries, requiredPieces: prepared.requiredPieces,
    base: prepared.base, objectiveKeys: prepared.objectiveKeys, cransEmboites: [], combosOrderMode,
  };
  const propre: RequeteMoitie = {
    ...commun, rangPrereglage: 0, filtered: prepared.filtered, bucketCap: prepared.bucketCap, jokerCredit: prepared.jokerCredit,
    otherHalfMaxSets: half === 'A' ? prepared.maxSetsForA : prepared.maxSetsForB,
  };
  return [propre, ...prepared.cransEmboites.map((cran, i): RequeteMoitie => ({
    ...commun,
    rangPrereglage: i + 1,
    filtered: cran.indices.map((idx, s) => idx.map((i) => prepared.filtered[s][i])),
    bucketCap: cran.bucketCap,
    jokerCredit: cran.jokerCredit,
    otherHalfMaxSets: half === 'A' ? cran.maxSetsForA : cran.maxSetsForB,
  }))];
}

/** Lance la construction d'UN préréglage d'une moitié, et relaie sa progression (runes de SON premier emplacement). */
export type LancerConstruction = (requete: RequeteMoitie, progression: (scanned: number, total: number) => void) => Promise<Bucket[]>;

/**
 * Les deux moitiés, chaque préréglage dans son fil, tous lancés avant la
 * première attente. La progression d'une moitié est UN compte : la somme de
 * ce qu'a parcouru chacun de ses fils, sur la somme de leurs totaux
 * (`totalConstruction`). L'union se fait dans l'ordre des préréglages, quel
 * que soit l'ordre d'arrivée des fils.
 */
export async function construireMoitiesEmboitees(
  prepared: PreparedSearch,
  combosOrderMode: OrdreCombos | undefined,
  lancer: LancerConstruction,
  progression?: (half: 'A' | 'B', scanned: number, total: number) => void
): Promise<{ bucketsA: Bucket[]; bucketsB: Bucket[] }> {
  return construireMoities(prepared, combosOrderMode, lancer, (propre, pools) => new UnionDesRetentions(propre, pools), progression);
}

/** Chemin de l'écran : les réponses des Workers et leur union restent en colonnes. */
export async function construireMoitiesEmboiteesTypees(
  prepared: PreparedSearch,
  combosOrderMode: OrdreCombos | undefined,
  lancer: (requete: RequeteMoitie, progression: (scanned: number, total: number) => void) => Promise<CompartimentType[]>,
  progression?: (half: 'A' | 'B', scanned: number, total: number) => void
): Promise<{ bucketsA: CompartimentType[]; bucketsB: CompartimentType[] }> {
  return construireMoities(prepared, combosOrderMode, lancer, (propre, pools) => new UnionDesRetentionsTypees(propre, pools), progression);
}

async function construireMoities<T>(
  prepared: PreparedSearch,
  combosOrderMode: OrdreCombos | undefined,
  lancer: (requete: RequeteMoitie, progression: (scanned: number, total: number) => void) => Promise<T[]>,
  creerUnion: (propre: T[], pools: [RuneDetail[], RuneDetail[], RuneDetail[]]) => { ajouter(e: T[]): void; resultat(ctx: PreparedSearch, mode: OrdreCombos): T[] },
  progression?: (half: 'A' | 'B', scanned: number, total: number) => void
): Promise<{ bucketsA: T[]; bucketsB: T[] }> {
  const moitie = (half: 'A' | 'B') => {
    const requetes = requetesDeLaMoitie(prepared, half, combosOrderMode);
    const totaux = requetes.map((r) => r.filtered[r.slotIdxs[0]].length);
    const total = totaux.reduce((a, b) => a + b, 0);
    const vus = totaux.map(() => 0);
    const fils = requetes.map((r, i) => lancer(r, (scanned) => {
      vus[i] = scanned;
      progression?.(half, vus.reduce((a, b) => a + b, 0), total);
    }));
    return { requetes, fils };
  };
  const a = moitie('A');
  const b = moitie('B');
  const unir = async ({ requetes, fils }: ReturnType<typeof moitie>): Promise<T[]> => {
    const [propre, ...etroits] = await Promise.all(fils);
    if (etroits.length === 0) return propre;
    const r = requetes[0];
    const union = creerUnion(propre, [r.filtered[r.slotIdxs[0]], r.filtered[r.slotIdxs[1]], r.filtered[r.slotIdxs[2]]]);
    for (const e of etroits) union.ajouter(e);
    return union.resultat(prepared, combosOrderMode ?? 'objective');
  };
  const [bucketsA, bucketsB] = await Promise.all([unir(a), unir(b)]);
  return { bucketsA, bucketsB };
}
