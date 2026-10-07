// Recommandations — un monstre choisi, le curseur passe au slot vide suivant
// (refonte graphique, décision 18). Le focus ne se voit pas dans un rendu
// serveur : on teste le CHOIX du slot, qui est tout le calcul.

import { prochainFocus, slotVideSuivant } from '../src/components/siege/slotVideSuivant';
import { egal, titre } from './outils';

export default function testSiegeSlotSuivant() {
  titre('Recommandations — le slot vide suivant, après un choix de monstre');

  egal(slotVideSuivant([false, false, false], 0), 1, 'trio vide, leader choisi : le slot 2');
  egal(slotVideSuivant([true, false, false], 1), 2, 'slot 2 choisi : le slot 3');
  egal(slotVideSuivant([true, true, false], 2), null, 'dernier slot choisi, trio complet : aucun');
  egal(slotVideSuivant([false, false, false], 1), 2, 'commencé par le slot 2 : le slot 3 d\'abord');
  egal(slotVideSuivant([false, true, false], 2), 0, 'slot 3 choisi, le leader encore vide : on revient au leader');
  egal(slotVideSuivant([false, true, true], 0), null, 'le slot choisi comptait vide : il est pris quand même — aucun');
  egal(slotVideSuivant([true, false, true], 0), 1, 'un trou au milieu : le slot 2');

  // Le jeton change à chaque demande, même vers le même slot.
  const a = prochainFocus(null, [false, false, false], 0);
  egal(a, { slot: 1, n: 1 }, 'premier choix : slot 2, jeton 1');
  const b = prochainFocus(a, [false, false, false], 0);
  egal(b, { slot: 1, n: 2 }, 'même slot visé deux fois de suite : le jeton change (2)');
  egal(prochainFocus(b, [true, true, false], 2), null, 'trio complet : plus de focus à donner');
}
