import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

async function transition(nom: string, telephone = false) {
  titre(`rendu · Optimizer mémoire — ${nom}${telephone ? ' au téléphone' : ' au bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  try {
    if (telephone) ok(await page.evaluate(() => window.innerWidth) === 390, 'largeur de mise en page téléphone : 390 px');
    const preuves = await page.evaluate(async (scenario) => {
      const banc = (globalThis as unknown as { bancOptimizer: { scenario: (nom: string) => Promise<[boolean, string][]> } }).bancOptimizer;
      return banc.scenario(scenario);
    }, nom);
    ok(preuves.length > 0, 'scénario exécuté avec de vrais hooks et un écran monté');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally { await browser.close(); }
}

export const testRenduMemoireOptimizerSelection = () => transition('selection');
export const testRenduMemoireOptimizerSansMemoire = () => transition('sans-memoire');
export const testRenduMemoireOptimizerListes = () => transition('listes');
export const testRenduMemoireOptimizerRetrait = () => transition('retrait');
export const testRenduMemoireOptimizerInclusion = () => transition('inclusion');
export const testRenduMemoireOptimizerHorsListe = () => transition('hors-liste');
export const testRenduMemoireOptimizerIdentite = () => transition('identite');
export const testRenduMemoireOptimizerRecette = () => transition('recette');
export const testRenduMemoireOptimizerNavigation = () => transition('navigation');
export const testRenduTelephoneMemoireOptimizer = () => transition('navigation', true);
export const testRenduMemoireOptimizerSaisies = () => transition('saisies');
export const testRenduMemoireOptimizerAutomatismes = () => transition('automatismes');
export const testRenduMemoireOptimizerRappelAurasDestination = () => transition('auras-destination');
export const testRenduTelephoneMemoireOptimizerRappelAurasDestination = () => transition('auras-destination', true);
export const testRenduMemoireOptimizerZoneC = () => transition('zone-c');
export const testRenduTelephoneMemoireOptimizerZoneC = () => transition('zone-c', true);
export const testRenduMemoireOptimizerListeInactive = () => transition('liste-inactive');
export const testRenduMemoireOptimizerRecetteSansSelection = () => transition('recette-sans-selection');
export const testRenduMemoireOptimizerGlobauxAvantRestauration = () => transition('globaux-restauration');
export const testRenduMemoireOptimizerSourceRta = () => transition('source-rta');
export const testRenduMemoireOptimizerSourceSiege = () => transition('source-siege');

async function inclusion(genre: 'ajout' | 'fiche' | 'carte', telephone = false) {
  titre(`rendu · Optimizer mémoire — inclusion par clic ${genre}${telephone ? ' au téléphone' : ''}`);
  const { browser, page } = await navigateurOptimizer(telephone);
  type Banc = { preparerInclusion: (genre: string) => Promise<[boolean, string][]>; verifierInclusion: () => Promise<[boolean, string][]> };
  try {
    const avant = await page.evaluate(async genre => (globalThis as unknown as { bancOptimizer: Banc }).bancOptimizer.preparerInclusion(genre), genre);
    for (const [condition, texte] of avant) ok(condition, texte);
    if (genre === 'ajout') {
      if (telephone) await page.getByRole('button', { name: 'Monstres à optimiser' }).click();
      await page.getByRole('button', { name: 'Ajouter Second à « Alpha »', exact: true }).click();
    } else {
      if (genre === 'carte') await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
      const boutons = page.getByRole('button', { name: 'Valider ce build', exact: true });
      if (genre === 'carte') {
        await boutons.nth(1).waitFor();
        ok(await boutons.count() === 2, 'fiche et carte distinctes : clic sur la carte de résultat');
        await boutons.nth(1).click();
      } else await boutons.first().click();
    }
    const apres = await page.evaluate(() => (globalThis as unknown as { bancOptimizer: Banc }).bancOptimizer.verifierInclusion());
    for (const [condition, texte] of apres) ok(condition, texte);
    if (genre !== 'ajout') {
      ok(await page.getByRole('button', { name: 'Validé', exact: true }).count() > 0, 'validation effective indiquée dans le rendu');
    }
  } finally { await browser.close(); }
}
export const testRenduMemoireOptimizerClicAjouter = () => inclusion('ajout');
export const testRenduMemoireOptimizerClicValiderFiche = () => inclusion('fiche');
export const testRenduMemoireOptimizerClicValiderInclut = () => inclusion('carte');
export const testRenduTelephoneMemoireOptimizerClicAjouter = () => inclusion('ajout', true);
export const testRenduTelephoneMemoireOptimizerClicValiderFiche = () => inclusion('fiche', true);
export const testRenduRattachementOptimizer = () => transition('rattachement');
export const testRenduTelephoneRattachementOptimizer = () => transition('rattachement', true);
export const testRenduRattachementOptimizerDemonte = () => transition('rattachement-demonte');
export const testRenduMemoireOptimizerIdentiteEnregistree = () => transition('identite-enregistree');
