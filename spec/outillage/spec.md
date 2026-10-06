# Outillage des specs — natures, `spec-toc`, `spec-lint`

**Statut :** ÉTAT ACTUEL — décrit les natures de documents de `spec/`, le parseur `spec-markdown`, `spec-toc`, le contrat de `spec-lint`, les en-têtes, le critère des invariants et les niveaux d'application (hook `Read` et installation des garde-fous compris)
**Lire si :** on modifie `scripts/spec-lint.mjs`, `scripts/spec-toc.mjs`, `scripts/lib/spec-markdown.mjs`, `spec/spec-lint.json`, le hook `Read`, le hook `pre-commit`, `scripts/installer-hooks.mjs` ou le skill `spec-hygiene` ; on crée, déplace ou découpe une spec
**Ne pas lire si :** on ouvre une spec pour son contenu — `node scripts/spec-toc.mjs <fichier>` suffit
**Voir aussi :** `spec/chantiers/spec-rangement.md` (fiche du chantier qui a posé ces règles), skill `spec-hygiene`

Contrats repris du journal du chantier `spec-rangement`, archivé dans les
notes privées. Chaque titre garde l'identifiant de sa section d'origine
(« ex-B.4 ») : un identifiant nu cité par le code, les tests, les skills ou
le texte ci-dessous (« B.4 ») désigne la section de même identifiant ; les
autres (A.3, A.5, A.6, A.7, identifiants de lot) se résolvent par la table
de la fiche `spec/chantiers/spec-rangement.md`. « Ce lot », « le lot n » :
le lot de ce chantier qui a posé la règle.

## Natures de documents et règles de forme (ex-A.2)

Trois natures de documents, séparées physiquement :

| Nature | Rôle | Lu quand | Où |
| --- | --- | --- | --- |
| **État actuel** | normatif, à jour | au démarrage, **par section** | racine de la zone |
| **Décision** | conclusion **encore en vigueur** qu'un chantier peut devoir rouvrir (cadrage exécuté, synthèse décisionnelle) | quand on touche ce qui a été décidé | `decisions/` |
| **Archive** | document daté qui **n'est plus une source de vérité active** : sa conclusion est absorbée ailleurs, ou explicitement laissée comme historique à consulter si besoin (historique, discussions, analyses, audits clos) ; **et les artefacts de preuve** d'un chantier (contrôles, décisions bloc par bloc), dont la valeur est justement leur contenu brut | jamais par défaut | `archive/` |

Le critère de rangement d'un nouveau document est la deuxième colonne, pas
son genre : une analyse dont la conclusion vit dans une synthèse est une
archive ; une synthèse dont la conclusion est encore appliquée est une
décision. Une archive dont on ne sait pas encore *où* la conclusion a été
reprise reste une archive (`conclusion reprise dans : À préciser`) : ce
qu'on affirme en la classant, c'est qu'elle **n'est plus active**, pas
qu'on a fini de la cartographier.

Règles de forme — **deux régimes**, celui qu'implémente le lint (B.4) :

- **Documents actifs** (état actuel, décisions, README, index) :
  1. **bloc terminal ≤ 80 lignes** (objectif rédactionnel ; refus au-delà
     de **100**) — définition exacte en B.4 ;
  2. **en-tête selon la nature** (modèles en B.5) ; un `head -12` suffit à
     décider de lire ou non ;
  3. **fichier ≤ 500 lignes** hors exceptions déclarées (B.4). Un fichier
     trop long se découpe **quand un chantier doit modifier son contenu
     normatif** — pas pour une faute, un lien ou un en-tête ;
  4. **slugs de titres uniques** dans le fichier, pour que `fichier §
     section` désigne une seule chose.
- **`archive/`** : seul l'en-tête `Statut : ARCHIVE` est exigé. Aucune
  contrainte de longueur ni d'unicité — une archive ne se découpe pas.
  **Tout `.md` créé sous `archive/`** (README, fichier de preuve, note)
  reçoit cet en-tête **au moment de sa création**, pas après.

## Déplacer vers `archive/` ou `decisions/` (ex-B.1)

