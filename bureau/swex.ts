// Le dossier SW Exporter — chantier application-bureau, lot 9, décision 15.
//
// L'utilisateur choisit dans les Réglages (bloc « Application ») le dossier où
// SW Exporter écrit ses exports et l'invocateur à suivre. Ce module retient ce
// réglage (`swex.json`, dossier des données de l'app — un RÉGLAGE, retenu même
// sans « Garder mes données »), surveille le dossier et donne le texte de
// l'export à la page, qui n'en applique que « Mon compte » (src/App.tsx,
// `rafraichirCompte`) : prépa RTA et siège ne bougent jamais d'ici.
//
// ⚠️ **La page confirme ce qu'elle a appliqué** (`bureau:swex-lu`) : un export
// à moitié écrit, illisible, n'avance pas « dernier export lu », et sera
// redonné au prochain changement du fichier.
// ⚠️ **On attend 1,5 s après la dernière écriture** : SW Exporter écrit un
// fichier de plusieurs Mo, et le système signale chaque morceau.

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { FSWatcher, promises, readdirSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aDonner, ExportCompte, exportsDuDossier, lireReglage, ReglageSwex } from './swexPur';

export interface EtatSwex {
  dossier: string | null;
  fichier: string | null;
  exports: (ExportCompte & { modifie: number })[];
  dernierLu: number | null;
  // Le dossier choisi n'est plus lisible (débranché, renommé).
  introuvable: boolean;
}

// Mode preuve : le dossier « choisi » sans boîte de dialogue.
export interface PreuveSwex {
  dossier: string;
}

const ATTENTE = 1500;

export function brancherSwex(fenetre: BrowserWindow, preuve?: PreuveSwex) {
  const cheminReglage = () => join(app.getPath('userData'), 'swex.json');
  const lire = (): ReglageSwex => {
    try {
      return lireReglage(JSON.parse(readFileSync(cheminReglage(), 'utf8')));
    } catch {
      return lireReglage(null); // premier lancement, ou fichier abîmé
    }
  };
  const ecrire = () => {
    try {
      writeFileSync(cheminReglage(), JSON.stringify(reglage, null, 2));
    } catch {
      /* disque en lecture seule : le réglage vaut pour la session */
    }
  };

  let reglage = lire();
  let surveillance: FSWatcher | null = null;
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  let pagePrete = false;

  const deLaPage = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => e.sender === fenetre.webContents;
  const envoyer = (canal: string, valeur: unknown) => {
    if (!fenetre.isDestroyed()) fenetre.webContents.send(canal, valeur);
  };

  function etat(): EtatSwex {
    const { dossier, fichier, dernierLu } = reglage;
    if (!dossier) return { dossier, fichier, exports: [], dernierLu, introuvable: false };
    try {
      const noms = readdirSync(dossier, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
      const exports = exportsDuDossier(noms).map((e) => ({ ...e, modifie: statSync(join(dossier, e.fichier)).mtimeMs }));
      return { dossier, fichier, exports, dernierLu, introuvable: false };
    } catch {
      return { dossier, fichier, exports: [], dernierLu, introuvable: true };
    }
  }

  // Donne l'export suivi à la page, s'il y a lieu (`aDonner`).
  async function donner(pageSansCompte: boolean) {
    const { dossier, fichier } = reglage;
    if (!pagePrete || !dossier || !fichier) return;
    const chemin = join(dossier, fichier);
    try {
      const modifie = (await promises.stat(chemin)).mtimeMs;
      const { donner: oui, nouveau } = aDonner(modifie, reglage.dernierLu, pageSansCompte);
      if (!oui) return;
      const texte = await promises.readFile(chemin, 'utf8');
      envoyer('bureau:swex-export', { texte, modifie, nouveau, fichier });
    } catch {
      /* fichier absent ou verrouillé : rien, le prochain changement redonnera */
    }
  }

  function surveiller() {
    surveillance?.close();
    surveillance = null;
    if (!reglage.dossier) return;
    try {
      // Non récursif : seuls les exports de la RACINE comptent (`live/` écrit
      // en continu pendant une partie). Tout changement relance la liste ET
      // l'export suivi, une fois le dossier calme.
      surveillance = watch(reglage.dossier, () => {
        if (minuterie) clearTimeout(minuterie);
        minuterie = setTimeout(() => {
          envoyer('bureau:swex-etat', etat());
          void donner(false);
        }, ATTENTE);
      });
      surveillance.on('error', () => {
        surveillance?.close();
        surveillance = null;
      });
    } catch {
      /* dossier illisible : `etat().introuvable` le dira */
    }
  }

  ipcMain.handle('bureau:swex-etat', (e) => (deLaPage(e) ? etat() : null));

  // ⚠️ Après chaque CHOIX, l'état est aussi DIFFUSÉ : deux endroits de la page
  // le montrent (Réglages, carte du compte), et seul celui qui a fait le choix
  // reçoit la réponse — l'autre restait sur l'ancien état (vu au lot 9).
  const repondre = () => {
    const e = etat();
    envoyer('bureau:swex-etat', e);
    return e;
  };

  ipcMain.handle('bureau:swex-choisir-dossier', async (e) => {
    if (!deLaPage(e)) return null;
    let dossier: string | undefined;
    if (preuve) dossier = preuve.dossier;
    else {
      const r = await dialog.showOpenDialog(fenetre, {
        title: 'Dossier SW Exporter',
        properties: ['openDirectory'],
        defaultPath: reglage.dossier ?? app.getPath('desktop'),
      });
      if (r.canceled || !r.filePaths[0]) return etat();
      dossier = r.filePaths[0];
    }
    reglage = { dossier, fichier: null, dernierLu: null };
    // Un seul invocateur dans le dossier : c'est lui.
    const seul = etat().exports;
    if (seul.length === 1) reglage.fichier = seul[0].fichier;
    ecrire();
    surveiller();
    void donner(false);
    return repondre();
  });

  ipcMain.handle('bureau:swex-choisir-invocateur', (e, fichier: unknown) => {
    if (!deLaPage(e)) return null;
    // Seulement un export de CE dossier : jamais un chemin venu de la page.
    if (typeof fichier !== 'string' || !etat().exports.some((x) => x.fichier === fichier)) return etat();
    reglage = { ...reglage, fichier, dernierLu: null };
    ecrire();
    void donner(false);
    return repondre();
  });

  ipcMain.handle('bureau:swex-oublier', (e) => {
    if (!deLaPage(e)) return null;
    reglage = { dossier: null, fichier: null, dernierLu: null };
    ecrire();
    surveiller();
    return repondre();
  });

  // La page est prête (données des monstres chargées, compte conservé relu) :
  // l'export suivi peut lui être donné.
  ipcMain.on('bureau:swex-pret', (e, pageSansCompte: unknown) => {
    if (!deLaPage(e)) return;
    pagePrete = true;
    void donner(pageSansCompte === true);
  });

  // La page a APPLIQUÉ l'export de cette date.
  ipcMain.on('bureau:swex-lu', (e, modifie: unknown) => {
    if (!deLaPage(e) || typeof modifie !== 'number' || !Number.isFinite(modifie)) return;
    reglage = { ...reglage, dernierLu: modifie };
    ecrire();
    envoyer('bureau:swex-etat', etat());
  });

  surveiller();
}
