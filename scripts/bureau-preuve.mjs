// `npm run bureau:preuve [dossier]` — lance l'application de bureau sur le
// BUILD en mode preuve (voir bureau/preuve.ts) : contrôles, captures,
// `resultats.json`, puis l'app se ferme d'elle-même. Chantier
// application-bureau.
//
// Dossier par défaut : `dist-bureau/preuve` (gitignoré). Le build (`dist/`) et
// `dist-bureau/` doivent être à jour : `npm run bureau:local` les refait.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lancerElectronEtAttendre } from './lib/electron.mjs';

const dossier = resolve(process.argv[2] ?? 'dist-bureau/preuve');
const r = lancerElectronEtAttendre({ SWBLACKSMITH_PREUVE: dossier });
if (r.error) throw r.error;
console.log(readFileSync(resolve(dossier, 'resultats.json'), 'utf8'));
console.log(`captures : ${dossier}`);
