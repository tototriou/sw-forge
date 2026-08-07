// Mappe les données brutes d'un export (parseur → ImportedUnit/SiegeImportedDeck)
// vers les structures attendues par les états RTA & Siège. Partagé par l'import
// global (App) pour alimenter toutes les pages d'un coup.

import { GearSet, Monster, RTA_OTHER, RTA_UNASSIGNED } from '../types';
import { ImportedUnit, SiegeImportedDeck } from './importAccount';
import { SIEGE_TICKS, combatSpeed, siegeLeadFor, speedLeadOf } from './speed';

// Set principal pour pré-classer un monstre en RTA (4 pièces prioritaires).
const RTA_SET_PRIORITY = ['violent', 'swift', 'despair', 'rage', 'fatal', 'vampire'];
function primarySection(sets: string[]): string {
  for (const key of RTA_SET_PRIORITY) if (sets.includes(key)) return key;
  return RTA_OTHER;
}

type MappedSlot = { monsterId: string | null; runeSpeed: number | null; sets?: string[]; tick?: number; gear?: GearSet };

// Vitesse de runes finale = SPD plate + bonus Swift (25% de la base) si set complet.
function runeSpeedOf(flatRuneSpeed: number, swift: boolean, base: number): number {
  return flatRuneSpeed + (swift ? Math.round((base * 25) / 100) : 0);
}

// Tick de siège le plus proche d'une vitesse de combat (0 si inconnue).
function nearestTick(combat: number | null): number {
  if (combat === null) return 0;
  let best = 0;
  let bestDiff = Infinity;
  for (const t of SIEGE_TICKS) {
    const diff = Math.abs(combat - t.value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = t.value;
    }
  }
  return best;
}

// Box RTA → entrées { monsterId, runeSpeed, section, sets }, dédupliquées au
// meilleur build (SPD max). La section est pré-classée selon le set principal.
export function mapRtaItems(
  units: ImportedUnit[],
  byCom2us: Map<number, Monster>
): { monsterId: string; runeSpeed: number; section: string; sets: string[]; gear?: GearSet }[] {
  const best = new Map<string, { runeSpeed: number; sets: string[]; runeCount: number; gear?: GearSet }>();
  for (const u of units) {
    const mon = byCom2us.get(u.com2usId);
    if (!mon) continue;
    const rs = runeSpeedOf(u.flatRuneSpeed, u.swift, mon.stats.speed ?? 0);
    const id = String(mon.id);
    const prev = best.get(id);
    if (!prev || rs > prev.runeSpeed) {
      best.set(id, { runeSpeed: rs, sets: u.sets ?? [], runeCount: u.runeCount ?? 0, gear: u.gear });
    }
  }
  return Array.from(best, ([monsterId, v]) => ({
    monsterId,
    runeSpeed: v.runeSpeed,
    sets: v.sets,
    gear: v.gear,
    // Build incomplet (< 6 runes) → on laisse en « Non classé ».
    section: v.runeCount >= 6 ? primarySection(v.sets) : RTA_UNASSIGNED,
  }));
}

// Decks de siège → équipes { slots }. `missing` = monstres non trouvés (slots laissés vides).
export function mapSiegeTeams(
  decks: SiegeImportedDeck[],
  byCom2us: Map<number, Monster>
): { teams: { slots: MappedSlot[] }[]; missing: number } {
  let missing = 0;
  const teams = decks.map((dk) => {
    // Lead auto (leader = slot 0) pour la vitesse de combat.
    const leader = dk.slots[0] ? byCom2us.get(dk.slots[0].com2usId) ?? null : null;
    const leadInfo = speedLeadOf(leader);
    // Pas de tick si l'équipe contient Leo, ou au moins un Swift (équipe speed).
    const hasLeo = dk.slots.some((s) => s != null && byCom2us.get(s.com2usId)?.name === 'Leo');
    const teamHasSwift = dk.slots.some((s) => s != null && s.sets.includes('swift'));
    const noTick = hasLeo || teamHasSwift;
    return {
      slots: dk.slots.map((slot): MappedSlot => {
        if (!slot) return { monsterId: null, runeSpeed: null, sets: [], tick: 0 };
        const mon = byCom2us.get(slot.com2usId);
        if (!mon) {
          missing++;
          return { monsterId: null, runeSpeed: null, sets: [], tick: 0 };
        }
        const runeSpeed = runeSpeedOf(slot.flatRuneSpeed, slot.swift, mon.stats.speed ?? 0);
        const combat = combatSpeed(mon.stats.speed, runeSpeed, siegeLeadFor(leadInfo, mon.element));
        return {
          monsterId: String(mon.id),
          runeSpeed,
          sets: slot.sets,
          tick: noTick ? 0 : nearestTick(combat),
          gear: slot.gear,
        };
      }),
    };
  });
  return { teams, missing };
}
