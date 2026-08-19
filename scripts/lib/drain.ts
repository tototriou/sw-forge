// Draine un générateur PAS À PAS jusqu'à sa valeur de retour finale — motif
// partagé par tout script qui pilote buildBuckets/pairBuckets (des
// générateurs, pour la progression) sans avoir besoin de cette progression
// lui-même. Centralisé ici après une revue de code externe (point 3) :
// cette même fonction était copiée-collée dans 23 scripts distincts (24 avec
// la copie privée `drainSync` de perfShared.ts) — aucun effet de bord, sûr à
// importer même depuis un worker_threads (build-half-worker.ts,
// pairing-worker.ts).
export function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}
