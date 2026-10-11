import { emptyRecoSlot, type GearSet, type Monster, type RecoDeck, type SiegeTeam } from '../src/types';
import type { ExclusionSourceData } from '../src/lib/optimizerExclusion';
import type { StockageOptimizer } from '../src/lib/optimizerMemberStorage';

export function monstreComposition(id: number): Monster {
  return { id, com2usId: 1000 + id, name: `Monstre ${id}`, element: id === 2 ? 'water' : 'fire',
    stars: 5, naturalStars: 5, secondAwaken: false, image: null,
    stats: { hp: 10000, attack: 700, defense: 600, speed: 101, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
    leaderSkill: id === 1 ? { stat: 'Attack Speed', amount: 30, area: 'Element', element: 'fire' } : null };
}
export function gearComposition(points = 0): GearSet {
  return { base: { hp: 10000, atk: 700, def: 600, spd: 101 + points, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
}
export function deckComposition(id: string, ids = [3, 1, 2]): SiegeTeam {
  return { id, lead: 99, tickAlertDismissed: false, slots: ids.map(m => ({ monsterId: String(m), runeSpeed: 999, tick: 300,
    sets: ['violent'], gear: gearComposition() })) };
}
export function recommandationComposition(ids: (number | null)[] = [1, 2, 3]): RecoDeck {
  return { name: 'Composition recommandée', note: '', counters: [], slots: ids.map(id => ({ ...emptyRecoSlot(),
    com2usId: id === null ? null : 1000 + id, name: id === null ? '' : `Monstre ${id}` })) };
}
export function sourcesComposition(): ExclusionSourceData {
  return { box: [1, 2, 3, 4].map(id => ({ key: `box-${id}`, monster: monstreComposition(id), stars: 6, level: 40, gear: gearComposition() })),
    rtaEntries: { '1': { monsterId: '1', section: 'swift', runeSpeed: 999, gear: gearComposition() } },
    siegeDefenseTeams: [deckComposition('d1', [4, 5, 6])], siegeOffenseTeams: [deckComposition('o1')],
    monsterById: new Map([1, 2, 3, 4, 5, 6].map(id => [String(id), monstreComposition(id)])) };
}
export function stockageComposition(): StockageOptimizer {
  return { identities: new Map(), lists: [], members: [], validated: [], memories: new Map(), teams: [], listContents: new Map(),
    rejets: { memories: [], teams: [], listContents: [] } };
}
