// Coupes SÛRES, diagnostics et rétention face aux auras propres au build
// (degats-et-aura, lot 6bis-b3b). Discipline `algo-verify` : un ORACLE
// exhaustif indépendant, sur le pool AVANT préparation, contre le vrai
// moteur (`searchBuilds`, bout en bout).
//
// ⚠️ Indépendance de l'oracle : il partage `computeStats` (fiche, aucune
// aura) et `activeSets` (sets actifs, Intangible compris), rien d'autre. Il
// compte lui-même les activations d'aura, les +8 points RES/PRE (A.2 ter),
// la satisfaction du combo demandé et les conditions min/max. Il n'appelle
// ni `aurasPropres*`, ni `pointsAuraResPre*`, ni `prepareSearch`, ni aucune
// borne ou élagage du moteur. `avecAurasConditions` ne sert qu'à construire
// l'ENTRÉE du moteur, comme l'écran et le CLI.
//
// ⚠️ Les critères « combat » de l'oracle (ATQ/DEF/PV + 8 % de base par
// aura, un ceil) sont un score SIMPLIFIÉ et monotone, pas `statsDebutCombat` :
// ils servent à comparer l'OPTIMUM du moteur à celui de l'oracle, évalués
// par la MÊME fonction des deux côtés — une dominance qui retire une rune
// Fight utile fait baisser le meilleur score, c'est tout ce qu'on mesure.

import { egal, ok, titre } from './outils';
import { activeSets, runeEfficiency } from '../src/lib/effects';
import type { StatKey } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import type { DamageSetup, SetAura } from '../src/lib/damage';
import {
  avecAurasConditions,
  diagnoseFeasibility,
  rankBlockingConditions,
  searchBuilds,
} from '../src/lib/runeBuildOptim';
import type { Objective, SearchParams, SearchResult, TraceCandidat } from '../src/lib/runeBuildOptim';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import type { BaseStats, RuneDetail } from '../src/types';

const BASE: BaseStats = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const AURAS: SetAura[] = ['fight', 'determination', 'enhance', 'accuracy', 'tolerance'];
const CLES: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];

// Rune sans principale utile (VIT +0) : seules ses sous-propriétés comptent.
function r(id: number, slot: number, set: string, subs: [number, number][] = []): RuneDetail {
  return { id, slot, set, rank: 6, rarity: 5, level: 15, main: { code: 8, value: 0 }, subs: subs.map(([code, value]) => ({ code, value })) };
}

interface Cas {
  nom: string;
  pool: RuneDetail[];
  sets: string[];
  minStats?: Partial<Record<StatKey, number>>;
  maxStats?: Partial<Record<StatKey, number>>;
  externes?: Partial<Record<SetAura, number>>;
  compter: boolean;
  // L'objectif et SES stats, toujours explicites : l'oracle n'appelle pas
  // `objectiveKeysOf`.
  objective?: Objective;
  objectiveStats?: StatKey[];
}

interface BuildOracle {
  ids: number[];
  cle: string;
  cond: Record<StatKey, number>;
  crit: Record<string, number>;
}

/* --------------------------------------------------------------------------
 * L'oracle
 * ----------------------------------------------------------------------- */

function setsSatisfaits(demandes: string[], actifs: string[]): boolean {
  const reste = new Map<string, number>();
  for (const s of actifs) reste.set(s, (reste.get(s) ?? 0) + 1);
  for (const s of demandes) {
    const n = reste.get(s) ?? 0;
    if (n <= 0) return false;
    reste.set(s, n - 1);
  }
  return true;
}

function evaluer(cas: Cas, runes: RuneDetail[]): { cond: Record<StatKey, number>; crit: Record<string, number>; setsOk: boolean } {
  const actifs = activeSets(runes.map((x) => x.set));
  const propres = {} as Record<SetAura, number>;
  for (const a of AURAS) propres[a] = actifs.filter((s) => s === a).length;
  const ext = (a: SetAura) => cas.externes?.[a] ?? 0;
  const stats = computeStats({ base: BASE, runes, artifacts: [] });
  const total = (k: StatKey) => stats.find((s) => s.key === k)?.total ?? 0;
  const cond = {} as Record<StatKey, number>;
  for (const k of CLES) cond[k] = total(k);
  if (cas.compter) {
    cond.res += 8 * (ext('tolerance') + propres.tolerance);
    cond.acc += 8 * (ext('accuracy') + propres.accuracy);
  }
  const pctBase = (k: 'hp' | 'atk' | 'def', a: SetAura) => Math.ceil((BASE[k] * 8 * (ext(a) + propres[a])) / 100);
  const crit: Record<string, number> = {
    eff: runes.reduce((s, x) => s + runeEfficiency(x), 0),
    atkCombat: total('atk') + pctBase('atk', 'fight'),
    defCombat: total('def') + pctBase('def', 'determination'),
    hpCombat: total('hp') + pctBase('hp', 'enhance'),
    resCombat: total('res') + 8 * (ext('tolerance') + propres.tolerance),
    accCombat: total('acc') + 8 * (ext('accuracy') + propres.accuracy),
    spd: total('spd'),
    cr: total('cr'),
    cd: total('cd'),
  };
  for (const k of CLES) crit[`cond.${k}`] = cond[k];
  return { cond, crit, setsOk: setsSatisfaits(cas.sets, actifs) };
}

// Les critères sur lesquels la dominance DOIT conserver l'optimum :
// l'efficience (toujours comparée), les stats des conditions (telles que les
// lisent les conditions) et celles de l'objectif (avec ses auras de combat).
// « Efficience » ou aucun objectif : TOUTES les stats (décision utilisateur
// du 2026-09-29). Un tri après coup sur une autre stat n'est pas garanti.
const CRITERE_OBJECTIF: Record<StatKey, string> = { atk: 'atkCombat', def: 'defCombat', hp: 'hpCombat', res: 'resCombat', acc: 'accCombat', spd: 'spd', cr: 'cr', cd: 'cd' };
function criteresUtiles(cas: Cas): string[] {
  const out = new Set<string>(['eff']);
  for (const [k, v] of [...Object.entries(cas.minStats ?? {}), ...Object.entries(cas.maxStats ?? {})]) if (v != null && v > 0) out.add(`cond.${k}`);
  const stats = cas.objective === undefined || cas.objective === 'efficience' ? CLES : (cas.objectiveStats ?? []);
  for (const k of stats) out.add(CRITERE_OBJECTIF[k]);
  return [...out];
}

