# Vérifications automatiques

```bash
npm test
```

Affiche une ligne par vérification et sort en code 1 si l'une échoue. Les
échecs sont répétés à la fin, avec le nom de leur vérification : un journal
tronqué (celui de la CI) les montre quand même.

`node tests/run.mjs <filtre>` ne lance que les vérifications dont le nom
correspond (voir [index.ts](index.ts)), plusieurs filtres possibles. Le
filtre se compare au nom mis à plat : `speed-tune`, `speedtune` et
`SpeedTune` marchent tous. Un filtre qui ne correspond à rien échoue en
listant les noms disponibles, jamais en ne testant rien.

## Ce qui est couvert

| Nature | Où | Ce qui est vérifié |
|---|---|---|
| Calculs | la plupart des `*.test.ts` | fonctions pures de `src/lib/` : dégâts, optimiseur, speed tuning, tris, filtres |
| Intégration | import, stockage, persistance, session, workers… | plusieurs modules ensemble : un export d'exemple importé, IndexedDB (`fake-indexeddb`), vrais `worker_threads` |
| Rendu | [rendu/](rendu/) | un composant affiché avec `react-dom/server` : présence d'un bouton, d'un libellé, d'un état désactivé — le sens, jamais la forme ([rendu/outils-rendu.tsx](rendu/outils-rendu.tsx)) |
| Outillage | hooks, renvois | les garde-fous du dépôt, dans des dépôts jetables |
| Bureau | `bureau-*.test.ts` | les modules purs de l'application de bureau |

**Ce qui ne l'est pas** : un rendu serveur n'exécute ni effet ni
gestionnaire d'évènement. Ce qui se passe *après* un clic ne se vérifie
donc qu'au navigateur : soit par les vérifications de l'Optimizer qui
pilotent un Chromium sur des sources réelles compilées, sans serveur de
l'application
([rendu/optimizer-navigable-banc.ts](rendu/optimizer-navigable-banc.ts),
dont [rendu/optimizer-ecran-navigateur.test.ts](rendu/optimizer-ecran-navigateur.test.ts)),
soit par le banc d'affichage, plus bas, hors de la suite.

⚠️ **Ce Chromium rend avec les polices de l'app**, pas celles de la
machine : le banc pose `font-body` sur le `<body>` comme `index.html`,
déclare Source Sans 3 et JetBrains Mono depuis `@fontsource`
(dépendances de développement, hors ligne) et attend leur chargement
avant de rendre la main ; une police absente fait échouer le banc. Sans
elles, le texte tombait sur la police système (Segoe UI sous Windows,
une autre sous Linux), et une mesure de largeur — le seuil du tableau
des résultats — changeait d'une machine à l'autre.

Pour « Exemplaire », [optimizer-recherche.test.ts](rendu/optimizer-recherche.test.ts)
vérifie aux deux formats les vues et l'aperçu sans effet sur l'équipement
optimisé (artéfacts et relique transmis compris), la comparaison avec la
fiche regardée et sa validation pour le membre. Le choix successif et la
ligne indisponible au clavier comme à la souris vivent dans
[optimizer-recherche.test.ts](rendu/optimizer-recherche.test.ts) ; la
décision d'ajout pure dans [liste-exemplaires.test.ts](liste-exemplaires.test.ts).

Les premières vérifications ciblaient les endroits où une erreur est à la
fois **grave et invisible** — ils restent le cœur de la suite :

| Fichier | Ce qui casserait sans bruit |
|---|---|
| [vitesse.test.ts](vitesse.test.ts) | Un arrondi de travers = un speed tune faux d'un point. Le joueur perd son combat et croit à un mauvais RNG. |
| [import.test.ts](import.test.ts) | Un export lu différemment selon qu'il arrive en texte ou en objet ; une date d'import affichée à la place de la date d'export. |
| [stockage.test.ts](stockage.test.ts) | Une écriture en retard qui ressuscite un compte effacé ; un enregistrement périmé lu comme s'il était complet. |
| [persistance.test.ts](persistance.test.ts) | Écrire alors que l'utilisateur a refusé ; ou cesser d'écrire pour quelqu'un d'installé depuis des mois. |

