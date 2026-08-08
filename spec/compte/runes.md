# Mon compte — Runes (`#/compte/runes`)

Explorer et analyser **tout l'inventaire de runes**. Composant conteneur :
`RunesSection` ([RunesSection.tsx](src/components/account/RunesSection.tsx)), avec
**4 onglets internes** :

| Onglet | Composant | Rôle |
|--------|-----------|------|
| Liste | `RunesList` | Toutes les runes, filtrables/triables |
| Courbes | `RunesCurve` | Courbes d'efficience (actuelle + potentiels) |
| Comparaison | `RunesCompare` | Export/import & superposition de courbes entre amis |
| Optimisation | `RunesOptim` | Ce qu'il faut grinder/gemmer pour gagner en efficience |

**Persistance** : les tris/filtres de chaque onglet (et l'onglet actif) sont
conservés à la navigation via `useStickyState` ([useStickyState.ts](src/hooks/useStickyState.ts))
— cache mémoire par clé, remis à zéro au reload (comme les données de compte).
**Un seul détail (popover) ouvert à la fois** par section (ouvrir une rune ferme
la précédente).

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
  rareté ([RuneSlotIcon.tsx](src/components/RuneSlotIcon.tsx), halo blanc si
  antique ; petit décalage de l'icône le long de l'axe d'orientation par slot) ;
  à côté la **stat principale** ; en dessous l'**efficience** (teintée par rareté).
- **Détail au clic** : carte récap façon jeu (`RuneDetailBox`) en **popover
  flottant** à **placement automatique** ([DetailPopover.tsx](src/components/account/DetailPopover.tsx)) —
  s'ouvre vers la gauche/haut près d'un bord, jamais coupée, ne décale pas la grille.
- **Filtres** : **sets** (multi-sélection, chips icône + libellé), **slot** (1-6),
  **antiques**.
- **Tri** : Efficience ↓ (défaut) · Efficience ↑ · Niveau ↓ · Slot ↑.
- **Pagination** (`Pager`) : 60 tuiles/page → DOM borné (fluide même à ~2000 runes).

## Onglet Courbes — `RunesCurve`

Trois courbes, chacune **triée par efficience décroissante** (ordonnée =
efficience %, abscisse = nombre de runes) :

- **Actuelle** (bleu, avec aire) — l'efficience des runes aujourd'hui.
- **Potentiel Héro** (violet) / **Potentiel Légend** (orange) — l'efficience si
  chaque rune recevait son optimisation maximale (voir onglet Optimisation) ;
  identiques aux tris « Potentiel héroïque / légendaire » de l'Optimisation.

Détails :
- Rendu SVG **sobre** et **maison** (aucune dépendance) via
  [CurveChart.tsx](src/components/account/CurveChart.tsx) : courbes **lissées**
  (Catmull-Rom → Bézier), aire discrète sous « Actuelle », grille, graduations,
  titres d'axes, axe Y ajusté aux données, sous-échantillonnage ~240 points.
- **Interactif** : au survol, ligne verticale + points sur chaque courbe +
  **infobulle** (nombre de runes + efficience par série, ordonnées de la plus haute
  à la plus basse au point survolé).
- **Légende sous le graphe** : cliquer un nom **masque/affiche** sa courbe.
- **Filtres** : sets (icônes compactes), slot, antiques.
- **Nombre de runes** : champ libre (défaut **400**) + **Tout**.
- **Mode** : **Gemme + meule** / **Meule seule** (voir Optimisation).
- **Aide « ? »** superposée en coin du graphe (popup fermable au clic extérieur)
  expliquant la lecture et renvoyant vers l'Optimisation.

## Onglet Comparaison — `RunesCompare`

Se comparer entre amis en superposant plusieurs courbes (efficience **actuelle**).

- **Exporter** (icône **Upload ↑**) : demande un nom, génère un **code compact**
  (base64, voir [runeCurveShare.ts](src/lib/runeCurveShare.ts)), **copie** au
  presse-papier **et télécharge** `swforge-runes-<nom>.txt` (encode toutes les
  efficiences).
- **Importer une courbe** (icône **Download ↓**) : charge le `.txt` d'un ami.
- **Importer un JSON** (icône FileJson) : charge le **JSON de compte SWEX brut**
  d'un ami (s'il n'a pas l'outil) ; runes extraites à la volée (`parseAccountInventory`).
  **100 % local.**
- **Superposition** : ma courbe (« Moi ») en bleu, les amis en couleurs vives
  (palette cyclique). Bornes recalculées sur les courbes **visibles**.
- **Légende** : pastille + nom + (max · médiane · nb) ; **cliquer le nom
  masque/affiche** ; la croix (✕) **retire** une courbe importée.
- **Nombre de runes** : bascule **Top 400 / Tout**.

> Convention d'icônes : **Exporter = Upload ↑**, **Importer = Download ↓**.

## Onglet Optimisation — `RunesOptim`

Calcule, pour chaque rune, son **potentiel maximal** et **ce qu'il faut faire**
pour l'atteindre. Calcul pur & linéaire dans [runeOptim.ts](src/lib/runeOptim.ts)
(`runePotential`, `runePlan`) — réutilisable dans un Web Worker.

> **Disclaimer** affiché en tête : c'est une optimisation d'**efficience**, pas
> forcément la bonne stat pour ton monstre.

### Potentiel = gemme optimale **puis** grind au max

Deux scénarios calculés (héroïque & légendaire, **tables classiques et antiques
distinctes**) :

- **Meules (grinds)** : chaque substat grindable porté **exactement** à son grind
  max (RES/Précision/Taux Crit/Dmg Crit **non grindables**). Une rune déjà grindée
  au-delà (ex. légendaire) est **ramenée** au max du scénario en héroïque (delta
  négatif possible).
- **Gemme** :
  - rune **non gemmée** → on choisit **le meilleur substat à remplacer** par la
    **meilleure stat grindable** (PV%/ATQ%/DEF%/VIT, sinon un flat), **sans
    doublon** (≠ principale / innée / autres substats) et en respectant les
    **emplacements** (slot 1 : pas de DEF ; slot 3 : pas d'ATQ) ;
  - rune **déjà gemmée** → la stat gemmée est **figée** (on ne peut pas en gemmer
    une autre) ; seul gain possible = **procker au max** (porter la base de la
    gemme au max si elle n'y est pas déjà). Rien si déjà au max.
  - total de la stat gemmée = `gemMax + grindMax`.

Tables de valeurs (grind max & base max de gemme, classiques/antiques, héro/légend)
fournies par l'utilisateur, codées dans [runeOptim.ts](src/lib/runeOptim.ts).

### Modes

- **Gemme + meule** (défaut) : potentiel complet ci-dessus.
- **Meule seule** : garde les **stats actuelles** (aucune gemme), ne pousse que les
  meules → pour repérer les runes à **grinder en priorité**.

### Affichage & interactions

- **Tri** (dropdown) : Efficience actuelle (défaut) · Potentiel héroïque ·
  Potentiel légendaire · Gain héroïque · Gain légendaire. **Gain** = potentiel −
  efficience actuelle.
- **Palier** : champ % — n'affiche que les runes dont l'efficience actuelle ≥ palier
  (défaut 100 %).
- **Tuiles** : efficience **actuelle**, puis **Héro** et **Légend** avec leur gain
  et l'efficience cible colorée **vert** (au-dessus de l'actuelle) / **rouge** (en
  dessous). Pagination 60/page.
- **Détail au clic** : plan **« Actuel | Optimisé »** (`OptimPlanBox`) — substats
  actuels à gauche (base blanche + meule orange), optimisés à droite avec **seul ce
  qui change en violet** (grind posé ou 💎 gemme/proc max).
- **Aide « ? »** sur la ligne des filtres (popup fermable au clic extérieur).
