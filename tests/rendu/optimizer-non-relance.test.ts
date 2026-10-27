import type { Page } from 'playwright';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { egal, ok, titre } from '../outils';
import type * as Banc from './optimizer-non-relance-banc';

const BANC = 'tests/rendu/optimizer-non-relance-banc.tsx';
type B = typeof Banc;
const appel = <K extends keyof B>(page: Page, nom: K, ...args: Parameters<B[K]>) => page.evaluate(
  ([n, a]) => (globalThis as unknown as { bancOptimizer: Record<string, (...x: unknown[]) => unknown> }).bancOptimizer[n](...a),
  [nom, args] as [string, unknown[]]) as Promise<Awaited<ReturnType<B[K]>>>;

/**
 * Rechercher (le vrai bouton), puis attendre la page vérifiée, la file vide et
 * chaque reçu jugé : noté par la file, ou confirmé en fond au-delà.
 */
const journaux = new WeakMap<Page, string[]>();
async function rechercher(page: Page) {
  if (!journaux.has(page)) { const j: string[] = []; journaux.set(page, j); page.on('console', m => { if (m.type() === 'error') j.push(m.text()); }); }
  await page.getByRole('button', { name: 'Rechercher', exact: true }).first().click();
  return await toutJuge(page);
}
/** Jusqu'à 30 s : la confirmation en fond, ou avec « Vérifier toutes les combinaisons » la note, des 729 builds. */
async function toutJuge(page: Page) {
  for (let i = 0; i < 1200; i++) {
    const r = await appel(page, 'releve');
    if (r.status === 'done' && r.enAttente === 0 && r.cartes.length > 0 && r.recus !== null && r.resolus === r.recus) return r;
    await page.waitForTimeout(25);
  }
  throw new Error(`Recherche sans page vérifiée ni reçus tous jugés : ${JSON.stringify(await appel(page, 'releve')).slice(0, 300)} — console : ${journaux.get(page)?.join(' | ')}`);
}

