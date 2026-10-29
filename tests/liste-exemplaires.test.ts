import { readFileSync } from 'node:fs';
import { egal, ok, titre } from './outils';
import type { GearSet, Monster } from '../src/types';
import { exemplaireSuivantEspece, libellePuceSource, type ExclusionCandidate, type ExclusionSource, type OptimizerListMember } from '../src/lib/optimizerExclusion';

const monstre: Monster = { id: 14104, com2usId: 14104, name: 'Lushen', element: 'wind', stars: 6, naturalStars: 4,
  secondAwaken: false, image: null, stats: { hp: 0, attack: 0, defense: 0, speed: 0, critRate: 0, critDamage: 0, resistance: 0, accuracy: 0 }, leaderSkill: null };
const candidat = (unitKey: string): ExclusionCandidate => ({ selector: { source: 'box', unitKey }, monster: monstre, gear: { runes: [], artifacts: [] } as unknown as GearSet });

export function testListeExemplaires() {
  titre('Liste · exemplaire suivant par espèce, Box complète et représentants');
  const a = candidat('a'), b = candidat('b');
  const candidats: Record<ExclusionSource, ExclusionCandidate[]> = { box: [a, b], rta: [], 'siege-defense': [], 'siege-offense': [] };
  const membre = (c: ExclusionCandidate, listId = 'L'): OptimizerListMember => ({ listId, selector: c.selector });
  const suivant = (membres: OptimizerListMember[], listeId: string | null = 'L') => exemplaireSuivantEspece(monstre, candidats, membres, listeId);
  egal(suivant([]).suivant, a.selector, 'exemplaire suivant : premier Box, même nu');
  egal(suivant([membre(a)]).suivant, b.selector, 'exemplaire suivant : premier absent dans l’ordre de la zone D');
  egal(suivant([membre(b)]).suivant, a.selector, 'ordre des membres sans influence');
  egal(suivant([membre(a, 'M')]).suivant, a.selector, 'autre liste sans influence');
  egal(suivant([membre(a), membre(b)], null).suivant, a.selector, 'sans liste : premier représentant');
  const rta = { ...a, selector: { source: 'rta' as const, monsterId: '14104' } };
  candidats.rta = [rta];
  egal(suivant([membre(rta)]).suivant, a.selector, 'membre RTA : Box encore ajoutable');
  egal(suivant([membre(a), membre(b)]), { suivant: null, raison: 'Les 2 Lushen de ta Box sont dans la liste' },
    'Box complète : ligne désactivée avec sa raison, aucun preset compté comme une copie Box');
  candidats.box = [];
  egal(suivant([]).suivant, rta.selector, 'sans Box : premier RTA');
  candidats.rta = [];
  const defense = { ...a, selector: { source: 'siege-defense' as const, teamId: 'd', slotIndex: 0 } };
  const offense = { ...a, selector: { source: 'siege-offense' as const, teamId: 'o', slotIndex: 0 } };
  candidats['siege-defense'] = [defense]; candidats['siege-offense'] = [offense];
  egal(suivant([]).suivant, defense.selector, 'sans Box ni RTA : Défenses avant Offenses');
  egal(suivant([membre(defense)]).suivant, offense.selector, 'sans Box : source suivante quand le premier représentant est membre');
  candidats['siege-defense'] = [];
  egal(suivant([]).suivant, offense.selector, 'sans défense : Offenses');
  candidats['siege-offense'] = [];
  const nonPossede = suivant([]).suivant!;
  egal(nonPossede, { source: 'unowned', monsterId: '14104' }, 'absent des quatre sources : non possédé');
  egal(suivant([{ listId: 'L', selector: nonPossede }]), { suivant: null, raison: 'Lushen est déjà dans la liste' }, 'non possédé ajouté une fois');
  for (const n of [0, 1, 2, 3]) egal(libellePuceSource('Box', n), n < 2 ? 'Box' : `Box · ${n}`, 'puce : compte dès deux');
  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  const chemin = ecran.slice(ecran.indexOf('function choisirExemplaire('), ecran.indexOf('const ligneMonstreTelephoneRef'));
  ok(chemin.includes('effacerResultats()') && chemin.includes('setSourceSelector(selector);'), 'transition même espèce : chemin partagé, résultats effacés');
  ok(chemin.includes('relicMainChoiceApresChangementExemplaire(c.relicMainChoice, relique, !autreEspece)'), 'transition : garde de cohérence de relique partagée');
  ok(ecran.includes('ficheDeReference = selectionAffichee?.gear'), 'Comparer reçoit la fiche affichée');
}
