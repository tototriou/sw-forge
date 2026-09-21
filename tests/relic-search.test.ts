// Lot 5a (implementation-relique) — l'option A dans le moteur : bornes,
// faisabilité, transport du contexte, refus, instrumentation.
//
// Ce que ce fichier PROUVE : la relaxation est sûre LOCALEMENT — bornes
// orientées (garantie C), aucun faux négatif au test de faisabilité,
// contexte transporté, refus sur pool vide, rétention observable. Ce qu'il
// ne prouve PAS : l'optimum final de l'option A (résolution exacte = lot 5b,
// différentiel complet contre l'oracle = B.5b/B.6).
//
// Référence de contrôle (`algo-verify`) : `oracleSearch` (scripts/lib/
// relicOracle.ts) — N recherches du moteur d'avant, une par principale
// éligible distincte, relique FIXÉE, sans aucune des éliminations que ce lot
// introduit. Chaque fixture compare le moteur relâché à cet oracle par le
// candidat TRACEUR (`SearchParams.traceur`) : le verdict de chaque prédicat
// est PRODUIT DANS LE MOTEUR, jamais rejoué ici.
//
// Les neuf fixtures (A–H + F bis) sont ÉCRITES À LA MAIN, déterministes —
// aucune graine, aucun tirage : le moteur n'a pas d'aléa (A.6 bis).
//
// Classes de résultat par fixture (B.5a, « Preuve ») :
//   (i)  le verdict de chaque point avec la borne est AU MOINS AUSSI
//        permissif que celui de l'oracle avec la relique fixe ;
//   (ii) le build optimal de l'oracle ENTRE dans la recherche relâchée (aucun
//        prédicat de faisabilité ne le rejette) ;
//   (iii) s'il SORT ensuite par une structure bornée → signal « dilution »,
//        consigné, pas un échec ; arrêté par le budget → « tronqué ».
//   Échec (pas de commit) : un prédicat qui rejette l'optimum (faux négatif).

import { BaseStats, RelicDetail, RuneDetail } from '../src/types';
import { computeStats } from '../src/lib/stats';
import { resoudreContexteRelique, RelicContext } from '../src/lib/relicOptim';
import type { RelicIntent } from '../src/hooks/useOptimizerState';
import {
  BuildRequirement,
  RechercheRefusee,
  SearchParams,
  SearchResult,
  TraceCandidat,
  buildBuckets,
  diagnoseFeasibility,
  prepareSearch,
  rankBlockingConditions,
  respecteConditionsAvecRelique,
  respecteMinEtMax,
  searchBuilds,
} from '../src/lib/runeBuildOptim';
import { drain } from '../scripts/lib/drain';
import { oracleSearch, oracleSearchRuns } from '../scripts/lib/relicOracle';
import { prepareOrRefuse } from '../src/workers/prepareForSearch';
import { egal, ok, titre } from './outils';

/* --------------------------------------------------------------------------
 * Constructeurs — runes et reliques écrites à la main
 * ----------------------------------------------------------------------- */

// Codes de stat de rune (effects.ts) : 2 PV %, 4 ATQ %, 6 DEF %, 8 VIT,
// 9 Taux Crit, 10 Dmg Crit. Sets `violent`/`will` : aucun bonus de stat
// (SET_STAT_BONUS), donc `guaranteed`/`guaranteedMin` restent nuls et les
// totaux se lisent directement : `B + ceil(B × (R + L) / 100)`.
function rune(id: number, slot: number, main: [number, number], subs: [number, number][] = [], set = 'violent'): RuneDetail {
  return { id, slot, set, rank: 6, rarity: 5, level: 15, main: { code: main[0], value: main[1] }, subs: subs.map(([code, value]) => ({ code, value })) };
}

function relique(id: number, code: 100 | 101 | 102, value: number, type = 1, upgrade = 6): RelicDetail {
  return { id, upgrade, main: { code, value }, unique: { type, tranche: 100, percent: 1 } };
}

const BASE: BaseStats = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

const LIBRE: RelicIntent = { mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 };

function contexte(intention: RelicIntent, equipee: RelicDetail | undefined, inventaire: RelicDetail[]): RelicContext {
  return resoudreContexteRelique(intention, equipee, inventaire);
}

function params(pool: RuneDetail[], requirement: BuildRequirement, extra: Partial<SearchParams> = {}): SearchParams {
  return {
    base: BASE,
    artifacts: [],
    pool,
    requirement,
    metric: 'eff',
    objective: 'efficience',
    maxMs: Number.POSITIVE_INFINITY,
    slotFilterCap: 80,
    ...extra,
  };
}

// Six runes, une par slot, à partir d'un gabarit — `variante(k)` produit la
// rune du slot k (1..6).
function six(idBase: number, variante: (slot: number, id: number) => RuneDetail): RuneDetail[] {
  return [1, 2, 3, 4, 5, 6].map((slot) => variante(slot, idBase + slot));
}

function cle(runeIds: number[]): string {
  return runeIds.join(',');
}

