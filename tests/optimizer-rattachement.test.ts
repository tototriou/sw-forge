import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import type { GearSet, Monster, RuneDetail, SiegeTeam } from '../src/types';
import { exclusionSelectorKey, findValidatedBuild, otherValidatedRuneIds, resolveExclusionEntry, runesManquantesDuBuild,
  type ExclusionSelector, type ExclusionSource, type ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer, reverifierStockageOptimizer, type ContenuListeOptimizer, type StockageOptimizer } from '../src/lib/optimizerMemberStorage';
import { acquerirIdentitesMembres, enregistrerIdentiteMembre } from '../src/lib/optimizerRattachement';
import { rattacherProprietaireCriteres, validerProprietaireCriteres } from '../src/lib/optimizerCriteriaOwner';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { consommerImportOptimizer, importerDefensesSiegeOptimizer } from '../src/lib/importEquipes';
import { loadOptimizerLists } from '../src/hooks/useOptimizerLists';
import { monterListesOptimizer } from './optimizer-lists-harness';
import { egal, faussLocalStorage, ok, titre } from './outils';

const monster = (id: number): Monster => ({ id, com2usId: 1000 + id, name: `Espèce ${id}`, element: 'fire', stars: 6,
  naturalStars: 5, secondAwaken: false, image: null, leaderSkill: null,
  stats: { hp: 10000, attack: 700, defense: 600, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 } });
const rune = (id: number): RuneDetail => ({ id, slot: (id - 1) % 6 + 1, set: 'energy', rank: 6, rarity: 5, level: 15, main: { code: 1, value: 100 }, subs: [] });
const gear = (ids: number[] = []): GearSet => ({ base: { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: ids.map(rune), artifacts: [] });
const box = (key: string, id = 1, ids: number[] = []) => ({ key, monster: monster(id), stars: 6, level: 40, gear: gear(ids) });
const deck = (id: string, especes: (number | null)[], ids: number[] = []): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: especes.map(m => ({ monsterId: m === null ? null : String(m), runeSpeed: 0, tick: 0, ...(m ? { gear: gear(ids) } : {}) })) });
const data = (): ExclusionSourceData => ({ box: [box('temoin', 9)], rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [],
  monsterById: new Map([1, 2, 3, 9].map(id => [String(id), monster(id)])) });
const ancien: Extract<ExclusionSelector, { source: 'siege-defense' }> = { source: 'siege-defense', teamId: 'ancien', slotIndex: 0 };
function stockage(selecteurs: ExclusionSelector[] = [ancien], contenu?: ContenuListeOptimizer): StockageOptimizer {
  return { lists: [{ id: 'l', name: 'Liste' }], members: selecteurs.map(selector => ({ listId: 'l', selector })), validated: [],
    identities: new Map(selecteurs.map(selector => [cleMemoireMembre('l', selector), { listId: 'l', selector, com2usId: 1001 }])),
    memories: new Map(), teams: [], listContents: new Map(contenu ? [['l', contenu]] : []), rejets: { memories: [], teams: [], listContents: [] } };
}
const runeIds = new Set(Array.from({ length: 18 }, (_, i) => i + 1));