function respecte(cas: Cas, cond: Record<StatKey, number>): boolean {
  for (const [k, v] of Object.entries(cas.minStats ?? {})) if (v != null && v > 0 && cond[k as StatKey] < v) return false;
  for (const [k, v] of Object.entries(cas.maxStats ?? {})) if (v != null && v > 0 && cond[k as StatKey] > v) return false;
  return true;
}

// Tout le produit des 6 emplacements, sur le pool BRUT (aucune préparation).
function oracle(cas: Cas): { ensembleSets: BuildOracle[]; valides: Map<string, BuildOracle>; combinaisons: number } {
  const parSlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const x of cas.pool) parSlot[x.slot - 1].push(x);
  const ensembleSets: BuildOracle[] = [];
  const valides = new Map<string, BuildOracle>();
  let combinaisons = 0;
  const choix: RuneDetail[] = [];
  const recurse = (i: number) => {
    if (i === 6) {
      combinaisons++;
      if (choix.filter((x) => x.set === 'intangible').length > 1) return; // une seule Intangible sertie
      const e = evaluer(cas, choix);
      if (!e.setsOk) return;
      const ids = choix.map((x) => x.id);
      const b: BuildOracle = { ids, cle: ids.join(','), cond: e.cond, crit: e.crit };
      ensembleSets.push(b);
      if (respecte(cas, e.cond)) valides.set(b.cle, b);
      return;
    }
    for (const x of parSlot[i]) {
      choix.push(x);
      recurse(i + 1);
      choix.pop();
    }
  };
  recurse(0);
  return { ensembleSets, valides, combinaisons };
}

/* --------------------------------------------------------------------------
 * Le moteur, et la première coupe d'un build absent
 * ----------------------------------------------------------------------- */

function parametres(cas: Cas, extra: Partial<SearchParams> = {}): SearchParams {
  const setup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    setsAuraExternes: Object.entries(cas.externes ?? {})
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([set, nombre]) => ({ set: set as SetAura, nombre: nombre! })),
  };
  const requirement = avecAurasConditions({ sets: cas.sets, minStats: cas.minStats ?? {}, maxStats: cas.maxStats }, setup, cas.compter);
  // Heuristiques NON contraignantes : pré-filtrage et rétention plus larges
  // que le pool, collecte et temps illimités en pratique.
  return { base: BASE, artifacts: [], pool: cas.pool, requirement, metric: 'eff', objective: cas.objective, objectiveStats: cas.objectiveStats, maxMs: 120000, maxCollected: 1_000_000, slotFilterCap: 200, bucketCap: 100000, ...extra };
}

// Première coupe traversée par un build (6 identifiants), lue dans la trace.
function premiereCoupe(t: TraceCandidat | undefined, tronque: boolean): string {
  if (!t) return 'trace:absente';
  for (const e of t.preparation) if (!e.presentes.every(Boolean)) return `preparation:${e.etage}`;
  for (const h of ['A', 'B'] as const) {
    const m = t.moities[h];
    if (m && !m.generee) return `moitie${h}:${m.coupee ?? 'nonGeneree'}`;
    if (m && m.retenue === false) return `moitie${h}:retention`;
  }
  const a = t.appariement;
  if (!a.paireAtteinte) return tronque ? 'troncature' : 'appariement:paireNonAtteinte';
  for (const k of ['satisfiesSets', 'jokers', 'bucketPairFeasibleMin', 'comboAFeasible', 'quickOkMin', 'quickOkMax', 'missingSets', 'validationFinale'] as const) {
    if (a[k] === false) return `appariement:${k}`;
  }
  if (!a.collecte) return tronque ? 'troncature' : 'appariement:nonCollecte';
  return 'collecte';
}

// Élagages heuristiques (sans garantie d'optimum) et retrait par dominance :
// tout le reste est une coupe SÛRE, qui ne doit jamais rejeter un build valide.
const HEURISTIQUES = new Set(['preparation:filterslot', 'moitieA:filterSlot', 'moitieB:filterSlot', 'moitieA:retention', 'moitieB:retention', 'troncature']);
const DOMINANCE = 'preparation:dominance';

interface Verdict {
  resultat: SearchResult;
  o: ReturnType<typeof oracle>;
  trouves: Set<string>;
  motifs: Map<string, number>;
  fauxRejets: string[];
  premiereCoupeDe: (cle: string) => string;
}

function lancer(cas: Cas, extra: Partial<SearchParams> = {}, traceMax = 40): Verdict {
  const o = oracle(cas);
  const p = parametres(cas, extra);
  const resultat = searchBuilds(p);
  const trouves = new Set(resultat.candidates.map((c) => c.runeIds.join(',')));
  const motifs = new Map<string, number>();
  const fauxRejets: string[] = [];
  const premiereCoupeDe = (cle: string) => {
    const tr = searchBuilds({ ...p, traceur: { runeIds: cle.split(',').map(Number) } });
    return premiereCoupe(tr.traceur, tr.truncated);
  };
  let traces = 0;
  for (const cle of o.valides.keys()) {
    if (trouves.has(cle) || traces >= traceMax) continue;
    traces++;
    const coupe = premiereCoupeDe(cle);
    motifs.set(coupe, (motifs.get(coupe) ?? 0) + 1);
    if (!HEURISTIQUES.has(coupe) && coupe !== DOMINANCE) fauxRejets.push(`${cle} → ${coupe}`);
  }
  return { resultat, o, trouves, motifs, fauxRejets, premiereCoupeDe };
}

const fmtMotifs = (m: Map<string, number>) => (m.size === 0 ? 'aucun absent' : Array.from(m, ([k, n]) => `${k}×${n}`).join(', '));

// Les invariants d'un run COMPLET face à l'oracle. `exact` : l'ensemble des
// candidats doit être celui de l'oracle (scénarios sans dominance possible).
function verifier(cas: Cas, v: Verdict, exact: boolean) {
  const { resultat, o, trouves } = v;
  egal(resultat.truncated, false, `${cas.nom} : recherche complète (explorées ${resultat.explored}, oracle ${o.combinaisons} combinaisons, ${o.valides.size} valide(s))`);
  const fauxPositifs = [...trouves].filter((c) => !o.valides.has(c));
  egal(fauxPositifs, [], `${cas.nom} : aucun faux positif`);
  egal(trouves.size > 0, o.valides.size > 0, `${cas.nom} : même verdict de faisabilité (moteur ${trouves.size}, oracle ${o.valides.size})`);
  egal(v.fauxRejets, [], `${cas.nom} : zéro faux rejet par une coupe sûre (absents : ${fmtMotifs(v.motifs)})`);
  if (exact) egal([...trouves].sort(), [...o.valides.keys()].sort(), `${cas.nom} : candidats EXACTS de l'oracle`);
  if (trouves.size > 0 && o.valides.size > 0) {
    const parCle = new Map([...o.valides.values()].map((b) => [b.cle, b]));
    for (const critere of criteresUtiles(cas)) {
      const meilleurOracle = Math.max(...[...o.valides.values()].map((b) => b.crit[critere]));
      const meilleurMoteur = Math.max(...[...trouves].map((c) => parCle.get(c)!.crit[critere]));
      ok(Math.abs(meilleurOracle - meilleurMoteur) < 1e-9, `${cas.nom} : optimum ${critere} conservé (moteur ${meilleurMoteur}, oracle ${meilleurOracle})`);
    }
  }
}

