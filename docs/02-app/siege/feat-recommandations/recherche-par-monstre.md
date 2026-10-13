# Recommandations — recherche par monstre

Partie de [Siège · Recommandations](README.md).

## Recherche par monstre — sur toute la page

**Jusqu'à trois monstres**, avec un sélecteur de **rôle** : `Partout` ·
`Défense à taper` · `Offense à runer`
([recoSearch.ts](src/lib/recoSearch.ts), calcul pur).

**Placement : juste au-dessus des recommandations**, dans le bloc de filtres.
C'est elle qui décide de ce que la liste montre, elle doit donc être collée à ce
qu'elle filtre.

### La vue — SORTIE du bloc de filtres, toujours affichée

⚠️ **La vue ne suit pas la règle du bloc de filtres** (ci-dessous), et c'est
volontaire — elle a hérité de la place et de la règle du filtre d'origine
qu'elle remplace. Un filtre au-dessus d'une liste vide n'a normalement rien à
filtrer — c'est vrai pour la recherche par monstre, qui n'a RIEN à chercher
sans recommandation. Ce n'est **pas** vrai pour la vue : ses deux crans
(Attaque/Défense) restent un choix qui a un sens dès qu'on **crée**
la première recommandation, et un bouton d'action qui apparaît une fois qu'on
en a besoin surprend — on ne l'a jamais vu apparaître d'un geste, il était
juste absent (voir la règle générale dans
[03-developpeur/interface/design/mouvement-et-gestes.md](../../../03-developpeur/interface/design/mouvement-et-gestes.md#%EF%B8%8F-un-bouton-daction-ne-disparaît-jamais--il-se-désactive) (design, « Un bouton d'action ne disparaît jamais »)).
La vue est donc **posée hors du bloc**, **toujours affichée et active** —
aux deux formats.

Rendu **une seule fois** (`vueFilter(pleineLargeur)`), posé aux deux
endroits — même geste que `actions` et `effacer` :
- **à la souris** : sur la page, juste au-dessus du bloc de filtres, `hidden
  lg:flex` ;
- **au doigt** : dans le panneau « Options » (sous un filet, sous les
  actions) — la carte reste à la **recherche**, le contrôle qu'on veut sous
  le pouce sans ouvrir un panneau.

⚠️ **Pleine largeur dans le panneau**, pas à sa taille propre : seul contrôle
de sa ligne, il y flotterait sinon dans une bande vide. `Segmented` passe en
`size="lg"` (chaque cran se partage la largeur à égalité).

⚠️ **Intitulé « Vue » : au DOIGT seulement.** Dans le panneau, c'est le
seul repère de ce contrôle — rien d'autre à côté pour dire ce qu'il fait.
À la SOURIS, pas d'intitulé : en tête de la barre d'outils, les deux crans
(Attaque/Défense) se lisent d'eux-mêmes, et leur infobulle dit ce que chacun
montre.

⚠️ **`size="md"` à la souris, pas `sm`** — troisième palier ajouté à
[Segmented.tsx](../../../../src/ui/Segmented.tsx) : le texte et le
rembourrage de `lg`, sans forcer sa largeur (`lg` reste réservé au panneau, où
le cran est seul sur sa ligne). Posé seul sur sa propre ligne depuis qu'il est
sorti du bloc de filtres, ce contrôle a la place d'être aussi lisible qu'un
réglage structurant.

### La recherche par composition — sans cadre, sans intitulé « Monstres »

Monstres cherchés et rôle **filtrent tous la même liste** et se
**combinent**. Deux rangées empilées, **sans encart** (ni bordure ni fond) et
**sans intitulé sur la première** :

| Rangée | Contrôle | Visible |
|--------|----------|---------|
| **(sans intitulé)** | le champ, puis les 3 cases collées à lui, puis « Vider » | dès 1 recommandation |
| **Rôle** | `Segmented` Partout · Défense à taper · Offense à runer + le compteur de résultats | une fois un monstre posé |

⚠️ **Pas de cadre.** Il enfermait un contenu qui n'a pas besoin d'être distingué
du reste de la page — la vue, juste avant, n'en a pas non plus.

⚠️ **Pas d'intitulé « Monstres ».** Les trois cases et le champ disent déjà par
leur FORME ce qu'on y fait — une composition de 3 monstres à composer —, un mot
devant n'ajoutait rien. « Rôle » garde le sien : contrairement aux cases, un
`Segmented` Partout/Défense/Offense ne dit pas de lui-même sur QUOI il porte.

Ce bloc **n'apparaît que s'il existe au moins une recommandation** : sans rien
à chercher, la recherche n'a pas sa place — à la différence de la vue, qui
reste affichée à vide (voir plus haut).

⚠️ **Le champ de recherche à GAUCHE, les portraits des monstres posés à
sa DROITE, collés à lui.** C'est le champ qu'on utilise en premier — le regard
commence par lui, pas par des cases encore vides — et les portraits sont son
RÉSULTAT : ils se lisent après ce qu'on vient de taper, jamais avant.
⚠️ **Sous `lg`, le champ prend toute la largeur restante** ; il n'est plafonné
(260 px) qu'à partir de `lg`. Plafonné dès `sm`, avec les cases poussées au
bord droit (`ml-auto`), il laissait un grand vide entre les deux, et les cases
se lisaient comme un contrôle à part (le mainteneur, sur une capture en fenêtre
étroite : « revois cet affichage »). Champ et cases forment maintenant un seul
bloc.

- ⚠️ **Origine, Monstres et Rôle étaient posés à trois niveaux différents, sans
  intitulé** : trois objets flottants dont rien ne disait qu'ils portaient sur
  la même liste ni qu'ils se cumulaient. L'intitulé de **largeur fixe**
  (`w-[76px]`) aligne les contrôles entre eux quelle que soit la longueur du
  mot.
- ⚠️ **La vue (comme le filtre d'origine avant elle) utilise le VRAI
  [Segmented](src/ui/Segmented.tsx)**,
  et non une copie écrite à la main. La copie avait dérivé — `bg-panel` au lieu de
  `bg-panel2`, `rounded-xl p-1` au lieu de `rounded-lg p-0.5`, texte plus grand :
  deux contrôles à cran voisins n'avaient ni le même cadre, ni le même rayon, ni
  la même taille. Un composant partagé existe, on le prend.
- Les crans de la vue ne portent pas d'effectif (le filtre d'origine en avait
  un, dans le cran après le libellé, `suffix` de `Segmented`) : les deux vues
  montrent les MÊMES recommandations, il n'y aurait rien à compter.
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
- **Aucun résultat** → message dédié : dire « aucune recommandation » après
  une recherche ferait croire à une perte de données.
- Persistée via `useStickyState` (survit à la navigation, repartie à vide au
  reload), comme la vue.

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
