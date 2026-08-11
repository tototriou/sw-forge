# RTA — Préparation (`#/rta`)

Préparer ses builds de Real Time Arena : choisir les monstres à runer, les classer
par set de runes, saisir la vitesse de leurs runes, et lire l'**ordre de tour**
recalculé selon les leads de vitesse.

Fichier racine : [RtaPage.tsx](src/pages/RtaPage.tsx) · État :
[useRtaState.ts](src/hooks/useRtaState.ts) (`localStorage` `sky-arena-rta-v1`).

## Vue d'ensemble de l'écran (de haut en bas)

1. **En-tête** : titre + explication.
2. **Barre de recherche** pour ajouter un monstre à la prépa.
3. **Barre d'actions** : compteur, **Importer un compte**, **Créer un monstre**,
   **Tout effacer** ; + disclaimer monstres récents / message d'import.
3bis. **Sauvegarder · Reprendre · Exporter · Importer** — point de restauration
   manuel et partage de prépa. Voir [sauvegarde-partage.md](sauvegarde-partage.md).
4. **« Non classé »** : zone tampon où atterrissent les monstres ajoutés.
5. **Sections par set de runes** (Swift / Violent / Despair / Autre + ajoutables).
6. **Ajouter une section** (choix d'un set de runes).
7. **Ordre de tour** : toutes les cartes triées par vitesse, avec boutons de lead.

## Sous-sections (specs détaillées)

| Sous-section | Spec |
|--------------|------|
| Recherche, import de compte, création de monstre, actions globales | [recherche-import.md](recherche-import.md) |
| Zones de classement drag & drop (Non classé + sets de runes) | [sections-runes.md](sections-runes.md) |
| Ordre de tour & simulation de leads | [ordre-de-tour.md](ordre-de-tour.md) |
| Catégories libres (couleur + titre) et anneau des cartes | [categories.md](categories.md) |
| Point de sauvegarde, export & import de prépa | [sauvegarde-partage.md](sauvegarde-partage.md) |

## Modèle d'état (`RtaState`)

```ts
interface RtaEntry { monsterId: string; section: string; runeSpeed: number | null }
interface RtaState { sections: string[]; entries: Record<string, RtaEntry> }
```

- Une entrée **par monstre** (`entries` indexé par `monsterId`) → un monstre ne
  peut apparaître qu'une fois dans la prépa.
- `section` : `unassigned` (Non classé), `other` (Autre), ou une clé de set de
  runes (`swift`, `violent`…). Voir `RUNE_SETS`, `sectionLabel`, `sectionAccent`
  dans [types.ts](src/types.ts).
- `sections` : sets de runes **visibles** (hors « Non classé »). Défaut :
  `['swift', 'violent', 'despair', 'other']`.
- **« Autre » (`other`) est permanent** : jamais supprimable, toujours garanti
  présent (même après un état corrompu au chargement).

## Persistance & robustesse

- Tout changement est sauvegardé dans `localStorage` (échec silencieux si quota)
  — **automatiquement**, sans geste de l'utilisateur. Le bouton « Sauvegarder »
  ne sert donc pas à enregistrer mais à poser un **point de retour** ; voir
  [sauvegarde-partage.md](sauvegarde-partage.md).
- Clés : `sky-arena-rta-v1` (la prépa), `sw-forge-rta-categories-v1` (les
  catégories), `sw-forge-rta-backup-v1` (le point de sauvegarde).
- Au chargement, l'état est validé/réparé (types, garantie de « Autre »).
- Un monstre présent dans `entries` mais **absent des données chargées** est
  simplement ignoré à l'affichage (pas d'erreur).

## Règles clés

- **SPD runes = Swift déjà inclus** : la valeur saisie est utilisée telle quelle
  (pas de +Swift ajouté). Voir [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md).
- Le tri **interne** à chaque section et l'ordre de tour utilisent la **vitesse
  totale sans lead** (`base + runes`) ; les leads ne s'appliquent que dans l'outil
  d'ordre de tour.
- Tout est réutilisable au tactile : chaque carte a un **sélecteur de section**
  (repli du drag & drop).