export function testOptimizerRattachementIdentites() {
  titre('Rattachement · identité indépendante, acquisition avant import et limite annoncée');
  const s = stockage(), present = data(); present.siegeDefenseTeams = [deck('ancien', [1, null, null])];
  s.identities.clear();
  const acquis = acquerirIdentitesMembres(s, present);
  egal(acquis.identities.get(cleMemoireMembre('l', ancien))?.com2usId, 1001, 'identité acquise sans créer de mémoire');
  egal(acquis.memories.size, 0, 'acquisition indépendante des critères');
  const suivant = data(); suivant.siegeDefenseTeams = [deck('ancien', [2, null, null])];
  const r = reverifierStockageOptimizer(acquis, suivant, runeIds);
  egal(resolveExclusionEntry(r.stockage.members[0].selector, suivant)?.monster.com2usId, 1001, 'slot remplacé : espèce du compte précédent conservée');
  const inconnu = reverifierStockageOptimizer(s, suivant, runeIds);
  egal(inconnu.stockage.identities.get(cleMemoireMembre('l', ancien))?.com2usId, 1002, 'sans identité antérieure : espèce du nouveau compte');
  ok(inconnu.rapport.messages.some(m => m.includes('identité inconnue avant le réimport')), 'limite dite au réimport');
  ok(acquerirIdentitesMembres(acquis, suivant) === acquis, 'une identité acquise ne change plus selon le slot');
  ok(enregistrerIdentiteMembre(acquis.identities, { listId: 'l', selector: ancien, com2usId: 1002 }) === acquis.identities,
    'tous les chemins de création conservent une identité déjà connue');
  const relu = lireMembresOptimizer(ecrireMembresOptimizer(acquis));
  ok(isDeepStrictEqual(relu.identities, acquis.identities), 'identités indépendantes dans la clé des membres, aller-retour JSON');
  const malformed = { listId: 'l', selector: ancien, com2usId: ['1001'] };
  const rejete = lireMembresOptimizer(JSON.stringify({ memories: [], teams: [], identities: [['l|siege-defense:ancien:0', malformed]] }));
  egal(rejete.identities.size, 0, 'identité mal typée non appliquée');
  egal(lireMembresOptimizer(ecrireMembresOptimizer(rejete)).rejets.identities, rejete.rejets.identities, 'rejet brut conservé sans réactivation');
  faussLocalStorage({ 'swblacksmith-optimizer-lists-v1': JSON.stringify({ lists: s.lists, members: [], validated: [], activeListId: 'l' }) });
  const h = monterListesOptimizer(); let listes = h.render();
  listes.addMember('l', ancien, 1001); listes = h.render();
  egal(listes.identities.get(cleMemoireMembre('l', ancien))?.com2usId, 1001, 'ajout manuel : identité acquise au geste');
  const copie: ExclusionSelector = { source: 'box', unitKey: 'copie' };
  listes.validateBuild('l', copie, [1, 2, 3, 4, 5, 6], [], 1001); listes = h.render();
  egal(listes.identities.get(cleMemoireMembre('l', copie))?.com2usId, 1001, 'validation qui inclut : identité acquise au geste');
  listes.removeMember('l', ancien); listes = h.render();
  ok(!listes.identities.has(cleMemoireMembre('l', ancien)), 'retrait explicite : identité retirée');
  listes.deleteList('l'); listes = h.render(); egal(listes.identities.size, 0, 'suppression explicite de liste : identités retirées');
}

const ORDRES: [ContenuListeOptimizer | undefined, ExclusionSource[]][] = [
  ['guilde', ['siege-defense', 'siege-offense', 'box', 'rta']],
  ['arene', ['rta', 'box', 'siege-defense', 'siege-offense']],
  ['donjon', ['box', 'rta', 'siege-defense', 'siege-offense']],
  [undefined, ['box', 'rta', 'siege-defense', 'siege-offense']],
];
export const verificationsOptimizerRattachementOrdres = ORDRES.flatMap(([contenu, ordre]) => ordre.map((attendu, niveau) => [
  `testOptimizerRattachementOrdre${contenu ?? 'sansContenu'}Niveau${niveau + 1}`,
  () => {
    titre(`Rattachement · ${contenu ?? 'sans contenu'}, niveau ${niveau + 1}`);
    const compte = data(), disponibles = new Set(ordre.slice(niveau));
    if (disponibles.has('box')) compte.box.push(box('candidat'));
    if (disponibles.has('rta')) compte.rtaEntries['1'] = { monsterId: '1', section: 'swift', runeSpeed: 0, gear: gear([1, 2, 3]) };
    if (disponibles.has('siege-defense')) compte.siegeDefenseTeams = [deck('d', [1, null, null])];
    if (disponibles.has('siege-offense')) compte.siegeOffenseTeams = [deck('o', [1, null, null])];
    const r = reverifierStockageOptimizer(stockage([ancien], contenu), compte, runeIds);
    egal(r.stockage.members[0].selector.source, attendu, 'source prioritaire disponible, même sans rune portée');
    egal(r.rapport.rattachements.length, 1, 'rattachement individuel dans le rapport');
  },
] as [string, () => void]));

