# Mon compte — Monstres (box 6★) (`#/compte`)

Affiche **tous les monstres montés 6★** du compte importé. Composant :
`MonsterBoxSection` dans [AccountPage.tsx](src/pages/AccountPage.tsx).

## Contenu

- **Déduplication par monstre** (même `com2usId`) : chaque monstre apparaît **une
  seule fois**, avec une **bulle « ×N »** en bas à droite du portrait si plusieurs
  exemplaires sont possédés.
- ⚠️ **La MÊME carte et la MÊME grille que le Bestiaire**
  ([MonsterCard.tsx](src/components/MonsterCard.tsx)) : même portrait, même
  gabarit, même largeur de colonne, même écart. Les deux écrans montrent les
  mêmes monstres — deux composants donnaient deux rendus pour une même chose, et
  ils avaient déjà divergé (portraits de 64 px contre 84, rayons et corps de
  texte différents).
  - ⚠️ **C'est CE gabarit qui fait référence** : portrait 64 px, colonnes de
    104 px, `rounded-xl`. Le bestiaire s'y aligne, et non l'inverse — c'est le
    plus dense des deux, et on parcourt des centaines de monstres.
  - Ce qui les distingue devient des **options** : la bulle **« ×N »**
    d'exemplaires (box seule — le bestiaire ne sait pas ce qu'on possède) et la
    rangée d'**étoiles**, masquée ici puisque tout est 6★.
- En-tête : « N monstres différents · M au total · 6★ ».

## Tri

Un contrôle **à cran** (`Segmented`) à côté de la recherche : **Sortie**
(défaut) · **A → Z**. Calcul pur dans
[monsterSort.ts](src/lib/monsterSort.ts), vérifié par
[monstre-tri.test.ts](tests/monstre-tri.test.ts).

### ⚠️ L'ÉLÉMENT groupe toujours

Quel que soit le mode, les monstres sont d'abord rangés par élément —
**Feu → Eau → Vent → Lumière → Ténèbres**, l'ordre du jeu. C'est le regroupement
que le jeu impose partout : une liste qui les mêle oblige à balayer tout l'écran
pour rassembler ses monstres d'un même élément.

Le mode ne décide donc que de ce qui se passe **à l'intérieur** d'un élément :

| Mode | Dans l'élément |
|------|----------------|
| **Sortie** | par catégorie — **2A → nat5 → nat4 → nat3…** — et dans chacune les **derniers sortis en premier** |
| **A → Z** | par **nom** |

- ⚠️ **Un 2A sort de sa rareté naturelle** : il passe devant **tous** les autres,
  y compris les nat5. C'est le classement de la collection en jeu, et c'est aussi
  ce qu'on veut voir en premier — un 2A est l'aboutissement d'un monstre.
- ⚠️ **Les derniers sortis en premier** : ce sont les nouveautés, celles dont on
  ne sait pas encore si on les a. Les anciennes, on les connaît par cœur.
- ⚠️ **La rareté prime sur la date** : un nat5 ancien reste devant un nat4
  récent.
- ⚠️ **La date de sortie se lit dans le `com2usId`** : `famille × 100 + suffixe`
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
- Une **rareté inconnue** passe derrière les raretés connues, plutôt qu'assimilée
  à un nat0 qui la mettrait en tête. Un monstre **sans `com2usId`** (perso) finit
  sa catégorie.
- Les deux modes **départagent par nom** en dernier recours : sans ça, deux
  monstres de même rang s'échangeraient d'un rendu à l'autre et la liste
  paraîtrait bouger toute seule.
- ⚠️ Le contrôle est posé **à côté de la recherche**, pas dans la rangée de
  filtres : **trier n'est pas filtrer**, et le mêler aux pastilles le ferait lire
  comme un critère de plus.
- ⚠️ Les libellés disent **ce qui varie** — la date ou le nom — et non « ordre du
  jeu » : les deux modes groupent par élément, donc les deux sont l'ordre du jeu.

## Fiche d'un monstre — au clic sur sa carte

