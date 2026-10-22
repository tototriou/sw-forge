// Noyau de l'appariement sur tableaux typés : le chemin de production
// (`apparier` dans src/lib/rechercheRunes.ts en séquentiel,
// `appariementRapideParallele.ts` en parallèle). `pairBuckets`
// (runeBuildOptim.ts) reste la RÉFÉRENCE et le chemin du traceur de diagnostic.
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
// les colonnes se parcourent sans saut (`apparierSansSauts`).
//
// Les bornes écrites, leurs préconditions et l'ordre de visite :
// docs/03-developpeur/optimizer/moteur/noyau-appariement.md.
//
// ⚠️ **Ce qui suit `quickOk`** : `Collecteur.valider` est une copie conforme
// de `pairBuckets` (runeBuildOptim.ts, de `const runes` à `candidates.push`),
// avec les deux fonctions privées dont il dépend (`totalCondition`,
// `valueOf`) — c'est le chemin de RÉFÉRENCE. S'y ajoute
// `Collecteur.validerTypee` : la même validation sur tableaux typés
// (validationRapide.ts), prise dès que son contrat numérique tient, avec le
// même quasi-succès (mêmes tentatives, mêmes remplacements) et des `StatRow`
// construits seulement quand ils sont gardés. Une divergence se voit au
// différentiel du banc et au test `validation-rapide`.

import { GearSet, RuneDetail } from '../types';
import { StatKey, activeSets, runeEfficiency, runeScore } from './effects';
import { computeStats, StatRow } from './stats';
import { missingSets } from './recoMatch';
import { AurasPropres, aurasPropresDesSetsActifs, pointsAuraResPrePropres } from './damage';
import { OptimMetric } from './runeOptim';
import { ValidationTypee } from './validationRapide';
import { SortieCandidats, ColonnesCandidats, LIGNES_PAR_BLOC, ajouterObjetCandidat, extraireBlocs } from './candidatsCompacts';
import { Compartiment, VueCombo, idCombo, lireCombo, nouvelleVueCombo, objetsDesCompartiments } from './demiBuildsTypes';
import {
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
  fichesDuTestConjoint,
  satisfiesSets,
} from './runeBuildOptim';

/** Taille d'un bloc de comboB consécutifs (ordre d'origine) pour le saut par bloc. */
export const TAILLE_BLOC = 64;
/** La dichotomie est prise quand la stat la plus sélective laisse au plus `n / FACTEUR_DICHOTOMIE` comboB. */
export const FACTEUR_DICHOTOMIE = 4;

