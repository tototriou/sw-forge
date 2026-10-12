# Navigation — barre d'onglets (sous `lg`)

Partie de [Navigation](README.md).

## Barre d'onglets — sous `lg`

- ⚠️ **En bas, pas en haut.** Sur un téléphone tenu à une main, le haut de
  l'écran est hors d'atteinte du pouce. C'est aussi ce que fait le système, donc
  le geste est déjà acquis.
- ⚠️ **Cinq entrées au maximum.** Au-delà, les cibles passent sous 44 px de
  large et on tape à côté. L'app en compte neuf : les cinq principales sont
  visibles. Ce n'est pas un choix esthétique — c'est ce que la largeur d'un
  pouce autorise.
- ⚠️ **`env(safe-area-inset-bottom)`** : sans lui, la barre passe sous la barre
  de geste des iPhone récents et le dernier onglet devient intouchable.

### ⚠️ Un onglet à sous-sections les FAIT CHOISIR — [MobileNavSheet.tsx](src/components/MobileNavSheet.tsx)

**Toucher « RTA », « Siège » ou « Compte » n'ouvre pas une page : ça ouvre un
panneau où l'on choisit la sous-section.** C'est la règle « la barre navigue SEULE » portée
au tactile — on choisit d'abord **où**, la page ne change qu'ensuite.

Avant, chaque page à sous-sections portait **ses propres rangées d'onglets** sous
`lg` (`lg:hidden`) :

- « Compte » menait droit à l'inventaire de monstres, et ses **dix autres vues**
  n'étaient atteignables que par **deux rangées** posées en haut de la page —
  onze destinations empilées avant le premier résultat, et **invisibles tant
  qu'on n'était pas déjà sur la page**. « Siège » ouvrait la Défense, ses deux
  autres vues idem.
- Ces rangées étaient écrites **page par page**, chacune avec son rendu : deux
  jeux de contrôles à tenir d'accord avec la barre latérale.

Le panneau les remplace toutes.

#### ⚠️ DEUX TEMPS quand la section a des groupes

Sur « Mon compte », on choisit **l'inventaire** (Monstres · Runes · Artéfacts),
**puis** sa vue.

Les dix destinations ont d'abord été posées **à plat**, groupes et intitulés
compris — c'est la liste de la barre latérale, qui tient sur un écran de bureau
de 900 px de haut et **pas** dans un panneau qui s'arrête au tiers de l'écran.
On y défilait pour trouver, alors que les trois inventaires suffisent à
s'orienter.

- ⚠️ **Un seul temps quand il n'y a rien à trancher.** « Siège » n'a qu'un
  groupe, sans intitulé : ses trois vues s'affichent directement. Faire choisir
  un groupe unique ajoute un geste sans rien donner à décider.
- ⚠️ **Un groupe à VUE UNIQUE mène directement à elle.** « Monstres » n'a que
  « Ma box » : il devient un lien, sans chevron. Il garde le libellé du
  **groupe** — c'est la liste des inventaires qu'on lit, et « Ma box » n'y aurait
  pas le même sens que ses deux voisins.
- Le **titre du panneau suit le temps** où l'on est (« Mon compte », puis
  « Runes ») : c'est la seule chose qui dise ce qu'on est en train de choisir. Le
  retour, en tête du second temps, ramène au premier **sans refermer**.
- Le **groupe courant porte le marqueur d'état**, comme les destinations : sans
  lui, le premier temps ne disait pas dans quel inventaire on se trouve déjà.
- On repart **toujours du premier temps** à l'ouverture. Rouvrir « Compte » sur
  les vues de Runes parce qu'on y était la fois d'avant ferait apparaître une
  liste dont le titre ne dit pas d'où elle sort.
