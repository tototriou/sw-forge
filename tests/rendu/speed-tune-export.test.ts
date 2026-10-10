import { readFileSync } from 'node:fs';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

async function verifier(telephone: boolean) {
  titre(`Speed tuning · export vers l’Optimizer · ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone, 'tests/rendu/speed-tune-export-banc.tsx');
  try {
    for (const nom of ['page', 'page-composition', 'modale', 'page-indisponible', 'modale-indisponible',
      'page-attente', 'modale-attente', 'modale-collision', 'modale-vide']) {
      const preuves = await page.evaluate(async ({ nom, telephone }) => (globalThis as unknown as {
        bancOptimizer: { scenario: (nom: string, telephone: boolean) => Promise<[boolean, string][]> };
      }).bancOptimizer.scenario(nom, telephone), { nom, telephone });
      ok(preuves.length > 0, `${nom} : vrais composants et hooks montés`);
      for (const [condition, texte] of preuves) ok(condition, texte);
      if (process.env.CAPTURES) {
        await page.screenshot({ path: `${process.env.CAPTURES}/speed-tune-export-${nom}-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: !telephone, animations: 'disabled' });
        if (nom === 'modale-attente') {
          await page.locator('[aria-labelledby="rapport-export-optimizer"] button[aria-label="Fermer"]').click();
          await page.screenshot({ path: `${process.env.CAPTURES}/speed-tune-export-modale-ouverte-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: !telephone, animations: 'disabled' });
        }
      }
    }
  } finally { await browser.close(); }
}
export const testRenduSpeedTuneExportOptimizer = () => verifier(false);
export const testRenduTelephoneSpeedTuneExportOptimizer = () => verifier(true);

async function verifierApp(telephone: boolean) {
  titre(`App · speed tuning par la palette au-dessus de l’Optimizer · ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone, 'tests/rendu/speed-tune-export-app-banc.tsx');
  try {
    const preuves = await page.evaluate(() => (globalThis as unknown as {
      bancOptimizer: { scenario: () => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario());
    ok(preuves.length > 0, 'App monté : acceptation puis refus et rapport lus à l’écran');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}
export const testRenduSpeedTuneExportAppOptimizer = () => verifierApp(false);
export const testRenduTelephoneSpeedTuneExportAppOptimizer = () => verifierApp(true);

export function testOptimizerImportSpeedTuneBranchement() {
  titre('Speed tuning · passage de l’action commune par les parents');
  const montage = (fichier: string, balise: string) => {
    const source = readFileSync(fichier, 'utf8'), debut = source.indexOf(`<${balise}`), fin = source.indexOf('/>', debut);
    ok(debut >= 0 && fin > debut, `${fichier} : montage ${balise} trouvé`);
    return debut >= 0 && fin > debut ? source.slice(debut, fin) : '';
  };
  for (const [fichier, action, sources, compte] of [
    ['src/App.tsx', 'importerEquipe', 'optimizerData', 'box.length > 0 || runes.length > 0'],
    ['src/components/siege/SiegeBoard.tsx', 'onImporterEquipe', 'sourcesOptimizer', 'compteCharge'],
  ]) {
    const texte = montage(fichier, 'SpeedTuneModale');
    for (const prop of [`onImporterEquipe={${action}}`, `sourcesOptimizer={${sources}}`, `compteCharge={${compte}}`]) ok(texte.includes(prop), `${fichier} → modale : ${prop}`);
  }
  const outils = montage('src/App.tsx', 'OutilsPage');
  ok(outils.includes('onImporterEquipe={importerEquipeFlottant}') && outils.includes('onExporterEquipe={importerEquipe}'),
    'App → outils : deux actions préparées selon le point d’entrée');
  const page = montage('src/pages/OutilsPage.tsx', 'SpeedTuningSection');
  ok(page.includes('onImporterEquipe={onExporterEquipe}') && page.includes('sourcesOptimizer=') && page.includes('compteCharge={box.length > 0 || runes.length > 0}'), 'page → outil : action du rapport global, sources et disponibilité du compte');
  ok(montage('src/pages/OutilsPage.tsx', 'OptimizerSection').includes('onImporterEquipe={onImporterEquipe}'), 'page → flottant : action du rapport interne');
  const app = readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
  ok(app.includes("const importerEquipeFlottant = avecNavigationImportOptimizer(optimizer.importerEquipe, () => {\n    window.location.hash = '#/outils/optimizer';\n  });"),
    'action du flottant : navigation commune sans rapport global');
  ok(app.includes("const importerEquipe = avecNavigationImportOptimizer(optimizer.importerEquipe, () => {\n    window.location.hash = '#/outils/optimizer';\n  }, setRapportExportOptimizer);"),
    'action externe : rapport global sans condition de route');
}