Aucun de ces symptômes n'est reproductible à la demande, et aucun ne sera
remonté correctement par un utilisateur. C'est ce qui justifie de les figer ici.

## Le banc d'affichage

[banc/](banc/) — **hors de `npm test` et de la CI**, lancé à la main :

```bash
node tests/banc/run.mjs --tous                  # tous les écrans, compte du banc
node tests/banc/run.mjs --ecrans optimizer      # un seul écran
node tests/banc/run.mjs --depuis origin/main    # les écrans que touchent les fichiers modifiés
node tests/banc/run.mjs --plage <a>..<b>        # idem, entre deux révisions
node tests/banc/run.mjs --ecrans optimizer --etats resultats-tableau --tailles ordinateur,volet-groupe
node tests/banc/cas.mjs                         # la règle sur ses pages de cas
```

`--etats <id,…>` et `--tailles <id,…>` restreignent n'importe quelle
sélection à ces états et à ces tailles (identifiants de
[banc/ecrans.ts](banc/ecrans.ts) : `telephone`, `ordinateur`,
`bureau-portable`…) : un état rejoué à une taille prend environ 30 s, la
grille complète de l'Optimizer plus d'un quart d'heure. Un identifiant
inconnu des écrans retenus est refusé (code 2, les connus listés), comme des
filtres qui ne laissent aucune case exerçable (un état réservé à d'autres
tailles), avant la construction. Les cases écartées figurent dans les non
exercés du manifeste, motif « non retenu », et le compte n'est importé
qu'aux formats encore utilisés. Rejouer un état ne remplace pas le passage
complet avant une fusion.

Il construit l'app (`vite build` dans un dossier temporaire), la sert
(`vite preview`), l'ouvre dans Chromium sans fenêtre (Playwright) au
téléphone (360 × 800, tactile) et à l'ordinateur (1400 × 1000 par défaut,
plusieurs tailles propres à l'Optimizer), amène chaque
écran dans chacun de ses états ([banc/ecrans.ts](banc/ecrans.ts)) et vérifie
un **invariant** : rien ne déborde à l'horizontale, une pastille posée en
coin d'un portrait de monstre ne recouvre rien d'autre que son portrait, et
deux éléments frères en flux ne se recouvrent pas (règle « voisins » : plus
de 1 px en largeur et en hauteur, sauf un absolu, un texte en ligne,
l'intérieur d'un `<svg>`, une marge négative, un `transform` ou une couche qui
ne dessine rien). La règle, ses définitions, ses exclusions et ses limites
connues sont écrites en tête de [banc/mesure.ts](banc/mesure.ts) ;
chaque règle et chaque exclusion a une page de [banc/cas/](banc/cas/), un cas
signalé et un cas non signalé, que vérifie [banc/cas.mjs](banc/cas.mjs) (une
paire se déclare sur le premier des deux éléments : `data-attendu-avec`, en
tête de `cas.mjs`).

La règle « contenu » excuse l'excédent d'une case sous une roue reconnue
par son fond `rune-wheel.png` seulement si tous les descendants transformés
restent dans cette roue, qui ne déborde elle-même sur aucun axe. Un essai
neutralise leurs rotations, translations et échelles : l'excédent doit
disparaître entièrement, sans déplacer les boîtes hors de leurs sous-arbres.
Tout est ensuite restauré, styles et transitions compris. Une sortie de
la roue, ou un excédent non transformé mêlé au dessin, reste signalé ; aucun
contenant plus large ne remplace la roue. Les autres règles restent actives.
Les cas [cadre pivoté](banc/cas/roue-cadre-pivote.html) et
[transformation sortante](banc/cas/roue-transformation-sortante.html)
vérifient ces deux issues, ainsi que le contenu mixte.

Un état peut charger un fichier par le vrai chemin de l'interface (étape
`importer` de `ecrans.ts`, bouton « Importer ») : l'écran des
recommandations de siège se mesure ainsi rempli, avec
[fixtures/recommandations-banc.json](fixtures/recommandations-banc.json)
(plusieurs listes et équipes, sets, artéfacts, contres). Un fichier refusé
par l'app laisse l'état non atteint : code 2, cause écrite, jamais une
mesure de l'écran vide.

### Tailles et états de l'Optimizer

