# Cadrage — rangement des specs pour lire à la demande, pas en bloc

⚠️ **Révision 7 — cinq revues adversariales intégrées le 2026-09-16, puis
lots renumérotés dans l'ordre d'exécution ; à valider avant le premier
lot.** Correspondance avec les révisions 2–6 (citées par les revues) :
0→0, 1→1, 3→2, 7→3, 8a→4, 2→5, 4a→6a, 4b→6b, 5a→7a, 5b→7b, 6→8, 8b→9.
Exécution par lots, chacun dans une **session neuve**.
**Le brief d'un lot = la partie A (préambule commun, ≈ 165 lignes) + la
section du lot dans la partie B.** Ne jamais charger la conversation qui a
produit ce cadrage, ni un lot précédent, ni le reste de la partie B. Le
statut de chaque lot se met à jour **dans le tableau A.7**, dans le commit
qui le termine.

---

## Partie A — préambule commun (le brief de chaque lot)

### A.1 Pourquoi

`spec/` fait 41 400 lignes, dont 25 700 pour `spec/outils/optimizer/` (privé,
miroir `sw-forge-docs`). **Le coût n'est pas la profondeur de
l'arborescence, c'est la granularité interne** : `optimizer.md` public fait
1 910 lignes avec 6 H2 et 5 H3 ; sa section « Écran » (≈ 1 000 lignes) n'a
aucun sous-titre, donc ne peut être lue qu'en entier. Deux niveaux d'index
existent déjà (`spec/README.md` → README de zone → fichiers) ; on n'en
ajoute pas. Détail du constat : B.0.

### A.2 Cible

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

**Périmètre du lint pour ce chantier : `spec/outils/**`** (public + privé),
déclaré dans `spec/spec-lint.json`. Les autres zones (`shared/`, `compte/`,
`rta/`, `siege/`, `releases.md`) n'ont ni en-tête ni exception : elles
rejoignent le périmètre par un lot M ultérieur chacune (en-têtes, mesure,
exceptions), pas par ce cadrage.

### A.3 Hiérarchie des priorités

Dans l'ordre, et le suivant ne s'achète jamais au prix du précédent :

1. ne perdre aucune information normative ou décisionnelle ;
2. préserver la correction et la traçabilité (provenance explicite) ;
3. rendre les erreurs **observables** (diff, citation, test négatif) ;
4. réduire le volume lu ;
5. réduire le coût du modèle.

Concrètement : si lire 500 lignes de plus évite une omission plausible, on
les lit. On minimise le contexte **sous contrainte de correction**, pas
l'inverse. **Un plafond de sortie (≤ 40, ≤ 60, ≤ 150 lignes…) est un
objectif de compacité, jamais une autorisation d'omettre** : si tout ce
qui est nécessaire ne tient pas, on dépasse ou on scinde (`-1.md`,
`-2.md`), on ne tronque pas.

### A.4 Catégories de lots, modèles et efforts

La difficulté d'un lot est durable ; le modèle qu'on lui affecte ne l'est
pas. D'où deux tables.

| Catégorie | Nature | Preuve attendue |
| --- | --- | --- |
| **M** — mécanique | déplacer, repointer, poser un en-tête depuis un modèle, vérifier par `grep` | un diff relu, un `grep` vide |
| **C** — classification | lire pour classer (sous-titrer, extraire, trier livré / envisagé) | une sortie structurée avec coordonnées source |
| **J** — jugement | consolider, trancher, supprimer | une décision par élément, avec sa justification et la citation source |

Affectation courante (2026-09) : **M → Sonnet 5, effort bas · C → Sonnet 5,
effort moyen · J → Opus 5, effort élevé** (moyen si l'intrant est ≤ 100
lignes). Haiku 4.5 n'est pas retenu : sur des lots déjà courts, l'économie
ne vaut pas un lien cassé passé inaperçu.

Principe : **le modèle J ne lit pas un gros fichier en entier par défaut.**
Un lot C produit d'abord un extrait structuré ; J travaille sur l'extrait
et **contrôle** contre la source par lecture partielle. C'est un défaut,
pas un interdit — A.3 prime.

### A.5 Branche, chantier, conflits

- Branche **`forge/spec-rangement`** depuis
  **`forge/audit-degats-conditionnels-etape-2`** — elle contient tout
  `forge/orchestration-parallele` (dispositif `chantier`, hooks) **plus**
  les modifications de l'audit sur `spec/outils/optimizer.md` (+34) et
  `spec/outils/degats-reels.md` (+173), que les lots 2, 4, 5 et 6a vont
  précisément retravailler ; partir d'un état antérieur rendrait leur
  travail faux à la fusion. `chantier ouvrir`, puis à la fin de
  chaque lot : `chantier livrer` → `chantier verifier` → **`chantier
  integrer` immédiatement**, sinon le chantier relique ne voit pas les
  nouveaux chemins.
