// L'Optimizer dans une sauvegarde de session : une photo de ses champs de
// DONNÉES (`useOptimizerState`) : sélection, exemplaire, critères et tri.
// La photo est sérialisée ; App ne la réapplique pas actuellement.
//
// ⚠️ **Chaque champ de données de `OptimizerState` est classé** : dans la
// session, ou hors session (interface, état passager, résultats qui se
// recalculent). Les gardes ci-dessous font échouer `tsc` sur un champ ajouté
// sans être classé, sur un champ classé qui n'existe plus, et sur un champ
// de la session sans son `set…` — l'oubli d'un champ optionnel, que `tsc` ne
// voit jamais ailleurs, devient une erreur de compilation.

import type { OptimizerState } from '../hooks/useOptimizerState';

export const CHAMPS_OPTIMIZER_SESSION = [
  'selectedId',
  // L'exemplaire de l'espèce : revérifié contre le compte au remontage de
  // l'écran (OptimizerSection.tsx).
  'gearSource',
  'sourceSelector',
  'comboSets',
  'minStats',
  'maxStats',
  'mainStatsBySlot',
  'lockedRunes',
  'excludeBase',
  'optimiserArtefacts',
  'adapterArtefactsAuTri',
  'artifactMainByKind',
  'relicMainChoice',
  'relicUniqueChoice',
  'relicMinUpgrade',
  'lignesVerrouillees',
  'objective',
  'damageSetup',
  'compterAurasResPre',
  'excludeUsedRunes',
  'excludeUsedScope',
  'excludedSelectors',
  'adaptiveTrancheWeighting',
  'exhaustiveSearch',
  'verifierToutesLesCombinaisons',
  'slotFilterPreset',
  'sortBy',
] as const;

export const CHAMPS_OPTIMIZER_HORS_SESSION = [
  // Attribution à reconstruire seulement par un geste, jamais à la reprise.
  'proprietaireCriteres',
  'rapportCriteres',
  // Interface et validation de l'écran.
  'setPickerInvalid',
  'showAdvanced',
  'resultsPage',
  'openDetailKey',
  // Cran remonté pour la navigation seulement ; format de session inchangé.
  'critereArtefacts',
  // Passager : diagnostic, arrêt manuel, compteurs d'import.
  'diagnoseBlockingEnabled',
  'stoppedManually',
  'importDuCompte',
  'importReliqueTraite',
  // La recherche et ses résultats : ils se recalculent.
  'search',
] as const;

type ChampSession = (typeof CHAMPS_OPTIMIZER_SESSION)[number];
type ChampClasse = ChampSession | (typeof CHAMPS_OPTIMIZER_HORS_SESSION)[number];
// Les champs de données : tout sauf les fonctions (les `set…`, `resetSearch`…).
type ChampDonnee = { [K in keyof OptimizerState]: OptimizerState[K] extends (...a: never[]) => unknown ? never : K }[keyof OptimizerState];

// ⚠️ Gardes à la compilation. Une erreur ici = un champ à classer.
type NonClasse = Exclude<ChampDonnee, ChampClasse>;
type Inexistant = Exclude<ChampClasse, ChampDonnee>;
type SansSetter = { [K in ChampSession]: `set${Capitalize<K>}` extends keyof OptimizerState ? never : K }[ChampSession];
const GARDES: [[NonClasse] extends [never] ? 'ok' : NonClasse, [Inexistant] extends [never] ? 'ok' : Inexistant, [SansSetter] extends [never] ? 'ok' : SansSetter] = ['ok', 'ok', 'ok'];
void GARDES;

// La photo : les champs de la session, et eux seuls.
export function photoOptimizer(etat: OptimizerState): Record<string, unknown> {
  const photo: Record<string, unknown> = {};
  for (const champ of CHAMPS_OPTIMIZER_SESSION) photo[champ] = etat[champ];
  return photo;
}
