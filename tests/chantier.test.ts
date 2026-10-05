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
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs';
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
    mkdirSync(join(code, 'scripts', 'lib'), { recursive: true });
    mkdirSync(join(code, '.githooks'));
    for (const fichier of ['chantier.mjs', 'hooks-codex.mjs', 'spec-lint.mjs']) {
      cpSync(join(RACINE, 'scripts', fichier), join(code, 'scripts', fichier));
    }
    cpSync(join(RACINE, 'scripts', 'lib', 'spec-markdown.mjs'), join(code, 'scripts', 'lib', 'spec-markdown.mjs'));
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

    mkdirSync(join(codeA, 'scripts', 'lib'), { recursive: true });
    cpSync(OUTIL, join(codeA, 'scripts', 'chantier.mjs'));
    cpSync(join(RACINE, 'scripts', 'hooks-codex.mjs'), join(codeA, 'scripts', 'hooks-codex.mjs'));
    cpSync(join(RACINE, 'scripts', 'spec-lint.mjs'), join(codeA, 'scripts', 'spec-lint.mjs'));
    cpSync(join(RACINE, 'scripts', 'lib', 'spec-markdown.mjs'), join(codeA, 'scripts', 'lib', 'spec-markdown.mjs'));
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

    const refusPush = join(distantDoc, 'hooks', 'pre-receive');
    writeFileSync(refusPush, '#!/bin/sh\nexit 1\n');
    chmodSync(refusPush, 0o755);
    const avantRefus = git(docDir, 'rev-parse', 'HEAD');
    r = chantier(codeA, 'integrer', '--chantier', 'a');
    ok(r.code !== 0 && /sauvegarde NON confirmée/.test(r.sortie), 'distant joignable mais push refusé : aucun faux succès');
    const fusionLocale = git(docDir, 'rev-parse', 'HEAD');
    ok(fusionLocale !== avantRefus && git(distantDoc, 'rev-parse', 'main') === avantRefus,
      'la fusion locale est conservée, le distant reste inchangé');
    rmSync(refusPush);
    r = chantier(codeA, 'integrer', '--chantier', 'a');
    ok(r.code === 0 && git(docDir, 'rev-parse', 'HEAD') === fusionLocale,
      'la reprise pousse la fusion existante sans nouveau commit');
    const registreA = join(codeA, '.git', 'forge', 'etat', 'chantiers', 'a.json');
    const integrations = JSON.parse(readFileSync(registreA, 'utf8')).integrations.length;
    r = chantier(codeA, 'integrer', '--chantier', 'a');
    ok(r.code === 0 && JSON.parse(readFileSync(registreA, 'utf8')).integrations.length === integrations,
      'une intégration déjà sauvegardée ne duplique pas son historique');
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

