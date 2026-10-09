import { isDeepStrictEqual } from 'node:util';
import type { Monster } from '../src/types';
import { appliquerCriteres, baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { leadEffectifMembreOptimizer } from '../src/lib/equipesOptimizer';
import { consommerImportOptimizer, type ImportOptimizer } from '../src/lib/importEquipes';
import { cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer, reverifierStockageOptimizer,
  OPTIMIZER_MEMBERS_STORAGE_KEY as CLE, type ContenuListeOptimizer, type EquipeOptimizer } from '../src/lib/optimizerMemberStorage';
import type { ExclusionSelector, ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { lireTravail, purgeDonneesConservees, setPersistence } from '../src/hooks/usePersistence';
import { egal, faussLocalStorage, ok, titre } from './outils';
import { monterListesOptimizer } from './optimizer-lists-harness';

const a: ExclusionSelector = { source: 'box', unitKey: 'a' };
const b: ExclusionSelector = { source: 'box', unitKey: 'b' };
const equipe: EquipeOptimizer = { id: 'e', listId: 'l1', members: [a, b],
  lead: { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } };
const monstre = { id: 1, com2usId: 101, name: 'Monstre test', element: 'fire' } as Monster;
const gear = { base: { hp: 1000, atk: 100, def: 100, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
const compte = (): ExclusionSourceData => ({ box: [a, b].map(s => ({ key: (s as { unitKey: string }).unitKey, monster: monstre, gear, stars: 6, level: 40 })),
  rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map([['1', monstre]]) });
const historique = { lists: [{ id: 'l1', name: 'Liste' }, { id: 'l2', name: 'Autre' }],
  members: [a, b].map(selector => ({ listId: 'l1', selector })), validated: [], activeListId: 'l1' };
function installer(brut: string, listes = JSON.stringify(historique)) {
  const disque = faussLocalStorage({ 'swblacksmith-persist-v1': '1', 'swblacksmith-optimizer-lists-v1': listes, [CLE]: brut });
  setPersistence(true);
  return disque;
}

export function testOptimizerContenuListeJsonEtAncienStockage() {
  titre('Contenu de liste · aller-retour JSON et stockage historique');
  const ancien = JSON.stringify({ memories: [], teams: [{ ...equipe, contenu: 'siege' }] });
  const lu = lireMembresOptimizer(ancien);
  egal(lu.teams, [equipe], 'l’équipe historique est relue, contenu retiré');
  egal(lu.rapport, [], 'aucun rejet ajouté au stockage historique valide');
  egal(lu.listContents.size, 0, 'aucun contenu inventé depuis l’équipe');
  lu.listContents = new Map([['l1', 'guilde'], ['l2', 'donjon'], ['l3', 'arene']]);
  const relu = lireMembresOptimizer(ecrireMembresOptimizer(lu));
  ok(isDeepStrictEqual(relu.listContents, lu.listContents), 'trois contenus indexés par liste conservés');
  egal(relu.teams, [equipe], 'membres et lead restent entiers');
  installer(ecrireMembresOptimizer(lu), '{');
  try { egal([...monterListesOptimizer().render().listContents], [...lu.listContents], 'listes illisibles : contenus conservés indépendamment'); }
  finally { setPersistence(false); }
}

export function testOptimizerContenuListeSansContenu() {
  titre('Contenu de liste · absence de contenu et aucun repli personnel');
  const lu = { teams: [equipe], listContents: new Map<string, ContenuListeOptimizer>() };
  const effectif = leadEffectifMembreOptimizer(lu, 'l1', a, 'fire');
  ok(effectif.type === 'aucun' && effectif.motif.includes('n’est pas défini'), 'contenu absent : motif explicite');
  const personnel = baseCompleteCriteres(undefined);
  personnel.damageSetup.leaderSkill = { stat: 'HP', pct: 33 }; personnel.damageSetup.leaderSpeedPct = 19;
  egal(appliquerCriteres(personnel, effectif).damageSetup.leaderSkill, undefined, 'aucun lead personnel moderne en repli');
  egal(appliquerCriteres(personnel, effectif).damageSetup.leaderSpeedPct, undefined, 'aucun lead personnel ancien en repli');
  egal(personnel.damageSetup.leaderSkill, { stat: 'HP', pct: 33 }, 'mémoire personnelle intacte');
  egal(leadEffectifMembreOptimizer(lu, 'l2', a, 'fire'), { type: 'personnel' }, 'hors équipe : personnel même sans contenu');
}

export const verificationsOptimizerContenuListeElements: [string, () => void][] = (['guilde', 'donjon', 'arene'] as const).map(contenu =>
  [`testOptimizerContenuListeElements${contenu}`, () => {
    titre(`Contenu de liste · éléments identique et différent en ${contenu}`);
    const teams = [equipe, { ...equipe, id: 'e2', listId: 'l2' }].map(e => ({ ...e, lead: { ...e.lead!, area: 'Element', element: 'fire' as const } }));
    const lu = { teams, listContents: new Map<string, ContenuListeOptimizer>([['l1', contenu], ['l2', 'guilde']]) };
    egal(leadEffectifMembreOptimizer(lu, 'l1', a, 'fire'), { type: 'equipe', lead: { stat: 'Attack Speed', pct: 24 } }, 'élément identique actif');
    const autre = leadEffectifMembreOptimizer(lu, 'l1', a, 'water');
    ok(autre.type === 'aucun' && autre.motif.includes('élément'), 'autre élément sans effet avec motif');
    teams.forEach(e => { e.lead = { ...e.lead!, area: 'Guild', element: 'fire' }; });
    egal(leadEffectifMembreOptimizer(lu, 'l1', a, 'fire').type, contenu === 'guilde' ? 'equipe' : 'aucun', 'contenu de la liste du membre lu');
    egal(leadEffectifMembreOptimizer(lu, 'l2', a, 'fire').type, 'equipe', 'même sélecteur dans une autre liste : son contenu propre');
    lu.listContents.set('l1', contenu === 'guilde' ? 'arene' : 'guilde');
    egal(leadEffectifMembreOptimizer(lu, 'l1', a, 'fire').type, contenu === 'guilde' ? 'aucun' : 'equipe', 'changement de contenu : effet dérivé sans changer le lead');
  }]);

export function testOptimizerContenuListeRejetsConserves() {
  titre('Contenu de liste · validation stricte et rejets conservés aux mutations');
  const rejete = { listId: 'l1', contenu: 'inconnu', futur: [1, null] };
  const opaque = { listId: ['l1'], contenu: ['guilde'] };
  const doublon = { listId: 'l2', contenu: 'arene' };
  const identities = [a, b].map(selector => [cleMemoireMembre('l1', selector), { listId: 'l1', selector, com2usId: 101 }]);
  const initial = JSON.stringify({ identities, memories: [], teams: [equipe], listContents: [rejete, opaque, { listId: 'l2', contenu: 'donjon' }, doublon] }, null, 2);
  const disque = installer(initial);
  try {
    const h = monterListesOptimizer(); let lu = h.render();
    egal([...lu.listContents], [['l2', 'donjon']], 'inconnu, tableau et doublon écartés');
    egal(lu.rapportStockage.length, 3, 'chaque contenu rejeté est annoncé');
    egal(disque.get(CLE), initial, 'brut intact au chargement');
    const avant = reverifierStockageOptimizer(lu, compte(), new Set());
    ok(avant.stockage === lu, 'revérification identique : même stockage');
    lu.replaceAfterRevalidation(avant.stockage); lu = h.render();
    egal(disque.get(CLE), initial, 'revérification identique : mêmes octets');
    lu.writeMemory({ listId: 'l1', selector: a, com2usId: 999 }, baseCompleteCriteres(undefined), compte()); lu = h.render();
    egal(disque.get(CLE), initial, 'écriture refusée : contenu rejeté et brut conservés');
    lu.writeMemory({ listId: 'l1', selector: a, com2usId: 101 }, baseCompleteCriteres(undefined), compte()); lu = h.render();
    egal(JSON.parse(disque.get(CLE)!).rejets.listContents, [rejete, opaque, doublon], 'écriture acceptée d’un membre : tous les contenus rejetés restent');
    const data = compte(); data.box = data.box.slice(0, 1);
    const r = reverifierStockageOptimizer(lu, data, new Set());
    egal(r.stockage.teams[0].members, [a, { source: 'unowned', monsterId: '1' }], 'ancienne attente de dissolution remplacée : équipe conservée par rattachement');
    ok(isDeepStrictEqual(r.stockage.listContents, lu.listContents), 'revérification modifiée : contenus inchangés');
    lu.replaceAfterRevalidation(r.stockage); lu = h.render();
    const relu = lireMembresOptimizer(disque.get(CLE)!);
    egal([...relu.listContents], [['l2', 'donjon']], 'contenu valide relu après le remplacement');
    egal(relu.rejets.listContents, [rejete, opaque, doublon], 'rejets relus à part sans perte');
    ok(!relu.listContents.has('l1'), 'contenu inconnu jamais réactivé');
    const sansValide = lireMembresOptimizer(ecrireMembresOptimizer({ ...relu, listContents: new Map() }));
    egal(sansValide.listContents.size, 0, 'doublon rejeté jamais réactivé après retrait du valide');
    const vide = reverifierStockageOptimizer(lu, { ...compte(), box: [] }, new Set());
    ok(vide.stockage === lu, 'compte vide : aucune purge de contenu');
  } finally { setPersistence(false); }
  for (const contenu of [null, ['guilde'], { nom: 'guilde' }, 1, 'siege', 'rta']) {
    const entree = { listId: 'l1', contenu };
    const lu = lireMembresOptimizer(JSON.stringify({ memories: [], teams: [], listContents: [entree] }));
    egal(lu.listContents.size, 0, 'contenu non admis sans conversion implicite');
    egal(lu.rejets.listContents, [entree], 'valeur brute conservée');
  }
  const index = { l1: 'guilde' };
  const lu = lireMembresOptimizer(JSON.stringify({ memories: [], teams: [], listContents: index }));
  egal(lireMembresOptimizer(ecrireMembresOptimizer(lu)).rejets.listContents, [index], 'index malformé conservé à la relecture');
}

export async function testOptimizerContenuListeSuppressionEtSession() {
  titre('Contenu de liste · suppression ciblée, disque et miroir de session');
  const brut = JSON.stringify({ memories: [], teams: [], listContents: [{ listId: 'l1', contenu: 'guilde' }, { listId: 'l2', contenu: 'arene' }],
    rejets: { listContents: [{ listId: 'l1', contenu: 'inconnu' }, { listId: 'l2', contenu: 'inconnu' }, { listId: ['l1'], contenu: null }] } });
  const disque = installer(brut);
  try {
    const h = monterListesOptimizer(); let lu = h.render();
    lu.removeMember('l1', a); lu = h.render();
    egal(lu.listContents.get('l1'), 'guilde', 'retirer un membre conserve le contenu de sa liste');
    egal(lu.rejets.listContents.length, 3, 'retirer un membre conserve les contenus rejetés');
    lu.deleteList('l1'); lu = h.render();
    egal([...lu.listContents], [['l2', 'arene']], 'supprimer une liste retire seulement son contenu');
    egal(lu.rejets.listContents, [{ listId: 'l2', contenu: 'inconnu' }, { listId: ['l1'], contenu: null }], 'rejets ciblés retirés, autre liste et cible opaque conservées');
    const relu = lireMembresOptimizer(disque.get(CLE)!);
    egal([...relu.listContents], [['l2', 'arene']], 'suppression persistée');
    egal(lireTravail(CLE), disque.get(CLE), 'miroir de session synchronisé');
    await purgeDonneesConservees();
    egal(disque.get(CLE), undefined, 'suppression des données : clé effacée');
    egal(lireTravail(CLE), null, 'suppression des données : miroir effacé');
  } finally { setPersistence(false); }
}

export function testOptimizerContenuListeImportPreserveEtCollisions() {
  titre('Contenu de liste · import préserve les contenus et réserve les cibles orphelines');
  const stockage = { ...historique, ...lireMembresOptimizer(JSON.stringify({ memories: [], teams: [],
    listContents: [{ listId: 'orpheline', contenu: 'donjon' }], rejets: { listContents: [{ listId: 'rejete', contenu: 'inconnu' }] } })) };
  const proposition: ImportOptimizer = { nomListe: 'Import', contenu: 'guilde', membres: [{ selector: a, com2usId: 101, libelle: 'Monstre test', criteres: {} }], equipes: [], ignores: [], messages: [] };
  for (const id of ['orpheline', 'rejete']) {
    const avant = structuredClone(stockage);
    const r = consommerImportOptimizer(stockage, 'l1', proposition, compte(), id);
    egal(r.activeListId, `${id} (2)`, 'identifiant occupé suffixé');
    egal([...r.stockage.listContents], [['orpheline', 'donjon'], [`${id} (2)`, 'guilde']], 'contenu orphelin conservé et contenu importé ajouté');
    ok(r.stockage.rejets === stockage.rejets, 'rejets intacts');
    ok(isDeepStrictEqual(stockage, avant), 'aucune mutation du stockage initial');
  }
  const invalide = consommerImportOptimizer(stockage, 'l1', { ...proposition, contenu: 'inconnu' as ContenuListeOptimizer }, compte(), 'nouvelle');
  ok(invalide.stockage === stockage && invalide.rapport.messages.some(m => m.includes('contenu')), 'contenu d’import inconnu refusé explicitement sans mutation');
  const vide = consommerImportOptimizer(stockage, 'l1', { ...proposition, membres: [] }, compte(), 'nouvelle');
  ok(vide.stockage === stockage, 'import vide : aucun contenu ajouté');
}
