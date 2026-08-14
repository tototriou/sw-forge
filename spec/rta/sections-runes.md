# RTA · Sections de runes (classement drag & drop)

Classer les monstres de la prépa par **set de runes visé**, et saisir la vitesse
de leurs runes.

Fichiers : [RtaSection.tsx](src/components/rta/RtaSection.tsx) ·
[RtaCard.tsx](src/components/rta/RtaCard.tsx) ·
[AccordionGrid.tsx](src/components/AccordionGrid.tsx) ·
[RtaPage.tsx](src/pages/RtaPage.tsx)

## Zones

- **« Non classé » (`unassigned`)** : zone tampon. Tout monstre ajouté / importé y
  arrive. Toujours présente, non supprimable.
- **Sections par set de runes** : `swift`, `violent`, `despair`, **`other`
  (Autre)** par défaut ; d'autres sets ajoutables. Chaque section a son **icône de
  rune** (SWARFARM, servie en local — voir [RuneIcon.tsx](src/components/RuneIcon.tsx))
  et sa **couleur d'accent** (`sectionAccent`).
- « Autre » et « Non classé » utilisent un losange coloré au lieu d'une icône de rune.

## Section — `RtaSection`

- En-tête : icône/losange + label + compteur de cartes + (si supprimable) croix.
- Vide → « Glisse des monstres ici ». Sinon grille de cartes responsive.
- **Cible de dépôt** : surbrillance + halo à la couleur d'accent quand le
  pointeur la survole pendant un déplacement. Dépôt → `moveMonster`.
  - La section **s'enregistre** auprès de `useDragLong` (`enregistrerZone`) et
    reçoit `over` : sans `dataTransfer`, c'est le hook qui teste les rectangles
    pour savoir laquelle est sous le pointeur.
  - ⚠️ **Désenregistrement au démontage** : une section supprimée qui resterait
    dans la table continuerait de capter les dépôts sur son ancien rectangle.
- **Suppression de section** : disponible pour tous les sets **sauf « Autre »**.
  Les monstres de la section supprimée **repartent en « Non classé »**.

## Carte monstre — `RtaCard`

Rendu **compact** et uniforme avec le siège :
- **Toute la carte se saisit, par appui long** (voir ci-dessous). La poignée
  (`GripVertical`) reste, et saisit **immédiatement**.
- Portrait hexagonal agrandi + image (fallback initiales) + badge élément.
- Ligne 1 : nom · **icône vitesse + vitesse totale (blanc)** · **icônes de sets**
  (4 pièces en premier).
- Ligne 2 : **sélecteur de section** compact (repli tactile du drag) : `Non classé`
  + sets visibles → `onMove`.