Une **modale** ([MonsterDetailDialog.tsx](src/components/MonsterDetailDialog.tsx))
porte tout ce que SWARFARM sait du monstre : ses **stats 6★ nu**, son **lead**,
et surtout le **détail de ses compétences** — coefficient, cooldown, nombre de
coups, effets appliqués, et ce qu’apporte chaque amélioration.

- ⚠️ **En modale, pas en panneau sous la grille.** Trois ou quatre compétences
  avec chacune sa formule, ses effets et ses sept niveaux d'amélioration
  repousseraient la grille de plusieurs écrans — on perdrait le monstre qu'on
  vient de cliquer.
- ⚠️ **DEUX COLONNES** : ce que le monstre **est** à gauche (**lead**, puis
  stats), ce qu'il **fait** à droite (compétences). Les deux se lisent ensemble —
  on juge un coefficient à l'aune de l'ATQ du monstre — et empilés, il fallait
  faire défiler pour passer de l'un à l'autre.
  - Le **lead passe en premier** : c'est ce qu'on vient vérifier le plus souvent
    (« a-t-il un lead VIT ? »), et il tient en une ligne là où les stats en
    prennent huit.
  - La colonne de gauche est **fixe (200 px)** : elle ne porte que des nombres
    courts, la place gagnée revient aux descriptions de compétences. La modale
    passe à **820 px** pour que celles-ci gardent la largeur qu'elles avaient
    seules — sans quoi les déplacer à droite les aurait rétrécies d'un tiers.
  - Sous `sm`, retour à la **pile** : deux colonnes de 100 px ne sont lisibles ni
    l'une ni l'autre.
  - ⚠️ `min-w-0` sur la colonne de droite : sans lui, une cellule flex refuse de
    descendre sous la largeur de son contenu, et une description longue
    déborderait sur les stats.
- ⚠️ Les **stats sont EN COLONNE**, une par ligne, et non en grille 2×4 : les
  valeurs s'alignent alors les unes **sous** les autres, ce qui permet de les
  comparer d'un monstre à l'autre et de repérer un ordre de grandeur d'un coup
  d'œil. En grille, « 10 050 » et « 107 » tombaient dans des colonnes
  différentes et l'œil devait sauter.
  - Même grammaire que la table de stats du panneau d'équipement : lignes
    séparées d'un filet, libellé terne à gauche, valeur **mono `tabular-nums`**
    alignée à droite, milliers séparés (« 10 050 »).
- Le **lead** est la **pastille des decks**, sans rien de plus
  ([LeadPill.tsx](src/components/siege/LeadPill.tsx)) : l'icône officielle du
  jeu, le montant, et c'est tout.
  - ⚠️ **Aucun texte.** La fiche a d'abord épelé la stat et la portée
    (« +33 % Attack Speed · Arène ») ; c'est l'icône du jeu qui **encode déjà
    les deux**, et c'est à elle qu'un joueur reconnaît un lead VIT d'un lead
    ATQ. Les mots n'apprenaient rien à qui lit l'icône et prenaient deux lignes
    là où une suffit. Le détail reste dans l'**infobulle**.
  - ⚠️ **Le même composant qu'en siège**, pas un rendu jumeau : deux pastilles
    de lead auraient divergé. Ce qui diffère est devenu des **options** —
    `size="lg"` (icône 32 px) et `pleineLargeur`.
  - **Agrandie et alignée sur la largeur des stats** qu'elle surmonte : à taille
    de siège elle flottait, minuscule, au-dessus d'un bloc. En siège elle reste
    petite — il y en a une par équipe, à côté des portraits.
  - Un lead **élémentaire** ajoute l'icône de son élément — celle du jeu ne dit
    pas lequel.
- ⚠️ **Le COEFFICIENT passe avant la description** : c'est la donnée qu'on vient
  chercher, celle qui décide d'un build. La description la raconte en mots.
- Les formules sont **traduites** pour leurs noms de stats (`3.6*{ATK}` →
  `3.6 × ATQ`) mais **pas réécrites** : « 360 % de l'ATQ » ferait perdre la forme
  qu'on retrouve sur les sites de référence, et introduirait une source d'erreur
  sur les formules composées.
- Les **effets** reprennent le code couleur du jeu : buffs en vert, debuffs en
  rouge. Les **améliorations** sont repliées — sept lignes par compétence font un
  mur si les quatre s'ouvrent d'un coup.
