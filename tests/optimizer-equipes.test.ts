import { egal, ok, titre } from './outils';
import type { LeaderSkill } from '../src/types';
import { appliquerCriteres, baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { LEADER_SKILL_STATS, LEADER_SKILL_VALEURS, resolvedLeaderSkill } from '../src/lib/damage';
import {
  creerEquipeOptimizer, ajouterMembreEquipeOptimizer, retirerMembreEquipeOptimizer,
  delierMembreOptimizer, dissoudreEquipeOptimizer, equipeApresFiltrageOptimizer,
  leadEffectifMembreOptimizer, type ContexteEquipesOptimizer,
} from '../src/lib/equipesOptimizer';
import type { ExclusionSelector } from '../src/lib/optimizerExclusion';
import type { ContenuListeOptimizer, EquipeOptimizer } from '../src/lib/optimizerMemberStorage';

const membres: ExclusionSelector[] = Array.from({ length: 6 }, (_, i) => ({ source: 'box', unitKey: String(i) }));
const lead: LeaderSkill = { stat: 'Attack Speed', amount: 24, area: 'General', element: null };
const equipe = (skill: LeaderSkill | null = lead): EquipeOptimizer =>
  ({ id: 'e1', listId: 'l1', members: membres.slice(0, 2), lead: skill && { ...skill } });
const stockageLead = (teams: EquipeOptimizer[], contenu: ContenuListeOptimizer = 'guilde') =>
  ({ teams, listContents: new Map<string, ContenuListeOptimizer>([['l1', contenu]]) });
const contexte = (teams: EquipeOptimizer[] = []): ContexteEquipesOptimizer => ({
  lists: [{ id: 'l1', name: 'Liste' }, { id: 'l2', name: 'Autre liste' }],
  members: ['l1', 'l2'].flatMap(listId => membres.map(selector => ({ listId, selector }))), teams,
});

// Attendus indépendants de la table de production.
const casesActivite: [string, ContenuListeOptimizer, string, 'oui' | 'non'][] = [
  ['GuildeGeneral', 'guilde', 'General', 'oui'],
  ['GuildeElement', 'guilde', 'Element', 'oui'],
  ['GuildeArena', 'guilde', 'Arena', 'non'],
  ['GuildeGuild', 'guilde', 'Guild', 'oui'],
  ['GuildeDungeon', 'guilde', 'Dungeon', 'non'],
  ['AreneGeneral', 'arene', 'General', 'oui'],
  ['AreneElement', 'arene', 'Element', 'oui'],
  ['AreneArena', 'arene', 'Arena', 'oui'],
  ['AreneGuild', 'arene', 'Guild', 'non'],
  ['AreneDungeon', 'arene', 'Dungeon', 'non'],
  ['DonjonGeneral', 'donjon', 'General', 'oui'],
  ['DonjonElement', 'donjon', 'Element', 'oui'],
  ['DonjonArena', 'donjon', 'Arena', 'non'],
  ['DonjonGuild', 'donjon', 'Guild', 'non'],
  ['DonjonDungeon', 'donjon', 'Dungeon', 'oui'],
];
export const verificationsOptimizerEquipesActivite: [string, () => void][] = casesActivite.map(([nom, contenu, area, attendu]) =>
  [`testOptimizerEquipesActivite${nom}`, () => {
    titre(`Optimizer · activité ${contenu}/${area}`);
    const e = equipe({ ...lead, area, element: area === 'Element' ? 'fire' : null });
    // Les six statistiques suivent la portée ; le modèle sourcé reste distinct d’un relevé en jeu.
    for (const stat of LEADER_SKILL_STATS) {
      e.lead!.stat = stat;
      const effectif = leadEffectifMembreOptimizer(stockageLead([e], contenu), 'l1', { ...membres[0] }, 'fire');
      if (attendu === 'oui') egal(effectif, { type: 'equipe', lead: { stat, pct: 24 } }, `${stat} : lead actif`);
      else {
        egal(effectif.type, 'aucun', `${stat} : aucun lead`);
        ok(effectif.type === 'aucun' && effectif.motif.includes('inactive'), `${stat} : motif explicite`);
      }
    }
  }]);

export function testOptimizerEquipesElementsEtLeadPersonnel() {
  titre('Optimizer · élément du membre et restitution du lead personnel');
  const e = equipe({ ...lead, area: 'Element', element: 'fire' });
  const personnel = baseCompleteCriteres(undefined);
  personnel.damageSetup.leaderSkill = { stat: 'HP', pct: 33 };
  personnel.damageSetup.leaderSpeedPct = 19;
  const initial = structuredClone(personnel);
  const meme = leadEffectifMembreOptimizer(stockageLead([e]), 'l1', membres[0], 'fire');
  egal(resolvedLeaderSkill(appliquerCriteres(personnel, meme).damageSetup), { stat: 'Attack Speed', pct: 24 }, 'même élément : superposition du lead');
  const autre = leadEffectifMembreOptimizer(stockageLead([e]), 'l1', membres[0], 'water');
  ok(autre.type === 'aucun' && autre.motif.includes('élément'), 'élément différent : aucun avec motif');
  egal(resolvedLeaderSkill(appliquerCriteres(personnel, autre).damageSetup), null, 'aucun repli sur le moderne ou le legacy personnel');
  egal(leadEffectifMembreOptimizer(stockageLead([e]), 'l2', membres[0], 'fire'), { type: 'personnel' }, 'autre liste : lead personnel');
  egal(leadEffectifMembreOptimizer(stockageLead([e]), 'l1', membres[3], 'fire'), { type: 'personnel' }, 'membre hors équipe : personnel');
  const delie = delierMembreOptimizer([e], 'l1', membres[0]);
  egal(resolvedLeaderSkill(appliquerCriteres(personnel, leadEffectifMembreOptimizer(stockageLead(delie.teams), 'l1', membres[0], 'fire')).damageSetup), { stat: 'HP', pct: 33 }, 'délier rend le lead personnel');
  egal(personnel, initial, 'les critères personnels ne sont jamais modifiés');
}

export function testOptimizerEquipesLeadsNonCalculablesEtHorsListe() {
  titre('Optimizer · leads conservés sans calcul et valeur hors liste');
  for (const stat of ['Accuracy', 'Resistance', 'Inconnue', null]) {
    const e = equipe({ ...lead, stat });
    const effectif = leadEffectifMembreOptimizer(stockageLead([e]), 'l1', membres[0], 'fire');
    ok(effectif.type === 'aucun' && effectif.motif.includes('sans effet calculé'), `${stat} : aucun avec motif`);
    const cree = creerEquipeOptimizer(contexte(), e);
    egal(cree.teams[0].lead, e.lead, `${stat} : donnée entière conservée`);
  }
  const e = equipe({ ...lead, amount: 27 });
  ok(!LEADER_SKILL_VALEURS['Attack Speed'].includes(27), 'fixture : valeur hors liste');
  egal(leadEffectifMembreOptimizer(stockageLead([e]), 'l1', membres[0], 'fire'), { type: 'equipe', lead: { stat: 'Attack Speed', pct: 27 } }, 'hors liste : aucun remplacement ni rejet');
  for (const amount of [NaN, Infinity, -1]) {
    e.lead!.amount = amount;
    const resultat = leadEffectifMembreOptimizer(stockageLead([e]), 'l1', membres[0], 'fire');
    ok(resultat.type === 'aucun' && resultat.motif.includes('montant'), 'montant invalide : aucun avec motif');
  }
  for (const area of ['Inconnue', 'toString']) {
    e.lead = { ...lead, area };
    const resultat = leadEffectifMembreOptimizer(stockageLead([e]), 'l1', membres[0], 'fire');
    ok(resultat.type === 'aucun' && resultat.motif.includes('pas établie'), `${area} : portée inconnue sans effet`);
  }
  ok(leadEffectifMembreOptimizer(stockageLead([equipe(null)]), 'l1', membres[0], 'fire').type === 'aucun', 'équipe sans lead : aucun');
}

export const verificationsOptimizerEquipesCardinalites: [string, () => void][] = [0, 1, 2, 5, 6].map(nombre =>
  [`testOptimizerEquipesCardinalite${nombre}`, () => {
    titre(`Optimizer · cardinalité après filtrage ${nombre}`);
    const c = contexte();
    const resultat = equipeApresFiltrageOptimizer(c, { id: 'e1', listId: 'l1', members: membres.slice(0, nombre), lead });
    egal(resultat.equipe !== null, nombre >= 2 && nombre <= 5, 'équipe créée seulement de 2 à 5 membres');
    if (resultat.equipe) {
      egal(resultat.equipe.members.length, nombre, 'tous les membres sont liés');
      ok(!('contenu' in resultat.equipe), 'le contenu appartient à la liste');
      egal(resultat.equipe.lead, lead, 'portée du lead conservée');
      egal(resultat.rapport, [], 'aucun refus');
    } else {
      ok(resultat.rapport.some(m => m.includes('lead de la source n’est appliqué à personne')), 'absence d’équipe et de lead explicitement rapportée');
      const direct = creerEquipeOptimizer(c, { id: 'e1', listId: 'l1', members: membres.slice(0, nombre), lead });
      egal(direct.teams, [], 'création manuelle hors cardinalité refusée');
      ok(direct.rapport.length > 0, 'refus de cardinalité explicite');
      for (const membre of membres.slice(0, nombre)) egal(leadEffectifMembreOptimizer(stockageLead([]), 'l1', membre, 'fire'), { type: 'personnel' }, 'sans équipe : aucun lead de source superposé');
    }
    egal(c.teams, [], 'le producteur ne modifie pas les équipes reçues');
  }]);

export function testOptimizerEquipesOperationsEtExclusivite() {
  titre('Optimizer · opérations pures, cardinalités et appartenance');
  const c = contexte();
  const cree = creerEquipeOptimizer(c, { id: 'e1', listId: 'l1', members: membres.slice(0, 2) });
  egal(cree.rapport, [], 'création sans leader');
  egal(cree.teams[0].lead, null, 'lead facultatif');
  const complet = creerEquipeOptimizer(c, { ...equipe(), members: membres.slice(0, 5), leader: membres[0] });
  egal(complet.rapport, [], 'cinq membres et leader valides');
  const initial = structuredClone(complet.teams);
  const ajout = ajouterMembreEquipeOptimizer({ ...c, teams: cree.teams }, 'e1', membres[2]);
  egal(ajout.teams[0].members.length, 3, 'ajout du troisième membre');
  const six = ajouterMembreEquipeOptimizer({ ...c, teams: complet.teams }, 'e1', membres[5]);
  egal(six.teams, initial, 'sixième membre refusé sans perte'); ok(six.rapport.length > 0, 'sixième membre : rapport');
  const lie = { ...c, teams: cree.teams };
  for (const creation of [
    { ...equipe(), id: 'e2' },
    { ...equipe(), members: [membres[2], membres[2]], id: 'e2' },
    { ...equipe(), members: [membres[2], membres[3]] },
    { ...equipe(), members: [membres[2], membres[3]], id: 'e2', leader: membres[5] },
    { ...equipe(), members: [membres[2], { source: 'box' as const, unitKey: 'absent' }], id: 'e2' },
    { ...equipe(), listId: 'absente', id: 'e2' },
  ]) {
    const refus = creerEquipeOptimizer(lie, creation);
    egal(refus.teams, cree.teams, 'création invalide : équipes initiales conservées'); ok(refus.rapport.length > 0, 'refus dit');
  }
  ok(ajouterMembreEquipeOptimizer(lie, 'e1', membres[0]).rapport.length > 0, 'ajout du même membre refusé');
  ok(ajouterMembreEquipeOptimizer({ ...c, teams: [equipe(), { ...equipe(), id: 'e2', members: membres.slice(2, 4) }] }, 'e1', membres[2]).rapport.length > 0, 'ajout depuis une autre équipe refusé');
  const autreListe = creerEquipeOptimizer(lie, { ...equipe(), id: 'e2', listId: 'l2' });
  egal(autreListe.teams.length, 2, 'même sélecteur dans deux listes : indépendant');
  const retire = retirerMembreEquipeOptimizer(complet.teams, 'e1', { ...membres[0] });
  egal(retire.teams[0].members.length, 4, 'retrait d’un membre');
  egal(retire.teams[0].leader, undefined, 'leader retiré sans remplacement');
  egal(complet.teams, initial, 'retrait et ajout ne mutent pas les entrées');
  egal(dissoudreEquipeOptimizer(complet.teams, 'e1').teams, [], 'dissolution');
  egal(c.members.length, 12, 'membres des listes intacts après dissolution');
  const inconnue = ajouterMembreEquipeOptimizer(lie, 'absente', membres[2]);
  egal(inconnue.teams, cree.teams, 'équipe absente : aucun ajout');
  ok(inconnue.rapport.length > 0, 'équipe absente : dit');
  ok(delierMembreOptimizer(cree.teams, 'l1', membres[5]).rapport.length > 0, 'délier un membre absent : dit');
  ok(dissoudreEquipeOptimizer(cree.teams, 'absente').rapport.length > 0, 'dissoudre une équipe absente : dit');
  const source = { ...equipe(), leader: membres[0] };
  const copie = creerEquipeOptimizer(c, source);
  const avant = structuredClone(source);
  if (copie.teams[0].members[0].source === 'box') copie.teams[0].members[0].unitKey = 'modifie';
  copie.teams[0].lead!.amount = 99;
  egal(source, avant, 'création détachée : sélecteurs, leader et lead sources intacts');
  egal(membres[0], { source: 'box', unitKey: '0' }, 'sélecteurs sources intacts');
}

export function testOptimizerEquipesRetraitEquipeDeDeux() {
  titre('Optimizer · retrait d’une équipe de deux et dissolution ciblée');
  const teams = [equipe(), { ...equipe(), id: 'e2', listId: 'l2' }];
  const initial = structuredClone(teams);
  const retire = retirerMembreEquipeOptimizer(teams, 'e1', membres[0]);
  egal(retire.teams, [teams[1]], 'équipe de deux dissoute ; autre liste préservée');
  ok(retire.rapport.some(m => m.includes('moins de deux')), 'dissolution explicitement rapportée');
  egal(delierMembreOptimizer(teams, 'l1', membres[0]), retire, 'délier utilise la même règle');
  egal(teams, initial, 'équipes initiales intactes');
}

export function testOptimizerEquipesCreationAvecOrphelines() {
  titre('Optimizer · création isolée et conflits contre les équipes orphelines');
  const ancienne = { ...equipe(), id: 'orpheline', listId: 'absente' };
  const c = contexte([ancienne]);
  const creation = { ...equipe(), id: 'nouvelle' };
  const r = creerEquipeOptimizer(c, creation);
  egal(r.rapport, [], 'liste ancienne absente sans blocage de la création');
  egal(r.teams.length, 2, 'nouvelle équipe ajoutée');
  ok(r.teams[0] === ancienne, 'équipe ancienne conservée par référence');
  const collisionId = creerEquipeOptimizer(c, { ...creation, id: ancienne.id });
  ok(collisionId.teams === c.teams && collisionId.rapport.length > 0, 'identifiant réservé même par une équipe orpheline');
  const membreAbsent = { ...ancienne, listId: 'l1', members: [membres[0], { source: 'box' as const, unitKey: 'absent' }] };
  const conflit = creerEquipeOptimizer(contexte([membreAbsent]), creation);
  ok(conflit.rapport.some(m => m.includes('déjà affecté')), 'membre existant réservé malgré un coéquipier absent');
  const independante = creerEquipeOptimizer(contexte([membreAbsent]), { ...creation, members: membres.slice(2, 4) });
  egal(independante.rapport, [], 'membre ancien absent sans blocage d’une équipe indépendante');
  ok(independante.teams[0] === membreAbsent, 'équipe avec membre absent conservée telle quelle');
}
