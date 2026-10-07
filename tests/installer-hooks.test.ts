// Installateur public des garde-fous (`scripts/installer-hooks.mjs`) et
// garde-fou Codex de lecture (`scripts/hooks-codex-garde-fous.mjs`).
//
// Le dépôt jetable ne porte que les sources publiques : l'installateur public
// et le garde-fou doivent fonctionner seuls. Tout se passe dans un dossier
// temporaire ; aucune installation réelle n'est touchée.

import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { egal, ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICS = ['.githooks/pre-commit', 'scripts/hooks-codex-garde-fous.mjs', 'scripts/lib/spec-markdown.mjs', 'scripts/spec-lint.mjs', '.claude/hooks/refuse-commit-m.mjs', '.claude/hooks/refuse-sed-i.mjs'];

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
  titre('Installateur public — manifeste par entrée, câblage, hooks Codex');
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
    egal(Object.keys(m.fichiers).sort(), [...PUBLICS].sort(), 'le manifeste porte les six chemins publics, et eux seuls');
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

    /* ------------------------------------------------------------ hooks Codex */
    const config = join(bac, 'perso', 'hooks.json');
    mkdirSync(dirname(config), { recursive: true });
    const original = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo autre' }] }] } });
    writeFileSync(config, original);
    r = installerPublic(code, '--sans-cablage', '--codex-hooks', config);
    ok(r.code === 0, '--sans-cablage --codex-hooks : l’option suivante n’est pas avalée');
    const commande = `node "${join(installation(code), 'scripts', 'hooks-codex-garde-fous.mjs')}"`;
    const groupes = () => JSON.parse(readFileSync(config, 'utf8')).hooks as Record<string, { matcher?: string; hooks: { command: string }[] }[]>;
    let h = groupes();
    ok(h.PreToolUse?.length === 1 && h.PreToolUse[0].hooks[0].command === commande, 'hooks.json : une entrée PreToolUse publique');
    ok(h.Stop?.length === 1 && h.Stop[0].hooks[0].command === 'echo autre', 'hooks.json : hook tiers conservé');
    ok(!h.SessionStart && !h.UserPromptSubmit, 'hooks.json : aucun autre évènement ajouté par le public');
    ok(readFileSync(`${config}.avant-swblacksmith`, 'utf8') === original, '.avant-swblacksmith : copie de l’original');
    r = installerPublic(code, '--codex-hooks', config);
    h = groupes();
    ok(r.code === 0 && h.PreToolUse.length === 1, 'réinstallation : pas de doublon');
    // Entrée retirée à la main : la réinstallation la repose, et la copie
    // d'avant SW Blacksmith reste l'original, pas la version déjà modifiée.
    writeFileSync(config, JSON.stringify({ hooks: { ...h, PreToolUse: [] } }));
    r = installerPublic(code, '--codex-hooks', config);
    ok(r.code === 0 && groupes().PreToolUse.length === 1, 'entrée retirée à la main : reposée');
    ok(readFileSync(`${config}.avant-swblacksmith`, 'utf8') === original, '.avant-swblacksmith : écrite une seule fois');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}

export function testHooksCodexGardeFous() {
  titre('Garde-fous Codex publics — lectures et commandes');
  if (!gitDisponible('garde-fou Codex')) return;
  const bac = bacTemporaire('swblacksmith-garde-fous-');
  const code = join(bac, 'code');
  const autre = join(bac, 'autre');
  try {
    depotPublic(code);
    const lignes = (n: number) => Array.from({ length: n }, (_, i) => `ligne ${i}`).join('\n') + '\n';
    mkdirSync(join(code, 'spec', 'outils', 'optimizer'), { recursive: true });
    writeFileSync(join(code, 'spec', 'gros.md'), lignes(320));
    writeFileSync(join(code, 'spec', 'petit.md'), lignes(20));
    writeFileSync(join(code, 'spec', 'outils', 'optimizer', 'invariants.md'), lignes(400));
    ok(installerPublic(code).code === 0, 'installation publique, sans aucun chantier');
    ok(!existsSync(join(code, '.git', 'forge', 'etat')), 'aucun registre de chantier');
    const garde = join(installation(code), 'scripts', 'hooks-codex-garde-fous.mjs');
    const lancer = (script: string, cwd: string, evenement: string, commande?: string) =>
      JSON.parse(execFileSync(process.execPath, [script], { cwd, encoding: 'utf8',
        input: JSON.stringify({ cwd, session_id: 's', hook_event_name: evenement,
          ...(commande === undefined ? {} : { tool_input: { command: commande } }) }) }));
    const refus = (o: { hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string } }) =>
      o.hookSpecificOutput?.permissionDecision === 'deny';

    const gros = lancer(garde, code, 'PreToolUse', 'cat spec/gros.md');
    ok(refus(gros), 'cat d’une spec > 300 lignes : refus');
    ok(/spec-toc\.mjs spec\/gros\.md/.test(gros.hookSpecificOutput?.permissionDecisionReason ?? ''), 'le refus donne la commande spec-toc');
    ok(refus(lancer(garde, code, 'PreToolUse', 'Get-Content spec/gros.md')), 'Get-Content : refus');
    ok(!refus(lancer(garde, code, 'PreToolUse', 'cat spec/petit.md')), 'spec courte : permise');
    ok(!refus(lancer(garde, code, 'PreToolUse', 'cat spec/outils/optimizer/invariants.md')), 'invariants.md : exception');
    ok(!refus(lancer(garde, code, 'PreToolUse', 'git status')), 'autre commande : permise');
    ok(refus(lancer(garde, code, 'PreToolUse', 'git commit -m "essai"')), 'message Git en ligne : refus');
    ok(refus(lancer(garde, code, 'PreToolUse', 'sed -i.bak s/a/b/ spec/petit.md')), 'sed en place : refus');
    ok(refus(lancer(garde, code, 'PreToolUse', 'node -e "console.log(`essai`)"')), 'script Node cité par Bash : refus');
    ok(!refus(lancer(garde, code, 'PreToolUse', 'git commit -F message.txt')), 'message Git en fichier : permis');
    ok(!refus(lancer(garde, code, 'PreToolUse', 'rg "sed -i" CLAUDE.md')), 'mention de sed : permise');
    egal(lancer(garde, code, 'SessionStart'), {}, 'autre évènement : aucun effet');

    depotJetable(autre);
    mkdirSync(join(autre, 'spec'), { recursive: true });
    writeFileSync(join(autre, 'spec', 'gros.md'), lignes(320));
    egal(lancer(garde, autre, 'PreToolUse', 'cat spec/gros.md'), {}, 'autre dépôt : aucun effet');
    egal(lancer(garde, bac, 'PreToolUse', 'cat code/spec/gros.md'), {}, 'hors Git : aucun effet');
    egal(lancer(join(code, 'scripts', 'hooks-codex-garde-fous.mjs'), code, 'PreToolUse', 'cat spec/gros.md'), {},
      'copie non installée (source du dépôt) : aucun effet');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
