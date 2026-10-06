// Mode preuve de l'application de bureau — `SWBLACKSMITH_PREUVE=<dossier>`.
//
// L'app se contrôle elle-même DE L'INTÉRIEUR (origine, stockage, données,
// worker, cloisonnement, habillage de la fenêtre), prend des captures, écrit
// `resultats.json`, puis se ferme. C'est la preuve rejouable des lots du
// chantier application-bureau (`npm run bureau:preuve`) : on n'affirme pas
// « ça marche », on le relit. Sans la variable, ce module ne fait rien.
//
// ⚠️ Ses données (stockage, état de la fenêtre) vivent dans `<dossier>/donnees`
// (voir main.ts) : une preuve ne touche jamais celles de l'utilisateur.

import { app, BrowserWindow, desktopCapturer } from 'electron';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PreuveMiseAJour } from './miseAJour';

// Ce que les branchements enregistrent en mode preuve : la navigation
// (navigation.ts) au lieu d'ouvrir le navigateur ou une boîte de dialogue, la
// mise à jour (miseAJour.ts) au lieu de télécharger ou de redémarrer.
export interface TemoinsPreuve {
  liensOuverts: string[];
  dossierTelechargements: string;
  miseAJour: PreuveMiseAJour;
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// La PAGE seule (sans le cadre de la fenêtre).
async function capturerPage(fenetre: BrowserWindow, fichier: string) {
  const image = await fenetre.webContents.capturePage();
  writeFileSync(fichier, image.toPNG());
}

// La FENÊTRE entière, cadre et boutons de Windows compris (lot 1 bis) : ce
// que voit l'utilisateur, et que `capturePage` ne montre pas.
async function capturerFenetre(fenetre: BrowserWindow, fichier: string): Promise<string> {
  const { width, height } = fenetre.getBounds();
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width, height } });
  const source = sources.find((s) => s.id === fenetre.getMediaSourceId());
  if (!source) return 'fenêtre introuvable parmi les sources';
  writeFileSync(fichier, source.thumbnail.toPNG());
  return 'ok';
}

// ── Lot 8 : les données survivent à la fermeture de l'app ───────────────
// Deux lancements sur le MÊME dossier de données (`npm run bureau:preuve --
// --conservation`). `ecrire` importe un compte de test par le vrai champ
// fichier de l'accueil, répond « Garder mes données », puis l'app se ferme ;
// `relire` relance et relève la même chose. Le script compare les deux.
export async function lancerPreuveConservation(fenetre: BrowserWindow, dossier: string, etape: 'ecrire' | 'relire', compte: string) {
  mkdirSync(dossier, { recursive: true });
  const resultats: Record<string, unknown> = { etape };
  const js = (code: string) => fenetre.webContents.executeJavaScript(code, true);
  try {
    if (fenetre.webContents.isLoading()) {
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    }
    await attendre(2500);
    if (etape === 'ecrire') {
      resultats.import = await js(`(() => {
        const champ = document.querySelector('input[type="file"][accept*="json"]');
        if (!champ) return 'pas de champ fichier';
        const dt = new DataTransfer();
        dt.items.add(new File([${JSON.stringify(compte)}], 'compte-miniature.json', { type: 'application/json' }));
        champ.files = dt.files;
        champ.dispatchEvent(new Event('change', { bubbles: true }));
        return 'déposé';
      })()`);
      await attendre(2500);
      resultats.garder = await js(`(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Garder mes données (recommandé)');
        if (!b) return 'pas de question « Garder mes données »';
        b.click();
        return 'cliqué';
      })()`);
      await attendre(2500);
    } else {
      await attendre(1500); // le compte se relit d'IndexedDB, après la page
    }
    // Ce qui est retenu : le compte affiché, la conservation, les clés de
    // stockage et leur taille, les bases IndexedDB.
    resultats.etat = await js(`(async () => ({
      compteAffiche: document.body.innerText.includes('Testeur'),
      conservation: localStorage.getItem('swblacksmith-persist-v1'),
      cles: Object.keys(localStorage).filter((k) => k.startsWith('swblacksmith')).sort()
        .map((k) => k + ' (' + localStorage.getItem(k).length + ')'),
      bases: (await indexedDB.databases()).map((b) => b.name).sort(),
    }))()`);
  } catch (e) {
    resultats.erreur = String(e);
  } finally {
    writeFileSync(join(dossier, `conservation-${etape}.json`), JSON.stringify(resultats, null, 2));
    // Fermeture ORDINAIRE (comme l'utilisateur) : le stockage s'écrit sur le
    // disque à la sortie de Chromium.
    fenetre.close();
  }
}

