# Modèle de vitesse (transverse)

**Source de vérité** pour toute la mécanique de vitesse. RTA et Siège s'y
réfèrent ; toute page à venir (Arène) doit le réutiliser.

Fichier : [speed.ts](src/lib/speed.ts)

## Formule de vitesse de combat

```
vitesse_combat = base + runes_brutes + bonus%(base)
bonus%(base)   = ceil( base x (TOTEM + lead + swift) / 100 )
```

- **base** : SPD de base du monstre (`monster.stats.speed`), fixe dans SW.
- **runes_brutes** : SPD plate apportee par les runes, **sans** le bonus de set.
- **TOTEM = 15** : totem de vitesse de guilde, **+15 % de la base, toujours actif
  pour tous les monstres**. Jamais optionnel.
- **lead** : bonus de leader skill de vitesse, en %.
- **swift** : **+25 %** si le set Swift est actif, 0 sinon.

### Regle d'arrondi -- **imperative**

Le bonus en % porte **uniquement sur la vitesse de BASE** (jamais sur base +
runes), et :

> ### Tous les pourcentages sont SOMMES, puis arrondis EN UNE SEULE FOIS au superieur.

⚠️ **Ne jamais arrondir bonus par bonus.** C'est l'erreur qui a produit tous les
ecarts d'un point observes, et elle est sournoise : elle tombe juste la plupart
du temps et ne se voit que sur certaines bases.

**Cas de controle, tous verifies en jeu.** Toute modification de cette formule
doit continuer a les reproduire.

*Sans lead ni Swift* -- trois monstres cales sur le tick **286** :

| base | runes | bonus attendu | calcul |
|---|---|---|---|
| 96 | +175 | **15** | `ceil(14,40)` |
| 99 | +172 | **15** | `ceil(14,85)` |
| 105 | +165 | **16** | `ceil(15,75)` |

> Le premier elimine `round` (14) et `floor` (14) d'un coup.

*Avec lead +30 % et Swift* -- equipe Susano / Tarq / Chilling, tous eau, somme
= 15 + 30 + 25 = **70 %** :

| Monstre | base | bonus | calcul |
|---|---|---|---|
| Chilling | 101 | **71** | `ceil(70,70)` |
| Susano | 107 | **75** | `ceil(74,90)` |
| Tarq | 115 | **81** | `ceil(80,50)` -- **385** en jeu |

> **Tarq est le test discriminant** : arrondir separement donnait 80 (384) chez
> lui tout en tombant juste sur les deux autres *par hasard*. Un seul monstre
> faux sur trois : c'est le symptome typique d'un probleme d'ordre de calcul,
> pas d'un mauvais arrondi.

### Le Swift entre dans la SOMME, il ne s'ajoute pas a cote

C'etait la piece manquante. Le Swift est un pourcentage de la base **comme les
autres** : il rejoint la somme avant l'arrondi.

Mais la **convention de l'app** est que le champ « SPD : » -- saisi a la main ou
reconstitue a l'[import de compte](import-compte.md) -- **contient deja le Swift
a plat**. `combatSpeed` le **retire donc** (`swiftFlat`) avant de le reinjecter
dans la somme, sinon il compterait deux fois.

> Pourquoi ne pas plutot stocker les runes brutes ? Parce que les etats deja
> enregistres (equipes de siege, prepa RTA) contiennent la valeur avec Swift :
> compenser evite une migration et **toute reimportation de compte**.

Le set Swift est connu par `slot.sets` (rempli a l'import). Une equipe saisie a
la main n'a pas de sets : son `swift` vaut `false`, et la SPD tapee par
l'utilisateur est prise telle quelle.

## API (`speed.ts`)

| Export | Rôle |
|--------|------|
| `TOTEM_SPEED = 15` | Constante totem. |
| `SPEED_LEADS = [33,30,28,24,23,19]` | Leads SPD possibles, **du plus grand au plus petit**. |
| `SIEGE_TICKS = [{fast,286},{slow,239}]` | Ticks de vitesse de siège. |
| `SWIFT_SPEED = 25` | Bonus du set Swift, en % de la base. |
| `pctSpeedBonus(base, lead, swift)` | `ceil(base × (15 + lead + swift) / 100)` — **une seule** somme, **un seul** arrondi. |
| `swiftFlat(base)` | Le Swift déjà compté à plat dans la « SPD runes », à retirer avant de le remettre dans la somme. |
| `combatSpeed(base, rune, lead, swift)` | Vitesse de combat complète (null si base null). |
| `runeSpeedForTarget(base, lead, target, swift)` | SPD de runes nécessaire pour atteindre un tick. |
| `speedLeadOf(monster)` | `LeadInfo` si le monstre a un lead **de vitesse**, sinon null. |
| `siegeLeadFor(lead, element)` | Lead effectif **en siège** pour un allié d'un élément. |
| `isSiegeLeadActive(lead)` | Le lead est-il actif en siège ? |

## Leads de vitesse

Un lead compte comme lead **de vitesse** seulement si `leaderSkill.stat ===
'Attack Speed'` (⚠️ « Attack Speed », **pas** « Speed » — piège rencontré).

Portée du lead (`area`) et activation **en siège** (`siegeLeadFor`) :

| `area` | Effet en siège |
|--------|----------------|
| `General`, `Guild` | Actif pour **tous** les alliés |
| `Element` | Actif seulement pour les alliés du **même élément** que le leader |
| `Arena`, `Dungeon` | **Inactif** en siège |

> ⚠️ La règle ci-dessus est **spécifique au siège**. L'Arène (à venir) inversera
> une partie : `Arena` devra y être actif.

## Deux usages distincts des leads

- **Siège** : le lead est **déduit automatiquement** du leader (slot 0) via
  `speedLeadOf` + `siegeLeadFor`, et appliqué par monstre selon son élément.
- **RTA / ordre de tour** : le lead est un **choix manuel** (boutons +33 %, +30 %…)
  appliqué **à tous** pour comparer l'ordre. Voir
  [rta/ordre-de-tour.md](../rta/ordre-de-tour.md).

Dans les deux cas, la formule et l'arrondi sont identiques.
