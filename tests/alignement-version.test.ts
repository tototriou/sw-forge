// Alignement des numéros de version — docs/02-app/nouveautes/README.md,
// « Version affichée » et « `version: null` ».
//
// Le pied de page affiche la version de package.json et renvoie au journal :
// désalignés, le joueur lit un journal qui ne correspond pas à ce qu'il
// utilise. La règle se vérifie sur les vrais fichiers, puis sur des cas
// construits qui doivent être refusés.

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { RELEASES } from '../src/data/releases';
import { egal, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Les écarts entre la version du paquet et le journal ; vide si alignés. */
function ecartsAlignement(versionPaquet: string, journal: { version: string | null }[]): string[] {
  const ecarts: string[] = [];
  // Une version en préparation (`null`) n'existe qu'en tête, et une seule fois.
  journal.forEach((r, i) => {
    if (r.version === null && i > 0) ecarts.push(`entrée ${i} en préparation hors de la tête`);
  });
  const publiee = journal.find((r) => r.version !== null);
  if (!publiee) ecarts.push('aucune version publiée dans le journal');
  else if (publiee.version !== versionPaquet) {
    ecarts.push(`package.json ${versionPaquet} ≠ dernière version du journal ${publiee.version}`);
  }
  const numeros = journal.map((r) => r.version).filter((v): v is string => v !== null);
  const doublons = numeros.filter((v, i) => numeros.indexOf(v) !== i);
  if (doublons.length) ecarts.push(`numéros en double : ${doublons.join(', ')}`);
  return ecarts;
}

export function testAlignementVersion() {
  titre('alignement des versions — package.json, package-lock.json, journal');
  const paquet = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')) as { version: string };
  const verrou = JSON.parse(readFileSync(join(RACINE, 'package-lock.json'), 'utf8')) as {
    version: string;
    packages: Record<string, { version?: string }>;
  };

  egal(ecartsAlignement(paquet.version, RELEASES), [], 'package.json et le journal portent le même numéro');
  egal(verrou.version, paquet.version, 'package-lock.json porte la version de package.json');
  egal(verrou.packages['']?.version, paquet.version, 'package-lock.json (paquet racine) porte la version de package.json');

  // Cas construits : chacun doit être refusé, ou accepté, pour sa raison.
  ok(ecartsAlignement('2.1.0', [{ version: '2.1.0' }, { version: '2.0.0' }]).length === 0, 'version publiée en tête, égale au paquet : acceptée');
  ok(ecartsAlignement('2.1.0', [{ version: null }, { version: '2.1.0' }]).length === 0, 'version en préparation en tête, paquet resté à la précédente : acceptée');
  ok(ecartsAlignement('2.1.0', [{ version: '2.2.0' }, { version: '2.1.0' }]).length > 0, 'numéro écrit dans le journal, oublié dans le paquet : refusé');
  ok(ecartsAlignement('2.2.0', [{ version: null }, { version: '2.1.0' }]).length > 0, 'numéro écrit dans le paquet, journal encore en préparation : refusé');
  ok(ecartsAlignement('2.1.0', [{ version: '2.1.0' }, { version: null }]).length > 0, 'version en préparation hors de la tête : refusée');
  ok(ecartsAlignement('2.1.0', [{ version: null }, { version: null }, { version: '2.1.0' }]).length > 0, 'deux versions en préparation : refusées');
  ok(ecartsAlignement('2.1.0', [{ version: '2.1.0' }, { version: '2.1.0' }]).length > 0, 'même numéro deux fois : refusé');
}
