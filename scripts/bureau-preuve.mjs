// `npm run bureau:preuve [dossier] [--exe <chemin>]` — lance l'application de
// bureau sur le BUILD en mode preuve (voir bureau/preuve.ts) : contrôles,
// captures, `resultats.json`, puis l'app se ferme d'elle-même. Chantier
// application-bureau.
//
// Dossier par défaut : `dist-bureau/preuve` (gitignoré). Le build (`dist/`) et
// `dist-bureau/` doivent être à jour : `npm run bureau:local` les refait.
// `--exe` : rejoue la même preuve sur une app INSTALLÉE (lot 3), par exemple
// `%LOCALAPPDATA%\Programs\sw-blacksmith\SW Blacksmith.exe`.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lancerElectronEtAttendre } from './lib/electron.mjs';

const args = process.argv.slice(2);
const iExe = args.indexOf('--exe');
const exe = iExe >= 0 ? args.splice(iExe, 2)[1] : undefined;
const dossier = resolve(args[0] ?? 'dist-bureau/preuve');
const r = lancerElectronEtAttendre({ SWBLACKSMITH_PREUVE: dossier }, 120_000, exe);
if (r.error) throw r.error;
console.log(readFileSync(resolve(dossier, 'resultats.json'), 'utf8'));
console.log(`captures : ${dossier}`);