Déplacements **sans lecture du corps** (`git mv` côté `sw-forge-docs`,
copie dans le worktree) :

- **Un dossier daté part en bloc**, sauf un fichier qui porte des décisions
  encore en vigueur. Détection **mécanique, sans lire le corps** : nom du
  fichier + ses 12 premières lignes + son sommaire (`grep -n '^#'`), à la
  recherche de titres — **H1 compris** — du type
  « Décision », « Règle », « Retenu », « À faire ». S'il en porte
  clairement, il est **déplacé** (pas copié) vers
  `decisions/` avec un lien retour dans le `README.md` du dossier archivé ;
  **s'il est ambigu, il reste en archive** et gagne une ligne de pointeur
  dans `archive/README.md` (« peut contenir des décisions actives : … »)
  — A.6, on ne perd rien, on rend visible. Candidat connu :
  `audit-…/decisions-revue.md`.
- **En-tête ARCHIVE minimal posé mécaniquement** sur chaque `.md` déplacé
  (le lint 4 l'exige, et le lot 5 ne repasse pas sur `archive/`) :
  `**Statut :** ARCHIVE — déplacé le <date> depuis <ancien chemin> ;
  conclusion reprise dans : À préciser`. Le champ « À préciser » se
  complète le jour où quelqu'un ouvre le fichier pour de bon ; il n'est
  pas une erreur de lint.
- Repointage : même procédé que `416a242`. Motif = **nom de fichier complet
  avec extension** (`analyse-swcalc-rune-optimizer.md`, jamais
  `analyse-swcalc`). Script dans le scratchpad, **mode aperçu d'abord**,
  puis réécriture ; `git grep` sur `src/ scripts/ tests/ spec/ .claude/`.
  Le `git diff` complet est **relu hunk par hunk avant le commit** : chaque
  hunk ne change qu'un chemin.
- `archive/README.md` (10 lignes), **créé avec l'en-tête ARCHIVE** (A.2 :
  tout `.md` créé sous `archive/`) : « ne pas lire pour démarrer ;
  chercher ici par `grep` pour comprendre *pourquoi* ».

## Sous-titrer un fichier, parseur `spec-markdown` (ex-B.2)

Lire une fois la section « Écran (de haut en bas) » (l. 268–1246) et y
poser des H3/H4 tous les 40–80 lignes ; même chose, plus légère, sur les
autres H2. Les titres reprennent les libellés du jeu / de l'écran.

Consignes strictes :

- **n'ajouter que des lignes commençant par `#`** ; aucun mot modifié,
  déplacé ou supprimé ;
- hiérarchie propre : **aucun saut de niveau** (pas de H4 directement sous
  un H2), chaque H4 sous le H3 qui précède, chaque titre décrit le bloc
  jusqu'au prochain titre de niveau égal ou supérieur ;
- aucune **ancre** dupliquée : contrôle par le slug GitHub, pas seulement
  par le texte du titre.

**Ce lot crée `scripts/lib/spec-markdown.mjs`** — première version du
parseur partagé que le lot 3 étendra : `titres(texte)` (lignes `^#{1,6}`
suivi d'une espace, hors bloc de code clôturé) et `slug(titre)` selon l'algorithme de
`github-slugger` (minuscules ; suppression des caractères qui ne sont ni
lettre Unicode, ni chiffre, ni espace, ni `-` — les accents sont
**conservés** ; espaces → `-` ; doublons suffixés `-1`, `-2` dans l'ordre
du fichier). **Une seule implémentation dans le dépôt** : ni script
scratch, ni copie dans un hook — tout contrôle de slug l'importe. Testée
dans `tests/fixtures/spec-markdown/` contre des titres réels du dépôt
(accents, ponctuation, backticks, doublons).

## `spec-toc` (ex-B.3)

`node scripts/spec-toc.mjs <fichier|dossier> [--json]` imprime, par
fichier : l'en-tête (statut, lire si), puis chaque titre avec **niveau,
plage de lignes, première phrase**. ≤ 60 lignes pour un fichier de 2 000.

Définitions exactes :

- **titre** : ligne `^#{1,6}` suivi d'une espace, hors bloc de code clôturé (```` ``` ```` ou
  `~~~`) ;
