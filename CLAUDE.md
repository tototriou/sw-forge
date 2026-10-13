# SW Blacksmith — consignes

Boîte à outils Summoners War. React + TypeScript + Vite + Tailwind, 100 % local.

📐 **Où se trouve quoi : [ARCHITECTURE.md](ARCHITECTURE.md).** Le consulter
**avant** de chercher dans la codebase — il donne, par page, les fichiers à
ouvrir. Ne pas explorer `src/` à l'aveugle.

## Travail

- **Français partout** : réponses, commits, libellés d'interface, commentaires,
  documentation (`docs/`) et skills (`.claude/skills/`) — même un diff isolé de
  quelques lignes.
- **La spec avant le code.** Lire la documentation (`docs/`) de la zone
  touchée avant de coder, la mettre à jour dans le **même commit**. Carte et
  règles : [docs/README.md](docs/README.md) ; conventions détaillées :
  [docs/03-developpeur/](docs/03-developpeur/). Ouvrir une spec =
  `node scripts/spec-toc.mjs <fichier|dossier>` puis la section utile —
  jamais un fichier entier de plus de 300 lignes sans raison écrite. Avant
  un chantier Optimizer : les invariants de `docs/03-developpeur/optimizer/`
  (en entier, seule exception) et le routage par tâche de
  `docs/02-app/optimizer/`. Déplacer, découper ou extraire dans `docs/` :
  skill `spec-hygiene` (pas pour une faute, un lien ou un en-tête).
- **Le dépôt est public** : jamais d'export de compte, de données
  personnelles ni de capture d'écran.
- **Toute page ou section ajoutée / renommée / supprimée** se répercute sur
  l'accueil et sur la nav de `App.tsx`, dans le même commit.
- **Une décision prise ensemble s'applique jusqu'au bout.** Si le chantier dérive
  et qu'une étape validée reste en attente, le dire explicitement.
- **Commits atomiques — un commit = une chose reviewable.** L'atomicité se
  juge sur la cohérence du POURQUOI, pas sur le nombre de fichiers : une
  seule raison sur plusieurs fichiers fait UN commit ; plusieurs sujets
  traités dans le même tour en font PLUSIEURS, jamais un fourre-tout de fin
  de tâche.
- **Règles d'écriture.**
  - Tout le temps : un commentaire de code donne la raison et l'invariant,
    sans récit ; un commit donne le pourquoi en bref, sans journal.
- **Un type partagé entre l'écran et un script a PLUSIEURS constructeurs**
  (ex. `OptimizerRecipe`/`recipeToSearchParams.ts`). Un champ ajouté ou
  renommé doit être répercuté dans TOUS. `tsc` (qui couvre `src/`, `scripts/`,
  `tests/` et `bureau/`) attrape un champ dont le **type change** ou qui devient
  **obligatoire**, jamais un champ **optionnel** oublié dans l'un d'eux :
  l'accès reste parfaitement typé. Avant de considérer un champ
  ajouté/renommé comme terminé : `grep -rn` du nom du type/champ sur TOUT le
  dépôt (`src/` ET `scripts/` ET `tests/`). Détail :
  [docs/03-developpeur/](docs/03-developpeur/), « Conventions communes ».

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

## Vérifier

Vérification standard avant de considérer un changement de code terminé,
dans cet ordre :

```
npx tsc --noEmit                  # types — couvre src/ ET scripts/ ET tests/
npx eslint <fichiers touchés>     # lint ; `npm run lint` pour tout le dépôt
node tests/run.mjs <filtre>       # SEULEMENT la zone touchée (ex. speed-tune)
npm run build                     # Tailwind n'émet que ce qu'il trouve dans le SOURCE
```

⚠️ **La suite complète (`npm test`) ne se lance qu'avant une fusion sur
`main` ou dans une branche `release/*`**, et seulement là : pendant le
travail, seule compte la zone touchée. Le filtre se compare au nom d'une
vérification (registre : [tests/index.ts](tests/index.ts)) ;
`node tests/run.mjs --depuis origin/<base>` (la branche dont on part) s'y
ajoute et retient ce que touchent les fichiers modifiés. Détail :
[tests/README.md](tests/README.md).

⚠️ Une classe Tailwind « correcte » dans le TSX peut n'être **jamais émise** :
quand un style ne s'applique pas, vérifier dans le **CSS construit**, pas
dans le composant.

Checklists dédiées : skill `algo-verify` pour un algorithme de
recherche/optimisation combinatoire ; skill `game-data-curation` pour toute
**mécanique de jeu** modélisée (règle déduite des données SWARFARM, table
`*_CONNUS`, comportement supposé par ressemblance avec un autre effet).

## Branches et worktrees

⚠️ **Toute nouvelle branche part de `main` ou de la branche de release
visée** (`git fetch origin && git switch -c forge/<sujet> origin/<base>`) ;
elle fusionne dans la release, qui fusionne dans `main`. On ne travaille
jamais sur `main` ni sur une release : on en part. Nom : `forge/<sujet>`,
jamais `release/x.y.z` — le numéro se décide à la fusion.

Des hooks Git (`pre-commit`, `commit-msg`), installés par `npm install`,
refusent au commit ce qui enfreint une règle mécanique (lint, commit sur
`main`, fichier de plus de 5 Mo, message hors de la forme
`type(portée): description`…), et la CI les rejoue sur chaque pull request.
Ce qu'ils refusent et comment les installer :
[docs/03-developpeur/qualite-code.md](docs/03-developpeur/qualite-code.md).

## Consignes pour l'agent (Claude Code)

### Un ledger de suivi et le fichier qu'il référence se mettent à jour ensemble

Fermer une entrée d'un ledger (`pistes.md` et équivalents) sans corriger le
statut dans le fichier qu'elle référence, ou l'inverse, laisse deux sources
qui se contredisent.

### Jamais de code entre guillemets doubles dans une commande shell

En bash, un backtick ou un `${}` dans une chaîne à **guillemets doubles** est
EXÉCUTÉ, pas écrit — et les messages de ce dépôt citent du code entre
backticks. La contre-mesure n'est pas « faire attention » : une règle qui
exige de repérer le danger échoue quand on ne le repère pas. D'où deux
défauts **mécaniques**, appliqués sans examiner le contenu :

- **Un message de commit ou d'étiquette passe toujours par un heredoc**,
  jamais par `-m` :
  ```bash
  git commit -F - <<'FIN'
  … message, backticks compris …
  FIN
  ```
  (de même `git tag -a <nom> -F -`). Une fusion prend `git merge --no-edit`,
  ou `git merge -F <fichier>` écrit par l'outil `Write` (`git merge -F -`
  ne lit pas l'entrée standard). En PowerShell, pas de here-string : le
  message s'écrit dans un fichier (UTF-8 sans BOM, outil `Write`), puis
  `git commit -F <fichier>`.
- **Un script ne se lance jamais en ligne** (`node -e "…"`) : il s'écrit dans
  un fichier du scratchpad et se lance par son chemin. Un fichier du dépôt
  se modifie par l'outil `Edit`, jamais par un `sed` ou un `node -e` qui
  transporte le remplacement dans une chaîne shell.

### Windows : `TaskStop` ne tue pas le vrai process

`TaskStop` ne termine que le shell : le `node.exe` (Vite) reste à l'écoute
du port. Libérer un port par le PID qui l'écoute, puis vérifier qu'il est
libre avant de relancer (commandes : skill `run-swblacksmith`, « Serveur de
dev »).
