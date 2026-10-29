import type { Page } from 'playwright';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';
import type { OptionsCarte } from './optimizer-carte-resultat-banc';

// Une carte de résultat de l'Optimizer mesurée au navigateur, aux deux
// formats : « Comparer » immobile au clic (l'écart s'affiche à gauche de la
// valeur, à une place réservée), les deux boutons à parts égales au
// téléphone, l'en-tête du bureau (rang et sets à gauche, valeur à droite) et
// la fiche de stats resserrée du bureau sans troncature au pire cas.

const BANC = 'tests/rendu/optimizer-carte-resultat-banc.tsx';
const monter = (page: Page, options: OptionsCarte) => page.evaluate((o) => (globalThis as unknown as { bancOptimizer: { monter: (o: OptionsCarte) => Promise<void> } }).bancOptimizer.monter(o), options);

type Boite = [number, number, number, number];
interface Releve {
  carte: Boite; comparer: Boite | null; valider: Boite; entete: Boite; rang: Boite; set: Boite | null;
  valeur: Boite; ecartMoyen: string; valeurObjectif: Boite | null; ecartObjectif: string; ecartObjectifBoite: Boite | null;
  grille: boolean; debordeCarte: string[]; interieurCarte: [number, number];
}

const relever = (page: Page) => page.evaluate((): Releve => {
  const r = (e: Element | null | undefined): Boite | null => {
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return [Math.round(b.left * 10) / 10, Math.round(b.top * 10) / 10, Math.round(b.width * 10) / 10, Math.round(b.height * 10) / 10];
  };
  const carte = document.querySelector('[data-carte-resultat]')!;
  const bouton = (debut: string) => [...carte.querySelectorAll('button')].find((b) => b.textContent!.trim().startsWith(debut)) ?? null;
  const entete = carte.firstElementChild!;
  const valeur = [...carte.querySelectorAll('span')].find((s) => /^Efficience moyenne :/.test(s.textContent!.trim()) && s.children.length === 0)!;
  const rang = [...entete.querySelectorAll('span')].find((s) => s.textContent === '#2')!;
  const set = [...entete.querySelectorAll('span')].find((s) => s.textContent === 'Swift') ?? null;
  const ligneObjectif = [...carte.querySelectorAll('p')].find((p) => /^(PV effectifs|Dégâts)/.test(p.textContent!.trim()));
  const valeurObjectif = ligneObjectif?.querySelector('.text-star') ?? null;
  // La place de l'écart : le frère qui précède la valeur.
  const ecartObjectif = valeurObjectif?.previousElementSibling ?? null;
  const cb = carte.getBoundingClientRect(), cs = getComputedStyle(carte);
  const debordeCarte = [...carte.querySelectorAll('*')].filter((e) => {
    const b = e.getBoundingClientRect();
    return b.width > 0 && (b.right > cb.right + 0.5 || b.left < cb.left - 0.5);
  }).map((e) => `${e.tagName.toLowerCase()} « ${(e.textContent ?? '').trim().slice(0, 20)} »`);
  return {
    carte: r(carte)!, comparer: r(bouton('Comparer')), valider: r(bouton('Valider'))!, entete: r(entete)!, rang: r(rang)!, set: r(set),
    valeur: r(valeur)!, ecartMoyen: valeur.previousElementSibling?.textContent ?? '',
    valeurObjectif: r(valeurObjectif), ecartObjectif: ecartObjectif?.textContent ?? '', ecartObjectifBoite: r(ecartObjectif),
    grille: [...carte.querySelectorAll('span')].some((s) => s.classList.contains('text-nano') && s.textContent === 'Précision'),
    debordeCarte, interieurCarte: [cb.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), cb.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)],
  };
});

const memeBoite = (a: Boite | null, b: Boite | null) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 0.5);

// Le clic sur « Comparer » : l'écart apparaît à gauche de la valeur, et ni le
// bouton, ni la valeur, ni l'en-tête ne bougent.
async function comparerImmobile(page: Page, format: string) {
  const avant = await relever(page);
  await page.locator('[data-carte-resultat]').getByRole('button', { name: 'Comparer', exact: true }).click();
  await page.waitForTimeout(100);
  const apres = await relever(page);
  ok(!avant.ecartMoyen && !avant.ecartObjectif && !avant.grille && !!apres.ecartMoyen && !!apres.ecartObjectif && apres.grille,
    `${format} : au clic sur « Comparer », les écarts apparaissent (moyenne « ${apres.ecartMoyen} », objectif « ${apres.ecartObjectif} », grille des stats)`);
  ok(memeBoite(avant.comparer, apres.comparer) && memeBoite(avant.valider, apres.valider),
    `${format} : « Comparer » et « Valider ce build » à la même place avant et après le clic (${JSON.stringify(avant.comparer)} → ${JSON.stringify(apres.comparer)})`);
  ok(memeBoite(avant.valeur, apres.valeur) && memeBoite(avant.entete, apres.entete) && memeBoite(avant.valeurObjectif, apres.valeurObjectif),
    `${format} : la valeur moyenne, l'en-tête et la valeur de l'objectif ne bougent pas (en-tête ${avant.entete[3]} → ${apres.entete[3]} px de haut)`);
  const gauche = apres.ecartObjectifBoite ?? [Infinity, 0, 0, 0];
  ok(gauche[0] + gauche[2] <= apres.valeurObjectif![0] + 0.5 && Math.abs(gauche[1] + gauche[3] / 2 - (apres.valeurObjectif![1] + apres.valeurObjectif![3] / 2)) < apres.valeurObjectif![3] / 2,
    `${format} : l'écart de l'objectif à gauche de sa valeur, sur sa ligne (${JSON.stringify(gauche)}, valeur ${JSON.stringify(apres.valeurObjectif)})`);
  return apres;
}

