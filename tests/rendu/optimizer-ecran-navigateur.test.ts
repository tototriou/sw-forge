// Branchements de l'écran de l'Optimizer, prouvés au navigateur sur le vrai
// écran (preuves : optimizer-ecran-preuves.ts). Aux deux formats quand le
// geste diffère de l'un à l'autre (flottant au bureau, panneau au doigt).
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

async function verifier(nom: string, telephone = false) {
  titre(`rendu · Optimizer, branchements de l’écran — ${nom}, ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    const preuves = await page.evaluate(async (nom) => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario(`ecran-${nom}`), nom);
    ok(preuves.length > 1, 'scénario exécuté avec les vrais hooks et l’écran monté');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}

export const testRenduOptimizerEcranReglagesAvances = () => verifier('reglages-avances');
export const testRenduTelephoneOptimizerEcranReglagesAvances = () => verifier('reglages-avances', true);
export const testRenduOptimizerEcranGuidage = () => verifier('guidage');
export const testRenduTelephoneOptimizerEcranGuidage = () => verifier('guidage', true);
export const testRenduOptimizerEcranRappel = () => verifier('rappel');
export const testRenduTelephoneOptimizerEcranRappel = () => verifier('rappel', true);
export const testRenduOptimizerEcranListes = () => verifier('listes');
export const testRenduTelephoneOptimizerEcranListes = () => verifier('listes', true);
export const testRenduOptimizerEcranMessageImport = () => verifier('message-import');
export const testRenduOptimizerEcranResultats = () => verifier('resultats');
