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

## Filtre par section — au téléphone

**Au doigt**, une rangée
d'**onglets** (`Onglets`, la librairie UI) en tête des sections — **« Tous »**,
puis **« Non classé »** et chaque section de set, chacun avec son **nombre de
monstres** (et l'icône de son set). **Un seul ouvert** : il n'affiche que sa
section, qu'il coiffe ; « Tous » les rend toutes.

- ⚠️ **Un filtre d'AFFICHAGE, rien d'autre** : l'ordre de tour, les
  compteurs, la prépa elle-même ne changent pas — on regarde une section, on
  ne la sort pas de la prépa.
- ⚠️ **Au téléphone seulement** (`lg:hidden`) : sur une colonne, trente
  rangées se parcourent mal ; à la souris, les sections tiennent côte à côte
  sous les yeux.
- Non persisté : rouvrir la page montre tout. Une section supprimée pendant
  qu'elle est choisie ramène à « Tous ».
- Défilement horizontal de la rangée si les sections dépassent la largeur,
  jamais un retour à la ligne qui pousserait les sections vers le bas.

## Section — `RtaSection`

- En-tête : icône/losange + label + compteur de cartes + **filet** jusqu'au bord
  + (si supprimable) croix.
- ⚠️ **Pas de cadre au repos** : cinq
  sections encadrées empileraient cinq boîtes dans la page ; c'est l'en-tête et
  son filet qui délimitent la section. Même gabarit pour les sections de la
  prépa d'un ami (`RtaFriendView`).
- Vide → « Glisse des monstres ici ». Sinon grille de cartes responsive.
  ⚠️ La grille garde à droite la place de la croix « Retirer » d'une carte du
  bord, qui dépasse de 5 px (`pr-[5px] -mr-[5px]`) : le rembourrage la met
  dans la boîte de la grille, la marge négative le rend au conteneur ;
  colonnes et cartes ne bougent pas.
- **Cible de drop** : au survol d'un drag, le cadre apparaît — **1 px à la
  couleur d'accent** (la bordure, transparente au repos, prend la teinte : rien
  ne bouge) — sur un fond `panel2` léger (compteur enter/leave pour éviter le
  scintillement). Drop → `moveMonster`. Pas d'ombre par-dessus la bordure :
  elle en ferait un trait de 2 px.
