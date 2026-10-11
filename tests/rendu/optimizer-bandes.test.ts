import { readFileSync } from 'node:fs';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

async function verifier(telephone: boolean, theme: 'light' | 'dark') {
  titre(`rendu · bandes d’équipes — ${telephone ? 'téléphone' : 'bureau'}, thème ${theme === 'light' ? 'clair' : 'sombre'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const preuves = await page.evaluate(() => (globalThis as unknown as {
      bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario('bandes-equipes'));
    ok(preuves.length > 0, 'preuves sur les vrais hooks et le CSS émis');
    for (const [oui, texte] of preuves) ok(oui, texte);
    const alerte = page.locator('section[aria-label="Équipe 1"] button[aria-label^="Lead inactif"]').filter({ visible: true });
    await alerte.scrollIntoViewIfNeeded();
    const avant = await alerte.boundingBox();
    if (telephone) await alerte.tap(); else await alerte.hover();
    const motif = page.locator(telephone ? '[role="dialog"] p' : '[role="tooltip"]');
    await motif.waitFor({ state: 'visible' });
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().endTime !== Infinity)
        .map(a => a.finished.catch(() => {})));
    });
    ok(await motif.textContent() === 'Le lead ne concerne pas l’élément de ce membre.', 'motif lisible au survol ou au toucher');
    const apres = await alerte.boundingBox();
    ok(JSON.stringify(apres) === JSON.stringify(avant), `ouvrir le motif ne déplace pas sa cible — ${JSON.stringify({ avant, apres })}`);
    const dimensions = await motif.boundingBox();
    const taille = page.viewportSize()!;
    ok(!!dimensions && dimensions.x >= 0 && dimensions.y >= 0 && dimensions.x + dimensions.width <= taille.width
      && dimensions.y + dimensions.height <= taille.height, 'motif entièrement dans l’écran');
    if (telephone) await page.getByRole('button', { name: 'Fermer', exact: true }).tap();
    else await page.mouse.move(0, 0);
    ok(await motif.count() === 0, 'fermer le motif retire son texte');
    if (!telephone) {
      await alerte.focus();
      ok(await page.getByRole('tooltip').isVisible(), 'motif également lisible au focus clavier');
      await page.keyboard.press('Escape');
      ok(await page.getByRole('tooltip').count() === 0, 'Échap ferme la bulle');
    }
  } finally { await browser.close(); }
}

export const testRenduOptimizerBandesEquipesClair = () => verifier(false, 'light');
export const testRenduOptimizerBandesEquipesSombre = () => verifier(false, 'dark');
export const testRenduTelephoneOptimizerBandesEquipesClair = () => verifier(true, 'light');
export const testRenduTelephoneOptimizerBandesEquipesSombre = () => verifier(true, 'dark');

export function testOptimizerEquipesJetons() {
  titre('équipes · jetons des deux thèmes et contrôles partagés');
  const css = readFileSync('src/index.css', 'utf8');
  const config = readFileSync('tailwind.config.js', 'utf8');
  for (const teinte of ['a', 'b']) {
    ok(new RegExp(`--equipe-${teinte}: \\d+ \\d+ \\d+;`).test(css), `teinte ${teinte} définie en clair`);
    ok(new RegExp(`--forge-equipe-${teinte}: \\d+ \\d+ \\d+;`).test(css), `teinte ${teinte} définie en sombre`);
    ok(css.match(new RegExp(`--equipe-${teinte}: var\\(--forge-equipe-${teinte}\\);`, 'g'))?.length === 2, `teinte ${teinte} partagée entre sombre automatique et forcé`);
    ok(config.includes(`'equipe-${teinte}': 'rgb(var(--equipe-${teinte}) / <alpha-value>)'`), `teinte ${teinte} exposée à Tailwind`);
  }
  const source = readFileSync('src/components/outils/OptimizerLeadInactif.tsx', 'utf8');
  ok(source.includes('<BoutonIcone') && source.includes('<FlottantAuto') && source.includes('<Modale') && !/<button\b/.test(source), 'alerte composée uniquement de contrôles partagés');
}
