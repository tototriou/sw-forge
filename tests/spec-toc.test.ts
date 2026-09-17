// `scripts/spec-toc.mjs` et l'extension de `spec-markdown.mjs` (plages,
// en-tête, première phrase) qui le porte. Fixtures synthétiques pour chaque
// cas de B.3, plus un passage sur `spec/outils/optimizer.md` réel : voir
// `spec/chantiers/spec-rangement.md`, B.3.

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { enTete, sections } from '../scripts/lib/spec-markdown.mjs';
import { egal, ok, titre } from './outils';

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const FIXTURES = resolve(RACINE, 'tests/fixtures/spec-toc');
const SCRIPT = resolve(RACINE, 'scripts/spec-toc.mjs');

function lireFixture(nom: string): string {
  return readFileSync(resolve(FIXTURES, nom), 'utf8');
}

export default function testSpecToc() {
  titre('spec-toc · titres imbriqués, section vide, dernier titre, bloc de code');

  const imbrique = sections(lireFixture('imbrique.md'));
  egal(imbrique.length, 5, 'cinq titres — les deux faux titres du bloc de code sont exclus');
  egal(imbrique.map((s) => s.niveau), [1, 2, 2, 3, 3], 'niveaux dans l’ordre du fichier');
  egal(imbrique.map((s) => s.titre), [
    'Racine — accents éàê et ponctuation « guillemets »',
    'Section A',
    'Section B',
    'Sous-section B.1',
    'Dernier titre du fichier',
  ], 'accents et ponctuation Markdown conservés dans le texte des titres');

  const [racine, sectionA, sectionB, sousB1, dernier] = imbrique;
  egal(racine.premierePhrase, "Une phrase d'intro pour le H1, qui sert de première phrase.",
    'H1 — première phrase = le texte avant le premier sous-titre');
  egal(sectionA.premierePhrase, '—', 'section vide (rien avant le titre suivant) — pas de prose');
  egal(sectionB.premierePhrase, 'Une phrase pour B, après un bloc de code qui ne doit rien casser.',
    'un bloc de code contenant des « # » avant la prose ne casse pas la recherche de première phrase');
  egal(sousB1.fin, dernier.debut - 1, "plage d'un sous-titre : jusqu'au prochain titre de niveau ≤ au SIEN (son frère B.2), pas à celui du parent (Section B va, elle, jusqu'à la fin)");
  egal(sectionB.fin, lireFixture('imbrique.md').split(/\r\n|\n/).length, "Section B n'a pas de niveau ≤ après elle : sa plage va bien jusqu'à la fin du fichier");
  egal(dernier.fin, lireFixture('imbrique.md').split(/\r\n|\n/).length, "dernier titre du fichier — la plage va jusqu'à la fin");
  egal(dernier.premierePhrase, "Contenu du tout dernier titre, jusqu'à la fin du fichier.",
    'dernier titre du fichier — première phrase lue normalement');

  titre('spec-toc · fichier sans H2');

  const sansH2 = sections(lireFixture('sans-h2.md'));
  egal(sansH2.length, 1, 'un seul titre, aucun H2 : le fichier tient dans une seule section');
  egal(sansH2[0].niveau, 1, 'le titre unique est bien un H1');

  titre('spec-toc · en-tête (statut, lire si), tableau, liste, troncature à 120');

  const avecEnTete = enTete(lireFixture('avec-entete.md'));
  egal(avecEnTete.statut, 'ARCHIVE — créé le 2026-09-16 ; conclusion reprise dans : À préciser', 'champ Statut lu depuis l’en-tête');
  egal(avecEnTete.lireSi, 'on rouvre le sujet des tokens de couleur', 'champ Lire si lu depuis l’en-tête');

  const secEnTete = sections(lireFixture('avec-entete.md'));
  const tableau = secEnTete.find((s) => s.titre === 'Tableau puis prose')!;
  ok(!tableau.premierePhrase.includes('Colonne') && !tableau.premierePhrase.startsWith('|'),
    'un tableau avant la prose est ignoré, pas confondu avec une phrase');
  egal(tableau.premierePhrase, 'Première phrase après le tableau, qui ne doit pas être confondue avec une ligne de tableau.',
    'la prose APRÈS le tableau est bien trouvée');

  const liste = secEnTete.find((s) => s.titre === 'Liste comme prose')!;
  egal(liste.premierePhrase, '- Premier item de liste, qui compte comme de la prose à part entière.',
    'un item de liste compte comme de la prose, à lui seul (pas fusionné avec l’item suivant)');

  const longue = secEnTete.find((s) => s.titre === 'Phrase longue')!;
  ok(longue.premierePhrase.length === 120, 'troncature exactement à 120 caractères');
  const brutLongue = lireFixture('avec-entete.md').split('\n').find((l) => l.startsWith('Ceci est'))!;
  egal(longue.premierePhrase, brutLongue.slice(0, 120), 'la troncature coupe la même phrase source, sans rien y ajouter');

  titre('spec-toc · fichier sans en-tête normalisé (bootstrap, avant le lot 5)');

  const sansEnTete = enTete(lireFixture('imbrique.md'));
  egal(sansEnTete, { statut: null, lireSi: null }, 'aucun en-tête normalisé — statut et lire si à null, pas une erreur');

  titre('spec-toc · mode dossier (récursif, hors node_modules/)');

  const sortieDossier = execFileSync(process.execPath, [SCRIPT, 'tests/fixtures/spec-toc/dossier', '--json'], {
    cwd: RACINE,
    encoding: 'utf8',
  });
  const parsedDossier = JSON.parse(sortieDossier);
  egal(
    parsedDossier.map((r: any) => r.fichier).sort(),
    ['tests/fixtures/spec-toc/dossier/a.md', 'tests/fixtures/spec-toc/dossier/sous/b.md'],
    'parcours récursif du sous-dossier, et node_modules/ ignoré malgré son .md'
  );

  titre('spec-toc · spec/outils/optimizer.md réel');

  const optimizerPath = resolve(RACINE, 'spec/outils/optimizer.md');
  const optimizerTexte = readFileSync(optimizerPath, 'utf8');
  const optimizerSections = sections(optimizerTexte);
  const h2 = optimizerSections.filter((s) => s.niveau === 2).map((s) => s.titre);
  egal(h2, [
    'Écran (de haut en bas)',
    'Listes de travail et réservation de runes',
    'Exclusion des runes déjà portées ailleurs',
    'Interruption — filet de temps, pré-filtrage et arrêt manuel',
    'Algorithme (résumé fonctionnel)',
    'Limites connues',
  ], 'les six H2 attendus (A.1) sont tous présents dans le sommaire');

  const sortieJson = execFileSync(process.execPath, [SCRIPT, 'spec/outils/optimizer.md', '--json'], {
    cwd: RACINE,
    encoding: 'utf8',
  });
  const parsed = JSON.parse(sortieJson);
  ok(Array.isArray(parsed) && parsed.length === 1, '--json produit un tableau d’un seul fichier pour un fichier unique');
  egal(parsed[0].fichier, 'spec/outils/optimizer.md', 'chemin relatif à la racine du dépôt, avec des « / »');
  egal(parsed[0].sections.map((s: any) => s.titre), optimizerSections.map((s) => s.titre),
    'les sections du --json portent les mêmes titres, dans le même ordre, que sections() appelé directement');
}
