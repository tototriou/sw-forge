# Siège (`#/siege/defense`, `#/siege/offense`, `#/siege/recommandations`)

Composer des équipes de **3 monstres** de combat de guilde, avec lead de vitesse
**automatique** et vérification des **speed tune** (ticks). La page est découpée en
**trois sous-onglets** : **Défense**, **Offense** et **Recommandations**.

Fichiers :
- [SiegePage.tsx](src/pages/SiegePage.tsx) — shell : titre + sous-onglets, choisit
  l'onglet selon la route (`#/siege/defense` par défaut, `#/siege/offense`,
  `#/siege/recommandations`). Type `SiegeTab = 'defense' | 'offense' | 'recos'`
  (distinct de `SiegeSide`, qui ne pilote que le stockage des deux côtés jouables).
- [SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx) — le board réutilisable,
  paramétré par `side` ('defense' | 'offense'). Monté avec `key={side}` pour
  réinitialiser au changement d'onglet.
- État : [useSiegeState.ts](src/hooks/useSiegeState.ts) — **une liste d'équipes
  par côté**, `localStorage` `sw-forge-siege-defense-v1` / `sw-forge-siege-offense-v1`
  (migration : l'ancienne clé unique `sw-forge-siege-v1` → défense).

Les deux côtés **jouables** (défense/offense) partagent **exactement la même
mécanique** (composition, lead auto, ticks) — voir [equipes.md](equipes.md) et
[speed-tick.md](speed-tick.md). Seules diffèrent les données d'import (voir
ci-dessous). L'onglet **Recommandations** a son propre modèle et sa propre
persistance : voir [recommandations.md](recommandations.md).

## Vue d'ensemble

1. **En-tête** : titre « Siège » + intro dépendant du côté.
2. **Sous-onglets** : Défense / Offense.
3. **Barre d'actions**, dans cet ordre : **Ajouter une équipe** → **Vérifier mes
   tick ATB** → **Créer un monstre** → compteur d'équipes → **Tout effacer**
   (poussé à droite).
   - « Créer un monstre » est **en dernier des actions** : c'est le geste le plus
     rare.
   - Tous les boutons d'action partagent le **même gabarit**
     (`px-3.5 py-2`, 13 px, icône 15) — y compris `CreateMonster`, qui était plus
     petit et paraissait rabougri à côté des autres.
4. **Liste d'équipes** (ou état vide incitant à ajouter/importer).

### Disposition de la liste — 2 équipes par ligne

- **1 colonne** jusqu'à `lg`, **2 colonnes à partir de `xl`** (≥ 1280 px) pour ne
  pas gâcher la largeur sur grand écran (le conteneur de l'app est plafonné à
  1180 px → ~575 px par équipe, assez pour les 3 monstres côte à côte).
- **Une équipe en cours d'édition reprend toute la largeur**
  (`xl:col-span-2`) : les 3 slots détaillés (picker, SPD, ticks, position)
  seraient trop à l'étroit sur une demi-colonne.
- Pour ça, l'état « équipe dépliée » est **remonté dans
  [SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx)** (`expandedIds`, un
  `Set`) et passé en prop ; **plusieurs équipes peuvent rester dépliées** en même
  temps, comme avant.
- `items-start` : une équipe dépliée n'étire pas la carte compacte d'à côté.

### Ajouter une équipe → scroll automatique

Cliquer **Ajouter une équipe** ajoute l'équipe **en fin de liste** et **scrolle
automatiquement** jusqu'à elle (`scrollIntoView`, `behavior: 'smooth'`,
`block: 'center'`) — indispensable avec ~50 équipes importées, sinon la nouvelle
équipe naît hors écran. Implémenté dans
[SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx) : la **dernière** équipe
rendue porte une `ref`, et un flag `scrollToLast` déclenche le scroll au rendu
suivant.

### ⚠️ Supprimer une équipe demande confirmation

Le bouton **Supprimer** est juste à côté d'**Éditer**, qu'on utilise sans arrêt,
et rien ne permet de revenir en arrière : ni annulation, ni corbeille. Trois
monstres et leurs vitesses saisies partent avec l'équipe.

La modale **nomme les monstres concernés** — « Supprimer l'équipe 3 ? » ne dit
rien, « Chilling, Susano, Tarq » si — et rappelle que les autres équipes ne sont
pas touchées. Voir la convention des modales dans le [README](README.md).

Même règle pour les **decks de recommandation** et les recommandations
elles-mêmes (voir [recommandations.md](recommandations.md)).

### Bouton « Vérifier mes speed »

Interrupteur de la barre d'actions (icône jauge) qui **colore le statut** des
équipes (vert / orange / rouge, voir [speed-tick.md](speed-tick.md)) — ⚠️ par le
**contour et la pastille** de l'en-tête, jamais par le fond de la card.

⚠️ **« mes speed », pas « mes tick ATB ».** Le bouton couvre les DEUX questions :
une équipe **Swift** se juge sur son **speed tune**, les autres sur leur
**tick**. L'ancien libellé n'en nommait qu'une — et pas celle qui compte pour
les équipes speed. L'infobulle dit les deux.

- **Désactivé par défaut** : les équipes sont affichées **telles quelles**, en
  neutre — contour neutre, aucun point de statut, aucun anneau rouge sur les slots,
  aucun message, donc aucune des deux actions (« Valider le speed tune » / « Valider
  le tick », « Voir le speed tune »).
- ⚠️ **Une fois allumé, TOUT est automatique** : statut, message nommant les
  monstres fautifs, et **l'ordre de tours d'une équipe Swift** (voir
  [speed-tick.md](speed-tick.md)). Le bouton dit **quand on veut voir**, il ne
  demande jamais de refaire un calcul soi-même.
- **Par côté** (défense / offense indépendants) et **non persisté sur disque** :
  `useStickyState` — l'état survit à la navigation, se remet à `false` au reload.
- Le bouton n'apparaît que s'il y a **au moins une équipe**.
- Les **boutons de tick** de chaque monstre restent disponibles dans les deux
  cas : c'est un réglage, pas un affichage de statut.

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
| Recommandations : lots de decks (création, partage, confrontation à la box) | [recommandations.md](recommandations.md) |

## Modèle d'état

```ts
interface SiegeSlot { monsterId: string | null; runeSpeed: number | null; tick: number; sets?: string[] }
interface SiegeTeam { id: string; slots: SiegeSlot[]; lead: number; tickAlertDismissed: boolean }
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