// Une cible précise : collectée, sinon sa première coupe dans le libellé.
function cibleCollectee(cas: Cas, v: Verdict, cle: string) {
  const collectee = v.trouves.has(cle);
  ok(collectee, `${cas.nom} : cible ${cle} collectée${collectee ? '' : ` — première coupe : ${v.premiereCoupeDe(cle)}`}`);
}

const V = (id: number, slot: number, subs: [number, number][] = []) => r(id, slot, 'violent', subs);
const QUATRE_VIOLENT = [V(1, 1), V(2, 2), V(3, 3), V(4, 4)];

// Sets tirés par les pools aléatoires : auras, set à bonus de fiche, sets
// sans effet et Intangible.
const SETS_DIFF = ['violent', 'will', 'shield', 'fight', 'tolerance', 'accuracy', 'blade', 'energy', 'intangible'];

function quantile(vals: number[], q: number): number {
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

/* --------------------------------------------------------------------------
 * T2 — un minimum RES/PRE que SEULE une aura propre fait tenir, sans aucune
 * marge Endure/Focus dans le pool ; un scénario isole chaque coupe sûre.
 * ----------------------------------------------------------------------- */

export function testRuneOptimAurasCoupesMinimum() {
  titre('Auras propres · minimum RES/PRE tenu par la seule aura propre (T2, bout en bout)');

  // (E) Aucune rune ne porte de RES : seule la Tolerance propre (+8) franchit
  // 23 = 15 + 8. Première coupe concernée : eliminateInfeasible.
  const tolerance: Cas = {
    nom: 'T2-E Tolerance non demandée ×2',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[1, 100]]), r(25, 5, 'will', [[3, 10]]), r(16, 6, 'tolerance', [[1, 100]]), r(26, 6, 'will', [[3, 10]])],
    sets: ['violent'], minStats: { res: 23 }, compter: true,
  };
  const vE = lancer(tolerance);
  verifier(tolerance, vE, true);
  cibleCollectee(tolerance, vE, '1,2,3,4,15,16');

  // Intangible qui complète la Tolerance (Violent tenu par quatre vraies pièces).
  const joker: Cas = {
    nom: 'T2-E Tolerance 1 + Intangible',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[1, 100]]), r(25, 5, 'will', [[3, 10]]), r(16, 6, 'intangible', [[5, 10]]), r(26, 6, 'will', [[3, 10]])],
    sets: ['violent'], minStats: { res: 23 }, compter: true,
  };
  const vJ = lancer(joker);
  verifier(joker, vJ, true);
  cibleCollectee(joker, vJ, '1,2,3,4,15,16');

  // Accuracy : PRE 0 + 8.
  const accuracy: Cas = {
    nom: 'T2-E Accuracy non demandée ×2',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'accuracy', [[1, 100]]), r(25, 5, 'will', [[3, 10]]), r(16, 6, 'accuracy', [[1, 100]]), r(26, 6, 'will', [[3, 10]])],
    sets: ['violent'], minStats: { acc: 8 }, compter: true,
  };
  const vA = lancer(accuracy);
  verifier(accuracy, vA, true);
  cibleCollectee(accuracy, vA, '1,2,3,4,15,16');

  // Avec une part externe : 1 Tolerance externe + 1 propre = 15 + 16 = 31.
  const externe: Cas = { ...tolerance, nom: 'T2-E externe 1 + propre 1', minStats: { res: 31 }, externes: { tolerance: 1 } };
  const vX = lancer(externe);
  verifier(externe, vX, true);
  cibleCollectee(externe, vX, '1,2,3,4,15,16');

  // Toggle éteint : l'aura propre ne franchit plus rien ; l'oracle et le
  // moteur n'ont aucun build, et c'est la bonne réponse.
  const eteint: Cas = { ...tolerance, nom: 'T2 toggle éteint', compter: false };
  const vO = lancer(eteint);
  verifier(eteint, vO, true);
  egal(vO.o.valides.size, 0, 'T2 toggle éteint : aucun build ne franchit RES 23 sans aura dans les conditions');

  // (P) bucketPairFeasibleMin : eliminateInfeasible passe (RES 8 sur des
  // runes Will des emplacements 1 et 2), mais les deux compartiments de la
  // cible (Violent 3 / Violent 1) n'ont aucune RES.
  const paire: Cas = {
    nom: 'T2-P coupe bucketPairFeasibleMin',
    pool: [V(1, 1), r(21, 1, 'will', [[11, 8]]), V(2, 2), r(22, 2, 'will', [[11, 8]]), V(3, 3), V(4, 4), r(15, 5, 'tolerance', [[1, 100]]), r(16, 6, 'tolerance', [[1, 100]])],
    sets: ['violent'], minStats: { res: 23 }, compter: true,
  };
  const vP = lancer(paire);
  verifier(paire, vP, true);
  cibleCollectee(paire, vP, '1,2,3,4,15,16');

  // (C) comboAFeasible : le compartiment Violent 3 contient une moitié à RES 8
  // (rune 11), celui de la cible non ; la moitié B n'a aucune RES.
  const comboA: Cas = {
    nom: 'T2-C coupe comboAFeasible',
    pool: [V(1, 1, [[3, 5]]), V(11, 1, [[11, 8]]), V(2, 2), r(22, 2, 'will', [[11, 8]]), V(3, 3), V(4, 4), r(15, 5, 'tolerance', [[1, 100]]), r(16, 6, 'tolerance', [[1, 100]])],
    sets: ['violent'], minStats: { res: 23 }, compter: true,
  };
  const vC = lancer(comboA);
  verifier(comboA, vC, true);
  cibleCollectee(comboA, vC, '1,2,3,4,15,16');

  // (Q) quickOk : le compartiment B de la cible contient d'autres moitiés à
  // RES 8 (Will), la moitié B de la cible non.
  const quick: Cas = {
    nom: 'T2-Q coupe quickOkMin',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[1, 100]]), r(25, 5, 'will', [[11, 8]]), r(16, 6, 'tolerance', [[1, 100]]), r(26, 6, 'will', [[11, 8]])],
    sets: ['violent'], minStats: { res: 23 }, compter: true,
  };
  const vQ = lancer(quick);
  verifier(quick, vQ, true);
  cibleCollectee(quick, vQ, '1,2,3,4,15,16');

  // MAXIMUM : seul l'inévitable compte ; la Tolerance propre (23 > 22) est
  // rejetée au contrôle final, les trois autres builds restent.
  const max: Cas = { ...tolerance, nom: 'T2 maximum RES 22', minStats: {}, maxStats: { res: 22 } };
  const vM = lancer(max);
  verifier(max, vM, true);
  egal(vM.o.valides.size, 3, 'T2 maximum RES 22 : trois builds sans activation Tolerance');
  const maxEteint: Cas = { ...max, nom: 'T2 maximum RES 22, toggle éteint', compter: false };
  const vME = lancer(maxEteint);
  verifier(maxEteint, vME, true);
  egal(vME.o.valides.size, 4, 'T2 maximum RES 22, toggle éteint : la Tolerance propre ne pénalise plus');
  const maxAcc: Cas = { ...accuracy, nom: 'T2 maximum PRE 7', minStats: {}, maxStats: { acc: 7 } };
  verifier(maxAcc, lancer(maxAcc), true);
}

