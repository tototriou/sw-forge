// Garde-fous rejoués en CI (`scripts/verifier-commits.mjs`, et le mode
// `--commit` de `.githooks/pre-commit`) — spec/outillage/qualite-code.md
// § Garde-fous rejoués en CI.
//
// Dépôt jetable SANS hooks câblés : chaque commit fautif y entre comme avec
// `--no-verify`, et c'est le script qui doit le rattraper.

import { execFileSync, spawnSync } from 'child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['.githooks/pre-commit', '.githooks/commit-msg', 'scripts/verifier-commits.mjs'];

export function testVerifierCommits() {
  titre('Garde-fous rejoués en CI — message et contenu de chaque commit de la PR');
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    ignore('verifier-commits', 'git introuvable');
    return;
  }
  const bac = mkdtempSync(join(tmpdir(), 'swblacksmith-verifier-commits-test-'));
  const depot = join(bac, 'code');
  const git = (...args: string[]) => execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
  const ecrire = (rel: string, contenu: string | Buffer) => {
    mkdirSync(dirname(join(depot, rel)), { recursive: true });
    writeFileSync(join(depot, rel), contenu);
  };
  const commiter = (message: string, fichiers: Record<string, string | Buffer> = {}, retirer: string[] = []) => {
    for (const [rel, contenu] of Object.entries(fichiers)) ecrire(rel, contenu);
    for (const rel of retirer) git('rm', '-q', rel);
    git('add', '-A');
    execFileSync('git', ['-C', depot, 'commit', '-q', '--allow-empty', '-F', '-'], { input: message });
    return git('rev-parse', 'HEAD');
  };
  const verifier = (base: string) => {
    const r = spawnSync(process.execPath, [join(depot, 'scripts', 'verifier-commits.mjs'), base, 'HEAD'],
      { cwd: depot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: r.status ?? 1, sortie: (r.stdout ?? '') + (r.stderr ?? '') };
  };
  try {
    mkdirSync(depot, { recursive: true });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'essai@local');
    git('config', 'user.name', 'Essai');
    git('config', 'core.autocrlf', 'false');
    for (const rel of SOURCES) {
      mkdirSync(dirname(join(depot, rel)), { recursive: true });
      cpSync(join(RACINE, rel), join(depot, rel));
    }
    const base = commiter('chore: base\n');
    git('switch', '-q', '-c', 'forge/essai');

    commiter('feat: un bon commit\n\nCorps.\n', { 'a.txt': 'a\n' });
    let r = verifier(base);
    ok(r.code === 0 && /1 commit\(s\) vérifié/.test(r.sortie), 'commits conformes : accepté');

    // Chaque cas repart de la même tête.
    const tete = git('rev-parse', 'HEAD');
    const cas = (preparer: () => void) => {
      preparer();
      const resultat = verifier(base);
      git('reset', '-q', '--hard', tete);
      return resultat;
    };

    r = cas(() => commiter('mauvais message\n', { 'b.txt': 'b\n' }));
    ok(r.code === 1 && /mauvais message/.test(r.sortie) && /sujet hors de la forme/.test(r.sortie),
      'message fautif (fait avec --no-verify) : refusé, commit cité');
    r = cas(() => commiter('feat: réglages\n', { '.vscode/settings.json': '{}\n' }));
    ok(r.code === 1 && /chemin privé/.test(r.sortie), 'chemin privé : refusé');
    r = cas(() => {
      commiter('feat: export\n', { 'gros.json': Buffer.alloc(6 * 1024 * 1024, 0x61) });
      commiter('fix: retire l’export\n', {}, ['gros.json']);
    });
    ok(r.code === 1 && /Mo dans l’index : gros\.json/.test(r.sortie) && /1 commit\(s\) sur 3 refusé/.test(r.sortie),
      'fichier ajouté puis retiré dans la même PR : l’historique compte, refusé');
    r = cas(() => commiter('feat: x\nCorps collé.\n', { '.history/a.md': 'x\n' }));
    ok(r.code === 1 && /pas de ligne vide/.test(r.sortie) && /chemin privé/.test(r.sortie),
      'message et contenu fautifs dans un même commit : les deux cités');

    // Une fusion écrite par Git passe ; son contenu est celui de ses parents.
    r = cas(() => {
      git('switch', '-q', '-c', 'forge/autre', base);
      commiter('feat: autre\n', { 'c.txt': 'c\n' });
      git('switch', '-q', 'forge/essai');
      git('merge', '-q', '--no-ff', '--no-edit', 'forge/autre');
    });
    ok(r.code === 0 && /3 commit\(s\) vérifié/.test(r.sortie), 'fusion au message de Git : acceptée');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
