import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
async function verifier(nom: string, telephone = false) {
  titre(`rendu · point Optimizer — ${nom}${telephone ? ' au téléphone' : ' au bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    const preuves = await page.evaluate(async nom => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario(nom), nom);
    ok(preuves.length > 0, 'scénario exécuté avec l’écran et les hooks réels');
    for (const [condition, texte] of preuves) ok(condition, texte);
    if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/${nom}-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: true });
  } finally { await browser.close(); }
}
export const testRenduOptimizerPointGestes = () => verifier('point-gestes');
export const testRenduTelephoneOptimizerPointGestes = () => verifier('point-gestes', true);
export const testRenduOptimizerPointReimport = () => verifier('point-reimport');
export const testRenduTelephoneOptimizerPointReimport = () => verifier('point-reimport', true);
export const testRenduOptimizerPointCompteVide = () => verifier('point-vide');
export const testRenduTelephoneOptimizerPointCompteVide = () => verifier('point-vide', true);
export const testRenduOptimizerPointSansMemoireChangementListe = () => verifier('point-sans-memoire-changement-liste');
export const testRenduTelephoneOptimizerPointSansMemoireChangementListe = () => verifier('point-sans-memoire-changement-liste', true);
export const testRenduOptimizerPointSansMemoireListeSupprimee = () => verifier('point-sans-memoire-liste-supprimee');
export const testRenduTelephoneOptimizerPointSansMemoireListeSupprimee = () => verifier('point-sans-memoire-liste-supprimee', true);
