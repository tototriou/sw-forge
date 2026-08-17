# Siège · Recommandations (`#/siege/recommandations`)

Troisième sous-onglet du siège. Permet à un joueur de composer une
**recommandation = un ENSEMBLE de decks** (ex. « mes 6 défenses de guilde »),
chaque deck portant 3 monstres avec les **sets**, les **propriétés d'artéfact**
et les **stats à viser** sur chacun ; de **l'exporter** d'un bloc pour la partager ; et à un autre joueur de
**l'importer** puis de voir **immédiatement quels decks il peut jouer**.

Fichiers :
- [RecoBoard.tsx](src/components/siege/RecoBoard.tsx) — barre d'actions, import/export, liste.
- [RecoCard.tsx](src/components/siege/RecoCard.tsx) — une recommandation (vue & édition).
- [useSiegeRecos.ts](src/hooks/useSiegeRecos.ts) — état + persistance.
- [recoShare.ts](src/lib/recoShare.ts) — export/import JSON + validation.
- [recoMatch.ts](src/lib/recoMatch.ts) — confrontation avec le compte (calcul pur).
- [ownedBuilds.ts](src/lib/ownedBuilds.ts) — collecte de tous les builds du joueur.
- [recoFromSiege.ts](src/lib/recoFromSiege.ts) — deck pré-rempli depuis une équipe d'offense.
- [recoSearch.ts](src/lib/recoSearch.ts) — recherche d'un monstre dans les recos (calcul pur).

## Modèle

```ts
type RecoStatKey = 'hp'|'atk'|'def'|'spd'|'cr'|'cd'|'res'|'acc';

interface RecoSlot {
  com2usId: number | null;                    // null = slot vide
  name: string;                               // repli d'affichage
  stats: Partial<Record<RecoStatKey, number>>;// minimums (absent = non exigé)
  setOptions: string[][];                     // POSSIBILITÉS de runage, une seule suffit
  artifacts: Record<'element'|'archetype', number[]>; // propriétés d'artéfact exigées, 4 max chacune
}
interface RecoCounter {                        // une défense adverse que le deck bat
  monsters: { com2usId: number|null; name: string }[]; // toujours 3
  note: string;                                // « si le Chloe est en lead »
}
interface RecoDeck { name: string; note: string; slots: RecoSlot[]; counters: RecoCounter[] } // 3 slots, index 0 = leader
interface Reco { id: string; origin: 'mine'|'imported'; name: string; author: string; note: string; decks: RecoDeck[] }
type RecoPayload = Omit<Reco, 'id' | 'origin'>; // ce qui voyage dans un export
```

**Une recommandation est un lot de decks**, pas un deck isolé : on partage
« mes défenses de siège » en un seul fichier, et le destinataire voit d'un coup
lesquelles il peut jouer.

- Une recommandation garde **toujours au moins un deck** (supprimer le dernier
  en recrée un vide).
- Un même monstre ne peut pas occuper deux slots **du même deck**, mais peut
  revenir dans **un autre deck** de la recommandation.
- Chaque deck a un **nom facultatif**. **Laissé vide, il reprend les noms de ses
  monstres séparés par un tiret** (« Trevor - Bella - Loren ») ; « Deck N » tant
  qu'aucun monstre n'est choisi.
  - Le nom automatique est **dérivé à l'affichage** (`autoDeckName` /
    `deckLabel` dans [RecoCard.tsx](src/components/siege/RecoCard.tsx)), **jamais
    stocké** : il suit les changements de monstres, et se recalcule chez celui qui
    importe (mêmes `com2usId` → mêmes noms).
  - En édition, il apparaît en **placeholder** du champ : taper quelque chose le
    remplace, vider le champ le rétablit.
  - Si un monstre est absent des données chargées, on retombe sur le nom stocké
    dans le slot au moment du partage.
- Les **decks totalement vides** ne sont ni exportés ni comptés dans les statuts.

## Origine & filtre

Chaque recommandation porte une **origine** :

| Origine | Attribuée quand | Rendu |
|---------|-----------------|-------|
| `mine` | créée via « Créer une recommandation » | — |
| `imported` | reçue via un import | puce **« Importée »** (icône ↓) dans l'en-tête |

⚠️ L'origine est **purement locale** : elle **n'est jamais transportée** dans un
export (d'où `RecoPayload`, qui exclut `id` **et** `origin`). Ce qui est « à moi »
chez l'auteur devient « importée » chez celui qui la reçoit — y compris si je
réimporte mon propre export.

**Filtre** : **Toutes · Mes recos · Importées**, chacun avec son effectif.
N'apparaît **que s'il existe au moins une recommandation**. Persistance via
`useStickyState` (survit à la navigation, remis à « Toutes » au reload). Il vit
dans le **bloc de filtres** décrit plus bas, sur la rangée « Origine ».

Garde-fous pour ne jamais « perdre » ce qu'on vient de faire :
- **créer** une recommandation depuis la vue « Importées » bascule le filtre sur
  « Mes recos » ;
- **importer** depuis la vue « Mes recos » bascule sur « Toutes ».

## Recherche par monstre — sur toute la page

**Jusqu'à trois monstres**, avec un sélecteur de **rôle** : `Partout` ·
`Défense à taper` · `Offense à runer`
([recoSearch.ts](src/lib/recoSearch.ts), calcul pur).

**Placement : juste au-dessus des recommandations**, dans le bloc de filtres.
C'est elle qui décide de ce que la liste montre, elle doit donc être collée à ce
qu'elle filtre.

### ⚠️ UN SEUL bloc de filtres, à rangées intitulées

Origine, monstres cherchés et rôle **filtrent tous la même liste** et se
**combinent**. Ils sont donc réunis dans **un seul encart** (`border` +
`bg-panel/40`), en **rangées `intitulé + contrôle`** — même grammaire que
l'inventaire d'artéfacts (voir [../compte/artefacts.md](../compte/artefacts.md)) :

| Rangée | Contrôle | Visible |
|--------|----------|---------|
| **Origine** | `Segmented` Toutes · Mes recos · Importées, effectif dans chaque cran | dès 1 recommandation |
| **Monstres** | les 3 cases + le champ + « Vider » | dès 1 recommandation |
| **Rôle** | `Segmented` Partout · Défense à taper · Offense à runer + le compteur de résultats | une fois un monstre posé |

⚠️ **Au DOIGT, « Origine » descend dans le panneau « Options »** (sous un filet,
sous les actions) — la carte reste à la **recherche**, le contrôle qu'on veut
sous le pouce sans ouvrir un panneau. À la souris, rien ne change : les trois
rangées restent réunies sur la page. Rendu **une seule fois**
(`origineFilter(pleineLargeur)`), posé aux deux endroits — même geste que
`actions` et `effacer`.

⚠️ **Pleine largeur dans le panneau**, pas à sa taille propre : seul contrôle
de sa ligne, il y flotterait sinon dans une bande vide. `Segmented` passe en
`size="lg"` (chaque cran se partage la largeur à égalité) et l'intitulé
« Origine » monte au-dessus plutôt qu'à côté. À la souris, il garde sa taille
`sm` et son intitulé de largeur fixe, à côté des autres rangées.

- ⚠️ **Ils étaient posés à trois niveaux différents, sans intitulé** : trois
  objets flottants dont rien ne disait qu'ils portaient sur la même liste ni
  qu'ils se cumulaient. L'intitulé de **largeur fixe** (`w-[76px]`) aligne les
  contrôles entre eux quelle que soit la longueur du mot.
- ⚠️ **Le filtre d'origine utilise le VRAI [Segmented](src/components/Segmented.tsx)**,
  et non une copie écrite à la main. La copie avait dérivé — `bg-panel` au lieu de
  `bg-panel2`, `rounded-xl p-1` au lieu de `rounded-lg p-0.5`, texte plus grand :
  deux contrôles à cran voisins n'avaient ni le même cadre, ni le même rayon, ni
  la même taille. Un composant partagé existe, on le prend.
- L'**effectif** vit **dans le cran, après le libellé** (`suffix` de `Segmented`,
  ajouté pour ça) : un nombre se lit après ce qu'il compte. Il reste `ink-dim`
  dans tous les états — c'est une quantité, pas l'état du cran, que le fond dit
  déjà (voir [../shared/design.md](../shared/design.md)).
- Le **compteur de résultats** est sur la rangée **Rôle** : c'est lui qui décide
  combien il en reste. Il n'a ainsi plus besoin d'une hauteur de ligne en dur
  (`leading-[30px]`) pour se caler sur un contrôle voisin.
- **« Vider » est sur la rangée Monstres**, avec les cases qu'il vide — et non
  avec le sélecteur de rôle, auquel il ne touche pas.

### ⚠️ Plusieurs monstres se cumulent en ET, dans la MÊME composition

Chaque monstre ajouté **précise** la recherche au lieu de l'élargir : c'est ce
qui permet de retrouver une défense qu'on affronte — « Chloé + Trevor + Bella »
sort le deck qui bat **exactement** cette composition, pas les trois listes de
decks qui jouent l'un des trois.

- Le « tous présents » vaut **par composition** : soit les 3 slots d'un deck,
  soit une **même** défense visée. Réparti entre les deux, il ne voudrait rien
  dire — un deck qui *joue* Chloé et qui *bat* Trevor ne réunit pas les deux.
- ⚠️ Une position déjà retenue **ne compte pas deux fois** : chercher deux fois
  le même nom exige **deux** monstres. Sans ça, « chloe chloe » passerait sur un
  deck n'en portant qu'une.
- **Un champ vide n'exige rien** : sinon ouvrir un champ viderait la page.
### Rendu — trois cases, un champ

⚠️ **Trois CASES au-dessus, et non trois champs texte** : elles montrent la
forme de ce qu'on cherche — une composition de 3 monstres — **avant même d'avoir
tapé**, et reprennent le langage des slots de deck de la page. Une case vide
porte un `+` en tireté.

