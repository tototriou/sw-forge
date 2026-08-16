// Dos-à-dos SIMULTANÉ entre le code courant (répertoire de travail
// principal, y compris les modifications non committées) et une version
// antérieure (`git worktree`, checkout séparé sur disque), pour un cas
// connu — voir spec/outils/optimizer/, « Suite — mode --quick et
// parallélisation de --monotonicity », section sur la fiabilité des
// comparaisons de temps.
//
// ⚠️ Pourquoi un `worktree`, pas juste revert/relancer/restaurer le
// fichier : un même chemin sur disque ne peut pas être dans deux états à
// la fois pour deux processus qui tournent EN MÊME TEMPS. Éditer-relancer-
// rééditer marche pour deux mesures SÉQUENTIELLES (ce qui a été fait toute
// cette session), jamais pour une comparaison simultanée — il faut deux
// RÉPERTOIRES distincts, chacun avec son propre `runeBuildOptim.ts`.
//
// ⚠️ Pourquoi simultané plutôt que la baseline JSON habituelle
// (scripts/perf-baseline.json) : cette dernière compare contre une mesure
// prise à un autre MOMENT (potentiellement des minutes/heures plus tôt),
// exposée à la dérive machine documentée ailleurs dans ce fichier (jusqu'à
// 40-70 % sur 15-20 min). Lancer ancien et nouveau AU MÊME INSTANT élimine
// cette dérive — au prix d'une contention à 2 processus (pas 7×2 comme la
// batterie complète), largement plus légère.
//
// Deux pièges déjà rencontrés dans CE dépôt (voir « leçons retenues sur la
// méthodologie de mesure », spec/outils/optimizer/) et leurs
// contre-mesures ici :
//   1. `node_modules` et les comptes réels (gitignorés) sont ABSENTS d'un
//      nouveau worktree (git ne checkout que les fichiers SUIVIS) — sans
//      les lier, `npx tsx` échoue et les cas réels manquent de données.
//      Contre-mesure : liés explicitement, un par un (voir ACCOUNT_FILES).
//   2. Lier des fichiers EN BLOC par motif (`*.json`) peut écraser un
//      fichier SUIVI par git (ex. tsconfig.json/package.json) par la
//      version de la branche courante au lieu de celle du commit visé.
//      Contre-mesure : jamais de glob — une liste EXPLICITE de noms, et
//      chaque lien vérifie d'abord que le fichier n'est PAS suivi par git
//      dans le worktree avant de le créer (refuse et prévient sinon,
//      n'écrase jamais).
//
// Usage : perf-battery-compare.ts <ref-ancien> [--case=<index>] [--repeats=1]
//   <ref-ancien> : commit/branche/tag à comparer contre le code courant
//                  (répertoire de travail principal, modifications non
//                  committées incluses).
//   --case=<index> : un seul cas (voir scripts/lib/perfShared.ts, CASES)
//                    plutôt que les 7 — les 7 restent SÉQUENTIELS entre eux
//                    (2 processus à la fois, pas 14) même sans ce flag.
//   --repeats=<n> : répétitions par cas (défaut 1) — ancien ET nouveau
//                   relancés simultanément à CHAQUE répétition, minimum
//                   retenu de chaque côté séparément (même principe que
//                   perf-battery.ts).

