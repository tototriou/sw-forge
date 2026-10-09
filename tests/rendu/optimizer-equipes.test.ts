import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
async function verifier(nom: string, telephone = false) {
  titre(`rendu · équipes Optimizer — ${nom}${telephone ? ' au téléphone' : ' au bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    const preuves = await page.evaluate(async nom => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario(nom), nom);
    ok(preuves.length > 0, 'scénario exécuté avec les vrais hooks');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}
export const testRenduOptimizerLeadEquipePersonnel = () => verifier('lead-equipe');
export const testRenduTelephoneOptimizerLeadEquipePersonnel = () => verifier('lead-equipe', true);
export const testRenduOptimizerDialogueEquipe = () => verifier('dialogue-equipe');
export const testRenduTelephoneOptimizerDialogueEquipe = () => verifier('dialogue-equipe', true);
export const testRenduOptimizerCreationContenu = () => verifier('contenu-creation');
export const testRenduTelephoneOptimizerCreationContenu = () => verifier('contenu-creation', true);
export const testRenduOptimizerRefusIdentitePerime = () => verifier('refus-identite-perime');
export const testRenduTelephoneOptimizerRefusIdentitePerime = () => verifier('refus-identite-perime', true);
export const testRenduOptimizerRecetteLeadEquipe = () => verifier('recette-lead-equipe');
export const testRenduTelephoneOptimizerRecetteLeadEquipe = () => verifier('recette-lead-equipe', true);
export const testRenduOptimizerLeadAncienHorsEquipe = () => verifier('lead-ancien-hors-equipe');
export const testRenduTelephoneOptimizerLeadAncienHorsEquipe = () => verifier('lead-ancien-hors-equipe', true);
export const testRenduOptimizerContenuSansDeplacement = () => verifier('contenu-sans-deplacement');
export const testRenduTelephoneOptimizerContenuSansDeplacement = () => verifier('contenu-sans-deplacement', true);
