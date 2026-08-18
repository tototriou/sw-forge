// Mesure combosOrderMode 'potential' vs 'relevance' sur les 7 VRAIS cas
// connus de scripts/lib/perfShared.ts (CASES), AVEC leur `objective` réel
// (`degats` pour 6/7, `ehp` pour Ciri) — le régime précis que les mesures
// précédentes (scripts/optimum-*.ts, toutes en metric:'eff' SANS objective)
// n'exerçaient jamais. Voir spec/outils/optimizer/historique-
// dimensionnement.md, « revue de code externe : le défaut 'relevance'
// invalidé », point 1 : le commentaire de runeBuildOptim.ts (~ligne 1455)
// documente qu'un build spécialisé sur des stats non meulables (Taux
// Crit/Dmg Crit, exactement les stats de `objective: 'degats'`) se
// retrouvait trié en fin de liste par la seule relevanceScore — c'est CE
// scénario qu'on mesure ici, sur de vrais comptes.
//
// Même méthode que optimum-rank-diag.ts (rang relatif + courbe de
// rendement), rejouée sur des scénarios réels au lieu de synthétiques.
//
// ⚠️ Budget-TEMPS réaliste + escalade RÉELLE (maybeEscalateNodeBudget),
// jamais un plafond de nœuds FIXE deviné — voir le skill algo-verify,
// méthode point 2 : un budget artificiellement court (ou ici, un plafond de
// nœuds qui se révèle trop court pour les plus gros de ces 7 cas réels,
// jusqu'à ~700M paires d'après scripts/perf-baseline.json) ferait diverger
// la mesure sans être représentatif d'un usage réel. `maxMs` par défaut
// (60 s) reste dans l'ordre de grandeur d'une attente utilisateur réelle
// (voir la même leçon dans rune-optim-parallel-pairing.test.ts, maxMs=30s
// retenu comme plancher vérifié) ; l'escalade fait le reste, EXACTEMENT
// comme runeBuildOptim.worker.ts en production.
//
// Usage : combos-order-mode-real-account-diag.ts [maxMs=60000] [filtres]
//   filtres — sous-chaînes (insensibles à la casse), séparées par des
//   virgules, filtrant CASES par label (un cas retenu s'il matche AU MOINS
//   UNE sous-chaîne) — pour ne rejouer que quelques cas précis (ex.
//   re-mesurer un cas inconcluant avec un budget plus généreux) sans
//   repayer les 7. Exemple : "sonia d6,lushen d10,rage seul".

import { ArtifactDetail, BaseStats, RelicDetail } from '../src/types';
import { SearchParams, prepareSearch, buildBuckets, pairBuckets, totalPairCount, NodeBudget, maybeEscalateNodeBudget } from '../src/lib/runeBuildOptim';
import { CASES, loadCase } from './lib/perfShared';

const CHECKPOINTS = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0];
const MAX_MS = process.argv[2] ? Number(process.argv[2]) : 60_000;
const FILTERS = process.argv[3]?.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
const SELECTED_CASES = FILTERS ? CASES.filter((c) => FILTERS.some((f) => c.label.toLowerCase().includes(f))) : CASES;

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}
function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sb = [...b].sort((x, y) => x - y);
  return [...a].sort((x, y) => x - y).every((v, i) => v === sb[i]);
}

interface Result {
  foundExplored: number | null;
  foundRank: number | null;
  totalPairCount: number;
  yieldCurve: (number | null)[];
}

