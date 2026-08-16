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
Une ligne par équipe, très basse : les **3 monstres** côte à côte.

⚠️ **Côte à côte À TOUTE largeur**, y compris sur téléphone. Ils s'y empilaient
en colonne : trois cartes de 52 px plus les écarts, soit 170 px par équipe avant
même l'en-tête — on voyait une équipe et demie là où le siège en compte huit à
comparer. **Une équipe EST une rangée de trois** ; l'empiler défait ce qu'on
vient lire. Sous `sm`, le portrait descend à 30 px et le nom à 11 px pour que
les trois tiennent sur 348 px. Chaque monstre
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
  - suffixe « (arène) » / « (donjon) » quand la portée exclut le siège.
- ⚠️ **TOUS les leads sont en couleur (doré, `star`) — aucun n'est grisé.**
  Un lead arène ou donjon a été rendu terne et désaturé parce qu'il ne compte
  pas en siège. Mais le grisé se lit comme « inactif », voire « cassé », alors
  que le monstre **a bel et bien ce lead** : ce qui ne s'applique pas, c'est le
  contenu de jeu, pas la donnée.
  - La nuance reste dans l'**infobulle** (« sans effet en siège ») et dans le
    suffixe « (arène) » / « (donjon) » — du texte, qui peut la formuler, là où
    une couleur ne fait que dévaloriser.
  - `leadIsActive` **subsiste** pour ce libellé. C'est une question de
    **portée, pas de stat** : `General` / `Guild` / `Element` s'appliquent
    **quelle que soit la stat** (un lead PV ou DEF compte autant qu'un lead
    VIT). ⚠️ Ne pas restreindre à `Attack Speed` : c'est le **calcul des
    ticks** qui ne retient que la vitesse (voir
    [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md)), pas
    l'affichage.
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

## Densité sur téléphone

La page empile jusqu'à huit équipes : tout rembourrage s'y paie autant de fois.
Sous `sm` :

| | Bureau | Mobile |
|---|---|---|
| Carte d'équipe | `p-4` | `p-2.5` |
| Écart entre équipes | `gap-4` | `gap-2` |
| Portrait en vue compacte | 36 px | 30 px |
| Nom du monstre | 12 px | 11 px |
| Icônes de set | 17 px | 14 px |
| Badge de lead | 22 px | 17 px |
| Icône de vitesse | Affichée | Masquée |
| Titre « Équipe N » | 17 px | 15 px |
| « Éditer » / « Supprimer » | Libellé + icône | Icône seule |

⚠️ Les libellés des deux boutons d'en-tête tombent sous `sm` : la ligne y porte
déjà le titre, la pastille d'état et la pastille de lead. Le crayon et la
corbeille se reconnaissent seuls, et `aria-label` porte le sens complet.

⚠️ **Le budget de la ligne « vitesse + sets » est COMPTÉ**, pas estimé. Sur
348 px, une carte compacte fait `(348 − 2×4) ÷ 3 ≈ 113 px` ; moins le
rembourrage et le portrait de 30, il reste **~73 px**. Une icône de vitesse (12)
plus un nombre à trois chiffres (~22) plus trois icônes de set (3×14) font déjà
76 : l'icône de vitesse tombe, parce qu'elle est **ce qui apporte le moins** —
le gros chiffre en gras se lit comme une vitesse sans elle, c'est la seule de la
carte.

⚠️ Le carré du slot **vide** suit exactement la taille du portrait rempli. À
34 px fixes, une carte vide était plus haute qu'une carte pleine et la rangée de
trois partait en dents de scie.

⚠️ Le sous-onglet **« Recommandations » devient « Recos »** sous `sm`. À sa
longueur complète, les trois onglets ne tenaient pas sur une ligne et la rangée
passait à la ligne — une navigation à trois entrées ne doit pas occuper deux
lignes. C'est en outre le mot qu'on emploie.
