// Noyau de l'appariement sur tableaux typés : le chemin de production
// (`apparier` dans src/lib/rechercheRunes.ts en séquentiel,
// `appariementRapideParallele.ts` en parallèle). `pairBuckets`
// (runeBuildOptim.ts) reste la RÉFÉRENCE et le repli hors contrat numérique.
// Voir docs/03-developpeur/optimizer/moteur/pipeline.md § Appariement séquentiel.
// Il ne remplace que la boucle la plus intérieure (`for comboB of bB.combos`) :
// ordre des paires de compartiments, prédicats de compartiment et de comboA,
// et tout ce qui suit `quickOk` restent ceux de la production.
//
// L'idée : `quickOk` rejette l'écrasante majorité des paires. Pour un comboA
// et une stat contrainte, la contribution d'un comboB se réduit à UN entier
// `W` (`b × pct + 100 × flat` pour PV/ATQ/DEF, `flat` sinon), et la paire
// échoue à `quickOk` si et seulement si, pour une stat, `W ≤ L` ou `W > H`,
// `L`/`H` calculés une fois par comboA. Ces deux équivalences (rejet du
// minimum `ceil(n / 100) < t` ⟺ `n ≤ 100 (t − 1)`, rejet du maximum
// `ceil(n / 100) > t` ⟺ `n > 100 t`) ne valent que sous des préconditions
// d'intégrité vérifiées avant toute paire (`verifierContrat`) ; sans elles,
// le chemin actuel (`pairBuckets`) est pris tel quel.
//
// Les bornes écrites, leurs préconditions et l'ordre de visite :
// docs/03-developpeur/optimizer/moteur/noyau-appariement.md.
//
// ⚠️ **Rien de ce qui suit `quickOk` n'est réécrit** : le bloc de validation
// (`Collecteur.valider`) est une copie conforme de `pairBuckets`
// (runeBuildOptim.ts, de `const runes` à `candidates.push`), avec les deux
// fonctions privées dont il dépend (`totalCondition`, `valueOf`). Une
// divergence de cette copie se voit au différentiel du banc.

import { GearSet, RuneDetail } from '../types';
import { StatKey, activeSets, runeEfficiency, runeScore } from './effects';
import { computeStats, StatRow } from './stats';
import { missingSets } from './recoMatch';
import { AurasPropres, aurasPropresDesSetsActifs, pointsAuraResPrePropres } from './damage';
import { OptimMetric } from './runeOptim';
import {
  Bucket,
  BuildCandidate,
  BuildRequirement,
  CHECKPOINT_EVERY,
  NearMiss,
  PairingProgress,
  PreparedSearch,
  SearchParams,
  SearchResult,
  StatShortfall,
  bucketPairFeasibleMin,
  comboAFeasible,
  pairBuckets,
  prepareSearch,
  satisfiesSets,
} from './runeBuildOptim';

/** Taille d'un bloc de comboB consécutifs (ordre d'origine) pour le saut par bloc. */
export const TAILLE_BLOC = 64;
/** La dichotomie est prise quand la stat la plus sélective laisse au plus `n / FACTEUR_DICHOTOMIE` comboB. */
export const FACTEUR_DICHOTOMIE = 4;

// Bornes du contrat numérique (A.2 bis 6) : valeurs entières, produits
// `b × p` exacts en Float64 avec une large marge, `W` dans un Int32.
const BORNE_BASE = 2 ** 20;
const BORNE_VALEUR = 2 ** 20;
const BORNE_W = 2 ** 30;

/* --------------------------------------------------------------------------
 * Copies conformes de deux fonctions PRIVÉES de runeBuildOptim.ts
 * ----------------------------------------------------------------------- */

// Copie de `totalCondition` (runeBuildOptim.ts) — privée là-bas.
function totalCondition(total: number, key: string, requirement: Pick<BuildRequirement, 'auraResPre'>, propres: AurasPropres): number {
  if (key !== 'res' && key !== 'acc') return total;
  const aura = requirement.auraResPre;
  if (!aura?.compter) return total;
  return total + aura[key] + pointsAuraResPrePropres(propres)[key];
}

// Copie de `valueOf` (runeBuildOptim.ts) — privée là-bas.
function valueOf(rune: RuneDetail, metric: OptimMetric): number {
  return metric === 'eff' ? runeEfficiency(rune) : runeScore(rune);
}

// Copie de `orderedCompartmentPairs` (runeBuildOptim.ts) — privée là-bas —,
// qui rend les INDICES plutôt que les compartiments. Même tas, mêmes
// départages : la séquence est celle de `pairBuckets`.
export function* ordreDesCompartiments(bucketsA: Bucket[], bucketsB: Bucket[]): Generator<readonly [number, number], void, void> {
  interface Entry { i: number; j: number; sum: number }
  const heap: Entry[] = [];
  const seen = new Set<string>();
  function push(i: number, j: number): void {
    if (i >= bucketsA.length || j >= bucketsB.length) return;
    const key = `${i},${j}`;
    if (seen.has(key)) return;
    seen.add(key);
    const entry: Entry = { i, j, sum: bucketsA[i].potential + bucketsB[j].potential };
    heap.push(entry);
    let idx = heap.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heap[parent].sum >= heap[idx].sum) break;
      [heap[parent], heap[idx]] = [heap[idx], heap[parent]];
      idx = parent;
    }
  }
  function pop(): Entry {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let idx = 0;
      for (;;) {
        const l = 2 * idx + 1;
        const r = 2 * idx + 2;
        let largest = idx;
        if (l < heap.length && heap[l].sum > heap[largest].sum) largest = l;
        if (r < heap.length && heap[r].sum > heap[largest].sum) largest = r;
        if (largest === idx) break;
        [heap[largest], heap[idx]] = [heap[idx], heap[largest]];
        idx = largest;
      }
    }
    return top;
  }
  push(0, 0);
  while (heap.length > 0) {
    const { i, j } = pop();
    yield [i, j] as const;
    push(i + 1, j);
    push(i, j + 1);
  }
}

