import { activeSets } from '../src/lib/effects';
import { parseAccountBox, parseAccountInventory, parseAccountSource } from '../src/lib/importAccount';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { SearchParams, prepareSearch, searchBuilds } from '../src/lib/runeBuildOptim';
import { computeStats } from '../src/lib/stats';
import { RelicDetail } from '../src/types';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { oracleSearch, oracleSearchRuns } from '../scripts/lib/relicOracle';
import { buildCaseSearchParams, CASES } from '../scripts/lib/perfShared';
import { egal, exportSynthetique, ok, titre } from './outils';

function relique(id: number, code: 100 | 101 | 102, value: number, type = 1): RelicDetail {
  return { id, upgrade: 6, main: { code, value }, unique: { type, tranche: 100, percent: 1 } };
}

function projection(candidats: { runeIds: number[]; stats: unknown; effTotal: number }[]) {
  return candidats.map(({ runeIds, stats, effTotal }) => ({ runeIds, stats, effTotal }));
}

function cles(candidats: { runeIds: number[] }[]): string[] {
  return [...new Set(candidats.map((c) => c.runeIds.join(',')))].sort();
}

function sansRelique(params: SearchParams): Omit<SearchParams, 'relic'> {
  const { relic: _relic, ...reste } = params;
  return reste;
}

export default function testRelicOracle() {
  titre('Optimizer · oracle relique');

  /* Identité sur la fixture fixe : mode équipé = un seul vrai run moteur. */
  const data = parseAccountSource(exportSynthetique())!;
  const box = parseAccountBox(data).monsters;
  const inventaire = parseAccountInventory(data);
  const gear = box.find((m) => m.gear?.relic)?.gear!;
  const paramsFixture: SearchParams = {
    base: gear.base,
    artifacts: gear.artifacts,
    relic: gear.relic,
    pool: inventaire.runes,
    requirement: { sets: activeSets(gear.runes.map((r) => r.set)), minStats: {} },
    metric: 'eff',
    objective: 'ehp',
    maxMs: 10 * 60 * 1000,
    slotFilterCap: 80,
  };
  const contexteEquipe = resoudreContexteRelique(
    { mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 },
    gear.relic,
    inventaire.relics
  );
  const directFixture = searchBuilds({ ...paramsFixture, relic: gear.relic });
  const oracleFixture = oracleSearch(paramsFixture, contexteEquipe);
  egal(oracleFixture.N, 1, 'identité : une relique équipée produit exactement une recherche');
  egal(projection(oracleFixture.candidats), directFixture.candidates, 'identité : liste oracle égale à la liste du moteur courant');
  egal(oracleFixture.rid, gear.relic?.id, 'identité : le rid optimum est celui de la relique équipée');

  /* Fidélité SearchParams : seul `relic` change, les dérivés aussi coïncident. */
  const runFixture = oracleSearchRuns(paramsFixture, contexteEquipe)[0]!;
  egal(sansRelique(runFixture.params), sansRelique(paramsFixture), 'fidélité : tous les SearchParams hors relique sont byte-identiques');
  const prepareDirect = prepareSearch(paramsFixture);
  const prepareOracle = prepareSearch(runFixture.params);
  ok(prepareDirect != null && prepareOracle != null, 'fidélité : les deux préparations sont valides');
  egal(prepareOracle?.bucketCap, prepareDirect?.bucketCap, 'fidélité : même bucketCap dérivé du preset Moyen');
  egal(prepareOracle?.maxMs, prepareDirect?.maxMs, 'fidélité : même budget de temps de production');

  for (const cas of CASES) {
    const construit = buildCaseSearchParams(cas, {
      gear,
      allRunes: inventaire.runes,
      targetRuneIds: new Set(),
      requirement: paramsFixture.requirement,
    }, 10 * 60 * 1000);
    egal(construit.objectiveStats, cas.objectiveStats, `fidélité --case : ${cas.label} conserve objectiveStats`);
    egal(construit.base, gear.base, `fidélité --case : ${cas.label} conserve la base de perf-battery`);
    egal(construit.artifacts, gear.artifacts, `fidélité --case : ${cas.label} conserve les artéfacts de perf-battery`);
    egal(construit.pool, inventaire.runes, `fidélité --case : ${cas.label} conserve le pool de perf-battery`);
    egal(construit.requirement, paramsFixture.requirement, `fidélité --case : ${cas.label} conserve les conditions de perf-battery`);
    egal(construit.metric, 'eff', `fidélité --case : ${cas.label} conserve la métrique de perf-battery`);
    egal(construit.objective, cas.objective, `fidélité --case : ${cas.label} conserve l’objectif de perf-battery`);
    egal(construit.maxMs, 10 * 60 * 1000, `fidélité --case : ${cas.label} conserve le budget de perf-battery`);
    egal(construit.slotFilterCap, 80, `fidélité --case : ${cas.label} conserve le preset Moyen de perf-battery`);
  }

  const base = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
  const pool = randomPool(mulberry32(404), 2);
  const params: SearchParams = {
    base,
    artifacts: [],
    pool,
    requirement: { sets: [], minStats: {} },
    metric: 'eff',
    objective: 'ehp',
    maxMs: Number.POSITIVE_INFINITY,
    maxCollected: 100000,
    slotFilterCap: 80,
  };

  /* Relique fixe : même résultat que SearchParams.relic = cette pièce. */
  const fixe = relique(8101, 100, 11);
  const contexteFixe = resoudreContexteRelique(
    { mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 },
    fixe,
    [fixe]
  );
  const directFixe = searchBuilds({ ...params, relic: fixe });
  const oracleFixe = oracleSearch(params, contexteFixe);
  egal(projection(oracleFixe.candidats), directFixe.candidates, 'relique fixe : oracle identique au moteur avec SearchParams.relic');
  egal(oracleFixe.rid, fixe.id, 'relique fixe : rid conservé');

  /* Trois principales : l'oracle est l'union des trois vrais runs moteur. */
  const trois = [relique(8201, 100, 10), relique(8202, 101, 10), relique(8203, 102, 10)];
  const contexteTrois = resoudreContexteRelique(
    { mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 },
    undefined,
    trois
  );
  const oracleTrois = oracleSearch(params, contexteTrois);
  const union = trois.flatMap((r) => searchBuilds({ ...params, relic: r }).candidates);
  egal(oracleTrois.N, 3, 'trois principales distinctes : N = 3');
  egal(cles(oracleTrois.candidats), cles(union), 'trois principales : candidats = union des trois listes moteur');

  /* B1 : un maximum actif interdit de jeter la valeur de principale basse. */
  const poolB1 = randomPool(mulberry32(4012), 1).map((r) => ({ ...r, set: 'energy' }));
  const basse = relique(8301, 100, 12);
  const haute = relique(8302, 100, 14);
  const hpBasse = computeStats({ base, runes: poolB1, artifacts: [], relic: basse }).find((s) => s.key === 'hp')!.total;
  const paramsB1: SearchParams = {
    ...params,
    pool: poolB1,
    requirement: { sets: [], minStats: {}, maxStats: { hp: hpBasse } },
  };
  const contexteB1 = resoudreContexteRelique(
    { mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 },
    undefined,
    [haute, basse]
  );
  const oracleB1 = oracleSearch(paramsB1, contexteB1);
  egal(oracleB1.N, 2, 'B1 : les deux valeurs de principale restent des recherches distinctes');
  egal(oracleB1.candidats.length, 1, 'B1 : le build faisable avec +12 est trouvé malgré le +14 infaisable');
  egal(oracleB1.rid, basse.id, 'B1 : l’optimum faisable porte la PV % +12');
}
