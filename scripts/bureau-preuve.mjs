// `npm run bureau:preuve [dossier] [--exe <chemin>] [--conservation]` — lance
// l'application de bureau sur le BUILD en mode preuve (voir bureau/preuve.ts) :
// contrôles, captures, `resultats.json`, puis l'app se ferme d'elle-même.
// Chantier application-bureau.
//
// Dossier par défaut : `dist-bureau/preuve` (gitignoré). Le build (`dist/`) et
// `dist-bureau/` doivent être à jour : `npm run bureau:local` les refait.
// `--exe` : rejoue la même preuve sur une app INSTALLÉE (lot 3), par exemple
// `%LOCALAPPDATA%\Programs\SW Blacksmith\SW Blacksmith.exe`.
// `--conservation` (lot 8) : DEUX lancements sur un dossier de données neuf —
// le premier importe `tests/fixtures/compte-miniature.json` et répond
// « Garder mes données », le second relit — puis compare ; code de sortie 1
// si quelque chose s'est perdu.

import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { lancerElectronEtAttendre } from './lib/electron.mjs';

const args = process.argv.slice(2);
const iExe = args.indexOf('--exe');
const exe = iExe >= 0 ? args.splice(iExe, 2)[1] : undefined;
const iConservation = args.indexOf('--conservation');
const conservation = iConservation >= 0 && args.splice(iConservation, 1).length > 0;

if (!conservation) {
  const dossier = resolve(args[0] ?? 'dist-bureau/preuve');
  const r = lancerElectronEtAttendre({ SWBLACKSMITH_PREUVE: dossier }, 120_000, exe);
  if (r.error) throw r.error;
  console.log(readFileSync(resolve(dossier, 'resultats.json'), 'utf8'));
  console.log(`captures : ${dossier}`);
} else {
  const dossier = resolve(args[0] ?? 'dist-bureau/preuve-conservation');
  rmSync(dossier, { recursive: true, force: true }); // données neuves
  const lire = (etape) => JSON.parse(readFileSync(resolve(dossier, `conservation-${etape}.json`), 'utf8'));
  for (const etape of ['ecrire', 'relire']) {
    const r = lancerElectronEtAttendre(
      {
        SWBLACKSMITH_PREUVE: dossier,
        SWBLACKSMITH_PREUVE_CONSERVATION: etape,
        SWBLACKSMITH_PREUVE_COMPTE: resolve('tests/fixtures/compte-miniature.json'),
      },
      60_000,
      exe
    );
    if (r.error) throw r.error;
  }
  const ecrit = lire('ecrire');
  const relu = lire('relire');
  console.log(JSON.stringify({ ecrit, relu }, null, 2));
  const verdicts = {
    'import puis « Garder »': ecrit.import === 'déposé' && ecrit.garder === 'cliqué',
    'compte affiché après import': ecrit.etat?.compteAffiche === true,
    'compte affiché après réouverture': relu.etat?.compteAffiche === true,
    'conservation activée, et retenue': ecrit.etat?.conservation === '1' && relu.etat?.conservation === '1',
    'mêmes clés de stockage, même taille': JSON.stringify(ecrit.etat?.cles) === JSON.stringify(relu.etat?.cles) && (ecrit.etat?.cles?.length ?? 0) > 1,
    'mêmes bases IndexedDB': JSON.stringify(ecrit.etat?.bases) === JSON.stringify(relu.etat?.bases) && (relu.etat?.bases?.length ?? 0) > 0,
  };
  for (const [quoi, bon] of Object.entries(verdicts)) console.log(`${bon ? 'ok' : 'KO'}  ${quoi}`);
  if (Object.values(verdicts).some((v) => !v)) process.exit(1);
}
