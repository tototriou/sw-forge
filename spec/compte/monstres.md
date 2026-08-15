# Mon compte — Monstres (box 6★) (`#/compte`)

Affiche **tous les monstres montés 6★** du compte importé. Composant :
`MonsterBoxSection` dans [AccountPage.tsx](src/pages/AccountPage.tsx).

## Contenu

- **Déduplication par monstre** (même `com2usId`) : chaque monstre apparaît **une
  seule fois**, avec une **bulle « ×N »** en bas à droite du portrait si plusieurs
  exemplaires sont possédés.
- **Carte** : portrait hexagonal (image SWARFARM) + icône d'élément + nom. Pas
  d'étoiles affichées (tous 6★). Cartes mémoïsées (`React.memo`).
- En-tête : « N monstres différents · M au total · 6★ ».

## Tri — deux lectures d'une même collection

Un contrôle **à cran** (`Segmented`) à côté de la recherche : **Ordre du jeu**
(défaut) · **A → Z**. Calcul pur dans
[monsterSort.ts](src/lib/monsterSort.ts), vérifié par
[monstre-tri.test.ts](tests/monstre-tri.test.ts).

| Mode | Clé de tri | Sert à |
|------|-----------|--------|
| **Ordre du jeu** | les **2A d'abord**, puis la **famille** (ordre de sortie), puis l'**élément** dans la famille | parcourir sa collection comme le jeu la présente — « qu'est-ce qu'il me manque ? » |
| **A → Z** | le **nom**, tous éléments confondus | retrouver **un** monstre dont on connaît le nom |

- ⚠️ **L'ordre du jeu se lit dans le `com2usId`** : `famille × 100 + suffixe`
  (`12302` = famille 123, suffixe 02). La **famille croît avec l'ordre de
  sortie**, ce qui donne cet ordre **sans aucune date** dans les données. Le
  suffixe dit l'élément et l'éveil : `1..5` non éveillé, `11..15` éveillé,
  `31..35` **second éveil**.
  - Cette régularité n'est écrite nulle part — c'est une observation sur
    l'export réel. Les tests la **figent** : si elle se révélait fausse, on le
    verrait là plutôt qu'à l'œil sur 300 monstres.
- ⚠️ Un 2A se reconnaît au **champ `secondAwaken` OU au suffixe 31..35** : le
  champ vient de SWARFARM et peut manquer sur une entrée incomplète, alors que le
  suffixe est porté par l'identifiant lui-même. L'un rattrape l'autre.
- ⚠️ **A → Z ne regroupe PAS par élément** : c'est tout l'intérêt du mode — on
  cherche « Chloé » sans savoir de quel élément elle est. Grouper obligerait à
  parcourir cinq blocs.
- Les deux modes **départagent par nom** en dernier recours : sans ça, deux
  monstres de même rang s'échangeraient d'un rendu à l'autre et la liste
  paraîtrait bouger toute seule.
- ⚠️ Le contrôle est posé **à côté de la recherche**, pas dans la rangée de
  filtres : **trier n'est pas filtrer**, et le mêler aux pastilles le ferait lire
  comme un critère de plus.
- Le défaut est **l'ordre du jeu** : l'alphabétique sert à retrouver un monstre
  précis, ce qui est déjà le rôle du champ de recherche juste à côté.

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

> ⚠️ **Une chip active se reconnaît à sa couleur, sans lire son libellé.**
>
> - **Élément** : fond **teinté de l'élément à 25 %** (rouge pour Feu, bleu pour
>   Eau…), texte dans sa version claire. Style partagé avec le Bestiaire —
>   [elementStyles.ts](src/components/elementStyles.ts). Les deux écrans en
>   avaient une copie chacun, et elles avaient divergé.
>   ⚠️ **Une teinte, pas un aplat plein** : sur des chips de 12 px, du texte
>   sombre sur rouge ou violet vif devient illisible. Ce sont la bordure et le
>   texte colorés qui portent l'information, le fond ne fait que la confirmer.
> - **Nat, Doublons, 2A** : **un seul** style actif, le jaune plein des étoiles.
>   Chaque bouton avait le sien — bleu-violet pour Doublons, doré sombre pour 2A
>   — et trois surbrillances différentes côte à côte se lisent comme trois
>   **natures** de filtre différentes, alors qu'ils font tous la même chose. Le
>   plein tient ici : ces filtres n'ont pas de couleur propre à respecter.

## Données sous-jacentes

- Champs `naturalStars` et `secondAwaken` ajoutés au modèle `Monster` et remplis
  par le script de fetch (voir [../shared/donnees-monstres.md](../shared/donnees-monstres.md)).
- La box provient de `parseAccountBox` + `mapBoxMonsters` (voir
  [../shared/import-compte.md](../shared/import-compte.md)). Un monstre dont le
  `com2usId` est absent des données chargées est ignoré.
