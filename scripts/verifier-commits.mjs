#!/usr/bin/env node
// Rejoue les garde-fous de commit sur chaque commit d'une pull request —
// étape « Garde-fous de commit » de `.github/workflows/tests.yml`. Contrat :
// docs/03-developpeur/ § Garde-fous rejoués en CI.
//
//   node scripts/verifier-commits.mjs <base> <tête>
//
// `--no-verify` reste possible en local, pas dans la CI : un commit qui a
// sauté ses hooks est rattrapé ici. Chaque commit de `<base>..<tête>` passe
// par `.githooks/commit-msg` (son message) et, hors fusion, par
// `.githooks/pre-commit --commit` (son contenu) : l'historique d'un dépôt
// public l'est aussi, un fichier ajouté puis retiré dans la même PR compte.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROUGE = '\x1b[31m';
const VERT = '\x1b[32m';
const FIN = '\x1b[0m';

const [base, tete] = process.argv.slice(2);
if (!base || !tete) {
  console.error('Usage : node scripts/verifier-commits.mjs <base> <tête>');
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const racine = git('rev-parse', '--show-toplevel');
const hook = (nom) => join(racine, '.githooks', nom);

const commits = git('rev-list', '--reverse', `${base}..${tete}`).split('\n').filter(Boolean);
const bac = mkdtempSync(join(tmpdir(), 'swblacksmith-verifier-commits-'));
const fautifs = [];
try {
  for (const sha of commits) {
    const sorties = [];
    const fichier = join(bac, 'message');
    writeFileSync(fichier, git('log', '-1', '--format=%B', sha) + '\n');
    const message = spawnSync(process.execPath, [hook('commit-msg'), fichier], { cwd: racine, encoding: 'utf8' });
    if (message.status !== 0) sorties.push((message.stdout ?? '') + (message.stderr ?? ''));
    // Une fusion n'apporte pas de contenu à elle : ses parents sont vérifiés.
    const parents = git('rev-list', '--parents', '-n', '1', sha).split(' ').length - 1;
    if (parents === 1) {
      const contenu = spawnSync(process.execPath, [hook('pre-commit'), '--commit', sha], { cwd: racine, encoding: 'utf8' });
      if (contenu.status !== 0) sorties.push((contenu.stdout ?? '') + (contenu.stderr ?? ''));
    }
    if (sorties.length > 0) fautifs.push({ sha, sujet: git('log', '-1', '--format=%s', sha), sorties });
  }
} finally {
  rmSync(bac, { recursive: true, force: true });
}

if (fautifs.length === 0) {
  console.log(`${VERT}${commits.length} commit(s) vérifié(s) : message et contenu conformes.${FIN}`);
  process.exit(0);
}

for (const { sha, sujet, sorties } of fautifs) {
  console.error(`${ROUGE}── ${sha.slice(0, 7)} ${sujet}${FIN}`);
  for (const s of sorties) console.error(s.trim());
  console.error('');
}
console.error(`${ROUGE}${fautifs.length} commit(s) sur ${commits.length} refusé(s).${FIN} ` +
  'Corriger l’historique de la branche (`git rebase -i`, puis pousser avec `--force-with-lease`).');
process.exit(1);
