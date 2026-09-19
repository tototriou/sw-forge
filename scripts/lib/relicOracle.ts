// Oracle de contrôle de la dimension relique (implementation-relique, lot 4).
//
// Il ne remplace aucune étape du moteur : chaque valeur distincte de
// principale éligible devient le `SearchParams.relic` d'un appel au vrai
// `searchBuilds`. Tous les autres champs restent ceux fournis par l'appelant.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { parseAccountInventory, parseAccountSource } from '../../src/lib/importAccount';
import {
  BuildCandidate,
  Objective,
  SearchParams,
  candidateMetricTotal,
  objectiveScore,
  searchBuilds,
  sortCandidates,
} from '../../src/lib/runeBuildOptim';
import { computeStats } from '../../src/lib/stats';
import { RelicDetail, RuneDetail } from '../../src/types';
import { RelicContext, bestRelicForBuild, resoudreContexteRelique } from '../../src/lib/relicOptim';
import { CASES, loadCase } from './perfShared';

export interface OracleCandidate extends BuildCandidate {
  rid?: number;
  score: number;
}

export interface OracleResult {
  candidats: OracleCandidate[];
  optimum: OracleCandidate | null;
  rid?: number;
  N: number;
}

export interface OracleSearchRun {
  principale: { code: number; value: number } | null;
  reliques: RelicDetail[];
  params: SearchParams;
}

function groupesDePrincipale(relicContext: RelicContext): { principale: { code: number; value: number } | null; reliques: RelicDetail[] }[] {
  if (relicContext.mode !== 'recherche') {
    const fixe = relicContext.equipee;
    return [{ principale: fixe ? { code: fixe.main.code, value: fixe.main.value } : null, reliques: fixe ? [fixe] : [] }];
  }

  const groupes = new Map<string, RelicDetail[]>();
  for (const relique of relicContext.eligibles) {
    const cle = `${relique.main.code}:${relique.main.value}`;
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(relique);
    else groupes.set(cle, [relique]);
  }
  return [...groupes.values()]
    .map((reliques) => ({
      principale: { code: reliques[0]!.main.code, value: reliques[0]!.main.value },
      reliques: [...reliques].sort((a, b) => a.id - b.id),
    }))
    .sort((a, b) => a.principale.code - b.principale.code || a.principale.value - b.principale.value);
}

/**
 * Rend les N appels exacts que `oracleSearch` exécutera. Cette fonction est
 * exportée pour que la preuve de fidélité puisse différer les paramètres sans
 * espionner ni recopier l'intérieur du moteur.
 */
export function oracleSearchRuns(params: SearchParams, relicContext: RelicContext): OracleSearchRun[] {
  return groupesDePrincipale(relicContext).map(({ principale, reliques }) => ({
    principale,
    reliques,
    // Remplacement, jamais cumul : c'est le même paramètre que la production.
    params: { ...params, relic: reliques[0] ?? relicContext.equipee },
  }));
}

function scoreDuCandidat(candidate: BuildCandidate, params: SearchParams, runeById: Map<number, RuneDetail>): number {
  const objectif = params.objective ?? 'efficience';
  if (objectif === 'efficience') return candidateMetricTotal(candidate, runeById, params.metric);
  if (objectif === 'degats_reels') {
    throw new Error("oracleSearch : l'objectif « Dégâts réels » exige un contexte de combat, absent de SearchParams au lot 4.");
  }
  return objectiveScore(candidate, objectif);
}

function candidatAvecRelique(
  candidate: BuildCandidate,
  reliques: RelicDetail[],
  params: SearchParams,
  runeById: Map<number, RuneDetail>
): OracleCandidate | null {
  const runes = candidate.runeIds.map((id) => runeById.get(id)).filter((r): r is RuneDetail => r != null);
  if (runes.length !== candidate.runeIds.length) {
    throw new Error('oracleSearch : un candidat référence une rune absente de SearchParams.pool.');
  }

  if (reliques.length === 0) {
    const sansRelique: BuildCandidate = {
      ...candidate,
      stats: computeStats({ base: params.base, runes, artifacts: params.artifacts }),
    };
    return { ...sansRelique, score: scoreDuCandidat(sansRelique, params, runeById) };
  }

  const evaluations = new Map<number, BuildCandidate>();
  const objectif = params.objective ?? 'efficience';
  const meilleure = bestRelicForBuild(reliques, (relique) => {
    const evalue: BuildCandidate = {
      ...candidate,
      stats: computeStats({ base: params.base, runes, artifacts: params.artifacts, relic: relique }),
    };
    evaluations.set(relique.id, evalue);
    return scoreDuCandidat(evalue, params, runeById);
  }, { regimeAucun: objectif === 'efficience' || objectif === 'vitesse', equipee: params.relic });

  if (!meilleure) return null;
  const evalue = evaluations.get(meilleure.relique.id)!;
  return { ...evalue, rid: meilleure.relique.id, score: scoreDuCandidat(evalue, params, runeById) };
}