async function nonRelance(telephone: boolean) {
  const format = telephone ? 'téléphone' : 'ordinateur';
  titre(`rendu · Optimizer — seul Rechercher relance la recherche ou l’équipement, vrais gestes, ${format}`);
  const { browser, page, recharger } = await navigateurOptimizer(telephone, BANC);
  try {
    await appel(page, 'monter', true);
    const lance = await rechercher(page);
    // La file note les K premiers, le fond confirme tous les autres sans note.
    const notes = lance.demandes.resoudre;
    ok(lance.recherches === 1 && lance.idRecherche === 1 && lance.cartes.length === 20 && lance.recus === 729
      && lance.resolus === 729 && lance.confirmees === 729 && notes >= 100 && notes < 729 && lance.demandes.confirmer > 0,
      `${format} : un vrai clic sur Rechercher lance une recherche, 729 builds, page de vingt cartes, notes arrêtées à K, le reste confirmé en fond (${notes} notes, ${lance.demandes.confirmer} confirmations, ${lance.confirmees} confirmées)`);
    const cartesAvant = [...lance.cartes].sort();
    const inchange = async (nom: string, memesCartes = true) => {
      await page.waitForTimeout(600);
      const r = await appel(page, 'releve');
      egal([r.recherches, r.idRecherche, r.demandes, r.resolus, r.status], [1, 1, lance.demandes, lance.resolus, 'done'],
        `${format} — ${nom} : aucune recherche ni résolution relancée (ni note ni confirmation demandée)`);
      ok(r.contexte === lance.contexte, `${format} — ${nom} : contexte et équipement du résultat conservés`);
      if (memesCartes) egal([...r.cartes].sort(), cartesAvant, `${format} — ${nom} : mêmes cartes affichées`);
      return r;
    };
    // Réglages de recherche : ils ne préparent que la prochaine recherche.
    for (const nom of ['stats', 'maximums', 'objectif', 'sets'] as const) { await appel(page, 'gesteNomme', nom); await inchange(nom); }
    // « Vérifier toutes les combinaisons trouvées », le vrai interrupteur, après le lancement :
    // 729 builds au-delà de K, une lecture en direct demanderait aussitôt des résolutions.
    // Au bureau, l'interrupteur vit dans la colonne « Aura, exclusion, avancés », ouverte par son onglet ;
    // au téléphone, dans le panneau que la barre de l'app ouvre (absente du banc).
    const onglet = page.getByRole('group', { name: 'Colonnes repliables' }).getByRole('button', { name: 'Aura, exclusion, avancés', exact: true });
    if (telephone) await appel(page, 'menuTelephone', true); else await onglet.click();
    const interrupteur = page.getByRole('switch', { name: 'Vérifier toutes les combinaisons trouvées' });
    await interrupteur.click();
    ok(await interrupteur.getAttribute('aria-checked') === 'true', `${format} : l’interrupteur est activé par un vrai clic`);
    const tout = await inchange('vérifier toutes les combinaisons');
    if (telephone) await appel(page, 'menuTelephone', false); else await onglet.click();
    egal(tout.toutVerifierPhoto, false, `${format} : « Vérifier toutes les combinaisons » reste celui du lancement dans le contexte`);
    // Tri : la tête PV de la bande au bureau, le sélecteur de l'en-tête au téléphone.
    if (telephone) await page.locator('select').filter({ hasText: 'Trier par' }).selectOption('hp');
    else await page.getByRole('group', { name: 'Trier les résultats' }).getByRole('button', { name: 'PV', exact: true }).click();
    const tri = await inchange('tri', false);
    ok(tri.tri === 'hp' && tri.resultsPage === 1 && tri.cartes.length === 20 && tri.places === 0,
      `${format} — tri : la page 1 se réordonne sans rien vérifier de plus (${tri.cartes.length} cartes)`);
    // Une borne d'affichage, posée puis relâchée au clavier dans « Filtrer
    // l'affichage » : rien n'est relancé ni résolu, et les mêmes cartes reviennent.
    await page.getByRole('button', { name: "Filtrer l'affichage", exact: true }).filter({ visible: true }).first().click();
    const vit = page.locator('input[aria-label="VIT minimum affiché"]').filter({ visible: true }).first();
    await vit.fill('9999');
    await inchange('borne posée', false);
    await vit.fill('');
    const relache = await inchange('borne relâchée', false);
    egal([...relache.cartes].sort(), [...tri.cartes].sort(), `${format} — borne relâchée : les mêmes cartes reviennent`);
    if (telephone) await page.getByRole('button', { name: 'Fermer', exact: true }).filter({ visible: true }).first().click();
    else await page.keyboard.press('Escape');
    // Mesure changée pendant la vérification d'une page au-delà des builds notés : la page revient à 1.
    // Toutes confirmées en fond, le nombre de pages est exact : 999 mène à la dernière, rangs 721 à 729.
    const aller = page.getByLabel('Aller à la page');
    await aller.fill('999'); await aller.press('Tab');
    let loin = await appel(page, 'releve');
    for (let i = 0; i < 80 && loin.premierRang !== (loin.resultsPage - 1) * 20 + 1; i++) { await page.waitForTimeout(25); loin = await appel(page, 'releve'); }
    ok(loin.resultsPage === Math.ceil(729 / 20) && (loin.premierRang ?? 0) > notes,
      `${format} — navigation (vrai champ « Aller à la page ») : page ${loin.resultsPage}, la dernière, au-delà des ${notes} builds notés (premier rang ${loin.premierRang})`);
    await page.getByRole('button', { name: 'Score SW', exact: true }).click();
    await page.waitForTimeout(600);
    const mesure = await appel(page, 'releve');
    ok(mesure.metric === 'score' && mesure.resultsPage === 1 && mesure.premierRang === 1 && mesure.places === 0 && mesure.cartes.length === 20,
      `${format} — mesure (vrai contrôle « Score ») : la page revient à 1, vingt cartes, aucune place laissée sans travail (${JSON.stringify({ page: mesure.resultsPage, places: mesure.places, enAttente: mesure.enAttente })})`);
    egal([mesure.recherches, mesure.idRecherche, mesure.contexte === lance.contexte], [1, 1, true], `${format} — mesure : aucune recherche relancée, contexte conservé`);
    const relance = await rechercher(page);
    ok(relance.recherches === 2 && relance.idRecherche === 2 && relance.contexte !== lance.contexte,
      `${format} : Rechercher relance bien une nouvelle recherche, avec son nouveau contexte`);
    ok(relance.toutVerifierPhoto === true && JSON.stringify(relance.minStatsPhoto).includes('"spd":101'),
      `${format} : les réglages modifiés entrent dans la photographie de la nouvelle recherche seulement`);
    // Monstre : un vrai clic sur un autre membre de la liste de travail (au téléphone,
    // la liste se déplie d'abord par « Gérer mes listes »).
    const membre = page.locator('[data-membre-optimizer="10102"]');
    if (telephone && !await membre.isVisible()) await page.getByText('Gérer mes listes', { exact: true }).click();
    await page.locator('[data-membre-optimizer="10102"]').getByText('Second', { exact: true }).click();
    await page.waitForTimeout(300);
    const monstre = await appel(page, 'releve');
    egal([monstre.recherches, monstre.idRecherche, monstre.cartes.length, monstre.status, monstre.membre], [2, null, 0, 'idle', '2'],
      `${format} — monstre de la liste (vrai clic) : résultats effacés, rien relancé`);
    // Rafraîchir : un vrai rechargement du document ; la liste gardée revient, rien ne se relance.
    await recharger();
    await appel(page, 'apresRechargement');
    await page.waitForTimeout(500);
    const rafraichi = await appel(page, 'releve');
    egal([rafraichi.recherches, rafraichi.classeurs, rafraichi.status, rafraichi.listes], [0, 0, 'idle', 1],
      `${format} — rafraîchir (page.reload) : la liste gardée revient, ni recherche ni classeur créé`);
  } finally { await browser.close(); }
}

