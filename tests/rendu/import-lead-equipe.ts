import type { CriteresOptimizer } from '../../src/lib/criteresOptimizer';

// Un membre importé dans une équipe à lead actif porte ce lead comme lead
// personnel : il remplace tout lead antérieur, ancien champ de VIT compris.
export function ajouterLeadEquipe(criteres: CriteresOptimizer, lead: { stat: 'HP' | 'Attack Speed'; pct: number }) {
  delete criteres.damageSetup.leaderSkill;
  delete criteres.damageSetup.leaderSpeedPct;
  criteres.damageSetup.leaderSkill = { ...lead };
}