- ⚠️ **On n'invente aucun chiffre : la description fait foi**, telle que
  SWARFARM l'écrit. La pastille d'effet ne porte donc que le **nom** de l'effet.
  - Elle a un temps affiché un **taux** (« Increase ATB · 100 % ») pris au champ
    `chance` — la **probabilité d'application**, qu'on lisait comme la quantité
    de barre remplie. Deux nombres en pourcent : la confusion ne se voyait pas.
  - Pire, SWARFARM écrit **`chance: 0` pour un effet GARANTI** (`quantite: 25`
    pour +25 % de barre). Affiché tel quel, un effet certain annonçait « 0 % »,
    soit l'exact contraire de ce qu'il fait.
  - Seuls restent des champs lus **tels quels** : coefficient, nombre de coups,
    rechargement. La formule est **transcrite** (`3.6*{ATK}` → `3.6 × ATQ`),
    jamais recalculée.
- Le message d'absence dit **pourquoi** c'est vide : « aucune compétence » se
  lirait comme une affirmation sur le monstre, alors que c'est notre donnée qui
  manque (un monstre perso n'a pas de fiche SWARFARM).

### ⚠️ Un monstre transformable montre SES DEUX formes

La grille n'affiche qu'une carte par monstre transformable (voir
[bestiaire.md](../bestiaire.md#%EF%B8%8F-un-monstre-transformable-na-quune-fiche)) —
mais **leurs compétences diffèrent** : Bellenus voit son S2 passer de
**3.0 à 2.0 × ATQ** et son passif changer entièrement. Dédupliquer sans plus
ferait donc perdre la moitié de l'information.

La fiche porte un **contrôle à cran** — « Forme de base » / « Forme
transformée » — qui recharge stats, lead et compétences.

- Les libellés sont **« base » / « transformée »**, pas les noms : ils sont
  **identiques** des deux côtés. C'est le rang qui distingue, comme dans le jeu
  où l'une se transforme en l'autre.
- ⚠️ L'autre forme est cherchée dans le **bestiaire complet**, jamais dans ce qui
  est affiché : la grille l'a justement écartée, et la **box** ne la contient pas
  forcément (d'où la prop `allMonsters` passée par `App`).
- Rouvrir la fiche sur un autre monstre **remet la forme de base** : sans ça, on
  garderait la forme transformée du monstre précédent.
- Si l'autre forme est introuvable, **aucun sélecteur** n'apparaît — un contrôle
  à un seul cran ne sert à rien.

### ⚠️ Un fichier par monstre, pré-généré

[fetch-skills.mjs](scripts/fetch-skills.mjs) écrit
`public/data/skills/<com2usId>.json` (~3 Ko chacun, ~2 980 fichiers), lus par
l'unique point d'entrée [monsterSkills.ts](src/lib/monsterSkills.ts).

| Choix | Pourquoi |
|-------|----------|
| **Un fichier par monstre** | le détail complet pèse ~13 Mo ; tout embarquer ferait télécharger 13 Mo à qui vient consulter **un** monstre. Découpé, on ne charge que ce qu'on ouvre. |
| **Pré-généré en CI** | interroger SWARFARM depuis le navigateur ajouterait réseau, CORS et panne possible sur un contenu qui change une fois par patch. Même raisonnement que `monsters.json` et le journal des versions. |
| **Un seul point d'entrée** | ces données **vivront en base** plus tard ; tout appelant qui lirait le JSON lui-même rendrait la bascule invasive. |

- Le répertoire est **vidé avant écriture** : un monstre retiré de SWARFARM
  laisserait sinon son fichier derrière lui, et l'app servirait indéfiniment des
  données qui n'existent plus.
- Le script tourne **après** `fetch-monsters.mjs` dans la CI : il ne génère que
  pour les monstres présents dans `monsters.json`, donc lancé avant il manquerait
  les nouveaux.
- `chargerDetail` **ne lève jamais** : une fiche indisponible n'est pas une
  erreur d'application. Les absences sont **mémorisées** aussi — sans quoi un
  monstre sans fiche relancerait une requête vouée au 404 à chaque ouverture.

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
