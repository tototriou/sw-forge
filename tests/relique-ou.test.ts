// La relique en « OU » dans le test conjoint de la recherche (mode relique
// `recherche`) : le build doit tenir ses conditions avec UNE relique
// représentative à la fois (`reliquesRepresentatives`, relicOptim.ts ;
// `fichesDuTestConjoint`, runeBuildOptim.ts), jamais avec la meilleure
// principale de chaque stat à la fois ; le quasi-succès juge ses tentatives de
// la même façon.
//
// Deux parties ; l'exactitude contre l'énumération brute (relique × vraie
// paire), sur des pools tirés, est dans `tests/test-conjoint-exact.test.ts` :
// 1. les représentatives, sur des inventaires écrits (minimum, maximum, les
//    deux, aucun ; ex æquo ; principale inconnue) ;
// 2. minimum ET maximum sur la stat de la relique (seule une valeur du milieu
//    passe : la règle « deux extrêmes » perdrait un conforme) ; sans elle, le
//    build n'est plus collecté, et son quasi-succès vient des tentatives
//    relique par relique (la borne par stat le déclarait réussi) ;
// 3. la fixture B du corpus relique (deux minimums concurrents) : le faux
//    positif de la borne n'est plus collecté, et ses écarts de quasi-succès
//    sont ceux d'une vraie relique.
//
// `corpusAvecRejetes` : un corpus de builds pour les tests de la résolution,
// faux positifs de la borne compris (que la recherche n'émet plus).

import { BaseStats, RelicDetail, RuneDetail } from '../src/types';
import { reliquesRepresentatives, resoudreContexteRelique } from '../src/lib/relicOptim';
import type { RelicIntent } from '../src/hooks/useOptimizerState';
import { BuildCandidate, BuildRequirement, SearchParams, respecteConditionsAvecRelique } from '../src/lib/runeBuildOptim';
import { searchBuilds } from '../src/lib/rechercheRunes';
import { computeStats } from '../src/lib/stats';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { StatKey } from '../src/lib/effects';
import { resoudreCandidat } from '../scripts/lib/relicDifferentiel';
import { CORPUS_5A } from './relic-search.test';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const LIBRE: RelicIntent = { mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 };
const PORTEUR = { element: 'fire' as const, archetype: 'attack' as const };
const REGLAGES_BASE = { critere: 'efficience' as const, porteur: PORTEUR, exclusive: { setup: DEFAULT_DAMAGE_SETUP, element: null } };

function relique(id: number, code: number, value: number): RelicDetail {
  return { id, upgrade: 9, main: { code, value }, unique: { type: 1, tranche: 100, percent: 1 } };
}

function rune(id: number, slot: number, main: [number, number]): RuneDetail {
  return { id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: main[0], value: main[1] }, subs: [] };
}

const ids = (rs: RelicDetail[]) => rs.map((r) => r.id);
const cle = (c: { runeIds: number[] }) => c.runeIds.join(',');

function params(pool: RuneDetail[], requirement: BuildRequirement, extra: Partial<SearchParams> = {}): SearchParams {
  return { base: BASE, artifacts: [], pool, requirement, metric: 'eff', objective: 'efficience', maxMs: Number.POSITIVE_INFINITY, slotFilterCap: 80, ...extra };
}

/**
 * Un corpus de builds où la résolution trouve des conformes ET des rejetés :
 * les candidats de la recherche, puis, en relique `recherche`, ceux d'une
 * recherche SANS relique aux conditions relâchées du terme de la borne par
 * stat (minimum − `ceil(B × Lmax / 100)`, maximum − `floor(B × Lmin / 100)`
 * sur PV/ATQ/DEF) — les faux positifs de l'ancienne borne, que la recherche
 * n'émet plus. Pour les tests de la résolution, du CLI et du Worker de
 * résolution, qui doivent exercer l'issue « rejeté ».
 */