- **plage** : du titre inclus à la ligne précédant le prochain titre de
  niveau **≤** au sien ;
- **première phrase** : premier paragraphe de prose de la section, hors
  titres, blocs de code, tableaux et lignes vides ; un item de liste compte
  comme prose et **forme à lui seul son paragraphe** (marqueur `-`/`1.`
  conservé ; sans ça une liste sans ligne vide interne deviendrait la
  « phrase » entière — arbitrage du lot 3) ; tronqué à 120 caractères ;
  `—` si la section n'a pas de prose avant son premier sous-titre ;
- **en-tête** : les lignes `**Champ :** valeur` entre le H1 et la première
  ligne qui n'en est pas une, **les lignes vides étant transparentes**
  (tous les en-têtes réels du dépôt ont une ligne vide entre le H1 et
  `**Statut :**` ; sans ça aucun ne serait lu — arbitrage du lot 3, qui
  vaut pour le lint du lot 4 et les modèles du lot 5) ; `statut` = la
  valeur du champ `Statut :` si présent ;
- **mode dossier** : parcours **récursif** de tous les `.md`, hors
  `node_modules/` et `.git/`. Écrit au lot 3 sans test ; **le lot 4, qui
  s'en sert pour son inventaire, ajoute la fixture** (dossier avec
  sous-dossier et un `.md` à ignorer). **Bootstrap** : le lot 3 s'exécute avant le lot 5, donc un
  en-tête absent ou ancien (prose, ⚠️ libre) **n'est pas une erreur** :
  `statut: null`, `lireSi: null`, et le sommaire est produit normalement.
  C'est `spec-lint` (4) qui juge l'en-tête, pas `spec-toc` ;
- `--json` : `[{fichier, statut, lireSi, sections: [{niveau, titre, slug,
  debut, fin, premierePhrase}]}]`.

Le **parseur Markdown** vit dans `scripts/lib/spec-markdown.mjs`, **créé
au lot 2** (titres, slug) et **étendu ici** (plages, en-tête, première
phrase), puis partagé avec `spec-lint` (4) : une seule définition de
« titre », de « section » et de « slug » dans le dépôt. Deux contraintes
héritées du lot 2 : `slug(titre, compteurs)` prend une `Map` **fournie par
l'appelant** — une `Map` neuve **par fichier**, sinon les suffixes `-1`
fuient d'un fichier à l'autre ; et le module a un sidecar
`spec-markdown.d.mts` pour `tsc` — toute fonction ajoutée au `.mjs` est
déclarée dans le `.d.mts`, dans le même commit. `≤ 60 lignes`
est un objectif de compacité (A.3) : **tous les titres sont toujours
imprimés**, quel que soit leur nombre.

Enregistré dans `tests/index.ts` (`spec-toc`) avec des **fixtures
synthétiques** dans `tests/fixtures/spec-toc/` : titres imbriqués, fichier
sans H2, bloc de code contenant `#`, section vide, dernier titre du
fichier, accents et ponctuation Markdown dans les titres, texte avant le
premier titre, **fichier sans en-tête normalisé** (statut `null`). Plus un test sur `spec/outils/optimizer.md` réel : chaque H2
présent, `--json` parse et porte les mêmes sections. Mentionné dans
`CLAUDE.md` § Vérifier comme la façon d'ouvrir une spec.

## Contrat de `spec-lint` (ex-B.4)

Livre `spec-lint` et ses tests sur fixtures ; les lots 5, 6b et 7b s'en
servent comme preuve. L'enforcement (`pre-commit`, hook `Read`, skill,
`CLAUDE.md`) est le lot 9, dernier : scinder évite d'écrire
deux fois la même logique en scripts scratch temporaires.

