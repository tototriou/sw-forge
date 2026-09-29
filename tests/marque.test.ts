// Le nom de l'app et ce qui ne doit PAS le suivre — rebranding « SW Blacksmith »,
// lot R2 (spec/chantiers/rebranding-blacksmith.md).
//
// ⚠️ Les identifiants de format des exports gardent `sw-forge` : ce sont des
// ADRESSES, pas des textes. Un fichier exporté avant le rebranding porte
// `sw-forge/prepa-rta` ; renommer l'identifiant le ferait refuser à l'import.
// Les autres tests comparent le format à la CONSTANTE, ils ne verraient rien si
// quelqu'un la renommait « pour finir le rebranding » : ce test-ci fige la
// chaîne elle-même.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FORMAT_SIEGE } from '../src/lib/siegeShare';
import { JSON_FORMAT as FORMAT_RTA } from '../src/lib/rtaShare';
import { JSON_FORMAT as FORMAT_RECO } from '../src/lib/recoShare';
import { CURVE_FORMAT } from '../src/lib/runeCurveShare';
import { NOM_APP, PREFIXE_FICHIER } from '../src/marque';
import { egal, ok, titre } from './outils';

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

export default function testMarque() {
  titre('marque · les formats d\'export ne suivent pas le nom de l\'app');
  egal(FORMAT_RTA, 'sw-forge/prepa-rta', 'prépa RTA : identifiant inchangé');
  egal(FORMAT_RECO, 'sw-forge/recommandations', 'recommandations : identifiant inchangé');
  egal(FORMAT_SIEGE, 'sw-forge/siege-equipes', 'équipes de siège : identifiant inchangé');
  egal(CURVE_FORMAT, 'sw-forge/courbe-runes', 'courbe de runes : identifiant inchangé');

  titre('marque · le nom est écrit une fois');
  egal(NOM_APP, 'SW Blacksmith', 'le nom de l\'app');
  egal(PREFIXE_FICHIER, 'swblacksmith', 'le préfixe des fichiers téléchargés (décision 14)');
  // Hors commentaires HTML : celui qui explique `%NOM_APP%` le cite lui-même.
  const index = readFileSync(resolve(RACINE, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  ok(!index.includes('SW Forge') && !index.includes(NOM_APP), 'index.html n\'écrit le nom nulle part en dur');
  ok((index.match(/%NOM_APP%/g) ?? []).length === 4, 'index.html le lit 4 fois (titre, og:site_name, og:title, twitter:title)');
}