`--ecrans optimizer` exerce le téléphone et dix-sept tailles de bureau :
les cinq repères de la spec, la fenêtre de 1400 × 1000 et onze frontières.
La navigation reste dépliée. Les volets sont ouverts par « Écran partagé »,
à parts égales, sans injection de stockage de disposition.

| Taille | Fenêtre | Conteneur attendu | Configuration |
|---|---|---|---|
| `volet-deux-piles` | 1920 × 940 partagée | 792 | deux piles |
| `volet-groupe` | 2560 × 1300 partagée | 1112 | groupe de trois |
| `ordinateur` | 1400 × 1000 | 1128 | groupe de trois |
| `bureau-portable` | 1536 × 730 | 1264 | groupe de trois |
| `bureau-criteres-groupe` | 1920 × 940 | 1648 | Critères et groupe de deux |
| `bureau-colonnes` | 2560 × 1300 | 2288 | toutes les colonnes |

Les tailles `conteneur-<largeur>` visent 752, 753, puis 1096, 1432 et 1768
à −1, au seuil et à +1. L'étape `largeurOptimizer` mesure le conteneur et
ajuste la fenêtre par l'écart, sans modifier le style de l'app. À 751 px,
le contenu passe sous la frontière du format bureau : cette borne est
vérifiée par le calcul pur, le téléphone a son propre banc.

Chaque état repart d'une page neuve. Les préparations choisissent les
onglets par rôle `tab` et libellé court (« Critères », « Artéfacts »,
« Options »). Si le réglage est déjà une colonne, sa présence est exigée.
Le clic sur chaque onglet compare sa position avant et après : tout
déplacement rend l'état non atteint.

| État | Préparation et postcondition |
|---|---|
| `liste-remplie` | Liste Arène, Vanessa et Cassie ajoutées par la recherche |
| `resultats`, `resultats-tableau`, `resultats-filtres` | Import de [optimizer-banc-recette.json](fixtures/optimizer-banc-recette.json), recherche Rapide terminée, deux cartes exigées ; tableau et filtre selon l'état |
| `artefacts`, `complements` | Même recherche, puis sélection de l'onglet correspondant quand il existe |
| `toutes-colonnes` | Même recherche aux tailles qui affichent tous les réglages |
| `guidage-set` | Options, puis Rechercher sans set : Critères et message d'erreur visibles |
| `pile-defilee` | Options en deux piles, défilement de la pile jusqu'à Rechercher, qui reste dans le bloc |
| `set-flottant` | Liste remplie, ouverture du coffre compact à la taille où il existe (1536 × 730) |

Les états de départ, de réglages avancés et de modale « Dégâts réels »
restent exercés aux deux formats. Le téléphone garde « Gérer mes listes »
et son panneau « Options ».

Avant la mesure, le banc exige la configuration, les libellés des onglets,
la fiche repliée dans « Monstre », le confinement des défilements et
l'absence de débordement horizontal. En deux piles, le set monté est compact ;
ailleurs, sa forme mesurée est consignée. Le guidage sans set doit rendre
le set visible dans la partie visible de sa colonne ou de la pile de droite :
les copies invisibles sont exclues, et le client du défilement est intersecté
avec la fenêtre et les ancêtres qui le rognent. Les rectangles, l'onglet ouvert et le
nombre de cartes figurent dans le manifeste. Une incohérence donne le code 2
avec sa cause et une capture, sans mesure de remplacement.

### Sélection, compte et sortie

- **Sélection par fichiers** : `--depuis` et `--plage` passent les fichiers
  modifiés (`git diff --name-only`) à [banc/selection.ts](banc/selection.ts),
  qui les rapproche des motifs de chemins de chaque écran
  ([banc/ecrans.ts](banc/ecrans.ts)). `src/ui/`, `src/index.css` et
  `tailwind.config.js` et le coquillage (`App.tsx`, barres de navigation,
  palette) sélectionnent tous les écrans, comme tout fichier de `src/` qu'aucun
  motif ne couvre (repli, dit sur la sortie) ; un fichier hors de `src/` que
  nul motif ne couvre ne sélectionne rien et est signalé « hors table ». La
  vérification `banc-selection` (sans navigateur, dans `npm test`) garde la
  correspondance.
