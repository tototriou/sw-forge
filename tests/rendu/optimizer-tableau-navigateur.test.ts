import type { Page } from 'playwright';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
import { SEUIL_TABLEAU_PX } from '../../src/components/outils/optimizer/TableauResultats';
import type { OptionsTableau } from './optimizer-tableau-banc';

// Le tableau des résultats de l'Optimizer mesuré au navigateur, aux valeurs
// les plus larges (PV effectifs et dégâts à six chiffres, PV à cinq, bornes
// « 150000 » et toutes les autres posées) : au seuil retenu, aucun nombre ni
// aucune saisie rognés ; sous lui, les cartes. Le seuil est la largeur
// minimale mesurée du tableau réglé sur son contenu.

const BANC = 'tests/rendu/optimizer-tableau-banc.tsx';
const monter = (page: Page, o: OptionsTableau) => page.evaluate((x) =>
  (globalThis as unknown as { bancOptimizer: { monter: (o: OptionsTableau) => Promise<void> } }).bancOptimizer.monter(x), o);

/** Ce qui est rogné ou sort de sa place dans le tableau (vide : rien). */
const defauts = (page: Page) => page.evaluate(() => {
  const table = document.querySelector('[data-tableau-resultats] table');
  if (!table || table.getBoundingClientRect().width === 0) return ['tableau absent'];
  const cadre = table.parentElement!;
  const pb: string[] = [];
  if (table.scrollWidth > cadre.clientWidth + 0.5) pb.push(`tableau plus large que son cadre (${table.scrollWidth} > ${cadre.clientWidth})`);
  for (const cell of table.querySelectorAll('th, td')) {
    const r = cell.getBoundingClientRect();
    const marcheur = document.createTreeWalker(cell, 4 /* NodeFilter.SHOW_TEXT */);
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const texte = (n.textContent ?? '').trim();
      if (!texte) continue;
      const plage = document.createRange();
      plage.selectNodeContents(n);
      const rects = [...plage.getClientRects()].filter((x) => x.width > 0);
      if (/\d/.test(texte) && rects.length > 1) pb.push(`nombre coupé « ${texte} »`);
      if (rects.some((x) => x.left < r.left - 0.5 || x.right > r.right + 0.5)) pb.push(`texte hors de sa cellule « ${texte} »`);
    }
    for (const champ of cell.querySelectorAll('input')) {
      if (champ.value && champ.scrollWidth > champ.clientWidth + 1) pb.push(`saisie rognée « ${champ.value} »`);
    }
    for (const el of cell.querySelectorAll('button, input, span, div')) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && (b.left < r.left - 0.5 || b.right > r.right + 0.5)) pb.push(`contrôle hors de sa cellule (${el.tagName.toLowerCase()})`);
    }
  }
  return [...new Set(pb)];
});

const largeurTableau = (page: Page) => page.evaluate(() => Math.round(document.querySelector('[data-tableau-resultats] table')!.getBoundingClientRect().width));
const visibles = (page: Page) => page.evaluate(() => ({
  tableau: (document.querySelector('[data-tableau-resultats]')?.getBoundingClientRect().width ?? 0) > 0,
  cartes: (document.querySelector('[data-cartes-repli]')?.getBoundingClientRect().width ?? 0) > 0,
}));

/** La plus petite largeur de conteneur où le tableau seul tient, tout posé, sans rien rogner. */
export async function largeurMinimaleTableau(page: Page): Promise<{ largeur: number; avant: string[] }> {
  const essai = async (w: number) => { await monter(page, { largeur: w, force: true, bornes: 'pleines' }); return defauts(page); };
  if ((await essai(1100)).length) return { largeur: Infinity, avant: await defauts(page) };
  // Dichotomie : rétrécir le conteneur ne fait qu'ajouter des défauts.
  let tient = 1100, rogne = 400;
  while (tient - rogne > 1) {
    const milieu = Math.floor((tient + rogne) / 2);
    if ((await essai(milieu)).length) rogne = milieu; else tient = milieu;
  }
  const avant = await essai(tient - 1);
  if (!avant.length || (await essai(tient)).length) throw new Error(`Largeur minimale non monotone autour de ${tient} px`);
  return { largeur: tient, avant };
}

