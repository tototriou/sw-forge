// Installateur public des garde-fous (`scripts/installer-hooks.mjs`), à la
// main et par `npm install` (`--automatique`).
//
// Le dépôt jetable ne porte que les sources publiques : l'installateur doit
// fonctionner seul. Tout se passe dans un dossier
// temporaire ; aucune installation réelle n'est touchée.

import { execFileSync, spawnSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { egal, ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICS = ['.githooks/pre-commit', '.githooks/commit-msg', 'scripts/lib/spec-markdown.mjs', 'scripts/spec-lint.mjs'];

type Entree = { proprietaire: string; source: string; commit: string; date: string };
type Manifeste = { version?: number; commitSource: string; fichiers: Record<string, string>; entrees?: Record<string, Entree> };

function git(depot: string, ...args: string[]): string {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
}

function gitDisponible(libelle: string): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    ignore(libelle, 'git introuvable');
    return false;
  }
}

function depotJetable(chemin: string) {
  mkdirSync(chemin, { recursive: true });
  git(chemin, 'init', '-b', 'main');
  git(chemin, 'config', 'user.email', 'essai@local');
  git(chemin, 'config', 'user.name', 'Essai');
}

function commiter(depot: string, message: string) {
  git(depot, 'add', '-A');
  execFileSync('git', ['-C', depot, 'commit', '-F', '-'], { input: message, encoding: 'utf8' });
}

// Dépôt de code jetable avec les SEULES sources publiques.
function depotPublic(code: string) {
  depotJetable(code);
  for (const rel of [...PUBLICS, 'scripts/installer-hooks.mjs']) {
    mkdirSync(dirname(join(code, rel)), { recursive: true });
    cpSync(join(RACINE, rel), join(code, rel));
  }
  commiter(code, 'Base code\n');
}