export async function lancerPreuve(fenetre: BrowserWindow, dossier: string, racine: string, temoins: TemoinsPreuve) {
  mkdirSync(dossier, { recursive: true });
  const resultats: Record<string, unknown> = {};
  const js = (code: string) => fenetre.webContents.executeJavaScript(code, true);
  try {
    if (fenetre.webContents.isLoading()) {
      await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    }
    await attendre(2500);

    // ── Lot 3 : l'app installée ──────────────────────────────────────────
    // Empaquetée, elle porte le nom de electron-builder.yml (`SW Blacksmith`,
    // dossier des données) ; lancée par `bureau:local`, celui de package.json.
    resultats.empaquetee = app.isPackaged;
    resultats.nomApp = app.getName();
    // ⚠️ Windows impose au PREMIER affichage l'état demandé par le processus
    // qui lance l'app (STARTUPINFO) : lancée depuis un shell caché, elle
    // s'ouvre réduite — sans boutons de fenêtre ni capture possible. Un
    // double-clic l'ouvre normalement. La preuve la rouvre et le note.
    resultats.ouverteReduite = fenetre.isMinimized();
    if (fenetre.isMinimized()) {
      fenetre.restore();
      await attendre(1000);
    }

    // ── Lot 1 : la coquille ──────────────────────────────────────────────
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
    resultats.prechargement = await js('JSON.stringify(Object.keys(window.swblacksmithBureau ?? {}))');
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

    // ── Lot 1 bis : l'habillage de la fenêtre ────────────────────────────
    resultats.dataBureau = await js(`document.documentElement.getAttribute('data-bureau')`);
    resultats.zoneDeplacement = await js(
      `getComputedStyle(document.querySelector('header[data-barre-fenetre]')).getPropertyValue('-webkit-app-region') || getComputedStyle(document.querySelector('header[data-barre-fenetre]')).getPropertyValue('app-region')`
    );
    resultats.boutonCliquable = await js(
      `getComputedStyle(document.querySelector('header[data-barre-fenetre] button')).getPropertyValue('-webkit-app-region') || 'non lu'`
    );
    resultats.margeBoutonsWindows = await js(
      `getComputedStyle(document.querySelector('header[data-barre-fenetre]')).paddingRight`
    );
    resultats.tailleFenetre = fenetre.getBounds();
    // Lot 6 (décision 14) : l'APP ne propose pas de télécharger l'app — ni
    // entrée « Télécharger » dans la navigation, ni lien ou carte sur
    // l'accueil.
    resultats.accueilSansTelechargement = await js(
      `!document.querySelector('a[href="#/telecharger"]') && !document.body.innerText.includes('Existe aussi en application')`
    );
    resultats.menu = fenetre.isMenuBarVisible() ? 'visible' : 'aucun';

    await capturerPage(fenetre, join(dossier, 'accueil.png'));
    for (const theme of ['dark', 'light'] as const) {
      await js(`document.documentElement.setAttribute('data-theme', '${theme}')`);
      await attendre(800);
      resultats[`fenetre-${theme}`] = await capturerFenetre(fenetre, join(dossier, `fenetre-${theme}.png`));
    }
    await js(`document.documentElement.removeAttribute('data-theme')`);

    // ── Lot 2 : liens, navigations, téléchargements ──────────────────────
    // Chaque lien externe de l'accueil, puis de la page Nouveautés, cliqué :
    // il doit être confié au navigateur (ici, noté), et l'app rester en place.
    const cliquerLiensExternes = () =>
      js(`(() => {
        const liens = [...document.querySelectorAll('a[target="_blank"]')].map((a) => a.href);
        document.querySelectorAll('a[target="_blank"]').forEach((a) => a.click());
        return liens;
      })()`) as Promise<string[]>;
    await js(`location.hash = '#/'`);
    await attendre(1000);
    const liensAccueil = await cliquerLiensExternes();
    await js(`location.hash = '#/releases'`);
    await attendre(1500);
    const liensNouveautes = await cliquerLiensExternes();
    await attendre(500);
    const attendus = [...new Set([...liensAccueil, ...liensNouveautes])];
    resultats.liensExternes = {
      cliques: attendus.length,
      confiesAuNavigateur: [...new Set(temoins.liensOuverts)].length,
      manquants: attendus.filter((l) => !temoins.liensOuverts.includes(l)),
      exemples: attendus.slice(0, 6),
      appToujoursLa: await js('location.origin'),
    };
    // Quitter l'app : vers un fichier du disque (bloqué, rien d'ouvert) et
    // vers le web (bloqué, confié au navigateur).
    const avant = temoins.liensOuverts.length;
    await js(`location.href = 'file:///C:/Windows/win.ini'`).catch(() => undefined);
    await attendre(800);
    resultats.navigationFichier = { origine: await js('location.origin'), ouvertDehors: temoins.liensOuverts.length > avant };
    await js(`location.href = 'https://example.com/'`).catch(() => undefined);
    await attendre(800);
    resultats.navigationWeb = {
      origine: await js('location.origin'),
      confieAuNavigateur: temoins.liensOuverts.includes('https://example.com/'),
    };
    // Un téléchargement, construit comme les cinq exports de l'app (un Blob,
    // puis `a.download`).
    await js(`(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['{"preuve":"lot 2"}'], { type: 'application/json' }));
      a.download = 'swblacksmith-essai.json';
      a.click();
    })()`);
    await attendre(1500);
    const telecharge = join(temoins.dossierTelechargements, 'swblacksmith-essai.json');
    resultats.telechargement = existsSync(telecharge) ? readFileSync(telecharge, 'utf8') : 'absent';

    // ── Lot 5 : la mise à jour automatique ───────────────────────────────
    // Une version « disponible », simulée (aucun réseau). L'utilisateur
    // décide : la question doit RESTER au-delà des 6 s, rien ne doit se
    // télécharger sans « Mettre à jour » ; puis « Mise à jour prête »,
    // « Redémarrer » qui atteint le processus principal (compté, sans
    // redémarrer), et la page RECHARGÉE qui la propose encore.
    // ⚠️ La notification, pas la première zone `role="status"` (App.tsx en a
    // une, toujours là) : celle qui porte la croix « Fermer la notification ».
    const notification = () =>
      js(`document.querySelector('[aria-label="Fermer la notification"]')?.closest('[role="status"]')?.innerText.replace(/\\s+/g, ' ').trim() ?? 'aucune'`);
    const cliquer = (libelle: string) =>
      js(`(() => {
        const b = [...document.querySelectorAll('[role="status"] button')].find((x) => x.textContent.trim() === ${JSON.stringify(libelle)});
        if (!b) return 'pas de bouton « ${libelle} »';
        b.click();
        return 'cliqué';
      })()`);
    // Le bloc « Application » des Réglages (décision 12) : la mise à jour
    // remise à plus tard s'y fait quand il veut.
    const bloc = () =>
      js(`(() => {
        const s = document.querySelector('[data-bloc-application]');
        if (!s) return 'aucun bloc';
        const b = s.querySelector('button');
        return s.innerText.replace(/\\s+/g, ' ').trim() + (b?.disabled ? ' [désactivé]' : '');
      })()`);
    const cliquerBloc = () => js(`document.querySelector('[data-bloc-application] button')?.click() ?? 'pas de bouton'`);
    const ma: Record<string, unknown> = {};
    await js(`location.hash = '#/parametres'`);
    await attendre(1200);
    ma.avant = await notification();
    ma.blocAvant = await bloc();
    await cliquerBloc();
    await attendre(100);
    ma.blocRecherche = await bloc();
    await attendre(600);
    ma.blocAJour = await bloc();
    ma.recherches = temoins.miseAJour.recherches;
    temoins.miseAJour.simuler?.('9.9.9');
    await attendre(800);
    ma.disponible = await notification();
    ma.blocDisponible = await bloc();
    await attendre(7000);
    ma.disponibleApres7s = await notification();
    // « Plus tard » : la croix. Rien ne se télécharge, le bloc garde l'offre.
    await js(`document.querySelector('[aria-label="Fermer la notification"]')?.click()`);
    await attendre(300);
    ma.apresCroix = await notification();
    ma.blocApresCroix = await bloc();
    ma.telechargementsSansAccord = temoins.miseAJour.telechargements;
    // … puis « Mettre à jour » depuis les Réglages.
    await cliquerBloc();
    await attendre(100);
    ma.pendant = await notification();
    ma.blocPendant = await bloc();
    await attendre(1000);
    ma.telechargements = temoins.miseAJour.telechargements;
    ma.prete = await notification();
    ma.blocPrete = await bloc();
    await capturerPage(fenetre, join(dossier, 'parametres.png'));
    ma.clicRedemarrer = await cliquer('Redémarrer');
    await attendre(500);
    ma.redemarrages = temoins.miseAJour.redemarrages;
    fenetre.webContents.reload();
    await new Promise<void>((r) => fenetre.webContents.once('did-finish-load', () => r()));
    await attendre(2000);
    ma.apresRechargement = await notification();
    resultats.miseAJour = ma;

    await js(`location.hash = '#/bestiary'`);
    await attendre(2500);
    // Le compteur du Bestiaire (« 2 859 monstres ») : les données sont lues.
    resultats.bestiaire = await js(`document.body.innerText.match(/[0-9][0-9\\s\\u202f\\u00a0]* monstres/)?.[0] ?? 'aucun compteur'`);
    await capturerPage(fenetre, join(dossier, 'bestiaire.png'));
  } catch (e) {
    resultats.erreur = String(e);
  } finally {
    writeFileSync(join(dossier, 'resultats.json'), JSON.stringify(resultats, null, 2));
    app.quit();
  }
}
