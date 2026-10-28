import { photographierPointOptimizer, lirePointOptimizer } from '../src/lib/optimizerBackup';
import { setPersistence } from '../src/hooks/usePersistence';
import type { ExclusionSelector } from '../src/lib/optimizerExclusion';
import { monterListesOptimizer } from './optimizer-lists-harness';
import { donneesPointOptimizer } from './optimizer-backup.test';
import { egal, faussLocalStorage, ok, titre } from './outils';

const LISTES = 'swblacksmith-optimizer-lists-v1';
const membre: ExclusionSelector = { source: 'box', unitKey: '11' };

export function testOptimizerReliqueValideeMemorisee() {
  titre('Listes Optimizer · la relique d’un build validé est mémorisée et relue');
  const mem = faussLocalStorage({ [LISTES]: JSON.stringify({ lists: [{ id: 'a', name: 'Alpha' }], members: [], validated: [], activeListId: 'a' }) });
  setPersistence(true);
  const h = monterListesOptimizer(); let listes = h.render();
  listes.validateBuild('a', membre, [1, 2, 3, 4, 5, 6], [71], 701, 10101); listes = h.render();
  egal(listes.validated[0].reliqueId, 701, 'validation : relique de la carte mémorisée');
  listes.validateArtifacts('a', membre, [72]); listes = h.render();
  egal(listes.validated[0].reliqueId, 701, 'nouvelle paire seule : relique gardée');
  const relu = monterListesOptimizer().render();
  egal(relu.validated[0].reliqueId, 701, 'rechargement : relique relue');
  listes.validateBuild('a', membre, [1, 2, 3, 4, 5, 6], [71], undefined, 10101); listes = h.render();
  ok(!('reliqueId' in listes.validated[0]), 'validation sans relique : aucun champ écrit');

  const brut = JSON.parse(mem.get(LISTES)!);
  brut.validated = [{ listId: 'a', selector: membre, runeIds: [1, 2, 3, 4, 5, 6], artifactIds: [71], reliqueId: 'abîmée' },
    { listId: 'a', selector: { source: 'box', unitKey: '22' }, runeIds: [7, 8, 9, 10, 11, 12] }];
  faussLocalStorage({ [LISTES]: JSON.stringify(brut) });
  const tolere = monterListesOptimizer().render();
  egal(tolere.validated.length, 2, 'relique illisible ou absente : builds gardés');
  ok(tolere.validated.every(v => v.reliqueId === undefined), 'relique illisible perdue seule, build ancien sans relique');
  egal(tolere.validated[0].artifactIds, [71], 'relique illisible : paire intacte');
}

export function testOptimizerReliqueValideePoint() {
  titre('Point Optimizer · relique d’un build validé, aller-retour et lecture défensive');
  const s = donneesPointOptimizer();
  s.validated[0] = { ...s.validated[0], reliqueId: 701 };
  const p = photographierPointOptimizer(s, null, new Date('2026-10-28T12:00:00Z'));
  egal(lirePointOptimizer(JSON.stringify(p)).point?.historique.validated[0].reliqueId, 701, 'relique conservée par le point');
  for (const reliqueId of ['701', -1, 1.5]) {
    const abime = { ...p, historique: { ...p.historique, validated: [{ ...p.historique.validated[0], reliqueId }] } };
    ok(lirePointOptimizer(JSON.stringify(abime)).point === null, `relique ${JSON.stringify(reliqueId)} : point refusé comme tout identifiant abîmé`);
  }
}
