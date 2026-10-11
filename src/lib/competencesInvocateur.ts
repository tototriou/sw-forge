export type SummonerSkills = 'normal' | 'guilde';

/** Lecture commune aux recettes, mémoires, sessions et scripts. */
export function lireCompetencesInvocateur(valeur: unknown): SummonerSkills | null {
  if (valeur === 'guilde') return 'guilde';
  if (valeur === undefined || valeur === 'aucune' || valeur === 'combat' || valeur === 'normal') return 'normal';
  return null;
}

export function normaliserCompetencesInvocateur(setup: DamageSetup): DamageSetup {
  const mode = lireCompetencesInvocateur(setup.summonerSkills);
  return mode && setup.summonerSkills !== mode ? { ...setup, summonerSkills: mode } : setup;
}
import type { DamageSetup } from './damage';
