import { readFileSync } from 'node:fs';
import type { ArtifactDetail } from '../src/types';
import { paireRespecteLignes } from '../src/lib/artifactOptim';
import { retrouverDeckCompositionOptimizer } from '../src/lib/deckCompositionOptimizer';
import { consommerImportOptimizer } from '../src/lib/importEquipes';
import { importerRecoOptimizer } from '../src/lib/importRecoOptimizer';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { collectOwnedBuilds, collectOwnedTeams, countCopiesByCom2us } from '../src/lib/ownedBuilds';
import { contexteConfrontationReco, matchDeck, matchReco } from '../src/lib/recoMatch';
import { deckComposition, gearComposition, recommandationComposition, sourcesComposition, stockageComposition } from './import-composition-fixtures';
import { egal, ok, titre } from './outils';

function contexteEcran(data: ExclusionSourceData) {
  const args = { box: data.box, rta: Object.values(data.rtaEntries), defense: data.siegeDefenseTeams,
    offense: data.siegeOffenseTeams, monsterById: data.monsterById };
  return contexteConfrontationReco(collectOwnedBuilds(args), collectOwnedTeams(args), countCopiesByCom2us(data.box));
}
const consommer = (data: ExclusionSourceData, ids = [1, 1, 2]) => {
  const p = importerRecoOptimizer(recommandationComposition(ids), data);
  return { p, ...consommerImportOptimizer(stockageComposition(), null, p, data, 'nouvelle') };
};

