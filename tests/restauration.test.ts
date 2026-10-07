// « Annuler » une suppression — ce qui revient, et où (refonte graphique,
// lot 13, décision 29 ; spec/shared/design.md § Notification « Annuler »).

import { decksApresRestauration } from '../src/hooks/useSiegeRecos';
import { reinsererA } from '../src/lib/reinsererA';
import { emptyRecoDeck, type RecoDeck, type SiegeTeam } from '../src/types';
import { egal, ok, titre } from './outils';

const equipe = (id: string): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false, slots: [] } as unknown as SiegeTeam);
const deck = (note: string): RecoDeck => ({ ...emptyRecoDeck(), note });

export function testRestauration() {
  titre('« Annuler » — l\'élément revient à sa place');

  egal(reinsererA(['a', 'c'], 'b', 1), ['a', 'b', 'c'], 'au milieu : à son index d\'origine');
  egal(reinsererA(['a', 'b'], 'c', 2), ['a', 'b', 'c'], 'en fin de liste');
  egal(reinsererA(['a'], 'z', 9), ['a', 'z'], 'index au-delà de la liste (d\'autres ont été retirés depuis) : borné, au bout');
  egal(reinsererA(['b'], 'a', -3), ['a', 'b'], 'index négatif : borné, en tête');

  egal(reinsererA([equipe('1'), equipe('3')], equipe('2'), 1).map((t) => t.id), ['1', '2', '3'], 'une équipe revient entre ses voisines, pas au bout');

  const restes = decksApresRestauration([deck('A'), deck('C')], deck('B'), 1);
  egal(restes.map((d) => d.note), ['A', 'B', 'C'], 'un deck revient à sa place');
  const seul = decksApresRestauration([emptyRecoDeck()], deck('dernier'), 0);
  egal(seul.map((d) => d.note), ['dernier'], 'le DERNIER deck supprimé : il remplace le deck vide laissé à sa place, sans en ajouter un');
  const pasVide = decksApresRestauration([deck('B')], deck('A'), 0);
  ok(pasVide.length === 2, 'un seul deck restant mais NON vide : on ajoute, on ne remplace pas');
}
