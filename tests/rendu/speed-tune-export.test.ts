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
  ok(montage('src/App.tsx', 'OutilsPage').includes('onImporterEquipe={importerEquipe}'), 'App → page : action avec navigation');
  const page = montage('src/pages/OutilsPage.tsx', 'SpeedTuningSection');
  ok(page.includes('onImporterEquipe={onImporterEquipe}') && page.includes('sourcesOptimizer=') && page.includes('compteCharge={box.length > 0 || runes.length > 0}'), 'page → outil : action, sources et disponibilité du compte');
}