- **Un champ unique à côté** (`MonsterPicker`, celui des slots de deck) remplit
  la **première case libre** : on enchaîne les trois noms sans viser une case
  entre chaque. Il est sur la **même rangée** que les cases qu'il alimente —
  empilé dessous, rien ne disait qu'il les remplissait.
- **Portrait, jamais le nom seul** : plusieurs monstres portent le même nom
  (formes 2A) — voir [MonsterAvatar](src/components/MonsterAvatar.tsx). Repli sur
  les initiales si le monstre est absent des données chargées.
- ⚠️ **Les monstres posés sont retirés des suggestions** : le ET exige des
  monstres **distincts**, en poser deux fois le même garantirait zéro résultat.
- ⚠️ **Le champ disparaît quand les trois cases sont prises** : un champ de
  saisie qui n'a plus où poser ce qu'on y tape se lit comme un bug. Un rappel
  prend sa place.
- ⚠️ **Retirer ne tasse pas les cases restantes** : chacune garde sa place,
  sinon les portraits sautent d'une case à l'autre sous le curseur.
- On stocke les **noms** et non des `com2usId` : la recherche compare des noms,
  et un monstre d'une reco importée peut être absent des données chargées.
- **Deux effacements, deux portées** : **cliquer un portrait** retire ce
  monstre (on affine), le bouton **« Vider »** abandonne la recherche entière.
  Ce dernier n'apparaît **qu'une fois quelque chose posé**.
- Le message d'absence de résultat **énonce la règle** au-delà d'un terme
  (« … ne réunit A + B ») : sans ça, une recherche à trois qui ne renvoie rien
  se lit comme un bug, puisqu'on voit chaque monstre à l'écran.
- ⚠️ Il **nomme aussi le rôle cherché**, puisque le sélecteur filtre :
  « Aucune défense visée ne réunit … », « Aucun deck d'offense … », « Aucun deck
  ni défense visée … ». Sans ça, on conclut que la composition n'existe pas
  alors qu'elle est peut-être dans l'autre rôle.
  - Sur un mode restrictif, le message propose **« Chercher partout »** à côté
    d'« Effacer la recherche » : la sortie utile est d'**élargir**, pas
    d'abandonner — et c'est un clic.

Deux questions se posent devant une liste de recommandations, et elles n'ont pas
la même réponse :

| Question | Où le monstre est trouvé |
|----------|--------------------------|
| « **contre quoi** ce monstre est-il joué ? » | dans une **défense visée** (`counters`) |
| « **qui** joue ce monstre ? » | dans un **deck** (`slots`) |

- ⚠️ **Le sélecteur FILTRE** : il décide **où** l'on cherche, et ce qui relève de
  l'autre rôle **n'est pas affiché**.
  - `Offense à runer` ne regarde que les **monstres des decks**, `Défense à
    taper` que les **défenses visées**, `Partout` les deux.
  - Un mode qui se contentait de **trier** laissait à l'écran des résultats
    qu'on n'avait pas demandés : demander « offense à runer » et voir remonter
    des défenses n'est pas un classement, c'est du bruit. « Partout » reste là
    pour qui veut les deux.
  - Aucun tri n'est donc appliqué ensuite : tout ce qui reste répond au rôle
    demandé, et l'ordre de la liste reste celui de l'utilisateur.
- Le sélecteur **n'apparaît qu'une fois quelque chose tapé** : sans requête, il
  n'y a rien à filtrer.
- **Casse et accents ignorés** : « chloe » trouve « Chloé », sinon la recherche
  est inutilisable sur des noms que le jeu accentue.
- Le nom comparé est celui du **bestiaire** s'il est chargé, sinon celui **figé
  au partage** — même repli que partout pour un monstre absent des données.
- ⚠️ **Une carte qui répond est dépliée d'office, sans toucher à l'état de
  repli.** C'est un état de **consultation**, pas un choix de l'utilisateur :
  effacer la recherche rend à la page exactement le repli qu'elle avait avant.
  Sans ça on se retrouve avec six decks ouverts sans les avoir ouverts.
- ⚠️ **La recherche PROPOSE le dépliage, elle ne l'impose pas.** Une carte
  ouverte par un résultat reste **refermable en un clic**.
  - ⚠️ **UN SEUL état à trois valeurs** par carte — *absent* (l'automatique
    décide) · *ouverte* · *fermée* — et non deux ensembles qui se corrigent
    l'un l'autre. Avec deux ensembles (« ouvertes » + « refermées pendant la
    recherche »), fermer une carte à la fois ouverte à la main **et** trouvée
    par la recherche demandait **trois clics** : chaque clic n'en corrigeait
    qu'un, l'autre rouvrait aussitôt. Un choix explicite écrase l'automatique,
    point.
  - Ces choix **ne survivent pas à un changement de recherche** : ils valaient
    pour ces résultats-là. Mais l'effacement **ne s'applique que si une
    recherche est en cours** — sinon taper puis effacer refermait les cartes
    ouvertes à la main bien avant de chercher.
  - **Règle générale** : un filtre peut changer ce qui est montré, il ne rend
    jamais un contrôle inopérant — ni ne demande trois clics là où un suffit.
- ⚠️ **Le filtre porte sur les DEUX niveaux** : quelles recommandations, et
  **quels decks à l'intérieur**. Les decks qui ne répondent pas ne sont **pas
  affichés du tout**. Sans ça, une carte remontait dans les résultats en
  montrant ses six decks, et il restait à chercher à l'œil lequel répondait.
  - Les decks sont parcourus dans leur ordre **d'origine** et simplement omis :
    l'index réel indexe le résultat d'analyse, l'édition et le repli.
  - Le compteur d'en-tête passe à **« N sur M decks »** : afficher le total
    alors qu'un seul deck est à l'écran se lit comme un bug — on cherche les
    cinq autres. Même règle que le compteur filtré de l'inventaire d'artéfacts.
  - **« Déplier tous les decks » est masqué** pendant une recherche : les decks
    trouvés sont déjà dépliés, et le lien désignerait des decks absents de
    l'écran.
- **Surlignage** : le slot ou la défense qui contient le monstre prend un **fond
  d'accent léger**.
  - ⚠️ **Un fond, jamais une bordure** : celle-ci porte déjà le résultat de
    l'analyse (rouge/vert), la remplacer effacerait cette information au moment
    même où on parcourt la page. Deux langages, deux supports. Même écho de
    filtre que les propriétés recherchées d'un artéfact.
- **Aucun résultat** → message dédié, distinct de celui du filtre : dire « tu
  n'as créé aucune recommandation » après une recherche ferait croire à une
  perte de données.
- Persistée via `useStickyState` (survit à la navigation, repartie à vide au
  reload), comme le filtre d'origine.

Effet du filtre sur les actions :
- **Export global** : exporte **ce qui est affiché**. ⚠️ Le bouton s'intitule
  **« Tout exporter » en permanence** : un libellé qui change avec le filtre se
  lit comme un autre bouton, on cesse de le reconnaître d'un écran à l'autre. Ce
  qui part réellement est dit par l'**infobulle**, et récapitulé par le message
  de retour (« N recommandation(s) · M deck(s) »).
- **Tout effacer** : efface **tout**, filtre ou non (la modale le dit
  explicitement).
- Filtre sans résultat → message dédié + lien « Voir toutes les recommandations »
  (l'écran d'invite initial n'apparaît que si le stock réel est vide).

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
  [../shared/import-compte.md](../shared/import-compte.md)). Conséquence : un
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
  `max_lvl_*`, voir [../shared/donnees-monstres.md](../shared/donnees-monstres.md)).
- On ne saisit que le **bonus à apporter** — c'est ainsi qu'on raisonne quand on
  rune un monstre. Le **total** est affiché à droite.
- **C'est le total qui est stocké et partagé** (`RecoSlot.stats`), pas le bonus :
  une valeur absolue reste juste même si les données de base évoluent, et c'est
  ce qui est comparé à la stat réelle du joueur.
- Base inconnue (monstre absent des données) → base affichée « — » et base
  traitée comme 0 : le champ vaut alors directement le total.

**Lecture** — **mêmes colonnes** que la saisie (`base` / `bonus` / `total`), pour
qu'on lise une recommandation exactement comme on l'écrit. Le **bonus est
recalculé** (`total − base`), il n'est jamais stocké :

```
Stat        base    bonus     total       toi
VIT          107     +105       212       220          ← vert : atteint
PV        10 050  +24 950    35 000   28 400 (−6 600)  ← rouge : écart affiché
```

#### ⚠️ Les tables de stats ne se compriment jamais

Sur écran étroit, les colonnes se refermaient jusqu'à **masquer la valeur saisie**
dans le champ de bonus, et les cartes de slot finissaient par se chevaucher.
Trois garde-fous, à conserver ensemble :

- le **champ de bonus** a un plancher de **`min-w-[5ch]`** — cinq chiffres
  visibles, la taille de la plupart des stats (PV ~35 000) ;
- chaque table porte une **largeur minimale** (`min-w-[236px]`) et défile
  **horizontalement dans sa propre carte** (`overflow-x-auto`) au lieu d'écraser
  ses colonnes ;
- les cartes de slot sont en **`min-w-0`** : sans ça une cellule de grille refuse
  de descendre sous la largeur de son contenu et **déborde sur sa voisine**
  plutôt que de laisser la table défiler.

La colonne **« toi » n'apparaît qu'après une analyse** (sinon la table s'arrête à
`total`), cohérent avec le fait que rien n'est confronté par défaut.

#### ⚠️ VIT : le lead entre dans le TOTAL, pas dans le bonus

