# Mon compte — Monstres (box 6★) (`#/compte`)

Affiche **tous les monstres montés 6★** du compte importé. Composant :
`MonsterBoxSection` dans [AccountPage.tsx](src/pages/AccountPage.tsx).

## Contenu

- **Déduplication par monstre** (même `com2usId`) : chaque monstre apparaît **une
  seule fois**, avec une **bulle « ×N »** en bas à droite du portrait si plusieurs
  exemplaires sont possédés.
- **Carte** : portrait hexagonal (image SWARFARM) + icône d'élément + nom. Pas
  d'étoiles affichées (tous 6★). Cartes mémoïsées (`React.memo`).
- **Tri** : par **élément** (Eau → Feu → Vent → Lumière → Ténèbres → Autre) puis
  par nom.
- En-tête : « N monstres différents · M au total · 6★ ».

## Recherche & filtres

- **Recherche** par nom (insensible à la casse).
- **Élément** : chips multi-sélection (Eau/Feu/Vent/Lumière/Ténèbres ; « Autre »
  exclu du filtre).
- **Nat** (rareté naturelle) : chips **5★ · 4★ · 3★ · 2★**. Utilise
  `monster.naturalStars` — la **vraie** rareté naturelle SWARFARM, distincte de
  `stars` (grade obtenable / `base_stars`). Ex. Racuni = nat 3 même si base_stars 4.
- **Doublons** : ne montre que les monstres possédés en plusieurs exemplaires
  (`count ≥ 2`).
- **2A** : ne montre que les monstres à **second éveil** (`monster.secondAwaken`,
  dérivé de `awaken_level ≥ 2` côté données SWARFARM). Ex. Tractor 2A.

Les filtres se combinent avec la recherche.

## Données sous-jacentes

- Champs `naturalStars` et `secondAwaken` ajoutés au modèle `Monster` et remplis
  par le script de fetch (voir [../shared/donnees-monstres.md](../shared/donnees-monstres.md)).
- La box provient de `parseAccountBox` + `mapBoxMonsters` (voir
  [../shared/import-compte.md](../shared/import-compte.md)). Un monstre dont le
  `com2usId` est absent des données chargées est ignoré.