function installerPublic(cwd: string, ...args: string[]): { code: number; sortie: string } {
  try {
    const sortie = execFileSync(process.execPath, [join(cwd, 'scripts', 'installer-hooks.mjs'), ...args],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

function installation(code: string): string {
  return join(code, '.git', 'forge', 'installation');
}

function lireManifeste(code: string): Manifeste {
  return JSON.parse(readFileSync(join(installation(code), 'manifeste.json'), 'utf8'));
}

function ecrireManifeste(code: string, m: unknown) {
  writeFileSync(join(installation(code), 'manifeste.json'), JSON.stringify(m, null, 2) + '\n');
}

function installe(code: string, rel: string): string {
  return rel.startsWith('.githooks/')
    ? join(installation(code), 'hooks', rel.slice('.githooks/'.length))
    : join(installation(code), ...rel.split('/'));
}

function sha(chemin: string): string {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex');
}

function cablage(code: string): string {
  try { return git(code, 'config', 'core.hooksPath'); } catch { return ''; }
}

// Le dossier temporaire sous son nom LONG. Sous Windows, `tmpdir()` peut
// renvoyer un nom court 8.3 (`C:\Users\RUNNER~1\…` sur les machines de la
// CI), alors que Git — et donc l'installateur et le garde-fou — donne le nom
// long : les chemins comparés ne se ressembleraient plus.
function bacTemporaire(prefixe: string): string {
  return realpathSync.native(mkdtempSync(join(tmpdir(), prefixe)));
}

function memeChemin(a: string, b: string): boolean {
  const n = (p: string) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));
  return n(a) === n(b);
}

export function testInstallerHooks() {
  titre('Installateur public — manifeste par entrée, câblage, anciens chemins');
  if (!gitDisponible('installateur public')) return;
  const bac = bacTemporaire('swblacksmith-installer-hooks-');
  const code = join(bac, 'code');
  try {
    depotPublic(code);
    const tete = git(code, 'rev-parse', 'HEAD');

    /* ---------------------------------------------------------- simulation */
    let r = installerPublic(code, '--simulation');
    ok(r.code === 0 && /simulation/i.test(r.sortie), '--simulation : réussit et s’annonce');
    ok(!existsSync(installation(code)) && cablage(code) === '', '--simulation : rien d’installé ni de câblé');

    /* ----------------------------------------------------------- --sans-cablage */
    r = installerPublic(code, '--sans-cablage');
    ok(r.code === 0, '--sans-cablage : réussit');
    ok(cablage(code) === '', '--sans-cablage en dernière position : core.hooksPath non posé');
    ok(existsSync(installe(code, '.githooks/pre-commit')), '--sans-cablage : les fichiers sont installés quand même');

    /* ---------------------------------------------------------- installation */
    r = installerPublic(code);
    ok(r.code === 0, 'installation publique : réussit');
    ok(memeChemin(git(code, 'config', 'core.hooksPath'), join(installation(code), 'hooks')),
      'core.hooksPath câblé sur l’installation');
    let m = lireManifeste(code);
    egal(m.version, 2, 'manifeste en version 2');
    egal(Object.keys(m.fichiers).sort(), [...PUBLICS].sort(), 'le manifeste porte les chemins publics, et eux seuls');
    ok(PUBLICS.every((rel) => m.fichiers[rel] === sha(installe(code, rel))),
      'chaque empreinte est celle des octets INSTALLÉS');
    ok(PUBLICS.every((rel) => m.entrees?.[rel]?.proprietaire === 'public' && m.entrees?.[rel]?.commit === tete &&
      typeof m.entrees?.[rel]?.source === 'string' && !Number.isNaN(Date.parse(m.entrees?.[rel]?.date ?? ''))),
      'chaque entrée : propriétaire public, commit source, source, date');
    ok(m.commitSource === tete, 'commitSource gardé (lecteurs v1)');
    if (process.platform === 'win32') ignore('pre-commit exécutable', 'droits POSIX sans effet sous Windows');
    else ok((statSync(installe(code, '.githooks/pre-commit')).mode & 0o111) !== 0, 'pre-commit installé exécutable');

    /* ------------------------------------------------- câblage préexistant */
    git(code, 'config', 'core.hooksPath', 'ailleurs');
    r = installerPublic(code);
    ok(r.code === 0 && git(code, 'config', 'core.hooksPath') === 'ailleurs' && /n'a PAS été remplacé/.test(r.sortie),
      'un câblage tiers est signalé, jamais écrasé');
    git(code, 'config', '--unset', 'core.hooksPath');

    /* ----------------------------------- migration v1 et entrées des autres */
    // Un v1 tel que l'écrit un ancien installateur : `fichiers` seul, avec
    // des chemins historiques hors de ceux de l'installateur public.
    ecrireManifeste(code, {
      commitSource: 'ancien', brancheSource: 'main', installeLe: '2026-10-01T00:00:00.000Z',
      fichiers: { 'scripts/chantier.mjs': 'h-chantier', 'scripts/hooks-codex.mjs': 'h-hooks', '.githooks/pre-commit': 'perime' },
    });
    r = installerPublic(code);
    m = lireManifeste(code);
    ok(r.code === 0 && m.version === 2, 'migration v1 → v2 par l’installateur public');
    ok(m.fichiers['scripts/chantier.mjs'] === 'h-chantier' && m.fichiers['scripts/hooks-codex.mjs'] === 'h-hooks',
      'migration : empreintes v1 hors de ses chemins gardées telles quelles');
    egal([m.entrees?.['scripts/chantier.mjs']?.proprietaire, m.entrees?.['scripts/hooks-codex.mjs']?.proprietaire],
      ['chantier', 'chantier'], 'migration : propriétaire fixé par la liste de chemins');
    ok(m.fichiers['.githooks/pre-commit'] === sha(installe(code, '.githooks/pre-commit')), 'migration : ses propres chemins réécrits');
    // Une entrée d'un autre installateur, déjà en v2.
    const etrangere: Entree = { proprietaire: 'notes', source: 'ailleurs/outil.mjs', commit: 'c0ffee', date: '2026-10-02T00:00:00.000Z' };
    m.fichiers['scripts/outillage-prive.mjs'] = 'h-prive';
    m.entrees!['scripts/outillage-prive.mjs'] = etrangere;
    m.entrees!['scripts/chantier.mjs'] = { ...m.entrees!['scripts/chantier.mjs'], source: 'marque' };
    ecrireManifeste(code, m);
    r = installerPublic(code);
    m = lireManifeste(code);
    ok(r.code === 0 && m.fichiers['scripts/outillage-prive.mjs'] === 'h-prive', 'entrée étrangère : empreinte conservée');
    egal(m.entrees?.['scripts/outillage-prive.mjs'], etrangere, 'entrée étrangère : conservée à l’identique');
    ok(m.entrees?.['scripts/chantier.mjs']?.source === 'marque' && m.fichiers['scripts/chantier.mjs'] === 'h-chantier',
      'entrée `chantier` : non réécrite par l’installateur public');

    /* ------------------------------------------- anciens chemins retirés */
    // Une installation d'avant le retrait des garde-fous d'agent : copie et
    // entrée publiques retirées ; un homonyme d'un autre propriétaire, gardé.
    const ancien = '.claude/hooks/refuse-commit-m.mjs';
    mkdirSync(dirname(installe(code, ancien)), { recursive: true });
    writeFileSync(installe(code, ancien), 'ancien\n');
    writeFileSync(installe(code, 'scripts/hooks-codex-garde-fous.mjs'), 'ancien\n');
    m = lireManifeste(code);
    m.fichiers[ancien] = 'h-ancien';
    m.entrees![ancien] = { proprietaire: 'public', source: ancien, commit: 'c0ffee', date: '2026-10-02T00:00:00.000Z' };
    m.fichiers['scripts/hooks-codex-garde-fous.mjs'] = 'h-autre';
    m.entrees!['scripts/hooks-codex-garde-fous.mjs'] = { ...etrangere, source: 'autre' };
    ecrireManifeste(code, m);
    r = installerPublic(code);
    m = lireManifeste(code);
    ok(r.code === 0 && !existsSync(installe(code, ancien)) && !(ancien in m.fichiers) && !(ancien in (m.entrees ?? {})),
      'ancien chemin public : copie installée et entrée retirées');
    ok(existsSync(installe(code, 'scripts/hooks-codex-garde-fous.mjs')) && m.fichiers['scripts/hooks-codex-garde-fous.mjs'] === 'h-autre',
      'ancien chemin d’un autre propriétaire : gardé');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}

// `--automatique`, tel que l'appelle `prepare` à chaque `npm install`. La
// variable `CI` est retirée : ce test tourne lui-même en CI.
function installerAuto(cwd: string, script: string, env: Record<string, string> = {}): { code: number; sortie: string } {
  const base = { ...process.env };
  delete base.CI;
  const r = spawnSync(process.execPath, [script, '--automatique'],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...base, ...env } });
  return { code: r.status ?? 1, sortie: (r.stdout ?? '') + (r.stderr ?? '') };
}

