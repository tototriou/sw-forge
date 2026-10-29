import { navigateurOptimizer } from './optimizer-navigable-banc';
import { egal, ok, titre } from '../outils';

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
    // La grille ouverte, dans son coffre en creux : Set secondaire sur 4
    // colonnes, les deux groupes au même écart des deux bords du coffre.
    const coffre = await page.evaluate(() => {
      const titreSecondaire = [...document.querySelectorAll('p')].find((p) => p.textContent === 'Set secondaire')!;
      const groupe = titreSecondaire.parentElement!, boite = groupe.parentElement!;
      const b = boite.getBoundingClientRect(), s = getComputedStyle(boite);
      const premier = boite.firstElementChild!.getBoundingClientRect(), dernier = groupe.getBoundingClientRect();
      return {
        colonnes: getComputedStyle(titreSecondaire.nextElementSibling!).gridTemplateColumns.split(' ').length,
        principales: getComputedStyle(boite.firstElementChild!.querySelector('.grid')!).gridTemplateColumns.split(' ').length,
        gauche: Math.round(premier.left - b.left - parseFloat(s.paddingLeft)), droite: Math.round(b.right - parseFloat(s.paddingRight) - dernier.right),
        contour: s.borderTopWidth, fond: s.backgroundColor,
      };
    });
    ok(coffre.principales === 3 && coffre.colonnes === 4 && Math.abs(coffre.gauche - coffre.droite) <= 1 && coffre.contour === '0px' && coffre.fond !== 'rgba(0, 0, 0, 0)',
      `set : coffre centré, sans contour, grilles de 3 + 4 colonnes (${JSON.stringify(coffre)})`);
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