Construit sur `scripts/lib/spec-markdown.mjs` (le parseur du lot 3 : même
définition de titre, de section, d'en-tête, de slug).

### Bloc terminal, refus et cibles de test

- **Bloc terminal** : les lignes entre un titre (exclu) et le prochain titre
  de **n'importe quel niveau** (exclu), ou la fin du fichier ; le texte
  avant le premier titre est un bloc terminal (le préambule). Un titre = ligne
  `^#{1,6}` suivi d'une espace, **hors bloc de code clôturé**. Lignes vides comptées, tableaux
  et listes comptés (un tableau de 120 lignes est un bloc à découper ou à
  sortir en fichier `.csv`/`.md` dédié). Pas de frontmatter dans ce dépôt ;
  s'il en apparaît, il est exclu.
- **Refus (hors `archive/`)** : bloc terminal > **100** lignes ; fichier
  > **500** lignes ; en-tête absent ou sans champ `Statut :` reconnu (B.5) ;
  **deux titres du même fichier avec le même slug** (sinon `fichier §
  section` est ambigu — GitHub suffixe `-1`, `-2`, une référence textuelle
  ne le dit pas) ; `Source : fichier § section` ou lien `fichier §
  section` qui ne résout pas vers un titre existant (slug GitHub, unique
  par construction).
- **`archive/` : seule la présence d'une ligne `**Statut :** ARCHIVE` est
  exigée.** Ni longueur, ni unicité, ni autres champs : une archive ne se
  découpe pas (c'est sa définition), et `historique/` seul ferait échouer
  tout lint de longueur. `À préciser` dans un en-tête n'est jamais une
  erreur.
- Pas de contrôle de saut de niveau (un H2 → H4 est un défaut de forme, pas
  de lisibilité) ; il reste au lot 2 et à la review.
- **Deux cibles distinctes dans `tests/index.ts`, au sens fixe** — une
  commande de preuve signifie la même chose quel que soit le moment :
  - `spec-lint-en-tetes` : en-têtes, unicité des slugs, résolution des
    `§`. Enregistrée sur le corpus réel **au lot 5** ;
  - `spec-lint` : tout ce qui précède **plus** les longueurs et les
    exceptions. Enregistrée sur le corpus réel **au lot 9** (avant, elle
    ne peut pas passer : les longueurs ne sont tenables qu'après 7b). Un
    filtre qui ne correspond à rien échoue en listant ce qui existe — pas
    de faux vert possible.
  - **Au lot 4, les deux cibles ne tournent que sur les fixtures.** Le
    corpus réel n'a pas encore ses en-têtes (lot 5) ; d'où « 4 ne dépend
    pas de 1 » dans A.7.

### Périmètre, exceptions et inventaire des longueurs

- **Périmètre et exceptions** : un seul fichier `spec/spec-lint.json` :
  `{ perimetre: ["spec/outils/**"], exceptions: [{ fichier, raison,
  condition_de_suppression, chantier_responsable }] }`. Le périmètre est
  la liste des zones qui ont reçu leurs en-têtes ; une zone s'y ajoute par
  un lot M dédié (A.2). Une exception exempte un fichier **des deux règles
  de longueur** (bloc et fichier), pas des en-têtes ni des slugs. Deux
  règles techniques : une entrée dont le fichier repasse **sous** les
  seuils fait **échouer** le lint (l'entrée doit être retirée — la liste
  ne peut que décroître silencieusement, jamais stagner) ; une entrée
  ajoutée est visible dans la review parce qu'elle vit dans un fichier
  dédié, et `spec/README.md` dit qu'on n'en ajoute que pour un fichier
  **préexistant au lint**, jamais pour un nouveau.

- **Inventaire non bloquant des blocs > 100** — dès que le parseur
  existe, donc **au lot 4**, pas au dernier lot : sur le périmètre réel,
  par fichier actif, nombre de blocs > 100 et taille du plus grand, écrit
  dans le fichier de preuve `inventaire-longueurs-4.md`. Le lint n'a pas
  à passer à ce stade ; le but est de connaître la dette avant les lots
  de transformation restants (5–8), et de savoir si « 9 reste
  mécanique » tient. Règle de traitement
  (appliquée en 9, décidée ici) : un fichier actif hors exception qui
  n'échoue **que** sur un ou deux blocs reçoit des sous-titres à la manière
  du lot 2 (lignes `#` seulement, mêmes preuves) ; au-delà, il entre en
  exception **avec le schéma complet** — `raison`,
  `condition_de_suppression` opérationnelle (« prochain chantier
  &lt;domaine&gt;, avant première modification normative »),
  `chantier_responsable` — jamais un `{ fichier, raison: "trop de
  blocs" }`, et jamais de refonte de contenu au lot 9.

### Amendement C6 — la nature CHANTIER

**Amendement C6 (2026-09-17)** — un document de cadrage (tout `.md` sous
un dossier `chantiers/`, à toute profondeur, dont `spec/chantiers/**`)
est une **quatrième nature**, ni
état actuel, ni décision, ni archive (A.2) : il est « en cours » puis
« terminé ». Deux formes de `Statut :` **seules** reconnues, par une
regex stricte — pas un préfixe libre comme pour les trois autres
natures : `CHANTIER en cours` et `CHANTIER terminé le AAAA-MM-JJ` (date
calendaire valide) ; les deux tolèrent un suffixe `— <texte>`. La nature
CHANTIER est refusée hors d'un dossier `chantiers/`, et toute autre
nature y est refusée : seul CHANTIER y est reconnu. **Seule exemption au
plafond fichier de 500 lignes** (règle 3 de A.2), codée dans
`scripts/spec-lint.mjs`, pas déclarée dans `spec/spec-lint.json` — ce
n'est pas une dette à résorber, c'est la nature du document, qui grossit
avec les résultats de ses lots. Le bloc terminal ≤ 100 lignes, les slugs
uniques et la résolution des références restent exigés comme partout.
Périmètre étendu : `spec/spec-lint.json` déclare aussi
`spec/chantiers/**`.

## En-têtes par nature, slugs uniques (ex-B.5)

Sur chaque fichier du périmètre hors `archive/` (11 privés à la racine,
3 dans `decisions/`, 5 publics dans `spec/outils/`) — `archive/` a reçu
son en-tête minimal au lot 1 et n'est pas repassé. `reliques.md` reçoit
**son en-tête et rien d'autre** (A.5). Une ligne vide entre le H1 et le
premier champ, comme partout dans le dépôt (le parseur la tolère, B.3). Intrants : les 12 premières lignes, `node
scripts/spec-toc.mjs <fichier>`, et les **liens entrants** (`git grep -l
<nom-de-fichier>`), qui disent *qui* consulte ce fichier et pour quoi.

Trois modèles, un par nature — un champ qui serait artificiel pour la
nature du fichier n'existe pas dans son modèle. Aucune date « de dernier
commit » : Git la connaît déjà, et un tel champ serait faux au premier
oubli. `Vérifié le` est optionnel et signifie « dernière relecture
explicite », rien d'autre.

```markdown
# <Titre>                                   ← ÉTAT ACTUEL
**Statut :** ÉTAT ACTUEL — décrit <quoi>
**Lire si :** …
**Ne pas lire si :** …
**Voir aussi :** <fichier § section>, …
**Vérifié le :** AAAA-MM-JJ                 (optionnel)

# <Titre>                                   ← DÉCISION
**Statut :** DÉCISION <date> — <la décision en une phrase>
**Remplace / remplacé par :** … (ou « — »)
**Exécution :** commit <sha> — vérifiée par <observation>   (si exécutée ; posée par le lot 0, conservée ici)
**Lire si :** …

# <Titre>                                   ← ARCHIVE (posé au lot 1, complété à l'usage)
**Statut :** ARCHIVE — déplacé le <date> depuis <ancien chemin> ; conclusion reprise dans <fichier § section | À préciser>
**Chercher ici pour :** …                   (optionnel)
```

**Règle de non-invention** : si « lire si / ne pas lire si » ne se déduit
pas avec confiance de ces intrants, écrire `À préciser` — jamais une
formule plausible. Un `À préciser` vaut une ligne dans `pistes.md`.

**Slugs dupliqués** (la part C du lot) : renommer les titres dont le slug
est en double dans un fichier actif (A.2 règle 4) en ajoutant le contexte
au titre (« Vérification » → « Vérification — artéfacts »), jamais en
supprimant un titre. **Renommer un titre est une migration de référence**,
pas une retouche, et elle porte sur les **ancres effectives**, pas sur les
seuls titres renommés : trois « Vérification » donnent `#verification`,
`#verification-1`, `#verification-2` ; renommer le deuxième fait glisser
le troisième vers `#verification-1` sans qu'on l'ait touché. Donc, pour
chaque fichier modifié, `spec-toc --json` **avant** et **après** donne la
table complète `occurrence → slug effectif` ; la différence des deux
tables (tout slug qui change, renuméroté ou renommé) est écrite dans le
fichier de preuve `renommages-5.md` ; puis `git grep` de **chaque** ancien
slug effectif (`#ancien-slug`) et de l'ancien intitulé (`fichier § Ancien
titre`) sur `src/ scripts/ tests/ spec/ .claude/` ; repointage des
références non ambiguës, diff relu ; une référence ambiguë est laissée
telle quelle **et** listée dans `renommages-5.md` avec la raison.

Ce lot **resserre le lint** : `Statut :` reconnu = valeur qui **commence
par** `ÉTAT ACTUEL`, `DÉCISION` ou `ARCHIVE` — plus seulement « présent et
non vide » ; fixture négative `Statut : n'importe quoi` refusée. Puis il
**enregistre `spec-lint-en-tetes` dans `tests/index.ts`** sur le périmètre
réel (`spec/outils/**`, archives comprises) : c'est la première fois que le
lint en mode en-têtes peut passer, puisque les en-têtes viennent d'être
posés.

**Amendement C6 (2026-09-17)** — la quatrième nature CHANTIER (B.4) n'a
pas les trois champs d'en-tête ci-dessus (Lire si, Ne pas lire si, Voir
aussi) : ils restent **facultatifs** pour elle, à la différence des trois
natures modélisées ici. Son en-tête est fixé par `spec-lint` (Statut
`CHANTIER en cours` ou `CHANTIER terminé le AAAA-MM-JJ`, B.4), pas par ce
modèle.

## `invariants.md` et critère des invariants (ex-B.6)

### Statut du fichier (fixé ici, pas rediscuté)

`invariants.md` est un **index de contraintes critiques**, pas une source
normative. Chaque entrée : une phrase impérative + **`Source : fichier §
section`** (référence durable ; `fichier:ligne` ne sert qu'au contrôle,
dans les fichiers de preuve). Le fichier fait ≤ 250 lignes, groupé par sujet (stats et
slots, algorithme, artéfacts, workers, harnais, UI), et **se lit en entier
au démarrage d'un chantier Optimizer** — c'est le seul fichier pour lequel
on assume cette lecture intégrale, et son plafond existe pour ça.

Maintenance : **une règle normative modifiée se modifie dans sa source ET
dans `invariants.md`, dans le même commit** (même principe que ledger ↔
source). `spec-lint` (4) vérifie que chaque `Source : fichier § section`
résout vers un titre existant — une source disparue fait échouer le lint.

### Extraction (ex-6a)

Sources : `README.md` privé, `algorithme.md`, `limites-connues.md`,
`artefacts.md`, `near-miss-appariement.md`, `parallelisation-partagee.md`,
`harnais-diagnostic.md` ; côté public `optimizer.md`, `degats-reels.md`.
**Pas `decisions/vitesse-finale.md`** : cadrage invalidé (DÉCISION « ne
pas faire »), ses règles sont précisément celles qu'il déclare fausses.
Plus généralement, **aucun fichier de `decisions/`** n'est une source
d'invariants — une décision se cite, elle ne se réextrait pas. Commencer par `spec-toc`, lire
**toutes** les sections d'état actuel (pas seulement les « candidates » —
A.3 : un invariant est souvent une phrase perdue dans une description),
sauter les sections marquées historiques ou envisagées. Sortie :
`invariants-<source>.md`, objectif ≤ 40 lignes — **chaque règle qui
répond au critère y figure, quel qu'en soit le nombre** (A.3 : scinder en
`-1.md`, `-2.md` plutôt que fusionner ou omettre) ; chaque règle = phrase
impérative + `fichier:ligne` + `fichier § section`. Critère : « un
chantier qui l'ignore casse quelque chose » — pas les descriptions, pas
les raisons.

