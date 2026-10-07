# Outillage des specs — natures, `spec-toc`, `spec-lint`

**Statut :** ÉTAT ACTUEL — décrit la frontière entre public et privé, les natures de documents de `spec/`, le parseur `spec-markdown`, `spec-toc`, le contrat de `spec-lint`, les en-têtes, le critère des invariants et les niveaux d'application (hook `Read`, `pre-commit` et installation des garde-fous compris)
**Lire si :** on modifie `scripts/spec-lint.mjs`, `scripts/spec-toc.mjs`, `scripts/lib/spec-markdown.mjs`, `spec/spec-lint.json`, le hook `Read`, le hook `pre-commit`, `scripts/installer-hooks.mjs` ou le skill `spec-hygiene` ; on crée, déplace, archive ou découpe une spec ; on se demande si un texte a sa place dans le dépôt public
**Ne pas lire si :** on ouvre une spec pour son contenu — `node scripts/spec-toc.mjs <fichier>` suffit
**Voir aussi :** `spec/outillage/renvois.md` (garde-fou des renvois), skills `spec-hygiene` et `cadrage-chantier`

Ce fichier décrit les règles qui s'appliquent aux documents de `spec/` et les
outils qui les vérifient. Le code fait foi : quand une règle ci-dessous et
`scripts/spec-lint.mjs` divergent, c'est le script qui dit ce qui est refusé.

## Public et privé

Le dépôt est public : tout fichier suivi par Git l'est, et **tout `spec/`
l'est**. Un texte y a sa place quand il **décrit l'actuel** (comportement,
règle, contrat d'un outil) **ou explique comment le modifier** (recette,
conduite à tenir, écueil connu).

Le reste vit dans les **notes privées du projet**, un dépôt séparé, non
publié : méthode de travail et outillage d'orchestration, cadrages pilotés
avec cet outillage, preuves, archives, historique et récits, mesures,
délibération des décisions, exports de compte.

- **Le public ne renvoie jamais au privé** : ni lien, ni chemin, ni nom de
  note. Une information utile au public y est réécrite ; sinon elle reste
  privée sans être citée. Vérifié par `tests/renvois.test.ts`
  (`spec/outillage/renvois.md`) et, dans le dossier de l'Optimizer, par le
  `pre-commit` (« Refus du `pre-commit` »).
- **Règles d'écriture du public** : aucune date de décision (une date qui a
  un sens dans le jeu reste) ; aucun cheminement, sauf l'écueil qu'un
  contributeur réessaierait, en une ligne avec sa raison ; aucun identifiant
  de lot ; jamais « décision de l'utilisateur ». La provenance d'une valeur
  de jeu (relevé en jeu, déduction) reste. Ces règles se vérifient en revue :
  seul le `pre-commit` refuse un identifiant de lot, et seulement dans le
  dossier de l'Optimizer.
- Un passage retiré du public pour ces raisons est rangé dans les notes
  privées s'il doit être gardé ; l'historique Git garde de toute façon le
  texte retiré.

## Natures de documents et règles de forme

Quatre natures, que `spec-lint` reconnaît au champ `Statut :` de l'en-tête :

| Nature | Rôle | Lu quand | Où |
| --- | --- | --- | --- |
| **État actuel** | normatif, à jour | au démarrage, **par section** | racine de la zone |
| **Décision** | conclusion **encore en vigueur** qu'un chantier peut devoir rouvrir, avec sa raison ; la délibération qui y a mené reste privée | quand on touche ce qui a été décidé | dossier `decisions` de la zone |
| **Chantier** | cadrage public d'un chantier, « en cours » puis « terminé » ; un chantier privé n'a pas de document public | par section, selon le lot | sous un dossier `chantiers/` |
| **Archive** | document qui n'est plus une source de vérité active | jamais par défaut | dossier `archive` |

Le critère de rangement d'un document est la deuxième colonne, pas son
genre : une analyse dont la conclusion vit dans une synthèse est une
archive ; une synthèse dont la conclusion est encore appliquée est une
décision.

La nature **Archive** n'a plus de place dans le public : historique,
preuves et récits sont privés. Archiver, c'est **retirer le document du
public et le ranger dans les notes privées**. `spec-lint` garde un régime
pour un dossier `archive` qui subsisterait sous `spec/` (seul l'en-tête
`ARCHIVE` exigé) ; un tel dossier est à vider, pas à remplir.

