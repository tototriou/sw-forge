# Cadrage — deux agents en parallèle sur SW Forge

> **STATUT : v5 — cadrage clos, prêt pour l'implémentation.** Les décisions
> (§2-§4) sont stabilisées après quatre passes critiques ; le cycle de refonte
> s'arrête ici. Ce qui reste à faire est un **plan de construction** (§6), pas
> un débat d'architecture.
>
> Ce qui a changé version par version : **journal des arbitrages** (§9).

## 0. Critère d'acceptation

> ⚠️ **Un clone neuf — sans installation de l'orchestration, sans accès au
> dépôt documentaire privé — permet de développer, tester et committer
> normalement.**

Ce critère prime sur tout le reste : **le dispositif est un outillage, jamais
une dépendance du dépôt.** Il n'est pas une précaution abstraite, il tranche
plusieurs décisions :

| Conséquence | Vérification |
|---|---|
| Le hook n'est **jamais** requis | son câblage est une config de machine (`core.hooksPath`), absente d'un clone neuf : aucun commit n'en dépend |
| `chantier` n'est sur **aucun** chemin critique | ni `npx tsc --noEmit`, ni `node tests/run.mjs`, ni `npm run build`, ni `npm test` ne l'appellent |
| Les **tests de `chantier`** n'exigent ni installation ni dépôt documentaire | ils tournent sur des dépôts jetables qu'ils créent eux-mêmes (§6.3) |
| La **spec produit reste autosuffisante** | `spec/outils/optimizer.md` (suivi) se lit et s'applique sans le journal privé |
| Les dépendances s'installent seules | `package-lock.json` est suivi ⇒ `npm ci` fonctionne |

C'est aussi la garantie que l'appareillage ne devienne pas porteur : le jour où
`chantier` est cassé, indisponible ou abandonné, le dépôt continue de vivre.

## 1. Le problème réel

`origin` n'est pas le problème : c'est un **alias pour une URL**, qui ne change
jamais quand on change de branche, et deux branches de noms différents s'y
poussent sans conflit.

Ce qui casse quand deux agents partagent un dossier, c'est le **HEAD et
l'index**, uniques par répertoire de travail : un `git checkout` fait par A
change les fichiers sous les pieds de B en plein `tsc`. **La séparation
nécessaire est entre répertoires de travail, pas entre dépôts distants.**

C'est déjà appliqué en partie : `git worktree list` montre
`C:/Users/Enzo/Desktop/sw-forge-pair-order` sur `forge/objective-speed-nuker`.

Mais isoler les répertoires ne suffit pas. Trois problèmes restent :

1. **Les fichiers gitignorés** ne sont pas dans un worktree neuf — dont
   `spec/outils/optimizer/` (2,8 Mo de journal de calibrage) et
   `node_modules/`.
2. **Les fichiers transverses** que plusieurs chantiers doivent toucher.
3. **L'intégration** : qui rapproche les travaux, dans quel ordre, avec
   quelles vérifications.

## 2. Ce qui est isolé, et comment

| Élément | Organisation |
|---|---|
| Code et **spec produit** (`spec/**.md` suivis) | un worktree et une branche `forge/<sujet>` par chantier |
| Dépendances | `npm ci` dans chaque worktree (185 Mo, mesuré) |
| **Notes privées** (`spec/outils/optimizer/`) | dépôt Git séparé + **un worktree documentaire par chantier** |
| Fichiers transverses | **responsable désigné par chantier**, pas d'interdiction générale |
| Livraison des notes | **`chantier livrer`**, avec reçu vérifiable (§4) |
| Intégration | un intégrateur **désigné au lancement**, qui **exige le reçu** |
| Benchmarks | **créneau réservé**, sans autre charge lourde concurrente |

### 2.1 `node_modules` : une copie, pas un lien

