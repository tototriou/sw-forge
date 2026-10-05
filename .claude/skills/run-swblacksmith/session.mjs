// Brique commune aux pilotages de SW Blacksmith : ouvrir Chromium, importer un
// compte, puis rendre la main — on va ENSUITE où l'on veut. Utilisée par
// driver.mjs (scénario Optimizer, ou `--import-seul`) et par tout script
// jetable de démonstration.
//
//   import { ouvrirSession, DEV_URL } from '<dépôt>/.claude/skills/run-swblacksmith/session.mjs';
//   const { browser, page } = await ouvrirSession({ compte, format: 'telephone' });
//   await page.goto(`${DEV_URL}/#/compte/runes/optimisation`);
//
// ⚠️ Un script jetable peut vivre HORS du dépôt (scratchpad) : c'est CE module,
// dans le dépôt, qui importe `playwright` — la résolution se fait depuis ici.
// Il suffit de l'importer par son chemin absolu.

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');

// `SW_FORGE_URL`, l'ancien nom de la variable, reste lu en repli.
export const DEV_URL = process.env.SWBLACKSMITH_URL ?? process.env.SW_FORGE_URL ?? 'http://localhost:5173';

// ⚠️ Aucun de ces fichiers n'est commité (gitignorés — voir .gitignore,
// `tototriou-*.json`/`*Enzo-*.json`/`*account*.json`) : ce sont de VRAIS
// exports de compte des développeurs de ce dépôt.
export const COMPTES_CANDIDATS = ['tototriou-12889591.json', 'ß☆Enzo-6399149.json'];

// Le compte à importer : celui passé en argument, sinon le premier export réel
// trouvé à la racine. `undefined` si aucun — à l'appelant de le dire.
export function trouverCompte(explicite) {
  if (explicite) return existsSync(explicite) ? explicite : undefined;
  return COMPTES_CANDIDATS.map((f) => path.join(REPO_ROOT, f)).find(existsSync);
}

// Les deux formats de premier rang (voir CLAUDE.md). Le bureau reste LARGE :
// sous ~1 100 px l'écran bascule en disposition mobile et DÉPLACE des
// contrôles (gotcha « Fenêtre étroite » de SKILL.md).
const FORMATS = {
  bureau: { width: 1400, height: 1000 },
  telephone: { width: 390, height: 844 },
};

// ⚠️ Conteneur Linux (claude.ai/code) : Chromium y est préinstallé dans
// /opt/pw-browsers, mais pour une AUTRE version de Playwright que celle du
// dépôt — `launch()` échoue alors en réclamant `npx playwright install`. On
// retombe sur le binaire préinstallé plutôt que d'en télécharger un.
const CHROMIUM_PREINSTALLE = '/opt/pw-browsers/chromium';
export async function lancerChromium() {
  return chromium.launch().catch((err) => {
    if (!existsSync(CHROMIUM_PREINSTALLE)) throw err;
    return chromium.launch({ executablePath: CHROMIUM_PREINSTALLE });
  });
}

// Importe `compte` dans `page` et ferme la boîte de consentement.
//
// ⚠️ PAS par le premier `input[type=file]` de l'accueil : c'est l'import RTA,
// il ne charge aucun compte et ne lève aucune erreur. Au bureau, bouton
// « Importer un compte » de la barre latérale (SidebarCompte.tsx), dont on
// intercepte le sélecteur natif ; au téléphone la barre est repliée, on vise
// l'input `accept=json` du pied (le dernier de la page).
export async function importerCompte(page, compte) {
  await page.goto(`${DEV_URL}/#/compte/runes`, { waitUntil: 'networkidle' });
  const bouton = page.getByRole('button', { name: 'Importer un compte' }).filter({ visible: true }).first();
  if (await bouton.isVisible().catch(() => false)) {
    const [selecteur] = await Promise.all([page.waitForEvent('filechooser'), bouton.click()]);
    await selecteur.setFiles(compte);
  } else {
    await page.locator('input[type="file"][accept*="json"]').last().setInputFiles(compte);
  }
  await page.waitForTimeout(2500);
  // Boîte de consentement (IndexedDB) au tout premier import de la session
  // navigateur — voir Gotchas dans SKILL.md.
  const garder = page.getByRole('button', { name: /Garder mes données/ });
  if (await garder.isVisible().catch(() => false)) await garder.click();
  await page.waitForTimeout(300);
  // Un import refusé ne lève rien : on le détecte à l'écran.
  if (await page.getByText('Aucune donnée de compte chargée').isVisible().catch(() => false)) {
    throw new Error(
      `Import refusé pour ${path.basename(compte)} — un compte factice doit porter les listes RTA (voir SKILL.md)`
    );
  }
}

// Chromium + page au format voulu + compte importé : la page est rendue prête,
// à l'appelant d'aller où il veut. `deviceScaleFactor: 2` rend les libellés
// lisibles une fois la capture réduite.
export async function ouvrirSession({ compte, format = 'bureau', echelle = 1 } = {}) {
  const browser = await lancerChromium();
  const page = await browser.newPage({ viewport: FORMATS[format], deviceScaleFactor: echelle });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console.error]', msg.text());
  });
  console.log(`→ import ${path.basename(compte)} (${format})`);
  await importerCompte(page, compte);
  return { browser, page };
}
