// Recommandations — vue Défense : les
// défenses visées regroupées, avec les offenses qui les battent. Dérivée des
// decks, sans rien stocker. Et la clé d'une équipe (`cleEquipe`), partagée avec
// la fusion d'un import : le chef, le lead actif en siège.

import { cleEquipe, leadActifEnSiege, vueDefenses, type MonstresConnus } from '../src/lib/recoDefenses';
import type { ElementKey, LeaderSkill, Monster, Reco, RecoCounter, RecoDeck } from '../src/types';
import { egal, monstersJson, ok, titre } from './outils';

const m = (id: number | null, name = '') => ({ com2usId: id, name });
const def = (monsters: RecoCounter['monsters'], note = ''): RecoCounter => ({ monsters, note });
const deck = (counters: RecoCounter[]): RecoDeck => ({ name: '', note: '', slots: [], counters });
const reco = (decks: RecoDeck[]): Reco => ({ id: 'r', origin: 'mine', name: '', author: '', note: '', decks });

const lead = (area: string, element: ElementKey | null = null, stat = 'Attack Power'): LeaderSkill => ({ stat, amount: 20, area, element });

// Les monstres des exemples de la règle, pris dans public/data/monsters.json :
// un seul monstre porte chacun de ces noms.
const MONSTRES = monstersJson() as Monster[];
export function monstreExemple(nom: string): Monster {
  const trouves = MONSTRES.filter((x) => x.name === nom);
  if (trouves.length !== 1) throw new Error(`« ${nom} » : ${trouves.length} monstres dans monsters.json, un seul attendu.`);
  return trouves[0];
}
export const connusReels: MonstresConnus = new Map(MONSTRES.filter((x) => x.com2usId != null).map((x) => [x.com2usId!, x]));
const ex = (nom: string) => m(monstreExemple(nom).com2usId, nom);

// Index FICTIF pour les cas de regroupement : 1 et 7 ont un lead de Guilde
// (actif en siège), les autres n'en ont pas.
const fictifs: MonstresConnus = new Map(
  [1, 2, 3, 7, 8, 9].map((id) => [id, { element: 'fire' as ElementKey, leaderSkill: id === 1 || id === 7 ? lead('Guild') : null }]),
);

