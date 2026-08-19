// Vérifie si le gain mesuré en `explored` absolu (voir optimum-speed-diag.ts)
// tient aussi en RANG RELATIF sur l'espace de recherche total, et si le
// prototype `combosOrderMode:'relevance'` ne fait pas payer plus tard, à
// l'appariement, ce qu'il gagne à la construction — voir spec/outils/
// optimizer/historique-dimensionnement.md, « Suite — rang relatif et courbe
// de rendement ». Deux questions distinctes du script précédent :
//   1. Le gain en `explored` ABSOLU tient-il une fois RAPPORTÉ à la taille
//      RÉELLE de l'espace de recherche de CE scénario (`totalPairCount`,
//      la même quantité affichée à l'écran) ? Un scénario où l'espace total
//      est petit peut sembler « trouvé tôt » en absolu sans l'être en relatif.
//   2. En échangeant l'ordre pour trouver LA cible plus tôt, retarde-t-on
//      l'apparition des AUTRES candidats valides (courbe de rendement :
//      combien de candidats trouvés à 10/25/50/75/100 % de l'espace
//      parcouru) ? Le prototype ne change QUE l'ordre, jamais la RÉTENTION —
//      mais l'ordre pourrait quand même déplacer QUAND les bons candidats
//      apparaissent, pas seulement LEQUEL apparaît en premier.
//
// Budget volontairement GÉNÉREUX mais BORNÉ (pas littéralement infini,
// impraticable sur certains scénarios) : assez grand pour couvrir la
// quasi-totalité des 51 scénarios sans tronquer avant la cible, voir
// MAX_NODES ci-dessous — calibré empiriquement, pas deviné.
//
// Usage : optimum-rank-diag.ts <scenarios.json> <potential|relevance> [maxNodes=20000000]

import { readFileSync } from 'fs';
import { BaseStats, BuildRequirement, RuneDetail } from '../src/types';
import { SearchParams, prepareSearch, buildBuckets, pairBuckets, totalPairCount, NodeBudget } from '../src/lib/runeBuildOptim';
import { drain } from './lib/drain';

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const CHECKPOINTS = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0]; // fractions de totalPairCount

interface ScenarioIn {
  id: number;
  pool: RuneDetail[];
  requirement: BuildRequirement;
  targetRuneIds: number[];
}

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sb = [...b].sort((x, y) => x - y);
  return [...a].sort((x, y) => x - y).every((v, i) => v === sb[i]);
}

const [scenarioFile, modeArg, maxNodesArg] = process.argv.slice(2);
if (!scenarioFile || (modeArg !== 'potential' && modeArg !== 'relevance')) {
  console.error('Usage: optimum-rank-diag.ts <scenarios.json> <potential|relevance> [maxNodes=20000000]');
  process.exit(1);
}
// ⚠️ Toujours un littéral EXPLICITE ('potential' ou 'relevance'), jamais
// `undefined` — sinon, passer 'potential' ici retomberait sur le défaut
// interne de `buildBuckets` (`'relevance'` depuis le 2026-08-18) au lieu de
// vraiment forcer l'ancien comportement demandé par l'appelant.
const combosOrderMode = modeArg === 'relevance' ? ('relevance' as const) : ('potential' as const);
const MAX_NODES = maxNodesArg ? Number(maxNodesArg) : 20_000_000;
const scenarios: ScenarioIn[] = JSON.parse(readFileSync(scenarioFile, 'utf8'));

interface Row {
  id: number;
  totalPairCount: number;
  foundExplored: number | null;
  foundRank: number | null; // foundExplored / totalPairCount
  truncatedBeforeFound: boolean;
  // candidats cumulés à chaque fraction de totalPairCount atteinte
  yieldCurve: (number | null)[]; // aligné sur CHECKPOINTS
}

const rows: Row[] = [];

for (const sc of scenarios) {
  // ⚠️ `maxCollected` explicitement ÉLARGI (défaut de production 100 000) :
  // sans ça, une recherche lâche s'arrête dès 100 000 candidats VALIDES
  // trouvés, bien avant d'avoir exploré assez de l'espace pour que le nœud
  // budget (`MAX_NODES`) devienne la vraie limite — un plafond DIFFÉRENT de
  // celui qu'on veut isoler ici (le rang RELATIF sur l'espace total, pas le
  // volume de candidats retenus).
  const params: SearchParams = { base: BASE, artifacts: [], pool: sc.pool, requirement: sc.requirement, metric: 'eff', combosOrderMode, maxCollected: 1_500_000 };
  const prepared = prepareSearch(params);
  if (!prepared) continue;

  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, false, combosOrderMode)
  );
  const bucketsB = drain(
    buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, false, combosOrderMode)
  );
  const total = totalPairCount(prepared, bucketsA, bucketsB);

  const nodeBudget: NodeBudget = { max: MAX_NODES };
  const gen = pairBuckets(prepared, bucketsA, bucketsB, nodeBudget);
  let step = gen.next();
  let foundExplored: number | null = null;
  let nextCheckpointIdx = 0;
  const yieldCurve: (number | null)[] = CHECKPOINTS.map(() => null);
  let lastExplored = 0;
  let lastCandidates = 0;
  while (!step.done) {
    const progress = step.value;
    lastExplored = progress.explored;
    lastCandidates = progress.candidates.length;
    if (foundExplored === null && progress.candidates.some((c) => sameIds(c.runeIds, sc.targetRuneIds))) {
      foundExplored = progress.explored;
    }
    while (nextCheckpointIdx < CHECKPOINTS.length && total > 0 && progress.explored >= CHECKPOINTS[nextCheckpointIdx] * total) {
      yieldCurve[nextCheckpointIdx] = progress.candidates.length;
      nextCheckpointIdx++;
    }
    step = gen.next();
  }
  const result = step.value;
  if (foundExplored === null && result.candidates.some((c) => sameIds(c.runeIds, sc.targetRuneIds))) {
    foundExplored = lastExplored;
  }
  while (nextCheckpointIdx < CHECKPOINTS.length) {
    yieldCurve[nextCheckpointIdx] = lastCandidates;
    nextCheckpointIdx++;
  }

  const row: Row = {
    id: sc.id,
    totalPairCount: total,
    foundExplored,
    foundRank: foundExplored != null && total > 0 ? foundExplored / total : null,
    truncatedBeforeFound: foundExplored === null,
    yieldCurve,
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}

const found = rows.filter((r) => r.foundRank != null);
console.error(`\n[bilan ${modeArg}] ${found.length}/${rows.length} cible(s) trouvée(s) dans le budget (maxNodes=${MAX_NODES}).`);
if (found.length > 0) {
  const ranks = found.map((r) => r.foundRank!).sort((a, b) => a - b);
  console.error(`  rang relatif (0=début, 1=fin) — médiane=${ranks[Math.floor(ranks.length / 2)].toFixed(4)} p90=${ranks[Math.floor(ranks.length * 0.9)].toFixed(4)} max=${ranks[ranks.length - 1].toFixed(4)}`);
}
