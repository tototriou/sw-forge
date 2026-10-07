// La session en cours de l'application de bureau : le fichier que
// « Sauvegarder » (Ctrl+S) réécrit sans rien demander, que « Sauvegarder
// sous… » remplace. Les sessions s'enregistrent dans le sous-dossier
// `sessions` du dossier SW Blacksmith, un réglage choisi dans les Paramètres
// (ou à la première sauvegarde). Spec : spec/shared/sauvegarde-session.md.
// Ce qui se décide sans Electron : bureau/sessionPur.ts.
//
// ⚠️ **Le dossier SW Blacksmith est un RÉGLAGE** (`dossier-swblacksmith.json`,
// dossier des données) : retenu même sans « Garder mes données ».
// ⚠️ **La session en cours, elle, n'est retenue après fermeture qu'avec
// « Garder mes données »** (`session.json`) : conservation refusée, l'app
// redémarre vide, et un Ctrl+S machinal écraserait la sauvegarde avec ce vide.
// La page dit à chaque changement si elle conserve (`bureau:session-retenir`),
// et le fichier retenu n'est repris qu'à sa PREMIÈRE réponse, si elle est oui.

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  avecExtension,
  cheminLibre,
  dossierSessions,
  ecrireSansRisque,
  etatDe,
  EtatSession,
  lireDossierRetenu,
  lireSessionRetenue,
  messageEchec,
  nomProposeValide,
  texteSessionValide,
} from './sessionPur';

export type IssueSession =
  | { issue: 'enregistree'; etat: EtatSession }
  | { issue: 'annulee' }
  | { issue: 'echec'; message: string };

// Mode preuve : aucune boîte ne s'ouvre. Le dossier SW Blacksmith « choisi »
// est `dossier` ; « Sauvegarder sous… » rend `<dossier>/sessions/<n>-<nom>`.
export interface PreuveSession {
  dossier: string;
  choix: number;
}