export function corpusAvecRejetes(p: SearchParams): BuildCandidate[] {
  const p0 = { ...p, maxMs: Number.POSITIVE_INFINITY };
  const trouves = searchBuilds(p0).candidates;
  const ctx = p.relicContext;
  if (ctx?.mode !== 'recherche') return trouves;
  const minStats = { ...p.requirement.minStats };
  const maxStats = { ...(p.requirement.maxStats ?? {}) };
  for (const k of ['hp', 'atk', 'def'] as const) {
    const b = p.base[k];
    if ((minStats[k] ?? 0) > 0) minStats[k] = minStats[k]! - Math.ceil((b * ctx.bornes.max[k]) / 100);
    if ((maxStats[k] ?? 0) > 0) maxStats[k] = maxStats[k]! - Math.floor((b * ctx.bornes.min[k]) / 100);
  }
  const relaches = searchBuilds({ ...p0, relic: undefined, relicContext: undefined, requirement: { ...p.requirement, minStats, maxStats } }).candidates;
  const vus = new Set(trouves.map(cle));
  return [...trouves, ...relaches.filter((c) => !vus.has(cle(c)))];
}

export default function testReliqueOu() {
  titre('Optimizer · relique en « OU » dans le test conjoint de la recherche');

  /* ── 1. Les représentatives. */
  {
    const inv = [relique(1, 100, 8), relique(2, 100, 12), relique(3, 101, 10), relique(4, 101, 15), relique(5, 101, 5), relique(6, 102, 9), relique(7, 101, 15)];
    egal(ids(reliquesRepresentatives(inv, { minStats: {} })), [2, 4, 6], 'sans condition : la plus forte de chaque principale (ex æquo 15 : la plus petite id)');
    egal(ids(reliquesRepresentatives(inv, { minStats: { atk: 900 } })), [2, 4, 6], 'minimum ATQ : la plus forte ATQ % (et une par autre principale)');
    egal(ids(reliquesRepresentatives(inv, { minStats: {}, maxStats: { atk: 900 } })), [2, 5, 6], 'maximum ATQ seul : la plus faible ATQ %');
    egal(ids(reliquesRepresentatives(inv, { minStats: { atk: 800 }, maxStats: { atk: 900 } })), [2, 4, 3, 5, 6], 'minimum ET maximum ATQ : toutes les valeurs distinctes d’ATQ %, décroissantes');
    egal(ids(reliquesRepresentatives(inv, { minStats: { atk: 0 }, maxStats: { atk: 0 } })), [2, 4, 6], 'une condition à 0 n’est pas posée (comme `minEntries`)');
    egal(ids(reliquesRepresentatives([relique(9, 999, 7), relique(8, 999, 3), relique(1, 100, 8)], { minStats: {} })), [1, 8], 'principale hors PV/ATQ/DEF : une seule, neutre (la plus petite id)');
    egal(reliquesRepresentatives([], { minStats: { hp: 1 } }), [], 'aucune éligible : aucune représentative');
    ok(reliquesRepresentatives(inv, { minStats: {} }).length <= 3, 'sans maximum : au plus trois');
  }

  /* ── 2. Minimum ET maximum sur la stat de la relique : seule la valeur du
   * milieu passe. ATQ = 700 + ceil(700 × L / 100) : 735, 770, 805 pour
   * L = 5, 10, 15 ; condition 760 ≤ ATQ ≤ 780. La plus forte et la plus
   * faible échouent toutes deux : la règle « deux extrêmes » perdrait ce
   * build, que la résolution rend conforme avec la +10. */
  {
    const pool = [1, 2, 3, 4, 5, 6].map((slot) => rune(100 + slot, slot, [8, 5]));
    const requirement: BuildRequirement = { sets: [], minStats: { atk: 760 }, maxStats: { atk: 780 } };
    const inv = [relique(11, 101, 5), relique(12, 101, 10), relique(13, 101, 15)];
    const ctx = resoudreContexteRelique(LIBRE, undefined, inv);
    const p = params(pool, requirement, { relicContext: ctx });
    const r = searchBuilds(p);
    egal(r.candidates.map(cle), ['101,102,103,104,105,106'], 'intervalle : le build est collecté (relique +10, la seule dans l’intervalle)');
    const build: BuildCandidate = { runeIds: pool.map((x) => x.id), stats: [], effTotal: 0 };
    const resolu = resoudreCandidat(p, build, ctx, REGLAGES_BASE);
    ok(resolu.conforme, 'intervalle : la résolution le rend conforme');
    egal(resolu.relique?.id, 12, 'intervalle : avec la relique 12 (+10)');

    // Sans la +10 : la borne par stat (ATQ +15 pour le minimum, +0 pour le
    // maximum) déclarait le build réussi ; relique par relique, la +15 dépasse
    // le maximum (805) et la +5 manque le minimum (735). Le quasi-succès en
    // vient (D31) : les deux conditions, chacune ratée seule, et le plus petit
    // écart relatif au global (25 / 780 < 25 / 760).
    const sansMilieu = resoudreContexteRelique(LIBRE, undefined, [inv[0]!, inv[2]!]);
    const rSans = searchBuilds({ ...p, relicContext: sansMilieu });
    egal(rSans.candidates.length, 0, 'intervalle sans la +10 : aucune relique ne tient, le build n’est pas collecté');
    const parCondition = Object.fromEntries(rSans.nearMissByCondition.map((e) => [`${e.key}-${e.kind}`, e.miss.shortfalls.map((s) => [s.actual, s.shortfall])]));
    egal(parCondition, { 'atk-max': [[805, 25]], 'atk-min': [[735, 25]] }, 'quasi-succès par condition : ATQ 805 avec la +15 (maximum dépassé de 25), 735 avec la +5 (minimum manqué de 25)');
    egal(rSans.globalNearMiss?.shortfalls, [{ key: 'atk', kind: 'max', requested: 780, actual: 805, shortfall: 25 }], 'quasi-succès global : la tentative la plus proche (relique +15)');
    egal(rSans.globalNearMiss?.stats, computeStats({ base: BASE, runes: pool, artifacts: [] }), 'la fiche du quasi-succès reste celle du build, sans relique');
  }

  /* ── 3. Fixture B du corpus relique : PV ≥ 30 300 et DEF ≥ 1 818. La
   * borne accorde PV % +14 ET DEF % +14 à la fois ; O n'est faisable avec
   * aucune relique seule. */
  {
    const { pool, inv, ctx, p0 } = CORPUS_5A.B;
    const O = pool.slice(0, 6);
    const r = searchBuilds({ ...p0, relicContext: ctx });
    ok(!r.candidates.some((c) => cle(c) === O.map((x) => x.id).join(',')), 'B : O, faux positif de la borne, n’est pas collecté');
    ok(inv.every((rel) => !respecteConditionsAvecRelique({ base: p0.base, runes: O, artifacts: [] }, rel, p0.requirement).respecte), 'B : aucune relique éligible ne rend O conforme');
    // Chaque écart du quasi-succès est celui d'une VRAIE relique : il se
    // retrouve dans la fiche du build avec l'une des éligibles.
    const tous = [...r.nearMissByCondition.map((e) => e.miss), ...(r.globalNearMiss ? [r.globalNearMiss] : [])];
    ok(tous.length > 0, `B : des quasi-succès (${tous.length})`);
    for (const miss of tous) {
      const runes = miss.runeIds.map((id) => pool.find((x) => x.id === id)!);
      const reproduit = ctx.eligibles.some((rel) => {
        const stats = computeStats({ base: p0.base, runes, artifacts: [], relic: rel });
        return miss.shortfalls.every((s) => stats.find((x) => x.key === s.key)!.total === s.actual);
      });
      ok(reproduit, `B : écarts ${JSON.stringify(miss.shortfalls.map((s) => [s.key as StatKey, s.actual]))} reproduits par une relique éligible`);
    }
  }
}