/** Les prédicats de compartiment de `pairBuckets`, dans son ordre, par les fonctions de production. */
export function paireDeCompartimentsOuverte(prepared: PreparedSearch, bA: Bucket, bB: Bucket): boolean {
  const { distinctKeys, requirement, minEntries, guaranteedMin, relPctMax, artFlatMax, totalOf } = prepared;
  if (!satisfiesSets(bA.counts, bA.jokers, bB.counts, bB.jokers, distinctKeys, requirement)) return false;
  if (bA.jokers + bB.jokers > 1) return false;
  return bucketPairFeasibleMin(bA, bB, minEntries, guaranteedMin, relPctMax, artFlatMax, totalOf);
}

/** `comboAFeasible` de production, avec les arguments de `pairBuckets`. */
export function comboAOuvert(prepared: PreparedSearch, comboA: Bucket['combos'][number], bB: Bucket): boolean {
  const { minEntries, maxEntries, guaranteed, guaranteedMin, relPctMax, artFlatMax, totalOf, artFlatMin, relPctMin } = prepared;
  return comboAFeasible(comboA, bB, minEntries, maxEntries, guaranteed, guaranteedMin, relPctMax, artFlatMax, totalOf, artFlatMin, relPctMin);
}

/* --------------------------------------------------------------------------
 * Disposition en tableaux typés
 * ----------------------------------------------------------------------- */

export interface MoitieTypee {
  /** `debut[i]` : indice global du premier demi-build du compartiment `i` ; longueur = compartiments + 1. */
  debut: Int32Array;
  /** Les trois runes de chaque demi-build (Float64 : les identifiants du jeu dépassent l'Int32). */
  ids: Float64Array;
  /** `pct[c·m + k]`, `flat[c·m + k]` : `combo.pct[cle] ?? 0`, `combo.flat[cle] ?? 0`. */
  pct: Int32Array;
  flat: Int32Array;
}

export interface MoitieBTypee extends MoitieTypee {
  /** `W[c·m + k]` : contribution scalaire du comboB à la stat `k`. */
  W: Int32Array;
  /** Par compartiment `i`, stat `k` : `W` trié croissant (`tri`) et indices locaux d'origine (`perm`), au segment `m·debut[i] + k·n`. */
  tri: Int32Array;
  perm: Int32Array;
  /** `debutBlocs[i]` : premier bloc du compartiment `i` ; `blocMin`/`blocMax[(bloc)·m + k]`. */
  debutBlocs: Int32Array;
  blocMin: Int32Array;
  blocMax: Int32Array;
}

export interface CompartimentsTypes {
  /** Les stats contraintes, dans l'ordre : clés des minimums puis celles des maximums absentes des minimums. */
  cles: StatKey[];
  m: number;
  A: MoitieTypee;
  B: MoitieBTypee;
}

/** Les tampons d'un `CompartimentsTypes`, pour un transfert (`Transferable`). */
export function tamponsDe(ct: CompartimentsTypes): ArrayBuffer[] {
  const { A, B } = ct;
  return [A.debut, A.ids, A.pct, A.flat, B.debut, B.ids, B.pct, B.flat, B.W, B.tri, B.perm, B.debutBlocs, B.blocMin, B.blocMax].map(
    (t) => t.buffer as ArrayBuffer
  );
}

/** Une copie indépendante (chaque Worker reçoit la sienne, transférée). */
export function copierCompartiments(ct: CompartimentsTypes): CompartimentsTypes {
  const c = (t: Int32Array) => t.slice();
  const { A, B } = ct;
  return {
    cles: [...ct.cles],
    m: ct.m,
    A: { debut: c(A.debut), ids: A.ids.slice(), pct: c(A.pct), flat: c(A.flat) },
    B: {
      debut: c(B.debut), ids: B.ids.slice(), pct: c(B.pct), flat: c(B.flat), W: c(B.W), tri: c(B.tri), perm: c(B.perm),
      debutBlocs: c(B.debutBlocs), blocMin: c(B.blocMin), blocMax: c(B.blocMax),
    },
  };
}

function clesContraintes(prepared: PreparedSearch): StatKey[] {
  const cles: StatKey[] = [];
  for (const { k } of prepared.minEntries) if (!cles.includes(k)) cles.push(k);
  for (const { k } of prepared.maxEntries) if (!cles.includes(k)) cles.push(k);
  return cles;
}

const estPct = (k: StatKey) => k === 'hp' || k === 'atk' || k === 'def';
const entierBorne = (v: number, borne: number) => Number.isInteger(v) && Math.abs(v) <= borne;

/**
 * Constantes par stat contrainte, lues une fois : base, aura externe déjà
 * ajoutée par `totalOf` (`A0`), seuils, termes fixes de `quickOk`.
 */
export interface ConstantesNoyau {
  cles: StatKey[];
  m: number;
  b: Float64Array;
  pct: Uint8Array;
  A0: Float64Array;
  /** `ceil(min)` (NaN sans minimum) et `floor(max)` (NaN sans maximum). */
  minC: Float64Array;
  maxF: Float64Array;
  /** Termes fixes côté minimum : `guaranteedMin.pct + relPctMax`, `guaranteedMin.flat + artFlatMax`. */
  fixPctMin: Float64Array;
  fixFlatMin: Float64Array;
  /** Côté maximum : `guaranteed.pct + relPctMin`, `guaranteed.flat + artFlatMin`. */
  fixPctMax: Float64Array;
  fixFlatMax: Float64Array;
  /** Pour la garde de référence : les termes un à un, dans l'ordre de `quickOk`. */
  minEntrees: { k: StatKey; min: number; kk: number; gmP: number; rp: number; gmF: number; af: number }[];
  maxEntrees: { k: StatKey; max: number; kk: number; gP: number; rp: number; gF: number; af: number }[];
  totalOf: (k: StatKey, pct: number, flat: number) => number;
}