// Bornes du contrat numérique : valeurs entières, produits
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
export function* ordreDesCompartiments(bucketsA: Compartiment[], bucketsB: Compartiment[]): Generator<readonly [number, number], void, void> {
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
export function paireDeCompartimentsOuverte(prepared: PreparedSearch, bA: Compartiment, bB: Compartiment): boolean {
  const { distinctKeys, requirement, minEntries, guaranteedMin, relPctMax, artFlatMax, totalOf } = prepared;
  if (!satisfiesSets(bA.counts, bA.jokers, bB.counts, bB.jokers, distinctKeys, requirement)) return false;
  if (bA.jokers + bB.jokers > 1) return false;
  return bucketPairFeasibleMin(bA, bB, minEntries, guaranteedMin, relPctMax, artFlatMax, totalOf);
}

/** `comboAFeasible` de production, avec les arguments de `pairBuckets`. */
export function comboAOuvert(prepared: PreparedSearch, comboA: Pick<VueCombo, 'pct' | 'flat'>, bB: Compartiment): boolean {
  const { minEntries, maxEntries, guaranteed, guaranteedMin, relPctMax, artFlatMax, totalOf, artFlatMin, relPctMin } = prepared;
  return comboAFeasible(comboA, bB, minEntries, maxEntries, guaranteed, guaranteedMin, relPctMax, artFlatMax, totalOf, artFlatMin, relPctMin);
}

/** Le compte exact de production, avec les mêmes prédicats que totalPairCount. */
export function compterPaires(prepared: PreparedSearch, bucketsA: Compartiment[], bucketsB: Compartiment[]): number {
  let total = 0;
  const vue = nouvelleVueCombo();
  for (const a of bucketsA) for (const b of bucketsB) {
    if (!paireDeCompartimentsOuverte(prepared, a, b)) continue;
    for (let i = 0; i < a.combos.length; i++) if (comboAOuvert(prepared, lireCombo(a, i, vue), b)) total += b.combos.length;
  }
  return total;
}

/* --------------------------------------------------------------------------
 * Disposition en tableaux typés
 * ----------------------------------------------------------------------- */

export interface MoitieTypee {
  /** `debut[i]` : indice global du premier demi-build du compartiment `i` ; longueur = compartiments + 1. */
  debut: Int32Array;
  /** Les trois runes de chaque demi-build (Float64 : les identifiants du jeu dépassent l'Int32). */
  ids: Float64Array;
  /** Seules les contraintes PV/ATQ/DEF ont une colonne de pourcentages. */
  pasPct: number;
  indicesPct: Int8Array;
  pct: Int32Array;
  /** `flat[c·m + k]` : `combo.flat[cle] ?? 0`. */
  flat: Int32Array;
}

function pctDe(moitie: MoitieTypee, g: number, k: number): number {
  const i = moitie.indicesPct[k];
  return i < 0 ? 0 : moitie.pct[g * moitie.pasPct + i];
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
  return [A.debut, A.ids, A.indicesPct, A.pct, A.flat, B.debut, B.ids, B.indicesPct, B.pct, B.flat, B.W, B.tri, B.perm, B.debutBlocs, B.blocMin, B.blocMax].map(
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
    A: { debut: c(A.debut), ids: A.ids.slice(), pasPct: A.pasPct, indicesPct: A.indicesPct.slice(), pct: c(A.pct), flat: c(A.flat) },
    B: {
      debut: c(B.debut), ids: B.ids.slice(), pasPct: B.pasPct, indicesPct: B.indicesPct.slice(), pct: c(B.pct), flat: c(B.flat), W: c(B.W), tri: c(B.tri), perm: c(B.perm),
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
 * Le contrat numérique (valeurs entières, produits exacts), vérifié AVANT toute paire. Rend `null`
 * s'il tient, sinon le motif du repli sur le chemin actuel.
 */
export function verifierContrat(prepared: PreparedSearch, bucketsA: Compartiment[], bucketsB: Compartiment[]): string | null {
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
    const vue = nouvelleVueCombo();
    for (const bucket of buckets) {
      for (let i = 0; i < bucket.combos.length; i++) {
        const combo = lireCombo(bucket, i, vue);
        for (let r = 0; r < 3; r++) {
          const id = idCombo(bucket, i, r);
          if (!Number.isSafeInteger(id)) return `identifiant de rune non entier (${id})`;
        }
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

function encoderMoitie(buckets: Compartiment[], cles: StatKey[]): MoitieTypee {
  const m = cles.length;
  const debut = new Int32Array(buckets.length + 1);
  for (let i = 0; i < buckets.length; i++) debut[i + 1] = debut[i] + buckets[i].combos.length;
  const n = debut[buckets.length];
  const ids = new Float64Array(3 * n);
  let pasPct = 0;
  const indicesPct = Int8Array.from(cles, (k) => estPct(k) ? pasPct++ : -1);
  const pct = new Int32Array(pasPct * n);
  const flat = new Int32Array(m * n);
  let c = 0;
  const vue = nouvelleVueCombo();
  for (const bucket of buckets) {
    for (let i = 0; i < bucket.combos.length; i++) {
      const combo = lireCombo(bucket, i, vue);
      ids[3 * c] = idCombo(bucket, i, 0);
      ids[3 * c + 1] = idCombo(bucket, i, 1);
      ids[3 * c + 2] = idCombo(bucket, i, 2);
      for (let kk = 0; kk < m; kk++) {
        if (indicesPct[kk] >= 0) pct[c * pasPct + indicesPct[kk]] = combo.pct[cles[kk]] ?? 0;
        flat[c * m + kk] = combo.flat[cles[kk]] ?? 0;
      }
      c++;
    }
  }
  return { debut, ids, pasPct, indicesPct, pct, flat };
}

/**
 * ⚠️ Suppose `verifierContrat` passé : toutes les valeurs écrites dans les
 * Int32Array y sont exactes.
 */
export function encoderCompartiments(prepared: PreparedSearch, bucketsA: Compartiment[], bucketsB: Compartiment[]): CompartimentsTypes {
  const c = constantesNoyau(prepared);
  const { cles, m } = c;
  const A = encoderMoitie(bucketsA, cles);
  const base = encoderMoitie(bucketsB, cles);
  const nB = base.debut[bucketsB.length];
  const W = new Int32Array(m * nB);
  for (let g = 0; g < nB; g++) {
    for (let kk = 0; kk < m; kk++) {
      W[g * m + kk] = c.pct[kk] ? c.b[kk] * pctDe(base, g, kk) + 100 * base.flat[g * m + kk] : base.flat[g * m + kk];
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
    const pA = pctDe(A, ga, kk);
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
    const p = pctDe(A, ga, e.kk) + pctDe(B, gb, e.kk) + e.gmP + e.rp;
    const f = A.flat[ga * m + e.kk] + B.flat[gb * m + e.kk] + e.gmF + e.af;
    if (c.totalOf(e.k, p, f) < e.min) return false;
  }
  for (const e of c.maxEntrees) {
    const p = pctDe(A, ga, e.kk) + pctDe(B, gb, e.kk) + e.gP + e.rp;
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

export class Collecteur<C extends SortieCandidats = BuildCandidate[]> {
  readonly positions: number[] = [];
  readonly nearMissByCondition = new Map<string, EntreeQuasiSucces>();
  globalNearMiss: NearMiss | null = null;
  private globalNearMissDistance = Infinity;
  private instantane: EntreeQuasiSucces[] | null = [];
  readonly ameliorations: Amelioration[] | null;
  private pos = 0;

  /**
   * Chemin typé (`validerTypee`) : le miroir numérique de
   * `nearMissByCondition` (existe, plus petit manque), par condition — la
   * Map reste la vérité, le miroir évite de la lire à chaque tentative.
   */
  private readonly slotDe: Int32Array;
  private readonly existe: Uint8Array;
  private readonly meilleur: Float64Array;
  /** Ce que la paire courante a déjà matérialisé (ids, lignes, effTotal), partagé entre ses apports. */
  private materielCourant: { runeIds: number[]; stats: StatRow[]; effTotal: number } | null = null;

  constructor(
    private readonly prepared: PreparedSearch,
    enregistrerAmeliorations: boolean,
    private readonly avecPositions: boolean,
    private readonly validation: ValidationTypee | null = null,
    readonly candidates: C = [] as unknown as C
  ) {
    this.ameliorations = enregistrerAmeliorations ? [] : null;
    const conditions = validation?.conditions ?? [];
    this.slotDe = new Int32Array(conditions.length);
    conditions.forEach((c, e) => {
      this.slotDe[e] = conditions.findIndex((d) => d.cle === c.cle);
    });
    this.existe = new Uint8Array(conditions.length);
    this.meilleur = new Float64Array(conditions.length);
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
    const { base, artifacts, relic, requirement, metric, minEntries, maxEntries, artPossibles, artFlatFige, relicRelache } = this.prepared;
    const active = activeSets(runes.map((r) => r.set));
    if (missingSets(requirement.sets, active).length > 0) return false;
    const gear: GearSet = { base, runes, artifacts, relic: relicRelache ? undefined : relic };
    const stats = computeStats(gear);
    const apports = artPossibles.length > 0 ? artPossibles : [artFlatFige];
    const fiches = fichesDuTestConjoint(gear, stats, this.prepared);
    const propres = aurasPropresDesSetsActifs(active);
    const runeIds = runes.map((r) => r.id);
    const effTotal = runes.reduce((sum, r) => sum + valueOf(r, metric), 0);
    let ok = false;
    tentatives: for (const apport of apports) {
      const decalage = (k: StatKey) => (apport[k] ?? 0) - (artFlatFige[k] ?? 0);
      for (const fiche of fiches) {
        const shortfalls: StatShortfall[] = [];
        for (const { k, min } of minEntries) {
          const row = fiche.find((r) => r.key === k);
          const actual = totalCondition((row?.total ?? 0) + decalage(k), k, requirement, propres);
          if (actual < min) shortfalls.push({ key: k, kind: 'min', requested: min, actual, shortfall: min - actual });
        }
        for (const { k, max } of maxEntries) {
          const row = fiche.find((r) => r.key === k);
          const actual = totalCondition((row?.total ?? 0) + decalage(k), k, requirement, propres);
          if (actual > max) shortfalls.push({ key: k, kind: 'max', requested: max, actual, shortfall: actual - max });
        }
        if (shortfalls.length === 0) {
          ok = true;
          break tentatives;
        }
        this.considerNearMiss(runeIds, stats, effTotal, shortfalls);
      }
    }
    if (!ok) return false;
    ajouterObjetCandidat(this.candidates, { runeIds, stats, effTotal });
    if (this.avecPositions) this.positions.push(pos);
    return true;
  }

  /**
   * `valider` sur tableaux typés, pour la paire des demi-builds d'indices
   * globaux `ga`/`gb` (ordre de `encoderCompartiments`). Même verdict, mêmes
   * tentatives de quasi-succès dans le même ordre, mêmes objets gardés ; rien
   * n'est alloué tant qu'une paire n'est ni collectée ni retenue au
   * quasi-succès. ⚠️ Suppose `validation` construite et son contrat tenu.
   */
  validerTypee(ga: number, gb: number, pos: number): boolean {
    const v = this.validation!;
    this.pos = pos;
    if (!v.setsEtStats(ga, gb)) return false;
    this.materielCourant = null;
    let ok = false;
    tentatives: for (let a = 0; a < v.nApports; a++) {
      for (let f = 0; f < v.nFiches; f++) {
        const n = v.ecarts(a, f);
        if (n === 0) {
          ok = true;
          break tentatives;
        }
        this.considererTypee(v, n);
      }
    }
    if (!ok) return false;
    if (Array.isArray(this.candidates)) {
      const { runeIds, stats, effTotal } = this.materiel(v);
      this.candidates.push({ runeIds, stats, effTotal });
    } else v.ecrireCandidat(this.candidates);
    if (this.avecPositions) this.positions.push(pos);
    return true;
  }

  private materiel(v: ValidationTypee): { runeIds: number[]; stats: StatRow[]; effTotal: number } {
    return (this.materielCourant ??= { runeIds: v.runeIds(), stats: v.lignes(), effTotal: v.effTotal() });
  }

  // `considerNearMiss` sur les échecs du dernier `v.ecarts` : mêmes deux
  // tests, sur les mêmes nombres ; les objets ne se construisent que si l'un
  // des deux remplace l'état.
  private considererTypee(v: ValidationTypee, n: number): void {
    let slot = -1;
    let parCondition = false;
    if (n === 1) {
      slot = this.slotDe[v.echecs[0]];
      parCondition = !this.existe[slot] || v.manques[0] < this.meilleur[slot];
    }
    // `Math.max(...shortfalls.map(…))`, replié de gauche à droite (même valeur, NaN compris).
    let distance = -Infinity;
    for (let i = 0; i < n; i++) {
      distance = Math.max(distance, v.manques[i] / v.conditions[v.echecs[i]].seuil);
      // Le maximum ne redescend pas ; un NaN ultérieur ne rendrait pas
      // non plus le test strict vrai. Garder le premier vu à égalité.
      if (!parCondition && distance >= this.globalNearMissDistance) return;
    }
    const global = distance < this.globalNearMissDistance;
    if (!parCondition && !global) return;
    const { runeIds, stats, effTotal } = this.materiel(v);
    const shortfalls = v.manquesDe(n);
    if (parCondition) {
      const s = shortfalls[0];
      const mapKey = `${s.key}-${s.kind}`;
      const entree: EntreeQuasiSucces = { key: s.key, kind: s.kind, miss: { runeIds, stats, effTotal, shortfalls } };
      this.nearMissByCondition.set(mapKey, entree);
      this.existe[slot] = 1;
      this.meilleur[slot] = s.shortfall;
      this.instantane = null;
      this.ameliorations?.push({ pos: this.pos, type: 'condition', cle: mapKey, entree });
    }
    if (global) {
      this.globalNearMissDistance = distance;
      this.globalNearMiss = { runeIds, stats, effTotal, shortfalls };
      this.ameliorations?.push({ pos: this.pos, type: 'global', distance, miss: this.globalNearMiss });
    }
  }
}

/**
 * La validation typée d'un espace, ou `null` pour le chemin de référence
 * (contrat non tenu, ou référence imposée par un test). `runesA[3·g + r]` :
 * les runes des demi-builds dans l'ordre de `encoderCompartiments`.
 */
export function validationDe(
  prepared: PreparedSearch,
  runesA: readonly RuneDetail[],
  runesB: readonly RuneDetail[],
  forcer?: 'reference'
): { validation: ValidationTypee | null; motif: string | null } {
  if (forcer === 'reference') return { validation: null, motif: 'chemin de référence imposé' };
  const v = new ValidationTypee(prepared, runesA, runesB);
  return v.motif ? { validation: null, motif: v.motif } : { validation: v, motif: null };
}

/** Les runes des demi-builds, à plat, dans l'ordre de `encoderCompartiments`. */
export function runesAPlat(buckets: Compartiment[], pools: readonly RuneDetail[][] = []): RuneDetail[] {
  const out: RuneDetail[] = [];
  const parId = new Map(pools.flat().map((r) => [r.id, r]));
  for (const b of buckets) {
    if (Array.isArray(b.combos)) {
      for (const c of b.combos) out.push(c.runes[0], c.runes[1], c.runes[2]);
    } else for (const id of b.combos.ids) {
      const r = parId.get(id);
      if (!r) throw new Error(`rune ${id} absente du pool préparé`);
      out.push(r);
    }
  }
  return out;
}

/* --------------------------------------------------------------------------
 * L'appariement séquentiel
 * ----------------------------------------------------------------------- */

export interface ResultatAppariementRapide<C = BuildCandidate[]> extends SearchResult<C> {
  /** Paires traitées (= `explored`) : visitées + sautées. */
  traitees: number;
  /** Paires jugées par la garde de référence. */
  visitees: number;
  /** Paires écartées par une borne du noyau, sans jugement individuel. */
  sautees: number;
  chemin: 'noyau' | 'actuel';
  /** Pourquoi le chemin actuel a été pris. */
  motifChemin?: string;
  /** Validation des paires qui passent `quickOk` : typée ou copie de `pairBuckets`. */
  cheminValidation: 'typee' | 'reference';
  motifValidation?: string;
  compteurs: CompteursNoyau;
}

export interface OptionsAppariementRapide<C extends SortieCandidats = BuildCandidate[]> {
  collecte?: C;
  /** Tests seulement : impose le chemin de chaque ligne non sautée. */
  forcerChemin?: 'dichotomie' | 'lineaire';
  /** Tests seulement : impose la validation de référence (copie de `pairBuckets`). */
  forcerValidation?: 'reference';
  /** Tests et banc : appelé pour chaque paire qui passe `quickOk`, avant sa validation (contrôle paire par paire). */
  controleValidation?: { paire(ga: number, gb: number, runes: RuneDetail[]): void };
  /** Tests seulement : appelé pour chaque paire VISITÉE (indices de compartiment et locaux). */
  observateur?: { visite(iA: number, a: number, iB: number, b: number): void };
}

/** Hors contrat entier : mêmes expressions et points de passage que pairBuckets, sans saut ni HalfCombo. */
function* apparierSansSauts<C extends SortieCandidats>(prepared: PreparedSearch, A: Compartiment[], B: Compartiment[], collecte: C): Generator<PairingProgress<C>, SearchResult<C>, void> {
  const collecteur = new Collecteur(prepared, false, false, null, collecte);
  const a = nouvelleVueCombo();
  const b = nouvelleVueCombo();
  const runesA = runesAPlat(A, prepared.filtered);
  const runesB = runesAPlat(B, prepared.filtered);
  const debuts = (buckets: Compartiment[]) => {
    const d = [0];
    for (const x of buckets) d.push(d[d.length - 1] + x.combos.length);
    return d;
  };
  const da = debuts(A);
  const db = debuts(B);
  const c = constantesNoyau(prepared);
  let explored = 0;
  let truncated = false;
  outer: for (const [iA, iB] of ordreDesCompartiments(A, B)) {
    if (!paireDeCompartimentsOuverte(prepared, A[iA], B[iB])) continue;
    for (let ia = 0; ia < A[iA].combos.length; ia++) {
      const ca = lireCombo(A[iA], ia, a);
      if (!comboAOuvert(prepared, ca, B[iB])) continue;
      for (let ib = 0; ib < B[iB].combos.length; ib++) {
        explored++;
        if (explored % CHECKPOINT_EVERY === 0) yield { phase: 'pairing', candidates: collecteur.candidates, explored, nearMissByCondition: collecteur.snapshot(), globalNearMiss: collecteur.globalNearMiss };
        if (Date.now() - prepared.startedAt > prepared.maxMs) { truncated = true; break outer; }
        const cb = lireCombo(B[iB], ib, b);
        let passe = true;
        for (const e of c.minEntrees) {
          const p = (ca.pct[e.k] ?? 0) + (cb.pct[e.k] ?? 0) + e.gmP + e.rp;
          const f = (ca.flat[e.k] ?? 0) + (cb.flat[e.k] ?? 0) + e.gmF + e.af;
          if (c.totalOf(e.k, p, f) < e.min) { passe = false; break; }
        }
        if (!passe) continue;
        for (const e of c.maxEntrees) {
          const p = (ca.pct[e.k] ?? 0) + (cb.pct[e.k] ?? 0) + e.gP + e.rp;
          const f = (ca.flat[e.k] ?? 0) + (cb.flat[e.k] ?? 0) + e.gF + e.af;
          if (c.totalOf(e.k, p, f) > e.max) { passe = false; break; }
        }
        if (!passe) continue;
        const ga = da[iA] + ia;
        const gb = db[iB] + ib;
        if (collecteur.valider([runesA[3 * ga], runesA[3 * ga + 1], runesA[3 * ga + 2], runesB[3 * gb], runesB[3 * gb + 1], runesB[3 * gb + 2]], explored)
          && collecteur.candidates.length >= prepared.maxCollected) { truncated = true; break outer; }
      }
    }
  }
  return { candidates: collecteur.candidates, explored, truncated, nearMissByCondition: collecteur.snapshot(), globalNearMiss: collecteur.globalNearMiss };
}

/**
 * Le pendant de `pairBuckets(prepared, bucketsA, bucketsB)` : même résultat,
 * mêmes points de passage (toutes les `CHECKPOINT_EVERY` paires TRAITÉES,
 * `explored` = `traitees`), le noyau en plus. Contrat non tenu → parcours
 * sans saut ; traceur → `pairBuckets` lui-même (`chemin: 'actuel'`).
 */
export function* apparierRapide<C extends SortieCandidats = BuildCandidate[]>(
  prepared: PreparedSearch,
  bucketsA: Compartiment[],
  bucketsB: Compartiment[],
  options: OptionsAppariementRapide<C> = {}
): Generator<PairingProgress<C>, ResultatAppariementRapide<C>, void> {
  const collecte = options.collecte ?? [] as unknown as C;
  const motif = verifierContrat(prepared, bucketsA, bucketsB);
  if (motif) {
    // Le traceur reste une API objet explicite ; il ne vient pas de l'écran.
    let r: SearchResult<C>;
    if (prepared.traceur) {
      const gen = pairBuckets(prepared, objetsDesCompartiments(bucketsA, prepared.filtered), objetsDesCompartiments(bucketsB, prepared.filtered));
      let n = 0, step = gen.next();
      while (!step.done) {
        for (; n < step.value.candidates.length; n++) ajouterObjetCandidat(collecte, step.value.candidates[n]);
        yield { ...step.value, candidates: collecte };
        step = gen.next();
      }
      for (; n < step.value.candidates.length; n++) ajouterObjetCandidat(collecte, step.value.candidates[n]);
      r = { ...step.value, candidates: collecte };
    } else r = yield* apparierSansSauts(prepared, bucketsA, bucketsB, collecte);
    return {
      ...r, traitees: r.explored, visitees: r.explored, sautees: 0, chemin: 'actuel', motifChemin: motif,
      cheminValidation: 'reference', motifValidation: 'chemin actuel (pairBuckets)', compteurs: compteursVides(),
    };
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
  const runesA = runesAPlat(bucketsA, prepared.filtered);
  const runesB = runesAPlat(bucketsB, prepared.filtered);
  const { validation, motif: motifValidation } = validationDe(prepared, runesA, runesB, options.forcerValidation);
  const runesDePaire = (ga: number, gb: number) => [runesA[3 * ga], runesA[3 * ga + 1], runesA[3 * ga + 2], runesB[3 * gb], runesB[3 * gb + 1], runesB[3 * gb + 2]];
  const collecteur = new Collecteur(prepared, false, false, validation, collecte);
  const candidates = collecteur.candidates;
  const progression = (traitees: number): PairingProgress<C> => ({
    phase: 'pairing', candidates, explored: traitees, nearMissByCondition: collecteur.snapshot(), globalNearMiss: collecteur.globalNearMiss,
  });

  let traitees = 0;
  let visitees = 0;
  // Le compteur logique inclut les sauts : au plus 499 paires entre
  // l'expiration du filet et le prochain contrôle, même sans survivant.
  let prochainPoint = CHECKPOINT_EVERY;
  let truncated = false;
  const vueA = nouvelleVueCombo();

  outer: for (const [iA, iB] of ordreDesCompartiments(bucketsA, bucketsB)) {
    const bA = bucketsA[iA];
    const bB = bucketsB[iB];
    if (!paireDeCompartimentsOuverte(prepared, bA, bB)) continue;
    const nB = bB.combos.length;
    const offB = ct.B.debut[iB];
    for (let a = 0; a < bA.combos.length; a++) {
      const comboA = lireCombo(bA, a, vueA);
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
        options.observateur?.visite(iA, a, iB, j);
        if (!quickOkReference(c, ct, ga, offB + j)) {
          compteurs.gardeRejets++;
          continue;
        }
        options.controleValidation?.paire(ga, offB + j, runesDePaire(ga, offB + j));
        const collecte = validation
          ? collecteur.validerTypee(ga, offB + j, g)
          : collecteur.valider(runesDePaire(ga, offB + j), g);
        if (!collecte) continue;
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
    traitees, visitees, sautees: traitees - visitees, chemin: 'noyau',
    cheminValidation: validation ? 'typee' : 'reference', ...(motifValidation ? { motifValidation } : {}), compteurs,
  };
}

/* --------------------------------------------------------------------------
 * Corps d'un Worker : un MORCEAU de lignes consécutives
 * ----------------------------------------------------------------------- */

/** Ce que reçoit un Worker, une fois. ⚠️ Neutre : ni `worker_threads`, ni `self`. */
export interface InitTravailleur {
  collecteCompacte?: boolean;
  params: SearchParams;
  /** L'instant de départ GLOBAL du lancement (construction comprise), que le Worker pose sur sa préparation. */
  startedAt: number;
  compartiments: CompartimentsTypes;
  /** Tests seulement : la validation de référence (copie de `pairBuckets`). */
  forcerValidation?: 'reference';
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
export type IssueMorceau = 'complet' | 'temps' | 'plafond' | 'limite' | 'arret' | 'suite';

export interface ResultatMorceau<C = BuildCandidate[]> {
  type: 'resultat';
  id: number;
  /** Paires traitées dans le morceau (`taille` s'il est achevé). */
  traitees: number;
  visitees: number;
  candidats: C;
  positions: number[] | Float64Array;
  /** Pour chaque candidat, les paires visitées du morceau jusqu'à lui compris : la fusion coupe les comptes au même endroit que les candidats. */
  visitesAuCandidat: number[] | Float64Array;
  ameliorations: Amelioration[];
  issue: IssueMorceau;
  /** Le Worker a validé sur tableaux typés (sinon : copie de `pairBuckets`). */
  validationTypee: boolean;
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
  validation: ValidationTypee | null;
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
  // Les tables de la validation typée se reconstruisent ici, depuis les
  // identifiants transférés : aucun tableau de plus à copier vers chaque Worker.
  const runesDe = (ids: Float64Array) => Array.from(ids, (id) => {
    const r = runeParId.get(id);
    if (!r) throw new Error(`rune ${id} absente du pool préparé du Worker`);
    return r;
  });
  const { validation } = validationDe(prepared, runesDe(ct.A.ids), runesDe(ct.B.ids), init.forcerValidation);
  return { prepared, ct, c, runeParId, L: new Float64Array(c.m), H: new Float64Array(c.m), sortie: new Int32Array(maxB), validation };
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
 * Le filet de temps se teste à chaque entrée de ligne et à chaque point de
 * passage (`CHECKPOINT_EVERY` paires TRAITÉES, sautées comprises) : comme
 * dans `apparierRapide`, un saut de lignes entières ne le contourne pas.
 * Les points de passage franchis par un saut le sont au même instant ; un
 * seul test les couvre, et la troncature tombe sur le premier d'entre eux.
 */
export function* parcourirMorceau<C extends SortieCandidats = BuildCandidate[]>(ctx: ContexteTravailleur, morceau: Morceau, collecte: C = [] as unknown as C): Generator<ResultatMorceau<C> | void, ResultatMorceau<C>, boolean | undefined> {
  const { prepared, ct, c, runeParId, L, H, sortie, validation } = ctx;
  const { maxCollected, maxMs, startedAt } = prepared;
  const overBudget = () => Date.now() - startedAt > maxMs;
  const compteurs = compteursVides();
  const collecteur = new Collecteur(prepared, true, true, validation, collecte);
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
  const compact = !Array.isArray(collecte);
  const resultat = (issue: IssueMorceau): ResultatMorceau<C> => {
    const candidats = compact
      ? { length: collecteur.positions.length, blocs: extraireBlocs(collecte as ColonnesCandidats) } as C
      : collecte;
    const r: ResultatMorceau<C> = {
      type: 'resultat', id: morceau.id,
      traitees: (issue === 'complet' ? morceau.offset + morceau.taille : pos) - morceau.offset,
      visitees, candidats,
      positions: compact ? Float64Array.from(collecteur.positions) : collecteur.positions,
      visitesAuCandidat: compact ? Float64Array.from(visitesAuCandidat) : visitesAuCandidat,
      ameliorations: compact ? collecteur.ameliorations!.splice(0) : collecteur.ameliorations ?? [],
      issue, validationTypee: validation != null, compteurs: { ...compteurs },
    };
    if (compact) { collecteur.positions.length = 0; visitesAuCandidat.length = 0; }
    return r;
  };
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
        const gb = offB + j;
        if (!quickOkReference(c, ct, ga, gb)) {
          compteurs.gardeRejets++;
          continue;
        }
        let collecte: boolean;
        if (validation) {
          collecte = collecteur.validerTypee(ga, gb, g);
        } else {
          const ia3 = 3 * ga;
          const ib3 = 3 * gb;
          const runes: RuneDetail[] = [
            rune(ct.A.ids[ia3]), rune(ct.A.ids[ia3 + 1]), rune(ct.A.ids[ia3 + 2]),
            rune(ct.B.ids[ib3]), rune(ct.B.ids[ib3 + 1]), rune(ct.B.ids[ib3 + 2]),
          ];
          collecte = collecteur.valider(runes, g);
        }
        // Au-delà de `maxCollected` candidats dans CE morceau, la fusion
        // globale a forcément déjà coupé : inutile d'aller plus loin.
        if (collecte) {
          visitesAuCandidat.push(visitees);
          if (collecteur.candidates.length >= maxCollected) {
            issue = 'plafond';
            break boucle;
          }
          // Pause de transport seulement : l'arrêt manuel se lit toujours à la fin de ligne.
          if (compact && collecteur.positions.length === LIGNES_PAR_BLOC) yield resultat('suite');
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
  return resultat(issue);
}
