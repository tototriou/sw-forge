// Le hook `.claude/hooks/refuse-sed-i.mjs` : il refuse `sed` lancé avec une option
// en place dans les outils Bash et PowerShell, et laisse passer tout le reste —
// en particulier le texte « sed -i » cité dans un `grep`, un `echo` ou le corps
// d'un message de commit en heredoc.
//
// Le hook est lancé tel que Claude Code le lance : un processus `node`, le JSON
// de l'outil sur stdin, sortie 2 = refus, toute autre sortie = passage.

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { egal, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(RACINE, '.claude', 'hooks', 'refuse-sed-i.mjs');

function sortie(charge: string): number | null {
  return spawnSync(process.execPath, [HOOK], { input: charge, encoding: 'utf8' }).status;
}
const bash = (command: string) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
const powershell = (command: string) => JSON.stringify({ tool_name: 'PowerShell', tool_input: { command } });

export default function testHookRefuseSedI(): void {
  titre('Hook refuse-sed-i : sed en place refusé dans Bash et PowerShell, le reste passe');

  const refuses: [string, string][] = [
    ['-i simple', `sed -i 's/a/b/' fichier.ts`],
    ['-i avec suffixe', `sed -i.bak 's/a/b/' fichier.ts`],
    ['--in-place', `sed --in-place 's/a/b/' fichier.ts`],
    ['grappe -Ei', `sed -Ei 's/a+/b/' fichier.ts`],
    ['-ie (suffixe e)', `sed -ie 's/a/b/' fichier.ts`],
    ['chemin du sed de Git', `/usr/bin/sed -i 's/a/b/' fichier.ts`],
    ['derrière cd &&', `cd /c/x && sed -i 's/a/b/' fichier.ts`],
    ['derrière find -exec', `find . -name '*.ts' -exec sed -i 's/a/b/' {} \\;`],
    ['derrière xargs', `ls *.ts | xargs sed -i 's/a/b/'`],
    ['option après le script', `sed 's/a/b/' -i fichier.ts`],
  ];
  for (const [nom, commande] of refuses) {
    egal(sortie(bash(commande)), 2, `Bash, refusé : ${nom}`);
  }
  egal(sortie(powershell(`sed -i 's/a/b/' fichier.ts`)), 2, 'PowerShell, refusé : -i simple');
  egal(sortie(powershell(`& 'C:\\Program Files\\Git\\usr\\bin\\sed.exe' -i 's/a/b/' f`)), 2,
    'PowerShell, refusé : chemin cité lancé par &');
  egal(sortie(bash(`xargs -0 sed -i 's/a/b/' < liste`)), 2, 'Bash, refusé : xargs avec ses options');

  const passent: [string, string][] = [
    ['sed sans -i', `sed -n '1,5p' fichier.ts`],
    ['sed -e', `sed -e 's/i/x/' fichier.ts > sortie.txt`],
    ['grep du texte « sed -i »', `grep -rn "sed -i" spec/`],
    ['echo cité', `echo 'sed -i est interdit'`],
    ['heredoc de commit qui en parle', `git commit -F - <<'FIN'\ntitre\n\nl'agent a lancé sed -i une fois\nFIN`],
    ['find -iname avant sed absent', `find . -iname '*.md'`],
    ['grep dont le motif est sed et l’option -i', `grep sed -rin spec/`],
    ['grep -i sed', `grep -i sed fichier.md`],
  ];
  for (const [nom, commande] of passent) {
    egal(sortie(bash(commande)), 0, `Bash, passe : ${nom}`);
  }
  egal(sortie(powershell(`Select-String -Path x.md -Pattern "sed -i"`)), 0, 'PowerShell, passe : motif cité');
  egal(sortie(powershell(`@'\nsed -i dans un here-string\n'@ | Out-File x.txt`)), 0, 'PowerShell, passe : here-string');
  egal(sortie(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'sed -i' } })), 0, 'autre outil : passe');
  egal(sortie('pas du JSON'), 0, 'entrée illisible : passe (le hook ne bloque pas sur son propre défaut)');
}
