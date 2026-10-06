// Processus principal de l'application de bureau (Electron) — chantier
// application-bureau (spec/chantiers/application-bureau.md).
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
import { brancherNavigation, OptionsNavigation } from './navigation';
import { SCHEMA, URL_ACCUEIL, cheminDuFichier } from './protocole';
import { lancerPreuve } from './preuve';

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

// `dist-bureau/main.cjs` → le build est à côté, dans `dist/`.
const RACINE = join(__dirname, '..', 'dist');

// `npm run bureau` pointe la fenêtre sur le serveur de dev Vite (rechargement
// à chaud) ; sinon, le build.
const URL_DEV = process.env.SWBLACKSMITH_DEV_URL;

// Mode preuve : ses données (stockage, état de la fenêtre) dans son propre
// dossier — une preuve ne touche jamais celles de l'utilisateur. AVANT
// `ready`, sinon le chemin est déjà fixé.
const DOSSIER_PREUVE = process.env.SWBLACKSMITH_PREUVE;
if (DOSSIER_PREUVE) app.setPath('userData', join(DOSSIER_PREUVE, 'donnees'));

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

function creerFenetre(preuve: OptionsNavigation['preuve']): BrowserWindow {
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

  void fenetre.loadURL(URL_DEV ?? URL_ACCUEIL);
  return fenetre;
}

void app.whenReady().then(() => {
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
  const preuve = DOSSIER_PREUVE
    ? { liensOuverts: [] as string[], dossierTelechargements: join(DOSSIER_PREUVE, 'telechargements') }
    : undefined;
  const fenetre = creerFenetre(preuve);
  if (DOSSIER_PREUVE && preuve) void lancerPreuve(fenetre, DOSSIER_PREUVE, RACINE, preuve);
});

app.on('window-all-closed', () => app.quit());
