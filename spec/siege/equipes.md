# Siège · Composition d'équipe

Composer et organiser une équipe de 3 monstres, avec un leader en slot 0.

Fichiers : [SiegeTeam.tsx](src/components/siege/SiegeTeam.tsx) ·
[MonsterPicker.tsx](src/components/MonsterPicker.tsx) ·
[SiegePage.tsx](src/pages/SiegePage.tsx)

## Structure d'une équipe

- En-tête : **chevron déplier/replier** + « Équipe N » + (point rouge si alerte
  vitesse) + **Supprimer**.
- **Repliée par défaut** (vue compacte). L'état `expanded` est **remonté dans
  [SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx)** (pour donner la pleine
  largeur à l'équipe en édition — voir [README.md](README.md)) ; le composant le
  reçoit en prop et remonte le clic (`onToggleExpand`).

### Vue compacte (repliée)
Une ligne par équipe, très basse : les **3 monstres** côte à côte. Chaque monstre
= portrait hexagonal + **icône d'élément** + (couronne si leader), puis un bloc
texte **sur deux lignes** :

```
[hex]  Nom du monstre
       ⚡ 307        ◆ ◆ ◆
```

- **Ligne 1** : le **nom**, seul, sur toute la largeur disponible (`truncate`).
- **Ligne 2** : **vitesse de combat** à gauche, **icônes de sets** poussées à
  droite (`ml-auto`, 17 px, 3 max).

⚠️ **Ne pas remettre nom + vitesse + sets sur une seule ligne.** C'est ce qui
existait, et à 2 colonnes avec 3 sets ça débordait : la carte fait ~157 px
utiles, la disposition en demandait ~175 → le gros chiffre de vitesse (non
réductible) passait **sous les icônes de set**. En deux lignes, la ligne la plus
chargée demande ~106 px pour ~113 disponibles.

Cliquer un monstre (ou le chevron) **déplie** le détail. Les slots en danger
(voir [speed-tick.md](speed-tick.md)) ont un anneau rouge et la vitesse en rouge.
Idéale avec beaucoup d'équipes (import offense ~50).

### Vue détaillée (dépliée)
- **3 slots** (`grid`, 1 col mobile / 3 cols ≥ sm). **Slot 0 = Leader** (couronne).
- Dans **chaque slot** : **boutons de tick** propres au monstre (voir
  [speed-tick.md](speed-tick.md)).

> Les **sets de runes** (`slot.sets`, clés `RUNE_SETS`) sont renseignés à
> **l'import** de compte (extraits des runes du deck) ; vides pour un monstre
> ajouté à la main. Voir [../shared/import-compte.md](../shared/import-compte.md).

## Slot vide

- Marqué « Leader » (slot 0) ou « Slot », avec un **`MonsterPicker`** :
  recherche par nom (max 25), exclut les monstres déjà utilisés dans l'équipe
  (`usedIds`), affiche **portrait** + nom + SPD. Sélection → remplit le slot.

## Slot rempli

- Poignée de drag (`GripVertical`) + (si leader) couronne + hexagone image/initiales.
- Nom + (si leader) **pastille de lead** (voir ci-dessous).
- **Vitesse de combat** en gros (voir [speed-tick.md](speed-tick.md)).
- Champ **« SPD : »** (vitesse des runes, Swift déjà inclus).
- Croix de retrait → vide le slot.
- **Sélecteur de position** (« 1 · Leader / 2 / 3 ») = repli tactile : intervertit
  avec le slot cible.

## Leader & pastille de lead

- Le **slot 0 est le leader** : son lead alimente le calcul (voir spec vitesse).
- Le lead est affiché **à deux endroits, qui répondent à deux questions
  différentes** — ce n'est pas un doublon :
  - **sur le portrait du monstre leader** → *de quel monstre vient le lead ?* ;
  - **à côté du nom de l'équipe** (« Équipe N ») → *quelle est sa valeur ?*,
    lisible **sans déplier**, comme dans les decks de recommandation.

  [LeadPill.tsx](src/components/siege/LeadPill.tsx) exporte pour ça deux rendus :
  - **`LeadBadge`** — icône seule (22 px par défaut) posée en **bas-gauche du
    portrait**, montant dans l'infobulle. Utilisé quand la place manque : vue
    **compacte** du siège et aperçu replié des decks de reco. Il **remplace la
    couronne** — l'icône du jeu marque déjà le leader *et* dit quel est le lead
    (la couronne ne revient que si le monstre n'a aucun lead).
    ⚠️ **Icône nue et carrée, comme dans le jeu** : pas de pastille ronde, pas
    de fond, pas d'anneau. Seule l'ombre portée reste, pour la détacher du
    portrait ;
  - **`LeadPill`** (défaut) — icône 22 px **+ le montant** (« +33 % »), dans
    l'**en-tête de l'équipe** (donc visible aussi en vue compacte) et **sous le
    nom** du leader dans la vue dépliée.
- Elle affiche **n'importe quel type** de lead (SPD, ATQ, PV, DEF, crit,
  précision, résistance) avec l'**icône officielle du jeu**, puis le montant
  (« +33 % ») :
  - **icône SWARFARM** servie en local depuis `public/leader-skills/`
    (voir [../shared/donnees-monstres.md](../shared/donnees-monstres.md)).
    ⚠️ **Rien de custom** : pas de couronne + icône de stat recomposées.
    L'icône encode déjà **la stat ET la portée**, donc on n'écrit pas le libellé
    de stat à côté (il reste dans l'infobulle). Elle est volontairement
    **grande (22 px)** : à 16 px les pictogrammes du jeu sont illisibles ;
  - **icône d'élément** en plus quand la portée est élémentaire — c'est la seule
    information que l'icône du jeu ne distingue pas ;
  - suffixe « (arène) » / « (donjon) » quand la portée exclut le siège ;
  - icône **désaturée** quand le lead ne compte pas en siège.
- Elle est **mise en avant** (doré, `star`) dès que le lead **s'applique en
  siège**. C'est une question de **portée, pas de stat** (`leadIsActive`) :
  `General` / `Guild` / `Element` → actif, **quelle que soit la stat** (un lead
  PV ou DEF compte autant qu'un lead VIT). ⚠️ Ne pas restreindre à
  `Attack Speed` : c'est le **calcul des ticks** qui ne retient que la vitesse
  (voir [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md)), pas
  l'affichage. Seules les portées `Arena` / `Dungeon` sont neutres/désaturées,
  avec l'infobulle « sans effet en siège ».
- **Même pastille** dans les decks de
  [recommandation](recommandations.md), pour le monstre en slot 0.

## Drag & drop / réorganisation

- **Glisser un slot sur un autre** = interversion (`swapSlots`). Surbrillance du
  slot survolé.
- Interversion avec le slot 0 = **change le leader** → le lead auto est recalculé
  pour toute l'équipe.
- Repli sans drag : le **sélecteur de position** de chaque slot fait la même
  interversion (utile au tactile).

## Attendus

- Un même monstre ne peut pas occuper deux slots d'une équipe (`excludeIds`).
- Un monstre **perso** est sélectionnable comme les autres.
- Vider/retirer un slot le remet à l'état vide (pas de décalage des autres).
- Le nombre d'équipes est illimité ; chaque équipe est indépendante.