- **Ce qu'il ne fait pas** : comparer des captures. Il en prend une par
  écran, état et format, pour qu'on voie ce qui a été mesuré ; aucune n'est
  une référence.
- **Codes** : 0 rien ne déborde, 1 un débordement, 2 le banc n'a pas pu
  mesurer (Chromium absent, construction ou serveur en échec, état
  inatteignable, compte ou sortie refusés). Il ferme son navigateur et son
  serveur dans tous les cas, puis vérifie que le port est rendu.
- **Sortie** : chaque exécution crée son propre sous-dossier, neuf
  (`banc-…`), dans `--sortie <dossier>` (ou `SWB_BANC_SORTIE`), sinon dans
  le dossier temporaire du système ; une destination liée (lien, jonction)
  est refusée, et aucun fichier n'est écrit par-dessus un autre. Il reçoit
  les captures et `manifeste.json` (révision et empreinte de
  l'état de travail de l'arbre construit, révision du banc, formats et
  tailles par écran, médias du pointeur, résultats, ce qui n'a pas été exercé, empreinte du
  compte).
- **Compte** : `--compte <fichier>` seulement, jamais une variable
  d'environnement ; sans lui, le compte du banc,
  [fixtures/compte-banc.json](fixtures/compte-banc.json) : la miniature
  (`compte-miniature.json`, que lisent les autres tests), plus les cas
  d'affichage relevés sur un export réel et que la miniature ne produit pas
  (sa clé `_lisezmoi` les nomme). Un débordement vu sur un export réel se
  reproduit en l'y ajoutant, sans donnée réelle. Un fichier hors de
  `tests/fixtures/` est traité comme un **compte réel** : sortie obligatoirement
  hors de tout dépôt Git, et aucun message de la page sur la sortie standard
  (seulement leur nombre).
- `--racine <dossier>` mesure un autre arbre (un worktree, un vieux commit) ;
  ses dépendances doivent être installées.
- Ses fichiers passent par `tsc` et ESLint comme le reste de `tests/`, CI
  comprise : seul son lancement est manuel.

## Sélection par fichiers modifiés

```bash
node tests/run.mjs --depuis origin/<base>     # <base> : la branche dont on part
node tests/run.mjs --plage <a>..<b>           # entre deux révisions
node tests/run.mjs --depuis origin/<base> speed-tune   # avec un filtre par nom
```

Ne lance que les vérifications que touchent les fichiers modifiés
([selection.ts](selection.ts)) : base de fusion de la référence et `HEAD`,
index, arbre de travail et non suivis compris. Elle **complète** le filtre
par nom, elle ne le remplace pas ; les deux se combinent.

- **Sortie raisonnée** : chaque fichier modifié est classé (`couvert`,
  `sans effet`…), chaque entrée retenue dit pourquoi, et la ligne
  « Entrées retenues (n/total) » donne l'ampleur.
- **Repli sur la suite complète**, cause écrite en sortie : un fichier
  modifié sans lien spécifique, une incohérence de l'inventaire, une lecture
  de Git qui échoue. Jamais moins sans le dire.
- **Avertissements** : un `new Worker(…)` dont la cible ne se résout pas
  (hors `{ eval: true }`, qui porte du code) ne fait entrer aucun module par
  ce site ; la sortie le dit (« Avertissements (n) », et leur nombre sous
  `--silencieux`), sans changer la sélection. Une liste tolérée
  (`WORKERS_NON_RESOLUS_TOLERES`, selection.ts) en tait certains, chacun
  avec sa raison, repéré par son fichier et le texte de son argument :
  aujourd'hui les deux lanceurs Node de paquets construits par esbuild, dont
  le point d'entrée est suivi par son site `entryPoints`. Un site nouveau
  reste averti, comme un second site au même argument ; une entrée qui ne
  correspond plus à aucun site est dite en avertissement.
- **Fichiers sans effet** (`*.md`, `tests/banc/**`, `.gitignore`) : ne retiennent que les
  vérifications qui lisent le dépôt entier (`depot`) ou un chemin non
  déterminable (`opaque`). Une retenue générale ne certifie jamais la
  couverture d'un fichier.
