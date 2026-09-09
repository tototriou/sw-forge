// Livraison vérifiée des notes privées (`scripts/chantier.mjs`).
//
// Pourquoi ces vérifications-là : l'outil manipule des fichiers qui n'ont NI
// historique, NI merge, NI conflit détecté — `spec/outils/optimizer/` est
// gitignoré pour protection compétitive. Une erreur y est donc **définitive et
// silencieuse**. Ce qui est testé ici n'est pas le cas nominal, c'est ce qui
// perd des données : un dossier absent pris pour un dossier vidé, une branche
// documentaire avancée de l'autre côté, une livraison rejouée.
//
// ⚠️ **Aucune note privée réelle n'est touchée** : tout se passe sur des dépôts
// jetables créés par le test lui-même, dans un dossier temporaire.
//
// ⚠️ **Ce test doit passer sur un clone neuf**, sans installation de
// l'orchestration ni accès au dépôt documentaire privé — c'est le critère
// d'acceptation du cadrage. Il ne dépend donc de rien d'autre que `git` et
// `node`, et se déclare `ignore()` si `git` manque plutôt que d'échouer.

import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTIL = join(RACINE, 'scripts', 'chantier.mjs');
const NOTES = 'spec/outils/optimizer';

function git(depot: string, ...args: string[]): string {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
}

// L'outil REFUSE plus souvent qu'il n'agit : on a besoin du code de sortie ET
// du texte, pas d'une exception.
function chantier(cwd: string, ...args: string[]): { code: number; sortie: string } {
  try {
    const sortie = execFileSync('node', [OUTIL, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: (err.stdout ?? '') + (err.stderr ?? '') };
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

export default function testChantier() {
  titre('Chantier — livraison vérifiée des notes privées');

  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    ignore('livraison vérifiée des notes privées', 'git introuvable');
    return;
  }

  const bac = mkdtempSync(join(tmpdir(), 'sw-forge-chantier-'));
  const codeDir = join(bac, 'code');
  const docDir = join(bac, 'docs');

  try {
    // Dépôt documentaire : les notes de référence.
    mkdirSync(join(docDir, NOTES), { recursive: true });
    writeFileSync(join(docDir, NOTES, 'pistes.md'), 'piste 1\n');
    writeFileSync(join(docDir, NOTES, 'mesures.md'), 'mesure 1\n');
    depotJetable(docDir);
    commiter(docDir, 'notes initiales\n');

    // Dépôt de code : les notes y sont ignorées, comme dans le vrai dépôt.
    mkdirSync(join(codeDir, 'src'), { recursive: true });
    writeFileSync(join(codeDir, 'src', 'app.ts'), 'export const x = 1;\n');
    writeFileSync(join(codeDir, '.gitignore'), `${NOTES}/\n`);
    depotJetable(codeDir);
    commiter(codeDir, 'code initial\n');

    /* ------------------------------------------------------ le refus n°1 */
    // Sans base enregistrée, on ne peut pas distinguer « pas encore copié »
    // de « tout supprimé volontairement ». Le second reporté aveuglément
    // effacerait le journal entier.
    let r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code !== 0, 'livrer refuse un chantier jamais ouvert');
    ok(/supprim/i.test(r.sortie), 'et nomme le risque : une suppression totale');

    /* ---------------------------------------------------------- ouverture */
    r = chantier(codeDir, 'ouvrir', '--chantier', 'essai', '--depot-doc', docDir);
    ok(r.code === 0, 'ouvrir réussit');
    ok(existsSync(join(codeDir, NOTES, 'pistes.md')), 'les notes sont copiées dans le dépôt de code');
    ok(/verrouill/i.test(r.sortie), 'le worktree documentaire est verrouillé');

    r = chantier(codeDir, 'verifier', '--chantier', 'essai');
    ok(r.code !== 0, 'verifier refuse tant que rien n’a été livré');

    /* ------------------------------- ajout, modification ET suppression */
    writeFileSync(join(codeDir, NOTES, 'nouvelle.md'), 'note neuve\n');
    writeFileSync(join(codeDir, NOTES, 'pistes.md'), 'piste 1 modifiee\n');
    rmSync(join(codeDir, NOTES, 'mesures.md'));
    r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code === 0, 'livrer réussit');

    const registre = JSON.parse(
      readFileSync(join(codeDir, '.git', 'forge', 'etat', 'chantiers', 'essai.json'), 'utf8')
    ) as { worktreeDoc: string };
    const wt = registre.worktreeDoc;

    ok(existsSync(join(wt, NOTES, 'nouvelle.md')), 'l’ajout est reporté');
    ok(
      readFileSync(join(wt, NOTES, 'pistes.md'), 'utf8') === 'piste 1 modifiee\n',
      'la modification est reportée'
    );
    // Le cas qu'un simple `copy` récursif rate toujours.
    ok(!existsSync(join(wt, NOTES, 'mesures.md')), 'la SUPPRESSION est reportée');

    r = chantier(codeDir, 'verifier', '--chantier', 'essai');
    ok(r.code === 0, 'le reçu est valide après livraison');

    /* -------------------------------------------------------- idempotence */
    // Une livraison rejouée sans changement ne doit rien créer : sinon le reçu
    // change à chaque appel et la branche documentaire enfle pour rien.
    const avant = git(wt, 'rev-parse', 'HEAD');
    r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code === 0, 'une seconde livraison identique réussit');
    ok(git(wt, 'rev-parse', 'HEAD') === avant, 'et ne crée AUCUN nouveau commit documentaire');

    /* ------------------------------------------------------- reçu périmé */
    writeFileSync(join(codeDir, NOTES, 'pistes.md'), 'piste 1 encore modifiee\n');
    r = chantier(codeDir, 'verifier', '--chantier', 'essai');
    ok(r.code !== 0, 'modifier les notes après livraison PÉRIME le reçu');
    ok(/notes actuelles/.test(r.sortie), 'et le contrôle en échec est nommé');

    /* ------------------------------------------------- le refus n°2 */
    const sauve = join(bac, 'notes-sauvees');
    cpSync(join(codeDir, NOTES), sauve, { recursive: true });
    rmSync(join(codeDir, NOTES), { recursive: true, force: true });
    r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code !== 0, 'livrer refuse un dossier de notes ABSENT');
    ok(
      existsSync(join(wt, NOTES, 'pistes.md')),
      'et ne supprime RIEN côté documentaire — un dossier absent n’est pas un dossier vidé'
    );
    cpSync(sauve, join(codeDir, NOTES), { recursive: true });

    /* ------------------------------------------------- le refus n°3 */
    // Le répertoire de travail reste PROPRE : c'est tout le piège. Sans la
    // révision attendue enregistrée, le report écraserait ce commit en silence.
    writeFileSync(join(wt, NOTES, 'ailleurs.md'), 'ecrit de l autre cote\n');
    commiter(wt, 'travail independant\n');
    r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code !== 0, 'livrer refuse une branche documentaire avancée indépendamment');
    ok(existsSync(join(wt, NOTES, 'ailleurs.md')), 'et le travail fait de l’autre côté survit');
    git(wt, 'reset', '--hard', 'HEAD~1');

    /* -------------------------------------------------- code non commité */
    writeFileSync(join(codeDir, 'src', 'app.ts'), 'export const x = 2;\n');
    r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code !== 0, 'livrer refuse tant que le code n’est pas commité');
  } finally {
    // Le worktree documentaire est VERROUILLÉ par `ouvrir` : `rmSync` suffit
    // pour du jetable, git n'a pas son mot à dire sur un dossier temporaire.
    rmSync(bac, { recursive: true, force: true });
  }
}