export function brancherSession(fenetre: BrowserWindow, preuve?: PreuveSession) {
  const cheminRetenu = () => join(app.getPath('userData'), 'session.json');
  const cheminReglage = () => join(app.getPath('userData'), 'dossier-swblacksmith.json');
  let courante: string | null = null;
  let dossier = lireDossier();
  let retenir = false;
  let repris = false;
  // Une sauvegarde à la fois : un second Ctrl+S pendant une boîte de dialogue
  // ou l'écriture ne la relance pas.
  let occupe = false;

  const deLaPage = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => e.sender === fenetre.webContents;
  const envoyer = (canal: string, valeur: unknown) => {
    if (!fenetre.isDestroyed()) fenetre.webContents.send(canal, valeur);
  };
  // Après chaque changement, l'état est DIFFUSÉ : la barre du haut nomme la
  // session en cours, les Paramètres montrent le dossier, quel que soit
  // l'endroit qui les a changés.
  const repondre = () => {
    const e = etatDe(courante, dossier);
    envoyer('bureau:session-etat', e);
    return e;
  };

  function lireDossier(): string | null {
    try {
      return lireDossierRetenu(JSON.parse(readFileSync(cheminReglage(), 'utf8')));
    } catch {
      return null; // jamais choisi, ou fichier abîmé
    }
  }

  function ecrireDossier() {
    try {
      writeFileSync(cheminReglage(), JSON.stringify({ dossier }, null, 2));
    } catch {
      /* disque en lecture seule : le réglage vaut pour cette ouverture */
    }
  }

  function memoriser() {
    try {
      if (retenir && courante) writeFileSync(cheminRetenu(), JSON.stringify({ chemin: courante }, null, 2));
      else rmSync(cheminRetenu(), { force: true });
    } catch {
      /* disque en lecture seule : la session en cours vaut pour cette ouverture */
    }
  }

  function reprendre() {
    if (repris) return;
    repris = true;
    if (!retenir) return;
    try {
      const chemin = lireSessionRetenue(JSON.parse(readFileSync(cheminRetenu(), 'utf8')));
      // Déplacé ou supprimé depuis : pas de session en cours, la prochaine
      // sauvegarde en crée une.
      if (chemin && existsSync(chemin)) courante = chemin;
    } catch {
      /* aucun fichier retenu, ou illisible */
    }
  }

  // La boîte « Dossier SW Blacksmith » ; `null` si elle est annulée.
  async function demanderDossier(): Promise<string | null> {
    if (preuve) return preuve.dossier;
    const r = await dialog.showOpenDialog(fenetre, {
      title: 'Dossier SW Blacksmith',
      buttonLabel: 'Choisir ce dossier',
      defaultPath: dossier ?? app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  }

  // La boîte « Sauvegarder sous », ouverte dans `sessions` ; `null` si elle
  // est annulée.
  async function demanderFichier(sessions: string, nomPropose: string): Promise<string | null> {
    if (preuve) {
      preuve.choix += 1;
      return join(sessions, `${preuve.choix}-${nomPropose}`);
    }
    const r = await dialog.showSaveDialog(fenetre, {
      title: 'Sauvegarder la session sous',
      defaultPath: join(sessions, nomPropose),
      filters: [{ name: 'Session SW Blacksmith', extensions: ['json'] }],
      properties: ['showOverwriteConfirmation'],
    });
    return r.canceled || !r.filePath ? null : avecExtension(r.filePath);
  }

  async function enregistrer(
    e: Electron.IpcMainInvokeEvent,
    texte: unknown,
    nomPropose: unknown,
    sous: boolean
  ): Promise<IssueSession | null> {
    if (!deLaPage(e)) return null;
    if (!texteSessionValide(texte) || !nomProposeValide(nomPropose)) {
      return { issue: 'echec', message: 'Ce n’est pas une session.' };
    }
    if (occupe) return { issue: 'annulee' };
    occupe = true;
    try {
      let chemin = sous ? null : courante;
      if (!chemin) {
        // Sans dossier SW Blacksmith, on le demande d'abord.
        if (!dossier) {
          const choisi = await demanderDossier();
          if (!choisi) return { issue: 'annulee' };
          dossier = choisi;
          ecrireDossier();
          repondre();
        }
        const sessions = dossierSessions(dossier);
        try {
          mkdirSync(sessions, { recursive: true });
        } catch (err) {
          return { issue: 'echec', message: messageEchec((err as NodeJS.ErrnoException).code) };
        }
        chemin = sous ? await demanderFichier(sessions, nomPropose) : cheminLibre(sessions, nomPropose, existsSync);
        if (!chemin) return { issue: 'annulee' };
      }
      try {
        await ecrireSansRisque(chemin, texte);
      } catch (err) {
        // Échec : la session en cours ne change pas.
        return { issue: 'echec', message: messageEchec((err as NodeJS.ErrnoException).code) };
      }
      if (chemin !== courante) {
        courante = chemin;
        memoriser();
        repondre();
      }
      return { issue: 'enregistree', etat: etatDe(courante, dossier) };
    } finally {
      occupe = false;
    }
  }

  ipcMain.handle('bureau:session-etat', (e) => (deLaPage(e) ? etatDe(courante, dossier) : null));

  // « Garder mes données » : la page le redit au chargement et à chaque
  // changement. La session en cours, elle, reste jusqu'à la fermeture.
  ipcMain.handle('bureau:session-retenir', (e, oui: unknown) => {
    if (!deLaPage(e) || typeof oui !== 'boolean') return null;
    retenir = oui;
    reprendre();
    memoriser();
    return repondre();
  });

  ipcMain.handle('bureau:session-sauvegarder', (e, texte: unknown, nomPropose: unknown) =>
    enregistrer(e, texte, nomPropose, false)
  );
  ipcMain.handle('bureau:session-sauvegarder-sous', (e, texte: unknown, nomPropose: unknown) =>
    enregistrer(e, texte, nomPropose, true)
  );

  // Paramètres, « Dossier SW Blacksmith » : « Choisir… » et « Retirer ». La
  // session en cours ne change pas : seules les PROCHAINES sessions iront
  // dans le nouveau dossier.
  ipcMain.handle('bureau:session-choisir-dossier', async (e) => {
    if (!deLaPage(e)) return null;
    if (occupe) return etatDe(courante, dossier);
    occupe = true;
    try {
      const choisi = await demanderDossier();
      if (choisi) {
        dossier = choisi;
        ecrireDossier();
      }
      return repondre();
    } finally {
      occupe = false;
    }
  });
  ipcMain.handle('bureau:session-oublier-dossier', (e) => {
    if (!deLaPage(e)) return null;
    dossier = null;
    ecrireDossier();
    return repondre();
  });

  // « Tout supprimer » : l'app repart vide, elle n'a plus de session en cours.
  // Le dossier SW Blacksmith, un réglage, reste.
  ipcMain.handle('bureau:session-oublier', (e) => {
    if (!deLaPage(e)) return null;
    courante = null;
    memoriser();
    return repondre();
  });
}
