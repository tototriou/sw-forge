# Cadrage â€” rangement des specs pour lire Ã  la demande, pas en bloc

âš ï¸ **RÃ©vision 7 â€” cinq revues adversariales intÃ©grÃ©es le 2026-09-16, puis
lots renumÃ©rotÃ©s dans l'ordre d'exÃ©cution ; Ã  valider avant le premier
lot.** Correspondance avec les rÃ©visions 2â€“6 (citÃ©es par les revues) :
0â†’0, 1â†’1, 3â†’2, 7â†’3, 8aâ†’4, 2â†’5, 4aâ†’6a, 4bâ†’6b, 5aâ†’7a, 5bâ†’7b, 6â†’8, 8bâ†’9.
ExÃ©cution par lots, chacun dans une **session neuve**.
**Le brief d'un lot = la partie A (prÃ©ambule commun, â‰ˆ 165 lignes) + la
section du lot dans la partie B.** Ne jamais charger la conversation qui a
produit ce cadrage, ni un lot prÃ©cÃ©dent, ni le reste de la partie B. Le
statut de chaque lot se met Ã  jour **dans le tableau A.7**, dans le commit
qui le termine.

---

## Partie A â€” prÃ©ambule commun (le brief de chaque lot)

### A.1 Pourquoi

`spec/` fait 41 400 lignes, dont 25 700 pour `spec/outils/optimizer/` (privÃ©,
miroir `sw-forge-docs`). **Le coÃ»t n'est pas la profondeur de
l'arborescence, c'est la granularitÃ© interne** : `optimizer.md` public fait
1 910 lignes avec 6 H2 et 5 H3 ; sa section Â« Ã‰cran Â» (â‰ˆ 1 000 lignes) n'a
aucun sous-titre, donc ne peut Ãªtre lue qu'en entier. Deux niveaux d'index
existent dÃ©jÃ  (`spec/README.md` â†’ README de zone â†’ fichiers) ; on n'en
ajoute pas. DÃ©tail du constat : B.0.

### A.2 Cible

Trois natures de documents, sÃ©parÃ©es physiquement :

| Nature | RÃ´le | Lu quand | OÃ¹ |
| --- | --- | --- | --- |
| **Ã‰tat actuel** | normatif, Ã  jour | au dÃ©marrage, **par section** | racine de la zone |
| **DÃ©cision** | conclusion **encore en vigueur** qu'un chantier peut devoir rouvrir (cadrage exÃ©cutÃ©, synthÃ¨se dÃ©cisionnelle) | quand on touche ce qui a Ã©tÃ© dÃ©cidÃ© | `decisions/` |
| **Archive** | document datÃ© qui **n'est plus une source de vÃ©ritÃ© active** : sa conclusion est absorbÃ©e ailleurs, ou explicitement laissÃ©e comme historique Ã  consulter si besoin (historique, discussions, analyses, audits clos) ; **et les artefacts de preuve** d'un chantier (contrÃ´les, dÃ©cisions bloc par bloc), dont la valeur est justement leur contenu brut | jamais par dÃ©faut | `archive/` |

Le critÃ¨re de rangement d'un nouveau document est la deuxiÃ¨me colonne, pas
son genre : une analyse dont la conclusion vit dans une synthÃ¨se est une
archive ; une synthÃ¨se dont la conclusion est encore appliquÃ©e est une
dÃ©cision. Une archive dont on ne sait pas encore *oÃ¹* la conclusion a Ã©tÃ©
reprise reste une archive (`conclusion reprise dans : Ã€ prÃ©ciser`) : ce
qu'on affirme en la classant, c'est qu'elle **n'est plus active**, pas
qu'on a fini de la cartographier.

RÃ¨gles de forme â€” **deux rÃ©gimes**, celui qu'implÃ©mente le lint (B.4) :

- **Documents actifs** (Ã©tat actuel, dÃ©cisions, README, index) :
  1. **bloc terminal â‰¤ 80 lignes** (objectif rÃ©dactionnel ; refus au-delÃ 
     de **100**) â€” dÃ©finition exacte en B.4 ;
  2. **en-tÃªte selon la nature** (modÃ¨les en B.5) ; un `head -12` suffit Ã 
     dÃ©cider de lire ou non ;
  3. **fichier â‰¤ 500 lignes** hors exceptions dÃ©clarÃ©es (B.4). Un fichier
     trop long se dÃ©coupe **quand un chantier doit modifier son contenu
     normatif** â€” pas pour une faute, un lien ou un en-tÃªte ;
  4. **slugs de titres uniques** dans le fichier, pour que `fichier Â§
     section` dÃ©signe une seule chose.
- **`archive/`** : seul l'en-tÃªte `Statut : ARCHIVE` est exigÃ©. Aucune
  contrainte de longueur ni d'unicitÃ© â€” une archive ne se dÃ©coupe pas.
  **Tout `.md` crÃ©Ã© sous `archive/`** (README, fichier de preuve, note)
  reÃ§oit cet en-tÃªte **au moment de sa crÃ©ation**, pas aprÃ¨s.

**PÃ©rimÃ¨tre du lint pour ce chantier : `spec/outils/**`** (public + privÃ©),
dÃ©clarÃ© dans `spec/spec-lint.json`. Les autres zones (`shared/`, `compte/`,
`rta/`, `siege/`, `releases.md`) n'ont ni en-tÃªte ni exception : elles
rejoignent le pÃ©rimÃ¨tre par un lot M ultÃ©rieur chacune (en-tÃªtes, mesure,
exceptions), pas par ce cadrage.

### A.3 HiÃ©rarchie des prioritÃ©s

Dans l'ordre, et le suivant ne s'achÃ¨te jamais au prix du prÃ©cÃ©dent :

1. ne perdre aucune information normative ou dÃ©cisionnelle ;
2. prÃ©server la correction et la traÃ§abilitÃ© (provenance explicite) ;
3. rendre les erreurs **observables** (diff, citation, test nÃ©gatif) ;
4. rÃ©duire le volume lu ;
5. rÃ©duire le coÃ»t du modÃ¨le.

ConcrÃ¨tement : si lire 500 lignes de plus Ã©vite une omission plausible, on
les lit. On minimise le contexte **sous contrainte de correction**, pas
l'inverse. **Un plafond de sortie (â‰¤ 40, â‰¤ 60, â‰¤ 150 lignesâ€¦) est un
objectif de compacitÃ©, jamais une autorisation d'omettre** : si tout ce
qui est nÃ©cessaire ne tient pas, on dÃ©passe ou on scinde (`-1.md`,
`-2.md`), on ne tronque pas.

### A.4 CatÃ©gories de lots, modÃ¨les et efforts

La difficultÃ© d'un lot est durable ; le modÃ¨le qu'on lui affecte ne l'est
pas. D'oÃ¹ deux tables.

| CatÃ©gorie | Nature | Preuve attendue |
| --- | --- | --- |
| **M** â€” mÃ©canique | dÃ©placer, repointer, poser un en-tÃªte depuis un modÃ¨le, vÃ©rifier par `grep` | un diff relu, un `grep` vide |
| **C** â€” classification | lire pour classer (sous-titrer, extraire, trier livrÃ© / envisagÃ©) | une sortie structurÃ©e avec coordonnÃ©es source |
| **J** â€” jugement | consolider, trancher, supprimer | une dÃ©cision par Ã©lÃ©ment, avec sa justification et la citation source |

Affectation courante (2026-09) : **M â†’ Sonnet 5, effort bas Â· C â†’ Sonnet 5,
effort moyen Â· J â†’ Opus 5, effort Ã©levÃ©** (moyen si l'intrant est â‰¤ 100
lignes). Haiku 4.5 n'est pas retenu : sur des lots dÃ©jÃ  courts, l'Ã©conomie
ne vaut pas un lien cassÃ© passÃ© inaperÃ§u.

Principe : **le modÃ¨le J ne lit pas un gros fichier en entier par dÃ©faut.**
Un lot C produit d'abord un extrait structurÃ© ; J travaille sur l'extrait
et **contrÃ´le** contre la source par lecture partielle. C'est un dÃ©faut,
pas un interdit â€” A.3 prime.

