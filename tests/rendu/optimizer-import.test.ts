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

export async function testRenduOptimizerImportDisponibiliteMemoisee() {
  titre('Import Optimizer · propositions mémorisées sur les sources');
  const { browser, page } = await navigateurOptimizer(false, 'tests/rendu/optimizer-import-banc.tsx');
  try {
    const preuves = await page.evaluate(() => (globalThis as unknown as {
      bancOptimizer: { scenarioDisponibiliteMemoisee: () => Promise<[boolean, string][]> };
    }).bancOptimizer.scenarioDisponibiliteMemoisee());
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}

export async function testRenduOptimizerImportRapportPartage() {
  titre('Import Optimizer · rapport partagé entre bureau et téléphone');
  const { browser, page } = await navigateurOptimizer(false, 'tests/rendu/optimizer-import-banc.tsx');
  try {
    const preuves = await page.evaluate(async () => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario('defenses'));
    for (const [condition, texte] of preuves) ok(condition, texte);
    const bouton = () => page.locator('button:visible').filter({ hasText: /^Importer une équipe$/ });
    const rapport = () => page.locator('[aria-label="Rapport d’import"]:visible');
    await bouton().click();
    const texte = await rapport().innerText();
    if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/rapport-partage-bureau.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await bouton().scrollIntoViewIfNeeded();
    const avant = await bouton().boundingBox();
    await bouton().click();
    ok(await rapport().count() === 1, 'le rapport importé au bureau est retrouvé au téléphone');
    if (await rapport().count()) ok(await rapport().innerText() === texte, 'mêmes comptes, ignorés et messages dans le rapport partagé');
    ok(JSON.stringify(await bouton().boundingBox()) === JSON.stringify(avant), 'le rappel du rapport au téléphone garde la géométrie de l’ancre');
    if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/rapport-partage-telephone.png`, fullPage: true });
    await page.evaluate(() => (globalThis as unknown as { bancOptimizer: { changerDisponibiliteImport: (v: boolean) => Promise<void> } }).bancOptimizer.changerDisponibiliteImport(false));
    ok(await bouton().isDisabled() && (await bouton().getAttribute('title'))?.includes('Aucune source utilisable') === true,
      'toutes les sources devenues inutilisables : bouton désactivé avec raison');
    ok(await rapport().count() === 1 && await rapport().innerText() === texte, 'rapport déjà ouvert conservé sans source utilisable');
    await page.keyboard.press('Escape');
    ok(await rapport().count() === 0 && await bouton().isDisabled(), 'rapport fermé sans source : rappel indisponible comme annoncé');
    await page.evaluate(() => (globalThis as unknown as { bancOptimizer: { changerDisponibiliteImport: (v: boolean) => Promise<void> } }).bancOptimizer.changerDisponibiliteImport(true));
    await bouton().click();
    ok(await rapport().count() === 1 && await rapport().innerText() === texte, 'rapport gardé en mémoire et relisible au retour d’une source');
  } finally { await browser.close(); }
}
