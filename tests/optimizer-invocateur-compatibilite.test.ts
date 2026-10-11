import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from '../src/lib/damage';
import { lireCompetencesInvocateur } from '../src/lib/competencesInvocateur';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { baseCompleteCriteres, photoCriteres } from '../src/lib/criteresOptimizer';
import { cleMemoireMembre, lireMembresOptimizer } from '../src/lib/optimizerMemberStorage';
import { composerSession, lireSession } from '../src/lib/session';
import { photoOptimizer } from '../src/lib/sessionOptimizer';
import type { OptimizerState } from '../src/hooks/useOptimizerState';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { egal, ok, titre } from './outils';

export function testOptimizerContenuInvocateurCompatibilite() {
  titre('Optimizer · ancienne valeur invocateur : recette, mémoire, session et script');
  const ancien = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'combat' } as unknown as DamageSetup;
  egal((photoOptimizer({ damageSetup: ancien } as OptimizerState).damageSetup as DamageSetup).summonerSkills, 'normal', 'photo session : ancienne valeur normalisée');
  egal(lireCompetencesInvocateur('combat'), 'normal', 'ancien mode traduit');
  egal(lireCompetencesInvocateur('inconnu'), null, 'mode inconnu refusé');
  const recette = buildOptimizerRecipe({ monsterCom2usId: 14104, monsterName: 'Lushen', damageSetup: ancien,
    requirement: { sets: ['swift'], minStats: {} }, objective: 'degats_reels', metric: 'eff', slotFilterPreset: 'moyen',
    adaptiveTrancheWeighting: false, exhaustiveSearch: false, excludeUsedRunes: false, excludeUsedScope: 'box',
    excludedSelectors: [], ignoreArtifacts: false, artifactMainByKind: {} });
  egal(recette.damageSetup.summonerSkills, 'normal', 'écriture de recette canonique');
  const legacy = { ...recette, damageSetup: ancien };
  const relue = parseOptimizerRecipe(JSON.stringify(legacy));
  ok(!!relue.recipe && !relue.avertissements?.length, 'ancienne recette acceptée sans perte');
  egal(relue.recipe?.damageSetup.summonerSkills, 'normal', 'lecture de recette canonique');
  if (relue.recipe) egal(buildRealDamageContext(relue.recipe, 14104, [])?.setup.summonerSkills, 'normal', 'script : contexte canonique');
  egal(buildRealDamageContext(legacy, 14104, [])?.setup.summonerSkills, 'normal', 'script : constructeur direct compatible');
  const criteres = { ...baseCompleteCriteres(undefined), damageSetup: ancien };
  egal(photoCriteres(criteres, { type: 'personnel' }).damageSetup.summonerSkills, 'normal', 'capture de critères canonique');
  const selector = { source: 'box' as const, unitKey: '1' }, cle = cleMemoireMembre('a', selector);
  const memoire = lireMembresOptimizer(JSON.stringify({ memories: [[cle, { listId: 'a', selector, com2usId: 14104, criteres }]], teams: [], listContents: [] }));
  egal(memoire.memories.get(cle)?.criteres.damageSetup.summonerSkills, 'normal', 'mémoire ancienne relue');
  egal(memoire.rapport, [], 'mémoire compatible sans rejet');
  const session = composerSession({ maintenant: new Date('2026-01-01'), versionApp: 'test', stockage: {}, compte: null, memoire: {}, optimizer: { damageSetup: ancien } });
  egal((session.outils.optimizer?.damageSetup as DamageSetup).summonerSkills, 'normal', 'session écrite en valeur canonique');
  session.outils.optimizer!.damageSetup = ancien;
  const lecture = lireSession(JSON.stringify(session));
  ok(lecture.ok, 'ancienne session acceptée');
  if (lecture.ok) egal((lecture.session.outils.optimizer?.damageSetup as DamageSetup).summonerSkills, 'normal', 'session ancienne traduite');
  egal((ancien as unknown as { summonerSkills: string }).summonerSkills, 'combat', 'sources anciennes intactes');
}
