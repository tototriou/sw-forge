// Import d'un deck de siège (défense ou offense) dans le speed tuning.
// Calcul pur : une équipe de siège → les monstres à poser dans « Ton équipe »,
// avec leur vitesse de runes, et le lead à appliquer au camp.
//
// Voir spec/outils/speed-tuning.md, « Importer un deck de siège ».

import { Monster, SiegeTeam } from '../types';
import { speedLeadOf } from './speed';

export interface DeckImporte {
  // Dans l'ordre des slots (0 = leader), slots vides et monstres inconnus
  // écartés. `runeSpeed` vient du slot de siège : d'après la convention de
  // l'app, il contient DÉJÀ le Swift à plat (voir spec/shared/calcul-vitesse.md).
  monstres: { monster: Monster; runeSpeed: number | null }[];
  // Lead à appliquer au CAMP, ou `null` si le deck n'en impose pas.
  //
  // ⚠️ Un lead d'ÉLÉMENT ne se transpose pas : le speed tuning n'a qu'un lead
  // par camp, l'appliquer à tout le monde gonflerait la vitesse des monstres
  // d'un autre élément. Dans ce cas on ne touche à rien — c'est à la saisie de
  // trancher. Seuls les leads qui valent pour TOUS (General / Guild) passent.
  lead: number | null;
}

export function deckPourSpeedTune(team: SiegeTeam, monsterById: Map<string, Monster>): DeckImporte {
  const monstres: DeckImporte['monstres'] = [];
  for (const slot of team.slots) {
    const monster = slot.monsterId ? monsterById.get(slot.monsterId) : null;
    if (!monster) continue;
    monstres.push({ monster, runeSpeed: slot.runeSpeed });
  }

  // Le leader est le slot 0 (convention du siège), pas `team.lead`.
  const leaderId = team.slots[0]?.monsterId ?? null;
  const info = speedLeadOf(leaderId ? monsterById.get(leaderId) : null);
  const lead = info && (info.area === 'General' || info.area === 'Guild') ? info.amount : null;

  return { monstres, lead };
}
