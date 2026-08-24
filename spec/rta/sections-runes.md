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
- **Cible de drop** : surbrillance + halo à la couleur d'accent au survol d'un
  drag (compteur enter/leave pour éviter le scintillement). Drop → `moveMonster`.
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
  l'ordre de tour) ; « base » retiré.
- Croix de retrait (survol) → `removeMonster`.
- **Clic sur le portrait ou la ligne du nom** (si le monstre a des runes
  importées) → ouvre le **détail du gear**, chevron pivoté, carte surlignée
  d'une **bordure d'accent**. La carte elle-même ne s'agrandit pas.
  - ⚠️ La bordure **seule** : elle était doublée d'un `ring-1 ring-accent/50`,
    soit deux traits d'accent concentriques autour de la même carte. Superposés,
    ils se lisent comme un contour flou et non comme deux informations. Voir
    « UN SEUL marqueur de sélection » dans [../shared/design.md](../shared/design.md).

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
  bas). Exiger des runes rendait la carte ENTIÈRE non cliquable et cachait
  ces artéfacts pourtant réels. Bug trouvé sur un compte réel (3 monstres
  « Non classé », 2 artéfacts chacun mais 0 rune, tous les trois inertes).
- **Artéfacts : toujours 2 emplacements affichés** (Attribut puis Type — voir
  `ARTIFACT_KINDS` dans [types.ts](src/types.ts)), même si le monstre n'en
  porte qu'un seul ou aucun — un emplacement vide est montré grisé (icône
  `Ban`), pas simplement absent. Comportement partagé par `MonsterGear` :
  s'applique aussi en Siège et dans l'Optimizer (voir
  [outils/optimizer.md](../outils/optimizer.md)). ⚠️ Cette règle avait une
  régression dans `MonsterGear.tsx` lui-même : le fichier rendait encore
  l'artéfact via un bloc inline (`gear.artifacts.map` conditionné sur
  `length > 0`, un seul `<ArtifactFrameIcon>` par artéfact PRÉSENT) au lieu
  de réutiliser `ArtifactSlots` — le composant venait d'être extrait à son
  **deuxième** usage (les cartes de résultat de l'Optimizer, voir plus bas)
  mais son usage d'ORIGINE n'avait jamais été basculé dessus. Un monstre
  avec un seul artéfact équipé (ex. Type sans Attribut) n'affichait donc
  qu'une seule icône au lieu des 2 emplacements toujours attendus. Corrigé
  en remplaçant le bloc inline par `<ArtifactSlots artifacts={gear.
  artifacts} .../>`.
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
- **Relique : emplacement TOUJOURS affiché, même absente** — demande
  explicite : « l'emplacement pour la relique doit toujours être prévu et
  présent, exactement comme pour les runes ou les artéfacts, même si un
  monstre n'en possède pas ». Avant cette correction, le bloc relique de
  `MonsterGear.tsx` était conditionné sur `gear.relic &&` — la SEULE des
  trois pièces d'équipement à disparaître entièrement plutôt que montrer un
  emplacement vide, contrairement à la règle déjà appliquée aux 2
  emplacements d'artéfacts et à la roue de runes. Corrigé : un cadre grisé
  (`opacity-40`, icône `Ban`, même traitement visuel que l'emplacement
  d'artéfact vide) s'affiche à la place, non cliquable (pas de
  `ZoneCliquable`/`FlottantAuto` — rien à ouvrir). Comportement partagé par
  `MonsterGear` : s'applique aussi en Siège et dans l'Optimizer.
- **Le groupe artéfacts + roue + relique se met à l'échelle de la largeur
  REÇUE.** Son adaptation n'a longtemps eu qu'un seul ressort : `COMPACT`
  (`pointer: coarse`) réduisait artéfacts et roue à 0,72 au doigt — une
  question de POINTEUR, jamais de place. Sur un bureau, le même groupe posé
  dans une colonne étroite gardait donc sa taille pleine et débordait. Même
  classe de défaut que le `dense` des `Segmented` piloté par un seuil de
  FENÊTRE (voir [shared/librairie-ui.md](../shared/librairie-ui.md)) : ni le
  pointeur ni la fenêtre ne disent quoi que ce soit de la largeur d'un
  CONTENEUR. `MonsterGear` mesure désormais (`ResizeObserver`) la largeur
  qu'il reçoit et réduit le groupe juste ce qu'il faut.
  ⚠️ **Par `transform: scale()`, pas par le prop `scale`** d'`ArtifactSlots`/
  `RuneWheel`. Deux raisons : le prop change la taille de LAYOUT, donc une
  fois réduit le groupe ne déborde plus et on repasserait à l'échelle 1 —
  l'oscillation sans fin que `Segmented` évite avec une copie de mesure,
  impossible ici sans dupliquer roue et images ; et le `transform` met à
  l'échelle TOUT le groupe d'un coup, y compris le rembourrage et le texte de
  la relique, que le prop ne sait pas atteindre. Une boîte de réserve porte
  les dimensions réduites, sans quoi un `transform` (qui ne touche pas au
  layout) laisserait derrière lui le vide de la taille pleine.
  ⚠️ **À l'échelle 1 — le cas de très loin le plus courant — aucun style
  n'est posé** : le rendu est alors strictement identique à ce qu'il était
  avant l'ajout de cette mesure. Et **rien ne change au DOIGT**, où `COMPACT`
  pilote déjà la taille : une correction pensée pour le bureau ne touche pas
  l'autre format (voir CLAUDE.md, « deux formats de premier rang »).
- **L'encadré de stats entier est cliquable** (`role="button"`, pas un bouton
  séparé) et bascule entre deux affichages du même tableau :
  - **Base + bonus** (par défaut) : base en blanc, bonus en **vert**
    (`text-good`) — inchangé.
  - **Total** (base + bonus additionnés) au clic : une seule colonne, dans le
    **même vert** que le bonus ci-dessus — **sauf Taux Crit, RES ou
    Précision** (`CAPPED_STATS` dans [effects.ts](src/lib/effects.ts)) qui
    passent en **rouge** (`text-red-500`, pas le jeton `bad` — voir la
    surbrillance du sélecteur de set dans
    [outils/optimizer.md](../outils/optimizer.md) pour le même choix et sa
    raison) dès que leur TOTAL atteint 100 % — leur plafond réel en jeu. Un
    bonus de +30 % isolé n'est pas « au plafond » en soi, c'est la somme avec
    la base qui peut l'être : le rouge n'apparaît donc qu'en mode Total,
    jamais sur la colonne bonus seule.
  - ⚠️ **La VALEUR du total affiché dépend du réglage global « Overcap Taux
    Crit/RES/Précision »** (menu ⚙, voir [README.md](../README.md)) :
    activé (par défaut), le total montré peut dépasser 100 % ; désactivé, il
    s'arrête à 100 % pile — `displayedTotal` dans
    [useOvercapDisplay.ts](src/hooks/useOvercapDisplay.ts). Un réglage
    d'AFFICHAGE seulement : la vérification « atteint 100 % → rouge »
    ci-dessus reste basée sur le total RÉEL, pas sur la valeur bornée montrée
    — sinon désactiver l'overcap masquerait aussi le signal rouge qu'il est
    censé rendre plus lisible.
- ⚠️ **La roue, le panneau de stats et les emplacements d'artéfacts ont été
  remontés** dans [RuneWheel.tsx](src/components/RuneWheel.tsx),
  [StatPanel.tsx](src/components/StatPanel.tsx) et
  [ArtifactSlots.tsx](src/components/ArtifactSlots.tsx) à leur deuxième usage
  (les cartes de résultat de l'Optimizer, en réduit — voir
  [outils/optimizer.md](../outils/optimizer.md)) plutôt que recopiés, même
  principe que `<Segmented>`/`<Switch>` (voir [README.md](../README.md)).
  Chacun paramétré par `scale` (1 = taille historique, inchangée ici) ;
  `MonsterGear` ne porte plus que le reste de la fiche (état `Selected`).
  `StatPanel` a une **largeur fixe** (`w-[200px]`, pas `w-fit`) : sans elle,
  la bascule base+bonus ↔ total changeait la largeur de l'encadré et
  poussait la roue/les artéfacts/la relique voisins d'un côté à l'autre au
  clic.
- ⚠️ **Détail d'une rune/artéfact/relique en popover flottant, pas EN
  LIGNE.** Jusqu'au 2026-08-19, cliquer une pièce insérait son détail dans
  un bloc sous la roue, agrandissant toute la fiche à chaque clic (le cadre
  de stats/roue/artéfacts/relique se décalait). Changé à la demande
  explicite de l'utilisateur, sur le même modèle que `BuildCandidateCard`
  (cartes de résultat de l'Optimizer, voir
  [outils/optimizer/README.md](../outils/optimizer/README.md)) : `RuneWheel`
  et `ArtifactSlots` reçoivent désormais un `renderOverlay` qui ancre un
  `DetailPopover` (voir [account/DetailPopover.tsx](src/components/account/DetailPopover.tsx))
  sur l'élément cliqué ; la relique (pas de composant partagé, un seul
  emplacement) porte le même dispositif posé à la main dans `MonsterGear.tsx`
  (`useRef` + `DetailPopover` dans un wrapper `relative`). Le cadre entier
  ne bouge donc plus jamais, sur RTA, Siège et l'Optimizer.

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

## Retirer un monstre

La croix du coin haut-droit d'une carte demande une **confirmation**
(`ConfirmDialog`), sur les deux formats.

⚠️ Elle n'en demandait aucune : le monstre partait au premier contact. Or cette
croix est posée **sur le coin de la carte**, à quelques pixels du portrait qu'on
touche pour ouvrir le détail des runes — au doigt, on la déclenche par accident
en faisant défiler une grille. Et ce qui part avec le monstre ne se retrouve
pas : sa vitesse saisie, son classement en section, ses catégories. Ni
annulation, ni corbeille.

⚠️ **Sur les deux formats**, alors que le geste est plus risqué au doigt : la
même croix ne peut pas signifier deux choses selon l'écran. C'est la règle
générale du projet — un geste sans retour possible se confirme (voir les 24
autres `ConfirmDialog` de l'app).
