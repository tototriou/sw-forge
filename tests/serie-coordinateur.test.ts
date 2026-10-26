// La série du Worker principal entre la construction des moitiés et le
// premier morceau : relevé des lignes (`releverLignes`), plan découpé sur ce
// relevé (`planifierMorceaux`), contrat et encodage en une lecture
// (`verifierEtEncoder`), repris par l'appariement (`analyserEspace`). Chacun
// est comparé aux anciennes boucles, gardées ici comme ORACLE (copies des
// versions qui relisaient chaque demi-build) : mêmes morceaux octet pour
// octet, mêmes colonnes, mêmes motifs de repli ; puis le travail retiré, en
// lectures de demi-build comptées sur les colonnes.

import { BaseStats } from '../src/types';
import { StatKey } from '../src/lib/effects';
import { Bucket, BuildRequirement, PreparedSearch, SearchParams, prepareSearch, totalPairCount } from '../src/lib/runeBuildOptim';
import { construireMoitie } from '../src/lib/rechercheRunes';
import {
  CompartimentsTypes, Morceau, MoitieTypee, TAILLE_BLOC, TAILLE_BLOC_TRI, analyserEspace, apparierRapide, comboAOuvert, compterPaires, constantesNoyau,
  encoderCompartiments, ordreDesCompartiments, paireDeCompartimentsOuverte, releverLignes, verifierContrat, verifierEtEncoder,
} from '../src/lib/appariementRapide';
import { planifierMorceaux } from '../src/lib/appariementRapideParallele';
import { Compartiment, CompartimentType, idCombo, lireCombo, nouvelleVueCombo, typerCompartiments } from '../src/lib/demiBuildsTypes';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 9000, atk: 700, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

/* --------------------------------------------------------------------------
 * Oracles : les boucles d'avant, recopiées telles quelles (l'encodage, avec
 * les blocs de l'ordre trié qu'il porte depuis le saut par blocs de la dichotomie)
 * ----------------------------------------------------------------------- */

function planOracle(prepared: PreparedSearch, bucketsA: Compartiment[], bucketsB: Compartiment[], cible: number): Morceau[] {
  const morceaux: Morceau[] = [];
  let segments: number[] = [];
  let drapeaux: number[] = [];
  let offset = 0;
  let taille = 0;
  const vue = nouvelleVueCombo();
  const fermer = () => {
    if (segments.length === 0) return;
    morceaux.push({ type: 'morceau', id: morceaux.length, offset, taille, segments: Int32Array.from(segments), drapeaux: Uint8Array.from(drapeaux) });
    offset += taille;
    taille = 0;
    segments = [];
    drapeaux = [];
  };
  for (const [iA, iB] of ordreDesCompartiments(bucketsA, bucketsB)) {
    const bA = bucketsA[iA];
    const bB = bucketsB[iB];
    if (!paireDeCompartimentsOuverte(prepared, bA, bB)) continue;
    const nB = bB.combos.length;
    let aDebut = 0;
    for (let a = 0; a < bA.combos.length; a++) {
      const ouvert = comboAOuvert(prepared, lireCombo(bA, a, vue), bB);
      drapeaux.push(ouvert ? 1 : 0);
      if (ouvert) taille += nB;
      if (taille >= cible) {
        segments.push(iA, iB, aDebut, a + 1);
        aDebut = a + 1;
        fermer();
      }
    }
    if (aDebut < bA.combos.length) segments.push(iA, iB, aDebut, bA.combos.length);
  }
  fermer();
  return morceaux;
}

const entierBorne = (v: number, borne: number) => Number.isInteger(v) && Math.abs(v) <= borne;

