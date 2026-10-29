/**
 * Un grand nombre de l'Optimizer (taille du pool, combinaisons, builds
 * explorés), lisible : groupé à la française sous le milliard, en notation
 * exponentielle au-delà (`1.2e+12`), « — » s'il n'est pas fini.
 */
export function formatBig(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n < 1_000_000_000) return Math.round(n).toLocaleString('fr-FR');
  return n.toExponential(1);
}
