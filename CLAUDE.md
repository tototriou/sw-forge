# CLAUDE.md

Ce dépôt suit le guide partagé ci-dessous. Lis-le intégralement : il contient la stack, la
structure, les commandes, les conventions, et la documentation à lire selon ce que le changement
touche — à lire **avant** tout travail.

@AGENTS.md

Les **conventions communes à toutes les pages** (saisie, persistance, réglages, champs numériques,
shell applicatif…) sont importées ci-dessous pour être présentes pendant l'écriture — leur source
lisible reste [docs/03-developpeur/conventions.md](docs/03-developpeur/conventions.md).

@docs/03-developpeur/conventions.md

## Spécifique à Claude Code

### Skills (`.claude/skills/`)

**Règle impérative** : avant (ou pendant) une modification, applique le ou les skills dont le
domaine est touché. Un même changement en déclenche souvent **plusieurs** (un champ ajouté au moteur
de l'Optimizer → `optimizer-field-propagation` + `algo-verify`). Un skill se redéclenche à **chaque**
action qui qualifie (chaque script ad hoc qui appelle le moteur, chaque mesure), pas une seule fois
par tâche.

| Le changement touche… | Skill à appliquer |
| --- | --- |
| un algorithme de recherche ou d'optimisation : `src/lib/runeBuildOptim.ts`, `artifactOptim.ts`, `relicOptim.ts`, `relicQueue.ts`, `src/workers/**`, ou un script ad hoc qui les appelle | `algo-verify` |
| un champ **traversant** de l'Optimizer (`OptimizerState`, `OptimizerRecipe`, `SearchParams`, `RealDamageContext`, entrée de résolution…) : ajout, renommage, type, défaut ou sens | `optimizer-field-propagation` |
| une **mesure** du moteur : temps, budget, benchmark (`scripts/perf-battery*.ts`, `scripts/benchmark-*.mjs`) | `optimizer-perf-testing` |
| une **mécanique de jeu** modélisée : tables `*_CONNUS` de `src/lib/damage.ts`, règle déduite des données SWARFARM, comportement supposé par ressemblance avec un autre ; demander un relevé en jeu | `game-data-curation` |
| piloter l'app dans un navigateur sans tête — **seulement** à distance et sur demande explicite, jamais par réflexe pour vérifier une interface | `run-swblacksmith` |

- **Formatage et lint** : ESLint au `pre-commit` et en CI — ne pas refaire à la main ce qu'il
  vérifie.
- **Rendu visuel demandé sans outil de navigateur** : le dire, et proposer de mettre l'outil en
  place, plutôt que de livrer en silence une reconstitution HTML.

### Jamais de code entre guillemets doubles dans une commande shell

Les messages de commit citent du code entre backticks, et les scripts de diagnostic manipulent du
JSX ou des gabarits. En bash, un backtick ou un `${}` dans une chaîne à **guillemets doubles** est
EXÉCUTÉ, pas écrit. La contre-mesure n'est pas « faire attention » : deux défauts **mécaniques**,
appliqués sans examiner le contenu.

- **Un message de commit ou d'étiquette passe toujours par un heredoc**, jamais par `-m` :
  ```bash
  git commit -F - <<'FIN'
  … message, backticks compris …
  FIN
  ```
  (de même `git tag -a <nom> -F -`). `<<'FIN'` entre apostrophes = aucune expansion. **Une fusion**
  prend `git merge --no-edit`, ou `git merge -F <fichier>` écrit par l'outil `Write` :
  `git merge -F -` ne lit pas l'entrée standard. **En PowerShell, pas de here-string** : passé par
  un tube, il glisse un BOM en tête du message (que `commit-msg` refuse) ; écrire le message dans un
  fichier (UTF-8 sans BOM, par l'outil `Write`), puis `git commit -F <fichier>`.
- **Un script ne se lance jamais en ligne** (`node -e "…"`) : il s'écrit dans un fichier du
  scratchpad et se lance par son chemin. Un fichier du dépôt se modifie par l'outil `Edit`, pas par
  un `sed` ou un `node -e` qui transporte le remplacement dans une chaîne shell.

### Windows : `TaskStop` ne tue pas le vrai process

Pour libérer un port (ex. le serveur de dev bloqué), `TaskStop` ne termine que le shell — le vrai
`node.exe`/Vite reste à l'écoute :

```powershell
Get-NetTCPConnection -LocalPort <port> -State Listen | Select-Object -ExpandProperty OwningProcess
Stop-Process -Id <pid> -Force
```

Vérifier ensuite que le port est libre
(`try { Get-NetTCPConnection -LocalPort <port> -State Listen -ErrorAction Stop } catch { 'PORT_FREE' }`)
avant de relancer `npm run dev`.