function cles(candidats: { runeIds: number[] }[]): string[] {
  return [...new Set(candidats.map((c) => cle(c.runeIds)))].sort();
}

/* --------------------------------------------------------------------------
 * Projection algorithmique canonique (A.6 bis) — ce qui se compare octet
 * pour octet : candidats dans l'ordre rendu (ids, rid, stats, score), N,
 * population par compartiment, statut tronqué ; JSON à clés triées ; jamais
 * un temps.
 * ----------------------------------------------------------------------- */

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

function populations(p: SearchParams): { A: number[]; B: number[] } | null {
  const prepared = prepareSearch(p);
  if (!prepared) return null;
  const A = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA)).map((b) => b.combos.length);
  const B = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB)).map((b) => b.combos.length);
  return { A, B };
}

export function projectionCanonique(p: SearchParams): string {
  const r = searchBuilds(p);
  return stableStringify({
    candidats: r.candidates.map((c) => ({ runeIds: c.runeIds, rid: null, stats: c.stats, score: c.effTotal })),
    N: 1,
    populations: populations(p),
    tronque: r.truncated,
    explored: r.explored,
  });
}

/* --------------------------------------------------------------------------
 * La comparaison (i)/(ii)/(iii) par le traceur
 * ----------------------------------------------------------------------- */

type Signal = { fixture: string; classe: 'dilution' | 'tronqué'; detail: string };
const signaux: Signal[] = [];

function presentes(t: TraceCandidat, etage: string): boolean[] {
  return t.preparation.find((e) => e.etage === etage)?.presentes ?? [];
}

// Les prédicats de FAISABILITÉ traversés par le traceur, dans l'ordre. Les
// structures bornées (`filterslot`, tranches, budget) ne sont pas des
// prédicats : elles relèvent de (iii).
const PREDICATS = ['bucketPairFeasibleMin', 'comboAFeasible', 'quickOkMin', 'quickOkMax', 'validationFinale'] as const;

function verifierFixture(
  nom: string,
  relache: SearchParams,
  ctx: RelicContext,
  attendu?: { optimumRunes?: number[]; rid?: number; N?: number }
): { oracle: ReturnType<typeof oracleSearch>; relaxed: SearchResult; trace: TraceCandidat } {
  const avecContexte = { ...relache, relicContext: ctx };
  const oracle = oracleSearch(avecContexte, ctx);
  ok(oracle.optimum != null, `${nom} : l'oracle a un optimum`);
  if (attendu?.N != null) egal(oracle.N, attendu.N, `${nom} : N = ${attendu.N} recherches oracle`);
  const optimum = oracle.optimum!;
  if (attendu?.optimumRunes) egal(optimum.runeIds, attendu.optimumRunes, `${nom} : l'optimum oracle est le build attendu`);
  if (attendu?.rid != null) egal(oracle.rid, attendu.rid, `${nom} : le rid de l'optimum oracle est ${attendu.rid}`);

  // Le moteur relâché, traceur = l'optimum de l'oracle.
  const relaxed = searchBuilds({ ...avecContexte, traceur: { runeIds: optimum.runeIds } });
  const trace = relaxed.traceur!;
  ok(trace != null, `${nom} : le moteur relâché rend la trace du candidat traceur`);

  // Le moteur d'avant, relique fixée à celle de l'optimum, même traceur —
  // le point de comparaison de (i).
  const reliqueOptimum = ctx.eligibles.find((r) => r.id === oracle.rid);
  const fixe = searchBuilds({ ...relache, relic: reliqueOptimum, relicContext: undefined, traceur: { runeIds: optimum.runeIds } });
  const traceFixe = fixe.traceur!;

  // (i) — préparation : ce que la relique fixe garde, la borne le garde.
  for (const etage of ['mainstat', 'dominance', 'feasibility', 'filterslot'] as const) {
    const r = presentes(trace, etage);
    const f = presentes(traceFixe, etage);
    ok(f.every((p, i) => !p || r[i]), `${nom} (i) : étage ${etage} — la borne est au moins aussi permissive que la relique fixe`);
  }
  // (i) — appariement : sur chaque prédicat vu des DEUX côtés.
  for (const pred of PREDICATS) {
    const r = trace.appariement[pred];
    const f = traceFixe.appariement[pred];
    if (r == null || f == null) continue;
    ok(!f || r, `${nom} (i) : ${pred} — la borne est au moins aussi permissive que la relique fixe`);
  }

  // (ii) — aucun prédicat de faisabilité ne rejette l'optimum.
  ok(presentes(trace, 'feasibility').every(Boolean), `${nom} (ii) : eliminateInfeasible garde les 6 runes de l'optimum`);
  for (const pred of PREDICATS) {
    const v = trace.appariement[pred];
    if (v != null) ok(v, `${nom} (ii) : ${pred} accepte l'optimum`);
  }
  ok(trace.appariement.satisfiesSets !== false && trace.appariement.jokers !== false && trace.appariement.missingSets !== false,
    `${nom} (ii) : aucun prédicat de set n'écarte l'optimum`);

  // (iii) — sorti par une structure bornée, ou par le budget ?
  if (!trace.appariement.collecte) {
    const filtre = presentes(trace, 'filterslot');
    const evinceA = trace.moities.A?.retenue === false;
    const evinceB = trace.moities.B?.retenue === false;
    if (filtre.some((p) => !p) || evinceA || evinceB) {
      const detail = filtre.some((p) => !p)
        ? `filterSlot : runes ${optimum.runeIds.filter((_, i) => !filtre[i]).join(',')} hors du pool filtré`
        : `moitié ${evinceA ? 'A' : 'B'} évincée du compartiment (` +
          `${(evinceA ? trace.moities.A : trace.moities.B)!.tranches?.map((t) => `${t.nom} ${t.retenue ? 'garde' : 'évince'} ${t.taille}/${t.cap}`).join(' ; ') ?? 'tranches non observées'})`;
      signaux.push({ fixture: nom, classe: 'dilution', detail });
      ok(true, `${nom} (iii) : signal « dilution » consigné — ${detail}`);
    } else if (trace.budget.tronque && !trace.appariement.paireAtteinte) {
      signaux.push({ fixture: nom, classe: 'tronqué', detail: `budget ${trace.budget.motif}` });
      ok(true, `${nom} (iii) : signal « tronqué » consigné (${trace.budget.motif})`);
    } else {
      ok(false, `${nom} (iii) : l'optimum n'est pas collecté sans qu'aucune structure bornée ni le budget ne l'explique — ${JSON.stringify(trace)}`);
    }
  } else {
    ok(relaxed.candidates.some((c) => cle(c.runeIds) === cle(optimum.runeIds)), `${nom} : l'optimum de l'oracle est dans les candidats relâchés`);
  }
  return { oracle, relaxed, trace };
}

