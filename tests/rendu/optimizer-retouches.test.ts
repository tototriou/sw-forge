import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
async function verifier(nom: string, telephone = false) {
  titre(`rendu · Optimizer — ${nom}, ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    const preuves = await page.evaluate(async nom => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario(nom), nom);
    ok(preuves.length > 0, 'preuve avec les vrais composants et hooks');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}
export const testRenduOptimizerCreationObligatoire = () => verifier('creation-obligatoire');
export const testRenduTelephoneOptimizerCreationObligatoire = () => verifier('creation-obligatoire', true);
export const testRenduOptimizerContenuInvocateur = () => verifier('competences-liste');
export const testRenduTelephoneOptimizerContenuInvocateur = () => verifier('competences-liste', true);
export const testRenduOptimizerEtatAurasEnLigne = () => verifier('etat-auras');
export const testRenduTelephoneOptimizerEtatAurasEnLigne = () => verifier('etat-auras', true);
export const testRenduOptimizerEnteteEquipeCompact = () => verifier('entete-equipe');
export const testRenduTelephoneOptimizerEnteteEquipeCompact = () => verifier('entete-equipe', true);
export const testRenduOptimizerDialogueElementVide = () => verifier('dialogue-element');
export const testRenduTelephoneOptimizerDialogueElementVide = () => verifier('dialogue-element', true);
