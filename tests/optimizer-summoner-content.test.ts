import { combatSelonContenuListeOptimizer } from '../src/lib/combatListeOptimizer';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { egal, ok, titre } from './outils';

export function testOptimizerCompetencesContenu() {
  titre('Optimizer · compétences effectives selon le contenu et recette au CLI');
  for (const ancien of ['normal', 'guilde'] as const) {
    const personnel = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: ancien, enemyDef: 2345, leaderSkill: { stat: 'HP' as const, pct: 33 } };
    const initial = JSON.stringify(personnel);
    for (const contenu of ['arene', 'donjon', 'guilde', undefined] as const) {
      const combat = combatSelonContenuListeOptimizer(personnel, contenu);
      egal(combat.summonerSkills, contenu === 'guilde' ? 'guilde' : 'normal', `${ancien}, contenu ${contenu} : mode dérivé`);
      egal(combat.enemyDef, 2345, 'contexte du combat conservé');
      egal(combat.leaderSkill, personnel.leaderSkill, 'lead personnel conservé');
      egal(JSON.stringify(personnel), initial, 'critères enregistrés intacts');
      const recette = buildOptimizerRecipe({ monsterCom2usId: 14104, monsterName: 'Lushen', damageSetup: combat,
        requirement: { sets: ['swift'], minStats: {} }, objective: 'degats_reels', metric: 'eff', slotFilterPreset: 'moyen',
        exhaustiveSearch: false, excludeUsedRunes: false, excludeUsedScope: 'box',
        excludedSelectors: [], ignoreArtifacts: false, artifactMainByKind: {} });
      const relue = parseOptimizerRecipe(JSON.stringify(recette)).recipe!;
      egal(relue.damageSetup.summonerSkills, combat.summonerSkills, 'recette : valeur effectuelle relue');
      const cli = buildRealDamageContext(relue, 14104, []);
      ok(!!cli, 'CLI : contexte réel construit depuis la recette');
      egal(cli?.setup.summonerSkills, combat.summonerSkills, 'CLI sans liste : même mode que la recherche exportée');
    }
  }
}
