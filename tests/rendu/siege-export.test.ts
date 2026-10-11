import { readFileSync } from 'node:fs';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

async function verifier(telephone: boolean) {
  titre(`Siège · export vers l’Optimizer · ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone, 'tests/rendu/siege-export-banc.tsx');
  try {
    for (const nom of ['defenses', 'defense', 'offense', 'indisponible', 'attente', 'collision', 'vide']) {
      const preuves = await page.evaluate(async ({ nom, telephone }) => (globalThis as unknown as {
        bancOptimizer: { scenario: (nom: string, telephone: boolean) => Promise<[boolean, string][]> };
      }).bancOptimizer.scenario(nom, telephone), { nom, telephone });
      ok(preuves.length > 0, `${nom} : scénario avec les vrais hooks et composants`);
      for (const [condition, texte] of preuves) ok(condition, texte);
      // Au téléphone, capturer le viewport conserve le pointage tactile.
      if (process.env.CAPTURES) {
        await page.screenshot({ path: `${process.env.CAPTURES}/siege-export-${nom}-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: !telephone, animations: 'disabled' });
        if (nom === 'indisponible') for (const charge of [false, true]) {
          await page.evaluate(async ({ charge, telephone }) => (globalThis as unknown as {
            bancOptimizer: { afficherEtatExport: (charge: boolean, telephone: boolean) => Promise<void> };
          }).bancOptimizer.afficherEtatExport(charge, telephone), { charge, telephone });
          await page.screenshot({ path: `${process.env.CAPTURES}/siege-export-${charge ? 'sans-monstre' : 'sans-compte'}-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: !telephone, animations: 'disabled' });
        }
      }
    }
  } finally { await browser.close(); }
}
export const testRenduSiegeExportOptimizer = () => verifier(false);
export const testRenduTelephoneSiegeExportOptimizer = () => verifier(true);

export function testOptimizerImportSiegeBranchement() {
  titre('Siège · branchement de l’action et du rapport');
  const app = readFileSync('src/App.tsx', 'utf8'), page = readFileSync('src/pages/SiegePage.tsx', 'utf8');
  const board = readFileSync('src/components/siege/SiegeBoard.tsx', 'utf8');
  const debut = app.indexOf('<SiegePage'), fin = app.indexOf('/>', debut);
  ok(debut >= 0 && fin > debut, 'montage de SiegePage trouvé avant le contrôle des props');
  const montage = debut >= 0 && fin > debut ? app.slice(debut, fin) : '';
  for (const prop of ['onImporterEquipe={importerEquipe}', 'sourcesOptimizer={optimizerData}', 'compteCharge={box.length > 0 || runes.length > 0}']) ok(montage.includes(prop), `App → SiegePage : ${prop}`);
  const debutBoard = page.indexOf('<SiegeBoard'), finBoard = page.indexOf('/>', debutBoard);
  ok(debutBoard >= 0 && finBoard > debutBoard && page.slice(debutBoard, finBoard).includes('{...boardProps}'), 'SiegePage relaie les props à SiegeBoard');
  ok(board.includes('onExporterOptimizer={() => onImporterEquipe(data => produireEquipe(team.id, data))}'), 'SiegeBoard relaie la seule action aux cartes');
  ok(board.includes("? importerDefensesSiegeOptimizer({ ...data, siegeDefenseTeams: data.siegeDefenseTeams.filter(t => t.id === teamId) })")
    && board.includes(': importerOffenseSiegeOptimizer(teamId, data)'), 'producteurs existants : une défense ou une offense ciblée');
  ok(board.includes('const exporterDefensesOptimizer = () => onImporterEquipe(importerDefensesSiegeOptimizer);'), 'page Défense : toutes les défenses, sans filtre d’affichage');
  ok(app.includes('}, setRapportExportOptimizer);')
    && app.includes('<OptimizerImportRapport rapport={rapportExportOptimizer}'), 'rapport porté par App, conservé après navigation et rendu');
}
