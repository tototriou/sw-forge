// Construction des moitiés sur tableaux typés : le chemin de production
// (`construireMoitieTypee`, src/lib/rechercheRunes.ts, Workers de l'écran et
// `searchBuilds`). Le CLI et le harnais gardent l'adaptateur objet
// `construireMoitie`. `buildBuckets` reste la RÉFÉRENCE et le chemin du
// traceur de diagnostic. Contrat : rendre EXACTEMENT les compartiments de
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
//   code du triplet) dans deux tableaux typés. Les triplets retenus restent
//   en colonnes ; seul l'adaptateur d'outillage construit des `HalfCombo`.
// - Les sommes et les scores reprennent les MÊMES expressions dans le même
//   ordre (`p0 + p1 + p2`, `Math.ceil((b * pct) / 100) + flat`, la somme de la
//   tranche combinée minimum par minimum) : mêmes nombres au bit près. Le tas
//   reprend `heapPush` comparaison par comparaison, échange par échange : même
//   disposition finale, donc même ordre de déduplication et mêmes ex æquo.
// - Le code d'un triplet, `(idx0 × n1 + idx1) × n2 + idx2`, croît dans l'ordre
//   même où `buildBuckets` énumère : il sert de rang global (ordre de création
//   des compartiments, ordre d'apparition des clés de `maxPct`/`maxFlat`).
// - Les triplets qu'aucun tas n'accepterait ne sont ni sommés, ni notés, ni
//   poussés (`candidatsDeLaLigne`) : 90 à 96 % des triplets d'une recherche
//   réelle. Un tas plein refuse un score `≤` sa racine sans rien changer, et sa
//   racine ne fait que croître : un triplet dont chaque note est majorée par la
//   racine de son tas AU DÉBUT de la ligne `(idx0, idx1)` est un no-op pour
//   les tas. La majoration est linéaire en la troisième rune (`ceil(x) < x + 1`),
//   triée d'avance par tranche et par classe (set, joker) de la troisième rune,
//   avec une marge relative de 1e-9 qui couvre l'arrondi flottant (erreur réelle
//   ~1e-14) ; efficience et stats sans pourcentage se bornent sans marge (note
//   monotone en la contribution de la troisième rune). Ces triplets étendent
//   quand même `maxPct`/`maxFlat`, d'un coup par classe : l'addition flottante
//   est monotone, donc `fl(a + max c) = max fl(a + c)`. Une classe se traite
//   triplet par triplet, comme avant, si son compartiment n'existe pas encore
//   (sa création fixe l'ordre des compartiments), si un de ses tas n'est pas
//   plein, ou si elle poserait la première borne non nulle d'une stat (le code
//   de cette première apparition ordonne les clés de `maxPct`/`maxFlat`). Les
//   candidats se traitent dans l'ordre croissant d'`idx2`, donc des codes.
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
  ordonnerCombos,
  runeContribution,
} from './runeBuildOptim';
import { CompartimentType, copierLigne, lireCombo, nouvelleVueCombo, nouvellesColonnes, objetsDesCompartiments } from './demiBuildsTypes';

export type OrdreCombos = 'potential' | 'relevance' | 'combined' | 'objective';

/** Le sous-ensemble sérialisable de `BuildBucketsContext` que lit la construction. */
export type ContexteConstruction = Omit<BuildBucketsContext, 'traceur'>;

/** Ce qu'une tranche reçoit : sérialisable tel quel par `postMessage`/`workerData`. */
export interface EntreeTranche {
  ctx: ContexteConstruction;
  slotIdxs: readonly [number, number, number];
  otherHalfMaxSets: number[];
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
  items: Int32Array | Float64Array;
}

function nouveauTas(cap: number, codesLarges: boolean): Tas {
  const init = Math.max(1, Math.min(cap, 64));
  return { cap, len: 0, scores: new Float64Array(init), items: codesLarges ? new Float64Array(init) : new Int32Array(init) };
}

