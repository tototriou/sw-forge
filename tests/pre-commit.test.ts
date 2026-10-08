// Garde-fou de commit (`.githooks/pre-commit`) — chemin privé, fichier
// démesuré, commit sur `main`, erreur ESLint dans le code indexé.
//
// Le hook source est lancé tel quel dans un dépôt jetable, sur une branche
// `forge/…` : c'est ce que Git exécute, une fois installé. Tout se passe
// dans un dossier temporaire.

import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
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
  titre('pre-commit — chemin privé, fichier démesuré, branche, ESLint');
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
    git(depot, 'switch', '-q', '-c', 'forge/essai');

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

    ok(passe(cas({ 'a.txt': 'a\n' })), 'branche forge/, fichier ordinaire : accepté');

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
    symlinkSync(join(RACINE, 'node_modules'), join(depot, 'node_modules'), 'junction');
    r = cas({ 'a.js': 'debugger;\n' });
    ok(refuse(r, LINT) && /a\.js/.test(r.sortie) && /no-debugger/.test(r.sortie), 'erreur ESLint dans un fichier indexé : refus, fichier et règle cités');
    ok(passe(cas({ 'a.js': 'const inutile = 1;\n' })), 'avertissement seul : accepté');
    ok(passe(cas({ 'a.js': 'debugger;\n', 'b.js': 'export const x = 1;\n' }, ['b.js'])), 'fichier fautif non indexé : non lu');
    ok(passe(cas({ 'notes.md': 'debugger;\n' })), 'fichier qui n’est pas du code : non lu');
    ok(refuse(cas({ 'a.js': 'export const x = 1;\n' }, undefined, { 'a.js': 'debugger;\n' }), LINT),
      'limite assumée : le lint lit l’arbre de travail, pas l’index');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
