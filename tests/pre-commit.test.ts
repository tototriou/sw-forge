// Garde-fou de commit (`.githooks/pre-commit`) — chemins privés de l'index ;
// spec/outillage/spec.md, ex-B.9.
//
// Le hook source est lancé tel quel dans un dépôt jetable, sur une branche
// `forge/…` : c'est ce que Git exécute, une fois installé. Tout se passe
// dans un dossier temporaire.

import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(RACINE, '.githooks', 'pre-commit');

function git(depot: string, ...args: string[]): string {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
}

function ecrire(depot: string, rel: string, contenu: string) {
  mkdirSync(dirname(join(depot, rel)), { recursive: true });
  writeFileSync(join(depot, rel), contenu);
}

function lancer(depot: string): { code: number; sortie: string } {
  try {
    execFileSync(process.execPath, [HOOK], { cwd: depot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, sortie: '' };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

export function testPreCommit() {
  titre('pre-commit — chemins privés de l’index');
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
    git(depot, 'switch', '-q', '-c', 'forge/essai');

    // Un cas : fichiers écrits, chemins nommés indexés, hook lancé, dépôt
    // remis à la tête.
    const cas = (fichiers: Record<string, string>, indexes: string[] = Object.keys(fichiers)) => {
      for (const [rel, contenu] of Object.entries(fichiers)) ecrire(depot, rel, contenu);
      git(depot, 'add', '--', ...indexes);
      const r = lancer(depot);
      git(depot, 'reset', '-q', '--hard', 'HEAD');
      git(depot, 'clean', '-q', '-fd');
      return r;
    };
    const refuse = (r: { code: number }) => r.code === 1;
    const passe = (r: { code: number }) => r.code === 0;

    ok(passe(cas({ 'src/a.ts': 'export {};\n' })), 'chemin ordinaire : accepté');
    ok(refuse(cas({ '.history/a.md': 'x\n' })), '`.history/` : refus');
    ok(refuse(cas({ '.history/é.md': 'x\n' })), '`.history/` sous un nom non ASCII : refus (chemin non cité)');
    ok(refuse(cas({ '.vscode/réglages.json': '{}\n' })), '`.vscode/` sous un nom non ASCII : refus');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