Règles de forme — **deux régimes**, ceux qu'implémente `spec-lint` :

- **Documents actifs** (état actuel, décisions, chantiers, README, index) :
  1. **bloc terminal ≤ 80 lignes**, objectif de rédaction ; refus au-delà
     de **100** (définition dans « Contrat de `spec-lint` ») ;
  2. **en-tête selon la nature** (« En-têtes par nature, slugs uniques ») ;
     les douze premières lignes suffisent à décider de lire ou non ;
  3. **fichier ≤ 500 lignes**, hors exceptions déclarées et hors dossier
     `chantiers/`. Un fichier trop long se découpe **quand un chantier doit
     modifier son contenu normatif** — pas pour une faute, un lien ou un
     en-tête ;
  4. **slugs de titres uniques** dans le fichier, pour que `fichier §
     section` désigne une seule chose.
- **Dossier `archive`** : seul l'en-tête `**Statut :** ARCHIVE` est exigé ; ni
  longueur, ni unicité — une archive ne se découpe pas.

## Déplacer, archiver ou découper un document

Le contrat ; les recettes pas à pas sont dans le skill `spec-hygiene`.

- **Déplacer** entre natures : `git mv` (l'historique suit le fichier),
  en-tête de la nature cible, puis repointage des renvois.
- **Archiver** : copier le document dans les notes privées, puis le retirer
  du dépôt ; chaque renvoi public qui le visait est réécrit ou supprimé,
  jamais laissé vers un fichier absent (`tests/renvois.test.ts` le refuse).
- **Repointer** : le motif cherché est le **nom de fichier complet avec
  extension** (`ancien-nom.md`, jamais un préfixe), sur `src/`, `scripts/`,
  `tests/`, `spec/`, `.claude/` et `.agents/`. Un script liste d'abord les
  occurrences **sans écrire** ; la réécriture vient ensuite, et le diff est
  relu hunk par hunk avant le commit : chaque hunk ne change qu'un chemin.
- **Découper** un fichier en exception : le jour où un chantier doit changer
  son contenu normatif, avant tout ajout (« Périmètre et exceptions »).

## Sous-titrer un fichier, parseur `spec-markdown`

Un bloc terminal trop long se résorbe d'abord en posant des sous-titres :

- **n'ajouter que des lignes commençant par `#`** ; aucun mot modifié,
  déplacé ou supprimé ;
- hiérarchie propre : **aucun saut de niveau** (pas de H4 directement sous
  un H2), chaque titre décrit le bloc jusqu'au prochain titre de niveau
  égal ou supérieur ; les titres reprennent les libellés du jeu ou de
  l'écran ;
- aucune **ancre** dupliquée : contrôle par le slug, pas seulement par le
  texte du titre.

Le parseur partagé vit dans `scripts/lib/spec-markdown.mjs`. **Une seule
implémentation dans le dépôt** : `spec-toc`, `spec-lint` et le
`pre-commit` (via `spec-lint`) l'importent ; aucun script ni hook n'en
garde une copie. Toute fonction ajoutée au `.mjs` est déclarée dans le
sidecar `spec-markdown.d.mts`, pour `tsc`, dans le même commit.

- `titres(texte)` : lignes `^#{1,6}` suivies d'une espace, **hors bloc de
  code clôturé** (```` ``` ```` ou `~~~`).
- `slug(titre, compteurs)` : l'algorithme de `github-slugger` —
  minuscules ; suppression de tout caractère qui n'est ni lettre Unicode, ni
  chiffre, ni espace, ni `-` (les accents sont **conservés**) ; espaces →
  `-` ; doublons suffixés `-1`, `-2` dans l'ordre du fichier. La `Map` des
  compteurs est **fournie par l'appelant**, une neuve **par fichier** :
  partagée, elle ferait fuir les suffixes d'un fichier à l'autre.
- `sections`, `enTete` : voir « `spec-toc` » ; `blocsTerminaux`,
  `referencesSection` : voir « Contrat de `spec-lint` ».
- `fichiersMarkdown(chemin)` : un fichier, ou tous les `.md` d'un dossier,
  récursivement, hors `node_modules/` et `.git/`, triés.

Tests : `tests/spec-markdown.test.ts` (`node tests/run.mjs specmarkdown`),
contre des titres réels du dépôt (`tests/fixtures/spec-markdown/` : accents,
ponctuation, backticks, doublons).

## `spec-toc`

`node scripts/spec-toc.mjs <fichier|dossier> [--json]` imprime, par
fichier : l'en-tête (statut, lire si), puis chaque titre avec **niveau,
plage de lignes, première phrase**. C'est la façon d'ouvrir une spec
(`CLAUDE.md`, « La spec avant le code ») : le sommaire, puis la section
utile.

- **titre** : celui de `titres()` ;
- **plage** : du titre inclus à la ligne précédant le prochain titre de
  niveau **≤** au sien, ou la fin du fichier ;
- **première phrase** : premier paragraphe de prose de la section, avant son
  premier sous-titre, hors lignes vides, blocs de code et tableaux ; un item
  de liste compte comme prose et **termine le paragraphe** (marqueur
  `-`/`1.` conservé), sinon une liste sans ligne vide interne deviendrait
  la « phrase » entière : en tête, il forme à lui seul la phrase ; collé
  sans ligne vide à une ligne de prose, il s'y ajoute ; tronquée à 120 caractères ; `—` si la
  section n'a pas de prose avant son premier sous-titre ;
- **en-tête** : les lignes `**Champ :** valeur` entre le H1 et la première
  ligne qui n'en est pas une, **les lignes vides étant transparentes** (une
  ligne vide sépare toujours le H1 du premier champ) ; `statut` et `lireSi`
  valent les champs `Statut :` et `Lire si :`, ou `null` ;
- **en-tête absent** : pas une erreur pour `spec-toc` (`statut: null`, le
  sommaire est produit normalement) ; c'est `spec-lint` qui juge l'en-tête ;
- **mode dossier** : tous les `.md` du dossier (`fichiersMarkdown`) ;
- `--json` : `[{fichier, statut, lireSi, sections: [{niveau, titre, slug,
  debut, fin, premierePhrase}]}]`.

Tous les titres sont toujours imprimés, quel que soit leur nombre ; viser
un sommaire d'au plus 60 lignes pour un fichier de 2 000 est un objectif de
compacité pour qui écrit la spec, jamais une troncature de l'outil.

Tests : `tests/spec-toc.test.ts` (`node tests/run.mjs spectoc`), fixtures
synthétiques dans `tests/fixtures/spec-toc/` — titres imbriqués, fichier
sans H2, bloc de code contenant `#`, section vide, dernier titre du
fichier, en-tête, tableau, liste, troncature, fichier sans en-tête
normalisé, mode dossier avec sous-dossier et `node_modules/` ignoré — plus
`spec/outils/optimizer.md` réel : ses H2, et `--json` qui porte les mêmes
sections que `sections()`.

## Contrat de `spec-lint`

`node scripts/spec-lint.mjs [--json] [--en-tetes]` vérifie les fichiers du
périmètre et sort en code 1 s'il trouve une erreur. `--en-tetes` limite le
contrôle aux en-têtes, aux slugs et aux références ; `--json` imprime les
erreurs (`fichier`, `ligne`, `regle`, `message`). Le script exporte aussi
`verifier(racine, config, options)`, que le `pre-commit` et les tests
appellent.

### Bloc terminal et refus

- **Bloc terminal** : les lignes entre un titre (exclu) et le prochain titre
  de **n'importe quel niveau** (exclu), ou la fin du fichier ; le texte
  avant le premier titre (préambule) est un bloc. Lignes vides, tableaux et
  listes comptent : un tableau de 120 lignes est un bloc à découper ou à
  sortir dans un fichier dédié.
- **Refus hors d'un dossier `archive`**, par règle :
  - `entete` : en-tête absent, ou `Statut :` qui ne commence par aucune
    nature reconnue (`ÉTAT ACTUEL`, `DÉCISION`, `ARCHIVE`, casse ignorée) ;
    pour la nature Chantier, voir « La nature CHANTIER » ;
  - `slug-duplique` : deux titres du même fichier au même slug — GitHub
    suffixe `-1`, `-2`, une référence textuelle ne le dit pas ;
  - `reference-cassee` : une référence « fichier § section » vers un `.md`
    (champ `Source :`, mention en ligne ou texte d'un lien) qui ne résout
    pas vers un titre existant ;
  - `fichier-trop-long` : plus de 500 lignes, hors exception et hors
    `chantiers/` — lignes comptées par `split`, qui compte une ligne de
    plus qu'un `wc -l` pour un fichier terminé par un saut de ligne :
    500 lignes au `wc -l` sont refusées ;
  - `bloc-trop-long` : un bloc terminal de plus de 100 lignes, hors
    exception ;
  - `exception-perimee` : un fichier en exception qui ne dépasse plus aucun
    seuil.
- **Dossier `archive`** (`statut-archive`) : seule la présence d'un `Statut :` qui
  commence par `ARCHIVE` est exigée. `À préciser` dans un en-tête n'est
  jamais une erreur.
- **Résolution d'une référence** : le chemin cité se cherche relativement au
  fichier qui le porte, puis à la racine du dépôt, puis à `spec/` ; le
  premier qui existe gagne. La section se compare **par slug** aux titres de
  la cible.

### Périmètre et exceptions

`spec/spec-lint.json` est la **seule source de vérité** du périmètre :
`{ perimetre: [motifs], exceptions: [{ fichier, raison,
condition_de_suppression, chantier_responsable }] }`. Un motif `zone/**`
couvre la zone et tout ce qu'elle contient ; un fichier hors périmètre est
ignoré, pas même compté. Périmètre actuel : `spec/outils/**`,
`spec/chantiers/**`, `spec/outillage/**`. Une zone y entre quand tous ses
fichiers ont leur en-tête.

- Une exception exempte un fichier **des deux règles de longueur** (bloc et
  fichier), jamais des en-têtes, des slugs ni des références.
- Une exception dont le fichier repasse sous les deux seuils fait échouer
  le lint (`exception-perimee`) : la liste ne peut que décroître.
- On n'ajoute une exception que pour un fichier **préexistant** qui entre
  dans le périmètre, jamais pour un nouveau. Un tel fichier qui n'échoue
  que sur un ou deux blocs reçoit plutôt des sous-titres (« Sous-titrer un
  fichier ») ; au-delà, il entre en exception avec **le schéma complet** :
  `raison`, `condition_de_suppression` opérationnelle (« prochain chantier
  &lt;domaine&gt;, avant toute modification normative »),
  `chantier_responsable`. Jamais une refonte de contenu pour passer le lint.
- Le jour où un chantier doit modifier le contenu normatif d'un fichier en
  exception, il le **découpe d'abord** (skill `spec-hygiene`).

### La nature CHANTIER

Tout `.md` sous un dossier `chantiers/`, à toute profondeur, est de nature
Chantier ; le dossier fait foi, pas le périmètre déclaré. Deux formes de
`Statut :` **seules** reconnues, par une expression stricte, casse
ignorée : `CHANTIER en cours` et `CHANTIER terminé le AAAA-MM-JJ` (date
calendaire valide), chacune avec un suffixe `— <texte>` facultatif. La
nature est refusée hors d'un dossier `chantiers/`, et toute autre nature y
est refusée.

Un cadrage grossit avec les résultats de ses lots : la limite de 500 lignes
par fichier ne s'applique pas sous `chantiers/`. Cette exemption est codée
dans `scripts/spec-lint.mjs`, pas déclarée dans `spec/spec-lint.json` ; le
bloc terminal ≤ 100, les slugs uniques et la résolution des références
restent exigés.

### Références `§` vers un titre à lien ou parenthèse

`referencesSection` repère, hors bloc de code, chaque nom de fichier en
`.md` suivi de `§`, puis lit la section jusqu'à la fin de la ligne, un
`;`, ou un `)` ou `]` **sans ouvrant correspondant depuis le début de la
référence** — celui qui enveloppe toute la référence ou ferme le texte d'un
lien. Un titre qui
contient un lien Markdown, des parenthèses ou des backticks se cite donc tel
quel : la comparaison par slug neutralise la ponctuation. Une fixture
couvre chacun des trois cas. Seul un bloc de code clôturé est exclu : un
exemple écrit en ligne, même entre accents graves, est lu comme une
référence et doit résoudre.

### Cibles de test

Quatre vérifications, au sens fixe, dans `tests/spec-lint.test.ts`
(`node tests/run.mjs speclint`) :

| Vérification | Ce qu'elle lance |
| --- | --- |
| `testSpecLintEnTetes` | en-têtes, slugs et références, sur les fixtures de `tests/fixtures/spec-lint/` |
| `testSpecLint` | tout ce qui précède **plus** les longueurs et les exceptions, sur les mêmes fixtures |
| `testSpecLintEnTetesReel` | en-têtes, slugs et références sur `spec/outils/**` réel, archives comprises |
| `testSpecLintReel` | le lint complet sur le corpus réel, avec `spec/spec-lint.json` |

### Ce que le lint ne voit pas

- **Un défaut de rendu** : un texte en retrait de quatre espaces, que le
  Markdown affiche comme un bloc de code, ou une balise HTML écrite nue
  (`<liste>` sans accents graves), que le rendu avale. Ni `spec-lint` ni
  aucun test enregistré ne le relève : la relecture du rendu reste à
  faire à la main.
- **Un saut de niveau** de titre (H2 suivi d'un H4) : défaut de forme laissé
  à la revue.
- **Une exception dont le fichier n'existe pas** : `verifier` ne parcourt
  que les fichiers présents, une entrée orpheline de `spec/spec-lint.json`
  ne déclenche rien.
- Les champs d'en-tête autres que `Statut :` : leur présence se vérifie en
  revue.

## En-têtes par nature, slugs uniques

Un modèle par nature ; un champ qui serait artificiel pour la nature n'y
figure pas. Aucune date « de dernier commit » : Git la connaît, et un tel
champ serait faux au premier oubli. Une ligne vide sépare le H1 du premier
champ.

```markdown
# <Titre>                                   ← ÉTAT ACTUEL
**Statut :** ÉTAT ACTUEL — décrit <quoi>
**Lire si :** …
**Ne pas lire si :** …
**Voir aussi :** <fichier § section>, …
**Vérifié le :** AAAA-MM-JJ                 (optionnel : dernière relecture explicite)

# <Titre>                                   ← DÉCISION
**Statut :** DÉCISION — <la décision en une phrase>
**Remplace / remplacé par :** … (ou « — »)
**Exécution :** commit <sha> — vérifiée par <observation>   (si exécutée)
**Lire si :** …

# <Titre>                                   ← CHANTIER
**Statut :** CHANTIER en cours — branche forge/<sujet>
(ou CHANTIER terminé le AAAA-MM-JJ — branche forge/<sujet> ; autres champs facultatifs)

# <Titre>                                   ← ARCHIVE (régime du lint)
**Statut :** ARCHIVE — <provenance> ; conclusion reprise dans <fichier § section | À préciser>
```

Pour écrire un en-tête : les douze premières lignes du fichier,
`node scripts/spec-toc.mjs <fichier>`, et ses **liens entrants**
(`git grep -l <nom-de-fichier>`), qui disent qui le consulte et pour quoi.
Si « lire si / ne pas lire si » ne se déduit pas avec confiance de ces
intrants, écrire `À préciser` — jamais une formule plausible.

**Renommer un titre est une migration de référence**, et elle porte sur les
**ancres effectives**, pas sur les seuls titres renommés : trois
« Vérification » donnent `#verification`, `#verification-1`,
`#verification-2` ; renommer la deuxième fait glisser la troisième vers
`#verification-1` sans qu'on l'ait touchée. Pour un slug dupliqué, ajouter
le contexte au titre (« Vérification » → « Vérification — artéfacts »),
jamais supprimer un titre. Puis :

1. `spec-toc --json` **avant** et **après** donne, pour chaque fichier
   modifié, la table `occurrence → slug effectif` ; leur différence liste
   tout slug qui change, renuméroté ou renommé ;
2. `git grep` de **chaque** ancien slug (`#ancien-slug`) et de l'ancien
   intitulé (`fichier § Ancien titre`) sur `src/`, `scripts/`, `tests/`,
   `spec/`, `.claude/` et `.agents/` ;
3. repointage des références non ambiguës, diff relu ; une référence
   ambiguë reste telle quelle et se signale dans la revue.

## `invariants.md` et critère des invariants

### Statut du fichier

`spec/outils/optimizer/invariants.md` est un **index de contraintes
critiques**, pas une source normative. Chaque entrée : une contrainte,
impérative ou descriptive, qui dit ce qui doit rester vrai, suivie de
**`Source : fichier § section`** (référence durable ; un `fichier:ligne`
ne sert qu'au contrôle ponctuel). Le fichier est groupé par sujet et **se
lit en entier au démarrage d'un chantier Optimizer** : c'est le seul
fichier pour lequel cette lecture intégrale est assumée (le hook `Read` l'en
exempte). Il est tenu compact pour ça ; sa longueur est un objectif de
compacité, **jamais une consigne de coupe** : une règle qui répond au
critère y figure, quitte à en resserrer la formulation.

Maintenance : **une règle normative modifiée se modifie dans sa source ET
dans `invariants.md`, dans le même commit**. `spec-lint` vérifie que chaque
`Source : fichier § section` résout vers un titre existant : une source
disparue ou renommée fait échouer le lint.

### Critère des invariants

Entre dans `invariants.md` une règle qu'**un chantier qui l'ignore casse**,
y compris une règle de méthode dont l'oubli fausse une conclusion (mesure,
harnais) ; pas un résumé de ce qui est vrai, pas une raison. Une relecture
des sections d'état actuel cherche explicitement trois familles, souvent
formulées en description, sans en faire une liste fermée :

- **dérivé de** : une valeur se déduit d'autre chose, jamais saisie ni
  listée à la main ;
- **ordre fixe** : une séquence d'étapes dont l'ordre change le résultat ;
- **constante** : un seuil ou une valeur qui ne découle d'aucune règle plus
  générale et casserait silencieusement si on la changeait ailleurs.

Conduite, que suit la recette pas à pas du skill `spec-hygiene`, (c) :

- Se lisent **toutes** les sections d'état actuel touchées, pas seulement
  celles qui semblent candidates : un invariant est souvent une phrase
  perdue dans une description.
- **Aucun fichier d'un dossier `decisions`** n'est une source d'invariants : une
  décision se cite, elle ne se réextrait pas.
- Une règle connue d'un agent (mémoire, habitude) ne **prouve** jamais un
  invariant : elle n'entre que si elle est retrouvée dans une source
  normative du dépôt, avec son `Source : fichier § section`.
- Une règle ajoutée se compare à `invariants.md` existant, pour n'écrire
  que les absentes.

## Niveaux d'application et garde-fous

Une règle écrite s'érode. Chaque règle reçoit un vecteur, et chaque vecteur
offre un **niveau de garantie** :

| Niveau | Vecteur | Garantie |
| --- | --- | --- |
| 1 — invariant dépôt | `spec-lint` dans `tests/index.ts`, `pre-commit` | refus mécanique, quel que soit l'agent |
| 2 — garde-fou outil | hook `PreToolUse` sur `Read` (Claude Code), `hooks-codex-garde-fous.mjs` (Codex) | refuse le chemin **le plus courant** ; ne couvre ni `cat` ni un autre outil — **garde-fou ergonomique**, pas invariant |
| 3 — convention agent | `CLAUDE.md`, skill `spec-hygiene` | lue au démarrage, s'érode |
| 4 — jugement | revue du diff de spec | humaine |

**Le périmètre a une seule source de vérité, `spec/spec-lint.json`, et
c'est `spec-lint` qui l'applique** — pas ses appelants. Quand l'index porte
un `spec/**.md`, le `pre-commit` lance `verifier` sur le dépôt et ne garde
que les erreurs des `spec/**.md` de l'index : un fichier hors périmètre
n'est jamais refusé. `npm test` lance le lint complet sur le corpus réel
(`testSpecLintReel`).

### Hook `Read`

`.claude/hooks/refuse-read-spec-entier.mjs`, même protocole que
`.claude/hooks/refuse-commit-m.mjs` (JSON de l'outil sur l'entrée standard,
code 2 pour refuser) : chemin `spec/**.md` relatif au dossier de travail,
aucun `offset`/`limit`, fichier de plus de 300 lignes → refus avec le
rappel `node scripts/spec-toc.mjs <fichier>`. Exception :
`spec/outils/optimizer/invariants.md`. Une entrée illisible ou un fichier
absent laissent passer. Câblage dans `.claude/settings.json` (par machine, à
recopier).

Équivalent Codex : `scripts/hooks-codex-garde-fous.mjs`, autonome, actif
dans ce dépôt avec ou sans chantier, et seulement depuis son installation.
Codex lisant par le shell, il refuse `cat`, `type` ou `Get-Content` suivi du
seul chemin d'un `spec/**.md` de plus de 300 lignes, en début de commande
ou après `&&`, `||`, `;`. Il se pose dans le `hooks.json` personnel par
`node scripts/installer-hooks.mjs --codex-hooks <hooks.json>` (entrée
`PreToolUse` à lui, distincte de tout autre hook Codex personnel) ; une
erreur interne ne bloque jamais l'outil.

### Refus du `pre-commit`

Sur les chemins ajoutés, copiés, modifiés ou renommés de l'index : un
commit sur `main` (ou `master`) ; un chemin sous `.history/` ou `.vscode/` ;
un fichier de plus de 5 Mo ; un `spec/**.md` du périmètre que refuse
`spec-lint`. Une branche hors `forge/<sujet>` reçoit un avertissement, pas
un refus.

Dans le dossier de l'Optimizer (`optimizer` sous `spec/outils/`, casse
ignorée), un fichier absent de `.githooks/optimizer-publics.txt` (lue dans
l'index ; un chemin par ligne depuis la racine, `#` en commentaire ;
absente = vide), ou dont la version de l'index est illisible ou porte une
marque de note privée : renvoi résolu dans les dossiers `archive`,
`chantiers` ou `decisions` de ce dossier (le dossier lui-même compris),
renvoi vers `a-publier`, identifiant de lot. Un fichier
publié et sa ligne de liste vont dans le même commit. Limite assumée : une
note privée sans aucune de ces marques, sous un nom de la liste, passe.

Limite : le lint du `pre-commit` lit les fichiers de l'**arbre de
travail**, pas leur version de l'index ; un fichier corrigé sur le disque
mais pas réindexé passe. Test : `node tests/run.mjs precommit`.

### Installation des garde-fous

Trois objets distincts, et les deux premiers ne se confondent pas :

| Objet | Où | Versionné ? |
| --- | --- | --- |
| Les **sources** (`.githooks/pre-commit`, `scripts/spec-lint.mjs`, `scripts/lib/spec-markdown.mjs`, `scripts/hooks-codex-garde-fous.mjs`) | dans le dépôt | ✅ relues en revue |
| **L'installation** | `<git commun>/forge/installation/` | ❌ propre à la machine |
| Le **câblage** | `core.hooksPath` → `<installation>/hooks` | ❌ |

- Un `core.hooksPath` **relatif** se résout à l'exécution : chaque worktree
  prendrait **son** `.githooks`, tel que checkouté sur sa branche. Un
  chemin absolu vers le `.githooks` du worktree principal ne résout rien
  non plus : son contenu dépend encore de la branche qui y est checkoutée.
- `node scripts/installer-hooks.mjs` copie les sources dans l'installation
  (`.githooks/<nom>` sous `hooks/<nom>`, le reste à l'identique) et câble
  `core.hooksPath`. Options : `--simulation` (affiche sans écrire),
  `--sans-cablage`, `--codex-hooks <hooks.json>`. Un câblage préexistant
  différent est signalé, jamais écrasé.
- **L'installation porte sa propre version de référence** : un manifeste
  (`manifeste.json`) des empreintes des octets **installés**, mis à jour
  par cette seule commande. Manifeste v2 : `fichiers {chemin: empreinte}`,
  `entrees {chemin: {proprietaire, source, commit, date}}`, `commitSource`,
  `brancheSource`, `installeLe`, `version: 2`. Dans `fichiers` et
  `entrees`, l'installateur ne réécrit **que ses chemins** et garde toute
  autre entrée telle quelle ; `commitSource`, `brancheSource`,
  `installeLe` et `version` sont réécrits à chaque installation. Un
  manifeste v1 (`fichiers`, `commitSource`, `installeLe`) se lit en
  mémoire, empreintes gardées, et s'écrit en v2 à l'installation suivante.
- Le chemin de l'installation se calcule depuis le répertoire Git commun
  (`git rev-parse --git-common-dir`) : dans un worktree secondaire, `.git`
  est un fichier, pas un dossier.

Portée du hook, assumée : ce n'est pas une exclusion mutuelle, il se
contourne (`--no-verify`). Il n'est jamais requis : un clone neuf n'a ni
installation ni câblage, et développe, teste et commite normalement. Pas de
commit automatique dans `pre-commit`. Test : `node tests/run.mjs
installerhooks`.

### Skill `.claude/skills/spec-hygiene/`

Les recettes de « Déplacer, archiver ou découper un document » et de
« Critère des invariants ». **Déclencheur opérationnel** : modifier le
contenu normatif d'un fichier en exception dans `spec/spec-lint.json`, ou
ajouter ou modifier une section d'état actuel. Faute, lien, en-tête,
statut : pas de déclenchement.