- **Cartes** (`RtaCard`, et celles de la prépa d'un ami) : fond `panel`,
  contour `border-soft` (`border` au survol), rayon
  12 ; l'anneau des catégories suit ce rayon.
- **Suppression de section** : disponible pour tous les sets **sauf « Autre »**.
  Les monstres de la section supprimée **repartent en « Non classé »**.

## Carte monstre — `RtaCard`

Rendu **compact** et uniforme avec le siège :
- Poignée de drag (`GripVertical`) : **seule** zone qui déclenche le glisser.
- Portrait hexagonal agrandi + image (fallback initiales) + badge élément.
- Ligne 1 : nom · **icône vitesse + vitesse totale (blanc)** · **icônes de sets**
  (4 pièces en premier).
- Ligne 2 : **sélecteur de section** compact (repli tactile du drag) : `Non classé`
  + sets visibles → `onMove`.
- **Pas de champ de saisie de vitesse ici** (l'édition SPD runes se fait dans
  l'ordre de tour).
- Croix de retrait (survol) → `removeMonster`.
- **Clic sur le portrait ou la ligne du nom** (si le monstre a des runes
  importées) → ouvre le **détail du gear**, chevron pivoté, carte surlignée
  d'une **bordure d'accent**. La carte elle-même ne s'agrandit pas.
  - ⚠️ La bordure **seule** : doublée d'un `ring-1 ring-accent/50`, elle ferait
    deux traits d'accent concentriques autour de la même carte. Superposés,
    ils se lisent comme un contour flou et non comme deux informations. Voir
    « UN SEUL marqueur de sélection » dans [../../03-developpeur/interface/](../../03-developpeur/interface/).

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
- Une carte **sans aucun gear** (`entry.gear` absent) n'est pas cliquable
  (pas de chevron). ⚠️ **Le critère est la présence de `gear`, PAS le nombre
  de runes** : `hasGear = !!entry.gear` dans `RtaCard.tsx`, sans exiger
  `runes.length > 0`. Un monstre ajouté à la prépa mais jamais runé peut
  quand même porter des **artéfacts** (voire une relique) — `MonsterGear`
  gère déjà 0 rune sans problème (panneau de stats, emplacements
  d'artéfacts, roue ET emplacement de relique TOUJOURS rendus, voir plus
  bas). Exiger des runes rendrait la carte ENTIÈRE non cliquable et cacherait
  ces artéfacts pourtant réels (un monstre « Non classé » à 2 artéfacts et
  0 rune serait inerte).

### Artéfacts, roue de runes et relique : toujours affichés

- **Artéfacts : toujours 2 emplacements affichés** (Attribut puis Type — voir
  `ARTIFACT_KINDS` dans [types.ts](src/types.ts)), même si le monstre n'en
  porte qu'un seul ou aucun — un emplacement vide est montré grisé (icône
  `Ban`), pas simplement absent. Comportement partagé par `MonsterGear` :
  s'applique aussi en Siège et dans l'Optimizer (voir
  [optimizer/](../optimizer/)). ⚠️ `MonsterGear.tsx` rend les artéfacts par
  `<ArtifactSlots artifacts={gear.artifacts} .../>`, jamais par un bloc inline
  conditionné sur `length > 0` : un monstre avec un seul artéfact équipé (ex.
  Type sans Attribut) n'afficherait qu'une icône au lieu des 2 emplacements
  attendus.
- **Roue de runes : toujours affichée, même à 0 rune** — pas de garde
  `gear.runes.length > 0` autour de `<RuneWheel>`. `RuneWheel` ne fait que
  `runes.map(...)` : un slot sans rune montre déjà seulement le **fond** de
  la roue (`rune-wheel.png`), sans cadre dessus — exactement le même rendu
  qu'un build partiel (une rune sur deux, par exemple), pas un état grisé
  à inventer. Un monstre sans aucune rune importée montre donc le fond nu
  de la roue plutôt que rien du tout. Comportement partagé par
  `MonsterGear` : s'applique aussi en Siège et dans l'Optimizer. Même
  principe que les 2 emplacements d'`ArtifactSlots` toujours affichés
  ci-dessus.
- **Relique : emplacement TOUJOURS affiché, même absente**, exactement comme
  pour les runes ou les artéfacts : un cadre grisé (`opacity-40`, icône `Ban`,
  même traitement visuel que l'emplacement d'artéfact vide), non cliquable
  (pas de `ZoneCliquable`/`FlottantAuto` — rien à ouvrir). Comportement
  partagé par `MonsterGear` : s'applique aussi en Siège et dans l'Optimizer.

### Mise à l'échelle du groupe artéfacts, roue et relique

- **Le groupe artéfacts + roue + relique se met à l'échelle de la largeur
  REÇUE.** `COMPACT` (`pointer: coarse`) réduit artéfacts et roue à 0,72 au
  doigt — une question de POINTEUR, jamais de place : sur un bureau, le même
  groupe posé dans une colonne étroite déborderait. Ni le pointeur ni la
  fenêtre ne disent quoi que ce soit de la largeur d'un CONTENEUR (même règle
  que le `dense` des `Segmented`, voir
  [03-developpeur/interface/](../../03-developpeur/interface/)). `MonsterGear`
  mesure donc (`ResizeObserver`) la largeur qu'il reçoit et réduit le groupe
  juste ce qu'il faut.
  ⚠️ **Par `transform: scale()`, pas par le prop `scale`** d'`ArtifactSlots`/
  `RuneWheel`. Deux raisons : le prop change la taille de LAYOUT, donc une
  fois réduit le groupe ne déborde plus et on repasserait à l'échelle 1 —
  l'oscillation sans fin que `Segmented` évite avec une copie de mesure,
  impossible ici sans dupliquer roue et images ; et le `transform` met à
  l'échelle TOUT le groupe d'un coup, y compris le rembourrage et le texte de
  la relique, que le prop ne sait pas atteindre. Une boîte de réserve porte
  les dimensions réduites, sans quoi un `transform` (qui ne touche pas au
  layout) laisserait derrière lui le vide de la taille pleine.
  ⚠️ **`w-max` sur le groupe.** Le groupe (`display:flex`, largeur `auto`) est
  un enfant BLOC normal de la boîte de réserve — sans `w-max`, dès que cette
  boîte reçoit une largeur explicite plus étroite, `width:auto` REMPLIRAIT
  cette largeur réduite au lieu de garder la largeur NATURELLE de son contenu.
  La mesure suivante (`groupe.offsetWidth`) rapporterait cette largeur DÉJÀ
  rétrécie : l'échelle recalculée reviendrait près de 1, la boîte de réserve
  se rétablirait, déborderait ou passerait à la ligne, la hauteur de la racine
  observée changerait et redéclencherait la mesure — une saccade, la mesure se
  corrompant elle-même à chaque passage. `w-max` (`width: max-content`) force
  le groupe à toujours se dimensionner sur son contenu, jamais sur la largeur
  de son parent.
  ⚠️ **À l'échelle 1 — le cas de très loin le plus courant — aucun style
  n'est posé.**
  ⚠️ **Au DOIGT, la fiche de stats est sur la MÊME ligne que le groupe**, pour
  gagner de l'espace. La place disponible pour le groupe se calcule alors
  DIFFÉREMMENT du bureau : largeur de la racine **moins** la fiche de stats
  (largeur FIXE, jamais réduite — voir `StatPanel.tsx`) et l'écart entre les
  deux (8px) — sans quoi le groupe s'afficherait à sa taille naturelle sans
  tenir compte de la place prise par la fiche sur la MÊME ligne, et le
  `flex-wrap` du navigateur le renverrait à la ligne suivante.
  ⚠️ **Plancher de lisibilité (0,55) CONTINU, jamais un saut entre deux
  formules.** Sous le plancher, repasser au calcul du bureau (racine entière)
  donnerait une SACCADE : si le ratio `dispo/naturelW` frôle le seuil, un
  écart de mesure d'à peine 1px (arrondi de `offsetWidth`) suffit à basculer
  d'un côté puis de l'autre, chaque bascule change la présentation du groupe,
  donc la HAUTEUR de la racine, donc redéclenche l'observateur — un
  aller-retour sans fin. Un simple plancher (`Math.max`) garde la formule
  continue : jamais deux branches qui se disputent le même seuil.

