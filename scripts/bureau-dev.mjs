// `npm run bureau` — l'application de bureau sur le serveur de dev Vite, avec
// rechargement à chaud. Chantier application-bureau, lot 1.
//
// Démarre Vite par son API (pas de dépendance de plus pour lancer deux
// processus), compile `bureau/`, puis lance Electron en lui donnant l'adresse
// du serveur. Fermer la fenêtre arrête tout.
//
// ⚠️ En dev, la fenêtre charge `http://localhost:5173` : son stockage n'est ni
// celui du site, ni celui de l'app installée (`app://swblacksmith`).

import { createServer } from 'vite';
import { lancerElectron } from './lib/electron.mjs';

const serveur = await createServer();
await serveur.listen();
const adresse = serveur.resolvedUrls?.local?.[0] ?? 'http://localhost:5173/';

await import('./construire-bureau.mjs');

lancerElectron({ SWBLACKSMITH_DEV_URL: adresse }).on('close', async (code) => {
  await serveur.close();
  process.exit(code ?? 0);
});