/**
 * Référence relative au moteur rune existant : N recherches de production,
 * une par couple distinct `(statistique, valeur)` de principale éligible.
 */
export function oracleSearch(params: SearchParams, relicContext: RelicContext): OracleResult {
  const runs = oracleSearchRuns(params, relicContext);
  const runeById = new Map(params.pool.map((r) => [r.id, r]));
  const fusion = new Map<string, OracleCandidate>();
  const ordre: string[] = [];

  for (const run of runs) {
    const resultat = searchBuilds(run.params);
    for (const brut of resultat.candidates) {
      const candidat = candidatAvecRelique(brut, run.reliques, params, runeById);
      if (!candidat) continue;
      const cle = candidat.runeIds.join(',');
      const precedent = fusion.get(cle);
      if (!precedent) {
        fusion.set(cle, candidat);
        ordre.push(cle);
      } else if (candidat.score > precedent.score || (candidat.score === precedent.score && (candidat.rid ?? Infinity) < (precedent.rid ?? Infinity))) {
        fusion.set(cle, candidat);
      }
    }
  }

  const candidats = ordre.map((cle) => fusion.get(cle)!);
  const objectif: Objective = params.objective ?? 'efficience';
  const tries = sortCandidates(candidats, objectif, { runeById, metric: params.metric });
  const optimum = (tries[0] as OracleCandidate | undefined) ?? null;
  return { candidats, optimum, rid: optimum?.rid, N: runs.length };
}

function argument(prefixe: string): string | undefined {
  return process.argv.find((a) => a.startsWith(prefixe))?.slice(prefixe.length);
}

/**
 * Point d'entrée réutilisable par B.6 :
 * `npx tsx scripts/lib/relicOracle.ts --case=<index> --relic-min-upgrade=<0..15> --objective=<objectif> [--export-dir=<dossier>]`.
 * Un appel exécute une seule mesure, dans le processus courant.
 */
export function relicOracleCli(): void {
  const index = Number(argument('--case='));
  const seuil = Number(argument('--relic-min-upgrade=') ?? 6);
  const objectif = (argument('--objective=') ?? CASES[index]?.objective ?? 'efficience') as Objective;
  const exportDir = argument('--export-dir=');
  const cas = CASES[index];
  if (!cas || !Number.isInteger(index)) throw new Error(`--case doit désigner un index entre 0 et ${CASES.length - 1}.`);
  if (!Number.isInteger(seuil) || seuil < 0 || seuil > 15) throw new Error('--relic-min-upgrade doit être un entier entre 0 et 15.');
  if (!['efficience', 'ehp', 'vitesse'].includes(objectif)) {
    throw new Error('--objective accepte efficience, ehp ou vitesse au lot 4.');
  }

  const exportPath = exportDir ? resolve(exportDir, cas.exportPath) : cas.exportPath;
  const casEffectif = { ...cas, exportPath };
  const { gear, allRunes, requirement } = loadCase(casEffectif);
  const data = parseAccountSource(readFileSync(exportPath, 'utf8'))!;
  const { relics } = parseAccountInventory(data);
  const contexte = resoudreContexteRelique(
    { mode: 'recherche', principale: 'libre', type: 'libre', seuil },
    gear.relic,
    relics
  );
  const params: SearchParams = {
    base: gear.base,
    artifacts: gear.artifacts,
    relic: gear.relic,
    pool: allRunes,
    requirement,
    metric: 'eff',
    objective: objectif,
    maxMs: 10 * 60 * 1000,
    slotFilterCap: 80,
  };

  const debut = performance.now();
  const resultat = oracleSearch(params, contexte);
  const ms = performance.now() - debut;
  process.stdout.write(JSON.stringify({
    case: cas.label,
    seuil,
    objectif,
    empreinte: contexte.empreinte,
    N: resultat.N,
    candidats: resultat.candidats.length,
    rid: resultat.rid ?? null,
    optimum: resultat.optimum ? { runeIds: resultat.optimum.runeIds, rid: resultat.optimum.rid ?? null, stats: resultat.optimum.stats, score: resultat.optimum.score } : null,
    ms,
  }));
}

const executeDirectement = process.argv[1] != null && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (executeDirectement) relicOracleCli();