export function constantesNoyau(prepared: PreparedSearch): ConstantesNoyau {
  const cles = clesContraintes(prepared);
  const m = cles.length;
  const baseRec = prepared.base as unknown as Record<string, number>;
  const { guaranteed, guaranteedMin, artFlatMax, artFlatMin, relPctMax, relPctMin, totalOf } = prepared;
  const c: ConstantesNoyau = {
    cles, m,
    b: new Float64Array(m), pct: new Uint8Array(m), A0: new Float64Array(m),
    minC: new Float64Array(m).fill(NaN), maxF: new Float64Array(m).fill(NaN),
    fixPctMin: new Float64Array(m), fixFlatMin: new Float64Array(m), fixPctMax: new Float64Array(m), fixFlatMax: new Float64Array(m),
    minEntrees: [], maxEntrees: [], totalOf,
  };
  cles.forEach((k, kk) => {
    const b = baseRec[k] ?? 0;
    c.b[kk] = b;
    c.pct[kk] = estPct(k) ? 1 : 0;
    // L'aura externe que `totalOf` ajoute DÉJÀ (RES/PRE, toggle actif) : lue,
    // jamais recalculée ni rajoutée.
    c.A0[kk] = estPct(k) ? 0 : totalOf(k, 0, 0) - b;
    c.fixPctMin[kk] = (guaranteedMin.pct[k] ?? 0) + (relPctMax[k] ?? 0);
    c.fixFlatMin[kk] = (guaranteedMin.flat[k] ?? 0) + (artFlatMax[k] ?? 0);
    c.fixPctMax[kk] = (guaranteed.pct[k] ?? 0) + (relPctMin[k] ?? 0);
    c.fixFlatMax[kk] = (guaranteed.flat[k] ?? 0) + (artFlatMin[k] ?? 0);
  });
  for (const { k, min } of prepared.minEntries) {
    const kk = cles.indexOf(k);
    c.minC[kk] = Math.ceil(min);
    c.minEntrees.push({ k, min, kk, gmP: guaranteedMin.pct[k] ?? 0, rp: relPctMax[k] ?? 0, gmF: guaranteedMin.flat[k] ?? 0, af: artFlatMax[k] ?? 0 });
  }
  for (const { k, max } of prepared.maxEntries) {
    const kk = cles.indexOf(k);
    c.maxF[kk] = Math.floor(max);
    c.maxEntrees.push({ k, max, kk, gP: guaranteed.pct[k] ?? 0, rp: relPctMin[k] ?? 0, gF: guaranteed.flat[k] ?? 0, af: artFlatMin[k] ?? 0 });
  }
  return c;
}

/**
 * Le contrat numérique (A.2 bis 6), vérifié AVANT toute paire. Rend `null`
 * s'il tient, sinon le motif du repli sur le chemin actuel.
 */
export function verifierContrat(prepared: PreparedSearch, bucketsA: Bucket[], bucketsB: Bucket[]): string | null {
  if (prepared.traceur) return 'traceur de diagnostic demandé (le noyau ne le remplit pas)';
  const c = constantesNoyau(prepared);
  const { guaranteed, guaranteedMin, artFlatMax, artFlatMin, relPctMax, relPctMin } = prepared;
  for (let kk = 0; kk < c.m; kk++) {
    const k = c.cles[kk];
    if (!entierBorne(c.b[kk], BORNE_BASE)) return `base ${k} non entière ou hors borne (${c.b[kk]})`;
    if (!entierBorne(c.A0[kk], BORNE_VALEUR)) return `aura externe ${k} non entière (${c.A0[kk]})`;
    for (const [nom, v] of [
      ['guaranteedMin.pct', guaranteedMin.pct[k] ?? 0], ['guaranteedMin.flat', guaranteedMin.flat[k] ?? 0],
      ['guaranteed.pct', guaranteed.pct[k] ?? 0], ['guaranteed.flat', guaranteed.flat[k] ?? 0],
      ['artFlatMax', artFlatMax[k] ?? 0], ['artFlatMin', artFlatMin[k] ?? 0],
      ['relPctMax', relPctMax[k] ?? 0], ['relPctMin', relPctMin[k] ?? 0],
    ] as const) {
      if (!entierBorne(v, BORNE_VALEUR)) return `${nom}[${k}] non entier ou hors borne (${v})`;
    }
  }
  for (const { k, min } of prepared.minEntries) if (!Number.isFinite(min)) return `minimum ${k} non fini`;
  for (const { k, max } of prepared.maxEntries) if (!Number.isFinite(max)) return `maximum ${k} non fini`;
  for (const [moitie, buckets] of [['A', bucketsA], ['B', bucketsB]] as const) {
    for (const bucket of buckets) {
      for (const combo of bucket.combos) {
        for (const r of combo.runes) if (!Number.isSafeInteger(r.id)) return `identifiant de rune non entier (${r.id})`;
        for (let kk = 0; kk < c.m; kk++) {
          const k = c.cles[kk];
          const p = combo.pct[k] ?? 0;
          const f = combo.flat[k] ?? 0;
          if (!entierBorne(p, BORNE_VALEUR) || !entierBorne(f, BORNE_VALEUR)) return `demi-build ${moitie} : ${k} non entier ou hors borne (${p} %, ${f})`;
          if (moitie === 'B') {
            const w = c.pct[kk] ? c.b[kk] * p + 100 * f : f;
            if (Math.abs(w) >= BORNE_W) return `contribution W de ${k} hors Int32 (${w})`;
          }
        }
      }
    }
  }
  return null;
}

