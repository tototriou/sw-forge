// Mode preuve de l'application de bureau — `SWBLACKSMITH_PREUVE=<dossier>`.
//
// L'app se contrôle elle-même DE L'INTÉRIEUR (origine, stockage, données,
// worker, cloisonnement), prend des captures, écrit `resultats.json`, puis se
// ferme. C'est la preuve rejouable des lots du chantier application-bureau
// (`npm run bureau:preuve`) : on n'affirme pas « ça marche », on le relit.
// Sans la variable, ce module ne fait rien.

import { app, BrowserWindow } from 'electron';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function capturer(fenetre: BrowserWindow, fichier: string) {
  const image = await fenetre.webContents.capturePage();
  writeFileSync(fichier, image.toPNG());
}

export async function lancerPreuve(fenetre: BrowserWindow, dossier: string, racine: string) {
  mkdirSync(dossier, { recursive: true });
  const resultats: Record<string, unknown> = {};
  const js = (code: string) => fenetre.webContents.executeJavaScript(code, true);
  try {
    if (fenetre.webContents.isLoading()) {
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    }
    await attendre(2500);
    resultats.origine = await js('location.origin');
    resultats.titre = fenetre.getTitle();
    resultats.stockage = await js(`(() => {
      try {
        localStorage.setItem('swblacksmith-preuve', '1');
        const lu = localStorage.getItem('swblacksmith-preuve') === '1';
        localStorage.removeItem('swblacksmith-preuve');
        return lu;
      } catch (e) { return String(e); }
    })()`);
    resultats.prechargement = await js('JSON.stringify(window.swblacksmithBureau ?? null)');
    resultats.nodeDansLaPage = await js('typeof require + " / " + typeof process');
    resultats.fetchDonnees = await js(
      `fetch('/data/monsters.json').then((r) => r.status).catch((e) => 'erreur ' + e)`
    );
    // Un fichier qui EXISTE hors du build (`package.json`, à la racine du
    // dépôt), visé par `..` + barre encodée — la forme que l'analyse de l'URL
    // ne résout pas : le protocole doit répondre 404.
    resultats.horsRacineEncode = await js(
      `fetch('/..%2Fpackage.json').then((r) => r.status).catch((e) => 'erreur ' + e)`
    );
    const worker = readdirSync(join(racine, 'assets')).find((n) => /^runeBuildOptim\.worker-.*\.js$/.test(n));
    resultats.worker = worker
      ? await js(`new Promise((r) => {
          const w = new Worker('/assets/${worker}', { type: 'module' });
          w.onerror = (e) => r('erreur ' + (e.message || ''));
          setTimeout(() => { w.terminate(); r('ok : ${worker}'); }, 2000);
        })`)
      : 'aucun worker dans le build';
    await capturer(fenetre, join(dossier, 'accueil.png'));
    await js(`location.hash = '#/bestiary'`);
    await attendre(2500);
    // Le compteur du Bestiaire (« 2 859 monstres ») : les données sont lues.
    resultats.bestiaire = await js(`document.body.innerText.match(/[0-9][0-9\\s\\u202f\\u00a0]* monstres/)?.[0] ?? 'aucun compteur'`);
    await capturer(fenetre, join(dossier, 'bestiaire.png'));
  } catch (e) {
    resultats.erreur = String(e);
  } finally {
    writeFileSync(join(dossier, 'resultats.json'), JSON.stringify(resultats, null, 2));
    app.quit();
  }
}
