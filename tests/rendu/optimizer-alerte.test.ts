import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
import type { Page } from 'playwright';

interface BancAlerte {
  scenario: (nom: string) => Promise<[boolean, string][]>;
  piloterAlerte: (action: 'retirer-motif' | 'retablir-motif' | 'demonter') => Promise<void>;
}
async function preparer(telephone: boolean) {
  const banc = await navigateurOptimizer(telephone);
  const preuves = await banc.page.evaluate(() => (globalThis as unknown as { bancOptimizer: BancAlerte }).bancOptimizer.scenario('bandes-equipes'));
  ok(preuves.length > 0 && preuves.every(([oui]) => oui), 'liste préparée avec les vrais hooks');
  const icone = banc.page.locator('section[aria-label="Équipe 1"] button[aria-label^="Lead inactif"]').filter({ visible: true });
  return { ...banc, icone, panneau: banc.page.locator(telephone ? '[role="dialog"]' : '[role="tooltip"]') };
}
async function finirAnimations(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime !== Infinity)
      .map(a => a.finished.catch(() => {})));
  });
}
async function piloter(page: Page, action: Parameters<BancAlerte['piloterAlerte']>[0]) {
  await page.evaluate(action => (globalThis as unknown as { bancOptimizer: BancAlerte }).bancOptimizer.piloterAlerte(action), action);
}

export async function testRenduOptimizerAlerteDefilement() {
  titre('rendu · alerte Optimizer — fermeture au défilement');
  const { browser, page, icone, panneau } = await preparer(false);
  try {
    await page.mouse.move(0, 0);
    await icone.scrollIntoViewIfNeeded();
    await icone.focus();
    await panneau.waitFor({ state: 'visible' });
    await finirAnimations(page);
    const liste = icone.locator('xpath=../../../..');
    const avant = await liste.evaluate(e => e.scrollTop);
    const rect = (await liste.boundingBox())!;
    await page.mouse.move(rect.x + 5, rect.y + 5);
    await page.mouse.wheel(0, avant > 0 ? -40 : 40);
    await page.waitForFunction(avant => {
      const groupe = [...document.querySelectorAll('section[aria-label="Équipe 1"]')].find(e => e.getBoundingClientRect().width > 0)!;
      return groupe.parentElement!.scrollTop !== avant;
    }, avant);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await finirAnimations(page);
    ok(await panneau.count() === 0, 'molette dans la liste : aucune bulle détachée de l’icône focalisée');

    await page.mouse.move(0, 0);
    await icone.evaluate(e => (e as HTMLElement).blur());
    await icone.focus();
    await panneau.waitFor({ state: 'visible' });
    await finirAnimations(page);
    const position = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, 40));
    await page.waitForFunction(avant => window.scrollY !== avant, position);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await finirAnimations(page);
    ok(await panneau.count() === 0, 'défilement de la page ancêtre : bulle fermée');
  } finally { await browser.close(); }
}

async function cycle(telephone: boolean) {
  titre(`rendu · alerte Optimizer — cycle de vie ${telephone ? 'au téléphone' : 'au bureau'}`);
  const { browser, page, icone, panneau } = await preparer(telephone);
  try {
    await page.mouse.move(0, 0);
    await icone.scrollIntoViewIfNeeded();
    if (telephone) await icone.tap(); else await icone.focus();
    await panneau.waitFor({ state: 'visible' });
    await finirAnimations(page);
    ok(await panneau.isVisible(), 'motif ouvert et lisible avant son retrait');
    await piloter(page, 'retirer-motif');
    ok(await panneau.count() === 0 && await icone.count() === 0, 'retirer le motif démonte l’icône et son panneau');
    await piloter(page, 'retablir-motif');
    ok(await icone.count() === 1 && await panneau.count() === 0, 'rétablir le motif ne rouvre rien automatiquement');
    if (await panneau.count()) await page.keyboard.press('Escape');
    if (telephone) await icone.tap(); else await icone.focus();
    await panneau.waitFor({ state: 'visible' });
    await finirAnimations(page);
    await piloter(page, 'demonter');
    ok(await panneau.count() === 0 && await icone.count() === 0, 'démonter l’écran ouvert ne laisse aucun panneau dans le document');
    await page.keyboard.press('Escape');
    ok(await page.getByText('Autre onglet', { exact: true }).isVisible() && await panneau.count() === 0, 'après démontage : aucun reste réactivé par le clavier');
  } finally { await browser.close(); }
}
export const testRenduOptimizerAlerteCycleDeVie = () => cycle(false);
export const testRenduTelephoneOptimizerAlerteCycleDeVie = () => cycle(true);

export async function testRenduTelephoneOptimizerAlerteFermetures() {
  titre('rendu · alerte Optimizer — fermetures et restitution du focus au téléphone');
  const { browser, page, icone, panneau } = await preparer(true);
  try {
    // Exerce le tap même quand le navigateur laisse le focus sur le fond.
    await icone.evaluate(e => e.addEventListener('mousedown', evenement => evenement.preventDefault()));
    for (const fermeture of ['croix', 'Échap', 'extérieur']) {
      await icone.scrollIntoViewIfNeeded();
      const avant = await icone.boundingBox();
      await icone.tap();
      await panneau.waitFor({ state: 'visible' });
      await finirAnimations(page);
      ok(JSON.stringify(await icone.boundingBox()) === JSON.stringify(avant), `${fermeture} : ouvrir ne déplace pas l’icône`);
      if (fermeture === 'croix') {
        const position = await panneau.boundingBox();
        const fondDefile = await icone.locator('xpath=../../../..').evaluate(e => {
          const avant = e.scrollTop;
          e.scrollTop += avant > 0 ? -40 : 40;
          return e.scrollTop !== avant;
        });
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        ok(fondDefile && JSON.stringify(await panneau.boundingBox()) === JSON.stringify(position), 'défilement du fond au téléphone : dialogue toujours ancré à l’écran');
      }
      if (fermeture === 'croix') await panneau.getByRole('button', { name: 'Fermer', exact: true }).tap();
      else if (fermeture === 'Échap') await page.keyboard.press('Escape');
      else await page.touchscreen.tap(5, 5);
      ok(await panneau.count() === 0, `${fermeture} : modale fermée`);
      ok(await icone.evaluate(e => document.activeElement === e), `${fermeture} : focus rendu à l’icône`);
    }
  } finally { await browser.close(); }
}