En siège, la vitesse gagne un bonus en % de la **base** : **totem de guilde
(+15 %)** et **lead de vitesse du leader du deck** (slot 0). C'est ce qui donne
la vitesse de combat lue sur les cartes d'équipe, et donc la seule valeur qu'on
puisse rapprocher d'une consigne (« Trevor 352 »).

Ce bonus est appliqué **uniquement à l'affichage du total** (et de « toi »),
jamais à la base ni au bonus saisi — **base et bonus restent les valeurs
visibles du build** :

```
Stat        base    bonus      total
VIT          101  + [ 208 ]      352      ← 309 de build + 43 (totem 15 % + lead 28 %)
```

- Le lead vient du **slot 0 du deck** (`speedLeadOf`), filtré par élément s'il
  est élémentaire (`siegeLeadFor`) — il ne profite alors qu'aux monstres du bon
  élément, donc le bonus est **par monstre**, pas par deck.
- **Rien ne change dans les données ni dans la comparaison** : `RecoSlot.stats`
  stocke toujours la vitesse du build, et l'analyse confronte build à build. Le
  bonus étant identique des deux côtés (même deck, même leader), l'ajouter
  n'aurait fait que déplacer les deux valeurs.
- La précision reste **en infobulle** sur le libellé VIT. Pas de note de bas de
  table : elle alourdissait la carte pour un détail qu'on ne lit qu'une fois.

Le champ de saisie du bonus est un **`type="text"` + `inputMode="numeric"`**, et
non un `type="number"` : les boutons `+/-` du navigateur mangeaient la largeur
d'une colonne déjà étroite. La frappe non numérique est ignorée ; vider le champ
retire la stat.
- **Changer le monstre d'un slot remet ses stats ET ses sets à zéro** (ils ne
  valaient que pour le monstre visé).

## Sets de runes recommandés

Un monstre porte **6 runes** ; un set 4 pièces en coûte 4, tous les autres 2
(voir `setPieces` / `FOUR_PIECE_SETS` dans [effects.ts](src/lib/effects.ts)).
D'où les **combinaisons possibles**, toutes gérées :

| Combinaison | Coût | Exemple |
|-------------|------|---------|
| 4 + 2 | 6 | Violent + Will |
| 2 + 2 + 2 | 6 | Will + Focus + Endure |
| 4 seul | 4 | Violent |
| 2 + 2 | 4 | Will + Focus |
| 2 seul | 2 | Will |
| aucun | 0 | — |

- **Un seul set 4 pièces** possible (4 + 4 = 8 > 6) : `canAddSet` l'interdit.
- **Répétitions autorisées** : un set 2 pièces peut être demandé **plusieurs
  fois** (ex. **3× Fight** = 6 runes Fight, bonus cumulé) — d'où une **liste**
  et non un ensemble, et un **retrait par position** (pas par clé).
#### Plusieurs runages au choix — **une seule possibilité suffit**

Un monstre se joue rarement d'une seule façon : « **Violent/Némésis OU
Violent/Vengeance** ». `RecoSlot.setOptions` est donc une **liste de
combinaisons**, jamais une seule.

- Il y a **toujours au moins une possibilité** (éventuellement vide = « aucun
  set exigé ») ; supprimer la dernière la vide au lieu de la retirer.
- ⚠️ **La confrontation est satisfaite dès qu'UNE SEULE possibilité l'est.**
- L'analyse retient la **meilleure** possibilité (le moins de sets manquants) et
  ne marque ✓/✗ **qu'elle** (`SlotMatch.matchedOption`) : annoncer « il te manque
  X » sur un runage que le joueur n'a pas choisi n'aiderait pas.
- Les doublons sont écartés à la lecture : deux fois la même combinaison
  n'apporte rien et brouillerait l'affichage « A ou B ».
- En édition, chaque possibilité est un bloc avec ses chips, son compteur
  `N/6 runes` et son bouton **« + Set »** ; **« + Possibilité »** en ajoute une,
  et les blocs sont séparés par un **« ou »**.

#### Choix d'un set — **par icônes, pas par menu déroulant**

Un bouton **« + Set »** ouvre une **grille des symboles de sets du jeu** ; un
clic ajoute la chip correspondante. On reconnaît un set à son symbole, pas à son
nom dans une liste — même règle que les filtres de runes (voir
[../compte/runes.md](../compte/runes.md)).

- Le panneau **reste ouvert** pour enchaîner les ajouts (2 + 2 + 2 se pose en
  trois clics sans rouvrir).
- **Tous** les sets sont affichés ; ceux qui **ne tiennent plus** dans les
  6 runes sont **grisés et non cliquables** plutôt que retirés — on voit ce qui
  existe et pourquoi c'est refusé.
- Compteur `N/6 runes` en permanence ; à saturation le bouton devient
  « Plus de place (6 runes) » et **le panneau se referme tout seul**, sinon on
  laisserait une grille entièrement grisée à l'écran.
- Helpers purs : `setsCost`, `canAddSet`, `missingSets`
  ([recoMatch.ts](src/lib/recoMatch.ts)). La contrainte est **rejouée au
  chargement** du `localStorage` (données potentiellement bricolées à la main).

### Activation côté joueur — logique partagée

`activeSets(keys)` dans [effects.ts](src/lib/effects.ts) calcule les sets
**réellement actifs** d'un build : set 4 pièces à 4 runes, les autres à 2, un set
2 pièces pouvant être actif **plusieurs fois** (6 runes Fight → `['fight',
'fight','fight']`), et une rune **Intangible** servant de **joker** —
⚠️ **uniquement s'il y a EXACTEMENT un set incomplet** parmi les runes
réellement portées (règle du jeu, voir
[compte/calcul-runes.md §5.2](../compte/calcul-runes.md)) : deux sets
incomplets ou plus, même si l'un des deux n'est pas celui recherché, et le
joker ne complète plus rien.

> Cette fonction était auparavant privée à `importAccount.ts` (sur les `set_id`
> com2us) ; elle a été **remontée dans `effects.ts`** et l'import la réutilise
> après conversion `set_id → clé`. **Une seule règle d'activation** pour l'import
> de compte et pour les recommandations.

La confrontation compare en **multi-ensemble** : demander 2× Fight exige bien
deux fois le set actif.

## Défenses visées — « Fort contre »

Une recommandation dit quoi jouer ; elle ne disait pas **contre quoi**. Un deck
porte donc une liste de **défenses adverses qu'il bat** (`RecoDeck.counters`) :
**3 monstres** et une **précision facultative** (« si le Chloe est en lead »).

- **Facultatif et multiple** : un même deck bat souvent plusieurs compositions,
  et la plupart des decks n'en portent aucune.
- ⚠️ **Une identité, pas un build.** Ni sets, ni stats, ni propriétés
  d'artéfact : on décrit ce qu'on **affronte**, pas comment c'est runé. Le
  runage adverse n'est pas connaissable depuis l'app, et l'exiger transformerait
  une information de terrain en fiche que personne ne remplirait.
- ⚠️ **Purement informatif : jamais confronté au compte.** L'app ne connaît que
  **mes** équipes, pas celles des adversaires — il n'y a rien à quoi comparer.
  Ce bloc ne porte donc ni statut, ni badge, ni couleur de résultat, et
  n'intervient pas dans « Analyser mes decks ».
- Même clé stable que partout : le **`com2usId`**. Un monstre perso n'y entre
  pas.
- Un monstre ne peut pas occuper deux emplacements de **la même** défense ; il
  peut revenir dans une autre.

**Placement** : bloc dédié **sous les 3 monstres** du deck, séparé par un filet.
C'est une information sur le **deck entier**, pas sur un slot — et le deck garde
sa structure habituelle au-dessus. Visible **deck déplié** seulement : la ligne
repliée porte déjà 3 monstres, y ajouter N×3 portraits adverses la rendrait
illisible.

- **Lecture** : les défenses sont **côte à côte** (`flex-wrap`), chacune réduite
  à ses **3 portraits**.
  - ⚠️ **En rangée et non empilées** : une vignette fait 90 px de contenu, une
    par ligne gaspillait toute la largeur. Côte à côte, on en embrasse plusieurs
    d'un coup — c'est le point, reconnaître la composition qu'on affronte.
  - ⚠️ **La précision est repliée**, et s'ouvre **au clic sur la vignette** : une
    note dépliée fait deux fois la hauteur d'une vignette et casserait
    l'alignement de toute la rangée.
  - Un **chevron** marque les vignettes qui en portent une : sans lui, rien ne
    distingue une défense qui cache une précision d'une défense qui n'en a pas,
    et on cliquerait au hasard. Une vignette sans note **n'est pas cliquable** —
    un bouton qui ne fait rien se lit comme un défaut.

#### La précision s'ouvre en POPOVER, ancré sous sa vignette

La vignette cliquée prend la **bordure d'accent** — comme le monstre sélectionné
d'une équipe de siège dont on consulte les runes (voir
[SiegeTeam.tsx](src/components/siege/SiegeTeam.tsx)) — et la note apparaît en
**flottant ancré** juste dessous.

- ⚠️ **Un flottant, pas un panneau dans le flux.** Posé dans le flux, il devait
  s'aligner sous une vignette qui, en `flex-wrap`, peut être n'importe où sur
  n'importe quelle ligne : le trait du cran et celui du panneau ne se
  rejoignaient pas, et **le rattachement mentait**. Un flottant naît de son
  ancre, il n'a rien à aligner — et il ne pousse rien : la rangée reste immobile
  pendant qu'on lit.
- ⚠️ **`origin-top-left`** : un flottant ancré grandit **depuis son ancre**,
  jamais depuis son centre (voir [../shared/design.md](../shared/design.md)).
- ⚠️ **Une seule précision ouverte à la fois.** L'état vit dans le **bloc**, pas
  dans la vignette.
