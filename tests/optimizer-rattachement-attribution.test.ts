import { isDeepStrictEqual } from 'node:util';
import type { Monster, SiegeTeam } from '../src/types';
import { exclusionSelectorKey, findValidatedBuild, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { cleMemoireMembre, reverifierStockageOptimizer, type StockageOptimizer } from '../src/lib/optimizerMemberStorage';
import { validerProprietaireCriteres } from '../src/lib/optimizerCriteriaOwner';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { egal, ok, titre } from './outils';

export function testOptimizerRattachementReferenceConservee() {
  titre('Rattachement · espèce absente du bestiaire, sa référence conservée bloque toute autre attribution');
  const monstre = (id: number): Monster => ({ id, com2usId: 1000 + id, name: `Espèce ${id}`, element: 'fire', stars: 6,
    naturalStars: 5, secondAwaken: false, image: null, leaderSkill: null,
    stats: { hp: 10000, attack: 700, defense: 600, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 } });
  const a: ExclusionSelector = { source: 'siege-defense', teamId: 'd', slotIndex: 0 };
  const b: ExclusionSelector = { source: 'siege-defense', teamId: 'd', slotIndex: 1 };
  const defense: SiegeTeam = { id: 'd', lead: 0, tickAlertDismissed: false,
    slots: [{ monsterId: '2', runeSpeed: 0, tick: 0, gear: {
      base: { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [],
    } }, { monsterId: null, runeSpeed: 0, tick: 0 }, { monsterId: null, runeSpeed: 0, tick: 0 }] };
  const compte: ExclusionSourceData = { box: [{ key: 'temoin', monster: monstre(9), stars: 6, level: 40 }],
    monsterById: new Map(['2', '9'].map(id => [id, monstre(Number(id))])), rtaEntries: {}, siegeDefenseTeams: [defense], siegeOffenseTeams: [] };
  // A était au slot 0 et B au slot 1. Au réimport, A manque au bestiaire,
  // B occupe le slot 0, le slot 1 est vide : le slot 0 reste tenu par A.
  for (const ordre of [[a, b], [b, a]]) {
    const stockage: StockageOptimizer = { lists: [{ id: 'l', name: 'Guilde' }], members: ordre.map(selector => ({ listId: 'l', selector })),
      identities: new Map([a, b].map((selector, i) => [cleMemoireMembre('l', selector), { listId: 'l', selector, com2usId: 1001 + i }])),
      memories: new Map([a, b].map((selector, i) => {
        const criteres = baseCompleteCriteres(undefined); criteres.minStats.spd = 210 + i;
        return [cleMemoireMembre('l', selector), { listId: 'l', selector, com2usId: 1001 + i, criteres }];
      })), validated: [a, b].map((selector, i) => ({ listId: 'l', selector, runeIds: Array.from({ length: 6 }, (_, j) => 1 + j + i * 6) })),
      teams: [{ id: 'e', listId: 'l', members: [a, b], leader: a, lead: null }], listContents: new Map([['l', 'guilde']]),
      rejets: { memories: [], teams: [], listContents: [] } };
    const avant = structuredClone(stockage), resultat = reverifierStockageOptimizer(stockage, compte, new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
    const suivant = resultat.stockage, destinationB: ExclusionSelector = { source: 'unowned', monsterId: '2' };
    egal(suivant.members.map(m => m.selector), ordre.map(s => s === a ? a : destinationB), 'A garde sa référence et B ne la prend pas, quel que soit leur ordre');
    egal(new Set(suivant.members.map(m => exclusionSelectorKey(m.selector))).size, 2, 'deux références distinctes dans la liste');
    egal(suivant.identities.get(cleMemoireMembre('l', a))?.com2usId, 1001, 'identité de A intacte au slot gardé');
    egal(suivant.identities.get(cleMemoireMembre('l', destinationB))?.com2usId, 1002, 'identité de B migrée vers sa destination');
    egal(findValidatedBuild(suivant.validated, 'l', exclusionSelectorKey(suivant.members[ordre.indexOf(b)].selector))?.runeIds,
      [7, 8, 9, 10, 11, 12], 'la référence effective de B retrouve son propre build et jamais celui de A');
    egal(findValidatedBuild(suivant.validated, 'l', exclusionSelectorKey(a))?.runeIds, [1, 2, 3, 4, 5, 6], 'build de A conservé');
    egal(suivant.memories.get(cleMemoireMembre('l', destinationB))?.criteres.minStats.spd, 211, 'mémoire de B suivie sans collision');
    egal(suivant.teams[0], { ...stockage.teams[0], members: [a, destinationB] }, 'équipe à deux membres distincts, leader de A conservé');
    egal(resultat.rapport.rattachements.length, 1, 'seul B rattaché, aucun rapport provisoire publié');
    ok(resultat.rapport.messages.some(m => m.includes('1001') && m.includes('rattachement impossible')), 'conservation de A signalée');
    const fauxProprietaire = { listId: 'l', selector: a, com2usId: 1002 };
    egal(resolveExclusionEntry(a, compte)?.monster.com2usId, 1002, 'le slot gardé résout effectivement B');
    egal(validerProprietaireCriteres(fauxProprietaire, { ...suivant, activeListId: 'l' }, { selectedId: '2', sourceSelector: a }, compte), null,
      'identité enregistrée A différente du slot B : propriétaire refusé');
    ok(isDeepStrictEqual(stockage, avant), 'aucune modification de l’entrée');
  }
}
