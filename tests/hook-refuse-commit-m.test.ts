// Le hook `.claude/hooks/refuse-commit-m.mjs` (CLAUDE.md, « Jamais de code
// entre guillemets doubles dans une commande shell ») : il refuse
// `git commit -m` et, en position de commande, `node -e`/`--eval`/`-p`/
// `--print` dont l'argument est une chaîne entre guillemets doubles contenant
// un backtick ou un `$`. Tout le reste passe — en particulier le texte cité
// par `grep`/`echo` et le corps d'un heredoc.
//
// Le hook est lancé tel que Claude Code le lance : un processus `node`, le JSON
// de l'outil sur stdin, sortie 2 = refus, toute autre sortie = passage.

import { spawnSync } from 'child_process';
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

export default function testHookRefuseCommitM(): void {
  titre('Hook refuse-commit-m : git commit -m et node -e "…" à backtick ou $ refusés, le reste passe');

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
  ];
  for (const [nom, commande] of commitsRefuses) {
    egal(sortie(bash(commande)), 2, `git, refusé : ${nom}`);
  }

  const commitsPassent: [string, string][] = [
    ['heredoc qui parle de -m', `git commit -F - <<'FIN'\ntitre\n\nun message passe par un heredoc, jamais par -m\nFIN`],
    ['--allow-empty-message', `git commit --allow-empty-message -F message.txt`],
    ['-F fichier', `git commit -F C:/scratch/message.txt`],
    ['grep qui cite la forme', `grep -rn "git commit -m" spec/`],
    ['git log -m', `git log -m --oneline`],
  ];
  for (const [nom, commande] of commitsPassent) {
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
  ];
  for (const [nom, commande] of nodePassent) {
    egal(sortie(bash(commande)), 0, `node, passe : ${nom}`);
  }

  // --- message, autres outils, entrée illisible ----------------------------
  const refus = lancer(bash(`node -e "$x"`));
  ok(/scratchpad/.test(refus.stderr ?? ''), 'le refus de node -e renvoie au fichier du scratchpad');
  ok(/par son chemin/.test(refus.stderr ?? ''), 'le refus de node -e dit de lancer le script par son chemin');
  const refusCommit = lancer(bash(`git commit -m "x"`));
  ok(/<<'FIN'/.test(refusCommit.stderr ?? ''), 'le refus de git commit -m donne toujours le heredoc');

  egal(sortie(JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: `node -e "$x"` } })), 0,
    'PowerShell : hors périmètre, passe');
  egal(sortie(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'node -e "$x"' } })), 0, 'autre outil : passe');
  egal(sortie('pas du JSON'), 0, 'entrée illisible : passe (le hook ne bloque pas sur son propre défaut)');
}