async function interrompue(telephone: boolean) {
  const format = telephone ? 'téléphone' : 'ordinateur';
  titre(`rendu · Optimizer — classeur perdu : dernière page gardée, marquée interrompue, actions désactivées, ${format}`);
  const { browser, page } = await navigateurOptimizer(telephone, BANC);
  try {
    await appel(page, 'monter');
    await rechercher(page);
    const cartes = page.locator('[data-carte-resultat]');
    const avant = await cartes.allInnerTexts();
    ok(avant.length === 20 && await cartes.first().getByRole('button', { name: 'Comparer', exact: true }).isEnabled(),
      `${format} : avant la panne, vingt cartes et leurs gestes actifs`);
    await appel(page, 'perdreClasseur');
    const r = await appel(page, 'releve');
    ok(r.status === 'error' && r.interrompu && r.cartes.length === 20, `${format} : statut d’erreur, dernière page gardée et marquée interrompue`);
    egal(await cartes.allInnerTexts(), avant, `${format} : la page affichée est exactement la dernière reçue`);
    ok(await page.getByText('Classement interrompu : relance la recherche pour agir sur ces résultats.').isVisible(),
      `${format} : l’avis « Classement interrompu » est visible`);
    ok(await page.getByText('La recherche a échoué. Réessaie avec des critères moins stricts.').count() > 0, `${format} : le message d’échec existant s’affiche`);
    const comparer = cartes.getByRole('button', { name: 'Comparer', exact: true });
    const valider = cartes.getByRole('button', { name: 'Valider ce build', exact: true });
    const desactives = async (l: typeof comparer) => (await Promise.all((await l.all()).map(b => b.isDisabled()))).every(Boolean);
    ok(await comparer.count() === 20 && await desactives(comparer), `${format} : « Comparer » garde sa place, désactivé sur les vingt cartes`);
    ok(await valider.count() === 20 && await desactives(valider), `${format} : « Valider ce build » garde sa place, désactivé sur les vingt cartes`);
    // Le tri : la liste au téléphone, les onze têtes de la bande au bureau.
    const tri = telephone ? page.locator('select').filter({ hasText: 'Trier par' })
      : page.getByRole('group', { name: 'Trier les résultats' }).getByRole('button');
    ok(await tri.count() === (telephone ? 1 : 11) && await desactives(tri), `${format} : le tri est désactivé`);
    const filtres = page.getByRole('button', { name: "Filtrer l'affichage", exact: true }).filter({ visible: true });
    ok(await filtres.count() === 1 && await filtres.isDisabled(), `${format} : « Filtrer l'affichage » est désactivé`);
    ok(await page.getByRole('button', { name: 'Page suivante' }).isDisabled() && await page.getByLabel('Aller à la page').isDisabled(),
      `${format} : la pagination est désactivée`);
    await page.getByRole('button', { name: 'Rechercher', exact: true }).first().click();
    for (let i = 0; i < 200 && (await appel(page, 'releve')).status !== 'done'; i++) await page.waitForTimeout(25);
    const relance = await appel(page, 'releve');
    ok(relance.status === 'done' && !relance.interrompu && relance.classeurs === 2 && relance.recherches === 2,
      `${format} : seul Rechercher crée un nouveau classeur, la page n’est plus interrompue`);

    // Page au-delà des builds notés, entamée (des cartes et des places « Vérification… »),
    // puis classeur perdu : plus rien ne remplira ces places. La confirmation en fond
    // finit d'abord : les réponses retenues ensuite sont celles des notes de la page.
    await toutJuge(page);
    await appel(page, 'retenirResolutionsApres', 3);
    await appel(page, 'perdreClasseurSurPageEntamee');
    // La file a noté les K = 100 premiers : la page 6 (rangs 101 à 120) est la première
    // au-delà des notés, et ce sont ses builds que la navigation fait noter. Plus loin, une
    // page attendrait que tous les rangs avant elle soient notés (les cartes sont les notés
    // conformes, dans l'ordre réel) : la dernière ne s'entamerait qu'après 720 notes.
    const aller = page.getByLabel('Aller à la page');
    await aller.fill('6'); await aller.press('Tab');
    // Trois réponses passent sous la cadence de 400 ms ; la suivante, relâchée après, publie la page entamée.
    await page.waitForTimeout(600);
    await appel(page, 'relacherUneResolution');
    for (let i = 0; i < 200 && (await appel(page, 'releve')).status !== 'error'; i++) await page.waitForTimeout(25);
    const entamee = await appel(page, 'releve');
    ok(entamee.status === 'error' && entamee.interrompu && (entamee.premierRang ?? 1) > 1 && entamee.cartes.length > 0
      && entamee.cartes.length < 20 && (entamee.places ?? 0) > 0,
      `${format} : page ${entamee.resultsPage} interrompue après réception de ${entamee.cartes.length} carte(s) et ${entamee.places} place(s) en attente (statut ${entamee.status}${entamee.interrompu ? ', interrompu' : ''}, ${entamee.resolus}/${entamee.recus} jugés)`);
    egal(await cartes.count(), entamee.cartes.length, `${format} : la page interrompue non pleine garde ses cartes`);
    egal([await page.locator('[aria-busy="true"]').count(), await page.getByText('Vérification…', { exact: true }).count()], [0, 0],
      `${format} : aucune place « Vérification… » sous la page interrompue`);
    ok(await page.getByText('Classement interrompu : relance la recherche pour agir sur ces résultats.').isVisible(),
      `${format} : l’avis « Classement interrompu » est visible sur la page non pleine`);
    ok(await page.getByRole('button', { name: 'Page précédente' }).isDisabled() && await page.getByLabel('Aller à la page').isDisabled(),
      `${format} : la pagination de la page non pleine est désactivée`);
  } finally { await browser.close(); }
}

export async function testRenduOptimizerNonRelanceBureau() { await nonRelance(false); }
export async function testRenduOptimizerNonRelanceTelephone() { await nonRelance(true); }
export async function testRenduOptimizerPageInterrompueBureau() { await interrompue(false); }
export async function testRenduOptimizerPageInterrompueTelephone() { await interrompue(true); }
