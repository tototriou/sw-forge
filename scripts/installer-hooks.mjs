#!/usr/bin/env node
// Installateur public des garde-fous : hooks Git `pre-commit` (et le lint qu'il
// importe) et `commit-msg`. Contrat : spec/outillage/spec.md,
// « Niveaux d'application et garde-fous », « Installation des garde-fous ».
//
//   node scripts/installer-hooks.mjs [--simulation] [--sans-cablage] [--automatique]
//
// ⚠️ Ce qui s'exécute est l'INSTALLATION (`<git commun>/forge/installation/`),
// jamais `scripts/` ni `.githooks/` du worktree : leur contenu dépendrait de la
// branche checkoutée.
//
// ⚠️ Le manifeste peut être partagé avec d'autres installateurs : celui-ci
// n'y réécrit QUE ses chemins (`CHEMINS`), et garde toute autre entrée telle
// quelle. Un manifeste v1
// (`fichiers` seul) est migré en mémoire : ses empreintes sont gardées.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

const PROPRIETAIRE = 'public';
// Chemins de cet installateur (clé du manifeste = chemin dans le dépôt).
const CHEMINS = [
  '.githooks/pre-commit',
  '.githooks/commit-msg',
  'scripts/spec-lint.mjs',
  'scripts/lib/spec-markdown.mjs',
];
// Anciens chemins de cet installateur : leur copie installée et leur entrée
// du manifeste sont retirées à l'installation, sans quoi elles resteraient
// pour toujours sous l'installation.
const RETIRES = [
  'scripts/hooks-codex-garde-fous.mjs',
  '.claude/hooks/refuse-commit-m.mjs',
  '.claude/hooks/refuse-sed-i.mjs',
];
// Propriétaires connus, pour la seule migration d'un manifeste v1.
const PROPRIETAIRES_V1 = {
  'scripts/chantier.mjs': 'chantier',
  'scripts/hooks-codex.mjs': 'chantier',
  ...Object.fromEntries([...CHEMINS, ...RETIRES].map((c) => [c, PROPRIETAIRE])),
};

const ROUGE = '\x1b[31m';
const VERT = '\x1b[32m';
const JAUNE = '\x1b[33m';
const FIN = '\x1b[0m';

// `--automatique` : appel par le script `prepare` de `package.json`, donc à
// chaque `npm install` ou `npm ci`. Il ne fait JAMAIS échouer l'installation
// des dépendances : un refus ou une erreur deviennent un avertissement, code 0.
const AUTOMATIQUE = process.argv.includes('--automatique');

function refuser(titre, ...details) {
  if (AUTOMATIQUE) {
    console.log(`${JAUNE}⚠️ Garde-fous non installés : ${titre}${FIN}`);
    process.exit(0);
  }
  console.error(`${ROUGE}REFUSÉ — ${titre}${FIN}`);
  for (const d of details) console.error(`  ${d}`);
  process.exit(1);
}

if (AUTOMATIQUE) {
  process.on('uncaughtException', (e) => refuser(`erreur inattendue (${e?.message ?? e})`));
  // En CI, les vérifications passent par le workflow, pas par des hooks.
  if (process.env.CI) process.exit(0);
}

function git(depot, ...args) {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
}

function gitOuNull(depot, ...args) {
  try { return git(depot, ...args); } catch { return null; }
}

const normaliser = (p) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));

function empreinteFichier(chemin) {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex');
}

// `.githooks/<nom>` s'installe sous `hooks/<nom>` (cible de `core.hooksPath`),
// tout autre chemin à l'identique sous l'installation.
function emplacement(installation, rel) {
  return rel.startsWith('.githooks/')
    ? join(installation, 'hooks', rel.slice('.githooks/'.length))
    : join(installation, ...rel.split('/'));
}

// Lecture v1 ou v2, sans écriture. v1 : chaque chemin de `fichiers` reçoit
// une entrée dont le propriétaire vient de la liste connue.
function lireManifeste(chemin) {
  if (!existsSync(chemin)) return { version: 2, fichiers: {}, entrees: {} };
  const m = JSON.parse(readFileSync(chemin, 'utf8'));
  m.fichiers ??= {};
  m.entrees ??= {};
  for (const rel of Object.keys(m.fichiers)) {
    m.entrees[rel] ??= {
      proprietaire: PROPRIETAIRES_V1[rel] ?? 'inconnu',
      source: 'manifeste v1',
      commit: m.commitSource ?? null,
      date: m.installeLe ?? null,
    };
  }
  return m;
}

function ecrireAtomique(chemin, texte) {
  const temporaire = `${chemin}.${process.pid}.tmp`;
  writeFileSync(temporaire, texte);
  renameSync(temporaire, chemin);
}

function lireOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--simulation' || a === '--sans-cablage' || a === '--automatique') options[a.slice(2)] = true;
    else refuser(`argument inconnu : ${a}`,
      'Usage : node scripts/installer-hooks.mjs [--simulation] [--sans-cablage] [--automatique]');
  }
  return options;
}

