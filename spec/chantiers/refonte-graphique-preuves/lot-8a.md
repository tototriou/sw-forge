# Preuve — lot 8a de la refonte graphique : Mon compte · Runes

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à
B.10, § Lot 8a (découpage en trois sous-lots). Décision appliquée (A.2 bis) :
**20**, précisée — les filtres restent visibles, sur une ligne à la souris,
sans menu déroulant ; les ajouts de la maquette sont repoussés au lot 13.

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

## 8a-1 — les filtres sur une ligne

Trois essais le même jour, avec Thomas.

| Commit | Quoi | Retour de Thomas |
|---|---|---|
| `c0e04a6`, `f010f55` | `src/ui/Deroulant` ; les trois filtres en menus déroulants (la maquette), plus « Effacer les filtres » | « pas très fan d'avoir des drop-down pour un set filtre dedans » |
| `ebeda3a` | les sets visibles, Emplacement et Antiques en menus | « sors tout des boutons » |
| (ce commit) | les trois filtres VISIBLES sur une ligne, plus « Effacer les filtres » ; `Deroulant` retiré de la librairie, sans autre usage | — |

État final :
- **`FiltresRunes`**, à la souris, dans la Liste, les Courbes et
  l'Optimisation : `SetFilter` · `SlotFilter` · `AncientFilter` (absent de
  l'Optimisation, qui le range dans ses options), sur une ligne, puis
  « Effacer les filtres ». Ce bouton est toujours affiché, désactivé sans
  filtre (« Aucun filtre posé »).
- `SetFilter` et `SlotFilter` sont revenus à l'identique d'avant le lot.
- Au doigt, rien ne change : la Liste garde ses rangées dans le panneau
  « Options », les Courbes et l'Optimisation dans la page (`lg:hidden`).

Tests :
- les 114 vérifications d'avant sont inchangées ;
- le test propre au sous-lot, écrit pour les menus, suit leur retrait et
  devient `testRenduRunesFiltresLigne` (6 vérifications) : aucun filtre
  fermé dans un menu, et « Effacer les filtres » désactivé avec sa raison.

Inventaire : aucune perte ; un seul libellé ajouté, « Effacer les
filtres ».

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu-runes rendu-ui     → 155 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built
```

À regarder sur le serveur de dev : la ligne de filtres, et « Effacer les
filtres » après avoir filtré.

### Ajustements de 8a-1, puis validation

| Commit | Demande de Thomas | Quoi |
|---|---|---|
| `26b3aeec` | « que les boutons aient tous la même tête » | sets et emplacements au gabarit du `Segmented` à la souris (`gabaritFiltre.ts`), « Effacer » à 32 px, intitulé « Runes » pour les antiques |
| `473d61bd`, `17a1e2bb` | tri en `Segmented`, puis « ça fait peut-être un peu gros » | onglets pour l'Optimisation (5 entrées) ; la Liste (9) garde sa liste déroulante, à 32 px |
| `496c198c` | « mets le Trier par au-dessus de la propriété » | le tri avant la propriété secondaire ; « ci-dessus » → « ci-dessous » (déclaré) |
| `d310592f` | « il y a Score et Efficience mais c'est la même chose » | **décision 21**, [retrait #21] : une seule entrée de mesure, celle du ⚙ ; une assertion d'avant remplacée |

**8a-1 validé par Thomas le 2026-09-27** (« ok »).

## 8a-2 — Résumé et Liste

| Commit | Quoi |
|---|---|
| `84e07ed` | `Pager` : flèches en `BoutonIcone` de la librairie, même carré de 28 px et même zone tactile de 44 px (décision 16) ; vaut pour toutes les pages qui paginent ; 4 libellés déclarés (`libelle`) |
| `989f8f5` | Résumé à la souris : en-tête, bandeau de chiffres (`Kpi bandeau`), trois colonnes (`lg:order-*`), « Par emplacement » en barres verticales ; Liste : en-tête ; tests `testRenduRunesResumeSouris` (3), `testRenduRunesListeSouris` (1) |

Rien n'est retiré. Le tableau des stats principales slot par slot, le lien
« Voir l'optimisation » et la pagination numérotée restent pour le lot 13.

## 8a-3 — Courbes, Comparaison, Optimisation

| Commit | Quoi |
|---|---|
| (ce commit) | Courbes : en-tête (titre et ce qu'elles tracent), graphe et légende côte à côte (carte « Séries ») ; Comparaison : titre en tête des sous-onglets, même graphe et légende côte à côte dans les deux sous-onglets ; Optimisation : en-tête ; `CurveLegend` reçoit `className` ; test `testRenduRunesVuesSouris` (5) |

Non fait, pour décision (liste du lot 13) : le plan d'optimisation écrit dans
chaque carte, au lieu du panneau qui s'ouvre au clic.

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu-runes              → 135 vérifications passées
$ node tests/run.mjs rendu                    → toutes les zones vertes (462 avant 8a-3)
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; grilles 220 / 240 px émises
```

## Ajustements de 8a-3, puis clôture

| Commit | Demande de Thomas | Quoi |
|---|---|---|
| `c87c8f13` | « revois un peu les infobulles pour que ça rende mieux » | l'infobulle du graphe (Courbes, Comparaison) en HTML au gabarit des panneaux, aux couleurs du thème ; grille, graduations et axes aux tokens |
| `aaaac28c` | capture de « Comment est-ce calculé ? » : « ça ne rend pas bien » | `HelpPopover` : rembourrage, hauteur bornée avec défilement, titre détaché — toutes les aides « ? » de l'app |
| `c094446e` | « fais la même chose partout dans l'appli » | recensement de toutes les bulles ; les deux dernières écrites à la main (précision d'une défense visée, menu ⚙) passent au `Flottant` |

**Lot 8a validé par Thomas le 2026-09-27** (« ok c'est good »).
Téléphone non regardé (lot 11).