### A.5 Branche, chantier, conflits

- Branche **`forge/spec-rangement`** depuis
  **`forge/audit-degats-conditionnels-etape-2`** â€” elle contient tout
  `forge/orchestration-parallele` (dispositif `chantier`, hooks) **plus**
  les modifications de l'audit sur `spec/outils/optimizer.md` (+34) et
  `spec/outils/degats-reels.md` (+173), que les lots 2, 4, 5 et 6a vont
  prÃ©cisÃ©ment retravailler ; partir d'un Ã©tat antÃ©rieur rendrait leur
  travail faux Ã  la fusion. `chantier ouvrir`, puis Ã  la fin de
  chaque lot : `chantier livrer` â†’ `chantier verifier` â†’ **`chantier
  integrer` immÃ©diatement**, sinon le chantier relique ne voit pas les
  nouveaux chemins.
- **`forge/implementation-relique` est ouvert (0 commit au 2026-09-16,
  avancÃ© sur l'audit `b2538ab`).** `reliques.md` ne bouge pas, ne change
  pas de nom, n'est pas rÃ©Ã©crit â€” **Ã  une exception prÃ¨s : son en-tÃªte
  DÃ‰CISION de 5 lignes, posÃ© au lot 5 en tÃªte de fichier**, parce que le
  lint l'exige sur tout fichier actif ; le chantier relique modifiera le
  corps, jamais ces lignes, et le merge documentaire les sÃ©pare sans
  conflit. **Sa premiÃ¨re action, le jour oÃ¹ il
  dÃ©marre : `git merge --ff-only forge/spec-rangement`** dans son worktree
  â€” gratuit tant qu'il est Ã  zÃ©ro commit, un vrai merge sur
  `optimizer.md` aprÃ¨s. Pas d'avance intermÃ©diaire tant que personne n'y
  travaille : elle serait Ã  refaire Ã  chaque lot.
- Fichiers transverses portÃ©s par ce chantier : `spec/README.md`,
  `ARCHITECTURE.md`, `CLAUDE.md`, `tests/index.ts`. `App.tsx` non touchÃ©.
- RÃ¨gles de commit du dÃ©pÃ´t : heredoc, jamais `-m` ; un commit = une raison ;
  script dans le scratchpad, jamais `sed -i`/`node -e` en ligne.

### A.6 Quand une vÃ©rification Ã©choue ou qu'un cas est ambigu

- **VÃ©rification Ã©chouÃ©e â†’ pas de commit.** Corriger si la cause est
  mÃ©canique ; sinon s'arrÃªter et rapporter, le lot reste Â« en cours Â».
- **AmbiguÃ¯tÃ© sÃ©mantique â†’ conserver l'information.** On ne supprime pas ce
  qu'on ne sait pas classer : on le laisse en place avec la marque
  `<!-- Ã€ trancher : â€¦ -->` et une ligne dans `pistes.md`.
- **Une vÃ©rification se matÃ©rialise** : diff relu, citation recopiÃ©e,
  `grep` vide, test nÃ©gatif qui refuse. Â« J'ai vÃ©rifiÃ© Â» sans artefact ne
  compte pas. **Support des preuves** : les fichiers de contrÃ´le
  (`controle-6b.md`, `decisions-7b.md`, aperÃ§us de repointage) ne restent
  pas dans le scratchpad : ils sont Ã©crits dans
  `spec/outils/optimizer/archive/controles-rangement-2026-09/` (nature
  ARCHIVE au sens de A.2 : artefacts de preuve) et **livrÃ©s par `chantier
  livrer`**, donc versionnÃ©s dans `sw-forge-docs`. Chacun est crÃ©Ã© avec
  **un H1** (`# <Objet> â€” lot <n>`) **puis** l'en-tÃªte `**Statut :**
  ARCHIVE â€” preuve d'exÃ©cution du cadrage spec-rangement, lot <n>,
  <date>` â€” l'en-tÃªte se lit *sous le H1* (B.3), sans H1 le lint ne le
  voit pas (retour du lot 6a : 15 fichiers sans titre). Le message de
  commit cite le fichier de preuve ; il ne le remplace pas.
- **OÃ¹ vit le commit d'un lot** (convention actÃ©e au lot 0) :
  `spec/outils/optimizer/` est gitignorÃ© dans le dÃ©pÃ´t de code, et
  `chantier livrer` commite les notes dans `sw-forge-docs` avec un message
  gÃ©nÃ©rique qu'on ne rÃ©dige pas. Donc un lot qui ne touche **que** des
  notes privÃ©es n'a **aucun commit `docs(optimizer)`** dans le dÃ©pÃ´t de
  code : sa preuve vit dans son fichier de preuve (ci-dessus) **et** dans
  le commit `docs(cadrage): lot <n> terminÃ©`, qui met Ã  jour A.7 et
  embarque commandes et sorties d'observation. Un lot qui touche aussi des
  fichiers suivis (spec publique, `src/`, `scripts/`, `tests/`) a en plus
  ses commits normaux, un par raison.

### A.7 Ordre, dÃ©pendances, suivi

DÃ©pendances rÃ©elles â€” notation **`A â†’ B` : B requiert A** (prÃ©requis Ã 
gauche) :

```text
1 â†’ 2         2 â†’ 3 (spec-toc se teste sur un fichier dÃ©jÃ  sous-titrÃ©, et Ã©tend spec-markdown.mjs crÃ©Ã© au lot 2)
3 â†’ 4 (4 ne teste que des fixtures : pas de dÃ©pendance Ã  1)
4 â†’ 5         1 â†’ 5 (5 enregistre spec-lint-en-tetes sur le pÃ©rimÃ¨tre rÃ©el, archives comprises)
3 â†’ 6a        6a â†’ 6b        4 â†’ 6b
3 â†’ 7a        7a â†’ 7b        6b â†’ 7b (le routage cite invariants.md)
7b â†’ 8 (8 documente l'Ã©tat final)          {4, 5, 6b, 7b, 8} â†’ 9
```

Ordre d'exÃ©cution = **ordre des numÃ©ros : 0 â†’ 1 â†’ 2 â†’ 3 â†’ 4 â†’ 5 â†’ 6a â†’ 6b
â†’ 7a â†’ 7b â†’ 8 â†’ 9**. `2 â†’ 3` est une dÃ©pendance technique
(`spec-markdown.mjs` naÃ®t au lot 2) ; que le lot 2 passe **aussi** trÃ¨s
tÃ´t rÃ©pond Ã  la contrainte du chantier relique (A.5). 3 puis 4 suivent
pour que tous les lots sÃ©mantiques disposent de `spec-toc` **et** de
`spec-lint`. Seul 0 est libre.

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| 0 en-tÃªtes de statut pÃ©rimÃ©s | M | exÃ©cutÃ© | notes 955e6f0 (`sw-forge-docs`), 2026-09-16 |
| 1 archive/ + decisions/ | M | exÃ©cutÃ© | `baac323`, 2026-09-16 |
| 2 sous-titres `optimizer.md`, naissance de `spec-markdown.mjs` | C | exÃ©cutÃ© | `ed4ba76`, `61ecd9f`, 2026-09-16 |
| 3 `spec-toc` | C | exÃ©cutÃ© | `3776a6d`, `bf2e142`, 2026-09-16 |
| 4 `spec-lint` (infrastructure, fixtures, inventaire des blocs) | C | exÃ©cutÃ© | `7699bb6`, `7b527e4`, 2026-09-16 |
| 5 en-tÃªtes normalisÃ©s, slugs uniques | M + C | exÃ©cutÃ© | `f2d234b`, `9576fb8`, `0694bd2` (code), notes `f9c7f0b`, 2026-09-16 |
| 6a extraction des invariants | C | Ã  faire | |
| 6b consolidation + contrÃ´les | J | Ã  faire | |
| 7a delta privÃ© / public | M | Ã  faire | |
| 7b routage et fin du doublon | J | Ã  faire | |
| 8 rÃ¨gles de rÃ©tention | J (intrant â‰¤ 100 l.) | Ã  faire | |
| 9 enforcement (hooks, skill, CLAUDE.md) | M | Ã  faire | |

---

## Partie B â€” les lots

### B.0 Constat dÃ©taillÃ© et lot 0 â€” en-tÃªtes de statut pÃ©rimÃ©s Â· M

| Zone | Lignes | Nature |
| --- | --- | --- |
| `spec/outils/optimizer/historique/` | 10 600 | chronologie |
| analyses / discussions externes, revue `.txt` | ~1 900 | datÃ©s, Â« conservÃ©s tels quels Â» |
| `audit-degats-conditionnels-2026-09-08/` | ~2 000 | audit clos |
| `README.md` privÃ© | 2 348 | mÃªme squelette de titres que `optimizer.md` public |
| `harnais-diagnostic-extensions.md` | 2 806 | livrÃ© et envisagÃ© mÃªlÃ©s |
| `artefacts.md` | 1 700 | Â« implÃ©mentÃ© Â», en grande partie historique |
| `spec/outils/optimizer.md` (public) | 1 910 | 6 H2, 5 H3 |

DÃ©jÃ  fait, Ã  ne pas refaire : `historique/` (cadrage
`cadrage-rangement-historique.md`, exÃ©cutÃ© au commit `416a242`) ; rÃ¨gle de
synchro ledger â†” source (`CLAUDE.md`).

**Lot 0.** Pour chaque `spec/outils/optimizer/*.md` : lire les **12
premiÃ¨res lignes seulement**. `git log --all --oneline --grep=<sujet>` et
`grep` dans `pistes.md` servent Ã  **dÃ©tecter** un statut suspect, jamais Ã 
le prouver : un commit peut Ãªtre partiel ou revertÃ©. Un statut ne passe Ã 
Â« exÃ©cutÃ© / livrÃ© Â» que sur **un Ã©tat observÃ©** correspondant au rÃ©sultat
annoncÃ© (ex. pour `cadrage-rangement-historique.md` : `historique/` existe
**et** `git grep 'historique-[a-z-]*\.md' -- src scripts tests` ne renvoie
que des chemins `historique/â€¦`). L'observation est notÃ©e dans l'en-tÃªte
sous la forme **dÃ©finitive** du modÃ¨le DÃ‰CISION de B.5 â€” une ligne
`**ExÃ©cution :** commit <sha> â€” vÃ©rifiÃ©e par <observation>` â€” que le lot 5
**conserve telle quelle** quand il normalise le reste de l'en-tÃªte. Notes
privÃ©es seules : pas de commit `docs(optimizer)` (A.6), `livrer` puis
`docs(cadrage): lot 0 terminÃ©`.

Preuve : pour chaque statut modifiÃ©, la commande d'observation et sa sortie
dans le message du commit `docs(cadrage): lot 0 terminÃ©`.

### B.1 Lot 1 â€” `archive/` et `decisions/` Â· M

DÃ©placements **sans lecture du corps** (`git mv` cÃ´tÃ© `sw-forge-docs`,
copie dans le worktree) :

- â†’ `archive/` : `historique/`, `discussions-externes/`,
  `discussions-externes-synthese.md`, `analyse-externe-harnais-diagnostic.md`,
  `analyse-swcalc-rune-optimizer.md`, `revue-code-forge-filterslot-topk-heap.txt`,
  `audit-degats-conditionnels-2026-09-08/`.
- â†’ `decisions/` : `cadrage-rangement-historique.md`,
  `cadrage-score-artefacts-ehp.md`, `synthese-decisionnelle-harnais.md`.
- **Un dossier datÃ© part en bloc**, sauf un fichier qui porte des dÃ©cisions
  encore en vigueur. DÃ©tection **mÃ©canique, sans lire le corps** : nom du
  fichier + ses 12 premiÃ¨res lignes + son sommaire (`grep -n '^#'`), Ã  la
  recherche de titres â€” **H1 compris** (retour du lot 1 : un fichier dont
  le H1 dit Â« DÃ©cisions Â» n'avait aucun H2 ainsi titrÃ©) â€” du type
  Â« DÃ©cision Â», Â« RÃ¨gle Â», Â« Retenu Â», Â« Ã€ faire Â». S'il en porte
  clairement, il est **dÃ©placÃ©** (pas copiÃ©) vers
  `decisions/` avec un lien retour dans le `README.md` du dossier archivÃ© ;
  **s'il est ambigu, il reste en archive** et gagne une ligne de pointeur
  dans `archive/README.md` (Â« peut contenir des dÃ©cisions actives : â€¦ Â»)
  â€” A.6, on ne perd rien, on rend visible. Candidat connu :
  `audit-â€¦/decisions-revue.md`.
- **En-tÃªte ARCHIVE minimal posÃ© mÃ©caniquement** sur chaque `.md` dÃ©placÃ©
  (le lint 4 l'exige, et le lot 5 ne repasse pas sur `archive/`) :
  `**Statut :** ARCHIVE â€” dÃ©placÃ© le <date> depuis <ancien chemin> ;
  conclusion reprise dans : Ã€ prÃ©ciser`. Le champ Â« Ã€ prÃ©ciser Â» se
  complÃ¨te le jour oÃ¹ quelqu'un ouvre le fichier pour de bon ; il n'est
  pas une erreur de lint.
- IntouchÃ©s : `reliques.md` (chantier ouvert), `artefacts.md` (Ã©tat actuel),
  `pistes.md`.
- Repointage : mÃªme procÃ©dÃ© que `416a242`. Motif = **nom de fichier complet
  avec extension** (`analyse-swcalc-rune-optimizer.md`, jamais
  `analyse-swcalc`). Script dans le scratchpad, **mode aperÃ§u d'abord**,
  puis rÃ©Ã©criture ; `git grep` sur `src/ scripts/ tests/ spec/ .claude/`.
  Le `git diff` complet est **relu hunk par hunk avant le commit** : chaque
  hunk ne change qu'un chemin.
- `archive/README.md` (10 lignes), **crÃ©Ã© avec l'en-tÃªte ARCHIVE** (A.2 :
  tout `.md` crÃ©Ã© sous `archive/`) : Â« ne pas lire pour dÃ©marrer ;
  chercher ici par `grep` pour comprendre *pourquoi* Â».
- Deux commits : notes privÃ©es (`livrer`), fichiers suivis repointÃ©s.

Preuve : `git grep -n 'historique/\|discussions-externes\|analyse-\|audit-degats\|revue-code' -- src scripts tests spec .claude` ne renvoie que des chemins `archive/â€¦` ou `decisions/â€¦` ; `chantier verifier` passe ; `integrer` fait.

### B.2 Lot 2 â€” sous-titrer `optimizer.md` public Â· C

Lire une fois la section Â« Ã‰cran (de haut en bas) Â» (l. 268â€“1246) et y
poser des H3/H4 tous les 40â€“80 lignes ; mÃªme chose, plus lÃ©gÃ¨re, sur les
autres H2. Les titres reprennent les libellÃ©s du jeu / de l'Ã©cran.

Consignes strictes :

- **n'ajouter que des lignes commenÃ§ant par `#`** ; aucun mot modifiÃ©,
  dÃ©placÃ© ou supprimÃ© ;
- hiÃ©rarchie propre : **aucun saut de niveau** (pas de H4 directement sous
  un H2), chaque H4 sous le H3 qui prÃ©cÃ¨de, chaque titre dÃ©crit le bloc
  jusqu'au prochain titre de niveau Ã©gal ou supÃ©rieur ;
- aucune **ancre** dupliquÃ©e : contrÃ´le par le slug GitHub, pas seulement
  par le texte du titre.

**Ce lot crÃ©e `scripts/lib/spec-markdown.mjs`** â€” premiÃ¨re version du
parseur partagÃ© que le lot 3 Ã©tendra : `titres(texte)` (lignes `^#{1,6}`
suivi d'une espace, hors bloc de code clÃ´turÃ©) et `slug(titre)` selon l'algorithme de
`github-slugger` (minuscules ; suppression des caractÃ¨res qui ne sont ni
lettre Unicode, ni chiffre, ni espace, ni `-` â€” les accents sont
**conservÃ©s** ; espaces â†’ `-` ; doublons suffixÃ©s `-1`, `-2` dans l'ordre
du fichier). **Une seule implÃ©mentation dans le dÃ©pÃ´t** : ni script
scratch, ni copie dans un hook â€” tout contrÃ´le de slug l'importe. TestÃ©e
dans `tests/fixtures/spec-markdown/` contre des titres rÃ©els du dÃ©pÃ´t
(accents, ponctuation, backticks, doublons).

Preuve (toutes dans le message de commit) :

```bash
git diff spec/outils/optimizer.md | grep -c '^-[^-]'                 # 0 ligne supprimÃ©e
git diff spec/outils/optimizer.md | grep '^+[^+]' | grep -vc '^+#'   # 0 ligne ajoutÃ©e non-titre
node <scratch>/slugs.mjs spec/outils/optimizer.md | sort | uniq -d  # vide â€” importe spec-markdown.mjs
node <scratch>/niveaux.mjs spec/outils/optimizer.md                 # aucun saut de niveau
node tests/run.mjs spec-markdown                                     # le slugger passe ses fixtures
```

puis relecture **humaine** du sommaire (`grep -n '^#'`, ~60 lignes) avant
`integrer`. âš ï¸ Passe **avant** tout commit du chantier relique sur ce fichier.

### B.3 Lot 3 â€” `scripts/spec-toc.mjs` Â· C

`node scripts/spec-toc.mjs <fichier|dossier> [--json]` imprime, par
fichier : l'en-tÃªte (statut, lire si), puis chaque titre avec **niveau,
plage de lignes, premiÃ¨re phrase**. â‰¤ 60 lignes pour un fichier de 2 000.

DÃ©finitions exactes :

- **titre** : ligne `^#{1,6}` suivi d'une espace, hors bloc de code clÃ´turÃ© (```` ``` ```` ou
  `~~~`) ;
- **plage** : du titre inclus Ã  la ligne prÃ©cÃ©dant le prochain titre de
  niveau **â‰¤** au sien ;
- **premiÃ¨re phrase** : premier paragraphe de prose de la section, hors
  titres, blocs de code, tableaux et lignes vides ; un item de liste compte
  comme prose et **forme Ã  lui seul son paragraphe** (marqueur `-`/`1.`
  conservÃ© ; sans Ã§a une liste sans ligne vide interne deviendrait la
  Â« phrase Â» entiÃ¨re â€” arbitrage du lot 3) ; tronquÃ© Ã  120 caractÃ¨res ;
  `â€”` si la section n'a pas de prose avant son premier sous-titre ;
- **en-tÃªte** : les lignes `**Champ :** valeur` entre le H1 et la premiÃ¨re
  ligne qui n'en est pas une, **les lignes vides Ã©tant transparentes**
  (tous les en-tÃªtes rÃ©els du dÃ©pÃ´t ont une ligne vide entre le H1 et
  `**Statut :**` ; sans Ã§a aucun ne serait lu â€” arbitrage du lot 3, qui
  vaut pour le lint du lot 4 et les modÃ¨les du lot 5) ; `statut` = la
  valeur du champ `Statut :` si prÃ©sent ;
- **mode dossier** : parcours **rÃ©cursif** de tous les `.md`, hors
  `node_modules/` et `.git/`. Ã‰crit au lot 3 sans test ; **le lot 4, qui
  s'en sert pour son inventaire, ajoute la fixture** (dossier avec
  sous-dossier et un `.md` Ã  ignorer). **Bootstrap** : le lot 3 s'exÃ©cute avant le lot 5, donc un
  en-tÃªte absent ou ancien (prose, âš ï¸ libre) **n'est pas une erreur** :
  `statut: null`, `lireSi: null`, et le sommaire est produit normalement.
  C'est `spec-lint` (4) qui juge l'en-tÃªte, pas `spec-toc` ;
- `--json` : `[{fichier, statut, lireSi, sections: [{niveau, titre, slug,
  debut, fin, premierePhrase}]}]`.

Le **parseur Markdown** vit dans `scripts/lib/spec-markdown.mjs`, **crÃ©Ã©
au lot 2** (titres, slug) et **Ã©tendu ici** (plages, en-tÃªte, premiÃ¨re
phrase), puis partagÃ© avec `spec-lint` (4) : une seule dÃ©finition de
Â« titre Â», de Â« section Â» et de Â« slug Â» dans le dÃ©pÃ´t. Deux contraintes
hÃ©ritÃ©es du lot 2 : `slug(titre, compteurs)` prend une `Map` **fournie par
l'appelant** â€” une `Map` neuve **par fichier**, sinon les suffixes `-1`
fuient d'un fichier Ã  l'autre ; et le module a un sidecar
`spec-markdown.d.mts` pour `tsc` â€” toute fonction ajoutÃ©e au `.mjs` est
dÃ©clarÃ©e dans le `.d.mts`, dans le mÃªme commit. `â‰¤ 60 lignes`
est un objectif de compacitÃ© (A.3) : **tous les titres sont toujours
imprimÃ©s**, quel que soit leur nombre.

EnregistrÃ© dans `tests/index.ts` (`spec-toc`) avec des **fixtures
synthÃ©tiques** dans `tests/fixtures/spec-toc/` : titres imbriquÃ©s, fichier
sans H2, bloc de code contenant `#`, section vide, dernier titre du
fichier, accents et ponctuation Markdown dans les titres, texte avant le
premier titre, **fichier sans en-tÃªte normalisÃ©** (statut `null`). Plus un test sur `spec/outils/optimizer.md` rÃ©el : chaque H2
prÃ©sent, `--json` parse et porte les mÃªmes sections. MentionnÃ© dans
`CLAUDE.md` Â§ VÃ©rifier comme la faÃ§on d'ouvrir une spec.

### B.4 Lot 4 â€” `spec-lint` (infrastructure) Â· C â€” contrat exact

Livre `spec-lint` et ses tests sur fixtures ; les lots 5, 6b et 7b s'en
servent comme preuve. L'enforcement (`pre-commit`, `chantier livrer`, hook
`Read`, skill, `CLAUDE.md`) est le lot 9, dernier : scinder Ã©vite d'Ã©crire
deux fois la mÃªme logique en scripts scratch temporaires.

Construit sur `scripts/lib/spec-markdown.mjs` (le parseur du lot 3 : mÃªme
dÃ©finition de titre, de section, d'en-tÃªte, de slug).

- **Bloc terminal** : les lignes entre un titre (exclu) et le prochain titre
  de **n'importe quel niveau** (exclu), ou la fin du fichier ; le texte
  avant le premier titre est un bloc terminal (le prÃ©ambule). Un titre = ligne
  `^#{1,6}` suivi d'une espace, **hors bloc de code clÃ´turÃ©**. Lignes vides comptÃ©es, tableaux
  et listes comptÃ©s (un tableau de 120 lignes est un bloc Ã  dÃ©couper ou Ã 
  sortir en fichier `.csv`/`.md` dÃ©diÃ©). Pas de frontmatter dans ce dÃ©pÃ´t ;
  s'il en apparaÃ®t, il est exclu.
- **Refus (hors `archive/`)** : bloc terminal > **100** lignes ; fichier
  > **500** lignes ; en-tÃªte absent ou sans champ `Statut :` reconnu (B.5) ;
  **deux titres du mÃªme fichier avec le mÃªme slug** (sinon `fichier Â§
  section` est ambigu â€” GitHub suffixe `-1`, `-2`, une rÃ©fÃ©rence textuelle
  ne le dit pas) ; `Source : fichier Â§ section` ou lien `fichier Â§
  section` qui ne rÃ©sout pas vers un titre existant (slug GitHub, unique
  par construction).
- **`archive/` : seule la prÃ©sence d'une ligne `**Statut :** ARCHIVE` est
  exigÃ©e.** Ni longueur, ni unicitÃ©, ni autres champs : une archive ne se
  dÃ©coupe pas (c'est sa dÃ©finition), et `historique/` seul ferait Ã©chouer
  tout lint de longueur. `Ã€ prÃ©ciser` dans un en-tÃªte n'est jamais une
  erreur.
- Pas de contrÃ´le de saut de niveau (un H2 â†’ H4 est un dÃ©faut de forme, pas
  de lisibilitÃ©) ; il reste au lot 2 et Ã  la review.
- **Deux cibles distinctes dans `tests/index.ts`, au sens fixe** â€” une
  commande de preuve signifie la mÃªme chose quel que soit le moment :
  - `spec-lint-en-tetes` : en-tÃªtes, unicitÃ© des slugs, rÃ©solution des
    `Â§`. EnregistrÃ©e sur le corpus rÃ©el **au lot 5** ;
  - `spec-lint` : tout ce qui prÃ©cÃ¨de **plus** les longueurs et les
    exceptions. EnregistrÃ©e sur le corpus rÃ©el **au lot 9** (avant, elle
    ne peut pas passer : les longueurs ne sont tenables qu'aprÃ¨s 7b). Un
    filtre qui ne correspond Ã  rien Ã©choue en listant ce qui existe â€” pas
    de faux vert possible.
  - **Au lot 4, les deux cibles ne tournent que sur les fixtures.** Le
    corpus rÃ©el n'a pas encore ses en-tÃªtes (lot 5) ; d'oÃ¹ Â« 4 ne dÃ©pend
    pas de 1 Â» dans A.7.
- **PÃ©rimÃ¨tre et exceptions** : un seul fichier `spec/spec-lint.json` :
  `{ perimetre: ["spec/outils/**"], exceptions: [{ fichier, raison,
  condition_de_suppression, chantier_responsable }] }`. Le pÃ©rimÃ¨tre est
  la liste des zones qui ont reÃ§u leurs en-tÃªtes ; une zone s'y ajoute par
  un lot M dÃ©diÃ© (A.2). Une exception exempte un fichier **des deux rÃ¨gles
  de longueur** (bloc et fichier), pas des en-tÃªtes ni des slugs. Deux
  rÃ¨gles techniques : une entrÃ©e dont le fichier repasse **sous** les
  seuils fait **Ã©chouer** le lint (l'entrÃ©e doit Ãªtre retirÃ©e â€” la liste
  ne peut que dÃ©croÃ®tre silencieusement, jamais stagner) ; une entrÃ©e
  ajoutÃ©e est visible dans la review parce qu'elle vit dans un fichier
  dÃ©diÃ©, et `spec/README.md` dit qu'on n'en ajoute que pour un fichier
  **prÃ©existant au lint**, jamais pour un nouveau.

  **Inventaire mesurÃ© le 2026-09-16** (`wc -l`, fichiers actifs de
  `spec/outils/**` hors futurs `archive/`) â€” les fichiers > 500 lignes :

  | Fichier | Lignes | Sort |
  | --- | --- | --- |
  | `optimizer/README.md` privÃ© | 2 348 | ramenÃ© â‰¤ 500 par 7b â€” **pas d'exception** |
  | `optimizer/harnais-diagnostic-extensions.md` | 2 806 | exception ; suppression : prochain chantier harnais, avant modification normative |
  | `optimizer.md` public | 1 910 | exception ; suppression : dÃ©coupage par sections en fichiers, hors pÃ©rimÃ¨tre de ce cadrage |
  | `degats-reels.md` | 1 877 | exception ; suppression : prochain chantier dÃ©gÃ¢ts |
  | `optimizer/artefacts.md` | 1 700 | exception ; suppression : prochain chantier artÃ©facts |
  | `speed-tuning.md` | 1 229 | exception ; suppression : prochain chantier speed tuning |
  | `optimizer/harnais-diagnostic.md` | 1 141 | exception ; suppression : prochain chantier harnais |
  | `optimizer/pistes.md` | 627 | exception ; suppression : archivage des entrÃ©es closes (lot ultÃ©rieur) |

  Les sept exceptions initiales sont donc celles-ci, pas les trois de la
  rÃ©vision 3. Hors pÃ©rimÃ¨tre, **cinq** autres fichiers > 500 existent
  (`shared/design.md` 1 040, `shared/navigation.md` 881,
  `shared/librairie-ui.md` 665, `compte/runes.md` 1 135,
  `siege/recommandations.md` 1 479 ; `rta/` n'en a aucun) : ils entreront
  avec leur zone.

- **Inventaire non bloquant des blocs > 100** â€” dÃ¨s que le parseur
  existe, donc **au lot 4**, pas au dernier lot : sur le pÃ©rimÃ¨tre rÃ©el,
  par fichier actif, nombre de blocs > 100 et taille du plus grand, Ã©crit
  dans le fichier de preuve `inventaire-longueurs-4.md`. Le lint n'a pas
  Ã  passer Ã  ce stade ; le but est de connaÃ®tre la dette avant les lots
  de transformation restants (5â€“8), et de savoir si Â« 9 reste
  mÃ©canique Â» tient. RÃ¨gle de traitement
  (appliquÃ©e en 9, dÃ©cidÃ©e ici) : un fichier actif hors exception qui
  n'Ã©choue **que** sur un ou deux blocs reÃ§oit des sous-titres Ã  la maniÃ¨re
  du lot 2 (lignes `#` seulement, mÃªmes preuves) ; au-delÃ , il entre en
  exception **avec le schÃ©ma complet** â€” `raison`,
  `condition_de_suppression` opÃ©rationnelle (Â« prochain chantier
  &lt;domaine&gt;, avant premiÃ¨re modification normative Â»),
  `chantier_responsable` â€” jamais un `{ fichier, raison: "trop de
  blocs" }`, et jamais de refonte de contenu au lot 9.

  **RÃ©sultat de l'inventaire (lot 4, `inventaire-longueurs-4.md`)** :
  19 fichiers actifs, 11 avec un bloc > 100. Hors exceptions et hors
  README privÃ© (traitÃ© par 7b), **quatre fichiers, un seul bloc chacun** :
  `limites-connues.md` (232), `passifs-vitesse.md` (222),
  `algorithme.md` (160), `decisions/cadrage-score-artefacts-ehp.md`
  (135) â†’ sous-titres au lot 9, aucune exception nouvelle ; le lot 9
  reste mÃ©canique. Note : les 266 lignes d'`optimizer.md` sont son
  prÃ©ambule (avant le premier H2), non sous-titrÃ© au lot 2 â€” couvert par
  l'exception, Ã  traiter le jour oÃ¹ l'exception tombe.

Preuve 4 : `node tests/run.mjs spec-lint-en-tetes spec-lint` sur les
**fixtures seules**, `tests/fixtures/spec-lint/`, avec les tests
nÃ©gatifs : bloc de 101 lignes refusÃ©, fichier de 501 lignes refusÃ©, deux
titres de mÃªme slug refusÃ©s, `Source :` cassÃ© refusÃ©, exception pÃ©rimÃ©e
refusÃ©e, fichier d'`archive/` de 3 000 lignes avec deux titres identiques
**acceptÃ©** avec son seul `Statut : ARCHIVE`, `Ã€ prÃ©ciser` acceptÃ©,
**fichier hors pÃ©rimÃ¨tre sans en-tÃªte ignorÃ©**, fichier dans le
pÃ©rimÃ¨tre sans en-tÃªte refusÃ© ; plus `inventaire-longueurs-4.md` livrÃ©.

### B.5 Lot 5 â€” en-tÃªtes par nature, slugs uniques Â· M + C

Sur chaque fichier du pÃ©rimÃ¨tre hors `archive/` (11 privÃ©s Ã  la racine,
3 dans `decisions/`, 5 publics dans `spec/outils/`) â€” `archive/` a reÃ§u
son en-tÃªte minimal au lot 1 et n'est pas repassÃ©. `reliques.md` reÃ§oit
**son en-tÃªte et rien d'autre** (A.5). Une ligne vide entre le H1 et le
premier champ, comme partout dans le dÃ©pÃ´t (le parseur la tolÃ¨re, B.3). Intrants : les 12 premiÃ¨res lignes, `node
scripts/spec-toc.mjs <fichier>`, et les **liens entrants** (`git grep -l
<nom-de-fichier>`), qui disent *qui* consulte ce fichier et pour quoi.

Trois modÃ¨les, un par nature â€” un champ qui serait artificiel pour la
nature du fichier n'existe pas dans son modÃ¨le. Aucune date Â« de dernier
commit Â» : Git la connaÃ®t dÃ©jÃ , et un tel champ serait faux au premier
oubli. `VÃ©rifiÃ© le` est optionnel et signifie Â« derniÃ¨re relecture
explicite Â», rien d'autre.

```markdown
# <Titre>                                   â† Ã‰TAT ACTUEL
**Statut :** Ã‰TAT ACTUEL â€” dÃ©crit <quoi>
**Lire si :** â€¦
**Ne pas lire si :** â€¦
**Voir aussi :** <fichier Â§ section>, â€¦
**VÃ©rifiÃ© le :** AAAA-MM-JJ                 (optionnel)

# <Titre>                                   â† DÃ‰CISION
**Statut :** DÃ‰CISION <date> â€” <la dÃ©cision en une phrase>
**Remplace / remplacÃ© par :** â€¦ (ou Â« â€” Â»)
**ExÃ©cution :** commit <sha> â€” vÃ©rifiÃ©e par <observation>   (si exÃ©cutÃ©e ; posÃ©e par le lot 0, conservÃ©e ici)
**Lire si :** â€¦

# <Titre>                                   â† ARCHIVE (posÃ© au lot 1, complÃ©tÃ© Ã  l'usage)
**Statut :** ARCHIVE â€” dÃ©placÃ© le <date> depuis <ancien chemin> ; conclusion reprise dans <fichier Â§ section | Ã€ prÃ©ciser>
**Chercher ici pour :** â€¦                   (optionnel)
```

**RÃ¨gle de non-invention** : si Â« lire si / ne pas lire si Â» ne se dÃ©duit
pas avec confiance de ces intrants, Ã©crire `Ã€ prÃ©ciser` â€” jamais une
formule plausible. Un `Ã€ prÃ©ciser` vaut une ligne dans `pistes.md`.

**Slugs dupliquÃ©s** (la part C du lot) : renommer les titres dont le slug
est en double dans un fichier actif (A.2 rÃ¨gle 4) en ajoutant le contexte
au titre (Â« VÃ©rification Â» â†’ Â« VÃ©rification â€” artÃ©facts Â»), jamais en
supprimant un titre. **Renommer un titre est une migration de rÃ©fÃ©rence**,
pas une retouche, et elle porte sur les **ancres effectives**, pas sur les
seuls titres renommÃ©s : trois Â« VÃ©rification Â» donnent `#verification`,
`#verification-1`, `#verification-2` ; renommer le deuxiÃ¨me fait glisser
le troisiÃ¨me vers `#verification-1` sans qu'on l'ait touchÃ©. Donc, pour
chaque fichier modifiÃ©, `spec-toc --json` **avant** et **aprÃ¨s** donne la
table complÃ¨te `occurrence â†’ slug effectif` ; la diffÃ©rence des deux
tables (tout slug qui change, renumÃ©rotÃ© ou renommÃ©) est Ã©crite dans le
fichier de preuve `renommages-5.md` ; puis `git grep` de **chaque** ancien
slug effectif (`#ancien-slug`) et de l'ancien intitulÃ© (`fichier Â§ Ancien
titre`) sur `src/ scripts/ tests/ spec/ .claude/` ; repointage des
rÃ©fÃ©rences non ambiguÃ«s, diff relu ; une rÃ©fÃ©rence ambiguÃ« est laissÃ©e
telle quelle **et** listÃ©e dans `renommages-5.md` avec la raison.

Ce lot **resserre le lint** (retour du lot 4, qui n'avait pas lu les
modÃ¨les) : `Statut :` reconnu = valeur qui **commence par** `Ã‰TAT ACTUEL`,
`DÃ‰CISION` ou `ARCHIVE` â€” plus seulement Â« prÃ©sent et non vide Â» ; fixture
nÃ©gative `Statut : n'importe quoi` refusÃ©e. Puis il **enregistre
`spec-lint-en-tetes` dans `tests/index.ts`** sur le pÃ©rimÃ¨tre rÃ©el
(`spec/outils/**`, archives comprises) : c'est la premiÃ¨re fois que le
lint en mode en-tÃªtes peut passer, puisque les en-tÃªtes viennent d'Ãªtre
posÃ©s.

Preuve : `node tests/run.mjs spec-lint-en-tetes` passe sur le pÃ©rimÃ¨tre
rÃ©el ; `git grep` de chaque ancien slug renvoie vide (ou les cas justifiÃ©s
de `renommages-5.md`) ; la liste des `Ã€ prÃ©ciser` figure dans le message
de commit.

### B.6 Lot 6 â€” `invariants.md`

#### Statut du fichier (fixÃ© ici, pas rediscutÃ©)

`invariants.md` est un **index de contraintes critiques**, pas une source
normative. Chaque entrÃ©e : une phrase impÃ©rative + **`Source : fichier Â§
section`** (rÃ©fÃ©rence durable ; `fichier:ligne` ne sert qu'au contrÃ´le,
dans les fichiers de preuve). Le fichier fait â‰¤ 250 lignes, groupÃ© par sujet (stats et
slots, algorithme, artÃ©facts, workers, harnais, UI), et **se lit en entier
au dÃ©marrage d'un chantier Optimizer** â€” c'est le seul fichier pour lequel
on assume cette lecture intÃ©grale, et son plafond existe pour Ã§a.

Maintenance : **une rÃ¨gle normative modifiÃ©e se modifie dans sa source ET
dans `invariants.md`, dans le mÃªme commit** (mÃªme principe que ledger â†”
source). `spec-lint` (4) vÃ©rifie que chaque `Source : fichier Â§ section`
rÃ©sout vers un titre existant â€” une source disparue fait Ã©chouer le lint.

#### 6a â€” extraction Â· C, une session par fichier > 800 lignes

Sources : `README.md` privÃ©, `algorithme.md`, `limites-connues.md`,
`artefacts.md`, `near-miss-appariement.md`, `parallelisation-partagee.md`,
`harnais-diagnostic.md` ; cÃ´tÃ© public `optimizer.md`, `degats-reels.md`.
**Pas `decisions/vitesse-finale.md`** : cadrage invalidÃ© (DÃ‰CISION Â« ne
pas faire Â»), ses rÃ¨gles sont prÃ©cisÃ©ment celles qu'il dÃ©clare fausses.
Plus gÃ©nÃ©ralement, **aucun fichier de `decisions/`** n'est une source
d'invariants â€” une dÃ©cision se cite, elle ne se rÃ©extrait pas. Commencer par `spec-toc`, lire
**toutes** les sections d'Ã©tat actuel (pas seulement les Â« candidates Â» â€”
A.3 : un invariant est souvent une phrase perdue dans une description),
sauter les sections marquÃ©es historiques ou envisagÃ©es. Sortie :
`invariants-<source>.md`, objectif â‰¤ 40 lignes â€” **chaque rÃ¨gle qui
rÃ©pond au critÃ¨re y figure, quel qu'en soit le nombre** (A.3 : scinder en
`-1.md`, `-2.md` plutÃ´t que fusionner ou omettre) ; chaque rÃ¨gle = phrase
impÃ©rative + `fichier:ligne` + `fichier Â§ section`. CritÃ¨re : Â« un
chantier qui l'ignore casse quelque chose Â» â€” pas les descriptions, pas
les raisons.

#### 6b â€” consolidation et deux contrÃ´les Â· J

Intrant : les extraits (â‰ˆ 300 lignes) + les mÃ©moires agent existantes
(rÃ¨gles de stats, arithmÃ©tique joker/piÃ¨ces, fidÃ©litÃ© des scripts). **Les
mÃ©moires ne prouvent jamais un invariant** : elles servent Ã  suggÃ©rer des
candidats ou Ã  dÃ©tecter une omission. Une rÃ¨gle issue d'une mÃ©moire
n'entre dans `invariants.md` que si elle est **retrouvÃ©e dans une source
normative du dÃ©pÃ´t** et reÃ§oit son `Source : fichier Â§ section` ; sinon
elle devient une piste dans `pistes.md` (Â« rÃ¨gle connue de l'agent, non
retrouvÃ©e dans la spec Â»), pas un invariant. Sortie : `invariants.md`,
plus `controle-6b.md` dans le dossier de preuves (A.6).

**ContrÃ´le de prÃ©cision** (1 rÃ¨gle sur 5, tirÃ©e au sort par sujet) :
ouvrir la source par **lecture partielle** (`Read(offset, limit)` ou `sed -n
'X,Yp'`, Â± 15 lignes autour de la citation), **recopier la ligne source**
dans `controle-6b.md`. Trois Ã©tats, Ã  ne pas confondre :

- Ã©chantillonnÃ©e et **confirmÃ©e** â†’ conservÃ©e ;
- Ã©chantillonnÃ©e et **infirmÃ©e** â†’ retirÃ©e, pas reformulÃ©e ; **deux
  infirmations sur la mÃªme source â†’ 6a est refait pour cette source** (la
  mÃ©thode est en cause, pas la rÃ¨gle) ;
- **non Ã©chantillonnÃ©e** â†’ conservÃ©e telle quelle.

**ContrÃ´le de rappel** (indÃ©pendant des extraits) : choisir **3 sections**
d'Ã©tat actuel parmi les plus normatives â€” `limites-connues.md`,
`algorithme.md` Â§ contraintes, `optimizer.md` Â§ Contraintes (le routage du
lot 7 n'existe pas encore Ã  ce stade) â€”, les lire en entier, et rÃ©pondre par Ã©crit dans
`controle-6b.md` : Â« existe-t-il ici une rÃ¨gle rÃ©pondant au critÃ¨re et
absente des extraits ? Â». **Une omission trouvÃ©e â†’ 6a est refait pour
cette source** avec le critÃ¨re prÃ©cisÃ© par l'omission, puis un nouveau
tirage de 3 sections. CoÃ»t : ~300 lignes par tour ; A.3 dit que c'est
rentable.

Preuve : `controle-6b.md` (rÃ¨gle â†’ citation, sections de rappel â†’ verdict ;
en-tÃªte ARCHIVE de preuve, A.6) livrÃ© avec les notes et citÃ© dans le
commit ; `spec-lint-en-tetes` rÃ©sout toutes les `Source :`.

### B.7 Lot 7 â€” README privÃ© : fin du doublon, routage

#### 7a â€” delta privÃ© / public Â· M

Appariement par titre (`spec-toc --json` des deux cÃ´tÃ©s) en **trois
catÃ©gories** : sections appariÃ©es, **sections uniquement privÃ©es**,
sections uniquement publiques. Un script scratch produit, par section :

```text
Section : <titre>                              [appariÃ©e | privÃ©e seule | publique seule]
public : 120 l.  privÃ© : 145 l.  communes : 110 l.
privÃ© seulement : 35 l., en blocs : l. 84â€“96, l. 134â€“155
public seulement : 10 l., en blocs : l. 40â€“49
```

Pour une section **privÃ©e seule**, la section entiÃ¨re est le delta privÃ© :
elle est dÃ©coupÃ©e en blocs de â‰¤ 40 lignes (aux frontiÃ¨res de paragraphes)
et passe intÃ©gralement en 7b. **Aucune section privÃ©e n'est rÃ©Ã©crite ou
supprimÃ©e sans Ãªtre passÃ©e par 7b.**

Algorithme du delta : un **diff sÃ©quentiel** (LCS â€” `git diff --no-index
-U0` sur deux fichiers temporaires, sortie parsÃ©e en plages), **jamais une
comparaison d'ensembles** (`comm`, lignes triÃ©es) : l'ordre et les
doublons comptent. Normalisation **minimale** avant comparaison : fins de
ligne (CRLF â†’ LF) et espaces de fin. **Rien d'autre** â€” ni ponctuation, ni
espaces internes : dans un bloc de code, un tableau ou un exemple de
sortie, deux espaces peuvent Ãªtre la donnÃ©e. Une ligne normalisÃ©e Ã  tort
n'arrive jamais en 7b (perte silencieuse, A.3) ; un faux delta coÃ»te
quelques lignes de lecture â€” A.3 tranche pour le faux delta. Sortie :
objectif â‰¤ 150 lignes, **aucun bloc omis** â€” au-delÃ , plusieurs fichiers
`delta-7a-<n>.md`. **Aucun seuil de similaritÃ© ne dÃ©cide de rien** : le
taux prouve Â« beaucoup de lignes identiques Â», pas Â« le reste est sans
valeur Â».

#### 7b â€” dÃ©cision bloc par bloc Â· J

Intrant : la sortie de 7a, puis **les blocs Â« privÃ© seulement Â»** (des
sections appariÃ©es **et** des sections privÃ©es seules) lus par lecture
partielle avec Â± 5 lignes de contexte â€” jamais les deux fichiers entiers.
Pour chaque bloc, une dÃ©cision parmi trois, Ã©crite dans `decisions-7b.md`
(dossier de preuves, A.6) avec la premiÃ¨re ligne du bloc citÃ©e :

- **supprimer** â€” le bloc ne dit rien que le public ne dise (reformulation,
  redite) ;
- **garder en Ã©tat actuel** â€” rÃ¨gle, limite, piÃ¨ge, mesure encore valides :
  va dans le fichier privÃ© thÃ©matique concernÃ© (pas dans le README) ;
- **dÃ©placer en `decisions/`** â€” raison d'un choix.

Un bloc **non supprimÃ© porte une destination explicite et une preuve
aprÃ¨s migration** :

```text
Bloc README l. 412â€“426
DÃ©cision : garder en Ã©tat actuel
Destination : limites-connues.md Â§ Bornes de recherche      (fichier Â§ section EXISTANTS)
ContrÃ´le doublon : grep Â« borne Â», Â« budget Â» â†’ candidats l. 180â€“201 ; section Â« Bornes de recherche Â» RELUE (l. 176â€“210) â†’ absente | dÃ©jÃ  couverte | partiellement couverte
Mode : intÃ©grer tel quel | fusionner avec la formulation existante | ne pas ajouter (dÃ©jÃ  couverte)
Preuve aprÃ¨s migration : limites-connues.md l. 188â€“201 ; premiÃ¨re ligne : Â« â€¦ Â»
```

Le `grep` **localise**, il ne prouve pas l'absence de doublon (synonymes,
rÃ¨gle Ã©clatÃ©e sur plusieurs lignes, section voisine) : c'est la **lecture
de la section destination** (`spec-toc` puis lecture partielle), citÃ©e,
qui dÃ©cide. Â« DÃ©jÃ  couverte Â» est une issue lÃ©gitime : le bloc est alors
supprimÃ© du README avec, pour preuve, la citation de la formulation
existante qui le couvre.

La **preuve aprÃ¨s migration** cite la destination finale (plage de lignes
et premiÃ¨re ligne du bloc tel qu'il y figure ; pour une fusion, la phrase
fusionnÃ©e). Sans elle, la vÃ©rification finale peut passer alors que le
bloc a Ã©tÃ© retirÃ© du README et jamais insÃ©rÃ© â€” la destination Â« qui
rÃ©sout Â» prouve qu'un endroit existe, pas que le contenu y est.

Pour `decisions/`, la destination est un fichier existant **Â§ section**,
ou un nouveau fichier `decisions/<sujet>.md` crÃ©Ã© avec l'en-tÃªte DÃ‰CISION
de B.5. Si aucune destination claire n'existe, le bloc n'est **ni supprimÃ©
ni dÃ©placÃ©** : il reste dans le README rÃ©Ã©crit, sous un dernier H2 Â« Ã€
trancher (reliquat 7b) Â», tel quel, avec `<!-- Ã€ trancher : â€¦ -->` et une
ligne dans `pistes.md` (A.6). Le plafond de 120 lignes du routage ne
compte pas ce reliquat ; le plafond de 500 du lint, si.

Par dÃ©faut, en cas de doute : **garder** (A.6). Les lignes communes sont
supprimÃ©es du privÃ© et remplacÃ©es par un lien vers l'ancre publique. Si le
total supprimÃ© dÃ©passe **300 lignes**, ou si plus de **20 %** des blocs
sont Â« doute Â», **demander avant** de commiter.

Puis le README privÃ© est rÃ©Ã©crit en **routage par tÃ¢che** (â‰¤ 120 lignes),
sur le modÃ¨le d'`ARCHITECTURE.md`, en pointant des **sections** :

```markdown
| Je toucheâ€¦ | Lire d'abord | Puis |
| --- | --- | --- |
| les contraintes de stats | invariants.md Â§ Stats ; optimizer.md Â§ Contraintes | decisions/cadrage-score-artefacts-ehp.md |
| le harnais | harnais-diagnostic.md Â§ Commandes | harnais-diagnostic-extensions.md SEULEMENT si â€¦ |
```

Preuve : `decisions-7b.md` livrÃ© avec les notes et citÃ© dans le commit ;
un script scratch vÃ©rifie **trois propriÃ©tÃ©s** : chaque bloc de 7a y a
une dÃ©cision (aucune plage orpheline) ; chaque bloc non supprimÃ© a une
destination qui rÃ©sout (`fichier Â§ section` existant, ou reliquat) ; **la
premiÃ¨re ligne citÃ©e dans Â« Preuve aprÃ¨s migration Â» est retrouvÃ©e
textuellement dans le fichier destination** (pour Â« dÃ©jÃ  couverte Â», la
citation de la formulation existante l'est). `spec-lint-en-tetes` rÃ©sout
tous les liens de section du routage ; le routage fait â‰¤ 120 lignes hors
reliquat.

### B.8 Lot 8 â€” rÃ¨gles de rÃ©tention Â· J (intrant â‰¤ 100 lignes)

Texte Ã  insÃ©rer tel quel dans `spec/README.md` Â§ Conventions communes :

> **RÃ©tention.** Une mise Ã  jour de spec **remplace** la section obsolÃ¨te,
> elle n'ajoute pas un paragraphe Â« depuis la vâ€¦ Â» â€” l'ancien texte part
> dans `archive/`, datÃ©. Le raisonnement encore utile Ã  une dÃ©cision en
> vigueur va dans `decisions/`. `archive/` reÃ§oit les documents datÃ©s qui
> ne sont plus une source de vÃ©ritÃ© active â€” conclusion dÃ©jÃ  reprise
> ailleurs, ou conservÃ©s comme historique â€” et les artefacts de preuve
> d'un chantier ; une archive n'a qu'un en-tÃªte `ARCHIVE`, aucune
> contrainte de taille. Pour les documents actifs : aucun bloc terminal de
> plus de 80 lignes (le lint refuse Ã  100) ; aucun fichier de plus de 500
> lignes hors exceptions dÃ©clarÃ©es ; slugs de titres uniques. Un
> fichier en exception se dÃ©coupe **avant** qu'un chantier modifie son
> contenu normatif â€” pas pour une faute, un lien ou un en-tÃªte. Chaque
> fichier commence par l'en-tÃªte de sa nature (Ã©tat actuel / dÃ©cision /
> archive). `invariants.md` est un index : une rÃ¨gle modifiÃ©e se modifie
> dans sa source ET dans l'index, dans le mÃªme commit.

Plus, dans `CLAUDE.md` Â§ Â« La spec avant le code Â» : *Â« Ouvrir une spec =
`node scripts/spec-toc.mjs <fichier>` puis la section utile â€” jamais un
fichier entier de plus de 300 lignes sans raison Ã©crite. Avant un chantier
Optimizer : `invariants.md` (en entier, â‰¤ 250 lignes) et le README de
routage. Â»* Et dans `ARCHITECTURE.md`, les lignes Optimizer pointent vers
une **section** de spec, pas un fichier.

### B.9 Lot 9 â€” enforcement Â· M

Une rÃ¨gle Ã©crite s'Ã©rode (`CLAUDE.md` en tÃ©moigne). Chaque rÃ¨gle reÃ§oit un
vecteur, et le cadrage dit **quel niveau de garantie** chacun offre :

| Niveau | Vecteur | Garantie |
| --- | --- | --- |
| 1 â€” invariant dÃ©pÃ´t | `spec-lint` dans `tests/index.ts`, `pre-commit`, `chantier livrer` | refus mÃ©canique, Claude ou Codex |
| 2 â€” garde-fou outil | hook `PreToolUse` sur `Read` (Claude), `hooks-codex.mjs` (Codex) | refuse le chemin **le plus courant** ; ne couvre ni `cat` ni Bash â€” **garde-fou ergonomique**, pas invariant |
| 3 â€” convention agent | `CLAUDE.md`, skill `spec-hygiene` | lue au dÃ©marrage, s'Ã©rode |
| 4 â€” jugement | review du diff de spec | humaine |

**Le pÃ©rimÃ¨tre a une seule source de vÃ©ritÃ©, `spec/spec-lint.json`, et
c'est `spec-lint` qui l'applique** â€” pas ses appelants. Le hook
`pre-commit` (source `.githooks/`, rÃ©installÃ© par `chantier installer`)
collecte les `spec/**.md` de l'index et les passe au lint, qui **ignore**
ceux hors pÃ©rimÃ¨tre â€” coÃ»t nul si aucun, et un commit sur
`spec/shared/design.md` n'est pas refusÃ© pour une zone qui n'a pas encore
ses en-tÃªtes. MÃªme principe pour `chantier livrer` (notes privÃ©es du
chantier) et `npm test` (`spec-lint` complet enregistrÃ© sur le corpus
rÃ©el dans `tests/index.ts`).

#### Hook `Read`

MÃªme patron que `.claude/hooks/refuse-commit-m.mjs` : chemin `spec/**.md`,
aucun `offset`/`limit`, fichier > 300 lignes â†’ refus avec le rappel
`node scripts/spec-toc.mjs <fichier>`. Exception : `invariants.md`.
CÃ¢blage dans `.claude/settings.json` (par machine, Ã  recopier). Ã‰quivalent
Codex dans `scripts/hooks-codex.mjs`.

#### Skill `.claude/skills/spec-hygiene/`

La recette de B.1 (dÃ©placer, repointer par script en aperÃ§u, relire le
diff, vÃ©rifier) et celle du dÃ©coupage d'un fichier en exception (livrÃ© â†’
Ã©tat actuel par sections â‰¤ 500 lignes, envisagÃ© â†’ `pistes.md` +
`decisions/`, en-tÃªtes B.5, retrait de l'exception). **DÃ©clencheur
opÃ©rationnel** : un chantier qui doit **modifier le contenu normatif** d'un
fichier listÃ© dans `spec/spec-lint.json` (exceptions) â€” ajouter ou changer une
rÃ¨gle ou un comportement. Faute, lien, en-tÃªte, statut : pas de
dÃ©clenchement.

#### Preuve du lot 9

`node tests/run.mjs spec-lint spec-toc` passe en mode complet sur l'Ã©tat
final ; un commit d'essai (non conservÃ©) d'un `spec/**.md` avec un bloc de
101 lignes est refusÃ© par `pre-commit` ; un `Read` sans `offset` sur
`optimizer.md` est refusÃ© (vÃ©rifiÃ© Ã  la main, sortie du hook recopiÃ©e dans
le message de commit).

### ReportÃ© volontairement

`harnais-diagnostic-extensions.md` (2 806 lignes, livrÃ© / envisagÃ© Â« ligne
par ligne Â») et `artefacts.md` (1 700) : jugement lourd, hors du rapport
coÃ»t/valeur tant qu'aucun chantier n'y touche. Ils entrent dans les
exceptions B.4 avec leur condition de suppression ; le skill `spec-hygiene`
les dÃ©coupe le jour venu.
