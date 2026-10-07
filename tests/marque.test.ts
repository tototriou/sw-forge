// Le nom de l'app et ce qui ne doit PAS le suivre — rebranding « SW Blacksmith »,
// lot R2.
//
// ⚠️ Les identifiants de format des exports sont des ADRESSES, pas des textes.
// Ils sont passés de `sw-forge/…` à `swblacksmith/…` (décision 66), et
// l'ancien identifiant DOIT rester relu : un fichier exporté avant le
// changement porte `sw-forge/prepa-rta`. Les autres tests comparent le format à
// la CONSTANTE, ils ne verraient rien si elle changeait encore : ce test-ci
// fige les chaînes elles-mêmes, et passe un ANCIEN fichier à chaque lecteur.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FORMAT_SIEGE, lireEquipes } from '../src/lib/siegeShare';
import { JSON_FORMAT as FORMAT_RTA, validateRtaImport } from '../src/lib/rtaShare';
import { JSON_FORMAT as FORMAT_RECO, decodeRecosJson } from '../src/lib/recoShare';
import { CURVE_FORMAT, decodeCurve } from '../src/lib/runeCurveShare';
import { NOM_APP, PREFIXE_FICHIER } from '../src/marque';
import type { Monster } from '../src/types';
import { egal, monstersJson, ok, titre } from './outils';

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

export default function testMarque() {
  titre('marque · les formats d\'export portent le nouveau nom');
  egal(FORMAT_RTA, 'swblacksmith/prepa-rta', 'prépa RTA');
  egal(FORMAT_RECO, 'swblacksmith/recommandations', 'recommandations');
  egal(FORMAT_SIEGE, 'swblacksmith/siege-equipes', 'équipes de siège');
  egal(CURVE_FORMAT, 'swblacksmith/courbe-runes', 'courbe de runes');

  titre('marque · un fichier exporté avant le rebranding se relit');
  const MONSTRES = monstersJson() as Monster[];
  const lushen = MONSTRES.find((m) => m.name === 'Lushen' && m.com2usId != null)!;
  for (const prefixe of ['sw-forge', 'swblacksmith']) {
    const rta = validateRtaImport(
      JSON.stringify({ format: `${prefixe}/prepa-rta`, version: 2, monstres: [{ com2usId: lushen.com2usId, nom: 'Lushen', section: 'violent' }] })
    );
    ok(rta.snapshot !== null && rta.errors.length === 0, `prépa RTA « ${prefixe}/prepa-rta » : lue, sans erreur`);

    const ctx = { errors: [] as string[], warnings: [] as string[] };
    const recos = decodeRecosJson(
      JSON.stringify({ format: `${prefixe}/recommandations`, version: 5, recommandations: [{ nom: 'R', decks: [{ monstres: [{ com2usId: lushen.com2usId, nom: 'Lushen' }] }] }] }),
      ctx as never
    );
    ok(recos !== null && recos.length === 1, `recommandations « ${prefixe}/recommandations » : lues`);
    ok(!ctx.warnings.some((w) => w.includes('Format déclaré')), `… sans avertissement de format`);

    const siege = lireEquipes(
      JSON.stringify({ format: `${prefixe}/siege-equipes`, version: 1, cote: 'defense', equipes: [{ monstres: [{ com2usId: lushen.com2usId, nom: 'Lushen', vitesseRunes: 100, tick: 0, sets: [] }] }] }),
      MONSTRES
    );
    ok(siege.ok, `équipes de siège « ${prefixe}/siege-equipes » : lues`);

    ok(decodeCurve(JSON.stringify({ format: `${prefixe}/courbe-runes`, version: 2, nom: 'Ami', efficiences: [100, 90], scores: [] })) !== null, `courbe « ${prefixe}/courbe-runes » : lue`);
  }
  // Un autre type de fichier reste refusé, sous l'un ou l'autre nom.
  ok(validateRtaImport(JSON.stringify({ format: 'swblacksmith/recommandations', monstres: [] })).errors.length > 0, 'une recommandation donnée à l’import RTA reste refusée');
  ok(!lireEquipes(JSON.stringify({ format: 'sw-forge/prepa-rta', version: 1, equipes: [] }), MONSTRES).ok, 'une prépa RTA donnée à l’import de siège reste refusée');

  titre('marque · le nom est écrit une fois');
  egal(NOM_APP, 'SW Blacksmith', 'le nom de l\'app');
  egal(PREFIXE_FICHIER, 'swblacksmith', 'le préfixe des fichiers téléchargés (décision 14)');
  // Hors commentaires HTML : celui qui explique `%NOM_APP%` le cite lui-même.
  const index = readFileSync(resolve(RACINE, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  ok(!index.includes('SW Forge') && !index.includes(NOM_APP), 'index.html n\'écrit le nom nulle part en dur');
  ok((index.match(/%NOM_APP%/g) ?? []).length === 4, 'index.html le lit 4 fois (titre, og:site_name, og:title, twitter:title)');
}
