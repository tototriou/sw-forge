// Producteurs de l'écran : paire représentative et deux crans de
// « Meilleurs artéfacts offensifs ». La fiche garde sa propre relique.
import type { GearSet } from '../types';
import type { Objective } from './runeBuildOptim';
import { statsParPaire } from './stats';
import {
  artifactDamageProfile, degatsBrutsArtefactsParCoup,
  type AurasPropres, type MonsterWideDamageModifiers,
} from './damage';
import {
  evaluerPourRegime, regimeArtefacts, regimeEquipementDe,
  type CanalExclusive, type DegatsContext,
} from './artifactEvaluation';
import { apportExclusive, statsAvecApport } from './relicExclusive';

export function evaluateursArtefactsFiche(
  gear: GearSet,
  objective: Objective,
  propres: AurasPropres,
  degats: DegatsContext | null,
  contexte: Omit<CanalExclusive, 'relique'>,
  combatStats: MonsterWideDamageModifiers['combatStats']
) {
  // Les principales sont déjà dans ces stats ; l'effet unique ne doit
  // jamais modifier la fiche ni les conditions min/max.
  const statsAvec = statsParPaire(gear);
  const exclusive = { ...contexte, relique: gear.relic };
  const reel = degats && evaluerPourRegime('degats_reels', statsAvec, propres, degats, exclusive);
  const brut = (arts: GearSet['artifacts']) => {
    const stats = statsAvec(arts);
    // Recalcul PAR PAIRE : sa principale peut franchir une tranche de Y.
    // A.2 ter (2026-09-30) : seuls les points Bravoure/Éternité/Origine
    // entrent dans 218–221. Conquête et Ténacité ne multiplient pas ce brut.
    const apport = apportExclusive(gear.relic, stats, contexte.setup, propres, contexte.element);
    return degatsBrutsArtefactsParCoup(
      statsAvecApport(stats, apport), contexte.setup, propres, contexte.element,
      artifactDamageProfile(arts), { combatStats }
    );
  };
  // L'objectif de RECHERCHE gouverne la représentative, jamais le tri.
  const regime = regimeEquipementDe(regimeArtefacts(objective), !!degats);
  const representatif = regime === 'degats_reels' ? reel!
    : evaluerPourRegime(regime, statsAvec, propres,
      regime === 'ehp' ? exclusive : undefined);
  return { representatif, brut, reel };
}
