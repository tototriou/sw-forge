# Modèle de vitesse (transverse)

**Source de vérité** pour toute la mécanique de vitesse. RTA et Siège s'y
réfèrent ; toute page à venir (Arène) doit le réutiliser.

Fichier : [speed.ts](src/lib/speed.ts)

## Formule de vitesse de combat

```
vitesse_combat = base + runes + bonus%(base)
bonus%(base)   = round( base × TOTEM / 100 ) + round( base × lead / 100 )
```

- **base** : SPD de base du monstre (`monster.stats.speed`), fixe dans SW.
- **runes** : SPD plate apportée par les runes, **saisie par l'utilisateur**
  (champ « SPD : » des cartes).
- **TOTEM = 15** : totem de vitesse de guilde, **+15 % de la base, toujours actif
  pour tous les monstres**. Jamais optionnel.
- **lead** : bonus de leader skill de vitesse, en %.

### Règles d'arrondi et de base — **impératives**
- Le bonus en % s'applique **uniquement à la vitesse de BASE** (jamais à la base
  + runes).
- ⚠️ **Exception à la règle d'arrondi de l'app** (`ceil` partout ailleurs) :
  totem et lead sont appliqués **séparément**, et **chacun arrondi au plus
  proche** (`Math.round`). C'est ce que fait le jeu. **Ne pas sommer les
  pourcentages** et **ne pas arrondir au supérieur**.

  > **Cas de contrôle** — équipe Susano (lead +30 % VIT eau) / Tarq / Chilling,
  > tous eau :
  >
  > | Monstre | base | totem 15 % | lead 30 % | bonus |
  > |---|---|---|---|---|
  > | Chilling | 101 | `round(15,15)` = 15 | `round(30,30)` = 30 | **45** |
  > | Susano | 107 | `round(16,05)` = 16 | `round(32,10)` = 32 | **48** |
  > | Tarq | 115 | `round(17,25)` = 17 | `round(34,50)` = **35** | **52** |
  >
  > **Tarq est le test discriminant** : son bonus de lead tombe *pile sur la
  > demie*. `floor` y donnerait 51 — un point trop bas — pendant que les deux
  > autres resteraient justes ; c'est le symptôme exact qui a permis de trancher.
  > Sommer puis `ceil` donne 46 / 49 / 52 : faux sur les trois sauf Tarq.
- Le totem (+15 %) est **toujours inclus**, y compris « sans lead ».

### Le Swift n'est PAS rajouté au calcul d'affichage
Quand l'utilisateur saisit la « SPD runes », **le bonus du set Swift est déjà
compris dedans**. Les calculs d'affichage (RTA/Siège) ne rajoutent donc jamais
de Swift. (Le Swift n'est reconstitué qu'à l'[import de compte](import-compte.md),
où on part des runes brutes.)

## API (`speed.ts`)

| Export | Rôle |
|--------|------|
| `TOTEM_SPEED = 15` | Constante totem. |
| `SPEED_LEADS = [33,30,28,24,23,19]` | Leads SPD possibles, **du plus grand au plus petit**. |
| `SIEGE_TICKS = [{fast,286},{slow,239}]` | Ticks de vitesse de siège. |
| `pctSpeedBonus(base, lead)` | `round(base × 15/100) + round(base × lead/100)` — voir l'exception d'arrondi ci-dessus. |
| `combatSpeed(base, rune, lead)` | Vitesse de combat complète (null si base null). |
| `runeSpeedForTarget(base, lead, target)` | SPD de runes nécessaire pour atteindre un tick. |
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
