// Construction des moitiés sur tableaux typés : le chemin de production
// (`construireMoitie`, src/lib/rechercheRunes.ts, appelé par les Workers de
// moitié, le CLI, le harnais et `searchBuilds`). `buildBuckets` reste la
// RÉFÉRENCE et le repli (`motifRepliConstruction` : traceur de diagnostic,
// moitié de plus de 2³¹ triplets, `bucketCap` ou capacité redistribuée hors
// des entiers 32 bits des tas). Contrat : rendre EXACTEMENT les compartiments de
// `buildBuckets` (mêmes clés, comptes, jokers, `combos` dans le même ordre avec
// leurs `pct`/`flat`/`relevanceScore`, mêmes `maxPct`/`maxFlat` jusqu'à l'ordre
// de leurs clés, même `potential`), vérifié par `premiereDivergence`
// (tests/construction-rapide.test.ts). Voir
// docs/03-developpeur/optimizer/moteur/pipeline.md § Construction des moitiés.
//
// Le découpage parallèle ci-dessous (`construireTranche`, `fusionnerTranches`)
// n'est pas branché en production : seul le banc
// (scripts/banc-construction-moities.ts) l'exerce.
//
// Ce qui change, et pourquoi le résultat ne bouge pas :
// - Aucune allocation par combinaison. `buildBuckets` crée, pour CHAQUE triplet
//   (r0, r1, r2), deux `Record` de stats, l'objet `HalfCombo`, ses tableaux
//   `runes`/`counts`, une clé de compartiment en chaîne et une entrée de tas par
//   tranche (profil sur Eivor, moitié A : 22 % de ramasse-miettes, ~17 % dans
//   l'écriture des `Record`). Ici les sommes vont dans un tampon `Float64Array`,
//   le compartiment est un entier, et une entrée de tas est un couple (score,
//   code du triplet) dans deux tableaux typés. Les `HalfCombo` ne sont
//   construits qu'à la fin, pour les seuls triplets encore présents dans un tas.
// - Les sommes et les scores reprennent les MÊMES expressions dans le même
//   ordre (`p0 + p1 + p2`, `Math.ceil((b * pct) / 100) + flat`, la somme de la
//   tranche combinée minimum par minimum) : mêmes nombres au bit près. Le tas
//   reprend `heapPush` comparaison par comparaison, échange par échange : même
//   disposition finale, donc même ordre de déduplication et mêmes ex æquo.
// - Le code d'un triplet, `(idx0 × n1 + idx1) × n2 + idx2`, croît dans l'ordre
//   même où `buildBuckets` énumère : il sert de rang global (ordre de création
//   des compartiments, ordre d'apparition des clés de `maxPct`/`maxFlat`).
//
// Découpage parallèle par rune du premier emplacement, sans mémoire partagée
// (`construireTranche` puis `fusionnerTranches`) :
// - chaque tranche reçoit une liste CROISSANTE d'indices `idx0` (n'importe
//   quelle partition), parcourt ses triplets avec ses propres tas — mêmes
//   plafonds par tranche de rétention — et émet le code de chaque triplet qu'un
//   de ses tas a ACCEPTÉ (poussé, ou entré en évinçant la racine), plus, par
//   compartiment, ses bornes `maxPct`/`maxFlat` et le code de leur première
//   valeur non nulle ;
// - la fusion rejoue les triplets émis dans l'ordre global des codes dans des
//   tas neufs. Exact parce qu'un triplet REFUSÉ par le tas local d'une tranche
//   est un no-op pour le tas global : un tas borné à `cap` garde toujours le
//   multiensemble des `cap` plus grands scores vus (une entrée ne remplace la
//   racine, le minimum, que si elle lui est strictement supérieure), donc la
//   racine du tas global, qui a vu un sur-ensemble des entrées de la tranche,
//   est au moins la racine locale ; refusé localement (`score ≤ racine
//   locale`, tas plein) ⇒ refusé globalement, sans rien changer à la
//   disposition. Précondition : aucun score `NaN` (vérifiée à la fusion).
//   Les bornes `maxPct`/`maxFlat` portent sur TOUTE combinaison rencontrée
//   (invariant) : chaque tranche les calcule sur toutes les siennes, la fusion
//   prend le maximum.

import { RuneDetail } from '../types';
import { StatKey, runeEfficiency } from './effects';
import {
  Bucket,
  BuildBucketsContext,
  BuildingProgress,
  HalfCombo,
  runeContribution,
  trancheReallocation,
  weightedContribution,
} from './runeBuildOptim';

export type OrdreCombos = 'potential' | 'relevance' | 'combined' | 'objective';

/** Le sous-ensemble sérialisable de `BuildBucketsContext` que lit la construction. */
export type ContexteConstruction = Omit<BuildBucketsContext, 'traceur'>;

/** Ce qu'une tranche reçoit : sérialisable tel quel par `postMessage`/`workerData`. */
export interface EntreeTranche {
  ctx: ContexteConstruction;
  slotIdxs: readonly [number, number, number];
  otherHalfMaxSets: number[];
  adaptiveTrancheWeighting: boolean;
  /** Indices de runes du premier emplacement de la moitié, CROISSANTS. */
  idx0s: number[];
}

