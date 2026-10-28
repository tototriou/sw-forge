import type { Page } from 'playwright';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { egal, ok, titre } from '../outils';
import type * as Banc from './optimizer-comparer-validation-banc';

const BANC = 'tests/rendu/optimizer-comparer-validation-banc.tsx';
const banc = (page: Page, variante: Banc.VarianteRelique) => page.evaluate((v) =>
  (globalThis as unknown as { bancOptimizer: typeof Banc }).bancOptimizer.monter(v), variante);

async function verifier(telephone: boolean, variante: Banc.VarianteRelique = 'fixe') {
  const format = `${telephone ? 'téléphone' : 'ordinateur'}${variante === 'recherche' ? ', relique recherchée' : ''}`;
  titre(`rendu · Comparer puis Valider — référence courante et contexte figé, ${format}`);
  const { browser, page } = await navigateurOptimizer(telephone, BANC);
  try {
    const { indice, labels, reliqueCarte } = await banc(page, variante);
    const cartes = page.locator('[data-carte-resultat]');
    if (await cartes.count() <= indice) throw new Error(`Cartes absentes : ${await page.locator('body').innerText()}`);
    const carte = cartes.nth(indice);
    await carte.getByRole('button', { name: 'Comparer', exact: true }).click();
    const relever = () => carte.evaluate(element => {
      const grille = element.lastElementChild!;
      const stats = [...grille.children].map(ligne => ({
        label: ligne.firstElementChild?.textContent ?? '', delta: ligne.lastElementChild?.textContent ?? '',
      }));
      const objectif = (libelle: string) => {
        const ligne = [...element.querySelectorAll('p')].find(p => p.firstElementChild?.textContent === libelle);
        const valeur = ligne?.querySelector('.text-star');
        return { total: valeur?.textContent ?? '', delta: valeur?.previousElementSibling?.textContent ?? '' };
      };
      return { stats, ehp: objectif('PV effectifs'), degats: objectif('Dégâts') };
    });
    const avant = await relever();
    egal(avant.stats.map(s => s.label), labels, `${format} : les huit écarts sont affichés dans la vraie carte`);
    const nombre = (texte: string) => texte.trim() ? Number(texte.replace(/[\s%]/g, '').replace('−', '-').replace(',', '.')) : NaN;
    const statsAvant = avant.stats.map(s => nombre(s.delta));
    const ehpAvant = nombre(avant.ehp.delta), degatsAvant = nombre(avant.degats.delta);
    ok(statsAvant.every(Number.isFinite) && statsAvant.some(v => v !== 0)
      && Number.isFinite(ehpAvant) && ehpAvant !== 0 && Number.isFinite(degatsAvant) && degatsAvant !== 0,
      `${format} : avant validation, écarts numériques non nuls (stats ${JSON.stringify(statsAvant)}, PV effectifs ${avant.ehp.delta}, Dégâts ${avant.degats.delta})`);
    await carte.getByRole('button', { name: 'Valider ce build', exact: true }).click();
    await carte.getByRole('button', { name: 'Validé', exact: true }).waitFor();
    const apres = await relever();
    egal(apres.stats.map(s => s.label), labels, `${format} : les huit statistiques restent comparées après validation`);
    ok(apres.stats.length === 8 && apres.stats.every(s => /^0%?$/.test(s.delta.trim())),
      `${format} : les huit écarts statistiques affichés sont nuls (${apres.stats.map(s => s.delta).join(', ')})`);
    egal(apres.ehp.delta, '0', `${format} : écart PV effectifs affiché nul (${avant.ehp.delta} → ${apres.ehp.delta})`);
    egal(apres.degats.delta, '0', `${format} : écart Dégâts affiché nul (${avant.degats.delta} → ${apres.degats.delta})`);
    egal([apres.ehp.total, apres.degats.total], [avant.ehp.total, avant.degats.total],
      `${format} : les scores de la recherche restent ceux de la photographie`);
    const etat = await page.evaluate(() => (globalThis as unknown as { bancOptimizer: typeof Banc }).bancOptimizer.etatApresValidation());
    ok(etat.valide && etat.runesValidees.length === 6, `${format} : le clic réel réserve les six runes dans la vraie liste`);
    egal(etat.reliqueValidee, reliqueCarte, `${format} : le build validé mémorise la relique de la carte`);
    ok(etat.photoConservee && etat.ordreConserve && etat.contexteVivantDistinct,
      `${format} : photographie et ordre conservés malgré un contexte de saisie différent`);
  } finally { await browser.close(); }
}

export async function testRenduOptimizerComparerValidationBureau() { await verifier(false); }
export async function testRenduOptimizerComparerValidationTelephone() { await verifier(true); }
export async function testRenduOptimizerComparerValidationReliqueBureau() { await verifier(false, 'recherche'); }
export async function testRenduOptimizerComparerValidationReliqueTelephone() { await verifier(true, 'recherche'); }