### Encadré de stats, composants partagés et détail d'une pièce

- **L'encadré de stats entier est cliquable** (`role="button"`, pas un bouton
  séparé) et bascule entre deux affichages du même tableau :
  - **Base + bonus** (par défaut) : base en blanc, bonus en **vert**
    (`text-good`). ⚠️ **PV, ATQ, DEF et VIT seulement** : Taux Crit, Dmg
    Crit, RES et Précision s'affichent **toujours en total**, à la place de
    la base, colonne du bonus vide (`STATS_AVEC_BASE`, stats.ts ; décision
    de l'utilisateur pour toute l'app — leur base est une petite valeur
    d'éveil fixe, comme « Stats de base exclues » de l'Optimizer le traitait
    déjà). Vaut pour toutes les fiches (RTA, ami, siège, Optimizer) et les
    cartes de résultat.
  - **Total** (base + bonus additionnés) au clic : une seule colonne, dans le
    **même vert** que le bonus ci-dessus — **sauf Taux Crit, RES ou
    Précision** (`CAPPED_STATS` dans [effects.ts](src/lib/effects.ts)) qui
    passent en **rouge** (`text-red-500`, pas le jeton `bad` — voir la
    surbrillance du sélecteur de set dans
    [optimizer/](../optimizer/)
    pour le même choix et sa raison) dès que leur TOTAL atteint 100 % — leur plafond réel en jeu. Un
    bonus de +30 % isolé n'est pas « au plafond » en soi, c'est la somme avec
    la base qui peut l'être : le rouge n'apparaît donc qu'en mode Total,
    jamais sur la colonne bonus seule.
  - ⚠️ **La VALEUR du total affiché dépend du réglage global « Overcap Taux
    Crit/RES/Précision »** (menu ⚙, voir [les réglages](../transverse/feat-navigation/compte-et-parametres.md#les-réglages)) :
    activé (par défaut), le total montré peut dépasser 100 % ; désactivé, il
    s'arrête à 100 % pile — `displayedTotal` dans
    [useOvercapDisplay.ts](src/hooks/useOvercapDisplay.ts). Un réglage
    d'AFFICHAGE seulement : la vérification « atteint 100 % → rouge »
    ci-dessus reste basée sur le total RÉEL, pas sur la valeur bornée montrée
    — sinon désactiver l'overcap masquerait aussi le signal rouge qu'il est
    censé rendre plus lisible.
- ⚠️ **La roue, le panneau de stats et les emplacements d'artéfacts sont
  partagés** : [RuneWheel.tsx](src/components/RuneWheel.tsx),
  [StatPanel.tsx](src/components/StatPanel.tsx) et
  [ArtifactSlots.tsx](src/components/ArtifactSlots.tsx) servent aussi aux
  cartes de résultat de l'Optimizer, en réduit (voir
  [optimizer/](../optimizer/)). Chacun est paramétré par `scale` (1 ici) ;
  `MonsterGear` porte le reste de la fiche (état `Selected`).
  `StatPanel` a une **largeur fixe** (`w-[200px]`, pas `w-fit`) : sans elle,
  la bascule base+bonus ↔ total changerait la largeur de l'encadré et
  pousserait la roue/les artéfacts/la relique voisins d'un côté à l'autre au
  clic. Seules les cartes de résultat de l'Optimizer, au bureau et à la
  souris, la posent plus étroite (174 px, fixe elle aussi :
  [resultats.md](../optimizer/ecran/resultats.md)).
- ⚠️ **Détail d'une rune/artéfact/relique en popover flottant, pas EN
  LIGNE** : inséré dans un bloc sous la roue, il agrandirait toute la fiche à
  chaque clic (le cadre de stats/roue/artéfacts/relique se décalerait).
  `RuneWheel` et `ArtifactSlots` reçoivent un `renderOverlay` qui ancre un
  `FlottantAuto` (voir [FlottantAuto.tsx](src/ui/FlottantAuto.tsx)) sur
  l'élément cliqué ; la relique (pas de composant partagé, un seul
  emplacement) porte le même dispositif posé à la main dans `MonsterGear.tsx`.
  Le cadre entier ne bouge donc jamais, sur RTA, Siège et l'Optimizer.

