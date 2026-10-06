// L'exemplaire de l'Optimizer au retour sur l'écran (`exemplaireAuMontage`,
// OptimizerSection.tsx) : l'exemplaire mémorisé dans `useOptimizerState` est
// gardé tant qu'il se résout contre le compte et désigne l'espèce choisie ;
// sinon la règle du choix d'une espèce le remplace. Voir
// spec/outils/optimizer.md § Équipement actuel.

import { egal, titre } from './outils';
import type { GearSet, Monster, SiegeTeam } from '../src/types';
import type { BoxItem } from '../src/lib/applyAccount';
import type { ExclusionSelector, ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { exemplaireAuMontage } from '../src/components/outils/OptimizerSection';

const monstre = (id: number, name: string): Monster => ({
  id,
  com2usId: id,
  name,
  element: 'wind',
  stars: 6,
  naturalStars: 4,
  secondAwaken: false,
  image: null,
  stats: { hp: 0, attack: 0, defense: 0, speed: 0, critRate: 0, critDamage: 0, resistance: 0, accuracy: 0 },
  leaderSkill: null,
});
const LUSHEN = monstre(14104, 'Lushen');
const CASSIE = monstre(19315, 'Cassie');
const NU = { runes: [], artifacts: [] } as unknown as GearSet;

const boite = (key: string, m: Monster): BoxItem => ({ key, monster: m, stars: 6, level: 40, gear: NU });
const equipe = (id: string, m: Monster): SiegeTeam => ({
  id,
  slots: [{ monsterId: String(m.id), runeSpeed: null, tick: 0, gear: NU }],
  lead: 0,
  tickAlertDismissed: false,
});

function donnees(box: BoxItem[], defenses: SiegeTeam[]): ExclusionSourceData {
  return {
    box,
    rtaEntries: {},
    siegeDefenseTeams: defenses,
    siegeOffenseTeams: [],
    monsterById: new Map([LUSHEN, CASSIE].map((m) => [String(m.id), m])),
  };
}

const auMontage = (memorise: ExclusionSelector | null, box: BoxItem[], defenses: SiegeTeam[] = []) =>
  exemplaireAuMontage(LUSHEN, memorise, box, donnees(box, defenses));

export function testOptimizerExemplaireMontage() {
  titre('Optimizer · l’exemplaire au retour sur l’écran');
  const deuxLushen = [boite('u1', LUSHEN), boite('u2', LUSHEN)];
  const premierBox: ExclusionSelector = { source: 'box', unitKey: 'u1' };

  egal(auMontage({ source: 'box', unitKey: 'u2' }, deuxLushen), undefined, 'le second exemplaire Box, toujours là : gardé');
  egal(auMontage({ source: 'siege-defense', teamId: 't1', slotIndex: 0 }, deuxLushen, [equipe('t1', LUSHEN)]), undefined, 'un exemplaire en défense de siège, toujours là : gardé');
  egal(auMontage({ source: 'unowned', monsterId: '14104' }, []), undefined, 'non possédé : gardé (se résout par le bestiaire)');

  egal(auMontage({ source: 'box', unitKey: 'u9' }, deuxLushen), premierBox, 'exemplaire Box disparu (réimport) : le premier de la box');
  egal(auMontage({ source: 'siege-defense', teamId: 't1', slotIndex: 0 }, deuxLushen), premierBox, 'équipe de siège supprimée : le premier de la box');
  egal(auMontage({ source: 'box', unitKey: 'c1' }, [...deuxLushen, boite('c1', CASSIE)]), premierBox, 'exemplaire d’une autre espèce : le premier de la box');
  egal(auMontage(null, deuxLushen), premierBox, 'aucun exemplaire mémorisé : le premier de la box');

  egal(auMontage({ source: 'box', unitKey: 'u9' }, [], [equipe('t1', LUSHEN)]), null, 'possédé ailleurs qu’en Box seulement : rien d’imposé, à choisir par une puce');
  egal(auMontage({ source: 'box', unitKey: 'u9' }, []), { source: 'unowned', monsterId: '14104' }, 'possédé nulle part : non possédé');
}