/** Ce qu'une tranche rend : des tableaux typés, transférables sans copie. */
export interface ResultatTranche {
  /** Les indices parcourus, rendus tels quels : la fusion vérifie que les tranches couvrent le premier emplacement une fois. */
  idx0s: number[];
  /** Codes des triplets acceptés par au moins un tas de la tranche, croissants. */
  codes: Int32Array;
  /** Par compartiment rencontré : code entier, code de son premier triplet, puis bornes et premières apparitions (une case par stat contrainte). */
  compartiments: {
    code: number;
    premier: number;
    maxPct: Float64Array;
    maxFlat: Float64Array;
    /** Code du premier triplet dont la contribution dépasse 0 (`Infinity` : jamais). */
    premierPct: Float64Array;
    premierFlat: Float64Array;
  }[];
}

/* --------------------------------------------------------------------------
 * Tas binaire min sur tableaux typés — copie conforme de `heapPush`
 * ----------------------------------------------------------------------- */

interface Tas {
  cap: number;
  len: number;
  scores: Float64Array;
  items: Int32Array;
}

function nouveauTas(cap: number): Tas {
  const init = Math.max(1, Math.min(cap, 64));
  return { cap, len: 0, scores: new Float64Array(init), items: new Int32Array(init) };
}

/** Vrai si l'entrée est entrée dans le tas (même décision que `heapPush`). */
function pousser(h: Tas, score: number, item: number): boolean {
  const s = h.scores;
  if (h.len < h.cap) {
    if (h.len === s.length) {
      const n = Math.min(h.cap, s.length * 2);
      const ns = new Float64Array(n);
      ns.set(s);
      const ni = new Int32Array(n);
      ni.set(h.items);
      h.scores = ns;
      h.items = ni;
    }
    const sc = h.scores;
    const it = h.items;
    let i = h.len++;
    sc[i] = score;
    it[i] = item;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (sc[p] <= sc[i]) break;
      const ts = sc[p]; sc[p] = sc[i]; sc[i] = ts;
      const ti = it[p]; it[p] = it[i]; it[i] = ti;
      i = p;
    }
    return true;
  }
  if (h.len === 0 || score <= s[0]) return false;
  const it = h.items;
  const len = h.len;
  s[0] = score;
  it[0] = item;
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    let m = i;
    if (l < len && s[l] < s[m]) m = l;
    if (r < len && s[r] < s[m]) m = r;
    if (m === i) break;
    const ts = s[m]; s[m] = s[i]; s[i] = ts;
    const ti = it[m]; it[m] = it[i]; it[i] = ti;
    i = m;
  }
  return true;
}

/* --------------------------------------------------------------------------
 * Le noyau : tout ce qui ne dépend que de la préparation, en tableaux typés
 * ----------------------------------------------------------------------- */

interface Noyau {
  pools: [RuneDetail[], RuneDetail[], RuneDetail[]];
  n: [number, number, number];
  D: number;
  T: number;
  trackedKeys: StatKey[];
  eff: [Float64Array, Float64Array, Float64Array];
  joker: [Uint8Array, Uint8Array, Uint8Array];
  setIdx: [Int8Array, Int8Array, Int8Array];
  cPct: [Float64Array, Float64Array, Float64Array];
  cFlat: [Float64Array, Float64Array, Float64Array];
  requiredPieces: number[];
  /** `stillFeasible(have, [1, 2])` ⟺ have[k] ≥ seuil12[k] pour tout k. */
  seuil12: Int32Array;
  /** `stillFeasible(have, [2])` ⟺ have[k] ≥ seuil2[k] pour tout k. */
  seuil2: Int32Array;
  fourPiece: Uint8Array;
  hasFourPiece: boolean;
  rescueIdxI2: Int32Array;
  /** Indices dans `trackedKeys` des stats contraintes (dédupliquées, dans l'ordre). */
  constr: Int32Array;
  /** Pour chaque stat suivie : base de pondération, et 1 si la stat est en pourcentage (PV/ATQ/DEF). */
  wcBase: Float64Array;
  wcPct: Uint8Array;
  /** Tranche combinée : indices suivis et seuils des minimums > 0, dans l'ordre de `minEntries`. */
  minIdx: Int32Array;
  minVal: Float64Array;
  hasCombined: boolean;
  /** Indices suivis des `retentionKeys`. */
  retIdx: Int32Array;
  sliceCount: number;
  caps: Int32Array;
}