/* --------------------------------------------------------------------------
 * Les fixtures
 * ----------------------------------------------------------------------- */

export default function testRelicSearch() {
  titre('Optimizer · recherche relique (lot 5a — bornes, faisabilité, transport)');

  /* ── Identité sans relique / mode off / mode equipped : projection
   * canonique byte-identique. Le même pool qu'une fixture (A) ; l'équipée est
   * `SearchParams.relic`, le contexte ne fait que la documenter. */
  {
    const o = (slot: number, id: number) => rune(id, slot, [4, 63], [[10, 35]]);
    const p = (slot: number, id: number) => rune(id, slot, [6, 63], [], 'will');
    const pool = [...six(100, o), ...six(200, p)];
    const equipee = relique(901, 102, 14);
    const req: BuildRequirement = { sets: [], minStats: { def: 684 } };
    const sans = params(pool, req, { relic: equipee });
    const proj = projectionCanonique(sans);
    const off = projectionCanonique({ ...sans, relicContext: contexte({ mode: 'off', principale: 'equipped', type: 'libre', seuil: 6 }, equipee, [equipee]) });
    const equipped = projectionCanonique({ ...sans, relicContext: contexte({ mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, equipee, [equipee]) });
    ok(proj === off, 'identité : mode off = projection byte-identique au moteur sans contexte');
    ok(proj === equipped, 'identité : mode equipped = projection byte-identique au moteur sans contexte');
    // Sans relique portée et mode equipped (vide: 'equipee') : pas de refus,
    // byte-identique au moteur sans relique.
    const sansRelique = params(pool, { sets: [], minStats: {} });
    const equippedVide = contexte({ mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, undefined, [equipee]);
    egal(equippedVide.vide, 'equipee', 'identité : mode equipped sans relique portée → vide equipee');
    ok(projectionCanonique(sansRelique) === projectionCanonique({ ...sansRelique, relicContext: equippedVide }), 'identité : mode equipped sans relique portée ne refuse pas et reste byte-identique');
    // Reproductibilité : deux passes, même entrée → même projection.
    ok(projectionCanonique(sans) === proj, 'reproductibilité : deux passes identiques sur la même fixture');
  }

  /* ── Refus nommé : pool vide en mode recherche. */
  {
    const pool = [...six(100, (slot, id) => rune(id, slot, [4, 63]))];
    const vide = contexte(LIBRE, undefined, []);
    egal(vide.vide, 'inventaire', 'refus : inventaire vide → vide inventaire');
    let refus: unknown = null;
    try {
      searchBuilds({ ...params(pool, { sets: [], minStats: {} }), relicContext: vide });
    } catch (e) {
      refus = e;
    }
    ok(refus instanceof RechercheRefusee, 'refus : RechercheRefusee levée par prepareSearch');
    egal((refus as RechercheRefusee).vide, 'inventaire', 'refus : le motif transporte le vide de B.3');
    egal((refus as RechercheRefusee).motif, 'relique-pool-vide', 'refus : motif nommé');
    const seuil = contexte({ ...LIBRE, seuil: 9 }, undefined, [relique(1, 100, 9, 1, 6)]);
    egal(seuil.vide, 'seuil', 'refus : seuil trop haut → vide seuil');
    let refusSeuil: unknown = null;
    try {
      searchBuilds({ ...params(pool, { sets: [], minStats: {} }), relicContext: seuil });
    } catch (e) {
      refusSeuil = e;
    }
    ok(refusSeuil instanceof RechercheRefusee && /seuil/.test((refusSeuil as Error).message), 'refus : le message nomme le seuil');
  }

  /* ── Refus nommé sur le protocole du Worker (B.5a ter, commit 1 — sonde
   * navigateur de la revue rejouée en Node) : `prepareOrRefuse`
   * (`prepareForSearch.ts`) est la fonction extraite du handler
   * `self.onmessage`, neutre et testable ici SANS `self` — un appel direct
   * à `prepareSearch` dans le handler transformait ce refus en rejet de
   * promesse non géré (BLOQUANT 1 : ni message posté, ni `Worker.onerror`,
   * l'UI restait bloquée en `'running'`). */
  {
    const pool = [...six(100, (slot, id) => rune(id, slot, [4, 63]))];
    const vide = contexte(LIBRE, undefined, []);
    const refusProtocole = prepareOrRefuse({ ...params(pool, { sets: [], minStats: {} }), relicContext: vide });
    egal(refusProtocole.kind, 'refus', 'protocole Worker : pool vide → refus nommé, jamais une exception qui s’échappe');
    if (refusProtocole.kind === 'refus') {
      egal(refusProtocole.motif, 'relique-pool-vide', 'protocole Worker : motif nommé');
      egal(refusProtocole.vide, 'inventaire', 'protocole Worker : vide transporté');
    }
    const normal = prepareOrRefuse(params(pool, { sets: [], minStats: {} }));
    ok(normal.kind === 'prepared', 'protocole Worker : sans refus → préparation normale');
  }

  /* ── L'oracle ne consomme jamais le contexte (garantie E). */
  {
    const pool = [...six(100, (slot, id) => rune(id, slot, [4, 63]))];
    const ctx = contexte(LIBRE, undefined, [relique(1, 100, 14), relique(2, 102, 14)]);
    const runs = oracleSearchRuns({ ...params(pool, { sets: [], minStats: {} }), relicContext: ctx }, ctx);
    ok(runs.every((r) => r.params.relicContext === undefined), 'oracle : chaque run efface relicContext (garantie E)');
    egal(runs.length, 2, 'oracle : N = 2 valeurs distinctes');
  }

  /* ── Le filtre final exact : candidate = équipée → stats identiques ;
   * minimums ET maximums. */
  {
    const runes = six(100, (slot, id) => rune(id, slot, [4, 63]));
    const equipee = relique(901, 101, 14);
    const gear = { base: BASE, runes, artifacts: [], relic: equipee };
    const { stats, respecte } = respecteConditionsAvecRelique(gear, equipee, { minStats: {} });
    egal(stats, computeStats(gear), 'filtre final : candidate = équipée → stats identiques à computeStats');
    ok(respecte, 'filtre final : sans condition, respecte');
    const atk = stats.find((s) => s.key === 'atk')!.total;
    ok(respecteConditionsAvecRelique(gear, equipee, { minStats: { atk }, maxStats: { atk } }).respecte, 'filtre final : min = max = total exact → respecte');
    ok(!respecteConditionsAvecRelique(gear, equipee, { minStats: { atk: atk + 1 } }).respecte, 'filtre final : minimum dépassé d’un point → rejeté');
    ok(!respecteConditionsAvecRelique(gear, equipee, { minStats: {}, maxStats: { atk: atk - 1 } }).respecte, 'filtre final : MAXIMUM dépassé d’un point → rejeté (T11 : le pendant artéfacts ne le fait pas)');
    // Remplacement, jamais cumul : la candidate REMPLACE `gear.relic`.
    const autre = relique(902, 100, 14);
    const avecAutre = respecteConditionsAvecRelique(gear, autre, { minStats: {} }).stats;
    egal(avecAutre, computeStats({ ...gear, relic: autre }), 'filtre final : la candidate remplace la relique portée (jamais cumul)');
    ok(respecteMinEtMax(stats, { minStats: {}, maxStats: {} }), 'respecteMinEtMax : aucune condition → vrai');
  }

  /* ── Fixture A — principale HORS objectif nécessaire à un minimum :
   * survie par le minimum DEF 684 = 600 + ceil(600 × 14 / 100), atteignable
   * par le build optimum SEULEMENT avec la DEF % +14 — les runes ATQ % +
   * Dmg Crit sont les plus efficientes sous l'objectif Efficience de cette
   * fixture. Repli documenté (revue adversariale du diff du lot 5a, MAJEUR ;
   * B.5a ter, commit 3) : le nom d'origine annonçait un conflit
   * objectif ATQ / minimum DEF que `objective: 'efficience'` n'exerce pas
   * (`dimensionsRetenues` ne retient que `def`, par le minimum) — construire
   * un `RealDamageContext` factice minimal (`objective: 'degats_reels'`)
   * dépasse quelques lignes (`SkillDamageProfile` exige un `noeud` d'AST
   * parsé, jamais écrit à la main dans ce dépôt) ; cette fixture reste donc
   * la preuve de survie par minimum SEUL, et le conflit objectif/minimum est
   * couvert par `tests/relic-optim.test.ts` (« minimum DEF actif → DEF %
   * pertinente même hors du scaling »). */
  {
    const o = (slot: number, id: number) => rune(id, slot, [4, 63], [[10, 35]]);
    const p = (slot: number, id: number) => rune(id, slot, [6, 63], [], 'will');
    const pool = [...six(100, o), ...six(200, p)];
    const inv = [relique(901, 102, 14), relique(902, 101, 14)];
    const ctx = contexte(LIBRE, undefined, inv);
    egal(ctx.bornes.max, { hp: 0, atk: 14, def: 14 }, 'A : bornes max = meilleure principale par statistique');
    egal(ctx.bornes.min, { hp: 0, atk: 0, def: 0 }, 'A : bornes min nulles en libre');
    const p0 = params(pool, { sets: [], minStats: { def: 684 } });
    const { relaxed, oracle } = verifierFixture('A', p0, ctx, { optimumRunes: [101, 102, 103, 104, 105, 106], rid: 901, N: 2 });
    // Avec la relique ATQ % fixe, l'optimum est infaisable : le moteur d'avant
    // ne le trouve pas — c'est la relaxation qui le rend candidat.
    const fixeAtq = searchBuilds({ ...p0, relic: inv[1] });
    ok(!fixeAtq.candidates.some((c) => cle(c.runeIds) === '101,102,103,104,105,106'), 'A : relique ATQ % fixe → l’optimum est absent (infaisable)');
    ok(relaxed.candidates.some((c) => cle(c.runeIds) === '101,102,103,104,105,106'), 'A : moteur relâché → l’optimum est candidat');
    // Le candidat relâché est collecté SANS relique (score non exact, 5b).
    const cand = relaxed.candidates.find((c) => cle(c.runeIds) === '101,102,103,104,105,106')!;
    egal(cand.stats.find((s) => s.key === 'def')!.total, 600, 'A : stats du candidat relâché = sans relique (la résolution exacte est 5b)');
    // Les trois consommateurs reçoivent la même borne.
    const diag = diagnoseFeasibility({ ...p0, relicContext: ctx });
    egal(diag.find((d) => d.key === 'def')?.satisfiable, true, 'A : diagnoseFeasibility avec contexte → DEF 684 atteignable');
    const diagAtq = diagnoseFeasibility({ ...p0, relic: inv[1] });
    egal(diagAtq.find((d) => d.key === 'def')?.bound, 600 + Math.ceil((600 * 378) / 100), 'A : diagnoseFeasibility relique ATQ % fixe → borne DEF sans relique');
    // Avec la relique ATQ % fixe, la DEF 684 coupe les runes ATQ % de chaque
    // slot (pool restreint à 1) ; avec la borne du contexte, les deux runes
    // survivent — même borne que la recherche, jamais plus étroite.
    egal(rankBlockingConditions({ ...p0, relicContext: ctx }).baselineMinSlot, 2, 'A : rankBlockingConditions avec contexte → 2 runes par slot survivent (même borne que la recherche)');
    // Un minimum DEF que même la borne du contexte ne couvre pas (2869 > 2868,
    // le maximum de 6 runes DEF % + DEF % +14) : les trois consommateurs le
    // voient ensemble — diagnostic « impossible », blocage à 0 rune par slot.
    const horsPortee = { ...p0, relicContext: ctx, requirement: { sets: [], minStats: { def: 600 + Math.ceil((600 * (378 + 14)) / 100) + 1 } } };
    egal(diagnoseFeasibility(horsPortee).find((d) => d.key === 'def')?.satisfiable, false, 'A : diagnoseFeasibility avec contexte → 2869 prouvé impossible (borne = 6 × 63 + 14)');
    egal(rankBlockingConditions(horsPortee).baselineMinSlot, 0, 'A : rankBlockingConditions avec contexte → 0 rune par slot sur le même seuil (même borne)');
    egal(oracle.candidats.length >= 1, true, 'A : l’oracle a des candidats');
  }

  /* ── Fixture B — deux minimums concurrents (PV ≥ 30300, DEF ≥ 1818) : la
   * borne accorde PV % +14 ET DEF % +14 à la fois ; le build O n'est faisable
   * avec AUCUNE relique seule (faux positif de la borne), le build P l'est. */
  {
    const o = (slot: number, id: number) => rune(id, slot, slot <= 3 ? [2, 63] : [6, 63], [[10, 35], [9, 30]]);
    const p = (slot: number, id: number) => rune(id, slot, slot <= 3 ? [2, 63] : [6, 63], [[2, 20], [6, 20]], 'will');
    const pool = [...six(100, o), ...six(200, p)];
    const inv = [relique(911, 100, 14), relique(912, 102, 14)];
    const ctx = contexte(LIBRE, undefined, inv);
    const p0 = params(pool, { sets: [], minStats: { hp: 30300, def: 1818 } });
    const O = [101, 102, 103, 104, 105, 106];
    const { relaxed, oracle } = verifierFixture('B', p0, ctx, { N: 2 });
    ok(!oracle.candidats.some((c) => cle(c.runeIds) === cle(O)), 'B : O n’est candidat pour aucune relique fixe (oracle)');
    ok(relaxed.candidates.some((c) => cle(c.runeIds) === cle(O)), 'B : O est un faux positif de la borne (candidat relâché)');
    const gearO = { base: BASE, runes: pool.slice(0, 6), artifacts: [] };
    for (const r of inv) ok(!respecteConditionsAvecRelique(gearO, r, p0.requirement).respecte, `B : le filtre final exact rejette O avec la relique ${r.id}`);
    ok(cles(oracle.candidats).every((k) => cles(relaxed.candidates).includes(k)), 'B : tout candidat de l’oracle est candidat relâché (aucun faux négatif)');
  }

  /* ── Fixture C — pression sur bucketCap (surchargé à 10 par le paramètre
   * de mesure `SearchParams.bucketCap`, aucune constante ne bouge).
   * O = 6 × o (DEF % 63, PV % 10, ATQ % 10), faisable SEULEMENT avec PV % +14.
   * Les runes sans DEF — f (ATQ % 63, Dmg Crit) et h (PV % 63) — n'entrent
   * dans la recherche relâchée que grâce au +14 DEF accordé EN PLUS du +14 PV
   * (borne rune : 5 × 70 + 14 = 364 → 2784 = le minimum ; sans le +14 :
   * 2700 < 2784, coupées par `eliminateInfeasible` sous PV % fixe) ; aucun
   * build qui en contient n'est faisable (ATQ ou PV manquent). Leurs
   * demi-builds, et ceux des d (DEF % 70, Dmg Crit — sans PV, infaisables),
   * remplissent les cinq tranches (générique, combinée, PV, DEF, ATQ) devant
   * la moitié de O — c'est la dilution que le lot doit OBSERVER, pas
   * corriger. L'oracle (PV % fixe, même bucketCap) retient O par sa tranche
   * combinée et sa tranche PV. */
  {
    // Variantes NON DOMINÉES entre elles (sous-stat Dmg Crit / RES /
    // Précision, chacune au maximum : même efficience) : `pruneDominated`
    // (élagage sûr) retirerait des variantes qui ne diffèrent que par une
    // valeur — il faut assez de demi-builds DISTINCTS pour remplir dix places
    // par tranche.
    const o = (slot: number, id: number) => rune(id, slot, [6, 63], [[2, 10], [4, 10]]);
    const d = (sub: [number, number]) => (slot: number, id: number) => rune(id, slot, [6, 70], [sub]);
    const f = (sub: [number, number]) => (slot: number, id: number) => rune(id, slot, [4, 63], [sub], 'will');
    const h = (sub: [number, number]) => (slot: number, id: number) => rune(id, slot, [2, 63], [sub]);
    const pool = [
      ...six(100, o),
      ...six(400, d([10, 35])), ...six(500, d([11, 40])), ...six(600, d([12, 40])),
      ...six(700, f([10, 35])), ...six(800, f([11, 40])),
      ...six(900, h([10, 35])), ...six(1000, h([11, 40])),
    ];
    const inv = [relique(911, 100, 14), relique(912, 102, 14)];
    const ctx = contexte(LIBRE, undefined, inv);
    // O : PV 10000 + ceil(10000 × (60 + 14) / 100) = 17400 avec PV % +14 ;
    // DEF 600 + ceil(600 × 378 / 100) = 2868 ; ATQ 700 + ceil(700 × 60 / 100) = 1120.
    // Minimums : PV 17400, DEF 2784 (= 5 × 70 + 14 sur une rune sans DEF), ATQ 1120.
    const p0 = params(pool, { sets: [], minStats: { hp: 17400, def: 2784, atk: 1120 } }, { bucketCap: 10 });
    const O = [101, 102, 103, 104, 105, 106];
    const { trace, oracle } = verifierFixture('C', p0, ctx, { optimumRunes: O, rid: 911, N: 2 });
    egal(presentes(trace, 'feasibility').length, 6, 'C : la trace couvre les 6 runes');
    // Le relevé de l'instrumentation sur ce cas — compteurs et tranches —
    // est recopié dans la preuve par le pilote (sortie ci-dessous).
    console.log(`  · C — trace : ${JSON.stringify({ moities: trace.moities, appariement: trace.appariement, budget: trace.budget, compteurs: trace.compteurs })}`);
    ok(oracle.candidats.some((c) => cle(c.runeIds) === cle(O)), 'C : l’oracle (relique PV % fixe, même bucketCap) retient O');
  }

  /* ── Fixture D — deux valeurs d'une même principale, toutes deux non
   * dominées (PV % +14 / exclusive non pertinente, PV % +12 / pertinente) :
   * la borne prend 14, l'oracle garde les deux valeurs (N = 2). */
  {
    const o = (slot: number, id: number) => rune(id, slot, [2, 63], [[10, 35]]);
    const p = (slot: number, id: number) => rune(id, slot, [6, 63], [], 'will');
    const pool = [...six(100, o), ...six(200, p)];
    // type 16 (Régénération) : jamais pertinente ; type 13 (Origine, PV) :
    // pertinente en PV effectifs.
    const inv = [relique(921, 100, 14, 16), relique(922, 100, 12, 13)];
    const ctx = contexte(LIBRE, undefined, inv);
    egal(ctx.bornes.max.hp, 14, 'D : la borne PV prend la plus haute valeur');
    egal(ctx.eligibles.length, 2, 'D : les deux valeurs sont éligibles (aucune dominance dans le contexte)');
    const p0 = params(pool, { sets: [], minStats: { hp: 10000 + Math.ceil((10000 * (378 + 14)) / 100) } }, { objective: 'ehp' });
    verifierFixture('D', p0, ctx, { optimumRunes: [101, 102, 103, 104, 105, 106], rid: 921, N: 2 });
  }

  /* ── Fixture E — égalités de valeurs brutes (PV, ATQ, DEF +14 %) : aucun
   * ordre d'itération ne décide — la projection relâchée et le rid oracle
   * sont les mêmes pour toute permutation de l'inventaire. */
  {
    const o = (slot: number, id: number) => rune(id, slot, [2, 63], [[6, 20]]);
    const p = (slot: number, id: number) => rune(id, slot, [6, 63], [[2, 20]], 'will');
    const pool = [...six(100, o), ...six(200, p)];
    const inv = [relique(931, 100, 14), relique(932, 101, 14), relique(933, 102, 14)];
    const p0 = params(pool, { sets: [], minStats: {} }, { objective: 'ehp' });
    const permutations = [inv, [inv[2], inv[0], inv[1]], [inv[1], inv[2], inv[0]]];
    const projections = permutations.map((inventaire) => projectionCanonique({ ...p0, relicContext: contexte(LIBRE, undefined, inventaire) }));
    ok(projections.every((s) => s === projections[0]), 'E : la projection relâchée ne dépend pas de l’ordre de l’inventaire');
    const empreintes = permutations.map((inventaire) => contexte(LIBRE, undefined, inventaire).empreinte);
    ok(empreintes.every((e) => e === empreintes[0]), 'E : l’empreinte du contexte ne dépend pas de l’ordre de l’inventaire');
    const rids = permutations.map((inventaire) => oracleSearch({ ...p0, relicContext: contexte(LIBRE, undefined, inventaire) }, contexte(LIBRE, undefined, inventaire)).rid);
    ok(rids.every((r) => r === rids[0]), `E : le rid de l’oracle ne dépend pas de l’ordre (${rids[0]})`);
    verifierFixture('E', p0, contexte(LIBRE, undefined, inv), { N: 3 });
  }

  /* ── Fixture F — minimum atteint EXACTEMENT à la frontière (arrondi ceil,
   * `>=`) : base 10007, PV % +13 → 10007 + ceil(10007 × (R + 13) / 100). */
  {
    const base: BaseStats = { ...BASE, hp: 10007 };
    const o = (slot: number, id: number) => rune(id, slot, [2, 63], [[10, 35]]);
    const p = (slot: number, id: number) => rune(id, slot, [6, 63], [], 'will');
    const pool = [...six(100, o), ...six(200, p)];
    const inv = [relique(941, 100, 13), relique(942, 100, 11)];
    const ctx = contexte(LIBRE, undefined, inv);
    const exact = 10007 + Math.ceil((10007 * (378 + 13)) / 100);
    const p0 = { ...params(pool, { sets: [], minStats: { hp: exact } }), base };
    verifierFixture('F', p0, ctx, { optimumRunes: [101, 102, 103, 104, 105, 106], rid: 941, N: 2 });
    const diag = diagnoseFeasibility({ ...p0, relicContext: ctx }).find((d) => d.key === 'hp')!;
    egal(diag.bound, exact, 'F : la borne de diagnostic vaut exactement le total réel (fusion dans le ceil, pas un ceil séparé)');
    const auDela = searchBuilds({ ...p0, relicContext: ctx, requirement: { sets: [], minStats: { hp: exact + 1 } } });
    ok(!auDela.candidates.some((c) => cle(c.runeIds) === '101,102,103,104,105,106'), 'F : un point au-dessus de la frontière → l’optimum n’est plus candidat');
    egal(diagnoseFeasibility({ ...p0, relicContext: ctx, requirement: { sets: [], minStats: { hp: exact + 1 } } }).find((d) => d.key === 'hp')!.satisfiable, false, 'F : … et le diagnostic le prouve');
  }

  /* ── Fixture F bis — branche MAXIMUM, base non multiple de 100, principale
   * forcée : B = 101, R = 1 %, Lmin = 1 %, max = 104. Réel : 101 +
   * ceil(101 × 2 / 100) = 104 faisable ; `ceil` séparé : 105 → rejeté à tort. */
  {
    const base: BaseStats = { ...BASE, atk: 101 };
    const o = (slot: number, id: number) => rune(id, slot, slot === 1 ? [4, 1] : [8, 5]);
    const pool = six(100, o);
    const inv = [relique(951, 101, 1)];
    const ctx = contexte({ mode: 'recherche', principale: 101, type: 'libre', seuil: 6 }, undefined, inv);
    egal(ctx.bornes.min.atk, 1, 'F bis : Lmin = 1 sur la statistique forcée');
    const p0 = { ...params(pool, { sets: [], minStats: {}, maxStats: { atk: 104 } }), base };
    const { trace } = verifierFixture('F bis', p0, ctx, { optimumRunes: [101, 102, 103, 104, 105, 106], rid: 951, N: 1 });
    egal(trace.appariement.quickOkMax, true, 'F bis : quickOk maximum accepte (fusion dans le ceil)');
    egal(trace.appariement.validationFinale, true, 'F bis : validation finale accepte (floor(B × Lmin / 100) = 1, 103 + 1 = 104 ≤ 104)');
    const diag = diagnoseFeasibility({ ...p0, relicContext: ctx }).find((d) => d.key === 'atk')!;
    ok(diag.satisfiable && diag.bound <= 104, `F bis : diagnostic maximum satisfiable (borne ${diag.bound} ≤ 104)`);
    // Le filtre final EXACT avec la relique réelle : 104 ≤ 104.
    ok(respecteConditionsAvecRelique({ base, runes: pool, artifacts: [] }, inv[0], p0.requirement).respecte, 'F bis : filtre final exact → 104 ≤ 104 respecte');
    // Et la preuve que le `ceil` séparé aurait rejeté : 101 + ceil(1.01) + ceil(1.01) = 105.
    egal(101 + Math.ceil(1.01) + Math.ceil(1.01), 105, 'F bis : le ceil séparé donnerait 105 > 104 (faux négatif évité)');
  }

  /* ── Fixture G — aucun minimum actif : la relaxation ne change rien à la
   * population ; candidats relâchés = candidats de l'oracle. */
  {
    const o = (slot: number, id: number) => rune(id, slot, [2, 63], [[10, 35]]);
    const p = (slot: number, id: number) => rune(id, slot, [6, 63], [], 'will');
    const pool = [...six(100, o), ...six(200, p)];
    const inv = [relique(961, 100, 14), relique(962, 102, 12)];
    const ctx = contexte(LIBRE, undefined, inv);
    const p0 = params(pool, { sets: [], minStats: {} }, { objective: 'ehp' });
    const { relaxed, oracle } = verifierFixture('G', p0, ctx, { N: 2 });
    egal(cles(relaxed.candidates), cles(oracle.candidats), 'G : mêmes candidats (ids) que l’oracle');
    egal(relaxed.candidates.length, 64, 'G : les 2⁶ builds sont candidats');
  }

  /* ── Fixture H — minimums sur VIT et Taux Crit, stats que la relique ne
   * modifie pas : aucune fausse pertinence, mêmes candidats que l'oracle,
   * mêmes verdicts de diagnostic avec ou sans contexte. */
  {
    const o = (slot: number, id: number) => rune(id, slot, [8, 20], [[9, 10]]);
    const p = (slot: number, id: number) => rune(id, slot, [2, 63], [[9, 5]], 'will');
    const pool = [...six(100, o), ...six(200, p)];
    const inv = [relique(971, 100, 14), relique(972, 101, 14), relique(973, 102, 14)];
    const ctx = contexte(LIBRE, undefined, inv);
    const p0 = params(pool, { sets: [], minStats: { spd: 100 + 6 * 20, cr: 15 + 6 * 10 } });
    const { relaxed, oracle } = verifierFixture('H', p0, ctx, { optimumRunes: [101, 102, 103, 104, 105, 106], N: 3 });
    egal(cles(relaxed.candidates), cles(oracle.candidats), 'H : mêmes candidats (ids) que l’oracle');
    egal(diagnoseFeasibility({ ...p0, relicContext: ctx }), diagnoseFeasibility(p0), 'H : diagnostic identique avec et sans contexte (VIT, Taux Crit)');
    egal(rankBlockingConditions({ ...p0, relicContext: ctx }), rankBlockingConditions(p0), 'H : blocages identiques avec et sans contexte');
  }

  /* ── Le bilan des signaux (iii), consigné pour la preuve. */
  console.log(`  · signaux (iii) : ${signaux.length === 0 ? 'aucun' : signaux.map((s) => `${s.fixture} → ${s.classe} (${s.detail})`).join(' | ')}`);
  ok(signaux.every((s) => s.classe === 'dilution' || s.classe === 'tronqué'), 'signaux : seules les classes « dilution » et « tronqué » sont admises (jamais un faux négatif)');
}

export { signaux as signauxRelicSearch };