function contratOracle(prepared: PreparedSearch, bucketsA: Compartiment[], bucketsB: Compartiment[]): string | null {
  if (prepared.traceur) return 'traceur de diagnostic demandé (le noyau ne le remplit pas)';
  const c = constantesNoyau(prepared);
  const { guaranteed, guaranteedMin, artFlatMax, artFlatMin, relPctMax, relPctMin } = prepared;
  for (let kk = 0; kk < c.m; kk++) {
    const k = c.cles[kk];
    if (!entierBorne(c.b[kk], 2 ** 20)) return `base ${k} non entière ou hors borne (${c.b[kk]})`;
    if (!entierBorne(c.A0[kk], 2 ** 20)) return `aura externe ${k} non entière (${c.A0[kk]})`;
    for (const [nom, v] of [
      ['guaranteedMin.pct', guaranteedMin.pct[k] ?? 0], ['guaranteedMin.flat', guaranteedMin.flat[k] ?? 0],
      ['guaranteed.pct', guaranteed.pct[k] ?? 0], ['guaranteed.flat', guaranteed.flat[k] ?? 0],
      ['artFlatMax', artFlatMax[k] ?? 0], ['artFlatMin', artFlatMin[k] ?? 0],
      ['relPctMax', relPctMax[k] ?? 0], ['relPctMin', relPctMin[k] ?? 0],
    ] as const) {
      if (!entierBorne(v, 2 ** 20)) return `${nom}[${k}] non entier ou hors borne (${v})`;
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
          if (!entierBorne(p, 2 ** 20) || !entierBorne(f, 2 ** 20)) return `demi-build ${moitie} : ${k} non entier ou hors borne (${p} %, ${f})`;
          if (moitie === 'B') {
            const w = c.pct[kk] ? c.b[kk] * p + 100 * f : f;
            if (Math.abs(w) >= 2 ** 30) return `contribution W de ${k} hors Int32 (${w})`;
          }
        }
      }
    }
  }
  return null;
}

const estPct = (k: StatKey) => k === 'hp' || k === 'atk' || k === 'def';
function moitieOracle(buckets: Compartiment[], cles: StatKey[]): MoitieTypee {
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

function encodageOracle(prepared: PreparedSearch, bucketsA: Compartiment[], bucketsB: Compartiment[]): CompartimentsTypes {
  const c = constantesNoyau(prepared);
  const { cles, m } = c;
  const A = moitieOracle(bucketsA, cles);
  const base = moitieOracle(bucketsB, cles);
  const nB = base.debut[bucketsB.length];
  const pctDe = (g: number, k: number) => (base.indicesPct[k] < 0 ? 0 : base.pct[g * base.pasPct + base.indicesPct[k]]);
  const W = new Int32Array(m * nB);
  for (let g = 0; g < nB; g++) for (let kk = 0; kk < m; kk++) W[g * m + kk] = c.pct[kk] ? c.b[kk] * pctDe(g, kk) + 100 * base.flat[g * m + kk] : base.flat[g * m + kk];
  const tri = new Int32Array(m * nB);
  const perm = new Int32Array(m * nB);
  const debutBlocs = new Int32Array(bucketsB.length + 1);
  for (let i = 0; i < bucketsB.length; i++) debutBlocs[i + 1] = debutBlocs[i] + Math.ceil((base.debut[i + 1] - base.debut[i]) / TAILLE_BLOC);
  const nBlocs = debutBlocs[bucketsB.length];
  const blocMin = new Int32Array(m * nBlocs);
  const blocMax = new Int32Array(m * nBlocs);
  const debutBlocsTri = new Int32Array(bucketsB.length + 1);
  for (let i = 0; i < bucketsB.length; i++) debutBlocsTri[i + 1] = debutBlocsTri[i] + Math.ceil((base.debut[i + 1] - base.debut[i]) / TAILLE_BLOC_TRI);
  const nBlocsTri = debutBlocsTri[bucketsB.length];
  const triBlocMin = new Int32Array(m * nBlocsTri * m);
  const triBlocMax = new Int32Array(m * nBlocsTri * m);
  for (let i = 0; i < bucketsB.length; i++) {
    const off = base.debut[i];
    const n = base.debut[i + 1] - off;
    const nbTri = debutBlocsTri[i + 1] - debutBlocsTri[i];
    for (let kk = 0; kk < m; kk++) {
      const seg = m * off + kk * n;
      const idx = Array.from({ length: n }, (_, j) => j);
      idx.sort((x, y) => W[(off + x) * m + kk] - W[(off + y) * m + kk] || x - y);
      for (let p = 0; p < n; p++) {
        perm[seg + p] = idx[p];
        tri[seg + p] = W[(off + idx[p]) * m + kk];
      }
      const segTri = m * debutBlocsTri[i] + kk * nbTri;
      for (let blk = 0; blk < nbTri; blk++) {
        const fin = Math.min(n, (blk + 1) * TAILLE_BLOC_TRI);
        for (let k = 0; k < m; k++) {
          let lo = Infinity;
          let hi = -Infinity;
          for (let p = blk * TAILLE_BLOC_TRI; p < fin; p++) {
            const w = W[(off + idx[p]) * m + k];
            if (w < lo) lo = w;
            if (w > hi) hi = w;
          }
          triBlocMin[(segTri + blk) * m + k] = lo;
          triBlocMax[(segTri + blk) * m + k] = hi;
        }
      }
      for (let blk = 0; blk * TAILLE_BLOC < n; blk++) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let j = blk * TAILLE_BLOC; j < Math.min(n, (blk + 1) * TAILLE_BLOC); j++) {
          const w = W[(off + j) * m + kk];
          if (w < lo) lo = w;
          if (w > hi) hi = w;
        }
        blocMin[(debutBlocs[i] + blk) * m + kk] = lo;
        blocMax[(debutBlocs[i] + blk) * m + kk] = hi;
      }
    }
  }
  return { cles, m, A, B: { ...base, W, tri, perm, debutBlocs, blocMin, blocMax, debutBlocsTri, triBlocMin, triBlocMax } };
}