import { existsSync, unlinkSync, symlinkSync, linkSync, lstatSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { CASES } from './lib/perfShared';

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ref = positional[0];
if (!ref) {
  console.error('Usage: perf-battery-compare.ts <ref-ancien> [--case=<index>] [--repeats=1]');
  process.exit(1);
}
const caseArg = process.argv.find((a) => a.startsWith('--case='));
const caseIndices = caseArg ? [Number(caseArg.slice('--case='.length))] : CASES.map((_, i) => i);
const repeats = Number(process.argv.find((a) => a.startsWith('--repeats='))?.split('=')[1] ?? 1);

const MAIN_DIR = process.cwd();
const SAFE_REF = ref.replace(/[^a-zA-Z0-9_.-]/g, '_');
const WORKTREE_DIR = join(tmpdir(), `sw-forge-compare-${SAFE_REF}-${process.pid}`);

// ⚠️ Liste EXPLICITE, jamais un motif — voir le piège n°2 en tête de
// fichier. Alignée sur .gitignore (`tototriou-*.json`, `*Enzo-*.json`) et
// tests/outils.ts (`exportReel`), la même source que le reste du dépôt
// utilise déjà pour identifier les exports réels du développeur.
const ACCOUNT_FILES = ['tototriou-12889591.json', 'ß☆Enzo-6399149.json'];

function isTrackedInWorktree(name: string): boolean {
  try {
    execSync(`git -C "${WORKTREE_DIR}" ls-files --error-unmatch -- "${name}"`, { stdio: 'ignore' });
    return true; // exit 0 = trouvé dans l'index = SUIVI
  } catch {
    return false; // exit non nul = pas suivi
  }
}

// Lie UN SEUL chemin, jamais par motif — et REFUSE d'écraser un fichier
// suivi par git dans le worktree (piège n°2). Chaque appel est nommé
// explicitement par l'appelant, pas dérivé d'une liste globbée.
function linkIfSafe(name: string) {
  const source = join(MAIN_DIR, name);
  if (!existsSync(source)) {
    console.log(`  (absent du répertoire principal, ignoré) ${name}`);
    return;
  }
  if (isTrackedInWorktree(name)) {
    console.warn(`  ⚠️ ${name} est SUIVI par git dans le worktree — refus de l'écraser par un lien. Ignoré.`);
    return;
  }
  const dest = join(WORKTREE_DIR, name);
  if (lstatSync(source).isDirectory()) {
    // Jonction, pas un lien symbolique de répertoire : fonctionne sur
    // Windows SANS privilège élevé (contrairement à un vrai symlink de
    // dossier). `node_modules` est le seul cas concerné ici.
    symlinkSync(source, dest, 'junction');
    console.log(`  lié (jonction) : ${name}`);
    return;
  }
  // ⚠️ Un lien symbolique de FICHIER exige un privilège élevé sur Windows
  // (EPERM sans droits admin/Mode développeur — rencontré en le testant).
  // Repli sur un lien PHYSIQUE (même volume, toujours le cas ici — tout
  // sous le même profil utilisateur) : identique en lecture seule, seul
  // usage dont ce script a besoin, et ne demande aucune élévation.
  try {
    symlinkSync(source, dest, 'file');
    console.log(`  lié (symlink) : ${name}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') throw err;
    linkSync(source, dest);
    console.log(`  lié (lien physique — symlink refusé sans privilège) : ${name}`);
  }
}

function setupWorktree() {
  console.log(`Création du worktree ${WORKTREE_DIR} (${ref})…`);
  execSync(`git worktree add "${WORKTREE_DIR}" ${ref}`, { stdio: 'inherit' });
  console.log('\nLiaison des fichiers gitignorés nécessaires (piège n°1 — un par un, piège n°2 — jamais par motif) :');
  linkIfSafe('node_modules');
  for (const f of ACCOUNT_FILES) linkIfSafe(f);
}

function teardownWorktree() {
  console.log(`\nNettoyage du worktree ${WORKTREE_DIR}…`);
  // ⚠️ Retire les liens EXPLICITEMENT, un par un, AVANT `git worktree
  // remove` — `unlinkSync` retire le lien lui-même, ne suit JAMAIS la
  // cible (contrairement à un `rm -rf` naïf sur un dossier qui contiendrait
  // un lien vers `node_modules` : selon l'outil, un retrait récursif peut
  // suivre le lien et supprimer l'ORIGINAL). Sécurité, pas juste propreté.
  for (const name of ['node_modules', ...ACCOUNT_FILES]) {
    const p = join(WORKTREE_DIR, name);
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        /* pas un lien (jamais créé, ou déjà absent) — rien à faire */
      }
    }
  }
  try {
    execSync(`git worktree remove "${WORKTREE_DIR}" --force`, { stdio: 'inherit' });
  } catch {
    console.warn(`⚠️ Échec du retrait automatique du worktree — à nettoyer à la main : git worktree remove "${WORKTREE_DIR}" --force`);
  }
}

interface SideResult {
  result: {
    found: boolean;
    // ⚠️ Optionnel : `ref` peut désigner un commit ANTÉRIEUR à l'ajout de
    // ce champ (voir spec/outils/optimizer/) — absent, pas invalide.
    foundCount?: number;
    foundMs: number | null;
    totalMs: number;
    truncated: boolean;
  };
}

// ⚠️ `npx` est un script `.cmd` sur Windows — `spawn` échoue (`EINVAL`) à
// l'invoquer directement sans passer par un shell (testé). `shell: true`
// est donc nécessaire ici, mais avec un TABLEAU d'arguments il concatène
// tout en une seule chaîne shell SANS échapper les arguments (avertissement
// de dépréciation Node DEP0190 — un risque d'injection si un argument
// venait d'une source non fiable). Repli sûr : UNE SEULE chaîne de commande
// déjà assemblée (pas de tableau `args` séparé) — chaque morceau ici est
// un nombre ou un littéral fixe, jamais une entrée utilisateur brute.
function runCaseAt(dir: string, idx: number, label: 'nouveau' | 'ancien'): Promise<SideResult> {
  return new Promise((resolvePromise, reject) => {
    const cmd = `npx tsx scripts/perf-battery.ts --case=${idx} --bundle-dir=compare-${process.pid}-${label}`;
    const child = spawn(cmd, { cwd: dir, shell: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`(${label}) sortie ${code} : ${err.slice(0, 500)}`));
        return;
      }
      resolvePromise(JSON.parse(out));
    });
  });
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function compareCase(idx: number) {
  const c = CASES[idx];
  console.log(`\n${c.label}`);
  const newRuns: SideResult[] = [];
  const oldRuns: SideResult[] = [];
  for (let i = 0; i < repeats; i++) {
    // ⚠️ Les DEUX `spawn` sont lancés avant tout `await` (comme les deux
    // Worker de buildA/buildB, même principe) : vraiment simultanés, pas
    // l'un après l'autre — c'est ce qui fait que les deux subissent les
    // mêmes conditions machine transitoires à cette répétition précise.
    const [newR, oldR] = await Promise.all([
      runCaseAt(MAIN_DIR, idx, 'nouveau'),
      runCaseAt(WORKTREE_DIR, idx, 'ancien'),
    ]);
    newRuns.push(newR);
    oldRuns.push(oldR);
  }
  const bestTotal = (runs: SideResult[]) => Math.min(...runs.map((r) => r.result.totalMs));
  const bestFound = (runs: SideResult[]) => {
    const vals = runs.map((r) => r.result.foundMs).filter((v): v is number => v != null);
    return vals.length > 0 ? Math.min(...vals) : null;
  };
  const newBest = { totalMs: bestTotal(newRuns), foundMs: bestFound(newRuns), foundCount: newRuns[newRuns.length - 1].result.foundCount, found: newRuns.every((r) => r.result.found) };
  const oldBest = { totalMs: bestTotal(oldRuns), foundMs: bestFound(oldRuns), foundCount: oldRuns[oldRuns.length - 1].result.foundCount, found: oldRuns.every((r) => r.result.found) };
  const deltaTotal = newBest.totalMs - oldBest.totalMs;
  // ⚠️ `foundCount` peut être ABSENT côté `ancien` si `ref` précède son
  // ajout au format (voir spec/outils/optimizer/) — pas une erreur, juste
  // un champ qui n'existait pas encore à cette version. Affiché « — »
  // plutôt que `undefined`/`NaN`.
  const deltaCount = oldBest.foundCount != null && newBest.foundCount != null ? newBest.foundCount - oldBest.foundCount : null;
  const fmtCount = (n: number | undefined) => (n == null ? '—' : String(n));
  console.log(`  ancien  (${ref})  | trouvé=${oldBest.found ? 'oui' : 'NON'} | compte=${fmtCount(oldBest.foundCount)} | foundMs=${fmtMs(oldBest.foundMs)} | totalMs=${fmtMs(oldBest.totalMs)}`);
  console.log(`  nouveau (courant) | trouvé=${newBest.found ? 'oui' : 'NON'} | compte=${fmtCount(newBest.foundCount)} | foundMs=${fmtMs(newBest.foundMs)} | totalMs=${fmtMs(newBest.totalMs)}`);
  const deltaCountStr = deltaCount == null ? '—' : `${deltaCount >= 0 ? '+' : ''}${deltaCount}`;
  console.log(`  delta             | compte ${deltaCountStr} | total ${deltaTotal >= 0 ? '+' : ''}${fmtMs(Math.abs(deltaTotal))}`);
}

try {
  setupWorktree();
  console.log(`\nComparaison simultanée — ${caseIndices.length} cas, ${repeats} répétition(s), 2 processus à la fois (pas ${caseIndices.length * 2}).`);
  for (const idx of caseIndices) {
    await compareCase(idx);
  }
} finally {
  teardownWorktree();
}
