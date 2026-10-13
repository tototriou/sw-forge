# Navigation — panneau d'actions mobile

Partie de [Navigation](README.md).

## Panneau d'actions mobile

Sous `lg`, un bouton **« Options »** flotte **juste au-dessus de la barre
d'onglets**, à droite, et ouvre `MobileSheet` — un panneau qui monte **depuis le
bas** de l'écran.

⚠️ **Ni dans la barre d'onglets, ni dans la barre du haut.**
- *Pas dedans* : la barre est à cinq colonnes, une sixième ferait passer chaque
  cible sous les 44 px que réclame un pouce. Et ce bouton ne mène pas à une
  page — le sortir de la rangée dit qu'il fait autre chose que ses voisins.
- *Pas en haut* : c'était un hamburger à la place du logo. Sur un téléphone tenu
  à une main, le coin haut-gauche est le point le plus éloigné du pouce, pour un
  bouton qu'on ouvre et referme plusieurs fois par écran.

⚠️ **Le contenu de page doit réserver assez de marge basse pour dégager
CE bouton, pas seulement la barre d'onglets.** Le conteneur principal
(`App.tsx`, `pb-[calc(116px+env(safe-area-inset-bottom))]` sous `lg`) doit
couvrir `HAUTEUR_ONGLETS` (52 px) + le décalage du bouton Options (16 px) +
sa propre hauteur (~40 px) + une marge de respiration, PLUS
`env(safe-area-inset-bottom)` — le même terme que celui déjà appliqué au
`bottom` du bouton (`MobileTabs.tsx`), sinon les deux dérivent l'un de
l'autre. Un ancien `pb-24` (96 px fixe, sans marge de sécurité) était
inférieur au strict nécessaire (108 px avant marge de sécurité) : sur les
pages à contenu dense proche du bas d'écran (ex. les tuiles de
`RunesOptim.tsx`), la toute dernière rangée pouvait finir partiellement
sous ces deux éléments fixes, une fois défilé au maximum. Corrigé — mais
⚠️ **cause SECONDAIRE**, pas la cause principale d'un signalement
utilisateur plus large (« impossible de cliquer sur une rune », touchant
aussi Compte > Runes > Liste, Artéfacts > Liste, Monstres — pas seulement
la dernière rangée d'une page dense) : la vraie cause était
`.cible-tactile` sans `position: relative`, voir
[03-developpeur/interface/](../../../03-developpeur/interface/), section « cible-tactile ».

⚠️ Le panneau **monte du bas**, du côté du doigt qui l'a demandé. Le tiroir
glissait de la gauche tant que son déclencheur était en haut à gauche ; le
déclencheur ayant bougé, le mouvement suit — un panneau qui surgit à l'opposé
de son bouton oblige à refaire le lien entre les deux à chaque ouverture.

⚠️ **Un flottant ANCRÉ ne peut pas vivre dans le panneau.** Il défile
(`overflow-y: auto`), donc tout `position: absolute` posé dedans s'y trouve
clippé — on n'en voit qu'une bande. Les formulaires ouverts depuis le panneau
(création d'un monstre, d'une catégorie) passent donc en **panneau de second
niveau** : `MobileSheet centre`, qui recouvre celui d'où il sort.

⚠️ Leur fermeture au clic extérieur doit alors être **désactivée** : le panneau
est monté hors de l'arbre du composant, et tout clic dans le formulaire serait vu
comme extérieur. C'est le voile du panneau qui ferme.

⚠️ **Il s'ouvre à la hauteur de son CONTENU, plafonnée à 80 %** (`max-h-[80dvh]`),
jamais plein écran : la bande de page visible en haut dit qu'on est toujours sur
cette page et qu'un appui hors du panneau le referme ; plein écran, il devient
indiscernable d'un changement de page. Un contenu court ne laisse pas de vide
sous lui ; au-delà de 80 %, le corps défile.
- **Hauteur mesurée puis FIGÉE à l'ouverture** : le panneau est collé en bas et
  ne peut grandir que vers le haut. Sans figer, déplier quelque chose (une
  catégorie, une 4ᵉ propriété) ferait remonter d'un coup ce qu'on vient de
  toucher — l'app l'interdit (voir [03-developpeur/interface/](../../../03-developpeur/interface/)). On mesure à
  l'ouverture (bornée par le plafond), on fige, et un contenu qui grandit ensuite
  se lit en défilant.
- Le panneau de **second niveau** (`centre`) reste à la taille de son formulaire,
  même plafond.

Il reçoit les **filtres et les actions** de la page, ceux qui occupaient trois
ou quatre rangées avant la première donnée. Ce qui y entre et ce qui reste :

| Écran | Reste visible | Passe dans le panneau |
|-------|---------------|----------------------|
| RTA | Recherche, compteur, grille des équipes | Création de monstre, sauvegarde/reprise/réinitialisation, export/import/consultation, catégories, tout effacer |
| Siège (défense / offense) | Le compteur d'équipes | Ajouter une équipe, vérifier les ticks, créer un monstre, tout effacer |
| Siège → Recommandations | — | Créer, importer, tout exporter, tout effacer |
| Bestiaire | La recherche | `FilterBar` (élément, étoiles, tri) |
| Mon compte → Monstres | Recherche et tri | Élément, étoiles, doublons, 2A |
| Mon compte → Runes → Liste | Le compteur et la pagination | Sets, slots, antiques, propriété secondaire, tri |
| Mon compte → Artéfacts → Liste | Le compteur et la pagination | Catégorie, sous-filtre, stat principale, propriétés |

⚠️ **Le bouton dépend de l'ÉCRAN, pas de la page** (`pageAPanneau` dans
`App.tsx`). Sur « Mon compte », seules les vues en *liste* ont des filtres : le
résumé, les courbes et la comparaison n'en ont aucun, et le bouton n'y apparaît
pas. Une condition sur la seule route aurait ouvert un panneau vide sur trois
vues de sept.

