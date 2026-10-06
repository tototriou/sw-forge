// Mise à jour automatique de l'application de bureau — chantier
// application-bureau, lot 5 (décision 10 : le passage réel N → N+1 se
// constate à la première version publiée après la v2.0.0).
//
// ⚠️ **L'utilisateur décide** (Thomas, 2026-10-06 : « il faut demander à
// l'utilisateur avant de télécharger »). Au lancement, `electron-updater`
// cherche seulement une version plus récente dans les releases GitHub
// (`publish` de electron-builder.yml → `resources/app-update.yml`) ; rien ne
// se télécharge tant qu'il n'a pas répondu. La page
// (src/components/MiseAJourBureau.tsx, notification) montre chaque phase :
//
//   disponible     « Nouvelle version X disponible · Mettre à jour » (reste)
//   telechargement « Téléchargement de la mise à jour… »
//   prete          « Mise à jour prête · Redémarrer » — sans redémarrage,
//                  elle s'installe à la fermeture de l'app
//   echec          le téléchargement qu'il a demandé n'a pas abouti
//
// ⚠️ **Plus tard, c'est possible** (Thomas, 2026-10-06 : « si l'utilisateur
// ne veut pas faire la mise à jour tout de suite mais la faire plus tard,
// il faut que cela soit possible ») : le bloc « Application » des Réglages
// (src/components/BlocApplication.tsx) montre la même phase et la même
// action, et peut RELANCER une recherche — trois phases de plus, les
// siennes, sans notification :
//
//   aucune         rien de connu (la recherche du lancement a échoué)
//   recherche      une recherche est en cours
//   a-jour         la recherche n'a rien trouvé
//   injoignable    la recherche qu'il a DEMANDÉE n'a pas abouti
//
// ⚠️ **Jamais de bruit sans demande** : hors ligne, release sans fichiers,
// dépôt injoignable à la recherche du LANCEMENT… rien ne s'affiche. Tout va dans
// `mise-a-jour.log` (dossier des données de l'app), réécrit à chaque
// lancement — le journal que relira la preuve de la version suivante.
//
// ⚠️ Seulement dans l'app INSTALLÉE (`app.isPackaged`) : lancée par
// `npm run bureau*`, elle n'a pas de `app-update.yml`.

import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// `aucune` : rien de connu — la recherche du lancement a échoué, en silence.
export type PhaseMiseAJour =
  | 'aucune'
  | 'recherche'
  | 'a-jour'
  | 'injoignable'
  | 'disponible'
  | 'telechargement'
  | 'prete'
  | 'echec';
export interface EtatMiseAJour {
  phase: PhaseMiseAJour;
  version: string;
}

// Mode preuve : aucun réseau. `simuler` (posé ici) annonce une version
// disponible ; « Rechercher » ne trouve rien, « Mettre à jour » la rend
// prête sans rien télécharger, « Redémarrer » est COMPTÉ au lieu de
// redémarrer.
export interface PreuveMiseAJour {
  recherches: number;
  telechargements: number;
  redemarrages: number;
  simuler?: (version: string) => void;
}

