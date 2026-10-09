import type { ExclusionSourceData } from './optimizerExclusion';
import type { ImportOptimizer, RapportImportOptimizer } from './importEquipes';

export type ActionImportOptimizer = (produire: (data: ExclusionSourceData) => ImportOptimizer) => RapportImportOptimizer;

// La navigation suit l'acceptation par l'action commune ; un refus garde sa page.
export function avecNavigationImportOptimizer(importer: ActionImportOptimizer, ouvrir: () => void,
  recevoirRapport?: (rapport: RapportImportOptimizer) => void): ActionImportOptimizer {
  return produire => {
    const rapport = importer(produire);
    recevoirRapport?.(rapport);
    if (rapport.listeCreee) ouvrir();
    return rapport;
  };
}