function measure(base: BaseStats, artifacts: ArtifactDetail[], relic: RelicDetail | undefined, pool: ReturnType<typeof loadCase>['allRunes'], requirement: ReturnType<typeof loadCase>['requirement'], objective: SearchParams['objective'], targetRuneIds: number[], combosOrderMode: 'potential' | 'relevance'): Result | null {
  const params: SearchParams = { base, artifacts, relic, pool, requirement, metric: 'eff', objective, combosOrderMode, maxCollected: 1_500_000, slotFilterCap: 80, maxMs: MAX_MS };
  const prepared = prepareSearch(params);
  if (!prepared) return null;

  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces, undefined, false, combosOrderMode)
  );
  const bucketsB = drain(
    buildBuckets('B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces, undefined, false, combosOrderMode)
  );
  const total = totalPairCount(prepared, bucketsA, bucketsB);

  // Budget INITIAL adaptatif réel (prepared.maxNodes, pas un plafond fixe
  // deviné) + escalade RÉELLE (maybeEscalateNodeBudget) à chaque point de
  // passage, EXACTEMENT comme runeBuildOptim.worker.ts en production.
  const nodeBudget: NodeBudget = { max: prepared.maxNodes };
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
    if (foundExplored === null && progress.candidates.some((c) => sameIds(c.runeIds, targetRuneIds))) {
      foundExplored = progress.explored;
    }
    while (nextCheckpointIdx < CHECKPOINTS.length && total > 0 && progress.explored >= CHECKPOINTS[nextCheckpointIdx] * total) {
      yieldCurve[nextCheckpointIdx] = progress.candidates.length;
      nextCheckpointIdx++;
    }
    maybeEscalateNodeBudget(nodeBudget, prepared, progress, Date.now());
    step = gen.next();
  }
  const result = step.value;
  if (foundExplored === null && result.candidates.some((c) => sameIds(c.runeIds, targetRuneIds))) {
    foundExplored = lastExplored;
  }
  while (nextCheckpointIdx < CHECKPOINTS.length) {
    yieldCurve[nextCheckpointIdx] = lastCandidates;
    nextCheckpointIdx++;
  }
  return { foundExplored, foundRank: foundExplored != null && total > 0 ? foundExplored / total : null, totalPairCount: total, yieldCurve };
}

console.log(`combosOrderMode 'potential' vs 'relevance' — ${SELECTED_CASES.length}/${CASES.length} cas réel(s)${FILTERS ? ` (filtre: ${FILTERS.join(', ')})` : ''}, objective réel, maxMs=${MAX_MS}ms (budget de nœuds adaptatif + escalade réelle, comme en production).\n`);

for (const c of SELECTED_CASES) {
  const { gear, allRunes, requirement, targetRuneIds } = loadCase(c);
  const target = Array.from(targetRuneIds);
  const potential = measure(gear.base, gear.artifacts, gear.relic, allRunes, requirement, c.objective, target, 'potential');
  const relevance = measure(gear.base, gear.artifacts, gear.relic, allRunes, requirement, c.objective, target, 'relevance');
  console.log(`${c.label} (objective=${c.objective ?? '—'})`);
  if (!potential || !relevance) {
    console.log('  infaisable (prepareSearch a échoué) — ignoré');
    continue;
  }
  const fmtRank = (r: Result) => (r.foundRank == null ? 'NON TROUVÉ' : `rang=${r.foundRank.toFixed(4)} (explored=${r.foundExplored!.toLocaleString('fr-FR')}/${r.totalPairCount.toLocaleString('fr-FR')})`);
  console.log(`  potential : ${fmtRank(potential)}`);
  console.log(`  relevance : ${fmtRank(relevance)}`);
  if (potential.foundRank != null && relevance.foundRank != null) {
    const ratio = relevance.foundRank / Math.max(potential.foundRank, 1e-12);
    console.log(`  ratio rang relevance/potential : ${ratio.toFixed(3)}× ${ratio > 1.05 ? '⚠️ RELEVANCE PLUS TARD' : ratio < 0.95 ? '(relevance plus tôt)' : '(quasi égal)'}`);
  } else if (potential.foundRank != null && relevance.foundRank == null) {
    console.log('  ⚠️⚠️ RELEVANCE NE TROUVE PAS LA CIBLE DANS LE BUDGET (potential la trouve) — régression confirmée sur ce cas');
  } else if (potential.foundRank == null && relevance.foundRank != null) {
    console.log('  potential ne trouve pas la cible dans le budget, relevance oui');
  }
  console.log(`  courbe de rendement (candidats cumulés à 1/5/10/25/50/75/100% de l'espace) :`);
  console.log(`    potential : ${potential.yieldCurve.map((v) => v ?? '—').join(', ')}`);
  console.log(`    relevance : ${relevance.yieldCurve.map((v) => v ?? '—').join(', ')}`);
  console.log('');
}
