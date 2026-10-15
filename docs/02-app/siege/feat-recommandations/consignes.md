# Recommandations — consignes et affichage des stats

Partie de [Siège · Recommandations](README.md).

## Consignes (deux niveaux)

Une recommandation ne sert pas qu'à donner des chiffres : elle transmet **comment
jouer**. D'où **deux zones de texte libre**, toutes deux **multi-lignes** et
**partagées dans l'export** :

| Niveau | Champ | Max | Rôle |
|--------|-------|-----|------|
| Recommandation | `Reco.note` | **600** car. | **Consignes générales**, valables pour tous les decks (ex. « viser le heal en premier », « pas de def break sur les tanks »). |
| Deck | `RecoDeck.note` | **400** car. | **Consignes du deck** (ex. « ne pas ouvrir sur le leader », « garder le strip pour le tour 2 »). |

- En **édition** : `textarea` redimensionnable + **compteur de caractères
  restants** (affiché seulement dans le dernier quart, rouge à 0). La saisie est
  bornée par `maxLength`, et **re-tronquée** à l'encodage/décodage.
- En **lecture** : encart titré (icône bloc-notes doré) affiché **sous l'en-tête**
  concerné — au-dessus des decks pour les consignes générales, au-dessus des
  3 monstres pour celles du deck. Les **retours à la ligne de l'auteur sont
  conservés** (`whitespace-pre-line`).
- Une consigne **vide n'est ni affichée ni transportée** (clé absente du JSON).
- Longueurs bornées volontairement : le texte voyage **dans** le fichier
  partagé (constantes `NOTE_MAX` / `DECK_NOTE_MAX` dans
  [recoShare.ts](src/lib/recoShare.ts)).

- ⚠️ **On stocke le `com2usId`, pas l'id local** : c'est la **seule clé stable
  d'un joueur à l'autre** (même clé de jointure que les imports SWEX, voir
  [../transverse/](../../transverse/)). Conséquence : un
  **monstre perso** (`com2usId = null`) **ne peut pas** entrer dans une
  recommandation.
- Les **8 stats** proposées sont celles du calcul de stats totales
  (`RECO_STATS` dans [types.ts](src/types.ts)) : PV, ATQ, DEF, VIT, Taux Crit,
  Dmg Crit, RES, Précision. **Chacune est facultative** : une stat vide n'est
  pas exigée.

### Affichage des stats — même grammaire que le panneau d'équipement

Les deux vues (saisie et lecture) reprennent le rendu du tableau de stats de
[MonsterGear.tsx](src/components/MonsterGear.tsx) — celui du détail d'un monstre
en RTA/siège : **table à lignes séparées** (`border-b border-border/40`), libellé
**terne** à gauche, valeurs **mono `tabular-nums`** alignées à droite, apport
**en vert**.

**Saisie** (deck en édition) — une ligne par stat :

```
Stat        base    bonus      total
VIT          107  + [ 105 ]      212
PV        10 050  + [24 950]  35 000
```

- La colonne **base** rappelle la stat du **monstre 6★ nu** (données SWARFARM
  `max_lvl_*`, voir [../transverse/](../../transverse/)).
- On ne saisit que le **bonus à apporter** — c'est ainsi qu'on raisonne quand on
  rune un monstre. Le **total** est affiché à droite.
- **C'est le total qui est stocké et partagé** (`RecoSlot.stats`), pas le bonus :
  une valeur absolue reste juste même si les données de base évoluent, et c'est
  ce qui est comparé à la stat réelle du joueur.
- Base inconnue (monstre absent des données) → base affichée « — » et base
  traitée comme 0 : le champ vaut alors directement le total.