export function brancherMiseAJour(fenetre: BrowserWindow, preuve?: PreuveMiseAJour) {
  // L'état courant. La page le DEMANDE à son chargement : une version
  // trouvée avant elle n'est pas perdue.
  let etat: EtatMiseAJour | null = null;
  const passer = (phase: PhaseMiseAJour, version: string) => {
    etat = { phase, version };
    if (!fenetre.isDestroyed()) fenetre.webContents.send('bureau:mise-a-jour', etat);
  };
  const deLaPage = (evenement: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => evenement.sender === fenetre.webContents;

  ipcMain.handle('bureau:mise-a-jour', (evenement) => (deLaPage(evenement) ? etat : null));

  // « Rechercher » (Réglages) : seulement quand rien n'attend — jamais
  // pendant un téléchargement, ni par-dessus une version proposée.
  let demandee = false;
  ipcMain.on('bureau:rechercher', (evenement) => {
    if (!deLaPage(evenement)) return;
    if (etat && etat.phase !== 'aucune' && etat.phase !== 'a-jour' && etat.phase !== 'injoignable') return;
    demandee = true;
    passer('recherche', app.getVersion());
    if (preuve) {
      preuve.recherches += 1;
      setTimeout(() => passer('a-jour', app.getVersion()), 300);
      return;
    }
    // ⚠️ Lancée par `npm run bureau*` (pas installée) : `electron-updater`
    // ignore la recherche SANS répondre — le bouton resterait sur
    // « Recherche… ». Rien à chercher : à jour.
    if (!app.isPackaged) {
      passer('a-jour', app.getVersion());
      return;
    }
    autoUpdater.checkForUpdates().catch(() => {});
  });

  // « Mettre à jour » : seulement depuis une version disponible (ou un échec,
  // pour réessayer).
  ipcMain.on('bureau:telecharger', (evenement) => {
    if (!deLaPage(evenement) || !etat || (etat.phase !== 'disponible' && etat.phase !== 'echec')) return;
    const { version } = etat;
    passer('telechargement', version);
    if (preuve) {
      preuve.telechargements += 1;
      setTimeout(() => passer('prete', version), 500);
      return;
    }
    // L'échec arrive aussi par `logger.error` (journal) ; ici, on le DIT,
    // puisque c'est lui qui a demandé.
    autoUpdater.downloadUpdate().catch(() => passer('echec', version));
  });

  ipcMain.on('bureau:redemarrer', (evenement) => {
    if (!deLaPage(evenement) || etat?.phase !== 'prete') return;
    if (preuve) {
      preuve.redemarrages += 1;
      return;
    }
    // Installation silencieuse (`--updated` : les données restent, lot 3),
    // puis l'app se relance.
    autoUpdater.quitAndInstall(true, true);
  });

  if (preuve) {
    preuve.simuler = (version) => passer('disponible', version);
    return;
  }
  if (!app.isPackaged) return;

  const journal = join(app.getPath('userData'), 'mise-a-jour.log');
  const ecrire = (niveau: string, message: unknown) => {
    try {
      appendFileSync(journal, `${new Date().toISOString()} ${niveau} ${message instanceof Error ? message.message : String(message)}\n`);
    } catch {
      /* disque en lecture seule : pas de journal, rien de plus */
    }
  };
  try {
    writeFileSync(journal, '');
  } catch {
    /* idem */
  }

  autoUpdater.logger = {
    info: (m: unknown) => ecrire('info', m),
    warn: (m: unknown) => ecrire('attention', m),
    error: (m: unknown) => ecrire('erreur', m),
    debug: (m: unknown) => ecrire('detail', m),
  };
  // ⚠️ Pas de téléchargement sans son accord : `downloadUpdate()` au clic.
  autoUpdater.autoDownload = false;
  // Téléchargée (donc acceptée), elle s'installe à la fermeture s'il ne
  // redémarre pas.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => passer('disponible', info.version));
  autoUpdater.on('update-not-available', () => passer('a-jour', app.getVersion()));
  autoUpdater.on('update-downloaded', (info) => passer('prete', info.version));
  // ⚠️ Un émetteur sans écouteur d'`error` LÈVE l'erreur : l'app planterait
  // hors ligne. On l'écoute — sans l'écrire : `electron-updater` l'a déjà
  // passée à `logger.error` (sinon, trois fois la même dans le journal, vu
  // au lot 5). Une RECHERCHE qui échoue : dite seulement s'il l'a demandée
  // (l'échec d'un téléchargement passe par `downloadUpdate`, plus haut).
  autoUpdater.on('error', () => {
    if (etat?.phase === 'recherche') {
      if (demandee) passer('injoignable', app.getVersion());
      else passer('aucune', app.getVersion());
    }
  });
  // La recherche du lancement : les Réglages la montrent (« Recherche… »).
  passer('recherche', app.getVersion());
  autoUpdater.checkForUpdates().catch(() => {});
}
