// Pilote un générateur d'appariement (`apparier`, ou `pairBuckets` en repli)
// jusqu'à sa fin : progression throttlée avec delta de candidats, rendu de
// main throttlé à la boucle d'événements, interruption coopérative. La FORME
// du message de progression posté est laissée à `onProgress`, jamais
// imposée ici.
//
// ⚠️ Paliers PARTAGÉS avec l'appariement parallèle (runeBuildOptim.worker.ts,
// qui espace lui-même la progression du coordinateur) — `PROGRESS_THROTTLE_MS`
// y reste utilisé directement, importé d'ici plutôt que redéfini.

import { cederLaMain } from '../lib/cession';
import { PairingProgress, SearchResult, BuildCandidate } from '../lib/runeBuildOptim';

// ⚠️ Un message de progression par point de passage flooderait le fil
// principal (des centaines de `postMessage` par seconde quand l'élagage est
// efficace) — throttlé au temps écoulé plutôt qu'au nombre de points de
// passage, pour rester fluide quel que soit le rythme réel de la recherche.
export const PROGRESS_THROTTLE_MS = 150;
// ⚠️ Rendre la main À CHAQUE point de passage (tous les 500 nœuds, voir
// CHECKPOINT_EVERY dans runeBuildOptim.ts) coûte bien plus cher qu'il n'y
// paraît : les navigateurs plafonnent `setTimeout(fn, 0)` appelé en boucle à
// ~4 ms (throttling standard, y compris dans un Worker) — sur une recherche
// de 20 000 000 de paires, ça fait 40 000 rendus de main, soit jusqu'à ~160 s
// de pur overhead de planification. Throttlé au temps écoulé, comme la
// progression ci-dessus, mais plus fréquemment (le bouton « Arrêter » doit
// rester réactif) — un ordre de grandeur sous le seuil de perceptibilité
// humaine, largement suffisant. La cession elle-même passe par un message de
// canal (`cederLaMain`), non bridé : le plafond à ~4 ms ne vaut que pour
// `setTimeout`, repli quand `MessageChannel` manque.
export const YIELD_THROTTLE_MS = 50;

// Retourne un `SearchResult` UNIFORME quelle que soit l'issue — un arrêt
// coopératif (`isStopped()`) construit un résultat `truncated: true` à
// partir de la dernière progression connue, exactement comme le ferait
// `pairBuckets` s'il avait lui-même épuisé son budget-temps à cet instant —
// jamais besoin, côté appelant, de distinguer les deux cas.
// `foundTotal` (3ᵉ argument d'`onProgress`) = `candidates.length` CUMULÉ à
// ce point de passage — pas seulement `newCandidates.length` (le delta) —
// nécessaire à `WorkerPairingMessage.found` (runeBuildOptim.worker.ts).
export async function drivePairing(
  gen: Generator<PairingProgress, SearchResult, void>,
  isStopped: () => boolean,
  onProgress: (explored: number, newCandidates: BuildCandidate[], foundTotal: number) => void
): Promise<SearchResult> {
  let candidatesSent = 0;
  let lastProgressPost = 0;
  let lastYield = Date.now();
  let step = gen.next();
  while (!step.done) {
    if (isStopped()) {
      const progress = step.value;
      // ⚠️ Le near-miss accumulé jusqu'à cet instant DOIT survivre à l'arrêt
      // — sans ces deux champs, un arrêt manuel perdrait silencieusement ce
      // que `pairBuckets` avait déjà trouvé (voir docs/03-developpeur/optimizer/
      // § Types et transport du quasi-succès : ce site est un de ceux qui
      // reconstruisent `SearchResult` à la main).
      return {
        candidates: progress.candidates,
        explored: progress.explored,
        truncated: true,
        nearMissByCondition: progress.nearMissByCondition,
        globalNearMiss: progress.globalNearMiss,
      };
    }
    const now = Date.now();
    const progress = step.value;
    if (now - lastProgressPost > PROGRESS_THROTTLE_MS) {
      lastProgressPost = now;
      const newCandidates = progress.candidates.slice(candidatesSent);
      candidatesSent = progress.candidates.length;
      onProgress(progress.explored, newCandidates, candidatesSent);
    }
    if (now - lastYield > YIELD_THROTTLE_MS) {
      lastYield = now;
      await cederLaMain();
    }
    step = gen.next();
  }
  return step.value;
}
