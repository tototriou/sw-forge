// Garde-fou de commit (`.githooks/pre-commit`) — chemin privé, fichier
// démesuré, commit sur `main`, erreur ESLint dans le code indexé, référence à
// `src/` non déclarée dans un test indexé.
//
// Le hook source est lancé tel quel dans un dépôt jetable, sur une branche
// `feat/…` : c'est ce que Git exécute, une fois installé. Tout se passe
// dans un dossier temporaire.

import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(RACINE, '.githooks', 'pre-commit');

function git(depot: string, ...args: string[]): string {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
}

function ecrire(depot: string, rel: string, contenu: string | Buffer) {
  mkdirSync(dirname(join(depot, rel)), { recursive: true });
  writeFileSync(join(depot, rel), contenu);
}

// La sortie est gardée même en cas de succès : un avertissement s'y lit.
function lancer(depot: string): { code: number; sortie: string } {
  const r = spawnSync(process.execPath, [HOOK], { cwd: depot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { code: r.status ?? 1, sortie: (r.stdout ?? '') + (r.stderr ?? '') };
}

export function testPreCommit() {
  titre('pre-commit — chemin privé, fichier démesuré, branche, ESLint, références à src/');
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    ignore('pre-commit', 'git introuvable');
    return;
  }
  const bac = mkdtempSync(join(tmpdir(), 'swblacksmith-pre-commit-'));
  const depot = join(bac, 'code');
  try {
    mkdirSync(depot, { recursive: true });
    git(depot, 'init', '-b', 'main');
    git(depot, 'config', 'user.email', 'essai@local');
    git(depot, 'config', 'user.name', 'Essai');
    git(depot, 'config', 'core.quotePath', 'true');
    git(depot, 'config', 'core.autocrlf', 'false');
    ecrire(depot, 'README.md', 'base\n');
    git(depot, 'add', '-A');
    execFileSync('git', ['-C', depot, 'commit', '-q', '-F', '-'], { input: 'Base\n' });

    // Un refus se reconnaît à son diagnostic, pas au seul code de sortie :
    // un hook qui plante sort aussi en 1.
    const refuse = (r: { code: number; sortie: string }, motif: RegExp) =>
      r.code === 1 && /REFUSÉ — /.test(r.sortie) && motif.test(r.sortie);
    const passe = (r: { code: number }) => r.code === 0;

    /* ------------------------------------------------------- sur `main` */
    ecrire(depot, 'a.txt', 'a\n');
    git(depot, 'add', 'a.txt');
    ok(refuse(lancer(depot), /REFUSÉ — commit direct sur main/), 'commit sur main : refus');
    git(depot, 'reset', '-q', '--hard', 'HEAD');
    git(depot, 'clean', '-q', '-fd');
    git(depot, 'switch', '-q', '-c', 'feat/essai');

    // Un cas : fichiers écrits, chemins nommés indexés, puis, si demandé,
    // l'arbre de travail réécrit SANS réindexer ; hook lancé, dépôt remis à
    // la tête.
    type Fichiers = Record<string, string | Buffer>;
    const cas = (fichiers: Fichiers, indexes: string[] = Object.keys(fichiers), apres: Fichiers = {}) => {
      for (const [rel, contenu] of Object.entries(fichiers)) ecrire(depot, rel, contenu);
      git(depot, 'add', '-f', '--', ...indexes);
      for (const [rel, contenu] of Object.entries(apres)) ecrire(depot, rel, contenu);
      const r = lancer(depot);
      git(depot, 'reset', '-q', '--hard', 'HEAD');
      git(depot, 'clean', '-q', '-fd');
      return r;
    };

    const HORS_CONVENTION = /hors convention/;
    const accepte = cas({ 'a.txt': 'a\n' });
    ok(passe(accepte) && !HORS_CONVENTION.test(accepte.sortie), 'branche feat/, fichier ordinaire : accepté, sans avertissement');

    /* ---------------------------------------------- nom de la branche */
    // Le nom ne refuse jamais : il avertit, pour ne pas bloquer une branche
    // ancienne légitime.
    for (const [nom, conforme] of [['docs/segmentation', true], ['forge/essai', false], ['essai', false], ['feat/a/b', false]] as const) {
      git(depot, 'switch', '-q', '-c', nom);
      const r = cas({ 'a.txt': 'a\n' });
      ok(passe(r) && HORS_CONVENTION.test(r.sortie) === !conforme,
        `branche ${nom} : ${conforme ? 'aucun avertissement' : 'avertissement, pas de refus'}`);
      git(depot, 'switch', '-q', 'feat/essai');
    }

    /* ------------------------------------------------------ chemin privé */
    const PRIVE = /REFUSÉ — chemin privé/;
    ok(refuse(cas({ '.vscode/settings.json': '{}\n' }), PRIVE), '`.vscode/` : refus');
    ok(refuse(cas({ '.history/é.md': 'x\n' }), PRIVE), '`.history/` sous un nom non ASCII : refus');

    /* -------------------------------------------------- fichier démesuré */
    let r = cas({ 'gros.json': Buffer.alloc(6 * 1024 * 1024, 0x61) });
    ok(refuse(r, /Mo dans l’index : gros\.json/), 'fichier de plus de 5 Mo : refus');
    ok(passe(cas({ 'moyen.json': Buffer.alloc(4 * 1024 * 1024, 0x61) })), 'fichier de 4 Mo : accepté');

    /* ------------------------------------------------ ESLint sur le code indexé */
    // Configuration minimale à elle, ESLint du dépôt par une jonction vers son
    // `node_modules`, ignoré par Git : `git clean` n'y touche jamais.
    const LINT = /REFUSÉ — ESLint refuse le code indexé/;
    ok(passe(cas({ 'a.js': 'debugger;\n' })), 'sans eslint.config.js (branche antérieure au lint) : pas de lint');
    ecrire(depot, '.gitignore', 'node_modules\n');
    ecrire(depot, 'package.json', '{ "type": "module" }\n');
    ecrire(depot, 'eslint.config.js',
      "export default [{ rules: { 'no-debugger': 'error', 'no-unused-vars': 'warn' } }];\n");
    git(depot, 'add', '-A');
    execFileSync('git', ['-C', depot, 'commit', '-q', '--no-verify', '-F', '-'], { input: 'Lint\n' });
    r = cas({ 'a.js': 'debugger;\n' });
    ok(passe(r) && /ESLint absent/.test(r.sortie), 'ESLint absent : lint sauté, avertissement, commit accepté');

    /* ------------------------- références à src/ dans les tests : base */
    // Le module de la règle copié du dépôt, une liste à une entrée `stock`,
    // le test qui la porte. Les cibles sont des constantes : un seul usage
    // chacune dans ce fichier, déclaré en `exception` dans la vraie liste.
    const MODULE = 'scripts/lib/lectureSource.ts';
    const LISTE = 'tests/fixtures/lecture-source-toleree.json';
    const A = 'src/a.ts';
    const B = 'src/b.ts';
    type E = { fichier: string; cible: string; occurrences: number; statut: string; justification?: string };
    const liste = (...entrees: E[]) => JSON.stringify({ entrees }, null, 2) + '\n';
    const lit = (cible: string) => `import { readFileSync } from 'fs';\nreadFileSync('${cible}', 'utf8');\n`;
    const SANS_LECTURE = 'export const x = 1;\n';
    const STOCK: E = { fichier: 'tests/stock.test.ts', cible: A, occurrences: 1, statut: 'stock' };
    const EXCEPTION_B: E = { fichier: 'tests/neuf.test.ts', cible: B, occurrences: 1, statut: 'exception', justification: 'essai' };
    ecrire(depot, MODULE, readFileSync(join(RACINE, MODULE)));
    ecrire(depot, LISTE, liste(STOCK));
    ecrire(depot, 'tests/stock.test.ts', lit(A));
    git(depot, 'add', '-A');
    execFileSync('git', ['-C', depot, 'commit', '-q', '--no-verify', '-F', '-'], { input: 'Garde\n' });
    r = cas({ 'tests/neuf.test.ts': lit(B) });
    ok(passe(r) && /TypeScript absent/.test(r.sortie), 'TypeScript absent : références à src/ non vérifiées, avertissement, commit accepté');

    symlinkSync(join(RACINE, 'node_modules'), join(depot, 'node_modules'), 'junction');
    r = cas({ 'a.js': 'debugger;\n' });
    ok(refuse(r, LINT) && /a\.js/.test(r.sortie) && /no-debugger/.test(r.sortie), 'erreur ESLint dans un fichier indexé : refus, fichier et règle cités');
    ok(passe(cas({ 'a.js': 'const inutile = 1;\n' })), 'avertissement seul : accepté');
    ok(passe(cas({ 'a.js': 'debugger;\n', 'b.js': 'export const x = 1;\n' }, ['b.js'])), 'fichier fautif non indexé : non lu');
    ok(passe(cas({ 'notes.md': 'debugger;\n' })), 'fichier qui n’est pas du code : non lu');
    ok(refuse(cas({ 'a.js': 'export const x = 1;\n' }, undefined, { 'a.js': 'debugger;\n' }), LINT),
      'limite assumée : le lint lit l’arbre de travail, pas l’index');

    /* ------------------------------- références à src/ dans les tests */
    const LECTURE = /REFUSÉ — référence à `src\/` non déclarée dans un test/;
    r = cas({ 'tests/neuf.test.ts': lit(B) });
    ok(refuse(r, LECTURE) && /tests\/neuf\.test\.ts → src\/b\.ts \(1, absent de la liste\)/.test(r.sortie) && /`exception`/.test(r.sortie),
      'lecture nouvelle indexée : refus, fichier, cible et nombre cités, conduite dite');
    ok(passe(cas({ 'tests/neuf.test.ts': lit(B), [LISTE]: liste(STOCK, EXCEPTION_B) })),
      'même lecture déclarée en exception dans la liste indexée : accepté');
    ok(refuse(cas({ 'tests/neuf.test.ts': lit(B), [LISTE]: liste(STOCK, { ...EXCEPTION_B, justification: ' ' }) }), /exception sans justification/),
      'exception sans justification : refus');
    ok(refuse(cas({ 'tests/neuf.test.ts': lit(B) }, ['tests/neuf.test.ts'], { [LISTE]: liste(STOCK, EXCEPTION_B) }), LECTURE),
      'exception écrite sur le disque mais pas indexée : refus (la liste se lit dans l’index)');
    ok(passe(cas({ 'tests/neuf.test.ts': SANS_LECTURE }, undefined, { 'tests/neuf.test.ts': lit(B) })),
      'lecture dans l’arbre de travail mais pas dans l’index (staging partiel) : accepté');
    ok(refuse(cas({ 'tests/neuf.test.ts': lit(B) }, undefined, { 'tests/neuf.test.ts': SANS_LECTURE }), LECTURE),
      'lecture dans l’index, retirée de l’arbre de travail seulement : refus');
    r = cas({ 'tests/stock.test.ts': SANS_LECTURE });
    ok(refuse(r, LECTURE) && /tests\/stock\.test\.ts → src\/a\.ts \(liste : 1, relevé : 0\)/.test(r.sortie),
      'retrait d’une lecture stock sans mise à jour de la liste : refus, nombres cités');
    ok(passe(cas({ 'tests/stock.test.ts': SANS_LECTURE, [LISTE]: liste() })), 'retrait d’une lecture avec son entrée : accepté');
    ok(refuse(cas({ [LISTE]: liste() }), /tests\/stock\.test\.ts → src\/a\.ts \(1, absent de la liste\)/),
      'entrée retirée de la liste seule, lecture gardée : refus (le fichier dont la liste change est jugé)');
    // Suppression et renommage : par Git, puis dépôt remis à la tête.
    const gitCas = (preparer: () => void) => {
      preparer();
      const res = lancer(depot);
      git(depot, 'reset', '-q', '--hard', 'HEAD');
      git(depot, 'clean', '-q', '-fd');
      return res;
    };
    ok(refuse(gitCas(() => git(depot, 'rm', '-q', 'tests/stock.test.ts')), /tests\/stock\.test\.ts → src\/a\.ts \(liste : 1, relevé : 0\)/),
      'fichier de test supprimé, son entrée gardée : refus');
    ok(passe(gitCas(() => { git(depot, 'rm', '-q', 'tests/stock.test.ts'); ecrire(depot, LISTE, liste()); git(depot, 'add', LISTE); })),
      'fichier de test supprimé avec son entrée : accepté');
    r = gitCas(() => git(depot, 'mv', 'tests/stock.test.ts', 'tests/renomme.test.ts'));
    ok(refuse(r, /tests\/renomme\.test\.ts → src\/a\.ts \(1, absent de la liste\)/) && /tests\/stock\.test\.ts → src\/a\.ts \(liste : 1/.test(r.sortie),
      'fichier de test renommé sans la liste : refus, sur l’ancien et le nouveau nom');
    // Un module qui casse à son chargement prouve si l'étape a tourné.
    const CASSE = { [MODULE]: 'throw new Error("cassé");\n' };
    r = cas({ 'a.txt': 'a\n' }, undefined, CASSE);
    ok(passe(r) && !/lectureSource/.test(r.sortie), 'commit sans fichier de tests/ : étape non exécutée (module cassé jamais chargé)');
    r = cas({ 'tests/neuf.test.ts': SANS_LECTURE }, undefined, CASSE);
    ok(passe(r) && /lectureSource\.ts non chargé/.test(r.sortie), 'témoin : fichier de tests/ indexé, module cassé : avertissement, commit accepté');
    rmSync(join(depot, MODULE));
    r = cas({ 'tests/neuf.test.ts': lit(B) });
    ok(passe(r) && /lectureSource\.ts introuvable/.test(r.sortie), 'module introuvable, liste présente : avertissement, commit accepté');
    // Une vraie fusion arrêtée avant son commit : l'index porte la lecture.
    git(depot, 'switch', '-q', '-c', 'feat/autre');
    ecrire(depot, 'tests/neuf.test.ts', lit(B));
    git(depot, 'add', 'tests/neuf.test.ts');
    execFileSync('git', ['-C', depot, 'commit', '-q', '--no-verify', '-F', '-'], { input: 'Autre\n' });
    git(depot, 'switch', '-q', 'feat/essai');
    git(depot, 'merge', '-q', '--no-commit', '--no-ff', 'feat/autre');
    r = lancer(depot);
    git(depot, 'merge', '--abort');
    ok(passe(r) && !LECTURE.test(r.sortie), 'fusion en cours (MERGE_HEAD) : étape sautée');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