### Consolidation (ex-6b)

Intrant : les extraits (≈ 300 lignes) + les mémoires agent existantes
(règles de stats, arithmétique joker/pièces, fidélité des scripts). **Les
mémoires ne prouvent jamais un invariant** : elles servent à suggérer des
candidats ou à détecter une omission. Une règle issue d'une mémoire
n'entre dans `invariants.md` que si elle est **retrouvée dans une source
normative du dépôt** et reçoit son `Source : fichier § section` ; sinon
elle devient une piste dans `pistes.md` (« règle connue de l'agent, non
retrouvée dans la spec »), pas un invariant. Sortie : `invariants.md`,
plus `controle-6b.md` dans le dossier de preuves (A.6).

### Critère précisé (ex-6c)

Le critère est **précisé** pour les règles de forme « X est dérivé de Y,
jamais listé à la main » et « ordre fixe d'un pipeline », que le critère
« casse quelque chose » laisse passer parce qu'elles sont formulées en
description, pas en impératif : une relecture des sections d'état actuel
les cherche explicitement, et n'écrit que les règles **absentes**
d'`invariants.md` (diff contre lui, pas contre les extraits).

## Niveaux d'application et hook `Read` (ex-B.9)

Une règle écrite s'érode. Chaque règle reçoit un
vecteur, et le cadrage dit **quel niveau de garantie** chacun offre :

