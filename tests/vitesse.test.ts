// Vitesse de combat — la formule la plus scrutée de l'app : c'est le premier
// chiffre qu'un joueur compare avec son jeu, et le premier qu'il signale s'il
// est faux. Elle a été corrigée trois fois avant d'arriver à la bonne règle
// (voir spec/shared/calcul-vitesse.md).

import { combatSpeed, pctSpeedBonus, swiftFlat } from '../src/lib/speed';
import { egal, ok, titre } from './outils';

export default function testVitesse() {
  titre('Vitesse de combat');

  // ⚠️ LA règle : tous les % qui portent sur la base sont SOMMÉS, puis arrondis
  // à l'entier supérieur UNE SEULE FOIS. Totem, lead et Swift dans la même
  // somme. Arrondir bonus par bonus donnait des écarts d'un point, invisibles
  // en test unitaire mais fatals sur un speed tune.
  egal(pctSpeedBonus(96, 0), 15, 'base 96, sans lead → +15 (totem seul)');
  egal(pctSpeedBonus(99, 0), 15, 'base 99, sans lead → +15');
  egal(pctSpeedBonus(105, 0), 16, 'base 105, sans lead → +16');

  // Cas de contrôle relevés en jeu sur le compte de l'auteur, avec lead +30 %
  // et set Swift complet.
  // ⚠️ Le bonus % est le même pour les trois (70 % = 15 totem + 30 lead + 25
  // Swift) mais l'arrondi tombe différemment : c'est là que la formule fautive
  // se trahissait, sur Tarq uniquement.
  egal(pctSpeedBonus(101, 30, true), 71, 'Chilling, base 101, lead 30 + Swift → +71');
  egal(pctSpeedBonus(107, 30, true), 75, 'Susano, base 107, lead 30 + Swift → +75');
  egal(pctSpeedBonus(115, 30, true), 81, 'Tarq, base 115, lead 30 + Swift → +81 (et non 80)');

  // Totaux relevés en jeu. La « SPD runes » saisie inclut déjà le plat du Swift.
  egal(combatSpeed(101, 221, 30, true), 367, 'Chilling → 367 en combat');
  egal(combatSpeed(107, 220, 30, true), 375, 'Susano → 375 en combat');
  egal(combatSpeed(115, 218, 30, true), 385, 'Tarq → 385 en combat');

  // Sans Swift, la compensation ne doit pas s'appliquer.
  egal(combatSpeed(96, 175, 0, false), 286, 'base 96 + 175 runes, sans lead ni Swift → 286');

  // ⚠️ `swiftFlat` compense la convention d'affichage : la SPD saisie inclut
  // déjà le bonus Swift, on le retire avant de le réintégrer dans la somme.
  egal(swiftFlat(101), 26, 'Swift sur base 101 → 26 points');
  ok(combatSpeed(null as any, 100, 0, false) === null, 'base inconnue → aucun calcul, pas une valeur fausse');
}
