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

async function verifierHauteur(hauteur: number) {
  titre(`rendu · dialogue d’équipe au bureau — 1440 × ${hauteur}`);
  const { browser, page } = await navigateurOptimizer(false, 'tests/rendu/optimizer-dialogue-banc.tsx');
  try {
    await page.setViewportSize({ width: 1440, height: hauteur });
    for (const action of ['Enregistrer', 'Annuler', 'Délier']) {
      await page.evaluate(() => (globalThis as unknown as {
        bancOptimizer: { preparer: (modification: boolean) => Promise<void> };
      }).bancOptimizer.preparer(true));
      const preuves = await page.evaluate(() => {
        const d = document.querySelector<HTMLElement>('[role="dialog"]')!;
        const [corps, fixe] = [...d.children].filter(e => getComputedStyle(e).overflowY === 'auto') as HTMLElement[];
        const boutons = [...d.querySelectorAll<HTMLButtonElement>('button')].filter(b => ['Enregistrer', 'Annuler', 'Délier'].includes(b.textContent!));
        const r = d.getBoundingClientRect();
        return [
          [r.top >= 0 && r.bottom <= innerHeight && r.height <= innerHeight * .9 + 1, 'la boîte entière tient dans la fenêtre et dans sa limite de hauteur'],
          [boutons.length === 3 && boutons.every(b => {
            const p = b.getBoundingClientRect();
            return p.top >= r.top && p.bottom <= r.bottom && b.contains(document.elementFromPoint(p.x + p.width / 2, p.y + p.height / 2));
          }), 'les trois actions sont entièrement visibles et reçoivent les clics'],
          [!!corps && corps.clientHeight > 0 && corps.scrollHeight > corps.clientHeight, 'la liste conserve une zone de défilement accessible'],
          [!!fixe && fixe.clientHeight > 0 && fixe.scrollHeight > fixe.clientHeight, 'les champs fixes se resserrent et disposent de leur propre défilement'],
        ] as [boolean, string][];
      });
      for (const [condition, texte] of preuves) ok(condition, texte);
      const avant = await page.getByRole('button', { name: action, exact: true }).boundingBox();
      // Le dernier menu est atteint par un vrai geste sur un contrôle du lead.
      await page.getByLabel('Portée du lead de l’équipe', { exact: true }).selectOption('Element');
      await page.getByLabel('Élément du lead de l’équipe', { exact: true }).click();
      await page.keyboard.press('Escape');
      const basAccessible = await page.evaluate(() => {
        const d = document.querySelector<HTMLElement>('[role="dialog"]')!;
        const fixe = [...d.children].filter(e => getComputedStyle(e).overflowY === 'auto')[1] as HTMLElement;
        fixe.scrollTop = fixe.scrollHeight;
        const zone = fixe.getBoundingClientRect(), dernier = fixe.querySelector('[role="status"]')!.getBoundingClientRect();
        return fixe.scrollTop > 0 && dernier.top >= zone.top && dernier.bottom <= zone.bottom;
      });
      ok(basAccessible, 'le bas des champs est accessible après défilement de leur zone');
      ok(JSON.stringify(avant) === JSON.stringify(await page.getByRole('button', { name: action, exact: true }).boundingBox()), 'défiler les champs ne déplace pas les actions');
      await page.getByRole('button', { name: action, exact: true }).click();
      ok(await page.getByRole('dialog').count() === 0, `${action} ferme effectivement le dialogue après défilement`);
    }
  } finally { await browser.close(); }
}
export const testRenduOptimizerDialogueHauteur400 = () => verifierHauteur(400);
export const testRenduOptimizerDialogueHauteur600 = () => verifierHauteur(600);
export const testRenduOptimizerDialogueReferencesLeader = () => verifier('references-leader');
export const testRenduTelephoneOptimizerDialogueReferencesLeader = () => verifier('references-leader', true);

export async function testRenduOptimizerDialogueChangementFormat() {
  titre('rendu · dialogue d’équipe — brouillon et focus au changement de format');
  const { browser, page } = await navigateurOptimizer(false, 'tests/rendu/optimizer-dialogue-banc.tsx');
  try {
    await page.evaluate(() => (globalThis as unknown as {
      bancOptimizer: { preparer: (modification: boolean) => Promise<void> };
    }).bancOptimizer.preparer(true));
    await page.getByLabel('Leader de l’équipe', { exact: true }).selectOption('box:3');
    await page.getByLabel('Type de lead de l’équipe', { exact: true }).selectOption('HP');
    await page.getByLabel('Valeur du lead de l’équipe', { exact: true }).selectOption('44');
    await page.getByLabel('Portée du lead de l’équipe', { exact: true }).selectOption('Element');
    await page.getByLabel('Élément du lead de l’équipe', { exact: true }).selectOption('wind');
    const lire = () => page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')!;
      return { champs: [...d.querySelectorAll<HTMLSelectElement>('select')].map(e => e.value),
        selection: [...d.querySelectorAll<HTMLInputElement>('input:checked')].map(e => e.parentElement!.textContent),
        disque: localStorage.getItem('swblacksmith-optimizer-members-v1') };
    });
    const brouillon = await lire();
    for (const telephone of [true, false]) {
      await page.getByLabel('Type de lead de l’équipe', { exact: true }).focus();
      ok(await page.getByLabel('Type de lead de l’équipe', { exact: true }).evaluate(e => e === document.activeElement), 'le champ a le focus avant le changement de format');
      await page.setViewportSize(telephone ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await page.waitForFunction(telephone => {
        const d = document.querySelector('[role="dialog"]')!;
        const corps = [...d.children].find(e => getComputedStyle(e).overflowY === 'auto');
        return corps?.contains(d.querySelector('[aria-label="Type de lead de l’équipe"]')) === telephone;
      }, telephone);
      ok(JSON.stringify(await lire()) === JSON.stringify(brouillon), 'le brouillon et le stockage sont conservés dans le nouveau format');
      ok(await page.getByLabel('Type de lead de l’équipe', { exact: true }).evaluate(e => e !== document.activeElement), 'déplacer les champs leur fait perdre le focus, sans restauration automatique');
    }
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    ok(await page.getByRole('dialog').count() === 0, 'le brouillon reste validable après les deux changements de format');
  } finally { await browser.close(); }
}
