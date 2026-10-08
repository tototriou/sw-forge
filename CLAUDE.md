# SW Blacksmith — consignes

Boîte à outils Summoners War. React + TypeScript + Vite + Tailwind, 100 % local.

📐 **Où se trouve quoi : [ARCHITECTURE.md](ARCHITECTURE.md).** Le consulter
**avant** de chercher dans la codebase — il donne, par page, les fichiers à
ouvrir. Ne pas explorer `src/` à l'aveugle.

## Travail

- **Français partout** : réponses, commits, libellés d'interface, commentaires,
  documentation (`docs/`) et skills (`.claude/skills/`) — même un diff isolé de
  quelques lignes.
- **La spec avant le code.** Lire la documentation (`docs/`) de la zone touchée avant de coder,
  la mettre à jour dans le **même commit**. Carte : [docs/README.md](docs/README.md) ;
  conventions : [docs/03-developpeur/](docs/03-developpeur/)
  — c'est là que vivent les conventions produit détaillées (interface,
  persistance, releases…), pas ici : ce fichier-ci reste le résumé chargé
  automatiquement à chaque session. Ouvrir une spec =
  `node scripts/spec-toc.mjs <fichier|dossier>` (sommaire compact : en-tête,
  puis niveau / plage de lignes / première phrase de chaque titre) puis la
  section utile — jamais un fichier entier de plus de 300 lignes sans raison
  écrite. Avant un chantier Optimizer : les invariants de
  `docs/03-developpeur/optimizer/` (en entier — le seul fichier lu ainsi,
  tenu compact pour ça) et le routage par tâche de `docs/02-app/optimizer/`.
  **Modification NORMATIVE** d'un fichier
  listé en exception dans `scripts/spec-lint.json`, ou extraction des
  invariants d'une section d'état actuel nouvelle/modifiée : skill
  `spec-hygiene` (déplacer, découper, extraire — pas pour une faute, un lien
  ou un en-tête).
- **Documentation : [docs/README.md](docs/README.md)** — la carte et les
  règles. Le dépôt est public : décisions (ADR), cadrages et pilotage y
  vivent (`docs/05-decisions/`, `docs/07-pilotage/`). Restent hors du dépôt
  un export de compte, des données personnelles, des captures d'écran.
- **Pendant le travail, on ne lance QUE les vérifications de la zone touchée** :
  `node tests/run.mjs <filtre>` (ex. `node tests/run.mjs speed-tune`, plusieurs
  filtres possibles). La **suite complète** (`npm test`) est obligatoire **avant
  une fusion sur `main`** — et **seulement là**. Détail dans « Vérifier ».
- **Branches `forge/<sujet>`**, jamais `release/x.y.z` : le numéro se décide à la
  fusion.
- **Toute page ou section ajoutée / renommée / supprimée** se répercute sur
  l'accueil et sur la nav de `App.tsx`, dans le même commit.
- **Une décision prise ensemble s'applique jusqu'au bout.** Si le chantier dérive
  et qu'une étape validée reste en attente, le dire explicitement.