export async function testRenduOptimizerTableauSansRognage() {
  titre('rendu · tableau des résultats de l’Optimizer — largeur minimale mesurée, aucun nombre ni aucune saisie rognés au seuil');
  const { browser, page } = await navigateurOptimizer(false, BANC);
  try {
    const { largeur, avant } = await largeurMinimaleTableau(page);
    ok(Number.isFinite(largeur) && largeur <= SEUIL_TABLEAU_PX,
      `largeur minimale du tableau : ${largeur} px, valeurs et bornes au plus large (seuil retenu ${SEUIL_TABLEAU_PX} px ; à ${largeur - 1} px : ${avant.slice(0, 3).join(' ; ')})`);
    ok(largeur <= 716, `objectif : le tableau tient dans 716 px (1920 en pleine page) — ${largeur} px`);

    await monter(page, { largeur: SEUIL_TABLEAU_PX, force: false, bornes: 'pleines' });
    const auSeuil = await visibles(page), pb = await defauts(page);
    ok(auSeuil.tableau && !auSeuil.cartes && pb.length === 0,
      `au seuil (${SEUIL_TABLEAU_PX} px) : le tableau, rien de rogné (${pb.slice(0, 3).join(' ; ') || 'aucun défaut'} ; table ${await largeurTableau(page)} px)`);
    await monter(page, { largeur: SEUIL_TABLEAU_PX - 1, force: false, bornes: 'pleines' });
    const dessous = await visibles(page);
    ok(!dessous.tableau && dessous.cartes, `sous le seuil (${SEUIL_TABLEAU_PX - 1} px) : les cartes, pas le tableau`);
    await monter(page, { largeur: 1356, force: false, bornes: 'aucune' });
    ok((await visibles(page)).tableau && (await defauts(page)).length === 0, '2560 pleine page (1356 px) : le tableau, sans défaut');
  } finally { await browser.close(); }
}

export async function testRenduOptimizerTableauEtats() {
  titre('rendu · tableau des résultats — tri par en-tête, minimum > maximum, colonne indisponible');
  const { browser, page } = await navigateurOptimizer(false, BANC);
  try {
    await monter(page, { largeur: 900, force: false, bornes: 'aucune' });
    const tri = () => page.evaluate(() => [...document.querySelectorAll('th[aria-sort]')]
      .filter((t) => t.getAttribute('aria-sort') !== 'none').map((t) => `${t.textContent?.trim()}:${t.getAttribute('aria-sort')}`));
    ok(JSON.stringify(await tri()) === JSON.stringify(['VIT:descending']), `tri de départ annoncé sur son en-tête (${await tri()})`);
    const boite = async (nom: string) => page.getByRole('button', { name: nom }).boundingBox();
    const avantClic = await boite('VIT, tri décroissant');
    await page.getByRole('button', { name: 'VIT, tri décroissant' }).click();
    ok(JSON.stringify(await tri()) === JSON.stringify(['VIT:ascending']), `second clic sur la même tête : croissant (${await tri()})`);
    const apresClic = await boite('VIT, tri croissant');
    ok(!!avantClic && !!apresClic && Math.abs(avantClic.x - apresClic.x) < 0.5 && Math.abs(avantClic.width - apresClic.width) < 0.5,
      'la tête cliquée ne bouge pas et garde sa largeur');
    await page.getByRole('button', { name: 'PV effectifs' }).click();
    ok(JSON.stringify(await tri()) === JSON.stringify(['PV effectifs:descending']), `une autre tête repart en décroissant (${await tri()})`);

    await monter(page, { largeur: 900, force: false, bornes: 'contradictoire' });
    const contradiction = await page.evaluate(() => ({
      champs: [...document.querySelectorAll<HTMLInputElement>('input[aria-label^="VIT "]')].map((i) => i.closest('div')!.className.includes('border-bad')),
      vide: document.querySelector('[data-tableau-resultats] tbody')?.textContent?.trim() ?? '',
      lignes: document.querySelectorAll('[data-tableau-resultats] tbody tr').length,
    }));
    ok(contradiction.champs.length === 2 && contradiction.champs.every(Boolean), 'minimum > maximum : les deux champs de VIT en ton « bad »');
    ok(contradiction.lignes === 1 && /^Vue vide : le minimum de VIT \(220\) dépasse son maximum \(200\)\.$/.test(contradiction.vide),
      `… et la vue vide dite à la place des lignes (« ${contradiction.vide} »)`);

    await monter(page, { largeur: 900, force: false, bornes: 'aucune', sansSort: true });
    const indispo = await page.evaluate(() => {
      const tete = [...document.querySelectorAll('th[aria-sort] button')].find((b) => b.getAttribute('aria-label')?.startsWith('Dégâts réels')) as HTMLButtonElement | undefined;
      const champs = [...document.querySelectorAll<HTMLInputElement>('input[aria-label^="Dégâts réels "]')];
      const index = [...document.querySelectorAll('th[aria-sort]')].findIndex((t) => t.textContent?.includes('Dégâts réels'));
      const cellules = [...document.querySelectorAll('[data-tableau-resultats] tbody tr')].map((tr) => tr.children[index + 1]);
      return { tete: !!tete?.disabled, titre: tete?.title, champs: champs.length === 2 && champs.every((c) => c.disabled),
        cellules: cellules.every((c) => c?.textContent === '—' && c.className.includes('text-ink-dimmer')) };
    });
    ok(indispo.tete && indispo.titre === 'Aucun sort calculable pour ce monstre', 'sans sort calculable : en-tête « Dégâts réels » grisé, la raison au survol');
    ok(indispo.champs && indispo.cellules, 'sans sort calculable : bornes inactives, colonne grisée, aucune valeur inventée');
  } finally { await browser.close(); }
}
