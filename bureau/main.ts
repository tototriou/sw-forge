// Processus principal de l'application de bureau (Electron)
// (docs/02-app/bureau/).
//
// Un seul code : la fenêtre affiche le build Vite (`dist/`), servi par le
// protocole `app://swblacksmith/` (voir protocole.ts). Rien de l'app n'est
// réécrit pour le bureau.

import { app, BrowserWindow, ipcMain, Menu, nativeTheme, net, protocol, screen } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NOM_APP } from '../src/marque';
import { CouleursFenetre, couleursValides, EtatFenetre, HAUTEUR_BARRE, lireEtat, MINIMUM } from './fenetre';
import { brancherMiseAJour } from './miseAJour';
import { brancherNavigation } from './navigation';
import { brancherSession } from './session';
import { brancherSwex } from './swex';
import { SCHEMA, URL_ACCUEIL, cheminDuFichier } from './protocole';
import { lancerPreuve, lancerPreuveConservation, lancerPreuveSession, lancerPreuveSwex, TemoinsPreuve } from './preuve';

// Les couleurs des deux thèmes, LUES dans `src/index.css` à la compilation
// (scripts/construire-bureau.mjs) — jamais recopiées ici. Elles habillent la
// fenêtre tant que la page n'a pas envoyé les siennes.
declare const __COULEURS_THEMES__: { clair: CouleursFenetre; sombre: CouleursFenetre };

// ⚠️ AVANT `ready` : un protocole se déclare privilégié au démarrage ou jamais.
//  - `standard` : URLs relatives et origine normales (`app://swblacksmith`) ;
//  - `secure` : contexte sécurisé, comme https (workers module, presse-papier) ;
//  - `supportFetchAPI` / `corsEnabled` : `fetch` des données et des workers.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEMA,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

// Compilé en `main.cjs` dans le dossier `dist-bureau` : le build est à côté,
// dans `dist/`.
const RACINE = join(__dirname, '..', 'dist');

// `npm run bureau` pointe la fenêtre sur le serveur de dev Vite (rechargement
// à chaud) ; sinon, le build.
const URL_DEV = process.env.SWBLACKSMITH_DEV_URL;

// Mode preuve : ses données (stockage, état de la fenêtre) dans son propre
// dossier — une preuve ne touche jamais celles de l'utilisateur. AVANT
// `ready`, sinon le chemin est déjà fixé.
const DOSSIER_PREUVE = process.env.SWBLACKSMITH_PREUVE;
if (DOSSIER_PREUVE) app.setPath('userData', join(DOSSIER_PREUVE, 'donnees'));

// ⚠️ **Une seule instance par dossier de données.** Deux processus sur le
// même dossier se disputeraient le stockage local et IndexedDB (le second
// démarrerait sans données) et réécriraient tour à tour `session.json`,
// `swex.json` et `fenetre.json` — un Ctrl+S dans l'un écraserait la session
// de l'autre. Le second lancement quitte et ramène la fenêtre du premier.
// Le verrou suit `userData` : une preuve, dans son propre dossier, n'est pas
// gênée par l'app ouverte de l'utilisateur.
const PREMIERE_INSTANCE = app.requestSingleInstanceLock();
if (!PREMIERE_INSTANCE) app.quit();
let fenetrePrincipale: BrowserWindow | null = null;
app.on('second-instance', () => {
  const f = fenetrePrincipale;
  if (!f || f.isDestroyed()) return;
  if (f.isMinimized()) f.restore();
  f.show();
  f.focus();
});

// L'état de la fenêtre (taille, position, agrandie, couleurs du dernier
// thème), dans le dossier de l'app (`%APPDATA%/…` sous Windows).
const cheminEtat = () => join(app.getPath('userData'), 'fenetre.json');

function lireFichierEtat(): unknown {
  try {
    return JSON.parse(readFileSync(cheminEtat(), 'utf8'));
  } catch {
    return null; // absent (premier lancement) ou illisible : les défauts
  }
}

function ecrireFichierEtat(etat: EtatFenetre) {
  try {
    writeFileSync(cheminEtat(), JSON.stringify(etat, null, 2));
  } catch {
    /* disque en lecture seule : on ne mémorise pas, rien de plus */
  }
}