- **Commits atomiques — un commit = une chose reviewable.** Jamais un
  fourre-tout de fin de tâche qui regroupe tout ce qui a été touché depuis le
  dernier commit sous prétexte que c'est la même « session » de travail. Un
  changement qui touche plusieurs fichiers pour UNE SEULE raison logique (ex.
  renommer un champ dans l'écran ET la recette ET les scripts CLI) reste UN
  commit — l'atomicité se juge sur la cohérence du POURQUOI, pas sur le nombre
  de fichiers. Quand plusieurs sujets indépendants ont été traités dans le même
  tour de conversation, proposer/faire PLUSIEURS commits, pas un seul.
- **Règles d'écriture.**
  - Tout le temps : un commentaire de code donne la raison et l'invariant,
    sans récit ; un commit donne le pourquoi en bref, sans journal.
- **Un type partagé entre l'écran et un script a PLUSIEURS constructeurs**
  (ex. `OptimizerRecipe`/`recipeToSearchParams.ts`). Un champ ajouté ou
  renommé doit être répercuté dans TOUS — `tsc` ne détecte JAMAIS un champ
  oublié dans l'un d'eux (reste un accès optionnel valide). ⚠️ Depuis que
  `tsconfig.json` couvre aussi `scripts/` et `tests/`, `tsc` attrape en
  revanche un champ dont le **type change** ou qui devient **obligatoire**. La
  règle ci-dessus ne vaut donc plus que pour les champs **optionnels**, où
  l'oubli reste parfaitement typé. Avant de
  considérer un champ ajouté/renommé comme terminé : `grep -rn` du nom du
  type/champ sur TOUT le dépôt (`src/` ET `scripts/` ET `tests/`), pas
  seulement le fichier qu'on vient d'éditer. Détail : [docs/03-developpeur/](docs/03-developpeur/),
  « Conventions communes ».

## Interface

- **Deux formats de premier rang** : téléphone et ordinateur. Aucun n'est le cas
  dégradé de l'autre — **une correction destinée à l'un ne touche pas l'autre**.
- **Rien de custom.** Tout contrôle vient de `src/ui/`. On n'ajoute à la
  librairie que quand un **axe** manque, jamais une variante de plus.
- ⚠️ **Un clic ne déplace jamais ce qu'on vient de cliquer.** La place de ce qui
  s'ouvre est réservée d'avance, ou bien ce qui s'ouvre sort du flux (flottant,
  dialogue, panneau). Détail et exceptions : [docs/03-developpeur/interface/](docs/03-developpeur/interface/).
- **Contours : 1 px, et un seul.** Jamais deux superposés. Vaut pour les éléments
  d'**interface** ; runes, artéfacts et reliques se marquent comme dans le jeu.
- **Grammaire des modales** : titre en haut à gauche, croix en haut à droite,
  actions en bas à droite (empilées pleine largeur si elles ne tiennent pas sur
  une ligne), corps qui prend toute la largeur ou centré.
- **Les libellés sont ceux du jeu**, jamais reformulés.
- **Jamais un `confirm()` dont OK détruit** : le défaut est l'action sans perte.
- **Aucune couleur Tailwind native**, aucune valeur en dur : tout passe par les
  tokens ([docs/03-developpeur/interface/](docs/03-developpeur/interface/)).
- **Passe responsive en cours** — ne pas rustiner le mobile écran par écran.

Détail complet des conventions produit (persistance, réglages, champs
numériques, etc.) : [docs/03-developpeur/](docs/03-developpeur/), section « Conventions
communes ».

## Vérifier

Vérification standard avant de considérer un changement de code terminé,
dans cet ordre :

```
npx tsc --noEmit                  # types — couvre src/ ET scripts/ ET tests/
npx eslint <fichiers touchés>     # lint ; `npm run lint` pour tout le dépôt
node tests/run.mjs <filtre>       # SEULEMENT la zone touchée (ex. speed-tune)
npm run build                     # Tailwind n'émet que ce qu'il trouve dans le SOURCE
```

⚠️ **La suite complète ne se lance qu'avant une fusion sur `main`** :

```
npm test                          # toutes les vérifications, rien de moins
```

Le filtre se compare au nom de la vérification, mis à plat (`speed-tune`,
`speedtune` et `SpeedTune` marchent tous) ; sans argument, tout tourne. Le
registre des noms vit dans [tests/index.ts](tests/index.ts), et un filtre qui ne
correspond à rien échoue en listant ce qui existe — jamais en ne testant rien.
⚠️ Lancer la suite entière à chaque changement coûte des minutes pour une
information qu'on a déjà : ce qui compte pendant le travail, c'est la zone qu'on
touche. Ce qui compte avant de fusionner, c'est **tout**.