/** Vrai si l'entrée est entrée dans le tas (même décision que `heapPush`). */
function pousser(h: Tas, score: number, item: number): boolean {
  const s = h.scores;
  if (h.len < h.cap) {
    if (h.len === s.length) {
      const n = Math.min(h.cap, s.length * 2);
      const ns = new Float64Array(n);
      ns.set(s);
      const ni = h.items instanceof Float64Array ? new Float64Array(n) : new Int32Array(n);
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
  caps: Int32Array | Float64Array;
  codesLarges: boolean;
  /** Tables de l'élagage des triplets qu'aucun tas n'accepterait ; `null` : chaque triplet est noté. */
  elagage: Elagage | null;
}

/**
 * Par classe de la troisième rune — `(setIdx + 1) × 2 + joker`, ce qui fixe
 * son compartiment sur une ligne `(idx0, idx1)` — et par tranche de rétention :
 * les runes triées par clé décroissante. Indices `[classe × sliceCount + tranche]`.
 */
interface Elagage {
  nc: number;
  /** Runes de la classe, croissantes. */
  membres: Int32Array[];
  setDe: Int8Array;
  jokerDe: Uint8Array;
  /** 1 si la classe est dans `rescueIdxI2` (Intangible, ou set à 4 pièces demandé). */
  secours: Uint8Array;
  /** `[classe × T + t]` : maxima de la classe, pour étendre `maxPct`/`maxFlat` d'un coup. */
  maxCp: Float64Array;
  maxCf: Float64Array;
  /** Par tranche : 0 efficience, 1 stat sans pourcentage (bornes exactes), 2 stat en pourcentage, 3 combinée (bornes avec marge). */
  sorte: Uint8Array;
  /** Par tranche : indice suivi de la stat (sortes 1 et 2), −1 sinon. */
  stat: Int32Array;
  ordres: Int32Array[];
  cles: Float64Array[];
  /** Maximum sur la classe de la somme des valeurs absolues des termes de la clé (marge). */
  absMax: Float64Array;
}

/** Marge relative des bornes linéaires : l'erreur d'arrondi des notes est de l'ordre de 1e-14 relatif. */
const MARGE_ELAGAGE = 1e-9;
/** Au-delà, l'élagage s'abstient : aucune note ne peut alors déborder ni devenir NaN. */
const VALEUR_MAX_ELAGAGE = 1e12;

/** Options de la construction typée. `elaguer: false` note chaque triplet (référence des tests). */
export interface OptionsConstruction {
  elaguer?: boolean;
  /** Compte de travail, rempli si présent : triplets notés, et triplets reconnus refusés sans être notés. */
  compte?: CompteConstruction;
}

export interface CompteConstruction {
  notes: number;
  evites: number;
}

function preparerElagage(noyau: Omit<Noyau, 'elagage'>): Elagage | null {
  const { D, T, n, eff, joker, setIdx, cPct, cFlat, wcBase, wcPct, minIdx, minVal, hasCombined, retIdx, sliceCount, fourPiece } = noyau;
  const fini = (v: number) => Number.isFinite(v) && Math.abs(v) <= VALEUR_MAX_ELAGAGE;
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < n[s]; i++) if (!fini(eff[s][i])) return null;
    for (let i = 0; i < n[s] * T; i++) if (!fini(cPct[s][i]) || !fini(cFlat[s][i])) return null;
  }
  for (let j = 0; j < T; j++) if (!fini(wcBase[j])) return null;
  for (let m = 0; m < minVal.length; m++) if (!fini(minVal[m]) || !(minVal[m] > 0)) return null;

  const nc = 2 * (D + 1);
  const membresL: number[][] = Array.from({ length: nc }, () => []);
  for (let i = 0; i < n[2]; i++) membresL[(setIdx[2][i] + 1) * 2 + joker[2][i]].push(i);
  const membres = membresL.map((l) => Int32Array.from(l));
  const setDe = new Int8Array(nc);
  const jokerDe = new Uint8Array(nc);
  const secours = new Uint8Array(nc);
  for (let k = 0; k < nc; k++) {
    setDe[k] = (k >> 1) - 1;
    jokerDe[k] = k & 1;
    secours[k] = jokerDe[k] === 1 || (setDe[k] >= 0 && fourPiece[setDe[k]] === 1) ? 1 : 0;
  }
  const maxCp = new Float64Array(nc * T).fill(-Infinity);
  const maxCf = new Float64Array(nc * T).fill(-Infinity);
  for (let k = 0; k < nc; k++) {
    for (const i of membres[k]) {
      for (let t = 0; t < T; t++) {
        if (cPct[2][i * T + t] > maxCp[k * T + t]) maxCp[k * T + t] = cPct[2][i * T + t];
        if (cFlat[2][i * T + t] > maxCf[k * T + t]) maxCf[k * T + t] = cFlat[2][i * T + t];
      }
    }
  }

  const sorte = new Uint8Array(sliceCount);
  const stat = new Int32Array(sliceCount).fill(-1);
  let s0 = 1;
  if (hasCombined) sorte[s0++] = 3;
  for (let r = 0; r < retIdx.length; r++, s0++) {
    stat[s0] = retIdx[r];
    sorte[s0] = wcPct[retIdx[r]] ? 2 : 1;
  }
  // Clé d'une rune du troisième emplacement pour la tranche s, et la somme des valeurs absolues de ses termes.
  const terme = (i: number, j: number) => (wcPct[j] ? (wcBase[j] * cPct[2][i * T + j]) / 100 : 0) + cFlat[2][i * T + j];
  const termeAbs = (i: number, j: number) => (wcPct[j] ? Math.abs((wcBase[j] * cPct[2][i * T + j]) / 100) : 0) + Math.abs(cFlat[2][i * T + j]);
  const cle = (s: number, i: number): number => {
    switch (sorte[s]) {
      case 0: return eff[2][i];
      case 1: return cFlat[2][i * T + stat[s]];
      case 2: return terme(i, stat[s]);
      default: {
        let c = 0;
        for (let m = 0; m < minIdx.length; m++) c += terme(i, minIdx[m]) / minVal[m];
        return c;
      }
    }
  };
  const cleAbs = (s: number, i: number): number => {
    if (sorte[s] === 2) return termeAbs(i, stat[s]);
    if (sorte[s] !== 3) return 0;
    let c = 0;
    for (let m = 0; m < minIdx.length; m++) c += termeAbs(i, minIdx[m]) / minVal[m];
    return c;
  };
  const ordres: Int32Array[] = [];
  const cles: Float64Array[] = [];
  const absMax = new Float64Array(nc * sliceCount);
  for (let k = 0; k < nc; k++) {
    for (let s = 0; s < sliceCount; s++) {
      const m = membres[k];
      const c = new Float64Array(n[2]);
      let am = 0;
      for (const i of m) {
        c[i] = cle(s, i);
        const a = cleAbs(s, i);
        if (a > am) am = a;
      }
      const ord = Int32Array.from(m).sort((x, y) => c[y] - c[x] || x - y);
      ordres.push(ord);
      cles.push(Float64Array.from(ord, (i) => c[i]));
      absMax[k * sliceCount + s] = am;
    }
  }
  return { nc, membres, setDe, jokerDe, secours, maxCp, maxCf, sorte, stat, ordres, cles, absMax };
}