- ⚠️ **Le passage d'un temps à l'autre GLISSE**, du même mouvement que les deux
  niveaux de la barre latérale — `GLISSEMENT` et `COURBE` sont **importés de
  `Sidebar`**, pas réécrits : descendre d'un niveau est le même geste quel que
  soit le format, et deux définitions auraient dérivé au premier réglage. On
  entre par la droite, on ressort par la gauche (8 px, 180 ms) : un fondu seul
  dirait « ça a changé » sans dire « tu es descendu ».
  - ⚠️ **`mode="popLayout"`** : le niveau sortant quitte le **flux** au lieu de
    rester empilé sous l'entrant. C'est ce qui permet de re-mesurer la hauteur
    sur le seul niveau entrant — les deux en flux, elle aurait relevé la **somme
    des deux** et le panneau se serait figé à une hauteur qui n'existe à aucun
    moment. Le conteneur est `relative` : sans ancêtre positionné, le sortant se
    calait sur le panneau `fixed` entier, donc en travers du titre.

#### ⚠️ Une LISTE, une rangée par entrée

Refonte graphique, lot 11a, **décision 24** (le mainteneur, la maquette) : une
colonne de rangées au lieu d'une grille de cases encadrées.

- **Historique, à ne pas perdre de vue.** Le panneau a d'abord été une liste
  à filets — « trois libellés séparés par des traits, dont on ne voyait pas où
  commençait la cible » —, puis une **grille de deux colonnes** de cases
  encadrées (`repeat(auto-fit, minmax(max(140px, calc(50% - 4px)), 1fr))`,
  deux colonnes dès 320 px d'écran). Le mainteneur a choisi la liste de la maquette
  en connaissance de cause ; ce qui répond au défaut d'alors :
  - chaque rangée prend **toute la largeur**, sur **52 px** exactement (au-delà
    des 44 de la règle tactile) : la cible est la rangée entière, pas le
    libellé ;
  - elle **s'allume au toucher** (`active:`) et au survol ;
  - un **filet sous chaque rangée, sauf la dernière** — un seul trait entre
    deux entrées, jamais deux.
- L'entrée courante : **encre pleine, semi-gras, icône teintée** de la couleur
  de contexte — le marqueur de la barre latérale.
- ⚠️ **Les DEUX temps partagent la même liste.** Ils se succèdent au même
  endroit à quelques centaines de millisecondes d'intervalle : deux gabarits
  de cible pour un seul geste, et le panneau changerait de nature en
  descendant d'un niveau.
- Le **retour** est la **première rangée**, en haut du panneau, au même
  gabarit que les autres — **toutes les cibles ont la même taille**. Ce qui le
  distingue est son **encre atténuée** et son chevron **vers la gauche**, pas
  son encombrement.
- La **colonne d'icône est à largeur fixe** (18 px) : sans elle les libellés se
  décalent d'une rangée à l'autre au gré de la largeur des symboles.
- Meules et Gemmes n'y reviennent pas (la maquette les montre avec
  « Bientôt ») : elles ont quitté le menu par décision du mainteneur, [retrait #6]
  du cadrage de la refonte.
- ⚠️ La hauteur du panneau est **re-mesurée au changement de temps**
  (`mesureCle`). Elle est figée à l'ouverture pour qu'un dépliage interne ne
  fasse pas remonter ce qu'on vient de toucher ; mais ici tout le contenu est
  **remplacé** — figée sur les trois inventaires, la liste des sept vues se
  serait lue en défilant dans une fenêtre trois fois trop courte. Ce n'est pas
  un dépliage : rien de ce qu'on vient de toucher n'est encore là.

Le reste :

- ⚠️ **Alimenté par les mêmes `SidebarSection` que la barre latérale**, pas une
  seconde liste — elle aurait divergé au premier écran ajouté, et le manque
  serait passé inaperçu. Même règle que la recherche de navigation.
- ⚠️ **`MobileSheet`, le composant déjà en place**, monté depuis le BAS : son
  déclencheur est un onglet de la barre du bas, et un menu qui surgirait en haut
  obligerait à refaire le lien entre les deux à chaque fois.
- ⚠️ Un onglet qui ouvre une section est un **`<button>`**, pas un `<a>` : il ne
  va nulle part, il n'a rien à faire dans l'historique. Même distinction que la
  barre latérale.
- ⚠️ **« Outils » OUVRE ses sous-sections** (Optimizer, Speed tuning), comme
  Siège et Compte. Tant qu'il n'y en avait qu'une, il restait un lien direct — un
  panneau pour un seul choix n'ajoutait qu'un geste.
- ⚠️ **« RTA » aussi, depuis qu'il en a deux** (Ma prépa · Ami). Même règle : la
  consultation de la prépa d'un ami s'ouvrait par un bouton perdu dans la barre
  de fichiers de sa propre prépa, et s'affichait par-dessus elle. C'est une
  destination, elle se choisit comme les autres.
- ⚠️ **La barre d'onglets RESTE VISIBLE sous le panneau** — l'inverse du panneau
  d'actions, qui la recouvre à dessein (`z-50` contre son `z-40`) parce qu'elle
  mène ailleurs alors qu'on règle la page où l'on est. Ici le panneau **est** la
  navigation : la masquer retirerait de l'écran la section où l'on se trouve et
  le moyen d'en changer, au moment précis où l'on navigue — et le déclencheur
  qu'on vient de toucher disparaîtrait sous son propre résultat. D'où la
  variante `surLesOnglets` de `MobileSheet` : panneau en `z-[35]`, voile en
  `z-30`, tous deux **sous** les onglets, et le panneau décalé de leur hauteur.
  - ⚠️ **Pas d'`aria-modal` dans cette variante.** L'attribut annonce que tout
    le reste de la page est inerte ; les onglets, eux, restent cliquables — un
    lecteur d'écran aurait masqué la seule chose qu'on laisse délibérément
    visible.
  - La hauteur des onglets vit dans [layout.ts](src/lib/layout.ts), pas dans
    `MobileTabs` : trois pièces la lisent, et la déclarer dans le composant
    forçait `src/ui/` à importer `src/components/` — un **cycle**, puisque
    `MobileTabs` importe déjà la librairie. La librairie est la couche du
    dessous, elle ne connaît pas les écrans.
- ⚠️ **Retoucher l'onglet déjà ouvert REFERME le panneau.** Le geste qui ouvre
  doit pouvoir défaire ce qu'il vient de faire : sans la bascule, on ouvrait
  « Compte » par erreur et il fallait viser la croix ou le voile pour en sortir
  — deux cibles ailleurs sur l'écran, alors que le doigt est encore sur
  l'onglet.
- Le panneau se ferme au **choix d'une destination**, et aussi à tout changement
  de route (retour arrière, lien depuis l'accueil, recherche de navigation) —
  sinon il restait ouvert par-dessus l'écran qu'on vient d'atteindre.
- ⚠️ **Cibles pleine hauteur (44 px)** : c'est une liste qu'on vise du pouce, pas
  une rangée de pastilles serrées. La règle tactile s'y applique sans exception.

⚠️ **Le titre de la barre du haut nomme désormais la VUE** sur « Mon compte »
(« Runes · Liste »), et non plus le seul inventaire : les rangées d'onglets
disaient la vue, et rien d'autre à l'écran ne la disait à leur place. La vue
n'est ajoutée que s'il y a un **choix** — « Monstres · Ma box » répéterait deux
fois la même chose.

### ⚠️ Le responsive était quasi inexistant

Avant cette refonte, **toute l'application comptait 8 occurrences de
breakpoints** et aucune barre de navigation mobile.

La passe qui a suivi a corrigé quatre familles de défauts :

- ⚠️ **`minmax(360px, 1fr)` déborde** sur 348 px utiles : une colonne ne peut
  pas descendre sous son minimum. `minmax(min(360px, 100%), 1fr)` prend la plus
  petite des deux — le minimum voulu, ou toute la largeur.
- ⚠️ **L'ordre de tour DÉFILE** au lieu de passer à la ligne. C'est une
  *séquence* : replié sur trois rangées, on ne lit plus qui joue avant qui —
  précisément l'information de cet écran.
- ⚠️ **La carte de build s'empile** sous `sm` : table de stats, artéfacts et
  roue de runes tiennent sur une ligne à partir de 360 px de carte, pas en
  dessous.
- ⚠️ **Les popovers ancrés à droite** ont besoin d'un `max-w-[calc(100vw-2rem)]` :
  `min-w` seul ne borne rien, et le menu sortait de l'écran.

⚠️ **`overflow-x: hidden` sur le `body` n'est PAS une correction** : il masque
le débordement au lieu de le résoudre, et rend le contenu coupé inatteignable.
Il reste comme garde-fou de dernier recours, jamais comme réponse.
