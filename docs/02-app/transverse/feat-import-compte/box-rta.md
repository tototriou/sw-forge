# Import de compte — box RTA

Partie de [Import d'un compte SWEX](README.md).

## Objectif métier

Récupérer **les monstres « utilisés souvent » (favoris RTA)** avec **la vitesse
de leurs runes RTA** — et **pas** toute la box classique.

Points clés découverts (à ne pas régresser) :
- En RTA, chaque monstre a **son propre preset de runes**, stocké **à part** dans
  `world_arena_rune_equip_list` (et **non** dans `unit_list[].runes`).
- Les favoris (« utilisés souvent ») sont mémorisés par le jeu ; il faut cibler
  **ces monstres-là**, pas tous ceux qui ont une rune.

## Algorithme

1. **Parse JSON** ; exige un `unit_list` (sinon erreur « export SWEX attendu »).
2. **Index des runes** par `rune_id` : inventaire (`data.runes`) **+** runes
   équipées dans chaque unité. Un preset RTA peut réutiliser n'importe laquelle.
3. **Index des unités** par `unit_id`.
4. **Runes RTA par monstre** : via `world_arena_rune_equip_list`, on regroupe par
   `occupied_id` (= `unit_id` équipé en RTA). `findRtaEquipList` gère les
   variantes de nom de clé.
5. **Favoris** (`collectFavoriteUnitIds`), deux formats gérés :
   - **récent** : `favorite_unit_list = [{ type, unit_id_list }, …]` — on
     privilégie `type === 1`, avec aplatissement récursif des groupes.
   - **ancien** : `world_arena_favorite_unit_id_list = [[…],[…]]`.
6. **Cible** = favoris si présents, **sinon repli** sur tous les monstres runés RTA.
7. Pour chaque unité cible → `ImportedUnit { com2usId, flatRuneSpeed, swift }` :
   - `flatRuneSpeed` = somme des SPD (effet type **8**) sur mainstat + prefix +
     substats (**valeur + meule/gemme**).
   - `swift` = **`sets.includes('swift')`** (`swiftActive`), et rien d'autre.

> ### ⚠️ Une seule source de vérité pour le Swift : les **sets actifs**
>
> Ne **jamais** recompter les runes Swift à côté (`swiftCount >= 4`) : le
> comptage diverge de `activeSets` dès qu'une rune **Intangible** sert de
> joker — **3 Swift + 1 Intangible** → `activeSets` renvoie bien `swift`, le
> comptage dit non.
>
> Conséquence : le bonus de +25 % ne serait pas intégré à la « SPD runes »
> alors que l'affichage de la vitesse de combat, lui, le **retire** (voir
> `swiftFlat` dans [feat-calcul-vitesse.md](../feat-calcul-vitesse.md)) → **26 points de
> vitesse en moins** sur un monstre à 101 de base, et **lui seul dans son
> équipe**.
>
> Cas de contrôle : *Chilling* (base 101, brut 195, Swift complété par une
> Intangible) sous lead **+30 %** → **367** en jeu.

## Constantes SW

| Constante | Valeur | Sens |
|-----------|--------|------|
| `RUNE_EFF_SPEED` | `8` | Type d'effet « Vitesse » (com2us). |
| `RUNE_SET_SWIFT` | `3` | `set_id` du set Swift. |
| jointure | `unit_master_id` (SWEX) = `com2usId` (`Monster`) | Mapping unité → monstre. |

## Côté RTA (consommation)

Dans `handleImportFile` de [RtaPage.tsx](src/pages/RtaPage.tsx) :

- Mapping `com2usId → Monster` ; les unités inconnues sont ignorées.
- **SPD runes importée** = `flatRuneSpeed + (swift ? ceil(base × 25 / 100) : 0)`.
  → Ici, comme on part des **runes brutes**, on **rajoute** le +25 % Swift sur la
  base (contrairement à la saisie manuelle, voir
  [feat-calcul-vitesse.md](../feat-calcul-vitesse.md)).
- **Déduplication** par monstre : on garde le **meilleur build** (SPD max) ; ses
  **sets** et son **nombre de runes** sont conservés.
- **Pré-classement par set** (`mapRtaItems`) : un monstre avec **6 runes** va dans
  la section de son **set principal** (`primarySection` : Violent/Swift/Despair/
  Rage/Fatal/Vampire, sinon « Autre ») ; **< 6 runes → « Non classé »**. Les sets
  actifs (`activeSetsFromRuneIds`, 4 pièces en premier) sont stockés sur l'entrée
  pour l'affichage.
- Si une prépa existe déjà : `confirm` unique (importer / ne rien faire) ; l'import **remplace** (`clearAll` puis `importEntries`).
- Messages : succès (`n monstres favoris importés`) ou erreur (aucun favori/preset
  reconnu, JSON illisible…).