| Niveau | Vecteur | Garantie |
| --- | --- | --- |
| 1 — invariant dépôt | `spec-lint` dans `tests/index.ts`, `pre-commit` | refus mécanique, Claude ou Codex |
| 2 — garde-fou outil | hook `PreToolUse` sur `Read` (Claude), `hooks-codex-garde-fous.mjs` (Codex) | refuse le chemin **le plus courant** ; ne couvre ni `cat` ni Bash — **garde-fou ergonomique**, pas invariant |
| 3 — convention agent | `CLAUDE.md`, skill `spec-hygiene` | lue au démarrage, s'érode |
| 4 — jugement | review du diff de spec | humaine |

**Le périmètre a une seule source de vérité, `spec/spec-lint.json`, et
c'est `spec-lint` qui l'applique** — pas ses appelants. Le hook
`pre-commit` (source `.githooks/`, installé par `node
scripts/installer-hooks.mjs`, ci-dessous) collecte les `spec/**.md` de
l'index et les passe au lint, qui **ignore** ceux hors périmètre — coût
nul si aucun, et un commit sur `spec/shared/design.md` n'est pas refusé
pour une zone qui n'a pas encore ses en-têtes. Même principe pour
`npm test` (`spec-lint` complet enregistré sur le corpus réel dans
`tests/index.ts`).