function preparerNoyau(
  ctx: ContexteConstruction,
  slotIdxs: readonly [number, number, number],
  otherHalfMaxSets: number[],
  adaptiveTrancheWeighting: boolean
): Noyau {
  const { filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, jokerCredit, requiredPieces, base } = ctx;
  const [i0, i1, i2] = slotIdxs;
  const pools: [RuneDetail[], RuneDetail[], RuneDetail[]] = [filtered[i0], filtered[i1], filtered[i2]];
  const n: [number, number, number] = [pools[0].length, pools[1].length, pools[2].length];
  if (n[0] * n[1] * n[2] > 0x7fffffff) {
    throw new Error(`constructionRapide : ${n.join('×')} triplets dépassent le code entier 32 bits du noyau.`);
  }
  const trackedKeys = Array.from(new Set<StatKey>([...constrainedKeys, ...retentionKeys]));
  const T = trackedKeys.length;
  const D = distinctKeys.length;

  const prep = (pool: RuneDetail[]) => {
    const eff = new Float64Array(pool.length);
    const joker = new Uint8Array(pool.length);
    const setIdx = new Int8Array(pool.length);
    const cPct = new Float64Array(pool.length * T);
    const cFlat = new Float64Array(pool.length * T);
    for (let i = 0; i < pool.length; i++) {
      const r = pool[i];
      eff[i] = runeEfficiency(r);
      joker[i] = r.set === 'intangible' ? 1 : 0;
      setIdx[i] = distinctKeys.indexOf(r.set);
      for (let j = 0; j < T; j++) {
        const c = runeContribution(r, trackedKeys[j]);
        cPct[i * T + j] = c.pct;
        cFlat[i * T + j] = c.flat;
      }
    }
    return { eff, joker, setIdx, cPct, cFlat };
  };
  const p = pools.map(prep);

  // `stillFeasible` de buildBuckets : have[k] + reste + autre moitié + joker ≥ requis.
  const slotHasKey = pools.map((pool) => distinctKeys.map((key) => pool.some((r) => r.set === key)));
  const seuil12 = new Int32Array(D);
  const seuil2 = new Int32Array(D);
  for (let k = 0; k < D; k++) {
    const reste12 = (slotHasKey[1][k] ? 1 : 0) + (slotHasKey[2][k] ? 1 : 0);
    const reste2 = slotHasKey[2][k] ? 1 : 0;
    seuil12[k] = requiredPieces[k] - reste12 - otherHalfMaxSets[k] - jokerCredit;
    seuil2[k] = requiredPieces[k] - reste2 - otherHalfMaxSets[k] - jokerCredit;
  }
  const fourPiece = new Uint8Array(D);
  for (let k = 0; k < D; k++) fourPiece[k] = requiredPieces[k] > 3 ? 1 : 0;
  const hasFourPiece = fourPiece.some((v) => v === 1);
  const rescue: number[] = [];
  if (hasFourPiece) {
    for (let idx = 0; idx < pools[2].length; idx++) {
      const r = pools[2][idx];
      if (r.set === 'intangible' || distinctKeys.some((key, k) => fourPiece[k] === 1 && r.set === key)) rescue.push(idx);
    }
  }

  const constr = Int32Array.from(Array.from(new Set(constrainedKeys)).map((k) => trackedKeys.indexOf(k)));
  const wcBase = new Float64Array(T);
  const wcPct = new Uint8Array(T);
  for (let j = 0; j < T; j++) {
    const k = trackedKeys[j];
    wcBase[j] = (base as unknown as Record<string, number>)[k] ?? 0;
    wcPct[j] = k === 'hp' || k === 'atk' || k === 'def' ? 1 : 0;
  }
  const mins = minEntries.filter((e) => e.min > 0);
  const minIdx = Int32Array.from(mins.map((e) => trackedKeys.indexOf(e.k)));
  const minVal = Float64Array.from(mins.map((e) => e.min));
  const hasCombined = minEntries.length > 0;
  const retIdx = Int32Array.from(retentionKeys.map((k) => trackedKeys.indexOf(k)));

  const sliceCount = 1 + (hasCombined ? 1 : 0) + retentionKeys.length;
  const caps = new Int32Array(sliceCount);
  const reallocatedCap: Record<string, number> =
    adaptiveTrancheWeighting && retentionKeys.length > 0
      ? trancheReallocation(filtered, [i0, i1, i2], retentionKeys, base, bucketCap).reallocatedCap
      : {};
  caps[0] = bucketCap;
  if (hasCombined) caps[1] = bucketCap;
  const off = hasCombined ? 2 : 1;
  for (let i = 0; i < retentionKeys.length; i++) caps[off + i] = adaptiveTrancheWeighting ? reallocatedCap[retentionKeys[i]] : bucketCap;

  return {
    pools, n, D, T, trackedKeys,
    eff: [p[0].eff, p[1].eff, p[2].eff],
    joker: [p[0].joker, p[1].joker, p[2].joker],
    setIdx: [p[0].setIdx, p[1].setIdx, p[2].setIdx],
    cPct: [p[0].cPct, p[1].cPct, p[2].cPct],
    cFlat: [p[0].cFlat, p[1].cFlat, p[2].cFlat],
    requiredPieces, seuil12, seuil2, fourPiece, hasFourPiece, rescueIdxI2: Int32Array.from(rescue),
    constr, wcBase, wcPct, minIdx, minVal, hasCombined, retIdx, sliceCount, caps,
  };
}

/* --------------------------------------------------------------------------
 * L'état d'un parcours (une tranche, ou la moitié entière en séquentiel)
 * ----------------------------------------------------------------------- */

interface CompartimentEnCours {
  code: number;
  /** Code du premier triplet rangé ici : l'ordre de création des compartiments de buildBuckets. */
  premier: number;
  counts: number[];
  jokers: number;
  tas: Tas[];
  maxPct: Float64Array;
  maxFlat: Float64Array;
  premierPct: Float64Array;
  premierFlat: Float64Array;
}

