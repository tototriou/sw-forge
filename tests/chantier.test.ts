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

export function testHooksCodex() {
  titre('Hooks Codex — événements réels et isolation des sessions');
  const bac = mkdtempSync(join(tmpdir(), 'sw-forge-hooks-'));
  const code = join(bac, 'code');
  const doc = join(bac, 'doc');
  try {
    depotJetable(code);
    depotJetable(doc);
    mkdirSync(join(doc, NOTES), { recursive: true });
    writeFileSync(join(doc, NOTES, 'note.md'), 'base\n');
    commiter(doc, 'Base documentaire\n');
    mkdirSync(join(code, 'scripts'));
    mkdirSync(join(code, '.githooks'));
    for (const fichier of ['chantier.mjs', 'hooks-codex.mjs']) {
      cpSync(join(RACINE, 'scripts', fichier), join(code, 'scripts', fichier));
    }
    cpSync(join(RACINE, '.githooks', 'pre-commit'), join(code, '.githooks', 'pre-commit'));
    writeFileSync(join(code, '.gitignore'), `${NOTES}/\n`);
    commiter(code, 'Base code\n');
    git(code, 'checkout', '-b', 'forge/hooks');
    const config = join(bac, 'hooks.json');
    writeFileSync(config, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo autre' }] }] } }));
    ok(chantier(code, 'installer', '--codex-hooks', config).code === 0, 'installation explicite des hooks');
    const installe = join(code, '.git', 'forge', 'installation', 'scripts', 'hooks-codex.mjs');
    const outilInstalle = join(dirname(installe), 'chantier.mjs');
    function evenement(nom: string, autres: Record<string, unknown> = {}) {
      return JSON.parse(execFileSync(process.execPath, [installe], { cwd: code, encoding: 'utf8',
        input: JSON.stringify({ cwd: code, session_id: 'session-a', hook_event_name: nom, ...autres }) }));
    }
    ok(Object.keys(evenement('SessionStart')).length === 0, 'worktree non enregistré : aucun effet');
    chantier(code, 'installer', '--codex-hooks', config);
    const groupes = JSON.parse(readFileSync(config, 'utf8')).hooks.Stop;
    ok(groupes.length === 2 && groupes[0].hooks[0].command === 'echo autre', 'réinstallation sans doublon, hook tiers conservé');
    ok(chantier(code, 'ouvrir', '--chantier', 'hooks', '--depot-doc', doc).code === 0, 'ouverture du chantier');
    ok(evenement('SessionStart').hookSpecificOutput.additionalContext.includes('forge/hooks'), 'contexte injecté au démarrage');
    ok(Object.keys(evenement('Stop')).length === 0, 'tour sans modification : pas de livraison forcée');
    writeFileSync(join(code, NOTES, 'note.md'), 'modification\n');
    ok(evenement('Stop').decision === 'block', 'notes modifiées sans reçu : continuation');
    ok(!evenement('Stop', { stop_hook_active: true }).decision, 'la continuation ne boucle pas');
    execFileSync(process.execPath, [installe, 'pause', 'session-a', 'Attente de réponse'], { cwd: code });
    ok(!evenement('Stop').decision, 'pause explicite respectée');
    evenement('UserPromptSubmit');
    writeFileSync(join(code, NOTES, 'note.md'), 'seconde modification\n');
    ok(evenement('Stop').decision === 'block', 'la pause ne désactive pas le tour suivant');
    execFileSync(process.execPath, [outilInstalle, 'livrer', '--chantier', 'hooks'], { cwd: code });
    ok(!evenement('Stop').decision, 'livraison valide : fin autorisée');
    git(code, 'checkout', '-b', 'forge/autre');
    ok(evenement('PreToolUse', { tool_input: { command: 'git status' } }).hookSpecificOutput.permissionDecision === 'deny',
      'branche modifiée : refus avant outil');
    git(code, 'checkout', 'forge/hooks');
    const second = join(bac, 'second');
    git(code, 'worktree', 'add', '-b', 'forge/second', second);
    ok(chantier(second, 'ouvrir', '--chantier', 'second').code === 0, 'second chantier dans le registre commun');
    const integration = { tool_input: { command: 'git merge forge/second' } };
    ok(evenement('PreToolUse', integration).hookSpecificOutput.permissionDecision === 'deny', 'intégration sans reçu refusée');
    execFileSync(process.execPath, [outilInstalle, 'livrer', '--chantier', 'second'], { cwd: second });
    ok(!evenement('PreToolUse', integration).hookSpecificOutput, 'intégration avec contribution vérifiée autorisée');
    const ailleurs = evenement('SessionStart', { cwd: doc });
    ok(Object.keys(ailleurs).length === 0, 'autre dépôt : aucun effet du hook personnel');
    // Altération : le contrôle réutilisé détecte une installation endommagée.
    writeFileSync(join(dirname(installe), '..', 'hooks', 'pre-commit'), 'altéré');
    ok(evenement('PreToolUse', { tool_input: { command: 'git status' } }).hookSpecificOutput.permissionDecision === 'deny',
      'installation altérée : refus explicite');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir, jamais d'une entrée utilisateur.
    rmSync(bac, { recursive: true, force: true });
  }
}

function git(depot: string, ...args: string[]): string {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
}

// L'outil REFUSE plus souvent qu'il n'agit : on a besoin du code de sortie ET
// du texte, pas d'une exception.
function chantier(cwd: string, ...args: string[]): { code: number; sortie: string } {
  return chantierAvecEnv(cwd, {}, ...args);
}

function chantierAvecEnv(
  cwd: string,
  env: Record<string, string>,
  ...args: string[]
): { code: number; sortie: string } {
  try {
    const sortie = execFileSync('node', [OUTIL, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

// ⚠️ Lecture INSENSIBLE aux fins de ligne. L'outil copie les octets tels quels,
// mais `git merge`/`checkout` réécrit le répertoire de travail selon
// `core.autocrlf` — sous Windows, un fichier passé par git revient en CRLF.
// Comparer des octets bruts après une opération git fait échouer un test que
// rien ne justifie.
function lire(chemin: string): string {
  return readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
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

// Deux chantiers issus de la MÊME base documentaire, livrés puis intégrés l'un
// après l'autre — le cas pour lequel tout ce dispositif existe.
//
// ⚠️ Le second chantier vit dans un **worktree secondaire**, où `.git` est un
// FICHIER et non un dossier. C'est le chemin de code que l'outil doit prendre
// via `git rev-parse --git-common-dir` : un `.git` supposé dossier casserait
// silencieusement le registre, en le dupliquant par worktree.
export function testChantierDeuxChantiers() {
  titre('Chantier — deux chantiers sur la même base, intégrés successivement');

  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    ignore('deux chantiers sur la même base', 'git introuvable');
    return;
  }

  const bac = mkdtempSync(join(tmpdir(), 'sw-forge-chantiers2-'));
  const codeA = join(bac, 'code-a');
  const codeB = join(bac, 'code-b');
  const docDir = join(bac, 'docs');

  try {
    mkdirSync(join(docDir, NOTES), { recursive: true });
    writeFileSync(join(docDir, NOTES, 'note-a.md'), 'base a\n');
    writeFileSync(join(docDir, NOTES, 'note-b.md'), 'base b\n');
    depotJetable(docDir);
    commiter(docDir, 'notes initiales\n');
    const baseInitiale = git(docDir, 'rev-parse', 'HEAD');

    mkdirSync(join(codeA, 'scripts'), { recursive: true });
    cpSync(OUTIL, join(codeA, 'scripts', 'chantier.mjs'));
    cpSync(join(RACINE, 'scripts', 'hooks-codex.mjs'), join(codeA, 'scripts', 'hooks-codex.mjs'));
    writeFileSync(join(codeA, '.gitignore'), `${NOTES}/\n`);
    depotJetable(codeA);
    commiter(codeA, 'code initial\n');
    git(codeA, 'checkout', '-b', 'forge/a');

    // Le second chantier : un worktree, pas un clone.
    git(codeA, 'worktree', 'add', '-b', 'forge/b', codeB, 'main');
    ok(
      readFileSync(join(codeB, '.git'), 'utf8').startsWith('gitdir:'),
      'dans le worktree secondaire, `.git` est bien un FICHIER'
    );

    let r = chantier(codeA, 'ouvrir', '--chantier', 'a', '--depot-doc', docDir);
    ok(r.code === 0, 'ouvrir le chantier A');
    r = chantier(codeB, 'ouvrir', '--chantier', 'b');
    ok(r.code === 0, 'ouvrir le chantier B depuis le worktree secondaire');
    ok(
      existsSync(join(codeA, '.git', 'forge', 'etat', 'chantiers', 'b.json')),
      'et son registre atterrit dans le répertoire git COMMUN, pas ailleurs'
    );

    // Chacun touche SON fichier — la découpe disjointe du cadrage.
    writeFileSync(join(codeA, NOTES, 'note-a.md'), 'travail de A\n');
    writeFileSync(join(codeA, 'src-a.txt'), 'a\n');
    commiter(codeA, 'travail A\n');
    r = chantier(codeA, 'livrer', '--chantier', 'a');
    ok(r.code === 0, 'A livre');

    writeFileSync(join(codeB, NOTES, 'note-b.md'), 'travail de B\n');
    writeFileSync(join(codeB, 'src-b.txt'), 'b\n');
    commiter(codeB, 'travail B\n');
    r = chantier(codeB, 'livrer', '--chantier', 'b');
    ok(r.code === 0, 'B livre, sans rien savoir de A');

    // ⚠️ Le point décisif : B est parti de la MÊME base que A et ne voit pas
    // son travail. Sans branche documentaire séparée, la livraison de B
    // écraserait `note-a.md` en la ramenant à la base.
    const wtA = (
      JSON.parse(
        readFileSync(join(codeA, '.git', 'forge', 'etat', 'chantiers', 'a.json'), 'utf8')
      ) as { worktreeDoc: string }
    ).worktreeDoc;

    ok(
      lire(join(wtA, NOTES, 'note-a.md')) === 'travail de A\n',
      'le travail de A survit à la livraison de B'
    );

    /* -------------------------------- intégration : le `main` documentaire */
    // ⚠️ `integrer` exige une sauvegarde JOIGNABLE avant de fusionner : sans
    // distant, la référence avancerait localement et nulle part ailleurs.
    const distantDoc = join(bac, 'docs-distant.git');
    execFileSync('git', ['init', '--bare', '-b', 'main', distantDoc], { encoding: 'utf8' });
    git(docDir, 'remote', 'add', 'origin', distantDoc);
    git(docDir, 'push', '-u', 'origin', 'main');

    r = chantier(codeA, 'integrer', '--chantier', 'a');
    ok(r.code === 0, 'integrer avance le `main` DOCUMENTAIRE');
    ok(
      lire(join(docDir, NOTES, 'note-a.md')) === 'travail de A\n',
      'la référence porte désormais le travail de A'
    );
    ok(
      git(docDir, 'rev-parse', 'HEAD') === git(docDir, 'rev-parse', 'origin/main'),
      'et elle est poussée — « intégré » implique « sauvegardé »'
    );

    /* ---------------------------------------------------- CAPITALISATION */
    // Le point pour lequel `integrer` existe : un chantier ouvert PLUS TARD
    // doit voir le travail déjà intégré, sans attendre que le CODE rejoigne
    // `main` — ce qui arrive rarement et par lots.
    const codeC = join(bac, 'code-c');
    git(codeA, 'worktree', 'add', '-b', 'forge/c', codeC, 'main');
    r = chantier(codeC, 'ouvrir', '--chantier', 'c');
    ok(r.code === 0, 'ouvrir un chantier plus tard');
    ok(
      lire(join(codeC, NOTES, 'note-a.md')) === 'travail de A\n',
      'et il PART du travail de A — la capitalisation fonctionne'
    );

    // Intégration successive : la seconde branche rejoint la première.
    r = chantier(codeB, 'integrer', '--chantier', 'b');
    ok(r.code === 0, 'integrer le second chantier');
    ok(
      lire(join(docDir, NOTES, 'note-a.md')) === 'travail de A\n' &&
        lire(join(docDir, NOTES, 'note-b.md')) === 'travail de B\n',
      'après deux intégrations successives, les DEUX travaux sont présents'
    );

    /* ------------------------------------------------------- le CONFLIT */
    // ⚠️ Un conflit exige deux branches parties de la MÊME base et touchant le
    // MÊME passage. C, ouvert après l'intégration de A, part d'une base qui
    // contient déjà A : sa modification de `note-a.md` fusionne proprement —
    // ce n'est pas un défaut, c'est le cas fréquent que la commande doit
    // servir. D remonte donc à la base INITIALE pour produire le vrai cas.
    const refAvantConflit = git(docDir, 'rev-parse', 'HEAD');
    const codeD = join(bac, 'code-d');
    git(codeA, 'worktree', 'add', '-b', 'forge/d', codeD, 'main');
    r = chantier(codeD, 'ouvrir', '--chantier', 'd', '--base', baseInitiale);
    ok(r.code === 0, 'ouvrir un chantier sur la base INITIALE');
    writeFileSync(join(codeD, NOTES, 'note-a.md'), 'travail de D sur le meme passage\n');
    writeFileSync(join(codeD, 'src-d.txt'), 'd\n');
    commiter(codeD, 'travail D\n');
    r = chantier(codeD, 'livrer', '--chantier', 'd');
    ok(r.code === 0, 'D livre');
    r = chantier(codeD, 'integrer', '--chantier', 'd');
    ok(r.code !== 0, 'integrer REFUSE une fusion en conflit');
    ok(
      git(docDir, 'rev-parse', 'HEAD') === refAvantConflit,
      'et la référence n’a pas bougé — la fusion est ANNULÉE, pas laissée à moitié'
    );
    ok(git(docDir, 'status', '--porcelain') === '', 'le dépôt documentaire reste propre');

    /* ------------------------------- l'identité du chantier est contrôlée */
    // ⚠️ Le registre est COMMUN aux worktrees : rien n'empêche B de nommer le
    // chantier de A. Sans contrôle, `livrer` reporterait LES NOTES DE B dans la
    // branche documentaire de A — worktree documentaire correct, propre, à la
    // bonne révision : tout cohérent sauf la provenance.
    const noteADansDoc = lire(join(wtA, NOTES, 'note-a.md'));
    r = chantier(codeB, 'livrer', '--chantier', 'a');
    ok(r.code !== 0, 'livrer depuis le worktree de B avec le nom du chantier de A est REFUSÉ');
    ok(/n’appartient pas à ce worktree|n'appartient pas à ce worktree/.test(r.sortie), 'et la raison est nommée');
    ok(lire(join(wtA, NOTES, 'note-a.md')) === noteADansDoc, 'les notes de A sont intactes');
    r = chantier(codeB, 'verifier', '--chantier', 'a');
    ok(r.code !== 0, 'verifier depuis le mauvais worktree est refusé aussi');

    // Même worktree, mais branche changée : le reçu lierait le journal à un
    // travail qui n'est pas le sien.
    git(codeB, 'checkout', '-b', 'forge/b-bis');
    r = chantier(codeB, 'livrer', '--chantier', 'b');
    ok(r.code !== 0, 'livrer après un changement de branche est refusé');
    git(codeB, 'checkout', 'forge/b');

    // ⚠️ Le reçu de A reste VALIDE après l'intégration : c'est le `main`
    // documentaire qui a avancé, pas la branche du chantier. La propriété est
    // voulue — intégrer les notes d'un chantier ne doit pas invalider ceux des
    // autres, sinon le rythme de l'un imposerait le sien à tous.
    // Ce que ce reçu ne dit toujours pas, c'est ce que vaut le RÉSULTAT
    // COMBINÉ : ça, seule une livraison de l'ensemble le dirait.
    r = chantier(codeA, 'verifier', '--chantier', 'a');
    ok(r.code === 0, 'le reçu de A reste valide : sa branche n’a pas bougé');
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
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
    // `installer` copie l'outil DEPUIS le dépôt où il tourne : le dépôt
    // jetable doit donc le porter, comme le vrai.
    mkdirSync(join(codeDir, 'scripts'), { recursive: true });
    cpSync(OUTIL, join(codeDir, 'scripts', 'chantier.mjs'));
    cpSync(join(RACINE, 'scripts', 'hooks-codex.mjs'), join(codeDir, 'scripts', 'hooks-codex.mjs'));
    mkdirSync(join(codeDir, '.githooks'), { recursive: true });
    cpSync(join(RACINE, '.githooks', 'pre-commit'), join(codeDir, '.githooks', 'pre-commit'));
    depotJetable(codeDir);
    commiter(codeDir, 'code initial\n');
    // Le chantier vit sur sa branche, comme dans le vrai dépôt : sinon le
    // commit de travail est trivialement un ancêtre de `main`, donc « intégré »,
    // et le refus de `fermer` ne peut pas être mis à l'épreuve.
    git(codeDir, 'checkout', '-b', 'forge/essai');

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
      lire(join(wt, NOTES, 'pistes.md')) === 'piste 1 modifiee\n',
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

    /* ------------------------- modification documentaire NON commitée */
    // Variante du refus n°2 : rien n'est commité de l'autre côté, mais le
    // report écraserait quand même un travail en cours.
    writeFileSync(join(wt, NOTES, 'pistes.md'), 'ecrit a la main, pas commite\n');
    r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code !== 0, 'livrer refuse une modification documentaire NON commitée');
    ok(
      lire(join(wt, NOTES, 'pistes.md')) === 'ecrit a la main, pas commite\n',
      'et la modification en cours survit'
    );
    git(wt, 'checkout', '--', '.');

    /* -------------------------------------------------- code non commité */
    writeFileSync(join(codeDir, 'src', 'app.ts'), 'export const x = 2;\n');
    r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code !== 0, 'livrer refuse tant que le code n’est pas commité');
    commiter(codeDir, 'suite du code\n');

    /* ------------------ interruption entre le commit des notes et le reçu */
    // ⚠️ Coupure PROVOQUÉE dans le vrai chemin de code, exactement dans la
    // fenêtre dangereuse : entre le commit des notes et la mise à jour du
    // registre. Un registre bricolé à la main ne prouverait pas qu'on sait
    // revenir de l'état réel — il prouverait qu'on sait revenir de l'état
    // qu'on a soi-même écrit.
    writeFileSync(join(codeDir, NOTES, 'apres-panne.md'), 'ecrit avant la panne\n');
    const revAvant = git(wt, 'rev-parse', 'HEAD');
    r = chantierAvecEnv(
      codeDir,
      { CHANTIER_ARRET_TEST: 'apres-commit-notes' },
      'livrer',
      '--chantier',
      'essai'
    );
    ok(r.code === 70, 'la livraison s’interrompt bien après le commit des notes');
    ok(git(wt, 'rev-parse', 'HEAD') !== revAvant, 'la branche documentaire a AVANCÉ');
    const registrePendant = JSON.parse(
      readFileSync(join(codeDir, '.git', 'forge', 'etat', 'chantiers', 'essai.json'), 'utf8')
    ) as { revisionDocAttendue: string };
    ok(
      registrePendant.revisionDocAttendue === revAvant,
      'et le registre est resté EN RETARD — c’est exactement l’état qui bloquait'
    );

    r = chantier(codeDir, 'livrer', '--chantier', 'essai');
    ok(r.code === 0, 'la livraison interrompue se rejoue et va à son terme');
    ok(/[Rr]eprise/.test(r.sortie), 'et la reprise est annoncée, pas subie en silence');
    ok(existsSync(join(wt, NOTES, 'apres-panne.md')), 'les notes déjà commitées restent');
    r = chantier(codeDir, 'verifier', '--chantier', 'essai');
    ok(r.code === 0, 'le reçu est valide après reprise');

    /* ------------------------------------------------------- installation */
    r = chantier(codeDir, 'installer');
    ok(r.code === 0, 'installer réussit');
    const manifeste = join(codeDir, '.git', 'forge', 'installation', 'manifeste.json');
    ok(existsSync(manifeste), 'un manifeste de version est écrit');
    ok(
      existsSync(join(codeDir, '.git', 'forge', 'installation', 'scripts', 'chantier.mjs')),
      'l’outil est copié HORS de l’arbre de travail'
    );
    // L'altération de l'installé doit se voir : c'est tout l'intérêt du
    // manifeste, sinon une installation modifiée à la main dormirait.
    writeFileSync(
      join(codeDir, '.git', 'forge', 'installation', 'scripts', 'chantier.mjs'),
      '// altere\n'
    );
    r = chantier(codeDir, 'verifier', '--chantier', 'essai');
    ok(r.code !== 0, 'verifier détecte une installation ALTÉRÉE');
    ok(/intègre|integre/i.test(r.sortie), 'et nomme le contrôle en échec');
    r = chantier(codeDir, 'installer');
    ok(r.code === 0, 'réinstaller répare');

    /* ------------------------------------------------------------ fermer */
    r = chantier(codeDir, 'fermer', '--chantier', 'essai');
    ok(r.code !== 0, 'fermer refuse sans sauvegarde distante');

    const distant = join(bac, 'docs-distant.git');
    execFileSync('git', ['init', '--bare', '-b', 'main', distant], { encoding: 'utf8' });
    git(docDir, 'remote', 'add', 'origin', distant);
    git(wt, 'push', '-u', 'origin', 'chantier/essai');

    r = chantier(codeDir, 'fermer', '--chantier', 'essai');
    ok(r.code !== 0, 'fermer refuse tant que le code n’est ni intégré ni archivé');
    ok(
      /seul exemplaire/i.test(r.sortie),
      'et dit pourquoi : une branche documentaire sauvegardée ne suffit pas'
    );
    ok(existsSync(wt), 'le worktree documentaire n’est pas supprimé sur un refus');

    // Le code rejoint `main` : la condition de conservation est remplie.
    git(codeDir, 'branch', '-f', 'main-integre', 'HEAD');
    r = chantier(codeDir, 'fermer', '--chantier', 'essai', '--integre-dans', 'main-integre');
    ok(r.code === 0, 'fermer réussit une fois le code intégré et les notes sauvegardées');
    ok(!existsSync(wt), 'le worktree documentaire est retiré');
    const registreFerme = JSON.parse(
      readFileSync(join(codeDir, '.git', 'forge', 'etat', 'chantiers', 'essai.json'), 'utf8')
    ) as { revisionDocFinale?: string; commitCodeFinal?: string };
    ok(
      Boolean(registreFerme.revisionDocFinale && registreFerme.commitCodeFinal),
      'et les références des deux commits sont CONSERVÉES dans le registre'
    );

    /* --------------------------------------------------------- le hook */
    // `installer` a câblé `core.hooksPath` sur l'installation commune : ce qui
    // suit éprouve le hook TEL QU'IL S'EXÉCUTE, pas le fichier source.
    const commitAvorte = (depot: string, message: string) => {
      git(depot, 'add', '-A');
      try {
        execFileSync('git', ['-C', depot, 'commit', '-F', '-'], {
          input: message,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { code: 0, sortie: '' };
      } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        return { code: err.status ?? 1, sortie: (err.stdout ?? '') + (err.stderr ?? '') };
      }
    };

    ok(
      git(codeDir, 'config', 'core.hooksPath').includes('installation'),
      'le hook est câblé sur l’INSTALLATION, pas sur `.githooks` du worktree'
    );

    // Un commit ordinaire sur une branche de chantier passe : un garde-fou qui
    // bloque le travail normal finit désactivé.
    writeFileSync(join(codeDir, 'src', 'app.ts'), 'export const x = 3;\n');
    let h = commitAvorte(codeDir, 'travail ordinaire\n');
    ok(h.code === 0, 'un commit ordinaire sur `forge/…` passe');

    // Chemin privé forcé dans l'index.
    writeFileSync(join(codeDir, NOTES, 'fuite.md'), 'ne doit jamais etre committe\n');
    git(codeDir, 'add', '-f', `${NOTES}/fuite.md`);
    h = commitAvorte(codeDir, 'fuite\n');
    ok(h.code !== 0, 'le hook REFUSE un chemin privé dans l’index');
    ok(/journal privé/i.test(h.sortie), 'et nomme la nature du fichier');
    git(codeDir, 'restore', '--staged', `${NOTES}/fuite.md`);

    // La spec PRODUIT porte presque le même chemin et doit passer : un motif
    // sans la barre finale interdirait de committer la spec publique.
    mkdirSync(join(codeDir, 'spec', 'outils'), { recursive: true });
    writeFileSync(join(codeDir, 'spec', 'outils', 'optimizer.md'), 'spec publique\n');
    h = commitAvorte(codeDir, 'spec produit\n');
    ok(h.code === 0, 'mais `spec/outils/optimizer.md` (spec produit) passe');

    // Fichier démesuré : la cible est l'export de compte.
    writeFileSync(join(codeDir, 'export.json'), 'x'.repeat(6 * 1024 * 1024));
    h = commitAvorte(codeDir, 'export\n');
    ok(h.code !== 0, 'le hook REFUSE un fichier démesuré');
    git(codeDir, 'restore', '--staged', 'export.json');
    rmSync(join(codeDir, 'export.json'));

    // Sur `main`, rien ne passe.
    git(codeDir, 'checkout', 'main');
    writeFileSync(join(codeDir, 'src', 'app.ts'), 'export const x = 4;\n');
    h = commitAvorte(codeDir, 'commit sur main\n');
    ok(h.code !== 0, 'le hook REFUSE un commit direct sur `main`');
    ok(/trois incidents/i.test(h.sortie), 'et rappelle pourquoi la règle existe');
  } finally {
    // Le worktree documentaire est VERROUILLÉ par `ouvrir` : `rmSync` suffit
    // pour du jetable, git n'a pas son mot à dire sur un dossier temporaire.
    rmSync(bac, { recursive: true, force: true });
  }
}
