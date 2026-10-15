import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { photographierPointOptimizer, lirePointOptimizer, preparerRepriseOptimizer, OPTIMIZER_BACKUP_STORAGE_KEY } from '../src/lib/optimizerBackup';
import { cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer, reverifierStockageOptimizer, OPTIMIZER_MEMBERS_STORAGE_KEY, type StockageOptimizer } from '../src/lib/optimizerMemberStorage';
import { otherValidatedArtifactIds, otherValidatedRuneIds, resolveExclusionEntry, type ExclusionSourceData } from '../src/lib/optimizerExclusion';
import type { Monster } from '../src/types';
import { monterListesOptimizer } from './optimizer-lists-harness';
import { setPersistence, lireTravail } from '../src/hooks/usePersistence';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { composerSession, ecrireSession, lireSession, CLES_SESSION } from '../src/lib/session';
import { lireSession as lireAncienneSession } from './fixtures/lecteur-session-v1';
import { egal, faussLocalStorage, ok, titre } from './outils';

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

export function testOptimizerPointMemoireMemeGeste() {
  titre('Point Optimizer · écriture de mémoire puis sauvegarde dans le même geste');
  const s = donneesPointOptimizer(), data = comptePoint(), membre = s.members[0];
  data.box = data.box.map(item => ({ ...item, key: '11' }));
  faussLocalStorage({ 'swblacksmith-optimizer-lists-v1': JSON.stringify(s),
    [OPTIMIZER_MEMBERS_STORAGE_KEY]: ecrireMembresOptimizer(s) });
  setPersistence(true);
  const h = monterListesOptimizer(); let listes = h.render();
  const criteres = { ...baseCompleteCriteres(undefined), minStats: { spd: 321 } };
  listes.writeMemory({ ...membre, com2usId: 10101 }, criteres, data);
  listes.sauvegarderPoint(membre, data);
  listes = h.render();
  const point = listes.point!, memorise = lireMembresOptimizer(point.membres), cle = cleMemoireMembre(membre.listId, membre.selector);
  egal(listes.memories.get(cle)?.criteres.minStats.spd, 321, 'précondition : écriture de mémoire acceptée');
  egal(memorise.memories.get(cle)?.criteres.minStats.spd, 321, 'point : mémoire écrite avant la sauvegarde, sans rendu intermédiaire');
  ok(isDeepStrictEqual(memorise.memories, listes.memories), 'point : toutes les mémoires courantes photographiées');
  egal(point.historique.activeListId, 'a', 'point : liste active courante');
  egal(point.selection, membre, 'point : sélection conservée');
  listes.writeMemory({ ...membre, com2usId: 10101 }, { ...criteres, minStats: { spd: 444 } }, data);
  egal(lireMembresOptimizer(point.membres).memories.get(cle)?.criteres.minStats.spd, 321, 'point détaché : une écriture suivante ne change pas la photo');
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

export function testOptimizerPointSessionIllisibleConserve() {
  titre('Point Optimizer · texte cassé transporté sans rendre la session illisible');
  const s = donneesPointOptimizer(), brut = '{';
  const cleListes = 'swblacksmith-optimizer-lists-v1', cleRta = 'swblacksmith-rta-v1';
  const session = composerSession({ maintenant: new Date('2026-10-09T12:00:00Z'), versionApp: 'test', compte: null,
    stockage: { [OPTIMIZER_BACKUP_STORAGE_KEY]: brut, [cleListes]: JSON.stringify(s),
      [OPTIMIZER_MEMBERS_STORAGE_KEY]: ecrireMembresOptimizer(s), [cleRta]: '{"entries":{}}', 'swblacksmith-theme-v1': 'dark' },
    memoire: {}, optimizer: null });
  const relue = lireSession(ecrireSession(session));
  ok(relue.ok, 'session contenant un point au JSON cassé relue');
  if (!relue.ok) return;
  egal(relue.session.stockage[OPTIMIZER_BACKUP_STORAGE_KEY], brut, 'texte opaque du point gardé octet pour octet');
  egal(relue.session.stockage[cleRta], '{"entries":{}}', 'prépa RTA transportée malgré le point cassé');
  egal(relue.session.stockage['swblacksmith-theme-v1'], 'dark', 'réglage transporté malgré le point cassé');
  const mem = faussLocalStorage(relue.session.stockage as Record<string, string>);
  setPersistence(true);
  const listes = monterListesOptimizer().render();
  egal(listes.lists, s.lists, 'listes de travail reprises');
  egal(listes.members, s.members, 'membres repris');
  egal(listes.validated, s.validated, 'builds repris');
  ok(isDeepStrictEqual(listes.memories, s.memories) && isDeepStrictEqual(listes.teams, s.teams), 'mémoires et équipes reprises');
  ok(listes.pointExiste && !listes.point && listes.rapportPoint.some(m => m.includes('illisible')),
    'lecteur spécialisé : point toujours signalé, reprise indisponible');
  egal(mem.get(OPTIMIZER_BACKUP_STORAGE_KEY), brut, 'point cassé conservé après rechargement du hook');
  ok(!lireSession(JSON.stringify({ ...session, stockage: { ...session.stockage, [cleListes]: brut } })).ok,
    'autre clé JSON cassée : validation de session toujours stricte');
  ok(!lireSession(JSON.stringify({ ...session, stockage: { ...session.stockage, [OPTIMIZER_BACKUP_STORAGE_KEY]: {} } })).ok,
    'point non textuel : session toujours refusée');
}

function comptePoint(): ExclusionSourceData {
  const monstre: Monster = { id: 1, com2usId: 10101, name: 'Premier', element: 'fire', archetype: 'attack', stars: 6,
    naturalStars: 5, secondAwaken: false, image: null, leaderSkill: null,
    stats: { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 } };
  const autre: Monster = { ...monstre, id: 2, com2usId: 10102, name: 'Second' };
  return { box: [{ key: 'nouveau', monster: monstre, level: 40, stars: 6, gear: { base: { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] } }],
    rtaEntries: {}, siegeDefenseTeams: [{ id: 'defense', lead: 0, tickAlertDismissed: false,
      slots: [{ monsterId: '2', runeSpeed: 0, tick: 0 }, { monsterId: null, runeSpeed: null, tick: 0 }, { monsterId: null, runeSpeed: null, tick: 0 }] }],
    siegeOffenseTeams: [], monsterById: new Map([['1', monstre], ['2', autre]]) };
}

export function testOptimizerPointRepriseRattachement() {
  titre('Point Optimizer · reprise et réimport, slot remplacé et pièces disparues');
  const s = donneesPointOptimizer(), avant = { source: 'siege-defense' as const, teamId: 'defense', slotIndex: 0 };
  const cleAvant = cleMemoireMembre('a', s.members[0].selector), identite = s.identities.get(cleAvant)!;
  s.members[0].selector = avant; s.validated[0].selector = avant;
  s.identities = new Map([[cleMemoireMembre('a', avant), { ...identite, selector: avant }]]);
  s.memories = new Map([[cleMemoireMembre('a', avant), { ...s.memories.get(cleAvant)!, selector: avant }]]);
  s.teams[0].members[0] = avant; s.teams[0].leader = avant;
  const point = photographierPointOptimizer(s, s.members[0], new Date('2026-10-09T12:00:00Z'));
  const compte = comptePoint(), runes = new Set([1, 2, 3, 4, 5]), arts = new Set([71]);
  const r = preparerRepriseOptimizer(point, compte, runes, arts), build = r.stockage.validated[0];
  egal(r.stockage.members.length, 2, 'aucun membre retiré'); egal(r.stockage.validated.length, 1, 'aucun build retiré');
  egal(resolveExclusionEntry(r.selection!.selector, compte)?.monster.com2usId, 10101, 'sélection rattachée à la bonne espèce, autre occupant ignoré');
  egal(r.stockage.teams[0].leader, r.selection!.selector, 'leader et place en équipe suivent le membre');
  egal(r.stockage.memories.get(cleMemoireMembre('a', r.selection!.selector))?.criteres.minStats.spd, 230, 'mémoire suit avec ses critères personnels');
  egal(build.runeIds, [1, 2, 3, 4, 5, 6], 'rune disparue gardée dans le build'); egal(build.artifactIds, [71, 72], 'artéfact disparu gardé dans le build');
  egal([...otherValidatedRuneIds(r.stockage.validated, 'a', null)], [1, 2, 3, 4, 5], 'rune disparue non réservée');
  egal([...otherValidatedArtifactIds(r.stockage.validated, 'a', null)], [71], 'artéfact disparu non réservé');
  ok(r.messages.some(m => m.includes('rattaché')) && r.messages.some(m => m.includes('1 artéfact(s) absent(s)')), 'rattachement et artéfact absent dits');
  ok(isDeepStrictEqual(r.stockage.rejets, s.rejets) && isDeepStrictEqual(r.stockage.listContents, s.listContents), 'rejets et contenus intacts');
  const reimport = reverifierStockageOptimizer({ ...lireMembresOptimizer(point.membres), ...point.historique }, compte, runes, arts);
  ok(isDeepStrictEqual(reimport.stockage, r.stockage), 'même calcul à la reprise et au réimport');
  const retour = reverifierStockageOptimizer(r.stockage, compte, new Set([1, 2, 3, 4, 5, 6]), new Set([71, 72]));
  ok(!retour.stockage.validated[0].runesManquantes && !retour.stockage.validated[0].artefactsManquants, 'pièces revenues : marques levées');
  egal([...otherValidatedArtifactIds(retour.stockage.validated, 'a', null)], [71, 72], 'pièces revenues : réservations rétablies');
  faussLocalStorage({ 'swblacksmith-optimizer-lists-v1': JSON.stringify({ ...r.stockage, activeListId: 'a' }) });
  setPersistence(true);
  const h = monterListesOptimizer(); let listes = h.render();
  egal(listes.validated[0].artefactsManquants, [72], 'rechargement : marque des artéfacts disparus conservée');
  egal([...otherValidatedArtifactIds(listes.validated, 'a', null)], [71], 'rechargement : artéfact absent toujours non réservé');
  listes.validateArtifacts('a', build.selector, [71, 73]); listes = h.render();
  ok(!listes.validated[0].artefactsManquants, 'nouvelle paire explicitement validée : ancienne marque effacée');
  listes.releaseArtifacts('a', build.selector); listes = h.render();
  egal(listes.validated[0].artifactIds, [], 'paire rendue : aucune réservation restante');
  ok(!listes.validated[0].artefactsManquants, 'paire rendue : aucune ancienne marque restante');
  const app = readFileSync('src/App.tsx', 'utf8');
  ok(app.includes('data, runeIds, new Set(artifacts.map(a => a.id))'), 'réimport branché sur l’inventaire complet des artéfacts');
}

export function testOptimizerPointRepriseCompteVide() {
  titre('Point Optimizer · compte vide, reprise sans jugement');
  const s = donneesPointOptimizer(), data = comptePoint(); data.box = [];
  const point = photographierPointOptimizer(s, s.members[0], new Date('2026-10-09T12:00:00Z'));
  const r = preparerRepriseOptimizer(point, data, new Set(), new Set());
  ok(r.rapport.compteVide, 'RTA et siège seuls ne permettent pas de juger');
  egal(r.stockage.members, s.members, 'références inchangées'); egal(r.stockage.validated, s.validated, 'builds et marques inchangés');
  egal(r.brutMembres, point.membres, 'texte et rejets conservés sans réécriture');
  ok(r.messages.some(m => m.includes('Compte vide') && m.includes('sans revérification')), 'absence de revérification explicitement dite');
  egal(r.selection, point.selection, 'sélection conservée dans la photo sans attribution forcée');
}

export function testOptimizerPointSuppressionConservation() {
  titre('Point Optimizer · suppression d’une liste, miroir et rechargement');
  const s = donneesPointOptimizer(), mem = faussLocalStorage({ 'swblacksmith-optimizer-lists-v1': JSON.stringify(s) });
  setPersistence(true);
  const h = monterListesOptimizer(); let listes = h.render();
  setPersistence(false);
  listes.sauvegarderPoint(null, comptePoint()); listes = h.render();
  const brut = lireTravail(OPTIMIZER_BACKUP_STORAGE_KEY);
  ok(!!brut && !mem.has(OPTIMIZER_BACKUP_STORAGE_KEY), 'sans conservation : point dans le miroir seul');
  listes.deleteList('a'); listes = h.render();
  egal(lireTravail(OPTIMIZER_BACKUP_STORAGE_KEY), brut, 'supprimer une liste garde le point');
  egal(listes.point?.historique.lists.length, 2, 'photo encore complète après suppression');
  setPersistence(true); listes = h.render();
  egal(mem.get(OPTIMIZER_BACKUP_STORAGE_KEY), brut, 'activation : point écrit depuis le miroir');
  const relu = monterListesOptimizer().render();
  egal(relu.point, listes.point, 'point relu au rechargement du hook');
  mem.set(OPTIMIZER_BACKUP_STORAGE_KEY, '{"version":99}');
  const abime = monterListesOptimizer().render();
  ok(abime.pointExiste && !abime.point && abime.rapportPoint.length > 0, 'point illisible existe et reste signalé');
  egal(mem.get(OPTIMIZER_BACKUP_STORAGE_KEY), '{"version":99}', 'point illisible jamais supprimé à la lecture');
}
