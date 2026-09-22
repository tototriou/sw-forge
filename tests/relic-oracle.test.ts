import { activeSets } from '../src/lib/effects';
import { parseAccountBox, parseAccountInventory, parseAccountSource } from '../src/lib/importAccount';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { RechercheRefusee, objectiveScore, SearchParams, prepareSearch, searchBuilds } from '../src/lib/runeBuildOptim';
import { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { computeStats } from '../src/lib/stats';
import { ArtifactDetail, RelicDetail } from '../src/types';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { chargerPointOracle, fusionnerRunsOracle, oracleSearch, oracleSearchRuns, paireDeReference } from '../scripts/lib/relicOracle';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { buildCaseSearchParams, CASES } from '../scripts/lib/perfShared';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { egal, exportSynthetique, ok, titre } from './outils';

const racineTests = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function leve(f: () => unknown): string | null {
  try {
    f();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

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
      allRelics: inventaire.relics,
      requirement: paramsFixture.requirement,
    }, 10 * 60 * 1000);
    egal(construit.relicContext, undefined, `fidélité --case : ${cas.label} sans intention relique ne pose aucun relicContext`);
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

  /* Lot 6 — complétude PAR RUN, et fusion partagée avec l'orchestrateur. */
  egal(oracleTrois.runs.length, 3, 'complétude : un relevé par run');
  ok(oracleTrois.complet && oracleTrois.runs.every((r) => !r.truncated), 'complétude : maxMs infini, aucun run tronqué → complet');
  egal(oracleTrois.runs.map((r) => r.principale), [{ code: 100, value: 10 }, { code: 101, value: 10 }, { code: 102, value: 10 }], 'complétude : chaque relevé porte sa principale, dans l’ordre des runs');
  const runsTrois = oracleSearchRuns(params, contexteTrois);
  const refusion = fusionnerRunsOracle(params, runsTrois, runsTrois.map((r) => searchBuilds(r.params)));
  egal(refusion, oracleTrois, 'fusion partagée : fusionnerRunsOracle sur les mêmes N résultats = oracleSearch (candidats, optimum, rid, runs, complet)');
  const tronque = oracleSearch({ ...params, maxCollected: 1 }, contexteTrois);
  ok(!tronque.complet, 'complétude : un plafond de collecte atteint sur un run → point incomplet');
  ok(tronque.runs.every((r) => r.truncated && r.candidats === 1), 'complétude : chaque run tronqué le dit, avec son compte');
  ok(leve(() => fusionnerRunsOracle(params, runsTrois, [])) != null, 'fusion partagée : N runs sans N résultats est refusé');

  /* Lot 6 — chargement d'un point (--case) : les trois options relique, l'espèce. */
  const exportDir = existsSync(resolve(racineTests, '..', 'tototriou-12889591.json')) ? resolve(racineTests, '..') : null;
  if (exportDir) {
    const point = chargerPointOracle(['node', 'relicOracle.ts', '--case=3', '--relic-main=101', '--relic-type=1', '--relic-min-upgrade=0', `--export-dir=${exportDir}`]);
    egal(point.contexte.principale, 101, '--case + --relic-main=101 : la principale forcée est celle du contexte');
    egal(point.contexte.type, 1, '--case + --relic-type=1 : le type forcé est celui du contexte');
    egal(point.contexte.seuil, 0, '--case + --relic-min-upgrade=0 : le seuil est celui du contexte');
    egal(point.contexte.mode, 'recherche', '--case : mode recherche');
    egal(point.params.relicContext, undefined, '--case : les SearchParams ne portent pas de relicContext (l’oracle l’efface de toute façon)');
    egal(point.label, 'Lushen d11 (tototriou) [relique 101/1/+0]', '--case : le libellé porte l’intention');
    egal(point.com2usId, 13413, '--case : l’espèce (Lushen, com2usId 13413) est rendue pour le porteur des artéfacts');
    egal(point.lignesVerrouillees, [], '--case : aucun verrou');
    const defaut = chargerPointOracle(['node', 'relicOracle.ts', '--case=3', `--export-dir=${exportDir}`]);
    egal([defaut.contexte.principale, defaut.contexte.type, defaut.contexte.seuil], ['libre', 'libre', 6], '--case sans option relique : libre/libre/+6, la forme du lot 4');
    ok(leve(() => chargerPointOracle(['node', 'relicOracle.ts', '--case=3', '--relic-main=equipped', `--export-dir=${exportDir}`])) != null, '--case + --relic-main=equipped est refusé (pas un point d’oracle)');
    ok(leve(() => chargerPointOracle(['node', 'relicOracle.ts', '--case=3', '--paire-reference=1,2', `--export-dir=${exportDir}`])) != null, '--case + --paire-reference est refusé (un cas de batterie porte sa paire)');
  } else {
    ok(true, 'chargement --case non contrôlé : export réel tototriou-12889591.json absent de la racine');
  }

  /* Lot 6 bis — la paire de référence désignée explicitement (`paireDeReference`) :
   * remplace la représentative quand celle-ci ne décrit pas le domaine comparé
   * (Shihwa : `[]` en PV effectifs, le minimum d'ATQ dépend de +100 × 2). */
  {
    const piece = (id: number, kind: 'element' | 'archetype', extra: Partial<ArtifactDetail> = {}): ArtifactDetail => ({
      id, kind, level: 15, rarity: 5, main: { code: 101, value: 100 }, subs: [],
      ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
      ...extra,
    });
    const porteur = { element: 'fire' as const, archetype: 'attack' as const };
    const inventaire = [piece(11, 'element'), piece(12, 'archetype'), piece(13, 'element', { element: 'water' }), piece(14, 'archetype', { archetype: 'support' }), piece(15, 'element', { intangible: true }), piece(16, 'archetype', { intangible: true })];
    egal(paireDeReference([12, 11], inventaire, porteur).map((a) => a.id), [11, 12], 'paire de référence : attribut puis type, quel que soit l’ordre donné');
    egal(paireDeReference([15, 12], inventaire, porteur).map((a) => a.id), [15, 12], 'paire de référence : un intangible se porte avec une pièce ordinaire');
    ok(leve(() => paireDeReference([11], inventaire, porteur)) != null, 'paire de référence : un seul identifiant est refusé');
    ok(leve(() => paireDeReference([11, 11], inventaire, porteur)) != null, 'paire de référence : deux fois le même identifiant est refusé');
    ok(leve(() => paireDeReference([11, 99], inventaire, porteur)) != null, 'paire de référence : un identifiant absent de l’inventaire est refusé');
    ok(leve(() => paireDeReference([11, 13], inventaire, porteur)) != null, 'paire de référence : deux pièces d’attribut sont refusées (une par sorte)');
    ok(leve(() => paireDeReference([13, 12], inventaire, porteur)) != null, 'paire de référence : une pièce d’un autre élément n’est pas portable');
    ok(leve(() => paireDeReference([11, 14], inventaire, porteur)) != null, 'paire de référence : une pièce d’un autre archétype n’est pas portable');
    ok(leve(() => paireDeReference([15, 16], inventaire, porteur)) != null, 'paire de référence : deux intangibles ne se portent pas ensemble');
  }

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

  /* ── Refus nommé : pool vide en mode recherche — même classe que le moteur
   * (revue adversariale du diff du lot 5a, BLOQUANT 2 : l'oracle rendait
   * { candidats: [], optimum: null, N: 0 } au lieu de lever). */
  {
    const contexteVide = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 }, undefined, []);
    egal(contexteVide.vide, 'inventaire', 'refus oracle : inventaire vide → vide inventaire');
    let refusOracle: unknown = null;
    try {
      oracleSearch(params, contexteVide);
    } catch (e) {
      refusOracle = e;
    }
    let refusMoteur: unknown = null;
    try {
      searchBuilds({ ...params, relicContext: contexteVide });
    } catch (e) {
      refusMoteur = e;
    }
    ok(refusOracle instanceof RechercheRefusee, 'refus oracle : RechercheRefusee levée par oracleSearch');
    ok(refusMoteur instanceof RechercheRefusee, 'refus oracle : RechercheRefusee levée par searchBuilds');
    egal((refusOracle as RechercheRefusee).motif, (refusMoteur as RechercheRefusee).motif, 'refus oracle : même motif nommé que le moteur');
    egal((refusOracle as RechercheRefusee).vide, (refusMoteur as RechercheRefusee).vide, 'refus oracle : même vide que le moteur');
  }

  const recetteDegats = {
    objective: 'degats_reels',
    damageSetup: { skillCom2usId: 15908, enemyDef: 2000, enemyHp: 60000, critMode: 'crit' },
  } as OptimizerRecipe;
  const realDamage = buildRealDamageContext(recetteDegats, 26113, []);
  ok(realDamage != null, 'dégâts réels : le contexte de Sonia est construit par la fonction CLI partagée');
  const oracleDegats = oracleSearch({ ...params, objective: 'degats_reels' }, contexteFixe, { realDamage });
  ok(oracleDegats.optimum != null, 'dégâts réels : l’oracle classe les candidats avec un contexte explicite');
  egal(
    oracleDegats.optimum?.score,
    objectiveScore(oracleDegats.optimum!, 'degats_reels', realDamage!),
    'dégâts réels : le score oracle est celui de objectiveScore avec le contexte transmis'
  );
}
