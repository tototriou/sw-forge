import { readFileSync } from 'node:fs';
import { avecNavigationImportOptimizer } from '../src/lib/actionImportOptimizer';
import { importerDefensesSiegeOptimizer, type RapportImportOptimizer } from '../src/lib/importEquipes';
import { egal, ok, titre } from './outils';

export function testOptimizerImportNavigation() {
  titre('Import Optimizer · navigation après acceptation seulement');
  for (const motif of ['accepté', 'vide', 'revérification en attente', 'collision']) {
    const rapport: RapportImportOptimizer = { listeCreee: motif === 'accepté' ? { id: 'import', name: 'Défenses de siège' } : null,
      membresImportes: motif === 'accepté' ? 3 : 0, equipesCreees: motif === 'accepté' ? 1 : 0,
      ignores: [], equipesNonCreees: [], messages: [motif] };
    let route = '#/siege/defense', appels = 0, producteurRecu = false;
    const action = avecNavigationImportOptimizer(produire => {
      appels++; producteurRecu = produire === importerDefensesSiegeOptimizer;
      egal(route, '#/siege/defense', `${motif} : action avant navigation`);
      return rapport;
    }, () => { route = '#/outils/optimizer'; });
    ok(action(importerDefensesSiegeOptimizer) === rapport, `${motif} : rapport commun rendu intact`);
    ok(appels === 1 && producteurRecu, `${motif} : un seul appel, même producteur`);
    egal(route, motif === 'accepté' ? '#/outils/optimizer' : '#/siege/defense', `${motif} : route attendue`);
  }
  const app = readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
  ok(app.includes("const importerEquipe = avecNavigationImportOptimizer(optimizer.importerEquipe, () => {\n    window.location.hash = '#/outils/optimizer';"),
    'App branche la navigation sur la seule action commune');
  const debut = app.indexOf('<OutilsPage'), fin = app.indexOf('/>', debut);
  ok(debut >= 0 && fin > debut && app.slice(debut, fin).includes('onImporterEquipe={importerEquipe}'),
    'l’Optimizer reçoit la même action avec navigation');
}
