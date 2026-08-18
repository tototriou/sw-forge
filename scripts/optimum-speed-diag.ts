// Étape 2/2 de la comparaison de VITESSE « rétention par tranches » vs
// l'ancien mécanisme à score unique — voir spec/outils/optimizer/
// historique-dimensionnement.md, « Suite — vitesse de convergence : tranches
// vs score unique ». Lit les scénarios+cibles produits par
// `optimum-speed-targets.ts` (code ACTUEL uniquement) et mesure, pour
// CHAQUE version du moteur, le nombre de paires explorées (et le temps)
// avant que la cible exacte n'apparaisse dans le flux de résultats de
// `searchBuildsSteps` — au VRAI `bucketCap` par défaut de CETTE version
// (jamais surchargé : c'est justement ce qui a changé entre les deux
// versions comparées).
//
// ⚠️ Ce fichier n'importe QUE l'API stable et déjà présente dans les DEUX
// versions comparées (`searchBuildsSteps`/`SearchParams`, inchangées en
// forme depuis avant le correctif) — copié TEL QUEL dans le worktree de
// l'ancien commit, jamais réécrit pour lui. Contrairement à
// `optimum-speed-targets.ts` (reste dans le répertoire courant, importe
// `buildBuckets`/`prepareSearch`, absents de l'ancien commit).
//
// Usage : optimum-speed-diag.ts <scenarios.json> [combosOrderMode=potential]
//   combosOrderMode — 'potential' (défaut, comportement de production) ou
//   'relevance' (prototype en mesure — voir `buildBuckets`,
//   `SearchParams.combosOrderMode`) : tri des demi-builds À L'INTÉRIEUR d'un
//   compartiment par pure efficience au lieu du potentiel multi-tranches
//   normalisé, sans toucher au tri DES compartiments entre eux (inchangé).
// Sortie (stdout) : un JSON par scénario, une ligne — voir `Row` plus bas.

import { readFileSync } from 'fs';
import { BaseStats, BuildRequirement, RuneDetail } from '../src/types';
import { SearchParams, searchBuildsSteps } from '../src/lib/runeBuildOptim';

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

interface ScenarioIn {
  id: number;
  pool: RuneDetail[];
  requirement: BuildRequirement;
  targetRuneIds: number[];
}

interface Row {
  id: number;
  foundExplored: number | null; // null = jamais apparue avant troncature
  foundMs: number | null;
  totalExplored: number;
  totalMs: number;
  truncated: boolean;
}

const [scenarioFile, modeArg] = process.argv.slice(2);
if (!scenarioFile) {
  console.error('Usage: optimum-speed-diag.ts <scenarios.json> [combosOrderMode=potential]');
  process.exit(1);
}
const combosOrderMode = modeArg === 'relevance' ? 'relevance' : undefined;
const scenarios: ScenarioIn[] = JSON.parse(readFileSync(scenarioFile, 'utf8'));

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sb = [...b].sort((x, y) => x - y);
  return [...a].sort((x, y) => x - y).every((v, i) => v === sb[i]);
}

const rows: Row[] = [];
for (const sc of scenarios) {
  // ⚠️ AUCUNE surcharge de `bucketCap`/`slotFilterCap`/`maxNodes`/`maxMs` —
  // c'est précisément ce qu'on compare : le comportement RÉEL par défaut de
  // CHAQUE version, pas un réglage égalisé artificiellement.
  const params: SearchParams = { base: BASE, artifacts: [], pool: sc.pool, requirement: sc.requirement, metric: 'eff', combosOrderMode };
  const t0 = Date.now();
  const gen = searchBuildsSteps(params);
  let step = gen.next();
  let foundExplored: number | null = null;
  let foundMs: number | null = null;
  let lastExplored = 0;
  let lastCandidates = 0;
  while (!step.done) {
    const progress = step.value as { candidates?: unknown[]; explored?: number };
    // ⚠️ Le code ACTUEL a DEUX phases (`building`/`pairing`, voir
    // `SearchProgress`) — seule `pairing` porte `candidates`/`explored`.
    // L'ancien code n'a qu'une seule phase, toujours avec les deux champs :
    // ce garde duck-typé traite les deux uniformément sans dépendre d'un
    // champ `phase` absent côté ancien.
    if (Array.isArray(progress.candidates) && typeof progress.explored === 'number') {
      lastExplored = progress.explored;
      lastCandidates = progress.candidates.length;
      if (foundExplored === null && (progress.candidates as { runeIds: number[] }[]).some((c) => sameIds(c.runeIds, sc.targetRuneIds))) {
        foundExplored = progress.explored;
        foundMs = Date.now() - t0;
      }
    }
    step = gen.next();
  }
  const result = step.value; // SearchResult final
  const totalMs = Date.now() - t0;
  // ⚠️ `truncated` peut être absent sur l'ancien SearchResult (champ ajouté
  // plus tard) — repli sur une heuristique équivalente : le générateur s'est
  // arrêté sans que la cible n'apparaisse ET sans avoir tout exploré.
  const truncated = (result as { truncated?: boolean }).truncated ?? false;
  if (foundExplored === null) {
    // Dernière chance : le résultat FINAL peut contenir la cible même si
    // aucun point de passage intermédiaire ne l'avait encore — le premier
    // `yield` peut avoir lieu APRÈS que la cible soit déjà trouvée mais pas
    // encore relayée (granularité CHECKPOINT_EVERY).
    if (result.candidates.some((c) => sameIds(c.runeIds, sc.targetRuneIds))) {
      foundExplored = lastExplored;
      foundMs = totalMs;
    }
  }
  rows.push({ id: sc.id, foundExplored, foundMs, totalExplored: lastExplored, totalMs, truncated });
  console.log(
    JSON.stringify({ id: sc.id, foundExplored, foundMs, totalExplored: lastExplored, totalCandidates: lastCandidates, totalMs, truncated })
  );
}

const found = rows.filter((r) => r.foundExplored != null);
console.error(
  `\n[bilan] ${found.length}/${rows.length} cible(s) trouvée(s). ` +
    (found.length > 0
      ? `explored médian=${[...found.map((r) => r.foundExplored!)].sort((a, b) => a - b)[Math.floor(found.length / 2)]}`
      : '')
);
