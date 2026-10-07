// Le hook `.claude/hooks/refuse-commit-m.mjs` (CLAUDE.md, « Jamais de code
// entre guillemets doubles dans une commande shell ») : il refuse
// `git commit`, `git merge` et `git tag` avec un message en ligne (forme
// collée `-m"…"` comprise) et, en position de commande, `node -e`/`--eval`/
// `-p`/`--print` dont l'argument est une chaîne entre guillemets doubles
// contenant un backtick, un `$` ou une barre oblique inverse. Tout le reste
// passe — en particulier le
// texte cité par `grep`/`echo`, le corps d'un heredoc et un commentaire bash.
//
// Le hook est lancé tel que Claude Code le lance : un processus `node`, le JSON
// de l'outil sur stdin, sortie 2 = refus, toute autre sortie = passage. Les
// formes sûres qu'il propose, et la lecture des grappes d'options, sont
// confrontées à un vrai Git dans un dépôt jetable.

import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { egal, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(RACINE, '.claude', 'hooks', 'refuse-commit-m.mjs');

function lancer(charge: string) {
  return spawnSync(process.execPath, [HOOK], { input: charge, encoding: 'utf8' });
}
const sortie = (charge: string): number | null => lancer(charge).status;
const bash = (command: string) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

/**
 * Ce que fait un vrai Git des formes que le hook refuse ou propose : dépôt
 * jetable sous le dossier temporaire du système, configuration globale et
 * système neutralisées (aucun hook ni réglage de la machine).
 */
function confronterAGit(): void {
  const bac = mkdtempSync(join(tmpdir(), 'swblacksmith-hook-commit-m-'));
  const depot = join(bac, 'depot');
  const configVide = join(bac, 'vide.gitconfig');
  writeFileSync(configVide, '');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: configVide,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@test',
    GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@test',
    GIT_EDITOR: 'false',
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C', // messages de git en anglais : les erreurs sont comparées au texte
  };
  for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[v];
  const git = (args: string[], entree = '') => {
    const r = spawnSync('git', args, { cwd: depot, env, input: entree, encoding: 'utf8' });
    return { code: r.status, sortie: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
  };
  const dernierMessage = () => git(['log', '-1', '--format=%B']).sortie;
  const messageEtiquette = (nom: string) => git(['tag', '-l', '--format=%(contents)', nom]).sortie;
  try {
    const init = spawnSync('git', ['init', '-q', '-b', 'tronc', depot], { env, encoding: 'utf8' });
    if (init.status !== 0) {
      ok(false, `git init impossible : ${init.error?.message ?? init.stderr}`);
      return;
    }
    writeFileSync(join(depot, 'a'), '1');
    git(['add', 'a']);

    // --- formes sûres proposées par le refus ------------------------------
    egal(git(['commit', '-q', '-F', '-'], 'par-entree-standard\n').code, 0, 'git : commit -F - réussit');
    egal(dernierMessage(), 'par-entree-standard', 'git : commit -F - lit l’entrée standard');
    egal(git(['tag', '-a', 'v1', '-F', '-'], 'etiquette-entree-standard\n').code, 0, 'git : tag -a -F - réussit');
    egal(messageEtiquette('v1'), 'etiquette-entree-standard', 'git : tag -F - lit l’entrée standard');

    // Branches divergentes : une fusion crée un commit (pas d'avance rapide).
    git(['switch', '-q', '-c', 'b1']);
    writeFileSync(join(depot, 'b'), '1');
    git(['add', 'b']);
    git(['commit', '-q', '-F', '-'], 'b1\n');
    git(['switch', '-q', 'tronc']);
    writeFileSync(join(depot, 'c'), '1');
    git(['add', 'c']);
    git(['commit', '-q', '-F', '-'], 'c\n');
    const base = git(['rev-parse', 'HEAD']).sortie;
    const fusion = (args: string[], entree = '') => {
      const r = git(['merge', ...args, 'b1'], entree);
      const message = dernierMessage();
      git(['merge', '--abort']);
      git(['reset', '-q', '--hard', base]);
      return { ...r, message };
    };

    const parStdin = fusion(['-F', '-'], 'fusion-entree-standard\n');
    ok(parStdin.code !== 0 && /could not read file '-'/.test(parStdin.sortie),
      `git : merge -F - ne lit pas l’entrée standard (code ${parStdin.code} : ${parStdin.sortie.replace(/\s+/g, ' ').slice(0, 80)})`);
    egal(parStdin.message, 'c', 'git : merge -F - ne crée aucun commit');
    const sansEdition = fusion(['--no-edit']);
    egal(sansEdition.code, 0, 'git : merge --no-edit réussit');
    egal(sansEdition.message, "Merge branch 'b1' into tronc", 'git : merge --no-edit prend le message par défaut');
    const fichierFusion = join(bac, 'fusion.txt');
    writeFileSync(fichierFusion, 'fusion-par-fichier\n');
    egal(fusion(['-F', fichierFusion]).message, 'fusion-par-fichier', 'git : merge -F <fichier> lit le fichier');

    // --- verdict du hook = lecture de git, jeton par jeton ----------------
    // `message` : le texte que git retient quand la grappe porte un message
    // (le hook refuse) ; une expression régulière quand une option à valeur
    // prend le reste du jeton : ce que git en fait à la place (le hook passe).
    writeFileSync(join(depot, 'msg.txt'), 'depuis-msg-txt\n');
    const cas: { nom: string; args: string[]; lancer: () => string; message: string | RegExp }[] = [
      { nom: 'commit -mtexte', args: ['commit', '--allow-empty', '-mcolle-commit'], message: 'colle-commit',
        lancer: () => (git(['commit', '-q', '--allow-empty', '-mcolle-commit']), dernierMessage()) },
      { nom: 'commit -amtexte', args: ['commit', '--allow-empty', '-amgrappe-commit'], message: 'grappe-commit',
        lancer: () => (git(['commit', '-q', '--allow-empty', '-amgrappe-commit']), dernierMessage()) },
      { nom: 'commit -Fmsg.txt', args: ['commit', '--allow-empty', '-Fmsg.txt'], message: /^depuis-msg-txt$/,
        lancer: () => (git(['commit', '-q', '--allow-empty', '-Fmsg.txt']), dernierMessage()) },
      { nom: 'tag -mtexte', args: ['tag', '-a', 'v2', '-mcolle-tag'], message: 'colle-tag',
        lancer: () => (git(['tag', '-a', 'v2', '-mcolle-tag']), messageEtiquette('v2')) },
      { nom: 'tag -amtexte', args: ['tag', '-amgrappe-tag', 'v3'], message: 'grappe-tag',
        lancer: () => (git(['tag', '-amgrappe-tag', 'v3']), messageEtiquette('v3')) },
      { nom: 'merge -mtexte', args: ['merge', '-mcolle-merge', 'b1'], message: 'colle-merge',
        lancer: () => fusion(['-mcolle-merge']).message },
      { nom: 'merge -nmtexte', args: ['merge', '-nmgrappe-merge', 'b1'], message: 'grappe-merge',
        lancer: () => fusion(['-nmgrappe-merge']).message },
      { nom: 'merge -smxyz', args: ['merge', '-smxyz', 'b1'], message: /strategy 'mxyz'/,
        lancer: () => fusion(['-smxyz']).sortie },
    ];
    for (const c of cas) {
      const lu = c.lancer();
      if (typeof c.message === 'string') {
        egal(lu, c.message, `git : ${c.nom} porte un message`);
        egal(sortie(bash(`git ${c.args.join(' ')}`)), 2, `hook = git : ${c.nom} refusé`);
      } else {
        ok(c.message.test(lu), `git : ${c.nom} n’est pas un message (${lu.replace(/\s+/g, ' ').slice(0, 60)})`);
        egal(sortie(bash(`git ${c.args.join(' ')}`)), 0, `hook = git : ${c.nom} passe`);
      }
    }

    // --- options globales à valeur séparée --------------------------------
    // Celles de `git -h` (git 2.55) plus `--attr-source`, que git accepte
    // aussi sous cette forme.
    const globales: [string, string][] = [
      ['--git-dir', '.git'], ['--work-tree', '.'], ['--namespace', 'ns'],
      ['--config-env', 'user.name=HOME'], ['--attr-source', 'HEAD'],
    ];
    for (const [option, valeur] of globales) {
      const texte = `globale${option.replace(/-/g, '')}`;
      git([option, valeur, 'commit', '-q', '--allow-empty', '-m', texte]);
      egal(dernierMessage(), texte, `git : ${option} <valeur> commit -m porte le message`);
      egal(sortie(bash(`git ${option} ${valeur} commit -m ${texte}`)), 2, `hook = git : ${option} <valeur> commit -m refusé`);
    }
    const cheminExec = git(['--exec-path', 'x', 'commit', '-q', '--allow-empty', '-m', 'exec-path']);
    ok(dernierMessage() !== 'exec-path' && /git-core/.test(cheminExec.sortie),
      'git : --exec-path ne prend pas le jeton suivant (affiche son chemin, aucun commit)');
    egal(sortie(bash(`git --exec-path x commit -m exec-path`)), 0, 'hook = git : --exec-path x commit -m passe');
    ok(git(['--git-d', '.git', 'status']).code !== 0, 'git : une option globale ne s’abrège pas (--git-d refusée)');

    // --- abréviations de --message, commande par commande -----------------
    // Chaque préfixe de `message`, forme `=` ; forme séparée pour `--mes`.
    // Le hook refuse exactement ce que git retient comme message.
    const acceptees: Record<string, string[]> = { commit: [], merge: [], tag: [] };
    let numero = 0;
    for (const nom of ['commit', 'merge', 'tag']) {
      for (let l = 1; l <= 'message'.length; l++) {
        const p = 'message'.slice(0, l);
        for (const separee of l === 3 ? [false, true] : [false]) {
          const texte = `abr-${nom}-${p}${separee ? '-sep' : ''}`;
          const option = separee ? [`--${p}`, texte] : [`--${p}=${texte}`];
          let args: string[];
          let lu: string;
          if (nom === 'commit') {
            args = ['commit', '--allow-empty', ...option];
            git(['commit', '-q', '--allow-empty', ...option]);
            lu = dernierMessage();
          } else if (nom === 'merge') {
            args = ['merge', ...option, 'b1'];
            lu = fusion(option).message;
          } else {
            const etiquette = `abr${++numero}`;
            args = ['tag', '-a', etiquette, ...option];
            git(args);
            lu = messageEtiquette(etiquette);
          }
          const retenu = lu === texte;
          if (retenu && !separee) acceptees[nom].push(p);
          egal(sortie(bash(`git ${args.join(' ')}`)), retenu ? 2 : 0,
            `hook = git : ${nom} --${p}${separee ? ' <texte>' : '=<texte>'} ${retenu ? 'refusé' : 'passe'}`);
        }
      }
    }
    egal(acceptees, {
      commit: ['m', 'me', 'mes', 'mess', 'messa', 'messag', 'message'],
      merge: ['m', 'me', 'mes', 'mess', 'messa', 'messag', 'message'],
      tag: ['mes', 'mess', 'messa', 'messag', 'message'],
    }, 'git : abréviations de --message acceptées (tag : --m et --me ambiguës avec --merged)');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}

export default function testHookRefuseCommitM(): void {
  titre('Hook refuse-commit-m : message en ligne de git commit/merge/tag et node -e "…" à backtick, $ ou barre oblique inverse refusés, le reste passe');

  // --- git commit -m : comportement inchangé -------------------------------
  const commitsRefuses: [string, string][] = [
    ['-m simple', `git commit -m "titre"`],
    ['--amend -m', `git commit --amend -m "titre"`],
    ['git -C . commit -m', `git -C . commit -m "titre"`],
    ['git -c clé=valeur commit -m', `git -c user.name=x commit -m "titre"`],
    ['grappe -am', `git commit -am "titre"`],
    ['--message=', `git commit --message="titre"`],
    ['--message séparé', `git commit --message "titre"`],
    ['derrière cd &&', `cd /c/x && git commit -m "titre"`],
    ['variable d’environnement en tête', `GIT_AUTHOR_NAME=x git commit -m "titre"`],
    ['forme collée -m"…"', `git commit -m"titre"`],
    ['forme collée -m\'…\'', `git commit -m'titre'`],
    ['forme collée -mtexte', `git commit -mtitre`],
    ['grappe collée -am"…"', `git commit -am"titre"`],
    ['# collé à un mot (a#b), commit après', `echo a#b ; git commit -m "titre"`],
    ['# entre guillemets, commit après', `echo "# x" ; git commit -m "titre"`],
    ['commentaire en ligne 1, commit en ligne 2', `echo ok # x\ngit commit -m "titre"`],
    // Prouvé par git : le lexeur de `node -e` ne lit pas `$'…'` (limite antérieure).
    ['# dans $\'…\' (\\\' ne la ferme pas), commit après', `echo $'a\\'b # c' ; git commit -m "titre"`],
  ];
  for (const [nom, commande] of commitsRefuses) {
    egal(sortie(bash(commande)), 2, `git, refusé : ${nom}`);
  }

  const commitsPassent: [string, string][] = [
    ['heredoc qui parle de -m', `git commit -F - <<'FIN'\ntitre\n\nun message passe par un heredoc, jamais par -m\nFIN`],
    ['--allow-empty-message', `git commit --allow-empty-message -F message.txt`],
    ['-F fichier', `git commit -F C:/scratch/message.txt`],
    ['-F collé à un fichier en m', `git commit -Fmessage.txt`],
    ['--amend --no-edit', `git commit --amend --no-edit`],
    ['grep qui cite la forme', `grep -rn "git commit -m" spec/`],
    ['git log -m', `git log -m --oneline`],
    ['commentaire qui cite git commit -m', `echo ok # exemple ; git commit -m "titre"`],
  ];
  for (const [nom, commande] of commitsPassent) {
    egal(sortie(bash(commande)), 0, `git, passe : ${nom}`);
  }

  // --- git merge et git tag : même règle -----------------------------------
  const mergeTagRefuses: [string, string][] = [
    ['merge -m', `git merge -m "fusion" forge/x`],
    ['merge --no-ff -m', `git merge --no-ff -m "fusion" forge/x`],
    ['merge --message=', `git merge --message="fusion" forge/x`],
    ['merge --message séparé', `git merge --message "fusion" forge/x`],
    ['merge grappe -nm', `git merge -nm "fusion" forge/x`],
    ['merge forme collée -m"…"', `git merge -m"fusion" forge/x`],
    ['merge forme collée -mtexte', `git merge -mfusion forge/x`],
    ['git -C . merge -m', `git -C . merge -m "fusion" forge/x`],
    ['git -c clé=valeur merge -m', `git -c user.name=x merge -m "fusion" forge/x`],
    ['merge, variable d’environnement en tête', `GIT_AUTHOR_NAME=x git merge -m "fusion" forge/x`],
    ['merge derrière cd &&', `cd /c/x && git merge -m "fusion" forge/x`],
    ['tag -a -m', `git tag -a v1 -m "version"`],
    ['tag grappe -am', `git tag -am "version" v1`],
    ['tag grappe -sm', `git tag -sm "version" v1`],
    ['tag --message=', `git tag -a v1 --message="version"`],
    ['tag --message séparé', `git tag -a v1 --message "version"`],
    ['tag forme collée -m\'…\'', `git tag -a v1 -m'version'`],
    ['tag forme collée -mtexte', `git tag -a v1 -mversion`],
    ['git -C . tag -m', `git -C . tag -a v1 -m "version"`],
    ['git --git-dir <d> commit -m', `git --git-dir .git commit -m "titre"`],
    ['git --work-tree <d> merge -m', `git --work-tree . merge -m "fusion" forge/x`],
    ['git --namespace <n> tag -m', `git --namespace ns tag -a v1 -m "version"`],
    ['git --config-env <n>=<v> commit -m', `git --config-env user.name=HOME commit -m "titre"`],
    ['git --attr-source <t> merge -m', `git --attr-source HEAD merge -m "fusion" forge/x`],
    ['commit --m=', `git commit --m="titre"`],
    ['commit --mes séparé', `git commit --mes "titre"`],
    ['merge --me séparé', `git merge --me "fusion" forge/x`],
    ['merge --mess=', `git merge --mess="fusion" forge/x`],
    ['tag --mes séparé', `git tag -a v1 --mes "version"`],
    ['tag --messag=', `git tag -a v1 --messag="version"`],
  ];
  for (const [nom, commande] of mergeTagRefuses) {
    egal(sortie(bash(commande)), 2, `git, refusé : ${nom}`);
  }

  const mergeTagPassent: [string, string][] = [
    ['merge --no-edit', `git merge --no-edit forge/x`],
    ['merge -F fichier', `git merge -F C:/scratch/fusion.txt forge/x`],
    ['merge --no-ff --no-edit', `git merge --no-ff --no-edit forge/x`],
    ['merge --abort', `git merge --abort`],
    ['merge stratégie collée en m', `git merge -smxyz forge/x`],
    ['tag heredoc qui parle de -m', `git tag -a v1 -F - <<'FIN'\nversion\n\njamais git tag -m\nFIN`],
    ['tag -l', `git tag -l`],
    ['tag --merged', `git tag --merged main`],
    ['tag --m= (ambiguë, git la refuse)', `git tag -a v1 --m="version"`],
    ['tag --me séparé (ambiguë, git la refuse)', `git tag -a v1 --me "version"`],
    ['--exec-path ne prend pas le jeton suivant', `git --exec-path x commit -m "titre"`],
    ['tag -n5', `git tag -n5`],
    ['tag -u collé à une clé en m', `git tag -umacle -F C:/scratch/tag.txt v1`],
    ['grep qui cite merge -m', `grep -rn "git merge -m" spec/`],
    ['grep qui cite tag -m', `grep -rn 'git tag -m' spec/`],
  ];
  for (const [nom, commande] of mergeTagPassent) {
    egal(sortie(bash(commande)), 0, `git, passe : ${nom}`);
  }

  // --- node -e "…" ---------------------------------------------------------
  const nodeRefuses: [string, string][] = [
    ['-e avec backtick', `node -e "console.log(\`x\`)"`],
    ['-e avec $', `node -e "console.log($HOME)"`],
    ['--eval', `node --eval "console.log(\`x\`)"`],
    ['--eval=', `node --eval="console.log($x)"`],
    ['-p', `node -p "\`x\`"`],
    ['--print', `node --print "$x"`],
    ['grappe -pe', `node -pe "$x"`],
    ['node.exe', `node.exe -e "$x"`],
    ['chemin cité vers node', `"/c/Program Files/nodejs/node" -e "$x"`],
    ['option de node avant -e', `node --input-type=module -e "$x"`],
    ['variable d’environnement en tête', `NODE_OPTIONS=x node -e "$x"`],
    ['derrière cd &&', `cd /c/x && node -e "$x"`],
    ['derrière un tube', `cat f | node -e "\`x\`"`],
    ['dans $(…)', `y=$(node -e "$x")`],
    ['; dans la chaîne, backtick après', `node -e "const a = 1; console.log(\`x\`)"`],
    ['| et && dans la chaîne, $ après', `node -e "a | b && c; d($x)"`],
    ['chaîne sur plusieurs lignes', `node -e "\nconst a = 1;\nconsole.log(\`x\`);\n"`],
    ['\\$ échappé (règle mécanique)', `node -e "console.log(\\$x)"`],
    // Barre oblique inverse : bash réduit `\\`, `\"`, `\$` et `` \` `` sans
    // rien dire. Règle mécanique comme pour `$` : toute barre oblique inverse
    // dans la chaîne, sans examiner ce qui la suit.
    ['-e avec \\\\ (bash le réduit à \\)', `node -e "a\\\\nb"`],
    ['-p avec \\\\', `node -p "x\\\\y"`],
    ['--eval= avec \\\\', `node --eval="\\\\d"`],
    ['-e avec \\" échappé', `node -e "console.log(\\"x\\")"`],
    ['-e avec \\n seul (règle mécanique)', `node -e "a\\nb"`],
    // `#` qui n'ouvre PAS de commentaire : collé à un mot, entre guillemets.
    ['# collé à un mot (a#b), node après', `echo a#b ; node -e "$y"`],
    ['# entre apostrophes, node après', `echo '# x' ; node -e "$y"`],
    ['# entre guillemets doubles, node après', `echo "# x" ; node -e "$y"`],
    ['\\" ne ferme pas la chaîne double : le # qui suit y reste', `echo "a\\" # x" ; node -e "$y"`],
    ['# dans la chaîne de node', `node -e "a #b $x"`],
    ['# en tête de ligne dans une chaîne sur plusieurs lignes', `node -e "\n# x\nconsole.log($y)\n"`],
    // Le commentaire s'arrête à la fin de sa ligne.
    ['commentaire en ligne 1, node en ligne 2', `# commentaire\nnode -e "$x"`],
    ['<<FIN dans un commentaire n’ouvre pas de heredoc', `echo x # voir <<FIN\nnode -e "$y"`],
    ['apostrophe dans un commentaire n’ouvre pas de chaîne', `echo ok # l'apostrophe\nnode -e "$y"`],
    ['# après une continuation, collé au mot', `echo a\\\n#b ; node -e "$y"`],
  ];
  for (const [nom, commande] of nodeRefuses) {
    egal(sortie(bash(commande)), 2, `node, refusé : ${nom}`);
  }

  const nodePassent: [string, string][] = [
    ['argument entre apostrophes', `node -e 'console.log(\`x\`, $y)'`],
    ['chaîne sans backtick ni $', `node -e "console.log(1 + 1)"`],
    ['script lancé par son chemin', `node C:/scratch/diag.mjs`],
    ['-e passé au script, pas à node', `node scripts/x.mjs -e "$y"`],
    ['run.mjs', `node tests/run.mjs hookrefusecommitm`],
    ['grep qui cite la forme', `grep -rn 'node -e "\`' spec/`],
    ['grep dont le motif contient ; avant node -e', `grep 'x; node -e "$y"' fichier.md`],
    ['echo qui cite la forme', `echo "node -e \\"\\$x\\""`],
    ['heredoc de commit qui en parle', `git commit -F - <<'FIN'\ntitre\n\nnode -e "\`x\`" est refusé\nFIN`],
    ['heredoc vers un fichier', `cat <<'EOF' > diag.mjs\nnode -e "$x"\nEOF`],
    ['nodemon n’est pas node', `nodemon -e "$x"`],
    ['\\\\ entre apostrophes', `node -e 'a\\\\b'`],
    ['\\\\ dans le chemin cité de node, pas dans la chaîne', `"C:\\Program Files\\nodejs\\node.exe" -e "console.log(1)"`],
    ['\\\\ dans un -e passé au script', `node scripts/x.mjs -e "a\\\\b"`],
    // `#` en début de mot, hors guillemets et hors heredoc : commentaire
    // jusqu'à la fin de la ligne, jamais analysé (bash ne l'exécute pas).
    ['commentaire après echo', `echo ok # exemple ; node -e "$x"`],
    ['commentaire collé à ;', `echo ok;#x ; node -e "$y"`],
    ['commentaire en début de commande', `# node -e "$x"`],
    ['commentaire sur la ligne d’ouverture d’un heredoc', `cat <<'EOF' > diag.mjs # node -e "$x"\nnode -e "$y"\nEOF`],
  ];
  for (const [nom, commande] of nodePassent) {
    egal(sortie(bash(commande)), 0, `node, passe : ${nom}`);
  }

  // --- message, autres outils, entrée illisible ----------------------------
  const refus = lancer(bash(`node -e "$x"`));
  ok(/scratchpad/.test(refus.stderr ?? ''), 'le refus de node -e renvoie au fichier du scratchpad');
  ok(/par son chemin/.test(refus.stderr ?? ''), 'le refus de node -e dit de lancer le script par son chemin');
  const refusBarre = lancer(bash(`node -e "a\\\\nb"`)).stderr ?? '';
  ok(/barre oblique inverse/.test(refusBarre), 'le refus de node -e "…\\\\…" nomme la barre oblique inverse');
  ok(/scratchpad/.test(refusBarre) && /par son chemin/.test(refusBarre),
    'le refus de node -e "…\\\\…" donne la même forme sûre (fichier du scratchpad lancé par son chemin)');
  const refusCommit = lancer(bash(`git commit -m "x"`));
  ok(/<<'FIN'/.test(refusCommit.stderr ?? ''), 'le refus de git commit -m donne toujours le heredoc');
  const refusTag = lancer(bash(`git tag -a v1 -m "x"`)).stderr ?? '';
  ok(/git tag -m/.test(refusTag), 'le refus de git tag -m nomme git tag');
  ok(/git tag -a <nom> -F - <<'FIN'/.test(refusTag), 'le refus de git tag -m donne git tag -F - en heredoc');
  const refusMerge = lancer(bash(`git merge -m "x" forge/x`)).stderr ?? '';
  ok(/git merge -m/.test(refusMerge), 'le refus de git merge -m nomme git merge');
  ok(/git merge --no-edit <branche>/.test(refusMerge), 'le refus de git merge -m propose --no-edit');
  ok(/git merge -F <fichier> <branche>/.test(refusMerge) && /outil Write/.test(refusMerge),
    'le refus de git merge -m propose -F <fichier> écrit par l’outil Write');
  ok(!/<<'FIN'/.test(refusMerge) && !/-F - </.test(refusMerge), 'le refus de git merge -m ne propose aucun heredoc');

  confronterAGit();

  egal(sortie(JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: `node -e "$x"` } })), 0,
    'PowerShell : hors périmètre, passe');
  egal(sortie(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'node -e "$x"' } })), 0, 'autre outil : passe');
  egal(sortie('pas du JSON'), 0, 'entrée illisible : passe (le hook ne bloque pas sur son propre défaut)');
}
