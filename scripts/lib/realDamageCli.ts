// Contexte de score « Dégâts réels » pour un script CLI.
//
// ⚠️ **Source UNIQUE** — extraite d'`optimizer-search-analyze.ts`, qui en
// était le seul porteur. Sans elle, tout autre script qui veut classer des
// candidats par dégâts doit reconstruire ces vingt champs à la main : c'est
// exactement la règle des « plusieurs constructeurs » (CLAUDE.md), et une
// copie qui oublierait un champ diverge en silence — `tsc` ne voit qu'un
// objet valide.
import {
  DEFAULT_DAMAGE_SETUP,
  artifactDamageProfile,
  monsterBonusDegatsConditionnel,
  monsterBonusDegatsSelonCr,
  monsterBonusDegatsSelonDef,
  monsterBonusDegatsSelonVit,
  monsterBonusDegatsStackable,
  monsterBonusEcartDef,
  monsterBonusFixeCiblePvMax,
  monsterBonusFixeMaxHpPropre,
  monsterBonusParEffetCible,
  monsterBonusParEffetPropre,
  monsterBonusSacrifice,
  monsterBonusSiAtqSeuil,
  monsterCritRateSelonVit,
  monsterCritSiPlusRapide,
  monsterBonusStatFixe,
  monsterDamageSkills,
  monsterOffensivePassives,
  resolveDamageSkill,
} from '../../src/lib/damage';
import { RealDamageContext } from '../../src/lib/runeBuildOptim';
import { OptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { ArtifactDetail } from '../../src/types';
import { loadMonsterSkills } from './skillsData';
import { loadMonstersList } from './monstersData';

/**
 * `null` si la recette ne vise pas les dégâts réels, ou si aucun sort n'est
 * calculable pour ce monstre — l'appelant AVERTIT plutôt que de laisser
 * `objectiveScore` lever plus loin sans contexte.
 *
 * ⚠️ `artifacts` doit être celui RÉELLEMENT envoyé au moteur
 * (`params.artifacts`, après `resolveArtifacts`), pas l'équipement brut : le
 * profil d'artéfact doit rester solidaire des stats sur lesquelles les
 * candidats ont été calculés.
 */
export function buildRealDamageContext(
  recipe: OptimizerRecipe,
  com2usId: number,
  artifacts: ArtifactDetail[]
): RealDamageContext | null {
  if (recipe.objective !== 'degats_reels') return null;
  const detail = loadMonsterSkills(com2usId);
  const profile = resolveDamageSkill(monsterDamageSkills(detail), recipe.damageSetup?.skillCom2usId ?? null);
  if (!profile) return null;
  return {
    profile,
    passifs: monsterOffensivePassives(detail),
    setup: recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP,
    element: loadMonstersList().find((m) => m.com2usId === com2usId)?.element ?? null,
    artefacts: artifactDamageProfile(artifacts),
    critSiPlusRapide: monsterCritSiPlusRapide(detail),
    bonusDegatsSelonVit: monsterBonusDegatsSelonVit(detail),
    bonusDegatsStack: monsterBonusDegatsStackable(detail),
    monsterWide: {
      critRateSelonVit: monsterCritRateSelonVit(detail) ?? undefined,
      bonusStatFixe: monsterBonusStatFixe(detail) ?? undefined,
      bonusFixeCiblePvMax: monsterBonusFixeCiblePvMax(detail) ?? undefined,
      bonusEcartDef: monsterBonusEcartDef(detail) ?? undefined,
      bonusFixeMaxHpPropre: monsterBonusFixeMaxHpPropre(detail) ?? undefined,
      bonusSacrifice: monsterBonusSacrifice(detail) ?? undefined,
      bonusParEffetCible: monsterBonusParEffetCible(detail) ?? undefined,
      bonusParEffetPropre: monsterBonusParEffetPropre(detail) ?? undefined,
    },
    bonusDegatsConditionnel: monsterBonusDegatsConditionnel(detail),
    bonusDegatsSelonCr: monsterBonusDegatsSelonCr(detail),
    bonusDegatsSelonDef: monsterBonusDegatsSelonDef(detail),
    bonusSiAtqSeuil: monsterBonusSiAtqSeuil(detail),
  };
}
