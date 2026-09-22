// L'orchestrateur du différentiel de fidélité (implementation-relique, lot 6,
// `scripts/relic-differentiel.ts`) — harnais d'abord (A.0) : ce qui se
// vérifie en test nommé ne reste pas une commande recopiée dans la preuve.
//
// Deux contrôles : (1) sur fixture, la comparaison PURE (`comparerOptionA`)
// rend les statuts distincts que B.6 amendé exige — fidèle, perte, surplus,
// vide d'un côté ou des deux, paire de référence violée — et le top-K est
// pris par `sortCandidates`, frontière ≥ K-ième, jamais l'ordre de fusion ;
// (2) sur le cas réel le plus léger (Ciri, `--case=6`, si l'export est à la
// racine) : l'orchestrateur — un processus par recherche, résultats relus
// d'un JSON, fusion partagée — rend EXACTEMENT ce que l'oracle mono-processus
// (`oracleSearch`) et la résolution en un processus
// (`resoudreTousLesCandidats`) rendent : N, complétude par run, `rid`,
// score, runes de l'optimum, faisables des deux côtés.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { SearchParams, searchBuilds } from '../src/lib/runeBuildOptim';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { RelicDetail } from '../src/types';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { chargerPointOracle, oracleSearch } from '../scripts/lib/relicOracle';
import { cle, comparerOptionA, degatsSansArtefacts, resoudreTousLesCandidats } from '../scripts/lib/relicDifferentiel';
import { loadMonstersList } from '../scripts/lib/monstersData';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PORTEUR = { element: 'fire' as const, archetype: 'attack' as const };

function relique(id: number, code: 100 | 101 | 102, value: number): RelicDetail {
  return { id, upgrade: 9, main: { code, value }, unique: { type: 1, tranche: 100, percent: 1 } };
}

