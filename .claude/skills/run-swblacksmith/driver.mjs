// Pilote SW Blacksmith dans un vrai Chromium (Playwright) pour prouver qu'un
// changement d'écran fonctionne réellement, pas seulement `tsc`/`npm test`.
// Voir SKILL.md dans ce même dossier pour le mode d'emploi complet.
//
// Deux usages :
//
//   node .claude/skills/run-swblacksmith/driver.mjs [compte.json] [monstre] [set]
//     Scénario Optimizer : import, monstre + set, recherche, pagination.
//     compte.json — export de compte (défaut : le premier export réel trouvé à
//                   la racine, voir COMPTES_CANDIDATS dans session.mjs).
//     monstre     — nom du monstre à sélectionner. Défaut "Lushen".
//     set         — libellé du set de runes recherché (voir RUNE_SETS dans
//                   src/types.ts, ex. "Fatal", "Violent", "Will"). Défaut "Fatal".
//
//   node .claude/skills/run-swblacksmith/driver.mjs --import-seul [compte.json] [route] [--telephone]
//     Import SEUL, puis la route voulue (hash, ex. "#/compte/runes/optimisation" ;
//     défaut "#/compte/runes") et une capture `import.png`. Pour aller plus
//     loin qu'une capture, un script jetable importe `ouvrirSession` de
//     session.mjs et reprend la main juste après l'import.
//
// Écrit ses captures dans .claude/skills/run-swblacksmith/screenshots/.

import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEV_URL, COMPTES_CANDIDATS, ouvrirSession, trouverCompte } from './session.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(HERE, 'screenshots');
mkdirSync(SHOT_DIR, { recursive: true });
const shot = (n) => path.join(SHOT_DIR, n);

const args = process.argv.slice(2);
const importSeul = args.includes('--import-seul');
const telephone = args.includes('--telephone');
const positionnels = args.filter((a) => !a.startsWith('--'));

const accountFile = trouverCompte(positionnels[0]);
if (!accountFile) {
  console.error(
    `Aucun export de compte trouvé (${positionnels[0] ?? `cherché : ${COMPTES_CANDIDATS.join(', ')} à la racine du dépôt`}).\n` +
      `Passe un chemin explicite : node driver.mjs [--import-seul] <compte.json> …`
  );
  process.exit(1);
}

if (importSeul) {
  const route = positionnels[1] ?? '#/compte/runes';
  const { browser, page } = await ouvrirSession({
    compte: accountFile,
    format: telephone ? 'telephone' : 'bureau',
    echelle: 2,
  });
  console.log(`→ ${route}`);
  await page.goto(`${DEV_URL}/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot('import.png') });
  await browser.close();
  console.log(`OK — compte importé, capture de ${route} dans ${shot('import.png')}`);
  process.exit(0);
}

const monsterName = positionnels[1] ?? 'Lushen';
const setLabel = positionnels[2] ?? 'Fatal';

// Fenêtre large : le scénario vise la copie BUREAU de l'Optimizer (`.first()`
// plus bas), et la barre latérale d'import n'existe qu'à ce format.
const { browser, page } = await ouvrirSession({ compte: accountFile });

console.log('→ #/outils/optimizer');
await page.goto(`${DEV_URL}/#/outils/optimizer`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: shot('01-optimizer.png') });

console.log(`→ choisir ${monsterName}`);
// ⚠️ `exact: true` NE SUFFIT PAS, et le picker d'exclusion n'y est pour rien
// (il dit toujours « … à exclure »). Ce placeholder existe en DOUBLE parce que
// l'écran rend le MÊME champ deux fois — bloc bureau (`hidden lg:grid`) et
// bloc mobile (`lg:hidden`), deux dispositions de premier rang, voir
// OptimizerSection.tsx ~l. 2138. `.first()` = la copie bureau, la seule
// visible à ce viewport ; `.last()` viserait l'invisible. Détail et forme
// robuste aux deux formats : SKILL.md, gotcha « rendu DEUX FOIS ».
await page.getByPlaceholder('Rechercher un monstre…').first().fill(monsterName);
await page.waitForTimeout(300);
const firstOption = page.getByRole('option').first();
if (!(await firstOption.isVisible().catch(() => false))) {
  await page.screenshot({ path: shot('error-no-monster-match.png') });
  throw new Error(`Aucun monstre trouvé pour "${monsterName}" dans ce compte — voir error-no-monster-match.png`);
}
await firstOption.click();
await page.waitForTimeout(300);

console.log(`→ set ${setLabel}`);
// ⚠️ Grille de sets TOUJOURS déployée (voir SetComboPicker.tsx) — PAS de
// bouton « + Set » à cliquer d'abord : l'UI n'en a pas, et un driver qui
// l'attendrait échouerait sur un bouton fantôme. Un clic = TOUT le
// set d'un coup (le tableau `sets` contient des CLÉS de set, pas des
// pièces individuelles — voir setsCost/canAddSet dans src/lib/effects.ts).
// Cliquer plusieurs fois désactive le bouton dès que le set est complet et
// bloque le driver — piège vécu en écrivant ceci.
await page.locator(`[title="${setLabel}"]`).click();
await page.waitForTimeout(300);
await page.screenshot({ path: shot('02-monster-and-set.png') });

console.log('→ Rechercher');
await page.getByRole('button', { name: 'Rechercher' }).click();
await page.waitForSelector('text=/combinaison\\(s\\) trouvée\\(s\\)/', { timeout: 120_000 });
// Le bouton redevient "Rechercher" (au lieu de "Recherche…") seulement une
// fois la recherche RÉELLEMENT terminée, pas juste l'aperçu en direct.
await page.waitForFunction(
  () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Rechercher'),
  { timeout: 60_000 }
);
await page.waitForTimeout(400);
await page.screenshot({ path: shot('03-results.png'), fullPage: true });

// Pagination — si plus d'une page, la piloter pour de vrai (pas juste
// vérifier qu'elle s'affiche) : suivant, puis saisie directe d'un numéro.
const nextBtn = page.getByLabel('Page suivante');
if (await nextBtn.isVisible().catch(() => false)) {
  const paginationBar = nextBtn.locator('..');
  await paginationBar.scrollIntoViewIfNeeded();
  await paginationBar.screenshot({ path: shot('04-pagination-page1.png') });

  await nextBtn.click();
  await page.waitForTimeout(300);
  await paginationBar.screenshot({ path: shot('05-pagination-page2.png') });

  const pageInput = page.getByLabel('Aller à la page');
  await pageInput.fill('3');
  await pageInput.press('Enter');
  await page.waitForTimeout(300);
  await paginationBar.screenshot({ path: shot('06-pagination-page3.png') });
}

await browser.close();
console.log(`OK — captures dans ${SHOT_DIR}`);