interface Etat {
  noyau: Noyau;
  /** Code de compartiment → indice dans `compartiments` (−1 : absent). */
  parCode: Int32Array;
  compartiments: CompartimentEnCours[];
  sp: Float64Array;
  sf: Float64Array;
  scores: Float64Array;
  have0: Int32Array;
  have01: Int32Array;
  counts: Int32Array;
  emettre: boolean;
  emis: Int32Array;
  nEmis: number;
}

function nouvelEtat(noyau: Noyau, emettre: boolean): Etat {
  const { D, T } = noyau;
  return {
    noyau,
    parCode: new Int32Array(2 * 4 ** D).fill(-1),
    compartiments: [],
    sp: new Float64Array(T),
    sf: new Float64Array(T),
    scores: new Float64Array(noyau.sliceCount),
    have0: new Int32Array(D),
    have01: new Int32Array(D),
    counts: new Int32Array(D),
    emettre,
    emis: new Int32Array(emettre ? 1024 : 0),
    nEmis: 0,
  };
}

function codeCompartiment(counts: Int32Array, D: number, jokers: number): number {
  let c = jokers;
  for (let k = D - 1; k >= 0; k--) c = c * 4 + counts[k];
  return c;
}

function decoderCompartiment(code: number, D: number): { counts: Int32Array; jokers: number } {
  const counts = new Int32Array(D);
  let c = code;
  for (let k = 0; k < D; k++) {
    counts[k] = c % 4;
    c = Math.floor(c / 4);
  }
  return { counts, jokers: c };
}

function compartimentDe(etat: Etat, counts: Int32Array, jokers: number, premier: number): CompartimentEnCours {
  const { noyau } = etat;
  const code = codeCompartiment(counts, noyau.D, jokers);
  const i = etat.parCode[code];
  if (i >= 0) return etat.compartiments[i];
  const C = noyau.constr.length;
  const b: CompartimentEnCours = {
    code,
    premier,
    counts: Array.from(counts),
    jokers,
    tas: Array.from(noyau.caps, (cap) => nouveauTas(cap)),
    maxPct: new Float64Array(C),
    maxFlat: new Float64Array(C),
    premierPct: new Float64Array(C).fill(Infinity),
    premierFlat: new Float64Array(C).fill(Infinity),
  };
  etat.parCode[code] = etat.compartiments.length;
  etat.compartiments.push(b);
  return b;
}

/** Les scores des tranches d'un triplet dont les sommes sont dans `etat.sp`/`etat.sf` — mêmes expressions que buildBuckets. */
function calculerScores(etat: Etat, relevance: number): void {
  const { noyau, sp, sf, scores } = etat;
  const { wcBase, wcPct } = noyau;
  scores[0] = relevance;
  let s = 1;
  if (noyau.hasCombined) {
    let c = 0;
    const { minIdx, minVal } = noyau;
    for (let m = 0; m < minIdx.length; m++) {
      const j = minIdx[m];
      c += (wcPct[j] ? Math.ceil((wcBase[j] * sp[j]) / 100) + sf[j] : sf[j]) / minVal[m];
    }
    scores[s++] = c;
  }
  const { retIdx } = noyau;
  for (let i = 0; i < retIdx.length; i++) {
    const j = retIdx[i];
    scores[s++] = wcPct[j] ? Math.ceil((wcBase[j] * sp[j]) / 100) + sf[j] : sf[j];
  }
}

function emettre(etat: Etat, code: number): void {
  if (etat.nEmis === etat.emis.length) {
    const n = new Int32Array(etat.emis.length * 2);
    n.set(etat.emis);
    etat.emis = n;
  }
  etat.emis[etat.nEmis++] = code;
}