function creerFenetre(preuve: TemoinsPreuve | undefined): BrowserWindow {
  const ecrans = screen.getAllDisplays().map((d) => ({ x: d.workArea.x, y: d.workArea.y, largeur: d.workArea.width, hauteur: d.workArea.height }));
  const principal = screen.getPrimaryDisplay().workArea;
  const etat = lireEtat(lireFichierEtat(), [
    { x: principal.x, y: principal.y, largeur: principal.width, hauteur: principal.height },
    ...ecrans,
  ]);
  // Fond au thème DÈS l'ouverture (décision 7) : les couleurs du dernier
  // thème vu, sinon celles du thème du système (le défaut de l'app, « Auto »).
  let couleurs: CouleursFenetre =
    etat.couleurs ?? (nativeTheme.shouldUseDarkColors ? __COULEURS_THEMES__.sombre : __COULEURS_THEMES__.clair);

  const fenetre = new BrowserWindow({
    x: etat.x,
    y: etat.y,
    width: etat.largeur,
    height: etat.hauteur,
    minWidth: MINIMUM.largeur,
    minHeight: MINIMUM.hauteur,
    title: NOM_APP,
    icon: join(RACINE, 'favicon.png'),
    show: false,
    backgroundColor: couleurs.fond,
    // ⚠️ **Barre de titre intégrée** (décision 7) : plus de barre de Windows.
    // La barre du haut de l'app est la zone de déplacement (index.css,
    // `html[data-bureau]`), et les boutons réduire / agrandir / fermer sont
    // dessinés par-dessus, à droite, aux couleurs du thème.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: couleurs.barre, symbolColor: couleurs.symboles, height: HAUTEUR_BARRE },
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      // ⚠️ Les trois verrous de sécurité : la page n'atteint jamais Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (etat.agrandie) fenetre.maximize();
  // Affichée une fois peinte : pas d'éclair avant le thème.
  fenetre.once('ready-to-show', () => fenetre.show());

  // La page envoie les couleurs de son thème (src/lib/bureau.ts), au
  // chargement et à chaque changement. Vérifiées : elles viennent de la page.
  ipcMain.on('bureau:couleurs', (evenement, brut) => {
    if (evenement.sender !== fenetre.webContents) return;
    const c = couleursValides(brut);
    if (!c) return;
    couleurs = c;
    fenetre.setTitleBarOverlay({ color: c.barre, symbolColor: c.symboles, height: HAUTEUR_BARRE });
    fenetre.setBackgroundColor(c.fond);
  });

  // Mémorisé à la fermeture : la taille « normale » (pas celle d'agrandie),
  // et l'état agrandi à part — rouvrir agrandie, puis restaurer, rend la
  // taille d'avant.
  fenetre.on('close', () => {
    const b = fenetre.getNormalBounds();
    ecrireFichierEtat({ x: b.x, y: b.y, largeur: b.width, hauteur: b.height, agrandie: fenetre.isMaximized(), couleurs });
  });

  // Liens externes vers le navigateur du système, navigations hors de l'app
  // bloquées, téléchargements par « Enregistrer sous » (lot 2).
  brancherNavigation(fenetre, { urlDev: URL_DEV, preuve });
  // Mise à jour automatique (lot 5) : app installée seulement ; en mode
  // preuve, simulée.
  brancherMiseAJour(fenetre, preuve?.miseAJour);
  // Le dossier SW Exporter (lot 9) : « Mon compte » suit les exports.
  brancherSwex(fenetre, preuve?.swex);
  // La session en cours : « Sauvegarder » la réécrit, « Sauvegarder sous… »
  // la remplace.
  brancherSession(fenetre, preuve?.session);

  void fenetre.loadURL(URL_DEV ?? URL_ACCUEIL);
  return fenetre;
}

void app.whenReady().then(() => {
  if (!PREMIERE_INSTANCE) return;
  // Pas de menu (décision 7) : celui d'Electron (File, Edit, View…) est en
  // anglais et n'apporte rien ici.
  Menu.setApplicationMenu(null);
  protocol.handle(SCHEMA, (requete) => {
    const fichier = cheminDuFichier(requete.url, RACINE);
    if (!fichier) return new Response('Introuvable', { status: 404 });
    return net.fetch(pathToFileURL(fichier).toString());
  });
  // Mode preuve : les liens sont notés, les téléchargements rangés dans son
  // dossier — puis contrôles, captures, et on quitte.
  const preuve: TemoinsPreuve | undefined = DOSSIER_PREUVE
    ? {
        liensOuverts: [],
        dossierTelechargements: join(DOSSIER_PREUVE, 'telechargements'),
        miseAJour: { recherches: 0, telechargements: 0, redemarrages: 0 },
        // Lot 9 : le dossier « choisi » sans boîte de dialogue (fixtures de
        // `npm run bureau:preuve -- --swex`).
        swex: process.env.SWBLACKSMITH_PREUVE_SWEX ? { dossier: process.env.SWBLACKSMITH_PREUVE_SWEX } : undefined,
        // Le dossier SW Blacksmith et les fichiers de session « choisis » sans
        // boîte de dialogue.
        session: { dossier: join(DOSSIER_PREUVE, 'swblacksmith'), choix: 0 },
      }
    : undefined;
  const fenetre = creerFenetre(preuve);
  fenetrePrincipale = fenetre;
  // Lot 8 : la preuve de conservation (deux lancements, `ecrire` puis
  // `relire`, sur le même dossier) à la place de la preuve ordinaire.
  const conservation = process.env.SWBLACKSMITH_PREUVE_CONSERVATION;
  if (DOSSIER_PREUVE && (conservation === 'ecrire' || conservation === 'relire')) {
    const compte = conservation === 'ecrire' ? readFileSync(process.env.SWBLACKSMITH_PREUVE_COMPTE ?? '', 'utf8') : '';
    void lancerPreuveConservation(fenetre, DOSSIER_PREUVE, conservation, compte);
  } else if (DOSSIER_PREUVE && preuve && process.env.SWBLACKSMITH_PREUVE_SESSION) {
    // La sauvegarde de session.
    const compte = readFileSync(process.env.SWBLACKSMITH_PREUVE_COMPTE ?? '', 'utf8');
    void lancerPreuveSession(fenetre, DOSSIER_PREUVE, compte, preuve.dossierTelechargements);
  } else if (DOSSIER_PREUVE && process.env.SWBLACKSMITH_PREUVE_SWEX) {
    // Lot 9 : la preuve du dossier SW Exporter.
    const compte = readFileSync(process.env.SWBLACKSMITH_PREUVE_COMPTE ?? '', 'utf8');
    void lancerPreuveSwex(fenetre, DOSSIER_PREUVE, process.env.SWBLACKSMITH_PREUVE_SWEX, compte);
  } else if (DOSSIER_PREUVE && preuve) void lancerPreuve(fenetre, DOSSIER_PREUVE, RACINE, preuve);
});

app.on('window-all-closed', () => app.quit());
