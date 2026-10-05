// `npm run bureau:local` — l'application de bureau sur le BUILD, comme une
// fois installée (protocole `app://swblacksmith/`). Chantier
// application-bureau, lot 1. Le build (`vite build`) et `bureau/` compilé sont
// refaits par le script npm avant ce lancement.

import { lancerElectron } from './lib/electron.mjs';

lancerElectron().on('close', (code) => process.exit(code ?? 0));
