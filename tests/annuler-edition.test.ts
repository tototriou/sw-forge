// « Annuler les modifications » d'une recommandation ou d'un deck en édition
// (Thomas, 2026-10-05) — la règle pure de src/lib/annulerEdition.ts.
//
// ⚠️ Une annulation qui remet le mauvais contenu, ou qui défait au passage une
// défense visée, détruit le travail de l'utilisateur en croyant le protéger.

import {
  avecContenuDeck,
  contenuDeck,
  deckEditeApresChangement,
  memeContenu,
  metaReco,
} from '../src/lib/annulerEdition';
import type { Reco, RecoDeck, RecoSlot } from '../src/types';
import { egal, ok, titre } from './outils';

const slot = (com2usId: number | null, spd?: number): RecoSlot => ({
  com2usId,
  name: com2usId ? `M${com2usId}` : '',
  stats: spd ? { spd } : {},
  setOptions: [[]],
  artifacts: { element: [], archetype: [] },
});
const deck = (note: string, ids: (number | null)[], counters: RecoDeck['counters'] = []): RecoDeck => ({
  name: '',
  note,
  slots: ids.map((id) => slot(id)),
  counters,
});
const defense = (note: string) => ({ monsters: [{ com2usId: 1, name: 'A' }, { com2usId: null, name: '' }, { com2usId: null, name: '' }], note });

export default function testAnnulerEdition() {
  titre('annuler une édition · ce qui est mémorisé');
  const d = deck('ouvrir sur le leader', [10, 20, null], [defense('si Chloe en lead')]);
  egal(Object.keys(contenuDeck(d)).sort(), ['name', 'note', 'slots'], 'un deck : consignes et monstres, PAS les défenses visées');
  const reco: Reco = { id: 'r', origin: 'mine', name: 'Défs', author: 'Thomas', note: 'viser le heal', decks: [d, deck('', [30, null, null])] };
  egal(metaReco(reco), { name: 'Défs', author: 'Thomas', note: 'viser le heal' }, 'une recommandation : nom, auteur, consignes générales');

  titre('annuler une édition · ce qui est remis');
  const avant = contenuDeck(d);
  // Pendant l'édition : un monstre changé, une VIT saisie, ET une défense visée
  // ajoutée (édition détachée, à garder).
  const modifiee: Reco = {
    ...reco,
    decks: [
      { ...d, note: 'autre', slots: [slot(10, 250), slot(99), slot(null)], counters: [defense('si Chloe en lead'), defense('nouvelle')] },
      reco.decks[1],
    ],
  };
  ok(!memeContenu(contenuDeck(modifiee.decks[0]), avant), 'le deck modifié diffère de son état d’ouverture');
  const remise = avecContenuDeck(modifiee, 0, avant);
  ok(memeContenu(contenuDeck(remise.decks[0]), avant), 'annuler remet consignes, monstres et stats');
  egal(remise.decks[0].counters.length, 2, 'la défense visée ajoutée PENDANT l’édition est gardée');
  ok(remise.decks[1] === modifiee.decks[1], 'les autres decks ne sont pas touchés');
  egal(remise.name, 'Défs', 'la recommandation elle-même n’est pas touchée');

  titre('annuler une édition · « rien n’a changé »');
  ok(memeContenu(contenuDeck({ ...d, slots: d.slots.map((s) => ({ ...s })) }), avant), 'une copie identique n’est pas une modification');

  titre('annuler une édition · le deck en édition quand le nombre de decks change');
  egal(deckEditeApresChangement(1, 3, 3), 1, 'nombre inchangé : on garde');
  egal(deckEditeApresChangement(3, 3, 4), 3, 'deck AJOUTÉ en fin de liste et ouvert : on garde');
  egal(deckEditeApresChangement(0, 3, 4), null, 'un deck remis en place ailleurs : l’édition se termine');
  egal(deckEditeApresChangement(2, 3, 2), null, 'un deck retiré décale les index : l’édition se termine');
  egal(deckEditeApresChangement(0, 3, 2), null, '… même celui d’avant');
  egal(deckEditeApresChangement(null, 3, 4), null, 'rien en édition : rien ne s’ouvre');
}
