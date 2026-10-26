import { createElement } from 'react';
import { COLONNES_RESULTATS, triDesResultats } from '../src/lib/colonnesResultats';
import { OBJECTIVE_LABELS, scoreDuCandidat, sortCandidates } from '../src/lib/runeBuildOptim';
import { candidatAvecSaPaire } from '../src/lib/artifactQueue';
import { contexteResultat, optionsDuContexte } from '../src/lib/contexteResultat';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { lireMembresOptimizer } from '../src/lib/optimizerMemberStorage';
import EnteteResultats from '../src/components/outils/optimizer/EnteteResultats';
import { classerPourLaPage, fixtureClassementCombat } from './classement-fixture';
import { rendre } from './rendu/outils-rendu';
import { egal, ok, titre } from './outils';

/**
 * L'objectif de recherche Vitesse reste ; son tri est la colonne VIT. La note
 * « vitesse » et celle de la colonne VIT sont égales candidat par candidat,
 * relique résolue comprise : l'ordre ne change pas, seule la colonne existe.
 */
export function testObjectifVitesseMigration() {
  titre('Résultats — le tri par l’objectif Vitesse devient la colonne VIT, l’objectif de recherche reste');
  egal(triDesResultats('vitesse'), 'spd', 'un tri « vitesse » se lit VIT');
  ok(COLONNES_RESULTATS.every((c) => triDesResultats(c) === c), 'les onze colonnes se lisent telles quelles');
  ok(!(COLONNES_RESULTATS as readonly string[]).includes('vitesse'), 'Vitesse n’est pas une colonne de tri');
  ok(OBJECTIVE_LABELS.some((o) => o.key === 'vitesse'), 'Vitesse reste un objectif de recherche');

  // Notes égales, sur les stats collectées puis sur celles de la vraie paire
  // avec l'effet unique de la relique retenue.
  const f = fixtureClassementCombat('ehp');
  const { projection } = classerPourLaPage(f.photo, f.candidats, f.vue);
  const base = optionsDuContexte(f.photo, null, 'eff'), resolues = optionsDuContexte(f.photo, projection.parBuild, 'eff');
  const projetes = f.candidats.map((c) => candidatAvecSaPaire(c, projection.parBuild));
  ok(projection.parBuild.size > 0 && [...projection.parBuild.values()].some((r) => r.relique), 'des builds ont une relique résolue');
  ok(f.candidats.every((c) => Object.is(scoreDuCandidat(c, 'vitesse', base), scoreDuCandidat(c, 'spd', base)))
    && projetes.every((c) => Object.is(scoreDuCandidat(c, 'vitesse', resolues), scoreDuCandidat(c, 'spd', resolues))),
  'note « vitesse » = note VIT, candidat par candidat (Object.is), stats collectées et résolues');

  // Une recherche lancée sur Vitesse : la vue de départ suit le lancement,
  // l'ordre de base est celui de l'objectif, une seule note par candidat.
  const vitesse = contexteResultat({ ...f.photo, params: { ...f.params, objective: 'vitesse' } });
  const lancee = classerPourLaPage(vitesse, f.candidats, { ...f.vue, tri: triDesResultats('vitesse') });
  egal(lancee.projection.base.map((c) => c.runeIds.join()), sortCandidates(f.candidats, 'vitesse', optionsDuContexte(vitesse, null, 'eff')).map((c) => c.runeIds.join()),
    'recherche Vitesse : ordre de base = tri par l’objectif Vitesse');
  egal(lancee.corps.travail.notes, f.candidats.length, 'recherche Vitesse, vue VIT : un seul critère noté (la vue suit le lancement)');

  // Mémoire de membre et session : un tri « vitesse » enregistré se relit VIT.
  const criteres = { ...baseCompleteCriteres(undefined), sortBy: 'vitesse' };
  const lu = lireMembresOptimizer(JSON.stringify({ memories: [['l1|box:11', { listId: 'l1', selector: { source: 'box', unitKey: '11' }, com2usId: 10001, criteres }]], teams: [] }));
  egal(lu.memories.get('l1|box:11')?.criteres.sortBy, 'spd', 'mémoire de membre : « vitesse » relu VIT, la mémoire reste valide');
  egal(lu.rapport, [], 'mémoire de membre : relecture silencieuse (même ordre)');

  // « Trier par » : VIT dans les stats, plus d'option « Vitesse » parmi les objectifs.
  const html = rendre(createElement(EnteteResultats, {
    result: { nombre: 3, explored: 10, truncated: false, nearMissByCondition: [], globalNearMiss: null },
    compteConfirmes: { confirmees: 3, nonVerifies: 0, pages: 1, aucune: false }, avecFile: false, tri: { tri: 'spd', sens: 'desc' },
    trier: () => {}, metric: 'eff', disponible: (c: string) => c !== 'degats_reels', enAttente: 0, compteAffiche: { compte: 3, ecartes: 0, raison: null },
  }));
  ok(/<option[^>]*value="spd"/.test(html) && !/<option[^>]*value="vitesse"/.test(html), '« Trier par » : VIT proposé, l’objectif Vitesse absent');
  ok(/<option[^>]*value="efficience"/.test(html) && /<option[^>]*value="ehp"/.test(html), '« Trier par » : les autres objectifs restent');
}