/** Tous les triplets d'une rune `idx0` du premier emplacement, dans l'ordre de buildBuckets. */
function parcourirR0(etat: Etat, idx0: number): void {
  const { noyau, sp, sf, scores, have0, have01, counts } = etat;
  const { D, T, n, eff, joker, setIdx, cPct, cFlat, seuil12, seuil2, fourPiece, hasFourPiece, rescueIdxI2, requiredPieces, constr, sliceCount } = noyau;
  const [n1, n2] = [n[1], n[2]];
  const [eff0, eff1, eff2] = eff;
  const [jk0, jk1, jk2] = joker;
  const [set0, set1, set2] = setIdx;
  const [cp0, cp1, cp2] = cPct;
  const [cf0, cf1, cf2] = cFlat;

  for (let k = 0; k < D; k++) have0[k] = set0[idx0] === k ? 1 : 0;
  if (D > 0) {
    for (let k = 0; k < D; k++) if (have0[k] < seuil12[k]) return;
  }
  const a = idx0 * T;
  const e0 = eff0[idx0];
  const j0 = jk0[idx0];
  for (let idx1 = 0; idx1 < n1; idx1++) {
    let faisable = true;
    for (let k = 0; k < D; k++) {
      have01[k] = have0[k] + (set1[idx1] === k ? 1 : 0);
      if (have01[k] < seuil2[k]) faisable = false;
    }
    if (D > 0 && !faisable) continue;
    const jokersR01 = j0 + jk1[idx1];
    if (jokersR01 >= 2) continue;
    let mustRescue = false;
    if (hasFourPiece && jokersR01 === 0) {
      for (let k = 0; k < D; k++) if (fourPiece[k] === 1 && have01[k] === 0) mustRescue = true;
    }
    const total2 = mustRescue ? rescueIdxI2.length : n2;
    const b1 = idx1 * T;
    const e01 = e0 + eff1[idx1];
    const base01 = (idx0 * n1 + idx1) * n2;
    for (let j2 = 0; j2 < total2; j2++) {
      const idx2 = mustRescue ? rescueIdxI2[j2] : j2;
      const j2k = jk2[idx2];
      if (jokersR01 + j2k >= 2) continue;
      const jokers = jokersR01 + j2k;
      let mort = false;
      for (let k = 0; k < D; k++) {
        counts[k] = have01[k] + (set2[idx2] === k ? 1 : 0);
        if (requiredPieces[k] > 3 && counts[k] === 0 && jokers === 0) mort = true;
      }
      if (mort) continue;

      const c2 = idx2 * T;
      for (let t = 0; t < T; t++) {
        sp[t] = cp0[a + t] + cp1[b1 + t] + cp2[c2 + t];
        sf[t] = cf0[a + t] + cf1[b1 + t] + cf2[c2 + t];
      }
      // (p0.eff + p1.eff + p2.eff) / 1000 : même ordre d'addition.
      const relevance = (e01 + eff2[idx2]) / 1000;
      const code = base01 + idx2;
      const b = compartimentDe(etat, counts, jokers, code);
      for (let c = 0; c < constr.length; c++) {
        const t = constr[c];
        if (sp[t] > b.maxPct[c]) {
          b.maxPct[c] = sp[t];
          if (b.premierPct[c] === Infinity) b.premierPct[c] = code;
        }
        if (sf[t] > b.maxFlat[c]) {
          b.maxFlat[c] = sf[t];
          if (b.premierFlat[c] === Infinity) b.premierFlat[c] = code;
        }
      }
      calculerScores(etat, relevance);
      let accepte = false;
      for (let s = 0; s < sliceCount; s++) if (pousser(b.tas[s], scores[s], code)) accepte = true;
      if (accepte && etat.emettre) emettre(etat, code);
    }
  }
}

/* --------------------------------------------------------------------------
 * Du dernier état des tas aux `Bucket` de buildBuckets (même fin de fonction)
 * ----------------------------------------------------------------------- */

function enregistrement(keys: StatKey[], valeurs: ArrayLike<number>): Record<string, number> {
  const r: Record<string, number> = {};
  for (let j = 0; j < keys.length; j++) r[keys[j]] = valeurs[j];
  return r;
}

/** Les clés de `maxPct`/`maxFlat` dans l'ordre où buildBuckets les crée : première valeur non nulle, puis ordre des stats contraintes. */
function bornes(noyau: Noyau, max: Float64Array, premier: Float64Array): Record<string, number> {
  const ordre: number[] = [];
  for (let c = 0; c < noyau.constr.length; c++) if (premier[c] !== Infinity) ordre.push(c);
  ordre.sort((x, y) => premier[x] - premier[y] || x - y);
  const r: Record<string, number> = {};
  for (const c of ordre) r[noyau.trackedKeys[noyau.constr[c]]] = max[c];
  return r;
}

