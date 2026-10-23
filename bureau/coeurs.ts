// Le nombre de cœurs physiques, donné à la page (`bureau:coeurs-physiques`),
// qui le passe au Worker de recherche pour régler le nombre de Workers
// d'appariement. La lecture elle-même (commandes, analyse des sorties, repli)
// est dans coeursPur.ts ; ici, les vraies lectures du système et le canal.
//
// ⚠️ Lu UNE fois, à la première demande, puis gardé : le nombre de cœurs ne
// change pas pendant que l'app tourne, et la commande de Windows coûte le
// lancement de PowerShell. Jamais au démarrage de la fenêtre : rien ne
// l'attend.

import { BrowserWindow, ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promises } from 'node:fs';
import { LecturesSysteme, lireCoeursPhysiques } from './coeursPur';

// Une commande qui ne répond pas ne bloque rien : passé ce délai, elle est
// abandonnée et la page garde la règle du site.
const DELAI_COMMANDE_MS = 15_000;

export const lecturesDuSysteme: LecturesSysteme = {
  dossierWindows: () => process.env.SystemRoot,
  executer: (commande, args) =>
    new Promise((resolve, reject) => {
      execFile(commande, [...args], { windowsHide: true, timeout: DELAI_COMMANDE_MS, encoding: 'utf8' }, (erreur, sortie) => {
        if (erreur) reject(erreur);
        else resolve(sortie);
      });
    }),
  lireFichier: (chemin) => promises.readFile(chemin, 'utf8'),
};

export function brancherCoeurs(fenetre: BrowserWindow) {
  let lecture: Promise<number | null> | null = null;
  const deLaPage = (e: Electron.IpcMainInvokeEvent) => e.sender === fenetre.webContents;
  ipcMain.handle('bureau:coeurs-physiques', (e) => {
    if (!deLaPage(e)) return null;
    lecture ??= lireCoeursPhysiques(process.platform, lecturesDuSysteme);
    return lecture;
  });
}
