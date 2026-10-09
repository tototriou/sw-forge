import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
async function verifier(nom: string, telephone = false) {
  titre(`Import Optimizer · ${nom} · ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone, 'tests/rendu/optimizer-import-banc.tsx');
  try {
    const preuves = await page.evaluate(async nom => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario(nom), nom);
    ok(preuves.length > 0, 'scénario avec les hooks réels');
    for (const [condition, texte] of preuves) ok(condition, texte);
    if (process.env.CAPTURES) {
      await page.screenshot({ path: `${process.env.CAPTURES}/import-${nom}-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: true, animations: 'disabled' });
      if (['defenses', 'offense', 'rta'].includes(nom)) {
        await page.locator('button:visible').filter({ hasText: /^Importer une équipe$/ }).click();
        await page.screenshot({ path: `${process.env.CAPTURES}/import-${nom}-rapport-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: true, animations: 'disabled' });
      }
    }
  } finally { await browser.close(); }
}
export const testOptimizerImportActionDemontee = () => verifier('action');
export const testOptimizerImportEcrituresGroupees = () => verifier('groupe');
export const testRenduOptimizerImportDefenses = () => verifier('defenses');
export const testRenduTelephoneOptimizerImportDefenses = () => verifier('defenses', true);
export const testRenduOptimizerImportOffense = () => verifier('offense');
export const testRenduTelephoneOptimizerImportOffense = () => verifier('offense', true);
export const testRenduOptimizerImportRta = () => verifier('rta');
export const testRenduTelephoneOptimizerImportRta = () => verifier('rta', true);
export const testRenduOptimizerImportIndisponible = () => verifier('indisponible');
export const testRenduTelephoneOptimizerImportIndisponible = () => verifier('indisponible', true);
