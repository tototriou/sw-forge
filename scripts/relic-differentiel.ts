// Le différentiel de fidélité de B.6 (implementation-relique, lot 6 — B.6
// amendé le 2026-09-21 : « cinquième point d'entrée, le différentiel de
// fidélité ; un processus par recherche ») : pour UN point de la grille,
// l'oracle (N recherches, une par principale éligible) puis l'option A
// ENTIÈRE (une recherche relâchée + la résolution exacte de TOUS ses
// candidats), et la comparaison — N, C (complétude de chaque run ET de A),
// F (score de l'optimum), top-20, pertes classées par le traceur porté par
// le run A, paire de référence vérifiée.
//
// Usage (orchestrateur, un point) :
//   relic-differentiel.ts --case=<i> [--relic-main=] [--relic-type=] [--relic-min-upgrade=] [--export-dir=] --out=<dossier>
//   relic-differentiel.ts <export.json> <recette.json> [--rta] [--siege=<deckId>[:defense]] [--paire-reference=<id>,<id>] --out=<dossier>
//     (`--paire-reference` : la paire de référence désignée explicitement à la
//     place de la représentative — lot 6 bis, `paireDeReference` dans
//     relicOracle.ts ; archivée dans `resultat.json.point.paireReference`)
// Mode enfant (interne — une seule recherche, ce processus et rien d'autre) :
//   … --run=oracle:<i> --out=<dossier>   →  <dossier>/oracle-<i>.json
//   … --run=A --traceur=<6 ids> --out=<dossier>   →  <dossier>/A.json
//
// ⚠️ **Un processus par recherche, en séquence** (B.6 l. 3767 ; skill
// optimizer-perf-testing : enchaîner des recherches lourdes dans un
// processus fait dériver les suivantes — sous `maxMs`, une dérive devient
// une différence de candidats). L'enfant est relancé par
// `spawnSync(process.execPath, [...process.execArgv, ce fichier, …])` : le
// même Node, le même chargeur tsx, sans shell (ni `.cmd`, ni guillemets sur
// des chemins avec espaces).
//
// ⚠️ Ce n'est PAS un exécuteur de temps (`perf-battery` mesure T) : les `ms`
// rapportés ici sont des tirages uniques, un par processus, donnés pour le
// budget et la résolution exacte (mesurée À PART, jamais fondue dans T).
//
// ⚠️ Fidélité (`algo-verify`) : le chargement est `chargerPointOracle` (le
// même que l'oracle CLI), les runs sont `oracleSearchRuns`, la fusion est
// `fusionnerRunsOracle` (celle d'`oracleSearch`), la recherche est
// `searchBuilds` (API publique, `maxMs` de production), la résolution est
// `resoudreEquipementDuBuild` par `scripts/lib/relicDifferentiel.ts` (le
// code du différentiel de 5b). Le domaine comparé est la seule dimension
// relique : paire de référence = `params.artifacts`, figée des deux côtés.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { BuildCandidate, RechercheRefusee, SearchParams, TraceCandidat, searchBuilds } from '../src/lib/runeBuildOptim';
import { StatRow } from '../src/lib/stats';
import {
  OracleRunResultat,
  PointOracle,
  chargerPointOracle,
  fusionnerRunsOracle,
  oracleSearchRuns,
} from './lib/relicOracle';
import {
  CandidatResolu,
  ReglagesDifferentiel,
  ResultatDifferentiel,
  Saturation,
  comparerOptionA,
  degatsSansArtefacts,
  resoudreTousLesCandidats,
  saturationDe,
} from './lib/relicDifferentiel';
import { loadMonstersList } from './lib/monstersData';

function argument(argv: readonly string[], prefixe: string): string | undefined {
  return argv.find((a) => a.startsWith(prefixe))?.slice(prefixe.length);
}

/* --------------------------------------------------------------------------
 * Les fichiers échangés entre l'orchestrateur et ses enfants
 * ----------------------------------------------------------------------- */

interface FichierRunOracle {
  i: number;
  principale: { code: number; value: number } | null;
  truncated: boolean;
  explored: number;
  ms: number;
  // Les candidats bruts du run : les runes suffisent, `candidatAvecRelique`
  // recalcule les stats avec la relique du couple.
  candidats: { runeIds: number[]; effTotal: number }[];
}

interface FichierRunA {
  truncated: boolean;
  explored: number;
  msRecherche: number;
  msResolution: number;
  nRelaches: number;
  relaches: number[][];
  resolus: (Omit<CandidatResolu, 'enrichi'> & { enrichi: { runeIds: number[]; stats: StatRow[]; effTotal: number } })[];
  traceur: TraceCandidat | null;
  sature: Saturation | null;
  reglages: { critere: string; regime: string; porteur: unknown; paireFixe: number[]; verrousNeutralises: number };
}

