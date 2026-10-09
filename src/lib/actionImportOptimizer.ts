import type { ExclusionSourceData } from './optimizerExclusion';
import type { ImportOptimizer, RapportImportOptimizer } from './importEquipes';

export type ActionImportOptimizer = (produire: (data: ExclusionSourceData) => ImportOptimizer) => RapportImportOptimizer;

// La navigation suit l'acceptation par l'action commune ; un refus garde sa page.
export function avecNavigationImportOptimizer(importer: ActionImportOptimizer, ouvrir: () => void): ActionImportOptimizer {
  return produire => {
    const rapport = importer(produire);
    if (rapport.listeCreee) ouvrir();
    return rapport;
  };
}
