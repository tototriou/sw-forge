# Mon compte — Artéfacts (`#/compte/artefacts`)

Explorer **tout l'inventaire d'artéfacts**. Composant :
`ArtifactsSection` ([ArtifactsSection.tsx](src/components/account/ArtifactsSection.tsx)).

## Contenu

- **Tuiles** : icône d'artéfact (élément ou archétype), niveau (+X), **stat
  principale** (`ArtifactIcon` + `formatArtifactMain`). Bord gauche coloré par
  rareté. Tuiles mémoïsées.
- **Détail au clic** : carte récap façon jeu (`ArtifactDetailBox`) en **popover
  flottant à placement automatique** (même composant que les runes,
  [DetailPopover.tsx](src/components/account/DetailPopover.tsx)) — stat principale,
  substats (↻ orange si modifié), type.
- **Tri** : par **rareté décroissante** puis **niveau décroissant**.

## Filtres

- **Type** : `Tous` · `Élément` · `Archétype`.
  - Si Élément : sous-filtre **Eau / Feu / Vent / Lumière / Ténèbres**.
  - Si Archétype : sous-filtre **Attaque / Défense / PV / Support**.
  - Choisir un sous-filtre depuis « Tous » bascule automatiquement le type.
- **Rareté** : chips (Légendaire → Commun), aux couleurs du jeu (`RARITY_META`).

## Pagination

`Pager` : 60 tuiles/page (DOM borné). En-tête : nombre filtré (« N sur M »).

## Données sous-jacentes

Depuis `parseAccountInventory` (voir [../shared/import-compte.md](../shared/import-compte.md)) :
- `kind` élément/archétype (via `type`, `attribute`, `unit_style`),
- rareté = **`natural_rank`** (le champ `rank` vaut toujours 5),
- substat « modifié » = `sec_effects[i][4] > 0` (`enchant`),
- stat principale : `pri_effect` (100 = PV, 101 = ATQ, 102 = DEF plats).
