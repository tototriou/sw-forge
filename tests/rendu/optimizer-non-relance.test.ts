import type { Page } from 'playwright';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { egal, ok, titre } from '../outils';
import type * as Banc from './optimizer-non-relance-banc';

const BANC = 'tests/rendu/optimizer-non-relance-banc.tsx';
type B = typeof Banc;
const appel = <K extends keyof B>(page: Page, nom: K, ...args: Parameters<B[K]>) => page.evaluate(
  ([n, a]) => (globalThis as unknown as { bancOptimizer: Record<string, (...x: unknown[]) => unknown> }).bancOptimizer[n](...a),
  [nom, args] as [string, unknown[]]) as Promise<Awaited<ReturnType<B[K]>>>;

/** Rechercher (le vrai bouton), puis attendre la page vérifiée et la file vide. */
const journaux = new WeakMap<Page, string[]>();
async function rechercher(page: Page) {
  if (!journaux.has(page)) { const j: string[] = []; journaux.set(page, j); page.on('console', m => { if (m.type() === 'error') j.push(m.text()); }); }
  await page.getByRole('button', { name: 'Rechercher', exact: true }).first().click();
  for (let i = 0; i < 200; i++) {
    const r = await appel(page, 'releve');
    if (r.status === 'done' && r.enAttente === 0 && r.cartes.length > 0) return r;
    await page.waitForTimeout(25);
  }
  throw new Error(`Recherche sans page vérifiée : ${JSON.stringify(await appel(page, 'releve')).slice(0, 300)} — console : ${journaux.get(page)?.join(' | ')}`);
}

async function nonRelance(telephone: boolean) {
  const format = telephone ? 'téléphone' : 'ordinateur';
  titre(`rendu · Optimizer — seul Rechercher relance la recherche ou l’équipement, ${format}`);
  const { browser, page } = await navigateurOptimizer(telephone, BANC);
  try {
    await appel(page, 'monter');
    const lance = await rechercher(page);
    ok(lance.recherches === 1 && lance.idRecherche === 1 && lance.cartes.length === 20 && lance.recus === 64,
      `${format} : un vrai clic sur Rechercher lance une recherche, 64 builds, page de vingt cartes (${JSON.stringify({ ...lance, contexte: undefined })})`);
    const cartesAvant = [...lance.cartes].sort();
    for (const nom of ['stats', 'maximums', 'objectif', 'sets', 'toutVerifier', 'tri'] as const) {
      await appel(page, 'gesteNomme', nom);
      await page.waitForTimeout(300);
      const r = await appel(page, 'releve');
      egal([r.recherches, r.idRecherche, r.resolus, r.status], [1, 1, lance.resolus, 'done'],
        `${format} — ${nom} : aucune recherche ni résolution relancée`);
      ok(r.contexte === lance.contexte, `${format} — ${nom} : contexte et équipement du résultat conservés`);
      if (nom === 'tri') ok(r.cartes.length === lance.cartes.length, `${format} — tri : la page se réordonne sans rien vérifier de plus (${r.cartes.length} cartes)`);
      else egal([...r.cartes].sort(), cartesAvant, `${format} — ${nom} : mêmes cartes affichées`);
    }
    const avant = await appel(page, 'releve');
    egal(avant.toutVerifierPhoto, false, `${format} : « Vérifier toutes les combinaisons » reste celui du lancement`);
    const relance = await rechercher(page);
    ok(relance.recherches === 2 && relance.idRecherche === 2 && relance.contexte !== lance.contexte,
      `${format} : Rechercher relance bien une nouvelle recherche, avec son nouveau contexte`);
    ok(relance.toutVerifierPhoto === true && JSON.stringify(relance.minStatsPhoto).includes('"spd":101'),
      `${format} : les réglages modifiés entrent dans la photographie de la nouvelle recherche seulement`);
    await appel(page, 'gesteNomme', 'monstre');
    await page.waitForTimeout(300);
    const monstre = await appel(page, 'releve');
    egal([monstre.recherches, monstre.idRecherche, monstre.cartes.length, monstre.status], [2, null, 0, 'idle'],
      `${format} — monstre de la liste : résultats effacés, rien relancé`);
    await appel(page, 'remonter');
    await page.waitForTimeout(500);
    const rafraichi = await appel(page, 'releve');
    egal([rafraichi.recherches, rafraichi.classeurs, rafraichi.status], [0, 0, 'idle'],
      `${format} — rafraîchir : l’écran remonté ne crée ni recherche ni classeur`);
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
    const tri = page.locator('select').filter({ hasText: 'Trier par' });
    ok(await tri.count() === 1 && await tri.isDisabled(), `${format} : le tri est désactivé`);
    ok(await page.getByRole('button', { name: 'Page suivante' }).isDisabled() && await page.getByLabel('Aller à la page').isDisabled(),
      `${format} : la pagination est désactivée`);
    await page.getByRole('button', { name: 'Rechercher', exact: true }).first().click();
    for (let i = 0; i < 200 && (await appel(page, 'releve')).status !== 'done'; i++) await page.waitForTimeout(25);
    const relance = await appel(page, 'releve');
    ok(relance.status === 'done' && !relance.interrompu && relance.classeurs === 2 && relance.recherches === 2,
      `${format} : seul Rechercher crée un nouveau classeur, la page n’est plus interrompue`);
  } finally { await browser.close(); }
}

export async function testRenduOptimizerNonRelanceBureau() { await nonRelance(false); }
export async function testRenduOptimizerNonRelanceTelephone() { await nonRelance(true); }
export async function testRenduOptimizerPageInterrompueBureau() { await interrompue(false); }
export async function testRenduOptimizerPageInterrompueTelephone() { await interrompue(true); }