function preparerNoyau(
  ctx: ContexteConstruction,
  slotIdxs: readonly [number, number, number],
  otherHalfMaxSets: number[],
  elargir = false,
  elaguer = true
): Noyau {
  const { filtered, distinctKeys, constrainedKeys, retentionKeys, minEntries, bucketCap, jokerCredit, requiredPieces, base } = ctx;
  const [i0, i1, i2] = slotIdxs;
  const pools: [RuneDetail[], RuneDetail[], RuneDetail[]] = [filtered[i0], filtered[i1], filtered[i2]];
  const n: [number, number, number] = [pools[0].length, pools[1].length, pools[2].length];
  const codesLarges = n[0] * n[1] * n[2] > 0x7fffffff;
  if (codesLarges && !elargir) {
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
  // Chaque tranche a `bucketCap` places, comme dans `buildBuckets`.
  // heapPush accepte ceil(cap) entrées pour cap > 0, y compris Infinity.
  // Le chemin en colonnes garde ces overrides sans détour par HalfCombo.
  const caps = elargir
    ? new Float64Array(sliceCount).fill(bucketCap > 0 ? Math.ceil(bucketCap) : 0)
    : new Int32Array(sliceCount).fill(bucketCap);

  const noyau = {
    pools, n, D, T, trackedKeys,
    eff: [p[0].eff, p[1].eff, p[2].eff] as Noyau['eff'],
    joker: [p[0].joker, p[1].joker, p[2].joker] as Noyau['joker'],
    setIdx: [p[0].setIdx, p[1].setIdx, p[2].setIdx] as Noyau['setIdx'],
    cPct: [p[0].cPct, p[1].cPct, p[2].cPct] as Noyau['cPct'],
    cFlat: [p[0].cFlat, p[1].cFlat, p[2].cFlat] as Noyau['cFlat'],
    requiredPieces, seuil12, seuil2, fourPiece, hasFourPiece, rescueIdxI2: Int32Array.from(rescue),
    constr, wcBase, wcPct, minIdx, minVal, hasCombined, retIdx, sliceCount, caps, codesLarges,
  };
  return { ...noyau, elagage: elaguer ? preparerElagage(noyau) : null };
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
  /** Élagage : sommes des deux premières runes de la ligne, candidats de la ligne et leur marque. */
  sp01: Float64Array;
  sf01: Float64Array;
  countsClasse: Int32Array;
  cands: Int32Array;
  marque: Int32Array;
  ligne: number;
  /** Par tranche, pour la ligne : terme constant de la borne et somme des valeurs absolues de ses termes. */
  aLigne: Float64Array;
  aAbsLigne: Float64Array;
  compte: CompteConstruction | null;
}

function nouvelEtat(noyau: Noyau, emettre: boolean, compte: CompteConstruction | null = null): Etat {
  const { D, T } = noyau;
  const n2 = noyau.elagage ? noyau.n[2] : 0;
  return {
    sp01: new Float64Array(T),
    sf01: new Float64Array(T),
    countsClasse: new Int32Array(D),
    cands: new Int32Array(n2),
    marque: new Int32Array(n2),
    ligne: 0,
    aLigne: new Float64Array(noyau.sliceCount),
    aAbsLigne: new Float64Array(noyau.sliceCount),
    compte,
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
    tas: Array.from(noyau.caps, (cap) => nouveauTas(cap, noyau.codesLarges)),
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
    const b1 = idx1 * T;
    const e01 = e0 + eff1[idx1];
    const base01 = (idx0 * n1 + idx1) * n2;
    let liste: Int32Array | null = mustRescue ? rescueIdxI2 : null;
    let total2 = mustRescue ? rescueIdxI2.length : n2;
    if (noyau.elagage) {
      total2 = candidatsDeLaLigne(etat, noyau.elagage, a, b1, have01, jokersR01, mustRescue, e01);
      liste = etat.cands;
    }
    for (let j2 = 0; j2 < total2; j2++) {
      const idx2 = liste ? liste[j2] : j2;
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
      if (etat.compte) etat.compte.notes++;
      calculerScores(etat, relevance);
      let accepte = false;
      for (let s = 0; s < sliceCount; s++) if (pousser(b.tas[s], scores[s], code)) accepte = true;
      if (accepte && etat.emettre) emettre(etat, code);
    }
  }
}

/** Vrai si une rune de clé `cle` peut encore battre `racine` (tranche de sorte `sorte`, terme constant `a`). */
function depasse(sorte: number, cle: number, a: number, marge: number, racine: number): boolean {
  // Sorte 0 : la note même, `(e0 + e1 + e2) / 1000`. Sorte 1 : la note même, `f0 + f1 + f2`.
  if (sorte === 0) return (a + cle) / 1000 > racine;
  if (sorte === 1) return a + cle > racine;
  return a + cle + marge > racine;
}

/** Longueur du préfixe de `cles` (décroissantes) qui peut battre la racine : recherche galopante, les préfixes étant courts. */
function prefixe(cles: Float64Array, sorte: number, a: number, marge: number, racine: number): number {
  const m = cles.length;
  if (m === 0 || !depasse(sorte, cles[0], a, marge, racine)) return 0;
  let vrai = 0;
  let pas = 1;
  while (vrai + pas < m && depasse(sorte, cles[vrai + pas], a, marge, racine)) {
    vrai += pas;
    pas *= 2;
  }
  let lo = vrai + 1;
  let hi = Math.min(vrai + pas, m);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (depasse(sorte, cles[mid], a, marge, racine)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Les troisièmes runes de la ligne `(idx0, idx1)` dont le triplet peut changer
 * un tas, croissantes, dans `etat.cands` ; rend leur nombre. Étend d'un coup
 * `maxPct`/`maxFlat` des classes dont des triplets sont écartés. Les autres
 * filtres (joker, set mort, sauvetage) restent ceux de la boucle : une classe
 * qu'ils écartent n'apporte rien.
 */
function candidatsDeLaLigne(
  etat: Etat, el: Elagage, a: number, b1: number, have01: Int32Array,
  jokersR01: number, mustRescue: boolean, e01: number
): number {
  const { noyau, sp01, sf01, countsClasse, cands, marque, aLigne, aAbsLigne } = etat;
  const { D, T, cPct, cFlat, wcBase, wcPct, minIdx, minVal, constr, sliceCount, requiredPieces } = noyau;
  const [cp0, cp1] = cPct;
  const [cf0, cf1] = cFlat;
  for (let t = 0; t < T; t++) {
    sp01[t] = cp0[a + t] + cp1[b1 + t];
    sf01[t] = cf0[a + t] + cf1[b1 + t];
  }
  // Terme constant de chaque tranche : pour une stat en pourcentage,
  // ceil(w × (s01 + c2) / 100) + f01 + f2 < w × s01 / 100 + 1 + f01 + (w × c2 / 100 + f2).
  for (let s = 0; s < sliceCount; s++) {
    const sorte = el.sorte[s];
    if (sorte === 0) aLigne[s] = e01;
    else if (sorte === 1) aLigne[s] = sf01[el.stat[s]];
    else if (sorte === 2) {
      const j = el.stat[s];
      const y = (wcBase[j] * sp01[j]) / 100;
      aLigne[s] = y + 1 + sf01[j];
      aAbsLigne[s] = Math.abs(y) + 1 + Math.abs(sf01[j]);
    } else {
      let c = 0;
      let cAbs = 0;
      for (let m = 0; m < minIdx.length; m++) {
        const j = minIdx[m];
        const y = wcPct[j] ? (wcBase[j] * sp01[j]) / 100 : 0;
        c += (y + (wcPct[j] ? 1 : 0) + sf01[j]) / minVal[m];
        cAbs += (Math.abs(y) + (wcPct[j] ? 1 : 0) + Math.abs(sf01[j])) / minVal[m];
      }
      aLigne[s] = c;
      aAbsLigne[s] = cAbs;
    }
  }

  const ligne = ++etat.ligne;
  let nb = 0;
  let parcourus = 0;
  const ajouter = (i: number) => {
    if (marque[i] !== ligne) {
      marque[i] = ligne;
      cands[nb++] = i;
    }
  };
  for (let k = 0; k < el.nc; k++) {
    const membres = el.membres[k];
    if (membres.length === 0) continue;
    const jokers = jokersR01 + el.jokerDe[k];
    if (jokers >= 2 || (mustRescue && el.secours[k] === 0)) continue;
    const s2 = el.setDe[k];
    let mort = false;
    for (let d = 0; d < D; d++) {
      countsClasse[d] = have01[d] + (s2 === d ? 1 : 0);
      if (requiredPieces[d] > 3 && countsClasse[d] === 0 && jokers === 0) mort = true;
    }
    if (mort) continue;
    parcourus += membres.length;
    const ib = etat.parCode[codeCompartiment(countsClasse, D, jokers)];
    let toute = ib < 0;
    const b = toute ? null : etat.compartiments[ib];
    if (b) {
      for (let c = 0; c < constr.length && !toute; c++) {
        const t = constr[c];
        if (b.premierPct[c] === Infinity && sp01[t] + el.maxCp[k * T + t] > b.maxPct[c]) toute = true;
        if (b.premierFlat[c] === Infinity && sf01[t] + el.maxCf[k * T + t] > b.maxFlat[c]) toute = true;
      }
      for (let s = 0; s < sliceCount && !toute; s++) if (b.tas[s].len < b.tas[s].cap) toute = true;
    }
    if (toute || !b) {
      for (let q = 0; q < membres.length; q++) ajouter(membres[q]);
      continue;
    }
    // Les triplets écartés étendent les bornes comme s'ils avaient été rencontrés.
    for (let c = 0; c < constr.length; c++) {
      const t = constr[c];
      const vp = sp01[t] + el.maxCp[k * T + t];
      const vf = sf01[t] + el.maxCf[k * T + t];
      if (vp > b.maxPct[c]) b.maxPct[c] = vp;
      if (vf > b.maxFlat[c]) b.maxFlat[c] = vf;
    }
    for (let s = 0; s < sliceCount; s++) {
      const h = b.tas[s];
      // Plafond nul : le tas refuse tout.
      if (h.len === 0) continue;
      const racine = h.scores[0];
      const ks = k * sliceCount + s;
      const sorte = el.sorte[s];
      const marge = sorte >= 2 ? MARGE_ELAGAGE * (1 + aAbsLigne[s] + el.absMax[ks] + Math.abs(racine)) : 0;
      const p = prefixe(el.cles[ks], sorte, aLigne[s], marge, racine);
      const ord = el.ordres[ks];
      for (let q = 0; q < p; q++) ajouter(ord[q]);
    }
  }
  if (etat.compte) etat.compte.evites += parcourus - nb;
  cands.subarray(0, nb).sort();
  return nb;
}

/* --------------------------------------------------------------------------
 * Du dernier état des tas aux colonnes (même ordre que buildBuckets)
 * ----------------------------------------------------------------------- */

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
): CompartimentType[] {
  const { pools, n, T, trackedKeys, cPct, cFlat, eff, sliceCount } = noyau;
  const n12 = n[1] * n[2];
  const remplir = (c: CompartimentType['combos'], i: number, code: number): void => {
    const idx0 = Math.floor(code / n12);
    const rest = code - idx0 * n12;
    const idx1 = Math.floor(rest / n[2]);
    const idx2 = rest - idx1 * n[2];
    for (let t = 0; t < T; t++) {
      c.pct[i * T + t] = cPct[0][idx0 * T + t] + cPct[1][idx1 * T + t] + cPct[2][idx2 * T + t];
      c.flat[i * T + t] = cFlat[0][idx0 * T + t] + cFlat[1][idx1 * T + t] + cFlat[2][idx2 * T + t];
    }
    c.ids[3 * i] = pools[0][idx0].id;
    c.ids[3 * i + 1] = pools[1][idx1].id;
    c.ids[3 * i + 2] = pools[2][idx2].id;
    c.relevance[i] = (eff[0][idx0] + eff[1][idx1] + eff[2][idx2]) / 1000;
  };

  const out: CompartimentType[] = [];
  const bucketBestBySlice: number[][] = [];
  const globalBestBySlice = new Array(sliceCount).fill(-Infinity);
  for (const c of compartiments) {
    const seen = new Set<number>();
    const bestBySlice = new Array(sliceCount).fill(-Infinity);
    for (let s = 0; s < sliceCount; s++) {
      const h = c.tas[s];
      for (let e = 0; e < h.len; e++) {
        const code = h.items[e];
        seen.add(code);
        if (h.scores[e] > bestBySlice[s]) bestBySlice[s] = h.scores[e];
      }
      if (bestBySlice[s] > globalBestBySlice[s]) globalBestBySlice[s] = bestBySlice[s];
    }
    bucketBestBySlice.push(bestBySlice);
    const combos = nouvellesColonnes(seen.size, trackedKeys);
    let i = 0;
    for (const code of seen) remplir(combos, i++, code);
    out.push({ counts: c.counts, jokers: c.jokers, combos, maxPct: bornes(noyau, c.maxPct, c.premierPct), maxFlat: bornes(noyau, c.maxFlat, c.premierFlat), potential: 0 });
  }

  // Le tri partagé lit une vue réutilisée ; aucune matérialisation de HalfCombo.
  for (let bi = 0; bi < out.length; bi++) {
    const b = out[bi];
    const vue = nouvelleVueCombo();
    const ordre = ordonnerCombos(Array.from({ length: b.combos.length }, (_, i) => i), ctx, combosOrderMode, globalBestBySlice, (i) => lireCombo(b, i, vue));
    const combos = nouvellesColonnes(ordre.length, trackedKeys);
    ordre.forEach((j, i) => copierLigne(combos, i, b.combos, j));
    b.combos = combos;
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
 * `options.elaguer: false` note chaque triplet : la référence du différentiel
 * de l'élagage (tests/construction-elagage.test.ts), même résultat.
 */
export function* construireMoitieRapideTypee(
  half: 'A' | 'B',
  slotIdxs: readonly [number, number, number],
  ctx: BuildBucketsContext,
  otherHalfMaxSets: number[],
  combosOrderMode: OrdreCombos = 'objective',
  options: OptionsConstruction = {}
): Generator<BuildingProgress, CompartimentType[], void> {
  refuserTraceur(ctx);
  const noyau = preparerNoyau(ctx, slotIdxs, otherHalfMaxSets, true, options.elaguer ?? true);
  const etat = nouvelEtat(noyau, false, options.compte ?? null);
  const total = noyau.n[0];
  for (let idx0 = 0; idx0 < total; idx0++) {
    yield { phase: 'building', half, scanned: idx0 + 1, total };
    parcourirR0(etat, idx0);
  }
  return materialiser(noyau, ctx, etat.compartiments, combosOrderMode);
}

/** Référence objet pour les consommateurs d'outillage. */
export function* construireMoitieRapide(
  half: 'A' | 'B', slotIdxs: readonly [number, number, number], ctx: BuildBucketsContext,
  otherHalfMaxSets: number[], combosOrderMode: OrdreCombos = 'objective'
): Generator<BuildingProgress, Bucket[], void> {
  return objetsDesCompartiments(yield* construireMoitieRapideTypee(half, slotIdxs, ctx, otherHalfMaxSets, combosOrderMode), ctx.filtered);
}

/** Une tranche du découpage parallèle : à exécuter dans un Worker, sur une partie des runes du premier emplacement. */
export function construireTranche(entree: EntreeTranche): ResultatTranche {
  refuserTraceur(entree.ctx);
  const noyau = preparerNoyau(entree.ctx, entree.slotIdxs, entree.otherHalfMaxSets);
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
  combosOrderMode: OrdreCombos,
  tranches: ResultatTranche[]
): Bucket[] {
  refuserTraceur(ctx);
  // La fusion ne parcourt aucune ligne : pas de tables d'élagage.
  const noyau = preparerNoyau(ctx, slotIdxs, otherHalfMaxSets, false, false);
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
  return objetsDesCompartiments(materialiser(noyau, ctx, etat.compartiments, combosOrderMode), ctx.filtered);
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

