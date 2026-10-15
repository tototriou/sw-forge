# RTA — Préparation (`#/rta`)

Préparer ses builds de Real Time Arena : choisir les monstres à runer, les classer
par set de runes, saisir la vitesse de leurs runes, et lire l'**ordre de tour**
recalculé selon les leads de vitesse.

Fichier racine : [RtaPage.tsx](src/pages/RtaPage.tsx) · État :
[useRtaState.ts](src/hooks/useRtaState.ts) (`localStorage` `swblacksmith-rta-v1`).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `src/pages/RtaPage.tsx`, `src/components/rta/RtaSearch.tsx`, la création d'un monstre | [feat-recherche-import.md](feat-recherche-import.md) |
| `src/components/rta/RtaSection.tsx`, `src/components/rta/RtaCard.tsx`, `src/components/AccordionGrid.tsx`, l'équipement affiché d'une carte | [feat-sections-runes.md](feat-sections-runes.md) |
| `src/components/rta/TurnOrder.tsx`, `src/components/rta/DesyncBadge.tsx`, `src/lib/gearSync.ts`, les leads de vitesse | [feat-ordre-de-tour.md](feat-ordre-de-tour.md), [../transverse/feat-calcul-vitesse.md](../transverse/feat-calcul-vitesse.md) |
| `src/components/rta/CategoryBar.tsx`, `src/components/rta/CategoryRing.tsx`, `src/hooks/useRtaCategories.ts` | [feat-categories.md](feat-categories.md) |
| `src/components/rta/RtaBackupBar.tsx`, `src/components/rta/RtaAmiSection.tsx`, `src/components/rta/RtaFriendView.tsx`, `src/components/rta/RtaValidationReport.tsx`, `src/hooks/useRtaBackup.ts`, `src/lib/rtaShare.ts` | [feat-sauvegarde-partage.md](feat-sauvegarde-partage.md) |
| `src/hooks/useRtaState.ts`, l'écran dans son ensemble | ce README |

## Deux sous-sections

| Sous-section | Route | Ce qu'on y fait |
|--------------|-------|-----------------|
| **Ma prépa** | `#/rta` | tout l'écran décrit ci-dessous : sa propre prépa |
| **Ami** | `#/rta/ami` | consulter la prépa de quelqu'un d'autre, en lecture — **prépa exportée ou export SWEX complet** |

- ⚠️ **« Ma prépa » a le hash NU `#/rta`** : les liens déjà partagés doivent
  continuer d'y mener. `#/rta/prepa` n'existe pas.
- ⚠️ **La consultation est un ÉCRAN, pas un panneau** au-dessus de sa propre
  prépa : elle a sa route, on y mène par la navigation et son lien se partage.
  Voir [feat-sauvegarde-partage.md](feat-sauvegarde-partage.md).
- Le **panneau d'actions** (téléphone) n'existe que sur « Ma prépa » : ses gestes
  (sauvegarder, exporter, catégories, tout effacer) portent tous sur SA prépa, et
  aucun n'a de sens en lisant celle d'un ami.
- Comme Siège, Mon compte et Outils, **RTA ouvre ses sous-sections** dans la
  barre latérale et dans le panneau de navigation mobile plutôt que de mener
  droit à l'une d'elles (voir [../transverse/](../transverse/)).

## Vue d'ensemble de l'écran « Ma prépa » (de haut en bas)

1. **En-tête** (bureau) : titre « Ma prépa », le compteur (« 3 monstres en
   prépa »), **Exporter**, et le menu **« ⋯ » Plus d'actions** — Sauvegarder,
   Reprendre, Importer une prépa, Créer un monstre, puis, séparés en bas,
   Réinitialiser et Tout effacer. **Quand elles tiennent sur la ligne, elles
   s'y affichent toutes en boutons** (place mesurée) — le menu ne sert que
   faute de place. Voir
   [feat-sauvegarde-partage.md](feat-sauvegarde-partage.md).
2. **Barre de recherche** pour ajouter un monstre à la prépa — **permanente**
   (pas derrière un bouton).
3. **Téléphone** : le compteur seul dans la page ; toutes les actions dans le
   panneau « Options » (création, Sauvegarder · Reprendre · Réinitialiser ·
   Exporter · Importer, catégories, Tout effacer).
4. **« Non classé »** : zone tampon où atterrissent les monstres ajoutés.
5. **Sections par set de runes** (Swift / Violent / Despair / Autre + ajoutables).
6. **Ajouter une section** (choix d'un set de runes).
7. **Ordre de tour** : toutes les cartes triées par vitesse, avec boutons de lead.

## Sous-sections (specs détaillées)

| Sous-section | Spec |
|--------------|------|
| Recherche, import de compte, création de monstre, actions globales | [feat-recherche-import.md](feat-recherche-import.md) |
| Zones de classement drag & drop (Non classé + sets de runes) | [feat-sections-runes.md](feat-sections-runes.md) |
| Ordre de tour & simulation de leads | [feat-ordre-de-tour.md](feat-ordre-de-tour.md) |
| Catégories libres (couleur + titre) et anneau des cartes | [feat-categories.md](feat-categories.md) |
| Point de sauvegarde, export & import de prépa | [feat-sauvegarde-partage.md](feat-sauvegarde-partage.md) |

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
  [feat-sauvegarde-partage.md](feat-sauvegarde-partage.md).
- Clés : `swblacksmith-rta-v1` (la prépa), `swblacksmith-rta-categories-v1` (les
  catégories), `swblacksmith-rta-backup-v1` (le point de sauvegarde).
- Au chargement, l'état est validé/réparé (types, garantie de « Autre »).
- Un monstre présent dans `entries` mais **absent des données chargées** est
  simplement ignoré à l'affichage (pas d'erreur).

## Règles clés

- **SPD runes = Swift déjà inclus** : la valeur saisie est utilisée telle quelle
  (pas de +Swift ajouté). Voir [../transverse/](../transverse/).
- Le tri **interne** à chaque section et l'ordre de tour utilisent la **vitesse
  totale sans lead** (`base + runes`) ; les leads ne s'appliquent que dans l'outil
  d'ordre de tour.
- Tout est réutilisable au tactile : chaque carte a un **sélecteur de section**
  (repli du drag & drop).