export async function testRenduOptimizerCarteResultatBureau() {
  titre('rendu · carte de résultat de l’Optimizer au bureau — en-tête, « Comparer » immobile, fiche resserrée');
  const { browser, page } = await navigateurOptimizer(false, BANC);
  try {
    // À sa largeur au plancher (328 px), la fiche de stats au pire cas.
    await monter(page, { bureau: true, largeur: 328, boutons: 2, objectif: 'ehp' });
    const fiche = await page.evaluate(() => {
      const zone = document.querySelector('[data-carte-resultat] table')!.parentElement!;
      const table = zone.querySelector('table')!, zs = getComputedStyle(zone);
      const cellules = [...table.querySelectorAll('td')];
      const lignes = [...table.querySelectorAll('tr')].map((tr) => Math.round(tr.getBoundingClientRect().height * 10) / 10);
      return {
        largeur: Math.round(zone.getBoundingClientRect().width), table: Math.round(table.getBoundingClientRect().width),
        place: Math.round(zone.clientWidth - parseFloat(zs.paddingLeft) - parseFloat(zs.paddingRight)),
        coupees: cellules.filter((c) => c.scrollWidth > c.clientWidth + 0.5).map((c) => c.textContent),
        lignes, pv: cellules.slice(0, 3).map((c) => c.textContent),
      };
    });
    // Une ligne repliée grandirait d'un interligne ; seul le trait sous chaque
    // ligne, absent de la dernière, les sépare d'un pixel au plus.
    ok(fiche.largeur === 174 && fiche.table <= fiche.place && fiche.coupees.length === 0 && Math.max(...fiche.lignes) - Math.min(...fiche.lignes) <= 1,
      `bureau : fiche de stats de 174 px, rien de tronqué ni de replié au pire cas (${fiche.pv.join(' ')} ; table ${fiche.table} px pour ${fiche.place}, lignes ${[...new Set(fiche.lignes)].join('/')} px)`);
    const pose = await relever(page);
    ok(pose.debordeCarte.length === 0, `bureau : à 328 px, rien ne sort de la carte (${pose.debordeCarte.slice(0, 3).join(', ') || 'aucun'})`);

    // L'en-tête : le rang et ses sets à gauche, la valeur calée à droite ;
    // les boutons en bas de la carte, sous la fiche.
    const e = pose;
    ok(Math.abs(e.rang[0] - e.interieurCarte[0]) <= 0.5 && !!e.set && e.set[0] > e.rang[0] && e.set[0] + e.set[2] < e.valeur[0]
      && Math.abs(e.valeur[0] + e.valeur[2] - e.interieurCarte[1]) <= 0.5,
      `bureau : en-tête, rang et sets à gauche, valeur à droite (rang ${e.rang[0]}, set ${e.set?.[0]}, valeur ${e.valeur[0]}–${Math.round(e.valeur[0] + e.valeur[2])}, intérieur ${e.interieurCarte.map(Math.round).join('–')})`);
    ok(e.comparer![1] > e.entete[1] + e.entete[3] && Math.abs(e.comparer![1] - e.valider[1]) <= 0.5 && e.comparer![0] + e.comparer![2] <= e.valider[0] && Math.round(e.valider[2]) === 160,
      `bureau : « Comparer » puis « Valider ce build » (160 px) en bas de la carte, côte à côte (${JSON.stringify([e.comparer, e.valider])})`);
    await comparerImmobile(page, 'bureau');

    // Même geste, valeur de l'objectif « Dégâts » et carte plus large.
    await monter(page, { bureau: true, largeur: 480, boutons: 2, objectif: 'degats' });
    await comparerImmobile(page, 'bureau, dégâts, 480 px');
  } finally { await browser.close(); }
}

export async function testRenduOptimizerCarteResultatTelephone() {
  titre('rendu · carte de résultat de l’Optimizer au téléphone — boutons à parts égales, « Comparer » immobile');
  const { browser, page } = await navigateurOptimizer(true, BANC);
  try {
    // 348 px : la carte d'une fenêtre de 390 px.
    await monter(page, { bureau: false, largeur: 348, boutons: 2, objectif: 'ehp' });
    const deux = await relever(page);
    const [g, d] = deux.interieurCarte;
    ok(Math.abs(deux.comparer![2] - deux.valider[2]) <= 1 && Math.abs(deux.comparer![0] - g) <= 0.5 && Math.abs(deux.valider[0] + deux.valider[2] - d) <= 0.5
      && Math.abs(deux.comparer![1] - deux.valider[1]) <= 0.5,
      `téléphone : « Comparer » et « Valider ce build » se partagent la largeur, à parts égales (${deux.comparer![2]} / ${deux.valider[2]} px sur ${Math.round(d - g)})`);
    ok(deux.debordeCarte.length === 0, `téléphone : rien ne sort de la carte (${deux.debordeCarte.slice(0, 3).join(', ') || 'aucun'})`);
    await comparerImmobile(page, 'téléphone');

    await monter(page, { bureau: false, largeur: 348, boutons: 1, objectif: null });
    const un = await relever(page);
    ok(un.comparer === null && Math.abs(un.valider[0] - un.interieurCarte[0]) <= 0.5 && Math.abs(un.valider[0] + un.valider[2] - un.interieurCarte[1]) <= 0.5,
      `téléphone : « Valider ce build » seul prend toute la largeur (${un.valider[2]} px)`);
  } finally { await browser.close(); }
}
