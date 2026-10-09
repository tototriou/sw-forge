import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { loadOptimizerLists } from '../src/hooks/useOptimizerLists';
import { lireTravail, purgeDonneesConservees, saveLocal, setPersistence } from '../src/hooks/usePersistence';
import { composerSession, ecrireSession, lireSession } from '../src/lib/session';
import { lireSession as lireAncienneSession } from './fixtures/lecteur-session-v1';
import {
  OPTIMIZER_MEMBERS_STORAGE_KEY as CLE, cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer,
  enregistrerMemoireMembre, lireMemoireMembre, reverifierStockageOptimizer, validerEquipesOptimizer,
  type StockageOptimizer,
} from '../src/lib/optimizerMemberStorage';
import type { ExclusionSelector, ExclusionSourceData } from '../src/lib/optimizerExclusion';
import type { GearSet, Monster } from '../src/types';
import { egal, faussLocalStorage, ok, titre } from './outils';
import { monterListesOptimizer } from './optimizer-lists-harness';

const box: ExclusionSelector = { source: 'box', unitKey: '11' };
const rta: ExclusionSelector = { source: 'rta', monsterId: '1' };
const siege: ExclusionSelector = { source: 'siege-defense', teamId: 'd1', slotIndex: 0 };
const gear: GearSet = { base: { hp: 1000, atk: 100, def: 100, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
const monstre = { id: 1, com2usId: 10001, name: 'Monstre test', element: 'wind', stats: { speed: 100 }, leaderSkill: null } as Monster;
function compte(): ExclusionSourceData {
  return { box: [{ key: '11', monster: monstre, stars: 6, level: 40, gear }],
    rtaEntries: { '1': { monsterId: '1', runeSpeed: 10, section: 'unassigned', gear } },
    siegeDefenseTeams: [{ id: 'd1', slots: [{ monsterId: '1', gear }, { monsterId: null }, { monsterId: null }] }] as ExclusionSourceData['siegeDefenseTeams'],
    siegeOffenseTeams: [], monsterById: new Map([['1', monstre]]) };
}
function stockage(): StockageOptimizer {
  const criteres = baseCompleteCriteres(undefined); criteres.minStats.spd = 200;
  const memories = new Map([box, rta, siege].map((selector) => [cleMemoireMembre('l1', selector), { listId: 'l1', selector, com2usId: 10001, criteres }]));
  return { rejets: { memories: [], teams: [] }, lists: [{ id: 'l1', name: 'Liste' }], members: [box, rta, siege].map((selector) => ({ listId: 'l1', selector })),
    validated: [{ listId: 'l1', selector: siege, runeIds: [1, 2, 3, 4, 5, 6], artifactIds: [7] }], memories,
    teams: [{ id: 'e1', listId: 'l1', members: [box, siege], leader: siege,
      lead: { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null }, contenu: 'siege' }] };
}
function sourceSession(stockage: Record<string, string> = {}) {
  return { maintenant: new Date('2026-10-09T10:00:00Z'), versionApp: 'test', stockage, compte: null, memoire: {}, optimizer: null };
}
function installer(brut = ecrireMembresOptimizer(stockage()), listes = JSON.stringify({ ...stockage(), memories: undefined, teams: undefined, rejets: undefined, activeListId: 'l1' })) {
  return faussLocalStorage({ 'swblacksmith-persist-v1': '1', 'swblacksmith-optimizer-lists-v1': listes, [CLE]: brut });
}

export function testMemoireOptimizerJson() {
  titre('Mémoire des membres · aller-retour JSON');
  const s = stockage(), lu = lireMembresOptimizer(ecrireMembresOptimizer(s));
  ok(lu.memories instanceof Map, 'la relecture rend une Map');
  egal([...lu.memories], [...s.memories], 'toutes les paires, identités et critères sont conservés');
  ok(isDeepStrictEqual(lu.teams, s.teams), 'les équipes, le leader, le lead et le contenu reviennent');
  egal(lu.rapport, [], 'aucune entrée valide signalée comme malformée');
}
export function testMemoireOptimizerCopie() {
  titre('Mémoire des membres · nouvelle Map à chaque écriture');
  const s = stockage(), photo = baseCompleteCriteres(undefined);
  const r = enregistrerMemoireMembre(s.memories, { listId: 'l1', selector: box, com2usId: 10001 }, photo, compte());
  ok(r.memories !== s.memories, 'nouvelle référence de Map');
  egal(s.memories.get('l1|box:11')?.criteres.minStats.spd, 200, 'la Map précédente reste intacte');
  photo.minStats.spd = 123;
  egal(r.memories.get('l1|box:11')?.criteres.minStats, {}, 'la photo est copiée en profondeur');
  const autre = enregistrerMemoireMembre(r.memories, { listId: 'l2', selector: box, com2usId: 10001 }, photo, compte());
  egal(autre.memories.get('l1|box:11')?.criteres.minStats, {}, 'le même sélecteur dans une autre liste ne modifie pas la première');
}
export function testMemoireOptimizerLecteurListes() {
  titre('Mémoire des membres · passage par le lecteur historique des listes');
  const initial = ecrireMembresOptimizer(stockage()), mem = installer(initial);
  setPersistence(true);
  saveLocal('swblacksmith-optimizer-lists-v1', JSON.stringify(loadOptimizerLists()));
  egal(mem.get(CLE), initial, 'le lecteur et la réécriture des listes ignorent la nouvelle clé');
  const h = monterListesOptimizer(), lu = h.render();
  egal([...lu.memories], [...stockage().memories], 'la nouvelle version retrouve les mémoires');
  ok(isDeepStrictEqual(lu.teams, stockage().teams), 'la nouvelle version retrouve les équipes');
  egal(Object.keys(JSON.parse(mem.get('swblacksmith-optimizer-lists-v1')!)), ['lists', 'members', 'validated', 'activeListId'], 'la clé historique conserve exactement ses quatre champs');
}
export function testMemoireOptimizerListesIllisibles() {
  titre('Mémoire des membres · listes illisibles');
  const initial = ecrireMembresOptimizer(stockage()), mem = installer(initial, '{');
  setPersistence(true);
  const lu = monterListesOptimizer().render();
  egal(lu.lists, [], 'le lecteur historique retombe sur des listes vides');
  egal(lu.memories.size, 3, 'aucune mémoire purgée contre des listes illisibles');
  egal(lu.teams.length, 1, 'aucune équipe purgée contre des listes illisibles');
  egal(mem.get(CLE), initial, 'les octets de la nouvelle clé restent intacts au chargement');
}
export function testMemoireOptimizerMalformed() {
  titre('Mémoire des membres · entrée malformée signalée');
  const s = stockage(), brut = JSON.parse(ecrireMembresOptimizer(s));
  brut.memories.push(['incorrecte', { ...s.memories.values().next().value, com2usId: '10001' }]);
  brut.memories.push(['l1|unowned:1', { listId: 'l1', selector: { source: 'unowned', monsterId: '1' }, com2usId: 10001, criteres: { ...baseCompleteCriteres(undefined), damageSetup: { atkBuff: 'oui' } } }]);
  const texte = JSON.stringify(brut), mem = installer(texte);
  setPersistence(true);
  const lu = monterListesOptimizer().render();
  egal(lu.memories.size, 3, 'seules les deux entrées malformées sont écartées en mémoire');
  egal(lu.rapportStockage.length, 2, 'chaque entrée écartée figure au rapport');
  egal(mem.get(CLE), texte, 'la relecture ne détruit pas les données brutes');
}
export function testEquipeOptimizerValidation() {
  titre('Équipes · validation au chargement');
  const equipe = stockage().teams[0];
  const variantes: [string, unknown][] = [
    ['un membre', { ...equipe, members: [box] }], ['six membres', { ...equipe, members: Array(6).fill(box) }],
    ['membre répété', { ...equipe, members: [box, box] }], ['leader extérieur', { ...equipe, leader: rta }],
    ['portée inconnue', { ...equipe, lead: { ...equipe.lead, area: 'Inconnue' } }], ['contenu inconnu', { ...equipe, contenu: 'inconnu' }],
    ['slot invalide', { ...equipe, members: [box, { ...siege, slotIndex: -1 }] }],
  ];
  for (const [nom, v] of variantes) { const r = validerEquipesOptimizer([v]); egal(r.teams.length, 0, `${nom} : refus`); egal(r.rapport.length, 1, `${nom} : signalé`); }
  const conflit = validerEquipesOptimizer([equipe, { ...equipe, id: 'e2' }]);
  egal(conflit.teams.length, 1, 'un membre dans une seule équipe par liste');
  egal(validerEquipesOptimizer([equipe, { ...equipe, id: 'e2', listId: 'l2' }]).teams.length, 2, 'les listes restent indépendantes');
  const { contenu: _contenu, leader: _leader, ...sans } = equipe;
  egal(validerEquipesOptimizer([sans]).teams[0]?.contenu, 'siege', 'contenu absent : Siège par défaut ; leader facultatif');
  egal(validerEquipesOptimizer([{ ...sans, contenu: 'rta', lead: { stat: 'Resistance', amount: 40, area: 'General', element: null } }]).teams.length, 1, 'lead RES conservé sans calcul d’effet');
}
export function testMemoireOptimizerConservationSession() {
  titre('Mémoire des membres · refus du disque → session → activation → rechargement');
  const mem = installer(); setPersistence(true);
  const h = monterListesOptimizer(); h.render();
  setPersistence(false); const lu = h.render();
  lu.writeMemory({ listId: 'l1', selector: box, com2usId: 10001 }, { ...baseCompleteCriteres(undefined), minStats: { spd: 245 } }, compte());
  h.render();
  egal(mem.get(CLE), undefined, 'aucune écriture sur disque avec conservation refusée');
  const session = lireSession(ecrireSession(composerSession(sourceSession({ [CLE]: lireTravail(CLE)! }))));
  ok(session.ok, 'le miroir fournit une session lisible');
  if (!session.ok) return;
  egal(lireMembresOptimizer(session.session.stockage[CLE]!).memories.get('l1|box:11')?.criteres.minStats.spd, 245, 'la session contient la dernière saisie');
  setPersistence(true); h.render();
  const recharge = monterListesOptimizer().render();
  egal(recharge.memories.get('l1|box:11')?.criteres.minStats.spd, 245, 'activation puis nouveau chargement : saisie conservée');
  ok(isDeepStrictEqual(recharge.teams, stockage().teams), 'activation puis nouveau chargement : équipes conservées');
}
export function testSessionOptimizerVersionDeux() {
  titre('Session · version 2 systématique et refus du lecteur précédent');
  const session = composerSession(sourceSession());
  egal(session.version, 2, 'composer écrit la version 2 même sans nouveautés');
  const texte = ecrireSession({ ...session, version: 1 });
  egal(JSON.parse(texte).version, 2, 'écrire une session ancienne la porte aussi en version 2');
  const ancienne = lireAncienneSession(texte);
  ok(!ancienne.ok && ancienne.erreur.includes('mets-la à jour'), 'le véritable lecteur précédent refuse avec le message existant');
  const lu = lireSession(JSON.stringify({ ...session, version: 1 }));
  ok(lu.ok && lu.session.version === 1, 'une session version 1 reste relue');
  const future = lireSession(JSON.stringify({ ...session, version: 3 }));
  ok(!future.ok && future.erreur.includes('mets-la à jour'), 'le nouveau lecteur refuse une version future');
}
export async function testMemoireOptimizerEffacement() {
  titre('Mémoire des membres · effacement disque et miroir');
  const mem = installer(); setPersistence(true);
  monterListesOptimizer().render();
  await purgeDonneesConservees();
  egal(mem.get(CLE), undefined, 'effacement sur disque');
  egal(lireTravail(CLE), null, 'effacement dans le miroir de session');
  setPersistence(false);
  saveLocal(CLE, ecrireMembresOptimizer(stockage()));
  await purgeDonneesConservees();
  egal(lireTravail(CLE), null, 'effacement aussi sans conservation préalable sur disque');
}
export function testMemoireOptimizerReimport() {
  titre('Revérification · membre retiré, mémoire conservée, équipe dissoute');
  const s = stockage(), data = compte(); data.siegeDefenseTeams = [];
  const r = reverifierStockageOptimizer(s, data, new Set([1, 2, 3, 4, 5, 6]));
  egal(r.rapport.membresRetires, 1, 'le membre introuvable est retiré');
  egal(r.rapport.buildsRetires, 1, 'le build introuvable est retiré comme auparavant');
  egal([...r.stockage.memories], [...s.memories], 'toutes les mémoires restent conservées');
  egal(r.rapport.memoiresInactives, ['l1|siege-defense:d1:0'], 'la mémoire du membre retiré est signalée inactive');
  egal(r.stockage.teams, [], 'moins de deux membres : dissolution');
  egal(r.rapport.equipesDissoutes, ['e1'], 'dissolution signalée');
  egal(lireMemoireMembre(r.stockage.memories, 'l1', siege, data), null, 'aucune application au sélecteur introuvable');
  const h = (installer(), setPersistence(true), monterListesOptimizer()); h.render().replaceAfterRevalidation(r.stockage);
  const lu = h.render(); egal(lu.teams, [], 'le hook applique la dissolution'); egal(lu.memories.size, 3, 'le hook conserve la mémoire inactive');
  const vide = reverifierStockageOptimizer(s, { ...data, box: [] }, new Set());
  ok(vide.rapport.compteVide && vide.stockage === s, 'compte vide : aucune purge');
  setPersistence(false);
}
export function testMemoireOptimizerEspeceSelecteur() {
  titre('Revérification · identité d’espèce et copies dans un même sélecteur');
  const s = stockage(), data = compte();
  // Une autre copie de la même espèce porte un autre équipement dans le même slot/entrée.
  data.siegeDefenseTeams[0].slots[0].gear = { ...gear, base: { ...gear.base, spd: 110 } };
  data.rtaEntries['1'].gear = { ...gear, base: { ...gear.base, spd: 120 } };
  egal(lireMemoireMembre(s.memories, 'l1', siege, data)?.minStats.spd, 200, 'autre copie, même espèce : mémoire du slot appliquée');
  egal(lireMemoireMembre(s.memories, 'l1', rta, data)?.minStats.spd, 200, 'autre copie, même espèce : mémoire RTA appliquée');
  const r = reverifierStockageOptimizer(s, data, new Set([1, 2, 3, 4, 5, 6]));
  egal(r.rapport.memoiresSuivantSelecteur, ['l1|rta:1', 'l1|siege-defense:d1:0'], 'le rapport dit quelles mémoires suivent le sélecteur');
  // La limite (une autre copie de la même espèce reprend la mémoire) est dite
  // par la spec, pas répétée par mémoire à chaque réimport.
  egal(r.rapport.messages, [], 'aucun message pour une mémoire qui suit son sélecteur');
  data.monsterById.set('1', { ...monstre, com2usId: 20002 });
  egal(lireMemoireMembre(s.memories, 'l1', siege, data), null, 'autre espèce : aucune application');
  const change = reverifierStockageOptimizer(s, data, new Set([1, 2, 3, 4, 5, 6]));
  egal(change.rapport.memoiresInactives.length, 2, 'autre espèce RTA et siège : mémoires signalées inactives');
  egal(change.stockage.memories.size, 3, 'aucune mémoire perdue lors du changement d’espèce');
  egal(change.stockage.validated, s.validated, 'la validation des builds au réimport reste inchangée');
  const refuse = enregistrerMemoireMembre(s.memories, { listId: 'l1', selector: siege, com2usId: 20002 }, baseCompleteCriteres(undefined), data);
  ok(refuse.memories === s.memories && refuse.rapport.length === 1, 'l’écriture ne remplace pas la mémoire d’une autre espèce');
  const fausseIdentite = enregistrerMemoireMembre(new Map(), { listId: 'l1', selector: siege, com2usId: 10001 }, baseCompleteCriteres(undefined), data);
  egal(fausseIdentite.memories.size, 0, 'identité du propriétaire périmée : aucune écriture');
}
export function testMemoireOptimizerBranchement() {
  titre('Revérification · branchement du réimport');
  const source = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  ok(source.includes('reverifierStockageOptimizer(optimizerLists, data, runeIds)'), 'App appelle le producteur commun avec tout le stockage');
  ok(source.includes('optimizerLists.replaceAfterRevalidation(resultat.stockage)'), 'App applique les quatre catégories ensemble');
  ok(source.includes("resultat.rapport.messages.join(' ')"), 'App affiche le rapport commun');
}

export function testEquipeOptimizerMembreRetire() {
  titre('Revérification · équipe conservée à deux, sans remplacement du leader');
  const s = stockage(), data = compte();
  s.teams[0].members.push(rta); data.siegeDefenseTeams = [];
  const r = reverifierStockageOptimizer(s, data, new Set([1, 2, 3, 4, 5, 6]));
  egal(r.stockage.teams[0]?.members, [box, rta], 'les deux membres retrouvés restent dans l’équipe');
  ok(!('leader' in r.stockage.teams[0]), 'aucun autre leader désigné automatiquement');
  egal(r.stockage.teams[0]?.lead, s.teams[0].lead, 'le lead éditable de l’équipe reste conservé');
  egal(r.rapport.equipesModifiees, ['e1'], 'l’équipe modifiée figure dans le rapport');
  egal(s.teams[0].members.length, 3, 'le stockage d’entrée reste intact');
}

export function testMemoireOptimizerSuppressionExplicite() {
  titre('Membres et listes · suppression explicite');
  installer(); setPersistence(true);
  const h = monterListesOptimizer(); let lu = h.render();
  const reference = lu.memories;
  lu.removeMember('l1', siege); lu = h.render();
  ok(lu.memories !== reference, 'retirer un membre crée aussi une nouvelle Map');
  ok(!lu.memories.has('l1|siege-defense:d1:0'), 'le geste explicite retire sa mémoire');
  egal(lu.teams, [], 'son équipe devenue trop petite est retirée');
  lu.writeMemory({ listId: 'l1', selector: siege, com2usId: 10001 }, baseCompleteCriteres(undefined), compte());
  lu = h.render();
  ok(!lu.memories.has('l1|siege-defense:d1:0') && lu.rapportStockage.some((m) => m.includes('membre absent')), 'un membre retiré ne reçoit pas une nouvelle mémoire');
  const origine = stockage().teams;
  lu.setTeams(origine); lu = h.render();
  egal(lu.teams, [], 'une équipe ne peut pas ressusciter un membre retiré');
  lu.setTeams([{ ...origine[0], members: [box, rta], leader: rta, contenu: 'rta' }]);
  lu = h.render();
  egal(lu.teams.length, 1, 'une équipe valide de membres existants est enregistrée');
  lu.deleteList('l1'); lu = h.render();
  egal(lu.memories.size, 0, 'supprimer la liste efface ses mémoires');
  egal(lu.teams, [], 'supprimer la liste efface ses équipes');
  setPersistence(false);
}

export function testMemoireOptimizerReimportBrutPreserve() {
  titre('Réimport · brut conservé sans changement et rejets conservés à la réécriture');
  const s = stockage(), brut = JSON.parse(ecrireMembresOptimizer(s));
  brut.memories.push(['malformee', { com2usId: '10001' }]);
  brut.teams.push({ ...s.teams[0], id: 'invalide', members: [box] });
  const initial = JSON.stringify(brut, null, 2), mem = installer(initial);
  setPersistence(true);
  const h = monterListesOptimizer(); let lu = h.render();
  egal(lu.teams.length, 1, 'l’équipe valide du scénario est chargée');
  egal(lu.rapportStockage.length, 2, 'la mémoire et l’équipe malformées sont signalées au chargement');
  const initialStorage = localStorage;
  let ecritures = 0;
  globalThis.localStorage = new Proxy(initialStorage, {
    get: (cible, cle) => cle === 'setItem'
      ? (nom: string, valeur: string) => { ecritures++; cible.setItem(nom, valeur); }
      : Reflect.get(cible, cle),
  });
  try {
    const identique = reverifierStockageOptimizer(lu, compte(), new Set([1, 2, 3, 4, 5, 6]));
    lu.replaceAfterRevalidation(identique.stockage); lu = h.render();
    ok(mem.get(CLE) === initial, 'réimport identique : octets bruts conservés, y compris les entrées écartées');
    ok(lireTravail(CLE) === initial, 'réimport identique : le miroir conserve aussi le brut');
    egal(ecritures, 0, 'réimport identique : aucune réécriture des clés de stockage');
    const data = compte(); data.siegeDefenseTeams = [];
    const modifie = reverifierStockageOptimizer(lu, data, new Set([1, 2, 3, 4, 5, 6]));
    lu.replaceAfterRevalidation(modifie.stockage); lu = h.render();
    const reecrit = JSON.parse(mem.get(CLE)!);
    egal(reecrit.rejets.memories, [brut.memories[3]], 'réimport modifié : mémoire rejetée conservée telle quelle');
    egal(reecrit.rejets.teams, [brut.teams[1]], 'réimport modifié : équipe rejetée conservée telle quelle');
    ok(mem.get(CLE) !== initial, 'une modification réelle autorise la réécriture');
    const prochain = reverifierStockageOptimizer(lu, data, new Set([1, 2, 3, 4, 5, 6]));
    ok(!prochain.rapport.messages.some((m) => m.includes('malformée')), 'les rejets déjà annoncés ne sont pas répétés après réécriture');
  } finally { globalThis.localStorage = initialStorage; setPersistence(false); }
}

export function testEquipeOptimizerTextesStricts() {
  titre('Équipes · tableaux refusés pour chaque champ texte au chargement');
  const equipe = stockage().teams[0];
  const variantes: [string, unknown][] = [
    ['id', { ...equipe, id: ['e1'] }],
    ['listId', { ...equipe, listId: ['l1'] }],
    ['contenu', { ...equipe, contenu: ['rta'] }],
    ['lead.stat', { ...equipe, lead: { ...equipe.lead, stat: ['Attack Speed'] } }],
    ['lead.area', { ...equipe, lead: { ...equipe.lead, area: ['Guild'] } }],
    ['lead.element', { ...equipe, lead: { ...equipe.lead, element: ['fire'] } }],
    ['members.source', { ...equipe, members: [{ source: ['box'], unitKey: '11' }, siege] }],
    ['members.unitKey', { ...equipe, members: [{ source: 'box', unitKey: ['11'] }, siege] }],
    ['members.monsterId', { ...equipe, members: [{ source: 'rta', monsterId: ['1'] }, siege] }],
    ['members.teamId', { ...equipe, members: [box, { ...siege, teamId: ['d1'] }] }],
    ['leader.unitKey', { ...equipe, leader: { source: 'box', unitKey: ['11'] } }],
  ];
  for (const [nom, v] of variantes) {
    const lu = lireMembresOptimizer(JSON.stringify({ memories: [], teams: [v] }));
    egal(lu.teams.length, 0, `${nom} : équipe écartée`);
    egal(lu.rapport, ['Équipe 1 malformée : ignorée.'], `${nom} : rejet annoncé au chargement`);
  }
}
