import type { ArtifactDetail } from '../src/types';
import { paireRespecteLignes } from '../src/lib/artifactOptim';
import { consommerImportOptimizer } from '../src/lib/importEquipes';
import { importerRecoOptimizer } from '../src/lib/importRecoOptimizer';
import type { ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { collectOwnedBuilds, collectOwnedTeams, countCopiesByCom2us, indexBuildsByCom2us } from '../src/lib/ownedBuilds';
import { matchDeck } from '../src/lib/recoMatch';
import { recommandationComposition, sourcesComposition, stockageComposition } from './import-composition-fixtures';
import { egal, ok, titre } from './outils';

function contexteEcran(data: ExclusionSourceData) {
  const args = { box: data.box, rta: Object.values(data.rtaEntries), defense: data.siegeDefenseTeams,
    offense: data.siegeOffenseTeams, monsterById: data.monsterById };
  return { builds: indexBuildsByCom2us(collectOwnedBuilds(args)), teams: collectOwnedTeams(args), copies6: countCopiesByCom2us(data.box) };
}

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

export const verificationsImportRecoCopies: [string, () => void][] = [
  testImportRecoSorteUniqueSignalee,
].map(test => [test.name, test]);
