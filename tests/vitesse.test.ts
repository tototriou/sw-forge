// Vitesse de combat — la formule la plus scrutée de l'app : c'est le premier
// chiffre qu'un joueur compare avec son jeu, et le premier qu'il signale s'il
// est faux. Elle a été corrigée trois fois avant d'arriver à la bonne règle
// (voir spec/shared/calcul-vitesse.md).

import { combatSpeed, pctSpeedBonus, swiftFlat, tickDanger, tickTeamMessage } from '../src/lib/speed';
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

  // ⚠️ « Pas au tick » recouvre deux situations OPPOSÉES, qui se corrigent en
  // sens contraires : il manque quelques points, ou on dépasse largement. C'est
  // `kind` qui décide du message affiché en siège — s'inverser reviendrait à
  // envoyer le joueur chercher du mauvais côté.
  egal(tickDanger(286), null, 'pile au tick rapide → rien à signaler');
  egal(tickDanger(301), null, 'tick dépassé de 15 → dans la marge tolérée');
  egal(tickDanger(302)?.kind, 'above', 'tick dépassé de 16 → trop rapide');
  egal(tickDanger(302)?.tick, 286, 'trop rapide : le tick cité est celui franchi');
  egal(tickDanger(283)?.kind, 'below', 'à 3 sous le tick → raté de peu');
  egal(tickDanger(269)?.kind, 'above', 'tick lent dépassé de 30 → trop rapide');
  egal(tickDanger(250), null, 'entre les deux ticks, dans les marges → rien à signaler');

  // ⚠️ Le message doit dire dans QUEL SENS corriger, et NOMMER chaque monstre
  // fautif. Un message d'équipe ne pouvait pas décrire trois situations
  // différentes : il en laissait un dans l'ombre.
  const msg = (couples: [string, number][]) =>
    tickTeamMessage(couples.map(([nom, v]) => ({ nom, danger: tickDanger(v) })));

  egal(msg([['Tesarion', 286], ['Camille', 239]]), null, 'équipe calée → aucun message');
  egal(
    msg([['Tesarion', 283], ['Camille', 286]]),
    "Tesarion n'atteint pas le tick 286.",
    'un seul fautif : lui seul est nommé'
  );
  egal(
    msg([['Tesarion', 283], ['Camille', 305], ['Riley', 281]]),
    "Tesarion n'atteint pas le tick 286, Camille dépasse le tick 286 et Riley n'atteint pas le tick 286.",
    'LES TROIS sont nommés, chacun avec son défaut'
  );
  // ⚠️ Dépasser 239 sans atteindre 286, c'est être trop rapide pour l'un et trop
  // lent pour l'autre. Ne citer que le tick franchi ferait ralentir à tort.
  egal(
    msg([['Camille', 265]]),
    'Camille dépasse le tick 239 sans atteindre le 286.',
    'entre deux ticks : les deux repères sont nommés'
  );
  egal(
    msg([['Camille', 305]]),
    'Camille dépasse le tick 286.',
    'au-dessus du tick le plus haut : pas de tick suivant à viser'
  );
}