**Lecture** — ⚠️ **pas de colonne « total » permanente**, contrairement à la
saisie : `base` et `bonus` par défaut, le total au clic — même geste que le
détail d'une rune ou d'un artéfact équipé (`RuneDetailBox`/`ArtifactDetailBox`
dans [PieceDetail.tsx](../../../../src/components/PieceDetail.tsx)), qui bascule
pareillement entre « valeur + meule » et le total cumulé. Trois colonnes en
permanence pour dire deux fois la même chose (le bonus ET le total qui
l'inclut) pèseraient plus que ce qu'elles ajoutent. Le **bonus est recalculé**
(`total − base`), il n'est jamais stocké :

```
                                    actuel                              actuel
Stat        base    bonus                        Stat        total
VIT          107     +105          220 ← atteint     ⇄        VIT      212        220
PV        10 050  +24 950      28 400 (−6 600)                PV    35 000    28 400 (−6 600)
```

⚠️ **« actuel » reste affichée dans les deux états** : c'est la seule colonne qui
compare à mon compte, elle ne dépend pas de la question détail/total. Son
en-tête est écrit **une seule fois**, au-dessus de la liste — répéter le mot
sur chaque ligne (« toi 220 ») pèserait plus lourd que la colonne.

#### ⚠️ Pas de table, pas de défilement horizontal — des lignes `flex-wrap`

Une table à colonnes fixes, sous sa largeur minimale, défilerait
**horizontalement DANS la carte** (`overflow-x-auto`) — et une barre de
défilement horizontale, sur trois ou quatre chiffres, est **illisible** : on
ne voit plus la ligne entière d'un coup d'œil, et il faut deviner qu'il y a
quelque chose à faire glisser.

**Chaque stat est une ligne `flex flex-wrap`** (label, base, bonus, total)
plutôt qu'une rangée de `<td>` : si la largeur manque, la **colonne « actuel »
passe à la ligne suivante** au lieu de sortir du cadre.

⚠️ **« actuel » garde un en-tête, écrit UNE SEULE fois au-dessus de la
liste** (`label`) : devant chaque valeur (« toi 220 » répété sur chaque
ligne), il serait plus lourd que la colonne. Les autres colonnes (`Stat`,
`base`/`bonus`/`total`) n'ont pas d'en-tête : leur ordre suffit à les nommer,
et « actuel » est la seule à valoir la peine d'un mot au-dessus puisqu'elle
n'apparaît qu'après une analyse.

- le **champ de bonus** est **`w-[calc(6ch+26px)]`, `pleineLargeur={false}`**
  — six chiffres de la police du champ, plus son rembourrage (24 px) et son
  contour (2 px) : au moins cinq chiffres visibles (PV ~35 000), plus un signe
  pour un bonus négatif. ⚠️ Une largeur fixe comme `w-14` (56 px) annonce cinq
  chiffres et n'en montre que trois : le `px-3` de `Champ` l'emporte sur un
  `px-1` ajouté (ordre de la feuille), et son `text-sm` sur `text-micro`. Une
  largeur en `ch` suit la police réelle, quel que soit le format.
  ⚠️ **`pleineLargeur={false}` n'est pas optionnel** : `Champ` (la librairie)
  vaut `w-full` par défaut, pensé pour un champ posé seul dans un formulaire.
  Sans l'annuler ici, un champ de cinq chiffres s'étirerait sur presque toute
  la largeur de la carte, posé sans colonne de table pour le contenir ;
- les cartes de slot restent en **`min-w-0`** : une cellule de grille refuse
  sinon de descendre sous la largeur de son contenu et **déborde sur sa
  voisine**.
- ⚠️ **« + Set » / « + Possibilité » (éditeur de sets) : `grid grid-cols-2` +
  `pleineLargeur` sur les DEUX boutons, jamais `flex` + `flex-1`.** `Bouton`
  pose `flex-none` dans son socle — un `flex-1` en `className` ne le bat pas
  (vérifié dans le CSS construit : `flex-none` est plus loin dans la feuille
  de style, donc gagne). `pleineLargeur`, lui, pose `w-full` et s'applique
  bien malgré `flex-none`. Posé sur un seul des deux boutons avec
  `flex-wrap`, celui-ci revendiquerait toute la rangée et pousserait l'autre à
  la ligne suivante — les deux actions ne se liraient plus comme une paire.
  La grille à deux
  colonnes égales fait que chaque `w-full` remplit sa propre moitié : les
  deux boutons restent côte à côte, à égalité de largeur.
- le **panneau de choix des sets** (ouvert par « + Set ») affiche chaque set
  du jeu en **case `w-7 h-7` (28 px)** avec `RuneIcon size={16}` — pas
  `w-8 h-8`/20 px. Le jeu compte plus de vingt sets ; à
  32 px + `gap-1`, la grille pèserait lourd sur une carte de siège déjà
  étroite, pour un choix qu'on fait une fois par slot. Le symbole reste net
  à 16 px (même échelle que la roue de runes, qui le dessine déjà aussi
  petit).

La colonne **« actuel » n'apparaît qu'après une analyse**, cohérent avec le
fait que rien n'est confronté par défaut — mais une fois là, elle reste
affichée dans les deux états détail/total (voir plus haut).

#### ⚠️ Une reco affiche des stats de FICHE, et rien d'autre

Les chiffres d'une reco sont ceux que le jeu montre sur la **carte du monstre,
runes posées, AVANT le combat** : base + runes + artéfacts + relique + bonus de
set. Ni totem de guilde, ni lead, ni tour — **le total vaut toujours base +
bonus**.

```
Stat        base    bonus      total
VIT          101  + [ 208 ]      309
```

⚠️ **La colonne « total » de la VIT n'ajoute PAS le bonus de siège** (totem
+15 % et lead du deck). L'y ajouter, pour y lire la vitesse de combat des
cartes d'équipe, aurait trois conséquences, toutes mauvaises :