### Références `§` vers un titre à lien ou parenthèse

`referencesSection` résout une référence vers un titre qui contient un
lien Markdown, des parenthèses ou des backticks : la référence `fichier §
Titre` est comparée **par slug** au titre cible (le slug neutralise lien et
ponctuation), et une fixture couvre un titre avec lien, un avec
parenthèses, un avec backticks.

### Hook `Read`

Même patron que `.claude/hooks/refuse-commit-m.mjs` : chemin `spec/**.md`,
aucun `offset`/`limit`, fichier > 300 lignes → refus avec le rappel
`node scripts/spec-toc.mjs <fichier>`. Exception : `invariants.md`.
Câblage dans `.claude/settings.json` (par machine, à recopier). Équivalent
Codex : `scripts/hooks-codex-garde-fous.mjs`, hook autonome actif dans ce
dépôt avec ou sans chantier, posé dans le `hooks.json` personnel par
`installer-hooks.mjs --codex-hooks <hooks.json>` (entrée `PreToolUse` à
lui, distincte de tout autre hook Codex personnel).

### Refus du `pre-commit`

Sur les chemins ajoutés, copiés, modifiés ou renommés de l'index : un
commit sur `main` ; un chemin sous `.history/` ou `.vscode/` ; un fichier
de plus de 5 Mo ; un `spec/**.md` du périmètre que refuse `spec-lint`.
Sous `spec/outils/optimizer/` (casse ignorée), un fichier absent de
`.githooks/optimizer-publics.txt` (lue dans l'index ; un chemin par ligne
depuis la racine, `#` en commentaire ; absente = vide), ou dont la
version de l'index porte une marque de note privée : renvoi résolu dans
`archive/`, `chantiers/` ou `decisions/` de ce dossier, renvoi vers
`a-publier/`, identifiant de lot. Un fichier publié et sa ligne de liste
vont dans le même commit. Limite assumée : une note privée sans aucune de
ces marques, sous un nom de la liste, passe. Test : `node tests/run.mjs
precommit`.

