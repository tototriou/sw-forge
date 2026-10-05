// Processus principal de l'application de bureau (Electron) — chantier
// application-bureau (spec/chantiers/application-bureau.md).
//
// Un seul code : la fenêtre affiche le build Vite (`dist/`), servi par le
// protocole `app://swblacksmith/` (voir protocole.ts). Rien de l'app n'est
// réécrit pour le bureau.

import { app, BrowserWindow, net, protocol } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NOM_APP } from '../src/marque';
import { SCHEMA, URL_ACCUEIL, cheminDuFichier } from './protocole';
import { lancerPreuve } from './preuve';

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

function creerFenetre(): BrowserWindow {
  const fenetre = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: NOM_APP,
    icon: join(RACINE, 'favicon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      // ⚠️ Les trois verrous de sécurité : la page n'atteint jamais Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Affichée une fois peinte : pas d'éclair blanc avant le thème.
  fenetre.once('ready-to-show', () => fenetre.show());
  void fenetre.loadURL(URL_DEV ?? URL_ACCUEIL);
  return fenetre;
}

void app.whenReady().then(() => {
  protocol.handle(SCHEMA, (requete) => {
    const fichier = cheminDuFichier(requete.url, RACINE);
    if (!fichier) return new Response('Introuvable', { status: 404 });
    return net.fetch(pathToFileURL(fichier).toString());
  });
  const fenetre = creerFenetre();
  // Mode preuve (lot 1) : quelques contrôles, des captures, puis on quitte.
  const dossierPreuve = process.env.SWBLACKSMITH_PREUVE;
  if (dossierPreuve) void lancerPreuve(fenetre, dossierPreuve, RACINE);
});

app.on('window-all-closed', () => app.quit());