export function testInstallationAutomatique() {
  titre('Installation automatique (`npm install`) — jamais d’échec, jamais de retour en arrière');
  if (!gitDisponible('installation automatique')) return;
  const bac = bacTemporaire('swblacksmith-installation-auto-');
  const code = join(bac, 'code');
  const script = join(code, 'scripts', 'installer-hooks.mjs');
  const installeA = () => lireManifeste(code).commitSource;
  try {
    depotPublic(code);
    const a = git(code, 'rev-parse', 'HEAD');

    let r = installerAuto(code, script, { CI: 'true' });
    ok(r.code === 0 && !existsSync(installation(code)) && cablage(code) === '', 'en CI : rien d’installé, code 0');

    r = installerAuto(bac, join(RACINE, 'scripts', 'installer-hooks.mjs'));
    ok(r.code === 0 && /non installés/.test(r.sortie), 'hors d’un dépôt Git : avertissement, code 0');

    r = installerAuto(code, script);
    ok(r.code === 0 && installeA() === a && memeChemin(cablage(code), join(installation(code), 'hooks')),
      'premier `npm install` : installé et câblé');

    // Une branche plus récente remplace ; revenir en arrière ne remplace pas.
    // Les hooks câblés s'appliquent aux commits d'essai : branche `forge/`.
    git(code, 'switch', '-q', '-c', 'forge/essai');
    writeFileSync(join(code, 'nouveau.txt'), 'x\n');
    commiter(code, 'feat: plus récent\n');
    const b = git(code, 'rev-parse', 'HEAD');
    r = installerAuto(code, script);
    ok(r.code === 0 && installeA() === b, 'tête qui contient l’installation : mise à jour');
    git(code, 'switch', '-q', '--detach', a);
    r = installerAuto(code, script);
    ok(r.code === 0 && installeA() === b && /installation gardée/.test(r.sortie), 'branche plus ancienne : installation gardée');
    git(code, 'switch', '-q', '-c', 'forge/divergente');
    writeFileSync(join(code, 'autre.txt'), 'y\n');
    commiter(code, 'feat: autre chemin\n');
    r = installerAuto(code, script);
    ok(r.code === 0 && installeA() === b, 'branche divergente : installation gardée');
    r = installerPublic(code);
    ok(r.code === 0 && installeA() === git(code, 'rev-parse', 'HEAD'), 'installation manuelle : remplace toujours');

    git(code, 'config', 'core.hooksPath', 'ailleurs');
    r = installerAuto(code, script);
    ok(r.code === 0 && git(code, 'config', 'core.hooksPath') === 'ailleurs', 'câblage tiers : jamais écrasé, code 0');
    git(code, 'config', '--unset', 'core.hooksPath');

    rmSync(join(code, '.githooks', 'commit-msg'));
    r = installerAuto(code, script);
    ok(r.code === 0 && /non installés/.test(r.sortie), 'source absente : avertissement, code 0');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
