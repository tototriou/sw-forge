# Siège · Composition d'équipe

Composer et organiser une équipe de 3 monstres, avec un leader en slot 0.

Fichiers : [SiegeTeam.tsx](src/components/siege/SiegeTeam.tsx) ·
[MonsterPicker.tsx](src/components/MonsterPicker.tsx) ·
[SiegePage.tsx](src/pages/SiegePage.tsx)

## Structure d'une équipe

- En-tête : « Équipe N » + **Supprimer** (retire l'équipe).
- **3 slots** en ligne (`grid`, 1 col mobile / 3 cols ≥ sm). **Slot 0 = Leader**
  (couronne `Crown` + libellé « Leader »).
- Dans **chaque slot** : **boutons de tick** propres au monstre (voir
  [speed-tick.md](speed-tick.md)).

## Slot vide

- Marqué « Leader » (slot 0) ou « Slot », avec un **`MonsterPicker`** :
  recherche par nom (max 25), exclut les monstres déjà utilisés dans l'équipe
  (`usedIds`), affiche icône élément + nom + SPD. Sélection → remplit le slot.

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
- La **pastille** affiche **n'importe quel type** de lead du leader (SPD, ATQ, PV,
  DEF, crit, précision, résistance), avec sa portée (élément / arène / donjon).
- Elle est **mise en avant** (`active`, couleur `star`) uniquement si c'est un
  lead **de vitesse effectif en siège** : `Attack Speed` + portée
  `General`/`Guild`/`Element`. Sinon pastille neutre (informative).

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
