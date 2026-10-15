import type { RecoDeck, SiegeTeam } from '../types';
import { collectOwnedBuilds, collectOwnedTeams, countCopiesByCom2us, SOURCE_LABEL } from './ownedBuilds';
import { exclusionCandidatesFor, exclusionSelectorKey, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';
import { contexteConfrontationReco, matchDeck } from './recoMatch';

type RechercheDeck =
  | { type: 'recommandation'; deck: RecoDeck }
  | { type: 'speed-tuning'; composition: readonly (number | null)[] };
export interface DeckCompositionOptimizer {
  team: SiegeTeam;
  source: 'siege-defense' | 'siege-offense';
}

// La recommandation garde le choix de la confrontation ; le camp sans
// provenance exige une composition exacte, copies comprises, hors ordre.
export function retrouverDeckCompositionOptimizer(
  recherche: RechercheDeck, data: ExclusionSourceData
): DeckCompositionOptimizer | null {
  if (recherche.type === 'recommandation') {
    const args = { box: data.box, rta: Object.values(data.rtaEntries), defense: data.siegeDefenseTeams,
      offense: data.siegeOffenseTeams, monsterById: data.monsterById };
    const retenu = matchDeck(recherche.deck, contexteConfrontationReco(
      collectOwnedBuilds(args), collectOwnedTeams(args), countCopiesByCom2us(data.box)
    ));
    for (const source of ['siege-defense', 'siege-offense'] as const) {
      const teams = source === 'siege-defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
      const label = SOURCE_LABEL[source === 'siege-defense' ? 'defense' : 'offense'];
      const index = teams.findIndex((_, i) => retenu.team === `${label} ${i + 1}`);
      if (index >= 0) return { team: teams[index], source };
    }
    return null;
  }
  const composition = recherche.composition;
  if (!composition.length || composition.some(id => id === null || !Number.isSafeInteger(id) || id <= 0)) return null;
  const attendue = [...composition].sort((a, b) => a! - b!);
  for (const source of ['siege-defense', 'siege-offense'] as const) {
    const teams = source === 'siege-defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
    for (const team of teams) {
      const ids = team.slots.filter(s => s.monsterId !== null)
        .map(s => data.monsterById.get(s.monsterId!)?.com2usId ?? null).sort((a, b) => (a ?? 0) - (b ?? 0));
      if (ids.length === attendue.length && ids.every((id, i) => id === attendue[i])) return { team, source };
    }
  }
  return null;
}

// Une entrée réelle sans équipement résolvable ne devient jamais « non possédé ».
export function selecteurRepliCompositionOptimizer(
  monsterId: string, com2usId: number, data: ExclusionSourceData, priorite: 'box' | 'offense',
  dejaPris: ReadonlySet<string> = new Set()
): ExclusionSelector | null {
  const sources = priorite === 'offense'
    ? ['siege-offense', 'box', 'rta', 'siege-defense'] as const
    : ['box', 'rta', 'siege-defense', 'siege-offense'] as const;
  for (const source of sources) {
    const candidat = exclusionCandidatesFor(source, data, null, null, false)
      .find(c => c.monster.com2usId === com2usId && !dejaPris.has(exclusionSelectorKey(c.selector)));
    if (candidat) return { ...candidat.selector };
  }
  const possede = data.box.some(b => b.monster.com2usId === com2usId)
    || Object.values(data.rtaEntries).some(e => data.monsterById.get(e.monsterId)?.com2usId === com2usId)
    || [...data.siegeDefenseTeams, ...data.siegeOffenseTeams].some(t =>
      t.slots.some(s => s.monsterId !== null && data.monsterById.get(s.monsterId)?.com2usId === com2usId));
  const nonPossede: ExclusionSelector = { source: 'unowned', monsterId };
  return possede || dejaPris.has(exclusionSelectorKey(nonPossede)) ? null : nonPossede;
}