- **Pas de champ de saisie de vitesse ici** (l'édition SPD runes se fait dans
  l'ordre de tour) ; « base » retiré.
- Croix de retrait (survol) → `removeMonster`.
- **Clic sur le portrait ou la ligne du nom** (si le monstre a des runes
  importées) → ouvre le **détail du gear**, chevron pivoté, carte surlignée
  d'une **bordure d'accent**. La carte elle-même ne s'agrandit pas.
  - ⚠️ La bordure **seule** : elle était doublée d'un `ring-1 ring-accent/50`,
    soit deux traits d'accent concentriques en permanence. Superposés, ils ne se
    lisent pas comme deux informations mais comme un contour flou. Voir la
    section « UN SEUL marqueur de sélection » de
    [../shared/design.md](../shared/design.md).

## Saisie par appui long — `useDragLong`

⚠️ **Le glisser-déposer n'était pas du HTML5.** `draggable` + `dataTransfer` ne
se déclenchent **jamais au toucher** : sur téléphone et tablette, le geste
naturel n'existait pas, et le sélecteur de section était la seule issue. Les
Pointer Events couvrent souris, doigt et stylet avec un seul code.

- **Appui long de 400 ms** n'importe où sur la carte. C'est le seuil retenu par
  iOS et Android : plus court, on saisit en voulant cliquer ; plus long, on
  croit que ça ne répond pas.
- **La poignée saisit sans délai** : elle ne sert qu'à ça, il n'y a aucun clic à
  lui préserver.
- ⚠️ **Seul le `<select>` est exclu.** Il s'ouvre au maintien et le pointeur
  glisse ensuite sur ses options : le geste lui appartient entièrement.
  - ⚠️ **Les boutons restent saisissables**, et c'est le cœur du réglage. La
    carte est presque entièrement couverte d'éléments cliquables — portrait,
    nom, vitesse, croix. Les exclure ne laissait saisissables que **quelques
    pixels de padding** entre eux : le clic long semblait ne fonctionner que sur
    la poignée.
  - Les deux gestes ne se disputent rien : le `click` d'un bouton part au
    **relâchement**, la saisie au bout de **400 ms de maintien**. Et le clic
    parasite qui suivrait un dépôt est déjà supprimé par le hook.
  - La poignée coupe la propagation (`stopPropagation`) : sinon l'événement
    remonte au conteneur, qui relancerait une saisie **avec** délai par-dessus
    celle qu'elle vient de démarrer sans délai.
- ⚠️ **Un bougé franc pendant l'attente annule** : c'est un défilement. Sans ça,
  tout scroll commencé sur une carte se transformait en saisie au bout de 400 ms.
  - ⚠️ **Deux seuils, un par type de pointeur** : 10 px au doigt, **40 px à la
    souris**. La main n'est jamais immobile, et le curseur dérive de plusieurs
    pixels pendant les 400 ms — un seuil serré annulait la saisie avant qu'elle
    ne démarre, et le clic long ne prenait **que sur la poignée** (qui, elle,
    saisit sans attendre).
- ⚠️ Le fantôme apparaît à la **dernière position connue** du pointeur, pas à
  celle du `pointerdown` : après 400 ms le curseur a bougé, et partir du point
  d'appui le faisait surgir à côté avant de rejoindre le pointeur d'un bond.
- ⚠️ **`touch-none` sur la carte** : sans lui, le navigateur s'approprie le
  geste avant que `pointermove` puisse l'en empêcher.
- ⚠️ **`select-none` sur la carte** : maintenir, c'est aussi le geste qui
  **sélectionne du texte**. Sans lui, l'appui long surlignait le nom du monstre
  en bleu au lieu de saisir. Rien ici n'est à sélectionner — la carte est un
  objet qu'on déplace, pas du texte qu'on lit.
- ⚠️ **Menu contextuel bloqué** sur la zone saisissable : sur mobile, l'appui
  long ouvre « Copier / Rechercher » **pendant les 400 ms d'attente**, et
  `select-none` ne l'en empêche pas. Le conditionner à une saisie déjà active
  serait trop tard. Les contrôles gardent le leur.
- ⚠️ **Le `click` qui suit une saisie est supprimé.** Sans ça, déposer une carte
  sur son propre portrait la déplaçait **et** ouvrait son détail de runes : tout
  geste de drag finissait par un clic parasite sur ce qui se trouvait dessous.
  L'écouteur est posé en capture puis **retiré au tick suivant** — un dépôt hors
  de la carte de départ ne produit aucun clic, et l'écouteur resté armé
  avalerait le prochain clic de l'utilisateur.
- **Carte fantôme** (`DragGhost`) : les Pointer Events ne fournissent aucune
  image de drag, contrairement au HTML5. Réduite au portrait et au nom — la
  carte entière masquerait les zones qu'on vise — et **décalée** sous le doigt,
  qui masque sinon ce qu'il tient.
- La carte saisie **s'efface sans quitter le flux** (`opacity-40`) : la retirer
  ferait s'effondrer la grille sous le doigt.
- **Échap relâche** sans déposer, et un retour haptique (`navigator.vibrate`)
  confirme la saisie là où il n'y a pas de curseur pour la montrer.

## Détail du gear — accordéon « façon Google Images »

Comme en **vue compacte du siège**, le panneau de détail (`MonsterGear`) s'ouvre
**sous la ligne** de la carte cliquée, jamais à la place de la carte :

- Les cartes de la **même ligne ne bougent pas** ; seules les **lignes suivantes**
  sont poussées vers le bas.
- Mécanique : [AccordionGrid.tsx](src/components/AccordionGrid.tsx) — brique
  générique qui lit le **nombre de colonnes réellement résolu** par la grille
  (`gridTemplateColumns`, grille en `auto-fill`), le recalcule via un
  `ResizeObserver`, et insère le panneau (`grid-column: 1 / -1`) **après la
  dernière carte de la ligne ouverte**. Sur 1 colonne (mobile), le panneau tombe
  donc juste sous la carte.
- **Un seul détail ouvert à la fois**, toutes sections confondues : l'état
  `openId` vit dans [RtaPage.tsx](src/pages/RtaPage.tsx) (ouvrir une carte ferme
  la précédente, même dans une autre section). `RtaSection` reçoit `openIndex` +
  `detail` et les passe à la grille.
- Une carte **sans runes importées** n'est pas cliquable (pas de chevron).

## Pré-classement à l'import

À l'import d'un compte, chaque monstre **avec un build complet (6 runes)** est
placé dans la section de son **set principal** (4 pièces prioritaire ; sinon
« Autre ») ; les sections manquantes sont **créées automatiquement** (avant
« Autre »). Les monstres à **moins de 6 runes** restent en **« Non classé »**.
Voir [../shared/import-compte.md](../shared/import-compte.md).

## Ajouter une section

Sous les sections : « Ajouter une section » + `select` des sets **non déjà
visibles** (`availableSets`) + bouton **Créer**. `addSection` **insère avant
« Autre »** pour garder le fourre-tout en dernier.

## Tri interne d'une section

Chaque section est triée **plus rapide en premier**, par **vitesse totale sans
lead** (`base + runes`) ; les entrées sans vitesse finissent en dernier, départage
par nom. (Le tri ne dépend pas des leads.)

## Attendus

- Déplacer un monstre ne change que sa `section` (garde sa SPD runes).
- La SPD runes est partagée avec l'affichage de l'ordre de tour (même `entry`).
- Ajouter une section déjà visible est sans effet (idempotent).
