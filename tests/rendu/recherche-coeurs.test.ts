// Le nombre de cœurs physiques, du pont de l'application de bureau jusqu'à la
// demande que le vrai hook de recherche poste au Worker
// (src/hooks/useBuildOptimSearch.ts) — au navigateur, parce que le hook lit
// le pont dans un effet, que le rendu serveur n'exécute pas.
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

export async function testRenduBureauCoeursRecherche() {
  titre('rendu · bureau — les cœurs physiques arrivent dans la demande au Worker de recherche');
  const { browser, page } = await navigateurOptimizer(false, 'tests/rendu/recherche-coeurs-banc.tsx');
  try {
    const preuves = await page.evaluate(async () => (globalThis as unknown as {
      bancOptimizer: { scenario: () => Promise<[boolean, string][]> };
    }).bancOptimizer.scenario());
    ok(preuves.length > 0, 'scénarios exécutés sur le vrai hook');
    for (const [condition, texte] of preuves) ok(condition, texte);
  } finally {
    await browser.close();
  }
}