export default function testRelicDifferentiel() {
  titre('Optimizer · différentiel de fidélité (lot 6) — comparaison pure et orchestrateur');

  /* (1) La comparaison pure, sur une fixture synthétique (objectif ehp). */
  const base = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
  const pool = randomPool(mulberry32(606), 2);
  const inv = [relique(9001, 100, 12), relique(9002, 100, 14), relique(9003, 102, 14)];
  const ctx = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 }, undefined, inv);
  const p: SearchParams = { base, artifacts: [], relic: undefined, relicContext: ctx, pool, requirement: { sets: [], minStats: {} }, metric: 'eff', objective: 'ehp', maxMs: Number.POSITIVE_INFINITY, slotFilterCap: 80 };
  const oracle = oracleSearch(p, ctx);
  const relaxed = searchBuilds(p);
  const reglages = { critere: 'ehp' as const, porteur: PORTEUR };
  const resolus = resoudreTousLesCandidats(p, relaxed, ctx, reglages);
  ok(oracle.candidats.length > 0 && resolus.length > 0, `fixture : ${oracle.candidats.length} candidats oracle, ${resolus.length} résolus A`);

  const fidele = comparerOptionA({ p, ctx, oracle, relaxed, resolus, k: 5 });
  egal(fidele.statut, 'fidele', 'fidèle : même score d’optimum → statut « fidele », F = 1');
  egal(fidele.fidele, true, 'fidèle : F vrai');
  ok(fidele.complet, 'fidèle : complet (maxMs infini, aucun run tronqué)');
  egal(fidele.perdus, [], 'fidèle : aucune perte');
  egal(fidele.surplus, [], 'fidèle : aucun surplus');
  egal(fidele.top20.k, 5, 'top-K : K transmis');
  ok(fidele.top20.oracle.length >= 5 && fidele.top20.communs === fidele.top20.oracle.length, `top-K : les ${fidele.top20.oracle.length} meilleurs de l’oracle (frontière ≥ 5ᵉ score) sont tous dans ceux de A`);
  ok(fidele.top20.scoreFrontiereOracle != null, 'top-K : la frontière est un score, pas un rang de fusion');
  egal(fidele.paireFixeViolee, [], 'paire fixe : sans paire de référence, rien à violer');
  egal(fidele.oracleNonConformes, [], 'oracle : tous les candidats respectent les conditions avec la paire de référence (vide)');

  // Perte : on retire l'optimum de l'oracle des résolus de A.
  const sansOptimum = resolus.filter((x) => !fidele.optimumOracle!.cles.includes(x.cle));
  const perte = comparerOptionA({ p, ctx, oracle, relaxed, resolus: sansOptimum, traceOptimum: null });
  egal(perte.statut, 'perte', 'perte : optimum de l’oracle absent de A → statut « perte », F = 0');
  egal(perte.fidele, false, 'perte : F faux');
  ok(perte.perdus.length >= 1 && perte.perdus.includes(fidele.optimumOracle!.cles[0]!), 'perte : l’optimum figure dans les perdus');
  ok(perte.perteOptimum != null && perte.perteOptimum.build === fidele.optimumOracle!.cles[0], 'perte : l’optimum perdu est classé (trace rejouée, faute de trace fournie)');
  egal(perte.perteOptimum?.classe, 'faux négatif', 'perte : l’optimum était relâché mais absent des résolus → « faux négatif » (de la résolution, ici simulé)');

  // Surplus : un score de A artificiellement au-dessus.
  const gonfle = resolus.map((x, i) => (i === 0 ? { ...x, score: x.score + 1 } : x));
  const surplus = comparerOptionA({ p, ctx, oracle, relaxed, resolus: gonfle });
  egal(surplus.statut, 'surplus', 'surplus : scoreA > scoreOracle → statut « surplus », pas une perte de A');
  egal(surplus.fidele, false, 'surplus : F faux (pas F = 1 non plus — rapporté, jamais retenu comme fidèle)');

  // Vides.
  const videA = comparerOptionA({ p, ctx, oracle, relaxed: { candidates: [], truncated: false }, resolus: [] });
  egal(videA.statut, 'A vide', 'vide : A sans candidat conforme, oracle non vide → « A vide » (une perte, pas deux scores égaux)');
  egal(videA.fidele, false, 'vide : A vide → F faux');
  const videOracle = { ...oracle, candidats: [], optimum: null, rid: undefined };
  const videDeux = comparerOptionA({ p, ctx, oracle: videOracle, relaxed: { candidates: [], truncated: false }, resolus: [] });
  egal(videDeux.statut, 'vide des deux cotes', 'vide : deux optimums null → statut distinct, F = null (jamais « égaux »)');
  egal(videDeux.fidele, null, 'vide des deux côtés : F n/a');
  const videO = comparerOptionA({ p, ctx, oracle: videOracle, relaxed, resolus });
  egal(videO.statut, 'oracle vide', 'vide : oracle vide, A non vide → « oracle vide », F n/a');

  // Complétude : un run de l'oracle tronqué rend le point incomplet.
  const tronque = comparerOptionA({ p, ctx, oracle: { ...oracle, complet: false, runs: oracle.runs.map((r, i) => (i === 0 ? { ...r, truncated: true } : r)) }, relaxed, resolus });
  ok(!tronque.complet && tronque.runsOracleTronques === 1, 'complétude : un run de l’oracle tronqué → point incomplet (1 run tronqué)');
  const tronqueA = comparerOptionA({ p, ctx, oracle, relaxed: { ...relaxed, truncated: true }, resolus });
  ok(!tronqueA.complet && tronqueA.tronqueA, 'complétude : A tronqué → point incomplet');

  // Paire fixe : la paire retenue diffère de la référence → violée, rapportée.
  const violee = comparerOptionA({ p, ctx, oracle, relaxed, resolus: resolus.map((x, i) => (i === 0 ? { ...x, paireFixeRespectee: false } : x)) });
  egal(violee.paireFixeViolee, [resolus[0]!.cle], 'paire fixe : un candidat dont la paire retenue diffère de la référence est rapporté');
  egal(degatsSansArtefacts(null), null, 'degats : sans contexte de dégâts, aucun contexte de sélection');

  // Mode `equipped` (lot 6 bis, point de non-régression) : la file ne pose pas
  // `relique` sur le résultat hors mode recherche — la portée est fixe. A doit
  // résoudre chaque candidat avec elle (rid = l'équipée) et être fidèle au run
  // unique de l'oracle ; A plantait sur `r.relique!.id` avant.
  {
    const equipee = inv[1]!;
    const ctxEq = resoudreContexteRelique({ mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, equipee, inv);
    const pEq: SearchParams = { ...p, relic: equipee, relicContext: ctxEq };
    const oracleEq = oracleSearch(pEq, ctxEq);
    const relaxedEq = searchBuilds(pEq);
    const resolusEq = resoudreTousLesCandidats(pEq, relaxedEq, ctxEq, reglages);
    egal(oracleEq.N, 1, 'equipped : l’oracle n’a qu’un run (la relique portée)');
    ok(resolusEq.length > 0 && resolusEq.every((x) => x.rid === equipee.id), `equipped : ${resolusEq.length} résolus, tous avec la relique portée (rid ${equipee.id})`);
    ok(resolusEq.every((x) => x.conditionsRespectees), 'equipped : chaque résolu respecte les conditions avec la relique portée');
    const cEq = comparerOptionA({ p: pEq, ctx: ctxEq, oracle: oracleEq, relaxed: relaxedEq, resolus: resolusEq, k: 5 });
    egal(cEq.statut, 'fidele', 'equipped : A ≡ oracle (statut « fidele »)');
    egal(cEq.optimumA?.rids, [equipee.id], 'equipped : le rid de l’optimum de A est l’équipée');
    egal(cEq.optimumOracle?.rids, [equipee.id], 'equipped : le rid de l’optimum de l’oracle est l’équipée');
  }

  /* (2) L'orchestrateur sur le cas réel le plus léger, si l'export est présent. */
  const exportCiri = resolve(racine, 'ß☆Enzo-6399149.json');
  if (!existsSync(exportCiri)) {
    ok(true, 'orchestrateur non contrôlé : export réel ß☆Enzo-6399149.json absent de la racine');
    return;
  }
  const out = mkdtempSync(join(tmpdir(), 'sw-forge-relic-diff-'));
  try {
    const argsPoint = ['--case=6', '--relic-min-upgrade=6', `--export-dir=${racine}`];
    // Le harnais de test tourne sur un bundle (pas sous tsx) : l'orchestrateur
    // se lance comme un utilisateur le lance, `npx tsx …` — via `cmd /c` sur
    // Windows (`npx` y est un `.cmd`, voir le skill optimizer-perf-testing).
    const script = resolve(racine, 'scripts/relic-differentiel.ts');
    const args = ['tsx', script, ...argsPoint, `--out=${out}`];
    const r = process.platform === 'win32'
      ? spawnSync('cmd', ['/c', 'npx', ...args], { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      : spawnSync('npx', args, { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    egal(r.status, 0, `orchestrateur : code de sortie 0 (${(r.stderr ?? '').split('\n').slice(-3).join(' / ')})`);
    const resultat = JSON.parse(readFileSync(join(out, 'resultat.json'), 'utf8'));
    const point = chargerPointOracle(['node', 'x', ...argsPoint]);
    const reference = oracleSearch(point.params, point.contexte, { realDamage: point.realDamage });
    egal(resultat.oracle.N, reference.N, `orchestrateur ≡ oracle mono-processus : N (${reference.N})`);
    egal(resultat.oracle.complet, reference.complet, 'orchestrateur ≡ oracle : complet');
    egal(resultat.oracle.runs.map((x: { principale: unknown; truncated: boolean; candidats: number }) => [x.principale, x.truncated, x.candidats]), reference.runs.map((x) => [x.principale, x.truncated, x.candidats]), 'orchestrateur ≡ oracle : complétude et compte de chaque run');
    egal(resultat.oracle.optimum.rid, reference.rid, `orchestrateur ≡ oracle : rid de l’optimum (${reference.rid})`);
    egal(resultat.oracle.optimum.score, reference.optimum?.score, `orchestrateur ≡ oracle : score de l’optimum (${reference.optimum?.score})`);
    egal(resultat.oracle.optimum.runeIds, reference.optimum?.runeIds, 'orchestrateur ≡ oracle : runes de l’optimum');
    egal(resultat.oracle.candidatsFusionnes, reference.candidats.length, 'orchestrateur ≡ oracle : nombre de candidats fusionnés');
    // A en un processus, même contexte, même paire de référence figée.
    const pA: SearchParams = { ...point.params, relicContext: point.contexte };
    const relaxedA = searchBuilds(pA);
    const espece = loadMonstersList().find((m) => m.com2usId === point.com2usId)!;
    const resolusA = resoudreTousLesCandidats(pA, relaxedA, point.contexte, { critere: pA.objective ?? 'efficience', degats: degatsSansArtefacts(point.realDamage), porteur: { element: espece.element, archetype: espece.archetype }, paireFixe: pA.artifacts, lignesVerrouillees: point.lignesVerrouillees }, point.realDamage);
    egal(resultat.A.nRelaches, relaxedA.candidates.length, `orchestrateur ≡ A mono-processus : candidats relâchés (${relaxedA.candidates.length})`);
    egal(resultat.A.nResolus, resolusA.length, `orchestrateur ≡ A : résolus conformes (${resolusA.length})`);
    egal(resultat.A.truncated, relaxedA.truncated, 'orchestrateur ≡ A : complétude');
    egal(resultat.A.reglages.paireFixe, pA.artifacts.map((a) => a.id), 'orchestrateur : la paire de référence figée est params.artifacts');
    egal(resultat.comparaison.paireFixeViolee, [], 'orchestrateur : la paire retenue par A est la paire de référence sur tous les résolus');
    const cmpRef = comparerOptionA({ p: pA, ctx: point.contexte, oracle: reference, relaxed: relaxedA, resolus: resolusA, realDamage: point.realDamage, traceOptimum: null });
    egal(resultat.comparaison.statut, cmpRef.statut, `orchestrateur ≡ comparaison mono-processus : statut (${cmpRef.statut})`);
    egal(resultat.comparaison.optimumA, cmpRef.optimumA, 'orchestrateur ≡ comparaison : optimum de A');
    egal(resultat.comparaison.optimumOracle, cmpRef.optimumOracle, 'orchestrateur ≡ comparaison : optimum de l’oracle');
    egal(resultat.comparaison.nFaisablesA, cmpRef.faisablesA.length, 'orchestrateur ≡ comparaison : faisables A');
    egal(resultat.comparaison.nFaisablesOracle, cmpRef.faisablesOracle.length, 'orchestrateur ≡ comparaison : faisables oracle');
    ok(resultat.A.sature != null && typeof resultat.A.sature.detail === 'string', 'orchestrateur : la saturation est lue sur la trace portée par le run A');
    ok(resolusA.every((x) => x.cle === cle(x.enrichi.runeIds)), 'A : chaque résolu porte sa clé canonique');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