/* --------------------------------------------------------------------------
 * T3 — diagnostics : jamais une impossibilité sur une borne plus étroite
 * que la recherche ; near-miss lu avec l'aura propre.
 * ----------------------------------------------------------------------- */

function verifierDiagnostics(cas: Cas) {
  const o = oracle(cas);
  const p = parametres(cas);
  const diag = diagnoseFeasibility(p);
  for (const d of diag) {
    const vals = o.ensembleSets.map((b) => b.cond[d.key]);
    if (vals.length === 0) continue;
    if (d.kind === 'min') {
      const meilleur = Math.max(...vals);
      ok(d.bound >= meilleur, `${cas.nom} : diagnoseFeasibility min ${d.key} — borne ${d.bound} ≥ meilleur réel ${meilleur}`);
    } else {
      const plancher = Math.min(...vals);
      ok(d.bound <= plancher, `${cas.nom} : diagnoseFeasibility max ${d.key} — plancher ${d.bound} ≤ plus bas réel ${plancher}`);
    }
  }
  if (o.valides.size > 0) {
    ok(diag.every((d) => d.satisfiable), `${cas.nom} : aucune impossibilité « prouvée » alors que l'oracle trouve ${o.valides.size} build(s)`);
    const rank = rankBlockingConditions(p);
    ok(rank.baselineMinSlot >= 1, `${cas.nom} : rankBlockingConditions — le pré-filtrage sûr garde au moins une rune par emplacement (${rank.baselineMinSlot})`);
  }
}

export function testRuneOptimAurasCoupesDiagnostics() {
  titre('Auras propres · diagnostics de faisabilité et near-miss (T3)');
  const base = {
    pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[1, 100]]), r(25, 5, 'will', [[3, 10]]), r(16, 6, 'tolerance', [[1, 100]]), r(26, 6, 'will', [[3, 10]])],
    sets: ['violent'],
  };
  verifierDiagnostics({ ...base, nom: 'Diag min RES 23 (Tolerance propre)', minStats: { res: 23 }, compter: true });
  verifierDiagnostics({ ...base, nom: 'Diag min RES 23, toggle éteint', minStats: { res: 23 }, compter: false });
  verifierDiagnostics({ ...base, nom: 'Diag max RES 22', maxStats: { res: 22 }, compter: true });
  verifierDiagnostics({ ...base, nom: 'Diag min RES 31 (externe 1)', minStats: { res: 31 }, externes: { tolerance: 1 }, compter: true });
  verifierDiagnostics({
    nom: 'Diag Tolerance + Intangible', compter: true, sets: ['violent'], minStats: { res: 23 },
    pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[1, 100]]), r(16, 6, 'intangible', [[5, 10]])],
  });
  verifierDiagnostics({
    nom: 'Diag Tolerance demandée ×2 + libre', compter: true, sets: ['tolerance', 'tolerance'], minStats: { res: 39 },
    pool: [1, 2, 3, 4, 5, 6].map((s) => r(s, s, 'tolerance', [[1, 100]])).concat([r(26, 6, 'will', [[3, 10]])]),
  });

  // Near-miss : aucun build ne tient les conditions ; ceux qui atteignent le
  // contrôle final rapportent l'écart calculé avec l'aura propre, identique à
  // l'oracle. (1) min RES 24 et max RES 30 avec des Will à RES 8 ; (2) quatre
  // Tolerance dont deux sur l'emplacement 5 : la borne compte deux
  // activations, un build n'en porte qu'une (15 + 8 = 23 < 24).
  const nearMiss: Cas[] = [
    {
      nom: 'Near-miss RES 24..30', compter: true, sets: ['violent'], minStats: { res: 24 }, maxStats: { res: 30 },
      pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[1, 100]]), r(25, 5, 'will', [[11, 8]]), r(16, 6, 'tolerance', [[1, 100]]), r(26, 6, 'will', [[11, 8]])],
    },
    {
      nom: 'Near-miss Tolerance 3 sur 4 (min RES 24)', compter: true, sets: ['will'], minStats: { res: 24 },
      pool: [r(1, 1, 'will'), r(2, 2, 'will'), r(13, 3, 'tolerance', [[1, 100]]), r(14, 4, 'tolerance', [[1, 100]]), r(15, 5, 'tolerance', [[1, 100]]), r(55, 5, 'tolerance', [[3, 10]]), r(16, 6, 'shield', [[5, 10]])],
    },
  ];
  for (const nm of nearMiss) {
    const v = lancer(nm);
    verifier(nm, v, true);
    const byId = new Map(nm.pool.map((x) => [x.id, x]));
    const g = v.resultat.globalNearMiss;
    ok(g != null, `${nm.nom} : un quasi-succès est rapporté`);
    if (g) {
      const e = evaluer(nm, g.runeIds.map((id) => byId.get(id)!));
      egal(g.shortfalls.map((s) => [s.key, s.kind, s.actual]), g.shortfalls.map((s) => [s.key, s.kind, e.cond[s.key]]),
        `${nm.nom} : l'écart de ${g.runeIds.join(',')} est celui de l'oracle (aura propre comprise)`);
    }
    for (const entree of v.resultat.nearMissByCondition) {
      const e = evaluer(nm, entree.miss.runeIds.map((id) => byId.get(id)!));
      egal(entree.miss.shortfalls[0].actual, e.cond[entree.key], `${nm.nom} : near-miss ${entree.key}-${entree.kind}, total lu = oracle (${e.cond[entree.key]})`);
    }
  }
}

