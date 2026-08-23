// Import d'un deck de siège (défense ou offense) dans le speed tuning.
// Calcul pur : une équipe de siège → les monstres à poser dans « Ton équipe »,
// avec leur vitesse de runes, et le lead à appliquer au camp.
//
// Voir spec/outils/speed-tuning.md, « Importer un deck de siège ».

import { Monster, SiegeSlot, SiegeTeam } from '../types';
import { speedLeadOf } from './speed';

// Propriété d'artéfact « Effet aug. VIT » (code 206 dans ARTIFACT_SUB) : elle
// AMPLIFIE le buff de vitesse, c'est exactement ce que le speed tuning appelle
// « Arté buff ». Les équipes importées d'un compte portent le `gear` de chaque
// monstre : la valeur se lit, elle n'a pas à être ressaisie.
const SUB_EFFET_VIT = 206;

// Somme sur les artéfacts du monstre : deux artéfacts peuvent chacun porter la
// propriété, et leurs effets s'ajoutent.
function arteBuffDeSlot(slot: SiegeSlot): number | null {
  let total = 0;
  for (const art of slot.gear?.artifacts ?? []) {
    for (const sub of art.subs) {
      if (sub.code === SUB_EFFET_VIT) total += sub.value;
    }
  }
  return total > 0 ? total : null;
}

export interface DeckImporte {
  // Dans l'ordre des slots (0 = leader), slots vides et monstres inconnus
  // écartés. `runeSpeed` vient du slot de siège : d'après la convention de
  // l'app, il contient DÉJÀ le Swift à plat (voir spec/shared/calcul-vitesse.md).
  monstres: { monster: Monster; runeSpeed: number | null; artefactBuff: number | null }[];
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
    monstres.push({ monster, runeSpeed: slot.runeSpeed, artefactBuff: arteBuffDeSlot(slot) });
  }

  // Le leader est le slot 0 (convention du siège), pas `team.lead`.
  const leaderId = team.slots[0]?.monsterId ?? null;
  const info = speedLeadOf(leaderId ? monsterById.get(leaderId) : null);
  const lead = info && (info.area === 'General' || info.area === 'Guild') ? info.amount : null;

  return { monstres, lead };
}