- **le total ne vaudrait plus base + bonus** — « 101 + 208 » s'afficherait
  « 352 », et la ligne se lirait comme une erreur de calcul ;
- **la colonne « actuel » recevrait le même bonus**, alors que le verdict
  (`ok`/`ko`, [recoMatch.ts](src/lib/recoMatch.ts)) se calcule sur la stat de
  fiche : on pourrait lire **deux nombres égaux sur une ligne marquée en
  rouge** ;
- c'est la stat de **fiche** qu'on relève dans le jeu quand on rune un monstre,
  et c'est elle que l'Optimiseur cherche à atteindre — donc celle qu'une reco
  doit demander.

La vitesse de **combat** reste affichée là où elle décide de quelque chose : sur
les **cartes d'équipe de siège** et dans le **speed tuning**, où se joue l'ordre
de tour. Deux écrans, deux questions — et chacun le dit.

Le champ de saisie du bonus est un **`type="text"` + `inputMode="numeric"`**, et
non un `type="number"` : les boutons `+/-` du navigateur mangeraient la largeur
d'une colonne déjà étroite. La frappe non numérique est ignorée ; vider le champ
retire la stat.
- **Changer le monstre d'un slot remet ses stats ET ses sets à zéro** (ils ne
  valent que pour le monstre visé).

#### Raccourci « Tick rapide / Tick lent » sur la VIT

En saisie, sous la ligne VIT de chaque monstre, deux boutons **« Tick
rapide »** et **« Tick lent »** — les ticks 286 et 239 des cartes d'équipe du
siège (`SIEGE_TICKS`, voir [feat-speed-tick.md](../feat-speed-tick.md)). Un clic met dans la
VIT la **VIT de fiche** qui amène le monstre **pile** sur le tick en combat,
totem (+15 %) et lead de vitesse du deck compris (`ficheSpeedForTick` dans
[speed.ts](src/lib/speed.ts) ; lead lu sur le slot 0, appliqué au monstre selon
son élément par `siegeLeadFor`).

- ⚠️ **Pas de chiffre sur le bouton**, contrairement au siège (« Rapide
  286 ») : la VIT écrite est celle de fiche — 271 pour un monstre de base 96
  sans lead —, et un bouton qui annoncerait 286 pour écrire 269
  se lirait comme une erreur. Le tick visé et la VIT écrite sont dans
  l'infobulle (« Mettre la VIT à 271 : tick 286 en combat, totem et lead
  compris »).

- ⚠️ **Un raccourci de saisie, rien de plus : aucun tick n'est stocké.** Seule
  la VIT l'est : ni le modèle ni le format d'export ne portent de tick. Pour régler
  l'**ordre de jeu** entre monstres au même tick, on ajoute soi-même +1, +2…
  dans le champ bonus ; rien d'autre n'est affiché (ni vitesse de combat, ni
  ordre calculé).
- Le bouton est **allumé** tant que la VIT tombe dans le tick : de pile à
  +15 au-dessus (`TICK_ABOVE_MARGIN`, la marge de `tickDanger`). Un +3 pour
  passer devant le garde allumé. Un clic, allumé ou non, remet la VIT pile au
  tick — il n'y a rien à « éteindre ».
- Le lead est celui **du moment du clic** : changer de leader ensuite ne
  recalcule pas la VIT (rien ne dit qu'elle venait d'un tick) — il faut
  recliquer.
- **Désactivé**, toujours affiché, avec la raison en infobulle :
  - quand **toutes** les possibilités de runage du monstre portent **Swift** —
    un runage Swift se speed tune, il ne vise pas de tick (même règle que les
    équipes de siège). Une seule possibilité sans Swift suffit à l'activer : le
    calcul se fait alors sans Swift ;
  - quand la **vitesse de base** du monstre est inconnue.
- Les boutons occupent **leur propre ligne** (`basis-full`), à une place fixe :
  le total qui change de largeur au clic ne les déplace pas. Ils sont **calés à
  droite**, sous le champ et le total qu'ils remplissent — à gauche, sous la
  base, ils ne s'aligneraient sur rien. Police du texte, pas `font-mono` : ce
  sont des mots, pas des chiffres.