⚠️ **Le panneau se referme aussi sur `accountSub`, `accountView` et
`siegeTab`**, pas seulement sur la route. Ce sont des écrans à part entière,
chacun avec ses filtres — rester ouvert en passant des runes aux artéfacts
aurait montré les contrôles du précédent.

⚠️ **« Tout effacer » reste détaché** des autres actions, sous un séparateur, et
**centré** — pas aligné à gauche comme la colonne au-dessus. Il n'appartient pas
à leur liste : centré, il se lit comme une sortie de secours plutôt que comme une
action de plus, et rien ne se trouve à côté de lui qu'on pourrait toucher à sa
place. Dans la page il se pose à l'opposé (`ml-auto`) ; dans le panneau il garde
cette distance. Un bouton destructeur ne se met pas au contact de celui qu'on presse
en boucle.

### Une rangée par type d'action

⚠️ **Les boutons du panneau se groupent par NATURE, une rangée chacune** — ils
ne forment pas une colonne unique. Sur la prépa RTA :

| Rangée | Ce qu'elle fait |
|--------|-----------------|
| Création | Créer un monstre |
| État courant | Sauvegarder · Reprendre · Réinitialiser |
| Échange de fichier | Exporter · Importer |
| Organisation | Catégories |
| *(détaché)* | Tout effacer |

Empilés en une seule colonne, cinq boutons de nature différente se lisaient comme
une liste indifférenciée où il fallait relire chaque libellé. Groupés, on vise
la bonne rangée d'abord et le bon bouton ensuite.

⚠️ Le séparateur vertical qui distinguait ces groupes **dans la page** a disparu
au profit d'un saut de rangée : il passait inaperçu dès que la barre se repliait,
ce qu'elle fait sur tout écran étroit.

#### Chaque rangée est une grille

⚠️ **Chaque rangée est une GRILLE** (`data-rangee-actions`), pas une file qui se
replie. En `flex-wrap`, chaque bouton prenait la largeur de son texte :
« Sauvegarder » et « Ami » finissaient côte à côte à des tailles différentes, et
la dernière ligne restait à moitié vide. En grille, tous font la même taille et
s'alignent verticalement d'une rangée à l'autre — c'est ce qui rend le
groupement par type lisible d'un coup d'œil.

- ⚠️ **`height: 100%` sur un bouton de grille EXPLOSE la mise en page.** Il
  paraît la bonne réponse pour égaliser les cellules ; comme les rangées sont en
  `display: contents`, il n'y a aucune ligne dont hériter et le pourcentage
  s'étire sans borne — un bouton par écran. Une `min-height` écrite les égalise
  sans dépendre de rien.