const options = lireOptions(process.argv.slice(2));
const simulation = options.simulation === true;
const depot = gitOuNull(process.cwd(), 'rev-parse', '--show-toplevel');
if (!depot) refuser('hors d’un dépôt Git');
const installation = join(resolve(depot, git(depot, 'rev-parse', '--git-common-dir')), 'forge', 'installation');
const cheminManifeste = join(installation, 'manifeste.json');

for (const rel of CHEMINS) {
  if (!existsSync(join(depot, ...rel.split('/')))) refuser(`fichier source absent : ${rel}`, 'Rien n’a été installé.');
}

const commit = git(depot, 'rev-parse', 'HEAD');

// Jamais de retour en arrière automatique : un `npm install` sur une branche
// ancienne remplacerait, pour tous les worktrees, l'installation par une
// version plus vieille. On n'installe que si la tête courante CONTIENT le
// commit installé ; sinon on garde l'existant (installation manuelle pour
// forcer).
if (AUTOMATIQUE && existsSync(cheminManifeste)) {
  const installe = lireManifeste(cheminManifeste).commitSource;
  if (installe && installe !== commit && gitOuNull(depot, 'merge-base', '--is-ancestor', installe, commit) === null) {
    console.log(`Garde-fous : installation gardée (${installe.slice(0, 7)}), absente de la branche courante.` +
      ' Pour la remplacer : node scripts/installer-hooks.mjs');
    process.exit(0);
  }
}

if (git(depot, 'status', '--porcelain') !== '') {
  console.log(`${JAUNE}⚠️ Le dépôt porte des modifications non commitées${FIN} : le manifeste` +
    ' enregistrera un commit qui ne décrit pas exactement ce qui est installé.');
}

if (simulation) {
  console.log(`${JAUNE}Simulation${FIN} — rien n’est écrit. Installation : ${installation}`);
  for (const rel of CHEMINS) console.log(`  · ${rel} → ${emplacement(installation, rel)}`);
} else {
  const manifeste = lireManifeste(cheminManifeste);
  const date = new Date().toISOString();
  for (const rel of CHEMINS) {
    const source = join(depot, ...rel.split('/'));
    const dest = emplacement(installation, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(source, dest);
    if (rel.startsWith('.githooks/')) chmodSync(dest, 0o755);
    manifeste.fichiers[rel] = empreinteFichier(dest);
    manifeste.entrees[rel] = { proprietaire: PROPRIETAIRE, source: source.replace(/\\/g, '/'), commit, date };
  }
  // Un ancien chemin n'est retiré que s'il est bien à cet installateur.
  for (const rel of RETIRES) {
    if (manifeste.entrees[rel]?.proprietaire !== PROPRIETAIRE) continue;
    rmSync(emplacement(installation, rel), { force: true });
    delete manifeste.fichiers[rel];
    delete manifeste.entrees[rel];
  }
  manifeste.version = 2;
  manifeste.commitSource = commit;
  manifeste.brancheSource = git(depot, 'rev-parse', '--abbrev-ref', 'HEAD');
  manifeste.installeLe = date;
  ecrireAtomique(cheminManifeste, JSON.stringify(manifeste, null, 2) + '\n');
  console.log(`${VERT}Garde-fous installés.${FIN} ${installation}`);
  console.log(`  source : ${manifeste.brancheSource} @ ${commit.slice(0, 7)}`);
  for (const rel of CHEMINS) console.log(`  · ${rel}`);
}

/* ------------------------------------------------------------- câblage */
const cheminHooks = join(installation, 'hooks');
const actuel = gitOuNull(depot, 'config', 'core.hooksPath');
if (actuel && normaliser(resolve(depot, actuel)) !== normaliser(cheminHooks)) {
  // Signalé, jamais écrasé en silence : un câblage préexistant peut porter
  // des hooks qui ne viennent pas d'ici.
  console.log('');
  console.log(`${JAUNE}⚠️ Un câblage de hooks existe déjà et n'a PAS été remplacé.${FIN}`);
  console.log(`  actuel  : ${actuel}`);
  console.log(`  proposé : ${cheminHooks}`);
  console.log('  Pour basculer explicitement :');
  console.log(`    git config core.hooksPath "${cheminHooks}"`);
} else if (actuel) {
  console.log(`  hooks câblés : ${cheminHooks}`);
} else if (options['sans-cablage']) {
  console.log(`${JAUNE}Hooks installés mais NON câblés${FIN} (--sans-cablage).`);
} else if (simulation) {
  console.log(`  simulation : câblerait core.hooksPath sur ${cheminHooks}`);
} else {
  git(depot, 'config', 'core.hooksPath', cheminHooks);
  console.log(`  hooks câblés : ${cheminHooks}`);
}
