import { isDeepStrictEqual } from 'node:util';
import { baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { lireTravail, purgeDonneesConservees, setPersistence } from '../src/hooks/usePersistence';
import { OPTIMIZER_MEMBERS_STORAGE_KEY as CLE, ecrireMembresOptimizer, lireMembresOptimizer, lireMemoireMembre, reverifierStockageOptimizer } from '../src/lib/optimizerMemberStorage';
import type { ExclusionSelector, ExclusionSourceData } from '../src/lib/optimizerExclusion';
import type { Monster } from '../src/types';
import { egal, faussLocalStorage, ok, titre } from './outils';
import { monterListesOptimizer } from './optimizer-lists-harness';

const box: ExclusionSelector = { source: 'box', unitKey: '11' };
const autre: ExclusionSelector = { source: 'box', unitKey: '99' };
const siege: ExclusionSelector = { source: 'siege-defense', teamId: 'e1', slotIndex: 0 };
const monstre = { id: 1, com2usId: 10001, name: 'Monstre test', element: 'wind', leaderSkill: null } as Monster;
const gear = { base: { hp: 1000, atk: 100, def: 100, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
function compte(): ExclusionSourceData {
  return { box: [{ key: '11', monster: monstre, stars: 6, level: 40, gear }, { key: '99', monster: monstre, stars: 6, level: 40, gear }],
    rtaEntries: {}, siegeDefenseTeams: [{ id: 'e1', slots: [{ monsterId: '1', gear }, { monsterId: null }, { monsterId: null }] }] as ExclusionSourceData['siegeDefenseTeams'],
    siegeOffenseTeams: [], monsterById: new Map([['1', monstre]]) };
}

export async function testMemoireOptimizerRejetsConserves() {
  titre('Stockage des membres · rejets conservés après les mutations et supprimés seulement par cible');
  const memoire = ['l1|box:99', { listId: 'l1', selector: autre, com2usId: '10001', criteres: { personnel: ['brut'] } }];
  const equipe = { id: 'invalide', listId: 'l1', members: [autre], lead: null, contenu: 'siege', inconnu: { texte: ['Guild'] } };
  const sansListe = ['opaque', { listId: ['l1'], donnees: [null, false, { futur: 3 }] }];
  const equipeOpaque = ['l1', null];
  const valide = { id: 'valide', listId: 'l1', members: [box, siege], lead: null, contenu: 'siege' };
  const initial = JSON.stringify({ memories: [memoire, sansListe, ['l2|box:99', { ...memoire[1] as object, listId: 'l2' }]],
    teams: [valide, equipe, equipeOpaque, { ...equipe, id: 'invalide2', listId: 'l2' }] });
  const historique = JSON.stringify({ lists: [{ id: 'l1', name: 'L1' }, { id: 'l2', name: 'L2' }],
    members: [box, autre, siege].map(selector => ({ listId: 'l1', selector })), validated: [], activeListId: 'l1' });
  const disque = faussLocalStorage({ 'swblacksmith-persist-v1': '1', 'swblacksmith-optimizer-lists-v1': historique, [CLE]: initial });
  setPersistence(true);
  let h = monterListesOptimizer(); let lu = h.render();
  egal(lu.memories.size, 0, 'aucune mémoire malformée utilisable au chargement');
  egal(lu.teams.length, 1, 'seule l’équipe valide est utilisable');
  egal(lu.rapportStockage.length, 6, 'toutes les entrées rejetées sont signalées');
  const conserves = (etape: string) => {
    const brut = JSON.parse(disque.get(CLE)!);
    // Chercher les valeurs brutes indépendamment de leur emplacement dans le JSON.
    const valeurs = (v: unknown): unknown[] => v !== null && typeof v === 'object'
      ? [v, ...Object.values(v).flatMap(valeurs)] : [v];
    const contient = (v: unknown) => valeurs(brut).some(x => isDeepStrictEqual(x, v));
    ok(contient(memoire), `${etape} : mémoire rejetée intacte`);
    ok(contient(equipe), `${etape} : équipe rejetée intacte`);
    ok(contient(sansListe) && contient(equipeOpaque), `${etape} : rejets sans listId lisible intacts`);
    ok(lireTravail(CLE) === disque.get(CLE), `${etape} : même contenu dans le miroir`);
  };
  try {
    lu.deleteList('l2'); lu = h.render(); conserves('suppression de L2');
    ok(!disque.get(CLE)!.includes('invalide2') && !disque.get(CLE)!.includes('l2|box:99'), 'les rejets de la liste supprimée sont retirés');
    lu.writeMemory({ listId: 'l1', selector: box, com2usId: 10001 }, baseCompleteCriteres(undefined), compte());
    lu = h.render(); conserves('écriture d’une autre mémoire');
    lu.setTeams([valide as typeof lu.teams[number]]); lu = h.render(); conserves('setTeams');
    lu.removeMember('l1', box); lu = h.render(); conserves('retrait d’un autre membre');
    const data = compte(); data.siegeDefenseTeams = [];
    lu.replaceAfterRevalidation(reverifierStockageOptimizer(lu, data, new Set([1])).stockage);
    lu = h.render(); conserves('réimport avec changement');
    h = monterListesOptimizer(); lu = h.render();
    egal(lu.memories.size, 0, 'aucune mémoire rejetée réactivée au rechargement');
    egal(lu.teams.length, 0, 'aucune équipe rejetée réactivée au rechargement');
    egal(lireMemoireMembre(lu.memories, 'l1', autre, compte()), null, 'la mémoire rejetée ne s’applique jamais');
    lu.deleteList('l1'); lu = h.render();
    const apres = disque.get(CLE)!;
    ok(!apres.includes('invalide') && !apres.includes('l1|box:99'), 'supprimer L1 retire ses rejets identifiables');
    ok(apres.includes('opaque') && apres.includes('futur'), 'supprimer L1 conserve les rejets sans listId lisible');
    await purgeDonneesConservees();
    egal(disque.get(CLE), undefined, 'supprimer les données efface aussi les rejets sur disque');
    egal(lireTravail(CLE), null, 'supprimer les données efface aussi les rejets du miroir');

    for (const geste of ['écrire', 'retirer']) {
      const cible = faussLocalStorage({ 'swblacksmith-persist-v1': '1', 'swblacksmith-optimizer-lists-v1': historique,
        [CLE]: JSON.stringify({ memories: [memoire, sansListe], teams: [equipe] }) });
      h = monterListesOptimizer(); lu = h.render();
      if (geste === 'écrire') {
        lu.writeMemory({ listId: 'l1', selector: autre, com2usId: 20002 }, baseCompleteCriteres(undefined), compte());
        lu = h.render();
        ok(cible.get(CLE)!.includes('personnel'), 'écriture refusée : rejet de la cible conservé');
        lu.writeMemory({ listId: 'l1', selector: autre, com2usId: 10001 }, baseCompleteCriteres(undefined), compte());
      } else lu.removeMember('l1', autre);
      lu = h.render();
      ok(!cible.get(CLE)!.includes('personnel'), `${geste} le membre visé : sa mémoire rejetée est retirée`);
      ok(cible.get(CLE)!.includes('invalide') && cible.get(CLE)!.includes('opaque'), `${geste} le membre visé : les autres rejets restent intacts`);
    }
    const paire = ['l1|box:11', { listId: 'l1', selector: box, com2usId: 10001, criteres: baseCompleteCriteres(undefined) }];
    const doublons = lireMembresOptimizer(JSON.stringify({ memories: [paire, paire], teams: [valide, valide] }));
    const sansValides = ecrireMembresOptimizer({ ...doublons, memories: new Map(), teams: [] });
    const apresDoublons = lireMembresOptimizer(sansValides);
    egal(apresDoublons.memories.size, 0, 'une mémoire rejetée comme doublon ne se réactive pas quand la valide disparaît');
    egal(apresDoublons.teams.length, 0, 'une équipe rejetée comme doublon ne se réactive pas quand la valide disparaît');
    ok(sansValides.includes('l1|box:11') && sansValides.includes('valide'), 'les valeurs brutes des doublons restent enregistrées');
  } finally { setPersistence(false); }
}

export function testMemoireOptimizerTextesCriteresStricts() {
  titre('Mémoires · tableaux refusés pour les critères textuels au chargement');
  const base = baseCompleteCriteres(undefined);
  for (const champ of ['sortBy', 'critereArtefacts'] as const) {
    const paire = ['l1|box:11', { listId: 'l1', selector: box, com2usId: 10001, criteres: { ...base, [champ]: [base[champ]] } }];
    const lu = lireMembresOptimizer(JSON.stringify({ memories: [paire], teams: [] }));
    egal(lu.memories.size, 0, `${champ} : mémoire écartée`);
    egal(lu.rapport, ['Mémoire 1 malformée ou dupliquée : ignorée.'], `${champ} : rejet signalé`);
    ok(lireMemoireMembre(lu.memories, 'l1', box, compte()) === null, `${champ} : aucune application`);
    ok(isDeepStrictEqual(lu.rejets.memories, [paire]), `${champ} : valeur JSON brute conservée parmi les rejets`);
  }
}