⚠️ Une classe Tailwind « correcte » dans le TSX peut n'être **jamais émise**.
Quand un style ne s'applique pas, vérifier dans
le **CSS construit**, pas dans le composant. Pour un algorithme de
recherche/optimisation combinatoire, voir en plus la checklist dédiée du skill
`algo-verify` ; pour toute **mécanique de jeu** modélisée — règle déduite des
données SWARFARM, table `*_CONNUS`, ou comportement supposé par ressemblance
avec un autre effet — celle de `game-data-curation`, qui contient aussi la
recette pour demander un relevé en jeu exploitable.

## Branches et worktrees

⚠️ **Toute nouvelle branche part de main**
(`git fetch origin && git switch -c forge/<sujet> origin/main`) ; on n'y
travaille jamais, on en part.

- **Un hook `pre-commit` refuse cinq choses** : une erreur ESLint dans le
  code indexé, un commit sur `main`, un
  chemin privé dans l'index (`.history/`, `.vscode/`), un fichier de
  plus de 5 Mo (un export de compte), et un `docs/**.md` du périmètre de
  `scripts/spec-lint.json` qui ne passe pas `spec-lint` (niveau 1, invariant
  dépôt — docs/03-developpeur/ § Refus du `pre-commit`).
- **Un hook `commit-msg` refuse** un sujet hors de la forme
  `type(portée): description`, un corps collé au sujet et un message qui
  commence par un BOM (docs/03-developpeur/ § Message de commit).
- Les deux hooks sont **installés par machine**, donc actifs quelle que soit la branche —
  mais jamais requis : un clone sans `npm install` n'en a pas et commite
  normalement. **`npm install` les installe** (script `prepare`, jamais en
  CI, jamais vers une version plus ancienne que celle installée) ; à la main :
  `node scripts/installer-hooks.mjs` (`--simulation` pour voir sans écrire).
- **`--no-verify` reste possible en local, pas en CI** : sur chaque pull
  request, `scripts/verifier-commits.mjs` rejoue `commit-msg` et
  `pre-commit` sur chaque commit (docs/03-developpeur/
  § Garde-fous rejoués en CI).

## Consignes pour l'agent (Claude Code)

### Un ledger de suivi et le fichier qu'il référence se mettent à jour ensemble

**Un ledger de suivi (`pistes.md` et équivalents) et le fichier qu'il
référence ne se mettent jamais à jour l'un sans l'autre.** Fermer une
entrée dans le ledger sans corriger le statut dans le fichier source (ou
l'inverse) laisse deux sources qui se contredisent.

### Un travail de plus d'une session commence par un cadrage écrit

Tout travail de plus d'une session, ou confié à des sessions fraîches, se
cadre dans un fichier — jamais dans un plan de conversation, qui ne se
recharge pas. Skill `cadrage-chantier` (gabarit, règles de fond). Un
cadrage vit dans `docs/05-decisions/cadrages/`, indexé par le README de ce
dossier et cité par aucun autre document ; il disparaît une fois son
contenu passé dans la documentation (docs/README.md, règle 11).

### Déclarer l'application d'un skill avant d'agir

Quand un skill (`.claude/skills/*` ou un skill intégré, ex. `artifact-design`)
s'applique à l'action qui va suivre, dire en **une ligne** comment il
s'applique CONCRÈTEMENT à la situation présente, juste avant d'agir — pas
seulement l'invoquer en silence puis continuer.

Exemple : *« algo-verify s'applique ici : ce script ad hoc appelle
`buildBuckets`/`pairBuckets` directement, je vérifie sa fidélité au vrai
chemin de prod avant de faire confiance à son résultat. »*

Sans cette ligne, invoquer un skill une fois en tête de tâche peut être traité
— à tort — comme suffisant pour toute la tâche, alors que le déclencheur d'un
skill est souvent plus fin qu'« une fois par tâche » (ex. `algo-verify` se
redéclenche à CHAQUE script ad hoc qui touche `runeBuildOptim.ts`, pas une
seule fois pour la conversation). À appliquer au moment précis où une action
qualifie pour un skill déjà invoqué ou non (nouveau script, nouvelle
vérification, nouveau rendu visuel…), écrit AVANT l'action elle-même.

