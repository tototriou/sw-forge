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
    // Toutes les valeurs du slot 4, liste ouverte : ni le champ ni la surface ne bougent.
    const champ4 = page.getByRole('button', { name: /^Slot 4 :/ });
    const avantTout = { champ: (await champ4.boundingBox())!, surface: (await surface.boundingBox())! };
    for (const v of ['PV%', 'ATQ%', 'DEF%', 'Dmg Crit']) await surface.getByRole('button', { name: v, exact: true }).click();
    const apresTout = { champ: (await champ4.boundingBox())!, surface: (await surface.boundingBox())! };
    ok(apresTout.champ.height === avantTout.champ.height && apresTout.surface.y === avantTout.surface.y,
      `principales : cinq choix, liste ouverte, rien ne bouge (champ ${avantTout.champ.height} → ${apresTout.champ.height} px, surface ${avantTout.surface.y} → ${apresTout.surface.y})`);
    await page.keyboard.press('Escape');
    const resume = await champ4.evaluate((b) => {
      const t = b.querySelector(':scope > span > span:not([data-reserve-resume])') as HTMLElement;
      return { texte: t.innerText.replace(/\s+/g, ' '), entier: t.scrollWidth <= t.clientWidth && b.scrollHeight <= b.clientHeight, lignes: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)) };
    });
    ok(resume.texte === 'PV%, ATQ%, DEF%, Taux Crit, Dmg Crit' && resume.entier && resume.lignes === 2,
      `principales : fermé, les cinq valeurs se lisent en entier, sur deux lignes (« ${resume.texte} », ${resume.lignes} ligne(s))`);

    // Dans une carte plus haute que son contenu, les trois listes s'espacent.
    await page.evaluate(monter('principales-haute'));
    const espaces = await page.evaluate(() => {
      const champs = [...document.querySelectorAll('section[aria-label^="Statistique principale"] button[aria-haspopup]')].map((b) => b.getBoundingClientRect());
      const carte = document.querySelector('section[aria-label^="Statistique principale"]')!.getBoundingClientRect();
      return { carte: carte.height, ecarts: champs.slice(1).map((c, i) => Math.round(c.top - champs[i].bottom)), basDernier: Math.round(carte.bottom - champs[2].bottom) };
    });
    ok(espaces.carte === 420 && espaces.ecarts[0] === espaces.ecarts[1] && espaces.ecarts[0] > 40 && espaces.basDernier === 13,
      `principales : carte de 420 px, listes réparties dans sa hauteur (écarts ${espaces.ecarts.join(' / ')} px, dernière au bas de la carte)`);

    // État de mon monstre : l'aide du bureau, colonne des buffs centrée.
    await page.evaluate(monter('etat'));
    await page.getByRole('button', { name: 'État de mon monstre' }).click();
    await page.waitForTimeout(100);
    const aide = await page.evaluate(() => document.body.innerText);
    ok(aide.includes('compétences d’invocateur') || aide.includes('compétences d\'invocateur'), 'état : l’aide du titre s’ouvre');
    ok(!aide.includes('sets d\'aura') && !aide.includes('sets d’aura'), 'état : l’aide du bureau ne nomme pas les sets d’aura');
    ok(!aide.includes('décrit le combat'), 'état : l’aide du bureau n’a pas le paragraphe sur le combat');
    const centre = await page.evaluate(() => {
      const carte = document.querySelector('section[aria-label="État de mon monstre"]')!.getBoundingClientRect();
      const buffs = document.querySelector('[aria-label^="Buff ATQ"]')!.closest('.w-20')!.getBoundingClientRect();
      return Math.abs((buffs.left + buffs.right) / 2 - (carte.left + carte.right) / 2);
    });
    ok(centre < 1, `état : la colonne des buffs est centrée dans la carte (écart ${centre.toFixed(1)} px)`);
  } finally { await browser.close(); }
}
