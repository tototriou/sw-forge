import { avecBorne, type BornesResultats } from '../src/lib/filtresResultats';
import { bornesBienFormees } from '../src/lib/colonnesResultats';
import { egal, ok, titre } from './outils';

// Poser ou relâcher un côté d'une borne. Une mémoire peut porter une borne
// à un seul côté écrit (`{ min: 5 }`, admise par `bornesBienFormees`) :
// l'absence vaut `null`, jamais un `undefined` qui garderait une colonne
// sans borne.

export function testFiltresResultatsAvecBorne() {
  titre('Filtres des résultats — poser et relâcher une borne, côté absent compris');
  const relue = { spd: { min: 5 } } as unknown as BornesResultats;
  ok(bornesBienFormees(relue), 'une borne à un seul côté écrit est admise à la relecture');
  egal(avecBorne(relue, 'spd', 'min', null, 'eff'), {}, 'relâcher le seul côté posé retire la colonne');
  egal(avecBorne(relue, 'spd', 'max', 200, 'eff'), { spd: { min: 5, max: 200 } }, 'poser l’autre côté écrit les deux');
  egal(avecBorne({}, 'hp', 'max', 5000, 'eff'), { hp: { min: null, max: 5000 } }, 'une première borne : l’autre côté vaut null');
  egal(avecBorne({ hp: { min: 100, max: 5000 } }, 'hp', 'max', null, 'eff'), { hp: { min: 100, max: null } }, 'relâcher un côté garde l’autre');
  const avant: BornesResultats = { atk: { min: 1000, max: null } };
  avecBorne(avant, 'atk', 'min', null, 'eff');
  egal(avant, { atk: { min: 1000, max: null } }, 'les bornes reçues ne sont pas modifiées');
}
