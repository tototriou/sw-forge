// Préchargement de l'application de bureau — chantier application-bureau.
//
// ⚠️ **La page n'a JAMAIS accès à Node** (`contextIsolation`, `sandbox`,
// `nodeIntegration: false`) : elle ne reçoit que cet objet figé, exposé par
// `contextBridge`. Ce qu'elle doit pouvoir demander au bureau s'ajoute ICI, une
// fonction à la fois, jamais un accès général. Côté page : src/lib/bureau.ts.

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld(
  'swblacksmithBureau',
  Object.freeze({
    // `estBureau()` s'appuie sur la présence de cet objet.
    bureau: true,
    plateforme: process.platform,
    // Les couleurs du thème, pour habiller la fenêtre (lot 1 bis). Le
    // processus principal les vérifie avant de s'en servir.
    couleurs: (c: { fond: string; barre: string; symboles: string }) => ipcRenderer.send('bureau:couleurs', c),
  })
);
