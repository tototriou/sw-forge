import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
async function verifier(cas: string, telephone = false) {
  titre(`rendu · Optimizer équipe impossible — ${cas}, ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page }=await navigateurOptimizer(telephone);
  try {
    const preuves=await page.evaluate(async nom=>(globalThis as unknown as {
      bancOptimizer:{scenario:(nom:string)=>Promise<[boolean,string][]>};
    }).bancOptimizer.scenario(nom), `equipe-impossible-${cas}`);
    ok(preuves.length>0,'preuve sur les vrais composants et hooks');
    for(const [condition,texte] of preuves) ok(condition,texte);
  } finally { await browser.close(); }
}
export const testRenduOptimizerEquipeImpossibleZeroLibre = () => verifier('zero-libre');
export const testRenduTelephoneOptimizerEquipeImpossibleZeroLibre = () => verifier('zero-libre',true);
export const testRenduOptimizerEquipeImpossibleUnLibre = () => verifier('un-libre');
export const testRenduTelephoneOptimizerEquipeImpossibleUnLibre = () => verifier('un-libre',true);
export const testRenduOptimizerEquipeImpossibleDeuxDontUnLie = () => verifier('deux-dont-un-lie');
export const testRenduTelephoneOptimizerEquipeImpossibleDeuxDontUnLie = () => verifier('deux-dont-un-lie',true);
