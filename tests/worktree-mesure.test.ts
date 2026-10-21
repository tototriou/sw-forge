import { createRequire, syncBuiltinESMExports } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { avecWorktreeMesure, creerWorktreeMesure } from '../scripts/lib/worktreeMesure';
import { egal, ok, titre } from './outils';

function bac() {
  const racine = mkdtempSync(join(tmpdir(), 'swblacksmith-test-worktree-'));
  const depot = join(racine, 'depot');
  mkdirSync(depot);
  const git = (...args: string[]) => execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  writeFileSync(join(depot, 'suivi.txt'), 'source suivie');
  writeFileSync(join(depot, '.gitignore'), 'node_modules/\ncompte.txt\n');
  git('add', '--', 'suivi.txt', '.gitignore');
  const message = join(racine, 'message.txt');
  writeFileSync(message, 'fixture');
  git('commit', '-F', message);
  mkdirSync(join(depot, 'node_modules'));
  writeFileSync(join(depot, 'node_modules', 'temoin.txt'), 'modules intacts');
  writeFileSync(join(depot, 'compte.txt'), 'fichier intact');
  return {
    racine, depot, git,
    temoins() {
      egal(readFileSync(join(depot, 'node_modules', 'temoin.txt'), 'utf8'), 'modules intacts', 'la cible de la jonction existe et reste intacte');
      egal(readFileSync(join(depot, 'compte.txt'), 'utf8'), 'fichier intact', 'la cible du lien de fichier reste intacte');
    },
    retirer() {
      // Ce bac n’est pas un worktree de mesure et ne contient plus de lien.
      const rel = relative(resolve(tmpdir()), resolve(racine));
      if (!rel.startsWith('swblacksmith-test-worktree-') || rel.includes('..')) throw Error('Bac hors répertoire temporaire');
      rmSync(racine, { recursive: true, force: true });
    },
  };
}
function refuse(action: () => unknown, motif: string) {
  let erreur = '';
  try { action(); } catch (e) { erreur = String(e); }
  ok(erreur.includes(motif), `refus explicite : ${motif} (${erreur})`);
}

export async function testWorktreeMesureCycle() {
  titre('Worktree de mesure — cycle réel et exception');
  const b = bac();
  try {
    const m = creerWorktreeMesure(b.depot, 'HEAD');
    try {
      egal(m.lier('node_modules'), 'lie', 'la dépendance devient une jonction explicite');
      egal(m.lier('compte.txt'), 'lie', 'le fichier ignoré est lié explicitement');
      egal(m.lier('suivi.txt'), 'suivi', 'un fichier suivi conserve sa version du commit');
      egal(m.lier('absent.txt'), 'absent', 'une source absente est annoncée');
      egal(readFileSync(join(m.dossier, 'suivi.txt'), 'utf8'), 'source suivie', 'le fichier suivi n’est pas remplacé');
      refuse(() => m.lier('../depot'), 'Nom de lien refusé');
      refuse(() => m.lier('node_modules'), 'Destination déjà présente');
      writeFileSync(join(m.dossier, 'suivi.txt'), 'modification jetable');
    } finally { m.retirer(); }
    m.retirer();
    ok(!existsSync(m.dossier) && !existsSync(m.manifeste), 'le worktree et son manifeste sont retirés, retrait idempotent');
    b.temoins();
    let erreur = '';
    let dossier = '';
    try {
      await avecWorktreeMesure(b.depot, 'HEAD', ['node_modules', 'compte.txt'], async (p) => { dossier = p; throw Error('échec simulé'); });
    } catch (e) { erreur = String(e); }
    ok(erreur.includes('échec simulé') && !existsSync(dossier), 'une exception nettoie avant de rendre l’échec');
    b.temoins();
    refuse(() => creerWorktreeMesure(b.depot, '--help'), 'Command failed');
    egal((b.git('worktree', 'list', '--porcelain').match(/^worktree /gm) ?? []).length, 1, 'seul le dépôt témoin reste enregistré');
  } finally { b.retirer(); }
}

export function testWorktreeMesureRefus() {
  titre('Worktree de mesure — refus conservateurs');
  const b = bac();
  try {
    const m = creerWorktreeMesure(b.depot, 'HEAD');
    m.lier('node_modules');
    const jonction = join(m.dossier, 'node_modules');
    const autre = join(b.racine, 'autre');
    mkdirSync(autre);
    writeFileSync(join(autre, 'temoin.txt'), 'autre intact');
    unlinkSync(jonction);
    symlinkSync(autre, jonction, 'junction');
    refuse(() => m.retirer(), 'Cible du lien changée');
    ok(existsSync(m.dossier), 'une jonction déplacée conserve le worktree');
    egal(readFileSync(join(autre, 'temoin.txt'), 'utf8'), 'autre intact', 'la cible inattendue est intacte');
    unlinkSync(jonction);
    symlinkSync(join(b.depot, 'node_modules'), jonction, 'junction');
    const inconnu = join(m.dossier, 'inconnu');
    symlinkSync(autre, inconnu, 'junction');
    refuse(() => m.retirer(), 'Lien inattendu');
    ok(existsSync(jonction), 'aucun lien connu n’est retiré quand un lien inconnu subsiste');
    unlinkSync(inconnu);
    const original = readFileSync(m.manifeste, 'utf8');
    writeFileSync(m.manifeste, '{}');
    refuse(() => m.retirer(), 'Manifeste modifié');
    writeFileSync(m.manifeste, original);
    execFileSync('git', ['-C', m.dossier, 'switch', '-c', 'travail'], { stdio: 'pipe' });
    refuse(() => m.retirer(), 'plus détaché');
    execFileSync('git', ['-C', m.dossier, 'switch', '--detach'], { stdio: 'pipe' });
    m.retirer();
    b.temoins();
    egal(readFileSync(join(autre, 'temoin.txt'), 'utf8'), 'autre intact', 'le nettoyage final préserve aussi l’autre cible');
  } finally { b.retirer(); }
}
export function testWorktreeMesureLienPhysique() {
  titre('Worktree de mesure — repli sans droit de symlink');
  const b = bac();
  const fs = createRequire(import.meta.url)('node:fs') as typeof import('node:fs');
  const original = fs.symlinkSync;
  const m = creerWorktreeMesure(b.depot, 'HEAD');
  try {
    // Simuler le refus Windows, puis créer un vrai lien physique par le repli.
    fs.symlinkSync = ((cible, destination, genre) => {
      if (genre === 'file') throw Object.assign(new Error('Droit de symlink absent'), { code: 'EPERM' });
      return original(cible, destination, genre);
    }) as typeof fs.symlinkSync;
    syncBuiltinESMExports();
    egal(m.lier('compte.txt'), 'lie', 'EPERM se replie sur un vrai lien physique');
    const fichier = join(m.dossier, 'compte.txt');
    egal(fs.lstatSync(fichier).ino, fs.statSync(join(b.depot, 'compte.txt')).ino, 'les deux entrées portent le même fichier');
    ok(!fs.lstatSync(fichier).isSymbolicLink(), 'le repli ne laisse pas un symlink');
    unlinkSync(fichier);
    writeFileSync(fichier, 'remplacement');
    refuse(() => m.retirer(), 'Lien physique remplacé');
    unlinkSync(fichier);
    fs.linkSync(join(b.depot, 'compte.txt'), fichier);
    m.retirer();
    b.temoins();
  } finally {
    fs.symlinkSync = original;
    syncBuiltinESMExports();
    if (existsSync(m.dossier)) m.retirer();
    b.retirer();
  }
}