La v1 proposait une junction, avec la contre-mesure documentée (retirer le lien
EXPLICITEMENT avant `git worktree remove`, sinon il suit la cible et supprime
les modules de l'original). Une contre-mesure qui exige de se rappeler l'ordre
des commandes finira par échouer — c'est la logique déjà écrite dans CLAUDE.md,
« la contre-mesure n'est PAS *faire attention* ».

**`npm ci` par worktree : 185 Mo et deux minutes, une fois.**

⚠️ Le worktree `sw-forge-pair-order` portait cette junction
(`node_modules -> /c/Users/Enzo/Desktop/sw-forge/node_modules`, vérifié). Elle
s'est retirée **en tant que lien**, après vérification de sa cible — jamais par
un nettoyage récursif improvisé (§6.1).

> ⚠️ **Deux sortes de worktree, et la règle n'est PAS la même.** Le mot est le
> même, l'objet ne l'est pas — et le skill `optimizer-perf-testing` prescrit
> l'inverse de ce qui précède, à juste titre.
>
> | | Worktree de **chantier** | Worktree de **mesure** |
> |---|---|---|
> | Durée de vie | le chantier | quelques secondes, créé et détruit par un script |
> | Commit visé | une branche vivante | un **vieux commit** repère |
> | `node_modules` | **`npm ci`** | **junction** vers celui du dépôt principal |
> | Nettoyage | `chantier fermer` | `unlinkSync` de chaque lien dans un `finally`, AVANT `worktree remove` |
>
> Pourquoi la junction est correcte pour la mesure : `npm ci` sur un vieux
> commit installerait les dépendances **de l'époque**, ce qui change ce qu'on
> mesure — on veut compiler l'ancien source avec l'outillage courant. Et le
> danger du lien (un nettoyage qui suit la cible) est ici tenu par un script qui
> délie explicitement, pas par la vigilance d'un humain.
>
> Pourquoi `npm ci` est correct pour le chantier : personne ne le délie jamais,
> il vit des jours, et il finit supprimé par une commande tapée à la main.

### 2.2 Les notes privées : un dépôt documentaire séparé

La distinction que le `.gitignore` fait déjà :

| | Suivi ? | Nature |
|---|---|---|
| `spec/outils/optimizer.md` (1909 lignes, **vérifié suivi**) | ✅ | spec **produit** |
| `spec/outils/optimizer/` (2,8 Mo) | ❌ ignoré | **journal privé** — mesures, pistes écartées, protection compétitive |

**Conséquence décisive : la règle « code + spec dans le même commit » reste
intacte**, puisqu'elle porte sur la spec produit, qui est versionnée. La v1 et
la v2 la croyaient menacée ; elle ne l'a jamais été.

- Dépôt documentaire séparé, hors du dépôt public, **avec un remote privé dès
  le départ** (sauvegarde + historique, sans toucher la visibilité du public).
- **Un worktree documentaire par chantier**, pas seulement une branche : sinon
  deux livraisons changent la branche du même dossier sous les pieds l'une de
  l'autre.
- Chaque worktree de code reçoit une **copie** des notes, prise à une révision
  documentaire précise et **enregistrée** (pas une junction).

> **Pourquoi la junction de la v2 est abandonnée.** Son argument — « ces
> fichiers n'ont aucun historique, donc ce n'est pas pire que le statu quo » —
> est une erreur de catégorie. Ce qui change n'est pas l'historique, c'est le
> **nombre d'auteurs simultanés**. Et le risque n'est pas que l'écrasement : A
> peut lire une note que B vient de modifier pour une évolution absente de sa
> branche — aucun conflit, un référentiel incohérent.

### 2.3 Les fichiers transverses : un responsable, pas un interdit

**L'interdiction générale de la v2 est supprimée.** `CLAUDE.md:26` impose que
toute page ajoutée ou renommée soit répercutée sur `App.tsx` **dans le même
commit** : interdire `App.tsx` rend ce chantier impossible. Et la symétrie
était contre elle — rejeter une liste d'autorisés pour cause de blocages, puis
adopter une liste d'interdits qui en provoque aussi.

**Le bon critère : qui porte ce fichier POUR CE CHANTIER**, décidé par l'humain
au lancement. Si deux chantiers ont besoin du même changement transverse, ce
**prérequis se fait avant de les séparer**.

> **La catégorie « ajout seul » de la v2 est supprimée** : deux ajouts au même
> endroit entrent en conflit, et deux ajouts fusionnés proprement peuvent
> enregistrer **deux fois le même test** dans `tests/index.ts` — un défaut
> qu'aucun merge ne signale.

### 2.4 Le hook et l'outil : source versionné, installation commune

Trois objets distincts — la confusion entre les deux premiers a produit une
erreur en v2 puis une autre en v3 :

| Objet | Où | Versionné ? |
|---|---|---|
| Les **sources** (`.githooks/pre-commit`, `scripts/chantier.mjs`) | dans le dépôt | ✅ relus en revue |
| **L'installation** | `.git/forge/installation/` | ❌ propre à la machine |
| Le **câblage** | `core.hooksPath` → chemin absolu vers l'installation | ❌ |

- Un `core.hooksPath` **relatif** se résout à l'exécution : chaque worktree
  prendrait **son** `.githooks`, tel que checkouté sur sa branche.
- Un chemin absolu vers le `.githooks` du **worktree principal** ne résout rien
  non plus : son contenu dépend encore de la branche qui y est checkoutée.
- **L'installation porte donc sa propre version de référence** : un manifeste
  enregistrant le commit source et les empreintes de **tous** ses fichiers,
  outil compris. `verifier` contrôle cette version installée ; sa mise à jour
  est une **opération explicite** (`chantier installer`), jamais silencieuse.

Comparer l'installé au source *de la branche courante* recréerait exactement
l'incompatibilité entre anciennes et nouvelles branches qu'on cherche à
éliminer.

**Conséquence sur l'invocation** : toutes les commandes courantes appellent
**l'installation**, jamais `scripts/chantier.mjs` du worktree.

```powershell
$gitCommun = git rev-parse --path-format=absolute --git-common-dir
$outil = Join-Path $gitCommun 'forge/installation/scripts/chantier.mjs'
node $outil verifier --chantier <sujet>
```

Le chemin se calcule depuis le **répertoire Git commun**
(`git rev-parse --git-common-dir`) — il ne se déduit pas d'un `.git` supposé
être un dossier dans chaque worktree, ce qu'il n'est pas.

**Portée du hook, assumée.** Ce n'est pas une exclusion mutuelle, ça se
contourne (`--no-verify`), et ça ne remplace jamais l'intégration. Trois règles
contre l'erreur ordinaire :

1. **Refuser un commit sur `main`** — trois incidents déjà.
2. **Détecter un chemin privé ajouté à l'index** — la classe de la fuite
   `.history/` (§7), généralisée.
3. **Vérifier le contexte de chantier** (branche, worktree attendu).

⚠️ **Pas de commit documentaire automatique dans `pre-commit`** : ce serait
écrire dans un autre dépôt pendant une opération qui peut encore échouer.

## 3. La procédure d'intégration

1. **Préparer.** Fixer la base de code, la **révision documentaire**,
   l'objectif, les interfaces touchées, le **responsable des fichiers
   communs**, et **l'intégrateur** — désigné selon sa connaissance des
   interfaces concernées, *pas* automatiquement celui qui termine en second. Si
   les deux travaux exigent le même changement transverse, le faire **avant**
   de les séparer.
2. **Travailler indépendamment.** Chaque agent possède ses fichiers physiques.
   Un chevauchement découvert conduit à **ajuster la découpe** — pas à un
   blocage automatique.
3. **Livrer.** Code, spec produit, vérifications ciblées
   (`node tests/run.mjs <filtre>`), puis `chantier livrer` pour les notes.
4. **Intégrer successivement.** L'intégrateur appelle `chantier verifier`
   **AVANT d'accepter chaque contribution** : reçu absent, périmé ou incohérent
   ⇒ **blocage** avec explication. Il rapproche A, puis B, examine leurs
   **interactions**, et **produit une nouvelle livraison** associant le code
   intégré aux documents intégrés — *les reçus individuels ne prouvent rien sur
   le résultat combiné*. La **suite complète** (`npm test`) intervient avant la
   fusion sur `main`, conformément à CLAUDE.md — et seulement là.
5. **Fermer** (§4).

⚠️ **Les benchmarks demandent un créneau exclusif.** Une mesure faite pendant
qu'un autre agent build ne veut rien dire. Incident déjà vécu.

## 4. `chantier` — contrats

| Commande | Responsabilité |
|---|---|
| `ouvrir` | enregistrer le chantier, créer son worktree documentaire, copier une révision précise |
| `livrer` | reporter, vérifier, committer les notes, écrire le reçu |
| `verifier` | contrôler une contribution **explicitement désignée** et ses révisions |
| `integrer` | avancer le `main` **documentaire** — indépendamment du sort du code |
| `installer` | installer une version précise de l'outil et des hooks |
| `fermer` | vérifier conservation, sauvegarde et état local avant nettoyage |

Un **registre privé** conserve chemins, branches, bases de départ et révisions
attendues. Toutes les commandes acceptent un chantier explicite
(`--chantier <sujet>`) : **l'intégrateur ne travaille pas depuis le dossier de
l'auteur**.

### `ouvrir`

Enregistre la base documentaire et **initialise explicitement** le dossier de
notes. Cette initialisation est le marqueur qui distingue *dossier absent* de
*dossier volontairement vidé* (§4, encadré). N'installe **jamais**
silencieusement une autre version commune : un câblage préexistant est préservé
ou signalé.

### `livrer`

- vérifie l'identité du chantier, sa branche, son **worktree** documentaire ;
- relève le **commit de code exact** ;
- reporte les notes — **ajouts, modifications ET suppressions** ;
- vérifie **l'égalité de contenu** entre notes locales et notes reportées ;
- crée le commit documentaire si nécessaire ;
- écrit un **reçu** liant chantier, commit de code, commit documentaire,
  empreinte du contenu.

> ⚠️ **Trois refus qui protègent d'une perte, et qui sont le cœur de l'outil :**
>
> 1. **Dossier de notes non initialisé** ⇒ refus. Une copie manquante ne doit
>    **jamais** devenir une suppression de toutes les notes. C'est la
>    différence entre « rien à reporter » et « tout supprimer ».
> 2. **Branche documentaire avancée indépendamment** ⇒ refus, *même si son
>    répertoire est propre* — d'où l'enregistrement de son dernier commit
>    attendu. Jamais d'écrasement silencieux du travail fait de l'autre côté.
> 3. **Junction détectée dans le dossier de notes** ⇒ refus. Les chemins sont
>    contrôlés ; l'empreinte inclut **les chemins relatifs ET le contenu** de
>    chaque fichier, pas seulement le contenu.
>
> Le reçu vit **hors du contenu dont on calcule l'empreinte**, pour éviter la
> référence circulaire.

### `verifier` — l'état réel, pas une case « terminé »

Le reçu n'est valable que si, **tous ensemble** :

- commit de code livré = commit attendu ;
- contenu actuel des notes = contenu du commit documentaire enregistré ;
- aucune modification locale de code en attente ;
- **version installée** de l'outil et des hooks = celle du manifeste (§2.4).

Une modification après livraison **périme** le reçu. Relancer `livrer`
actualise ; sans changement, aucun nouveau commit — la commande est rejouable
sans effet de bord.

> **Ce que ça ne garantit pas** : que l'agent ait écrit *toutes* les notes
> nécessaires. Seulement que **les notes écrites sont conservées et associées
> au bon code**. La complétude éditoriale reste une revue humaine.

### `integrer` — deux rythmes qu'il ne fallait pas coupler

⚠️ **Défaut de conception de la v5, relevé à l'usage** : rien n'avançait jamais
le `main` documentaire. `fermer` retire le worktree sans rien fusionner, et
`ouvrir` part de `HEAD` du dépôt documentaire. Un chantier ouvert **après** la
livraison d'un autre repartait donc de l'import, sans voir son travail — **la
capitalisation ne marchait pas.**

La cause : deux rythmes couplés sans raison.

| | Rythme réel |
|---|---|
| Le **code** rejoint `main` | rarement, par lots de plusieurs chantiers, avec un numéro de version décidé |
| Les **notes** d'un chantier sont valides | dès que le reçu passe |

Faire attendre les secondes sur le premier les fige pour des semaines.
`integrer` avance donc le `main` **documentaire seul**, exige un reçu valide, et
**laisse le chantier ouvert** — `fermer` garde sa condition stricte sur la
conservation du code, qui est un autre sujet.

- **Joignabilité du distant contrôlée AVANT la fusion**, jamais après :
  l'invariant visé est « intégré ⇒ sauvegardé ». Fusionner puis découvrir qu'on
  ne peut pas pousser laisserait la référence avancée localement et nulle part
  ailleurs.
- **En conflit, la fusion est ANNULÉE** et la référence ne bouge pas. On tente
  la fusion et on ne refuse **que si git échoue** : un merge Markdown sur des
  passages différents est fiable, et refuser d'office rendrait la commande
  inutile dans le cas fréquent.
- **Le reçu des autres chantiers reste valide** : c'est le `main` documentaire
  qui avance, pas leur branche. Sinon le rythme de l'un imposerait le sien à
  tous.

> ⚠️ `git merge` n'accepte **pas** `-F -` — contrairement à `commit`, il ne lit
> pas l'entrée standard (« could not read file '-' »). D'où un fichier de
> message, et non un `-m` que ce dépôt proscrit.

### `fermer` — « livré » ne veut pas dire « intégré »

Refuse le nettoyage tant que :

- la livraison n'est pas valide ;
- la **sauvegarde distante** ne porte pas les références attendues — *reçus
  compris*, placés dans une zone privée versionnée **distincte des notes** :
  sauvegarder les seuls commits documentaires perdrait leur association au
  code. Hors ligne ⇒ le chantier **reste ouvert**, sans exception ;
- le **commit de code** n'est pas soit intégré, soit **archivé explicitement**.
  Une branche documentaire sauvegardée n'autorise pas la disparition du seul
  exemplaire du travail de code.

**Nettoyage — deux cas distincts, vérifiés :**

```
git worktree remove .                  → fatal: '.' is a main working tree
git worktree remove <verrouillé>       → fatal: cannot remove a locked working tree
git worktree remove -f <verrouillé>    → fatal: … use 'remove -f -f' to override
git worktree remove --force --force    → supprimé
```

Le worktree **principal** ne se supprime pas par `git worktree remove` : le
nettoyage traite séparément le dossier principal et les worktrees temporaires.
Le verrouillage (`git worktree lock` pendant le chantier, déverrouillage par
`fermer` après contrôle) exige **deux** `--force` pour être outrepassé — un
`-f` réflexe ne suffit pas. Garde-fou contre l'erreur ordinaire, explicitement
contournable : le bon niveau.

## 5. Contrat de travail entre les deux agents

### Ouvrir un chantier — la séquence complète

⚠️ **Créer le worktree ne suffit pas** : sans `ouvrir`, le chantier n'est pas
enregistré et les notes privées ne sont pas copiées. Une première version de
cette séquence s'arrêtait à `npm ci` — elle était incomplète.

```powershell
git worktree add ../sw-forge-codex -b forge/<sujet> forge/orchestration-parallele
Set-Location ../sw-forge-codex
npm ci

$gitCommun = git rev-parse --path-format=absolute --git-common-dir
$outil = Join-Path $gitCommun 'forge/installation/scripts/chantier.mjs'
node $outil ouvrir --chantier <sujet>
```

Puis ouvrir la session de l'agent **dans ce dossier**, attribuer un chantier
distinct à chacun, et désigner l'intégrateur.

> ⚠️ **Prérequis à valider pour Codex : les droits sur les dépôts hors
> workspace.** Un appel réel à `verifier` depuis la sandbox Codex a échoué sur
> `dubious ownership` — le dépôt documentaire appartient à l'utilisateur, tandis
> que l'exécution se fait sous un autre compte. **Ce n'est pas un reçu invalide,
> c'est un blocage git**, et la distinction compte : un outil qui échoue pour une
> raison d'environnement ne dit rien sur la validité de la livraison. À traiter
> par un `safe.directory` explicite pour le dépôt documentaire et ses worktrees,
> plus les droits d'écriture correspondants. **Non fait** : c'est un réglage de
> l'environnement de l'utilisateur, pas du dépôt.

| | Claude Code | Codex |
|---|---|---|
| Dossier | `sw-forge/` | `sw-forge-codex/` |
| Branche | `forge/<A>` | `forge/<B>` |
| Fichiers | globs explicites, **disjoints** | globs explicites, **disjoints** |
| Transverses | responsable désigné au lancement | — |
| Port dev | 5173 | 5174 (`npm run dev -- --port 5174`) |

Trois règles permanentes :

- **Aucun agent ne touche `main`** sans que `main` soit nommé explicitement.
- **Pas de mesure de perf pendant que l'autre tourne.**
- **Un chevauchement se signale et se redécoupe**, il ne se force pas.

## 6. Plan de construction

*Le premier livrable est le cycle `ouvrir → livrer → verifier`, éprouvé sur des
dépôts jetables. Les hooks et la suppression automatique viennent ensuite : ils
doivent s'appuyer sur une conservation de données déjà démontrée.*

### 6.1 Préserver l'existant, créer le dépôt documentaire — ✅ **FAIT**

⚠️ Cette étape exigeait une pause des écritures sur les notes — le seul moment
du dispositif où l'exclusion mutuelle est réellement nécessaire, et elle est
humaine.

| Étape | Résultat |
|---|---|
| Inventorier les notes dans **les deux espaces de travail** | **un seul exemplaire** (41 fichiers, 2,8 Mo) — le worktree secondaire n'en avait aucun, donc aucune divergence à réconcilier |
| Sauvegarder avant rapprochement | copie de sûreté hors des deux dépôts, `diff -rq` identique |
| Créer `sw-forge-docs` + première révision | `287169c` |
| Remote **privé** | `enzoputzulu/sw-forge-docs`, visibilité **contrôlée après création** (`isPrivate: true`) |
| **Vérifier la restauration** | ❌ **échouée d'abord**, puis ✅ après correction (ci-dessous) |
| Junction `node_modules` de `sw-forge-pair-order` | retirée **en tant que lien** après vérification de sa cible ; les 185 Mo du dépôt principal recomptés intacts ; worktree et branche supprimés (fusionnés dans `main`, vérifié) |

> ⚠️ **Ce que la vérification par restauration a attrapé — et que rien d'autre
> n'aurait vu.** Le premier import a été commité **avant** le `.gitattributes` :
> `core.autocrlf=true` a normalisé en LF **dix fichiers qui portaient des
> CRLF**. Le clone de contrôle rendait un contenu *logiquement* identique, mais
> pas **octet pour octet**.
>
> Corrigé par `* -text` puis `git add --renormalize` (`a1254d0`), sur un
> répertoire de travail vérifié intact au préalable. Deuxième restauration :
> `diff -rq` vide et **même empreinte agrégée** des 41 fichiers.
>
> **Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde** —
> celle-ci était fausse pendant quelques minutes, sans le moindre signe.

⚠️ **Reste à faire sur ce point** : le dépôt documentaire n'a **pas encore de
worktree par chantier** (§2.2), et les notes vivent toujours dans le dépôt de
code comme avant. La migration vers le fonctionnement cible commence à §6.2.

### 6.2 Construire l'outil — premier lot ✅ **FAIT**

Branche `forge/orchestration-parallele`. **Pas de worktree séparé** : sa raison
d'être est le travail à deux agents, et un seul travaillait — 185 Mo et deux
minutes pour zéro bénéfice. La branche part de la base courante, sans déplacer
les changements ouverts.

| Commande | État |
|---|---|
| `ouvrir` | ✅ registre, worktree documentaire **verrouillé**, copie à une révision notée |
| `livrer` | ✅ report (ajouts/modifications/**suppressions**), contrôle d'égalité, commit, reçu |
| `verifier` | ✅ six contrôles, tous devant tenir **ensemble** |
| `installer` | ✅ copie hors arbre de travail + **manifeste de version**, câblage préexistant signalé et jamais écrasé |
| `fermer` | ✅ reçu valide **et** sauvegarde distante effective **et** code intégré ou archivé |

> ✅ **Le défaut nommé au §4 est refermé** — à condition d'installer. Tant que
> `installer` n'a pas tourné sur une machine, l'outil y tourne depuis
> `scripts/`, donc depuis la branche checkoutée. `verifier` le **dit** au lieu
> de le taire : une absence d'installation n'est pas un échec (un clone neuf
> n'en a pas), une installation **altérée** en est un.

**Un défaut trouvé par l'essai, pas par relecture** : `commitDoc` prenait la
tête de la branche documentaire, qui inclut le commit du reçu — chaque
livraison différait donc de la précédente et créait un commit de plus.
L'idempotence annoncée était fausse. `commitDoc` est désormais le dernier
commit qui **touche les notes**.

### 6.3 Tester le cycle sur des dépôts jetables

Les tests portent sur **les pertes possibles**, pas sur le cas nominal.
`tests/chantier.test.ts` (**37 assertions**, enregistré sous `testChantier`)
crée lui-même ses dépôts jetables — y compris un distant nu pour éprouver la
sauvegarde. **9 scénarios sur 11 sont couverts** :

| Scénario | État |
|---|---|
| ajout, modification et **suppression** de notes | ✅ |
| **dossier absent** (≠ dossier vidé) | ✅ — et rien n'est supprimé côté documentaire |
| modification documentaire indépendante, **commitée** et **non commitée** | ✅ |
| **interruption après le commit documentaire, avant le reçu** | ✅ le chantier se rejoue sans perte |
| seconde livraison identique (idempotence) | ✅ |
| reçu périmé · code non commité | ✅ |
| installation **altérée** détectée, réinstallation réparatrice | ✅ |
| sauvegarde indisponible | ✅ `fermer` refuse et laisse le chantier ouvert |
| fermeture refusée **sans perte** (code ni intégré ni archivé) | ✅ le worktree documentaire survit au refus |
| le **hook** : `main`, chemin privé, fichier démesuré, et la spec produit qui passe | ✅ éprouvé **tel qu'il s'exécute** (installé et câblé), pas le fichier source |
| deux chantiers issus de la même base, intégrés successivement | ✅ `testChantierDeuxChantiers`, second chantier dans un **worktree secondaire** |
| **clone neuf** (§0) | ✅ **vérifié pour de vrai**, voir ci-dessous |

**Les 11 scénarios sont couverts.**

> ⚠️ **Le point décisif du scénario à deux chantiers** : B part de la même base
> documentaire que A et ne voit pas son travail. Sans branche documentaire
> séparée, la livraison de B ramènerait la note de A à la base — une perte
> **sans conflit ni message**. Le test vérifie aussi que le second chantier
> fonctionne depuis un **worktree secondaire**, où `.git` est un FICHIER : un
> `.git` supposé dossier dupliquerait le registre par worktree, en silence.

### Le critère §0, vérifié pour de vrai

Clone réel dans un dossier temporaire, sans installation ni dépôt documentaire :

| Étape | Résultat |
|---|---|
| `core.hooksPath` hérité | ✅ absent |
| installation / notes privées héritées | ✅ absentes |
| `npm ci` | ✅ 8,1 s |
| `npx tsc --noEmit` | ✅ 8,5 s |
| **suite complète** (`node tests/run.mjs`) | ✅ **90,2 s** |
| `npm run build` | ✅ 9,2 s |
| un commit | ✅ passe (aucun hook, puisqu'aucun câblage) |

> ⚠️ **Deux faux échecs avant celui-là, tous deux dus au harnais et non au
> dépôt** : sous Windows `npm` est `npm.cmd`, qu'`execFile` ne trouve pas
> (ENOENT), puis Node 24 **refuse** de lancer un `.cmd` sans `shell: true`
> (EINVAL, durcissement CVE-2024-27980). Quatre étapes échouaient pour cette
> seule raison. Un outil de mesure se vérifie avant de croire ce qu'il mesure.

> ⚠️ **Un piège de méthode rencontré ici** : monté sur `main`, le commit de
> travail est trivialement un ancêtre de `main`, donc « intégré » — et le refus
> de `fermer` ne pouvait pas être mis à l'épreuve. Le test monte donc le
> chantier sur une **branche**, comme dans la vraie vie. Un scénario qui ne peut
> pas échouer ne vérifie rien.

⚠️ **Les tests utilisent de fausses notes, jamais les documents privés réels.**

Ces vérifications s'enregistrent dans `tests/index.ts` — premier cas concret de
la règle §2.3 : un **ajout** dans un fichier transverse, porté par le
responsable désigné du chantier.

> ⚠️ **Et c'est précisément là que §0 mord.** Enregistrer ces tests dans
> `tests/index.ts` les met dans `npm test`, donc dans le chemin d'un clone
> neuf. Ils doivent donc **créer eux-mêmes leurs dépôts jetables** et ne
> dépendre ni de l'installation, ni du dépôt documentaire, ni d'un remote — ou
> bien **se déclarer non applicables** proprement plutôt qu'échouer. Un test
> qui casse `npm test` sur une machine sans orchestration viole le critère
> d'acceptation aussi sûrement qu'un hook obligatoire.

### 6.4 Installer une version validée, puis activer les hooks — ✅ **FAIT**

```
sw-forge/.git/forge/
  installation/     outil et hooks installés, + manifeste de version
  etat/             registre local des chantiers
```

Chemin calculé depuis `git rev-parse --git-common-dir` — jamais d'un `.git`
supposé être un dossier dans chaque worktree, ce qu'il n'est pas dans un
worktree secondaire.

Installé sur cette machine depuis `forge/orchestration-parallele @ 86be996` :

```
core.hooksPath = C:\Users\Enzo\Desktop\sw-forge\.git\forge\installation\hooks
```

⚠️ **Réversible en une commande** : `git config --unset core.hooksPath` rend le
dépôt à son comportement d'origine, sans rien perdre. Et le hook reste
contournable au cas par cas (`git commit --no-verify`).

⚠️ **À refaire après toute modification du hook ou de l'outil** :
`node scripts/chantier.mjs installer`. L'installation ne se met pas à jour
toute seule — c'est délibéré (§2.4) — et `verifier` signale une installation
**altérée**, pas une installation **périmée** par rapport à une branche.

### 6.5 Un chantier pilote — ✅ **fait sur les vraies notes**

Chantier `orchestration-parallele`, sur les 41 fichiers réels :

| Étape | Résultat |
|---|---|
| `ouvrir` | worktree documentaire créé et **verrouillé** ; notes locales reconnues identiques à la base |
| `livrer` | reçu `recus/orchestration-parallele.json`, code `f3b41f9` ↔ notes `a1254d0` |
| `verifier` | **8 contrôles ok**, dont l'intégrité de l'installation `@ 86be996` |
| sauvegarde | branche poussée, présence sur le distant **contrôlée** par `ls-remote` |
| `fermer` | ❌ **refuse** — le code n'est ni intégré dans `main`, ni archivé |

Le refus de `fermer` est le comportement voulu, éprouvé ici sur des données
réelles : le worktree documentaire est resté intact (21 entrées), et le chantier
reste ouvert tant que le travail de code n'est pas conservé quelque part.

> ⚠️ **Ce que le pilote n'a PAS exercé, et pourquoi.** Le scénario prévoyait
> « une petite modification réelle avec une note privée ». Il n'y avait aucune
> note privée légitime à écrire — ce chantier-ci est public, il vit dans ce
> document. Inventer une note pour cocher la case aurait été exactement le genre
> de vérification de façade contre lequel tout ce dispositif est construit. La
> modification d'une note reste donc couverte par le test sur dépôts jetables,
> pas par le pilote.

**Reste à faire** : appliquer le dispositif à un chantier Optimizer réel, celui
où des notes privées sont effectivement écrites.

## 7. Local History (extension VS Code) — testé, hors sujet, mais une fuite

**Test fait : l'extension ne capture pas les écritures d'un agent.** Trois
écritures par le terminal puis une par l'outil d'écriture ; `.history/`
contient toujours les mêmes 3 fichiers, tous issus de sauvegardes faites dans
l'éditeur. C'est un annuler-par-fichier rétrospectif, pas un mécanisme de
coordination.

**En revanche elle ouvrait une fuite, désormais colmatée.** Les règles du
`.gitignore` sont ancrées à la racine, donc `spec/outils/optimizer/` ne
couvrait pas `.history/spec/outils/optimizer/…` : une sauvegarde dans l'éditeur
déposait une copie de la spec privée **hors protection**, qu'un `git add -A`
aurait poussée vers un dépôt **public**.

`.history/` et `.vscode/` sont maintenant ignorés (`.gitignore:72-84`), vérifié
par `git check-ignore`. Second effet voulu : ripgrep respectant `.gitignore`,
les copies périmées sortent aussi des recherches.

*C'est précisément la règle n°2 du hook (§2.4).*

## 7 bis. Ce qui est IMPOSÉ, et ce qui reste une consigne

*La distinction décide de ce à quoi on peut se fier sans surveiller.*

| Protection | Aujourd'hui |
|---|---|
| Séparation des fichiers de code | ✅ **imposée** — worktrees |
| Refus d'un commit sur `main`/`master` | ✅ **imposée** — hook installé |
| Refus d'un chemin privé, d'un fichier > 5 Mo | ✅ **imposée** — hook installé |
| Chantier lancé depuis le mauvais worktree ou la mauvaise branche | ✅ **imposée** — contrôle d'identité |
| Conservation des notes, validité du reçu | ⚠️ imposée **quand la commande est appelée** |
| Vérifier avant d'intégrer | ✅ pour les formes Git usuelles détectées par le hook Codex approuvé ; consigne pour les chemins indirects |
| Responsable des transverses, créneau de benchmark | ❌ **consigne** |

**La liaison automatique Codex est implémentée** dans `scripts/hooks-codex.mjs`.
Elle nécessite une installation personnelle et l'approbation des définitions
dans `/hooks`. Le hook Git reste indépendant. Principes :

1. **Des hooks d'agent** — Claude Code (`PreToolUse`) et Codex
   (`SessionStart`, `PreToolUse`, `Stop`) en ont chacun. Trois contrôles, actifs
   pour les seules sessions orchestrées : au démarrage, vérifier l'installation,
   les accès documentaires et l'association session → worktree → branche →
   chantier ; avant l'action, refuser une intégration sans reçu valide ; en fin
   de livraison, réclamer ce qui manque — **avec une sortie explicite**, sous
   peine de boucle. ⚠️ Ces hooks doivent **réutiliser la logique de `chantier`**,
   jamais en réimplémenter une seconde qui divergera.
2. **Rien de plus.** Un hook d'agent reste un garde-fou, pas une frontière : il
   se contourne. Ce qu'il apporte, c'est un contrôle **au moment de l'action**,
   qui ne dépend pas de la mémoire qu'un agent a des consignes.

⚠️ **Correction d'une affirmation antérieure** : « Codex n'a pas de système de
hooks » était **faux**, et l'écrire a orienté tout l'étage 1 vers le hook git.
Le hook git reste justifié — c'est le seul point commun sans configuration
partagée — mais il n'était pas le seul choix possible. L'activation des hooks
Codex est disponible dans le client local 0.153.0 (`hooks`, stable, activé).
La confiance dans les nouvelles définitions reste une action de l'utilisateur.

### Hooks Codex : contrat et installation

`chantier installer --codex-hooks <hooks.json personnel>` copie l'adaptateur
dans l'installation commune et ajoute quatre événements sans supprimer les
hooks tiers ni dupliquer une installation identique. Le fichier préexistant
est sauvegardé à côté. Aucun hook n'est installé par `npm ci` ; aucun fichier
de configuration Codex n'est imposé au clone d'un contributeur.

- `SessionStart` injecte l'identité du chantier et les commandes de livraison.
- `UserPromptSubmit` enregistre la base du tour et lève la pause du tour précédent.
- `PreToolUse` (Bash et apply_patch) appelle `chantier contexte-hooks` : identité,
  intégrité de l'installation, câblage Git, accès documentaire en lecture.
  Un contrôle impossible est explicitement distingué d'un reçu invalide.
- `Stop` compare l'état du chantier à la base du tour. S'il a changé, il appelle
  le vrai `chantier verifier`. Une livraison manquante provoque au plus une
  continuation ; si le problème persiste, un avertissement conserve le chantier
  ouvert. Une pause avec motif est possible et n'autorise aucune intégration.

Les reçus, comparaisons d'identité et empreintes restent dans `chantier.mjs`.
L'adaptateur utilise des sous-processus, afin d'isoler les refus CLI et de
renvoyer du JSON Codex valide. Il ne copie ni ne commite aucune note.

Pour une commande reconnue `git merge`, `git rebase` ou `git cherry-pick`
(avec éventuellement `git -C`), le hook vérifie **toutes les autres contributions
ouvertes** depuis leurs worktrees respectifs. C'est conservateur : un chantier
non livré peut bloquer une intégration sans rapport. Les alias, scripts,
commandes construites et autres formes indirectes ne sont pas analysés. Ce
contrôle ne prétend ni parser tout shell ni fournir une exclusion mutuelle.
Les contributions doivent rester stables pendant leur intégration.

Le hook personnel ne s'applique qu'au dépôt dont il est l'installation et aux
worktrees enregistrés. L'état par session (identifiant haché) vit dans
`.git/forge/etat/sessions-codex/`. Il ne contient pas les textes des notes.
Les droits d'écriture documentaires ne sont pas testés par une écriture de
sonde ; la sandbox doit toujours être configurée séparément.

Tests : `node tests/run.mjs chantier hookscodex`. Ils utilisent uniquement des
dépôts jetables et des événements JSON : contexte, absence d'effet hors chantier,
conservation de hooks tiers, pause, anti-boucle, changement de branche,
intégration avec/sans reçu et installation altérée. Le déclenchement dans une
vraie session Codex nécessite l'approbation utilisateur dans `/hooks`.

## 8. Ce qui reste faible

1. **La complétude éditoriale des notes n'est pas vérifiable.** L'outil
   garantit que ce qui est écrit est conservé et bien associé ; pas que
   l'essentiel ait été écrit.
2. **Aucune atomicité entre les deux dépôts.** Le reçu est vérifiable, pas
   transactionnel : une interruption laisse le chantier **ouvert** —
   rejouable, mais ouvert.
3. **Un hook non installé ou non approuvé ne s'exécute pas.** Le contrôle
   de contexte détecte une installation absente ou altérée quand il est appelé ;
   l'approbation des hooks reste une étape explicite.
4. **Aucun mécanisme n'empêche le conflit sémantique** : deux agents sur des
   fichiers disjoints peuvent produire deux moitiés incohérentes. Seules la
   découpe et l'intégration protègent, et elles sont humaines.
5. **L'outil et les hooks existent**, mais les formes d'intégration indirectes
   et la coordination des benchmarks restent hors des contrôles automatiques.

## 9. Journal des arbitrages

| Proposition | v1 | v2 | v3 | v4 | v5 | Raison du dernier changement |
|---|---|---|---|---|---|---|
| Worktrees + périmètres disjoints | ✅ | ✅ | ✅ | ✅ | ✅ | jamais contesté |
| `npm ci` par worktree | junction | ✅ | ✅ | ✅ | ✅ | 185 Mo contre un piège armé en permanence |
| Verrous de fichiers | proposé | ❌ | ❌ | ❌ | ❌ | sans intersection de périmètres, rien à verrouiller |
| Interdiction des transverses | ✅ | ✅ | ❌ | ❌ | ❌ | `CLAUDE.md:26` exige `App.tsx` dans le même commit |
| Catégorie « ajout seul » | — | ✅ | ❌ | ❌ | ❌ | deux ajouts fusionnés peuvent enregistrer deux fois le même test |
| Dépôt documentaire séparé | ✅ | ❌ | ✅ | ✅ | ✅ **+ worktree par chantier** | une branche seule se fait changer sous les pieds de l'autre livraison |
| Junction sur la spec privée | — | ✅ | ❌ | ❌ | ❌ | ce qui change est le nombre d'auteurs, pas l'historique |
| Hook/outil : installation | — | relatif | absolu « non versionné » | source + installation | ✅ **+ manifeste de version propre** | comparer l'installé au source de la branche courante recrée l'incompatibilité entre branches |
| Report des notes | checklist | checklist | checklist | `livrer` + reçu | ✅ **+ 3 refus anti-perte** | un dossier absent ne doit jamais devenir une suppression totale |
| `fermer` | — | — | — | valide la livraison | ✅ **+ code intégré ou archivé** | « livré » ne veut pas dire « intégré » : sinon on supprime le seul exemplaire du code |
| Sauvegarde des reçus | — | — | — | — | ✅ **nouveau** | sauvegarder les seuls commits documentaires perd leur association au code |
| Verrouillage des worktrees | — | — | — | ✅ | ✅ **corrigé : `-f -f`** | testé : un seul `-f` ne suffit pas — le garde-fou est plus solide qu'annoncé |
| Plan de construction | — | — | — | — | ✅ **nouveau** | le cadrage est clos ; ce qui reste est de l'exécution |
| **Critère d'acceptation « clone neuf »** | — | — | — | — | ✅ **nouveau (§0)** | garantit que l'outillage ne devienne jamais une dépendance du dépôt — et corrige au passage l'enregistrement des tests dans `tests/index.ts` |

## 10. Décisions prises

Les questions ouvertes des versions précédentes sont tranchées :

- **Remote privé pour le dépôt documentaire : oui, dès le départ.** Il ferme la
  question de la sauvegarde et rend `fermer` vérifiable plutôt que déclaratif.
- **Intégrateur : désigné au lancement**, selon sa connaissance des interfaces
  concernées — pas celui qui termine en second.
- **Ordre de construction : §6**, dépôt documentaire d'abord, hooks en dernier.
- **Diffusion des consignes : par la branche, pas par une fusion dans `main`.**
  Le dispositif est résumé dans [CLAUDE.md](CLAUDE.md), chargé à chaque
  session — et `AGENTS.md` y renvoie, donc Codex l'a aussi. **Toute nouvelle
  branche part d'une branche qui le porte.** Sans ça, un agent qui démarre
  ailleurs ne voit ni la consigne, ni `chantier`, ni le hook source — seul le
  hook *installé* continue de le protéger, sans qu'il sache pourquoi.
  ⚠️ Le chemin de l'outil se **calcule** (`git rev-parse --git-common-dir`),
  il ne s'écrit pas en dur : dans un worktree secondaire, `.git` est un
  fichier. Écrit en dur une première fois dans `CLAUDE.md`, cette commande
  était fausse — et le vrai chemin porte `scripts/`.

Reste une seule question, qui n'est pas technique : **le parallélisme
justifie-t-il ce coût, maintenant qu'il inclut la construction de
`chantier` ?** Fait vérifiable : un second worktree tourne **déjà**. La
question n'est donc pas « faut-il commencer » mais « faut-il encadrer ce qui
existe » — et §6.1 se justifie de toute façon seul, puisqu'il colmate une
junction armée et un dossier de 2,8 Mo sans aucune sauvegarde.