interface FichierResultat {
  point: { label: string; objectif: string | undefined; empreinte: string; seuil: number; principale: unknown; type: unknown; eligibles: number; equipee: number | null; paireReference: number[]; artifactBounds: unknown };
  statut: 'refus' | ResultatDifferentiel['statut'];
  refus?: string;
  oracle?: { N: number; complet: boolean; runs: (Omit<FichierRunOracle, 'candidats'> & { candidats: number })[]; candidatsFusionnes: number; optimum: unknown; msTotal: number };
  A?: Omit<FichierRunA, 'relaches' | 'resolus' | 'traceur'> & { nResolus: number; optimum: unknown };
  comparaison?: Omit<ResultatDifferentiel, 'faisablesA' | 'faisablesOracle'> & { nFaisablesA: number; nFaisablesOracle: number };
  commande: string[];
}

function lire<T>(chemin: string): T {
  return JSON.parse(readFileSync(chemin, 'utf8')) as T;
}

function ecrire(chemin: string, v: unknown): void {
  // `Infinity` (un `maxMs` infini, un score) ne survit pas à JSON : marqué.
  writeFileSync(chemin, JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x), 1) + '\n');
}

function porteurDe(com2usId: number) {
  const espece = loadMonstersList().find((m) => m.com2usId === com2usId);
  if (!espece) throw new Error(`Espèce ${com2usId} absente du bestiaire — porteur des artéfacts introuvable.`);
  return { element: espece.element, archetype: espece.archetype };
}

function reglagesDe(point: PointOracle): ReglagesDifferentiel {
  return {
    critere: point.params.objective ?? 'efficience',
    degats: degatsSansArtefacts(point.realDamage),
    porteur: porteurDe(point.com2usId),
    // B.6 amendé : la paire de RÉFÉRENCE (`params.artifacts`, celle que
    // l'oracle note) figée côté A ; verrous neutralisés comme l'écran.
    paireFixe: point.params.artifacts,
    lignesVerrouillees: point.lignesVerrouillees,
  };
}

/* --------------------------------------------------------------------------
 * Enfant : une seule recherche
 * ----------------------------------------------------------------------- */

function enfantOracle(point: PointOracle, i: number, out: string): void {
  const runs = oracleSearchRuns(point.params, point.contexte);
  const run = runs[i];
  if (!run) throw new Error(`--run=oracle:${i} : l'oracle n'a que ${runs.length} run(s).`);
  const t0 = performance.now();
  const r = searchBuilds(run.params);
  const ms = performance.now() - t0;
  const fichier: FichierRunOracle = {
    i,
    principale: run.principale,
    truncated: r.truncated,
    explored: r.explored,
    ms,
    candidats: r.candidates.map((c) => ({ runeIds: c.runeIds, effTotal: c.effTotal })),
  };
  ecrire(resolve(out, `oracle-${i}.json`), fichier);
  process.stderr.write(`oracle run ${i + 1}/${runs.length} (${run.principale ? `${run.principale.code}:${run.principale.value}` : 'sans relique'}) : ${r.candidates.length} candidats, tronqué ${r.truncated}, ${(ms / 1000).toFixed(1)} s\n`);
}

// Les `SearchParams` du run A : ceux du point, PLUS le contexte G résolu
// (`relicContext` — la forme `--case` ne le pose pas dans les params, l'oracle
// l'efface de toute façon ; la forme recette le porte déjà, et c'est le MÊME,
// vérifié par l'empreinte) et le traceur.
function paramsA(point: PointOracle, traceur: number[] | null): SearchParams {
  const deja = point.params.relicContext;
  if (deja && deja.empreinte !== point.contexte.empreinte) {
    throw new Error(`relic-differentiel : le relicContext des SearchParams (${deja.empreinte}) diffère du contexte du point (${point.contexte.empreinte}) — deux lectures de l'intention (garantie G).`);
  }
  const p: SearchParams = { ...point.params, relicContext: point.contexte };
  return traceur ? { ...p, traceur: { runeIds: traceur } } : p;
}