export default function testRecoDefenses() {
  titre('Recommandations — le lead actif en siège, la clé d\'une équipe');

  // La règle de portée, étendue de la VIT (`siegeLeadFor`) à toute leader skill.
  ok(leadActifEnSiege(lead('General'), []), 'portée General : active');
  ok(leadActifEnSiege(lead('Guild'), []), 'portée Guild : active');
  ok(leadActifEnSiege(lead('Element', 'water'), ['fire', 'water']), 'portée Element : active si un monstre de l\'équipe est de cet élément');
  ok(!leadActifEnSiege(lead('Element', 'water'), ['fire', 'wind']), 'portée Element : inactive sans monstre de cet élément');
  ok(!leadActifEnSiege(lead('Arena'), ['fire']), 'portée Arena : inactive en siège');
  ok(!leadActifEnSiege(lead('Dungeon'), ['fire']), 'portée Dungeon : inactive en siège');
  ok(!leadActifEnSiege(null, ['fire']), 'pas de leader skill : pas de lead actif');

  // Ce que disent les données des monstres des exemples.
  egal(monstreExemple('Solveig').leaderSkill?.area, 'Guild', 'données : le lead de Solveig est de portée Guild');
  egal(monstreExemple('Odin').leaderSkill?.area, 'Guild', 'données : le lead d\'Odin est de portée Guild');
  egal(monstreExemple('Adriana').leaderSkill?.area, 'Arena', 'données : le lead d\'Adriana est de portée Arena');
  egal(monstreExemple('Kinki').leaderSkill, null, 'données : Kinki n\'a pas de leader skill');
  egal(monstreExemple('Windy').leaderSkill?.area, 'Dungeon', 'données : le lead de Windy est de portée Dungeon');
  egal(monstreExemple('Lulu').leaderSkill, null, 'données : Lulu n\'a pas de leader skill');

  // Les trois exemples de la règle, sur les vrais monstres.
  const cle = (...noms: string[]) => cleEquipe(noms.map(ex), connusReels);
  egal(cle('Solveig', 'Adriana', 'Odin'), cle('Solveig', 'Odin', 'Adriana'), 'Solveig-Adriana-Odin et Solveig-Odin-Adriana : même équipe (chef Solveig)');
  ok(cle('Solveig', 'Adriana', 'Odin') !== cle('Odin', 'Adriana', 'Solveig'), 'Solveig-Adriana-Odin et Odin-Adriana-Solveig : deux équipes, le lead actif diffère');
  egal(cle('Kinki', 'Windy', 'Lulu'), cle('Windy', 'Lulu', 'Kinki'), 'Kinki-Windy-Lulu et Windy-Lulu-Kinki : même équipe, aucun lead actif en siège');
  egal(cle('Solveig', 'Adriana', 'Odin'), `#${monstreExemple('Solveig').com2usId}|${[ex('Adriana'), ex('Odin')].map((x) => `#${x.com2usId}`).sort().join('+')}`, 'avec chef : « chef | les deux autres triés »');
  egal(cle('Kinki', 'Windy', 'Lulu'), `|${['Kinki', 'Windy', 'Lulu'].map((n) => `#${ex(n).com2usId}`).sort().join('+')}`, 'sans chef : « | les trois triés »');

  // Lead d'élément : ⚠️ monstres CONSTRUITS — dans les données, un lead
  // d'élément porte toujours l'élément de son monstre, qui le remplit seul.
  const elem: MonstresConnus = new Map([
    [100, { element: 'fire', leaderSkill: lead('Element', 'water') }],
    [101, { element: 'water', leaderSkill: null }],
    [102, { element: 'wind', leaderSkill: null }],
    [103, { element: 'light', leaderSkill: null }],
  ]);
  ok(cleEquipe([m(100), m(101), m(102)], elem)!.startsWith('#100|'), 'lead d\'élément Eau avec un allié Eau : chef');
  egal(cleEquipe([m(100), m(102), m(103)], elem), cleEquipe([m(102), m(100), m(103)], elem), 'lead d\'élément Eau sans allié Eau : pas de chef, l\'ordre ne compte pas');
  ok(cleEquipe([m(100), m(102), m(null, 'Inconnu')], elem)!.startsWith('#100|'), 'lead d\'élément et un allié d\'élément inconnu : chef, par prudence');

  // Monstre au lead inconnu en premier : compté pour chef, par prudence.
  ok(cleEquipe([m(null, 'Chloe'), m(2), m(3)], fictifs) !== cleEquipe([m(2), m(null, 'Chloe'), m(3)], fictifs), 'monstre saisi à la main en premier : chef (on ne regroupe pas)');
  ok(cleEquipe([m(999), m(2), m(3)], fictifs) !== cleEquipe([m(2), m(999), m(3)], fictifs), 'monstre absent des données en premier : chef');
  egal(cleEquipe([m(null), m(2), m(3)], fictifs), cleEquipe([m(2), m(3), m(null)], fictifs), 'premier emplacement vide : pas de chef');

  titre('Recommandations — vue Défense : regroupement des défenses visées');

  // Identité d'une défense.
  egal(cleEquipe([m(1), m(2), m(3)], fictifs), cleEquipe([m(1), m(3), m(2)], fictifs), 'même chef, les deux autres inversés : même défense');
  ok(cleEquipe([m(1), m(2), m(3)], fictifs) !== cleEquipe([m(7), m(2), m(3)], fictifs), 'chef différent : autre défense');
  ok(cleEquipe([m(1), m(2), m(3)], fictifs) !== cleEquipe([m(2), m(1), m(3)], fictifs), 'le chef passé en deuxième : autre défense');
  egal(cleEquipe([m(2), m(3), m(8)], fictifs), cleEquipe([m(8), m(2), m(3)], fictifs), 'sans lead actif en premier : mêmes monstres, même défense');
  egal(cleEquipe([m(null), m(null), m(null)], fictifs), null, 'défense vide : pas de clé');
  egal(cleEquipe([m(null, 'Chloe'), m(2), m(null)], fictifs), cleEquipe([m(null, ' chloe '), m(2), m(null)], fictifs), 'monstre saisi à la main : reconnu à son nom, sans casse ni espaces');

  // Regroupement.
  const vue = vueDefenses(
    reco([
      deck([def([m(1), m(2), m(3)], 'si 1 en lead'), def([m(7), m(8), m(9)])]),
      deck([]),
      deck([def([m(1), m(3), m(2)])]),
      deck([def([m(null), m(null), m(null)])]),
      deck([def([m(1), m(2), m(3)]), def([m(1), m(3), m(2)])]),
      deck([def([m(2), m(3), m(8)])]),
      deck([def([m(8), m(2), m(3)])]),
    ]),
    fictifs,
  );
  egal(
    vue.defenses.map((d) => d.cle),
    [cleEquipe([m(1), m(2), m(3)], fictifs), cleEquipe([m(7), m(8), m(9)], fictifs), cleEquipe([m(2), m(3), m(8)], fictifs)],
    'trois défenses, dans l\'ordre de première apparition',
  );
  egal(vue.defenses[0].offenses.map((o) => o.deckIndex), [0, 2, 4], 'la première est battue par les decks 1, 3 et 5');
  egal(vue.defenses[0].offenses[0].note, 'si 1 en lead', 'la précision reste celle du deck qui la porte');
  egal(vue.defenses[0].offenses[2].counterIndex, 0, 'un deck qui vise deux fois la même défense n\'y figure qu\'une fois (la première saisie)');
  egal(vue.defenses[0].monsters.map((x) => x.com2usId), [1, 2, 3], 'les monstres affichés : ceux de la première saisie');
  egal(vue.defenses[2].offenses.map((o) => o.deckIndex), [5, 6], 'sans lead actif : un autre ordre, la même défense');
  egal(vue.sansDefense, [1, 3], 'decks sans défense visée (dont une défense vide) : gardés à part');

  // Les exemples, dans la vue.
  const exemples = vueDefenses(
    reco([
      deck([def(['Kinki', 'Windy', 'Lulu'].map(ex))]),
      deck([def(['Windy', 'Lulu', 'Kinki'].map(ex))]),
      deck([def(['Solveig', 'Adriana', 'Odin'].map(ex))]),
      deck([def(['Odin', 'Adriana', 'Solveig'].map(ex))]),
    ]),
    connusReels,
  );
  egal(exemples.defenses.map((d) => d.offenses.map((o) => o.deckIndex)), [[0, 1], [2], [3]], 'Kinki-Windy-Lulu et Windy-Lulu-Kinki réunies ; Solveig et Odin en chef séparées');

  // Filtre d'une recherche.
  const filtree = vueDefenses(reco([deck([def([m(1), m(2), m(3)])]), deck([def([m(1), m(2), m(3)])]), deck([])]), fictifs, (d) => d !== 0);
  egal(filtree.defenses[0].offenses.map((o) => o.deckIndex), [1], 'recherche : seules les offenses gardées restent');
  egal(filtree.sansDefense, [2], 'recherche : un deck sans défense gardé reste à part');
  egal(vueDefenses(reco([deck([def([m(1), m(2), m(3)])])]), fictifs, () => false).defenses.length, 0, 'plus aucune offense : la défense disparaît de la vue');
}
