// Liens, navigations et téléchargements dans l'application de bureau —
// chantier application-bureau, lot 2.
//
// Sur le site, le navigateur s'en charge : un lien `target="_blank"` ouvre un
// onglet, un téléchargement va dans « Téléchargements ». Dans l'app il n'y a
// ni onglet ni barre d'adresse : sans ces règles, un lien externe ouvrirait
// une fenêtre Electron nue, et un fichier déposé à côté de la zone prévue
// REMPLACERAIT l'app par son contenu.
//
// Les deux décisions (`estAdresseInterne`, `ouvrableDehors`) sont PURES, dans
// protocole.ts et testées ; ce module-ci n'est que le branchement.

import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { estAdresseInterne, ouvrableDehors } from './protocole';

export interface OptionsNavigation {
  urlDev?: string;
  // Mode preuve : les liens sont NOTÉS au lieu d'ouvrir le navigateur, et les
  // téléchargements vont dans ce dossier sans boîte de dialogue.
  preuve?: { liensOuverts: string[]; dossierTelechargements: string };
}

export function brancherNavigation(fenetre: BrowserWindow, options: OptionsNavigation = {}) {
  const contenu = fenetre.webContents;
  const ouvrirDehors = (url: string) => {
    if (!ouvrableDehors(url)) return;
    if (options.preuve) options.preuve.liensOuverts.push(url);
    else void shell.openExternal(url);
  };

  // `target="_blank"`, `window.open` : jamais de seconde fenêtre Electron.
  contenu.setWindowOpenHandler(({ url }) => {
    ouvrirDehors(url);
    return { action: 'deny' };
  });

  // Une navigation qui quitterait l'app (lien sans `_blank`, fichier déposé
  // hors de la zone d'import) : bloquée ; ouverte dehors si c'est un lien web.
  contenu.on('will-navigate', (evenement, url) => {
    if (estAdresseInterne(url, options.urlDev)) return;
    evenement.preventDefault();
    ouvrirDehors(url);
  });

  // Téléchargements (exports de prépa, de recos, d'équipes…) : la boîte
  // « Enregistrer sous », ouverte dans le dossier Téléchargements avec le nom
  // proposé par l'app.
  contenu.session.on('will-download', (_evenement, element) => {
    if (options.preuve) {
      element.setSavePath(join(options.preuve.dossierTelechargements, element.getFilename()));
      return;
    }
    element.setSaveDialogOptions({
      title: 'Enregistrer le fichier',
      defaultPath: join(app.getPath('downloads'), element.getFilename()),
    });
  });
}