/* --------------------------------------------------------------------------
 * T4 — activation réelle et rétention : perte HEURISTIQUE ≠ faux rejet.
 * ----------------------------------------------------------------------- */

export function testRuneOptimAurasCoupesRetention() {
  titre('Auras propres · activation réelle et rétention (T4)');

  // Répétitions d'aura : trois Tolerance propres = +24 (15 + 24 = 39).
  const trois: Cas = {
    nom: 'T4 Tolerance ×3 (aucun set demandé)', compter: true, sets: [], minStats: { res: 39 },
    pool: [1, 2, 3, 4, 5, 6].flatMap((s) => [r(s, s, 'tolerance', [[1, 100]]), r(20 + s, s, 'will', [[3, 10]])]),
  };
  const v3 = lancer(trois);
  verifier(trois, v3, true);
  cibleCollectee(trois, v3, '1,2,3,4,5,6');

  // Deux sets incomplets : l'Intangible ne complète rien ; zéro aura propre.
  const incomplets: Cas = {
    nom: 'T4 deux sets incomplets + Intangible', compter: true, sets: ['violent'], minStats: { res: 23 },
    pool: [V(1, 1), V(2, 2), V(3, 3), r(14, 4, 'intangible', [[5, 10]]), r(15, 5, 'tolerance', [[1, 100]]), r(16, 6, 'accuracy', [[1, 100]])],
  };
  const vI = lancer(incomplets);
  verifier(incomplets, vI, true);
  egal(vI.o.valides.size, 0, 'T4 deux sets incomplets : le joker ne complète ni Violent ni Tolerance');

  // Deux Intangible dans le pool : jamais deux serties ensemble.
  const deuxJokers: Cas = {
    nom: 'T4 deux Intangible disponibles', compter: true, sets: ['violent'], minStats: { res: 23 },
    pool: [V(1, 1), V(2, 2), V(3, 3), r(14, 4, 'intangible', [[5, 10]]), V(24, 4), r(15, 5, 'tolerance', [[1, 100]]), r(16, 6, 'intangible', [[5, 11]]), r(26, 6, 'tolerance', [[1, 100]])],
  };
  verifier(deuxJokers, lancer(deuxJokers), true);

  // Concurrence dans les compartiments : `bucketCap` minuscule, la rétention
  // (heuristique) peut perdre des builds ; aucune coupe SÛRE ne doit en
  // rejeter un. Seeds fixes, 4 runes par emplacement.
  let perteHeuristique = 0;
  let fauxRejets = 0;
  let absents = 0;
  const motifs = new Map<string, number>();
  for (let s = 0; s < 8; s++) {
    const seed = 6400 + s;
    const rng = mulberry32(seed);
    const pool = randomPool(rng, 4, SETS_DIFF);
    const sets = [['violent'], ['will'], ['fight', 'will'], []][s % 4];
    const brouillon: Cas = { nom: '', pool, sets, compter: true };
    const tous = oracle(brouillon).ensembleSets;
    if (tous.length === 0) continue;
    const cas: Cas = { ...brouillon, nom: `T4 rétention seed ${seed}`, minStats: { res: quantile(tous.map((b) => b.cond.res), 0.7) } };
    const v = lancer(cas, { bucketCap: 1 }, 30);
    const fp = [...v.trouves].filter((c) => !v.o.valides.has(c));
    egal(fp, [], `${cas.nom} (bucketCap 1) : aucun faux positif`);
    absents += v.o.valides.size - v.trouves.size;
    fauxRejets += v.fauxRejets.length;
    for (const [k, n] of v.motifs) {
      motifs.set(k, (motifs.get(k) ?? 0) + n);
      if (HEURISTIQUES.has(k)) perteHeuristique += n;
    }
  }
  egal(fauxRejets, 0, `T4 rétention : ${absents} build(s) absents, ${perteHeuristique} tracé(s) à une perte heuristique, zéro à une coupe sûre (${fmtMotifs(motifs)})`);
}

/* --------------------------------------------------------------------------
 * T1 — témoin Blade/Intangible (Rage seul demandé) : crédit du joker.
 * ----------------------------------------------------------------------- */

const R = (id: number, slot: number) => r(id, slot, 'rage');

export function testRuneOptimAurasCoupesBladeIntangible() {
  titre('Témoin T1 · Blade non demandé et Intangible (Rage seul)');

  // Une Blade physique + Intangible : CR 15 + 12 = 27, seul build valide.
  const unBlade: Cas = {
    nom: 'T1 Blade 1 + Intangible, min CR 27',
    pool: [R(1, 1), R(2, 2), R(3, 3), R(4, 4), r(15, 5, 'blade', [[1, 100]]), r(25, 5, 'will', [[3, 10]]), r(16, 6, 'intangible', [[5, 10]]), r(26, 6, 'will', [[3, 10]])],
    sets: ['rage'], minStats: { cr: 27 }, compter: true,
  };
  const v1 = lancer(unBlade);
  verifier(unBlade, v1, true);
  cibleCollectee(unBlade, v1, '1,2,3,4,15,16');

  // Moitiés permutées : Blade en moitié A, Intangible en moitié B.
  const permute: Cas = {
    nom: 'T1 Blade 1 + Intangible, moitiés permutées',
    pool: [R(1, 1), r(12, 2, 'blade', [[1, 100]]), r(22, 2, 'will', [[3, 10]]), R(3, 3), R(4, 4), r(15, 5, 'intangible', [[5, 10]]), r(25, 5, 'will', [[3, 10]]), R(6, 6)],
    sets: ['rage'], minStats: { cr: 27 }, compter: true,
  };
  const vP = lancer(permute);
  verifier(permute, vP, true);
  cibleCollectee(permute, vP, '1,12,3,4,15,6');

  // Deux Blade physiques : le cas déjà couvert (témoin inchangé).
  const deuxBlade: Cas = {
    nom: 'T1 Blade 2 physiques, min CR 27',
    pool: [R(1, 1), R(2, 2), R(3, 3), R(4, 4), r(15, 5, 'blade', [[1, 100]]), r(25, 5, 'will', [[3, 10]]), r(16, 6, 'blade', [[1, 100]]), r(26, 6, 'will', [[3, 10]])],
    sets: ['rage'], minStats: { cr: 27 }, compter: true,
  };
  verifier(deuxBlade, lancer(deuxBlade), true);

  // Sans seuil, puis maximum CR 26 : l'activation Blade n'est pas inévitable.
  const sansSeuil: Cas = { ...unBlade, nom: 'T1 Blade 1 + Intangible, sans seuil', minStats: {} };
  verifier(sansSeuil, lancer(sansSeuil), true);
  const max: Cas = { ...unBlade, nom: 'T1 Blade 1 + Intangible, max CR 26', minStats: {}, maxStats: { cr: 26 } };
  const vM = lancer(max);
  verifier(max, vM, true);
  egal(vM.o.valides.size, 3, 'T1 max CR 26 : Blade+Intangible (27) rejeté, les trois autres gardés');

  // Seconde activation d'un set DEMANDÉ grâce au joker : Energy demandé une
  // fois, trois Energy physiques + Intangible = deux activations (PV +30 %,
  // 10000 → 13000) ; le Will des emplacements 5-6 est complet, seul Energy
  // reste incomplet pour le joker.
  const energy: Cas = {
    nom: 'T1 Energy demandé, 2e activation par Intangible',
    pool: [r(1, 1, 'energy'), r(2, 2, 'energy'), r(3, 3, 'energy'), r(14, 4, 'intangible', [[5, 10]]), r(24, 4, 'will', [[3, 10]]), r(5, 5, 'will', [[3, 10]]), r(6, 6, 'will', [[5, 10]])],
    sets: ['energy'], minStats: { hp: 13000 }, compter: true,
  };
  const vE = lancer(energy);
  verifier(energy, vE, true);
  cibleCollectee(energy, vE, '1,2,3,14,5,6');

  verifierDiagnostics({
    nom: 'Diag Blade + Intangible (min CR 27)', compter: true, sets: ['rage'], minStats: { cr: 27 },
    pool: [R(1, 1), R(2, 2), R(3, 3), R(4, 4), r(15, 5, 'blade', [[1, 100]]), r(16, 6, 'intangible', [[5, 10]])],
  });
}

