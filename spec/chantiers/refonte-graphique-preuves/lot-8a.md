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
