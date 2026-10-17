// Garde des RÉFÉRENCES TEXTUELLES à `src/` dans les tests — pas seulement des
// lectures : toute chaîne qui désigne un chemin sous `src/` compte, qu'elle
// serve à `readFileSync`, à un `join`, à un `new URL` ou à rien d'autre.
//
// Pourquoi : un test qui lit un fichier de `src/` comme du texte n'importe pas
// ce module ; la sélection par fichiers modifiés (tests/selection.ts) ne le
// voit que par la lecture elle-même. Chaque nouvel usage doit donc être
// déclaré, et se retire dans le commit qui retire la lecture.
//
// La règle (relevé, comparaison à la liste, angles morts) vit dans
// scripts/lib/lectureSource.ts, que le hook `pre-commit` appelle aussi sur
// les fichiers indexés. Ici : le corpus de `tests/` (suivi, ou non suivi et
// non ignoré) et les vérifications.

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { comparer, EXTENSIONS, LISTE, regrouper, releverCibles, type Ecarts, type Entree, type Usage } from '../scripts/lib/lectureSource';
import { egal, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/* --------------------------------------------------------------------------
 * Corpus : fichiers de code de tests/, suivis ou non suivis non ignorés
 * ----------------------------------------------------------------------- */

export function corpus(racine: string): string[] {
  const sortie = (args: string[]) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\u0000').filter(Boolean);
  const suivis = sortie(['ls-files', '-z', '--', 'tests']);
  const nonSuivis = sortie(['ls-files', '-z', '--others', '--exclude-standard', '--', 'tests']);
  return [...new Set([...suivis, ...nonSuivis])]
    .filter((f) => EXTENSIONS.test(f) && existsSync(join(racine, f)))
    .sort();
}

export function releverDepot(racine: string): Usage[] {
  const parFichier = new Map<string, string[]>();
  for (const f of corpus(racine)) {
    const c = releverCibles(f, readFileSync(join(racine, f), 'utf8'));
    if (c.length) parFichier.set(f, c);
  }
  return regrouper(parFichier);
}

/* --------------------------------------------------------------------------
 * Vérifications
 * ----------------------------------------------------------------------- */

function formes(): void {
  titre('lecture-source — formes reconnues (relevé par le compilateur)');
  const f = 'tests/exemple.test.ts';
  const r = (texte: string, fichier = f) => releverCibles(fichier, texte);

  egal(r(`readFileSync('src/lib/a.ts', 'utf8');`), ['src/lib/a.ts'], 'chaîne littérale');
  egal(r('const t = `src/lib/a.ts`;'), ['src/lib/a.ts'], 'gabarit sans interpolation');
  egal(r('const t = `src/lib/${nom}.ts`;'), ['src/lib/*.ts'], 'gabarit interpolé : partie inconnue = *');
  egal(r(`const t = 'src/lib/' + nom;`), ['src/lib/*'], 'concaténation : partie inconnue = *');
  egal(r(`join('src', 'lib', 'a.ts');`), ['src/lib/a.ts'], 'join de littéraux (compté une fois, pas par littéral)');
  egal(r(`resolve('src', 'lib', 'a.ts');`), ['src/lib/a.ts'], 'resolve de littéraux');
  egal(r(`posix.join('src', 'lib');`), ['src/lib'], 'join qualifié (posix.join)');
  egal(r(`const R = join(dirname(fileURLToPath(import.meta.url)), '..'); readFileSync(join(R, 'src', 'a.ts'));`),
    ['src/a.ts'], 'racine reconstituée depuis import.meta.url, constante suivie');
  egal(r(`new URL('../src/lib/a.ts', import.meta.url);`), ['src/lib/a.ts'], 'new URL(…, import.meta.url) depuis tests/');
  egal(r(`const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1')); readFileSync(resolve(racine, 'src/lib/a.ts'));`),
    ['src/lib/a.ts'], 'racine par new URL(\'..\').pathname + correctif de lecteur Windows');
  egal(r(`new URL('../../src/lib/a.ts', import.meta.url);`, 'tests/rendu/x.ts'), ['src/lib/a.ts'], 'import.meta.url vaut le fichier analysé (sous-dossier)');
  egal(r(`new URL('../src/lib/a.ts', import.meta.url);`, 'tests/rendu/x.ts'), [], 'même URL depuis un sous-dossier : tests/src/…, pas src/');
  egal(r(`readFileSync(fileURLToPath(new URL('../src/a.ts', import.meta.url)));`), ['src/a.ts'], 'fileURLToPath(new URL(…))');
  egal(r(`const c = '../src/lib/a.ts';`), ['src/lib/a.ts'], 'littéral ../src résolu depuis le fichier');
  egal(r(`['src', 'lib', 'a.ts'].join('/');`), ['src/lib/a.ts'], 'assemblage par tableau.join');
  egal(r(`readdirSync('src');`), ['src'], 'dossier src seul');
  egal(r(`join(racine, 'src', 'a.ts');`), [], 'racine inconnue (paramètre) : non compté, angle mort déclaré');
  egal(r(`const a = 'tests/src/a.ts'; const b = 'srcs/a.ts'; const c = 'git add src/a.ts';`), [], 'préfixe voisin, dossier tests/src et chaîne à espace : non comptés');
  egal(r(`import x from '../src/lib/a';\nexport { y } from '../src/lib/b';\nimport('../src/lib/c');\nrequire('../src/lib/d');\ntype T = import('../src/lib/e').T;`),
    [], 'spécificateurs d’import (statique, réexport, dynamique, require, type) non comptés');
  egal(r(`// src/lib/a.ts\n/* '../src/lib/b.ts' */\nconst x = 1;`), [], 'commentaires non comptés');
  egal(r(`const a = 'src/a.ts'; const b = 'src/a.ts'; const c = 'src/b.ts';`), ['src/a.ts', 'src/a.ts', 'src/b.ts'], 'multiplicité conservée');
  egal(r(`const p = join(racine, 'src'); const q = 'src/z';`), ['src/z'], 'un join à début inconnu ne recompte pas son littéral interne');
  egal(r('const j = <a href="src/lib/a.ts" />;', 'tests/x.tsx'), ['src/lib/a.ts'], 'fichier .tsx analysé en TSX');
  egal(r(`const r = join(RACINE, 'src', 'a.ts');`, 'tests/y.ts'), [], 'constante importée non résolue : non comptée');
}

function comparaison(): void {
  titre('lecture-source — comparaison à la liste');
  const u = (fichier: string, cible: string, occurrences = 1): Usage => ({ fichier, cible, occurrences });
  const e = (fichier: string, cible: string, occurrences = 1, statut: Entree['statut'] = 'stock', justification?: string): Entree => ({
    fichier, cible, occurrences, statut, ...(justification ? { justification } : {}),
  });
  const vide: Ecarts = { nonListes: [], perimees: [], invalides: [] };

  egal(comparer([u('tests/a.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts')]), vide, 'identique : aucun écart');
  const remplace = comparer([u('tests/a.ts', 'src/y.ts')], [e('tests/a.ts', 'src/x.ts')]);
  ok(remplace.nonListes.length === 1 && remplace.perimees.length === 1,
    'usage remplacé à nombre constant : nouvel usage non listé ET ancienne entrée périmée');
  const nouveau = comparer([u('tests/a.ts', 'src/x.ts', 2)], [e('tests/a.ts', 'src/x.ts', 1)]);
  ok(nouveau.nonListes.length === 1 && nouveau.perimees.length === 0, 'usage nouveau dans un fichier listé : échec');
  const retire = comparer([u('tests/a.ts', 'src/x.ts', 1)], [e('tests/a.ts', 'src/x.ts', 2)]);
  ok(retire.perimees.length === 1 && retire.nonListes.length === 0, 'usage retiré sans décompte : échec (entrée périmée)');
  const disparu = comparer([], [e('tests/a.ts', 'src/x.ts')]);
  ok(disparu.perimees.length === 1, 'entrée dont l’usage a disparu : échec');
  const fichierNeuf = comparer([u('tests/neuf.test.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts')]);
  ok(fichierNeuf.nonListes.length === 1, 'usage dans un fichier absent de la liste : échec');
  egal(comparer([u('tests/a.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts', 1, 'exception', 'chemin factice')]), vide, 'exception justifiée : acceptée');
  ok(comparer([u('tests/a.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts', 1, 'exception')]).invalides.length === 1, 'exception sans justification : refusée');
  ok(comparer([], [e('tests/a.ts', 'src/x.ts', 1, 'autre' as Entree['statut'])]).invalides.length === 1, 'statut inconnu : refusé');
  ok(comparer([u('tests/a.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts'), e('tests/a.ts', 'src/x.ts')]).invalides.length === 1, 'doublon dans la liste : refusé');
}

function corpusTemporaire(): void {
  titre('lecture-source — corpus (suivis, non suivis, ignorés) dans un dépôt jetable');
  const dossier = mkdtempSync(join(tmpdir(), 'lecture-source-'));
  try {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dossier, stdio: 'pipe' });
    git('init', '-q');
    mkdirSync(join(dossier, 'tests'), { recursive: true });
    writeFileSync(join(dossier, '.gitignore'), 'tests/ignore.ts\n');
    writeFileSync(join(dossier, 'tests/suivi.ts'), `readFileSync('src/a.ts');\n`);
    git('add', '.gitignore', 'tests/suivi.ts');
    writeFileSync(join(dossier, 'tests/non-suivi.ts'), `readFileSync('src/b.ts');\nreadFileSync('src/b.ts');\n`);
    writeFileSync(join(dossier, 'tests/ignore.ts'), `readFileSync('src/c.ts');\n`);
    writeFileSync(join(dossier, 'tests/notes.md'), 'src/d.ts\n');
    egal(corpus(dossier), ['tests/non-suivi.ts', 'tests/suivi.ts'], 'fichier suivi et fichier non suivi retenus ; ignoré et non-code écartés');
    egal(releverDepot(dossier), [
      { fichier: 'tests/non-suivi.ts', cible: 'src/b.ts', occurrences: 2 },
      { fichier: 'tests/suivi.ts', cible: 'src/a.ts', occurrences: 1 },
    ], 'le fichier non suivi est compté, avec sa multiplicité');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

export async function testLectureSource() {
  formes();
  comparaison();
  corpusTemporaire();

  titre('lecture-source — références textuelles à src/ dans tests/');
  const liste = JSON.parse(readFileSync(join(RACINE, LISTE), 'utf8')) as { entrees: Entree[] };
  const usages = releverDepot(RACINE);
  const total = usages.reduce((s, x) => s + x.occurrences, 0);
  const { nonListes, perimees, invalides } = comparer(usages, liste.entrees);

  ok(invalides.length === 0, invalides.length === 0 ? 'liste bien formée (statuts, justifications, sans doublon)'
    : `liste mal formée :\n${invalides.map((i) => '         ' + i).join('\n')}`);
  ok(nonListes.length === 0, nonListes.length === 0
    ? `aucune référence à src/ hors de la liste (${total} usages, ${usages.length} identités)`
    : `référence à src/ non listée (la déclarer dans ${LISTE}, ou s’en passer) :\n${nonListes.map((i) => '         ' + i).join('\n')}`);
  ok(perimees.length === 0, perimees.length === 0
    ? 'aucune entrée périmée'
    : `entrée de la liste qui ne correspond plus (à retirer ou décompter) :\n${perimees.map((i) => '         ' + i).join('\n')}`);
}
