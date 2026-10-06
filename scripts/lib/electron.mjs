// Lancer Electron depuis un script — chantier application-bureau.
//
// ⚠️ **`ELECTRON_RUN_AS_NODE` est retirée de l'environnement.** VS Code est
// lui-même une application Electron et la pose à 1 dans son terminal intégré :
// héritée, elle fait démarrer Electron comme un simple Node — `require('electron')`
// rend alors un chemin au lieu de l'API, et la fenêtre ne s'ouvre jamais
// (symptôme : « Cannot read properties of undefined (reading
// 'registerSchemesAsPrivileged') »). Tout lancement passe donc par ici.

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const executable = createRequire(import.meta.url)('electron');

function environnement(supplement) {
  const env = { ...process.env, ...supplement };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

// Lance l'app (`electron .`) et rend le processus.
export function lancerElectron(supplement = {}) {
  return spawn(executable, ['.'], { stdio: 'inherit', env: environnement(supplement) });
}

// Lance l'app et attend sa fin. `exe` : une app INSTALLÉE (lot 3), lancée
// telle quelle — elle aussi est un Electron, la variable la concerne aussi.
export function lancerElectronEtAttendre(supplement = {}, delai = 120_000, exe) {
  return spawnSync(exe ?? executable, exe ? [] : ['.'], { stdio: 'inherit', env: environnement(supplement), timeout: delai });
}