/* --------------------------------------------------------------------------
 * Espaces, comparaison, comptes
 * ----------------------------------------------------------------------- */

interface Espace { nom: string; params: SearchParams; prepared: PreparedSearch; bucketsA: Compartiment[]; bucketsB: Compartiment[]; total: number }

function espaces(): Espace[] {
  const out: Espace[] = [];
  for (let s = 0; out.length < 8 && s < 300; s++) {
    const rng = mulberry32(27_000 + s);
    const pool = randomPool(rng, 6 + Math.floor(rng() * 5), SETS_JOKER);
    const minStats: BuildRequirement['minStats'] = { spd: 110 + Math.floor(rng() * 50) };
    if (rng() < 0.5) minStats.cr = 30 + Math.floor(rng() * 30);
    if (rng() < 0.4) minStats.hp = 12_000 + Math.floor(rng() * 4000);
    const maxStats: NonNullable<BuildRequirement['maxStats']> = rng() < 0.4 ? { def: 900 + Math.floor(rng() * 400) } : {};
    const requirement: BuildRequirement = { sets: rng() < 0.5 ? [SETS_JOKER[Math.floor(rng() * (SETS_JOKER.length - 1))]] : [], minStats, maxStats };
    const params: SearchParams = { base: BASE, artifacts: [], pool, requirement, metric: 'eff', maxMs: Infinity, maxCollected: Infinity, slotFilterCap: 80 };
    const prepared = prepareSearch(params);
    if (!prepared) continue;
    const objetA: Bucket[] = drain(construireMoitie('A', [0, 1, 2], prepared, prepared.maxSetsForA));
    const objetB: Bucket[] = drain(construireMoitie('B', [3, 4, 5], prepared, prepared.maxSetsForB));
    const total = totalPairCount(prepared, objetA, objetB);
    if (total < 500 || total > 3_000_000 || objetA.length < 2 || objetB.length < 2) continue;
    // Une moitié sur deux en colonnes typées (le chemin de l'écran), l'autre en objets (les outils).
    const typees = out.length % 2 === 1;
    const bucketsA: Compartiment[] = typees ? typerCompartiments(objetA) : objetA;
    const bucketsB: Compartiment[] = typees ? typerCompartiments(objetB) : objetB;
    out.push({ nom: `espace ${s} (${typees ? 'colonnes' : 'objets'}, ${objetA.length}×${objetB.length} compartiments, ${total} paires)`, params, prepared, bucketsA, bucketsB, total });
  }
  return out;
}

/** Le premier écart entre deux valeurs (tableaux typés élément par élément, `Object.is`), ou `null`. */
function ecart(a: unknown, b: unknown, chemin = ''): string | null {
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.constructor !== b.constructor) return `${chemin} : types différents`;
    const x = a as unknown as ArrayLike<number>;
    const y = b as unknown as ArrayLike<number>;
    if (x.length !== y.length) return `${chemin} : longueurs ${x.length} ≠ ${y.length}`;
    for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return `${chemin}[${i}] : ${x[i]} ≠ ${y[i]}`;
    return null;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return `${chemin} : longueurs différentes`;
    for (let i = 0; i < a.length; i++) { const d = ecart(a[i], b[i], `${chemin}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return `${chemin} : clés ${ka} ≠ ${kb}`;
    for (const k of ka) { const d = ecart((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${chemin}.${k}`); if (d) return d; }
    return null;
  }
  return Object.is(a, b) ? null : `${chemin} : ${String(a)} ≠ ${String(b)}`;
}
const identique = (a: unknown, b: unknown, libelle: string) => { const d = ecart(a, b); ok(d === null, d === null ? libelle : `${libelle} — ${d}`); };

