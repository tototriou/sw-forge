// `npm run bureau:preuve [dossier] [--exe <chemin>] [--conservation]` — lance
// l'application de bureau sur le BUILD en mode preuve (voir bureau/preuve.ts) :
// contrôles, captures, `resultats.json`, puis l'app se ferme d'elle-même.
// Chantier application-bureau.
//
// Dossier par défaut : `preuve` dans `dist-bureau` (gitignoré). Le build
// (`dist/`) et `dist-bureau` doivent être à jour : `npm run bureau:local` les
// refait.
// `--exe` : rejoue la même preuve sur une app INSTALLÉE (lot 3), par exemple
// `%LOCALAPPDATA%\Programs\SW Blacksmith\SW Blacksmith.exe`.
// `--conservation` (lot 8) : DEUX lancements sur un dossier de données neuf —
// le premier importe `tests/fixtures/compte-miniature.json` et répond
// « Garder mes données », le second relit — puis compare ; code de sortie 1
// si quelque chose s'est perdu.
// `--swex` (lot 9) : le dossier SW Exporter sur des fixtures — choix, export
// réécrit, rechargement, sous-dossier `live` ; prépa RTA et siège jamais
// touchés.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lancerElectronEtAttendre } from './lib/electron.mjs';

const args = process.argv.slice(2);
const iExe = args.indexOf('--exe');
const exe = iExe >= 0 ? args.splice(iExe, 2)[1] : undefined;
const iConservation = args.indexOf('--conservation');
const conservation = iConservation >= 0 && args.splice(iConservation, 1).length > 0;
const iSwex = args.indexOf('--swex');
const swex = iSwex >= 0 && args.splice(iSwex, 1).length > 0;

if (swex) {
  // Lot 9 : un dossier SW Exporter de fixtures — deux invocateurs à la racine
  // (`Testeur-1.json`, `Autre-2.json`, tirés de compte-miniature.json) et un
  // sous-dossier `live` à ignorer.
  const dossier = resolve(args[0] ?? 'dist-bureau/preuve-swex');
  rmSync(dossier, { recursive: true, force: true });
  const fixtures = resolve(dossier, 'swex-fixtures');
  mkdirSync(resolve(fixtures, 'live'), { recursive: true });
  const source = resolve('tests/fixtures/compte-miniature.json');
  const compte = JSON.parse(readFileSync(source, 'utf8'));
  writeFileSync(resolve(fixtures, 'Testeur-1.json'), JSON.stringify(compte));
  writeFileSync(resolve(fixtures, 'Autre-2.json'), JSON.stringify({ ...compte, wizard_info: { ...compte.wizard_info, wizard_id: 2, wizard_name: 'Autre' } }));
  const r = lancerElectronEtAttendre(
    { SWBLACKSMITH_PREUVE: dossier, SWBLACKSMITH_PREUVE_SWEX: fixtures, SWBLACKSMITH_PREUVE_COMPTE: source },
    90_000,
    exe
  );
  if (r.error) throw r.error;
  const res = JSON.parse(readFileSync(resolve(dossier, 'resultats-swex.json'), 'utf8'));
  console.log(JSON.stringify(res, null, 2));
  const verdicts = {
    'import manuel : prépa RTA et siège remplis': res.travailRempli === true,
    'deux invocateurs proposés, live/ ignoré': JSON.stringify(res.options) === JSON.stringify(['Choisir…', 'Autre', 'Testeur']),
    'carte du compte : menu des invocateurs, puis l’import': JSON.stringify(res.menuCompte) === JSON.stringify(['Autre', 'Testeur', 'Importer un fichier…']),
    'invocateur choisi au menu : son compte, annoncé': res.choisirInvocateur === 'cliqué' && res.apresChoix?.compte === 'Autre' && res.apresChoix?.notification === 'Compte de Autre mis à jour depuis SW Exporter',
    'les Réglages suivent le même choix': res.selecteurReglages === 'Autre-2.json',
    'export réécrit : relu, annoncé': res.apresReecriture?.compte === 'Autre-bis' && res.apresReecriture?.notification === 'Compte de Autre-bis mis à jour depuis SW Exporter',
    'rechargement : rien de réannoncé, compte gardé': res.apresRechargement?.notification === 'aucune' && res.apresRechargement?.compte === 'Autre-bis',
    'écriture dans live/ : ignorée': res.apresLive?.notification === 'aucune',
    'prépa RTA et siège INCHANGÉS à chaque étape':
      res.apresChoix?.travailInchange === true && res.apresReecriture?.travailInchange === true && res.apresRechargement?.travailInchange === true,
    'réglage retenu (dossier, invocateur, dernier lu)': res.reglageRetenu?.fichier === 'Autre-2.json' && typeof res.reglageRetenu?.dernierLu === 'number',
    'aucune erreur': !res.erreur,
  };
  for (const [quoi, bon] of Object.entries(verdicts)) console.log(`${bon ? 'ok' : 'KO'}  ${quoi}`);
  if (Object.values(verdicts).some((v) => !v)) process.exit(1);
} else if (!conservation) {
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