### Installation des garde-fous

Trois objets distincts, et les deux premiers ne se confondent pas :

| Objet | Où | Versionné ? |
|---|---|---|
| Les **sources** (`.githooks/pre-commit`, `scripts/spec-lint.mjs`, `scripts/lib/spec-markdown.mjs`, `scripts/hooks-codex-garde-fous.mjs`) | dans le dépôt | ✅ relus en revue |
| **L'installation** | `<git commun>/forge/installation/` | ❌ propre à la machine |
| Le **câblage** | `core.hooksPath` → chemin absolu vers l'installation | ❌ |

- Un `core.hooksPath` **relatif** se résout à l'exécution : chaque worktree
  prendrait **son** `.githooks`, tel que checkouté sur sa branche. Un
  chemin absolu vers le `.githooks` du worktree principal ne résout rien
  non plus : son contenu dépend encore de la branche qui y est checkoutée.
- **L'installation porte sa propre version de référence** : un manifeste
  (`manifeste.json`) des empreintes des octets **installés**. Sa mise à jour
  est une opération explicite, jamais silencieuse : `node
  scripts/installer-hooks.mjs` (`--simulation`, `--sans-cablage`,
  `--codex-hooks <hooks.json>`).
- **Manifeste v2, par entrée** : `fichiers {chemin: empreinte}` et
  `commitSource`, plus `entrees {chemin: {proprietaire, source, commit,
  date}}` et `version: 2`. L'installateur ne réécrit **que ses chemins** et
  garde toute autre entrée telle quelle (`source` est informatif) ; un v1
  (`fichiers` seul) se lit en mémoire, empreintes gardées.
- Le chemin de l'installation se calcule depuis le répertoire Git commun
  (`git rev-parse --git-common-dir`) : dans un worktree secondaire, `.git`
  est un fichier, pas un dossier.

Portée du hook, assumée : ce n'est pas une exclusion mutuelle, il se
contourne (`--no-verify`). Il n'est jamais requis : un clone neuf n'a ni
installation ni câblage, et développe, teste et commite normalement. Pas de
commit automatique dans `pre-commit`.

### Skill `.claude/skills/spec-hygiene/`

La recette de B.1 (déplacer, repointer par script en aperçu, relire le
diff, vérifier) et celle du découpage d'un fichier en exception (livré →
état actuel par sections ≤ 500 lignes, envisagé → `pistes.md` +
`decisions/`, en-têtes B.5, retrait de l'exception). **Déclencheur
opérationnel** : un chantier qui doit **modifier le contenu normatif** d'un
fichier listé dans `spec/spec-lint.json` (exceptions) — ajouter ou changer une
règle ou un comportement. Faute, lien, en-tête, statut : pas de
déclenchement. Le skill porte aussi **la recette d'extraction
d'invariants du 6a avec le critère précisé au 6c** (B.6 § 6c : règles
« X est dérivé de Y, jamais listé à la main », « ordre fixe d'un
pipeline », « constante », formulées en description et non en
impératif — le critère « casse quelque chose » seul les laisse passer,
`controle-6b.md` § 7) : c'est ce qu'un chantier applique quand il ajoute
une section d'état actuel et doit décider ce qui entre dans
`invariants.md`.