### Jamais de code entre guillemets doubles dans une commande shell

Les messages de commit de ce dépôt citent du code entre backticks, et les
scripts de diagnostic manipulent du JSX ou des gabarits. En bash, un backtick
ou un `${}` dans une chaîne à **guillemets doubles** est EXÉCUTÉ, pas écrit.

⚠️ **La contre-mesure n'est PAS « faire attention aux backticks ».** Une règle
qui exige de repérer le danger échoue précisément quand on ne le repère pas.
D'où deux défauts
**mécaniques**, à appliquer sans examiner le contenu :

- **Un message de commit ou d'étiquette passe toujours par un heredoc**,
  jamais par `-m` :
  ```bash
  git commit -F - <<'FIN'
  … message, backticks compris …
  FIN
  ```
  (de même `git tag -a <nom> -F -`). `<<'FIN'` entre apostrophes = aucune
  expansion. **Une fusion** prend `git merge --no-edit` (message par
  défaut), ou `git merge -F <fichier>` écrit par l'outil `Write` :
  `git merge -F -` ne lit pas l'entrée standard. **En PowerShell, pas de
  here-string** : envoyé par un tube (`@'…'@ | git commit -F -`), il
  glisse un BOM en tête du message, et passé en argument, git le prend
  pour un chemin. Écrire le message dans un fichier (UTF-8 sans BOM, par
  l'outil `Write`), puis `git commit -F <fichier>`.
- **Un script ne se lance jamais en ligne** (`node -e "…"`) : il s'écrit dans
  un fichier du scratchpad et se lance par son chemin. Vaut aussi pour un
  fichier du dépôt à modifier — passer par l'outil `Edit`, pas par un `sed`
  ou un `node -e` qui transporte le remplacement dans une chaîne shell.

Ces deux défauts sont des conventions d'agent : aucun hook d'agent ne les
applique, parce qu'une faute ici abîme la machine ou le travail de l'agent,
pas le dépôt. Ce qui entre dans le dépôt est gardé par les hooks Git et la
CI : `commit-msg` refuse notamment un message qui commence par un BOM
(docs/03-developpeur/).

### Windows : `TaskStop` ne tue pas le vrai process

Pour libérer un port (ex. le serveur de dev bloqué par un process
précédent), `TaskStop` ne termine que le wrapper/shell — le vrai
`node.exe`/Vite reste à l'écoute. Contre-mesure systématique :
```powershell
Get-NetTCPConnection -LocalPort <port> -State Listen | Select-Object -ExpandProperty OwningProcess
Stop-Process -Id <pid> -Force
```
Vérifier ensuite que le port est bien libre (`try { Get-NetTCPConnection
-LocalPort <port> -State Listen -ErrorAction Stop } catch { 'PORT_FREE' }`)
avant de relancer `npm run dev`.

### Rendu visuel demandé, aucun outil de pilotage de navigateur disponible

Si l'environnement ne fournit aucun outil de pilotage de navigateur
(Playwright/`chromium-cli`/etc.) au moment où l'utilisateur demande un rendu
visuel (screenshot, aperçu d'un composant…) : le signaler explicitement et
recommander `/run-skill-generator` (voir le skill `run`) au lieu de
simplement produire une reconstitution HTML avec un disclaimer et de
continuer comme si de rien n'était. Une reconstitution fidèle (tokens de
design réels extraits de `tailwind.config.js`/`src/index.css`, structure de
composant réelle) reste un repli honnête acceptable si l'utilisateur ne
souhaite pas mettre en place l'outil, mais ne doit jamais être le choix par
défaut silencieux.