function encoderMoitie(buckets: Bucket[], cles: StatKey[]): MoitieTypee {
  const m = cles.length;
  const debut = new Int32Array(buckets.length + 1);
  for (let i = 0; i < buckets.length; i++) debut[i + 1] = debut[i] + buckets[i].combos.length;
  const n = debut[buckets.length];
  const ids = new Float64Array(3 * n);
  const pct = new Int32Array(m * n);
  const flat = new Int32Array(m * n);
  let c = 0;
  for (const bucket of buckets) {
    for (const combo of bucket.combos) {
      ids[3 * c] = combo.runes[0].id;
      ids[3 * c + 1] = combo.runes[1].id;
      ids[3 * c + 2] = combo.runes[2].id;
      for (let kk = 0; kk < m; kk++) {
        pct[c * m + kk] = combo.pct[cles[kk]] ?? 0;
        flat[c * m + kk] = combo.flat[cles[kk]] ?? 0;
      }
      c++;
    }
  }
  return { debut, ids, pct, flat };
}

/**
 * ⚠️ Suppose `verifierContrat` passé : toutes les valeurs écrites dans les
 * Int32Array y sont exactes.
 */
export function encoderCompartiments(prepared: PreparedSearch, bucketsA: Bucket[], bucketsB: Bucket[]): CompartimentsTypes {
  const c = constantesNoyau(prepared);
  const { cles, m } = c;
  const A = encoderMoitie(bucketsA, cles);
  const base = encoderMoitie(bucketsB, cles);
  const nB = base.debut[bucketsB.length];
  const W = new Int32Array(m * nB);
  for (let g = 0; g < nB; g++) {
    for (let kk = 0; kk < m; kk++) {
      W[g * m + kk] = c.pct[kk] ? c.b[kk] * base.pct[g * m + kk] + 100 * base.flat[g * m + kk] : base.flat[g * m + kk];
    }
  }
  const tri = new Int32Array(m * nB);
  const perm = new Int32Array(m * nB);
  const debutBlocs = new Int32Array(bucketsB.length + 1);
  for (let i = 0; i < bucketsB.length; i++) debutBlocs[i + 1] = debutBlocs[i] + Math.ceil((base.debut[i + 1] - base.debut[i]) / TAILLE_BLOC);
  const nBlocs = debutBlocs[bucketsB.length];
  const blocMin = new Int32Array(m * nBlocs);
  const blocMax = new Int32Array(m * nBlocs);
  for (let i = 0; i < bucketsB.length; i++) {
    const off = base.debut[i];
    const n = base.debut[i + 1] - off;
    for (let kk = 0; kk < m; kk++) {
      const seg = m * off + kk * n;
      const idx = Array.from({ length: n }, (_, j) => j);
      idx.sort((x, y) => W[(off + x) * m + kk] - W[(off + y) * m + kk] || x - y);
      for (let p = 0; p < n; p++) {
        perm[seg + p] = idx[p];
        tri[seg + p] = W[(off + idx[p]) * m + kk];
      }
      for (let blk = 0; blk * TAILLE_BLOC < n; blk++) {
        let lo = Infinity;
        let hi = -Infinity;
        const fin = Math.min(n, (blk + 1) * TAILLE_BLOC);
        for (let j = blk * TAILLE_BLOC; j < fin; j++) {
          const w = W[(off + j) * m + kk];
          if (w < lo) lo = w;
          if (w > hi) hi = w;
        }
        blocMin[(debutBlocs[i] + blk) * m + kk] = lo;
        blocMax[(debutBlocs[i] + blk) * m + kk] = hi;
      }
    }
  }
  return { cles, m, A, B: { ...base, W, tri, perm, debutBlocs, blocMin, blocMax } };
}

/* --------------------------------------------------------------------------
 * Seuils d'une ligne et noyau
 * ----------------------------------------------------------------------- */

/**
 * Les seuils de la ligne du comboA d'indice global `ga` : la paire échoue à
 * `quickOk` ⟺ il existe `k` tel que `W_k ≤ L[k]` ou `W_k > H[k]`.
 *
 * PV/ATQ/DEF (`C = b × Pfix`, `T = b + Ffix + ceil((C + W) / 100)`) :
 *   `L = 100 × (ceil(min) − 1 − b − Ffix) − C` ; `H = 100 × (floor(max) − b − Ffix') − C'`.
 * Autres stats (`T = b + A0 + Ffix + W`) :
 *   `L = ceil(min) − 1 − b − A0 − Ffix` ; `H = floor(max) − b − A0 − Ffix'`.
 */
export function seuilsLigne(c: ConstantesNoyau, A: MoitieTypee, ga: number, L: Float64Array, H: Float64Array): void {
  const m = c.m;
  for (let kk = 0; kk < m; kk++) {
    const pA = A.pct[ga * m + kk];
    const fA = A.flat[ga * m + kk];
    const b = c.b[kk];
    const minC = c.minC[kk];
    const maxF = c.maxF[kk];
    if (c.pct[kk]) {
      L[kk] = minC === minC ? 100 * (minC - 1 - b - (fA + c.fixFlatMin[kk])) - b * (pA + c.fixPctMin[kk]) : -Infinity;
      H[kk] = maxF === maxF ? 100 * (maxF - b - (fA + c.fixFlatMax[kk])) - b * (pA + c.fixPctMax[kk]) : Infinity;
    } else {
      const a0 = c.A0[kk];
      L[kk] = minC === minC ? minC - 1 - b - a0 - (fA + c.fixFlatMin[kk]) : -Infinity;
      H[kk] = maxF === maxF ? maxF - b - a0 - (fA + c.fixFlatMax[kk]) : Infinity;
    }
  }
}

