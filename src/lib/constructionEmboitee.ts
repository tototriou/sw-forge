// Lanceur commun de construction : pool de tranches borné par les cœurs,
// fusion en colonnes, puis union des rétentions dans l'ordre des crans.
// Les orchestrateurs par cran en fin de module servent les oracles des tests.
//
// ⚠️ Module neutre (ni `self`, ni `worker_threads`) : la plateforme arrive par
// la fabrique injectée (`TravailleurConstruction`) — Web Workers dans
// `runeBuildOptim.worker.ts`, `worker_threads` dans la coquille Node
// (`scripts/lib/buildHalvesNode.ts`, partagé par tous les outils).
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
import { EntreeTranche, ResultatTranche, contexteDe, fusionnerTranchesTypees, repartirIdx0 } from './constructionRapide';
import { nombreDeTravailleurs } from '../workers/parallelPairing';

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

export interface RequeteTranche extends RequeteMoitie {
  idx0s: number[];
}

/** Une tâche à la fois par poignée ; le même Worker sert plusieurs crans. */
export interface TravailleurConstruction {
  construire(requete: RequeteTranche, progression: (scanned: number) => void): Promise<ResultatTranche>;
  terminer(): void | Promise<void>;
}

export function entreeDeTranche(r: RequeteTranche): EntreeTranche {
  return { ctx: contexteDe(r), slotIdxs: r.slotIdxs, otherHalfMaxSets: r.otherHalfMaxSets, idx0s: r.idx0s };
}

/**
 * Lanceur commun à l'écran et aux outils : un pool borné par la règle des
 * cœurs pour TOUTES les moitiés et tous les crans. Chaque cran garde son
 * ordre de pool et ses tas ; la fusion précède l'union ordonnée des crans.
 */
export async function lancerConstruction(
  prepared: PreparedSearch,
  mode: OrdreCombos | undefined,
  options: {
    concurrence: number | undefined;
    coeursPhysiques: number | null;
    creer: () => TravailleurConstruction;
    progression?: (half: 'A' | 'B', scanned: number, total: number) => void;
    annulation?: Promise<never>;
  }
): Promise<{ bucketsA: CompartimentType[]; bucketsB: CompartimentType[] }> {
  const nombre = nombreDeTravailleurs(options.concurrence, options.coeursPhysiques);
  const moities = (['A', 'B'] as const).map((half) => {
    const crans = requetesDeLaMoitie(prepared, half, mode).map((requete) => ({
      requete, tranches: [] as ResultatTranche[], vus: 0,
    }));
    return { half, crans, total: crans.reduce((n, c) => n + c.requete.filtered[c.requete.slotIdxs[0]].length, 0) };
  });
  const taches: { rangTranche: number; requete: RequeteTranche; recevoir: (r: ResultatTranche) => void; progression: (n: number) => void }[] = [];
  for (let rang = 0; rang < moities[0].crans.length; rang++) for (const m of moities) {
    const c = m.crans[rang];
    for (const [rangTranche, idx0s] of repartirIdx0(c.requete.filtered[c.requete.slotIdxs[0]].length, nombre).entries()) {
      if (!idx0s.length) continue;
      let vu = 0;
      taches.push({ rangTranche, requete: { ...c.requete, idx0s }, recevoir: (r) => c.tranches.push(r), progression: (n) => {
        if (!Number.isInteger(n) || n < vu || n > idx0s.length) throw new Error('Construction : progression de tranche invalide.');
        c.vus += n - vu;
        vu = n;
        options.progression?.(m.half, m.crans.reduce((s, cran) => s + cran.vus, 0), m.total);
      } });
    }
  }
  // Une tranche de chaque moitié et de chaque cran avant leur tranche
  // suivante : les petits crans peuvent finir sans attendre le pool large.
  taches.sort((a, b) => a.rangTranche - b.rangTranche);
  const travailleurs: TravailleurConstruction[] = [];
  let prochain = 0;
  let fini = false;
  const servir = async () => {
    const fil = options.creer();
    travailleurs.push(fil);
    while (!fini && prochain < taches.length) {
      const t = taches[prochain++];
      const r = await fil.construire(t.requete, (n) => { if (!fini) t.progression(n); });
      if (fini) return;
      t.progression(t.requete.idx0s.length);
      t.recevoir(r);
    }
  };
  try {
    const travail = Promise.all(Array.from({ length: Math.min(nombre, taches.length) }, servir));
    if (options.annulation) await Promise.race([travail, options.annulation]);
    else await travail;
    const resultats = moities.map((m) => {
      const construits = m.crans.map((c) => {
        const resultat = fusionnerTranchesTypees(c.requete, c.requete.slotIdxs,
          c.requete.otherHalfMaxSets, mode ?? 'objective', c.tranches);
        c.tranches.length = 0;
        return resultat;
      });
      const r = m.crans[0].requete;
      const union = new UnionDesRetentionsTypees(construits[0], r.slotIdxs.map((s) => r.filtered[s]) as [RuneDetail[], RuneDetail[], RuneDetail[]]);
      for (const cran of construits.slice(1)) union.ajouter(cran);
      // Sans ajout, le matérialiseur conserve aussi les compartiments vides.
      const resultat = construits.length === 1 ? construits[0] : union.resultat(prepared, mode ?? 'objective');
      options.progression?.(m.half, m.total, m.total);
      return resultat;
    });
    return { bucketsA: resultats[0], bucketsB: resultats[1] };
  } finally {
    fini = true;
    await Promise.all(travailleurs.map((fil) => fil.terminer()));
  }
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
