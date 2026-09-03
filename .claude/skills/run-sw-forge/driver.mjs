// Pilote SW Forge dans un vrai Chromium (Playwright) pour prouver qu'un
// changement d'écran fonctionne réellement, pas seulement `tsc`/`npm test`.
// Voir SKILL.md dans ce même dossier pour le mode d'emploi complet.
//
// Usage : node .claude/skills/run-sw-forge/driver.mjs [compte.json] [monstre] [set]
//   compte.json — export de compte réel (gitignoré). Défaut : le premier
//                 trouvé parmi ACCOUNT_CANDIDATES ci-dessous.
//   monstre     — nom du monstre à sélectionner dans l'Optimizer. Défaut "Lora".
//   set         — libellé du set de runes recherché (voir RUNE_SETS dans
//                 src/types.ts, ex. "Fatal", "Violent", "Will"). Défaut "Fatal".
//
// Écrit ses captures dans .claude/skills/run-sw-forge/screenshots/.

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const SHOT_DIR = path.join(HERE, 'screenshots');
mkdirSync(SHOT_DIR, { recursive: true });
const shot = (n) => path.join(SHOT_DIR, n);

const DEV_URL = process.env.SW_FORGE_URL ?? 'http://localhost:5173';

// ⚠️ Aucun de ces fichiers n'est commité (gitignorés — voir .gitignore,
// `tototriou-*.json`/`*Enzo-*.json`/`*account*.json`) : ce sont de VRAIS
// exports de compte des développeurs de ce dépôt. Sans l'un d'eux présent
// à la racine, ce driver ne peut prouver qu'un chargement de page à vide
// (voir SKILL.md, section Gotchas, « Fixture synthétique »).
const ACCOUNT_CANDIDATES = ['tototriou-12889591.json', 'ß☆Enzo-6399149.json'];

const accountFile = process.argv[2] ?? ACCOUNT_CANDIDATES.map((f) => path.join(REPO_ROOT, f)).find(existsSync);
const monsterName = process.argv[3] ?? 'Lora';
const setLabel = process.argv[4] ?? 'Fatal';

if (!accountFile || !existsSync(accountFile)) {
  console.error(
    `Aucun export de compte réel trouvé (cherché : ${ACCOUNT_CANDIDATES.join(', ')} à la racine du dépôt).\n` +
      `Passe un chemin explicite : node driver.mjs <compte.json> [monstre] [set]\n` +
      `Sans ça, la démonstration de recherche (>20 résultats, pagination) n'a rien à charger.`
  );
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on('pageerror', (err) => console.error('[pageerror]', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[console.error]', msg.text());
});

console.log(`→ ${DEV_URL}`);
await page.goto(DEV_URL, { waitUntil: 'networkidle' });

console.log(`→ import ${path.basename(accountFile)}`);
await page.locator('input[type="file"]').first().setInputFiles(accountFile);
await page.waitForTimeout(2500);
// ⚠️ Boîte de dialogue de consentement (IndexedDB) au tout premier import
// de la session navigateur — voir Gotchas dans SKILL.md.
const keepBtn = page.getByRole('button', { name: /Garder mes données/ });
if (await keepBtn.isVisible().catch(() => false)) await keepBtn.click();
await page.waitForTimeout(300);

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
// bouton « + Set » à cliquer d'abord (existait dans une version antérieure
// de l'UI, retiré depuis ; ce driver appelait encore ce bouton fantôme
// jusqu'à ce qu'une vérification réelle échoue dessus). Un clic = TOUT le
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
