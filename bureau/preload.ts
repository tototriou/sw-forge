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
    // La mise à jour automatique (lot 5, voir bureau/miseAJour.ts) : l'état
    // courant, ses changements (rend de quoi se désabonner), « Rechercher »,
    // « Mettre à jour » et « Redémarrer ».
    miseAJour: Object.freeze({
      etat: (): Promise<{ phase: string; version: string } | null> => ipcRenderer.invoke('bureau:mise-a-jour'),
      surChangement: (rappel: (etat: { phase: string; version: string }) => void) => {
        const ecouteur = (_e: unknown, etat: { phase: string; version: string }) => rappel(etat);
        ipcRenderer.on('bureau:mise-a-jour', ecouteur);
        return () => {
          ipcRenderer.removeListener('bureau:mise-a-jour', ecouteur);
        };
      },
      rechercher: () => ipcRenderer.send('bureau:rechercher'),
      telecharger: () => ipcRenderer.send('bureau:telecharger'),
      redemarrer: () => ipcRenderer.send('bureau:redemarrer'),
    }),
    // Le dossier SW Exporter (lot 9, voir bureau/swex.ts) : le réglage et ses
    // changements, les choix (dossier par la boîte du système, invocateur
    // parmi les exports trouvés), les exports donnés à la page, et ses
    // réponses — prête, export appliqué.
    swex: Object.freeze({
      etat: () => ipcRenderer.invoke('bureau:swex-etat'),
      choisirDossier: () => ipcRenderer.invoke('bureau:swex-choisir-dossier'),
      choisirInvocateur: (fichier: string) => ipcRenderer.invoke('bureau:swex-choisir-invocateur', fichier),
      oublier: () => ipcRenderer.invoke('bureau:swex-oublier'),
      surEtat: (rappel: (etat: unknown) => void) => {
        const ecouteur = (_e: unknown, etat: unknown) => rappel(etat);
        ipcRenderer.on('bureau:swex-etat', ecouteur);
        return () => {
          ipcRenderer.removeListener('bureau:swex-etat', ecouteur);
        };
      },
      surExport: (rappel: (exp: unknown) => void) => {
        const ecouteur = (_e: unknown, exp: unknown) => rappel(exp);
        ipcRenderer.on('bureau:swex-export', ecouteur);
        return () => {
          ipcRenderer.removeListener('bureau:swex-export', ecouteur);
        };
      },
      pret: (pageSansCompte: boolean) => ipcRenderer.send('bureau:swex-pret', pageSansCompte),
      lu: (modifie: number) => ipcRenderer.send('bureau:swex-lu', modifie),
    }),
    // La session en cours (voir bureau/session.ts) : son état et ses
    // changements, « Garder mes données » redit à chaque changement,
    // « Sauvegarder », « Sauvegarder sous… », le dossier SW Blacksmith
    // (« Choisir… », « Retirer ») et l'oubli de « Tout supprimer ».
    session: Object.freeze({
      etat: () => ipcRenderer.invoke('bureau:session-etat'),
      surEtat: (rappel: (etat: unknown) => void) => {
        const ecouteur = (_e: unknown, etat: unknown) => rappel(etat);
        ipcRenderer.on('bureau:session-etat', ecouteur);
        return () => {
          ipcRenderer.removeListener('bureau:session-etat', ecouteur);
        };
      },
      retenir: (oui: boolean) => ipcRenderer.invoke('bureau:session-retenir', oui),
      sauvegarder: (texte: string, nomPropose: string) => ipcRenderer.invoke('bureau:session-sauvegarder', texte, nomPropose),
      sauvegarderSous: (texte: string, nomPropose: string) => ipcRenderer.invoke('bureau:session-sauvegarder-sous', texte, nomPropose),
      choisirDossier: () => ipcRenderer.invoke('bureau:session-choisir-dossier'),
      oublierDossier: () => ipcRenderer.invoke('bureau:session-oublier-dossier'),
      oublier: () => ipcRenderer.invoke('bureau:session-oublier'),
    }),
  })
);