export function testOptimizerRattachementDepartageEtPrises() {
  titre('Rattachement · runes du build pour départager, références valides réservées en premier');
  const compte = data(); compte.box.push(box('premier', 1, [1]), box('meilleur', 1, [1, 2, 3]), box('garde', 1, [1, 2, 3, 4]));
  const garde: ExclusionSelector = { source: 'box', unitKey: 'garde' };
  const s = stockage([ancien, garde]); s.validated = [{ listId: 'l', selector: ancien, runeIds: [1, 2, 3, 4, 5, 6] }];
  const r = reverifierStockageOptimizer(s, compte, runeIds);
  egal(r.stockage.members.map(m => m.selector), [{ source: 'box', unitKey: 'meilleur' }, garde], 'meilleur disponible choisi sans prendre la référence valide du membre suivant');
  const aucunBuild = reverifierStockageOptimizer({ ...s, validated: [] }, compte, runeIds);
  egal(aucunBuild.stockage.members[0].selector, { source: 'box', unitKey: 'premier' }, 'sans build : premier exemplaire dans la source');
  const deux = reverifierStockageOptimizer(stockage([ancien, { ...ancien, slotIndex: 1 }]), compte, runeIds);
  egal(new Set(deux.stockage.members.map(m => exclusionSelectorKey(m.selector))).size, 2, 'deux membres de même espèce : exemplaires distincts');
  const autreListe = { ...s, lists: [...s.lists, { id: 'autre', name: 'Autre' }], members: s.members.map((m, i) => i ? { ...m, listId: 'autre' } : m) };
  autreListe.identities = new Map(s.identities); autreListe.identities.set(cleMemoireMembre('autre', garde), { listId: 'autre', selector: garde, com2usId: 1001 });
  egal(reverifierStockageOptimizer(autreListe, compte, runeIds).stockage.members[0].selector, garde, 'occupation dans une autre liste : aucune exclusion');
}

export function testOptimizerRattachementCopiesSansExemplaire() {
  titre('Rattachement · copies sans exemplaire distinctes, lecteur actuel conservant copie');
  const selectors: ExclusionSelector[] = [ancien, { ...ancien, slotIndex: 1 }, { source: 'unowned', monsterId: '1' }];
  const s = stockage(selectors);
  selectors.forEach((selector, i) => {
    const criteres = baseCompleteCriteres(undefined); criteres.minStats.spd = 200 + i;
    s.memories.set(cleMemoireMembre('l', selector), { listId: 'l', selector, com2usId: 1001, criteres });
    s.validated.push({ listId: 'l', selector, runeIds: [i * 6 + 1] });
  });
  s.teams = [{ id: 'e', listId: 'l', members: selectors, leader: ancien, lead: null }];
  const compte = data(), r = reverifierStockageOptimizer(s, compte, runeIds);
  egal(r.stockage.members.map(m => exclusionSelectorKey(m.selector)), ['unowned:1:2', 'unowned:1:3', 'unowned:1'], 'copie originale réservée avant les deux rattachements');
  egal(r.stockage.memories.size, 3, 'trois mémoires conservées sans collision');
  for (const [i, membre] of r.stockage.members.entries()) {
    egal(r.stockage.memories.get(cleMemoireMembre('l', membre.selector))?.criteres.minStats.spd, 200 + i, 'critères du membre conservés');
    egal(findValidatedBuild(r.stockage.validated, 'l', exclusionSelectorKey(membre.selector))?.runeIds, [i * 6 + 1], 'chaque membre retrouve son build');
    egal(resolveExclusionEntry(membre.selector, compte)?.monster.com2usId, 1001, 'copie ignorée pour résoudre l’espèce');
  }
  const brut = JSON.stringify({ lists: s.lists, members: r.stockage.members, validated: r.stockage.validated, activeListId: 'l' });
  faussLocalStorage({ 'swblacksmith-optimizer-lists-v1': brut });
  egal(loadOptimizerLists().members, r.stockage.members, 'champ copie conservé par le lecteur actuel des listes');
  const anciennesCles = r.stockage.members.map(m => `unowned:${(m.selector as { monsterId: string }).monsterId}`);
  egal(new Set(anciennesCles).size, 1, 'limite documentée : anciennes clés identiques, tableaux toujours conservés');
}

