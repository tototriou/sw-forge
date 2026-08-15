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
- **Élément** : pilules Feu / Eau / Vent / Lumière / Ténèbres / Autre. Multi-sélection
  (toggle). Chaque pilule reprend la couleur de son élément.
- **Étoiles naturelles** : pilules 1★→6★. Multi-sélection. Filtre sur `stars`
  (étoiles à l'invocation, pas l'éveil).
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