function materialiser(
  noyau: Noyau,
  ctx: ContexteConstruction,
  compartiments: CompartimentEnCours[],
  combosOrderMode: OrdreCombos
): Bucket[] {
  const { pools, n, T, trackedKeys, cPct, cFlat, eff, sliceCount } = noyau;
  const { base, minEntries, retentionKeys, objectiveKeys } = ctx;
  const hasCombined = minEntries.length > 0;
  const n12 = n[1] * n[2];
  const sp = new Float64Array(T);
  const sf = new Float64Array(T);

  const combo = (code: number, counts: number[], jokers: number): HalfCombo => {
    const idx0 = Math.floor(code / n12);
    const rest = code - idx0 * n12;
    const idx1 = Math.floor(rest / n[2]);
    const idx2 = rest - idx1 * n[2];
    for (let t = 0; t < T; t++) {
      sp[t] = cPct[0][idx0 * T + t] + cPct[1][idx1 * T + t] + cPct[2][idx2 * T + t];
      sf[t] = cFlat[0][idx0 * T + t] + cFlat[1][idx1 * T + t] + cFlat[2][idx2 * T + t];
    }
    return {
      runes: [pools[0][idx0], pools[1][idx1], pools[2][idx2]],
      counts: counts.slice(),
      jokers,
      pct: enregistrement(trackedKeys, sp),
      flat: enregistrement(trackedKeys, sf),
      relevanceScore: (eff[0][idx0] + eff[1][idx1] + eff[2][idx2]) / 1000,
    };
  };

  const out: Bucket[] = [];
  const bucketBestBySlice: number[][] = [];
  const bucketSeen: HalfCombo[][] = [];
  const globalBestBySlice = new Array(sliceCount).fill(-Infinity);
  for (const c of compartiments) {
    const b: Bucket = { counts: c.counts, jokers: c.jokers, combos: [], maxPct: bornes(noyau, c.maxPct, c.premierPct), maxFlat: bornes(noyau, c.maxFlat, c.premierFlat), potential: 0 };
    out.push(b);
    const parCode = new Map<number, HalfCombo>();
    const seen: HalfCombo[] = [];
    const bestBySlice = new Array(sliceCount).fill(-Infinity);
    for (let s = 0; s < sliceCount; s++) {
      const h = c.tas[s];
      for (let e = 0; e < h.len; e++) {
        const code = h.items[e];
        if (!parCode.has(code)) {
          const hc = combo(code, c.counts, c.jokers);
          parCode.set(code, hc);
          seen.push(hc);
        }
        if (h.scores[e] > bestBySlice[s]) bestBySlice[s] = h.scores[e];
      }
      if (bestBySlice[s] > globalBestBySlice[s]) globalBestBySlice[s] = bestBySlice[s];
    }
    bucketBestBySlice.push(bestBySlice);
    bucketSeen.push(seen);
  }

  // Seconde passe : même tri que buildBuckets, mêmes scores recalculés sur les Record.
  const wc = (pct: Record<string, number>, flat: Record<string, number>, k: StatKey) => weightedContribution(base, k, pct[k] ?? 0, flat[k] ?? 0);
  for (let bi = 0; bi < out.length; bi++) {
    const b = out[bi];
    const scored = bucketSeen[bi].map((hc) => {
      let combined: number | null = null;
      if (hasCombined) {
        let sc = 0;
        for (const { k, min } of minEntries) {
          if (min <= 0) continue;
          sc += wc(hc.pct, hc.flat, k) / min;
        }
        combined = sc;
      }
      let objectiveVal: number | null = null;
      if (objectiveKeys.length > 0) {
        let sc = 0;
        for (const k of objectiveKeys) sc += wc(hc.pct, hc.flat, k);
        objectiveVal = sc;
      }
      const sliceScores: number[] = [hc.relevanceScore];
      if (combined != null) sliceScores.push(combined);
      for (const k of retentionKeys) sliceScores.push(wc(hc.pct, hc.flat, k));
      let potential = -Infinity;
      for (let s = 0; s < sliceCount; s++) {
        const g = globalBestBySlice[s];
        const normalized = g > 0 ? sliceScores[s] / g : sliceScores[s];
        if (normalized > potential) potential = normalized;
      }
      return { combo: hc, potential, combined, objectiveVal };
    });
    if (combosOrderMode === 'relevance') {
      scored.sort((x, y) => y.combo.relevanceScore - x.combo.relevanceScore);
    } else if (combosOrderMode === 'combined') {
      scored.sort((x, y) => (y.combined ?? y.combo.relevanceScore) - (x.combined ?? x.combo.relevanceScore));
    } else if (combosOrderMode === 'objective') {
      scored.sort((x, y) => (y.objectiveVal ?? y.combo.relevanceScore) - (x.objectiveVal ?? x.combo.relevanceScore));
    } else {
      scored.sort((x, y) => y.potential - x.potential);
    }
    b.combos = scored.map((s) => s.combo);
  }
  for (let bi = 0; bi < out.length; bi++) {
    const bx = bucketBestBySlice[bi];
    let pot = -Infinity;
    for (let s = 0; s < sliceCount; s++) {
      const g = globalBestBySlice[s];
      const nx = g > 0 ? bx[s] / g : bx[s];
      if (nx > pot) pot = nx;
    }
    out[bi].potential = pot;
  }
  out.sort((x, y) => y.potential - x.potential);
  return out;
}

function refuserTraceur(ctx: BuildBucketsContext | ContexteConstruction): void {
  if ((ctx as BuildBucketsContext).traceur) throw new Error('constructionRapide : le traceur de diagnostic n’est pas pris en charge par le noyau (construireMoitie passe alors par buildBuckets).');
}

/* --------------------------------------------------------------------------
 * API — séquentielle, puis découpée en tranches
 * ----------------------------------------------------------------------- */

/**
 * Pendant de `buildBuckets` (mêmes arguments, sans `skylineKeys` : aucun appel
 * de production n'en passe), même progression par rune du premier emplacement.
 */
export function* construireMoitieRapide(
  half: 'A' | 'B',
  slotIdxs: readonly [number, number, number],
  ctx: BuildBucketsContext,
  otherHalfMaxSets: number[],
  adaptiveTrancheWeighting = false,
  combosOrderMode: OrdreCombos = 'objective'
): Generator<BuildingProgress, Bucket[], void> {
  refuserTraceur(ctx);
  const noyau = preparerNoyau(ctx, slotIdxs, otherHalfMaxSets, adaptiveTrancheWeighting);
  const etat = nouvelEtat(noyau, false);
  const total = noyau.n[0];
  for (let idx0 = 0; idx0 < total; idx0++) {
    yield { phase: 'building', half, scanned: idx0 + 1, total };
    parcourirR0(etat, idx0);
  }
  return materialiser(noyau, ctx, etat.compartiments, combosOrderMode);
}

