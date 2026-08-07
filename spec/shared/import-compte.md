# Import d'un compte SWEX (transverse — RTA & Siège)

Extraire des données d'un export de compte Summoners War (format SWEX). **100 %
côté navigateur** — aucun fichier n'est envoyé. Un **seul import global** remplit
**tout** d'un coup, via trois parseurs :

- **Box RTA** → prépa RTA (`parseAccountJson`).
- **Défenses de siège** → équipes de défense (`parseSiegeDefense`).
- **Offense de siège** → équipes d'attaque sauvegardées (`parseSiegeOffense`).

Fichiers : [importAccount.ts](src/lib/importAccount.ts) (parseurs) ·
[applyAccount.ts](src/lib/applyAccount.ts) (mapping monstres + vitesses) ·
[AccountImportControl.tsx](src/components/AccountImportControl.tsx) (bouton nav) ·
[App.tsx](src/App.tsx) (orchestration `importAccount`).

## Un seul bouton d'import invariant (barre de nav)

Le bouton **« Importer mon compte »** vit dans la barre de navigation (desktop à
droite des onglets ; mobile dans le menu). Il est **toujours identique** : chaque
clic ouvre le sélecteur de fichier ; le fichier choisi **remplace le précédent**
et est appliqué. Un import :

1. **traite la page courante** (affichage immédiat), et
2. **remplit les autres en arrière-plan** — RTA, défense **et** offense sont
   alimentées en une fois.

Pour rendre ça possible, les états sont **remontés dans [App.tsx](src/App.tsx)**
(`useRtaState`, `useSiegeState('defense')`, `useSiegeState('offense')`), et
`importAccount(text)` applique les trois. Le fichier n'est **pas mémorisé** : pas
besoin, un import couvre déjà toutes les pages. Rien n'est persisté sur le disque.

À côté du bouton : un lien **« Supprimer mes données »** (efface prépa RTA,
équipes de siège, monstres perso puis recharge).

**Une seule confirmation** : si des données existent déjà (RTA/défense/offense),
un unique `confirm` « remplacer / fusionner » s'applique aux trois cibles. Message
global récapitulatif **éphémère** (disparaît seul ~5 s ; ~9 s pour une erreur) :
« Import : N monstres RTA · N défenses · N attaques ».

Helpers partagés par les deux parseurs : `runeSpeed` (SPD d'une rune : mainstat +
prefix + substats avec meule), `indexRunes` (index rune_id → rune, inventaire +
runes des unités), `indexUnits` (unit_id → unité), `speedFromRuneIds` (SPD plate
cumulée + set Swift complet pour un lot de rune_id).

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
   - `swift` = **4 runes du set Swift** (`set_id === 3`) équipées en RTA.

## Constantes SW

| Constante | Valeur | Sens |
|-----------|--------|------|
| `RUNE_EFF_SPEED` | `8` | Type d'effet « Vitesse » (com2us). |
| `RUNE_SET_SWIFT` | `3` | `set_id` du set Swift. |
| jointure | `unit_master_id` (SWEX) = `com2usId` (`Monster`) | Mapping unité → monstre. |

## Côté RTA (consommation)

Dans `handleImportFile` de [RtaPage.tsx](src/pages/RtaPage.tsx) :

- Mapping `com2usId → Monster` ; les unités inconnues sont ignorées.
- **SPD runes importée** = `flatRuneSpeed + (swift ? round(base × 25 / 100) : 0)`.
  → Ici, comme on part des **runes brutes**, on **rajoute** le +25 % Swift sur la
  base (contrairement à la saisie manuelle, voir
  [calcul-vitesse.md](calcul-vitesse.md)).
- **Déduplication** par monstre : on garde le **meilleur build** (SPD max) ; ses
  **sets** et son **nombre de runes** sont conservés.
- **Pré-classement par set** (`mapRtaItems`) : un monstre avec **6 runes** va dans
  la section de son **set principal** (`primarySection` : Violent/Swift/Despair/
  Rage/Fatal/Vampire, sinon « Autre ») ; **< 6 runes → « Non classé »**. Les sets
  actifs (`activeSetsFromRuneIds`, 4 pièces en premier) sont stockés sur l'entrée
  pour l'affichage.
