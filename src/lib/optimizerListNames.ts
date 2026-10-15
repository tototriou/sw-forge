import type { OptimizerList } from './optimizerExclusion';

/** Premier nom libre parmi les listes existantes, sans renommer aucune liste. */
export function nomNouvelleListeOptimizer(listes: readonly OptimizerList[]): string {
  const noms = new Set(listes.map(l => l.name.trim()));
  let numero = 1;
  while (noms.has(`Liste ${numero}`)) numero++;
  return `Liste ${numero}`;
}
