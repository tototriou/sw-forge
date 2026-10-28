import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
async function verifier(nom: string, telephone = false) {
  titre(`rendu · recherche Optimizer — ${nom}, ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    const preuves = await page.evaluate(async nom => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario(`recherche-auto-${nom}`), nom);
    ok(preuves.length > 1, 'scénario exécuté avec les vrais hooks et les gestes de recherche');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}
export const testRenduOptimizerRechercheBoxResolu = () => verifier('box-resolu');
export const testRenduTelephoneOptimizerRechercheBoxResolu = () => verifier('box-resolu', true);
export const testRenduOptimizerRechercheDejaMembre = () => verifier('deja-membre');
export const testRenduTelephoneOptimizerRechercheDejaMembre = () => verifier('deja-membre', true);
export const testRenduOptimizerRechercheExemplaireSuivant = () => verifier('exemplaire-suivant');
export const testRenduTelephoneOptimizerRechercheExemplaireSuivant = () => verifier('exemplaire-suivant', true);
export const testRenduExemplaireLigneIndisponibleClavierSouris = () => verifier('exemplaire-suivant');
export const testRenduTelephoneExemplaireLigneIndisponibleClavierSouris = () => verifier('exemplaire-suivant', true);
export const testRenduOptimizerRechercheSourceRta = () => verifier('source-rta');
export const testRenduTelephoneOptimizerRechercheSourceRta = () => verifier('source-rta', true);
export const testRenduOptimizerRechercheSourceSiege = () => verifier('source-siege');
export const testRenduTelephoneOptimizerRechercheSourceSiege = () => verifier('source-siege', true);
export const testRenduOptimizerRechercheDesambiguise = () => verifier('desambiguise');
export const testRenduTelephoneOptimizerRechercheDesambiguise = () => verifier('desambiguise', true);
export const testRenduOptimizerRechercheCreationSansSource = () => verifier('creation-sans-source');
export const testRenduTelephoneOptimizerRechercheCreationSansSource = () => verifier('creation-sans-source', true);
export const testRenduOptimizerRechercheNonPossede = () => verifier('non-possede');
export const testRenduTelephoneOptimizerRechercheNonPossede = () => verifier('non-possede', true);
export const testRenduOptimizerRechercheSansListeBox = () => verifier('sans-liste-box');
export const testRenduTelephoneOptimizerRechercheSansListeBox = () => verifier('sans-liste-box', true);

async function verifierLecture(nom: string, telephone = false) {
  titre(`rendu · Exemplaire en lecture — ${nom}, ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    const preuves = await page.evaluate(async nom => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario(`exemplaire-lecture-${nom}`), nom);
    ok(preuves.length > 3, 'scénario exécuté avec le vrai écran');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}
export const testRenduExemplaireApercuEtBuildActuelEquipementOptimise = () => verifierLecture('equipement');
export const testRenduTelephoneExemplaireApercuEtBuildActuelEquipementOptimise = () => verifierLecture('equipement', true);
export const testRenduExemplaireComparerFicheApercu = () => verifierLecture('comparaison');
export const testRenduTelephoneExemplaireComparerFicheApercu = () => verifierLecture('comparaison', true);
export const testRenduExemplaireValidationDepuisApercu = () => verifierLecture('validation');
export const testRenduTelephoneExemplaireValidationDepuisApercu = () => verifierLecture('validation', true);
