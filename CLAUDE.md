# Instructions pour l'agent (Claude Code) sur ce dépôt

## Déclarer l'application d'un skill avant d'agir

Quand un skill (`.claude/skills/*` ou un skill intégré, ex. `artifact-design`)
s'applique à l'action qui va suivre, dire en **une ligne** comment il
s'applique CONCRÈTEMENT à la situation présente, juste avant d'agir — pas
seulement l'invoquer en silence puis continuer.

Exemple : *« algo-verify s'applique ici : ce script ad hoc appelle
`buildBuckets`/`pairBuckets` directement, je vérifie sa fidélité au vrai
chemin de prod avant de faire confiance à son résultat. »*

**Pourquoi** : repris du skill externe `design-taste-frontend`
(`.agents/skills/`, section « Design Read » — une phrase déclarée avant de
générer du code). Sans cette ligne, invoquer un skill une fois en tête de
tâche peut être traité — à tort — comme suffisant pour toute la tâche, alors
que le déclencheur d'un skill est souvent plus fin qu'« une fois par
tâche » (ex. `algo-verify` se redéclenche à CHAQUE script ad hoc qui touche
`runeBuildOptim.ts`, pas une seule fois pour la conversation).

**Comment l'appliquer** : au moment précis où une action qualifie pour un
skill déjà invoqué ou non (nouveau script, nouvelle vérification, nouveau
rendu visuel…), écrire la ligne AVANT l'action elle-même, pas après coup
dans un résumé. Vaut pour tout skill dont la section « Quand ce skill
s'applique » désigne une granularité plus fine que la tâche globale.

## Windows : `TaskStop` ne tue pas le vrai process

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

## Rendu visuel demandé, aucun outil de pilotage de navigateur disponible

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

## Un type partagé entre l'écran et un script a PLUSIEURS constructeurs

Règle déjà écrite dans [spec/README.md](spec/README.md), « Conventions
communes », mais ce fichier n'est PAS chargé automatiquement contrairement
à celui-ci — un pointeur ici pour qu'elle reste présente à chaque session
plutôt que dépendante du hasard d'aller la relire.

Un champ ajouté à un type consommé par PLUSIEURS constructeurs (l'écran ET
un script CLI, ex. `OptimizerRecipe`/`recipeToSearchParams.ts`) doit être
répercuté dans TOUS — `tsc` ne détecte JAMAIS un champ oublié dans l'un
d'eux (reste un accès optionnel valide). Incident vécu deux fois : une fois
avec `exhaustiveSearch` (voir `spec/README.md`), une fois en renommant
`exploreAll` (voir le skill `optimizer-field-propagation`, créé
spécifiquement pour l'Optimizer — cette règle-ci est la version générale,
valable pour tout format exportable/rejouable ailleurs dans l'app : RTA,
Siège, etc.). Avant de considérer un champ ajouté/renommé comme terminé :
`grep -rn` du nom du type/champ sur TOUT le dépôt (`src/` ET `scripts/` ET
`tests/`), pas seulement le fichier qu'on vient d'éditer.

## Vérification standard avant de considérer un changement de code terminé

`npx tsc --noEmit`, `npm test`, `npm run build` — les trois, dans cet
ordre, avant de rapporter un changement comme fini. Déjà la pratique
constante de cette session (algorithmes, UI, scripts CLI confondus) ; formalisé
ici pour ne pas dépendre du souvenir de l'avoir fait la fois précédente. Pour
un algorithme de recherche/optimisation combinatoire, voir en plus la
checklist dédiée du skill `algo-verify`.

## Langue

Code, commentaires, specs (`spec/`) et skills (`.claude/skills/`) : en
français, comme le reste du dépôt — même un diff isolé de quelques lignes.
