// `node scripts/preuve-session-site.mjs [dossier]` — la sauvegarde de session
// sur le SITE (spec/shared/sauvegarde-session.md), dans Chromium (Playwright),
// sur le build (`dist/`, `npm run build` d'abord). Le pendant de
// `npm run bureau:preuve -- --session` pour l'application de bureau.
//
// Compte de test importé, conservation ACCEPTÉE (l'app de bureau prouve le
// refus), un exemplaire de l'Optimizer pris en défense de siège et suivi à
// travers un changement de page, puis « Sauvegarder » des Paramètres et
// « Sauvegarder la session » de la palette. Chaque fichier téléchargé est relu
// par le vrai `lireSession`. Jamais de capture d'écran. Code de sortie 1 si
// un verdict échoue.
//
// Dossier par défaut : `preuve-session-site` dans `dist-bureau` (gitignoré).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { preview } from 'vite';

const sortie = resolve(process.argv[2] ?? 'dist-bureau/preuve-session-site');
rmSync(sortie, { recursive: true, force: true });
mkdirSync(sortie, { recursive: true });

// `lireSession`, empaqueté par esbuild (comme tests/run.mjs).
const paquet = await build({ entryPoints: ['src/lib/session.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const { lireSession } = await import('data:text/javascript;base64,' + Buffer.from(paquet.outputFiles[0].text).toString('base64'));

const serveur = await preview({ preview: { port: 4317, strictPort: true }, logLevel: 'silent' });
const adresse = 'http://localhost:4317/';
const navigateur = await chromium.launch();
const res = {};
try {
  const page = await navigateur.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  await page.goto(adresse);
  await page.waitForTimeout(2000);
  // Le compte de test, une retouche près : ses deux monstres placés en
  // défense de siège (101, 102) sont des monstres de matériau, que la
  // recherche de l'Optimizer ne propose pas. L'unité 101 y devient une
  // Cassie (19315, comme l'unité 103) : deux exemplaires, dont un en siège.
  const compte = JSON.parse(readFileSync('tests/fixtures/compte-miniature.json', 'utf8'));
  const unite101 = compte.unit_list.find((u) => u.unit_id === 101);
  unite101.unit_master_id = 19315;
  const fichierCompte = join(sortie, 'compte-preuve.json');
  writeFileSync(fichierCompte, JSON.stringify(compte));
  await page.locator('input[type="file"][accept*="json"]').first().setInputFiles(fichierCompte);
  await page.getByRole('button', { name: 'Garder mes données (recommandé)' }).click({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  res.disque = await page.evaluate(() => ({
    conservation: localStorage.getItem('swblacksmith-persist-v1'),
    prepaRta: localStorage.getItem('swblacksmith-rta-v1')?.length ?? null,
  }));
  await page.evaluate(() => (location.hash = '#/siege/defense'));
  await page.waitForTimeout(1200);

  // L'exemplaire de l'Optimizer : Cassie, prise dans une
  // défense de siège plutôt que dans la box ; puis un aller-retour par une
  // autre page — avant, l'écran revenait sur la box.
  await page.evaluate(() => (location.hash = '#/outils/optimizer'));
  await page.waitForTimeout(1500);
  const recherche = page.locator('input[placeholder="Rechercher un monstre…"]:visible').first();
  await recherche.click();
  await recherche.pressSequentially('Cassie', { delay: 30 });
  await page.waitForTimeout(400);
  await page.locator('[role="option"]', { hasText: 'Cassie' }).first().dispatchEvent('mousedown');
  await page.waitForTimeout(600);
  const puceActive = () =>
    page.evaluate(() => [...document.querySelectorAll('button[aria-pressed="true"]')]
      .filter((b) => b.offsetParent !== null && /^(Box|RTA|Défenses siège|Offenses siège)/.test(b.textContent.trim()))
      .map((b) => b.textContent.trim()));
  res.exemplaireAuChoix = await puceActive();
  await page.locator('button:visible', { hasText: /^Défenses siège/ }).first().click();
  await page.waitForTimeout(500);
  // Plusieurs équipes : la zone D s'ouvre, on prend la dernière proposée.
  const zoneD = page.locator('button:visible:has-text("Cassie")');
  if ((await zoneD.count()) > 1) await zoneD.last().click();
  await page.waitForTimeout(500);
  res.exemplaireChoisi = await puceActive();
  await page.evaluate(() => (location.hash = '#/rta'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => (location.hash = '#/outils/optimizer'));
  await page.waitForTimeout(1500);
  res.exemplaireAuRetour = await puceActive();

  await page.evaluate(() => (location.hash = '#/parametres'));
  await page.waitForTimeout(1200);
  const bouton = page.getByRole('button', { name: 'Sauvegarder', exact: true });
  await bouton.scrollIntoViewIfNeeded();

  // Un téléchargement, relu par `lireSession`.
  const relire = async (declencher, nom) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10_000 }), declencher()]);
    const chemin = join(sortie, nom);
    await dl.saveAs(chemin);
    const texte = readFileSync(chemin, 'utf8');
    const lu = lireSession(texte);
    if (!lu.ok) return { erreur: lu.erreur };
    const disque = await page.evaluate(() => localStorage.getItem('swblacksmith-rta-v1'));
    return {
      nomPropose: dl.suggestedFilename(),
      taille: texte.length,
      avertissements: lu.avertissements,
      cles: Object.keys(lu.session.stockage),
      invocateur: lu.session.compte?.wizardName ?? null,
      memoire: Object.keys(lu.session.outils.memoire),
      optimizer: lu.session.outils.optimizer ? Object.keys(lu.session.outils.optimizer) : null,
      exemplaire: lu.session.outils.optimizer
        ? { source: lu.session.outils.optimizer.gearSource, selecteur: lu.session.outils.optimizer.sourceSelector }
        : null,
      // Conservation acceptée : la prépa RTA de la session = celle du disque.
      rtaCommeLeDisque: lu.session.stockage['swblacksmith-rta-v1'] === disque,
    };
  };
  res.reglages = await relire(() => bouton.click(), 'depuis-reglages.json');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('sauv');
  await page.waitForTimeout(300);
  res.palette = await relire(() => page.getByRole('option', { name: /Sauvegarder la session/ }).click(), 'depuis-palette.json');

  // L'exemplaire disparu entre-temps : les défenses de siège supprimées, le
  // retour sur l'Optimizer retombe sur la box, jamais sur une fiche vide.
  await page.keyboard.press('Escape');
  await page.evaluate(() => (location.hash = '#/siege/defense'));
  await page.waitForTimeout(1200);
  const supprimer = page.locator('button[aria-label="Supprimer l\'équipe"]:visible');
  res.equipesSupprimees = 0;
  while ((await supprimer.count()) > 0 && res.equipesSupprimees < 10) {
    await supprimer.first().click();
    res.equipesSupprimees++;
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => (location.hash = '#/outils/optimizer'));
  await page.waitForTimeout(1500);
  res.exemplaireApresSuppression = await puceActive();

  // Au téléphone : la ligne « Session » et son bouton, visibles.
  const tel = await navigateur.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await tel.goto(adresse + '#/parametres');
  await tel.waitForTimeout(1500);
  res.telephone = await tel.getByRole('button', { name: 'Sauvegarder', exact: true }).isVisible();
} catch (e) {
  res.erreur = String(e);
} finally {
  await navigateur.close();
  await new Promise((r) => serveur.httpServer.close(r));
}

console.log(JSON.stringify(res, null, 2));
const r = res.reglages ?? {};
const verdicts = {
  'conservation acceptée, travail sur le disque': res.disque?.conservation === '1' && res.disque?.prepaRta > 0,
  'Paramètres : fichier daté, relu par lireSession, sans avertissement':
    /^swblacksmith-session-\d{4}-\d\d-\d\d-\d\dh\d\d\.json$/.test(r.nomPropose ?? '') && r.avertissements?.length === 0,
  'le travail, le compte, la mémoire des écrans, l’Optimizer (27 champs)':
    r.cles?.includes('swblacksmith-rta-v1') && r.invocateur === 'Testeur' && r.memoire?.includes('siege.checkTicks.defense') && r.optimizer?.length === 27,
  'Optimizer : l’exemplaire pris en défense de siège':
    res.exemplaireAuChoix?.[0]?.startsWith('Box') && res.exemplaireChoisi?.[0]?.startsWith('Défenses siège'),
  'l’exemplaire survit au changement de page': res.exemplaireAuRetour?.[0]?.startsWith('Défenses siège'),
  'la session garde l’exemplaire': r.exemplaire?.source === 'siege-defense' && r.exemplaire?.selecteur?.source === 'siege-defense',
  'exemplaire disparu (défenses supprimées) : retour sur la box':
    res.equipesSupprimees > 0 && res.exemplaireApresSuppression?.[0]?.startsWith('Box'),
  'sans les préférences d’interface': Array.isArray(r.memoire) && !r.memoire.includes('sidebar.retractee'),
  'prépa RTA identique au disque': r.rtaCommeLeDisque === true,
  'Ctrl K : fichier relu par lireSession, sans avertissement': res.palette?.avertissements?.length === 0,
  'au téléphone : la ligne « Session » et son bouton': res.telephone === true,
  'aucune erreur': !res.erreur,
};
for (const [quoi, bon] of Object.entries(verdicts)) console.log(`${bon ? 'ok' : 'KO'}  ${quoi}`);
process.exit(Object.values(verdicts).every(Boolean) ? 0 : 1);