export function testImportRecoSorteUniqueSignalee() {
  titre('Import recommandation · sorte unique perdue, présence sur l’autre pièce signalée');
  for (const demande of ['element', 'archetype'] as const) {
    const data = sourcesComposition(), deck = recommandationComposition();
    deck.slots[0].artifacts[demande] = [206];
    const art: ArtifactDetail = { id: 1, kind: demande === 'element' ? 'archetype' : 'element', element: 'fire', archetype: 'attack',
      rarity: 5, level: 15, main: { code: 101, value: 100 }, subs: [{ code: 206, value: 1 }] };
    data.siegeOffenseTeams[0].slots[1].gear!.artifacts = [art];
    const p = importerRecoOptimizer(deck, data), r = consommerImportOptimizer(stockageComposition(), null, p, data, 'nouvelle');
    const match = matchDeck(deck, contexteEcran(data));
    egal(match.status, 'ko', 'la recommandation refuse la propriété sur l’autre sorte');
    ok(paireRespecteLignes([art], [...r.stockage.memories.values()][0].criteres.lignesVerrouillees), 'le verrou importé l’accepte sur cette pièce');
    egal(r.rapport.messages.filter(m => m.includes('l’une ou l’autre pièce')).length, 1, 'perte de la sorte dite pour chaque demande unique');
    ok(r.rapport.messages.some(m => m.includes(demande === 'element' ? 'artéfact d’attribut' : 'artéfact de type')), 'sorte demandée nommée au rapport');
  }
  const deck = recommandationComposition(); deck.slots[0].artifacts.element = [300];
  const p = importerRecoOptimizer(deck, sourcesComposition());
  ok(p.messages.some(m => m.includes('seule la pièce d’attribut')), 'propriété propre à l’attribut : compatibilité du jeu conservée');
  ok(!p.messages.some(m => m.includes('l’une ou l’autre pièce')), 'aucune compatibilité fictive pour une propriété propre');
}
export function testImportRecoCopiesAvecOffenseRetenue() {
  titre('Import recommandation · copies distinctes du deck et repli d’une occurrence sans slot');
  const data = sourcesComposition();
  data.siegeOffenseTeams = [deckComposition('copies', [1, 1, 2])];
  data.siegeOffenseTeams[0].slots[1].gear = gearComposition(200);
  const match = matchDeck(recommandationComposition([1, 1, 2]), contexteEcran(data));
  const r = consommer(data);
  egal(r.p.membres.map(m => exclusionSelectorKey(m.selector)), ['siege-offense:copies:0', 'siege-offense:copies:1', 'siege-offense:copies:2'], 'une occurrence par slot distinct, dans l’ordre');
  ok(resolveExclusionEntry(r.p.membres[0].selector, data)!.gear !== match.slots[0].owned!.gear, 'la confrontation juge le dernier A, l’import commence par le premier');
  egal(r.rapport.messages.filter(m => m.includes('diffère de celui jugé')).length, 1, 'différence d’exemplaire explicitement signalée');
  egal(r.rapport.membresImportes, 3, 'copies conservées par le consommateur');

  data.siegeOffenseTeams = [deckComposition('abc', [1, 2, 3])];
  const repli = consommer(data);
  egal(repli.p.membres.map(m => exclusionSelectorKey(m.selector)), ['siege-offense:abc:0', 'box:box-1', 'siege-offense:abc:1'], 'second A sans slot : repli Box en excluant le premier A déjà pris');
  egal(repli.rapport.membresImportes, 3, 'occurrence sans slot importée depuis un autre sélecteur');
  ok(repli.rapport.messages.some(m => m.includes('aucun slot distinct disponible') && m.includes('excluant les exemplaires déjà pris')), 'repli faute de slot dit au rapport');
  ok(repli.rapport.messages.some(m => m.includes('diffère de celui jugé')), 'copie de repli différente de la copie confrontée dite au rapport');
}
export function testImportRecoRepliCopiesDistinctes() {
  titre('Import recommandation · repli sans deck, deuxième copie Box puis sources suivantes');
  const data = sourcesComposition(); data.siegeOffenseTeams = [];
  data.box.splice(1, 0, { ...data.box[0], key: 'box-1-bis', gear: gearComposition(50) });
  const r = consommer(data);
  egal(r.p.membres.map(m => exclusionSelectorKey(m.selector)), ['box:box-1', 'box:box-1-bis', 'box:box-2'], 'deux A prennent deux exemplaires Box distincts');
  egal(r.rapport.membresImportes, 3, 'aucun dédoublonnage silencieux au consommateur');
  const suite = consommer(data, [1, 1, 1, 1]);
  egal(suite.p.membres.map(m => exclusionSelectorKey(m.selector)), ['box:box-1', 'box:box-1-bis', 'rta:1'], 'copies Box épuisées : RTA, sans réutiliser un sélecteur');
  egal(suite.rapport.ignores.length, 1, 'copies réelles épuisées : occurrence ignorée et dite');
  ok(suite.p.membres.every(m => m.selector.source !== 'unowned'), 'espèce possédée épuisée jamais déclarée absente');
}
export function testImportRecoContexteEcranPartage() {
  titre('Import recommandation · même contexte et même équipe que l’écran');
  const data = sourcesComposition(), deck = recommandationComposition();
  data.siegeDefenseTeams = [deckComposition('defense')];
  const reco = { id: 'reco', origin: 'mine' as const, name: '', author: '', note: '', decks: [deck] };
  const ecran = matchReco(reco, contexteEcran(data)).decks[0];
  egal(ecran.team, 'Défense 1', 'l’écran conserve les défenses dans le contexte, première à égalité');
  const retrouve = retrouverDeckCompositionOptimizer({ type: 'recommandation', deck }, data);
  egal(retrouve?.source, 'siege-defense', 'la fonction commune retrouve le même camp que l’écran');
  egal(retrouve?.team.id, 'defense', 'la même équipe est retenue des deux côtés');
  const r = consommer(data, [1, 2, 3]);
  ok(r.p.membres.every(m => m.selector.source === 'siege-offense'), 'la préférence d’import reste l’offense lorsque l’écran retient une défense');
  egal(r.rapport.messages.filter(m => m.includes('diffère de celui jugé')).length, 3, 'les trois différences de provenance sont signalées');
  const source = readFileSync(new URL('../src/components/siege/RecoBoard.tsx', import.meta.url), 'utf8');
  ok(source.includes('() => contexteConfrontationReco(builds, teams, copies6)'), 'l’écran appelle le constructeur commun avec les trois entrées');
}

export const verificationsImportRecoCopies: [string, () => void][] = [
  testImportRecoSorteUniqueSignalee, testImportRecoCopiesAvecOffenseRetenue,
  testImportRecoRepliCopiesDistinctes, testImportRecoContexteEcranPartage,
].map(test => [test.name, test]);
