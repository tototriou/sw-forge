// `scripts/spec-lint.mjs` — contrat de B.4 (`spec/chantiers/spec-rangement.md`) sur
// des fixtures synthétiques. Deux cibles, au sens fixe : `testSpecLintEnTetes`
// (en-têtes, slugs, références) et `testSpecLint` (tout ce qui précède, plus
// les longueurs et les exceptions). Au lot 4, les deux ne tournaient QUE sur
// les fixtures — le corpus réel n'avait pas encore ses en-têtes. Depuis le
// lot 5, `testSpecLintEnTetesReel` rejoue le mode en-têtes sur le VRAI
// périmètre (`spec/outils/**`, archives comprises) : c'est la preuve que les
// en-têtes posés au lot 5 sont effectivement reconnus par le lint.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { verifier } from '../scripts/spec-lint.mjs';
import { egal, ok, titre } from './outils';

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const FIXTURES = resolve(RACINE, 'tests/fixtures/spec-lint');
const CONFIG = JSON.parse(readFileSync(resolve(FIXTURES, 'spec-lint.json'), 'utf8'));
const CONFIG_REEL = JSON.parse(readFileSync(resolve(RACINE, 'spec/spec-lint.json'), 'utf8'));

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

  const referencesEtendues = erreurs.filter(
    (e) => e.fichier === 'perimetre-fixture/references-etendues.md' && e.regle === 'reference-cassee'
  );
  egal(
    referencesEtendues.length,
    1,
    'sur quatre références (lien Markdown, parenthèse médiane, backticks, titre absent), seule celle vers un titre absent est refusée'
  );
}

export function testSpecLintEnTetesReel() {
  titre('spec-lint-en-tetes · périmètre réel (spec/outils/**, archives comprises)');

  const { erreurs } = verifier(RACINE, { perimetre: ['spec/outils/**'], exceptions: [] }, { inclureLongueurs: false });

  ok(
    erreurs.length === 0,
    erreurs.length === 0
      ? 'aucune erreur d\'en-tête, de slug ou de référence sur le corpus réel'
      : `${erreurs.length} erreur(s) — ${erreurs.map((e) => `${e.fichier}${e.ligne ? `:${e.ligne}` : ''} [${e.regle}]`).join(', ')}`
  );
}

export function testSpecLintReel() {
  titre('spec-lint · périmètre réel COMPLET (spec/outils/**, exceptions comprises)');

  const { erreurs } = verifier(RACINE, CONFIG_REEL);

  ok(
    erreurs.length === 0,
    erreurs.length === 0
      ? 'aucune erreur (en-têtes, slugs, références, longueurs, exceptions) sur le corpus réel — équivaut à `node scripts/spec-lint.mjs spec/outils`'
      : `${erreurs.length} erreur(s) — ${erreurs.map((e) => `${e.fichier}${e.ligne ? `:${e.ligne}` : ''} [${e.regle}]`).join(', ')}`
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

  // C6 : un cadrage (dossier chantiers/) est une quatrième nature — B.4 amendement C6.
  ok(
    regles(erreurs, 'chantiers/cadrage-ok.md').length === 0,
    'cadrage de 619 lignes, blocs < 100, Statut « CHANTIER en cours » : accepté malgré > 500 lignes (exemption chantiers/)'
  );
  ok(
    regles(erreurs, 'chantiers/cadrage-bloc-101.md').includes('bloc-trop-long'),
    'cadrage avec un bloc de 101 lignes refusé [bloc-trop-long] : la règle de bloc s\'applique aux chantiers/'
  );
  ok(
    regles(erreurs, 'chantiers/cadrage-decision.md').includes('entete'),
    'Statut « DÉCISION » dans chantiers/ refusé : seule la nature CHANTIER y est reconnue'
  );
  ok(
    regles(erreurs, 'chantiers/cadrage-mauvaise-date.md').includes('entete'),
    'Statut « CHANTIER terminé le 2026-13-01 » refusé : date invalide'
  );
  ok(
    regles(erreurs, 'chantier-hors-dossier.md').includes('entete'),
    'Statut « CHANTIER en cours » hors d\'un dossier chantiers/ refusé'
  );
  ok(
    !regles(erreurs, 'chantiers/cadrage-ok.md').includes('fichier-trop-long'),
    'chantiers/ : exemption du plafond fichier codée dans le lint, pas une entrée de spec-lint.json'
  );
}
