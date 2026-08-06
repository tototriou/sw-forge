# Siège (`#/siege/defense`, `#/siege/offense`)

Composer des équipes de **3 monstres** de combat de guilde, avec lead de vitesse
**automatique** et vérification des **speed tune** (ticks). La page est découpée en
**deux sous-onglets** : **Défense** et **Offense**.

Fichiers :
- [SiegePage.tsx](src/pages/SiegePage.tsx) — shell : titre + sous-onglets, choisit
  le côté selon la route (`#/siege/defense` par défaut, `#/siege/offense`).
- [SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx) — le board réutilisable,
  paramétré par `side` ('defense' | 'offense'). Monté avec `key={side}` pour
  réinitialiser au changement d'onglet.
- État : [useSiegeState.ts](src/hooks/useSiegeState.ts) — **une liste d'équipes
  par côté**, `localStorage` `sw-forge-siege-defense-v1` / `sw-forge-siege-offense-v1`
  (migration : l'ancienne clé unique `sw-forge-siege-v1` → défense).

Les deux côtés partagent **exactement la même mécanique** (composition, lead auto,
ticks) — voir [equipes.md](equipes.md) et [speed-tick.md](speed-tick.md). Seules
diffèrent les données d'import (voir ci-dessous).

## Vue d'ensemble

1. **En-tête** : titre « Siège » + intro dépendant du côté.
2. **Sous-onglets** : Défense / Offense.
3. **Barre d'actions** : **Ajouter une équipe**, **Créer un monstre**, compteur
   d'équipes, **Tout effacer**.
4. **Liste d'équipes** (ou état vide incitant à ajouter/importer).

L'**import est global** (bouton « Importer mon compte » dans la barre de nav) :
il remplit défense **et** offense **et** RTA d'un coup — pas de bouton d'import
par côté. Rappel « données locales » + suppression : footer global.

Nombre d'équipes **illimité** par côté (l'import offense peut créer ~50 équipes
d'attaque sauvegardées).

## Sous-sections (specs détaillées)

| Sous-section | Spec |
|--------------|------|
| Composition d'équipe, slots, leader, drag & drop | [equipes.md](equipes.md) |
| Vitesse de combat, lead auto, ticks & retour manque/surplus | [speed-tick.md](speed-tick.md) |

## Modèle d'état

```ts
interface SiegeSlot { monsterId: string | null; runeSpeed: number | null; tick: number }
interface SiegeTeam { id: string; slots: SiegeSlot[]; lead: number }
interface SiegeState { teams: SiegeTeam[] }
```

- Chaque équipe a **toujours 3 slots** ; **le slot 0 est le leader**.
- `slot.tick` : vitesse de combat cible **par monstre** (0 = aucun tick actif) →
  ticks mixables au sein d'une équipe (ex. 2 rapides + 1 lent).
- `lead` : champ présent dans le modèle mais **le lead effectif est déduit
  automatiquement du leader** (voir [speed-tick.md](speed-tick.md)) ; le lead
  manuel n'est pas exposé dans l'UI actuelle.

## Persistance & robustesse

- Sauvegarde `localStorage` à chaque changement.
- Au chargement, chaque équipe est normalisée à exactement 3 slots, types validés,
  `id` régénéré si manquant.

## Import depuis le compte (global)

L'import est **unique et global** (bouton de la barre de nav). Il crée les
équipes des **deux** côtés en une fois :

- **Défense** : `guildsiege_defense_deck_unit_list`.
- **Offense** : équipes d'attaque sauvegardées (`deck_list`, `deck_type = 22`).

Chaque deck → une équipe (leader en slot 0, SPD runes de siège incluses). Détail
complet dans [../shared/import-compte.md](../shared/import-compte.md).

## Règles clés

- **Lead automatique** : porté par le leader (slot 0), appliqué par monstre selon
  les règles de siège (voir [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md)).
- **Vitesse de combat mise en avant** (gros chiffre) sur chaque slot rempli.
- Les boutons de tick servent à **informer** l'utilisateur : combien il **manque**
  ou est **en trop** pour atteindre le tick — ils ne modifient pas la vitesse.
- Réutilisable au tactile : chaque slot a un **sélecteur de position** (repli du
  drag & drop).
