import { isDeepStrictEqual } from 'node:util';
import { egal, ok, titre } from './outils';
import type { GearSet, LeaderSkill, Monster, SiegeTeam } from '../src/types';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { appliquerCriteres } from '../src/lib/criteresOptimizer';
import { leadEffectifMembreOptimizer } from '../src/lib/equipesOptimizer';
import { exclusionSelectorKey, type ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer, type StockageOptimizer } from '../src/lib/optimizerMemberStorage';
import { consommerImportOptimizer, importerDefensesSiegeOptimizer, importerOffenseSiegeOptimizer, importerPrepaRtaOptimizer, type ImportOptimizer } from '../src/lib/importEquipes';

const lead: LeaderSkill = { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null };
function monstre(id: number): Monster {
  return { id, com2usId: 1000 + id, name: `Monstre ${id}`, element: id === 2 ? 'water' : 'fire',
    stars: 5, naturalStars: 5, secondAwaken: false, image: null,
    stats: { hp: 10000, attack: 700, defense: 600, speed: 101, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
    leaderSkill: id === 1 ? { ...lead } : null };
}
const gear = (relique = false): GearSet => ({
  base: { hp: 10000, atk: 700, def: 600, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [],
  ...(relique ? { relic: { id: 50, upgrade: 15, main: { code: 100, value: 20 } } } : {}),
});
function deck(id: string, ids: (number | null)[] = [1, 2, 1]): SiegeTeam {
  return { id, lead: 99, tickAlertDismissed: false, slots: ids.map((m, i) => ({
    monsterId: m === null ? null : String(m), runeSpeed: i === 0 ? 126 : null,
    tick: 300, sets: ['swift'], gear: gear(i === 0),
  })) };
}
function sources(): ExclusionSourceData {
  return { box: [{ key: 'copie-box-1', monster: monstre(1), stars: 6, level: 40, gear: gear() }], rtaEntries: {
    '1': { monsterId: '1', section: 'swift', runeSpeed: 126, gear: gear(true), sets: ['swift'] },
    '2': { monsterId: '2', section: 'Non classé', runeSpeed: null, gear: gear() },
  }, siegeDefenseTeams: [deck('d1'), deck('d2', [1, 2, null])],
  siegeOffenseTeams: [deck('o1'), deck('o2', [2, null, null])],
  monsterById: new Map([1, 2, 3, 4, 5, 6].map(id => [String(id), monstre(id)])) };
}
function stockage(): StockageOptimizer {
  const selector = { source: 'rta' as const, monsterId: '1' };
  const criteres = baseCompleteCriteres(undefined);
  criteres.comboSets = ['violent']; criteres.minStats = { hp: 50000 }; criteres.maxStats = { spd: 150 };
  criteres.damageSetup.leaderSkill = { stat: 'HP', pct: 33 }; criteres.objective = 'ehp';
  return { identities: new Map(), lists: [{ id: 'ancienne', name: 'Prépa RTA' }, { id: 'autre', name: 'Prépa RTA (2)' }],
    members: [{ listId: 'ancienne', selector }, { listId: 'ancienne', selector: { source: 'rta', monsterId: '2' } }],
    validated: [{ listId: 'ancienne', selector, runeIds: [11, 12, 13, 14, 15, 16], artifactIds: [21, 22] }],
    memories: new Map([[cleMemoireMembre('ancienne', selector), { listId: 'ancienne', selector, com2usId: 1001, criteres }]]),
    teams: [{ id: 'ancienne-equipe', listId: 'ancienne', members: [selector, { source: 'rta', monsterId: '2' }], lead }],
    listContents: new Map([['ancienne', 'arene']]),
    rejets: { listContents: [], memories: [['orpheline|rta:1', { listId: 'orpheline' }]], teams: [{ id: 'nouvelle:equipe:1', listId: 'rejete' }] } };
}
const consommer = (p: ImportOptimizer, data = sources(), etat = stockage(), id = 'nouvelle') =>
  consommerImportOptimizer(etat, 'ancienne', p, data, id);
function memoiresNouvelles(r: ReturnType<typeof consommer>) {
  return [...r.stockage.memories.values()].filter(m => m.listId === r.activeListId);
}

export function testImportEquipesDefensesSiege() {
  titre('Import · défenses, slots précis, même espèce et lead du slot 0');
  const data = sources(), avant = structuredClone(data);
  const p = importerDefensesSiegeOptimizer(data), r = consommer(p, data);
  egal(p.contenu, 'guilde', 'défenses : contenu Guilde proposé');
  egal(r.stockage.listContents.get(r.activeListId!), 'guilde', 'défenses : contenu Guilde stocké sur la liste');
  egal(p.equipes.length, 2, 'une proposition par défense');
  egal(p.membres.map(m => exclusionSelectorKey(m.selector)), ['siege-defense:d1:0', 'siege-defense:d1:1', 'siege-defense:d1:2', 'siege-defense:d2:0', 'siege-defense:d2:1'], 'slots et exemplaires gardés, même sans rune');
  egal(r.rapport.membresImportes, 5, 'deux copies de la même espèce restent distinctes');
  egal(r.rapport.equipesCreees, 2, 'une équipe par défense');
  egal(r.stockage.teams[1].id, 'nouvelle:equipe:1 (2)', 'identifiant d’équipe suffixé contre un rejet préexistant');
  egal(r.stockage.teams.slice(1).map(e => [e.lead, e.leader]), p.equipes.map(e => [lead, e.leader]), 'lead du jeu entier, leader 0');
  ok(isDeepStrictEqual(data, avant), 'producteur et consommateur sans mutation de la source');
}

export function testImportEquipesOffenseSiege() {
  titre('Import · un deck d’offense et aucun remplacement par Box ou défense');
  const data = sources(), p = importerOffenseSiegeOptimizer('o1', data), r = consommer(p, data);
  egal(p.contenu, 'guilde', 'offense : contenu Guilde proposé');
  egal(r.stockage.listContents.get(r.activeListId!), 'guilde', 'offense : contenu Guilde stocké sur la liste');
  egal(data.box[0].monster.com2usId, p.membres[0].com2usId, 'copie Box de la même espèce présente');
  ok(!isDeepStrictEqual(data.box[0].gear, data.siegeOffenseTeams[0].slots[0].gear), 'équipement Box distinct de celui du deck');
  egal(p.membres.map(m => exclusionSelectorKey(m.selector)), ['siege-offense:o1:0', 'siege-offense:o1:1', 'siege-offense:o1:2'], 'uniquement les exemplaires du deck demandé');
  egal(memoiresNouvelles(r)[0].selector, { source: 'siege-offense', teamId: 'o1', slotIndex: 0 }, 'sélecteur du deck conservé jusqu’à la mémoire');
  egal(memoiresNouvelles(r)[0].criteres.relicMainChoice, 'equipped', 'défaut de relique du deck, pas celui de la copie Box sans relique');
  egal(r.rapport.equipesCreees, 1, 'une seule équipe');
  egal(p.equipes[0].lead, lead, 'team.lead = 99 n’est pas importé');
  const absent = consommer(importerOffenseSiegeOptimizer('absent', data), data);
  egal(absent.rapport.listeCreee, null, 'deck absent : pas de liste');
  ok(absent.rapport.messages.some(m => m.includes('introuvable')), 'deck absent nommé au rapport');
}

export function testImportEquipesAnciennesOrphelines() {
  titre('Import · les équipes anciennes orphelines ne bloquent pas une défense valide');
  for (const disparu of ['liste', 'membre']) {
    const data = sources(), etat = stockage();
    data.siegeDefenseTeams = [data.siegeDefenseTeams[0]];
    if (disparu === 'liste') etat.lists = etat.lists.filter(l => l.id !== 'ancienne');
    else etat.members = etat.members.slice(0, 1);
    const avant = structuredClone(etat), ancienneEquipe = etat.teams[0];
    const r = consommer(importerDefensesSiegeOptimizer(data), data, etat);
    egal(r.rapport.membresImportes, 3, `${disparu} introuvable : trois membres importés`);
    egal(r.rapport.equipesCreees, 1, `${disparu} introuvable : nouvelle équipe créée`);
    egal(r.rapport.equipesNonCreees, [], 'aucun refus hérité d’une équipe ancienne');
    ok(r.stockage.teams[0] === ancienneEquipe, 'ancienne équipe conservée telle quelle');
    egal(r.stockage.teams.slice(1).map(e => [e.members.length, e.lead]), [[3, lead]], 'nouvelle équipe complète et lead du slot 0');
    ok(isDeepStrictEqual(etat, avant), 'aucune mutation de l’état initial');
  }
}

export function testImportEquipesPrepaRtaVitesses() {
  titre('Import · toute la prépa RTA, VIT de fiche et base de l’exemplaire');
  const data = sources(), p = importerPrepaRtaOptimizer(data), r = consommer(p, data);
  egal(p.contenu, 'arene', 'prépa RTA : contenu Arène proposé');
  egal(r.stockage.listContents.get(r.activeListId!), 'arene', 'prépa RTA : contenu Arène stocké même sans équipe');
  egal(p.membres.map(m => m.selector), [{ source: 'rta', monsterId: '1' }, { source: 'rta', monsterId: '2' }], 'toutes les sections, exemplaires RTA');
  egal(p.equipes, [], 'aucune équipe RTA');
  egal(p.membres.map(m => m.criteres), [{ vitesse: { minimum: 227 } }, {}], 'base 101 + vitesse 126, Swift déjà compris, vitesse absente sans minimum');
  egal(importerOffenseSiegeOptimizer('o1', data).membres[0].criteres, { vitesse: { minimum: 227 } }, 'même conversion pour le siège, tick et lead exclus');
  const attendus = [baseCompleteCriteres(gear(true)), baseCompleteCriteres(gear())];
  attendus[0].minStats = { spd: 227 };
  egal(memoiresNouvelles(r).map(m => m.criteres), attendus, 'photos complètes, relique réelle, aucun lead RTA ni critère précédent');
}

export function testImportEquipesMonstresInconnus() {
  titre('Import · inconnus, identités inutilisables et équipement absent');
  const data = sources();
  data.siegeDefenseTeams = [deck('d1', [99, 2, null])];
  data.rtaEntries['99'] = { monsterId: '99', section: 'autre', runeSpeed: 100, gear: gear() };
  data.monsterById.get('2')!.com2usId = null;
  delete data.rtaEntries['1'].gear;
  const defense = importerDefensesSiegeOptimizer(data), rta = importerPrepaRtaOptimizer(data);
  egal(defense.ignores.length, 2, 'inconnu et identité invalide, slot vide exclu du rapport');
  egal(rta.ignores.length, 3, 'RTA sans équipement, identité invalide et inconnu');
  ok([...defense.ignores, ...rta.ignores].every(m => m.raison.length > 0), 'une raison par monstre ignoré');
}

export function testImportEquipesVitessesInvalides() {
  titre('Import · vitesses sans équivalence établie');
  for (const valeur of [NaN, Infinity, -1]) {
    const data = sources(); data.rtaEntries['1'].runeSpeed = valeur;
    const p = importerPrepaRtaOptimizer(data);
    egal(p.membres[0].criteres, {}, 'vitesse invalide non importée');
    ok(p.messages.some(m => m.includes('vitesse non importée')), 'conversion refusée dite');
  }
  const data = sources(); data.monsterById.get('1')!.stats.speed = null;
  egal(importerPrepaRtaOptimizer(data).membres[0].criteres, {}, 'base absente : pas de minimum inventé');
  data.monsterById.get('1')!.stats.speed = 101; data.rtaEntries['1'].runeSpeed = 0;
  egal(importerPrepaRtaOptimizer(data).membres[0].criteres, { vitesse: { minimum: 101 } }, 'zéro saisi conservé');
}

export function testImportEquipesNomsEtPreservation() {
  titre('Import · noms suffixés, liste active et données anciennes intactes');
  const data = sources(), etat = stockage(), avant = structuredClone(etat);
  const r = consommer(importerPrepaRtaOptimizer(data), data, etat, 'ancienne');
  egal(r.rapport.listeCreee, { id: 'ancienne (2)', name: 'Prépa RTA (3)' }, 'nom et id suffixés');
  egal(r.activeListId, 'ancienne (2)', 'nouvelle liste active');
  ok(isDeepStrictEqual(etat, avant), 'aucune mutation du stockage reçu, Map comprise');
  egal(r.stockage.lists.slice(0, 2), etat.lists, 'listes existantes intactes');
  egal(r.stockage.members.slice(0, 2), etat.members, 'membres existants intacts');
  ok(r.stockage.validated === etat.validated && r.stockage.rejets === etat.rejets, 'builds et rejets conservés tels quels');
  ok(r.stockage.memories.get('ancienne|rta:1') === etat.memories.get('ancienne|rta:1'), 'mémoire contraignante intacte');
  ok(r.stockage.teams[0] === etat.teams[0], 'ancienne équipe intacte');
  egal(consommer(importerPrepaRtaOptimizer(data), data, etat, 'orpheline').activeListId, 'orpheline (2)', 'id d’un rejet réservé');
  etat.memories.set('inactive|rta:1', { ...etat.memories.get('ancienne|rta:1')!, listId: 'inactive' });
  egal(consommer(importerPrepaRtaOptimizer(data), data, etat, 'inactive').activeListId, 'inactive (2)', 'id d’une mémoire inactive réservé');
}

export function testImportEquipesDoublons() {
  titre('Import · doublon par sélecteur, première occurrence conservée');
  const p = importerPrepaRtaOptimizer(sources());
  p.membres.push({ ...p.membres[0], criteres: { vitesse: { minimum: 999 } } });
  const r = consommer(p);
  egal(r.rapport.membresImportes, 2, 'pas de membre ou mémoire en double');
  egal(memoiresNouvelles(r)[0].criteres.minStats, { spd: 227 }, 'le doublon ne remplace aucun critère');
  ok(r.rapport.ignores.some(m => m.raison.includes('doublon')), 'doublon rapporté');
}

export function testImportEquipesIdentiteOrphelineSeule() {
  titre('Import · une identité orpheline seule réserve sa liste');
  const data = sources(), etat = stockage(), cible = 'nouvelle';
  const selector = { source: 'rta' as const, monsterId: '1' }, cle = cleMemoireMembre(cible, selector);
  const orpheline = { listId: cible, selector, com2usId: 9001 };
  etat.identities.set(cle, orpheline);
  const avant = structuredClone(etat);
  const r = consommer(importerPrepaRtaOptimizer(data), data, etat, cible);
  egal(r.rapport.listeCreee?.id, 'nouvelle (2)', 'identité seule : nouvelle liste suffixée');
  egal(r.activeListId, 'nouvelle (2)', 'la liste suffixée devient active');
  const nouvelleCle = cleMemoireMembre(r.activeListId!, selector);
  egal(r.stockage.identities.get(nouvelleCle)?.com2usId, 1001, 'identité du nouveau membre égale à son espèce importée');
  egal(r.stockage.memories.get(nouvelleCle)?.com2usId, 1001, 'mémoire et identité importées cohérentes');
  ok(r.stockage.identities.get(cle) === orpheline, 'identité orpheline intacte, même référence');
  ok(isDeepStrictEqual(etat, avant), 'stockage initial sans mutation');
}

export function testImportEquipesRejetIdentiteLisible() {
  titre('Import · un rejet d’identité lisible réserve sa liste');
  for (const format of ['paire', 'objet'] as const) {
    const data = sources(), etat = stockage(), cible = 'nouvelle';
    const selector = { source: 'rta' as const, monsterId: '1' }, cle = cleMemoireMembre(cible, selector);
    const rejet = { listId: cible, selector, com2usId: 'inconnu', id: 'nouvelle (2):equipe:1' };
    etat.rejets.identities = [format === 'paire' ? [cle, rejet] : rejet];
    const orpheline = { listId: 'identite-seule', selector, com2usId: 9001 };
    const cleOrpheline = cleMemoireMembre(orpheline.listId, selector);
    etat.identities.set(cleOrpheline, orpheline);
    const avant = structuredClone(etat);
    const proposition = importerPrepaRtaOptimizer(data);
    proposition.equipes = [{ libelle: 'Équipe importée', members: proposition.membres.map(m => m.selector), lead: null }];
    const r = consommer(proposition, data, etat, cible);
    egal(r.rapport.listeCreee?.id, 'nouvelle (2)', `${format} : rejet lisible, nouvelle liste suffixée`);
    egal(r.activeListId, 'nouvelle (2)', 'la liste suffixée devient active');
    const nouvelleCle = cleMemoireMembre(r.activeListId!, selector);
    egal(r.stockage.identities.get(nouvelleCle)?.com2usId, 1001, 'identité du nouveau membre égale à son espèce importée');
    egal(r.stockage.memories.get(nouvelleCle)?.com2usId, 1001, 'mémoire et identité importées cohérentes');
    ok(!r.stockage.identities.has(cle), 'identité rejetée non réactivée');
    ok(r.stockage.identities.get(cleOrpheline) === orpheline, 'autre identité orpheline intacte, même référence');
    ok(r.stockage.rejets === etat.rejets && isDeepStrictEqual(r.stockage.rejets, avant.rejets), 'rejet brut conservé sans modification');
    egal(r.stockage.teams[r.stockage.teams.length - 1]?.id, rejet.id, 'le rejet d’identité ne réserve pas un identifiant d’équipe');
    ok(isDeepStrictEqual(etat, avant), 'stockage initial sans mutation');
  }
}

export function testImportEquipesIdentiteEtVide() {
  titre('Import · résolution et identité revérifiées avant toute écriture');
  const data = sources(), p = importerPrepaRtaOptimizer(data), etat = stockage();
  data.monsterById.get('1')!.com2usId = 9001; delete data.rtaEntries['2'];
  const r = consommer(p, data, etat);
  ok(r.stockage === etat, 'aucun accepté : stockage initial rendu');
  egal(r.activeListId, 'ancienne', 'liste active conservée');
  egal(r.rapport.ignores.map(m => m.raison), ['Identité d’espèce différente ou inutilisable.', 'Exemplaire introuvable.'], 'raisons explicites');
  ok(r.rapport.messages.some(m => m.includes('Import vide')), 'import vide annoncé');
  const neuf = sources(); neuf.rtaEntries['1'].gear = gear();
  egal(consommer(importerPrepaRtaOptimizer(sources()), neuf).rapport.membresImportes, 2, 'même espèce, autre équipement : sélecteur suivi');
  neuf.rtaEntries = {};
  egal(consommer(importerPrepaRtaOptimizer(neuf), neuf).rapport.listeCreee, null, 'source vide : aucune liste');
}

export function testImportEquipesCriteresRefuses() {
  titre('Import · critères refusés sans mémoire ni membre partiel');
  const p = importerPrepaRtaOptimizer(sources()); p.membres[0].criteres.vitesse = { minimum: NaN };
  const r = consommer(p);
  egal(r.rapport.membresImportes, 1, 'seul le membre aux critères valides est ajouté');
  ok(r.rapport.ignores.some(m => m.raison.includes('critères malformés')), 'refus nommé');
  egal(memoiresNouvelles(r).length, 1, 'aucune mémoire invalide');
}

export function testImportEquipesSansEquipeBaseComplete() {
  titre('Import · zéro ou un membre restant, lead nommé et jamais personnel');
  for (const ids of [[1, null, null], [99, null, null]] as (number | null)[][]) {
    const data = sources(); data.siegeDefenseTeams = [deck('d1', ids)];
    const r = consommer(importerDefensesSiegeOptimizer(data), data);
    egal(r.rapport.equipesCreees, 0, 'aucune équipe créée');
    egal(r.rapport.equipesNonCreees.length, 1, 'équipe non créée nommée, même sans liste');
    ok(r.rapport.messages.some(m => m.includes('Défense 1') && m.includes('n’est appliqué à personne')), 'lead non appliqué dit');
    if (ids[0] === 1) {
      const m = memoiresNouvelles(r)[0], attendu = baseCompleteCriteres(gear(true)); attendu.minStats = { spd: 227 };
      egal(m.criteres, attendu, 'base complète indépendante des critères contraignants de la même espèce');
      egal(m.com2usId, 1001, 'identité enregistrée');
      ok(!m.criteres.damageSetup.leaderSkill && !m.criteres.damageSetup.leaderSpeedPct, 'aucun lead de source copié dans le lead personnel');
      ok(r.rapport.messages.some(m => m.includes('Attack Speed 24 % (Guild)')), 'lead exact nommé');
    }
  }
  for (const nombre of [0, 1]) {
    const data = sources(), proposition = importerOffenseSiegeOptimizer('o1', data);
    data.siegeOffenseTeams[0].slots.forEach((s, i) => { if (i >= nombre) s.monsterId = '99'; });
    const r = consommer(proposition, data);
    egal(r.rapport.membresImportes, nombre, `${nombre} membre après la revérification actuelle`);
    egal(r.rapport.equipesCreees, 0, 'filtrage du consommateur sans équipe');
    egal(r.rapport.equipesNonCreees[0].lead, lead, 'lead de source conservé dans le rapport même sans membre');
    ok(r.rapport.messages.some(m => m.includes('Attack Speed 24 % (Guild)') && m.includes('n’est appliqué à personne')), 'lead non appliqué nommé après revérification');
  }
}

export function testImportEquipesFiltrageEtCardinalites() {
  titre('Import · filtrage actuel, cardinalités et exclusivité des équipes');
  const data = sources(), p = importerOffenseSiegeOptimizer('o1', data);
  data.siegeOffenseTeams[0].slots[1].monsterId = '99';
  const r = consommer(p, data);
  egal(r.rapport.equipesCreees, 1, 'deux membres après filtrage : équipe créée');
  egal(r.stockage.teams[1].members.map(exclusionSelectorKey), ['siege-offense:o1:0', 'siege-offense:o1:2'], 'membre devenu inconnu filtré de l’équipe');
  const sansLeader = sources(), proposition = importerOffenseSiegeOptimizer('o1', sansLeader);
  sansLeader.siegeOffenseTeams[0].slots[0].monsterId = '99';
  const sans = consommer(proposition, sansLeader);
  egal(sans.stockage.teams[1].leader, undefined, 'leader filtré sans désigner un autre membre');
  egal(sans.stockage.teams[1].lead, lead, 'lead conservé comme donnée de l’équipe');
  for (const n of [2, 5, 6]) {
    const d = sources(), q = importerPrepaRtaOptimizer(d);
    for (let i = 3; i <= n; i++) d.rtaEntries[String(i)] = { monsterId: String(i), section: 'autre', runeSpeed: null, gear: gear() };
    q.membres = importerPrepaRtaOptimizer(d).membres;
    q.equipes = [{ libelle: 'Équipe proposée', members: q.membres.map(m => m.selector), lead }];
    const rr = consommer(q, d);
    egal(rr.rapport.equipesCreees, n === 6 ? 0 : 1, `${n} membres : cardinalité du modèle`);
    egal(rr.rapport.membresImportes, n, `${n} membres restent importés`);
    if (n === 6) ok(rr.rapport.messages.some(m => m.includes('Plus de cinq')), 'hors cardinalité rapporté');
  }
  const d = sources(), q = importerOffenseSiegeOptimizer('o1', d); q.equipes.push(structuredClone(q.equipes[0]));
  const rr = consommer(q, d);
  egal(rr.rapport.equipesCreees, 1, 'aucun membre affecté deux fois');
  ok(rr.rapport.equipesNonCreees[0].raisons.some(m => m.includes('déjà affecté')), 'conflit rapporté');
}

export function testImportEquipesLeadsEtRelecture() {
  titre('Import · portée, leads sans calcul et mémoire relisible');
  const data = sources(); data.monsterById.get('1')!.leaderSkill = { ...lead, area: 'Element', element: 'fire' };
  const r = consommer(importerOffenseSiegeOptimizer('o1', data), data);
  const m = memoiresNouvelles(r)[0];
  egal(appliquerCriteres(m.criteres, leadEffectifMembreOptimizer(r.stockage, r.activeListId!, m.selector, 'fire')).damageSetup.leaderSkill, { stat: 'Attack Speed', pct: 24 }, 'lead effectif dérivé pour l’élément');
  ok(r.rapport.messages.some(m => m.includes('élément')), 'autre élément sans effet dit');
  const lu = lireMembresOptimizer(ecrireMembresOptimizer(r.stockage));
  egal(lu.rapport.length, 2, 'seuls les deux rejets préexistants sont annoncés');
  ok(isDeepStrictEqual(lu.memories, r.stockage.memories), 'chaque mémoire importée se relit, identité comprise');
  egal(lu.teams, r.stockage.teams, 'équipes et leads se relisent');
  for (const stat of ['Resistance', 'Accuracy']) {
    data.monsterById.get('1')!.leaderSkill = { ...lead, stat };
    const rr = consommer(importerOffenseSiegeOptimizer('o1', data), data);
    egal(rr.stockage.teams[1].lead?.stat, stat, 'lead non calculable conservé');
    ok(rr.rapport.messages.some(m => m.includes('sans effet calculé')), 'absence d’effet au rapport');
  }
  data.monsterById.get('1')!.leaderSkill = { ...lead, area: 'Arena' };
  ok(consommer(importerOffenseSiegeOptimizer('o1', data), data).rapport.messages.some(m => m.includes('inactive')), 'lead Arène conservé mais inactif en Siège');
}

export const verificationsImportEquipes: [string, () => void][] = [
  testImportEquipesDefensesSiege, testImportEquipesOffenseSiege, testImportEquipesAnciennesOrphelines, testImportEquipesPrepaRtaVitesses,
  testImportEquipesMonstresInconnus, testImportEquipesVitessesInvalides, testImportEquipesNomsEtPreservation,
  testImportEquipesIdentiteOrphelineSeule, testImportEquipesRejetIdentiteLisible,
  testImportEquipesDoublons, testImportEquipesIdentiteEtVide, testImportEquipesCriteresRefuses,
  testImportEquipesSansEquipeBaseComplete, testImportEquipesFiltrageEtCardinalites, testImportEquipesLeadsEtRelecture,
].map(test => [test.name, test]);