function enfantA(point: PointOracle, traceur: number[] | null, out: string): void {
  const p = paramsA(point, traceur);
  const t0 = performance.now();
  const relaxed = searchBuilds(p);
  const t1 = performance.now();
  const reglages = reglagesDe(point);
  const resolus = resoudreTousLesCandidats(p, relaxed, point.contexte, reglages, point.realDamage);
  const t2 = performance.now();
  const sature = relaxed.traceur ? saturationDe(p, relaxed.traceur, relaxed.truncated, relaxed.candidates.length) : null;
  const fichier: FichierRunA = {
    truncated: relaxed.truncated,
    explored: relaxed.explored,
    msRecherche: t1 - t0,
    msResolution: t2 - t1,
    nRelaches: relaxed.candidates.length,
    relaches: relaxed.candidates.map((c) => c.runeIds),
    resolus: resolus.map((x) => ({ ...x, enrichi: { runeIds: x.enrichi.runeIds, stats: x.enrichi.stats, effTotal: x.enrichi.effTotal } })),
    traceur: relaxed.traceur ?? null,
    sature,
    reglages: {
      critere: String(reglages.critere),
      regime: reglages.degats == null && reglages.critere === 'degats_reels' ? 'aucun (sort non calculable)' : String(reglages.critere),
      porteur: reglages.porteur,
      paireFixe: (reglages.paireFixe ?? []).map((a) => a.id),
      verrousNeutralises: point.lignesVerrouillees.length,
    },
  };
  ecrire(resolve(out, 'A.json'), fichier);
  process.stderr.write(`A : ${relaxed.candidates.length} relâchés, ${resolus.length} résolus conformes, tronqué ${relaxed.truncated}, recherche ${((t1 - t0) / 1000).toFixed(1)} s, résolution ${((t2 - t1) / 1000).toFixed(1)} s\n`);
}

/* --------------------------------------------------------------------------
 * Orchestrateur
 * ----------------------------------------------------------------------- */