export function testOptimizerRattachementPermutationEtProprietaire() {
  titre('Rattachement · permutation atomique des identités, mémoires, équipes, builds et propriétaire');
  const second: ExclusionSelector = { ...ancien, slotIndex: 1 }, s = stockage([ancien, second], 'guilde');
  s.identities.set(cleMemoireMembre('l', second), { listId: 'l', selector: second, com2usId: 1002 });
  for (const [i, selector] of [ancien, second].entries()) {
    const criteres = baseCompleteCriteres(undefined); criteres.minStats.spd = 210 + i;
    s.memories.set(cleMemoireMembre('l', selector), { listId: 'l', selector, com2usId: 1001 + i, criteres });
    s.validated.push({ listId: 'l', selector, runeIds: [i + 1], artifactIds: [40 + i] });
  }
  s.teams = [{ id: 'e', listId: 'l', members: [ancien, second], leader: ancien, lead: { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } }];
  const avant = structuredClone(s), compte = data(); compte.siegeDefenseTeams = [deck('ancien', [2, 1, null])];
  const r = reverifierStockageOptimizer(s, compte, runeIds);
  egal(r.stockage.members.map(m => m.selector), [second, ancien], 'permutation des slots');
  egal(r.stockage.memories.get(cleMemoireMembre('l', second))?.criteres.minStats.spd, 210, 'mémoire du premier suit sans écraser celle du second');
  egal(r.stockage.identities.get(cleMemoireMembre('l', second))?.com2usId, 1001, 'identité migrée');
  egal(r.stockage.teams[0].leader, second, 'leader et membres migrés, sans dissolution');
  egal(r.stockage.validated[0], { ...s.validated[0], selector: second }, 'runes et artéfacts inchangés');
  const p = rattacherProprietaireCriteres({ listId: 'l', selector: ancien, com2usId: 1001 }, r.rapport.rattachements);
  ok(!!validerProprietaireCriteres(p, { ...r.stockage, activeListId: 'l' }, { selectedId: '1', sourceSelector: second }, compte), 'propriétaire validé contre le nouvel état');
  ok(isDeepStrictEqual(s, avant), 'entrée pure : stockage intégralement intact');
  ok(reverifierStockageOptimizer(r.stockage, compte, runeIds).stockage === r.stockage, 'réimport identique : même stockage, aucune réécriture');
  egal(r.rapport.rattachements.length, 2, 'rapport individuel pour les deux membres');

  const orphelin: ExclusionSelector = { source: 'box', unitKey: 'destination' }, avecOrphelin = stockage();
  const criteres = baseCompleteCriteres(undefined);
  avecOrphelin.memories.set(cleMemoireMembre('l', ancien), { listId: 'l', selector: ancien, com2usId: 1001, criteres });
  const memoireOrpheline = { listId: 'l', selector: orphelin, com2usId: 1002, criteres };
  avecOrphelin.memories.set(cleMemoireMembre('l', orphelin), memoireOrpheline);
  avecOrphelin.identities.set(cleMemoireMembre('l', orphelin), { ...memoireOrpheline });
  const destination = data(); destination.box.push(box('destination'));
  const collision = reverifierStockageOptimizer(avecOrphelin, destination, runeIds);
  egal(collision.stockage.memories.get(cleMemoireMembre('l', orphelin))?.com2usId, 1001, 'mémoire du membre prioritaire sur une entrée orpheline');
  egal(collision.stockage.rejets.memories, [[cleMemoireMembre('l', orphelin), memoireOrpheline]], 'collision : mémoire orpheline conservée brute');
  const reluCollision = lireMembresOptimizer(ecrireMembresOptimizer(collision.stockage));
  egal(reluCollision.rejets.identities, collision.stockage.rejets.identities, 'identité orpheline conservée sans réactivation à la relecture');
}

export function testOptimizerRattachementRuneVendue() {
  titre('Rattachement · rune disparue conservée dans le build, exclue de la réservation');
  const s = stockage([{ source: 'box', unitKey: 'temoin' }]); s.identities.clear();
  s.validated = [{ listId: 'l', selector: s.members[0].selector, runeIds: [1, 2, 3, 4, 5, 6], artifactIds: [50] }];
  const compte = data(), acquis = acquerirIdentitesMembres(s, compte), r = reverifierStockageOptimizer(acquis, compte, new Set([1, 2, 3, 4, 5]));
  egal(r.stockage.validated[0].runeIds, [1, 2, 3, 4, 5, 6], 'rune vendue reste dans l’instantané');
  egal(r.stockage.validated[0].runesManquantes, [6], 'build conservé et marqué');
  egal([...otherValidatedRuneIds(r.stockage.validated, 'l', null)], [1, 2, 3, 4, 5], 'seules les runes présentes réservées');
  egal([...otherValidatedRuneIds(r.stockage.validated, 'l', exclusionSelectorKey(s.members[0].selector))], [], 'auto-exemption conservée');
  egal(runesManquantesDuBuild(r.stockage.validated[0], new Set([1, 2, 3, 4, 5])), [6], 'marque affichée dérivée de l’inventaire courant');
  ok(r.rapport.messages.some(m => m.includes('build conservé')), 'build incomplet annoncé');
  ok(!reverifierStockageOptimizer(r.stockage, compte, runeIds).stockage.validated[0].runesManquantes, 'rune retrouvée : marque retirée');
  const vide = reverifierStockageOptimizer(r.stockage, { ...compte, box: [] }, new Set());
  ok(vide.stockage === r.stockage && vide.rapport.compteVide, 'compte vide : aucune modification');
}