- **Limites** : le gain est surtout hors de `src/` (mesuré : ~12 % de la
  durée de la suite complète sans `src/`, ~83 % avec, parce que les bancs
  de rendu importent l'essentiel des écrans). Sur un arbre ancien, les
  tables écrites à la main (prérequis, chargeur) peuvent ne plus
  correspondre au registre : repli, du côté sûr. Les tests qui lisent
  `src/` comme du texte sont retenus par leur lecture, pas par un import
  (voir la garde plus bas).

## Prévisualisation et garde de volume

```bash
node tests/run.mjs --lister speed-tune
node tests/run.mjs --lister --depuis origin/<base> speed-tune
node tests/run.mjs --max-entrees 30 speed-tune
```

`--lister` construit le registre et résout la même sélection que le lancement,
sans invoquer de vérification ni écrire de manifeste d’exécution. Il affiche
les **noms finaux**, dans l’ordre d’exécution, leur nombre sur le total du
registre développé et leurs raisons. Les filtres et les fichiers se combinent
par union ; groupes d’étalements, prérequis et repli sur la suite complète
restent ceux de l’exécution. Cette liste reste détaillée avec `--silencieux`.
La construction et le calcul de la sélection ont toujours lieu : la
prévisualisation ne donne aucune durée de tests.

`--max-entrees <n>` fixe une limite explicite, entier positif ou nul, sur
cette sélection finale. Un dépassement sort en code 2 **avant toute
vérification et avant la création du manifeste**, sans réduire la sélection.
Cette garde peut aussi accompagner `--lister` ; sans elle, aucun seuil ne
s’applique. Les options inconnues, répétées ou sans valeur valide sont refusées.
Vérifié par `node tests/run.mjs runselection`.

## Sortie réduite : `--silencieux`

```bash
node tests/run.mjs --silencieux                        # la suite, sans les lignes « ok »
node tests/run.mjs --depuis origin/<base> --silencieux # la sélection par fichiers modifiés
```

N'affiche que les **échecs** (chacun avec son détail), les **vérifications
ignorées** (une ligne chacune) et le **bilan** ; avec `--depuis`, la sélection
se réduit à une ligne (fichiers modifiés, entrées retenues sur le total), sans
la liste des fichiers ni des entrées. Elle se combine avec les filtres par nom
et avec `--depuis` / `--plage`. Le code de sortie est le même ; pour le détail
d'un échec dans son contexte, relancer sans l'option. La forme par défaut ne
change pas : c'est celle que lit `npm run test:suivi`, qui n'utilise pas
l'option. Vérifiée par `node tests/run.mjs runsilencieux`.

## Manifeste d'exécution

```bash
node tests/run.mjs --manifeste <fichier> [filtres…]
```

Écrit, au fil de l'exécution, ce qui était attendu et ce qui a tourné
([execution.ts](execution.ts)) : révision, empreinte du contenu, registre,
sélection, et par entrée l'invocation, le retour, les contrôles faits et
ignorés. Il est marqué incomplet et ne devient `complet` qu'après la
validation finale. Une entrée attendue jamais invoquée, non rendue, non
attendue, ou rendue sans aucun contrôle, fait échouer le point d'entrée,
nommée. Une entrée qui n'a que des `ignore` est « entièrement ignorée »,
pas un échec.

Une entrée qui lève une exception échoue, nommée, **et la série continue** :
s'arrêter cacherait le reste sous des « jamais invoquée ». Comme l'exception
peut laisser un état global faux, le bilan nomme la première et compte les
entrées qui ont tourné après elle (champ `premiereException` du manifeste) :
un échec parmi elles se relit une fois l'exception corrigée.

- **Emplacement** : hors du worktree, ou dans un dossier ignoré par Git
  (`node_modules/…`) ; sinon refus (code 2). Il n'entre ainsi ni dans la
  sélection ni dans l'empreinte.
- **Le dépôt ne l'exige pas** : il se demande ; un outil de fin de travail
  peut le lire comme preuve que ce qui était annoncé a tourné.
- **Limites** : sous Windows, un signal ne passe pas par les écouteurs (code
  non nul et manifeste incomplet seulement) ; une construction qui échoue
  laisse l'ancien manifeste ; un `ok` tardif compte sur l'entrée suivante.

## Suivi en direct

```bash
npm run test:suivi                           # toutes les vérifications
npm run test:suivi -- speed-tune             # avec des filtres, comme run.mjs
npm run test:suivi -- --depuis origin/<base> # la sélection par fichiers modifiés
npm run test:suivi -- --web                  # aussi sur http://127.0.0.1:4317/ (--web <port>)
```

[suivi.mjs](suivi.mjs) lance [run.mjs](run.mjs) avec un manifeste
d'exécution (écrit dans `os.tmpdir()`), et dessine dans le terminal un
tableau qui se redessine sur place : barre d'avancement et temps restant
estimé, compteurs (contrôles, échecs, ignorés), entrée en cours avec le
dernier titre lu, une **mosaïque d'un caractère par entrée** colorée selon
son état, et les derniers échecs dès qu'ils arrivent. À la fin, le tableau
reste, suivi du détail complet des échecs — ou, si le lanceur s'arrête sans
« KO » (filtre inconnu, sélection refusée), de ses dernières lignes — et du
chemin de sa sortie complète. Le code de sortie est celui du lanceur.

- **Un affichage, pas un autre lanceur** : ce qui tourne et ce qui est
  vérifié sont ceux de `run.mjs`. Le tableau lit le manifeste, réécrit toutes
  les 250 ms, et la sortie du lanceur pour le TEXTE des échecs, que le
  manifeste ne porte pas ([suivi/rendu.ts](suivi/rendu.ts), vérifié par
  `node tests/run.mjs suivi`).
- **Hors d'un terminal** (tube, CI), rien n'est dessiné : la sortie du
  lanceur passe telle quelle.
- **Le tableau tient dans le terminal** : chaque ligne est coupée à sa
  largeur, et si le terminal est trop bas, la mosaïque cède sa place —
  plus haut que l'écran, il ne pourrait plus se redessiner sur place.
- **`--web`** sert le même suivi dans le navigateur
  ([suivi/page.html](suivi/page.html)) : grille filtrable des entrées, échecs
  avec leur message, entrées les plus lentes. Le serveur reste ouvert après la
  fin, jusqu'à Ctrl+C.

## Garde des références à `src/`

[lecture-source.test.ts](lecture-source.test.ts) (`node tests/run.mjs
lecturesource`) relève, dans chaque fichier de `tests/`, toute chaîne qui
désigne un chemin sous `src/` (lecture, `join`, `new URL`…). Un test qui lit
`src/` comme du texte n'importe pas le module : la sélection ne le voit que
par cette lecture, donc chaque usage est déclaré dans
[fixtures/lecture-source-toleree.json](fixtures/lecture-source-toleree.json),
une entrée par (fichier, cible) : `stock` (figé sur `54f8c6d6`, 179
identités) ou `exception` (justification obligatoire, 27).

- **Un usage absent de la liste, un nombre d'occurrences trop petit ou trop
  grand, une entrée qui ne correspond plus : échec.** Le décompte baisse dans
  le commit qui retire un usage : on retire l'entrée (ou on réduit sa
  multiplicité) avec le code.