- **`forge/implementation-relique` est ouvert (0 commit au 2026-09-16,
  avancé sur l'audit `b2538ab`).** `reliques.md` ne bouge pas, ne change
  pas de nom, n'est pas réécrit — **à une exception près : son en-tête
  DÉCISION de 5 lignes, posé au lot 5 en tête de fichier**, parce que le
  lint l'exige sur tout fichier actif ; le chantier relique modifiera le
  corps, jamais ces lignes, et le merge documentaire les sépare sans
  conflit. **Sa première action, le jour où il
  démarre : `git merge --ff-only forge/spec-rangement`** dans son worktree
  — gratuit tant qu'il est à zéro commit, un vrai merge sur
  `optimizer.md` après. Pas d'avance intermédiaire tant que personne n'y
  travaille : elle serait à refaire à chaque lot.
- Fichiers transverses portés par ce chantier : `spec/README.md`,
  `ARCHITECTURE.md`, `CLAUDE.md`, `tests/index.ts`. `App.tsx` non touché.
- Règles de commit du dépôt : heredoc, jamais `-m` ; un commit = une raison ;
  script dans le scratchpad, jamais `sed -i`/`node -e` en ligne.

### A.6 Quand une vérification échoue ou qu'un cas est ambigu

- **Vérification échouée → pas de commit.** Corriger si la cause est
  mécanique ; sinon s'arrêter et rapporter, le lot reste « en cours ».
- **Ambiguïté sémantique → conserver l'information.** On ne supprime pas ce
  qu'on ne sait pas classer : on le laisse en place avec la marque
  `<!-- À trancher : … -->` et une ligne dans `pistes.md`.
- **Une vérification se matérialise** : diff relu, citation recopiée,
  `grep` vide, test négatif qui refuse. « J'ai vérifié » sans artefact ne
  compte pas. **Support des preuves** : les fichiers de contrôle
  (`controle-6b.md`, `decisions-7b.md`, aperçus de repointage) ne restent
  pas dans le scratchpad : ils sont écrits dans
  `spec/outils/optimizer/archive/controles-rangement-2026-09/` (nature
  ARCHIVE au sens de A.2 : artefacts de preuve) et **livrés par `chantier
  livrer`**, donc versionnés dans `sw-forge-docs`. Chacun est créé avec
  **un H1** (`# <Objet> — lot <n>`) **puis** l'en-tête `**Statut :**
  ARCHIVE — preuve d'exécution du cadrage spec-rangement, lot <n>,
  <date>` — l'en-tête se lit *sous le H1* (B.3), sans H1 le lint ne le
  voit pas (retour du lot 6a : 15 fichiers sans titre). Le message de
  commit cite le fichier de preuve ; il ne le remplace pas.
- **Où vit le commit d'un lot** (convention actée au lot 0) :
  `spec/outils/optimizer/` est gitignoré dans le dépôt de code, et
  `chantier livrer` commite les notes dans `sw-forge-docs` avec un message
  générique qu'on ne rédige pas. Donc un lot qui ne touche **que** des
  notes privées n'a **aucun commit `docs(optimizer)`** dans le dépôt de
  code : sa preuve vit dans son fichier de preuve (ci-dessus) **et** dans
  le commit `docs(cadrage): lot <n> terminé`, qui met à jour A.7 et
  embarque commandes et sorties d'observation. Un lot qui touche aussi des
  fichiers suivis (spec publique, `src/`, `scripts/`, `tests/`) a en plus
  ses commits normaux, un par raison.

### A.7 Ordre, dépendances, suivi

Dépendances réelles — notation **`A → B` : B requiert A** (prérequis à
gauche) :

```text
1 → 2         2 → 3 (spec-toc se teste sur un fichier déjà sous-titré, et étend spec-markdown.mjs créé au lot 2)
3 → 4 (4 ne teste que des fixtures : pas de dépendance à 1)
4 → 5         1 → 5 (5 enregistre spec-lint-en-tetes sur le périmètre réel, archives comprises)
3 → 6a        6a → 6b        4 → 6b
3 → 7a        7a → 7b        6b → 7b (le routage cite invariants.md)
7b → 8 (8 documente l'état final)          7b → 7c (7c corrige ce que 7b a relevé)
{4, 5, 6b, 7b, 7c, 8} → 9
```

Ordre d'exécution = **ordre des numéros : 0 → 1 → 2 → 3 → 4 → 5 → 6a → 6b
→ 7a → 7b → 8 → 7c → 9** (7c après 8 : il est né du retour du lot 7,
le brief du 8 était déjà émis ; les deux sont indépendants). `2 → 3` est une dépendance technique
(`spec-markdown.mjs` naît au lot 2) ; que le lot 2 passe **aussi** très
tôt répond à la contrainte du chantier relique (A.5). 3 puis 4 suivent
pour que tous les lots sémantiques disposent de `spec-toc` **et** de
`spec-lint`. Seul 0 est libre.

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| 0 en-têtes de statut périmés | M | exécuté | notes 955e6f0 (`sw-forge-docs`), 2026-09-16 |
| 1 archive/ + decisions/ | M | exécuté | `baac323`, 2026-09-16 |
| 2 sous-titres `optimizer.md`, naissance de `spec-markdown.mjs` | C | exécuté | `ed4ba76`, `61ecd9f`, 2026-09-16 |
| 3 `spec-toc` | C | exécuté | `3776a6d`, `bf2e142`, 2026-09-16 |
| 4 `spec-lint` (infrastructure, fixtures, inventaire des blocs) | C | exécuté | `7699bb6`, `7b527e4`, 2026-09-16 |
| 5 en-têtes normalisés, slugs uniques | M + C | exécuté | `f2d234b`, `9576fb8`, `0694bd2` (code), notes `f9c7f0b`, 2026-09-16 |
| 6a extraction des invariants | C | exécuté | notes `sw-forge-docs` (15 preuves `invariants-*.md`), `a4d7785`, 2026-09-16 |
| 6b consolidation + contrôles | J | exécuté | notes `b896771` → `sw-forge-docs` main `68f3c77` (`invariants.md`, `controle-6b.md`), 2026-09-16 |
| 6c reprise du 6a sur `optimizer.md` (rappel) | C + J | exécuté | 2 règles, notes `b8c812b`, 2026-09-16 |
| 7a delta privé / public | M | exécuté | notes `35ae956` → `sw-forge-docs` main `c996492` (`delta-7a-1.md`, `delta-7a-2.md`), 2026-09-16 |
| 7b-1 « Écran » : 89 sous-blocs décidés | J | exécuté | `6a92fd9`, `c87ccd1` (code), notes `9269f0c` → `sw-forge-docs` main `d735fbe` (`decisions-7b.md`), 2026-09-16 |
| 7b-2 21 plages restantes, routage, preuve globale | J | exécuté | `b3884ac` (code), notes `a752678` → `sw-forge-docs` main `c3b236c`, README 112 l. (47 hors reliquat), 2026-09-16 |
| 8 règles de rétention | J (intrant ≤ 100 l.) | à faire | |
| 7c spec publique contredite par le code (6 entrées) | J (effort moyen) | à faire | |
| 9 enforcement (hooks, skill, CLAUDE.md) | M | à faire | |

---

## Partie B — les lots

### B.0 Constat détaillé et lot 0 — en-têtes de statut périmés · M

| Zone | Lignes | Nature |
| --- | --- | --- |
| `spec/outils/optimizer/historique/` | 10 600 | chronologie |
| analyses / discussions externes, revue `.txt` | ~1 900 | datés, « conservés tels quels » |
| `audit-degats-conditionnels-2026-09-08/` | ~2 000 | audit clos |
| `README.md` privé | 2 348 | même squelette de titres que `optimizer.md` public |
| `harnais-diagnostic-extensions.md` | 2 806 | livré et envisagé mêlés |
| `artefacts.md` | 1 700 | « implémenté », en grande partie historique |
| `spec/outils/optimizer.md` (public) | 1 910 | 6 H2, 5 H3 |

Déjà fait, à ne pas refaire : `historique/` (cadrage
`cadrage-rangement-historique.md`, exécuté au commit `416a242`) ; règle de
synchro ledger ↔ source (`CLAUDE.md`).

**Lot 0.** Pour chaque `spec/outils/optimizer/*.md` : lire les **12
premières lignes seulement**. `git log --all --oneline --grep=<sujet>` et
`grep` dans `pistes.md` servent à **détecter** un statut suspect, jamais à
le prouver : un commit peut être partiel ou reverté. Un statut ne passe à
« exécuté / livré » que sur **un état observé** correspondant au résultat
annoncé (ex. pour `cadrage-rangement-historique.md` : `historique/` existe
**et** `git grep 'historique-[a-z-]*\.md' -- src scripts tests` ne renvoie
que des chemins `historique/…`). L'observation est notée dans l'en-tête
sous la forme **définitive** du modèle DÉCISION de B.5 — une ligne
`**Exécution :** commit <sha> — vérifiée par <observation>` — que le lot 5
**conserve telle quelle** quand il normalise le reste de l'en-tête. Notes
privées seules : pas de commit `docs(optimizer)` (A.6), `livrer` puis
`docs(cadrage): lot 0 terminé`.

Preuve : pour chaque statut modifié, la commande d'observation et sa sortie
dans le message du commit `docs(cadrage): lot 0 terminé`.

### B.1 Lot 1 — `archive/` et `decisions/` · M

Déplacements **sans lecture du corps** (`git mv` côté `sw-forge-docs`,
copie dans le worktree) :

- → `archive/` : `historique/`, `discussions-externes/`,
  `discussions-externes-synthese.md`, `analyse-externe-harnais-diagnostic.md`,
  `analyse-swcalc-rune-optimizer.md`, `revue-code-forge-filterslot-topk-heap.txt`,
  `audit-degats-conditionnels-2026-09-08/`.
- → `decisions/` : `cadrage-rangement-historique.md`,
  `cadrage-score-artefacts-ehp.md`, `synthese-decisionnelle-harnais.md`.
- **Un dossier daté part en bloc**, sauf un fichier qui porte des décisions
  encore en vigueur. Détection **mécanique, sans lire le corps** : nom du
  fichier + ses 12 premières lignes + son sommaire (`grep -n '^#'`), à la
  recherche de titres — **H1 compris** (retour du lot 1 : un fichier dont
  le H1 dit « Décisions » n'avait aucun H2 ainsi titré) — du type
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
- Intouchés : `reliques.md` (chantier ouvert), `artefacts.md` (état actuel),
  `pistes.md`.
- Repointage : même procédé que `416a242`. Motif = **nom de fichier complet
  avec extension** (`analyse-swcalc-rune-optimizer.md`, jamais
  `analyse-swcalc`). Script dans le scratchpad, **mode aperçu d'abord**,
  puis réécriture ; `git grep` sur `src/ scripts/ tests/ spec/ .claude/`.
  Le `git diff` complet est **relu hunk par hunk avant le commit** : chaque
  hunk ne change qu'un chemin.
- `archive/README.md` (10 lignes), **créé avec l'en-tête ARCHIVE** (A.2 :
  tout `.md` créé sous `archive/`) : « ne pas lire pour démarrer ;
  chercher ici par `grep` pour comprendre *pourquoi* ».
- Deux commits : notes privées (`livrer`), fichiers suivis repointés.

Preuve : `git grep -n 'historique/\|discussions-externes\|analyse-\|audit-degats\|revue-code' -- src scripts tests spec .claude` ne renvoie que des chemins `archive/…` ou `decisions/…` ; `chantier verifier` passe ; `integrer` fait.

### B.2 Lot 2 — sous-titrer `optimizer.md` public · C

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

Preuve (toutes dans le message de commit) :

```bash
git diff spec/outils/optimizer.md | grep -c '^-[^-]'                 # 0 ligne supprimée
git diff spec/outils/optimizer.md | grep '^+[^+]' | grep -vc '^+#'   # 0 ligne ajoutée non-titre
node <scratch>/slugs.mjs spec/outils/optimizer.md | sort | uniq -d  # vide — importe spec-markdown.mjs
node <scratch>/niveaux.mjs spec/outils/optimizer.md                 # aucun saut de niveau
node tests/run.mjs spec-markdown                                     # le slugger passe ses fixtures
```

puis relecture **humaine** du sommaire (`grep -n '^#'`, ~60 lignes) avant
`integrer`. ⚠️ Passe **avant** tout commit du chantier relique sur ce fichier.

### B.3 Lot 3 — `scripts/spec-toc.mjs` · C

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

### B.4 Lot 4 — `spec-lint` (infrastructure) · C — contrat exact

Livre `spec-lint` et ses tests sur fixtures ; les lots 5, 6b et 7b s'en
servent comme preuve. L'enforcement (`pre-commit`, `chantier livrer`, hook
`Read`, skill, `CLAUDE.md`) est le lot 9, dernier : scinder évite d'écrire
deux fois la même logique en scripts scratch temporaires.

Construit sur `scripts/lib/spec-markdown.mjs` (le parseur du lot 3 : même
définition de titre, de section, d'en-tête, de slug).

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

  **Inventaire mesuré le 2026-09-16** (`wc -l`, fichiers actifs de
  `spec/outils/**` hors futurs `archive/`) — les fichiers > 500 lignes :

  | Fichier | Lignes | Sort |
  | --- | --- | --- |
  | `optimizer/README.md` privé | 2 348 | ramené ≤ 500 par 7b — **pas d'exception** |
  | `optimizer/harnais-diagnostic-extensions.md` | 2 806 | exception ; suppression : prochain chantier harnais, avant modification normative |
  | `optimizer.md` public | 1 910 | exception ; suppression : découpage par sections en fichiers, hors périmètre de ce cadrage |
  | `degats-reels.md` | 1 877 | exception ; suppression : prochain chantier dégâts |
  | `optimizer/artefacts.md` | 1 700 | exception ; suppression : prochain chantier artéfacts |
  | `speed-tuning.md` | 1 229 | exception ; suppression : prochain chantier speed tuning |
  | `optimizer/harnais-diagnostic.md` | 1 141 | exception ; suppression : prochain chantier harnais |
  | `optimizer/pistes.md` | 627 | exception ; suppression : archivage des entrées closes (lot ultérieur) |

  Les sept exceptions initiales sont donc celles-ci, pas les trois de la
  révision 3. Hors périmètre, **cinq** autres fichiers > 500 existent
  (`shared/design.md` 1 040, `shared/navigation.md` 881,
  `shared/librairie-ui.md` 665, `compte/runes.md` 1 135,
  `siege/recommandations.md` 1 479 ; `rta/` n'en a aucun) : ils entreront
  avec leur zone.

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

  **Résultat de l'inventaire (lot 4, `inventaire-longueurs-4.md`)** :
  19 fichiers actifs, 11 avec un bloc > 100. Hors exceptions et hors
  README privé (traité par 7b), **quatre fichiers, un seul bloc chacun** :
  `limites-connues.md` (232), `passifs-vitesse.md` (222),
  `algorithme.md` (160), `decisions/cadrage-score-artefacts-ehp.md`
  (135) → sous-titres au lot 9, aucune exception nouvelle ; le lot 9
  reste mécanique. Note : les 266 lignes d'`optimizer.md` sont son
  préambule (avant le premier H2), non sous-titré au lot 2 — couvert par
  l'exception, à traiter le jour où l'exception tombe.

Preuve 4 : `node tests/run.mjs spec-lint-en-tetes spec-lint` sur les
**fixtures seules**, `tests/fixtures/spec-lint/`, avec les tests
négatifs : bloc de 101 lignes refusé, fichier de 501 lignes refusé, deux
titres de même slug refusés, `Source :` cassé refusé, exception périmée
refusée, fichier d'`archive/` de 3 000 lignes avec deux titres identiques
**accepté** avec son seul `Statut : ARCHIVE`, `À préciser` accepté,
**fichier hors périmètre sans en-tête ignoré**, fichier dans le
périmètre sans en-tête refusé ; plus `inventaire-longueurs-4.md` livré.

### B.5 Lot 5 — en-têtes par nature, slugs uniques · M + C

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

Ce lot **resserre le lint** (retour du lot 4, qui n'avait pas lu les
modèles) : `Statut :` reconnu = valeur qui **commence par** `ÉTAT ACTUEL`,
`DÉCISION` ou `ARCHIVE` — plus seulement « présent et non vide » ; fixture
négative `Statut : n'importe quoi` refusée. Puis il **enregistre
`spec-lint-en-tetes` dans `tests/index.ts`** sur le périmètre réel
(`spec/outils/**`, archives comprises) : c'est la première fois que le
lint en mode en-têtes peut passer, puisque les en-têtes viennent d'être
posés.

Preuve : `node tests/run.mjs spec-lint-en-tetes` passe sur le périmètre
réel ; `git grep` de chaque ancien slug renvoie vide (ou les cas justifiés
de `renommages-5.md`) ; la liste des `À préciser` figure dans le message
de commit.

### B.6 Lot 6 — `invariants.md`

#### Statut du fichier (fixé ici, pas rediscuté)

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

#### 6a — extraction · C, une session par fichier > 800 lignes

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

#### 6b — consolidation et deux contrôles · J

Intrant : les extraits (≈ 300 lignes) + les mémoires agent existantes
(règles de stats, arithmétique joker/pièces, fidélité des scripts). **Les
mémoires ne prouvent jamais un invariant** : elles servent à suggérer des
candidats ou à détecter une omission. Une règle issue d'une mémoire
n'entre dans `invariants.md` que si elle est **retrouvée dans une source
normative du dépôt** et reçoit son `Source : fichier § section` ; sinon
elle devient une piste dans `pistes.md` (« règle connue de l'agent, non
retrouvée dans la spec »), pas un invariant. Sortie : `invariants.md`,
plus `controle-6b.md` dans le dossier de preuves (A.6).

**Contrôle de précision** (1 règle sur 5, tirée au sort par sujet) :
ouvrir la source par **lecture partielle** (`Read(offset, limit)` ou `sed -n
'X,Yp'`, ± 15 lignes autour de la citation), **recopier la ligne source**
dans `controle-6b.md`. Trois états, à ne pas confondre :

- échantillonnée et **confirmée** → conservée ;
- échantillonnée et **infirmée** → retirée, pas reformulée ; **deux
  infirmations sur la même source → 6a est refait pour cette source** (la
  méthode est en cause, pas la règle) ;
- **non échantillonnée** → conservée telle quelle.

**Contrôle de rappel** (indépendant des extraits) : choisir **3 sections**
d'état actuel parmi les plus normatives — `limites-connues.md`,
`algorithme.md` § contraintes, `optimizer.md` § Contraintes (le routage du
lot 7 n'existe pas encore à ce stade) —, les lire en entier, et répondre par écrit dans
`controle-6b.md` : « existe-t-il ici une règle répondant au critère et
absente des extraits ? ». **Une omission trouvée → 6a est refait pour
cette source** avec le critère précisé par l'omission, puis un nouveau
tirage de 3 sections. Coût : ~300 lignes par tour ; A.3 dit que c'est
rentable.

Preuve : `controle-6b.md` (règle → citation, sections de rappel → verdict ;
en-tête ARCHIVE de preuve, A.6) livré avec les notes et cité dans le
commit ; `spec-lint-en-tetes` résout toutes les `Source :`.

#### 6c — reprise du 6a sur `optimizer.md` · C (déclenchée par le rappel du 6b)

Le contrôle de rappel a trouvé 3 omissions (2 dans `algorithme.md`, 1 dans
`optimizer.md § Sous-propriétés verrouillées`), toutes de la même famille :
**règles de forme « X est dérivé de Y, jamais listé à la main » et « ordre
fixe d'un pipeline »**, que le critère « casse quelque chose » laisse
passer parce qu'elles sont formulées en description, pas en impératif.
`algorithme.md` a été lu **en entier** par le 6b : couvert. `optimizer.md`
(1 961 lignes) ne l'a pas été : **une session C relit ses sections d'état
actuel avec ce critère précisé**, et n'écrit que les règles **absentes**
d'`invariants.md` (diff contre lui, pas contre les extraits) dans
`invariants-optimizer-bis.md` (H1 + en-tête de preuve, lot 6c). Une
session J courte (intrant ≤ 40 lignes → Opus effort moyen, A.4) les
intègre à `invariants.md` avec le contrôle de précision à 1 sur 5, met à
jour `controle-6b.md` § Reprise, livre. Pas de nouveau tirage de rappel si
la reprise trouve ≤ 3 règles ; au-delà, un tirage de 3 sections
d'`optimizer.md`.

Deux faits du 6b que le lot 7 doit connaître : **5 entrées
d'`invariants.md` n'ont que `README.md` privé pour source** — 7b les
repointe vers la destination du bloc correspondant **avant** de supprimer
le bloc du README, sinon le lint casse ; et deux **contradictions de
spec** relevées (README:972–980 vs optimizer.md:798, le code donne raison
à optimizer.md ; optimizer.md L397 vs L438) sont dans `pistes.md` §
Rangement — 7b tranche la première (c'est un bloc « privé seulement » à
décider), la seconde reste une piste.

### B.7 Lot 7 — README privé : fin du doublon, routage

#### 7a — delta privé / public · M

Appariement par titre (`spec-toc --json` des deux côtés) en **trois
catégories** : sections appariées, **sections uniquement privées**,
sections uniquement publiques. Un script scratch produit, par section :

```text
Section : <titre>                              [appariée | privée seule | publique seule]
public : 120 l.  privé : 145 l.  communes : 110 l.
privé seulement : 35 l., en blocs : l. 84–96, l. 134–155
public seulement : 10 l., en blocs : l. 40–49
```

Pour une section **privée seule**, la section entière est le delta privé :
elle est découpée en blocs de ≤ 40 lignes (aux frontières de paragraphes)
et passe intégralement en 7b. **Aucune section privée n'est réécrite ou
supprimée sans être passée par 7b.**

Algorithme du delta : un **diff séquentiel** (LCS — `git diff --no-index
-U0` sur deux fichiers temporaires, sortie parsée en plages), **jamais une
comparaison d'ensembles** (`comm`, lignes triées) : l'ordre et les
doublons comptent. Normalisation **minimale** avant comparaison : fins de
ligne (CRLF → LF) et espaces de fin. **Rien d'autre** — ni ponctuation, ni
espaces internes : dans un bloc de code, un tableau ou un exemple de
sortie, deux espaces peuvent être la donnée. Une ligne normalisée à tort
n'arrive jamais en 7b (perte silencieuse, A.3) ; un faux delta coûte
quelques lignes de lecture — A.3 tranche pour le faux delta. Sortie :
objectif ≤ 150 lignes, **aucun bloc omis** — au-delà, plusieurs fichiers
`delta-7a-<n>.md`. **Aucun seuil de similarité ne décide de rien** : le
taux prouve « beaucoup de lignes identiques », pas « le reste est sans
valeur ».

**Résultat (2026-09-16)** : 41 sections (6 appariées, 6 privées seules,
29 publiques seules) ; **2 111 lignes privées seules en 15 blocs**, somme
rejouée = 2 377 = `wc -l` du README. Le delta est dominé par la section
appariée « Écran (de haut en bas) » : **un bloc unique de 1 868 lignes
(l. 154–2021)**, le README n'ayant aucun sous-titre sous ce H2. Ce n'est
pas un artefact d'appariement : diffé contre **tout** le sous-arbre
public d'« Écran » (H3/H4, `optimizer.md` l. 275–1513), 1 758 de ces
1 868 lignes restent privées seules — le README raconte les révisions
successives de l'écran, le public décrit l'état. Titre refusé à
l'appariement : « Runes imposées — … dans la même carte » (privé) vs
« … sur une rune précise » (public). Preuves : `delta-7a-1.md`,
`delta-7a-2.md` (annexe 1 : les 5 entrées d'`invariants.md` à
repointer ; annexe 2 : la contradiction README l. 972–980).

#### 7b — décision bloc par bloc · J

Intrant : la sortie de 7a, puis **les blocs « privé seulement »** (des
sections appariées **et** des sections privées seules) lus par lecture
partielle avec ± 5 lignes de contexte — jamais les deux fichiers entiers.

**Découpage préalable (retour du 7a).** Le bloc unique « Écran »
(l. 154–2021) est **d'abord** redécoupé par 7b, avec la règle des
sections privées seules : blocs de ≤ 40 lignes aux frontières de
paragraphes, un thème par bloc quand des paragraphes consécutifs traitent
du même sujet. Le découpage est écrit en tête de `decisions-7b.md`
(liste de plages) et **la réunion des sous-blocs couvre exactement
l. 154–2021, sans trou ni chevauchement** — c'est la propriété 1 de la
preuve appliquée à ce bloc. Une décision par sous-bloc, jamais une
décision pour les 1 868 lignes.

**Deux sessions, même lot.** L'intrant (2 111 lignes à lire, ~60
décisions à écrire et prouver) dépasse ce qu'une session tient sans
dégrader les dernières décisions. 7b-1 traite la section « Écran »
(découpage, décisions, migrations, preuves après migration) ; 7b-2
traite les 14 autres blocs, réécrit le README en routage, et lance le
script de preuve **sur l'ensemble** des décisions (`decisions-7b.md`
est un seul fichier, 7b-2 y ajoute ses entrées). Un bloc de 7b-2 dont la
destination a été alimentée par 7b-1 passe par le même contrôle doublon
(la section destination est relue, pas supposée vide).

**Résultat 7b-1 (2026-09-16)** : 89 sous-blocs ; supprimer 59 (1 252 l.,
chacun avec la citation de la formulation qui couvre : récits de
révision → `archive/historique/`, état → `optimizer.md`, mécaniques de
dégâts → `degats-reels.md`, 8 blocs contredits par le public ou le
code), garder 17 (357 l., fusions dans `optimizer.md` et
`degats-reels.md`), décisions 10 (207 l., nouveau
`decisions/ecran-exemplaire-et-listes.md`), reliquat 3 (52 l.). L'alarme
« > 300 lignes » a été levée, relue et acceptée ; 184 citations
retrouvées par script, 0 introuvable. Les 5 entrées d'`invariants.md`
sourcées sur le README sont repointées ; la contradiction l. 972–980 est
close des deux côtés. README : 2 377 → 584 lignes ; **les numéros de
lignes de `delta-7a-*.md` pour les blocs restants sont ceux de l'ancien
README** (notes `35ae956`) — décalage −1 859 à partir de l'ancienne
l. 2022, à confirmer par la première ligne de chaque bloc. Quatre
contradictions publiques trouvées en passant attendent dans `pistes.md`
§ Rangement.

**Résultat 7b-2 (2026-09-16)** : 21 plages (le brief en annonçait 14 :
il comptait des sections, pas des plages), préambule l. 16–118
redécoupé en 6 ; supprimer 16 (167 l.), garder 8 (231 l.), décisions 2
(60 l., nouveau `decisions/exclusion-de-runes.md`), reliquat 0, doute 0.
« Runes imposées — dans la même carte » = la même règle que le public
(récit de la 8ᵉ révision, couvert par l'historique) : supprimé.
`invariants.md` l. 233–234 repointées ; `grep "Source : README.md"` →
0. Preuve globale sur les 115 blocs : 22/22 plages 7a couvertes, 0
orpheline, 115/115 destinations résolues, 244 citations retrouvées.
README réécrit en routage : **112 lignes, 47 hors reliquat** ; lint
`spec/outils/optimizer` : 4 points, tous préexistants (les 4 blocs
> 100 l. attendus au lot 9). Destination hors liste, acceptée (A.3) :
les descriptions des archives → `archive/README.md`. Deux lignes du
routage citent un titre à backticks ou parenthèse sous forme non
déclenchante, annotées : à réécrire en `fichier § section` au lot 9,
quand le `§` résout par slug. Deux contradictions de plus dans
`pistes.md` § Rangement (artefacts.md §12 « rien d'implémenté » ;
« défilement horizontal » des coéquipiers vs `flex-wrap`).
Pour chaque bloc, une décision parmi trois, écrite dans `decisions-7b.md`
(dossier de preuves, A.6) avec la première ligne du bloc citée :

- **supprimer** — le bloc ne dit rien que le public ne dise (reformulation,
  redite) ;
- **garder en état actuel** — règle, limite, piège, mesure encore valides :
  va dans le fichier privé thématique concerné (pas dans le README) ;
- **déplacer en `decisions/`** — raison d'un choix.

Un bloc **non supprimé porte une destination explicite et une preuve
après migration** :

```text
Bloc README l. 412–426
Décision : garder en état actuel
Destination : limites-connues.md § Bornes de recherche      (fichier § section EXISTANTS)
Contrôle doublon : grep « borne », « budget » → candidats l. 180–201 ; section « Bornes de recherche » RELUE (l. 176–210) → absente | déjà couverte | partiellement couverte
Mode : intégrer tel quel | fusionner avec la formulation existante | ne pas ajouter (déjà couverte)
Preuve après migration : limites-connues.md l. 188–201 ; première ligne : « … »
```

Le `grep` **localise**, il ne prouve pas l'absence de doublon (synonymes,
règle éclatée sur plusieurs lignes, section voisine) : c'est la **lecture
de la section destination** (`spec-toc` puis lecture partielle), citée,
qui décide. « Déjà couverte » est une issue légitime : le bloc est alors
supprimé du README avec, pour preuve, la citation de la formulation
existante qui le couvre.

La **preuve après migration** cite la destination finale (plage de lignes
et première ligne du bloc tel qu'il y figure ; pour une fusion, la phrase
fusionnée). Sans elle, la vérification finale peut passer alors que le
bloc a été retiré du README et jamais inséré — la destination « qui
résout » prouve qu'un endroit existe, pas que le contenu y est.

Pour `decisions/`, la destination est un fichier existant **§ section**,
ou un nouveau fichier `decisions/<sujet>.md` créé avec l'en-tête DÉCISION
de B.5. Si aucune destination claire n'existe, le bloc n'est **ni supprimé
ni déplacé** : il reste dans le README réécrit, sous un dernier H2 « À
trancher (reliquat 7b) », tel quel, avec `<!-- À trancher : … -->` et une
ligne dans `pistes.md` (A.6). Le plafond de 120 lignes du routage ne
compte pas ce reliquat ; le plafond de 500 du lint, si.

Par défaut, en cas de doute : **garder** (A.6). Les lignes communes sont
supprimées du privé et remplacées par un lien vers l'ancre publique. Si le
total supprimé dépasse **300 lignes**, ou si plus de **20 %** des blocs
sont « doute », **demander avant** de commiter.

Puis le README privé est réécrit en **routage par tâche** (≤ 120 lignes),
sur le modèle d'`ARCHITECTURE.md`, en pointant des **sections** :

```markdown
| Je touche… | Lire d'abord | Puis |
| --- | --- | --- |
| les contraintes de stats | invariants.md § Stats ; optimizer.md § Contraintes | decisions/cadrage-score-artefacts-ehp.md |
| le harnais | harnais-diagnostic.md § Commandes | harnais-diagnostic-extensions.md SEULEMENT si … |
```

Preuve : `decisions-7b.md` livré avec les notes et cité dans le commit ;
un script scratch vérifie **trois propriétés** : chaque bloc de 7a y a
une décision (aucune plage orpheline) ; chaque bloc non supprimé a une
destination qui résout (`fichier § section` existant, ou reliquat) ; **la
première ligne citée dans « Preuve après migration » est retrouvée
textuellement dans le fichier destination** (pour « déjà couverte », la
citation de la formulation existante l'est). `spec-lint-en-tetes` résout
tous les liens de section du routage ; le routage fait ≤ 120 lignes hors
reliquat.

#### 7c — la spec publique contredite par le code · J (effort moyen)

Les lots 6b, 7b-1 et 7b-2 ont trouvé, en passant, **six affirmations de
`optimizer.md` (ÉTAT ACTUEL) contredites par le code**, consignées dans
`pistes.md` § Rangement et laissées telles quelles parce qu'aucun de ces
lots n'avait le public pour objet. Les laisser à un chantier futur, c'est
garder six phrases fausses dans la source de vérité ; A.3 (correction
avant économie) les fait porter par ce lot, après le 8 et avant le 9.

Intrant : les six entrées de `pistes.md` § Rangement marquées « à
corriger dans la source » — continuité au retour sur l'onglet et « à
DROITE » (§ Équipement actuel) ; artéfacts « hypothéqués » (§ Recherche
des runes — meet-in-the-middle et élagages) ; position de « Réglages
avancés » (§ Conditions, inventaire et réglages avancés) ; `tsconfig`
« n'inclut que `src` » (l. 608 ancienne) ; l'écart « ne s'affiche que
s'il y a quelque chose à gagner » (l. 438 contre l. 397). Pour chacune :
la phrase actuelle citée, **la ligne de code qui la contredit citée**
(fichier:ligne, texte), la phrase de remplacement (ou la suppression, si
le public dit déjà la règle juste ailleurs — alors citation de cet
endroit), et la fermeture de l'entrée de `pistes.md` **dans le même
commit** (ledger et source ensemble, CLAUDE.md). Une entrée où le code
ne tranche pas nettement n'est pas corrigée : `<!-- À trancher -->` sur
place, entrée laissée ouverte avec la raison. Rien d'autre n'est
retouché dans `optimizer.md` : six corrections locales, pas une
relecture. Preuve : `corrections-7c.md` dans le dossier de preuves
(A.6), une section par entrée ; `spec-lint` sans point nouveau ;
`spec-lint-en-tetes`. Un commit `docs(optimizer)` par entrée, ou un
seul si le message les liste toutes une à une — l'atomicité se juge sur
le pourquoi (« le code contredit la spec ») et il est commun.

Hors périmètre, tracé dans `pistes.md` : les trois reliquats du 7b-1
(composants partagés, destination hors `spec/outils/`).

### B.8 Lot 8 — règles de rétention · J (intrant ≤ 100 lignes)

Texte à insérer tel quel dans `spec/README.md` § Conventions communes :

> **Rétention.** Une mise à jour de spec **remplace** la section obsolète,
> elle n'ajoute pas un paragraphe « depuis la v… » — l'ancien texte part
> dans `archive/`, daté. Le raisonnement encore utile à une décision en
> vigueur va dans `decisions/`. `archive/` reçoit les documents datés qui
> ne sont plus une source de vérité active — conclusion déjà reprise
> ailleurs, ou conservés comme historique — et les artefacts de preuve
> d'un chantier ; une archive n'a qu'un en-tête `ARCHIVE`, aucune
> contrainte de taille. Pour les documents actifs : aucun bloc terminal de
> plus de 80 lignes (le lint refuse à 100) ; aucun fichier de plus de 500
> lignes hors exceptions déclarées ; slugs de titres uniques. Un
> fichier en exception se découpe **avant** qu'un chantier modifie son
> contenu normatif — pas pour une faute, un lien ou un en-tête. Chaque
> fichier commence par l'en-tête de sa nature (état actuel / décision /
> archive). `invariants.md` est un index : une règle modifiée se modifie
> dans sa source ET dans l'index, dans le même commit.

Plus, dans `CLAUDE.md` § « La spec avant le code » : *« Ouvrir une spec =
`node scripts/spec-toc.mjs <fichier>` puis la section utile — jamais un
fichier entier de plus de 300 lignes sans raison écrite. Avant un chantier
Optimizer : `invariants.md` (en entier — le seul fichier lu ainsi, tenu
compact pour ça) et le README de routage. »* — pas de nombre de lignes
dans `CLAUDE.md` : le plafond de 250 de B.6 est un objectif de compacité
qui se discute s'il est dépassé, jamais une raison d'omettre une règle ;
un chiffre écrit là serait lu comme une consigne de coupe. Et dans `ARCHITECTURE.md`, les lignes Optimizer pointent vers
une **section** de spec, pas un fichier.

### B.9 Lot 9 — enforcement · M

Une règle écrite s'érode (`CLAUDE.md` en témoigne). Chaque règle reçoit un
vecteur, et le cadrage dit **quel niveau de garantie** chacun offre :

| Niveau | Vecteur | Garantie |
| --- | --- | --- |
| 1 — invariant dépôt | `spec-lint` dans `tests/index.ts`, `pre-commit`, `chantier livrer` | refus mécanique, Claude ou Codex |
| 2 — garde-fou outil | hook `PreToolUse` sur `Read` (Claude), `hooks-codex.mjs` (Codex) | refuse le chemin **le plus courant** ; ne couvre ni `cat` ni Bash — **garde-fou ergonomique**, pas invariant |
| 3 — convention agent | `CLAUDE.md`, skill `spec-hygiene` | lue au démarrage, s'érode |
| 4 — jugement | review du diff de spec | humaine |

**Le périmètre a une seule source de vérité, `spec/spec-lint.json`, et
c'est `spec-lint` qui l'applique** — pas ses appelants. Le hook
`pre-commit` (source `.githooks/`, réinstallé par `chantier installer`)
collecte les `spec/**.md` de l'index et les passe au lint, qui **ignore**
ceux hors périmètre — coût nul si aucun, et un commit sur
`spec/shared/design.md` n'est pas refusé pour une zone qui n'a pas encore
ses en-têtes. Même principe pour `chantier livrer` (notes privées du
chantier) et `npm test` (`spec-lint` complet enregistré sur le corpus
réel dans `tests/index.ts`).

#### Références `§` vers un titre à lien ou parenthèse (défaut relevé au 6b)

`referencesSection` ne sait pas citer un titre qui contient un lien
Markdown ou une parenthèse médiane (« § 6 bis » d'`artefacts.md` a dû
être reformulé ; trois entrées d'`invariants.md` citent le H2 parent
faute de mieux — listées dans `pistes.md`). Le lot 9 corrige le parseur :
la référence `fichier § Titre` est comparée **par slug** au titre cible
(le slug neutralise lien et ponctuation), et une fixture couvre un titre
avec lien, un avec parenthèses, un avec backticks. Puis les trois entrées
sont repointées sur leur vrai titre, **et les deux lignes du routage du
README privé annotées « hors regex du lint » (7b-2) sont réécrites en
`fichier § section`**, pour que le lint les couvre.

#### Hook `Read`

Même patron que `.claude/hooks/refuse-commit-m.mjs` : chemin `spec/**.md`,
aucun `offset`/`limit`, fichier > 300 lignes → refus avec le rappel
`node scripts/spec-toc.mjs <fichier>`. Exception : `invariants.md`.
Câblage dans `.claude/settings.json` (par machine, à recopier). Équivalent
Codex dans `scripts/hooks-codex.mjs`.

#### Skill `.claude/skills/spec-hygiene/`

La recette de B.1 (déplacer, repointer par script en aperçu, relire le
diff, vérifier) et celle du découpage d'un fichier en exception (livré →
état actuel par sections ≤ 500 lignes, envisagé → `pistes.md` +
`decisions/`, en-têtes B.5, retrait de l'exception). **Déclencheur
opérationnel** : un chantier qui doit **modifier le contenu normatif** d'un
fichier listé dans `spec/spec-lint.json` (exceptions) — ajouter ou changer une
règle ou un comportement. Faute, lien, en-tête, statut : pas de
déclenchement.

#### Preuve du lot 9

`node tests/run.mjs spec-lint spec-toc` passe en mode complet sur l'état
final ; un commit d'essai (non conservé) d'un `spec/**.md` avec un bloc de
101 lignes est refusé par `pre-commit` ; un `Read` sans `offset` sur
`optimizer.md` est refusé (vérifié à la main, sortie du hook recopiée dans
le message de commit).

### Reporté volontairement

`harnais-diagnostic-extensions.md` (2 806 lignes, livré / envisagé « ligne
par ligne ») et `artefacts.md` (1 700) : jugement lourd, hors du rapport
coût/valeur tant qu'aucun chantier n'y touche. Ils entrent dans les
exceptions B.4 avec leur condition de suppression ; le skill `spec-hygiene`
les découpe le jour venu.
