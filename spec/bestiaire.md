# Bestiaire (`#/bestiary`)

Catalogue consultable de tous les monstres Summoners War. C'est la page
d'origine du projet ; elle reste la **moins centrale** de l'outil (dernière dans
la nav).

Fichier : [BestiaryPage.tsx](src/pages/BestiaryPage.tsx)

## Objectif

Rechercher / filtrer les monstres et voir leurs infos de base d'un coup d'œil.
Elle n'affiche que les **monstres officiels** (`data.monsters`), pas les monstres
perso (ceux-ci ne servent qu'à RTA / Siège).

## Contenu & interactions

### Recherche
[SearchBar.tsx](src/components/SearchBar.tsx) — filtre par nom (insensible à la
casse, `includes`).

### Filtres — [FilterBar.tsx](src/components/FilterBar.tsx)

⚠️ **Liste BLANCHE, tout coché par défaut** — même règle que les filtres de
runes ([compte/runes.md](compte/runes.md)) : une pilule cochée est **affichée**,
n'en cocher **aucune** revient à **ne rien vouloir voir**.

- **Élément** : pilules Feu / Eau / Vent / Lumière / Ténèbres / Autre. Multi-sélection
  (toggle). Chaque pilule reprend la couleur de son élément.
- **Étoiles naturelles** : pilules 1★→6★. Multi-sélection. Filtre sur `stars`
  (étoiles à l'invocation, pas l'éveil).
  - ⚠️ Un monstre **sans grade naturel** (`stars === null`) échappe à ce filtre :
    aucune case ne peut le désigner, le masquer le rendrait introuvable.
- **Tri interne** (au sein de chaque groupe d'élément) :
  - `stars_desc` (défaut) : étoiles ↓ puis nom
  - `stars_asc` : étoiles ↑ puis nom
  - `name_asc` : nom A→Z

### Affichage — [MonsterGrid.tsx](src/components/MonsterGrid.tsx) + [MonsterCard.tsx](src/components/MonsterCard.tsx)
- Résultats **groupés par élément** (un bloc par élément dans l'ordre `ELEMENTS`).
- Carte : cadre hexagonal coloré selon l'élément, image (fallback = initiales),
  badge élément, rangée d'étoiles, nom.
  - ⚠️ **Partagée avec la box du compte** — même composant, même grille. Les deux
    écrans en avaient chacun un, et ils avaient divergé (portraits de 84 px
    contre 64, rayons et corps de texte différents). Ce qui les distingue est
    devenu des **options** : `showStars` (masqué dans la box, tout y est 6★) et
    `count` (la bulle « ×N » d'exemplaires, que seule la box connaît).
  - ⚠️ **C'est le gabarit de la BOX qui fait référence**, pas celui d'ici :
    portrait **64 px**, colonnes de **104 px**, `rounded-xl`. C'est le plus dense
    des deux — on parcourt des centaines de monstres, chaque pixel de marge coûte
    une ligne de plus à faire défiler.
- Si un filtre ne renvoie rien : message « Aucun monstre ne correspond à ces
  filtres. »

### ⚠️ Un monstre transformable n'a qu'UNE fiche

**Bellenus**, les **Sœurs**… existent en **deux entrées** chez SWARFARM : la
forme de départ et la forme transformée. Elles portent le **même nom**, le
**même élément** et la **même icône** — côte à côte, on ne sait pas laquelle est
laquelle, et on ouvre l'une en croyant ouvrir l'autre.

`sansDoublonDeTransformation` ([monsterForms.ts](src/lib/monsterForms.ts)) n'en
garde qu'une, vérifié par
[monstre-formes.test.ts](tests/monstre-formes.test.ts).

- La relation vient du champ **`transforms_to`** de l'API, conservé sous
  `transformsTo`. ⚠️ Il référence un **id SWARFARM**, pas un `com2usId` — d'où
  `swarfarmId`, ajouté aux données pour pouvoir le résoudre.
- ⚠️ **Le lien est BIDIRECTIONNEL** (A → B et B → A) : il ne dit donc pas
  laquelle est « la vraie ». On retient celle au **`com2usId` le plus petit** —
  la forme de départ, celle qu'on invoque et sous laquelle on connaît le
  monstre. Le choix doit surtout être **déterministe** : n'importe quelle règle
  stable conviendrait, mais elle doit donner le même résultat à chaque rendu,
  sinon la fiche changerait sous le curseur.
- ⚠️ **Si l'autre forme est absente de la liste, rien n'est écarté** : le cas se
  produit dès qu'un filtre l'a retirée, et écarter quand même laisserait un trou
  que rien n'expliquerait.
- ⚠️ **Un second éveil n'est PAS une transformation.** Ses deux formes se
  distinguent (nom, icône, stats) et restent toutes les deux — c'est
  `formesJouables` qui les arbitre, et seulement dans les sélecteurs.
- La règle s'applique **au Bestiaire comme à la box du compte** : posséder le
  monstre, c'est posséder ses deux formes. Sur ~3 000 entrées, **58** sont ainsi
  écartées.

### ⚠️ Un monstre de COLLABORATION partage la carte de son équivalent SW

**Satoru Gojo, c'est Werner.** Les collaborations (Jujutsu Kaisen, Street
Fighter, Tekken, Le Seigneur des Anneaux, Demon Slayer…) ajoutent des monstres
sous licence qui sont, mécaniquement, des monstres SW existants **réhabillés** :
mêmes stats, même lead, mêmes compétences. Seuls le nom et le portrait changent.

Les deux occupent donc **une seule carte** — portrait coupé **verticalement**
(le monstre d'origine à gauche, son jumeau à droite), les deux noms séparés
d'une **virgule** (« Satoru Gojo, Werner »).
`sansDoublonDeCollab` / `jumeauDeCollab`
([monsterForms.ts](src/lib/monsterForms.ts)), vérifiés par
[collab-paires.test.ts](tests/collab-paires.test.ts).

- ⚠️ **Le lien est DONNÉ par l'API : `family_id` ≠ `skill_group_id`.**
  SWARFARM donne à chaque monstre sa famille *et* son groupe de compétences.
  Normalement identiques — quand ils divergent, le monstre **emprunte** les
  compétences d'un autre : Werner (famille 30900) porte le groupe 30300, celui
  de Gojo. [link-collabs.mjs](scripts/link-collabs.mjs) écrit le champ
  `jumeauCollab`. **163 paires**, 326 monstres liés.
  - ⚠️ **Ne pas déduire le lien des stats et des compétences.** Une première
    version l'a fait, faute d'avoir vu ce champ — et une signature comparée n'a
    jamais fini de se tromper : elle échoue **en silence**, laissant un monstre
    dépareillé au milieu de ses quatre frères, visible seulement en ouvrant la
    bonne carte. Quatre champs de SWARFARM ont dû être écartés un par un —
    `aoe` (faux dans **14 %** du corpus), l'ordre des effets, les effets
    surnuméraires, le nombre de coups sur des compétences sans dégâts — et
    l'appariement restait incomplet. Le champ, lui, est exact du premier coup.
  - ⚠️ **Calculé à la GÉNÉRATION**, pas au rendu.
- ⚠️ **Le groupe de compétences ne suffit pas** : il recouvre **trois**
  relations, et une seule doit fusionner deux cartes.
  - **Collaboration** — familles différentes, **mêmes stats et même rareté**
    (un *reskin*). C'est le seul cas qu'on fusionne.
  - **Second éveil** — écart de **+10** entre les familles (Elucia 2A, famille
    10110, groupe 10100) : même monstre à deux stades, déjà arbitré par
    `formesJouables`. Les fusionner masquerait la 2A.
  - **Réutilisation de compétences** — Fairy Queen emprunte celles de Fairy,
    Vampire Lord celles de Vampire, **sans partager leurs stats**. Ce sont de
    vrais monstres distincts : la comparaison des stats et de la rareté écarte
    ainsi 27 faux appariements.
- ⚠️ **Les formes ÉVEILLÉES seulement.** Les entrées non éveillées d'une collab
  portent des noms **coréens** chez SWARFARM (« 에이보르(물) » pour Eivor eau) :
  appariées, elles produisaient des cartes titrées « Mercenary Queen,
  에이보르(물) ». Elles ne servent d'ailleurs à rien ici — on ne joue que des
  monstres éveillés, et la box n'en contient aucune (`class === 6` à l'import).
  - L'éveil se lit **`stars > naturalStars`** : un nat4 éveillé plafonne à 5★,
    un test sur 6★ écarterait la moitié des candidats.
  - Reste **une** paire à nom coréen : « 간달프(빛)(강화) » — une variante
    *renforcée* de Gandalf, doublon technique du jeu, correctement appariée mais
    sans nom anglais chez SWARFARM. On la garde telle quelle : la donnée est
    juste, et lui inventer un nom serait pire.
- ⚠️ **L'appariement se fait à SUFFIXE ÉGAL** : une famille porte cinq éléments,
  et le Gojo eau doit trouver le Werner eau, pas le Werner feu.
- ⚠️ **Un groupe de trois n'apparie rien** : on ne saurait pas qui associer à
  qui, et on préfère ne rien affirmer.
- ⚠️ **La FICHE porte les deux identités elle aussi** : même portrait partagé,
  mêmes deux noms en titre. On vient de cliquer cette carte — la fiche qui
  s'ouvre doit montrer la même chose, sans quoi on croirait s'être trompé.
  - Le portrait est **un seul composant**
    ([CollabPortrait.tsx](src/components/CollabPortrait.tsx)), partagé par la
    carte et la fiche : un `clip-path` recopié aurait divergé au premier
    ajustement, comme les deux cartes avant `MonsterCard`.
  - ⚠️ **Rien à SÉLECTIONNER**, contrairement à un transformable : les deux
    formes de celui-ci ont des compétences différentes, d'où un sélecteur ; une
    paire de collab est le **même monstre**, donc le reste de la fiche vaut pour
    les deux.
  - ⚠️ Sur une **forme transformée**, les deux noms disparaissent : le jumeau ne
    vaut que pour le monstre reçu, et l'en-tête annoncerait sinon une paire qui
    n'existe pas.
- ⚠️ La seconde image est **posée par-dessus et découpée** (`clip-path`), et non
  accolée en deux moitiés : chaque portrait garde son cadrage d'origine, là où
  deux moitiés de 32 px écraseraient les visages. Leur `object-position` est
  **tiré vers l'extérieur** (30 % / 70 %) — les portraits SW centrent le visage,
  et n'en garder que la moitié le couperait en deux.
- ⚠️ **La recherche porte sur les DEUX noms** : la carte s'intitule « Satoru
  Gojo, Werner », et chercher « Werner » ne devait pas rester sans résultat.
- ⚠️ **Noms identiques → un seul affiché.** Certaines collabs reprennent le nom
  SW tel quel (Vendhan, Dyeus) : « Vendhan, Vendhan » se lirait comme un bug.
- La carte gardée est celle au **`com2usId` le plus petit** — l'entrée SW
  d'origine. Comme pour les transformations, ce qui compte est que la règle soit
  **déterministe**, sinon l'affichage changerait sous le curseur.
- ⚠️ **Dans la box du compte, le compte de l'écarté REVIENT à celui qu'on
  garde** : posséder un Werner et un Gojo, c'est posséder deux exemplaires du
  même monstre. Sans ce report, l'un des deux disparaissait de la box et le
  total ne tombait plus juste.

### Pagination — ⚠️ 60 cartes par page

Le bestiaire porte **~3 000 monstres**, et chaque carte est un `motion.div`
animé : tout rendre d'un coup faisait ramer le navigateur au moindre filtre,
**chaque frappe reconstruisant 3 000 nœuds animés**.

60 par page, comme les autres listes de l'app (runes, artéfacts, optimisation) —
**même composant** [Pager.tsx](src/components/account/Pager.tsx), donc même
sensation d'un écran à l'autre.

- ⚠️ **On pagine AVANT de grouper**, et non l'inverse : paginer chaque élément
  séparément donnerait **cinq paginations** à l'écran, et « page 2 » ne voudrait
  plus rien dire. La page découpe la liste entière — déjà triée dans l'ordre
  d'affichage — et les blocs d'élément se reconstituent à partir de ce qu'elle
  contient. Un bloc peut donc être **partiel**, ou **absent** d'une page.
- ⚠️ **Retour à la première page dès que le résultat change** (recherche, filtre,
  tri) : rester en page 12 après une recherche qui n'en rend que deux laisserait
  un écran vide, qu'on lirait comme « aucun résultat ».
- **Deux pagers**, en tête et en pied : après 60 cartes on est loin du haut, et
  remonter pour cliquer « suivant » puis redescendre décourage de parcourir.
  - ⚠️ Seul celui du **bas** remonte en tête de liste au changement de page :
    sinon on arrive au pied de la page suivante, donc à sa fin, et on croit que
    rien n'a bougé. Celui du haut ne bouge rien — on y est déjà.
- Le compteur dit **« N sur M »** quand un filtre coupe : afficher le total alors
  qu'on en voit 60 se lit comme un bug d'affichage. Même règle que l'inventaire
  d'artéfacts.
- ⚠️ **L'animation de disposition est coupée au-delà de `SEUIL_ANIMATION_GRILLE`
  cartes (48)** — voir [compte/monstres.md](compte/monstres.md#pagination--performance).
  Une page pleine (60) saccaderait au FLIP de framer-motion ; `BestiaryPage`
  calcule le nombre de cartes de la page et passe `anime={false}` à chaque
  `MonsterGrid` au-dessus du seuil. La carte n'est alors plus un `motion.div` du
  tout (survol en CSS). ⚠️ **Décidé sur le total de la PAGE**, pas par bloc
  d'élément : cinq blocs de douze sous le seuil feraient quand même soixante FLIP
  simultanés.

### Fiche complète — au clic sur une carte

La **même modale** que dans « Mon compte »
([MonsterDetailDialog.tsx](src/components/MonsterDetailDialog.tsx)) : stats, lead,
et le détail des compétences — coefficients, effets, améliorations. Voir
[compte/monstres.md](compte/monstres.md#fiche-dun-monstre--au-clic-sur-sa-carte)
pour le détail du rendu et de la source des données.

- ⚠️ **Le même composant**, pas une copie : deux fiches auraient divergé au
  premier ajustement. Elle a d'ailleurs été **remontée** de `components/account/`
  vers `components/` au deuxième usage.
- C'est ici qu'elle sert le plus : le bestiaire couvre **tous** les monstres, y
  compris ceux qu'on ne possède pas — et c'est justement avant d'invoquer qu'on
  va lire des coefficients.
- ⚠️ `role="button"` sur le `motion.div` de la carte plutôt qu'un `<button>`
  autour : envelopper casserait l'animation de disposition (`layout`), qui mesure
  cet élément. Le clavier (Entrée, Espace) est rétabli à la main.
- Une poignée d'entrées techniques de SWARFARM (~16 « dummy ») n'ont aucune
  compétence : la fiche le **dit** au lieu d'afficher un bloc vide.

## Règles / attendus

- La **vitesse est fixe** dans SW (indépendante du niveau/étoiles) → `stats.speed`
  est la SPD de base réutilisée partout ailleurs (RTA/Siège).
- Les filtres se cumulent (ET entre catégories, OU au sein d'une catégorie).
- Un monstre sans image affiche ses initiales (2 premiers mots) sur fond coloré.
- Pas de persistance : les filtres sont réinitialisés au rechargement.
