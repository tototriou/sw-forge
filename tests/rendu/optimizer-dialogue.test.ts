import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

async function verifier(nom: string, telephone = false) {
  titre(`rendu · dialogue d’équipe — ${nom}${telephone ? ' au téléphone' : ' au bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone, 'tests/rendu/optimizer-dialogue-banc.tsx');
  try {
    const preuves = await page.evaluate(async nom => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario(nom), nom);
    ok(preuves.length > 0, 'scénario exécuté sur le dialogue et le hook réels');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}
export const testRenduOptimizerDialogueLeaderSkill = () => verifier('leader');
export const testRenduTelephoneOptimizerDialogueLeaderSkill = () => verifier('leader', true);
export const testRenduOptimizerDialogueMembresDisponibles = () => verifier('membres');
export const testRenduTelephoneOptimizerDialogueMembresDisponibles = () => verifier('membres', true);
export const testRenduOptimizerDialogueDefilement = () => verifier('defilement');
export const testRenduTelephoneOptimizerDialogueDefilement = () => verifier('defilement', true);
