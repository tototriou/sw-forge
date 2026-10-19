import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

// Le sens des listes à choix multiples des essentiels du bureau, après de vrais
// clics : un rendu serveur n'exécute aucun gestionnaire.

const monter = (nom: string) => `globalThis.bancOptimizer.monter(${JSON.stringify(nom)})`;

export async function testRenduOptimizerGabaritsGestes() {
  titre('rendu · gabarits de l’Optimizer — set compact et principales, au clic');
  const { browser, page } = await navigateurOptimizer(false, 'tests/rendu/optimizer-gabarits-banc.tsx');
  try {
    // Set compact : la liste reste ouverte pendant la composition.
    await page.evaluate(monter('set'));
    const declencheur = page.getByRole('button', { name: /^Set de runes recherché :/ });
    const ouvert = async () => (await declencheur.getAttribute('aria-expanded')) === 'true';
    await declencheur.click();
    ok(await ouvert(), 'set : la liste s’ouvre au clic');
    await page.getByRole('button', { name: 'Violent', exact: true }).click();
    await page.waitForTimeout(100);
    ok(await ouvert(), 'set : la liste reste ouverte après un set de 4 (Violent)');
    ok(await declencheur.evaluate((e) => e.closest('div')!.contains(document.activeElement)), 'set : le focus reste dans la liste (le set de 4 cliqué s’est désactivé)');
    await page.getByRole('button', { name: 'Will', exact: true }).click();
    await page.waitForTimeout(100);
    ok(!(await ouvert()), 'set : la liste se ferme au choix qui remplit les six emplacements');
    await declencheur.click();
    await page.getByRole('button', { name: 'Retirer Will' }).click();
    await page.waitForTimeout(100);
    ok(await ouvert(), 'set : retirer un set laisse la liste ouverte');
    await page.keyboard.press('Escape');
    ok(!(await ouvert()), 'set : Échap la ferme');
    await declencheur.click();
    await page.mouse.click(1400, 900);
    ok(!(await ouvert()), 'set : un clic ailleurs la ferme');

    // Principales : liste classique, la valeur choisie en surbrillance.
    await page.evaluate(monter('principales'));
    await page.getByRole('button', { name: 'Slot 4 : Libre' }).click();
    const surface = page.getByRole('group', { name: 'Slot 4' });
    ok(await surface.isVisible(), 'principales : la surface du slot 4 s’ouvre');
    ok((await surface.locator('input[type="checkbox"]').count()) === 0, 'principales : aucune case dans la surface');
    const tauxCrit = surface.getByRole('button', { name: 'Taux Crit', exact: true });
    ok((await tauxCrit.getAttribute('aria-pressed')) === 'false', 'principales : Taux Crit non choisie');
    await tauxCrit.click();
    ok((await tauxCrit.getAttribute('aria-pressed')) === 'true', 'principales : Taux Crit choisie, en surbrillance');
    ok(/border-accent/.test((await tauxCrit.getAttribute('class')) ?? ''), 'principales : la valeur choisie porte le marqueur d’accent');
    ok(await surface.isVisible(), 'principales : la liste reste ouverte après un choix');
    ok((await page.getByRole('button', { name: 'Slot 4 : Taux Crit' }).count()) === 1, 'principales : le champ fermé résume le choix');
  } finally { await browser.close(); }
}
