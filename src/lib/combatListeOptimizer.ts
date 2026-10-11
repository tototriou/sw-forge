import type { DamageSetup } from './damage';
import type { ContenuListeOptimizer } from './optimizerMemberStorage';

/** Le contenu décide du mode effectif ; les critères enregistrés restent intacts. */
export function combatSelonContenuListeOptimizer(setup: DamageSetup, contenu: ContenuListeOptimizer | undefined): DamageSetup {
  const summonerSkills = contenu === 'guilde' ? 'guilde' : 'combat';
  return setup.summonerSkills === summonerSkills ? setup : { ...setup, summonerSkills };
}
