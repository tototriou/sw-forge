import { isDeepStrictEqual } from 'node:util';
import { photographierPointOptimizer, lirePointOptimizer, OPTIMIZER_BACKUP_STORAGE_KEY } from '../src/lib/optimizerBackup';
import { cleMemoireMembre, lireMembresOptimizer, type StockageOptimizer } from '../src/lib/optimizerMemberStorage';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { composerSession, ecrireSession, lireSession, CLES_SESSION } from '../src/lib/session';
import { lireSession as lireAncienneSession } from './fixtures/lecteur-session-v1';
import { egal, ok, titre } from './outils';

export function donneesPointOptimizer(): StockageOptimizer & { activeListId: string | null } {
  const a = { source: 'box' as const, unitKey: '11' }, b = { source: 'box' as const, unitKey: '22' };
  const identite = { listId: 'a', selector: a, com2usId: 10101 };
  return { lists: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bêta' }], activeListId: 'a',
    members: [a, b].map(selector => ({ listId: 'a', selector })),
    validated: [{ listId: 'a', selector: a, runeIds: [1, 2, 3, 4, 5, 6], artifactIds: [71, 72], runesManquantes: [6] }],
    identities: new Map([[cleMemoireMembre('a', a), identite]]),
    memories: new Map([[cleMemoireMembre('a', a), { ...identite, criteres: { ...baseCompleteCriteres(undefined), minStats: { spd: 230 } } }]]),
    teams: [{ id: 'e', listId: 'a', members: [a, b], leader: a, lead: { stat: 'SPD', amount: 24, area: 'Arena', element: null } }],
    listContents: new Map([['a', 'arene'], ['b', 'donjon']]),
    rejets: { memories: [['inutilisable', { listId: 'a', futur: true }]], teams: [{ listId: 'b', futur: true }],
      listContents: [{ listId: 'b', contenu: 'futur' }], identities: [['identite-abimee', { listId: 'a' }]] } };
}

export function testOptimizerPointAllerRetourComplet() {
  titre('Point Optimizer · photo détachée et relecture complète');
  const s = donneesPointOptimizer(), selection = s.members[0];
  const p = photographierPointOptimizer(s, selection, new Date('2026-10-09T12:00:00Z'));
  const relu = lirePointOptimizer(JSON.stringify(p));
  ok(!!relu.point, 'point valide relu');
  const m = lireMembresOptimizer(relu.point!.membres);
  for (const champ of ['identities', 'memories', 'teams', 'listContents', 'rejets'] as const)
    ok(isDeepStrictEqual(m[champ], s[champ]), `${champ} : aller-retour sans perte`);
  egal(relu.point!.historique, { lists: s.lists, members: s.members, validated: s.validated, activeListId: s.activeListId }, 'listes, membres, builds, artéfacts et sélection active');
  s.lists[0].name = 'Modifiée'; s.validated[0].artifactIds!.push(73); s.memories.values().next().value!.criteres.minStats.spd = 180;
  egal(p.historique.lists[0].name, 'Alpha', 'nom de la photo indépendant');
  egal(p.historique.validated[0].artifactIds, [71, 72], 'réservations de la photo indépendantes');
  egal(lireMembresOptimizer(p.membres).memories.values().next().value?.criteres.minStats.spd, 230, 'mémoire de la photo indépendante');
}

export function testOptimizerPointLectureDefensive() {
  titre('Point Optimizer · aucune reprise partielle d’une photo abîmée');
  const p = photographierPointOptimizer(donneesPointOptimizer(), null, new Date('2026-10-09T12:00:00Z'));
  for (const v of ['{', 'null', JSON.stringify({ ...p, version: 2 }), JSON.stringify({ ...p, date: 'inconnue' }),
    JSON.stringify({ ...p, historique: { ...p.historique, validated: [{ ...p.historique.validated[0], runeIds: ['1'] }] } }),
    JSON.stringify({ ...p, membres: '{' })]) {
    const lu = lirePointOptimizer(v); ok(lu.point === null && lu.rapport.length > 0, 'photo abîmée refusée et dite');
  }
  const ancien = { ...p, selection: undefined };
  ok(lirePointOptimizer(JSON.stringify(ancien)).point?.selection === null, 'sélection absente tolérée');
  const brut = JSON.stringify({ ...JSON.parse(p.membres), futur: { intact: true }, memories: [['invalide', {}]] });
  const tolere = lirePointOptimizer(JSON.stringify({ ...p, membres: brut })).point!;
  egal(tolere.membres, brut, 'texte indépendant gardé avec champs futurs');
  ok(lireMembresOptimizer(tolere.membres).rejets.memories.length > 0, 'entrée malformée conservée sans application');
}

export function testOptimizerPointSessionRelue() {
  titre('Point Optimizer · transport de session et version systématique');
  const p = photographierPointOptimizer(donneesPointOptimizer(), null, new Date('2026-10-09T12:00:00Z'));
  const brut = JSON.stringify(p);
  ok(CLES_SESSION.includes(OPTIMIZER_BACKUP_STORAGE_KEY), 'clé du point dans la session');
  const session = composerSession({ maintenant: new Date(p.date), versionApp: 'test', compte: null,
    stockage: { [OPTIMIZER_BACKUP_STORAGE_KEY]: brut }, memoire: {}, optimizer: null });
  const relue = lireSession(ecrireSession(session));
  ok(relue.ok, 'session relue');
  if (!relue.ok) return;
  egal(relue.session.stockage[OPTIMIZER_BACKUP_STORAGE_KEY], brut, 'point conservé octet pour octet');
  egal(relue.session.version, 2, 'session toujours en version 2');
  const ancienne = lireAncienneSession(ecrireSession(session));
  ok(!ancienne.ok && ancienne.erreur.includes('mets-la à jour'), 'session contenant le point refusée par le lecteur précédent');
  egal(lireSession(ecrireSession({ ...session, version: 1 })).ok, true, 'réécriture ancienne session relisible');
  egal(JSON.parse(ecrireSession({ ...session, version: 1 })).version, 2, 'réécriture de version 1 en version 2');
}