- **Écrire un test de comportement à la place** : importer la fonction ou le
  composant et vérifier ce qu'il fait (rendu serveur, valeur rendue), plutôt
  que chercher un motif dans le texte de la source ; l'import fait entrer le
  module dans le graphe, et la sélection le retient sans déclaration.
  Un morceau d'écran s'éprouve sur l'écran entier, où qu'il soit écrit :
  rendu dans un état posé, ou geste au navigateur sur le vrai écran (pour
  l'Optimizer, [rendu/optimizer-ecran.test.tsx](rendu/optimizer-ecran.test.tsx)
  et [rendu/optimizer-ecran-navigateur.test.ts](rendu/optimizer-ecran-navigateur.test.ts)) ;
  une lecture de la source qui reste porte sur la logique, pas sur
  l'endroit où un contrôle est écrit.
- **Une seule règle** : le relevé et la comparaison à la liste vivent dans
  [scripts/lib/lectureSource.ts](../scripts/lib/lectureSource.ts) ; la
  vérification y ajoute le corpus (tout `tests/`, suivi ou non suivi non
  ignoré), le hook `pre-commit` l'applique aux seuls fichiers indexés, lus
  dans l'index ([qualite-code.md](../docs/03-developpeur/qualite-code.md),
  « Références à `src/` au commit »). Le hook charge ce module par `node`,
  sans compilation : il n'y entre que de la syntaxe TypeScript effaçable.
