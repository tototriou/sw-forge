# Mon compte — Runes (`#/compte/runes`)

Explorer et analyser **tout l'inventaire de runes**. Composant conteneur :
`RunesSection` ([RunesSection.tsx](src/components/account/RunesSection.tsx)), avec
**4 onglets internes** :

| Onglet | Composant | Rôle |
|--------|-----------|------|
| Liste | `RunesList` | Toutes les runes, filtrables/triables |
| Courbes | `RunesCurve` | Courbe d'efficience (ma courbe) |
| Comparaison | `RunesCompare` | Export/import & superposition de courbes |
| Optimisation | — | Placeholder « à venir » |

## Efficience d'une rune

`runeEfficiency(rune)` dans [effects.ts](src/lib/effects.ts) — formule validée :

```
eff = (min(main/mainMax, 1) + Σ(substat/subMax) + innée/subMax) / 2.8 × 100
```

Substats = **valeur meule incluse**. Maxes 6★ **non antiques** → une rune antique
peut dépasser 100 %. Détail des maxes dans [effects.ts](src/lib/effects.ts).

## Onglet Liste — `RunesList`

- **Tuiles uniformes** : à gauche le **cadre de rune** (image du jeu) **orienté
  selon le slot** ((slot−1)×60°) avec l'**icône du set dedans** colorisée par
  rareté (composant [RuneSlotIcon.tsx](src/components/RuneSlotIcon.tsx), halo blanc
  si antique) ; à côté la **stat principale** ; en dessous l'**efficience**
  (teintée par rareté). Tuiles mémoïsées.
- **Détail au clic** : carte récap façon jeu (`RuneDetailBox`) en **popover
  flottant** à **placement automatique** — s'ouvre vers la gauche près du bord
  droit, vers le haut près du bas ([DetailPopover.tsx](src/components/account/DetailPopover.tsx)),
  pour ne jamais être coupée et ne pas décaler la grille.
- **Filtres** : **sets** (multi-sélection, chips icône + libellé), **slot** (1-6),
  **antiques**.
- **Tri** : Efficience ↓ (défaut) · Efficience ↑ · Niveau ↓ · Slot ↑.
- **Pagination** (`Pager`) : 60 tuiles/page → DOM borné (fluide même à ~2000
  runes). En-tête : nombre filtré + meilleure efficience.

## Onglet Courbes — `RunesCurve`

Courbe d'efficience : runes **triées par efficience décroissante**.
**Ordonnée = efficience (%)**, **abscisse = nombre de runes** (rang cumulé — se
lit « combien de runes ont au moins X % »).

- Rendu SVG **sobre** et **maison** (aucune dépendance) via
  [CurveChart.tsx](src/components/account/CurveChart.tsx) : courbe **lissée**
  (Catmull-Rom → Bézier), aire discrète sous la courbe, grille + graduations,
  titres d'axes. Axe Y **ajusté aux données** (du min au max arrondis) → courbe
  centrée qui remplit la hauteur. Sous-échantillonnage à ~240 points de contrôle.
- **Filtres de la courbe** : **sets** (icônes **compactes**, toggle), **slot**,
  **antiques**.
- **Nombre de runes** : champ numérique libre (défaut **400**) + bouton **Tout**
  → limite les N meilleures affichées. Bandeau : max / médiane sur le sous-ensemble.

## Onglet Comparaison — `RunesCompare`

Se comparer entre amis en superposant plusieurs courbes.

- **Exporter** (icône **Upload ↑**) : demande un nom, génère un **code compact**
  (base64 d'un JSON `{ nom, efficiences×10 }`, voir
  [runeCurveShare.ts](src/lib/runeCurveShare.ts)), **copie** dans le presse-papier
  **et télécharge** `swforge-runes-<nom>.txt`. Encode **toutes** mes efficiences
  (la limite d'affichage ne s'applique pas à l'export).
- **Importer une courbe** (icône **Download ↓**) : charge un fichier `.txt` exporté
  par un ami → courbe superposée.
- **Importer un JSON** (icône FileJson) : charge le **JSON de compte SWEX brut**
  d'un ami (s'il n'a pas l'outil) ; ses runes sont extraites à la volée
  (`parseAccountInventory`) et sa courbe calculée. **100 % local.**
- **Superposition** : ma courbe en **doré** (aire), les amis en couleurs vives.
  Palette cyclique. Bornes du graphe recalculées sur les courbes **visibles**.
- **Légende** : par courbe → pastille + nom + (max · médiane · nb). **Cliquer le
  nom masque/affiche** sa courbe (nom barré/atténué si masquée). La croix (✕)
  **retire** définitivement une courbe importée.
- **Nombre de runes** : bascule **Top 400 / Tout** appliquée à toutes les séries.

> Convention d'icônes : **Exporter = Upload ↑**, **Importer = Download ↓**.

## Onglet Optimisation

Placeholder « à venir » — recommandations d'optimisation de runes (non implémenté).