- Si une prépa existe déjà : `confirm` → **remplacer** (`clearAll`) ou **fusionner**.
- Messages : succès (`n monstres favoris importés`) ou erreur (aucun favori/preset
  reconnu, JSON illisible…).

## Import des équipes de siège (défense & offense)

Défense et offense partagent la **même forme** : des decks de 3 monstres (index
0 = leader) où chaque monstre a **ses propres runes de siège** (comme la box RTA,
le siège stocke des presets de runes par monstre). D'où une logique factorisée :

- `equipArrayToMap(equip)` : `[{ unit_id, rune_id_list }, …]` → `Map<unit_id, rune_id_list>`.
- `buildSiegeDecks(defs, runeById, unitById)` : résout des `DeckDef` (3 unit_id
  ordonnés + runes) en `SiegeImportedDeck` (mapping monstre + `speedFromRuneIds`),
  ignore les decks totalement vides, garde les decks partiels.

### Défense — `parseSiegeDefense`

Jusqu'à 6 decks. Champs SWEX :

| Clé | Rôle |
|-----|------|
| `guildsiege_defense_deck_unit_list` | `[{ deck_id, unit_id_list }, …]`. `unit_id_list` = 3 slots ; **index 0 = leader** (par position) ; `0` = slot vide. |
| `guildsiege_defense_deck_equip_list` | Indexé par `deck_id` → `{ equip: [{ unit_id, rune_id_list }, …] }`. |

### Offense — `parseSiegeOffense`

Les équipes d'**attaque sauvegardées** (≈ 50 possibles). Champs SWEX :

| Clé | Rôle |
|-----|------|
| `deck_list` filtré sur `deck_type === 22` | Chaque deck : `{ deck_seq, unit_id_list, leader_unit_id, equip }`. `equip` = runes inline par unité. |

- `deck_type = 22` = équipes d'attaque de siège (constante `SIEGE_OFFENSE_DECK_TYPE`,
  identifiée sur des exports réels : decks de 3 monstres avec presets de runes).
- **Leader** donné par `leader_unit_id` → replacé en 1ᵉʳ (les autres unités non
  nulles suivent).
- Erreur claire si aucun deck de ce type (⇒ il faut avoir **sauvegardé ses
  attaques en jeu** avant d'exporter).

### Modèle retourné (commun)

```ts
interface SiegeImportedSlot { com2usId: number; flatRuneSpeed: number; swift: boolean }
interface SiegeImportedDeck { deckId: number|string; slots: (SiegeImportedSlot|null)[] } // len 3, 0=leader
interface SiegeParseResult { decks: SiegeImportedDeck[]; error?: string }
```

### Consommation (mapping)

Dans [applyAccount.ts](src/lib/applyAccount.ts), réutilisé par `importAccount` :

- `mapRtaItems(units, byCom2us)` → entrées RTA (dédup au meilleur build, SPD max).
- `mapSiegeTeams(decks, byCom2us)` → `{ teams, missing }` ; unité inconnue → slot
  vide + compteur `missing`.
- **SPD runes** (les deux) = `flatRuneSpeed + (swift ? round(base × 25 / 100) : 0)`
  (Swift ajouté car on part des runes brutes).
- **Sets de runes** (`slot.sets`) : extraits des runes du deck
  (`activeSetsFromRuneIds`) — sets 4 pièces (**Swift, Rage, Fatal, Despair,
  Vampire, Violent**) actifs à 4 runes, tous les autres (dont **Destroy**) à 2.
  Une rune **Intangible** joue le joker et complète le set le plus proche d'être
  plein. Affichés en icônes dans la vue compacte du siège.

Puis `importAccount` applique : `rta.importEntries` (après `clearAll` si remplace),
`siegeDef.importTeams(_, replace)`, `siegeOff.importTeams(_, replace)`. `lead`/`tick`
des équipes à 0 ; le lead est ensuite **déduit automatiquement** du leader (slot 0).
Seules les cibles qui ont des données sont touchées (un compte sans favoris RTA ne
vide pas la prépa RTA).

## Confidentialité

- Traitement local uniquement ; le fichier n'est jamais poussé/envoyé.
- Les exports de compte sont **gitignorés** (`*account*.json`, `tototriou-*.json`,
  etc.) — ne jamais committer un export réel.