/** Une tranche du découpage parallèle : à exécuter dans un Worker, sur une partie des runes du premier emplacement. */
export function construireTranche(entree: EntreeTranche): ResultatTranche {
  refuserTraceur(entree.ctx);
  const noyau = preparerNoyau(entree.ctx, entree.slotIdxs, entree.otherHalfMaxSets, entree.adaptiveTrancheWeighting);
  const etat = nouvelEtat(noyau, true);
  let prec = -1;
  for (const idx0 of entree.idx0s) {
    if (!(idx0 > prec) || idx0 >= noyau.n[0]) throw new Error('constructionRapide : `idx0s` doit être strictement croissant et dans le pool.');
    prec = idx0;
    parcourirR0(etat, idx0);
  }
  return {
    idx0s: entree.idx0s,
    codes: etat.emis.slice(0, etat.nEmis),
    compartiments: etat.compartiments.map((c) => ({ code: c.code, premier: c.premier, maxPct: c.maxPct, maxFlat: c.maxFlat, premierPct: c.premierPct, premierFlat: c.premierFlat })),
  };
}

/** Les champs de la préparation que lit la construction, en objet sérialisable (sans `totalOf`, ni traceur). */
export function contexteDe(prepared: ContexteConstruction): ContexteConstruction {
  const { filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, jokerCredit, requiredPieces, base, objectiveKeys } = prepared;
  return { filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, jokerCredit, requiredPieces, base, objectiveKeys };
}

/** Répartit les runes du premier emplacement en `nb` tranches entrelacées (i ≡ w mod nb), chacune croissante. */
export function repartirIdx0(total: number, nb: number): number[][] {
  const out: number[][] = Array.from({ length: Math.max(1, nb) }, () => []);
  for (let i = 0; i < total; i++) out[i % out.length].push(i);
  return out;
}

/**
 * Fusion EXACTE des tranches : rejoue les triplets émis dans l'ordre global
 * des codes dans des tas neufs (voir l'en-tête pour la preuve), prend le
 * maximum des bornes et la première apparition de leurs clés. Les
 * compartiments sont créés d'avance dans l'ordre de leur premier triplet,
 * tous tas vides compris (un plafond nul de mesure n'y change rien).
 * ⚠️ Refuse des tranches qui ne couvrent pas chaque rune du premier
 * emplacement une fois et une seule : une rune oubliée changerait le
 * résultat sans rien dire.
 */
export function fusionnerTranches(
  ctx: ContexteConstruction,
  slotIdxs: readonly [number, number, number],
  otherHalfMaxSets: number[],
  adaptiveTrancheWeighting: boolean,
  combosOrderMode: OrdreCombos,
  tranches: ResultatTranche[]
): Bucket[] {
  refuserTraceur(ctx);
  const noyau = preparerNoyau(ctx, slotIdxs, otherHalfMaxSets, adaptiveTrancheWeighting);
  const { D, T, n, cPct, cFlat, eff, joker, setIdx, constr, sliceCount } = noyau;
  const vus = new Uint8Array(n[0]);
  for (const t of tranches) for (const i of t.idx0s) vus[i]++;
  if (vus.some((v) => v !== 1)) throw new Error('constructionRapide : les tranches ne couvrent pas le premier emplacement une fois et une seule.');

  const etat = nouvelEtat(noyau, false);
  // Ordre de création = premier triplet de chaque compartiment, toutes tranches confondues.
  const premiers = new Map<number, number>();
  for (const t of tranches) for (const tc of t.compartiments) premiers.set(tc.code, Math.min(premiers.get(tc.code) ?? Infinity, tc.premier));
  for (const [code, premier] of [...premiers].sort((x, y) => x[1] - y[1])) {
    const d = decoderCompartiment(code, D);
    compartimentDe(etat, d.counts, d.jokers, premier);
  }

  let total = 0;
  for (const t of tranches) total += t.codes.length;
  const codes = new Int32Array(total);
  let o = 0;
  for (const t of tranches) {
    codes.set(t.codes, o);
    o += t.codes.length;
  }
  codes.sort();

  const { sp, sf, scores, counts } = etat;
  const n12 = n[1] * n[2];
  for (let e = 0; e < codes.length; e++) {
    const code = codes[e];
    const idx0 = Math.floor(code / n12);
    const rest = code - idx0 * n12;
    const idx1 = Math.floor(rest / n[2]);
    const idx2 = rest - idx1 * n[2];
    for (let k = 0; k < D; k++) counts[k] = (setIdx[0][idx0] === k ? 1 : 0) + (setIdx[1][idx1] === k ? 1 : 0) + (setIdx[2][idx2] === k ? 1 : 0);
    const jokers = joker[0][idx0] + joker[1][idx1] + joker[2][idx2];
    for (let t = 0; t < T; t++) {
      sp[t] = cPct[0][idx0 * T + t] + cPct[1][idx1 * T + t] + cPct[2][idx2 * T + t];
      sf[t] = cFlat[0][idx0 * T + t] + cFlat[1][idx1 * T + t] + cFlat[2][idx2 * T + t];
    }
    const i = etat.parCode[codeCompartiment(counts, D, jokers)];
    if (i < 0) throw new Error('constructionRapide : triplet émis hors des compartiments déclarés par les tranches.');
    const b = etat.compartiments[i];
    calculerScores(etat, (eff[0][idx0] + eff[1][idx1] + eff[2][idx2]) / 1000);
    for (let s = 0; s < sliceCount; s++) {
      if (Number.isNaN(scores[s])) throw new Error('constructionRapide : score NaN — la fusion des tranches n’est exacte que sur un ordre total.');
      pousser(b.tas[s], scores[s], code);
    }
  }

  // Bornes : maximum sur les tranches, première apparition = plus petit code.
  const C = constr.length;
  for (const t of tranches) {
    for (const tc of t.compartiments) {
      const b = etat.compartiments[etat.parCode[tc.code]];
      for (let c = 0; c < C; c++) {
        if (tc.maxPct[c] > b.maxPct[c]) b.maxPct[c] = tc.maxPct[c];
        if (tc.maxFlat[c] > b.maxFlat[c]) b.maxFlat[c] = tc.maxFlat[c];
        if (tc.premierPct[c] < b.premierPct[c]) b.premierPct[c] = tc.premierPct[c];
        if (tc.premierFlat[c] < b.premierFlat[c]) b.premierFlat[c] = tc.premierFlat[c];
      }
    }
  }
  return materialiser(noyau, ctx, etat.compartiments, combosOrderMode);
}

