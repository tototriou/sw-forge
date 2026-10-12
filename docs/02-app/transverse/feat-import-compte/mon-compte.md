# Import de compte — box 6★ et inventaire

Partie de [Import d'un compte SWEX](README.md).

## Import « Mon compte » — box 6★ & inventaire

Contrairement à RTA/siège (persistés en `localStorage`), les données de « Mon
compte » restent **en mémoire dans [App.tsx](src/App.tsx)** (`useState` : `box`,
`runes`, `artifacts`, `relics`) → **ré-import nécessaire à chaque session**. Choix
assumé de sobriété : un gros compte (des milliers de runes) ne remplit pas le
stockage.

### Box 6★ — `parseAccountBox`

- Parcourt `unit_list`, ne garde que les unités **montées 6★** (`class === 6`).
- Pour chacune : `com2usId` (`unit_master_id`), `unit_level`, et un `GearSet`
  construit depuis l'équipement **actuellement équipé** (runes/artéfacts embarqués
  dans l'unité + relique).
- `mapBoxMonsters` résout `com2usId → Monster` ; les unités inconnues des données
  sont ignorées. Renvoie `{ key, monster, stars, level, gear }` (key = `unit_id`).

### Inventaire — `parseAccountInventory`

- **Toutes** les runes et **tous** les artéfacts possédés (inventaire + équipés,
  dédupliqués par id via `indexRunes` / `indexArtifacts`), plus la **réserve de
  meules et de gemmes** (`rune_craft_item_list` → `CraftLine[]`, voir
  [compte/](../../compte/), onglet Meules).
- Chaque rune → `RuneDetail` (slot, set, rareté = `extra`, antique = `class > 10`,
  niveau, main/innée/substats meule incluse) ; chaque artéfact → `ArtifactDetail`
  (catégorie attribut/type, rareté = `natural_rank`, main, substats, `enchant`).
- **Toutes** les reliques possédées (`data.relics`, source première, fusionné
  avec `unit.relics[0]` en repli via `indexRelics`, dédupliqué par `rid`).
  Chaque relique → `RelicDetail { id, upgrade, main, unique? }` — `id` = `rid`,
  `upgrade` = `upgrade_curr` (filtre de niveau et affichage, jamais la valeur
  de `main`, qui reste lue dans `pri_effect`). `relicUsageById` : occupation
  par rid, comptée sur les unités (`unit.relics[0].rid`), jamais sur
  `data.relics.length` — voir
  [03-developpeur/optimizer/ § Ce que le moteur lit d'une relique](../../../03-developpeur/optimizer/).
  `relicUpgradeMismatches` : nombre de pièces où
  `pri_effect[1] ≠ upgrade_curr + 3`, un avertissement jamais une correction.
- Utilisé par les sous-sections **Runes** et **Artéfacts** (voir
  [compte/](../../compte/), [compte/](../../compte/)),
  et par l'Optimizer pour la relique (voir
  [03-developpeur/optimizer/](../../../03-developpeur/optimizer/)).

### Marqueurs de runes — `rune_lock_list` + `markers`

Les 8 marqueurs qu'on pose en jeu sur une rune. Relevé sur deux exports réels
(164 et 563 entrées).

- ⚠️ **Le marqueur n'est PAS dans l'objet rune.** Il vit dans une liste au premier
  niveau, `rune_lock_list: [{ wizard_id, rune_id, lock_type }]`. `lock_type` est
  le numéro du marqueur (1 à 8). Malgré le mot « lock », ce n'est pas un simple
  verrou anti-vente : les 8 valeurs sont couvertes. La structure est la même que
  `unit_marker_list` (marqueurs des monstres).
- ⚠️ **Aucune valeur ne veut dire « aucun marqueur »** : une rune sans marqueur est
  **absente** de la liste. Chaque `rune_id` y figure au plus une fois.
- `indexRuneMarkers` (index mémoïsé `rune_id → lock_type`) est passé à
  `runeToDetail`, qui pose `RuneDetail.marker` **seulement** pour une rune
  marquée. Sinon le champ reste absent, jamais à 0. Le champ est posé à
  l'**inventaire comme sur l'équipement** (box, RTA, siège) : une rune garde le
  même marqueur où qu'on la regarde.
- **Libellés** — `parseRuneMarkerLabels` → `{ numéro: texte }`, tiré de `markers[]`
  (`type === 1`, `sub_type` = `lock_type`, texte dans `description`).
  `type: 3` sert aux monstres, `type: 2` probablement aux artéfacts (non vérifié) :
  ni l'un ni l'autre n'est lu. Les libellés sont gardés **au niveau du compte**,
  jamais recopiés dans chaque rune : renommer un marqueur ne touche qu'une entrée.
- ⚠️ **Un numéro peut n'avoir aucun libellé** : le joueur ne l'a jamais nommé. Relevé
  sur un export : 7 numéros utilisés pour 6 libellés, dont un vide. Il est alors
  absent du résultat, et l'écran affiche « Marqueur N ». Les espaces de bord sont
  retirés (« raffinage␠ » relevé tel quel).

### Runes utilisées — `parseUsedRuneIdsParPerimetre`

Les `rune_id` des runes **qui jouent**, rangés **par périmètre** : l'onglet
Optimisation laisse choisir lesquels comptent. Règles de l'écran dans
[compte/](../../compte/) (runes, « Runes utilisées »).

| Périmètre | Source |
|-----------|--------|
| `rta` | presets RTA (`world_arena_rune_equip_list`) |
| `siege-defense` | défenses de siège (`guildsiege_defense_deck_*`) |
| `siege-attaque` | `deck_list`, `deck_type === 22` (`SIEGE_OFFENSE_DECK_TYPE`) |
| `arene-attaque` | `deck_list`, `deck_type === 1` (`ARENA_OFFENSE_DECK_TYPE` — relevé utilisateur, 15 decks sur chacun de deux exports réels) |
| `arene-defense` | `defense_deck_info` et `server_arena_defense_deck_info` |
| `autres` | `deck_list`, **tout autre `deck_type`** (donjons, ToA, labyrinthe…) |

- ⚠️ **`autres` n'est pas une liste blanche.** Tout type inconnu y tombe, y compris
  ceux que Com2uS ajoutera. Sur deux exports réels : les types 2 à 14 et 23 à 27.
- Une même rune peut figurer dans **plusieurs** périmètres. Chaque liste est triée.
- `parseUsedRuneIds` est l'**union** de tous les périmètres
  (`unionRunesUtilisees`), c'est-à-dire la définition historique de « runes
  utilisées ».

⚠️ Le preset d'un contenu **ne déplace rien en jeu** : une rune de l'inventaire
peut jouer en RTA, et une rune posée sur un monstre qui ne joue nulle part ne
joue pas. `occupied_id` seul se trompe dans les deux sens. Un monstre d'un deck
**sans preset** compte, lui, ses runes actuellement portées.