// `rafraichir` — le dispositif POUSSE (livrer → integrer), il ne TIRAIT jamais.
// Un chantier ouvert avant qu'un autre intègre ses notes travaillait sur une
// référence périmée sans le savoir. Ce qui est testé ici, c'est encore ce qui
// PERD : des notes inédites recouvertes par la copie miroir, un conflit laissé
// à moitié, un reçu invalidé par une simple remise à niveau.
export function testChantierRafraichir() {
  titre('Chantier — rafraichir tire le main documentaire vers un chantier ouvert');

  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    ignore('rafraichir tire le main documentaire', 'git introuvable');
    return;
  }

  const bac = mkdtempSync(join(tmpdir(), 'sw-forge-chantier-raf-'));
  const codeA = join(bac, 'code-a');
  const codeB = join(bac, 'code-b');
  const docDir = join(bac, 'docs');

  try {
    mkdirSync(join(docDir, NOTES), { recursive: true });
    writeFileSync(join(docDir, NOTES, 'note-a.md'), 'base a\n');
    writeFileSync(join(docDir, NOTES, 'note-b.md'), 'base b\n');
    writeFileSync(join(docDir, NOTES, 'obsolete.md'), 'a supprimer\n');
    depotJetable(docDir);
    commiter(docDir, 'notes initiales\n');
    // `rafraichir` exige un distant JOIGNABLE : sans fetch, on ne sait pas si
    // la référence locale est à jour.
    const distantDoc = join(bac, 'docs-distant.git');
    execFileSync('git', ['init', '--bare', '-b', 'main', distantDoc], { encoding: 'utf8' });
    git(docDir, 'remote', 'add', 'origin', distantDoc);
    git(docDir, 'push', '-u', 'origin', 'main');

    mkdirSync(join(codeA, 'scripts', 'lib'), { recursive: true });
    cpSync(OUTIL, join(codeA, 'scripts', 'chantier.mjs'));
    cpSync(join(RACINE, 'scripts', 'hooks-codex.mjs'), join(codeA, 'scripts', 'hooks-codex.mjs'));
    cpSync(join(RACINE, 'scripts', 'spec-lint.mjs'), join(codeA, 'scripts', 'spec-lint.mjs'));
    cpSync(join(RACINE, 'scripts', 'lib', 'spec-markdown.mjs'), join(codeA, 'scripts', 'lib', 'spec-markdown.mjs'));
    writeFileSync(join(codeA, '.gitignore'), `${NOTES}/\n`);
    depotJetable(codeA);
    commiter(codeA, 'code initial\n');
    git(codeA, 'checkout', '-b', 'forge/a');
    git(codeA, 'worktree', 'add', '-b', 'forge/b', codeB, 'main');

    let r = chantier(codeA, 'ouvrir', '--chantier', 'a', '--depot-doc', docDir);
    ok(r.code === 0, 'ouvrir A');
    r = chantier(codeB, 'ouvrir', '--chantier', 'b');
    ok(r.code === 0, 'ouvrir B sur la même base');
    const registreB = join(codeA, '.git', 'forge', 'etat', 'chantiers', 'b.json');
    const wtB = (JSON.parse(readFileSync(registreB, 'utf8')) as { worktreeDoc: string }).worktreeDoc;

    /* --------------------------------------------------- à jour : no-op */
    // Un chantier jamais livré peut se rafraîchir : la commande ne dépend pas
    // d'un reçu, seulement de l'égalité entre notes locales et notes reportées.
    r = chantier(codeB, 'rafraichir', '--chantier', 'b');
    ok(r.code === 0 && /Déjà à jour/.test(r.sortie), 'à jour : rafraichir le dit, sans reçu ni commit');
    const teteBAvant = git(wtB, 'rev-parse', 'HEAD');

    /* ----------------------------- notes inédites : refus, rien écrasé */
    writeFileSync(join(codeB, NOTES, 'note-b.md'), 'travail de B non livre\n');
    const empreinteInedite = lire(join(codeB, NOTES, 'note-b.md'));
    r = chantier(codeB, 'rafraichir', '--chantier', 'b');
    ok(r.code !== 0 && /[Ll]ivrer d'abord/.test(r.sortie), 'notes non livrées : refus « livrer d’abord »');
    ok(lire(join(codeB, NOTES, 'note-b.md')) === empreinteInedite, 'et rien n’a été écrasé');
    ok(git(wtB, 'rev-parse', 'HEAD') === teteBAvant, 'ni commité côté documentaire');
    writeFileSync(join(codeB, 'src-b.txt'), 'b\n');
    commiter(codeB, 'travail B\n');
    r = chantier(codeB, 'livrer', '--chantier', 'b');
    ok(r.code === 0, 'B livre son travail');

    /* --------------------- main avance (A intègre) : merge + miroir chez B */
    writeFileSync(join(codeA, NOTES, 'note-a.md'), 'travail de A\n');
    writeFileSync(join(codeA, NOTES, 'nouvelle-a.md'), 'ajout de A\n');
    rmSync(join(codeA, NOTES, 'obsolete.md'));
    writeFileSync(join(codeA, 'src-a.txt'), 'a\n');
    commiter(codeA, 'travail A\n');
    r = chantier(codeA, 'livrer', '--chantier', 'a');
    ok(r.code === 0, 'A livre');
    r = chantier(codeA, 'integrer', '--chantier', 'a');
    ok(r.code === 0, 'A intègre : le main documentaire avance');
    const mainDoc = git(docDir, 'rev-parse', 'HEAD');

    ok(!existsSync(join(codeB, NOTES, 'nouvelle-a.md')), 'B ne voit pas encore le travail de A');
    const teteBAvantRaf = git(wtB, 'rev-parse', 'HEAD');
    r = chantier(codeB, 'rafraichir', '--chantier', 'b');
    ok(r.code === 0, 'rafraichir réussit quand main a avancé');
    ok(/ajoutés\s+: 1/.test(r.sortie) && /modifiés\s+: 1/.test(r.sortie) && /supprimés\s+: 1/.test(r.sortie),
      'et rend compte : 1 ajouté, 1 modifié, 1 supprimé');
    ok(lire(join(codeB, NOTES, 'nouvelle-a.md')) === 'ajout de A\n', 'le fichier ajouté par A est arrivé chez B');
    ok(lire(join(codeB, NOTES, 'note-a.md')) === 'travail de A\n', 'la modification de A est arrivée');
    ok(!existsSync(join(codeB, NOTES, 'obsolete.md')), 'le fichier supprimé dans main a disparu du worktree de code');
    ok(lire(join(codeB, NOTES, 'note-b.md')) === 'travail de B non livre\n', 'le travail livré de B est conservé');
    const teteBApres = git(wtB, 'rev-parse', 'HEAD');
    ok(teteBApres !== teteBAvantRaf && /Rafraîchissement du chantier b depuis main/.test(git(wtB, 'log', '-1', '--format=%s')),
      'un commit de fusion nommé porte le rafraîchissement');
    ok(git(wtB, 'merge-base', '--is-ancestor', mainDoc, 'HEAD') === '', 'la branche de B contient main');
    const registre = JSON.parse(readFileSync(registreB, 'utf8')) as {
      revisionDocAttendue: string;
      dernierRafraichissement: { empreinteAvant: string; empreinteApres: string };
    };
    ok(registre.revisionDocAttendue === teteBApres, 'la révision attendue est le nouveau HEAD documentaire');
    ok(registre.dernierRafraichissement.empreinteAvant !== registre.dernierRafraichissement.empreinteApres,
      'le registre porte les empreintes avant/après');
    ok(execFileSync('git', ['-C', wtB, 'status', '--porcelain'], { encoding: 'utf8' }) === '',
      'le worktree documentaire est propre après le rafraîchissement');

    /* ------------------- verifier passe : la base a avancé, pas le travail */
    r = chantier(codeB, 'verifier', '--chantier', 'b');
    ok(r.code === 0, 'verifier passe après un rafraichir sans nouveau livrer');
    ok(/base rafraîchie depuis main/.test(r.sortie), 'et dit que la base a avancé');
    // Une modification APRÈS le rafraîchissement redevient une note non livrée.
    writeFileSync(join(codeB, NOTES, 'note-b.md'), 'encore du travail\n');
    r = chantier(codeB, 'verifier', '--chantier', 'b');
    ok(r.code !== 0, 'une modification après le rafraîchissement périme bien le reçu');
    r = chantier(codeB, 'livrer', '--chantier', 'b');
    ok(r.code === 0, 'livrer repart de la base rafraîchie');
    r = chantier(codeB, 'verifier', '--chantier', 'b');
    ok(r.code === 0, 'et le nouveau reçu est valide');
    r = chantier(codeB, 'rafraichir', '--chantier', 'b');
    ok(r.code === 0 && /Déjà à jour/.test(r.sortie), 'rejouer rafraichir sans nouveauté est un no-op');

    /* -------------------------------------------- conflit : refus propre */
    // B intègre son travail sur `note-b.md` ; A, qui ne l'a pas, modifie le
    // MÊME passage : la fusion de main dans la branche de A ne peut pas se
    // faire seule.
    r = chantier(codeB, 'integrer', '--chantier', 'b');
    ok(r.code === 0, 'B intègre après s’être rafraîchi : aucun conflit avec A');
    writeFileSync(join(codeA, NOTES, 'note-b.md'), 'travail de A sur le passage de B\n');
    writeFileSync(join(codeA, 'src-a.txt'), 'a2\n');
    commiter(codeA, 'travail A 2\n');
    r = chantier(codeA, 'rafraichir', '--chantier', 'a');
    ok(r.code !== 0 && /[Ll]ivrer d'abord/.test(r.sortie), 'A a des notes inédites : rafraichir refuse');
    r = chantier(codeA, 'livrer', '--chantier', 'a');
    ok(r.code === 0, 'A livre');
    const registreA = join(codeA, '.git', 'forge', 'etat', 'chantiers', 'a.json');
    const wtA = (JSON.parse(readFileSync(registreA, 'utf8')) as { worktreeDoc: string }).worktreeDoc;
    const teteAAvantConflit = git(wtA, 'rev-parse', 'HEAD');
    const arbreAAvantConflit = git(wtA, 'rev-parse', 'HEAD^{tree}');
    r = chantier(codeA, 'rafraichir', '--chantier', 'a');
    ok(r.code !== 0 && /CONFLIT/.test(r.sortie) && /note-b\.md/.test(r.sortie),
      'A ne peut pas se rafraîchir : conflit nommé sur note-b.md');
    ok(/worktree DOCUMENTAIRE/.test(r.sortie), 'et la marche à suivre est donnée');
    ok(git(wtA, 'rev-parse', 'HEAD') === teteAAvantConflit, 'HEAD documentaire de A inchangé');
    ok(git(wtA, 'status', '--porcelain') === '', 'le worktree documentaire de A est revenu propre');
    ok(!existsSync(join(git(wtA, 'rev-parse', '--git-dir'), 'MERGE_HEAD')), 'aucune fusion laissée en cours');
    git(wtA, 'add', '-A');
    ok(git(wtA, 'write-tree') === arbreAAvantConflit, 'l’arbre documentaire est celui d’avant');
    ok(lire(join(codeA, NOTES, 'note-b.md')) === 'travail de A sur le passage de B\n', 'les notes locales de A sont intactes');
    r = chantier(codeA, 'verifier', '--chantier', 'a');
    ok(r.code === 0, 'le reçu de A est toujours valide après le refus');

    /* ------------------ conflit résolu À LA MAIN : rafraichir reprend ------- */
    // Marche à suivre affichée par le refus ci-dessus : fusionner `main` dans
    // le worktree DOCUMENTAIRE, résoudre, committer — puis relancer
    // `rafraichir`. Avant le correctif du 2026-09-17, cette relance refusait
    // « la branche documentaire a avancé indépendamment » : le commit de
    // fusion fait à la main n'est pas la révision attendue, et rien ne le
    // distinguait d'un commit venu d'ailleurs.
    let conflitReleve = false;
    try {
      git(wtA, 'merge', 'main');
    } catch {
      conflitReleve = true;
    }
    ok(conflitReleve, 'la fusion à la main reproduit le même conflit sur note-b.md');
    writeFileSync(join(wtA, NOTES, 'note-b.md'), 'résolu à la main par A\n');
    git(wtA, 'add', '-A');
    execFileSync('git', ['-C', wtA, 'commit', '--no-edit'], { encoding: 'utf8' });
    const teteApresFusionManuelle = git(wtA, 'rev-parse', 'HEAD');

    r = chantier(codeA, 'rafraichir', '--chantier', 'a');
    ok(r.code === 0, 'rafraichir reprend la fusion résolue à la main (au lieu de refuser)');
    ok(/[Ff]usion résolue à la main reprise/.test(r.sortie), 'et le dit dans le message');
    ok(lire(join(codeA, NOTES, 'note-b.md')) === 'résolu à la main par A\n',
      'la résolution manuelle est recopiée côté code, sans nouvelle fusion');
    const registreAApresReprise = JSON.parse(readFileSync(registreA, 'utf8')) as { revisionDocAttendue: string };
    ok(registreAApresReprise.revisionDocAttendue === teteApresFusionManuelle,
      'le registre adopte le commit de fusion manuelle comme révision attendue');
    r = chantier(codeA, 'verifier', '--chantier', 'a');
    ok(r.code === 0, 'verifier passe après la reprise');

    /* ---------------- un commit ORDINAIRE ailleurs reste refusé ------------ */
    // Un simple commit (un seul parent) sur la branche documentaire, fait
    // sans passer par `rafraichir`, ne doit jamais être confondu avec une
    // fusion résolue à la main.
    writeFileSync(join(wtA, NOTES, 'intrus.md'), 'commit ordinaire, pas une fusion\n');
    git(wtA, 'add', '-A');
    execFileSync('git', ['-C', wtA, 'commit', '-F', '-'], { input: 'commit ordinaire ailleurs\n', encoding: 'utf8' });
    r = chantier(codeA, 'rafraichir', '--chantier', 'a');
    ok(r.code !== 0 && /avancé indépendamment/.test(r.sortie),
      'un commit ORDINAIRE (un seul parent) reste refusé, ce n’est pas une fusion');
    git(wtA, 'reset', '--hard', teteApresFusionManuelle);

    /* ------------- une fusion depuis une AUTRE branche que main refuse ----- */
    git(docDir, 'branch', 'autre', 'main');
    git(docDir, 'checkout', 'autre');
    writeFileSync(join(docDir, NOTES, 'ecart.md'), 'sur une autre branche que main\n');
    commiter(docDir, 'commit sur autre\n');
    git(docDir, 'checkout', 'main');
    git(wtA, 'merge', 'autre');
    r = chantier(codeA, 'rafraichir', '--chantier', 'a');
    ok(r.code !== 0 && /avancé indépendamment/.test(r.sortie),
      'une fusion dont le second parent vient d’une AUTRE branche que main reste refusée');
    git(wtA, 'reset', '--hard', teteApresFusionManuelle);
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

// `livrer` applique spec-lint (même config, même périmètre que `pre-commit`,
// B.9) aux notes privées AVANT de les reporter : un bloc trop long ne doit
// jamais atteindre la branche documentaire.
export function testChantierLintNotes() {
  titre('Chantier — livrer refuse des notes qui échouent spec-lint');

  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    ignore('livrer refuse des notes qui échouent spec-lint', 'git introuvable');
    return;
  }

  const bac = mkdtempSync(join(tmpdir(), 'sw-forge-chantier-lint-'));
  const codeDir = join(bac, 'code');
  const docDir = join(bac, 'docs');

  try {
    mkdirSync(join(docDir, NOTES), { recursive: true });
    writeFileSync(join(docDir, NOTES, 'note.md'), 'base\n');
    depotJetable(docDir);
    commiter(docDir, 'notes initiales\n');

    mkdirSync(join(codeDir, 'scripts', 'lib'), { recursive: true });
    cpSync(OUTIL, join(codeDir, 'scripts', 'chantier.mjs'));
    cpSync(join(RACINE, 'scripts', 'spec-lint.mjs'), join(codeDir, 'scripts', 'spec-lint.mjs'));
    cpSync(join(RACINE, 'scripts', 'lib', 'spec-markdown.mjs'), join(codeDir, 'scripts', 'lib', 'spec-markdown.mjs'));
    mkdirSync(join(codeDir, 'spec'), { recursive: true });
    writeFileSync(join(codeDir, 'spec', 'spec-lint.json'), JSON.stringify({ perimetre: ['spec/outils/**'], exceptions: [] }));
    writeFileSync(join(codeDir, '.gitignore'), `${NOTES}/\n`);
    depotJetable(codeDir);
    commiter(codeDir, 'code initial\n');
    git(codeDir, 'checkout', '-b', 'forge/essai-lint');

    ok(chantier(codeDir, 'ouvrir', '--chantier', 'essai-lint', '--depot-doc', docDir).code === 0, 'ouvrir réussit');

    const lignes = Array.from({ length: 101 }, (_, i) => `Ligne ${i + 1} de contenu.`);
    const contenu = `# Note\n\n**Statut :** État actuel\n\n## Section\n\n${lignes.join('\n')}\n`;
    writeFileSync(join(codeDir, NOTES, 'note.md'), contenu);

    const r = chantier(codeDir, 'livrer', '--chantier', 'essai-lint');
    ok(r.code !== 0, 'livrer refuse un bloc de 101 lignes dans les notes');
    ok(/bloc-trop-long/.test(r.sortie), 'et nomme la règle en cause');

    const wt = (
      JSON.parse(
        readFileSync(join(codeDir, '.git', 'forge', 'etat', 'chantiers', 'essai-lint.json'), 'utf8')
      ) as { worktreeDoc: string }
    ).worktreeDoc;
    ok(lire(join(wt, NOTES, 'note.md')) === 'base\n', 'et rien n’est reporté côté documentaire');
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
    mkdirSync(join(codeDir, 'scripts', 'lib'), { recursive: true });
    cpSync(OUTIL, join(codeDir, 'scripts', 'chantier.mjs'));
    cpSync(join(RACINE, 'scripts', 'hooks-codex.mjs'), join(codeDir, 'scripts', 'hooks-codex.mjs'));
    cpSync(join(RACINE, 'scripts', 'spec-lint.mjs'), join(codeDir, 'scripts', 'spec-lint.mjs'));
    cpSync(join(RACINE, 'scripts', 'lib', 'spec-markdown.mjs'), join(codeDir, 'scripts', 'lib', 'spec-markdown.mjs'));
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

/* ==========================================================================
 * Lot O (cadrage degats-et-aura) — verrous de `ouvrir` et `livrer`
 *
 * ⚠️ Les dépôts documentaires jetables portent `* -text`, comme le vrai
 * (`sw-forge-docs/.gitattributes`) : sans lui, `core.autocrlf` réécrirait les
 * fins de ligne à chaque checkout, et les octets comparés ne seraient plus
 * ceux que le dépôt archive. Les contenus se comparent donc BRUTS, sans
 * `lire()`.
 * ======================================================================== */

type Notes = Record<string, string | null>;

function gitDisponible(libelle: string): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    ignore(libelle, 'git introuvable');
    return false;
  }
}

// `null` supprime le fichier.
function ecrireNotes(dossier: string, notes: Notes) {
  for (const [rel, contenu] of Object.entries(notes)) {
    const chemin = join(dossier, ...rel.split('/'));
    if (contenu === null) rmSync(chemin, { force: true });
    else {
      mkdirSync(dirname(chemin), { recursive: true });
      writeFileSync(chemin, contenu);
    }
  }
}

// Contenus BRUTS, fins de ligne comprises.
function lireNotes(dossier: string, prefixe = ''): Record<string, string> {
  const r: Record<string, string> = {};
  if (!existsSync(join(dossier, prefixe))) return r;
  for (const e of readdirSync(join(dossier, prefixe), { withFileTypes: true })) {
    const rel = prefixe ? `${prefixe}/${e.name}` : e.name;
    if (e.isDirectory()) Object.assign(r, lireNotes(dossier, rel));
    else r[rel] = readFileSync(join(dossier, rel), 'utf8');
  }
  return r;
}

function memesNotes(a: Notes, b: Notes): boolean {
  const trie = (o: Notes) =>
    JSON.stringify(Object.entries(o).filter(([, v]) => v !== null).sort(([x], [y]) => (x < y ? -1 : 1)));
  return trie(a) === trie(b);
}

function commitNotes(docDir: string, notes: Notes, message: string): string {
  ecrireNotes(join(docDir, NOTES), notes);
  commiter(docDir, message);
  return git(docDir, 'rev-parse', 'HEAD');
}

// Chemins EXACTS, casse comprise, du sous-arbre des notes à une révision.
function sousArbre(depot: string, rev: string): string[] {
  return git(depot, 'ls-tree', '-r', '-z', '--name-only', rev, '--', NOTES)
    .split('\0')
    .filter(Boolean)
    .map((c) => c.slice(NOTES.length + 1));
}

function cheminRegistre(code: string, nom: string): string {
  return join(code, '.git', 'forge', 'etat', 'chantiers', `${nom}.json`);
}

function registre(code: string, nom: string) {
  return JSON.parse(readFileSync(cheminRegistre(code, nom), 'utf8'));
}

function modifierRegistre(code: string, nom: string, f: (r: Record<string, unknown>) => void) {
  const r = registre(code, nom);
  f(r);
  writeFileSync(cheminRegistre(code, nom), JSON.stringify(r, null, 2) + '\n');
}

function bacChantier(prefixe: string) {
  const bac = mkdtempSync(join(tmpdir(), prefixe));
  const docDir = join(bac, 'docs');
  const code = join(bac, 'code');
  mkdirSync(docDir, { recursive: true });
  writeFileSync(join(docDir, '.gitattributes'), '* -text\n');
  depotJetable(docDir);
  mkdirSync(code, { recursive: true });
  writeFileSync(join(code, '.gitignore'), `${NOTES}/\n`);
  writeFileSync(join(code, 'x.txt'), 'x\n');
  depotJetable(code);
  commiter(code, 'code initial\n');
  git(code, 'checkout', '-b', 'forge/essai');
  return { bac, docDir, code };
}

function ajouterDistant(bac: string, docDir: string) {
  const distant = join(bac, 'docs-distant.git');
  execFileSync('git', ['init', '--bare', '-b', 'main', distant], { encoding: 'utf8' });
  git(docDir, 'remote', 'add', 'origin', distant);
  git(docDir, 'push', '-u', 'origin', 'main');
}

// Un autre chantier : un worktree du dépôt de code, sur sa propre branche.
function worktreeCode(code: string, nom: string): string {
  const wt = join(dirname(code), `code-${nom}`);
  git(code, 'worktree', 'add', '-b', `forge/${nom}`, wt, 'main');
  return wt;
}

// L'incident du 2026-09-23, rejoué. Des notes locales restées à un état ANCIEN
// du `main` documentaire ; `main` a reçu depuis le travail d'un autre chantier
// (ici `relique/`). L'ancien `ouvrir` les gardait avec un simple
// avertissement, et le premier `livrer` les recopiait en miroir : tout ce
// qu'elles n'avaient pas reçu quittait la branche, puis `main` à l'intégration.
export function testChantierIncidentNotesEnRetard() {
  titre('Chantier — incident du 2026-09-23 : des notes en retard ne passent plus');
  if (!gitDisponible('incident des notes en retard')) return;
  const { bac, docDir, code } = bacChantier('sw-forge-chantier-incident-');
  try {
    const ancien: Notes = { 'invariants.md': 'invariants\n', 'pistes.md': 'pistes\n' };
    const revAncienne = commitNotes(docDir, ancien, 'notes initiales\n');
    const actuel: Notes = {
      ...ancien,
      'invariants.md': 'invariants\n## Reliques\n',
      'relique/a.md': 'relique a\n',
      'relique/b.md': 'relique b\n',
    };
    commitNotes(docDir, actuel, 'intégration du chantier relique\n');

    // Premier temps : `ouvrir` sur des notes en retard les REMPLACE.
    ecrireNotes(join(code, NOTES), ancien);
    let r = chantier(code, 'ouvrir', '--chantier', 'incident', '--depot-doc', docDir);
    ok(r.code === 0, 'ouvrir réussit sur des notes en retard');
    ok(memesNotes(lireNotes(join(code, NOTES)), actuel), 'et les REMPLACE par la base : le travail relique est là');
    ok(/EN RETARD/.test(r.sortie) && r.sortie.includes(revAncienne.slice(0, 7)),
      'en nommant la révision où elles étaient restées');
    const sauvegardes = join(code, '.git', 'forge', 'sauvegardes', 'incident');
    const horodatages = existsSync(sauvegardes) ? readdirSync(sauvegardes) : [];
    ok(horodatages.length === 1 && memesNotes(lireNotes(join(sauvegardes, horodatages[0] ?? '')), ancien),
      'les notes remplacées sont sauvegardées sous le répertoire Git commun');

    // Second temps : les mêmes notes, ADOPTÉES explicitement, ne peuvent plus
    // effacer ce qu'elles n'ont pas reçu.
    const code2 = worktreeCode(code, 'incident2');
    ecrireNotes(join(code2, NOTES), ancien);
    r = chantier(code2, 'ouvrir', '--chantier', 'incident2', '--adopter');
    ok(r.code === 0 && memesNotes(lireNotes(join(code2, NOTES)), ancien), 'ouvrir --adopter garde les notes telles quelles');
    const wt2 = registre(code, 'incident2').worktreeDoc as string;
    const teteAvant = git(wt2, 'rev-parse', 'HEAD');
    r = chantier(code2, 'livrer', '--chantier', 'incident2');
    ok(r.code !== 0, 'livrer REFUSE : la branche porte un contenu que ces notes n’ont pas reçu');
    ok(/relique\/a\.md/.test(r.sortie) && /--adopter/.test(r.sortie), 'en nommant ce qui serait effacé, et la marche à suivre');
    ok(git(wt2, 'rev-parse', 'HEAD') === teteAvant && sousArbre(wt2, 'HEAD').includes('relique/a.md'),
      'rien n’a quitté la branche documentaire');
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

// `ouvrir` compare l'arbre ENTIER des notes locales à la base, octets tels que
// le dépôt documentaire les archive. Chaque cas sur son propre worktree.
export function testChantierOuvrirCas() {
  titre('Chantier — ouvrir : notes absentes, identiques, en retard, inconnues');
  if (!gitDisponible('ouvrir compare les notes à la base')) return;
  const { bac, docDir, code } = bacChantier('sw-forge-chantier-ouvrir-');
  try {
    const R0: Notes = { 'n1.md': 'un\n', 'n2.md': 'deux\n', 'dir/n3.md': 'trois\n' };
    const r0 = commitNotes(docDir, R0, 'r0\n');
    const R1: Notes = { ...R0, 'n1.md': 'un v2\n', 'n4.md': 'quatre\n' };
    const r1 = commitNotes(docDir, R1, 'r1\n');
    // Fins de ligne : `n5.md` archivé en CRLF à r2, en LF à r3 — seule différence.
    const R2: Notes = { ...R1, 'n2.md': 'deux v2\n', 'n5.md': 'cinq\r\n' };
    const r2 = commitNotes(docDir, R2, 'r2\n');
    const R3: Notes = { ...R2, 'n5.md': 'cinq\n' };
    const r3 = commitNotes(docDir, R3, 'r3\n');

    let n = 0;
    const essai = (notes: Notes | 'vide' | null, ...args: string[]) => {
      const nom = `cas${++n}`;
      const wt = n === 1 ? code : worktreeCode(code, nom);
      if (notes === 'vide') mkdirSync(join(wt, NOTES), { recursive: true });
      else if (notes) ecrireNotes(join(wt, NOTES), notes);
      const r = chantier(wt, 'ouvrir', '--chantier', nom, ...(n === 1 ? ['--depot-doc', docDir] : []), ...args);
      return { r, wt, nom, notes: lireNotes(join(wt, NOTES)) };
    };
    // Un refus ne laisse ni registre, ni worktree, ni branche documentaire.
    const sansTrace = (nom: string) =>
      !existsSync(cheminRegistre(code, nom)) &&
      !existsSync(join(bac, 'docs-chantiers', nom)) &&
      git(docDir, 'branch', '--list', `chantier/${nom}`) === '';

    let e = essai(null);
    ok(e.r.code === 0 && memesNotes(e.notes, R3), 'absentes : copie de la base');
    ok(registre(code, e.nom).base?.revision === r3, 'et la base synchronisée est enregistrée');

    e = essai(R3);
    ok(e.r.code === 0 && /identiques/.test(e.r.sortie) && memesNotes(e.notes, R3), 'identiques à la base : rien à faire');
    ok(!existsSync(join(code, '.git', 'forge', 'sauvegardes', e.nom)), 'et aucune sauvegarde');

    e = essai(R0);
    ok(e.r.code === 0 && memesNotes(e.notes, R3), 'en retard (ancêtre de la base) : remplacées par la base');
    ok(e.r.sortie.includes(r0.slice(0, 7)) && /ajoutés\s+: 2/.test(e.r.sortie) && /modifiés\s+: 2/.test(e.r.sortie),
      'avec la liste de ce qui change');
    ok(existsSync(join(code, '.git', 'forge', 'sauvegardes', e.nom)), 'et une sauvegarde des notes remplacées');

    e = essai(R2);
    ok(e.r.code === 0 && e.r.sortie.includes(r2.slice(0, 7)) && e.notes['n5.md'] === 'cinq\n',
      'fins de ligne : r2 et r3 ne diffèrent que par CRLF/LF, la différence archivée est détectée');
    e = essai({ ...R3, 'n2.md': 'deux v2\r\n' });
    ok(e.r.code !== 0 && /1 inédits.*n2\.md/.test(e.r.sortie) && sansTrace(e.nom),
      'un CRLF local sur un fichier archivé en LF est un contenu différent : refus');

    e = essai({ ...R3, 'n1.md': 'travail inédit\n' });
    ok(e.r.code !== 0 && /1 inédits.*n1\.md/.test(e.r.sortie), 'inédites : refus, diagnostic par fichier');
    ok(sansTrace(e.nom) && e.notes['n1.md'] === 'travail inédit\n', 'sans branche, ni worktree, ni registre ; notes intactes');

    e = essai('vide');
    ok(e.r.code !== 0 && /VIDE/.test(e.r.sortie) && sansTrace(e.nom), 'dossier vide : refus');
    ok(existsSync(join(e.wt, NOTES)), 'et le dossier vide reste en place');

    e = essai({ ...R3, 'n2.md': null });
    ok(e.r.code !== 0 && /1 absents localement : n2\.md/.test(e.r.sortie) && sansTrace(e.nom),
      'partielles : refus, fichiers absents nommés');

    e = essai({ ...R3, 'n1.md': 'un\n' });
    ok(e.r.code !== 0 && /1 versions antérieures.*n1\.md/.test(e.r.sortie),
      'une version antérieure est distinguée d’un contenu inédit');

    e = essai(R3, '--base', r1);
    ok(e.r.code !== 0 && /n'est PAS un ancêtre/.test(e.r.sortie) && e.r.sortie.includes(r3.slice(0, 7)),
      '--base plus ancienne que les notes : refus nommé');
    ok(memesNotes(e.notes, R3) && sansTrace(e.nom), 'et jamais de retour arrière');

    e = essai({ ...R3, 'n1.md': 'travail inédit\n' }, '--adopter');
    const adoptee = e.r.code === 0 ? registre(code, e.nom).base : null;
    ok(adoptee?.origine === 'adoption' && e.notes['n1.md'] === 'travail inédit\n',
      '--adopter garde les notes et les enregistre comme base');

    if (process.platform === 'win32') {
      // Deux chemins Git distincts, une seule clé Windows : écrits par la
      // plomberie, sans passer par un disque insensible à la casse.
      const env = { ...process.env, GIT_INDEX_FILE: join(bac, 'index-collision') };
      const blob = execFileSync('git', ['-C', docDir, 'hash-object', '-w', '--stdin'], { input: 'autre\n', encoding: 'utf8' }).trim();
      execFileSync('git', ['-C', docDir, 'read-tree', r3], { env });
      execFileSync('git', ['-C', docDir, 'update-index', '--add', '--cacheinfo', `100644,${blob},${NOTES}/N1.md`], { env });
      const arbre = execFileSync('git', ['-C', docDir, 'write-tree'], { env, encoding: 'utf8' }).trim();
      const collision = execFileSync('git', ['-C', docDir, 'commit-tree', arbre, '-p', r3], {
        input: 'collision\n',
        encoding: 'utf8',
      }).trim();
      e = essai(null, '--base', collision);
      ok(e.r.code !== 0 && /collision de casse/.test(e.r.sortie) && /N1\.md/.test(e.r.sortie) && sansTrace(e.nom),
        'collision de casse dans la base : refus, rien créé');
    } else {
      ignore('collision de casse dans la base', 'propre à Windows');
    }
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

// La garde de `livrer` : la branche documentaire ET son worktree doivent être
// la base synchronisée. Derrière elle, le miroir ne copie que le delta
// légitime base → notes locales.
export function testChantierLivrerGarde() {
  titre('Chantier — livrer : garde sur la base synchronisée, delta légitime');
  if (!gitDisponible('garde de livrer')) return;
  const { bac, docDir, code } = bacChantier('sw-forge-chantier-garde-');
  try {
    commitNotes(docDir, { 'a.md': 'a\n', 'b.md': 'b\n', 'c.md': 'c\n', 'd.md': 'd\n' }, 'r0\n');
    ajouterDistant(bac, docDir);
    ok(chantier(code, 'ouvrir', '--chantier', 'g', '--depot-doc', docDir).code === 0, 'ouvrir');
    const wt = registre(code, 'g').worktreeDoc as string;
    const notes = join(code, NOTES);

    ecrireNotes(notes, { 'a.md': 'a modifiée\n', 'b.md': null, 'e.md': 'e\n' });
    let r = chantier(code, 'livrer', '--chantier', 'g');
    ok(r.code === 0 && JSON.stringify(sousArbre(wt, 'HEAD')) === JSON.stringify(['a.md', 'c.md', 'd.md', 'e.md']),
      'suppression, modification et ajout légitimes passent');

    mkdirSync(join(notes, 'sous'));
    renameSync(join(notes, 'c.md'), join(notes, 'sous', 'c2.md'));
    r = chantier(code, 'livrer', '--chantier', 'g');
    ok(r.code === 0 && sousArbre(wt, 'HEAD').includes('sous/c2.md') && !sousArbre(wt, 'HEAD').includes('c.md'),
      'un renommage passe');

    // Renommage de CASSE seule : sous Windows, `git add -A` ne le verrait pas.
    renameSync(join(notes, 'd.md'), join(notes, 'D.md'));
    r = chantier(code, 'livrer', '--chantier', 'g');
    ok(r.code === 0 && sousArbre(wt, 'HEAD').includes('D.md') && !sousArbre(wt, 'HEAD').includes('d.md'),
      'un renommage de casse est enregistré dans la branche');
    ok(chantier(code, 'verifier', '--chantier', 'g').code === 0, 'et le reçu est valide');

    // Fichier exclu dans le worktree documentaire : invisible à `git status`,
    // mais la copie miroir l'effacerait.
    appendFileSync(join(docDir, '.git', 'info', 'exclude'), `${NOTES}/prive.md\n`);
    writeFileSync(join(wt, NOTES, 'prive.md'), 'jamais livré\n');
    ecrireNotes(notes, { 'a.md': 'a encore\n' });
    ok(git(wt, 'status', '--porcelain') === '', 'le fichier exclu est invisible à git status');
    const teteAvant = git(wt, 'rev-parse', 'HEAD');
    r = chantier(code, 'livrer', '--chantier', 'g');
    ok(r.code !== 0 && /hors de la branche/.test(r.sortie) && /prive\.md/.test(r.sortie), 'livrer refuse, fichier nommé');
    ok(existsSync(join(wt, NOTES, 'prive.md')) && git(wt, 'rev-parse', 'HEAD') === teteAvant, 'rien n’est effacé ni commité');
    r = chantier(code, 'livrer', '--chantier', 'g', '--adopter');
    ok(r.code !== 0 && existsSync(join(wt, NOTES, 'prive.md')), '--adopter ne lève pas ce refus');
    rmSync(join(wt, NOTES, 'prive.md'));
    ok(chantier(code, 'livrer', '--chantier', 'g').code === 0, 'le fichier écarté, livrer passe');

    // Branche en avance sur la base : l'état que laissait l'ANCIEN outil, qui
    // avançait la révision attendue dès la reconnaissance d'une fusion résolue
    // à la main, avant la copie vers le code.
    const codeH = worktreeCode(code, 'h');
    ok(chantier(codeH, 'ouvrir', '--chantier', 'h').code === 0, 'un second chantier');
    ecrireNotes(join(codeH, NOTES), { 'h.md': 'travail de h\n' });
    ok(chantier(codeH, 'livrer', '--chantier', 'h').code === 0 && chantier(codeH, 'integrer', '--chantier', 'h').code === 0,
      'il intègre h.md');
    git(wt, 'merge', '--no-edit', 'main');
    const fusion = git(wt, 'rev-parse', 'HEAD');
    modifierRegistre(code, 'g', (reg) => { reg.revisionDocAttendue = fusion; });
    r = chantier(code, 'livrer', '--chantier', 'g');
    ok(r.code !== 0 && /n’ont pas reçu/.test(r.sortie) && /h\.md/.test(r.sortie) && /rafraichir/.test(r.sortie),
      'livrer refuse une branche en avance sur la base, nomme h.md et la marche à suivre');
    ok(!existsSync(join(notes, 'h.md')) && sousArbre(wt, 'HEAD').includes('h.md'), 'rien n’est effacé');
    r = chantier(code, 'rafraichir', '--chantier', 'g');
    ok(r.code === 0 && lireNotes(notes)['h.md'] === 'travail de h\n', 'rafraichir recopie ce que la branche porte');
    ok(chantier(code, 'livrer', '--chantier', 'g').code === 0 && chantier(code, 'verifier', '--chantier', 'g').code === 0,
      'puis livrer et verifier passent');

    // Notes adoptées : refus, fusion À LA MAIN, puis `livrer --adopter`.
    const codeK = worktreeCode(code, 'k');
    ecrireNotes(join(codeK, NOTES), { 'a.md': 'a\n', 'k.md': 'travail de k\n' });
    ok(chantier(codeK, 'ouvrir', '--chantier', 'k', '--adopter').code === 0, 'k adopte ses notes');
    ok(chantier(codeK, 'livrer', '--chantier', 'k').code !== 0, 'livrer refuse d’abord');
    const wtK = registre(code, 'k').worktreeDoc as string;
    ecrireNotes(join(codeK, NOTES), { ...lireNotes(join(wtK, NOTES)), 'k.md': 'travail de k\n' });
    r = chantier(codeK, 'livrer', '--chantier', 'k', '--adopter');
    ok(r.code === 0 && /Adoption/.test(r.sortie), 'après fusion à la main, livrer --adopter reporte les notes');
    ok(registre(code, 'k').base?.origine === 'livrer' && chantier(codeK, 'verifier', '--chantier', 'k').code === 0,
      'la base redevient un état documentaire, le reçu est valide');
    ok(sousArbre(wtK, 'HEAD').includes('k.md') && sousArbre(wtK, 'HEAD').includes('h.md'), 'rien de la branche n’est perdu');
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

// Chaque coupure mène, au lancement suivant, à l'état attendu : sans faux
// refus, et sans rien reprendre qui ne s'explique pas par la coupure.
export function testChantierReprises() {
  titre('Chantier — reprises vérifiées après une coupure');
  if (!gitDisponible('reprises après coupure')) return;
  const { bac, docDir, code } = bacChantier('sw-forge-chantier-reprises-');
  const arret = (cwd: string, point: string, ...args: string[]) =>
    chantierAvecEnv(cwd, { CHANTIER_ARRET_TEST: point }, ...args);
  try {
    commitNotes(docDir, { 'a.md': 'a\n', 'b.md': 'b\n', 'c.md': 'c\n', 'd.md': 'd\n' }, 'r0\n');
    ajouterDistant(bac, docDir);
    ok(chantier(code, 'ouvrir', '--chantier', 'p', '--depot-doc', docDir).code === 0, 'ouvrir');
    const wt = registre(code, 'p').worktreeDoc as string;
    const notes = join(code, NOTES);
    const identiques = () => memesNotes(lireNotes(join(wt, NOTES)), lireNotes(notes));

    /* ------------------------------------------------ pendant le miroir */
    ecrireNotes(notes, { 'a.md': 'a2\n', 'b.md': null, 'e.md': 'e\n', 'f.md': 'f\n', 'g.md': 'g\n' });
    let r = arret(code, 'pendant-miroir', 'livrer', '--chantier', 'p');
    ok(r.code === 70 && git(wt, 'status', '--porcelain') !== '', 'coupure pendant le miroir : worktree documentaire entamé');
    ok(registre(code, 'p').journal?.operation === 'livrer', 'le journal de la livraison est en place');
    writeFileSync(join(wt, NOTES, 'c.md'), 'intrus\n');
    r = chantier(code, 'livrer', '--chantier', 'p');
    ok(r.code !== 0 && /ne s'explique pas/.test(r.sortie) && /c\.md/.test(r.sortie),
      'un écart étranger à la coupure est refusé, nommé');
    ok(readFileSync(join(wt, NOTES, 'c.md'), 'utf8') === 'intrus\n', 'et rien n’est écrasé');
    git(wt, 'checkout', '--', `${NOTES}/c.md`);
    ecrireNotes(notes, { 'g.md': 'g modifié après la coupure\n' });
    r = chantier(code, 'livrer', '--chantier', 'p');
    ok(r.code === 0 && /[Rr]eprise/.test(r.sortie) && identiques(), 'la reprise refait le miroir depuis les notes ACTUELLES');
    ok(chantier(code, 'verifier', '--chantier', 'p').code === 0, 'reçu valide');

    /* ------------------------- après le commit des notes, avant le registre */
    ecrireNotes(notes, { 'a.md': 'a3\n' });
    r = arret(code, 'apres-commit-notes', 'livrer', '--chantier', 'p');
    ok(r.code === 70, 'coupure après le commit des notes');
    r = chantier(code, 'livrer', '--chantier', 'p');
    const reg = registre(code, 'p');
    ok(r.code === 0 && /[Rr]eprise/.test(r.sortie) && !reg.journal, 'reprise sans faux refus');
    ok(reg.base?.revision === git(wt, 'log', '-1', '--format=%H', '--', NOTES), 'la base avance avec la reprise');

    /* ------------------------ après le commit du reçu : la faiblesse L352 */
    ecrireNotes(notes, { 'a.md': 'a4\n' });
    r = arret(code, 'apres-commit-recu', 'livrer', '--chantier', 'p');
    const pendant = registre(code, 'p');
    ok(r.code === 70 && pendant.revisionDocAttendue !== pendant.journal?.depuis,
      'coupure après le commit du reçu : révision attendue ≠ départ du journal, l’état qui bloquait');
    const teteCoupure = git(wt, 'rev-parse', 'HEAD');
    r = chantier(code, 'livrer', '--chantier', 'p');
    ok(r.code === 0 && /[Rr]eprise/.test(r.sortie) && git(wt, 'rev-parse', 'HEAD') === teteCoupure,
      'reprise, sans nouveau commit');
    ok(chantier(code, 'verifier', '--chantier', 'p').code === 0, 'reçu valide');

    /* ------------------------------ une livraison qui ne change QUE le reçu */
    writeFileSync(join(code, 'x.txt'), 'x2\n');
    commiter(code, 'code seul\n');
    r = arret(code, 'apres-commit-recu', 'livrer', '--chantier', 'p');
    ok(r.code === 70 && registre(code, 'p').journal?.operation === 'livrer',
      'coupure d’une livraison qui ne change que le reçu : journal présent');
    r = chantier(code, 'livrer', '--chantier', 'p');
    ok(r.code === 0 && /[Rr]eprise/.test(r.sortie) && chantier(code, 'verifier', '--chantier', 'p').code === 0,
      'reprise, reçu valide');

    /* -------------------------------------- pendant la copie de rafraichir */
    const codeQ = worktreeCode(code, 'q');
    ok(chantier(codeQ, 'ouvrir', '--chantier', 'q').code === 0, 'un second chantier');
    ecrireNotes(join(codeQ, NOTES), { 'aa.md': 'aa\n', 'zz.md': 'zz\n' });
    ok(chantier(codeQ, 'livrer', '--chantier', 'q').code === 0 && chantier(codeQ, 'integrer', '--chantier', 'q').code === 0,
      'il livre et intègre');
    const attendueAvantRaf = registre(code, 'p').revisionDocAttendue;
    r = arret(code, 'pendant-copie-rafraichir', 'rafraichir', '--chantier', 'p');
    const coupe = registre(code, 'p');
    ok(r.code === 70 && coupe.journal?.operation === 'rafraichir' && coupe.revisionDocAttendue === attendueAvantRaf,
      'coupure pendant la copie de rafraichir : journal en place, rien n’a avancé');
    r = chantier(code, 'livrer', '--chantier', 'p');
    ok(r.code === 0 && /[Rr]eprise d'un rafraîchissement/.test(r.sortie) && 'zz.md' in lireNotes(notes),
      'livrer termine d’abord la copie interrompue, puis livre');
    ok(chantier(code, 'verifier', '--chantier', 'p').code === 0, 'reçu valide');

    /* --------- conflit, résolution à la main, coupure pendant sa copie */
    ecrireNotes(join(codeQ, NOTES), { 'a.md': 'a par q\n' });
    ok(chantier(codeQ, 'livrer', '--chantier', 'q').code === 0 && chantier(codeQ, 'integrer', '--chantier', 'q').code === 0,
      'q modifie a.md et intègre');
    ecrireNotes(notes, { 'a.md': 'a par p\n' });
    ok(chantier(code, 'livrer', '--chantier', 'p').code === 0, 'p modifie le même passage et livre');
    r = chantier(code, 'rafraichir', '--chantier', 'p');
    ok(r.code !== 0 && /CONFLIT/.test(r.sortie), 'rafraichir : conflit');
    try {
      git(wt, 'merge', 'main');
    } catch {
      // Conflit attendu : il se résout à la main.
    }
    writeFileSync(join(wt, NOTES, 'a.md'), 'a résolu\n');
    git(wt, 'add', '-A');
    execFileSync('git', ['-C', wt, 'commit', '--no-edit'], { encoding: 'utf8' });
    const attendueAvantReprise = registre(code, 'p').revisionDocAttendue;
    r = arret(code, 'pendant-copie-rafraichir', 'rafraichir', '--chantier', 'p');
    const pendantFusion = registre(code, 'p');
    ok(r.code === 70 && /Fusion résolue à la main reprise/.test(r.sortie) &&
      pendantFusion.revisionDocAttendue === attendueAvantReprise && pendantFusion.base?.revision !== git(wt, 'rev-parse', 'HEAD'),
      'coupure entre la reconnaissance de la fusion et la fin de sa copie : ni base ni révision attendue n’ont avancé');
    r = chantier(code, 'rafraichir', '--chantier', 'p');
    ok(r.code === 0 && /[Rr]eprise/.test(r.sortie) && lireNotes(notes)['a.md'] === 'a résolu\n',
      'rafraichir relancé termine la copie de la résolution');
    ok(/Déjà à jour/.test(r.sortie), 'puis constate que tout est à jour');
    ok(chantier(code, 'livrer', '--chantier', 'p').code === 0 && chantier(code, 'verifier', '--chantier', 'p').code === 0,
      'et livrer va au bout : conflit → résolution → reprise → livrer');

    /* -------------------------------------------- pendant la copie d'ouvrir */
    const codeZ = worktreeCode(code, 'z');
    ecrireNotes(join(codeZ, NOTES), { 'a.md': 'a\n', 'b.md': 'b\n', 'c.md': 'c\n', 'd.md': 'd\n' });
    r = arret(codeZ, 'pendant-copie-ouvrir', 'ouvrir', '--chantier', 'z');
    ok(r.code === 70 && registre(code, 'z').journal?.operation === 'ouvrir', 'coupure pendant la copie d’ouvrir : journal en place');
    r = chantier(codeZ, 'ouvrir', '--chantier', 'z');
    const wtZ = registre(code, 'z').worktreeDoc as string;
    ok(r.code === 0 && /[Rr]eprise/.test(r.sortie) && memesNotes(lireNotes(join(codeZ, NOTES)), lireNotes(join(wtZ, NOTES))),
      'relancer ouvrir termine la copie');
    ok(chantier(codeZ, 'livrer', '--chantier', 'z').code === 0, 'et le chantier livre');
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

// Registres ouverts avant le lot O : aucune base enregistrée. Elle se
// reconstruit depuis le plus récent du dernier reçu et du dernier
// rafraîchissement ; sans l'un ni l'autre, `livrer` refuse par défaut.
// ⚠️ Le registre « ancien » s'obtient en retirant le champ `base` : c'est
// exactement la différence de format entre l'ancien outil et le nouveau.
export function testChantierMigration() {
  titre('Chantier — migration des chantiers ouverts sans base');
  if (!gitDisponible('migration sans base')) return;
  const { bac, docDir, code } = bacChantier('sw-forge-chantier-migration-');
  const sansBase = (nom: string) => modifierRegistre(code, nom, (reg) => { delete reg.base; });
  try {
    commitNotes(docDir, { 'a.md': 'a\n', 'b.md': 'b\n' }, 'r0\n');
    ajouterDistant(bac, docDir);
    const notes = join(code, NOTES);

    /* ----------------------------------------------------------- reçu seul */
    ok(chantier(code, 'ouvrir', '--chantier', 'm1', '--depot-doc', docDir).code === 0, 'ouvrir');
    ecrireNotes(notes, { 'a.md': 'a1\n' });
    ok(chantier(code, 'livrer', '--chantier', 'm1').code === 0, 'livrer');
    const commitDoc = registre(code, 'm1').dernierRecu.commitDoc as string;
    sansBase('m1');
    let r = chantier(code, 'verifier', '--chantier', 'm1');
    ok(r.code === 0 && /reconstruite/.test(r.sortie) && /migration \(reçu\)/.test(r.sortie),
      'verifier affiche la base reconstruite depuis le reçu');
    // Une avance locale jamais livrée : la garde la laisse passer.
    ecrireNotes(notes, { 'b.md': 'b1\n' });
    const texteAvant = readFileSync(cheminRegistre(code, 'm1'), 'utf8');
    const wt1 = registre(code, 'm1').worktreeDoc as string;
    const teteAvant = git(wt1, 'rev-parse', 'HEAD');
    r = chantier(code, 'livrer', '--chantier', 'm1', '--simulation');
    ok(r.code === 0 && /passerait/.test(r.sortie) && r.sortie.includes(`migration (reçu) @ ${commitDoc.slice(0, 7)}`) &&
      /~1/.test(r.sortie), 'simulation : base reconstruite du reçu, garde passerait, une note à reporter');
    ok(readFileSync(cheminRegistre(code, 'm1'), 'utf8') === texteAvant && git(wt1, 'rev-parse', 'HEAD') === teteAvant &&
      git(wt1, 'status', '--porcelain') === '', 'et la simulation n’a rien écrit');
    r = chantier(code, 'livrer', '--chantier', 'm1');
    ok(r.code === 0 && registre(code, 'm1').base?.origine === 'livrer', 'livrer passe et enregistre la base');
    ok(chantier(code, 'integrer', '--chantier', 'm1').code === 0, 'intégré');

    /* ---------------------------------- rafraîchissement plus récent que le reçu */
    const code2 = worktreeCode(code, 'm2');
    ok(chantier(code2, 'ouvrir', '--chantier', 'm2').code === 0 && chantier(code2, 'livrer', '--chantier', 'm2').code === 0,
      'un second chantier s’ouvre et livre');
    ecrireNotes(notes, { 'c.md': 'c\n' });
    ok(chantier(code, 'livrer', '--chantier', 'm1').code === 0 && chantier(code, 'integrer', '--chantier', 'm1').code === 0,
      'le premier intègre encore');
    ok(chantier(code2, 'rafraichir', '--chantier', 'm2').code === 0, 'le second se rafraîchit');
    const apres = registre(code, 'm2').dernierRafraichissement.apres as string;
    sansBase('m2');
    r = chantier(code2, 'livrer', '--chantier', 'm2', '--simulation');
    ok(r.code === 0 && r.sortie.includes(`migration (rafraîchissement) @ ${apres.slice(0, 7)}`),
      'le rafraîchissement, plus récent que le reçu, fait la base');
    ok(chantier(code2, 'livrer', '--chantier', 'm2').code === 0, 'livrer passe');

    /* ------------------------------------------- ni reçu ni rafraîchissement */
    const code3 = worktreeCode(code, 'm3');
    ok(chantier(code3, 'ouvrir', '--chantier', 'm3').code === 0, 'un chantier jamais livré');
    sansBase('m3');
    r = chantier(code3, 'livrer', '--chantier', 'm3');
    ok(r.code !== 0 && /aucune base synchronisée/.test(r.sortie), 'sans reçu ni rafraîchissement : livrer refuse par défaut');
    r = chantier(code3, 'livrer', '--chantier', 'm3', '--adopter');
    ok(r.code === 0 && registre(code, 'm3').base?.origine === 'livrer' && chantier(code3, 'verifier', '--chantier', 'm3').code === 0,
      '--adopter enregistre l’état local courant et livre');
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}