/** Les mêmes compartiments, dont chaque lecture de demi-build (`lireCombo` lit `relevance` une fois) est comptée. */
function comptes(buckets: CompartimentType[]): { buckets: CompartimentType[]; lectures: () => number } {
  let n = 0;
  return {
    buckets: buckets.map((b) => ({ ...b, combos: new Proxy(b.combos, { get: (t, k, r) => { if (k === 'relevance') n++; return Reflect.get(t, k, r); } }) })),
    lectures: () => n,
  };
}

/** Un demi-build B modifié (copie) sur la stat contrainte `cle` : un pourcentage fractionnaire, ou assez grand pour sortir `W` de l'Int32. */
function avecValeurB(b: CompartimentType[], cle: StatKey, valeur: number): CompartimentType[] | null {
  for (let i = 0; i < b.length; i++) {
    const c = b[i].combos;
    const k = c.cles.indexOf(cle);
    if (k < 0 || c.length === 0) continue;
    const pct = c.pct.slice();
    pct[k] = valeur;
    return b.map((x, j) => (j === i ? { ...x, combos: { ...c, pct } } : x));
  }
  return null;
}

export default async function testSerieCoordinateur(): Promise<void> {
  titre('Série du coordinateur · relevé des lignes, plan, contrat et encodage contre les boucles d’avant');
  const liste = espaces();
  ok(liste.length >= 6, `${liste.length} espaces construits par la construction de production (objets et colonnes)`);
  for (const e of liste) {
    const releve = releverLignes(e.prepared, e.bucketsA, e.bucketsB);
    egal(releve.total, e.total, `${e.nom} : le relevé compte totalPairCount`);
    egal(compterPaires(e.prepared, e.bucketsA, e.bucketsB), e.total, `${e.nom} : compterPaires = totalPairCount`);
    for (const cible of [1, 97, Math.ceil(e.total / 29), Math.ceil(e.total / 7), e.total, e.total + 1]) {
      const attendu = planOracle(e.prepared, e.bucketsA, e.bucketsB, cible);
      identique(planifierMorceaux(e.prepared, e.bucketsA, e.bucketsB, cible, releve), attendu,
        `${e.nom}, cible ${cible} : plan sur le relevé = plan d’avant, octet pour octet (${attendu.length} morceaux)`);
      identique(planifierMorceaux(e.prepared, e.bucketsA, e.bucketsB, cible), attendu, `${e.nom}, cible ${cible} : plan sans relevé fourni = plan d’avant`);
    }
    const plan = planifierMorceaux(e.prepared, e.bucketsA, e.bucketsB, 97, releve);
    ok(plan.every((m, i) => i === 0 || m.drapeaux.buffer !== plan[i - 1].drapeaux.buffer) && plan.every((m) => m.drapeaux.buffer !== releve.drapeaux.buffer),
      `${e.nom} : chaque morceau possède ses drapeaux (tampon propre, transférable)`);
    egal(verifierContrat(e.prepared, e.bucketsA, e.bucketsB), contratOracle(e.prepared, e.bucketsA, e.bucketsB), `${e.nom} : verifierContrat = contrat d’avant`);
    const r = verifierEtEncoder(e.prepared, e.bucketsA, e.bucketsB);
    egal(r.motifContrat, null, `${e.nom} : contrat tenu`);
    identique(r.compartiments, encodageOracle(e.prepared, e.bucketsA, e.bucketsB), `${e.nom} : encodage en une lecture = encodage d’avant (toutes les colonnes)`);
    identique(encoderCompartiments(e.prepared, e.bucketsA, e.bucketsB), r.compartiments, `${e.nom} : encoderCompartiments = verifierEtEncoder`);

    // L'appariement séquentiel, avec l'espace analysé ou sans : même résultat, mêmes comptes.
    const sans = drain(apparierRapide(e.prepared, e.bucketsA, e.bucketsB));
    const avec = drain(apparierRapide(e.prepared, e.bucketsA, e.bucketsB, { espace: analyserEspace(e.prepared, e.bucketsA, e.bucketsB) }));
    const resume = (x: typeof sans) => [x.candidates.map((c) => c.runeIds.join(',') + ':' + c.effTotal), x.explored, x.truncated, x.nearMissByCondition, x.globalNearMiss, x.traitees, x.visitees, x.compteurs];
    identique(resume(avec), resume(sans), `${e.nom} : apparierRapide avec l’espace analysé = sans (${sans.candidates.length} candidats)`);
  }

  titre('Série du coordinateur · motifs de repli identiques hors contrat');
  // Un espace en colonnes dont une contrainte porte sur PV, ATQ ou DEF (seules stats dont `W` peut déborder).
  const clePct = (x: Espace) => constantesNoyau(x.prepared).cles.find((k) => k === 'hp' || k === 'atk' || k === 'def');
  const e = liste.find((x) => !Array.isArray(x.bucketsB[0].combos) && clePct(x) !== undefined)!;
  ok(e !== undefined, 'un espace en colonnes contraint sur PV, ATQ ou DEF');
  const typeA = e.bucketsA as CompartimentType[];
  const typeB = e.bucketsB as CompartimentType[];
  const fraction = avecValeurB(typeB, clePct(e)!, 12.5);
  const debordement = avecValeurB(typeB, clePct(e)!, 200_000);
  const cas: { nom: string; prepared: PreparedSearch; A: Compartiment[]; B: Compartiment[] }[] = [
    { nom: 'traceur', prepared: { ...e.prepared, traceur: { runeIds: [1, 2, 3, 4, 5, 6] } } as PreparedSearch, A: typeA, B: typeB },
    { nom: 'base fractionnaire', prepared: { ...e.prepared, base: { ...e.prepared.base, spd: 100.5 } }, A: typeA, B: typeB },
    { nom: 'minimum non fini', prepared: { ...e.prepared, minEntries: [...e.prepared.minEntries, { k: 'spd', min: Number.NaN }] }, A: typeA, B: typeB },
    ...(fraction ? [{ nom: 'demi-build B fractionnaire', prepared: e.prepared, A: typeA, B: fraction }] : []),
    ...(debordement ? [{ nom: 'W hors Int32', prepared: e.prepared, A: typeA, B: debordement }] : []),
  ];
  ok(cas.length === 5, `cinq motifs exercés (${cas.map((c) => c.nom).join(', ')})`);
  for (const c of cas) {
    const attendu = contratOracle(c.prepared, c.A, c.B);
    ok(attendu !== null, `${c.nom} : l’oracle refuse (${attendu})`);
    egal(verifierContrat(c.prepared, c.A, c.B), attendu, `${c.nom} : même motif par verifierContrat`);
    const r = verifierEtEncoder(c.prepared, c.A, c.B);
    egal([r.motifContrat, r.compartiments], [attendu, null], `${c.nom} : même motif par verifierEtEncoder, rien d’encodé`);
    let leve = false;
    try { encoderCompartiments(c.prepared, c.A, c.B); } catch { leve = true; }
    ok(leve, `${c.nom} : encoderCompartiments refuse d’encoder hors contrat`);
  }
  let garde = false;
  try {
    drain(apparierRapide({ ...e.prepared, traceur: { runeIds: [1, 2, 3, 4, 5, 6] } } as PreparedSearch, e.bucketsA, e.bucketsB, { espace: analyserEspace(e.prepared, e.bucketsA, e.bucketsB) }));
  } catch { garde = true; }
  ok(garde, 'un espace analysé sans traceur est refusé pour une préparation qui le porte (le traceur demande pairBuckets)');

  titre('Série du coordinateur · travail retiré, en lectures de demi-build');
  for (const x of liste.filter((y) => !Array.isArray(y.bucketsA[0].combos))) {
    const ca = comptes(x.bucketsA as CompartimentType[]);
    const cb = comptes(x.bucketsB as CompartimentType[]);
    const NA = (x.bucketsA as CompartimentType[]).reduce((s, b) => s + b.combos.length, 0);
    const NB = (x.bucketsB as CompartimentType[]).reduce((s, b) => s + b.combos.length, 0);
    const lu = () => ca.lectures() + cb.lectures();
    const lignes = releverLignes(x.prepared, x.bucketsA, x.bucketsB).drapeaux.length;
    let avant = lu();
    const espace = analyserEspace(x.prepared, ca.buckets, cb.buckets);
    egal(lu() - avant, lignes + NA + NB, `${x.nom} : analyserEspace lit ${lignes} lignes puis chaque demi-build une fois (${NA} + ${NB})`);
    avant = lu();
    planifierMorceaux(x.prepared, ca.buckets, cb.buckets, 97, espace.releve);
    egal(lu() - avant, 0, `${x.nom} : le plan découpé sur le relevé ne relit aucun demi-build`);
    avant = lu();
    planOracle(x.prepared, ca.buckets, cb.buckets, 97);
    egal(lu() - avant, lignes, `${x.nom} : (l’oracle du plan relisait ${lignes} lignes)`);
  }
}