- Se ferme au **clic extérieur** et à **Échap**, même motif que les autres
  popovers de l'app ([SettingsMenu.tsx](src/components/SettingsMenu.tsx)).
- `min-w-full` (au moins la largeur de sa vignette, pour se lire comme sa suite)
  et **280 px au plus** : la note est une phrase courte.
- La vignette ouverte passe en **`z-20`** : les suivantes sont peintes après dans
  le flux et passeraient sinon par-dessus le flottant.

#### ⚠️ La recherche n'ouvre AUCUNE précision

Une défense trouvée ouvrait sa précision d'office. Sur une recherche qui remonte
plusieurs défenses, cela dépliait des notes qu'on n'avait pas demandées — et avec
un panneau unique sous la rangée, cela n'a plus de sens du tout. Le
**surlignage** de la vignette suffit à dire laquelle répond ; on ouvre si on veut
lire.
### ⚠️ Un « + », pas un bouton « Éditer »

Le bloc **n'a pas de mode édition**. Noter la défense qu'on vient d'affronter est
un geste **de passage** : le crayon ajoutait une étape (ouvrir le mode, ajouter,
refermer) là où le geste réel est simplement « + ».

- **« + Défense »** ajoute une entrée **et l'ouvre en édition** — sinon on aurait
  posé une vignette vide sans moyen de la remplir.
- Le **« + » vit DANS la rangée**, à la suite des défenses existantes : c'est là
  qu'on ajoute, et il montre où la prochaine se posera. Il est **toujours
  visible**, y compris sur un deck qui n'en porte aucune — c'est lui qui rend la
  fonctionnalité découvrable, rôle que tenait l'intitulé + crayon.
- ⚠️ **L'édition est PAR DÉFENSE, pas pour le bloc entier**, et **une seule à la
  fois** : on note une composition, pas six. Les autres restent en **vignettes de
  lecture à côté**, ce qui permet de voir ce qu'on a déjà noté pendant qu'on
  ajoute.
- Celle en édition prend **toute la largeur** (`w-full` dans la rangée
  `flex-wrap`) : elle porte 3 sélecteurs et un champ de texte, que la mise en
  vignette écraserait. Une **bordure d'accent** dit laquelle est ouverte.
