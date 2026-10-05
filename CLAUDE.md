# SW Forge — consignes

Boîte à outils Summoners War. React + TypeScript + Vite + Tailwind, 100 % local.

📐 **Où se trouve quoi : [ARCHITECTURE.md](ARCHITECTURE.md).** Le consulter
**avant** de chercher dans la codebase — il donne, par page, les fichiers à
ouvrir. Ne pas explorer `src/` à l'aveugle.

## Travail

- **Français partout** : réponses, commits, libellés d'interface, commentaires,
  specs (`spec/`) et skills (`.claude/skills/`) — même un diff isolé de
  quelques lignes.
- **La spec avant le code.** Lire le `spec/` de la zone touchée avant de coder,
  la mettre à jour dans le **même commit**. Index : [spec/README.md](spec/README.md)
  — c'est là que vivent les conventions produit détaillées (interface,
  persistance, releases…), pas ici : ce fichier-ci reste le résumé chargé
  automatiquement à chaque session. Ouvrir une spec =
  `node scripts/spec-toc.mjs <fichier|dossier>` (sommaire compact : en-tête,
  puis niveau / plage de lignes / première phrase de chaque titre) puis la
  section utile — jamais un fichier entier de plus de 300 lignes sans raison
  écrite. Avant un chantier Optimizer : `invariants.md` (en entier — le seul
  fichier lu ainsi, tenu compact pour ça) et le README de routage, tous deux
  dans `spec/outils/optimizer/`. **Modification NORMATIVE** d'un fichier
  listé en exception dans `spec/spec-lint.json`, ou extraction des
  invariants d'une section d'état actuel nouvelle/modifiée : skill
  `spec-hygiene` (déplacer, découper, extraire — pas pour une faute, un lien
  ou un en-tête).
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
  seulement le fichier qu'on vient d'éditer. Détail : [spec/README.md](spec/README.md),
  « Conventions communes ».

## Interface

- **Deux formats de premier rang** : téléphone et ordinateur. Aucun n'est le cas
  dégradé de l'autre — **une correction destinée à l'un ne touche pas l'autre**.
- **Rien de custom.** Tout contrôle vient de `src/ui/`. On n'ajoute à la
  librairie que quand un **axe** manque, jamais une variante de plus.
- ⚠️ **Un clic ne déplace jamais ce qu'on vient de cliquer.** La place de ce qui
  s'ouvre est réservée d'avance, ou bien ce qui s'ouvre sort du flux (flottant,
  dialogue, panneau). Détail et exceptions : [spec/shared/design.md](spec/shared/design.md).
- **Contours : 1 px, et un seul.** Jamais deux superposés. Vaut pour les éléments
  d'**interface** ; runes, artéfacts et reliques se marquent comme dans le jeu.
- **Grammaire des modales** : titre en haut à gauche, croix en haut à droite,
  actions en bas à droite (empilées pleine largeur si elles ne tiennent pas sur
  une ligne), corps qui prend toute la largeur ou centré.
- **Les libellés sont ceux du jeu**, jamais reformulés.
- **Jamais un `confirm()` dont OK détruit** : le défaut est l'action sans perte.
- **Aucune couleur Tailwind native**, aucune valeur en dur : tout passe par les
  tokens ([spec/shared/design.md](spec/shared/design.md)).
- **Passe responsive en cours** — ne pas rustiner le mobile écran par écran.

Détail complet des conventions produit (persistance, réglages, champs
numériques, etc.) : [spec/README.md](spec/README.md), section « Conventions
communes ».

## Vérifier

Vérification standard avant de considérer un changement de code terminé,
dans cet ordre :

