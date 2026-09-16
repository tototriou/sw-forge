// `scripts/spec-lint.mjs` — contrat de B.4 (`CADRAGE-rangement-specs.md`) sur
// des fixtures synthétiques. Deux cibles, au sens fixe : `testSpecLintEnTetes`
// (en-têtes, slugs, références) et `testSpecLint` (tout ce qui précède, plus
// les longueurs et les exceptions). Au lot 4, les deux ne tournent QUE sur
// les fixtures — le corpus réel n'a pas encore ses en-têtes (lot 5).

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { verifier } from '../scripts/spec-lint.mjs';
import { egal, ok, titre } from './outils';

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const FIXTURES = resolve(RACINE, 'tests/fixtures/spec-lint');
const CONFIG = JSON.parse(readFileSync(resolve(FIXTURES, 'spec-lint.json'), 'utf8'));

function regles(erreurs: { fichier: string; regle: string }[], fichier: string): string[] {
  return erreurs.filter((e) => e.fichier === `perimetre-fixture/${fichier}`).map((e) => e.regle);
}

export function testSpecLintEnTetes() {
  titre('spec-lint-en-tetes · en-têtes, slugs, références — fixtures seules');

  const { erreurs } = verifier(FIXTURES, CONFIG, { inclureLongueurs: false });

  ok(regles(erreurs, 'ok.md').length === 0, 'ok.md : en-tête, slugs et référence valides — aucune erreur');
  ok(regles(erreurs, 'slug-duplique.md').includes('slug-duplique'), 'deux titres de même slug refusés');
  ok(regles(erreurs, 'source-cassee.md').includes('reference-cassee'), '« Source : » cassé refusé');
  ok(regles(erreurs, 'a-preciser.md').includes('entete'), 'Statut « À préciser » refusé : ne commence par aucune des trois natures (B.5)');
  ok(regles(erreurs, 'statut-invalide.md').includes('entete'), 'Statut « n\'importe quoi » refusé');
  ok(regles(erreurs, 'sans-entete.md').includes('entete'), 'fichier dans le périmètre sans en-tête refusé');
  ok(
    !erreurs.some((e) => e.fichier.startsWith('hors-perimetre/')),
    'fichier hors périmètre sans en-tête ignoré (pas même une erreur « entete »)'
  );
  ok(
    regles(erreurs, 'archive/grosse-archive.md').length === 0,
    'archive/ : deux titres identiques acceptés avec son seul Statut : ARCHIVE'
  );
  ok(
    !regles(erreurs, 'bloc-101.md').includes('bloc-trop-long') && !regles(erreurs, 'fichier-501.md').includes('fichier-trop-long'),
    'cible en-têtes seule : aucune erreur de longueur, même sur les fixtures qui en portent'
  );
}

export default function testSpecLint() {
  titre('spec-lint · bloc > 100, fichier > 500, exceptions — fixtures seules');

  const { erreurs } = verifier(FIXTURES, CONFIG);

  ok(regles(erreurs, 'ok.md').length === 0, 'ok.md : toujours aucune erreur avec les longueurs incluses');
  ok(regles(erreurs, 'bloc-101.md').includes('bloc-trop-long'), 'bloc de 101 lignes refusé');
  ok(regles(erreurs, 'fichier-501.md').includes('fichier-trop-long'), 'fichier de plus de 500 lignes refusé');
  ok(regles(erreurs, 'slug-duplique.md').includes('slug-duplique'), 'deux titres de même slug refusés (toujours vrai avec les longueurs)');
  ok(regles(erreurs, 'source-cassee.md').includes('reference-cassee'), '« Source : » cassé refusé (toujours vrai avec les longueurs)');
  ok(regles(erreurs, 'exception-perimee.md').includes('exception-perimee'), 'exception périmée (fichier redescendu sous les seuils) refusée');
  ok(regles(erreurs, 'exception-valide.md').length === 0, 'exception toujours justifiée (> 500 lignes) : aucune erreur');
  ok(
    regles(erreurs, 'archive/grosse-archive.md').length === 0,
    'archive/ de 3 000 lignes acceptée avec son seul Statut : ARCHIVE, sans contrôle de longueur ni de slugs'
  );
  ok(
    !erreurs.some((e) => e.fichier.startsWith('hors-perimetre/')),
    'fichier hors périmètre ignoré même pour la cible complète'
  );

  egal(CONFIG.exceptions.length, 2, 'la fixture de config déclare deux exceptions (une périmée, une valide)');
}
