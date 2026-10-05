// Préchargement de l'application de bureau — chantier application-bureau.
//
// ⚠️ **La page n'a JAMAIS accès à Node** (`contextIsolation`, `sandbox`,
// `nodeIntegration: false`) : elle ne reçoit que cet objet figé, exposé par
// `contextBridge`. Ce qu'elle doit pouvoir demander au bureau s'ajoute ICI, une
// fonction à la fois, jamais un accès général.

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld(
  'swblacksmithBureau',
  Object.freeze({
    // `estBureau()` (lot 2) s'appuie sur la présence de cet objet.
    bureau: true,
    plateforme: process.platform,
  })
);
