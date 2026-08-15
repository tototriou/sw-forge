// Paliers de rechargement d'une compétence.
//
// Le `cooldown` de SWARFARM est celui du niveau 1, pas d'une compétence maxée —
// or c'est maxée qu'on la joue. Afficher le champ brut donnait « 6 tours » pour
// une compétence qui descend à 4. La règle qui reconstitue les paliers repose
// sur un libellé d'API (`Cooltime Turn -1`) : ces vérifications le figent, car
// il suffirait qu'il change de forme pour que la réduction disparaisse en
// silence, sans rien casser d'autre.

import { Competence, paliersRechargement } from '../src/lib/monsterSkills';
import { egal, titre } from './outils';

function comp(p: Partial<Competence>): Competence {
  return {
    id: 1,
    com2usId: null,
    nom: 'Test',
    description: null,
    slot: 1,
    passif: false,
    aoe: false,
    cooldown: null,
    coups: null,
    niveauMax: null,
    formule: null,
    scale: [],
    ameliorations: [],
    effets: [],
    icone: null,
    ...p,
  } as Competence;
}

export default function testRechargement() {
  titre('Paliers de rechargement');

  egal(
    paliersRechargement(comp({ cooldown: null, ameliorations: ['Damage +20%'] })),
    [],
    'sans rechargement, aucun palier'
  );

  egal(
    paliersRechargement(comp({ cooldown: 3, ameliorations: ['Damage +20%'] })),
    [3],
    'rien ne réduit → un seul palier'
  );

  // Le cas réel qui a motivé la règle : Protection Field, cd 6 → 4.
  egal(
    paliersRechargement(
      comp({ cooldown: 6, ameliorations: ['Cooltime Turn -1', 'Cooltime Turn -1'] })
    ),
    [6, 5, 4],
    'deux réductions donnent la chaîne complète'
  );

  // ⚠️ 12 lignes du corpus traînent un `\r` : sans `trim()`, la réduction
  // passait à la trappe et le rechargement affiché restait celui du niveau 1.
  egal(
    paliersRechargement(comp({ cooldown: 4, ameliorations: ['Cooltime Turn -1\r'] })),
    [4, 3],
    'un retour chariot résiduel ne fait pas manquer la réduction'
  );

  // ⚠️ « Harmful Effect Rate +1 Turns » parle de TOURS sans toucher au
  // rechargement : une recherche trop lâche l'aurait comptée.
  egal(
    paliersRechargement(
      comp({ cooldown: 4, ameliorations: ['Harmful Effect Rate +1 Turns', 'Damage +10%'] })
    ),
    [4],
    'une amélioration qui parle de tours sans réduire ne compte pas'
  );

  // Garde-fou : un rechargement ne descend pas à 0, sinon la compétence serait
  // disponible en permanence.
  egal(
    paliersRechargement(
      comp({
        cooldown: 2,
        ameliorations: ['Cooltime Turn -1', 'Cooltime Turn -1', 'Cooltime Turn -1'],
      })
    ),
    [2, 1],
    'le rechargement s’arrête à 1 tour'
  );
}