function lancerEnfant(argsPoint: string[], run: string, out: string, extra: string[] = []): void {
  const script = resolve(process.argv[1]!);
  const args = [...process.execArgv, script, ...argsPoint, `--run=${run}`, `--out=${out}`, ...extra];
  const r = spawnSync(process.execPath, args, { stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`enfant --run=${run} terminé avec le code ${r.status} (signal ${r.signal ?? '—'}).`);
}

function orchestrer(argv: string[]): void {
  const out = argument(argv, '--out=');
  if (!out) throw new Error('--out=<dossier> est obligatoire (les sorties de chaque recherche y sont archivées).');
  mkdirSync(out, { recursive: true });
  const argsPoint = argv.filter((a) => !a.startsWith('--out=') && !a.startsWith('--run='));
  const point = chargerPointOracle(['node', 'relic-differentiel.ts', ...argsPoint]);
  const { params, contexte } = point;
  const entete: FichierResultat['point'] = {
    label: point.label,
    objectif: params.objective,
    empreinte: contexte.empreinte,
    seuil: contexte.seuil,
    principale: contexte.principale,
    type: contexte.type,
    eligibles: contexte.eligibles.length,
    equipee: contexte.equipee?.id ?? null,
    paireReference: params.artifacts.map((a) => a.id),
    artifactBounds: params.artifactBounds ?? null,
  };
  const commande = ['relic-differentiel.ts', ...argsPoint, `--out=${out}`];

  // Refus NOMMÉ (pool vide en mode recherche, D1) — le « test de refus » de
  // B.6 : un résultat de statut `refus`, jamais un point à 0 candidat.
  if (contexte.mode === 'recherche' && contexte.vide) {
    const motif = new RechercheRefusee(contexte.vide).message;
    ecrire(resolve(out, 'resultat.json'), { point: entete, statut: 'refus', refus: motif, commande } satisfies FichierResultat);
    process.stdout.write(`REFUS ${point.label} : ${motif}\n`);
    process.exit(2);
  }

  const runs = oracleSearchRuns(params, contexte);
  process.stderr.write(`${point.label} — N = ${runs.length}, ${contexte.eligibles.length} éligible(s), paire de référence [${entete.paireReference.join(',')}]\n`);

  // 1. L'oracle, un processus par run, en séquence.
  const fichiersOracle: FichierRunOracle[] = [];
  for (let i = 0; i < runs.length; i++) {
    const chemin = resolve(out, `oracle-${i}.json`);
    if (!existsSync(chemin) || !argv.includes('--reprendre')) lancerEnfant(argsPoint, `oracle:${i}`, out);
    fichiersOracle.push(lire<FichierRunOracle>(chemin));
  }
  const resultats: OracleRunResultat[] = fichiersOracle.map((f) => ({
    candidates: f.candidats.map((c): BuildCandidate => ({ runeIds: c.runeIds, stats: [], effTotal: c.effTotal })),
    truncated: f.truncated,
    explored: f.explored,
  }));
  const oracle = fusionnerRunsOracle(params, runs, resultats, { realDamage: point.realDamage });

  // 2. A, avec le traceur = l'optimum de l'oracle (sa trace est produite par
  //    le moteur pendant la recherche relâchée — aucune recherche de plus).
  const traceur = oracle.optimum?.runeIds ?? null;
  const cheminA = resolve(out, 'A.json');
  if (!existsSync(cheminA) || !argv.includes('--reprendre')) lancerEnfant(argsPoint, 'A', out, traceur ? [`--traceur=${traceur.join(',')}`] : []);
  const fA = lire<FichierRunA>(cheminA);

  // 3. La comparaison.
  const resolus: CandidatResolu[] = fA.resolus.map((x) => ({ ...x, enrichi: x.enrichi }));
  const comparaison = comparerOptionA({
    p: params,
    ctx: contexte,
    oracle,
    relaxed: { candidates: fA.relaches.map((runeIds): BuildCandidate => ({ runeIds, stats: [], effTotal: 0 })), truncated: fA.truncated },
    resolus,
    realDamage: point.realDamage,
    traceOptimum: fA.traceur,
    sature: fA.sature,
  });
  const { faisablesA, faisablesOracle, ...resteComparaison } = comparaison;
  const resultat: FichierResultat = {
    point: entete,
    statut: comparaison.statut,
    oracle: {
      N: oracle.N,
      complet: oracle.complet,
      runs: fichiersOracle.map((f) => ({ ...f, candidats: f.candidats.length })),
      candidatsFusionnes: oracle.candidats.length,
      optimum: oracle.optimum ? { runeIds: oracle.optimum.runeIds, rid: oracle.optimum.rid ?? null, score: oracle.optimum.score } : null,
      msTotal: fichiersOracle.reduce((s, f) => s + f.ms, 0),
    },
    A: {
      truncated: fA.truncated,
      explored: fA.explored,
      msRecherche: fA.msRecherche,
      msResolution: fA.msResolution,
      nRelaches: fA.nRelaches,
      nResolus: fA.resolus.length,
      sature: fA.sature,
      reglages: fA.reglages,
      optimum: comparaison.optimumA,
    },
    comparaison: { ...resteComparaison, nFaisablesA: faisablesA.length, nFaisablesOracle: faisablesOracle.length },
    commande,
  };
  ecrire(resolve(out, 'resultat.json'), resultat);
  const c = comparaison;
  process.stdout.write(
    [
      `POINT ${point.label}`,
      `N=${oracle.N}`,
      `C=${c.complet ? 'complet' : `INCOMPLET (oracle tronqués ${c.runsOracleTronques}, A tronqué ${c.tronqueA})`}`,
      `F=${c.fidele === null ? 'n/a' : c.fidele ? '1' : '0'} (${c.statut})`,
      `scoreOracle=${c.optimumOracle?.score ?? '—'}`,
      `scoreA=${c.optimumA?.score ?? '—'}`,
      `ridOracle=${JSON.stringify(c.optimumOracle?.rids ?? null)}`,
      `ridA=${JSON.stringify(c.optimumA?.rids ?? null)}`,
      `top20=${c.top20.communs}/${c.top20.oracle.length}`,
      `faisables A/oracle=${faisablesA.length}/${faisablesOracle.length}`,
      `perdus=${c.perdus.length}`,
      `surplus=${c.surplus.length}`,
      `paireFixeViolee=${c.paireFixeViolee.length}`,
      `oracleNonConformes=${c.oracleNonConformes.length}`,
      `perteOptimum=${c.perteOptimum ? `${c.perteOptimum.classe} (${c.perteOptimum.detail.slice(0, 120)})` : '—'}`,
      `msOracle=${resultat.oracle!.msTotal.toFixed(0)}`,
      `msA=${fA.msRecherche.toFixed(0)}`,
      `msResolution=${fA.msResolution.toFixed(0)}`,
    ].join(' | ') + '\n'
  );
}

const executeDirectement = process.argv[1] != null && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (executeDirectement) {
  const argv = process.argv.slice(2);
  const run = argument(argv, '--run=');
  if (run) {
    const out = argument(argv, '--out=');
    if (!out) throw new Error('--out=<dossier> est obligatoire.');
    const argsPoint = argv.filter((a) => !a.startsWith('--out=') && !a.startsWith('--run=') && !a.startsWith('--traceur='));
    const point = chargerPointOracle(['node', 'relic-differentiel.ts', ...argsPoint]);
    if (run === 'A') {
      const t = argument(argv, '--traceur=');
      enfantA(point, t ? t.split(',').map(Number) : null, out);
    } else if (run.startsWith('oracle:')) {
      enfantOracle(point, Number(run.slice('oracle:'.length)), out);
    } else {
      throw new Error(`--run=${run} inconnu (attendu A ou oracle:<i>).`);
    }
  } else {
    orchestrer(argv);
  }
}