// Ce que la place reçue décide, mesuré au navigateur : la largeur de « Valider
// ce build » (celle de la fiche telle qu'affichée) et la rangée de
// « Rechercher » dans la forme large du bloc.
export async function testRenduOptimizerGabaritsLargeurs() {
  titre('rendu · gabarits de l’Optimizer — fiche de l’exemplaire et rangée de « Rechercher » selon la place');
  const { browser, page } = await navigateurOptimizer(false, 'tests/rendu/optimizer-gabarits-banc.tsx');
  const monterA = (nom: string, largeur: number) => `globalThis.bancOptimizer.monter(${JSON.stringify(nom)}, ${largeur})`;
  try {
    // La fiche reste repliée au bureau, même si son contenant s'élargit.
    const fiche = () => page.evaluate(() => {
      const bouton = document.querySelector('[data-valider]')!.getBoundingClientRect();
      const racine = document.querySelector('[data-valider]')!.parentElement!.querySelector('.flex-wrap')!;
      const [stats, groupe] = [...racine.children].map((e) => e.getBoundingClientRect());
      const r = (n: number) => Math.round(n);
      // [gauche, droite, haut, bas]
      return { bouton: [r(bouton.left), r(bouton.right)], stats: [r(stats.left), r(stats.right), r(stats.top), r(stats.bottom)], groupe: [r(groupe.left), r(groupe.right), r(groupe.top)] };
    });
    await page.evaluate(monterA('exemplaire', 598));
    await page.waitForTimeout(100);
    const largeFiche = await fiche();
    const largeurFiche = Math.max(largeFiche.stats[1] - largeFiche.stats[0], largeFiche.groupe[1] - largeFiche.groupe[0]);
    ok(largeFiche.groupe[2] >= largeFiche.stats[3] && Math.abs(largeFiche.bouton[1] - largeFiche.bouton[0] - largeurFiche) <= 1,
      `exemplaire à 598 px : fiche repliée, Valider à la largeur de la plus large rangée (${JSON.stringify(largeFiche)})`);
    await page.evaluate(monterA('exemplaire', 420));
    await page.waitForTimeout(100);
    const replie = await fiche();
    const plusLarge = Math.max(replie.stats[1] - replie.stats[0], replie.groupe[1] - replie.groupe[0]);
    ok(replie.groupe[2] >= replie.stats[3] && Math.abs(replie.bouton[1] - replie.bouton[0] - plusLarge) <= 1,
      `exemplaire à 420 px : fiche repliée, « Valider ce build » à la largeur de sa rangée la plus large, ${plusLarge} px (${JSON.stringify(replie)})`);
    ok(JSON.stringify(replie) === JSON.stringify(largeFiche), 'exemplaire : élargir son contenant ne change ni la fiche ni le bouton');

    // « Rechercher », forme large : à droite d'« Exporter » · « Importer » sur
    // leur rangée ; dessous, pleine largeur, quand la rangée fait moins de 448 px.
    const rangee = () => page.evaluate(() => {
      const b = (n: string) => [...document.querySelectorAll('button')].find((e) => e.textContent?.trim() === n)!.getBoundingClientRect();
      const rechercher = b('Rechercher'), importer = b('Importer');
      return { rechercher: [Math.round(rechercher.left), Math.round(rechercher.top), Math.round(rechercher.width)], importer: [Math.round(importer.right), Math.round(importer.top), Math.round(importer.bottom)] };
    });
    await page.evaluate(monterA('objectif', 600));
    const large = await rangee();
    ok(large.rechercher[2] === 240 && large.rechercher[0] > large.importer[0] && large.rechercher[1] < large.importer[2],
      `objectif à 600 px : « Rechercher », 240 px, sur la rangée, à droite d'« Importer » (${JSON.stringify(large)})`);
    await page.evaluate(monterA('objectif', 420));
    const etroit = await rangee();
    ok(etroit.rechercher[1] >= etroit.importer[2] && etroit.rechercher[2] === 420,
      `objectif à 420 px : « Rechercher » sous « Exporter » · « Importer », pleine largeur (${JSON.stringify(etroit)})`);

    await page.setViewportSize({ width: 2048, height: 1000 });
    for (const [largeur, configuration, colonnes, onglets] of [
      [1800, 'colonnes', ['criteres', 'artefacts', 'complements'], []],
      [1500, 'criteres-et-groupe', ['criteres', 'artefacts'], ['Artéfacts', 'Options']],
      [1200, 'groupe', ['criteres'], ['Critères', 'Artéfacts', 'Options']],
      [752, 'deux-piles', ['criteres'], ['Critères', 'Artéfacts', 'Options']],
    ] as const) {
      await page.evaluate(monterA('page', largeur));
      const racine = page.locator('[data-configuration]');
      egal(await racine.getAttribute('data-configuration'), configuration, `${largeur} px : configuration mesurée`);
      egal(await racine.locator('[data-colonne]').evaluateAll(es => es.map(e => e.getAttribute('data-colonne'))), [...colonnes], `${configuration} : réglages présents dans l'ordre`);
      egal(await racine.getByRole('tab').locator('[data-libelle-onglet]').allTextContents(), [...onglets], `${configuration} : seuls les réglages rangés ont un onglet`);
      ok(await racine.locator('[data-zone="monstre"]').isVisible() && await racine.locator('[data-zone="resultats"]').isVisible(), `${configuration} : Monstre et résultats visibles`);
      const confinement = await racine.evaluate(e => ({
        hauteur: Math.abs(e.getBoundingClientRect().bottom - (innerHeight - 16)) <= 1,
        deborde: e.scrollWidth > e.clientWidth + 1,
        panneaux: [...e.querySelectorAll<HTMLElement>('[data-zone="monstre"], [data-zone="pile-droite"], [data-colonne], [data-zone="resultats"]')]
          .filter(p => getComputedStyle(p).overflowY === 'auto').map(p => ({
            contient: getComputedStyle(p).overscrollBehaviorY === 'contain',
            defile: p.scrollHeight > p.clientHeight,
          })),
      }));
      ok(confinement.hauteur && !confinement.deborde && confinement.panneaux.length >= 2
        && confinement.panneaux.every(p => p.contient && p.defile), `${configuration} : hauteur visible, largeur contenue et défilements indépendants (${JSON.stringify(confinement)})`);
      if (onglets.length) {
        const options = racine.getByRole('tab', { name: 'Options', exact: true });
        const avant = await options.boundingBox();
        await options.click();
        egal(await options.boundingBox(), avant, `${configuration} : cliquer Options ne déplace pas l'onglet`);
        await options.click();
        ok(await options.getAttribute('aria-selected') === 'true', `${configuration} : recliquer garde Options ouvert`);
        egal(await racine.getByRole('tabpanel').getAttribute('aria-label'), 'Aura, exclusion, avancés', `${configuration} : panneau correspondant à Options`);
      }
    }
    // Redimensionner la même page conserve un onglet encore présent ; quand
    // le groupe disparaît, son retour repart du premier onglet.
    await page.getByRole('tab', { name: 'Options', exact: true }).click();
    await page.locator('[data-configuration]').evaluate(e => { e.parentElement!.style.width = '1500px'; });
    await page.waitForTimeout(100);
    ok(await page.getByRole('tab', { name: 'Options', exact: true }).getAttribute('aria-selected') === 'true', 'redimensionnement : Options reste dans le groupe et reste actif');
    await page.locator('[data-configuration]').evaluate(e => { e.parentElement!.style.width = '1800px'; });
    await page.waitForTimeout(100);
    egal(await page.getByRole('tab').count(), 0, 'cinq colonnes : aucun onglet');
    await page.locator('[data-configuration]').evaluate(e => { e.parentElement!.style.width = '1200px'; });
    await page.waitForTimeout(100);
    ok(await page.getByRole('tab', { name: 'Critères', exact: true }).getAttribute('aria-selected') === 'true', 'retour du groupe : son premier onglet, sans ressusciter Options');
  } finally { await browser.close(); }
}
