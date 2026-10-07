// Recommandations — vue Défense (refonte graphique, décision 19) : les
// défenses visées regroupées, avec les offenses qui les battent. Dérivée des
// decks, sans rien stocker.

import { cleDefense, vueDefenses } from '../src/lib/recoDefenses';
import type { Reco, RecoCounter, RecoDeck } from '../src/types';
import { egal, ok, titre } from './outils';

const m = (id: number | null, name = '') => ({ com2usId: id, name });
const def = (monsters: RecoCounter['monsters'], note = ''): RecoCounter => ({ monsters, note });
const deck = (counters: RecoCounter[]): RecoDeck => ({ name: '', note: '', slots: [], counters });
const reco = (decks: RecoDeck[]): Reco => ({ id: 'r', origin: 'mine', name: '', author: '', note: '', decks });

export default function testRecoDefenses() {
  titre('Recommandations — vue Défense : regroupement des défenses visées');

  // Identité d'une défense.
  egal(cleDefense([m(1), m(2), m(3)]), cleDefense([m(1), m(3), m(2)]), 'même leader, les deux autres inversés : même défense');
  ok(cleDefense([m(1), m(2), m(3)]) !== cleDefense([m(2), m(1), m(3)]), 'leader différent : autre défense');
  egal(cleDefense([m(null), m(null), m(null)]), null, 'défense vide : pas de clé');
  egal(cleDefense([m(null, 'Chloe'), m(2), m(null)]), cleDefense([m(null, ' chloe '), m(2), m(null)]), 'monstre saisi à la main : reconnu à son nom, sans casse ni espaces');

  // Regroupement.
  const vue = vueDefenses(
    reco([
      deck([def([m(1), m(2), m(3)], 'si 1 en lead'), def([m(7), m(8), m(9)])]),
      deck([]),
      deck([def([m(1), m(3), m(2)])]),
      deck([def([m(null), m(null), m(null)])]),
      deck([def([m(1), m(2), m(3)]), def([m(1), m(3), m(2)])]),
    ]),
  );
  egal(vue.defenses.map((d) => d.cle), [cleDefense([m(1), m(2), m(3)]), cleDefense([m(7), m(8), m(9)])], 'deux défenses, dans l\'ordre de première apparition');
  egal(vue.defenses[0].offenses.map((o) => o.deckIndex), [0, 2, 4], 'la première est battue par les decks 1, 3 et 5');
  egal(vue.defenses[0].offenses[0].note, 'si 1 en lead', 'la précision reste celle du deck qui la porte');
  egal(vue.defenses[0].offenses[2].counterIndex, 0, 'un deck qui vise deux fois la même défense n\'y figure qu\'une fois (la première saisie)');
  egal(vue.defenses[0].monsters.map((x) => x.com2usId), [1, 2, 3], 'les monstres affichés : ceux de la première saisie');
  egal(vue.sansDefense, [1, 3], 'decks sans défense visée (dont une défense vide) : gardés à part');

  // Filtre d'une recherche.
  const filtree = vueDefenses(reco([deck([def([m(1), m(2), m(3)])]), deck([def([m(1), m(2), m(3)])]), deck([])]), (d) => d !== 0);
  egal(filtree.defenses[0].offenses.map((o) => o.deckIndex), [1], 'recherche : seules les offenses gardées restent');
  egal(filtree.sansDefense, [2], 'recherche : un deck sans défense gardé reste à part');
  egal(vueDefenses(reco([deck([def([m(1), m(2), m(3)])])]), () => false).defenses.length, 0, 'plus aucune offense : la défense disparaît de la vue');
}