- ⚠️ **Chaque vignette porte son propre crayon**, sinon une défense posée
  deviendrait non modifiable. Discret (il n'apparaît qu'au survol, pour ne pas
  alourdir une rangée qu'on parcourt du regard) mais **toujours visible au
  tactile** — voir la règle « un élément atteignable ne dépend jamais du survol »
  de [../shared/design.md](../shared/design.md).
- ⚠️ **L'index en édition est remis à `null` si le nombre de défenses change** :
  une défense supprimée laisserait l'édition pointer sur sa voisine, ou dans le
  vide.
#### ⚠️ Une défense sans AUCUN monstre n'est pas conservée

L'entrée est bien **créée** au clic sur « + » — c'est le formulaire qu'on
remplit —, mais si on la referme sans avoir rien choisi, elle est **retirée** :
elle ne décrit aucune composition, ne se lit pas en vignette, et voyagerait telle
quelle dans l'export.

Refermer sans rien poser vaut donc « j'abandonne », pas « j'enregistre du vide ».
Les **quatre** sorties sont couvertes :

| Sortie | Ce qui se passe |
|--------|-----------------|
| **Terminer** (✓) | l'entrée vide est retirée |
| **Ouvrir une autre défense** | la précédente, restée vide, est retirée (l'index visé est décalé si elle était avant lui) |
| **Replier le deck** | le bloc est démonté → nettoyage au démontage, sinon l'entrée vide survivait |
| **Re-cliquer « + »** | aucune seconde entrée n'est créée tant que l'ouverte est vide — on réutilise celle qui est là |

- ⚠️ **La note seule ne suffit pas à la retenir** : une précision sans les
  portraits qu'elle qualifie (« si le Chloe est en lead ») ne veut rien dire. Ce
  sont les **3 monstres** qui font la défense.
- La même règle vaut déjà à l'**export** (`counterListToJson`) et à l'**import**
  (`jsonToCounter` renvoie `null`) : une défense vide n'est ni écrite, ni relue.
  Les trois chemins disent donc la même chose.
- ⚠️ Supprimer une défense la retire **pour de bon**, sans repli sur une entrée
  vide — contrairement aux decks, dont une recommandation garde toujours au
  moins un. **Zéro défense visée est l'état normal.**
- Le bloc vit **dans la partie dépliée du deck** : son état d'édition se
  réinitialise donc de lui-même au repli, sans rien à gérer.

## Propriétés d'artéfact recommandées

Un monstre porte **deux artéfacts** : celui d'**attribut** (lié à son élément) et
celui de **type** (lié à son archétype). Chacun a **4 emplacements** de propriété
secondaire — d'où **4 + 4 exigences possibles par monstre**
(`MAX_ARTIFACT_SUBS`).

`RecoSlot.artifacts` stocke des **codes** (`ARTIFACT_SUB` d'[effects.ts](src/lib/effects.ts)),
pas des libellés : c'est ce que porte l'export du compte, donc la confrontation
est exacte, et renommer un libellé ne casse pas les recommandations déjà
partagées.

### ⚠️ Aucune valeur minimale — la PRÉSENCE seule est exigée

Contrairement aux stats, une propriété d'artéfact ne porte **pas de seuil**. Ces
substats sont conditionnels (« dégâts sur le Feu », « VIT sous effet
d'incapacité ») : exiger un chiffre sur un effet qui ne s'applique qu'en
situation donnerait une fausse précision, alors que ce qui se joue en pratique
est **« as-tu la bonne ligne »**.

### ⚠️ Quelle propriété sur quelle sorte d'artéfact

Les codes com2us sont rangés par **plages**, et `artifactSubKinds` s'en sert :

| Plage | Sorte | Exemples |
|-------|-------|----------|
| 200–299 | les deux | vol de vie, dégâts de contre-attaque |
| 300–399 | **attribut** seul | dégâts sur le Feu, dégâts reçus de l'Eau |
| 400–499 | **type** seul | dmg crit Compétence 2, récupération Compétence 3 |

Vérifié sur les **2 120 artéfacts** d'un compte réel : aucune plage ne débordait.
Les propriétés impossibles ne sont **jamais proposées** dans la liste, et sont
**écartées à l'import** — exiger « Dégâts sur le Feu » sur un artéfact de type
donnerait un critère que rien ne pourrait jamais satisfaire.

### Choix — **par liste déroulante**, contrairement aux sets

Une quarantaine de propriétés, toutes textuelles, **aucune n'a de symbole dans le
jeu** : une grille d'icônes comme celle des sets serait un mur de texte. Un
`<select>` natif se filtre au clavier et se manipule au doigt.

- Une liste **par sorte d'artéfact**, avec son compteur `N/4`.
- Les propriétés **déjà exigées** disparaissent du menu ; à 4, le menu se
  désactive et annonce « Les 4 propriétés sont prises ».
- Le menu reste sur `value=""` : il sert à **ajouter**, il ne porte pas de
  sélection courante. Chaque exigence devient une **chip avec ×**.
- En lecture, le bloc **disparaît si rien n'est exigé** — la plupart des
  recommandations ne portent que sur les runes et les stats.
- Le bloc est **le dernier du slot**, sous la table de stats : c'est le critère
  le plus rarement renseigné, et la table reste ainsi à la même hauteur d'un slot
  à l'autre.

> L'ordre d'AFFICHAGE (sets → stats → artéfacts) est celui de la lecture ;
> l'ordre des **causes de rejet** (sets → artéfacts → stats) est celui du geste à
> faire. Les deux n'ont pas à coïncider.

### Confrontation

`artifactChecksFor` ([recoMatch.ts](src/lib/recoMatch.ts)) compare les codes
exigés aux `subs` de l'artéfact **de la même sorte** dans le build retenu.

⚠️ **Artéfact absent = propriété absente.** Un monstre sans artéfact de type ne
satisfait aucune exigence de type ; le traiter comme « rien à vérifier » l'aurait
fait passer pour conforme.

Les propriétés satisfaites comptent aussi dans le **départage entre équipes
candidates** : les ignorer ferait retenir une équipe moins bonne quand seuls les
artéfacts les séparent.

## Persistance

`localStorage` `sw-forge-siege-recos-v1` — contrairement à la box (en mémoire),
ce sont des données **créées par l'utilisateur ou reçues d'un ami** : elles
survivent au reload. Effacées par « Supprimer mes données » (préfixe `sw-forge`).

## Partage — un seul format : le JSON

Tout vit dans [recoShare.ts](src/lib/recoShare.ts). **100 % local**, aucun envoi
réseau.

⚠️ **Le JSON est le SEUL format**, à l'export comme à l'import. Un code compact
base64 (`SWF-RECO-1:`) a coexisté un temps ; il a été **retiré** — deux formats
pour la même chose, c'est deux fois plus de surface à valider, pour un contenu
que personne ne peut relire ni corriger.

### Fichier JSON (`format: "sw-forge/recommandations"`, `version: 5`)

```json
{ "format": "sw-forge/recommandations", "version": 5, "exporte_le": "…",
  "recommandations": [
    { "nom": "…", "auteur": "…", "consignes": "…",
      "decks": [ { "nom": "Def 1", "consignes": "…",
        "fort_contre": [ { "monstres": [ { "com2usId": 19315, "nom": "Chloe" }, null, null ],
                           "note": "si le Chloe est en lead" } ],
        "monstres": [ { "com2usId": 15214, "nom": "Trevor",
                        "sets": [["violent","will"]],
                        "artefacts": {
                          "attribut": [ { "code": 300, "propriete": "Dégâts sur le Feu +X%" } ],
                          "type":     [ { "code": 401, "propriete": "Dmg crit Compétence 2 +X%" } ] },
                        "stats": { "spd": 212 } }, null, null ] } ] } ] }
```

Clés **en français** comme l'interface ; les clés **anglaises du modèle**
(`name`, `note`, `slots`…) sont aussi acceptées en lecture.

⚠️ **Chaque propriété d'artéfact porte son code ET son libellé.** Le code seul
(`300`) ne se relit pas, or le fichier est censé s'ouvrir et se corriger à la
main. **Seul le code est lu** à l'import : un libellé modifié à la main est
ignoré, il ne fait pas foi. Le code nu (`[300, 301]`) reste accepté en lecture.

Les sortes d'artéfact **vides sont omises** : un monstre qui n'exige rien ne
traîne pas deux listes vides dans le fichier.

**Export** : le JSON est **téléchargé en `.json`**. Rien d'autre — pas de copie au
presse-papier.

**Versions du format** (`JSON_VERSION`) :

| Version | Changement |
|---------|-----------|
| 5 | `fort_contre` : **défenses adverses** qu'un deck bat (3 monstres + précision) |
| 4 | `artefacts` : **propriétés secondaires d'artéfact exigées** (attribut / type) |
| 3 | `sets` d'un monstre devient une **liste de possibilités** (`[["violent","nemesis"],["violent","revenge"]]`) |
| 2 | JSON lisible, clés en français |

⚠️ **Rétrocompatibilité garantie en lecture** : un `sets` qui est une simple
liste de clés (v1/v2) est repris comme **possibilité unique**, un monstre sans
clé `artefacts` (≤ v3) n'exige rien, et un deck sans `fort_contre` (≤ v4) ne vise
aucune défense — sans perte. Mais l'import **le signale** — « Fichier au format
v4 (actuel : v5) […] réexporte-le pour le mettre à jour » — sinon un fichier
ancien circule indéfiniment dans la guilde et personne ne sait qu'un format plus
riche existe.

**Import** : **fichier `.json` uniquement**. ⚠️ **Pas de zone de collage** : une
recommandation se transmet comme une pièce jointe, et un champ de texte libre
n'apportait qu'une seconde voie à valider, à expliquer et à maintenir. Un contenu
qui ne commence pas par `{` est refusé avec un message explicite, plutôt qu'une
erreur de parseur incompréhensible.

La **migration `localStorage`** reste en place : un enregistrement à l'ancienne
forme (`reco.slots`, du temps où une reco = un deck) est relu comme une
recommandation à un deck.

## Validation à l'import

`validateRecosImport(text)` renvoie un **rapport** — le contenu vient d'un tiers,
on ne lui fait pas confiance et **on ne corrige pas en silence** :

```ts
interface ImportReport {
  recos: Omit<Reco,'id'>[] | null;   // null = rien n'est importé
  source: 'json' | 'code' | null;
  errors: string[];                  // bloquants
  warnings: string[];                // corrections appliquées
  counts: { recos: number; decks: number; monstres: number };
}
```

**Erreurs bloquantes** (rien n'est importé) : JSON syntaxiquement invalide (le
message du parseur est repris), clé `recommandations` absente, liste vide, aucune
recommandation exploitable, contenu vide ou non reconnu.

**Corrections signalées** (l'import a lieu) : stat inconnue ou valeur ≤ 0, set
inconnu, set qui ferait **dépasser 6 runes**, `com2usId` invalide, deck de plus de
3 monstres, consignes tronquées, deck sans monstre ignoré, recommandation sans
deck ignorée, `format` déclaré différent, ancien format converti. Chaque message
est **localisé** : `« Defs G3 », deck 1 « D1 », monstre 2 : stat inconnue « zzz »
ignorée.` Les doublons sont dédupliqués (une même correction sur 50 decks
n'apparaît qu'une fois).

Un contrôle supplémentaire est fait côté board (il connaît le bestiaire) :
les `com2usId` **absents des données chargées** sont signalés — ces monstres
s'affichent sans portrait et ne sont pas confrontés.

**Rendu** : encart sous la zone d'import, **rouge** si bloquant / **orange** si
corrections, avec la liste des messages (défilante) et le récapitulatif de ce qui
a été retenu. Contrairement au message de succès, il **n'est pas éphémère** — il
y a quelque chose à lire — et se ferme par une croix.

- **Exporter** (icône **Upload ↑**) : une recommandation **avec tous ses decks**,
  **ou** « Tout exporter ». Produit le **fichier `.json`**. Une recommandation
  dont **aucun deck** n'a de monstre n'est pas exportable ; le message récapitule
  « N recommandation(s) · M deck(s) ».
  - ⚠️ **Se confirme, malgré l'absence de perte locale.** Rien ne disparaît sur
    l'appareil — mais c'est un geste vers l'EXTÉRIEUR : un fichier écrit sur le
    disque, prêt à être partagé. La modale dit CE QUI VA SORTIR (combien de
    recommandations, combien de decks) **avant** que ça parte, plutôt qu'un
    message après coup qu'on ne lit qu'une fois le fichier déjà sur le disque.
    Ton **neutre**, pas `destructif` : ce n'est pas la même nature de geste
    qu'un effacement, même si les deux se confirment.
- **Importer** (icône **Download ↓**) : ouvre **directement le sélecteur de
  fichier** `.json` — pas d'écran intermédiaire, pas de zone de collage. Le
  contenu passe par le validateur (voir ci-dessous) ; espaces et retours ligne
  autour du JSON tolérés.
- ⚠️ **Un import AJOUTE toujours à la suite. Il ne remplace jamais.**
  - Aucune option, aucune confirmation : l'import ne peut pas détruire de
    données, donc il n'a rien à demander.
  - Les recommandations sont du **contenu créé à la main**, non re-dérivable d'un
    export de compte : un import ne doit pas pouvoir les effacer.
  - Pour repartir de zéro, **« Tout effacer »** existe — geste explicite, séparé,
    avec confirmation.
  - **Historique à ne pas répéter** : une confirmation posait
    `OK = remplacer · Annuler = ajouter`. Sur un import, le réflexe est de
    cliquer OK — des recommandations ont été **définitivement perdues**. Un
    une confirmation sert à confirmer une intention déjà exprimée, **jamais** à choisir
    entre deux options dont l'une détruit.
- Message de succès **éphémère** (~5 s) ; le **rapport de validation** reste
  affiché jusqu'à fermeture.

> Convention d'icônes, identique à la comparaison de courbes de runes :
> **Exporter = Upload ↑**, **Importer = Download ↓**.

## Confrontation avec mon compte — bouton « Analyser mes decks »

Calcul pur dans [recoMatch.ts](src/lib/recoMatch.ts) → stats réelles via
`computeStats` ([stats.ts](src/lib/stats.ts)).

### À la demande, pas en continu

⚠️ **Rien n'est confronté par défaut.** Une carte non analysée est neutre : pas
d'aura, pas de pastille, pas de badge sur les monstres. L'analyse se lance **par
recommandation**, via le bouton **« Analyser mes decks »** de son en-tête (il
devient « Réanalyser mes decks » ensuite) — le libellé dit bien que la
confrontation porte sur **l'ensemble des decks**, pas sur un seul.

⚠️ **À la SOURIS seulement** (`compact:hidden`), étiqueté, à côté du titre — la
place ne manque pas. Au doigt, il n'est plus sur la carte du tout : il vivait en
icône dans le coin supérieur droit, groupée avec Exporter / Éditer / Supprimer,
mais choisir SA carte demandait d'abord d'y faire défiler — un geste que le
panneau « Options » fait maintenant sans quitter le haut de l'écran (voir plus
bas). Une icône de plus dans un coin déjà chargé pour un geste qui a un meilleur
endroit ne se justifiait plus.

- Le bouton est **désactivé sans compte importé** (rien à quoi comparer).
- Le résultat est **mémorisé dans le board** avec la reco et les builds qui ont
  servi ; il devient **périmé** dès que l'un des deux change (comparaison par
  **identité d'objet** : toute édition recrée les objets). La carte repasse alors
  à l'état non analysé et le bouton réaffiche « Analyser ».
- Motivation : confronter *toutes* les recos à *tous* les builds à chaque rendu
  était un coût permanent pour une information qu'on ne consulte que ponctuellement.

### Analyser depuis le panneau « Options » — LE chemin au doigt

⚠️ Au doigt, analyser n'est plus un bouton sur la carte : c'est le panneau
« Options » qui porte le geste, avec un menu déroulant qui choisit **laquelle**
analyser (aucune carte n'est sous les yeux pour le dire), puis « Analyser » qui
fait le reste.

- Le menu liste les recommandations **affichées** (`list` — filtre d'origine et
  recherche déjà appliqués), avec le même nom de repli
  (« Recommandation N ») que sur les cartes.
- **Désactivé sans compte importé**, même condition que le bouton de la souris.
- Au clic sur « Analyser » : l'analyse se lance, la carte visée **s'ouvre**
  (elle serait sinon repliée et le résultat invisible au premier défilement),
  le panneau se referme, et un message éphémère confirme sur quelle
  recommandation.

### Ce que l'analyse affiche

Un **encart de synthèse** sous l'en-tête, visible **même recommandation repliée** :

- bandeau vert « Tout est respecté : les N deck(s) sont jouables » si tout passe,
  orange « N/M deck(s) au niveau · K à corriger » sinon ;
- puis **la liste de TOUS les decks analysés**, chacun avec son verdict, sa
  réserve (« réalisable N fois ») et, s'il y a lieu, le détail par monstre :
  - `Def 1` · **jouable · Offense 3** (vert)
  - `Trevor - Bella - Tarq` · **aucun deck avec ces monstres — tu peux le composer**
    (pas de détail : sans équipe, il n'y a aucun build à confronter)
  - `Def 2` · **monstre indisponible — deck impossible** → `Tarq — monstre indisponible`
  - `Def 3` · **runage, artéfacts et stats à revoir** →
    `Bella — set Violent manquant · artéfact d'attribut : Dégâts sur l'Eau +X% absent · VIT 117 au lieu de 212`
- aucun deck rempli → « Rien à analyser ».

#### Ordre de la liste — ⚠️ ROUGE → ORANGE → VERT

Du plus urgent au plus tranquille : **monstre manquant**, **à revoir**, **à
composer**, puis les **bons**. Ce qui demande du travail se lit en premier ; les
decks déjà jouables closent la liste au lieu de la précéder — sinon il faut les
dépasser pour atteindre ce sur quoi on peut agir.

- Des deux rouges, **`missing` passe devant `ko`** : rien de ce qu'on possède ne
  répare un monstre absent, alors qu'un « à revoir » se corrige le soir même
  avec les runes qu'on a déjà.

- ⚠️ **Tri STABLE sur le seul verdict** : à verdict égal, les decks gardent
  l'ordre de la recommandation, qui est celui de son auteur. Trier aussi à
  l'intérieur d'une famille les mélangerait sans que rien à l'écran ne dise
  pourquoi.
- ⚠️ **L'ordre des PASTILLES est l'inverse** (Bon · À composer · À revoir), et
  c'est voulu : une légende ordonne des catégories du meilleur au pire, une
  liste hiérarchise l'urgence. Deux objets, deux logiques.

#### ⚠️ Chaque ligne mène à SON deck

La ligne entière est un **bouton** : le résumé dit ce qui cloche, et le geste
suivant est toujours d'aller voir le deck. Sans ce lien, il fallait déplier la
carte, retrouver le deck à l'œil parmi six, puis l'ouvrir — alors que la ligne le
désigne déjà.

Un clic **déplie la carte si elle est repliée** (le résumé reste visible carte
fermée — c'est tout son intérêt —, donc on clique souvent depuis une carte où le
deck n'est même pas rendu), **déplie le deck visé**, puis y **fait défiler**
(`scrollIntoView`, `block: 'center'`).

- ⚠️ Le défilement attend **une frame** (`requestAnimationFrame`) : la carte et
  le deck viennent peut-être d'être dépliés dans la même passe, et leur hauteur
  n'est pas encore posée — viser tout de suite calerait sur une position périmée.
- ⚠️ Pendant une **recherche**, seuls les decks trouvés sont rendus : un deck
  masqué n'a **aucune ref**. On ne fait alors rien plutôt que de sauter au
  hasard — le deck est bien déplié et réapparaîtra à sa place dès la recherche
  effacée.
- ⚠️ Le **détail par monstre reste HORS du bouton** : c'est du texte qu'on lit et
  qu'on veut pouvoir sélectionner, pas une cible de clic.

#### ⚠️ Les decks au niveau sont LISTÉS, pas seulement comptés

Seuls les decks fautifs apparaissaient ; les bons se résumaient à un « 4/6 au
niveau ». Or « **lesquels** puis-je poser » est exactement la question qu'on se
pose devant une défense de guilde à remplir — il fallait rouvrir la carte et
parcourir les decks pour y répondre.

- Un deck bon annonce **l'équipe qui le rend jouable** (« jouable · Offense 3 »),
  pas un simple « ok » : c'est elle qu'on va chercher en jeu.
- Le **détail par monstre reste réservé aux decks `ko`** : sur un deck au niveau
  il n'y a rien à corriger, et `nodeck` n'a aucun build à confronter.

#### Filtres de verdict — Bon · À composer · À revoir · Monstre manquant

**Quatre pastilles** sous le bandeau, une par statut réel, avec l'effectif de
chacune :

| Pastille | Couleur | Statut | Point |
|----------|---------|--------|-------|
| **Bon** | vert | `ok` | plein |
| **À composer** | orange | `nodeck` | plein |
| **À revoir** | rouge | `ko` | plein |
| **Monstre manquant** | rouge | `missing` | **creux** |

- ⚠️ **Le rouge est SCINDÉ en deux** — il ne l'était pas au départ. « À revoir »
  et « monstre manquant » partagent la couleur mais **pas le geste** : l'un se
  répare en rerunant ce qu'on possède déjà, l'autre demande d'invoquer et de
  monter un monstre qu'on n'a pas. Ce n'est ni le même horizon, ni la même
  décision. Fondus, il fallait parcourir toute la liste rouge pour trier à l'œil
  ce sur quoi on pouvait agir le soir même.
- ⚠️ **Deux filtres, un seul rouge.** Les deux gardent la couleur `fire` : ils
  sont bloquants tous les deux, et c'est ce que la couleur dit. On n'introduit
  pas une cinquième couleur qui mentirait sur la gravité.
- ⚠️ **Le point de « Monstre manquant » est CREUX.** Deux pastilles de la même
  couleur côte à côte ne se distinguent plus que par leur texte, qu'on ne relit
  pas une fois la barre connue. Le creux dit « il manque quelque chose ». Il est
  porté aussi par la **ligne** correspondante de la liste, qui reprend donc le
  point du **verdict** et non `DOT[status]` — `DOT` reste la table de l'aperçu
  replié, où le vocabulaire à trois couleurs suffit.
- Le **détail par monstre** est affiché sur **les deux verdicts rouges** : « à
  revoir » dit quoi corriger, « monstre manquant » dit **lequel** manque — sans
  quoi on saurait le deck bloqué sans savoir par qui.
- ⚠️ **Cumulables** : on peut isoler vert **et** rouge à la fois. D'où des
  **pastilles indépendantes** et non un `Segmented`, dont le cadre commun dirait
  que les choix s'excluent.
- ⚠️ **Rien de coché = tout est montré.** Un écran de filtres tous éteints
  n'affichant rien se lirait comme une analyse vide. Cocher **restreint** ; un
  lien « Tout afficher » rétablit dès qu'un filtre est posé.
- Un verdict **sans aucun deck** est **grisé, jamais retiré** : on voit qu'il n'y
  en a aucun au lieu de chercher un bouton disparu. Même règle que les pastilles
  d'attribut de l'inventaire d'artéfacts.
- Le marqueur d'actif est la **bordure** (règle des pastilles de filtre, voir
  [../shared/design.md](../shared/design.md)).
- État **local à l'encart** : il vit et meurt avec le résultat d'analyse.

Une fois analysée, la carte reprend tout le langage visuel décrit plus bas (aura,
pastille, badges de deck et de monstre, comparaison stat par stat).

#### Combien de fois le deck est montable — « réalisable N fois »

Chaque deck analysé affiche combien de fois il peut être monté **en parallèle**
avec la réserve du joueur (`deckCopies` dans
[recoMatch.ts](src/lib/recoMatch.ts)). C'est ce qui dit si on peut poser le même
deck sur plusieurs défenses de guilde.

**Affiché à deux endroits** : dans l'en-tête du deck, et sur **chaque ligne du
résumé d'analyse** — c'est là qu'on arbitre entre six défenses de guilde à
remplir, et un deck jouable une seule fois n'en couvre qu'une. Sur **tous les
verdicts**, pas seulement les bons : savoir qu'un deck à revoir n'existe de toute
façon qu'en un exemplaire change ce qu'on décide d'aller corriger.

- ⚠️ **Les 6★ UNIQUEMENT**, et depuis la **box seule**
  (`countCopiesByCom2us` dans [ownedBuilds.ts](src/lib/ownedBuilds.ts)) :
  - `collectOwnedBuilds` **agrège les presets** (RTA, défense, offense) : un
    même monstre y figure une fois par contexte. Compter dessus multiplierait
    les exemplaires par le nombre d'usages ;
  - la box ne retient que `class === 6` (voir
    [../shared/import-compte.md](../shared/import-compte.md)), et chaque entrée
    est un `unit_id` distinct — donc une unité réelle. Un monstre en réserve à
    5★ ne se joue pas tel quel en siège.
- ⚠️ Le deck est limité par son **monstre le plus rare** (`min`, jamais une
  moyenne) : trois exemplaires de l'un ne servent à rien si le second n'existe
  qu'en un seul.
- ⚠️ Un monstre placé **deux fois dans le même deck** consomme **deux**
  exemplaires : les occurrences sont comptées avant division.
- ⚠️ **Rien n'est affiché** faute de compte importé ou sur un deck vide — un
  « 0 fois » affirmerait que le deck est immontable, ce qui est tout autre chose
  que « je ne sais pas ». **Zéro se dit en revanche**, et **en rouge** : c'est
  l'information la plus utile de la pastille.
- La pastille est **distincte du badge de statut** : ce n'est pas un verdict sur
  le deck mais une information de **stock**. Les fondre ferait lire
  « jouable ×2 » comme un degré de conformité.

**Fermer le résultat** : une **croix**, sur l'**encart de synthèse** (ses trois
états : vert, orange, « rien à analyser »), efface l'analyse et la carte
**redevient neutre** — halo, encart et badges disparaissent d'un coup. Utile
quand tout est vert : l'information a été lue, le halo n'a plus rien à dire. Il
suffit de relancer « Analyser mes decks » pour la revoir.

⚠️ **Pas de pastille en-tête redondante.** L'en-tête portait une seconde
pastille (« 1/4 decks au niveau »), avec sa propre croix — reprenant, un cran
plus haut, exactement ce que dit déjà l'encart de synthèse juste en dessous,
lui-même visible carte repliée (voir plus haut). Deux endroits pour la même
phrase, sur une carte déjà chargée, sans qu'aucun n'apprenne quoi que ce soit
que l'autre ne dise pas.

### ⚠️ Source : TOUS les builds, pas seulement la box

Dans SW, un monstre a **un preset de runes par contexte**. La box ne contient que
l'**équipement actuellement porté** : s'y limiter faisait échouer la confrontation
d'un deck… que le joueur possède exactement tel quel en siège (symptômes observés :
« monstre non trouvé » et « à améliorer » juste après avoir importé son propre deck
d'offense).

`collectOwnedBuilds` ([ownedBuilds.ts](src/lib/ownedBuilds.ts)) rassemble donc
**tous les builds connus**, assemblés dans [App.tsx](src/App.tsx) :

| Source | Origine | Libellé affiché |
|--------|---------|-----------------|
| `box` | équipement porté (`BoxItem.gear`) | « Box » |
| `rta` | preset RTA (`RtaEntry.gear`) | « RTA » |
| `defense` | presets des équipes de défense | « Défense N » |
| `offense` | presets des équipes d'attaque | « Offense N » |

Conséquences :
- un monstre **présent dans un deck est possédé**, même s'il n'est pas dans la
  box 6★ → plus de faux « non possédé » ;
- la comparaison se fait sur le **meilleur build disponible**, pas sur celui qui
  se trouve être équipé au moment de l'export.

- **Plusieurs builds** pour un même monstre (exemplaires multiples × presets) :
  on retient le **meilleur** — celui qui satisfait le plus de critères (**stats
  atteintes + sets portés**, à poids égal), départagé par le **pire ratio
  atteint/exigé** le moins mauvais (le plus proche du build demandé). Ex. une
  reco Swift+Focus choisira le preset runé Swift, pas celui runé Violent.
- Le **build retenu est affiché** sous le monstre (« au niveau · Offense 3 »).
- Statut **par slot** :

| Statut | Sens | Rendu |
|--------|------|-------|
| `empty` | pas de monstre dans la reco | neutre |
| `absent` | **aucun build connu** pour ce monstre | bordure rouge, « monstre non trouvé » |
| `ko` | possédé mais ≥ 1 stat sous le minimum **ou** ≥ 1 set manquant | bordure orange, « à améliorer » |
| `ok` | possédé, **toutes** les stats atteintes **et** tous les sets portés | bordure verte, « au niveau » |

### Trois questions, dans cet ordre

L'analyse d'un deck répond à : **ai-je un deck ? est-il correct ? sinon, puis-je
le faire ?**

1. **Ai-je les monstres ?** Non → `missing` : le deck est **impossible**.
2. **Ai-je une équipe existante qui les réunit** (défense ou offense) ? Non →
   `nodeck` : tu as les monstres, **il reste à composer l'équipe**.
3. **Dans cette équipe, les stats/sets suivent-ils ?** Non → `ko`.

Le point 2 est la nuance qui compte : posséder les monstres ne veut pas dire
avoir le deck. `OwnedTeam` ([ownedBuilds.ts](src/lib/ownedBuilds.ts)) recense les
**équipes réellement composées** ; une équipe « correspond » si elle contient
**tous** les monstres du deck recommandé. À plusieurs candidates, on retient
celle qui satisfait le plus de critères. Les stats sont alors comparées **au
build de cette équipe-là**, pas au meilleur build tous contextes confondus.

| Statut | Couleur | Condition | Badge |
|--------|---------|-----------|-------|
| `missing` | `fire` | au moins un monstre **non possédé** | « monstre indisponible — deck impossible » |
| `ko` | `fire` | l'équipe existe mais **stats/sets insuffisants** | selon la cause, voir ci-dessous |
| `nodeck` | `amber` | monstres possédés, **aucune équipe ne les réunit** | « aucun deck avec ces monstres — à composer » |
| `ok` | `emerald` | l'équipe existe et tout est au niveau | « jouable · Offense 3 » |
| `unknown` | neutre | deck **vide** | — |

Statut **par slot** : `absent` (rouge, « monstre indisponible ») · `ko` (rouge,
libellé selon la cause) · `ok` (vert, « au niveau ») · `unknown` (neutre,
« possédé » — rien à confronter faute d'équipe) · `empty` (slot vide).

### ⚠️ Un `ko` dit LAQUELLE des causes

`slotFaults` / `deckFaults` ([recoMatch.ts](src/lib/recoMatch.ts)) séparent trois
défauts qui ne se réparent pas du tout pareil :

| Cause | Ce qui cloche | Badge du slot | Nom côté deck |
|-------|---------------|---------------|---------------|
| `sets` | pas le **runage demandé** → à reruner | « mauvais set de runes » | runage |
| `artifacts` | pas les **propriétés d'artéfact** demandées → à changer d'artéfact | « mauvaise statistique » | artéfacts |
| `stats` | le reste est bon, les **minimums** ne sont pas atteints → à améliorer | « stats insuffisantes » | stats |

Tout afficher sous « stats insuffisantes » envoyait le joueur optimiser des
sous-stats alors que le set lui-même n'était pas le bon — et, symétriquement, un
monstre bien runé mais trop lent se lisait comme un problème de runage.

⚠️ **Une LISTE de causes, pas une cause unique.** Les trois peuvent coexister ;
n'en annoncer qu'une masquerait le reste du travail. Le slot les joint par
` · ` ; le **deck** prend l'union de celles de ses slots.

⚠️ Côté deck, la formule est **« … à revoir »** et non « … non respectés » :
elle est **invariable**, donc elle se combine sans accord — « runage et stats à
revoir », « runage, artéfacts et stats à revoir » se construisent tout seuls quel
que soit le nombre de causes.

L'ordre est celui du **geste à faire** — runage, artéfacts, puis stats : reruner
change les stats, l'inverse n'est pas vrai. Même ordre dans le détail par
monstre.

**Mise en évidence** : dans un slot `ko`, les **lignes de stats non respectées**
sont surlignées (fond rouge léger, libellé rouge) — on voit ce qui bloque sans
lire les chiffres. Le slot fautif prend une bordure rouge, comme un slot dont le
monstre est indisponible : les deux sont bloquants.

- Statut **de la recommandation** (`matchReco`) = **agrégat de ses decks non
  vides**, aura de la carte SEULE (voir `AURA` dans RecoCard.tsx) — le résumé en
  mots ne vit plus qu'à l'encart de synthèse, voir plus haut :

| Statut | Couleur | Condition |
|--------|---------|-----------|
| `ok` | `emerald` | **tous** les decks jouables |
| `partial` | `amber` | une partie seulement |
| `missing` | `fire` | **aucun** deck jouable, tous bloqués par un monstre manquant |
| `unknown` | neutre | **pas encore analysée**, ou aucun deck rempli |

- Sans compte importé : bouton « Analyser » **désactivé**, cartes neutres. Les
  recommandations restent consultables, éditables et exportables.
- Par stat, la vue affiche `minimum` puis **ta valeur** : verte avec ✓ si
  atteinte, rouge avec l'écart `(−X)` sinon.
- Par set, une puce **icône + ×2/×4** : verte avec ✓ si le set est porté, rouge
  avec ✗ sinon. Un set demandé 2× mais actif 1× → la **seconde** puce est rouge.

## Interactions

### Repliée par défaut — bouton « Consulter »

Une recommandation contenant plusieurs decks de 3 monstres, la liste serait
illisible tout déplié. Chaque carte est donc **repliée par défaut** :

- **Repliée** : l'en-tête (nom, puce « Importée », nombre de decks, auteur)
  **+ un aperçu d'une ligne** — une puce par deck avec son
  **nom** et un **point de couleur** (vert/orange/rouge/neutre) reprenant son
  statut, plus un repère « consignes » si la recommandation en porte. On voit
  donc quoi ouvrir **sans rien déplier**. Cliquer l'aperçu déplie aussi.
- **Bouton « Consulter »** (chevron) dans l'en-tête → déplie et affiche les
  consignes générales puis tous les decks ; devient **« Réduire »**.
  ⚠️ **À la SOURIS seulement.** Au doigt, ce petit bouton du coin devenait une
  seconde cible pour le même geste que le titre — sur un écran qu'on parcourt
  au pouce, la plus petite des deux. À la souris, viser un bouton précis ne
  coûte rien, et le chevron confirme l'état d'un coup d'œil.
- **Le TITRE bascule aussi la carte** — même geste que « Consulter », pas un
  second, et le SEUL au doigt. Masqué en édition, comme « Consulter » : le
  titre devient alors le champ de saisie du nom.
- **Plusieurs recommandations peuvent être dépliées** en même temps (état local
  au board, non persisté).
- **Éditer implique déplier** : une carte en édition (recommandation **ou** l'un
  de ses decks) est toujours affichée en entier
  (`expanded = open || editing || editingDeck !== null`) — le bouton
  « Consulter » est donc **masqué en édition** (il n'aurait aucun effet).

### Repli deck par deck

Indépendamment du repli de la carte, **chaque deck a son propre chevron**.

- ⚠️ **Les decks sont repliés par défaut** : déplier une recommandation montre la
  **liste de ses decks**, pas leur contenu. On ouvre ensuite celui qui intéresse.
  Sans ça, une reco de 6 decks déroulait tout l'écran d'un coup.
- **Lead du leader** : affiché **sur le monstre** en slot 0, comme en siège et
  avec les mêmes composants ([LeadPill.tsx](src/components/siege/LeadPill.tsx)) —
  `LeadBadge` sur son portrait dans l'aperçu replié, `LeadPill` (icône +
  montant) sous son nom dans le deck déplié. **Pas** dans l'en-tête du deck :
  on doit voir de quel monstre vient le lead. Voir [equipes.md](equipes.md).
- **Deck replié** : chevron + nom (cliquable) + **les 3 monstres en icônes**
  (portrait hexagonal + badge d'élément, **sans nom**) pour s'y retrouver d'un
  coup d'œil, + le badge de statut et le bouton **Éditer**.
- **« Déplier / Replier tous les decks »** : lien en haut à droite de la liste,
  affiché dès **2 decks**.
- Un deck **en édition est toujours déplié**, quel que soit son état de repli.
- État **local à la carte** (`openDecks` = les decks ouverts), réinitialisé quand
  le **nombre de decks change** (les index se décalent à l'ajout/suppression).
  Replier puis rouvrir la recommandation **conserve** les decks qu'on avait
  ouverts.

- **Créer une recommandation** → carte ajoutée en fin de liste **avec un deck
  vide**, **ouverte en édition** (recommandation **et** son deck), et **scroll
  automatique** jusqu'à elle (comme « Ajouter une équipe », voir
  [README.md](README.md)).
### Trois niveaux d'édition, séparés

| Bouton | Où | Ce qu'il ouvre |
|--------|----|----------------|
| ✏️ (en-tête de la carte) | recommandation | **nom, auteur, consignes générales** + **Ajouter un deck vide** / **Importer un deck d'offense** |
| ✏️ (en-tête de chaque deck) | deck | **nom du deck, ses consignes, ses monstres, sets, artéfacts et stats** + 🗑 **Supprimer ce deck** |
| **+ Défense** / ✏️ sur une vignette | défenses visées | **une** défense que ce deck bat — indépendant du deck |

⚠️ Le troisième est **volontairement détaché** du deuxième : ajouter une défense
qu'on vient d'affronter est un geste **de passage**, éditer les stats d'un deck
est un **travail de fond**. Il n'a d'ailleurs **pas de mode édition de bloc** —
juste un « + » qui ajoute et ouvre l'entrée créée. Voir « Défenses visées » plus
haut.

#### ⚠️ Le titre et les icônes d'action partagent LEUR PROPRE rangée

L'en-tête est **trois zones empilées**, pas deux côte à côte :

| Rangée | Contenu | Comportement |
|--------|---------|--------------|
| 1 — titre + actions | titre (cliquable, bascule la carte, tronqué s'il déborde) et, sur la MÊME ligne : « Consulter » (souris seulement), Exporter ↑, Éditer ✏️, Supprimer 🗑 | `items-center`, une seule ligne |
| 2 — métadonnées | puce « Importée », compteur de decks, auteur, « Analyser mes decks » (souris seulement) | passe à la ligne librement, sous la rangée 1 |

⚠️ **Historique : deux zones côte à côte (titre+badges à gauche, icônes à
droite), essayé et défait deux fois.**
- `items-start` : correct tant que le titre est seul sur sa ligne, mais la
  zone de gauche passe couramment sur DEUX lignes dès que le nom n'est pas très
  court (badges qui débordent en dessous) — pas un cas rare, le cas courant sur
  une carte de largeur mobile.
- `items-center` sur ce même agencement à deux zones plaçait alors les icônes
  **entre** les deux lignes de gauche : ni alignées sur le titre, ni sur les
  badges — pire que l'écart qu'on corrigeait.

Le problème n'était pas l'alignement CSS mais la STRUCTURE : titre et badges
n'ont aucune raison de partager une hauteur commune avec les icônes, ce sont
deux informations différentes. Les séparer en deux rangées résout tout d'un
coup — la rangée 1 ne contient plus QUE le titre et les icônes, qui peuvent
alors se centrer l'un sur l'autre sans qu'un troisième élément interfère.

⚠️ Le titre porte `leading-none` (sa boîte de ligne, interligne 1,6 de
l'échelle, dépassait sinon la hauteur des icônes) et `p-0` explicite (un
`<button>` a un rembourrage par défaut du navigateur, invisible à l'œil mais
qui élargit sa boîte au-delà du texte).

⚠️ **Icônes en 24 px (`h-6 w-6`), pas 20**, pour respirer un peu plus, sans
perdre l'exemption tactile (`taille="serre"` garde `data-cible-fine`, donc les
40 px de la règle au doigt ne s'appliquent pas). L'override passe par
`className`, et ça tient parce que `h-6` est PLUS LOIN que le `h-5` du
composant dans la feuille de style construite (Tailwind range ses valeurs par
ordre croissant) — vérifié dans le CSS, pas supposé.

Dans un `flex-wrap` unique (l'agencement d'avant tout ça), les trois icônes
suivaient le flux et **retombaient sous le titre** dès que la ligne était
pleine — leur position changeait d'une carte à l'autre selon la longueur du
nom, et il fallait les chercher des yeux à chaque fois. Une barre d'outils se
trouve à un endroit fixe, ou elle n'en est pas une.

**Icônes nues partout** dans les en-têtes — carrés de 24 px, **sans cadre ni
fond**, groupés et resserrés (`gap-0.5`) à droite de la ligne :

- **recommandation** : Exporter ↑, Éditer ✏️, Supprimer 🗑 — la ligne porte déjà
  le titre, la puce « Importée », le compteur de decks, l'auteur, et
  « Analyser mes decks » / « Consulter » à la souris. Analyser vit au doigt
  dans le panneau « Options » (voir plus haut), pas dans ce groupe.
- **deck** : Éditer ✏️, puis Supprimer 🗑 (visible seulement en édition).
- Le sens passe par l'**infobulle** et l'`aria-label` (obligatoire : une icône
  seule n'est pas lisible au lecteur d'écran).
- Faute de cadre pour marquer l'état actif, l'**édition en cours** se lit à
  l'icône qui devient un **✓ doré** (`text-star`) + `aria-pressed`.
- Les libellés ne sont conservés que là où la place ne manque pas : « Analyser
  mes decks », « Consulter », et les actions de la barre du haut.

- Éditer la recommandation **ne rend pas les decks modifiables** : les deux
  portées sont indépendantes, on ne touche pas au contenu d'un deck en corrigeant
  un titre.
- **Un seul deck en édition à la fois** (et une seule recommandation) : on
  travaille sur un deck, pas sur six.
- **« Terminer » sur la recommandation termine aussi l'édition de ses decks** :
  un seul geste referme tout, on ne laisse pas un deck en édition derrière soi.
  Vaut également quand le board bascule l'édition vers **une autre**
  recommandation (implémenté par effet sur `editing`, pas dans le `onClick`).
- Un deck **en édition est toujours déplié**, même s'il était replié.
- Le bouton d'édition d'un deck est accessible **dès que la carte est dépliée**,
  sans passer par l'édition de la recommandation.
- **Raccourcis** : créer une recommandation ouvre directement son deck vide en
  édition ; ajouter/importer un deck ouvre le nouveau deck en édition.
- La suppression d'un deck demande une **confirmation**.
- **Disposition** : les recommandations sont **empilées en pleine largeur** (une
  par ligne) — elles contiennent plusieurs decks de 3 monstres, une mise en
  2 colonnes serait illisible. À l'intérieur, les decks sont empilés et chaque
  deck affiche ses 3 slots en ligne (1 colonne sous `sm`).
- **Supprimer** une recommandation (avec confirmation) · **Tout effacer**.

## Partir d'une équipe d'offense existante

Écrire un deck à la main est fastidieux : en édition, le bouton **« Importer un
deck d'offense »** (avec le nombre d'équipes disponibles) liste les **équipes
d'attaque de siège** du joueur ; en choisir une **ajoute un deck pré-rempli**.

Conversion — [recoFromSiege.ts](src/lib/recoFromSiege.ts), calcul pur :

| Élément | Source | Règle |
|---------|--------|-------|
| Monstres | `SiegeSlot.monsterId` → `Monster` | mêmes positions (slot 0 = leader) |
| Sets | `SiegeSlot.sets` | ce sont déjà les **sets actifs** calculés à l'import ; recopiés, bornés à 6 runes par sécurité |
| Artéfacts | `SiegeSlot.gear.artifacts` | les **propriétés réellement portées**, 4 max par sorte. Pré-remplir puis élaguer demande moins de travail que retrouver huit lignes dans une liste de 45 |
| Stats | `computeStats(SiegeSlot.gear)` | **valeurs réelles du build** posées comme minimums ; les stats à **0 sont omises** (ex. précision d'un build sans précision) |
| Nom du deck | — | **laissé vide** → prend les noms des monstres (« Trevor - Bella - Loren ») |

- C'est un **point de départ éditable** : l'auteur ajuste ou vide les stats et
  les propriétés d'artéfact qu'il ne veut pas exiger.
- Un slot dont le monstre n'a **pas de `gear`** (ajouté à la main) arrive **sans
  stats** ; un **monstre perso** (`com2usId = null`, non partageable) laisse le
  **slot vide**.
- Seules les équipes contenant **au moins un monstre partageable** sont proposées
  (`isTeamUsable`).
- **Rendu d'une ligne** : le rang (`#N`) puis les **3 monstres en icônes**
  (portrait hexagonal + badge d'élément), **sans nom** — les noms sont bruyants et
  l'icône se reconnaît plus vite. Le résumé texte (`teamSummary`) sert
  d'**infobulle**.
- **Barre de recherche par monstre** en tête de liste (filtre sur les noms des
  3 monstres) : avec ~50 attaques sauvegardées, c'est le seul moyen de retrouver
  une équipe. Message dédié si le filtre ne renvoie rien.
- Sans équipe d'offense, le bouton est **désactivé** avec l'explication (il faut
  avoir **sauvegardé ses attaques en jeu** avant d'exporter son compte, voir
  [../shared/import-compte.md](../shared/import-compte.md)).
- Câblage : l'état d'**offense est passé explicitement** à `RecoBoard`
  (prop `offense` depuis [App.tsx](src/App.tsx) via
  [SiegePage.tsx](src/pages/SiegePage.tsx)) — l'onglet « Recommandations » n'a
  pas de « côté » actif, il lui faut donc l'offense en propre.

## Limites connues / évolutions possibles

- La confrontation ne voit que les builds **présents dans l'export** : un
  monstre au niveau mais déruné (et absent de tout deck) apparaîtra « à
  améliorer ».
- Aucune notion de tolérance : le test est un **`≥` strict** sur chaque stat.