## Pré-classement à l'import

À l'import d'un compte, chaque monstre **avec un build complet (6 runes)** est
placé dans la section de son **set principal** (4 pièces prioritaire ; sinon
« Autre ») ; les sections manquantes sont **créées automatiquement** (avant
« Autre »). Les monstres à **moins de 6 runes** restent en **« Non classé »**.
Voir [../transverse/](../transverse/).

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

## Retirer un monstre

La croix du coin haut-droit d'une carte demande une **confirmation**
(`ConfirmDialog`), sur les deux formats.

**Repère dans le DOM**, pour le banc d'affichage : `data-bouton-coin="retirer-rta"`
sur le `<button>` positionné de la croix (exception « bouton en coin » de
`tests/banc/mesure.ts` : son dépassement sur la carte est voulu).

⚠️ Retirer un monstre demande une confirmation. La croix est posée **sur le
coin de la carte**, à quelques pixels du portrait qu'on touche pour ouvrir le
détail des runes — au doigt, on la déclenche par accident en faisant défiler
une grille. Et ce qui part avec le monstre ne se retrouve pas : sa vitesse
saisie, son classement en section, ses catégories. Ni annulation, ni
corbeille.

⚠️ **Sur les deux formats**, alors que le geste est plus risqué au doigt : la
même croix ne peut pas signifier deux choses selon l'écran. C'est la règle
générale du projet — un geste sans retour possible se confirme (voir les 24
autres `ConfirmDialog` de l'app).
