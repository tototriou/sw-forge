// Pilote un générateur `pairBuckets` jusqu'à sa fin — la mécanique EXACTE
// (escalade du budget, progression throttlée avec delta de candidats,
// rendu de main throttlé à la boucle d'événements, interruption
// coopérative) était recopiée quasi ligne à ligne entre `pairSlice.worker.ts`
// (une tranche, mode parallèle) et `runeBuildOptim.worker.ts` (chemin
// séquentiel) — revue de code externe, duplication. Seule la FORME du
// message de progression posté diffère entre les deux appelants (le
// séquentiel y ajoute `phase`/`found`/`pct`/`totalPairs`) — laissée à
// `onProgress`, jamais imposée ici.
//
// ⚠️ Paliers PARTAGÉS avec `runParallelPairing` (runeBuildOptim.worker.ts,
// sa propre agrégation de progression multi-workers) — `PROGRESS_THROTTLE_MS`
// y reste utilisé directement, importé d'ici plutôt que redéfini.

import { PreparedSearch, PairingProgress, SearchResult, NodeBudget, BuildCandidate, maybeEscalateNodeBudget } from '../lib/runeBuildOptim';

// ⚠️ Un message de progression par point de passage flooderait le fil
// principal (des centaines de `postMessage` par seconde quand l'élagage est
// efficace) — throttlé au temps écoulé plutôt qu'au nombre de points de
// passage, pour rester fluide quel que soit le rythme réel de la recherche.
export const PROGRESS_THROTTLE_MS = 150;
// ⚠️ Rendre la main À CHAQUE point de passage (tous les 500 nœuds, voir
// CHECKPOINT_EVERY dans runeBuildOptim.ts) coûte bien plus cher qu'il n'y
// paraît : les navigateurs plafonnent `setTimeout(fn, 0)` appelé en boucle à
// ~4 ms (throttling standard, y compris dans un Worker) — sur une recherche à
// `maxNodes=20 000 000`, ça fait 40 000 rendus de main, soit jusqu'à ~160 s
// de pur overhead de planification. Throttlé au temps écoulé, comme la
// progression ci-dessus, mais plus fréquemment (le bouton « Arrêter » doit
// rester réactif) — un ordre de grandeur sous le seuil de perceptibilité
// humaine, largement suffisant.
export const YIELD_THROTTLE_MS = 50;

// Retourne un `SearchResult` UNIFORME quelle que soit l'issue — un arrêt
// coopératif (`isStopped()`) construit un résultat `truncated: true` à
// partir de la dernière progression connue, exactement comme le ferait
// `pairBuckets` s'il avait lui-même épuisé son budget à cet instant —
// jamais besoin, côté appelant, de distinguer les deux cas.
// `foundTotal` (4ᵉ argument d'`onProgress`) = `candidates.length` CUMULÉ à
// ce point de passage — pas seulement `newCandidates.length` (le delta) —
// nécessaire à `WorkerPairingMessage.found` (runeBuildOptim.worker.ts) ;
// `pairSlice.worker.ts`, qui n'en a pas besoin, l'ignore simplement.
export async function drivePairing(
  gen: Generator<PairingProgress, SearchResult, void>,
  prepared: PreparedSearch,
  nodeBudget: NodeBudget,
  isStopped: () => boolean,
  onProgress: (explored: number, newCandidates: BuildCandidate[], nodeBudgetMax: number, foundTotal: number) => void
): Promise<SearchResult> {
  let candidatesSent = 0;
  let lastProgressPost = 0;
  let lastYield = Date.now();
  let step = gen.next();
  while (!step.done) {
    if (isStopped()) {
      const progress = step.value;
      return { candidates: progress.candidates, explored: progress.explored, truncated: true };
    }
    const now = Date.now();
    const progress = step.value;
    maybeEscalateNodeBudget(nodeBudget, prepared, progress, now);
    if (now - lastProgressPost > PROGRESS_THROTTLE_MS) {
      lastProgressPost = now;
      const newCandidates = progress.candidates.slice(candidatesSent);
      candidatesSent = progress.candidates.length;
      onProgress(progress.explored, newCandidates, nodeBudget.max, candidatesSent);
    }
    if (now - lastYield > YIELD_THROTTLE_MS) {
      lastYield = now;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    step = gen.next();
  }
  return step.value;
}
