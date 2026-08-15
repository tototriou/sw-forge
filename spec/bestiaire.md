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
- Si un filtre ne renvoie rien : message « Aucun monstre ne correspond à ces
  filtres. »

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