- ⚠️ **Les conteneurs intermédiaires s'effacent aussi** (`data-passe-grille`) :
  `RtaBackupBar` empile ses rangées dans un `div` de marge, qui restait sinon
  l'enfant unique de la grille et absorbait à lui seul une cellule. Marqué,
  jamais déduit d'une structure — une règle sur « tout div intermédiaire »
  effacerait aussi ceux qu'on ajoutera demain pour une autre raison.
- ⚠️ La **création de monstre est seule sur sa ligne**, hors de la grille : elle
  ne relève pas du même geste que les six autres, qui échangent ou figent un
  fichier de prépa. Mais elle garde leur **taille exacte** — un tiers de largeur,
  même hauteur : un bouton d'action n'a pas de raison de peser plus qu'un autre,
  et pleine largeur il redevenait le plus gros du panneau. Sa ligne reste donc
  aux deux tiers vide, ce qui dit justement qu'il n'appartient pas au groupe en
  dessous.
- **Les rangées SUCCESSIVES d'un même bloc fusionnent** (`data-grille-actions`) :
  les boutons de la barre RTA forment une grille unique de cellules égales, et
  non une grille par rangée. Séparées, celle qui perdait son bouton conditionnel
  (« Réinitialiser », absent tant qu'aucun compte n'a été importé) étirait sa
  dernière cellule et plus rien ne s'alignait d'une rangée à l'autre.
- **Trois colonnes fixes, identiques pour toutes les rangées.** Un
  `grid-auto-flow: column` faisait calculer à chaque rangée ses propres
  colonnes : deux boutons s'étalaient en moitiés, trois en tiers, et rien ne
  s'alignait d'une ligne à l'autre — le contraire d'une grille.
- Une rangée incomplète laisse donc une **cellule vide en bout de ligne**, et
  c'est voulu : l'alignement des colonnes vaut mieux qu'un remplissage qui
  décale tout. Les boutons conditionnels (« Réinitialiser » sans import de
  compte) manquent à la fin, là où leur absence ne déplace rien.
- Ciblé par un **attribut**, jamais par la forme du conteneur. Un sélecteur sur
  `.flex-wrap` aurait attrapé les rangées de **pastilles** — six éléments du jeu,
  cinq niveaux d'étoiles — et les aurait forcées à trois par ligne, soit deux
  lignes au lieu d'une : l'inverse du but.
- Une rangée à **un seul bouton est marquée elle aussi** : il occupe UNE cellule,
  pas toute la largeur. Étiré sur trois colonnes, « Créer un monstre » écrasait
  par sa taille les boutons en dessous alors qu'il ne vaut pas plus qu'eux.
- Le sélecteur vise aussi les boutons **enveloppés** (`> * > button`) :
  `CreateMonster` place le sien dans un `div.relative` qui ancre son popover.
  Sans cela, c'est le div qui remplissait la cellule et le bouton flottait
  dedans à sa taille propre.

#### Intitulés, libellés, marges et recherche dans le panneau

⚠️ **Les intitulés de rangée disparaissent** dans le panneau (`.label`).
« Élément », « Trier par », « Stat principale » coûtent 86 px sur une rangée
desktop de 900 px et nomment ce qui suit ; sur 348 px ils prennent le quart de la
largeur pour un mot que les pastilles disent déjà. Masqués en CSS, pas retirés du
DOM : un lecteur d'écran n'a pas la vue d'ensemble qui rend le mot superflu.

⚠️ **Les libellés longs déclinent une version courte** sous `lg` : un bouton
dispose d'un tiers de 348 px. « Ajouter une équipe » → « Équipe », « Vérifier mes
tick ATB » → « Ticks », « Créer une recommandation » → « Créer ». Le sens entier
reste dans l'infobulle et dans
`aria-label`, où il ne coûte aucune place. « Créer un monstre » → « Monstre »
suit la même règle. La règle
`[data-tiroir] .hidden.lg\:inline { display: none }` empêche que la révélation
des libellés n'affiche les deux variantes côte à côte.