/* --------------------------------------------------------------------------
 * Différentiel aléatoire (seeds fixes) : auras propres, Intangible, toggle,
 * part externe, min et max sur RES/PRE/CR.
 * ----------------------------------------------------------------------- */

const COMBOS: string[][] = [[], ['violent'], ['will'], ['tolerance'], ['fight', 'will'], ['violent', 'tolerance'], ['blade'], ['accuracy', 'shield'], ['energy']];
const OBJECTIFS: [Objective | undefined, StatKey[] | undefined][] = [[undefined, undefined], ['degats_reels', ['atk', 'cd']], ['ehp', ['hp', 'def']], ['vitesse', ['spd']]];

export function testRuneOptimAurasCoupesDifferentiel() {
  titre('Auras propres · différentiel aléatoire contre l\'oracle (seeds 6300..6359)');
  let fauxRejets = 0;
  let scenarios = 0;
  let valides = 0;
  const motifs = new Map<string, number>();
  for (let s = 0; s < 60; s++) {
    const seed = 6300 + s;
    const rng = mulberry32(seed);
    const pool = randomPool(rng, 3, SETS_DIFF);
    const sets = COMBOS[Math.floor(rng() * COMBOS.length)];
    const compter = rng() < 0.7;
    const externes: Partial<Record<SetAura, number>> = { tolerance: Math.floor(rng() * 2), accuracy: Math.floor(rng() * 2), fight: Math.floor(rng() * 2) };
    const brouillon: Cas = { nom: '', pool, sets, compter, externes };
    const tous = oracle(brouillon).ensembleSets;
    if (tous.length === 0) continue;
    const minStats: Partial<Record<StatKey, number>> = {};
    const maxStats: Partial<Record<StatKey, number>> = {};
    for (const k of ['res', 'acc', 'cr'] as const) {
      const vals = tous.map((b) => b.cond[k]);
      const t = rng();
      if (t < 0.35) minStats[k] = Math.max(1, quantile(vals, 0.6 + 0.35 * rng()));
      else if (t < 0.55) maxStats[k] = Math.max(1, quantile(vals, 0.1 + 0.4 * rng()));
    }
    // Tiré APRÈS les conditions : la suite des tirages précédents est inchangée.
    const [objective, objectiveStats] = OBJECTIFS[Math.floor(rng() * OBJECTIFS.length)];
    const cas: Cas = { nom: `seed ${seed} sets=${JSON.stringify(sets)} toggle=${compter} ext=${JSON.stringify(externes)} min=${JSON.stringify(minStats)} max=${JSON.stringify(maxStats)} objectif=${objective ?? '—'}`, pool, sets, compter, externes, minStats, maxStats, objective, objectiveStats };
    const v = lancer(cas, {}, 25);
    verifier(cas, v, false);
    scenarios++;
    valides += v.o.valides.size;
    fauxRejets += v.fauxRejets.length;
    for (const [k, n] of v.motifs) motifs.set(k, (motifs.get(k) ?? 0) + n);
  }
  ok(scenarios >= 35, `différentiel : ${scenarios} scénarios comparés sur 60 seeds (les autres n'ont aucun build au combo demandé), ${valides} builds valides à l'oracle`);
  egal(fauxRejets, 0, `différentiel : zéro faux rejet par une coupe sûre — absents par motif : ${fmtMotifs(motifs)}`);
}

/* --------------------------------------------------------------------------
 * Dominance : deux sets DIFFÉRENTS ne sont plus interchangeables, même hors
 * combo — aura (conditions ou score), bonus de fiche, ou joker.
 * ----------------------------------------------------------------------- */