- **Angles morts** (listés en tête de `lectureSource.ts`) : une racine
  importée ou passée en paramètre échappe au détecteur ; une chaîne à espace
  n'est pas un chemin ; la garde ne dit ni si la cible existe ni ce que le
  test en fait.

## Mesure du rappel en usage

Avant une fusion, comparer les échecs de la suite complète (`npm test`) à la
sélection `--depuis` du manifeste : un échec hors sélection est un oubli de
la sélection, à signaler. Aucune campagne de mutations ne le prouve
d'avance ; c'est l'usage qui le mesure.

## Choix d'outillage

- **Pas de framework de test.** Les assertions sont celles de
  [outils.ts](outils.ts) (`ok`, `egal`, `ignore`) ; toutes les vérifications
  tournent à la suite, dans un seul processus, dans l'ordre de
  [index.ts](index.ts). ⚠️ `egal` compare par `JSON.stringify` : deux `Map` ou
  deux `Set` différents s'y écrivent `{}` et passent pour égaux — comparer
  leur contenu converti en tableau.
- **esbuild**, déjà présent comme dépendance de Vite, bundle `index.ts` ; Node
  exécute le résultat. C'est tout ce que fait [run.mjs](run.mjs), qui reprend à
  la main ce que Vite injecte (`import.meta.env`, `__APP_VERSION__`).
- ✅ **Les tests passent par `tsc`** : `tsconfig.json` couvre `src`, `scripts`
  ET `tests`. Ça n'a pas toujours été le cas — l'élargissement a révélé d'un
  coup une vingtaine d'appels de test périmés. ⚠️ Ce filet reste partiel :
  `tsc` ne voit jamais un champ OPTIONNEL oublié dans l'un des constructeurs
  d'un type partagé (l'accès reste valide), seulement un champ dont le type
  change ou qui devient obligatoire. Voir CLAUDE.md.
- ⚠️ **Le pool de runes synthétique est PARTAGÉ**, dans
  [../scripts/lib/randomPool.ts](../scripts/lib/randomPool.ts) — il vivait
  auparavant en 13 copies. Sa séquence de tirage est un **contrat** : la
  changer décalerait silencieusement tous les scénarios à seed fixe, sans
  qu'un seul test n'échoue de façon lisible. [random-pool.test.ts](random-pool.test.ts)
  fige pour cette raison des empreintes relevées AVANT la consolidation.
- **`fake-indexeddb`** en dépendance de développement : les vraies sémantiques
  d'IndexedDB (transactions, ordre, structured clone), pas un faux maison qui
  validerait ce qu'on croit avoir écrit.

## Les fichiers d'exemple

- [fixtures/compte-miniature.json](fixtures/compte-miniature.json) — un
  export SWEX **miniature écrit à la main**, commité, sans la moindre donnée
  réelle, mais qui exerce **chaque chemin** des extracteurs (box 6★,
  inventaire, favoris RTA, défense, attaque).
  [fixtures/compte-exemplaires-multiples.json](fixtures/compte-exemplaires-multiples.json)
  y ajoute deux exemplaires d'un même monstre.
- L'**export réel** du développeur (`tototriou-*.json`) est **gitignoré**. Les
  quelques vérifications qui s'en servent s'affichent en `--` (ignorées) quand il
  est absent, au lieu d'échouer sur les autres machines.

## Ajouter une vérification

1. Un fichier `nom.test.ts`, ou `nom.test.tsx` dans [rendu/](rendu/), qui
   exporte une fonction de vérification.
2. L'inscrire dans `VERIFICATIONS` de [index.ts](index.ts) : son nom sert de
   filtre à `node tests/run.mjs <filtre>`.
3. **Vérifier qu'elle sait échouer** : casser volontairement le code testé,
   constater le `KO`, puis restaurer. Un test qui ne peut pas échouer est pire
   qu'aucun test — il rassure à tort.
