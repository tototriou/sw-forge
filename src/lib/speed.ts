import { ElementKey, Monster } from '../types';

// Calcul de vitesse partagé (RTA, Siège, Arène…), pour rester cohérent partout.

// Totem de vitesse de guilde : +15% de vitesse de base, toujours actif.
export const TOTEM_SPEED = 15;

// Leader skills de vitesse, du plus fort au plus faible.
export const SPEED_LEADS = [33, 30, 28, 24, 23, 19];

// Ticks de vitesse de siège (vitesse de combat cible).
export const SIEGE_TICKS: { key: string; label: string; value: number }[] = [
  { key: 'fast', label: 'Rapide', value: 286 },
  { key: 'slow', label: 'Lent', value: 239 },
];

// Bonus en % appliqué à la vitesse de BASE (totem + lead), arrondi au supérieur.
export function pctSpeedBonus(base: number, lead: number): number {
  return Math.ceil((base * (TOTEM_SPEED + lead)) / 100);
}

// Vitesse de combat = base + runes + totem + lead (bonus % sur la base).
export function combatSpeed(
  base: number | null,
  rune: number | null,
  lead: number
): number | null {
  if (base === null) return null;
  return base + (rune ?? 0) + pctSpeedBonus(base, lead);
}

// Vitesse de runes nécessaire pour atteindre une vitesse de combat cible (tick).
export function runeSpeedForTarget(base: number | null, lead: number, target: number): number | null {
  if (base === null) return null;
  return target - base - pctSpeedBonus(base, lead);
}

/* --- Leads de vitesse déduits automatiquement de la leader skill --- */

export interface LeadInfo {
  amount: number;
  area: string;
  element: ElementKey | null;
}

// Le lead de vitesse d'un monstre (leader), ou null s'il n'en a pas.
export function speedLeadOf(monster: Monster | null | undefined): LeadInfo | null {
  const ls = monster?.leaderSkill;
  if (!ls || ls.stat !== 'Attack Speed') return null;
  return { amount: ls.amount, area: ls.area, element: ls.element };
}

// Lead effectif EN SIÈGE (contenu de guilde) pour un allié d'élément donné.
// General/Guild → tous ; Element → seulement l'élément ; Arena/Dungeon → inactif.
export function siegeLeadFor(lead: LeadInfo | null, element: ElementKey): number {
  if (!lead) return 0;
  if (lead.area === 'General' || lead.area === 'Guild') return lead.amount;
  if (lead.area === 'Element') return lead.element === element ? lead.amount : 0;
  return 0;
}

// Le lead est-il actif en siège (indépendamment de l'élément de l'allié) ?
export function isSiegeLeadActive(lead: LeadInfo | null): boolean {
  return !!lead && (lead.area === 'General' || lead.area === 'Guild' || lead.area === 'Element');
}