export function testRuneOptimAurasCoupesDominance() {
  titre('Auras propres · dominance entre sets hors combo');

  // Minimum : Will domine la Tolerance de l'emplacement 5.
  const min: Cas = {
    nom: 'Dominance Tolerance retirée (min RES 23)',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(16, 6, 'tolerance', [[1, 100]])],
    sets: ['violent'], minStats: { res: 23 }, compter: true,
  };
  const vMin = lancer(min);
  verifier(min, vMin, true);
  cibleCollectee(min, vMin, '1,2,3,4,15,16');

  // Maximum : la Tolerance domine la Will (RES égale), mais son aura ferait
  // dépasser RES 22 ; retirer la Will perd le meilleur build en PV.
  const max: Cas = {
    nom: 'Dominance Will retirée (max RES 22)',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[3, 6]]), r(25, 5, 'will', [[3, 5]]), r(16, 6, 'tolerance', [[1, 100]]), r(26, 6, 'will', [[5, 10]])],
    sets: ['violent'], maxStats: { res: 22 }, compter: true,
  };
  verifier(max, lancer(max), true);

  // Score : un objectif qui lit l'ATQ (« Dégâts réels » d'un sort à ATQ).
  // Will domine le Fight de l'emplacement 5 ; le meilleur build en ATQ de
  // combat porte Fight ×2 : le Fight est protégé.
  const fight: Cas = {
    nom: 'Dominance Fight protégé (objectif ATQ)',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'fight', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(16, 6, 'fight', [[1, 100]])],
    sets: ['violent'], compter: true, objective: 'degats_reels', objectiveStats: ['atk', 'cd'],
  };
  verifier(fight, lancer(fight), true);

  // Fight complété par l'Intangible.
  const fightJoker: Cas = {
    nom: 'Dominance Fight + Intangible protégé (objectif ATQ)',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'fight', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(16, 6, 'intangible', [[1, 100]])],
    sets: ['violent'], compter: true, objective: 'degats_reels', objectiveStats: ['atk', 'cd'],
  };
  verifier(fightJoker, lancer(fightJoker), true);

  // Le même Fight sous PV effectifs : l'ATQ n'est ni condition ni objectif,
  // la dominance générique s'applique. Energy (PV) y reste protégée.
  const ehp: Cas = {
    nom: 'Dominance PV effectifs : Fight inutile retiré, Energy protégée',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'fight', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(35, 5, 'energy', [[3, 5]]), r(16, 6, 'energy', [[1, 100]]), r(26, 6, 'fight', [[1, 100]])],
    sets: ['violent'], compter: true, objective: 'ehp', objectiveStats: ['hp', 'def'],
  };
  const vEhp = lancer(ehp);
  verifier(ehp, vEhp, false);
  egal([[...vEhp.trouves].some((c) => c.split(',')[4] === '15'), vEhp.trouves.has('1,2,3,4,35,16'), vEhp.motifs.get(DOMINANCE)], [false, true, 2],
    'PV effectifs : le Fight dominé est retiré (2 builds, par la dominance), l\'Energy dominée reste et porte le meilleur PV');

  // Ton exemple : « Dégâts réels » avec minimums ATQ, Taux Crit, Dgts Crit.
  // Will domine un Focus et une Blade de l'emplacement 5 : la PRE du Focus
  // ne sert à rien (retiré), le CR de la Blade si (gardée).
  const focus: Cas = {
    nom: 'Dominance dégâts réels : Focus inutile retiré, Blade protégée',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'focus', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(35, 5, 'blade', [[3, 5]]), r(16, 6, 'blade', [[1, 100]]), r(26, 6, 'focus', [[1, 100]])],
    sets: ['violent'], compter: true, minStats: { atk: 700, cr: 15, cd: 50 }, objective: 'degats_reels', objectiveStats: ['atk', 'cd'],
  };
  const vF = lancer(focus);
  verifier(focus, vF, false);
  egal([[...vF.trouves].some((c) => c.split(',')[4] === '15'), vF.trouves.has('1,2,3,4,35,16'), vF.motifs.get(DOMINANCE)], [false, true, 2],
    'dégâts réels : le Focus dominé est retiré (2 builds, par la dominance), la Blade dominée reste et porte CR 27');

  // Sans aucune condition CR, la Blade n'est PAS protégée en « Dégâts réels »
  // (décision utilisateur du 2026-09-29 : le Taux Crit ne compte que sous un
  // minimum de Taux Crit, jamais par l'objectif). Will la domine : elle part.
  const bladeObjectif: Cas = {
    nom: 'Dominance Blade non protégée en dégâts réels sans condition CR',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'blade', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(16, 6, 'blade', [[1, 100]])],
    sets: ['violent'], compter: true, objective: 'degats_reels', objectiveStats: ['atk', 'cd'],
  };
  const vBO = lancer(bladeObjectif);
  verifier(bladeObjectif, vBO, false);
  egal([[...vBO.trouves], vBO.motifs.get(DOMINANCE)], [['1,2,3,4,25,16'], 1], 'dégâts réels sans minimum CR : la Blade dominée est retirée par la dominance');

  // « Efficience » maximise toutes les stats : un set à bonus qui peut se
  // former reste (Endure, deux emplacements), un set sans effet part
  // (Revenge), comme une Blade seule sur son emplacement, qui ne se formera
  // jamais sans Intangible.
  const efficience: Cas = {
    nom: 'Dominance efficience : Revenge et Blade isolée retirées, Endure formable gardée',
    pool: [R(1, 1), R(2, 2), R(3, 3), R(4, 4), r(15, 5, 'revenge', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(35, 5, 'endure', [[3, 5]]), r(45, 5, 'blade', [[3, 5]]), r(16, 6, 'endure', [[1, 100]]), r(26, 6, 'will', [[5, 10]])],
    sets: ['rage'], compter: true, objective: 'efficience',
  };
  const vEf = lancer(efficience);
  verifier(efficience, vEf, false);
  const emplacement5 = [...vEf.trouves].map((c) => c.split(',')[4]);
  egal([emplacement5.includes('15'), emplacement5.includes('45'), vEf.trouves.has('1,2,3,4,35,16'), vEf.motifs.get(DOMINANCE)], [false, false, true, 4],
    'efficience : Revenge et Blade isolée retirées (4 builds, par la dominance), Endure gardée avec son meilleur RES');

  // Intangible présente : deux sets sans effet qui ne peuvent jamais être
  // complets (une seule rune chacun) restent comparables — le joker n'en
  // dépend pas.
  const jokerIsoles: Cas = {
    nom: 'Dominance Shield > Revenge, sets isolés malgré l\'Intangible',
    pool: [R(1, 1), R(2, 2), R(3, 3), R(4, 4), r(15, 5, 'revenge', [[3, 5]]), r(25, 5, 'shield', [[3, 6]]), r(16, 6, 'will', [[1, 100]]), r(26, 6, 'intangible', [[5, 10]])],
    sets: ['rage'], compter: true, objective: 'efficience',
  };
  const vJI = lancer(jokerIsoles);
  verifier(jokerIsoles, vJI, false);
  egal([[...vJI.trouves].sort(), vJI.motifs.get(DOMINANCE)], [['1,2,3,4,25,16', '1,2,3,4,25,26'], 2], 'sets isolés : la Revenge dominée est retirée malgré l\'Intangible');

  // Accuracy : utile seulement si une condition PRE la lit, toggle actif.
  const accUtile: Cas = {
    nom: 'Dominance Accuracy protégée (min PRE 8, toggle actif)',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'accuracy', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(16, 6, 'accuracy', [[1, 100]])],
    sets: ['violent'], compter: true, minStats: { acc: 8 },
  };
  const vAU = lancer(accUtile);
  verifier(accUtile, vAU, true);
  cibleCollectee(accUtile, vAU, '1,2,3,4,15,16');
  const accInutile: Cas = {
    nom: 'Dominance Accuracy non utile (PV effectifs, toggle éteint)',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'accuracy', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(16, 6, 'accuracy', [[1, 100]])],
    sets: ['violent'], compter: false, objective: 'ehp', objectiveStats: ['hp', 'def'],
  };
  const vAI = lancer(accInutile);
  verifier(accInutile, vAI, false);
  egal([[...vAI.trouves], vAI.motifs.get(DOMINANCE)], [['1,2,3,4,25,16'], 1], 'Accuracy non utile : la rune dominée est retirée par la dominance, l\'efficience reste optimale');
  // Toggle éteint, même avec une condition PRE : l'aura n'y compte pas, elle
  // n'est pas utile ; la PRE des runes (5) tient seule le minimum.
  const accEteintCondition: Cas = {
    nom: 'Dominance Accuracy non utile (min PRE 5, toggle éteint, PV effectifs)',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'accuracy', [[12, 5], [3, 5]]), r(25, 5, 'will', [[12, 5], [3, 6]]), r(16, 6, 'accuracy', [[1, 100]])],
    sets: ['violent'], compter: false, minStats: { acc: 5 }, objective: 'ehp', objectiveStats: ['hp', 'def'],
  };
  const vAEC = lancer(accEteintCondition);
  verifier(accEteintCondition, vAEC, false);
  egal([[...vAEC.trouves], vAEC.motifs.get(DOMINANCE)], [['1,2,3,4,25,16'], 1], 'Accuracy toggle éteint : la rune dominée est retirée malgré la condition PRE, qui tient sans aura');

  // Deux runes du MÊME set d'aura restent comparables : la moins bonne part.
  const memeSet: Cas = {
    nom: 'Dominance entre deux Tolerance (sûre)',
    pool: [...QUATRE_VIOLENT, r(15, 5, 'tolerance', [[3, 5]]), r(25, 5, 'tolerance', [[3, 6]]), r(16, 6, 'tolerance', [[1, 100]])],
    sets: ['violent'], minStats: { res: 23 }, compter: true,
  };
  const vS = lancer(memeSet);
  verifier(memeSet, vS, false);
  egal([...vS.trouves], ['1,2,3,4,25,16'], 'Dominance entre deux Tolerance : seule la meilleure des deux reste, sans perte d\'optimum');

  // Témoin T1 : une rune Will domine la Blade de l'emplacement 5 (ATQ 6 ≥ 5),
  // mais seule la Blade complète le set qui porte CR 27 (Rage seul demandé).
  const blade: Cas = {
    nom: 'T1 Blade dominée par une rune hors combo',
    pool: [R(1, 1), R(2, 2), R(3, 3), R(4, 4), r(15, 5, 'blade', [[3, 5]]), r(25, 5, 'will', [[3, 6]]), r(16, 6, 'blade', [[1, 100]])],
    sets: ['rage'], minStats: { cr: 27 }, compter: true,
  };
  const vB = lancer(blade);
  verifier(blade, vB, true);
  cibleCollectee(blade, vB, '1,2,3,4,15,16');

  // Témoin T1 : deux sets SANS effet (Will/Shield), combo tenu par
  // l'Intangible. Remplacer Will par Shield laisse deux sets incomplets : le
  // joker ne complète plus Violent (règle d'`activeSets`).
  const joker: Cas = {
    nom: 'T1 Intangible : dominance Will → Shield',
    pool: [V(1, 1), V(2, 2), V(3, 3), r(14, 4, 'intangible', [[5, 10]]), r(15, 5, 'will', [[3, 5]]), r(25, 5, 'shield', [[3, 6]]), r(16, 6, 'will', [[1, 100]])],
    sets: ['violent'], compter: true,
  };
  const vJ = lancer(joker);
  verifier(joker, vJ, true);
  cibleCollectee(joker, vJ, '1,2,3,14,15,16');

  // La dominance GÉNÉRIQUE reste là où elle est sûre. Rage seul demandé,
  // aucune Intangible : Violent (4 pièces, jamais complet sur 2 emplacements
  // libres) domine le Will de l'emplacement 5 (ATQ 6 ≥ 5) — le Will part,
  // sans perte d'optimum.
  const generique: Cas = {
    nom: 'Dominance générique Violent > Will (Rage, sans Intangible)',
    pool: [R(1, 1), R(2, 2), R(3, 3), R(4, 4), r(15, 5, 'will', [[3, 5]]), r(25, 5, 'violent', [[3, 6]]), r(16, 6, 'will', [[1, 100]])],
    sets: ['rage'], compter: true,
  };
  const vG = lancer(generique);
  verifier(generique, vG, false);
  egal([[...vG.trouves], vG.motifs.get(DOMINANCE)], [['1,2,3,4,25,16'], 1], 'Dominance générique : le Will dominé est retiré par la dominance, l\'optimum reste');

  // Avec une Intangible, deux sets qui ne peuvent JAMAIS être complets sur les
  // emplacements libres (Swift et Violent, 4 pièces pour 2 libres) restent
  // comparables : la Swift dominée part.
  const jamaisComplets: Cas = {
    nom: 'Dominance Violent > Swift, 4 pièces jamais complètes (Intangible présente)',
    pool: [R(1, 1), R(2, 2), R(3, 3), R(4, 4), r(15, 5, 'swift', [[3, 5]]), r(25, 5, 'violent', [[3, 6]]), r(16, 6, 'will', [[1, 100]]), r(26, 6, 'intangible', [[5, 10]])],
    sets: ['rage'], compter: true,
  };
  const vC = lancer(jamaisComplets);
  verifier(jamaisComplets, vC, false);
  egal([[...vC.trouves].sort(), vC.motifs.get(DOMINANCE)], [['1,2,3,4,25,16', '1,2,3,4,25,26'], 2], 'Dominance jamais-complets : la Swift dominée est retirée malgré l\'Intangible, l\'optimum reste');

  // Le même Violent > Will, mais Rage tenu par l'Intangible : Rage + joker +
  // Will + Will est valide, Rage + joker + Violent + Will ne l'est plus (trois
  // sets incomplets). Le Will doit rester.
  const willJoker: Cas = {
    nom: 'Dominance Violent > Will refusée (Rage complété par l\'Intangible)',
    pool: [R(1, 1), R(2, 2), R(3, 3), r(14, 4, 'intangible', [[5, 10]]), r(15, 5, 'will', [[3, 5]]), r(25, 5, 'violent', [[3, 6]]), r(16, 6, 'will', [[1, 100]])],
    sets: ['rage'], compter: true,
  };
  const vW = lancer(willJoker);
  verifier(willJoker, vW, true);
  cibleCollectee(willJoker, vW, '1,2,3,14,15,16');
}