```
npx tsc --noEmit                  # types — couvre src/ ET scripts/ ET tests/
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

- **Un hook `pre-commit` refuse quatre choses** : un commit sur `main`, un
  chemin privé dans l'index (`spec/outils/optimizer/`, `.history/`,
  `.vscode/`), un fichier de plus de 5 Mo (un export de compte), et un
  `spec/**.md` du périmètre de `spec/spec-lint.json` qui ne passe pas
  `spec-lint` (niveau 1, invariant dépôt — spec/outillage/spec.md, ex-B.9).
  Il est **installé par machine**, donc actif quelle que soit la branche —
  mais jamais requis : un clone neuf n'en a pas et commite normalement.
  Il s'installe par `node scripts/installer-hooks.mjs` (`--simulation` pour
  voir sans écrire) ; une modification du hook ne s'active qu'à cette
  commande, lancée **sur décision de l'utilisateur**, tests verts.

## Consignes pour l'agent (Claude Code)

### Un ledger de suivi et le fichier qu'il référence se mettent à jour ensemble

**Un ledger de suivi (`pistes.md` et équivalents) et le fichier qu'il
référence ne se mettent jamais à jour l'un sans l'autre.** Fermer une
entrée dans le ledger sans corriger le statut dans le fichier source (ou
l'inverse) laisse deux sources qui se contredisent.

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

- **Un message de commit passe toujours par un heredoc**, jamais par `-m` :
  ```bash
  git commit -F - <<'FIN'
  … message, backticks compris …
  FIN
  ```
  `<<'FIN'` entre apostrophes = aucune expansion. **En PowerShell, pas de
  here-string** : envoyé par un tube (`@'…'@ | git commit -F -`), il
  glisse un BOM en tête du message, et passé en argument, git le prend
  pour un chemin. Écrire le message dans un fichier (UTF-8 sans BOM, par
  l'outil `Write`), puis `git commit -F <fichier>`.
- **Un script ne se lance jamais en ligne** (`node -e "…"`) : il s'écrit dans
  un fichier du scratchpad et se lance par son chemin. Vaut aussi pour un
  fichier du dépôt à modifier — passer par l'outil `Edit`, pas par un `sed`
  ou un `node -e` qui transporte le remplacement dans une chaîne shell.

⚠️ **La première puce, et la forme dangereuse de la seconde, sont
appliquées par un hook**, `PreToolUse` sur `Bash` :
[.claude/hooks/refuse-commit-m.mjs](.claude/hooks/refuse-commit-m.mjs) refuse
`git commit -m`/`--amend -m` et rappelle la forme heredoc, et refuse
`node -e "…"` dont la chaîne contient un backtick ou un `$`. Raison d'être :
après des dizaines d'exemples réussis de la forme interdite,
l'exemple pèse plus lourd qu'une règle lue au démarrage. Un refus au MOMENT de
l'action ne dépend d'aucune vigilance.
⚠️ Le script est suivi par git, son **câblage** est dans `.claude/settings.json`
(ignoré, propre à chaque machine) : à recopier pour en bénéficier.
⚠️ Portée **étroite et assumée** : `node -e`/`--eval`/`-p`/`--print` n'est
refusé qu'en position de commande, avec un argument entre **guillemets
doubles** contenant un backtick ou un `$`, même échappé ; entre apostrophes
ou sans ces caractères, il passe. `gh pr create --body` n'est pas couvert.
Couvrir la classe entière demanderait une analyse de quoting bash aux faux
positifs permanents, `$(…)` étant une construction légitime. Test :
`node tests/run.mjs hookrefusecommitm`.

⚠️ **La seconde puce est appliquée pour `sed -i`** par un second hook,
`PreToolUse` sur `Bash` **et** `PowerShell` :
[.claude/hooks/refuse-sed-i.mjs](.claude/hooks/refuse-sed-i.mjs) refuse `sed`
lancé avec une option en place (`-i`, `-i.bak`, `-Ei`, `--in-place`, derrière
`find -exec` ou `xargs` compris), jamais le texte « sed -i » cité ni un corps
de heredoc. Raison d'être : un `sed -i` raté ne signale
rien — décision de l'utilisateur du 2026-10-04. Test :
`node tests/run.mjs hookrefusesedi`. Câblage dans `.claude/settings.json`
(deux entrées : `Bash`, `PowerShell`), à recopier comme le premier. Côté
Codex, non couvert.

### Un `Read` sans offset sur une grosse spec est refusé

[.claude/hooks/refuse-read-spec-entier.mjs](.claude/hooks/refuse-read-spec-entier.mjs)
(`PreToolUse` sur `Read`) refuse la lecture d'un `spec/**.md` de plus de
300 lignes sans `offset`/`limit`, avec le rappel `node scripts/spec-toc.mjs
<fichier>` — exception : `spec/outils/optimizer/invariants.md`. Raison
d'être : même logique que `refuse-commit-m` — une consigne écrite (« jamais
un fichier entier de plus de 300 lignes ») s'érode à l'usage, un refus au
moment de l'action non. Portée **étroite et assumée** (niveau 2, garde-fou
outil, pas invariant, spec/outillage/spec.md ex-B.9) : ne couvre ni `cat`
ni un autre outil de lecture, seulement le chemin `Read` de Claude Code.
Équivalent Codex dans `scripts/hooks-codex-garde-fous.mjs`, actif avec
ou sans chantier (`node scripts/installer-hooks.mjs --codex-hooks
<hooks.json>`). Câblage dans
`.claude/settings.json` (ignoré, propre à chaque machine) :

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/refuse-read-spec-entier.mjs" }
        ]
      }
    ]
  }
}
```

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
