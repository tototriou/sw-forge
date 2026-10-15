# Import de compte — équipes de siège

Partie de [Import d'un compte SWEX](README.md).

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
- **SPD runes** (les deux) = `flatRuneSpeed + (swift ? ceil(base × 25 / 100) : 0)`
  (Swift ajouté car on part des runes brutes), avec `swift` **déduit des sets
  actifs** — voir l'encadré « une seule source de vérité » plus haut.
- **Sets de runes** (`slot.sets`) : extraits des runes du deck
  (`activeSetsFromRuneIds`) — sets 4 pièces (**Swift, Rage, Fatal, Despair,
  Vampire, Violent**) actifs à 4 runes, tous les autres (dont **Destroy**) à 2.
  Une rune **Intangible** joue le joker — uniquement s'il y a exactement UN
  set incomplet parmi les runes du deck (règle du jeu, voir
  [compte/feat-calcul-runes.md § 5.2](../../compte/feat-calcul-runes.md#52-bonus-de-set--à-ne-pas-oublier)). Affichés en
  icônes dans la vue compacte du siège.

Puis `importAccount` applique : `rta.importEntries` (après `clearAll`),
`siegeDef.importTeams(_)`, `siegeOff.importTeams(_)` — qui **remplacent**. `lead`/`tick`
des équipes à 0 ; le lead est ensuite **déduit automatiquement** du leader (slot 0).
Seules les cibles qui ont des données sont touchées (un compte sans favoris RTA ne
vide pas la prépa RTA).
