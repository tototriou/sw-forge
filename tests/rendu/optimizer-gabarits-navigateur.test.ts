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
    // Toutes les valeurs du slot 4, liste ouverte : le champ s'allonge sous la
    // surface, qui ne bouge pas (elle garde la place prise à l'ouverture).
    const champ4 = page.getByRole('button', { name: /^Slot 4 :/ });
    const avantTout = { champ: (await champ4.boundingBox())!, surface: (await surface.boundingBox())! };
    for (const v of ['PV%', 'ATQ%', 'DEF%', 'Dmg Crit']) await surface.getByRole('button', { name: v, exact: true }).click();
    const apresTout = { champ: (await champ4.boundingBox())!, surface: (await surface.boundingBox())! };
    ok(apresTout.surface.y === avantTout.surface.y && apresTout.champ.y === avantTout.champ.y,
      `principales : cinq choix, liste ouverte, ni le champ ni la surface ne bougent (surface ${avantTout.surface.y} → ${apresTout.surface.y}, champ ${avantTout.champ.height} → ${apresTout.champ.height} px de haut)`);
    await page.keyboard.press('Escape');
    const resume = await champ4.evaluate((b) => {
      const t = b.querySelector('[data-resume-entier]') as HTMLElement;
      return { texte: t.innerText.replace(/\s+/g, ' '), entier: t.scrollWidth <= t.clientWidth && b.scrollHeight <= b.clientHeight, lignes: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)) };
    });
    ok(resume.texte === 'PV%, ATQ%, DEF%, Taux Crit, Dmg Crit' && resume.entier && resume.lignes === 2,
      `principales : fermé, les cinq valeurs se lisent en entier, sur deux lignes (« ${resume.texte} », ${resume.lignes} ligne(s))`);
    const rangees = await page.evaluate(() => {
      const section = document.querySelector('section[aria-label^="Statistique principale"]')!;
      return [...section.querySelectorAll('button[aria-haspopup]')].map((b) => {
        // bouton → liste (racine `relative`) → sa case → la rangée, dont le nom est le premier enfant.
        const nom = b.parentElement!.parentElement!.parentElement!.firstElementChild!;
        return { libelle: nom.textContent, aGauche: nom.getBoundingClientRect().right <= b.getBoundingClientRect().left, hauteur: Math.round(b.getBoundingClientRect().height) };
      });
    });
    ok(rangees.length === 3 && rangees.every((r) => r.aGauche) && rangees[0].hauteur === rangees[2].hauteur && rangees[1].hauteur > rangees[0].hauteur,
      `principales : rangées « Slot n [liste] », le nom à gauche ; « Libre » sur une ligne, le slot 4 plein sur deux (${rangees.map((r) => `${r.libelle} ${r.hauteur} px`).join(', ')})`);

    // État de mon monstre : l'aide du bureau, colonne des buffs centrée.
    await page.evaluate(monter('etat'));
    await page.getByRole('button', { name: 'État de mon monstre' }).click();
    await page.waitForTimeout(100);
    const aide = await page.evaluate(() => document.body.innerText);
    ok(aide.includes('compétences d’invocateur') || aide.includes('compétences d\'invocateur'), 'état : l’aide du titre s’ouvre');
    ok(!aide.includes('sets d\'aura') && !aide.includes('sets d’aura'), 'état : l’aide du bureau ne nomme pas les sets d’aura');
    ok(!aide.includes('décrit le combat'), 'état : l’aide du bureau n’a pas le paragraphe sur le combat');
    const rangee = await page.evaluate(() => {
      const section = document.querySelector('section[aria-label="État de mon monstre"]')!.getBoundingClientRect();
      const buffs = ['Buff ATQ', 'Buff DEF', 'Buff VIT'].map((n) => document.querySelector(`[aria-label^="${n}"]`)!.getBoundingClientRect());
      const stat = document.querySelector('[aria-label="Type de leader skill"]') as HTMLSelectElement;
      return {
        memeLigne: buffs.every((b) => Math.abs(b.top - buffs[0].top) < 1), dedans: buffs.every((b) => b.left >= section.left - 0.5 && b.right <= section.right + 0.5),
        largeurs: buffs.map((b) => Math.round(b.width)), statEntiere: stat.scrollWidth <= stat.clientWidth + 1 && stat.getBoundingClientRect().right <= section.right + 0.5,
      };
    });
    ok(rangee.memeLigne && rangee.dedans, `état : les trois buffs sur une rangée, dans la sous-colonne (${rangee.largeurs.join(' / ')} px)`);
    ok(rangee.statEntiere, 'état : la liste du lead n’est plus coupée, dans la sous-colonne');
  } finally { await browser.close(); }
}