export function testOptimizerRattachementDefensesComplet() {
  titre('Rattachement · défenses importées, builds validés, monstres déplacés ou retirés');
  const compte = data(); compte.siegeDefenseTeams = [deck('ancien', [1, 2, 3])];
  const importe = consommerImportOptimizer(stockage([]), null, importerDefensesSiegeOptimizer(compte), compte, 'defenses');
  const s = importe.stockage;
  const membres = s.members.filter(m => m.listId === importe.activeListId);
  egal(membres.length, 3, 'défense importée avec ses trois membres');
  ok(membres.every(m => s.identities.has(cleMemoireMembre(m.listId, m.selector))), 'consommateur : chaque identité acquise dès la création');
  s.validated = membres.map((m, i) => ({ ...m, runeIds: [i * 6 + 1, i * 6 + 2], artifactIds: [50 + i] }));
  const avant = structuredClone(s), nouveau = data(); nouveau.siegeDefenseTeams = [deck('ancien', [9, null, null]), deck('deplace', [1, null, null])];
  nouveau.siegeOffenseTeams = [deck('offense', [2, null, null])]; nouveau.box.push(box('box-3', 3));
  const r = reverifierStockageOptimizer(s, nouveau, runeIds);
  egal(r.stockage.members.filter(m => m.listId === importe.activeListId).map(m => m.selector.source), ['siege-defense', 'siege-offense', 'box'], 'rattachement selon le contenu Guilde');
  egal(r.stockage.lists, s.lists, 'liste intacte'); egal(r.stockage.validated.length, 3, 'tous les builds conservés');
  egal(r.stockage.memories.size, s.memories.size, 'toutes les mémoires conservées');
  egal(r.stockage.teams.length, s.teams.length, 'équipe conservée');
  ok(isDeepStrictEqual(s, avant), 'import et revérification ne modifient pas l’entrée');
  for (const [i, m] of r.stockage.members.filter(m => m.listId === importe.activeListId).entries()) {
    egal(resolveExclusionEntry(m.selector, nouveau)?.monster.com2usId, 1001 + i, 'espèce initiale conservée');
    egal(findValidatedBuild(r.stockage.validated, m.listId, exclusionSelectorKey(m.selector))?.artifactIds, [50 + i], 'build exact retrouvé par le membre rattaché');
    ok(r.stockage.memories.has(cleMemoireMembre(m.listId, m.selector)), 'mémoire retrouvée par la nouvelle clé');
  }
}

export function testOptimizerRattachementBranchement() {
  titre('Rattachement · import manuel et dossier, acquisition sur le compte précédent');
  const app = readFileSync('src/App.tsx', 'utf8'), compte = app.slice(app.indexOf('function appliquerCompte('), app.indexOf('function rafraichirCompte('));
  const lecture = compte.indexOf('const stockageCourant = optimizerLists.lireStockageCourant();'),
    acquisition = compte.indexOf('acquerirIdentitesMembres(stockageCourant, optimizerData)');
  ok(lecture >= 0 && acquisition > lecture && acquisition < compte.indexOf('setBox(boxItems)'),
    'acquisition sur l’état courant des listes, avant remplacement de la Box, chemin partagé manuel et dossier');
  ok(app.includes('reverificationEnAttente: () => stockageAvantImportRef.current !== null'),
    'import d’équipe refusé tant que la revérification du réimport attend');
  ok(app.includes('reverifierStockageOptimizer(stockageAvantImportRef.current ?? optimizerLists, data, runeIds, new Set(artifacts.map(a => a.id)))'), 'revérification du stockage enrichi avant import, inventaire complet des artéfacts compris');
  ok(app.includes('optimizer.appliquerReverificationMembres(resultat.stockage, resultat.rapport, data, runeIds)'), 'propriétaire et sélection suivent le résultat commun');
  ok(app.includes('const acquis = acquerirIdentitesMembres(optimizerLists, optimizerData)'), 'compte conservé : acquisition au chargement');
}
