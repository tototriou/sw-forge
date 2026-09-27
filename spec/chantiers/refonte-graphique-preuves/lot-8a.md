# Preuve — lot 8a de la refonte graphique : Mon compte · Runes

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à
B.10, § Lot 8a (découpage en trois sous-lots). Décision appliquée (A.2 bis) :
**20** — filtres en menus déroulants à la souris, ajouts de la maquette
repoussés au lot 13.

## Tests écrits AVANT (commit `dd0151b`)

`tests/rendu/runes.test.tsx`, rendu bureau, 114 vérifications. La fixture
est une réserve de 9 runes : six slots, six sets, une antique, une gemmée,
une meulée, une innée, trois raretés, et une rune au-dessus du palier par
défaut de l'Optimisation.

- **Résumé** : chiffres clés, distribution, qualité du stock, raretés, par
  emplacement, stats principales, marge de progression, par set.
- **Liste** : filtres, propriété secondaire, tri et sens, une tuile par
  rune, la meilleure en tête, innée, meule et sa bascule.
- **Courbes** : filtres, mode du potentiel, nombre de runes, aide, plein
  écran, axes, légende masquable.
- **Comparaison** : sous-onglets, export et import, explication, « Moi ».
- **Optimisation** : avertissement, filtres, tri, palier, « Faisable avec ma
  réserve », « Sans les immémoriaux », « Runes utilisées », aide, une rune
  et ses potentiels.
- **Meules et Gemmes** : « Bientôt disponible ».

Hors zone : la mesure Efficience / Score SW, réglage global du menu ⚙.

## 8a-1 — les filtres en menus déroulants

| Commit | Quoi |
|---|---|
| `c0e04a6` | `src/ui/Deroulant` : bouton `sm` à cadre (intitulé, résumé, chevron) + panneau `Flottant` `role="dialog"`, resté dans le DOM fermé ; test `testRenduUiDeroulant` (4) |
| (ce commit) | `FiltresRunes` : Set · Emplacement · Antiques + « Effacer les filtres », dans la Liste, les Courbes et l'Optimisation (sans Antiques, rangés dans ses options) ; `sansIntitule` sur `SetFilter` et `SlotFilter` ; test `testRenduRunesFiltresDeroulants` (15) |

Chaque panneau contient les MÊMES contrôles qu'avant. Au doigt, rien ne
change :
- la Liste garde ses rangées dans le panneau « Options » ;
- les Courbes et l'Optimisation les gardent dans la page (`lg:hidden`).

Aucune assertion d'avant modifiée. Inventaire : aucune perte. Seuls des
libellés sont ajoutés (« Set », « Emplacement », « Antiques », « Effacer
les filtres »).

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu-runes              → 129 vérifications passées
$ node tests/run.mjs rendu-ui-deroulant       → 4 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; contents, w-max, lg:block émis
```

À regarder sur le serveur de dev (non testable en rendu serveur) :
- l'ouverture et la fermeture de chaque menu : clic dehors, Échap,
  rappuyer ;
- le résumé des sets quand on en décoche : icônes, noms, « +N » ;
- « Effacer les filtres » ;
- la page qui ne bouge pas quand un menu s'ouvre : le panneau flotte.
