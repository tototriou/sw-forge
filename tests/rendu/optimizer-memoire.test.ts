import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

async function transition(nom: string, telephone = false) {
  titre(`rendu · Optimizer mémoire — ${nom}${telephone ? ' au téléphone' : ' au bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    if (telephone) ok(await page.evaluate(() => window.innerWidth) === 390, 'largeur de mise en page téléphone : 390 px');
    const preuves = await page.evaluate(async (scenario) => {
      const banc = (globalThis as unknown as { bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> } }).bancOptimizer;
      return banc.scenario(scenario);
    }, nom);
    ok(preuves.length > 0, 'scénario exécuté avec de vrais hooks et un écran monté');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}

export const testRenduMemoireOptimizerSelection = () => transition('selection');
export const testRenduMemoireOptimizerSansMemoire = () => transition('sans-memoire');
export const testRenduMemoireOptimizerListes = () => transition('listes');
export const testRenduMemoireOptimizerRetrait = () => transition('retrait');
export const testRenduMemoireOptimizerInclusion = () => transition('inclusion');
export const testRenduMemoireOptimizerHorsListe = () => transition('hors-liste');
export const testRenduMemoireOptimizerIdentite = () => transition('identite');
export const testRenduMemoireOptimizerRecette = () => transition('recette');
export const testRenduMemoireOptimizerNavigation = () => transition('navigation');
export const testRenduTelephoneMemoireOptimizer = () => transition('navigation', true);
export const testRenduMemoireOptimizerSaisies = () => transition('saisies');
export const testRenduMemoireOptimizerAutomatismes = () => transition('automatismes');
export const testRenduMemoireOptimizerRappelAurasDestination = () => transition('auras-destination');
export const testRenduTelephoneMemoireOptimizerRappelAurasDestination = () => transition('auras-destination', true);
export const testRenduMemoireOptimizerZoneC = () => transition('zone-c');
export const testRenduTelephoneMemoireOptimizerZoneC = () => transition('zone-c', true);