/* --------------------------------------------------------------------------
 * Le différentiel : égalité PROFONDE de deux listes de compartiments
 * ----------------------------------------------------------------------- */

function memesNombres(a: Record<string, number>, b: Record<string, number>): string | null {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.join(',') !== kb.join(',')) return `clés [${ka.join(',')}] ≠ [${kb.join(',')}]`;
  for (const k of ka) if (!Object.is(a[k], b[k])) return `${k} : ${a[k]} ≠ ${b[k]}`;
  return null;
}

/**
 * Première différence entre deux sorties de construction, ou `null` si elles
 * sont identiques : compartiments dans l'ordre (champs, comptes, jokers,
 * `potential`, `maxPct`/`maxFlat` clés comprises), puis chaque combo dans
 * l'ordre (les trois runes par IDENTITÉ d'objet, comptes, jokers, `pct`,
 * `flat`, `relevanceScore`). Les nombres se comparent par `Object.is`.
 */
export function premiereDivergence(attendu: Bucket[], recu: Bucket[]): string | null {
  if (attendu.length !== recu.length) return `nombre de compartiments : ${attendu.length} ≠ ${recu.length}`;
  for (let i = 0; i < attendu.length; i++) {
    const a = attendu[i];
    const b = recu[i];
    const ou = `compartiment #${i} (${a.counts.join(',')}|${a.jokers})`;
    if (Object.keys(a).join(',') !== Object.keys(b).join(',')) return `${ou} : champs [${Object.keys(a).join(',')}] ≠ [${Object.keys(b).join(',')}]`;
    if (a.counts.join(',') !== b.counts.join(',') || a.jokers !== b.jokers) return `${ou} : clé ${b.counts.join(',')}|${b.jokers}`;
    if (!Object.is(a.potential, b.potential)) return `${ou} : potential ${a.potential} ≠ ${b.potential}`;
    const dp = memesNombres(a.maxPct, b.maxPct);
    if (dp) return `${ou} : maxPct ${dp}`;
    const df = memesNombres(a.maxFlat, b.maxFlat);
    if (df) return `${ou} : maxFlat ${df}`;
    if (a.combos.length !== b.combos.length) return `${ou} : ${a.combos.length} combos ≠ ${b.combos.length}`;
    for (let j = 0; j < a.combos.length; j++) {
      const x = a.combos[j];
      const y = b.combos[j];
      const ouc = `${ou}, combo #${j}`;
      if (Object.keys(x).join(',') !== Object.keys(y).join(',')) return `${ouc} : champs`;
      for (let r = 0; r < 3; r++) if (x.runes[r] !== y.runes[r]) return `${ouc} : rune ${r} ${x.runes[r]?.id} ≠ ${y.runes[r]?.id}`;
      if (x.runes.length !== y.runes.length) return `${ouc} : nombre de runes`;
      if (x.counts.join(',') !== y.counts.join(',') || x.jokers !== y.jokers) return `${ouc} : comptes ou jokers`;
      if (!Object.is(x.relevanceScore, y.relevanceScore)) return `${ouc} : relevanceScore ${x.relevanceScore} ≠ ${y.relevanceScore}`;
      const cp = memesNombres(x.pct, y.pct);
      if (cp) return `${ouc} : pct ${cp}`;
      const cf = memesNombres(x.flat, y.flat);
      if (cf) return `${ouc} : flat ${cf}`;
    }
  }
  return null;
}

/** Empreinte de taille, pour les sorties du banc et du test. */
export function tailleCompartiments(buckets: Bucket[]): { compartiments: number; combos: number } {
  return { compartiments: buckets.length, combos: buckets.reduce((s, b) => s + b.combos.length, 0) };
}

