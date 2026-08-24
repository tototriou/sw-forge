// Import d'un deck de siège (défense ou offense) dans le speed tuning.
// Calcul pur : une équipe de siège → les monstres à poser dans « Ton équipe »,
// avec leur vitesse de runes, et le lead à appliquer au camp.
//
// Voir spec/outils/speed-tuning.md, « Importer un deck de siège ».

import { ElementKey, Monster, SiegeSlot, SiegeTeam } from '../types';
import { siegeLeadFor, speedLeadOf } from './speed';

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

// Un lead d'ÉLÉMENT : ce qu'il donne, et à quel élément.
export interface LeadElement {
  valeur: number;
  element: ElementKey;
}

export interface DeckImporte {
  // Dans l'ordre des slots (0 = leader), slots vides et monstres inconnus
  // écartés. `runeSpeed` vient du slot de siège : d'après la convention de
  // l'app, il contient DÉJÀ le Swift à plat (voir spec/shared/calcul-vitesse.md).
  monstres: {
    monster: Monster;
    runeSpeed: number | null;
    artefactBuff: number | null;
    swift: boolean;
    // Les sets ACTIFS du slot. Le Swift a sa propre case parce qu'il change la
    // vitesse de combat ; les autres servent au comptage des buffs portés
    // (Volonté, Bouclier — voir speedTuneAuto.ts).
    sets: string[];
    // Le lead qui s'applique VRAIMENT à CE monstre (`siegeLeadFor`) : 21 pour un
    // allié Feu sous un lead « VIT alliés Feu », 0 pour ses camarades d'un autre
    // élément.
    //
    // ⚠️ **Sans lui, l'écran et le verdict divergeaient.** La card de siège
    // affichait la vitesse avec le lead d'élément, le speed tune la recalculait
    // sans (voir `lead` plus bas) : deux nombres pour un même monstre, et un
    // verdict « il manque X de VIT » sur une vitesse que personne n'a sous les
    // yeux.
    lead: number;
  }[];
  // Lead à appliquer au CAMP, ou `null` si le deck n'en impose pas.
  //
  // ⚠️ Un lead d'ÉLÉMENT ne s'y transpose pas : le sélecteur de camp n'a qu'une
  // valeur, l'appliquer à tout le monde gonflerait la vitesse des monstres d'un
  // autre élément. Il passe donc **monstre par monstre** (`monstres[].lead`), et
  // `leadParMonstre` dit qu'il faut le lire là plutôt qu'ici. Seuls les leads
  // qui valent pour TOUS (General / Guild) remplissent ce champ.
  lead: number | null;
  // Le lead du deck se lit-il monstre par monstre ? Vrai pour un lead d'ÉLÉMENT,
  // que le sélecteur de camp ne sait pas dire.
  leadParMonstre: boolean;
  // Le lead d'ÉLÉMENT du deck, pour l'AFFICHER dans l'encart « Lead » du camp :
  // sa valeur et l'élément qu'il favorise. `null` quand il n'y en a pas.
  //
  // ⚠️ Il est LU sur le leader, pas déduit des monstres : un deck dont aucun
  // allié n'est de l'élément du leader impose quand même ce lead — il ne profite
  // simplement à personne, et l'encart doit le dire quand même.
  leadElement: LeadElement | null;
}

export function deckPourSpeedTune(team: SiegeTeam, monsterById: Map<string, Monster>): DeckImporte {
  // Le leader est le slot 0 (convention du siège), pas `team.lead`. Lu AVANT la
  // boucle : chaque monstre a besoin de savoir ce que le lead lui donne, à lui.
  const leaderId = team.slots[0]?.monsterId ?? null;
  const info = speedLeadOf(leaderId ? monsterById.get(leaderId) : null);

  const monstres: DeckImporte['monstres'] = [];
  for (const slot of team.slots) {
    const monster = slot.monsterId ? monsterById.get(slot.monsterId) : null;
    if (!monster) continue;
    monstres.push({
      monster,
      runeSpeed: slot.runeSpeed,
      artefactBuff: arteBuffDeSlot(slot),
      // Le set Rapidité change la vitesse de combat : ses 25 % entrent dans la
      // SOMME des pourcentages, alors que la « SPD runes » les porte déjà à plat
      // (voir combatSpeed). L'écart n'est que d'un point, mais un point suffit à
      // rater un tick.
      swift: (slot.sets ?? []).includes('swift'),
      sets: slot.sets ?? [],
      // ⚠️ **La même fonction que la card de siège** (`siegeLeadFor`) : c'est ce
      // qui garantit que la vitesse affichée et celle du verdict sont le même
      // nombre. Deux calculs de lead, et l'écart revient.
      lead: siegeLeadFor(info, monster.element),
    });
  }

  const lead = info && (info.area === 'General' || info.area === 'Guild') ? info.amount : null;

  const parElement = info?.area === 'Element';
  return {
    monstres,
    lead,
    leadParMonstre: parElement,
    leadElement:
      parElement && info.element ? { valeur: info.amount, element: info.element } : null,
  };
}