⚠️ Les **marges hautes** (`mt-4`) des barres d'outils sont annulées dans le
panneau : elles les détachent de ce qui précède *dans la page*, mais s'ajoutent
au `gap-3` du panneau et y creusent le double du vide voulu.

⚠️ **La recherche ne descend jamais dans le panneau.** C'est le geste le plus
fréquent de ces trois écrans ; l'enfouir derrière une ouverture de panneau
coûterait deux gestes là où il y en avait zéro.

⚠️ **Le Siège n'a pas de panneau**, et son bouton « Options » ne s'affiche donc
pas
(`PAGES_AVEC_MENU` dans `App.tsx`). Sa barre d'outils tient en quatre boutons
qui passent déjà à la ligne seuls : les extraire imposerait de découper
`SiegeBoard` sans gagner une hauteur mesurable. **Ouvrir un panneau vide serait
pire que ne rien proposer** — c'est la règle qui décide de l'appartenance à
cette liste, pas la page.

#### Bascules, libellés masqués et filtres

⚠️ Un bouton-bascule (`aria-pressed`) **garde son propre fond** dans le
panneau : la règle qui rend leur cadre aux boutons l'aurait écrasé, et les trois
interrupteurs d'affichage de la prépa RTA s'y affichaient tous éteints quel que
soit le réglage.

⚠️ La règle qui **rend les libellés** dans le panneau ne vise que les `<span>`
**d'un bouton**. Écrite sur `.compact:hidden` tout court, elle révélait aussi ce
qu'un composant masque pour de bonnes raisons — la pastille de rappel du
formulaire de catégorie, par exemple, réapparaissait alors qu'elle y fait
doublon avec la palette. Ce qu'on veut rendre, ce sont les libellés que les
boutons ont laissés tomber faute de place dans la barre.

⚠️ Le panneau porte `data-tiroir` : les libellés masqués par `hidden sm:inline`
y sont **rétablis** (`src/index.css`). Un bouton réduit à son icône a du sens
dans une barre d'outils serrée ; dans un panneau qui a toute la largeur, il ne
dit plus ce qu'il fait.

⚠️ Les filtres sont **un seul JSX**, posé à deux endroits selon la largeur
(`hidden lg:contents` ou `hidden lg:flex` dans la page, et le même fragment dans
le panneau). Deux copies auraient divergé au premier filtre ajouté.

#### Règles CSS qui adaptent les contrôles au panneau

⚠️ Des règles CSS adaptent les contrôles au panneau (`src/index.css`), plutôt
que de les réécrire dans chaque composant :

- **Hauteur à 34 px**, contre les 40 px de la règle tactile générale. Ces 40 px
  valent pour un bouton perdu dans une page, entouré d'autre chose à toucher ;
  dans le panneau les boutons sont seuls et empilés, il n'y a rien à rater
  autour. À 40 px plus leur rembourrage propre, quatre actions remplissaient la
  moitié de l'écran.
- **Pas de `width: 100%`.** Une colonne de barres pleine largeur donnait à
  quatre actions le poids visuel d'un menu principal, alors que le panneau en
  est un accessoire. `align-items: flex-start` suffit : les boutons reprennent
  la largeur de leur texte, alignés au même bord gauche.
- **Rembourrage resserré sur les boutons empilés seulement.** Les pastilles
  d'une rangée sont rondes et calibrées au texte : leur imposer un autre padding
  les déforme en ovales inégaux. Elles gagnent la hauteur, pas la géométrie.
- **Alignement à gauche des boutons empilés.** Un libellé centré dans un bouton
  large flotte au milieu du vide, et l'œil repart chercher le début de chaque
  ligne. **Seulement les empilés** : les pastilles de filtre vivent dans un
  `flex-wrap` et doivent garder leur largeur propre, sinon la rangée devient une
  colonne de six pastilles géantes.
- **`.w-[86px]` libéré** — les intitulés à largeur fixe reprennent leur largeur
  naturelle. Calibrés pour une rangée desktop de 900 px, ils amputaient d'un
  quart le contrôle qu'ils désignent.

⚠️ Le **titre** du panneau est en `text-sm`, pas `text-base` : il rappelle où
l'on est, il n'annonce pas une page. À la taille d'un titre de section, il
pesait autant que les actions qu'il coiffe.