/** Nombre d'éléments `≤ x` dans `tri[seg .. seg + n)`, trié croissant. */
function rangSup(tri: Int32Array, seg: number, n: number, x: number): number {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (tri[seg + mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type CheminLigne = 'sautee' | 'dichotomie' | 'lineaire';

export interface CompteursNoyau {
  lignesSautees: number;
  lignesDichotomie: number;
  lignesLineaires: number;
  blocsSautes: number;
  gardeRejets: number;
}

export const compteursVides = (): CompteursNoyau => ({ lignesSautees: 0, lignesDichotomie: 0, lignesLineaires: 0, blocsSautes: 0, gardeRejets: 0 });

/**
 * Les comboB du compartiment B `ib` qui franchissent les seuils de la ligne,
 * par indice local CROISSANT (ordre d'origine), écrits dans `sortie`. Rend
 * leur nombre. Toute paire absente de `sortie` échoue à `quickOk`.
 */
export function survivantsLigne(
  ct: CompartimentsTypes,
  ib: number,
  L: Float64Array,
  H: Float64Array,
  sortie: Int32Array,
  compteurs: CompteursNoyau,
  forcer?: 'dichotomie' | 'lineaire'
): number {
  const { m, B } = ct;
  const off = B.debut[ib];
  const n = B.debut[ib + 1] - off;
  const W = B.W;
  if (m === 0) {
    for (let j = 0; j < n; j++) sortie[j] = j;
    compteurs.lignesLineaires++;
    return n;
  }
  // 1. Par stat, combien de comboB dans ]L, H] ? (deux dichotomies)
  let meilleure = 0;
  let meilleurCompte = Infinity;
  let meilleurDebut = 0;
  for (let kk = 0; kk < m; kk++) {
    const seg = m * off + kk * n;
    const bas = rangSup(B.tri, seg, n, L[kk]);
    const haut = rangSup(B.tri, seg, n, H[kk]);
    const compte = haut > bas ? haut - bas : 0;
    if (compte < meilleurCompte) {
      meilleurCompte = compte;
      meilleure = kk;
      meilleurDebut = bas;
      if (compte === 0) break;
    }
  }
  if (meilleurCompte === 0) {
    compteurs.lignesSautees++;
    return 0;
  }
  let c = 0;
  if (forcer === 'dichotomie' || (forcer !== 'lineaire' && meilleurCompte * FACTEUR_DICHOTOMIE <= n)) {
    // 2. Dichotomie : seuls les comboB qui passent la stat la plus sélective,
    // testés sur les autres, puis remis dans l'ordre d'origine.
    compteurs.lignesDichotomie++;
    const seg = m * off + meilleure * n;
    for (let p = meilleurDebut; p < meilleurDebut + meilleurCompte; p++) {
      const j = B.perm[seg + p];
      const base = (off + j) * m;
      let passe = true;
      for (let kk = 0; kk < m; kk++) {
        const w = W[base + kk];
        if (w <= L[kk] || w > H[kk]) {
          passe = false;
          break;
        }
      }
      if (passe) sortie[c++] = j;
    }
    if (c > 1) sortie.subarray(0, c).sort();
    return c;
  }
  // 3. Balayage dans l'ordre d'origine, par blocs.
  compteurs.lignesLineaires++;
  const blocs0 = B.debutBlocs[ib];
  for (let blk = 0; blk * TAILLE_BLOC < n; blk++) {
    const bm = (blocs0 + blk) * m;
    let sauter = false;
    for (let kk = 0; kk < m; kk++) {
      if (B.blocMax[bm + kk] <= L[kk] || B.blocMin[bm + kk] > H[kk]) {
        sauter = true;
        break;
      }
    }
    if (sauter) {
      compteurs.blocsSautes++;
      continue;
    }
    const fin = Math.min(n, (blk + 1) * TAILLE_BLOC);
    for (let j = blk * TAILLE_BLOC; j < fin; j++) {
      const base = (off + j) * m;
      let passe = true;
      for (let kk = 0; kk < m; kk++) {
        const w = W[base + kk];
        if (w <= L[kk] || w > H[kk]) {
          passe = false;
          break;
        }
      }
      if (passe) sortie[c++] = j;
    }
  }
  return c;
}

/**
 * La garde de référence : l'expression MÊME de `quickOk` (runeBuildOptim.ts,
 * `pairBuckets`), mêmes termes, sommés dans le même ordre, sur les valeurs
 * des Records recopiées telles quelles. Une paire visitée qui y échoue est
 * comptée (`gardeRejets`) et traitée comme par la production.
 */
export function quickOkReference(c: ConstantesNoyau, ct: CompartimentsTypes, ga: number, gb: number): boolean {
  const m = c.m;
  const { A, B } = ct;
  for (const e of c.minEntrees) {
    const p = A.pct[ga * m + e.kk] + B.pct[gb * m + e.kk] + e.gmP + e.rp;
    const f = A.flat[ga * m + e.kk] + B.flat[gb * m + e.kk] + e.gmF + e.af;
    if (c.totalOf(e.k, p, f) < e.min) return false;
  }
  for (const e of c.maxEntrees) {
    const p = A.pct[ga * m + e.kk] + B.pct[gb * m + e.kk] + e.gP + e.rp;
    const f = A.flat[ga * m + e.kk] + B.flat[gb * m + e.kk] + e.gF + e.af;
    if (c.totalOf(e.k, p, f) > e.max) return false;
  }
  return true;
}

/* --------------------------------------------------------------------------
 * Validation : copie conforme de `pairBuckets` après `quickOk`
 * ----------------------------------------------------------------------- */

export type EntreeQuasiSucces = { key: StatKey; kind: 'min' | 'max'; miss: NearMiss };

/** Une amélioration de l'état local du quasi-succès, avec la position de sa paire (rejeu ordonné, § fusion). */
export type Amelioration =
  | { pos: number; type: 'condition'; cle: string; entree: EntreeQuasiSucces }
  | { pos: number; type: 'global'; distance: number; miss: NearMiss };

export class Collecteur {
  readonly candidates: BuildCandidate[] = [];
  readonly positions: number[] = [];
  readonly nearMissByCondition = new Map<string, EntreeQuasiSucces>();
  globalNearMiss: NearMiss | null = null;
  private globalNearMissDistance = Infinity;
  private instantane: EntreeQuasiSucces[] | null = [];
  readonly ameliorations: Amelioration[] | null;
  private pos = 0;

  constructor(private readonly prepared: PreparedSearch, enregistrerAmeliorations: boolean, private readonly avecPositions: boolean) {
    this.ameliorations = enregistrerAmeliorations ? [] : null;
  }

  // Copie de `nearMissSnapshot` ; même contenu, recalculé seulement quand il change.
  snapshot(): EntreeQuasiSucces[] {
    if (this.instantane === null) this.instantane = Array.from(this.nearMissByCondition.values());
    return this.instantane;
  }

  // Copie de `considerNearMiss` (pairBuckets).
  private considerNearMiss(runeIds: number[], statsRow: StatRow[], effTotal: number, shortfalls: StatShortfall[]): void {
    if (shortfalls.length === 1) {
      const s = shortfalls[0];
      const mapKey = `${s.key}-${s.kind}`;
      const existing = this.nearMissByCondition.get(mapKey);
      if (!existing || s.shortfall < existing.miss.shortfalls[0].shortfall) {
        const entree: EntreeQuasiSucces = { key: s.key, kind: s.kind, miss: { runeIds, stats: statsRow, effTotal, shortfalls } };
        this.nearMissByCondition.set(mapKey, entree);
        this.instantane = null;
        this.ameliorations?.push({ pos: this.pos, type: 'condition', cle: mapKey, entree });
      }
    }
    const distance = Math.max(...shortfalls.map((s) => s.shortfall / s.requested));
    if (distance < this.globalNearMissDistance) {
      this.globalNearMissDistance = distance;
      this.globalNearMiss = { runeIds, stats: statsRow, effTotal, shortfalls };
      this.ameliorations?.push({ pos: this.pos, type: 'global', distance, miss: this.globalNearMiss });
    }
  }

  /**
   * La suite de `quickOk` dans `pairBuckets`, à l'identique : sets réels,
   * `computeStats`, test conjoint sur `artPossibles`, quasi-succès, collecte.
   * Rend vrai si le build est collecté. `pos` : position de la paire.
   */
  valider(runes: RuneDetail[], pos: number): boolean {
    this.pos = pos;
    const { base, artifacts, relic, requirement, metric, minEntries, maxEntries, artPossibles, artFlatFige, relicRelache, relTermMax, relTermMin } = this.prepared;
    const active = activeSets(runes.map((r) => r.set));
    if (missingSets(requirement.sets, active).length > 0) return false;
    const gear: GearSet = { base, runes, artifacts, relic: relicRelache ? undefined : relic };
    const stats = computeStats(gear);
    const apports = artPossibles.length > 0 ? artPossibles : [artFlatFige];
    const propres = aurasPropresDesSetsActifs(active);
    const runeIds = runes.map((r) => r.id);
    const effTotal = runes.reduce((sum, r) => sum + valueOf(r, metric), 0);
    let ok = false;
    for (const apport of apports) {
      const decalage = (k: StatKey) => (apport[k] ?? 0) - (artFlatFige[k] ?? 0);
      const shortfalls: StatShortfall[] = [];
      for (const { k, min } of minEntries) {
        const row = stats.find((r) => r.key === k);
        const actual = totalCondition((row?.total ?? 0) + decalage(k) + relTermMax(k), k, requirement, propres);
        if (actual < min) shortfalls.push({ key: k, kind: 'min', requested: min, actual, shortfall: min - actual });
      }
      for (const { k, max } of maxEntries) {
        const row = stats.find((r) => r.key === k);
        const actual = totalCondition((row?.total ?? 0) + decalage(k) + relTermMin(k), k, requirement, propres);
        if (actual > max) shortfalls.push({ key: k, kind: 'max', requested: max, actual, shortfall: actual - max });
      }
      if (shortfalls.length === 0) {
        ok = true;
        break;
      }
      this.considerNearMiss(runeIds, stats, effTotal, shortfalls);
    }
    if (!ok) return false;
    this.candidates.push({ runeIds, stats, effTotal });
    if (this.avecPositions) this.positions.push(pos);
    return true;
  }
}

/* --------------------------------------------------------------------------
 * L'appariement séquentiel
 * ----------------------------------------------------------------------- */

export interface ResultatAppariementRapide extends SearchResult {
  /** Paires traitées (= `explored`) : visitées + sautées. */
  traitees: number;
  /** Paires jugées par la garde de référence. */
  visitees: number;
  /** Paires écartées par une borne du noyau, sans jugement individuel. */
  sautees: number;
  chemin: 'noyau' | 'actuel';
  /** Pourquoi le chemin actuel a été pris. */
  motifChemin?: string;
  compteurs: CompteursNoyau;
}

export interface OptionsAppariementRapide {
  /** Tests seulement : impose le chemin de chaque ligne non sautée. */
  forcerChemin?: 'dichotomie' | 'lineaire';
  /** Tests seulement : appelé pour chaque paire VISITÉE (indices de compartiment et locaux). */
  observateur?: { visite(iA: number, a: number, iB: number, b: number): void };
}

/**
 * Le pendant de `pairBuckets(prepared, bucketsA, bucketsB)` : même résultat,
 * mêmes points de passage (toutes les `CHECKPOINT_EVERY` paires TRAITÉES,
 * `explored` = `traitees`), le noyau en plus. Contrat non tenu → `pairBuckets`
 * lui-même (`chemin: 'actuel'`).
 */
export function* apparierRapide(
  prepared: PreparedSearch,
  bucketsA: Bucket[],
  bucketsB: Bucket[],
  options: OptionsAppariementRapide = {}
): Generator<PairingProgress, ResultatAppariementRapide, void> {
  const motif = verifierContrat(prepared, bucketsA, bucketsB);
  if (motif) {
    const r = yield* pairBuckets(prepared, bucketsA, bucketsB);
    return { ...r, traitees: r.explored, visitees: r.explored, sautees: 0, chemin: 'actuel', motifChemin: motif, compteurs: compteursVides() };
  }
  const { maxCollected, maxMs, startedAt } = prepared;
  const overBudget = () => Date.now() - startedAt > maxMs;
  const ct = encoderCompartiments(prepared, bucketsA, bucketsB);
  const c = constantesNoyau(prepared);
  const L = new Float64Array(c.m);
  const H = new Float64Array(c.m);
  let maxB = 0;
  for (const b of bucketsB) maxB = Math.max(maxB, b.combos.length);
  const sortie = new Int32Array(maxB);
  const compteurs = compteursVides();
  const collecteur = new Collecteur(prepared, false, false);
  const candidates = collecteur.candidates;
  const progression = (traitees: number): PairingProgress => ({
    phase: 'pairing', candidates, explored: traitees, nearMissByCondition: collecteur.snapshot(), globalNearMiss: collecteur.globalNearMiss,
  });

  let traitees = 0;
  let visitees = 0;
  let prochainPoint = CHECKPOINT_EVERY;
  let truncated = false;

  outer: for (const [iA, iB] of ordreDesCompartiments(bucketsA, bucketsB)) {
    const bA = bucketsA[iA];
    const bB = bucketsB[iB];
    if (!paireDeCompartimentsOuverte(prepared, bA, bB)) continue;
    const nB = bB.combos.length;
    const offB = ct.B.debut[iB];
    for (let a = 0; a < bA.combos.length; a++) {
      const comboA = bA.combos[a];
      if (!comboAOuvert(prepared, comboA, bB)) continue;
      const debutLigne = traitees;
      const ga = ct.A.debut[iA] + a;
      seuilsLigne(c, ct.A, ga, L, H);
      const nSurv = survivantsLigne(ct, iB, L, H, sortie, compteurs, options.forcerChemin);
      for (let s = 0; s < nSurv; s++) {
        const j = sortie[s];
        const g = debutLigne + j + 1;
        while (prochainPoint <= g) {
          traitees = prochainPoint;
          yield progression(traitees);
          if (overBudget()) {
            truncated = true;
            break outer;
          }
          prochainPoint += CHECKPOINT_EVERY;
        }
        traitees = g;
        visitees++;
        if (overBudget()) {
          truncated = true;
          break outer;
        }
        options.observateur?.visite(iA, a, iB, j);
        if (!quickOkReference(c, ct, ga, offB + j)) {
          compteurs.gardeRejets++;
          continue;
        }
        const comboB = bB.combos[j];
        const runes: RuneDetail[] = [...comboA.runes, ...comboB.runes];
        if (!collecteur.valider(runes, g)) continue;
        if (candidates.length >= maxCollected) {
          truncated = true;
          break outer;
        }
      }
      const fin = debutLigne + nB;
      while (prochainPoint <= fin) {
        traitees = prochainPoint;
        yield progression(traitees);
        if (overBudget()) {
          truncated = true;
          break outer;
        }
        prochainPoint += CHECKPOINT_EVERY;
      }
      traitees = fin;
    }
  }

  return {
    candidates, explored: traitees, truncated, nearMissByCondition: collecteur.snapshot(), globalNearMiss: collecteur.globalNearMiss,
    traitees, visitees, sautees: traitees - visitees, chemin: 'noyau', compteurs,
  };
}

/* --------------------------------------------------------------------------
 * Corps d'un Worker : un MORCEAU de lignes consécutives
 * ----------------------------------------------------------------------- */

/** Ce que reçoit un Worker, une fois. ⚠️ Neutre : ni `worker_threads`, ni `self`. */
export interface InitTravailleur {
  params: SearchParams;
  /** L'instant de départ GLOBAL, comme `PairSliceRequest.startedAt`. */
  startedAt: number;
  compartiments: CompartimentsTypes;
}

/**
 * Un morceau : des segments `(iA, iB, aDebut, aFin)` de lignes consécutives
 * dans l'ordre de `pairBuckets`, et pour chaque comboA du segment le verdict
 * de `comboAFeasible` calculé par le coordinateur (`drapeaux`, 1 = ligne
 * ouverte). `offset` : la position globale de la paire qui précède le morceau.
 */
export interface Morceau {
  type: 'morceau';
  id: number;
  offset: number;
  taille: number;
  segments: Int32Array;
  drapeaux: Uint8Array;
  /**
   * Arrêt déterministe (tests et banc) : la position globale `N` du point de
   * passage où s'arrêter — les paires avant `N` sont jugées, `N` ne l'est pas.
   */
  limite?: number;
}

/**
 * Pourquoi un morceau a rendu la main : achevé, filet de temps (`maxMs`
 * depuis le `startedAt` global), plafond de candidats atteint DANS le
 * morceau, arrêt déterministe à `Morceau.limite`, arrêt manuel.
 */
export type IssueMorceau = 'complet' | 'temps' | 'plafond' | 'limite' | 'arret';

export interface ResultatMorceau {
  type: 'resultat';
  id: number;
  /** Paires traitées dans le morceau (`taille` s'il est achevé). */
  traitees: number;
  visitees: number;
  candidats: BuildCandidate[];
  positions: number[];
  /** Pour chaque candidat, les paires visitées du morceau jusqu'à lui compris : la fusion coupe les comptes au même endroit que les candidats. */
  visitesAuCandidat: number[];
  ameliorations: Amelioration[];
  issue: IssueMorceau;
  compteurs: CompteursNoyau;
}

export interface ContexteTravailleur {
  prepared: PreparedSearch;
  ct: CompartimentsTypes;
  c: ConstantesNoyau;
  runeParId: Map<number, RuneDetail>;
  L: Float64Array;
  H: Float64Array;
  sortie: Int32Array;
}

export function initialiserTravailleur(init: InitTravailleur): ContexteTravailleur {
  const prepared = prepareSearch(init.params);
  if (!prepared) throw new Error('prepareSearch a rendu null dans un Worker alors que le coordinateur a des compartiments');
  // ⚠️ AVANT tout usage du filet de temps : le budget court depuis l'instant
  // GLOBAL du lancement (construction des moitiés comprise), jamais depuis
  // la préparation propre à ce Worker.
  prepared.startedAt = init.startedAt;
  const ct = init.compartiments;
  const c = constantesNoyau(prepared);
  if (c.cles.join(',') !== ct.cles.join(',')) throw new Error(`stats contraintes divergentes entre coordinateur (${ct.cles}) et Worker (${c.cles})`);
  const runeParId = new Map<number, RuneDetail>();
  for (const list of prepared.filtered) for (const r of list) runeParId.set(r.id, r);
  let maxB = 0;
  for (let i = 0; i + 1 < ct.B.debut.length; i++) maxB = Math.max(maxB, ct.B.debut[i + 1] - ct.B.debut[i]);
  return { prepared, ct, c, runeParId, L: new Float64Array(c.m), H: new Float64Array(c.m), sortie: new Int32Array(maxB) };
}

/** Un morceau d'un bloc, sans arrêt manuel possible : le générateur drainé. */
export function traiterMorceau(ctx: ContexteTravailleur, morceau: Morceau): ResultatMorceau {
  const gen = parcourirMorceau(ctx, morceau);
  let step = gen.next(false);
  while (!step.done) step = gen.next(false);
  return step.value;
}

/**
 * Le corps d'un morceau, sous forme de GÉNÉRATEUR : il rend la main après
 * chaque ligne, et la valeur renvoyée par `next(true)` demande l'arrêt
 * manuel (le morceau rend alors ce qu'il a trouvé, ligne achevée). Ce qui
 * pilote un Worker (`servirAppariement`) s'en sert pour lire ses messages
 * entre deux tranches de travail, sans rien changer à ce qui est jugé.
 *
 * Le filet de temps se teste à chaque paire visitée ET à chaque point de
 * passage (`CHECKPOINT_EVERY` paires TRAITÉES, sautées comprises), comme
 * dans `apparierRapide` : un saut de lignes entières ne le contourne pas.
 * Les points de passage franchis par un saut le sont au même instant ; un
 * seul test les couvre, et la troncature tombe sur le premier d'entre eux.
 */
export function* parcourirMorceau(ctx: ContexteTravailleur, morceau: Morceau): Generator<void, ResultatMorceau, boolean | undefined> {
  const { prepared, ct, c, runeParId, L, H, sortie } = ctx;
  const { maxCollected, maxMs, startedAt } = prepared;
  const overBudget = () => Date.now() - startedAt > maxMs;
  const compteurs = compteursVides();
  const collecteur = new Collecteur(prepared, true, true);
  const visitesAuCandidat: number[] = [];
  const rune = (id: number) => {
    const r = runeParId.get(id);
    if (!r) throw new Error(`rune ${id} absente du pool préparé du Worker`);
    return r;
  };
  const limite = morceau.limite ?? Infinity;
  let pos = morceau.offset;
  let visitees = 0;
  let issue: IssueMorceau = 'complet';
  let prochainPoint = (Math.floor(morceau.offset / CHECKPOINT_EVERY) + 1) * CHECKPOINT_EVERY;
  // Les points de passage jusqu'à la position `jusqua` : un test du temps
  // pour tous ceux que l'on franchit. Vrai si le filet a expiré (`pos` posé
  // sur le premier d'entre eux).
  const passage = (jusqua: number): boolean => {
    if (prochainPoint > jusqua) return false;
    if (overBudget()) {
      pos = prochainPoint;
      return true;
    }
    prochainPoint = (Math.floor(jusqua / CHECKPOINT_EVERY) + 1) * CHECKPOINT_EVERY;
    return false;
  };
  let d = 0;
  const seg = morceau.segments;
  boucle: for (let s = 0; s + 3 < seg.length; s += 4) {
    const iA = seg[s];
    const iB = seg[s + 1];
    const nB = ct.B.debut[iB + 1] - ct.B.debut[iB];
    const offB = ct.B.debut[iB];
    for (let a = seg[s + 2]; a < seg[s + 3]; a++) {
      if (!morceau.drapeaux[d++]) continue;
      if (overBudget()) {
        issue = 'temps';
        break boucle;
      }
      const debutLigne = pos;
      const ga = ct.A.debut[iA] + a;
      seuilsLigne(c, ct.A, ga, L, H);
      const nSurv = survivantsLigne(ct, iB, L, H, sortie, compteurs);
      for (let k = 0; k < nSurv; k++) {
        const j = sortie[k];
        const g = debutLigne + j + 1;
        if (g >= limite) {
          pos = limite;
          issue = 'limite';
          break boucle;
        }
        if (passage(g)) {
          issue = 'temps';
          break boucle;
        }
        pos = g;
        visitees++;
        if (overBudget()) {
          issue = 'temps';
          break boucle;
        }
        const gb = offB + j;
        if (!quickOkReference(c, ct, ga, gb)) {
          compteurs.gardeRejets++;
          continue;
        }
        const ia3 = 3 * ga;
        const ib3 = 3 * gb;
        const runes: RuneDetail[] = [
          rune(ct.A.ids[ia3]), rune(ct.A.ids[ia3 + 1]), rune(ct.A.ids[ia3 + 2]),
          rune(ct.B.ids[ib3]), rune(ct.B.ids[ib3 + 1]), rune(ct.B.ids[ib3 + 2]),
        ];
        // Au-delà de `maxCollected` candidats dans CE morceau, la fusion
        // globale a forcément déjà coupé : inutile d'aller plus loin.
        if (collecteur.valider(runes, g)) {
          visitesAuCandidat.push(visitees);
          if (collecteur.candidates.length >= maxCollected) {
            issue = 'plafond';
            break boucle;
          }
        }
      }
      const fin = debutLigne + nB;
      if (fin >= limite) {
        pos = limite;
        issue = 'limite';
        break boucle;
      }
      if (passage(fin)) {
        issue = 'temps';
        break boucle;
      }
      pos = fin;
      if (yield) {
        issue = 'arret';
        break boucle;
      }
    }
  }
  return {
    type: 'resultat', id: morceau.id,
    traitees: (issue === 'complet' ? morceau.offset + morceau.taille : pos) - morceau.offset,
    visitees, candidats: collecteur.candidates, positions: collecteur.positions, visitesAuCandidat,
    ameliorations: collecteur.ameliorations ?? [], issue, compteurs,
  };
}
