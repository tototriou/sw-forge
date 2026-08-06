// Mappe les données brutes d'un export (parseur → ImportedUnit/SiegeImportedDeck)
// vers les structures attendues par les états RTA & Siège. Partagé par l'import
// global (App) pour alimenter toutes les pages d'un coup.

import { Monster } from '../types';
import { ImportedUnit, SiegeImportedDeck } from './importAccount';

// Slot mappé (le champ `tick` est ajouté par useSiegeState.importTeams).
type MappedSlot = { monsterId: string | null; runeSpeed: number | null };

// Vitesse de runes finale = SPD plate + bonus Swift (25% de la base) si set complet.
function runeSpeedOf(flatRuneSpeed: number, swift: boolean, base: number): number {
  return flatRuneSpeed + (swift ? Math.round((base * 25) / 100) : 0);
}

// Box RTA → entrées { monsterId, runeSpeed }, dédupliquées au meilleur build (SPD max).
export function mapRtaItems(
  units: ImportedUnit[],
  byCom2us: Map<number, Monster>
): { monsterId: string; runeSpeed: number }[] {
  const best = new Map<string, number>();
  for (const u of units) {
    const mon = byCom2us.get(u.com2usId);
    if (!mon) continue;
    const rs = runeSpeedOf(u.flatRuneSpeed, u.swift, mon.stats.speed ?? 0);
    const id = String(mon.id);
    const prev = best.get(id);
    if (prev === undefined || rs > prev) best.set(id, rs);
  }
  return Array.from(best, ([monsterId, runeSpeed]) => ({ monsterId, runeSpeed }));
}

// Decks de siège → équipes { slots }. `missing` = monstres non trouvés (slots laissés vides).
export function mapSiegeTeams(
  decks: SiegeImportedDeck[],
  byCom2us: Map<number, Monster>
): { teams: { slots: MappedSlot[] }[]; missing: number } {
  let missing = 0;
  const teams = decks.map((dk) => ({
    slots: dk.slots.map((slot): MappedSlot => {
      if (!slot) return { monsterId: null, runeSpeed: null };
      const mon = byCom2us.get(slot.com2usId);
      if (!mon) {
        missing++;
        return { monsterId: null, runeSpeed: null };
      }
      return {
        monsterId: String(mon.id),
        runeSpeed: runeSpeedOf(slot.flatRuneSpeed, slot.swift, mon.stats.speed ?? 0),
      };
    }),
  }));
  return { teams, missing };
}
