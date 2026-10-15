// Rappel des dépendances (`.githooks/post-checkout`, `.githooks/post-merge`) —
// docs/03-developpeur/qualite-code.md, « Rappel des dépendances ».
//
// Les hooks sources sont lancés tels quels dans un dépôt jetable, après de
// vraies opérations Git, avec les arguments que Git leur passe.

import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKOUT = join(RACINE, '.githooks', 'post-checkout');
const MERGE = join(RACINE, '.githooks', 'post-merge');
const RAPPEL = /package-lock\.json a changé : lancer `npm ci`/;

export function testRappelDependances() {
  titre('rappel des dépendances — post-checkout et post-merge');
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    ignore('rappel des dépendances', 'git introuvable');
    return;
  }
  const depot = mkdtempSync(join(tmpdir(), 'swblacksmith-rappel-deps-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
  const commiter = (fichier: string, contenu: string, message: string) => {
    writeFileSync(join(depot, fichier), contenu);
    git('add', fichier);
    execFileSync('git', ['-C', depot, 'commit', '-q', '-F', '-'], { input: message, encoding: 'utf8' });
    return git('rev-parse', 'HEAD');
  };
  const lancer = (hook: string, ...args: string[]) => {
    const r = spawnSync(process.execPath, [hook, ...args], { cwd: depot, encoding: 'utf8' });
    return { code: r.status ?? 1, sortie: (r.stdout ?? '') + (r.stderr ?? '') };
  };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'essai@local');
    git('config', 'user.name', 'Essai');
    const base = commiter('package-lock.json', '{"v":1}\n', 'chore: base\n');
    const autre = commiter('README.md', 'texte\n', 'docs: sans dépendance\n');
    git('switch', '-q', '-c', 'deps', base);
    const deps = commiter('package-lock.json', '{"v":2}\n', 'build: dépendance\n');

    let r = lancer(CHECKOUT, autre, deps, '1');
    ok(r.code === 0 && RAPPEL.test(r.sortie), 'changement de branche qui change package-lock.json : rappel');
    r = lancer(CHECKOUT, base, autre, '1');
    ok(r.code === 0 && !RAPPEL.test(r.sortie), 'changement de branche sans changement de dépendances : silence');
    r = lancer(CHECKOUT, autre, deps, '0');
    ok(r.code === 0 && !RAPPEL.test(r.sortie), 'checkout de fichiers : silence');
    r = lancer(CHECKOUT, '0000000000000000000000000000000000000000', deps, '1');
    ok(r.code === 0 && !RAPPEL.test(r.sortie), 'premier checkout (clone) : silence');

    git('switch', '-q', 'main');
    git('-c', 'core.hooksPath=', 'merge', '-q', '--no-ff', '--no-edit', 'deps');
    r = lancer(MERGE, '0');
    ok(r.code === 0 && RAPPEL.test(r.sortie), 'fusion qui change package-lock.json : rappel');
    git('-c', 'core.hooksPath=', 'merge', '-q', '--no-edit', 'deps');
    commiter('README.md', 'autre texte\n', 'docs: encore\n');
    git('update-ref', 'ORIG_HEAD', 'HEAD~1');
    r = lancer(MERGE, '0');
    ok(r.code === 0 && !RAPPEL.test(r.sortie), 'fusion sans changement de dépendances : silence');
  } finally {
    // depot provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(depot, { recursive: true, force: true });
  }
}
